// SPDX-License-Identifier: MPL-2.0
/**
 * The static-chrome fast path's decision helpers (bridge/frame-static.ts).
 *
 * A wrong "yes" here is invisible downstream: the encoder happily writes 240
 * frames of frozen text, or of a caption erased by the canvas blit, and no
 * assertion anywhere else in the export pipeline would notice. So the two
 * predicates that gate it are pure and tested directly, with the fixtures taken
 * from the real tool shapes they have to separate:
 *
 *   take it - audiogram (bottom/center/minimal), url-shot, 3d, booth-studio
 *   refuse it - audiogram layout=overlay (caption over a full-bleed canvas),
 *               slides / deck-builder (CSS keyframes off an inert clock),
 *               filter-* (the clock rewrites an SVG overlay → DOM mutations)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boxesOverlap, chromePaintsOverLive, countToolMutations, createStaticChromeGuard,
  isOwnVisibilitySwap, staticChromeFrameAction, staticChromeVerdict,
  STATIC_CHROME_INVALIDATION_CEILING, type Box, type ChromeEl, type MutationLike,
} from './frame-static.ts';

const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height });
const el = (b: Box, paints = true, relatedToLive = false): ChromeEl => ({ box: b, paints, relatedToLive });

test('boxesOverlap: abutting boxes do not overlap', () => {
  // The audiogram's bottom layout: caption stacked directly under the wavebox.
  assert.equal(boxesOverlap(box(0, 0, 100, 60), box(0, 60, 100, 40)), false);
  assert.equal(boxesOverlap(box(0, 0, 100, 60), box(0, 59, 100, 40)), true);
});

test('boxesOverlap: zero-area boxes never overlap', () => {
  assert.equal(boxesOverlap(box(0, 0, 100, 100), box(10, 10, 0, 0)), false);
  assert.equal(boxesOverlap(box(0, 0, 0, 100), box(0, 0, 100, 100)), false);
});

test('boxesOverlap: containment counts, and is symmetric', () => {
  const outer = box(0, 0, 100, 100), inner = box(20, 20, 10, 10);
  assert.equal(boxesOverlap(outer, inner), true);
  assert.equal(boxesOverlap(inner, outer), true);
});

test('chromePaintsOverLive: stacked chrome is clear (audiogram layout=bottom)', () => {
  const wave = box(0, 0, 1080, 700);
  assert.equal(chromePaintsOverLive([wave], [
    el(box(0, 700, 1080, 200)),   // .ag-meta
    el(box(0, 900, 1080, 180)),   // .ag-credit
  ]), false);
});

test('chromePaintsOverLive: a caption over a full-bleed canvas is refused (audiogram layout=overlay)', () => {
  const wave = box(0, 0, 1080, 1080);   // .ag-wavebox { position:absolute; inset:0 }
  assert.equal(chromePaintsOverLive([wave], [el(box(76, 800, 928, 160))]), true);
});

test('chromePaintsOverLive: non-painting chrome over the canvas is fine (url-shot hover buttons)', () => {
  const shot = box(0, 0, 1200, 630);
  // .shot-refresh / .shot-compose sit on top of the canvas at opacity:0.
  assert.equal(chromePaintsOverLive([shot], [
    el(box(1140, 12, 44, 44), false),
    el(box(1090, 12, 44, 44), false),
  ]), false);
});

test('chromePaintsOverLive: ancestors are exempt - their background paints below the canvas', () => {
  const shot = box(0, 0, 1200, 630);
  assert.equal(chromePaintsOverLive([shot], [
    el(box(0, 0, 1200, 630), true, true),   // .url-shot wrapper
  ]), false);
});

test('chromePaintsOverLive: an EARLIER sibling still counts - z-index can lift it above', () => {
  // Document order is not paint order, so the guard has to consider every
  // painting element, not just the ones following the canvas.
  const wave = box(0, 0, 500, 500);
  assert.equal(chromePaintsOverLive([wave], [el(box(100, 100, 50, 50))]), true);
});

test('chromePaintsOverLive: every live canvas is checked, not just the first', () => {
  const a = box(0, 0, 100, 100), b = box(0, 200, 100, 100);
  assert.equal(chromePaintsOverLive([a, b], [el(box(10, 210, 20, 20))]), true);
});

const ok = {
  externalScreenshot: false, liveCanvases: 1, mutationRecords: 0, animations: 0, chromeOverlaps: false,
};

test('staticChromeVerdict: the measured audiogram case takes the fast path', () => {
  assert.equal(staticChromeVerdict(ok).ok, true);
});

test('staticChromeVerdict: the Tier-B screenshot path never takes it', () => {
  // Chromium paints the live node in one genuine shot there - nothing to cache.
  const v = staticChromeVerdict({ ...ok, externalScreenshot: true });
  assert.equal(v.ok, false);
  assert.match(v.reason, /screenshot/);
});

test('staticChromeVerdict: no visible canvas means no blit and no win (digi-ad, pose-geeko)', () => {
  assert.equal(staticChromeVerdict({ ...ok, liveCanvases: 0 }).ok, false);
});

test('staticChromeVerdict: CSS animations refuse it (slides, deck-builder)', () => {
  const v = staticChromeVerdict({ ...ok, animations: 12 });
  assert.equal(v.ok, false);
  assert.match(v.reason, /animation/);
});

test('staticChromeVerdict: any DOM mutation per frame refuses it (filter-* overlay)', () => {
  const v = staticChromeVerdict({ ...ok, mutationRecords: 1 });
  assert.equal(v.ok, false);
  assert.match(v.reason, /mutation/);
});

test('staticChromeVerdict: chrome over the canvas refuses it (audiogram layout=overlay)', () => {
  const v = staticChromeVerdict({ ...ok, chromeOverlaps: true });
  assert.equal(v.ok, false);
  assert.match(v.reason, /paints over/);
});

test('staticChromeVerdict: a failing check always names itself', () => {
  for (const bad of [
    { ...ok, externalScreenshot: true }, { ...ok, liveCanvases: 0 },
    { ...ok, animations: 1 }, { ...ok, mutationRecords: 3 }, { ...ok, chromeOverlaps: true },
  ]) {
    const v = staticChromeVerdict(bad);
    assert.equal(v.ok, false);
    assert.ok(v.reason.length > 0);
  }
});

// ── Staying honest after the yes ─────────────────────────────────────────────
// The probe can only sample, and for a clockless tool (booth-studio) it samples a
// settle wait plus one capture. These cover the continuous check that stops a
// ~500 ms setInterval from being frozen into the cached chrome for a whole clip.

const canvasA = { tag: 'canvas-a' }, canvasB = { tag: 'canvas-b' };
const ours = new Set<unknown>([canvasA, canvasB]);
const rec = (r: Partial<MutationLike>): MutationLike => ({ type: 'attributes', attributeName: 'style', target: canvasA, ...r });

test('isOwnVisibilitySwap: the chrome shot hiding and unhiding our canvases is not a tool mutation', () => {
  assert.equal(isOwnVisibilitySwap(rec({ target: canvasA }), ours), true);
  assert.equal(isOwnVisibilitySwap(rec({ target: canvasB }), ours), true);
});

test('isOwnVisibilitySwap: only the style attribute, only on canvases we touched', () => {
  // A tool resizing its own canvas, restyling something else, or rewriting text all
  // genuinely invalidate the cached layer.
  assert.equal(isOwnVisibilitySwap(rec({ attributeName: 'width' }), ours), false);
  assert.equal(isOwnVisibilitySwap(rec({ attributeName: 'class' }), ours), false);
  assert.equal(isOwnVisibilitySwap(rec({ target: { tag: 'caption' } }), ours), false);
  assert.equal(isOwnVisibilitySwap(rec({ type: 'childList', attributeName: null }), ours), false);
  assert.equal(isOwnVisibilitySwap(rec({ type: 'characterData', attributeName: null }), ours), false);
});

test('countToolMutations: our own swap pair drains to zero, a tool write survives it', () => {
  const swapPair = [rec({}), rec({})];                       // hide, then unhide
  assert.equal(countToolMutations(swapPair, ours), 0);
  assert.equal(countToolMutations([...swapPair, rec({ type: 'characterData', attributeName: null, target: { tag: 'clock-text' } })], ours), 1);
  // With no set of our own targets nothing is exempt - the probe's pre-shot drain.
  assert.equal(countToolMutations(swapPair, new Set()), 2);
});

test('staticChromeFrameAction: a quiet frame reuses the cached chrome', () => {
  const g = createStaticChromeGuard();
  assert.equal(staticChromeFrameAction(g, 0), 'reuse');
  assert.equal(staticChromeFrameAction(g, 0), 'reuse');
  assert.equal(g.invalidations, 0);
  assert.equal(g.stoodDown, false);
});

test('staticChromeFrameAction: a late mutation re-rasterises rather than freezing (booth-studio setInterval)', () => {
  const g = createStaticChromeGuard();
  assert.equal(staticChromeFrameAction(g, 1), 'refresh');
  assert.equal(g.invalidations, 1);
  // …and the fast path continues afterwards, which is the whole point of refreshing
  // instead of falling back on the first stray write.
  assert.equal(staticChromeFrameAction(g, 0), 'reuse');
});

test('staticChromeFrameAction: repeated invalidation stands down instead of thrashing', () => {
  const g = createStaticChromeGuard(3);
  assert.equal(staticChromeFrameAction(g, 2), 'refresh');
  assert.equal(staticChromeFrameAction(g, 1), 'refresh');
  assert.equal(staticChromeFrameAction(g, 1), 'stand-down');
  assert.equal(g.stoodDown, true);
});

test('staticChromeFrameAction: standing down is permanent, even on quiet frames', () => {
  const g = createStaticChromeGuard(1);
  assert.equal(staticChromeFrameAction(g, 1), 'stand-down');
  for (let i = 0; i < 5; i++) assert.equal(staticChromeFrameAction(g, 0), 'stand-down');
  assert.equal(g.invalidations, 1);   // the ceiling is not re-counted once stood down
});

test('staticChromeFrameAction: the default ceiling is small enough that refreshing never costs more than the slow path', () => {
  const g = createStaticChromeGuard();
  let refreshes = 0;
  for (let i = 0; i < 50; i++) if (staticChromeFrameAction(g, 1) === 'refresh') refreshes++;
  assert.equal(refreshes, STATIC_CHROME_INVALIDATION_CEILING - 1);
  assert.equal(g.stoodDown, true);
});

test('staticChromeFrameAction: a negative or absent count is treated as quiet, not as a mutation', () => {
  // The caller passes 0 when the host has no MutationObserver at all; that host also
  // never got past the probe, so this must not burn an invalidation.
  const g = createStaticChromeGuard();
  assert.equal(staticChromeFrameAction(g, -1), 'reuse');
  assert.equal(g.invalidations, 0);
});
