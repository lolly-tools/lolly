// SPDX-License-Identifier: MPL-2.0
/**
 * pending-files.ts - the one-shot mark handoff (plan 97 section 8, M5). Pure module
 * semantics only: stash / take / has, the two caps, and the single-use rule the
 * Logos room's drain depends on.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/pending-files.test.ts"
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  PENDING_LOGO_MAX_BYTES, PENDING_LOGO_MAX_FILES,
  hasPendingLogoFiles, stashPendingLogoFiles, takePendingLogoFiles,
} from './pending-files.ts';

/** An SVG mark of exactly `bytes` bytes, named so a warning can be read back. */
function mark(name: string, bytes = 64): File {
  return new File([new Uint8Array(bytes)], name, { type: 'image/svg+xml' });
}

/** Collect console.warn while a block runs - the over-cap drop is meant to be
 *  visible, so the test asserts it is said rather than swallowed. */
let warnings: string[] = [];
const realWarn = console.warn;

beforeEach(() => {
  takePendingLogoFiles();  // the stash is module-level; every test starts empty
  warnings = [];
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
});
afterEach(() => { console.warn = realWarn; });

test('an empty stash reports nothing waiting and takes nothing', () => {
  assert.equal(hasPendingLogoFiles(), false);
  assert.deepEqual(takePendingLogoFiles(), []);
});

test('stashed marks come back in order, once', () => {
  stashPendingLogoFiles([mark('a.svg'), mark('b.svg')]);
  assert.equal(hasPendingLogoFiles(), true);

  const taken = takePendingLogoFiles();
  assert.deepEqual(taken.map(f => f.name), ['a.svg', 'b.svg']);

  // Single use: this is exactly what stops a room re-paint re-queueing.
  assert.equal(hasPendingLogoFiles(), false);
  assert.deepEqual(takePendingLogoFiles(), []);
  assert.equal(warnings.length, 0);
});

test('hasPendingLogoFiles does not empty the stash', () => {
  stashPendingLogoFiles([mark('a.svg')]);
  assert.equal(hasPendingLogoFiles(), true);
  assert.equal(hasPendingLogoFiles(), true);
  assert.equal(takePendingLogoFiles().length, 1);
});

test('a second send replaces the first - the stash is a message, not a queue', () => {
  stashPendingLogoFiles([mark('old.svg')]);
  stashPendingLogoFiles([mark('new.svg')]);
  assert.deepEqual(takePendingLogoFiles().map(f => f.name), ['new.svg']);
});

test('sending nothing clears a stash that was already armed', () => {
  stashPendingLogoFiles([mark('a.svg')]);
  stashPendingLogoFiles([]);
  assert.equal(hasPendingLogoFiles(), false);
});

test('the file cap keeps the first 8 and warns about the rest', () => {
  const many = Array.from({ length: PENDING_LOGO_MAX_FILES + 3 }, (_, i) => mark(`m${i}.svg`));
  const report = stashPendingLogoFiles(many);

  const taken = takePendingLogoFiles();
  assert.equal(taken.length, PENDING_LOGO_MAX_FILES);
  assert.deepEqual(taken.map(f => f.name), many.slice(0, PENDING_LOGO_MAX_FILES).map(f => f.name));
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /11 marks sent, only the first 8/);
  assert.deepEqual(report, { sent: PENDING_LOGO_MAX_FILES, tooBig: 0, overflow: 3 });
});

test('an over-size mark is dropped by name and the rest still travel', () => {
  const big = mark('huge.svg', PENDING_LOGO_MAX_BYTES + 1);
  const report = stashPendingLogoFiles([big, mark('small.svg')]);

  assert.deepEqual(takePendingLogoFiles().map(f => f.name), ['small.svg']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /huge\.svg/);
  assert.deepEqual(report, { sent: 1, tooBig: 1, overflow: 0 });
});

// The whole point of the report: a caller that promised a count can correct it.
// A send where every mark was refused must be distinguishable from a success,
// because the sender navigates, plays a sound and leaves the person in a room
// that would otherwise be inexplicably empty.
test('a send that arms nothing reports sent: 0 rather than looking like a success', () => {
  const report = stashPendingLogoFiles([mark('huge.svg', PENDING_LOGO_MAX_BYTES + 1)]);
  assert.equal(report.sent, 0);
  assert.equal(report.tooBig, 1);
  assert.equal(hasPendingLogoFiles(), false);
});

test('an ordinary send reports exactly what was armed', () => {
  assert.deepEqual(stashPendingLogoFiles([mark('a.svg'), mark('b.svg')]), { sent: 2, tooBig: 0, overflow: 0 });
  assert.deepEqual(stashPendingLogoFiles([]), { sent: 0, tooBig: 0, overflow: 0 });
});

test('a mark of exactly the byte cap travels - the limit is inclusive', () => {
  stashPendingLogoFiles([mark('exact.svg', PENDING_LOGO_MAX_BYTES)]);
  assert.equal(takePendingLogoFiles().length, 1);
  assert.equal(warnings.length, 0);
});

test('the file cap counts what survived the byte cap, not what was offered', () => {
  // 8 usable marks behind 3 over-size ones: all 8 must arrive.
  const offered = [
    ...Array.from({ length: 3 }, (_, i) => mark(`big${i}.svg`, PENDING_LOGO_MAX_BYTES + 1)),
    ...Array.from({ length: PENDING_LOGO_MAX_FILES }, (_, i) => mark(`ok${i}.svg`)),
  ];
  stashPendingLogoFiles(offered);

  const taken = takePendingLogoFiles();
  assert.equal(taken.length, PENDING_LOGO_MAX_FILES);
  assert.ok(taken.every(f => f.name.startsWith('ok')));
  assert.equal(warnings.length, 3);  // one per dropped file, no spurious count warning
});
