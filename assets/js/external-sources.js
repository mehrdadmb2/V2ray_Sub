(() => {
  'use strict';

  const STATUS_URL = './data/external-sources-status.json';
  const EXTERNAL_FILE_URL = 'https://raw.githubusercontent.com/mehrdadmb2/V2ray_Sub/refs/heads/main/External.txt';
  const number = value => Number(value || 0).toLocaleString('fa-IR');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateTime = value => {
    if (!value) return 'هنوز ثبت نشده';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'نامشخص' : new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium', timeStyle: 'short'
    }).format(date);
  };
  const healthLabels = {
    available: 'قابل دریافت',
    partial: 'نیازمند بررسی',
    offline: 'خطا / قطع',
    unknown: 'بررسی‌نشده',
    empty: 'بدون کانفیگ',
    disabled: 'غیرفعال'
  };

  const panel = document.getElementById('externalSourcesView');
  const main = document.querySelector('main.glass-container');
  const openButton = document.querySelector('[data-external-open]');
  if (!panel || !main || !openButton) return;

  const refs = {
    back: document.getElementById('externalBackButton'),
    grid: document.getElementById('externalSourcesGrid'),
    search: document.getElementById('externalSearch'),
    status: document.getElementById('externalStatusFilter'),
    category: document.getElementById('externalCategoryFilter'),
    refresh: document.getElementById('externalRefreshButton'),
    results: document.getElementById('externalResultsCount'),
    report: document.getElementById('externalReportStatus'),
    total: document.getElementById('externalMetricTotal'),
    available: document.getElementById('externalMetricAvailable'),
    configs: document.getElementById('externalMetricConfigs'),
    updated: document.getElementById('externalMetricUpdated'),
    aggregateInfo: document.getElementById('externalAggregateInfo'),
    aggregateOpen: document.getElementById('externalAggregateOpen'),
    aggregateCopy: document.getElementById('externalAggregateCopy')
  };

  let reportData = null;
  let busy = false;

  function setMode(enabled) {
    main.hidden = enabled;
    panel.hidden = !enabled;
    document.body.classList.toggle('external-mode', enabled);
    if (enabled) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      refs.search?.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function normalizedUrl(value) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:') return '';
      return url.toString();
    } catch {
      return '';
    }
  }

  function getVisibleSources() {
    const sources = Array.isArray(reportData?.sources) ? reportData.sources : [];
    const query = String(refs.search?.value || '').trim().toLowerCase();
    const status = refs.status?.value || 'all';
    const category = refs.category?.value || 'all';
    return sources.filter(source => {
      const searchText = `${source.name || ''} ${source.provider || ''} ${source.url || ''} ${Object.keys(source.protocols || {}).join(' ')}`.toLowerCase();
      return (!query || searchText.includes(query))
        && (status === 'all' || source.health === status)
        && (category === 'all' || source.category === category);
    }).sort((a, b) => {
      const rank = { available: 0, partial: 1, unknown: 2, empty: 3, offline: 4, disabled: 5 };
      const byHealth = (rank[a.health] ?? 9) - (rank[b.health] ?? 9);
      if (byHealth) return byHealth;
      return Number(b.validConfigCount ?? b.configCount ?? 0) - Number(a.validConfigCount ?? a.configCount ?? 0);
    });
  }

  function renderStats() {
    const sources = Array.isArray(reportData?.sources) ? reportData.sources : [];
    const available = sources.filter(source => ['available', 'partial'].includes(source.health)).length;
    const configTotal = sources
      .filter(source => source.includeInAggregate !== false)
      .reduce((sum, source) => sum + Number(source.validConfigCount ?? 0), 0);
    refs.total.textContent = number(reportData?.totalSources ?? sources.length);
    refs.available.textContent = number(reportData?.availableSources ?? available);
    refs.configs.textContent = number(reportData?.aggregate?.configCount ?? configTotal);
    refs.updated.textContent = reportData?.generatedAt
      ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(reportData.generatedAt))
      : '—';

    const aggregate = reportData?.aggregate || {};
    const count = Number(aggregate.configCount || 0);
    const url = normalizedUrl(aggregate.url) || EXTERNAL_FILE_URL;
    const stale = aggregate.stale === true;
    refs.aggregateInfo.textContent = count > 0
      ? `${number(count)} کانفیگ یکتای پردازش‌شده${stale ? ' · خروجی از اجرای قبلی باقی مانده است' : ''} · آخرین تولید: ${dateTime(aggregate.updatedAt || reportData.generatedAt)}`
      : 'هنوز خروجی معتبر ساخته نشده است. پس از اولین اجرای موفق GitHub Actions، این لینک فعال می‌شود.';
    refs.aggregateOpen.href = url;
    refs.aggregateCopy.dataset.copyUrl = url;
    refs.aggregateOpen.hidden = count < 1;
    refs.aggregateCopy.hidden = count < 1;
  }

  function renderCard(source) {
    const url = normalizedUrl(source.url);
    const health = healthLabels[source.health] ? source.health : 'unknown';
    const hasParserMetrics = source.validConfigCount != null;
    const count = hasParserMetrics ? number(source.validConfigCount) : (source.configCount == null ? '—' : number(source.configCount));
    const countLabel = hasParserMetrics ? 'URI معتبر' : (reportData?.checkMode === 'initial-tool-check' && source.configCount != null ? 'URI شناسایی‌شده' : 'URI معتبر');
    const invalid = source.invalidConfigCount == null ? '—' : number(source.invalidConfigCount);
    const protocols = Object.entries(source.protocols || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([protocol, total]) => `<span class="external-protocol">${esc(protocol)} · ${number(total)}</span>`)
      .join('');
    const categoryIcon = source.category === 'workers' ? 'fa-cloud' : 'fa-brands fa-github';
    const statusCode = source.httpStatus ? `HTTP ${esc(source.httpStatus)}` : 'HTTP —';
    const latency = source.latencyMs == null ? '—' : `${number(source.latencyMs)} ms`;
    const note = source.note || (source.health === 'available'
      ? 'پاسخ معتبر دریافت شد؛ وضعیت اتصال واقعی سرور بررسی نشده است.'
      : 'جزئیات این منبع هنوز در گزارش ثبت نشده است.');
    const linkLabel = url ? url.replace(/^https:\/\//, '') : 'لینک نامعتبر یا حذف‌شده';
    return `
      <article class="external-card" data-source-id="${esc(source.id)}">
        <div class="external-card-top">
          <div class="external-card-title">
            <span class="external-provider-icon"><i class="${categoryIcon}"></i></span>
            <div><strong>${esc(source.name || source.id || 'منبع بدون نام')}</strong><small>${esc(source.provider || source.category || 'External')}</small></div>
          </div>
          <span class="external-health ${health}">${healthLabels[health]}</span>
        </div>
        ${url ? `<a class="external-card-url" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(url)}">${esc(linkLabel)}</a>` : `<div class="external-card-url">Invalid URL</div>`}
        <div class="external-card-stats">
          <div class="external-card-stat"><b>${count}</b><span>${countLabel}</span></div>
          <div class="external-card-stat"><b>${invalid}</b><span>ردشده / نامعتبر</span></div>
          <div class="external-card-stat"><b>${latency}</b><span>${statusCode}</span></div>
        </div>
        <div class="external-protocols">${protocols || '<span class="external-card-note">توزیع پروتکل هنوز موجود نیست</span>'}</div>
        <p class="external-card-note">${esc(note)}</p>
        <div class="external-card-note">آخرین بررسی: ${esc(dateTime(source.lastCheckedAt))}</div>
        <div class="external-card-actions">
          ${url ? `<button type="button" data-copy-url="${esc(url)}"><i class="far fa-copy"></i> کپی لینک</button><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i> بازکردن</a>` : ''}
        </div>
      </article>`;
  }

  function renderGrid() {
    const visible = getVisibleSources();
    const all = Array.isArray(reportData?.sources) ? reportData.sources : [];
    refs.results.textContent = `${number(visible.length)} از ${number(all.length)} منبع`;
    refs.grid.innerHTML = visible.length
      ? visible.map(renderCard).join('')
      : `<div class="external-empty"><i class="fas fa-filter-circle-xmark"></i><strong>منبعی با این فیلتر پیدا نشد.</strong><span>عبارت جستجو یا فیلتر وضعیت را تغییر بده.</span></div>`;
    renderStats();
  }

  async function loadReport({ quiet = false } = {}) {
    if (busy) return;
    busy = true;
    if (refs.refresh) {
      refs.refresh.disabled = true;
      refs.refresh.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>در حال دریافت…</span>';
    }
    if (!quiet) refs.report.textContent = 'در حال دریافت آخرین گزارش…';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${STATUS_URL}?v=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.sources)) throw new Error('ساختار گزارش معتبر نیست');
      reportData = data;
      renderGrid();
      refs.report.textContent = `گزارش بروزرسانی شد · ${dateTime(data.generatedAt)}`;
    } catch (error) {
      if (!reportData) {
        refs.grid.innerHTML = `<div class="external-empty"><i class="fas fa-triangle-exclamation"></i><strong>گزارش سلامت هنوز در دسترس نیست.</strong><span>Workflow مربوط به منابع متفرقه را در GitHub Actions اجرا کن.</span></div>`;
      }
      refs.report.textContent = `دریافت گزارش ناموفق بود · ${String(error.message || error)}`;
    } finally {
      clearTimeout(timer);
      busy = false;
      if (refs.refresh) {
        refs.refresh.disabled = false;
        refs.refresh.innerHTML = '<i class="fas fa-rotate"></i><span>بررسی دوباره گزارش</span>';
      }
    }
  }

  async function copyUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      refs.report.textContent = 'لینک در کلیپ‌بورد کپی شد.';
    } catch {
      const field = document.createElement('textarea');
      field.value = url;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const ok = document.execCommand('copy');
      field.remove();
      refs.report.textContent = ok ? 'لینک کپی شد.' : 'کپی خودکار توسط مرورگر مسدود شد.';
    }
  }

  openButton.addEventListener('click', () => {
    setMode(true);
    loadReport({ quiet: true });
  });
  refs.back?.addEventListener('click', () => setMode(false));
  refs.refresh?.addEventListener('click', () => loadReport());
  refs.search?.addEventListener('input', renderGrid);
  refs.status?.addEventListener('change', renderGrid);
  refs.category?.addEventListener('change', renderGrid);
  refs.grid?.addEventListener('click', event => {
    const button = event.target.closest('[data-copy-url]');
    if (button) copyUrl(button.dataset.copyUrl);
  });
  refs.aggregateCopy?.addEventListener('click', () => {
    const url = refs.aggregateCopy.dataset.copyUrl;
    if (url) copyUrl(url);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) setMode(false);
  });

  // The external report is fetched only after the user opens its separate workspace.
})();
