/**
 * Lolly URL Screenshot — background service worker.
 *
 * Captures a URL to a PNG via the DevTools Protocol (chrome.debugger), mirroring
 * the desktop (Tauri) native path in shells/tauri-desktop/src-tauri/src/capture.rs:
 * open the URL in a background tab, set the viewport + DPR, inject custom CSS,
 * scroll, then Page.captureScreenshot with captureBeyondViewport. Returns a
 * base64 PNG data URL.
 *
 * This runs in the user's own browser, so capturing localhost / private URLs is a
 * feature (it's their network) — we only reject non-http(s) schemes.
 */

const CDP = '1.3';

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'lolly-capture') return; // not ours
  capture(msg.spec)
    .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
    .catch((err) => sendResponse({ ok: false, error: String(err?.message ?? err) }));
  return true; // keep the message channel open for the async response
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
    try { await chrome.debugger.detach(target); } catch { /* already gone */ }
    try { await chrome.tabs.remove(tab.id); } catch { /* already closed */ }
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
