// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for runtime.applyPatch - the atomic multi-input apply added for
 * live collaboration (plans/100 section 5 + section 11.11, wave 0.4).
 *
 * The decided semantics, pinned here so a later refactor can't quietly drift:
 *   - one batch → ONE emit (one render), never one per key;
 *   - `onInput` still runs per CHANGED id, sequentially in the object's
 *     insertion order, with setInput's time-box + warn-don't-throw handling;
 *   - an unknown id (version skew between peers) and a value the constraints
 *     reject are dropped ON THEIR OWN - never the batch, never a throw mid-apply;
 *   - values are constrained by exactly setInput's path, and setInput itself is
 *     unchanged (it still paints per call).
 *
 * Run with: node --test tests/apply-patch.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime, HOOK_BUDGET_MS } from '../engine/src/runtime.ts';

const DEFAULT_BUDGETS = { ...HOOK_BUDGET_MS };
function setBudgets(over: Partial<typeof HOOK_BUDGET_MS> = {}) {
  Object.assign(HOOK_BUDGET_MS, DEFAULT_BUDGETS, over);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Minimal tool double: three declared inputs of different types (so coercion is
// observable), a template that also renders an undeclared key (`nope`) and a
// hook-computed extra (`note`). Each tool gets a UNIQUE id - compiled hook
// factories are memoised by id@version, so a shared id would reuse another
// test's hooks.
let toolSeq = 0;
function toolDouble(hooksSource?: string): any {
  return {
    manifest: {
      id: `patchy-${++toolSeq}`, name: 'Patchy', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [
        { id: 'title', type: 'text', default: 'hi' },
        { id: 'count', type: 'number', default: 1, min: 0, max: 10 },
        { id: 'flag', type: 'boolean', default: false },
      ],
      ...(hooksSource ? { hooks: { onInput: true } } : {}),
    },
    template: '<b>{{title}}</b><i>{{count}}</i><u>{{flag}}</u><e>{{nope}}</e><s>{{note}}</s>',
    hooksSource: hooksSource ?? null,
  };
}

// Host double that records host.log calls as "level:message" strings.
function logHost() {
  const logs: string[] = [];
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    log: (level: string, msg: string) => logs.push(`${level}:${msg}`),
  };
  return { host, logs };
}

/** Subscribe and count emissions from NOW (subscribe itself fires once, immediately). */
function emitCounter(rt: { subscribe(fn: (s: unknown) => void): () => void }) {
  const state = { n: 0 };
  rt.subscribe(() => { state.n++; });
  state.n = 0;
  return state;
}

// Park hook-call recording where a `new Function` hook's realm-global scope can
// reach it (hooks can't close over test locals).
function hookCalls(): string[] {
  const calls: string[] = [];
  (globalThis as any).__lollyPatchCalls = calls;
  return calls;
}

// ─── one batch, one render ────────────────────────────────────────────────────

test('applyPatch: a multi-key batch emits ONCE, not once per key', async () => {
  const { host } = logHost();
  const rt = await createRuntime(toolDouble(), host, {});
  const emits = emitCounter(rt);

  await rt.applyPatch({ title: 'a', count: 3, flag: true });

  assert.equal(emits.n, 1, 'one render for the whole batch');
  assert.equal(rt.getHydrated(), '<b>a</b><i>3</i><u>true</u><e></e><s></s>');
});

test('applyPatch: a batch where nothing landed emits nothing at all', async () => {
  const { host } = logHost();
  const rt = await createRuntime(toolDouble(), host, {});
  const emits = emitCounter(rt);

  await rt.applyPatch({});                       // empty
  await rt.applyPatch({ nope: 'x', other: 1 });  // no such inputs
  await rt.applyPatch({ count: 'abc' });         // rejected by the constraints
  await rt.applyPatch({ title: 'hi' });          // same value as the default

  assert.equal(emits.n, 0, 'no-op batches never repaint');
  assert.equal(rt.getHydrated(), '<b>hi</b><i>1</i><u>false</u><e></e><s></s>');
});

// ─── hooks: once per changed id, in insertion order ───────────────────────────

test('applyPatch: onInput runs once per changed id, sequentially in insertion order', async () => {
  const { host } = logHost();
  const calls = hookCalls();
  try {
    const rt = await createRuntime(
      toolDouble(`function onInput({ id, value }) {
         globalThis.__lollyPatchCalls.push(id + '=' + value);
         return { note: globalThis.__lollyPatchCalls.length };
       }`),
      host, {},
    );
    const emits = emitCounter(rt);

    await rt.applyPatch({ flag: true, title: 'z', count: 2 });

    assert.deepEqual(calls, ['flag=true', 'title=z', 'count=2'], 'op order, one call per id');
    assert.equal(emits.n, 1, 'still ONE render - hook patches ride the same emit');
    assert.equal(rt.getHydrated(), '<b>z</b><i>2</i><u>true</u><e></e><s>3</s>',
      'the final state includes the last hook patch');
  } finally { delete (globalThis as any).__lollyPatchCalls; }
});

test('applyPatch: the batch is atomic - the FIRST hook already sees every applied value', async () => {
  const { host } = logHost();
  const calls = hookCalls();
  try {
    const rt = await createRuntime(
      toolDouble(`function onInput({ model }) {
         globalThis.__lollyPatchCalls.push(model.map(i => i.id + ':' + i.value).join('|'));
       }`),
      host, {},
    );

    await rt.applyPatch({ title: 'z', count: 2, flag: true });

    assert.equal(calls[0], 'title:z|count:2|flag:true',
      'values land first, hooks observe the whole batch (never a half-applied model)');
  } finally { delete (globalThis as any).__lollyPatchCalls; }
});

test('applyPatch: a hook is told the value that ACTUALLY entered the model (post-constrain)', async () => {
  const { host } = logHost();
  const calls = hookCalls();
  try {
    // count is min 0 / max 10, so 99 clamps to 10 - the hook must not be handed a
    // value the model never holds (an untrusted remote value is clamped first).
    const rt = await createRuntime(
      toolDouble(`function onInput({ id, value }) { globalThis.__lollyPatchCalls.push(id + '=' + value); }`),
      host, {},
    );

    await rt.applyPatch({ count: 99 });

    assert.deepEqual(calls, ['count=10']);
    assert.equal(rt.getHydrated(), '<b>hi</b><i>10</i><u>false</u><e></e><s></s>');
  } finally { delete (globalThis as any).__lollyPatchCalls; }
});

test('applyPatch: a throwing hook is logged, not thrown - later ids still run, still one emit', async () => {
  const { host, logs } = logHost();
  const calls = hookCalls();
  try {
    const rt = await createRuntime(
      toolDouble(`function onInput({ id }) {
         globalThis.__lollyPatchCalls.push(id);
         if (id === 'title') throw new Error('boom');
         return { note: 'ok' };
       }`),
      host, {},
    );
    const emits = emitCounter(rt);

    await rt.applyPatch({ title: 'z', count: 2 });

    assert.deepEqual(calls, ['title', 'count'], 'the batch continued past the failing id');
    assert.ok(logs.some(l => l.startsWith('warn:onInput') && l.includes('boom')), `logged, got: ${logs.join(' | ')}`);
    assert.equal(emits.n, 1);
    assert.equal(rt.getHydrated(), '<b>z</b><i>2</i><u>false</u><e></e><s>ok</s>');
  } finally { delete (globalThis as any).__lollyPatchCalls; }
});

test('applyPatch: a hook past its budget drops only its own patch - same time-box as setInput', async () => {
  setBudgets({ onInput: 15 });
  const { host, logs } = logHost();
  try {
    const rt = await createRuntime(
      toolDouble(`function onInput({ id }) {
         return id === 'title'
           ? new Promise((r) => setTimeout(() => r({ note: 'late' }), 60))
           : { note: 'fast' };
       }`),
      host, {},
    );
    const emits = emitCounter(rt);

    await rt.applyPatch({ title: 'z', count: 2 });

    assert.ok(logs.some(l => l.startsWith('warn:onInput') && l.includes('timed out after 15ms')),
      `timeout logged, got: ${logs.join(' | ')}`);
    assert.equal(emits.n, 1, 'the timed-out hook did not cost an extra render');
    assert.equal(rt.getHydrated(), '<b>z</b><i>2</i><u>false</u><e></e><s>fast</s>',
      'both values applied; only the overrunning hook patch was dropped');
    // The abandoned hook resolves now, but the batch's `count` run superseded
    // it (newer hookRunSeq) - so even under v1.146 late-apply it stays discarded.
    await sleep(80);
    assert.equal(rt.getHydrated(), '<b>z</b><i>2</i><u>false</u><e></e><s>fast</s>');
  } finally { setBudgets(); delete (globalThis as any).__lollyPatchCalls; }
});

// ─── dropped keys: unknown ids and rejected values ────────────────────────────

test('applyPatch: an unknown input id is skipped - no model entry, no extra, no hook', async () => {
  const { host } = logHost();
  const calls = hookCalls();
  try {
    const rt = await createRuntime(
      toolDouble(`function onInput({ id }) { globalThis.__lollyPatchCalls.push(id); }`),
      host, {},
    );

    // `nope` is a peer's newer input we don't declare; it must not become an
    // extra (that would let a remote patch inject template context).
    await rt.applyPatch({ nope: 'INJECTED', title: 'ok' });

    assert.deepEqual(calls, ['title'], 'no hook for an id we do not declare');
    assert.equal(rt.getModel().some(i => i.id === 'nope'), false, 'no phantom input');
    assert.equal(rt.getHydrated(), '<b>ok</b><i>1</i><u>false</u><e></e><s></s>');
  } finally { delete (globalThis as any).__lollyPatchCalls; }
});

test('applyPatch: an invalid value drops THAT key while every valid key still applies', async () => {
  const { host } = logHost();
  const calls = hookCalls();
  try {
    const rt = await createRuntime(
      toolDouble(`function onInput({ id }) { globalThis.__lollyPatchCalls.push(id); }`),
      host, {},
    );
    const emits = emitCounter(rt);

    await rt.applyPatch({ count: 'abc', title: 42, flag: true });

    assert.equal(emits.n, 1, 'the batch still rendered once');
    assert.deepEqual(calls, ['flag'], 'no hook for a key that never landed');
    assert.equal(rt.getHydrated(), '<b>hi</b><i>1</i><u>true</u><e></e><s></s>',
      'NaN number and non-string text kept their prior values; the boolean applied');
    // A dropped key must not even mark the input dirty.
    assert.equal(rt.getModel().find(i => i.id === 'count')!.isDirty ?? false, false);
    assert.equal(rt.getModel().find(i => i.id === 'flag')!.isDirty, true);
  } finally { delete (globalThis as any).__lollyPatchCalls; }
});

// A tool covering the types the number/text cases above don't reach - the ones a
// peer can name in a patch and the ones section 11.11 calls out by name.
let typedSeq = 0;
function typedToolDouble(): any {
  return {
    manifest: {
      id: `typey-${++typedSeq}`, name: 'Typey', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [
        { id: 'mode', type: 'select', default: 'a', options: [{ value: 'a' }, { value: 'b' }] },
        { id: 'face', type: 'select', default: 'a', brandFonts: true, options: [{ value: 'a' }] },
        { id: 'free', type: 'select', default: 'x' },
        { id: 'when', type: 'date', default: '2026-01-01' },
        { id: 'link', type: 'url', default: 'https://lolly.tools' },
        { id: 'rows', type: 'blocks', default: [], fields: [{ id: 'label', type: 'text' }] },
      ],
    },
    template: '<m>{{mode}}</m><w>{{when}}</w>',
    hooksSource: null,
  };
}

test('applyPatch: the manifest\'s own declarations are the gate (section 11.11 - enum, shape)', async () => {
  const { host } = logHost();
  const rt = await createRuntime(typedToolDouble(), host, {});
  const valueOf = (id: string) => rt.getModel().find(i => i.id === id)!.value;

  // The enum whitelist: a value outside the declared options never enters, and
  // `__proto__` is just another string that isn't an option.
  await rt.applyPatch({ mode: '__proto__' });
  assert.equal(valueOf('mode'), 'a', 'an out-of-enum select value was dropped');
  await rt.applyPatch({ mode: 'b' });
  assert.equal(valueOf('mode'), 'b', 'a declared option still applies');

  // Shape checks for the types whose value is a plain string or an array.
  await rt.applyPatch({ when: { evil: 1 } as never, link: ['x'] as never, rows: 'not-an-array' as never });
  assert.equal(valueOf('when'), '2026-01-01');
  assert.equal(valueOf('link'), 'https://lolly.tools');
  assert.deepEqual(valueOf('rows'), []);
  await rt.applyPatch({ rows: [{ label: 'one' }] });
  assert.deepEqual(valueOf('rows'), [{ label: 'one' }], 'a real row array still applies');

  // The two carve-outs, stated as behaviour rather than left to the comment: a
  // `brandFonts` select is extended at runtime by the shell, and a select with no
  // declared options has no enum to check against.
  await rt.applyPatch({ face: 'Some User Font', free: 'anything' });
  assert.equal(valueOf('face'), 'Some User Font');
  assert.equal(valueOf('free'), 'anything');

  assert.equal(rt.getHydrated(), '<m>b</m><w>2026-01-01</w>');
});

test('applyPatch: a boolean takes booleans and the wire spellings, nothing else', async () => {
  const { host } = logHost();
  const rt = await createRuntime(toolDouble(), host, {});
  const flag = () => rt.getModel().find(i => i.id === 'flag')!.value;

  await rt.applyPatch({ flag: { evil: 1 } as never });
  assert.equal(flag(), false, 'an object is not a boolean');
  await rt.applyPatch({ flag: 'maybe' as never });
  assert.equal(flag(), false, 'nor is arbitrary text');
  await rt.applyPatch({ flag: '1' as never });
  assert.equal(flag(), true, 'the URL/CLI spelling still normalises');
  await rt.applyPatch({ flag: 'false' as never });
  assert.equal(flag(), false);
});

test('applyPatch: coercion is byte-for-byte setInput’s - clamped, truncated, rejected alike', async () => {
  const { host } = logHost();
  const viaPatch = await createRuntime(toolDouble(), host, {});
  const viaSet = await createRuntime(toolDouble(), host, {});

  const cases: Record<string, unknown> = { count: 99, title: 42, flag: 'yes' };
  await viaPatch.applyPatch(cases);
  for (const [id, value] of Object.entries(cases)) await viaSet.setInput(id, value as never);

  assert.deepEqual(
    viaPatch.getModel().map(i => [i.id, i.value]),
    viaSet.getModel().map(i => [i.id, i.value]),
    'the batch path and the keystroke path constrain identically',
  );
  assert.equal(viaPatch.getHydrated(), viaSet.getHydrated());
});

// ─── setInput itself is unchanged ─────────────────────────────────────────────

test('setInput is unchanged: still one paint per call, and still a second emit for its hook patch', async () => {
  const { host } = logHost();

  const plain = await createRuntime(toolDouble(), host, {});
  const plainEmits = emitCounter(plain);
  await plain.setInput('title', 'a');
  await plain.setInput('count', 3);
  await plain.setInput('flag', true);
  assert.equal(plainEmits.n, 3, 'one emit per setInput (no coalescing was introduced)');
  assert.equal(plain.getHydrated(), '<b>a</b><i>3</i><u>true</u><e></e><s></s>');

  const hooked = await createRuntime(
    toolDouble(`function onInput({ value }) { return { note: 'seen:' + value }; }`),
    host, {},
  );
  const hookedEmits = emitCounter(hooked);
  await hooked.setInput('title', 'a');
  assert.equal(hookedEmits.n, 2, 'setInput still paints the keystroke first, then re-emits with the patch');
  assert.equal(hooked.getHydrated(), '<b>a</b><i>1</i><u>false</u><e></e><s>seen:a</s>');
});
