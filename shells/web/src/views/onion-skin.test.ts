// SPDX-License-Identifier: MPL-2.0
/**
 * onion-skin - the opt-in ghost layer, and above all its EXPORT CONTRACT.
 *
 * The feature is one paragraph of drawing code and one very hard constraint: a ghost
 * must never reach a rendered file. That constraint is why the ghosts are an overlay
 * layer rather than a class on the real box, and this file is where the three
 * independent guarantees are pinned - independent on purpose, so no single refactor
 * can quietly remove all three:
 *
 *   (a) the layer is NOT a descendant of the canvas - it is outside the node
 *       `runtime.export` is handed;
 *   (b) it carries [data-export-hide], so bridge/export.ts's detachExportHidden
 *       REMOVES it from the DOM even if an export node were ever widened to the stage;
 *   (c) the module never writes a class or an inline style to a `.lolly-box`, pinned
 *       by a source scan - because CSS-only hiding is demonstrably not export-safe here
 *       (bridge/sequence-render.ts has to strip `.seq-off` before photographing a layer
 *       or dom-to-image clones `display:none` and rasterises blank).
 *
 * Plus a byte-identity guard: every `.lolly-box`'s className and inline cssText is
 * snapshotted before the ghosts are mounted and compared after a paint. Exports are
 * byte-identical with onion skin on because the artboard is not touched at all.
 *
 * NOT covered here (browser-only): that the ghosts LOOK right - jsdom has no layout,
 * no colour resolution and no `oklch()`, so the alpha ramp, the outline weight, the
 * corner chip's `content: attr(data-offset)` and the high-contrast branch are all
 * assertions about the stylesheet's text, made in styles/parts/onion.css itself.
 *
 * Run directly:  node --test shells/web/src/views/onion-skin.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerHooks } from 'node:module';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';

registerHooks({
  load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
    if (url.endsWith('.css')) return { format: 'module', shortCircuit: true, source: 'export default {};' };
    return next(url, ctx);
  },
} as Parameters<typeof registerHooks>[0]);

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'Image']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const { mountOnionSkin } = await import('./onion-skin.ts');

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'onion-skin.ts'), 'utf8');

/** free-canvas's own resolved field names, narrowed to the ones a ghost reads. */
const cfg = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h',
  rotationField: 'rot', radiusField: 'radius', fillField: 'bg', fitField: 'fit',
};

/** A stage/canvas offset and a zoom that are all distinct, so no term can hide. */
const METRICS = { cr: { left: 100, top: 50 }, sr: { left: 20, top: 10 }, scale: 0.5 };

interface Fixture {
  overlay: HTMLElement;
  canvasEl: HTMLElement;
  layer(): HTMLElement;
  ghosts(): HTMLElement[];
  skin: ReturnType<typeof mountOnionSkin>;
  /** className + inline cssText of every rendered box - the export byte-identity probe. */
  boxSnapshot(): string[];
  teardown(): void;
}

function mount(boxes: Box[], markup: Record<string, string> = {}): Fixture {
  const doc = dom.window.document;
  const stage = doc.createElement('div');
  const canvasEl = doc.createElement('div');
  canvasEl.id = 'tool-canvas';
  const overlay = doc.createElement('div');
  overlay.className = 'fc-overlay';
  overlay.setAttribute('data-export-hide', '');
  // The real shape: the overlay is a SIBLING of the canvas, both children of the stage.
  stage.append(canvasEl, overlay);
  doc.body.appendChild(stage);

  for (const b of boxes) {
    const id = String((b as Record<string, unknown>).id);
    const el = doc.createElement('div');
    el.className = 'lolly-box';
    el.setAttribute('data-box-id', id);
    el.style.left = '0px';                       // an authored inline style to protect
    if (markup[id]) el.innerHTML = markup[id]!;
    canvasEl.appendChild(el);
  }

  const skin = mountOnionSkin({
    overlayEl: overlay, canvasEl, cfg,
    getBoxes: () => boxes,
    metricsOf: () => METRICS,
  });
  return {
    overlay, canvasEl, skin,
    layer: () => overlay.querySelector('.onion-layer') as HTMLElement,
    ghosts: () => [...overlay.querySelectorAll('.onion-ghost')] as HTMLElement[],
    boxSnapshot: () => [...canvasEl.querySelectorAll('.lolly-box')]
      .map((el) => `${el.getAttribute('data-box-id')}|${el.className}|${(el as HTMLElement).style.cssText}`),
    teardown() { try { skin.destroy(); } catch { /* already gone */ } stage.remove(); },
  };
}

const box = (id: string, extra: Record<string, unknown> = {}): Box =>
  ({ id, x: 0, y: 0, w: 100, h: 100, ...extra } as Box);

// ── (a) + (b): where the layer lives ──────────────────────────────────────────

test('(a) the ghost layer is NOT inside the canvas - outside the node runtime.export sees', () => {
  const f = mount([box('a'), box('b')]);
  try {
    const layer = f.layer();
    assert.ok(layer, 'the layer mounted');
    assert.equal(f.canvasEl.contains(layer), false,
      'a descendant of #tool-canvas would be walked by every export path');
    assert.equal(layer.parentElement, f.overlay);
    assert.equal(f.overlay.firstElementChild, layer,
      'FIRST child: ghosts paint under the frame scrim and under all selection chrome');
  } finally { f.teardown(); }
});

test('(b) the layer carries [data-export-hide], so detachExportHidden removes it outright', () => {
  const f = mount([box('a')]);
  try {
    const layer = f.layer();
    assert.ok(layer.hasAttribute('data-export-hide'));
    assert.equal(layer.getAttribute('aria-hidden'), 'true', 'decorative: never announced');
    // The exact query detachExportHidden runs, from the stage down.
    const stage = f.overlay.parentElement!;
    assert.ok([...stage.querySelectorAll('[data-export-hide]')].includes(layer));
  } finally { f.teardown(); }
});

// ── (c): the module never writes to a .lolly-box ──────────────────────────────

test('(c) source scan: no class is ever written, and every style/attribute write is on a ghost', () => {
  // A class on the real box (a `.seq-ghost { opacity: .3 }`) would be baked straight
  // into every exported plate. The module reads the live element - classList.contains
  // and an <img>'s currentSrc - and nothing else.
  for (const sink of ['classList.add(', 'classList.remove(', 'classList.toggle(']) {
    assert.equal(SOURCE.includes(sink), false, `onion-skin.ts must never call ${sink}`);
  }
  // Every inline-style and attribute write must target a node this module MINTED.
  // `live` / `canvasEl` are the read-only handles on the artboard; if either ever
  // appears on the left of a write, this fails.
  // Nodes this module CREATED - including `clone`/`sub`, which are cloneNode products:
  // a clone is the module's own node, and the element it was copied from is never
  // touched (the byte-identity test below is the independent proof of that).
  const MINTED = new Set(['g', 'f', 'img', 'layer', 'holder', 'clone', 'sub']);
  const writes = (re: RegExp): string[] => {
    const out: string[] = [];
    const r = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = r.exec(SOURCE))) out.push(m[1]!);
    return out;
  };
  for (const name of writes(/(\w+)\.style\./)) {
    assert.ok(MINTED.has(name), `${name}.style.* writes to a node this module did not create`);
  }
  for (const name of writes(/(\w+)\.setAttribute\(/)) {
    assert.ok(MINTED.has(name), `${name}.setAttribute() writes to a node this module did not create`);
  }
  // Non-vacuity: the scan must still be looking at the real module.
  assert.ok(SOURCE.includes('.lolly-box[data-box-id]'), 'the source still reads the live boxes');
  assert.ok(SOURCE.includes('classList.contains('), 'and still only READS their classes');
});

test('export byte-identity: the artboard is not touched at all, so exports do not move', () => {
  const f = mount([box('a'), box('b'), box('c')], {
    b: '<img class="lolly-box-img" src="https://x.test/p.png">',
  });
  try {
    const before = f.boxSnapshot();
    f.skin.paint({ mode: 'filled', past: ['a'], future: ['b', 'c'], opacity: 1 });
    assert.ok(f.ghosts().length > 0, 'precondition: ghosts really were drawn');
    assert.deepEqual(f.boxSnapshot(), before,
      'not one class and not one inline style changed on any .lolly-box');
    f.skin.destroy();
    assert.deepEqual(f.boxSnapshot(), before, 'and teardown leaves the artboard alone too');
  } finally { f.teardown(); }
});

// ── geometry ──────────────────────────────────────────────────────────────────

test('a ghost is the MODEL rect through the injected metrics - the same map the outline uses', () => {
  const f = mount([box('a', { x: 200, y: 100, w: 400, h: 300, rot: 12, radius: 40 })]);
  try {
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1 });
    const g = f.ghosts()[0]!;
    // cr.left - sr.left + x*scale = 100 - 20 + 200*0.5
    assert.equal(g.style.left, '180px');
    assert.equal(g.style.top, '90px');           // 50 - 10 + 100*0.5
    assert.equal(g.style.width, '200px');        // 400 * 0.5
    assert.equal(g.style.height, '150px');       // 300 * 0.5
    assert.equal(g.style.transform, 'rotate(12deg)');
    assert.equal(g.style.borderRadius, '20px', 'the radius scales with the canvas');
    assert.equal(g.getAttribute('data-offset'), '-1');
  } finally { f.teardown(); }
});

test('offsets are signed and ordered, and the FURTHEST ghost paints first', () => {
  const f = mount([box('p2'), box('p1'), box('f1'), box('f2')]);
  try {
    f.skin.paint({ mode: 'outline', past: ['p1', 'p2'], future: ['f1', 'f2'], opacity: 1 });
    assert.deepEqual(f.ghosts().map((g) => g.getAttribute('data-offset')),
      ['-2', '-1', '+2', '+1'],
      'nearest-first input, furthest-first in the DOM so the near ghost sits on top');
  } finally { f.teardown(); }
});

test('a degenerate box and an AUDIO box produce no ghost at all', () => {
  const f = mount(
    [box('tiny', { w: 1, h: 400 }), box('snd'), box('ok')],
    { snd: '<div class="lolly-box-audio" data-audio-src="vo.mp3"></div>' },
  );
  try {
    f.skin.paint({ mode: 'outline', past: ['tiny', 'snd'], future: ['ok'], opacity: 1 });
    assert.equal(f.ghosts().length, 1, 'only the real, visible box drew');
    assert.equal(f.ghosts()[0]!.getAttribute('data-offset'), '+1');
  } finally { f.teardown(); }
});

test('an id with no box in the model is skipped, not drawn as a phantom', () => {
  const f = mount([box('a')]);
  try {
    f.skin.paint({ mode: 'outline', past: ['ghosted-away'], future: ['a'], opacity: 1 });
    assert.deepEqual(f.ghosts().map((g) => g.getAttribute('data-offset')), ['+1']);
  } finally { f.teardown(); }
});

// ── modes ─────────────────────────────────────────────────────────────────────

test('outline mode draws no fill and no picture - the default is deliberately austere', () => {
  const f = mount([box('a', { bg: '#ff0000' })], {
    a: '<img class="lolly-box-img" src="https://x.test/p.png">',
  });
  try {
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1 });
    assert.equal(f.ghosts()[0]!.querySelector('.onion-fill'), null);
    assert.equal(f.ghosts()[0]!.querySelector('.onion-img'), null);
  } finally { f.teardown(); }
});

test('filled mode adds the box fill and reuses the box’s OWN cached <img> - no rasteriser', () => {
  const f = mount([box('a', { bg: '#ff0000', fit: 'cover' })], {
    a: '<img class="lolly-box-img" src="https://x.test/p.png">',
  });
  try {
    // jsdom does not implement currentSrc; the browser sets it once the image resolves.
    const live = f.canvasEl.querySelector('img.lolly-box-img')!;
    Object.defineProperty(live, 'currentSrc', { value: 'https://x.test/p.png', configurable: true });
    f.skin.paint({ mode: 'filled', past: ['a'], future: [], opacity: 1 });
    const g = f.ghosts()[0]!;
    const fill = g.querySelector('.onion-fill') as HTMLElement;
    assert.ok(fill, 'the fill underlay is there');
    assert.match(fill.style.background, /rgb\(255, 0, 0\)|#ff0000/);
    const img = g.querySelector('.onion-img') as HTMLImageElement;
    assert.ok(img, 'and the picture');
    assert.equal(img.getAttribute('src'), 'https://x.test/p.png', 'the URL the browser already has');
    assert.equal(img.style.objectFit, 'cover', 'object-fit copied from the box’s own fit field');
    assert.equal(img.alt, '', 'decorative');
  } finally { f.teardown(); }
});

test('a VIDEO box in filled mode degrades to fill-only rather than drawing nothing', () => {
  const f = mount([box('a', { bg: '#00ff00' })], { a: '<video src="clip.mp4"></video>' });
  try {
    f.skin.paint({ mode: 'filled', past: ['a'], future: [], opacity: 1 });
    const g = f.ghosts()[0]!;
    assert.ok(g.querySelector('.onion-fill'));
    assert.equal(g.querySelector('.onion-img'), null);
  } finally { f.teardown(); }
});

test('"Hide colourful previews" forces filled → outline', () => {
  const f = mount([box('a', { bg: '#ff0000' })], {
    a: '<img class="lolly-box-img" src="https://x.test/p.png">',
  });
  const html = dom.window.document.documentElement;
  try {
    const live = f.canvasEl.querySelector('img.lolly-box-img')!;
    Object.defineProperty(live, 'currentSrc', { value: 'https://x.test/p.png', configurable: true });
    html.setAttribute('data-a11y-previews', 'hidden');
    f.skin.paint({ mode: 'filled', past: ['a'], future: [], opacity: 1 });
    assert.equal(f.layer().getAttribute('data-mode'), 'outline');
    assert.equal(f.ghosts()[0]!.querySelector('.onion-fill'), null,
      'the filled ghost is exactly the colourful-preview noise that pref removes');
    assert.equal(f.ghosts()[0]!.querySelector('.onion-img'), null);
  } finally { html.removeAttribute('data-a11y-previews'); f.teardown(); }
});

// ── the coincident case ───────────────────────────────────────────────────────
// A sequence's scenes are same-size and usually full-canvas, so a neighbour's rect is
// the ACTIVE scene's rect. An outline then lands exactly on that scene's own edge (and
// on the other ghost's), which is why the toggle read as doing nothing: measured live,
// onion skin ON produced two coincident 1px lines at 30% and a corner chip clipped off
// the canvas. Escalating to the picture is the only thing left that carries information.

test('a ghost coincident with the ACTIVE scene escalates to the picture, even in outline mode', () => {
  const f = mount([box('a', { bg: '#ff0000' }), box('live', { bg: '#0000ff' })], {
    a: '<div class="lolly-box-text" style="font-size:96px">One</div>',
  });
  try {
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1, active: ['live'] });
    const g = f.ghosts()[0]!;
    assert.ok(g.hasAttribute('data-coincident'), 'flagged for the stylesheet');
    assert.ok(g.querySelector('.onion-fill'), 'the neighbour’s colour');
    const holder = g.querySelector('.onion-text') as HTMLElement;
    assert.ok(holder, 'and its words - a text-only scene has no fill worth 12% and no <img>');
    assert.equal(holder.textContent, 'One');
    // Laid out at the box's NATIVE size and scaled as a unit: the font-size is native px.
    assert.equal(holder.style.width, '100px');
    // Past is nudged UP, future DOWN, in stage px (the translate composes before the
    // scale): two coincident ghosts would otherwise centre their words on each other.
    assert.equal(holder.style.transform, `translateY(${-0.25 * 100 * METRICS.scale}px) scale(${METRICS.scale})`);
    // The clone gives up its own colour so the ghost's warm/cool coding can show
    // through - two coincident ghosts otherwise draw the same-coloured words in the
    // same place.
    assert.equal((holder.firstElementChild as HTMLElement).style.color, '');
  } finally { f.teardown(); }
});

test('a ghost whose rect DIFFERS from the active scene stays austere', () => {
  const f = mount([box('a', { bg: '#ff0000' }), box('live', { x: 40, bg: '#0000ff' })], {
    a: '<div class="lolly-box-text">One</div>',
  });
  try {
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1, active: ['live'] });
    const g = f.ghosts()[0]!;
    assert.equal(g.hasAttribute('data-coincident'), false);
    assert.equal(g.querySelector('.onion-fill'), null, 'the outline still says everything it needs to');
    assert.equal(g.querySelector('.onion-text'), null);
  } finally { f.teardown(); }
});

test('no active ids at all: nothing escalates (the austere default is the fallback)', () => {
  const f = mount([box('a', { bg: '#ff0000' })], { a: '<div class="lolly-box-text">One</div>' });
  try {
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1 });
    assert.equal(f.ghosts()[0]!.hasAttribute('data-coincident'), false);
    assert.equal(f.ghosts()[0]!.querySelector('.onion-text'), null);
  } finally { f.teardown(); }
});

test('"Hide colourful previews" suppresses the escalation too, not just filled mode', () => {
  const f = mount([box('a', { bg: '#ff0000' }), box('live', { bg: '#0000ff' })], {
    a: '<div class="lolly-box-text">One</div>',
  });
  const html = dom.window.document.documentElement;
  try {
    html.setAttribute('data-a11y-previews', 'hidden');
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1, active: ['live'] });
    const g = f.ghosts()[0]!;
    assert.equal(g.hasAttribute('data-coincident'), false,
      'the pref removes pictures; escalating would route around it');
    assert.equal(g.querySelector('.onion-fill'), null);
    assert.equal(g.querySelector('.onion-text'), null);
  } finally { html.removeAttribute('data-a11y-previews'); f.teardown(); }
});

test('the cloned text carries no id - a duplicate would capture the original’s references', () => {
  const f = mount([box('a', { bg: '#ff0000' }), box('live', { bg: '#0000ff' })], {
    a: '<div class="lolly-box-text" id="t1">One <span id="inner">two</span></div>',
  });
  try {
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1, active: ['live'] });
    const holder = f.ghosts()[0]!.querySelector('.onion-text') as HTMLElement;
    assert.ok(holder);
    assert.equal(holder.querySelectorAll('[id]').length, 0);
    // Non-vacuity: the original is untouched and keeps both ids.
    assert.equal(f.canvasEl.querySelectorAll('.lolly-box-text[id], .lolly-box-text [id]').length, 2);
  } finally { f.teardown(); }
});

test('escalation still writes NOTHING to the live box (the export contract holds)', () => {
  const f = mount([box('a', { bg: '#ff0000' }), box('live', { bg: '#0000ff' })], {
    a: '<div class="lolly-box-text">One</div>',
  });
  try {
    const before = f.boxSnapshot();
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1, active: ['live'] });
    assert.ok(f.ghosts()[0]!.querySelector('.onion-text'), 'premise: it really did escalate');
    assert.deepEqual(f.boxSnapshot(), before);
  } finally { f.teardown(); }
});

// ── the off state ─────────────────────────────────────────────────────────────

test('no mode, an unknown mode, or no neighbours: the layer paints nothing and hides', () => {
  const f = mount([box('a')]);
  try {
    for (const state of [
      undefined,
      { past: ['a'], future: [] },
      { mode: 'sepia', past: ['a'], future: [] },
      { mode: 'outline', past: [], future: [] },
      { mode: 'outline', past: 'a' as unknown as string[], future: null as unknown as string[] },
    ]) {
      f.skin.paint(state as never);
      assert.equal(f.ghosts().length, 0, `no ghosts for ${JSON.stringify(state)}`);
      assert.equal(f.layer().hidden, true, `hidden for ${JSON.stringify(state)}`);
    }
    // …and a real state still works afterwards: this is a suppression, not a latch.
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1 });
    assert.equal(f.layer().hidden, false);
    assert.equal(f.ghosts().length, 1);
  } finally { f.teardown(); }
});

test('the master strength is clamped to 0…1 and lands on the layer, never on a box', () => {
  const f = mount([box('a')]);
  try {
    for (const [given, want] of [[0.4, '0.4'], [-3, '0'], [9, '1'], [NaN, '1'], ['x', '1']] as const) {
      f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: given as number });
      assert.equal(f.layer().style.getPropertyValue('--onion-master'), want, `opacity ${given}`);
    }
  } finally { f.teardown(); }
});

test('destroy() takes the whole layer with it and every later paint is inert', () => {
  const f = mount([box('a')]);
  try {
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1 });
    f.skin.destroy();
    assert.equal(f.overlay.querySelector('.onion-layer'), null);
    f.skin.paint({ mode: 'outline', past: ['a'], future: [], opacity: 1 });
    f.skin.destroy();   // idempotent
    assert.equal(f.overlay.querySelector('.onion-layer'), null);
  } finally { f.teardown(); }
});

// ── the stylesheet's own contract ─────────────────────────────────────────────

test('onion.css: layered, pointer-transparent, non-dashed, and colour-blind safe', () => {
  const css = readFileSync(join(HERE, '..', 'styles', 'parts', 'onion.css'), 'utf8');
  assert.match(css, /@layer views \{/, 'a lazy sheet must declare its layer, not rely on load order');
  assert.match(css, /\.onion-layer \{[^}]*pointer-events:\s*none/,
    'belt and braces over .fc-overlay - a ghost must never be hit-testable');
  assert.equal(/border[^:]*:\s*[^;]*dashed/.test(css), false,
    'dashed borders are reserved for drop areas throughout this shell');
  // The redundant non-colour channel (WCAG 1.4.1) is the corner chip, not a dash.
  assert.match(css, /content:\s*attr\(data-offset\)/);
  // Past = warm, future = COOL BLUE (never green: red/green is the worst pair for
  // deuteranopia and protanopia).
  assert.match(css, /--onion-past:\s*oklch\(/);
  assert.match(css, /--onion-future:\s*oklch\([^)]*\b2[0-9][0-9]\)/, 'the future hue is in the blues');
  // Both a11y branches, attribute-qualified on html beside the OS-preference block.
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.onion-ghost/);
  assert.match(css, /html\[data-a11y-contrast="high"\] \.onion-ghost/);
  assert.match(css, /html\[data-a11y-previews="hidden"\]/);
  // Ghost outlines are GEOMETRY and must not ride the type multiplier; the chip is
  // chrome type and must - via var(--fs-2xs), the token that carries the multiplier
  // inside its declaration (plans/172; a11y-prefs-contract sanctions exactly that home).
  assert.equal(/outline[^:]*:\s*calc\([^)]*--a11y-fs/.test(css), false);
  assert.match(css, /font-size:\s*(?:var\(--fs-2xs\)|calc\(10px \* var\(--a11y-fs\)\))/);
});

test('onion.css: no custom property is defined in terms of ITSELF', () => {
  // A declaration whose value references its own property is a cycle (CSS Custom
  // Properties L1 section 3.2): it computes to the guaranteed-invalid value, and it does NOT
  // fall through to the inherited one. The high-contrast branch was written as
  // `--onion-master: max(var(--onion-master), 0.6)` on the ghost, intending to floor the
  // value the LAYER writes inline - which instead invalidated every opacity built on it,
  // and since opacity is not inherited, painted the ghosts at full strength over the live
  // scene. The floor is a second token (--onion-floor) for exactly that reason.
  const css = readFileSync(join(HERE, '..', 'styles', 'parts', 'onion.css'), 'utf8');
  for (const [, prop, value] of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+)/gi)) {
    assert.equal(
      value!.includes(`var(${prop})`), false,
      `${prop} references itself - that is a cycle, not a read of the inherited value`,
    );
  }
  // And the floor really is wired into both opacity declarations.
  assert.match(css, /--onion-floor:\s*0\s*;/, 'the default floor is nothing at all');
  assert.match(css, /html\[data-a11y-contrast="high"\] \.onion-ghost \{[^}]*--onion-floor:\s*0\.6/);
  const opacities = Array.from(css.matchAll(/opacity:\s*calc\(var\(--onion-o[12]\)[^;]*/g)).map((m) => m[0]);
  assert.equal(opacities.length, 2, 'the base ramp and the ±1 override');
  for (const o of opacities) {
    assert.match(o, /max\(var\(--onion-master\), var\(--onion-floor\)\)/,
      'every ghost opacity reads the master through the floor');
  }
});
