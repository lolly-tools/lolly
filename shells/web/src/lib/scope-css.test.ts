// SPDX-License-Identifier: MPL-2.0
// Contract tests for the shared CSS scoper - including the two regressions the
// old regex caused, which tools had to work around by hand.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { scopeCss, unscopeCss, scopeTemplateStyles, unscopeStyleEls } from './scope-css.ts';

const S = '#c';
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

test('scopes a simple rule and every selector in a list', () => {
  assert.equal(norm(scopeCss('.a{color:red}', S)), '#c .a {color:red}');
  const list = scopeCss('.a, .b .c{color:red}', S);
  assert.match(list, /#c \.a/);
  assert.match(list, /#c \.b \.c/);
});

test('regression: the FIRST rule inside @media is scoped (regex left it global)', () => {
  const out = scopeCss('@media (max-width:600px){.a{color:red}.b{color:blue}}', S);
  assert.match(out, /@media \(max-width:600px\)/); // prelude untouched
  assert.match(out, /#c \.a/);                     // first child now scoped
  assert.match(out, /#c \.b/);
});

test('regression: multi-step @keyframes stops are NOT scoped (regex corrupted them)', () => {
  const out = scopeCss('@keyframes spin{from{opacity:0}50%{opacity:.5}to{opacity:1}}', S);
  assert.match(out, /@keyframes spin/);
  assert.doesNotMatch(out, /#c\s+(from|to|50%)/); // stops stay bare
  for (const stop of ['from{', '50%{', 'to{']) assert.ok(out.includes(stop), `kept ${stop}`);
});

test('nested @media inside @media still scopes the inner style rules', () => {
  assert.match(scopeCss('@media screen{@media (min-width:1px){.a{}}}', S), /#c \.a/);
});

test('regression: an at-rule directly after a comment is still an at-rule', () => {
  // The prelude buffer carries the comment, so a trim-only check saw `/…` and
  // scoped `@supports (…)` like a selector - `#c @supports (…) { … }` is an
  // invalid rule the browser drops wholesale, inner rules and all (jump's
  // cinema washes shipped dead this way).
  const out = scopeCss('/* washes */\n@supports (background: color-mix(in oklch, red, blue)){.a{color:red}}', S);
  assert.doesNotMatch(out, /#c @supports/);
  assert.match(out, /@supports \(background: color-mix\(in oklch, red, blue\)\)/);
  assert.match(out, /#c \.a/);
  const med = scopeCss('/* note */@media screen{.a{}}', S);
  assert.doesNotMatch(med, /#c @media/);
  assert.match(med, /#c \.a/);
});

test('at-statements and @font-face bodies are left alone', () => {
  assert.match(scopeCss('@import "x.css";.a{}', S), /@import "x\.css";/);
  const ff = scopeCss('@font-face{font-family:Foo;src:url(a.woff2)}', S);
  assert.match(ff, /@font-face\s*\{/);
  assert.doesNotMatch(ff, /#c/); // no selector inside to scope
});

test('braces inside strings and comments are not treated as blocks', () => {
  const out = scopeCss('.a{content:"}"}/* .z{} */.b{}', S);
  assert.match(out, /#c \.a/);
  assert.match(out, /#c \.b/);
  assert.doesNotMatch(out, /#c \.z/); // the .z in the comment must not be scoped
});

// ─── top-level-only comma splitting (bracket/string/comment aware) ───────────
// A comma inside :is()/:where()/:not()/[attr] or a comment must NOT split the
// list and must NOT inject a scope prefix inside the parens/string.
const count = (s: string, needle: string) => s.split(needle).length - 1;

test('comma inside :is() is not a list separator', () => {
  const out = scopeCss(':is(.a, .b) span{color:red}', S);
  assert.equal(count(out, S), 1, 'exactly one scope prefix');
  assert.doesNotMatch(out, /\([^)]*#c/, 'no scope token inside parentheses');
  assert.match(out, /#c :is\(\.a, \.b\) span/);
});

test('comma inside an [attr="a,b"] value is preserved', () => {
  const out = scopeCss('[data-title="Hello, World"]{color:red}', S);
  assert.equal(count(out, S), 1);
  assert.ok(out.includes('[data-title="Hello, World"]'), 'attribute value intact');
  assert.doesNotMatch(out, /Hello, #c/);
});

test('top-level list mixed with a functional-pseudo comma', () => {
  const out = scopeCss('.x:not(.a, .b), .y{color:red}', S);
  assert.equal(count(out, S), 2, 'two real list members, not three');
  assert.match(out, /#c \.x:not\(\.a, \.b\)/, ':not() args kept together');
  assert.match(out, /#c \.y/);
});

test(':where() and :nth-child(An+B of …) commas are not splits', () => {
  assert.equal(count(scopeCss(':where(.a, .b){}', S), S), 1);
  const nth = scopeCss(':nth-child(2n of .a, .b){}', S);
  assert.equal(count(nth, S), 1);
  assert.doesNotMatch(nth, /\([^)]*#c/);
});

test('comment inside a selector list is not a delimiter', () => {
  const out = scopeCss('.a /*x*/, .b{}', S);
  assert.equal(count(out, S), 2);
  assert.ok(out.includes('/*x*/'), 'comment preserved');
});

// ─── conditional group nested in a style rule (native CSS nesting) ───────────
test('nested @media as first child: relative children stay unscoped', () => {
  const out = scopeCss('.card{@media (min-width:600px){.title{color:blue}}}', S);
  assert.equal(count(out, S), 1, 'only .card is scoped');
  assert.match(out, /#c \.card/);
  assert.match(out, /@media \(min-width:600px\)/, 'prelude untouched');
  assert.doesNotMatch(out, /#c \.title/, '.title is relative to .card, not scoped');
});

test('nested conditional group is order-independent (after a nested rule OR a declaration)', () => {
  const afterRule = scopeCss('.card{.a{}@media (min-width:1px){.b{}}}', S);
  assert.equal(count(afterRule, S), 1);
  assert.doesNotMatch(afterRule, /#c \.b/);
  const afterDecl = scopeCss('.card{color:red;@media (min-width:1px){.b{}}}', S);
  assert.equal(count(afterDecl, S), 1);
  assert.doesNotMatch(afterDecl, /#c \.b/);
});

test('& nesting stays relative (never scoped)', () => {
  const out = scopeCss('.card{&:hover{color:red}}', S);
  assert.match(out, /#c \.card/);
  assert.doesNotMatch(out, /#c\s*&/, '& is relative to the parent rule');
});

// ─── corpus sweep: run the scoper over every real tool styles.css ────────────
// Structural check (string/comment/bracket aware) that the scope token is never
// injected inside a (…)/[…] group, a '…'/"…" string, or a /* … */ comment.
// A regex can't do this - it spans across quotes - so we scan properly.
function tokenLeaks(css: string, token: string): boolean {
  let i = 0, depth = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {
      const e = css.indexOf('*/', i + 2); const j = e === -1 ? n : e + 2;
      if (css.slice(i, j).includes(token)) return true; i = j; continue;
    }
    if (c === '"' || c === "'") {
      const q = c; let j = i + 1;
      while (j < n && css[j] !== q) { j += css[j] === '\\' ? 2 : 1; }
      if (css.slice(i, j + 1).includes(token)) return true; i = j + 1; continue;
    }
    if (c === '(' || c === '[') { depth++; i++; continue; }
    if (c === ')' || c === ']') { if (depth > 0) depth--; i++; continue; }
    if (depth > 0 && css.startsWith(token, i)) return true;
    i++;
  }
  return false;
}

test('corpus: scoping every tool styles.css never leaks the token into parens or strings', () => {
  const TK = '.zzscopezz'; // distinctive: never collides with hex colours (#ccc…)
  const toolsDir = fileURLToPath(new URL('../../../../tools', import.meta.url));
  let checked = 0;
  for (const d of readdirSync(toolsDir, { withFileTypes: true })) {
    // tools/ is a profile VIEW (symlink farm - scripts/use-profile.ts), so tool
    // dirs are symlinks here: Dirent.isDirectory() is false for them.
    if (!d.isDirectory() && !d.isSymbolicLink()) continue;
    const p = `${toolsDir}/${d.name}/styles.css`;
    if (!existsSync(p)) continue;
    const css = readFileSync(p, 'utf8');
    const out = scopeCss(css, TK);
    checked++;
    assert.ok(!tokenLeaks(out, TK), `${d.name}: scope token leaked into a paren/string/comment`);
    assert.equal(count(out, '{'), count(css, '{'), `${d.name}: '{' balance preserved`);
    assert.equal(count(out, '}'), count(css, '}'), `${d.name}: '}' balance preserved`);
    assert.doesNotThrow(() => scopeCss(out, TK), `${d.name}: re-scoping does not crash`);
  }
  assert.ok(checked > 0, 'expected to find at least one tool styles.css');
});

test('empty input returns empty', () => {
  assert.equal(scopeCss('', S), '');
});

// ─── Containment of a template's own <style> (see scopeTemplateStyles) ────────
// A tool's template.html may open with a global reset. Injected verbatim it lands
// unscoped AND unlayered, which beats every @layer in styles/app.css regardless of
// specificity and strips the padding off the whole app chrome. Scoping is what stops
// tool data from reaching outside its canvas.

test('a universal reset is confined to the scope', () => {
  assert.equal(
    norm(scopeCss('*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }', S)),
    '#c *, #c *::before, #c *::after { box-sizing: border-box; margin: 0; padding: 0; }'
  );
});

test(':root maps onto the scope rather than nesting under it', () => {
  // `#c :root` could never match - :root is <html>, which is never inside the canvas - 
  // so the rule would vanish and take the tool's custom properties with it.
  assert.equal(norm(scopeCss(':root{--brand:red}', S)), '#c {--brand:red}');
});

test('html and body map onto the scope too', () => {
  assert.equal(norm(scopeCss('html{margin:0}', S)), '#c {margin:0}');
  assert.equal(norm(scopeCss('body{margin:0}', S)), '#c {margin:0}');
});

test('a root selector in a list collapses without emitting the scope twice', () => {
  assert.equal(norm(scopeCss(':root, body{--x:1}', S)), '#c {--x:1}');
  assert.equal(norm(scopeCss(':root, .a{--x:1}', S)), '#c, #c .a {--x:1}');
});

test('root mapping does not touch selectors that merely start with a root name', () => {
  // `body.dark` / `html[dir]` still describe the document root, but they carry extra
  // qualifiers, so they are NOT bare root selectors - prefixing keeps today's behaviour
  // rather than silently widening the rule to the whole canvas.
  assert.equal(norm(scopeCss('.body{margin:0}', S)), '#c .body {margin:0}');
  assert.equal(norm(scopeCss('body .a{margin:0}', S)), '#c body .a {margin:0}');
});

// ── unscoping (export path) ───────────────────────────────────────────────────
// An SVG export clones the tool's inline <svg> into a STANDALONE file, where no
// canvas ancestor exists - so a scoped rule inside it can never match and the
// artwork's paths lose their fill (they render BLACK). unscopeStyleEls releases
// exactly what scopeTemplateStyles pinned. Regression: pose-geeko's legs.

test('unscopeCss reverses scopeCss for the same scope', () => {
  // scopeCss re-emits `sel {` with a space, so the round-trip is semantic, not
  // byte-exact - normalise the brace spacing before comparing.
  const nb = (s: string) => norm(s).replace(/\s*\{\s*/g, '{');
  for (const css of [
    '.a{color:red}',
    '.a, .b .c{color:red}',
    '@media (max-width:600px){.a{color:red}.b{color:blue}}',
    '@keyframes spin{from{opacity:0}50%{opacity:.5}to{opacity:1}}',
    ':is(.a, .b) span{color:red}',
    '.cls-18{fill:#32b678}',
  ]) {
    assert.equal(nb(unscopeCss(scopeCss(css, S), S)), nb(css), `round-trip failed for: ${css}`);
  }
});

test('unscopeCss leaves selectors it did not scope alone', () => {
  assert.equal(norm(unscopeCss('.a {color:red}', S)), '.a {color:red}');
  // A selector that merely mentions the scope elsewhere is not a prefix match.
  assert.equal(norm(unscopeCss('.x #c .a {color:red}', S)), '.x #c .a {color:red}');
});

test('a root selector survives the scope round-trip as :root', () => {
  // scopeSelectorList collapses :root/html/body onto the scope element itself;
  // unscoping maps it back to :root - the root of a standalone SVG document.
  assert.equal(norm(unscopeCss(scopeCss(':root{--x:1}', S), S)).replace(/\s*\{\s*/g, '{'), ':root{--x:1}');
});

test('scopeTemplateStyles records its scope and unscopeStyleEls releases it', () => {
  const doc = new JSDOM('<div id="c"><svg><style>.cls-18{fill:#32b678}</style></svg></div>').window.document;
  const container = doc.getElementById('c')!;
  scopeTemplateStyles(container, S);
  const styleEl = container.querySelector('style')!;
  assert.equal(norm(styleEl.textContent!), '#c .cls-18 {fill:#32b678}');
  assert.equal(styleEl.getAttribute('data-lolly-scope'), S);

  // The export clones the <svg> out of the canvas, then releases the scope.
  const clone = container.querySelector('svg')!.cloneNode(true) as Element;
  unscopeStyleEls(clone);
  const cloned = clone.querySelector('style')!;
  assert.equal(norm(cloned.textContent!), '.cls-18 {fill:#32b678}');
  // The marker is an internal detail - it must not ride into the exported file.
  assert.equal(cloned.hasAttribute('data-lolly-scope'), false);
  // The live node keeps its scoping (the clone is what leaves).
  assert.equal(norm(styleEl.textContent!), '#c .cls-18 {fill:#32b678}');
});

test('unscopeStyleEls ignores a <style> it never scoped', () => {
  const doc = new JSDOM('<svg><style>.a{fill:red}</style></svg>').window.document;
  const svg = doc.querySelector('svg')!;
  unscopeStyleEls(svg);
  assert.equal(norm(svg.querySelector('style')!.textContent!), '.a{fill:red}');
});
