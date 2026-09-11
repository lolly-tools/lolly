// SPDX-License-Identifier: MPL-2.0
/**
 * collab-mount - the registry between a connected ceremony and the thing that makes it a
 * live session (plan 100 section 5, section 6.2a, section 11.17).
 *
 * What is worth pinning here is not "a setter sets": it is the RACE the parking surface
 * exists for. The acceptor arrives on `#/join` from a link, cold, with no tool view ever
 * having mounted - so a pairing can genuinely complete before anything has registered a
 * mount, and dropping it would cost two people a whole fresh ceremony (section 6.1). So:
 * dormant returns false and parks, a registrant takes it, and a late registrant can
 * still adopt what was parked.
 *
 * Run directly:
 *   node --test shells/web/src/lib/collab-mount.test.ts
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const {
  MAX_PARKED,
  _clearCollabMountForTests,
  deliverCollabConnection,
  getCollabMount,
  parkHandle,
  parkedCount,
  registerCollabMount,
  releaseParked,
  takeParked,
} = await import('./collab-mount.ts');

type CollabConnection = import('./collab-mount.ts').CollabConnection;

interface Fake extends CollabConnection {
  closes: () => number;
}

/**
 * A connection whose only real member is the `close()` that counts its own hang-ups.
 *
 * That IS the seam now: since wave 2.5 the connection carries a built session handle and
 * a transport-agnostic `close()` rather than an `RtcTransport`, so a fake needs neither a
 * peer connection nor a document to stand in for a live pair - which is the point of the
 * widening. Track A wraps its transport inside that close; Track B wraps its provider.
 */
function fake(label: string, role: CollabConnection['role'] = 'acceptor'): Fake {
  let closed = 0;
  const conn = {
    role,
    handle: { self: { clientId: label } } as unknown as CollabConnection['handle'],
    close: () => { closed += 1; },
    toolId: label,
    ephemeral: role === 'acceptor',
    closes: () => closed,
  };
  return conn as Fake;
}

beforeEach(() => { _clearCollabMountForTests(); });

test('dormant by default: nothing registered, nothing parked', () => {
  assert.equal(getCollabMount(), undefined);
  assert.equal(parkedCount(), 0);
  assert.deepEqual(takeParked(), []);
});

test('a registered mount takes the connection, and last registration wins', () => {
  const first: CollabConnection[] = [];
  const second: CollabConnection[] = [];
  registerCollabMount((c) => { first.push(c); });
  const off = registerCollabMount((c) => { second.push(c); });

  const conn = fake('qr-code');
  assert.equal(deliverCollabConnection(conn), true);
  assert.deepEqual(first, [], 'the replaced mount is not called');
  assert.equal(second.length, 1);
  assert.equal(parkedCount(), 0, 'a delivered connection is never also parked');

  off();
  assert.equal(getCollabMount(), undefined, 'unregister restores the dormant default');
});

test('unregister only clears its OWN registration', () => {
  const off = registerCollabMount(() => {});
  const later = (): void => {};
  registerCollabMount(later);
  off();
  assert.equal(getCollabMount(), later, 'a stale unregister must not clear the live mount');
});

test('with no mount the connection is parked, not dropped, and reported as unhandled', () => {
  const conn = fake('street-map');
  assert.equal(deliverCollabConnection(conn), false, 'the caller is told nobody took it');
  assert.equal(parkedCount(), 1);
  assert.equal(conn.closes(), 0, 'a parked connection stays LIVE - that is the whole point');
});

test('a late registrant adopts what was parked, and the drain is one-shot', () => {
  const early = fake('a');
  const later = fake('b');
  deliverCollabConnection(early);
  deliverCollabConnection(later);

  const adopted: CollabConnection[] = [];
  registerCollabMount((c) => { adopted.push(c); });
  // Registration deliberately does not drain by itself - the registrant decides when.
  assert.equal(parkedCount(), 2, 'registering does not fire re-entrantly during an import');

  for (const conn of takeParked()) void adopted.push(conn);
  assert.deepEqual(adopted.map((c) => c.toolId), ['a', 'b'], 'oldest first');
  assert.equal(parkedCount(), 0);
  assert.deepEqual(takeParked(), [], 'a second drain yields nothing');
});

test('parking is bounded, and an evicted connection is hung up rather than leaked', () => {
  const conns = [fake('1'), fake('2'), fake('3')];
  for (const c of conns) parkHandle(c);
  assert.equal(parkedCount(), MAX_PARKED);
  assert.equal(conns[0]!.closes(), 1, 'the evicted transport is closed - we hold it, so we can');
  assert.equal(conns[2]!.closes(), 0);
  assert.deepEqual(takeParked().map((c) => c.toolId), ['2', '3']);
});

test('the ceremony can hang up a pair nobody adopted, and only while it is still parked', () => {
  const conn = fake('unadopted');
  deliverCollabConnection(conn);
  assert.equal(parkedCount(), 1);

  assert.equal(releaseParked(conn), true, 'the ceremony that made it is the one that knows nobody is coming');
  assert.equal(conn.closes(), 1, 'a page saying "nothing else is being shared" has to be true');
  assert.equal(parkedCount(), 0);

  assert.equal(releaseParked(conn), false, 'idempotent: a second close is not a second hang-up');
  assert.equal(conn.closes(), 1);
});

test('releasing never hangs up a connection somebody owns', () => {
  const adopted = fake('adopted');
  deliverCollabConnection(adopted);
  const taken = takeParked();
  assert.deepEqual(taken, [adopted], 'the stitch now owns it');

  assert.equal(releaseParked(adopted), false, 'a drained connection is the adopter\'s, not ours to close');
  assert.equal(adopted.closes(), 0);

  const mounted = fake('mounted');
  registerCollabMount(() => {});
  deliverCollabConnection(mounted);
  assert.equal(releaseParked(mounted), false);
  assert.equal(mounted.closes(), 0, 'closing behind a live mount would kill the session it just started');
});

test('a throwing mount still counts as handled - it owns the connection from the call', () => {
  registerCollabMount(() => { throw new Error('the stitch is broken'); });
  const conn = fake('boom');
  assert.equal(deliverCollabConnection(conn), true);
  assert.equal(parkedCount(), 0, 're-parking would hand the same live transport to a second adopter');
});

test('a rejecting async mount does not surface as an unhandled rejection', async () => {
  registerCollabMount(async () => { throw new Error('late failure'); });
  assert.equal(deliverCollabConnection(fake('async')), true);
  await new Promise((resolve) => { setImmediate(resolve); });
});

test('the ephemeral flag says which side of section 6.2a this device is on', () => {
  assert.equal(fake('x', 'acceptor').ephemeral, true, "the acceptor's copy never lands in a slot");
  assert.equal(fake('x', 'inviter').ephemeral, false, 'the inviter owns the saved session');
});
