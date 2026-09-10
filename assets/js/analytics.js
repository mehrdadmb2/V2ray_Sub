(function () {
  "use strict";
  if (window.__GPI_ATTACHED__) return;
  window.__GPI_ATTACHED__ = true;

  const cfg = window.PAGE_INSIGHTS_CONFIG || {};
  const script = document.currentScript;
  const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || "";
  const worker = String(cfg.workerUrl || script?.dataset?.workerUrl || "").replace(/\/+$/, "");
  if (!worker) return;

  const sanitizeSiteId = (v) => String(v || "").trim().toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "").slice(0, 64);

  const explicitId = script?.dataset?.siteId || meta("page-insights-site-id") || cfg.siteId || "";
  const siteId = sanitizeSiteId(explicitId) || sanitizeSiteId(location.hostname) || "unknown-site";
  const siteName = script?.dataset?.siteName || meta("page-insights-site-name") || cfg.siteName || document.title || siteId;
  const sample = Math.max(0, Math.min(1, Number(cfg.sampleRate ?? 1)));
  if (Math.random() > sample) return;

  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const read = (store, key) => { try { return store.getItem(key); } catch { return null; } };
  const write = (store, key, value) => { try { store.setItem(key, value); } catch {} };

  let visitorId = read(localStorage, `gpi:v5:visitor:${siteId}`);
  if (!visitorId) { visitorId = uid(); write(localStorage, `gpi:v5:visitor:${siteId}`, visitorId); }

  let session;
  try { session = JSON.parse(read(sessionStorage, `gpi:v5:session:${siteId}`) || "null"); } catch { session = null; }

  const now = Date.now();
  if (!session || !session.id || now - Number(session.lastSeen || 0) > 30 * 60 * 1000) {
    session = { id: uid(), lastSeen: now };
  }
  session.lastSeen = now;
  write(sessionStorage, `gpi:v5:session:${siteId}`, JSON.stringify(session));

  const state = { startedAt: now, maxScroll: 0, clicks: 0, outboundClicks: 0, ended: false };

  const conn = () => {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return c ? {
      type: c.effectiveType || c.type || "",
      downlink: c.downlink ?? null,
      rtt: c.rtt ?? null,
      saveData: !!c.saveData
    } : null;
  };

  const tz = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; }
  };

  const makePayload = (type) => ({
    siteId, siteName, eventId: uid(), type,
    sessionId: session.id, visitorId,
    timestamp: new Date().toISOString(),
    pageUrl: location.href,
    path: location.pathname + location.search,
    title: document.title || "",
    referrer: document.referrer || "",
    language: navigator.language || "",
    timezone: tz(),
    screen: {
      width: screen.width || 0,
      height: screen.height || 0,
      devicePixelRatio: devicePixelRatio || 1,
      colorDepth: screen.colorDepth || 0
    },
    viewport: { width: innerWidth || 0, height: innerHeight || 0 },
    connection: conn(),
    durationMs: Math.max(0, Date.now() - state.startedAt),
    maxScroll: state.maxScroll,
    clicks: state.clicks,
    outboundClicks: state.outboundClicks,
    metadata: {
      collector: "github-page-insights-v5",
      visibility: document.visibilityState,
      referrerPolicy: document.referrerPolicy || ""
    }
  });

  function send(type, keepalive = false) {
    if (state.ended && type !== "pageleave") return Promise.resolve(false);
    const body = JSON.stringify(makePayload(type));
    const url = `${worker}/collect`;

    if (keepalive && navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) {
          session.lastSeen = Date.now();
          write(sessionStorage, `gpi:v5:session:${siteId}`, JSON.stringify(session));
          return Promise.resolve(true);
        }
      } catch {}
    }

    const promise = fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      mode: "cors",
      credentials: "omit",
      keepalive
    }).then((response) => {
      if (!response.ok) throw new Error(`Analytics collector HTTP ${response.status}`);
      return response;
    });

    promise.catch(() => {});
    session.lastSeen = Date.now();
    write(sessionStorage, `gpi:v5:session:${siteId}`, JSON.stringify(session));
    return promise.then(() => true).catch(() => false);
  }

  function updateScroll() {
    const doc = document.documentElement;
    const total = Math.max(1, doc.scrollHeight - innerHeight);
    state.maxScroll = Math.max(state.maxScroll, Math.min(100, Math.round((scrollY / total) * 100)));
  }

  function onClick(e) {
    state.clicks++;
    const a = e.target?.closest?.("a[href]");
    if (!a) return;
    try {
      if (new URL(a.href, location.href).origin !== location.origin) state.outboundClicks++;
    } catch {}
  }

  function onVisibility() {
    if (document.hidden) send("visibility");
    else send("heartbeat");
  }

  function finish() {
    if (state.ended) return;
    state.ended = true;
    send("pageleave", true);
  }

  // The first event is intentionally exposed so the page can wait for the
  // Worker to archive it before reading the public GitHub repository.
  window.__GPI_PAGEVIEW_PROMISE__ = send("pageview");

  const heartbeatMs = Math.max(15000, Number(cfg.heartbeatMs || 30000));
  const timer = setInterval(() => {
    if (!document.hidden && !state.ended) send("heartbeat");
  }, heartbeatMs);

  addEventListener("scroll", updateScroll, { passive: true });
  addEventListener("click", onClick, { capture: true, passive: true });
  addEventListener("visibilitychange", onVisibility);
  addEventListener("pagehide", finish, { capture: true });
  addEventListener("beforeunload", finish, { capture: true });
  addEventListener("pageshow", () => { state.ended = false; });
  addEventListener("pagehide", () => clearInterval(timer), { once: true });
})();
