// SPDX-License-Identifier: MPL-2.0
/**
 * The first-visit greeting in place (components/welcome-hero.ts): it sits at the top
 * of the gallery, offers one action by audience, settles the welcome on any explicit
 * choice (and acknowledges the privacy notice it carries), leaves both alone on a
 * route change, moves rather than repeats when the gallery re-mounts, and keeps
 * maintenance waiting only while the mark draws.
 *
 * Run directly (the module imports its stylesheet, so the CSS stub is required):
 *   node --import ./tests/css-stub.mjs --test shells/web/src/components/welcome-hero.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
globalThis.localStorage = dom.window.localStorage;
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;

const { showWelcomeHero, closeWelcomeHero, languageMayBeWrong } = await import('./welcome-hero.ts');
const { welcomeSettled, isWelcomeDismissed, WELCOME_DISMISSED_KEY } = await import('../lib/welcome-gate.ts');

const PRIVACY = { privacy: { text: 'No accounts, no tracking. Your work stays on this device.', href: '/info/trust/privacy' }, ackPrivacy: (): void => { acked++; } };
let acked = 0;

const gallery = (): HTMLElement => {
  document.body.innerHTML = '<div class="gallery"><section class="featured"></section></div>';
  return document.querySelector<HTMLElement>('.gallery')!;
};
// Back to the gallery's address, letting its hashchange land first: a late one would
// read as a route change and take down the next greeting.
const fresh = async (): Promise<void> => {
  localStorage.clear();
  if (location.hash !== '#/') { location.hash = '#/'; await new Promise((resolve) => setTimeout(resolve, 10)); }
};
const hero = (): HTMLElement | null => document.querySelector<HTMLElement>('.welcome-hero');
const click = (sel: string): void => { hero()!.querySelector<HTMLElement>(sel)!.click(); };

async function maintenanceMayStart(): Promise<boolean> {
  let open = false;
  void welcomeSettled().then(() => { open = true; });
  await new Promise((resolve) => setTimeout(resolve, 5));
  return open;
}

test('the greeting opens at the top of the gallery, one sentence and one action', async () => {
  await fresh();
  const root = gallery();
  const done = showWelcomeHero(root, { audience: 'demo', ...PRIVACY });
  assert.equal(root.firstElementChild, hero(), 'the opening frame, above the featured row');
  assert.equal(hero()!.querySelector('h2')!.textContent, 'Make the next thing beautiful.');
  assert.equal(hero()!.querySelectorAll('.welcome-hero-go').length, 1, 'one primary action');
  assert.equal(hero()!.querySelector('.welcome-hero-go')!.getAttribute('data-choice'), 'make');
  assert.equal(hero()!.querySelector('.fauna-slot'), null, 'one thing to look at: the mark, no drawing beside the action');
  assert.equal(document.querySelector('dialog'), null, 'no modal');
  closeWelcomeHero();
  await done;
});

test('a blank install is offered Make it yours, and Lolly Demo Start making', async () => {
  await fresh();
  const done = showWelcomeHero(gallery(), { audience: 'blank', ...PRIVACY });
  assert.equal(hero()!.querySelector('.welcome-hero-go')!.getAttribute('data-choice'), 'brand');
  assert.match(hero()!.querySelector('.welcome-hero-go')!.textContent ?? '', /One colour is enough/);
  closeWelcomeHero();
  await done;
});

test('Start making opens Design, and settles the welcome and the privacy notice', async () => {
  await fresh();
  const done = showWelcomeHero(gallery(), { audience: 'demo', ...PRIVACY });
  click('[data-choice="make"]');
  assert.equal(await done, 'make');
  assert.equal(location.hash, '#/tool/design?template=brand-starter', 'Design, on the lorikeet poster');
  assert.equal(hero(), null);
  assert.equal(isWelcomeDismissed(), true);
  assert.ok(acked > 0, 'the privacy notice the band carried is acknowledged');
});

test('the close button and Escape dismiss for good', async () => {
  await fresh();
  let done = showWelcomeHero(gallery(), { audience: 'demo', ...PRIVACY });
  click('[data-choice="dismiss"]');
  assert.equal(await done, 'dismiss');
  assert.equal(localStorage.getItem(WELCOME_DISMISSED_KEY), '1');
  await fresh();
  done = showWelcomeHero(gallery(), { audience: 'demo', ...PRIVACY });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(await done, 'dismiss');
  assert.equal(isWelcomeDismissed(), true);
});

test('dismissing animates the card away, then takes it out of the page', async () => {
  await fresh();
  const done = showWelcomeHero(gallery(), { audience: 'demo', ...PRIVACY });
  click('[data-choice="dismiss"]');
  assert.equal(await done, 'dismiss');
  assert.equal(hero(), null, 'the greeting counts as gone at once');
  const leaving = document.querySelector<HTMLElement>('.welcome-hero-leaving');
  assert.ok(leaving, 'the card is still leaving');
  assert.match(leaving.style.getPropertyValue('--wh-h'), /px$/, 'the space it held is measured, so it can close');
  await new Promise(r => setTimeout(r, 1000));
  assert.equal(document.querySelector('.welcome-hero-leaving'), null, 'gone once the animation has had its time');
});

test('a route change takes the greeting down without settling anything', async () => {
  await fresh();
  const done = showWelcomeHero(gallery(), { audience: 'demo', ...PRIVACY });
  window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
  await done;
  assert.equal(hero(), null);
  assert.equal(isWelcomeDismissed(), false, 'navigation is not a dismissal');
});

test('a gallery re-mount moves the same greeting instead of drawing a second', async () => {
  await fresh();
  const first = showWelcomeHero(gallery(), { audience: 'demo', ...PRIVACY });
  const el = hero();
  const again = showWelcomeHero(gallery(), { audience: 'demo', ...PRIVACY });
  assert.equal(again, first, 'the same promise');
  assert.equal(hero(), el, 'the same element, now in the new gallery');
  assert.equal(document.querySelectorAll('.welcome-hero').length, 1);
  closeWelcomeHero();
  await first;
});

/** A stand-in IntersectionObserver whose band comes into view when `show()` is called. */
let show = (): void => {};
class SeenObserver {
  readonly cb: (entries: Array<{ isIntersecting: boolean }>) => void;
  constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { this.cb = cb; }
  observe(): void { show = () => this.cb([{ isIntersecting: true }]); }
  disconnect(): void {}
}

test('the mark waits to be seen, draws once, and maintenance waits only for the drawing', async () => {
  await fresh();
  Object.assign(globalThis, { IntersectionObserver: SeenObserver });
  try {
    const done = showWelcomeHero(gallery(), { audience: 'demo', ...PRIVACY });
    assert.ok(!hero()!.classList.contains('is-drawing') && !hero()!.classList.contains('is-settled'), 'not drawn before the band is seen');
    assert.equal(await maintenanceMayStart(), false, 'held while the mark waits and draws');
    show();
    assert.ok(hero()!.classList.contains('is-drawing'), 'drawing once in view');
    // A gallery re-mount mid-drawing shows the mark finished rather than drawing it twice.
    void showWelcomeHero(gallery(), { audience: 'demo', ...PRIVACY });
    assert.ok(hero()!.classList.contains('is-settled'));
    assert.equal(localStorage.getItem('lolly-welcome-mark-drawn'), '1', 'a later visit shows the finished mark');
    assert.equal(await maintenanceMayStart(), true, 'released once drawn');
    closeWelcomeHero();
    await done;
  } finally {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
  }
});

test('the language chip shows only when the detected language may be wrong', () => {
  Object.defineProperty(dom.window.navigator, 'languages', { value: ['en-AU', 'en'], configurable: true });
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  assert.equal(languageMayBeWrong(), false);
  Object.defineProperty(dom.window.navigator, 'languages', { value: ['de-DE', 'en'], configurable: true });
  assert.equal(languageMayBeWrong(), true);
});
