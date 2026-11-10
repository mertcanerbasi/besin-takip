// Raporlar: dönem ortalamaları, hedef uyumu, kalori/makro/kilo grafikleri.
import { n0, n1, todayStr, addDays, fmtShort, fmtShortWd } from '../util.js';
import { getDay, dayTotals, bodyEntries, currentTargets } from '../model.js';
import { chart, cssVar, clearCharts } from '../charts.js';

let range = 7;

export function render(container) {
  clearCharts();
  const today = todayStr();
  const dates = Array.from({ length: range }, (_, i) => addDays(today, i - range + 1));
  const rows = dates.map(date => {
    const day = getDay(date);
    const t = dayTotals(day);
    return { date, day, t, targets: day?.targets || currentTargets(), logged: t.eatenCount > 0, water: day?.water?.ml || 0 };
  });
  const logged = rows.filter(r => r.logged);
  const avg = k => logged.length ? logged.reduce((s, r) => s + r.t.eaten[k], 0) / logged.length : 0;
  const avgT = k => logged.length ? logged.reduce((s, r) => s + r.targets[k], 0) / logged.length : 0;
  const inRange = logged.filter(r => Math.abs(r.t.eaten.kcal - r.targets.kcal) <= r.targets.kcal * 0.1).length;
  const proteinHit = logged.filter(r => r.t.eaten.p >= r.targets.p * 0.9).length;
  const avgWater = logged.length ? logged.reduce((s, r) => s + r.water, 0) / logged.length : 0;
  const balance = logged.reduce((s, r) => s + (r.t.eaten.kcal - r.targets.kcal), 0);
  const kcal = avg('kcal'), p = avg('p'), c = avg('c'), f = avg('f');
  const macroK = p * 4 + c * 4 + f * 9 || 1;

  const body = bodyEntries().filter(e => e.weight && e.date >= dates[0] && e.date <= today);
  const wDelta = body.length >= 2 ? body[body.length - 1].weight - body[0].weight : null;

  container.innerHTML = `
  <div class="page-head">
    <h1>Raporlar</h1>
    <div class="seg" role="tablist">
      ${[7, 14, 30, 90, 365].map(n => `<button class="${n === range ? 'active' : ''}" data-r="${n}">${n === 365 ? '1 yıl' : n + ' gün'}</button>`).join('')}
    </div>
  </div>

  <section class="kpis">
    <div class="kpi"><span class="kpi-l">Ort. kalori</span><span class="kpi-v">${n0(kcal)}</span><span class="kpi-s">hedef ort. ${n0(avgT('kcal'))}</span></div>
    <div class="kpi"><span class="kpi-l">Kayıtlı gün</span><span class="kpi-v">${logged.length}<small>/${range}</small></span><span class="kpi-s">en az bir "yendi" kaydı olan</span></div>
    <div class="kpi"><span class="kpi-l">Hedef uyumu</span><span class="kpi-v">${logged.length ? n0((inRange / logged.length) * 100) : 0}%</span><span class="kpi-s">±%10 içinde ${inRange} gün</span></div>
    <div class="kpi"><span class="kpi-l">Protein hedefi</span><span class="kpi-v">${logged.length ? n0((proteinHit / logged.length) * 100) : 0}%</span><span class="kpi-s">${proteinHit} gün ≥ %90</span></div>
    <div class="kpi"><span class="kpi-l">Toplam denge</span><span class="kpi-v ${balance > 0 ? 'neg' : ''}">${balance > 0 ? '+' : ''}${n0(balance)}</span><span class="kpi-s">kcal (hedefe göre) ≈ ${n1(balance / 7700)} kg</span></div>
    <div class="kpi"><span class="kpi-l">Kilo değişimi</span><span class="kpi-v">${wDelta == null ? '—' : (wDelta > 0 ? '+' : '') + n1(wDelta) + ' kg'}</span><span class="kpi-s">${body.length} ölçüm</span></div>
    <div class="kpi"><span class="kpi-l">Ort. su</span><span class="kpi-v">${n1(avgWater / 1000)} L</span><span class="kpi-s">hedef ${n1(avgT('water') / 1000)} L</span></div>
    <div class="kpi"><span class="kpi-l">Makro dağılımı</span><span class="kpi-v kpi-macro"><span class="mp">${n0(p * 4 / macroK * 100)}%</span> <span class="mc">${n0(c * 4 / macroK * 100)}%</span> <span class="mf">${n0(f * 9 / macroK * 100)}%</span></span><span class="kpi-s">P ${n0(p)} · K ${n0(c)} · Y ${n0(f)} g ort.</span></div>
  </section>

  <section class="card"><h3>Günlük kalori ve hedef</h3><div class="chart-box"><canvas id="ch-kcal"></canvas></div></section>
  <div class="grid-2col">
    <section class="card"><h3>Makrolar (g)</h3><div class="chart-box"><canvas id="ch-macro"></canvas></div></section>
    <section class="card"><h3>Kilo</h3>${body.length ? '<div class="chart-box"><canvas id="ch-weight"></canvas></div>' : '<p class="muted">Bu dönemde kilo ölçümü yok. <a href="#/vucut">Vücut</a> sayfasından ekleyebilirsin.</p>'}</section>
  </div>

  <section class="card">
    <h3>Gün gün</h3>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Gün</th><th>Kalori</th><th>Hedef</th><th>Fark</th><th>P</th><th>K</th><th>Y</th><th>Su</th></tr></thead>
      <tbody>${rows.slice().reverse().map(r => {
        const diff = r.t.eaten.kcal - r.targets.kcal;
        return `<tr class="${r.logged ? '' : 'dim'}" data-d="${r.date}">
          <td><a href="#/gun/${r.date}">${fmtShortWd(r.date)}</a></td>
          <td>${r.logged ? n0(r.t.eaten.kcal) : '—'}</td><td>${n0(r.targets.kcal)}</td>
          <td class="${r.logged ? (Math.abs(diff) <= r.targets.kcal * 0.1 ? 'ok' : diff > 0 ? 'neg' : 'warn') : ''}">${r.logged ? (diff > 0 ? '+' : '') + n0(diff) : ''}</td>
          <td>${r.logged ? n0(r.t.eaten.p) : ''}</td><td>${r.logged ? n0(r.t.eaten.c) : ''}</td><td>${r.logged ? n0(r.t.eaten.f) : ''}</td>
          <td>${r.water ? n1(r.water / 1000) + ' L' : ''}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
  </section>`;

  container.querySelector('.seg').addEventListener('click', e => {
    const r = e.target.closest('[data-r]')?.dataset.r;
    if (r) { range = +r; render(container); }
  });

  const labels = rows.map(r => range > 31 ? fmtShort(r.date) : fmtShortWd(r.date));
  const accent = cssVar('--accent'), cp = cssVar('--c-p'), cc = cssVar('--c-c'), cf = cssVar('--c-f');

  chart(container.querySelector('#ch-kcal'), {
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Yenen', data: rows.map(r => r.logged ? Math.round(r.t.eaten.kcal) : null), backgroundColor: accent, borderRadius: 4, order: 2 },
        { type: 'line', label: 'Hedef', data: rows.map(r => r.targets.kcal), borderColor: cssVar('--muted'), borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5, order: 1, stepped: 'middle' },
      ],
    },
    options: { scales: { y: { beginAtZero: true } } },
  });

  chart(container.querySelector('#ch-macro'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Protein', data: rows.map(r => r.logged ? Math.round(r.t.eaten.p) : null), borderColor: cp, backgroundColor: cp, tension: 0.3, spanGaps: true },
        { label: 'Karbonhidrat', data: rows.map(r => r.logged ? Math.round(r.t.eaten.c) : null), borderColor: cc, backgroundColor: cc, tension: 0.3, spanGaps: true },
        { label: 'Yağ', data: rows.map(r => r.logged ? Math.round(r.t.eaten.f) : null), borderColor: cf, backgroundColor: cf, tension: 0.3, spanGaps: true },
      ],
    },
    options: { scales: { y: { beginAtZero: true } } },
  });

  const wc = container.querySelector('#ch-weight');
  if (wc) {
    chart(wc, {
      type: 'line',
      data: {
        labels: body.map(e => fmtShort(e.date)),
        datasets: [{ label: 'Kilo (kg)', data: body.map(e => e.weight), borderColor: accent, backgroundColor: accent, tension: 0.3 }],
      },
      options: { plugins: { legend: { display: false } } },
    });
  }
}
