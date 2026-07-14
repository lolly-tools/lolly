// SPDX-License-Identifier: MPL-2.0
/**
 * Reversible, filesystem-safe token codec — pure string logic, no storage, DOM,
 * or platform coupling (it just maps a string to a safe token and back).
 *
 * The filesystem-backed state bridges (Tauri desktop/mobile) name each saved
 * session `<token>.json`, where the token must be:
 *   - INJECTIVE: distinct slot names → distinct tokens. The old
 *     `slot.replace(/[^\w.-]/g, '_')` was not — "Q3 Report", "Q3/Report",
 *     "Q3+Report" and "Q3_Report" all collapsed onto one file and silently
 *     overwrote each other (the P0-4 data-loss bug);
 *   - filesystem-safe on every OS: no `/ \ : * ? " < > |`, and no way to escape
 *     the storage directory; and
 *   - reversible, so the exact slot can always be recovered from the token.
 *
 * Percent-encoding over a conservative allowlist gives all three. The shells
 * compose this with their storage layout (directory + ".json"); the codec stays
 * platform-agnostic and unit-testable, and lives in one place so the desktop and
 * mobile bridges can't drift apart again.
 */

// Universally-legal, unreserved filename characters. Everything else (space, /,
// +, %, and every non-ASCII byte) is percent-encoded as %XX over its UTF-8
// bytes. `%` itself is NOT in the set, so it always encodes — keeping decoding
// unambiguous.
const SAFE = /[A-Za-z0-9\-_.]/;

export function encodeFsToken(name: string): string {
  const bytes = new TextEncoder().encode(String(name));
  let out = '';
  for (const b of bytes) {
    const c = String.fromCharCode(b);
    out += SAFE.test(c) ? c : '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

export function decodeFsToken(token: string): string {
  return decodeURIComponent(token);
}
