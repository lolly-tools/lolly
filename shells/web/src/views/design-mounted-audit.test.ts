// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { inspectDesignV1 } from '@lolly-tools/core/design-v1';
import { auditCurrentDesign, auditMountedDesign } from './design-mounted-audit.ts';
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

test('font checks read inline runs, report the affected layer once and ignore outlined artwork', async () => {
  const { canvas, report } = mounted();
  canvas.querySelector('.lolly-box-text')!.innerHTML = '<span style="font-family:SUSE;font-weight:400">Hello</span><span style="font-family:Missing;font-weight:700">مرحبا</span><span style="font-family:Missing;font-weight:700">عالم</span><svg><title>Not text</title><path d="M0 0"/></svg>';
  const seen: string[] = [];
  const audit = await auditMountedDesign(canvas, report, { resolveFont: async (style, text) => {
    seen.push(`${style.fontFamily}:${style.fontWeight}:${text}`);
    return style.fontFamily === 'SUSE';
  } });
  assert.deepEqual(seen, ['SUSE:400:Hello', 'Missing:700:مرحبا', 'Missing:700:عالم']);
  assert.equal(audit.checked.fonts, 1);
  const fonts = audit.findings.filter(finding => finding.id === 'design.font.unembeddable');
  assert.equal(fonts.length, 1);
  assert.equal(fonts[0]!.layerId, 'title');
  assert.match(mountedDesignFindingMessage(fonts[0]!), /Add or choose a font.*before exporting/);
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

function manyTexts(count: number) {
  const { canvas } = mounted();
  const board = canvas.querySelector<HTMLElement>('.artboard')!;
  board.classList.add('lolly-frame-page');
  board.innerHTML = Array.from({ length: count }, (_, index) => `<div class="lolly-box" data-box-id="t${index}"><div class="lolly-box-text" style="color:rgb(0,0,0);font-family:SUSE;font-size:16px">Run ${index}</div></div>`).join('');
  const report = inspectDesignV1(Array.from({ length: count }, (_, index) => ({
    id: `t${index}`, kind: 'text', text: `Run ${index}`, x: index * 100, y: 0, w: 80, h: 30,
  })));
  return { canvas, board, report };
}

test('shared artboard paint and computed styles are read once without losing contrast checks', async () => {
  const { canvas, board, report } = manyTexts(40);
  const reads = new Map<Element, number>();
  const query = board.querySelector.bind(board);
  let backgroundQueries = 0;
  board.querySelector = ((selector: string) => {
    if (selector === ':scope > .lolly-frame-img') backgroundQueries++;
    return query(selector);
  }) as typeof board.querySelector;
  const audit = await auditMountedDesign(canvas, report, { styleOf(element) {
    reads.set(element, (reads.get(element) ?? 0) + 1);
    return getComputedStyle(element);
  } });
  assert.equal(audit.checked.contrast, 40);
  assert.deepEqual(audit.findings, []);
  assert.equal(backgroundQueries, 1);
  assert.ok([...reads.values()].every(count => count === 1));

  board.insertAdjacentHTML('afterbegin', '<img class="lolly-frame-img" alt="">');
  const changed = await auditMountedDesign(canvas, report);
  assert.equal(changed.checked.contrast, 0);
  assert.equal(changed.manualContrastReview, 40);
  assert.equal(changed.findings.length, 40);
});

test('font checks use bounded batches and still check every distinct text run', async () => {
  const { canvas, report } = manyTexts(25);
  let active = 0, peak = 0;
  const seen: string[] = [];
  const audit = await auditMountedDesign(canvas, report, { resolveFont: async (_style, text) => {
    active++;
    peak = Math.max(peak, active);
    seen.push(text);
    await new Promise<void>(resolve => setImmediate(resolve));
    active--;
    return text !== 'Run 24';
  } });
  assert.equal(peak, 8);
  assert.equal(active, 0);
  assert.equal(seen.length, 25);
  assert.equal(audit.checked.fonts, 25);
  assert.deepEqual(audit.findings.map(finding => [finding.id, finding.layerId]), [['design.font.unembeddable', 't24']]);
});

test('an obsolete audit stops after its in-flight font batch and publishes no partial result', async () => {
  const { canvas, report } = manyTexts(25);
  let current = true, calls = 0;
  const result = await auditCurrentDesign(canvas, report, {
    isCurrent: () => current,
    resolveFont: async () => { calls++; current = false; return false; },
  });
  assert.equal(result, null);
  assert.equal(calls, 8);
  await assert.rejects(auditMountedDesign(canvas, report, { isCurrent: () => false }), { name: 'AbortError' });
  const settled = await auditCurrentDesign(canvas, report, { resolveFont: async () => true });
  assert.equal(settled?.checked.fonts, 25);
});

test('layout checks yield within their work budget and discard an audit superseded while yielding', async (t) => {
  const { canvas, report } = manyTexts(25);
  let ticks = 0, yielded = 0, reads = 0, current = true;
  t.mock.method(performance, 'now', () => ++ticks);
  const result = await auditCurrentDesign(canvas, report, {
    styleOf(element) { reads++; return getComputedStyle(element); },
    isCurrent: () => current,
    yield: async () => { yielded++; current = false; },
  });
  assert.equal(result, null);
  assert.equal(yielded, 1);
  assert.ok(reads > 0 && reads < 25);
});
