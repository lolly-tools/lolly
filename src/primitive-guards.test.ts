// SPDX-License-Identifier: MPL-2.0
/**
 * Primitive-drift guards - static scans that make regressions against the shared
 * primitive layer (plans/76-component-audit.md, repo root) fail loudly instead of
 * silently re-forking atoms. Each rule names the audit rec it protects.
 *
 * These are ratchets, not aspirations: the allowlists encode the SURVEYED state
 * of 2026-07-13 (every entry carries the reason it is allowed to exist). A new
 * hit outside the allowlist fails with the primitive to use instead; a count
 * DROPPING below its allowlist entry also fails, with a "ratchet down" message,
 * so the ledger can never rot into silently re-permitting old debt.
 *
 * Run directly:  node --test shells/web/src/primitive-guards.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── File inventory (one read, shared by every rule) ──────────────────────────

const SRC_DIR = dirname(fileURLToPath(import.meta.url)); // this file lives at src/

interface SrcFile { rel: string; text: string }

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'vendor') continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(ts|css)$/.test(entry.name)) out.push(p);
  }
  return out;
}

const ALL = walk(SRC_DIR).map((p): SrcFile => ({
  rel: relative(SRC_DIR, p).split(sep).join('/'),
  text: readFileSync(p, 'utf8'),
}));
// Product surface only: test files aren't shipped markup (and this file quotes
// the very patterns it hunts, so it must not scan itself).
const TS = ALL.filter(f => f.rel.endsWith('.ts') && !f.rel.endsWith('.test.ts') && !f.rel.endsWith('.d.ts'));
const CSS = ALL.filter(f => f.rel.endsWith('.css'));

test('sanity: the scan actually found the tree (a broken walk must not vacuously pass)', () => {
  assert.ok(TS.length > 100, `only ${TS.length} .ts files found under ${SRC_DIR}`);
  assert.ok(CSS.length > 20, `only ${CSS.length} .css files found under ${SRC_DIR}`);
});

// ── Shared helpers ────────────────────────────────────────────────────────────

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Every match of `re` in `text`, as 1-indexed line numbers. */
function hitLines(text: string, re: RegExp): number[] {
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = r.exec(text))) {
    out.push(lineOf(text, m.index));
    if (r.lastIndex === m.index) r.lastIndex++;
  }
  return out;
}

/** Blank out CSS comments, preserving offsets so line numbers stay true. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
}

/**
 * Exact-count ratchet: `actual` (key → hit lines) must equal `allowed`
 * (key → permitted count). Over → violation with the remedy; under → a
 * "ratchet the allowlist down" failure so the ledger stays honest.
 */
function checkRatchet(actual: Map<string, number[]>, allowed: Record<string, number>, remedy: string): void {
  const problems: string[] = [];
  for (const [key, lines] of actual) {
    const max = allowed[key] ?? 0;
    if (lines.length > max) {
      problems.push(`${key} (line${lines.length > 1 ? 's' : ''} ${lines.join(', ')}): ${lines.length} hit(s), allowlist permits ${max}. ${remedy}`);
    } else if (lines.length < max) {
      problems.push(`${key}: allowlist permits ${max} hit(s) but only ${lines.length} remain - attrition win! Ratchet its entry down in primitive-guards.test.ts.`);
    }
  }
  for (const [key, max] of Object.entries(allowed)) {
    if (max > 0 && !actual.has(key)) {
      problems.push(`${key}: allowlisted for ${max} hit(s) but has none (fixed or file gone) - remove its entry from primitive-guards.test.ts.`);
    }
  }
  assert.equal(problems.length, 0, `\n${problems.join('\n')}\n`);
}

// ── R1 (rec 4 - one dialog lifecycle) ────────────────────────────────────────
// mountModal (components/modal.ts) is the ONE <dialog> lifecycle: open, Escape,
// backdrop hit-test, body-mount, focus-first, teardown. Hand-rolling any of it
// re-forks the primitive rec 4 spent the whole migration deleting.

const DIALOG_CREATE = /createElement\(\s*['"`]dialog['"`]\s*\)/;
const SHOW_MODAL = /\.showModal\(/;

// Allowlist reasons (counts are exact - a second hit in an allowed file still fails):
const DIALOG_CREATE_ALLOWED: Record<string, number> = {
  'components/modal.ts': 1,  // the primitive itself - the one place allowed to mint a <dialog>
  // The collab QR-zoom: a NESTED, full-screen, tap-anywhere-to-dismiss overlay opened ON
  // TOP of the ceremony modal. mountModal is a centred content-box modal whose `cancel`
  // fires on the top dialog only, so a nested mountModal would route Escape to the wrong
  // element; the zoom also fills the viewport with its own dim ground (no ::backdrop box to
  // hit-test) and re-renders the QR at full size. Documented at openQrZoom.
  'components/collab-ceremony.ts': 1,
};
const SHOW_MODAL_ALLOWED: Record<string, number> = {
  'components/modal.ts': 1,  // the primitive itself
  // Progressive-enhancement open of a STATIC markup dialog (<dialog class="dash-cap-modal">
  // in the view template) with a setAttribute('open') fallback for no-dialog engines.
  // It doesn't mint a dialog or re-implement focus/teardown, so it isn't a lifecycle fork.
  'views/dashboard.ts': 1,
  // Same pattern: opens the docs formats page's rehosted static <dialog class="fmt-dialog">
  // (from the built /info page) on a chip click, with the setAttribute('open') fallback.
  // Native <form method="dialog"> owns Escape/✕/focus; no lifecycle is re-implemented.
  'lib/docs-formats.ts': 1,
  // The collab QR-zoom opens the nested full-screen dialog it mints (see DIALOG_CREATE_ALLOWED):
  // mountModal cannot own a nested dialog's Escape, so this one lifecycle is deliberate + local.
  'components/collab-ceremony.ts': 1,
};

test('R1 (rec 4): the <dialog> lifecycle is minted only by components/modal.ts (mountModal)', () => {
  const creates = new Map<string, number[]>();
  const shows = new Map<string, number[]>();
  for (const f of TS) {
    const c = hitLines(f.text, DIALOG_CREATE);
    if (c.length) creates.set(f.rel, c);
    const s = hitLines(f.text, SHOW_MODAL);
    if (s.length) shows.set(f.rel, s);
  }
  checkRatchet(creates, DIALOG_CREATE_ALLOWED,
    "Don't hand-roll a <dialog> - use mountModal(content, opts) from components/modal.ts (the one lifecycle: open/Escape/backdrop/focus/teardown).");
  checkRatchet(shows, SHOW_MODAL_ALLOWED,
    "Don't call showModal() yourself - mountModal (components/modal.ts) owns opening; for a confirm/notice/prompt use confirm-dialog.ts's wrappers.");
});

// ── R2 (rec 2 - one primary fill) ────────────────────────────────────────────
// The primary-fill button recipe - background:hsl(var(--primary)) PLUS
// color:hsl(var(--primary-foreground)) in one rule - is textually declared once,
// in styles/parts/buttons.css (.btn--primary and its alias selector-list). Rec 2's
// documented attrition policy froze the legacy restatements below: no new members.
// Note the regex deliberately does NOT match `background: var(--brand-primary,
// hsl(var(--primary)))` - that brand-var indirection (e.g. .dash-hero-cta) is a
// documented, deliberate delta, not a fork of the recipe.

const PRIMARY_BG = /(?:^|[;\s])background(?:-color)?:\s*hsl\(var\(--primary\)\)/;
const PRIMARY_FG = /(?:^|[;\s])color:\s*hsl\(var\(--primary-foreground\)\)/;

// Frozen legacy fills (surveyed 2026-07-13) - rec 2's remainder: renaming these is
// "markup-rename churn with real regression risk"; the policy is attrition, so each
// stays until its view is rewritten. Keyed "file → selector", each permitted once.
const PRIMARY_FILL_ALLOWED: Record<string, number> = {
  'styles/parts/ask.css → .ask-q': 1,                                  // Ask user-question chat bubble (not a button)
  'pro/pro.css → .pro-fill-btn:hover': 1,                              // pro fill-tool hover state
  'styles/parts/gallery.css → .personalize-nudge-cta': 1,              // personalize nudge CTA
  'styles/parts/gallery.css → .gtile-continue': 1,                     // gallery tile continue pill
  'styles/parts/profile.css → .profile-view .profile-theme-pill': 1,   // Appearance theme pill active
  'styles/parts/storage.css → .clear-dialog-actions .btn.btn-go': 1,   // clear-gate go button
  'styles/parts/tool-chrome.css → .scrub-readout': 1,                  // select-scrub readout bubble
  'styles/parts/tool-chrome.css → .audio-preview.is-playing': 1,       // audio preview playing state
  'styles/parts/tool.css → .flatpickr-day.selected, .flatpickr-day.selected:hover': 1, // vendored flatpickr theme
  'styles/parts/tool.css → .block-add--prominent': 1,                  // blocks-input add button
  'styles/parts/tool.css → .embed-editor-actions .ee-apply': 1,        // embed editor apply button
  'styles/parts/topbar.css → .history-fab-count': 1,                   // history FAB count bubble
  'styles/parts/welcome.css → .welcome-lang.is-active': 1,             // welcome language pill active
  'styles/picker.css → .tc-render': 1,                                 // picker tool-card render button
  'styles/picker.css → .asset-picker-toolcard-actions .tc-use': 1,     // picker tool-card use button
  'styles/picker.css → .webcam-capture-actions .webcam-capture-shoot': 1, // webcam shoot button
  'styles/picker.css → .pdfpick-btn--primary': 1,                      // PDF page-picker primary button
  'styles/parts/docs.css → .docs-content .shot-tryit-open, .docs-content .shot-tryit-open:hover': 1, // M3 in-app docs "Try it in the app" navigate pill - brand action, restates the fill as a docs-scoped overlay
};

test('R2 (rec 2): the primary-fill button recipe is declared once, in buttons.css', () => {
  const found = new Map<string, number[]>();
  for (const f of CSS) {
    if (f.rel === 'styles/parts/buttons.css') continue; // the canonical home
    const css = stripCssComments(f.text);
    const rule = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = rule.exec(css))) {
      const decls = m[2] ?? '';
      if (!PRIMARY_BG.test(decls) || !PRIMARY_FG.test(decls)) continue;
      const selector = (m[1] ?? '').trim().replace(/\s+/g, ' ');
      const key = `${f.rel} → ${selector}`;
      const lines = found.get(key) ?? [];
      lines.push(lineOf(css, m.index + (m[1]?.length ?? 0)));
      found.set(key, lines);
    }
  }
  checkRatchet(found, PRIMARY_FILL_ALLOWED,
    "New primary-fill button: use class=\"btn btn--primary\" (styles/parts/buttons.css), or add your selector to its alias selector-list - never restate the fill pair.");
});

// ── R3 (rec 5 - one icon registry) ───────────────────────────────────────────
// lib/icons.ts's PATHS registry + icon(name, opts) is the one home for Lucide
// glyphs (the 24×24 viewBox is their signature). Rec 5 deleted the seven named
// per-file icon maps; the files below still carry inline one-off glyphs that were
// never in that rec's scope - frozen at their surveyed counts so the backlog can
// only shrink. A NEW inline 24×24 SVG anywhere fails.

const LUCIDE_VIEWBOX = 'viewBox="0 0 24 24"';

const INLINE_GLYPH_ALLOWED: Record<string, number> = {
  'lib/icons.ts': 1,             // the registry itself - icon()'s one <svg viewBox…> template
  'views/components-data.ts': 2, // #/components static specimen markup demonstrating icon output
  // Frozen legacy inline glyphs, pre-dating lib/icons.ts (rec 5 migrated only the seven
  // named maps; these were never in scope). Counts surveyed 2026-07-13 - down only.
  'components/color-field.ts': 2,
  'components/help-tip.ts': 1,
  'components/music-player.ts': 6,   // play/pause now come from lib/icons.ts (2026-07-29)
  'components/profile-menu.ts': 1,  // 2 → 1, 2026-08-23: the per-row chevron copies collapsed into one CHEVRON const
  'components/view-toggle.ts': 2,   // 3 → 2, 2026-08-20: the Tools tab's inline wrench went - it's icon('hammer') from lib/icons.ts now
  'lib/audio-coaching.ts': 1,
  // 5 → 0, plan 97 M1 (2026-08-09): the five BRAND_TABS glyphs went with the tab
  // bar they fed. The design-system studio is rooms now, and views/start.ts
  // builds its own navigation out of lib/icons.ts.
  'lib/brand-seal.ts': 1,
  'lib/capabilities-data.ts': 1,
  'lib/device-info.ts': 18,      // TITLE_ICONS map - the known landmine, biggest holdout after doc-editor/catalog
  'lib/genai-pill.ts': 1,
  'lib/lolly-badge.ts': 1,
  'lib/recording-tips.ts': 1,
  'lib/upload-dropzone.ts': 1,
  'pro/blocks-editor.ts': 3,
  'pro/grid.ts': 5,
  'pro/run-overlay.ts': 1,
  'theme.ts': 3,
  'views/catalog.ts': 1,   // +2 2026-08-18: INTERP_ICON + FIT_ICON zoom-pill glyphs (inline, like ZOOM_IN/OUT_ICON)
  'views/catalog/shared.ts': 22,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts (the zoom-pill and treatment glyph constants)
  'views/dashboard.ts': 5,
  'views/doc-editor.ts': 23,
  // Moved verbatim from free-canvas.ts into its icon registry during the plan
  // 198 seam extraction. One existing wrapper, no new glyph.
  'views/free-canvas-icons.ts': 1,
  // The `svgIcon()` wrapper lifted out of free-canvas.ts with the shape/fit/align
  // field rows (plan 179 M1). It is that file's glyph wrapper copied VERBATIM - the
  // lifted builders emit markup free-canvas.ts's own tests compare byte-for-byte, and
  // icon() is not interchangeable: it looks a NAME up in PATHS and emits a different
  // attribute order (it adds xmlns). One template, no new pictures. 2026-09-02.
  'views/free-canvas-fields.ts': 1,
  'views/multi-edit.ts': 1,
  'views/personalize-nudge.ts': 1,
  'views/picker.ts': 3,
  'views/record-control.ts': 1,
  'views/tool-actions/sequence.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool-actions/markup.ts': 9,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool-actions/format-rules.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  // Back to 6, 2026-08-15: the URL-budget gauge ring (briefly a 7th inline SVG)
  // moved out of views/tool.ts the same day it arrived.
  'views/tool/stage-layout.ts': 3,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool/shared.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool/history.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
};

test('R3 (rec 5): inline 24×24 Lucide glyphs only shrink - new icons go through lib/icons.ts', () => {
  const found = new Map<string, number[]>();
  for (const f of TS) {
    const lines: number[] = [];
    let idx = f.text.indexOf(LUCIDE_VIEWBOX);
    while (idx !== -1) {
      lines.push(lineOf(f.text, idx));
      idx = f.text.indexOf(LUCIDE_VIEWBOX, idx + LUCIDE_VIEWBOX.length);
    }
    if (lines.length) found.set(f.rel, lines);
  }
  checkRatchet(found, INLINE_GLYPH_ALLOWED,
    "Don't inline a 24×24 SVG - render it via icon(name, opts) from lib/icons.ts (add the glyph's path to its PATHS registry if it's missing).");
});

// ── R4 (contract sync) - #/components stays the browsable contract ───────────
// Every `live: "<key>"` in views/components-data.ts must have a renderer in
// views/components.ts's LIVE map, and every LIVE renderer must be reachable from
// a specimen. A one-sided add means either a dead renderer or a specimen whose
// stage silently falls back to source view.

/** Skip a '…' / "…" string literal; returns the index just past the close quote. */
function skipString(src: string, i: number): number {
  const q = src[i];
  i++;
  while (i < src.length) {
    if (src[i] === '\\') i += 2;
    else if (src[i] === q) return i + 1;
    else i++;
  }
  return i;
}

/** Skip a `…` template literal, including nested ${ … } holes; returns index past the close. */
function skipTemplate(src: string, i: number): number {
  i++; // past the opening backtick
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') return i + 1;
    if (c === '$' && src[i + 1] === '{') {
      i += 2;
      let d = 1;
      while (i < src.length && d > 0) {
        const h = src[i];
        if (h === "'" || h === '"') i = skipString(src, i);
        else if (h === '`') i = skipTemplate(src, i);
        else { if (h === '{') d++; else if (h === '}') d--; i++; }
      }
      continue;
    }
    i++;
  }
  return i;
}

/** Top-level `key:` names of the object literal opening at src[openIdx] === '{'. */
function topLevelObjectKeys(src: string, openIdx: number): string[] {
  const keys: string[] = [];
  let i = openIdx + 1;
  let depth = 1;
  let expectKey = true; // true right after '{' or a depth-1 ','
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl === -1 ? src.length : nl; continue; }
    if (c === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i); i = end === -1 ? src.length : end + 2; continue; }
    if (c === "'" || c === '"') { i = skipString(src, i); continue; }
    if (c === '`') { i = skipTemplate(src, i); continue; }
    if (c === '{') { depth++; i++; continue; }
    if (c === '}') { depth--; i++; expectKey = false; continue; }
    if (depth === 1) {
      if (c === ',') { expectKey = true; i++; continue; }
      if (expectKey && c !== undefined && /[A-Za-z_$]/.test(c)) {
        let j = i + 1;
        while (j < src.length && /[\w$]/.test(src[j] ?? '')) j++;
        let k = j;
        while (k < src.length && /\s/.test(src[k] ?? '')) k++;
        if (src[k] === ':') keys.push(src.slice(i, j));
        expectKey = false;
        i = j;
        continue;
      }
    }
    i++;
  }
  return keys;
}

test('R4: components-data.ts specimen live-keys ≡ components.ts LIVE renderer keys', () => {
  const dataFile = TS.find(f => f.rel === 'views/components-data.ts');
  const viewFile = TS.find(f => f.rel === 'views/components.ts');
  assert.ok(dataFile, 'views/components-data.ts not found - did the contract move?');
  assert.ok(viewFile, 'views/components.ts not found - did the contract move?');

  const specimenKeys = new Set<string>();
  for (const m of dataFile.text.matchAll(/\blive:\s*["']([$\w]+)["']/g)) specimenKeys.add(m[1] ?? '');

  const open = /const LIVE\b[\s\S]*?=\s*\{/.exec(viewFile.text);
  assert.ok(open, "couldn't locate `const LIVE … = {` in views/components.ts - update this parser alongside the map");
  const liveKeys = new Set(topLevelObjectKeys(viewFile.text, open.index + open[0].length - 1));

  // Floor so a rotted regex can't pass on empty == empty (27 = 27 at authoring time).
  assert.ok(specimenKeys.size >= 20, `only ${specimenKeys.size} live: specimen keys parsed - the live: regex has rotted`);
  assert.ok(liveKeys.size >= 20, `only ${liveKeys.size} LIVE map keys parsed - the object-key parser has rotted`);

  const onlyData = [...specimenKeys].filter(k => !liveKeys.has(k)).sort();
  const onlyLive = [...liveKeys].filter(k => !specimenKeys.has(k)).sort();
  const problems: string[] = [];
  if (onlyData.length) problems.push(`specimens reference LIVE renderers that don't exist (stage falls back to source view): ${onlyData.join(', ')} - add renderers to views/components.ts's LIVE map or fix the key.`);
  if (onlyLive.length) problems.push(`LIVE renderers with no specimen (unreachable in #/components): ${onlyLive.join(', ')} - add a components-data.ts entry with live: "<key>".`);
  assert.equal(problems.length, 0, `\n${problems.join('\n')}\n`);
});

// ── R5 (rec 9 - one NAV_EVENTS) ──────────────────────────────────────────────
// The hashchange/popstate/lolly:navigate triple lives once, in utils.ts. Rec 9
// deleted the redeclarations in lang-menu/profile-menu; importing is fine anywhere.

test('R5 (rec 9): NAV_EVENTS is declared only in utils.ts', () => {
  const found = new Map<string, number[]>();
  for (const f of TS) {
    const lines = hitLines(f.text, /\bNAV_EVENTS\s*=(?!=)/);
    if (lines.length) found.set(f.rel, lines);
  }
  checkRatchet(found, { 'utils.ts': 1 /* the one home */ },
    "Don't redeclare the nav-event triple - import { NAV_EVENTS } from utils.ts.");
});

// ── R6 (recs 1/4/13 - deleted names stay dead) ───────────────────────────────
// Classes the audit deleted or renamed must never come back as live selectors or
// markup. Prose is fine (CSS comments are stripped; TS matching is scoped to
// class-usage positions - class="…", classList.*, querySelector/closest/matches
// selector strings, className assignment - so components-data.ts's rename notes
// and storage.css's tombstone comments don't trip it).

const DEAD_NAMES: Record<string, string> = {
  'segmented-control': 'deleted by rec 1 - build segmented controls with segHtml() / .view-seg (lib/seg.ts)',
  'projects-toast': 'renamed by rec 13 - use .pro-toast with a positioning modifier (--bar or --top)',
  'clear-dialog-overlay': 'deleted by rec 4 - the clear/hoard/import gates are native <dialog class="clear-dialog"> on mountModal, no overlay wrapper',
  'userimg-lightbox-overlay': 'deleted by rec 4 - the lightbox is a native <dialog class="userimg-lightbox"> on mountModal, no overlay wrapper',
};

function deadNameTsPatterns(name: string): RegExp[] {
  return [
    new RegExp(`class\\s*=\\s*["'][^"'\\n]*(?<![\\w-])${name}(?![\\w-])`),                    // class="… name …" in markup
    new RegExp(`classList\\.(?:add|remove|toggle|contains|replace)\\([^)]*["'\`]${name}["'\`]`), // classList ops
    new RegExp(`(?:querySelector(?:All)?|closest|matches)\\(\\s*["'\`][^"'\`\\n]*\\.${name}(?![\\w-])`), // selector strings
    new RegExp(`className\\s*\\+?=[^;\\n]*(?<![\\w-])${name}(?![\\w-])`),                     // className assignment
  ];
}

test('R6 (recs 1/4/13): deleted class names stay dead in selectors and markup', () => {
  const problems: string[] = [];
  for (const [name, why] of Object.entries(DEAD_NAMES)) {
    const cssRe = new RegExp(`\\.${name}(?![\\w-])`);
    for (const f of CSS) {
      for (const line of hitLines(stripCssComments(f.text), cssRe)) {
        problems.push(`${f.rel}:${line} - .${name} selector resurrected; ${why}.`);
      }
    }
    for (const f of TS) {
      for (const re of deadNameTsPatterns(name)) {
        for (const line of hitLines(f.text, re)) {
          problems.push(`${f.rel}:${line} - "${name}" used as a live class; ${why}.`);
        }
      }
    }
  }
  assert.equal(problems.length, 0, `\n${problems.join('\n')}\n`);
});

// ── R7: the component library describes the shell that actually exists ───────
// #/components is HAND-MAINTAINED specimen data (views/components-data.ts), so
// nothing stops it drifting from the code it documents - and it had: five
// selectors named classes deleted in the audit's own rec 13, and 65 of 70
// `defined:` file:line anchors pointed at unrelated lines after the code moved
// under them. The line numbers are gone (a path plus the symbol in the specimen
// name survives refactors; a line number does not). These two rules keep the
// remaining claims honest:
//
//   · every `defined:` path resolves to a real file
//   · every class named in a `css:` list is still live somewhere in the shell
//
// Both are absolute, not ratchets: unlike the primitive rules above there's no
// surveyed backlog to grandfather - a specimen pointing at something that isn't
// there is simply wrong, and cheap to fix the moment it happens.

/** Specimen file paths are written repo-relative ("shells/web/src/lib/seg.ts"),
 *  sometimes as an "a.ts / b.ts" pair whose tail is bare ("lib/seg.ts"), and may
 *  carry a trailing "(symbolName)" note. Reduce one token to a src-relative path. */
function specimenPathCandidates(token: string): string[] {
  const bare = token.replace(/\s*\(.*$/, '').trim();
  if (!bare) return [];
  const stripped = bare.replace(/^shells\/web\/src\//, '');
  // A tail like "lib/seg.ts" is already src-relative; one like "platform.css"
  // continues its partner's directory, so try the known component dirs too.
  return [stripped, ...['lib', 'views', 'components', 'styles/parts', 'pro'].map(d => `${d}/${stripped}`)];
}

test('R7: components-data.ts `defined:` paths point at files that exist', () => {
  const data = ALL.find(f => f.rel === 'views/components-data.ts');
  assert.ok(data, 'views/components-data.ts not found - did the specimen data move?');
  const known = new Set(ALL.map(f => f.rel));

  const problems: string[] = [];
  let checked = 0;
  for (const m of data.text.matchAll(/\{ name: "((?:[^"\\]|\\.)*)"[^\n]*?defined: "([^"]*)"/g)) {
    for (const token of (m[2] ?? '').split('/ ')) {
      const cands = specimenPathCandidates(token);
      if (!cands.length) continue;
      checked++;
      if (!cands.some(c => known.has(c))) {
        problems.push(`"${m[1]}" → defined: "${token.trim()}" doesn't exist. Point it at the file that owns the component now, or drop the specimen if the component is gone.`);
      }
    }
  }
  // Floor so a rotted regex can't pass on nothing-checked (74 at authoring time).
  assert.ok(checked >= 60, `only ${checked} defined: paths parsed - the specimen regex has rotted`);
  assert.equal(problems.length, 0, `\n${problems.join('\n')}\n`);
});

test('R7: components-data.ts `css:` selectors name classes that are still live', () => {
  const data = ALL.find(f => f.rel === 'views/components-data.ts');
  assert.ok(data, 'views/components-data.ts not found - did the specimen data move?');
  // The haystack is the whole shell EXCEPT the specimen file: a class that only
  // this file still mentions is precisely the dead one we're hunting.
  const haystack = ALL.filter(f => f.rel !== 'views/components-data.ts').map(f => f.text).join('\n');

  const problems: string[] = [];
  let checked = 0;
  for (const m of data.text.matchAll(/\{ name: "((?:[^"\\]|\\.)*)"[^\n]*?css: "([^"]*)"/g)) {
    for (const cls of new Set((m[2] ?? '').match(/\.[a-zA-Z][\w-]*/g)?.map(c => c.slice(1)) ?? [])) {
      checked++;
      // Bounded on both sides so `.cat-stat` can't be satisfied by `.cat-stat-tile`.
      if (!new RegExp(`[.'"\`\\s]${cls}(?![\\w-])`).test(haystack)) {
        problems.push(`"${m[1]}" → css: ".${cls}" matches nothing in the shell. Update the selector list to the class that replaced it (or delete the specimen if the component is gone).`);
      }
    }
  }
  assert.ok(checked >= 200, `only ${checked} css: classes parsed - the specimen regex has rotted`);
  assert.equal(problems.length, 0, `\n${problems.join('\n')}\n`);
});

// ── R8: specimen form controls carry a class ─────────────────────────────────
// The #/components stage is a bare `.cl-stage` div. A control whose real styling
// hangs off an ancestor the stage doesn't reproduce - `.tool-actions select`,
// say - renders there as raw UA chrome, so the library shows a square, native
// widget next to a description of the drawn one. That is the exact drift this
// page exists to catch, and it is invisible to R7 (which only asks whether the
// classes in `css:` are still live somewhere).
//
// Rule: every form control in a `markup:` specimen names a class. The allowlist
// is for controls deliberately styled by an ancestor selector INSIDE their own
// specimen markup - those are honest, but only while the sheet that declares the
// ancestor rule is imported by views/components.ts, so each entry records which.
test('R8: form controls in components-data specimens are styled, not raw UA chrome', () => {
  const data = ALL.find(f => f.rel === 'views/components-data.ts');
  assert.ok(data, 'views/components-data.ts not found - did the specimen data move?');

  // Controls styled by an ancestor rule in their own specimen markup.
  // key → number of class-less occurrences permitted.
  const ANCESTOR_STYLED: Record<string, number> = {
    // `.input-row input` - parts/tool.css, imported by views/components.ts
    'input type="text" data-input-id="headline" value="Hello"': 1,
    // `.export-dims input[type="number"]` - parts/tool-chrome.css, ditto
  };

  const actual = new Map<string, number[]>();
  const problems: string[] = [];
  let checked = 0;

  for (const m of data.text.matchAll(/markup: `([^`]*)`/g)) {
    const markup = m[1] ?? '';
    const at = lineOf(data.text, m.index ?? 0);
    for (const tag of markup.match(/<(?:select|textarea|input)\b[^>]*>/g) ?? []) {
      checked++;
      if (/\bclass=/.test(tag)) continue;
      const key = tag.replace(/^</, '').replace(/\s*\/?>$/, '').replace(/\s+/g, ' ');
      const bucket = actual.get(key) ?? [];
      bucket.push(at);
      actual.set(key, bucket);
      if (!(key in ANCESTOR_STYLED)) {
        problems.push(
          `views/components-data.ts:${at} - specimen control <${key}> has no class, so it renders as raw UA chrome on the .cl-stage checkerboard. ` +
          `Give it the shared primitive (.field-input / .field-select / .field-check / .field-radio / .field-range), or add it to R8's ANCESTOR_STYLED allowlist naming the sheet that styles it.`,
        );
      }
    }
  }

  assert.ok(checked >= 20, `only ${checked} specimen form controls parsed - the R8 regex has rotted`);
  assert.equal(problems.length, 0, `\n${problems.join('\n')}\n`);
  checkRatchet(actual, ANCESTOR_STYLED, 'Style it with the shared field primitive instead.');
});

// ── R9: every icon glyph is well-formed markup ───────────────────────────────
// lib/icons.ts holds glyph bodies as raw markup STRINGS, so a missing `"/>` is
// not a syntax error in TypeScript - it is a broken attribute that Chromium's
// HTML parser silently recovers from by swallowing the following markup into the
// attribute value. The glyph then does not draw, and anything that RE-SERIALISES
// that DOM (the HTML-to-SVG export walker does, via XMLSerializer) emits invalid
// XML: an attribute whose value contains `</svg><span class=`. That produced a
// 1.1 MB unparseable file with no thrown error and no warning.
//
// `zap` shipped like that. This is the cheap structural check that would have
// caught it: balanced quotes, and one close for every open tag.
test('R9: lib/icons.ts glyph bodies are well-formed (balanced quotes and tags)', () => {
  const f = ALL.find((x) => x.rel === 'lib/icons.ts');
  assert.ok(f, 'lib/icons.ts not found - did the icon registry move?');

  const problems: string[] = [];
  const seen = new Set<string>();
  let scanned = 0;
  // Every shape the registry uses, and both quote styles:
  //   `name: '<path …/>'` - a PATHS entry
  //   `const SHARED = '<path …/>'` - a fragment several entries splice in
  //   `name: \`${SHARED}<path …/>\`` - an entry BUILT from one
  //   `name: SHARED` - an entry that IS one, verbatim
  // Single-quote-literals-only was the rot: `zoomIn`/`zoomOut` are template literals,
  // `MAGNIFIER` is a bare const and `search` became an alias of it, so four glyphs - 
  // one of which used to be covered - fell out of the guard the day they landed.
  // An interpolation is scanned as opaque text; the const it names is scanned on its
  // own line, so nothing goes unchecked.
  const bodies: Array<[string, string, number]> = [];
  const consts = new Map<string, [string, number]>();
  for (const m of f.text.matchAll(/^\s*(?:const\s+)?'?([\w-]+)'?\s*[:=]\s*(['`])((?:[^'`\\]|\\.)*)\2[,;]?\s*$/gm)) {
    bodies.push([m[1]!, m[3]!, m.index ?? 0]);
    if (/^\s*const\s/.test(m[0]!)) consts.set(m[1]!, [m[3]!, m.index ?? 0]);
  }
  for (const m of f.text.matchAll(/^\s*'?([\w-]+)'?\s*:\s*([A-Z][A-Z0-9_]*)\s*,\s*$/gm)) {
    const src = consts.get(m[2]!);
    if (src) bodies.push([m[1]!, src[0], m.index ?? 0]);
  }
  for (const [name, body, index] of bodies) {
    const m = { index };
    if (!body || !body.includes('<')) continue;
    scanned++;
    if (name) seen.add(name);
    const at = lineOf(f.text, m.index ?? 0);
    const quotes = (body.match(/"/g) ?? []).length;
    const opens = (body.match(/<[a-zA-Z]/g) ?? []).length;
    const closes = (body.match(/\/>|<\//g) ?? []).length;
    if (quotes % 2 !== 0) {
      problems.push(`lib/icons.ts:${at} - glyph "${name}" has ${quotes} double quotes (odd, so an attribute is unterminated).`);
    }
    if (opens !== closes) {
      problems.push(`lib/icons.ts:${at} - glyph "${name}" opens ${opens} element(s) but closes ${closes}. Every tag needs \`/>\` or a closing tag.`);
    }
  }

  // Named explicitly, because these four are the ones the old regex silently dropped - 
  // if a future refactor takes them back out of range the count floor alone would not say so.
  for (const must of ['MAGNIFIER', 'zoomIn', 'zoomOut', 'search']) {
    assert.ok(seen.has(must), `R9 no longer scans "${must}" - the glyph regex has rotted again.`);
  }
  assert.ok(scanned >= 60, `only ${scanned} markup glyphs parsed - the R9 regex has rotted`);
  assert.equal(problems.length, 0, `\n${problems.join('\n')}\n`);
});

// ── R10 (raw-HTML sinks) ──────────────────────────────────────────────────────
// maintainability-2026-07-29.md item 3: ~461 innerHTML sites following the
// `escape()` discipline by convention, with nothing pinning it. This is that pin.
//
// WHY A COUNT RATCHET AND NOT A CONTENT RULE. The obvious rule - "every ${…} in a
// raw-HTML template must be escaped" - was measured against the tree first: 508
// interpolations, 134 already wrapped in escape(), and of the remaining 374 the
// overwhelming majority are `t('a literal')`, a nested ternary of literals, a
// CONSTANT, or an `xHtml(…)`/`.map(…).join('')` helper that returns composed
// markup. A rule flagging those would be ~374 false positives on day one and
// would be deleted within a week. So the guard pins the INVENTORY instead: a new
// raw-HTML sink cannot appear without a deliberate allowlist bump, which is the
// moment a reviewer looks at whether its interpolations are escaped.
//
// Empty clears (`el.innerHTML = ''`) are excluded - they are teardown and cannot
// inject. Changing one into a real assignment moves it INTO the count, so the
// exclusion cannot be used to smuggle a sink past the ratchet.
//
// Counts are exact in both directions (see checkRatchet), so deleting a sink is
// an attrition win that must be recorded, and the ledger cannot rot.

// The `\s*` belongs INSIDE the empty-clear lookahead, not before it: as
// `\s*(?!…)` the star backtracks to zero-width, the lookahead then sees a space
// instead of the quote, and `el.innerHTML = ''` counts as a sink. That bug was in
// the first draft of this rule and was caught by the attrition mutation test.
const RAW_HTML_SINK = /\.(?:inner|outer)HTML\s*\+?=(?!=)(?!\s*['"]\s*['"]\s*[;,)])|\binsertAdjacentHTML\s*\(/;

const RAW_HTML_ALLOWED: Record<string, number> = {
  'bridge/clipboard.ts': 2,
  // Ask Lolly (#/ask), plans/103 M0. The 2 sinks are the view scaffold (t()
  // labels + escape()d placeholder/aria/hrefs, the static trusted LOLLY_MARK_SVG
  // brand mark, and the top-right profile link + lib/icons markup - no free text)
  // and the transcript re-render. The
  // transcript interpolates: the user's own question (escape()d), each answer's
  // section HTML (render-md.ts, which escapes everything then re-admits a fixed
  // subset), citation text + hrefs (escape()d), related-record labels/anchors
  // (escape()d), and provider hit titles/subtitles (escape()d) + their
  // lib/icons icon() markup per the SearchHit contract. No raw docs/user text
  // reaches a sink unescaped.
  // The reusable animation transport bar (window.__lollyAnim). Two sinks, both
  // provably static: the bar scaffold (fixed class markup plus icon() registry
  // glyphs from lib/icons.ts - no interpolated value) and the play/pause icon
  // swap (an icon() constant). No user or dynamic data reaches either sink.
  'views/anim-transport.ts': 2,
  'views/ask.ts': 3, // +1 M1 consent chip (plans/103): t()/tRaw() copy + a computed integer, no user input

  // The #/convert view's innerHTML writes interpolate only t() strings, escape()d
  // file names (utils.ts escape), and static in-code format labels/ids - no user
  // markup reaches a sink unescaped. +4 reviewed 2026-08-26: renderVideo (the 153
  // AV column) - a t()-only status line, two convert-none lines (escape()d name),
  // and the target list (escape()d name; TRANSMUX_CONTAINERS ids/exts are in-code
  // constants).
  'views/convert.ts': 7,
  // The convert workbench (plans/203 file operations). Reviewed 2026-09-05: two t()-only
  // refusal lines, the page scaffold (t() labels, escape()d file names/kind, numeric
  // sizes/dimensions, a blob: object URL from urlFor()), the findings list (escape()d
  // t() messages) and the output card (escape()d name/changes/sha256, numeric facts,
  // a blob: URL, t() labels).
  'views/convert-workbench.ts': 5,
  // Saved asset versions modal (plans/203). Reviewed 2026-09-05: the version rows
  // (escape()d name/date/sha256, numeric index + fmtBytes) and the library rows
  // (escape()d name, numeric count/bytes, t() labels).
  'views/asset-versions.ts': 2,
  // Batch history under the convert view (plans/203). Reviewed 2026-09-05: the t()-only
  // heading scaffold, the batch summary (escape()d names/target/date, numeric counts,
  // t() labels) and the member row (escape()d name/findings, t() state label).
  'views/file-batch-history.ts': 3,
  // Recent file operations panel (plans/203). Reviewed 2026-09-05: the scaffold
  // (t() labels + fmtBytes/numeric usage) and the operation rows (escape()d
  // id/name/state/target/date/findings, fmtBytes, t() labels).
  'views/file-operation-history.ts': 2,
  // "Use this copy" actions (plans/203). Reviewed 2026-09-05: one t()-only sink.
  'views/file-result-actions.ts': 1,
  // The detachable inspector controller (plans/208). Reviewed 2026-09-05: a column-bar
  // button's glyph from icon() and the panelGripsHtml() grips - in-code markup only.
  'views/design-inspector-float.ts': 2,
  // The spreadsheet (data) view. Reviewed 2026-08-07: the 4 sinks are the static page
  // scaffold (t() labels + static DOWNLOAD_TARGETS id/label), the limits banner
  // (escape()d LIMITS_HTML + escape()d truncated note), the sheet tabs (escape()d sheet
  // names + numeric/boolean attrs), and the read-error banner (escape()d message) - all
  // user-data interpolations go through escape() (utils.ts).
  'views/data.ts': 3,
  // The in-app docs reader (#/docs, M2 Phase 1). All four sinks are safe: the view
  // scaffold (shellHtml - t() labels + lib/icons markup, no free text), the error banner
  // (escape()d message + an escape(url)'d open-the-docs link), the language switcher's
  // glyph (the TRUSTED LANG_ICON_SVG constant), and the full-width toggle's glyph (a
  // TRUSTED lib/icons string; its label is an aria attribute, never HTML). The rehosted
  // /info page fragment is injected as a PARSED node (DOMParser), not via a sink, and
  // has its <script>/<style>/.listen-bar stripped.
  // +1 2026-08-21: the AI-scan donut (donut.innerHTML) - fixed SVG markup whose only
  // interpolations are a clamped integer score, toFixed() arc lengths and the
  // analyser's closed band union (escape()d anyway); its label is an aria attribute.
  'views/docs.ts': 5,
  // The Transcript panel (right dock, plans/174). Two sinks, both TRUSTED lib/icons
  // constants: the close-button glyph and makeActBtn's toolbar-button glyph. The flowing
  // transcript words, the title and every label are set via textContent - no user/model
  // string reaches a sink.
  'views/transcript-panel.ts': 2,
  // The in-app docs "Try it" hydration (M3). One insertAdjacentHTML sink: a TRUSTED
  // static icon (lib/icons.ts glyph string) appended to the pill; the label beside it is
  // set via textContent, never interpolated as HTML. No user/manifest string reaches a sink.
  'lib/docs-tryit.ts': 1,
  // 1 as of 2026-08-09: the non-camera animated-SVG live source. `start()` inlines the
  // armed markup into an off-screen host so its CSS/SMIL actually ticks and `grabAnim`
  // can sample it - the same reason views/anim-svg-mount.ts inlines rather than uses an
  // `<img>`, and the same sanitiser covers it: the only producer (views/tool.ts's
  // `prepareMarkup`) gets its markup from `fetchAnimSvg`, which pipes every fetched byte
  // through `sanitizeSvgToString` before it is cached. The one thing done to it
  // afterwards is substituting the computed `--brand-primary` into its own
  // `var(--brand-primary, …)` fallbacks - a design-token colour, not free text.
  'bridge/media.ts': 1,
  'bridge/embed.ts': 1,
  'components/color-field.ts': 6, // System-picker fallback uses the constant, escaped icon('palette') renderer.
  'components/custom-slider.ts': 1,
  // The virtual data grid (spreadsheet view). Reviewed 2026-08-07: the 3 sinks are the
  // static viewport scaffold (no interpolation), the header cells (esc()d column names +
  // numeric width/index attrs), and the row cells (esc()d cell text + numeric row/col/
  // width attrs) - esc() escapes &<> and is used only in text content, so no user markup
  // reaches a sink unescaped.
  'components/data-grid.ts': 3,
  'components/featured-row.ts': 2,
  'components/fonts-manager.ts': 3,
  'components/headshot-cropper.ts': 1,
  // homeFabEl()'s single icon-injection sink - the argument is a constant
  // lib/icons 'home' glyph, never user input (same shape as theme-toggle.ts /
  // sound-toggle.ts). The string form homeFabHtml() rides its host view's own
  // template sink and adds nothing here.
  'components/home-fab.ts': 1,
  'components/instance-sheet.ts': 1,
  'components/lang-menu.ts': 2,
  'components/modal.ts': 1,
  'components/music-player.ts': 5,
  // neuro-dock.ts lost its one sink in the @lolly-tools/audio-dock migration (Phase 2b,
  // 2026-08-15): the dock DOM is now built by createAudioDock (in the package, outside
  // this scan); this module only toggles classes + wires the shell's option callbacks.
  // 3 → 2, 2026-08-28: mountProfileFab and createProfileControl now share one
  // paintProfileMark helper (its `link.innerHTML = markHtml` is the single sink),
  // so the mark FAB and the pill both paint the trusted LOLLY_MARK_SVG mark - no
  // more per-caller sink. Reviewed: markHtml is either that module-level constant
  // (lib/lolly-mark.ts) or `<span…>${LOLLY_MARK_SVG}</span>`, its only interpolation,
  // and the later headshot swap is an <img> built by createElement, not HTML. The
  // other sink is attachProfileMenu's static menu scaffold.
  'components/profile-menu.ts': 2,
  'components/profiles-manager.ts': 3,
  // The persistent bar singleton's one render (plans/99 M1): a template.innerHTML of
  // footerNav()+gallerySearchBox() markup, whose only dynamic interpolations - 
  // placeholder/aria-label/value from the view's claim - are escape()d inside
  // gallerySearchBox (footer-nav.ts); the nav links are literal routes + t() labels.
  'components/search-bar.ts': 1,
  // The .lolly share dialog's licensed-content choice panel. Its one sink writes a
  // warning + two buttons whose only interpolations are a NUMBER (the licensed-asset
  // count, Math.max-clamped) and fixed literal fragments ('it'/'them', 'asset'/'assets')
  // chosen by ternaries on that number - no user text reaches the sink.
  'components/share-dialog.ts': 2, // +1 2026-09-08: the export-panel share surface (mountSharePanel) fills with the same shell-composed markup as the modal path
  // The row list's innerHTML replace, modelled on profiles-manager.ts. Reviewed - 
  // every interpolated value (digest, name, fact line, reported-speech claim,
  // priced-summary) goes through escape() in rowHtml.
  'components/rate-cards-manager.ts': 1,
  'components/sound-toggle.ts': 2,
  // The spotlight overlay's one sink (plans/99 M2): renderResults' listbox
  // replace. Reviewed 2026-08-09 - every interpolation is escape()d (row hrefs,
  // hit titles/subtitles), a t() literal (group labels, see-all, the empty
  // line - t() escapes its params, so the query text is covered), a NUMBER
  // (the option ids), or provider-authored lib/icons icon() markup per the
  // SearchHit contract; the panel scaffold itself is built with DOM APIs.
  'components/spotlight.ts': 1,
  'components/theme-toggle.ts': 1,
  // The guide dialog's track panel, re-rendered on a tab switch. Its only
  // interpolations come from inlineMarkup(), which escape()s the manifest string
  // and then re-admits `**bold**` alone.
  'components/tool-guide.ts': 1,
  'components/view-toggle.ts': 2,  // +1 2026-08-20: injectJellyIcons' ic.innerHTML - ICONS registry glyphs only (trusted, never user text), prepended into the jelly pill's open shadow buttons
  'components/viz-overlay.ts': 5,
  'components/welcome-dialog.ts': 3,  // +1 2026-08-23: mountBrandedIntro's strip.innerHTML (plans/140 S4) - literal copy; the one interpolation is docsAppHref('start/quickstart'), a constant route string
  'components/zoom-hud.ts': 1,
  'folder-overlay.ts': 3,
  'lib/audio-coaching.ts': 1,
  'lib/audio-transport.ts': 2,
  // The Custom CSS editor (plan 112 M4): the highlight overlay writes highlightCss(text),
  // whose one job is to HTML-escape the source (& < >) before wrapping tokens in spans, and
  // the autocomplete menu writes rows from the curated CSS_PROPERTIES list - never a raw user
  // value. Two provably-safe sinks.
  'lib/css-code-editor.ts': 2,
  // The shared tile context menu's one sink: the popover body - moved here from
  // views/projects.ts (10 → 9) when the mechanism was extracted. It writes only
  // what the consuming view's singleHtml/bulkHtml callbacks return, which is
  // menuItemHtml() rows (escape()d act + label, lib/icons markup) plus each
  // view's own reviewed head markup - the same content the projects sink held.
  'lib/context-menu.ts': 1,
  // 22 → 24, plan 97 M1 (2026-08-08): the Replace-palette review card renders
  // its own two states (the "what changes" list, and the collapsed "replaced,
  // Undo" line). Every interpolated value is either a developer-authored t()
  // string or a NUMBER counted off the two documents - no swatch name, notation
  // or other user text reaches either sink.
  // 24 → 25, plan 97 M3 (2026-08-09): the Logos room's confirm-chip queue
  // (renderIntake). Reviewed - the chip markup interpolates t()/tRaw() literals,
  // a fixed variant key from LOGO_ORIENTATIONS × LOGO_TREATMENTS, an in-code
  // candidate key (`belg<n>`), and escape()d values for everything else: the
  // preview blob: URL, the dropped FILE NAME (in the line, its title and the
  // dismiss aria-label), the classifier's reason fragments, and the variant
  // label. The hostile input here is a dropped file's own name, and it reaches
  // the sink only through escape() (utils.ts). The room's OTHER new markup adds
  // no sink: the drop zone rides the existing root.innerHTML scaffold, and the
  // trim card is mounted by lib/design-system/trim-offer.ts, which carries its
  // own entry above.
  // 25, unchanged 2026-08-09: the M2 fix pass only lifted the Colours room's
  // existing add-a-colour write into a named function and put it on the handle
  // (`addColors`), which writes tokens, never markup.
  // 25, unchanged 2026-08-09 (M3 fix pass): the chip queue's fixes add no sink.
  // renderIntake gained a prune step and a focus hand-off (both DOM APIs:
  // dropCandidate + element.focus()); the chip markup gained one attribute,
  // `tabindex="-1"`, which is a constant; and the new size gate reuses
  // installLogo's own sentence through tRaw() into showLogoErr's textContent.
  // 25, unchanged 2026-08-09 (M4 fix pass): the Type room's role card now takes
  // BOTH of its button strings from one helper (typeRoleActStrings) so the
  // visible label and the accessible name cannot drift apart (WCAG 2.5.3). The
  // scaffold's aria-label is still the same shape it was - escape(tRaw(…)) over
  // an in-code role label - and the later rewrite of both strings goes through
  // textContent and setAttribute, neither of which is a sink.
  // 25, unchanged 2026-08-09 (M5 fix pass): paintLogos's own sink (the logo
  // sections + the add-identity form) is unchanged; the fix moved it behind the
  // liveness check that already guarded it, so the mark hand-off is no longer
  // drained into a room that went away mid-paint. Nothing new is interpolated,
  // and the shared-tray option carries no markup at all.
  'lib/brand-editor.ts': 1,
  'lib/brand-editor/type.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/brand-editor/swatch-editor.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/brand-editor/state.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/brand-editor/shared.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/brand-editor/replace.ts': 4,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/brand-editor/ramps.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/brand-editor/logos.ts': 3,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/brand-editor/logo-intake.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/brand-editor/grid.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/brand-editor/derive.ts': 6,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  // The tonal-curve editor's one sink is draw()'s full panel re-render. Reviewed
  // 2026-08-08: every interpolated value is either a constant (channel labels,
  // the curve glyph, viewBox numbers, role/tabindex), a NUMBER (aria-valuemin/max/
  // now, cx/cy), or escape()d (baked hex backgrounds, point titles, the aria
  // label/valuetext) - no user markup reaches the sink unescaped. The keyboard-
  // operability pass (feature #6) added the per-point ARIA slider attributes here
  // but no new sink: the roving tabindex + value changes go through setAttribute.
  'lib/curve-editor.ts': 1,
  'lib/catalog-summary.ts': 2,
  // The Colours room's "Add a colour" control (plan 97 section 7.1). Two sinks, both
  // reviewed 2026-08-08: the row scaffold (t() literals and an icon() constant,
  // with every attribute value escape()d - the placeholder and all three
  // aria-labels), and the found-colours chip row, whose only interpolations are
  // a NUMBER (the chip index), a boolean aria-pressed, and escape()d values (the
  // resolved hex before it reaches a style attribute, and the notation as the
  // person typed it). Pasted text is the hostile input here and it never reaches
  // either sink unescaped - and under that, the scanner's own token charset
  // admits no `<`, `>`, quote or backslash in a reported value at all, which
  // add-color.test.ts pins directly.
  'lib/design-system/add-color.ts': 2,
  // The Design-system studio's Overview room (plan 97 section 5). Its one sink is
  // paint()'s whole-room re-render from overviewHtml(). Reviewed 2026-08-08:
  // every interpolated value is a t() literal, an icon() constant, or escape()d
  // (utils.ts) - the door/card helpers escape their area key, label and value,
  // the palette strip escapes each swatch hex before it reaches a style
  // attribute, and the font list is escaped as one card value.
  'lib/design-system/rooms/overview.ts': 1,
  // The Design-system studio's Versions panel (plan 97 section 6a, M7). Its one sink is
  // paint()'s whole-panel re-render from the pure versionsHtml(). Reviewed
  // 2026-08-09: the hostile input here is the user's own version LABEL and NOTE,
  // and both are escape()d (utils.ts) wherever they appear - the list row, the
  // ahead banner and the restored line all go through t()'s own param escaping,
  // which is the same escape(). The slug is grammar-constrained by the engine
  // (design-version.ts: [a-z0-9][a-z0-9-]*) and is escape()d anyway on every
  // data attribute and focus key; the diffed token PATHS and pinned asset IDS
  // come out of the user's document and are escape()d per row; the counts and
  // the byte total are numbers and fmtBytes output. Everything else is a t()
  // literal. Deliberately ONE sink: the live slug line, the error line and the
  // busy states are all textContent/disabled/hidden, because a repaint on every
  // keystroke would take the caret with it.
  // 1, unchanged by the M7 fix pass (2026-08-09). Re-reviewed: the plural strings
  // became two whole t() calls each (so the translation extractor can see them),
  // the publish buttons gained an aria-describedby naming a static id, and the
  // storage sentence was reworded. All three are t() literals and a constant id;
  // aria-invalid and the announced refusal are setAttribute/announce(), not
  // markup, so no value newly reaches the sink and the count does not move.
  'lib/design-system/rooms/versions.ts': 1,
  // The Colours room's roles strip (plan 97 section 7.1). Its one sink is
  // mountRolesStrip's render() from the pure rolesStripHtml(). Reviewed
  // 2026-08-08: every interpolated value is a t()/tRaw() literal or escape()d
  // (utils.ts) - the role id, label, value line and its title, the swatch hex
  // before it reaches the `--sw` style property, the APCA title and readout,
  // and every <option>/<optgroup> key, name and group heading.
  'lib/design-system/roles.ts': 1,
  // The candidate tray's panel (plan 97 section 8, M2). Two sinks, reviewed 2026-08-09:
  // the mount scaffold (t() literals and icon() constants, with both aria-labels
  // escape()d) and the candidate list, which is the pure trayHtml(). Everything
  // interpolated in the second is a t() literal, an icon() constant, a NUMBER
  // (the group count), a fixed candidate-type key, or escape()d - the candidate
  // id on every data attribute, the value before it reaches the `background`
  // style property and the dismiss aria-label, the colour name, and the
  // provenance label and detail. The hostile input here is a scanned source's
  // own file name riding the provenance chip, and tray-ui.test.ts pins that it
  // reaches neither sink as markup - including the chip's `title`, which now
  // carries that file name on every row and is escape()d whether or not the
  // candidate also has a provenance detail.
  'lib/design-system/tray-ui.ts': 2,
  // The trim-to-content offer (plan 97 section 7.3, M3). One sink, reviewed 2026-08-09:
  // mountTrimOffer's card scaffold, written once and thereafter updated only
  // through textContent and img.src. Its interpolations are t() literals, one
  // icon() constant, NUMBERs (the stepper bounds and its start value), and
  // escape()d strings - the two preview blob: URLs, the pad field id, the unit
  // suffix, the dimension readout and the group aria-label. The file names and
  // bytes a hostile upload carries never reach the sink: a name is only ever
  // read into a File constructor, and the previews are object URLs the browser
  // minted, not paths.
  // 1, unchanged 2026-08-09 (M3 fix pass): the same single scaffold grew a
  // cancel ✕ (an escape(t(…)) aria-label/title plus a &#x2715; entity), two
  // generated element ids (escape()d - `trimo-savings-<n>` / `trimo-after-dims-<n>`
  // off an in-module counter, used again in aria-describedby) and the two
  // readouts' OPENING text, both escape()d: a t() sentence with a NUMBER param,
  // and a dimension string built from numbers. Everything after mount still goes
  // through textContent and img.src.
  'lib/design-system/trim-offer.ts': 1,
  // The Type room's compare stage (plan 97 section 7.2, M4). Two sinks, reviewed
  // 2026-08-09: the mount scaffold - t() literals, icon() constants, the NUMBER
  // size bounds, and escape()d strings for the generated field ids, the file
  // input's accept list and the opening specimen text (which is either the
  // design system's OWN NAME, read off the tokens asset, or a t() pangram) - and
  // the card row, which is the pure compareCardsHtml(). Everything interpolated
  // in the second is a t() literal, an icon() constant, a fixed state key, an
  // in-module card id, or escape()d: the family (in the line, the two Remove
  // labels and the id), the candidate's label, every chip (source chips are
  // authored by whatever scanned them), the provenance, the reason sentence, the
  // specimen text as the person typed it, and the preview family before it
  // reaches a `font-family` style property - which is doubly guarded, since
  // slugFamily()'s output charset is [a-z0-9-] and cannot close the quote.
  // type-compare.test.ts pins the hostile-input case directly.
  // 2, unchanged 2026-08-09 (M4 fix pass): the card sink grew ATTRIBUTES, not
  // interpolations of a new kind - `tabindex="-1"` (a constant), an aria-label
  // that is the escape()d family, and an aria-describedby whose ids are built
  // from the card's own preview family (slugFamily + two integers, so [a-z0-9-]
  // throughout). The escaping DISCIPLINE changed in the same pass and is the
  // part worth recording: a string that reaches the sink through `t()` is no
  // longer escape()d again, because t() already escapes its interpolated params
  // (i18n.ts) and doing it twice put "&amp;amp;" in an accessible name. Nothing
  // became unescaped - every value still passes through exactly one of the two,
  // and the source-authored chips (the untrusted ones) are still the escape()d
  // side. type-compare.test.ts now drives the module with the SHARED escape in
  // its `t` double, so a re-fork of either discipline fails there.
  'lib/design-system/type-compare.ts': 2,
  // One provably-safe sink: the collapsed rail's per-panel icon button (constant icon()
  // markup, no interpolation), same as the export panel's head glyphs below.
  'lib/edge-dock.ts': 1,
  // Two provably-safe sinks: the two head buttons' glyphs (constant icon() strings,
  // no interpolation) and the resize grips (constant panelGripsHtml(), like float-panel).
  'lib/export-panel-float.ts': 2,
  'lib/float-panel.ts': 2,
  'lib/gamut-slider.ts': 1,
  'lib/page-filmstrip.ts': 1,
  'lib/recent-stack.ts': 1,
  'lib/recording-tips.ts': 2,
  // The revert path of an on-canvas cell edit: restores the element's OWN
  // pre-focus innerHTML (engine-rendered markup captured on focus), no
  // interpolation of user text.
  'lib/table-canvas-edit.ts': 1,
  // 3 → 2, plan 97 M3 fix pass (2026-08-09): attrition. The zone had TWO copies
  // of the same `.updz-text` idle restore (one per terminal path of the ingest
  // loop); both are now one `finally` in runIngest, which also makes the restore
  // cover a throw - a zone left wearing `.is-busy` has pointer events off and
  // refuses every later drop. What remains: the mount scaffold, and that single
  // restore, which writes back innerHTML this module itself captured off the
  // zone at the start of the ingest. The pass's other fixes touch no sink (a
  // `disposed` latch, the single-flight try/finally, and a skipped file when the
  // user dismisses the trim card).
  'lib/upload-dropzone.ts': 2,
  'org/approval-dialog.ts': 3,
  'org/banner.ts': 1,
  // Reviewed 2026-08-02: every interpolated value is escape()d (text, link label,
  // link href, the Dismiss aria-label); safeHref() drops javascript:/data: schemes
  // before an anchor is built at all; and the only unescaped interpolation is
  // `accent`, a two-literal ternary with no user input in it.
  'org/chrome.ts': 1,
  // Reviewed 2026-08-24 (1 → 4, the gate's device-code option, plans/145): the
  // gate card itself (unchanged review - t() escapes its params, the action is
  // safeHref-gated); the device slot's idle button and note() are static markup
  // plus t() strings with no interpolated params; the code display interpolates
  // the server's verificationUri through a t() param (escaped by t()) and the
  // user code through escape().
  'org/index.ts': 4,
  'org/share-links.ts': 4,
  'pro/blocks-editor.ts': 4,
  'pro/folder-export.ts': 2,
  // 10 as of 2026-07-31: +1 for the run-level print-settings popover (openPrintPopover).
  // Reviewed - its only interpolations are escape(t(…)) labels, escape()d CMYK
  // condition ids/labels, and a parsed bleed number; the checkbox states are booleans.
  'pro/index.ts': 10,
  'pro/render-export.ts': 1,
  // 9 as of 2026-07-31: +2 for the retry's failure line, which writes into whichever
  // .pro-log is LIVE (the retry rebuilds the mount, so the element this run captured may
  // already be detached) and falls back to a fresh list. Reviewed - both interpolate
  // one value, the caught message, through this module's esc().
  'pro/run-overlay.ts': 9,
  // 10 as of 2026-08-05: +2 for inline crop mode (enterInlineCrop) - the crop-box
  // overlay `work.innerHTML` and the `cropActions` row. Reviewed: the box/handle
  // markup is static; every interpolated value is escape()d (the image src, the
  // format radio value/label, and the Format/Cancel/Download crop t() strings).
  // 10, unchanged 2026-08-09 (plan 97 M3 fix pass): inline TRIM mode writes no
  // markup of its own - the card is trim-offer.ts's sink, mounted into an empty
  // div - and the fix only taught the dialog's capture-phase Escape handler to
  // answer for a card that focus had left.
  // +2 2026-08-21 (any-media read parity): the pdf/vector read-text branch's two
  // [data-tsig] box.innerHTML fills - notes are escape()d t() lines, the extract
  // goes through catHighlightHtml + catTextSignalsHtml (the reviewed escaped-
  // template family), no raw user text reaches markup.
  // +1 2026-08-21 (plans/136 W2a): the [data-passport] fill - lampStripHtml
  // escape()s every value, chips are escape()d licence strings/t() constants.
  'views/catalog.ts': 1,  // +1 2026-09-02 (plans/129 section 2.3): openSendDialog's per-target status line - the remote url is safeHref()-gated and escape()d, the label escape()d; +1 2026-08-21 (plans/132 WP-M): the mount-time loading skeleton (viewEl.innerHTML) - static markup, the only interpolation is a repeated constant tile string, no user text; +1 2026-08-20 (WP-G): the [data-usage] Used-in fill - labels escape()d, mirrors the [data-tech] sink; +1 2026-08-20: the Download-as toolbar menu (body-popover render `el.innerHTML`) - format values/labels are constants (plus the escape()d source format), no user text; +1 2026-08-18: interpBtn.innerHTML = INTERP_ICON - a trusted inline SVG constant, no interpolation; +2 2026-08-18 (plans/125): the [data-tsig] box (renderTextPanel, catTextWorkHtml escape()s every value) + read-text - the read-text <pre> is filled via textContent, never markup; +1 2026-08-18 (plans/126 markdown reading view): setTextRenderMode's [data-md-rendered] fill - user markdown through lib/markdown mdToHtml then DOMPurify.sanitize, the same pairing doc-editor's paste path uses; 2026-08-19 (inline-edits UX pass): the analyse-text fill folded into renderTextPanel, and the freed slot is openEditCard's card.innerHTML - sugCardHtml/rwCardHtml escape() every interpolated value
  'views/catalog/details-sheet.ts': 9,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/catalog/details-shared.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/catalog/details-panels.ts': 4,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/catalog/details-inline-modes.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/catalog/wiring.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/catalog/shared.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/catalog/sections.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/catalog/downloads.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'lib/job-toast.ts': 2,   // +2 2026-08-17 (plan 124 WP-F): the pill + panel innerHTML - title/note/id/count all ESC()d
  'lib/perf-hud.ts': 1,    // +1 2026-08-18 (perf-hud flag): root.innerHTML = scaffold() - only icon() glyphs + tRaw() strings, no interpolated values; the live FPS number is written via textContent, not markup
  'views/video-job-dialog.ts': 1, // +1 2026-08-18 (plan 124 WP-G): the Resolution <select> rebuild (resSel.innerHTML) - resOptionHtml() emits a numeric px value + an escapeHtml()d "{px}p" label, no user text
  'views/grade-inline.ts': 1, // +1 2026-08-20: the still-grade mode's work.innerHTML - static controls; every interpolation is escapeHtml()d (t() labels, the whitelisted PRESET_LUTS ids/labels, format values)
  // The authenticated-capture sign-in panel (url-shot, desktop only). Four sinks -
  // the head, the sign-in button, the clear button, and the active-session status - 
  // each interpolating only icon() registry glyphs (lib/icons.ts) and t() literal
  // labels. No user or page-supplied text reaches any sink (the URL is only ever
  // passed to the native invoke, never rendered).
  'views/capture-signin.ts': 4,
  // 21 as of 2026-08-08: +2 for the Colour Lab's vector (SVG) stills (feature #7).
  // renderSolidSvg writes ONE engine-produced gamutSolidToSvg string (numeric
  // <polygon>s only, no user text) into the snapshot panel; renderCompare writes
  // ONE string of two <figure> cells - each an escape()d constant gamut title plus
  // an engine SVG - into the compare body. No user markup reaches either sink.
  // (19 previously: +1 for renderCvdMatrix, feature #4 - the APCA contrast matrix,
  // whose only interpolations are escape()d hexes/names/title/band plus a Number Lc.)
  'views/color-lab.ts': 21,
  'views/components-data.ts': 1,
  'views/components.ts': 8, // +1 2026-09-06: the reference block's fill (components-reference.ts output, every value escape()d)
  'views/components-examples.ts': 1, // shared bulkBarHtml renderer with literal demo actions; all labels escaped by the renderer
  // The cost card's body replace. Reviewed - costBodyHtml (views/cost-panel.ts)
  // escape()s every interpolated value: line/calc/amount cells, the source and
  // disclaimer sentences, and the total/headline strings. Rule 6/9's honesty
  // sentences are t()-sourced, never raw money.
  'views/cost-panel.ts': 1,
  // 12 as of 2026-09-04: the storage-probe failure replacement is a fixed
  // `cat-empty` paragraph containing only t('unavailable'). It adds no data
  // interpolation; the ordinary storage renderer remains responsible for
  // escaping measured/device values before it reaches its own sink.
  'views/dashboard.ts': 12,
  'views/deck-editor.ts': 9,
  // 2 as of 2026-09-02 (new file: the Design editor's top bar, plan 179 M1). One is
  // the VERBATIM re-insert of the shell's own `backHomeHtml()` island, which the bar
  // is handed as a string and must not re-author (mountBackPill finds
  // `[data-back-pill]` wherever it sits). The other is the file's single `icBox()`
  // glyph wrapper, shared by every button and menu row: its input is always
  // `icon()` output from lib/icons.ts or the static LOLLY_MARK_SVG. The document
  // name, the zoom readout and every menu label are `textContent`, never a sink.
  'views/design-topbar.ts': 2,
  // 2 as of 2026-09-02 (new file: the Design editor's right-hand inspector, plan 179
  // M2). The second is the column head's close button, whose input is the STATIC
  // `icon('close')` registry string with nothing interpolated into it at all.
  // The first is `render()`, which rebuilds the section list; the rest of the column
  // scaffold is built with createElement precisely so this stays a short list.
  // Reviewed against the rule above: the section heading is `escape(sectionTitle(…))`,
  // `sec` is a fixed InspectorSection union, the glyph is `icon()` registry markup,
  // and the body comes from the shared row builders (views/free-canvas-fields.ts),
  // whose interpolations are t() copy, manifest-declared field ids and select values,
  // numbers, or `escape()`d - the same composed-markup helper category the note at
  // the top of this rule measured. The one place DOCUMENT text reaches the column -
  // the text/notes rows - is `escape(String(value ?? ''))` at both the attribute and
  // the textarea child, so the attacker-shaped half of the input is covered.
  'views/design-inspector.ts': 2,
  'views/doc-editor.ts': 1,
  // 1 as of 2026-07-31: applyPreflight writes the "Before you export" card body.
  // Reviewed - every value at that sink comes from preflightBodyHtml, which
  // escape()s each one: the finding text (which carries brand token data, an
  // OPEN FinishKind union and tool-authored input labels, all attacker-shaped),
  // the finding id, and both halves of every fact row.
  // 1 as of 2026-08-26: the grouped format picker's refresh() rebuilds the
  // category accordion after a setFormats narrowing. Reviewed - format ids and
  // labels are escape()d, category labels are escape(t(…)) literals, and the
  // chevron comes from the shared icon() generator.
  'views/export-format-picker.ts': 1,
  'views/export-preflight.ts': 1,
  // 41 as of 2026-08-07: +1 for the Line tool's drawLineRubber (connectLayer.innerHTML,
  // plan 90) - coordinates via cf2 (numbers), colour via cAttr (strips <>"), and the
  // arrowhead via edgeArrowHead which escAttr-escapes its fill; no user markup reaches it.
  // 43 as of 2026-08-09: +2 for the Artboards panel (Colour Lab work) - both writes
  // interpolate only escape(t(…)) headings, escape()d frame ids, numeric indices and
  // icon(SVG.*) constants; no user markup reaches them.
  // 43, UNCHANGED by plan 96 P0-P2 (2026-08-09 - the unified path primitive). Three of
  // these sinks gained content and none was added:
  //   · the stroke panel (p.innerHTML) grew the Dash array field, the corner-fit toggle
  //     and the two arrowhead menus. Every interpolation is escape()d - the stored dash
  //     string, the cfg field names used as data attributes, escape(t(…)) labels - and
  //     the head <option> values are HEAD_CHOICES, a module constant, not box data.
  //   · the pen layer (penLayer.innerHTML) grew penEditHeadsSvg, whose markup is built by
  //     the engine's edgeArrowHead from numbers plus the literal 'currentColor'; nothing
  //     off the box reaches it.
  //   · drawLineRubber (connectLayer.innerHTML) is the same write it was, with the colour
  //     now cAttr(drawnInkHex()) - a computed hex - instead of a manifest default.
  // 44 as of 2026-08-09 (plan 96 P3-P5 - endpoint binding). Net +1 over three changes to
  // the SAME connectLayer.innerHTML family, all of them reviewed:
  //   · −1: drawConnectRubber went with Connect mode (P4 deleted the mode outright).
  //   · +1: setBindHover writes the snap ring over the box an end would attach to. Four
  //     cf2() numbers off the box's own rect and otherwise literal markup - the box id
  //     itself never reaches it, only its geometry.
  //   · +1: drawLiveConnectors' bound-path branch writes drawLiveBoundPaths(), which is
  //     built entirely by the ENGINE's routedLineSvg from a ConnectorDecor whose one
  //     string-valued field, `color`, is cAttr()'d here AND escAttr()'d again inside the
  //     engine; every other value is a number or one of the six whitelisted head keywords.
  //     No box text, id or user markup can reach it.
  // 44 → 47 as of 2026-08-12 (plans/104 section 7, "Lift layers"). Three writes to the ONE
  // dialog panel this action opens - its reading state, its refusal state and its plan - 
  // reviewed together because they are three renders of the same node:
  //   · every interpolated value is escape()d: the title, the enumerator's own warning
  //     sentence, the per-layer label and shape count, and the two button words. The
  //     counts are numbers formatted by t(); the warnings come from the engine's own
  //     fixed vocabulary and are escaped anyway.
  //   · the only non-escaped interpolation is icon(SVG.check) - a module constant, the
  //     same provably-safe markup every other sink in this file already carries.
  //   · NOTHING from the artwork reaches the dialog: the layer LABEL is an index this
  //     file mints ("Layer 3"), never a name out of the SVG, which is exactly the
  //     ingest-time PII strip section 7 relies on and also what keeps this sink inert.
  // 47 → 50, 2026-08-14 (plan 112 M4/M5): the Custom CSS, Frame state, and Speaker notes
  //   panels each render one `p.innerHTML` of escape()d values + t() strings + static icon()
  //   markup - the same provably-safe shape the other panel sinks in this file carry.
  // 50 → 51, 2026-08-19 (plan 112 M4, per-box `cls`): the CSS class panel is a FOURTH render
  //   of that same shape - one `p.innerHTML` whose only document-sourced value is the box's
  //   current class string, escapeHtml()d, beside two t() strings and a static placeholder.
  // 51 → 52, 2026-09-01 (plans/104 P4, "Choreograph"): the showcase picker's ONE
  //   `p.innerHTML`. Nothing from the document reaches it - the six card labels, subs and
  //   ids come from the module-scope CHOREO_SHOWCASES table, the glyphs are icon(SVG.*)
  //   constants, and the only computed value is the selected-box COUNT, an integer
  //   formatted by t(). Every string interpolation is escape()d anyway.
  // 53 → 54, 2026-09-02 (design-import artboards/scenes): askImportPages, the drop door's
  //   page-mode question. One `p.innerHTML` of escape()d t() strings; the only dynamic
  //   value is the page COUNT, an integer formatted by t(); class strings are constants.
  'views/free-canvas.ts': 2,   // +1 2026-09-02: openMorphMatchPanel (escapeHtml'd value + t() strings, the fstate/notes panel pattern)
  'views/free-canvas/toolbox.ts': 5,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/text-edit.ts': 11,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/pen-tool.ts': 3,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/menus.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/gradient.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/field-panels.ts': 10,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/edges.ts': 3,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/document.ts': 5,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/dialogs.ts': 8,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/context-bar.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/free-canvas/connectors.ts': 3,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  // present-mode.ts (plan 112): the presenter's chrome sinks - the pause button, the mute
  //   button and the two nav-button builders - are each `el.innerHTML = icon(name, opts)`, a
  //   static glyph string from lib/icons' PATHS registry with NO interpolated value. Nothing
  //   from a document or user reaches them.
  // 3 → 4, 2026-09-03 (plans/180): syncMuteBtn, the volumeOn/volumeOff swap on the mute
  //   control a self-playing narrated deck owes its audience (WCAG 1.4.2). Same shape as
  //   syncPauseBtn beside it - one registry glyph, no value.
  'views/present-mode.ts': 4,
  // 6 → 8, 2026-08-09 (the lazy-chunk pass): two lazy-mount injections joined the
  // six standing sinks - the bulk bar now lands via insertAdjacentHTML of
  // lib/bulk-bar.ts's bulkBarHtml() (labels/titles/ids all escape()d inside the
  // shared builder), and the sound segment mounts into its [data-sound-slot] via
  // components/sound-toggle.ts's soundSegmentHtml() (t() literals + static
  // markup). Both write module-built, reviewed markup only - no view-side
  // interpolation reaches either sink.
  // 8 → 7, 2026-08-22: the sound segment left the filter popover (Sound/Neurospicy are
  // app-level prefs, and the /profile sound card is their home), taking its sink with it.
  'views/gallery.ts': 7,
  'views/multi-edit.ts': 3,
  // 6, unchanged 2026-08-09 (plan 97 M5 - the design-system hand-offs). The three
  // new controls are markup inside the existing report template, not new sinks:
  // the font row's "Add to the design system" and the mark's "Send to Logos" are
  // t() literals plus a numeric index, and every state they later show (Adding…,
  // Added, Could not add) is written through textContent.
  // 6, unchanged by the M5 fix pass (2026-08-09): the hand-off handlers gained
  // busy/failure states and honest counts, all of them textContent or announce()
  // (a live region is a text sink, not an HTML one). "Send to Logos" reports its
  // two failures the same way, and the mark filenames now come off the pick's
  // own index rather than a match on its SVG text - neither reaches markup.
  'views/pdf-extract.ts': 6,
  'views/pdf-import.ts': 1,
  // 27, unchanged 2026-08-09 (plan 97 M3 fix pass): the upload flow's trim offer
  // adds no sink (the card is trim-offer.ts's own, mounted into the existing
  // `.asset-picker-trim` slot); the fix made offerTrim's answer nullable so a
  // dismissal stores nothing.
  // +2 2026-08-20 (plans/134): the Recent section (recentsEl.innerHTML - card() output,
  // every value escapeHtml()d) and the type-pill bar (typebarEl.innerHTML - constant
  // labels through t(), no user text).
  // +1 2026-08-27: renderUserAssets split its single `userEl.innerHTML = sectionHtml(…)`
  // into two sinks - the empty state (t() literals only, no interpolation) and the
  // folder-grouped grid. Reviewed: the grid's only dynamic values are the folder name
  // (escapeHtml()d), the t('Ungrouped') heading, and userCard() output, the same card
  // builder the flat list already used.
  // Camera markup moved unchanged to picker-webcam; labels are translated literals.
  'views/picker.ts': 29,
  'views/picker-webcam.ts': 1,
  // Personal send targets (plans/129): the connections section body. One sink; every
  // dynamic value (labels, provider kind, account names, scopes notes, field values)
  // goes through escape() in oauthRowHtml/credentialRowsHtml, the rest is t() output.
  'views/profile-connections.ts': 1,
  // Device sync (plans/138 B1): two sinks, the no-provider state and the form.
  // Reviewed - every dynamic value is escape()d (provider kind + label, the stored
  // passphrase) or t() output; the rest is static markup. The section is a sub-block
  // of Connected services since 2026-08-23, but it kept its own module and sinks.
  'views/profile-sync.ts': 2,
  'views/profile.ts': 19,  // +1 2026-07-31: the Offline-tools download manager list (loadOffline) - ids/names escape()d, sizes via fmtBytes, glyphs via icon(); +1 2026-08-17: the "Save my renders" auto-save toggle (jelly-switch) - label + id escape()d; 23 → 18 2026-08-19: "Export everything" became a background job (lib/batch-job.ts), so its five progress-toast writes are gone - the global job toast reports it now; +1 2026-09-03: the Appearance card's "Interface follows the design system" row (plans/182 SS5.6) re-rendered when the Jelly flag flips, exactly as the a11y and render-save lists beside it are - the row is a t() label and an escape()d id, no user data
                           // +1 2026-08-01: the offline persistence line (syncPersistLine) - both t() strings escape()d, the button markup is static
  'views/projects.ts': 9,   // 10 → 9: the context-menu popover sink moved to lib/context-menu.ts (2026-08-09)
  // 6 → 7, 2026-08-27: the choose-microphone stage button's glyph injection,
  // `micBtn.innerHTML = icon('mic', { size: 18 })`. Reviewed: icon() is the shared
  // trusted glyph generator (lib/icons.ts PATHS constant, R9-guarded), the name is a
  // literal, and nothing else about the button is written as HTML - its label, title
  // and aria-label are setAttribute/property writes.
  'views/record-control.ts': 7,
  'views/screen-capture-control.ts': 4,
  // 3 as of 2026-08-02: the Script-audio TTS dialog. Reviewed - the shell
  // template escape()s every attribute interpolation (the rest are static t()),
  // the voice list escapes id/name/lang, and the preview sink writes
  // audioTransportHtml(), which escapes its labels internally.
  'views/script-audio.ts': 3,
  // 5 as of 2026-08-02: the Script-audio writing view (#/script). Reviewed - 
  // both mount templates escape() every attribute interpolation (the rest are
  // static t()), the voice list escapes id/name/lang, the preview sink writes
  // audioTransportHtml() (labels escaped internally), and the saved line's one
  // interpolation is the freshly minted asset id, encodeURIComponent + escape()d.
  'views/script-studio.ts': 5,
  // The Design-system studio (plan 97). 7, unchanged by the M2 fix pass - 
  // reviewed 2026-08-09: the two view scaffolds and the editor-error line (t()
  // literals, escape()d error text), the result sink `importResult.innerHTML`
  // (every caller composes with escape()/t(), and the one refusal helper escapes
  // its plain-text argument), and the phone palette sheet's scaffold + its two
  // repaints, which write swatchTile() markup the shared helper escapes. The
  // mapping card's follows row is updated through textContent and style, not a
  // sink, which is why re-deriving surface/text added none.
  // 8 as of 2026-08-09 (plan 97 M5, the PDF source): +1 for renderPdfResult, the
  // PDF stage's own result card. Reviewed - the only values from the document are
  // the file name and each embedded face's family, both escape()d; the face chips
  // go through faceChipText (a switch over the source's own tokens, escape()d on
  // the way out); the counts are numbers through t(); everything else is a t()
  // literal. Its three later states (Adding…, Added, Could not add) are written
  // with textContent, and the picker's stages are still a pure `hidden` toggle.
  // 8, unchanged by the M5 fix pass (2026-08-09): renderPdfResult is the same
  // sink with two strings reworded (the page-window line, which interpolates two
  // numbers through t()) and a spoken summary added - announce() is a text sink,
  // so the card's facts are said without any of them re-entering markup.
  // 8, unchanged by the M7 fix pass (2026-08-09): the Versions rail entry became
  // a latch (`versionsOffered`), which moves a boolean into `hidden` and touches
  // no sink, and the panel context dropped a dead `label` string.
  // 9 as of 2026-08-09 (plan 97 M6, the website source): +1 for renderSiteResult,
  // the website stage's own result card. This is the most hostile input the view
  // takes - every string in it came off a third-party page - so what reaches the
  // sink is listed here: the HOST (escape()d), the site's own NAME and the
  // Google FAMILIES it asks for, both through t(), which escapes its params
  // (i18n.ts); the counts are numbers through t(); everything else is a t()
  // literal. Nothing else from the page reaches markup at all - the colours go
  // to the tray (whose own sink is pinned above), the marks travel as File
  // objects, and the scan's machine reasons and warnings are mapped to t()
  // sentences by siteRefusalText/siteWarningText before they are shown. The
  // stage's own markup adds no sink (it rides the one mountModal template, and
  // the `?u=` prefill is assigned to input.value, never interpolated), and every
  // later state - the consent line, the button label, the progress note, the
  // Reading…/Named/Could not name it labels - is textContent.
  // 9, unchanged by the M6 fix pass (2026-08-09). Four changes, none of them a
  // sink: the website stage's template gained one static `<p>` (the refusal line
  // the field names through aria-describedby - no interpolation at all, its text
  // arrives later through textContent); the refusal itself moved from the shared
  // note to that element via textContent + setAttribute('aria-invalid'), which is
  // strictly less markup than before; the consent and failure sentences swapped
  // tRaw() for t() wherever the only parameter is a hostname or a number, which
  // ADDS escaping rather than removing it (the two whose parameter is free text
  // off the page stay tRaw, and both are written to textContent); and the
  // extension-transport adapter was deleted outright in favour of the bridge's.
  // +2 on 2026-09-04 (plans/186): the "Editing <label>" line under the studio header and
  // the read-only page for a locked design system - the label is escape()d in both, the
  // rest is t() copy and fixed links.
  'views/start.ts': 8,
  // Moved from start.ts: static sheet shell and escaped swatchTile()/group labels.
  'lib/design-system/palette-sheet.ts': 3,
  // 1 as of 2026-08-09 (new template-chooser overlay, Design frame primitive). The
  // one innerHTML sink is the dialog scaffold: escapeHtml()'d toolName, static t()
  // markup, and the blankTile/groupsHtml composed-markup helpers; no raw input.
  'views/template-chooser.ts': 1,
  // 5 as of 2026-07-31: every sink here writes icon() markup from lib/icons.ts
  // (own SVG bodies, guarded by R9) - no interpolated data at any of them.
  // 5 → 7 on 2026-08-11 (the clip inspector's grouped disclosure, plans/104 section 8):
  // the two new sinks are the group header's glyph and its caret, both
  // `el.innerHTML = icon(<literal registry name>)` with no interpolation at all - 
  // the same class as the five above. Every VALUE the new headers show (the group
  // label, the summary chips) goes through textContent, deliberately: the chips
  // carry model-derived strings, and an authored `cubic-bezier(…)` curve is user
  // text arriving from a share URL.
  // 8 → 9 on 2026-09-03 (plans/179 M4, the Motion group's "Preview this motion"
  // button): `play.innerHTML = icon('play')` - a literal registry name, nothing
  // interpolated. Its visible name is a t() string set through .title and
  // .setAttribute('aria-label'), never through markup.
  // 8 as of 2026-08-07: +1 for the badged/per-option-formats export-picker work
  // (schemas' badge/formats option fields); confirmed safe by the author.
  // 8 → 9 on 2026-08-11: the deterministic live-drive export path paints the exact
  // frame before capture via `drvNode.innerHTML = html`, where `html` is the engine's
  // own runtime.applyFrameForExport() output - logic-less-Handlebars rendered markup
  // (auto-escaped by the template layer), not raw user/peer/tool input. Same trusted
  // rendered-markup class as the other sinks here.
  // 9 → 11 on 2026-08-18: the cloud send-target card (lib/send-target.ts seam) -
  // renderSendTargets() rebuilds the per-format card list, and the delegated click
  // handler writes the provider's outcome link into the status line. Every
  // interpolated value in both sinks is escape()d (kind/label/hint/actionLabel from
  // the registered SendTarget, and the outcome url/label); icon() is the shared
  // trusted glyph generator.
  // 11 → 13 on 2026-08-26: the "Your recording" card for audio-capture tools -
  // paintRecording() writes the empty-state hint and the take's save-actions row.
  // Reviewed: every interpolation is a t()/tRaw() literal through escape(), the
  // container extension comes from takeNativeExt (a fixed three-way map), and the
  // size string is locally formatted digits. No user/peer/tool value reaches
  // either sink unescaped.
  'views/tool-actions.ts': 1,
  'views/tool-actions/wiring.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool-actions/video.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool-actions/sequence.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool-actions/markup.ts': 3,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool-actions/copying.ts': 4,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool-actions/audio.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  // 9 → 11, 2026-08-27: the table input's ghost-row promotion (a blank placeholder row
  // that gains content becomes real in place, without waiting for the panel rebuild).
  // Two sinks: the row's delete-button cell, whose only interpolations are the numeric
  // `tr.sectionRowIndex`; and the freshly appended placeholder row, built cell-by-cell
  // by the SAME tableBodyCellHtml() the panel render uses - it escape()s the field id,
  // the column name and the value (here the '' constant), and tableColumnEditor()
  // clamps the editor kind to a fixed three-way enum. No tool or user text reaches
  // either sink unescaped.
  'views/tool-inputs.ts': 11,
  // 1 as of 2026-08-27: the stage zoom HUD's drag grip. The pill is all buttons, so the
  // grip is the one drag surface, and its sink is `grip.innerHTML = icon('grip',
  // { filled: true })` - the shared trusted glyph generator with a literal name, no
  // interpolation. Everything else the HUD writes is textContent/classList/style.
  'views/tool-stage-nav.ts': 1,
  // 16 → 17 on 2026-08-09: the canvas "Play" button gained the same two-span label the
  // "Go live" button beside it already had (`<span class="canvas-live-dot">` +
  // `<span class="canvas-live-label">`). Reviewed - both spans are static markup and the
  // only interpolation is a `t()` literal, which escapes its own params; there is no
  // user, peer or tool-supplied value anywhere in either sink.
  // 17 → 15 on 2026-08-10: both live-toggle sinks LEFT this file - the Go live/Play
  // buttons moved into views/live-controls.ts, which builds them with
  // createElement/textContent and has no raw-HTML sink at all.
  // 15 → 16, 2026-08-14 (plan 112): openPresenter mounts a detached `presentSource` whose
  // innerHTML is `runtime.getHydrated()` - the tool's OWN rendered template output (the same
  // engine render the canvas shows), escaped by Handlebars, never a raw external value.
  // 16 → 15, 2026-08-27: attrition - the sidebar's small lang-fab
  // (`group.insertAdjacentHTML('beforeend', langFabHtml())`) is gone; the canvas HUD's
  // profile avatar opens the consolidated menu, which carries the Language row.
  // +1 on 2026-09-04 (plans/186): the "Switched to <name>" notice inserted on a
  // design-system switch (the "Made with" one rides the existing sidebar markup). The
  // name is the record's label through escape(); the rest is t() copy and fixed ids.
  'views/tool.ts': 6, // ratcheted 16->15 2026-09-08: an interpolated sink moved into an escaped renderer
  'views/tool/stage-layout.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool/setup.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool/session.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool/render.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool/popovers.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool/history.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool/design-system.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/tool-history-controls.ts': 1, // 2026-09-08: el.innerHTML = icon(glyph), glyph an undo/redo/history literal (icon-registry markup, no user data)
  'views/history.ts': 2, // 2026-09-08: shared backHomeHtml() escaped navigation chrome, and icon() with fixed registry names; all history captions use textContent
  // 21 as of 2026-07-31: +2 deep-scan watermark notes (trustmarkNoteHtml,
  // contentSealNoteHtml). Reviewed - every attacker-controlled value on this
  // page (decoded payload/message hex, schema, filenames, hex dumps of file
  // bytes, handoff notes) is escape()d at its sink; the rest are static t().
  // 23 as of 2026-08-09: +2 for the re-render-after-claim path (rerenderClaimed) - 
  // listWrap.innerHTML = bodyHtml and the multi-file card rebuild. Same discipline:
  // summaryInner escape()s the filename (${escape(fileName)}), bodyHtml reuses
  // renderReportBody, and the static parts are t() strings.
  // +1 2026-08-21 (any-media read parity): readVectorText's [data-ocr-result]
  // fill - textSignalsHtml (reviewed escaped family) + one escape()d note line.
  // +1 2026-08-21 (plans/136 W2b): the signed report card's OFFSCREEN node fill
  // - every interpolated value passes through escape() (heroName/verdict/lamp
  // labels read back from OUR rendered DOM, then re-escaped anyway).
  'views/valid.ts': 27,  // +1 2026-08-18 (plans/125): readImageText's [data-ocr-result].innerHTML = textSignalsHtml(...) - that helper escape()s every interpolated value (band/kind titles, the highlighted extract via escape()d segments, guess, summary), no user text reaches markup; +1 2026-08-19 (plans/126): readDocumentText's same [data-ocr-result] sink for the PDF text-layer read - textSignalsHtml again, plus a page-cap note whose only interpolations are escape()d t() output and two numbers
  // 1 as of 2026-08-21 (plans/126 WP-A): the model-tier re-render, host.outerHTML
  // = render(panel), where render is the OWNING view's own panel builder
  // (textSignalsHtml / catTextSignalsHtml), the exact escaped-template family the
  // panel was first painted with; the estimate row's own values arrive through
  // the engine's finding detail and are escape()d there like every other row.
  // Everything else in the file is createElement/textContent.
  'views/tsig-model-note.ts': 1,
  // 3 as of 2026-08-06 (the model warning became an inline banner). Reviewed: the
  // panel build escapeHtml()s every interpolated value - the model <option> id/name
  // pairs, both aria-labels - the options sink escapeHtml()s id + label, and the new
  // warning sink writes an icon() constant plus escapeHtml()'d warning text
  // (`${icon('info',…)}<span>${escapeHtml(warn)}</span>`), never raw input.
  'views/upscale-dialog.ts': 3,
  // 1 as of 2026-08-04 (new file, the host.matte Remove-Background dialog). The
  // one innerHTML sink is the panel scaffold: every interpolated value is a t()
  // literal or escapeHtml()'d (the aria-labels, the model <option> id/name pairs);
  // all later writes are textContent / setAttribute, never HTML.
  'views/matte-dialog.ts': 1,
  // 1 as of 2026-08-19 (plan 124 WP-E, the inline Retouch mode). The one innerHTML
  // sink is the toolbar/stage scaffold (Cancel + the primary live inside it): every
  // interpolated value is a t() literal or escapeHtml()'d; all later writes are
  // textContent / setAttribute / canvas paints, never HTML.
  'views/retouch-inline.ts': 1,
  // 1 as of 2026-08-19 (plan 130, the inline video grade/trim mode). The one sink is
  // the mode scaffold (tabs + mode bar + panels): every interpolated value is a t()
  // literal or escapeHtml()'d, and sliderRow's numeric params are number-typed. All
  // later writes are textContent / value / setAttribute / canvas paints, never HTML.
  'views/video-edit-inline.ts': 1,
  // 1 as of 2026-08-09 (plan 100 section 11.27, the private-collab QR skin). The one sink
  // is `qrElementRenderer`'s `box.innerHTML = svg.value`, and the markup is this
  // module's OWN output: `renderQrSvg` builds it from the matrix it just computed,
  // and every caller-supplied option that reaches it (the colours, the label) is
  // XML-escaped by `toSvg` before it is written. The invite text itself never
  // reaches the sink - it is encoded into modules, not interpolated - and the box's
  // own attributes are a class constant plus a clamped INTEGER width.
  'collab/qr-skin.ts': 1,
  // 1 as of 2026-08-09 (the beam consent/progress toast). Its `render()` has three
  // innerHTML writes and two are the empty clear the rule deliberately exempts; the
  // one sink is `container.innerHTML = renderCard(...)`. Reviewed: the hostile input
  // here is entirely PEER-supplied - the offer name, the peer's display name and the
  // per-item label - and each reaches the markup only through `escape()` (utils.ts),
  // as does every t()/tRaw() sentence composed around them. The rest are numbers
  // (byte counts, aria-valuenow/max, the percentage width) and static class names.
  'components/beam-toast.ts': 1,
  // 1 as of 2026-08-09: the export shutter's brand mark stopped being an `<img>`
  // whose src was read out of `--lolly-logo` and became an inline SVG so its layers
  // can counter-spin. `mark.innerHTML = SHUTTER_MARK_SVG` interpolates NOTHING - it
  // is a module-level string constant in lib/shutter-mark.ts, the same shape as the
  // icon() bodies R9 guards. The mark's brand tone is applied through a CSS custom
  // property afterwards, not by rebuilding the markup.
  'lib/shutter.ts': 1,
  // 1 as of 2026-08-09 (new file: the `[data-anim-src]` enhancer that inlines an
  // animated SVG so it is seekable and frame-addressable). Its one sink is
  // `el.innerHTML = clean`, and `clean` is the ONLY thing it can be: the awaited
  // result of `fetchAnimSvg`, which pipes every fetched byte through
  // `sanitizeSvgToString` (bridge/svg-sanitize.ts - scripts, `on*` handlers,
  // `javascript:` refs and `<foreignObject>` stripped) before it is cached. Inlining
  // untrusted SVG is exactly why the sanitiser is on the fetch rather than the mount:
  // there is no path to this sink that skips it.
  'views/anim-svg-mount.ts': 1,
  // 1 as of 2026-09-01 (new file: the shaped-glyph enhancer behind split text's letter
  // tier, plans/175 WP-D). Its one sink is `word.insertAdjacentHTML('beforeend',
  // glyphSvgMarkup(...))`, and every interpolated value in that markup is a NUMBER or
  // HarfBuzz output: `d` is SVG path data the shaping engine emitted from a font file
  // (digits, spaces, `MLCQZ,.-`), `start`/`end` are integers, the box and baseline
  // are rounded floats. The word's TEXT never reaches the sink - it is shaped, not
  // interpolated; the text stays in its (hidden) spans. A font file is the only
  // external input, and it is fetched from the registry, not from the document.
  'views/glyph-split-mount.ts': 1,
  // 2 as of 2026-09-04 (new file: the Profile view's "Design systems" card, plans/186
  // section 5). Both sinks render the card body: every record id and label goes through
  // escape(), the source line is escape()d as a whole, and the rest is t() copy and
  // icon() markup. Nothing a record carries reaches the sink raw.
  'lib/design-system/design-systems-card.ts': 2,
  // Local-content checklist: every device-owned name/detail is escape()d;
  // keys are numeric indices and the three group names are constants.
  'lib/design-system/brand-download.ts': 1,
  // 10 as of 2026-09-04: the Tokens room adds one complete Lolly UI starter-role
  // preview. Token paths, current values and controls all reach it through escape();
  // its actual brand write stays in the delegated submit handler below the sink.
  'lib/brand-studio-tabs.ts': 10,
  'views/timeline-panel/helpers.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/timeline-panel/inspector-pane.ts': 4,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/timeline-panel/menus.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/timeline-panel/playback.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
  'views/timeline-panel/rows.ts': 2,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
};

test('R10: raw-HTML sinks are a pinned inventory, not a growing one', () => {
  const found = new Map<string, number[]>();
  for (const f of TS) {
    const hits = hitLines(f.text, RAW_HTML_SINK);
    if (hits.length) found.set(f.rel, hits);
  }
  // Non-vacuity: the regex must still find the tree it was written against.
  const total = [...found.values()].reduce((n, l) => n + l.length, 0);
  assert.ok(total > 300,
    `only ${total} raw-HTML sinks found - RAW_HTML_SINK has rotted and this guard is passing vacuously`);
  checkRatchet(found, RAW_HTML_ALLOWED,
    'A new raw-HTML sink needs review: every interpolated value must be escape()d ' +
    '(utils.ts) or provably safe markup. If it is right, bump this file\'s allowlist entry.');
});

// ── R11 (one escaping implementation) ────────────────────────────────────────
// The reason R10 can be a count ratchet rather than a content rule is that
// `escape` (utils.ts) is a single, correct implementation everyone reaches for.
// That only holds while nobody re-forks it - and forking it is not hypothetical:
// pro/index.ts carried its own `escapeHtml` whose character class was [&<>"],
// missing the SINGLE QUOTE that utils.ts escapes. Every one of its 19 call sites
// happened to sit in a double-quoted attribute, so it was not exploitable - but
// the next `data-x='${escapeHtml(v)}'` would have been. It was deleted on
// 2026-07-30 in favour of the shared escape, which that file already imported.

const ESCAPE_DEF = /\bfunction\s+escape(?:Html|Text|Attr)?\s*\(|\bconst\s+escape(?:Html|Text|Attr)?\s*=\s*\(/;

const ESCAPE_DEF_ALLOWED: Record<string, number> = {
  // The one shared implementation. Everything else must import this.
  'utils.ts': 1,
  // A deliberate zero-import primitive: float-panel.ts imports nothing but its
  // own CSS, so it inlines an escape that is character-for-character equivalent
  // to utils.ts's ([&<>"'] - the single quote included). Verified equivalent, not
  // assumed; if it ever diverges it becomes a fork and should import instead.
  'lib/float-panel.ts': 1,
  // A local alias that immediately DELEGATES to the shared escape
  // (`function escapeHtml(s) { return escape(s); }`), kept because the file's
  // 6.8k lines call it by that name. Not an independent implementation.
  'views/free-canvas/keys.ts': 1,   // free-canvas's escapeHtml wrapper, moved with the keys module (2026-09-09 split)
};

test('R11: HTML escaping is implemented once (utils.ts escape), never re-forked', () => {
  const defs = new Map<string, number[]>();
  for (const f of TS) {
    const hits = hitLines(f.text, ESCAPE_DEF);
    if (hits.length) defs.set(f.rel, hits);
  }
  checkRatchet(defs, ESCAPE_DEF_ALLOWED,
    "Don't re-implement HTML escaping - `import { escape } from '<...>/utils.ts'`. " +
    'A hand-rolled one drifts: the pro/index.ts fork omitted the single quote and ' +
    "would have injected inside any single-quoted attribute.");
});

test('R11: the shared escape covers every character an attribute or text node needs', () => {
  // The ratchet above says "one implementation"; this says that one is correct.
  // & < > " ' - the omission that made the pro/index.ts fork dangerous was "'".
  const src = ALL.find(f => f.rel === 'utils.ts')?.text ?? '';
  assert.ok(src.includes('export function escape'), 'utils.ts no longer exports escape');
  for (const ch of ['&', '<', '>', '"', "'"]) {
    assert.ok(src.includes(`'${ch}'`) || src.includes(`"${ch}"`) || (ch === "'" && src.includes('"\'"')),
      `utils.ts escape does not mention ${ch} - an unescaped ${ch} breaks out of an attribute`);
  }
  assert.match(src, /&#39;|&apos;/, "escape must map the single quote to an entity (the pro/index.ts fork's omission)");
});

// ── R12 (plan 97 section 8 - one candidate tray per mounted studio) ─────────────────
// `createTray` is a MODEL, not a connection: each instance holds its own
// in-memory candidate list and persists that whole list on every write
// (lib/design-system/tray.ts), so two live instances over `start.tray.v1` do not
// merge - the later write erases whatever the other one added, and neither one's
// subscribers ever hear about it. That is exactly what happened between the
// studio's own tray and the Logos room's private one: a mark placed between two
// source scans put candidates into storage that vanished on the next scan and
// never appeared in the panel. The room now takes the host's tray
// (BrandEditorOptions.tray) and only falls back to its own when there is none.
//
// A ratchet rather than a ban: a view that mounts no other tray may legitimately
// make one (the #/pdf exploder does, in a view where nothing else is live). What
// must not happen quietly is a SECOND one inside a surface that already has one.

const TRAY_CREATE = /\bcreateTray\s*\(/;

const TRAY_CREATE_ALLOWED: Record<string, number> = {
  // The studio's one tray, created before the editor mounts and handed to it.
  'views/start.ts': 1,
  // A different view with no tray of its own: the exploder loads, adds and
  // navigates away, so nothing else is holding the key while it writes.
  'views/pdf-extract.ts': 1,
  // The fallback for a host that supplied none. Unreachable from #/start, which
  // always passes its own - see the short-circuit asserted below.
  'lib/brand-editor/logos.ts': 1,   // 2026-09-09: moved verbatim out of the parent view by scripts/split-closure.ts
};

test('R12: the candidate tray is created once per surface, and the Logos room takes the host\'s', () => {
  const creates = new Map<string, number[]>();
  for (const f of TS) {
    if (f.rel === 'lib/design-system/tray.ts') continue;  // the factory itself
    const hits = hitLines(f.text, TRAY_CREATE);
    if (hits.length) creates.set(f.rel, hits);
  }
  checkRatchet(creates, TRAY_CREATE_ALLOWED,
    'A second live Tray over start.tray.v1 erases the first: each instance persists its ' +
    'whole in-memory list. Take the one the surface already has (pass it down) instead of ' +
    'creating another.');

  // The fallback must stay a fallback. Without this line brand-editor builds its
  // own tray even when the host handed one over, which is the two-instance bug.
  // lib/brand-editor.ts is an orchestrator plus feature modules under lib/brand-editor/ (2026-09-09 split)
  const editor = TS.filter(f => f.rel === 'lib/brand-editor.ts' || f.rel.startsWith('lib/brand-editor/')).map(f => f.text).join('\n');
  assert.match(editor, /if\s*\(opts\.tray\)\s*return opts\.tray;/,
    "lib/brand-editor.ts must prefer the host's tray (opts.tray) before creating one of its own");
});

// ── R13: no literal NUL byte anywhere in the source ──────────────────────────

test('R13: no source file carries a literal NUL - one makes the whole file "binary" to grep', () => {
  // A U+0000 written as a RAW BYTE (rather than the `\u0000` escape) makes grep/rg
  // classify the ENTIRE file as binary: it prints nothing without `-a`. Every guard,
  // audit, codemod and agent that shells out to grep then silently skips that file - 
  // and the one that hit this in practice was the largest in its milestone's diff.
  //
  // The sentinel pattern being protected is legitimate and used in several controllers
  // ("a memo key no real key can equal"); it just has to be written as the ESCAPE. The
  // string value is identical, so this is a spelling rule with no runtime effect.
  const NUL = '\u0000';
  // The surveyed state of 2026-08-11. Every entry is a place where the NUL is the
  // DATUM rather than a spelling choice - a separator chosen because no name can
  // contain it, a placeholder chosen because no input can contain it, or binary magic
  // bytes under test. They predate this rule and are grandfathered, not endorsed: an
  // entry may be deleted the day its file stops needing one. What the rule stops is a
  // NEW file going grep-blind for want of six characters.
  const NUL_ALLOWED = new Set([
    'bridge/pdf-structure.ts',                  // compound Map key: name + NUL + bytes
    'lib/beam-sink.test.ts',                    // ditto, in a test's dedupe key
    'org/collab-protocol.ts',                   // the lock-key separator, throughout
    'lib/markdown.ts',                          // CODE_MARK - a placeholder the input cannot contain
    'lib/markdown.test.ts',                     // …and the test that feeds it one anyway
    'lib/design-system/add-color.test.ts',      // binary fixture bytes
    'lib/design-system/trim-offer.test.ts',     // RIFF / BMP / ftyp magic under test
    'lib/drop-router.test.ts',                  // PK zip headers under test
  ]);
  const bad = ALL.filter((f) => !NUL_ALLOWED.has(f.rel) && f.text.includes(NUL))
    .map((f) => `${f.rel}:${lineOf(f.text, f.text.indexOf(NUL))}`);
  assert.deepEqual(bad, [], 'write \\u0000 instead of the byte, so the file stays greppable');
});

// ── R14: the meta-only annotation write stays meta-only ──────────────────────
// _uploadUserAsset is the INGEST write: it runs the version-pin preserver
// (which silently freezes a duplicate of any pinned asset) and meters the blob
// against quota. Both are right for new bytes and wrong for an annotation (the
// AI-signals note, declare-AI-origins), which adds none - routing one through
// the ingest path minted frozen copies and could spuriously trip STORAGE_FULL
// near quota. bridge/assets.ts._updateUserAssetMeta is the annotation write, a
// plain read-modify-put at the storage layer. This rule holds it in both
// directions: the primitive must not grow the ingest effects back, and the
// catalog's two annotation sites must not fall back to re-uploading the record.

test('R14: _updateUserAssetMeta runs neither pin-preserver nor quota check, and the annotation sites use it', () => {
  const assets = TS.find(f => f.rel === 'bridge/assets.ts')?.text ?? '';
  const start = assets.indexOf('async _updateUserAssetMeta(');
  assert.ok(start > -1, 'bridge/assets.ts must define _updateUserAssetMeta (the meta-only annotation write)');
  // The body only: from the declaration to the next method's doc comment, so
  // neither this method's own doc nor its neighbours' can leak into the scan.
  const end = assets.indexOf('/**', start);
  assert.ok(end > start, 'scan slice: another documented method should follow _updateUserAssetMeta');
  const body = assets.slice(start, end);
  assert.doesNotMatch(body, /preservePinned|assertQuotaRoom/,
    '_updateUserAssetMeta must not run the pin-preserver or the quota check: a meta rewrite adds no bytes and must never freeze a pinned duplicate');
  // views/catalog.ts is an orchestrator plus feature modules under views/catalog/ (2026-09-09 split)
  const catalog = TS.filter(f => f.rel === 'views/catalog.ts' || f.rel.startsWith('views/catalog/')).map(f => f.text).join('\n');
  assert.ok(hitLines(catalog, /host\.assets\._updateUserAssetMeta\(/).length >= 2,
    'views/catalog.ts: persistAiSignals and declare-ai-origins both annotate via _updateUserAssetMeta, never a whole-record re-upload');
});

// ── R12 (plans/172 P0): chrome-scale token ratchets ──────────────────────────
// The 2026-08-29 audit measured the style sprawl (346 distinct box-shadows, 216
// font sizes, 112 radii); plans/172 minted tokens for the recipes underneath
// (tokens.css @generated-chrome-tokens, fed by shells/web/design/
// chrome-tokens.json) and migrated the worst sheets. These counts pin what
// REMAINS. Both directions fail on purpose: above the pin means a new literal
// went in where a token exists (use var(--shadow-*)/var(--edge*)/var(--fs-*)/
// var(--radius-*) - or add a token to chrome-tokens.json if a genuine new
// recipe emerged); `--ui-edge` / `--ui-elevation` / `--ui-effect` are the
// semantic aliases exported to Penpot, with the same status as their legacy
// foundation names. Below the pin means someone migrated more - good - and the
// pin ratchets DOWN with the commit, so the debt can never quietly regrow.
//
// Exclusions mirror the migration's own scope: docs.css + docs-landing.css are
// inlined into the static /info site where tokens.css never loads;
// vendor-flatpickr.css is vendored; perf-ui.css strips effects wholesale;
// tokens.css declares the tokens themselves.
const R12_EXCLUDE = new Set([
  'styles/docs-landing.css', 'styles/parts/docs-landing.css', 'styles/parts/docs.css',
  'styles/vendor-flatpickr.css', 'styles/parts/perf-ui.css', 'styles/tokens.css',
]);
const R12_CSS = CSS.filter(f => f.rel.startsWith('styles/') && !R12_EXCLUDE.has(f.rel));

const R12_RATCHETS: Array<{ what: string; pin: number; count: (text: string) => number; fix: string }> = [
  {
    what: 'box-shadow declarations with no chrome token in them',
    // 349 → 323 on 2026-09-04: semantic `--ui-*` elevation roles now power
    // buttons, fields, shared surfaces, topbar popovers, and the repeated
    // content-pattern tiles/rows rather than leaking compatibility shadows.
    // 323 → 322: the component library now consumes the shared floating elevation.
    // 322 → 321: the workspace-chrome specimens took theirs from the part sheets too.
    // 321 → 319: Design panel/thumbnail shadows use semantic elevations.
    pin: 319,
    count: (t) => [...t.matchAll(/box-shadow:\s*([^;}]+)/g)]
      .map(m => m[1]!.trim())
      .filter(v => v !== 'none' && !/var\(--(?:ui-(?:edge|elevation|effect)|shadow|edge|ring-focus|bevel)/.test(v)).length,
    fix: 'compose the semantic var(--ui-edge*) + var(--ui-elevation-*) roles (see styles/parts/surfaces.css), or add a real new recipe to shells/web/design/chrome-tokens.json',
  },
  {
    what: 'whole-value px border-radius literals',
    // 123 → 103 on 2026-09-04: semantic Lolly UI radius roles now cover
    // repeated tile, row, badge, dashboard-stat, and design-workspace shapes.
    // 102 → 101 on 2026-09-05: the convert workbench/history sheets use the
    // derived --radius-sm/--radius-md roles instead of new 8px/12px literals.
    // 101 → 100: the library uses semantic radii throughout.
    // 100 → 98: Design panel and thumbnail-cell radii use semantic tokens.
    pin: 96,
    count: (t) => (t.match(/border-radius:\s*\d+(?:\.\d+)?px\s*[;}!]/g) ?? []).length,
    fix: 'use var(--radius-xs|sm|md|lg) (derived from --radius) or var(--radius) for the base panel size',
  },
  {
    what: 'font-size calc(<len> * var(--a11y-fs)) boilerplate',
    // 445 → 444 on 2026-09-03: `.be-added-gen` retired with the post-add chip's
    // handover LINK (plan 182 section 3a - the generate offer is a panel now,
    // `.be-generate-cta`, which is on screen for the whole of beat 1 rather than
    // a link a dismiss takes away with it).
    // 444 → 443 on 2026-09-03: `.be-logo-empty` took var(--fs-sm). An empty logo
    // slot says "Not set" in the muted register now (plan 182 section 4.2), so
    // the 1.6rem literal that drew a "+" glyph has nothing left to size.
    // 443 → 442 on 2026-09-05: the convert workbench, template chooser, profile,
    // gallery, editor and inspector sheets moved onto var(--fs-2xs..xl).
    // 442 → 426: the component library uses the semantic type hierarchy.
    pin: 426,
    count: (t) => (t.match(/font-size:\s*calc\(\s*[\d.]+(?:px|rem)\s*\*\s*var\(--a11y-fs\)\s*\)/g) ?? []).length,
    fix: 'use var(--fs-2xs..xl) - the multiplier is inside the token, so the largeText contract holds by construction',
  },
  {
    what: 'whole-value 999px / 50% border-radius literals',
    pin: 0,
    count: (t) => (t.match(/border-radius:\s*(?:999px|50%)\s*[;}!]/g) ?? []).length,
    fix: 'use var(--radius-pill) / var(--radius-round)',
  },
];

test('R12 (plans/172): chrome-token literals only ever ratchet down', () => {
  for (const r of R12_RATCHETS) {
    const n = R12_CSS.reduce((sum, f) => sum + r.count(f.text), 0);
    assert.ok(n <= r.pin,
      `${r.what}: ${n} found, pin is ${r.pin} - a new literal appeared where a token exists. ${r.fix}`);
    assert.ok(n >= r.pin,
      `${r.what}: ${n} found, pin is ${r.pin} - migration progressed; ratchet the pin DOWN to ${n} in this test so the win is locked in`);
  }
});

test('R12 (plans/188): app navigation reads semantic Lolly UI roles', () => {
  const projects = CSS.find(f => f.rel === 'styles/parts/projects.css')?.text ?? '';
  for (const role of [
    '--ui-color-surface-muted', '--ui-color-border-default', '--ui-color-selection-surface',
    '--ui-radius-panel', '--ui-radius-control', '--ui-elevation-control',
    '--ui-motion-feedback', '--ui-motion-navigation',
  ]) assert.ok(projects.includes(role), `projects.css: view toggle must read ${role}`);

  const dock = CSS.find(f => f.rel === 'lib/edge-dock.css')?.text ?? '';
  for (const role of [
    '--ui-color-surface-canvas', '--ui-color-selection-border', '--ui-color-focus-ring',
    '--ui-radius-choice', '--ui-elevation-sheet', '--ui-motion-standard',
  ]) assert.ok(dock.includes(role), `edge-dock.css: dock navigation must read ${role}`);
});

test('R13 (plans/188): reusable content patterns read semantic Lolly UI roles', () => {
  const required: Array<[string, string[]]> = [
    ['styles/parts/folders.css', [
      '--ui-color-surface-raised', '--ui-color-border-default', '--ui-color-selection-surface',
      '--ui-radius-card', '--ui-radius-choice-round', '--ui-elevation-control', '--ui-motion-feedback',
    ]],
    ['styles/parts/saved-list.css', [
      '--ui-color-surface-canvas', '--ui-color-surface-muted', '--ui-color-selection-surface',
      '--ui-radius-panel', '--ui-radius-choice-round', '--ui-motion-feedback',
    ]],
    ['styles/parts/projects.css', [
      '--ui-color-selection-border', '--ui-color-text-muted', '--ui-radius-control',
    ]],
    ['styles/parts/dashboard.css', [
      '--ui-color-surface-canvas', '--ui-color-surface-muted', '--ui-color-selection-surface',
      '--ui-radius-panel', '--ui-radius-surface', '--ui-edge-strong',
    ]],
    ['styles/parts/profile.css', [
      '--ui-color-selection-surface', '--ui-radius-panel', '--ui-radius-choice-round',
    ]],
  ];
  for (const [rel, roles] of required) {
    const text = CSS.find(f => f.rel === rel)?.text ?? '';
    for (const role of roles) assert.ok(text.includes(role), `${rel}: reusable content patterns must read ${role}`);
  }
});
