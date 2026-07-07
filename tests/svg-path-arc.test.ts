/**
 * Elliptical-arc flag tokenizing contract test.
 * Run with: npm test  (node --test over the tests/ globs)
 *
 * SVGO-optimized paths pack the arc flags against the following number
 * ("A5 5 0 0110 0" = large-arc 0, sweep 1, x 10). The generic number
 * tokenizer read "0110" as 110, so the arc had too few args and was silently
 * dropped. The compact form must parse identically to the fully-spaced form.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSvgPath } from '../engine/src/svg-path.ts';

test('compact arc flags parse identically to the spaced form', () => {
  const compact = parseSvgPath('M0 0A5 5 0 0110 0');
  const spaced  = parseSvgPath('M0 0A5 5 0 0 1 10 0');

  // The arc must not be dropped: it produces real geometry.
  assert.ok(compact.length > 0, 'compact arc yielded no subpaths');
  assert.ok(
    compact.some(s => s.segments.some(seg => seg.op === 'C' || seg.op === 'L')),
    'compact arc yielded no line/curve geometry',
  );

  // And it must match the unambiguous spaced encoding exactly.
  assert.deepEqual(compact, spaced);
});
