// SPDX-License-Identifier: MPL-2.0
/**
 * What every "share a link" needs: the origin a link should use, and a copy to the
 * clipboard that still works where the clipboard API is refused.
 */
import { t } from '../i18n.ts';

/**
 * The origin for a link meant for someone else. A packaged Tauri page lives at
 * http://tauri.localhost, an internal WebView origin and not a link another person can
 * open, so the desktop app shares the public address instead.
 */
export function shareOrigin(): string {
  const native = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  return native ? 'https://lolly.tools' : window.location.origin;
}

/** Copy `text` to the clipboard, falling back to a hidden text field where the clipboard API is refused. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const previousFocus = document.activeElement as HTMLElement | null;
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    Object.assign(ta.style, { position: 'fixed', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(ta);
    try {
      ta.select();
      if (!document.execCommand?.('copy')) throw new Error(t('Could not copy to the clipboard.'));
    } finally {
      ta.remove();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    }
  }
}
