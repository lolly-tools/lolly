// SPDX-License-Identifier: MPL-2.0
/**
 * The landing in the in-app docs reader (#/docs/index), under the dark theme and the
 * app's Reduce motion switch.
 *
 * The reader injects styles/parts/docs-landing.css inside `@scope (.docs-landing)`
 * (lib/docs-landing.ts). A scoped selector is relative, with `:scope ` implied in
 * front, so a rule that starts from <html> asked for an <html> inside the landing
 * and never matched there: every dark-theme rule in the file and every Reduce motion
 * twin. liftRootConditions rewrites those rules in the reader's copy. Pinned here:
 *
 *  1. THE REWRITE, case by case: where the condition goes and what it leaves alone.
 *  2. THE WHOLE FILE: every rule that starts from <html> is rewritten, no other line
 *     changes, and no rule is left that cannot match inside the scope.
 *  3. THE HERO WORD in the reader: it stands still for either signal, and stops
 *     mid-cycle when one is turned on.
 *
 * That the rewritten rules match in a real @scope is measured in Chromium by
 * tests/docs-reader-scope.browser.test.ts.
 */
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hydrateLandingCycle, landingStyleText, liftRootConditions } from '../shells/web/src/lib/docs-landing.ts';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const SHEET = 'shells/web/src/styles/parts/docs-landing.css';
const SOURCE = readFileSync(join(REPO, SHEET), 'utf-8');

// ── 1. The rewrite ────────────────────────────────────────────────────────────

test('a rule that starts from <html> carries its condition on the next compound', () => {
  const cases: Array<[string, string]> = [
    ['html[data-theme="dark"] .quicknav{background:red}', '.quicknav:is(html[data-theme="dark"] *){background:red}'],
    // A pseudo-class may not follow a pseudo-element, so the condition goes in front.
    ['html[dir="rtl"] .quicknav::after{x:y}', '.quicknav:is(html[dir="rtl"] *)::after{x:y}'],
    ['html[x] .a:after{x:y}', '.a:is(html[x] *):after{x:y}'],
    // On the FIRST compound after html, whatever comes next.
    ['html[data-a11y-motion="reduce"] .dl-tile:hover .dl-mark{transform:none}',
      '.dl-tile:hover:is(html[data-a11y-motion="reduce"] *) .dl-mark{transform:none}'],
    ['html[data-theme="dark"][dir="rtl"] .q::after{x:y}', '.q:is(html[data-theme="dark"][dir="rtl"] *)::after{x:y}'],
    ['html[x] h2{x:y}', 'h2:is(html[x] *){x:y}'],
    [':root[data-x] .d{x:y}', '.d:is(:root[data-x] *){x:y}'],
    ['HTML[x] .a{x:y}', '.a:is(HTML[x] *){x:y}'],
    // The bare form the older bands use: attributes that only <html> carries.
    ['[data-theme="dark"] .faq-item{x:y}', '.faq-item:is([data-theme="dark"] *){x:y}'],
    ['[dir="rtl"] .hero-btn svg{x:y}', '.hero-btn:is([dir="rtl"] *) svg{x:y}'],
    ['[data-theme="dark"][dir="rtl"] .a{x:y}', '.a:is([data-theme="dark"][dir="rtl"] *){x:y}'],
    ['[data-a11y-motion="reduce"] .a{x:y}', '.a:is([data-a11y-motion="reduce"] *){x:y}'],
  ];
  for (const [input, want] of cases) assert.equal(liftRootConditions(input), want, input);
});

test('selector lists are lifted arm by arm, with their own spacing kept', () => {
  assert.equal(
    liftRootConditions('.a,\nhtml[x] .b,\n  html[y] .c .d , .e{z:1}'),
    '.a,\n.b:is(html[x] *),\n  .c:is(html[y] *) .d , .e{z:1}',
  );
  // A comma inside brackets or parentheses does not split the list.
  assert.equal(liftRootConditions('html[x] .a:is(.b,.c),[data-q="1,2"]{z:1}'), '.a:is(.b,.c):is(html[x] *),[data-q="1,2"]{z:1}');
});

test('the rewrite walks into grouping at-rules and copies every other block as it stands', () => {
  assert.equal(
    liftRootConditions('@media(max-width:900px){html[dir="rtl"] .q::after{x:y}}'),
    '@media(max-width:900px){.q:is(html[dir="rtl"] *)::after{x:y}}',
  );
  assert.equal(
    liftRootConditions('@supports (display:grid){@media (min-width:1px){html[x] .a{b:c}}}'),
    '@supports (display:grid){@media (min-width:1px){.a:is(html[x] *){b:c}}}',
  );
  const verbatim = [
    '@keyframes heroUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}',
    '@font-face{font-family:x;src:url("a}b.woff2")}',
    '@import url("x.css");',
  ];
  for (const css of verbatim) assert.equal(liftRootConditions(css), css);
});

test('comments, strings and the forms that cannot be lifted pass through unchanged', () => {
  const unchanged = [
    // No subject inside the landing for the condition to ride on.
    'html{scroll-behavior:auto}',
    'html[data-a11y-motion="reduce"]{scroll-behavior:auto}',
    'html > body .z{q:r}',
    // html that does not lead the selector, and a type that only starts with "html".
    '.a html[x] .b{q:r}',
    'htmlish .a{q:r}',
    // Attributes that live on the landing's own elements stay where they are.
    '[data-theme-set] .a{q:r}',
    '[data-tip]::after{q:r}',
    '.agent-pill-icon[data-tip] .a{q:r}',
    // Text that looks like a selector inside a comment or a string.
    '/* html[x] .y{} */.a{b:c}',
    '.e{content:"}html[x] .f{"}',
  ];
  for (const css of unchanged) assert.equal(liftRootConditions(css), css, css);
  // A comment in front of a rule stays outside the selector, so the rule is still lifted.
  assert.equal(liftRootConditions('/* note */\nhtml[x] .a{b:c}'), '/* note */\n.a:is(html[x] *){b:c}');
});

test('lifting twice changes nothing more', () => {
  const once = liftRootConditions(SOURCE);
  assert.equal(liftRootConditions(once), once);
});

// ── 2. The whole file ─────────────────────────────────────────────────────────

/** Comments blanked with their newlines kept, so line numbers stay true. */
const decomment = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Every selector arm of every style rule, at any depth of at-rules, with its line. */
function arms(css: string): Array<{ arm: string; line: number }> {
  const out: Array<{ arm: string; line: number }> = [];
  let prelude = '';
  let line = 1;
  let start = 1;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === '{') {
      const head = prelude.trim();
      prelude = '';
      if (head.startsWith('@')) {
        // Grouping rules hold rules; every other at-rule block is skipped whole.
        if (/^@(?:media|supports|container|layer|scope)\b/i.test(head)) continue;
        let depth = 1;
        while (++i < css.length && depth) { if (css[i] === '\n') line++; if (css[i] === '{') depth++; else if (css[i] === '}') depth--; }
        continue;
      }
      let depth = 1;
      while (++i < css.length) {
        if (css[i] === '\n') line++;
        if (css[i] === '{') depth++;
        else if (css[i] === '}' && --depth === 0) break;
      }
      let d = 0;
      let cur = '';
      for (const c of head) {
        if (c === '(' || c === '[') d++;
        else if (c === ')' || c === ']') d--;
        if (c === ',' && d === 0) { out.push({ arm: cur.replace(/\s+/g, ' ').trim(), line: start }); cur = ''; continue; }
        cur += c;
      }
      out.push({ arm: cur.replace(/\s+/g, ' ').trim(), line: start });
      continue;
    }
    if (ch === '}' || ch === ';') { prelude = ''; continue; }
    if (ch === '\n') line++;
    if (!prelude.trim() && /\S/.test(ch)) start = line;
    prelude += ch;
  }
  return out;
}

/** A selector that starts from <html>: the element itself, or a bare attribute only
 *  <html> carries. */
const ROOT_LED = /^(?:(?:html|:root)(?![\w-])|(?:\[(?:data-theme|dir|lang|data-a11y-[a-z]+)(?![\w-])[^\]]*\])+\s)/i;

test('every rule in docs-landing.css that starts from <html> is lifted, and no other line moves', () => {
  const lifted = liftRootConditions(SOURCE);
  const before = SOURCE.split('\n');
  const after = lifted.split('\n');
  assert.equal(after.length, before.length, 'the rewrite added or removed lines');
  const changed = before.flatMap((text, i) => (text === after[i] ? [] : [{ i, text }]));
  for (const { i, text } of changed) {
    assert.match(text, /(?:^|[\s,{])(?:html\[|\[(?:data-theme|dir|lang|data-a11y-))/, `${SHEET}:${i + 1} changed, but it has no rule that starts from <html>`);
  }

  const sourceArms = arms(decomment(SOURCE)).filter((a) => ROOT_LED.test(a.arm));
  // Non-vacuity: the theme rules and the Reduce motion twins are both in the count.
  assert.ok(sourceArms.length >= 40, `only ${sourceArms.length} rules start from <html>, so the parser has stopped seeing the sheet`);
  assert.ok(sourceArms.some((a) => a.arm.startsWith('html[data-theme="dark"]')), 'no dark-theme rule found');
  assert.ok(sourceArms.some((a) => a.arm.startsWith('html[data-a11y-motion="reduce"]')), 'no Reduce motion twin found');
  assert.ok(sourceArms.some((a) => a.arm.startsWith('[data-theme="dark"]')), 'no bare dark-theme rule found');
  assert.equal((lifted.match(/:is\((?:(?:html|:root)\[|\[(?:data-theme|dir|lang|data-a11y-))/g) ?? []).length, sourceArms.length,
    'the number of lifted conditions differs from the number of rules that start from <html>');
});

test('no rule in the reader\'s copy is left that cannot match inside the scope', () => {
  // Everything here lives on <html> or <body>, outside the landing, so a scoped rule
  // that starts from one of them can never match. The rewrite handles html and :root;
  // the rest would need it too, so the file must not start a rule from them.
  const OUTSIDE = /^(?:html|:root|body)(?![\w-])|^\[(?:data-theme|dir|lang|data-a11y-[a-z]+)\b|^\.dark(?![\w-])/i;
  const stuck = arms(decomment(liftRootConditions(SOURCE)))
    .filter((a) => OUTSIDE.test(a.arm))
    .map((a) => `  ${SHEET}:${a.line}  ${a.arm}`);
  assert.deepEqual(stuck, [], `these rules start outside the landing, so the reader never applies them:\n${stuck.join('\n')}`);
});

test("the reader's <style> wraps the lifted file in the scope and puts landing mode after it", () => {
  const text = landingStyleText(SOURCE);
  assert.ok(text.startsWith('@scope (.docs-landing) {\n'), 'the band CSS is no longer inside @scope (.docs-landing)');
  const lifted = liftRootConditions(SOURCE);
  const at = text.indexOf(lifted);
  assert.ok(at > 0, 'the scoped block does not hold the lifted file');
  const tail = text.slice(at + lifted.length);
  assert.match(tail, /^\n\}\n/, 'the scope does not close straight after the file');
  assert.ok(tail.includes('.docs-reader--landing .reveal'), 'the reveal neutralizer is missing after the scope');
  assert.ok(!text.includes('html[data-theme="dark"] .'), 'a dark-theme rule reached the reader unlifted');
});

// ── 3. The hero word in the reader ────────────────────────────────────────────

/** Where the reader asked for less motion: the OS, the app's switch, or neither. */
interface Asked { os?: boolean; app?: boolean }

/** A bare stand-in page for hydrateLandingCycle: one cycling link, its word and its
 *  swaps counted, and the two signals as switches the test can flip mid-cycle. */
function readerHero(t: TestContext, asked: Asked) {
  const state = { os: !!asked.os, app: !!asked.app };
  const dataset: Record<string, string> = {};
  const sync = (): void => { if (state.app) dataset.a11yMotion = 'reduce'; else delete dataset.a11yMotion; };
  sync();
  const scope = globalThis as unknown as Record<string, unknown>;
  const saved = { document: scope.document, matchMedia: scope.matchMedia };
  scope.document = { hidden: false, documentElement: { dataset } };
  scope.matchMedia = (query: string) => ({ matches: state.os && /prefers-reduced-motion:\s*reduce/.test(query) });
  t.after(() => { scope.document = saved.document; scope.matchMedia = saved.matchMedia; });

  const word = { textContent: 'is free' };
  let swaps = 0;
  const link = {
    isConnected: true,
    getAttribute: (name: string) => (name === 'data-cycle'
      ? JSON.stringify([{ w: 'is free', h: '/info/a.html' }, { w: 'is private', h: '/info/b.html' }, { w: 'is yours', h: '/info/c.html' }])
      : null),
    setAttribute: () => undefined,
    querySelector: () => word,
    addEventListener: () => undefined,
    classList: { add: (name: string) => { if (name === 'is-swapping') swaps++; }, remove: () => undefined },
  };
  hydrateLandingCycle({ querySelector: (sel: string) => (sel === '#heroCycle' ? link : null) } as unknown as ParentNode);
  return {
    word,
    get swaps() { return swaps; },
    set(next: Asked) { state.os = !!next.os; state.app = !!next.app; sync(); },
  };
}

/** Advance the mocked clock in small steps. Node moves the clock to the end of a tick
 *  before it runs the callbacks, so a timeout set inside one would only run a tick later. */
function run(t: TestContext, ms: number): void {
  for (let left = ms; left > 0; left -= 100) t.mock.timers.tick(Math.min(100, left));
}

test("the reader's hero word cycles for a reader who asked for nothing", (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
  const hero = readerHero(t, {});
  run(t, 2800 * 2 + 300);
  assert.equal(hero.swaps, 2);
  assert.equal(hero.word.textContent, 'is yours');
});

test("the reader's hero word stands still for either signal", (t) => {
  for (const asked of [{ os: true }, { app: true }] as Asked[]) {
    t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
    const hero = readerHero(t, asked);
    run(t, 2800 * 4);
    assert.equal(hero.swaps, 0, `the word moved under ${asked.os ? 'the OS setting' : "the app's switch"}`);
    assert.equal(hero.word.textContent, 'is free');
    t.mock.timers.reset();
  }
});

test("turning the app's switch on mid-cycle stops the word where it is", (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout', 'Date'] });
  const hero = readerHero(t, {});
  run(t, 2800 + 300);
  assert.equal(hero.word.textContent, 'is private');
  hero.set({ app: true });
  run(t, 2800 * 4);
  assert.equal(hero.swaps, 1, 'the word kept cycling after Reduce motion was turned on');
  assert.equal(hero.word.textContent, 'is private');
  hero.set({});
  run(t, 2800 + 300);
  assert.equal(hero.word.textContent, 'is yours', 'the cycle did not pick up again once Reduce motion was off');
});
