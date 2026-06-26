/**
 * Contract tests for tool composition / "nested exports" — the engine side.
 *
 * Exercises resolveNestedRenders + its runtime wiring against a FAKE
 * host.compose (the real web/CLI bridges render a child tool to bytes; that's a
 * shell concern verified in the browser). Asserts the manifest `composes` →
 * `{{asset <id>}}` extras pipeline, graceful failure, memoisation, the threaded
 * recursion stack, and that the schema accepts the new manifest shape.
 *
 * Run with: node --test tests/compose.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime } from '../engine/src/runtime.js';
import { resolveNestedRenders, composeKey } from '../engine/src/compose.js';
import { validateManifest } from '../engine/src/validate.js';

// A host tool that composes `qr-code`, binding the child's `url` to its own `url`.
const composeManifest = (over = {}) => ({
  id: 'host-tool',
  name: 'Host Tool',
  version: '1.0.0',
  engineVersion: '^1.0.0',
  status: 'official',
  render: { width: 10, height: 10, formats: ['png'] },
  inputs: [{ id: 'url', type: 'text', default: 'https://suse.com' }],
  capabilities: ['compose'],
  composes: [{ id: 'badgeQr', tool: 'qr-code', inputs: { url: '{{url}}' }, format: 'svg' }],
  ...over,
});

const composeTool = (over) => ({
  manifest: composeManifest(over),
  template: '{{#if badgeQr}}<img src="{{asset badgeQr}}">{{else}}<span>no-qr</span>{{/if}}',
});

const stubRef = (url = 'blob:STUB') => ({ source: 'remote', id: 'x', type: 'vector', format: 'svg', url });

// Host double whose compose.render is fully controllable + records calls.
function composeHost(render) {
  const calls = [];
  const warns = [];
  const host = {
    version: '1',
    profile: { get: async () => ({}) },
    log: (level, msg) => warns.push(`${level}:${msg}`),
    compose: { render: async (spec) => { calls.push(spec); return render(spec); } },
  };
  return { host, calls, warns };
}

// ─── happy path ───────────────────────────────────────────────────────────────

test('compose: renders the child, binds {{url}}, threads the stack, exposes {{asset <id>}}', async () => {
  const { host, calls } = composeHost(() => stubRef('blob:QR'));
  const rt = await createRuntime(composeTool(), host, {});

  assert.equal(calls.length, 1, 'child rendered once on mount');
  assert.equal(calls[0].toolId, 'qr-code');
  assert.equal(calls[0].inputs.url, 'https://suse.com', '{{url}} hydrated against parent context');
  assert.equal(calls[0].format, 'svg');
  assert.deepEqual([...calls[0]._stack], ['host-tool'], 'parent id pushed onto the recursion stack');

  assert.match(rt.getHydrated(), /<img src="blob:QR">/, 'AssetRef url reaches the template');
});

test('compose: an input value flows into the child render on change', async () => {
  const { host, calls } = composeHost((spec) => stubRef(`blob:${encodeURIComponent(spec.inputs.url)}`));
  const rt = await createRuntime(composeTool(), host, {});
  await rt.setInput('url', 'https://example.com');
  assert.equal(calls.at(-1).inputs.url, 'https://example.com');
  assert.match(rt.getHydrated(), /blob:https%3A%2F%2Fexample.com/);
});

// ─── graceful failure (covers the bridge's cycle/depth rejections) ─────────────

test('compose: a throwing child (e.g. cycle/depth) is omitted + warned; parent still renders', async () => {
  const { host, warns } = composeHost(() => { throw new Error('cycle host-tool → qr-code → host-tool'); });
  const rt = await createRuntime(composeTool(), host, {});
  assert.ok(warns.some((w) => w.startsWith('warn:') && w.includes('cycle')), 'logged a warning');
  assert.match(rt.getHydrated(), /<span>no-qr<\/span>/, '{{#if}} hides the slot; parent intact');
});

test('compose: no host.compose → composes are a graceful no-op', async () => {
  const host = { version: '1', profile: { get: async () => ({}) }, log: () => {} };
  const rt = await createRuntime(composeTool(), host, {});
  assert.match(rt.getHydrated(), /no-qr/);
});

test('compose: a child returning no url is treated as a miss (slot stays empty)', async () => {
  const { host } = composeHost(() => ({ source: 'remote', id: 'x', type: 'vector', format: 'svg' /* no url */ }));
  const rt = await createRuntime(composeTool(), host, {});
  assert.match(rt.getHydrated(), /no-qr/);
});

// ─── memoisation ───────────────────────────────────────────────────────────────

test('compose: unchanged bound inputs do not re-render the child', async () => {
  let n = 0;
  const { host } = composeHost(() => { n += 1; return stubRef(`blob:${n}`); });
  const rt = await createRuntime(composeTool(), host, {});
  assert.equal(n, 1);
  await rt.setInput('url', 'https://suse.com'); // same as the default → memo hit
  assert.equal(n, 1, 'no re-render when the bound value is unchanged');
  await rt.setInput('url', 'https://changed.example'); // changed → re-render
  assert.equal(n, 2);
});

// ─── direct unit: resolveNestedRenders shape + key stability ───────────────────

test('resolveNestedRenders: returns { id: ref } and skips malformed entries', async () => {
  const { host } = composeHost(() => stubRef('blob:Z'));
  const model = [{ id: 'url', type: 'text', value: 'https://x' }];
  const tool = composeTool({ composes: [
    { id: 'ok', tool: 'qr-code', inputs: { url: '{{url}}' } },
    { id: 'bad' /* no tool */ },
  ] });
  const out = await resolveNestedRenders(tool, model, {}, host, [], new Map());
  assert.deepEqual(Object.keys(out), ['ok']);
  assert.equal(out.ok.url, 'blob:Z');
});

test('composeKey is order-insensitive over input keys', () => {
  assert.equal(
    composeKey('t', { a: 1, b: 2 }, 'svg', 10, 10),
    composeKey('t', { b: 2, a: 1 }, 'svg', 10, 10),
  );
  assert.notEqual(
    composeKey('t', { a: 1 }, 'svg', 10, 10),
    composeKey('t', { a: 2 }, 'svg', 10, 10),
  );
});

// ─── schema ────────────────────────────────────────────────────────────────────

test('validateManifest accepts a manifest with composes + the compose capability', () => {
  const { valid, errors } = validateManifest(composeManifest());
  assert.equal(valid, true, JSON.stringify(errors));
});

test('validateManifest rejects a composes entry missing required fields', () => {
  const { valid } = validateManifest(composeManifest({ composes: [{ id: 'x' }] }));
  assert.equal(valid, false, 'composes[].tool is required');
});
