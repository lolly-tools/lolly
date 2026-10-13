// Relay requests only from this extension's configured top-level page.
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (sender.id === chrome.runtime.id && msg?.type === 'lolly-capture/caller-check') {
    respond({ url: location.href, origin: location.origin });
  }
});

window.addEventListener('message', (event) => {
  if (window.top !== window || event.source !== window) return;
  if (!LOLLY_RELAY_ORIGINS.includes(event.origin) || location.origin !== event.origin) return;
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
        styles: resp?.styles,
        assets: resp?.assets,
        finalUrl: resp?.finalUrl,
        screenshotBase64: resp?.screenshotBase64,
        reason: err || resp?.reason,
      }, origin);
    });
  }
});
