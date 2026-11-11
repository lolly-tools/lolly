// SPDX-License-Identifier: MPL-2.0
/**
 * Brand-derived photo treatments + icon themes (engine/src/brand-treatments.ts)
 * and their two consumers:
 *
 *  - every derived doc must survive the runtime readers unchanged
 *    (parsePhotoTreatmentsDoc / parseIconThemesDoc - a dropped entry means a
 *    silently thinner picker strip), and the default pairing must actually
 *    bake into a contract-following themable icon;
 *  - no shipped pack carries a hand-written or derived palette any more: the
 *    icon colours and photo washes come from a design system's colourways
 *    (tests/colourway-looks.test.ts), so scripts/ingest-brand.ts writes none either.
 *
 * Run with: node --test tests/brand-treatments.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { derivePhotoTreatmentsDoc, deriveIconThemesDoc } from '../engine/src/brand-treatments.ts';
import { parsePhotoTreatmentsDoc } from '../engine/src/photo-treatment.ts';
import { applyIconTheme, parseIconThemesDoc } from '../engine/src/icon-theme.ts';
import { deriveBrandTokens } from '../engine/src/brand-derive.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// A full derived token document (the deriveBrandTokens shape ingest also sees).
const GREEN_DOC = deriveBrandTokens({ primary: '#30ba78', name: 'fixture' });

const CONTRACT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">' +
  '<defs><style>.c1{fill:#30ba78}.c2{fill:#0c322c}</style></defs>' +
  '<path class="c2" d="M0 0h10v10H0z"/><rect class="c1" x="1" y="1" width="2" height="2"/></svg>';

test('derived photo treatments survive parsePhotoTreatmentsDoc entry-for-entry', () => {
  const doc = derivePhotoTreatmentsDoc(GREEN_DOC);
  const kept = parsePhotoTreatmentsDoc(doc);
  assert.equal(kept.length, doc.treatments.length, 'no entry may be dropped by the runtime reader');
  assert.equal(kept[0]!.id, 'greyscale');
  assert.equal(kept[0]!.kind, 'greyscale');
  const brand = kept.find(t => t.id === 'brand');
  assert.ok(brand, 'the lead accent wash is the "brand" duotone');
  assert.equal(brand!.kind, 'duotone');
  const deep = kept.find(t => t.id === 'deep');
  assert.ok(deep?.mid, 'the tritone carries a mid stop');
  assert.ok(deep?.previewBg, 'a dark tritone needs its own preview surface');
  const ids = kept.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'treatment ids are unique');
});

test('derived icon themes parse, lead with "brand", and bake into a contract icon', () => {
  const doc = deriveIconThemesDoc(GREEN_DOC);
  const kept = parseIconThemesDoc(doc);
  assert.equal(kept.length, doc.themes.length, 'no pairing may be dropped by the runtime reader');
  assert.ok(kept.length >= 2);
  assert.equal(kept[0]!.id, 'brand', 'first pairing is the default the picker maps to a plain id');
  assert.equal(kept[kept.length - 1]!.id, 'paper');
  assert.ok(kept[kept.length - 1]!.previewBg, 'the light paper pairing declares a preview surface');
  const ids = kept.map(t => t.id);
  assert.equal(new Set(ids).size, ids.length, 'theme ids are unique');
  const baked = applyIconTheme(CONTRACT_ICON, kept[0]!);
  assert.ok(baked, 'the default pairing bakes');
  assert.ok(baked!.includes(`fill="${kept[0]!.c1}"`));
  assert.ok(baked!.includes(`fill="${kept[0]!.c2}"`));
});

test('derivation is deterministic and tolerant of thin/absent palettes', () => {
  assert.deepEqual(derivePhotoTreatmentsDoc(GREEN_DOC), derivePhotoTreatmentsDoc(GREEN_DOC));
  assert.deepEqual(deriveIconThemesDoc(GREEN_DOC), deriveIconThemesDoc(GREEN_DOC));

  for (const source of [null, undefined, {}, 'junk', { color: { $type: 'color' } }]) {
    const t = derivePhotoTreatmentsDoc(source);
    assert.equal(parsePhotoTreatmentsDoc(t).length, t.treatments.length);
    assert.equal(t.treatments[0]!.id, 'greyscale', 'greyscale survives a colourless doc');
    assert.deepEqual(deriveIconThemesDoc(source).themes, [], 'no accent ⇒ empty themes (callers skip the asset)');
  }

  // Resolved-swatch input (the BrandSwatch[] form) works and honours roles.
  const swatches = [
    { hex: '#c8dafc', role: 'bg' },
    { hex: '#2453ff', role: 'brand.primary' },
    { hex: '#0a112b', role: 'ink' },
  ];
  const themes = parseIconThemesDoc(deriveIconThemesDoc(swatches));
  assert.equal(themes[0]!.id, 'brand');
  assert.equal(themes[0]!.c1, '#2453ff', 'the declared primary leads even against higher-chroma noise');
});

test('no shipped pack carries an icon-themes or photo-treatments palette', () => {
  // The colour strips come from each design system's colourways now, so a palette left
  // in a pack would offer nothing and drift from the system the pack ships.
  for (const pack of ['lolly-start', 'lolly-demo']) {
    const index = JSON.parse(readFileSync(join(ROOT, `brands/${pack}/catalog/assets/index.json`), 'utf8'));
    const palettes = index.assets.filter((a: { tags?: string[] }) => a.tags?.some((t) => t === 'icon-themes' || t === 'photo-treatments'));
    assert.deepEqual(palettes.map((a: { id: string }) => a.id), [], `${pack} ships no colour palette`);
  }
});

// ── ingest-brand emission ─────────────────────────────────────────────────────

// --out must live inside the repo (ingest-brand refuses outside paths), so the
// pack lands in a dot-dir under brands/ (profile/pack scans skip dot-dirs).
function runIngest(t: { after: (fn: () => void) => void }, tokens: unknown, name: string): string {
  const srcDir = mkdtempSync(join(tmpdir(), 'lolly-ingest-src-'));
  const outRel = `brands/.tmp-test-${name}`;
  const out = join(ROOT, outRel);
  t.after(() => {
    rmSync(srcDir, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });
  const src = join(srcDir, 'tokens.json');
  writeFileSync(src, JSON.stringify(tokens));
  const r = spawnSync(
    process.execPath,
    [join(ROOT, 'scripts/ingest-brand.ts'), src, '--name', name, '--out', outRel, '--force'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  assert.equal(r.status, 0, `ingest-brand failed:\n${r.stdout}\n${r.stderr}`);
  return out;
}

/** The brand-neutral LUTs and 3D models every ingested pack inherits from
 *  brands/lolly-start (scripts/ingest-brand.ts copies them, 2026-09-06), in the
 *  order the lolly-start index lists them. They follow the tokens document. */
const NEUTRAL_COPIED = [
  'lolly/3d/duck', 'lolly/3d/cat',
  'lolly/luts/slide-standard', 'lolly/luts/slide-vivid', 'lolly/luts/chrome-muted', 'lolly/luts/mono-fine',
];

test('ingest-brand writes no palette: the colour strips come from colourways', (t) => {
  const out = runIngest(t, {
    color: {
      $type: 'color',
      brand: { primary: { $value: '#30ba78' }, ink: { $value: '#0c322c' } },
      accent: { blue: { $value: '#2453ff' } },
    },
  }, 'treatbrand');
  const index = JSON.parse(readFileSync(join(out, 'catalog/assets/index.json'), 'utf8'));
  assert.deepEqual(index.assets.map((a: { id: string }) => a.id), ['treatbrand/tokens/brand', ...NEUTRAL_COPIED]);
  assert.ok(!existsSync(join(out, 'catalog/assets/treatbrand/palette')), 'no palette folder');
});

