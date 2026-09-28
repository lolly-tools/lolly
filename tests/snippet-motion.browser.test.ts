// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { chromium, type Page } from 'playwright';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import type { InputValue } from '../engine/src/inputs.ts';
import { snippetRender, snippetHooks } from './helpers/snippet.ts';
import { fixture, style } from './helpers/emoji-fixtures.ts';

async function mount(page: Page, values: Record<string, InputValue>) {
  const rendered = await snippetRender(values);
  await page.setContent('<style>html,body{width:1200px;height:800px}</style>' + rendered.html);
  await page.evaluate(() => document.fonts.ready);
  rendered.runtime.destroy();
  return rendered.scene;
}
async function seek(page: Page, seconds: number) {
  return page.evaluate(seconds => {
    const root = document.querySelector('#cc-root') as HTMLElement & { __snippet: { seek(t: number): void } };
    root.__snippet.seek(seconds);
    const win = root.querySelector<HTMLElement>('#cc-window')!;
    return {
      text: root.querySelector('#cc-code')!.textContent,
      opacity: win.style.opacity, height: win.clientHeight, width: win.clientWidth,
      transform: win.style.transform,
      selections: root.querySelectorAll('.cc-selection').length,
      suggestion: !root.querySelector<HTMLElement>('.cc-suggestion')!.hidden,
      scroll: -new DOMMatrix(getComputedStyle(root.querySelector('.cc-source')!).transform).m42,
    };
  }, seconds);
}

test('Snippet scenes seek consistently, keep their geometry, and restore after export', {
  skip: !existsSync(chromium.executablePath()) && 'Playwright Chromium is not installed',
  timeout: 60_000,
}, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.route('http://localhost/snippet-test', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
    await page.goto('http://localhost/snippet-test');
    const scene = await mount(page, { scene: 'demo', code: 'Hello, world!\nSecond line.', windowTiltY: -15, windowRotate: -3 });
    assert.equal(await page.locator('.cc-pointer').isVisible(), false, 'the poster has no mouse overlay');
    const start = await seek(page, 0), middle = await seek(page, 4), end = await seek(page, scene.duration);
    assert.equal(start.text, ''); assert.equal(start.opacity, '0');
    assert.ok(middle.text!.length > 0 && middle.text!.length < end.text!.length);
    assert.equal(end.opacity, '0');
    assert.equal(start.height, middle.height); assert.equal(middle.height, end.height);
    assert.deepEqual(await seek(page, 4), middle, 'seeking backwards recreates exactly the same state');
    const bounds = await page.locator('#cc-window').boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 1200);
    const lifecycle = await page.evaluate(source => {
      const hooks = new Function('host', source + ';return { beforeExport, afterExport };')({});
      const node = document.querySelector('#cc-root')!;
      const clock = node.querySelector('canvas') as HTMLCanvasElement & { __lollyFrameRender(t: number, seconds?: number): void };
      const context = { node, format: 'png', opts: {} as { duration?: number; durationUserSet?: boolean } };
      hooks.beforeExport(context); clock.__lollyFrameRender(0);
      const poster = { text: node.querySelector('#cc-code')!.textContent, opacity: (node.querySelector('#cc-window') as HTMLElement).style.opacity };
      hooks.afterExport(context);
      const restored = node.querySelector('#cc-code')!.textContent;
      context.format = 'webm'; hooks.beforeExport(context);
      const naturalDuration = context.opts.duration;
      clock.__lollyFrameRender(.5, naturalDuration);
      const natural = node.querySelector('#cc-code')!.textContent;
      hooks.afterExport(context);
      context.opts = { duration: 2, durationUserSet: true }; hooks.beforeExport(context);
      clock.__lollyFrameRender(.5, 2);
      const shortened = node.querySelector('#cc-code')!.textContent;
      hooks.afterExport(context);
      return { poster, restored, natural, shortened, duration: context.opts.duration, naturalDuration };
    }, snippetHooks);
    assert.equal(lifecycle.poster.text, 'Hello, world!\nSecond line.');
    assert.equal(lifecycle.poster.opacity, '1');
    assert.equal(lifecycle.restored, middle.text);
    assert.equal(lifecycle.naturalDuration, scene.duration);
    assert.equal(lifecycle.duration, 2);
    assert.equal(lifecycle.shortened, lifecycle.natural);

    const edit = await mount(page, { scene: 'replace', code: 'Hello, World!', selectText: 'World', replacementText: 'Lolly', typingSeconds: 1 });
    const selection = edit.events.find(e => e.action === 'select')!;
    assert.ok((await seek(page, selection.end + .1)).selections > 0);
    assert.equal((await seek(page, edit.poster)).text, 'Hello, Lolly!');
    const complete = await mount(page, { scene: 'autocomplete', code: 'Hello, world! 👩🏽‍💻', typingSeconds: 1 });
    const suggestion = complete.events.find(e => e.action === 'complete')!;
    assert.ok((await seek(page, suggestion.start + .4)).suggestion);
    assert.equal((await seek(page, complete.poster)).text, 'Hello, world! 👩🏽‍💻');

    const long = await mount(page, { scene: 'typing', code: Array.from({ length: 50 }, (_, n) => `Line ${n + 1}: readable text.`).join('\n'), textOverflow: 'scroll', wrapText: true });
    assert.ok((await seek(page, long.poster)).scroll > 0);
    const caret = await page.locator('.cc-caret').boundingBox(), body = await page.locator('#cc-body').boundingBox();
    if (caret && body) assert.ok(caret.y >= body.y && caret.y + caret.height <= body.y + body.height);

    const emojiScene = await mount(page, { scene: 'demo', code: 'Hello 😀 world 😀', language: 'plain' });
    const emoji = await fixture();
    const bundle = await build({
      stdin: { contents: `import { applyEmojiToDom } from './engine/src/emoji-dom.ts';
        import { readEmojiPack } from './engine/src/emoji-pack.ts';
        window.applySnippetEmoji = async (data) => {
          const admitted = await readEmojiPack(new Uint8Array(data.bytes), data.style.primary);
          if (!admitted.ok) throw new Error(admitted.issue.message);
          return applyEmojiToDom(document.querySelector('#cc-root'), data.style, [admitted.pack], {
            loadArtwork: async () => new Uint8Array(data.artwork),
            parseXml: source => new DOMParser().parseFromString(source, 'image/svg+xml')
          });
        };`, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'js' },
      bundle: true, write: false, platform: 'browser', format: 'iife', logLevel: 'silent',
    });
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
    await page.evaluate(async data => (window as any).applySnippetEmoji(data), {
      bytes: [...emoji.bytes], artwork: [...emoji.artwork], style: style(emoji.lock.pin),
    });
    for (const seconds of [0, 5, emojiScene.poster, 2, emojiScene.poster]) {
      await seek(page, seconds);
      const glyphs = await page.locator('#cc-code .lolly-emoji:not([hidden])').count();
      assert.equal(glyphs, seconds === emojiScene.poster ? 2 : seconds === 5 ? 1 : 0);
    }
    const ids = await page.locator('#cc-root [id]').evaluateAll(nodes => nodes.map(n => n.id));
    assert.equal(new Set(ids).size, ids.length, 'prepared glyphs move without duplicating SVG ids');

    for (const windowStyle of ['cupertino', 'redmond', 'nuremberg']) {
      const plan = await mount(page, { scene: 'demo', windowStyle, windowTiltX: 12, windowTiltY: -12 });
      const close = plan.events.at(-1)!;
      await seek(page, close.start + (close.end - close.start) * .6);
      const hit = await page.evaluate(style => {
        const root = document.querySelector('#cc-root')!;
        const button = root.querySelector(style === 'cupertino' ? '#cc-controls-left > :first-child' : '#cc-controls-right > :last-child')!.getBoundingClientRect();
        const pointer = root.querySelector<HTMLElement>('.cc-pointer')!;
        return { x: Number.parseFloat(pointer.style.left) + 3, y: Number.parseFloat(pointer.style.top) + 2, bx: button.x + button.width / 2, by: button.y + button.height / 2 };
      }, windowStyle);
      assert.ok(Math.abs(hit.x - hit.bx) < 1 && Math.abs(hit.y - hit.by) < 1, `${windowStyle} close button stays under the pointer`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
