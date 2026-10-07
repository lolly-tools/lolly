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
  onToolInputMount, notifyToolInputMount, policyValuesFor, governedParamKeys,
  setDocumentReadOnly, clearDocumentReadOnly, documentReadOnlyNote, setInputPolicyFailClosed, policyLocksControl,
  refuseDocumentEdit, guardDocumentEdits,
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

test('policyValuesFor: a locked value the model lacks, a choice outside its set, nothing else', () => {
  _clearInputPoliciesForTests();
  setToolInputPolicies('qr-code', {
    color: { mode: 'locked', value: '#30ba78' },
    size: { mode: 'locked' }, // the fail-closed shape: locked, no value to apply
    background: { mode: 'hidden' },
    shape: { mode: 'choice', allow: ['square', 'round'] },
    style: { mode: 'choice', allow: ['a', 'b'], value: 'b' },
    framing: { mode: 'locked', value: { zoom: 1, x: 0, y: 0 } },
  });
  const model = [
    { id: 'url', value: 'https://x' },
    { id: 'color', value: '#000000' },
    { id: 'size', value: 4 },
    { id: 'background', value: '#fff' },
    { id: 'shape', value: 'diamond' },
    { id: 'style', value: 'zzz' },
    { id: 'framing', value: { zoom: 1, x: 0, y: 0 } },
  ];
  assert.deepEqual(policyValuesFor('qr-code', model), {
    color: '#30ba78', // locked and different
    shape: 'square', // outside the set, no preferred value: the first allowed
    style: 'b', // outside the set, the policy's own value is allowed
  });
  // Already at the locked value, or inside the set: nothing to apply.
  assert.deepEqual(policyValuesFor('qr-code', [{ id: 'color', value: '#30ba78' }, { id: 'shape', value: 'round' }]), {});
  // No tool, or an ungoverned tool: empty, and cheap.
  assert.deepEqual(policyValuesFor(undefined, model), {});
  assert.deepEqual(policyValuesFor('poster', model), {});
  _clearInputPoliciesForTests();
});

test('governedParamKeys: locked and hidden inputs by id and alias, nothing for choice or editable', () => {
  _clearInputPoliciesForTests();
  setToolInputPolicies('qr-code', {
    color: { mode: 'locked', value: '#30ba78' },
    background: { mode: 'hidden' },
    shape: { mode: 'choice', allow: ['square'] },
  });
  const inputs = [
    { id: 'url', urlKey: 'u' },
    { id: 'color', urlKey: 'c' },
    { id: 'background' },
    { id: 'shape', urlKey: 's' },
  ];
  assert.deepEqual([...governedParamKeys('qr-code', inputs)].sort(), ['background', 'c', 'color']);
  assert.equal(governedParamKeys('poster', inputs).size, 0);
  assert.equal(governedParamKeys(undefined, inputs).size, 0);
  _clearInputPoliciesForTests();
});

test('tool-mount hook: silent when empty, runs per mount, replays a late registration, unregisters', () => {
  _clearInputPoliciesForTests();
  notifyToolInputMount('qr-code'); // nobody listening: nothing happens
  const seen: string[] = [];
  const off = onToolInputMount((id) => seen.push(id));
  assert.deepEqual(seen, ['qr-code'], 'a hook registered after the mount is replayed the open tool');
  notifyToolInputMount('event-badge');
  assert.deepEqual(seen, ['qr-code', 'event-badge']);
  off();
  notifyToolInputMount('poster');
  assert.deepEqual(seen, ['qr-code', 'event-badge'], 'an unregistered hook stays silent');
  _clearInputPoliciesForTests();
  onToolInputMount((id) => seen.push(id));
  assert.deepEqual(seen, ['qr-code', 'event-badge'], 'the test reset forgets the mounted tool: no replay');
  _clearInputPoliciesForTests();
});

test('tool-mount hook: a throwing hook is logged and never stops the mount or the next hook', () => {
  _clearInputPoliciesForTests();
  const errors: unknown[] = [];
  const orig = console.error;
  console.error = (e: unknown) => {
    errors.push(e);
  };
  try {
    notifyToolInputMount('poster');
    onToolInputMount(() => {
      throw new Error('boom');
    });
    const after: string[] = [];
    onToolInputMount((id) => after.push(id));
    notifyToolInputMount('chart');
    assert.deepEqual(after, ['poster', 'chart']);
  } finally {
    console.error = orig;
  }
  assert.equal(errors.length, 2, 'once on its replayed registration, once on the next mount');
  _clearInputPoliciesForTests();
});

// ── The document layer (plan 75 J5, G2/G19): a viewer's whole document read-only ──

test('document layer: every input of the tool reads locked and readable, and only that tool', () => {
  _clearInputPoliciesForTests();
  assert.equal(documentReadOnlyNote('poster'), null, 'dormant: no document is read-only');
  setDocumentReadOnly('poster', 'View only');
  for (const id of ['headline', 'logo', 'anything-at-all']) {
    assert.deepEqual(getInputPolicy('poster', id), { mode: 'locked', note: 'View only', readable: true });
  }
  assert.equal(policyLocksControl('text-input', getInputPolicy('poster', 'headline')), true);
  assert.equal(getInputPolicy('chart', 'title'), undefined, 'another tool is untouched');
  assert.equal(getInputPolicy(undefined, 'headline'), undefined);
  assert.equal(documentReadOnlyNote('poster'), 'View only');
  clearDocumentReadOnly('poster');
  assert.equal(getInputPolicy('poster', 'headline'), undefined, 'released, the dormant default again');
  clearDocumentReadOnly('poster');
  _clearInputPoliciesForTests();
});

test('document layer survives clearInputPolicies and a whole-set re-apply (the org-config re-read)', () => {
  _clearInputPoliciesForTests();
  setDocumentReadOnly('poster', 'View only');
  // What org/index.ts applyOrgToolPolicies does on every mount and every re-apply.
  clearInputPolicies();
  setToolInputPolicies('poster', { logo: { mode: 'locked', note: 'Managed by Acme', value: 'acme/logo' } });
  clearInputPolicies();
  setToolInputPolicies('poster', {});
  assert.equal(getInputPolicy('poster', 'headline')?.readable, true, 'the viewer lock is still there');
  _clearInputPoliciesForTests();
  assert.equal(getInputPolicy('poster', 'headline'), undefined, 'only the test reset (or its own setter) lifts it');
});

test('a governed lock still wins over the document layer; a governed choice does not', () => {
  _clearInputPoliciesForTests();
  setDocumentReadOnly('poster', 'View only');
  setToolInputPolicies('poster', {
    logo: { mode: 'locked', note: 'Managed by Acme', value: 'acme/logo' },
    secret: { mode: 'hidden' },
    accent: { mode: 'choice', note: 'Managed by Acme', allow: ['#111', '#222'] },
  });
  assert.deepEqual(getInputPolicy('poster', 'logo'), { mode: 'locked', note: 'Managed by Acme', value: 'acme/logo' });
  assert.deepEqual(getInputPolicy('poster', 'secret'), { mode: 'hidden' }, 'hidden stays hidden');
  assert.equal(getInputPolicy('poster', 'accent')?.readable, true, 'a viewer may not pick among allowed values either');
  clearInputPolicies();
  setInputPolicyFailClosed({ mode: 'locked', note: 'Policy unavailable' });
  assert.deepEqual(getInputPolicy('poster', 'headline'), { mode: 'locked', note: 'Policy unavailable' }, 'fail-closed governs first');
  _clearInputPoliciesForTests();
});

test('the document layer is not governance: model values, links and exports are untouched', () => {
  _clearInputPoliciesForTests();
  setDocumentReadOnly('poster', 'View only');
  const inputs = [{ id: 'headline', value: 'Hello', urlKey: 'h' }, { id: 'accent', value: '#999' }];
  assert.deepEqual(policyValuesFor('poster', inputs), {}, 'no value is rewritten for a viewer');
  assert.deepEqual([...governedParamKeys('poster', inputs)], [], 'a viewer\'s link and export carry every value');
  setToolInputPolicies('poster', {
    accent: { mode: 'choice', allow: ['#111', '#222'] },
    headline: { mode: 'locked', value: 'Fixed' },
  });
  assert.deepEqual(policyValuesFor('poster', inputs), { headline: 'Fixed', accent: '#111' }, 'governed values still apply under it');
  assert.deepEqual([...governedParamKeys('poster', inputs)].sort(), ['h', 'headline']);
  _clearInputPoliciesForTests();
});

test('an edit of a read-only document is refused, its owner told; another tool, or none, is not', () => {
  _clearInputPoliciesForTests();
  assert.equal(refuseDocumentEdit('poster'), false, 'dormant: nothing is refused');
  let told = 0;
  setDocumentReadOnly('poster', 'View only', () => { told += 1; });
  assert.equal(refuseDocumentEdit('poster'), true);
  assert.equal(refuseDocumentEdit('chart'), false, 'another tool writes as before');
  assert.equal(refuseDocumentEdit(undefined), false);
  assert.equal(told, 1);
  // A setter that throws never stops the refusal.
  setDocumentReadOnly('poster', 'View only', () => { throw new Error('toast failed'); });
  const errors: unknown[] = [];
  const realError = console.error;
  console.error = (e: unknown) => { errors.push(e); };
  try { assert.equal(refuseDocumentEdit('poster'), true); } finally { console.error = realError; }
  assert.equal(errors.length, 1);
  clearDocumentReadOnly('poster');
  assert.equal(refuseDocumentEdit('poster'), false, 'lifted');
  _clearInputPoliciesForTests();
});

test('guardDocumentEdits: writes pass until the document is read-only; undo replays always pass', async () => {
  _clearInputPoliciesForTests();
  const wrote: Array<[string, unknown]> = [];
  let replaying = false;
  let settled = 0;
  const setInput = guardDocumentEdits('poster', async (id: string, value: unknown) => { wrote.push([id, value]); }, () => replaying, () => { settled += 1; });
  await setInput('headline', 'A');
  setDocumentReadOnly('poster', 'View only');
  await setInput('headline', 'B');
  assert.deepEqual(wrote, [['headline', 'A']], 'the refused write never reaches the runtime');
  assert.equal(settled, 1, 'and whatever drew it is put back');
  replaying = true;
  await setInput('headline', 'A');
  assert.deepEqual(wrote.at(-1), ['headline', 'A'], 'an undo replays a state the document already had');
  replaying = false;
  clearDocumentReadOnly('poster');
  await setInput('headline', 'C');
  assert.deepEqual(wrote.at(-1), ['headline', 'C']);
  _clearInputPoliciesForTests();
});
