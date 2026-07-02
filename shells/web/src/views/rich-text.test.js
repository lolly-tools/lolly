// Unit tests for the Layout Studio rich-text char model (rich-text.js).
// charsFromDom is DOM-agnostic (nodeType/nodeName/childNodes/nodeValue only),
// so these tests feed it plain object trees — no jsdom.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  charsFromDom, htmlFromChars, markdownFromChars,
  rangeHasFlag, setFlag, wordRangeAt, allBulleted, toggleBullets,
} from './rich-text.js';

const t = (text) => ({ nodeType: 3, nodeValue: text, childNodes: [] });
const el = (name, ...childNodes) => ({ nodeType: 1, nodeName: name, childNodes });
const root = (...kids) => el('DIV', ...kids);
const plain = (s) => [...s].map((ch) => ({ ch, b: false, i: false }));
const str = (chars) => chars.map((c) => c.ch).join('');

test('charsFromDom flattens text with strong/em flags', () => {
  const chars = charsFromDom(root(t('a '), el('STRONG', t('b'), el('EM', t('c'))), t(' d')));
  assert.equal(str(chars), 'a bc d');
  assert.deepEqual(chars.map((c) => [c.b, c.i]), [
    [false, false], [false, false], [true, false], [true, true], [false, false], [false, false],
  ]);
});

test('charsFromDom: BR and block elements become newlines, nbsp becomes space', () => {
  const chars = charsFromDom(root(t('a\u00a0b'), el('BR'), el('DIV', t('c')), el('DIV', t('d'))));
  assert.equal(str(chars), 'a b\nc\nd');
});

test('html round-trip: charsFromDom(htmlFromChars(x)) is stable in structure', () => {
  const chars = [
    ...plain('He'),
    { ch: 'l', b: true, i: false }, { ch: 'l', b: true, i: false },
    { ch: 'o', b: true, i: true },
    ...plain(' <&> hi'),
  ];
  const html = htmlFromChars(chars);
  assert.equal(html, 'He<strong>ll</strong><strong><em>o</em></strong> &lt;&amp;&gt; hi');
});

test('markdownFromChars emits **bold**, *italic*, ***both*** per line', () => {
  const chars = [
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
  const chars = [
    { ch: 'a', b: true, i: false },
    { ch: ' ', b: true, i: false },
    { ch: 'b', b: false, i: false },
  ];
  assert.equal(markdownFromChars(chars), '**a** b');
});

test('rangeHasFlag / setFlag toggle over a char range, skipping newlines', () => {
  let chars = plain('ab\ncd');
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
