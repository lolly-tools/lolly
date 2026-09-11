// SPDX-License-Identifier: MPL-2.0
/**
 * CONNECTOR_FLAGS - the per-provider kill switches behind /profile's Feature
 * flags cluster (2026-08-23). Two things worth pinning:
 *
 *  1. The gate is the REGISTRY, not the buttons: sendTargetsFor() drops a
 *     switched-off kind, so every "send to" surface (the export panel, the share
 *     sheet, export-home's auto-send) loses it in one move and no caller needs
 *     its own check. An unflagged kind (an instance-registered target) is never
 *     gated.
 *  2. Every built-in target HAS a switch. A new driver added to
 *     send-targets-builtin.ts without a flag would be an outbound destination
 *     the user cannot turn off, which is the whole point of the cluster - so the
 *     drift guard reads the real registration list rather than a copy of it.
 *
 * The in-memory override stands in for a stored choice (it outranks the mirror
 * and needs no localStorage), so this suite runs with no DOM at all.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/connector-flags.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { registerSendTarget, unregisterSendTarget, sendTargetsFor } from './send-target.ts';
import type { SendTarget } from './send-target.ts';
import { CONNECTOR_FLAGS, connectorEnabled, overrideFlagInMemory } from '../feature-flags.ts';

const mk = (kind: string): SendTarget => ({
  kind, label: kind, available: () => true, send: async () => ({ label: 'done' }),
});

test('every connector flag defaults ON, so behaviour is unchanged until someone opts out', () => {
  for (const f of CONNECTOR_FLAGS) {
    assert.notEqual(f.default, false, `${f.id} is opt-OUT, not opt-in`);
    assert.ok(f.connector, `${f.id} names the provider kind it gates`);
    assert.equal(f.id, `conn-${f.connector}`, 'the persisted key carries the kind');
    assert.ok(connectorEnabled(f.connector!), `${f.connector} is offered with nothing stored`);
  }
  const ids = CONNECTOR_FLAGS.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
});

test('switching a connector off withdraws it from the registry, so every send surface loses it', () => {
  registerSendTarget(mk('gdrive'));
  registerSendTarget(mk('mastodon'));
  try {
    assert.deepEqual(sendTargetsFor('png').map((t) => t.kind), ['gdrive', 'mastodon']);
    overrideFlagInMemory('conn-gdrive', false);
    assert.deepEqual(sendTargetsFor('png').map((t) => t.kind), ['mastodon'], 'only the one switched off goes');
    assert.equal(connectorEnabled('gdrive'), false, 'and the choke-point read agrees');
    overrideFlagInMemory('conn-gdrive', true);
    assert.deepEqual(sendTargetsFor('png').map((t) => t.kind), ['gdrive', 'mastodon'], 'back on with no reload');
  } finally {
    unregisterSendTarget('gdrive');
    unregisterSendTarget('mastodon');
  }
});

test('a kind with no flag (an instance-registered target) is never gated', () => {
  registerSendTarget(mk('instance-vault'));
  try {
    assert.equal(connectorEnabled('instance-vault'), true);
    assert.deepEqual(sendTargetsFor('svg').map((t) => t.kind), ['instance-vault']);
  } finally {
    unregisterSendTarget('instance-vault');
  }
});

test('a personal connector choice does not withdraw an organisation-owned target of the same kind', () => {
  registerSendTarget({ ...mk('gdrive'), id: 'org:archive', scope: 'organization', label: 'Archive' });
  try {
    overrideFlagInMemory('conn-gdrive', false);
    assert.deepEqual(sendTargetsFor('svg').map((t) => t.label), ['Archive']);
  } finally {
    overrideFlagInMemory('conn-gdrive', true);
    unregisterSendTarget('org:archive');
  }
});

test('every built-in send target has a kill switch (drift guard on the real registration list)', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const builtin = readFileSync(`${dir}send-targets-builtin.ts`, 'utf8');
  // One driver module per registered factory; each names its provider kind once,
  // as `const KIND = '…'` or (google-drive) the literal on the target itself.
  // The drivers are `await import()`ed off the boot graph (plans/155 Task 3.3), so
  // the module and the binding that registers it are in two separate lists - the
  // destructuring on the left of the Promise.all and the specifiers inside it.
  // Zip them positionally, which is the only thing that ties them together in the
  // source, then require each binding to actually reach registerSendTarget: a
  // module imported and never registered must not count towards the ≥8.
  const bindings = /const \[([\w,\s]+)\] = await Promise\.all\(\[/.exec(builtin)?.[1]
    ?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const specifiers = [...builtin.matchAll(/import\('\.\/([\w-]+)\.ts'\)/g)].map((m) => m[1]!);
  assert.equal(bindings.length, specifiers.length, 'every dynamically imported driver is bound');
  const modules = specifiers
    .filter((_, i) => new RegExp(`registerSendTarget\\(${bindings[i]}\\.`).test(builtin));
  assert.ok(modules.length >= 8, `found ${modules.length} built-in drivers`);
  const flagged = new Set(CONNECTOR_FLAGS.map((f) => f.connector));
  for (const mod of modules) {
    const src = readFileSync(`${dir}${mod}.ts`, 'utf8');
    const kind = /const KIND = '([\w-]+)'/.exec(src)?.[1] ?? /kind: '([\w-]+)'/.exec(src)?.[1];
    assert.ok(kind, `${mod}.ts names its provider kind`);
    assert.ok(flagged.has(kind!), `${mod}.ts (kind '${kind}') needs a CONNECTOR_FLAGS entry`);
  }
});

test('the other outbound enumerations resolve through the same gate, not their own copy', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  // sync-service: the provider picker AND the single remote-resolution point, so a
  // switched-off provider a previous session configured stops pushing too.
  const sync = readFileSync(`${dir}sync-service.ts`, 'utf8');
  assert.match(sync, /connectorEnabled\(kind\) && hasConnection\(kind\)/, 'the picker filters on the flag');
  assert.match(sync, /if \(!connectorEnabled\(kind\)\) return null;/, 'remoteFor refuses a switched-off kind');
  // export-home needs nothing of its own: it resolves its target via sendTargetsFor.
  const home = readFileSync(`${dir}export-home.ts`, 'utf8');
  assert.match(home, /sendTargetsFor\(exp\.format\)/, 'auto-send rides the gated registry');
  assert.ok(!home.includes('connectorEnabled'), 'so it carries no second check to drift');
});
