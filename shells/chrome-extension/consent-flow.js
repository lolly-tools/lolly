// SPDX-License-Identifier: MPL-2.0
const CONSENT_TIMEOUT_MS = 30_000;
const READING_TIMEOUT_MS = 55_000;
let pendingReading = null;

function httpTarget(raw) {
  const url = new URL(String(raw ?? ''));
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.length > 8192) {
    throw new Error('Choose an http(s) URL without a username or password.');
  }
  return url;
}

function relayCaller(sender) {
  if (sender?.id !== chrome.runtime.id || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id)
    || typeof sender.documentId !== 'string' || !sender.documentId || sender.documentLifecycle !== 'active') {
    throw new Error('This request did not come from an active Lolly page.');
  }
  const page = httpTarget(sender.url);
  if (!LOLLY_RELAY_ORIGINS.includes(sender.origin) || page.origin !== sender.origin || sender.tab.url !== page.href) {
    throw new Error('This requesting page is not allowed.');
  }
  return { tabId: sender.tab.id, documentId: sender.documentId, origin: sender.origin, url: page.href };
}

function assertReading(request, phase) {
  if (pendingReading !== request || request.done || (phase && request.phase !== phase) || Date.now() >= request.expiresAt) {
    throw new Error('This page request has ended. Start a new request in Lolly.');
  }
}

async function assertCallerPresent(request) {
  assertReading(request);
  const tab = await chrome.tabs.get(request.caller.tabId);
  if (tab.url !== request.caller.url) throw new Error('The requesting page changed. Start a new request in Lolly.');
  const reply = await chrome.tabs.sendMessage(request.caller.tabId, { type: 'lolly-capture/caller-check' }, {
    documentId: request.caller.documentId, frameId: 0,
  });
  assertReading(request);
  if (reply?.url !== request.caller.url || reply.origin !== request.caller.origin) {
    throw new Error('The requesting page changed. Start a new request in Lolly.');
  }
}

function finishReading(request, result) {
  if (request.done) return;
  request.done = true;
  clearTimeout(request.timer);
  request.stopKeepAlive();
  if (pendingReading === request) pendingReading = null;
  if (Number.isInteger(request.windowId)) void chrome.windows.remove(request.windowId).catch(() => {});
  if (Number.isInteger(request.targetTabId)) void chrome.tabs.remove(request.targetTabId).catch(() => {});
  request.respond(result);
}

function refuseReading(request, error) {
  const message = String(error?.message ?? error);
  finishReading(request, { ok: false, error: message, reason: message });
}

async function askForReading(msg, sender, respond) {
  const caller = relayCaller(sender);
  const target = httpTarget(msg.type === 'lolly-capture' ? msg.spec?.url : msg.url);
  if (pendingReading) throw new Error('Another page request is waiting or running. Finish that request first.');
  const request = {
    id: crypto.randomUUID(), caller, target: target.href, targetOrigin: target.origin,
    permissionPattern: `${target.protocol}//${target.hostname}/*`,
    type: msg.type, spec: Object.freeze({ ...(msg.spec ?? {}), url: target.href }),
    options: Object.freeze({ screenshot: msg.options?.screenshot === true }),
    phase: 'waiting', done: false, respond, expiresAt: Date.now() + CONSENT_TIMEOUT_MS,
    windowId: null, consentTabId: null, consentDocumentId: null, targetTabId: null,
    stopKeepAlive: keepWorkerAlive(),
  };
  pendingReading = request;
  request.timer = setTimeout(() => refuseReading(request, new Error('Approval timed out. Start a new request in Lolly.')), CONSENT_TIMEOUT_MS);
  try {
    await assertCallerPresent(request);
    request.consentUrl = `${chrome.runtime.getURL('consent.html')}?request=${encodeURIComponent(request.id)}`;
    const win = await chrome.windows.create({ url: request.consentUrl, type: 'popup', focused: true, width: 520, height: 520 });
    request.windowId = win.id;
    request.consentTabId = win.tabs?.[0]?.id ?? (await chrome.tabs.query({ windowId: win.id }))[0]?.id;
    assertReading(request, 'waiting');
    if (!Number.isInteger(request.consentTabId)) throw new Error('The approval window could not be opened.');
  } catch (error) {
    if (request.done && Number.isInteger(request.windowId)) void chrome.windows.remove(request.windowId).catch(() => {});
    refuseReading(request, error);
  }
}

function consentRequest(msg, sender) {
  const request = pendingReading;
  if (!request || request.id !== msg.requestId) throw new Error('This approval is no longer available.');
  assertReading(request, 'waiting');
  const origin = chrome.runtime.getURL('').replace(/\/$/, '');
  if (sender?.id !== chrome.runtime.id || sender.origin !== origin || sender.url !== request.consentUrl
    || sender.frameId !== 0 || sender.tab?.id !== request.consentTabId || sender.tab?.windowId !== request.windowId
    || typeof sender.documentId !== 'string' || !sender.documentId || sender.documentLifecycle !== 'active') {
    throw new Error('Use the extension approval window for this request.');
  }
  if (request.consentDocumentId && request.consentDocumentId !== sender.documentId) throw new Error('The approval page changed.');
  request.consentDocumentId = sender.documentId;
  return request;
}

async function approveReading(request) {
  assertReading(request, 'waiting');
  request.phase = 'approving';
  try {
    await assertCallerPresent(request);
    const allowed = await chrome.permissions.contains({ origins: [request.permissionPattern] });
    assertReading(request, 'approving');
    if (!allowed) throw new Error('Access to the requested site was not granted.');
    request.phase = 'running';
    clearTimeout(request.timer);
    request.expiresAt = Date.now() + READING_TIMEOUT_MS;
    request.timer = setTimeout(() => refuseReading(request, new Error('Reading the page timed out.')), READING_TIMEOUT_MS);
    const windowId = request.windowId;
    request.windowId = null;
    if (Number.isInteger(windowId)) await chrome.windows.remove(windowId).catch(() => {});
    assertReading(request, 'running');
    const result = request.type === 'lolly-capture'
      ? { dataUrl: await capture(request.spec, request) }
      : await readSite(request.target, request.options, request);
    await assertCallerPresent(request);
    assertReading(request, 'running');
    finishReading(request, { ok: true, ...result });
  } catch (error) { refuseReading(request, error); }
}

async function assertTargetPresent(request, tabId) {
  assertReading(request, 'running');
  const tab = await chrome.tabs.get(tabId);
  if (httpTarget(tab.url).origin !== request.targetOrigin || (tab.pendingUrl && httpTarget(tab.pendingUrl).origin !== request.targetOrigin)) {
    throw new Error('The page moved to another site. Request the new URL in Lolly.');
  }
  assertReading(request, 'running');
}

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg?.type === 'lolly-capture' || msg?.type === 'lolly-capture/site') {
    askForReading(msg, sender, respond).catch(error => respond({ ok: false, error: String(error.message), reason: String(error.message) }));
    return true;
  }
  if (!['lolly-capture/consent', 'lolly-capture/approve', 'lolly-capture/cancel'].includes(msg?.type)) return;
  try {
    const request = consentRequest(msg, sender);
    if (msg.type === 'lolly-capture/consent') {
      respond({ ok: true, requestId: request.id, origin: request.caller.origin, target: request.target,
        reading: request.type === 'lolly-capture' ? 'screenshot' : 'page contents',
        permissionPattern: request.permissionPattern, expiresAt: request.expiresAt });
    } else if (msg.type === 'lolly-capture/cancel') {
      refuseReading(request, new Error('The page request was canceled.'));
      respond({ ok: true });
    } else {
      void approveReading(request);
      respond({ ok: true });
    }
  } catch (error) { respond({ ok: false, error: String(error.message) }); }
});

chrome.windows.onRemoved.addListener(windowId => {
  const request = pendingReading;
  if (request?.windowId === windowId) refuseReading(request, new Error('The approval window was closed.'));
});
chrome.tabs.onRemoved.addListener(tabId => {
  const request = pendingReading;
  if (request && (request.caller.tabId === tabId || request.targetTabId === tabId)) {
    refuseReading(request, new Error('The page request was closed.'));
  }
});
chrome.tabs.onUpdated.addListener((tabId, info) => {
  const request = pendingReading;
  if (!request || !info.url) return;
  try {
    if ((request.caller.tabId === tabId && info.url !== request.caller.url)
      || (request.targetTabId === tabId && httpTarget(info.url).origin !== request.targetOrigin)) {
      refuseReading(request, new Error('A page changed while this request was open. Start a new request in Lolly.'));
    }
  } catch (error) { refuseReading(request, error); }
});
