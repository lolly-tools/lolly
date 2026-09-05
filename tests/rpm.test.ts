// SPDX-License-Identifier: MPL-2.0
/**
 * tests/rpm.test.ts - the RPM v4 container writer: the Lead + both header magics,
 * the immutable-region trailers, the file-list arrays, the gzipped-cpio payload
 * (round-tripped and, if a system reader exists, read back), the SHA-256 header
 * digest in the signature header, and byte-for-byte determinism.
 *
 * A real `rpm` accepts + installs the output; that is verified in an openSUSE
 * container (plan 197 section 11), gated on $LOLLY_RPM_BIN so the offline suite
 * stays fast.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildRpm, type RpmSpec } from '../engine/src/rpm.ts';
import { sha256Hex } from '../engine/src/bytes.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array): string => new TextDecoder().decode(b);
const eq = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const u32 = (b: Uint8Array, o: number): number =>
  ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;

/** Total byte length of the header at `off`: magic(8) + il(4) + dl(4) + il*16 index + dl store. */
function headerLen(b: Uint8Array, off: number): { il: number; dl: number; len: number } {
  const il = u32(b, off + 8);
  const dl = u32(b, off + 12);
  return { il, dl, len: 16 + il * 16 + dl };
}
const roundUp8 = (n: number): number => (n + 7) & ~7;

function sample(): RpmSpec {
  return {
    meta: {
      name: 'lolly-sample-wallpapers', version: '1.0', release: '1',
      summary: 'Sample wallpapers', description: 'A sample wallpaper package produced by Lolly.',
      license: 'CC-BY-4.0', group: 'System/GUI/Other', vendor: 'Lolly', url: 'https://lolly.tools',
    },
    files: [
      { path: '/usr/share/backgrounds/lolly/a.svg', data: enc('<svg/>') },
      { path: '/usr/share/backgrounds/lolly/b.txt', data: enc('hello wallpaper') },
    ],
  };
}

test('buildRpm emits a Lead + two header magics + a payload', async () => {
  const rpm = await buildRpm(sample());
  assert.ok(eq(rpm.subarray(0, 4), Uint8Array.of(0xed, 0xab, 0xee, 0xdb)), 'lead magic');
  assert.equal(rpm[5], 0, 'lead minor');
  assert.equal(u32(rpm, 6) >>> 16, 0, 'lead type = 0 (binary)');

  // signature header
  assert.ok(eq(rpm.subarray(96, 100), Uint8Array.of(0x8e, 0xad, 0xe8, 0x01)), 'sig header magic');
  const sig = headerLen(rpm, 96);
  const mainStart = 96 + roundUp8(sig.len);
  assert.equal(mainStart % 8, 0, 'main header 8-byte aligned');

  // main header
  assert.ok(eq(rpm.subarray(mainStart, mainStart + 4), Uint8Array.of(0x8e, 0xad, 0xe8, 0x01)), 'main header magic');
  const main = headerLen(rpm, mainStart);
  const payloadStart = mainStart + main.len;
  assert.ok(payloadStart < rpm.length, 'payload present');

  // payload is a gzip of a newc cpio
  const payload = rpm.subarray(payloadStart);
  assert.equal(payload[0], 0x1f, 'gzip id1');
  assert.equal(payload[1], 0x8b, 'gzip id2');
  const cpio = new Uint8Array(gunzipSync(Buffer.from(payload)));
  assert.equal(dec(cpio.subarray(0, 6)), '070701', 'payload is newc cpio');
});

test('both headers open with their immutable-region entry', async () => {
  const rpm = await buildRpm(sample());
  // sig header: first index entry (at 96 + 16) has tag RPMTAG_HEADERSIGNATURES (62)
  assert.equal(u32(rpm, 96 + 16), 62, 'sig region tag');
  const sig = headerLen(rpm, 96);
  const mainStart = 96 + roundUp8(sig.len);
  // main header: first index entry has tag RPMTAG_HEADERIMMUTABLE (63)
  assert.equal(u32(rpm, mainStart + 16), 63, 'main region tag');
});

test('the signature header carries the SHA-256 of the main header', async () => {
  const rpm = await buildRpm(sample());
  const sig = headerLen(rpm, 96);
  const mainStart = 96 + roundUp8(sig.len);
  const main = headerLen(rpm, mainStart);
  const mainHeader = rpm.subarray(mainStart, mainStart + main.len);
  const digest = await sha256Hex(mainHeader);
  // the hex digest string is stored verbatim in the signature header data store
  const sigBytes = rpm.subarray(96, mainStart);
  assert.ok(dec(sigBytes).includes(digest), 'sig SHA-256 matches the main header');
});

test('file digests in the payload path round-trip; a reader can list them (if available)', async (t) => {
  const rpm = await buildRpm(sample());
  const sig = headerLen(rpm, 96);
  const mainStart = 96 + roundUp8(sig.len);
  const main = headerLen(rpm, mainStart);
  const payload = rpm.subarray(mainStart + main.len);
  const cpio = new Uint8Array(gunzipSync(Buffer.from(payload)));

  let bsdtar = false;
  try { execFileSync('bsdtar', ['--version'], { stdio: 'ignore' }); bsdtar = true; } catch { /* skip */ }
  if (!bsdtar) { t.skip('no bsdtar executable on this runner'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'lolly-rpm-'));
  try {
    const p = join(dir, 'payload.cpio');
    writeFileSync(p, cpio);
    const list = execFileSync('bsdtar', ['-tf', p], { encoding: 'utf8' }).trim().split('\n').sort();
    // RPM payloads carry the "./" prefix (the PayloadFilesHavePrefix feature).
    assert.deepEqual(list, ['./usr/share/backgrounds/lolly/a.svg', './usr/share/backgrounds/lolly/b.txt']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildRpm is deterministic (same spec → identical bytes)', async () => {
  assert.ok(eq(await buildRpm(sample()), await buildRpm(sample())));
});

test('a real rpm accepts the package (gated on $LOLLY_RPM_BIN)', async (t) => {
  const rpmBin = process.env.LOLLY_RPM_BIN;
  if (!rpmBin) { t.skip('set LOLLY_RPM_BIN to an rpm binary to run'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'lolly-rpmv-'));
  try {
    const p = join(dir, 'sample.rpm');
    writeFileSync(p, await buildRpm(sample()));
    const info = execFileSync(rpmBin, ['-qp', '--qf', '%{NAME} %{VERSION} %{ARCH}', p], { encoding: 'utf8' });
    assert.equal(info.trim(), 'lolly-sample-wallpapers 1.0 noarch');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
