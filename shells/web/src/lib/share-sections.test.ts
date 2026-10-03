// SPDX-License-Identifier: MPL-2.0
/**
 * share-sections.ts (registry) + the pure share-link gating helpers from
 * src/org/share-links.ts.
 *
 * The registry: dormant by default (no builders ⇒ nothing to mount), register
 * returns a working unregister, builders iterate stably across un/registration.
 * The gating helpers: which instance rows a capability set permits, and the
 * baseParts → Links-API target split (format lifted out of params).
 *
 * Run directly:  node --test shells/web/src/lib/share-sections.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registerShareSection, shareSectionBuilders, shareSectionOrder, shareSectionPlacement, mountShareSection, _clearShareSectionsForTests,
} from './share-sections.ts';
import {
  instanceShareRows, hasInstanceShareRows, targetFromBaseParts,
} from '../org/share-links.ts';

// ── registry ──────────────────────────────────────────────────────────────────

test('registry is empty by default (the dialog stays byte-identical)', () => {
  _clearShareSectionsForTests();
  assert.equal(shareSectionBuilders().length, 0);
});

test('register returns a working unregister; iteration snapshot is stable', () => {
  _clearShareSectionsForTests();
  const b1 = () => null;
  const b2 = () => null;
  const off1 = registerShareSection(b1);
  registerShareSection(b2);
  assert.equal(shareSectionBuilders().length, 2);
  // A snapshot taken now is unaffected by a later unregister.
  const snap = shareSectionBuilders();
  off1();
  assert.equal(shareSectionBuilders().length, 1);
  assert.equal(snap.length, 2);
  assert.equal(shareSectionBuilders()[0], b2);
});

test('an ordering hint puts a section first; no hint keeps registration order', () => {
  _clearShareSectionsForTests();
  const a = () => null;
  const b = () => null;
  const team = () => null;
  registerShareSection(a);
  registerShareSection(b);
  assert.deepEqual(shareSectionBuilders(), [a, b]);
  registerShareSection(team, { order: -10 });
  assert.deepEqual(shareSectionBuilders(), [team, a, b]);
  assert.equal(shareSectionOrder(team), -10);
  assert.equal(shareSectionOrder(a), 0);
  _clearShareSectionsForTests();
});

test('placement is dormant by default; lead only when a section asks for it', () => {
  _clearShareSectionsForTests();
  const plain = () => null;
  const ordered = () => null;
  const lead = () => null;
  registerShareSection(plain);
  registerShareSection(ordered, { order: -5 });
  registerShareSection(lead, { placement: 'lead' });
  assert.equal(shareSectionPlacement(plain), 'after');
  assert.equal(shareSectionPlacement(ordered), 'after');
  assert.equal(shareSectionPlacement(lead), 'lead');
  // Placement does not change the order the builders run in.
  assert.deepEqual(shareSectionBuilders(), [ordered, plain, lead]);
  _clearShareSectionsForTests();
});

/** The few parts of an element the mount helper touches. */
function fakeHost() {
  const kids: object[] = [];
  return {
    get children() { return kids; },
    appendChild(n: object) { kids.push(n); return n; },
    insertBefore(n: object, ref: object) { kids.splice(kids.indexOf(ref), 0, n); return n; },
  };
}

test('mountShareSection places late arrivals by order, and equal orders append', () => {
  const host = fakeHost();
  const mount = (name: string, order?: number) => {
    const node = { name };
    mountShareSection(host as unknown as Element, node as unknown as HTMLElement, order);
  };
  mount('collab');
  mount('links');
  // The team section's module loads last, but the section still goes first.
  mount('team', -10);
  mount('late');
  assert.deepEqual(host.children.map((n) => (n as { name: string }).name), ['team', 'collab', 'links', 'late']);
});

// ── capability gating (pure) ────────────────────────────────────────────────────

test('instance rows follow the caller capability bits', () => {
  assert.deepEqual(instanceShareRows(undefined), { rendered: false, guest: false });
  assert.deepEqual(instanceShareRows({}), { rendered: false, guest: false });
  assert.deepEqual(instanceShareRows({ 'link.create': true }), { rendered: true, guest: false });
  assert.deepEqual(
    instanceShareRows({ 'link.create': true, 'link.create-guest': true }),
    { rendered: true, guest: true },
  );
  // guest-only (no ordinary link.create) still shows the section
  assert.deepEqual(instanceShareRows({ 'link.create-guest': true }), { rendered: false, guest: true });
});

test('the section renders iff at least one row is permitted', () => {
  assert.equal(hasInstanceShareRows(undefined), false);
  assert.equal(hasInstanceShareRows({ 'link.create': false, 'link.create-guest': false }), false);
  assert.equal(hasInstanceShareRows({ 'link.create': true }), true);
  assert.equal(hasInstanceShareRows({ 'link.create-guest': true }), true);
});

// ── baseParts → target (pure) ───────────────────────────────────────────────────

test('targetFromBaseParts lifts format out and decodes the rest into params', () => {
  const { params, format } = targetFromBaseParts(['url=https%3A%2F%2Fsuse.com', 'color=%230c322c', 'format=png']);
  assert.equal(format, 'png');
  assert.deepEqual(params, { url: 'https://suse.com', color: '#0c322c' });
});

test('targetFromBaseParts tolerates no format and skips malformed parts', () => {
  // decodeURIComponent leaves '+' as-is (it is not form-decoding) - assert the actual behaviour.
  const { params, format } = targetFromBaseParts(['title=Ship%20day', 'garbage', 'x=1']);
  assert.equal(format, undefined);
  assert.deepEqual(params, { title: 'Ship day', x: '1' });
});
