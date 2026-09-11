// SPDX-License-Identifier: MPL-2.0
/**
 * PPTX import keeps the speaker notes (plan 179 P2).
 *
 * `readPptx` has parsed a slide's notesSlide into `slide.notes` all along
 * (engine/src/pptx-read.ts) and pptx-import.ts simply never read the field, so
 * importing a rehearsed deck threw the script away and a re-export could not put
 * it back. The two pure halves of the artboard row - `pptxSlideNotes` and
 * `pptxSlideFrame` - are tested here against hand-built read-model slides: no
 * zip, no host, no DOM, so the mapping rules are pinned without a fixture deck.
 *
 * Run with: node --import ./tests/css-stub.mjs --test shells/web/src/views/pptx-import-notes.test.ts
 */

/// <reference path="../vendor.d.ts" />

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pptxSlideNotes, pptxSlideFrame } from './pptx-import.ts';
import { EMU_PER_PX } from '../../../../engine/src/pptx.ts';
import type { PptxDeckRead, PptxReadSlide } from '../../../../engine/src/pptx-read.ts';

const DECK: PptxDeckRead = {
  widthEmu: 960 * EMU_PER_PX,
  heightEmu: 540 * EMU_PER_PX,
  slides: [],
  theme: { colors: { lt1: 'FFFFFF' }, majorFont: 'Calibri Light', minorFont: 'Calibri' },
};

const slide = (over: Partial<PptxReadSlide> = {}): PptxReadSlide => ({ index: 0, nodes: [], ...over });
const PAGE = { width: 960, height: 540 };

test('a slide carrying notes maps them onto the artboard row', () => {
  const row = pptxSlideFrame(slide({ notes: 'Open with the customer story. Pause after the number.' }), DECK, [], 0, PAGE);
  assert.equal(row.notes, 'Open with the customer story. Pause after the number.');
  assert.equal(row.name, 'Slide 1', 'the frame still keeps the slide number as its name');
  assert.equal(row.width, 960);
  assert.equal(row.height, 540);
  assert.equal(row.background, '#FFFFFF', 'the ground still comes from the deck theme');
});

test('a note-less slide carries no notes key at all', () => {
  // `undefined`, never '' - an artboard row with an empty notes field would show a
  // filled speaker-notes dot in the navigator for a slide that has nothing to say.
  for (const s of [slide(), slide({ notes: '' }), slide({ notes: '   \n\t ' })]) {
    assert.ok(!('notes' in pptxSlideFrame(s, DECK, [], 0, PAGE)), 'no key for a blank note');
  }
});

test('notes travel per slide, and the row keeps the DECK index in its name', () => {
  const deck: PptxDeckRead = {
    ...DECK,
    slides: [slide({ notes: 'One.' }), slide({ index: 1 }), slide({ index: 2, notes: 'Three.' })],
  };
  const rows = deck.slides.map((s, i) => pptxSlideFrame(s, deck, [], i, PAGE));
  assert.equal(rows[0]!.notes, 'One.');
  assert.ok(!('notes' in rows[1]!));
  assert.equal(rows[2]!.notes, 'Three.');
  assert.deepEqual(rows.map((r) => r.name), ['Slide 1', 'Slide 2', 'Slide 3']);
});

test('CRLF from OOXML becomes plain newlines; the text is otherwise verbatim', () => {
  assert.equal(pptxSlideNotes(slide({ notes: '  Line one\r\nLine two\rLine three  ' })), 'Line one\nLine two\nLine three');
  // A note is prose, not markup: nothing is escaped or stripped on the way in.
  assert.equal(pptxSlideNotes(slide({ notes: '5 < 6 & "quote" <b>not bold</b>' })), '5 < 6 & "quote" <b>not bold</b>');
});

test('an absurd note is capped rather than pasted whole into the frame field', () => {
  const long = pptxSlideNotes(slide({ notes: 'a'.repeat(30_000) }))!;
  assert.equal(long.length, 20_001, '20k characters plus the ellipsis that says it was cut');
  assert.ok(long.endsWith('…'));
});

test('a non-string notes field (a hostile/typo\'d read model) is no note', () => {
  assert.equal(pptxSlideNotes(slide({ notes: 42 as unknown as string })), undefined);
  assert.equal(pptxSlideNotes(undefined), undefined);
});
