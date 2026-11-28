// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

// The reader's Copy, Open and Reveal script, in QR Code's template (scan mode) and in
// the retired scan-code tool's, which keeps working under its own id.
const value = 'WIFI:S:Cafe;P:exact & private;;';
const scriptOf = async (id: string): Promise<string> =>
  (await readFile(new URL(`../community/${id}/template.html`, import.meta.url), 'utf8')).match(/<script>([\s\S]*?)<\/script>/)![1]!;

test('the two templates carry the same reader script', async () => {
  assert.equal(await scriptOf('qr-code'), await scriptOf('scan-code'));
});

for (const id of ['qr-code', 'scan-code']) {
const script = await scriptOf(id);

for (const api of ['missing', 'rejecting']) {
  test(`${id}: Copy uses the selected exact payload when the clipboard API is ${api}`, async () => {
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

test(id + ': ' + 'Open link retains its native default action without bubbling into the canvas Source picker', () => {
  const dom = new JSDOM(`<div data-canvas-input="mode"><a data-open href="https://example.com" target="_blank" rel="noopener noreferrer">Open link…</a><script>${script}</script></div>`, { runScripts: 'dangerously' });
  let canvasClicks = 0;
  dom.window.document.body.addEventListener('click', () => canvasClicks++);
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  dom.window.document.querySelector('a')!.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(canvasClicks, 0);
  dom.window.close();
});
}
