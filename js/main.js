// Uygulama girişi: yönlendirme, düzen, senkron göstergesi.
import * as store from './store.js';
import { todayStr, modalOpen } from './util.js';
import { clearCharts } from './charts.js';
import * as dayView from './views/day.js';
import * as reportsView from './views/reports.js';
import * as bodyView from './views/body.js';
import * as foodsView from './views/foods.js';
import * as settingsView from './views/settings.js';

const routes = {
  gun: dayView,
  rapor: reportsView,
  vucut: bodyView,
  besinler: foodsView,
  ayarlar: settingsView,
};

const view = document.getElementById('view');

function parseHash() {
  const [, name = 'gun', ...rest] = (location.hash || '#/gun').split('/');
  return { name: routes[name] ? name : 'gun', params: { date: rest[0] } };
}

function route({ keepScroll = false } = {}) {
  const { name, params } = parseHash();
  const y = window.scrollY;
  clearCharts();
  const page = document.createElement('div');
  page.className = 'page';
  view.replaceChildren(page);
  routes[name].render(page, params);
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
  if (name === 'gun') document.querySelectorAll('[data-nav="gun"]').forEach(a => a.setAttribute('href', `#/gun/${params.date || todayStr()}`));
  window.scrollTo(0, keepScroll ? y : 0);
}

function renderStatus() {
  const st = store.status;
  const pill = document.getElementById('sync-pill');
  const map = {
    local: ['warn', 'Yalnızca bu cihaz'],
    idle: ['ok', 'Kaydedildi'],
    syncing: ['busy', 'Eşitleniyor…'],
    offline: ['warn', `Çevrimdışı${st.pending ? ` · ${st.pending} bekliyor` : ''}`],
    error: ['err', 'Senkron hatası'],
  };
  const [cls, text] = map[st.state] || ['', st.state];
  pill.className = `sync-pill ${cls}`;
  pill.textContent = text;
  pill.title = st.error || (st.lastSync ? `Son senkron: ${new Date(st.lastSync).toLocaleString('tr-TR')}` : '');
  document.getElementById('local-banner').hidden = st.state !== 'local';
}

async function start() {
  await store.init();
  store.on(type => {
    if (type === 'status' || type === 'change') renderStatus();
    // Başka cihazdan veri gelince ekranı tazele (açık pencere yoksa).
    if (type === 'remote' && !modalOpen() && !document.activeElement?.matches('input, textarea, select')) route({ keepScroll: true });
  });
  window.addEventListener('hashchange', () => route());
  if (!location.hash) history.replaceState(null, '', `#/gun/${todayStr()}`);
  renderStatus();
  route();
}

start().catch(e => {
  console.error(e);
  view.innerHTML = `<div class="card"><h3>Uygulama başlatılamadı</h3><p>${String(e.message || e)}</p>
  <p class="muted small">Tarayıcının gizli modunda IndexedDB kapalı olabilir. Normal pencerede dene.</p></div>`;
});
