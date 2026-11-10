// Ayarlar: veri bağlantısı (GitHub), profil, hedef hesaplayıcı, yedekleme.
import * as store from '../store.js';
import { esc, n0, num, r1, toast, download, confirmDialog, todayStr } from '../util.js';
import { getProfile, saveProfile, suggest, ACTIVITY, latestWeight, applyTargetsFromToday } from '../model.js';

export function render(container) {
  const cfg = store.getConfig();
  const p = getProfile();
  const lw = latestWeight();
  if (lw) p.weightKg = lw;
  const s = suggest(p);
  const st = store.status;

  container.innerHTML = `<div class="page-root">
  <div class="page-head"><h1>Ayarlar</h1></div>

  <section class="card" id="sync">
    <h3>🔒 Veri saklama (GitHub)</h3>
    ${cfg ? `
      <p>Bağlı repo: <strong>${esc(cfg.owner)}/${esc(cfg.repo)}</strong></p>
      <p class="muted small">Durum: ${stateText(st)}${st.lastSync ? ` · son senkron ${new Date(st.lastSync).toLocaleTimeString('tr-TR')}` : ''}${st.pending ? ` · ${st.pending} dosya bekliyor` : ''}</p>
      ${st.error ? `<p class="alert">${esc(st.error)}</p>` : ''}
      <div class="row">
        <button class="btn" data-act="sync">Şimdi senkronize et</button>
        <a class="btn ghost" href="https://github.com/${esc(cfg.owner)}/${esc(cfg.repo)}/commits" target="_blank" rel="noopener">Değişiklik geçmişi ↗</a>
        <button class="btn ghost danger" data-act="disconnect">Bağlantıyı kaldır</button>
      </div>` : `
      <p class="alert">Şu an veriler <strong>yalnızca bu tarayıcıda</strong>. Kalıcı ve kaybolmaz olması için özel bir GitHub reposuna bağla.</p>
      <ol class="steps">
        <li>GitHub'da <a href="https://github.com/new" target="_blank" rel="noopener">yeni repo</a> aç: adı <code>besin-takip-data</code>, görünürlüğü <strong>Private</strong>.</li>
        <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Fine-grained token oluştur</a>:
          <ul><li><em>Repository access</em> → <em>Only select repositories</em> → <code>besin-takip-data</code></li>
          <li><em>Permissions</em> → <em>Contents</em> → <strong>Read and write</strong></li>
          <li><em>Expiration</em>: uzun bir süre seç (süre dolunca site uyarır, yenisini girersin).</li></ul></li>
        <li>Aşağıya kullanıcı adını, repo adını ve token'ı gir.</li>
      </ol>
      <form class="form gh-form">
        <div class="grid2">
          <label class="field"><span>GitHub kullanıcı adı</span><input class="input" name="owner" required value="mertcanerbasi" autocomplete="off"></label>
          <label class="field"><span>Veri reposu</span><input class="input" name="repo" required value="besin-takip-data" autocomplete="off"></label>
        </div>
        <label class="field"><span>Token</span><input class="input" name="token" type="password" required placeholder="github_pat_…" autocomplete="off"></label>
        <p class="muted small">Token yalnızca bu cihazın tarayıcısında saklanır; site koduna ya da repoya yazılmaz. Her cihazda bir kez girmen gerekir.</p>
        <div class="row-end"><button class="btn primary" type="submit">Bağlan ve test et</button></div>
      </form>`}
  </section>

  <section class="card">
    <h3>👤 Profil ve hedef hesaplayıcı</h3>
    <form class="form profile-form">
      <div class="grid4">
        <label class="field"><span>Cinsiyet</span><select name="sex"><option value="male" ${p.sex === 'male' ? 'selected' : ''}>Erkek</option><option value="female" ${p.sex === 'female' ? 'selected' : ''}>Kadın</option></select></label>
        <label class="field"><span>Doğum yılı</span><input class="input" name="birthYear" inputmode="numeric" value="${p.birthYear}"></label>
        <label class="field"><span>Boy (cm)</span><input class="input" name="heightCm" inputmode="decimal" value="${p.heightCm}"></label>
        <label class="field"><span>Kilo (kg)${lw ? ' · son ölçüm' : ''}</span><input class="input" name="weightKg" inputmode="decimal" value="${p.weightKg}"></label>
      </div>
      <label class="field"><span>Aktivite</span><select name="activity">${ACTIVITY.map(a => `<option value="${a.id}" ${a.id === +p.activity ? 'selected' : ''}>${a.name} — ${a.desc}</option>`).join('')}</select></label>
      <div class="grid4">
        <label class="field"><span>Hedef</span><select name="goal">
          <option value="cut" ${p.goal === 'cut' ? 'selected' : ''}>Kilo ver</option>
          <option value="maintain" ${p.goal === 'maintain' ? 'selected' : ''}>Koru</option>
          <option value="bulk" ${p.goal === 'bulk' ? 'selected' : ''}>Kilo al</option></select></label>
        <label class="field"><span>Haftalık hız (kg)</span><select name="rateKg">${[0.25, 0.5, 0.75, 1].map(v => `<option value="${v}" ${v === +p.rateKg ? 'selected' : ''}>${String(v).replace('.', ',')} kg</option>`).join('')}</select></label>
        <label class="field"><span>Protein (g / kg)</span><input class="input" name="proteinPerKg" inputmode="decimal" value="${p.proteinPerKg}"></label>
        <label class="field"><span>Yağ (% kalori)</span><input class="input" name="fatPct" inputmode="decimal" value="${p.fatPct}"></label>
      </div>
      <div class="suggest"></div>
      <div class="row-end"><button class="btn" type="submit">Profili kaydet</button><button class="btn primary" type="button" data-act="apply">Öneriyi hedef yap</button></div>
    </form>
  </section>

  <section class="card">
    <h3>🎯 Günlük hedefler</h3>
    <p class="muted small">Elle de girebilirsin. Değişiklik bugünden itibaren yeni günlere uygulanır; geçmiş günler kendi hedefini korur.</p>
    <form class="form targets-form">
      <div class="grid5">
        <label class="field"><span>Kalori</span><input class="input" name="kcal" inputmode="decimal" value="${p.targets.kcal}"></label>
        <label class="field"><span>Protein (g)</span><input class="input" name="p" inputmode="decimal" value="${p.targets.p}"></label>
        <label class="field"><span>Karb. (g)</span><input class="input" name="c" inputmode="decimal" value="${p.targets.c}"></label>
        <label class="field"><span>Yağ (g)</span><input class="input" name="f" inputmode="decimal" value="${p.targets.f}"></label>
        <label class="field"><span>Su (ml)</span><input class="input" name="water" inputmode="decimal" value="${p.targets.water}"></label>
      </div>
      <div class="macro-check muted small"></div>
      <div class="row-end"><button class="btn primary" type="submit">Hedefleri kaydet</button></div>
    </form>
  </section>

  <section class="card">
    <h3>💾 Yedek</h3>
    <p class="muted small">GitHub zaten her değişikliği saklıyor. Bu, ek bir güvence olarak tüm verini tek bir dosyaya indirir. İçe aktarma mevcut verinin üzerine yazmaz, birleştirir.</p>
    <div class="row">
      <button class="btn" data-act="export">Tüm veriyi indir (JSON)</button>
      <label class="btn ghost">Yedekten içe aktar<input type="file" accept="application/json,.json" hidden data-act="import"></label>
    </div>
  </section></div>`;

  // --- GitHub bağlantısı ---
  container.querySelector('.gh-form')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const form = ev.target;
    const btn = form.querySelector('button[type=submit]');
    const c = { owner: form.owner.value, repo: form.repo.value, token: form.token.value };
    btn.disabled = true; btn.textContent = 'Test ediliyor…';
    try {
      const info = await store.testConnection(c);
      if (!info.canWrite) throw new Error('Token bu repoya yazamıyor. Contents: Read and write iznini kontrol et.');
      if (!info.private && !(await confirmDialog(`${info.fullName} reposu PUBLIC. Beslenme verilerin herkese açık olur. Yine de devam edilsin mi?`, { okText: 'Devam et', danger: true }))) {
        btn.disabled = false; btn.textContent = 'Bağlan ve test et'; return;
      }
      await store.connect(c);
      toast('Bağlandı, veriler senkronize ediliyor');
      render(container);
    } catch (e) {
      toast(e.status === 401 ? 'Token geçersiz' : e.status === 404 ? 'Repo bulunamadı ya da token bu repoya erişemiyor' : e.message, 'err');
      btn.disabled = false; btn.textContent = 'Bağlan ve test et';
    }
  });

  container.querySelector('.page-root').addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'sync') { await store.sync(); toast(store.status.state === 'idle' ? 'Senkronize edildi' : 'Senkronizasyon tamamlanamadı', store.status.state === 'idle' ? 'ok' : 'err'); render(container); }
    if (act === 'disconnect' && await confirmDialog('Bağlantı kaldırılsın mı? Bu cihazdaki veriler silinmez, sadece GitHub ile eşitleme durur.')) { await store.disconnect(); render(container); }
    if (act === 'export') download(`besin-takip-yedek-${todayStr()}.json`, JSON.stringify(store.exportAll(), null, 1));
  });

  container.querySelector('[data-act="import"]').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const n = await store.importAll(JSON.parse(await file.text()));
      toast(`${n} dosya birleştirildi`);
      render(container);
    } catch (err) { toast(err.message, 'err'); }
  });

  // --- Profil ---
  const pf = container.querySelector('.profile-form');
  const readProfile = () => ({
    ...p,
    sex: pf.sex.value, birthYear: num(pf.birthYear.value), heightCm: num(pf.heightCm.value), weightKg: num(pf.weightKg.value),
    activity: num(pf.activity.value), goal: pf.goal.value, rateKg: num(pf.rateKg.value),
    proteinPerKg: num(pf.proteinPerKg.value), fatPct: num(pf.fatPct.value),
  });
  const showSuggest = () => {
    const np = readProfile();
    const r = suggest(np);
    pf.rateKg.disabled = np.goal === 'maintain';
    pf.querySelector('.suggest').innerHTML = `<div class="suggest-box">
      <div><span class="muted small">Bazal (BMR)</span><strong>${n0(r.bmr)}</strong></div>
      <div><span class="muted small">Günlük harcama (TDEE)</span><strong>${n0(r.tdee)}</strong></div>
      <div><span class="muted small">Önerilen hedef</span><strong class="accent">${n0(r.targets.kcal)} kcal</strong></div>
      <div><span class="muted small">Makrolar</span><strong><span class="mp">P ${r.targets.p}</span> <span class="mc">K ${r.targets.c}</span> <span class="mf">Y ${r.targets.f}</span></strong></div>
      <div><span class="muted small">Su</span><strong>${n0(r.targets.water)} ml</strong></div>
    </div>${r.belowFloor ? '<p class="alert small">Hesaplanan değer güvenli alt sınırın altında kaldığı için alt sınıra çekildi. Daha yavaş bir hız seçmen önerilir.</p>' : ''}
    <p class="muted small">Mifflin-St Jeor formülü ile tahmini değerlerdir; kilo trendine göre 2–3 haftada bir ayarlaman en doğrusu.</p>`;
  };
  pf.addEventListener('input', showSuggest);
  showSuggest();
  pf.addEventListener('submit', async ev => { ev.preventDefault(); await saveProfile(readProfile()); toast('Profil kaydedildi'); });
  pf.querySelector('[data-act="apply"]').addEventListener('click', async ev => {
    ev.stopPropagation();
    const np = readProfile();
    np.targets = suggest(np).targets;
    await saveProfile(np);
    await applyTargetsFromToday();
    toast('Yeni hedefler uygulandı');
    render(container);
  });

  // --- Hedefler ---
  const tf = container.querySelector('.targets-form');
  const mc = () => {
    const k = num(tf.p.value) * 4 + num(tf.c.value) * 4 + num(tf.f.value) * 9;
    const diff = k - num(tf.kcal.value);
    tf.querySelector('.macro-check').innerHTML = `Makrolardan gelen kalori: <strong>${n0(k)}</strong> kcal ${Math.abs(diff) > 50 ? `<span class="warn">(hedeften ${diff > 0 ? '+' : ''}${n0(diff)})</span>` : '✓'}`;
  };
  tf.addEventListener('input', mc); mc();
  tf.addEventListener('submit', async ev => {
    ev.preventDefault();
    const np = getProfile();
    np.targets = { kcal: r1(num(tf.kcal.value)), p: r1(num(tf.p.value)), c: r1(num(tf.c.value)), f: r1(num(tf.f.value)), water: r1(num(tf.water.value)) };
    await saveProfile(np);
    await applyTargetsFromToday();
    toast('Hedefler kaydedildi');
  });
}

export function stateText(st) {
  return { local: 'Yalnızca bu cihaz', idle: '✓ Senkronize', syncing: 'Eşitleniyor…', offline: 'Çevrimdışı — sonra gönderilecek', error: 'Hata' }[st.state] || st.state;
}
