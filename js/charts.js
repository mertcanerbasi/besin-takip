// Chart.js sarmalayıcı (CDN'den yüklenir). Görünüm değişince eski grafikler temizlenir.
let instances = [];

export function clearCharts() {
  instances.forEach(c => c.destroy());
  instances = [];
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function chart(canvas, config) {
  if (!window.Chart) {
    canvas.replaceWith(Object.assign(document.createElement('p'), { className: 'muted small', textContent: 'Grafik kütüphanesi yüklenemedi (internet bağlantısını kontrol et).' }));
    return null;
  }
  const Chart = window.Chart;
  Chart.defaults.font.family = cssVar('--font') || 'system-ui';
  Chart.defaults.color = cssVar('--muted');
  Chart.defaults.borderColor = cssVar('--line');
  const c = new Chart(canvas, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { boxWidth: 12, usePointStyle: true } } },
      ...config.options,
    },
  });
  instances.push(c);
  return c;
}
