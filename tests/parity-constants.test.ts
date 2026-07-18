/**
 * Parity guard for the audio-coaching thresholds that are hand-mirrored between the
 * tool hook and the shell core.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 * No test framework — uses node:test built-in.
 *
 * The coaching constants live in TWO places on purpose: the shell core
 * (shells/web/src/lib/audio-coach-core.ts) computes the HUD verdict, and the tool hook
 * (voice-recorder/hooks.js — shipped in BOTH brands/lolly-start and the private
 * brands/suse pack) recomputes the same verdict DOM-free — the hook ships as tool DATA
 * and cannot import from the shell, so it keeps its own copies. The decision was to keep
 * that duplication and guard it here, so re-tuning one file without the other fails this
 * test.
 *
 * audio-coach-core.ts is treated as the source of truth: each shared constant is read
 * from it and asserted to appear as the same numeric literal in hooks.js.
 *
 * Constants guarded (see audio-coach-core.ts):
 *   BANDS   = { soft [0.02, 0.18], normal [0.05, 0.32], loud [0.10, 0.5] }  (rms bounds)
 *   NOISY_FLOOR_DBFS = -50
 *   HUM_RATIO        = 0.25
 *   HISS_FLATNESS    = 0.45
 *   SPEAKING_SNR_DB  = 12
 * (hooks.js also mirrors STEADY_NOISE = 0.6, but this test only asserts the set above.)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const core = readFileSync(new URL('../shells/web/src/lib/audio-coach-core.ts', import.meta.url), 'utf8');

// voice-recorder ships in BOTH brand packs. Gate on the SOURCE packs, not the
// gitignored tools/ profile view (which silently vanishes if the tool is
// renamed): brands/lolly-start is parent-owned and always present, so its copy
// is asserted unconditionally; the private brands/suse copy is compared too
// whenever that pack is mounted — and with the pack mounted, a missing hook
// FAILS, it never skips.
const startHookUrl = new URL('../brands/lolly-start/tools/voice-recorder/hooks.js', import.meta.url);
assert.ok(existsSync(startHookUrl),
  'brands/lolly-start/tools/voice-recorder/hooks.js is missing — the tool was renamed or deleted');
const susePackUrl = new URL('../brands/suse/tools/', import.meta.url);
const suseHookUrl = new URL('voice-recorder/hooks.js', susePackUrl);
if (existsSync(susePackUrl)) {
  assert.ok(existsSync(suseHookUrl),
    'brands/suse/tools/voice-recorder/hooks.js is missing — pack is mounted, so the tool was renamed or deleted');
}

// Every mounted copy of the hook must mirror the core constants.
const HOOKS: Array<[string, string]> = [
  ['brands/lolly-start', readFileSync(startHookUrl, 'utf8')],
  ...(existsSync(susePackUrl) ? [['brands/suse', readFileSync(suseHookUrl, 'utf8')] as [string, string]] : []),
];

// Read a named `NAME = <number>` literal from the core module (source of truth).
function coreConst(name: string): string {
  const m = core.match(new RegExp(name + '\\s*=\\s*(-?\\d+(?:\\.\\d+)?)'));
  assert.ok(m, `audio-coach-core.ts should declare ${name}`);
  return m![1]!;
}

// Read a BANDS row (`name: [a, b]`) from a source, as its two literal strings.
function band(src: string, name: string): [string, string] {
  const m = src.match(new RegExp(name + '\\s*:\\s*\\[\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*\\]'));
  assert.ok(m, `BANDS.${name} should be present`);
  return [m![1]!, m![2]!];
}

// True if `n` (a numeric literal like "-50" or "0.10") appears in `src` as a standalone
// number — not as a digit-substring of a longer number.
function hasNumber(src: string, n: string): boolean {
  const esc = n.replace(/[.\\]/g, '\\$&');
  return new RegExp('(?<![\\d.])' + esc + '(?![\\d.])').test(src);
}

test('audio-coaching BANDS match between shell core and every voice-recorder hook', () => {
  for (const [pack, hook] of HOOKS) {
    for (const row of ['soft', 'normal', 'loud']) {
      assert.deepEqual(
        band(hook, row),
        band(core, row),
        `BANDS.${row} drifted between ${pack}/tools/voice-recorder/hooks.js and audio-coach-core.ts`,
      );
    }
  }
});

test('audio-coaching room/speech thresholds are mirrored in every voice-recorder hook', () => {
  for (const [pack, hook] of HOOKS) {
    for (const name of ['NOISY_FLOOR_DBFS', 'HUM_RATIO', 'HISS_FLATNESS', 'SPEAKING_SNR_DB']) {
      const value = coreConst(name);
      assert.ok(
        hasNumber(hook, value),
        `${name} (${value}) from audio-coach-core.ts is not mirrored in ${pack}/tools/voice-recorder/hooks.js`,
      );
    }
  }
});
