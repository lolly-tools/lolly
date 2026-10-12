// SPDX-License-Identifier: MPL-2.0
/** Enter transitions keep a usable duration and curve across source and local edits. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokenSet } from './tokens.ts';
import { resolveTokenBinding } from './token-binding.ts';
import { readBlockTokenBindings, reconcileBlockTokenBindings, resolveBlockTokenBindings, withBlockTokenBinding } from './token-block-bindings.ts';
import { buildInputModel, type BlockFieldSpec, type InputValue } from './inputs.ts';
import { loadTool, type ToolManifest } from './loader.ts';
import { createRuntime } from './runtime.ts';
import type { HostV1, TokenResolveOptions, TokenSet } from './bridge/host-v1.ts';
import type { TokenAdapter } from './token-consumer-adapters.ts';
import { parseUrlState, serializeUrlState } from './url-mode.ts';

const transition = { duration: { value: 0.6, unit: 's' }, delay: { value: 0, unit: 'ms' }, timingFunction: [0.25, -0.2, 0.75, 1.2] };
const tokens = (value: unknown = transition) => createTokenSet({ reveal: { $type: 'transition', $value: value } });
const fields: BlockFieldSpec[] = [{ id: 'id', type: 'text' }, { id: 'enterMs', type: 'number', min: 100, max: 3000 }, { id: 'enterEase', type: 'text' }, { id: 'start', type: 'number' }, { id: 'dur', type: 'number' }, { id: 'exitMs', type: 'number' }, { id: 'exitEase', type: 'text' }, { id: 'lane', type: 'number' }, { id: 'build', type: 'text' }, { id: 'enterPreset', type: 'text' }, { id: 'links', type: 'text' }];
const targets: Array<[string, TokenAdapter]> = [['enterMs', 'transition.duration-ms'], ['enterEase', 'transition.timingFunction']];
const curve = 'cubic-bezier(0.25,-0.2,0.75,1.2)';
const manifest = { id: 'transition-test', name: 'Transition', version: '1.0.0', engineVersion: '^1.0.0', status: 'community', render: { formats: ['svg'], width: 100, height: 100 }, inputs: [{ id: 'boxes', type: 'blocks', fields, tokenBindingsField: 'links', default: [] }] } as ToolManifest;
type Row = Record<string, InputValue | undefined>;
function linked(row: Row = { id: 'a' }, value: unknown = transition): Row {
  const entry = tokens(value).get('reveal');
  const results = targets.map(([id, adapter]) => {
    const field = fields.find(field => field.id === id)!;
    const result = resolveTokenBinding(entry, { ...field, type: field.type!, adapter });
    assert.equal(result.status, 'linked');
    return result;
  });
  for (let i = 0; i < targets.length; i++) {
    const [id, adapter] = targets[i]!;
    row = withBlockTokenBinding(row, 'links', id, { ref: '{reveal}', value: results[i]!.value }, adapter);
  }
  return row;
}
function refresh(row: Row, set: TokenSet | undefined): Row {
  return resolveBlockTokenBindings([row], 'links', fields, set)[0] as Row;
}

test('transition projections resolve nested aliases, seconds and valid overshoot controls', () => {
  const set = createTokenSet({ duration: { $type: 'duration', $value: { value: 0.6, unit: 's' } }, zero: { $type: 'duration', $value: { value: 0, unit: 's' } }, curve: { $type: 'cubicBezier', $value: transition.timingFunction }, reveal: { $type: 'transition', $value: { duration: '{duration}', delay: '{zero}', timingFunction: '{curve}' } } });
  const entry = set.get('reveal');
  assert.equal(resolveTokenBinding(entry, { type: 'number', adapter: 'transition.duration-ms', min: 100, max: 3000 }).value, 600);
  assert.equal(resolveTokenBinding(entry, { type: 'text', adapter: 'transition.timingFunction' }).value, curve);
  const whole = resolveTokenBinding(entry, { type: 'text', adapter: 'transition', min: 100, max: 3000 });
  assert.equal(whole.status, 'linked');
  assert.deepEqual(JSON.parse(String(whole.value)), { ...transition, delay: { value: 0, unit: 's' } });
  assert.equal(resolveTokenBinding(tokens({ ...transition, duration: { value: 600, unit: 'ms' } }).get('reveal'), { type: 'number', adapter: 'transition.duration-ms' }).value, 600);
});

test('each transition projection refuses a delay or any malformed source component', () => {
  const invalid = [
    { ...transition, delay: { value: 0.001, unit: 's' } },
    { ...transition, delay: { value: -1, unit: 'ms' } },
    { ...transition, delay: { value: 0, unit: 'frames' } },
    { ...transition, duration: { value: -1, unit: 'ms' } },
    { ...transition, duration: { value: 1, unit: 'frames' } },
    { ...transition, duration: { value: Number.MAX_VALUE, unit: 's' } },
    { ...transition, timingFunction: [0.25, 0, 1.01, 1] },
    { ...transition, timingFunction: [0.25, 101, 0.75, 1] },
    { ...transition, timingFunction: [0.25, Number.NaN, 0.75, 1] },
    { ...transition, timingFunction: [0.25, 0, 0.75] },
    { duration: transition.duration, delay: transition.delay },
    { duration: transition.duration, timingFunction: transition.timingFunction },
    { delay: transition.delay, timingFunction: transition.timingFunction },
    [transition],
  ];
  for (const value of invalid) for (const adapter of ['transition', 'transition.duration-ms', 'transition.timingFunction'] as const) {
    const result = resolveTokenBinding(tokens(value).get('reveal'), { type: adapter === 'transition.duration-ms' ? 'number' : 'text', adapter });
    assert.equal(result.status, 'incompatible', `${adapter}: ${JSON.stringify(value)}`);
    assert.ok(result.reason);
    assert.equal(result.value, undefined);
  }
  const delayed = tokens({ ...transition, delay: { value: 1, unit: 'ms' } }).get('reveal');
  assert.match(resolveTokenBinding(delayed, { type: 'text', adapter: 'transition' }).reason!, /cannot apply a delay.*zero delay/);
  const durationOnly = createTokenSet({ reveal: { $type: 'duration', $value: transition.duration } }).get('reveal');
  assert.equal(resolveTokenBinding(durationOnly, { type: 'text', adapter: 'transition' }).status, 'incompatible');
});

test('sparse Bezier sources refuse whole transitions, projections and cached refresh together', () => {
  const sparseCurves = [new Array<number>(4), ...[0, 1, 2, 3].map(missing => {
    const partial = new Array<number>(4);
    for (let i = 0; i < 4; i++) if (i !== missing) partial[i] = transition.timingFunction[i]!;
    return partial;
  })];
  const row = linked();
  for (const timingFunction of sparseCurves) {
    const source = { ...transition, duration: { value: 900, unit: 'ms' }, timingFunction };
    const aliased = createTokenSet({ bezier: { $type: 'cubicBezier', $value: timingFunction }, reveal: { $type: 'transition', $value: { ...source, timingFunction: '{bezier}' } } });
    const standalone = resolveTokenBinding(aliased.get('bezier'), { type: 'text', adapter: 'cubic-bezier' });
    assert.equal(standalone.status, 'incompatible');
    assert.equal(standalone.value, undefined);
    for (const set of [tokens(source), aliased]) {
      for (const adapter of ['transition', 'transition.duration-ms', 'transition.timingFunction'] as const) {
        const result = resolveTokenBinding(set.get('reveal'), { type: adapter === 'transition.duration-ms' ? 'number' : 'text', adapter });
        assert.equal(result.status, 'incompatible', adapter);
        assert.equal(result.value, undefined);
        assert.match(result.reason!, /four finite controls/);
      }
      const held = refresh(row, set);
      assert.deepEqual([held.enterMs, held.enterEase], [600, curve]);
      const links = readBlockTokenBindings(held.links);
      for (const [id] of targets) {
        assert.equal(links[id]!.value, row[id]);
        assert.equal(links[id]!.status, 'incompatible');
      }
      assert.equal(links.enterMs!.reason, links.enterEase!.reason);
      assert.equal(refresh(held, set), held);
    }
  }
  assert.deepEqual([row.enterMs, row.enterEase], [600, curve]);
  assert.ok(Object.values(readBlockTokenBindings(row.links)).every(link => link.status === 'linked'));
});

test('duration units are exact strings for scalar and full transition sources', () => {
  const row = linked();
  for (const unit of [['ms'], ['s'], { toString: 'ms' }]) for (const component of ['duration', 'delay'] as const) {
    const malformed = { value: component === 'delay' ? 0 : 600, unit };
    const source = { ...transition, [component]: malformed };
    const aliased = createTokenSet({ duration: { $type: 'duration', $value: malformed }, alias: { $type: 'duration', $value: '{duration}' }, reveal: { $type: 'transition', $value: { ...source, [component]: '{alias}' } } });
    for (const path of ['duration', 'alias']) for (const adapter of ['duration-ms', 'duration-s'] as const) {
      const result = resolveTokenBinding(aliased.get(path), { type: 'number', adapter });
      assert.equal(result.status, 'incompatible');
      assert.equal(result.value, undefined);
      assert.match(result.reason!, /value in ms or s/);
    }
    for (const set of [tokens(source), aliased]) {
      for (const adapter of ['transition', 'transition.duration-ms', 'transition.timingFunction'] as const) {
        const result = resolveTokenBinding(set.get('reveal'), { type: adapter === 'transition.duration-ms' ? 'number' : 'text', adapter });
        assert.equal(result.status, 'incompatible', `${component}: ${adapter}`);
        assert.equal(result.value, undefined);
        assert.match(result.reason!, /value in ms or s/);
      }
      const held = refresh(row, set);
      assert.deepEqual([held.enterMs, held.enterEase], [600, curve]);
      const links = readBlockTokenBindings(held.links);
      for (const [id] of targets) {
        assert.equal(links[id]!.value, row[id]);
        assert.equal(links[id]!.status, 'incompatible');
      }
      assert.equal(links.enterMs!.reason, links.enterEase!.reason);
      assert.equal(refresh(held, set), held);
    }
  }
  assert.ok(Object.values(readBlockTokenBindings(row.links)).every(link => link.status === 'linked'));
});

test('whole-transition preflight respects the declared Enter duration range and text limit', () => {
  for (const [duration, status] of [[0, 'incompatible'], [99, 'incompatible'], [100, 'linked'], [3000, 'linked'], [3001, 'incompatible']] as const) {
    const entry = tokens({ ...transition, duration: { value: duration, unit: 'ms' } }).get('reveal');
    assert.equal(resolveTokenBinding(entry, { type: 'text', adapter: 'transition', min: 100, max: 3000 }).status, status);
  }
  assert.equal(resolveTokenBinding(tokens().get('reveal'), { type: 'text', adapter: 'transition', min: 100, max: 3000, maxLength: 5 }).status, 'incompatible');
});

test('transition refresh holds both active cached values on invalid sources and resumes together', () => {
  const row = linked();
  for (const value of [
    { ...transition, duration: { value: 900, unit: 'ms' }, timingFunction: [2, 0, 0.75, 1] },
    { ...transition, duration: { value: 3001, unit: 'ms' }, timingFunction: [0, 0, 1, 1] },
    { ...transition, duration: { value: 900, unit: 'ms' }, delay: { value: 1, unit: 'ms' } },
  ]) {
    const held = refresh(row, tokens(value));
    const links = readBlockTokenBindings(held.links);
    assert.deepEqual([held.enterMs, held.enterEase], [600, curve]);
    for (const [id] of targets) {
      assert.equal(links[id]!.value, row[id]);
      assert.equal(links[id]!.status, 'incompatible');
      assert.ok(links[id]!.reason);
    }
    assert.equal(links.enterMs!.reason, links.enterEase!.reason);
    assert.equal(refresh(held, tokens(value)), held);
  }
  const missing = refresh(row, undefined);
  assert.deepEqual([missing.enterMs, missing.enterEase], [600, curve]);
  assert.ok(Object.values(readBlockTokenBindings(missing.links)).every(link => link.status === 'unresolved'));
  const valid = tokens({ ...transition, duration: { value: 0.9, unit: 's' }, timingFunction: [0, 0, 1, 1] });
  const next = refresh(missing, valid);
  assert.deepEqual([next.enterMs, next.enterEase], [900, 'cubic-bezier(0,0,1,1)']);
  assert.ok(Object.values(readBlockTokenBindings(next.links)).every(link => link.status === 'linked' && !link.reason));
  assert.equal(refresh(next, valid), next);
});

test('custom Enter properties retain saved links without changing timeline or Exit fields', () => {
  const other = { start: 1250, dur: 4200, exitMs: 350, exitEase: 'ease-in', lane: 2, build: 'after', enterPreset: 'fade' };
  const row = linked({ id: 'a', ...other });
  const custom = reconcileBlockTokenBindings([{ ...row, enterMs: 700 }], 'links')[0] as Row;
  const next = refresh(custom, tokens({ ...transition, duration: { value: 900, unit: 'ms' }, timingFunction: [0, 0, 1, 1] }));
  assert.deepEqual([next.enterMs, next.enterEase], [700, 'cubic-bezier(0,0,1,1)']);
  const links = readBlockTokenBindings(next.links);
  assert.equal(links.enterMs!.custom, true);
  assert.equal(links.enterMs!.ref, '{reveal}');
  assert.equal(links.enterMs!.adapter, 'transition.duration-ms');
  assert.equal(links.enterMs!.value, 600);
  assert.equal(links.enterEase!.custom, undefined);
  const held = refresh(next, tokens({ ...transition, delay: { value: 10, unit: 'ms' } }));
  assert.deepEqual([held.enterMs, held.enterEase], [700, 'cubic-bezier(0,0,1,1)']);
  assert.deepEqual(readBlockTokenBindings(held.links).enterMs, links.enterMs);
  let allCustom = next;
  for (const [id] of targets) allCustom = withBlockTokenBinding(allCustom, 'links', id, allCustom[id]!);
  assert.deepEqual([allCustom.enterMs, allCustom.enterEase], [700, 'cubic-bezier(0,0,1,1)']);
  assert.ok(Object.values(readBlockTokenBindings(allCustom.links)).every(link => link.custom));
  assert.equal(refresh(allCustom, tokens()), allCustom);
  const restored = linked(allCustom);
  assert.deepEqual([restored.enterMs, restored.enterEase], [600, curve]);
  assert.ok(Object.values(readBlockTokenBindings(restored.links)).every(link => !link.custom));
  for (const key of Object.keys(other)) assert.equal(restored[key], other[key as keyof typeof other]);
});

test('inactive duration bounds do not hold a valid easing refresh but whole Restore still refuses', () => {
  const row = linked();
  const custom = withBlockTokenBinding(row, 'links', 'enterMs', 700);
  for (const duration of [50, 4000]) {
    const set = tokens({ ...transition, duration: { value: duration, unit: 'ms' }, timingFunction: [0, 0, 1, 1] });
    const held = refresh(row, set);
    assert.deepEqual([held.enterMs, held.enterEase], [600, curve]);
    assert.ok(Object.values(readBlockTokenBindings(held.links)).every(link => link.status === 'incompatible'));
    const next = refresh(custom, set);
    assert.deepEqual([next.enterMs, next.enterEase], [700, 'cubic-bezier(0,0,1,1)']);
    assert.deepEqual(readBlockTokenBindings(next.links).enterMs, readBlockTokenBindings(custom.links).enterMs);
    assert.equal(readBlockTokenBindings(next.links).enterEase!.status, 'linked');
    const restore = resolveTokenBinding(set.get('reveal'), { type: 'text', adapter: 'transition', min: 100, max: 3000 });
    assert.equal(restore.status, 'incompatible');
    assert.equal(restore.value, undefined);
  }
  const invalidSource = tokens({ ...transition, duration: { value: -1, unit: 'ms' }, timingFunction: [0, 0, 1, 1] });
  assert.deepEqual([refresh(custom, invalidSource).enterMs, refresh(custom, invalidSource).enterEase], [700, curve]);
});

test('atomic projections read one source snapshot and keep unrelated reference groups independent', () => {
  const row = linked();
  const first = tokens({ ...transition, duration: { value: 900, unit: 'ms' }, timingFunction: [0, 0, 1, 1] }).get('reveal');
  const second = tokens({ ...transition, duration: { value: 1200, unit: 'ms' }, timingFunction: [0.1, 0.2, 0.3, 0.4] }).get('reveal');
  let calls = 0;
  const set = { ...tokens(), get: () => ++calls === 1 ? first : second };
  const next = refresh(row, set);
  assert.equal(calls, 1);
  assert.deepEqual([next.enterMs, next.enterEase], [900, 'cubic-bezier(0,0,1,1)']);
  const independent = withBlockTokenBinding(row, 'links', 'exitEase', { ref: '{missing}', value: 'ease-in' }, 'transition.timingFunction');
  const result = refresh(independent, tokens({ ...transition, duration: { value: 900, unit: 'ms' } }));
  assert.equal(result.enterMs, 900);
  assert.equal(result.exitEase, 'ease-in');
  assert.equal(readBlockTokenBindings(result.links).exitEase!.status, 'unresolved');
});

test('an incompatible border consumer cannot hold a valid transition with the same reference', () => {
  const row = withBlockTokenBinding(linked(), 'links', 'exitMs', { ref: '{reveal}', value: 350 }, 'border.width');
  const next = refresh(row, tokens({ ...transition, duration: { value: 900, unit: 'ms' }, timingFunction: [0, 0, 1, 1] }));
  assert.deepEqual([next.enterMs, next.enterEase, next.exitMs], [900, 'cubic-bezier(0,0,1,1)', 350]);
  assert.equal(readBlockTokenBindings(next.links).exitMs!.status, 'incompatible');
});

test('transition projections and independent custom values survive compact URL reopening', () => {
  const row = withBlockTokenBinding(linked(), 'links', 'enterEase', 'ease-out');
  const wire = serializeUrlState(buildInputModel(manifest, { initial: { boxes: [row] } }));
  const reopened = parseUrlState(wire, manifest).values.boxes as InputValue[];
  const next = resolveBlockTokenBindings(reopened, 'links', fields, tokens({ ...transition, duration: { value: 900, unit: 'ms' } }))[0] as Row;
  assert.deepEqual([next.enterMs, next.enterEase], [900, 'ease-out']);
  const links = readBlockTokenBindings(next.links);
  assert.equal(links.enterMs!.adapter, 'transition.duration-ms');
  assert.equal(links.enterMs!.custom, undefined);
  assert.equal(links.enterEase!.adapter, 'transition.timingFunction');
  assert.equal(links.enterEase!.ref, '{reveal}');
  assert.equal(links.enterEase!.custom, true);
});

test('mounted runtime themes and undo-style row writes use the same guarded transition path', async () => {
  const doc = {
    $themes: [{ name: 'base', selectedTokenSets: { base: 'enabled' } }, { name: 'delayed', selectedTokenSets: { delayed: 'enabled' } }, { name: 'quick', selectedTokenSets: { quick: 'enabled' } }],
    $metadata: { tokenSetOrder: ['base', 'delayed', 'quick'] },
    base: { reveal: { $type: 'transition', $value: transition } },
    delayed: { reveal: { $type: 'transition', $value: { ...transition, duration: { value: 900, unit: 'ms' }, delay: { value: 20, unit: 'ms' } } } },
    quick: { reveal: { $type: 'transition', $value: { ...transition, duration: { value: 900, unit: 'ms' }, timingFunction: [0, 0, 1, 1] } } },
  };
  const tool = await loadTool(manifest.id, async path => {
    if (path.endsWith('tool.json')) return JSON.stringify(manifest);
    if (path.endsWith('template.html')) return '<svg>{{#each boxes}}<g data-duration="{{enterMs}}" data-curve="{{enterEase}}"/>{{/each}}</svg>';
    throw new Error('No optional source');
  });
  const host = { version: '1', shell: 'cli', capabilities: [], log: () => {}, profile: { get: async () => ({}) }, assets: { get: async () => null, query: async () => [] }, state: { load: async () => null, save: async () => {}, list: async () => [] }, clipboard: {}, export: {}, tokens: { get: async (options: TokenResolveOptions = {}) => createTokenSet(doc, options) } } as unknown as HostV1;
  const runtime = await createRuntime(tool, host, { boxes: [linked()] });
  const row = () => (runtime.getModel()[0]!.value as Row[])[0]!;
  assert.deepEqual([row().enterMs, row().enterEase], [600, curve]);
  await runtime.setTokenSelection({ '': 'delayed' });
  assert.deepEqual([row().enterMs, row().enterEase], [600, curve]);
  assert.ok(Object.values(readBlockTokenBindings(row().links)).every(link => link.status === 'incompatible'));
  await runtime.setTokenSelection({ '': 'quick' });
  assert.deepEqual([row().enterMs, row().enterEase], [900, 'cubic-bezier(0,0,1,1)']);
  assert.match(runtime.getHydrated(), /data-duration="900" data-curve="cubic-bezier\(0,0,1,1\)"/);
  const undoRow = structuredClone(row());
  await runtime.setInput('boxes', [{ ...row(), enterMs: 700 }]);
  await runtime.setTokenSelection({ '': 'base' });
  assert.deepEqual([row().enterMs, row().enterEase], [700, curve]);
  assert.equal(readBlockTokenBindings(row().links).enterMs!.custom, true);
  await runtime.setInput('boxes', [undoRow]);
  assert.deepEqual([row().enterMs, row().enterEase], [600, curve]);
  assert.ok(Object.values(readBlockTokenBindings(row().links)).every(link => link.status === 'linked' && !link.custom));
});
