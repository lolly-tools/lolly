// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-files.ts against a stubbed instance: a save carries device uploads in the
 * instance's own parts and another device restores the exact dependency with its
 * meta scrubbed; the instance's limits refuse a file before any byte is sent; a
 * passing part failure is retried; any failure or cancel after the upload began
 * deletes the unfinished file; every refusal gets its own sentence; and a save whose
 * files cannot be shared ends as a file outcome, not as a session status.
 *   node --import ./tests/css-stub.mjs --test shells/web/src/org/team-files.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { decodeAssetVersion, encodeAssetVersion } from '../../../../engine/src/asset-version.ts';
import {
  shareTeamFiles, restoreTeamFiles, downloadTeamFile, deleteTeamFile, uploadTeamFile, listTeamFiles, teamFileMessage,
  TeamFileError, PART_RETRY_DELAYS_MS, type TeamFile,
} from './team-files.ts';
import { createInstanceSessionWriter } from './session-source.ts';
import { setHostRef } from '../lib/host-ref.ts';
import type { BeamAssetRecord } from '../lib/beam-pack.ts';

const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const refuse = (status: number, code: string, extra: Record<string, unknown> = {}): Response => json({ error: { code, message: code, ...extra } }, status);
const id = 'fil_abcdefghijklmnopqrstuv';
const MiB = 1024 * 1024;
const LIMITS = { partBytes: MiB, maxBytes: 25 * MiB, projectBudgetBytes: 128 * MiB, projectUsedBytes: 0, instanceRemainingBytes: 256 * MiB };
PART_RETRY_DELAYS_MS.splice(0, PART_RETRY_DELAYS_MS.length, 0, 0, 0);

type Call = { url: string; method: string };
/** Swap fetch for one test; `route` answers every request. */
async function withFetch(route: (url: string, method: string, init?: RequestInit) => Response | Promise<Response>, run: (calls: Call[]) => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method || 'GET';
    calls.push({ url: String(input), method });
    return route(String(input), method, init);
  }) as typeof fetch;
  try { await run(calls); } finally { globalThis.fetch = original; }
}

/** A minimal instance: one project's files, begun, sent in parts and finalised. */
function instance(limits = LIMITS) {
  const state = { file: null as (TeamFile & { parts: { size: number; checksum: string }[] }) | null, parts: [] as Uint8Array[], begun: null as Record<string, unknown> | null };
  const route = async (url: string, method: string, init?: RequestInit): Promise<Response> => {
    if (url.endsWith('/files') && method === 'GET') return json({ files: state.file?.ready ? [state.file] : [], limits });
    if (url.endsWith('/files') && method === 'POST') {
      state.begun = JSON.parse(String(init?.body));
      state.file = { ...(state.begun as unknown as TeamFile & { parts: [] }), id, projectId: 'p1', ready: false, createdBy: 'usr_me' };
      return json({ file: state.file, partBytes: limits.partBytes }, 201);
    }
    const n = url.match(/\/parts\/(\d+)$/)?.[1];
    if (n && method === 'PUT') {
      const body = init?.body;
      assert.ok(body instanceof Blob, 'a part is sent as a slice of the file');
      state.parts[Number(n)] = new Uint8Array(await body.arrayBuffer());
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/finalize')) { assert.ok(state.file); state.file.ready = true; return json({ file: state.file }); }
    if (url.endsWith(`/${id}`) && method === 'DELETE') { state.file = null; return new Response(null, { status: 204 }); }
    if (url.endsWith(`/${id}`)) return new Response(new Blob(state.parts as BlobPart[]), { headers: { 'content-length': String(state.file?.size ?? 0) } });
    throw new Error(`Unexpected request ${method} ${url}`);
  };
  return { state, route };
}

test('saving carries uploaded bytes in the instance\'s parts and another device restores the exact dependency', async () => {
  const bytes = new Uint8Array(MiB + 13).fill(21);
  const record: BeamAssetRecord = {
    id: 'user/upload/cover', version: 'v3', blob: new Blob([bytes], { type: 'image/png' }), type: 'raster', format: 'png', width: 640, height: 480,
    meta: { name: 'Cover', path: '/Users/me/Desktop/cover.png', tts: { voice: 'x' } },
  };
  const { state, route } = instance();
  await withFetch(route, async () => {
    const host = { assets: { _getUserRecord: async (_id: string, version?: string) => { assert.equal(version, 'v3'); return record; } } } as unknown as HostV1;
    const input = { photo: { id: 'user/upload/cover?treatment=warm', source: 'user', pin: { version: 'v3', format: 'png' }, url: 'blob:sender' } };
    const result = await shareTeamFiles('p1', input, host);
    assert.equal(state.parts.length, 2);
    const declared = state.begun!.parts as { size: number; checksum: string }[];
    for (let n = 0; n < state.parts.length; n++) assert.deepEqual(declared[n], { size: state.parts[n]!.length, checksum: hash(state.parts[n]!) });
    assert.deepEqual(state.begun!.asset, { type: 'raster', format: 'png', width: 640, height: 480, meta: { name: 'Cover' } },
      'only the name, kind and size travel; the device path and other local meta stay behind');
    const ref = result.photo as { id: string; pin: { version: string }; url: string };
    assert.equal(ref.id, `user/team/${id}?treatment=warm`);
    assert.equal(ref.pin.version, hash(bytes));
    assert.equal(ref.url, '');
    assert.equal(input.photo.id, 'user/upload/cover?treatment=warm');
    // The instance's meta is scrubbed on the way in, as a received beam's is.
    state.file!.asset = { ...state.file!.asset, meta: { name: 'Cover', note: 'kept', src: 'https://tracker.example/p.gif', credential: [1] } };
    const received: BeamAssetRecord[] = [];
    const other = { assets: { _getUserRecord: async () => null, _uploadUserAsset: async (r: BeamAssetRecord) => { received.push(r); } } } as unknown as HostV1;
    await restoreTeamFiles(other, { projectId: 'p1', toolId: 'design', inputs: result });
    assert.equal(received[0]?.id, `user/team/${id}`);
    assert.equal(received[0]?.version, hash(bytes));
    assert.deepEqual(received[0]?.meta, { name: 'Cover', note: 'kept' });
    assert.equal(received[0]?.width, 640);
    assert.deepEqual(new Uint8Array(await received[0]!.blob!.arrayBuffer()), bytes);
  });
});

test('missing pinned bytes stop a save, without falling back to the latest version', async () => {
  await withFetch(() => json({ files: [], limits: LIMITS }), async () => {
    const host = { assets: { _getUserRecord: async () => ({ id: 'user/a', version: 'new', blob: new Blob(['new']), format: 'png' }) } } as unknown as HostV1;
    await assert.rejects(shareTeamFiles('p1', { photo: { id: encodeAssetVersion('user/a', { version: 'old' }), source: 'user' } }, host),
      e => e instanceof TeamFileError && e.status === 422 && e.code === 'MISSING');
    assert.equal(decodeAssetVersion(encodeAssetVersion('user/a', { version: 'old' })).pin?.version, 'old');
  });
});

test('the instance\'s limits refuse a file before any byte is sent, and set the part size', async () => {
  const blob = new Blob([new Uint8Array(10).fill(7)]);
  for (const [limits, code] of [
    [{ ...LIMITS, maxBytes: 9 }, 'PROJECT_FILE_TOO_LARGE'],
    [{ ...LIMITS, projectBudgetBytes: 100, projectUsedBytes: 95 }, 'PROJECT_FILE_BUDGET'],
    [{ ...LIMITS, instanceRemainingBytes: 5 }, 'INSTANCE_FILE_BUDGET'],
  ] as const) {
    await withFetch(() => json({ files: [], limits }), async (calls) => {
      await assert.rejects(uploadTeamFile('p1', blob, 'a.bin'), e => e instanceof TeamFileError && e.status === 413 && e.code === code);
      assert.deepEqual(calls.map(c => c.method), ['GET'], `${code}: nothing was begun`);
    });
  }
  const { state, route } = instance({ ...LIMITS, partBytes: 4 });
  await withFetch(route, async () => {
    const progress: number[] = [];
    const file = await uploadTeamFile('p1', blob, 'a\u0007.bin', { onProgress: (sent) => progress.push(sent) });
    assert.equal(file.id, id);
    assert.deepEqual(state.parts.map(p => p.length), [4, 4, 2], 'parts follow the instance\'s size');
    assert.deepEqual(progress, [0, 4, 8, 10]);
    assert.equal(state.begun!.name, 'a.bin', 'control characters never reach the instance');
  });
  await withFetch(() => json({ files: [], limits: { partBytes: 'big' } }), async () => {
    const got = await listTeamFiles('p1');
    assert.equal(got.limits.partBytes, MiB, 'an instance that sends no limits keeps the default part size');
  });
});

test('a passing part failure is retried; a refusal is not, and the unfinished file is deleted', async () => {
  const blob = new Blob([new Uint8Array(6).fill(1)]);
  const first = instance({ ...LIMITS, partBytes: 4 });
  let failures = 2;
  await withFetch((url, method, init) => {
    if (method === 'PUT' && failures > 0) { failures--; return failures === 1 ? new Response(null, { status: 503 }) : Promise.reject(new TypeError('Failed to fetch')); }
    return first.route(url, method, init);
  }, async (calls) => {
    await uploadTeamFile('p1', blob, 'a.bin');
    assert.equal(calls.filter(c => c.method === 'PUT').length, 4, 'two retries, then both parts');
  });
  const second = instance({ ...LIMITS, partBytes: 4 });
  await withFetch((url, method, init) => (method === 'PUT' ? refuse(410, 'UPLOAD_EXPIRED') : second.route(url, method, init)), async (calls) => {
    await assert.rejects(uploadTeamFile('p1', blob, 'a.bin'), e => e instanceof TeamFileError && e.code === 'UPLOAD_EXPIRED');
    assert.equal(calls.filter(c => c.method === 'PUT').length, 1, 'a refusal is final');
    assert.equal(calls.at(-1)?.method, 'DELETE', 'the reservation is given back');
    assert.match(calls.at(-1)!.url, new RegExp(`/files/${id}$`));
  });
});

test('a cancelled upload stops at the next part and deletes its reservation', async () => {
  const { route } = instance({ ...LIMITS, partBytes: 4 });
  const job = new AbortController();
  await withFetch(route, async (calls) => {
    await assert.rejects(
      uploadTeamFile('p1', new Blob([new Uint8Array(12)]), 'a.bin', { signal: job.signal, onProgress: (sent) => { if (sent >= 4) job.abort(); } }),
      e => e instanceof TeamFileError && e.code === 'CANCELLED');
    assert.equal(calls.filter(c => c.method === 'PUT').length, 1);
    assert.equal(calls.some(c => c.url.endsWith('/finalize')), false);
    assert.equal(calls.at(-1)?.method, 'DELETE');
  });
});

test('delete sends force only when asked, and a file in use names its sessions', async () => {
  await withFetch((url) => (url.endsWith('?force=1')
    ? new Response(null, { status: 204 })
    : refuse(409, 'FILE_IN_USE', { sessions: [{ id: 'ses_1', title: 'Spring poster' }, { id: 'ses_2', title: '' }, { title: 'no id' }] })), async (calls) => {
    const error = await deleteTeamFile('p1', id).then(() => null, (e: unknown) => e);
    assert.ok(error instanceof TeamFileError);
    assert.equal(error.code, 'FILE_IN_USE');
    assert.deepEqual(error.sessions, [{ id: 'ses_1', title: 'Spring poster' }, { id: 'ses_2', title: 'ses_2' }]);
    assert.equal(teamFileMessage(error, 'delete'), 'Sessions still use that file: Spring poster, ses_2.');
    await deleteTeamFile('p1', id, { force: true });
    assert.match(calls.at(-1)!.url, /\/files\/fil_abcdefghijklmnopqrstuv\?force=1$/);
  });
});

test('every refusal gets its own sentence', () => {
  const say = (status: number, code?: string, action: Parameters<typeof teamFileMessage>[1] = 'upload'): string =>
    teamFileMessage(new TeamFileError(status, code, { limit: 25 * MiB }), action);
  assert.equal(say(413, 'PROJECT_FILE_TOO_LARGE'), 'A file is too large to share. Each file can be up to 25 MB.');
  assert.match(say(413, 'PROJECT_FILE_BUDGET'), /no room left for files in this project/);
  assert.match(say(413, 'INSTANCE_FILE_BUDGET'), /no room left for files on this instance/);
  assert.match(say(413, 'PROJECT_FILE_PENDING'), /too many unfinished uploads/);
  assert.equal(say(410, 'UPLOAD_EXPIRED'), 'The upload was interrupted. Try again.');
  assert.equal(say(0, 'CANCELLED'), 'Upload cancelled.');
  assert.match(say(403, 'FORBIDDEN', 'delete'), /delete files you uploaded/);
  assert.match(say(403, 'READ_ONLY', 'upload'), /permission to add files/);
  assert.equal(say(404, 'NOT_FOUND', 'read'), 'That file is no longer available.');
  assert.match(say(404, 'NOT_FOUND', 'list'), /could not be reached/);
  assert.match(say(422, 'MISSING'), /missing on this device/);
  assert.match(teamFileMessage(new Error('boom'), 'list'), /could not be reached/);
});

test('downloads reject altered bytes and stop reading beyond the declared file size', async () => {
  const original = globalThis.fetch;
  const file: TeamFile = { id, projectId: 'p1', size: 3, checksum: hash(new Uint8Array([1, 2, 3])), name: 'test', contentType: 'application/octet-stream', ready: true, asset: {} };
  try {
    globalThis.fetch = (async () => new Response(new Uint8Array([1, 2, 4]))) as typeof fetch;
    await assert.rejects(downloadTeamFile('p1', file), TeamFileError);
    let cancelled = false;
    globalThis.fetch = (async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(4)); }, cancel() { cancelled = true; } }))) as typeof fetch;
    await assert.rejects(downloadTeamFile('p1', file), TeamFileError);
    assert.equal(cancelled, true);
  } finally { globalThis.fetch = original; }
});

test('a save whose files cannot be shared ends as a file outcome with its own sentence', async () => {
  const writer = createInstanceSessionWriter(() => ({ sharing: { projectFiles: true } }));
  const doc = { toolId: 'design', inputs: { photo: { id: 'user/upload/cover', source: 'user' } } };
  const record: BeamAssetRecord = { id: 'user/upload/cover', version: 'v1', blob: new Blob([new Uint8Array(8)]), type: 'raster', format: 'png' };
  setHostRef({ assets: { _getUserRecord: async () => record } } as unknown as HostV1);
  await withFetch((_url, method) => (method === 'GET' ? json({ files: [], limits: LIMITS }) : refuse(413, 'PROJECT_FILE_BUDGET')), async (calls) => {
    const got = await writer.createSession('p1', doc);
    assert.equal(got.kind, 'file-error');
    assert.ok(got.kind === 'file-error');
    assert.equal(got.code, 'PROJECT_FILE_BUDGET');
    assert.match(got.message, /no room left for files in this project/, 'not "This document is too large"');
    assert.equal(calls.some(c => c.url.endsWith('/sessions')), false, 'nothing was saved');
  });
  await withFetch((url, method) => {
    if (url.endsWith('/sessions/s1') && method === 'GET') return json({ id: 's1', projectId: 'p1' });
    return method === 'GET' ? json({ files: [], limits: LIMITS }) : refuse(410, 'UPLOAD_EXPIRED');
  }, async () => {
    const got = await writer.updateSession({ id: 's1', inputs: doc.inputs, rev: 3 });
    assert.deepEqual(got, { kind: 'file-error', code: 'UPLOAD_EXPIRED', message: 'The upload was interrupted. Try again.' },
      'a 410 about a file is not "that team session was deleted"');
  });
});

test('a credential never travels as a declaration: an upload sends none, a restore ignores one', async () => {
  // A 50 KB image whose sidecar credential is 150 KB: sent as a number array it once
  // pushed the begin past the instance's body limit and read as "too large".
  const bytes = new Uint8Array(50 * 1024).fill(7);
  const record: BeamAssetRecord = {
    id: 'user/upload/a', version: 'v1', blob: new Blob([bytes], { type: 'image/png' }), type: 'raster', format: 'png',
    credential: new Uint8Array(150 * 1024).fill(3), credentialFormat: 'application/c2pa', meta: { name: 'a.png' },
  };
  const { state, route } = instance();
  await withFetch(route, async () => {
    const host = { assets: { _getUserRecord: async () => record } } as unknown as HostV1;
    const result = await shareTeamFiles('p1', { photo: { id: 'user/upload/a', source: 'user', pin: { version: 'v1' } } }, host);
    assert.equal((result.photo as { id: string }).id, `user/team/${id}`);
    assert.deepEqual(state.begun!.asset, { type: 'raster', format: 'png', meta: { name: 'a.png' } }, 'no credential in the begin');
    // Another member declares a store the bytes do not carry.
    state.file!.asset = { ...state.file!.asset, credential: [9, 9, 9, 9], credentialFormat: 'application/c2pa', aiGenerated: 'trainedAlgorithmicMedia' };
    const received: BeamAssetRecord[] = [];
    const other = { assets: { _getUserRecord: async () => null, _uploadUserAsset: async (r: BeamAssetRecord) => { received.push(r); } } } as unknown as HostV1;
    await restoreTeamFiles(other, { projectId: 'p1', toolId: 'design', inputs: result });
    assert.equal(received.length, 1);
    for (const key of ['credential', 'credentialFormat', 'aiGenerated']) {
      assert.equal(key in received[0]!, false, `${key} is read from the bytes by the asset store, never taken from the instance`);
    }
  });
});

test('a file the project already holds is reused after the per-file limit was lowered', async () => {
  const bytes = new Uint8Array(20).fill(5);
  const held: TeamFile = { id, projectId: 'p1', name: 'big.png', size: 20, checksum: hash(bytes), contentType: 'image/png', ready: true, asset: {} };
  const limits = { ...LIMITS, maxBytes: 10, projectUsedBytes: 20 };
  await withFetch(() => json({ files: [held], limits }), async (calls) => {
    const record: BeamAssetRecord = { id: `user/team/${id}`, version: hash(bytes), blob: new Blob([bytes]), type: 'raster', format: 'png' };
    const host = { assets: { _getUserRecord: async () => record } } as unknown as HostV1;
    const result = await shareTeamFiles('p1', { photo: { id: `user/team/${id}`, source: 'user', pin: { version: hash(bytes) } } }, host);
    assert.equal((result.photo as { id: string }).id, `user/team/${id}`);
    assert.equal((await uploadTeamFile('p1', new Blob([bytes]), 'again.png')).id, id, 'the same bytes from disk resolve to the held file');
    // Other bytes of the same size are still over the limit, and nothing is begun.
    await assert.rejects(uploadTeamFile('p1', new Blob([new Uint8Array(20).fill(6)]), 'other.png'),
      e => e instanceof TeamFileError && e.code === 'PROJECT_FILE_TOO_LARGE' && e.limit === 10);
    assert.deepEqual([...new Set(calls.map(c => c.method))], ['GET']);
  });
});

test('a long name is cut between characters, never through an emoji', async () => {
  const { state, route } = instance();
  await withFetch(route, async () => {
    await uploadTeamFile('p1', new Blob([new Uint8Array(4).fill(1)]), `${'a'.repeat(199)}\u{1F600} holiday.png`);
    assert.equal(state.begun!.name, 'a'.repeat(199), 'half an emoji is dropped, not sent');
    assert.deepEqual((state.begun!.asset as { meta: unknown }).meta, { name: 'a'.repeat(199) });
  });
  const second = instance();
  await withFetch(second.route, async () => {
    await uploadTeamFile('p1', new Blob([new Uint8Array(4).fill(2)]), `${'b'.repeat(198)}\u{1F600}.png`);
    assert.equal(second.state.begun!.name, `${'b'.repeat(198)}\u{1F600}`, 'a whole emoji that fits is kept');
    assert.equal((second.state.begun!.name as string).length, 200);
  });
  const third = instance();
  await withFetch(third.route, async () => {
    await uploadTeamFile('p1', new Blob([new Uint8Array(4).fill(3)]), 'x\ud83d.png');
    assert.equal(third.state.begun!.name, 'x.png', 'an unpaired surrogate never reaches the instance');
  });
});

test('a too-large refusal names the instance\'s own limit', async () => {
  const { route } = instance();
  await withFetch((url, method, init) => (method === 'POST' && url.endsWith('/files')
    ? refuse(413, 'PROJECT_FILE_TOO_LARGE', { maxBytes: 10 * MiB })
    : route(url, method, init)), async () => {
    const error = await uploadTeamFile('p1', new Blob([new Uint8Array(4)]), 'a.bin').then(() => null, (e: unknown) => e);
    assert.ok(error instanceof TeamFileError);
    assert.equal(error.limit, 10 * MiB);
    assert.equal(teamFileMessage(error, 'upload'), 'A file is too large to share. Each file can be up to 10 MB.');
  });
});
