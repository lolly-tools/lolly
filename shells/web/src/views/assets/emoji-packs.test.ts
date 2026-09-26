// SPDX-License-Identifier: MPL-2.0
/**
 * Emoji sets in the catalog (plans/252, plan 253 section 7).
 *
 * Three packs ship with a structured rights record and a `meta.emoji` block, and
 * until now none of them had a tile: the grid admitted a library `data` asset only
 * when it was the user's own upload, so the rows saying who drew the artwork and
 * what its licence asks were correct and unreachable. What is pinned here is the
 * door that opened - only `meta.emoji` opens it, so a brand's tokens and palette
 * docs stay out - and the two things a person chooses a set on: what the set
 * actually covers, and what using it asks of them.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/assets/emoji-packs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { EmojiPreferenceV1 } from '@lolly-tools/core/emoji-v1';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'DOMParser', 'HTMLElement', 'Element', 'Node', 'Event', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const { emojiPackMeta, emojiPackPin, emojiPackSource, gridAdmits, isCanonicalGlyphKey } = await import('./shared.ts');
const { CANONICAL_EMOJI_GLYPHS, assetRightsRows, emojiPackRows, useEmojiSet } = await import('./details-sheet.ts');
const { thumbHtml } = await import('./thumbs.ts');
const { haystack, matchesQuery } = await import('./filters.ts');
const specimen = await import('../../lib/emoji-specimen.ts');
const { checkEmojiPackSpecimen } = await import('../../../../../scripts/check-emoji-packs.ts');
const { EMOJI_SPAN_CLASS } = await import('../../../../../engine/src/emoji-dom.ts');
type CatCtxLike = Parameters<typeof thumbHtml>[0];

const repoFile = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../../../${rel}`, import.meta.url)), 'utf8');

/** The shipped pack entries, read from the shared asset root they really live in. */
const PACKS = (JSON.parse(repoFile('community/emoji-packs/index.json')) as {
  assets: Array<{ id: string; name: string; type: string; meta?: Record<string, unknown>; license?: string; attribution?: string; rights?: unknown }>;
}).assets;

/** One shipped entry as the catalog hands it to a view. */
function packRef(id: string): AssetRef {
  const entry = PACKS.find((a) => a.id === id);
  assert.ok(entry, `${id} is registered in community/emoji-packs/index.json`);
  return {
    // `library` is the word bridge/assets.ts stamps on a catalog asset.
    id: entry.id, type: 'data', format: 'json', url: '/catalog/packs/emoji-packs/x.json', source: 'library',
    meta: { name: entry.name, emoji: entry.meta?.emoji, license: entry.license, attribution: entry.attribution, rights: entry.rights },
  } as unknown as AssetRef;
}

const TWEMOJI = 'community/emoji/twemoji/color';
const OPENMOJI = 'community/emoji/openmoji/color';

/** A library data file that is not a pack: a brand's own tokens document. */
const tokensRef = (): AssetRef => ({
  id: 'lolly/tokens/brand', type: 'data', format: 'json', url: '/catalog/assets/tokens/brand.json', source: 'library',
  meta: { name: 'Brand tokens' },
} as unknown as AssetRef);

// ── what the grid admits ────────────────────────────────────────────────────

test('a pack entry becomes a tile and another library data file does not', () => {
  assert.equal(gridAdmits(packRef(TWEMOJI)), true, 'the set is shown');
  assert.equal(gridAdmits(tokensRef()), false, 'a tokens doc is engine data and stays out');
  assert.equal(gridAdmits({ ...tokensRef(), type: 'palette', meta: { tags: ['icon-themes'] } } as AssetRef), false,
    'and the rest of the data exclusion is untouched');
});

test('only meta.emoji opens the door, and only a complete block', () => {
  assert.equal(emojiPackMeta(tokensRef()), null);
  const half = packRef(TWEMOJI);
  const block = { ...(half.meta!.emoji as Record<string, unknown>) };
  delete block.checksum;
  assert.equal(emojiPackMeta({ ...half, meta: { ...half.meta, emoji: block } } as AssetRef), null,
    'a block the host could not load a set from is not offered as one');
  assert.equal(emojiPackMeta({ ...half, type: 'raster' } as AssetRef), null, 'and a picture is never a set');
});

test('a pack tile draws the set, not the machine, and names the family until it does', () => {
  const html = thumbHtml({} as CatCtxLike, packRef(OPENMOJI), true);
  assert.ok(html.includes('data-emoji-thumb="community/emoji/openmoji/color"'), 'the tile is a specimen slot');
  assert.ok(html.includes('data-emoji-specimen'), 'with somewhere for the artwork to land');
  assert.ok(html.includes('OpenMoji - Color'), 'and the family and style carry it meanwhile');
  // The specimen slot must ship EMPTY: characters sitting in the live page would be
  // painted by this machine's emoji font, which is what choosing a set prevents.
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(html), 'no emoji character is written into the page');
  assert.ok(!thumbHtml({} as CatCtxLike, tokensRef(), true).includes('data-emoji-thumb'),
    'and a tokens doc keeps its plain stub');
});

// ── search ──────────────────────────────────────────────────────────────────

test('a set is findable by family, style, name and licence', () => {
  const pack = packRef(OPENMOJI);
  const cat = { allAssets: [pack, tokensRef()], overrides: {}, searchHaystack: null, query: '' } as unknown as CatCtxLike;
  const row = haystack(cat).get(pack.id) ?? '';
  for (const term of ['openmoji', 'color', 'cc-by-sa-4.0']) {
    assert.ok(row.includes(term), `the haystack carries "${term}"`);
  }
  // The end a person actually uses: none of these is the asset's name or a tag, so
  // before this none of them found the set.
  for (const query of ['openmoji color', 'cc-by-sa']) {
    (cat as unknown as { query: string }).query = query;
    assert.equal(matchesQuery(cat, pack), true, `"${query}" finds the set`);
    assert.equal(matchesQuery(cat, tokensRef()), false, `"${query}" does not drag in a tokens doc`);
  }
});

// ── the details sheet ───────────────────────────────────────────────────────

test('the sheet states coverage as a count, with every recorded gap and its reason', () => {
  const html = emojiPackRows(packRef(OPENMOJI));
  assert.ok(html.includes('OpenMoji'), 'the family is named');
  assert.ok(html.includes('Color'), 'and the style');
  assert.ok(html.includes('17.0.0'), 'and the exact release');
  // engine/emoji.md's coverage table: 3,949 of 3,953 Unicode 17 keys, and 366
  // symbols of OpenMoji's own on top. Four upstream files the static SVG subset
  // refuses, plus one of the project's own symbols, are the difference.
  assert.ok(html.includes(`${(3949).toLocaleString()} of the ${(3953).toLocaleString()} canonical glyphs.`));
  assert.ok(html.includes(`${(366).toLocaleString()}`), 'the set’s own symbols are counted separately');
  assert.ok(html.includes('Unsupported SVG id.'), 'each gap keeps the reason it was recorded with');
  assert.ok(html.includes('<code>25fe</code>'), 'named by key');
  assert.ok(!/error|invalid|broken/i.test(html), 'a gap is a count, never a verdict');
});

test('a complete set says so without inventing a shortfall', () => {
  const html = emojiPackRows(packRef(TWEMOJI));
  assert.ok(html.includes(`Complete - all ${(3953).toLocaleString()} canonical glyphs.`));
  assert.ok(!html.includes('<details'), 'nothing is missing, so there is nothing to disclose');
});

test('the canonical repertoire matches the engine’s own pinned table', () => {
  const table = JSON.parse(repoFile('engine/src/emoji-data/17.0.json')) as { entries: unknown[] };
  assert.equal(CANONICAL_EMOJI_GLYPHS, table.entries.length,
    'the denominator on the sheet is the engine’s Unicode 17 entry count, not a number someone typed');
});

test('a pack’s rights rows reach the sheet, off the record it actually ships', () => {
  const html = assetRightsRows(packRef(OPENMOJI), false);
  assert.ok(html.includes('credited to OpenMoji contributors'));
  assert.ok(html.includes('CC BY-SA 4.0'), 'the readable licence name');
  assert.ok(html.includes('ShareAlike applies to adapted versions you share.'));
  assert.ok(html.includes('data-act="copy-credit"'), 'and the exact credit can be copied');
  for (const phrase of ['rights cleared', 'legally safe', 'fully cleared', 'copyright verified']) {
    assert.ok(!html.includes(phrase), `never says "${phrase}"`);
  }
});

test('a pack’s own symbol key is not counted against the canonical repertoire', () => {
  assert.equal(isCanonicalGlyphKey('1f684'), true);
  assert.equal(isCanonicalGlyphKey('25fc-fe0f'), true);
  assert.equal(isCanonicalGlyphKey('community/emoji/openmoji/extras/e06c'), false);
});

// ── "Use this set" ──────────────────────────────────────────────────────────

/** A profile store in memory, so the preference write has somewhere real to land. */
function fakePrefHost(opts: { readOnly?: boolean } = {}) {
  let profile: Record<string, unknown> = { firstname: 'Andy' };
  return {
    saved: () => profile.emoji as EmojiPreferenceV1 | undefined,
    host: {
      profile: {
        get: async () => profile,
        set: async (next: object) => { if (!opts.readOnly) profile = next as Record<string, unknown>; },
      },
    },
  };
}

test('"Use this set" records the pin as the profile’s emoji preference', async () => {
  const store = fakePrefHost();
  const pack = emojiPackMeta(packRef(TWEMOJI))!;
  assert.equal(await useEmojiSet(store.host, pack), true);
  const saved = store.saved();
  assert.deepEqual(saved?.pin, emojiPackPin(pack), 'the exact release is pinned, not just the id');
  assert.equal(saved?.mode, 'original', 'a set is chosen here; the brand treatment is a document’s choice');
});

test('a preference write that went nowhere is not reported as saved', async () => {
  const store = fakePrefHost({ readOnly: true });
  const pack = emojiPackMeta(packRef(TWEMOJI))!;
  assert.equal(await useEmojiSet(store.host, pack), false, 'the read-back is what decides');
  assert.equal(store.saved(), undefined);
});

// ── the baked specimen ──────────────────────────────────────────────────────

/** A host that fails the test if anything asks it for a pack. */
function noPackHost() {
  const asked: string[] = [];
  const refuse = async (): Promise<never> => { throw new Error('the pack was loaded'); };
  return {
    asked,
    host: {
      emoji: {
        sets: async () => { asked.push('sets'); return []; },
        manifest: async () => { asked.push('manifest'); return null; },
        artwork: refuse,
        parseXml: (source: string) => new DOMParser().parseFromString(source, 'image/svg+xml'),
      },
    } as unknown as Parameters<typeof specimen.emojiSpecimenArtwork>[0],
  };
}

test('every shipped set carries its five glyphs in the catalog entry', () => {
  for (const id of [TWEMOJI, OPENMOJI, 'community/emoji/openmoji/black']) {
    const meta = emojiPackMeta(packRef(id))!;
    assert.ok(meta.specimen, `${id} carries a baked specimen`);
    assert.equal(Object.keys(meta.specimen!).length, 5);
    for (const markup of Object.values(meta.specimen!)) assert.ok(markup.startsWith('<svg'));
  }
});

test('a specimen-bearing entry draws without the pack being loaded', async () => {
  specimen.clearEmojiSpecimenCache();
  const { asked, host } = noPackHost();
  const meta = emojiPackMeta(packRef(OPENMOJI))!;
  const artwork = await specimen.emojiSpecimenArtwork(host, emojiPackSource(meta));
  assert.equal(artwork.length, 5, 'five glyphs, straight out of the index');
  assert.deepEqual(asked, [], 'and nothing asked the host for 20 MB of bundle');
  assert.equal((artwork[0] as HTMLElement).className, EMOJI_SPAN_CLASS,
    'the same placement class the engine’s own pass writes');
  assert.equal((artwork[0] as HTMLElement).firstElementChild?.nodeName.toLowerCase(), 'svg');
});

test('a single-ink set keeps its paints bound to the surrounding text colour', () => {
  for (const id of ['community/emoji/openmoji/black', 'community/emoji/fluent/high-contrast']) {
    const meta = emojiPackMeta(packRef(id))!;
    for (const markup of Object.values(meta.specimen!)) {
      assert.ok(markup.includes('currentColor'), `${id}: the baked artwork carries the ink rewrite`);
      assert.doesNotMatch(markup, /(?:fill|stroke)="#(?:000|000000|212121|1c1c1c)"/);
    }
  }
});

test('a stale specimen is refused rather than drawn', () => {
  const meta = emojiPackMeta(packRef(TWEMOJI))!;
  const entry = (PACKS.find((a) => a.id === TWEMOJI)!.meta!.emoji as Record<string, unknown>);
  const facts = { manifestChecksum: meta.checksum, glyphKeys: new Set(Object.keys(meta.specimen!)) };
  assert.deepEqual(checkEmojiPackSpecimen(entry, facts), [], 'what ships today is in step with its bundle');
  // The build gate: a pack re-imported at a new revision leaves the old artwork behind.
  const stale = checkEmojiPackSpecimen({ ...entry, specimenOf: `sha256:${'0'.repeat(64)}` }, facts);
  assert.equal(stale.length, 1);
  assert.match(stale[0]!, /specimenOf/);
  assert.match(stale[0]!, /emoji-pack-specimens/, 'and it says how to fix it');
  // A key the bundle has no glyph for is refused too.
  assert.ok(checkEmojiPackSpecimen({ ...entry, specimen: { ...(entry.specimen as object), 'ffff': '<svg/>' } }, facts)
    .some((issue) => issue.includes('no glyph for')));
  // An entry that has never been baked is not an error: the shell loads the pack.
  assert.deepEqual(checkEmojiPackSpecimen({ checksum: meta.checksum }, facts), []);
});

test('the runtime refuses a stale specimen too, and falls back to the pack', () => {
  const ref = packRef(TWEMOJI);
  const block = { ...(ref.meta!.emoji as Record<string, unknown>), specimenOf: `sha256:${'0'.repeat(64)}` };
  const meta = emojiPackMeta({ ...ref, meta: { ...ref.meta, emoji: block } } as AssetRef)!;
  assert.equal(meta.specimen, null, 'a specimen that does not name this pack is not this pack’s artwork');
});

// ── the specimen helper’s fallback path ─────────────────────────────────────

/** A pass that draws one span, recording how it was called. */
function fakePass() {
  const calls: Array<{ text: string; track: boolean; idScope: string }> = [];
  return {
    calls,
    pass: {
      apply: async (node: unknown, opts: { track: false; idScope: string }) => {
        const el = node as HTMLElement;
        calls.push({ text: el.textContent ?? '', track: opts.track, idScope: opts.idScope });
        const span = document.createElement('span');
        span.className = EMOJI_SPAN_CLASS;
        el.replaceChildren(span);
        return null;
      },
    },
  };
}

/** The same set, as an entry that carries no baked glyphs. */
const unbakedSource = (id: string) => ({ pin: emojiPackPin(emojiPackMeta(packRef(id))!), specimen: null });

test('an entry with no baked specimen still loads the pack and draws', async () => {
  specimen.clearEmojiSpecimenCache();
  const { calls, pass } = fakePass();
  const source = unbakedSource(TWEMOJI);
  const artwork = await specimen.emojiSpecimenArtwork({}, source, { pass });
  assert.equal(calls.length, 1, 'the pack path ran');
  assert.equal((artwork[0] as HTMLElement).className, EMOJI_SPAN_CLASS);
});

test('the fallback pass runs untracked, under a scope of the pack’s own', async () => {
  specimen.clearEmojiSpecimenCache();
  const { calls, pass } = fakePass();
  const source = unbakedSource(TWEMOJI);
  const artwork = await specimen.emojiSpecimenArtwork({}, source, { pass });
  // A tracked pass IS the render (CLAUDE.md, Emoji): chrome must neither become the
  // tree a set change redraws nor rewrite the counts the Emoji section is shown on.
  assert.equal(calls[0]!.track, false);
  assert.equal(calls[0]!.idScope, specimen.emojiSpecimenScope(source.pin));
  assert.ok(calls[0]!.idScope.startsWith('cat_'), 'the catalog’s own scope, never the canvas’s `e`');
  assert.equal(calls[0]!.text, specimen.EMOJI_SPECIMEN_TEXT, 'the characters go into a detached element only');
  // Prepared once per pack: a set is 15 to 20 MB, and a re-render must not refetch it.
  assert.equal(await specimen.emojiSpecimenArtwork({}, source, { pass }), artwork);
  assert.equal(calls.length, 1, 'the second ask is served from the prepared artwork');
});

test('two sets never draw under the same scope', () => {
  const twemoji = emojiPackPin(emojiPackMeta(packRef(TWEMOJI))!);
  const openmoji = emojiPackPin(emojiPackMeta(packRef(OPENMOJI))!);
  // Placement ids are named after a node's place in the tree, so both specimens start
  // at the beginning: one scope for both would let one set's gradient paint the
  // other's glyph. The scope is keyed to the pack's own checksum instead.
  assert.notEqual(specimen.emojiSpecimenScope(twemoji), specimen.emojiSpecimenScope(openmoji));
  assert.match(specimen.emojiSpecimenScope(twemoji), /^[A-Za-z_][A-Za-z0-9_]{0,31}$/,
    'and it is a scope the engine accepts, or it would fall back to the default');
});

test('a pass that draws nothing leaves the caller its plain stub', async () => {
  specimen.clearEmojiSpecimenCache();
  const drew = await specimen.emojiSpecimenArtwork({}, unbakedSource(OPENMOJI), { pass: { apply: async () => null } });
  assert.deepEqual(drew, [], 'untouched characters are not artwork');
});

test('markup that is not an SVG the parser accepts is never drawn', () => {
  assert.equal(specimen.specimenGlyphNode('<script>alert(1)</script>'), null);
  assert.equal(specimen.specimenGlyphNode('<svg><unclosed></svg>'), null, 'a parse error draws nothing');
  assert.equal(specimen.specimenGlyphNode(''), null);
  assert.deepEqual(specimen.bakedSpecimenNodes({ x: 'not markup' }), []);
});

test('a painted stub clones the artwork, so one prepared set serves every tile', async () => {
  specimen.clearEmojiSpecimenCache();
  const { pass } = fakePass();
  const source = unbakedSource(TWEMOJI);
  const artwork = await specimen.emojiSpecimenArtwork({}, source, { pass });
  const stub = document.createElement('div');
  stub.innerHTML = '<span data-emoji-specimen></span>';
  specimen.paintEmojiSpecimen(stub, artwork);
  const slot = stub.querySelector('[data-emoji-specimen]')!;
  assert.equal(slot.childNodes.length, 1);
  assert.notEqual(slot.firstChild, artwork[0], 'the prepared node itself is never moved into a tile');
  assert.ok(stub.classList.contains('is-drawn'));
});

test('a host with no emoji API offers no specimen rather than a system font', async () => {
  specimen.clearEmojiSpecimenCache();
  assert.deepEqual(await specimen.emojiSpecimenArtwork({}, unbakedSource(OPENMOJI)), []);
});

test('one specimen text, read by the control, the bake and the catalog alike', () => {
  const control = repoFile('shells/web/src/components/emoji-style-control.ts');
  const declared = /export const EMOJI_SPECIMEN = '([^']*)'/.exec(control)?.[1] ?? '';
  const characters = declared.replace(/\\u\{([0-9A-Fa-f]{1,6})\}|\\u([0-9A-Fa-f]{4})/g,
    (_all, braced, plain) => String.fromCodePoint(parseInt(braced ?? plain, 16)));
  assert.equal(characters, specimen.EMOJI_SPECIMEN_TEXT,
    'the sidebar control and the catalog draw the same five characters');
});
