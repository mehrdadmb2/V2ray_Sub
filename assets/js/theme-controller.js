(() => {
  'use strict';
  const root = document.documentElement;
  const button = document.querySelector('[data-v6-theme-toggle]');
  const label = document.querySelector('[data-v6-theme-label]');
  if (!button || !label) return;

  const themes = [
    { id: 'aurora', name: 'آبی', title: 'Aurora · Blue / Mint' },
    { id: 'emerald', name: 'زمردی', title: 'Emerald · Green / Teal' },
    { id: 'ember', name: 'کهربایی', title: 'Ember · Orange / Rose' },
  ];
  let active = themes.findIndex(theme => theme.id === root.dataset.v6Theme);
  if (active < 0) {
    try {
      const saved = localStorage.getItem('v2ray-sub-theme-v1');
      active = themes.findIndex(theme => theme.id === saved);
    } catch { /* Storage can be blocked in private browsing. */ }
  }
  if (active < 0) active = 0;

  function applyTheme(index, persist = false) {
    active = (index + themes.length) % themes.length;
    const theme = themes[active];
    root.dataset.v6Theme = theme.id;
    label.textContent = `پوسته · ${theme.name}`;
    button.title = `پوسته فعلی: ${theme.title} — برای تغییر کلیک کن`;
    button.setAttribute('aria-label', button.title);
    if (persist) {
      try { localStorage.setItem('v2ray-sub-theme-v1', theme.id); } catch { /* Keep the in-memory theme. */ }
    }
  }

  applyTheme(active);
  button.addEventListener('click', () => applyTheme(active + 1, true));
})();
