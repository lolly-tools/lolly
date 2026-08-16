// SPDX-License-Identifier: MPL-2.0
/**
 * The code-comment vernacular ratchet (owner directive, 2026-08-16: humans read
 * comments, so the plain-language rule that governs the docs governs them too).
 *
 * scripts/check-code-comment-vernacular.ts scans every owned .ts comment for em
 * dashes and the shared claudism ban list, and holds a per-file baseline that can
 * only go DOWN. This test is that ratchet in npm test.
 *
 * If this fails:
 *  - "rose"       a comment gained an em dash or a tic. Fix the comment.
 *  - "new file"   a new .ts has a claudism in a comment. Write it in plain English.
 *  - "improved"   you cleaned a comment. Lock the win:
 *                 node scripts/check-code-comment-vernacular.ts --write
 *
 * Never widen the baseline to pass. The only allowed move is down.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drift } from '../scripts/check-code-comment-vernacular.ts';

test('code comments carry no new em dashes or claudism phrases (ratchet only goes down)', () => {
  const d = drift();
  const lines = [
    ...d.over.map(x => `${x.file}: rose ${x.was} → ${x.now}`),
    ...d.fresh.map(x => `${x.file}: new file with ${x.now} comment claudism(s)`),
    ...d.under.map(x => `${x.file}: improved ${x.was} → ${x.now} (run --write to lock)`),
  ];
  assert.deepEqual(lines, [], 'code-comment vernacular ratchet drifted — see scripts/check-code-comment-vernacular.ts');
});
