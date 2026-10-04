// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { CollabInviteLinks } from '../lib/collab-session.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location,
  requestAnimationFrame: (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0) });
let copied: string[] = [], clipboardWorks = true;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async (url: string) => {
  if (!clipboardWorks) throw Error('clipboard denied'); copied.push(url);
} } } });
const { mountInviteLinkControl } = await import('./invite-link-control.ts');
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
function mount(capability: CollabInviteLinks) {
  document.body.replaceChildren(); copied = []; clipboardWorks = true;
  const host = document.createElement('div'); document.body.append(host);
  return { host, clear: mountInviteLinkControl(host, capability) };
}

test('the role selected beside Copy is the role granted by the reusable link', async () => {
  const roles: string[] = [], f = mount({ roles: async () => ['editor', 'viewer'], create: async role => {
    roles.push(role); return { url: `https://instance.test/l/join/${role}?s=signed`, allowNewPeople: false };
  } });
  try {
    await settle(); const select = f.host.querySelector('select')!; select.value = 'viewer'; select.dispatchEvent(new dom.window.Event('change'));
    f.host.querySelector<HTMLButtonElement>('button')!.click(); await settle();
    assert.deepEqual(roles, ['viewer']); assert.deepEqual(copied, ['https://instance.test/l/join/viewer?s=signed']);
    assert.equal(f.host.querySelector('[role="status"]')!.textContent, 'Link copied');
  } finally { f.clear(); }
});

test('a refused clipboard leaves a selectable URL and never announces a successful copy', async () => {
  const url = 'https://instance.test/l/join/viewer?s=signed', f = mount({ roles: async () => ['viewer'], create: async () => ({ url, allowNewPeople: true }) });
  try {
    clipboardWorks = false; await settle(); f.host.querySelector<HTMLButtonElement>('button')!.click(); await settle();
    const fallback = f.host.querySelector<HTMLInputElement>('.invite-link-fallback')!;
    assert.equal(fallback.hidden, false); assert.equal(fallback.value, url); assert.equal(document.activeElement, fallback);
    assert.equal(f.host.querySelector('[role="status"]')!.textContent, 'Could not copy link'); assert.deepEqual(copied, []);
  } finally { f.clear(); }
});

test('losing management access hides invitation controls after a fresh server refusal', async () => {
  let manager = true;
  const f = mount({ roles: async () => manager ? ['editor', 'viewer'] : [], create: async () => { manager = false; throw Error('forbidden'); } });
  try {
    await settle(); f.host.querySelector<HTMLButtonElement>('button')!.click(); await settle();
    assert.equal(f.host.querySelector<HTMLElement>('.invite-link-control')!.hidden, true); assert.deepEqual(copied, []);
  } finally { f.clear(); }
});

test('leaving a document while a link request is pending prevents clipboard writes', async () => {
  let finish!: (value: { url: string; allowNewPeople: boolean }) => void;
  const f = mount({ roles: async () => ['viewer'], create: () => new Promise(resolve => { finish = resolve; }) });
  await settle(); f.host.querySelector<HTMLButtonElement>('button')!.click(); f.clear();
  finish({ url: 'https://instance.test/l/join/viewer?s=signed', allowNewPeople: false }); await settle();
  assert.deepEqual(copied, []); assert.equal(f.host.childElementCount, 0);
});
