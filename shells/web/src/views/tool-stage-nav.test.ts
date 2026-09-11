// SPDX-License-Identifier: MPL-2.0
/**
 * Zoom HUD placement (.stage-nav, styles/parts/editor.css).
 *
 * The HUD's position is pure CSS - jsdom applies no stylesheet, so the rule text
 * itself is what gets asserted, exactly as free-canvas-rail.test.ts does for the
 * rail's [hidden] restatement. What's being guarded is a real regression pair:
 *   · the HUD must not go back to the stage's BOTTOM edge, which is the docked
 *     timeline band's lane (.tl-panel, z-index 22) - there it is unreachable
 *     whenever the timeline is open;
 *   · its top/right offsets must stay expressed in the shared top-row tokens
 *     (tokens.css --chrome-top / --chrome-h / --chrome-inset) rather than a
 *     hardcoded pixel value, so the HUD and the editor's back pill
 *     (.tools-home.home-full, which reads the same tokens) cannot drift apart.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles/parts/editor.css', import.meta.url), 'utf8');

/** The base `.stage-nav { … }` block (the first one - the mobile override follows). */
function baseRule(): string {
  const m = css.match(/\n\.stage-nav\s*\{([^}]*)\}/);
  assert.ok(m, 'editor.css must declare a base .stage-nav rule');
  return m![1]!;
}

test('the zoom HUD is anchored to the stage top, not the timeline\'s bottom lane', () => {
  const rule = baseRule();
  assert.match(rule, /(^|;|\s)top:/, '.stage-nav must set `top`');
  assert.doesNotMatch(rule, /(^|;|\s)bottom:/,
    '.stage-nav must not be bottom-anchored - the docked timeline band (z-index 22) owns that lane');
});

test('the zoom HUD sizes and insets itself off the shared top-row tokens', () => {
  const rule = baseRule();
  assert.match(rule, /top:\s*calc\([^)]*--chrome-top/,
    'the HUD\'s top must come from --chrome-top so it lines up with the back pill');
  assert.match(rule, /right:\s*calc\([^)]*--chrome-inset/,
    'the HUD\'s right inset must come from --chrome-inset (the shared edge inset)');
  assert.match(rule, /min-height:\s*var\(--chrome-h\)/,
    'the HUD must stand exactly as tall as the rest of the top row (--chrome-h)');
  // Pinch-zoom re-pin, same as the opposite end of the row (components.css .profile-link).
  assert.match(rule, /--vv-top/, 'the HUD must re-pin to the visible viewport top when pinch-zoomed');
  assert.match(rule, /--vv-right/, 'the HUD must re-pin to the visible viewport right when pinch-zoomed');
});

test('the mobile stacked capsule keeps the top anchor (no bottom offset comes back)', () => {
  // The ≤640px block turns the HUD into a vertical capsule; it must hang DOWN from the
  // same corner. A `bottom:` here would put a 7-item column back over the timeline - 
  // and, on the fixed mobile stage, off the foot of the viewport.
  const m = css.match(/@media\s*\(max-width:\s*640px\)\s*\{\s*\n\s*\.stage-nav\s*\{([^}]*)\}/);
  assert.ok(m, 'editor.css must keep the mobile .stage-nav override');
  assert.doesNotMatch(m![1]!, /bottom:/, 'the mobile capsule must not re-introduce a bottom offset');
});

test('the HUD keeps its at-rest dim and its reveal triggers', () => {
  // Position change only: hover / zoomed / focus-within must all still bring it to full
  // opacity, or the HUD becomes a permanent 45% smudge (and unusable by keyboard).
  assert.match(baseRule(), /opacity:\s*0\.45/, '.stage-nav stays dimmed at rest');
  assert.match(css, /\.tool-stage:hover \.stage-nav,\s*\n\.stage-nav\[data-zoomed="1"\],\s*\n\.stage-nav:focus-within\s*\{\s*opacity:\s*1/,
    'hover / [data-zoomed="1"] / :focus-within must all still reveal the HUD');
});
