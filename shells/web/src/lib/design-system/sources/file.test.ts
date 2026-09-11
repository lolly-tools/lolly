// SPDX-License-Identifier: MPL-2.0
/**
 * Unit coverage for the design-file source (sources/file.ts): the sniffing
 * router, the zip-of-token-set-files shape the web could never open before, the
 * "this doc still needs roles" test, the alias write, and the declaring-source
 * census.
 *
 * Zip fixtures are built here with fflate's `zipSync` rather than checked in as
 * bytes: the archive shapes ARE the thing under test (wrapper folder, Finder's
 * `__MACOSX` shadow tree, a manifest that routes elsewhere), and a fixture you
 * can read is a fixture that can be argued with.
 *
 * `createTokenSet` and `withRoleAliases` are imported on purpose - the assertion
 * that matters is not "we wrote an alias string" but "the alias resolves", which
 * only the real engine + the real proposer can answer.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/sources/file.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { strToU8, zipSync } from 'fflate';
import { createTokenSet } from '@lolly/engine';

import {
  SET_FILES_MAX_COUNT, SVG_MAX_BYTES, TOKENS_MAX_BYTES, ZIP_MAX_BYTES,
  applyMappingChoice, censusFromTokensDoc, chooserRows, colorTokenRows, designFileLimit,
  docNeedsMappingReview, followRoles, routeDesignFile, stripCommonPrefix, tokenSetFilesFromZip,
} from './file.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A plain DTCG doc: colours, no semantic roles. The gap case. */
const DTCG_COLORS_ONLY = {
  color: {
    brand: {
      blue: { $value: '#1E4FD8', $type: 'color' },
      ink: { $value: '#101014', $type: 'color' },
      paper: { $value: '#FAFAFA', $type: 'color' },
    },
  },
  typography: {
    heading: { $value: { fontFamily: 'Work Sans, sans-serif', fontSize: '32px' }, $type: 'typography' },
  },
};

/** The same colours, layered Tokens-Studio style: sets at the top level, order
 *  in `$metadata`, and `$themes: []` (what a themeless Penpot export writes). */
const STUDIO_LAYERED = {
  Global: {
    color: {
      blue: { $value: '#1E4FD8', $type: 'color' },
      grey: { $value: '#8A8A8F', $type: 'color' },
    },
  },
  Brand: {
    color: { accent: { $value: '#E8590C', $type: 'color' } },
  },
  $themes: [],
  $metadata: { tokenSetOrder: ['Global', 'Brand'] },
};

const bytes = (o: unknown): Uint8Array<ArrayBuffer> => strToU8(JSON.stringify(o)) as Uint8Array<ArrayBuffer>;
const zip = (entries: Record<string, Uint8Array>): Uint8Array => zipSync(entries);

// ── routeDesignFile: SVG ─────────────────────────────────────────────────────

test('routeDesignFile routes an SVG by name, by type and by its opening bytes', async () => {
  const svg = strToU8('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="#1E4FD8"/></svg>');

  const byName = await routeDesignFile('mark.svg', svg);
  assert.equal(byName.kind, 'svg');
  assert.equal(byName.kind === 'svg' && byName.label, 'mark');

  const byType = await routeDesignFile('mark', svg, { type: 'image/svg+xml' });
  assert.equal(byType.kind, 'svg');

  // No extension, no type: the bytes are the only evidence there is.
  const byBytes = await routeDesignFile('untitled', strToU8('<?xml version="1.0"?>\n<svg viewBox="0 0 1 1"></svg>'));
  assert.equal(byBytes.kind, 'svg');
});

test('routeDesignFile refuses an oversized SVG without parsing it', async () => {
  const huge = new Uint8Array(SVG_MAX_BYTES + 1);
  const route = await routeDesignFile('mark.svg', huge);
  assert.equal(route.kind, 'refused');
  assert.equal(route.kind === 'refused' && route.reason, 'too-large');
  assert.equal(route.kind === 'refused' && route.limit, SVG_MAX_BYTES);
});

// ── routeDesignFile: JSON ────────────────────────────────────────────────────

test('routeDesignFile reads a plain DTCG document', async () => {
  const route = await routeDesignFile('acme-tokens.json', bytes(DTCG_COLORS_ONLY));
  assert.equal(route.kind, 'tokens');
  if (route.kind !== 'tokens') return;
  assert.equal(route.label, 'acme-tokens');
  assert.equal(route.extraction.source, 'dtcg');
  assert.ok(route.extraction.doc);
});

test('routeDesignFile classifies a layered document as tokens-studio', async () => {
  const route = await routeDesignFile('sets.json', bytes(STUDIO_LAYERED));
  assert.equal(route.kind === 'tokens' && route.extraction.source, 'tokens-studio');
});

test('routeDesignFile refuses unparseable JSON and JSON that is not a document', async () => {
  const bad = await routeDesignFile('tokens.json', strToU8('{ nope'));
  assert.equal(bad.kind === 'refused' && bad.reason, 'not-json');

  const arr = await routeDesignFile('tokens.json', bytes([1, 2, 3]));
  assert.equal(arr.kind === 'refused' && arr.reason, 'no-tokens');
  // The engine's own warning rides along so the caller can say why.
  assert.match(arr.kind === 'refused' ? arr.detail ?? '' : '', /array/);
});

test('routeDesignFile refuses a token file past the JSON cap', async () => {
  const route = await routeDesignFile('tokens.json', new Uint8Array(TOKENS_MAX_BYTES + 1));
  assert.equal(route.kind === 'refused' && route.reason, 'too-large');
  assert.equal(route.kind === 'refused' && route.limit, TOKENS_MAX_BYTES);
});

// ── routeDesignFile: zips ────────────────────────────────────────────────────

test('routeDesignFile routes a design-system pack and a Penpot export by manifest', async () => {
  const pack = await routeDesignFile('acme.zip', zip({
    'manifest.json': bytes({ format: 'lolly-brand', formatVersion: 1 }),
    'tokens.json': bytes(DTCG_COLORS_ONLY),
  }));
  assert.equal(pack.kind, 'pack');
  assert.equal(pack.kind === 'pack' && pack.label, 'acme');
  // The entries ride along so nothing unzips twice.
  assert.ok(pack.kind === 'pack' && pack.files['tokens.json']);

  const penpot = await routeDesignFile('board.penpot', zip({
    'manifest.json': bytes({ type: 'penpot/export-files' }),
    'files/abc/content.json': bytes({}),
  }));
  assert.equal(penpot.kind, 'penpot');
  assert.equal(penpot.kind === 'penpot' && penpot.label, 'board');
});

test('routeDesignFile assembles a zip of loose token-set files', async () => {
  const route = await routeDesignFile('token-export.zip', zip({
    'Global.json': bytes({ color: { blue: { $value: '#1E4FD8', $type: 'color' } } }),
    'Brand.json': bytes({ color: { accent: { $value: '#E8590C', $type: 'color' } } }),
    '$metadata.json': bytes({ tokenSetOrder: ['Global', 'Brand'] }),
    '$themes.json': bytes([]),
  }));
  assert.equal(route.kind, 'tokens');
  if (route.kind !== 'tokens') return;
  assert.equal(route.extraction.source, 'token-set-files');
  const ts = createTokenSet(route.extraction.doc);
  assert.equal(ts.resolve('color.blue'), '#1E4FD8');
  assert.equal(ts.resolve('color.accent'), '#E8590C');
});

test('a zip of token sets survives a wrapper folder and Finder’s shadow tree', async () => {
  const route = await routeDesignFile('export.zip', zip({
    'tokens/Global.json': bytes({ color: { blue: { $value: '#1E4FD8', $type: 'color' } } }),
    'tokens/Brand.json': bytes({ color: { accent: { $value: '#E8590C', $type: 'color' } } }),
    'tokens/$metadata.json': bytes({ tokenSetOrder: ['Global', 'Brand'] }),
    '__MACOSX/tokens/._Global.json': strToU8('garbage, not JSON'),
  }));
  assert.equal(route.kind, 'tokens');
  if (route.kind !== 'tokens') return;
  // The wrapper is gone, so $metadata is metadata and not a set called
  // "tokens/$metadata" that nothing activates.
  const ts = createTokenSet(route.extraction.doc);
  assert.equal(ts.resolve('color.blue'), '#1E4FD8');
  assert.equal(ts.resolve('color.accent'), '#E8590C');
  // The resource fork was skipped, so it contributed no parse warning.
  assert.deepEqual(route.extraction.warnings, []);
});

test('routeDesignFile refuses a zip that is none of the three shapes', async () => {
  const route = await routeDesignFile('photos.zip', zip({ 'a.png': new Uint8Array([1, 2, 3]) }));
  assert.equal(route.kind === 'refused' && route.reason, 'unknown-zip');
});

test('routeDesignFile refuses bytes that claim to be a zip and are not', async () => {
  const route = await routeDesignFile('broken.zip', strToU8('PK and then nonsense'));
  assert.equal(route.kind === 'refused' && route.reason, 'unreadable-zip');
});

test('routeDesignFile sniffs a zip by magic even when the name lies', async () => {
  const route = await routeDesignFile('tokens.json', zip({
    'manifest.json': bytes({ format: 'lolly-brand' }),
  }));
  assert.equal(route.kind, 'pack');
});

test('routeDesignFile refuses an oversized archive', async () => {
  const route = await routeDesignFile('big.zip', new Uint8Array(ZIP_MAX_BYTES + 1));
  assert.equal(route.kind === 'refused' && route.reason, 'too-large');
  assert.equal(route.kind === 'refused' && route.limit, ZIP_MAX_BYTES);
});

// ── The zip-of-sets shape on its own ─────────────────────────────────────────

test('tokenSetFilesFromZip warns rather than fails on one unparseable member', () => {
  const out = tokenSetFilesFromZip({
    'Global.json': bytes({ color: { blue: { $value: '#1E4FD8', $type: 'color' } } }),
    'package.json': strToU8('{ not json') as Uint8Array<ArrayBuffer>,
  });
  assert.ok(out.doc);
  assert.equal(out.warnings.length, 1);
  assert.match(out.warnings[0]!, /package\.json/);
});

test('tokenSetFilesFromZip refuses an archive with too many json members', () => {
  const files: Record<string, Uint8Array<ArrayBuffer>> = {};
  for (let i = 0; i <= SET_FILES_MAX_COUNT; i++) files[`set-${i}.json`] = bytes({});
  const out = tokenSetFilesFromZip(files);
  assert.equal(out.doc, null);
  assert.match(out.warnings[0]!, /more than a token export should carry/);
});

test('stripCommonPrefix only strips one unambiguous shared directory', () => {
  assert.deepEqual(stripCommonPrefix(['t/a.json', 't/b.json']), ['a.json', 'b.json']);
  // Two top-level directories are structure the export meant.
  assert.deepEqual(stripCommonPrefix(['a/x.json', 'b/y.json']), ['a/x.json', 'b/y.json']);
  // A single member has no shared prefix to infer.
  assert.deepEqual(stripCommonPrefix(['t/a.json']), ['t/a.json']);
  // Root-level files are already root-level.
  assert.deepEqual(stripCommonPrefix(['a.json', 'b.json']), ['a.json', 'b.json']);
});

test('designFileLimit picks the cap for the shape before a byte is read', () => {
  assert.equal(designFileLimit('mark.svg'), SVG_MAX_BYTES);
  assert.equal(designFileLimit('board.penpot'), ZIP_MAX_BYTES);
  assert.equal(designFileLimit('pack.zip'), ZIP_MAX_BYTES);
  assert.equal(designFileLimit('tokens.json'), TOKENS_MAX_BYTES);
  assert.equal(designFileLimit('unnamed', 'application/zip'), ZIP_MAX_BYTES);
});

// ── docNeedsMappingReview ────────────────────────────────────────────────────

test('docNeedsMappingReview is true for a colours-only DTCG document', () => {
  assert.equal(docNeedsMappingReview(DTCG_COLORS_ONLY), true);
});

test('docNeedsMappingReview is true for a layered document with no semantic slots', () => {
  assert.equal(docNeedsMappingReview(STUDIO_LAYERED), true);
});

test('docNeedsMappingReview is false once any semantic role resolves', () => {
  const withRole = {
    ...DTCG_COLORS_ONLY,
    color: { ...DTCG_COLORS_ONLY.color, semantic: { primary: { $value: '{color.brand.blue}', $type: 'color' } } },
  };
  assert.equal(docNeedsMappingReview(withRole), false);
});

test('docNeedsMappingReview reads a layered doc as one merged set, not set by set', () => {
  // Roles in their own set, palette in another - complete, so no card.
  const layeredWithRoles = {
    ...STUDIO_LAYERED,
    Roles: { color: { semantic: { primary: { $value: '{color.blue}', $type: 'color' } } } },
    $metadata: { tokenSetOrder: ['Global', 'Brand', 'Roles'] },
  };
  assert.equal(docNeedsMappingReview(layeredWithRoles), false);
});

test('docNeedsMappingReview is false for a document with no colours at all', () => {
  assert.equal(docNeedsMappingReview({ spacing: { sm: { $value: '4px', $type: 'dimension' } } }), false);
  assert.equal(docNeedsMappingReview(null), false);
});

// ── The mapping card's model: rows, the chooser's cap, and what follows ──────

test('colorTokenRows ranks every resolvable colour token, most colourful first', () => {
  const rows = colorTokenRows(DTCG_COLORS_ONLY);
  assert.deepEqual(rows.map(r => r.path), ['color.brand.blue', 'color.brand.ink', 'color.brand.paper'],
    'the accent leads; the two near-neutrals follow it');
  assert.equal(rows[0]!.hex.toUpperCase(), '#1E4FD8');
  assert.ok(rows[0]!.chroma > rows[2]!.chroma);
  assert.deepEqual(colorTokenRows({ typography: {} }), [], 'a doc with no colours offers nothing');
});

test('chooserRows caps the list but never drops the seeded primary', () => {
  // Thirteen tokens, and the seed is the LEAST colourful of them - the shape
  // proposeRolesFromTokens produces whenever nothing clears its accent floor and
  // it falls back to declaration order.
  const rows = Array.from({ length: 13 }, (_, i) => ({
    path: `color.p${i}`, hex: '#000000', chroma: 0.2 - i * 0.01,
  }));
  const seeded = rows[12]!.path;

  const plain = chooserRows(rows, null);
  assert.equal(plain.length, 12);
  assert.ok(!plain.some(r => r.path === seeded), 'without a seed the cap is just the cap');

  const withSeed = chooserRows(rows, seeded);
  assert.equal(withSeed.length, 12, 'the cap holds - the card stays one decision');
  assert.ok(withSeed.some(r => r.path === seeded),
    'the chip the card arrives pressed on is always among the ones it shows');
  assert.equal(withSeed[0]!.path, 'color.p0', 'and the ranking is otherwise untouched');
});

test('followRoles keeps the proposed surface and text when the primary leaves them alone', () => {
  const rows = colorTokenRows(DTCG_COLORS_ONLY);
  const proposal = { refs: { primary: 'color.brand.blue', surface: 'color.brand.paper', text: 'color.brand.ink' } };
  const follows = followRoles('color.brand.blue', rows, proposal);
  assert.equal(follows.surface.ref, 'color.brand.paper');
  assert.equal(follows.text.ref, 'color.brand.ink');
  assert.equal(follows.surface.hex.toUpperCase(), '#FAFAFA');
});

test('followRoles never aliases two roles to one token', () => {
  const rows = colorTokenRows(DTCG_COLORS_ONLY);
  const proposal = { refs: { primary: 'color.brand.blue', surface: 'color.brand.paper', text: 'color.brand.ink' } };

  // Picking the proposed SURFACE as the primary: without this rule the install
  // writes --brand-primary and --brand-surface as the same token.
  const onSurface = followRoles('color.brand.paper', rows, proposal);
  assert.notEqual(onSurface.surface.ref, 'color.brand.paper');
  assert.equal(onSurface.surface.ref, 'color.brand.ink', 'the next most neutral token steps in');
  assert.equal(onSurface.text.ref, undefined, 'and text stops pointing at the token that is now the surface');
  assert.equal(onSurface.text.hex, '#FFFFFF', 'it falls back to what reads on that dark surface');

  // Picking the proposed TEXT as the primary: text drops to a literal rather
  // than being the primary read back at itself.
  const onText = followRoles('color.brand.ink', rows, proposal);
  assert.equal(onText.surface.ref, 'color.brand.paper');
  assert.equal(onText.text.ref, undefined);
  assert.equal(onText.text.hex, '#000000', 'black on the light surface it actually got');
});

test('followRoles copes with a proposal that named no surface at all', () => {
  const rows = colorTokenRows(DTCG_COLORS_ONLY);
  const follows = followRoles('color.brand.blue', rows, { refs: {} });
  assert.equal(follows.surface.ref, 'color.brand.paper', 'the most neutral token that is not the primary');
  assert.equal(follows.text.ref, undefined);
});

// ── applyMappingChoice ───────────────────────────────────────────────────────

test('applyMappingChoice writes aliases, not literals, and they resolve', () => {
  const out = applyMappingChoice(DTCG_COLORS_ONLY, {
    primary: 'color.brand.blue',
    surface: 'color.brand.paper',
    text: 'color.brand.ink',
  });
  const semantic = (out.color as Record<string, Record<string, { $value: string }>>).semantic!;
  assert.equal(semantic.primary!.$value, '{color.brand.blue}');
  assert.equal(semantic.surface!.$value, '{color.brand.paper}');

  const ts = createTokenSet(out);
  assert.equal(ts.resolve('color.semantic.primary'), '#1E4FD8');
  assert.equal(ts.resolve('color.semantic.text'), '#101014');
  // …and the doc that came in is untouched.
  assert.equal(docNeedsMappingReview(DTCG_COLORS_ONLY), true);
  assert.equal(docNeedsMappingReview(out), false);
});

test('applyMappingChoice honours a primary the person picked over any other', () => {
  const out = applyMappingChoice(DTCG_COLORS_ONLY, { primary: 'color.brand.ink', surface: 'color.brand.paper' });
  assert.equal(createTokenSet(out).resolve('color.semantic.primary'), '#101014');
});

test('applyMappingChoice puts a layered doc’s roles in their own set, last in the order', () => {
  const out = applyMappingChoice(STUDIO_LAYERED, { primary: 'color.accent', surface: 'color.grey' });
  const order = (out.$metadata as { tokenSetOrder: string[] }).tokenSetOrder;
  assert.equal(order[order.length - 1], 'Lolly roles');
  assert.ok(out['Lolly roles'], 'the roles landed in a set of their own, not beside the sets');
  assert.equal(createTokenSet(out).resolve('color.semantic.primary'), '#E8590C');
});

test('applyMappingChoice drops blank choices and returns the doc unchanged with none', () => {
  const partial = applyMappingChoice(DTCG_COLORS_ONLY, { primary: 'color.brand.blue', surface: '  ' });
  const semantic = (partial.color as Record<string, Record<string, unknown>>).semantic!;
  assert.deepEqual(Object.keys(semantic), ['primary']);

  const none = applyMappingChoice(DTCG_COLORS_ONLY, { primary: '   ' });
  assert.equal(none, DTCG_COLORS_ONLY);
});

// ── censusFromTokensDoc ──────────────────────────────────────────────────────

test('censusFromTokensDoc reports declared colours in declaration order', () => {
  const census = censusFromTokensDoc(DTCG_COLORS_ONLY, 'acme-tokens.json');
  assert.deepEqual(census.colors.map(c => c.hex), ['#1E4FD8', '#101014', '#FAFAFA']);
  assert.deepEqual(census.colors.map(c => c.weight), [1, 1, 1]);
  // No paint bucket: nothing declared was ever painted.
  assert.ok(census.colors.every(c => c.kind === undefined));
  assert.equal(census.source.label, 'acme-tokens.json');
});

test('censusFromTokensDoc counts a hex declared twice as two declarations', () => {
  const census = censusFromTokensDoc({
    color: {
      blue: { $value: '#1e4fd8', $type: 'color' },
      link: { $value: '#1E4FD8', $type: 'color' },
      ink: { $value: '#101014', $type: 'color' },
    },
  }, 'doubled.json');
  assert.deepEqual(census.colors, [
    { hex: '#1E4FD8', weight: 2 },
    { hex: '#101014', weight: 1 },
  ]);
});

test('censusFromTokensDoc lists the families a document declares', () => {
  const census = censusFromTokensDoc({
    ...DTCG_COLORS_ONLY,
    font: { code: { $value: 'IBM Plex Mono', $type: 'fontFamily' } },
  }, 'acme.json');
  assert.deepEqual(census.fonts.map(f => f.family), ['Work Sans', 'sans-serif', 'IBM Plex Mono']);
  assert.equal(census.fonts.find(f => f.family === 'IBM Plex Mono')?.usage, 'mono');
});

test('censusFromTokensDoc claims no gradients and no name', () => {
  const census = censusFromTokensDoc(STUDIO_LAYERED, 'sets.json');
  assert.deepEqual(census.gradients, []);
  assert.equal(census.name, undefined);
});
