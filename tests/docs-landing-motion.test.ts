// SPDX-License-Identifier: MPL-2.0
/**
 * Reduced motion on the /info landing, whichever way the reader asked for less of
 * it: in the operating system (prefers-reduced-motion) or with the app's own Reduce
 * motion switch.
 *
 * The app's switch is stored on the profile, and the app keeps a copy in
 * localStorage ('lolly-a11y') that its pre-paint script turns into
 * html[data-a11y-motion="reduce"]. The static /info pages share the app's origin but
 * never load its base.css, so the switch reaches them through three things, pinned
 * here in turn:
 *
 *  1. THE COPY. THEME_INIT_SCRIPT (docs/build.ts) reads the saved copy before paint
 *     and sets the attribute. It is checked against the copy that
 *     shells/web/src/lib/a11y-prefs.ts itself writes, so the two cannot drift apart.
 *  2. THE SCRIPTS. The chip field behind the hero (and behind every article title)
 *     and the hero's cycling word hold still for either signal. Each runs in a bare
 *     node:vm sandbox that counts animation frames, timers and new chips, so "holds
 *     still" is measured rather than read off the source.
 *  3. THE STYLESHEET. Every reduced-motion rule in styles/parts/docs-landing.css is
 *     written twice, under the OS query and as an html[data-a11y-motion="reduce"]
 *     twin, and every hero and persona rule that moves has a rule that stops the
 *     movement.
 *
 * Source files only: nothing here needs a built /info, so nothing here skips.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { A11Y_STORE_KEY, applyA11yPrefs, type A11yPrefs } from '../shells/web/src/lib/a11y-prefs.ts';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const BUILD_TS = readFileSync(join(REPO, 'docs/build.ts'), 'utf-8');
const SHEET = 'shells/web/src/styles/parts/docs-landing.css';
const CSS = readFileSync(join(REPO, SHEET), 'utf-8');

// ── Reading the page scripts out of docs/build.ts ─────────────────────────────

/** The body of one `const NAME = ...;` template literal in docs/build.ts. */
function literal(name: string): string {
  const m = new RegExp('const ' + name + ' = `([\\s\\S]*?)`;\\n').exec(BUILD_TS);
  assert.ok(m, `docs/build.ts no longer declares ${name} as a template literal, which is where this test reads the script from`);
  return m[1]!;
}

/** A `<script>...</script>` literal as plain script. */
const script = (source: string): string => source.replace(/^\s*<script>/, '').replace(/<\/script>\s*$/, '');

/** The chip field engine, with its one build-time value filled by a short format list. */
function chipEngine(): string {
  const raw = literal('CHIP_FIELD_JS');
  const filled = [...raw.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]);
  assert.deepEqual(filled, ['JSON.stringify(chipExtensions())'],
    'CHIP_FIELD_JS now fills in other build-time values; give this test a stand-in for each one');
  return raw.replace(/\$\{[^}]*\}/, JSON.stringify(['.PDF', '.SVG', '.PNG']));
}

/** Where the reader asked for less motion: the OS, the app's switch, or neither. */
interface Asked { os?: boolean; app?: boolean }

const REDUCE_QUERY = /prefers-reduced-motion:\s*reduce/;

const reduceMatcher = (asked: Asked) => (query: string) =>
  ({ matches: !!asked.os && REDUCE_QUERY.test(query), addEventListener: () => undefined });

const rootDataset = (asked: Asked): Record<string, string> => (asked.app ? { a11yMotion: 'reduce' } : {});

// ── 1. The copy ───────────────────────────────────────────────────────────────

// a11y-prefs.ts reads `document` and `localStorage` when it is called, so stand-ins on
// the global are enough to run its writer here. Node 26 defines localStorage as a
// replaceable accessor and Node 24 has none, so a plain assignment works on both.
// The writer also passes Reduce motion on to Jelly through an attribute on <html>,
// so the stand-in keeps attributes too. With no defaultView it sends no event.
const saved = new Map<string, string>();
const attrs = new Map<string, string>();
const scope = globalThis as unknown as Record<string, unknown>;
scope.document = {
  documentElement: {
    dataset: {},
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => { attrs.set(name, String(value)); },
    removeAttribute: (name: string) => { attrs.delete(name); },
  },
};
scope.localStorage = {
  getItem: (key: string) => saved.get(key) ?? null,
  setItem: (key: string, value: string) => { saved.set(key, String(value)); },
  removeItem: (key: string) => { saved.delete(key); },
};

/** What the app saves for these choices: its own writer, run for real. */
function appCopy(prefs: A11yPrefs): Map<string, string> {
  saved.clear();
  applyA11yPrefs(prefs);
  return new Map(saved);
}

/** The <html> dataset after the docs pre-paint script runs over this storage. */
function docsPrePaint(storage: Map<string, string>): Record<string, string> {
  const dataset: Record<string, string> = {};
  runInNewContext(script(literal('THEME_INIT_SCRIPT')), {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null },
    window: { matchMedia: () => ({ matches: false }) },
    document: { documentElement: { dataset, classList: { toggle: () => undefined } } },
  });
  return dataset;
}

test("the docs pre-paint script turns the app's saved Reduce motion choice into the attribute", () => {
  assert.ok(literal('THEME_INIT_SCRIPT').includes(`localStorage.getItem('${A11Y_STORE_KEY}')`),
    `THEME_INIT_SCRIPT must read the key the app writes its copy under (${A11Y_STORE_KEY})`);
  assert.equal(docsPrePaint(appCopy({ reduceMotion: true })).a11yMotion, 'reduce',
    "the app's own copy of Reduce motion did not turn the attribute on");
  assert.equal(docsPrePaint(appCopy({ reduceMotion: true, highContrast: true, largeText: true, hidePreviews: true })).a11yMotion, 'reduce',
    'Reduce motion saved alongside the other choices did not turn the attribute on');
  // Off is the attribute's absence, never a value, so with motion off no twin matches.
  assert.equal(docsPrePaint(appCopy({})).a11yMotion, undefined);
  assert.equal(docsPrePaint(appCopy({ highContrast: true, largeText: true, hidePreviews: true })).a11yMotion, undefined,
    'choices other than Reduce motion turned the attribute on');
  assert.equal(docsPrePaint(new Map()).a11yMotion, undefined);
});

test('a damaged saved copy neither breaks the theme nor turns Reduce motion on', () => {
  for (const damaged of ['{', 'true', '[]', 'null', '"reduce"']) {
    const dataset = docsPrePaint(new Map([['theme', 'dark'], [A11Y_STORE_KEY, damaged]]));
    assert.equal(dataset.theme, 'dark', `a saved copy of ${damaged} cost the reader the theme`);
    assert.equal(dataset.a11yMotion, undefined, `a saved copy of ${damaged} turned Reduce motion on`);
  }
});

// ── 2. The scripts ────────────────────────────────────────────────────────────

/**
 * Just enough page for the chip field: one band, a 2D context that only counts its
 * draws, and a count of each way the field could move (an animation frame asked for,
 * or a burst of new chips baked into sprites).
 */
function chipPage(asked: Asked) {
  const count = { frames: 0, sprites: 0, draws: 0 };
  const pointerdown: Array<(event: object) => void> = [];
  const ctx2d = new Proxy({} as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return () => ({ width: 40, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 0 });
      if (prop === 'drawImage') return () => { count.draws++; };
      return () => undefined;
    },
  });
  const band = { offsetWidth: 800, offsetHeight: 400, contains: () => true, addEventListener: () => undefined };
  const canvas = () => ({
    width: 0, height: 0, parentElement: band, getContext: () => ctx2d, getBoundingClientRect: () => ({ left: 0, top: 0 }),
  });
  const hero = canvas();
  const masthead = canvas();
  class Observer {
    observe = () => undefined;
    disconnect = () => undefined;
  }
  const page: Record<string, unknown> = {
    devicePixelRatio: 1,
    matchMedia: reduceMatcher(asked),
    requestAnimationFrame: () => ++count.frames,
    ResizeObserver: Observer,
    IntersectionObserver: Observer,
    MutationObserver: Observer,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    document: {
      hidden: false,
      documentElement: { dataset: rootDataset(asked) },
      createElement: () => { count.sprites++; return canvas(); },
      getElementById: (id: string) => (id === 'heroCanvas' ? hero : null),
      querySelector: (selector: string) => (selector === '.docs-mast-canvas' ? masthead : null),
      addEventListener: (type: string, listener: (event: object) => void) => { if (type === 'pointerdown') pointerdown.push(listener); },
    },
  };
  page.window = page;
  const tap = (): void => { for (const listener of pointerdown) listener({ target: {}, clientX: 20, clientY: 20 }); };
  return { page, count, tap };
}

/** The chip field engine and one of its two callers, run on a fresh page. */
function runField(caller: 'HERO_CANVAS_SCRIPT' | 'DOCS_MASTHEAD_SCRIPT', asked: Asked) {
  const run = chipPage(asked);
  runInNewContext(`${chipEngine()}\n;\n${script(literal(caller))}`, run.page);
  return run;
}

const SIGNALS = [
  ["the app's Reduce motion switch", { app: true }],
  ['the OS preference', { os: true }],
] as const;

test('the landing chip field moves for a reader who asked for nothing, and holds still for either signal', () => {
  const free = runField('HERO_CANVAS_SCRIPT', {});
  assert.ok(free.count.frames > 0, 'with no preference the field asked for no frame, so this sandbox cannot see motion at all');
  const baked = free.count.sprites;
  free.tap();
  assert.ok(free.count.sprites > baked, 'with no preference a tap made no burst, so this sandbox cannot see a burst at all');

  for (const [signal, asked] of SIGNALS) {
    const still = runField('HERO_CANVAS_SCRIPT', asked);
    assert.equal(still.count.frames, 0, `the landing chip field runs its animation loop under ${signal}`);
    assert.ok(still.count.draws > 0, `under ${signal} the field should still paint one still frame of chips`);
    const before = still.count.sprites;
    still.tap();
    assert.equal(still.count.sprites, before, `a tap bursts chips under ${signal}`);
  }
});

test('the article masthead field holds still for either signal too', () => {
  assert.ok(runField('DOCS_MASTHEAD_SCRIPT', {}).count.frames > 0,
    'with no preference the masthead asked for no frame, so this sandbox cannot see motion at all');
  for (const [signal, asked] of SIGNALS) {
    assert.equal(runField('DOCS_MASTHEAD_SCRIPT', asked).count.frames, 0, `the masthead chip field animates under ${signal}`);
  }
});

/** The hero's cycling word on a fresh page: how many repeating timers it started. */
function runCycle(asked: Asked): number {
  let timers = 0;
  const word = {
    getAttribute: (name: string) => (name === 'data-cycle' ? JSON.stringify([{ w: 'is free', h: '/a' }, { w: 'is private', h: '/b' }]) : null),
    querySelector: () => ({ textContent: '' }),
    addEventListener: () => undefined,
    setAttribute: () => undefined,
    classList: { add: () => undefined, remove: () => undefined },
  };
  runInNewContext(script(literal('HERO_CYCLE_JS')), {
    matchMedia: reduceMatcher(asked),
    setInterval: () => ++timers,
    setTimeout: () => 0,
    document: {
      hidden: false,
      documentElement: { dataset: rootDataset(asked) },
      getElementById: (id: string) => (id === 'heroCycle' ? word : null),
    },
  });
  return timers;
}

test("the hero's cycling word stands still for either signal", () => {
  assert.equal(runCycle({}), 1, 'with no preference the word started no cycle, so this sandbox cannot see the cycle at all');
  for (const [signal, asked] of SIGNALS) assert.equal(runCycle(asked), 0, `the hero word keeps cycling under ${signal}`);
});

// ── 3. The stylesheet ─────────────────────────────────────────────────────────

/** How every twin arm starts. */
const GATE = 'html[data-a11y-motion="reduce"] ';
const OS_QUERY = /prefers-reduced-motion/;

interface Rule { selector: string; decls: Map<string, string>; at: string[]; line: number }

/** Comments blanked with their newlines kept, so line numbers in messages stay true. */
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

const arms = (selector: string): string[] => splitTop(selector, ',');

function declarations(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const declaration of splitTop(body, ';')) {
    const colon = declaration.indexOf(':');
    if (colon > 0) out.set(declaration.slice(0, colon).trim().toLowerCase(), declaration.slice(colon + 1).trim());
  }
  return out;
}

/** Every innermost rule, with the at-rule preludes around it and the line its selector starts on. */
function parse(css: string): Rule[] {
  const out: Rule[] = [];
  const at: string[] = [];
  let prelude = '';
  let start = 1;
  let line = 1;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === '{') {
      const head = prelude.replace(/\s+/g, ' ').trim();
      prelude = '';
      if (head.startsWith('@')) { at.push(head); continue; }
      let depth = 1;
      let body = '';
      while (++i < css.length) {
        const c = css[i]!;
        if (c === '\n') line++;
        if (c === '{') depth++;
        else if (c === '}' && --depth === 0) break;
        body += c;
      }
      out.push({ selector: head, decls: declarations(body), at: [...at], line: start });
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

const RULES = parse(decomment(CSS));
const isOs = (r: Rule): boolean => r.at.some((a) => OS_QUERY.test(a));
const isTwin = (r: Rule): boolean => !isOs(r) && arms(r.selector).every((a) => a.startsWith(GATE));
const isPlain = (r: Rule): boolean => !isOs(r) && !isTwin(r);

/** One arm as a comparable line: its other at-rules, the arm, its declarations sorted. */
function armKey(r: Rule, arm: string, at: string[]): string {
  const decls = [...r.decls].map(([prop, value]) => `${prop}:${value}`).sort().join(';');
  return `${at.join(' / ')} :: ${arm} { ${decls} }`;
}

test('every reduced-motion rule in docs-landing.css has an in-app twin, and every twin has its OS rule', () => {
  const os = RULES.filter(isOs);
  const twins = RULES.filter(isTwin);
  assert.ok(os.length >= 10, `only ${os.length} rules found under the OS query, so the parser has stopped seeing the sheet`);

  for (const r of os) {
    for (const query of r.at.filter((a) => OS_QUERY.test(a))) {
      assert.match(query, /^@media ?\( ?prefers-reduced-motion ?: ?reduce ?\)$/,
        `${SHEET}:${r.line}: "${query}". Motion in this sheet is opt-out: write the motion plainly and stop it in a ` +
        '(prefers-reduced-motion: reduce) block, which a twin can then copy. An opt-in block cannot answer the in-app switch.');
    }
  }
  for (const r of RULES.filter(isPlain)) {
    assert.ok(!r.selector.includes('data-a11y-motion'),
      `${SHEET}:${r.line}: "${r.selector}" gates only some of its arms on the in-app switch, so the others apply to every reader`);
  }

  const fromOs = os.flatMap((r) => arms(r.selector).map((arm) => ({ key: armKey(r, arm, r.at.filter((a) => !OS_QUERY.test(a))), line: r.line })));
  const fromTwins = twins.flatMap((r) => arms(r.selector).map((arm) => ({ key: armKey(r, arm.slice(GATE.length), r.at), line: r.line })));
  const twinKeys = new Set(fromTwins.map((t) => t.key));
  const osKeys = new Set(fromOs.map((o) => o.key));
  const missing = fromOs.filter((o) => !twinKeys.has(o.key)).map((o) => `  ${SHEET}:${o.line}  ${o.key}`);
  const orphans = fromTwins.filter((t) => !osKeys.has(t.key)).map((t) => `  ${SHEET}:${t.line}  ${t.key}`);
  assert.deepEqual(missing, [],
    `these reduced-motion rules have no ${GATE.trim()} twin, so the app's switch does not reach them on /info:\n${missing.join('\n')}`);
  assert.deepEqual(orphans, [],
    `these twins have no rule under the OS query with the same arm and the same declarations:\n${orphans.join('\n')}`);
});

/**
 * The hero (beat 1 of the landing) and the persona device (beat 4), by the class
 * names buildLandingContent in docs/build.ts gives their markup. The hero's agent
 * pill and its dialog belong to the hero; the lanes belong to the persona panes.
 */
const HERO_OR_PERSONA = /(?:^|[\s>+~])(?:\.hero(?:-[\w-]+)?|\.cycle-[\w-]+|\.agent-[\w-]+|\.btn-(?:primary|secondary)|\.persona-[\w-]+|\.lane-[\w-]+|#door-[\w-]+)(?![\w-])/;

/** A transition that can carry an element somewhere (`all` includes transform). */
const TRAVEL = /\b(?:all|transform|translate|scale|rotate)\b/;

function movement(r: Rule): string | null {
  const animation = r.decls.get('animation') ?? r.decls.get('animation-name');
  if (animation && !/^none\b/.test(animation)) return `animation: ${animation}`;
  const transition = r.decls.get('transition') ?? r.decls.get('transition-property');
  if (transition && TRAVEL.test(transition)) return `transition: ${transition}`;
  return null;
}

/**
 * How reduced motion stops each hero and persona rule that moves: the arm, and the
 * declaration set on that arm. Most stop on the moving rule's own selector. The hover
 * and press lifts keep their colour change and lose the travel, as the download
 * rail's reduced-motion block already does.
 */
const STOPS: Record<string, ReadonlyArray<readonly [arm: string, decl: string]>> = {
  '.hero-heading': [['.hero-heading', 'animation:none']],
  '.hero .subtitle': [['.hero .subtitle', 'animation:none']],
  '.hero-cta': [['.hero-cta', 'animation:none']],
  '.hero-agent': [['.hero-agent', 'animation:none']],
  '.hero-trust': [['.hero-trust', 'animation:none']],
  '.hero-logo-link': [['.hero-logo-link:active', 'transform:none']],
  '.hero-verify': [['.hero-verify', 'transition:none']],
  '.hero-btn': [['.btn-primary:hover', 'transform:none'], ['.btn-secondary:hover', 'transform:none']],
  '.agent-pill-icon[data-tip]::after': [['.agent-pill-icon[data-tip]::after', 'transition:none']],
  '.hero-statement--cycle .cycle-word span': [['.hero-statement--cycle .cycle-word span', 'transition:none']],
  '.persona-tab': [['.persona-tab:hover', 'transform:none']],
  '.persona-tabs img': [['.persona-tabs img', 'transition:none']],
};

test('every hero and persona rule that moves is stopped under reduced motion, in both forms', () => {
  const moving = new Map<string, { line: number; how: string }>();
  for (const r of RULES.filter(isPlain)) {
    const how = movement(r);
    if (!how) continue;
    for (const arm of arms(r.selector)) if (HERO_OR_PERSONA.test(arm)) moving.set(arm, { line: r.line, how });
  }
  const unlisted = [...moving].filter(([arm]) => !Object.hasOwn(STOPS, arm)).map(([arm, m]) => `  ${SHEET}:${m.line}  ${arm} (${m.how})`);
  assert.deepEqual(unlisted, [],
    'these hero or persona rules move, and nothing stops them under reduced motion. Stop each one in a ' +
    `(prefers-reduced-motion: reduce) block and in its twin, then add it to STOPS in this test:\n${unlisted.join('\n')}`);
  const stale = Object.keys(STOPS).filter((arm) => !moving.has(arm));
  assert.deepEqual(stale, [], 'STOPS lists rules that no longer move or no longer exist; take them out of the table');

  for (const [mover, stops] of Object.entries(STOPS)) {
    for (const [arm, decl] of stops) {
      const colon = decl.indexOf(':');
      const prop = decl.slice(0, colon);
      const value = decl.slice(colon + 1);
      const sets = (r: Rule, target: string): boolean => arms(r.selector).includes(target) && r.decls.get(prop) === value;
      const osStop = RULES.find((r) => isOs(r) && sets(r, arm));
      assert.ok(osStop, `${mover} moves, and no (prefers-reduced-motion: reduce) rule sets ${decl} on ${arm}`);
      assert.ok(RULES.some((r) => isTwin(r) && sets(r, GATE + arm)),
        `${mover} moves, and no ${GATE.trim()} twin sets ${decl} on ${arm}`);
      // The same selector has the same specificity, so the stop wins only by coming later.
      for (const r of RULES.filter((x) => isPlain(x) && arms(x.selector).includes(arm) && x.decls.has(prop))) {
        assert.ok(osStop.line > r.line,
          `${SHEET}:${osStop.line} sets ${decl} on ${arm} above the rule it has to override (line ${r.line}), so the override loses`);
      }
    }
  }
});
