// SPDX-License-Identifier: MPL-2.0
/** Native shell detection without the first-run UI dependency. */
/** True inside any Tauri shell (desktop or mobile) - same feature-detect
 *  lib/instance.ts's own (unexported) hasTauriInternals() uses. */
export function isTauriShell(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__?.invoke === 'function';
}

/**
 * True inside the Tauri MOBILE shell (iOS or Android). The mobile build sets
 * VITE_LOLLY_APP_SHELL; the user-agent test covers a mobile build made before
 * that value existed. iPadOS WebKit reports a Mac user agent, so a Mac user
 * agent with multi-touch counts as mobile too.
 */
export function isTauriMobileShell(): boolean {
  if (!isTauriShell()) return false;
  const shell = import.meta.env?.VITE_LOLLY_APP_SHELL;
  if (shell) return shell === 'tauri-mobile';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /Android|iPhone|iPad|iPod/.test(ua)
    || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
}
