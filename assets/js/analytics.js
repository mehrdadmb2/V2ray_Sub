/* Universal Event Insights Browser SDK v10 */
(function () {
  "use strict";
  const C = window.PAGE_INSIGHTS_CONFIG || {};
  const worker = String(C.workerUrl || "").replace(/\/+$/, "");
  const meta = name => document.querySelector(`meta[name="${name}"]`)?.content || "";
  const platformId = (
    C.platformId ||
    meta("page-insights-platform-id") ||
    meta("page-insights-site-id") ||
    meta("uei-platform-id") ||
    location.hostname ||
    "web"
  ).trim();
  const platformName = (
    C.platformName ||
    meta("page-insights-platform-name") ||
    meta("page-insights-site-name") ||
    meta("uei-platform-name") ||
    platformId
  ).trim();
  const platformType = (
    C.platformType ||
    meta("page-insights-platform-type") ||
    meta("uei-platform-type") ||
    "web"
  ).trim();
  const environment = (C.environment || meta("page-insights-environment") || "production").trim();
  if (!worker || !platformId) return;

  const storageKey = `uei_v10_${platformId}`;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const queueKey = `${storageKey}_queue`;

  let pageStart = Date.now();
  let maxScroll = 0;
  let clicks = 0;
  let outboundClicks = 0;
  let lastScrollSent = 0;
  let pageLeft = false;
  const getOrCreate = (storeName, keyName) => {
    try {
      const store = storeName === "session" ? sessionStorage : localStorage;
      const current = store.getItem(`${storageKey}_${keyName}`);
      if (current) return current;
      const generated = crypto.randomUUID();
      store.setItem(`${storageKey}_${keyName}`, generated);
      return generated;
    } catch {
      return crypto.randomUUID();
    }
  };
  const visitorId = getOrCreate("local", "visitor");
  const sessionId = getOrCreate("session", "session");
  const userId = C.userId || null;
  const anonymousId = C.anonymousId || null;
  const platformIp = C.platformIp || meta("page-insights-platform-ip") || null;
  const screenInfo = {
    width: window.screen?.width || null,
    height: window.screen?.height || null,
    devicePixelRatio: window.devicePixelRatio || 1,
    colorDepth: window.screen?.colorDepth || 24
  };
  const viewport = () => ({
    width: window.innerWidth || null,
    height: window.innerHeight || null
  });
  const conn = () => ({
    effectiveType: connection?.effectiveType || null,
    type: connection?.type || null,
    downlink: connection?.downlink ?? null,
    rtt: connection?.rtt ?? null,
    saveData: Boolean(connection?.saveData)
  });
  const page = () => ({
    url: location.href,
    path: location.pathname,
    queryString: location.search.slice(1),
    title: document.title,
    referrer: document.referrer || null
  });
  const identity = () => ({ visitorId, sessionId, userId, anonymousId });
  function baseBody(eventType, data, metadata) {
    return {
      platformId,
      platformName,
      platformType,
      environment,
      appVersion: C.appVersion || null,
      platformIp,
      source: "browser",
      sdkName: "universal-event-insights-browser",
      sdkVersion: "11.0.0",
      eventType,
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      identity: identity(),
      page: page(),
      screen: screenInfo,
      viewport: viewport(),
      connection: conn(),
      durationMs: Math.max(0, Date.now() - pageStart),
      maxScroll,
      clicks,
      outboundClicks,
      data: data || {},
      metadata: metadata || {}
    };
  }
  function readQueue() {
    try {
      const value = JSON.parse(localStorage.getItem(queueKey) || "[]");
      return Array.isArray(value) ? value.slice(-20) : [];
    } catch {
      return [];
    }
  }
  function saveQueue(queue) {
    try {
      localStorage.setItem(queueKey, JSON.stringify(queue.slice(-20)));
    } catch {
      // Storage can be unavailable; telemetry still attempts direct delivery.
    }
  }
  function enqueue(body) {
    const queue = readQueue();
    queue.push(body);
    saveQueue(queue);
  }
  async function post(body, keepalive) {
    const timeout = Number(C.requestTimeoutMs || 12000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${worker}/v1/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: Boolean(keepalive),
        cache: "no-store",
        signal: controller.signal
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
  async function flushQueue() {
    const queue = readQueue();
    if (!queue.length) return;
    const remaining = [];
    for (const item of queue) {
      const ok = await post(item, false);
      if (!ok) remaining.push(item);
    }
    saveQueue(remaining);
  }
  function send(eventType, data, metadata, useBeacon) {
    const body = baseBody(eventType, data, metadata);
    if (useBeacon && navigator.sendBeacon) {
      try {
        // text/plain avoids a JSON content-type preflight during page shutdown.
        const blob = new Blob([JSON.stringify(body)], { type: "text/plain;charset=UTF-8" });
        if (navigator.sendBeacon(`${worker}/v1/events`, blob)) return;
      } catch {
        // Fall through to fetch.
      }
    }
    post(body, Boolean(useBeacon)).then(ok => {
      if (!ok) enqueue(body);
    });
  }
  function updateScroll() {
    const documentElement = document.documentElement;
    const body = document.body || {};
    const top = window.scrollY || documentElement.scrollTop || 0;
    const total = Math.max(
      documentElement.scrollHeight,
      body.scrollHeight || 0,
      documentElement.offsetHeight || 0,
      body.offsetHeight || 0
    ) - window.innerHeight;
    maxScroll = total > 0 ? Math.min(100, Math.round((top / total) * 100)) : 100;
    if (maxScroll - lastScrollSent >= 5) {
      lastScrollSent = maxScroll;
      send("scroll", { depth: maxScroll }, {});
    }
  }
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("click", event => {
    clicks += 1;
    const target = {
      tag: event.target?.tagName || null,
      id: event.target?.id || null,
      className: typeof event.target?.className === "string" ? event.target.className.slice(0, 256) : null
    };
    send("click", { target }, {}, false);
    const anchor = event.target?.closest?.("a");
    if (anchor?.href && anchor.origin !== location.origin) {
      outboundClicks += 1;
      send("outbound_click", {
        href: anchor.href,
        text: (anchor.textContent || "").trim().slice(0, 256)
      }, {}, false);
    }
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    send("visibility", { state: document.visibilityState }, {});
  });
  window.addEventListener("pagehide", () => {
    if (!pageLeft) {
      pageLeft = true;
      send("pageleave", {}, { reason: "pagehide" }, true);
    }
  });
  window.addEventListener("beforeunload", () => {
    if (!pageLeft) {
      pageLeft = true;
      send("pageleave", {}, { reason: "beforeunload" }, true);
    }
  });
  if (connection?.addEventListener) {
    connection.addEventListener("change", () => {
      send("custom", { connectionChanged: true, connection: conn() }, {});
    });
  }
  window.addEventListener("online", flushQueue);
  setInterval(flushQueue, Math.max(30000, Number(C.queueFlushMs || 60000)));
  updateScroll();
  send("pageview", {}, {});
  setInterval(() => {
    if (!pageLeft) send("heartbeat", {}, {});
  }, Math.max(15000, Number(C.heartbeatMs || 30000)));
})();
