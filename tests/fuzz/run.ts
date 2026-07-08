// SPDX-License-Identifier: MPL-2.0
/**
 * Fuzz discovery runner (standalone — NOT part of the node:test suite).
 *
 *   node tests/fuzz/run.ts [iters] [targetName]
 *
 * Feeds mutated buffers to each target and classifies the outcome. A THROWN
 * validation Error is the desired behaviour and is ignored. A finding is:
 *   - crash : a RangeError "Maximum call stack size exceeded" (runaway recursion)
 *   - alloc : an "Invalid array length" / "Invalid typed array length" (a length
 *             field trusted into an allocation) or other allocation failure
 *   - hang  : > HANG_MS on a < 64 KB input (a length/offset trusted into a loop)
 *
 * Every input in play is written to scratchpad current-<target>.bin BEFORE the
 * call, so if an uncatchable event (true OOM, hard hang killed by an outer
 * timeout) takes the process down, the culprit is on disk. Failing inputs are
 * saved to tests/fuzz/regressions/<target>-<n>.bin.
 */

import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mulberry32 } from './prng.ts';
import { mutate } from './mutate.ts';
import { ALL_TARGETS, TARGETS_BY_NAME, type FuzzTarget } from './targets.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REGRESS = join(HERE, 'regressions');
const SCRATCH = process.env.FUZZ_SCRATCH || HERE;
const HANG_MS = 2000;
const MAX_HANG_SIZE = 64 * 1024;
const BASE_SEED = 0x1abe11ed;

mkdirSync(REGRESS, { recursive: true });

interface Finding { target: string; iter: number; kind: 'crash' | 'alloc' | 'hang'; ms: number; size: number; message: string; bytes: Uint8Array; }

function classify(err: unknown): 'crash' | 'alloc' | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (/maximum call stack/i.test(msg)) return 'crash';
  if (/invalid (typed )?array length|array buffer allocation|out of memory/i.test(msg)) return 'alloc';
  return null; // any other throw is the desired, controlled rejection
}

async function fuzzTarget(target: FuzzTarget, iters: number): Promise<Finding[]> {
  const seeds = await target.seeds();
  const rng = mulberry32(BASE_SEED ^ [...target.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
  const findings: Finding[] = [];
  const seenHang = new Set<string>();
  const cur = join(SCRATCH, `current-${target.name}.bin`);
  for (let iter = 0; iter < iters; iter++) {
    const seed = seeds[rng.int(seeds.length)]!;
    const bytes = mutate(seed, rng);
    writeFileSync(cur, bytes); // breadcrumb for an uncatchable death
    const t0 = performance.now();
    try {
      await target.invoke(bytes);
    } catch (err) {
      const kind = classify(err);
      if (kind) findings.push({ target: target.name, iter, kind, ms: performance.now() - t0, size: bytes.length, message: err instanceof Error ? err.message : String(err), bytes });
      continue;
    }
    const ms = performance.now() - t0;
    if (ms > HANG_MS && bytes.length < MAX_HANG_SIZE) {
      const key = `${bytes.length}`;
      if (!seenHang.has(key)) { seenHang.add(key); findings.push({ target: target.name, iter, kind: 'hang', ms, size: bytes.length, message: `took ${ms.toFixed(0)}ms on ${bytes.length}B`, bytes }); }
    }
    if ((iter % 500) === 0) process.stderr.write(`  ${target.name}: ${iter}/${iters}\n`);
  }
  return findings;
}

async function main(): Promise<void> {
  const iters = Number(process.argv[2] || process.env.FUZZ_ITERS || 2500);
  const only = process.argv[3];
  const targets = only ? [TARGETS_BY_NAME[only]!].filter(Boolean) : ALL_TARGETS;
  // Clear only THIS runner's auto-generated files (`<target>-<n>.bin`) from a
  // prior run; hand-curated regression fixtures (any other name) are preserved.
  if (!process.env.FUZZ_KEEP) for (const f of readdirSync(REGRESS)) if (/-\d+\.bin$/.test(f)) unlinkSync(join(REGRESS, f));

  const all: Finding[] = [];
  for (const target of targets) {
    process.stderr.write(`\n== ${target.name} (${iters} iters) ==\n`);
    const found = await fuzzTarget(target, iters);
    let n = 0;
    for (const f of found) {
      const path = join(REGRESS, `${f.target}-${n++}.bin`);
      writeFileSync(path, f.bytes);
      all.push(f);
    }
    process.stderr.write(`   findings: ${found.length}\n`);
  }

  process.stdout.write('\n=== FUZZ SUMMARY ===\n');
  if (!all.length) { process.stdout.write('clean — no crashes, hangs, or allocation blow-ups\n'); return; }
  for (const f of all) process.stdout.write(`[${f.kind}] ${f.target} iter#${f.iter} size=${f.size} ${f.ms.toFixed(0)}ms :: ${f.message}\n`);
  process.exitCode = 1;
}

main().catch((e) => { process.stderr.write(`runner crashed: ${e?.stack || e}\n`); process.exitCode = 2; });
