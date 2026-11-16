// SPDX-License-Identifier: MPL-2.0
/**
 * The fold of a <details> section in a browser without `interpolate-size` (WebKit and
 * Gecko): a press on the summary runs foldBody on the section's body. jsdom has no Web
 * Animations API. There a fold applies the end state at once, unless the test gives
 * the body a recording `animate` and finishes the motion by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

// What the browser under test can do. The fold is for a browser with no
// interpolate-size; closing with a fold also needs ::details-content.
const can = { interpolateSize: false, detailsContent: true };
const asked: string[] = [];
(globalThis as { CSS?: unknown }).CSS = {
  supports: (first: string, second?: string) => {
    asked.push(second === undefined ? first : `${first}: ${second}`);
    if (second === undefined) return first === 'selector(::details-content)' && can.detailsContent;
    return first === 'interpolate-size' && can.interpolateSize;
  },
};

const { foldDetailsOnPress, installDetailsFold } = await import('./disclosure-motion.ts');
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}
/** A cancelable press, as a click or the Enter key on a summary delivers. */
function press(target: Element): { taken: boolean; prevented: boolean } {
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  const taken = foldDetailsOnPress(event);
  return { taken, prevented: event.defaultPrevented };
}

const CARD = '<details class="section-card"><summary class="section-card-summary"><h2 class="section-card-title">Mix</h2></summary><div class="section-card-body">Body</div></details>';
const INPUTS = '<details class="input-section"><summary class="input-section-summary"><span>Content</span></summary><div class="input-section-body">Body</div></details>';

test('a press on a section card summary opens the section, and the next press closes it', () => {
  const root = mount(CARD);
  const details = root.querySelector('details')!;
  const first = press(root.querySelector('h2')!);
  assert.deepEqual(first, { taken: true, prevented: true }, 'the fold takes the press, so the browser does not also toggle');
  assert.equal(details.open, true);
  assert.equal(press(root.querySelector('summary')!).taken, true);
  assert.equal(details.open, false);
});

test('a tool sidebar section folds the same way', () => {
  const root = mount(INPUTS);
  assert.equal(press(root.querySelector('summary')!).taken, true);
  assert.equal(root.querySelector('details')!.open, true);
});

test('a control inside the summary keeps its own press', () => {
  const root = mount('<details class="section-card"><summary><h2>Mix</h2><button type="button" class="help-tip-btn">?</button><a href="#/d">More</a></summary><div class="section-card-body">Body</div></details>');
  assert.deepEqual(press(root.querySelector('button')!), { taken: false, prevented: false });
  assert.deepEqual(press(root.querySelector('a')!), { taken: false, prevented: false });
  assert.equal(root.querySelector('details')!.open, false);
});

test('a section with no body wrapper, and a plain details, keep the browser toggle', () => {
  const root = mount('<details class="section-card"><summary>Tokens</summary><p>One</p><p>Two</p></details><details><summary>Plain</summary><div class="section-card-body">Body</div></details>');
  const [card, plain] = root.querySelectorAll('summary');
  assert.deepEqual(press(card!), { taken: false, prevented: false });
  assert.deepEqual(press(plain!), { taken: false, prevented: false });
});

test('a press that something else already handled is left alone', () => {
  const root = mount(CARD);
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: root.querySelector('summary')! });
  event.preventDefault();
  assert.equal(foldDetailsOnPress(event), false);
  assert.equal(root.querySelector('details')!.open, false);
});

test('a press on an inner section folds the inner section only', () => {
  const root = mount(`<details class="section-card" open><summary>Outer</summary><div class="section-card-body">${INPUTS}</div></details>`);
  const inner = root.querySelector<HTMLDetailsElement>('details.input-section')!;
  assert.equal(press(inner.querySelector('summary')!).taken, true);
  assert.equal(inner.open, true);
  assert.equal(root.querySelector<HTMLDetailsElement>('details.section-card')!.open, true);
});

test('a press on the body is not a press on the summary', () => {
  const root = mount(CARD);
  assert.equal(press(root.querySelector('.section-card-body')!).taken, false);
});

const OPEN_CARD = CARD.replace('<details class="section-card">', '<details class="section-card" open>');
interface FakeAnimation { cancelled: boolean; finish: () => void; cancel: () => void; addEventListener: (type: string, fn: () => void) => void }
/** Give a body an animate() whose motions the test finishes by hand. */
function recording(body: HTMLElement): FakeAnimation[] {
  const calls: FakeAnimation[] = [];
  (body as unknown as { animate: () => FakeAnimation }).animate = () => {
    const listeners: Array<() => void> = [];
    const animation: FakeAnimation = { cancelled: false, finish: () => { for (const fn of listeners) fn(); }, cancel: () => { animation.cancelled = true; }, addEventListener: (_type, fn) => { listeners.push(fn); } };
    calls.push(animation);
    return animation;
  };
  return calls;
}

test('a closing section reads closed at once and keeps its body drawn until the motion ends', () => {
  const root = mount(OPEN_CARD);
  const details = root.querySelector('details')!;
  const calls = recording(root.querySelector<HTMLElement>('.section-card-body')!);
  press(root.querySelector('summary')!);
  assert.equal(details.open, false, 'the page and assistive technology read the true state');
  assert.equal(details.hasAttribute('data-fold-closing'), true, 'the stylesheet keeps the body drawn while it shrinks');
  calls[0]!.finish();
  assert.equal(details.hasAttribute('data-fold-closing'), false);
  assert.equal(details.open, false);
});

test('code that opens a closing section again wins', async () => {
  const root = mount(OPEN_CARD);
  const details = root.querySelector('details')!;
  const calls = recording(root.querySelector<HTMLElement>('.section-card-body')!);
  press(root.querySelector('summary')!);
  // A press on the canvas reveals a control in this section while the fold still runs.
  details.open = true;
  await tick();
  assert.equal(details.hasAttribute('data-fold-closing'), false, 'the fold stood down');
  assert.equal(calls[0]!.cancelled, true);
  calls[0]!.finish();
  assert.equal(details.open, true, 'the fold that was stopped does not close the section later');
});

test('a second press part way through a close opens the section again', () => {
  const root = mount(OPEN_CARD);
  const details = root.querySelector('details')!;
  const calls = recording(root.querySelector<HTMLElement>('.section-card-body')!);
  press(root.querySelector('summary')!);
  press(root.querySelector('summary')!);
  assert.equal(details.open, true);
  assert.equal(details.hasAttribute('data-fold-closing'), false);
  // The first motion was replaced; finishing it late must not close the section.
  calls[0]!.finish();
  assert.equal(details.open, true);
  calls[2]!.finish();
  assert.equal(details.open, true, 'the section rests open, as the last press asked');
  // And the press after that closes the section.
  press(root.querySelector('summary')!);
  assert.equal(details.open, false);
});

test('where a closed body cannot stay drawn, closing is the browser\'s own toggle', () => {
  can.detailsContent = false;
  try {
    const root = mount(OPEN_CARD);
    assert.deepEqual(press(root.querySelector('summary')!), { taken: false, prevented: false });
    assert.equal(root.querySelector('details')!.hasAttribute('data-fold-closing'), false);
    // Opening needs nothing from the stylesheet, so the fold still opens a section there.
    const closed = mount(CARD);
    assert.equal(press(closed.querySelector('summary')!).taken, true);
    assert.equal(closed.querySelector('details')!.open, true);
  } finally {
    can.detailsContent = true;
  }
});

test('the fold is installed only where the stylesheet cannot move the height', () => {
  const root = mount(CARD);
  asked.length = 0;
  installDetailsFold();
  assert.deepEqual(asked, ['interpolate-size: allow-keywords']);
  root.querySelector('summary')!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(root.querySelector('details')!.open, true, 'a real press on the page reaches the fold');

  const source = readFileSync(new URL('./disclosure-motion.ts', import.meta.url), 'utf8');
  assert.match(source, /CSS\.supports\('interpolate-size', 'allow-keywords'\)\) return;/, 'a browser with interpolate-size keeps the stylesheet motion');
  const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
  assert.match(main, /installDetailsFold\(\);/, 'the shell installs it at boot');
});
