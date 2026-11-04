// SPDX-License-Identifier: MPL-2.0
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

export function signedFixture(version = '1.1.4') {
  const pair = generateKeyPairSync('ed25519');
  const keyId = Buffer.alloc(8, 7);
  const pub = pair.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const pin = Buffer.concat([Buffer.from('Ed'), keyId, pub]);
  const publicKey = Buffer.from(`untrusted comment: test\n${pin.toString('base64')}\n`).toString('base64');
  const bytes = Buffer.from('a packaged application');
  const sig = sign(null, createHash('blake2b512').update(bytes).digest(), pair.privateKey);
  const packet = Buffer.concat([Buffer.from('ED'), keyId, sig]);
  const comment = `timestamp:1\tfile:app\tversion:${version}`;
  const global = sign(null, Buffer.concat([sig, Buffer.from(comment)]), pair.privateKey);
  const signature = Buffer.from(`untrusted comment: test\n${packet.toString('base64')}\ntrusted comment: ${comment}\n${global.toString('base64')}\n`).toString('base64');
  return { bytes, publicKey, signature, version };
}

