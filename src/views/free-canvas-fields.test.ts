// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the lifted Design row builders (`views/free-canvas-fields.ts`).
 *
 * The markup PINS live next to this file in `free-canvas-panels-contract.test.ts`;
 * this suite covers behaviour the pins cannot: how each builder reacts to the values
 * it is handed (selected state, icon vs text segment, HTML-unsafe labels), what
 * `wireSegs` reports, and what `frameThumb` clones out of a live canvas.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas-fields.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  segHtml, posGridHtml, wireSegs, POS9, FIELD_GLYPH, TILT_RANGE,
  shapeChoicesFrom, shadowChoicesFrom, frameThumb, dimOf, svgIcon,
} from './free-canvas-fields.ts';
import { mountScopedStyle } from '../lib/scope-css.ts';
import type { BoxFieldConfig } from './free-canvas-math.ts';

// ── jsdom bootstrap (the builders touch `document` only at call time) ─────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & { Event: typeof Event };
for (const k of ['window', 'document', 'HTMLElement', 'Event', 'MouseEvent', 'Node', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
const click = (el: Element): void => { el.dispatchEvent(new W.Event('click', { bubbles: true })); };
const html = (markup: string): HTMLElement => {
  const d = document.createElement('div');
  d.innerHTML = markup;
  return d;
};

const CFG: BoxFieldConfig = { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot' };

// ── segHtml ───────────────────────────────────────────────────────────────────

test('segHtml: exactly one segment carries is-on, matched by STRING value', () => {
  // The model stores numbers as often as strings (a weight of 700, a build step of 2),
  // so the comparison is deliberately stringy - a numeric `cur` must still light up.
  const el = html(segHtml('weight', 700, [['400', 'Regular'], ['700', 'Bold']]));
  const on = el.querySelectorAll('.fc-seg-btn.is-on');
  assert.equal(on.length, 1);
  assert.equal((on[0] as HTMLElement).dataset.v, '700');
});

test('segHtml: aria-pressed carries the same state as the is-on class, on every segment', () => {
  // The class is what the eye reads; aria-pressed is what everyone else reads. A
  // segmented control whose state lives ONLY in a class announces nine unrelated
  // buttons with no current one - which is what the inspector's Shape / Align /
  // Image fit rows did before this.
  const el = html(segHtml('align', 'center', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]));
  const btns = [...el.querySelectorAll<HTMLButtonElement>('.fc-seg-btn')];
  assert.deepEqual(btns.map((b) => b.getAttribute('aria-pressed')), ['false', 'true', 'false']);
  assert.deepEqual(btns.map((b) => b.classList.contains('is-on')), [false, true, false]);
  // An unknown value is pressed nowhere - the attribute never invents a current one.
  const none = html(segHtml('align', 'justify', [['left', 'Left'], ['center', 'Centre']]));
  assert.deepEqual([...none.querySelectorAll('.fc-seg-btn')].map((b) => b.getAttribute('aria-pressed')), ['false', 'false']);
});

test('segHtml: a group label names the SET; without one the group stays unnamed rather than mislabelled', () => {
  const named = html(segHtml('fit', 'contain', [['contain', 'Contain']], 'Image fit')).firstElementChild!;
  assert.equal(named.getAttribute('role'), 'group');
  assert.equal(named.getAttribute('aria-label'), 'Image fit');
  const bare = html(segHtml('fit', 'contain', [['contain', 'Contain']])).firstElementChild!;
  assert.equal(bare.getAttribute('role'), null);
  assert.equal(bare.getAttribute('aria-label'), null);
  // The label is a sink like any other.
  assert.ok(!segHtml('fit', 'a', [['a', 'A']], 'Bell & <Co>').includes('<Co>'));
});

test('segHtml: an unknown current value lights nothing (never a false reading)', () => {
  // The bug this guards is real and named in free-canvas.ts: a `depth` shadow opened the
  // Shadow row with all four segments off, and clicking any of them silently replaced it.
  // The fix is to feed the control the manifest's own options (shadowChoicesFrom below) -
  // the control itself must keep telling the truth about a value it was not given.
  const el = html(segHtml('shadow', 'depth', [['none', 'None'], ['box', 'Box']]));
  assert.equal(el.querySelectorAll('.fc-seg-btn.is-on').length, 0);
});

test('segHtml: an icon choice renders the glyph and keeps the label as tooltip + aria-label', () => {
  const el = html(segHtml('shape', 'rect', [['rect', 'Rectangle', FIELD_GLYPH.shRect]]));
  const btn = el.querySelector<HTMLButtonElement>('.fc-seg-btn')!;
  assert.ok(btn.classList.contains('fc-seg-ic'));
  assert.ok(btn.querySelector('svg'), 'glyph rendered');
  assert.equal(btn.getAttribute('aria-label'), 'Rectangle');
  assert.equal(btn.dataset.tip, 'Rectangle');
});

test('segHtml: a text choice has no glyph, and the label is escaped in every sink', () => {
  const el = html(segHtml('cls', 'a', [['a', 'Bell & <Co>']]));
  const btn = el.querySelector<HTMLButtonElement>('.fc-seg-btn')!;
  assert.equal(btn.querySelector('svg'), null);
  assert.equal(btn.textContent, 'Bell & <Co>');
  assert.equal(btn.getAttribute('aria-label'), 'Bell & <Co>');
  assert.ok(!segHtml('cls', 'a', [['a', 'Bell & <Co>']]).includes('<Co>'), 'raw markup never reaches the string');
});

// ── posGridHtml ───────────────────────────────────────────────────────────────

test('posGridHtml: nine cells in POS9 order, each with its own aria-label', () => {
  const el = html(posGridHtml('imgpos', 'right bottom'));
  const btns = [...el.querySelectorAll<HTMLButtonElement>('.fc-pos-btn')];
  assert.equal(btns.length, 9);
  assert.deepEqual(btns.map((b) => b.dataset.v), POS9.map(([v]) => v));
  assert.equal(btns.filter((b) => b.classList.contains('is-on')).length, 1);
  assert.equal(btns[8]!.classList.contains('is-on'), true);
  assert.equal(btns[0]!.getAttribute('aria-label'), 'Anchor image top left');
  // Every cell announces where it anchors - an icon-only 3x3 grid is unusable otherwise.
  assert.equal(new Set(btns.map((b) => b.getAttribute('aria-label'))).size, 9);
});

test('posGridHtml: an unset position (empty string) lights no cell', () => {
  const el = html(posGridHtml('imgpos', ''));
  assert.equal(el.querySelectorAll('.is-on').length, 0);
  assert.equal(el.querySelectorAll('[aria-pressed="true"]').length, 0);
});

test('posGridHtml: the anchored cell is the pressed one, and the grid can be named', () => {
  const el = html(posGridHtml('imgpos', 'right bottom', 'Image position'));
  const on = el.querySelectorAll<HTMLButtonElement>('[aria-pressed="true"]');
  assert.equal(on.length, 1);
  assert.equal(on[0]!.dataset.v, 'right bottom');
  assert.equal(el.firstElementChild!.getAttribute('aria-label'), 'Image position');
});

// ── wireSegs ──────────────────────────────────────────────────────────────────

test('wireSegs: a click reports (field, value) and moves is-on within that group only', () => {
  const panel = html(segHtml('fit', 'contain', [['contain', 'Contain'], ['cover', 'Cover']])
    + segHtml('align', 'left', [['left', 'Left'], ['right', 'Right']]));
  const seen: Array<[string | undefined, string | undefined]> = [];
  wireSegs(panel, (f, v) => seen.push([f, v]));
  click(panel.querySelectorAll('.fc-seg')[0]!.querySelectorAll('.fc-seg-btn')[1]!);
  assert.deepEqual(seen, [['fit', 'cover']]);
  const [fitGroup, alignGroup] = [...panel.querySelectorAll('.fc-seg')];
  assert.equal(fitGroup!.querySelector('.is-on')!.getAttribute('data-v'), 'cover');
  assert.equal(alignGroup!.querySelector('.is-on')!.getAttribute('data-v'), 'left', 'the other group is untouched');
});

test('wireSegs: a click moves aria-pressed with the class, in that group only', () => {
  // Repainting the class alone leaves the OLD segment announced as pressed and the
  // press itself unconfirmed - the control would tell two different stories.
  const panel = html(segHtml('fit', 'contain', [['contain', 'Contain'], ['cover', 'Cover']])
    + segHtml('align', 'left', [['left', 'Left'], ['right', 'Right']]));
  wireSegs(panel, () => {});
  const [fitGroup, alignGroup] = [...panel.querySelectorAll('.fc-seg')];
  click(fitGroup!.querySelectorAll('.fc-seg-btn')[1]!);
  assert.deepEqual([...fitGroup!.querySelectorAll('.fc-seg-btn')].map((b) => b.getAttribute('aria-pressed')), ['false', 'true']);
  assert.deepEqual([...alignGroup!.querySelectorAll('.fc-seg-btn')].map((b) => b.getAttribute('aria-pressed')), ['true', 'false']);
  // Pressing the one already on leaves it on: idempotent, never a toggle-off.
  click(fitGroup!.querySelectorAll('.fc-seg-btn')[1]!);
  assert.equal(fitGroup!.querySelectorAll('.fc-seg-btn')[1]!.getAttribute('aria-pressed'), 'true');
});

test('wireSegs: onSet is REQUIRED - the lifted copy carries no default write target', () => {
  // The overlay's copy defaulted `onSet` to its own `setField` closure. A default
  // parameter is exactly what `Function.length` stops counting, so the arity is the
  // honest assertion here: 2 means both parameters are required, 1 means the default
  // crept back in and this module writes somewhere of its own accord again.
  assert.equal(wireSegs.length, 2);
});

// ── manifest-driven choice tables ─────────────────────────────────────────────

const SHAPE_FIELD = { id: 'shape', options: [
  { value: 'rect', label: 'Rectangle' }, { value: 'rounded', label: 'Rounded' }, { value: 'blob', label: 'Blob' },
] };

test('shapeChoicesFrom: manifest order, known values get a glyph, unknown ones fall back to the label', () => {
  const choices = shapeChoicesFrom([SHAPE_FIELD], 'shape');
  assert.deepEqual(choices.map((c) => c[0]), ['rect', 'rounded', 'blob']);
  assert.equal(choices[0]![2], FIELD_GLYPH.shRect);
  assert.equal(choices[2]![2], undefined, 'no invented glyph for a shape this app does not draw');
  assert.equal(choices[2]![1], 'Blob');
});

test('shapeChoicesFrom: no declaration, no control (a tool that cannot shape is not offered shapes)', () => {
  assert.deepEqual(shapeChoicesFrom([SHAPE_FIELD], undefined), []);
  assert.deepEqual(shapeChoicesFrom([], 'shape'), []);
  assert.deepEqual(shapeChoicesFrom(undefined, 'shape'), []);
});

test('shadowChoicesFrom: a manifest that declares `depth` gets `depth` - the segment cannot go blank', () => {
  const choices = shadowChoicesFrom([{ id: 'shadow', options: [
    { value: 'none', label: 'None' }, { value: 'box', label: 'Box' }, { value: 'depth', label: 'Depth' },
  ] }], 'shadow');
  assert.deepEqual(choices, [['none', 'None'], ['box', 'Box'], ['depth', 'Depth']]);
  assert.equal(html(segHtml('shadow', 'depth', choices)).querySelectorAll('.is-on').length, 1);
});

test('shadowChoicesFrom: a manifest with no options falls back to the historical four', () => {
  assert.deepEqual(shadowChoicesFrom([{ id: 'shadow' }], 'shadow').map((c) => c[0]), ['none', 'box', 'text', 'content']);
});

// ── frameThumb ────────────────────────────────────────────────────────────────

function canvasWithPages(): HTMLElement {
  document.body.innerHTML = '<div id="tool-canvas">'
    + '<div class="lolly-frame-page" data-frame-id="f1"><p>one</p><video autoplay></video></div>'
    + '<div class="lolly-frame-page" data-frame-id="f2"><p>two</p></div>'
    + '</div>';
  return document.getElementById('tool-canvas')!;
}

test('frameThumb: clones only THIS frame page, scaled to fit the box', () => {
  const canvasEl = canvasWithPages();
  const thumb = frameThumb(canvasEl, { id: 'f1', x: 0, y: 0, w: 1600, h: 900 }, CFG, { maxW: 132, maxH: 90 });
  // min(132/1600, 90/900) = 0.0825 → 132 x 74
  assert.equal(thumb.style.width, '132px');
  assert.equal(thumb.style.height, '74px');
  assert.equal(thumb.className, 'fc-frame-thumb');
  const clone = thumb.firstElementChild as HTMLElement;
  assert.equal(clone.textContent!.trim(), 'one', 'the other frame is not in the clone');
  assert.equal(clone.style.transform, 'scale(0.0825)');
  assert.equal(clone.style.pointerEvents, 'none');
});

test('frameThumb: a portrait frame letterboxes on height, not width', () => {
  const canvasEl = canvasWithPages();
  const thumb = frameThumb(canvasEl, { id: 'f2', x: 0, y: 0, w: 900, h: 1600 }, CFG, { maxW: 132, maxH: 90 });
  assert.equal(thumb.style.height, '90px');
  assert.equal(thumb.style.width, '51px');
});

test('frameThumb: text and shapes keep canvas-scoped layout outside the canvas', (ctx) => {
  const base = mountScopedStyle('.lolly-box { position: absolute; display: flex; }', '#tool-canvas');
  ctx.after(() => base.remove());
  document.body.innerHTML = `<div id="tool-canvas"><style data-lolly-scope="#tool-canvas">
    #tool-canvas .lolly-box-text { font-size: 64px; color: rgb(255, 255, 255); }
    #tool-canvas .shape { border-radius: 50%; background: rgb(0, 128, 0); }
  </style><div class="lolly-frame-page" data-frame-id="f1">
    <div class="lolly-box"><p class="lolly-box-text">Make it yours</p></div>
    <div class="lolly-box shape"></div>
  </div></div>`;
  const canvas = document.getElementById('tool-canvas')!;
  const thumb = frameThumb(canvas, { id: 'f1', w: 1920, h: 1080 }, CFG, { maxW: 132, maxH: 90 });
  document.body.appendChild(thumb);
  assert.equal(getComputedStyle(thumb.querySelector('.lolly-box')!).position, 'absolute');
  assert.equal(getComputedStyle(thumb.querySelector('.lolly-box-text')!).fontSize, '64px');
  assert.equal(getComputedStyle(thumb.querySelector('.shape')!).borderRadius, '50%');
  const outside = document.createElement('p');
  outside.className = 'lolly-box-text';
  document.body.appendChild(outside);
  assert.notEqual(getComputedStyle(outside).fontSize, '64px', 'thumbnail CSS cannot leak onto editor chrome');
  assert.equal(canvas.querySelector('.lolly-box-text')!.textContent, 'Make it yours');
  canvas.querySelector('style')!.textContent = '#tool-canvas .lolly-box-text { font-size: 72px; }';
  const updated = frameThumb(canvas, { id: 'f1', w: 1920, h: 1080 }, CFG, { maxW: 132, maxH: 90 });
  document.body.insertBefore(updated, thumb);
  assert.equal(getComputedStyle(updated.querySelector('.lolly-box-text')!).fontSize, '72px', 'custom CSS edits invalidate the cached styling, even with an older preview later in the DOM');
});

test('frameThumb: playhead visibility and editor-only nodes do not blank the preview', () => {
  document.body.innerHTML = `<div id="tool-canvas"><div class="lolly-frame-page" data-frame-id="f1">
    <div class="lolly-box seq-off">Later slide text</div>
    <div class="lolly-box" style="display:none">Authored hidden</div>
    <button data-export-hide>Editor handle</button>
  </div></div>`;
  const canvas = document.getElementById('tool-canvas')!;
  const thumb = frameThumb(canvas, { id: 'f1', w: 800, h: 600 }, CFG, { maxW: 132, maxH: 90 });
  assert.equal(thumb.querySelector('.seq-off'), null);
  assert.equal(thumb.querySelector('[data-export-hide]'), null);
  assert.equal(thumb.querySelectorAll<HTMLElement>('.lolly-box')[1]!.style.display, 'none');
  assert.ok(canvas.querySelector('.seq-off'), 'the live scene stays at its current playhead');
});

test('frameThumb: video in the clone is muted, paused and stripped of autoplay', () => {
  const canvasEl = canvasWithPages();
  const v = frameThumb(canvasEl, { id: 'f1', w: 1600, h: 900 }, CFG, { maxW: 132, maxH: 90 })
    .querySelector<HTMLVideoElement>('video')!;
  assert.equal(v.muted, true);
  assert.equal(v.hasAttribute('autoplay'), false);
});

test('frameThumb: with no frame page it clips the whole canvas and shifts it to the frame origin', () => {
  document.body.innerHTML = '<div id="tool-canvas"><p>flat</p></div>';
  const canvasEl = document.getElementById('tool-canvas')!;
  const clone = frameThumb(canvasEl, { id: 'nope', x: 200, y: 100, w: 800, h: 600 }, CFG, { maxW: 80, maxH: 80 })
    .firstElementChild as HTMLElement;
  assert.equal(clone.style.transform, 'translate(-20px, -10px) scale(0.1)');
  assert.equal(clone.id, '', 'the clone never duplicates #tool-canvas');
});

test('frameThumb: a zero/absent size never divides by zero', () => {
  const canvasEl = canvasWithPages();
  const thumb = frameThumb(canvasEl, { id: 'f1' }, CFG, { maxW: 132, maxH: 90 });
  assert.equal(thumb.style.width, '90px');
  assert.equal(thumb.style.height, '90px');
});

// ── frameThumb: the fill travels with the clone ───────────────────────────────
// A board's fill is inline but indirect (`background: var(--brand-surface)`, or the tool's
// `var(--lolly-frame-surface, #ffffff)` default), and both names are defined inside the tool
// canvas. Out in the navigator column the clone resolved neither, so a pink board painted as
// the column's dark background. jsdom has no cascade for either name, so these tests stand a
// fake computed style in for the browser's - the values are what a real canvas would report.

/** Swap in a computed style that answers from `byEl`, and hand back the undo. `enumerate`
 *  says whether this engine lists custom properties (only the newest ones do, jsdom none). */
function stubComputed(byEl: Map<Element, Record<string, string>>, enumerate = false): () => void {
  const g = globalThis as Record<string, unknown>;
  const real = g.getComputedStyle;
  g.getComputedStyle = (el: Element): CSSStyleDeclaration => {
    const vals = byEl.get(el) ?? {};
    const names = enumerate ? Object.keys(vals).filter((n) => n.startsWith('--')) : [];
    return {
      length: names.length,
      item: (i: number) => names[i] ?? '',
      getPropertyValue: (p: string) => vals[p] ?? '',
    } as unknown as CSSStyleDeclaration;
  };
  return () => { g.getComputedStyle = real; };
}

function canvasWithBrandPage(pageStyle: string, canvasStyle = '--brand-surface: #ffd0e0'): { canvasEl: HTMLElement; page: HTMLElement } {
  document.body.innerHTML = `<div id="tool-canvas" style="${canvasStyle}">`
    + `<div class="lolly-frame-page" data-frame-id="f1" style="${pageStyle}"><p>one</p></div>`
    + '</div>';
  const canvasEl = document.getElementById('tool-canvas')!;
  return { canvasEl, page: canvasEl.querySelector<HTMLElement>('.lolly-frame-page')! };
}

test('frameThumb: the clone root carries the RESOLVED fill, not the unresolvable var()', () => {
  const { canvasEl, page } = canvasWithBrandPage('background: var(--brand-surface)');
  const undo = stubComputed(new Map([[page, { 'background-color': 'rgb(255, 208, 224)', color: 'rgb(20, 24, 29)' }]]));
  try {
    const clone = frameThumb(canvasEl, { id: 'f1', w: 1600, h: 900 }, CFG, { maxW: 44, maxH: 25 })
      .firstElementChild as HTMLElement;
    assert.equal(clone.style.getPropertyValue('background-color'), 'rgb(255, 208, 224)');
    assert.equal(clone.style.getPropertyValue('color'), 'rgb(20, 24, 29)');
  } finally { undo(); }
});

test('frameThumb: the brand tokens the page reads are copied onto the clone, so children resolve too', () => {
  // The canvas element is where brand-vars.ts writes the slots, so the copy walks ancestors.
  const { canvasEl, page } = canvasWithBrandPage('background: var(--brand-surface)');
  const undo = stubComputed(new Map([[page, { 'background-color': 'rgb(255, 208, 224)' }]]));
  try {
    const clone = frameThumb(canvasEl, { id: 'f1', w: 1600, h: 900 }, CFG, { maxW: 44, maxH: 25 })
      .firstElementChild as HTMLElement;
    assert.equal(clone.style.getPropertyValue('--brand-surface'), '#ffd0e0');
  } finally { undo(); }
});

test('frameThumb: an engine that enumerates custom properties hands over the scoped ones too', () => {
  // `--lolly-frame-surface` is declared by the tool stylesheet, scoped to the canvas: nothing
  // declares it inline, so only the computed style can report it.
  const { canvasEl, page } = canvasWithBrandPage('background: var(--lolly-frame-surface, #ffffff)', '');
  const undo = stubComputed(new Map([[page, {
    '--lolly-frame-surface': '#2a2f3a', '--shell-private': '#000', 'background-color': 'rgb(42, 47, 58)',
  }]]), true);
  try {
    const clone = frameThumb(canvasEl, { id: 'f1', w: 1600, h: 900 }, CFG, { maxW: 44, maxH: 25 })
      .firstElementChild as HTMLElement;
    assert.equal(clone.style.getPropertyValue('--lolly-frame-surface'), '#2a2f3a');
    assert.equal(clone.style.getPropertyValue('background-color'), 'rgb(42, 47, 58)');
    assert.equal(clone.style.getPropertyValue('--shell-private'), '', 'only the brand/lolly/font namespaces are copied');
  } finally { undo(); }
});

test('frameThumb: a see-through board stays see-through, and a gradient rides along', () => {
  const { canvasEl, page } = canvasWithBrandPage('background: transparent');
  const undo = stubComputed(new Map([[page, {
    'background-color': 'rgba(0, 0, 0, 0)',
    'background-image': 'linear-gradient(rgb(255, 0, 128), rgb(0, 0, 255))',
  }]]));
  try {
    const clone = frameThumb(canvasEl, { id: 'f1', w: 1600, h: 900 }, CFG, { maxW: 44, maxH: 25 })
      .firstElementChild as HTMLElement;
    assert.equal(clone.style.getPropertyValue('background-color'), 'rgba(0, 0, 0, 0)');
    assert.equal(clone.style.getPropertyValue('background-image'), 'linear-gradient(rgb(255, 0, 128), rgb(0, 0, 255))');
  } finally { undo(); }
});

test('frameThumb: no computed style at all still copies the inline brand tokens, and invents no fill', () => {
  const { canvasEl } = canvasWithBrandPage('background: var(--brand-surface)');
  const g = globalThis as Record<string, unknown>;
  const real = g.getComputedStyle;
  g.getComputedStyle = () => { throw new Error('no view'); };
  try {
    const clone = frameThumb(canvasEl, { id: 'f1', w: 1600, h: 900 }, CFG, { maxW: 44, maxH: 25 })
      .firstElementChild as HTMLElement;
    assert.equal(clone.style.getPropertyValue('--brand-surface'), '#ffd0e0');
    assert.equal(clone.style.getPropertyValue('background-color'), '');
  } finally { g.getComputedStyle = real; }
});

test('frameThumb: the thumbnail isolates itself, so a blended board cannot blend with the column', () => {
  const canvasEl = canvasWithPages();
  const thumb = frameThumb(canvasEl, { id: 'f1', w: 1600, h: 900 }, CFG, { maxW: 44, maxH: 25 });
  assert.equal(thumb.style.getPropertyValue('isolation'), 'isolate');
});

// ── small readers ─────────────────────────────────────────────────────────────

test('dimOf: keeps two decimals, defaults, and returns the default for a field the tool does not declare', () => {
  // Two decimals, not an integer (plans/184 R12): a 793.7 px A4 board reads back as itself.
  assert.equal(dimOf({ x: 12.4 }, 'x', 0), 12.4);
  assert.equal(dimOf({ x: 793.7 }, 'x', 0), 793.7);
  assert.equal(dimOf({ x: 12.456 }, 'x', 0), 12.46);
  assert.equal(dimOf({ x: 'nope' }, 'x', 7), 7);
  assert.equal(dimOf({ x: 12 }, undefined, 3), 3);
});

test('svgIcon wraps raw path markup in the overlay 24x24 frame, aria-hidden', () => {
  const el = html(svgIcon('<circle cx="12" cy="12" r="8"/>')).firstElementChild!;
  assert.equal(el.getAttribute('viewBox'), '0 0 24 24');
  assert.equal(el.getAttribute('aria-hidden'), 'true');
});

test('TILT_RANGE mirrors the overlay FC_TILT range', () => {
  assert.deepEqual([...TILT_RANGE], [-75, 75]);
});
