// SPDX-License-Identifier: MPL-2.0
/**
 * "Sign in to a site" - the authenticated-capture affordance for a tool that declares
 * the `capture` capability (url-shot). Desktop only.
 *
 * Many pages worth screenshotting sit behind a login or a client-side setting. The
 * native capture (headless Chrome, `capture.rs`) shares ONE persistent Chrome profile:
 * this panel opens a VISIBLE window on that profile at the tool's URL so the user can
 * log in / accept cookies / arrange the view once, and every later screenshot RIDES
 * that session. "Clear saved sign-ins" wipes the profile (a full sign-out).
 *
 * Pure SHELL chrome, like live-controls - the TOOL never sees any of it (a tool hook
 * can't drive a multi-step interactive login) and it reaches the native commands the
 * way nearby/collab do: the `__TAURI_INTERNALS__.invoke` global, never an
 * `@tauri-apps/api` import that would break the web build. On the web PWA (no capture
 * at all) and any non-capture tool the panel simply never mounts.
 */
import { tauriInvoke } from '../lib/nearby-boot.ts';
import { icon } from '../lib/icons.ts';

interface SigninRuntime {
  manifest: { capabilities?: string[] };
  getModel: () => Array<{ id: string; value: unknown }>;
}

export interface CaptureSigninDeps {
  /** The sidebar inputs container; the panel mounts as its next sibling so an input
   *  rebuild (which clears this element's children) never removes it. */
  inputsEl: HTMLElement;
  runtime: SigninRuntime;
  t: (key: string) => string;
  announce?: (msg: string) => void;
}

/** Mount the panel if this is a capture tool on a shell with the native sign-in
 *  window. No-op otherwise (wrong tool, or the web/PWA build). Idempotent. */
export function mountCaptureSignin({ inputsEl, runtime, t, announce }: CaptureSigninDeps): void {
  if (!runtime.manifest.capabilities?.includes('capture')) return;
  const invoke = tauriInvoke();
  if (!invoke) return; // not the desktop shell - no native sign-in window
  const parent = inputsEl.parentElement;
  if (!parent || parent.querySelector('[data-capture-signin]')) return; // idempotent

  injectStyleOnce(inputsEl.ownerDocument);

  const currentUrl = (): string => {
    const v = runtime.getModel().find((i) => i.id === 'url')?.value;
    return typeof v === 'string' ? v.trim() : '';
  };

  const panel = inputsEl.ownerDocument.createElement('section');
  panel.className = 'capture-signin';
  panel.setAttribute('data-capture-signin', '');

  const head = inputsEl.ownerDocument.createElement('div');
  head.className = 'capture-signin-head';
  head.innerHTML = `${icon('shieldCheck', { size: 15 })}<span>${t('Behind a sign-in?')}</span>`;

  const help = inputsEl.ownerDocument.createElement('p');
  help.className = 'capture-signin-help';
  help.textContent = t(
    'Open the page in a real browser, sign in or set it up, then close it. Every screenshot after that uses your session.',
  );

  const signInBtn = inputsEl.ownerDocument.createElement('button');
  signInBtn.type = 'button';
  signInBtn.className = 'capture-signin-btn capture-signin-primary';
  signInBtn.innerHTML = `${icon('externalLink', { size: 15 })}<span>${t('Sign in to this site')}</span>`;

  const status = inputsEl.ownerDocument.createElement('div');
  status.className = 'capture-signin-status';
  status.hidden = true;

  const clearBtn = inputsEl.ownerDocument.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'capture-signin-btn capture-signin-clear';
  clearBtn.innerHTML = `${icon('trash', { size: 14 })}<span>${t('Clear saved sign-ins')}</span>`;
  clearBtn.hidden = true;

  panel.append(head, help, signInBtn, status, clearBtn);
  inputsEl.after(panel);

  // Reflect whether a session browser is live; safe if the query ever fails.
  const refreshStatus = async (): Promise<void> => {
    let active = false;
    try {
      active = (await invoke('capture_session_active')) === true;
    } catch {
      /* leave as inactive */
    }
    status.hidden = !active;
    clearBtn.hidden = !active;
    if (active) {
      status.innerHTML = `${icon('check', { size: 14 })}<span>${t('Signed-in session active - screenshots use it')}</span>`;
    }
  };

  signInBtn.addEventListener('click', () => {
    const url = currentUrl();
    if (!url) {
      announce?.(t('Enter a URL first.'));
      signInBtn.animate(
        [{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
        { duration: 180, iterations: 1 },
      );
      return;
    }
    signInBtn.disabled = true;
    void invoke('capture_signin_open', { url })
      .then(() => {
        announce?.(t('Signed-in browser opened - log in, then come back and export.'));
        return refreshStatus();
      })
      .catch((e: unknown) => announce?.(String((e as Error)?.message ?? e)))
      .finally(() => {
        signInBtn.disabled = false;
      });
  });

  clearBtn.addEventListener('click', () => {
    clearBtn.disabled = true;
    void invoke('capture_clear_session')
      .then(() => {
        announce?.(t('Saved sign-ins cleared.'));
        return refreshStatus();
      })
      .catch((e: unknown) => announce?.(String((e as Error)?.message ?? e)))
      .finally(() => {
        clearBtn.disabled = false;
      });
  });

  void refreshStatus();
}

/** One scoped stylesheet for every mount. Chrome font sizes ride `--a11y-fs` per the
 *  accessibility type-scale contract; colours use the shell's own tokens so the panel
 *  is theme-aware in light and dark without its own palette. */
function injectStyleOnce(doc: Document): void {
  if (doc.getElementById('capture-signin-style')) return;
  const style = doc.createElement('style');
  style.id = 'capture-signin-style';
  style.textContent = `
.capture-signin {
  margin: 12px 0 4px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius, 10px);
  background: var(--card);
  color: var(--card-foreground, var(--foreground));
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.capture-signin-head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 600;
  font-size: calc(13px * var(--a11y-fs, 1));
}
.capture-signin-head svg { width: calc(15px * var(--a11y-fs, 1)); height: calc(15px * var(--a11y-fs, 1)); flex: none; }
.capture-signin-help {
  margin: 0;
  font-size: calc(12px * var(--a11y-fs, 1));
  line-height: 1.4;
  color: var(--muted-foreground);
}
.capture-signin-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 10px;
  border-radius: calc(var(--radius, 10px) - 3px);
  border: 1px solid var(--border);
  font-size: calc(12.5px * var(--a11y-fs, 1));
  font-weight: 550;
  cursor: pointer;
  background: var(--secondary, transparent);
  color: inherit;
}
.capture-signin-btn svg { width: calc(15px * var(--a11y-fs, 1)); height: calc(15px * var(--a11y-fs, 1)); flex: none; }
.capture-signin-btn:hover { border-color: var(--ring, var(--accent)); }
.capture-signin-btn:disabled { opacity: .55; cursor: default; }
.capture-signin-primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: transparent;
}
.capture-signin-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: calc(12px * var(--a11y-fs, 1));
  color: var(--muted-foreground);
}
.capture-signin-status svg { width: calc(14px * var(--a11y-fs, 1)); height: calc(14px * var(--a11y-fs, 1)); flex: none; }
.capture-signin-clear { color: var(--destructive, inherit); }
`;
  (doc.head || doc.documentElement).appendChild(style);
}
