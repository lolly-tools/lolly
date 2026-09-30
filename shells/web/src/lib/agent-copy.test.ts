// SPDX-License-Identifier: MPL-2.0
/**
 * The landing's "AI Instructions" pill (lib/agent-copy.ts): a click on the pill or its
 * copy icon copies the exact text on the pill, the eye opens it in a modal and the
 * download icon saves it; the result is said in the label and the live region, a
 * refused clipboard is reported honestly, and a pill is wired once however often.
 *
 * Run directly:  node --test shells/web/src/lib/agent-copy.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/info/' });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, Element: w.Element, HTMLElement: w.HTMLElement });
// jsdom has no modal dialogs; enough of one to open, close and fire `close`.
const proto = w.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
proto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
proto.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };

const { wireAgentCopy } = await import('./agent-copy.ts');

const TEXT = '# Lolly: instructions for AI agents\n\n- URL: https://lolly.tools/api/mcp & "quotes" <tags>\n';

function hero(): HTMLElement {
  w.dispatchEvent(new w.Event('lolly:navigate'));
  const root = w.document.createElement('div');
  const attr = TEXT.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
  root.innerHTML = `<div class="hero-agent">
    <div class="agent-pill" data-agent-pill data-agent-text="${attr}" data-copied="Copied to clipboard" data-failed="Copy did not work" data-title="AI Instructions" data-close="Close" data-filename="lolly-ai-instructions.md">
      <button type="button" class="agent-pill-main"><span class="agent-copy-label">AI Instructions</span></button>
      <span class="agent-pill-icons">
        <button type="button" class="agent-pill-icon" data-agent-action="copy" data-tip="Copy" aria-label="Copy">c</button>
        <button type="button" class="agent-pill-icon" data-agent-action="view" data-tip="View" aria-label="View">v</button>
        <a class="agent-pill-icon" data-agent-action="download" data-tip="Download" aria-label="Download" href="/info/agent-instructions.md" download>d</a>
      </span>
      <span class="agent-copy-status"></span>
    </div></div>`;
  w.document.body.replaceChildren(root);
  return root;
}
const flush = () => new Promise<void>((r) => setImmediate(r));
const pillOf = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-agent-pill]')!;
const icon = (root: HTMLElement, action: string) => root.querySelector<HTMLElement>(`.agent-pill > .agent-pill-icons [data-agent-action="${action}"]`)!;

test('a click on the pill label copies the exact text and says so', async () => {
  const root = hero();
  const written: string[] = [];
  wireAgentCopy(root, { writeText: async (s) => { written.push(s); } });
  root.querySelector<HTMLElement>('.agent-pill-main')!.click();
  await flush();
  assert.deepEqual(written, [TEXT]);
  assert.equal(root.querySelector('.agent-copy-label')!.textContent, 'Copied to clipboard');
  assert.equal(pillOf(root).dataset.state, 'done');
  assert.equal(root.querySelector('.agent-copy-status')!.textContent, 'Copied to clipboard');
});

test('the copy icon copies; view and download do not', async () => {
  const root = hero();
  const written: string[] = [];
  const saved: string[] = [];
  wireAgentCopy(root, { writeText: async (s) => { written.push(s); }, save: (t, f) => { saved.push(`${f}:${t.length}`); } });
  icon(root, 'copy').click();
  icon(root, 'download').click();
  icon(root, 'view').click();
  await flush();
  assert.equal(written.length, 1, 'only the copy icon wrote to the clipboard');
  assert.deepEqual(saved, [`lolly-ai-instructions.md:${TEXT.length}`]);
});

test('download writes the file from the pill text instead of following the link', () => {
  const root = hero();
  wireAgentCopy(root, { save: () => {} });
  const link = icon(root, 'download');
  const event = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
});

test('download uses the registered shell host', async () => {
  const { setHostRef } = await import('./host-ref.ts');
  const { createMockHost } = await import('../../../../packages/core/src/mock-host.ts');
  const host = createMockHost();
  const downloads: { blob: Blob; filename: string }[] = [];
  host.export.download = async (blob, filename) => { downloads.push({ blob, filename }); };
  setHostRef(host);
  const root = hero();
  wireAgentCopy(root);
  icon(root, 'download').click();
  await flush();
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0]!.filename, 'lolly-ai-instructions.md');
  assert.equal(downloads[0]!.blob.size, new w.Blob([TEXT]).size);
});

test('the eye opens the text in a modal that copies, and closing removes the modal', async () => {
  const root = hero();
  const written: string[] = [];
  wireAgentCopy(root, { writeText: async (s) => { written.push(s); } });
  icon(root, 'view').click();
  const dialog = root.querySelector<HTMLDialogElement>('dialog.agent-dialog')!;
  assert.ok(dialog.hasAttribute('open'));
  assert.equal(dialog.querySelector('pre')!.textContent, TEXT);
  assert.equal(dialog.querySelector('h2')!.textContent, 'AI Instructions');
  assert.equal(dialog.getAttribute('aria-labelledby'), dialog.querySelector('h2')!.id);
  dialog.querySelector<HTMLElement>('[data-agent-action="copy"]')!.click();
  await flush();
  assert.deepEqual(written, [TEXT]);
  assert.equal(dialog.querySelector('.agent-dialog-status')!.textContent, 'Copied to clipboard');
  dialog.querySelector<HTMLElement>('.agent-dialog-close')!.click();
  assert.equal(root.querySelector('dialog.agent-dialog'), null);
});

test('a refused clipboard is reported, never shown as a copy', async () => {
  const root = hero();
  wireAgentCopy(root, { writeText: () => Promise.reject(new Error('denied')) });
  root.querySelector<HTMLElement>('.agent-pill-main')!.click();
  await flush();
  assert.equal(root.querySelector('.agent-copy-label')!.textContent, 'Copy did not work');
  assert.equal(pillOf(root).dataset.state, 'failed');
});

test('wiring twice adds one listener, so one click writes once', async () => {
  const root = hero();
  let calls = 0;
  const write = async () => { calls++; };
  wireAgentCopy(root, { writeText: write });
  wireAgentCopy(root, { writeText: write });
  root.querySelector<HTMLElement>('.agent-pill-main')!.click();
  await flush();
  assert.equal(calls, 1);
});
