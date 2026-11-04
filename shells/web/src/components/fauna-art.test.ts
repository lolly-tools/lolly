// SPDX-License-Identifier: MPL-2.0
/**
 * components/fauna-art.ts: Lolly's Fauna line drawings. Each drawing is decoration
 * hidden from assistive technology, drawn in the kangaroo's system (a 2-unit round
 * stroke in currentColor, nothing filled), with ids of its own and a motion that
 * starts once, settles on the still and never runs under reduced motion. Then
 * hydrateFauna(): it fills the slots the views leave, turns each animal towards
 * what it watches, and plays each slot once per session, the first time it is seen.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/fauna-art.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/start' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.Element = dom.window.Element as unknown as typeof globalThis.Element;
globalThis.HTMLElement = dom.window.HTMLElement as unknown as typeof globalThis.HTMLElement;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window) as typeof globalThis.getComputedStyle;

const { faunaArt, faceFauna, playFauna, hydrateFauna, FAUNA_NAMES, isFaunaName, _resetFaunaForTests } = await import('./fauna-art.ts');

/** A detached host holding the markup, for reading it back. */
function parse(markup: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = markup;
  return host;
}

/** The command letters of a path, which SMIL needs to match between poses to morph rather than jump. */
const commands = (d: string): string => d.replace(/[^A-Za-z]/g, '');

/** Run with motion allowed or reduced, then restore the globals. */
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

/** Record beginElement() calls by the id of the element they were made on. */
function recordStarts(): { started: string[]; stop: () => void } {
  const started: string[] = [];
  const proto = dom.window.SVGElement.prototype as unknown as { beginElement?: (this: Element) => void };
  proto.beginElement = function beginElement(this: Element): void { started.push(this.id); };
  return { started, stop: () => { delete proto.beginElement; } };
}

/** A stand-in IntersectionObserver whose entries the test delivers by hand. */
class FakeObserver {
  static all: FakeObserver[] = [];
  readonly watched = new Set<Element>();
  readonly callback: (entries: { target: Element; isIntersecting: boolean }[]) => void;
  constructor(callback: (entries: { target: Element; isIntersecting: boolean }[]) => void) {
    this.callback = callback;
    FakeObserver.all.push(this);
  }
  observe(el: Element): void { this.watched.add(el); }
  unobserve(el: Element): void { this.watched.delete(el); }
  disconnect(): void { this.watched.clear(); }
  /** Bring el into view (or out of view) for every observer watching el. */
  static show(el: Element, isIntersecting = true): void {
    for (const o of FakeObserver.all) if (o.watched.has(el)) o.callback([{ target: el, isIntersecting }]);
  }
}

function withObserver<T>(run: () => T): T {
  FakeObserver.all = [];
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = FakeObserver;
  try {
    return run();
  } finally {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  }
}

const slot = (name: string, watch = '', key = ''): HTMLElement => {
  const el = document.createElement('span');
  el.className = 'fauna-slot';
  el.dataset.fauna = name;
  if (watch) el.dataset.faunaWatch = watch;
  if (key) el.dataset.faunaKey = key;
  el.setAttribute('aria-hidden', 'true');
  return el;
};

// ── The drawings ─────────────────────────────────────────────────────────────────

test('there are four animals: the lorikeet, the magpie, the wombat and the koala', () => {
  assert.deepEqual([...FAUNA_NAMES], ['lorikeet', 'magpie', 'wombat', 'koala']);
  assert.ok(isFaunaName('koala'));
  assert.ok(!isFaunaName('kangaroo'), 'the kangaroo keeps its own module');
  assert.ok(!isFaunaName('toString'), 'an inherited name is not an animal');
});

test('every drawing is decoration in the kangaroo\'s system: hidden, nothing to read or focus, one round stroke in currentColor', () => {
  for (const name of FAUNA_NAMES) {
    const svg = parse(faunaArt(name)).querySelector('svg')!;
    assert.equal(svg.getAttribute('aria-hidden'), 'true', name);
    assert.equal(svg.getAttribute('focusable'), 'false', name);
    assert.equal(svg.querySelectorAll('title, desc, [role], [aria-label], [tabindex]').length, 0, `${name}: nothing to read or focus`);
    assert.equal(svg.getAttribute('stroke'), 'currentColor', name);
    assert.equal(svg.getAttribute('stroke-width'), '2', name);
    assert.equal(svg.getAttribute('stroke-linecap'), 'round', name);
    assert.equal(svg.getAttribute('stroke-linejoin'), 'round', name);
    assert.equal(svg.getAttribute('fill'), 'none', `${name}: nothing filled, so it works on any ground`);
    // (An animate's fill="freeze" is SMIL timing, not paint.)
    assert.equal(svg.querySelectorAll('path[fill], g[fill], [stroke], [style], [class]').length, 0, `${name}: no colour or style inside the drawing`);
    const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    assert.deepEqual([w, h], [96, 96], `${name}: the same 96-unit square frame as every animal`);
    assert.ok(svg.classList.contains('fauna') && svg.classList.contains(`fauna--${name}`), name);
    const paths = svg.querySelectorAll('path');
    assert.ok(paths.length >= 4 && paths.length <= 8, `${name}: a few strokes, not clip art (${paths.length})`);
  }
});

test('every drawing has ids of its own, without a hyphen, and every motion follows its own trigger', () => {
  for (const name of FAUNA_NAMES) {
    const host = parse(faunaArt(name) + faunaArt(name));
    const [first, second] = [...host.querySelectorAll('svg')];
    const ids = (svg: Element): string[] => [...svg.querySelectorAll('[id]')].map(el => el.id);
    assert.equal(ids(first!).length, 1, `${name}: one id, the trigger`);
    assert.deepEqual(ids(first!).filter(id => ids(second!).includes(id)), [], `${name}: two drawings share no id`);
    for (const svg of [first!, second!]) {
      const [own] = ids(svg);
      // Chrome reads a hyphen in a begin value as a negative offset, and the motion never starts.
      assert.match(own!, /^\w+$/, `${name}: ${own}`);
      const trigger = svg.querySelector('[data-fauna-go]')!;
      assert.equal(trigger.id, own);
      assert.equal(trigger.getAttribute('begin'), 'indefinite', `${name}: nothing starts by itself`);
      const begins = [...svg.querySelectorAll('animate')].filter(el => el !== trigger).map(el => el.getAttribute('begin'));
      assert.ok(begins.length >= 1, name);
      for (const begin of begins) assert.equal(begin, `${own}.begin`, `${name}: ${begin}`);
    }
  }
});

test('the still is the end pose, every motion is short and never repeats, and each pose keeps the same commands', () => {
  for (const name of FAUNA_NAMES) {
    const motions = [...parse(faunaArt(name)).querySelectorAll('animate')];
    assert.ok(motions.length >= 1, name);
    for (const motion of motions) {
      const values = motion.getAttribute('values')!.split(';');
      const target = motion.parentElement!;
      assert.equal(target.getAttribute('d'), values.at(-1), `${name}: the drawing already stands where the motion settles`);
      assert.equal(motion.getAttribute('fill'), 'freeze', `${name}: and stays there`);
      assert.equal(motion.getAttribute('attributeName'), 'd', name);
      assert.ok(Number.parseInt(motion.getAttribute('dur')!, 10) < 1500, `${name}: under 1.5 s`);
      assert.equal(motion.getAttribute('repeatCount'), null, `${name}: one shot`);
      assert.equal(motion.getAttribute('repeatDur'), null, `${name}: one shot`);
      assert.equal(new Set(values.map(commands)).size, 1, `${name}: the path morphs between poses instead of jumping`);
      assert.equal(values.length, motion.getAttribute('keyTimes')!.split(';').length, name);
      assert.equal(values.length - 1, motion.getAttribute('keySplines')!.split(';').length, name);
      assert.notEqual(values[0], values.at(-1), `${name}: the motion moves`);
    }
  }
});

test('an animal faces right as drawn, and left when asked, mirrored inside its own frame', () => {
  const right = parse(faunaArt('lorikeet')).querySelector('svg')!;
  assert.equal(right.getAttribute('data-fauna-face'), 'right');
  assert.equal(right.querySelector('[data-fauna-flip]')!.getAttribute('transform'), null);
  const left = parse(faunaArt('lorikeet', { face: 'left' })).querySelector('svg')!;
  const [x, , w] = left.getAttribute('viewBox')!.split(' ').map(Number);
  assert.equal(left.getAttribute('data-fauna-face'), 'left');
  assert.equal(left.querySelector('[data-fauna-flip]')!.getAttribute('transform'), `matrix(-1 0 0 1 ${2 * x! + w!} 0)`);
  faceFauna(left, 'right');
  assert.equal(left.querySelector('[data-fauna-flip]')!.getAttribute('transform'), null);
  assert.equal(left.getAttribute('data-fauna-face'), 'right');
});

// ── playFauna ────────────────────────────────────────────────────────────────────

test('playFauna starts each drawing\'s own trigger once, and never when the system or Lolly reduces motion', () => {
  const host = parse(faunaArt('magpie') + faunaArt('koala'));
  const triggers = [...host.querySelectorAll('[data-fauna-go]')].map(el => el.id);
  const { started, stop } = recordStarts();
  try {
    assert.equal(withMotion('system', () => playFauna(host)), false);
    assert.equal(withMotion('app', () => playFauna(host)), false);
    assert.deepEqual(started, [], 'reduced motion: the still, and no beginElement()');
    assert.equal(withMotion('allowed', () => playFauna(host)), true);
    assert.deepEqual(started, triggers, 'motion allowed: one beginElement() per drawing, on its own trigger');
  } finally {
    stop();
  }
});

test('playFauna leaves the still where SMIL is missing (a test DOM, an old engine)', () => {
  assert.equal(withMotion('allowed', () => playFauna(parse(faunaArt('wombat')))), false);
});

// ── hydrateFauna ─────────────────────────────────────────────────────────────────

test('hydrateFauna fills each empty slot with its animal and leaves unknown and filled slots alone', () => {
  _resetFaunaForTests();
  const root = document.createElement('div');
  const known = FAUNA_NAMES.map(name => slot(name));
  const unknown = slot('platypus');
  root.append(...known, unknown);
  const filled = withMotion('system', () => hydrateFauna(root));
  assert.deepEqual(filled, known);
  for (const el of known) {
    assert.ok(el.querySelector(`svg.fauna--${el.dataset.fauna}`), el.dataset.fauna ?? '');
    assert.equal(el.getAttribute('aria-hidden'), 'true');
  }
  assert.equal(unknown.innerHTML, '', 'an animal Lolly does not draw stays an empty slot');
  const before = known[0]!.innerHTML;
  assert.deepEqual(withMotion('system', () => hydrateFauna(root)), [], 'a second pass fills nothing');
  assert.equal(known[0]!.innerHTML, before, 'and redraws nothing');
});

test('only: a pass limited to approved animals leaves every other slot empty', () => {
  _resetFaunaForTests();
  const root = document.createElement('div');
  const all = FAUNA_NAMES.map(name => slot(name));
  root.append(...all);
  const filled = withMotion('system', () => hydrateFauna(root, { only: ['koala'] }));
  assert.deepEqual(filled.map(el => el.dataset.fauna), ['koala']);
  for (const el of all) {
    if (el.dataset.fauna === 'koala') assert.ok(el.querySelector('svg.fauna--koala'));
    else assert.equal(el.innerHTML, '', `${el.dataset.fauna} stays an empty placeholder`);
  }
});

test('under reduced motion the still shows at once: no waiting, no observer, no motion', () => {
  _resetFaunaForTests();
  const { started, stop } = recordStarts();
  try {
    for (const mode of ['system', 'app'] as const) {
      withObserver(() => {
        const root = document.createElement('div');
        root.append(slot('lorikeet'));
        withMotion(mode, () => hydrateFauna(root));
        const el = root.querySelector<HTMLElement>('.fauna-slot')!;
        assert.equal(el.dataset.faunaState, undefined, `${mode}: the still is visible`);
        assert.equal(FakeObserver.all.length, 0, `${mode}: nothing waits to play`);
      });
    }
    assert.deepEqual(started, []);
  } finally {
    stop();
  }
});

test('with motion allowed, a slot waits unseen until it comes into view, then plays once and shows', () => {
  _resetFaunaForTests();
  const { started, stop } = recordStarts();
  try {
    withMotion('allowed', () => withObserver(() => {
      const root = document.createElement('div');
      const el = slot('magpie', '.logo-drop');
      root.append(el);
      hydrateFauna(root);
      assert.equal(el.dataset.faunaState, 'waiting', 'hidden until seen, so the motion starts from its first pose');
      assert.deepEqual(started, []);
      FakeObserver.show(el, false);
      assert.deepEqual(started, [], 'not yet in view');
      FakeObserver.show(el);
      const trigger = el.querySelector('[data-fauna-go]')!;
      assert.deepEqual(started, [trigger.id], 'one beginElement(), on this slot\'s own trigger');
      assert.equal(el.dataset.faunaState, undefined, 'and the drawing shows');
      FakeObserver.show(el);
      assert.deepEqual(started, [trigger.id], 'it stops watching after the first view');
    }));
  } finally {
    stop();
  }
});

test('a slot plays once per session: the same slot drawn again shows the still at once', () => {
  _resetFaunaForTests();
  const { started, stop } = recordStarts();
  try {
    withMotion('allowed', () => withObserver(() => {
      const first = slot('wombat', '.files-drop');
      const root = document.createElement('div');
      root.append(first);
      hydrateFauna(root);
      FakeObserver.show(first);
      assert.equal(started.length, 1);

      // The view renders again: a new element for the same slot.
      root.replaceChildren(slot('wombat', '.files-drop'));
      hydrateFauna(root);
      const again = root.querySelector<HTMLElement>('.fauna-slot')!;
      assert.equal(again.dataset.faunaState, undefined, 'already played: the still, visible at once');
      assert.equal(FakeObserver.all.at(-1)?.watched.has(again) ?? false, false, 'nothing waits to play');

      // A different slot (its own key) still gets its first view.
      root.replaceChildren(slot('wombat', '.files-drop', 'files-empty-2'));
      hydrateFauna(root);
      const other = root.querySelector<HTMLElement>('.fauna-slot')!;
      assert.equal(other.dataset.faunaState, 'waiting');
      FakeObserver.show(other);
      assert.equal(started.length, 2);
    }));
  } finally {
    stop();
  }
});

test('without IntersectionObserver the still shows at once', () => {
  _resetFaunaForTests();
  const root = document.createElement('div');
  root.append(slot('koala'));
  withMotion('allowed', () => hydrateFauna(root));
  assert.equal(root.querySelector<HTMLElement>('.fauna-slot')!.dataset.faunaState, undefined);
});

test('data-fauna-watch turns the animal towards what it watches', () => {
  _resetFaunaForTests();
  const face = (el: HTMLElement): string | null => el.querySelector('svg')!.getAttribute('data-fauna-face');
  const root = document.createElement('div');
  const target = document.createElement('button');
  target.className = 'pick-colour';
  const toLeft = slot('lorikeet', 'left');
  const toRight = slot('lorikeet', 'right');
  const bySelector = slot('lorikeet', '.pick-colour', 'a');
  const described = slot('lorikeet', 'the Pick a colour door', 'b');
  root.append(target, toLeft, toRight, bySelector, described);
  const rect = (left: number, width: number) => ({ left, width, top: 0, height: 10, right: left + width, bottom: 10, x: left, y: 0, toJSON: () => ({}) });
  target.getBoundingClientRect = () => rect(0, 100) as DOMRect;
  bySelector.getBoundingClientRect = () => rect(300, 72) as DOMRect;
  withMotion('system', () => hydrateFauna(root));
  assert.equal(face(toLeft), 'left');
  assert.equal(face(toRight), 'right');
  assert.equal(face(bySelector), 'left', 'the target is on the slot\'s left');
  assert.equal(face(described), 'right', 'a description finds nothing to measure: the animal faces as drawn');
});

test('the slot styles: Lolly\'s quiet tone, a size the host can set, and the waiting state hides the drawing', () => {
  const css = readFileSync(new URL('../styles/parts/fauna.css', import.meta.url), 'utf8');
  assert.match(css, /\.fauna-slot \{[^}]*color: color-mix\(in oklab, var\(--lolly-mark, var\(--lolly-tone\)\) 40%, hsl\(var\(--muted-foreground\)\)\);/);
  assert.match(css, /width: var\(--fauna-size,/);
  assert.match(css, /\.fauna-slot\[data-fauna-state="waiting"\] svg \{ opacity: 0;/);
  assert.match(css, /@media \(forced-colors: active\) \{\s*\.fauna-slot \{ color: CanvasText; \}/);
  const app = readFileSync(new URL('../styles/app.css', import.meta.url), 'utf8');
  assert.match(app, /@import '\.\/parts\/fauna\.css'\s+layer\(chrome\);/, 'chrome, never a tool canvas');
});
