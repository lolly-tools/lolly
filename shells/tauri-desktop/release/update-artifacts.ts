// SPDX-License-Identifier: MPL-2.0
import { createHash, createPublicKey, verify } from 'node:crypto';
import { spawnSync } from 'node:child_process';

function decode(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value.trim())) throw new Error('Invalid updater base64');
  return Buffer.from(value.trim(), 'base64');
}

/** Parse the Tauri minisign public envelope, rejecting incomplete trust pins. */
export function updaterPublicKey(value: string): Buffer {
  const lines = decode(value).toString('utf8').trim().split(/\r?\n/);
  if (lines.length !== 2 || !lines[0]?.startsWith('untrusted comment: ')) throw new Error('Invalid updater public key');
  const packet = decode(lines[1]!);
  if (packet.length !== 42 || packet.subarray(0, 2).toString() !== 'Ed') throw new Error('Invalid updater public key packet');
  return packet;
}

/** Independently verify the exact artifact bytes and the authenticated release version. */
export function verifyUpdaterArtifact(bytes: Uint8Array, signature: string, publicKey: string, version: string): void {
  const pin = updaterPublicKey(publicKey);
  const lines = decode(signature).toString('utf8').trim().split(/\r?\n/);
  if (lines.length !== 4 || !lines[0]?.startsWith('untrusted comment: ') || !lines[2]?.startsWith('trusted comment: ')) {
    throw new Error('Invalid updater signature envelope');
  }
  const packet = decode(lines[1]!);
  const algorithm = packet.subarray(0, 2).toString();
  if (packet.length !== 74 || !['Ed', 'ED'].includes(algorithm) || !packet.subarray(2, 10).equals(pin.subarray(2, 10))) {
    throw new Error('Updater signature key mismatch');
  }
  const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pin.subarray(10)]), format: 'der', type: 'spki' });
  const signed = algorithm === 'ED' ? createHash('blake2b512').update(bytes).digest() : bytes;
  const comment = lines[2]!.slice('trusted comment: '.length);
  if (!verify(null, signed, key, packet.subarray(10)) ||
      !verify(null, Buffer.concat([packet.subarray(10), Buffer.from(comment)]), key, decode(lines[3]!))) {
    throw new Error('Updater signature verification failed');
  }
  if (comment.split('\t').find(field => field.startsWith('version:')) !== `version:${version}`) {
    throw new Error('Updater signature version mismatch');
  }
}

/** A release receipt must describe the exact, committed checkout being promoted. */
export function assertUpdaterSource(source: string, root: string): void {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  if (head.status !== 0 || status.status !== 0 || head.stdout.trim() !== source || status.stdout.trim()) {
    throw new Error('Updater receipt requires its exact source commit and a clean checkout');
  }
}
