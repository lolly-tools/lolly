// SPDX-License-Identifier: MPL-2.0
/**
 * The design brief (plan 291 W3) and the brand check's catalog awareness, over the
 * synthetic Tidewater fixture and catalog facts, so public CI covers what the private
 * SUSE pack carries.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Ajv from 'ajv/dist/2020.js';

import { brandContext } from '../engine/src/brand-context.ts';
import { checkBrandDesign } from '../engine/src/brand-check.ts';
import { brandCheckCatalog, designBrief } from '../engine/src/design-brief.ts';
import type { DesignBriefCatalogV1 } from '../engine/src/design-brief.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';

const doc = JSON.parse(readFileSync(new URL('./fixtures/design-brief/tokens.json', import.meta.url), 'utf8'));
const master = neutralSlideMaster();

const catalog: DesignBriefCatalogV1 = {
  profile: 'tidewater',
  tokensAsset: 'tidewater/tokens/brand',
  assets: [
    { id: 'tidewater/tokens/brand', type: 'tokens', tags: ['tokens', 'brand'] },
    { id: 'tidewater/logo/positive', type: 'vector', name: 'Positive', tags: ['logo', 'on-light'] },
    { id: 'tidewater/logo/reverse', type: 'vector', name: 'Reverse', tags: ['logo', 'on-dark'] },
    { id: 'tidewater/logo/mono', type: 'vector', tags: ['logo', 'mono'] },
    { id: 'tidewater/icons/anchor', type: 'vector', name: 'Anchor', tags: ['icon', 'themable', 'two-color'] },
    { id: 'tidewater/icons/wave', type: 'vector', name: 'Wave', tags: ['icon'] },
    { id: 'tidewater/photos/sea', type: 'raster', name: 'Sea', tags: ['photo'], license: 'LicenseRef-Fixture' },
    { id: 'tidewater/photos/old', type: 'raster', tags: ['photo'], deprecated: true },
    { id: 'tidewater/backgrounds/dots', type: 'vector', tags: ['background'] },
    { id: 'tidewater/loops/hum', type: 'audio', tags: ['loop'] },
  ],
  iconThemes: { themes: [
    { id: 'tide', label: 'Tide', c1: '#2fb8ac', c2: '#13294b' },
    { id: 'foam', label: 'Foam', c1: '#ffffff', c2: '#f3e9d2', surfaces: ['dark'] },
  ] },
  photoTreatments: { treatments: [{ id: 'mono', kind: 'greyscale' }, { id: 'sea', kind: 'duotone', shadow: '#13294b', highlight: '#2fb8ac' }] },
  master,
  masterAsset: 'tidewater/slides/masters',
  logos: { onLight: 'tidewater/logo/positive', onDark: 'tidewater/logo/reverse', monoOnLight: 'tidewater/logo/mono' },
};

test('the brief keeps every context key and value, and adds the brief sections', () => {
  const context = brandContext(doc, { name: 'Tidewater' });
  const brief = designBrief(doc, catalog, { name: 'Tidewater' });
  for (const [key, value] of Object.entries(context)) {
    if (key === 'coverage') continue;
    assert.deepEqual((brief as Record<string, unknown>)[key], value, key);
  }
  for (const [key, value] of Object.entries(context.coverage)) assert.deepEqual((brief.coverage as Record<string, unknown>)[key], value, key);
  for (const key of ['themes', 'combinations', 'type', 'logos', 'icons', 'media', 'master', 'houseRules']) assert.ok(key in brief, key);
  assert.equal(brief.format, 'lolly-design-context');
  assert.equal(brief.version, 1);
});

test('combinations resolve declared names against the background token group', () => {
  const brief = designBrief(doc, catalog);
  assert.equal(brief.combinations.from, 'declared');
  assert.equal(brief.coverage.combinations, 'declared');
  const white = (brief.combinations.pairs as Array<{ background: { path: string }; text: Array<{ path: string }>; graphicOnly: Array<{ path: string }> }>)
    .find((p) => p.background.path === 'color.brand.white')!;
  assert.deepEqual(white.text.map((t) => t.path), ['color.brand.navy', 'color.brand.ink']);
  assert.deepEqual(white.graphicOnly.map((t) => t.path), ['color.brand.reef']);
});

test('themes, type, logos, icons, media and master come from the catalog facts', () => {
  const brief = designBrief(doc, catalog);
  assert.deepEqual(brief.themes.map((t) => t.name), ['light', 'dark']);
  assert.equal(brief.themes[1]!.semantic.surface, '#13294b');
  assert.deepEqual(brief.type.families.map((f) => f.value), ['Fixture Sans', 'Fixture Mono']);
  assert.ok(brief.type.roles.title, 'per-role type from the master');
  assert.deepEqual(brief.type.rules.map((r) => r.ruleId), ['headline-weight', 'body-weight', 'headline-case', 'align-left', 'poster-only']);
  assert.equal(brief.logos.onLight, 'tidewater/logo/positive');
  assert.deepEqual(brief.logos.variants.map((v) => [v.id, v.surface, v.mono]), [
    ['tidewater/logo/mono', 'any', true], ['tidewater/logo/positive', 'light', false], ['tidewater/logo/reverse', 'dark', false],
  ]);
  assert.deepEqual(brief.logos.variants.find((v) => v.id === 'tidewater/logo/reverse')!.tokenPaths, ['asset.logo.reverse']);
  assert.equal(brief.icons.count, 2);
  assert.deepEqual(brief.icons.ids, [{ id: 'tidewater/icons/anchor', name: 'Anchor', themable: true }, { id: 'tidewater/icons/wave', name: 'Wave', themable: false }]);
  assert.equal(brief.icons.idForm, '<id>?theme=<themeId>');
  // Tide is measured (navy base reads on white, reef accent reads on navy); Foam is declared.
  assert.deepEqual(brief.icons.themes.map((t) => [t.id, t.surfaces, t.surfacesFrom]), [['tide', ['light', 'dark'], 'contrast'], ['foam', ['dark'], 'declared']]);
  assert.deepEqual(Object.keys(brief.media.families), ['backgrounds', 'photos']);
  assert.deepEqual(brief.media.families.photos, { type: 'raster', count: 1, licenses: ['LicenseRef-Fixture'], ids: ['tidewater/photos/sea'] });
  assert.equal(brief.media.treatmentsFrom, 'declared');
  assert.equal(brief.master.id, master.id);
  assert.equal(brief.master.asset, 'tidewater/slides/masters');
  assert.equal(brief.master.archetypes.length, master.archetypes.length);
  const first = brief.master.archetypes[0]!.placeholders[0]!;
  const source = master.archetypes[0]!.placeholders[0]!;
  assert.deepEqual(first.box, {
    x: Math.round(source.box.x * master.size.width), y: Math.round(source.box.y * master.size.height),
    width: Math.round(source.box.w * master.size.width), height: Math.round(source.box.h * master.size.height),
  });
  assert.deepEqual(brief.houseRules.map((r) => r.id), ['headline-weight', 'body-weight', 'headline-case', 'align-left', 'pairings', 'rounded-edges', 'dashes', 'logo-surface', 'poster-only']);
  assert.equal(brief.coverage.houseRules, 'declared');
  assert.equal(brief.coverage.master, 'declared');
});

test('a blank pack gets empty or derived sections, never an exception', () => {
  const plain = { color: { $type: 'color', semantic: { surface: { $value: '#ffffff' }, text: { $value: '#222222' }, primary: { $value: '#7c3aed' } } } };
  for (const input of [plain, null, {}, 'not a doc']) {
    const brief = designBrief(input, null);
    assert.equal(brief.format, 'lolly-design-context');
    assert.deepEqual(brief.houseRules, []);
    assert.equal(brief.coverage.houseRules, 'unavailable');
    assert.equal(brief.coverage.master, 'neutral');
    assert.equal(brief.icons.count, 0);
    assert.deepEqual(brief.media.families, {});
  }
  const derived = designBrief(plain, null);
  assert.equal(derived.combinations.from, 'derived');
  assert.match(derived.combinations.note, /not by brand approval/);
  const surface = (derived.combinations.pairs as Array<{ background: { slot: string }; text: Array<{ slot: string }> }>).find((p) => p.background.slot === 'surface')!;
  assert.deepEqual(surface.text.map((t) => t.slot).sort(), ['primary', 'text']);
});

test('brandCheckCatalog hands the check the pack ids and the declared modifiers only', () => {
  assert.deepEqual(brandCheckCatalog(null), {});
  const opts = brandCheckCatalog(catalog);
  assert.ok(opts.assets!.includes('tidewater/icons/anchor'));
  assert.deepEqual(opts.iconThemes, ['tide', 'foam']);
  assert.deepEqual(opts.treatments, ['mono', 'sea']);
  assert.deepEqual(brandCheckCatalog({ assets: [] }), { assets: [] });
});

test('checkBrandDesign knows catalog ids and their modifiers, and skips uploads', () => {
  const boxes = [
    { id: 'icon', kind: 'image', image: 'tidewater/icons/anchor?theme=tide' },
    { id: 'bad-theme', kind: 'image', image: 'tidewater/icons/anchor?theme=lava' },
    { id: 'treated', kind: 'image', image: 'tidewater/photos/sea?treatment=mono' },
    { id: 'bad-treatment', kind: 'image', image: 'tidewater/photos/sea?treatment=sepia' },
    { id: 'stranger', kind: 'image', image: 'elsewhere/icons/anchor' },
    { id: 'logo', kind: 'image', image: '{asset.logo.positive}' },
    { id: 'upload', kind: 'image', image: 'user/media/0123abcd' },
    { id: 'upload-ref', kind: 'image', image: { id: 'photo-1', source: 'user' } },
  ];
  const before = checkBrandDesign(boxes, doc);
  // Without the catalog, every pack id but the token logo is unknown to the check.
  assert.deepEqual(before.findings.map((f) => f.layerId), ['icon', 'bad-theme', 'treated', 'bad-treatment', 'stranger']);
  const after = checkBrandDesign(boxes, doc, brandCheckCatalog(catalog));
  assert.deepEqual(after.findings.map((f) => [f.layerId, f.kind, f.status]), [
    ['bad-theme', 'reference', 'unknown'], ['bad-treatment', 'reference', 'unknown'], ['stranger', 'asset', 'review'],
  ]);
  assert.equal(after.uploads, 2);
  assert.equal(after.checked.assets, 6);
  assert.equal(after.coverage.assets, true);
  // Old callers see the same shape, plus the upload count.
  assert.equal(before.uploads, 2);
});

test('a token document carrying a brand system at the document level is valid DTCG for the catalog', () => {
  // The catalog validator reads the same schema; document-level $extensions is vendor data, not a group.
  const schema = JSON.parse(readFileSync(new URL('../schemas/tokens.schema.json', import.meta.url), 'utf8'));
  const validate = new Ajv({ strict: false }).compile(schema);
  assert.ok(validate(doc), JSON.stringify(validate.errors));
});
