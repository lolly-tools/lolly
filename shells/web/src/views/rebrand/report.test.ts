// SPDX-License-Identifier: MPL-2.0
/**
 * The #/rebrand report drawer (plan 274 section 4, plan 275 close-out sections 2.7 and
 * 3.9) against the real modules: Removed objects first and grouped by slide with
 * pictures, the counts in their close-out words, the compiled codes as count sentences,
 * the preview's `review.applied-unreviewed` left out in review, the section heads, the
 * virtual rows of a long deck, Esc and its focus fallback, and the Design documents.
 *
 * The state is built from the committed samples (tests/fixtures/rebrand/samples) and
 * the engine's review model over `StubController` (`frameHarness` in
 * shared.test-utils.ts), so the numbers on screen are checked against `planSummary`
 * rather than against figures written into the test.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/report.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { planSummary } from '@lolly/engine';
import type { CompiledDeckV1, DeckCensusV1, RenovationPlanV1, SourceDeckV1 } from '@lolly-tools/core/rebrand-v1';
import {
  StubController, census, plan, project, reviewState, sample, source,
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

const { mount, settle, text } = await frameHarness();

const compiled = (): CompiledDeckV1 => sample<CompiledDeckV1>('compiled.json');

/** The sample plan with removals: two by a person, one accepted as proposed, one by the rule. */
function planWithRemovals(): RenovationPlanV1 {
  const copy = structuredClone(plan);
  const [one, two] = copy.slides;
  const title = one!.objects[0]!;
  title.decision = 'remove';
  title.review = 'accepted';
  title.author = 'user';
  const mark = one!.objects[1]!;
  mark.decision = 'remove';
  mark.review = 'accepted';
  mark.author = 'user';
  const chart = two!.objects[0]!;
  chart.proposal = 'remove';
  chart.decision = 'remove';
  chart.review = 'accepted';
  chart.author = 'user';
  const caption = two!.objects[1]!;
  caption.proposal = 'remove';
  caption.review = 'accepted';
  caption.author = 'rule';
  return copy;
}

const sectionIds = (drawer: HTMLElement): string[] => [...drawer.querySelectorAll<HTMLElement>('.rb-report-sec')].map((sec) => sec.dataset.sec ?? '');
const flag = (drawer: HTMLElement, id: string): string => text(drawer.querySelector(`[data-sec="${id}"] .rb-report-flag`));
const isOpen = (drawer: HTMLElement, id: string): boolean => drawer.querySelector(`[data-sec="${id}"] .lp-sec-head`)?.getAttribute('aria-expanded') === 'true';

test('the report opens on Removed objects, grouped by slide under a proposed picture, each row with its crop', () => {
  const removals = planWithRemovals();
  const controller = new StubController(reviewState({ plan: removals, preview: { deck: compiled(), planRevision: removals.revision } }));
  const { rb, view } = mount(controller);
  view.querySelector<HTMLButtonElement>('.rb-foot-report')!.click();
  const drawer = view.querySelector<HTMLElement>('.rb-report')!;
  assert.equal(sectionIds(drawer)[0], 'removed', 'Removed objects comes first');
  assert.ok(isOpen(drawer, 'removed'), 'and is open');
  assert.equal(flag(drawer, 'removed'), '4');
  const heads = [...drawer.querySelectorAll<HTMLButtonElement>('[data-sec="removed"] .rb-report-group')];
  // The sentence, then who removed them as a second line.
  assert.deepEqual(heads.map((head) => [text(head.querySelector('.rb-report-group-line')), text(head.querySelector('.rb-report-group-who'))]), [
    // Slide 1: a person removed the title outright, and the mark against its Replace proposal.
    ['Slide 1: 2 objects removed', 'By you'],
    // Slide 2: one accepted as proposed, one the rule's own; the first by count order wins the head.
    ['Slide 2: 2 objects removed', 'Proposed by the rule, accepted by you'],
  ]);
  for (const head of heads) assert.ok(head.querySelector('.rb-report-thumb svg'), 'each group shows its proposed slide');
  const second = heads[1]!.closest('.rb-report-block')!;
  const rows = [...second.querySelectorAll<HTMLButtonElement>('.rb-report-obj')];
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.querySelector('.rb-report-crop')), 'each row has its crop cell');
  // The author shows on a row only when it differs from the group's.
  assert.equal(rows.filter((row) => row.querySelector('.rb-report-note')).length, 1);
  assert.match(text(rows.find((row) => row.querySelector('.rb-report-note')) ?? null), /by suggestion$/);
  rows[0]!.click();
  assert.equal(rb.sel.objectId, rows[0]!.dataset.objectId, 'a row selects its object');
  heads[0]!.click();
  assert.equal(rb.sel.slideId, 'ppt/slides/slide1.xml', 'a group head selects its slide');
  assert.equal(rb.sel.objectId, null);
});

test('the counts read in the close-out words and equal planSummary; the lists the sections give are not counted twice', () => {
  const controller = new StubController(reviewState());
  const { rb, view } = mount(controller);
  view.querySelector<HTMLButtonElement>('.rb-foot-report')!.click();
  const drawer = view.querySelector<HTMLElement>('.rb-report')!;
  assert.equal(drawer.hidden, false);
  assert.equal(isOpen(drawer, 'counts'), false, 'Counts is folded');
  const summary = planSummary(plan, source, census);
  const count = (key: string): number => Number(drawer.querySelector<HTMLElement>(`[data-count="${key}"]`)?.dataset.value);
  const words = (key: string): string => text(drawer.querySelector(`[data-count="${key}"]`));
  assert.equal(summary.slides.included, summary.slides.total, 'the sample includes every slide');
  assert.equal(words('slides.total'), `${summary.slides.total} slides, all included`);
  assert.equal(drawer.querySelector('[data-count="slides.included"]'), null, 'no Included row beside it');
  assert.equal(count('objects.keep'), summary.objects.keep);
  assert.equal(count('objects.replace'), summary.objects.replace);
  assert.equal(words('review.attention'), `Objects needing attention${summary.review.attention}`);
  assert.equal(count('review.unreviewed'), summary.review.unreviewed);
  assert.equal(count('review.accepted'), summary.review.accepted);
  assert.match(words('colours.assigned'), new RegExp(`^${summary.colours.assigned} colour uses? reassigned$`));
  assert.equal(count('colours.unresolved'), summary.colours.unresolved);
  assert.equal(count('fonts.substituted'), summary.fonts.substituted);
  for (const key of ['objects.remove', 'objects.unresolved', 'objects.unplaced']) {
    assert.equal(drawer.querySelector(`[data-count="${key}"]`), null, `${key} is the flag of its own section`);
  }
  assert.equal(flag(drawer, 'removed'), String(summary.objects.remove));
  assert.equal(flag(drawer, 'unresolved'), String(summary.objects.unresolved));
  const unresolved = [...drawer.querySelectorAll<HTMLButtonElement>('[data-sec="unresolved"] .rb-report-obj')];
  assert.equal(unresolved.length, summary.objects.unresolved);
  assert.ok(isOpen(drawer, 'unresolved'), 'Objects not drawn is open while it holds something');
  assert.equal(text(unresolved[0]!), 'Chart slide 2');
  unresolved[0]!.click();
  assert.equal(rb.sel.objectId, unresolved[0]!.dataset.objectId);
  assert.equal(rb.sel.slideId, rb.derived?.objects.get(rb.sel.objectId!)?.slideId);
});

test('some slides left out: two rows, with the words every other surface uses', () => {
  const copy = structuredClone(plan);
  copy.slides[1]!.include = false;
  const controller = new StubController(reviewState({ plan: copy }));
  const { rb, view } = mount(controller);
  rb.report.open();
  const drawer = view.querySelector<HTMLElement>('.rb-report')!;
  assert.equal(text(drawer.querySelector('[data-count="slides.included"]')), 'Slides included1');
  assert.equal(text(drawer.querySelector('[data-count="slides.excluded"]')), 'Slides left out1');
  assert.equal(drawer.querySelector('[data-count="slides.total"]'), null);
});

test('the proposed slides: new slides and not placed are counted and listed; codes read as count sentences and fold their objects', () => {
  const deck = compiled();
  const controller = new StubController(reviewState({ preview: { deck, planRevision: plan.revision } }));
  const { rb, view } = mount(controller);
  rb.report.open();
  const drawer = view.querySelector<HTMLElement>('.rb-report')!;
  assert.equal(Number(drawer.querySelector<HTMLElement>('[data-count="slides.continuation"]')?.dataset.value), deck.frames.filter((frame) => frame.continuation).length);
  assert.deepEqual(sectionIds(drawer).slice(0, 5), ['removed', 'unplaced', 'unresolved', 'counts', 'compiled']);
  assert.equal(flag(drawer, 'unplaced'), String(deck.tray.length));
  const unplaced = [...drawer.querySelectorAll<HTMLButtonElement>('[data-sec="unplaced"] .rb-report-obj')];
  assert.equal(unplaced.length, deck.tray.length);
  assert.match(text(unplaced[0]!), /slide 1$/);
  unplaced[0]!.click();
  assert.equal(rb.sel.objectId, deck.tray[0]!.sourceObjectId, 'a row selects the object');
  assert.equal(isOpen(drawer, 'compiled'), false, 'In the proposed slides is folded');
  const code = (id: string): HTMLElement | null => drawer.querySelector(`[data-code="${id}"]`);
  assert.equal(text(code('object.surplus-continuation')?.querySelector('.rb-report-code-text') ?? null), '1 object continues on a new slide.');
  assert.equal(text(code('colour.unresolved')?.querySelector('.rb-report-code-text') ?? null), '1 colour has no match in the design system.');
  assert.equal(code('object.retained'), null, 'what the counts carry is not repeated');
  assert.equal(code('export.not-verified'), null, 'a code about the file is left out');
  // Each code folds its objects under its sentence.
  const fold = code('object.unresolved')!.querySelector<HTMLButtonElement>('button.rb-report-code')!;
  const body = code('object.unresolved')!.querySelector<HTMLElement>('.rb-report-block')!;
  assert.equal(fold.getAttribute('aria-expanded'), 'false');
  assert.equal(body.hidden, true);
  fold.click();
  assert.equal(body.hidden, false);
  const row = body.querySelector<HTMLButtonElement>('.rb-report-obj');
  assert.equal(text(row), 'Chart slide 2', 'a compiled row names its object');
  row!.click();
  assert.equal(rb.sel.objectId, 'ppt/slides/slide2.xml.3', 'and selects it');
});

test('review.applied-unreviewed is left out while the project is in review, and listed once it has been compiled', () => {
  const deck = compiled();
  deck.report.entries.push({ code: 'review.applied-unreviewed', severity: 'info', message: 'A suggestion was applied without review.', objectId: 'ppt/slides/slide2.xml.5', slideId: 'ppt/slides/slide2.xml' } as CompiledDeckV1['report']['entries'][number]);
  const inReview = new StubController(reviewState({ preview: { deck, planRevision: plan.revision } }));
  const first = mount(inReview);
  first.rb.report.open();
  assert.equal(project.checkpoint.stage, 'review');
  assert.equal(first.view.querySelector('[data-code="review.applied-unreviewed"]'), null);
  const done = new StubController(reviewState({
    project: { ...project, checkpoint: { ...project.checkpoint, stage: 'done' } },
    preview: { deck, planRevision: plan.revision },
  }));
  const second = mount(done);
  second.rb.report.open();
  assert.equal(text(second.view.querySelector('[data-code="review.applied-unreviewed"] .rb-report-code-text')), '1 suggestion was applied without review.');
});

test('every section head carries its glyph, its name, a count flag where it counts and the caret', () => {
  const controller = new StubController(reviewState({
    preview: { deck: compiled(), planRevision: plan.revision },
    project: { ...project, designSessionIds: ['design:a'] },
    versions: [{ id: 'old-1', name: 'Quarterly review', stage: 'review' }],
  }));
  const { rb, view } = mount(controller);
  rb.report.open();
  const heads = [...view.querySelectorAll<HTMLButtonElement>('.rb-report-sec > .lp-sec-head')];
  assert.ok(heads.length >= 8);
  for (const head of heads) {
    const name = text(head.querySelector('.lp-sec-name'));
    assert.ok(head.firstElementChild?.localName === 'svg', `${name} leads with its glyph`);
    assert.ok(name, 'and has a name');
    assert.ok(head.querySelector('.lp-caret'), `${name} carries the caret`);
    assert.equal(head.hasAttribute('aria-haspopup'), false, 'a fold is never a popup');
    assert.ok(head.getAttribute('aria-controls'), 'and names what it folds');
  }
  for (const id of ['removed', 'unplaced', 'unresolved', 'sessions', 'versions']) assert.match(flag(view.querySelector('.rb-report')!, id), /^\d+$/, `${id} has a count`);
  // A fold turns in place.
  const counts = view.querySelector<HTMLButtonElement>('[data-sec="counts"] .lp-sec-head')!;
  counts.click();
  assert.equal(counts.getAttribute('aria-expanded'), 'true');
  assert.equal(view.querySelector<HTMLElement>('#rb-report-counts')!.hidden, false);
});

// ─── a long deck ─────────────────────────────────────────────────────────────

/** A deck of `n` slides, each with one object the rule removes, from the first sample slide. */
function longDeck(n: number): { source: SourceDeckV1; census: DeckCensusV1; plan: RenovationPlanV1 } {
  const base = source.slides[0]!;
  const baseRow = plan.slides[0]!;
  const slides = Array.from({ length: n }, (_, i) => {
    const id = `long/slide${i + 1}`;
    return {
      ...structuredClone(base),
      id,
      index: i,
      objects: base.objects.map((object, j) => ({ ...structuredClone(object), id: `${id}.${j}` })),
      readingOrder: base.objects.map((_object, j) => `${id}.${j}`),
    };
  });
  const planSlides = slides.map((slide) => ({
    ...structuredClone(baseRow),
    id: slide.id,
    objects: baseRow.objects.map((row, j) => ({
      ...structuredClone(row),
      id: `${slide.id}.${j}`,
      proposal: j === 0 ? 'keep' as const : 'remove' as const,
      decision: undefined,
      review: 'accepted' as const,
      author: 'rule' as const,
    })),
  }));
  const censusObjects = slides.flatMap((slide) => census.objects
    .filter((object) => object.slideId === base.id)
    .map((object) => ({ ...structuredClone(object), id: object.id.replace(base.id, slide.id), slideId: slide.id, groupId: undefined })));
  return {
    source: { ...source, slides },
    census: { ...census, objects: censusObjects, groups: [] },
    plan: { ...plan, slides: planSlides },
  };
}

class FakeObserver {
  static last: FakeObserver | null = null;
  readonly observed: Element[] = [];
  readonly callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;
  constructor(callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void) {
    this.callback = callback;
    FakeObserver.last = this;
  }
  observe(target: Element): void { this.observed.push(target); }
  unobserve(): void {}
  disconnect(): void {}
  report(target: Element, isIntersecting: boolean): void { this.callback([{ target, isIntersecting }]); }
}

test('45 slide groups mount as virtual rows: a few at once, the rest as they near the window, and they let go again', () => {
  const deck = longDeck(45);
  Object.defineProperty(globalThis, 'IntersectionObserver', { value: FakeObserver, configurable: true, writable: true });
  try {
    const controller = new StubController(reviewState({ source: deck.source, census: deck.census, plan: deck.plan }));
    const { rb, view } = mount(controller);
    rb.report.open();
    const blocks = [...view.querySelectorAll<HTMLElement>('[data-sec="removed"] .rb-report-block')];
    assert.equal(blocks.length, 45, 'one block per slide');
    // Past the first three slides the rest fold behind one row, so the sections after stay in view.
    assert.equal(blocks.filter((one) => !one.hidden).length, 3);
    const more = view.querySelector<HTMLButtonElement>('[data-sec="removed"] [data-more]');
    assert.equal(text(more), '42 more slides');
    more!.click();
    assert.equal(blocks.filter((one) => !one.hidden).length, 45);
    assert.equal(view.querySelector('[data-sec="removed"] [data-more]'), null);
    assert.equal(text(blocks[44]!.querySelector('.rb-report-group-line')), 'Slide 45: 1 object removed', 'every group head is there to read');
    const mounted = (): number => blocks.filter((one) => one.dataset.mount === 'on').length;
    assert.ok(mounted() <= 6, `only the first few mount at once (${mounted()})`);
    assert.equal(view.querySelectorAll('[data-sec="removed"] .rb-report-obj').length, mounted(), 'rows exist only in mounted blocks');
    const far = blocks[30]!;
    assert.equal(far.querySelector('.rb-report-obj'), null);
    assert.equal(far.querySelector<HTMLElement>('.rb-report-rows')!.style.getPropertyValue('--rb-report-rows'), '1', 'an empty block keeps its rows\' height');
    const observer = FakeObserver.last!;
    assert.ok(observer.observed.includes(far), 'every block is watched');
    observer.report(far, true);
    assert.equal(far.dataset.mount, 'on');
    assert.ok(far.querySelector('.rb-report-obj'), 'a block near the window mounts its rows');
    observer.report(far, false);
    assert.equal(far.dataset.mount, 'off');
    assert.equal(far.querySelector('.rb-report-obj'), null, 'and lets them go when it leaves');
    // A block that holds focus keeps its rows.
    observer.report(far, true);
    far.querySelector<HTMLButtonElement>('.rb-report-obj')!.focus();
    observer.report(far, false);
    assert.equal(far.dataset.mount, 'on');
  } finally {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
  }
});

// ─── focus ───────────────────────────────────────────────────────────────────

test('Esc closes the report drawer and hands focus back to what opened it', () => {
  const controller = new StubController(reviewState());
  const { rb, view } = mount(controller);
  const opener = view.querySelector<HTMLButtonElement>('.rb-foot-report')!;
  opener.focus();
  opener.click();
  const drawer = view.querySelector<HTMLElement>('.rb-report')!;
  assert.equal(rb.reportOpen, true);
  assert.equal(document.activeElement, drawer.querySelector('.rb-report-close'), 'focus moves into the drawer');
  // While open it is a modal dialog, so a screen reader's cursor stays inside it.
  assert.equal(drawer.getAttribute('role'), 'dialog');
  assert.equal(drawer.getAttribute('aria-modal'), 'true');
  assert.equal(document.getElementById(drawer.getAttribute('aria-labelledby') ?? '')?.textContent, 'Report');
  (document.activeElement as HTMLElement).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(rb.reportOpen, false);
  assert.equal(drawer.hidden, true);
  assert.equal(drawer.getAttribute('role'), null);
  assert.equal(drawer.getAttribute('aria-modal'), null);
  assert.equal(document.activeElement, opener);
});

test('when what opened the report is gone, Esc hands focus to the project actions button', () => {
  const controller = new StubController(reviewState());
  const { rb, view } = mount(controller);
  // A menu row opens the report and the menu closes behind it.
  const row = document.createElement('button');
  view.append(row);
  row.focus();
  rb.report.open();
  row.remove();
  (document.activeElement as HTMLElement).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(rb.reportOpen, false);
  assert.equal(document.activeElement, view.querySelector('.rb-top-more'));
});

test('the report lists every Design document newest first, what changed, and the other versions', async () => {
  const controller = new StubController(reviewState({
    project: { ...project, designSessionIds: ['design:a', 'design:b'] },
    compileDiff: {
      from: 2,
      to: 3,
      framesAdded: [],
      framesRemoved: ['frame-1'],
      framesMoved: ['frame-3'],
      objectsChanged: ['ppt/slides/slide2.xml.3'],
      objectsAdded: [],
      objectsRemoved: [],
      coloursAdded: ['#123456'],
      coloursRemoved: [],
      fontsAdded: ['Outfit'],
      fontsRemoved: ['Calibri'],
    },
    versions: [{ id: 'old-1', name: 'Quarterly review', sourceName: 'quarterly-v1.pptx', stage: 'review' }],
  }));
  const { rb, view } = mount(controller);
  rb.report.open();
  const drawer = view.querySelector<HTMLElement>('.rb-report')!;
  assert.deepEqual(sectionIds(drawer).slice(-3), ['sessions', 'changes', 'versions'], 'Opened in Design, Changed since, Other versions come last');
  const sessions = [...view.querySelectorAll<HTMLElement>('[data-sec="sessions"] [data-session]')];
  assert.deepEqual(sessions.map((one) => one.dataset.session), ['design:b', 'design:a'], 'newest first');
  assert.equal(text(sessions[0] ?? null), 'Revision 2, the latest');
  const changes = text(view.querySelector('[data-sec="changes"]'));
  assert.match(changes, /The new Design document sits beside the last one, which is not changed\./);
  // A slide is left out, an object is removed: the words every other surface uses.
  assert.match(changes, /1 slide left out/);
  assert.match(changes, /1 slide moved/);
  assert.match(changes, /1 object changed/);
  assert.match(changes, /Colours: 1 new/);
  assert.doesNotMatch(changes, /0 no longer used/, 'a count of nought is left unsaid');
  assert.match(changes, /Fonts: Outfit new, Calibri no longer used/);
  // A row that leaves the view carries the door's chevron, unlike a row that selects.
  assert.ok(sessions[0]?.classList.contains('lp-door'), 'a Design document row is a door');
  assert.ok(sessions[0]?.querySelector('svg'), 'with its chevron');
  const version = view.querySelector<HTMLButtonElement>('[data-sec="versions"] [data-project-id="old-1"]');
  assert.equal(text(version), 'Quarterly review, from quarterly-v1.pptx');
  version?.click();
  await settle();
  assert.ok(controller.calls.includes('open:old-1'), 'the old version stays reachable');
});

test('a group that folds to one noun names it in its head, and a section with nothing in it is no fold', async () => {
  const { groupLine } = await import('./report.ts');
  assert.equal(groupLine({ slide: 1, objects: new Array(5) }, 'shapes'), 'Slide 1: 5 shapes removed');
  assert.equal(groupLine({ slide: 4, objects: new Array(1) }), 'Slide 4: 1 object removed');
  // Nothing removed from the plan that is not drawn: the head and its 0, with no fold
  // that opens on nothing, and no sentence that says all is well.
  const clean = structuredClone(plan);
  const controller = new StubController(reviewState({ plan: clean }));
  const { rb, view } = mount(controller);
  const derived = rb.derived;
  assert.ok(derived);
  for (const object of derived.objects.values()) object.fidelity = 'editable';
  rb.memo.report = '';
  rb.report.open();
  const drawer = view.querySelector<HTMLElement>('.rb-report')!;
  const still = drawer.querySelector<HTMLElement>('[data-sec="unresolved"] .lp-sec-head');
  assert.ok(still);
  assert.equal(still.tagName, 'DIV', 'not a button');
  assert.equal(still.querySelector('.lp-caret'), null);
  assert.equal(text(still.querySelector('.rb-report-flag')), '0');
  assert.doesNotMatch(drawer.textContent ?? '', /Every kept object can be shown|raised nothing beyond the counts/);
});
