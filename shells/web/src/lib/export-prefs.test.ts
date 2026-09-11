// SPDX-License-Identifier: MPL-2.0
/**
 * export-prefs - the remembered export shape (plans/163 L3).
 *
 * Two things are worth pinning. The store must go through host.state under a slot
 * every session list already hides, and the precedence rule must never let a
 * remembered value beat something the user actually asked for: a URL param, a
 * resumed session or a manifest size driver all reach mergeExportPrefs already in
 * `base`, and `base` always wins.
 *
 * Run directly:  node --test shells/web/src/lib/export-prefs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExportPrefs } from './export-prefs.ts';
import { saveExportPrefs, loadExportPrefs, mergeExportPrefs } from './export-prefs.ts';
import { isHiddenSlot, XPREFS_SLOT_PREFIX } from './batch-slots.ts';

/** A host.state stand-in: the two methods this module touches, plus what it wrote. */
function fakeHost(seed: Record<string, object> = {}) {
  const store: Record<string, object> = { ...seed };
  return {
    store,
    state: {
      save: async (slot: string, data: object) => { store[slot] = data; },
      load: async (slot: string) => store[slot] ?? null,
    },
  };
}

// ── the store ────────────────────────────────────────────────────────────────

test('a saved shape round-trips, under a slot every session list hides', async () => {
  const host = fakeHost();
  await saveExportPrefs(host, 'qr-code', { format: 'png', width: 1080, height: 1080, unit: 'px', dpi: 300 });

  const slots = Object.keys(host.store);
  assert.deepEqual(slots, [`${XPREFS_SLOT_PREFIX}qr-code`]);
  assert.ok(isHiddenSlot(slots[0]), 'a preference must never render as a tile in Projects');

  assert.deepEqual(await loadExportPrefs(host, 'qr-code'),
    { format: 'png', width: 1080, height: 1080, unit: 'px', dpi: 300 });
});

test('a tool that has never been exported reads back null', async () => {
  assert.equal(await loadExportPrefs(fakeHost(), 'qr-code'), null);
});

test('a broken state bridge is survivable in both directions', async () => {
  const broken = { state: { save: async () => { throw new Error('no'); }, load: async () => { throw new Error('no'); } } };
  await saveExportPrefs(broken, 'qr-code', { format: 'png' });   // must not throw
  assert.equal(await loadExportPrefs(broken, 'qr-code'), null);
});

// ── the precedence rule ──────────────────────────────────────────────────────

test('remembered values fill defaults but lose to an explicit URL param', () => {
  const remembered = { format: 'png', width: 1080, height: 1080, unit: 'px', dpi: 300 };

  // Nothing explicit: the sheet opens on what was exported last.
  assert.deepEqual(
    mergeExportPrefs({ unit: 'px', dpi: 300 }, remembered, ['svg', 'png', 'pdf']),
    { unit: 'px', dpi: 300, format: 'png', width: 1080, height: 1080 },
  );

  // ?format=svg&w=512&h=512 - the link wins outright, on every field it named.
  assert.deepEqual(
    mergeExportPrefs({ format: 'svg', width: 512, height: 512, unit: 'px', dpi: 300 }, remembered, ['svg', 'png', 'pdf']),
    { format: 'svg', width: 512, height: 512, unit: 'px', dpi: 300 },
  );
});

test('the size fills as one shape, so a remembered unit cannot reinterpret an explicit width', () => {
  // A link says 800 (px, unstated); the last export was 210 x 297 mm. Taking the
  // remembered `unit` alone would turn that link into an 800 mm page.
  const out = mergeExportPrefs({ width: 800, unit: 'px', dpi: 300 } as ExportPrefs, { width: 210, height: 297, unit: 'mm', dpi: 150 }, ['pdf']);
  assert.equal(out.width, 800);
  assert.equal(out.unit, 'px');
  assert.equal(out.dpi, 300);
  assert.equal(out.height, undefined, 'half a remembered size is not a size');
});

test('a format the tool no longer offers is dropped, not carried', () => {
  assert.equal(mergeExportPrefs({} as ExportPrefs, { format: 'tiff' }, ['png', 'svg']).format, undefined);
  assert.equal(mergeExportPrefs({} as ExportPrefs, { format: 'png' }, ['png', 'svg']).format, 'png');
});

test('nothing remembered leaves the defaults exactly as they were', () => {
  const base = { format: 'svg', unit: 'px', dpi: 300 };
  assert.deepEqual(mergeExportPrefs(base, null, ['svg']), base);
});
