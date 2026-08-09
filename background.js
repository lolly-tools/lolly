/**
 * Lolly URL Screenshot — background service worker.
 *
 * Two jobs, one shape: open the user's URL in an inactive background tab, take one
 * reading, close the tab in a `finally`.
 *
 * 1. `lolly-capture` — captures the page to a PNG via the DevTools Protocol
 *    (chrome.debugger), mirroring the desktop (Tauri) native path in
 *    shells/tauri-desktop/src-tauri/src/capture.rs: set the viewport + DPR, inject
 *    custom CSS, scroll, then Page.captureScreenshot with captureBeyondViewport.
 *    Returns a base64 PNG data URL.
 * 2. `lolly-capture/site` — reads the page's markup, stylesheet text and a handful
 *    of icon/logo bytes for the Lolly app's design-system website source (plan 97
 *    §9). The app parses them on-device; the extension only reads and hands back.
 *
 * This runs in the user's own browser, so reading localhost / private URLs is a
 * feature (it's their network) — we only reject non-http(s) schemes.
 */

const CDP = '1.3';

/**
 * Site read (`lolly-capture/site`) budgets. Every one of them degrades, never throws.
 *
 * Kept deliberately tight, because the wait is the risk. This worker is an MV3
 * service worker: Chrome may evict it while it is idle-waiting, and the tab
 * close lives in a `finally` that eviction skips. Two things guard that — a
 * keep-alive ticker while a read runs, and a session-recorded tab list swept on
 * the next worker start (see `sweepOrphanTabs`) — but the cheapest guard is not
 * to wait 75 seconds in the first place. Worst case here is ~50 s.
 */
const SITE_LOAD_TIMEOUT_MS = 30000;
const SITE_SETTLE_MS = 600;
const SITE_COLLECT_TIMEOUT_MS = 20000;
const SITE_CAPS = {
  /** Characters of `documentElement.outerHTML` kept (~4 MB of latin text). */
  maxHtmlChars: 4_000_000,
  /** Characters of stylesheet text kept in total, across every sheet. */
  maxCssChars: 4_000_000,
  maxSheets: 60,
  maxRulesPerSheet: 20_000,
  maxAssets: 10,
  maxAssetBytes: 2_000_000,
  maxAssetTotalBytes: 8_000_000,
  fetchTimeoutMs: 8000,
};

// ─── The tab-close guarantee ──────────────────────────────────────────────────
// Both readings promise the same thing: one inactive tab, opened for one
// reading, closed again. The close is in a `finally`, which is in-worker state —
// if Chrome evicts this service worker mid-read, the `finally` never runs and an
// inactive tab is left loaded on a third-party origin, in the user's own
// profile, still running that page's scripts, with nothing on screen to say
// Lolly opened it. That is a privacy failure, not an untidy one.
//
// So the tab id is written to session storage the moment it exists and removed
// when the tab is closed, and every start of this worker sweeps whatever is
// left over. A worker start only happens when the worker was NOT running, so a
// recorded id at that moment is by definition an orphan. Session storage (not
// local) because the list must not survive the browser: a tab id means nothing
// in the next session, and stale ids would close a tab somebody else opened.

const OPEN_TABS_KEY = 'lolly-open-tabs';

async function readOpenTabs() {
  const bag = await chrome.storage.session.get(OPEN_TABS_KEY);
  const ids = bag && bag[OPEN_TABS_KEY];
  return Array.isArray(ids) ? ids : [];
}

async function rememberTab(tabId) {
  try {
    const ids = await readOpenTabs();
    if (!ids.includes(tabId)) await chrome.storage.session.set({ [OPEN_TABS_KEY]: [...ids, tabId] });
  } catch { /* the sweep is a safety net; never let it break a reading */ }
}

async function forgetTab(tabId) {
  try {
    const ids = await readOpenTabs();
    await chrome.storage.session.set({ [OPEN_TABS_KEY]: ids.filter((id) => id !== tabId) });
  } catch { /* as above */ }
}

async function sweepOrphanTabs() {
  try {
    const ids = await readOpenTabs();
    if (!ids.length) return;
    await chrome.storage.session.set({ [OPEN_TABS_KEY]: [] });
    for (const id of ids) {
      try { await chrome.tabs.remove(id); } catch { /* already gone */ }
    }
  } catch { /* nothing to sweep, or no storage */ }
}

// Top-level, so it runs on install, on browser start, and on every revival of an
// evicted worker — which is exactly when an orphan can exist. Not awaited: a
// classic service worker script has no top-level await, and nothing below
// depends on the sweep finishing.
void sweepOrphanTabs();

/**
 * Hold the worker awake for the length of one reading.
 *
 * An MV3 worker is evicted after ~30 s with no extension-API activity, and both
 * readings spend most of their time in plain timers waiting for a page. Any
 * extension API call resets that clock, so a cheap one on a 20 s tick keeps the
 * worker (and therefore the `finally` that closes the tab) alive. Returns the
 * stop function; always call it in a `finally`.
 */
function keepWorkerAlive() {
  const timer = setInterval(() => {
    try { chrome.runtime.getPlatformInfo().catch(() => {}); } catch { /* worker going down anyway */ }
  }, 20000);
  return () => clearInterval(timer);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return; // not ours

  if (msg.type === 'lolly-capture') {
    capture(msg.spec)
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message ?? err) }));
    return true; // keep the message channel open for the async response
  }

  if (msg.type === 'lolly-capture/site') {
    readSite(msg.url, msg.options)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, reason: String(err?.message ?? err) }));
    return true;
  }
});

async function capture(spec = {}) {
  const url = String(spec.url ?? '');
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http(s) URLs can be captured.');

  const width = Math.max(1, Math.round(spec.width || 1280));
  const height = Math.max(1, Math.round(spec.height || 720));
  const dpr = spec.dpr > 0 ? spec.dpr : 1;
  const waitMs = Number.isFinite(spec.waitMs) ? Math.max(0, spec.waitMs) : 500;

  const tab = await chrome.tabs.create({ url, active: false });
  const target = { tabId: tab.id };
  await rememberTab(tab.id);
  const stopKeepAlive = keepWorkerAlive();

  try {
    await waitForComplete(tab.id);
    await chrome.debugger.attach(target, CDP);
    await send(target, 'Page.enable');
    // Drive the layout viewport + device pixel ratio (instead of the real window).
    await send(target, 'Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: dpr, mobile: false,
    });

    // Custom CSS — additive userstyles, appended so it layers over the page.
    if (typeof spec.css === 'string' && spec.css.trim()) {
      await send(target, 'Runtime.evaluate', { expression: injectCssExpr(spec.css.trim()) });
    }

    // Scroll: 0..1 fraction of the scrollable height, or a px offset when > 1.
    if (spec.scrollDepth > 0) {
      const d = spec.scrollDepth;
      const expr = d <= 1
        ? `window.scrollTo(0,(document.body.scrollHeight-window.innerHeight)*${d});`
        : `window.scrollTo(0,${d});`;
      await send(target, 'Runtime.evaluate', { expression: expr });
    }

    await sleep(waitMs);

    // captureBeyondViewport lets a tall height grab below-the-fold content; the
    // device-metrics DPR already scales resolution, so clip.scale stays 1.
    const { data } = await send(target, 'Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    return `data:image/png;base64,${data}`;
  } finally {
    stopKeepAlive();
    try { await chrome.debugger.detach(target); } catch { /* already gone */ }
    try { await chrome.tabs.remove(tab.id); } catch { /* already closed */ }
    await forgetTab(tab.id);
  }
}

function send(target, method, params) {
  return chrome.debugger.sendCommand(target, method, params || {});
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Resolve when the tab finishes loading, or after a timeout (proceed regardless —
// waitMs gives JS-heavy pages extra settle time after this).
function waitForComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timer);
      resolve();
    };
    const onUpdated = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
    chrome.tabs.onUpdated.addListener(onUpdated);
    const timer = setTimeout(finish, timeoutMs);
    chrome.tabs.get(tabId).then((t) => { if (t && t.status === 'complete') finish(); }).catch(() => {});
  });
}

function injectCssExpr(css) {
  // JSON.stringify yields a safe, fully-escaped JS string literal for the CSS.
  return `(function(){var s=document.createElement('style');s.setAttribute('data-lolly-userstyle','');s.textContent=${JSON.stringify(css)};(document.head||document.documentElement).appendChild(s);})()`;
}

// ─── Site read (lolly-capture/site) ───────────────────────────────────────────

/**
 * Read ONE first-party page for the Lolly app's design-system website source.
 *
 * The page is loaded in an inactive tab exactly as the screenshot path loads it,
 * then a single injected collector (collectSite, below) runs in the tab's isolated
 * world and returns the markup, the stylesheet text and a few icon/logo byte
 * blobs. No crawling: one URL, one tab, one reading, tab closed in the `finally`.
 *
 * Everything is capped (SITE_CAPS) and every failure inside the collector is
 * swallowed there, so a hostile or half-broken page yields partial output rather
 * than an error or a hang.
 */
async function readSite(rawUrl, options = {}) {
  const url = String(rawUrl ?? '');
  if (!/^https?:\/\//i.test(url)) throw new Error('Only http(s) URLs can be read.');

  const tab = await chrome.tabs.create({ url, active: false });
  await rememberTab(tab.id);
  const stopKeepAlive = keepWorkerAlive();

  try {
    await waitForComplete(tab.id, SITE_LOAD_TIMEOUT_MS);
    // Late webfonts and CSSOM-inserted styles land just after `complete`.
    await sleep(SITE_SETTLE_MS);

    const frames = await withTimeout(
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: collectSite,
        args: [SITE_CAPS],
      }),
      SITE_COLLECT_TIMEOUT_MS,
      'Reading the page timed out.',
    );
    const collected = frames && frames[0] && frames[0].result;
    if (!collected) throw new Error('The page returned nothing to read.');

    // The screenshot is a bonus (it feeds the colour census with the page AS
    // PAINTED, which catches canvas/webfont brands the CSS misses). It reuses the
    // DevTools path the screenshot capability already uses — no new permission —
    // and a failure here never fails the read.
    let screenshotBase64;
    if (options && options.screenshot) {
      screenshotBase64 = await screenshotTab(tab.id).catch(() => undefined);
    }

    return {
      html: collected.html || '',
      cssTexts: collected.cssTexts || [],
      assets: collected.assets || [],
      finalUrl: collected.finalUrl || url,
      screenshotBase64,
    };
  } finally {
    stopKeepAlive();
    try { await chrome.tabs.remove(tab.id); } catch { /* already closed */ }
    await forgetTab(tab.id);
  }
}

/** Page.captureScreenshot over an ALREADY-OPEN tab (the site read's bonus PNG). */
async function screenshotTab(tabId, width = 1280, height = 800, dpr = 1) {
  const target = { tabId };
  await chrome.debugger.attach(target, CDP);
  try {
    await send(target, 'Page.enable');
    await send(target, 'Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: dpr, mobile: false,
    });
    const { data } = await send(target, 'Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    return data; // bare base64, no data: prefix
  } finally {
    try { await chrome.debugger.detach(target); } catch { /* already gone */ }
  }
}

// Reject after ms. The underlying work keeps running, but the tab close in
// readSite's `finally` tears it down, so nothing is left behind.
function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

/**
 * Runs IN THE TARGET PAGE (chrome.scripting isolated world), not in this worker —
 * it is serialised by `func:`, so it may not reference anything outside itself.
 *
 * Subresource fetches are made from the page, with fetch's default
 * `credentials: 'same-origin'`: a same-origin stylesheet the page could read, we
 * can read; a cross-origin one (a CDN, fonts.googleapis.com) is fetched WITHOUT
 * cookies. Nothing is sent anywhere — the bytes go back to the Lolly tab that
 * asked, and the app parses them on-device.
 */
async function collectSite(caps) {
  const out = { html: '', cssTexts: [], assets: [], finalUrl: location.href };

  const absolute = (u) => {
    if (!u || typeof u !== 'string') return null;
    try { return new URL(u.trim(), document.baseURI).href; } catch { return null; }
  };

  const fetchCapped = async (url) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), caps.fetchTimeoutMs);
    try {
      const res = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
      if (!res.ok) return null;
      return res;
    } catch { return null; } finally { clearTimeout(timer); }
  };

  /**
   * Read a body under `cap`, refusing rather than buffering past it.
   *
   * The declared length is checked first, then every chunk as it arrives, so a
   * response with no Content-Length — or a lying one — cannot allocate past the
   * cap. This is the same shape as read_capped in the native transport
   * (each Tauri shell's src-tauri/src/site_fetch.rs), and it is the difference
   * between a cap and a post-mortem: `await res.arrayBuffer()` then checking
   * `byteLength` has already paid for every byte it is about to discard, which
   * on a page serving thirty oversize responses is thirty full downloads into
   * the memory of the browser the person is using.
   *
   * Returns null for over-cap, unreadable or aborted — one asset never fails a
   * reading.
   */
  const readCapped = async (res, cap) => {
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > cap) return null;
    if (!res.body || typeof res.body.getReader !== 'function') {
      // No stream to read (an opaque or synthetic response): the declared-length
      // check above is the only bound available, so honour the cap afterwards.
      try {
        const buffer = await res.arrayBuffer();
        return buffer.byteLength > cap ? null : new Uint8Array(buffer);
      } catch { return null; }
    }
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > cap) {
          try { await reader.cancel(); } catch { /* the socket is going anyway */ }
          return null;
        }
        chunks.push(value);
      }
    } catch { return null; }
    // `merged`, not `out` — the collector's accumulator is called that, and
    // shadowing it inside the one helper that returns bytes is a trap.
    const merged = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      merged.set(chunk, at);
      at += chunk.byteLength;
    }
    return merged;
  };

  const toBase64 = (bytes) => {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  };

  // ── Markup ──
  try {
    const html = document.documentElement ? document.documentElement.outerHTML : '';
    out.html = html.length > caps.maxHtmlChars ? html.slice(0, caps.maxHtmlChars) : html;
  } catch { /* leave html empty */ }

  // ── Stylesheets ──
  let cssBudget = caps.maxCssChars;
  const pushCss = (text) => {
    if (!text || cssBudget <= 0) return;
    const slice = text.length > cssBudget ? text.slice(0, cssBudget) : text;
    cssBudget -= slice.length;
    out.cssTexts.push(slice);
  };

  const deferredHrefs = [];
  let sheets = [];
  try { sheets = Array.prototype.slice.call(document.styleSheets, 0, caps.maxSheets); } catch { sheets = []; }

  for (const sheet of sheets) {
    if (cssBudget <= 0) break;
    let href = null;
    let inlineStyleElement = false;
    try {
      href = sheet.href || null;
      const owner = sheet.ownerNode;
      inlineStyleElement = !href && !!owner && owner.nodeName === 'STYLE';
    } catch { /* treat as unreadable */ }

    // An inline <style> is already inside the HTML above, so serialising it here
    // would double-count every declaration in the census. Only sheets the markup
    // does NOT carry are collected: external ones, and constructed / adopted
    // sheets (no owner node), which exist only in the CSSOM.
    if (inlineStyleElement) continue;

    let rules = null;
    try { rules = sheet.cssRules; } catch { rules = null; } // cross-origin: opaque
    if (rules) {
      let text = '';
      const n = Math.min(rules.length, caps.maxRulesPerSheet);
      for (let i = 0; i < n && text.length < cssBudget; i++) {
        try { text += `${rules[i].cssText}\n`; } catch { /* skip one rule */ }
      }
      pushCss(text);
    } else if (href) {
      deferredHrefs.push(href);
    }
  }

  // The opaque ones: fetch the file the page itself already loaded. Capped as
  // it streams, at whatever is left of the budget — a 200 MB "stylesheet" costs
  // the bytes up to the cap and then nothing.
  for (const href of deferredHrefs) {
    if (cssBudget <= 0) break;
    const res = await fetchCapped(href);
    if (!res) continue;
    const bytes = await readCapped(res, cssBudget);
    if (!bytes) continue;
    try { pushCss(new TextDecoder().decode(bytes)); } catch { /* skip one sheet */ }
  }

  // ── Icon / logo candidates ──
  // Ordered by how likely each is to BE the logo, because only the first
  // caps.maxAssets survive. The app re-derives its own candidate list from the
  // markup; these bytes are keyed by URL, so anything unmatched is simply unused.
  const seen = new Set();
  const candidates = [];
  const addCandidate = (raw) => {
    if (candidates.length >= caps.maxAssets * 3) return;
    const url = absolute(raw);
    // data: URLs are already carried inside the markup; refetching them here
    // would just duplicate bytes we have.
    if (!url || !/^https?:/i.test(url) || seen.has(url)) return;
    seen.add(url);
    candidates.push(url);
  };
  const each = (selector, read) => {
    let nodes = [];
    try { nodes = Array.prototype.slice.call(document.querySelectorAll(selector), 0, 60); } catch { return; }
    for (const node of nodes) {
      try { addCandidate(read(node)); } catch { /* skip one node */ }
    }
  };

  each('link[rel~="apple-touch-icon"], link[rel~="apple-touch-icon-precomposed"], link[rel~="mask-icon"]', (n) => n.getAttribute('href'));
  each('link[rel~="icon"], link[rel~="shortcut"]', (n) => n.getAttribute('href'));
  each('header img, [role="banner"] img, nav img, a[href="/"] img', (n) => n.currentSrc || n.getAttribute('src'));
  each('img[class*="logo" i], img[id*="logo" i], img[alt*="logo" i], img[src*="logo" i], img[class*="brand" i], img[src*="wordmark" i]', (n) => n.currentSrc || n.getAttribute('src'));
  each('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"], meta[property="twitter:image"]', (n) => n.getAttribute('content'));

  let assetBudget = caps.maxAssetTotalBytes;
  let attempts = 0;
  for (const url of candidates) {
    if (out.assets.length >= caps.maxAssets || assetBudget <= 0) break;
    // Bound the WORK, not only the output. The candidate list runs to
    // maxAssets * 3, so without this a page that answers every one of them with
    // something unusable costs thirty round trips to keep nothing.
    if (++attempts > caps.maxAssets * 2) break;
    const res = await fetchCapped(url);
    if (!res) continue;
    // The cap is enforced ON THE WAY IN, so an oversize icon costs the first
    // maxAssetBytes and then a cancelled socket — never a full download that is
    // measured and thrown away.
    const bytes = await readCapped(res, Math.min(caps.maxAssetBytes, assetBudget));
    if (!bytes || !bytes.length) continue;
    assetBudget -= bytes.length;
    out.assets.push({
      url,
      mime: (res.headers.get('content-type') || '').split(';')[0].trim(),
      bytesBase64: toBase64(bytes),
    });
  }

  return out;
}
