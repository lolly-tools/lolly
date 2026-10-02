// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { wireVerifyActions } from './valid-actions.ts';

const fixture = (index: number, name: string): string => `<details class="valid-item" open><summary>${name}</summary><div class="valid-result" data-actions-index="${index}"><span class="valid-hero-filename">${name}</span><button data-open-unpack data-file-index="${index}">Unpack</button><button data-open-prepare data-file-index="${index}">Prepare</button><button data-report-card>Save a signed report card</button><button data-clean-copy="${index}">Cleaned copy</button><div><button data-ocr-read><span>Read this document</span></button><div data-ocr-result hidden></div></div><details data-claim-panel><summary>Add credentials</summary><input></details></div></details>`;

test('floating actions retain file targeting, busy state, results and cleanup across report replacements', async () => {
  const dom = new JSDOM(`<body><main><button data-check-more>Choose other files</button><button data-result-paste>Paste text</button><button data-result-url>Add from URL</button><div id="report">${fixture(0, 'one.pdf')}${fixture(1, 'two.pdf')}</div></main></body>`, { url: 'https://lolly.test/#/verify' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const set = (key: string, value: unknown): void => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLAnchorElement', 'HTMLDetailsElement', 'Element', 'Node', 'MutationObserver', 'CustomEvent', 'localStorage', 'navigator']) set(key, Reflect.get(dom.window, key));
  set('ResizeObserver', class { observe() {} disconnect() {} });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  document.documentElement.dataset.a11yMotion = 'reduce';
  const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
  const view = document.querySelector<HTMLElement>('main')! as HTMLElement & { _cleanup?: () => void };
  const report = document.querySelector<HTMLElement>('#report')!;
  let destination = '', cleaned = '', oldCleanup = false;
  view._cleanup = () => { oldCleanup = true; };
  report.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const utility = target.closest<HTMLButtonElement>('[data-open-unpack], [data-open-prepare]');
    if (utility) destination = `${utility.hasAttribute('data-open-unpack') ? 'unpack' : 'prepare'}:${utility.dataset.fileIndex}`;
    const clean = target.closest<HTMLButtonElement>('[data-clean-copy]');
    if (clean) { cleaned = clean.dataset.cleanCopy!; clean.disabled = true; clean.textContent = 'Cleaning…'; }
    const read = target.closest<HTMLButtonElement>('[data-ocr-read]');
    if (read) { const out = read.parentElement!.querySelector<HTMLElement>('[data-ocr-result]')!; out.textContent = 'Read result'; out.hidden = false; read.hidden = true; }
  });
  try {
    wireVerifyActions(view, report);
    await flush();
    const toolbar = view.querySelector<HTMLElement>('.valid-actions')!;
    const picker = toolbar.querySelector<HTMLSelectElement>('[data-actions-file]')!;
    picker.value = '1'; picker.dispatchEvent(new dom.window.Event('change'));
    const action = (id: string): HTMLButtonElement => toolbar.querySelector<HTMLButtonElement>(`[data-verify-action="${id}"]`)!;
    action('unpack').click();
    assert.equal(destination, 'unpack:1');
    action('prepare').click();
    assert.equal(destination, 'prepare:1');
    assert.equal(action('unpack').dataset.tip, 'Unpack');
    action('clean').click();
    assert.equal(cleaned, '1');
    assert.equal(action('clean').disabled, true);
    assert.equal(action('clean').textContent, 'Cleaning…');
    assert.equal(report.querySelectorAll('[data-toolbar-source]').length, 10);
    action('text').click(); await flush();
    assert.equal(action('text'), null);
    assert.equal(report.querySelectorAll('[data-ocr-result]:not([hidden])').length, 1);
    action('claim').click();
    assert.equal(report.querySelector('.valid-result[data-actions-index="1"] [data-claim-panel]')?.hasAttribute('open'), true);
    const more = toolbar.querySelector<HTMLDetailsElement>('details')!;
    more.open = true;
    // Safari can move focus to the view during a menu pointer gesture.
    view.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
    assert.equal(more.open, true);
    more.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(more.open, false);
    report.innerHTML = fixture(0, 'replacement.pdf'); await flush();
    assert.equal(picker.hidden, true);
    assert.equal(action('clean').disabled, false);
    action('clean').click(); assert.equal(cleaned, '0');
    report.innerHTML = '<p>Checking…</p>'; await flush();
    assert.equal(toolbar.hidden, false);
    assert.ok(action('files'));
    assert.ok(action('paste'));
    assert.ok(action('url'));
    assert.equal(action('clean'), null);
    view._cleanup?.();
    assert.equal(oldCleanup, true);
    assert.equal(view.querySelector('.valid-actions'), null);
    report.innerHTML = fixture(0, 'later.pdf'); await flush();
    assert.equal(view.querySelector('.valid-actions'), null);
  } finally {
    view._cleanup?.(); dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('Inspect is a primary command only until the report has inspected itself', async () => {
  const forensic = (ran: boolean, again = 'Retry inspection'): string => `<details class="valid-item" open><summary>pasted.txt</summary><div class="valid-result" data-actions-index="0"><span class="valid-hero-filename">pasted.txt</span><section class="forensic" data-forensic-index="0"><h2>AI evidence</h2><button data-forensic="inspect"${ran ? ' hidden' : ''}>Inspect AI evidence</button><div data-forensic-content>${ran ? `<div class="forensic-toolbar forensic-actions"><button data-forensic="inspect">${again}</button><button data-forensic="json">Export JSON evidence</button></div>` : ''}</div></section></div></details>`;
  const dom = new JSDOM(`<body><main><div id="report">${forensic(false)}</div></main></body>`, { url: 'https://lolly.test/#/verify' });
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const set = (key: string, value: unknown): void => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  };
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLAnchorElement', 'HTMLDetailsElement', 'Element', 'Node', 'MutationObserver', 'CustomEvent', 'localStorage', 'navigator']) set(key, Reflect.get(dom.window, key));
  set('ResizeObserver', class { observe() {} disconnect() {} });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
  const view = document.querySelector<HTMLElement>('main')! as HTMLElement & { _cleanup?: () => void };
  const report = document.querySelector<HTMLElement>('#report')!;
  let reran = 0;
  report.addEventListener('click', event => {
    if (event.target instanceof HTMLElement && event.target.closest('.forensic-actions [data-forensic="inspect"]')) reran++;
  });
  try {
    wireVerifyActions(view, report);
    await flush();
    const toolbar = view.querySelector<HTMLElement>('.valid-actions')!;
    const primary = (id: string) => toolbar.querySelector<HTMLButtonElement>(`[data-actions-primary] [data-verify-action="${id}"]`);
    const menu = (id: string) => toolbar.querySelector<HTMLButtonElement>(`[data-actions-menu] [data-verify-action="${id}"]`);
    assert.ok(primary('ai'), 'not inspected yet: Inspect is offered');
    assert.equal(menu('ai-again'), null);

    report.querySelector('.forensic')!.setAttribute('aria-busy', 'true'); await flush();
    assert.equal(primary('ai'), null, 'no Inspect while a run is in progress');

    report.innerHTML = forensic(true); await flush();
    assert.equal(primary('ai'), null, 'a finished run is not offered as a fresh Inspect');
    assert.equal(menu('ai-again')?.textContent, 'Retry inspection');
    menu('ai-again')!.click();
    assert.equal(reran, 1);

    report.innerHTML = forensic(true, 'Inspect more pages'); await flush();
    assert.equal(menu('ai-again')?.textContent, 'Inspect more pages');
  } finally {
    view._cleanup?.(); dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
