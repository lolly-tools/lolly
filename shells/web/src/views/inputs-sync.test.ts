// SPDX-License-Identifier: MPL-2.0
/**
 * inputs-sync - the sidebar rebuild-skip decision. Driven with plain stubs (no DOM
 * globals), exactly as the module is designed for: every containment/focus check is
 * a feature-tested `closest`/`contains`, so a stub reports honestly.
 *
 * Run directly:  node --test shells/web/src/views/inputs-sync.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSkipInputsRebuild, type SyncableInput } from './inputs-sync.ts';

/** A stub panel element whose activeElement + contains/closest we control. */
function panel(opts: {
  active?: { dataset?: Record<string, string>; tagName?: string; type?: string; closest?: (s: string) => unknown } | null;
  contains?: boolean;
}): any {
  return {
    ownerDocument: { activeElement: opts.active ?? null },
    contains: () => opts.contains ?? false,
    // querySelector is only reached by domReflectsValue for simple controls; the
    // grid/table cases never get there, so a null-returning stub is enough.
    querySelector: () => null,
  };
}

const model = (v: unknown): SyncableInput[] => [
  { id: 'data', value: v as SyncableInput['value'], control: 'table' as SyncableInput['control'] },
];

test('a change to a table input normally forces a full rebuild', () => {
  // No field focused: the table control is structural, so any value change rebuilds.
  const el = panel({ active: null });
  assert.equal(canSkipInputsRebuild(el, model([1]), model([2])), false);
});

test('focus inside a virtualized grid (sidebar) defers the rebuild', () => {
  const active = { closest: (s: string) => (s === '.table-vgrid' ? {} : null) };
  const el = panel({ active, contains: true });   // grid lives inside the sidebar
  assert.equal(canSkipInputsRebuild(el, model([1]), model([2])), true);
});

test('focus inside a POPPED-OUT grid defers even though it is outside the sidebar', () => {
  const active = {
    closest: (s: string) => (s === '.table-vgrid' || s === '.floatp .table-input' ? {} : null),
  };
  const el = panel({ active, contains: false });   // popped panel is NOT inside #tool-inputs
  assert.equal(canSkipInputsRebuild(el, model([1]), model([2])), true);
});

test('a grid that is neither in the sidebar nor a panel does not defer', () => {
  // .table-vgrid matches but it is detached (not contained, not popped) - be safe.
  const active = { closest: (s: string) => (s === '.table-vgrid' ? {} : null) };
  const el = panel({ active, contains: false });
  assert.equal(canSkipInputsRebuild(el, model([1]), model([2])), false);
});
