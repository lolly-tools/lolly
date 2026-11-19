// SPDX-License-Identifier: MPL-2.0
/**
 * The audio tiles' late repaint (views/picker.ts mountAudioThumbs). A tile painted before
 * the colour pool arrived is painted again once the pool is there. The repaint walked the
 * live set of painted tiles while paint() added a new entry for the tile just painted, so
 * the walk reached that entry, painted again, and never ended. The page froze and memory
 * grew until the tab died, whenever one tile won the race with the pool.
 *
 * The mount needs a real IntersectionObserver and three hosts' worth of bridge, so this
 * pins the lines that keep the walk finite, and shows the failure they prevent.
 *
 * Run directly:  node --test shells/web/src/views/picker-audio-repaint.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./picker.ts', import.meta.url), 'utf8');
const mount = source.slice(source.indexOf('export function mountAudioThumbs('));

test('the repaint takes the list and empties it before painting, so the walk is finite', () => {
  const repaint = mount.slice(mount.indexOf('const repaintPainted'), mount.indexOf('const measuredTheme'));
  assert.match(repaint, /for \(const ref of painted\.splice\(0\)\)/);
  assert.doesNotMatch(repaint, /for \(const ref of painted\)/);
});

test('the list of painted tiles is an array, recorded in one place', () => {
  assert.match(mount, /const painted: WeakRef<HTMLElement>\[\] = \[\];/);
  assert.equal(mount.split('painted.push(').length - 1, 1, 'one place records a painted tile');
  assert.doesNotMatch(mount, /painted\.add\(/);
});

test('why: a set that grows while it is walked is walked for ever', () => {
  const live = new Set<object>([{}]);
  let steps = 0;
  for (const _entry of live) {
    if (++steps > 50) break;      // the old code had no such limit
    live.add({});                 // what paint() did on every repaint
  }
  assert.equal(steps, 51, 'the walk reaches every entry added during the walk');

  const list: object[] = [{}];
  let bounded = 0;
  for (const _entry of list.splice(0)) { bounded++; list.push({}); }
  assert.equal(bounded, 1, 'the taken list is walked once');
  assert.equal(list.length, 1, 'and the tile is recorded once for the next repaint');
});
