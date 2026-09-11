// SPDX-License-Identifier: MPL-2.0
/**
 * Where the editor's contextual bar lands - the pure geometry of `ctxTopBand` +
 * `centreCtxBar`, plus the CSS contracts the placement leans on.
 *
 * The bar used to float ABOVE (or inside) the selection, which put it right over the very
 * artwork being dragged or resized. It is pinned to the TOP chrome row now - on the line
 * with the back pill (top-left) and the zoom HUD (top-right) - centred in the band between
 * them so all three read as one row and none can overlap another. On a narrow phone the
 * bar is capped to that band and scrolls its controls into reach (see the `.fc-ctxbar`
 * overflow) rather than dropping down over the canvas. Every assertion below is one half
 * of that contract: the band never runs into the chrome, and a too-wide bar pins to the
 * band's left edge instead of pushing past it.
 *
 * Not covered here, because jsdom has no layout: the entrance animation, the frozen
 * placement during a drag, the measured blocker rects (`ctxBarBlockers` reads real
 * getBoundingClientRects), and the actual scroll. Verified by hand in a browser.
 *
 * Run directly:  node --test shells/web/src/views/free-canvas-ctxbar.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ctxTopBand, centreCtxBar, stageBlockers } from './free-canvas.ts';

const STAGE = { w: 1000, h: 700 };
// The two pieces of fixed chrome, in stage coordinates: the back pill top-left (← Home)
// and the zoom HUD top-right (− 48% + Fit ☀ 🔇).
const HOME = { left: 10, top: 10, right: 120, bottom: 48 };
const HUD = { left: 700, top: 10, right: 990, bottom: 48 };

/** Do these two boxes touch at all? The bar keeps a gap, so plain overlap is the floor. */
const overlaps = (a: { left: number; right: number; top: number; bottom: number },
                  b: { left: number; right: number; top: number; bottom: number }): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
/** The bar as it actually paints: `max-width` caps it to the band, so a too-wide bar shows
 *  band-width and scrolls the rest - its painted right edge is never past `hi`. */
const paintedBox = (bw: number, band: { lo: number; hi: number; top: number }, h = 40) => {
  const pos = centreCtxBar(bw, band);
  return { left: pos.left, right: pos.left + Math.min(bw, band.hi - band.lo), top: pos.top, bottom: pos.top + h };
};

// ══ the band ══════════════════════════════════════════════════════════════════

test('the band runs between the back pill and the zoom HUD, on their line', () => {
  const band = ctxTopBand(STAGE, [HOME, HUD]);
  assert.equal(band.lo, HOME.right + 8, 'starts one gap right of the back pill');
  assert.equal(band.hi, HUD.left - 8, 'ends one gap left of the zoom HUD');
  assert.equal(band.top, 10, 'aligned to the chrome row, not the stage edge');
});

test('with no chrome the band spans the whole padded top', () => {
  assert.deepEqual(ctxTopBand(STAGE, []), { lo: 6, hi: 994, top: 6 });
});

test('only the zoom HUD present bounds the right and leaves the left at the pad', () => {
  const band = ctxTopBand(STAGE, [HUD]);
  assert.equal(band.lo, 6);
  assert.equal(band.hi, HUD.left - 8);
});

test('only the back pill present bounds the left and leaves the right at the pad', () => {
  const band = ctxTopBand(STAGE, [HOME]);
  assert.equal(band.lo, HOME.right + 8);
  assert.equal(band.hi, 994);
});

test('the band aligns its top to the TOPMOST chrome, never to zero', () => {
  const band = ctxTopBand(STAGE, [{ ...HOME, top: 12, bottom: 50 }, { ...HUD, top: 8, bottom: 46 }]);
  assert.equal(band.top, 8, 'the higher of the two pills');
});

// ══ centring in the band ══════════════════════════════════════════════════════

test('the reserved bands are the row\'s edges: below the top bar, between the columns', () => {
  // Design chrome: a 55px top bar, a 232px navigator on the left, a 340px right column.
  const reserve = { top: 55, left: 232, right: 340 };
  const band = ctxTopBand(STAGE, [], { reserve });
  assert.equal(band.top, 55 + 6, 'the row starts one pad below the top bar, never under it');
  assert.equal(band.lo, 232 + 6, 'and one pad right of the left column');
  assert.equal(band.hi, 1000 - 340 - 6, 'and one pad left of the right column');
  // The top bar's own controls stand wholly inside the top reserve: not this row's chrome.
  const inBar = { left: 400, top: 8, right: 600, bottom: 46 };
  assert.deepEqual(ctxTopBand(STAGE, [inBar], { reserve }), band, 'chrome inside the reserve is ignored');
  // Chrome that reaches below the reserve still bounds and aligns the row as before.
  const hud = { left: 700, top: 70, right: 990, bottom: 110 };
  const withHud = ctxTopBand(STAGE, [hud], { reserve: { top: 55 } });
  assert.equal(withHud.top, 70, 'aligned to the chrome row below the bar');
  assert.equal(withHud.hi, hud.left - 8);
  assert.equal(ctxTopBand({ w: 0, h: 0 }, [], { reserve }).top, 61, 'the unmeasurable strip sits below the reserve too');
});

test('a bar that fits centres in the band', () => {
  const band = ctxTopBand(STAGE, [HOME, HUD]);   // lo 128, hi 692, room 564
  const pos = centreCtxBar(420, band);
  assert.equal(pos.top, band.top);
  assert.equal(pos.left, 128 + Math.round((564 - 420) / 2), 'centred in the free span');
});

test('a bar too wide for the band pins to its left edge and scrolls the rest', () => {
  const band = ctxTopBand(STAGE, [HOME, HUD]);   // room 564
  const pos = centreCtxBar(900, band);
  assert.equal(pos.left, band.lo, 'left never intrudes the back pill');
  // Capped to the band by max-width, so the painted right edge lands on `hi`, never past
  // it into the zoom HUD - the overflow is what scrolls, not the bar's footprint.
  assert.ok(paintedBox(900, band).right <= band.hi, 'painted footprint stays clear of the HUD');
});

test('the painted bar never overlaps the back pill or the zoom HUD, at any width', () => {
  const band = ctxTopBand(STAGE, [HOME, HUD]);
  for (const bw of [120, 300, 420, 564, 700, 1200]) {
    const box = paintedBox(bw, band);
    assert.equal(overlaps(box, HOME), false, `clear of the back pill at ${bw}px`);
    assert.equal(overlaps(box, HUD), false, `clear of the zoom HUD at ${bw}px`);
  }
});

// ══ degenerate inputs ═════════════════════════════════════════════════════════

test('an unmeasurable stage returns a padded strip instead of a band from zeroes', () => {
  // A display:none stage, a pre-layout ResizeObserver delivery, jsdom.
  assert.deepEqual(ctxTopBand({ w: 0, h: 0 }, [HUD]), { lo: 6, hi: 6, top: 6 });
});

test('chrome that leaves no gap never inverts the band - hi clamps up to lo', () => {
  const band = ctxTopBand({ w: 300, h: 700 }, [
    { left: 0, top: 8, right: 160, bottom: 48 },
    { left: 150, top: 8, right: 300, bottom: 48 },
  ]);
  assert.ok(band.hi >= band.lo, 'a zero-or-negative span, never a flipped one');
  assert.equal(centreCtxBar(200, band).left, band.lo, 'the bar still pins to lo and scrolls');
});

// ══ which chrome is actually in the way (stageBlockers) ══════════════════════
//
// The band's inputs. jsdom lays nothing out, so each stand-in carries the rect and the
// client-rect count that a real element would report - which is exactly what the
// function reads, and the reason it takes elements rather than doing its own queries.

const stageRect = { left: 100, top: 200, right: 1100, bottom: 900, width: 1000, height: 700 } as DOMRect;
/** An element as `stageBlockers` sees one: a rect, a hidden flag, and whether it paints. */
function fakeEl(o: { left: number; top: number; width: number; height: number; hidden?: boolean; boxes?: number }): HTMLElement {
  return {
    hidden: !!o.hidden,
    getClientRects: () => ({ length: o.boxes ?? 1 }),
    getBoundingClientRect: () => ({
      left: o.left, top: o.top, right: o.left + o.width, bottom: o.top + o.height,
      width: o.width, height: o.height,
    }),
  } as unknown as HTMLElement;
}

test('stageBlockers reports stage-relative boxes and drops what cannot be in the way', () => {
  const out = stageBlockers([
    null,
    fakeEl({ left: 100, top: 210, width: 120, height: 40 }),                  // real chrome
    fakeEl({ left: 100, top: 210, width: 120, height: 40, hidden: true }),    // display:none
    fakeEl({ left: 100, top: 210, width: 120, height: 40, boxes: 0 }),        // not painting
    fakeEl({ left: 100, top: 210, width: 0, height: 0 }),                    // unmeasurable
    fakeEl({ left: 100, top: 100, width: 200, height: 60 }),                 // ABOVE the stage
  ], stageRect);
  assert.deepEqual(out, [{ left: 0, top: 10, right: 120, bottom: 50 }],
    'one blocker, in stage coordinates - the top bar\'s own band is not one of them');
});

test('the LEFT SIDEBAR bounds the band, so the object bar never opens under it', () => {
  // The navigator column runs the full height of the stage at the left edge; while it is
  // open the tool rail is a grid inside it, so this one rect covers both.
  const column = fakeEl({ left: 100, top: 248, width: 232, height: 652 });
  const blockers = stageBlockers([column], stageRect);
  assert.deepEqual(blockers, [{ left: 0, top: 48, right: 232, bottom: 700 }]);
  const alone = ctxTopBand(STAGE, blockers);
  assert.equal(alone.lo, 232 + 8, 'the bar starts one gap right of the column');
  assert.equal(alone.top, 48, 'and on the column\'s own top line, under the top bar');
  // …and with the zoom HUD as well, both edges hold and nothing is painted over either.
  const band = ctxTopBand(STAGE, [...blockers, HUD]);
  assert.equal(band.lo, 240);
  assert.equal(band.hi, HUD.left - 8);
  for (const bw of [200, 500, 900]) {
    assert.equal(overlaps(paintedBox(bw, band), blockers[0]!), false, `clear of the column at ${bw}px`);
  }
});

// ══ the CSS contracts the placement depends on ════════════════════════════════

const css = readFileSync(new URL('../styles/parts/editor.css', import.meta.url), 'utf8');
const ctxRule = css.match(/^\.fc-ctxbar\s*\{[^}]*\}/m);

test('the bar scrolls its controls into reach - the one-row overflow the top-pin leans on', () => {
  assert.ok(ctxRule, 'editor.css declares .fc-ctxbar');
  assert.match(ctxRule![0], /overflow-x:\s*auto/, 'a horizontal scroll for a bar wider than the band');
  assert.match(ctxRule![0], /max-width:/, 'capped so the scroll has something to clip against');
  assert.match(ctxRule![0], /scrollbar-width:\s*none/, 'the scrollbar itself is hidden');
});

test('the entrance animation fills BACKWARDS, never forwards', () => {
  // A transform that survives the animation makes the bar the containing block for its
  // colour popover's position:fixed and throws the swatches off-screen - a bug already
  // fixed once in this file, which is why the bar is centred with `left` and not a
  // translateX. `backwards` fills only the delay; the computed transform is `none` again
  // the moment the run ends.
  const rule = css.match(/\.fc-ctxbar\.fc-ctxbar-enter\s*\{[^}]*\}/);
  assert.ok(rule, 'editor.css declares the entrance');
  assert.match(rule![0], /\bbackwards\b/);
  assert.doesNotMatch(rule![0], /\bforwards\b|\bboth\b/);
});

test('the readout reserves its width, so the bar cannot breathe mid-drag', () => {
  const rule = css.match(/^\.fc-readout\s*\{[^}]*\}/m);
  assert.ok(rule, 'editor.css declares .fc-readout');
  assert.match(rule![0], /min-width:\s*\d+ch/, 'a ch-based floor');
  assert.match(rule![0], /font-variant-numeric:\s*tabular-nums/, 'which only means anything with fixed-width digits');
});

test('the ctx bar reveals instantly and fades out on a delay; the rail never auto-hides', () => {
  // The rail's auto-hide came out 2026-08-28 (it annoyed more than it calmed, and it
  // kept the rail out of every capture) - the toolbar is always visible now, so only
  // the ctx bar keeps the anti-flicker hysteresis.
  const base = css.match(/^\.fc-ctxbar\s*\{[^}]*\}/m);
  assert.ok(base, 'editor.css declares .fc-ctxbar');
  // The duration may be a literal or a motion token (plans/172: .18s is var(--dur-2));
  // the DELAY stays literal here - it is this bar's own hysteresis, not a shared speed.
  assert.match(base![0], /transition:\s*opacity[^;]*(?:0?\.\d+s|var\(--dur-\d\))\s*ease\s+0\.\d+s/,
    '.fc-ctxbar hides on a delay');
  assert.match(css, /\.tool-stage:hover \.fc-ctxbar,[\s\S]{0,120}?transition-delay:\s*0s/,
    'the ctx bar\'s reveal cancels the delay');
  const rail = css.match(/^\.fc-toolbar\s*\{[^}]*\}/m);
  assert.ok(rail, 'editor.css declares .fc-toolbar');
  assert.doesNotMatch(rail![0], /opacity:\s*0/, 'the rail must not auto-hide at rest');
  assert.ok(!/\.tool-stage:hover \.fc-toolbar/.test(css), 'no hover reveal is left for the rail');
});

test('the rail does NOT try to keep a `[hidden]` button laid out', () => {
  // This test used to assert the opposite. The rail's vertical jump (a gated button
  // appearing re-centres the whole palette) was "fixed" by collapsing the button to
  // zero height instead of removing it - which cannot work and must not:
  //   • `[hidden] { display: none !important }` in parts/a11y.css out-ranks any
  //     `display` a sheet asks for, so the collapse never applied in a browser at all;
  //   • `hidden` means "not rendered AND not in the accessibility tree", which a
  //     laid-out zero-height button is not.
  // styles/hidden-attribute-guard.test.ts fails the build on that mistake app-wide;
  // this is the local restatement, so the same idea cannot come back in this sheet.
  assert.match(css, /\.fc-btn\[hidden\]\s*\{[^}]*display:\s*none/, 'the plain rule survives');
  assert.equal(css.match(/\.fc-toolbar \.fc-btn\[hidden\]\s*\{[^}]*\}/), null,
    'the rail must not override [hidden] - gate with a class + inert if it needs to stay laid out');
});

// ══ the panels the bar opens (plan 179 C6 / A18) ══════════════════════════════

test('the More panel can scroll, so the cap free-canvas writes has something to clip', () => {
  // The bar is pinned to the TOP chrome row, so its panels hang DOWN - and on a short
  // viewport the last section (Perspective tilt) ran off the bottom of the screen with
  // no way to reach it. free-canvas.ts measures the room below the anchor and writes an
  // inline `max-height`; a cap with no overflow rule is a cap that just hides the rows.
  const rule = css.match(/^\.fc-more-panel\s*\{[^}]*\}/m);
  assert.ok(rule, 'editor.css declares .fc-more-panel');
  assert.match(rule![0], /overflow-y:\s*auto/);
  // …and the flick at the end of the list must not scroll the page behind it.
  assert.match(rule![0], /overscroll-behavior:\s*contain/);
  // The cap itself is measured per open, never a hard-coded height in the sheet.
  assert.doesNotMatch(rule![0], /max-height:/,
    'the room left below the anchor is a runtime measurement, not a constant');
});

test('the armed-tool hint sits at the TOP of the stage, clear of the chrome row', () => {
  // A drawing gesture happens under the pointer; a chip at the bottom of the stage is
  // read once and then never looked at again (plan 179 A18). It takes the frames-in-order
  // chip's perch, offset below the back pill / zoom HUD / object bar row so it sits
  // beside them rather than on them.
  const rule = css.match(/^\.fc-armhint\s*\{[^}]*\}/m);
  assert.ok(rule, 'editor.css declares .fc-armhint');
  assert.doesNotMatch(rule![0], /bottom:/, 'no longer perched at the foot of the stage');
  const top = /top:\s*(\d+)px/.exec(rule![0]);
  assert.ok(top, 'it is placed from the top');
  assert.ok(Number(top![1]) >= 48,
    `${top![1]}px would put the chip inside the top chrome row the object bar owns`);
  assert.match(rule![0], /left:\s*50%/, 'and centred, like every other stage chip');
});
