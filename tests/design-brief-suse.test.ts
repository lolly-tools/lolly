// SPDX-License-Identifier: MPL-2.0
/**
 * The SUSE pack's brief data (plan 291 W3): the house rules stored in the SUSE tokens, the
 * icon-theme surfaces, and the brief and check built from them. The pack is private, so
 * every case here skips by name on a public clone; the synthetic fixture in
 * design-brief.test.ts and design-house-rules.test.ts covers the code paths there.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { brandResourceAssetIds } from '../engine/src/brand-resources.ts';
import { brandSystemOf } from '../engine/src/brand-system.ts';
import { checkBrandDesign } from '../engine/src/brand-check.ts';
import { brandCheckCatalog, designBrief } from '../engine/src/design-brief.ts';
import { DESIGN_HOUSE_RULE_KINDS, checkDesignHouseRules } from '../engine/src/design-house-rules.ts';
import { parseIconThemesDoc } from '../engine/src/icon-theme.ts';
import { seedFrame } from '../engine/src/slide-master.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { readProfileBriefCatalog } from '../packages/node-shell/src/design-brief.ts';

const SUSE = new URL('../brands/suse/catalog/assets/suse/', import.meta.url);
const SKIP = 'brands/suse is not checked out, so the suse profile cannot be resolved here';
const present = (): boolean => existsSync(new URL('tokens/brand.json', SUSE));
const tokens = (): unknown => JSON.parse(readFileSync(new URL('tokens/brand.json', SUSE), 'utf8'));

test('the SUSE tokens carry a valid brand system whose rules are all Design house rules', (t) => {
  if (!present()) { t.skip(SKIP); return; }
  const system = brandSystemOf(tokens());
  assert.ok(system, 'readBrandSystem accepts the SUSE record, so the Start Usage room can show it');
  assert.ok(system.rules.length >= 8);
  for (const rule of system.rules) {
    assert.ok((DESIGN_HOUSE_RULE_KINDS as readonly string[]).includes(rule.kind), rule.id);
    assert.equal(rule.origin.kind, 'source');
  }
});

test('the SUSE brand system lists no asset resources, so a SUSE brand export keeps reader 1', (t) => {
  if (!present()) { t.skip(SKIP); return; }
  // brand-transfer.ts embeds every role asset as a portable copy and raises the manifest's
  // minReader to 3 when there is one. The logo-surface rule lists its marks in its own
  // parameters, so no role needs to carry them.
  assert.deepEqual(brandResourceAssetIds(tokens()), []);
  const logoRule = brandSystemOf(tokens())!.rules.find((r) => r.id === 'logo-surface')!;
  assert.deepEqual(logoRule.roleIds, []);
});

test('every SUSE icon theme states the surfaces it suits', (t) => {
  if (!present()) { t.skip(SKIP); return; }
  const themes = parseIconThemesDoc(JSON.parse(readFileSync(new URL('palette/icon-themes.json', SUSE), 'utf8')));
  assert.equal(themes.length, 8);
  for (const theme of themes) {
    const surfaces = (theme as unknown as { surfaces?: unknown }).surfaces;
    assert.ok(Array.isArray(surfaces) && surfaces.length > 0 && surfaces.every((s) => s === 'light' || s === 'dark'), theme.id);
  }
});

test('the SUSE brief declares pairings, icons, media, the master and the house rules', (t) => {
  if (!present()) { t.skip(SKIP); return; }
  const catalog = readProfileBriefCatalog({ profile: 'suse' });
  assert.ok(catalog);
  const brief = designBrief(tokens(), catalog, { name: catalog.label });
  for (const key of ['combinations', 'icons', 'iconThemes', 'media', 'treatments', 'master', 'houseRules', 'logos'] as const) {
    assert.equal(brief.coverage[key], 'declared', key);
  }
  assert.equal(brief.logos.onLight, 'suse/logo/hor-pos-green');
  assert.ok(brief.icons.count > 100);
  const white = (brief.combinations.pairs as Array<{ background: { path: string }; text: Array<{ path: string }>; graphicOnly: Array<{ path: string }> }>)
    .find((p) => p.background.path === 'color.brand.white')!;
  assert.ok(!white.text.some((c) => c.path === 'color.brand.jungle'), 'Jungle is not a text colour on White');
  assert.ok(white.graphicOnly.some((c) => c.path === 'color.brand.jungle'));
});

test('the SUSE check knows themed icons and reports the four house-rule traps', (t) => {
  if (!present()) { t.skip(SKIP); return; }
  const doc = tokens();
  const catalog = readProfileBriefCatalog({ profile: 'suse' })!;
  const boxes = [
    { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    { id: 'icon', kind: 'image', frame: 'a1', x: 1700, y: 40, w: 120, h: 120, image: 'suse/icons/brain?theme=ember' },
    { id: 'icon-bad', kind: 'image', frame: 'a1', x: 1500, y: 40, w: 120, h: 120, image: 'suse/icons/brain?theme=lava' },
    { id: 'jungle', kind: 'text', frame: 'a1', x: 120, y: 900, w: 600, h: 60, text: 'Jungle on white', fontSize: 28, weight: '400', align: 'left', fg: '#30ba78', font: 'SUSE' },
    { id: 'heavy', kind: 'text', frame: 'a1', x: 120, y: 200, w: 1500, h: 150, text: 'A heavy headline', fontSize: 110, weight: '700', align: 'left', fg: '#0c322c', font: 'SUSE' },
    { id: 'centred', kind: 'text', frame: 'a1', x: 800, y: 900, w: 600, h: 60, text: 'Centred words', fontSize: 28, weight: '400', align: 'center', fg: '#0c322c', font: 'SUSE' },
    { id: 'card', kind: 'box', frame: 'a1', x: 1300, y: 600, w: 300, h: 200, shape: 'rounded', radius: 16, bg: '#ffffff', stroke: '#30ba78', strokeW: 2 },
  ];
  const brand = checkBrandDesign(boxes, doc, brandCheckCatalog(catalog));
  assert.deepEqual(brand.findings.map((f) => [f.layerId, f.kind]), [['icon-bad', 'reference']]);
  const house = checkDesignHouseRules(boxes, brandSystemOf(doc)!.rules, doc, { catalog });
  assert.deepEqual(house.findings.map((f) => `${f.ruleId}:${f.layerId}`).sort(),
    ['color-pairing:jungle', 'headline-weight:heavy', 'stroke-on-rounded:card', 'text-align:centred']);
});

test('frames seeded from the SUSE master keep every house rule, the logo on photography included', (t) => {
  if (!present()) { t.skip(SKIP); return; }
  const doc = tokens();
  const catalog = readProfileBriefCatalog({ profile: 'suse' })!;
  const set = createTokenSet(doc);
  const resolveToken = (p: string): string | undefined => { const v = set.resolve(p); return typeof v === 'string' ? v : undefined; };
  const boxes: Record<string, unknown>[] = [];
  catalog.master!.archetypes.forEach((archetype, i) => {
    const seeded = seedFrame(catalog.master!, archetype.id, { frameId: `f-${archetype.id}`, x: i * 2000, y: 0, resolveToken, ...(catalog.logos ? { logos: catalog.logos } : {}) });
    if (!seeded) return;
    boxes.push(seeded.frame as Record<string, unknown>);
    for (const layer of seeded.layers as Record<string, unknown>[]) boxes.push(layer.kind === 'text' && !layer.text ? { ...layer, text: 'Sample words here' } : layer);
  });
  const house = checkDesignHouseRules(boxes, brandSystemOf(doc)!.rules, doc, { catalog });
  // The master puts the neg-green mark over a full-bleed picture; the logo-surface rule
  // accepts both negative marks there, so a clean master-seeded deck is clean.
  assert.ok(boxes.some((b) => b.kind === 'image' && String(b.image).startsWith('suse/logo/')), 'the seeded frames carry logos');
  assert.deepEqual(house.findings.map((f) => `${f.ruleId}:${f.layerId}`), []);
  assert.deepEqual(house.unknown, []);
});
