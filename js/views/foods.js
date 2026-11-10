// Besin veritabanı: hazır liste + kendi eklediğin besinler.
import { esc, norm, n0, n1, num, r1, uid, toast, modal, confirmDialog } from '../util.js';
import { allFoods, saveCustomFood, deleteCustomFood } from '../model.js';
import { CATEGORIES } from '../foods-data.js';

let query = '';
let cat = 'all';

export function render(container) {
  const foods = allFoods();
  const cats = ['Özel', ...CATEGORIES];

  container.innerHTML = `
  <div class="page-head">
    <h1>Besinler</h1>
    <button class="btn primary" data-act="new">+ Yeni besin</button>
  </div>
  <p class="muted small">Değerler 100 g (içeceklerde 100 ml) başınadır. Hazır listedeki değerler yaklaşıktır; bir besini kendi değerlerinle kullanmak için "Kopyala" de, özel besin olarak düzenle.</p>
  <div class="filters">
    <input class="input search" type="search" placeholder="Ara…" value="${esc(query)}">
    <select class="input slim cat"><option value="all">Tüm kategoriler</option>${cats.map(c => `<option ${c === cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
  </div>
  <div class="card flush"><div class="table-wrap"><table class="table foods-table">
    <thead><tr><th>Besin</th><th>kcal</th><th>P</th><th>K</th><th>Y</th><th>Porsiyonlar</th><th></th></tr></thead>
    <tbody></tbody></table></div></div>`;

  const tbody = container.querySelector('tbody');
  const draw = () => {
    const words = norm(query).split(/\s+/).filter(Boolean);
    const list = foods.filter(f => {
      if (cat === 'Özel' && !f.custom) return false;
      if (cat !== 'all' && cat !== 'Özel' && f.cat !== cat) return false;
      const n = norm(f.name);
      return words.every(w => n.includes(w));
    });
    tbody.innerHTML = list.map(f => `<tr>
      <td><strong>${esc(f.name)}</strong> ${f.custom ? '<span class="badge">özel</span>' : ''}<br><span class="muted small">${esc(f.cat || '')}</span></td>
      <td>${n0(f.kcal)}</td><td>${n1(f.p)}</td><td>${n1(f.c)}</td><td>${n1(f.f)}</td>
      <td class="small">${(f.servings || []).map(s => `${esc(s.name)} (${s.grams} ${f.unit === 'ml' ? 'ml' : 'g'})`).join('<br>')}</td>
      <td class="nowrap">${f.custom
        ? `<button class="btn small ghost" data-edit="${esc(f.id)}">Düzenle</button>`
        : `<button class="btn small ghost" data-copy="${esc(f.id)}">Kopyala</button>`}</td></tr>`).join('')
      || '<tr><td colspan="7" class="muted">Sonuç yok.</td></tr>';
  };
  draw();

  container.querySelector('.search').addEventListener('input', e => { query = e.target.value; draw(); });
  container.querySelector('.cat').addEventListener('change', e => { cat = e.target.value; draw(); });
  container.querySelector('[data-act="new"]').addEventListener('click', () => openEditor(null, () => render(container)));
  tbody.addEventListener('click', e => {
    const edit = e.target.closest('[data-edit]')?.dataset.edit;
    const copy = e.target.closest('[data-copy]')?.dataset.copy;
    if (edit) openEditor(foods.find(f => f.id === edit), () => render(container));
    if (copy) {
      const src = foods.find(f => f.id === copy);
      openEditor({ ...src, id: null, custom: true, cat: 'Özel', name: src.name + ' (benim)' }, () => render(container));
    }
  });
}

function openEditor(food, done) {
  const f = food || { name: '', kcal: '', p: '', c: '', f: '', unit: 'g', servings: [] };
  const isEdit = !!(food && food.id);
  modal(`<h2 class="modal-title">${isEdit ? 'Besini düzenle' : 'Yeni besin'}</h2>
  <form class="form">
    <label class="field"><span>Ad</span><input class="input" name="name" required value="${esc(f.name)}"></label>
    <p class="muted small">100 ${f.unit === 'ml' ? 'ml' : 'g'} başına değerler (paket etiketindeki "100 g'da" sütunu):</p>
    <div class="grid4">
      <label class="field"><span>Kalori</span><input class="input" name="kcal" inputmode="decimal" required value="${f.kcal}"></label>
      <label class="field"><span>Protein (g)</span><input class="input" name="p" inputmode="decimal" required value="${f.p}"></label>
      <label class="field"><span>Karb. (g)</span><input class="input" name="c" inputmode="decimal" required value="${f.c}"></label>
      <label class="field"><span>Yağ (g)</span><input class="input" name="f" inputmode="decimal" required value="${f.f}"></label>
    </div>
    <label class="field"><span>Birim</span><select name="unit"><option value="g" ${f.unit !== 'ml' ? 'selected' : ''}>gram</option><option value="ml" ${f.unit === 'ml' ? 'selected' : ''}>mililitre</option></select></label>
    <label class="field"><span>Porsiyonlar (her satıra bir tane: ad = gram)</span>
      <textarea class="input" name="servings" rows="3" placeholder="1 dilim = 30&#10;1 kase = 200">${esc((f.servings || []).map(s => `${s.name} = ${s.grams}`).join('\n'))}</textarea></label>
    <div class="kcal-check muted small"></div>
    <div class="row-between">
      ${isEdit ? '<button class="btn danger ghost" type="button" data-del>Sil</button>' : '<span></span>'}
      <button class="btn primary" type="submit">Kaydet</button>
    </div>
  </form>`, {
    onMount(body, close) {
      const form = body.querySelector('form');
      const check = body.querySelector('.kcal-check');
      const upd = () => {
        const calc = num(form.p.value) * 4 + num(form.c.value) * 4 + num(form.f.value) * 9;
        check.textContent = calc ? `Makrolardan hesaplanan: ~${n0(calc)} kcal` : '';
      };
      form.addEventListener('input', upd); upd();
      body.querySelector('[data-del]')?.addEventListener('click', async () => {
        if (await confirmDialog(`"${f.name}" silinsin mi? Geçmiş kayıtlardaki değerler değişmez.`, { okText: 'Sil', danger: true })) {
          await deleteCustomFood(f.id); toast('Silindi'); close(); done();
        }
      });
      form.addEventListener('submit', async ev => {
        ev.preventDefault();
        const servings = form.servings.value.split('\n').map(l => {
          const m = l.match(/^(.+?)\s*[=:]\s*([\d.,]+)\s*$/);
          return m ? { name: m[1].trim(), grams: num(m[2]) } : null;
        }).filter(s => s && s.grams > 0);
        await saveCustomFood({
          id: isEdit ? f.id : 'c:' + uid(),
          name: form.name.value.trim(), cat: 'Özel', unit: form.unit.value,
          kcal: r1(num(form.kcal.value)), p: r1(num(form.p.value)), c: r1(num(form.c.value)), f: r1(num(form.f.value)),
          servings,
        });
        toast('Besin kaydedildi');
        close(); done();
      });
    },
  });
}
