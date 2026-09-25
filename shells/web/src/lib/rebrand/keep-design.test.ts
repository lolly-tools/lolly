// SPDX-License-Identifier: MPL-2.0
/**
 * Keep the design (plan 274 mode A), over the real patch path.
 *
 * `host.pptx` here is the node-shell bridge the CLI builds (`createPptxAPI` with a
 * jsdom parser), so inspect, the brand mapping and `rebrandPptxParts` are the
 * shipping code. What these tests pin:
 *
 *   - the preview has the geometry of the original, frame by frame and layer by
 *     layer, so the wipe in the view compares like with like;
 *   - the preview's picture refs are the refs the original read stored, and the
 *     sink was never asked about a picture the original did not already hold (the
 *     patch leaves media alone, byte for byte);
 *   - the patch really changed something, and the summary counts say what;
 *   - a host without `host.pptx`, bytes that are not a deck, and an aborted signal
 *     are each refused by name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { compileFaithful, neutralSlideMaster, type RebrandDesignSystemInputV1 } from '@lolly/engine';
import { createPptxAPI, inflatePptx } from '@lolly-tools/node-shell/pptx';
import { sourceDeckFromPptx } from '@lolly-tools/node-shell/rebrand/source-pptx';
import type { CompiledDeckV1 } from '@lolly-tools/core/rebrand-v1';
import { KeepDesignError, keepDesignPatch, keepDesignPlan, keepDesignSwatches, keepDesignTheme } from './keep-design.ts';

const REPO = new URL('../../../../../', import.meta.url);
const SIMPLE = new Uint8Array(readFileSync(new URL('tests/fixtures/rebrand/simple.pptx', REPO)));

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml');

/** The ref rule both reads share: what an ingest that keys pictures by content would mint. */
const refOf = (hash: string): string => `user/media/${hash}`;

const SYSTEM: RebrandDesignSystemInputV1 = {
  id: 'test/keep',
  name: 'Test design system',
  master: neutralSlideMaster(),
  colors: {
    'color.semantic.text': '#0c322c',
    'color.semantic.surface': '#ffffff',
    'color.semantic.muted': '#5a6b67',
    'color.semantic.primary': '#30ba78',
    'color.semantic.secondary': '#2453ff',
    'color.semantic.accent': '#fe7c3f',
  },
  fonts: { brand: 'SUSE', mono: 'SUSE Mono' },
};

const host = { pptx: createPptxAPI({ parseXml }) };

async function originalRead(): Promise<{ faithful: CompiledDeckV1; stored: Set<string> }> {
  const stored = new Set<string>();
  const deck = await sourceDeckFromPptx(await inflatePptx(SIMPLE), parseXml, {
    hash: 'sha256:original',
    instanceId: 'original',
    sink: async (_bytes, _mime, hash) => {
      stored.add(hash);
      return refOf(hash);
    },
    reader: { name: 'pptx-read', version: 'test' },
  });
  return { faithful: compileFaithful(deck), stored };
}

const GEOMETRY = ['id', 'kind', 'frame', 'x', 'y', 'w', 'h', 'rot', 'flipH', 'flipV', 'image', 'fit', 'hidden'] as const;

test('the preview has the original geometry frame by frame, and its pictures are the ones the original stored', async () => {
  const { faithful, stored } = await originalRead();
  const asked: string[] = [];
  const keep = keepDesignPatch(host, {
    parseXml,
    mediaRef: (hash) => {
      asked.push(hash);
      return refOf(hash);
    },
  });
  const result = await keep({ bytes: SIMPLE, system: SYSTEM, signal: new AbortController().signal });

  assert.equal(result.preview.frames.length, faithful.frames.length, 'one preview frame per original frame');
  assert.ok(faithful.frames.length > 0);
  result.preview.frames.forEach((after, i) => {
    const before = faithful.frames[i];
    assert.ok(before);
    assert.equal(after.id, before.id, `frame ${i} id`);
    assert.equal(after.sourceSlideId, before.sourceSlideId, `frame ${i} slide`);
    assert.equal(after.width, before.width, `frame ${i} width`);
    assert.equal(after.height, before.height, `frame ${i} height`);
    assert.equal(after.layers.length, before.layers.length, `frame ${i} layer count`);
    after.layers.forEach((row, j) => {
      const was = before.layers[j];
      assert.ok(was);
      for (const key of GEOMETRY) assert.equal(row[key], was[key], `frame ${i} layer ${j} ${key}`);
    });
  });

  // The sink stored nothing new: every picture it was asked about is one the
  // original read already held, and all of them came back.
  assert.ok(stored.size > 0, 'the fixture holds pictures');
  assert.deepEqual(new Set(asked), stored);
  const refsOf = (deck: CompiledDeckV1): string[] =>
    deck.frames.flatMap((frame) => frame.layers.map((row) => row.image).filter((ref): ref is string => typeof ref === 'string' && ref !== ''));
  assert.deepEqual(refsOf(result.preview), refsOf(faithful));
  assert.ok(refsOf(faithful).length > 0);

  // The media parts of the package are byte for byte the original's.
  const beforeParts = await inflatePptx(SIMPLE);
  const afterParts = await inflatePptx(result.bytes);
  const media = Object.keys(beforeParts).filter((path) => path.startsWith('ppt/media/'));
  assert.ok(media.length > 0);
  for (const path of media) assert.deepEqual(afterParts[path], beforeParts[path], path);

  // And the patch did change the deck.
  assert.notDeepEqual(result.bytes, SIMPLE);
  assert.ok(result.changes.themeSlots > 0, 'theme colours changed');
  assert.ok(result.changes.fonts.some((font) => font.to === 'SUSE'), 'a face moved to the design system face');
  const styled = (deck: CompiledDeckV1): string =>
    JSON.stringify(deck.frames.map((frame) => frame.layers.map((row) => [row.bg, row.fg])));
  assert.notEqual(styled(result.preview), styled(faithful), 'the preview draws the new colours');
});

test('the default ref is the exact media hash', async () => {
  const keep = keepDesignPatch(host, { parseXml });
  const result = await keep({ bytes: SIMPLE, system: SYSTEM, signal: new AbortController().signal });
  const refs = result.preview.frames.flatMap((frame) => frame.layers.map((row) => row.image)).filter((ref) => typeof ref === 'string' && ref);
  assert.ok(refs.length > 0);
  for (const ref of refs) assert.match(String(ref), /^sha256:[0-9a-f]{64}$/);
});

test('a host without host.pptx is refused by name', async () => {
  const keep = keepDesignPatch({}, { parseXml });
  await assert.rejects(
    keep({ bytes: SIMPLE, system: SYSTEM, signal: new AbortController().signal }),
    (error: unknown) => error instanceof KeepDesignError && error.code === 'pptx-unavailable',
  );
});

test('bytes that are not a deck are refused by name', async () => {
  const keep = keepDesignPatch(host, { parseXml });
  await assert.rejects(
    keep({ bytes: new TextEncoder().encode('not a deck'), system: SYSTEM, signal: new AbortController().signal }),
    (error: unknown) => error instanceof KeepDesignError && error.code === 'not-a-deck',
  );
});

test('an aborted signal stops the run before the patch', async () => {
  let patched = 0;
  const counting = {
    pptx: {
      inspect: host.pptx.inspect,
      rebrand: async (...args: Parameters<typeof host.pptx.rebrand>) => {
        patched += 1;
        return host.pptx.rebrand(...args);
      },
    },
  };
  const controller = new AbortController();
  controller.abort();
  const keep = keepDesignPatch(counting, { parseXml });
  await assert.rejects(keep({ bytes: SIMPLE, system: SYSTEM, signal: controller.signal }), (error: unknown) =>
    error instanceof Error && error.name === 'AbortError');
  assert.equal(patched, 0);
});

test('the plan drops identity rows and counts only real changes', () => {
  const planned = keepDesignPlan({
    ok: true,
    slideCount: 1,
    theme: { colors: { dk1: '#000000', lt1: '#FFFFFF', accent1: '#FF0000' }, majorFont: 'Calibri', minorFont: 'SUSE' },
    colors: [
      { hex: '#123456', suggested: '#30BA78' },
      { hex: '#30BA78', suggested: '#30ba78' },
      { hex: '#ABCDEF' },
    ],
    fonts: [
      { family: 'Calibri', suggested: 'SUSE' },
      { family: 'SUSE', suggested: 'SUSE' },
      { family: 'Arial', suggested: 'SUSE' },
    ],
    themeSuggestion: { dk1: '#000000', lt1: '#FAFAFA', accent1: '#30BA78', majorFont: 'SUSE', minorFont: 'SUSE' },
  });
  assert.equal(planned.themeSlots, 2, 'lt1 and accent1 moved, dk1 did not');
  assert.equal(planned.colours, 1);
  assert.deepEqual(planned.plan.colorMap, { '#123456': '#30BA78' });
  assert.deepEqual(planned.plan.fontMap, { Calibri: 'SUSE', Arial: 'SUSE' });
  assert.deepEqual(planned.fonts, [{ from: 'Calibri', to: 'SUSE' }, { from: 'Arial', to: 'SUSE' }]);
  assert.equal(planned.plan.dropEmbeddedFonts, true);
});

test('swatches carry the token path as name and role hint, in path order', () => {
  assert.deepEqual(keepDesignSwatches({ 'color.b': '#111111', 'color.a': '#222222', 'color.c': '' }), [
    { hex: '#222222', name: 'color.a', role: 'color.a' },
    { hex: '#111111', name: 'color.b', role: 'color.b' },
  ]);
});

// ─── the theme slots come from the design system tokens ──────────────────────

/**
 * The SUSE colour tokens as `host.tokens` hands them to the journey: the base set with
 * the light theme over it, every reference resolved. Null when the private brand pack
 * is not on disk (a public clone).
 */
function suseColors(): Record<string, string> | null {
  const url = new URL('brands/suse/catalog/assets/suse/tokens/brand.json', REPO);
  if (!existsSync(url)) return null;
  const doc: unknown = JSON.parse(readFileSync(url, 'utf8'));
  const raw = new Map<string, string>();
  const walk = (node: unknown, path: string[]): void => {
    if (!node || typeof node !== 'object') return;
    const value = Reflect.get(node, '$value');
    if (typeof value === 'string') {
      raw.set(path.join('.'), value);
      return;
    }
    for (const [key, child] of Object.entries(node)) if (!key.startsWith('$')) walk(child, [...path, key]);
  };
  if (doc && typeof doc === 'object') {
    walk(Reflect.get(doc, 'base'), []);
    walk(Reflect.get(doc, 'light'), []);
  }
  const resolve = (value: string, depth = 0): string | undefined => {
    const ref = /^\{(.+)\}$/.exec(value.trim());
    if (!ref) return /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : undefined;
    const next = ref[1] ? raw.get(ref[1]) : undefined;
    return next === undefined || depth > 8 ? undefined : resolve(next, depth + 1);
  };
  const out: Record<string, string> = {};
  for (const [path, value] of raw) {
    const hex = resolve(value);
    if (hex && path.startsWith('color.')) out[path] = hex;
  }
  return out;
}

/**
 * A stand-in with the property that broke the patch: the text colour is a tinted dark,
 * so the only neutrals the suggestion can pick for dk1 are light ones.
 */
const TINTED_INK: Record<string, string> = {
  'color.semantic.text': '#0c322c',
  'color.semantic.surface': '#ffffff',
  'color.semantic.on-primary': '#ffffff',
  'color.semantic.primary': '#0c322c',
  'color.semantic.secondary': '#30ba78',
  'color.semantic.muted': '#6f6f6f',
  'color.brand.fog': '#efefef',
  'color.brand.mint': '#90ebcd',
  'color.brand.persimmon': '#fe7c3f',
};

const COLOURS = suseColors() ?? TINTED_INK;

function luminance(hex: string): number {
  const channel = (at: number): number => {
    const c = Number.parseInt(hex.replace(/^#/, '').slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

test('the patched theme takes dk1 and lt1 from the text and surface tokens, so dark text stays dark on a light slide', async () => {
  const system: RebrandDesignSystemInputV1 = { ...SYSTEM, colors: COLOURS };
  const adversarial = new Uint8Array(readFileSync(new URL('tests/fixtures/rebrand/adversarial.pptx', REPO)));
  const keep = keepDesignPatch(host, { parseXml });
  const result = await keep({ bytes: adversarial, system, signal: new AbortController().signal });

  // The theme part the patch wrote holds the design system's own text and surface colours.
  const inspected = await host.pptx.inspect(result.bytes);
  const text = COLOURS['color.semantic.text'];
  const surface = COLOURS['color.semantic.surface'];
  assert.ok(text && surface, 'the token set names a text and a surface colour');
  assert.equal(inspected.theme.colors.dk1?.toUpperCase(), text.toUpperCase(), 'dk1 is the text token');
  assert.equal(inspected.theme.colors.lt1?.toUpperCase(), surface.toUpperCase(), 'lt1 is the surface token');

  // Read back, the first text run that states its colour (the title, set in tx1) is
  // readable against its slide. A slide that states no ground is drawn on white.
  const frame = result.preview.frames[0];
  assert.ok(frame);
  const ground = String(frame.layers.find((row) => row.kind === 'frame')?.bg ?? '#ffffff');
  const first = frame.layers.find((row) => row.kind === 'text' && typeof row.fg === 'string' && typeof row.text === 'string' && row.text.trim() !== '');
  assert.ok(first, 'the slide has text with a stated colour');
  assert.equal(first.text, 'Quarterly review');
  const ink = String(first.fg);
  assert.ok(contrast(ink, ground) >= 4.5, `text ${ink} on ${ground} reads at ${contrast(ink, ground).toFixed(2)}:1`);
});

test('keepDesignTheme overrides only the slots a token names', () => {
  const theme = keepDesignTheme(
    { dk1: '#FFFFFF', lt1: '#FFFFFF', accent4: '#123456', hlink: '#30BA78', majorFont: 'SUSE' },
    { 'color.semantic.text': '#0c322c', 'color.semantic.surface': '#fafafa' },
  );
  assert.deepEqual(theme, { dk1: '#0C322C', lt1: '#FAFAFA', accent4: '#123456', hlink: '#30BA78', majorFont: 'SUSE' });
  assert.equal(keepDesignTheme(undefined, {}), undefined);
});

test('keepDesignTheme takes a token in any CSS colour form, never falling back to the suggestion', () => {
  const suggestion = { dk1: '#FFFFFF', lt1: '#FFFFFF', dk2: '#FFFFFF' };
  const short = keepDesignTheme(suggestion, { 'color.semantic.text': '#123', 'color.semantic.surface': 'rgb(12, 50, 44)', 'color.semantic.muted': 'fafafa' });
  assert.deepEqual(short, { dk1: '#112233', lt1: '#0C322C', dk2: '#FAFAFA' });
  const wide = keepDesignTheme(suggestion, { 'color.semantic.text': 'oklch(0% 0 0)', 'color.semantic.surface': '#0C322C80' });
  assert.equal(wide?.dk1, '#000000');
  assert.equal(wide?.lt1, '#0C322C', 'the alpha is dropped, the colour kept');
  // Only a value that is not a colour keeps the suggestion.
  assert.equal(keepDesignTheme(suggestion, { 'color.semantic.text': 'var(--ink)' })?.dk1, '#FFFFFF');
});
