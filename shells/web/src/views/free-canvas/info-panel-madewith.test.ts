// SPDX-License-Identifier: MPL-2.0
/**
 * The Design editor's "Embedded in exports" panel lists the design-system record
 * (plans/319 A7) in the same words the export panel's Design system card shows, so
 * what an export writes is visible from the document as well as at export time.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/free-canvas/info-panel-madewith.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'localStorage', 'getComputedStyle']) {
  try { (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k]; } catch { /* getter-only */ }
}

const { openInfoPanel } = await import('./field-panels.ts');
type Info = Parameters<typeof openInfoPanel>[0]['info'];

function open(info: Info): HTMLElement {
  const stageEl = document.createElement('div');
  const anchor = document.createElement('button');
  document.body.replaceChildren(stageEl, anchor);
  const fc = {
    info, stageEl, morePanel: null,
    document: { closeMorePanel: () => {} },
    helpers: { canvasWH: () => ({ w: 1080, h: 1080 }) },
    keys: {
      escapeHtml: (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
      fmtDate: (s: string) => s,
    },
  };
  openInfoPanel(fc as never, anchor);
  return stageEl.querySelector('.fc-info-panel') as HTMLElement;
}
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

test('the panel shows the record and the description the export will carry', async () => {
  const panel = open({
    name: 'Design',
    madeWith: async () => ({ on: true, words: 'Acme <Client> · Colourway: Persimmon', description: 'Made with https://lolly.tools : Design (Persimmon colourway)' }),
  } as Info);
  assert.ok(panel.textContent!.includes('Embedded in exports'), 'the section appears without a profile store too');
  await settle();
  const row = panel.querySelector('[data-prov="madewith"]') as HTMLElement;
  assert.equal(row.hidden, false);
  assert.equal(row.querySelector('b')!.textContent, 'Acme <Client> · Colourway: Persimmon', 'typed text, written as text');
  assert.equal(panel.querySelector('[data-prov="madewith-description"] b')!.textContent, 'Made with https://lolly.tools : Design (Persimmon colourway)');
});

test('with the export panel card unticked the panel says the record is left out', async () => {
  const panel = open({
    name: 'Design',
    madeWith: async () => ({ on: false, words: 'Acme', description: 'Made with https://lolly.tools : Design' }),
  } as Info);
  await settle();
  assert.equal(panel.querySelector('[data-prov="madewith"] b')!.textContent, 'Not recorded');
});

test('nothing to record leaves both rows hidden', async () => {
  const panel = open({ name: 'Design', madeWith: async () => null } as Info);
  await settle();
  assert.equal((panel.querySelector('[data-prov="madewith"]') as HTMLElement).hidden, true);
  assert.equal((panel.querySelector('[data-prov="madewith-description"]') as HTMLElement).hidden, true);
  // A document with neither provenance nor a record shows no section at all.
  assert.equal(open({ name: 'Design' } as Info).textContent!.includes('Embedded in exports'), false);
});
