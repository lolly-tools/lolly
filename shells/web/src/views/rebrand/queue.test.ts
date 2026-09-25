// SPDX-License-Identifier: MPL-2.0
/**
 * The #/rebrand queue (plan 274 section 4) against the real modules: its tabs, its
 * cards and what selecting one selects.
 *
 * The state is the real pipeline over tests/fixtures/rebrand/adversarial.pptx, and the
 * controller a stub that records each command and answers ok (`reviewHarness` in
 * shared.test-utils.ts), so what these tests pin is which command a control sends and
 * with what, never what the controller does with it.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/queue.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { RenovationPlanV1 } from '@lolly-tools/core/rebrand-v1';
import { reviewHarness, rebrandCss } from './shared.test-utils.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const key of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Element', 'Node', 'Event',
  'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'DOMParser', 'DOMRect', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}

const { RUN, MARK_GROUP, stateFrom, mount, settle, deckWithSurplus, firstSlide, toReviewCount } = await reviewHarness();
const { queueWithLineage } = await import('../../lib/rebrand/controller.ts');

test('the queue lists needs-attention items first, and a group item names its count', () => {
  const { rb, unmount } = mount(stateFrom());
  const items = [...rb.els.queue.querySelectorAll<HTMLElement>('.rb-q-item[data-item]')];
  assert.ok(items.length > 0, 'the queue lists items');
  const sections = items.map((item) => item.dataset.section);
  const firstOther = sections.findIndex((section) => section !== 'attention');
  assert.equal(sections[0], 'attention');
  if (firstOther >= 0) assert.ok(sections.slice(firstOther).every((section) => section !== 'attention'), 'no attention item after a suggestion');
  const group = items.find((item) => item.dataset.item === MARK_GROUP?.id);
  assert.ok(group, 'the mark group is listed');
  const words = group.querySelector('.rb-q-text')?.textContent ?? '';
  assert.match(words, /^Replace the same mark on 3 slides/);
  // The title already says the count, so the card has no second line.
  assert.equal(group.querySelector('.rb-q-meta'), null, 'no line that repeats the count');
  assert.doesNotMatch(words, /Slides 1, 2 and 3/);
  // The state is the group heading's; the card keeps it for a screen reader only.
  assert.match(words, /Needs attention/);
  assert.equal(group.querySelector('.rb-q-state'), null, 'no pill that repeats the heading');
  const headings = [...rb.els.queue.querySelectorAll('.rb-q-group')].map((h) => h.textContent);
  assert.equal(headings[0], 'Needs attention');
  const tab = rb.els.queue.querySelector<HTMLElement>('[data-tab="attention"]');
  assert.equal(tab?.getAttribute('role'), 'tab');
  assert.equal(tab?.getAttribute('aria-selected'), 'true');
  assert.equal(tab?.getAttribute('aria-controls'), 'rb-q-panel');
  assert.match(tab?.textContent ?? '', /^To review/);
  assert.equal(rb.els.queue.querySelector('[role="tablist"]')?.querySelectorAll('[tabindex="0"]').length, 1, 'one tab stop');
  // An arrow key moves to the next list.
  tab?.focus();
  tab?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  assert.equal(rb.queueTab, 'all');
  assert.equal(rb.els.queue.querySelector('[data-tab="all"]')?.getAttribute('aria-selected'), 'true');
  assert.equal((document.activeElement as HTMLElement | null)?.dataset.tab, 'all', 'focus follows the tab');
  unmount();
});

test('selecting a queue item selects its exemplar and its slide', () => {
  const { rb, unmount } = mount(stateFrom());
  const second = rb.els.queue.querySelectorAll<HTMLElement>('.rb-q-item[data-item]')[1];
  assert.ok(second);
  const item = rb.derived?.queue.find((one) => one.id === second.dataset.item);
  assert.ok(item);
  second.click();
  assert.equal(rb.sel.itemId, item.id);
  assert.equal(rb.sel.objectId, item.exemplar);
  assert.equal(rb.sel.slideId, rb.derived?.objects.get(item.exemplar)?.slideId);
  const current = rb.els.queue.querySelector<HTMLElement>('.rb-q-item[aria-current="true"]');
  assert.equal(current?.dataset.item, item.id);
  unmount();
});

test('when a focused queue item resolves and leaves the list, focus moves to the next item', () => {
  const { rb, unmount } = mount(stateFrom());
  const [first, second] = [...rb.els.queue.querySelectorAll<HTMLElement>('.rb-q-item[data-item]')];
  assert.ok(first && second);
  const item = rb.derived?.queue.find((one) => one.id === first.dataset.item);
  assert.ok(item);
  first.focus();
  const members = new Set(item.objectIds);
  const plan: RenovationPlanV1 = {
    ...RUN.plan,
    revision: RUN.plan.revision + 1,
    slides: RUN.plan.slides.map((slide) => ({
      ...slide,
      objects: slide.objects.map((row) => (members.has(row.id)
        ? { ...row, decision: row.proposal, review: 'accepted' as const, author: 'user' as const }
        : row)),
    })),
  };
  rb.state = { ...rb.state, plan, tick: 2 };
  rb.render();
  assert.equal(rb.els.queue.querySelector(`[data-item="${item.id}"]`), null, 'the resolved item left the list');
  assert.equal((document.activeElement as HTMLElement | null)?.dataset.item, second.dataset.item);
  unmount();
});

test('the queue opens with one item for what was not placed, and To review counts the cards still waiting', () => {
  const slide = firstSlide();
  const ids = slide.objects.map((object) => object.id).slice(0, 3);
  const { rb, unmount } = mount(stateFrom(RUN.plan, { preview: deckWithSurplus(ids) }));
  const first = rb.els.queue.querySelector<HTMLElement>('.rb-q-item');
  assert.ok(first?.hasAttribute('data-unplaced-item'), 'the not placed item leads the list');
  assert.match(first?.textContent ?? '', /3 objects not placed/);
  first?.click();
  assert.equal(rb.sel.objectId, ids[0]);
  const count = rb.els.queue.querySelector('[data-tab="attention"] .rb-q-count')?.textContent;
  // The not placed card asks for a look, not an answer, so the number counts the rest.
  const cards = rb.els.queue.querySelectorAll('.rb-q-item[data-item]').length;
  assert.equal(count, String(cards), 'the number beside the list counts the cards waiting for an answer');
  assert.equal(toReviewCount(rb), cards, 'and the footer says the same number');
  unmount();
});

test('a newer version shows the decisions it carried as a note, never as a card to review', () => {
  const plan = structuredClone(RUN.plan);
  const decided = plan.slides.flatMap((slide) => slide.objects).slice(0, 2);
  for (const row of decided) {
    row.decision = row.proposal;
    row.author = 'user';
    row.review = 'accepted';
  }
  plan.carryForward = { carried: decided.map((row) => row.id), needsReview: [] };
  const state = stateFrom(plan);
  const { rb, unmount } = mount(state);
  // The orchestrator adds the lineage items when it derives the review model.
  const derived = rb.derived;
  assert.ok(derived);
  derived.queue = queueWithLineage(derived.queue, plan, state.source);
  rb.memo.queue = '';
  rb.queue.render();
  assert.equal(rb.els.queue.querySelector('[data-item="lineage:carried"]'), null, 'no card');
  assert.match(rb.els.queue.querySelector('.rb-q-note')?.textContent ?? '', /^2 decisions from the last version still apply\.$/);
  assert.equal(rb.foot.reviewItems().some((item) => item.id === 'lineage:carried'), false, 'and it is never counted');
  unmount();
});

test('the not placed card has a picture column like every other card, and names where the object was', () => {
  const slide = firstSlide();
  const ids = slide.objects.map((object) => object.id).slice(0, 3);
  const { rb, unmount } = mount(stateFrom(RUN.plan, { preview: deckWithSurplus(ids) }));
  const card = rb.els.queue.querySelector<HTMLElement>('.rb-q-item[data-unplaced-item]');
  assert.ok(card);
  const other = rb.els.queue.querySelector<HTMLElement>('.rb-q-item[data-item]');
  assert.ok(other);
  const shape = (el: HTMLElement): string[] => [...el.children].map((child) => child.classList.item(0) ?? '');
  assert.deepEqual(shape(card), shape(other), 'the same two columns, picture then words');
  // A picture of the first object, never a glyph, unless the person asked for calm previews.
  assert.equal(card.querySelector('.rb-q-thumb')?.getAttribute('data-crop'), ids[0]);
  assert.equal(card.querySelector('.rb-q-thumb--glyph'), null);
  assert.equal(card.querySelector('.rb-q-meta')?.textContent, 'Slide 1');
  // What Design does with it is the hover sentence, not a line on the card.
  assert.match(card.title, /Design puts them on the Not placed artboard\.$/);
  // The stylesheet pins the words to the second column, so a picture that has not drawn cannot take their place.
  const css = rebrandCss();
  assert.match(css, /\.rb-q-item:not\(\.rb-q-item--slide\) > \.rb-q-text \{ grid-column: 2; \}/);
  unmount();
});

test('one object not placed names its slide and its noun', () => {
  const slide = firstSlide();
  const id = slide.objects[0]?.id;
  assert.ok(id);
  const { rb, unmount } = mount(stateFrom(RUN.plan, { preview: deckWithSurplus([id]) }));
  const card = rb.els.queue.querySelector<HTMLElement>('.rb-q-item[data-unplaced-item]');
  assert.match(card?.querySelector('.rb-q-title')?.textContent ?? '', /^1 object not placed$/);
  assert.match(card?.querySelector('.rb-q-meta')?.textContent ?? '', /^Slide 1, [a-z ]+$/);
  unmount();
});

test('the panel and the overlay name an object the way its queue item does, class read with kind', async () => {
  // nounFor is not on the engine barrel, so the view keeps a copy of its key rule.
  const { nounFor, REVIEW_NOUNS } = await import('../../../../../engine/src/rebrand-review.ts');
  const { nounKeyFor } = await import('./queue.ts');
  const { OBJECT_CLASSES, SOURCE_OBJECT_KINDS } = await import('@lolly-tools/core/rebrand-v1');
  for (const klass of OBJECT_CLASSES) {
    for (const kind of [...SOURCE_OBJECT_KINDS, undefined]) {
      assert.equal(REVIEW_NOUNS[nounKeyFor(klass, kind)].one, nounFor(klass, kind), `${klass} ${kind ?? 'no kind'}`);
    }
  }
});

// ─── plan 275 close-out section 3.3 ─────────────────────────────────────────

/** The elements in the list a Tab key can land on. */
function tabStops(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')].filter((el) => el.tabIndex >= 0);
}

/** One rule block of the joined rebrand stylesheets, by its exact selector. */
function ruleOf(css: string, selector: string): string {
  const at = css.indexOf(`\n  ${selector} {`);
  assert.ok(at >= 0, `a rule for ${selector}`);
  return css.slice(at, css.indexOf('}', at));
}

test('a card is one 52 px row with a 56 px picture; the title wraps and is never cut, and the second line gives way', () => {
  const css = rebrandCss();
  assert.match(css, /--rb-crop-w: calc\(56px \* var\(--a11y-fs\)\)/);
  assert.match(css, /--rb-q-row: calc\(52px \* var\(--a11y-fs\)\)/);
  const card = ruleOf(css, '.rb-q-item');
  assert.match(card, /grid-template-columns: var\(--rb-crop-w\) minmax\(0, 1fr\)/);
  assert.match(card, /min-height: var\(--rb-q-row\)/);
  const part = ruleOf(css, '.rb-q-part');
  assert.match(part, /text-overflow: ellipsis/, 'a part of the second line ends in an ellipsis');
  assert.match(part, /overflow: hidden/);
  const title = ruleOf(css, '.rb-q-title');
  assert.doesNotMatch(title, /text-overflow|white-space: nowrap|line-clamp/, 'the title is never cut');
  // The words hold two title lines: a wrapped title fills them, and the second line under
  // it is out of the box.
  const words = ruleOf(css, '.rb-q-text');
  assert.match(words, /max-height: 2lh;/);
  assert.match(words, /overflow: hidden;/);
  assert.match(ruleOf(css, '.rb-q-meta'), /white-space: nowrap/, 'the second line is one line');
});

test('a small object leads with its own crop, a region with its slide and the box outlined', () => {
  const { rb, unmount } = mount(stateFrom());
  const slots = [...rb.els.queue.querySelectorAll<HTMLElement>('.rb-q-item[data-item] [data-crop]')];
  assert.ok(slots.length > 2);
  let regions = 0;
  for (const slot of slots) {
    const id = slot.dataset.crop ?? '';
    const share = rb.compare.objectShare(id);
    const small = share < 0.08;
    // A box of a point is no measure of the object: the card shows the whole slide.
    assert.equal(slot.dataset.shape, share < 0.0001 ? 'slide' : small ? 'crop' : 'region', `${id} at ${share}`);
    if (share < 0.0001) continue;
    assert.ok(slot.querySelector('svg'), `${id} is drawn`);
    if (small) {
      assert.equal(slot.querySelector('.rb-crop-mark'), null, 'a crop needs no outline');
      continue;
    }
    regions += 1;
    assert.ok(slot.querySelector(':scope > svg .rb-crop-mark'), 'the region is outlined on its slide');
    // Under a quarter of the slide the outline is hard to find at 56 px, so its crop sits in the corner.
    assert.equal(Boolean(slot.querySelector('.rb-q-inset > svg')), rb.compare.objectShare(id) < 0.25);
  }
  assert.ok(regions > 0, 'the fixture has a region card (the charts)');
  const mark = rb.els.queue.querySelector<HTMLElement>(`[data-item="${MARK_GROUP?.id}"] .rb-q-thumb`);
  assert.equal(mark?.dataset.shape, 'crop', 'a mark card leads with the mark');
  // The Not placed card asks where the object was, so it always shows the slide outlined.
  const unplaced = rb.els.queue.querySelector<HTMLElement>('[data-unplaced-item] .rb-q-thumb');
  assert.ok(unplaced);
  const sized = rb.compare.objectShare(unplaced.dataset.crop ?? '') >= 0.0001;
  assert.equal(unplaced.dataset.shape, sized ? 'region' : 'slide');
  assert.equal(Boolean(unplaced.querySelector(':scope > svg .rb-crop-mark')), sized);
  unmount();
});

test('no glyph stands in for a picture unless the person asked for calm previews', () => {
  const { rb, unmount } = mount(stateFrom());
  assert.equal(rb.els.queue.querySelectorAll('.rb-q-thumb--glyph').length, 0);
  document.documentElement.setAttribute('data-a11y-previews', 'hidden');
  try {
    rb.memo.queue = '';
    rb.queue.render();
    const cards = rb.els.queue.querySelectorAll('.rb-q-item').length;
    assert.equal(rb.els.queue.querySelectorAll('.rb-q-item > .rb-q-thumb--glyph').length, cards, 'every card is a glyph');
    assert.equal(rb.els.queue.querySelectorAll('[data-crop], [data-slide-pic], .rb-q-thumb--wire').length, 0, 'and nothing is drawn');
  } finally {
    document.documentElement.removeAttribute('data-a11y-previews');
  }
  unmount();
});

test('a layout group card draws the wireframe of its layout and names the layout first', () => {
  const base = stateFrom();
  assert.ok(base.designSystem);
  const { rb, unmount } = mount(stateFrom(RUN.plan, { designSystem: { ...base.designSystem, neutralMaster: true } }));
  const cards = [...rb.els.queue.querySelectorAll<HTMLElement>('.rb-q-item[data-slide-item^="layout:"]')];
  assert.ok(cards.length > 0, 'the fixture has layout groups');
  for (const card of cards) {
    const thumb = card.querySelector('.rb-q-thumb');
    assert.ok(thumb?.classList.contains('rb-q-thumb--wire'), 'the wireframe, not the slide');
    assert.ok(thumb?.querySelector('svg'));
    assert.match(card.querySelector('.rb-q-title')?.textContent ?? '', /^[A-Z][^,]+, (slide \d+|\d+ slides)$/);
    // "Likely" is the one fact; a card that needs attention also says so, since it sits
    // under Layouts, whose head does not.
    const parts = [...card.querySelectorAll('.rb-q-part')].map((part) => part.textContent);
    assert.ok(parts.includes('Likely'), parts.join(' | '));
    assert.equal(card.closest('ul')?.previousElementSibling?.textContent, 'Layouts', 'under their own head, uncounted');
  }
  unmount();
});

test('the Match card shows its title with the count and one button, and retires itself when every slide matches', async () => {
  const { rb, calls, unmount } = mount(stateFrom());
  let counts = { count: 8, likely: 3, anyMatch: true, tooSmall: 0 };
  Object.assign(rb.controller, {
    autoMatchLayouts: async () => {
      calls.push({ name: 'autoMatchLayouts', args: [] });
      return { ok: true, touched: 8, skipped: 0 };
    },
  });
  rb.chooser = { ...rb.chooser, autoMatchCounts: () => counts };
  rb.memo.queue = '';
  rb.queue.render();
  const card = rb.els.queue.querySelector<HTMLElement>('.rb-q-match');
  assert.ok(card);
  assert.equal(card.parentElement?.firstElementChild, card, 'the first row of Layouts');
  assert.equal(card.previousElementSibling, null);
  assert.equal(card.closest('ul')?.previousElementSibling?.textContent, 'Layouts');
  assert.equal(card.querySelector('.rb-q-match-text')?.textContent, 'Match 8 slides to their suggested layouts');
  const button = card.querySelector<HTMLButtonElement>('button');
  assert.equal(card.querySelectorAll('button').length, 1, 'one button');
  assert.equal(card.querySelectorAll('svg').length, 0, 'no tally of wireframes');
  assert.equal(button?.textContent, 'Match');
  assert.ok(button?.classList.contains('btn--ghost'));
  assert.equal(button?.title, '3 of the 8 are likely matches. Check them after.');
  // Retired beside a layout card still to answer, it would contradict the card: not drawn.
  counts = { count: 0, likely: 0, anyMatch: true, tooSmall: 0 };
  rb.memo.queue = '';
  rb.queue.render();
  assert.ok(rb.els.queue.querySelector('[data-slide-item^="layout:"]'), 'the fixture lists layout cards');
  assert.equal(rb.els.queue.querySelector('.rb-q-match'), null);
  // With no layout card left: the one line "Layouts match", still focusable, disabled by
  // its state, the reason only in its description.
  const derived = rb.derived;
  assert.ok(derived);
  rb.derived = { ...derived, queue: derived.queue.filter((item) => !item.type) };
  rb.memo.queue = '';
  rb.queue.render();
  const retired = rb.els.queue.querySelector<HTMLButtonElement>('.rb-q-match button');
  assert.equal(retired?.textContent, 'Layouts match');
  assert.equal(retired?.getAttribute('aria-disabled'), 'true');
  assert.equal(retired?.disabled, false, 'it keeps its place in the tab order');
  assert.equal(rb.els.queue.querySelector('.rb-q-match-text'), null, 'no sentence on screen');
  const reason = document.getElementById(retired?.getAttribute('aria-describedby') ?? '');
  assert.match(reason?.textContent ?? '', /^All \d+ slides already use their suggested layout\.$/);
  assert.ok(reason?.classList.contains('visually-hidden'));
  retired?.click();
  await settle();
  assert.equal(calls.some((call) => call.name === 'autoMatchLayouts'), false, 'a retired card sends nothing');
  unmount();
});

test('the list is one Tab stop, and the arrow keys move along it', () => {
  const { rb, unmount } = mount(stateFrom());
  const panel = rb.els.queue.querySelector<HTMLElement>('.rb-q-scroll');
  assert.ok(panel);
  assert.equal(panel.getAttribute('role'), 'tabpanel');
  assert.equal(panel.getAttribute('aria-labelledby'), 'rb-q-tab-attention');
  const [stop, ...rest] = tabStops(panel);
  assert.ok(stop);
  assert.equal(rest.length, 0, 'Tab reaches the list once');
  const stops = [...panel.querySelectorAll<HTMLElement>('[data-rove]')];
  assert.ok(stops.length > 3);
  stop.focus();
  const at = stops.indexOf(stop);
  stop.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, stops[at + 1]);
  assert.equal(tabStops(panel).length, 1, 'still one stop, the one with focus');
  assert.equal(tabStops(panel)[0], document.activeElement);
  stops[at + 1]?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, stops[stops.length - 1]);
  // The group heads are headings a screen reader can jump between.
  assert.ok([...panel.querySelectorAll('.rb-q-group')].every((head) => head.tagName === 'H2'));
  unmount();
});

test('on a narrow screen the chips carry a round picture and a short name that starts their label, and the row scrolls itself', () => {
  const { rb, unmount } = mount(stateFrom(), { narrow: true });
  const q = rb.els.queue.querySelector<HTMLElement>('.rb-q');
  assert.equal(q?.dataset.narrow, 'true');
  const tabs = rb.els.queue.querySelector('[role="tablist"]');
  const row = rb.els.queue.querySelector<HTMLElement>('.rb-q-chips');
  assert.ok(tabs && row);
  assert.equal(tabs.contains(row), false, 'the tabs and the chips are two rows');
  const chips = [...row.querySelectorAll<HTMLElement>('.rb-q-chip')];
  assert.ok(chips.length > 3);
  for (const chip of chips) {
    const shown = chip.querySelector('.rb-q-title')?.textContent ?? '';
    const label = chip.getAttribute('aria-label') ?? shown;
    assert.ok(label.startsWith(shown), `"${label}" starts with "${shown}"`);
    assert.ok(chip.querySelector('.rb-q-chip-pic'), `${shown} has its picture`);
  }
  const mark = row.querySelector<HTMLElement>(`[data-item="${MARK_GROUP?.id}"]`);
  assert.match(mark?.getAttribute('aria-label') ?? '', /^Marks, 3: replace the same mark on 3 slides\. Needs attention\.$/);
  assert.equal(tabStops(row).length, 1, 'the chip row is one Tab stop');
  const css = rebrandCss();
  assert.match(ruleOf(css, '.rb-q-chip-pic'), /border-radius: var\(--ui-radius-choice-round\)/);
  assert.match(ruleOf(css, '.rb-q-chips'), /overflow-x: auto/);

  // A chip past the right edge: the row scrolls by what it needs, and nothing else scrolls.
  const proto = window.HTMLElement.prototype;
  const rect = proto.getBoundingClientRect;
  const into = proto.scrollIntoView;
  let intoCalls = 0;
  proto.scrollIntoView = function scrollIntoView() { intoCalls += 1; };
  proto.getBoundingClientRect = function getBoundingClientRect(this: HTMLElement) {
    if (this.classList.contains('rb-q-chips')) return new window.DOMRect(0, 0, 300, 48);
    if (this.classList.contains('rb-q-chip') && this.getAttribute('aria-current') === 'true') {
      // 500 px along the row, less however far the row has scrolled.
      const along = 500 - (this.closest<HTMLElement>('.rb-q-chips')?.scrollLeft ?? 0);
      return new window.DOMRect(along, 6, 100, 36);
    }
    return new window.DOMRect(0, 0, 0, 0);
  };
  try {
    const last = chips[chips.length - 1];
    const itemId = last?.dataset.item ?? last?.dataset.slideItem;
    assert.ok(itemId);
    rb.queue.selectItem(itemId);
    const after = rb.els.queue.querySelector<HTMLElement>('.rb-q-chips');
    assert.equal(after?.scrollLeft, 308, 'the row moved by the overhang and a gap');
    assert.equal(intoCalls, 0, 'never scrollIntoView, which would move the page as well');
  } finally {
    proto.getBoundingClientRect = rect;
    proto.scrollIntoView = into;
  }
  unmount();
});

test('while the picture deck\'s notice band can show, the queue leaves out the cards that repeat it', () => {
  // Slide 1 made one stored picture of a whole slide, as a scanned deck reads before its text is.
  const deck = structuredClone(RUN.deck);
  const [pictured, plain] = deck.slides;
  assert.ok(pictured && plain);
  pictured.origin = { ...pictured.origin, flattened: true };
  pictured.objects = pictured.objects.map((object, i) => (i === 0
    ? { ...object, kind: 'pic' as const, origin: 'slide' as const, media: 'user/upload/slide-1.png' }
    : { ...object, origin: 'layout' as const }));
  const { rb, unmount } = mount(stateFrom(RUN.plan, { source: deck }));
  const derived = rb.derived;
  assert.ok(derived);
  const waiting = rb.foot.reviewItems()[0];
  assert.ok(waiting);
  const notRead = { code: 'evidence.ocr.not-run', params: {}, text: 'Text in the picture was not read.' };
  const onPicture = { ...waiting, id: 'probe:not-read', evidence: notRead, slideIds: [pictured.id], slideNumbers: [1] };
  const onPlain = { ...waiting, id: 'probe:not-read-plain', evidence: notRead, slideIds: [plain.id], slideNumbers: [2] };
  const fullPicture = {
    ...waiting,
    id: 'layout:full-image',
    type: 'layout-group' as const,
    layout: { structure: 'full-image', band: 'likely' as const, archetype: 'full-image' },
    slideIds: [pictured.id],
    slideNumbers: [1],
  };
  derived.queue = [...derived.queue, onPicture, onPlain, fullPicture];
  rb.memo.queue = '';
  rb.queue.render();
  assert.equal(rb.els.queue.querySelector('[data-item="probe:not-read"]'), null, 'no "not read" card beside the band');
  assert.equal(rb.els.queue.querySelector('[data-slide-item="layout:full-image"]'), null, 'no Full picture group either');
  assert.ok(rb.els.queue.querySelector('[data-item="probe:not-read-plain"]'), 'a slide the band does not speak for keeps its card');
  assert.deepEqual([...rb.queue.bandCardIds()].sort(), ['layout:full-image', 'probe:not-read']);
  const count = rb.els.queue.querySelector('[data-tab="attention"] .rb-q-count')?.textContent;
  assert.equal(count, String(rb.els.queue.querySelectorAll('.rb-q-item[data-item]').length), 'the tab counts what it lists');
  unmount();
});

test('All slides lists a small picture of each slide, and releases the pictures that scroll away', () => {
  const pictures = new Map<Element, (entries: Array<{ target: Element; isIntersecting: boolean }>) => void>();
  class Watcher {
    readonly callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;
    constructor(callback: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void) { this.callback = callback; }
    observe(target: Element): void { pictures.set(target, this.callback); }
    disconnect(): void { pictures.clear(); }
  }
  Reflect.set(globalThis, 'IntersectionObserver', Watcher);
  try {
    const { rb, unmount } = mount(stateFrom());
    rb.queueTab = 'all';
    rb.memo.queue = '';
    rb.queue.render();
    const rows = [...rb.els.queue.querySelectorAll<HTMLElement>('.rb-q-item--slide')];
    assert.equal(rows.length, rb.derived?.slides.length);
    assert.ok(rb.els.queue.querySelector('.rb-q-list--slides'));
    assert.match(rows[0]?.querySelector('.rb-q-title')?.textContent ?? '', /^Slide 1/);
    // A state most slides share is the usual one, so no row repeats it.
    const slides = rb.derived?.slides ?? [];
    const usual = slides.filter((slide) => slide.attention > 0).length * 2 > slides.length;
    const said = rows.filter((row) => /need/.test(row.querySelector('.rb-q-slide-state')?.textContent ?? '')).length;
    if (usual) assert.equal(said, 0, 'no row says what most rows would');
    else assert.equal(said, slides.filter((slide) => slide.include && slide.attention > 0).length);
    const slot = rows[0]?.querySelector<HTMLElement>('.rb-q-thumb[data-slide-pic]');
    assert.ok(slot);
    assert.equal(slot.firstChild, null, 'nothing drawn before it is on screen');
    const tell = pictures.get(slot);
    assert.ok(tell);
    tell([{ target: slot, isIntersecting: true }]);
    assert.ok(slot.querySelector('svg'), 'drawn once on screen');
    tell([{ target: slot, isIntersecting: false }]);
    assert.equal(slot.firstChild, null, 'released once far away');
    assert.match(ruleOf(rebrandCss(), '.rb-q-list--slides > li'), /content-visibility: auto/);
    unmount();
  } finally {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
  }
});

test('with every card answered and only the not placed card left, the head reads "Look before you open"', () => {
  const slide = firstSlide();
  const ids = slide.objects.map((object) => object.id).slice(0, 2);
  const plan = structuredClone(RUN.plan);
  for (const row of plan.slides.flatMap((one) => one.objects)) {
    row.decision = row.proposal;
    row.review = 'accepted';
    row.author = 'user';
  }
  const { rb, unmount } = mount(stateFrom(plan, { preview: deckWithSurplus(ids) }));
  const derived = rb.derived;
  assert.ok(derived);
  derived.queue = derived.queue.filter((item) => !item.type);
  rb.memo.queue = '';
  rb.queue.render();
  assert.deepEqual([...rb.els.queue.querySelectorAll('.rb-q-group')].map((head) => head.textContent), ['Look before you open']);
  assert.ok(rb.els.queue.querySelector('[data-unplaced-item]'));
  unmount();
});

test('a mark card shows and selects a member the Original shows whole, drawn alone', () => {
  const group = MARK_GROUP;
  assert.ok(group);
  // Paint a larger object of the exemplar's slide over the exemplar, the way a picture
  // or a panel covers a repeated mark on a deck's first slide.
  const deck = structuredClone(RUN.deck);
  const slide = deck.slides.find((one) => one.objects.some((object) => object.id === group.exemplar));
  assert.ok(slide);
  const mark = slide.objects.find((object) => object.id === group.exemplar);
  const cover = slide.objects.find((object) => object.id !== group.exemplar && !group.objectIds.includes(object.id));
  assert.ok(mark && cover);
  cover.box = { ...cover.box, x: mark.box.x - 10, y: mark.box.y - 10, w: mark.box.w + 20, h: mark.box.h + 20 };
  slide.objects = [...slide.objects.filter((object) => object !== cover), cover];
  const { rb, unmount } = mount(stateFrom(RUN.plan, { source: deck }));
  const card = rb.els.queue.querySelector<HTMLElement>(`[data-item="${group.id}"]`);
  assert.ok(card);
  const slot = card.querySelector<HTMLElement>('[data-crop]');
  assert.ok(slot);
  assert.notEqual(slot.dataset.crop, group.exemplar, 'not the covered exemplar');
  assert.ok(group.objectIds.includes(slot.dataset.crop ?? ''), 'another member of the card');
  assert.equal(slot.dataset.shape, 'crop');
  assert.ok(slot.hasAttribute('data-alone'), 'a mark is drawn alone, with nothing the slide paints over it');
  card.click();
  assert.equal(rb.sel.objectId, slot.dataset.crop, 'the card selects the member it shows');
  unmount();
});

test('a selection from the filmstrip marks the card that holds the slide as current', () => {
  const { rb, unmount } = mount(stateFrom());
  const layout = rb.derived?.queue.find((item) => item.type === 'layout-group');
  assert.ok(layout, 'the fixture has a layout card');
  rb.select({ slideId: layout.slideIds[0] ?? null, objectId: null, itemId: null });
  rb.queue.render();
  const current = [...rb.els.queue.querySelectorAll<HTMLElement>('[aria-current="true"]')];
  assert.equal(current.length, 1, 'one current card');
  const item = rb.derived?.queue.find((one) => one.id === current[0]?.dataset.slideItem);
  assert.ok(item?.type, 'a slide-level card');
  assert.ok(item.slideIds.includes(layout.slideIds[0] ?? ''), 'that holds the slide');
  // An object picked on the stage marks the card that holds it (one the compile placed:
  // an object on no slide belongs to the Not placed card first).
  const tray = new Set(rb.state.preview?.deck.tray.map((one) => one.sourceObjectId) ?? []);
  const shown = [...rb.els.queue.querySelectorAll<HTMLElement>('[data-item]')].map((one) => rb.derived?.queue.find((item) => item.id === one.dataset.item));
  const pick = shown.flatMap((item) => (item ? item.objectIds.filter((id) => !tray.has(id) && rb.derived?.itemOfObject.get(id) === item.id).map((id) => ({ item, id })) : []))[0];
  assert.ok(pick);
  rb.select({ objectId: pick.id, slideId: rb.derived?.objects.get(pick.id)?.slideId ?? null, itemId: null });
  rb.queue.render();
  assert.equal(rb.els.queue.querySelector<HTMLElement>('[aria-current="true"]')?.dataset.item, pick.item.id);
  unmount();
});

test('To review counts the cards above Layouts; the slide-level cards list under their own head, uncounted', () => {
  const { rb, unmount } = mount(stateFrom());
  const counted = rb.els.queue.querySelectorAll('.rb-q-item[data-item]').length;
  assert.equal(Number(rb.els.queue.querySelector('[data-tab="attention"] .lp-seg-count')?.textContent), counted);
  assert.equal(counted, toReviewCount(rb));
  const layoutHead = [...rb.els.queue.querySelectorAll('.rb-q-group')].find((head) => head.textContent === 'Layouts');
  assert.ok(layoutHead);
  const under = layoutHead.nextElementSibling;
  assert.ok(under?.querySelector('[data-slide-item]'));
  assert.equal(under?.querySelector('[data-item]'), null, 'no counted card under Layouts');
  // The list says which keys move along it.
  const list = rb.els.queue.querySelector<HTMLElement>('.rb-q-list');
  assert.equal(document.getElementById(list?.getAttribute('aria-describedby') ?? '')?.textContent, 'Up and Down move between cards');
  unmount();
});
