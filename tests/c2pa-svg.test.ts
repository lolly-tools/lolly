// SPDX-License-Identifier: MPL-2.0
/**
 * Where an SVG export's Content Credential goes when the page inlines artwork that
 * carries its own, such as a catalog logo: in a `<metadata>` child of the root `<svg>`,
 * the one place the C2PA SVG binding and c2patool read. The inlined artwork keeps its own
 * manifest as part of its own markup, and the export's hard binding covers those bytes
 * like any other.
 *
 * Before this, the export's manifest overwrote the logo's, inside the logo, and c2patool
 * reported "No claim found" for the file.
 *
 * Run: node --test tests/c2pa-svg.test.ts
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { embedC2pa, extractC2paStore, verifyC2pa } from '../engine/src/index.ts';
import { locateSvgCredential } from '../engine/src/c2pa-svg.ts';

const te = new TextEncoder();
const td = new TextDecoder();
const DATES = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 30 * 86_400_000) };
const hasC2patool = spawnSync('c2patool', ['--version'], { encoding: 'utf8' }).status === 0;

/** A catalog logo, signed as the catalog signs one. */
async function signedLogo(): Promise<string> {
  const logo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#30ba78"/></svg>';
  return td.decode(await embedC2pa(te.encode(logo), 'svg', { title: 'Logo', claimGenerator: 'Lolly catalog', environment: { surface: 'catalog' }, dates: DATES }));
}
const manifestOf = (svg: string): string => /<c2pa:manifest[^>]*>[^<]*<\/c2pa:manifest>/.exec(svg)![0];

/** A page as the walker writes one: its own metadata first, then the inlined logo with its credential. */
async function page(): Promise<{ svg: string; logoManifest: string }> {
  const logo = await signedLogo();
  const logoManifest = manifestOf(logo);
  const inner = logo.replace(/^<svg /, '<svg x="10" y="10" width="20" height="20" ');
  const svg = '<?xml version="1.0" standalone="no"?>\n'
    + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><title>Certificate</title>'
    + '<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about=""/></rdf:RDF></metadata>'
    + `<g>${inner}</g><text>Ana</text></svg>`;
  return { svg, logoManifest };
}

function c2patool(bytes: Uint8Array): string {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-svg-root-'));
  try {
    const file = join(dir, 'out.svg');
    writeFileSync(file, bytes);
    const run = spawnSync('c2patool', [file], { encoding: 'utf8' });
    return `${run.stdout}${run.stderr}`;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('the export\'s credential goes in the root\'s metadata, and the inlined logo keeps its own', async () => {
  const { svg, logoManifest } = await page();
  const stamped = await embedC2pa(te.encode(svg), 'svg', { title: 'Certificate', claimGenerator: 'Lolly lolly.tools', environment: { surface: 'test' }, dates: DATES });
  const text = td.decode(stamped);
  const site = locateSvgCredential(text)!;
  assert.ok(site.manifest, 'a manifest in a direct metadata child of the root');
  assert.ok(site.manifest.start < text.indexOf('<g>'), 'ahead of the inlined artwork');
  assert.equal(text.match(/<c2pa:manifest/g)?.length, 2, 'the export\'s and the logo\'s');
  assert.ok(text.includes(logoManifest), 'the logo\'s manifest is byte for byte where the logo had it');
  assert.ok(text.indexOf(logoManifest) > text.indexOf('<g>'));
  // The root claim validates, and it is the export's, not the logo's.
  const report = await verifyC2pa(stamped);
  assert.equal(report.state, 'valid');
  assert.equal((report.environment as Record<string, unknown>).surface, 'test');
  // Nothing went in beyond the export's manifest element: take it out and the page is as it was, but for the namespace.
  const removed = text.slice(0, site.manifest.start - '<c2pa:manifest>'.length) + text.slice(site.manifest.end + '</c2pa:manifest>'.length);
  assert.equal(removed.replace(' xmlns:c2pa="http://c2pa.org/manifest"', ''), svg);
  if (hasC2patool) {
    const said = c2patool(stamped);
    assert.doesNotMatch(said, /No claim found/, said);
    assert.match(said, /"active_manifest"/);
    assert.match(said, /"surface": "test"/, 'c2patool reads the export\'s claim');
  }
});

test('stamping again replaces the root credential and leaves the logo\'s alone', async () => {
  const { svg, logoManifest } = await page();
  const once = await embedC2pa(te.encode(svg), 'svg', { title: 'Certificate', environment: { surface: 'first' }, dates: DATES });
  const twice = await embedC2pa(once, 'svg', { title: 'Certificate', environment: { surface: 'second' }, dates: DATES });
  const text = td.decode(twice);
  assert.equal(text.match(/<c2pa:manifest/g)?.length, 2);
  assert.ok(text.includes(logoManifest));
  const report = await verifyC2pa(twice);
  assert.equal(report.state, 'valid');
  assert.equal((report.environment as Record<string, unknown>).surface, 'second');
});

test('the reader takes the root\'s credential over one in nested artwork, whichever comes first', async () => {
  const logo = await signedLogo();
  const own = td.decode(await embedC2pa(te.encode('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'), 'svg', { title: 'Page', dates: DATES }));
  const rootManifest = manifestOf(own);
  // The logo's manifest comes first in the file, the root's metadata after the artwork.
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:c2pa="http://c2pa.org/manifest"><g>${logo}</g><metadata>${rootManifest}</metadata></svg>`;
  assert.ok(doc.indexOf(manifestOf(logo)) < doc.indexOf(rootManifest));
  const found = extractC2paStore(te.encode(doc));
  assert.ok(found);
  assert.equal(Buffer.from(found.store).toString('base64'), /<c2pa:manifest>([^<]*)</.exec(rootManifest)![1]);
});

test('a file whose only credential sits in nested artwork reads as it did before', async () => {
  // Files exported before this change hold the export's credential inside the logo. They keep
  // reading as they did, so a credential someone already has does not change its answer.
  const logo = await signedLogo();
  const legacy = `<svg xmlns="http://www.w3.org/2000/svg"><g>${logo}</g></svg>`;
  assert.ok(extractC2paStore(te.encode(legacy)), 'still found');
});

test('the scanner follows the document: comments, CDATA, quoted ">" and nested svg roots', () => {
  const cases: Array<[string, string | null, boolean]> = [
    ['<svg><metadata/><g><metadata>x</metadata></g></svg>', null, false],
    ['<svg a=">"><!-- <metadata> --><svg><metadata><c2pa:manifest>NESTED</c2pa:manifest></metadata></svg><metadata><c2pa:manifest>ROOT</c2pa:manifest></metadata></svg>', 'ROOT', true],
    ['<svg><metadata><rdf/><c2pa:manifest>R</c2pa:manifest></metadata></svg>', 'R', true],
    ['<svg><![CDATA[<metadata>]]><metadata id="m"></metadata></svg>', null, true],
  ];
  for (const [doc, manifest, hasMetadata] of cases) {
    const site = locateSvgCredential(doc)!;
    assert.equal(site.manifest ? doc.slice(site.manifest.start, site.manifest.end) : null, manifest, doc);
    assert.equal(site.metadataOpenEnd !== null, hasMetadata, doc);
  }
  assert.equal(locateSvgCredential('<html></html>'), null);
});
