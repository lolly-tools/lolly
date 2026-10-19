// SPDX-License-Identifier: MPL-2.0
/**
 * The Convert workbench's "SVG fitted to its artwork" target through the same
 * file-operation adapter the views use: offered for SVG and SVGZ, receipts keep
 * metadata as preserved, and unmeasurable artwork fails with its reason.
 *
 * Run with: node --import ./tests/css-stub.mjs --test "shells/web/src/lib/convert-svg-fit.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzip } from '@lolly/engine';
import { targetsFor } from './convert-codecs.ts';
import { runWebFileOperation } from './file-operation-adapter.ts';
import { conversionFindings } from './file-conversion.ts';

const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><metadata>kept</metadata><circle cx="100" cy="100" r="20" fill="#0c322c"/></svg>';
const request = { version: 1, operation: 'convert', target: 'svg-fit', options: {} } as const;

test('SVG and SVGZ sources offer the fitted copy; rasters do not', () => {
  assert.ok(targetsFor('svg').some(target => target.id === 'svg-fit' && target.ext === 'svg'));
  assert.ok(targetsFor('svgz').some(target => target.id === 'svg-fit'));
  assert.ok(!targetsFor('raster').some(target => target.id === 'svg-fit'));
  const findings = conversionFindings('svg', 'svg-fit');
  assert.deepEqual(findings.map(f => f.code), ['svg-bounds-only']);
  assert.match(findings[0]!.message, /raster image inside an SVG stays a raster image/);
});

test('a fitted copy changes only the root tag and records preserved metadata', async () => {
  const result = await runWebFileOperation(new File([LOGO], 'logo.svg', { type: 'image/svg+xml' }), request);
  assert.equal(result.report.state, 'succeeded', JSON.stringify(result.report.findings));
  const output = result.output!;
  const text = await output.text();
  assert.equal(text, '<svg viewBox="80 80 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg"><metadata>kept</metadata><circle cx="100" cy="100" r="20" fill="#0c322c"/></svg>');
  assert.equal(output.name, 'logo.svg');
  assert.equal(result.report.metadata, 'preserved');
  assert.deepEqual(result.report.findings.map(f => f.code), ['svg-bounds-only']);
});

test('an SVGZ source is unpacked and fitted', async () => {
  const result = await runWebFileOperation(new File([gzip(new TextEncoder().encode(LOGO)) as BlobPart], 'logo.svgz', { type: 'image/svg+xml' }), request);
  assert.match(await result.output!.text(), /^<svg viewBox="80 80 40 40"/);
});

test('artwork with text fails with the reason and produces no output', async () => {
  const source = '<svg viewBox="0 0 100 100"><text x="10" y="50">Hi</text></svg>';
  const result = await runWebFileOperation(new File([source], 'label.svg', { type: 'image/svg+xml' }), request);
  assert.equal(result.report.state, 'failed');
  assert.equal(result.output, undefined);
  assert.match(result.report.findings.at(-1)!.message, /contains text/);
});
