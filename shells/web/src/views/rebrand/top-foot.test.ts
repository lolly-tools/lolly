// SPDX-License-Identifier: MPL-2.0
/**
 * The #/rebrand top bar and footer (plan 275 close-out sections 3.1 and 3.8, package
 * CP7) against the real modules: one primary action in every state, the outcome line
 * that answers every edit with its Undo and is said once, the confirm on Open in Design
 * while cards wait, focus after Accept all, the line on a return from Design, the save
 * state as words only, Undo and Redo named with their step, and the project menu.
 *
 * The state is built from the committed samples (tests/fixtures/rebrand/samples) and
 * the engine's review model over `StubController` (`frameHarness` in
 * shared.test-utils.ts), so the numbers on screen are checked against `planSummary`
 * rather than against figures written into the test.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/top-foot.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { planSummary } from '@lolly/engine';
import type { RebrandEditOutcomeV1, RebrandHistoryV1, RebrandStateV1 } from '../../lib/rebrand/controller-api.ts';
import {
  StubController, census, picturesSource, plan, planSettled, planWithPending, previewFor, project, reviewState, source,
  frameHarness,
} from './shared.test-utils.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.test/#/rebrand' });
// JSDOM has no top layer; a dialog opens and closes by its attribute.
dom.window.HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
for (const key of [
  'window', 'document', 'HTMLElement', 'HTMLButtonElement', 'Element', 'Node', 'KeyboardEvent', 'MouseEvent',
  'Event', 'DOMParser', 'history', 'location', 'navigator', 'getComputedStyle', 'sessionStorage', 'localStorage',
]) {
  Object.defineProperty(globalThis, key, {
    value: Reflect.get(dom.window, key),
    configurable: true,
    writable: true,
  });
}

const { mount, settle, text, openDialog } = await frameHarness();
const { countsLine, returnText } = await import('./foot.ts');
const { undoLabel, redoLabel } = await import('./top.ts');

/** The result's words on the outcome line, without the Undo beside them. */
const said = (view: HTMLElement): string => text(view.querySelector('.rb-foot-said'));

/** Shown to a sighted person: not `hidden` itself or under a hidden region, and not visually hidden. */
function shown(el: Element): boolean {
  return !el.closest('[hidden]') && !el.closest('.visually-hidden');
}

/** The primary buttons a person can see in the bars this package draws and the notice band. */
function primaries(view: HTMLElement): HTMLElement[] {
  return [...view.querySelectorAll<HTMLElement>('.rb-top .btn--primary, .rb-alert .btn--primary, .rb-foot .btn--primary')].filter(shown);
}

/** A controller whose Accept all settles every card, bumps the history and leaves the pane catching up. */
function acceptingController(over: Partial<RebrandStateV1> = {}): StubController {
  const controller = new StubController(reviewState({ plan: planWithPending(), ...over }));
  const settled = planSettled();
  controller.acceptOutcome = { ok: true, touched: 97, skipped: 0 };
  controller.acceptSuggestions = async (): Promise<RebrandEditOutcomeV1> => {
    controller.calls.push('accept');
    controller.set({
      ...controller.state,
      plan: settled,
      previewStale: true,
      history: { canUndo: true, canRedo: false, undo: { kind: 'accept', count: 97 } },
    });
    return controller.acceptOutcome;
  };
  return controller;
}

// ─── the one primary ─────────────────────────────────────────────────────────

test('with nothing waiting, Open in Design is the one primary action and the counts say the slides', () => {
  const controller = new StubController(reviewState({ plan: planSettled(), preview: previewFor(plan.revision) }));
  const { view } = mount(controller);
  const accept = view.querySelector<HTMLButtonElement>('.rb-foot-accept')!;
  const open = view.querySelector<HTMLButtonElement>('.rb-foot-open')!;
  assert.equal(accept.hidden, true, 'Accept all leaves once nothing waits');
  assert.equal(open.disabled, false);
  assert.ok(open.classList.contains('btn--primary'));
  assert.equal(open.hasAttribute('aria-describedby'), false);
  assert.equal(view.querySelector('.rb-foot .help-tip'), null, 'no help tip in the footer');
  assert.deepEqual(primaries(view), [open]);
  const summary = planSummary(planSettled(), source, census);
  assert.equal(text(view.querySelector('.rb-foot-counts')), countsLine(summary.slides.included, summary.slides.total, 0));
});

test('with cards waiting, Accept all suggestions leads and Open in Design stays enabled as a ghost', () => {
  const controller = new StubController(reviewState({ plan: planWithPending(), preview: previewFor(plan.revision + 1) }));
  const { rb, view } = mount(controller);
  const accept = view.querySelector<HTMLButtonElement>('.rb-foot-accept')!;
  const open = view.querySelector<HTMLButtonElement>('.rb-foot-open')!;
  assert.equal(accept.hidden, false);
  assert.equal(text(accept), 'Accept all suggestions');
  assert.equal(accept.title, 'Takes every suggestion as Proposed shows it. Undo reverses it.');
  assert.equal(open.disabled, false, 'cards left are answered by the confirm, not by a grey button');
  assert.ok(open.classList.contains('btn--ghost'));
  assert.deepEqual(primaries(view), [accept]);
  // The number is the To review tab's number: queue items to review, never objects.
  const pending = new Set(rb.derived?.pendingIds ?? []);
  const cards = (rb.derived?.queue ?? []).filter((item) => item.section !== 'settled' && item.objectIds.some((id) => pending.has(id))).length;
  assert.equal(rb.foot.toReviewCount(), cards);
  const summary = planSummary(planWithPending(), source, census);
  assert.equal(text(view.querySelector('.rb-foot-counts')), countsLine(summary.slides.included, summary.slides.total, cards));
  assert.equal(view.querySelector<HTMLElement>('.rb-foot-reason')!.hidden, true, 'no sentence repeats what the counts say');
});

test('the footer counts what the To review tab lists, less the cards the notice band speaks for', () => {
  const controller = new StubController(reviewState({ plan: planWithPending(), preview: previewFor(plan.revision + 1) }));
  const { rb, view } = mount(controller);
  const all = rb.foot.reviewItems();
  assert.ok(all.length > 0);
  const first = all[0]!;
  // The queue module offers the ids it leaves out; the footer takes them away too.
  rb.queue = { ...rb.queue, bandCardIds: () => new Set([first.id]) };
  assert.equal(rb.foot.toReviewCount(), all.length - 1);
  rb.memo = {};
  rb.render();
  const summary = planSummary(planWithPending(), source, census);
  assert.equal(text(view.querySelector('.rb-foot-counts')), countsLine(summary.slides.included, summary.slides.total, all.length - 1));
});

test('with only the band\'s rows left, Accept all leaves and Open in Design asks about the pictures, never a card nobody saw', async () => {
  const controller = acceptingController();
  const accepting = controller.acceptSuggestions.bind(controller);
  controller.acceptSuggestions = async (): Promise<RebrandEditOutcomeV1> => {
    const outcome = await accepting();
    controller.set({ ...controller.state, previewStale: false, preview: previewFor(controller.state.plan!.revision) });
    return outcome;
  };
  const { rb, view } = mount(controller);
  const all = rb.foot.reviewItems();
  assert.ok(all.length > 0);
  // The band speaks for every waiting card: the tab shows none.
  rb.queue = { ...rb.queue, bandCardIds: () => new Set(all.map((item) => item.id)) };
  rb.memo = {};
  rb.render();
  assert.equal(rb.foot.toReviewCount(), 0);
  const accept = view.querySelector<HTMLButtonElement>('.rb-foot-accept')!;
  const open = view.querySelector<HTMLButtonElement>('.rb-foot-open')!;
  assert.equal(accept.hidden, true, 'no Accept all over a count of 0');
  assert.doesNotMatch(text(view.querySelector('.rb-foot-counts')), /to review/);
  open.click();
  const dialog = await openDialog();
  const slides = new Set(all.flatMap((item) => item.slideIds)).size;
  assert.match(text(dialog), slides === 1
    ? /1 slide is still a picture\. Keep it as a picture and open in Design\?/
    : new RegExp(`${slides} slides are still pictures\\. Keep them as pictures and open in Design\\?`));
  assert.doesNotMatch(text(dialog), /card/);
  assert.equal(text(dialog.querySelector('[data-act="ok"]')), 'Keep and open');
  dialog.querySelector<HTMLButtonElement>('[data-act="ok"]')!.click();
  await settle();
  await settle();
  assert.deepEqual(controller.calls.filter((call) => call === 'accept' || call === 'openInDesign'), ['accept', 'openInDesign']);
});

test('while the notice band shows a primary of its own, the footer steps down, so the view keeps one', () => {
  const controller = new StubController(reviewState({
    plan: planWithPending(),
    source: picturesSource(),
    readiness: [{ id: 'ocr', state: 'ready', message: 'log text', actions: [] }],
  }));
  const { view } = mount(controller);
  const accept = view.querySelector<HTMLButtonElement>('.rb-foot-accept')!;
  const bandPrimary = [...view.querySelectorAll<HTMLElement>('.rb-alert .btn--primary')].filter(shown);
  assert.equal(primaries(view).length, 1, 'one primary on screen');
  if (bandPrimary.length > 0) {
    assert.ok(accept.classList.contains('btn--ghost'), 'Accept all is a ghost while the band asks');
    assert.equal(accept.classList.contains('btn--primary'), false);
  }
  // The band settles; the footer takes the primary back.
  const band = view.querySelector<HTMLElement>('.rb-alert')!;
  band.hidden = true;
  controller.set({ ...controller.state });
  assert.ok(accept.classList.contains('btn--primary'));
  assert.equal(primaries(view).length, 1);
});

// ─── the outcome line ────────────────────────────────────────────────────────

test('every edit answers on the outcome line with an Undo named for its step, and is said once', () => {
  const controller = new StubController(reviewState({ plan: planSettled(), preview: previewFor(plan.revision) }));
  const { rb, view, announced } = mount(controller);
  const outcome = view.querySelector<HTMLElement>('.rb-foot-outcome')!;
  const undo = view.querySelector<HTMLButtonElement>('.rb-foot-undo')!;
  // A plain paragraph: the view's own live region is the one that speaks.
  assert.equal(outcome.hasAttribute('role'), false);
  assert.equal(outcome.hasAttribute('aria-live'), false);
  assert.equal(outcome.querySelector('.rb-foot-said .rb-foot-undo'), null, 'the Undo is outside the words');
  const edits: Array<[string, RebrandHistoryV1['undo']]> = [
    ['Kept 1 object.', { kind: 'decide', action: 'keep', count: 1 }],
    ['Removed 14 objects.', { kind: 'decide', action: 'remove', count: 14 }],
    ['Slide 3 now uses the Numbered list layout.', { kind: 'layout', count: 1 }],
    ['Moved slide 3 to position 4.', { kind: 'move', count: 1 }],
    ['Slide 3 is left out.', { kind: 'exclude', count: 1 }],
    ['Deck theme: Dark.', { kind: 'layout', count: 12 }],
    ['Moved 2 slides to position 1.', { kind: 'move', count: 2 }],
    ['Matched 8 slides. 3 were likely matches.', { kind: 'layout', count: 8 }],
  ];
  for (const [words, step] of edits) {
    controller.set({ ...controller.state, history: { canUndo: true, canRedo: false, undo: step } });
    const before = announced.length;
    rb.foot.say(words, { undo: true });
    assert.equal(said(view), words);
    assert.equal(outcome.hidden, false);
    assert.equal(undo.hidden, false, `an Undo beside "${words}"`);
    assert.equal(undo.getAttribute('aria-label'), undoLabel(step));
    assert.deepEqual(announced.slice(before), [words], 'said once, through the live region');
  }
  // A result with nothing to undo shows no Undo.
  rb.foot.say('Downloaded Quarterly review.lolly.');
  assert.equal(undo.hidden, true);
  // A line whose step was undone from the top bar is no longer true, and goes.
  rb.foot.say('Kept 1 object.', { undo: true });
  controller.set({ ...controller.state, history: { canUndo: false, canRedo: true, redo: { kind: 'decide', action: 'keep', count: 1 } } });
  assert.equal(outcome.hidden, true);
});

test('a result said as its edit resolves names that edit, even before the view redraws', () => {
  const controller = new StubController(reviewState({ plan: planSettled(), preview: previewFor(plan.revision) }));
  const { rb, view } = mount(controller);
  // The controller has moved on; the view has not drawn that state yet.
  controller.state = { ...controller.state, history: { canUndo: true, canRedo: false, undo: { kind: 'decide', action: 'remove', count: 3 } } };
  rb.foot.say('Removed 3 objects.', { undo: true });
  const undo = view.querySelector<HTMLButtonElement>('.rb-foot-undo')!;
  assert.equal(undo.hidden, false);
  assert.equal(undo.getAttribute('aria-label'), 'Undo remove 3 objects');
});

test('the inline Undo takes the step, says what was undone, and moves focus to an action', async () => {
  const controller = new StubController(reviewState({
    plan: planSettled(),
    preview: previewFor(plan.revision),
    history: { canUndo: true, canRedo: false, undo: { kind: 'decide', action: 'keep', count: 1 } },
  }));
  controller.undo = async (): Promise<RebrandEditOutcomeV1> => {
    controller.calls.push('undo');
    controller.set({ ...controller.state, history: { canUndo: false, canRedo: true, redo: { kind: 'decide', action: 'keep', count: 1 } } });
    return { ok: true, touched: 1, skipped: 0 };
  };
  const { rb, view, announced } = mount(controller);
  rb.foot.say('Kept 1 object.', { undo: true });
  const undo = view.querySelector<HTMLButtonElement>('.rb-foot-undo')!;
  undo.focus();
  undo.click();
  await settle();
  assert.ok(controller.calls.includes('undo'));
  assert.equal(said(view), 'Undone: keep 1 object.');
  assert.equal(undo.hidden, true, 'no Undo of an undo');
  assert.equal(announced.filter((line) => line === 'Undone: keep 1 object.').length, 1, 'said once');
  assert.equal(document.activeElement, view.querySelector('.rb-foot-open'), 'focus moves to the action, never the sentence');
});

test('Accept all says its count with the busy line while the pane catches up, and focus lands on its Undo', async () => {
  const controller = acceptingController();
  const { view, announced } = mount(controller);
  const accept = view.querySelector<HTMLButtonElement>('.rb-foot-accept')!;
  const open = view.querySelector<HTMLButtonElement>('.rb-foot-open')!;
  accept.focus();
  accept.click();
  await settle();
  assert.ok(controller.calls.includes('accept'));
  assert.equal(said(view), 'Accepted 97 suggestions. Updating the proposed slides.');
  assert.equal(announced.filter((line) => line.startsWith('Accepted 97')).length, 1, 'said once');
  const undo = view.querySelector<HTMLButtonElement>('.rb-foot-undo')!;
  assert.equal(undo.hidden, false);
  assert.equal(undo.getAttribute('aria-label'), 'Undo accept 97 suggestions');
  assert.equal(document.activeElement, undo, 'focus on the Undo button, not the sentence');
  // The primary moved: Accept all is gone and Open in Design leads.
  assert.equal(accept.hidden, true);
  assert.ok(open.classList.contains('btn--primary'));
  assert.deepEqual(primaries(view), [open]);
  // The pane catches up; the busy words go.
  controller.set({ ...controller.state, previewStale: false, preview: previewFor(controller.state.plan!.revision) });
  assert.equal(said(view), 'Accepted 97 suggestions.');
});

test('Open in Design with cards left asks first, then runs Accept all and opens, in that order', async () => {
  const controller = acceptingController();
  // The pane shows the accepted plan as soon as Accept all resolves.
  const accepting = controller.acceptSuggestions.bind(controller);
  controller.acceptSuggestions = async (): Promise<RebrandEditOutcomeV1> => {
    const outcome = await accepting();
    controller.set({ ...controller.state, previewStale: false, preview: previewFor(controller.state.plan!.revision) });
    return outcome;
  };
  const { rb, view } = mount(controller);
  const cards = rb.foot.toReviewCount();
  assert.ok(cards > 0);

  // No: nothing runs.
  view.querySelector<HTMLButtonElement>('.rb-foot-open')!.click();
  let dialog = await openDialog();
  assert.equal(text(dialog.querySelector('.modal-title, h2')), 'Open in Design');
  assert.match(text(dialog), cards === 1 ? /1 card is still to answer\. Accept it as proposed and open in Design\?/ : new RegExp(`${cards} cards are still to answer\\. Accept them as proposed and open in Design\\?`));
  assert.equal(dialog.querySelector('.modal-danger'), null, 'accepting is not a destructive step');
  dialog.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.click();
  await settle();
  assert.deepEqual(controller.calls.filter((call) => call === 'accept' || call === 'openInDesign'), []);

  // Yes: Accept all, then Open in Design.
  view.querySelector<HTMLButtonElement>('.rb-foot-open')!.click();
  dialog = await openDialog();
  const confirm = dialog.querySelector<HTMLButtonElement>('[data-act="ok"]')!;
  assert.equal(text(confirm), 'Accept and open');
  confirm.click();
  await settle();
  await settle();
  assert.deepEqual(controller.calls.filter((call) => call === 'accept' || call === 'openInDesign'), ['accept', 'openInDesign']);
  assert.equal(said(view), 'Opened in Design.');
});

test('a refused Open in Design names its reason in words, and its notes go to the report', async () => {
  const controller = new StubController(reviewState({ plan: planSettled(), preview: previewFor(plan.revision) }));
  controller.openOutcome = { ok: false, reason: 'compile-failed', warnings: [] };
  const { rb, view } = mount(controller);
  view.querySelector<HTMLButtonElement>('.rb-foot-open')!.click();
  await settle();
  assert.equal(said(view), 'The proposed slides could not be made. Open the report to see why.');

  controller.openOutcome = { ok: false, reason: 'unreviewed', pending: 3, warnings: [] };
  view.querySelector<HTMLButtonElement>('.rb-foot-open')!.click();
  await settle();
  // A refusal counts what the tab counts, and never states a number the tab does not show.
  const items = rb.foot.toReviewCount();
  assert.equal(said(view), items === 0 ? 'Some suggestions are still to answer.'
    : items === 1 ? '1 card is still to answer.' : `${items} cards are still to answer.`, 'a refusal counts what the tab counts');

  controller.openOutcome = { ok: true, sessionId: 'design:1', warnings: ['1 object is on the Not placed artboard, which exports with the deck until you delete it.'] };
  view.querySelector<HTMLButtonElement>('.rb-foot-open')!.click();
  await settle();
  assert.equal(said(view), 'Opened in Design, with 1 note in the report.');
  rb.report.open();
  assert.match(text(view.querySelector('[data-sec="notes"]')), /1 object is on the Not placed artboard/);
});

test('Open in Design waits only for what cannot be answered here, and says so beside the button', () => {
  const settled = planSettled();
  const controller = new StubController(reviewState({ plan: settled, preview: previewFor(settled.revision), previewStale: true }));
  const { view } = mount(controller);
  const open = view.querySelector<HTMLButtonElement>('.rb-foot-open')!;
  const reason = view.querySelector<HTMLElement>('.rb-foot-reason')!;
  assert.equal(open.disabled, true, 'the pane has not shown the current plan yet');
  assert.equal(text(reason), 'Updating the proposed slides.');
  assert.equal(open.getAttribute('aria-describedby'), reason.id);

  controller.set({ ...controller.state, previewStale: false, error: { code: 'stage-failed', message: 'x', step: 'preview' } });
  assert.equal(text(reason), 'The proposed slides could not be updated. Try again first.');

  controller.set({ ...controller.state, error: null });
  assert.equal(open.disabled, false);
  assert.equal(reason.hidden, true);
});

test('the last result takes the reason line, so the footer keeps one line of words', () => {
  const settled = planSettled();
  const controller = new StubController(reviewState({ plan: settled, preview: previewFor(settled.revision), previewStale: true }));
  const { rb, view } = mount(controller);
  const reason = view.querySelector<HTMLElement>('.rb-foot-reason')!;
  const outcome = view.querySelector<HTMLElement>('.rb-foot-outcome')!;
  assert.equal(reason.hidden, false);
  assert.equal(outcome.hidden, true);
  rb.foot.say('Kept 1 object.');
  assert.equal(outcome.hidden, false);
  assert.ok(reason.classList.contains('visually-hidden'), 'the reason steps back while the result shows');
  assert.equal(view.querySelector('.rb-foot-open')!.getAttribute('aria-describedby'), reason.id, 'and still describes the button');
  const lines = [...view.querySelectorAll<HTMLElement>('.rb-foot > p')].filter(shown);
  assert.equal(lines.length, 1, 'one line of words between the counts and the actions');
});

test('a return from Design is said on the next mount of the same project, once', async () => {
  const controller = new StubController(reviewState({ plan: planSettled(), preview: previewFor(plan.revision) }));
  controller.openOutcome = { ok: true, sessionId: 'design:1', warnings: [] };
  const first = mount(controller);
  first.view.querySelector<HTMLButtonElement>('.rb-foot-open')!.click();
  await settle();
  assert.equal(said(first.view), 'Opened in Design.');
  // The handoff leaves the view; coming back mounts it again with a new context.
  const again = new StubController(reviewState({ plan: planSettled(), preview: previewFor(plan.revision) }));
  const second = mount(again);
  assert.equal(said(second.view), 'Opened in Design just now. Opening again makes a new revision.');
  assert.equal(second.announced.filter((line) => line.startsWith('Opened in Design just now')).length, 1);
  assert.equal(second.view.querySelector<HTMLElement>('.rb-foot-undo')!.hidden, true);
  // A third mount has nothing carried.
  const third = mount(new StubController(reviewState({ plan: planSettled(), preview: previewFor(plan.revision) })));
  assert.equal(third.view.querySelector<HTMLElement>('.rb-foot-outcome')!.hidden, true);
  assert.equal(project.id, again.state.project?.id);
  assert.equal(returnText(0, 60 * 60_000), 'Opened in Design. Opening again makes a new revision.', 'an hour later it no longer says just now');
});

test('on a phone the footer says what to review and the short action names', () => {
  const controller = new StubController(reviewState({ plan: planWithPending(), preview: previewFor(plan.revision + 1) }));
  const { rb, view } = mount(controller);
  rb.narrow = true;
  rb.render();
  const cards = rb.foot.toReviewCount();
  assert.equal(text(view.querySelector('.rb-foot-counts')), `${cards} to review`);
  assert.equal(text(view.querySelector('.rb-foot-accept')), 'Accept all');
  rb.foot.say('Kept 1 object.');
  assert.ok(view.querySelector('.rb-foot-info')!.classList.contains('rb-foot-info--yield'), 'the result stands where the counts were');
});

// ─── the top bar ─────────────────────────────────────────────────────────────

test('the bars are named landmarks: the header Project, the footer Finish', () => {
  const { view } = mount(new StubController(reviewState()));
  assert.equal(view.querySelector('.rb-top')!.getAttribute('aria-label'), 'Project');
  assert.equal(view.querySelector('.rb-foot')!.getAttribute('aria-label'), 'Finish');
});

test('Undo and Redo are icon buttons named, in words and tooltip, with the step they take', () => {
  const controller = new StubController(reviewState({
    history: { canUndo: true, canRedo: true, undo: { kind: 'decide', action: 'remove', count: 18 }, redo: { kind: 'accept', count: 1 } },
  }));
  const { view } = mount(controller);
  const undo = view.querySelector<HTMLButtonElement>('.rb-undo')!;
  const redo = view.querySelector<HTMLButtonElement>('.rb-redo')!;
  assert.ok(undo.classList.contains('lp-iconbtn'));
  assert.equal(text(undo), '', 'no visible words, so the bar never grows');
  assert.ok(undo.querySelector('svg'), 'the glyph');
  assert.equal(undo.getAttribute('aria-label'), 'Undo remove 18 objects');
  assert.equal(undo.title, 'Undo remove 18 objects');
  assert.equal(redo.getAttribute('aria-label'), 'Redo accept 1 suggestion');
  assert.equal(redo.title, 'Redo accept 1 suggestion');
  assert.equal(undo.disabled, false);
  undo.click();
  assert.ok(controller.calls.includes('undo'));
  controller.set({ ...controller.state, history: { canUndo: false, canRedo: false } });
  assert.equal(undo.getAttribute('aria-label'), 'Undo');
  assert.equal(undo.disabled, true);
  for (const step of [{ kind: 'accept' as const, count: 143 }, { kind: 'layout' as const, count: 24 }, { kind: 'preset' as const, count: 1 }]) {
    controller.set({ ...controller.state, history: { canUndo: true, canRedo: false, undo: step } });
    assert.equal(text(undo), '');
  }
  assert.equal(undo.getAttribute('aria-label'), 'Undo apply a preset');
});

test('Undo and Redo have words for every kind of step, including the kinds the controller adds next', () => {
  const cases: Array<[Parameters<typeof undoLabel>[0], string]> = [
    [{ kind: 'layout', count: 24 }, 'Undo layout change on 24 slides'],
    [{ kind: 'move', count: 1 }, 'Undo move slide'],
    [{ kind: 'colour', count: 3 }, 'Undo 3 colour changes'],
    [{ kind: 'theme', count: 1 }, 'Undo deck theme change'],
    [{ kind: 'ground', count: 1 }, 'Undo background change on 1 slide'],
    [{ kind: 'ground', count: 4 }, 'Undo background change on 4 slides'],
    [{ kind: 'arrangement', count: 1 }, 'Undo arrangement change on 1 slide'],
    [{ kind: 'auto-match', count: 8 }, 'Undo match 8 slides to their layouts'],
    [{ kind: 'auto-match', count: 1 }, 'Undo match 1 slide to its layout'],
    [{ kind: 'text', count: 1 }, 'Undo text correction'],
    [{ kind: 'text', count: 2 }, 'Undo 2 text corrections'],
    [{ kind: 'reset', count: 1 }, 'Undo reset 1 slide'],
    [{ kind: 'reset', count: 3 }, 'Undo reset 3 slides'],
    [undefined, 'Undo'],
  ];
  for (const [step, words] of cases) assert.equal(undoLabel(step), words);
  assert.equal(redoLabel({ kind: 'theme', count: 1 }), 'Redo deck theme change');
  const { rb } = mount(new StubController(reviewState()));
  assert.equal(rb.top.stepDone('undo', { kind: 'auto-match', count: 8 }), 'Undone: match 8 slides to their layouts.');
  assert.equal(rb.top.stepDone('redo', { kind: 'ground', count: 1 }), 'Redone: background change on 1 slide.');
});

test('the top bar names the project and the design system, the neutral master in brackets', () => {
  const controller = new StubController(reviewState());
  const { view } = mount(controller);
  assert.equal(text(view.querySelector('.rb-top-name')), 'Quarterly review');
  assert.equal(text(view.querySelector('.rb-top-system')), 'Design system: Lolly Start (neutral master)');
  assert.ok(view.querySelector('.rb-top [data-back-pill]'), 'the shared back pill');
  assert.ok(view.querySelector('.rb-top .rb-mode-slot'), 'the mode slot is left for keep.ts');
  assert.equal(view.querySelectorAll('.rb-top .help-tip').length, 0, 'no info button in the bar this module draws');
});

test('the save state is words only, and nothing on screen while it is fine', () => {
  const controller = new StubController(reviewState({ save: { kind: 'saved', revision: 1 } }));
  const { view, announced } = mount(controller);
  const save = view.querySelector<HTMLElement>('.rb-save')!;
  const action = view.querySelector<HTMLButtonElement>('.rb-save-action')!;
  // Fine: a screen reader hears it, a sighted person sees nothing.
  assert.equal(text(view.querySelector('.rb-save-text')), 'Saved on this device');
  assert.ok(save.classList.contains('visually-hidden'));
  assert.equal(save.querySelector('svg'), null, 'never a glyph');
  assert.equal(action.hidden, true);

  controller.set({ ...controller.state, save: { kind: 'saving' } });
  assert.equal(text(view.querySelector('.rb-save-text')), 'Saving');
  assert.equal(save.classList.contains('visually-hidden'), false);
  assert.equal(shown(save), true);

  controller.set({ ...controller.state, save: { kind: 'held', reason: 'quota' } });
  assert.equal(text(view.querySelector('.rb-save-text')), 'Not saved: storage is full');
  assert.equal(action.hidden, false);
  assert.equal(text(action), 'Download .lolly');
  assert.ok(announced.includes('Not saved: storage is full'), 'a state that needs the person is said as it arrives');

  controller.set({ ...controller.state, save: { kind: 'stale' } });
  assert.equal(text(view.querySelector('.rb-save-text')), 'Changed in another tab');
  assert.equal(text(action), 'Reload');
  action.click();
  assert.ok(controller.calls.includes('reload'));
  assert.equal(save.querySelector('svg'), null);
});

test('the project menu offers a newer version, the presets, the shortcuts and the modes once a plan is open', async () => {
  // With no preset on offer, Choose a preset is not in the menu: it would do nothing.
  const bare = new StubController(reviewState());
  const { view: plain } = mount(bare);
  await settle();
  const more = plain.querySelector<HTMLButtonElement>('.rb-top-more')!;
  assert.equal(more.getAttribute('aria-haspopup'), 'menu');
  more.click();
  const without = [...document.querySelectorAll<HTMLElement>('.rb-menu .folder-menu-item')].map((item) => text(item));
  assert.equal(without.includes('Choose a preset'), false, 'no choice without a preset to choose');
  assert.ok(without.includes('Save as my preset'));
  assert.ok(without.includes('About Renovate and Keep'), 'the paragraph the info button held');
  for (const menu of document.querySelectorAll('.rb-menu')) menu.remove();

  const controller = new StubController(reviewState());
  controller.presetList = [{ id: 'tidy', name: 'Tidy', origin: 'pack' }];
  const { view } = mount(controller);
  await settle();
  view.querySelector<HTMLButtonElement>('.rb-top-more')!.click();
  const labels = [...document.querySelectorAll<HTMLElement>('.rb-menu .folder-menu-item')].map((item) => text(item));
  assert.ok(labels.includes('Open a newer version'));
  assert.ok(labels.includes('Choose a preset'));
  assert.ok(labels.includes('Save as my preset'));
  assert.ok(labels.includes('Keyboard shortcuts'), 'the sheet ? opens, from the menu too');
  assert.ok(labels.includes('Download .lolly'));
  assert.ok(labels.includes('Close project'));
  assert.ok(labels.includes('Delete project'));
  // The newer version is a file pick, read through the controller.
  const input = view.querySelector<HTMLInputElement>('.rb-top input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [new dom.window.File(['PK'], 'v2.pptx')], configurable: true });
  input.dispatchEvent(new dom.window.Event('change'));
  await settle();
  assert.ok(controller.calls.includes('newer:v2.pptx'));
  for (const menu of document.querySelectorAll('.rb-menu')) menu.remove();
});

test('About Renovate and Keep opens the standard notice dialog with the two modes in words', async () => {
  const { view } = mount(new StubController(reviewState()));
  view.querySelector<HTMLButtonElement>('.rb-top-more')!.click();
  const about = [...document.querySelectorAll<HTMLButtonElement>('.rb-menu .folder-menu-item')].find((item) => text(item) === 'About Renovate and Keep')!;
  about.click();
  const dialog = await openDialog();
  assert.match(text(dialog), /Renovate the layout: Rebuilds each slide on the slide master\./);
  assert.match(text(dialog), /Keep the design: Swaps in the theme, colours and fonts\./);
  dialog.querySelector<HTMLButtonElement>('[data-act="ok"]')!.click();
  await settle();
  for (const menu of document.querySelectorAll('.rb-menu')) menu.remove();
});

// ─── presets, whose results show on the outcome line ────────────────────────

test('a preset is chosen from a single-choice list with one Apply, and the result shows in the footer', async () => {
  const controller = new StubController(reviewState({ plan: { ...planSettled(), presetId: 'tidy' }, preview: previewFor(plan.revision) }));
  controller.presetList = [
    { id: 'tidy', name: 'Tidy', origin: 'pack' },
    { id: 'mine/quarterly', name: 'Quarterly', origin: 'personal' },
  ];
  const { rb, view } = mount(controller);
  await settle();
  const choosing = rb.intake.choosePreset('apply');
  const dialog = await openDialog();
  const radios = [...dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  assert.deepEqual(radios.map((one) => one.value), ['__none__', 'tidy', 'mine/quarterly'], 'one row per preset, and none');
  assert.equal(radios.find((one) => one.checked)?.value, 'tidy', 'the current preset is the checked row, never a filled button');
  assert.equal(dialog.querySelectorAll('.modal-primary').length, 1, 'one primary action');
  assert.match(text(dialog.querySelector('input[value="mine/quarterly"]')?.closest('label') ?? null), /Quarterly\s*Saved on this device/, 'where it came from on a line of its own');
  const mine = radios[2];
  assert.ok(mine);
  mine.checked = true;
  dialog.querySelector<HTMLButtonElement>('[data-act="ok"]')!.click();
  await choosing;
  assert.ok(controller.calls.includes('applyPreset:mine/quarterly'));
  const outcome = view.querySelector<HTMLElement>('.rb-foot-outcome')!;
  assert.equal(outcome.hidden, false, 'a sighted person sees the result');
  assert.match(said(view), /^Applied Quarterly\./);
});

test('Save as my preset asks again on a blank name, and says where it saved', async () => {
  const controller = new StubController(reviewState({ plan: planSettled(), preview: previewFor(plan.revision) }));
  const { rb, view } = mount(controller);
  await settle();
  const saving = rb.intake.savePreset();
  let dialog = await openDialog();
  const input = dialog.querySelector<HTMLInputElement>('.modal-input')!;
  assert.equal(input.value, '', 'no project name typed in for the person');
  dialog.querySelector<HTMLButtonElement>('[data-act="ok"]')!.click();
  await settle();
  dialog = await openDialog();
  assert.match(text(dialog), /Type a name for the preset\./, 'a blank name is refused in words, and the dialog stays');
  dialog.querySelector<HTMLInputElement>('.modal-input')!.value = 'Quarterly';
  dialog.querySelector<HTMLButtonElement>('[data-act="ok"]')!.click();
  await saving;
  assert.ok(controller.calls.includes('savePreset:Quarterly'));
  assert.equal(said(view), 'Saved Quarterly as a preset on this device.');
});
