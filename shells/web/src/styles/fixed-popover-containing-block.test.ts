/**
 * Guard for the fixed-popover containing-block trap (plan 179 A1, the second half of
 * "can't fill artboards").
 *
 * The shared colour field floats its picker as a `position: fixed` popover that lives
 * INSIDE the field's own subtree. Any `transform`, `filter` or `backdrop-filter` on an
 * ancestor turns that ancestor into the containing block for fixed descendants, so the
 * popover is laid out relative to the ancestor instead of the viewport. When the ancestor
 * only gets that property while it is `:active`, the popover moves for exactly the length
 * of a press: pointerdown hits a swatch, pointerup hits whatever was underneath,
 * and no swatch ever applies. That is what `.fc-btn:active { filter }` did to the rail's
 * colour button. This test pins the exclusion so the rule cannot grow it back.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'parts', 'editor.css'), 'utf8');

/** Every rule (selector list + declaration block) in the sheet, comments stripped. */
function rules(sheet: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  const clean = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) out.push({ selector: m[1]!.trim(), body: m[2]!.trim() });
  return out;
}

const CB_PROPS = /(^|;)\s*(transform|filter|backdrop-filter|perspective|will-change)\s*:/;

test('no :active rule that can match the rail colour button creates a containing block', () => {
  const offenders = rules(css).filter((r) => {
    if (!CB_PROPS.test(r.body)) return false;
    // A selector can match .fc-color-btn when it names .fc-btn (the wrap carries both
    // classes) without excluding the colour button, or names .fc-color-btn itself.
    return r.selector.split(',').some((sel) => {
      // Only the LAST compound selector names the element the declarations land on;
      // `.fc-color-btn:active .color-trigger` styles the trigger, which contains no popover.
      const last = sel.trim().split(/\s*[>+~]\s*|\s+/).pop() ?? '';
      const namesWrap = /\.fc-btn(?![-\w])/.test(last) || /\.fc-color-btn(?![-\w])/.test(last);
      const excluded = /:not\(\.fc-color-btn\)/.test(last);
      return namesWrap && !excluded;
    });
  });
  assert.deepEqual(offenders.map((r) => r.selector), [],
    'a transform/filter on .fc-btn or .fc-color-btn would move the fixed colour popover mid-click');
});

test('the press feedback still exists, on the trigger, for the colour button', () => {
  const rs = rules(css);
  assert.ok(rs.some((r) => /\.fc-btn:active:not\(:disabled\):not\(\.fc-color-btn\)/.test(r.selector) && /brightness/.test(r.body)),
    'the generic press rule must exclude the colour button');
  assert.ok(rs.some((r) => /\.fc-color-btn:active \.color-trigger/.test(r.selector) && /brightness/.test(r.body)),
    'the colour button presses its trigger instead');
});

test('the Design top bar never reaches outside the overflow-hidden stage', () => {
  // A negative inline-end inset (to span "over" the right dock) overflows `.tool-stage`,
  // which is overflow: hidden, and the browser scrolls the stage to reveal the overflow:
  // the whole editor shifted left by the dock width. The dock starts below the bar
  // instead (lib/edge-dock.ts reads --design-topbar-h), so the bar stays inside the stage.
  const topbar = readFileSync(join(here, 'parts', 'design-topbar.css'), 'utf8');
  const rule = rules(topbar).find((r) => r.selector === '.design-topbar');
  assert.ok(rule, '.design-topbar rule present');
  assert.doesNotMatch(rule!.body, /inset-inline:[^;]*calc\(-1/, 'no negative inline-end inset on the bar');
  assert.doesNotMatch(rule!.body, /right:\s*-/, 'no negative right on the bar');
});
