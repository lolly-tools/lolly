// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildAgentShareSection, agentInstructions } from './agent-share.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/t/design' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document });

test('Share offers a styled, labelled invitation with only the document permissions available', async () => {
  const created: string[] = [], copied: string[] = [];
  let revokeCount = 0;
  const section = buildAgentShareSection({ baseParts: [], copy: async text => { copied.push(text); }, document: () => ({ inputs: {}, agentInvitation: {
    canEdit: () => false, create: async permission => { created.push(permission); return { instructions: 'Document-specific invitation', expiresAt: Date.now() + 600_000 }; }, revoke: () => { revokeCount++; },
  } }) })!;
  document.body.appendChild(section);
  try {
    const select = section.querySelector('select')!;
    assert.equal(select.value, 'read'); assert.equal(select.options.length, 1);
    assert.ok(select.closest('label')!.textContent!.includes('Agent access'));
    assert.ok(select.classList.contains('field-select'), 'the access control uses the shell form primitive');
    for (const button of section.querySelectorAll('button')) assert.ok(button.classList.contains('btn'), 'every action uses the shared button');
    section.querySelector('button')!.click();
    assert.equal(section.querySelector('button')!.disabled, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(created, ['read']); assert.deepEqual(copied, ['Document-specific invitation']);
    assert.match(section.querySelector('[role="status"]')!.textContent!, /Instructions copied/);
    section.querySelectorAll('button')[1]!.click(); assert.equal(revokeCount, 1);
  } finally { section.remove(); }
});

test('saved documents offer no live invite, and instructions carry the supplied capability only', () => {
  assert.equal(buildAgentShareSection({ baseParts: [], copy: async () => {} }), null);
  const value = agentInstructions(`https://relay.example/live/invite#token=${'a'.repeat(43)}`, 'edit');
  assert.match(value, /invitation: https:\/\/relay.example\/live\/invite#token=/);
  assert.ok(value.includes(`https://relay.example/live/mcp with Authorization: Bearer ${'a'.repeat(43)}`));
  assert.match(value, /transactionId/); assert.match(value, /childIds/); assert.match(value, /\$in/);
  assert.match(value, /https:\/\/lolly.tools\/api\/mcp\/agents/);
  assert.match(value, /Pasting this invitation alone cannot install tools/);
  assert.match(value, /same invitation on every hosted tool call/);
  assert.match(agentInstructions('invitation', 'read'), /allows reading only/);
});
