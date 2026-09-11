// SPDX-License-Identifier: MPL-2.0
/**
 * The LIFT CONTRACT for the Design editor's row builders (plan 179 M3, package (a)).
 *
 * `views/free-canvas-fields.ts` is a COPY of builders that still live inside
 * `initFreeCanvas` in free-canvas.ts. A copy is a liability until somebody proves the
 * two are the same builder, so every literal below was CAPTURED FROM THE PRE-LIFT
 * IMPLEMENTATION - extracted out of free-canvas.ts by source text and evaluated against
 * the real `escape`/`t`/`tRaw` (scratchpad script, 2026-09-02) - not retyped from
 * reading it. That is what makes them a contract rather than a restatement.
 *
 * When the dedupe slice deletes the overlay's copies and re-imports these, THESE
 * ASSERTIONS MUST NOT BE EDITED. If one fails then, the dedupe changed the markup, and
 * `styles/parts/editor.css` styles that markup by class and structure: `.fc-seg` /
 * `.fc-seg-btn.is-on` / `.fc-row > span` / `.fc-dims-f` are all positional selectors.
 * A whitespace or attribute-order drift here is a visual regression there.
 *
 * ONE DELIBERATE DIVERGENCE FROM THE PRE-LIFT MARKUP (2026-09-02, review finding).
 * Every `.fc-seg-btn` now carries `aria-pressed`, and a segmented group given a
 * `groupLabel` carries `role="group"` + `aria-label`. The pre-lift copies marked the
 * selected segment with the `is-on` CLASS alone, so a screen-reader user met nine
 * unrelated "Anchor image top left" buttons with no current-state and no confirmation
 * on press. The CLASSES and the structure - everything the CSS selects on - are
 * untouched, which is what these pins exist to protect; the added attributes are
 * state the markup was missing. When the dedupe ships, the overlay's copies must gain
 * the same attributes rather than these literals losing them.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-panels-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  segHtml, posGridHtml, iconRow, segRow, dimsCell, tiltRow, opt, FIELD_GLYPH,
} from './free-canvas-fields.ts';

// ── the two builders the spec names by hand ───────────────────────────────────

test('segHtml pins to the pre-lift markup byte for byte, plus the pressed state', () => {
  assert.equal(
    segHtml('bg', 'a', [['a', 'A'], ['b', 'B']]),
    '<div class="fc-seg" data-seg="bg">'
      + '<button type="button" class="fc-seg-btn is-on" data-v="a" data-tip="A" aria-label="A" aria-pressed="true">A</button>'
      + '<button type="button" class="fc-seg-btn" data-v="b" data-tip="B" aria-label="B" aria-pressed="false">B</button>'
      + '</div>',
  );
});

test('segHtml names the GROUP when given a label, and stays a plain div without one', () => {
  // The row label (`segRow`'s `<span>`) is not associated with anything, so the set
  // itself is nameless unless the caller says what it is.
  assert.match(
    segHtml('shape', 'a', [['a', 'A']], 'Shape'),
    /^<div class="fc-seg" data-seg="shape" role="group" aria-label="Shape">/,
  );
  assert.ok(!segHtml('shape', 'a', [['a', 'A']]).includes('role='));
});

test('posGridHtml pins to the pre-lift markup byte for byte, plus the pressed state', () => {
  assert.equal(
    posGridHtml('imgpos', 'center'),
    '<div class="fc-seg fc-posgrid" data-seg="imgpos">'
      + '<button type="button" class="fc-seg-btn fc-pos-btn" data-v="left top" data-tip="Top left" aria-label="Anchor image top left" aria-pressed="false"><i></i></button>'
      + '<button type="button" class="fc-seg-btn fc-pos-btn" data-v="center top" data-tip="Top" aria-label="Anchor image top" aria-pressed="false"><i></i></button>'
      + '<button type="button" class="fc-seg-btn fc-pos-btn" data-v="right top" data-tip="Top right" aria-label="Anchor image top right" aria-pressed="false"><i></i></button>'
      + '<button type="button" class="fc-seg-btn fc-pos-btn" data-v="left center" data-tip="Left" aria-label="Anchor image left" aria-pressed="false"><i></i></button>'
      + '<button type="button" class="fc-seg-btn fc-pos-btn is-on" data-v="center" data-tip="Centre" aria-label="Anchor image centre" aria-pressed="true"><i></i></button>'
      + '<button type="button" class="fc-seg-btn fc-pos-btn" data-v="right center" data-tip="Right" aria-label="Anchor image right" aria-pressed="false"><i></i></button>'
      + '<button type="button" class="fc-seg-btn fc-pos-btn" data-v="left bottom" data-tip="Bottom left" aria-label="Anchor image bottom left" aria-pressed="false"><i></i></button>'
      + '<button type="button" class="fc-seg-btn fc-pos-btn" data-v="center bottom" data-tip="Bottom" aria-label="Anchor image bottom" aria-pressed="false"><i></i></button>'
      + '<button type="button" class="fc-seg-btn fc-pos-btn" data-v="right bottom" data-tip="Bottom right" aria-label="Anchor image bottom right" aria-pressed="false"><i></i></button>'
      + '</div>',
  );
  assert.match(posGridHtml('imgpos', 'center', 'Image position'), /role="group" aria-label="Image position"/);
});

// ── the composed section markup a fixed box produces ──────────────────────────
// The More panel's shape + corner-radius pair, the Dims panel's X and W cells, the
// tilt slider and the shared <option>: one pin each, all captured the same way. Between
// them they cover every wrapper the lifted builders emit (label vs div row, the icon
// span, the `min="1"` branch, the readout <b>, and the `selected` branch).

const SEG_FIXTURE = '<div class="fc-seg" data-seg="shape"><button type="button" class="fc-seg-btn is-on" data-v="rect" data-tip="Rectangle" aria-label="Rectangle" aria-pressed="true">R</button></div>';
const SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

test('segRow composes a segmented control into the pre-lift row', () => {
  assert.equal(
    segRow(FIELD_GLYPH.shRounded, 'Shape', SEG_FIXTURE),
    '<div class="fc-row"><span class="fc-row-lbl" data-tip="Shape">'
      + SVG_OPEN + '<rect x="4" y="6" width="16" height="12" rx="4.5"/></svg>'
      + '<span>Shape</span></span>' + SEG_FIXTURE + '</div>',
  );
});

test('iconRow composes a slider into the pre-lift row', () => {
  assert.equal(
    iconRow(FIELD_GLYPH.radius, 'Corner radius', '<input type="range" class="field-range" data-mp="radius" min="0" max="200" value="12"><b data-mp-val="radius">12</b>'),
    '<label class="fc-row"><span class="fc-row-lbl" data-tip="Corner radius">'
      + SVG_OPEN + '<path d="M5 19V9a4 4 0 0 1 4-4h10"/><line x1="5" y1="19" x2="5" y2="21"/><line x1="3" y1="19" x2="5" y2="19"/></svg>'
      + '<span>Corner radius</span></span>'
      + '<input type="range" class="field-range" data-mp="radius" min="0" max="200" value="12"><b data-mp-val="radius">12</b></label>',
  );
});

test('dimsCell pins both branches (plain, and the min=1 size cell)', () => {
  assert.equal(dimsCell('X', 'x', 40), '<label class="fc-dims-f"><span>X</span><input type="number" data-dm="x" value="40"><i>px</i></label>');
  assert.equal(dimsCell('W', 'w', 200, true), '<label class="fc-dims-f"><span>W</span><input type="number" min="1" data-dm="w" value="200"><i>px</i></label>');
});

test('tiltRow pins to the pre-lift row, with the overlay FC_TILT range', () => {
  assert.equal(
    tiltRow('rx', 'Tilt X', 12),
    '<label class="fc-row"><span class="fc-row-lbl">Tilt X</span>'
      + '<input type="range" class="field-range" data-mp="rx" min="-75" max="75" value="12"><b data-mp-val="rx">12</b></label>',
  );
});

test('opt pins both branches', () => {
  assert.equal(opt('cover', 'Cover', 'cover'), '<option value="cover" selected>Cover</option>');
  assert.equal(opt('cover', 'Cover', 'fill'), '<option value="cover">Cover</option>');
});
