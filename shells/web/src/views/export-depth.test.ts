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
  PRO_FORMATS, isProFormat, formatOptionsHtml, depthFact, applyDepthFact,
} from './export-depth.ts';
import { proFormatSupport } from '../bridge/format-support.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.document = dom.window.document;

// The panel shape applyDepthFact writes into: the flex column, with the
// filename·format flex pair as its first row (see tool-actions.ts filenameRow).
const ROW = '<div class="filename-extension">'
  + '<input type="text" class="export-filename" data-action="filename" value="Poster">'
  + '<select data-action="format" aria-label="Export format">'
  + '<option value="png" selected>PNG</option><option value="jpg">JPG</option>'
  + '</select></div>';
const makePanel = (): HTMLElement => {
  const el = document.createElement('div');
  el.className = 'tool-actions';
  el.innerHTML = `${ROW}<div class="export-dims"></div>`;
  return el;
};

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

// ── The depth fact: derived from the pipeline, not from a list ───────────────

test('nothing is stated for an ordinary export', () => {
  for (const f of ['png', 'jpg', 'jpeg', 'svg', 'pdf', 'avif', 'tiff', 'webp', 'gif']) {
    assert.equal(depthFact(f, {}), null, `${f} with HDR off`);
    assert.equal(depthFact(f, { hdr: false, depth: 16 }), null, `${f} with depth=16 but HDR off`);
  }
  assert.equal(depthFact(undefined, { hdr: true }), null);
});

test('an HDR PNG states 16-bit, because that is what the writer emits', () => {
  const fact = depthFact('png', { hdr: true });
  assert.ok(fact);
  assert.equal(fact.kind, 'deep');
  assert.equal(fact.label, '16-bit');
  assert.ok(fact.why.length > 20 && fact.why.endsWith('.'), 'the why is one plain sentence');
  // Two words maximum - this is the whole visible affordance.
  assert.ok(fact.label.split(' ').length <= 2, fact.label);
});

test('depth=8 does not change the HDR PNG fact, because the encoder ignores it', () => {
  // bridge/export-hdr-png.ts logs and ignores depth=8: 8-bit PQ IS the banding
  // defect. The panel must not claim otherwise in either direction.
  for (const depth of [8, 16, 'float', 'auto'] as const) {
    assert.equal(depthFact('png', { hdr: true, depth })?.label, '16-bit', String(depth));
  }
});

// Adversarial review (2026-07-31) killed the gain-map fact: a gain-map JPEG only
// gets its second rendition when the view transform finds something to lift, and
// a dark or unmatched design legitimately ships a plain SDR JPEG instead
// (export-gainmap-jpeg.ts returns mapLength 0). The panel cannot know which way
// it goes without running the transform, and a fact that is wrong in an ORDINARY
// case is worse than no fact, so an HDR JPEG now says nothing at all.
test('an HDR JPEG says NOTHING, because the gain map is not guaranteed', () => {
  for (const f of ['jpg', 'jpeg']) {
    for (const depth of [undefined, 8, 16, 'float', 'auto'] as const) {
      assert.equal(depthFact(f, { hdr: true, depth }), null, `${f} depth=${depth}`);
    }
  }
});

test('HDR AVIF and HDR TIFF say nothing, because they are still 8-bit', () => {
  // renderBitmap / renderTiff keep the legacy transform (section 9b "untouched on
  // purpose"). Stating a depth here would be the export-side padding lie.
  for (const f of ['avif', 'tiff', 'webp', 'pdf', 'svg']) {
    assert.equal(depthFact(f, { hdr: true }), null, f);
  }
});

test('the only fact is a label, not prose, and stays within the space budget', () => {
  const deep = depthFact('png', { hdr: true })!;
  assert.equal(deep.label.includes('.'), false, 'the visible fact is a label, not prose');
  assert.ok(deep.label.split(' ').length <= 2, `two words maximum, got "${deep.label}"`);
  assert.ok(deep.why.length > deep.label.length, 'the explanation lives in the tooltip layer');
});

// ── The panel: absent unless true, and never touching the format row ─────────

test('the default case adds nothing to the panel markup', () => {
  const el = makePanel();
  const before = el.innerHTML;
  applyDepthFact(el, depthFact('png', {}));           // HDR off: the common case
  assert.equal(el.innerHTML, before, 'markup changed with nothing to say');
  assert.equal(el.querySelector('[data-depth-fact]'), null);
  assert.equal(el.querySelector('.export-depth-fact'), null);
  // Not a hidden placeholder either - the class name appears nowhere in the panel.
  assert.equal(el.innerHTML.includes('depth-fact'), false);
});

test('the fact appears for png + hdr and vanishes when HDR is turned off', () => {
  const el = makePanel();
  const before = el.innerHTML;
  applyDepthFact(el, depthFact('png', { hdr: true }));
  const node = el.querySelector<HTMLElement>('[data-depth-fact]');
  assert.ok(node, 'no fact rendered for png + hdr');
  assert.equal(node.textContent, '16-bit');
  applyDepthFact(el, depthFact('png', { hdr: false }));
  assert.equal(el.querySelector('[data-depth-fact]'), null);
  assert.equal(el.innerHTML, before, 'turning HDR off left markup behind');
});

test('the fact vanishes when the format moves off a deep path', () => {
  const el = makePanel();
  applyDepthFact(el, depthFact('png', { hdr: true }));
  assert.ok(el.querySelector('[data-depth-fact]'));
  applyDepthFact(el, depthFact('avif', { hdr: true }));   // HDR still on, still 8-bit
  assert.equal(el.querySelector('[data-depth-fact]'), null);
});

test('switching png to jpg REMOVES the fact, leaving nothing behind', () => {
  // jpg has no fact to state (see the gain-map note above), so the swap is a
  // removal - and the removal must be total, not a hidden leftover node.
  const el = makePanel();
  const before = el.innerHTML;
  applyDepthFact(el, depthFact('png', { hdr: true }));
  assert.equal(el.querySelectorAll('[data-depth-fact]').length, 1);
  applyDepthFact(el, depthFact('jpg', { hdr: true }));
  assert.equal(el.querySelectorAll('[data-depth-fact]').length, 0);
  assert.equal(el.innerHTML, before, 'the panel returned to its exact original markup');
});

test('the filename and format row is byte-identical with the fact shown', () => {
  // The no-reflow guarantee, asserted where it is actually decided: the row's own
  // subtree never changes, and the fact is its following sibling in the column, so
  // the flex pair (filename grows, select hugs) is never re-solved.
  const el = makePanel();
  const row = el.querySelector<HTMLElement>('.filename-extension')!;
  const rowBefore = row.outerHTML;
  const rowChildren = row.children.length;
  applyDepthFact(el, depthFact('png', { hdr: true }));
  assert.equal(row.outerHTML, rowBefore);
  assert.equal(row.children.length, rowChildren);
  const node = el.querySelector<HTMLElement>('[data-depth-fact]')!;
  assert.equal(row.contains(node), false, 'the fact was placed inside the format row');
  assert.equal(row.nextElementSibling, node, 'the fact is not the row\'s next sibling');
  // jsdom has no layout engine, so this is a documentation of the limit rather
  // than a measurement: both boxes read 0 whatever the CSS says.
  assert.equal(row.offsetWidth, 0);
  assert.equal(row.offsetHeight, 0);
});

test('a panel with no filename row is left alone', () => {
  const el = document.createElement('div');
  el.innerHTML = '<div class="export-dims"></div>';
  applyDepthFact(el, depthFact('png', { hdr: true }));
  assert.equal(el.querySelector('[data-depth-fact]'), null);
  applyDepthFact(null, depthFact('png', { hdr: true }));   // no panel at all
});

// ── Accessibility ────────────────────────────────────────────────────────────

test('the fact is a note, not a control, and carries its why for assistive tech', () => {
  const el = makePanel();
  const fact = depthFact('png', { hdr: true })!;
  applyDepthFact(el, fact);
  const node = el.querySelector<HTMLElement>('[data-depth-fact]')!;
  // Not a control: not an interactive element, not focusable, no handler surface.
  assert.equal(node.tagName, 'SPAN');
  assert.equal(node.hasAttribute('tabindex'), false);
  assert.equal(node.hasAttribute('disabled'), false);
  assert.equal(node.querySelectorAll('input, select, button, a').length, 0);
  assert.equal(node.getAttribute('role'), 'note');
  // The why lives in the tooltip layer, via the app's [data-tip] primitive - not a
  // hand-rolled title=, which is invisible to keyboard and touch users.
  assert.equal(node.getAttribute('data-tip'), fact.why);
  assert.equal(node.hasAttribute('title'), false);
  // The bubble is a pseudo-element and is never read out, so the text is mirrored
  // into aria-label (parts/tooltip.css states this contract).
  assert.equal(node.getAttribute('aria-label'), `${fact.label}. ${fact.why}`);
  assert.equal(node.getAttribute('aria-hidden'), null, 'the fact itself is announced');
});

test('re-applying the same fact leaves one clean node', () => {
  const el = makePanel();
  const fact = depthFact('png', { hdr: true });   // the one format that has a fact
  applyDepthFact(el, fact);
  const first = el.querySelector('[data-depth-fact]');
  applyDepthFact(el, fact);
  assert.equal(el.querySelectorAll('[data-depth-fact]').length, 1);
  assert.equal(el.querySelector('[data-depth-fact]'), first, 'the node was replaced, not updated');
});
