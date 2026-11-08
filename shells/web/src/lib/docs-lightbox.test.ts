// SPDX-License-Identifier: MPL-2.0
/**
 * The docs picture viewer (lib/docs-lightbox.ts): which pictures get a trigger and what
 * it is called, the twin that opens for the theme, the figure copy, the keys, previous
 * and next, closing and the focus going back, the history entry Back takes, and the
 * geometry the gestures run on.
 *
 * jsdom has no layout, so these pin the decisions and the bookkeeping. Pinch, drag,
 * the wheel and the open and close motion run in a real browser:
 * tests/docs-lightbox.browser.test.ts.
 *
 * Run directly:  node --test shells/web/src/lib/docs-lightbox.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
  url: 'https://lolly.tools/info/create/design.html#the-design-window',
  pretendToBeVisual: true,
});
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, Element: w.Element, HTMLElement: w.HTMLElement });

const { enhanceDocsLightbox, sameEntryBack, fitBox, clampPan, zoomAbout, isVectorSrc, lightboxIcons } = await import('./docs-lightbox.ts');
const { icon } = await import('./icons.ts');
const icons = lightboxIcons((name) => icon(name));

const labels = {
  enlarge: (alt: string) => (alt ? `Enlarge: ${alt}` : 'Enlarge picture'),
  viewer: 'Picture viewer', close: 'Close', zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit to screen',
  previous: 'Previous picture', next: 'Next picture', position: (n: number, t: number) => `${n} of ${t}`,
};

// The theme rules the two readers ship for a dual shot, in the same form.
const style = w.document.createElement('style');
style.textContent = `.shot--dual>img.shot-alt{display:none}
  [data-theme="dark"] .shot--dual>img:not(.shot-alt){display:none}
  [data-theme="dark"] .shot--dual>img.shot-alt{display:block}`;
w.document.head.appendChild(style);
// jsdom cannot follow a link: stop one at the document, after the reader's own handler has run.
w.document.addEventListener('click', (e) => { if ((e.target as Element).closest('a')) e.preventDefault(); });

function page(): HTMLElement {
  const root = w.document.createElement('main');
  root.className = 'docs-content';
  root.innerHTML = `
    <p><span class="shot shot--dual" data-shot="/info/shots/design.svg"><img src="/info/shots/design.svg" width="1360" height="850" alt="The free canvas" loading="lazy"><span class="shot-cred"><button type="button" class="shot-cred-btn" aria-label="Content Credentials">c</button></span><img class="shot-alt" src="/info/shots/design.dark.svg" width="1360" height="850" alt="The free canvas" loading="lazy"></span></p>
    <p><span class="docs-diagram"><img src="/info/diagrams/concepts/paths.svg" width="586" height="455" alt="Three export paths"><span class="diagram-actions"><a class="diagram-verify" href="/#/verify">v</a></span></span></p>
    <figure class="docs-figure" data-art="/info/figures/agenda-one-table.html"><div class="docs-figure-art"><!-- concept --><style>.aot{color:red}</style><div class="aot" role="group" aria-label="One table feeds every output"><p id="fig-x-a">Programme</p><a href="/x">link</a></div></div><figcaption><p>The table and its outputs.</p><span class="shot-cred"><button type="button" class="shot-cred-btn">c</button><span class="shot-cred-line">signed by Lolly</span></span></figcaption></figure>
    <ul class="md-pictures"><li><span class="md-pic"><span class="asset-cred" data-shot="/info/mascots/koala.webp"><img src="/info/mascots/koala.webp" alt="Koala"></span></span> Koala</li></ul>
    <span class="mascot-cred" data-shot="/info/mascots/dolphin.webp"><img src="/info/mascots/dolphin.webp" alt=""></span>`;
  w.document.body.replaceChildren(root);
  return root;
}

const dialog = (): HTMLElement | null => w.document.querySelector('dialog.doc-lightbox');
const isOpen = (): boolean => !!dialog()?.hasAttribute('open');
const key = (target: Element, k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
  const e = new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
};
const flush = () => new Promise<void>((r) => setTimeout(r, 30));
/** jsdom runs a history traversal as a later task, sometimes well after a fixed wait. */
const popped = () => new Promise<void>((r) => w.addEventListener('popstate', () => setTimeout(r, 0), { once: true }));

function reset(): void {
  w.document.documentElement.removeAttribute('data-theme');
  w.document.documentElement.setAttribute('data-a11y-motion', 'reduce');
}

// ── Geometry ─────────────────────────────────────────────────────────────────

test('fitBox centres the largest box of the picture\'s aspect, capped by maxUp', () => {
  assert.deepEqual(fitBox({ x: 0, y: 50, w: 400, h: 700 }, 1600, 1000), { x: 0, y: 275, w: 400, h: 250 });
  // A small picture is not blown up past the cap.
  const b = fitBox({ x: 0, y: 0, w: 1000, h: 1000 }, 100, 50, 2);
  assert.deepEqual(b, { x: 400, y: 450, w: 200, h: 100 });
});

test('clampPan centres a side that fits and keeps a larger side covering the box', () => {
  const safe = { x: 10, y: 60, w: 380, h: 600 };
  assert.deepEqual(clampPan(999, 999, 200, 100, safe), { x: 100, y: 310 });
  // Larger than the box: an edge may come no further in than the box's edge.
  assert.deepEqual(clampPan(50, 70, 800, 900, safe), { x: 10, y: 60 });
  assert.deepEqual(clampPan(-2000, -2000, 800, 900, safe), { x: 10 + 380 - 800, y: 60 + 600 - 900 });
});

test('zoomAbout keeps the picture point under the pointer where it was', () => {
  const p = zoomAbout(100, 100, 1, 2, 300, 200);
  // The point (300, 200) was 200 / 100 px into the picture at 1x; at 2x it is 400 / 200 px in.
  assert.deepEqual(p, { x: -100, y: 0 });
  assert.deepEqual(zoomAbout(p.x, p.y, 2, 1, 300, 200), { x: 100, y: 100 });
});

test('isVectorSrc tells an SVG from a bitmap', () => {
  assert.equal(isVectorSrc('/info/shots/design.svg'), true);
  assert.equal(isVectorSrc('/info/shots/design.dark.svg?v=2'), true);
  assert.equal(isVectorSrc('/info/shots/design.png'), false);
  assert.equal(isVectorSrc('/info/mascots/koala.webp'), false);
});

// ── Triggers ─────────────────────────────────────────────────────────────────

test('a trigger button goes on each screenshot, diagram and figure, named from its alt text', () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  const btns = Array.from(root.querySelectorAll('button.doc-lightbox-open'));
  assert.deepEqual(btns.map((b) => b.getAttribute('aria-label')), [
    'Enlarge: The free canvas',
    'Enlarge: Three export paths',
    'Enlarge: One table feeds every output',
  ]);
  // The glyph is the registry's own (lib/icons.ts), the same markup the app draws.
  const ref = w.document.createElement('div');
  ref.innerHTML = icon('resize');
  assert.ok(btns.every((b) => b.getAttribute('type') === 'button' && b.querySelector('svg[aria-hidden="true"]')?.outerHTML === ref.firstElementChild!.outerHTML));
  // A picture list's plates and the decorative mascots keep their own behaviour.
  assert.equal(root.querySelector('.md-pictures .doc-lightbox-open'), null);
  assert.equal(root.querySelector('.mascot-cred .doc-lightbox-open'), null);
  // The diagram's button follows the image's own corner.
  assert.equal(root.querySelector<HTMLElement>('.docs-diagram')!.style.getPropertyValue('--doc-lb-w'), '586');
  // Enhancing twice adds nothing.
  enhanceDocsLightbox(root, { labels, icons });
  assert.equal(root.querySelectorAll('button.doc-lightbox-open').length, 3);
  dispose();
});

test('dispose takes every button, attribute and the viewer away', () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  root.querySelector<HTMLElement>('.doc-lightbox-open')!.click();
  assert.ok(isOpen());
  dispose();
  assert.equal(root.querySelectorAll('.doc-lightbox-open, [data-doc-lightbox]').length, 0);
  assert.equal(root.querySelector<HTMLElement>('.docs-diagram')!.style.getPropertyValue('--doc-lb-w'), '');
  assert.equal(dialog(), null);
});

// ── Opening ──────────────────────────────────────────────────────────────────

test('the trigger opens a modal viewer on the light file, with its alt text as the caption', () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  root.querySelector<HTMLElement>('.shot .doc-lightbox-open')!.click();
  const dlg = dialog()!;
  assert.ok(isOpen());
  assert.equal(dlg.getAttribute('aria-label'), 'Picture viewer');
  const img = dlg.querySelector<HTMLImageElement>('.doc-lightbox-pic img')!;
  assert.equal(img.getAttribute('src'), '/info/shots/design.svg');
  assert.equal(img.alt, 'The free canvas');
  const cap = dlg.querySelector('.doc-lightbox-caption')!;
  assert.equal(cap.textContent, 'The free canvas');
  assert.equal(dlg.getAttribute('aria-describedby'), cap.id);
  // Every control has a name; Close takes the focus.
  const names = Array.from(dlg.querySelectorAll('button')).map((b) => b.getAttribute('aria-label'));
  assert.deepEqual(names, ['Zoom out', 'Zoom in', 'Fit to screen', 'Close', 'Previous picture', 'Next picture']);
  assert.equal(w.document.activeElement?.getAttribute('aria-label'), 'Close');
  // Nothing to zoom out of yet.
  assert.equal(dlg.querySelector('[data-lb="out"]')!.getAttribute('aria-disabled'), 'true');
  dispose();
});

test('in the dark theme the dark twin opens', () => {
  reset();
  w.document.documentElement.setAttribute('data-theme', 'dark');
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  root.querySelector<HTMLElement>('.shot .doc-lightbox-open')!.click();
  assert.equal(dialog()!.querySelector('.doc-lightbox-pic img')!.getAttribute('src'), '/info/shots/design.dark.svg');
  dispose();
});

test('a plain click on the picture opens it; a control on it, a modifier or another button does not', () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  const img = root.querySelector<HTMLElement>('.shot > img')!;
  img.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
  assert.equal(isOpen(), false, 'a Ctrl-click is the browser\'s');
  root.querySelector<HTMLElement>('.shot-cred-btn')!.click();
  assert.equal(isOpen(), false, 'the credential glyph opens its own card');
  root.querySelector<HTMLElement>('.diagram-verify')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(isOpen(), false, 'a link under a diagram is followed');
  root.querySelector<HTMLElement>('.docs-figure-art a')!.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.equal(isOpen(), false, 'a link inside a figure is followed');
  img.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.ok(isOpen());
  dispose();
});

test('a figure opens as an inert copy without its style block, captioned by its words', () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  root.querySelector<HTMLElement>('.docs-figure .doc-lightbox-open')!.click();
  const art = dialog()!.querySelector<HTMLElement>('.doc-lightbox-art')!;
  assert.ok(art.hasAttribute('inert'));
  assert.equal(art.getAttribute('aria-hidden'), 'true');
  assert.equal(art.querySelector('style'), null, 'the page copy of the style block already applies');
  assert.ok(art.querySelector('.aot'));
  // The caption's prose, then the figure's own label; the credential card stays behind.
  assert.equal(dialog()!.querySelector('.doc-lightbox-caption')!.textContent, 'The table and its outputs. One table feeds every output');
  dispose();
});

// ── Inside the viewer ────────────────────────────────────────────────────────

test('+, - and 0 zoom in, out and back to the fit; Ctrl or Cmd with + stays the browser\'s', () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  root.querySelector<HTMLElement>('.shot .doc-lightbox-open')!.click();
  const dlg = dialog()!;
  const pic = dlg.querySelector<HTMLElement>('.doc-lightbox-pic')!;
  const width = () => parseFloat(pic.style.width);
  const fitted = width();
  assert.ok(fitted > 0);
  const browserZoom = key(w.document.activeElement!, '+', { ctrlKey: true });
  assert.equal(browserZoom.defaultPrevented, false);
  assert.equal(width(), fitted);
  const e = key(w.document.activeElement!, '+');
  assert.ok(e.defaultPrevented);
  // Settled: an <img> is laid out at its zoomed size, so a vector is drawn again at that size.
  assert.ok(Math.abs(width() - fitted * 1.6) < 0.01, `${width()} vs ${fitted * 1.6}`);
  assert.match(pic.style.transform, /scale\(1\)$/);
  assert.ok(dlg.hasAttribute('data-zoomed'));
  assert.equal(dlg.querySelector('[data-lb="out"]')!.hasAttribute('aria-disabled'), false);
  key(w.document.activeElement!, '-');
  assert.ok(Math.abs(width() - fitted) < 0.01);
  key(w.document.activeElement!, '+');
  key(w.document.activeElement!, '+');
  key(w.document.activeElement!, '0');
  assert.ok(Math.abs(width() - fitted) < 0.01);
  assert.equal(dlg.hasAttribute('data-zoomed'), false);
  dispose();
});

test('the zoom buttons do what the keys do, and a disabled one does nothing', () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  root.querySelector<HTMLElement>('.shot .doc-lightbox-open')!.click();
  const dlg = dialog()!;
  const pic = dlg.querySelector<HTMLElement>('.doc-lightbox-pic')!;
  const fitted = parseFloat(pic.style.width);
  dlg.querySelector<HTMLElement>('[data-lb="out"]')!.click();
  assert.equal(parseFloat(pic.style.width), fitted);
  for (let i = 0; i < 20; i++) dlg.querySelector<HTMLElement>('[data-lb="in"]')!.click();
  assert.equal(dlg.querySelector('[data-lb="in"]')!.getAttribute('aria-disabled'), 'true', 'zoom in stops at the limit');
  dlg.querySelector<HTMLElement>('[data-lb="fit"]')!.click();
  assert.ok(Math.abs(parseFloat(pic.style.width) - fitted) < 0.01);
  dispose();
});

test('previous and next walk the page\'s pictures in order, and the arrows do too at the fit', () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  root.querySelector<HTMLElement>('.shot .doc-lightbox-open')!.click();
  const dlg = dialog()!;
  const count = dlg.querySelector('.doc-lightbox-count')!;
  assert.equal(count.textContent, '1 of 3');
  assert.equal(dlg.querySelector('[data-lb="prev"]')!.getAttribute('aria-disabled'), 'true');
  dlg.querySelector<HTMLElement>('[data-lb="next"]')!.click();
  assert.equal(count.textContent, '2 of 3');
  assert.equal(dlg.querySelector('.doc-lightbox-pic img')!.getAttribute('src'), '/info/diagrams/concepts/paths.svg');
  key(w.document.activeElement!, 'ArrowRight');
  assert.equal(count.textContent, '3 of 3');
  assert.ok(dlg.querySelector('.doc-lightbox-art'));
  assert.equal(dlg.querySelector('[data-lb="next"]')!.getAttribute('aria-disabled'), 'true');
  key(w.document.activeElement!, 'ArrowLeft');
  assert.equal(count.textContent, '2 of 3');
  dispose();
});

test('Escape closes, is not seen by the page, and focus goes back to the trigger', () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons });
  let pageSawEscape = false;
  const onDoc = (e: KeyboardEvent) => { if (e.key === 'Escape') pageSawEscape = true; };
  w.document.addEventListener('keydown', onDoc);
  const trigger = root.querySelector<HTMLElement>('.docs-diagram .doc-lightbox-open')!;
  trigger.click();
  assert.ok(isOpen());
  const e = key(w.document.activeElement!, 'Escape');
  assert.ok(e.defaultPrevented);
  assert.equal(isOpen(), false);
  assert.equal(pageSawEscape, false);
  assert.equal(w.document.activeElement, trigger);
  // After a pointer open the trigger takes the focus back too.
  root.querySelector<HTMLElement>('.docs-diagram > img')!.click();
  dialog()!.querySelector<HTMLElement>('[data-lb="close"]')!.click();
  assert.equal(w.document.activeElement, trigger);
  w.document.removeEventListener('keydown', onDoc);
  dispose();
});

// ── Back ─────────────────────────────────────────────────────────────────────

test('on /info, Back closes the viewer through one same-address entry that moves no anchor', async () => {
  reset();
  const root = page();
  const dispose = enhanceDocsLightbox(root, { labels, icons, back: sameEntryBack(w as unknown as Window) });
  const href = w.location.href;
  const before = w.history.length;
  let hashchanges = 0;
  const onHash = () => { hashchanges++; };
  w.addEventListener('hashchange', onHash);

  root.querySelector<HTMLElement>('.shot .doc-lightbox-open')!.click();
  assert.equal(w.history.length, before + 1);
  assert.equal(w.location.href, href);
  const back = popped();
  w.history.back();
  await back;
  assert.equal(isOpen(), false, 'Back closed the viewer');
  assert.equal(w.location.href, href);

  // Closed from inside, the viewer gives its entry back, so the next Back leaves the page.
  root.querySelector<HTMLElement>('.shot .doc-lightbox-open')!.click();
  assert.ok(isOpen());
  const given = popped();
  key(w.document.activeElement!, 'Escape');
  assert.equal(isOpen(), false);
  await given;
  assert.equal(w.location.href, href);
  assert.equal(hashchanges, 0, 'no anchor moved');
  w.removeEventListener('hashchange', onHash);
  dispose();
});

test('an address change while open leaves the entry in place rather than undo it', async () => {
  const adapter = sameEntryBack(w as unknown as Window);
  let dismissed = 0;
  const release = adapter(() => { dismissed++; });
  w.history.pushState(null, '', '/info/create/design.html#elsewhere');
  const at = w.location.href;
  release();
  await flush();
  assert.equal(w.location.href, at, 'release did not go back over the reader\'s navigation');
  assert.equal(dismissed, 0);
  w.history.replaceState(null, '', '/info/create/design.html#the-design-window');
});
