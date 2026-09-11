// SPDX-License-Identifier: MPL-2.0
/**
 * input-policy.ts - the generic per-(tool,input) display-policy registry.
 *
 * Pure, DOM-free: proves the dormant default (empty ⇒ undefined, no cost),
 * per-tool namespacing, whole-set replacement semantics (a dropped input
 * unlocks, never goes stale), and that one tool's policy can't bleed into
 * another.
 *
 * Run directly:  node --test shells/web/src/lib/input-policy.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getInputPolicy, setToolInputPolicies, clearInputPolicies, _clearInputPoliciesForTests,
} from './input-policy.ts';

test('dormant by default: empty registry returns undefined for anything', () => {
  _clearInputPoliciesForTests();
  assert.equal(getInputPolicy('qr-code', 'url'), undefined);
  assert.equal(getInputPolicy(undefined, 'url'), undefined);
});

test('locked / choice / hidden round-trip, keyed per tool', () => {
  _clearInputPoliciesForTests();
  setToolInputPolicies('event-badge', {
    logo: { mode: 'locked', note: 'Managed by Acme', value: 'acme/logo' },
    accent: { mode: 'choice', note: 'Managed by Acme', allow: ['#0c322c', '#30ba78'] },
    discount: { mode: 'hidden' },
  });
  assert.deepEqual(getInputPolicy('event-badge', 'logo'), { mode: 'locked', note: 'Managed by Acme', value: 'acme/logo' });
  assert.equal(getInputPolicy('event-badge', 'accent')?.mode, 'choice');
  assert.deepEqual(getInputPolicy('event-badge', 'accent')?.allow, ['#0c322c', '#30ba78']);
  assert.equal(getInputPolicy('event-badge', 'discount')?.mode, 'hidden');
  assert.equal(getInputPolicy('event-badge', 'headline'), undefined, 'undeclared input has no policy');
});

test('attribution rides a policy as data, and is absent by default', () => {
  _clearInputPoliciesForTests();
  setToolInputPolicies('event-badge', {
    logo: { mode: 'locked', note: 'Managed by Acme', by: 'Brand guardrails', reason: 'One mark per campaign' },
    accent: { mode: 'choice', note: 'Managed by Acme', by: 'Brand guardrails', allow: ['#0c322c'] },
    headline: { mode: 'locked', note: 'Managed by Acme' },
  });
  // Structured, not a composed sentence: the registry stays product-neutral and
  // needs no i18n, and the view owns the wording it shows.
  assert.equal(getInputPolicy('event-badge', 'logo')?.by, 'Brand guardrails');
  assert.equal(getInputPolicy('event-badge', 'logo')?.reason, 'One mark per campaign');
  assert.equal(getInputPolicy('event-badge', 'accent')?.by, 'Brand guardrails');
  assert.equal(getInputPolicy('event-badge', 'accent')?.reason, undefined);
  // A policy that attributes nothing is the same object it was before the field
  // existed - which is what keeps an unattributed control rendering unchanged.
  assert.deepEqual(getInputPolicy('event-badge', 'headline'), { mode: 'locked', note: 'Managed by Acme' });
});

test('namespacing: a policy for one tool never bleeds into another', () => {
  _clearInputPoliciesForTests();
  setToolInputPolicies('tool-a', { logo: { mode: 'locked' } });
  assert.equal(getInputPolicy('tool-a', 'logo')?.mode, 'locked');
  assert.equal(getInputPolicy('tool-b', 'logo'), undefined);
});

test('whole-set replacement: a dropped input unlocks, never left stale', () => {
  _clearInputPoliciesForTests();
  setToolInputPolicies('t', { a: { mode: 'locked' }, b: { mode: 'hidden' } });
  assert.equal(getInputPolicy('t', 'a')?.mode, 'locked');
  setToolInputPolicies('t', { a: { mode: 'locked' } }); // b dropped
  assert.equal(getInputPolicy('t', 'a')?.mode, 'locked');
  assert.equal(getInputPolicy('t', 'b'), undefined, 'dropped input is unlocked, not stale');
});

test('an empty (or omitted) set removes a tool, restoring its dormant default', () => {
  _clearInputPoliciesForTests();
  setToolInputPolicies('t', { a: { mode: 'locked' } });
  setToolInputPolicies('t', {});
  assert.equal(getInputPolicy('t', 'a'), undefined);
});

test('clearInputPolicies restores the global dormant default', () => {
  setToolInputPolicies('x', { a: { mode: 'locked' } });
  clearInputPolicies();
  assert.equal(getInputPolicy('x', 'a'), undefined);
});
