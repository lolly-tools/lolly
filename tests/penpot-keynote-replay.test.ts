// SPDX-License-Identifier: MPL-2.0
/**
 * Headless replay of a REAL Penpot deck export - the UXDays 2026 keynote - 
 * against the engine's Penpot mappers. Gated (skip-with-reason) when the file
 * isn't on this machine, same pattern as brand-import.test.ts's SKIP_MATERIALS;
 * CI and other machines skip cleanly.
 *
 * Spec 1 (blur): the deck carries exactly 23 layer-blur shapes (9 value-2 paths
 * + 14 big glow circles inside maskedGroup "Mask" groups). These assert the
 * blur survives shape→node→box mapping, that the group flatten now bakes a
 * real feGaussianBlur def WITHOUT losing the mask clip, and that the real
 * design tool hydrates the blur into its box style.
 *
 * Spec 2 (fonts): the deck's 110 text shapes use Work Sans (300–700),
 * Spline Sans Mono (700) - both `gfont-` - and the non-Google `sourcesanspro`.
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

import { penpotShapeToNode, penpotGroupToSvg, finalizeBoxes, collectPenpotFontUsage, collectPenpotExportMarks, penpotBackgroundBlurPx } from '../engine/src/design-map.ts';
import { scanPenpotUsage, scanPenpotAppliedTokens, extractPenpotProject } from '../engine/src/brand-import.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { contrastRatio } from '../engine/src/brand-derive.ts';
import { proposeBrandRoles, buildBrandDocFromUsage, proposeRolesFromTokens } from '../shells/web/src/lib/brand-propose.ts';
import { listStudioTokens } from '../shells/web/src/lib/token-studio.ts';
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
  /** the raw unzipped archive, path → bytes - for the entry-level engine APIs. */
  entries: Record<string, Uint8Array>;
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
    return { fileId, pages, all, entries };
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
      // Before this change the flatten SUCCEEDED but silently dropped the blur - 
      // so this asserts the new def, not a route change (and the clip survives).
      assert.ok(svg, `mask group ${s.id}: still flattens`);
      assert.ok(svg.includes('feGaussianBlur'), `mask group ${s.id}: blur def baked`);
      assert.ok(svg.includes('clip-path'), `mask group ${s.id}: mask clip retained`);
    }
  }
  assert.ok(population >= 1, `found ${population} blurred-circle Mask groups (component masters/instances are counted here even when the board import skips them)`);
});

// ── 4. end to end: a blurred board box hydrates through the REAL tool ────────

test('keynote: a mapped blur-2 box hydrates to filter:blur(2px) via the real design', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const glow = all.find((s) => isLayerBlur(s) && String(s.type || '') === 'path');
  assert.ok(glow, 'a blur-2 path exists');
  const node = penpotShapeToNode(glow!) as any;
  const boxes = finalizeBoxes([node]);
  assert.equal(boxes.length, 1);
  assert.equal(boxes[0]!.blur, 2, 'the box row carries blur 2');

  const PACK_DIR = join(ROOT, 'brands', 'lolly-start', 'tools');
  const tool: any = await loadTool('design', (p: string) => readFile(join(PACK_DIR, p), 'utf8'));
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

test('keynote: a Work Sans box hydrates to font-family:\'Work Sans\' via the real design', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const map = { fonts: { knownFamilies: ['Work Sans', 'Spline Sans Mono'] } };
  const shape = all.find((s) => String(s.type || '') === 'text' && s.content
    && collectPenpotFontUsage(s.content).some((u) => u.fontFamily === 'Work Sans'));
  assert.ok(shape, 'a Work Sans text shape exists');
  const node = penpotShapeToNode(shape!);
  const boxes = finalizeBoxes([node] as never[], map);
  assert.equal(boxes[0]!.font, 'Work Sans');

  const PACK_DIR = join(ROOT, 'brands', 'lolly-start', 'tools');
  const tool: any = await loadTool('design', (p: string) => readFile(join(PACK_DIR, p), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const html = rt.getHydrated() as string;
  // Hydration HTML-escapes quotes in style attributes, so the ' appears as &#x27;.
  assert.ok(html.includes('font-family:&#x27;Work Sans&#x27;, var(--font-brand,'),
    'the hydrated markup paints the imported family ahead of the brand stack');
});

// ── 8. usage: the whole-file paint census (scanPenpotUsage) ──────────────────

test('keynote: scanPenpotUsage census matches the audit scan exactly', { skip: SKIP }, async () => {
  const { entries } = await loadDeck();
  const u = scanPenpotUsage(entries);

  assert.equal(u.colors.length, 22, '22 distinct colours across every paint source');
  assert.deepEqual(u.colors[0], { hex: '#151035', fills: 1066, strokes: 6, textRuns: 58, gradientStops: 76, total: 1206 });
  assert.equal(u.colors.filter(c => c.fills > 0).length, 14, '14 distinct fill colours');
  assert.equal(u.colors.filter(c => c.strokes > 0).length, 6, '6 distinct stroke colours');
  assert.equal(u.colors.filter(c => c.textRuns > 0).length, 6, '6 distinct text-run colours');
  assert.equal(u.colors.filter(c => c.gradientStops > 0).length, 9, '9 distinct gradient-stop colours');
  assert.equal(u.colors.find(c => c.hex === '#EEEEEE')!.fills, 929);

  assert.equal(u.gradients.length, 7, '7 distinct gradients by stop signature');
  assert.equal(u.gradients.reduce((n, g) => n + g.count, 0), 101, '101 gradient paints in total');
  assert.ok(u.gradients.every(g => g.type === 'linear'), 'every gradient is linear');
  assert.equal(u.gradients[0]!.count, 74, 'the main slide-background gradient dominates');
  assert.equal(u.gradients[0]!.angle, 180, 'modal fraction-space angle');
  assert.deepEqual(u.gradients[0]!.stops.map(s => s.color), ['#151035', '#312470']);

  assert.deepEqual([...new Set(u.fonts.map(f => f.fontFamily))].sort(),
    ['Spline Sans Mono', 'Work Sans', 'sourcesanspro']);
});

// ── 9. usage: the proposal assigns the roles a designer would ────────────────

test('keynote: the usage proposal assigns the roles a designer would', { skip: SKIP }, async () => {
  const { entries } = await loadDeck();
  const roles = proposeBrandRoles(scanPenpotUsage(entries));
  assert.ok(roles, 'a file this colourful always yields a proposal');

  assert.equal(roles.surface, '#151035', 'the dominant fill is the surface');
  assert.equal(roles.surfaceLook, 'dark', 'OKLCH L 0.205 → a dark look');
  assert.equal(roles.primary, '#F23AE5', 'top weight x chroma accent');
  assert.equal(roles.secondary, '#14CECA', 'next accent at least 30 degrees of hue away');
  assert.equal(roles.scheme, 'triad', 'a 139-degree arc reads as triad');
  assert.equal(roles.text, '#FFFFFF', 'the most-used text colour that clears 4.5:1 on the surface');
  assert.ok(contrastRatio(roles.text, roles.surface) >= 4.5, 'the text pick actually reads');

  // The required exclusion: #312470 is the surface's gradient partner. Its
  // weight x chroma score (76 x 0.125) would beat #14CECA's (57 x 0.130) if it
  // stayed in the pool - the shade rule is what keeps the real accent second.
  assert.notEqual(roles.secondary, '#312470');
  assert.ok(!roles.extras.includes('#312470'), 'the surface shade never reaches the accent pool');
});

// ── 10. usage: the proposal doc installs cleanly as a resolvable brand ───────

test('keynote: the proposal doc installs cleanly as a resolvable brand', { skip: SKIP }, async () => {
  const { entries } = await loadDeck();
  const u = scanPenpotUsage(entries);
  const { doc, roles, fonts, gradientCount } = buildBrandDocFromUsage(u, 'UXDays 2026 Keynote (3)');

  assert.equal(fonts.brand, 'Work Sans', 'the most-run family is the brand face');
  assert.equal(fonts.mono, 'Spline Sans Mono', 'the /mono/ family is the mono face');
  assert.deepEqual(fonts.google, ['Work Sans', 'Spline Sans Mono']);
  assert.deepEqual(fonts.missing, ['sourcesanspro']);

  const base = doc.base as Record<string, any>;
  assert.deepEqual(base.font.brand.$value, ['Work Sans'], 'font.brand rides the doc so carryUserFontTokens keeps it');
  assert.deepEqual(base.font.mono.$value, ['Spline Sans Mono']);

  assert.equal(gradientCount, 3, 'the top three gradients became tokens');
  const gradTokens = listStudioTokens(doc).filter(t => t.kind === 'gradient');
  assert.equal(gradTokens.length, 3);
  const g1 = gradTokens.find(t => t.key === 'gradient.file-gradient-1');
  assert.ok(g1, 'the dominant gradient is token one');
  assert.equal(g1!.angle, 180);
  assert.deepEqual((g1!.raw as Array<{ color: string }>).map(s => s.color), ['#151035', '#312470']);

  // Resolvability: the dark look leads, and the observed secondary is pinned
  // as a literal in BOTH themes (the alias-detach write).
  const ts = createTokenSet(doc);
  assert.equal(ts.themes()[0]!.name, 'dark', 'surface dark makes dark the default theme');
  assert.equal(String(ts.resolve('color.semantic.secondary')).toUpperCase(), '#14CECA');
  const tsLight = createTokenSet(doc, { theme: 'light' });
  assert.equal(String(tsLight.resolve('color.semantic.secondary')).toUpperCase(), '#14CECA');
  assert.ok(ts.colors().length > 0, 'the palette walks');
  assert.equal(String(roles.secondary).toUpperCase(), '#14CECA');
});

// ── 11. export marks: the census ─────────────────────────────────────────────
// (Spec: exports-marked asset ingest - slot 11 per the cross-spec coordination.)

/** pageId → declared page name, read from the page-level meta JSONs. */
async function pageNamesById(): Promise<Map<string, string>> {
  const { fileId, pages, entries } = await loadDeck();
  const { strFromU8 } = await import('fflate');
  const names = new Map<string, string>();
  for (const pid of pages.keys()) {
    const meta = entries[`files/${fileId}/pages/${pid}.json`];
    if (!meta) continue;
    try { names.set(pid, String(JSON.parse(strFromU8(meta)).name ?? '')); } catch { /* unnamed */ }
  }
  return names;
}

test('keynote: the export-marks census matches the audit scan exactly', { skip: SKIP }, async () => {
  const { pages, all } = await loadDeck();
  const names = await pageNamesById();

  // Raw census: 72 marked shapes, {frame:29, group:38, rect:5}, 73 raw entries
  // (one identical-duplicate pair), every entry png|jpeg|svg at scale 1|2|4 with
  // suffix '', none hidden and none under a hidden ancestor.
  const marked = all.filter((s) => Array.isArray(s.exports) && s.exports.length > 0);
  assert.equal(marked.length, 72, '72 export-marked shapes');
  const typeCensus: Record<string, number> = {};
  for (const s of marked) typeCensus[String(s.type)] = (typeCensus[String(s.type)] ?? 0) + 1;
  assert.deepEqual(typeCensus, { frame: 29, group: 38, rect: 5 }, 'carrier type census');
  let rawTotal = 0;
  let dupPairs = 0;
  for (const s of marked) {
    assert.notEqual(s.hidden, true, `marked shape ${s.id} is not hidden`);
    const sigs: string[] = [];
    for (const e of s.exports) {
      rawTotal++;
      assert.ok(['png', 'jpeg', 'svg'].includes(String(e.type)), `type ${e.type}`);
      assert.ok([1, 2, 4].includes(Number(e.scale)), `scale ${e.scale}`);
      assert.equal(String(e.suffix ?? ''), '', 'suffix is always empty');
      sigs.push(`${e.type}|${e.scale}|${e.suffix}`);
    }
    dupPairs += sigs.length - new Set(sigs).size;
  }
  assert.equal(rawTotal, 73, '73 raw entries');
  assert.equal(dupPairs, 1, 'exactly one identical-duplicate pair');
  // No marked shape sits under a hidden ancestor (checked per page via parents).
  for (const shapesById of pages.values()) {
    const hiddenSubtree = new Set<string>();
    const sweep = (id: string): void => {
      hiddenSubtree.add(id);
      const s = shapesById[id];
      for (const k of (s && Array.isArray(s.shapes) ? s.shapes : [])) sweep(String(k));
    };
    for (const s of Object.values(shapesById)) if (s.hidden === true) sweep(String(s.id));
    for (const s of Object.values(shapesById)) {
      if (Array.isArray(s.exports) && s.exports.length) {
        assert.ok(!hiddenSubtree.has(String(s.id)), `marked shape ${s.id} has no hidden ancestor`);
      }
    }
  }

  // Collector: 57 kept on the deck page, 0 on the component page (3 direct
  // masters + 12 master-subtree descendants pruned), kept census, deduped totals.
  const deckPid = [...names].find(([, n]) => n === 'UX DAYS 2026')?.[0];
  const compPid = [...names].find(([, n]) => n === 'Main components')?.[0];
  assert.ok(deckPid && compPid, 'both pages found by name');
  const deckMarks = collectPenpotExportMarks(pages.get(deckPid!)!);
  assert.equal(deckMarks.length, 57, '57 kept marks on UX DAYS 2026');
  assert.equal(collectPenpotExportMarks(pages.get(compPid!)!).length, 0, '0 kept marks on Main components');
  const keptCensus: Record<string, number> = {};
  for (const m of deckMarks) keptCensus[String(m.shape.type)] = (keptCensus[String(m.shape.type)] ?? 0) + 1;
  assert.deepEqual(keptCensus, { frame: 22, group: 30, rect: 5 }, 'kept carrier census');
  const entriesTotal = deckMarks.reduce((n, m) => n + m.entries.length, 0);
  assert.equal(entriesTotal, 57, '57 deduped entries');
  const configCensus = new Map<string, number>();
  for (const m of deckMarks) {
    for (const e of m.entries) {
      const k = `${e.type},${e.scale}`;
      configCensus.set(k, (configCensus.get(k) ?? 0) + 1);
    }
  }
  assert.deepEqual(
    [...configCensus].sort((a, b) => a[0].localeCompare(b[0])),
    [['jpeg,2', 6], ['jpeg,4', 2], ['png,1', 10], ['png,2', 17], ['png,4', 12], ['svg,1', 10]],
    'deduped per-config census',
  );
});

// ── 12. export marks: the pure-vector rule on the kept marks ─────────────────
// (Slot 12.)

test('keynote: the pure-vector rule on the kept marks', { skip: SKIP }, async () => {
  const { pages } = await loadDeck();
  const names = await pageNamesById();
  const deckPid = [...names].find(([, n]) => n === 'UX DAYS 2026')?.[0];
  assert.ok(deckPid, 'deck page found');
  const shapesById = pages.get(deckPid!)!;
  const marks = collectPenpotExportMarks(shapesById);

  // Groups: 25 flatten to one pure-vector SVG, 5 refuse (the bake path);
  // 9 of the flattening groups are svg-marked (the direct-store fast path).
  const groups = marks.filter((m) => String(m.shape.type) === 'group');
  assert.equal(groups.length, 30, '30 kept group marks');
  let pure = 0;
  let refuse = 0;
  let svgMarkedPure = 0;
  for (const m of groups) {
    const svg = penpotGroupToSvg(m.shape, (id) => shapesById[id]);
    if (svg) {
      pure++;
      assert.ok(svg.startsWith('<svg'), 'a flattened group is a standalone SVG');
      const sh: any = m.shape;
      const sel = (sh.selrect && typeof sh.selrect === 'object') ? sh.selrect : sh;
      assert.ok(svg.includes(`viewBox="${Number(sel.x)} ${Number(sel.y)} ${Number(sel.width)} ${Number(sel.height)}"`),
        `group ${sh.id}: selrect viewBox`);
      if (m.entries.some((e) => e.type === 'svg')) svgMarkedPure++;
    } else {
      refuse++;
    }
  }
  assert.equal(pure, 25, '25 groups flatten pure');
  assert.equal(refuse, 5, '5 groups fall to the bake path');
  assert.equal(svgMarkedPure, 9, '9 flattening groups are svg-marked');

  // Rects: all 5 kept rect marks map to plain 464x503 box nodes and survive finalize.
  const rects = marks.filter((m) => String(m.shape.type) === 'rect');
  assert.equal(rects.length, 5, '5 kept rect marks');
  for (const m of rects) {
    const node = penpotShapeToNode(m.shape) as any;
    assert.ok(node, 'the rect maps');
    assert.equal(node.kind, 'box', 'kind box');
    assert.equal(Math.round(node.w), 464, 'width 464');
    assert.equal(Math.round(node.h), 503, 'height 503');
    assert.equal(finalizeBoxes([node]).length, 1, 'one box row');
  }
});

// ── Spec 3: per-corner radii + flip fidelity (slots 13–17) ───────────────────
// (Appended block - imports hoist; kept here so the block stays append-only.)
import { penpotTransformBaked, pathDBounds, mirrorPenpotGradient } from '../engine/src/design-map.ts';

const isFlipped = (s: Shape): boolean => s.flipX === true || s.flipY === true;

// ── 13. the flip + radius census ─────────────────────────────────────────────

test('keynote: the flip and corner-radius census matches the audit scan exactly', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const flipped = all.filter(isFlipped);
  assert.equal(flipped.length, 96, '96 flipped shapes');
  assert.equal(all.filter((s) => s.flipX === true).length, 82, '82 flipX');
  assert.equal(all.filter((s) => s.flipY === true).length, 63, '63 flipY');
  assert.equal(all.filter((s) => s.flipX === true && s.flipY === true).length, 49, '49 both');
  const byType: Record<string, number> = {};
  for (const s of flipped) byType[String(s.type)] = (byType[String(s.type)] || 0) + 1;
  assert.deepEqual(byType, { path: 61, circle: 20, rect: 11, frame: 4 });
  assert.equal(all.filter((s) => String(s.type) === 'text' && isFlipped(s)).length, 0, 'zero flipped text');
  // Corner radii: 13 shapes, every one with all four corners EQUAL - the deck never
  // exercises the unequal-corner route, which is why it's pinned by unit tests.
  const withR = all.filter((s) => [s.r1, s.r2, s.r3, s.r4].some((r) => Number(r) > 0));
  assert.equal(withR.length, 13, '13 shapes carry corner radii');
  for (const s of withR) {
    const r1 = Number(s.r1) || 0;
    assert.ok([s.r2, s.r3, s.r4].every((r) => (r == null ? r1 : Number(r)) === r1),
      `shape ${s.id}: all four corners equal`);
  }
  // Every path carries an object transform (identity or baked) - the field the
  // double-transform fix keys on.
  const paths = all.filter((s) => String(s.type) === 'path');
  assert.equal(paths.length, 2290, '2290 paths');
  assert.ok(paths.every((s) => s.transform && typeof s.transform === 'object'),
    'every path has an object transform');
});

// ── 14. the coordinate-model invariant on a baked flipX path ─────────────────

test('keynote: path content is page-space-final — inverse transform lands on selrect (<0.1px)', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const s = all.find((x) => x.id === '9f538c81-bdb5-8040-8008-04f3d4329d45');
  assert.ok(s, 'the flipX rot-336.56 arrow path exists');
  assert.equal(s!.flipX, true);
  assert.ok(Math.abs(Number(s!.rotation) - 336.5608257454455) < 1e-6);
  assert.ok(penpotTransformBaked(s!.transform), 'its transform is baked (R·F, det −1)');
  const t = s!.transform as { a: number; b: number; c: number; d: number };
  assert.ok(Math.abs(t.a * t.d - t.b * t.c - -1) < 1e-4, 'det −1 (a flip is orientation-reversing)');
  // Undo the baked transform about the selrect centre: the content maps back onto
  // the selrect - proving content is selrect-geometry with R·F applied, so using
  // selrect + rot AND the final content together transforms the shape twice.
  const sel = s!.selrect;
  const cx = sel.x + sel.width / 2, cy = sel.y + sel.height / 2;
  const det = t.a * t.d - t.b * t.c;
  const inv = { a: t.d / det, b: -t.b / det, c: -t.c / det, d: t.a / det };
  const nums = String(s!.content).match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)!;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const px = parseFloat(nums[i]!) - cx, py = parseFloat(nums[i + 1]!) - cy;
    const ix = inv.a * px + inv.c * py + cx, iy = inv.b * px + inv.d * py + cy;
    minX = Math.min(minX, ix); maxX = Math.max(maxX, ix);
    minY = Math.min(minY, iy); maxY = Math.max(maxY, iy);
  }
  assert.ok(Math.abs(minX - sel.x) < 0.1, 'x lands on selrect');
  assert.ok(Math.abs(minY - sel.y) < 0.1, 'y lands on selrect');
  assert.ok(Math.abs((maxX - minX) - sel.width) < 0.1, 'width lands on selrect');
  assert.ok(Math.abs((maxY - minY) - sel.height) < 0.1, 'height lands on selrect');
});

// ── 15. the baked-path fix: content bbox + rot 0, identity untouched ─────────

test('keynote: a baked path maps to its content bbox with rot 0; identity paths keep selrect + rot', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const s = all.find((x) => x.id === '9f538c81-bdb5-8040-8008-04f3d4329d45')!;
  const node = penpotShapeToNode(s) as any;
  assert.ok(node && node._vectorPath, 'takes the vector branch');
  assert.equal(node.rot, 0, 'rot 0 — the transform is already in the content');
  const r3 = (v: number): number => Math.round(v * 1000) / 1000;
  assert.equal(r3(node.x), 484.166, 'x = content bbox, not selrect');
  assert.equal(r3(node.y), 244);
  assert.equal(r3(node.w), 55.163);
  assert.equal(r3(node.h), 82.02);
  assert.deepEqual(
    [r3(node._vectorSize.x), r3(node._vectorSize.y), r3(node._vectorSize.w), r3(node._vectorSize.h)],
    [484.166, 244, 55.163, 82.02], '_vectorSize rides the same bbox');
  const bb = pathDBounds(String(s.content))!;
  assert.equal(r3(bb.x), r3(node.x), 'the bbox is pathDBounds’s');
  // An identity-transform path keeps the byte-identical selrect + rot route.
  const ident = all.find((x) => String(x.type) === 'path' && x.transform
    && !penpotTransformBaked(x.transform) && penpotShapeToNode(x));
  assert.ok(ident, 'an identity-transform path exists');
  const inode = penpotShapeToNode(ident!) as any;
  const isel = ident!.selrect;
  assert.equal(inode.x, Number(isel.x));
  assert.equal(inode.y, Number(isel.y));
  assert.equal(inode.w, Number(isel.width));
  assert.equal(inode.h, Number(isel.height));
  assert.equal(inode.rot, Number(ident!.rotation) || 0);
});

// ── 16. slide backgrounds: the flipX frames mirror their gradient ────────────

test('keynote: the 4 flipX slide-background frames mirror 117° → 243°', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const flippedFrames = all.filter((s) => String(s.type) === 'frame' && isFlipped(s));
  assert.equal(flippedFrames.length, 4, 'exactly 4 flipped frames');
  for (const f of flippedFrames) {
    assert.equal(f.flipX, true, `frame ${f.id}: all are flipX`);
    assert.notEqual(f.flipY, true);
    assert.equal(Math.round(f.selrect.width), 895);
    assert.equal(Math.round(f.selrect.height), 503);
    const node = penpotShapeToNode(f) as any;
    assert.equal(node.grad, 'lin.srgb_243_151035-0_312470-100', `frame ${f.id}: mirrored spec`);
  }
  // The flipped board …82ce and its unflipped sibling …82b1 sit on the same page.
  const flipped = all.find((s) => s.id === '31d3cc1f-7979-8010-8008-0501390882ce')!;
  const plain = all.find((s) => s.id === '31d3cc1f-7979-8010-8008-0501390882b1')!;
  assert.ok(flipped && plain, 'both boards exist');
  assert.equal((penpotShapeToNode(plain) as any).grad, 'lin.srgb_117_151035-0_312470-100',
    'the unflipped sibling keeps the authored 117° spec');
  // And the mirror is exactly the engine helper applied to the same fill.
  const g = flipped.fills[0].fillColorGradient;
  const mg = mirrorPenpotGradient(g, true, false) as any;
  assert.ok(Math.abs(mg.startX - (1 - g.startX)) < 1e-12 && Math.abs(mg.endX - (1 - g.endX)) < 1e-12);
});

// ── 17. image flip: the two "square" rects carry the _fillFlip marker ────────

test('keynote: the 2 flipY image-fill "square" rects mark _fillFlip \'y\' with the shared media', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const flippedImages = all.filter((s) => isFlipped(s)
    && Array.isArray(s.fills) && s.fills.some((f: any) => f?.fillImage?.id != null));
  assert.equal(flippedImages.length, 2, 'exactly 2 flipped image-fill shapes');
  for (const s of flippedImages) {
    assert.equal(s.name, 'square');
    assert.equal(s.flipY, true);
    assert.notEqual(s.flipX, true, 'flipY only');
    const node = penpotShapeToNode(s) as any;
    assert.equal(node.kind, 'image');
    assert.equal(node._fillFlip, 'y', `shape ${s.id}: the marker the shell's media loader bakes`);
    assert.equal(node._fillImageId, '6aafd946-1972-8152-8008-0bae3c6b1f80', 'both share the one media');
  }
  const target = flippedImages.find((s) => s.id === 'adf652d7-b996-8054-8005-9d80912e9a89');
  assert.ok(target, 'the verified page-b2c5fbf9 "square" is one of them');
  // Unflipped image fills carry NO marker - the field stays absent, not ''.
  const plainImg = all.find((s) => !isFlipped(s)
    && Array.isArray(s.fills) && s.fills.some((f: any) => f?.fillImage?.id != null));
  assert.ok(plainImg, 'an unflipped image fill exists');
  assert.equal((penpotShapeToNode(plainImg!) as any)._fillFlip, undefined);
});

// ── token-first ingest: this deck declares NOTHING, so the fallback IS the path ─
// The graceful-fallback contract, pinned against a real file. Penpot omits
// files/<id>/tokens.json entirely for an empty token library and writes no
// appliedTokens on shapes, so a token-first import of this deck must land on
// exactly the usage-derived proposal the tests above assert, byte for byte.

test('keynote: the deck declares no in-file tokens and no applied token references', { skip: SKIP }, async () => {
  const { entries } = await loadDeck();

  const { doc, warnings } = extractPenpotProject(entries);
  assert.equal(doc, null, 'no files/<id>/tokens.json in the archive');
  assert.ok(warnings.some(w => w.includes('no tokens.json found')));
  assert.equal(Object.keys(entries).filter(p => /tokens\.json$/.test(p)).length, 0);

  assert.deepEqual(scanPenpotAppliedTokens(entries), [], 'not one shape carries appliedTokens');
});

test('keynote: with nothing declared the token-first path defers to the usage proposal', { skip: SKIP }, async () => {
  const { entries } = await loadDeck();
  const usage = scanPenpotUsage(entries);

  // Whatever a token-first read is handed here, it has no colour tokens to
  // rank, so it must decline rather than invent roles.
  assert.equal(proposeRolesFromTokens(extractPenpotProject(entries).doc, scanPenpotAppliedTokens(entries), usage), null);

  // And the fallback the shell then runs is unchanged.
  const roles = proposeBrandRoles(usage)!;
  assert.equal(roles.surface, '#151035');
  assert.equal(roles.primary, '#F23AE5');
});

// ── dash/gap strokes (Penpot 2.17, PR #9765) ─────────────────────────────────
// The deck predates the feature: 231 solid strokes, 2 dotted, 1 "none", 0 dashed,
// and not one strokeDash/strokeGap key. Only the "none" case is therefore
// assertable against THIS file; the authored dash/gap cases are covered against a
// real 2.17.1 export by the ungated tests/penpot-kitchen-sink.test.ts.

test('keynote: the one strokeStyle "none" in the deck is a legacy SHAPE-level key, not a strokes[] entry', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  // Not one strokes[] entry in this deck says "none" - the single hit the fixture
  // scan reported is the flat pre-strokes[] field still written at shape level.
  const entryNone = all.filter((s) => Array.isArray(s.strokes)
    && s.strokes.some((st: any) => String(st?.strokeStyle ?? '') === 'none'));
  assert.deepEqual(entryNone, [], 'no strokes[] entry carries style "none" in this export');

  const flatNone = all.filter((s) => String(s.strokeStyle ?? '') === 'none');
  assert.equal(flatNone.length, 1, 'exactly one shape carries the flat legacy key');
  const sh = flatNone[0]!;
  assert.deepEqual(sh.strokes, [], 'and its strokes[] is empty, so there is nothing to paint');

  // Which is what the importer already produces: an inert stroke row, and the new
  // dash/gap columns default to the no-op. The entry-level "none" skip stays
  // synthetic coverage (tests/design-map.test.ts): the kitchen-sink fixture authored
  // a "none over solid" stack on purpose and Penpot DROPPED the none entry at save,
  // so no real export is known to ship one.
  const box = finalizeBoxes([penpotShapeToNode(sh) as any])[0] as any;
  assert.deepEqual([box.stroke, box.strokeW, box.strokeDash], ['', 0, '']);
  assert.deepEqual([box.strokeDashLen, box.strokeGapLen], [0, 0]);
});

test('keynote: zero strokeDash/strokeGap keys anywhere (the negative pin)', { skip: SKIP }, async () => {
  const { all } = await loadDeck();
  const withKeys = all.filter((s) => Array.isArray(s.strokes)
    && s.strokes.some((st: any) => st && (st.strokeDash !== undefined || st.strokeGap !== undefined)));
  assert.deepEqual(withKeys, [], 'this export predates PR #9765');
  const dashed = all.filter((s) => Array.isArray(s.strokes)
    && s.strokes.some((st: any) => String(st?.strokeStyle ?? '') === 'dashed'));
  assert.equal(dashed.length, 0, 'and it authors no dashed strokes at all');
});

// ── background blur (Penpot 2.17 PR #10034) ──────────────────────────────────

test('keynote: zero backgroundBlur keys anywhere (the negative pin)', { skip: SKIP }, async () => {
  // This deck was written by penpot/2.17.1-RC4, which HAS the attribute, but the
  // designer never used it: every one of the 23 blur entries is a layer blur, and the
  // dedicated key never appears. The pin is what makes the positive cases in
  // design-bgblur.test.ts honestly synthetic rather than accidentally
  // contradicted by the one real file we hold - and it will fail loudly the day a
  // background-blur fixture lands, which is exactly when the mapping wants revisiting.
  const { all } = await loadDeck();
  assert.deepEqual(all.filter((s) => (s as any).backgroundBlur !== undefined), [],
    'no shape in the deck carries a backgroundBlur attribute');
  assert.deepEqual(all.filter((s) => String((s as any).blur?.type ?? '') === 'background-blur'), [],
    'and none carries the legacy in-blur spelling either');
  // So nothing in the deck maps to bgBlur, and the whole import is unchanged by v1.
  const withBg = all.map((s) => penpotBackgroundBlurPx(s)).filter((v) => v > 0);
  assert.equal(withBg.length, 0, 'penpotBackgroundBlurPx reads 0 for every shape in the file');
});

// ── components as templates: the 1.1 census ──────────────────────────────────
// (Appended block - imports hoist; kept here so the block stays append-only.)
import { collectPenpotComponents, penpotComponentSlots } from '../engine/src/design-components.ts';

/** The deck's parsed `files/<fid>/components/*.json` records. */
async function componentRecords(): Promise<Shape[]> {
  const { fileId, entries } = await loadDeck();
  const { strFromU8 } = await import('fflate');
  const dir = `files/${fileId}/components/`;
  return Object.entries(entries)
    .filter(([p]) => p.startsWith(dir) && p.endsWith('.json'))
    .map(([, b]) => JSON.parse(strFromU8(b)) as Shape);
}

test('keynote: exactly 6 component definitions with the known names and paths', { skip: SKIP }, async () => {
  const { fileId, pages } = await loadDeck();
  const recs = await componentRecords();
  assert.equal(recs.length, 6, 'six component records on disk');

  const out = collectPenpotComponents(recs, pages, { fileId });
  assert.deepEqual(out.warnings, [], 'every master resolves on its declared page');
  assert.deepEqual(out.components.map((c) => [c.path, c.name]), [
    ['text', 'TEXT 10'], ['text', 'TEXT 8'], ['text', 'TEXT 9'],
    ['titles', 'PERSON INTRO'], ['titles', 'TITLES2'], ['titles', 'TITLES4'],
  ], 'six definitions, sorted by path then name');

  // This deck predates variants/v1 authoring: no record carries a variantId, so
  // every component is a singleton and its id IS the record id. (The 2-variant
  // grouping is pinned ungated by tests/penpot-kitchen-sink.test.ts.)
  assert.ok(out.components.every((c) => !c.isVariantSet && c.variants.length === 1));
  assert.deepEqual(out.components.map((c) => c.id).sort(), recs.map((r) => String(r.id)).sort());
  assert.ok(out.components.every((c) => c.variants[0]!.properties.length === 0));
  assert.deepEqual([...new Set(out.components.map((c) => c.pageId))].length, 1, 'all 6 masters on one page');

  // Every master is the mainInstance frame the record points at, and it lives on
  // the "Main components" page the board/scene walks deliberately skip.
  const names = await pageNamesById();
  assert.equal(names.get(out.components[0]!.pageId), 'Main components');
  for (const c of out.components) {
    const master = pages.get(c.pageId)![c.rootShapeId] as Shape;
    assert.ok(master, `${c.name}: master shape resolved`);
    assert.equal(master.mainInstance, true);
    assert.equal(master.componentFile, fileId, 'a master names its own file');
  }

  // A master is NOT necessarily a componentRoot, and masters are NOT disjoint:
  // TEXT 9's master frame sits three levels inside PERSON INTRO's master (a
  // component nested in a component), so it carries mainInstance without
  // componentRoot and its 39 shapes are also part of PERSON INTRO's 537. A
  // template pass must therefore key on `mainInstanceId`, never on "the
  // componentRoot frames of the component page", and must expect overlap.
  const roots = out.components.filter((c) => (pages.get(c.pageId)![c.rootShapeId] as Shape).componentRoot === true);
  assert.equal(roots.length, 5, '5 of the 6 masters are componentRoot frames');
  const nested = out.components.find((c) => !roots.includes(c))!;
  assert.equal(nested.name, 'TEXT 9');
  const nestedMaster = pages.get(nested.pageId)![nested.rootShapeId] as Shape;
  assert.equal(nestedMaster.componentRoot, undefined);
  assert.equal((pages.get(nested.pageId)![nestedMaster.parentId] as Shape).name, 'backgrounds / screen dark 3');
  // …and the file id is inferable from exactly that, with no manifest in hand.
  assert.equal(collectPenpotComponents(recs, pages).localFileId, fileId);
});

test('keynote: each master subtree maps to boxes through the real resolvers', { skip: SKIP }, async () => {
  const { fileId, pages } = await loadDeck();
  const out = collectPenpotComponents(await componentRecords(), pages, { fileId });

  const census: Array<[string, number, number]> = [];
  for (const c of out.components) {
    const shapesById = pages.get(c.pageId)!;
    const sub: Shape[] = [];
    const seen = new Set<string>();
    const walk = (id: string): void => {
      if (seen.has(id)) return;
      seen.add(id);
      const s = shapesById[id];
      if (!s) return;
      sub.push(s);
      for (const k of (Array.isArray(s.shapes) ? s.shapes : [])) walk(String(k));
    };
    walk(c.rootShapeId);
    const nodes = sub.map((s) => penpotShapeToNode(s)).filter((n) => n != null);
    assert.equal(nodes.length, sub.length, `${c.name}: every shape in the subtree maps to a node`);
    const boxes = finalizeBoxes(nodes as never[]);
    assert.equal(boxes.length, nodes.length, `${c.name}: every node survives finalize`);
    // The master frame itself is board-sized - the template's canvas.
    const root = penpotShapeToNode(shapesById[c.rootShapeId]!) as any;
    assert.equal(Math.round(root.w), 895, `${c.name}: 895 wide`);
    assert.equal(Math.round(root.h), 503, `${c.name}: 503 tall`);
    census.push([c.name, sub.length, boxes.length]);
  }
  assert.deepEqual(census, [
    ['TEXT 10', 32, 32], ['TEXT 8', 17, 17], ['TEXT 9', 39, 39],
    ['PERSON INTRO', 537, 537], ['TITLES2', 19, 19], ['TITLES4', 541, 541],
  ], 'the master subtree sizes (they OVERLAP: TEXT 9 is nested inside PERSON INTRO)');
});

test('keynote: slot inference finds the lorem text leaves and the image fills', { skip: SKIP }, async () => {
  const { fileId, pages } = await loadDeck();
  const out = collectPenpotComponents(await componentRecords(), pages, { fileId });

  const slotsOf = (name: string) => {
    const c = out.components.find((x) => x.name === name)!;
    const shapesById = pages.get(c.pageId)!;
    return penpotComponentSlots(shapesById[c.rootShapeId], (id) => shapesById[id]);
  };

  // 18 slots across the 6 masters: 14 text, 4 image.
  const all = out.components.flatMap((c) => slotsOf(c.name));
  assert.equal(all.length, 18, '18 slots in total');
  assert.equal(all.filter((s) => s.kind === 'text').length, 14);
  assert.equal(all.filter((s) => s.kind === 'image').length, 4);
  assert.ok(all.every((s) => s.shapeId && s.label), 'every slot names a shape and carries the author’s label');

  // The evidence the plan rests on: a TEXT master is one lorem-ipsum leaf, which
  // is exactly the run the deck's four instances override with real copy.
  const t8 = slotsOf('TEXT 8');
  assert.equal(t8.length, 1);
  assert.equal(t8[0]!.kind, 'text');
  assert.ok(t8[0]!.text!.startsWith('Lorem ipsum dolor sit amet'), 'placeholder copy, by construction');
  assert.equal(t8[0]!.label, t8[0]!.text, 'Penpot names a text shape after its own content');

  // TITLES2 is the mixed case: two text slots around one image fill, whose
  // imageId is the media the shell resolves to bytes.
  assert.deepEqual(slotsOf('TITLES2').map((s) => [s.kind, s.label]),
    [['text', 'Presentation\nTitle'], ['image', 'penpot-logo-white'], ['text', 'Subtitle']]);
  assert.equal(slotsOf('TITLES2').find((s) => s.kind === 'image')!.imageId,
    '6aafd946-1972-8152-8008-0bae3c6b1f86');

  // The busiest master, in authored child order.
  assert.deepEqual(slotsOf('TITLES4').map((s) => s.kind),
    ['text', 'image', 'text', 'image', 'text', 'text', 'text', 'text']);
  assert.deepEqual(slotsOf('PERSON INTRO').map((s) => s.kind), ['image', 'text', 'text', 'text']);
  // Slot count is a tiny fraction of the subtree - the rest is decoration.
  assert.ok(slotsOf('PERSON INTRO').length * 100 < 537, 'four slots in a 537-shape master');
});

test('keynote: the external-library census is 6 instances across 3 files', { skip: SKIP }, async () => {
  const { fileId, pages } = await loadDeck();
  const out = collectPenpotComponents(await componentRecords(), pages, { fileId });

  assert.equal(out.externals.instances, 6, '6 instance roots point at foreign libraries');
  assert.deepEqual(out.externals.files, [
    '345886aa-f4d1-8033-8005-673825be8c85',
    '790b4dba-cade-8121-8005-9d9000e47c9f',
    'a1260e62-73b5-80f7-8004-a11f626f6a15',
  ], '3 distinct library files');
  assert.deepEqual(out.externals.components.map((c) => [c.name, c.componentFile, c.instances]), [
    ['graphic elements / box UI', '345886aa-f4d1-8033-8005-673825be8c85', 1],
    ['Part I / AX UX and both', '790b4dba-cade-8121-8005-9d9000e47c9f', 2],
    ['Part I / Classic challenges', '790b4dba-cade-8121-8005-9d9000e47c9f', 1],
    ['Part I / The end of the web?', '790b4dba-cade-8121-8005-9d9000e47c9f', 1],
    ['penpot-logo-white', 'a1260e62-73b5-80f7-8004-a11f626f6a15', 1],
  ], '5 distinct foreign components, one of them placed twice');

  // THE TRAP, pinned: 3 of those 5 foreign componentIds ALSO name a local
  // definition - the library was duplicated from this file, so ids survive.
  // "has no local definition" would have classed 4 of the 6 instances as local;
  // `componentFile` is the only honest test, which is what the collector uses.
  const localIds = new Set(out.components.map((c) => c.id));
  const shared = out.externals.components.filter((e) => localIds.has(e.componentId));
  assert.equal(shared.length, 3, 'TEXT 8 / TEXT 9 / TEXT 10 ids are reused by the foreign library');
  assert.equal(shared.reduce((n, e) => n + e.instances, 0), 4, 'covering 4 of the 6 external instances');

  // Instance accounting: 20 shapes carry a componentId - 6 masters, 8 local
  // copies, 6 foreign. Nothing else in the deck is component-linked.
  const { all } = await loadDeck();
  const linked = all.filter((s) => s.componentId);
  assert.equal(linked.length, 20);
  assert.equal(linked.filter((s) => s.mainInstance).length, 6);
  assert.equal(linked.filter((s) => !s.mainInstance && s.componentFile === fileId).length, 8);
  assert.equal(linked.filter((s) => s.componentFile !== fileId).length, 6);
});

test('keynote: PERSON INTRO’s master hydrates through the real design', { skip: SKIP }, async () => {
  const { fileId, pages } = await loadDeck();
  const out = collectPenpotComponents(await componentRecords(), pages, { fileId });
  const c = out.components.find((x) => x.name === 'PERSON INTRO')!;
  const shapesById = pages.get(c.pageId)!;

  const sub: Shape[] = [];
  const seen = new Set<string>();
  const walk = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const s = shapesById[id];
    if (!s) return;
    sub.push(s);
    for (const k of (Array.isArray(s.shapes) ? s.shapes : [])) walk(String(k));
  };
  walk(c.rootShapeId);
  const map = { fonts: { knownFamilies: ['Work Sans', 'Spline Sans Mono'] } };
  const boxes = finalizeBoxes(sub.map((s) => penpotShapeToNode(s)).filter((n) => n != null) as never[], map);
  assert.equal(boxes.length, 537);

  const PACK_DIR = join(ROOT, 'brands', 'lolly-start', 'tools');
  const tool: any = await loadTool('design', (p: string) => readFile(join(PACK_DIR, p), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const html = rt.getHydrated() as string;
  // The template's own slot content is what a filled-in copy would replace.
  assert.ok(html.includes('Pablo Ruiz-M'), 'the master text leaf reaches the markup');
  assert.ok(html.includes('Lorem ipsum'), 'and so does the placeholder body copy');
});

// ── components as templates: the 1.2 preview census ──────────────────────────
// (Appended block - imports hoist; kept here so the block stays append-only.)
import { penpotComponentThumb } from '../shells/web/src/lib/design-templates.ts';

test('keynote: every component preview belongs to an INSTANCE, so a master needs the fallback', { skip: SKIP }, async () => {
  const { fileId, pages, entries } = await loadDeck();
  const out = collectPenpotComponents(await componentRecords(), pages, { fileId });
  const byId: Record<string, Shape> = {};
  for (const shapes of pages.values()) Object.assign(byId, shapes);

  // `files/<fid>/thumbnails/component/<pageId>/<frameId>.json` → `objects/<mediaId>.png`.
  const ptrPaths = Object.keys(entries).filter((p) => p.includes('/thumbnails/component/'));
  assert.equal(ptrPaths.length, 8, 'eight component previews in this export');
  const frameIds = ptrPaths.map((p) => p.split('/').pop()!.replace(/\.json$/, ''));

  // NOT ONE of them depicts a master: Penpot writes a preview for a frame it has
  // rendered, and the masters sit on the components page. A template built off
  // the master alone would therefore be thumbnail-less for this whole deck - 
  // which is why the import falls back to an instance's preview.
  const masterIds = new Set(out.components.map((c) => c.rootShapeId));
  assert.equal(frameIds.filter((id) => masterIds.has(id)).length, 0, 'zero master previews');
  for (const c of out.components) {
    assert.equal(penpotComponentThumb(entries, fileId, c.pageId, c.rootShapeId), null, `${c.name}: no own preview`);
  }

  // Of the 8, three are LOCAL instances - one each for TITLES4, TITLES2 and
  // PERSON INTRO - and those three templates get a real PNG through the
  // fallback. The other five are foreign instances or uncomponented frames.
  const localHits = new Map<string, string>();
  for (const frameId of frameIds) {
    const s = byId[frameId];
    if (!s || String(s.componentFile ?? '') !== fileId) continue;
    const owner = out.components.find((c) => c.variants.some((v) => v.id === String(s.componentId)));
    if (owner) localHits.set(owner.name, frameId);
  }
  assert.deepEqual([...localHits.keys()].sort(), ['PERSON INTRO', 'TITLES2', 'TITLES4']);
  const pageOf = (shapeId: string): string => [...pages.keys()].find((pid) => pages.get(pid)![shapeId])!;
  for (const [name, frameId] of localHits) {
    const url = penpotComponentThumb(entries, fileId, pageOf(frameId), frameId);
    assert.match(url ?? '', /^data:image\/png;base64,/, `${name}: the fallback resolves a real PNG`);
  }

  // THE TRAP AGAIN: four of the eight preview frames are FOREIGN instances whose
  // componentIds also name local components (TEXT 8/9/10). Matching on
  // componentId alone would hand three keynote templates a library's picture.
  const foreign = frameIds.map((id) => byId[id])
    .filter((s): s is Shape => !!s && !!s.componentId && String(s.componentFile) !== fileId);
  assert.equal(foreign.length, 4);
  const localRecordIds = new Set(out.components.flatMap((c) => c.variants.map((v) => v.id)));
  assert.equal(foreign.filter((s) => localRecordIds.has(String(s.componentId))).length, 4,
    'all four reuse a local componentId — componentFile is the only honest test');
});
