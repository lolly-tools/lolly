// SPDX-License-Identifier: MPL-2.0
/**
 * The oldest Node that Lolly's terminal shells accept, and the refusal they give below that floor.
 *
 * Node ships its own Brotli decoder, native code outside any WebAssembly sandbox, and
 * `fetch` uses it on every response sent with `Content-Encoding: br`. CVE-2026-111497,
 * an out-of-bounds write in that decoder, is fixed in Node 22.23.4, 24.22.1 and 26.12.1
 * (security releases of 2026-10-20 and 2026-10-21). Lines 23 and 25 ended without a fix.
 * `NODE_ENGINES` is the `engines.node` range of every package that runs Lolly on Node, and
 * tests/node-patch-level.test.ts holds each package file to that range.
 *
 * A Node inside the range can still be a distribution build linked against an older shared
 * libbrotli. Nothing at run time tells such a build from a patched one:
 * `process.versions.brotli` reports the library's version, and Node's own patched 22.23.4
 * still reports Brotli 1.1.0, because its fix was a patch rather than a new Brotli release.
 * So the check reads Node's version alone, and there is no second warning inside the range.
 */

/** The `engines.node` range: the first fixed release of each line that has one. */
export const NODE_ENGINES = '^22.23.4 || ^24.22.1 || >=26.12.1';

/** The first release of each supported line with the fix. Lines 23 and 25 ended without one. */
export const BROTLI_FIXED_NODE: Readonly<Record<number, readonly [number, number, number]>> = Object.freeze({
  22: [22, 23, 4],
  24: [24, 22, 1],
  26: [26, 12, 1],
});

/** The same range in words, for messages and docs. */
export const NODE_FLOOR_WORDS = '22.23.4 or later on Node 22, 24.22.1 or later on Node 24, or 26.12.1 or later';

function parse(version: string): [number, number, number] | null {
  const parts = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  return parts ? [Number(parts[1]), Number(parts[2]), Number(parts[3])] : null;
}

/** Whether `version` (process.versions.node form, "26.13.1") is inside `NODE_ENGINES`. */
export function nodeMeetsFloor(version: string): boolean {
  const parsed = parse(version);
  if (!parsed) return false;
  const [major, minor, patch] = parsed;
  const fixed = BROTLI_FIXED_NODE[major];
  if (fixed) return minor > fixed[1] || (minor === fixed[1] && patch >= fixed[2]);
  // Lines after 26 are newer than the fix; earlier and odd-numbered lines have no fixed release.
  return major > 26;
}

/**
 * The refusal for `version`, or null when Lolly runs on that release. A version string that does
 * not parse is let through: Node always reports a parsable one, and a refusal on a string
 * this function cannot read would be a guess.
 */
export function unsupportedNodeMessage(version: string): string | null {
  const parsed = parse(version);
  if (!parsed || nodeMeetsFloor(version)) return null;
  return `Node ${parsed.join('.')} is no longer accepted: its Brotli decoder has a flaw (CVE-2026-111497). Use Node ${NODE_FLOOR_WORDS}.`;
}
