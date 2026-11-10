// Günlük görünüm: öğün öğün kayıt, plan, makrolar, su, not.
import { MEALS, mealName, esc, n0, n1, todayStr, addDays, fmtLong, relativeDay, isValidDate, toast, modal, confirmDialog, num, uid } from '../util.js';
import { editDay, getDay, saveDay, activeEntries, dayTotals, sumEntries, currentTargets } from '../model.js';
import { openFoodPicker, amountLabel } from './foodpicker.js';

function ring(value, target, size = 150) {
  const r = size / 2 - 10, c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const over = target > 0 && value > target * 1.05;
  return `<svg class="ring ${over ? 'over' : ''}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

function macroBar(label, cls, eaten, planned, target) {
  const max = Math.max(target, eaten + planned, 1);
  const pe = (eaten / max) * 100, pp = (planned / max) * 100, pt = (target / max) * 100;
  return `<div class="mbar ${cls}">
    <div class="mbar-head"><span>${label}</span><span><strong>${n0(eaten)}</strong>${planned ? ` <span class="muted">+${n0(planned)}</span>` : ''} / ${n0(target)} g</span></div>
    <div class="mbar-track"><div class="mbar-eaten" style="width:${pe}%"></div><div class="mbar-plan" style="left:${pe}%;width:${pp}%"></div>
    <div class="mbar-target" style="left:${pt}%"></div></div>
  </div>`;
}

export function render(container, params) {
  const date = isValidDate(params.date || '') ? params.date : todayStr();
  const day = getDay(date);
  const targets = day?.targets || currentTargets();
  const entries = activeEntries(day);
  const t = dayTotals(day);
  const rel = relativeDay(date);
  const water = day?.water?.ml || 0;
  const remaining = targets.kcal - t.eaten.kcal;
  const isFuture = date > todayStr();

  container.innerHTML = `
  <section class="day-head">
    <a class="icon-btn" href="#/gun/${addDays(date, -1)}" aria-label="Önceki gün">‹</a>
    <label class="day-title">
      <span class="day-rel">${rel || ''}</span>
      <span class="day-date">${fmtLong(date)}</span>
      <input type="date" class="date-input" value="${date}" aria-label="Tarih seç">
    </label>
    <a class="icon-btn" href="#/gun/${addDays(date, 1)}" aria-label="Sonraki gün">›</a>
  </section>
  ${date !== todayStr() ? `<div class="center"><a class="link-btn" href="#/gun/${todayStr()}">Bugüne dön</a></div>` : ''}

  <section class="card summary">
    <div class="ring-wrap">
      ${ring(t.eaten.kcal, targets.kcal)}
      <div class="ring-text">
        <strong>${n0(t.eaten.kcal)}</strong>
        <span>/ ${n0(targets.kcal)} kcal</span>
      </div>
    </div>
    <div class="summary-side">
      <div class="stat-row">
        <div class="stat"><span class="stat-l">Yenen</span><span class="stat-v">${n0(t.eaten.kcal)}</span></div>
        <div class="stat"><span class="stat-l">Planlanan</span><span class="stat-v plan">${n0(t.planned.kcal)}</span></div>
        <div class="stat"><span class="stat-l">${remaining >= 0 ? 'Kalan' : 'Aşım'}</span><span class="stat-v ${remaining < 0 ? 'neg' : ''}">${n0(Math.abs(remaining))}</span></div>
      </div>
      ${t.planned.kcal ? `<p class="muted small">Plan tamamlanırsa: <strong>${n0(t.all.kcal)}</strong> kcal (${targets.kcal ? n0((t.all.kcal / targets.kcal) * 100) : 0}% hedef)</p>` : ''}
      ${macroBar('Protein', 'mp', t.eaten.p, t.planned.p, targets.p)}
      ${macroBar('Karbonhidrat', 'mc', t.eaten.c, t.planned.c, targets.c)}
      ${macroBar('Yağ', 'mf', t.eaten.f, t.planned.f, targets.f)}
    </div>
  </section>

  <section class="meals">
    ${MEALS.map(m => {
      const list = entries.filter(e => e.meal === m.id);
      const s = sumEntries(list.filter(e => e.status === 'eaten'));
      const sp = sumEntries(list.filter(e => e.status === 'planned'));
      const hasPlanned = list.some(e => e.status === 'planned');
      return `<div class="card meal" data-meal="${m.id}">
        <div class="meal-head">
          <div><h3>${m.icon} ${m.name}</h3>
            <span class="muted small">${n0(s.kcal)} kcal${sp.kcal ? ` · plan +${n0(sp.kcal)}` : ''} · P ${n0(s.p + sp.p)} K ${n0(s.c + sp.c)} Y ${n0(s.f + sp.f)}</span></div>
          <div class="meal-actions">
            <button class="icon-btn subtle" data-act="menu" aria-label="${m.name} seçenekleri">⋯</button>
            <button class="btn small primary" data-act="add">+ Ekle</button>
          </div>
        </div>
        ${list.length ? `<ul class="entries">${list.map(e => `
          <li class="entry ${e.status}" data-id="${e.id}">
            <button class="check" data-act="toggle" aria-label="${e.status === 'eaten' ? 'Planlandı olarak işaretle' : 'Yendi olarak işaretle'}">${e.status === 'eaten' ? '✓' : ''}</button>
            <button class="entry-main" data-act="edit">
              <span class="e-name">${esc(e.name)}</span>
              <span class="e-meta">${esc(amountLabel(e))} · P ${n1(e.p)} K ${n1(e.c)} Y ${n1(e.f)}</span>
            </button>
            <span class="e-kcal">${n0(e.kcal)}</span>
          </li>`).join('')}</ul>` : `<p class="empty">${isFuture ? 'Bu öğün için plan yok.' : 'Henüz bir şey eklenmedi.'}</p>`}
        ${hasPlanned ? '<button class="link-btn small" data-act="eat-all">Plandakilerin hepsini yendi işaretle</button>' : ''}
      </div>`;
    }).join('')}
  </section>

  <section class="card water">
    <div class="meal-head"><div><h3>💧 Su</h3><span class="muted small">${n0(water)} / ${n0(targets.water)} ml</span></div></div>
    <div class="water-track"><div class="water-fill" style="width:${Math.min(100, targets.water ? (water / targets.water) * 100 : 0)}%"></div></div>
    <div class="water-btns">
      <button class="btn small ghost" data-w="-250">−250</button>
      <button class="btn small" data-w="200">+200 ml</button>
      <button class="btn small" data-w="330">+330 ml</button>
      <button class="btn small" data-w="500">+500 ml</button>
      <button class="btn small ghost" data-w="custom">Diğer…</button>
    </div>
  </section>

  <section class="card">
    <h3>📝 Gün notu</h3>
    <textarea class="input note" rows="2" placeholder="Nasıl hissettin, antrenman, özel durum…">${esc(day?.note?.text || '')}</textarea>
  </section>

  <section class="day-tools">
    <button class="btn ghost" data-act="copy-day">Başka günden kopyala</button>
    ${day ? `<button class="btn ghost" data-act="retarget">Hedefleri güncel değerle yenile</button>` : ''}
  </section>
  <p class="muted small center">Bu günün hedefi: ${n0(targets.kcal)} kcal · P ${n0(targets.p)} · K ${n0(targets.c)} · Y ${n0(targets.f)} g</p>
  `;

  // ---- olaylar ----
  container.querySelector('.date-input').addEventListener('change', e => {
    if (e.target.value) location.hash = `#/gun/${e.target.value}`;
  });

  const save = async (mutator, msg) => {
    const d = editDay(date);
    mutator(d);
    await saveDay(d);
    if (msg) toast(msg);
    render(container, params);
  };

  container.querySelector('.meals').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const mealEl = btn.closest('.meal');
    const meal = mealEl?.dataset.meal;
    const id = btn.closest('.entry')?.dataset.id;
    const act = btn.dataset.act;

    if (act === 'add') {
      openFoodPicker({ date, meal, onSave: entry => save(d => d.entries.push(entry), `${entry.name} eklendi`) });
    } else if (act === 'edit') {
      const entry = entries.find(x => x.id === id);
      openFoodPicker({
        date, meal, entry,
        onSave: upd => save(d => { const i = d.entries.findIndex(x => x.id === id); if (i >= 0) d.entries[i] = upd; }, 'Güncellendi'),
        onDelete: () => save(d => { const x = d.entries.find(y => y.id === id); if (x) { x.deleted = true; x.updatedAt = Date.now(); } }, 'Silindi'),
      });
    } else if (act === 'toggle') {
      save(d => { const x = d.entries.find(y => y.id === id); if (x) { x.status = x.status === 'eaten' ? 'planned' : 'eaten'; x.updatedAt = Date.now(); } });
    } else if (act === 'eat-all') {
      save(d => d.entries.forEach(x => { if (!x.deleted && x.meal === meal && x.status === 'planned') { x.status = 'eaten'; x.updatedAt = Date.now(); } }), 'Plan yendi olarak işaretlendi');
    } else if (act === 'menu') {
      openCopyDialog(date, meal, (items) => save(d => d.entries.push(...items), `${items.length} kayıt kopyalandı`));
    }
  });

  container.querySelector('.water-btns').addEventListener('click', e => {
    const w = e.target.closest('[data-w]')?.dataset.w;
    if (!w) return;
    let delta = +w;
    if (w === 'custom') {
      const v = prompt('Kaç ml? (eksiltmek için negatif yaz)', '250');
      if (v == null) return;
      delta = num(v);
      if (!delta) return;
    }
    save(d => { d.water = { ml: Math.max(0, (d.water?.ml || 0) + delta), updatedAt: Date.now() }; });
  });

  const note = container.querySelector('.note');
  note.addEventListener('change', () => {
    const text = note.value;
    const d = editDay(date);
    d.note = { text, updatedAt: Date.now() };
    saveDay(d).then(() => toast('Not kaydedildi'));
  });

  container.querySelector('.day-tools').addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'copy-day') openCopyDialog(date, null, items => save(d => d.entries.push(...items), `${items.length} kayıt kopyalandı`));
    if (act === 'retarget') {
      if (await confirmDialog('Bu günün hedefleri, profildeki güncel hedeflerle değiştirilsin mi?')) {
        save(d => { d.targets = currentTargets(); }, 'Hedefler güncellendi');
      }
    }
  });
}

// Başka bir günden öğün ya da tüm günü kopyalama
function openCopyDialog(date, meal, onCopy) {
  const defaultSrc = addDays(date, -1);
  modal(`<h2 class="modal-title">${meal ? `${mealName(meal)} öğününe kopyala` : 'Başka günden kopyala'}</h2>
    <form class="form">
      <label class="field"><span>Kaynak gün</span><input class="input" type="date" name="src" value="${defaultSrc}" required></label>
      <label class="field"><span>Kaynak öğün</span><select name="srcMeal">
        ${meal ? '' : '<option value="all">Tüm gün (öğünleri korunarak)</option>'}
        ${MEALS.map(m => `<option value="${m.id}" ${m.id === meal ? 'selected' : ''}>${m.name}</option>`).join('')}
      </select></label>
      <label class="field"><span>Eklenecek durum</span><select name="status">
        <option value="planned">◷ Planlandı</option><option value="eaten">✓ Yendi</option></select></label>
      <div class="copy-preview muted small"></div>
      <div class="row-end"><button class="btn primary" type="submit">Kopyala</button></div>
    </form>`, {
    onMount(body, close) {
      const form = body.querySelector('form');
      const prev = body.querySelector('.copy-preview');
      const pick = () => {
        const src = getDay(form.src.value);
        const sm = form.srcMeal.value;
        return activeEntries(src).filter(e => sm === 'all' || e.meal === sm);
      };
      const upd = () => {
        const items = pick();
        prev.innerHTML = items.length ? `${items.length} kayıt · ${n0(sumEntries(items).kcal)} kcal: ${items.slice(0, 6).map(e => esc(e.name)).join(', ')}${items.length > 6 ? '…' : ''}` : 'Seçilen yerde kayıt yok.';
      };
      form.addEventListener('input', upd);
      upd();
      form.addEventListener('submit', ev => {
        ev.preventDefault();
        const items = pick();
        if (!items.length) return;
        const now = Date.now();
        const status = form.status.value;
        onCopy(items.map((e, i) => ({ ...e, id: uid(), meal: meal || e.meal, status, createdAt: now + i, updatedAt: now })));
        close();
      });
    },
  });
}
