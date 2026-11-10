// Besin ekleme / düzenleme penceresi.
import { modal, esc, norm, n0, n1, num, r1, MEALS, todayStr } from '../util.js';
import { allFoods, findFood, macrosFor, recentFoods, makeEntry } from '../model.js';

export function amountLabel(e) {
  if (!e.per100) return 'Hızlı ekleme';
  const u = e.unit === 'ml' ? 'ml' : 'g';
  if (e.servingLabel) return `${n1(e.qty)} × ${e.servingLabel} · ${n0(e.grams)} ${u}`;
  return `${n0(e.grams)} ${u}`;
}

function macroLine(m) {
  return `<span class="mp">P ${n1(m.p)}</span><span class="mc">K ${n1(m.c)}</span><span class="mf">Y ${n1(m.f)}</span>`;
}

// options: { date, meal, entry (düzenleme için), onSave(entry), onDelete(entry) }
export function openFoodPicker(options) {
  const { entry } = options;
  const defaultStatus = options.date > todayStr() ? 'planned' : 'eaten';

  modal('<div class="picker"></div>', {
    wide: true,
    onMount(body, close) {
      const root = body.querySelector('.picker');

      const finish = e => { options.onSave(e); close(); };

      if (entry) {
        if (entry.per100) showDetail(root, { food: findFood(entry.foodId) || foodFromEntry(entry), entry, options, defaultStatus, finish, close });
        else showQuick(root, { entry, options, defaultStatus, finish, close });
        return;
      }
      showSearch(root, { options, defaultStatus, finish, close });
    },
  });
}

function foodFromEntry(e) {
  return { id: e.foodId, name: e.name, unit: e.unit || 'g', ...e.per100, servings: e.servingLabel ? [{ name: e.servingLabel, grams: e.servingGrams }] : [] };
}

function metaFields(meal, status) {
  return `<div class="grid2">
    <label class="field"><span>Öğün</span><select name="meal">${MEALS.map(m => `<option value="${m.id}" ${m.id === meal ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label>
    <label class="field"><span>Durum</span><select name="status">
      <option value="eaten" ${status === 'eaten' ? 'selected' : ''}>✓ Yendi</option>
      <option value="planned" ${status === 'planned' ? 'selected' : ''}>◷ Planlandı</option></select></label>
  </div>`;
}

function showSearch(root, ctx) {
  const { options } = ctx;
  let tab = 'search';
  root.innerHTML = `
    <h2 class="modal-title">Besin ekle</h2>
    <div class="tabs" role="tablist">
      <button class="tab active" data-tab="search">Ara</button>
      <button class="tab" data-tab="recent">Son eklenenler</button>
      <button class="tab" data-tab="quick">Hızlı ekle</button>
    </div>
    <div class="tab-body"></div>`;
  let tabBody = root.querySelector('.tab-body');

  const render = () => {
    root.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (tab === 'search') {
      tabBody.innerHTML = `<input class="input search" type="search" placeholder="Besin ara… (ör. tavuk, pirinç)" autocomplete="off">
        <p class="muted small hint">Değerler çiğ ağırlığa göre: pişirmeden önce tart.</p>
        <div class="food-results"></div>`;
      const input = tabBody.querySelector('input');
      const results = tabBody.querySelector('.food-results');
      const list = allFoods();
      const update = () => {
        const q = norm(input.value);
        const words = q.split(/\s+/).filter(Boolean);
        const found = list.filter(f => { const n = norm(f.name + ' ' + (f.cat || '')); return words.every(w => n.includes(w)); }).slice(0, 60);
        results.innerHTML = found.length ? found.map(f => `
          <button class="food-row" data-id="${esc(f.id)}">
            <span class="fr-name">${esc(f.name)} ${f.custom ? '<span class="badge">özel</span>' : ''}</span>
            <span class="fr-meta">${n0(f.kcal)} kcal / 100 ${f.unit === 'ml' ? 'ml' : 'g'} · ${macroLine(f)}</span>
          </button>`).join('') : '<p class="muted pad">Bulunamadı. "Hızlı ekle" sekmesinden değerleri elle girebilir ya da Besinler sayfasından kalıcı olarak ekleyebilirsin.</p>';
      };
      input.addEventListener('input', update);
      results.addEventListener('click', e => {
        const id = e.target.closest('.food-row')?.dataset.id;
        if (id) showDetail(root, { ...ctx, food: list.find(f => f.id === id) });
      });
      update();
      setTimeout(() => input.focus(), 50);
    } else if (tab === 'recent') {
      const rec = recentFoods();
      tabBody.innerHTML = rec.length ? `<div class="food-results">${rec.map((e, i) => `
        <button class="food-row" data-i="${i}">
          <span class="fr-name">${esc(e.name)}</span>
          <span class="fr-meta">${esc(amountLabel(e))} · ${n0(e.kcal)} kcal</span>
        </button>`).join('')}</div>` : '<p class="muted pad">Henüz kayıt yok.</p>';
      tabBody.addEventListener('click', e => {
        const i = e.target.closest('.food-row')?.dataset.i;
        if (i == null) return;
        const src = rec[+i];
        if (src.per100) {
          const food = findFood(src.foodId) || foodFromEntry(src);
          showDetail(root, { ...ctx, food, preset: src });
        } else {
          ctx.finish(makeEntry({ meal: options.meal, status: ctx.defaultStatus, name: src.name, kcal: src.kcal, p: src.p, c: src.c, f: src.f }));
        }
      }, { once: false });
    } else {
      showQuickInto(tabBody, ctx);
    }
  };

  root.querySelector('.tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab')?.dataset.tab;
    if (!t || t === tab) return;
    tab = t;
    // Eski sekmenin dinleyicilerini atmak için gövdeyi yenisiyle değiştir.
    const fresh = tabBody.cloneNode(false);
    tabBody.replaceWith(fresh);
    tabBody = fresh;
    render();
  });
  render();
}

function showQuickInto(el, ctx) {
  const { options } = ctx;
  el.innerHTML = `<form class="form quick-form">
    <label class="field"><span>Ad</span><input class="input" name="name" required placeholder="ör. Annemin keki"></label>
    <div class="grid4">
      <label class="field"><span>Kalori</span><input class="input" name="kcal" inputmode="decimal" required></label>
      <label class="field"><span>Protein (g)</span><input class="input" name="p" inputmode="decimal" value="0"></label>
      <label class="field"><span>Karb. (g)</span><input class="input" name="c" inputmode="decimal" value="0"></label>
      <label class="field"><span>Yağ (g)</span><input class="input" name="f" inputmode="decimal" value="0"></label>
    </div>
    ${metaFields(options.meal, ctx.defaultStatus)}
    <div class="row-end"><button class="btn primary" type="submit">Ekle</button></div>
  </form>`;
  el.querySelector('form').addEventListener('submit', ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    ctx.finish(makeEntry({
      meal: fd.get('meal'), status: fd.get('status'), name: fd.get('name').trim(),
      kcal: r1(num(fd.get('kcal'))), p: r1(num(fd.get('p'))), c: r1(num(fd.get('c'))), f: r1(num(fd.get('f'))),
    }));
  });
}

function showQuick(root, ctx) {
  const { entry, options } = ctx;
  root.innerHTML = `<h2 class="modal-title">Kaydı düzenle</h2>
  <form class="form">
    <label class="field"><span>Ad</span><input class="input" name="name" required value="${esc(entry.name)}"></label>
    <div class="grid4">
      <label class="field"><span>Kalori</span><input class="input" name="kcal" inputmode="decimal" value="${entry.kcal}"></label>
      <label class="field"><span>Protein (g)</span><input class="input" name="p" inputmode="decimal" value="${entry.p}"></label>
      <label class="field"><span>Karb. (g)</span><input class="input" name="c" inputmode="decimal" value="${entry.c}"></label>
      <label class="field"><span>Yağ (g)</span><input class="input" name="f" inputmode="decimal" value="${entry.f}"></label>
    </div>
    ${metaFields(entry.meal, entry.status)}
    <div class="row-between"><button class="btn danger ghost" type="button" data-del>Sil</button><button class="btn primary" type="submit">Kaydet</button></div>
  </form>`;
  root.querySelector('[data-del]').addEventListener('click', () => { options.onDelete(entry); ctx.close(); });
  root.querySelector('form').addEventListener('submit', ev => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    ctx.finish({ ...entry, updatedAt: Date.now(), meal: fd.get('meal'), status: fd.get('status'), name: fd.get('name').trim(),
      kcal: r1(num(fd.get('kcal'))), p: r1(num(fd.get('p'))), c: r1(num(fd.get('c'))), f: r1(num(fd.get('f'))) });
  });
}

function showDetail(root, ctx) {
  const { food, entry, options, preset } = ctx;
  const src = entry || preset;
  const u = food.unit === 'ml' ? 'ml' : 'g';
  const units = [{ name: u, grams: 1 }, ...(food.servings || [])];
  let unitIdx = 0, qty = 100;
  if (src) {
    const i = units.findIndex(x => src.servingLabel && x.name === src.servingLabel);
    if (i > 0) { unitIdx = i; qty = src.qty; } else { unitIdx = 0; qty = src.grams; }
  } else if (units.length > 1) { unitIdx = 1; qty = 1; }

  root.innerHTML = `
    ${entry ? '' : '<button class="link-btn back">← Listeye dön</button>'}
    <h2 class="modal-title">${esc(food.name)}</h2>
    <p class="muted small">100 ${u}: ${n0(food.kcal)} kcal · P ${n1(food.p)} g · K ${n1(food.c)} g · Y ${n1(food.f)} g</p>
    <form class="form">
      <div class="grid2">
        <label class="field"><span>Miktar</span><input class="input" name="qty" inputmode="decimal" value="${qty}"></label>
        <label class="field"><span>Birim</span><select name="unit">${units.map((x, i) => `<option value="${i}" ${i === unitIdx ? 'selected' : ''}>${esc(x.name)}${i ? ` (${x.grams} ${u})` : ''}</option>`).join('')}</select></label>
      </div>
      <div class="preview"></div>
      ${metaFields(entry?.meal || options.meal, entry?.status || ctx.defaultStatus)}
      <div class="row-between">
        ${entry ? '<button class="btn danger ghost" type="button" data-del>Sil</button>' : '<span></span>'}
        <button class="btn primary" type="submit">${entry ? 'Kaydet' : 'Ekle'}</button>
      </div>
    </form>`;

  const form = root.querySelector('form');
  const preview = root.querySelector('.preview');
  const per100 = { kcal: food.kcal, p: food.p, c: food.c, f: food.f };
  const calc = () => {
    const i = +form.unit.value;
    const q = num(form.qty.value);
    const grams = r1(q * units[i].grams);
    return { i, q, grams, m: macrosFor(per100, grams) };
  };
  const update = () => {
    const { grams, m } = calc();
    preview.innerHTML = `<div class="preview-box">
      <div class="pv-kcal"><strong>${n0(m.kcal)}</strong> kcal</div>
      <div class="pv-g">${n0(grams)} ${u}</div>
      <div class="pv-macros">${macroLine(m)}</div></div>`;
  };
  form.addEventListener('input', update);
  form.unit.addEventListener('change', () => { form.qty.value = +form.unit.value === 0 ? 100 : 1; update(); });
  update();
  setTimeout(() => form.qty.select(), 50);

  root.querySelector('.back')?.addEventListener('click', () => showSearch(root, ctx));
  root.querySelector('[data-del]')?.addEventListener('click', () => { options.onDelete(entry); ctx.close(); });
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const { i, q, grams, m } = calc();
    if (grams <= 0) { form.qty.focus(); return; }
    const fields = {
      meal: form.meal.value, status: form.status.value,
      foodId: food.id, name: food.name, unit: food.unit || 'g', per100,
      qty: q, grams, servingLabel: i ? units[i].name : null, servingGrams: i ? units[i].grams : null,
      ...m,
    };
    ctx.finish(entry ? { ...entry, ...fields, updatedAt: Date.now() } : makeEntry(fields));
  });
}
