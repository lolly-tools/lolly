// SPDX-License-Identifier: MPL-2.0
/**
 * sync-remote-conformance (plans/138 Tier D, WP-S6) - the one test suite every
 * device-sync store adapter must pass. Each adapter test file calls
 * `runSyncRemoteConformance` once against its in-memory fake, and once more in
 * live mode against the real service when credentials are in the environment.
 *
 * This is test-support code. It imports node:test and node:assert, so nothing
 * in the app may import it; only `*.test.ts` files do, which keeps it out of the
 * web bundle.
 *
 * LIVE MODE. A kind runs live only when its required variables are all set;
 * otherwise its live suite is skipped and the skip reason names what is missing.
 * Every live case writes under a folder or prefix made for that run and case
 * (`lolly-conformance-<run id>...`), never at the real sync snapshot, and the
 * adapter test file removes what the case wrote afterwards.
 *
 *   S3 and S3-compatible stores (lib/s3-send.ts):
 *     LOLLY_SYNC_LIVE_S3_ENDPOINT        required, e.g. https://s3.eu-central-1.amazonaws.com
 *     LOLLY_SYNC_LIVE_S3_BUCKET          required
 *     LOLLY_SYNC_LIVE_S3_KEY_ID          required, access key id
 *     LOLLY_SYNC_LIVE_S3_SECRET          required, secret access key
 *     LOLLY_SYNC_LIVE_S3_REGION          optional, default us-east-1
 *     LOLLY_SYNC_LIVE_S3_PREFIX          optional key prefix the run folder goes under
 *     LOLLY_SYNC_LIVE_S3_PRECONDITIONS   optional, `store` (default) or `none` for a
 *                                        store that ignores If-Match / If-None-Match
 *
 *   Nextcloud and ownCloud over WebDAV (lib/nextcloud-send.ts):
 *     LOLLY_SYNC_LIVE_WEBDAV_URL           required, the server root; the adapter adds
 *                                          /remote.php/dav/files/<user>/
 *     LOLLY_SYNC_LIVE_WEBDAV_USER          required
 *     LOLLY_SYNC_LIVE_WEBDAV_APP_PASSWORD  required, an app password, not the account one
 *     LOLLY_SYNC_LIVE_WEBDAV_FOLDER        optional folder the run folder goes under
 *     LOLLY_SYNC_LIVE_WEBDAV_PRECONDITIONS optional, `store` (default) or `none`
 *
 *   Google Drive and Dropbox have no live mode: their OAuth access tokens cannot
 *   be minted without a person signing in, so their live suites always skip.
 *
 * A live run uses the real global fetch, so it needs network access to the store
 * and nothing else. Example:
 *
 *   LOLLY_SYNC_LIVE_S3_ENDPOINT=... LOLLY_SYNC_LIVE_S3_BUCKET=... \
 *   LOLLY_SYNC_LIVE_S3_KEY_ID=... LOLLY_SYNC_LIVE_S3_SECRET=... \
 *   node --test shells/web/src/lib/s3-sync.test.ts
 */

import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';

import { SyncConflictError, type SnapshotMeta, type SyncRemote } from './sync-remote.ts';
import type { S3Config } from './s3-send.ts';
import type { WebdavConfig } from './nextcloud-send.ts';

/**
 * How an adapter keeps a conditional write (`PutOpts.ifRev`):
 *   - `store`: the store itself refuses a write whose condition fails, so two
 *     writes naming the same rev can never both succeed.
 *   - `read-compare`: the adapter compares a fresh read before writing (Drive).
 *     A stale rev is refused, but a write from elsewhere in between is not caught.
 *   - `none`: no condition is kept; the precondition cases are skipped.
 */
export type PreconditionMode = 'store' | 'read-compare' | 'none';

/** Builds a remote over the store under test. Every call must reach the SAME
 *  store; `path` picks the object, and undefined means the adapter's default
 *  snapshot. The path is provider-neutral (`lolly-backup/day-1.lolly`); a factory
 *  maps it the way sync-service.ts maps a slot for that provider. */
export type RemoteFactory = (path?: string) => SyncRemote | Promise<SyncRemote>;

export interface ConformanceOpts {
  preconditions: PreconditionMode;
  /** The largest body the suite may send. The large-body case sends 256 KB or
   *  this, whichever is smaller. */
  maxBodyBytes?: number;
  /** Runs before every case: a fresh fake, credentials, a fresh live folder.
   *  Every path must be empty when it returns. */
  setup?: () => Promise<void> | void;
  /** Runs after every case, passed or failed, to remove what a live case wrote.
   *  A failure here is reported as a diagnostic and does not fail the case. */
  teardown?: () => Promise<void> | void;
  /** What `canSyncSilently` must answer when the adapter has it. Default true;
   *  an adapter without the method counts as silent. */
  silent?: boolean;
  /** Skip the whole suite, with this reason (a live suite with no credentials). */
  skip?: string;
}

/** A second slot path, as sync-service.ts names a daily copy. */
export const OTHER_PATH = 'lolly-backup/day-1.lolly';
/** A slot path with a space and a non-ASCII character in it. */
export const UNUSUAL_PATH = 'lolly-backup/Café day 2.lolly';

const DEFAULT_LARGE_BYTES = 256 * 1024;

/** Every byte value once, in order. */
function allByteValues(): Uint8Array {
  return Uint8Array.from({ length: 256 }, (_, i) => i);
}

/** Deterministic bytes that do not repeat in any short cycle (xorshift32), with
 *  `seed` so two bodies of one length still differ. */
export function patternBytes(length: number, seed = 1): Uint8Array {
  const out = new Uint8Array(length);
  let x = (0x9e3779b9 ^ seed) | 0;
  for (let i = 0; i < length; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    out[i] = x & 0xff;
  }
  return out;
}

/** Compare two bodies and name the first differing offset instead of dumping both. */
function assertSameBytes(actual: Uint8Array, expected: Uint8Array, what: string): void {
  assert.equal(actual.length, expected.length, `${what}: length`);
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) assert.fail(`${what}: byte ${i} is ${actual[i]}, expected ${expected[i]}`);
  }
}

function assertMeta(meta: SnapshotMeta | null, size: number, what: string): SnapshotMeta {
  assert.ok(meta, `${what}: meta is present`);
  assert.equal(typeof meta.rev, 'string', `${what}: rev is a string`);
  assert.ok(meta.rev.length > 0, `${what}: rev is not empty`);
  assert.equal(typeof meta.updatedAt, 'string', `${what}: updatedAt is a string`);
  assert.ok(meta.updatedAt.length > 0, `${what}: updatedAt is not empty`);
  assert.equal(meta.size, size, `${what}: size is the stored byte length`);
  return meta;
}

/** Read the stored copy back and check it is exactly `bytes` at `rev`. */
async function assertStored(remote: SyncRemote, bytes: Uint8Array, rev: string, what: string): Promise<void> {
  const head = assertMeta(await remote.head(), bytes.length, `${what}, head`);
  assert.equal(head.rev, rev, `${what}: head names the expected rev`);
  const got = await remote.get();
  assert.ok(got, `${what}: get finds the stored copy`);
  assertSameBytes(got.bytes, bytes, `${what}, get`);
  assert.equal(got.meta.rev, rev, `${what}: get names the expected rev`);
}

async function assertEmpty(remote: SyncRemote, what: string): Promise<void> {
  assert.equal(await remote.head(), null, `${what}: head is null`);
  assert.equal(await remote.get(), null, `${what}: get is null`);
}

async function assertConflict(write: Promise<unknown>, what: string): Promise<void> {
  await assert.rejects(write, (err: unknown) => {
    assert.ok(err instanceof SyncConflictError, `${what}: expected SyncConflictError, got ${String(err)}`);
    return true;
  });
}

interface ConformanceCase {
  name: string;
  skip?: string | false;
  run: (t: TestContext) => Promise<void>;
}

/**
 * Register the conformance cases for one adapter as subtests of a single
 * node:test test called `name`. Cases run one after another, each wrapped in
 * `setup` and `teardown`.
 */
export function runSyncRemoteConformance(name: string, factory: RemoteFactory, opts: ConformanceOpts): void {
  const remote = async (path?: string): Promise<SyncRemote> => factory(path);
  const largeBytes = Math.min(DEFAULT_LARGE_BYTES, opts.maxBodyBytes ?? DEFAULT_LARGE_BYTES);
  const silent = opts.silent ?? true;
  const noPreconditions = opts.preconditions === 'none' && 'the store keeps no write precondition';

  const cases: ConformanceCase[] = [
    {
      name: 'head and get return null before the first put',
      run: async () => {
        await assertEmpty(await remote(), 'default path');
      },
    },
    {
      name: 'put returns a rev that head and get repeat, and head is stable',
      run: async () => {
        const r = await remote();
        const bytes = patternBytes(1024, 2);
        const put = assertMeta(await r.put(bytes), bytes.length, 'put');
        await assertStored(r, bytes, put.rev, 'after put');
        const again = await r.head();
        assert.equal(again?.rev, put.rev, 'a second head with no put in between names the same rev');
        const fresh = await remote();
        assert.equal((await fresh.head())?.rev, put.rev, 'a new remote over the same store reads the same rev');
      },
    },
    {
      name: 'the rev changes when different bytes are written',
      run: async () => {
        const r = await remote();
        const first = await r.put(patternBytes(512, 3));
        const secondBytes = patternBytes(512, 4);
        const second = assertMeta(await r.put(secondBytes), secondBytes.length, 'second put');
        assert.notEqual(second.rev, first.rev, 'the second write has a new rev');
        await assertStored(r, secondBytes, second.rev, 'after the second put');
      },
    },
    {
      name: 'get returns every byte value exactly',
      run: async () => {
        const r = await remote();
        const bytes = allByteValues();
        const put = await r.put(bytes);
        await assertStored(r, bytes, put.rev, 'all 256 byte values');
      },
    },
    {
      name: `get returns a ${largeBytes}-byte body exactly`,
      run: async () => {
        const r = await remote();
        const bytes = patternBytes(largeBytes, 5);
        const put = await r.put(bytes);
        await assertStored(r, bytes, put.rev, 'large body');
      },
    },
    {
      name: 'a write naming the current rev succeeds',
      skip: noPreconditions,
      run: async () => {
        const r = await remote();
        const first = await r.put(patternBytes(300, 6));
        const nextBytes = patternBytes(300, 7);
        const next = assertMeta(await r.put(nextBytes, { ifRev: first.rev }), nextBytes.length, 'conditional put');
        assert.notEqual(next.rev, first.rev, 'the conditional write has a new rev');
        await assertStored(r, nextBytes, next.rev, 'after the conditional put');
      },
    },
    {
      name: 'a write naming a stale rev is refused and changes nothing',
      skip: noPreconditions,
      run: async () => {
        const r = await remote();
        const stale = await r.put(patternBytes(300, 8));
        const currentBytes = patternBytes(300, 9);
        const current = await r.put(currentBytes);
        assert.notEqual(current.rev, stale.rev);
        await assertConflict(r.put(patternBytes(300, 10), { ifRev: stale.rev }), 'stale rev');
        await assertStored(r, currentBytes, current.rev, 'after the refused write');
      },
    },
    {
      name: 'ifRev null writes to an empty path and is refused once something is stored',
      skip: noPreconditions,
      run: async () => {
        const r = await remote();
        const firstBytes = patternBytes(300, 11);
        const first = assertMeta(await r.put(firstBytes, { ifRev: null }), firstBytes.length, 'create-only put');
        await assertStored(r, firstBytes, first.rev, 'after the create-only put');
        await assertConflict(r.put(patternBytes(300, 12), { ifRev: null }), 'create-only over a stored copy');
        await assertStored(r, firstBytes, first.rev, 'after the refused create-only put');
      },
    },
    {
      name: 'two writes naming the same rev: exactly one is kept',
      skip: opts.preconditions !== 'store'
        && (noPreconditions || 'the store has no write precondition, so the adapter compares a fresh read and a write in between is not caught'),
      run: async () => {
        const [a, b] = [await remote(), await remote()];
        const base = await a.put(patternBytes(300, 13));
        const bytesA = patternBytes(300, 14);
        const bytesB = patternBytes(300, 15);
        const results = await Promise.allSettled([
          a.put(bytesA, { ifRev: base.rev }),
          b.put(bytesB, { ifRev: base.rev }),
        ]);
        const kept = results.filter((res) => res.status === 'fulfilled');
        const refused = results.filter((res) => res.status === 'rejected');
        assert.equal(kept.length, 1, `exactly one write is kept (${results.map((res) => res.status).join(', ')})`);
        const reason = (refused[0] as PromiseRejectedResult).reason;
        assert.ok(reason instanceof SyncConflictError, `the other is a SyncConflictError, got ${String(reason)}`);
        const winner = results[0]!.status === 'fulfilled' ? bytesA : bytesB;
        await assertStored(a, winner, (kept[0] as PromiseFulfilledResult<SnapshotMeta>).value.rev, 'after the race');
      },
    },
    {
      name: `two paths do not see each other (default and ${OTHER_PATH})`,
      run: async () => {
        const main = await remote();
        const other = await remote(OTHER_PATH);
        const mainBytes = patternBytes(400, 16);
        const mainPut = await main.put(mainBytes);
        await assertEmpty(other, 'other path after a write to the default path');
        const otherBytes = patternBytes(400, 17);
        const otherPut = await other.put(otherBytes);
        await assertStored(main, mainBytes, mainPut.rev, 'default path after a write to the other path');
        await assertStored(other, otherBytes, otherPut.rev, 'other path');
      },
    },
    {
      name: `a path with a space and a non-ASCII character works (${UNUSUAL_PATH})`,
      run: async () => {
        const unusual = await remote(UNUSUAL_PATH);
        await assertEmpty(unusual, 'unusual path before any write');
        const bytes = patternBytes(400, 18);
        const put = assertMeta(await unusual.put(bytes), bytes.length, 'unusual path put');
        await assertStored(unusual, bytes, put.rev, 'unusual path');
        await assertStored(await remote(UNUSUAL_PATH), bytes, put.rev, 'unusual path from a new remote');
        await assertEmpty(await remote(), 'default path after a write to the unusual path');
        await assertEmpty(await remote(OTHER_PATH), 'other path after a write to the unusual path');
      },
    },
    {
      name: 'remove clears only that path, and removing again or an empty path is fine',
      run: async (t) => {
        const r = await remote();
        const other = await remote(OTHER_PATH);
        if (!r.remove || !other.remove) { t.skip('the adapter cannot remove objects (optional; per-record sync then keeps them)'); return; }
        await other.remove();
        const keepBytes = patternBytes(200, 19);
        const keep = await other.put(keepBytes);
        await r.put(patternBytes(200, 20));
        await r.remove();
        await assertEmpty(r, 'default path after remove');
        await r.remove();
        await assertStored(other, keepBytes, keep.rev, 'other path after a remove of the default path');
      },
    },
    {
      name: `canSyncSilently answers ${silent}`,
      run: async () => {
        const r = await remote();
        if (!r.canSyncSilently) {
          assert.equal(silent, true, 'an adapter without canSyncSilently counts as silent, so it must be declared silent');
          return;
        }
        assert.equal(await r.canSyncSilently(), silent);
      },
    },
  ];

  test(name, opts.skip ? { skip: opts.skip } : {}, async (ctx) => {
    for (const c of cases) {
      await ctx.test(c.name, c.skip ? { skip: c.skip } : {}, async (sub) => {
        await opts.setup?.();
        try {
          await c.run(sub);
        } finally {
          try {
            await opts.teardown?.();
          } catch (err) {
            sub.diagnostic(`teardown failed: ${String(err)}`);
          }
        }
      });
    }
  });
}

// Live-mode configuration. The readers only look at the environment they are
// given; the adapter test files connect, pick the run folder and clean up.

/** A live suite's settings: either a config to run with or the reason it skips. */
export type LiveSettings<C> =
  | { config: C; preconditions: PreconditionMode; skip?: undefined }
  | { config?: undefined; preconditions: PreconditionMode; skip: string };

type Env = Record<string, string | undefined>;

function liveSettings<C>(label: string, env: Env, required: string[], make: () => C, preconditionsVar: string): LiveSettings<C> {
  const raw = (env[preconditionsVar] ?? '').trim();
  const preconditions: PreconditionMode = raw === 'none' ? 'none' : 'store';
  const missing = required.filter((v) => !env[v]?.trim());
  if (missing.length) {
    return { preconditions, skip: `live ${label} run is off: set ${missing.join(', ')} to run it` };
  }
  if (raw && raw !== 'store' && raw !== 'none') {
    return { preconditions, skip: `live ${label} run is off: ${preconditionsVar} must be "store" or "none", not "${raw}"` };
  }
  return { config: make(), preconditions };
}

/** The live S3 settings from `env`. `prefix` is the base the run folder goes under,
 *  normalised to end with a slash when set. */
export function liveS3Settings(env: Env): LiveSettings<S3Config> {
  const v = (k: string): string => (env[`LOLLY_SYNC_LIVE_S3_${k}`] ?? '').trim();
  return liveSettings('S3', env,
    ['LOLLY_SYNC_LIVE_S3_ENDPOINT', 'LOLLY_SYNC_LIVE_S3_BUCKET', 'LOLLY_SYNC_LIVE_S3_KEY_ID', 'LOLLY_SYNC_LIVE_S3_SECRET'],
    () => ({
      endpoint: v('ENDPOINT'),
      region: v('REGION') || 'us-east-1',
      bucket: v('BUCKET'),
      accessKeyId: v('KEY_ID'),
      secretAccessKey: v('SECRET'),
      prefix: v('PREFIX') ? `${v('PREFIX').replace(/\/+$/, '')}/` : '',
    }),
    'LOLLY_SYNC_LIVE_S3_PRECONDITIONS');
}

/** The live WebDAV settings from `env`. `folder` is the base the run folder goes under. */
export function liveWebdavSettings(env: Env): LiveSettings<WebdavConfig> {
  const v = (k: string): string => (env[`LOLLY_SYNC_LIVE_WEBDAV_${k}`] ?? '').trim();
  return liveSettings('WebDAV', env,
    ['LOLLY_SYNC_LIVE_WEBDAV_URL', 'LOLLY_SYNC_LIVE_WEBDAV_USER', 'LOLLY_SYNC_LIVE_WEBDAV_APP_PASSWORD'],
    () => ({
      baseUrl: v('URL'),
      username: v('USER'),
      appPassword: v('APP_PASSWORD'),
      folder: v('FOLDER').replace(/^\/+|\/+$/g, ''),
    }),
    'LOLLY_SYNC_LIVE_WEBDAV_PRECONDITIONS');
}

/** Why the OAuth providers never run live. */
export const OAUTH_LIVE_SKIP = 'no live mode: OAuth access tokens cannot be minted without a person signing in';

/** A name for one live run, unique enough that two runs never share a folder. */
export function liveRunId(): string {
  const random = crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36);
  return `lolly-conformance-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15)}-${random}`;
}
