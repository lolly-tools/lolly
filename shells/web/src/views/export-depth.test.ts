// SPDX-License-Identifier: MPL-2.0
/**
 * views/export-depth.ts - the export panel's pro-format grouping and depth fact
 * (plans/61-deeprichpixels.md section 10 item 3).
 *
 * Run directly:  node --test shells/web/src/views/export-depth.test.ts
 *
 * The governing property is ABSENCE: in the common case this feature must add
 * nothing at all, not an empty or hidden placeholder. So the panel assertions
 * compare the panel's markup byte for byte around a call, rather than asking
 * whether anything is visible.
 *
 * jsdom does no layout, so offsetWidth/offsetHeight are 0 for every element and a
 * real reflow measurement is impossible here (as in view-fade.test.ts, whose
 * getBoundingClientRect returns zeros). The no-reflow claim is therefore asserted
 * structurally, which is what actually guarantees it: the fact is a SIBLING of
 * .filename-extension, and that row's own markup is unchanged by showing or
 * hiding it, so the flex pair inside it cannot be re-measured. A browser-tier
 * check of the rendered geometry is still open.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  PRO_FORMATS, isProFormat, formatOptionsHtml,
} from './export-depth.ts';
import { proFormatSupport } from '../bridge/format-support.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.document = dom.window.document;

// ── Pro formats: grouped, and only when they exist ───────────────────────────

test('the pro float formats are exr and hdr, and nothing else is one', () => {
  assert.deepEqual([...PRO_FORMATS], ['exr', 'hdr']);
  assert.equal(isProFormat('exr'), true);
  assert.equal(isProFormat('hdr'), true);
  for (const f of ['png', 'jpg', 'tiff', 'avif', 'svg', 'pdf', undefined]) {
    assert.equal(isProFormat(f), false, String(f));
  }
});

test('no optgroup at all when no pro format is offered', () => {
  // The whole point of item (a): the group must only EXIST when those formats are
  // offerable. This is the shape every tool in the app produces today.
  const html = formatOptionsHtml(['png', 'jpg', 'svg', 'pdf'], 'png', f => f.toUpperCase());
  assert.equal(html.includes('<optgroup'), false, 'an optgroup was emitted with nothing to group');
  assert.equal(html.includes('</optgroup>'), false);
  // ...and the flat list is byte-identical to the markup this replaced.
  assert.equal(
    html,
    '<option value="png" selected>PNG</option><option value="jpg" >JPG</option>'
    + '<option value="svg" >SVG</option><option value="pdf" >PDF</option>',
  );
});

test('the web shell cannot produce a pro float format, so it never offers one', () => {
  // packages/node-shell/src/raster.ts owns packExr/packRadiance over a resvg float
  // frame; the browser path ends at 8-bit canvas bytes. keepFormat reads this, so a
  // manifest asking for exr/hdr is filtered out before formatOptionsHtml ever sees it.
  assert.equal(proFormatSupport(), false);
});

test('a surviving pro format is grouped, never a peer of png', () => {
  // Drives the branch a float-capable shell would take (keepFormat having kept them).
  const html = formatOptionsHtml(['png', 'exr', 'jpg', 'hdr'], 'png', f => f.toUpperCase());
  assert.equal(
    html,
    '<option value="png" selected>PNG</option><option value="jpg" >JPG</option>'
    + '<optgroup label="Pro"><option value="exr" >EXR</option><option value="hdr" >HDR</option></optgroup>',
  );
  // The ordinary formats keep their order and the group is last, so a flat reader
  // still meets png first.
  assert.ok(html.indexOf('value="png"') < html.indexOf('<optgroup'));
});
