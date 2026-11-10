// Veri katmanı: yerel kopya (IndexedDB) + GitHub senkronizasyonu.
// Kural: hiçbir kayıt fiziksel olarak silinmez. Silmeler "deleted: true" ile işaretlenir,
// her değişiklik veri reposuna ayrı commit olarak gider, git geçmişi her sürümü saklar.
import { idbAll, idbSet } from './db.js';
import { GitHub } from './github.js';

const docs = new Map(); // yol -> { data, sha, dirty, ver }
let config = null;
let gh = null;
const listeners = new Set();
export const status = { state: 'local', pending: 0, lastSync: null, error: null };

let pushTimer = null;
let retryTimer = null;
let busy = null;

export function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(type) { for (const fn of listeners) { try { fn(type, status); } catch (e) { console.error(e); } } }

function setState(state, error = null) {
  status.state = state;
  status.error = error;
  emit('status');
}

function updatePending() {
  let n = 0;
  for (const d of docs.values()) if (d.dirty) n++;
  status.pending = n;
}

// ---------- Birleştirme (iki cihazda aynı dosya değişirse) ----------
const newer = (a, b) => ((b?.updatedAt || 0) > (a?.updatedAt || 0) ? b : a);

function mergeList(la = [], lb = []) {
  const m = new Map();
  for (const x of [...la, ...lb]) {
    const cur = m.get(x.id);
    if (!cur || (x.updatedAt || 0) > (cur.updatedAt || 0)) m.set(x.id, x);
  }
  return [...m.values()];
}

export function mergeDocs(a, b) {
  if (!a) return b;
  if (!b) return a;
  const base = structuredClone(newer(a, b));
  for (const key of ['entries', 'items']) {
    if (Array.isArray(a[key]) || Array.isArray(b[key])) base[key] = mergeList(a[key], b[key]);
  }
  for (const key of ['water', 'note']) {
    if (a[key] || b[key]) base[key] = structuredClone(newer(a[key], b[key]));
  }
  base.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return base;
}

// ---------- Başlatma ----------
export async function init() {
  const all = await idbAll();
  for (const [k, v] of all) if (typeof k === 'string' && k.startsWith('doc:')) docs.set(k.slice(4), v);
  config = all.get('config') || null;
  updatePending();
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch {}

  if (config?.token) {
    gh = new GitHub(config);
    setState('idle');
    sync();
  } else {
    setState('local');
  }

  window.addEventListener('online', () => sync());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') sync();
  });
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 5 * 60 * 1000);
  window.addEventListener('beforeunload', e => {
    if (status.pending > 0 && gh) { e.preventDefault(); e.returnValue = ''; }
  });
}

// ---------- Okuma / yazma ----------
export function get(path) {
  const d = docs.get(path);
  return d ? structuredClone(d.data) : null;
}

export function paths(prefix) {
  return [...docs.keys()].filter(p => p.startsWith(prefix)).sort();
}

export async function set(path, data) {
  data.updatedAt = Date.now();
  const prev = docs.get(path);
  const doc = { data: structuredClone(data), sha: prev?.sha ?? null, dirty: true, ver: (prev?.ver || 0) + 1 };
  docs.set(path, doc);
  await idbSet('doc:' + path, doc); // önce yerel diske, sonra GitHub'a
  updatePending();
  emit('change');
  schedulePush();
}

// ---------- Senkronizasyon ----------
function schedulePush(delay = 1500) {
  if (!gh) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => sync({ pullFirst: false }), delay);
}

function scheduleRetry(ms) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => sync(), ms);
}

function commitMessage(path) {
  let m;
  if ((m = path.match(/days\/\d{4}\/\d{2}\/(\d{4}-\d{2}-\d{2})\.json$/))) return `Gün kaydı: ${m[1]}`;
  if (path.endsWith('profile.json')) return 'Profil ve hedefler güncellendi';
  if (path.endsWith('body.json')) return 'Vücut ölçüleri güncellendi';
  if (path.endsWith('foods.json')) return 'Özel besinler güncellendi';
  return `Güncelleme: ${path}`;
}

async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; await fn(item); }
  });
  await Promise.all(workers);
}

async function pull() {
  const tree = await gh.tree();
  const toFetch = [];
  for (const [path, sha] of tree) {
    const d = docs.get(path);
    if (!d || d.sha !== sha) toFetch.push([path, sha]);
  }
  await pool(toFetch, 6, async ([path, sha]) => {
    const remote = await gh.getBlob(sha);
    const d = docs.get(path);
    let nd;
    if (!d) nd = { data: remote, sha, dirty: false, ver: 0 };
    else if (!d.dirty) nd = { data: remote, sha, dirty: false, ver: d.ver };
    else nd = { data: mergeDocs(d.data, remote), sha, dirty: true, ver: d.ver + 1 };
    docs.set(path, nd);
    await idbSet('doc:' + path, nd);
  });
  // Yerelde olup uzakta olmayan (ör. elle silinmiş) dosyaları yeniden gönder: veri kaybolmasın.
  for (const [path, d] of docs) {
    if (path.startsWith('data/') && d.sha && !tree.has(path)) {
      d.sha = null; d.dirty = true; d.ver++;
      await idbSet('doc:' + path, d);
    }
  }
  updatePending();
  if (toFetch.length) emit('remote');
}

async function pushOne(path, attempt = 0) {
  const d = docs.get(path);
  const ver = d.ver;
  try {
    const sha = await gh.putFile(path, d.data, d.sha, commitMessage(path));
    const cur = docs.get(path);
    cur.sha = sha;
    if (cur.ver === ver) cur.dirty = false;
    await idbSet('doc:' + path, cur);
  } catch (e) {
    if ((e.status === 409 || e.status === 422) && attempt < 3) {
      // Başka bir cihaz bu dosyayı değiştirmiş: birleştir ve tekrar dene.
      const remote = await gh.getFile(path);
      const cur = docs.get(path);
      if (remote) { cur.data = mergeDocs(cur.data, remote.data); cur.sha = remote.sha; }
      else cur.sha = null;
      await idbSet('doc:' + path, cur);
      emit('remote');
      return pushOne(path, attempt + 1);
    }
    throw e;
  }
}

async function push() {
  for (const [path, d] of docs) {
    if (!d.dirty) continue;
    await pushOne(path);
    updatePending();
    emit('status');
  }
}

export function sync({ pullFirst = true } = {}) {
  if (!gh) return Promise.resolve();
  if (busy) {
    // Devam eden senkronizasyon bitince bir tur daha.
    busy.then(() => schedulePush(200));
    return busy;
  }
  busy = (async () => {
    setState('syncing');
    try {
      if (pullFirst) await pull();
      await push();
      status.lastSync = Date.now();
      setState('idle');
    } catch (e) {
      console.error(e);
      if (e.status === 401 || e.status === 403) setState('error', 'Token geçersiz, süresi dolmuş ya da repoya yazma izni yok.');
      else if (e.status === 404) setState('error', 'Veri reposu bulunamadı. Ayarlar\'dan bağlantıyı kontrol et.');
      else if (e.status === 0) { setState('offline', e.message); scheduleRetry(30000); }
      else { setState('error', e.message); scheduleRetry(60000); }
    } finally {
      updatePending();
      busy = null;
      emit('status');
    }
  })();
  return busy;
}

// ---------- Bağlantı ayarları ----------
export function getConfig() { return config ? { ...config } : null; }

export async function testConnection(cfg) {
  const client = new GitHub(cfg);
  const info = await client.repoInfo();
  return {
    private: info.private,
    canWrite: !!(info.permissions && (info.permissions.push || info.permissions.admin)),
    fullName: info.full_name,
  };
}

export async function connect(cfg) {
  config = { owner: cfg.owner.trim(), repo: cfg.repo.trim(), token: cfg.token.trim() };
  await idbSet('config', config);
  gh = new GitHub(config);
  // Bağlanmadan önce yerelde girilmiş her şey de gönderilsin.
  for (const [path, d] of docs) {
    if (!d.dirty && !d.sha) { d.dirty = true; await idbSet('doc:' + path, d); }
  }
  updatePending();
  return sync();
}

export async function disconnect() {
  config = null;
  gh = null;
  await idbSet('config', null);
  setState('local');
}

// ---------- Yedek ----------
export function exportAll() {
  const out = { app: 'besin-takip', version: 1, exportedAt: new Date().toISOString(), docs: {} };
  for (const [path, d] of docs) if (path.startsWith('data/')) out.docs[path] = d.data;
  return out;
}

export async function importAll(obj) {
  if (!obj || obj.app !== 'besin-takip' || !obj.docs) throw new Error('Bu dosya Besin Takip yedeği değil.');
  let n = 0;
  for (const [path, data] of Object.entries(obj.docs)) {
    if (!path.startsWith('data/')) continue;
    const cur = docs.get(path)?.data;
    await set(path, cur ? mergeDocs(cur, data) : data);
    n++;
  }
  return n;
}
