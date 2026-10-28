// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { projectTextFile, openNewFileDialog } from './project-text-file.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lolly.test/#/p', pretendToBeVisual: true });
for (const key of ['window', 'document', 'location', 'HTMLElement', 'HTMLDialogElement', 'Element', 'Node', 'CustomEvent', 'getComputedStyle', 'AbortController', 'localStorage']) Reflect.set(globalThis, key, Reflect.get(dom.window, key));
Reflect.set(globalThis, 'requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new dom.window.Event('close')); };
test.after(() => dom.window.close());

test('text and Markdown documents keep a filename, editable source and empty body', () => {
  for (const [raw, format, name, language] of [['Notes', 'plain', 'Notes.txt', 'plain'], ['Roadmap.markdown', 'markdown', 'Roadmap.md', 'markdown'], ['../Notes.txt', 'plain', '..-Notes.txt', 'plain']]) {
    const file = projectTextFile(raw!, format!);
    assert.equal(file.name, name);
    assert.equal(file.inputs.language, language);
    assert.equal(file.inputs.body, '');
    assert.equal(JSON.parse(file.inputs.source).name, name);
  }
  assert.throws(() => projectTextFile(' ', 'plain'), /filename/);
});

test('New file retains the creation identity after a failed placement and stops after disposal', async () => {
  const files: string[] = [];
  let reject = true, current = true;
  const close = openNewFileDialog(async file => { files.push(file.name); if (reject) throw new Error('Folder placement failed.'); }, () => current);
  const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
  const name = dialog.querySelector<HTMLInputElement>('[data-file-name]')!;
  const format = dialog.querySelector<HTMLSelectElement>('[data-file-type]')!;
  name.value = 'Campaign.txt'; format.value = 'markdown'; format.dispatchEvent(new dom.window.Event('change'));
  const submit = () => dialog.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  submit(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(dialog.querySelector('[data-file-error]')!.textContent, 'Folder placement failed.');
  assert.equal(name.disabled, true, 'placement retries cannot rename the already created file');
  reject = false; submit(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(files, ['Campaign.md', 'Campaign.md']);
  assert.equal(dialog.isConnected, false);
  close();
  current = false;
  const stop = openNewFileDialog(async file => { files.push(file.name); }, () => current);
  document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  assert.equal(files.length, 2);
  stop();
});
