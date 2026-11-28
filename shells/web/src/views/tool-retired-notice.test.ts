// SPDX-License-Identifier: MPL-2.0
/** The line a retired tool shows at the head of its controls (views/tool-retired-notice.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><div class="sidebar-body"><p>inputs</p></div></body>', { url: 'https://lolly.tools/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, localStorage: dom.window.localStorage });
const { mountRetiredToolNotice } = await import('./tool-retired-notice.ts');

test('the line says where the tool went and opens this document there', () => {
  const body = dom.window.document.querySelector('.sidebar-body') as HTMLElement;
  const opened: string[] = [];
  const off = mountRetiredToolNotice({
    body, toolId: 'meeting-planner', name: 'Meeting Planner', successorId: 'timezone', successorName: 'Timezone',
    values: () => ({ city: 'Nuremberg', people: [{ name: 'Ana', city: 'Lisbon' }] }),
    open: (href) => opened.push(href),
  });
  const line = body.firstElementChild as HTMLElement;
  assert.equal(line.getAttribute('role'), 'status');
  assert.match(line.textContent ?? '', /Meeting Planner is now part of Timezone\./);
  const go = line.querySelector('button') as HTMLButtonElement;
  assert.equal(go.textContent, 'Open in Timezone');
  go.click();
  assert.equal(opened.length, 1);
  assert.ok(opened[0]!.startsWith('#/tool/timezone?'));
  assert.match(decodeURIComponent(opened[0]!), /"place":"Lisbon"/);
  off();
  assert.equal(body.querySelector('#retired-tool-notice'), null, 'the line leaves with the tool');
});

test('Voice Recorder says it is part of Audiogram and carries the name and coaching choices', () => {
  const body = dom.window.document.querySelector('.sidebar-body') as HTMLElement;
  const opened: string[] = [];
  const off = mountRetiredToolNotice({
    body, toolId: 'voice-recorder', name: 'Voice Recorder', successorId: 'audiogram', successorName: 'Audiogram',
    values: () => ({ title: 'Standup notes', targetLevel: 'soft', showTips: false, theme: 'dark', accent: '' }),
    open: (href) => opened.push(href),
  });
  const line = body.firstElementChild as HTMLElement;
  assert.match(line.textContent ?? '', /Voice Recorder is now part of Audiogram\./);
  const go = line.querySelector('button') as HTMLButtonElement;
  assert.equal(go.textContent, 'Open in Audiogram');
  go.click();
  const params = new URLSearchParams(opened[0]!.split('?')[1]);
  assert.ok(opened[0]!.startsWith('#/tool/audiogram?'));
  assert.deepEqual(Object.fromEntries(params), { title: 'Standup notes', bg: '#11141f', ink: '#fafbfe', targetLevel: 'soft', showTips: 'false' });
  off();
});

test('Scan says it is part of QR Code and opens scan mode on the same source', () => {
  const body = dom.window.document.querySelector('.sidebar-body') as HTMLElement;
  const opened: string[] = [];
  const off = mountRetiredToolNotice({
    body, toolId: 'scan-code', name: 'Scan', successorId: 'qr-code', successorName: 'QR Code',
    values: () => ({ mode: 'paste', paste: 'https://example.com', image: null }),
    open: (href) => opened.push(href),
  });
  const line = body.firstElementChild as HTMLElement;
  assert.match(line.textContent ?? '', /Scan is now part of QR Code\./);
  const go = line.querySelector('button') as HTMLButtonElement;
  assert.equal(go.textContent, 'Open in QR Code');
  go.click();
  assert.ok(opened[0]!.startsWith('#/tool/qr-code?'));
  assert.deepEqual(Object.fromEntries(new URLSearchParams(opened[0]!.split('?')[1])), { mode: 'scan', source: 'paste', scanText: 'https://example.com' });
  off();
});
