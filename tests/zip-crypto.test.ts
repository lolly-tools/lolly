// SPDX-License-Identifier: MPL-2.0
// Contract tests for the two-tier zip encryptor (engine/src/zip-crypto.ts). Both
// tiers are independently decrypted here with node:crypto (the engine only encrypts),
// mirroring pdf-crypto-r6.test.ts. End-to-end proof against real tools (unzip -P /
// pyzipper) lives in scratchpad; these guard CI against byte drift.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import {
  crc32, zipCryptoEncrypt, deriveAesZipKey, aesZipEncryptEntry, buildEncryptedZip,
} from '../engine/src/zip-crypto.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const u32 = (b: Uint8Array, o: number): number => new DataView(b.buffer, b.byteOffset, b.length).getUint32(o, true);
const u16 = (b: Uint8Array, o: number): number => new DataView(b.buffer, b.byteOffset, b.length).getUint16(o, true);

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(enc('123456789')) >>> 0, 0xcbf43926);
});

test('ZipCrypto: encrypt round-trips and the check byte is the CRC high byte', () => {
  const pw = enc('a-long-enough-password-to-exercise-key1');   // exercises the Math.imul multiply
  const data = enc('BT /F1 12 Tf (Confidential batch) Tj ET'.repeat(4));
  const crc = crc32(data);
  const random11 = new Uint8Array(11).fill(0xab);
  const payload = zipCryptoEncrypt(pw, data, crc, random11);
  assert.equal(payload.length, 12 + data.length);

  // Independent ZipCrypto decrypt (pure arithmetic).
  let k0 = 0x12345678, k1 = 0x23456789, k2 = 0x34567890;
  const T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const upd = (c: number) => { k0 = (T[(k0 ^ c) & 0xff]! ^ (k0 >>> 8)) >>> 0; k1 = (k1 + (k0 & 0xff)) >>> 0; k1 = (Math.imul(k1, 0x08088405) + 1) >>> 0; k2 = (T[(k2 ^ ((k1 >>> 24) & 0xff)) & 0xff]! ^ (k2 >>> 8)) >>> 0; };
  for (const b of pw) upd(b);
  const dec = new Uint8Array(payload.length);
  for (let i = 0; i < payload.length; i++) { const t = (k2 | 2) & 0xffff; const s = ((t * (t ^ 1)) >>> 8) & 0xff; const p = (payload[i]! ^ s) & 0xff; dec[i] = p; upd(p); }
  assert.equal(dec[11], (crc >>> 24) & 0xff, 'check byte == CRC high byte');
  assert.deepEqual(dec.subarray(12), data, 'recovers the compressed data');
});

test('AE-2 AES-256: PBKDF2 split, LE-CTR encrypt, HMAC — round-trips via node:crypto', async () => {
  const pw = enc('correct horse battery staple');
  const salt = new Uint8Array(16).map((_, i) => (i * 7 + 1) & 0xff);
  const data = enc('PNG-ish binary payload with SECRET markers'.repeat(3));

  const keys = await deriveAesZipKey(pw, salt);
  assert.equal(keys.encKey.length, 32);
  assert.equal(keys.authKey.length, 32);
  assert.equal(keys.pwVerify.length, 2);
  // PBKDF2-HMAC-SHA1 (note: SHA-1, not SHA-256), 1000 iters, 66 bytes.
  const dk = nodeCrypto.pbkdf2Sync(Buffer.from(pw), Buffer.from(salt), 1000, 66, 'sha1');
  assert.equal(Buffer.from(keys.encKey).toString('hex'), dk.subarray(0, 32).toString('hex'));
  assert.equal(Buffer.from(keys.pwVerify).toString('hex'), dk.subarray(64, 66).toString('hex'));

  const blob = await aesZipEncryptEntry(pw, data, salt);
  assert.equal(blob.length, 16 + 2 + data.length + 10);
  assert.deepEqual(blob.subarray(0, 16), salt, 'salt prefix');
  const ct = blob.subarray(18, 18 + data.length);
  const mac = blob.subarray(18 + data.length);

  // WinZip LITTLE-endian CTR keystream via AES-256-ECB of each LE counter block.
  const encKey = Buffer.from(dk.subarray(0, 32));
  const ksBlock = (value: bigint): Buffer => {
    const counter = Buffer.alloc(16); let v = value;
    for (let b = 0; b < 16; b++) { counter[b] = Number(v & 0xffn); v >>= 8n; }
    const c = nodeCrypto.createCipheriv('aes-256-ecb', encKey, null); c.setAutoPadding(false);
    return Buffer.concat([c.update(counter), c.final()]);
  };
  const dec = Buffer.alloc(data.length);
  for (let off = 0, val = 1n; off < data.length; off += 16, val += 1n) {
    const ks = ksBlock(val); const n = Math.min(16, data.length - off);
    for (let i = 0; i < n; i++) dec[off + i] = ct[off + i]! ^ ks[i]!;
  }
  assert.deepEqual(new Uint8Array(dec), data, 'LE-CTR decrypt recovers the data');

  // HMAC-SHA1 auth (first 10 bytes) over the ciphertext.
  const expMac = nodeCrypto.createHmac('sha1', Buffer.from(dk.subarray(32, 64))).update(Buffer.from(ct)).digest().subarray(0, 10);
  assert.equal(Buffer.from(mac).toString('hex'), expMac.toString('hex'), 'auth code matches');

  // Endianness guard: a BIG-endian CTR (what WebCrypto/Node AES-CTR would do) diverges
  // at block 2, so it must NOT recover the data — proving the engine used LE.
  if (data.length > 16) {
    const be = nodeCrypto.createDecipheriv('aes-256-ctr', encKey, Buffer.concat([Buffer.from([1]), Buffer.alloc(15)]));
    const beOut = Buffer.concat([be.update(Buffer.from(ct)), be.final()]);
    assert.notDeepEqual(new Uint8Array(beOut), data, 'big-endian CTR must NOT recover (confirms LE)');
  }
});

test('buildEncryptedZip frames the container correctly for both tiers', async () => {
  const entries = [
    { name: 'a.txt', compressed: enc('deflate-me'), method: 8 as const, crc32: crc32(enc('hi')), uncompressedSize: 2 },
    { name: 'b.bin', compressed: new Uint8Array([1, 2, 3, 4]), method: 0 as const, crc32: crc32(new Uint8Array([1, 2, 3, 4])), uncompressedSize: 4 },
  ];

  const std = await buildEncryptedZip(entries, { tier: 'standard', password: 'pw' });
  assert.equal(u32(std, 0), 0x04034b50, 'local file header signature');
  assert.equal(u16(std, 6) & 0x0001, 0x0001, 'GPBF encrypted bit set');
  assert.equal(u16(std, 8), 8, 'standard tier keeps the real method');
  // EOCD present with 2 records.
  const eStd = std.subarray(std.length - 22);
  assert.equal(u32(eStd, 0), 0x06054b50);
  assert.equal(u16(eStd, 10), 2, 'two central records');

  const strong = await buildEncryptedZip(entries, { tier: 'strong', password: 'pw' });
  assert.equal(u16(strong, 8), 99, 'strong tier method = 99 (AES)');
  assert.equal(u32(strong, 14), 0, 'strong tier CRC = 0 (AE-2)');
  // 0x9901 extra field in the local header (after the 5-byte name "a.txt").
  const extraOff = 30 + 5;
  assert.equal(u16(strong, extraOff), 0x9901, 'AES extra field id');
  assert.equal(strong[extraOff + 8], 0x03, 'AES-256 strength');
  assert.equal(strong[extraOff + 4], 0x02, 'AE-2 version');
});
