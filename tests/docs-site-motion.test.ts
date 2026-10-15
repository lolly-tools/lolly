// SPDX-License-Identifier: MPL-2.0
/**
 * The /info site chrome under the app's Reduce motion switch: the menus, the bar, the
 * screenshots and the showcase camera. The landing's own bands are pinned by
 * tests/docs-landing-motion.test.ts; this file covers the rest of the site.
 *
 * The app keeps a copy of its Reduce motion choice in localStorage, and the docs
 * pre-paint script (THEME_INIT_SCRIPT in docs/build.ts) turns it into
 * html[data-a11y-motion="reduce"]. The static pages never load the app's base.css,
 * so the site's own rules and scripts have to answer that attribute themselves:
 *
 *  1. THE STYLESHEETS. Every reduced-motion rule in the site CSS (docs/build.ts) and in
 *     the chrome both readers share (styles/parts/docs-chrome.css) comes twice: under
 *     the OS query and as an html[data-a11y-motion="reduce"] twin. A motion that only
 *     runs under no-preference has a twin that stops the motion.
 *  2. THE SCREENSHOTS. The pre-paint script that arms the screenshot motion leaves it
 *     unarmed for the app's switch, and runs after the script that sets the attribute.
 *  3. THE SHOWCASE CAMERA and THE HERO WORD hold still for either signal; the word also
 *     stops when a signal arrives mid-cycle.
 *
 * Source files only: nothing here needs a built /info, so nothing here skips.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { applyA11yPrefs, type A11yPrefs } from '../shells/web/src/lib/a11y-prefs.ts';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const BUILD = 'docs/build.ts';
const BUILD_TS = readFileSync(join(REPO, BUILD), 'utf-8');
const CHROME = 'shells/web/src/styles/parts/docs-chrome.css';

/** The site stylesheet: the `const CSS` template literal, its interpolated files left
 *  out (each is a stylesheet with its own test), line numbers kept. */
function siteCss(): { css: string; firstLine: number } {
  const open = BUILD_TS.indexOf('\nconst CSS = `');
  assert.ok(open > 0, `${BUILD} no longer declares the site stylesheet as const CSS`);
  const start = open + '\nconst CSS = `'.length;
  const end = BUILD_TS.indexOf('\n`.trim();', start);
  assert.ok(end > start, `${BUILD}: the site stylesheet no longer ends in \`.trim()`);
  const firstLine = BUILD_TS.slice(0, start).split('\n').length;
  return { css: BUILD_TS.slice(start, end).replace(/\$\{[^}]*\}/g, ''), firstLine };
}

// ── 1. The stylesheets ────────────────────────────────────────────────────────

const GATE = 'html[data-a11y-motion="reduce"]';
const OS_REDUCE = /prefers-reduced-motion\s*:\s*reduce/;
const OS_NO_PREFERENCE = /prefers-reduced-motion\s*:\s*no-preference/;

interface Rule { selector: string; decls: Map<string, string>; at: string[]; line: number }

const decomment = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Split on a comma or semicolon outside brackets and quotes, whitespace collapsed. */
function splitTop(text: string, separator: ',' | ';'): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (const ch of text) {
    if (quote) { if (ch === quote) quote = ''; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === separator && depth === 0) { out.push(current); current = ''; continue; }
    current += ch;
  }
  out.push(current);
  return out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const declaration of splitTop(body, ';')) {
    const colon = declaration.indexOf(':');
    if (colon > 0) out.set(declaration.slice(0, colon).trim().toLowerCase(), declaration.slice(colon + 1).trim());
  }
  return out;
}

/** Every innermost style rule, with its enclosing at-rule preludes. @keyframes bodies
 *  are skipped: their selectors are offsets, not elements. */
function parse(css: string, firstLine = 1): Rule[] {
  const out: Rule[] = [];
  const at: string[] = [];
  let prelude = '';
  let start = firstLine;
  let line = firstLine;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === '{') {
      const head = prelude.replace(/\s+/g, ' ').trim();
      prelude = '';
      if (head.startsWith('@') && !/^@(?:-webkit-)?keyframes\b/.test(head) && !/^@font-face\b/.test(head)) { at.push(head); continue; }
      let depth = 1;
      let body = '';
      while (++i < css.length) {
        const c = css[i]!;
        if (c === '\n') line++;
        if (c === '{') depth++;
        else if (c === '}' && --depth === 0) break;
        body += c;
      }
      if (!head.startsWith('@')) out.push({ selector: head, decls: declarations(body), at: [...at], line: start });
      continue;
    }
    if (ch === '}') { at.pop(); prelude = ''; continue; }
    if (ch === ';') { prelude = ''; continue; }
    if (ch === '\n') line++;
    if (!prelude.trim() && /\S/.test(ch)) start = line;
    prelude += ch;
  }
  return out;
}

const arms = (selector: string): string[] => splitTop(selector, ',');
const inMotionQuery = (r: Rule): boolean => r.at.some((a) => /prefers-reduced-motion/.test(a));

/** The twin of an arm: the gate in front, or on html itself when the arm is <html>. */
const twinOf = (arm: string): string => (/^html(?![\w-])/.test(arm) ? `${GATE}${arm.slice(4)}` : `${GATE} ${arm}`);

/** A comparable line: the other at-rules, the arm and the declarations, sorted. */
function key(at: string[], arm: string, decls: Iterable<[string, string]>): string {
  return `${at.join(' / ')} :: ${arm} { ${[...decls].map(([p, v]) => `${p}:${v}`).sort().join(';')} }`;
}

/**
 * Which twins a sheet should have, and which it has. A rule under the OS reduce query
 * needs its own arms and declarations again behind the gate. A rule that only moves
 * under no-preference needs its movement stopped behind the gate: `animation:none` for
 * an animation, `transition:none` for a transition. The screenshot motion is gated on
 * the class the pre-paint script withholds (part 2), so its rules need no twin.
 */
function twins(rules: Rule[]): { wanted: Map<string, number>; present: Map<string, number> } {
  const wanted = new Map<string, number>();
  const present = new Map<string, number>();
  for (const r of rules) {
    const other = r.at.filter((a) => !/prefers-reduced-motion/.test(a));
    if (r.at.some((a) => OS_REDUCE.test(a))) {
      for (const arm of arms(r.selector)) wanted.set(key(other, twinOf(arm), r.decls), r.line);
    } else if (r.at.some((a) => OS_NO_PREFERENCE.test(a))) {
      for (const arm of arms(r.selector)) {
        if (arm.includes('.shots-motion')) continue;
        const stop: Array<[string, string]> = [];
        const animation = r.decls.get('animation') ?? r.decls.get('animation-name');
        if (animation && !/^none\b/.test(animation)) stop.push(['animation', 'none']);
        if (r.decls.has('transition')) stop.push(['transition', 'none']);
        if (stop.length) wanted.set(key(other, twinOf(arm), stop), r.line);
      }
    } else if (r.selector.includes('data-a11y-motion')) {
      for (const arm of arms(r.selector)) present.set(key(r.at, arm, r.decls), r.line);
    }
  }
  return { wanted, present };
}

function assertTwins(name: string, rules: Rule[]): void {
  const { wanted, present } = twins(rules);
  assert.ok(wanted.size >= 3, `${name}: only ${wanted.size} reduced-motion rules found, so the parser has stopped seeing the sheet`);
  const missing = [...wanted].filter(([k]) => !present.has(k)).map(([k, line]) => `  ${name}:${line}  ${k}`);
  const orphans = [...present].filter(([k]) => !wanted.has(k)).map(([k, line]) => `  ${name}:${line}  ${k}`);
  assert.deepEqual(missing, [],
    `these reduced-motion rules have no ${GATE} twin, so the app's switch does not reach them:\n${missing.join('\n')}`);
  assert.deepEqual(orphans, [],
    `these ${GATE} rules match no reduced-motion rule with the same arm and declarations:\n${orphans.join('\n')}`);
  for (const r of rules.filter((x) => !inMotionQuery(x) && x.selector.includes('data-a11y-motion'))) {
    for (const arm of arms(r.selector)) {
      assert.ok(arm.startsWith(GATE), `${name}:${r.line}: "${r.selector}" gates only some of its arms, so the others apply to every reader`);
    }
  }
}

test('every reduced-motion rule in the /info site stylesheet has an app twin', () => {
  const { css, firstLine } = siteCss();
  assertTwins(BUILD, parse(decomment(css), firstLine));
});

test("every reduced-motion rule in the shared docs chrome has an app twin", () => {
  assertTwins(CHROME, parse(decomment(readFileSync(join(REPO, CHROME), 'utf-8'))));
});

// ── 2. The screenshots ────────────────────────────────────────────────────────

/** The value of one `const NAME = ...;` template literal in docs/build.ts, its
 *  escapes cooked the way the template would (a script with a regex in it writes
 *  every backslash twice in the source). */
function literal(name: string): string {
  const m = new RegExp('const ' + name + ' = `([\\s\\S]*?)`;\\n').exec(BUILD_TS);
  assert.ok(m, `${BUILD} no longer declares ${name} as a template literal`);
  return m[1]!.replace(/\\([\\`$])/g, '$1');
}
const script = (source: string): string => source.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

// a11y-prefs.ts reads `document` and `localStorage` when it is called, so stand-ins on
// the global are enough to run the app's own writer here.
const saved = new Map<string, string>();
const scope = globalThis as unknown as Record<string, unknown>;
scope.document = { documentElement: { dataset: {} } };
scope.localStorage = {
  getItem: (k: string) => saved.get(k) ?? null,
  setItem: (k: string, v: string) => { saved.set(k, String(v)); },
  removeItem: (k: string) => { saved.delete(k); },
};
function appCopy(prefs: A11yPrefs): Map<string, string> {
  saved.clear();
  applyA11yPrefs(prefs);
  return new Map(saved);
}

/** The docs pre-paint file, run in the page's order: the theme script, then the shot
 *  initialiser, over this storage. Returns the classes added to <html>. */
function prePaint(storage: Map<string, string>): string[] {
  const added: string[] = [];
  const dataset: Record<string, string> = {};
  const documentElement = { dataset, classList: { toggle: () => undefined, add: (c: string) => { added.push(c); } } };
  const context = {
    localStorage: { getItem: (k: string) => storage.get(k) ?? null },
    window: { matchMedia: () => ({ matches: false }) },
    document: { documentElement },
  };
  runInNewContext(`${script(literal('THEME_INIT_SCRIPT'))}\n;\n${script(literal('SHOT_MOTION_INIT'))}`, context);
  return added;
}

test('the screenshot motion stays unarmed for the app\'s Reduce motion switch', () => {
  assert.match(BUILD_TS, /const DOCS_INIT_JS = \[THEME_INIT_SCRIPT, SHOT_MOTION_INIT\]/,
    'the shot initialiser must run after the theme script, which is what sets the attribute it reads');
  assert.deepEqual(prePaint(appCopy({})), ['shots-motion'], 'with no switch on the motion was not armed, so this sandbox cannot see the motion');
  assert.deepEqual(prePaint(appCopy({ reduceMotion: true })), [], "the screenshot motion was armed under the app's switch");
  assert.deepEqual(prePaint(appCopy({ highContrast: true })), ['shots-motion'], 'a choice other than Reduce motion left the motion unarmed');
});

// ── 3. The showcase camera and the hero word ──────────────────────────────────

interface Asked { os?: boolean; app?: boolean }
const SIGNALS: Array<[string, Asked]> = [['the OS setting', { os: true }], ["the app's switch", { app: true }]];
const matcher = (state: Asked) => (query: string) => ({ matches: !!state.os && OS_REDUCE.test(query), addEventListener: () => undefined });

/** The showcase camera over one block: how many viewport observers it started. */
function runShowcase(asked: Asked): number {
  let observers = 0;
  const figure = { getAttribute: () => null, querySelector: () => null, classList: { add: () => undefined } };
  const context: Record<string, unknown> = {
    document: {
      documentElement: { dataset: asked.app ? { a11yMotion: 'reduce' } : {}, clientHeight: 800 },
      querySelectorAll: (sel: string) => (sel === '.showcase' ? [figure] : []),
    },
    matchMedia: matcher(asked),
    IntersectionObserver: function IntersectionObserver() { observers++; return { observe: () => undefined, unobserve: () => undefined }; },
    addEventListener: () => undefined,
    requestAnimationFrame: () => 0,
    innerHeight: 800,
    fetch: () => new Promise(() => undefined),
  };
  context.window = context;
  runInNewContext(script(literal('SHOWCASE_SCRIPT')), context);
  return observers;
}

test('the showcase camera holds the finished artwork for either signal', () => {
  assert.equal(runShowcase({}), 1, 'with no preference the camera watched nothing, so this sandbox cannot see the camera');
  for (const [signal, asked] of SIGNALS) assert.equal(runShowcase(asked), 0, `the showcase camera ran under ${signal}`);
});

/** The landing's hero word on a fresh page, with the signals as switches to flip. */
function heroWord(asked: Asked) {
  const state = { ...asked };
  const dataset: Record<string, string> = {};
  const sync = (): void => { if (state.app) dataset.a11yMotion = 'reduce'; else delete dataset.a11yMotion; };
  sync();
  const beats: Array<() => void> = [];
  let swaps = 0;
  const word = {
    getAttribute: (name: string) => (name === 'data-cycle' ? JSON.stringify([{ w: 'is free', h: '/a' }, { w: 'is private', h: '/b' }]) : null),
    querySelector: () => ({ textContent: '' }),
    addEventListener: () => undefined,
    setAttribute: () => undefined,
    classList: { add: (c: string) => { if (c === 'is-swapping') swaps++; }, remove: () => undefined },
  };
  runInNewContext(script(literal('HERO_CYCLE_JS')), {
    matchMedia: (query: string) => matcher(state)(query),
    setInterval: (fn: () => void) => { beats.push(fn); return beats.length; },
    setTimeout: () => 0,
    Date: { now: () => 1e12 },
    document: { hidden: false, documentElement: { dataset }, getElementById: (id: string) => (id === 'heroCycle' ? word : null) },
  });
  return {
    beat: () => { for (const fn of beats) fn(); },
    get swaps() { return swaps; },
    set(next: Asked) { state.os = next.os; state.app = next.app; sync(); },
  };
}

test('a signal that arrives mid-cycle stops the hero word on the static page', () => {
  for (const [signal, asked] of SIGNALS) {
    const hero = heroWord({});
    hero.beat();
    assert.equal(hero.swaps, 1, 'with no preference the word did not move, so this sandbox cannot see the cycle');
    hero.set(asked);
    hero.beat();
    hero.beat();
    assert.equal(hero.swaps, 1, `the word kept cycling after ${signal} was turned on`);
    hero.set({});
    hero.beat();
    assert.equal(hero.swaps, 2, `the word did not pick up again once ${signal} was off`);
  }
});
