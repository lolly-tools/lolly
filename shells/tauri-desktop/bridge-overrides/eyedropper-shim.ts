// SPDX-License-Identifier: MPL-2.0
/**
 * A window.EyeDropper for the Tauri WebViews (plans/174 #4), backed by the XDG
 * PickColor portal (src-tauri desktop_pick_color).
 *
 * components/color-field.ts:1832 and lib/design-system/add-color.ts both
 * feature-detect `window.EyeDropper` and REMOVE their eyedropper buttons where
 * it is absent - the color-field comment names "the Tauri WebViews" as exactly
 * that case. Satisfying the detect is the whole integration: both buttons light
 * up with zero call-site edits, and they gain something the web version never
 * had - the portal picks from THE WHOLE SCREEN, any window, not just the page.
 *
 * Failure shapes match the native API the call sites already handle: a portal
 * cancel/absence rejects (like the user pressing Esc on Chromium's picker), so
 * no caller needs to learn a second error grammar. On non-Linux the command
 * answers Err("unsupported") and the constructor is simply not installed -
 * detect stays honest, buttons stay removed.
 */

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function tauriInvoke(): Invoke | null {
  const internals = (globalThis as { __TAURI_INTERNALS__?: { invoke?: unknown } }).__TAURI_INTERNALS__;
  const invoke = internals?.invoke;
  return typeof invoke === 'function' ? (invoke as Invoke) : null;
}

class PortalEyeDropper {
  async open(): Promise<{ sRGBHex: string }> {
    const invoke = tauriInvoke();
    if (!invoke) throw new DOMException('EyeDropper unavailable', 'NotSupportedError');
    const hex = await invoke('desktop_pick_color').catch((e: unknown) => {
      // Portal cancel and portal absence both land here; AbortError is what the
      // native API throws on cancel, and every call site treats it as "never mind".
      throw new DOMException(String((e as Error)?.message ?? e), 'AbortError');
    });
    if (typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      throw new DOMException('picker returned no colour', 'AbortError');
    }
    return { sRGBHex: hex.toLowerCase() };
  }
}

/** Install once, only where the real API is absent, Tauri is present, and the
 *  webview reports Linux (the portal exists nowhere else, and a button that
 *  always cancels on macOS/Windows would be exactly the dead control
 *  color-field.ts removes buttons to avoid). */
export function installEyeDropperShim(): void {
  const w = globalThis as { EyeDropper?: unknown };
  if (typeof w.EyeDropper === 'function') return; // a real one exists - never shadow it
  if (!tauriInvoke()) return;
  if (!/Linux/i.test(globalThis.navigator?.userAgent ?? '')) return;
  w.EyeDropper = PortalEyeDropper;
}

installEyeDropperShim();
