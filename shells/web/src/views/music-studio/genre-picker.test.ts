// SPDX-License-Identifier: MPL-2.0
/**
 * The genre picker's arrow keys (views/music-studio/genre-picker.ts): left and right step
 * through the cards, up and down move to the nearest card in the row above or below as the
 * grid is laid out, across the gap between the two groups, and Home and End jump to the ends.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/genre-picker.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardToward } from './genre-picker.ts';

/** Cards laid out as a grid of `cols` columns, 100 by 80 each; a second group starts after `split` cards, on a new row 40 lower. */
function grid(count: number, cols: number, split = count): Array<{ id: number; getBoundingClientRect(): { left: number; top: number; bottom: number; width: number } }> {
  return Array.from({ length: count }, (_, id) => {
    const second = id >= split;
    const at = second ? id - split : id;
    const rowsBefore = second ? Math.ceil(split / cols) : 0;
    const top = (rowsBefore + Math.floor(at / cols)) * 90 + (second ? 40 : 0);
    const left = (at % cols) * 110;
    return { id, getBoundingClientRect: () => ({ left, top, bottom: top + 80, width: 100 }) };
  });
}

test('left and right step through the cards, Home and End go to the ends', () => {
  const cards = grid(10, 4);
  assert.equal(cardToward(cards, cards[2]!, 'ArrowRight')?.id, 3);
  assert.equal(cardToward(cards, cards[4]!, 'ArrowLeft')?.id, 3);
  assert.equal(cardToward(cards, cards[9]!, 'ArrowRight'), null);
  assert.equal(cardToward(cards, cards[5]!, 'Home')?.id, 0);
  assert.equal(cardToward(cards, cards[5]!, 'End')?.id, 9);
  assert.equal(cardToward(cards, cards[5]!, 'Tab'), null, 'other keys are left alone');
});

test('up and down move by the row, to the card closest across', () => {
  const cards = grid(10, 4);
  assert.equal(cardToward(cards, cards[1]!, 'ArrowDown')?.id, 5);
  assert.equal(cardToward(cards, cards[5]!, 'ArrowUp')?.id, 1);
  assert.equal(cardToward(cards, cards[7]!, 'ArrowDown')?.id, 9, 'a short last row takes the nearest card');
  assert.equal(cardToward(cards, cards[2]!, 'ArrowUp'), null, 'nothing above the first row');
});

test('down from the last row of one group goes into the next group', () => {
  const cards = grid(9, 4, 6); // 6 in the first group (rows of 4 and 2), 3 in the second
  assert.equal(cardToward(cards, cards[5]!, 'ArrowDown')?.id, 7, 'the second group\'s card under it');
  assert.equal(cardToward(cards, cards[3]!, 'ArrowDown')?.id, 5, 'the nearest card in the short row below');
  assert.equal(cardToward(cards, cards[6]!, 'ArrowUp')?.id, 4);
});
