// SPDX-License-Identifier: MPL-2.0
/**
 * Invariants on the /info format register (docs/site/formats-catalog.json).
 *
 * The register is the single source of truth for the formats table: docs/build.ts
 * computes the visible in/out/round-trip counts and every chip's direction live
 * from each entry's `dir` field, and renders the `desc` prose verbatim in the
 * click dialog. So a `dir` and its prose must never contradict each other — a
 * round-trip (`both`) format whose description still says "Export-only" shows a
 * ⇄ chip over prose that calls it export-only, in the same panel.
 *
 * This test pins that consistency and the three animated rasters that already
 * round-trip (they import verbatim via picker.ts's animated branch and export via
 * packApng/packWebpAnim), so a future edit can't silently revert them to `out`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER = resolve(ROOT, 'docs/site/formats-catalog.json');

interface FmtEntry { token: string; name: string; category: string; dir: string; features: string[]; desc: string }
interface Register { features: Record<string, string>; formats: FmtEntry[] }

function load(): Register {
  return JSON.parse(readFileSync(REGISTER, 'utf8')) as Register;
}

test('every format has a valid direction', () => {
  for (const f of load().formats) {
    assert.ok(['in', 'out', 'both'].includes(f.dir), `${f.token}: dir "${f.dir}" must be in|out|both`);
  }
});

test('a round-trip (both) format never calls itself export- or import-only', () => {
  const offenders: string[] = [];
  for (const f of load().formats) {
    if (f.dir !== 'both') continue;
    if (/export-only/i.test(f.desc)) offenders.push(`${f.token}: desc says "export-only" but dir is both`);
    if (/import-only/i.test(f.desc)) offenders.push(`${f.token}: desc says "import-only" but dir is both`);
  }
  assert.deepEqual(offenders, [], 'Flip the prose and the dir together, never dir alone.');
});

test('the three animated rasters round-trip (import verbatim, export via the packers)', () => {
  const byToken = new Map(load().formats.map((f) => [f.token, f]));
  for (const token of ['GIF', 'APNG', 'Animated WebP']) {
    const f = byToken.get(token);
    assert.ok(f, `${token} is present in the register`);
    assert.equal(f!.dir, 'both', `${token} imports (picker verbatim) and exports — dir must be both`);
  }
});

test("every format's feature keys exist in the features label map", () => {
  const reg = load();
  const known = new Set(Object.keys(reg.features));
  const bad: string[] = [];
  for (const f of reg.formats) {
    for (const k of f.features) if (!known.has(k)) bad.push(`${f.token}: unknown feature "${k}"`);
  }
  assert.deepEqual(bad, [], 'Every features[] key must have a label in the features map.');
});
