// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 W4, E20: a deck composed for more than one theme is one document that
 * follows the theme with no script. Every colour the master takes from a token path is
 * stored as the literal plus a `tokenLinks` entry, `under` and `over` colour references
 * are lowered to literals plus links, and a slide whose ground comes from a dark deck
 * draws the light archetype when the master's colours follow the theme. One theme keeps
 * the rows it always had.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-compose-themes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { composeDesignSlides } from '../engine/src/design-compose.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { readBlockTokenBindings, resolveBlockTokenBindings } from '../engine/src/token-block-bindings.ts';
import type { BlockFieldSpec, InputValue } from '../engine/src/inputs.ts';
import { resolveProfileDesignSystem } from '../packages/node-shell/src/rebrand/design-system.ts';
import { composeDesign } from '../packages/node-shell/src/design-compose.ts';

type Row = Record<string, unknown>;
const ROOT = new URL('../', import.meta.url);
const START_TOKENS = fileURLToPath(new URL('brands/lolly-start/catalog/assets/lolly/tokens/brand.json', ROOT));
const startDoc = JSON.parse(readFileSync(START_TOKENS, 'utf8'));
const light = createTokenSet(startDoc, { theme: 'light' });
const dark = createTokenSet(startDoc, { theme: 'dark' });
const hex = (set: typeof light, path: string): string => String(set.get(path)?.value).toLowerCase();
const COLOUR_FIELDS: BlockFieldSpec[] = ['bg', 'fg', 'stroke', 'shadowColor'].map((id) => ({ id, type: 'color' as const }));
const inTheme = (rows: Row[], set: typeof light): Row[] => resolveBlockTokenBindings(rows as InputValue[], 'tokenLinks', COLOUR_FIELDS, set) as Row[];
const raw = (rows: Row[]): string[] => rows.flatMap((r) => ['bg', 'fg', 'stroke'].filter((f) => typeof r[f] === 'string' && /^\s*(\{|var\()/.test(r[f] as string)).map((f) => `${String(r.id)}.${f}`));

async function startMaster() {
  const resolved = await resolveProfileDesignSystem({ profile: 'lolly-start' });
  assert.ok(resolved);
  return resolved.input as unknown as { master: never; colors: Record<string, string>; logos: Record<string, string> };
}

const SPEC = {
  slides: [
    { archetype: 'content', slots: { title: 'Tides', body: 'Low at six.' } },
    { archetype: 'title', slots: { title: 'Harbour lights' } },
    {
      archetype: 'content', slots: { title: 'Charts' },
      under: [{ kind: 'box', x: 0, y: 0, w: 400, h: 200, bg: '{color.semantic.surface}' }],
      over: [{ kind: 'text', x: 40, y: 40, w: 600, h: 80, text: 'A caption', fg: '{color.semantic.text}' }],
    },
  ],
};

test('composed for two themes, every master colour and every under/over reference is a literal plus a link', async () => {
  const { master, colors, logos } = await startMaster();
  const ctx = { master, masterOrigin: 'catalog' as const, resolveToken: (p: string) => colors[p], logos, tokens: light };
  const doc = composeDesignSlides({ ...SPEC, themes: ['light', 'dark'] } as never, ctx).document;
  const rows = doc.boxes as Row[];
  assert.deepEqual(raw(rows), [], 'no reference is stored raw');
  const frame = rows.find((r) => r.id === 's01')!;
  assert.equal(frame.bg, hex(light, 'color.semantic.surface'));
  assert.equal(readBlockTokenBindings(frame.tokenLinks).bg?.ref, '{color.semantic.surface}');
  const title = rows.find((r) => r.id === 's01.title')!;
  assert.equal(readBlockTokenBindings(title.tokenLinks).fg?.ref, '{color.semantic.text}');
  const under = rows.find((r) => r.id === 's03.under-1')!;
  assert.equal(under.bg, hex(light, 'color.semantic.surface'));
  assert.equal(readBlockTokenBindings(under.tokenLinks).bg?.ref, '{color.semantic.surface}');
  const over = rows.find((r) => r.id === 's03.over-1')!;
  assert.equal(readBlockTokenBindings(over.tokenLinks).fg?.ref, '{color.semantic.text}');
  // Every colour a master token path gave is linked: no frame or text colour is left literal-only.
  for (const row of rows) {
    for (const field of ['bg', 'fg']) {
      if (typeof row[field] !== 'string' || !row[field] || (row[field] as string).length > 7) continue;
      assert.ok(readBlockTokenBindings(row.tokenLinks)[field], `${String(row.id)}.${field} carries a link`);
    }
  }
  // The same rows in dark: the document follows the theme with no script.
  const darkRows = inTheme(rows, dark);
  assert.equal(darkRows.find((r) => r.id === 's01')!.bg, hex(dark, 'color.semantic.surface'));
  assert.equal(darkRows.find((r) => r.id === 's01.title')!.fg, hex(dark, 'color.semantic.text'));
  assert.equal(darkRows.find((r) => r.id === 's03.under-1')!.bg, hex(dark, 'color.semantic.surface'));
  assert.equal(darkRows.find((r) => r.id === 's03.over-1')!.fg, hex(dark, 'color.semantic.text'));
  // And back.
  assert.deepEqual(inTheme(darkRows, light).map((r) => [r.bg, r.fg]), rows.map((r) => [r.bg, r.fg]));
});

test('a dark deck for two themes draws the light archetype where the master\'s colours follow the theme', async () => {
  const { master, colors, logos } = await startMaster();
  const ctx = { master, masterOrigin: 'catalog' as const, resolveToken: (p: string) => colors[p], logos };
  const spec = { theme: 'dark', slides: [{ archetype: 'content', slots: { title: 'Tides', body: 'Low at six.' } }] };
  const one = composeDesignSlides(spec as never, ctx);
  assert.equal(one.report.slides[0]!.archetype, 'content-dark');
  const two = composeDesignSlides({ ...spec, themes: ['light', 'dark'] } as never, { ...ctx, tokens: dark });
  assert.equal(two.report.slides[0]!.archetype, 'content');
  assert.equal(two.report.slides[0]!.ground, 'dark');
  const rows = two.document.boxes as Row[];
  const frame = rows.find((r) => r.id === 's01')!;
  assert.equal(frame.bg, hex(dark, 'color.semantic.surface'));
  assert.equal(readBlockTokenBindings(frame.tokenLinks).bg?.ref, '{color.semantic.surface}');
  // In light the same slide is the light content slide.
  assert.equal(inTheme(rows, light).find((r) => r.id === 's01')!.bg, hex(light, 'color.semantic.surface'));
});

test('one theme keeps the rows it always had: no master colour is linked', async () => {
  const { master, colors, logos } = await startMaster();
  const ctx = { master, masterOrigin: 'catalog' as const, resolveToken: (p: string) => colors[p], logos };
  const plain = { slides: SPEC.slides.slice(0, 2) };
  const without = composeDesignSlides(plain as never, ctx).document;
  const withTokens = composeDesignSlides(plain as never, { ...ctx, tokens: light }).document;
  assert.deepEqual(withTokens, without);
  assert.ok((without.boxes as Row[]).every((r) => r.tokenLinks === undefined));
  // One theme leaves an under/over reference for the runtime, as it always did.
  const refs = { slides: [SPEC.slides[2]] };
  assert.deepEqual(composeDesignSlides(refs as never, { ...ctx, tokens: light }).document, composeDesignSlides(refs as never, ctx).document);
});

test('lolly compose for two themes passes the design system\'s tokens through (lolly-start file)', async () => {
  const result = await composeDesign({ ...SPEC, themes: ['light', 'dark'] }, { file: START_TOKENS });
  const rows = result.document.boxes as Row[];
  assert.deepEqual(raw(rows), []);
  const frame = rows.find((r) => r.id === 's01')!;
  assert.ok(readBlockTokenBindings(frame.tokenLinks).bg, 'the frame ground is linked');
  assert.ok(readBlockTokenBindings(rows.find((r) => r.id === 's03.under-1')!.tokenLinks).bg, 'the under row is linked');
  assert.notEqual(inTheme(rows, dark).find((r) => r.id === 's01')!.bg, frame.bg, 'the ground follows the theme');
});

const SUSE_TOKENS = fileURLToPath(new URL('brands/suse/catalog/assets/suse/tokens/brand.json', ROOT));
test('SUSE (gated): two themes link the master colours, and a light slide with constant colours keeps its dark twin', { skip: !existsSync(SUSE_TOKENS) && 'brands/suse is not checked out' }, async () => {
  const resolved = await resolveProfileDesignSystem({ profile: 'suse' });
  assert.ok(resolved);
  const { master, colors, logos } = resolved.input as unknown as { master: never; colors: Record<string, string>; logos: Record<string, string> };
  const doc = JSON.parse(readFileSync(SUSE_TOKENS, 'utf8'));
  const darkSet = createTokenSet(doc, { theme: 'dark' });
  const ctx = { master, masterOrigin: 'catalog' as const, resolveToken: (p: string) => colors[p], logos, tokens: darkSet };
  const composed = composeDesignSlides({ theme: 'dark', themes: ['light', 'dark'], slides: [{ archetype: 'content', slots: { title: 'Tides' } }] } as never, ctx);
  const rows = composed.document.boxes as Row[];
  assert.deepEqual(raw(rows), []);
  assert.ok(rows.some((r) => Object.keys(readBlockTokenBindings(r.tokenLinks)).length), 'master colours are linked');
  // The SUSE content slide's colours are brand constants, so the master does not let it collapse.
  assert.equal(composed.report.slides[0]!.archetype, 'content-dark');
});
