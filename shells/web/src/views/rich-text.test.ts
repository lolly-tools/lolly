// SPDX-License-Identifier: MPL-2.0
// Unit tests for the Design rich-text char model (rich-text.js).
// charsFromDom is DOM-agnostic (nodeType/nodeName/childNodes/nodeValue only),
// so these tests feed it plain object trees - no jsdom.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  charsFromDom, htmlFromChars, markdownFromChars,
  rangeHasFlag, setFlag, setColor, rangeColor, wordRangeAt, allBulleted, toggleBullets,
  setWeight, rangeWeight, allNumbered, toggleNumbers, clearFormatting,
  setFont, rangeFont,
} from './rich-text.ts';

const t = (text: string): any => ({ nodeType: 3, nodeValue: text, childNodes: [] });
const el = (name: string, ...childNodes: any[]): any => ({ nodeType: 1, nodeName: name, childNodes });
const root = (...kids: any[]): any => el('DIV', ...kids);
// A styled span mock (colour + numeric weight via data-fc-* / inline style).
const span = (opts: any, ...childNodes: any[]): any => ({
  nodeType: 1, nodeName: 'SPAN', childNodes,
  getAttribute: (n: string) => (n === 'data-fc-color' ? (opts.dataC ?? null) : n === 'data-fc-weight' ? (opts.dataW ?? null) : n === 'data-fc-font' ? (opts.dataF ?? null) : null),
  style: { color: opts.color ?? '', fontWeight: opts.weight ?? '', fontFamily: opts.family ?? '' },
});
const plain = (s: string): any[] => [...s].map((ch) => ({ ch, b: false, i: false }));
const str = (chars: any[]): string => chars.map((c: any) => c.ch).join('');

test('charsFromDom flattens text with strong/em flags', () => {
  const chars = charsFromDom(root(t('a '), el('STRONG', t('b'), el('EM', t('c'))), t(' d')));
  assert.equal(str(chars), 'a bc d');
  assert.deepEqual(chars.map((c) => [c.b, c.i]), [
    [false, false], [false, false], [true, false], [true, true], [false, false], [false, false],
  ]);
});

test('charsFromDom: BR and block elements become newlines, nbsp becomes space', () => {
  const chars = charsFromDom(root(t('a b'), el('BR'), el('DIV', t('c')), el('DIV', t('d'))));
  assert.equal(str(chars), 'a b\nc\nd');
});

test('html round-trip: charsFromDom(htmlFromChars(x)) is stable in structure', () => {
  const chars: any[] = [
    ...plain('He'),
    { ch: 'l', b: true, i: false }, { ch: 'l', b: true, i: false },
    { ch: 'o', b: true, i: true },
    ...plain(' <&> hi'),
  ];
  const html = htmlFromChars(chars);
  assert.equal(html, 'He<strong>ll</strong><strong><em>o</em></strong> &lt;&amp;&gt; hi');
});

test('markdownFromChars emits **bold**, *italic*, ***both*** per line', () => {
  const chars: any[] = [
    { ch: 'a', b: true, i: false },
    { ch: ' ', b: false, i: false },
    { ch: 'b', b: false, i: true },
    { ch: '\n', b: false, i: false },
    { ch: 'c', b: true, i: true },
  ];
  assert.equal(markdownFromChars(chars), '**a** *b*\n***c***');
});

test('markdownFromChars escapes literal * and _ so they cannot re-parse as emphasis', () => {
  assert.equal(markdownFromChars(plain('5 * 3 * 2 and _x_')), '5 \\* 3 \\* 2 and \\_x\\_');
});

test('markdownFromChars maps "•  " bullet lines back to "- " and drops one trailing newline', () => {
  const chars = plain('•  first\n•  second\n');
  assert.equal(markdownFromChars(chars), '- first\n- second');
});

test('whitespace-only formatted runs carry no markers', () => {
  const chars: any[] = [
    { ch: 'a', b: true, i: false },
    { ch: ' ', b: true, i: false },
    { ch: 'b', b: false, i: false },
  ];
  assert.equal(markdownFromChars(chars), '**a** b');
});

test('rangeHasFlag / setFlag toggle over a char range, skipping newlines', () => {
  let chars: any[] = plain('ab\ncd');
  assert.equal(rangeHasFlag(chars, 0, 5, 'b'), false);
  chars = setFlag(chars, 0, 5, 'b', true);
  assert.equal(rangeHasFlag(chars, 0, 5, 'b'), true);
  assert.equal(chars[2].b, false); // the newline is untouched
  chars = setFlag(chars, 3, 5, 'b', false);
  assert.equal(rangeHasFlag(chars, 0, 2, 'b'), true);
  assert.equal(rangeHasFlag(chars, 3, 5, 'b'), false);
});

test('wordRangeAt expands a caret to the surrounding word', () => {
  const chars = plain('hello world');
  assert.deepEqual(wordRangeAt(chars, 7), [6, 11]);
  assert.deepEqual(wordRangeAt(chars, 5), [0, 5]);   // caret at end of "hello"
  const ws = wordRangeAt(plain('a  b'), 2);
  assert.deepEqual(ws, [2, 2]);                       // whitespace gap → empty
});

test('toggleBullets adds "•  " to every non-blank line, then removes it, keeping indent', () => {
  const on = toggleBullets(plain('one\n\n  two'));
  assert.equal(str(on), '•  one\n\n  •  two');
  assert.equal(allBulleted(on), true);
  const off = toggleBullets(on);
  assert.equal(str(off), 'one\n\n  two');
});

// ── colour runs ──────────────────────────────────────────────────────────────
test('htmlFromChars emits a colour span per homogeneous (b,i,c) run', () => {
  const chars: any[] = [
    ...plain('a'),
    { ch: 'b', b: false, i: false, c: '#ff0000' },   // red, not bold
    { ch: 'c', b: true, i: false, c: '#ff0000' },    // red + bold → its own run
  ];
  const S = (inner: string) => `<span data-fc-color="#ff0000" style="color:#ff0000">${inner}</span>`;
  assert.equal(htmlFromChars(chars), 'a' + S('b') + S('<strong>c</strong>'));
  // a single uniform run stays one span
  assert.equal(htmlFromChars([{ ch: 'x', b: false, i: false, c: '#00ff00' }] as any),
    '<span data-fc-color="#00ff00" style="color:#00ff00">x</span>');
});

test('charsFromDom reads colour from data-fc-color and inline style.color (rgb→hex)', () => {
  const span = (color: string, dataC: string | null, ...kids: any[]): any => ({
    nodeType: 1, nodeName: 'SPAN', childNodes: kids,
    getAttribute: (n: string) => (n === 'data-fc-color' ? dataC : null),
    style: { color },
  });
  const chars = charsFromDom(root(t('a'), span('', '#00ff00', t('b')), span('rgb(0, 0, 255)', null, t('c'))));
  assert.equal(str(chars), 'abc');
  assert.deepEqual(chars.map((c) => c.c), [null, '#00ff00', '#0000ff']);
});

test('markdownFromChars wraps a coloured run {#hex|…}', () => {
  const chars: any[] = [...plain('red '), { ch: 'G', b: false, i: false, c: '#00aa00' }, { ch: 'O', b: false, i: false, c: '#00aa00' }];
  assert.equal(markdownFromChars(chars), 'red {#00aa00|GO}');
});

test('colour wraps outside bold and escapes literal *', () => {
  const chars: any[] = [{ ch: 'x', b: true, i: false, c: '#123456' }, { ch: '*', b: false, i: false, c: '#123456' }];
  assert.equal(markdownFromChars(chars), '{#123456|**x**}{#123456|\\*}');
});

test('setColor / rangeColor over a range (skips newlines, clears on null)', () => {
  let chars: any[] = plain('ab\ncd');
  assert.equal(rangeColor(chars, 0, 5), null);
  chars = setColor(chars, 0, 5, '#112233');
  assert.equal(rangeColor(chars, 0, 5), '#112233');
  assert.equal(chars[2].c == null, true);       // the newline stays uncoloured
  chars = setColor(chars, 3, 5, '#445566');
  assert.equal(rangeColor(chars, 0, 5), null);   // now mixed
  chars = setColor(chars, 0, 5, null);
  assert.equal(rangeColor(chars, 0, 5), null);   // cleared
});

// The run-colour wire format is hex, deliberately, and the colour picker's emitted
// value stays a lowercase #rrggbb(aa) - free-canvas pipes it straight into setColor
// via applyRunColor. This pins both halves: a hex survives into the char model AND
// into the markdown serialiser, and a wider CSS colour is REFUSED rather than stored
// half-way (setColor's isHex gate reads it as "clear the run"). Widening the markup
// format is a separate pass; until then a caller must bake to hex first.
test('setColor stores plain hex and refuses a wider CSS colour', () => {
  let chars: any[] = plain('ab');
  chars = setColor(chars, 0, 2, '#112233ff');
  assert.equal(rangeColor(chars, 0, 2), '#112233ff');
  assert.match(markdownFromChars(chars), /\{#112233ff\|/);   // {#hex|…} markup round-trips
  chars = setColor(chars, 0, 2, 'oklch(62% 0.19 260)');
  assert.equal(rangeColor(chars, 0, 2), null);               // cleared, never stored raw
  chars = setColor(chars, 0, 2, 'rebeccapurple');
  assert.equal(rangeColor(chars, 0, 2), null);
});

// ── per-run weight ────────────────────────────────────────────────────────────
test('setWeight / rangeWeight over a range (clamps, skips newlines, clears on null)', () => {
  let chars: any[] = plain('ab\ncd');
  assert.equal(rangeWeight(chars, 0, 5), null);
  chars = setWeight(chars, 0, 5, 640);            // clamps to nearest 100-step
  assert.equal(rangeWeight(chars, 0, 5), 600);
  assert.equal(chars[2].w == null, true);         // the newline stays unweighted
  chars = setWeight(chars, 3, 5, 300);
  assert.equal(rangeWeight(chars, 0, 5), null);   // now mixed
  chars = setWeight(chars, 0, 5, NaN);
  assert.equal(rangeWeight(chars, 0, 5), null);   // cleared
});

test('clearFormatting strips bold/italic/weight/colour over a range, keeps text + newlines', () => {
  let chars: any[] = plain('ab\ncd');
  chars = setFlag(chars, 0, 5, 'b', true);
  chars = setFlag(chars, 0, 5, 'i', true);
  chars = setColor(chars, 0, 2, '#112233');
  chars = setWeight(chars, 3, 5, 600);
  const cleared = clearFormatting(chars, 0, 5);
  assert.equal(rangeHasFlag(cleared, 0, 5, 'b'), false);
  assert.equal(rangeHasFlag(cleared, 0, 5, 'i'), false);
  assert.equal(rangeColor(cleared, 0, 5), null);
  assert.equal(rangeWeight(cleared, 0, 5), null);
  assert.equal(cleared.map((c) => c.ch).join(''), 'ab\ncd');   // characters untouched
});

test('clearFormatting only affects the given range', () => {
  const chars: any[] = setFlag(plain('abcd'), 0, 4, 'b', true);
  const cleared = clearFormatting(chars, 0, 2);
  assert.equal(rangeHasFlag(cleared, 0, 2, 'b'), false);       // in-range cleared
  assert.equal(rangeHasFlag(cleared, 2, 4, 'b'), true);        // out-of-range kept
});

test('setWeight clears bold and setFlag bold clears weight (same axis)', () => {
  let chars: any[] = setFlag(plain('hi'), 0, 2, 'b', true);
  chars = setWeight(chars, 0, 2, 300);
  assert.deepEqual(chars.map((c) => [c.b, c.w]), [[false, 300], [false, 300]]);
  chars = setFlag(chars, 0, 2, 'b', true);
  assert.deepEqual(chars.map((c) => [c.b, c.w]), [[true, null], [true, null]]);
});

test('htmlFromChars emits a weight span; combined with colour uses one span', () => {
  assert.equal(htmlFromChars([{ ch: 'x', b: false, i: false, w: 800 }] as any),
    '<span data-fc-weight="800" style="font-weight:800">x</span>');
  assert.equal(htmlFromChars([{ ch: 'y', b: false, i: false, c: '#ff0000', w: 300 }] as any),
    '<span data-fc-color="#ff0000" data-fc-weight="300" style="color:#ff0000;font-weight:300">y</span>');
});

test('markdownFromChars wraps a weight run {wNNN|…} and colour+weight together', () => {
  assert.equal(markdownFromChars([{ ch: 'A', b: false, i: false, w: 300 }, { ch: 'B', b: false, i: false, w: 300 }] as any),
    '{w300|AB}');
  assert.equal(markdownFromChars([{ ch: 'Z', b: false, i: false, c: '#00aa00', w: 800 }] as any),
    '{#00aa00 w800|Z}');
  // italic still applies inside a weight run (font-style ≠ weight axis, no conflict)
  assert.equal(markdownFromChars([{ ch: 'q', b: false, i: true, w: 600 }] as any), '{w600|*q*}');
});

test('charsFromDom reads numeric weight from data-fc-weight and style; ignores keyword bold', () => {
  const chars = charsFromDom(root(
    span({ dataW: '300' }, t('a')),
    span({ weight: '800' }, t('b')),
    span({ weight: 'bold' }, t('c')),   // keyword → left to <strong>, not a weight run
  ));
  assert.equal(chars.map((c) => c.ch).join(''), 'abc');
  assert.deepEqual(chars.map((c) => c.w ?? null), [300, 800, null]);
});

test('charsFromDom: a numeric weight span inside bold drops the bold (weight wins)', () => {
  const chars = charsFromDom(root(el('STRONG', span({ weight: '300' }, t('x')))));
  assert.deepEqual(chars.map((c) => [c.b, c.w]), [[false, 300]]);
});

// ── ordered lists ─────────────────────────────────────────────────────────────
test('toggleNumbers adds "N.  " to every non-blank line, then removes it, keeping indent', () => {
  const on = toggleNumbers(plain('one\n\n  two'));
  assert.equal(str(on), '1.  one\n\n  2.  two');
  assert.equal(allNumbered(on), true);
  assert.equal(allBulleted(on), false);
  const off = toggleNumbers(on);
  assert.equal(str(off), 'one\n\n  two');
});

test('bullets and numbers are mutually exclusive (switching strips the other)', () => {
  const bulleted = toggleBullets(plain('a\nb'));
  assert.equal(str(bulleted), '•  a\n•  b');
  const numbered = toggleNumbers(bulleted);
  assert.equal(str(numbered), '1.  a\n2.  b');
  assert.equal(allBulleted(numbered), false);
});

test('markdownFromChars maps "N.  " ordered lines back to "N. "', () => {
  assert.equal(markdownFromChars(plain('1.  first\n2.  second\n')), '1. first\n2. second');
  // a paragraph opening on a year is NOT treated as a list (>3 digits)
  assert.equal(markdownFromChars(plain('2024. the year of')), '2024. the year of');
});

test('charsFromDom converts pasted <ol>/<ul> into number/bullet prefixes', () => {
  const ol = charsFromDom(root(el('OL', el('LI', t('alpha')), el('LI', t('beta')))));
  assert.equal(str(ol), '1.  alpha\n2.  beta');
  const ul = charsFromDom(root(el('UL', el('LI', t('x')), el('LI', t('y')))));
  assert.equal(str(ul), '•  x\n•  y');
});

test('charsFromDom skips <script>/<style> content when flattening pasted HTML', () => {
  const chars = charsFromDom(root(t('keep'), el('STYLE', t('.x{color:red}')), el('SCRIPT', t('alert(1)')), t(' me')));
  assert.equal(str(chars), 'keep me');
});

// ── underline / strikethrough ─────────────────────────────────────────────────
test('charsFromDom reads underline (U/INS) and strike (S/STRIKE/DEL) tags', () => {
  const chars = charsFromDom(root(
    t('a'), el('U', t('b')), el('S', t('c')), el('INS', t('d')), el('DEL', t('e')),
  ));
  assert.equal(str(chars), 'abcde');
  assert.deepEqual(chars.map((c) => [!!c.u, !!c.s]), [
    [false, false], [true, false], [false, true], [true, false], [false, true],
  ]);
});

test('setFlag u/s and rangeHasFlag over a range (skips newlines)', () => {
  let chars: any[] = plain('ab\ncd');
  assert.equal(rangeHasFlag(chars, 0, 5, 'u'), false);
  chars = setFlag(chars, 0, 5, 'u', true);
  assert.equal(rangeHasFlag(chars, 0, 5, 'u'), true);
  assert.equal(chars[2].u === true, false);          // newline untouched
  chars = setFlag(chars, 0, 2, 's', true);
  assert.equal(rangeHasFlag(chars, 0, 5, 's'), false); // only part struck → not all
  assert.equal(rangeHasFlag(chars, 0, 2, 's'), true);
});

test('htmlFromChars emits <u>/<s> wrappers; charsFromDom round-trips them', () => {
  const chars: any[] = [
    { ch: 'x', b: false, i: false, u: true },
    { ch: 'y', b: false, i: false, s: true },
    { ch: 'z', b: false, i: false, u: true, s: true },
  ];
  const html = htmlFromChars(chars);
  assert.equal(html, '<u>x</u><s>y</s><s><u>z</u></s>');
  const back = charsFromDom(root(...[
    { nodeType: 1, nodeName: 'U', childNodes: [t('x')] },
    { nodeType: 1, nodeName: 'S', childNodes: [t('y')] },
    { nodeType: 1, nodeName: 'U', childNodes: [{ nodeType: 1, nodeName: 'S', childNodes: [t('z')] }] },
  ] as any));
  assert.deepEqual(back.map((c) => [!!c.u, !!c.s]), [[true, false], [false, true], [true, true]]);
});

test('markdownFromChars folds underline/strike into the attr token (no markdown marker)', () => {
  assert.equal(markdownFromChars([{ ch: 'A', b: false, i: false, u: true }, { ch: 'B', b: false, i: false, u: true }] as any),
    '{u|AB}');
  assert.equal(markdownFromChars([{ ch: 'q', b: true, i: false, s: true }] as any), '{s|**q**}');
  // colour + weight + underline + strike all fold into ONE token, in a stable order
  assert.equal(markdownFromChars([{ ch: 'Z', b: false, i: false, c: '#00aa00', w: 800, u: true, s: true }] as any),
    '{#00aa00 w800 u s|Z}');
});

// ── per-run font ──────────────────────────────────────────────────────────────
test('setFont / rangeFont over a range (skips newlines, clears on null)', () => {
  let chars: any[] = plain('ab\ncd');
  assert.equal(rangeFont(chars, 0, 5), null);
  chars = setFont(chars, 0, 5, 'mono');
  assert.equal(rangeFont(chars, 0, 5), 'mono');
  assert.equal(chars[2].f == null, true);            // newline stays fontless
  chars = setFont(chars, 3, 5, 'suse');
  assert.equal(rangeFont(chars, 0, 5), null);        // now mixed
  chars = setFont(chars, 0, 5, null);
  assert.equal(rangeFont(chars, 0, 5), null);        // cleared
});

test('htmlFromChars emits a data-fc-font span with an fc-ff class; combines with colour', () => {
  assert.equal(htmlFromChars([{ ch: 'm', b: false, i: false, f: 'mono' }] as any),
    '<span data-fc-font="mono" class="fc-ff-mono">m</span>');
  assert.equal(htmlFromChars([{ ch: 'k', b: false, i: false, c: '#ff0000', f: 'suse' }] as any),
    '<span data-fc-color="#ff0000" data-fc-font="suse" class="fc-ff-suse" style="color:#ff0000">k</span>');
});

test('markdownFromChars wraps a font run {mono|…} / {suse|…}', () => {
  assert.equal(markdownFromChars([{ ch: 'a', b: false, i: false, f: 'mono' }, { ch: 'b', b: false, i: false, f: 'mono' }] as any),
    '{mono|ab}');
  assert.equal(markdownFromChars([{ ch: 'x', b: true, i: false, f: 'suse' }] as any), '{suse|**x**}');
});

test('charsFromDom reads per-run font from data-fc-font and sniffs a mono family', () => {
  const chars = charsFromDom(root(
    span({ dataF: 'mono' }, t('a')),
    span({ dataF: 'suse' }, t('b')),
    span({ family: "'SUSE Mono', monospace" }, t('c')),  // pasted → sniffed to mono
    span({ family: "'SUSE', sans-serif" }, t('d')),       // sans family → not forced
  ));
  assert.equal(str(chars), 'abcd');
  assert.deepEqual(chars.map((c) => c.f ?? null), ['mono', 'suse', 'mono', null]);
});

test('clearFormatting also strips underline, strike and per-run font', () => {
  let chars: any[] = plain('abcd');
  chars = setFlag(chars, 0, 4, 'u', true);
  chars = setFlag(chars, 0, 4, 's', true);
  chars = setFont(chars, 0, 4, 'mono');
  const cleared = clearFormatting(chars, 0, 4);
  assert.equal(rangeHasFlag(cleared, 0, 4, 'u'), false);
  assert.equal(rangeHasFlag(cleared, 0, 4, 's'), false);
  assert.equal(rangeFont(cleared, 0, 4), null);
});
