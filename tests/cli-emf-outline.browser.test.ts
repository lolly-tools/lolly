// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly <tool> --export=emf --text=outline` on text no font can outline. The Node tier
 * hands such a run to the browser tier (#778), which is driven by a link; the link now
 * carries the request as `_text=outline`, so the web shell outlines the text and draws
 * the run it cannot outline as a picture, with no "did not apply" warning. Without the
 * flag the EMF keeps its live text record, the default on both tiers.
 *
 * Runs where a browser is named (LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { emfLiveTextRecords } from '../engine/src/emf.ts';

const skip = process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH ? false : 'set LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH to render through the browser tier';
const dir = await mkdtemp(join(tmpdir(), 'lolly-emf-outline-'));
after(() => rm(dir, { recursive: true, force: true }));

/** The bits per pixel of each EMR_STRETCHDIBITS record: a text picture is a 1-bit mask and paint pair. */
function blitDepths(bytes: Uint8Array): number[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const depths: number[] = [];
  for (let at = 0; at + 8 <= bytes.byteLength;) {
    const type = dv.getUint32(at, true), size = dv.getUint32(at + 4, true);
    if (size < 8) break;
    if (type === 0x51) depths.push(dv.getUint16(at + 94, true));
    if (type === 0x0e) break;
    at += size;
  }
  return depths;
}

function emf(name: string, extra: string[]): { bytes: Promise<Uint8Array>; stderr: string } {
  const out = join(dir, `${name}.emf`);
  const run = spawnSync(process.execPath, [
    'shells/cli/bin/lolly.ts', 'run', 'wordmark', '--input.text=வணக்கம்', '--export=emf', '--no-provenance', `--output=${out}`, ...extra,
  ], { encoding: 'utf8', env: { ...process.env, LOLLY_RENDERER: 'chromium', LOLLY_STATE_DIR: join(dir, `state-${name}`), NO_COLOR: '1' }, maxBuffer: 1 << 24 });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  return { bytes: readFile(out).then((b) => new Uint8Array(b)), stderr: run.stderr };
}

test('--text=outline reaches the browser tier: the Tamil run is a picture, with no live text and no warning', { skip, timeout: 300_000 }, async () => {
  const outline = emf('outline', ['--text=outline']);
  const bytes = await outline.bytes;
  assert.doesNotMatch(outline.stderr, /did not apply/);
  assert.equal(emfLiveTextRecords(bytes), 0, 'no live text record');
  assert.deepEqual(blitDepths(bytes).filter((d) => d === 1).length, 2, 'one mask and paint pair: the run is a picture');

  const live = emf('live', []);
  assert.ok(emfLiveTextRecords(await live.bytes) > 0, 'without the flag the run stays live text');
});
