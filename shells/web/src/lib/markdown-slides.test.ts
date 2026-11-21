// SPDX-License-Identifier: MPL-2.0
/** A Markdown deck as Design slides (lib/markdown-slides.ts), through the real composer. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { composeDesignSlides, type DesignComposeContext } from '@lolly/engine';
import type { SlideMasterV1 } from '@lolly-tools/core';
import { markdownComposeSpec, parseMarkdownDeck } from './markdown-slides.ts';

const file = JSON.parse(readFileSync(new URL('../../../../brands/lolly-demo/catalog/assets/lolly/slides/masters.json', import.meta.url), 'utf8')) as { masters: SlideMasterV1[] };
const master = file.masters[0]!;
const size = { width: 1920, height: 1080 };
const ctx: DesignComposeContext = { master, masterOrigin: 'neutral', resolveToken: () => '#123456' };

const DECK = `---
title: front matter is left out
---

# Quarterly review

Northline Studio, third quarter

---

## One model, many ways in

- Type in the builder
- Paste **Markdown**
  - each bullet stays editable
1. Or number them

<!-- notes: Say hello first. -->

---

## Numbers

A short line first

| Metric | Q1 | Q2 |
| --- | --- | --- |
| Revenue | 10 | 12 |
| Churn \\| net | 3 | 2 |

---

> Make the next thing beautiful.

Ada, a designer

---

## A picture

![a hill](https://example.com/hill.jpg)
![left out](media/local.png)

---

## Next steps
`;

test('the dialect reads into slides: front matter out, titles, lists, a table, a quote, notes', () => {
  const slides = parseMarkdownDeck(DECK);
  assert.equal(slides.length, 6);
  assert.deepEqual([slides[0]!.title, slides[0]!.subtitle], ['Quarterly review', 'Northline Studio, third quarter']);
  assert.deepEqual(slides[1]!.body, ['- Type in the builder', '- Paste **Markdown**', '  - each bullet stays editable', '1. Or number them']);
  assert.equal(slides[1]!.notes, 'Say hello first.');
  assert.equal(slides[2]!.subtitle, 'A short line first');
  assert.deepEqual(slides[2]!.table, [['Metric', 'Q1', 'Q2'], ['Revenue', '10', '12'], ['Churn | net', '3', '2']]);
  assert.deepEqual(slides[3]!.quote, ['Make the next thing beautiful.']);
  assert.equal(slides[4]!.images.length, 2);
});

test('with no rule lines, each heading starts a slide', () => {
  const slides = parseMarkdownDeck('# One\n\nwords\n\n## Two\n\n- a\n\n## Three\n');
  assert.deepEqual(slides.map((s) => s.title), ['One', 'Two', 'Three']);
});

test('each slide takes a layout of the master by what it holds, and composes with no slot refused', () => {
  const { spec, notes } = markdownComposeSpec(DECK, master, size);
  assert.deepEqual(spec.slides.map((s) => s.archetype), ['title', 'content', 'table', 'quote', 'visual', 'section']);
  assert.match(notes[0] ?? '', /One picture was left out/);
  const { document, report } = composeDesignSlides(spec, ctx);
  assert.equal(report.slides.length, 6);
  const texts = document.boxes.map((row) => String(row.text ?? ''));
  assert.ok(texts.includes('Quarterly review'));
  assert.ok(texts.some((t) => t.includes('- Paste **Markdown**')), 'the list travels as Design text');
  assert.ok(texts.includes('Revenue') && texts.includes('Churn | net'), 'each table cell is a text layer');
  assert.ok(texts.includes('Make the next thing beautiful.'));
  assert.ok(document.boxes.some((row) => String(row.src ?? row.image ?? '').includes('example.com/hill.jpg')), 'the web picture fills the visual');
  assert.match(notes[1] ?? '', /On one slide, words the layout had no place for/);
  assert.equal(document.boxes.find((row) => row.id === 's03')?.notes, 'A short line first', 'the line beside the table is kept in the notes');
  const second = document.boxes.find((row) => row.id === 's02');
  assert.equal(second?.notes, 'Say hello first.');
});

test('a subtitle the layout has no place for leads the body, and ids come from the caller', () => {
  const { spec } = markdownComposeSpec('## Heading\n\nA subtitle line\n\n- one\n', { ...master, archetypes: master.archetypes.filter((a) => a.id !== 'title-subtitle-body') }, size, (i) => `md1-${i + 1}`);
  assert.equal(spec.slides[0]!.archetype, 'content');
  assert.equal(spec.slides[0]!.id, 'md1-1');
  assert.equal(spec.slides[0]!.slots?.body, 'A subtitle line\n- one');
});

test('a deck with no words gives no slides', () => {
  assert.equal(parseMarkdownDeck('   \n\n---\n\n').length, 0);
  assert.equal(markdownComposeSpec('', master, size).spec.slides.length, 0);
});
