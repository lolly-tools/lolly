// SPDX-License-Identifier: MPL-2.0
/**
 * A file that leads back to its brand page (plan 351 B5). The design-system record gains the
 * page's address only when the publisher opts in per brand. It rides the existing switch,
 * and a brand with no address writes exactly what it wrote before. On the way back the
 * address is read only from a credential that verifies, and only as a plain https address.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createRuntime } from '../engine/src/runtime.ts';
import {
  BRAND_PAGE_ADDRESS_MAX, brandPageAddress, brandPageHost, readRecordedBrandPage, withRecordedBrandPage,
} from '../engine/src/brand-page-address.ts';
import {
  buildExportMeta, designRecordEnvironment, designRecordKeywords, designRecordOf, designRecordWords, designRecordXml, isEmptyDesignRecord, readDesignRecord, readDesignRecordXml,
} from '../engine/src/metadata.ts';
import { buildExportXmp, injectSvgMeta } from '../engine/src/image-meta.ts';
import { embedC2pa, generateSigner } from '../engine/src/c2pa.ts';
import { extractC2paStore, verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { extractFileMetadata } from '../engine/src/file-metadata.ts';
import { TOKEN_EXT } from '../engine/src/token-ext.ts';
import { buildBrandPage } from '../engine/src/brand-page.ts';
import { verdictBrandPage } from '../packages/node-shell/src/verdict-report.ts';
import { designRecordText } from '../services/mcp/src/render.ts';
import type { ExportMeta, TokensSnapshot } from '../engine/src/bridge/host-v1.ts';

type Rec = Record<string, unknown>;
type Tool = Parameters<typeof createRuntime>[0];
type Host = Parameters<typeof createRuntime>[1];

const PAGE = 'https://acme.example/brand/acme/';
const SYSTEM = { id: 'acme', label: 'Acme', source: 'local', active: true, locked: false, headId: null } as const;
const DOC = { color: { brand: { $type: 'color', $value: '#123456' } } };
const snapshot = (over: Partial<TokensSnapshot> = {}): TokensSnapshot => ({ document: DOC, system: SYSTEM, version: '2026-10', selection: {}, ...over });

// Written by the code on main before this feature, so a change to either is a change to files.
const XMP_NO_ADDRESS = "<x:xmpmeta xmlns:x=\"adobe:ns:meta/\"><rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"><rdf:Description rdf:about=\"\" xmlns:xmp=\"http://ns.adobe.com/xap/1.0/\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:xmpRights=\"http://ns.adobe.com/xap/1.0/rights/\" xmlns:photoshop=\"http://ns.adobe.com/photoshop/1.0/\" xmlns:plus=\"http://ns.useplus.org/ldf/xmp/1.0/\" xmlns:lolly=\"https://lolly.tools/ns/export/1.0/\"><xmp:CreatorTool>Lolly</xmp:CreatorTool><lolly:DesignSystem>acme</lolly:DesignSystem><lolly:DesignSystemLabel>Acme</lolly:DesignSystemLabel><lolly:DesignVersion>2026-10</lolly:DesignVersion></rdf:Description></rdf:RDF></x:xmpmeta>";
const SVG_NO_ADDRESS = "<svg xmlns=\"http://www.w3.org/2000/svg\">\n<title>Chart</title>\n<desc>Made with https://lolly.tools : Chart</desc>\n<metadata>\n<rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:lolly=\"https://lolly.tools/ns/export/1.0/\">\n<rdf:Description rdf:about=\"\">\n<dc:publisher>Lolly</dc:publisher>\n<dc:source>https://lolly.tools/t/chart</dc:source>\n<lolly:DesignSystem>acme</lolly:DesignSystem>\n<lolly:DesignSystemLabel>Acme</lolly:DesignSystemLabel>\n<lolly:DesignVersion>2026-10</lolly:DesignVersion>\n</rdf:Description>\n</rdf:RDF>\n</metadata></svg>";

test('an address has to be a plain https address on a named host', () => {
  assert.equal(brandPageAddress(PAGE), PAGE);
  assert.equal(brandPageAddress('  https://acme.example  '), 'https://acme.example/');
  assert.equal(brandPageAddress('HTTPS://ACME.Example/Brand'), 'https://acme.example/Brand');
  assert.equal(brandPageAddress('https://acme.example:443/a/'), 'https://acme.example/a/');
  assert.equal(brandPageAddress('https://acme.example:8443/a/'), 'https://acme.example:8443/a/');
  for (const refused of [
    'http://acme.example/', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://acme.example/', '//acme.example/', 'acme.example',
    'https://user:pass@acme.example/', 'https://user@acme.example/', 'https://acme.example/?utm=1', 'https://acme.example/?', 'https://acme.example/#x', 'https://acme.example/#',
    'https://acme.example/a b', 'https://acme.example/a\nb', 'https://acme.example/‮cod.exe', 'https://acme.example\\@evil.example/',
    'https://localhost/', 'https://brand/', 'https://a.localhost/', 'https://127.0.0.1/', 'https://0x7f.0.0.1/', 'https://[::1]/', 'https://acme.example./',
    '', '   ', 'https://', `https://acme.example/${'a'.repeat(BRAND_PAGE_ADDRESS_MAX)}`,
  ]) assert.equal(brandPageAddress(refused), null, refused);
  for (const notText of [null, undefined, 1, true, {}, ['https://acme.example/']]) assert.equal(brandPageAddress(notText), null);
});

test('a look-alike host reads in ASCII, so it cannot pass for the real one', () => {
  assert.match(brandPageHost('https://аcme.example/')!, /^xn--/);
  assert.equal(brandPageHost(PAGE), 'acme.example');
  assert.equal(brandPageHost('javascript:alert(1)'), null);
});

test('the setting is off in a document that never opted in, and off returns the bytes it had', () => {
  assert.equal(readRecordedBrandPage(DOC), null);
  assert.equal(readRecordedBrandPage(null), null);
  assert.equal(JSON.stringify(withRecordedBrandPage(DOC, null)), JSON.stringify(DOC));
  const on = withRecordedBrandPage(DOC, PAGE);
  assert.equal(readRecordedBrandPage(on), PAGE);
  assert.equal(JSON.stringify(withRecordedBrandPage(on, null)), JSON.stringify(DOC), 'every container the setting added is pruned');
  assert.equal(readRecordedBrandPage(DOC), null, 'the input is never touched');
  const withOwn = { ...DOC, $extensions: { [TOKEN_EXT]: { designSystem: { id: 'acme', label: 'Acme' } } } };
  assert.deepEqual(withRecordedBrandPage(withRecordedBrandPage(withOwn, PAGE), null), withOwn, 'other keys ride along');
});

test('a bad address is refused on the way in, and a planted one reads as off', () => {
  for (const bad of ['http://acme.example/', 'javascript:alert(1)']) {
    assert.throws(() => withRecordedBrandPage(DOC, bad), /plain https address/);
    assert.equal(readRecordedBrandPage({ $extensions: { [TOKEN_EXT]: { exportRecord: { brandPage: bad } } } }), null);
  }
});

test('with no address the record and every writer stay exactly as they were', async () => {
  const record = designRecordOf(snapshot());
  assert.equal('brandPage' in record, false);
  const meta = await buildExportMeta(null, { id: 'chart', name: 'Chart', version: '1.0.0' }, { useDetails: false }, [], { snapshot: snapshot() });
  assert.equal('brandPage' in meta, false);
  assert.deepEqual(designRecordEnvironment(meta), { designSystem: 'acme', designSystemLabel: 'Acme', designVersion: '2026-10' });
  assert.deepEqual(designRecordKeywords(meta), ['Design system: Acme', 'Design version: 2026-10']);
  assert.deepEqual(designRecordXml(meta), ['<lolly:DesignSystem>acme</lolly:DesignSystem>', '<lolly:DesignSystemLabel>Acme</lolly:DesignSystemLabel>', '<lolly:DesignVersion>2026-10</lolly:DesignVersion>']);
  assert.equal(designRecordWords(record), 'Acme · Version 2026-10');
  assert.equal(buildExportXmp(meta), XMP_NO_ADDRESS);
  assert.equal(injectSvgMeta('<svg xmlns="http://www.w3.org/2000/svg"></svg>', meta), SVG_NO_ADDRESS);
});

test('with an address the record holds the page in every place the record lives', async () => {
  const given = snapshot({ brandPage: PAGE });
  const record = designRecordOf(given);
  assert.equal(record.brandPage, PAGE);
  assert.equal(designRecordWords(record), `Acme · Version 2026-10 · Brand page: ${PAGE}`);
  assert.equal(designRecordWords(record, { page: false }), 'Acme · Version 2026-10');
  const meta = await buildExportMeta(null, { id: 'chart', name: 'Chart', version: '1.0.0' }, { useDetails: false }, [], { snapshot: given });
  assert.equal(meta.brandPage, PAGE);
  assert.equal(meta.description, 'Made with https://lolly.tools : Chart', 'the description does not change');
  assert.equal(designRecordEnvironment(meta).brandPage, PAGE);
  assert.ok(designRecordKeywords(meta).includes(`Brand page: ${PAGE}`));
  assert.ok(buildExportXmp(meta)!.includes(`<lolly:BrandPage>${PAGE}</lolly:BrandPage>`));
  assert.ok(injectSvgMeta('<svg xmlns="http://www.w3.org/2000/svg"></svg>', meta).includes(`<lolly:BrandPage>${PAGE}</lolly:BrandPage>`));
  assert.equal(readDesignRecordXml(buildExportXmp(meta))?.brandPage, PAGE);
  assert.equal(readDesignRecord(designRecordEnvironment(meta))?.brandPage, PAGE);
  assert.equal(isEmptyDesignRecord({ brandPage: PAGE }), false);
  assert.match(designRecordText(record), /Recorded the brand page address: https:\/\/acme\.example\/brand\/acme\/\./);
  assert.match(designRecordText(record), /Pass madeWith: false to leave the record out\./);
  assert.doesNotMatch(designRecordText(designRecordOf(snapshot())), /brand page/i);
});

test('a hand-built or foreign value is refused at every writer and reader', async () => {
  for (const bad of ['http://acme.example/', 'javascript:alert(1)']) {
    assert.equal(designRecordOf(snapshot({ brandPage: bad })).brandPage, undefined);
    const meta = { software: 'Lolly', source: '', tool: '', author: '', contact: '', description: '', brandPage: bad } as ExportMeta;
    assert.equal(designRecordEnvironment(meta).brandPage, undefined);
    assert.deepEqual(designRecordKeywords(meta), []);
    assert.deepEqual(designRecordXml(meta), []);
    assert.equal(readDesignRecord({ brandPage: bad }), null);
    assert.equal(readDesignRecordXml(`<lolly:BrandPage>${bad}</lolly:BrandPage>`), null);
  }
});

// Through the runtime: the same switch the export panel's card, _madewith and --no-madewith set.
let seq = 0;
const tool = (): Tool => ({
  trustClass: 'catalog',
  manifest: { id: `page-record-${++seq}`, name: 'Chart', version: '1.0.0', engineVersion: '^1.0.0', status: 'official', render: { width: 100, height: 100, formats: ['png'] }, inputs: [{ id: 'title', type: 'text', default: 'Hello' }] },
  template: '<p>{{title}}</p>', styles: null, hooksSource: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
} as unknown as Tool);
const host = (renders: Rec[], given: TokensSnapshot): Host => ({
  version: '1', shell: 'test', profile: { get: async () => ({}) }, log: () => {},
  tokens: { get: async () => ({ size: 0 }), colors: async () => [], resolve: async () => null, themes: async () => [], snapshot: async () => given },
  export: { render: async (_n: unknown, _f: string, options: Rec) => { renders.push(options); return new Blob([new Uint8Array([1])], { type: 'image/png' }); } },
} as unknown as Host);
const canvas = (): Element => new JSDOM('<div id="c"><p>Hello</p></div>').window.document.getElementById('c')!;

test('off by default: a brand that never opted in exports no address', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders, snapshot()), {});
  await runtime.export(canvas(), 'png', {});
  assert.equal('brandPage' in (renders[0]!.meta as Rec), false);
  assert.equal('brandPage' in (await runtime.madeWithPreview())!.record, false);
});

test('recorded when set, shown before the export, and the card\'s opt-out removes the address', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders, snapshot({ brandPage: PAGE })), {});
  assert.equal((await runtime.madeWithPreview())!.record.brandPage, PAGE, 'the card can show the words before anything is written');
  await runtime.export(canvas(), 'png', {});
  assert.equal((renders[0]!.meta as ExportMeta).brandPage, PAGE);
  assert.equal(runtime.lastExportMeta?.brandPage, PAGE);
  runtime.setMadeWith(false);
  await runtime.export(canvas(), 'png', {});
  assert.equal('brandPage' in (renders[1]!.meta as Rec), false, 'the existing switch takes the address out with the rest');
  runtime.setMadeWith(true);
  await runtime.export(canvas(), 'png', { madeWith: false });
  assert.equal('brandPage' in (renders[2]!.meta as Rec), false, 'one export\'s own opt-out wins');
});

// On the way back.
const DATES = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 86_400_000) };
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48"><rect width="64" height="48" fill="#123456"/></svg>');
const stamped = async (environment: Rec, dates = DATES): Promise<Uint8Array> => embedC2pa(SVG, 'svg', {
  claimGenerator: 'Lolly', generatorInfo: { name: 'Lolly', version: 'test' }, title: 'Card', environment: { tool: 'qr-code', format: 'svg', ...environment }, dates, signer: await generateSigner(dates),
} as Parameters<typeof embedC2pa>[2]);

test('a credential that verifies gives the address, and the report words it as the signer\'s record', async () => {
  const report = await verifyC2pa(await stamped({ designSystem: 'acme', designSystemLabel: 'Acme', brandPage: PAGE }));
  assert.equal(report.state, 'valid');
  assert.equal(report.brandPage, PAGE);
  assert.equal(report.brandPageDropped, undefined);
  assert.equal(readDesignRecord(report.environment)?.brandPage, PAGE, 'a shell reading the record back still says it is recorded');
  const said = verdictBrandPage(report)!;
  assert.deepEqual(said.facts, [['Host', 'acme.example'], ['Address', PAGE]]);
  assert.match(said.note, /^Recorded data\. The signer recorded this address\. It does not show that the page belongs to anyone\.$/);
});

test('no address on record reads as no record at all', async () => {
  const report = await verifyC2pa(await stamped({ designSystem: 'acme' }));
  assert.equal(report.brandPage, undefined);
  assert.equal(report.brandPageDropped, undefined);
  assert.equal(verdictBrandPage(report), null);
});

for (const bad of ['http://acme.example/', 'javascript:alert(1)']) {
  test(`${bad.split(':')[0]}: from a signed record is dropped, and the report says so`, async () => {
    const report = await verifyC2pa(await stamped({ brandPage: bad }));
    assert.equal(report.state, 'valid');
    assert.equal(report.brandPage, undefined);
    assert.equal(report.brandPageDropped, 'address');
    assert.equal(report.environment?.brandPage, undefined, 'no reader can reach the value');
    assert.deepEqual(verdictBrandPage(report)!.facts, []);
    assert.match(verdictBrandPage(report)!.note, /not a plain https address/);
    assert.doesNotMatch(JSON.stringify(report), /javascript:|http:\/\/acme/);
  });
}

test('a tampered record is dropped with the rest of the credential, and the report says so', async () => {
  const file = await stamped({ brandPage: PAGE });
  assert.equal((await verifyC2pa(file)).brandPage, PAGE);
  const store = extractC2paStore(file)!.store;
  const at = Buffer.from(store).indexOf('acme.example');
  assert.ok(at > 0, 'the address is in the manifest');
  const changed = store.slice();
  changed.set(new TextEncoder().encode('evil.example'), at);
  const svg = new TextDecoder().decode(file);
  const encoded = Buffer.from(store).toString('base64');
  assert.ok(svg.includes(encoded), 'an SVG holds its manifest as base64');
  const report = await verifyC2pa(new TextEncoder().encode(svg.replace(encoded, Buffer.from(changed).toString('base64'))));
  assert.equal(report.state, 'invalid');
  assert.equal(report.brandPage, undefined);
  assert.equal(report.brandPageDropped, 'credential');
  assert.equal(report.environment?.brandPage, undefined);
  assert.doesNotMatch(JSON.stringify(report.environment ?? {}), /evil\.example/);
  assert.match(verdictBrandPage(report)!.note, /credential did not verify/);
});

test('a changed file with an intact record is dropped too', async () => {
  const file = await stamped({ brandPage: PAGE });
  const changed = new TextEncoder().encode(new TextDecoder().decode(file).replace('#123456', '#654321'));
  const report = await verifyC2pa(changed);
  assert.equal(report.state, 'invalid');
  assert.equal(report.brandPage, undefined);
  assert.equal(report.brandPageDropped, 'credential');
});

test('editable metadata lists the address as a field, and never as the signer\'s record', async () => {
  const meta = await buildExportMeta(null, { id: 'chart', name: 'Chart', version: '1.0.0' }, { useDetails: false }, [], { snapshot: snapshot({ brandPage: PAGE }) });
  const file = extractFileMetadata(new TextEncoder().encode(injectSvgMeta(new TextDecoder().decode(SVG), meta)));
  assert.equal(file.fields.find((f) => f.label === 'Brand page')?.value, PAGE);
  assert.equal(file.fields.find((f) => f.label === 'Brand page')?.source, 'XMP lolly:BrandPage');
  const planted = extractFileMetadata(new TextEncoder().encode(new TextDecoder().decode(SVG).replace('</svg>', '<metadata><lolly:BrandPage>javascript:alert(1)</lolly:BrandPage></metadata></svg>')));
  assert.equal(planted.fields.some((f) => f.label === 'Brand page'), false);
});

test('the setting stays out of the published folder, so on and off give identical files', async () => {
  const folder = async (tokens: unknown) => (await buildBrandPage({ tokens, catalog: null, name: 'Acme', id: 'acme', origin: PAGE })).files.map((f) => [f.path, Buffer.from(f.bytes).toString('base64')]);
  const off = await folder(DOC);
  const on = await folder(withRecordedBrandPage(DOC, PAGE));
  assert.deepEqual(on, off);
  assert.equal(on.some(([, bytes]) => Buffer.from(bytes!, 'base64').toString('latin1').includes('exportRecord')), false);
});
