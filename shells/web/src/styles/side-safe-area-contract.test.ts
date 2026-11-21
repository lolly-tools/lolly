// SPDX-License-Identifier: MPL-2.0
/**
 * Side safe-area DRIFT GUARDS: the chrome that is pinned to the left or right
 * edge of the screen, and the variable reference that keeps each piece out from
 * under a bar the system holds on that edge.
 *
 * Why this exists. index.html ships viewport-fit=cover, so the page fills the
 * whole display. Some devices hold a vertical system bar on ONE side edge for
 * the life of the window: the iPhone Duo draws its clock and status column down
 * the right edge of both displays and reports the column as an 84px right inset
 * with the left at 0, in portrait as well as landscape. A notch in landscape is
 * the older case of the same thing. A control at `right: var(--chrome-inset)`
 * sits under that column, where the system takes the touch.
 *
 * The rules the sheets follow, which this file pins:
 *
 *   1. ONE MECHANISM. tokens.css resolves --safe-left and --safe-right from the
 *      environment, and derives --chrome-inset-left and --chrome-inset-right for
 *      the floating top row. No sheet reads the device, the width or the
 *      orientation to decide a side inset.
 *   2. EACH SIDE ON ITS OWN. A left-edge declaration reads the left inset and a
 *      right-edge declaration the right one. One side carries the whole inset
 *      and the other carries none, so a shared or mirrored value is wrong.
 *   3. NO PLAIN --chrome-inset ON AN EDGE. That token is the gutter with no
 *      system bar; an edge offset written with it alone is the defect.
 *   4. ZERO IS FREE. Every reference is a sum or a max() with the inset, so with
 *      no inset (a desktop, a phone in portrait) each value computes as before.
 *
 * Structural like mobile-chrome-contract.test.ts: no distance is pinned, only
 * the reference a later edit drops by accident while retuning one.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/styles/side-safe-area-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // this file lives at src/styles/

// ── Reading ──────────────────────────────────────────────────────────────────

/** Comments blanked with newlines preserved, so reported line numbers stay true. */
function decomment(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

const cache = new Map<string, string>();
/** One sheet's text, comments blanked. `rel` is relative to src/. */
function read(rel: string): string {
  let text = cache.get(rel);
  if (text === undefined) {
    text = decomment(readFileSync(join(SRC_DIR, rel), 'utf8'));
    cache.set(rel, text);
  }
  return text;
}

/** Every stylesheet under src/, relative to src/. */
function allSheets(dir = SRC_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return allSheets(full);
    return entry.name.endsWith('.css') ? [relative(SRC_DIR, full)] : [];
  });
}

interface Rule { selector: string; body: string; at: string[]; line: number }

/** Flat rule list, the same shallow parser as mobile-chrome-contract.test.ts. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const at: string[] = [];
  let prelude = '';
  let line = 1;
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '\n') line++;
    if (ch === '{') {
      const head = prelude.trim();
      prelude = '';
      if (head.startsWith('@')) { at.push(head); i++; continue; }
      let depth = 1;
      let body = '';
      i++;
      while (i < css.length && depth > 0) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') { depth--; if (depth === 0) break; }
        if (css[i] === '\n') line++;
        body += css[i];
        i++;
      }
      out.push({ selector: head.replace(/\s+/g, ' '), body, at: [...at], line });
      i++;
      continue;
    }
    if (ch === '}') { at.pop(); prelude = ''; i++; continue; }
    prelude += ch;
    i++;
  }
  return out;
}

/** Declared `prop: value` pairs in a block body (custom properties included). */
function decls(body: string): Array<[string, string]> {
  return body.split(';').flatMap((chunk) => {
    const m = /^\s*([-\w]+)\s*:\s*([\s\S]*)$/.exec(chunk);
    return m ? [[m[1]!, m[2]!.trim()] as [string, string]] : [];
  });
}

/** Split a selector list on TOP-LEVEL commas only. */
function arms(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of selector) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((a) => a.trim()).filter(Boolean);
}

/** Does this rule style `.cls` itself (the last compound of an arm, no pseudo-element)? */
function targets(rule: Rule, cls: string): boolean {
  const token = new RegExp(`\\.${cls}(?![-\\w])`);
  return arms(rule.selector).some((arm) => {
    const last = arm.split(/[\s>+~]+/).pop() ?? '';
    return token.test(last) && !last.includes('::');
  });
}

const where = (file: string, rule: Rule): string => `${file}:${rule.line} ${rule.selector}`;

// ── 1. The tokens ────────────────────────────────────────────────────────────

test('tokens.css derives each chrome inset from its own side only', () => {
  const root = rules(read('styles/tokens.css')).filter((r) => r.selector === ':root');
  const value = (name: string): string => {
    const hit = root.flatMap((r) => decls(r.body)).find(([p]) => p === name);
    assert.ok(hit, `tokens.css must define ${name}`);
    return hit[1];
  };
  for (const side of ['left', 'right'] as const) {
    const other = side === 'left' ? 'right' : 'left';
    const safe = value(`--safe-${side}`);
    assert.match(safe, new RegExp(`env\\(\\s*safe-area-inset-${side}\\b`), `--safe-${side} reads its own environment inset`);
    assert.doesNotMatch(safe, new RegExp(`safe-area-inset-${other}\\b`), `--safe-${side} must not read the ${other} inset`);
    const chrome = value(`--chrome-inset-${side}`);
    assert.match(chrome, new RegExp(`var\\(\\s*--safe-${side}\\b`), `--chrome-inset-${side} reads --safe-${side}`);
    assert.doesNotMatch(chrome, new RegExp(`--safe-${other}\\b`), `--chrome-inset-${side} must not read --safe-${other}`);
    // The gutter stays the floor, so no inset means the old distance exactly.
    assert.match(chrome, /^max\(\s*var\(\s*--chrome-inset\s*\)/, `--chrome-inset-${side} keeps --chrome-inset as its floor`);
  }
});

// ── 2 and 3. Every sheet ─────────────────────────────────────────────────────

/** Physical and logical properties that place or pad one inline edge. */
const EDGE_PROPS = /^(left|right|inset|inset-inline|inset-inline-start|inset-inline-end|margin-left|margin-right|padding-left|padding-right)$/;

test('no edge offset is written with the plain --chrome-inset', () => {
  const offenders: string[] = [];
  for (const file of allSheets()) {
    for (const rule of rules(read(file))) {
      for (const [prop, value] of decls(rule.body)) {
        if (EDGE_PROPS.test(prop) && /var\(\s*--chrome-inset\s*[,)]/.test(value)) {
          offenders.push(`${where(file, rule)} { ${prop}: ${value} }`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [],
    'An edge-pinned control must use --chrome-inset-left or --chrome-inset-right, which stand inside a system bar on that side:\n  ' +
    offenders.join('\n  '));
});

test('a left-edge declaration never reads the right inset, nor a right-edge one the left', () => {
  const offenders: string[] = [];
  const wrong: Record<string, RegExp> = {
    left: /--(?:safe|chrome-inset)-right\b/,
    'padding-left': /--(?:safe|chrome-inset)-right\b/,
    'margin-left': /--(?:safe|chrome-inset)-right\b/,
    right: /--(?:safe|chrome-inset)-left\b/,
    'padding-right': /--(?:safe|chrome-inset)-left\b/,
    'margin-right': /--(?:safe|chrome-inset)-left\b/,
  };
  for (const file of allSheets()) {
    for (const rule of rules(read(file))) {
      for (const [prop, value] of decls(rule.body)) {
        const bad = wrong[prop];
        if (bad?.test(value)) offenders.push(`${where(file, rule)} { ${prop}: ${value} }`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'The two side insets are unrelated values; each edge reads its own:\n  ' + offenders.join('\n  '));
});

// ── The surfaces under guard ─────────────────────────────────────────────────

const CHROME_LEFT = /var\(\s*--chrome-inset-left\b/;
const CHROME_RIGHT = /var\(\s*--chrome-inset-right\b/;
const SAFE_LEFT = /var\(\s*--safe-left\b/;
const SAFE_RIGHT = /var\(\s*--safe-right\b/;

/**
 * Each surface that is pinned to a side edge, the property that pins or pads
 * that edge, and the reference the value must carry. `need` lists more than one
 * pattern where one declaration covers both sides (a `padding` shorthand).
 *
 * `prop` is matched on every rule that styles the class itself and declares the
 * property, so a phone override that restates the offset is checked as well. A
 * rule that hands the element back to a parent's layout (`right: auto` inside
 * the phone top bar, which carries the insets itself) has no offset to check.
 */
const SIDE_SURFACES: Array<{ cls: string; file: string; prop: string; need: RegExp[]; why: string }> = [
  // The floating top row: the corner controls of every browse and tool view.
  { cls: 'profile-link',     file: 'styles/parts/components.css', prop: 'right', need: [CHROME_RIGHT], why: 'the profile pill' },
  { cls: 'gallery-topright', file: 'styles/parts/gallery.css',    prop: 'right', need: [CHROME_RIGHT], why: 'the top-right cluster' },
  { cls: 'stage-nav',        file: 'styles/parts/editor.css',     prop: 'right', need: [CHROME_RIGHT], why: 'the canvas zoom cluster' },
  { cls: 'chrome-topleft',   file: 'styles/parts/overrides.css',  prop: 'left',  need: [CHROME_LEFT],  why: 'the Home pill island' },
  { cls: 'home-full',        file: 'styles/parts/tool.css',       prop: 'left',  need: [CHROME_LEFT],  why: 'the tool view Home pill' },
  // The phone top bar is one fixed row holding both ends.
  { cls: 'gallery-topbar',   file: 'styles/parts/topbar.css',     prop: 'left',  need: [SAFE_LEFT],    why: 'the phone top bar' },
  { cls: 'gallery-topbar',   file: 'styles/parts/topbar.css',     prop: 'right', need: [SAFE_RIGHT],   why: 'the phone top bar' },
  // Bars that reach the screen edge and pad their controls in.
  { cls: 'gallery-footer',   file: 'styles/parts/gallery.css',    prop: 'padding-left',  need: [SAFE_LEFT],  why: 'the bottom bar' },
  { cls: 'gallery-footer',   file: 'styles/parts/gallery.css',    prop: 'padding-right', need: [SAFE_RIGHT], why: 'the bottom bar' },
  { cls: 'design-topbar',    file: 'styles/parts/design-topbar.css', prop: 'padding-left',  need: [SAFE_LEFT],  why: "Design's top bar" },
  { cls: 'design-topbar',    file: 'styles/parts/design-topbar.css', prop: 'padding-right', need: [SAFE_RIGHT], why: "Design's top bar" },
  { cls: 'design-phone-panel', file: 'styles/parts/design-inspector.css', prop: 'padding-left',  need: [SAFE_LEFT],  why: "Design's phone panel" },
  { cls: 'design-phone-panel', file: 'styles/parts/design-inspector.css', prop: 'padding-right', need: [SAFE_RIGHT], why: "Design's phone panel" },
  { cls: 'welcome-hero',     file: 'styles/parts/welcome-hero.css', prop: 'padding', need: [SAFE_LEFT, SAFE_RIGHT], why: 'the welcome card band' },
  // Cards and toasts that stand in a right corner.
  { cls: 'personalize-nudge', file: 'styles/parts/gallery.css',   prop: 'right', need: [SAFE_RIGHT], why: 'the first-visit details card' },
  { cls: 'job-toast',        file: 'styles/parts/job-toast.css',  prop: 'right', need: [SAFE_RIGHT], why: 'the job toast' },
  { cls: 'beam-toast',       file: 'components/beam-toast.css',   prop: 'right', need: [SAFE_RIGHT], why: 'the beam toast' },
  { cls: 'userimg-lightbox-close', file: 'styles/parts/storage.css', prop: 'right', need: [SAFE_RIGHT], why: "the lightbox's close button" },
  // Columns of controls on the right edge: the surface reaches the edge, the column stands in.
  { cls: 'tr-panel',         file: 'styles/parts/transcript.css', prop: 'padding-right', need: [SAFE_RIGHT], why: 'the transcript panel' },
  { cls: 'pro-blocks-panel', file: 'pro/pro.css',                 prop: 'padding-right', need: [SAFE_RIGHT], why: "Batch's blocks panel" },
  { cls: 'revision-history-mobile', file: 'components/history-panel.css', prop: 'padding-right', need: [SAFE_RIGHT], why: 'the History sheet' },
  { cls: 'app-history-detail', file: 'views/history.css',         prop: 'padding-right', need: [SAFE_RIGHT], why: "History's detail sheet" },
  // The template chooser on a wide screen (the phone rule is checked below).
  { cls: 'asset-picker-panel', file: 'styles/picker.css', prop: 'left',  need: [SAFE_LEFT],  why: 'the asset picker' },
  { cls: 'asset-picker-panel', file: 'styles/picker.css', prop: 'right', need: [SAFE_RIGHT], why: 'the asset picker' },
  { cls: 'asset-picker-panel', file: 'styles/picker.css', prop: 'padding-left',  need: [SAFE_LEFT],  why: 'the asset picker on a phone' },
  { cls: 'asset-picker-panel', file: 'styles/picker.css', prop: 'padding-right', need: [SAFE_RIGHT], why: 'the asset picker on a phone' },
  { cls: 'tmpl-chooser-panel', file: 'styles/template-chooser.css', prop: 'left',  need: [SAFE_LEFT],  why: 'the template chooser' },
  { cls: 'tmpl-chooser-panel', file: 'styles/template-chooser.css', prop: 'right', need: [SAFE_RIGHT], why: 'the template chooser' },
];

test('every side-pinned surface carries its own side inset', () => {
  for (const s of SIDE_SURFACES) {
    const hits = rules(read(s.file)).filter((r) => targets(r, s.cls)).flatMap((r) =>
      decls(r.body).filter(([p]) => p === s.prop).map(([, v]) => ({ r, v })));
    // A rule that returns the element to its parent's flow carries no offset to check.
    const placed = hits.filter(({ v }) => !/^(auto|0|0px|unset|initial)(\s*!important)?$/.test(v));
    assert.ok(placed.length > 0, `${s.file}: .${s.cls} no longer declares ${s.prop}; move this entry with the rule (${s.why})`);
    for (const { r, v } of placed) {
      for (const need of s.need) {
        assert.match(v, need, `${where(s.file, r)} { ${s.prop}: ${v} } must reference ${need.source} (${s.why})`);
      }
    }
  }
});

test('the phone sheets keep their controls beside the bar on each side', () => {
  const phone = (r: Rule): boolean => r.at.some((a) => /max-width:\s*640px/.test(a));
  const phoneDecls = (file: string, cls: string, prop: RegExp): string =>
    rules(read(file)).filter((r) => phone(r) && targets(r, cls))
      .flatMap((r) => decls(r.body)).filter(([p]) => prop.test(p)).map(([, v]) => v).join(' ');
  // The tool view's controls sheet hangs from the top edge at the full width. The
  // sheet reaches both edges; everything in the sheet is a control, so the column stands in.
  const sheet = phoneDecls('styles/parts/tool.css', 'sidebar', /^padding-(left|right)$/);
  assert.match(sheet, SAFE_LEFT, 'the phone .sidebar pads in by --safe-left');
  assert.match(sheet, SAFE_RIGHT, 'the phone .sidebar pads in by --safe-right');
  // The template chooser is a modal panel, so the whole panel stands beside the bar.
  const panel = phoneDecls('styles/template-chooser.css', 'tmpl-chooser-panel', /^inset$/);
  assert.match(panel, SAFE_LEFT, 'the phone .tmpl-chooser-panel is inset by --safe-left');
  assert.match(panel, SAFE_RIGHT, 'the phone .tmpl-chooser-panel is inset by --safe-right');
});

test("Design's upright rail stands inside the side it is pinned to", () => {
  // split.css pins the rail to the canvas pane's outer edge with !important, on
  // the right for a right hand and on the left for a left hand.
  const dock = rules(read('styles/parts/split.css')).filter((r) => targets(r, 'fc-toolbar-dock'));
  const pinned = (prop: 'left' | 'right'): string[] => dock.flatMap((r) => decls(r.body))
    .filter(([p, v]) => p === prop && !/^auto\b/.test(v) && /--sp-4/.test(v) && !/--vv-/.test(v)).map(([, v]) => v);
  const right = pinned('right');
  const left = pinned('left');
  assert.ok(right.length > 0 && left.length > 0, 'split.css must pin the upright rail on each side');
  for (const v of right) assert.match(v, SAFE_RIGHT, `the rail's right offset "${v}" must reference --safe-right`);
  for (const v of left) assert.match(v, SAFE_LEFT, `the rail's left offset "${v}" must reference --safe-left`);
});
