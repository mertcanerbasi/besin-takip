// Kilo ve vücut ölçüleri takibi.
import { esc, n1, num, r1, todayStr, fmtShort, fmtLong, toast, uid, confirmDialog } from '../util.js';
import { bodyEntries, saveBodyEntry, deleteBodyEntry, getProfile } from '../model.js';
import { chart, cssVar, clearCharts } from '../charts.js';

const FIELDS = [
  ['weight', 'Kilo', 'kg'],
  ['bodyFat', 'Yağ oranı', '%'],
  ['waist', 'Bel', 'cm'],
  ['hip', 'Kalça', 'cm'],
  ['chest', 'Göğüs', 'cm'],
  ['arm', 'Kol', 'cm'],
  ['thigh', 'Bacak', 'cm'],
  ['neck', 'Boyun', 'cm'],
];

let metric = 'weight';

export function render(container) {
  clearCharts();
  const list = bodyEntries();
  const latest = list[list.length - 1];
  const first = list[0];
  const profile = getProfile();
  const h = profile.heightCm / 100;
  const lastW = [...list].reverse().find(e => e.weight)?.weight;
  const bmi = lastW && h ? lastW / (h * h) : null;
  const withMetric = list.filter(e => e[metric] != null && e[metric] !== '');

  container.innerHTML = `
  <div class="page-head"><h1>Vücut</h1></div>

  <section class="kpis">
    <div class="kpi"><span class="kpi-l">Güncel kilo</span><span class="kpi-v">${lastW ? n1(lastW) + ' kg' : '—'}</span><span class="kpi-s">${latest ? fmtShort(latest.date) : 'ölçüm yok'}</span></div>
    <div class="kpi"><span class="kpi-l">Başlangıçtan</span><span class="kpi-v">${first?.weight && lastW ? (lastW - first.weight > 0 ? '+' : '') + n1(lastW - first.weight) + ' kg' : '—'}</span><span class="kpi-s">${first ? fmtShort(first.date) + "'den beri" : ''}</span></div>
    <div class="kpi"><span class="kpi-l">VKİ</span><span class="kpi-v">${bmi ? n1(bmi) : '—'}</span><span class="kpi-s">boy ${profile.heightCm} cm</span></div>
    <div class="kpi"><span class="kpi-l">Ölçüm sayısı</span><span class="kpi-v">${list.length}</span><span class="kpi-s">&nbsp;</span></div>
  </section>

  <section class="card">
    <h3>Yeni ölçüm</h3>
    <form class="form body-form">
      <div class="grid4">
        <label class="field"><span>Tarih</span><input class="input" type="date" name="date" value="${todayStr()}" required></label>
        ${FIELDS.map(([k, l, u]) => `<label class="field"><span>${l} (${u})</span><input class="input" name="${k}" inputmode="decimal" placeholder="—"></label>`).join('')}
      </div>
      <label class="field"><span>Not</span><input class="input" name="note" placeholder="İsteğe bağlı"></label>
      <div class="row-end"><button class="btn primary" type="submit">Kaydet</button></div>
      <p class="muted small">Aynı güne ikinci kez kayıt girersen, boş bırakmadığın alanlar o günün kaydına eklenir.</p>
    </form>
  </section>

  <section class="card">
    <div class="meal-head"><h3>Grafik</h3>
      <select class="input slim metric">${FIELDS.map(([k, l]) => `<option value="${k}" ${k === metric ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${withMetric.length ? '<div class="chart-box"><canvas id="ch-body"></canvas></div>' : '<p class="muted">Bu ölçü için henüz kayıt yok.</p>'}
  </section>

  <section class="card">
    <h3>Geçmiş</h3>
    ${list.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Tarih</th>${FIELDS.map(([, l]) => `<th>${l}</th>`).join('')}<th>Not</th><th></th></tr></thead>
      <tbody>${list.slice().reverse().map(e => `<tr>
        <td>${fmtShort(e.date)} ${e.date.slice(0, 4)}</td>
        ${FIELDS.map(([k]) => `<td>${e[k] != null && e[k] !== '' ? n1(e[k]) : ''}</td>`).join('')}
        <td>${esc(e.note || '')}</td>
        <td><button class="icon-btn subtle" data-del="${e.id}" aria-label="Sil">🗑</button></td></tr>`).join('')}</tbody>
    </table></div>` : '<p class="muted">Henüz ölçüm yok.</p>'}
  </section>`;

  container.querySelector('.body-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const date = fd.get('date');
    const values = {};
    for (const [k] of FIELDS) { const v = String(fd.get(k) || '').trim(); if (v) values[k] = r1(num(v)); }
    const note = String(fd.get('note') || '').trim();
    if (!Object.keys(values).length && !note) { toast('En az bir değer gir', 'warn'); return; }
    const existing = bodyEntries().find(e => e.date === date);
    const entry = existing ? { ...existing, ...values, ...(note ? { note } : {}) } : { id: uid(), date, ...values, note };
    await saveBodyEntry(entry);
    toast(`${fmtLong(date)} ölçümü kaydedildi`);
    render(container);
  });

  container.querySelector('.metric').addEventListener('change', e => { metric = e.target.value; render(container); });

  container.querySelector('tbody')?.addEventListener('click', async e => {
    const id = e.target.closest('[data-del]')?.dataset.del;
    if (!id) return;
    if (await confirmDialog('Bu ölçüm silinsin mi? (Veri reposunun geçmişinde yine de durur.)', { okText: 'Sil', danger: true })) {
      await deleteBodyEntry(id);
      render(container);
    }
  });

  const cv = container.querySelector('#ch-body');
  if (cv) {
    const vals = withMetric.map(e => +e[metric]);
    // 7 ölçümlük hareketli ortalama
    const ma = vals.map((_, i) => { const s = vals.slice(Math.max(0, i - 6), i + 1); return r1(s.reduce((a, b) => a + b, 0) / s.length); });
    const label = FIELDS.find(f => f[0] === metric);
    chart(cv, {
      type: 'line',
      data: {
        labels: withMetric.map(e => fmtShort(e.date)),
        datasets: [
          { label: `${label[1]} (${label[2]})`, data: vals, borderColor: cssVar('--accent'), backgroundColor: cssVar('--accent'), tension: 0.25 },
          { label: 'Hareketli ortalama', data: ma, borderColor: cssVar('--muted'), borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 },
        ],
      },
    });
  }
}
