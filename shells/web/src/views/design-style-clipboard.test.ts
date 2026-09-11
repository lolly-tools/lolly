// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyDesignStyle, captureDesignStyle } from './design-style-clipboard.ts';

test('style capture is allow-list only and records an absent source field', () => {
  const source = {
    id: 'source',
    x: 12,
    y: 34,
    text: 'Do not copy me',
    frame: 'slide-1',
    start: 2,
    fill: '#ff00aa',
    opacity: 0.7,
    shadow: 'box',
  };
  const shot = captureDesignStyle(source, ['fill', 'opacity', 'radius', 'shadow']);

  assert.deepEqual(shot, {
    version: 1,
    values: { fill: '#ff00aa', opacity: 0.7, shadow: 'box' },
    absent: ['radius'],
  });
  assert.equal('id' in shot.values, false);
  assert.equal('text' in shot.values, false);
  assert.equal('start' in shot.values, false);
});

test('style paste changes only allowed fields and explicit absence resets a target', () => {
  const rows = [
    { id: 'source', x: 12, fill: '#f0a', opacity: 0.7 },
    {
      id: 'target',
      x: 400,
      y: 80,
      w: 200,
      h: 100,
      text: 'Keep this',
      image: 'asset/a',
      frame: 'slide-2',
      start: 4,
      dur: 8,
      notes: 'private',
      hidden: true,
      locked: true,
      fill: '#000',
      opacity: 1,
      radius: 24,
    },
  ];
  const shot = captureDesignStyle(rows[0]!, ['fill', 'opacity', 'radius']);
  const out = applyDesignStyle(rows, new Set(['target']), (row) => row.id, shot);

  assert.equal(out[0], rows[0], 'untouched rows preserve object identity');
  assert.deepEqual(out[1], {
    id: 'target',
    x: 400,
    y: 80,
    w: 200,
    h: 100,
    text: 'Keep this',
    image: 'asset/a',
    frame: 'slide-2',
    start: 4,
    dur: 8,
    notes: 'private',
    hidden: true,
    locked: true,
    fill: '#f0a',
    opacity: 0.7,
  });
});

test('one snapshot applies to every selected target without reordering rows', () => {
  const rows = [
    { id: 'a', fill: 'red' },
    { id: 'b', fill: 'blue' },
    { id: 'c', fill: 'green' },
  ];
  const out = applyDesignStyle(
    rows,
    new Set(['b', 'c']),
    (row) => row.id,
    captureDesignStyle(rows[0]!, ['fill'])
  );
  assert.deepEqual(
    out.map((row) => row.id),
    ['a', 'b', 'c']
  );
  assert.deepEqual(
    out.map((row) => row.fill),
    ['red', 'red', 'red']
  );
});
