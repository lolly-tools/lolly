// SPDX-License-Identifier: MPL-2.0
/**
 * Requested corpus run for engine/src/smf.ts: every `.mid` in plans/smf-corpus
 * (public-domain scores from the Mutopia Project, fetched by hand; see the
 * RESULTS.md beside them) must write back to the same bytes.
 *
 * Run with LOLLY_SMF_CORPUS=1. When the run is requested and the data is absent the
 * test fails. Without the variable nothing is registered, so ordinary runs stay offline.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readSmf, writeSmf } from '../engine/src/smf.ts';

if (process.env.LOLLY_SMF_CORPUS === '1') {
  test('the SMF corpus round trips byte for byte', () => {
    const dir = fileURLToPath(new URL('../plans/smf-corpus/', import.meta.url));
    assert.ok(existsSync(dir), `corpus missing: ${dir}`);
    const names = readdirSync(dir).filter((n) => n.endsWith('.mid'));
    assert.ok(names.length >= 5, 'corpus has files');
    for (const n of names) {
      const b = new Uint8Array(readFileSync(dir + n));
      assert.deepEqual(writeSmf(readSmf(b)), b, n);
    }
  });
}
