// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { ProjectAgent, ProjectAgentInvitation, ProjectAgentsAPI, ProjectAgentList } from './project-agents.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/#/p' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location });
const { projectAgentsAPI, projectAgentInstructions } = await import('./project-agents.ts');
const { mountProjectAgentsPanel } = await import('./project-agents-panel.ts');
const secret = `lwa_${'a'.repeat(43)}`;
const entry: ProjectAgent = { id: 'pag_one', projectId: 'one', label: '<img src=x onerror=alert(1)>', role: 'editor', actingFor: 'Ana',
  createdBy: 'u1', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), connected: true, canRevoke: true };
const invitation: ProjectAgentInvitation = { agent: entry, endpoint: 'https://instance.test/api/workspace/mcp', secret };
const data: ProjectAgentList = { enabled: true, canInvite: true, canEdit: true, agents: [entry] };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('project API limits invitation data and uses the selected project routes', async () => {
  const requests: { url: string; method?: string; body?: unknown }[] = [];
  globalThis.fetch = (async (url, init) => {
    requests.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    return Response.json(init?.method === 'POST' ? invitation : { ...data, agents: [{ ...entry, secret, tokenHash: 'private' }, { ...entry, projectId: 'other' }] });
  }) as typeof fetch;
  const api = projectAgentsAPI('one');
  const listed = await api.list(); assert.deepEqual(listed.agents, [entry]); assert.equal(JSON.stringify(listed).includes(secret), false);
  assert.deepEqual(await api.create({ label: 'Partner', role: 'editor', hours: 24 }), invitation);
  await api.revoke('pag_one');
  assert.deepEqual(requests, [
    { url: '/api/v1/projects/one/agents', method: 'GET', body: undefined },
    { url: '/api/v1/projects/one/agents', method: 'POST', body: { label: 'Partner', role: 'editor', hours: 24 } },
    { url: '/api/v1/projects/one/agents/pag_one', method: 'DELETE', body: undefined },
  ]);
});

test('connection instructions reject a different workspace or a malformed secret', async () => {
  for (const changed of [{ endpoint: 'https://other.test/api/workspace/mcp' }, { endpoint: 'https://instance.test/api/workspace/mcp?extra=1' }, { secret: 'invalid' }]) {
    globalThis.fetch = (async () => Response.json({ ...invitation, ...changed })) as typeof fetch;
    await assert.rejects(projectAgentsAPI('one').create({ label: 'Partner', role: 'editor', hours: 24 }), /invalid/);
  }
  const instructions = projectAgentInstructions(invitation, 'Campaign');
  assert.match(instructions, /project and its subfolders/); assert.match(instructions, /requestId/); assert.match(instructions, /editing claims/);
  assert.match(instructions, /upload_asset_part/); assert.ok(instructions.includes(secret));
  assert.match(projectAgentInstructions({ ...invitation, agent: { ...entry, role: 'viewer' } }, 'Campaign'), /read-only/);
});

test('a delayed creation cannot reveal its key after leaving the project', async () => {
  let current = true, finish!: (response: Response) => void;
  globalThis.fetch = (() => new Promise(resolve => { finish = resolve; })) as typeof fetch;
  const api = projectAgentsAPI('one', () => current);
  const pending = api.create({ label: 'Partner', role: 'editor', hours: 1 });
  current = false; finish(Response.json(invitation)); await assert.rejects(pending, /closed/);
  await assert.rejects(api.list(), /closed/);
});

test('the panel shows names as text, copies a new invitation only on request, and revokes it', async () => {
  document.body.replaceChildren();
  let rows = data, copied = '', created: unknown, revoked = '';
  const api: ProjectAgentsAPI = { list: async () => rows, create: async input => { created = input; return invitation; }, revoke: async id => { revoked = id; rows = { ...data, agents: [{ ...entry, revokedAt: new Date().toISOString() }] }; } };
  const dispose = mountProjectAgentsPanel(document.body, { projectId: 'one', projectName: 'Campaign', api, copy: async text => { copied = text; return true; } });
  await tick();
  assert.equal(document.querySelector('img'), null); assert.match(document.body.textContent ?? '', /Connected · Acts for Ana/);
  assert.equal(document.querySelector('textarea'), null);
  document.querySelector<HTMLInputElement>('input[name=label]')!.value = 'Design partner';
  document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await tick();
  assert.deepEqual(created, { label: 'Design partner', role: 'editor', hours: 24 });
  assert.ok(document.querySelector<HTMLTextAreaElement>('textarea')!.value.includes(secret)); assert.equal(copied, '');
  [...document.querySelectorAll('button')].find(button => button.textContent === 'Copy agent instructions')!.click(); await tick(); assert.ok(copied.includes(secret));
  [...document.querySelectorAll('button')].find(button => button.textContent === 'Revoke invitation')!.click(); await tick();
  assert.equal(revoked, entry.id); assert.equal(document.querySelector('textarea'), null); assert.match(document.body.textContent ?? '', /Revoked/);
  dispose(); assert.equal(document.querySelector('.project-agents'), null);
});

test('viewers can invite only a viewer, and unavailable projects offer no creation form', async () => {
  for (const canInvite of [true, false]) {
    document.body.replaceChildren();
    const api: ProjectAgentsAPI = { list: async () => ({ ...data, canInvite, canEdit: false }), create: async () => invitation, revoke: async () => {} };
    const dispose = mountProjectAgentsPanel(document.body, { projectId: 'one', projectName: 'Campaign', api }); await tick();
    if (canInvite) assert.deepEqual([...document.querySelectorAll<HTMLSelectElement>('select[name=role] option')].map(option => option.value), ['viewer']);
    else assert.equal(document.querySelector('form'), null);
    dispose();
  }
});

test('unmounting while an invitation is being created discards the secret response', async () => {
  document.body.replaceChildren(); let finish!: (value: ProjectAgentInvitation) => void;
  const api: ProjectAgentsAPI = { list: async () => data, create: () => new Promise(resolve => { finish = resolve; }), revoke: async () => {} };
  const dispose = mountProjectAgentsPanel(document.body, { projectId: 'one', projectName: 'Campaign', api }); await tick();
  document.querySelector<HTMLInputElement>('input')!.value = 'Partner'; document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  dispose(); finish(invitation); await tick(); assert.equal(document.body.children.length, 0);
});
