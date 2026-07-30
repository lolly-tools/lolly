// SPDX-License-Identifier: MPL-2.0
/**
 * Headless replay of a REAL Penpot deck export — the UXDays 2026 keynote —
 * against the engine's Penpot mappers. Gated (skip-with-reason) when the file
 * isn't on this machine, same pattern as brand-import.test.ts's SKIP_MATERIALS;
 * CI and other machines skip cleanly.
 *
 * Spec 1 (blur): the deck carries exactly 23 layer-blur shapes (9 value-2 paths
 * + 14 big glow circles inside maskedGroup "Mask" groups). These assert the
 * blur survives shape→node→box mapping, that the group flatten now bakes a
 * real feGaussianBlur def WITHOUT losing the mask clip, and that the real
 * layout-studio tool hydrates the blur into its box style.
 *
 * Spec 2 (fonts): the deck's 110 text shapes use Work Sans (300–700),
 * Spline Sans Mono (700) — both `gfont-` — and the non-Google `sourcesanspro`.
 * These assert the collectPenpotFontUsage aggregate tally, the knownFamilies
 * passthrough into finalizeBoxes, and the real hooks hydrating the family.
 *
 * Run with: node --test tests/penpot-keynote-replay.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { penpotShapeToNode, penpotGroupToSvg, finalizeBoxes, collectPenpotFontUsage } from '../engine/src/design-map.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEYNOTE_PATH = '/Users/andy/Downloads/UXDays 2026 Keynote (3).penpot';
const SKIP = !existsSync(KEYNOTE_PATH) && 'UXDays keynote .penpot not on this machine';

interface Shape { [k: string]: any }
interface Deck {
  fileId: string;
  /** pageId → shapeId → shape (parsed per-shape JSON). */
  pages: Map<string, Record<string, Shape>>;
  /** every shape across every page. */
  all: Shape[];
}

let deckPromise: Promise<Deck> | null = null;
function loadDeck(): Promise<Deck> {
  deckPromise ??= (async () => {
    const { unzipSync, strFromU8 } = await import('fflate');
    const entries = unzipSync(new Uint8Array(readFileSync(KEYNOTE_PATH)));
    const manifest = JSON.parse(strFromU8(entries['manifest.json']!));
    const fileId = manifest.files[0].id as string;
    const pageDir = `files/${fileId}/pages/`;
    const pages = new Map<string, Record<string, Shape>>();
    const all: Shape[] = [];
    for (const [path, bytes] of Object.entries(entries)) {
      if (!path.startsWith(pageDir)) continue;
      const m = path.slice(pageDir.length).match(/^([^/]+)\/([^/]+)\.json$/i);
      if (!m) continue;
      let shape: Shape | null = null;
      try { shape = JSON.parse(strFromU8(bytes)); } catch { shape = null; }
      if (!shape || !shape.id) continue;
      if (!pages.has(m[1]!)) pages.set(m[1]!, {});
      pages.get(m[1]!)![String(shape.id)] = shape;
      all.push(shape);
    }
    assert.ok(all.length > 0, 'the keynote export contains shape JSONs');
    return { fileId, pages, all };
  })();
  return deckPromise;
}

const isLayerBlur = (s: Shape): boolean =>
  s.blur && typeof s.blur === 'object' && String(s.blur.type || '') === 'layer-blur'
  && s.blur.hidden !== true && Number(s.blur.value) > 0;
const round1 = (v: number): number => Math.round(v * 10) / 10;

// ── 1. the blur census ───────────────────────────────────────────────────────

test('keynote: exactly 23 visible layer-blur shapes with the known value multiset', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const withBlur = all.filter((s) => s.blur && typeof s.blur === 'object');
  for (const s of withBlur) {
    assert.equal(String(s.blur.type || ''), 'layer-blur', `shape ${s.id}: only layer-blur in this deck`);
    assert.notEqual(s.blur.hidden, true, `shape ${s.id}: none hidden`);
  }
  const blurred = all.filter(isLayerBlur);
  assert.equal(blurred.length, 23, 'exactly 23 blurred shapes');
  const values = blurred.map((s) => round1(Number(s.blur.value))).sort((a, b) => a - b);
  assert.deepEqual(values, [
    2, 2, 2, 2, 2, 2, 2, 2, 2,
    40.6, 40.6, 40.8, 40.8,
    155, 155,
    193.7, 193.7, 193.7, 193.7,
    194.6, 194.6, 194.6, 194.6,
  ], 'the 1-decimal blur value multiset matches the audit scan');
});

// ── 2. the nine value-2 paths map through the vector branch, blur intact ─────

test('keynote: the 9 blur-2 paths map to vector image nodes carrying blur 2', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const paths = all.filter((s) => isLayerBlur(s) && String(s.type || '') === 'path');
  assert.equal(paths.length, 9, 'nine blurred paths');
  for (const s of paths) {
    assert.equal(round1(Number(s.blur.value)), 2, `path ${s.id}: value 2`);
    const node = penpotShapeToNode(s) as any;
    assert.ok(node, `path ${s.id}: maps to a node`);
    assert.ok(node._vectorPath, `path ${s.id}: takes the vector branch`);
    assert.equal(node.blur, 2, `path ${s.id}: node.blur === 2`);
  }
});

// ── 3. Mask groups still flatten, now WITH the blur def and the clip ─────────

test('keynote: every Mask group holding blurred circles flattens with feGaussianBlur AND clip-path', { skip: SKIP }, async () => {
  const { pages } = await loadDeck();
  let population = 0;
  for (const shapesById of pages.values()) {
    const lookup = (id: string): Shape | undefined => shapesById[id];
    const subtreeHasBlurredCircle = (id: string, seen = new Set<string>()): boolean => {
      if (seen.has(id)) return false;
      seen.add(id);
      const s = shapesById[id];
      if (!s) return false;
      if (isLayerBlur(s) && String(s.type || '') === 'circle') return true;
      return (Array.isArray(s.shapes) ? s.shapes : []).some((k: unknown) => subtreeHasBlurredCircle(String(k), seen));
    };
    for (const s of Object.values(shapesById)) {
      if (String(s.type || '') !== 'group' || s.maskedGroup !== true) continue;
      if (!(Array.isArray(s.shapes) ? s.shapes : []).some((k: unknown) => subtreeHasBlurredCircle(String(k)))) continue;
      population++;
      const svg = penpotGroupToSvg(s, lookup);
      // Before this change the flatten SUCCEEDED but silently dropped the blur —
      // so this asserts the new def, not a route change (and the clip survives).
      assert.ok(svg, `mask group ${s.id}: still flattens`);
      assert.ok(svg.includes('feGaussianBlur'), `mask group ${s.id}: blur def baked`);
      assert.ok(svg.includes('clip-path'), `mask group ${s.id}: mask clip retained`);
    }
  }
  assert.ok(population >= 1, `found ${population} blurred-circle Mask groups (component masters/instances are counted here even when the board import skips them)`);
});

// ── 4. end to end: a blurred board box hydrates through the REAL tool ────────

test('keynote: a mapped blur-2 box hydrates to filter:blur(2px) via the real layout-studio', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const glow = all.find((s) => isLayerBlur(s) && String(s.type || '') === 'path');
  assert.ok(glow, 'a blur-2 path exists');
  const node = penpotShapeToNode(glow!) as any;
  const boxes = finalizeBoxes([node]);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0]!.blur, 2, 'the box row carries blur 2');

  const PACK_DIR = join(ROOT, 'brands', 'lolly-start', 'tools');
  const tool: any = await loadTool('layout-studio', (p: string) => readFile(join(PACK_DIR, p), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const html = rt.getHydrated() as string;
  assert.ok(html.includes('filter:blur(2px);'), 'the hydrated markup blurs the glow box');
});

// ── 5. fonts: the deck-wide usage tally ──────────────────────────────────────

/** Aggregate collectPenpotFontUsage across every text shape: family → weight → runs. */
async function fontTally(): Promise<Map<string, { google: boolean; runsByWeight: Map<number, number> }>> {
  const { all } = await loadDeck();
  const tally = new Map<string, { google: boolean; runsByWeight: Map<number, number> }>();
  for (const s of all) {
    if (String(s.type || '') !== 'text' || !s.content) continue;
    for (const u of collectPenpotFontUsage(s.content)) {
      let e = tally.get(u.fontFamily);
      if (!e) { e = { google: false, runsByWeight: new Map() }; tally.set(u.fontFamily, e); }
      if (u.fontId.startsWith('gfont-')) e.google = true;
      e.runsByWeight.set(u.fontWeight, (e.runsByWeight.get(u.fontWeight) || 0) + u.runs);
    }
  }
  return tally;
}

test('keynote: the font-usage tally matches the audit scan exactly', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  assert.equal(all.filter((s) => String(s.type || '') === 'text' && s.content).length, 110, '110 text shapes');
  const tally = await fontTally();
  assert.deepEqual([...tally.keys()].sort(), ['Spline Sans Mono', 'Work Sans', 'sourcesanspro']);

  const ws = tally.get('Work Sans')!;
  assert.equal(ws.google, true, 'Work Sans is gfont- sourced');
  assert.deepEqual(
    [...ws.runsByWeight].sort((a, b) => a[0] - b[0]),
    [[300, 8], [400, 114], [500, 18], [600, 20], [700, 162]],
    'Work Sans runs per weight',
  );

  const mono = tally.get('Spline Sans Mono')!;
  assert.equal(mono.google, true, 'Spline Sans Mono is gfont- sourced');
  assert.deepEqual([...mono.runsByWeight], [[700, 4]], 'Spline Sans Mono runs per weight');

  const ssp = tally.get('sourcesanspro')!;
  assert.equal(ssp.google, false, 'sourcesanspro is NOT Google sourced (bundled/custom id)');
  assert.deepEqual([...ssp.runsByWeight], [[400, 2]], 'sourcesanspro runs per weight');
});

// ── 6. fonts: knownFamilies passthrough onto the mapped boxes ────────────────

test('keynote: finalizeBoxes with knownFamilies keeps the deck families on text boxes', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const map = { fonts: { knownFamilies: ['Work Sans', 'Spline Sans Mono'] } };
  const textNodes = all
    .filter((s) => String(s.type || '') === 'text' && s.content)
    .map((s) => penpotShapeToNode(s))
    .filter((n) => n != null);
  const boxes = finalizeBoxes(textNodes as never[], map);
  assert.equal(boxes.length, textNodes.length, 'every text node maps');

  const ws700 = boxes.filter((b) => b.font === 'Work Sans' && b.weight === '700');
  assert.ok(ws700.length > 0, 'Work Sans 700 boxes came through verbatim');
  assert.ok(boxes.some((b) => b.font === 'Spline Sans Mono' && b.weight === '700'),
    'Spline Sans Mono passes through despite matching the mono regex');
  // The non-Google family isn't known → it buckets to the neutral default.
  assert.ok(boxes.every((b) => b.font === 'Work Sans' || b.font === 'Spline Sans Mono' || b.font === 'sans'),
    'unknown families bucket to the default, nothing else leaks');
  assert.ok(boxes.some((b) => b.font === 'sans'), 'the sourcesanspro shapes bucketed to the default');
});

// ── 7. fonts: the real hooks hydrate the passthrough family ──────────────────

test('keynote: a Work Sans box hydrates to font-family:\'Work Sans\' via the real layout-studio', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const map = { fonts: { knownFamilies: ['Work Sans', 'Spline Sans Mono'] } };
  const shape = all.find((s) => String(s.type || '') === 'text' && s.content
    && collectPenpotFontUsage(s.content).some((u) => u.fontFamily === 'Work Sans'));
  assert.ok(shape, 'a Work Sans text shape exists');
  const node = penpotShapeToNode(shape!);
  const boxes = finalizeBoxes([node] as never[], map);
  assert.equal(boxes[0]!.font, 'Work Sans');

  const PACK_DIR = join(ROOT, 'brands', 'lolly-start', 'tools');
  const tool: any = await loadTool('layout-studio', (p: string) => readFile(join(PACK_DIR, p), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const html = rt.getHydrated() as string;
  // Hydration HTML-escapes quotes in style attributes, so the ' appears as &#x27;.
  assert.ok(html.includes('font-family:&#x27;Work Sans&#x27;, var(--font-brand,'),
    'the hydrated markup paints the imported family ahead of the brand stack');
});
