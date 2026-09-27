// SPDX-License-Identifier: MPL-2.0
/**
 * The docs reading enhancer (lib/docs-enhance.ts): Copy, its feedback and failure path,
 * lifecycle, and opening a disclosure from a link.
 *
 * Run directly:  node --test shells/web/src/lib/docs-enhance.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/info/build/cli.html' });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, Element: w.Element, HTMLElement: w.HTMLElement });

const { enhanceDocsReading, shellCommands, COPY_FEEDBACK_MS } = await import('./docs-enhance.ts');

const labels = {
  copy: 'Copy', copied: 'Copied to clipboard', copyFailed: 'Copy did not work',
  help: 'Select the text, then use your device’s copy command.', select: 'Select text', selected: 'Text selected',
  copyNamed: (l: string) => `Copy ${l}`,
};
// Exact bytes a reader must get back: tabs, entity-decoded markup, trailing space, a CRLF-free newline.
const CODE = 'pnpm run cli qr-code --url=https://example.com?a=1&b=<2> \\\n\t--output=qr.svg ';

function page(): HTMLElement {
  const root = w.document.createElement('article');
  root.className = 'docs-content';
  root.innerHTML = `<p>Before</p>
    <div class="doc-code" data-label="Terminal" data-copy=""><div class="doc-code-bar" data-label="Terminal"></div>
      <pre tabindex="0" aria-label="Terminal"><code class="language-bash">${CODE.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre></div>
    <div class="doc-code" data-label="Output"><div class="doc-code-bar" data-label="Output"></div><pre><code>no copy here</code></pre></div>
    <details class="doc-details" id="more"><summary>More</summary><div class="doc-details-body"><p id="deep">Deep</p></div></details>`;
  w.document.body.replaceChildren(root);
  return root;
}
const flush = () => new Promise<void>((r) => setImmediate(r));

test('Copy appears only on blocks marked copyable, with an accessible name from the label', () => {
  const root = page();
  const dispose = enhanceDocsReading(root, { writeText: async () => {}, labels });
  const btns = root.querySelectorAll('[data-doc-copy]');
  assert.equal(btns.length, 1);
  assert.equal(btns[0]!.getAttribute('aria-label'), 'Copy Terminal');
  assert.equal(btns[0]!.textContent, 'Copy');
  assert.equal(root.querySelectorAll('[role="status"]').length, 1, 'one live region per reader');
  dispose();
});

test('a successful copy writes the exact code text, floats the confirmation and keeps the label', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = page();
  let written = '';
  const dispose = enhanceDocsReading(root, { writeText: async (s) => { written = s; }, labels });
  const btn = root.querySelector<HTMLButtonElement>('[data-doc-copy]')!;
  const toast = root.querySelector<HTMLElement>('.doc-copy-toast')!;
  btn.focus();
  btn.click();
  await flush();
  assert.equal(written, CODE, 'byte-for-byte, including the tab and trailing space');
  assert.equal(toast.hidden, false);
  assert.equal(toast.textContent, 'Copied to clipboard');
  assert.equal(btn.textContent, 'Copy', 'the button label never changes');
  assert.equal(w.document.activeElement, btn, 'focus stays on Copy');
  t.mock.timers.tick(30);
  assert.equal(root.querySelector('[role="status"]')!.textContent, 'Copied to clipboard');
  assert.equal(root.querySelector<HTMLElement>('.doc-copy-help')!.hidden, true, 'no help after a success');
  t.mock.timers.tick(COPY_FEEDBACK_MS);
  assert.equal(toast.hidden, true, 'the confirmation goes away by itself');
  dispose();
});

test('a repeat copy restarts the timer, and Escape dismisses the confirmation', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = page();
  const dispose = enhanceDocsReading(root, { writeText: async () => {}, labels });
  const btn = root.querySelector<HTMLButtonElement>('[data-doc-copy]')!;
  const toast = root.querySelector<HTMLElement>('.doc-copy-toast')!;
  btn.click(); await flush();
  t.mock.timers.tick(COPY_FEEDBACK_MS - 400);
  btn.click(); await flush();
  t.mock.timers.tick(600);
  assert.equal(toast.hidden, false, 'the second copy restarted the clock');
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(toast.hidden, true);
  dispose();
});

test('a refused copy claims nothing, shows neutral help, and the help stays after a later success', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const root = page();
  let allow = false;
  const dispose = enhanceDocsReading(root, {
    writeText: () => (allow ? Promise.resolve() : Promise.reject(new Error('denied'))), labels,
  });
  const btn = root.querySelector<HTMLButtonElement>('[data-doc-copy]')!;
  const toast = root.querySelector<HTMLElement>('.doc-copy-toast')!;
  const help = root.querySelector<HTMLElement>('.doc-copy-help')!;
  btn.click(); await flush();
  assert.equal(toast.textContent, 'Copy did not work');
  assert.equal(help.hidden, false);
  allow = true;
  btn.click(); await flush();
  assert.equal(toast.textContent, 'Copied to clipboard');
  assert.equal(help.hidden, false, 'recovery cannot collapse the page under the reader');
  dispose();
});

test('a click while a write is pending is ignored, without disabling the button', async () => {
  const root = page();
  let calls = 0;
  let release: () => void = () => {};
  const dispose = enhanceDocsReading(root, {
    writeText: () => { calls++; return new Promise<void>((r) => { release = r; }); }, labels,
  });
  const btn = root.querySelector<HTMLButtonElement>('[data-doc-copy]')!;
  btn.click(); btn.click();
  assert.equal(calls, 1);
  assert.equal(btn.disabled, false);
  release(); await flush();
  btn.click();
  assert.equal(calls, 2, 'enabled again once the first write settles');
  dispose();
});

test('a writer that throws synchronously is a refusal, not an uncaught error', async () => {
  const root = page();
  const dispose = enhanceDocsReading(root, { writeText: () => { throw new Error('no clipboard'); }, labels });
  root.querySelector<HTMLButtonElement>('[data-doc-copy]')!.click();
  await flush();
  assert.equal(root.querySelector<HTMLElement>('.doc-copy-help')!.hidden, false);
  dispose();
});

test('Select text selects exactly the code', () => {
  const root = page();
  const dispose = enhanceDocsReading(root, { writeText: async () => {}, labels });
  root.querySelector<HTMLButtonElement>('[data-doc-select]')!.click();
  assert.equal(w.getSelection()!.toString(), CODE);
  dispose();
});

test('enhancing twice is a no-op, and dispose removes every control and listener', async () => {
  const root = page();
  let calls = 0;
  const opts = { writeText: async () => { calls++; }, labels };
  const d1 = enhanceDocsReading(root, opts);
  const d2 = enhanceDocsReading(root, opts);
  assert.equal(d1, d2);
  assert.equal(root.querySelectorAll('[data-doc-copy]').length, 1);
  root.querySelector<HTMLButtonElement>('[data-doc-copy]')!.click();
  await flush();
  assert.equal(calls, 1, 'one listener, one write');
  d1();
  assert.equal(root.querySelectorAll('.doc-copy-slot, .doc-copy-help, [role="status"]').length, 0);
  const d3 = enhanceDocsReading(root, opts);
  assert.equal(root.querySelectorAll('[data-doc-copy]').length, 1, 'a remount starts clean');
  d3();
});

test('openOnHash opens the disclosure that holds the linked element', () => {
  const root = page();
  w.history.replaceState(null, '', '#deep');
  const details = root.querySelector<HTMLDetailsElement>('#more')!;
  (details as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  (root.querySelector('#deep') as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  assert.equal(details.open, false);
  const dispose = enhanceDocsReading(root, { writeText: async () => {}, labels, openOnHash: true });
  assert.equal(details.open, true);
  dispose();
  w.history.replaceState(null, '', '#');
});

test('a shell example copies its commands: no comment lines, no trailing comments, values with # kept', () => {
  const block = '# List available tools\npnpm run cli\n\n# Run a tool and write output\npnpm run cli qr-code --url=https://suse.com --color=#0c322c --output=./qr.svg\npnpm run cli quotes --quote="Section #2" --name=Andy  # a comment (with a paren)';
  assert.equal(shellCommands(block),
    'pnpm run cli\n\npnpm run cli qr-code --url=https://suse.com --color=#0c322c --output=./qr.svg\npnpm run cli quotes --quote="Section #2" --name=Andy');
});

test('a shell transcript copies only the prompted commands, with their continuations', () => {
  const block = '$ lolly assets --type=raster \\\n    --limit=3\nError: No catalog asset has type "rastor"\n$ echo $?\n4';
  assert.equal(shellCommands(block), 'lolly assets --type=raster \\\n    --limit=3\necho $?');
});

test('a block marked data-copy="shell" writes its commands; other blocks write their exact text', async () => {
  const root = page();
  const block = root.querySelector<HTMLElement>('.doc-code[data-copy]')!;
  block.dataset.copy = 'shell';
  block.querySelector('code')!.textContent = '# comment\npnpm install';
  let written = '';
  const dispose = enhanceDocsReading(root, { writeText: async (s) => { written = s; }, labels });
  root.querySelector<HTMLButtonElement>('[data-doc-copy]')!.click();
  await flush();
  assert.equal(written, 'pnpm install');
  dispose();
});
