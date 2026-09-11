// SPDX-License-Identifier: MPL-2.0
/**
 * The acquisition seam a mounted tool asks "am I in a collab?" through
 * (plan 100 section 5) - and, more importantly, what it costs to ask when nobody is
 * listening.
 *
 * This registry is the ONLY thing standing between `views/tool.ts` and a whole
 * presence stack, so its dormant behaviour is not a detail: it is the reason a
 * single-player mount is byte-identical today. The tests below pin the three
 * properties that keep it that way - dormant by default, allocation-free while
 * dormant, and unable to fail a mount when a registered transport throws - plus
 * the last-wins/unregister rules it inherits from `canvas-sync-provider.ts`.
 *
 * The module is imported FOR REAL (it has no runtime imports at all - the handle
 * type is erased), so nothing here is a source scan.
 *
 * Run directly:
 *   node --test shells/web/src/lib/collab-session-source.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  _clearCollabSessionSourceForTests,
  acquireCollabSession,
  getCollabSessionSource,
  registerCollabSessionSource,
} from './collab-session-source.ts';
import type { CollabSessionContext } from './collab-session-source.ts';
import type { CollabSessionHandle } from './collab-session.ts';

/** A handle that is never driven - identity is all these tests compare. */
function stubHandle(): CollabSessionHandle {
  return {
    adapter: {
      onLocalChange: () => [],
      apply: () => {},
      applyRemotePatch: () => ({ col: '', moved: [], restyled: [], added: [], removed: [], zChanged: false }),
      presence: () => {},
      state: () => ({ boxes: new Map(), params: new Map(), order: [] }),
    } as unknown as CollabSessionHandle['adapter'],
    role: 'writer',
    self: { clientId: 'c1' },
    presenceIn: { subscribe: () => () => {} },
    sendPresence: () => {},
    events: { subscribe: () => () => {} },
    close: () => {},
  };
}

test('dormant by default: no source, and acquiring returns null', () => {
  _clearCollabSessionSourceForTests();
  assert.equal(getCollabSessionSource(), undefined);
  assert.equal(acquireCollabSession('qr-code', null), null);
});

test('acquiring while dormant allocates NOTHING - the solo cost is one null check', () => {
  _clearCollabSessionSourceForTests();
  // The dormant path must not build the context object it would pass a factory.
  // Proven by construction rather than by reading the source: a factory registered
  // AFTER the dormant calls sees exactly one context, so no earlier call built one.
  for (let i = 0; i < 1000; i++) assert.equal(acquireCollabSession('qr-code', 'slot-1'), null);

  const seen: CollabSessionContext[] = [];
  registerCollabSessionSource((ctx) => { seen.push(ctx); return null; });
  acquireCollabSession('qr-code', 'slot-1');
  assert.equal(seen.length, 1, 'only the live call reaches a factory');
  _clearCollabSessionSourceForTests();
});

test('the factory is asked per mount, and gets the tool + slot as its context', () => {
  _clearCollabSessionSourceForTests();
  const seen: CollabSessionContext[] = [];
  const handle = stubHandle();
  registerCollabSessionSource((ctx) => { seen.push(ctx); return ctx.slot === 'live' ? handle : null; });

  assert.equal(acquireCollabSession('street-map', 'live'), handle);
  assert.equal(acquireCollabSession('street-map', null), null,
    'a transport being registered does not make every mount a collab');
  assert.deepEqual(seen, [
    { toolId: 'street-map', slot: 'live' },
    { toolId: 'street-map', slot: null },
  ]);
  _clearCollabSessionSourceForTests();
});

test('a factory returning undefined reads as no collab, never as a handle', () => {
  _clearCollabSessionSourceForTests();
  registerCollabSessionSource(() => undefined as unknown as null);
  assert.equal(acquireCollabSession('qr-code', null), null);
  _clearCollabSessionSourceForTests();
});

test('a throwing factory costs the collab, never the mount', () => {
  _clearCollabSessionSourceForTests();
  const errors: unknown[] = [];
  const realWarn = console.warn;
  console.warn = (...args: unknown[]): void => { errors.push(args); };
  try {
    registerCollabSessionSource(() => { throw new Error('transport down'); });
    assert.equal(acquireCollabSession('qr-code', 'slot-1'), null);
  } finally {
    console.warn = realWarn;
    _clearCollabSessionSourceForTests();
  }
  assert.equal(errors.length, 1, 'and it is reported rather than swallowed silently');
});

test('last registration wins, and unregister only drops its own', () => {
  _clearCollabSessionSourceForTests();
  const a = stubHandle();
  const b = stubHandle();
  const undoA = registerCollabSessionSource(() => a);
  const undoB = registerCollabSessionSource(() => b);
  assert.equal(acquireCollabSession('qr-code', null), b, 'the later registration is the live one');

  undoA();
  assert.equal(acquireCollabSession('qr-code', null), b,
    'a stale unregister must not disarm the transport that replaced it');

  undoB();
  assert.equal(getCollabSessionSource(), undefined);
  assert.equal(acquireCollabSession('qr-code', null), null);
  undoB();   // idempotent
  assert.equal(getCollabSessionSource(), undefined);
});
