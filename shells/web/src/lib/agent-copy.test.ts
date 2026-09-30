// SPDX-License-Identifier: MPL-2.0
/**
 * The landing's "Copy agent instructions" button (lib/agent-copy.ts): it copies the
 * exact text on the button, says the result in its label and live region, refuses
 * honestly without a clipboard, and wires a button once however often it is called.
 *
 * Run directly:  node --test shells/web/src/lib/agent-copy.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/info/' });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, Element: w.Element, HTMLElement: w.HTMLElement });

const { wireAgentCopy } = await import('./agent-copy.ts');

const TEXT = '# Lolly: instructions for AI agents\n\n- URL: https://lolly.tools/api/mcp & "quotes" <tags>\n';

function hero(): HTMLElement {
  const root = w.document.createElement('div');
  const attr = TEXT.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
  root.innerHTML = `<div class="hero-agent">
    <button type="button" data-agent-copy data-agent-text="${attr}" data-copied="Copied to clipboard" data-failed="Copy did not work"><span class="agent-copy-label">Copy agent instructions</span></button>
    <span class="agent-copy-status"></span></div>`;
  w.document.body.replaceChildren(root);
  return root;
}
const flush = () => new Promise<void>((r) => setImmediate(r));

test('a click copies the exact text on the button and says so', async () => {
  const root = hero();
  const written: string[] = [];
  wireAgentCopy(root, async (s) => { written.push(s); });
  const btn = root.querySelector('button')!;
  btn.click();
  await flush();
  assert.deepEqual(written, [TEXT]);
  assert.equal(btn.querySelector('.agent-copy-label')!.textContent, 'Copied to clipboard');
  assert.equal(btn.dataset.state, 'done');
  assert.equal(root.querySelector('.agent-copy-status')!.textContent, 'Copied to clipboard');
});

test('a refused clipboard is reported, never shown as a copy', async () => {
  const root = hero();
  wireAgentCopy(root, () => Promise.reject(new Error('denied')));
  const btn = root.querySelector('button')!;
  btn.click();
  await flush();
  assert.equal(btn.querySelector('.agent-copy-label')!.textContent, 'Copy did not work');
  assert.equal(btn.dataset.state, 'failed');
});

test('wiring twice adds one listener, so one click writes once', async () => {
  const root = hero();
  let calls = 0;
  const write = async () => { calls++; };
  wireAgentCopy(root, write);
  wireAgentCopy(root, write);
  root.querySelector('button')!.click();
  await flush();
  assert.equal(calls, 1);
});
