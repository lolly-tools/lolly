// SPDX-License-Identifier: MPL-2.0
/**
 * components/lolly-spin.ts: Lolly's spin at the register. Showing it puts the mark
 * and a polite live label in the container, with gradient ids of its own; showing
 * it again only changes the label; hiding it takes it away. Reduce motion shows the
 * mark still beside the label, and the stylesheet stops a spin already on screen
 * when the system or Lolly asks for reduced motion.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/lolly-spin.test.ts
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/start' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.Element = dom.window.Element as unknown as typeof globalThis.Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;

const { showLollySpin, hideLollySpin } = await import('./lolly-spin.ts');

const box = (): HTMLElement => {
  const el = document.createElement('div');
  document.body.append(el);
  return el;
};

function withMotion<T>(mode: 'allowed' | 'system' | 'app', run: () => T): T {
  globalThis.matchMedia = ((query: string) => ({ matches: mode === 'system' && query.includes('prefers-reduced-motion: reduce') })) as unknown as typeof globalThis.matchMedia;
  if (mode === 'app') document.documentElement.dataset.a11yMotion = 'reduce';
  try {
    return run();
  } finally {
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
    delete document.documentElement.dataset.a11yMotion;
  }
}

test('the spin is the mark, hidden from assistive technology, beside a polite live label', () => {
  const host = box();
  const spin = withMotion('allowed', () => showLollySpin(host, { label: 'Reading the PDF…' }));
  assert.equal(spin.parentElement, host);
  assert.equal(spin.getAttribute('role'), 'status');
  assert.equal(spin.getAttribute('aria-live'), 'polite');
  assert.equal(spin.querySelector('.lolly-spin__label')?.textContent, 'Reading the PDF…');
  const mark = spin.querySelector('.lolly-spin__mark')!;
  assert.equal(mark.getAttribute('aria-hidden'), 'true');
  const svg = mark.querySelector('svg.lolly-mark')!;
  assert.ok(svg, 'Lolly\'s own mark');
  for (const ring of [1, 2, 3]) assert.ok(svg.querySelector(`.lolly-mark__spin-${ring}`), `ring ${ring} can turn`);
  assert.equal(spin.querySelector('canvas'), null, 'CSS animation only');
  assert.ok(!spin.classList.contains('is-still'), 'motion allowed: it turns');
  hideLollySpin(host);
});

test('every spin has gradient ids of its own, and its paint refers only to them', () => {
  const [a, b] = [box(), box()];
  const one = showLollySpin(a);
  const two = showLollySpin(b);
  const ids = (el: Element): string[] => [...el.querySelectorAll('[id]')].map(n => n.id);
  assert.ok(ids(one).length > 10);
  assert.deepEqual(ids(one).filter(id => ids(two).includes(id)), [], 'two spins share no id');
  assert.ok(!one.innerHTML.includes('lolly-primary-') && !one.innerHTML.includes('lolly-reverse-'), 'the mark\'s own ids are replaced');
  for (const spin of [one, two]) {
    const own = new Set(ids(spin));
    for (const el of spin.querySelectorAll('*')) {
      for (const attr of [...el.attributes]) {
        for (const m of attr.value.matchAll(/url\(#([^)]+)\)/g)) assert.ok(own.has(m[1]!), `paint ${m[1]} is this spin's own`);
        if (attr.name === 'href' && attr.value.startsWith('#')) assert.ok(own.has(attr.value.slice(1)), `gradient ${attr.value} is this spin's own`);
      }
    }
  }
  hideLollySpin(a);
  hideLollySpin(b);
});

test('showing it again changes the label, and never adds a second spin', () => {
  const host = box();
  const first = showLollySpin(host, { label: 'Applying the look…' });
  const again = showLollySpin(host, { label: 'Almost there…' });
  assert.equal(again, first);
  assert.equal(host.querySelectorAll('.lolly-spin').length, 1);
  assert.equal(first.querySelector('.lolly-spin__label')?.textContent, 'Almost there…');
  hideLollySpin(host);
});

test('under Reduce motion, the system setting or Lolly\'s own, the mark stands still beside the label', () => {
  for (const mode of ['system', 'app'] as const) {
    const host = box();
    const spin = withMotion(mode, () => showLollySpin(host, { label: 'Importing the design file…' }));
    assert.ok(spin.classList.contains('is-still'), mode);
    assert.ok(spin.querySelector('svg.lolly-mark'), `${mode}: the mark still shows`);
    assert.equal(spin.querySelector('.lolly-spin__label')?.textContent, 'Importing the design file…', `${mode}: with its label`);
    hideLollySpin(host);
  }
});

test('hiding takes the spin away: from one container, or from every container', () => {
  const [a, b] = [box(), box()];
  showLollySpin(a);
  showLollySpin(b);
  hideLollySpin(a);
  assert.equal(a.querySelector('.lolly-spin'), null);
  assert.ok(b.querySelector('.lolly-spin'), 'the other container keeps its spin');
  hideLollySpin();
  assert.equal(document.querySelector('.lolly-spin'), null);
  hideLollySpin(a); // again, with nothing to hide
});

test('a delay keeps a quick job from flashing the spin', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const host = box();
    const spin = showLollySpin(host, { label: 'Reading the PDF…', delayMs: 200 });
    assert.equal(spin.hidden, true, 'not yet');
    mock.timers.tick(199);
    assert.equal(spin.hidden, true);
    mock.timers.tick(1);
    assert.equal(spin.hidden, false, 'shown once the job outlasts the delay');
    hideLollySpin(host);

    const quick = showLollySpin(host, { delayMs: 200 });
    hideLollySpin(host);
    mock.timers.tick(500);
    assert.equal(quick.isConnected, false, 'a job done inside the delay never shows the spin');
  } finally {
    mock.timers.reset();
  }
});

test('the stylesheet: Lolly\'s tone at the brand\'s hue, three rings at 3, 6 and 9 s with a hue drift, and still under reduced motion', () => {
  const css = readFileSync(new URL('../styles/parts/lolly-spin.css', import.meta.url), 'utf8');
  assert.match(css, /\.lolly-spin__mark \{[^}]*--lolly-swirl: var\(--lolly-mark, var\(--lolly-tone\)\);/);
  assert.match(css, /\.lolly-mark__spin-1 \{ animation: lolly-spin-turn 3s linear infinite; \}/);
  assert.match(css, /\.lolly-mark__spin-2 \{ animation: lolly-spin-turn 6s linear infinite; \}/);
  assert.match(css, /\.lolly-mark__spin-3 \{ animation: lolly-spin-turn 9s linear infinite; \}/);
  assert.match(css, /\.lolly-spin__mark \{[^}]*animation: lolly-spin-hue 6s ease-in-out infinite;/, 'the hue drifts on the HTML box, which every engine paints');
  assert.match(css, /@keyframes lolly-spin-hue \{[^@]*hue-rotate\(25deg\)[^@]*hue-rotate\(-25deg\)/);
  const stops = (prefix: RegExp): boolean => {
    const block = prefix.exec(css)?.[0] ?? '';
    return [1, 2, 3].every(n => block.includes(`.lolly-mark__spin-${n}`)) && /\.lolly-spin__mark,/.test(block) && /animation: none/.test(block);
  };
  assert.ok(stops(/\.lolly-spin\.is-still[^}]*\}/), 'the still class stops every ring');
  assert.ok(stops(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\}/), 'the system setting stops every ring');
  assert.ok(stops(/html\[data-a11y-motion="reduce"\][^}]*\}/), 'Lolly\'s own setting stops every ring');
  const app = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');
  assert.match(app, /@import '\.\/parts\/lolly-spin\.css'\s+layer\(chrome\);/, 'chrome, never a tool canvas');
});
