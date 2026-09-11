/**
 * Lolly URL Screenshot — isolated-world content script (relay).
 *
 * Relays both readings the background worker offers — `capture` (a PNG of a page)
 * and `lolly-capture/site` (a page's markup, stylesheets and icon bytes) — between
 * the Lolly web page and the extension background:
 *   page  ⇄ content  via window.postMessage (crosses the isolated/main boundary)
 *   content ⇄ background via chrome.runtime messaging (extension APIs)
 *
 * The page never needs the extension id, and we avoid externally_connectable.
 */

// Origins allowed to drive the relay. Mirrors manifest.json content_scripts
// matches — defence in depth on top of `event.source === window`, so a frame
// or opener on another origin can never reach the debugger-backed capture path
// (SUSE assessment 2026-08, S1a).
const ALLOWED_ORIGINS = /^(http:\/\/localhost:5173|https:\/\/lolly\.tools|https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.lolly\.tools)$/;

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!ALLOWED_ORIGINS.test(event.origin)) return;
  const msg = event.data;
  if (!msg || msg.source !== 'lolly-capture/page') return;

  if (msg.type === 'ping') {
    window.postMessage({ source: 'lolly-capture/ext', type: 'pong' }, event.origin);
    return;
  }

  if (msg.type === 'capture') {
    const origin = event.origin;
    chrome.runtime.sendMessage({ type: 'lolly-capture', spec: msg.spec }, (resp) => {
      const err = chrome.runtime.lastError?.message;
      window.postMessage({
        source: 'lolly-capture/ext',
        type: 'result',
        id: msg.id,
        ok: !err && !!resp?.ok,
        dataUrl: resp?.dataUrl,
        error: err || resp?.error,
      }, origin);
    });
    return;
  }

  // Site read (design-system website source). Same relay shape as capture, one
  // request id, one reply. The reply carries a whole page's markup, so it is
  // posted back to the exact origin this request came from rather than '*' —
  // the origin is already validated above, and nothing else needs to see it.
  if (msg.type === 'lolly-capture/site') {
    const origin = event.origin;
    chrome.runtime.sendMessage({ type: 'lolly-capture/site', url: msg.url, options: msg.options }, (resp) => {
      const err = chrome.runtime.lastError?.message;
      window.postMessage({
        source: 'lolly-capture/ext',
        type: 'lolly-capture/site-result',
        requestId: msg.requestId,
        ok: !err && !!resp?.ok,
        html: resp?.html,
        cssTexts: resp?.cssTexts,
        assets: resp?.assets,
        finalUrl: resp?.finalUrl,
        screenshotBase64: resp?.screenshotBase64,
        reason: err || resp?.reason,
      }, origin);
    });
  }
});
