// SPDX-License-Identifier: MPL-2.0
/**
 * The one question every text surface asks (plan 323): a brand skill reads as text,
 * is never analysed for AI writing signals, and renders without its frontmatter.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { TEXT_KINDS, analysesTextSignals, isSkillKind, isTextKind, readableMarkdown, tidyReaderLinks } from './text-kinds.ts';

test('text and skill are the text kinds; data and pictures are not', () => {
  assert.deepEqual([...TEXT_KINDS].sort(), ['skill', 'text']);
  for (const type of ['text', 'skill']) assert.equal(isTextKind(type), true, type);
  for (const type of ['data', 'raster', 'tokens', 'font', '', undefined, null, 3]) assert.equal(isTextKind(type), false, String(type));
  assert.equal(isSkillKind('skill'), true);
  assert.equal(isSkillKind('text'), false);
});

test('AI-signal analysis applies to a text upload and never to a skill', () => {
  assert.equal(analysesTextSignals('text'), true);
  assert.equal(analysesTextSignals('skill'), false);
  assert.equal(analysesTextSignals('data'), false);
});

test('readableMarkdown drops a clean frontmatter block and keeps everything else', () => {
  const skill = '---\nname: lolly-demo-brand\ndescription: The standards.\n---\n\n# Lolly Demo brand standards\n\nPlain words.\n';
  assert.equal(readableMarkdown(skill), '# Lolly Demo brand standards\n\nPlain words.\n');
  const plain = '# Title\n\nNo frontmatter here.';
  assert.equal(readableMarkdown(plain), plain);
  // A document that opens with a rule, not a key: value block, keeps every line.
  const rule = '---\n\nA paragraph between two rules.\n\n---\n\nMore.';
  assert.equal(readableMarkdown(rule), rule);
  // An unclosed block is not frontmatter either.
  const open = '---\nname: x\n\n# Heading';
  assert.equal(readableMarkdown(open), open);
});

test('reader links: web links open a new tab, asset ids open Assets, anything else loses its href', () => {
  const { document } = new JSDOM('<div><a href="https://brand.example/guide">web</a> <a href="lolly/logo/horizontal">mark</a> <a href="asset:suse/icons/cloud">icon</a> <a href="#voice">anchor</a> <a href="references/palette.md">file</a></div>').window;
  const root = document.querySelector('div')!;
  tidyReaderLinks(root);
  const [web, mark, icon, anchor, file] = [...root.querySelectorAll('a')];
  assert.equal(web!.target, '_blank');
  assert.equal(web!.rel, 'noopener noreferrer');
  assert.equal(mark!.getAttribute('href'), '#/a?asset=lolly%2Flogo%2Fhorizontal');
  assert.equal(icon!.getAttribute('href'), '#/a?asset=suse%2Ficons%2Fcloud');
  assert.equal(anchor!.hasAttribute('href'), false, 'an anchor would be read as a route');
  assert.equal(file!.hasAttribute('href'), false);
  assert.equal(file!.title, 'references/palette.md');
});
