// SPDX-License-Identifier: MPL-2.0
/**
 * Whether the running Node carries the Brotli fix for CVE-2026-111497.
 *
 * Node ships its own Brotli decoder, native code outside any WebAssembly sandbox, and
 * `fetch` uses it on every response sent with `Content-Encoding: br`. The fix arrived
 * in Node 22.23.4, 24.22.1 and 26.12.1 (each a security release, 2026-10-20 and
 * 2026-10-21). The package's `engines` floor (>=22.18.0) still admits older releases,
 * so the terminal shells print one warning line when they run on one.
 */

/** The first release of each supported line with the fix. Lines 23 and 25 ended without one. */
export const BROTLI_FIXED_NODE: Readonly<Record<number, readonly [number, number, number]>> = Object.freeze({
  22: [22, 23, 4],
  24: [24, 22, 1],
  26: [26, 12, 1],
});

const FIXED_LIST = '22.23.4, 24.22.1 or 26.12.1';

/** The warning for `version` (process.versions.node form, "26.11.1"), or null when none is due. */
export function unpatchedNodeWarning(version: string): string | null {
  const parts = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!parts) return null;
  const [major, minor, patch] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const fixed = BROTLI_FIXED_NODE[major];
  if (fixed) {
    const below = minor < fixed[1] || (minor === fixed[1] && patch < fixed[2]);
    if (!below) return null;
    return `Warning: Node ${major}.${minor}.${patch} decodes Brotli with a flaw (CVE-2026-111497) fixed in Node ${fixed.join('.')}. Update Node to ${fixed.join('.')} or later.`;
  }
  // Lines after 26 are newer than the fix; earlier and odd-numbered lines have no fixed release.
  if (major > 26) return null;
  return `Warning: Node ${major}.${minor}.${patch} has no release with the Brotli fix for CVE-2026-111497. Use Node ${FIXED_LIST} or later.`;
}

const WARNED = Symbol.for('lolly.node-patch-level.warned');

/**
 * Print the warning once per process (a second copy of this module, as a bundled
 * worker or a duplicated chunk would load, still prints nothing more). `write` gets
 * one line; callers pass a stderr writer, never stdout, which carries the payload in
 * the CLI and the JSON-RPC channel for MCP over stdio. Returns whether it wrote.
 */
export function warnIfUnpatchedNode(write: (line: string) => void, version: string = process.versions.node): boolean {
  const flags = globalThis as unknown as Record<symbol, boolean | undefined>;
  if (flags[WARNED]) return false;
  const line = unpatchedNodeWarning(version);
  if (!line) return false;
  flags[WARNED] = true;
  write(line);
  return true;
}
