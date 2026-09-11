// SPDX-License-Identifier: MPL-2.0
/**
 * tray.ts - candidate model + persistence (plan 97 SS8). No UI here; the host
 * is an in-memory stand-in for `host.state` with the same save/load shape the
 * real bridge exposes.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/tray.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { candidatesFromCensus, createTray } from './tray.ts';
import type { Candidate } from './tray.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { DesignCensus } from './census.ts';

/** A store shared across `createTray` calls simulates the same on-disk key two
 *  Tray instances (e.g. two views, or a reload) would both read and write. */
function fakeHost(store = new Map<string, unknown>()): { host: HostV1; store: Map<string, unknown> } {
  const host = {
    state: {
      async save(slot: string, data: object) { store.set(slot, structuredClone(data)); },
      async load(slot: string) { return store.has(slot) ? structuredClone(store.get(slot)) : null; },
      async list() { return []; },
      async delete(slot: string) { store.delete(slot); },
    },
  } as unknown as HostV1;
  return { host, store };
}

const CENSUS: DesignCensus = {
  colors: [
    { hex: '#111111', weight: 1 },
    { hex: '#222222', weight: 40 },
    { hex: '#333333', weight: 20 },
    { hex: '#FFFFFF', weight: 0.5, kind: 'stroke' },
  ],
  gradients: [{ stops: ['#111111', '#FFFFFF'], weight: 5 }],
  fonts: [
    { family: 'Inter', weight: 700, usage: 'heading', count: 3 },
    { family: 'inter', usage: 'body', count: 12 },
    { family: 'Roboto Mono', usage: 'mono', count: 4 },
  ],
  name: 'Acme Corp',
  source: { kind: 'site', label: 'acme.com' },
};

// ─── candidatesFromCensus ──────────────────────────────────────────────────────

test('candidatesFromCensus caps colours by weight, defaulting to 12', () => {
  const many: DesignCensus = {
    ...CENSUS,
    colors: Array.from({ length: 20 }, (_, i) => ({ hex: `#${(i + 1).toString(16).padStart(6, '0')}`, weight: i })),
    fonts: [],
    name: undefined,
  };
  const out = candidatesFromCensus(many);
  const colors = out.filter((c) => c.type === 'color');
  assert.equal(colors.length, 12);
  // highest-weight (i=19) sorts first.
  assert.equal(colors[0]!.value, `#${(20).toString(16).padStart(6, '0')}`);
});

test('candidatesFromCensus respects an explicit maxColors', () => {
  const out = candidatesFromCensus(CENSUS, { maxColors: 2 });
  const colors = out.filter((c) => c.type === 'color');
  assert.equal(colors.length, 2);
  assert.deepEqual(colors.map((c) => c.value), ['#222222', '#333333'], 'sorted by weight desc');
});

test('candidatesFromCensus folds fonts to one candidate per family, case-insensitively', () => {
  const out = candidatesFromCensus(CENSUS);
  const fonts = out.filter((c) => c.type === 'font');
  assert.equal(fonts.length, 2, 'Inter + inter fold into one, Roboto Mono is separate');
  const inter = fonts.find((f) => f.value.toLowerCase() === 'inter');
  assert.ok(inter);
  // count 12 (body) beats count 3 (heading) so body wins the usage.
  assert.equal(inter!.provenance.detail, 'body');
});

test('candidatesFromCensus emits a name candidate only when the census has one', () => {
  const withName = candidatesFromCensus(CENSUS);
  assert.equal(withName.filter((c) => c.type === 'name').length, 1);
  assert.equal(withName.find((c) => c.type === 'name')!.value, 'Acme Corp');

  const withoutName = candidatesFromCensus({ ...CENSUS, name: undefined });
  assert.equal(withoutName.filter((c) => c.type === 'name').length, 0);
});

test('candidatesFromCensus never emits gradient candidates', () => {
  const out = candidatesFromCensus(CENSUS);
  assert.ok(out.every((c) => (c.type as string) !== 'gradient'));
});

test('candidatesFromCensus carries source provenance onto every candidate', () => {
  const out = candidatesFromCensus(CENSUS, { maxColors: 1 });
  for (const c of out) {
    assert.equal(c.provenance.kind, 'site');
    assert.equal(c.provenance.label, 'acme.com');
  }
});

test('candidatesFromCensus produces stable ids across independent calls', () => {
  const a = candidatesFromCensus(CENSUS);
  const b = candidatesFromCensus(CENSUS);
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id));
});

// ─── Tray: add / dedupe / revive ────────────────────────────────────────────────

const colorCandidate = (hex: string, label = 'guidelines.pdf'): Candidate => ({
  id: `color-${hex}`,
  type: 'color',
  value: hex,
  provenance: { kind: 'pdf', label },
  state: 'pending',
});

test('add() dedupes on type+value case-insensitively and reports only the new ones', async () => {
  const { host } = fakeHost();
  const tray = createTray(host);
  await tray.load();

  const first = await tray.add([colorCandidate('#ABCDEF')]);
  assert.equal(first, 1);
  assert.equal(tray.list().length, 1);

  const dupe = await tray.add([colorCandidate('#abcdef')]);
  assert.equal(dupe, 0, 'same value, different case - not new');
  assert.equal(tray.list().length, 1);

  const mixed = await tray.add([colorCandidate('#abcdef'), colorCandidate('#123456')]);
  assert.equal(mixed, 1, 'one duplicate, one genuinely new');
  assert.equal(tray.list().length, 2);
});

test('re-adding a dismissed candidate revives it to pending', async () => {
  const { host } = fakeHost();
  const tray = createTray(host);
  await tray.load();

  await tray.add([colorCandidate('#ABCDEF')]);
  const [c] = tray.list();
  await tray.dismiss(c!.id);
  assert.equal(tray.list()[0]!.state, 'dismissed');

  const revived = await tray.add([colorCandidate('#abcdef')]);
  assert.equal(tray.list().length, 1, 'no second row - it is the same candidate');
  assert.equal(tray.list()[0]!.state, 'pending');
  assert.equal(revived, 1, 'coming back from dismissed counts as a new pending item');
});

test('add() leaves an already-added candidate untouched', async () => {
  const { host } = fakeHost();
  const tray = createTray(host);
  await tray.load();

  await tray.add([colorCandidate('#ABCDEF')]);
  await tray.markAdded(tray.list()[0]!.id);

  const again = await tray.add([colorCandidate('#abcdef')]);
  assert.equal(again, 0);
  assert.equal(tray.list()[0]!.state, 'added', 'markAdded is not undone by a rescan');
});

// ─── persistence ────────────────────────────────────────────────────────────────

test('state round-trips: a second Tray instance over the same store sees saved candidates', async () => {
  const { host, store } = fakeHost();
  const trayA = createTray(host);
  await trayA.load();
  await trayA.add([colorCandidate('#ABCDEF'), colorCandidate('#654321')]);
  await trayA.dismiss(trayA.list()[1]!.id);

  const trayB = createTray({ ...host, state: host.state } as HostV1);
  // trayB reads from the same underlying map (store is shared by fakeHost's closure).
  void store;
  await trayB.load();

  assert.equal(trayB.list().length, 2);
  const states = trayB.list().map((c) => c.state).sort();
  assert.deepEqual(states, ['dismissed', 'pending']);
});

test('every mutation persists before the returned promise resolves', async () => {
  const { host, store } = fakeHost();
  const tray = createTray(host);
  await tray.load();

  await tray.add([colorCandidate('#ABCDEF')]);
  assert.ok(store.has('start.tray.v1'));
  assert.equal((store.get('start.tray.v1') as { candidates: Candidate[] }).candidates.length, 1);

  await tray.markAdded(tray.list()[0]!.id);
  assert.equal((store.get('start.tray.v1') as { candidates: Candidate[] }).candidates[0]!.state, 'added');
});

// ─── clearSource ────────────────────────────────────────────────────────────────

test('clearSource removes only pending candidates from the matching provenance label', async () => {
  const { host } = fakeHost();
  const tray = createTray(host);
  await tray.load();

  await tray.add([
    colorCandidate('#111111', 'guidelines.pdf'),
    colorCandidate('#222222', 'guidelines.pdf'),
    colorCandidate('#333333', 'other.pdf'),
  ]);
  const guidelines = tray.list().filter((c) => c.provenance.label === 'guidelines.pdf');
  await tray.markAdded(guidelines[0]!.id); // one already committed - must survive the clear

  await tray.clearSource('guidelines.pdf');

  const remaining = tray.list();
  assert.equal(remaining.length, 2, 'the added one and the other-source one both survive');
  assert.ok(remaining.some((c) => c.value === '#111111' && c.state === 'added'));
  assert.ok(remaining.some((c) => c.value === '#333333'));
  assert.ok(!remaining.some((c) => c.value === '#222222'), 'the pending one from that source is gone');
});

// ─── subscribe ──────────────────────────────────────────────────────────────────

test('subscribe fires on every mutation and unsubscribe stops delivery', async () => {
  const { host } = fakeHost();
  const tray = createTray(host);
  await tray.load();

  let calls = 0;
  const unsubscribe = tray.subscribe(() => { calls++; });

  await tray.add([colorCandidate('#ABCDEF')]);
  assert.equal(calls, 1);
  await tray.markAdded(tray.list()[0]!.id);
  assert.equal(calls, 2);
  await tray.dismiss(tray.list()[0]!.id);
  assert.equal(calls, 3);

  unsubscribe();
  await tray.add([colorCandidate('#654321')]);
  assert.equal(calls, 3, 'no further delivery after unsubscribe');
});

test('load() does not itself notify subscribers', async () => {
  const { host } = fakeHost();
  const seedTray = createTray(host);
  await seedTray.load();
  await seedTray.add([colorCandidate('#ABCDEF')]);

  const tray = createTray(host);
  let calls = 0;
  tray.subscribe(() => { calls++; });
  await tray.load();
  assert.equal(calls, 0);
  assert.equal(tray.list().length, 1, 'the seeded candidate is still there, just quietly');
});
