// SPDX-License-Identifier: MPL-2.0
/**
 * Input notices (engine 1.358): a hook result's reserved `inputNotices` key puts
 * a message under an input. These tests pin the contract: the shape that is
 * accepted, replace and keep, the text cap, the unknown id, late apply, the
 * worker path, and that a notice never reaches a value, an extra, the template,
 * a link or a saved value set.
 *
 * Run with: node --test tests/input-notices.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime, HOOK_BUDGET_MS } from '../engine/src/runtime.ts';
import { loadTool, ToolLoadError } from '../engine/src/loader.ts';
import { readInputNotices, sameInputNotices, modelToValues } from '../engine/src/inputs.ts';
import { serializeUrlState } from '../engine/src/url-mode.ts';
import { INPUT_NOTICES_KEY, INPUT_NOTICE_TEXT_MAX, ENGINE_VERSION } from '../engine/src/index.ts';
import { createNodeHookExecutor } from '../packages/node-shell/src/hook-worker.ts';

const DEFAULT_BUDGETS = { ...HOOK_BUDGET_MS };
const setBudgets = (over: Partial<typeof HOOK_BUDGET_MS> = {}) => Object.assign(HOOK_BUDGET_MS, DEFAULT_BUDGETS, over);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let seq = 0;
function toolWith(hooks: Record<string, boolean>, hooksSource: string): any {
  return {
    manifest: {
      id: `noticed-${++seq}`, name: 'Noticed', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['svg'] },
      inputs: [{ id: 'msg', type: 'text', default: 'hi' }, { id: 'ink', type: 'color', default: '#000000' }],
      hooks,
    },
    // A template that would show the key if it ever became an extra.
    template: '<b>{{msg}}</b><i>{{note}}</i><u>{{#if inputNotices}}LEAK{{/if}}</u>',
    hooksSource,
  };
}

function logHost(extra: Record<string, unknown> = {}) {
  const logs: string[] = [];
  const host: any = {
    version: '1',
    shell: 'cli',
    capabilities: [],
    profile: { get: async () => ({}), subscribe: () => () => {} },
    assets: { get: async () => null, query: async () => [], pick: async () => null, isAvailable: async () => true },
    state: { save: async () => {}, load: async () => null, list: async () => [], delete: async () => {} },
    log: (level: string, msg: string) => logs.push(`${level}:${msg}`),
    ...extra,
  };
  return { host, logs };
}

// A hook whose notices follow the typed value, so one tool covers every case:
//   "warn" sets a warning on msg, "both" sets two, "clear" returns the empty set,
//   "null" returns null for msg, anything else returns no key at all.
const FOLLOW = `
function notes(v) {
  if (v === 'warn') return { inputNotices: { msg: { tone: 'warning', text: 'Too short.' } } };
  if (v === 'both') return { inputNotices: { msg: { tone: 'error', text: 'Bad.' }, ink: { tone: 'info', text: 'Fine.' } } };
  if (v === 'clear') return { inputNotices: {} };
  if (v === 'null') return { inputNotices: { msg: null } };
  return { note: 'n:' + v };
}
function onInit({ model }) { return notes(model[0].value); }
function onInput({ model }) { return notes(model[0].value); }
`;

// ─── the pure reader ─────────────────────────────────────────────────────────

test('readInputNotices: keeps well-formed entries, drops the rest and reports why', () => {
  const ids = new Set(['a', 'b', 'c', 'd']);
  const read = readInputNotices({
    a: { tone: 'warning', text: '  Low contrast.  ' },
    b: null,
    c: { tone: 'loud', text: 'x' },
    d: { tone: 'info', text: '   ' },
    ghost: { tone: 'info', text: 'nobody' },
  }, ids);
  assert.deepEqual(read.notices, { a: { tone: 'warning', text: 'Low contrast.' } });
  assert.deepEqual(read.unknown, ['ghost']);
  assert.deepEqual(read.invalid, ['c', 'd']);
  for (const junk of [null, undefined, 'text', 7, ['a'], true]) {
    assert.deepEqual(readInputNotices(junk, ids).notices, {}, `${JSON.stringify(junk)} reads as the empty set`);
  }
});

test('readInputNotices: text is plain, single-line and capped, and never ends on half a pair', () => {
  const ids = new Set(['a']);
  const markup = readInputNotices({ a: { tone: 'error', text: '<img src=x onerror=alert(1)>\nnext\u0000line' } }, ids).notices.a!;
  assert.equal(markup.text, '<img src=x onerror=alert(1)> next line', 'markup stays text for the shell to escape; control characters become spaces');
  const long = readInputNotices({ a: { tone: 'info', text: 'x'.repeat(INPUT_NOTICE_TEXT_MAX + 50) } }, ids).notices.a!;
  assert.equal(long.text.length, INPUT_NOTICE_TEXT_MAX);
  const pair = readInputNotices({ a: { tone: 'info', text: 'x'.repeat(INPUT_NOTICE_TEXT_MAX - 1) + '\u{1F600}' } }, ids).notices.a!;
  assert.equal(pair.text.length, INPUT_NOTICE_TEXT_MAX - 1, 'the emoji that would be cut in half is dropped whole');
  assert.ok(Object.isFrozen(long));
});

test('sameInputNotices compares by content', () => {
  const a = { x: { tone: 'info', text: 'a' } } as const;
  assert.ok(sameInputNotices(a, { x: { tone: 'info', text: 'a' } }));
  assert.ok(!sameInputNotices(a, { x: { tone: 'warning', text: 'a' } }));
  assert.ok(!sameInputNotices(a, {}));
  assert.ok(!sameInputNotices(a, { x: a.x, y: a.x }));
});

// ─── the runtime ─────────────────────────────────────────────────────────────

test('a hook result sets a notice; it is not a value, not an extra and not in the template', async () => {
  const { host } = logHost();
  const rt = await createRuntime(toolWith({ onInit: true, onInput: true }, FOLLOW), host, { msg: 'warn' });
  assert.deepEqual(rt.getNotices(), { msg: { tone: 'warning', text: 'Too short.' } });
  assert.equal(rt.getHydrated(), '<b>warn</b><i></i><u></u>', 'the key never becomes an extra the template can read');
  assert.equal(rt.getHydratedString('{{inputNotices}}'), '');
  const model = rt.getModel();
  assert.ok(!JSON.stringify(model).includes('Too short.'), 'the model carries no notice text');
  assert.ok(!JSON.stringify(modelToValues(model)).includes('Too short.'), 'the values a session saves carry none');
  const query = serializeUrlState(model);
  assert.ok(!query.includes('inputNotices') && !/Too(\+|%20)short/.test(query), `a link carries none, got: ${query}`);
  rt.destroy();
});

test('a result with the key replaces the whole set; a result without it leaves the set alone; {} and null clear', async () => {
  const { host } = logHost();
  const rt = await createRuntime(toolWith({ onInit: true, onInput: true }, FOLLOW), host, { msg: 'both' });
  assert.deepEqual(Object.keys(rt.getNotices()).sort(), ['ink', 'msg']);

  await rt.setInput('msg', 'warn');
  assert.deepEqual(rt.getNotices(), { msg: { tone: 'warning', text: 'Too short.' } }, 'replaced whole: ink is gone');

  const before = rt.getNotices();
  await rt.setInput('msg', 'anything');
  assert.equal(rt.getNotices(), before, 'no key in the result: the set stands, same object');
  assert.match(rt.getHydrated(), /n:anything/, 'and the rest of the patch still applied');

  await rt.setInput('msg', 'null');
  assert.deepEqual(rt.getNotices(), {}, 'null for the only entry clears it');

  await rt.setInput('msg', 'both');
  await rt.setInput('msg', 'clear');
  assert.deepEqual(rt.getNotices(), {}, 'the empty set clears everything');
  rt.destroy();
});

test('subscribers get the set with each emission, and the same object while it is unchanged', async () => {
  const { host } = logHost();
  const rt = await createRuntime(toolWith({ onInit: true, onInput: true }, FOLLOW), host, { msg: 'hi' });
  const seen: unknown[] = [];
  rt.subscribe((state) => seen.push(state.notices));
  await rt.setInput('msg', 'warn');
  const first = seen.at(-1);
  assert.deepEqual(first, { msg: { tone: 'warning', text: 'Too short.' } });
  await rt.setInput('msg', 'warn');
  assert.equal(seen.at(-1), first, 'an equal set keeps its identity, so a shell can skip the work');
  rt.destroy();
});

test('an unknown id or a malformed entry is left out and logged once, however often it comes back', async () => {
  const { host, logs } = logHost();
  const rt = await createRuntime(toolWith({ onInit: true, onInput: true }, `
    function run() { return { inputNotices: { ghost: { tone: 'info', text: 'x' }, ink: { tone: 'shout', text: 'x' }, msg: { tone: 'info', text: 'kept' } } }; }
    function onInit() { return run(); }
    function onInput() { return run(); }
  `), host, {});
  await rt.setInput('msg', 'a');
  await rt.setInput('msg', 'b');
  assert.deepEqual(rt.getNotices(), { msg: { tone: 'info', text: 'kept' } });
  assert.equal(logs.filter((l) => l.includes('"ghost"')).length, 1, logs.join(' | '));
  assert.equal(logs.filter((l) => l.includes('"ink"')).length, 1, logs.join(' | '));
  assert.ok(logs.every((l) => !l.includes('"msg"')));
  rt.destroy();
});

test('a hook that sets an input and a notice in one result does both', async () => {
  const { host } = logHost();
  const rt = await createRuntime(toolWith({ onInit: true }, `
    function onInit() { return { msg: 'fixed', note: 'n', inputNotices: { msg: { tone: 'info', text: 'Changed for you.' } } }; }
  `), host, {});
  assert.equal(rt.getHydrated(), '<b>fixed</b><i>n</i><u></u>');
  assert.deepEqual(rt.getNotices(), { msg: { tone: 'info', text: 'Changed for you.' } });
  rt.destroy();
});

// ─── budgets and late apply: the same rules as any patch ─────────────────────

test('late apply: a raced-out onInput still sets its notice when it lands; a superseded one never does', async () => {
  setBudgets({ onInput: 15 });
  try {
    const { host } = logHost();
    const rt = await createRuntime(toolWith({ onInput: true }, `
      function onInput({ model }) {
        var v = model[0].value;
        if (v === 'slow') return new Promise(function (r) { setTimeout(function () { r({ inputNotices: { msg: { tone: 'warning', text: 'slow one' } } }); }, 60); });
        if (v === 'slower') return new Promise(function (r) { setTimeout(function () { r({ inputNotices: { msg: { tone: 'error', text: 'stale' } } }); }, 80); });
        return { inputNotices: { msg: { tone: 'info', text: 'quick' } } };
      }
    `), host, {});
    const emitted: unknown[] = [];
    rt.subscribe((s) => emitted.push(s.notices));

    await rt.setInput('msg', 'slow');
    assert.deepEqual(rt.getNotices(), {}, 'over budget: nothing applied now');
    await sleep(90);
    assert.deepEqual(rt.getNotices(), { msg: { tone: 'warning', text: 'slow one' } }, 'the newest run applies late');
    assert.deepEqual(emitted.at(-1), rt.getNotices(), 'and subscribers heard it');

    await rt.setInput('msg', 'slower');
    await rt.setInput('msg', 'quick');
    await sleep(120);
    assert.deepEqual(rt.getNotices(), { msg: { tone: 'info', text: 'quick' } }, 'the superseded run stays discarded');
    rt.destroy();
  } finally { setBudgets(); }
});

test('report(): an intermediate patch may carry notices, and the final result replaces them', async () => {
  const { host } = logHost();
  (globalThis as any).__noticeGate = {};
  const gate = new Promise((r) => { (globalThis as any).__noticeGate.open = r; });
  (globalThis as any).__noticeGate.wait = gate;
  try {
    const rt = await createRuntime(toolWith({ onInput: true }, `
      async function onInput({ report }) {
        report({ inputNotices: { msg: { tone: 'info', text: 'Checking.' } } });
        await globalThis.__noticeGate.wait;
        return { inputNotices: {} };
      }
    `), host, {});
    const done = rt.setInput('msg', 'go');
    await sleep(5);
    assert.deepEqual(rt.getNotices(), { msg: { tone: 'info', text: 'Checking.' } });
    (globalThis as any).__noticeGate.open();
    await done;
    assert.deepEqual(rt.getNotices(), {});
    rt.destroy();
  } finally { delete (globalThis as any).__noticeGate; }
});

// ─── the worker path ─────────────────────────────────────────────────────────

test('worker thread: notices cross the hook-worker protocol, from a result and from a report', async () => {
  const { host } = logHost();
  const rt = await createRuntime(toolWith({ onInit: true, onInput: true }, `
    function onInit() { return { note: 'w', inputNotices: { msg: { tone: 'warning', text: 'From the worker.' }, ghost: { tone: 'info', text: 'x' } } }; }
    async function onInput({ model, report }) {
      if (model[0].value === 'report') { report({ inputNotices: { ink: { tone: 'error', text: 'Reported.' } } }); return {}; }
      return { inputNotices: {} };
    }
  `), host, {}, { hookExecutor: createNodeHookExecutor() });
  try {
    assert.deepEqual(rt.getNotices(), { msg: { tone: 'warning', text: 'From the worker.' } });
    assert.equal(rt.getHydrated(), '<b>hi</b><i>w</i><u></u>');
    await rt.setInput('msg', 'report');
    assert.deepEqual(rt.getNotices(), { ink: { tone: 'error', text: 'Reported.' } }, 'a report replaces the set, and the keyless result leaves it');
    await rt.setInput('msg', 'x');
    assert.deepEqual(rt.getNotices(), {});
  } finally { rt.destroy(); }
});

// ─── the reserved id ─────────────────────────────────────────────────────────

test('the loader refuses a manifest that declares an input with the reserved id', async () => {
  const manifest = (inputId: string) => JSON.stringify({
    id: 'reserved-id', name: 'Reserved', description: 'A tool for the reserved id test.', version: '1.0.0',
    engineVersion: `^${ENGINE_VERSION}`, status: 'experimental', category: 'everyone',
    render: { width: 10, height: 10, formats: ['svg'] },
    inputs: [{ id: inputId, type: 'text', label: 'Text' }],
  });
  const read = (inputId: string) => async (path: string) => {
    if (path.endsWith('tool.json')) return manifest(inputId);
    if (path.endsWith('template.html')) return '<b>{{x}}</b>';
    throw new Error('ENOENT');
  };
  await assert.rejects(
    loadTool('reserved-id', read(INPUT_NOTICES_KEY)),
    (e: unknown) => e instanceof ToolLoadError && /reserved for hook notices/.test(e.message),
  );
  const ok = await loadTool('reserved-id', read('fine'));
  assert.equal(ok.manifest.inputs?.[0]?.id, 'fine', 'the same manifest with another id loads');
});

test('no tool in the tree declares the reserved id', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const roots = ['../community/', '../brands/lolly-start/tools/', '../brands/suse/tools/'];
  let checked = 0;
  for (const root of roots) {
    const dir = new URL(root, import.meta.url);
    const names = await readdir(dir).catch(() => [] as string[]);
    for (const name of names) {
      const text = await readFile(new URL(`${name}/tool.json`, dir), 'utf8').catch(() => null);
      if (!text) continue;
      checked++;
      const ids = ((JSON.parse(text) as { inputs?: { id: string }[] }).inputs ?? []).map((i) => i.id);
      assert.ok(!ids.includes(INPUT_NOTICES_KEY), `${name} declares "${INPUT_NOTICES_KEY}"`);
    }
  }
  assert.ok(checked > 40, `read ${checked} manifests`);
});
