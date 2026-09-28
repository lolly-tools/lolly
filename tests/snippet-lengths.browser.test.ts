// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { chromium, type Page } from 'playwright';
import type { InputValue } from '../engine/src/inputs.ts';
import { snippetRender } from './helpers/snippet.ts';

const paragraph = 'A convincing window keeps the words readable while the cursor moves through the text. ';
const lines = (count: number) => Array.from({ length: count }, (_, n) => `Line ${n + 1}: readable text.`).join('\n');
async function mount(page: Page, values: Record<string, InputValue>) {
  const result = await snippetRender({ scene: 'typing', language: 'plain', typingSeconds: 2, typingStyle: 'steady', ...values });
  const { width, height } = page.viewportSize()!;
  await page.setContent(`<style>html,body{width:${width}px;height:${height}px}</style>` + result.html);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  result.runtime.destroy();
  return result.scene;
}
async function frame(page: Page, seconds: number) {
  return page.evaluate(t => {
    const root = document.querySelector<HTMLElement>('#cc-root')! as HTMLElement & { __snippet: { seek(t: number): void } };
    root.__snippet.seek(t);
    const code = root.querySelector<HTMLElement>('#cc-code')!, win = root.querySelector<HTMLElement>('#cc-window')!;
    const gutter = root.querySelector<HTMLElement>('#cc-gutter')!, caret = root.querySelector<HTMLElement>('.cc-caret')!;
    const codeBox = code.getBoundingClientRect(), body = root.querySelector('#cc-body')!.getBoundingClientRect();
    const css = getComputedStyle(code);
    const scroll = new DOMMatrix(getComputedStyle(root.querySelector('.cc-source')!).transform);
    const gutterScroll = new DOMMatrix(getComputedStyle(root.querySelector('.cc-number-lines')!).transform);
    return {
      text: code.textContent!, width: win.clientWidth, height: win.clientHeight, gutter: gutter.clientWidth,
      overflowX: code.scrollWidth - code.clientWidth, overflowY: code.scrollHeight - code.clientHeight,
      scrollX: -scroll.m41, scrollY: -scroll.m42, gutterScrollY: -gutterScroll.m42, selections: root.querySelectorAll('.cc-selection').length,
      caretX: Number.parseFloat(caret.style.left), caretY: Number.parseFloat(caret.style.top), caretHeight: Number.parseFloat(caret.style.height),
      codeX: codeBox.x - body.x, codeWidth: code.clientWidth, bodyHeight: body.height,
      padX: Number.parseFloat(css.paddingLeft), padY: Number.parseFloat(css.paddingTop), lineHeight: Number.parseFloat(css.lineHeight),
      warning: root.querySelector('.cc-scene-warning')!.textContent,
    };
  }, seconds);
}
function caretIsInside(s: Awaited<ReturnType<typeof frame>>) {
  assert.ok(s.caretX >= s.codeX - 1 && s.caretX + 2 <= s.codeX + s.codeWidth + 1, 'caret is inside the text viewport horizontally');
  assert.ok(s.caretY >= -1 && s.caretY + s.caretHeight <= s.bodyHeight + 1, 'caret is inside the text viewport vertically');
}
async function lastGlyph(page: Page) {
  return page.evaluate(() => {
    const source = document.querySelector('.cc-source')!;
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    let last: Node | null = null;
    while (walker.nextNode()) if (walker.currentNode.textContent?.length) last = walker.currentNode;
    const range = document.createRange();
    range.setStart(last!, last!.textContent!.length - 1); range.setEnd(last!, last!.textContent!.length);
    const rect = range.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

test('Snippet handles different text lengths, edits and cursor sizes', {
  skip: !existsSync(chromium.executablePath()) && 'Playwright Chromium is not installed', timeout: 90_000,
}, async t => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    const samples: [string, string, Record<string, InputValue>][] = [
      ['empty', '', {}], ['one character', 'A', {}], ['short sentence', 'A short sentence.', {}],
      ['wrapped paragraph', paragraph.repeat(8), { wrapText: true }],
      ['ten lines', lines(10), {}], ['one hundred lines', lines(100), {}], ['two hundred lines', lines(200), {}],
      ['1200 character line', 'abcdefghij'.repeat(120), {}],
      ['large text size', lines(40), { scale: 200 }],
      ['scrolling one hundred lines', lines(100), { textOverflow: 'scroll' }],
      ['scrolling a long line', 'abcdefghij'.repeat(120), { textOverflow: 'scroll' }],
      ['wrapped scrolling paragraphs', paragraph.repeat(30), { textOverflow: 'scroll', wrapText: true }],
      ['Unicode', 'e\u0301 👩🏽‍💻 日本語 مرحبا\nDone', {}],
      ['trailing newline', 'Hello\n', {}], ['blank lines', '\n\n\n', {}],
    ];
    for (const [name, text, options] of samples) await t.test(name, async () => {
      const scene = await mount(page, { code: text, ...options });
      const type = scene.events.find(e => e.action === 'type')!;
      const start = await frame(page, type.start), middle = await frame(page, type.start + .8), end = await frame(page, type.end);
      assert.equal(start.text, ''); assert.equal(end.text, text); assert.ok(text.startsWith(middle.text));
      assert.equal(start.width, end.width); assert.equal(start.height, end.height);
      assert.equal(start.gutter, end.gutter, 'line number width stays fixed');
      assert.deepEqual(await frame(page, type.start + .8), middle, 'backwards seeking restores the same text and geometry');
      if (options.textOverflow === 'scroll') {
        caretIsInside(end);
        assert.ok(end.scrollX > 0 || end.scrollY > 0, 'long text scrolls to the caret');
        assert.ok(Math.abs(end.scrollY - end.gutterScrollY) < 1, 'line numbers scroll with the text');
      } else {
        assert.ok(end.overflowX <= 1, 'fit includes the full line');
        assert.ok(end.overflowY <= 1, 'fit includes all lines');
        caretIsInside(end);
      }
      if (text.endsWith('\n')) {
        assert.ok(Math.abs(end.caretX - end.codeX - end.padX) < 1, 'newline puts the caret at the left margin');
        assert.ok(end.caretY >= end.padY + (text.split('\n').length - 1) * end.lineHeight - 1, 'newline moves the caret to its new row');
      }
      if (options.textOverflow === 'scroll') {
        await frame(page, type.end);
        const live = await lastGlyph(page);
        const serialized = await page.evaluate(() => Array.from(document.querySelectorAll('style'), el => el.outerHTML).join('') + document.querySelector('#cc-root')!.outerHTML);
        await page.setContent(serialized);
        assert.deepEqual(await lastGlyph(page), live, 'serialized export frames retain the visible scroll position');
      }
    });

    const replacements: [string, string, string, string][] = [
      ['grow', 'Before X after.', 'X', paragraph.repeat(5)],
      ['shrink', 'Before ' + paragraph + ' after.', paragraph, 'X'],
      ['delete word', 'Before X after.', 'X', ''], ['delete all', 'Hello', 'Hello', ''],
      ['same text', 'Before hello after.', 'hello', 'hello'],
      ['first repeated match', 'cat cat cat', 'cat', 'dog'],
      ['multiple inserted lines', 'first\nsecond\nthird', 'second', lines(100)],
      ['multiple deleted lines', 'first\nsecond\nthird', 'first\nsecond', 'one'],
      ['delete final line', 'first\nsecond\nthird', 'third', ''],
      ['emoji', 'Before 👩🏽‍💻 after.', '👩🏽‍💻', 'e\u0301 😀'],
      ['literal markup', 'Before X after.', 'X', '<b>literal & safe</b>'],
    ];
    for (const [name, text, selection, replacement] of replacements) await t.test('replacement: ' + name, async () => {
      const scene = await mount(page, { scene: 'replace', code: text, selectText: selection, replacementText: replacement, wrapText: true });
      assert.deepEqual(scene.warnings, []);
      const edit = scene.events.find(e => e.action === 'replace')!;
      const index = text.indexOf(selection), prefix = text.slice(0, index), suffix = text.slice(index + selection.length);
      const selected = await frame(page, edit.start - .01);
      assert.ok(selected.selections > 0);
      const start = await frame(page, edit.start), middle = await frame(page, edit.start + 1), end = await frame(page, edit.end);
      assert.equal(start.text, prefix + suffix, 'the selected text is removed when replacement starts');
      assert.equal(start.selections, 0);
      assert.equal(end.text, prefix + replacement + suffix);
      assert.ok(middle.text.startsWith(prefix) && middle.text.endsWith(suffix));
      assert.equal(start.width, end.width); assert.equal(start.height, end.height); assert.equal(start.gutter, end.gutter);
      assert.ok(end.overflowX <= 1 && end.overflowY <= 1, 'the longest edit fits in the reserved window');
      caretIsInside(start); caretIsInside(middle); caretIsInside(end);
      assert.deepEqual(await frame(page, edit.start + 1), middle);
    });

    await t.test('repeated edits preserve the suffix and can restore an earlier document', async () => {
      const scene = await mount(page, { scene: 'custom', code: 'A cat naps.', startFilled: true, steps: [
        { action: 'select', text: 'cat', seconds: 1 }, { action: 'replace', text: 'small dog', seconds: 2 },
        { action: 'select', text: 'small dog', seconds: 1 }, { action: 'replace', text: 'cat', seconds: 2 },
        { action: 'select', text: 'naps', seconds: 1 }, { action: 'replace', text: '', seconds: 1 },
      ] });
      for (const [seconds, expected] of [[3, 'A small dog naps.'], [6, 'A cat naps.'], [8, 'A cat .'], [3, 'A small dog naps.']] as const) {
        assert.equal((await frame(page, seconds)).text, expected);
      }
      assert.deepEqual(scene.warnings, []);
    });

    for (const [width, height] of [[640, 400], [800, 800], [1920, 1080]]) await t.test(`fit and replacement at ${width} by ${height}`, async () => {
      await page.setViewportSize({ width: width!, height: height! });
      for (const scene of ['still', 'typing', 'replace']) {
        const text = lines(100);
        const plan = await mount(page, { scene, code: text, selectText: 'Line 50:', replacementText: paragraph.repeat(3), wrapText: true });
        const end = await frame(page, plan.poster);
        assert.ok(end.overflowX <= 1 && end.overflowY <= 1, `${scene} fits the selected dimensions`);
        assert.equal(end.text, scene === 'replace' ? text.replace('Line 50:', paragraph.repeat(3)) : text);
      }
      await page.setViewportSize({ width: 1200, height: 800 });
    });

    for (const typingStyle of ['natural', 'steady', 'word', 'line', 'paste']) await t.test(`${typingStyle} preserves characters and finishes long text`, async () => {
      const text = 'Hello 👩🏽‍💻 e\u0301\n' + paragraph.repeat(5);
      const scene = await mount(page, { code: text, typingStyle, wrapText: true });
      const type = scene.events.find(e => e.action === 'type')!;
      const boundaries = new Set([0, ...Array.from(new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text), s => s.index + s.segment.length)]);
      for (const fraction of [.1, .5, .9, 1]) {
        const sample = await frame(page, type.start + fraction * 2);
        assert.ok(text.startsWith(sample.text)); assert.ok(boundaries.has(sample.text.length));
        if (fraction === 1) assert.equal(sample.text, text);
      }
    });

    for (const text of ['X', paragraph.repeat(8)]) await t.test(`autocomplete with ${text.length} characters`, async () => {
      const scene = await mount(page, { scene: 'autocomplete', code: text, scale: 70, wrapText: true });
      const complete = scene.events.find(e => e.action === 'complete')!;
      await frame(page, complete.start + .4);
      const bounds = await page.evaluate(() => {
        const menu = document.querySelector('.cc-suggestion')!.getBoundingClientRect(), body = document.querySelector('#cc-body')!.getBoundingClientRect();
        return { inside: menu.x >= body.x && menu.y >= body.y && menu.right <= body.right && menu.bottom <= body.bottom };
      });
      assert.ok(bounds.inside, 'the suggestion stays within the window');
      assert.equal((await frame(page, complete.end)).text, text);
    });

    await t.test('the mouse reaches the selected text in an untilted scrolling window', async () => {
      const scene = await mount(page, { scene: 'replace', code: lines(35), selectText: 'Line 20:', replacementText: 'Changed', textOverflow: 'scroll', cursorSize: 200 });
      const selection = scene.events.find(e => e.action === 'select')!;
      await frame(page, selection.end + .1);
      const hit = await page.evaluate(() => {
        const root = document.querySelector('#cc-root')!, pointer = root.querySelector<HTMLElement>('.cc-pointer')!;
        const caret = root.querySelector<HTMLElement>('.cc-caret')!, body = root.querySelector('#cc-body')!.getBoundingClientRect();
        return { x: Number.parseFloat(pointer.style.left) + 16, y: Number.parseFloat(pointer.style.top) + 24,
          targetX: body.x + Number.parseFloat(caret.style.left), targetY: body.y + Number.parseFloat(caret.style.top) + Number.parseFloat(caret.style.height) * .6 };
      });
      assert.ok(Math.abs(hit.x - hit.targetX) < 1 && Math.abs(hit.y - hit.targetY) < 1, 'the mouse is at the selected range endpoint');
    });

    for (const windowStyle of ['cupertino', 'redmond', 'nuremberg']) for (const cursorSize of [50, 100, 250]) await t.test(`${windowStyle} cursor at ${cursorSize}%`, async () => {
      const scene = await mount(page, { scene: 'demo', code: 'Hello!', windowStyle, cursorSize, windowTiltY: -15 });
      const click = scene.events.find(e => e.action === 'click')!;
      await frame(page, click.start + (click.end - click.start) * .9);
      const beam = await page.evaluate(size => {
        const root = document.querySelector('#cc-root')!, pointer = root.querySelector<HTMLElement>('.cc-pointer')!;
        const target = root.querySelector('.cc-target')!.getBoundingClientRect();
        return { x: Number.parseFloat(pointer.style.left) + 8 * size / 100, y: Number.parseFloat(pointer.style.top) + 12 * size / 100, targetX: target.x, targetY: target.y };
      }, cursorSize);
      assert.ok(Math.abs(beam.x - beam.targetX) < 1 && Math.abs(beam.y - beam.targetY) < 1, 'the text cursor keeps its hotspot when resized');
      const close = scene.events.at(-1)!;
      await frame(page, close.start + .6);
      const hit = await page.evaluate(({ windowStyle, cursorSize }) => {
        const root = document.querySelector('#cc-root')!, pointer = root.querySelector<HTMLElement>('.cc-pointer')!;
        const control = root.querySelector(windowStyle === 'cupertino' ? '#cc-controls-left > :first-child' : '#cc-controls-right > :last-child')!.getBoundingClientRect();
        return { width: pointer.getBoundingClientRect().width, x: Number.parseFloat(pointer.style.left) + 3 * cursorSize / 100, y: Number.parseFloat(pointer.style.top) + 2 * cursorSize / 100, targetX: control.x + control.width / 2, targetY: control.y + control.height / 2 };
      }, { windowStyle, cursorSize });
      assert.equal(hit.width, 25 * cursorSize / 100);
      assert.ok(Math.abs(hit.x - hit.targetX) < 1 && Math.abs(hit.y - hit.targetY) < 1, 'the resized pointer clicks the control with its tip');
    });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
