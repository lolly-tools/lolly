// SPDX-License-Identifier: MPL-2.0
// Exercises real SVG parsing, result tabs and overlapping file reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ff0000"/><text x="5" y="20">Audit words</text></svg>';
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10));

test('Unpack ignores obsolete reads and exposes working keyboard tabs', async (suite) => {
  const dom = new JSDOM('<!doctype html><body><div id="view"></div></body>', { url: 'http://localhost/#/unpack', pretendToBeVisual: true });
  const original = new Map<string, PropertyDescriptor | undefined>();
  const globals = globalThis as unknown as Record<string, unknown>;
  const set = (key: string, value: unknown): void => {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'DOMParser', 'XMLSerializer', 'getComputedStyle', 'location', 'localStorage', 'sessionStorage', 'CustomEvent', 'MutationObserver', 'Event', 'navigator', 'history', 'requestAnimationFrame', 'cancelAnimationFrame']) set(key, (dom.window as unknown as Record<string, unknown>)[key]);
  set('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  set('ResizeObserver', class { observe() {} disconnect() {} });
  set('IntersectionObserver', class { observe() {} disconnect() {} });
  set('CSS', { escape: (value: string) => value });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const view = document.querySelector<HTMLElement>('#view')! as HTMLElement & { _cleanup?: () => void };
  const host = { profile: { get: async () => ({}) }, state: { get: async () => null, set: async () => {} }, log() {} } as unknown as HostV1;
  try {
    const { mountPdfExtract } = await import('./pdf-extract.ts');
    await mountPdfExtract(view, host);
    // Warm the actual parser to make race ordering deterministic.
    const { openDesignFile } = await import('./unpack-open.ts');
    await openDesignFile(new File([svg], 'warm.svg'));
    const input = view.querySelector<HTMLInputElement>('input[type="file"]')!;
    const open = (file: File): void => {
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new dom.window.Event('change'));
    };
    const deferred = (name: string): { file: File; started: Promise<void>; release: (bytes?: string) => void; reject: () => void } => {
      const file = new File([svg], name);
      let start!: () => void, resolve!: (bytes: ArrayBuffer) => void, reject!: (error: Error) => void;
      const started = new Promise<void>(done => { start = done; });
      Object.defineProperty(file, 'arrayBuffer', { value: () => { start(); return new Promise<ArrayBuffer>((done, fail) => { resolve = done; reject = fail; }); } });
      return { file, started, release: (bytes = svg) => resolve(new TextEncoder().encode(bytes).buffer), reject: () => reject(new Error('Old file refused')) };
    };
    const waitResult = async (): Promise<void> => {
      for (let i = 0; i < 100 && !view.querySelector('[role="tablist"]'); i++) await tick();
      assert.ok(view.querySelector('[role="tablist"]'), view.textContent ?? 'no result');
    };

    await suite.test('new file wins even when an older parse finishes last', async () => {
      const old = deferred('old.svg'); open(old.file); await old.started;
      open(new File([svg], 'latest.svg')); await waitResult();
      old.release(); await tick(); await tick();
      assert.match(view.textContent!, /latest\.svg/);
      assert.doesNotMatch(view.textContent!, /old\.svg/);
      assert.match(view.querySelector('[data-panel="text"]')!.textContent!, /Audit words/);
    });

    await suite.test('arrow keys select and focus a panel with matching ARIA relationships', () => {
      const tabs = [...view.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      assert.ok(tabs.length > 1);
      tabs[0]!.focus();
      tabs[0]!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      assert.equal(document.activeElement, tabs[1]);
      assert.equal(tabs[0]!.tabIndex, -1);
      assert.equal(tabs[1]!.getAttribute('aria-selected'), 'true');
      const panel = document.getElementById(tabs[1]!.getAttribute('aria-controls')!)!;
      assert.equal(panel.hidden, false);
      assert.equal(panel.getAttribute('aria-labelledby'), tabs[1]!.id);
    });

    await suite.test('cancelled failure cannot replace a subsequent successful import', async () => {
      const old = deferred('cancelled.svg'); open(old.file); await old.started;
      view.querySelector<HTMLButtonElement>('[data-busy-cancel]')!.click();
      open(new File([svg], 'after-cancel.svg')); await waitResult();
      old.reject(); await tick(); await tick();
      assert.match(view.textContent!, /after-cancel\.svg/);
      assert.equal(view.querySelector('.pdfx-error'), null);
    });

    await suite.test('unmount invalidates pending work and releases the result', async () => {
      const old = deferred('after-unmount.svg'); open(old.file); await old.started;
      view._cleanup?.(); old.release(); await tick(); await tick();
      assert.equal(view.querySelector<HTMLElement>('[data-out]')!.hidden, true);
      assert.equal(view.querySelector('[role="tablist"]'), null);
    });
  } finally {
    view._cleanup?.(); dom.window.close();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globals[key];
    }
  }
});
