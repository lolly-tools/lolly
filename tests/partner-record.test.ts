// SPDX-License-Identifier: MPL-2.0
/**
 * The partner in the Lolly record (Lolly Work plans/82 M3, section 6, approved by
 * Andy on 2026-11-07). An export made for a partner company records it beside the
 * design system, with the five approved partner keys and two attached kit keys
 * (M8), their `lolly:` properties and one PDF keyword, under the record's one switch. Nothing
 * about the person, a contact's email or phone, an address or a currency is
 * written. With no partner every writer stays exactly as it was.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntime } from '../engine/src/runtime.ts';
import {
  buildExportMeta, designRecordEnvironment, designRecordKeywords, designRecordWords, designRecordXml, isEmptyDesignRecord,
  partnerFactWords, partnerRecord, partnerWords, readDesignRecord, readDesignRecordXml,
} from '../engine/src/metadata.ts';
import { buildExportXmp, injectSvgMeta } from '../engine/src/image-meta.ts';
import { embedC2pa, generateSigner } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import type { ExportMeta, ExportPartner, TokensSnapshot } from '../engine/src/bridge/host-v1.ts';

type Rec = Record<string, unknown>;
type Tool = Parameters<typeof createRuntime>[0];
type Host = Parameters<typeof createRuntime>[1];

const PARTNER: ExportPartner = { company: { id: 'northwind-it', label: 'Northwind IT', revision: 3 }, programme: { id: 'resellers-emea', label: 'Resellers, EMEA' } };
const KIT = { id: 'inst/5b2e', revision: 2 };
const PARTNER_WITH_KIT: ExportPartner = { ...PARTNER, kit: KIT };
const SYSTEM = { id: 'suse', label: 'SUSE', source: 'local', active: true, locked: false, headId: null } as const;
const DOC = { color: { brand: { $type: 'color', $value: '#30ba78' } } };
const snapshot = (): TokensSnapshot => ({ document: DOC, system: SYSTEM, version: 'latest', selection: {} } as TokensSnapshot);
const MANIFEST = { id: 'data-sheet', name: 'Data sheet', version: '1.0.0' };

test('the approved keys, and nothing more', async () => {
  const meta = await buildExportMeta(null, MANIFEST, { useDetails: false }, [], { snapshot: snapshot(), partner: PARTNER });
  assert.deepEqual(meta.partner, PARTNER);
  assert.equal(meta.description, 'Made with https://lolly.tools : Data sheet', 'the description does not change');
  const env = designRecordEnvironment(meta);
  assert.deepEqual(Object.keys(env).filter((k) => k.startsWith('partner')).sort(),
    ['partnerCompany', 'partnerCompanyLabel', 'partnerProfileRevision', 'partnerProgramme', 'partnerProgrammeLabel']);
  assert.equal(env.partnerCompany, 'northwind-it');
  assert.equal(env.partnerCompanyLabel, 'Northwind IT');
  assert.equal(env.partnerProfileRevision, '3');
  assert.equal(env.partnerProgramme, 'resellers-emea');
  assert.equal(env.partnerProgrammeLabel, 'Resellers, EMEA');
  assert.deepEqual(designRecordKeywords(meta).filter((k) => k.startsWith('Partner')), ['Partner: Northwind IT']);
  assert.deepEqual(designRecordXml(meta).filter((p) => p.includes('Partner')), [
    '<lolly:PartnerCompany>northwind-it</lolly:PartnerCompany>',
    '<lolly:PartnerCompanyLabel>Northwind IT</lolly:PartnerCompanyLabel>',
    '<lolly:PartnerProfileRevision>3</lolly:PartnerProfileRevision>',
    '<lolly:PartnerProgramme>resellers-emea</lolly:PartnerProgramme>',
    '<lolly:PartnerProgrammeLabel>Resellers, EMEA</lolly:PartnerProgrammeLabel>',
  ]);
});

test('the words: the record line, and Verify\'s fact', () => {
  assert.equal(designRecordWords({ designSystem: { id: 'suse', label: 'SUSE' }, themes: [{ group: 'colourway', kind: 'colourway', id: 'spearmint', name: 'Spearmint' }], partner: PARTNER }),
    'SUSE · Colourway: Spearmint · Partner: Northwind IT (Resellers, EMEA)');
  assert.equal(partnerWords({ company: PARTNER.company }), 'Partner: Northwind IT');
  assert.equal(partnerWords({ programme: PARTNER.programme }), 'Partner programme: Resellers, EMEA');
  assert.equal(partnerWords(undefined), '');
  assert.equal(partnerFactWords(PARTNER), 'Northwind IT, Resellers, EMEA programme, details revision 3');
  assert.equal(designRecordWords({ designSystem: { id: 'suse', label: 'SUSE' }, partner: PARTNER }, { partner: false }), 'SUSE');
  assert.equal(`Records: ${designRecordWords({ designSystem: { id: 'suse', label: 'SUSE' }, themes: [{ group: 'colourway', kind: 'colourway', id: 'spearmint', name: 'Spearmint' }], partner: PARTNER_WITH_KIT })}`,
    'Records: SUSE · Colourway: Spearmint · Partner: Northwind IT (Resellers, EMEA), kit revision 2');
  assert.equal(partnerWords({ company: PARTNER.company, kit: KIT }), 'Partner: Northwind IT, kit revision 2');
  assert.equal(partnerFactWords(PARTNER_WITH_KIT), 'Northwind IT, Resellers, EMEA programme, details revision 3, kit revision 2');
});

test('the attached kit adds exactly two keys and XML properties, with no PDF keyword', async () => {
  const meta = await buildExportMeta(null, MANIFEST, { useDetails: false }, [], { snapshot: snapshot(), partner: PARTNER_WITH_KIT });
  const base = { ...meta, partner: PARTNER };
  assert.deepEqual(meta.partner, PARTNER_WITH_KIT);
  assert.deepEqual(designRecordEnvironment(meta), { ...designRecordEnvironment(base), partnerKit: 'inst/5b2e', partnerKitRevision: '2' });
  assert.deepEqual(designRecordXml(meta), [
    ...designRecordXml(base),
    '<lolly:PartnerKit>inst/5b2e</lolly:PartnerKit>',
    '<lolly:PartnerKitRevision>2</lolly:PartnerKitRevision>',
  ]);
  assert.deepEqual(designRecordKeywords(meta), designRecordKeywords(base));
  assert.deepEqual(readDesignRecord(designRecordEnvironment(meta))?.partner, PARTNER_WITH_KIT);
  assert.deepEqual(readDesignRecordXml(buildExportXmp(meta))?.partner, PARTNER_WITH_KIT);
  const svg = injectSvgMeta('<svg xmlns="http://www.w3.org/2000/svg"></svg>', meta);
  assert.ok(svg.includes('<lolly:PartnerKit>inst/5b2e</lolly:PartnerKit>'));
  assert.ok(svg.includes('<lolly:PartnerKitRevision>2</lolly:PartnerKitRevision>'));
  assert.deepEqual(readDesignRecordXml(svg)?.partner, PARTNER_WITH_KIT);
});

test('a kit needs a valid company beside the attachment', () => {
  for (const partner of [
    { kit: KIT },
    { company: { id: '../northwind-it', label: 'Northwind IT', revision: 3 }, kit: KIT },
    { programme: PARTNER.programme, kit: KIT },
  ]) {
    const record = { partner: partner as ExportPartner };
    assert.equal(partnerRecord(partner)?.kit, undefined);
    assert.equal('partnerKit' in designRecordEnvironment(record), false);
    assert.equal('partnerKitRevision' in designRecordEnvironment(record), false);
    assert.ok(designRecordXml(record).every((p) => !p.includes('PartnerKit')));
  }
  assert.equal(readDesignRecord({ partnerKit: KIT.id, partnerKitRevision: '2' }), null);
  assert.equal(readDesignRecord({ partnerCompany: '../x', partnerCompanyLabel: 'X', partnerProfileRevision: '3', partnerKit: KIT.id, partnerKitRevision: '2' }), null);
});

test('a hostile kit id or revision is dropped at every writer and reader', async () => {
  for (const kit of [
    null, [], {}, 'inst/5b2e@2',
    { id: '../x', revision: 2 }, { id: 'inst/x?token=private', revision: 2 },
    { id: 'inst/<x>', revision: 2 }, { id: 'x'.repeat(201), revision: 2 },
    { id: 'a/b/c/d/e/f/g/h/i', revision: 2 },
    ...[0, -1, 1.5, 1_000_001, Infinity, NaN, '2', true, [2]].map((revision) => ({ id: KIT.id, revision })),
    Object.create(KIT),
  ]) {
    const partner = { ...PARTNER, kit } as unknown as ExportPartner;
    assert.deepEqual(partnerRecord(partner), PARTNER);
    const meta = await buildExportMeta(null, MANIFEST, { useDetails: false }, [], { partner });
    assert.deepEqual(meta.partner, PARTNER);
    assert.deepEqual(designRecordEnvironment({ partner }), designRecordEnvironment({ partner: PARTNER }));
    assert.deepEqual(designRecordXml({ partner }), designRecordXml({ partner: PARTNER }));
    assert.deepEqual(designRecordKeywords({ partner }), ['Partner: Northwind IT']);
  }
  const env = designRecordEnvironment({ partner: PARTNER });
  for (const partnerKitRevision of [undefined, null, true, ['2'], {}, Symbol('2')]) {
    assert.deepEqual(readDesignRecord({ ...env, partnerKit: KIT.id, partnerKitRevision })?.partner, PARTNER);
  }
  for (const [partnerKit, partnerKitRevision] of [['../x', '2'], [KIT.id, '0'], [KIT.id, '1.5'], [KIT.id, '1000001'], [KIT.id, 'two']]) {
    const raw = { ...env, partnerKit, partnerKitRevision };
    assert.deepEqual(readDesignRecord(raw)?.partner, PARTNER);
    const xml = `${designRecordXml({ partner: PARTNER }).join('')}<lolly:PartnerKit>${partnerKit}</lolly:PartnerKit><lolly:PartnerKitRevision>${partnerKitRevision}</lolly:PartnerKitRevision>`;
    assert.deepEqual(readDesignRecordXml(xml)?.partner, PARTNER);
  }
});

test('a programme with no company writes its keys but no PDF keyword', async () => {
  const meta = await buildExportMeta(null, MANIFEST, { useDetails: false }, [], { partner: { programme: PARTNER.programme } });
  assert.deepEqual(designRecordKeywords(meta), [], 'only "Partner: <company>" is an approved keyword');
  assert.deepEqual(designRecordEnvironment(meta), { partnerProgramme: 'resellers-emea', partnerProgrammeLabel: 'Resellers, EMEA' });
  assert.deepEqual(designRecordXml(meta), [
    '<lolly:PartnerProgramme>resellers-emea</lolly:PartnerProgramme>',
    '<lolly:PartnerProgrammeLabel>Resellers, EMEA</lolly:PartnerProgrammeLabel>',
  ]);
});

test('read back from the credential keys and from XMP', async () => {
  const meta = await buildExportMeta(null, MANIFEST, { useDetails: false }, [], { snapshot: snapshot(), partner: PARTNER });
  assert.deepEqual(readDesignRecord(designRecordEnvironment(meta))?.partner, PARTNER);
  assert.deepEqual(readDesignRecordXml(buildExportXmp(meta))?.partner, PARTNER);
  assert.ok(injectSvgMeta('<svg xmlns="http://www.w3.org/2000/svg"></svg>', meta).includes('<lolly:PartnerCompanyLabel>Northwind IT</lolly:PartnerCompanyLabel>'));
  assert.equal(isEmptyDesignRecord({ partner: PARTNER }), false, 'a partner alone is a record');
  assert.deepEqual(readDesignRecord({ partnerProgramme: 'resellers-emea', partnerProgrammeLabel: 'Resellers, EMEA' })?.partner, { programme: PARTNER.programme });
});

test('nothing about a person, a contact, an address or a currency is ever written', async () => {
  const leaky = { ...PARTNER, kit: { ...KIT, colours: ['#123456'], rules: { minSize: 42 }, bytes: 'kit-secret' }, company: { ...PARTNER.company!, email: 'rita@northwind.example', phone: '+49 30 1', address: 'Unter den Linden 1', currency: 'EUR' }, person: 'Rita Ortiz', token: 'tok_1', agent: 'agent-secret' };
  const meta = await buildExportMeta(null, MANIFEST, { useDetails: false }, [], { partner: leaky as never });
  const written = JSON.stringify([meta, designRecordEnvironment(meta), designRecordKeywords(meta), designRecordXml(meta)]);
  assert.deepEqual(meta.partner, PARTNER_WITH_KIT);
  for (const never of ['rita@', '+49', 'Linden', 'EUR', 'Rita', 'tok_', '#123456', 'minSize', 'kit-secret', 'agent-secret']) assert.ok(!written.includes(never), `never written: ${never}`);
});

test('a hand-built or foreign value is refused at every writer and reader', async () => {
  for (const bad of [
    { company: { id: 'Northwind IT', label: 'Northwind IT', revision: 3 } },
    { company: { id: 'northwind-it', label: '', revision: 3 } },
    { company: { id: 'northwind-it', label: 'Northwind IT', revision: 0 } },
    { company: { id: 'northwind-it', label: 'Northwind IT', revision: 1.5 } },
    { programme: { id: '../x', label: 'X' } },
    'Northwind IT',
  ]) {
    assert.equal(partnerRecord(bad), undefined, JSON.stringify(bad));
    const meta = { software: 'Lolly', source: '', tool: '', author: '', contact: '', description: '', partner: bad } as unknown as ExportMeta;
    assert.deepEqual(designRecordEnvironment(meta), {});
    assert.deepEqual(designRecordKeywords(meta), []);
    assert.deepEqual(designRecordXml(meta), []);
  }
  assert.equal(readDesignRecord({ partnerCompany: 'northwind-it', partnerCompanyLabel: 'Northwind IT', partnerProfileRevision: 'three' }), null);
  assert.equal(readDesignRecordXml('<lolly:PartnerCompany>NW IT</lolly:PartnerCompany><lolly:PartnerCompanyLabel>x</lolly:PartnerCompanyLabel><lolly:PartnerProfileRevision>1</lolly:PartnerProfileRevision>'), null);
  assert.equal(partnerRecord({ company: { ...PARTNER.company, label: 'x'.repeat(500) } })?.company?.label.length, 200, 'a label is bounded');
});

// Through the runtime: the same switch the export panel's card, _madewith and --no-madewith set.
let seq = 0;
const tool = (): Tool => ({
  trustClass: 'catalog',
  manifest: { id: `partner-record-${++seq}`, name: 'Data sheet', version: '1.0.0', engineVersion: '^1.0.0', status: 'official', render: { width: 100, height: 100, formats: ['png'] }, inputs: [{ id: 'title', type: 'text', default: 'Hello' }] },
  template: '<p>{{title}}</p>', styles: null, hooksSource: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
} as unknown as Tool);
const host = (renders: Rec[], given: TokensSnapshot | null): Host => ({
  version: '1', shell: 'test', profile: { get: async () => ({}) }, log: () => {},
  ...(given ? { tokens: { get: async () => ({ size: 0 }), colors: async () => [], resolve: async () => null, themes: async () => [], snapshot: async () => given } } : {}),
  export: { render: async (_n: unknown, _f: string, options: Rec) => { renders.push(options); return new Blob([new Uint8Array([1])], { type: 'image/png' }); } },
} as unknown as Host);
const canvas = (): Element => new JSDOM('<div id="c"><p>Hello</p></div>').window.document.getElementById('c')!;

test('no partner set: every export stays exactly as it was', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders, snapshot()), {});
  await runtime.export(canvas(), 'png', {});
  assert.equal('partner' in (renders[0]!.meta as Rec), false);
  assert.equal('partner' in (await runtime.madeWithPreview())!.record, false);
});

test('set by the host, shown before the export, and the card\'s one switch takes it out with the rest', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders, snapshot()), {});
  runtime.setPartner(PARTNER_WITH_KIT);
  assert.deepEqual((await runtime.madeWithPreview())!.record.partner, PARTNER_WITH_KIT, 'the card can show the words before anything is written');
  await runtime.export(canvas(), 'png', {});
  assert.deepEqual((renders[0]!.meta as ExportMeta).partner, PARTNER_WITH_KIT);
  runtime.setMadeWith(false);
  await runtime.export(canvas(), 'png', {});
  assert.equal('partner' in (renders[1]!.meta as Rec), false, 'unticking leaves the partner out together with the design system');
  assert.deepEqual(runtime.partner(), PARTNER_WITH_KIT, 'a second runtime exporting the same document copies it from here');
  runtime.setMadeWith(true);
  runtime.setPartner(null);
  assert.equal(runtime.partner(), null);
  await runtime.export(canvas(), 'png', {});
  assert.equal('partner' in (renders[2]!.meta as Rec), false);
});

test('a piece with no attachment, a detached piece or another company\'s kit records no kit', async () => {
  const { setWorkspaceCompany } = await import('../shells/web/src/lib/workspace-templates.ts');
  const { followPiecePartner } = await import('../shells/web/src/lib/partner-kit-state.ts');
  const { dropPieceState, notifyPieceKit, setPieceState } = await import('../shells/web/src/lib/partner-kit-state.ts');
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders, snapshot()), {});
  setWorkspaceCompany({ id: 'northwind-it', name: 'Northwind IT', revision: 3, logos: {} });
  const stop = followPiecePartner(runtime);
  try {
    for (const company of [null, 'northwind-it', null, 'another-company']) {
      if (company) setPieceState(runtime, { attachment: KIT, kit: { schemaVersion: 1, id: company, label: 'Northwind IT', logos: {}, colours: [] } });
      else dropPieceState(runtime);
      notifyPieceKit();
      await runtime.export(canvas(), 'png', {});
      const env = designRecordEnvironment(renders.at(-1)!.meta as ExportMeta);
      assert.equal(env.partnerCompany, 'northwind-it');
      assert.equal(env.partnerKit, company === 'northwind-it' ? KIT.id : undefined);
      assert.equal(env.partnerKitRevision, company === 'northwind-it' ? '2' : undefined);
    }
  } finally {
    stop();
    dropPieceState(runtime);
    setWorkspaceCompany(null);
  }
});

test('a host with no design system still records the partner, and the card can show it', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders, null), {});
  assert.equal(await runtime.madeWithPreview(), null, 'nothing to record, nothing shown');
  runtime.setPartner(PARTNER);
  assert.deepEqual((await runtime.madeWithPreview())!.record, { partner: PARTNER });
  await runtime.export(canvas(), 'png', {});
  assert.deepEqual((renders[0]!.meta as ExportMeta).partner, PARTNER);
});

test('a signed credential carries the partner and kit keys, and Verify reads them back', async () => {
  const dates = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 86_400_000) };
  const meta = await buildExportMeta(null, MANIFEST, { useDetails: false }, [], { snapshot: snapshot(), partner: PARTNER_WITH_KIT });
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
  const bytes = await embedC2pa(svg, 'svg', {
    claimGenerator: 'Lolly', generatorInfo: { name: 'Lolly', version: 'test' }, title: 'Data sheet',
    environment: { tool: 'data-sheet', format: 'svg', ...designRecordEnvironment(meta) }, dates, signer: await generateSigner(dates),
  } as Parameters<typeof embedC2pa>[2]);
  const report = await verifyC2pa(bytes);
  assert.equal(report.state, 'valid');
  assert.deepEqual(readDesignRecord(report.environment)?.partner, PARTNER_WITH_KIT);
  assert.equal(partnerFactWords(readDesignRecord(report.environment)?.partner), 'Northwind IT, Resellers, EMEA programme, details revision 3, kit revision 2');
});
