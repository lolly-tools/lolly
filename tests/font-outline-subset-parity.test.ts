// SPDX-License-Identifier: MPL-2.0
/**
 * skera ↔ current-method parity (plan 88 — Font Outliner). GATED: every case
 * skips (like the c2patool suites) unless a skera binary is installed —
 *   cargo install skera --features cli
 * or SKERA_BIN=… — so `npm test` stays green on a machine with nothing extra.
 *
 * What it proves when it runs: a font subset by skera (fontations' Rust
 * subsetter — Dave Crossland's steer for Font Outliner, adopt at v1.0.0,
 * likely EoY 2026) shapes IDENTICALLY through the CURRENT text→outline
 * pipeline — packages/node-shell/src/text.ts, the faithful Node port of the
 * web bridge (shells/web/src/bridge/text.ts), same HarfBuzz WASM — for both
 * the default instance and a wght=700 variation (i.e. gvar survives the
 * subset). Identical path bytes + advance + coverage means skera output is
 * drop-in drawable for us. When skera hits 1.0 this suite is the first
 * yes/no on whether it is safe to build Font Outliner on.
 *
 * Perf is deliberately NOT asserted here (timing assertions flake — see
 * BENCH=1 in tests/README.md); scripts/bench-font-outline.ts measures it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { statSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { findSkera, skeraSubset, skeraVersion } from './helpers/skera.ts';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTFIT_URL = '/fonts/Outfit[wght].ttf';
const OUTFIT_DISK = join(REPO_ROOT, 'shells/web/public/fonts/Outfit[wght].ttf');

const TEXT = 'The quick brown fox jumps over the lazy dog — fi ffl AVATAR 0123456789.';

const skeraBin = findSkera();
const SKIP = skeraBin
  ? existsSync(OUTFIT_DISK)
    ? null
    : 'Outfit platform face not on disk (shells/web submodule not checked out?)'
  : 'skera not installed (cargo install skera --features cli, or SKERA_BIN=…)';

test('skera subset shapes identically through the current outline pipeline', { skip: SKIP ?? false }, async () => {
  const api = createNodeTextAPI({ repoRoot: REPO_ROOT });
  const workDir = mkdtempSync(join(tmpdir(), 'lolly-skera-parity-'));
  const subsetPath = join(workDir, 'outfit-subset.ttf');

  skeraSubset(skeraBin!, OUTFIT_DISK, TEXT, subsetPath);
  console.log(`skera: ${skeraVersion(skeraBin!)}`);

  // Subsetting that removes nothing proves nothing.
  assert.ok(
    statSync(subsetPath).size < statSync(OUTFIT_DISK).size,
    'subset font should be smaller than the original',
  );

  const subsetUrl = pathToFileURL(subsetPath).href;
  const base = { text: TEXT, fontSize: 64 };

  // Default instance: byte-identical path, same advance, full coverage kept.
  const orig = await api.toPath({ ...base, fontUrl: OUTFIT_URL });
  const sub = await api.toPath({ ...base, fontUrl: subsetUrl });
  assert.ok(orig.d.length > 0, 'original run must produce outlines');
  assert.equal(orig.notdef, 0, 'corpus must be fully covered by Outfit');
  assert.equal(sub.notdef, 0, 'subset must keep every glyph the corpus needs');
  assert.equal(sub.d, orig.d, 'subset font must emit byte-identical outlines');
  assert.ok(Math.abs(sub.advanceWidth - orig.advanceWidth) < 1e-6, 'advance must match');

  // wght=700 through the subset: variation data (gvar et al) must survive.
  const origBold = await api.toPath({ ...base, fontUrl: OUTFIT_URL, variations: ['wght=700'] });
  const subBold = await api.toPath({ ...base, fontUrl: subsetUrl, variations: ['wght=700'] });
  assert.notEqual(origBold.d, orig.d, 'wght=700 must actually differ from the default instance');
  assert.equal(subBold.d, origBold.d, 'subset font must shape wght=700 identically (gvar retained)');
  assert.ok(Math.abs(subBold.advanceWidth - origBold.advanceWidth) < 1e-6, 'bold advance must match');
});

test('skera subset still reports uncovered characters as notdef', { skip: SKIP ?? false }, async () => {
  const api = createNodeTextAPI({ repoRoot: REPO_ROOT });
  const workDir = mkdtempSync(join(tmpdir(), 'lolly-skera-parity-'));
  const subsetPath = join(workDir, 'outfit-subset-notdef.ttf');
  skeraSubset(skeraBin!, OUTFIT_DISK, TEXT, subsetPath);

  // Characters outside BOTH the corpus and Outfit's coverage: the subset must
  // count them as .notdef exactly like the original does — a subset that
  // silently drops coverage reporting would break toPath's <text> fallback.
  const probe = { text: 'fox 日本語', fontSize: 64 };
  const orig = await api.toPath({ ...probe, fontUrl: OUTFIT_URL });
  const sub = await api.toPath({ ...probe, fontUrl: pathToFileURL(subsetPath).href });
  assert.ok((orig.notdef ?? 0) > 0, 'probe must miss Outfit coverage');
  assert.equal(sub.notdef ?? 0, orig.notdef ?? 0, 'subset must report the same coverage misses');
});
