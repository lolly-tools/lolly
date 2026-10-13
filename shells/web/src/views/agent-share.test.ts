// SPDX-License-Identifier: MPL-2.0
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { buildAgentShareSection, agentInstructions, installAgentInvitations } from './agent-share.ts';
import { agentInvitationHost, type AgentInvitationHost } from '../lib/agent-invitation-host.ts';
import { agentRosterFor } from '../lib/agent-collaborators.ts';
import type { LiveEditor } from '../lib/live-agent.ts';
import { LIVE_PROTOCOL } from '@lolly-tools/core';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/t/design', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window) });

const tick = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

function share(host: AgentInvitationHost, copy: (text: string) => Promise<void> = async () => {}): HTMLElement {
  const section = buildAgentShareSection({ baseParts: [], copy, document: () => ({ inputs: {}, agentInvitation: host }) })!;
  document.body.appendChild(section);
  return section;
}

test('Share offers a styled, labelled invitation with only the document permissions available', async () => {
  const created: string[] = [], copied: string[] = [];
  let revokeCount = 0;
  const section = buildAgentShareSection({ baseParts: [], copy: async text => { copied.push(text); }, document: () => ({ inputs: {}, agentInvitation: {
    canEdit: () => false, create: async permission => { created.push(permission); return { instructions: 'Document-specific invitation', expiresAt: Date.now() + 600_000 }; }, revoke: () => { revokeCount++; },
  } }) })!;
  document.body.appendChild(section);
  try {
    assert.equal(section.tagName, 'DETAILS'); assert.ok(section.classList.contains('input-section'));
    assert.ok(section.querySelector('summary svg'), 'the invitation disclosure has an icon');
    const name = section.querySelector('input')!;
    assert.ok(name.closest('label')!.textContent!.includes('Agent name'));
    assert.ok(name.classList.contains('field-input')); assert.equal(name.maxLength, 60);
    const select = section.querySelector('select')!;
    assert.equal(select.value, 'read'); assert.equal(select.options.length, 1);
    assert.ok(select.closest('label')!.textContent!.includes('Agent access'));
    assert.ok(select.classList.contains('field-select'), 'the access control uses the shell form primitive');
    for (const button of section.querySelectorAll('button')) assert.ok(button.classList.contains('btn'), 'every action uses the shared button');
    section.querySelector('button')!.click();
    assert.equal(section.querySelector('button')!.disabled, true);
    await tick();
    assert.deepEqual(created, ['read']); assert.deepEqual(copied, ['Document-specific invitation']);
    assert.match(section.querySelector('[role="status"]')!.textContent!, /Instructions copied/);
    section.querySelectorAll('button')[1]!.click(); assert.equal(revokeCount, 1);
  } finally { section.remove(); }
});

test('the invited name is trimmed, bounded, and JSON-quoted as a client argument', () => {
  const name = '  Diagram "helper" \\\nnext line\t  ';
  const value = agentInstructions('invitation', 'edit', name);
  assert.match(value, /client: "Diagram \\"helper\\" \\\\ next line"/);
  assert.ok(!value.includes(name));
  assert.ok(agentInstructions('invitation', 'read', 'n'.repeat(100)).includes(`client: ${JSON.stringify(`${'n'.repeat(59)}…`)}`));
  assert.equal(agentInstructions('invitation', 'edit', ' \n\t '), agentInstructions('invitation', 'edit'));
});

test('name and read-access drafts survive a panel rebuild for one document and stay separate from another', async () => {
  const created: Array<{ permission: string; name?: string }> = [];
  const host: AgentInvitationHost = {
    canEdit: () => true,
    create: async (permission, name) => { created.push({ permission, name }); return { instructions: 'invitation', expiresAt: Date.now() + 600_000 }; },
    revoke() {},
  };
  let section = share(host);
  const name = section.querySelector('input')!;
  name.value = '  Diagram assistant  '; name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  const permission = section.querySelector('select')!;
  permission.value = 'read'; permission.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  section.remove(); section = share(host);
  try {
    assert.equal(section.querySelector('input')!.value, '  Diagram assistant  ');
    assert.equal(section.querySelector('select')!.value, 'read');
    section.querySelector('button')!.click(); await tick();
    assert.deepEqual(created, [{ permission: 'read', name: 'Diagram assistant' }]);
    const other = share({ ...host });
    try { assert.equal(other.querySelector('input')!.value, ''); assert.equal(other.querySelector('select')!.value, 'edit'); } finally { other.remove(); }
    section.querySelector('input')!.value = '  ';
    section.querySelector('button')!.click(); await tick();
    assert.deepEqual(created[1], { permission: 'read', name: undefined });
  } finally { section.remove(); }
});

test('a draft with edit access downgrades when the document becomes read-only', async () => {
  let canEdit = true;
  const created: string[] = [];
  const host: AgentInvitationHost = {
    canEdit: () => canEdit,
    create: async permission => { created.push(permission); return { instructions: 'invitation', expiresAt: 0 }; },
    revoke() {},
  };
  let section = share(host);
  assert.equal(section.querySelector('select')!.value, 'edit');
  section.querySelector('input')!.value = 'Reviewer'; section.querySelector('input')!.dispatchEvent(new dom.window.Event('input'));
  section.remove(); canEdit = false; section = share(host);
  try {
    assert.equal(section.querySelector('input')!.value, 'Reviewer');
    const select = section.querySelector('select')!;
    assert.equal(select.value, 'read'); assert.equal(select.options.length, 1); assert.equal(select.options[0]!.value, 'read');
    section.querySelector('button')!.click(); await tick(); assert.deepEqual(created, ['read']);
  } finally { section.remove(); }
});

test('clipboard errors leave a retry available and closing or revoking skips pending clipboard writes', async () => {
  let copies = 0, resolve: (value: { instructions: string; expiresAt: number }) => void = () => {};
  let pending = false;
  const host: AgentInvitationHost = {
    canEdit: () => true,
    create: () => pending ? new Promise(done => { resolve = done; }) : Promise.resolve({ instructions: 'invitation', expiresAt: 0 }),
    revoke() {},
  };
  const section = share(host, async () => { copies++; throw new Error('Clipboard blocked'); });
  try {
    const copy = section.querySelector('button')!;
    copy.click(); await tick();
    assert.equal(copy.disabled, false); assert.equal(section.querySelector('[role="status"]')!.textContent, 'Clipboard blocked');
    pending = true; copy.click(); section.querySelectorAll('button')[1]!.click();
    resolve({ instructions: 'invitation', expiresAt: 0 }); await tick();
    assert.equal(copies, 1); assert.equal(copy.disabled, false); assert.equal(section.querySelector('[role="status"]')!.textContent, 'Agent invitations ended.');
    copy.click(); section.remove(); resolve({ instructions: 'invitation', expiresAt: 0 }); await tick();
    assert.equal(copies, 1);
  } finally { section.remove(); }
});

function invitationFixture(context: TestContext, readOnly = false, attachImmediately = true) {
  const sockets: EditorSocket[] = [];
  class EditorSocket extends EventTarget {
    static OPEN = 1;
    readyState = 1;
    reply: (text: string) => void = () => {};
    constructor() { super(); sockets.push(this); queueMicrotask(() => this.dispatchEvent(new Event('open'))); }
    attach(): void { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'attached', documentId: 'doc:share' }) })); }
    send(text: string): void {
      if (JSON.parse(text).editorToken) { if (attachImmediately) queueMicrotask(() => this.attach()); }
      else this.reply(text);
    }
    close(): void { this.readyState = 3; this.dispatchEvent(new Event('close')); }
    async call(method: string, params = {}) {
      const response = new Promise<string>(done => { this.reply = done; });
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }));
      return JSON.parse(await response);
    }
  }
  const previous = globalThis.WebSocket;
  globalThis.WebSocket = EditorSocket as unknown as typeof WebSocket;
  context.after(() => { globalThis.WebSocket = previous; });
  const permissions: string[] = [];
  context.mock.method(globalThis, 'fetch', async (_url: unknown, options: RequestInit) => {
    permissions.push((JSON.parse(options.body as string) as { permission: string }).permission);
    return new Response(JSON.stringify({ token: 'a'.repeat(43), editorToken: 'b'.repeat(43), expiresAt: Date.now() + 600_000 }), { status: 201 });
  });
  const runtime = {}, view = document.createElement('main'); view.className = 'tool-stage'; document.body.appendChild(view);
  const editor: LiveEditor = { documentId: 'doc:share', tool: 'design', engine: 'test', surface: 'web', rows: () => [], selection: () => [], size: () => ({ width: 100, height: 100 }), fieldDefault: (_id, fallback) => fallback, commit: async () => null, topEntry: () => null, undo() {}, look: async () => ({ svg: '<svg/>', width: 100, height: 100 }), readOnly: () => readOnly };
  const dispose = installAgentInvitations(runtime, view, 'https://relay.example/live', () => editor);
  context.after(() => { dispose(); view.remove(); });
  return { host: agentInvitationHost(runtime)!, view, sockets, permissions, dispose };
}

test('the invited alias joins People, regardless of a client self-report, and revocation removes it', async context => {
  const fixture = invitationFixture(context);
  const named = await fixture.host.create('edit', '  Diagram assistant  ');
  assert.ok(named.instructions.includes('client: "Diagram assistant"'));
  assert.equal((await fixture.sockets[0]!.call('hello', { protocol: LIVE_PROTOCOL, client: 'Other client' })).error, undefined);
  assert.equal(agentRosterFor(fixture.view).local()[0]!.name, 'Diagram assistant');
  assert.equal((await fixture.sockets[0]!.call('hello', { protocol: LIVE_PROTOCOL, client: 'Changed name' })).error, undefined);
  assert.equal(agentRosterFor(fixture.view).local()[0]!.name, 'Diagram assistant');
  fixture.host.revoke(); assert.equal(agentRosterFor(fixture.view).local().length, 0);
  assert.equal(fixture.sockets[0]!.readyState, 3);
  const unnamed = await fixture.host.create('edit', ' \n ');
  assert.ok(unnamed.instructions.includes('Give your name in client'));
  await fixture.sockets[1]!.call('hello', { protocol: LIVE_PROTOCOL, client: 'Client name' });
  assert.equal(agentRosterFor(fixture.view).local()[0]!.name, 'Client name');
});

test('named invitations retain read grants, the four-invitation limit, and document disposal', async context => {
  const fixture = invitationFixture(context, true);
  await assert.rejects(fixture.host.create('edit', 'Reader'), /allows reading only/);
  const invitation = await fixture.host.create('read', 'Reader');
  assert.ok(invitation.instructions.includes('allows reading only')); assert.ok(!invitation.instructions.includes('Use lolly_live_apply'));
  await fixture.sockets[0]!.call('hello', { protocol: LIVE_PROTOCOL, client: 'Reader' });
  assert.match((await fixture.sockets[0]!.call('document.apply', { layerPatches: [{ id: 'missing', set: { text: 'Edit' } }] })).error.message, /read-only/);
  for (let i = 1; i < 4; i++) await fixture.host.create('read', `Reader ${i}`);
  await assert.rejects(fixture.host.create('read', 'Fifth'), /Four agent invitations/);
  assert.deepEqual(fixture.permissions, ['read', 'read', 'read', 'read']);
  fixture.dispose(); assert.equal(agentRosterFor(fixture.view).local().length, 0);
  assert.ok(fixture.sockets.every(socket => socket.readyState === 3));
  await assert.rejects(fixture.host.create('read', 'Closed'), /document has closed/);
});

test('a named invitation finishing after revocation or document disposal cannot reconnect', async context => {
  const fixture = invitationFixture(context, false, false);
  const first = fixture.host.create('edit', 'Revoked');
  const revoked = assert.rejects(first, /invitation ended/);
  await tick(); fixture.host.revoke(); fixture.sockets[0]!.attach(); await revoked;
  assert.equal(fixture.sockets[0]!.readyState, 3);
  const second = fixture.host.create('edit', 'Closed');
  const disposed = assert.rejects(second, /invitation ended/);
  await tick(); fixture.dispose(); fixture.sockets[1]!.attach(); await disposed;
  assert.equal(fixture.sockets[1]!.readyState, 3);
  assert.equal(agentRosterFor(fixture.view).local().length, 0);
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
