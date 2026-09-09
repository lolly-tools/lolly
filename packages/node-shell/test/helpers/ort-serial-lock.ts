// SPDX-License-Identifier: MPL-2.0
/**
 * Cross-process serialization for the onnxruntime-node test tier.
 *
 * onnxruntime-node 1.29 on macOS can abort at process exit
 * (`libc++abi ... recursive_mutex lock failed: Invalid argument`) when its
 * native runtime tears down while the machine is under load - the teardown loses
 * a scheduling race for its own mutex. The abort marks every passed test in the
 * file as failed. The two node-shell ML files (ml.test.ts, speech.test.ts)
 * already run single-threaded (LOLLY_ORT_THREADS=1) and settle 300ms after
 * releasing their sessions, yet under a full 1100+-file `node --test` run the
 * gate still tripped it - and it HOPPED between the two files (ml on one run,
 * speech on the next), while each passes cleanly in isolation. That signature is
 * two native runtimes tearing down at once, not a code fault.
 *
 * This is the same class of contention the browser encode tier solved with a
 * cross-process mkdir lock (tests/helpers/sequence-browser.ts): serialize the
 * heavy files so only one native runtime is ever active. The one refinement here
 * is WHEN the lock is released. The abort lives in native teardown, which runs
 * AFTER node:test's `after` hooks, at process exit - so releasing in `after`
 * would let the next ORT file start inference while this one is still tearing
 * down, the exact overlap we are removing. The lock is therefore held for the
 * whole process lifetime and freed only in `process.on('exit')`.
 *
 * A stale takeover frees the lock if a holder ever dies WITHOUT its exit handler
 * running - which is precisely the abort case (SIGABRT skips 'exit') - so a
 * residual crash can wedge the tier for at most ORT_LOCK_STALE_MS, never
 * forever. Each ML file runs in well under 30s, so the 3-minute threshold only
 * ever fires on a genuinely dead holder.
 */
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ORT_LOCK = join(tmpdir(), 'lolly-ort-node.lock');
const ORT_LOCK_STALE_MS = 3 * 60_000;

let held = false;

function releaseOrtLock(): void {
  if (!held) return;
  held = false;
  rmSync(ORT_LOCK, { recursive: true, force: true });
}

/**
 * Acquire the ORT serialization lock and hold it until this process exits.
 *
 * Call once, from a top-level `before()` hook, in any test file that creates a
 * native onnxruntime-node session. Re-entrant within a process (a no-op after
 * the first call), so it is safe under `--test-isolation=none` where several
 * files share one process and one exit.
 */
export async function serializeOrtTier(): Promise<void> {
  if (held) return;
  for (;;) {
    try {
      mkdirSync(ORT_LOCK);
      break;
    } catch {
      try {
        if (Date.now() - statSync(ORT_LOCK).mtimeMs > ORT_LOCK_STALE_MS) {
          rmSync(ORT_LOCK, { recursive: true, force: true });
          continue;
        }
      } catch {
        // The holder released between our mkdir and our stat - just retry.
      }
      await new Promise((r) => setTimeout(r, 250 + Math.floor(Math.random() * 250)));
    }
  }
  held = true;
  // Freed only when the process truly exits, i.e. AFTER onnxruntime's native
  // teardown - so the next ORT file cannot begin inference during this one's
  // teardown, which is where the abort lives.
  process.once('exit', releaseOrtLock);
}
