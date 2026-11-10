// Ortak yardımcılar: tarih, biçimlendirme, modal, bildirim.

export const MEALS = [
  { id: 'kahvalti', name: 'Kahvaltı', icon: '☀️' },
  { id: 'ogle', name: 'Öğle', icon: '🍽️' },
  { id: 'aksam', name: 'Akşam', icon: '🌙' },
  { id: 'ara', name: 'Ara öğün', icon: '🍎' },
];
export const mealName = id => MEALS.find(m => m.id === id)?.name || id;

// ---------- Tarih ----------
const pad = n => String(n).padStart(2, '0');
export function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function todayStr() { return toDateStr(new Date()); }
export function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d); }
export function isValidDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseDate(s)); }
export function dayPath(s) { const [y, m] = s.split('-'); return `data/days/${y}/${m}/${s}.json`; }

const longFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });
const shortWdFmt = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtLong = s => longFmt.format(parseDate(s));
export const fmtShort = s => shortFmt.format(parseDate(s));
export const fmtShortWd = s => shortWdFmt.format(parseDate(s));

export function relativeDay(s) {
  const t = todayStr();
  if (s === t) return 'Bugün';
  if (s === addDays(t, -1)) return 'Dün';
  if (s === addDays(t, 1)) return 'Yarın';
  return null;
}

// ---------- Sayılar ----------
const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
export const n0 = v => nf0.format(Math.round(v || 0));
export const n1 = v => nf1.format(v || 0);
export const r1 = v => Math.round((v || 0) * 10) / 10;
export function num(v) { const x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : 0; }

// ---------- Diğer ----------
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const trMap = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
export function norm(s) {
  return String(s || '').toLocaleLowerCase('tr-TR').replace(/[çğıiöşüâîû]/g, c => trMap[c] || c).trim();
}

export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

// ---------- Bildirim ----------
export function toast(msg, kind = 'ok') {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2800);
}

// ---------- Modal ----------
let openModals = 0;
export const modalOpen = () => openModals > 0;

export function modal(html, { onMount, wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
    <button class="modal-close icon-btn" aria-label="Kapat">✕</button>
    <div class="modal-body">${html}</div></div>`;
  document.body.appendChild(wrap);
  openModals++;
  document.body.classList.add('no-scroll');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    openModals--;
    if (!openModals) document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', onKey);
    wrap.remove();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
  wrap.querySelector('.modal-close').addEventListener('click', close);
  const body = wrap.querySelector('.modal-body');
  onMount?.(body, close);
  return { body, close };
}

export function confirmDialog(message, { okText = 'Evet', danger = false } = {}) {
  return new Promise(resolve => {
    let done = false;
    const { close } = modal(`<p class="confirm-text">${esc(message)}</p>
      <div class="row-end"><button class="btn ghost" data-a="no">Vazgeç</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-a="yes">${esc(okText)}</button></div>`, {
      onMount(body, close) {
        body.addEventListener('click', e => {
          const a = e.target.closest('[data-a]')?.dataset.a;
          if (!a) return;
          done = true; resolve(a === 'yes'); close();
        });
      },
    });
    const obs = new MutationObserver(() => { if (!done && !document.querySelector('.confirm-text')) { done = true; resolve(false); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
    void close;
  });
}

export function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
