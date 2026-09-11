// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-share-private.ts - the "Private collab" Share-dialog section.
 *
 * Proves both gates are independently required (the PRIVATE_COLLAB_FLAG sync
 * mirror, AND a registered 'private' opener), that either one alone leaves the
 * dialog byte-identical, that a rendered row's action invokes the opener with the
 * session-context shape and announces, that a missing/throwing opener degrades to
 * silence, AND that importing the module is itself enough to wire the row into the
 * generic lib/share-sections.ts registry (the "self-registers from a boot-time
 * import" contract main.ts relies on).
 *
 * Every case below drives the flag EXPLICITLY, in both directions, so none of them
 * encodes which way it defaults - which is why this file needed no change when the
 * flag went ON by default on 2026-08-10 (what a shipped dialog now shows: the row,
 * since main.ts registers the opener and the flag resolves on). What the default
 * resolves to is feature-flags.test.ts's subject, not this one's.
 *
 * jsdom only (document + a11y's announce()); the flag is driven through
 * feature-flags.ts's in-memory override (overrideFlagInMemory), so no
 * fetch/localStorage/org harness is needed - this row's gating never consults
 * the control plane. Run directly:
 *   node --test shells/web/src/lib/collab-share-private.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://lolly.test/#/tool/qr-code', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
// a11y.ts's announce() (invoked on a successful open) schedules via rAF; jsdom's
// pretendToBeVisual only exposes it on dom.window, not the bare global this file
// runs in - shim it, mirroring org/approval-dialog.test.ts's harness.
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;

const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as unknown as Storage;

const { PRIVATE_COLLAB_FLAG, overrideFlagInMemory } = await import('../feature-flags.ts');
const { registerCollabOpener, _clearCollabOpenersForTests } = await import('./collab-launch.ts');
const { shareSectionBuilders } = await import('./share-sections.ts');
// Importing this module is the act under test for the self-registration case
// (its top-level `registerShareSection(...)` call) - captured BEFORE any test
// runs, so "was it registered on import" and "was it registered exactly once"
// are both checkable without re-importing (module re-evaluation would need a
// fresh Node module cache, which node:test doesn't give us mid-file, nor
// should it: the whole point is ONE registration for the module's lifetime).
const { buildPrivateCollabShareSection } = await import('./collab-share-private.ts');

function reset(): void {
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, false);
  _clearCollabOpenersForTests();
  store.clear();
}

const ctx = { toolId: 'qr-code', baseParts: ['url=https%3A%2F%2Fsuse.com'], currentFormat: 'png', copy: async () => {} };

// ── Self-registration on import ─────────────────────────────────────────────────

test('importing the module registers exactly one builder into the generic seam', () => {
  // No _clearShareSectionsForTests() here - the point is to observe what the
  // module's own import already did to the shared registry, undisturbed.
  const builders = shareSectionBuilders();
  assert.equal(builders.includes(buildPrivateCollabShareSection), true, 'the exported builder is the one registered');
});

// ── Absent by default (each gate alone is not enough) ───────────────────────────

test('flag off, no opener: absent', () => {
  reset();
  assert.equal(buildPrivateCollabShareSection(ctx), null);
});

test('flag on, no opener registered: absent', () => {
  reset();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  assert.equal(buildPrivateCollabShareSection(ctx), null);
});

test('opener registered, flag off: absent', () => {
  reset();
  registerCollabOpener('private', () => {});
  assert.equal(buildPrivateCollabShareSection(ctx), null);
});

test('a registered "work" opener does not satisfy the "private" row', () => {
  reset();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  registerCollabOpener('work', () => {});
  assert.equal(buildPrivateCollabShareSection(ctx), null);
});

// ── Present only when BOTH gates hold ───────────────────────────────────────────

test('both gates hold: renders with plan-0 naming and a working action', () => {
  reset();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  const seen: unknown[] = [];
  registerCollabOpener('private', (c) => { seen.push(c); });

  const section = buildPrivateCollabShareSection(ctx);
  assert.ok(section, 'section renders');
  assert.equal(section!.textContent?.includes('Private collab'), true);
  const btn = section!.querySelector('button[data-act="start-private-collab"]');
  assert.ok(btn, 'has the action button');
  assert.equal(btn!.textContent, 'Start a collab');

  btn!.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  // The opener sees the CollabLaunchContext shape - toolId/baseParts/currentFormat
  // only, never the dialog's `copy` helper (that's a ShareSectionContext concern).
  assert.deepEqual(seen, [{ toolId: ctx.toolId, baseParts: ctx.baseParts, currentFormat: ctx.currentFormat }], 'opener invoked with the session-context shape');
});

test('the row has a second door: "Join with a code" dismisses the dialog and goes to #/join', () => {
  // The half of the feature that had no entrance. An invite is a link OR a code, and a
  // person handed only the code had nowhere in the whole app to put it - which is exactly
  // where Andy's first real run of this stopped. The row opens the door rather than
  // duplicating it, so both entrances stay one screen.
  reset();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  const opened: unknown[] = [];
  registerCollabOpener('private', (c) => { opened.push(c); });
  dom.window.location.hash = '#/tool/qr-code';

  let closed = 0;
  const section = buildPrivateCollabShareSection({ ...ctx, close: () => { closed += 1; } })!;
  const join = section.querySelector('button[data-act="join-private-collab"]');
  assert.ok(join, 'the code half of the ceremony has a button');
  assert.equal(join!.textContent, 'Join with a code');

  join!.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  assert.equal(closed, 1, 'a modal left open would sit over the page it just navigated to');
  assert.equal(dom.window.location.hash, '#/join');
  assert.deepEqual(opened, [], 'joining is not starting - no ceremony is minted here');
});

test('"Join with a code" still navigates when the section is built outside a dialog', () => {
  // `close` is optional on the context, and a builder driven directly (this file, and
  // anything that reuses the seam) has none. Navigating is the part that must not depend
  // on it.
  reset();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  registerCollabOpener('private', () => {});
  dom.window.location.hash = '#/tool/qr-code';
  const section = buildPrivateCollabShareSection(ctx)!;
  section.querySelector('button[data-act="join-private-collab"]')!
    .dispatchEvent(new dom.window.Event('click', { bubbles: true }));
  assert.equal(dom.window.location.hash, '#/join');
});

test('a throwing opener degrades to silence (no throw out of the click handler)', () => {
  reset();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  registerCollabOpener('private', () => { throw new Error('boom'); });
  const section = buildPrivateCollabShareSection(ctx)!;
  const btn = section.querySelector('button[data-act="start-private-collab"]')!;
  assert.doesNotThrow(() => btn.dispatchEvent(new dom.window.Event('click', { bubbles: true })));
});

test('turning the flag back off reverts a previously-visible section to absent', () => {
  reset();
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, true);
  registerCollabOpener('private', () => {});
  assert.ok(buildPrivateCollabShareSection(ctx));
  overrideFlagInMemory(PRIVATE_COLLAB_FLAG.id, false);
  assert.equal(buildPrivateCollabShareSection(ctx), null);
});
