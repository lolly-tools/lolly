// SPDX-License-Identifier: MPL-2.0
/*
 * collab-overlay.ts - the remote cursor layer (plan 100 section 4.3, section 4.6, section 4.8, section 11.14).
 *
 * Run directly:  node --test shells/web/src/components/collab-overlay.test.ts
 *
 * Everything here runs on a FAKE clock and a FAKE rAF, because the three claims
 * worth pinning are all about time and allocation rather than about pixels:
 *
 *  1. UNIT SPACE MAPS THROUGH THE STAGE'S LIVE RECT (section 4.3). Asserted at two zoom
 *     sizes, since "works at 1×" is exactly the bug normalized coordinates exist to
 *     prevent. jsdom's getBoundingClientRect is all zeros, so the rects are injected
 * - a test that measured the real DOM here would pass vacuously.
 *  2. INTERPOLATE, NEVER EXTRAPOLATE. The position walks monotonically from the
 *     previous sample to the newest one and STOPS there, however long the ticker
 *     runs past it; a gap longer than the snap window is read as an absence and
 *     jumps instead of sweeping.
 *  3. THE LOOP COSTS NOTHING WHEN IT SHOULD COST NOTHING. Nodes are pooled by
 *     identity across roster churn; the ticker stands down on an empty roster, under
 *     reduced motion, and - the one a reader will not guess - the moment every peer's
 *     segment has been walked, so a PARKED pointer holds no frame loop; and dispose()
 *     leaves NO frame pending, a leaked rAF in a torn-down tool view being a loop
 *     that runs for the life of the tab.
 *  4. IT IS STYLED BY ITS OWN INJECTED SHEET, and every class it writes onto a node
 *     is defined there. Read off the produced DOM rather than from a hand-list, so a
 *     new class with no rule fails here rather than shipping as an unstyled div.
 *
 * Plus the section 4.6 invariant that makes the whole feature safe: the layer is mounted
 * OUTSIDE the render surface even when a caller asks for it inside - and the
 * re-anchor path a canvas zoom takes, which fires no event of its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="host"><div id="stage"></div></div></body></html>',
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const {
  CURSOR_SNAP_GAP_MS,
  createCollabCursors,
  cursorPosition,
  mapUnitPoint,
  mountOverlayLayer,
} = await import('./collab-overlay.ts');
type Mod = typeof import('./collab-overlay.ts');
type CursorPeer = Parameters<ReturnType<Mod['createCollabCursors']>['setPeers']>[0][number];

// ── harness ───────────────────────────────────────────────────────────────────

/** A rAF stand-in that never fires on its own - the test decides when a frame is. */
function fakeFrames() {
  const queued = new Map<number, () => void>();
  let next = 1;
  return {
    raf(fn: () => void): number {
      const id = next++;
      queued.set(id, fn);
      return id;
    },
    cancelRaf(handle: number): void {
      queued.delete(handle);
    },
    /** How many callbacks are still armed - how "no frame pending" is asserted. */
    pending(): number {
      return queued.size;
    },
    /** Run every armed callback once (a callback may re-arm; that lands next flush). */
    flush(): void {
      const due = [...queued.values()];
      queued.clear();
      for (const fn of due) fn();
    },
  };
}

const STAGE = { left: 100, top: 50, width: 400, height: 200 };
const LAYER = { left: 80, top: 40, width: 440, height: 220 };

interface Harness {
  cursors: ReturnType<Mod['createCollabCursors']>;
  frames: ReturnType<typeof fakeFrames>;
  setNow(t: number): void;
  setStageWidth(w: number): void;
  transformOf(index?: number): string;
  nodes(): HTMLElement[];
}

function mount(opts: { still?: boolean } = {}): Harness {
  const host = document.getElementById('host') as HTMLElement;
  const stage = document.getElementById('stage') as HTMLElement;
  host.innerHTML = '';
  host.appendChild(stage);
  const frames = fakeFrames();
  let t = 0;
  let stageRect = { ...STAGE };
  const cursors = createCollabCursors({
    stage,
    host,
    now: () => t,
    raf: frames.raf,
    cancelRaf: frames.cancelRaf,
    reducedMotion: () => opts.still === true,
    measureStage: () => stageRect,
    measureLayer: () => LAYER,
  });
  const nodes = (): HTMLElement[] => [...(cursors.el?.querySelectorAll<HTMLElement>('.collab-cursor') ?? [])];
  return {
    cursors,
    frames,
    setNow(next: number): void { t = next; },
    setStageWidth(w: number): void { stageRect = { ...stageRect, width: w }; },
    transformOf(index = 0): string { return nodes()[index]?.style.transform ?? ''; },
    nodes,
  };
}

const peer = (id: string, x: number, y: number, extra: Partial<CursorPeer> = {}): CursorPeer =>
  ({ id, name: id.toUpperCase(), color: '#4ea1ff', cursor: { x, y }, ...extra });

// ── 1. the mapping ────────────────────────────────────────────────────────────

test('mapUnitPoint scales through the stage rect and rebases onto the layer', () => {
  // 0.25 of a 400px stage is 100px in, plus the 20px the stage is inset from the layer.
  assert.deepEqual(mapUnitPoint(0.25, 0.5, STAGE, LAYER), { x: 120, y: 110 });
  // The corners are the whole contract: 0 is the stage's own origin, 1 its far edge.
  assert.deepEqual(mapUnitPoint(0, 0, STAGE, LAYER), { x: 20, y: 10 });
  assert.deepEqual(mapUnitPoint(1, 1, STAGE, LAYER), { x: 420, y: 210 });
});

test('the same normalized point lands correctly at two zoom sizes', () => {
  const h = mount();
  h.cursors.setPeers([peer('a', 0.25, 0.5)]);
  assert.equal(h.transformOf(), 'translate3d(120px, 110px, 0)',
    'at 1x: 20px stage offset + a quarter of 400px');

  // Zoom the stage to 2x. Nothing about the peer changed - this is the whole reason
  // section 4.3 puts normalized coordinates on the wire rather than pixels.
  h.setStageWidth(800);
  h.cursors.reanchor();
  assert.equal(h.transformOf(), 'translate3d(220px, 110px, 0)',
    'at 2x the same 0.25 is 200px in, and the vertical axis is untouched');
  h.cursors.dispose();
});

// ── 2. interpolation ──────────────────────────────────────────────────────────

test('cursorPosition walks monotonically between two samples and never past them', () => {
  const prev = { x: 0, y: 0, t: 0 };
  const next = { x: 1, y: 4, t: 100 };

  // The window opens AT the newest sample: a fresh sample starts the glide from the
  // previous position, which is what makes this an interpolator and not a predictor.
  assert.deepEqual(cursorPosition(prev, next, 100), { x: 0, y: 0 });
  assert.deepEqual(cursorPosition(prev, next, 150), { x: 0.5, y: 2 });
  assert.deepEqual(cursorPosition(prev, next, 200), { x: 1, y: 4 });

  let last = -Infinity;
  for (let t = 100; t <= 400; t += 7) {
    const p = cursorPosition(prev, next, t);
    assert.ok(p.x >= last, `x went backwards at t=${t}`);
    assert.ok(p.x <= 1, `x extrapolated past the newest sample at t=${t} (${p.x})`);
    last = p.x;
  }
  assert.deepEqual(cursorPosition(prev, next, 10_000), { x: 1, y: 4 },
    'long after the segment the cursor rests on the newest sample forever');
});

test('a gap longer than the snap window jumps instead of sweeping', () => {
  const prev = { x: 0, y: 0, t: 0 };
  const near = { x: 1, y: 1, t: CURSOR_SNAP_GAP_MS };
  const far = { x: 1, y: 1, t: CURSOR_SNAP_GAP_MS + 1 };
  // At the boundary it is still a movement worth smoothing…
  assert.deepEqual(cursorPosition(prev, near, CURSOR_SNAP_GAP_MS), { x: 0, y: 0 });
  // …one millisecond past it, the peer was ABSENT, and drawing a confident sweep
  // across the room would be inventing a gesture they never made.
  assert.deepEqual(cursorPosition(prev, far, CURSOR_SNAP_GAP_MS + 1), { x: 1, y: 1 });
  // No previous sample at all (a first frame) is the same case.
  assert.deepEqual(cursorPosition(null, far, 0), { x: 1, y: 1 });
});

test('the ticker glides a peer between two samples', () => {
  const h = mount();
  h.cursors.setPeers([peer('a', 0, 0)]);
  h.setNow(100);
  h.cursors.setPeers([peer('a', 1, 0)]);   // a move: prev=(0,0)@0, next=(1,0)@100

  h.setNow(100);
  h.frames.flush();
  assert.equal(h.transformOf(), 'translate3d(20px, 10px, 0)', 'the glide starts at the previous sample');
  h.setNow(150);
  h.frames.flush();
  assert.equal(h.transformOf(), 'translate3d(220px, 10px, 0)', 'halfway is halfway across the stage');
  h.setNow(300);
  h.frames.flush();
  assert.equal(h.transformOf(), 'translate3d(420px, 10px, 0)', 'and it rests on the newest sample');
  h.cursors.dispose();
});

test('a heartbeat restating the same position does not restart the glide', () => {
  const h = mount();
  h.cursors.setPeers([peer('a', 0, 0)]);
  h.setNow(100);
  h.cursors.setPeers([peer('a', 1, 0)]);
  h.setNow(200);
  h.cursors.setPeers([peer('a', 1, 0)]);   // section 4.7's 15 s self-refresh, same coords
  h.setNow(200);
  h.frames.flush();
  assert.equal(h.transformOf(), 'translate3d(420px, 10px, 0)',
    'the cursor stays where it arrived instead of re-walking the segment');
  h.cursors.dispose();
});

// ── 3. the loop's cost ────────────────────────────────────────────────────────

test('pooled nodes keep their identity across roster churn', () => {
  const h = mount();
  h.cursors.setPeers([peer('a', 0.5, 0.5)]);
  const first = h.nodes()[0];
  assert.ok(first, 'a live cursor renders a node');
  assert.equal(h.cursors.stats().pooled, 0);

  h.cursors.setPeers([]);                       // "a" leaves
  assert.equal(h.nodes().length, 0, 'the node leaves the layer');
  assert.equal(h.cursors.stats().pooled, 1, 'and goes on the free list rather than to the GC');

  h.cursors.setPeers([peer('b', 0.5, 0.5)]);    // "b" arrives
  assert.equal(h.nodes()[0], first, 'the new peer reuses the very same node');
  assert.equal(h.cursors.stats().pooled, 0);
  assert.equal(h.nodes()[0]?.querySelector('.collab-cursor-label')?.textContent, 'B',
    'and it is re-labelled, so a pooled node never wears the last tenant\'s name');
  h.cursors.dispose();
});

test('a peer with no cursor - or an away peer - holds no node at all', () => {
  const h = mount();
  h.cursors.setPeers([
    peer('a', 0.5, 0.5),
    { id: 'b', name: 'B', color: '#f00' },                              // no cursor lane
    peer('c', 0.5, 0.5, { away: true }),                                // hidden tab (section 11.4)
    { id: 'd', name: 'D', color: '#f00', cursor: { x: Number.NaN, y: 0 } },
  ]);
  assert.equal(h.cursors.stats().active, 1, 'only the one peer with a real cursor is live');
  h.cursors.dispose();
});

test('the ticker runs only while somebody is MOVING - a parked pointer and an empty roster both stand it down', () => {
  const h = mount();
  assert.equal(h.frames.pending(), 0, 'nothing is scheduled before anyone arrives');

  // An ARRIVAL is not a movement. There is no previous sample to walk from, so the
  // node is placed once and there is nothing left to animate - a live roster is not
  // by itself a reason to hold a frame loop open (section 11.14, and this module's own
  // "the ticker is not a heartbeat").
  h.cursors.setPeers([peer('a', 0.5, 0.5)]);
  assert.equal(h.frames.pending(), 0, 'a peer who has only ever been at one point costs no loop');
  assert.equal(h.transformOf(), 'translate3d(220px, 110px, 0)', 'and is painted where they are');

  // A MOVE opens a segment, and the loop runs exactly as long as walking it takes.
  h.setNow(100);
  h.cursors.setPeers([peer('a', 1, 0.5)]);
  assert.equal(h.frames.pending(), 1, 'a segment to walk is what arms the loop');
  h.setNow(150);
  h.frames.flush();
  assert.equal(h.frames.pending(), 1, 'and it re-arms while that segment is only half walked');

  // Past the end of the segment the interpolator rests on the newest sample forever,
  // so every further frame would paint the identical transform after two forced
  // layouts. It stands down instead - but only AFTER painting the resting position.
  h.setNow(400);
  h.frames.flush();
  assert.equal(h.frames.pending(), 0, 'a parked pointer stands the loop down');
  assert.equal(h.cursors.stats().ticking, false);
  assert.equal(h.transformOf(), 'translate3d(420px, 110px, 0)',
    'having painted the rest position on the way out, not stopped one frame short of it');

  // A parked cursor still follows the stage: a zoom re-anchors through reanchor()
  // with no ticker involved at all.
  h.setStageWidth(800);
  h.cursors.reanchor();
  assert.equal(h.transformOf(), 'translate3d(820px, 110px, 0)', 'a stopped loop is not a frozen cursor');
  assert.equal(h.frames.pending(), 0, 'and re-anchoring does not restart it');

  // …and an empty roster stops it mid-segment, from wherever it was.
  h.setNow(500);
  h.cursors.setPeers([peer('a', 0, 0.5)]);
  assert.equal(h.frames.pending(), 1, 'moving again re-arms');
  h.cursors.setPeers([]);
  assert.equal(h.frames.pending(), 0, 'and stands down the moment the roster empties');
  assert.equal(h.cursors.stats().ticking, false);
  h.cursors.dispose();
});

test('reduced motion draws static dots and starts no ticker at all', () => {
  const h = mount({ still: true });
  h.cursors.setPeers([peer('a', 0.25, 0.5)]);
  assert.equal(h.frames.pending(), 0, 'no frame loop is started (section 4.8)');
  assert.equal(h.transformOf(), 'translate3d(120px, 110px, 0)',
    'the position is still painted - a calmer app is not a blind one');
  const node = h.nodes()[0]!;
  assert.ok(node.classList.contains('collab-cursor--still'),
    'and the node switches to the dot presentation instead of the arrow');
  const arrow = node.querySelector<HTMLElement>('.collab-cursor-arrow')!;
  assert.equal(arrow.style.clipPath, 'none', 'the arrow silhouette is dropped…');
  assert.equal(arrow.style.borderRadius, '50%', '…and the same painted box becomes a dot');
  assert.equal(node.style.transition, 'none', 'nothing tweens between samples either');
  h.cursors.dispose();
});

test('a borrowed layer is painted into but never unmounted', () => {
  // The arrangement collab.css's internal z-order assumes: ONE .collab-canvas-layer
  // holding both the focus boxes and the cursors. Whoever mounted it owns it.
  const host = document.getElementById('host') as HTMLElement;
  const stage = document.getElementById('stage') as HTMLElement;
  const h = mount();                       // resets #host, so the shared layer goes in after
  const shared = document.createElement('div');
  shared.className = 'collab-canvas-layer';
  host.appendChild(shared);

  const cursors = createCollabCursors({
    stage,
    layer: shared,
    now: () => 0,
    raf: h.frames.raf,
    cancelRaf: h.frames.cancelRaf,
    reducedMotion: () => false,
    measureStage: () => STAGE,
    measureLayer: () => LAYER,
  });
  cursors.setPeers([peer('a', 0.25, 0.5)]);
  assert.equal(shared.querySelectorAll('.collab-cursor').length, 1, 'it paints into the shared layer');

  cursors.dispose();
  assert.equal(shared.isConnected, true, 'and leaves the lender\'s layer standing');
  assert.equal(shared.querySelectorAll('.collab-cursor').length, 0, 'having taken only its own nodes');
  h.cursors.dispose();
  shared.remove();
});

test('dispose leaves no rAF pending and releases the pool', () => {
  const h = mount();
  h.cursors.setPeers([peer('a', 0.5, 0.5), peer('b', 0.1, 0.1)]);
  // A second sample apiece, so the ticker is genuinely mid-segment when the view is
  // torn down - disposing a loop that had already stood itself down would prove
  // nothing about the leak this test exists for.
  h.setNow(100);
  h.cursors.setPeers([peer('a', 0.6, 0.5), peer('b', 0.2, 0.1)]);
  assert.equal(h.frames.pending(), 1);

  h.cursors.dispose();
  assert.equal(h.frames.pending(), 0, 'a torn-down tool view must not leave a loop running');
  assert.equal(h.cursors.el, null, 'the layer is unmounted');
  assert.equal(document.querySelectorAll('.collab-cursor').length, 0, 'and no node is left behind');

  h.cursors.dispose();                       // idempotent
  h.cursors.setPeers([peer('c', 0.5, 0.5)]); // inert after disposal
  assert.equal(h.frames.pending(), 0);
});

// ── the section 4.6 invariant ────────────────────────────────────────────────────────

test('the layer mounts OUTSIDE the render surface, however it is asked', () => {
  const host = document.getElementById('host') as HTMLElement;
  const stage = document.getElementById('stage') as HTMLElement;
  const inside = document.createElement('div');
  stage.appendChild(inside);

  // A caller passing the stage itself, or a node within it, is the easy mistake:
  // #tool-canvas is what everything else in the tool view is measured from. Presence
  // chrome inside it would show up as a diff in an exported PNG, not as an error.
  for (const asked of [stage, inside]) {
    const layer = mountOverlayLayer(stage, asked, 'collab-canvas-layer', document);
    assert.ok(layer, 'a stage with a parent always gets a layer');
    assert.equal(layer.el.parentElement, host, 'walked out to the first node outside the stage');
    assert.equal(stage.contains(layer.el), false);
    layer.unmount();
  }
  assert.equal(stage.innerHTML, '<div></div>', 'and the stage itself is untouched throughout');

  const orphan = document.createElement('div');
  assert.equal(mountOverlayLayer(orphan, null, 'x', document), null,
    'a stage with nowhere outside it to mount gets NO overlay, rather than one in the wrong place');
  stage.innerHTML = '';
});

test('the mounted layer never eats a pointer event', () => {
  const host = document.getElementById('host') as HTMLElement;
  const stage = document.getElementById('stage') as HTMLElement;
  const layer = mountOverlayLayer(stage, host, 'collab-canvas-layer', document)!;
  assert.equal(layer.el.style.pointerEvents, 'none',
    'the contract is inline, not in a stylesheet whose failure to load would turn the '
    + 'overlay into a full-page click shield');
  assert.equal(layer.el.getAttribute('aria-hidden'), 'true', 'and it is invisible to AT');
  layer.unmount();
});

// ── the sheet ─────────────────────────────────────────────────────────────────

/** Every class the module actually WRITES onto a node, read back off the DOM it
 *  produced rather than from a list a refactor would forget to update. */
function classesUnder(root: HTMLElement): Set<string> {
  const out = new Set<string>(root.classList);
  for (const el of root.querySelectorAll('*')) {
    for (const c of el.classList) out.add(c);
  }
  return out;
}

test('the module injects its own sheet, and every class it writes is defined there', () => {
  const h = mount();
  h.cursors.setPeers([peer('a', 0.5, 0.5)]);

  const sheet = document.getElementById('lolly-collab-overlay-css');
  assert.ok(sheet, 'the component carries its own <style>, like collab-pill.ts - nothing '
    + 'in styles/parts/ defines these names, and an unlayered injected sheet is the only '
    + 'thing that could win over the @layer-imported parts anyway');
  const css = sheet.textContent ?? '';

  // The regression this pins: `.collab-cursor` and friends once existed only as
  // strings in this file. A default `display:block; position:static` div paints no
  // arrow and no colour, but DOES paint its label's textContent - so the visible
  // result was raw peer names stacked in normal flow over the stage, each inline
  // translate3d offsetting from the wrong origin.
  const written = classesUnder(h.cursors.el as HTMLElement);
  assert.ok(written.has('collab-cursor'), 'the fixture actually produced a cursor node');
  for (const name of written) {
    assert.ok(css.includes(`.${name}`), `.${name} is written onto a node but never styled`);
  }
  // The still modifier is only worn under reduced motion, so it is not in `written`.
  assert.ok(css.includes('.collab-cursor--still'), 'and the reduced-motion dot is sized too');

  // Position must be absolute or every cursor stacks in normal flow and each
  // translate3d offsets from its neighbour's height instead of from the layer.
  assert.match(css, /\.collab-cursor \{[^}]*position: absolute/);
  // section 4.8: chrome type and icon boxes ride the largeText multiplier.
  assert.ok(!/font-size: \d/.test(css), 'every font-size is a --a11y-fs multiple');

  h.cursors.dispose();
});

test('a canvas zoom re-anchors a parked cursor, though it fires no event of its own', async () => {
  const h = mount();
  const stage = document.getElementById('stage') as HTMLElement;
  h.cursors.setPeers([peer('a', 0.5, 0.5)]);
  assert.equal(h.transformOf(), 'translate3d(220px, 110px, 0)');
  assert.equal(h.frames.pending(), 0, 'parked: no ticker is re-measuring anything');

  // What views/tool-stage-nav.ts actually does - a transform on an ancestor, and no
  // event at all. No scroll offset moves, no window resizes, and the border box is
  // unchanged, so neither a scroll listener nor a ResizeObserver would ever hear it.
  h.setStageWidth(800);
  stage.style.transform = 'translate(10px, 0px) scale(2)';
  await new Promise(r => setTimeout(r, 0));

  assert.equal(h.transformOf(), 'translate3d(420px, 110px, 0)',
    'the cursor followed the zoom instead of being stranded at its pre-zoom point');
  assert.equal(h.frames.pending(), 0, 're-anchoring is a synchronous repaint, not a new frame loop');

  h.cursors.dispose();
  stage.style.transform = '';
  await new Promise(r => setTimeout(r, 0));
  assert.equal(h.transformOf(), '', 'and a disposed layer hears nothing further');
});
