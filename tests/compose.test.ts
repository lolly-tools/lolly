/**
 * Contract tests for tool composition / "nested exports" — the engine side.
 *
 * Exercises resolveNestedRenders + its runtime wiring against a FAKE
 * host.compose (the real web/CLI bridges render a child tool to bytes; that's a
 * shell concern verified in the browser). Asserts the manifest `composes` →
 * `{{asset <id>}}` extras pipeline, graceful failure, memoisation, the threaded
 * recursion stack, and that the schema accepts the new manifest shape.
 *
 * Run with: node --test tests/compose.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime } from '../engine/src/runtime.ts';
import { resolveNestedRenders, composeKey } from '../engine/src/compose.ts';
import { validateManifest } from '../engine/src/validate.ts';

// A host tool that composes `qr-code`, binding the child's `url` to its own `url`.
const composeManifest = (over: Record<string, any> = {}): any => ({
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

const composeTool = (over?: Record<string, any>): any => ({
  manifest: composeManifest(over),
  template: '{{#if badgeQr}}<img src="{{asset badgeQr}}">{{else}}<span>no-qr</span>{{/if}}',
});

const stubRef = (url = 'blob:STUB'): any => ({ source: 'remote', id: 'x', type: 'vector', format: 'svg', url });

// Host double whose compose.render is fully controllable + records calls.
function composeHost(render: (spec: any) => any) {
  const calls: any[] = [];
  const warns: string[] = [];
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    log: (level: string, msg: string) => warns.push(`${level}:${msg}`),
    compose: { render: async (spec: any) => { calls.push(spec); return render(spec); } },
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
  const { host, calls } = composeHost((spec: any) => stubRef(`blob:${encodeURIComponent(spec.inputs.url)}`));
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
  const host: any = { version: '1', profile: { get: async () => ({}) }, log: () => {} };
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
  const model: any = [{ id: 'url', type: 'text', value: 'https://x' }];
  const tool = composeTool({ composes: [
    { id: 'ok', tool: 'qr-code', inputs: { url: '{{url}}' } },
    { id: 'bad' /* no tool */ },
  ] });
  const out: any = await resolveNestedRenders(tool, model, {}, host, [], new Map());
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

// ─── recursion depth / stack threading (M1) ─────────────────────────────────────

// A chain tool: renders <img> of its one composed child, or "leaf" if none.
const chainTool = (id: string, child: string | null): any => ({
  manifest: {
    id, name: id, version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
    render: { width: 10, height: 10, formats: ['svg'] }, inputs: [],
    ...(child ? { capabilities: ['compose'], composes: [{ id: 'child', tool: child }] } : {}),
  },
  template: '{{#if child}}<img src="{{asset child}}">{{else}}<span>leaf</span>{{/if}}',
});

// A faithful host.compose mirroring the FIXED bridge: guard on _stack, then render
// the child with the ANCESTOR stack (the engine re-appends the child's own id).
function chainHost(tools: Record<string, any>, MAX = 3) {
  const calls: Array<{ toolId: string; stack: string[] }> = [];
  const rendered: string[] = [];
  const host: any = {
    version: '1', profile: { get: async () => ({}) }, log: () => {},
    compose: {
      async render(spec: any) {
        const { toolId, inputs = {}, _stack = [] } = spec;
        calls.push({ toolId, stack: [..._stack] });
        if (_stack.includes(toolId)) throw new Error(`cycle ${[..._stack, toolId].join(' → ')}`);
        if (_stack.length >= MAX) throw new Error(`max depth ${MAX} (${[..._stack, toolId].join(' → ')})`);
        const t = tools[toolId];
        if (!t) throw new Error(`no tool ${toolId}`);
        await createRuntime(t, host, inputs, { composeStack: _stack }); // ancestor stack (M1)
        rendered.push(toolId);
        return { source: 'remote', id: `compose:${toolId}`, type: 'vector', format: 'svg', url: `blob:${toolId}` };
      },
    },
  };
  return { host, calls, rendered };
}

test('compose: nesting works to MAX depth (A→B→C); the level past it is rejected — no stack double-count', async () => {
  const tools = { A: chainTool('A', 'B'), B: chainTool('B', 'C'), C: chainTool('C', 'D'), D: chainTool('D', null) };
  const { host, calls, rendered } = chainHost(tools, 3);
  const rt = await createRuntime(tools.A, host, {});

  assert.deepEqual(rendered.sort(), ['B', 'C'], 'B and C compose; D is depth-rejected');
  const stackFor = (id: string) => calls.find((c) => c.toolId === id)?.stack;
  // Exact ancestor stacks — a double-count would inflate these and reject C early.
  assert.deepEqual(stackFor('B'), ['A']);
  assert.deepEqual(stackFor('C'), ['A', 'B']);
  assert.deepEqual(stackFor('D'), ['A', 'B', 'C']);
  assert.match(rt.getHydrated(), /<img src="blob:B">/, 'the child render propagates up to A');
});

test('compose: a direct self-embed is caught as a cycle', async () => {
  const tools = { S: chainTool('S', 'S') };
  const { host, rendered } = chainHost(tools, 3);
  const rt = await createRuntime(tools.S, host, {});
  assert.deepEqual(rendered, [], 'self-embed never renders');
  assert.match(rt.getHydrated(), /leaf/, 'parent still renders');
});

// ─── stale-slot clearing (M4) ───────────────────────────────────────────────────

test('compose: a success then a failing re-render CLEARS the slot (no stale embed)', async () => {
  let fail = false;
  const host: any = {
    version: '1', profile: { get: async () => ({}) }, log: () => {},
    compose: { render: async (spec: any) => { if (fail) throw new Error('boom'); return stubRef(`blob:${spec.inputs.url}`); } },
  };
  const rt = await createRuntime(composeTool(), host, {});
  assert.match(rt.getHydrated(), /blob:https:\/\/suse.com/);
  fail = true;
  await rt.setInput('url', 'https://changed.example');
  assert.match(rt.getHydrated(), /no-qr/, 'the previously-shown embed is cleared, not left stale');
});

// ─── out-of-order render race (M5) ──────────────────────────────────────────────

test('compose: an out-of-order render from an older keystroke does not overwrite a newer value', async () => {
  const gates: Record<string, () => void> = {};
  const host: any = {
    version: '1', profile: { get: async () => ({}) }, log: () => {},
    compose: { render: (spec: any) => new Promise((res) => { gates[spec.inputs.url] = () => res(stubRef(`blob:${spec.inputs.url}`)); }) },
  };
  const rtP = createRuntime(composeTool(), host, {});
  await new Promise((r) => setTimeout(r));
  gates['https://suse.com']!(); // let the mount render finish
  const rt = await rtP;

  const a = rt.setInput('url', 'A');
  const b = rt.setInput('url', 'B'); // B is the newer value
  await new Promise((r) => setTimeout(r));
  gates['B']!(); // newer resolves first…
  gates['A']!(); // …older resolves last
  await Promise.all([a, b]);

  assert.match(rt.getHydrated(), /blob:B/, 'newest value wins');
  assert.doesNotMatch(rt.getHydrated(), /blob:A/, 'stale older render dropped');
});
