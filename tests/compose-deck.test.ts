// SPDX-License-Identifier: MPL-2.0
/**
 * compose-deck: the pure spec -> deck-builder mapping and the deck linter. No
 * browser, no render - the render step just shells out to the CLI and is covered
 * by deck-builder's own export tests. These pin the two things this script owns:
 * that a friendly slide spec becomes the right deck-builder blocks/flags, and that
 * the advisory lint flags the deck-quality problems it promises to.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assembleContent, slideToBlock, specToDeck, lintDeck, LAYOUT_SLOTS,
  type DeckSpec,
} from '../scripts/compose-deck.ts';

test('assembleContent: fields become markdown; explicit content wins; number is the bignum headline', () => {
  assert.equal(
    assembleContent({ title: 'Growth', bullets: ['Up 24%', 'New regions'] }),
    '# Growth\n\n- Up 24%\n- New regions',
  );
  assert.equal(assembleContent({ title: 'X', content: '# Raw markdown' }), '# Raw markdown');
  assert.equal(assembleContent({ number: '24%', label: 'YoY growth' }), '# 24%\nYoY growth');
  // title wins over number for the H1 when both are present
  assert.equal(assembleContent({ title: 'T', number: '9' }), '# T');
});

test('slideToBlock: media becomes { id } slots capped at the layout slot count; passthrough fields', () => {
  const block = slideToBlock({
    layout: 'split', title: 'Two up',
    media: ['chart://q?data=1', 'suse/logo/primary', 'extra://dropped'],
    notes: 'say this', theme: 'dark', bg: '#0c322c', logo: 'mono',
  });
  assert.equal(block.layout, 'split');
  assert.deepEqual(block.media1, { id: 'chart://q?data=1' }, 'a tool link is passed for compose to resolve');
  assert.deepEqual(block.media2, { id: 'suse/logo/primary' });
  assert.equal(block.media3, undefined, 'a split layout has two slots - the third media is dropped');
  assert.equal(block.notes, 'say this');
  assert.equal(block.theme, 'dark');
  assert.equal(block.bg, '#0c322c');
  assert.equal(block.logo, 'mono');
});

test('slideToBlock: a statement layout carries no media slot', () => {
  const block = slideToBlock({ layout: 'mainpoint', title: 'One idea', media: ['chart://x'] });
  assert.equal(LAYOUT_SLOTS.mainpoint, 0);
  assert.equal(block.media1, undefined);
});

test('specToDeck: only the deck-level flags the spec sets are emitted', () => {
  const spec: DeckSpec = {
    size: 'wide', footer: 'Confidential', pageNumbers: true,
    slides: [{ layout: 'title', title: 'Hi' }],
  };
  const { deck, flags } = specToDeck(spec);
  assert.equal(deck.length, 1);
  // theme first: deepEqual narrows `flags` to the literal's type, and `.theme` on the
  // narrowed type is a typecheck error.
  assert.equal(flags.theme, undefined, 'an unset flag is omitted, not defaulted');
  assert.deepEqual(flags, { size: 'wide', footerText: 'Confidential', pageNumbers: 'true' });
});

test('lintDeck: flags a long title, too many/long bullets, missing notes, extra media, unknown layout', () => {
  const spec: DeckSpec = {
    slides: [
      { layout: 'title', title: 'Q Review' },
      {
        layout: 'split',
        title: 'This particular slide has an unusually long title that keeps going well past fourteen words for sure',
        bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'this one bullet just keeps talking and talking and talking and talking and talking and talking and talking on'],
        media: ['x://1', 'x://2', 'x://3'],
      },
      { layout: 'nope', title: 'bad' },
    ],
  };
  const msgs = lintDeck(spec).map(w => `${w.where}: ${w.msg}`);
  assert.ok(msgs.some(m => /title runs \d+ words/.test(m)), 'long title flagged');
  assert.ok(msgs.some(m => /7 bullets/.test(m)), 'bullet count flagged');
  assert.ok(msgs.some(m => /bullet runs long/.test(m)), 'long bullet flagged');
  assert.ok(msgs.some(m => /2-slot "split".*dropped/.test(m)), 'extra media flagged');
  assert.ok(msgs.some(m => /no speaker notes/.test(m)), 'content slide without notes flagged');
  assert.ok(msgs.some(m => /unknown layout "nope"/.test(m)), 'unknown layout flagged');
});

test('lintDeck: a deck with no visuals anywhere is warned; a statement-only slide is exempt from notes', () => {
  const noVisuals = lintDeck({ slides: [{ layout: 'mainpoint', title: 'A' }, { layout: 'mainpoint', title: 'B' }] });
  assert.ok(noVisuals.some(w => w.level === 'warn' && /no visuals anywhere/.test(w.msg)));
  assert.ok(!noVisuals.some(w => /no speaker notes/.test(w.msg)), 'statement slides are not asked for notes');
});

test('lintDeck: four content slides with no visual in a row is flagged once', () => {
  const spec: DeckSpec = {
    slides: Array.from({ length: 4 }, (_, i) => ({ layout: 'split', title: `S${i}`, notes: 'n', media: [] })),
  };
  const runs = lintDeck(spec).filter(w => /text-only slides in a row/.test(w.msg));
  assert.equal(runs.length, 1, 'the run is reported exactly once, at the fourth');
});
