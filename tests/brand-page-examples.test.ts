// SPDX-License-Identifier: MPL-2.0
/**
 * The brand page's examples read under any design system. A template's shape reads a slot
 * such as `--brand-primary`, and that slot can be the colour of the ground the example
 * paints, which hid Lolly Demo's poster disc. Each shape is now measured against what it
 * sits on and what sits on it, in every colourway and look, and the values carry no brand
 * variable, so the render needs no theme of its own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastRatio, createTokenSet } from '@lolly/engine';
import { readTokenAxes, axisOfKind, modeAxis } from '../engine/src/token-axes.ts';
import { BRAND_PAGE_EXAMPLES, brandPageExampleValues, fitBrandPageExampleText } from '../packages/node-shell/src/brand-page.ts';
import { createNodeTextShaper, measureFontsFromTokens } from '../packages/node-shell/src/text-measure.ts';
import { measureDesignText, textMeasureSpecOfRow } from '../engine/src/design-text-measure.ts';

type Row = Record<string, unknown>;
const load = (path: string): Row => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const SYSTEMS: Record<string, () => Row> = {
  'Lolly Demo': () => load('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json'),
  'Lolly Start': () => load('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json'),
  Wefthouse: () => load('./fixtures/colour-roles/wefthouse.tokens.json'),
};

/** Every colourway and look a system offers, as selections. */
function selections(doc: Row): Array<Record<string, string>> {
  const axes = readTokenAxes(doc).axes;
  const colourway = axisOfKind(axes, 'colourway');
  const mode = modeAxis(axes);
  const out: Array<Record<string, string>> = [];
  for (const cw of colourway?.options ?? [null]) for (const look of mode?.options ?? [null]) {
    out.push({ ...(mode && look ? { [mode.group]: look.id } : {}), ...(colourway && cw ? { [colourway.group]: cw.id } : {}) });
  }
  return out;
}

/** How much of `b`'s box lies inside `a`'s, from 0 to 1. */
const coverage = (a: Row, b: Row): number => {
  const n = (v: unknown): number => Number(v) || 0;
  const w = Math.min(n(a.x) + n(a.w), n(b.x) + n(b.w)) - Math.max(n(a.x), n(b.x));
  const h = Math.min(n(a.y) + n(a.h), n(b.y) + n(b.h)) - Math.max(n(a.y), n(b.y));
  return w > 0 && h > 0 ? (w * h) / (n(b.w) * n(b.h)) : 0;
};

test('every shape in every example stands 2:1 from its frame, the shapes under it and the words on it, or as far as the design system allows, in every colourway and look', () => {
  for (const [name, make] of Object.entries(SYSTEMS)) {
    const doc = make();
    const all = selections(doc);
    assert.ok(all.length >= 2, `${name} has looks to check`);
    for (const selection of all) for (const example of BRAND_PAGE_EXAMPLES) {
      const values = brandPageExampleValues(doc, selection, example)!;
      assert.ok(values, `${name} ${example.id}`);
      assert.ok(!JSON.stringify(values).includes('var(--brand-'), `${name} ${example.id}: no brand variable is left for the render to read in another theme`);
      const frame = values.boxes.find(b => b.kind === 'frame')!;
      const shapes = values.boxes.filter(b => b.kind === 'box');
      assert.ok(shapes.length, `${name} ${example.id} has a shape to check`);
      // The slot colours a shape could have taken, for when no colour reaches the floor.
      const slots = createTokenSet(doc, { selection }).colors().filter(c => /^color\.semantic\.[a-z-]+$/.test(c.path)).map(c => c.value);
      const texts = values.boxes.filter(b => b.kind === 'text');
      for (const [i, shape] of shapes.entries()) {
        // The ground, the shapes drawn before it that it crosses, and words covering a twentieth of it or more.
        const against = [frame.bg, ...shapes.slice(0, i).filter(s => coverage(s, shape) > 0).map(s => s.bg), ...texts.filter(t => coverage(t, shape) >= 0.05).map(t => t.fg)].map(String);
        const worst = (colour: string): number => Math.min(...against.map(other => contrastRatio(colour, other)));
        const best = Math.max(...slots.map(worst));
        const ratio = worst(String(shape.bg));
        assert.ok(ratio >= Math.min(2, best) - 0.01, `${name} ${JSON.stringify(selection)} ${example.id}: ${shape.id} ${shape.bg} stands ${ratio.toFixed(2)}:1 from what it touches, and ${best.toFixed(2)}:1 was possible`);
      }
    }
  }
});

test('Lolly Demo\'s poster disc no longer takes the colour of the ground', () => {
  const doc = SYSTEMS['Lolly Demo']!();
  const poster = BRAND_PAGE_EXAMPLES.find(e => e.id === 'poster')!;
  for (const selection of selections(doc)) {
    const { boxes } = brandPageExampleValues(doc, selection, poster)!;
    const frame = boxes.find(b => b.id === 'frame')!;
    const disc = boxes.find(b => b.id === 'disc')!;
    assert.notEqual(String(disc.bg).toLowerCase(), String(frame.bg).toLowerCase(), JSON.stringify(selection));
  }
});

test('a shape that already reads keeps the colour the template gave it', () => {
  const doc = SYSTEMS['Lolly Demo']!();
  const slide = BRAND_PAGE_EXAMPLES.find(e => e.id === 'slide-content')!;
  const values = brandPageExampleValues(doc, {}, slide)!;
  const accent = values.boxes.find(b => b.id === 's2accent')!;
  const primary = String((JSON.parse(JSON.stringify(values)) as { boxes: Row[] }).boxes.find(b => b.id === 's2title')!.fg);
  assert.equal(accent.bg, primary, 'the slide accent is the lead colour, which reads on the surface');
});

// ─── The title slide: the whole heading, and a mark that reads on its ground ──────

const LIGHT_MARK = 'test/logo/on-light', DARK_MARK = 'test/logo/on-dark';
const logos = { onLight: LIGHT_MARK, onDark: DARK_MARK };

test('each example heading fits its box, shrinking only as far as it must, in every colourway and look and with a long heading', async () => {
  const measured = async (row: Row, doc: Row): Promise<boolean> => {
    const fonts = measureFontsFromTokens(doc);
    return !!(await measureDesignText({ ...textMeasureSpecOfRow(row, fonts), fonts }, createNodeTextShaper())).overflow?.clipped;
  };
  for (const [name, make] of Object.entries(SYSTEMS)) {
    const doc = make();
    for (const [n, selection] of selections(doc).entries()) for (const example of BRAND_PAGE_EXAMPLES) {
      for (const long of n === 0 ? [false, true] : [false]) {
        const values = brandPageExampleValues(doc, selection, example)!;
        if (long) for (const b of values.boxes) if (b.kind === 'text' && /title$/.test(String(b.id))) b.text = 'Make room for your next idea, and the one after that, all in one place.';
        const before = new Map(values.boxes.map(b => [b.id, b.fontSize]));
        await fitBrandPageExampleText(values, doc);
        for (const row of values.boxes.filter(b => b.kind === 'text')) {
          const label = `${name} ${JSON.stringify(selection)} ${example.id}${long ? ' long' : ''} ${row.id}`;
          assert.equal(await measured(row, doc), false, `${label}: the words fit at ${row.fontSize}px`);
          assert.ok(Number(row.fontSize) <= Number(before.get(row.id)), `${label}: never larger than the template set`);
          if (Number(row.fontSize) < Number(before.get(row.id))) assert.equal(await measured({ ...row, fontSize: Number(row.fontSize) + 1 }, doc), true, `${label}: the largest size that fits`);
        }
      }
    }
  }
});

test('the title slide\'s heading, cut at its third line before, now fits whole', async () => {
  const doc = SYSTEMS['Lolly Demo']!();
  const slide = BRAND_PAGE_EXAMPLES.find(e => e.id === 'slide-title')!;
  const values = brandPageExampleValues(doc, {}, slide)!;
  const title = values.boxes.find(b => b.id === 's1title')!;
  assert.equal(title.fontSize, 196);
  await fitBrandPageExampleText(values, doc);
  assert.ok(Number(title.fontSize) < 196, `shrunk to ${title.fontSize}px`);
});

test('the mark is the variant made for what it sits on, and sits where a variant reads, in every colourway and look', () => {
  const inkOf = (id: unknown): string => (id === LIGHT_MARK ? '#000000' : '#ffffff');
  const sample = (values: { boxes: Row[] }, frameBg: string): string[] => {
    const mark = values.boxes.find(b => b.id === 'brand-device')!;
    const shapes = values.boxes.filter(b => b.kind === 'box');
    const out: string[] = [];
    for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.5, 1]) {
      const x = Number(mark.x) + Number(mark.w) * fx, y = Number(mark.y) + Number(mark.h) * fy;
      const hit = [...shapes].reverse().find(s => {
        const dx = (x - Number(s.x)) / Number(s.w), dy = (y - Number(s.y)) / Number(s.h);
        return s.shape === 'ellipse' ? (dx - 0.5) ** 2 + (dy - 0.5) ** 2 <= 0.25 : dx >= 0 && dx <= 1 && dy >= 0 && dy <= 1;
      });
      out.push(String(hit?.bg ?? frameBg));
    }
    return out;
  };
  let onDisc = 0;
  for (const [name, make] of Object.entries(SYSTEMS)) {
    const doc = make();
    for (const selection of selections(doc)) for (const example of BRAND_PAGE_EXAMPLES) {
      const values = brandPageExampleValues(doc, selection, example, { logos })!;
      const frame = values.boxes.find(b => b.kind === 'frame')!;
      const under = sample(values, String(frame.bg));
      if (under.some(c => c !== frame.bg)) onDisc += 1;
      const chosen = values.boxes.find(b => b.id === 'brand-device')!.image;
      const worst = (ink: string): number => Math.min(...under.map(c => contrastRatio(ink, c)));
      const other = chosen === LIGHT_MARK ? DARK_MARK : LIGHT_MARK;
      assert.ok(worst(inkOf(chosen)) >= 3 || worst(inkOf(chosen)) >= worst(inkOf(other)), `${name} ${JSON.stringify(selection)} ${example.id}: ${chosen} on ${under.join(' ')}`);
      assert.ok(worst(inkOf(chosen)) >= 3, `${name} ${JSON.stringify(selection)} ${example.id}: the mark reads at ${worst(inkOf(chosen)).toFixed(2)}:1 on ${under.join(' ')}`);
    }
  }
  assert.ok(onDisc > 0, 'some marks sit on a shape, which is the case this covers');
  // One variant offered is the one placed; a fixed choice still wins.
  const slide = BRAND_PAGE_EXAMPLES.find(e => e.id === 'slide-title')!;
  assert.equal(brandPageExampleValues(SYSTEMS['Lolly Demo']!(), {}, slide, { logos: { onLight: LIGHT_MARK } })!.boxes.find(b => b.id === 'brand-device')!.image, LIGHT_MARK);
  assert.equal(brandPageExampleValues(SYSTEMS['Lolly Demo']!(), {}, slide, { logo: LIGHT_MARK, logos })!.boxes.find(b => b.id === 'brand-device')!.image, LIGHT_MARK);
  assert.equal(brandPageExampleValues(SYSTEMS['Lolly Demo']!(), {}, slide, { logos: {} })!.boxes.find(b => b.id === 'brand-device'), undefined);
});
