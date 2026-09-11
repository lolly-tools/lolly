// SPDX-License-Identifier: MPL-2.0
/**
 * Mobile-chrome DRIFT GUARDS - the phone-only geometry a hand pass fixed across
 * fourteen stylesheets (plans/132 iOS UX), where every fix is the same two or
 * three variable references restated per surface and nothing at runtime notices
 * when one of them goes missing.
 *
 * What breaks without each of them, on a device no CI job owns:
 *
 *   1. SAFE-AREA BOTTOM - index.html ships viewport-fit=cover, so a fixed bar at
 *      `bottom: 1rem` paints INSIDE the iOS home-indicator gesture strip, where
 *      the OS claims the touch and the button simply does not respond. Every
 *      bottom-anchored surface clears it with var(--safe-bottom) (0px on a device
 *      with no inset, so the reference is free on desktop).
 *   2. KEYBOARD LIFT - var(--vv-bottom) is written by the VisualViewport shim
 *      (main.ts) and is the distance the soft keyboard covers. A bar that does not
 *      read it is BURIED by the keyboard exactly when a form on the page is being
 *      filled in, which is the only time some of these bars matter.
 *   3. SAFE-AREA TOP - the mobile controls sheet and the image lightbox's close
 *      button are the two fixed surfaces that hang off the TOP edge; without
 *      var(--safe-top) they sit under the notch / Dynamic Island.
 *   4. COARSE-POINTER FLOORS - the job toast's ✕ and an undo toast's action are
 *      the only cancel/undo for their operation. Both are small text controls, so
 *      they carry the 44px HIG floor on a coarse pointer.
 *   5. SHEET CLAMPS - the two draggable bottom sheets size themselves in dvh,
 *      which does NOT shrink for the keyboard. Without the calc(100dvh -
 *      var(--vv-bottom)) clamp a "full" sheet's own drag grip and its lowest
 *      controls end up under the keyboard with no way to reach them.
 *   6. DOCS CLEARANCE - the in-app docs reader's chrome row is fixed, and its
 *      height (--chrome-h) scales with Dynamic Type while its offset
 *      (--chrome-top) carries --safe-top. A static top padding under-clears on
 *      exactly the devices and settings that need it most, so the reader derives
 *      one --docs-chrome-clear and every consumer reads it.
 *
 * Deliberately structural: not one px, rem or z-index is pinned. Those are design
 * choices and pinning them would make this test a chore. What is pinned is the
 * VARIABLE REFERENCE, because that is the part a later edit drops by accident
 * while retuning a distance.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/styles/mobile-chrome-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

interface Rule { selector: string; body: string; at: string[]; line: number }

/**
 * Flat rule list: every innermost `selector { … }` with the at-rule preludes it
 * sits inside. Same shallow parser as lib/a11y-prefs-contract.test.ts - these
 * sheets are hand-written and use no CSS nesting.
 */
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

/** One declared value from a block, or undefined. */
function decl(rule: Rule, prop: string): string | undefined {
  return decls(rule.body).find(([p]) => p === prop)?.[1];
}

/** Split a selector list on TOP-LEVEL commas only (a `:has(a, b)` stays one arm). */
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

/**
 * Does this rule style the element itself (not a descendant of it, not a
 * pseudo-element on it)? Matched on the arm's LAST compound, so
 * `.gallery-bulkbar-actions .btn` and `.sidebar::after` are excluded while
 * `.start:has(> .stu-sheet) .be-bulkbar` is included.
 */
function targets(rule: Rule, cls: string): boolean {
  const token = new RegExp(`\\.${cls}(?![-\\w])`);
  return arms(rule.selector).some((arm) => {
    const last = arm.split(/[\s>+~]+/).pop() ?? '';
    return token.test(last) && !last.includes('::');
  });
}

/** Every rule in `file` that styles `.cls` itself AND declares `prop`. */
function anchoring(file: string, cls: string, prop: string): Rule[] {
  return rules(read(file)).filter((r) => targets(r, cls) && decl(r, prop) !== undefined);
}

const SAFE_BOTTOM = /var\(\s*--safe-bottom\b/;
const SAFE_TOP = /var\(\s*--safe-top\b/;
const VV_BOTTOM = /var\(\s*--vv-bottom\b/;

// ── The surfaces under guard ─────────────────────────────────────────────────

/**
 * Every fixed surface anchored to the bottom edge, with the two questions that
 * decide what it must reference.
 *
 * `safeVia` records the ONE surface whose safe-area clearance is not in its own
 * `bottom` value:
 *  - 'padding-bottom': .gallery-footer is anchored flush to the visible viewport
 *    edge (bottom: var(--vv-bottom)) because it is a full-width bar with a
 *    background, so the bar itself SHOULD reach the screen edge; the inset pads
 *    its controls up out of the gesture strip instead.
 *  - '--stu-sheet-h': the brand-studio bulk bar, while the studio sheet is open,
 *    is anchored above the SHEET's free edge rather than the viewport's, so the
 *    inset reaches it through the sheet height (verified in its own test below).
 *
 * `keyboard: false` marks the surfaces that deliberately do NOT track the
 * keyboard: .gallery-bulkbar (it appears only for a tile multi-selection, which
 * no text field is open during), .pro-toast / .beam-toast (transient
 * notifications, not controls to reach mid-typing) and .pr-hud (presentation
 * mode, where no keyboard-bearing field exists on the slide stage).
 */
const BOTTOM_SURFACES: Array<{
  cls: string;
  file: string;
  keyboard: boolean;
  safeVia?: 'padding-bottom' | '--stu-sheet-h';
}> = [
  { cls: 'job-toast',        file: 'styles/parts/job-toast.css',    keyboard: true },
  { cls: 'undo-toasts',      file: 'styles/parts/job-toast.css',    keyboard: true },
  { cls: 'render-pill',      file: 'styles/parts/tool-chrome.css',  keyboard: true },
  { cls: 'projects-bulkbar', file: 'styles/parts/projects.css',     keyboard: true },
  { cls: 'cat-bulkbar',      file: 'styles/parts/catalog.css',      keyboard: true },
  { cls: 'cat-viewopts',     file: 'styles/parts/catalog.css',      keyboard: true },
  { cls: 'store-selbar',     file: 'styles/parts/profile.css',      keyboard: true },
  { cls: 'be-bulkbar',       file: 'styles/parts/brand-studio.css', keyboard: true, safeVia: '--stu-sheet-h' },
  { cls: 'gallery-footer',   file: 'styles/parts/gallery.css',      keyboard: true, safeVia: 'padding-bottom' },
  { cls: 'gallery-bulkbar',  file: 'styles/parts/gallery.css',      keyboard: false },
  { cls: 'pro-toast',        file: 'pro/run-overlay.css',           keyboard: false },
  { cls: 'beam-toast',       file: 'components/beam-toast.css',     keyboard: false },
  { cls: 'pr-hud',           file: 'styles/parts/present.css',      keyboard: false },
];

test('sanity: every guarded sheet is present and parses to real rules', () => {
  const files = [...new Set([
    ...BOTTOM_SURFACES.map((s) => s.file),
    'styles/parts/docs.css', 'styles/parts/storage.css', 'styles/parts/tool.css', 'styles/parts/tray.css',
  ])];
  for (const file of files) {
    const parsed = rules(read(file));
    assert.ok(parsed.length > 5, `${file}: only ${parsed.length} rules parsed - the rule scanner has stopped seeing this sheet, which would make every guard below it vacuous`);
  }
});

// ── 1. Safe-area bottom ──────────────────────────────────────────────────────

test('every bottom-anchored fixed surface clears the home-indicator inset', () => {
  for (const { cls, file, safeVia } of BOTTOM_SURFACES) {
    const anchored = anchoring(file, cls, 'bottom');
    assert.ok(anchored.length > 0, `${file}: no rule anchors .${cls} with a \`bottom\` offset any more - this guard is pinning a surface that has moved or been renamed, so update the table in this test rather than deleting the entry`);

    if (safeVia === 'padding-bottom') {
      // Anchored flush at the visible-viewport edge on purpose; the inset pads the
      // controls up instead of moving the bar.
      const pad = anchoring(file, cls, 'padding-bottom');
      assert.ok(pad.length > 0 && pad.some((r) => SAFE_BOTTOM.test(decl(r, 'padding-bottom')!)),
        `${file}: .${cls} is a full-bleed bar anchored at the viewport edge, so var(--safe-bottom) must pad its CONTROLS up out of the iOS home-indicator gesture strip. No padding-bottom on it reads --safe-bottom, which leaves its buttons in the strip where the OS eats the tap (plans/132)`);
      continue;
    }

    for (const rule of anchored) {
      const value = decl(rule, 'bottom')!;
      const viaToken: boolean = safeVia !== undefined && new RegExp(`var\\(\\s*${safeVia}\\b`).test(value);
      assert.ok(SAFE_BOTTOM.test(value) || viaToken,
        `${file}:${rule.line}: "${rule.selector}" sets bottom: ${value} with no var(--safe-bottom)${safeVia ? ` and no var(${safeVia}) to inherit it through` : ''} - index.html ships viewport-fit=cover, so on a notched phone this surface paints inside the iOS home-indicator gesture strip and its controls stop responding to touch (plans/132)`);
    }
  }
});

test('the studio sheet height carries the inset the brand bulk bar rides on', () => {
  // .be-bulkbar's sheet-open lane is anchored above var(--stu-sheet-h), so the
  // chain above only holds while that token itself clears the inset. It matters
  // in the PEEK state, the one sheet height small enough for the gesture strip to
  // reach the bar; the half/full states are dvh fractions that clear it anyway.
  const file = 'styles/parts/brand-studio.css';
  const sites = rules(read(file)).flatMap((r) => decls(r.body)
    .filter(([p]) => p === '--stu-sheet-h')
    .map(([, value]) => ({ value, selector: r.selector, line: r.line })));
  assert.ok(sites.length >= 3, `${file}: only ${sites.length} --stu-sheet-h declarations found - the per-state sheet heights have moved, so the .be-bulkbar clearance chain can no longer be verified`);
  const peek = sites.filter((s) => /peek/.test(s.selector));
  assert.ok(peek.length > 0, `${file}: no [data-stu-sheet="peek"] --stu-sheet-h declaration - the peek height is the one .be-bulkbar inherits its safe-area clearance from`);
  for (const s of peek) {
    assert.match(s.value, SAFE_BOTTOM,
      `${file}:${s.line}: the peek --stu-sheet-h is "${s.value}" with no var(--safe-bottom) - .be-bulkbar is anchored above this height, so dropping the inset here puts the bulk bar's buttons back in the iOS home-indicator gesture strip (plans/132)`);
  }
});

// ── 2. Keyboard lift ─────────────────────────────────────────────────────────

test('the surfaces reachable while a field is focused ride var(--vv-bottom)', () => {
  for (const { cls, file, keyboard } of BOTTOM_SURFACES) {
    if (!keyboard) continue;
    for (const rule of anchoring(file, cls, 'bottom')) {
      const value = decl(rule, 'bottom')!;
      assert.match(value, VV_BOTTOM,
        `${file}:${rule.line}: "${rule.selector}" sets bottom: ${value} without var(--vv-bottom, 0px) - the VisualViewport shim (main.ts) writes the height the soft keyboard covers, so without it this surface is buried by the keyboard at exactly the moment a form on the page is being filled in. The reference is a no-op (0px) whenever no keyboard is up (plans/132)`);
    }
  }
});

// ── 3. Safe-area top ─────────────────────────────────────────────────────────

test('the two top-anchored fixed surfaces clear the notch', () => {
  const tops = [
    { cls: 'sidebar', file: 'styles/parts/tool-chrome.css', what: 'the mobile controls sheet' },
    { cls: 'userimg-lightbox-close', file: 'styles/parts/storage.css', what: "the image lightbox's only close button" },
  ];
  for (const { cls, file, what } of tops) {
    const anchored = anchoring(file, cls, 'top');
    assert.ok(anchored.length > 0, `${file}: no rule anchors .${cls} with a \`top\` offset any more - update the table in this test rather than dropping the surface`);
    for (const rule of anchored) {
      const value = decl(rule, 'top')!;
      assert.match(value, SAFE_TOP,
        `${file}:${rule.line}: "${rule.selector}" sets top: ${value} without var(--safe-top) - ${what} then sits under the notch / Dynamic Island on a cover-fit viewport (plans/132)`);
    }
  }
});

// ── 4. Coarse-pointer floors ─────────────────────────────────────────────────

test('the job toast dismiss and the undo action keep the 44px coarse-pointer floor', () => {
  const file = 'styles/parts/job-toast.css';
  const coarse = rules(read(file)).filter((r) => r.at.some((a) => /pointer\s*:\s*coarse/.test(a)));
  assert.ok(coarse.length >= 2, `${file}: only ${coarse.length} rules sit inside an @media (pointer: coarse) block - the touch hit-area floors have gone`);
  for (const { cls, why } of [
    { cls: 'job-x', why: 'the only cancel for every background job' },
    { cls: 'undo-toast-btn', why: 'the only undo for a deletion, and it expires' },
  ]) {
    const hits = coarse.filter((r) => targets(r, cls));
    assert.ok(hits.length > 0, `${file}: .${cls} has no @media (pointer: coarse) rule - it is ${why}, so a thumb-miss on it is unrecoverable`);
    const floors = hits.flatMap((r) => decls(r.body).filter(([p, v]) => /^min-(width|height)$/.test(p) && /\b44px\b/.test(v)));
    assert.ok(floors.length > 0,
      `${file}: the @media (pointer: coarse) rule for .${cls} declares no 44px min-width/min-height - ${why}, and a small text control below the HIG floor is a coarse-pointer thumb-miss. The glyph stays its size; only the tap box grows (plans/132 wave 2)`);
  }
});

// ── 5. Sheet clamps ──────────────────────────────────────────────────────────

test('both draggable bottom sheets clamp their dvh height against the keyboard', () => {
  const sheets = [
    { file: 'styles/parts/tool-chrome.css',  attr: 'data-sheet',     token: '--sheet-h',     what: 'the tool controls sheet' },
    { file: 'styles/parts/brand-studio.css', attr: 'data-stu-sheet', token: '--stu-sheet-h', what: 'the brand-studio sheet' },
  ];
  for (const { file, attr, token, what } of sheets) {
    for (const state of ['half', 'full']) {
      const gate = `[${attr}="${state}"]`;
      const sites = rules(read(file)).filter((r) => r.selector.includes(gate))
        .flatMap((r) => decls(r.body).filter(([p]) => p === token).map(([, value]) => ({ value, line: r.line, selector: r.selector })));
      assert.ok(sites.length > 0, `${file}: no ${gate} rule declares ${token} - the ${state} height of ${what} has moved, so this clamp can no longer be verified`);
      for (const s of sites) {
        // dvh does NOT shrink for the soft keyboard, so a bare 90dvh sheet keeps its
        // lowest controls (and its own drag grip) underneath it with no way to reach them.
        assert.match(s.value, /calc\([^)]*100dvh[^)]*var\(\s*--vv-bottom/,
          `${file}:${s.line}: ${gate} sets ${token}: ${s.value} without a calc(100dvh - var(--vv-bottom, 0px) …) clamp - dvh does not shrink for the soft keyboard, so ${what} at ${state} leaves its lowest controls and its own drag grip under the keyboard. The min() is a no-op while --vv-bottom is 0px (plans/132)`);
      }
    }
  }
});

// ── 6. Docs reader chrome clearance ──────────────────────────────────────────

test('the docs reader derives one --docs-chrome-clear from the live chrome tokens', () => {
  const file = 'styles/parts/docs.css';
  const sites = rules(read(file)).flatMap((r) => decls(r.body)
    .filter(([p]) => p === '--docs-chrome-clear')
    .map(([, value]) => ({ value, selector: r.selector, line: r.line })));
  assert.equal(sites.length, 1,
    `${file}: expected exactly ONE --docs-chrome-clear declaration, found ${sites.length} (${sites.map((s) => `:${s.line}`).join(', ')}) - five consumers resolve against it, so a second definition decides the reader's clearance by cascade accident`);
  const { value, selector, line } = sites[0]!;
  assert.match(selector, /\.docs-reader\b/, `${file}:${line}: --docs-chrome-clear is declared on "${selector}" - it belongs on .docs-reader, the element every consumer inherits it from`);
  // --chrome-top carries var(--safe-top) and --chrome-h scales with Dynamic Type /
  // largeText (styles/tokens.css), so a static rem clearance under-clears on
  // exactly the devices and settings that need it most.
  assert.match(value, /var\(\s*--chrome-top\b/,
    `${file}:${line}: --docs-chrome-clear is "${value}" and does not read var(--chrome-top, …) - that token carries var(--safe-top), so without it the reader's first heading slides under the fixed chrome row on a notched phone (plans/132)`);
  assert.match(value, /var\(\s*--chrome-h\b/,
    `${file}:${line}: --docs-chrome-clear is "${value}" and does not read var(--chrome-h, …) - that token scales with Dynamic Type and the largeText preference, so a static height under-clears the chrome row for the readers who enlarged their type`);
});

test('every docs surface behind the fixed chrome row consumes --docs-chrome-clear', () => {
  const file = 'styles/parts/docs.css';
  const parsed = rules(read(file));
  const consumers: Array<{ selector: RegExp; what: string; narrow?: boolean }> = [
    { selector: /^\.docs-reader$/, what: 'the reader itself (its top padding)' },
    { selector: /^\.docs-reader--wide$/, what: 'full-width reading mode, which restates the padding' },
    { selector: /\.docs-reader--landing \.docs-pathways-slot$/, what: 'the landing pathways bar, which drops BELOW the back pill on a narrow screen', narrow: true },
    { selector: /^\.docs-sidebar-slot$/, what: 'the sticky sidebar rail (its sticky top and its max-height)' },
    { selector: /^\.docs-toc-slot$/, what: 'the sticky on-page TOC rail (its sticky top and its max-height)' },
  ];
  for (const { selector, what, narrow } of consumers) {
    const hits = parsed.filter((r) => arms(r.selector).some((a) => selector.test(a))
      && /var\(\s*--docs-chrome-clear\b/.test(r.body)
      && (!narrow || r.at.some((a) => /max-width\s*:\s*700px/.test(a))));
    assert.ok(hits.length > 0,
      `${file}: nothing${narrow ? ' inside the @media (max-width: 700px) block' : ''} matching ${selector} reads var(--docs-chrome-clear) - ${what} then sits under the reader's FIXED chrome row (back pill left, home/theme cluster right) on a phone, and a hand-written rem clearance drifts from the token the row is actually sized by (plans/132)`);
  }
});

// ── Inventory guard: no NEW unprotected bottom anchor ────────────────────────

/**
 * The known `position: fixed` rules that declare a `bottom` offset reading
 * neither --safe-bottom nor --vv-bottom. Each is genuinely fine, for the reason
 * given - and each reason was re-checked against the rule, not assumed.
 *
 * Keep this honest in BOTH directions: the test below fails on a new unlisted
 * anchor AND on a listed one that no longer matches, so an entry cannot outlive
 * the rule it excuses.
 */
const BOTTOM_ANCHOR_ALLOW: Array<{ file: string; selector: string; why: string }> = [
  {
    file: 'styles/parts/brand-studio.css', selector: '.start > .stu-sheet',
    why: 'the studio sheet itself: a full-width surface with a background, which SHOULD reach the screen edge. Its own `padding-bottom: var(--safe-bottom)` lifts the contents out of the gesture strip, and its height is the vv-clamped --stu-sheet-h.',
  },
  {
    file: 'styles/parts/brand-studio.css', selector: '.start > .stu-sheet-grip',
    why: "the sheet's drag grip, anchored to the SHEET's free edge (bottom: var(--stu-sheet-h)), not the viewport's - both insets already reach it through that height.",
  },
  {
    file: 'styles/parts/tray.css', selector: '.start > button.ds-tray-grip',
    why: 'the design-system tray grip, same idiom: anchored to the tray\'s free edge (bottom: var(--ds-tray-h)), so it moves with the tray rather than the viewport edge.',
  },
  {
    file: 'styles/parts/gallery.css', selector: '.drop-hint',
    why: 'a transient "drop to upload" hint shown only during a file drag, pointer-events: none. Nothing to tap and no keyboard involved, so neither inset changes whether it works.',
  },
  {
    file: 'styles/parts/tool.css', selector: '.export-overlay',
    why: 'DESKTOP only (@media min-width: 641px) and pointer-events: none - a top-to-bottom container sized to the sidebar column, whose interactive .export-popup is positioned inside it. No touch device reaches this rule.',
  },
  {
    file: 'styles/parts/tool.css', selector: '.export-popup.is-floating',
    why: '`bottom: auto` is a RESET undoing the docked panel\'s bottom: 0 when the popup is torn off; the floating position is written from JS as inline top/left. There is no bottom anchor left to clear.',
  },
  {
    file: 'pro/pro.css', selector: '.pro-blocks-panel',
    why: 'a right-docked full-height rail: top: 0 + bottom: 0 is a vertical STRETCH, not a bottom anchor, and its own head/foot rows hold the controls away from the edge.',
  },
  {
    file: 'styles/parts/transcript.css', selector: '.tr-panel',
    why: 'the transcript rail, same STRETCH idiom as .pro-blocks-panel; its own padding-bottom: var(--safe-bottom) lifts the footer out of the gesture strip, and the panel has no text input for the keyboard to bury.',
  },
];

test('no NEW fixed bottom anchor skips both the safe-area inset and the keyboard lift', () => {
  const dirs = ['styles/parts', 'components', 'pro'];
  const allowed = new Set(BOTTOM_ANCHOR_ALLOW.map((a) => `${a.file}|${a.selector}`));
  const seen = new Set<string>();
  let scanned = 0;

  for (const dir of dirs) {
    for (const name of readdirSync(join(SRC_DIR, dir))) {
      if (!name.endsWith('.css')) continue;
      const file = `${dir}/${name}`;
      for (const rule of rules(read(file))) {
        const d = decls(rule.body);
        if (d.find(([p]) => p === 'position')?.[1] !== 'fixed') continue;
        const bottom = d.find(([p]) => p === 'bottom')?.[1];
        if (bottom === undefined) continue;
        scanned++;
        if (SAFE_BOTTOM.test(bottom) || VV_BOTTOM.test(bottom)) continue;
        // A full-viewport stretch has no bottom edge of its own to clear.
        if (/^0(px)?$/.test(d.find(([p]) => p === 'inset')?.[1] ?? '')) continue;
        const key = `${file}|${rule.selector}`;
        seen.add(key);
        assert.ok(allowed.has(key),
          `${file}:${rule.line}: "${rule.selector}" is position: fixed with bottom: ${bottom}, which reads neither ` +
          'var(--safe-bottom) nor var(--vv-bottom, 0px). index.html ships viewport-fit=cover, so on a notched phone ' +
          'this paints inside the iOS home-indicator gesture strip (the OS claims the touch and the control stops ' +
          'responding), and the soft keyboard buries it. Write the offset as ' +
          '`bottom: calc(<distance> + var(--safe-bottom) + var(--vv-bottom, 0px))` - both references are 0px when ' +
          'there is no inset and no keyboard, so nothing changes on desktop. If this surface genuinely needs neither ' +
          '(a full-height stretch, a pointer-events:none hint, a desktop-only rule, a JS-positioned popover, or an ' +
          "anchor that already tracks another surface's free edge), add it to BOTTOM_ANCHOR_ALLOW in this test with " +
          'its one-line reason.');
      }
    }
  }

  // 23 at the time of writing; the floor only has to be far enough above zero to
  // catch a parser or path regression that would silently scan nothing.
  assert.ok(scanned >= 15, `only ${scanned} fixed rules with a bottom offset were found across ${dirs.join(', ')} - the scan has stopped seeing the sheets, so this guard proves nothing`);
  for (const { file, selector, why } of BOTTOM_ANCHOR_ALLOW) {
    assert.ok(seen.has(`${file}|${selector}`),
      `${file}: the allowlist entry for "${selector}" no longer matches an unprotected fixed bottom anchor - either it now reads the insets (delete the entry) or the selector changed (update it). Its standing reason was: ${why}`);
  }
});
