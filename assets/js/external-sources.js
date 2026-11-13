(() => {
  'use strict';

  const STATUS_URL = './data/external-sources-status.json';
  const METADATA_URL = './data/external-processed.json';
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
    available: 'قابل دریافت', partial: 'نیازمند بررسی', offline: 'خطا / قطع',
    unknown: 'بررسی‌نشده', empty: 'بدون کانفیگ', disabled: 'غیرفعال'
  };
  const panel = document.getElementById('externalSourcesView');
  const main = document.querySelector('main.glass-container');
  const openButton = document.querySelector('[data-external-open]');
  if (!panel || !main || !openButton) return;

  const byId = id => document.getElementById(id);
  const refs = {
    back: byId('externalBackButton'), grid: byId('externalSourcesGrid'),
    search: byId('externalSearch'), status: byId('externalStatusFilter'),
    category: byId('externalCategoryFilter'), refresh: byId('externalRefreshButton'),
    results: byId('externalResultsCount'), report: byId('externalReportStatus'),
    total: byId('externalMetricTotal'), available: byId('externalMetricAvailable'),
    configs: byId('externalMetricConfigs'), updated: byId('externalMetricUpdated'),
    aggregateInfo: byId('externalAggregateInfo'), aggregateOpen: byId('externalAggregateOpen'),
    aggregateCopy: byId('externalAggregateCopy'), protocol: byId('externalProtocolFilter'),
    country: byId('externalCountryFilter'), source: byId('externalSourceFilter'),
    configSearch: byId('externalConfigSearch'), configGrid: byId('externalConfigsGrid'),
    copyFiltered: byId('externalCopyFiltered'), downloadFiltered: byId('externalDownloadFiltered'),
    resetFilters: byId('externalResetConfigFilters'), configCount: byId('externalConfigResultCount'),
    indexState: byId('externalIndexState'), uniqueMetric: byId('externalUniqueMetric'),
    duplicateMetric: byId('externalDuplicateMetric'), invalidMetric: byId('externalInvalidMetric'),
    protocolMetric: byId('externalProtocolMetric'), countryMetric: byId('externalCountryMetric'),
    libraryFooter: byId('externalLibraryFooter'), protocolBars: byId('externalProtocolBars'), countryBars: byId('externalCountryBars'),
    prevPage: byId('externalConfigPrev'), nextPage: byId('externalConfigNext'), pageInfo: byId('externalConfigPageInfo')
  };

  let reportData = null;
  let processedData = null;
  let configLines = [];
  let busy = false;
  let configsLoaded = false;
  let configPage = 0;
  const CONFIG_PAGE_SIZE = 100;

  function setMode(enabled) {
    main.hidden = enabled;
    panel.hidden = !enabled;
    document.body.classList.toggle('external-mode', enabled);
    document.querySelectorAll('[data-external-open]').forEach(button => button.classList.toggle('is-active', enabled));
    if (enabled) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      refs.search?.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function normalizedUrl(value) {
    try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.toString() : ''; }
    catch { return ''; }
  }

  function getVisibleSources() {
    const sources = Array.isArray(reportData?.sources) ? reportData.sources : [];
    const query = String(refs.search?.value || '').trim().toLowerCase();
    const status = refs.status?.value || 'all';
    const category = refs.category?.value || 'all';
    return sources.filter(source => {
      const searchText = `${source.name || ''} ${source.provider || ''} ${source.url || ''} ${Object.keys(source.protocols || {}).join(' ')}`.toLowerCase();
      return (!query || searchText.includes(query)) && (status === 'all' || source.health === status)
        && (category === 'all' || source.category === category);
    }).sort((a, b) => {
      const rank = { available: 0, partial: 1, unknown: 2, empty: 3, offline: 4, disabled: 5 };
      const byHealth = (rank[a.health] ?? 9) - (rank[b.health] ?? 9);
      return byHealth || Number(b.processedConfigCount ?? b.validConfigCount ?? 0) - Number(a.processedConfigCount ?? a.validConfigCount ?? 0);
    });
  }

  function renderStats() {
    const sources = Array.isArray(reportData?.sources) ? reportData.sources : [];
    const available = sources.filter(source => ['available', 'partial'].includes(source.health)).length;
    const aggregate = reportData?.aggregate || {};
    refs.total.textContent = number(reportData?.totalSources ?? sources.length);
    refs.available.textContent = number(reportData?.availableSources ?? available);
    refs.configs.textContent = number(aggregate.configCount ?? processedData?.stats?.processedCount ?? 0);
    refs.updated.textContent = reportData?.processed?.generatedAt || aggregate.processedAt || aggregate.updatedAt
      ? dateTime(reportData?.processed?.generatedAt || aggregate.processedAt || aggregate.updatedAt)
      : '—';
    const count = Number(aggregate.configCount ?? processedData?.stats?.processedCount ?? 0);
    const url = normalizedUrl(aggregate.url) || EXTERNAL_FILE_URL;
    const stale = aggregate.processedStale === true || aggregate.stale === true;
    refs.aggregateInfo.textContent = count > 0
      ? `${number(count)} کانفیگ نام‌گذاری‌شده و یکتا${stale ? ' · خروجی قبلی / نیازمند پردازش مجدد' : ''} · تولید: ${dateTime(aggregate.processedAt || aggregate.updatedAt || processedData?.generatedAt)}`
      : 'هنوز خروجی پردازش‌شده ساخته نشده است. ابتدا هر دو Workflow منابع متفرقه را اجرا کن.';
    refs.aggregateOpen.href = url;
    refs.aggregateCopy.dataset.copyUrl = url;
    refs.aggregateOpen.hidden = count < 1;
    refs.aggregateCopy.hidden = count < 1;
  }

  function renderCard(source) {
    const url = normalizedUrl(source.url);
    const health = healthLabels[source.health] ? source.health : 'unknown';
    const count = source.validConfigCount == null ? '—' : number(source.validConfigCount);
    const processed = source.processedConfigCount == null ? '—' : number(source.processedConfigCount);
    const invalid = source.invalidConfigCount == null ? '—' : number(source.invalidConfigCount);
    const protocols = Object.entries(source.protocols || {}).sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([protocol, total]) => `<span class="external-protocol">${esc(protocol)} · ${number(total)}</span>`).join('');
    const categoryIcon = source.category === 'workers' ? 'fas fa-cloud' : 'fab fa-github';
    const statusCode = source.httpStatus ? `HTTP ${esc(source.httpStatus)}` : 'HTTP —';
    const latency = source.latencyMs == null ? '—' : `${number(source.latencyMs)} ms`;
    const note = source.note || (source.health === 'available'
      ? 'پاسخ دریافت و ساختار URI بررسی شده؛ اتصال واقعی پروکسی تست نشده است.' : 'جزئیات این منبع هنوز در گزارش ثبت نشده است.');
    const linkLabel = url ? url.replace(/^https:\/\//, '') : 'لینک نامعتبر یا حذف‌شده';
    return `
      <article class="external-card" data-source-id="${esc(source.id)}">
        <div class="external-card-top"><div class="external-card-title"><span class="external-provider-icon"><i class="${categoryIcon}"></i></span>
          <div><strong>${esc(source.name || source.id || 'منبع بدون نام')}</strong><small>${esc(source.provider || source.category || 'External')}</small></div>
        </div><span class="external-health ${health}">${healthLabels[health]}</span></div>
        ${url ? `<a class="external-card-url" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(url)}">${esc(linkLabel)}</a>` : '<div class="external-card-url">Invalid URL</div>'}
        <div class="external-card-stats">
          <div class="external-card-stat"><b>${count}</b><span>URI معتبر دریافتی</span></div>
          <div class="external-card-stat"><b>${processed}</b><span>کانفیگ در خروجی نهایی</span></div>
          <div class="external-card-stat"><b>${invalid}</b><span>ردشده / نامعتبر</span></div>
        </div>
        <div class="external-card-stats"><div class="external-card-stat"><b>${latency}</b><span>${statusCode}</span></div><div class="external-card-stat"><b>${number(source.bytes || 0)}</b><span>بایت دریافتی</span></div><div class="external-card-stat"><b>${number(source.duplicateCount || 0)}</b><span>تکراری منبع</span></div></div>
        <div class="external-protocols">${protocols || '<span class="external-card-note">توزیع پروتکل هنوز موجود نیست</span>'}</div>
        <p class="external-card-note">${esc(note)}</p><div class="external-card-note">آخرین بررسی: ${esc(dateTime(source.lastCheckedAt))}</div>
        <div class="external-card-actions">${url ? `<button type="button" data-copy-url="${esc(url)}"><i class="far fa-copy"></i> کپی لینک</button><a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><i class="fas fa-arrow-up-right-from-square"></i> بازکردن</a>` : ''}</div>
      </article>`;
  }

  function renderGrid() {
    const visible = getVisibleSources();
    const all = Array.isArray(reportData?.sources) ? reportData.sources : [];
    refs.results.textContent = `${number(visible.length)} از ${number(all.length)} منبع`;
    refs.grid.innerHTML = visible.length ? visible.map(renderCard).join('')
      : '<div class="external-empty"><i class="fas fa-filter-circle-xmark"></i><strong>منبعی با این فیلتر پیدا نشد.</strong><span>عبارت جستجو یا فیلتر وضعیت را تغییر بده.</span></div>';
    renderStats();
  }

  function visibleConfigs() {
    const entries = Array.isArray(processedData?.configs) ? processedData.configs : [];
    const protocol = refs.protocol?.value || 'all';
    const country = refs.country?.value || 'all';
    const source = refs.source?.value || 'all';
    const query = String(refs.configSearch?.value || '').trim().toLowerCase();
    return entries.filter(item => {
      const line = configLines[Number(item.index)] || '';
      const sourceIds = Array.isArray(item.sourceIds) ? item.sourceIds : [];
      const sourceNames = Array.isArray(item.sourceNames) ? item.sourceNames : [];
      const haystack = `${item.newName || ''} ${item.originalName || ''} ${item.host || ''} ${item.protocol || ''} ${item.countryLabel || ''} ${item.countryCode || ''} ${sourceNames.join(' ')} ${line}`.toLowerCase();
      return (protocol === 'all' || item.protocol === protocol)
        && (country === 'all' || item.countryCode === country)
        && (source === 'all' || sourceIds.includes(source))
        && (!query || haystack.includes(query));
    });
  }

  function populateSelect(select, rows, allLabel, valueOf, labelOf) {
    if (!select) return;
    const current = select.value || 'all';
    select.innerHTML = `<option value="all">${esc(allLabel)}</option>` + rows.map(item =>
      `<option value="${esc(valueOf(item))}">${esc(labelOf(item))}</option>`).join('');
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }


  function renderBars(container, entries, labelOf, countOf) {
    if (!container) return;
    const rows = [...entries].sort((a, b) => countOf(b) - countOf(a)).slice(0, 8);
    const max = Math.max(1, ...rows.map(countOf));
    container.innerHTML = rows.length ? rows.map(item => {
      const count = Number(countOf(item) || 0);
      const width = Math.max(2, Math.min(100, count / max * 100));
      return `<div class="external-bar-row"><span class="external-bar-label">${esc(labelOf(item))}</span><div class="external-bar-track"><div class="external-bar-fill" style="--bar-width:${width.toFixed(1)}%"></div></div><b class="external-bar-value">${number(count)}</b></div>`;
    }).join('') : '<span class="external-chart-empty">داده‌ای برای نمایش وجود ندارد.</span>';
  }

  function populateConfigFilters() {
    const stats = processedData?.stats || {};
    const protocols = Object.entries(stats.protocols || {}).sort((a, b) => b[1] - a[1]);
    populateSelect(refs.protocol, protocols, 'همه پروتکل‌ها', item => item[0], item => `${item[0].toUpperCase()} · ${number(item[1])}`);
    const countries = Array.isArray(stats.countries) ? stats.countries : [];
    renderBars(refs.protocolBars, protocols, item => String(item[0]).toUpperCase(), item => item[1]);
    renderBars(refs.countryBars, countries, item => `${item.flag || ''} ${item.label || item.code}`, item => item.count);
    populateSelect(refs.country, countries, 'همه کشورها', item => item.code, item => `${item.flag || ''} ${item.label || item.code} · ${number(item.count)}`);
    const sourceMap = new Map();
    for (const item of processedData?.configs || []) {
      (item.sourceIds || []).forEach((id, index) => sourceMap.set(id, (item.sourceNames || [])[index] || id));
    }
    const sources = [...sourceMap.entries()].map(([id, name]) => ({ id, name }));
    populateSelect(refs.source, sources, sources.length ? 'همه منابع' : 'منبع تاریخی در دسترس نیست', item => item.id, item => item.name);
  }

  function renderConfigCards() {
    const all = Array.isArray(processedData?.configs) ? processedData.configs : [];
    const visible = visibleConfigs();
    const pageCount = Math.max(1, Math.ceil(visible.length / CONFIG_PAGE_SIZE));
    configPage = Math.min(configPage, pageCount - 1);
    const start = configPage * CONFIG_PAGE_SIZE;
    const show = visible.slice(start, start + CONFIG_PAGE_SIZE);
    refs.configCount.textContent = `${number(visible.length)} مورد از ${number(all.length)} کانفیگ`;
    if (refs.pageInfo) refs.pageInfo.textContent = `صفحه ${number(configPage + 1)} از ${number(pageCount)} · نمایش ${number(visible.length ? start + 1 : 0)} تا ${number(Math.min(start + CONFIG_PAGE_SIZE, visible.length))}`;
    if (refs.prevPage) refs.prevPage.disabled = configPage <= 0;
    if (refs.nextPage) refs.nextPage.disabled = configPage >= pageCount - 1;
    refs.copyFiltered.disabled = visible.length === 0;
    refs.downloadFiltered.disabled = visible.length === 0;
    if (!configsLoaded || !all.length) {
      refs.configGrid.innerHTML = '<div class="external-empty"><i class="fas fa-database"></i><strong>ایندکس پردازش‌شده در دسترس نیست.</strong><span>پس از اجرای Workflow دوم، این فهرست خودکار ساخته می‌شود.</span></div>';
      return;
    }
    refs.configGrid.innerHTML = show.length ? show.map(item => {
      const line = configLines[Number(item.index)] || '';
      const sources = (item.sourceNames || []).length ? item.sourceNames.join('، ') : 'Snapshot قدیمی · منبع نامشخص';
      return `<article class="external-config-item"><div class="external-config-item-top"><span>${esc(item.countryFlag || '🏴‍☠️')}</span><strong>${esc(item.newName || `SkyBit-${item.index}`)}</strong></div>
        <div class="external-config-badges"><span class="external-config-badge">${esc(String(item.protocol || '').toUpperCase())}</span><span class="external-config-badge">${esc(item.countryLabel || 'نامشخص')}</span><span class="external-config-badge">:${esc(item.port || '—')}</span></div>
        <div class="external-config-endpoint" title="${esc(item.host || '')}">${esc(item.host || 'Host نامشخص')}</div><div class="external-config-source">منبع: ${esc(sources)}</div>
        <div class="external-config-item-actions"><button type="button" data-copy-config="${Number(item.index)}"><i class="far fa-copy"></i> کپی کانفیگ</button></div></article>`;
    }).join('') : '<div class="external-empty"><i class="fas fa-filter-circle-xmark"></i><strong>نتیجه‌ای با فیلترهای فعلی پیدا نشد.</strong><span>فیلترها را تغییر بده یا پاک کن.</span></div>';
    if (visible.length > CONFIG_PAGE_SIZE) refs.configCount.textContent += ` · خروجی کپی/دانلود شامل همه ${number(visible.length)} مورد است`;
  }

  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); return true; }
    catch {
      const field = document.createElement('textarea');
      field.value = value; field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.appendChild(field); field.select();
      const success = document.execCommand('copy'); field.remove(); return success;
    }
  }
  async function copyUrl(url) {
    refs.report.textContent = await copyText(url) ? 'لینک در کلیپ‌بورد کپی شد.' : 'کپی خودکار توسط مرورگر مسدود شد.';
  }
  function selectedText() {
    return visibleConfigs().map(item => configLines[Number(item.index)] || '').filter(Boolean).join('\n') + '\n';
  }
  function downloadText() {
    const text = selectedText();
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `External-filtered-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  async function loadReport({ quiet = false } = {}) {
    if (busy) return;
    busy = true;
    if (refs.refresh) { refs.refresh.disabled = true; refs.refresh.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i><span>در حال دریافت…</span>'; }
    if (!quiet) refs.report.textContent = 'در حال دریافت آخرین گزارش و کتابخانه…';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const [statusResponse, metaResponse, textResponse] = await Promise.all([
        fetch(`${STATUS_URL}?v=${Date.now()}`, { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } }),
        fetch(`${METADATA_URL}?v=${Date.now()}`, { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } }),
        fetch(`${EXTERNAL_FILE_URL}?v=${Date.now()}`, { cache: 'no-store', signal: controller.signal, headers: { accept: 'text/plain,*/*' } })
      ]);
      if (!statusResponse.ok) throw new Error(`Report HTTP ${statusResponse.status}`);
      reportData = await statusResponse.json();
      if (!Array.isArray(reportData.sources)) throw new Error('ساختار گزارش معتبر نیست');
      if (metaResponse.ok && textResponse.ok) {
        const [meta, text] = await Promise.all([metaResponse.json(), textResponse.text()]);
        if (!Array.isArray(meta.configs)) throw new Error('ساختار ایندکس کانفیگ معتبر نیست');
        processedData = meta;
        configLines = text.split(/\r?\n/).map(line => line.trim()).filter(line => /^(vless|vmess|trojan|ss|ssr|socks5?|hysteria2?|tuic|wireguard):\/\//i.test(line));
        configsLoaded = true;
        populateConfigFilters();
        refs.indexState.textContent = `ایندکس آماده · ${dateTime(meta.generatedAt)}`;
        refs.uniqueMetric.textContent = number(meta.stats?.processedCount || 0);
        refs.duplicateMetric.textContent = number(meta.stats?.duplicateCount || 0);
        refs.invalidMetric.textContent = number(meta.stats?.invalidCount || 0);
        refs.protocolMetric.textContent = number(Object.keys(meta.stats?.protocols || {}).length);
        refs.countryMetric.textContent = number((meta.stats?.countries || []).length);
        refs.libraryFooter.textContent = `نام‌گذاری ${meta.naming?.prefix || 'SkyBit'} · منطقه زمانی ${meta.timezone || 'Asia/Tehran'} · تولید ${dateTime(meta.generatedAt)} · ${number(configLines.length)} خط قابل استفاده${meta.sourceAttributionAvailable ? ' · انتساب منبع فعال' : ' · انتساب منبع پس از اولین دریافت تازه فعال می‌شود'}`;
        renderConfigCards();
      } else {
        configsLoaded = false;
        refs.indexState.textContent = 'ایندکس هنوز ساخته نشده';
        throw new Error(`Processed data not ready (metadata ${metaResponse.status}, External.txt ${textResponse.status})`);
      }
      renderGrid();
      refs.report.textContent = `گزارش و کتابخانه بروزرسانی شد · ${dateTime(reportData.generatedAt)}`;
    } catch (error) {
      if (!reportData) refs.grid.innerHTML = '<div class="external-empty"><i class="fas fa-triangle-exclamation"></i><strong>گزارش سلامت هنوز در دسترس نیست.</strong><span>Workflow منابع متفرقه را در GitHub Actions بررسی کن.</span></div>';
      if (reportData) renderGrid();
      refs.report.textContent = `دریافت بخشی از داده‌ها ناموفق بود · ${String(error.message || error)}`;
    } finally {
      clearTimeout(timer); busy = false;
      if (refs.refresh) { refs.refresh.disabled = false; refs.refresh.innerHTML = '<i class="fas fa-rotate"></i><span>بروزرسانی گزارش</span>'; }
    }
  }

  document.querySelectorAll('[data-external-open]').forEach(button => button.addEventListener('click', () => { setMode(true); loadReport({ quiet: true }); }));
  refs.back?.addEventListener('click', () => setMode(false));
  refs.refresh?.addEventListener('click', () => loadReport());
  refs.search?.addEventListener('input', renderGrid);
  refs.status?.addEventListener('change', renderGrid);
  refs.category?.addEventListener('change', renderGrid);
  [refs.protocol, refs.country, refs.source, refs.configSearch].forEach(control => {
    control?.addEventListener(control === refs.configSearch ? 'input' : 'change', () => { configPage = 0; renderConfigCards(); });
  });
  refs.prevPage?.addEventListener('click', () => { configPage = Math.max(0, configPage - 1); renderConfigCards(); });
  refs.nextPage?.addEventListener('click', () => { configPage += 1; renderConfigCards(); });
  refs.grid?.addEventListener('click', event => {
    const button = event.target.closest('[data-copy-url]');
    if (button) copyUrl(button.dataset.copyUrl);
  });
  refs.configGrid?.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-config]');
    if (!button) return;
    const line = configLines[Number(button.dataset.copyConfig)] || '';
    refs.configCount.textContent = line ? (await copyText(line) ? 'کانفیگ کپی شد.' : 'کپی توسط مرورگر مسدود شد.') : 'کانفیگ پیدا نشد.';
  });
  refs.aggregateCopy?.addEventListener('click', () => {
    const url = refs.aggregateCopy.dataset.copyUrl;
    if (url) copyUrl(url);
  });
  refs.copyFiltered?.addEventListener('click', async () => {
    const text = selectedText();
    refs.configCount.textContent = await copyText(text) ? `${number(visibleConfigs().length)} کانفیگ کپی شد.` : 'کپی خودکار مسدود شد.';
  });
  refs.downloadFiltered?.addEventListener('click', downloadText);
  refs.resetFilters?.addEventListener('click', () => {
    [refs.protocol, refs.country, refs.source].forEach(select => { if (select) select.value = 'all'; });
    if (refs.configSearch) refs.configSearch.value = '';
    configPage = 0;
    renderConfigCards();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) setMode(false); });
  // Reports and third-party links are fetched only after the user opens the isolated workspace.
})();
