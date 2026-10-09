// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { REQUIRED_WEBGPU_TARGETS } from '../scripts/webgpu-release-gate.ts';
import { githubCandidateApi, prepareMainWebCandidate, publicCandidatePin, type CandidateApi, type CandidateRequest } from '../scripts/main-web-preparation.ts';

const repository = 'lolly-tools/lolly', source = 'a'.repeat(40), id = 37874608667;
const publicKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' });
const keyText = JSON.stringify(publicKey);
const run = { id, run_attempt: 1, path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: source,
  status: 'completed', conclusion: 'success', repository: { full_name: repository }, head_repository: { full_name: repository } };
const event = { action: 'completed', repository: { full_name: repository }, workflow_run: run };
const gateSource = "import { startWebGpuCheck } from './lib/webgpu/device.ts'; void startWebGpuCheck();\n";
function gateRoot(table: 'complete' | 'incomplete' | 'missing' = 'complete'): string {
  const root = mkdtempSync(join(tmpdir(), 'lolly-main-web-preparation-'));
  mkdirSync(join(root, 'shells/web/src'), { recursive: true });
  writeFileSync(join(root, 'shells/web/src/main.ts'), gateSource);
  if (table !== 'missing') {
    mkdirSync(join(root, 'docs'));
    const targets = table === 'complete' ? REQUIRED_WEBGPU_TARGETS : REQUIRED_WEBGPU_TARGETS.filter(target => target.name !== 'Safari (WebKit)');
    writeFileSync(join(root, 'docs/supported-environments.md'), ['| Environment | WebGPU result |', '|---|---|',
      ...targets.map(target => `| ${target.name} | Supported |`)].join('\n'));
  }
  return root;
}
function syntheticApi(verified: unknown = run, head = source) {
  const calls: CandidateRequest[] = [];
  const api: CandidateApi = async request => {
    calls.push(structuredClone(request));
    if (request.method === 'GET' && request.path.endsWith(`/actions/runs/${id}`)) return verified;
    if (request.method === 'GET' && request.path.endsWith('/git/ref/heads/main')) return { ref: 'refs/heads/main', object: { type: 'commit', sha: head } };
    if (request.method === 'POST') return null;
    throw new Error('Unexpected synthetic operation');
  };
  return { api, calls };
}
const posts = (calls: CandidateRequest[]) => calls.filter(call => call.method === 'POST');

test('the existing release gate holds preparation before event, key, credentials or API use', async () => {
  for (const table of ['incomplete', 'missing'] as const) {
    const root = gateRoot(table), mock = syntheticApi();
    try {
      const result = await prepareMainWebCandidate({ root, repository: '../invalid', event: () => { throw new Error('Event must remain unread'); }, api: mock.api });
      assert.equal(result.result, 'HELD');
      assert.equal(result.reason, 'release-gate');
      assert.deepEqual(mock.calls, []);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('approved current main dispatches only the exact web candidate request', async () => {
  const root = gateRoot(), mock = syntheticApi();
  try {
    assert.deepEqual(await prepareMainWebCandidate({ root, repository, event, publicKey: keyText, api: mock.api }), { result: 'REQUESTED', source, ciRun: String(id) });
    assert.deepEqual(mock.calls, [
      { method: 'GET', path: `/repos/${repository}/actions/runs/${id}` },
      { method: 'GET', path: `/repos/${repository}/git/ref/heads/main` },
      { method: 'POST', path: `/repos/${repository}/actions/workflows/deployment-suse.yml/dispatches`, body: {
        ref: 'main', inputs: { build_images: 'true', release_scope: 'web', expected_source: source, ci_run: String(id),
          public_key_jwk: JSON.stringify({ kty: 'EC', crv: 'P-256', x: publicKey.x, y: publicKey.y }) },
      } },
    ]);
    assert.equal(JSON.stringify(posts(mock.calls)).includes('archive_run'), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('pending native rows do not withhold a qualified web-only candidate', async () => {
  const root = gateRoot(), mock = syntheticApi();
  try {
    const table = join(root, 'docs/supported-environments.md');
    writeFileSync(table, readFileSync(table, 'utf8').split('\n').map(row => /app \(/.test(row) ? row.replace('Supported', 'Pending: runtime not qualified') : row).join('\n'));
    assert.equal((await prepareMainWebCandidate({ root, repository, event, publicKey: keyText, api: mock.api })).result, 'REQUESTED');
    assert.equal(posts(mock.calls).length, 1);
    assert.equal((posts(mock.calls)[0]!.body!.inputs as Record<string, unknown>).release_scope, 'web');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('PR, fork, failed, incomplete, wrong-workflow and wrong-branch triggers make no API calls', async () => {
  const root = gateRoot();
  const mutations = [
    { event: 'pull_request' }, { event: 'workflow_dispatch' }, { head_repository: { full_name: 'fork/lolly' } },
    { repository: { full_name: 'fork/lolly' } }, { conclusion: 'failure' }, { status: 'in_progress' },
    { path: '.github/workflows/deployment-suse.yml' }, { path: '.github/workflows/ci.yml@other' },
    { head_branch: 'feature' }, { head_sha: 'bad' }, { id: 0 }, { run_attempt: 0 },
  ];
  try {
    for (const change of mutations) {
      const mock = syntheticApi();
      const result = await prepareMainWebCandidate({ root, repository, event: { ...event, workflow_run: { ...run, ...change } }, publicKey: keyText, api: mock.api });
      assert.deepEqual(result, { result: 'SKIPPED', reason: 'untrusted-trigger' }); assert.deepEqual(mock.calls, []);
    }
    for (const change of [{ action: 'requested' }, { repository: { full_name: 'other/repo' } }]) {
      const mock = syntheticApi();
      assert.equal((await prepareMainWebCandidate({ root, repository, event: { ...event, ...change }, publicKey: keyText, api: mock.api })).result, 'SKIPPED');
      assert.deepEqual(mock.calls, []);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('API verification refuses forged trigger claims and a different run attempt without dispatch', async () => {
  const root = gateRoot();
  try {
    for (const change of [{ id: id + 1 }, { run_attempt: 2 }, { head_sha: 'b'.repeat(40) }, { path: 'other.yml' },
      { event: 'pull_request' }, { conclusion: 'cancelled' }, { status: 'queued' }, { head_branch: 'other' },
      { repository: { full_name: 'other/repo' } }, { head_repository: { full_name: 'other/repo' } }]) {
      const mock = syntheticApi({ ...run, ...change });
      assert.deepEqual(await prepareMainWebCandidate({ root, repository, event, publicKey: keyText, api: mock.api }), { result: 'SKIPPED', reason: 'unqualified-run' });
      assert.equal(mock.calls.length, 1); assert.deepEqual(posts(mock.calls), []);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a CI result that is no longer the current main head is skipped', async () => {
  const root = gateRoot(), mock = syntheticApi(run, 'b'.repeat(40));
  try {
    assert.deepEqual(await prepareMainWebCandidate({ root, repository, event, publicKey: keyText, api: mock.api }), { result: 'SKIPPED', reason: 'stale-main' });
    assert.equal(mock.calls.length, 2); assert.deepEqual(posts(mock.calls), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('missing, private, malformed, noncanonical, off-curve and oversized pins cannot request a candidate', async () => {
  const root = gateRoot();
  const bad = [undefined, '', '{}', 'not-json', JSON.stringify({ ...publicKey, d: 'private' }),
    JSON.stringify({ ...publicKey, kty: 'RSA' }), JSON.stringify({ ...publicKey, crv: 'P-384' }),
    JSON.stringify({ ...publicKey, x: 'A'.repeat(43), y: 'A'.repeat(43) }),
    JSON.stringify({ ...publicKey, x: `${publicKey.x}=` }), JSON.stringify({ ...publicKey, unexpected: true }), ' '.repeat(1025)];
  try {
    for (const text of bad) {
      const mock = syntheticApi();
      await assert.rejects(prepareMainWebCandidate({ root, repository, event, publicKey: text, api: mock.api }));
      assert.deepEqual(mock.calls, []);
    }
    assert.equal(await publicCandidatePin(JSON.stringify({ ...publicKey, key_ops: ['verify'], ext: true })), await publicCandidatePin(keyText));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('invalid repository paths and absent source cannot bypass preparation guards', async () => {
  const root = gateRoot(), absent = mkdtempSync(join(tmpdir(), 'lolly-main-web-absent-'));
  try {
    for (const name of ['../lolly', 'owner/repo/extra', 'https://host/repo', 'owner/repo?token', '/repo', 'owner/%2frepo']) {
      const mock = syntheticApi();
      await assert.rejects(prepareMainWebCandidate({ root, repository: name, event, publicKey: keyText, api: mock.api }), /repository identity/);
      assert.deepEqual(mock.calls, []);
    }
    const mock = syntheticApi();
    await assert.rejects(prepareMainWebCandidate({ root: absent, repository, event, publicKey: keyText, api: mock.api }));
    assert.deepEqual(mock.calls, []);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(absent, { recursive: true, force: true }); }
});

test('HTTP transport uses the fixed API and refuses redirects, other operations and oversized responses', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const requestFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(url), init: init! });
    return new Response(JSON.stringify(run), { status: 200 });
  };
  const api = githubCandidateApi(repository, 'synthetic-token', requestFetch);
  await api({ method: 'GET', path: `/repos/${repository}/actions/runs/${id}` });
  assert.equal(calls[0]!.url, `https://api.github.com/repos/${repository}/actions/runs/${id}`);
  assert.equal(calls[0]!.init.redirect, 'error'); assert.ok(calls[0]!.init.signal);
  assert.equal((calls[0]!.init.headers as Record<string, string>).Authorization, 'Bearer synthetic-token');
  for (const request of [
    { method: 'POST', path: `/repos/${repository}/deployments`, body: {} },
    { method: 'GET', path: 'https://other.example/secret' },
    { method: 'GET', path: '/repos/other/repo/actions/runs/1' },
    { method: 'GET', path: `/repos/${repository}/git/ref/heads/main`, body: {} },
  ] as CandidateRequest[]) await assert.rejects(api(request), /Unowned/);
  assert.equal(calls.length, 1);
  const oversized = githubCandidateApi(repository, 'synthetic-token', async () => new Response('x'.repeat(65537), { status: 200 }));
  await assert.rejects(oversized({ method: 'GET', path: `/repos/${repository}/actions/runs/${id}` }), /oversized/);
  const redirects = githubCandidateApi(repository, 'synthetic-token', async () => new Response('', { status: 302 }));
  await assert.rejects(redirects({ method: 'GET', path: `/repos/${repository}/actions/runs/${id}` }), /HTTP 302/);
});

test('an API error never dispatches and cannot expose its raw credential-bearing error', async () => {
  const api = githubCandidateApi(repository, 'synthetic-token', async () => { throw new Error('synthetic-token raw private response'); });
  await assert.rejects(api({ method: 'GET', path: `/repos/${repository}/actions/runs/${id}` }), error => {
    assert.equal((error as Error).message, 'GitHub API request failed or timed out'); return true;
  });
});

test('the HTTP adapter posts only the approved bounded dispatch and accepts documented dispatch responses', async () => {
  const body = { ref: 'main', inputs: { build_images: 'true', release_scope: 'web', expected_source: source, ci_run: String(id), public_key_jwk: await publicCandidatePin(keyText) } };
  for (const status of [200, 204]) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const api = githubCandidateApi(repository, 'synthetic-token', async (url, init) => {
      calls.push({ url: String(url), init: init! }); return new Response(null, { status });
    });
    assert.equal(await api({ method: 'POST', path: `/repos/${repository}/actions/workflows/deployment-suse.yml/dispatches`, body }), null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, `https://api.github.com/repos/${repository}/actions/workflows/deployment-suse.yml/dispatches`);
    assert.deepEqual(JSON.parse(calls[0]!.init.body as string), body);
    assert.equal(calls[0]!.init.redirect, 'error');
  }
  let calls = 0;
  const noFetch: typeof fetch = async () => { calls++; throw new Error('must not reach network'); };
  for (const token of [undefined, '', 'invalid\nheader']) {
    await assert.rejects(githubCandidateApi(repository, token, noFetch)({ method: 'GET', path: `/repos/${repository}/actions/runs/${id}` }), /token/);
  }
  await assert.rejects(githubCandidateApi(repository, 'synthetic-token', noFetch)({ method: 'POST', path: `/repos/${repository}/actions/workflows/deployment-suse.yml/dispatches`, body: { input: 'x'.repeat(2049) } }), /bound/);
  assert.equal(calls, 0);
});

test('workflow uses only successful main CI, immutable checkout and the minimal dispatch permissions', () => {
  const workflow = parseYaml(readFileSync(new URL('../.github/workflows/main-web-preparation.yml', import.meta.url), 'utf8'));
  assert.deepEqual(workflow.on, { workflow_run: { workflows: ['CI'], types: ['completed'], branches: ['main'] } });
  assert.deepEqual(workflow.permissions, {});
  const job = workflow.jobs.prepare;
  assert.deepEqual(job.permissions, { contents: 'read', actions: 'write' });
  for (const condition of ["github.event.workflow_run.conclusion == 'success'", "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_branch == 'main'", 'github.event.workflow_run.head_repository.full_name == github.repository']) assert.ok(job.if.includes(condition));
  assert.deepEqual(job.steps[0].with, { ref: `\${{ github.event.workflow_run.head_sha }}`, 'persist-credentials': false, submodules: false });
  assert.match(job.steps[0].uses, /^actions\/checkout@[0-9a-f]{40}$/);
  assert.match(job.steps[1].uses, /^actions\/setup-node@[0-9a-f]{40}$/);
  assert.deepEqual(job.steps[1].with, { 'node-version': '24', 'package-manager-cache': false });
  assert.deepEqual(job.steps[2].env, { GH_TOKEN: `\${{ github.token }}`, LOLLY_RELEASE_PUBLIC_KEY_JWK: `\${{ vars.LOLLY_RELEASE_PUBLIC_KEY_JWK }}` });
  assert.equal(job.steps[2].run, 'node scripts/main-web-preparation.ts');
  assert.equal(job.steps.length, 3);
});
