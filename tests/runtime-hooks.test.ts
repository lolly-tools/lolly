// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the runtime's per-hook time-boxes (HOOK_BUDGET_MS).
 *
 * An async hook result is RACED against its budget: on overrun the runtime
 * logs the timeout and applies no patch NOW - the hook itself keeps executing
 * (there is no in-realm preemption). Since v1.146 the LATE resolution of an
 * onInit/onInput run still applies when it resolves, iff no newer onInit/onInput
 * run started since; a superseded run stays discarded. A SLOW SYNCHRONOUS hook
 * can't be preempted at all: its overrun is measured and warned, and its patch
 * still applies. onFrame/onLevel are exempt - they're throttled by dropping
 * overlapping frames/samples, never time-boxed.
 *
 * HOOK_BUDGET_MS is exported mutable exactly so these tests can shrink the
 * budgets to ~10–20ms instead of waiting out the real 5s/2s defaults.
 *
 * Run with: node --test tests/runtime-hooks.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime, HOOK_BUDGET_MS } from '../engine/src/runtime.ts';

const DEFAULT_BUDGETS = { ...HOOK_BUDGET_MS };
function setBudgets(over: Partial<typeof HOOK_BUDGET_MS> = {}) {
  Object.assign(HOOK_BUDGET_MS, DEFAULT_BUDGETS, over);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Minimal tool double: one declared input (`msg`) + a template that renders the
// hook-computed extra (`note`), so patch application is observable either way.
// Each tool gets a UNIQUE id - compiled hook factories are memoised by
// id@version (hookFactoryCache), so a shared id would reuse another test's hooks.
let toolSeq = 0;
function toolWith(hooks: Record<string, boolean>, hooksSource: string): any {
  return {
    manifest: {
      id: `hooky-${++toolSeq}`, name: 'Hooky', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'msg', type: 'text', default: 'hi' }],
      hooks,
    },
    template: '<b>{{msg}}</b><i>{{note}}</i>',
    hooksSource,
  };
}

// Host double that records host.log calls as "level:message" strings.
function logHost(extra: Record<string, unknown> = {}) {
  const logs: string[] = [];
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    log: (level: string, msg: string) => logs.push(`${level}:${msg}`),
    ...extra,
  };
  return { host, logs };
}

// ─── async overrun: empty patch, logged error, late resolution discarded ──────

test('time-box: an async onInit past its budget → no patch NOW, logged error, late resolution applies when it arrives', async () => {
  setBudgets({ onInit: 15 });
  // hooks.js source can't close over test locals, so park the resolver where
  // the hook's realm-global scope can reach it (which is exactly the point:
  // hooks run in the realm, not a sandbox).
  let resolveLate!: (v: unknown) => void;
  (globalThis as any).__lollyLateGate = new Promise((r) => { resolveLate = r; });
  try {
    const { host, logs } = logHost();
    const rt = await createRuntime(
      toolWith({ onInit: true }, 'function onInit() { return globalThis.__lollyLateGate; }'),
      host, {},
    );
    assert.ok(
      logs.some((l) => l.startsWith('error:onInit') && l.includes('timed out after 15ms')),
      `timeout logged through the hook-error path, got: ${logs.join(' | ')}`,
    );
    assert.deepEqual(rt.hookErrors.map((e) => e.hook), ['onInit'], 'failure recorded for the shell');
    assert.equal(rt.getHydrated(), '<b>hi</b><i></i>', 'empty patch applied - inputs and extras untouched');

    // The hook finally finishes with a patch - after the race was lost. It is
    // still the NEWEST hook run, so it applies (v1.146) and repaints, instead
    // of leaving the canvas permanently stale.
    resolveLate({ msg: 'LATE', note: 'LATE' });
    await sleep(5);
    assert.equal(rt.getHydrated(), '<b>LATE</b><i>LATE</i>', 'late resolution of the newest run applies');
    assert.ok(
      logs.some((l) => l.startsWith('info:onInit finished') && l.includes('applying late')),
      `recovery logged, got: ${logs.join(' | ')}`,
    );
  } finally {
    setBudgets();
    delete (globalThis as any).__lollyLateGate;
  }
});

test('time-box: a raced-out onInput superseded by a newer run stays discarded', async () => {
  setBudgets({ onInput: 15 });
  // First edit's hook stalls past the budget; second edit's resolves fast.
  // When the stalled one finally resolves it is no longer the newest run - the
  // fast patch must not be clobbered by the stale one.
  let resolveSlow!: (v: unknown) => void;
  (globalThis as any).__lollySlowGate = new Promise((r) => { resolveSlow = r; });
  try {
    const { host } = logHost();
    const rt = await createRuntime(
      toolWith({ onInput: true },
        `function onInput({ value }) {
           if (value === 'slow') return globalThis.__lollySlowGate;
           return { note: 'fast:' + value };
         }`),
      host, {},
    );
    await rt.setInput('msg', 'slow');   // times out at 15ms
    await rt.setInput('msg', 'quick');  // completes normally
    assert.equal(rt.getHydrated(), '<b>quick</b><i>fast:quick</i>');
    resolveSlow({ note: 'STALE' });
    await sleep(5);
    assert.equal(rt.getHydrated(), '<b>quick</b><i>fast:quick</i>', 'superseded late resolution discarded');
  } finally {
    setBudgets();
    delete (globalThis as any).__lollySlowGate;
  }
});

// ─── patch merge: undefined keeps, null clears - BOTH directions are contracts ─

test('patch merge: an undefined extra KEEPS the published value (darkroom videoLook cache); a null extra CLEARS it (design frameGroups)', async () => {
  const { host } = logHost();
  const rt = await createRuntime(
    toolWith({ onInput: true },
      `function onInput(ctx) {
         if (ctx.value === 'framed') return { note: 'FRAMES' };
         if (ctx.value === 'cached') return { note: undefined, msg: undefined };
         return { note: null };
       }`),
    host, {},
  );
  await rt.setInput('msg', 'framed');
  assert.equal(rt.getHydrated(), '<b>framed</b><i>FRAMES</i>', 'the extra is set by the first run');
  // undefined = "no opinion this run": the expensive published extra stands
  // (darkroom re-publishes videoLook only when the colour key moves and leans on
  // exactly this), and an undefined INPUT key stays mentioned-not-set, so the
  // typed value survives too.
  await rt.setInput('msg', 'cached');
  assert.equal(rt.getHydrated(), '<b>cached</b><i>FRAMES</i>', 'undefined kept the extra AND the input');
  // null = "this run computed nothing for this key": the stale value must go.
  // Design's frameGroups does this when a doc leaves frames mode - before the
  // hook said null (1.14.4) it said undefined, and the chooser's Video pick left
  // the old artboard-era frameGroups alive forever: an empty frames-mode canvas
  // that no later edit could heal (nothing drawn ever painted).
  await rt.setInput('msg', 'flat');
  assert.equal(rt.getHydrated(), '<b>flat</b><i></i>', 'null cleared the stale extra');
});

test('time-box: an async onInput past its budget → keystroke kept, patch applies late when it arrives', async () => {
  setBudgets({ onInput: 15 });
  try {
    const { host, logs } = logHost();
    const rt = await createRuntime(
      toolWith({ onInput: true },
        'function onInput() { return new Promise((r) => setTimeout(() => r({ note: "slow" }), 60)); }'),
      host, {},
    );
    await rt.setInput('msg', 'typed');
    assert.ok(
      logs.some((l) => l.startsWith('warn:onInput') && l.includes('timed out after 15ms')),
      `timeout logged, got: ${logs.join(' | ')}`,
    );
    assert.equal(rt.getHydrated(), '<b>typed</b><i></i>', 'input value kept; timed-out patch not applied yet');
    await sleep(80); // the abandoned hook resolves now - still the newest run, so it applies
    assert.equal(rt.getHydrated(), '<b>typed</b><i>slow</i>', 'late resolution of the newest run applies');
  } finally { setBudgets(); }
});

// ─── async within budget: patch applies ───────────────────────────────────────

test('time-box: an async hook within budget applies its patch normally', async () => {
  setBudgets({ onInput: 200 });
  try {
    const { host, logs } = logHost();
    const rt = await createRuntime(
      toolWith({ onInput: true },
        'function onInput({ value }) { return new Promise((r) => setTimeout(() => r({ note: "seen:" + value }), 5)); }'),
      host, {},
    );
    await rt.setInput('msg', 'x');
    assert.equal(rt.getHydrated(), '<b>x</b><i>seen:x</i>');
    assert.deepEqual(logs, [], 'no warnings for a hook inside its budget');
  } finally { setBudgets(); }
});

// ─── sync overrun: cannot be preempted - warn, patch still applies ────────────

test('time-box: a slow SYNCHRONOUS hook cannot be preempted - warning logged, patch still applies', async () => {
  setBudgets({ onInput: 10 });
  try {
    const { host, logs } = logHost();
    const rt = await createRuntime(
      toolWith({ onInput: true },
        `function onInput({ value }) {
           const end = Date.now() + 30; while (Date.now() < end) {} // busy-wait past the budget
           return { note: 'sync:' + value };
         }`),
      host, {},
    );
    await rt.setInput('msg', 'x');
    assert.equal(rt.getHydrated(), '<b>x</b><i>sync:x</i>', 'sync result still counts');
    assert.ok(
      logs.some((l) => l.startsWith('warn:onInput ran') && l.includes("can't be preempted")),
      `sync overrun warned, got: ${logs.join(' | ')}`,
    );
  } finally { setBudgets(); }
});

// ─── onFrame is exempt ─────────────────────────────────────────────────────────

test('time-box: onFrame is NOT time-boxed - a slow frame still applies its patch (drop-overlap only)', async () => {
  // Shrink every budget: if onFrame were raced against any of them this would fail.
  setBudgets({ onInit: 10, onInput: 10, beforeExport: 10, afterExport: 10, exportFile: 10 });
  try {
    const frameCbs: Array<(f: unknown) => void> = [];
    const { host, logs } = logHost({
      media: {
        start: async () => {},
        stop: () => {},
        subscribe: (cb: (f: unknown) => void) => { frameCbs.push(cb); return () => {}; },
      },
    });
    const rt = await createRuntime(
      toolWith({ onFrame: true },
        'function onFrame({ frame }) { return new Promise((r) => setTimeout(() => r({ note: "frame:" + frame.t }), 40)); }'),
      host, {},
    );
    assert.equal(await rt.startLive(), true);

    const frame = (t: number) => ({ width: 1, height: 1, data: new Uint8ClampedArray(4), t });
    frameCbs[0]!(frame(7));
    frameCbs[0]!(frame(8)); // overlaps the pending frame → dropped, not queued
    await sleep(80);
    assert.equal(rt.getHydrated(), '<b>hi</b><i>frame:7</i>', 'slow frame ran to completion, way past every budget');
    assert.deepEqual(logs, [], 'no timeout logged - onFrame is exempt');
    rt.stopLive();
  } finally { setBudgets(); }
});

// ─── live-camera resolution follows render.liveMaxEdgeInput ───────────────────

// A media double that records the maxEdge of each subscribe() and counts teardowns.
function resHost() {
  const edges: Array<number | undefined> = [];
  let subCount = 0, unsubCount = 0;
  const frameCbs: Array<(f: unknown) => void> = [];
  const { host, logs } = logHost({
    media: {
      start: async () => {},
      stop: () => {},
      subscribe: (cb: (f: unknown) => void, opts?: { maxEdge?: number }) => {
        subCount++; edges.push(opts?.maxEdge); frameCbs.push(cb);
        return () => { unsubCount++; };
      },
    },
  });
  return { host, logs, edges, frameCbs, get subCount() { return subCount; }, get unsubCount() { return unsubCount; } };
}

function liveResTool(render: Record<string, unknown>): any {
  return {
    manifest: {
      id: `live-res-${++toolSeq}`, name: 'LiveRes', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'], ...render },
      inputs: [{ id: 'liveRes', type: 'number', default: 960 }, { id: 'msg', type: 'text', default: 'hi' }],
      hooks: { onFrame: true },
    },
    template: '<b>{{msg}}</b>',
    hooksSource: 'function onFrame() { return {}; }',
  };
}

test('live camera: liveMaxEdgeInput overrides the hint at go-live and re-subscribes on change', async () => {
  const h = resHost();
  const rt = await createRuntime(liveResTool({ liveMaxEdge: 480, liveMaxEdgeInput: 'liveRes' }), h.host, {});
  assert.equal(await rt.startLive(), true);
  assert.equal(h.subCount, 1);
  assert.equal(h.edges[0], 960, 'go-live uses the input value (960), overriding the 480 hint');

  await rt.setInput('liveRes', 1600);
  assert.equal(h.unsubCount, 1, 'the old subscription is torn down');
  assert.equal(h.subCount, 2, 're-subscribed at the new resolution');
  assert.equal(h.edges[1], 1600);

  await rt.setInput('msg', 'yo'); // a NON-resolution input must not churn the stream
  assert.equal(h.subCount, 2, 'unrelated input change does not re-subscribe');

  rt.stopLive();
  assert.equal(h.unsubCount, 2, 'stopLive tears the live subscription down');
});

test('live camera: falls back to liveMaxEdge, and a resolution change while not live is a no-op', async () => {
  const h = resHost();
  const rt = await createRuntime(liveResTool({ liveMaxEdge: 720 }), h.host, {}); // no liveMaxEdgeInput

  await rt.setInput('liveRes', 1200); // not live yet → nothing subscribed
  assert.equal(h.subCount, 0, 'no subscription while the camera is off');

  assert.equal(await rt.startLive(), true);
  assert.equal(h.edges[0], 720, 'with no input named, the static liveMaxEdge hint is used');
  rt.stopLive();
});

// ─── the hook set is closed ──────────────────────────────────────────────────

test('every budgeted hook has a real invocation site, and the schema matches', async () => {
  // `beforeRender` was accepted by tool.schema.json, typed in the SDK, plumbed
  // through loadHooks and given a 5000 ms budget - and never called. A tool
  // author could declare it, ship it, and watch it silently do nothing
  // (maintainability-2026-07-29.md item 5). It was removed on 2026-07-30; this
  // pins the three surfaces together so a hook cannot go half-implemented again.
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');

  const schema = JSON.parse(
    readFileSync(join(root, 'schemas/tool.schema.json'), 'utf8'),
  ) as { properties: { hooks: { properties: Record<string, unknown>; additionalProperties: boolean } } };
  const declarable = Object.keys(schema.properties.hooks.properties).sort();

  assert.equal(schema.properties.hooks.additionalProperties, false,
    'the hooks block must stay closed, or an unknown hook name is accepted and silently ignored');

  assert.deepEqual(declarable,
    ['afterExport', 'beforeExport', 'exportFile', 'exportStill', 'onFrame', 'onInit', 'onInput', 'onLevel'],
    'the declarable hook set changed - add the invocation site and a test with it, or drop it');

  // Every budget key must be a declarable hook. (The converse does NOT hold:
  // onFrame/onLevel are deliberately unbudgeted and throttled by drop-overlap.)
  const runtimeSrc = readFileSync(join(root, 'engine/src/runtime.ts'), 'utf8');
  for (const name of Object.keys(DEFAULT_BUDGETS)) {
    assert.ok(declarable.includes(name),
      `HOOK_BUDGET_MS budgets '${name}', which no manifest can declare`);
    // A budget plus a null-coalescing load is not an implementation. Require an
    // actual call - runHook('<name>', …) - which is what beforeRender never had.
    assert.match(runtimeSrc, new RegExp(`runHook\\(\\s*'${name}'`),
      `HOOK_BUDGET_MS budgets '${name}' but runtime.ts never calls runHook('${name}', …) - ` +
      'a budgeted hook with no invocation site is the beforeRender trap');
  }
});
