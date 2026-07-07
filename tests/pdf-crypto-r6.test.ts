// SPDX-License-Identifier: MPL-2.0
// Byte-exactness + round-trip tests for the R6/AES-256 PDF security handler
// (engine/src/pdf-crypto-r6.ts). The fixed vector below was generated and
// cross-verified independently; the engine must reproduce these exact bytes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import {
  hashR6,
  preparePassword,
  buildEncryptDictValues,
  encryptObjectBytes,
} from '../engine/src/pdf-crypto-r6.ts';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const unhex = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, 'hex'));

// ── Fixed vector (all values are RANDOM in production; pinned here for the test) ──
const VECTOR = {
  userPw: 'user',
  ownerPw: 'owner',
  uvs: '0102030405060708',
  uks: '1112131415161718',
  ovs: '2122232425262728',
  oks: '3132333435363738',
  fileKey: '00112233445566778899aabbccddeeff0f1e2d3c4b5a69788796a5b4c3d2e1f0',
  permsRandom: 'deadbeef',
  P: -3904,
  encryptMetadata: true,
  // Expected outputs:
  U: '17424b40ead366f7ddef0ff073608aa68ba701714b5cef3409b94c4ffa763726' + '0102030405060708' + '1112131415161718',
  O: '7e1314d50a58a555c4f7b9cf875a1981c87fca8fcde1587f76a28fcfdf5e00d3' + '2122232425262728' + '3132333435363738',
  UE: 'c6018513b7fbc2ffbff3dcf0bd1fcb31123e82bbe8ac2fcf6d25de529e92eaa8',
  OE: 'e48ad0aba1585ad5055ab3ff2fd6a039f16267e3865f1bb4dc4bf6bdad017507',
  Perms: '82346aa3388f7fdff4ba8c9cbf99c744',
};

const inputFromVector = () => ({
  userPw: preparePassword(VECTOR.userPw),
  ownerPw: preparePassword(VECTOR.ownerPw),
  fileKey: unhex(VECTOR.fileKey),
  salts: { uvs: unhex(VECTOR.uvs), uks: unhex(VECTOR.uks), ovs: unhex(VECTOR.ovs), oks: unhex(VECTOR.oks) },
  permsRandom: unhex(VECTOR.permsRandom),
  P: VECTOR.P,
  encryptMetadata: VECTOR.encryptMetadata,
});

test('buildEncryptDictValues reproduces the fixed R6 vector byte-for-byte', async () => {
  const v = await buildEncryptDictValues(inputFromVector());
  assert.equal(hex(v.U), VECTOR.U, '/U');
  assert.equal(hex(v.O), VECTOR.O, '/O');
  assert.equal(hex(v.UE), VECTOR.UE, '/UE');
  assert.equal(hex(v.OE), VECTOR.OE, '/OE');
  assert.equal(hex(v.Perms), VECTOR.Perms, '/Perms');
});

test('both user and owner passwords recover the exact file key', async () => {
  const v = await buildEncryptDictValues(inputFromVector());
  const fileKey = unhex(VECTOR.fileKey);
  const U = v.U, O = v.O;

  // Decrypt path (Algorithm 2.A) implemented here with node:crypto as an
  // independent check — the engine only encrypts.
  const cbcNoPadDecrypt = (key: Uint8Array, data: Uint8Array): Uint8Array => {
    const d = nodeCrypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16));
    d.setAutoPadding(false);
    return new Uint8Array(Buffer.concat([d.update(Buffer.from(data)), d.final()]));
  };

  // User: validation salt = U[32..40], key salt = U[40..48].
  const uh = await hashR6(preparePassword(VECTOR.userPw), U.subarray(32, 40));
  assert.equal(hex(uh), hex(U.subarray(0, 32)), 'user hash validates against /U');
  const ikeU = await hashR6(preparePassword(VECTOR.userPw), U.subarray(40, 48));
  assert.equal(hex(cbcNoPadDecrypt(ikeU, v.UE)), hex(fileKey), 'user pw → file key');

  // Owner: hashes take udata = the full 48-byte /U.
  const oh = await hashR6(preparePassword(VECTOR.ownerPw), O.subarray(32, 40), U);
  assert.equal(hex(oh), hex(O.subarray(0, 32)), 'owner hash validates against /O');
  const ikeO = await hashR6(preparePassword(VECTOR.ownerPw), O.subarray(40, 48), U);
  assert.equal(hex(cbcNoPadDecrypt(ikeO, v.OE)), hex(fileKey), 'owner pw → file key');
});

test('/Perms decrypts to the "adb" tag with the right metadata flag and P', async () => {
  const v = await buildEncryptDictValues(inputFromVector());
  const fileKey = unhex(VECTOR.fileKey);
  const d = nodeCrypto.createDecipheriv('aes-256-ecb', Buffer.from(fileKey), null);
  d.setAutoPadding(false);
  const perms = Buffer.concat([d.update(Buffer.from(v.Perms)), d.final()]);
  assert.equal(perms.subarray(9, 12).toString('latin1'), 'adb', 'integrity tag');
  assert.equal(String.fromCharCode(perms[8]!), 'T', 'EncryptMetadata flag');
  assert.equal(perms.readInt32LE(0), VECTOR.P, 'P (little-endian)');
});

test('encryptObjectBytes round-trips (IV prepended, AES-256-CBC/PKCS#7)', async () => {
  const fileKey = unhex(VECTOR.fileKey);
  const iv = unhex('abababababababababababababababab');
  const plaintext = new TextEncoder().encode('BT /F1 12 Tf (Confidential) Tj ET'); // a content-stream-ish string
  const blob = await encryptObjectBytes(fileKey, iv, plaintext);

  assert.equal(hex(blob.subarray(0, 16)), hex(iv), 'IV is prepended');
  assert.equal((blob.length - 16) % 16, 0, 'ciphertext is block-aligned');

  const d = nodeCrypto.createDecipheriv('aes-256-cbc', Buffer.from(fileKey), Buffer.from(blob.subarray(0, 16)));
  d.setAutoPadding(true);
  const out = Buffer.concat([d.update(Buffer.from(blob.subarray(16))), d.final()]);
  assert.equal(hex(new Uint8Array(out)), hex(plaintext), 'decrypts to original');
});

test('preparePassword UTF-8 encodes and caps at 127 bytes', () => {
  assert.equal(hex(preparePassword('user')), '75736572');
  const long = 'x'.repeat(200);
  assert.equal(preparePassword(long).length, 127);
  // A multibyte password is encoded as UTF-8 bytes, not code units.
  assert.equal(hex(preparePassword('é')), 'c3a9');
});
