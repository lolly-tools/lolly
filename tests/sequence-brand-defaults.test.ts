// SPDX-License-Identifier: MPL-2.0
/**
 * Sequence Studio's DEFAULT composition, and the mechanism that makes one seed on-brand
 * under every brand pack.
 *
 * The tool ships in `community/`, so a single `tool.json` serves every profile — there is
 * no per-brand copy to hold per-brand hexes. Its default seed therefore names semantic
 * SLOTS (`{color.semantic.secondary}`, …) in the block colour fields rather than colours,
 * and resolves them at mount.
 *
 * That resolution is the tool's OWN, and this suite exists because of why: the engine's
 * resolveTokenRefs (runtime.ts) visits TOP-LEVEL colour inputs only. A `blocks` input has
 * type 'blocks', so nothing inside a row is ever visited, and an alias left in one reaches
 * safeColor() as the literal string "{color.semantic.secondary}", fails the colour
 * allow-list, and silently becomes a fallback fill. So the tool resolves block colours in
 * its own onInit (hooks.js), including the OKLCH→hex normalisation an ingested brand pack
 * needs, and that is what gets asserted here — through the REAL engine, the REAL hooks,
 * and each brand's REAL token document, never a re-implementation of any of them.
 *
 * What is actually at risk:
 *   1. the aliases resolve at all — a regression leaves braces in the rendered style;
 *   2. they resolve to the RIGHT colours per brand (SUSE's jungle/pine; the starter
 *      brand's own neutrals, which are authored in OKLCH and must arrive as hex);
 *   3. the seed's timing arc survives — it is the demo every first-open sees;
 *   4. nothing brand-private leaks into a community default: no `suse/*` asset id (it
 *      would 404 under any other pack) and no licensed music.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COMMUNITY = join(ROOT, 'community');

assert.ok(existsSync(join(COMMUNITY, 'sequence-studio', 'tool.json')),
  'community/sequence-studio/tool.json is missing — the tool was renamed or deleted');

const tool: any = await loadTool('sequence-studio', (p: string) => readFile(join(COMMUNITY, p), 'utf8'));
const seed = (): any[] => tool.manifest.inputs.find((i: any) => i.id === 'boxes').default as any[];
const row = (id: string): any => {
  const b = seed().find((x: any) => x.id === id);
  assert.ok(b, `the default seed still carries a "${id}" row`);
  return b;
};

/** Mount the shipped default against one brand's real token document. */
async function mountWithBrand(tokensPath: string): Promise<{ boxes: any[]; html: string }> {
  const set = createTokenSet(JSON.parse(await readFile(tokensPath, 'utf8')), {});
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    assets: { get: async (id: string) => ({ id, url: 'asset:' + id, type: 'audio' }) },
    log: () => {},
    color: makeColorApi(),
    tokens: { get: async () => set, resolve: async (ref: string) => set.resolve(ref) },
  };
  const rt = await createRuntime(tool, host, {} as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return { boxes: rt.getModel().find((i: any) => i.id === 'boxes')!.value as any[], html: rt.getHydrated() as string };
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;
const fillsOf = (b: any): string[] => [b.bg, b.fg].map(String);

// ─── the seed itself ──────────────────────────────────────────────────────────

test('the seed names semantic slots, never brand hexes', () => {
  const colours = seed().flatMap((b: any) => [b.bg, b.fg]).filter((v: unknown) => typeof v === 'string' && v !== '' && v !== 'transparent');
  assert.ok(colours.length >= 8, 'the cards carry fill + text colours');
  for (const v of colours) {
    assert.match(v as string, /^\{color\.semantic\.[a-z-]+\}$/,
      `a community default must not pin a brand colour ("${v}") — name a semantic slot so every pack resolves it`);
  }
});

test('the seed is a 7-second three-card arc with a timed overlay', () => {
  assert.deepEqual(
    ['hook', 'reveal', 'cta'].map((id) => [row(id).start, row(id).dur]),
    [[0, 2], [2, 2.4], [4.4, 2.6]],
    'the cards run back to back on the seq lane',
  );
  for (const id of ['hook', 'reveal', 'cta']) assert.equal(row(id).lane, 'seq');
  const lower = row('lower');
  assert.equal(lower.lane, undefined, 'the lower third is an OVERLAY — no lane, so it rides above the cards');
  assert.ok(lower.start >= 4.4, 'it appears over the payoff card');
  assert.equal(Math.max(...seed().map((b: any) => (b.dur ? b.start + b.dur : 0))), 7);
});

test('nothing brand-private rides in a community default', () => {
  const json = JSON.stringify(seed());
  assert.ok(!/suse/i.test(json),
    'a suse/* asset id resolves in no other pack — it would 404 under lolly-start');
  // The music bed is the procedural ZzFXM score, which the engine synthesises: no licensed
  // track can be a shipped default (the catalog's PremiumBeat music is licence-restricted
  // and leaves the public catalog entirely).
  const bed = row('bed');
  assert.equal(bed.kind, 'audio');
  assert.match(String(bed.image?.id), /^zzfxm:/, 'the bed is the procedural score, not a licensed file');
});

// ─── resolution, per brand pack ───────────────────────────────────────────────

const BRANDS: { name: string; tokens: string; expect: Record<string, string> }[] = [
  {
    name: 'suse',
    tokens: join(ROOT, 'brands/suse/catalog/assets/suse/tokens/brand.json'),
    // Jungle on Pine and back — the pairing the seed was authored from.
    expect: { hook: '#30ba78/#0c322c', reveal: '#0c322c/#30ba78', lower: '#30ba78/#0c322c' },
  },
  {
    name: 'lolly-start',
    tokens: join(ROOT, 'brands/lolly-start/catalog/assets/lolly/tokens/brand.json'),
    // Authored in OKLCH; the assertion is only that every value arrives as HEX (the exact
    // neutrals are the starter brand's business, and it is meant to be re-generated).
    expect: {},
  },
];

for (const brand of BRANDS) {
  // brands/suse is a PRIVATE submodule (`update = none`), so a public clone / CI has no
  // token doc for it — skip rather than fail, the same way the community guard works.
  const has = existsSync(brand.tokens);
  test(`${brand.name}: every block colour resolves to hex`, { skip: has ? false : `${brand.tokens} not mounted` }, async () => {
    const { boxes, html } = await mountWithBrand(brand.tokens);
    for (const b of boxes) {
      for (const v of fillsOf(b)) {
        if (v === '' || v === 'transparent' || v === 'undefined') continue;
        assert.match(v, HEX, `box "${b.id}" kept an unresolved value (${v})`);
      }
    }
    assert.ok(!/\{color\./.test(html), 'no alias may reach the rendered markup');
  });

  test(`${brand.name}: resolves to the brand's own colours`, { skip: has ? false : `${brand.tokens} not mounted` }, async () => {
    const { boxes } = await mountWithBrand(brand.tokens);
    const byId: Record<string, any> = {};
    for (const b of boxes) byId[b.id] = b;
    for (const [id, pair] of Object.entries(brand.expect)) {
      assert.equal(`${byId[id].bg}/${byId[id].fg}`, pair, `box "${id}" under ${brand.name}`);
    }
    // Whatever the pack's colours are, the inversion between the first two cards has to
    // survive resolution — that contrast IS the composition.
    assert.equal(byId.hook.bg, byId.reveal.fg, 'card 2 inverts card 1');
    assert.equal(byId.hook.fg, byId.reveal.bg, 'card 2 inverts card 1');
  });
}

// ─── the degrade ──────────────────────────────────────────────────────────────

test('a host with no tokens leaves the seed renderable rather than erroring', async () => {
  const rt = await createRuntime(tool, {
    version: '1', profile: { get: async () => ({}) }, log: () => {},
    assets: { get: async (id: string) => ({ id, url: 'asset:' + id }) },
  } as never, {} as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'an absent tokens API is not an error');
  const html = rt.getHydrated() as string;
  assert.match(html, /class="lolly-box"/, 'the cards still render');
  // safeColor rejects the unresolved alias, so the boxes fall back — the point is that
  // nothing throws and no alias string is painted into a style attribute.
  assert.ok(!/background:\{color\./.test(html), 'an alias never reaches a style attribute');
});
