// SPDX-License-Identifier: MPL-2.0
/**
 * Export provenance assembly tests.
 * Run with: node --test tests/metadata.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import {
  buildExportMeta, designRecordOf, designRecordEnvironment, designRecordWords, designRecordXml, readDesignRecord,
  readDesignRecordXml, parseThemeChoices, pdfKeywords, themesSelection, toolCredit,
  brandSkillRecords, designRecordFrom, guidedByWords, parseBrandSkills,
} from '../engine/src/metadata.ts';
import { addColourway, liftToColourways } from '../engine/src/colourway.ts';

const hostWith = (profile: Record<string, unknown>): any => ({
  profile: { get: async () => profile },
});

test('buildExportMeta: opted-in profile → author + contact, no copyright', async () => {
  const m = await buildExportMeta(hostWith({
    useDetails: true,
    firstname: 'Ada', lastname: 'Lovelace', email: 'ada@x.com', phone: '+1 555',
  }), { name: 'QR Code' });
  assert.equal(m.software, 'Lolly');
  assert.equal(m.source, 'https://lolly.tools');
  assert.equal(m.tool, 'QR Code');
  assert.equal(m.author, 'Ada Lovelace');
  assert.equal(m.contact, 'ada@x.com · +1 555');
  assert.match(m.description, /Made with https:\/\/lolly\.tools.*QR Code.*by Ada Lovelace/);
  // Provenance only - never assert ownership/licence.
  assert.equal('copyright' in m, false);
});

test('buildExportMeta: manifest id + version → toolId/toolVersion and the tool page as source', async () => {
  const m = await buildExportMeta(hostWith({}), { id: 'qr-code', name: 'QR Code', version: '2.6.0' });
  assert.equal(m.tool, 'QR Code');
  assert.equal(m.toolId, 'qr-code');
  assert.equal(m.toolVersion, '2.6.0');
  // The canonical share form of the tool's own page (engine/src/tool-url.ts) - an
  // identifier, never the inputs. Without an id the root stays (asserted above).
  assert.equal(m.source, 'https://lolly.tools/t/qr-code');
  // Absent fields stay absent (not ''), so a JSON dump of an id-less meta is byte-identical to before.
  const m2 = await buildExportMeta(hostWith({}), { name: 'Chart' });
  assert.equal('toolId' in m2, false);
  assert.equal('toolVersion' in m2, false);
});

test('buildExportMeta: details present but NOT opted in → no personal data embedded', async () => {
  const m = await buildExportMeta(hostWith({
    firstname: 'Ada', lastname: 'Lovelace', email: 'ada@x.com', phone: '+1 555',
  }), { name: 'QR Code' });
  assert.equal(m.author, '');          // opt-in (useDetails) is required
  assert.equal(m.contact, '');
  assert.equal(m.tool, 'QR Code');     // tool / platform attribution still stands
  assert.equal(m.software, 'Lolly');
  assert.equal(m.description, 'Made with https://lolly.tools : QR Code');
});

test('buildExportMeta: empty profile → software-only provenance', async () => {
  const m = await buildExportMeta(hostWith({}), { name: 'Chart' });
  assert.equal(m.author, '');
  assert.equal(m.contact, '');
  assert.equal(m.software, 'Lolly');
});

test('buildExportMeta: never emits a copyright symbol or the word copyright', async () => {
  const m = await buildExportMeta(hostWith({ firstname: 'Grace', lastname: 'Hopper' }), { name: 'Poster' });
  const blob = JSON.stringify(m).toLowerCase();
  assert.equal(blob.includes('copyright'), false);
  assert.equal(blob.includes('©'), false);
});

test('buildExportMeta: missing/throwing profile is tolerated', async () => {
  const m1 = await buildExportMeta({} as any, { id: 'x' });                 // no profile API
  assert.equal(m1.author, '');
  assert.equal(m1.tool, 'x');
  const m2 = await buildExportMeta({ profile: { get: async () => { throw new Error('nope'); } } } as any, { name: 'T' });
  assert.equal(m2.author, '');                                            // swallowed
  assert.equal(m2.software, 'Lolly');
});

// ─── The design-system record (plans/319 A7) ────────────────────────────────

type Rec = Record<string, unknown>;
const START = (): Rec => JSON.parse(readFileSync(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));

/** The public Lolly Start system with a second lead, Persimmon, beside the canonical Main. */
function colourwayDoc(): Rec {
  const lifted = liftToColourways(START(), { id: 'main', name: 'Main' });
  assert.ok(lifted.ok);
  const added = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: {
    light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
    dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
  } });
  assert.ok(added.ok);
  return added.doc;
}

const ACME = { id: 'acme', label: 'Acme', source: 'local' as const, active: true, locked: false, headId: null };
const snapshotOf = (document: unknown, extra: Rec = {}): any => ({
  document, system: ACME, version: 'latest', selection: { choices: { '': 'dark', colourway: 'persimmon' } }, ...extra,
});
const ANDY = { useDetails: true, firstname: 'Andy', lastname: 'Fitzsimon' };

test('design record: absent without a snapshot, so every existing meta is byte-identical', async () => {
  const before = await buildExportMeta(hostWith({}), { id: 'chart', name: 'Chart' }, ANDY);
  const none = await buildExportMeta(hostWith({}), { id: 'chart', name: 'Chart' }, ANDY, null, {});
  const nullSnap = await buildExportMeta(hostWith({}), { id: 'chart', name: 'Chart' }, ANDY, null, { snapshot: null });
  for (const m of [none, nullSnap]) {
    assert.equal(JSON.stringify(m), JSON.stringify(before));
    assert.equal('designSystem' in m || 'designVersion' in m || 'themes' in m, false);
  }
  assert.equal(before.description, 'Made with https://lolly.tools : Chart by Andy Fitzsimon');
  assert.deepEqual(pdfKeywords(before), ['Lolly', 'https://lolly.tools/t/chart'], 'the keywords a PDF has always carried');
});

test('design record: the colourway joins the tool name in the description, the label stays out', async () => {
  const m = await buildExportMeta(hostWith({}), { id: 'chart', name: 'Chart' }, ANDY, null, { snapshot: snapshotOf(colourwayDoc()) });
  assert.deepEqual(m.designSystem, { id: 'acme', label: 'Acme' });
  assert.deepEqual(m.themes, [{ group: 'colourway', kind: 'colourway', id: 'persimmon', name: 'Persimmon' }]);
  assert.equal('designVersion' in m, false, 'the edit head is never recorded as a version');
  assert.equal(m.description, 'Made with https://lolly.tools : Chart (Persimmon colourway) by Andy Fitzsimon');
  assert.equal(m.description.includes('Acme'), false, 'the design system label is in the record, never the description');
  assert.equal(toolCredit(m), 'Chart (Persimmon colourway)');
  assert.equal(designRecordWords(m), 'Acme · Colourway: Persimmon');
});

test('design record: the light/dark choice is not recorded, because the pixels show it', async () => {
  const m = await buildExportMeta(hostWith({}), { name: 'Chart' }, {}, null, { snapshot: snapshotOf(colourwayDoc()) });
  assert.equal(m.themes!.some((t) => t.group === ''), false);
});

test('design record: a canonical colourway nobody picked is still the one that drew the export', async () => {
  const m = await buildExportMeta(hostWith({}), { name: 'Chart' }, {}, null, { snapshot: snapshotOf(colourwayDoc(), { selection: {} }) });
  assert.deepEqual(m.themes, [{ group: 'colourway', kind: 'colourway', id: 'main', name: 'Main' }]);
  assert.equal(m.description, 'Made with https://lolly.tools : Chart (Main colourway)');
  // A partial choice map is completed by the resolver rather than dropping the group.
  const partial = await buildExportMeta(hostWith({}), { name: 'Chart' }, {}, null, { snapshot: snapshotOf(colourwayDoc(), { selection: { choices: { '': 'light' } } }) });
  assert.equal(partial.themes?.[0]?.id, 'main');
});

test('design record: no tool name means a bare description that gains nothing', async () => {
  const m = await buildExportMeta(hostWith({}), {}, {}, null, { snapshot: snapshotOf(colourwayDoc()) });
  assert.equal(m.description, 'Made with https://lolly.tools');
  assert.equal(m.themes?.[0]?.id, 'persimmon', 'the record itself is still written');
});

test('design record: a bindToMeta description is the author\'s own words and gains nothing', async () => {
  const m = await buildExportMeta(hostWith({}), { name: 'Chart' }, {}, [{ bindToMeta: 'description', value: 'Quarterly revenue' }],
    { snapshot: snapshotOf(colourwayDoc()) });
  assert.equal(m.description, 'Quarterly revenue');
  assert.equal(m.themes?.[0]?.id, 'persimmon');
});

test('design record: a tool that ignores the colourway records none and names none', async () => {
  const m = await buildExportMeta(hostWith({}), { name: 'Scanline', tokenAxes: { colourway: 'ignore' } }, {}, null, { snapshot: snapshotOf(colourwayDoc()) });
  assert.equal('themes' in m, false);
  assert.equal(m.description, 'Made with https://lolly.tools : Scanline');
  assert.deepEqual(m.designSystem, { id: 'acme', label: 'Acme' }, 'the design system is still recorded');
});

test('design record: a published version is recorded, the head never is', async () => {
  for (const head of ['latest', 'head', null, '']) {
    const m = await buildExportMeta(hostWith({}), { name: 'Chart' }, {}, null, { snapshot: snapshotOf(START(), { version: head }) });
    assert.equal('designVersion' in m, false, String(head));
  }
  const m = await buildExportMeta(hostWith({}), { name: 'Chart' }, {}, null, { snapshot: snapshotOf(START(), { version: '2026-10' }) });
  assert.equal(m.designVersion, '2026-10');
  assert.equal('themes' in m, false, 'a system with only light and dark records no theme');
  assert.equal(m.description, 'Made with https://lolly.tools : Chart', 'no colourway, no change to the description');
});

test('design record: other non-mode groups are recorded by their own name; one-option groups are not', () => {
  const doc = {
    base: { ink: { $type: 'color', $value: '#000000' } },
    light: { ink: { $value: '#111111' } }, dark: { ink: { $value: '#eeeeee' } },
    compact: {}, roomy: {}, only: {},
    $themes: [
      { name: 'light', selectedTokenSets: { base: 'source', light: 'enabled' } },
      { name: 'dark', selectedTokenSets: { base: 'source', dark: 'enabled' } },
      { name: 'Compact', id: 'compact', group: 'density', selectedTokenSets: { compact: 'enabled' } },
      { name: 'Roomy', id: 'roomy', group: 'density', selectedTokenSets: { roomy: 'enabled' } },
      { name: 'Only', id: 'only', group: 'single', selectedTokenSets: { only: 'enabled' } },
    ],
  };
  const r = designRecordOf({ document: doc, system: null, version: null, selection: { choices: { density: 'roomy' } } });
  assert.deepEqual(r, { themes: [{ group: 'density', id: 'roomy', name: 'Roomy' }] });
  assert.equal(designRecordWords(r), 'density: Roomy');
});

test('design record: only an id that reads as a design-system id is recorded', () => {
  const bad = designRecordOf({ document: null, system: { ...ACME, id: 'Not An Id!' }, version: null, selection: {} });
  assert.equal('designSystem' in bad, false);
  const unnamed = designRecordOf({ document: null, system: { ...ACME, label: '  ' }, version: null, selection: {} });
  assert.deepEqual(unnamed.designSystem, { id: 'acme', label: 'acme' }, 'an empty label falls back to the id');
});

test('design record: flat credential keys round-trip, with the theme list as one canonical JSON string', async () => {
  const m = await buildExportMeta(hostWith({}), { name: 'Chart' }, {}, null, { snapshot: snapshotOf(colourwayDoc(), { version: '2026-10' }) });
  const env = designRecordEnvironment(m);
  assert.deepEqual(Object.keys(env), ['designSystem', 'designSystemLabel', 'designVersion', 'themes']);
  for (const v of Object.values(env)) assert.equal(typeof v, 'string', 'Verify keeps only scalar values');
  assert.equal(env.themes, '[{"group":"colourway","id":"persimmon","kind":"colourway","name":"Persimmon"}]');
  assert.deepEqual(readDesignRecord(env), { designSystem: m.designSystem, designVersion: '2026-10', themes: m.themes });
  assert.deepEqual(designRecordEnvironment({}), {}, 'nothing to record, nothing written');
  assert.equal(readDesignRecord({ tool: 'Chart' }), null);
  assert.deepEqual(themesSelection(m.themes), { colourway: 'persimmon' });
});

test('design record: a foreign record is bounded and shape-checked on the way back in', () => {
  assert.deepEqual(parseThemeChoices('not json'), []);
  assert.deepEqual(parseThemeChoices('{"group":"x"}'), []);
  assert.deepEqual(parseThemeChoices('x'.repeat(9000)), []);
  assert.deepEqual(parseThemeChoices(JSON.stringify([{ group: 'g', id: '' }, { group: 1, id: 'a' }, { group: 'g', id: 'b', kind: 'evil' }])),
    [{ group: 'g', id: 'b', name: 'b' }], 'an unknown kind is dropped, a malformed entry skipped');
  assert.equal(parseThemeChoices(JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ group: `g${i}`, id: 'a' })))).length, 16);
  const r = readDesignRecord({ designSystem: '../etc', designSystemLabel: 'x', designVersion: 'latest' });
  assert.equal(r, null, 'a path-like id is no design-system id, and latest is the head');
  assert.equal(readDesignRecord({ designSystem: 'acme', designSystemLabel: 'L'.repeat(500) })!.designSystem!.label.length, 200);
});

test('design record: the lolly: XML properties escape typed text and read back verbatim', () => {
  const meta = { designSystem: { id: 'acme', label: 'Smith & <Jones> "Co"' }, themes: [{ group: 'colourway', kind: 'colourway' as const, id: 'a', name: 'R&D' }] };
  const xml = designRecordXml(meta);
  assert.equal(xml[0], '<lolly:DesignSystem>acme</lolly:DesignSystem>');
  assert.equal(xml[1], '<lolly:DesignSystemLabel>Smith &amp; &lt;Jones&gt; "Co"</lolly:DesignSystemLabel>');
  assert.equal(xml.join('').includes('<Jones>'), false);
  assert.deepEqual(readDesignRecordXml(xml.join('')), meta);
  assert.deepEqual(designRecordXml({}), []);
  assert.equal(readDesignRecordXml('<x:xmpmeta/>'), null);
});

test('design record: PDF keywords name the record after the keywords a PDF always carried', async () => {
  const m = await buildExportMeta(hostWith({}), { id: 'chart', name: 'Chart' }, {}, null, { snapshot: snapshotOf(colourwayDoc(), { version: '2026-10' }) });
  assert.deepEqual(pdfKeywords(m), ['Lolly', 'https://lolly.tools/t/chart', 'Design system: Acme', 'Design version: 2026-10', 'Colourway: Persimmon']);
  assert.deepEqual(pdfKeywords(null), []);
});

// ─── The brand skills record (plan 323) ──────────────────────────────────────

const BRAND = { id: 'acme/skill/brand', name: 'acme-brand', revision: '1.0', sha256: '0f'.repeat(32) };
const PHOTO = { id: 'acme/skill/photography', name: 'acme-photography', revision: '1.2', sha256: 'ab'.repeat(32) };

test('brand skills: absent, empty or null leaves every meta byte-identical', async () => {
  const before = await buildExportMeta(hostWith({}), { id: 'chart', name: 'Chart' }, ANDY, null, { snapshot: snapshotOf(colourwayDoc()) });
  for (const brandSkills of [undefined, null, []]) {
    const m = await buildExportMeta(hostWith({}), { id: 'chart', name: 'Chart' }, ANDY, null, { snapshot: snapshotOf(colourwayDoc()), brandSkills });
    assert.equal(JSON.stringify(m), JSON.stringify(before), String(brandSkills));
    assert.equal('brandSkills' in m, false);
    assert.deepEqual(pdfKeywords(m), pdfKeywords(before));
    assert.deepEqual(designRecordEnvironment(m), designRecordEnvironment(before));
    assert.deepEqual(designRecordXml(m), designRecordXml(before));
  }
});

test('brand skills: recorded beside the design-system record, never in the description', async () => {
  const m = await buildExportMeta(hostWith({}), { id: 'chart', name: 'Chart' }, ANDY, null, { snapshot: snapshotOf(colourwayDoc()), brandSkills: [BRAND, PHOTO] });
  assert.deepEqual(m.brandSkills, [BRAND, PHOTO], 'in the order the agent named them');
  assert.equal(m.description, 'Made with https://lolly.tools : Chart (Persimmon colourway) by Andy Fitzsimon');
  assert.deepEqual(designRecordFrom(m).brandSkills, [BRAND, PHOTO]);
  assert.equal(designRecordWords(m), 'Acme · Colourway: Persimmon · Guided by: acme-brand 1.0, acme-photography 1.2');
  assert.equal(designRecordWords(m, { skills: false }), 'Acme · Colourway: Persimmon');
  assert.equal(guidedByWords(m.brandSkills), 'acme-brand 1.0, acme-photography 1.2');
  // A host with no design system still records the skills an agent was handed.
  const bare = await buildExportMeta(hostWith({}), { name: 'Chart' }, {}, null, { brandSkills: [BRAND] });
  assert.deepEqual(bare.brandSkills, [BRAND]);
  assert.equal('designSystem' in bare, false);
  assert.equal(designRecordWords(bare), 'Guided by: acme-brand 1.0');
});

test('brand skills: the credential key is one canonical JSON string that reads back', async () => {
  const m = await buildExportMeta(hostWith({}), { name: 'Chart' }, {}, null, { snapshot: snapshotOf(colourwayDoc(), { version: '2026-10' }), brandSkills: [BRAND] });
  const env = designRecordEnvironment(m);
  assert.deepEqual(Object.keys(env), ['designSystem', 'designSystemLabel', 'designVersion', 'themes', 'brandSkills']);
  assert.equal(env.brandSkills, `[{"id":"acme/skill/brand","name":"acme-brand","revision":"1.0","sha256":"${'0f'.repeat(32)}"}]`);
  for (const v of Object.values(env)) assert.equal(typeof v, 'string', 'Verify keeps only scalar values');
  assert.deepEqual(readDesignRecord(env), { designSystem: m.designSystem, designVersion: '2026-10', themes: m.themes, brandSkills: [BRAND] });
  assert.deepEqual(readDesignRecord({ brandSkills: env.brandSkills }), { brandSkills: [BRAND] }, 'skills alone are a record');
});

test('brand skills: the lolly:BrandSkills property and the PDF keywords', async () => {
  const meta = { designSystem: { id: 'acme', label: 'Acme' }, brandSkills: [BRAND, PHOTO] };
  const xml = designRecordXml(meta);
  assert.equal(xml.length, 3);
  assert.match(xml[2]!, /^<lolly:BrandSkills>\[\{"id":"acme\/skill\/brand",.*\}\]<\/lolly:BrandSkills>$/);
  assert.deepEqual(readDesignRecordXml(xml.join('')), meta);
  const m = await buildExportMeta(hostWith({}), { id: 'chart', name: 'Chart' }, {}, null, { snapshot: snapshotOf(colourwayDoc(), { version: '2026-10' }), brandSkills: [BRAND, PHOTO] });
  assert.deepEqual(pdfKeywords(m), [
    'Lolly', 'https://lolly.tools/t/chart', 'Design system: Acme', 'Design version: 2026-10', 'Colourway: Persimmon',
    'Guided by: acme-brand 1.0', 'Guided by: acme-photography 1.2',
  ]);
});

test('brand skills: a list is bounded and shape-checked on the way in and on the way back', () => {
  assert.deepEqual(parseBrandSkills('not json'), []);
  assert.deepEqual(parseBrandSkills('{"id":"acme/skill/brand"}'), []);
  assert.deepEqual(parseBrandSkills('x'.repeat(9000)), []);
  assert.deepEqual(parseBrandSkills(null), []);
  const bad = [
    { ...BRAND, id: '../etc/passwd' },
    { ...BRAND, id: 'Acme/Skill' },
    { ...BRAND, name: 'Acme Brand' },
    { ...BRAND, revision: '1.0 <b>' },
    { ...BRAND, sha256: 'xyz' },
    { ...BRAND, sha256: 'ab'.repeat(31) },
    { id: 'acme/skill/no-hash', name: 'acme-x', revision: '1' },
    'acme-brand', null, 7,
  ];
  assert.deepEqual(brandSkillRecords([...bad, BRAND]), [BRAND], 'each malformed entry is dropped, the good one kept');
  // A digest prefix and upper case are normalised; a repeated id keeps the first.
  assert.deepEqual(brandSkillRecords([{ ...BRAND, sha256: `sha256:${'0F'.repeat(32)}` }, { ...BRAND, revision: '2.0' }]), [BRAND]);
  const many = Array.from({ length: 40 }, (_, i) => ({ ...BRAND, id: `acme/skill/s${i}` }));
  assert.equal(brandSkillRecords(many).length, 16);
  assert.ok(JSON.stringify(brandSkillRecords(many)).length <= 8192, 'the longest list written still reads back');
  assert.equal(parseBrandSkills(JSON.stringify(brandSkillRecords(many))).length, 16);
  // A hand-built meta cannot write a malformed entry into a credential or a file.
  assert.deepEqual(designRecordEnvironment({ brandSkills: [{ ...BRAND, sha256: 'nope' }] }), {});
  assert.deepEqual(designRecordXml({ brandSkills: [{ ...BRAND, id: '<x>' }] }), []);
  assert.equal(readDesignRecord({ brandSkills: '[{"id":"<x>"}]' }), null);
  assert.equal(readDesignRecordXml('<lolly:BrandSkills>[1,2]</lolly:BrandSkills>'), null);
});
