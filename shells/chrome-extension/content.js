/**
 * Lolly URL Screenshot — isolated-world content script (relay).
 *
 * Bridges the Lolly web page and the extension background:
 *   page  ⇄ content  via window.postMessage (crosses the isolated/main boundary)
 *   content ⇄ background via chrome.runtime messaging (extension APIs)
 *
 * The page never needs the extension id, and we avoid externally_connectable.
 */

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg.source !== 'lolly-capture/page') return;

  if (msg.type === 'ping') {
    window.postMessage({ source: 'lolly-capture/ext', type: 'pong' }, '*');
    return;
  }

  if (msg.type === 'capture') {
    chrome.runtime.sendMessage({ type: 'lolly-capture', spec: msg.spec }, (resp) => {
      const err = chrome.runtime.lastError?.message;
      window.postMessage({
        source: 'lolly-capture/ext',
        type: 'result',
        id: msg.id,
        ok: !err && !!resp?.ok,
        dataUrl: resp?.dataUrl,
        error: err || resp?.error,
      }, '*');
    });
  }
});
