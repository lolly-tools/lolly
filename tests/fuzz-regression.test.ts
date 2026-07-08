// SPDX-License-Identifier: MPL-2.0
/**
 * Fast, deterministic fuzz regression for the engine's untrusted-input parsers.
 * Runs under the normal quoted node:test glob and finishes in well under 5s.
 * It does two things:
 *
 *   1. Replays every saved regression input in tests/fuzz/regressions/ (inputs a
 *      prior discovery run — or a hand-added proof-of-concept — proved to crash,
 *      hang, or blow up allocation) against its target, asserting the parser now
 *      returns or throws promptly and bounded.
 *   2. Runs a few hundred seeded mutations per target (same mulberry32 PRNG the
 *      discovery runner uses), asserting none crash the process (stack overflow),
 *      hang (> budget on a < 64 KB input), or trip an allocation blow-up.
 *
 * The heavy sweep lives in tests/fuzz/run.ts (standalone). A long soak is
 *   FUZZ_ITERS=50000 node tests/fuzz/run.ts
 *
 * The harness (prng.ts / mutate.ts / targets.ts) is shared with that runner, so
 * this test and the soak exercise the exact same code path — no drift.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mulberry32 } from './fuzz/prng.ts';
import { mutate } from './fuzz/mutate.ts';
import { ALL_TARGETS, TARGETS_BY_NAME, type FuzzTarget } from './fuzz/targets.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGRESS = join(HERE, 'fuzz', 'regressions');
const HANG_MS = 2000;
const MAX_HANG_SIZE = 64 * 1024;
// Kept in lockstep with run.ts so replay reproduces discovery-run sequences.
const BASE_SEED = 0x1abe11ed;
// A per-test replay budget: mutations per target that still finishes the whole
// suite in a couple of seconds. Bump via FUZZ_ITERS locally for a deeper pass.
const ITERS = Number(process.env.FUZZ_ITERS || 300);

// A thrown Error is the DESIRED, controlled outcome. Only a stack-overflow
// (runaway recursion) or an allocation blow-up counts as an escaped failure.
function assertControlled(err: unknown, label: string): void {
  const msg = err instanceof Error ? err.message : String(err);
  assert.ok(!/maximum call stack/i.test(msg), `${label}: runaway recursion — ${msg}`);
  assert.ok(!/invalid (typed )?array length|array buffer allocation|out of memory/i.test(msg), `${label}: allocation blow-up — ${msg}`);
}

async function feed(target: FuzzTarget, bytes: Uint8Array, label: string): Promise<void> {
  const t0 = performance.now();
  try {
    await target.invoke(bytes);
  } catch (err) {
    assertControlled(err, label);
    return; // a prompt, controlled throw is fine
  }
  const ms = performance.now() - t0;
  if (bytes.length < MAX_HANG_SIZE) {
    assert.ok(ms <= HANG_MS, `${label}: took ${ms.toFixed(0)}ms on ${bytes.length}B — looks like a hang`);
  }
}

// 1. Replay the saved regression corpus. Filenames are `<target>-*.bin`.
test('regression corpus replays without crash / hang / alloc blow-up', async () => {
  let files: string[] = [];
  try { files = readdirSync(REGRESS).filter((f) => f.endsWith('.bin')); } catch { /* no corpus yet */ }
  // Filenames are `<target>-<suffix>.bin`; target names themselves contain
  // hyphens (pdf-map, media-sniff, c2pa-verify), so match by known-name prefix,
  // longest first, rather than splitting on the last hyphen.
  const names = Object.keys(TARGETS_BY_NAME).sort((a, b) => b.length - a.length);
  for (const file of files) {
    const targetName = names.find((n) => file === `${n}.bin` || file.startsWith(`${n}-`));
    assert.ok(targetName, `regression file ${file} has no matching target`);
    const bytes = new Uint8Array(readFileSync(join(REGRESS, file)));
    await feed(TARGETS_BY_NAME[targetName!]!, bytes, `replay ${file}`);
  }
});

// 2. A few hundred seeded mutations per target — the same deterministic sequence
//    the discovery runner uses, so a reintroduced defect surfaces here first.
for (const target of ALL_TARGETS) {
  test(`fuzz ${target.name}: ${ITERS} seeded mutations stay bounded`, async () => {
    const seeds = await target.seeds();
    const rng = mulberry32(BASE_SEED ^ [...target.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
    for (let iter = 0; iter < ITERS; iter++) {
      const bytes = mutate(seeds[rng.int(seeds.length)]!, rng);
      await feed(target, bytes, `${target.name} iter#${iter}`);
    }
  });
}
