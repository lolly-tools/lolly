// SPDX-License-Identifier: MPL-2.0
/**
 * The #/rebrand stage (plan 274 section 4, plan 275 close-out section 3.4) against the
 * real modules: the Original inset, the side segment, the Proposed hero and its caption,
 * hold to compare, the part pager, the empty and cut-off states, the empty boxes, the
 * object overlay on each pane, the tray, a slide rebuilt from its picture, and the
 * drawing cache the queue, the strip, the column and the report share.
 *
 * The state is the real pipeline over tests/fixtures/rebrand/adversarial.pptx, and the
 * controller a stub that records each command and answers ok (`reviewHarness` in
 * shared.test-utils.ts), so what these tests pin is which command a control sends and
 * with what, never what the controller does with it.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/compare.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { compileRenovated, designTextFit } from '@lolly/engine';
import type { CompiledDeckV1, RenovationPlanV1 } from '@lolly-tools/core/rebrand-v1';
import type { RebrandStateV1 } from '../../lib/rebrand/controller-api.ts';
import { STARTER_COMPILE_SYSTEM, STARTER_MASTER } from '../../../../../tests/helpers/rebrand-pipeline.ts';
import { readFileSync } from 'node:fs';
import { reviewHarness, rebrandCss } from './shared.test-utils.ts';
import type { RbCtx } from './context.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const key of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node', 'Event',
  'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'DOMParser', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}

const { RUN, stateFrom, mount, firstSlide, deckWithSurplus, pictureDeckState, keydown } = await reviewHarness();
const compare = await import('./compare.ts');

/** The stage's own sheet. */
const compareCss = (): string => readFileSync(new URL('../../styles/parts/rebrand-compare.css', import.meta.url), 'utf8');

/** Let the Original's idle mount run (no idle callback in jsdom: a short timer). */
const idle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 60); });

const q = (rb: RbCtx, selector: string): HTMLElement => {
  const el = rb.els.compare.querySelector<HTMLElement>(selector);
  assert.ok(el, selector);
  return el;
};

/** A pointer event as jsdom can make one, with the pointer type a real one carries. */
function pointer(type: string, init: MouseEventInit & { pointerType?: string } = {}): MouseEvent {
  const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...init });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'mouse' });
  return event;
}

/** The first frame of slide 1 in a deck. */
function frameOfFirst(deck: CompiledDeckV1): CompiledDeckV1['frames'][number] {
  const frame = deck.frames.find((one) => one.sourceSlideId === firstSlide().id);
  assert.ok(frame);
  return frame;
}

/** The review model's row for one object, asserted present. */
function objectOf(rb: RbCtx, id: string) {
  const row = rb.derived?.objects.get(id);
  assert.ok(row, id);
  return row;
}

/** Slide 1 selected with nothing else. */
function onFirstSlide(rb: RbCtx): void {
  rb.select({ slideId: firstSlide().id, objectId: null, itemId: null });
}

/** Every picture loaded, so a drawing is final and a render leaves it in place. */
function loaded(rb: RbCtx): void {
  rb.controller.mediaHref = () => 'blob:https://lolly.test/picture';
  rb.memo.compare = '';
  rb.render();
}

// ─── the layout of the stage ─────────────────────────────────────────────────

test('the caption hints the hold once, with the key in the tooltip, and the first pick line goes after a pick', () => {
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  const hint = q(rb, '[data-hold-hint]');
  assert.equal(hint.hidden, false);
  assert.equal(hint.textContent, 'Hold the slide to see the Original');
  assert.doesNotMatch(hint.textContent ?? '', /\\/, 'the key is not in the caption');
  assert.match(hint.title, /\\/, 'the key is in the tooltip');
  const first = q(rb, '[data-first-run]');
  assert.equal(first.hidden, false);
  assert.equal(first.textContent, 'Click an object to decide on it.');
  const object = rb.els.compare.querySelector<HTMLElement>('[data-pane="proposed"] .rb-ov');
  assert.ok(object);
  object.click();
  assert.equal(q(rb, '[data-first-run]').hidden, true, 'the line goes after the first pick');
  unmount();
});

test('a wide stage opens on the Proposed hero, with the Original as the inset and the side segment beside it', () => {
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  assert.equal(rb.compareSide, 'proposed', 'the hero is the Proposed slide');
  const root = q(rb, '.rb-cmp');
  assert.equal(root.dataset.show, 'proposed');
  // The segment is the panel primitive, never the app segment.
  const seg = q(rb, '.rb-cmp-row .lp-seg.rb-cmp-seg');
  assert.deepEqual([...seg.querySelectorAll('button')].map((b) => b.textContent), ['Original', 'Proposed', 'Both']);
  assert.equal(seg.querySelector('[aria-pressed="true"]')?.textContent, 'Proposed');
  assert.equal(rb.els.compare.querySelector('.view-seg-btn'), null);
  // The inset shows the other side, with its name and one line with the numbers in it.
  const inset = q(rb, '[data-inset]');
  assert.equal(inset.hidden, false);
  assert.equal(q(rb, '[data-inset-name]').textContent, 'Original');
  assert.match(q(rb, '[data-inset-note]').textContent ?? '', /^\d+ objects/);
  const art = q(rb, '[data-inset-art]');
  assert.equal(art.getAttribute('aria-label'), 'Show the Original');
  assert.ok(art.querySelector('svg[aria-hidden="true"]'), 'the inset art is a picture of the button, not a second name');
  // The hero draws the Proposed slide named for its pane.
  const hero = q(rb, '[data-pane="proposed"] .rb-hero svg');
  assert.match(hero.getAttribute('aria-label') ?? '', /^Proposed: /);
  assert.equal(hero.getAttribute('role'), 'img');
  // The caption: the pane's name and the layout word.
  assert.equal(q(rb, '[data-pane="proposed"] .rb-pane-cap > strong').textContent, 'Proposed');
  unmount();
});

test('a press on the inset swaps the sides, and Both shows the two panes at equal size', () => {
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  q(rb, '[data-inset-art]').click();
  assert.equal(rb.compareSide, 'original');
  assert.equal(q(rb, '.rb-cmp').dataset.show, 'original');
  assert.equal(q(rb, '[data-inset-name]').textContent, 'Proposed', 'the inset now shows the other side');
  assert.ok(q(rb, '[data-pane="original"]').hasAttribute('data-on'));
  assert.ok(q(rb, '[data-pane="proposed"]').hasAttribute('inert'), 'the pane off screen takes no focus');
  q(rb, '.rb-cmp-seg [data-side="both"]').click();
  assert.equal(q(rb, '.rb-cmp').dataset.show, 'both');
  assert.equal(q(rb, '[data-inset]').hidden, true, 'Both has no inset');
  for (const pane of rb.els.compare.querySelectorAll<HTMLElement>('.rb-pane')) {
    assert.ok(pane.hasAttribute('data-on'), pane.dataset.pane ?? 'pane');
    assert.equal(pane.hasAttribute('inert'), false);
  }
  const css = rebrandCss();
  assert.match(css, /\.rb-cmp\[data-show="both"\] \.rb-cmp-panes \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  unmount();
});

test('the Original pane is drawn on idle while the Proposed shows, from the cache the hold then reads', async () => {
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  await idle();
  const svg = q(rb, '[data-pane="original"] [data-art] svg');
  assert.match(svg.getAttribute('aria-label') ?? '', /^Original: /, 'the Original is named for its pane');
  // Two levels, not one per size: every small picture shares the thumbnail string, and
  // the hero and every larger size share the full one.
  const faithful = rb.state.faithful;
  assert.ok(faithful);
  const frame = frameOfFirst(faithful);
  const edge = rb.compare.ladder().thumbnailLongEdge;
  const small = rb.compare.draw(faithful, frame, 96, false);
  const before = rb.compare.cacheInfo().entries;
  assert.equal(rb.compare.draw(faithful, frame, edge, false).svg, small.svg, 'one thumbnail string for every small size');
  const large = rb.compare.draw(faithful, frame, 1600, false);
  assert.equal(rb.compare.draw(faithful, frame, 0, false).svg, large.svg, 'one full string for the hero and every larger size');
  assert.equal(rb.compare.cacheInfo().entries, before, 'the full string is the one the pane already drew');
  assert.notEqual(small.svg, large.svg, 'the thumbnail leaves out what cannot be seen at its size');
  // Holding shows it at once, from the mounted string.
  const mounted = q(rb, '[data-pane="original"] [data-art]').innerHTML;
  rb.compare.hold(true);
  assert.equal(q(rb, '.rb-cmp').dataset.show, 'original');
  assert.equal(q(rb, '[data-pane="original"] [data-art]').innerHTML, mounted, 'nothing redrawn on the swap');
  rb.compare.hold(false);
  assert.equal(q(rb, '.rb-cmp').dataset.show, 'proposed');
  unmount();
});

// ─── hold to compare ─────────────────────────────────────────────────────────

test('a held pointer shows the Original after 250 ms, and a release restores it and swallows the click', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  loaded(rb);
  const art = q(rb, '[data-pane="proposed"] .rb-hero .rb-art');
  const shown = (): string => q(rb, '.rb-cmp').dataset.show ?? '';
  art.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
  t.mock.timers.tick(compare.HOLD_ARM_MS - 1);
  assert.equal(shown(), 'proposed', 'a slow click never flashes the Original');
  t.mock.timers.tick(1);
  assert.equal(shown(), 'original');
  assert.equal(q(rb, '.rb-cmp').dataset.held, 'true');
  assert.equal(q(rb, '.rb-cmp-seg [aria-pressed="true"]').textContent, 'Original', 'the segment reflects the hold');
  assert.equal(rb.compareSide, 'proposed', 'the chosen side stays');
  window.dispatchEvent(pointer('pointerup'));
  assert.equal(shown(), 'proposed');
  // The click that ends the hold is on the slide, and would select what is under it.
  const before = rb.sel.objectId;
  const target = rb.els.compare.querySelector<HTMLElement>('[data-pane="proposed"] .rb-ov');
  assert.ok(target);
  target.click();
  assert.equal(rb.sel.objectId, before, 'the click after a hold is not a pick');
  t.mock.timers.tick(500);
  target.click();
  assert.equal(rb.sel.objectId, target.dataset.object, 'the next click is');
  unmount();
});

test('a hold is cancelled by 6 px of movement, waits 300 ms on touch, starts on an object too, and ends on every end event', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  loaded(rb);
  const art = q(rb, '[data-pane="proposed"] .rb-hero .rb-art');
  const shown = (): string => q(rb, '.rb-cmp').dataset.show ?? '';
  // Movement past the slop before the arm fires reads as a scroll.
  art.dispatchEvent(pointer('pointerdown', { clientX: 100, clientY: 100 }));
  window.dispatchEvent(pointer('pointermove', { clientX: 100 + compare.HOLD_SLOP_PX + 1, clientY: 100 }));
  t.mock.timers.tick(1000);
  assert.equal(shown(), 'proposed', 'moved: no hold');
  // Touch waits longer.
  art.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10, pointerType: 'touch' }));
  t.mock.timers.tick(compare.HOLD_ARM_MS);
  assert.equal(shown(), 'proposed');
  t.mock.timers.tick(compare.TOUCH_ARM_MS - compare.HOLD_ARM_MS);
  assert.equal(shown(), 'original');
  window.dispatchEvent(pointer('pointercancel'));
  assert.equal(shown(), 'proposed', 'pointercancel restores');
  // Leaving the panes restores too.
  art.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
  t.mock.timers.tick(compare.HOLD_ARM_MS);
  assert.equal(shown(), 'original');
  q(rb, '.rb-cmp-panes').dispatchEvent(pointer('pointerleave', { bubbles: false }));
  assert.equal(shown(), 'proposed', 'pointerleave restores');
  // Escape restores.
  art.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
  t.mock.timers.tick(compare.HOLD_ARM_MS);
  assert.equal(shown(), 'original');
  keydown('Escape');
  assert.equal(shown(), 'proposed', 'Escape restores');
  // Objects can cover the whole slide (a picture deck), so a press on one arms too: a
  // press shorter than the arm is still the pick, a longer one the hold.
  const object = rb.els.compare.querySelector<HTMLElement>('[data-pane="proposed"] .rb-ov');
  assert.ok(object);
  object.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
  t.mock.timers.tick(compare.HOLD_ARM_MS - 1);
  window.dispatchEvent(pointer('pointerup'));
  assert.equal(shown(), 'proposed', 'a short press never flashes the Original');
  object.click();
  assert.equal(rb.sel.objectId, object.dataset.object, 'and is the pick');
  const again = rb.els.compare.querySelector<HTMLElement>('[data-pane="proposed"] .rb-ov');
  assert.ok(again);
  again.dispatchEvent(pointer('pointerdown', { clientX: 10, clientY: 10 }));
  t.mock.timers.tick(compare.HOLD_ARM_MS);
  assert.equal(shown(), 'original', 'a long press on an object is the hold');
  window.dispatchEvent(pointer('pointerup'));
  assert.equal(shown(), 'proposed');
  t.mock.timers.tick(1000);
  unmount();
});

test('holding the backslash key shows the Original until it is released, or until the window loses focus', () => {
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  keydown('\\');
  assert.equal(q(rb, '.rb-cmp').dataset.show, 'original');
  document.body.dispatchEvent(new window.KeyboardEvent('keyup', { key: '\\', bubbles: true }));
  assert.equal(q(rb, '.rb-cmp').dataset.show, 'proposed');
  // A key-up that never arrives (the window lost focus while the key was down).
  keydown('\\');
  assert.equal(q(rb, '.rb-cmp').dataset.show, 'original');
  window.dispatchEvent(new window.Event('blur'));
  assert.equal(q(rb, '.rb-cmp').dataset.show, 'proposed', 'the window losing focus lets go');
  unmount();
});

// ─── the caption's states ────────────────────────────────────────────────────

test('the proposed pane says Updating while the preview is stale', () => {
  const { rb, unmount } = mount(stateFrom(RUN.plan, { previewStale: true }));
  const busy = q(rb, '[data-busy]');
  assert.equal(busy.hidden, false);
  assert.equal(busy.textContent, 'Updating');
  rb.state = { ...rb.state, previewStale: false, tick: 2 };
  rb.render();
  assert.equal(busy.hidden, true);
  unmount();
});

test('a slow recompile is said once through the live region, and a quick one not at all', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { rb, said, unmount } = mount(stateFrom());
  const stale = (on: boolean, tick: number): void => {
    rb.state = { ...rb.state, previewStale: on, tick };
    rb.render();
  };
  stale(true, 2);
  t.mock.timers.tick(compare.STALE_SAY_MS - 1);
  stale(false, 3);
  t.mock.timers.tick(5000);
  assert.deepEqual(said.filter((one) => one.startsWith('Updating')), [], 'a quick edit is heard as its outcome only');
  stale(true, 4);
  t.mock.timers.tick(compare.STALE_SAY_MS);
  stale(true, 5);
  t.mock.timers.tick(5000);
  assert.deepEqual(said.filter((one) => one.startsWith('Updating')), ['Updating the proposed slides.'], 'once per stale period, not per tick');
  unmount();
});

test('a slide with every object removed says so inside its frame and offers Keep as a picture', () => {
  const { rb, calls, unmount } = mount(stateFrom());
  rb.controller.setArrangement = async (...args: unknown[]) => {
    calls.push({ name: 'setArrangement', args });
    return { ok: true, touched: 1, skipped: 0 };
  };
  onFirstSlide(rb);
  const derived = rb.derived;
  assert.ok(derived);
  for (const object of firstSlide().objects) derived.objects.set(object.id, { ...objectOf(rb, object.id), action: 'remove' });
  rb.memo.compare = '';
  rb.compare.render();
  const empty = q(rb, '[data-pane="proposed"] .rb-empty');
  const n = firstSlide().objects.length;
  assert.equal(empty.querySelector('p')?.textContent, n === 1 ? 'Nothing kept on this slide. 1 object was removed.' : `Nothing kept on this slide. ${n} objects were removed.`);
  const keep = empty.querySelector<HTMLElement>('[data-keep-picture]');
  assert.equal(keep?.textContent, 'Keep as a picture');
  unmount();
});

test('a box whose text runs past it gives the caption and the cut-off idiom on that box', () => {
  const preview = structuredClone(RUN.compiled);
  const frame = frameOfFirst(preview);
  const text = frame.layers.find((row) => row.kind === 'text' && String(row.text ?? '').trim().split(/\s+/).length > 3);
  assert.ok(text, 'slide 1 has a text box with a few words');
  // Squeeze it to one line, so the estimate cuts words off.
  text.h = Number(text.fontSize ?? 20) * 1.3;
  text.w = Number(text.fontSize ?? 20) * 6;
  preview.report.entries.push({ code: 'text.overflow', message: 'x', layerId: String(text.id), slideId: firstSlide().id });
  const { rb, unmount } = mount(stateFrom(RUN.plan, { preview: { deck: preview, planRevision: RUN.plan.revision } }));
  onFirstSlide(rb);
  const note = q(rb, '[data-pane="proposed"] [data-note]');
  assert.equal(note.textContent, 'Text is cut off in 1 box');
  assert.equal(note.dataset.tone, 'danger');
  assert.ok(note.querySelector('svg'), 'with the alert glyph, so the signal is not colour alone');
  const cut = q(rb, `[data-pane="proposed"] .rb-cut[data-cut="${String(text.id)}"]`);
  assert.match(cut.querySelector('.rb-cut-count')?.textContent ?? '', /^(1 word|\d+ words) cut$/);
  assert.equal(cut.closest('.rb-cuts')?.getAttribute('aria-hidden'), 'true');
  assert.deepEqual(rb.compare.cutOff(firstSlide().id).map((one) => one.layerId), [String(text.id)]);
  // The count is the engine's Design layout, the one the preview draws, and the band sits
  // at the edge Design clips: the foot of a top-aligned box, both ends of a centred one.
  const [only] = rb.compare.cutOff(firstSlide().id);
  assert.equal(only?.words, Math.max(1, designTextFit(text).wordsCut));
  const valign = String(text.valign ?? '');
  assert.equal(cut.dataset.edge, valign === 'top' ? 'bottom' : valign === 'bottom' ? 'top' : 'both');
  unmount();
});

test('a slide left out says so, and its picture is dimmed', () => {
  const plan: RenovationPlanV1 = { ...RUN.plan, slides: RUN.plan.slides.map((one, i) => (i === 0 ? { ...one, include: false } : one)) };
  const { rb, unmount } = mount(stateFrom(plan));
  onFirstSlide(rb);
  assert.equal(q(rb, '[data-pane="proposed"] [data-note]').textContent, 'Left out');
  assert.ok(rb.els.compare.querySelector('[data-pane="proposed"] .rb-frame[data-left-out]'));
  assert.match(rebrandCss(), /\.rb-frame\[data-left-out\] \.rb-art \{ opacity: \.5; \}/);
  unmount();
});

test('the Proposed waits for the design system faces, and draws in them', () => {
  const system = stateFrom().designSystem;
  assert.ok(system);
  const faces = { ...system, fonts: ['Poppins', 'Fira Code'] };
  // `fontsReady` is the controller's (close-out CP11); the stage reads it when present.
  const waiting: RebrandStateV1 = Object.assign(stateFrom(RUN.plan, { designSystem: faces }), { fontsReady: false });
  const { rb, unmount } = mount(waiting);
  onFirstSlide(rb);
  assert.deepEqual(rb.compare.fonts(), { brand: 'Poppins', mono: 'Fira Code' });
  assert.equal(rb.els.compare.querySelector('[data-pane="proposed"] .rb-hero svg'), null, 'no fallback face drawn first');
  assert.equal(q(rb, '[data-pane="proposed"] [data-note]').textContent, 'Preparing');
  rb.state = Object.assign({ ...rb.state, tick: 2 }, { fontsReady: true });
  rb.render();
  const svg = q(rb, '[data-pane="proposed"] .rb-hero svg');
  assert.match(svg.outerHTML, /Poppins/, 'the brand face');
  unmount();
});

// ─── the part pager ──────────────────────────────────────────────────────────

test('a slide that continues carries the part pager, which swaps the hero to the next part', () => {
  const slide = firstSlide();
  const preview = deckWithSurplus([]);
  const { rb, unmount } = mount(stateFrom(RUN.plan, { preview }));
  onFirstSlide(rb);
  const parts = preview?.deck.frames.filter((frame) => frame.sourceSlideId === slide.id) ?? [];
  assert.ok(parts.length >= 2);
  const pager = q(rb, '[data-part]');
  assert.equal(pager.hidden, false);
  assert.equal(q(rb, '[data-part-name]').textContent, `Part 1 of ${parts.length}`);
  assert.ok(pager.querySelector('[data-part-art] svg'), 'the next part as a thumbnail');
  assert.equal(q(rb, '[data-pane="proposed"] [data-frame]').dataset.frame, parts[0]?.id);
  pager.click();
  assert.equal(q(rb, '[data-part-name]').textContent, `Part 2 of ${parts.length}`);
  assert.equal(q(rb, '[data-pane="proposed"] [data-frame]').dataset.frame, parts[1]?.id);
  // A slide in one part has no pager.
  const other = RUN.deck.slides.find((one) => one.id !== slide.id && (preview?.deck.frames.filter((f) => f.sourceSlideId === one.id).length ?? 0) === 1);
  assert.ok(other);
  rb.select({ slideId: other.id, objectId: null, itemId: null });
  assert.equal(q(rb, '[data-part]').hidden, true);
  unmount();
});

// ─── the overlay ─────────────────────────────────────────────────────────────

test('the overlay carries one button per object on the Original slide', () => {
  const { rb, unmount } = mount(stateFrom());
  const slide = RUN.deck.slides.find((one) => one.id === rb.sel.slideId);
  assert.ok(slide);
  const buttons = rb.els.compare.querySelectorAll<HTMLElement>('[data-pane="original"] .rb-ov');
  assert.equal(buttons.length, slide.objects.length);
  const selected = rb.els.compare.querySelector<HTMLElement>('[data-pane="original"] .rb-ov[aria-current="true"]');
  assert.equal(selected?.dataset.object, rb.sel.objectId);
  unmount();
});

test('a real click on an object of the Proposed overlay selects it, its slide and its queue item', () => {
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  const known = new Set(firstSlide().objects.map((object) => object.id));
  const other = [...rb.els.compare.querySelectorAll<HTMLElement>('[data-pane="proposed"] .rb-ov')].find((button) => known.has(button.dataset.object ?? ''));
  assert.ok(other, 'the proposed slide has a pickable object');
  const objectId = other.dataset.object ?? '';
  other.dispatchEvent(pointer('pointerdown'));
  other.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
  other.focus();
  window.dispatchEvent(pointer('pointerup'));
  other.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }));
  other.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(rb.sel.objectId, objectId, 'the clicked object is selected');
  assert.equal(rb.sel.slideId, rb.derived?.objects.get(objectId)?.slideId);
  assert.equal(rb.sel.itemId, rb.derived?.itemOfObject.get(objectId) ?? null);
  assert.ok(rb.els.compare.querySelector(`[data-pane="proposed"] .rb-outline`), 'its outline on the Proposed');
  assert.equal(rb.els.compare.querySelector<HTMLElement>('[data-pane="original"] .rb-ov[aria-current="true"]')?.dataset.object, objectId, 'and on the Original');
  assert.equal(rb.els.decide.querySelector<HTMLElement>('.rb-obj[aria-current="true"]')?.dataset.object, objectId, 'the decision column follows');
  assert.equal(rb.compareSide, 'proposed', 'a click on an object is not a pane switch');
  unmount();
});

test('on a narrow screen a tap on an overlay object selects it and opens the sheet, and the pane shown stays', () => {
  for (const side of ['proposed', 'original'] as const) {
    const { rb, unmount } = mount(stateFrom(), { narrow: true });
    rb.compareSide = side;
    rb.memo.compare = '';
    rb.render();
    assert.equal(q(rb, '[data-inset]').hidden, true, 'a phone has no inset');
    const known = new Set(firstSlide().objects.map((object) => object.id));
    const other = [...rb.els.compare.querySelectorAll<HTMLElement>(`[data-pane="${side}"] .rb-ov`)]
      .find((button) => button.dataset.object !== rb.sel.objectId && known.has(button.dataset.object ?? ''));
    assert.ok(other, side);
    other.click();
    assert.equal(rb.sel.objectId, other.dataset.object);
    assert.equal(rb.els.decide.dataset.sheet, 'open', 'the sheet opens on that object');
    assert.equal(rb.compareSide, side, 'the pane shown stays');
    unmount();
  }
});

test('an empty text slot is a hatched target that selects the empty box, and the head can name it', () => {
  const preview = structuredClone(RUN.compiled);
  const frame = frameOfFirst(preview);
  const head = frame.layers[0];
  const slot = frame.layers.find((row) => row !== head && row.kind === 'text' && typeof row.role === 'string' && row.role && !frame.furnitureLayerIds.includes(String(row.id)));
  assert.ok(slot, 'slide 1 has a text slot');
  slot.text = '';
  slot.role = 'title';
  const { rb, unmount } = mount(stateFrom(RUN.plan, { preview: { deck: preview, planRevision: RUN.plan.revision } }));
  onFirstSlide(rb);
  const ph = q(rb, `[data-pane="proposed"] .rb-ph[data-ph="${String(slot.id)}"]`);
  assert.ok(ph.hasAttribute('data-slot'), 'hatched by the overlay, since the drawing does not');
  assert.equal(ph.getAttribute('aria-label'), 'Empty title');
  ph.click();
  assert.deepEqual(rb.compare.placeholder(), { slideId: firstSlide().id, layerId: String(slot.id), name: 'Empty title' });
  assert.equal(rb.sel.objectId, null);
  assert.equal(q(rb, `.rb-ph[data-ph="${String(slot.id)}"]`).getAttribute('aria-current'), 'true');
  // A pick elsewhere lets go of it.
  const object = rb.els.compare.querySelector<HTMLElement>('[data-pane="proposed"] .rb-ov');
  object?.click();
  assert.equal(rb.compare.placeholder(), null);
  unmount();
});

test('a row with focus or a pointer in the decision column outlines its object on both panes', () => {
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  loaded(rb);
  const deck = rb.state.preview?.deck;
  assert.ok(deck);
  const rows = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-obj[data-object]')];
  const row = rows.find((one) => rb.compare.layersOf(deck, one.dataset.object ?? '').length > 0);
  assert.ok(row, 'an object in the list reached the proposed slide');
  const objectId = row.dataset.object ?? '';
  row.dispatchEvent(new window.MouseEvent('pointerover', { bubbles: true }));
  const hinted = (side: string): string[] => [...rb.els.compare.querySelectorAll<HTMLElement>(`[data-pane="${side}"] .rb-ov[data-hint]`)].map((b) => b.dataset.object ?? '');
  // On the Proposed its button when it has one, else its layers outlined through the lineage.
  const proposedHint = (): number => rb.els.compare.querySelectorAll(`[data-pane="proposed"] .rb-ov[data-hint], [data-pane="proposed"] .rb-outline[data-hint]`).length;
  assert.deepEqual(hinted('original'), [objectId]);
  assert.ok(proposedHint() > 0, 'outlined on the Proposed too');
  row.dispatchEvent(new window.MouseEvent('pointerout', { bubbles: true, relatedTarget: null }));
  assert.deepEqual(hinted('original'), []);
  assert.equal(proposedHint(), 0);
  // A row whose object has a button of its own on the Proposed rings that button.
  const withButton = rows.find((one) => rb.els.compare.querySelector(`[data-pane="proposed"] .rb-ov[data-object="${one.dataset.object ?? ''}"]`));
  assert.ok(withButton);
  withButton.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
  assert.deepEqual(hinted('proposed'), [withButton.dataset.object]);
  withButton.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
  assert.deepEqual(hinted('proposed'), []);
  unmount();
});

// ─── the tray ────────────────────────────────────────────────────────────────

test('the tray lists what was not placed, each row with its crop, and a row selects its object', () => {
  const slide = firstSlide();
  const [a, b] = slide.objects.map((object) => object.id);
  assert.ok(a && b);
  const { rb, unmount } = mount(stateFrom(RUN.plan, { preview: deckWithSurplus([a, b]) }));
  onFirstSlide(rb);
  const tray = q(rb, '[data-pane="proposed"] [data-unplaced-list]');
  assert.equal(tray.hidden, false);
  assert.equal(tray.querySelector('.rb-tray-head')?.textContent, 'Not placed (2)');
  const rows = [...tray.querySelectorAll<HTMLElement>('.rb-tray-row[data-unplaced]')];
  assert.deepEqual(rows.map((row) => row.dataset.unplaced), [a, b]);
  for (const row of rows) {
    const svg = row.querySelector('.rb-tray-crop svg');
    assert.ok(svg, 'a crop, not a glyph');
    assert.match(svg.getAttribute('viewBox') ?? '', /^[\d.-]+ [\d.-]+ [\d.]+ [\d.]+$/);
    assert.ok(row.querySelector('.rb-tray-name')?.textContent, 'with its noun');
  }
  rows[1]?.click();
  assert.equal(rb.sel.objectId, b, 'a row selects its source object');
  assert.equal(rb.els.decide.querySelector<HTMLElement>('.rb-obj[aria-current="true"]')?.dataset.object, b);
  unmount();
});

// ─── the drawing cache and the crops ─────────────────────────────────────────

test('a crop is the slide string with a viewBox of its own, and the options return the whole slide with the box outlined', () => {
  const { rb, unmount } = mount(stateFrom());
  onFirstSlide(rb);
  const slide = firstSlide();
  const object = [...slide.objects].sort((x, y) => x.box.w * x.box.h - y.box.w * y.box.h)[0];
  assert.ok(object);
  const plain = rb.compare.crop(object.id, 16 / 9);
  const view = (svg: string): number[] => (/viewBox="([^"]+)"/.exec(svg)?.[1] ?? '').split(' ').map(Number);
  const [, , w, h] = view(plain.svg);
  assert.ok(w && h && Math.abs(w / h - 16 / 9) < 0.02, 'the region widened to the asked ratio');
  assert.doesNotMatch(plain.svg, /rb-crop-mark/);
  assert.match(plain.svg, /^<svg[^>]* aria-hidden="true"/, 'a crop is a picture, never a second name');
  const faithful = rb.state.faithful;
  assert.ok(faithful);
  const frame = frameOfFirst(faithful);
  const outlined = rb.compare.crop(object.id, 16 / 9, { slide: true, outline: true });
  assert.deepEqual(view(outlined.svg), [0, 0, frame.width, frame.height], 'the whole slide');
  assert.equal((outlined.svg.match(/<rect class="rb-crop-mark"/g) ?? []).length, 1, 'one appended outline');
  // Both came from the one cached slide string: the body after the root tag is the same.
  const body = (svg: string): string => svg.replace(/^<svg[^>]*>/, '').replace(/<rect class="rb-crop-mark"[^>]*\/><\/svg>$/, '</svg>');
  assert.equal(body(plain.svg), body(outlined.svg));
  assert.deepEqual(rb.compare.crop('no-such-object', 1), { svg: '', missing: false });
  unmount();
});

test('the cache is bounded by string bytes, not a count, so a 40-slide report does not evict the strip', () => {
  const { rb, unmount } = mount(stateFrom());
  const deck = rb.state.preview?.deck;
  assert.ok(deck);
  const strip = deck.frames.map((frame) => rb.compare.draw(deck, frame, 200, true).svg);
  // Forty report thumbnails and a hundred crops of other decks' frames.
  const other = structuredClone(deck);
  const base = other.frames[0];
  assert.ok(base);
  other.frames = Array.from({ length: 140 }, (_, i) => ({ ...base, id: `${base.id}.r${i}` }));
  for (const frame of other.frames) rb.compare.draw(other, frame, 96, true);
  const info = rb.compare.cacheInfo();
  assert.ok(info.bytes <= info.budget);
  assert.ok(info.entries >= deck.frames.length + other.frames.length, 'no count cap');
  const before = info.entries;
  deck.frames.forEach((frame, i) => { assert.equal(rb.compare.draw(deck, frame, 200, true).svg, strip[i]); });
  assert.equal(rb.compare.cacheInfo().entries, before, 'every strip drawing is still cached');
  unmount();
});

test('the cache evicts the oldest drawings once the strings pass the phone budget', () => {
  const { rb, unmount } = mount(stateFrom(), { narrow: true });
  const deck = structuredClone(RUN.compiled);
  const base = deck.frames[0];
  assert.ok(base);
  const long = 'word '.repeat(4000);
  deck.frames = Array.from({ length: 40 }, (_, i) => ({
    ...base,
    id: `${base.id}.big${i}`,
    layers: [...base.layers, { id: `big${i}`, kind: 'text', x: 0, y: 0, w: 10, h: 10, text: long }],
  }));
  const [first, ...rest] = deck.frames;
  assert.ok(first);
  const one = rb.compare.draw(deck, first, 96, true).svg.length * 2;
  const count = Math.ceil(compare.DRAW_BUDGET_BYTES_NARROW / one) + 2;
  assert.ok(count <= deck.frames.length, `${one} bytes a drawing`);
  for (const frame of rest.slice(0, count - 1)) rb.compare.draw(deck, frame, 96, true);
  const info = rb.compare.cacheInfo();
  assert.equal(info.budget, compare.DRAW_BUDGET_BYTES_NARROW);
  assert.ok(info.bytes <= info.budget, `${info.bytes} within ${info.budget}`);
  assert.ok(info.bytes > info.budget - one * 2, 'filled close to the budget, not emptied');
  unmount();
});

// ─── a slide rebuilt from its picture ────────────────────────────────────────

test('a slide rebuilt from its picture shows the picture as Original, never a drawing of the rebuilt objects', async () => {
  const { state, ref, slideId } = pictureDeckState();
  const { rb, unmount } = mount(state);
  rb.select({ slideId, objectId: null, itemId: null });
  rb.compareSide = 'original';
  rb.memo.compare = '';
  rb.render();
  const art = (): HTMLElement => q(rb, '[data-pane="original"] [data-art]');
  // The controller has not loaded the picture yet: a placeholder that says so, not the rebuilt render.
  assert.equal(art().querySelector('svg'), null, 'no drawing of the rebuilt objects while the picture loads');
  assert.equal(art().querySelector('.rb-art-wait')?.textContent, 'The picture is loading.');
  assert.ok('wait' in art().dataset);

  const asked: string[] = [];
  rb.controller.mediaHref = (one: string) => {
    asked.push(one);
    return one === ref ? 'blob:https://lolly.test/slide-1' : undefined;
  };
  rb.state = { ...rb.state, tick: 2 };
  rb.render();
  assert.ok(asked.includes(ref), 'the picture is asked for through mediaHref');
  const img = art().querySelector<HTMLImageElement>('img.rb-art-pic');
  assert.ok(img, 'the untouched picture is drawn');
  assert.equal(img.getAttribute('src'), 'blob:https://lolly.test/slide-1');
  assert.equal(img.getAttribute('alt'), 'The original picture of slide 1');
  assert.equal(art().querySelector('svg'), null);
  assert.equal('wait' in art().dataset, false);

  const slide = state.source?.slides.find((one) => one.id === slideId);
  const count = slide?.objects.length ?? 0;
  const note = rb.els.compare.querySelector('[data-pane="original"] [data-note]')?.textContent;
  assert.equal(note, count === 1 ? '1 object read from the picture' : `${count} objects read from the picture`);
  // The rebuilt objects are still there to pick, one button each, over the picture.
  assert.equal(rb.els.compare.querySelectorAll('[data-pane="original"] .rb-ov').length, count);
  assert.equal(rb.els.decide.querySelectorAll('.rb-objs .rb-obj[data-object]').length, count);
  unmount();
});

test('clicking an object on the picture selects the rebuilt object, and its lineage outline follows on Proposed', () => {
  const { state, slideId } = pictureDeckState();
  const { rb, unmount } = mount(state);
  rb.controller.mediaHref = () => 'blob:https://lolly.test/slide-1';
  rb.select({ slideId, objectId: null, itemId: null });
  rb.compareSide = 'both';
  rb.memo.compare = '';
  rb.render();
  const deck = rb.state.preview?.deck;
  assert.ok(deck);
  const buttons = [...rb.els.compare.querySelectorAll<HTMLElement>('[data-pane="original"] .rb-ov')];
  const mapped = buttons.find((button) => rb.compare.layersOf(deck, button.dataset.object ?? '').length > 0);
  assert.ok(mapped, 'an object on the picture reached the proposed slide');
  mapped.click();
  assert.equal(rb.sel.objectId, mapped.dataset.object, 'the click selects the rebuilt object');
  const current = rb.els.compare.querySelector<HTMLElement>('[data-pane="original"] .rb-ov[aria-current="true"]');
  assert.equal(current?.dataset.object, mapped.dataset.object, 'the picture carries its selection outline');
  assert.ok(rb.els.compare.querySelectorAll('[data-pane="proposed"] .rb-outline').length > 0, 'the lineage outline shows on Proposed');
  assert.ok(rb.els.compare.querySelector('[data-pane="original"] img.rb-art-pic'), 'the picture stays after a selection');
  unmount();
});

test('a picture slide kept as it was: Proposed has one target per object, at its place in the picture', () => {
  const { state, slideId } = pictureDeckState();
  const plan: RenovationPlanV1 = { ...RUN.plan, slides: RUN.plan.slides.map((one) => (one.id === slideId ? { ...one, arrangement: 'picture' } : one)) };
  const source = state.source;
  assert.ok(source);
  const compiled = compileRenovated({ source, census: RUN.census, plan, master: STARTER_MASTER, designSystem: STARTER_COMPILE_SYSTEM });
  const { rb, unmount } = mount({ ...state, plan, preview: { deck: compiled, planRevision: plan.revision } });
  rb.controller.mediaHref = () => 'blob:https://lolly.test/slide-1';
  rb.select({ slideId, objectId: null, itemId: null });
  const slide = source.slides.find((one) => one.id === slideId);
  assert.ok(slide);
  const proposed = [...rb.els.compare.querySelectorAll<HTMLElement>('[data-pane="proposed"] .rb-ov')];
  assert.equal(proposed.length, slide.objects.length, 'one target per object, not one over the whole slide');
  assert.deepEqual(new Set(proposed.map((button) => button.dataset.object)), new Set(slide.objects.map((one) => one.id)));
  const small = [...slide.objects].sort((a, b) => a.box.w * a.box.h - b.box.w * b.box.h)[0];
  assert.ok(small);
  const target = proposed.find((button) => button.dataset.object === small.id);
  assert.ok(target);
  assert.notEqual(target.style.getPropertyValue('--w'), '100%');
  target.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  assert.equal(rb.sel.objectId, small.id);
  const outlines = [...rb.els.compare.querySelectorAll<HTMLElement>('[data-pane="proposed"] .rb-outline')];
  assert.equal(outlines.length, 1);
  assert.equal(outlines[0]?.style.getPropertyValue('--w'), target.style.getPropertyValue('--w'), 'the outline is the object, not the whole picture');
  unmount();
});

// ─── wording ─────────────────────────────────────────────────────────────────

test('the Original line says what was read with the numbers in it, never the Proposed sentence', () => {
  const deck = structuredClone(RUN.deck);
  const slide = deck.slides[0];
  assert.ok(slide);
  const { rb, unmount } = mount(stateFrom(RUN.plan, { source: deck }));
  rb.select({ slideId: slide.id, objectId: null, itemId: null });
  const derived = rb.derived;
  assert.ok(derived);
  const [first, ...rest] = slide.objects;
  assert.ok(first);
  derived.objects.set(first.id, { ...objectOf(rb, first.id), fidelity: 'picture' });
  for (const object of rest) derived.objects.set(object.id, { ...objectOf(rb, object.id), fidelity: 'editable' });
  rb.memo.compare = '';
  rb.compare.render();
  const n = slide.objects.length;
  assert.equal(q(rb, '[data-inset-note]').textContent, `${n} objects, 1 picture`);
  assert.equal(q(rb, '[data-pane="original"] [data-note]').textContent, `${n} objects, 1 picture`);
  // A Proposed slide that is fine says nothing.
  assert.equal(q(rb, '[data-pane="proposed"] [data-note]').textContent, '');
  unmount();
});

test('an object with no words to show says where it is on the slide', () => {
  assert.equal(compare.placeOnSlide({ x: 900, y: 10, w: 40, h: 20 }, 1000, 600), 'Top right');
  assert.equal(compare.placeOnSlide({ x: 450, y: 280, w: 100, h: 40 }, 1000, 600), 'Middle');
  assert.equal(compare.placeOnSlide({ x: 0, y: 560, w: 50, h: 30 }, 1000, 600), 'Bottom left');
  assert.equal(compare.placeOnSlide({ x: 0, y: 0, w: 1, h: 1 }, 0, 0), '');
});

// ─── the stylesheet ──────────────────────────────────────────────────────────

test('the stage sheet: the hero follows its pane through --rb-ratio, and is the one elevated object', () => {
  const sheet = compareCss();
  const rule = (selector: string): string => {
    const at = sheet.indexOf(`${selector} {`);
    assert.ok(at >= 0, selector);
    return sheet.slice(at, sheet.indexOf('}', at));
  };
  // Sized to the pane, never to fixed pixels.
  assert.match(rule('  .rb-pane'), /container: rb-pane \/ size;/);
  assert.match(rule('  .rb-pane'), /--rb-hero-w: min\(100cqw, \(100cqh - var\(--rb-cap-h\) - var\(--sp-4\) - var\(--rb-tray-h\)\) \* var\(--rb-ratio, 1\.7778\)\);/);
  assert.match(rule('  .rb-cell'), /width: var\(--rb-hero-w\);/);
  assert.match(rule('  .rb-pane-cap'), /width: var\(--rb-hero-w\);/);
  assert.match(rule('  .rb-stage'), /aspect-ratio: var\(--rb-ratio, 16 \/ 9\);/);
  assert.doesNotMatch(sheet, /100cqh - 99px/, 'the fixed-row formula is withdrawn');
  // One elevated object: the elevation token appears on the hero rule alone.
  const elevated = [...sheet.matchAll(/([^{}]+)\{[^}]*--ui-elevation-control[^}]*\}/g)].map((m) => m[1]?.trim());
  assert.deepEqual(elevated, ['.rb-hero,\n  .rb-lc-preview .rb-frame:not(.rb-frame--more) > .rb-stage']);
  assert.match(rule('  .rb-hero,\n  .rb-lc-preview .rb-frame:not(.rb-frame--more) > .rb-stage'), /-webkit-touch-callout: none;[\s\S]*user-select: none;/);
  assert.match(sheet, /\[data-theme="dark"\] \.rb-hero::after,\s*\[data-theme="brand"\] \.rb-hero::after \{ box-shadow: var\(--ui-edge-strong\); \}/);
  // No dashed border or outline, and no fixed hero size.
  assert.doesNotMatch(sheet, /(?:border|outline)[a-z-]*:[^;]*dashed/);
  // The segment's track is edged on the stage's surface.
  assert.match(rule('  .rb-cmp-seg'), /box-shadow: var\(--ui-edge-faint\);/);
  // Reduced motion stops the crossfade.
  assert.match(sheet, /html\[data-a11y-motion="reduce"\] :is\(\.rb-pane,.*\) \{ transition: none; \}/);
});

test('the overlay has no fill and no stroke at rest, a faint ring on hover, a full ring when selected, and focus outside it', () => {
  const sheet = compareCss();
  const at = sheet.indexOf('  .rb-ov,\n  .rb-ph {');
  assert.ok(at >= 0);
  const rest = sheet.slice(at, sheet.indexOf('}', at));
  assert.match(rest, /border: 0;/);
  assert.match(rest, /background: none;/);
  assert.match(rest, /outline: 2px solid transparent;/);
  assert.match(rest, /left: clamp\(12px, var\(--x\), 100% - 12px\);/);
  assert.match(rest, /top: clamp\(12px, var\(--y\), 100% - 12px\);/);
  assert.match(rest, /min-width: 24px;/);
  // Hover only where a pointer hovers: on touch :hover sticks to the last object tapped.
  assert.match(sheet, /@media \(hover: hover\) \{\s*\.rb-ov:hover,\s*\.rb-ph:hover \{ outline-color: color-mix\(in srgb, var\(--ui-color-selection-border\) 45%, transparent\); \}/);
  assert.equal((sheet.match(/\.rb-ov:hover/g) ?? []).length, 1, 'no unguarded hover rule');
  assert.match(sheet, /\.rb-ov\[data-hint\] \{ outline-color: color-mix\(in srgb, var\(--ui-color-selection-border\) 45%/);
  assert.match(sheet, /\.rb-ov\[aria-current="true"\],\s*\.rb-ph\[aria-current="true"\] \{ outline-color: var\(--ui-color-selection-border\); \}/, 'the full ring');
  // Its halo sits outside the ring only (inset -4px is the ring's outer edge), never inside it.
  assert.match(sheet, /\.rb-ov\[aria-current="true"\]::after,\s*\.rb-ph\[aria-current="true"\]::after \{[^}]*inset: -4px;[^}]*outline: 1px solid var\(--ui-color-surface-raised\);/);
  assert.doesNotMatch(sheet, /filter: drop-shadow/, 'no halo on both sides of the ring');
  assert.match(sheet, /\.rb-ov:active,\s*\.rb-ph:active \{\s*outline-color: var\(--ui-color-action-primary\);/);
  assert.match(sheet, /\.rb-ov:focus-visible::before,\s*\.rb-ph:focus-visible::before \{[^}]*inset: -7px;[^}]*var\(--ui-color-focus-ring\)/);
  // The cut-off idiom is a band with a count, a different shape from the ring, both hung
  // at the box's clipped edge and outside it, so neither covers a drawn word.
  assert.match(sheet, /\.rb-cut::after \{[^}]*top: 100%;[^}]*height: var\(--rb-cut-band\);[^}]*background: var\(--ui-color-status-danger\);/);
  assert.match(sheet, /\.rb-cut-count \{[^}]*top: calc\(100% \+ var\(--rb-cut-band\)\);/);
  assert.match(sheet, /\.rb-art\[data-wait\] \{[^}]*background: var\(--ui-color-surface-muted\)/);
});

test('on a phone the segment stands alone, and one layout row under the slide opens the sheet or the chooser', () => {
  const base = stateFrom();
  assert.ok(base.designSystem);
  const withMaster = stateFrom(RUN.plan, { designSystem: { ...base.designSystem, neutralMaster: true } });
  const { rb, unmount } = mount(withMaster, { narrow: true });
  onFirstSlide(rb);
  rb.memo.compare = '';
  rb.compare.render();
  assert.equal(rb.els.compare.querySelector('[data-settings]'), null, 'no settings pill beside the segment');
  const row = q(rb, '[data-layout-row]');
  assert.equal(row.hidden, false);
  const name = q(rb, '[data-layout-name]').textContent ?? '';
  assert.ok(name.length > 0, 'the layout is named');
  assert.match(q(rb, '[data-layout-flag]').textContent ?? '', /^(Suggested|Yours|By the rule|Set by Auto-match|Set by the preset)$/);
  const open = q(rb, '[data-layout-open]');
  assert.equal(open.getAttribute('aria-haspopup'), 'dialog');
  assert.ok((open.getAttribute('aria-label') ?? '').startsWith(name), 'its name starts with the words on screen');
  const change = q(rb, '[data-layout-change]');
  assert.equal(change.textContent, 'Change');
  assert.ok(change.querySelector('svg'), 'the arrow of a door that opens a surface');
  open.click();
  assert.equal(rb.decide.sheetOpen(), true, 'the row opens the slide sheet');
  unmount();
  // Wider than a phone the decision column says the same, so the row is hidden.
  const wide = mount(withMaster);
  onFirstSlide(wide.rb);
  assert.equal(q(wide.rb, '[data-layout-row]').hidden, true);
  wide.unmount();
});

test('a box whose text is cut off says so in its object\'s name, and a rebuilt slide says nothing about rough drawing', () => {
  const { rb, unmount } = mount(stateFrom());
  const deck = rb.state.preview?.deck;
  assert.ok(deck);
  // The first text layer that belongs to an object on the first slide, reported as cut off.
  const slide = firstSlide();
  const frame = deck.frames.find((one) => one.sourceSlideId === slide.id);
  assert.ok(frame);
  const owners = new Map(deck.lineage.backward.filter((edge) => !edge.derived).map((edge) => [edge.layerId, edge.sourceObjectIds[0]]));
  const layer = frame.layers.find((row) => row.kind === 'text' && owners.has(String(row.id)));
  assert.ok(layer);
  const cut: CompiledDeckV1 = { ...deck, report: { ...deck.report, entries: [...deck.report.entries, { code: 'text.overflow', layerId: String(layer.id), message: '' } as CompiledDeckV1['report']['entries'][number]] } };
  rb.state = { ...rb.state, preview: { deck: cut, planRevision: rb.state.plan?.revision ?? 0 } };
  onFirstSlide(rb);
  rb.memo.compare = '';
  rb.compare.render();
  const owner = owners.get(String(layer.id));
  const button = rb.els.compare.querySelector<HTMLElement>(`[data-pane="proposed"] .rb-ov[data-object="${owner}"]`);
  assert.ok(button);
  assert.match(button.getAttribute('aria-label') ?? '', /, text cut off, \d+ words?$/);
  unmount();
});
