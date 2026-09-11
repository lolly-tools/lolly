// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { captureComponents } from './component-capture.ts';
import type { PenpotIrShape } from '../../../../engine/src/penpot-file.ts';

test('native capture preserves input values, checked state, text, SVG geometry and local coordinates', async () => {
  const dom = new JSDOM('<!doctype html><div id="stage" style="background:rgb(255,255,255);font:14px SUSE"><button style="background:rgb(12,50,44);color:white;border-radius:8px">Create asset</button><input aria-label="Name" value="Launch kit"><input type="checkbox" checked><input type="range" value="75"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 12 L20 12" stroke="black" /></svg><span data-export-hide>Private chrome</span><span hidden>Hidden text</span></div>');
  const originals = new Map<string, PropertyDescriptor | undefined>();
  for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLImageElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'DOMRect', 'XMLSerializer', 'getComputedStyle']) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value: (dom.window as any)[key], configurable: true, writable: true });
  }
  Object.defineProperty(dom.window.document, 'fonts', { value: { ready: Promise.resolve() } });
  // jsdom has no layout engine. Fixed measurements isolate the DOM->IR boundary;
  // these assertions do not claim pixel fidelity or substitute for visual QA.
  dom.window.Element.prototype.getBoundingClientRect = function () {
    return new dom.window.DOMRect(this.id === 'stage' ? 200 : 220, this.id === 'stage' ? 300 : 320, this.id === 'stage' ? 320 : 120, this.id === 'stage' ? 180 : 32);
  };
  dom.window.Range.prototype.getBoundingClientRect = () => new dom.window.DOMRect(230, 326, 86, 18);
  try {
    const stage = dom.window.document.querySelector<HTMLElement>('#stage')!;
    const { doc } = await captureComponents([{ name: 'Inputs', node: stage }]);
    const flat: PenpotIrShape[] = [];
    const visit = (s: PenpotIrShape): void => { flat.push(s); if ('children' in s) s.children.forEach(visit); };
    doc.pages[0]!.shapes.forEach(visit);
    const texts = flat.filter(s => s.type === 'text').flatMap(s => s.paragraphs.flatMap(p => p.runs.map(r => r.text)));
    assert.ok(texts.includes('Create asset'));
    assert.ok(texts.includes('Launch kit'), 'form value is not a DOM text node but must stay editable');
    assert.ok(!texts.includes('Private chrome'));
    assert.ok(!texts.includes('Hidden text'));
    const label = flat.find(s => s.type === 'text' && s.name === 'Create asset')!;
    assert.equal(label.x, 30); assert.equal(label.y, 26);
    assert.ok(flat.some(s => s.name === 'Selected'));
    assert.ok(flat.some(s => s.name === 'Range value' && s.w === 90));
    assert.ok(flat.some(s => s.type === 'path'));
    assert.equal(doc.media?.length, 0);
    assert.equal(stage.querySelectorAll('[data-export-hide]').length, 1, 'temporary token probe is cleaned up');
    await assert.rejects(captureComponents([]), /at least one/);
    stage.remove();
    await assert.rejects(captureComponents([{ name: 'Detached', node: stage }]), /no longer mounted/);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key];
    }
    dom.window.close();
  }
});
