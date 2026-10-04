// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI and MCP show the same English the app shows (plan 291, W1).
 *
 * The web app builds its mounted-audit and brand-finding text through `tRaw` in
 * `shells/web/src/views/design-audit-copy.ts` and `brand-check-rows.ts`; the engine
 * keeps English twins (`mountedFindingMessage`, `brandFindingMessage` in
 * `engine/src/design-check.ts`) for surfaces that do not translate. With no locale
 * loaded the web returns its English source strings, so the two must agree word
 * for word for every finding id and kind. A changed web string fails here until
 * its engine twin follows.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/check-messages.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mountedDesignFindingMessage } from '../shells/web/src/views/design-audit-copy.ts';
import type { MountedDesignFinding } from '../shells/web/src/views/design-mounted-audit.ts';
import { brandCheckRows } from '../shells/web/src/views/brand-check-rows.ts';
import { checkBrandDesign } from '../engine/src/brand-check.ts';
import { brandFindingMessage, mountedFindingMessage } from '../engine/src/design-check.ts';

test('mounted-audit findings read the same in the engine as in the app', () => {
  const findings: MountedDesignFinding[] = [
    { id: 'design.text.overflow', severity: 'warn', path: '/boxes/0/text', evidence: { name: 'Title' }, message: '', layerId: 'a' },
    { id: 'design.text.contrast-review', severity: 'info', path: '/boxes/0/fg', evidence: { name: 'Title', reason: 'complex-background' }, message: '', layerId: 'a' },
    { id: 'design.text.contrast-review', severity: 'info', path: '/boxes/0/fg', evidence: { name: 'Title', reason: 'unresolved-colours' }, message: '', layerId: 'a' },
    { id: 'design.text.contrast-low', severity: 'warn', path: '/boxes/0/fg', evidence: { name: 'Caption', ratio: '2.1', minimum: '4.5' }, message: '', layerId: 'a' },
    { id: 'design.font.unembeddable', severity: 'warn', path: '/boxes/0/font', evidence: { name: 'Caption', family: 'Example Sans' }, message: '', layerId: 'a' },
  ];
  for (const finding of findings) {
    const app = mountedDesignFindingMessage(finding);
    assert.ok(app && !app.includes('{'), `${finding.id}: the app text is interpolated`);
    assert.equal(mountedFindingMessage(finding), app, `${finding.id} (${finding.evidence.reason ?? ''})`);
  }
});

test('brand findings read the same in the engine as in the app, for every kind and status', async () => {
  const doc = {
    color: { red: { $type: 'color', $value: '#CC3322' }, ink: { $type: 'color', $value: '#112233' } },
    font: { brand: { $type: 'fontFamily', $value: 'Example Sans' } },
    asset: { logo: { $type: 'string', $value: 'example/logo/primary' } },
  };
  const boxes = [
    // colour to review (fill), font to review, an asset outside the pack
    { id: 'a', name: 'Card', bg: '#ca3020', text: 'Hi', font: 'Other Sans', fg: '{color.ink}', image: 'example/other' },
    // a reference that does not resolve, and a stroke to review
    { id: 'b', bg: '{color.missing}', stroke: '#123456' },
    // a translucent colour cannot be compared: unknown
    { id: 'c', text: 'Faded', fg: 'rgba(0,0,0,0.5)' },
    // a catalog icon whose theme the catalog does not declare: an asset reference, not a colour
    { id: 'd', name: 'Icon', image: 'example/icons/brain?theme=lava' },
  ];
  const catalog = { assets: ['example/icons/brain'], iconThemes: ['ember'] };
  const findings = checkBrandDesign(boxes, doc, catalog).findings;
  const seen = new Set(findings.map((f) => `${f.kind}:${f.status}:${f.field}`));
  for (const kind of ['color:review:bg', 'color:review:stroke', 'font:review:font', 'asset:review:image', 'reference:unknown:bg', 'reference:unknown:image', 'color:unknown:fg'])
    assert.ok(seen.has(kind), `the sample covers ${kind}`);
  const rows = await brandCheckRows({
    boxes: () => boxes,
    snapshot: async () => ({ document: doc, system: null, version: 'latest', selection: {} }),
    write: () => undefined,
    catalog: async () => catalog,
  });
  const byId = new Map(rows.map((row) => [row.id, row.text]));
  for (const finding of findings) assert.equal(brandFindingMessage(finding), byId.get(finding.id), finding.id);
  // The document-level coverage finding has no layer and one fixed sentence.
  const coverage = checkBrandDesign('not boxes', doc).findings.find((f) => f.kind === 'coverage')!;
  const coverageRows = await brandCheckRows({
    boxes: () => 'not boxes',
    snapshot: async () => ({ document: doc, system: null, version: 'latest', selection: {} }),
    write: () => undefined,
  });
  assert.equal(brandFindingMessage(coverage), coverageRows.find((row) => row.id === coverage.id)?.text);
});
