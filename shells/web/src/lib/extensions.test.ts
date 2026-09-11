// SPDX-License-Identifier: MPL-2.0
/**
 * extensions.ts - the chrome extension slot registry + mount + governance.
 *
 * Proves the acceptance criterion - DORMANCY - and the hydration/governance
 * contract that Apply and future consumers code against:
 *   - empty slot renders nothing (el untouched, no-op disposer);
 *   - registering then mounting works, and the disposer tears down;
 *   - governance default = empty (community needs an opt-in; core default deny);
 *   - control-plane precedence over community in a single slot;
 *   - fail-closed refusals (unknown slot, stale contract);
 *   - a throwing mount degrades to empty, never the chrome;
 *   - the inert injection hook is absent until installed.
 *
 * DOM-free by construction: cost-authoring is a `single` slot, so mountSlot uses
 * the passed element directly and never touches `document`. A tiny fake element
 * records whether it was touched - the dormancy assertion.
 *
 * Run directly:  node --test shells/web/src/lib/extensions.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerExtension, mountSlot, extensionsFor, resolveSlot,
  setSlotGovernance, setSlotOptIn, _clearExtensionsForTests,
} from './extensions.ts';
import { installExtensionHost, isExtensionHostInstalled, _resetExtensionHostForTests } from '../ext/host.ts';
import { SLOT_REGISTRY, type Extension } from '@lolly-tools/core/extension-v1';

const SLOT = 'cost-authoring' as const;

/** A fake mount target: records whether any child mutation touched it. */
function fakeEl(): HTMLElement & { touched(): boolean } {
  let touched = false;
  const kids: unknown[] = [];
  return {
    touched: () => touched,
    appendChild(n: unknown) { touched = true; kids.push(n); return n; },
    replaceChildren(...n: unknown[]) { touched = true; kids.length = 0; kids.push(...n); },
  } as unknown as HTMLElement & { touched(): boolean };
}

/** A minimal extension that marks a shared flag when it mounts. */
function markingExt(id: string, marks: string[]): Extension<unknown, HTMLElement> {
  return { id, slot: SLOT, mount() { marks.push(id); } };
}

test('SLOT_REGISTRY registers the cost-authoring slot as single', () => {
  const s = SLOT_REGISTRY.find(m => m.id === SLOT);
  assert.ok(s, 'cost-authoring present');
  assert.equal(s!.cardinality, 'single');
});

test('dormant by default: empty slot renders nothing, no-op disposer, el untouched', async () => {
  _clearExtensionsForTests();
  const el = fakeEl();
  const dispose = await mountSlot(SLOT, el, {});
  assert.equal(el.touched(), false, 'element untouched');
  assert.equal(typeof dispose, 'function');
  assert.doesNotThrow(() => dispose());
  assert.deepEqual(extensionsFor(SLOT), []);
});

test('governance default = empty for a community provenance', () => {
  _clearExtensionsForTests();
  assert.deepEqual(resolveSlot(SLOT, 'community', 'community:x'), { enabled: false, reason: 'core-default' });
});

test('register then mount hydrates; disposer tears down', async () => {
  _clearExtensionsForTests();
  const marks: string[] = [];
  let disposed = false;
  const unregister = registerExtension(
    { id: 'lolly-work:cost-authoring', slot: SLOT, mount() { marks.push('mounted'); return () => { disposed = true; }; } },
    'control-plane',
  );
  assert.equal(extensionsFor(SLOT).length, 1);
  const dispose = await mountSlot(SLOT, fakeEl(), {});
  assert.deepEqual(marks, ['mounted']);
  dispose();
  assert.equal(disposed, true, 'disposer ran');
  unregister();
  assert.deepEqual(extensionsFor(SLOT), []);
});

test('community extension is dormant without an opt-in, hydrates with one', async () => {
  _clearExtensionsForTests();
  const marks: string[] = [];
  registerExtension(markingExt('community:acme', marks), 'community');
  // No opt-in signal → not enabled → nothing mounts.
  await mountSlot(SLOT, fakeEl(), {});
  assert.deepEqual(marks, []);
  assert.equal(resolveSlot(SLOT, 'community', 'community:acme').enabled, false);
  // Deployer opts it in → it hydrates.
  setSlotOptIn(() => true);
  await mountSlot(SLOT, fakeEl(), {});
  assert.deepEqual(marks, ['community:acme']);
  assert.equal(resolveSlot(SLOT, 'community', 'community:acme').reason, 'deployer');
});

test('control-plane governance can veto an opted-in community extension', () => {
  _clearExtensionsForTests();
  setSlotOptIn(() => true);
  setSlotGovernance((_s, ch) => (ch === 'community' ? false : undefined));
  assert.deepEqual(resolveSlot(SLOT, 'community', 'community:acme'), { enabled: false, reason: 'control-plane' });
});

test('control-plane out-ranks community in a single slot', async () => {
  _clearExtensionsForTests();
  setSlotOptIn(() => true); // both channels enabled
  const marks: string[] = [];
  registerExtension(markingExt('community:acme', marks), 'community');
  registerExtension(markingExt('lolly-work:cost', marks), 'control-plane');
  await mountSlot(SLOT, fakeEl(), {});
  assert.deepEqual(marks, ['lolly-work:cost'], 'only the control-plane extension mounts');
});

test('refuses an unknown slot and a stale contract range (fail closed)', () => {
  _clearExtensionsForTests();
  const badSlot = { id: 'x', slot: 'nope' as never, mount() {} } as Extension<unknown, HTMLElement>;
  registerExtension(badSlot, 'control-plane');
  const stale = { id: 'y', slot: SLOT, contract: '>=2.0.0', mount() {} } as Extension<unknown, HTMLElement>;
  registerExtension(stale, 'control-plane');
  assert.deepEqual(extensionsFor(SLOT), [], 'neither reached the registry');
});

test('a throwing mount degrades to empty and never breaks the chrome', async () => {
  _clearExtensionsForTests();
  const el = fakeEl();
  registerExtension({ id: 'lolly-work:boom', slot: SLOT, mount() { throw new Error('boom'); } }, 'control-plane');
  await assert.doesNotReject(() => mountSlot(SLOT, el, {}));
});

test('injection hook is inert until installed', () => {
  _resetExtensionHostForTests();
  const g = globalThis as unknown as { lolly?: { registerExtension?: unknown } };
  assert.equal(isExtensionHostInstalled(), false);
  assert.equal(g.lolly?.registerExtension, undefined);
  installExtensionHost();
  assert.equal(isExtensionHostInstalled(), true);
  assert.equal(typeof g.lolly!.registerExtension, 'function');
  _resetExtensionHostForTests();
});
