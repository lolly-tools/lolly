// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { inspectDesignV1 } from '@lolly-tools/core/design-v1';
import { auditMountedDesign } from './design-mounted-audit.ts';
import { mountedDesignFindingMessage } from './design-audit-copy.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

function mounted(
  options: {
    fg?: string;
    bg?: string;
    font?: string;
    gradient?: boolean;
    clientWidth?: number;
    clientHeight?: number;
    scrollWidth?: number;
    scrollHeight?: number;
  } = {}
): { canvas: HTMLElement; report: ReturnType<typeof inspectDesignV1> } {
  document.body.innerHTML = `<div id="canvas" style="background-color:${options.bg ?? 'rgb(255, 255, 255)'}">
    <div class="artboard">
      <div class="lolly-box" data-box-id="title" style="${options.gradient ? 'background-image:linear-gradient(red, blue)' : ''}">
        <div class="lolly-box-text" style="color:${options.fg ?? 'rgb(0, 0, 0)'};font-family:'${options.font ?? 'SUSE'}';font-weight:400;font-size:16px;font-style:normal">Hello</div>
      </div>
    </div>
  </div>`;
  const canvas = document.getElementById('canvas')!;
  const box = canvas.querySelector<HTMLElement>('.lolly-box')!;
  const text = canvas.querySelector<HTMLElement>('.lolly-box-text')!;
  Object.defineProperties(box, {
    clientWidth: { configurable: true, value: options.clientWidth ?? 320 },
    clientHeight: { configurable: true, value: options.clientHeight ?? 100 },
  });
  Object.defineProperties(text, {
    scrollWidth: { configurable: true, value: options.scrollWidth ?? 300 },
    scrollHeight: { configurable: true, value: options.scrollHeight ?? 80 },
  });
  return {
    canvas,
    report: inspectDesignV1([
      { id: 'title', kind: 'text', name: 'Headline', text: 'Hello', x: 0, y: 0, w: 320, h: 100 },
    ]),
  };
}

test('mounted Design audit passes a fitting, high-contrast, resolvable text run', async () => {
  const { canvas, report } = mounted();
  const audit = await auditMountedDesign(canvas, report, { resolveFont: async () => true });
  assert.deepEqual(audit.checked, { overflow: 1, contrast: 1, fonts: 1 });
  assert.equal(audit.manualContrastReview, 0);
  assert.deepEqual(audit.findings, []);
});

test('mounted Design audit reports clipping, low contrast and an unembeddable font', async () => {
  const { canvas, report } = mounted({
    fg: 'rgb(180, 180, 180)',
    font: 'Missing Face',
    scrollWidth: 410,
  });
  const audit = await auditMountedDesign(canvas, report, { resolveFont: async () => false });
  assert.deepEqual(audit.findings.map((finding) => finding.id).sort(), [
    'design.font.unembeddable',
    'design.text.contrast-low',
    'design.text.overflow',
  ]);
  assert.match(
    audit.findings.find((finding) => finding.id === 'design.text.contrast-low')!.message,
    /2\.1:1.*4\.5:1/
  );
  assert.match(
    audit.findings.find((finding) => finding.id === 'design.font.unembeddable')!.message,
    /Missing Face/
  );
  const contrast = audit.findings.find((finding) => finding.id === 'design.text.contrast-low')!;
  assert.deepEqual(contrast.evidence, { name: 'Headline', ratio: '2.1', minimum: '4.5' });
  assert.equal(
    mountedDesignFindingMessage(contrast),
    '“Headline” has 2.1:1 contrast; this text needs at least 4.5:1.'
  );
});

test('mounted Design audit asks for visual review on gradient paint instead of inventing a ratio', async () => {
  const { canvas, report } = mounted({ gradient: true });
  const audit = await auditMountedDesign(canvas, report);
  assert.equal(audit.checked.contrast, 0);
  assert.equal(audit.manualContrastReview, 1);
  assert.deepEqual(
    audit.findings.map((finding) => finding.id),
    ['design.text.contrast-review']
  );
});

test('mounted Design audit does not claim flat contrast over an overlapping image layer', async () => {
  const { canvas } = mounted();
  const title = canvas.querySelector<HTMLElement>('[data-box-id="title"]')!;
  title.style.zIndex = '2';
  const image = document.createElement('div');
  image.className = 'lolly-box';
  image.dataset.boxId = 'photo';
  image.style.zIndex = '1';
  image.innerHTML = '<img class="lolly-box-img" alt="">';
  title.before(image);
  const report = inspectDesignV1([
    { id: 'photo', kind: 'image', x: 0, y: 0, w: 320, h: 100, image: { id: 'photo' }, z: 1 },
    {
      id: 'title',
      kind: 'text',
      name: 'Headline',
      text: 'Hello',
      x: 0,
      y: 0,
      w: 320,
      h: 100,
      z: 2,
    },
  ]);
  const audit = await auditMountedDesign(canvas, report);
  assert.equal(audit.checked.contrast, 0);
  assert.equal(audit.manualContrastReview, 1);
  assert.equal(audit.findings[0]?.id, 'design.text.contrast-review');
});
