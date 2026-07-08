/**
 * Contract tests for the runtime's per-hook time-boxes (HOOK_BUDGET_MS).
 *
 * An async hook result is RACED against its budget: on overrun the runtime
 * logs the timeout, applies NO patch, and discards the late resolution — the
 * hook itself keeps executing (there is no in-realm preemption). A SLOW
 * SYNCHRONOUS hook can't be preempted at all: its overrun is measured and
 * warned, and its patch still applies. onFrame/onLevel are exempt — they're
 * throttled by dropping overlapping frames/samples, never time-boxed.
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
// Each tool gets a UNIQUE id — compiled hook factories are memoised by
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

test('time-box: an async onInit past its budget → no patch, logged error, late resolution discarded', async () => {
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
    assert.equal(rt.getHydrated(), '<b>hi</b><i></i>', 'empty patch applied — inputs and extras untouched');

    // The hook finally "finishes" with a patch — after the race was lost. It
    // must be discarded, never resurrected into the model/extras.
    resolveLate({ msg: 'LATE', note: 'LATE' });
    await sleep(5);
    assert.equal(rt.getHydrated(), '<b>hi</b><i></i>', 'late resolution discarded');
  } finally {
    setBudgets();
    delete (globalThis as any).__lollyLateGate;
  }
});

test('time-box: an async onInput past its budget → keystroke kept, no hook patch, warning logged', async () => {
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
    assert.equal(rt.getHydrated(), '<b>typed</b><i></i>', 'input value kept; timed-out patch not applied');
    await sleep(80); // the abandoned hook resolves now — still discarded
    assert.equal(rt.getHydrated(), '<b>typed</b><i></i>', 'late resolution discarded');
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

// ─── sync overrun: cannot be preempted — warn, patch still applies ────────────

test('time-box: a slow SYNCHRONOUS hook cannot be preempted — warning logged, patch still applies', async () => {
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

test('time-box: onFrame is NOT time-boxed — a slow frame still applies its patch (drop-overlap only)', async () => {
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
    assert.deepEqual(logs, [], 'no timeout logged — onFrame is exempt');
    rt.stopLive();
  } finally { setBudgets(); }
});
