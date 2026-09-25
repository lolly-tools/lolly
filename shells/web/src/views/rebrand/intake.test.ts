// SPDX-License-Identifier: MPL-2.0
/**
 * The #/rebrand intake (plan 274 section 4; plan 275 close-out sections 2.1, 2.5 and
 * 3.2) against the real modules: the heading, the design system line, the mode segment
 * with its one help line, the drop area, the one reading surface, errors, readiness,
 * several decks at once, presets, the recent projects with thumbnails and their menu,
 * and a deck of slide pictures offered in the notice band.
 *
 * The state is built from the committed samples (tests/fixtures/rebrand/samples) and
 * the engine's review model over `StubController` (`frameHarness` in
 * shared.test-utils.ts), so the numbers on screen are checked against `planSummary`
 * rather than against figures written into the test.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/intake.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import {
  StubController, census, idleState, picturesSource, project, reviewState, source,
  frameHarness,
} from './shared.test-utils.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.test/#/rebrand' });
// JSDOM has no top layer; a dialog opens and closes by its attribute.
dom.window.HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
for (const key of [
  'window', 'document', 'HTMLElement', 'HTMLButtonElement', 'Element', 'Node', 'KeyboardEvent', 'MouseEvent',
  'Event', 'DOMParser', 'history', 'location', 'navigator', 'getComputedStyle', 'sessionStorage', 'localStorage',
  'CSS', 'PointerEvent',
]) {
  const value: unknown = Reflect.get(dom.window, key);
  if (value === undefined) continue;
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
}

const { mount, settle, text, openDialog } = await frameHarness();

/**
 * Every primary the view shows, by its words: principle 2 wants exactly one. Before a
 * plan the view hides the footer (`applyLayout` in views/rebrand.ts, which this
 * harness does not run), so it is left out then.
 */
function primaries(view: HTMLElement, footShows = false): string[] {
  return [...view.querySelectorAll<HTMLElement>('.btn--primary')]
    .filter((el) => !el.closest('[hidden]') && (footShows || !el.closest('.rb-foot')))
    .map((el) => text(el));
}

const { keepOps } = await import('./keep.ts');

test('the idle intake: heading, the mode segment with one help line, the drop area and one primary', async () => {
  const controller = new StubController(idleState());
  const { rb, view } = mount(controller);
  await settle();
  assert.equal(text(view.querySelector('.rb-intake-title')), 'Choose a deck to rebrand');
  // The mode is the panel primitive's segment, pressed on the current mode.
  const seg = view.querySelector<HTMLElement>('.rb-intake .lp-seg.rb-intake-mode')!;
  assert.ok(seg, 'the mode is an .lp-seg');
  assert.equal(seg.querySelector('.view-seg-btn'), null, 'not the app segment');
  assert.deepEqual([...seg.querySelectorAll('button')].map((b) => [text(b), b.getAttribute('aria-pressed')]), [
    ['Renovate the layout', 'true'],
    ['Keep the design', 'false'],
  ]);
  const helps = [...view.querySelectorAll<HTMLElement>('.rb-intake .lp-help')].filter((el) => !el.hidden);
  assert.equal(helps.length, 1, 'one help line');
  assert.equal(text(helps[0]!), 'Rebuilds each slide on the slide master.');
  assert.equal(view.querySelector('.rb-intake-lead'), null, 'the lead sentence is gone');
  // The pressed half follows the mode, and so does the help line.
  controller.set({ ...controller.state, mode: 'keep-design' });
  assert.equal(seg.querySelector('[data-intake-mode="keep-design"]')?.getAttribute('aria-pressed'), 'true');
  assert.equal(text(helps[0]!), 'Swaps in the theme, colours and fonts.');
  // The segment asks through the keep module, which the frame harness does not mount.
  rb.keep = keepOps(rb);
  seg.querySelector<HTMLButtonElement>('[data-intake-mode="renovate"]')!.click();
  assert.ok(controller.calls.includes('mode:renovate'));

  const drop = view.querySelector<HTMLElement>('.rb-drop')!;
  assert.equal(drop.hidden, false);
  assert.equal(text(drop.querySelector('.rb-drop-title')), 'Drop a PowerPoint or PDF deck here');
  assert.equal(text(drop.querySelector('.rb-drop-pick')), 'Choose a deck');
  assert.equal(text(drop.querySelector('.rb-drop-note')), 'Read on this device, not uploaded. A 30-slide deck takes about 5 seconds.');
  const input = drop.querySelector<HTMLInputElement>('input[type=file]')!;
  assert.equal(input.accept.includes('.pptx'), true);
  assert.equal(input.accept.includes('.pdf'), true, 'a PDF deck can be chosen');
  assert.equal(input.multiple, true, 'several decks can be chosen at once');
  assert.deepEqual(primaries(view), ['Choose a deck'], 'the drop area holds the one primary');
});

test('the design system line names what the deck goes into, with the neutral master when it stands in', async () => {
  const { intoLine } = await import('./intake.ts');
  assert.equal(intoLine('SUSE', false), 'Into SUSE');
  assert.equal(intoLine('SUSE', true), 'Into SUSE, with the neutral slide master');
  const controller = new StubController({ ...idleState(), designSystem: reviewState().designSystem });
  const { view } = mount(controller);
  const line = view.querySelector<HTMLElement>('.rb-intake-system')!;
  assert.equal(line.hidden, false);
  assert.equal(text(line), 'Into Lolly Start, with the neutral slide master');
});

test('recent projects are rows with a picture, the name and where they are; the row opens and its menu deletes', async () => {
  const controller = new StubController(idleState());
  controller.projects = [
    { id: 'p-1', name: 'Quarterly review', slides: 12, stage: 'review' },
    { id: 'p-2', name: 'Launch deck', slides: 1, stage: 'ingest' },
  ];
  const { view } = mount(controller);
  await settle();
  assert.equal(text(view.querySelector('.rb-recent .rb-intake-eyebrow')), 'Recent projects');
  const rows = [...view.querySelectorAll<HTMLElement>('.rb-recent-row')];
  assert.deepEqual(rows.map((row) => text(row.querySelector('.rb-recent-name'))), ['Quarterly review', 'Launch deck']);
  assert.equal(text(rows[0]!.querySelector('.rb-recent-meta')), '12 slides, ready to review');
  assert.equal(text(rows[1]!.querySelector('.rb-recent-meta')), '1 slide, not read yet');
  // No thumbnail stored and no master read here: the picture falls back, never empty.
  assert.ok(rows[0]!.querySelector('.rb-recent-thumb'), 'every row carries a picture cell');
  // The row itself opens the project, named by its visible words.
  const open = rows[0]!.querySelector<HTMLButtonElement>('button.rb-recent-open')!;
  assert.equal(open.getAttribute('aria-label'), null, 'the name is the visible words');
  assert.match(text(open), /^Quarterly review/);
  open.click();
  await settle();
  assert.ok(controller.calls.includes('open:p-1'));
  // Delete sits behind the row's menu, not beside Open.
  assert.equal(rows[0]!.querySelector('.rb-recent-delete'), null);
  const more = rows[0]!.querySelector<HTMLButtonElement>('.rb-recent-more')!;
  assert.equal(more.getAttribute('aria-label'), 'More for Quarterly review');
  assert.equal(more.getAttribute('aria-haspopup'), 'menu');
  more.click();
  await settle();
  const menu = document.querySelector<HTMLElement>('.ctx-menu')!;
  assert.ok(menu, 'the row menu opens');
  assert.deepEqual([...menu.querySelectorAll('[data-act]')].map((b) => text(b)), ['Open', 'Delete']);
  menu.querySelector<HTMLButtonElement>('[data-act="delete"]')!.click();
  const dialog = await openDialog();
  assert.match(text(dialog), /Delete Quarterly review\?/);
  dialog.querySelector<HTMLButtonElement>('[data-act="ok"], .modal-primary, .btn--danger, .btn--primary')!.click();
  await settle();
  assert.ok(controller.calls.includes('remove:p-1'));
});

test('a stored first-slide thumbnail is drawn as a picture, with what could run taken out', async () => {
  const { storedSvgNode } = await import('./intake.ts');
  const safe = storedSvgNode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9" onload="alert(1)"><script>alert(2)</script>'
    + '<image href="javascript:alert(3)" width="4" height="4"/><rect width="16" height="9" fill="#0c322c" onclick="x()"/></svg>');
  assert.ok(safe);
  assert.equal(safe.getAttribute('onload'), null);
  assert.equal(safe.querySelector('script'), null);
  assert.equal(safe.querySelector('image')?.getAttribute('href'), null);
  assert.equal(safe.querySelector('rect')?.getAttribute('onclick'), null);
  assert.equal(safe.querySelector('rect')?.getAttribute('fill'), '#0c322c', 'the drawing itself stays');
  assert.equal(storedSvgNode('<div>not a picture</div>'), null);

  const controller = new StubController(idleState());
  controller.projects = [
    Object.assign({ id: 'p-1', name: 'Quarterly review', slides: 12, stage: 'review' as const }, {
      thumbSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#30ba78"/></svg>',
    }),
  ];
  const { view } = mount(controller);
  await settle();
  const cell = view.querySelector<HTMLElement>('.rb-recent-thumb')!;
  assert.equal(cell.querySelector('svg rect')?.getAttribute('fill'), '#30ba78', 'the stored first slide is the picture');
  assert.equal(cell.classList.contains('rb-recent-thumb--glyph'), false);
});

test('a file that is not a deck is named and never started, and a PDF deck is read', async () => {
  const controller = new StubController(idleState());
  const { rb, view } = mount(controller);
  await rb.intake.take(new dom.window.File(['words'], 'notes.txt', { type: 'text/plain' }));
  assert.equal(text(view.querySelector('.rb-intake-notice')), 'Choose a .pptx or .pdf file.');
  assert.equal(controller.calls.some((c) => c.startsWith('start:')), false);
  await rb.intake.take(new dom.window.File(['%PDF'], 'deck.pdf', { type: 'application/pdf' }));
  assert.ok(controller.calls.includes('start:deck.pdf'), 'a PDF starts a read like a pptx');
  await rb.intake.take(new dom.window.File(['PK'], 'deck.pptx'));
  assert.ok(controller.calls.includes('start:deck.pptx'));
});

test('a mode switch clears the notice and the error the last pick left', async () => {
  const controller = new StubController({ ...idleState(), phase: 'failed', error: { code: 'source.encrypted', message: 'encrypted' } });
  const { rb, view } = mount(controller);
  await rb.intake.take(new dom.window.File(['words'], 'notes.txt', { type: 'text/plain' }));
  controller.set({ ...controller.state, error: { code: 'source.unreadable', message: 'x' } });
  assert.equal(view.querySelector<HTMLElement>('.rb-intake-notice')!.hidden, false);
  assert.equal(view.querySelector<HTMLElement>('.rb-error')!.hidden, false);
  controller.set({ ...controller.state, mode: 'keep-design' });
  assert.equal(view.querySelector<HTMLElement>('.rb-intake-notice')!.hidden, true, 'the notice is cleared');
  assert.equal(view.querySelector<HTMLElement>('.rb-error')!.hidden, true, 'the error is cleared');
});

test('a deck handed over by the drop router is read when the intake wires', async () => {
  const { setPendingRebrandFile } = await import('../../lib/drop-router.ts');
  setPendingRebrandFile(new dom.window.File(['PK'], 'dropped.pptx'));
  const controller = new StubController(idleState());
  mount(controller);
  await settle();
  assert.ok(controller.calls.includes('start:dropped.pptx'));
  const again = new StubController(idleState());
  mount(again);
  await settle();
  assert.equal(again.calls.some((c) => c.startsWith('start:')), false, 'the handoff is spent once');
});

test('reading is one surface: a sentence counted from 1, the frames filling left to right, and Cancel', async () => {
  const controller = new StubController({ ...idleState(), phase: 'reading', progress: { step: 'read', done: 8, total: 40 } });
  const { view } = mount(controller);
  const progress = view.querySelector<HTMLElement>('.rb-progress')!;
  assert.equal(progress.hidden, false);
  // 8 slides are read, so the slide in hand is the 9th: counted from 1, never "0 of 40".
  assert.equal(text(progress.querySelector('.rb-progress-line')), 'Reading slide 9 of 40');
  assert.doesNotMatch(text(progress), /%/);
  // At most twelve frames, then the rest as a count; the read ones fill from the left.
  const frames = [...progress.querySelectorAll<HTMLElement>('.rb-read-frame')];
  assert.equal(frames.length, 12);
  assert.deepEqual(frames.map((f) => f.classList.contains('is-read')), [...Array(12).keys()].map((i) => i < 8));
  assert.equal(text(progress.querySelector('.rb-read-more')), '+28');
  assert.equal(view.querySelector<HTMLElement>('.rb-drop')!.hidden, true, 'no second deck while one is being read');
  // Nothing else speaks for the reading: no second progress line anywhere in the view.
  assert.equal(view.querySelectorAll('.rb-progress:not([hidden])').length, 1);
  const cancel = progress.querySelector<HTMLButtonElement>('.rb-progress-cancel')!;
  assert.ok(cancel.classList.contains('btn--text'), 'Cancel is a quiet text button');
  cancel.click();
  assert.ok(controller.calls.includes('cancel'));
  controller.set({ ...controller.state, progress: { step: 'read', done: 12, total: 40 } });
  assert.equal(progress.querySelectorAll('.rb-read-frame.is-read').length, 12);
  controller.set({ ...controller.state, phase: 'analysing', progress: { step: 'census', done: 2, total: 40 } });
  assert.equal(text(progress.querySelector('.rb-progress-line')), 'Looking for repeated objects on 40 slides');

  const { progressText, slideInHand } = await import('./intake.ts');
  assert.equal(progressText({ step: 'read', done: 0, total: 12 }), 'Reading slide 1 of 12', 'never "slide 0"');
  assert.equal(progressText({ step: 'read', done: 12, total: 12 }), 'Reading slide 12 of 12');
  assert.equal(slideInHand(5, 12), 6);
});

test('an error is named by its code with a way on, and leaves the drop area its primary', async () => {
  const controller = new StubController({ ...idleState(), phase: 'failed', error: { code: 'source.encrypted', message: 'encrypted' } });
  const { view } = mount(controller);
  const error = view.querySelector<HTMLElement>('.rb-error')!;
  assert.equal(error.hidden, false);
  assert.equal(text(error.querySelector('.rb-error-line')), 'This deck is protected by a password, so it cannot be read.');
  assert.equal(text(error.querySelector('[data-way]')), 'Choose another file');
  assert.deepEqual(primaries(view), ['Choose a deck'], 'one primary: the error way steps down beside the drop area');
  const { errorCopy } = await import('./intake.ts');
  assert.equal(errorCopy({ code: 'unsupported-file', message: '' }).text, 'Choose a .pptx or .pdf file.');
});

test('once the review is showing, readiness rows and a problem appear in the band under the top bar', () => {
  const controller = new StubController(reviewState({
    readiness: [
      { id: 'ocr', state: 'downloadable', sizeBytes: 5_000_000, message: 'log text', actions: ['download', 'continue-with-pictures', 'choose-another-file'] },
      { id: 'logo:on-dark', state: 'missing', message: 'log text', actions: [] },
    ],
  }));
  const { view } = mount(controller);
  const alert = view.querySelector<HTMLElement>('.rb-alert')!;
  assert.equal(alert.hidden, false, 'the band shows while the intake is hidden');
  const rows = [...alert.querySelectorAll<HTMLElement>('.rb-ready-row')];
  assert.equal(rows.length, 2, 'both rows moved out of the hidden intake');
  assert.equal(text(rows[0]!.querySelector('.rb-ready-message')), 'Text recognition is not installed. Downloading it sends nothing from the deck.');
  assert.match(text(rows[0]!.querySelector('.rb-ready-size')), /^A .+ download, the first time only\.$/);
  assert.equal(text(rows[0]!.querySelector('[data-way]')), 'Download text recognition');
  assert.deepEqual([...rows[0]!.querySelectorAll('[data-way]')].map((b) => text(b)), ['Download text recognition', 'Keep as pictures', 'Choose another file']);
  assert.equal(text(rows[1]!.querySelector('.rb-ready-message')), 'The design system has no mark for dark slides, so slides that need one keep theirs and ask for review.');
  assert.deepEqual([...rows[1]!.querySelectorAll('[data-way]')].map((b) => text(b)), ['Open the design system studio']);

  controller.set({ ...controller.state, error: { code: 'stage-failed', message: 'x', step: 'preview' } });
  const error = alert.querySelector<HTMLElement>('.rb-error')!;
  assert.equal(error.hidden, false);
  assert.equal(text(error.querySelector('.rb-error-line')), 'The proposed slides could not be updated.');
  assert.equal(text(error.querySelector('[data-way]')), 'Try again');
  assert.equal(alert.querySelectorAll('.btn--primary').length, 1, 'the band takes one primary at most; the footer steps down for it');
});

test('several decks chosen at once start one read, and a file that is not a deck is named', async () => {
  const controller = new StubController(idleState());
  const { rb, view } = mount(controller);
  await rb.intake.takeMany([
    new dom.window.File(['PK'], 'one.pptx'),
    new dom.window.File(['PK'], 'two.pptx'),
    new dom.window.File(['x'], 'notes.txt', { type: 'text/plain' }),
  ]);
  assert.ok(controller.calls.includes('startMany:one.pptx,two.pptx'));
  assert.equal(text(view.querySelector('.rb-intake-notice')), '1 file is not a PowerPoint deck or a PDF, so it was left out.');
});

test('the intake lists each deck of a multi-file read with its state, and a ready one opens', async () => {
  const controller = new StubController({
    ...idleState(),
    phase: 'reading',
    progress: { step: 'read' },
    batch: [
      { index: 0, name: 'one.pptx', state: 'reading' },
      { index: 1, name: 'two.pptx', state: 'ready', projectId: 'deck-2' },
      { index: 2, name: 'three.pptx', state: 'failed', error: 'source.encrypted' },
      { index: 3, name: 'four.pptx', state: 'waiting' },
    ],
  });
  const { view } = mount(controller);
  const rows = [...view.querySelectorAll<HTMLElement>('.rb-batch-row')];
  assert.deepEqual(rows.map((row) => text(row.querySelector('.rb-recent-meta'))), [
    'Reading',
    'Ready to review',
    'This deck is protected by a password, so it cannot be read.',
    'Waiting',
  ]);
  assert.equal(text(view.querySelector('.rb-progress-file')), 'one.pptx', 'the reading row names the deck in hand');
  assert.equal(rows[0]?.querySelector('.rb-recent-go'), null, 'a deck still being read has nothing to open');
  const open = rows[1]?.querySelector<HTMLButtonElement>('.rb-recent-go');
  assert.equal(open?.getAttribute('aria-label'), 'Open two.pptx');
  open?.click();
  await settle();
  assert.ok(controller.calls.includes('open:deck-2'));
});

test('the preset line names the preset the next read applies, and shows only when presets exist', async () => {
  const controller = new StubController(idleState());
  controller.presetList = [{ id: 'tidy', name: 'Tidy', origin: 'pack' }];
  const { view } = mount(controller);
  await settle();
  const line = view.querySelector<HTMLElement>('.rb-intake-preset')!;
  assert.equal(line.hidden, false);
  assert.equal(text(line.querySelector('.rb-intake-preset-text')), 'Preset: none');
  controller.set({ ...controller.state, nextPresetId: 'tidy' });
  assert.equal(text(line.querySelector('.rb-intake-preset-text')), 'Preset: Tidy');
  const bare = new StubController(idleState());
  const { view: none } = mount(bare);
  await settle();
  assert.equal(none.querySelector<HTMLElement>('.rb-intake-preset')!.hidden, true, 'no presets, no line');
});

test('Download text reading offers the model in place and checks readiness again, never a trip to Settings', async () => {
  const { __setModelOfferDepsForTest } = await import('../../lib/model-offer.ts');
  const asked: string[] = [];
  __setModelOfferDepsForTest({
    info: async (id) => {
      asked.push(id);
      return { id, label: 'Text reading', available: true, allowed: true, ready: true, source: 'precache' };
    },
  });
  try {
    const controller = new StubController(reviewState({
      readiness: [{ id: 'ocr', state: 'downloadable', sizeBytes: 5_000_000, message: 'log text', actions: ['download', 'continue-with-pictures', 'choose-another-file'] }],
    }));
    const { view } = mount(controller);
    const hashBefore = location.hash;
    view.querySelector<HTMLButtonElement>('.rb-ready-row [data-way="download"]')!.click();
    await settle();
    assert.deepEqual(asked, ['ocr'], 'the in-place offer is asked for the OCR part');
    assert.ok(controller.calls.includes('refreshReadiness'), 'readiness is checked again once the model is ready');
    assert.equal(location.hash, hashBefore, 'the view stays where it is');
  } finally {
    __setModelOfferDepsForTest();
  }
  const src = readFileSync(new URL('./intake.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /OFFLINE_ROUTE|#\/profile/, 'no route to Settings is left');
  assert.match(src, /ensureModel\('ocr', \{ reason: tRaw\('Reading text in slide pictures'\) \}\)/);
});

test('before the plan, a picture deck is offered in the band with Read the text as a ghost that waits, and no modal opens', async () => {
  const { __setModelOfferDepsForTest } = await import('../../lib/model-offer.ts');
  const offered: string[] = [];
  __setModelOfferDepsForTest({
    info: async (id) => {
      offered.push(id);
      return { id, label: 'Text reading', available: true, allowed: true, ready: false, source: 'precache' };
    },
  });
  try {
    const deck = picturesSource();
    const controller = new StubController({
      ...idleState(),
      phase: 'analysing',
      progress: { step: 'plan' },
      project,
      source: deck,
      census,
      readiness: [{ id: 'ocr', state: 'downloadable', sizeBytes: 5_000_000, message: 'log text', actions: ['download', 'continue-with-pictures', 'choose-another-file'] }],
    });
    controller.mediaHref = () => 'blob:https://lolly.test/first-picture';
    const { view } = mount(controller);
    await settle();
    // The one place for the offer is the band under the top bar, not the intake.
    assert.equal(view.querySelector('.rb-intake .rb-pictures'), null);
    const alert = view.querySelector<HTMLElement>('.rb-alert')!;
    assert.equal(alert.hidden, false);
    const band = alert.querySelector<HTMLElement>('.rb-pictures')!;
    assert.equal(text(band.querySelector('.rb-pictures-line')), `All ${deck.slides.length} slides are pictures. Read their text to rebuild them as slides.`);
    assert.equal(band.querySelector('.rb-pictures-art img')?.getAttribute('src'), 'blob:https://lolly.test/first-picture', 'the first picture is the thumbnail');
    const read = band.querySelector<HTMLButtonElement>('[data-way="read-pictures"]')!;
    assert.ok(read.classList.contains('btn--ghost'), 'a ghost before the plan');
    assert.equal(read.getAttribute('aria-disabled'), 'true');
    assert.equal(read.disabled, false, 'it stays focusable');
    assert.equal(text(document.getElementById(read.getAttribute('aria-describedby') ?? '')), 'Waits for the deck to finish reading.');
    const keep = band.querySelector<HTMLButtonElement>('[data-way="continue-with-pictures"]')!;
    assert.equal(text(keep), 'Keep as pictures');
    assert.ok(keep.classList.contains('btn--text'));
    assert.equal(alert.querySelector('[data-readiness="ocr"]'), null, 'the text recognition row folds into the band');
    read.click();
    await settle();
    assert.equal(controller.calls.includes('readSlidePictures'), false, 'a press before the plan does nothing');
    assert.deepEqual(offered, [], 'no model offer opened on arrival, nor from a press that cannot run');
    assert.equal(document.querySelector('dialog[open]'), null);
    // The busy intake has no primary of its own, and the band gives none.
    assert.deepEqual(primaries(view), []);
  } finally {
    __setModelOfferDepsForTest();
  }
});

test('in review the band asks: Read the text is the primary, reads once, and the end is said once with the items left', async () => {
  const deck = picturesSource();
  const controller = new StubController(reviewState({
    source: deck,
    readiness: [{ id: 'ocr', state: 'downloadable', sizeBytes: 5_000_000, message: 'log text', actions: ['download', 'continue-with-pictures', 'choose-another-file'] }],
  }));
  const { rb, view, announced } = mount(controller);
  const alert = view.querySelector<HTMLElement>('.rb-alert')!;
  const band = alert.querySelector<HTMLElement>('.rb-pictures')!;
  assert.ok(band, 'the band shows over the review');
  const read = band.querySelector<HTMLButtonElement>('[data-way="read-pictures"]')!;
  assert.ok(read.classList.contains('btn--primary'), 'the band asks with the primary');
  assert.equal(read.getAttribute('aria-disabled'), null);
  assert.equal(rb.intake.picturesAsk(), true, 'the footer can read that the band asks');
  assert.equal(controller.calls.includes('readSlidePictures'), false, 'nothing is read before the press');

  read.click();
  await settle();
  assert.equal(controller.calls.filter((c) => c === 'readSlidePictures').length, 1);
  const said = announced.filter((line) => line.startsWith('Rebuilt 2 slides from their pictures.'));
  assert.equal(said.length, 1, 'said once');
  assert.match(said[0]!, /^Rebuilt 2 slides from their pictures\. (Nothing is left to review\.|1 card is left to review\.|\d+ cards are left to review\.)$/);
  // The footer's counts sit beside its line, so the line leaves the cards left out.
  assert.equal(text(view.querySelector('.rb-foot-said')), 'Rebuilt 2 slides from their pictures.', 'the footer shows the outcome alone');
  assert.equal(text(band.querySelector('.rb-pictures-note')), said[0], 'and the band keeps them while the pictures are still there');
});

test('a rebuild the controller starts on its own shows its progress in the band and says its end once', async () => {
  const deck = picturesSource();
  const total = deck.slides.length;
  const controller = new StubController(reviewState({
    source: deck,
    progress: { step: 'read', done: 0, total },
    readiness: [{ id: 'ocr', state: 'ready', message: 'log text', actions: [] }],
  }));
  const { view, announced } = mount(controller);
  const band = view.querySelector<HTMLElement>('.rb-alert .rb-pictures')!;
  assert.equal(text(band.querySelector('.rb-pictures-line')), `Reading slide 1 of ${total}.`, 'the band line is the one progress surface');
  const read = band.querySelector<HTMLButtonElement>('[data-way="read-pictures"]')!;
  assert.equal(text(read), 'Reading the text');
  assert.equal(read.getAttribute('aria-disabled'), 'true', 'no second read while one runs');
  assert.ok(read.classList.contains('btn--ghost'));
  assert.equal(band.querySelector<HTMLElement>('[data-way="continue-with-pictures"]')!.hidden, true);
  // Past the read the rebuild runs its census, plan and preview: still under way.
  controller.set({ ...controller.getState(), progress: { step: 'census' } });
  assert.equal(text(band.querySelector('.rb-pictures-line')), 'Looking for repeated objects');
  // The end: the rebuilt deck is in, with no pictures left.
  controller.set({ ...controller.getState(), progress: null, source });
  await settle();
  const said = announced.filter((line) => line.startsWith('Rebuilt '));
  assert.equal(said.length, 1, 'the end is said once');
  assert.match(said[0]!, new RegExp(`^Rebuilt ${total} slides from their pictures\\. `));
  assert.equal(view.querySelector('.rb-pictures'), null, 'the band goes with the pictures');
  controller.set({ ...controller.getState(), tick: 99 });
  assert.equal(announced.filter((line) => line.startsWith('Rebuilt ')).length, 1, 'a later redraw says nothing again');
});

test('a read of the slide pictures that rebuilt none says so in view and is not offered again', async () => {
  const deck = picturesSource();
  const controller = new StubController(reviewState({
    source: deck,
    readiness: [{ id: 'ocr', state: 'ready', message: 'log text', actions: [] }],
  }));
  controller.picturesOutcome = { ok: false, touched: 0, skipped: deck.slides.length, refusal: 'nothing-to-do' };
  const { view } = mount(controller);
  const band = view.querySelector<HTMLElement>('.rb-alert .rb-pictures')!;
  band.querySelector<HTMLButtonElement>('[data-way="read-pictures"]')!.click();
  await settle();
  assert.equal(text(band.querySelector('.rb-pictures-note')), 'No slide could be rebuilt from its picture, so they stay pictures.');
  assert.equal(band.querySelector<HTMLElement>('[data-way="read-pictures"]')!.hidden, true, 'the same read is not offered again');
});

test('Keep as pictures folds the band to its sentence and Read the text, which stops asking', () => {
  const deck = picturesSource();
  const controller = new StubController(reviewState({
    source: deck,
    readiness: [{ id: 'ocr', state: 'ready', message: 'log text', actions: [] }],
  }));
  const { rb, view, announced } = mount(controller);
  const band = view.querySelector<HTMLElement>('.rb-alert .rb-pictures')!;
  band.querySelector<HTMLButtonElement>('[data-way="continue-with-pictures"]')!.click();
  assert.ok(view.querySelector('.rb-alert .rb-pictures'), 'the band stays, folded');
  assert.equal(text(band.querySelector('.rb-pictures-note')), 'The slide pictures stay as they are.');
  assert.equal(announced.filter((line) => line === 'The slide pictures stay as they are.').length, 1);
  assert.equal(band.querySelector<HTMLElement>('[data-way="continue-with-pictures"]')!.hidden, true);
  const read = band.querySelector<HTMLElement>('[data-way="read-pictures"]')!;
  assert.equal(read.hidden, false, 'the way back to reading the text stays');
  assert.ok(read.classList.contains('btn--ghost'), 'it no longer asks, so the footer keeps its primary');
  assert.equal(rb.intake.picturesAsk(), false);
  assert.equal(controller.calls.includes('readSlidePictures'), false, 'keeping them reads nothing');
});

test('a deck with only some slide pictures, or no text recognition, keeps the sentence that counts them', async () => {
  const deck = picturesSource();
  const first = deck.slides[0]!;
  deck.slides = deck.slides.map((slide) => (slide.id === first.id ? slide : { ...slide, origin: { ...slide.origin, flattened: false } }));
  const controller = new StubController({
    ...idleState(),
    phase: 'analysing',
    progress: { step: 'plan' },
    project,
    source: deck,
    census,
    readiness: [{ id: 'ocr', state: 'missing', message: 'log text', actions: ['continue-with-pictures', 'choose-another-file'] }],
  });
  const { view } = mount(controller);
  const band = view.querySelector<HTMLElement>('.rb-alert .rb-pictures')!;
  assert.ok(band);
  assert.equal(text(band.querySelector('.rb-pictures-line')),
    `1 of ${deck.slides.length} slides is a picture. This device cannot read its text.`);
  assert.equal(band.querySelector<HTMLElement>('.rb-pictures-note')!.hidden, true, 'the sentence says it, so no note repeats it');
  assert.equal(band.querySelector<HTMLElement>('[data-way="read-pictures"]')!.hidden, true, 'nothing to read with here');
  // An editable deck has no band at all.
  controller.set({ ...controller.state, source });
  assert.equal(view.querySelector('.rb-pictures'), null);

  const { picturesText } = await import('./intake.ts');
  assert.equal(picturesText(2, 15), '2 of 15 slides are pictures. Their text stays part of the pictures.');
  assert.equal(picturesText(1, 1, true), 'The slide is a picture. This device cannot read its text.');
  assert.equal(picturesText(15, 15, true), 'All 15 slides are pictures. This device cannot read their text.');
  assert.equal(picturesText(12, 15), '12 of 15 slides are pictures. Read their text to rebuild them as slides.');
  assert.equal(picturesText(15, 15), 'All 15 slides are pictures. Read their text to rebuild them as slides.');
  assert.equal(picturesText(1, 1), 'The slide is a picture. Read its text to rebuild it as a slide.');
  assert.equal(picturesText(15, 15, true), 'All 15 slides are pictures. This device cannot read their text.');
});

test('the decks of a multi-file read stay in reach once the first deck is in review', () => {
  const controller = new StubController(reviewState({
    batch: [
      { index: 0, name: 'one.pptx', state: 'ready', projectId: 'proj-1' },
      { index: 1, name: 'two.pptx', state: 'ready', projectId: 'deck-2' },
    ],
  }));
  const { view } = mount(controller);
  const alert = view.querySelector<HTMLElement>('.rb-alert')!;
  assert.equal(alert.hidden, false, 'the band shows for the other decks');
  const rows = [...alert.querySelectorAll<HTMLElement>('.rb-batch-row')];
  assert.equal(rows.length, 2);
  assert.equal(text(alert.querySelector('.rb-batch .rb-intake-subtitle')), 'Decks read together');
  assert.equal(rows[1]?.querySelector<HTMLButtonElement>('.rb-recent-go')?.getAttribute('aria-label'), 'Open two.pptx');
});

test('the copy: reading the pictures counts from 1 with the time left, and the outcome names what is left', async () => {
  const { readingPicturesText, timeLeftText, picturesOutcomeText, presetLineText, leftToReviewText } = await import('./intake.ts');
  assert.equal(readingPicturesText({ step: 'read', done: 3, total: 15 }, 130_000), 'Reading slide 4 of 15. About 2 minutes left.');
  assert.equal(readingPicturesText({ step: 'read', done: 0, total: 15 }), 'Reading slide 1 of 15.', 'no estimate before one picture is read');
  assert.equal(readingPicturesText({ step: 'read', done: 15, total: 15 }, 0), 'Reading slide 15 of 15. Less than a minute left.');
  assert.equal(readingPicturesText({ step: 'read' }), 'Reading the slide pictures');
  assert.equal(readingPicturesText({ step: 'census' }), '');
  assert.equal(timeLeftText(null), '');
  assert.equal(timeLeftText(70_000), 'About a minute left.');
  assert.equal(timeLeftText(10 * 60_000), 'About 10 minutes left.');
  assert.equal(picturesOutcomeText({ ok: true, touched: 15, skipped: 0 }, 6), 'Rebuilt 15 slides from their pictures. 6 cards are left to review.');
  assert.equal(picturesOutcomeText({ ok: true, touched: 1, skipped: 0 }, 1), 'Rebuilt 1 slide from its picture. 1 card is left to review.');
  assert.equal(picturesOutcomeText({ ok: true, touched: 12, skipped: 3 }), 'Rebuilt 12 of 15 slides from their pictures. The others stay pictures.');
  assert.equal(leftToReviewText(0), 'Nothing is left to review.');
  assert.equal(presetLineText([], undefined), 'Preset: none');
});

test('the intake sheet: tokens only, one dashed border, the view grid untouched', () => {
  const css = readFileSync(new URL('../../styles/parts/rebrand-intake.css', import.meta.url), 'utf8');
  const dashed = [...css.matchAll(/(?:border|outline)[a-z-]*:\s*[^;]*dashed/g)];
  assert.equal(dashed.length, 1, 'the drop area is the one dashed border');
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'no literal colours');
  assert.doesNotMatch(css, /grid-template-rows|\.rb\s*\{/, 'the grid is rebrand.css\'s');
  assert.doesNotMatch(css, /font-size:\s*calc\(/, 'type sizes come from the type tokens');
});
