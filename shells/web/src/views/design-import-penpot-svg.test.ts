// SPDX-License-Identifier: MPL-2.0
/**
 * Penpot SVG metadata reads (design-import-penpot-svg.ts) against markup shaped like
 * the page SVGs of Penpot's legacy zip export: a penpot:shape record first in each
 * shape group, with the layout on a nested penpot:layout element, and component
 * masters under <defs><symbol> in components.svg. Parsed by jsdom's XML DOMParser, so
 * namespaces behave as in a browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { isPenpotMetadata, layoutFindingsNote, penpotAttr, readPenpotSvgLayouts } from './design-import-penpot-svg.ts';
import { penpotSvgLayoutFindings } from '../../../../engine/src/penpot-layout.ts';

const { window } = new JSDOM('');
const parse = (svg: string): Element => {
  const doc = new window.DOMParser().parseFromString(svg, 'image/svg+xml');
  assert.equal(doc.getElementsByTagName('parsererror').length, 0, 'fixture is well-formed XML');
  return doc.documentElement;
};
const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:penpot="https://penpot.app/xmlns"';

const current = parse(`<svg ${NS} viewBox="0 0 600 300">
  <g id="shape-aaaaaaaa-0000-4000-8000-000000000001">
    <penpot:shape penpot:name="Toolbar" penpot:type="frame">
      <penpot:layout penpot:layout="flex" penpot:layout-flex-dir="row"/>
    </penpot:shape>
    <rect width="300" height="80"/>
    <g id="shape-aaaaaaaa-0000-4000-8000-000000000002">
      <penpot:shape penpot:name="Button" penpot:type="rect">
        <penpot:layout-item penpot:layout-item-h-sizing="fix"/>
      </penpot:shape>
      <rect x="12" y="20" width="80" height="40"/>
    </g>
  </g>
  <g id="shape-aaaaaaaa-0000-4000-8000-000000000003">
    <penpot:shape penpot:name="Gallery" penpot:type="frame">
      <penpot:layout penpot:layout="grid" penpot:layout-grid-dir="row">
        <penpot:grid-columns><penpot:grid-track penpot:index="0" penpot:type="flex" penpot:value="1"/></penpot:grid-columns>
      </penpot:layout>
    </penpot:shape>
    <rect x="320" width="260" height="200"/>
  </g>
</svg>`);

test('one declaration per shape record, with the group shape id and the record name', () => {
  assert.deepEqual(readPenpotSvgLayouts(current), [
    { id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Toolbar', layout: 'flex' },
    { id: 'aaaaaaaa-0000-4000-8000-000000000003', name: 'Gallery', layout: 'grid' },
  ]);
  const findings = penpotSvgLayoutFindings(readPenpotSvgLayouts(current));
  assert.deepEqual(findings.map(finding => finding.id), ['aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003']);
  assert.match(findings[0]!.message, /“Toolbar” uses a flex layout/);
  assert.match(findings[1]!.message, /“Gallery” uses a grid layout/);
});

test('a layout attribute on the record itself is also accepted', () => {
  // Penpot writes the nested element; this form is read as a tolerance.
  const onRecord = parse(`<svg ${NS}><g id="shape-bbbbbbbb-0000-4000-8000-000000000001">
    <penpot:shape penpot:name="Row" penpot:type="frame" penpot:layout="flex" penpot:layout-flex-dir="column"/>
    <rect width="10" height="10"/></g></svg>`);
  assert.deepEqual(readPenpotSvgLayouts(onRecord), [{ id: 'bbbbbbbb-0000-4000-8000-000000000001', name: 'Row', layout: 'flex' }]);
});

test('component masters and other containers that are never drawn report nothing', () => {
  // components.svg (and deleted-components.svg) in a legacy zip: every master sits in
  // <defs><symbol> with full metadata, and the SVG walk never draws a master.
  const components = parse(`<svg ${NS} version="1.1" style="display:none" fill="none"><defs>
    <symbol id="dddddddd-0000-4000-8000-000000000001" viewBox="0 0 120 40" penpot:path="Buttons">
      <title>Button</title>
      <g id="shape-dddddddd-0000-4000-8000-000000000002">
        <penpot:shape penpot:name="Button" penpot:type="frame"><penpot:layout penpot:layout="flex"/></penpot:shape>
        <rect width="120" height="40"/>
      </g>
    </symbol></defs></svg>`);
  assert.deepEqual(readPenpotSvgLayouts(components), []);
  const mixed = parse(`<svg ${NS}>
    <mask id="m"><g id="shape-eeeeeeee-0000-4000-8000-000000000001">
      <penpot:shape penpot:name="Masked" penpot:type="frame"><penpot:layout penpot:layout="grid"/></penpot:shape></g></mask>
    <clipPath id="c"><g id="shape-eeeeeeee-0000-4000-8000-000000000002">
      <penpot:shape penpot:name="Clipped" penpot:type="frame"><penpot:layout penpot:layout="flex"/></penpot:shape></g></clipPath>
    <g id="shape-eeeeeeee-0000-4000-8000-000000000003">
      <penpot:shape penpot:name="Drawn" penpot:type="frame"><penpot:layout penpot:layout="flex"/></penpot:shape>
      <rect width="10" height="10"/></g></svg>`);
  assert.deepEqual(readPenpotSvgLayouts(mixed), [{ id: 'eeeeeeee-0000-4000-8000-000000000003', name: 'Drawn', layout: 'flex' }]);
});

test('an SVG without layout metadata yields nothing, whatever its ids, text or arrangement say', () => {
  const plain = parse(`<svg xmlns="http://www.w3.org/2000/svg"><g id="layout-grid" class="flex">
    <rect width="10" height="10"/><rect x="20" width="10" height="10"/><text>grid layout</text></g></svg>`);
  assert.deepEqual(readPenpotSvgLayouts(plain), []);
  const noLayout = parse(`<svg ${NS}><g id="shape-cccccccc-0000-4000-8000-000000000001">
    <penpot:shape penpot:name="Card" penpot:type="frame" penpot:layout=""/><rect width="10" height="10"/></g></svg>`);
  assert.deepEqual(readPenpotSvgLayouts(noLayout), []);
  assert.deepEqual(penpotSvgLayoutFindings(readPenpotSvgLayouts(plain)), []);
});

test('the element budget bounds the read', () => {
  // Document order: the first group, its record, then the record's penpot:layout.
  assert.deepEqual(readPenpotSvgLayouts(current, 2), []);
  assert.equal(readPenpotSvgLayouts(current, 3).length, 1);
});

test('metadata elements are recognised and never mistaken for artwork', () => {
  const record = current.getElementsByTagName('penpot:shape')[0]!;
  const layout = current.getElementsByTagName('penpot:layout')[0]!;
  const rect = current.getElementsByTagName('rect')[0]!;
  assert.equal(isPenpotMetadata(record), true);
  assert.equal(isPenpotMetadata(layout), true);
  assert.equal(isPenpotMetadata(rect), false);
  assert.equal(isPenpotMetadata(current), false);
});

test('penpotAttr reads the qualified name and the namespaced form Penpot declares', () => {
  const record = current.getElementsByTagName('penpot:shape')[0]!;
  assert.equal(penpotAttr(record, 'name'), 'Toolbar');
  assert.equal(penpotAttr(record, 'missing'), null);
  const bare = current.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
  bare.setAttributeNS('https://penpot.app/xmlns', 'name', 'Namespaced');
  assert.equal(penpotAttr(bare, 'name'), 'Namespaced');
});

test('the note that stays on screen counts the layouts and is empty without them', () => {
  assert.equal(layoutFindingsNote(undefined), '');
  assert.equal(layoutFindingsNote([]), '');
  assert.equal(layoutFindingsNote(penpotSvgLayoutFindings(readPenpotSvgLayouts(current)).slice(0, 1)),
    '1 Penpot layout came in as fixed positions. Import the .penpot export to keep it editable.');
  assert.equal(layoutFindingsNote(penpotSvgLayoutFindings(readPenpotSvgLayouts(current))),
    '2 Penpot layouts came in as fixed positions. Import the .penpot export to keep them editable.');
});
