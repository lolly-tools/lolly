// SPDX-License-Identifier: MPL-2.0
const requestId = new URL(location.href).searchParams.get('request');
const approve = document.getElementById('approve');
const cancel = document.getElementById('cancel');
const status = document.getElementById('status');
let currentRequest = null;

async function loadRequest() {
  const reply = await chrome.runtime.sendMessage({ type: 'lolly-capture/consent', requestId });
  if (!reply?.ok) throw new Error(reply?.error || 'This request has ended.');
  currentRequest = reply;
  document.getElementById('caller').textContent = reply.origin;
  document.getElementById('target').textContent = reply.target;
  document.getElementById('reading').textContent = reply.reading;
  status.textContent = 'Approve within 30 seconds or start a new request.';
  approve.disabled = false;
}
void loadRequest().catch(error => { status.textContent = String(error.message); });

approve.addEventListener('click', event => {
  if (!event.isTrusted || !currentRequest || Date.now() >= currentRequest.expiresAt || approve.disabled) return;
  approve.disabled = true;
  cancel.disabled = true;
  chrome.permissions.request({ origins: [currentRequest.permissionPattern] }, granted => {
    const error = chrome.runtime.lastError?.message;
    void chrome.runtime.sendMessage({ type: granted && !error ? 'lolly-capture/approve' : 'lolly-capture/cancel', requestId })
      .then(reply => {
        if (reply?.ok) {
          if (!granted || error) window.close();
          else status.textContent = 'Reading the approved page...';
        }
        else status.textContent = reply?.error || 'This request has ended.';
      }).catch(failure => { status.textContent = String(failure.message); });
  });
});
cancel.addEventListener('click', event => {
  if (!event.isTrusted) return;
  void chrome.runtime.sendMessage({ type: 'lolly-capture/cancel', requestId }).finally(() => window.close());
});
