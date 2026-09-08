// SPDX-License-Identifier: MPL-2.0
/**
 * lib/dom-penpot.ts at its DOM→IR boundary (plans/222). jsdom has no layout engine,
 * so getBoundingClientRect/Range are mocked with fixed rectangles: these assertions
 * prove text stays editable, inherited colours bind to their tokens, a literal stays
 * local, and unsupported artwork is embedded WITHOUT flattening its neighbours - they
 * are NOT pixel-fidelity evidence and do not replace a real-browser + Penpot pass.
 *
 * Run with: node --test shells/web/src/lib/dom-penpot.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { domToPenpotDoc } from './dom-penpot.ts';
import type { PenpotIrShape } from '../../../../engine/src/penpot-file.ts';

const bindToken = (css: string, kind: 'color' | 'font'): string | null => {
  const varM = /^var\(\s*(--[\w-]+)/.exec(css);
  if (varM) return ({ '--brand-primary': 'color.semantic.primary', '--brand-surface': 'color.semantic.surface' } as Record<string, string>)[varM[1]!] ?? null;
  if (kind === 'font') { if (css === '' || css === 'sans') return 'font.brand'; }
  return null;
};

function withDom<T>(html: string, body: (win: any, stage: HTMLElement) => Promise<T>): Promise<T> {
  const dom = new JSDOM(`<!doctype html>${html}`);
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLImageElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'SVGElement', 'DOMRect', 'Range', 'XMLSerializer', 'getComputedStyle']) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true, writable: true });
  }
  // Fixed layout: the stage is 320x180; every child is a 200x24 band stacked by DOM order.
  let n = 0;
  dom.window.Element.prototype.getBoundingClientRect = function (this: Element) {
    if ((this as HTMLElement).id === 'stage') return new dom.window.DOMRect(100, 100, 320, 180);
    const i = n++;
    return new dom.window.DOMRect(110, 110 + i * 26, 200, 24);
  };
  dom.window.Range.prototype.getBoundingClientRect = () => new dom.window.DOMRect(112, 112, 180, 18);
  const run = async (): Promise<T> => {
    const stage = dom.window.document.querySelector('#stage') as HTMLElement;
    return body(dom.window, stage);
  };
  return run().finally(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key];
    }
    dom.window.close();
  });
}

const flatten = (shapes: PenpotIrShape[]): PenpotIrShape[] => {
  const out: PenpotIrShape[] = [];
  const visit = (s: PenpotIrShape): void => { out.push(s); if ('children' in s) s.children.forEach(visit); };
  shapes.forEach(visit);
  return out;
};

test('text stays editable, an inherited colour binds to its token, a literal stays local', async () => {
  await withDom(
    '<div id="stage" style="background-color:rgb(255,255,255)">' +
      '<p style="color: var(--brand-primary, #30ba78)">Make something</p>' +
      '<p style="color: #ff0000">Literal red</p>' +
      '<span style="color: {color.semantic.text}">Alias bound</span>' +
      '<span data-export-hide>chrome</span>' +
    '</div>',
    async (_win, stage) => {
      const result = await domToPenpotDoc(stage, { name: 'Tool', bindToken });
      assert.ok(result, 'the producer handled a clean HTML canvas');
      const flat = flatten(result!.doc.pages[0]!.shapes);
      const texts = flat.filter(s => s.type === 'text');
      const byText = (t: string) => texts.find(s => s.paragraphs[0]!.runs[0]!.text.trim() === t);

      assert.ok(byText('Make something'), 'label stayed an editable text object');
      assert.ok(!texts.some(s => s.paragraphs[0]!.runs[0]!.text.includes('chrome')), 'data-export-hide chrome excluded');

      assert.deepEqual(byText('Make something')!.appliedTokens, { fill: 'color.semantic.primary' }, 'the var(--brand-primary) heading binds');
      assert.equal(byText('Literal red')!.appliedTokens, undefined, 'a literal colour is not bound');
      assert.deepEqual(byText('Alias bound')!.appliedTokens, { fill: 'color.semantic.text' }, 'a bare {alias} binds directly');
      assert.ok(result!.report.editableText >= 3);
      assert.ok(result!.report.bound >= 2);
    },
  );
});

test('an unsupported <canvas> is embedded locally without flattening neighbouring text', async () => {
  await withDom(
    '<div id="stage" style="background-color:rgb(255,255,255)">' +
      '<p style="color:#111111">Caption above</p>' +
      '<canvas width="120" height="80" aria-label="Live viz"></canvas>' +
    '</div>',
    async (_win, stage) => {
      const result = await domToPenpotDoc(stage, { name: 'Viz tool', bindToken });
      assert.ok(result);
      const flat = flatten(result!.doc.pages[0]!.shapes);
      assert.ok(flat.some(s => s.type === 'text' && s.paragraphs[0]!.runs[0]!.text.trim() === 'Caption above'), 'the caption is still editable');
      assert.ok(result!.report.embedded >= 1, 'the canvas was embedded as artwork, not lowered');
    },
  );
});

test('a transform on the canvas root bails to null, so the caller keeps the faithful fallback', async () => {
  await withDom(
    '<div id="stage" style="transform: rotate(6deg); background-color:rgb(255,255,255)"><p style="color:#111">Tilted</p></div>',
    async (win, stage) => {
      // jsdom echoes inline transform through getComputedStyle.
      assert.notEqual(win.getComputedStyle(stage).transform, 'none', 'precondition: the transform is visible');
      const result = await domToPenpotDoc(stage, { name: 'Tilted', bindToken });
      assert.equal(result, null, 'a transformed canvas defers to the picture fallback');
    },
  );
});
