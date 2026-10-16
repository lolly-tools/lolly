// SPDX-License-Identifier: MPL-2.0
/** Native instance sign-in, shared by onboarding and the signed-out gate. */
import { getInstanceBase, setInstanceSession } from '../lib/instance.ts';
import { isTauriMobileShell } from '../lib/native-shell.ts';
import { t } from '../i18n.ts';
import { escape as escapeText } from '../utils.ts';
import { jsonBody, safeFetch } from '../lib/instance-json.ts';
const DEVICE_REQUEST_TIMEOUT_MS = 6000;

interface DeviceStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval?: number;
  expiresIn?: number;
}

/** Returns teardown; late requests cannot sign in a closed sheet or another instance. */
export function wireDeviceCodeSignIn(slot: HTMLElement, onSignedIn: () => void | Promise<void> = () => location.reload()): () => void {
  const signInBase = getInstanceBase();
  let generation = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const current = (run: number): boolean => !stopped && run === generation && slot.isConnected && getInstanceBase() === signInBase;
  const note = (msg: string): void => { slot.innerHTML = `<p role="status">${msg}</p>`; };
  const retry = (msg: string): void => {
    note(msg);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = t('Try again');
    button.addEventListener('click', () => { void start(); });
    slot.append(button);
  };

  async function start(): Promise<void> {
    const run = ++generation;
    clearTimeout(timer);
    note(t('Asking this instance for a code…'));
    const started = await jsonBody<DeviceStart>(await safeFetch('/api/v1/auth/device', { method: 'POST' }, DEVICE_REQUEST_TIMEOUT_MS));
    if (!current(run)) return;
    let verification: URL;
    try {
      verification = new URL(started?.verificationUri ?? '');
      if (verification.protocol !== 'https:' || verification.origin !== new URL(signInBase || location.href).origin
        || verification.username || verification.password || !started?.deviceCode || !started.userCode) throw new Error();
    } catch {
      retry(t('This instance did not supply a usable code sign-in. Try again or contact your workspace administrator.'));
      return;
    }
    const code = started!;
    verification.searchParams.set('code', code.userCode);
    slot.innerHTML = `
      <p>${t('Open your browser, sign in to this workspace, and approve this code:')}</p>
      <p style="font-family:ui-monospace,monospace;font-size:1.6rem;letter-spacing:.12em">${escapeText(code.userCode)}</p>
      <button type="button" class="btn btn--primary" data-device-open>${t('Open sign-in in browser')}</button>
      <p role="status" data-device-status>${t('Waiting for approval. Return to Lolly after approving the code.')}</p>
      <p>${t('Or open {url} on another device and enter the code.', { url: code.verificationUri })}</p>`;
    const status = slot.querySelector<HTMLElement>('[data-device-status]');
    slot.querySelector<HTMLButtonElement>('[data-device-open]')?.addEventListener('click', () => {
      const transport = (window as { __TAURI_INTERNALS__?: { invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> } }).__TAURI_INTERNALS__;
      if (!transport) return;
      const opening = isTauriMobileShell()
        ? transport.invoke('plugin:lolly-auth|authenticate', { url: verification.href, callbackScheme: 'tools.lolly.mobile', ephemeral: false })
        : transport.invoke('oauth_open', { raw: verification.href });
      void opening.catch((error: unknown) => {
        // Closing the mobile browser sheet returns to the app while polling continues.
        if (!current(run) || /cancelled/i.test(String(error))) return;
        if (status) status.textContent = t('Could not open the browser. Open the address above on another device.');
      });
    });
    const intervalMs = Math.max(2, Number.isFinite(code.interval) ? code.interval! : 5) * 1000;
    const deadline = Date.now() + Math.min(600, Math.max(1, Number.isFinite(code.expiresIn) ? code.expiresIn! : 600)) * 1000;
    const poll = async (): Promise<void> => {
      if (!current(run)) return;
      if (Date.now() >= deadline) { retry(t('That code expired.')); return; }
      const claim = await jsonBody<{ status: string; cookie?: string }>(await safeFetch('/api/v1/auth/device/token', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceCode: code.deviceCode }),
      }, DEVICE_REQUEST_TIMEOUT_MS));
      if (!current(run)) return;
      if (claim?.status === 'approved' && typeof claim.cookie === 'string' && /^lw_session=[^;\s]+$/.test(claim.cookie)) {
        await setInstanceSession(claim.cookie, signInBase);
        if (!current(run)) return;
        if (status) status.textContent = t('Signed in - loading…');
        await onSignedIn();
        return;
      }
      if (claim?.status === 'denied') { retry(t('That sign-in was denied from the other device.')); return; }
      if (claim?.status === 'expired') { retry(t('That code expired.')); return; }
      timer = setTimeout(() => { void poll(); }, intervalMs);
    };
    timer = setTimeout(() => { void poll(); }, intervalMs);
  }

  slot.innerHTML = `<button type="button" class="btn btn--primary" id="org-gate-device-btn" style="min-width:9rem;min-height:var(--ui-size-target)">${t('Sign in with your browser')}</button>`;
  slot.querySelector('button')?.addEventListener('click', () => { void start(); });
  return () => { stopped = true; generation++; clearTimeout(timer); };
}
