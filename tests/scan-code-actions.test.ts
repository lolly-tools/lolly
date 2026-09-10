// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const template = await readFile(new URL('../community/scan-code/template.html', import.meta.url), 'utf8');
const script = template.match(/<script>([\s\S]*?)<\/script>/)![1];
const value = 'WIFI:S:Cafe;P:exact & private;;';

for (const api of ['missing', 'rejecting']) {
  test(`Copy uses the selected exact payload when the clipboard API is ${api}`, async () => {
    let copies = 0;
    const dom = new JSDOM(`<div data-canvas-input="mode"><button data-copy="WIFI:S:Cafe;P:exact &amp; private;;">Copy</button><p class="sc-copy-status"></p><script>${script}</script></div>`, {
      runScripts: 'dangerously', beforeParse(window) {
        if (api === 'rejecting') Object.defineProperty(window.navigator, 'clipboard', {
          value: { writeText: async () => { throw new Error('Blocked'); } },
        });
        Object.defineProperty(window.document, 'execCommand', { value: (command: string) => {
          assert.equal(command, 'copy');
          const selected = window.document.activeElement as HTMLTextAreaElement;
          assert.equal(selected.value, value);
          assert.equal(selected.value.slice(selected.selectionStart, selected.selectionEnd), value);
          copies++;
          return true;
        } });
      },
    });
    const button = dom.window.document.querySelector('button')!;
    button.focus();
    let canvasClicks = 0;
    dom.window.document.body.addEventListener('click', () => canvasClicks++);
    button.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(copies, 1);
    assert.equal(canvasClicks, 0, 'Copy must not open the Source picker');
    assert.equal(dom.window.document.querySelector('textarea'), null);
    assert.equal(dom.window.document.activeElement, button);
    assert.equal(dom.window.document.querySelector('p')!.textContent, 'Copied');
    dom.window.close();
  });
}

test('Open link retains its native default action without bubbling into the canvas Source picker', () => {
  const dom = new JSDOM(`<div data-canvas-input="mode"><a data-open href="https://example.com" target="_blank" rel="noopener noreferrer">Open link…</a><script>${script}</script></div>`, { runScripts: 'dangerously' });
  let canvasClicks = 0;
  dom.window.document.body.addEventListener('click', () => canvasClicks++);
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  dom.window.document.querySelector('a')!.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(canvasClicks, 0);
  dom.window.close();
});
