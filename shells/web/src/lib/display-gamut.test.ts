// SPDX-License-Identifier: MPL-2.0
/**
 * display-gamut.test.ts - the display detection and the tab it seeds.
 * Run: node --test shells/web/src/lib/display-gamut.test.ts
 *
 * No jsdom needed: the module is DOM-touching but tiny about it, so a stubbed
 * `matchMedia` (the pattern view-fade.test.ts uses) and a hand-written fake canvas
 * cover every decision. What is pinned here is the DECISIONS - which claim wins,
 * which encode space is asked for, and which one is used when the surface refuses.
 * The pixels are verified in Chrome.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayGamutClaim, displayAnchor, displayAnchorGamut, noteEncodeDowngrade,
  onDisplayGamutChange, acquire2d, resetDisplayGamut,
  displayDynamicRange, displaySupportsHdr,
} from './display-gamut.ts';
import { inGamut } from '@lolly/engine';

/** A controllable `(color-gamut: …)` stub. `claim` is what the display covers;
 *  every keyword at or below it matches, the way a real display reports. */
type Stub = { setClaim(c: 'srgb' | 'p3' | 'rec2020' | 'none'): void; fire(): void };
const COVERS: Record<string, readonly string[]> = {
  srgb: ['srgb'],
  p3: ['srgb', 'p3'],
  rec2020: ['srgb', 'p3', 'rec2020'],
  none: [],
};

function installMatchMedia(initial: 'srgb' | 'p3' | 'rec2020' | 'none'): Stub {
  let claim = initial;
  const handlers = new Set<() => void>();
  (globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
    get matches(): boolean {
      const m = /\(color-gamut:\s*(\w+)\)/.exec(q);
      return m ? (COVERS[claim] as string[]).includes(m[1] as string) : false;
    },
    media: q,
    addEventListener(_t: string, fn: () => void) { handlers.add(fn); },
    removeEventListener(_t: string, fn: () => void) { handlers.delete(fn); },
    onchange: null,
    dispatchEvent: () => false,
  });
  resetDisplayGamut();
  return {
    setClaim(c) { claim = c; },
    fire() { for (const fn of [...handlers]) fn(); },
  };
}

function noMatchMedia(): void {
  delete (globalThis as { matchMedia?: unknown }).matchMedia;
  resetDisplayGamut();
}

test('the claim is the widest keyword that matches', () => {
  for (const c of ['srgb', 'p3', 'rec2020'] as const) {
    installMatchMedia(c);
    assert.equal(displayGamutClaim(), c);
  }
  // A display matching nothing at all, and a host with no matchMedia, are both
  // "we do not know" - never a guess.
  installMatchMedia('none');
  assert.equal(displayGamutClaim(), 'unknown');
  noMatchMedia();
  assert.equal(displayGamutClaim(), 'unknown');
});

test('the anchor is only ever srgb or display-p3 - a rec2020 claim CLAMPS', () => {
  installMatchMedia('srgb');
  assert.equal(displayAnchor(), 'srgb');
  installMatchMedia('p3');
  assert.equal(displayAnchor(), 'display-p3');
  installMatchMedia('rec2020');
  // The decisive point: a canvas 2D context accepts no third value, so anchoring to
  // rec2020 would promise pixels nothing in this app can produce.
  assert.equal(displayAnchor(), 'display-p3');
  assert.equal(displayAnchorGamut(), 'p3');
  noMatchMedia();
  assert.equal(displayAnchor(), 'srgb', 'unknown is the safe side, not the wide side');
  assert.equal(displayAnchorGamut(), 'srgb');
});

test('a downgrade latches one-way and notifies exactly once', () => {
  installMatchMedia('p3');
  let hits = 0;
  const off = onDisplayGamutChange(() => { hits++; });
  assert.equal(displayAnchor(), 'display-p3');

  noteEncodeDowngrade('display-p3');   // not a downgrade - ignored
  assert.equal(hits, 0);
  assert.equal(displayAnchor(), 'display-p3');

  noteEncodeDowngrade('srgb');
  assert.equal(hits, 1);
  assert.equal(displayAnchor(), 'srgb', 'the surface refused, so stop asking');
  noteEncodeDowngrade('srgb');
  assert.equal(hits, 1, 'latched: no repeat notification, no flapping');
  assert.equal(displayAnchor(), 'srgb');

  off();
  noteEncodeDowngrade('srgb');
  assert.equal(hits, 1, 'the teardown really unsubscribes');
});

test('a display change invalidates the claim, unlatches, and notifies', () => {
  const mq = installMatchMedia('p3');
  let hits = 0;
  onDisplayGamutChange(() => { hits++; });
  assert.equal(displayAnchor(), 'display-p3');
  noteEncodeDowngrade('srgb');
  assert.equal(displayAnchor(), 'srgb');
  assert.equal(hits, 1);

  mq.setClaim('srgb');
  mq.fire();
  assert.equal(hits, 2);
  assert.equal(displayGamutClaim(), 'srgb', 'the cached claim is dropped on a change');
  assert.equal(displayAnchor(), 'srgb');

  // A different monitor is a different surface: the previous refusal says nothing
  // about it, so the latch clears and the wide option is asked for again.
  mq.setClaim('p3');
  mq.fire();
  assert.equal(displayAnchor(), 'display-p3');
});

// ── acquire2d ────────────────────────────────────────────────────────────────

/** A canvas whose context grants `granted` however it is asked. */
function fakeCanvas(granted: string | null, opts: { attrs?: boolean } = {}):
{ canvas: HTMLCanvasElement; asked: unknown[] } {
  const asked: unknown[] = [];
  const ctx = {
    getContextAttributes: opts.attrs === false ? undefined : () => ({ colorSpace: granted }),
  };
  const canvas = {
    getContext(_id: string, o?: unknown) { asked.push(o); return granted == null ? null : ctx; },
  } as unknown as HTMLCanvasElement;
  return { canvas, asked };
}

test('acquire2d asks for the display space and reports the space granted', () => {
  installMatchMedia('p3');
  const p3 = fakeCanvas('display-p3');
  const got = acquire2d(p3.canvas);
  assert.deepEqual(p3.asked, [{ colorSpace: 'display-p3' }]);
  assert.equal(got?.encode, 'display-p3');
  assert.equal(displayAnchor(), 'display-p3', 'a granted request does not latch anything');
});

test('acquire2d collapses to srgb - and latches - when the option is ignored', () => {
  installMatchMedia('p3');
  const ignored = fakeCanvas('srgb');
  assert.equal(acquire2d(ignored.canvas)?.encode, 'srgb');
  assert.equal(displayAnchor(), 'srgb', 'the whole shell now agrees on srgb');

  // No accessor at all: assume srgb, the safe side. An engine without the accessor
  // almost certainly lacks the option too.
  installMatchMedia('p3');
  const old = fakeCanvas('display-p3', { attrs: false });
  assert.equal(acquire2d(old.canvas)?.encode, 'srgb');

  // No context (jsdom, a zero-size or lost surface): nothing to paint into.
  installMatchMedia('p3');
  assert.equal(acquire2d(fakeCanvas(null).canvas), null);
});

/**
 * A canvas that lives in a "document": enough of the node API for the swap - a
 * parent to be replaced under, a shallow clone, and a granted space per node.
 */
function fakeMounted(granted: () => string): { canvas: HTMLCanvasElement; nodes: unknown[]; asked: unknown[] } {
  const asked: unknown[] = [];
  const nodes: unknown[] = [];
  const make = (): HTMLCanvasElement => {
    const node = {
      parentNode: { replaced: 0 },
      getContext(_id: string, o?: unknown) {
        asked.push(o);
        return { getContextAttributes: () => ({ colorSpace: granted() }) };
      },
      cloneNode() { const n = make(); nodes.push(n); return n; },
      replaceWith() { (node as { parentNode: unknown }).parentNode = null; },
    };
    return node as unknown as HTMLCanvasElement;
  };
  const canvas = make();
  nodes.push(canvas);
  return { canvas, nodes, asked };
}

test('acquire2d re-acquires the surface when the display changes under it', () => {
  const mq = installMatchMedia('p3');
  let space = 'display-p3';
  const c = fakeMounted(() => space);
  assert.equal(acquire2d(c.canvas)?.encode, 'display-p3');

  // The window moves to an sRGB monitor. A 2D context keeps the colour space it was
  // created with and a second getContext ignores the options bag entirely, so the ONLY
  // way to honour the move is a new surface - otherwise the fill stays P3-encoded for
  // the session while the contour marked "your display" narrows.
  mq.setClaim('srgb');
  mq.fire();
  space = 'srgb';
  const again = acquire2d(c.canvas);
  assert.equal(again?.encode, 'srgb');
  assert.notEqual(again?.canvas, c.canvas, 'a fresh node, so the caller must use the returned one');
  assert.equal(c.canvas.parentNode, null, 'and the old one is out of the document');
  assert.deepEqual(c.asked, [{ colorSpace: 'display-p3' }, { colorSpace: 'srgb' }]);
});

test('a retained context reporting the old space is not read as a refusal', () => {
  const mq = installMatchMedia('srgb');
  let space = 'srgb';
  const c = fakeMounted(() => space);
  assert.equal(acquire2d(c.canvas)?.encode, 'srgb');

  // sRGB monitor → P3 monitor. Treating the retained context's 'srgb' as "the platform
  // refuses display-p3" would latch the downgrade and chart a P3 screen in sRGB for
  // the rest of the session.
  mq.setClaim('p3');
  mq.fire();
  space = 'display-p3';
  assert.equal(acquire2d(c.canvas)?.encode, 'display-p3');
  assert.equal(displayAnchor(), 'display-p3', 'no false latch');
});

// ── the tab the Lab opens on ─────────────────────────────────────────────────

const SRGB_SUBJECT = { l: 0.62, c: 0.19, h: 260 };
/**
 * Display-P3's red primary - outside sRGB, inside P3.
 *
 * At FULL precision: `describeColor('color(display-p3 1 0 0)').oklch`. Rounded to
 * 4dp it tests as outside P3 as well (it is a corner of the cube), which would make
 * the widening assertions below pass for the wrong reason.
 */
const P3_RED = { l: 0.6485740719414326, c: 0.29948528899928223, h: 28.958137085704436 };
const BEYOND = { l: 0.6, c: 0.62, h: 30 };

test('the subject fixtures are what the widening test needs them to be', () => {
  // Guards the test itself: if these memberships ever stop holding, the widening
  // assertions below would pass vacuously.
  assert.ok(inGamut(SRGB_SUBJECT.l, SRGB_SUBJECT.c, SRGB_SUBJECT.h, 'srgb'));
  assert.ok(!inGamut(P3_RED.l, P3_RED.c, P3_RED.h, 'srgb'), 'P3 red is outside sRGB');
  assert.ok(inGamut(P3_RED.l, P3_RED.c, P3_RED.h, 'p3'), 'P3 red is inside P3');
  for (const g of ['srgb', 'p3', 'rec2020'] as const) {
    assert.ok(!inGamut(BEYOND.l, BEYOND.c, BEYOND.h, g), `${g} cannot hold the beyond fixture`);
  }
});

// ── dynamic range (HDR headroom) ─────────────────────────────────────────────

/** A controllable `(dynamic-range: …)` stub. 'high' also matches 'standard'
 *  (high is a superset), the way a real HDR display reports. */
function installDynamicRange(initial: 'high' | 'standard' | 'none'): { set(c: 'high' | 'standard' | 'none'): void; fire(): void } {
  let range = initial;
  const handlers = new Set<() => void>();
  const covers: Record<string, readonly string[]> = { high: ['high', 'standard'], standard: ['standard'], none: [] };
  (globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
    get matches(): boolean {
      const m = /\(dynamic-range:\s*(\w+)\)/.exec(q);
      return m ? (covers[range] as string[]).includes(m[1] as string) : false;
    },
    media: q,
    addEventListener(_t: string, fn: () => void) { handlers.add(fn); },
    removeEventListener(_t: string, fn: () => void) { handlers.delete(fn); },
    onchange: null,
    dispatchEvent: () => false,
  });
  resetDisplayGamut();
  return { set(c) { range = c; }, fire() { for (const fn of [...handlers]) fn(); } };
}

test('dynamic range: high on an HDR panel, standard otherwise, unknown with no matchMedia', () => {
  const s = installDynamicRange('high');
  assert.equal(displayDynamicRange(), 'high');
  assert.equal(displaySupportsHdr(), true);
  s.set('standard'); s.fire(); // a monitor swap invalidates the cache + notifies
  assert.equal(displayDynamicRange(), 'standard');
  assert.equal(displaySupportsHdr(), false, 'standard is not headroom');
  noMatchMedia();
  assert.equal(displayDynamicRange(), 'unknown', 'no matchMedia is unknown, not a claim');
  assert.equal(displaySupportsHdr(), false);
});

test('dynamic range detection IGNORES video-dynamic-range (the Safari-unreliable query)', () => {
  // The trap found on the iPad Pro: (video-dynamic-range: high) can be false while
  // (dynamic-range: high) is true. A stub that answers ONLY the video query must
  // therefore read as unknown - we never key off it.
  (globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
    get matches(): boolean { return /\(video-dynamic-range:\s*high\)/.test(q); },
    media: q, addEventListener() {}, removeEventListener() {}, onchange: null, dispatchEvent: () => false,
  });
  resetDisplayGamut();
  assert.equal(displayDynamicRange(), 'unknown');
  assert.equal(displaySupportsHdr(), false);
  noMatchMedia();
});

test('a dynamic-range change notifies onDisplayGamutChange subscribers', () => {
  const s = installDynamicRange('standard');
  let hits = 0;
  const off = onDisplayGamutChange(() => { hits++; });
  s.set('high'); s.fire();
  assert.equal(hits, 1, 'a monitor going HDR notifies the same subscribers as a gamut change');
  assert.equal(displayDynamicRange(), 'high', 'the cache refreshed after the change');
  off();
});
