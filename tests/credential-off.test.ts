// SPDX-License-Identifier: MPL-2.0
/**
 * An explicit "no Content Credentials" holds on an SVG. A catalog logo inlined into the page
 * brings its own `<c2pa:manifest>`, and a verifier reads it as the file's: `--c2pa=off` read
 * back as `invalid`. Off now takes every manifest out, and only those. An export nobody
 * configured keeps its bytes.
 *
 * The credentials here are real ones from the engine's own embedder. credential-off-cli.test.ts
 * runs the CLI on a fixture tool, and credential-off-routes.browser.test.ts holds the same facts
 * against a real web shell.
 *
 * Run: node --test tests/credential-off.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { embedC2pa, gunzip, gzip, verifyC2pa } from '../engine/src/index.ts';
import { stripSvgC2pa, withoutSvgCredentials } from '../packages/node-shell/src/lolly-file.ts';
import { exportUrl } from '../packages/node-shell/src/webshell-render.ts';
import { dropInlinedCredentials, stripSvgManifests } from '../shells/web/src/bridge/export-svg-credentials.ts';

const encoder = new TextEncoder();
const STAMP = { title: 'Logo', claimGenerator: 'LollyTest/1.0', dates: { created: '2026-01-01T00:00:00Z' } } as never;

/** A real credentialed logo, placed in a page the way the walker inlines one. */
async function logoManifestElement(): Promise<string> {
  const logo = encoder.encode('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>');
  const signed = new TextDecoder().decode(await embedC2pa(logo, 'svg', STAMP));
  const found = /<c2pa:manifest[^>]*>[^<]*<\/c2pa:manifest>/.exec(signed);
  assert.ok(found, 'the embedder wrote an element');
  return found[0];
}
const LOGO_MANIFEST = await logoManifestElement();
const PAGE = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:c2pa="http://c2pa.org/manifest" width="100" height="60">'
  + '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">Kept</dc:title></rdf:RDF></metadata>'
  + `<svg x="1" y="1" width="20" height="20"><metadata id="logo-metadata">${LOGO_MANIFEST}</metadata><rect width="4" height="4"/></svg>`
  + '<text>Ana Kovač</text></svg>';

test('a page with a credentialed logo reads invalid, and off leaves none and nothing else changed', async () => {
  const page = encoder.encode(PAGE);
  assert.equal((await verifyC2pa(page)).state, 'invalid', 'this is the reader\'s report');
  const clean = withoutSvgCredentials(page, 'svg');
  assert.equal((await verifyC2pa(clean)).state, 'none');
  const text = new TextDecoder().decode(clean);
  assert.equal(text.includes('c2pa'), false, text);
  assert.equal(text, PAGE.replace(LOGO_MANIFEST, '').replace(' xmlns:c2pa="http://c2pa.org/manifest"', ''), 'byte for byte, around the credential');
  for (const kept of ['<dc:title', '<text>Ana Kovač</text>', '<metadata id="logo-metadata">', '<rect width="4"']) assert.ok(text.includes(kept), kept);
  assert.deepEqual(withoutSvgCredentials(clean, 'svg'), clean, 'running twice changes nothing');
});

test('a gzip wrapper is read through, because a verifier reads through it too', async () => {
  const zipped = gzip(encoder.encode(PAGE));
  assert.equal((await verifyC2pa(zipped)).state, 'invalid');
  const clean = withoutSvgCredentials(zipped, 'svgz');
  assert.equal((await verifyC2pa(clean)).state, 'none');
  assert.equal(new TextDecoder().decode(gunzip(clean)).includes('c2pa'), false);
  const none = gzip(encoder.encode('<svg xmlns="http://www.w3.org/2000/svg"/>'));
  assert.equal(withoutSvgCredentials(none, 'svgz'), none, 'nothing to take: the same bytes');
});

test('bytes the helper has no reason to touch come back as the same array', () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
  for (const format of ['png', 'pdf', 'zip', 'html', 'mp4']) assert.equal(withoutSvgCredentials(png, format), png, format);
  const plain = encoder.encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  assert.equal(withoutSvgCredentials(plain, 'svg'), plain);
});

test('a byte outside UTF-8 around the element survives', () => {
  const bytes = Uint8Array.from([...Buffer.from('<svg><!--', 'latin1'), 0xe9, 0x80, ...Buffer.from(`-->${LOGO_MANIFEST}</svg>`, 'latin1')]);
  const clean = withoutSvgCredentials(bytes, 'svg');
  assert.deepEqual([...clean.slice(9, 11)], [0xe9, 0x80]);
  assert.equal(clean.length, bytes.length - LOGO_MANIFEST.length);
});

test('the web shell and the Node shells take out the same thing', () => {
  const documents = [
    PAGE,
    `<svg><metadata>${LOGO_MANIFEST}</metadata><svg><metadata>${LOGO_MANIFEST}</metadata></svg></svg>`,
    '<svg xmlns:c2pa="x"><c2pa:manifest id="a">AAAA</c2pa:manifest></svg>',
    '<svg><title>c2pa:manifest is words here</title></svg>',
  ];
  for (const doc of documents) assert.equal(stripSvgManifests(doc), stripSvgC2pa(doc));
});

test('the web bridge touches a file only on an explicit opt-out', async () => {
  const svg = new Blob([PAGE], { type: 'image/svg+xml' });
  assert.equal(await dropInlinedCredentials(svg, 'svg', {}), svg, 'no setting: the same Blob, so the same bytes');
  assert.equal(await dropInlinedCredentials(svg, 'svg', { c2pa: false }), svg, 'an internal preview says c2pa:false and is not an opt-out');
  assert.equal(await dropInlinedCredentials(svg, 'svg', { dropInlinedC2pa: true, c2pa: true }), svg, 'a credential was asked for');
  const png = new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' });
  assert.equal(await dropInlinedCredentials(png, 'png', { dropInlinedC2pa: true }), png);
  const clean = await dropInlinedCredentials(svg, 'svg', { dropInlinedC2pa: true });
  assert.equal(clean.type, 'image/svg+xml');
  assert.equal((await clean.text()).includes('c2pa'), false);
  const nothing = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>']);
  assert.equal(await dropInlinedCredentials(nothing, 'svg', { dropInlinedC2pa: true }), nothing);
  const zipped = new Blob([gzip(encoder.encode(PAGE)) as BlobPart]);
  const unzipped = await dropInlinedCredentials(zipped, 'svgz', { dropInlinedC2pa: true });
  assert.equal(new TextDecoder().decode(gunzip(new Uint8Array(await unzipped.arrayBuffer()))).includes('c2pa'), false);
});

test('the address tells the web shell when `off` is not the caller\'s own', () => {
  const params = (dims: Parameters<typeof exportUrl>[4]): URLSearchParams => {
    const url = exportUrl('http://shell.test', 'certificate', 'firstname=Sam&_keepinlinedc2pa=1', 'svg', dims);
    return new URLSearchParams(url.slice(url.indexOf('?') + 1));
  };
  assert.equal(params({ c2pa: false }).get('c2pa'), 'off');
  assert.equal(params({ c2pa: false }).has('_keepinlinedc2pa'), false, 'the caller opted out: a link cannot say otherwise');
  assert.equal(params({ c2pa: false, keepInlinedC2pa: true }).get('_keepinlinedc2pa'), '1');
  assert.equal(params({ c2pa: true, keepInlinedC2pa: true }).has('_keepinlinedc2pa'), false);
  assert.equal(params({ keepInlinedC2pa: true }).has('_keepinlinedc2pa'), false);
});
