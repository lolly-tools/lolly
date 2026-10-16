// SPDX-License-Identifier: MPL-2.0
/**
 * The CSS house rules check (scripts/check-house-rules.ts): each rule against
 * small inline fixtures, the embedded CSS extraction, the allowlist and the
 * ratchet, then the real tree against its committed baseline.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  type Finding,
  type Counts,
  checkAllow,
  collectDefinitions,
  collectMotionKeys,
  countByFileRule,
  drift,
  extractDocsCss,
  extractHtmlCss,
  hasCatchAll,
  parseCss,
  scanCss,
  writeBaseline,
} from '../scripts/check-house-rules.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// A template interpolation's opening, built so this file holds no literal one.
const OPEN = '$' + '{';
const rule = (css: string, id: string, ctx = {}): Finding[] => scanCss(css, 'x.css', ctx).filter((f) => f.rule === id);

// ─── H1 ───────────────────────────────────────────────────────────────────────

test('H1: an inset rail on a rounded row is flagged; a square row is not', () => {
  assert.equal(rule('.row { border-radius: 8px; box-shadow: inset 2px 0 0 red; }', 'H1').length, 1);
  assert.equal(rule('.row { border-radius: 0; box-shadow: inset 2px 0 0 red; }', 'H1').length, 0);
  assert.equal(rule('.row { box-shadow: inset 2px 0 0 red; }', 'H1').length, 0);
});

test('H1: a state rule finds the radius on its base rule', () => {
  const css = '.x { border-radius: var(--radius); }\n.x.is-set { box-shadow: inset 2px 0 0 hsl(var(--primary)); }';
  const found = rule(css, 'H1');
  assert.equal(found.length, 1);
  assert.equal(found[0]!.selector, '.x.is-set');
  assert.equal(found[0]!.line, 2);
  const attr = '.row { border-radius: 6px; }\n.row[data-kind=milestone] { border-inline-start: 3px solid red; }';
  assert.equal(rule(attr, 'H1').length, 1);
});

test('H1: a square-edged segment divider is not flagged', () => {
  const css = '.seg { border-inline-start: 1px solid red; border-start-start-radius: 0; border-end-start-radius: 0; border-start-end-radius: 99px; border-end-end-radius: 99px; }';
  assert.equal(rule(css, 'H1').length, 0);
  const fit = '.fit { border-inline-end: 1px solid red; border-radius: 6px 0 0 6px; }';
  assert.equal(rule(fit, 'H1').length, 0);
});

test('H1: the bevel token and a 1px top highlight are not rails', () => {
  assert.equal(rule('.b { border-radius: 8px; box-shadow: var(--bevel); }', 'H1').length, 0);
  assert.equal(rule('.b { border-radius: 8px; box-shadow: inset 0 1px 0 hsl(0 0% 100% / .4), 0 1px 2px #0003; }', 'H1').length, 0);
  assert.equal(rule('.b { border-radius: 8px; box-shadow: inset 0 0 0 1px red; }', 'H1').length, 0);
});

test('H1: a rule that sets its own radius 0 beats a rounded base', () => {
  const css = '.panel { border-radius: 12px; }\n.panel.is-docked { border-radius: 0; border-left: 1px solid red; }';
  assert.equal(rule(css, 'H1').length, 0);
});

test('H1: transparent, zero and none borders draw nothing', () => {
  const css = '.r { border-radius: 8px; border-left: 1px solid transparent; border-top: 0; border-bottom: none; border-right-width: 0; }';
  assert.equal(rule(css, 'H1').length, 0);
});

// ─── H2 ───────────────────────────────────────────────────────────────────────

test('H2: a dashed border is flagged; the word in a comment is not', () => {
  assert.equal(rule('.e { border: 1px dashed red; }', 'H2').length, 1);
  assert.equal(rule('.e { outline: 2px dashed red; }', 'H2').length, 1);
  assert.equal(rule('/* dashed means drop here */ .e { border: 1px solid red; }', 'H2').length, 0);
  assert.equal(rule('.e { border: 1px solid red; /* was dashed */ }', 'H2').length, 0);
});

test('H2: an allowlisted selector is not counted; stale entries and short reasons fail', () => {
  const findings = scanCss('.drop { border: 2px dashed red; }\n.empty { border: 1px dashed red; }', 'a.css');
  const allow = [
    { file: 'a.css', rule: 'H2' as const, selector: '.drop', reason: 'drop area: the file well wired with dragover and drop' },
    { file: 'a.css', rule: 'H2' as const, selector: '.gone', reason: 'drop area: a selector that no longer exists in the sheet' },
    { file: 'a.css', rule: 'H2' as const, selector: '.empty', reason: 'too short' },
  ];
  const a = checkAllow(findings, allow);
  assert.deepEqual(a.allowed.map((f) => f.selector).sort(), ['.drop', '.empty']);
  assert.deepEqual(a.counted, []);
  assert.deepEqual(a.stale.map((e) => e.selector), ['.gone']);
  assert.deepEqual(a.badReason.map((e) => e.selector), ['.empty']);
});

test('H2: allowlist selectors match with whitespace collapsed', () => {
  const findings = scanCss('.a,\n  .b   .c { outline: 1px dashed red; }', 'a.css');
  const a = checkAllow(findings, [{ file: 'a.css', rule: 'H2', selector: '.a, .b .c', reason: 'drop area: a selector list split across two lines' }]);
  assert.equal(a.allowed.length, 1);
});

// ─── H4 ───────────────────────────────────────────────────────────────────────

test('H4: a literal duration is flagged; the motion tokens and zero are not', () => {
  assert.equal(rule('.t { transition: opacity .2s; }', 'H4').length, 1);
  assert.equal(rule('.t { transition: opacity .2s ease .1s; }', 'H4').length, 2);
  assert.equal(rule('.t { transition: opacity var(--dur-1) var(--ease-out); }', 'H4').length, 0);
  assert.equal(rule('.t { transition: opacity var(--ui-motion-feedback); }', 'H4').length, 0);
  assert.equal(rule('.t { transition-delay: 0s; animation-delay: 0ms; }', 'H4').length, 0);
});

test('H4: the .01ms resets inside a reduce block are not counted', () => {
  const css = '@media (prefers-reduced-motion: reduce) { .t { transition-duration: .01ms !important; } }\n'
    + 'html[data-a11y-motion="reduce"] .t { animation-duration: .01ms !important; }';
  assert.equal(rule(css, 'H4').length, 0);
});

test('H4: a var() whose own definition is a literal counts', () => {
  assert.equal(rule('.t { --t-dur: 240ms; transition: transform var(--t-dur); }', 'H4').length, 1);
  assert.equal(rule('.t { --t-dur: var(--dur-2); transition: transform var(--t-dur); }', 'H4').length, 0);
});

// ─── H5 ───────────────────────────────────────────────────────────────────────

test('H5: a moving transition needs both reduce rules', () => {
  const move = '.m { transition: transform var(--dur-1); }\n';
  const os = '@media (prefers-reduced-motion: reduce) { .m { transition: none; } }\n';
  const app = 'html[data-a11y-motion="reduce"] .m { transition: none; }\n';
  assert.equal(rule(move, 'H5').length, 1);
  assert.equal(rule(move + os, 'H5').length, 1);
  assert.match(rule(move + os, 'H5')[0]!.detail, /data-a11y-motion/);
  assert.equal(rule(move + os + app, 'H5').length, 0);
});

test('H5: a nested at-rule keeps its own context under the owner rule', () => {
  const reduce = parseCss('.m { @media (prefers-reduced-motion: reduce) { transition: none; } }');
  const nested = reduce.find((r) => r.decls.some((d) => d.prop === 'transition'))!;
  assert.deepEqual(nested.selectors, ['.m']);
  assert.deepEqual(nested.at, ['@media (prefers-reduced-motion: reduce)']);
  const plain = parseCss('.m { color: red; @media (min-width: 1px) { color: blue; } }');
  assert.deepEqual(plain.find((r) => r.at.length === 0)!.decls.map((d) => d.value), ['red']);
});

test('H5: an opacity transition does not move', () => {
  assert.equal(rule('.m { transition: opacity var(--dur-1), color var(--dur-1); }', 'H5').length, 0);
  assert.equal(rule('.m { transition: var(--dur-1); }', 'H5').length, 1);
});

test('H5: motion declared only under no-preference and :not(reduce) is covered', () => {
  const css = '@media (prefers-reduced-motion: no-preference) { html:not([data-a11y-motion="reduce"]) .m { transition: transform var(--dur-1); } }';
  assert.equal(rule(css, 'H5').length, 0);
});

test('H5: an app animation passes while the catch-all exists; an /info one does not', () => {
  const css = '.spin { animation: spin var(--dur-3) linear infinite; }';
  assert.equal(rule(css, 'H5', { catchAll: true }).length, 0);
  assert.equal(rule(css, 'H5', { catchAll: false }).length, 1);
  assert.equal(rule(css, 'H5', { catchAll: true, info: true }).length, 1);
});

test('H5: reduce rules in another sheet of the same pool count', () => {
  const keys = collectMotionKeys(parseCss('@media (prefers-reduced-motion: reduce) { .m { transition: none; } }\nhtml[data-a11y-motion="reduce"] .m { transition: none; }'));
  assert.equal(rule('.wrap .m { transition: transform var(--dur-1); }', 'H5', { motionKeys: keys }).length, 0);
});

test('H5: the base.css catch-all is detected and its loss is noticed', () => {
  const catchAll = '@media (prefers-reduced-motion: reduce) { *:not(.tool-canvas), *:not(.tool-canvas)::before { animation-duration: 0.01ms !important; } }\n'
    + 'html[data-a11y-motion="reduce"] :not(.tool-canvas) { animation-duration: 0.01ms !important; }';
  assert.equal(hasCatchAll(catchAll), true);
  assert.equal(hasCatchAll(catchAll.split('\n')[0]!), false);
});

// ─── H6 ───────────────────────────────────────────────────────────────────────

test('H6: an undefined custom property without a fallback is flagged', () => {
  const definitions = collectDefinitions([
    ':root { --known: red; }',
    "el.style.setProperty('--set-by-script', '1px');",
    `const style = \`--shot-${OPEN}axis}: ${OPEN}n}\`;`,
    '@property --registered { syntax: "<length>"; }',
  ]);
  const css = '.a { color: var(--nope); background: var(--nope, red); border-color: var(--known); '
    + 'width: var(--set-by-script); height: var(--shot-h); top: var(--registered); }';
  const found = rule(css, 'H6', { definitions });
  assert.deepEqual(found.map((f) => f.detail), ['var(--nope) is defined nowhere']);
});

// ─── Embedded CSS ─────────────────────────────────────────────────────────────

test('extractDocsCss finds the literals with true line offsets and skips interpolations', () => {
  const src = [
    "const A = readFileSync('x');",
    'const CSS = `',
    '.one { color: red; }',
    `${OPEN}APP_TOKENS}`,
    '.two { border: 1px dashed red; }',
    '`.trim();',
    'const EDITION_CSS = `',
    '.three { outline: 1px dashed red; }',
    '`;',
    'const NOSCRIPT_NAV = `<noscript><style>.four{border:1px dashed red}</style></noscript>`;',
  ].join('\n');
  const blocks = extractDocsCss(src);
  assert.equal(blocks.length, 3);
  assert.ok(!blocks[0]!.text.includes('APP_TOKENS'));
  const lines = blocks.flatMap((b) => scanCss(b.text, 'docs/build.ts', { lineOffset: b.lineOffset }).filter((f) => f.rule === 'H2').map((f) => f.line));
  assert.deepEqual(lines, [5, 8, 10]);
});

test('extractHtmlCss finds both <style> blocks and ignores a comment that mentions one', () => {
  const html = [
    '<head>',
    '<style>',
    '.a { border: 1px dashed red; }',
    '</style>',
    '<!-- this <style> is page-global -->',
    '<p>body</p>',
    '<svg><style>.b { outline: 1px dashed red; }</style></svg>',
  ].join('\n');
  const blocks = extractHtmlCss(html);
  assert.equal(blocks.length, 2);
  const lines = blocks.flatMap((b) => scanCss(b.text, 'index.html', { lineOffset: b.lineOffset }).map((f) => f.line));
  assert.deepEqual(lines, [3, 7]);
});

// ─── Ratchet ──────────────────────────────────────────────────────────────────

test('drift reports a rise, a new entry and an unrecorded fall', () => {
  const baseline: Counts = { 'a.css': { H2: 2, H4: 1 }, 'b.css': { H1: 1 }, 'gone.css': { H2: 4 } };
  const current: Counts = { 'a.css': { H2: 3, H5: 1 }, 'c.css': { H6: 1 } };
  const d = drift(current, baseline, (f) => f !== 'gone.css');
  assert.deepEqual(d.over, [{ file: 'a.css', rule: 'H2', was: 2, now: 3 }]);
  assert.deepEqual(d.fresh, [{ file: 'a.css', rule: 'H5', now: 1 }, { file: 'c.css', rule: 'H6', now: 1 }]);
  assert.deepEqual(d.under, [{ file: 'a.css', rule: 'H4', was: 1, now: 0 }, { file: 'b.css', rule: 'H1', was: 1, now: 0 }]);
});

test('writeBaseline refuses a rise or a new entry and records a fall', () => {
  const baseline: Counts = { 'a.css': { H2: 2 } };
  assert.equal(writeBaseline({ 'a.css': { H2: 3 } }, baseline, () => true).ok, false);
  assert.equal(writeBaseline({ 'a.css': { H2: 2, H4: 1 } }, baseline, () => true).ok, false);
  const fell = writeBaseline({ 'a.css': { H2: 1 } }, baseline, () => true);
  assert.ok(fell.ok);
  assert.deepEqual(JSON.parse(fell.text), { 'a.css': { H2: 1 } });
  const first = writeBaseline({ 'b.css': { H4: 2, H1: 1 } }, null);
  assert.ok(first.ok);
  assert.equal(first.text, '{\n  "b.css": {\n    "H1": 1,\n    "H4": 2\n  }\n}\n');
});

test('countByFileRule counts per file and rule', () => {
  const f = (file: string, r: Finding['rule']): Finding => ({ file, line: 1, rule: r, selector: '.x', detail: '' });
  assert.deepEqual(countByFileRule([f('a', 'H2'), f('a', 'H2'), f('b', 'H6')]), { a: { H2: 2 }, b: { H6: 1 } });
});

// ─── The real tree ────────────────────────────────────────────────────────────

test('the real tree holds against the committed baseline', () => {
  const result = spawnSync(process.execPath, ['scripts/check-house-rules.ts'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /CSS house rules hold/);
});
