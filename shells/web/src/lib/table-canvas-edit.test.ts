// SPDX-License-Identifier: MPL-2.0
// Unit tests for the on-canvas table-cell serialiser (table-canvas-edit.ts).
// cellHtmlToMarkdown/cellPlainText are DOM-agnostic (nodeType/nodeName/
// nodeValue/childNodes/getAttribute only), so these tests feed plain object
// trees - no jsdom. The round-trip partner is the engine's {{markdown}} helper
// (engine/src/template.ts): everything asserted here must re-render to the same
// structure it was serialised from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cellHtmlToMarkdown, cellPlainText, type CellNode } from './table-canvas-edit.ts';

const t = (text: string): CellNode => ({ nodeType: 3, nodeValue: text, childNodes: [] });
const el = (name: string, attrs: Record<string, string>, ...childNodes: CellNode[]): CellNode => ({
  nodeType: 1, nodeName: name, childNodes,
  getAttribute: (n: string) => attrs[n] ?? null,
});
const e = (name: string, ...childNodes: CellNode[]): CellNode => el(name, {}, ...childNodes);
const root = (...kids: CellNode[]): CellNode => e('DIV', ...kids);

test('serialises the engine markdown subset back to source', () => {
  // <h2>Why</h2><p>Is it <strong>open</strong>?<br>Mostly <em>yes</em></p>
  const md = cellHtmlToMarkdown(root(
    e('H2', t('Why')),
    e('P', t('Is it '), e('STRONG', t('open')), t('?'), e('BR'), t('Mostly '), e('EM', t('yes'))),
  ));
  assert.equal(md, '## Why\n\nIs it **open**?\nMostly *yes*');
});

test('serialises links, images and strikethrough', () => {
  const md = cellHtmlToMarkdown(root(e('P',
    el('A', { href: 'https://lolly.tools/d' }, t('docs')),
    t(' and '),
    el('IMG', { src: '/seal.svg', alt: 'seal' }),
    t(' but '),
    e('DEL', t('not this')),
  )));
  assert.equal(md, '[docs](https://lolly.tools/d) and ![seal](/seal.svg) but ~~not this~~');
});

test('serialises unordered lists, keeping direction-marker classes', () => {
  const md = cellHtmlToMarkdown(root(e('UL',
    e('LI', t('plain item')),
    el('LI', { class: 'md-arrow' }, t('next step')),
    el('LI', { class: 'md-arrow-up' }, t('going up')),
  )));
  assert.equal(md, '- plain item\n> next step\n^ going up');
});

test('serialises ordered lists, dropping the baked md-index spans and renumbering', () => {
  const md = cellHtmlToMarkdown(root(e('OL',
    e('LI', el('SPAN', { class: 'md-index' }, t('1.')), t(' Readiness play')),
    e('LI', el('SPAN', { class: 'md-index' }, t('2.')), t(' Compliance framework')),
  )));
  assert.equal(md, '1. Readiness play\n2. Compliance framework');
});

test('contenteditable DIV lines join as paragraph lines; empty DIVs break paragraphs', () => {
  // <div>line one</div><div>line two</div><div><br></div><div>new para</div>
  const md = cellHtmlToMarkdown(root(
    e('DIV', t('line one')),
    e('DIV', t('line two')),
    e('DIV', e('BR')),
    e('DIV', t('new para')),
  ));
  assert.equal(md, 'line one\nline two\n\nnew para');
});

test('execCommand B/I tags and nbsp are normalised', () => {
  const md = cellHtmlToMarkdown(root(e('P', e('B', t('bold')), t(' '), e('I', t('lean')))));
  assert.equal(md, '**bold** *lean*');
});

test('unknown wrappers unwrap to their text; empty emphasis collapses', () => {
  const md = cellHtmlToMarkdown(root(e('P', e('CODE', t('kept as text')), e('STRONG'))));
  assert.equal(md, 'kept as text');
});

test('image alt text cannot break the markdown syntax', () => {
  const md = cellHtmlToMarkdown(root(e('P', el('IMG', { src: '/x.png', alt: 'a]b[c' }))));
  assert.equal(md, '![abc](/x.png)');
});

test('cellPlainText flattens structure to single-line bare text', () => {
  const text = cellPlainText(root(e('DIV', t('one')), e('DIV', t('two ')), e('P', e('STRONG', t('three')))));
  assert.equal(text, 'one two three');
});

test('whitespace-only content serialises to the empty string', () => {
  assert.equal(cellHtmlToMarkdown(root(t('  \n '), e('DIV', e('BR')))), '');
  assert.equal(cellPlainText(root(t('   '))), '');
});
