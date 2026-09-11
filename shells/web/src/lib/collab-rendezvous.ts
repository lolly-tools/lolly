// SPDX-License-Identifier: MPL-2.0
/**
 * collab-rendezvous (plans/138 Tier C) - a signalling rendezvous over a shared
 * cloud store, so two people who both reach the same S3 / WebDAV / Drive / Dropbox
 * can establish a collab session WITHOUT the QR/blob dance. The shared store
 * replaces ONLY the human signalling leg: the WebRTC offer/answer tokens are
 * exchanged through it, then the real session runs over the existing plans/100 ops
 * channel with all its conflict handling. Collab data NEVER touches the store, and
 * NEVER the LWW device-sync snapshot (that would clobber both people's state).
 *
 * SECURITY (the shared bucket is readable by everyone who can reach it):
 *   - The session code is the shared secret. The rendezvous PATH is a hash of the
 *     code (so the path never leaks the code), and the PAYLOAD is encrypted to the
 *     code (snapshot-crypto). A bucket reader without the code sees an opaque blob
 *     at an opaque path and learns nothing - not the SDP, not the code.
 *   - A bucket WRITER could tamper/delete (a DoS on the handshake), but cannot forge
 *     a session: plans/100's op-guard + the ceremony's identity binding still gate
 *     the live channel. This layer only carries signalling, and only ciphertext.
 *
 * Transport-agnostic by design: it deals in OPAQUE token strings (the caller's
 * transport mints the offer and turns an offer into an answer), so this whole
 * module tests against an in-memory PathStore with no WebRTC and no collab core.
 * Wiring it to the ceremony (feed offer in, apply answer) is the separate WP3.
 */

import { encryptSnapshot, decryptSnapshot } from './snapshot-crypto.ts';
import { s3SyncRemote } from './s3-send.ts';
import { webdavSyncRemote } from './nextcloud-send.ts';
import { driveSyncRemote } from './google-drive.ts';
import { dropboxSyncRemote } from './dropbox-send.ts';
import type { SyncRemote } from './sync-remote.ts';

const BASE = 'lolly-collab';
const DEFAULT_POLL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 120_000;

/** Get/put an opaque blob at an arbitrary logical path, over a provider's creds. */
export interface PathStore {
  readonly kind: string;
  getAt(path: string): Promise<Uint8Array | null>;
  putAt(path: string, bytes: Uint8Array): Promise<void>;
}

// Each provider's parameterized SyncRemote, pointed at a rendezvous path. Drive has
// no folders under drive.file, so a hierarchical path flattens to a file name.
const REMOTE_AT: Record<string, (path: string) => SyncRemote> = {
  s3: (p) => s3SyncRemote(fetch, p),
  webdav: (p) => webdavSyncRemote(fetch, p),
  dropbox: (p) => dropboxSyncRemote(fetch, `/${p}`),
  gdrive: (p) => driveSyncRemote(fetch, `${p.replace(/\//g, '-')}.bin`),
};

/** The sync providers that can also carry a collab rendezvous (all of them). */
export function rendezvousKinds(): string[] {
  return Object.keys(REMOTE_AT);
}

/** A PathStore over one provider, reusing its SyncRemote get/put per path. */
export function pathStoreFor(kind: string): PathStore | null {
  const at = REMOTE_AT[kind];
  if (!at) return null;
  return {
    kind,
    async getAt(path) { return (await at(path).get())?.bytes ?? null; },
    async putAt(path, bytes) { await at(path).put(bytes); },
  };
}

/** A path-safe id derived from the code (hash, so the path never carries the code). */
async function pathId(code: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const slotPath = (pid: string, slot: 'offer' | 'answer'): string => `${BASE}/${pid}/${slot}`;

export interface RendezvousOpts {
  pollMs?: number;
  timeoutMs?: number;
  /** Cancel a pending wait. */
  signal?: AbortSignal;
  /** Injected for tests (avoid real delays); defaults to a real setTimeout sleep. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests; defaults to Date.now. */
  now?: () => number;
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Poll a slot until it holds a payload that decrypts under `code`, or time out. */
async function awaitSlot(store: PathStore, pid: string, slot: 'offer' | 'answer', code: string, opts: RendezvousOpts): Promise<string> {
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? realSleep;
  const deadline = now() + timeoutMs;
  for (;;) {
    if (opts.signal?.aborted) throw new Error('Rendezvous cancelled.');
    const raw = await store.getAt(slotPath(pid, slot)).catch(() => null);
    if (raw) {
      const plain = await decryptSnapshot(raw, code);
      if (plain) return new TextDecoder().decode(plain);
      // Present but undecryptable = a stale/foreign blob; keep waiting, don't trust it.
    }
    if (now() >= deadline) throw new Error(`Timed out waiting for the other device (${slot}).`);
    await sleep(pollMs);
  }
}

async function publish(store: PathStore, pid: string, slot: 'offer' | 'answer', code: string, token: string): Promise<void> {
  const enc = await encryptSnapshot(new TextEncoder().encode(token), code);
  await store.putAt(slotPath(pid, slot), enc);
}

/**
 * INVITER: publish the offer, then wait for the joiner's answer. Returns the answer
 * token to feed back into the transport. Both tokens are encrypted to `code`.
 */
export async function publishOfferAwaitAnswer(
  store: PathStore, code: string, offerToken: string, opts: RendezvousOpts = {},
): Promise<string> {
  const pid = await pathId(code);
  await publish(store, pid, 'offer', code, offerToken);
  return awaitSlot(store, pid, 'answer', code, opts);
}

/**
 * JOINER: wait for the inviter's offer, hand it to `makeAnswer` (the transport
 * mints an answer from it), then publish that answer. Returns both tokens.
 */
export async function awaitOfferPublishAnswer(
  store: PathStore, code: string, makeAnswer: (offerToken: string) => Promise<string>, opts: RendezvousOpts = {},
): Promise<{ offerToken: string; answerToken: string }> {
  const pid = await pathId(code);
  const offerToken = await awaitSlot(store, pid, 'offer', code, opts);
  const answerToken = await makeAnswer(offerToken);
  await publish(store, pid, 'answer', code, answerToken);
  return { offerToken, answerToken };
}

// ── Slot-level helpers (for the dialog binding, which publishes and awaits at
//    different moments than the two combined flows above) ───────────────────────

/** Publish one signalling token to a slot, encrypted to the code. */
export async function rendezvousPublish(store: PathStore, code: string, slot: 'offer' | 'answer', token: string): Promise<void> {
  await publish(store, await pathId(code), slot, code, token);
}

/** Await one signalling token from a slot (polls until it decrypts, or times out). */
export async function rendezvousAwait(store: PathStore, code: string, slot: 'offer' | 'answer', opts: RendezvousOpts = {}): Promise<string> {
  return awaitSlot(store, await pathId(code), slot, code, opts);
}
