// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import type { InputValue } from '../engine/src/inputs.ts';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Page } from 'playwright-core';
import type { TextDocumentV1 } from '@lolly-tools/core';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { createTextStory } from '../engine/src/text-story-document.ts';
import { textStyleResolver } from '../engine/src/text-styles.ts';
import { expandQuery } from '../engine/src/url-pack.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
import { settledUrl } from './helpers/settled-address.ts';
const origin = process.env.LOLLY_EXPORT_TEST_URL;
const manifest = JSON.parse(readFileSync(new URL('../community/design/tool.json', import.meta.url), 'utf8'));
async function select(page: Page, start: number, end = start): Promise<void> {
  await page.evaluate(({ start, end }) => {
    const editor = document.querySelector<HTMLElement>('[data-native-text-editor]')!; editor.focus();
    const walker = document.createTreeWalker(editor, 4); let node = walker.nextNode(), offset = 0;
    let a: [Node, number] | undefined, b: [Node, number] | undefined;
    while (node) { const length = node.textContent!.length; if (!a && start <= offset + length) a = [node, start - offset]; if (!b && end <= offset + length) b = [node, end - offset]; offset += length; node = walker.nextNode(); }
    document.getSelection()!.setBaseAndExtent(...a!, ...b!);
    document.dispatchEvent(new Event('selectionchange'));
  }, { start, end });
}
async function model(page: Page): Promise<{ document: TextDocumentV1; boxes: Array<Record<string, unknown>> }> {
  return page.evaluate(() => {
    const values = (document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!();
    return { document: JSON.parse(values.find(item => item.id === 'textDocument')!.value as string), boxes: values.find(item => item.id === 'boxes')!.value as Array<Record<string, unknown>> };
  });
}
async function settle(page: Page): Promise<void> { await page.waitForFunction(() => !document.querySelector('[data-text-pending]')); }
test('Design text edits, formats, pastes, composes, creates and reopens through one history', { skip: origin ? false : 'set LOLLY_EXPORT_TEST_URL', timeout: 150000 }, async () => {
  const story = createTextStory('story', 'Office e\u0301\nSecond paragraph.', index => `p${index}`); story.frameIds = ['box']; story.defaultStyle = 'body';
  const textDocument: TextDocumentV1 = { version: 1, stories: [story], styles: [{ id: 'body', name: 'Body', kind: 'paragraph', paragraph: { character: { font: 'font', fallbackFonts: ['cjk'], size: 48, weight: 400, color: '#163a42' } } }],
    fonts: [{ id: 'font', family: 'SUSE', sha256: createHash('sha256').update(readFileSync('shells/web/public/fonts/SUSE[wght].ttf')).digest('hex'), faceIndex: 0, source: { kind: 'bundled', path: '/fonts/SUSE[wght].ttf' } }] };
  const cjk = readFileSync('tests/fixtures/text-composition/fonts/notosanssc/NotoSansSC-test.ttf');
  textDocument.fonts.push({ id: 'cjk', family: 'Noto Sans SC', sha256: createHash('sha256').update(cjk).digest('hex'), faceIndex: 0, source: { kind: 'bundled', path: '/fonts/native-cjk-test.ttf' } });
  const boxes = [{ id: 'box', kind: 'text', text: '', textStory: 'story', textFrame: JSON.stringify({ mode: 'auto-height', inset: { top: 8, right: 8, bottom: 8, left: 8 }, columns: { count: 1, gutter: 0, balance: false }, verticalAlign: 'top' }), x: 100, y: 100, w: 700, h: 200, rotate: 0 }];
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  await context.route('**/fonts/native-cjk-test.ttf', route => route.fulfill({ contentType: 'font/ttf', body: cjk }));
  const page = await context.newPage(), diagnose = journeyDiagnostics(context, 'design-text-editor');
  page.setDefaultTimeout(20000);
  try {
    await page.goto(`${origin}/design?${new URLSearchParams({ textDocument: JSON.stringify(textDocument), boxes: JSON.stringify(boxes), _sel: 'box', transparentBg: 'false', c2pa: '0', imprint: '0' })}`);
    await page.locator('[data-composed-text]').waitFor();
    for (const id of ['navigator', 'inspector']) { const button = page.locator(`[data-topbar="${id}"]`); if (await button.getAttribute('aria-pressed') === 'true') await button.click(); }
    await page.locator('[data-box-id="box"] .lolly-box-text').dblclick(); await page.locator('[data-native-text-editor]').waitFor(); await settle(page);
    await select(page, 0, 6); await page.locator('.fc-composed-bar').getByRole('button', { name: 'Bold', exact: true }).click(); await settle(page);
    let state = await model(page), text = state.document.stories[0]!;
    assert.equal(textStyleResolver(state.document).character(text, text.paragraphs[0]!, 0).weight, 700);
    await page.locator('[data-topbar="inspector"]').click();
    const inspector = page.locator('[data-composed-inspector]'); await inspector.waitFor();
    assert.ok(await inspector.getByText('Selected text', { exact: true }).isVisible());
    await inspector.getByRole('button', { name: 'Underline', exact: true }).click(); await settle(page);
    state = await model(page); text = state.document.stories[0]!;
    assert.equal(textStyleResolver(state.document).character(text, text.paragraphs[0]!, 0).underline, true);
    assert.notEqual(textStyleResolver(state.document).character(text, text.paragraphs[1]!, text.paragraphs[1]!.start).underline, true);
    const inspectorSize = inspector.getByRole('spinbutton', { name: 'Size', exact: true });
    await inspectorSize.fill('48+10'); await inspectorSize.press('Tab'); await settle(page);
    state = await model(page); text = state.document.stories[0]!;
    assert.equal(textStyleResolver(state.document).character(text, text.paragraphs[0]!, 0).size, 58);
    await page.locator('[data-native-text-editor]').focus(); await page.keyboard.press('ControlOrMeta+z'); await settle(page);
    const grip = await inspectorSize.locator('..').locator('.num-field-lbl').boundingBox(); assert.ok(grip);
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 8, grip.y + grip.height / 2, { steps: 4 }); await page.mouse.up(); await settle(page);
    state = await model(page); text = state.document.stories[0]!;
    assert.equal(textStyleResolver(state.document).character(text, text.paragraphs[0]!, 0).size, 56);
    await page.locator('[data-native-text-editor]').focus(); await page.keyboard.press('ControlOrMeta+z'); await settle(page);
    state = await model(page); text = state.document.stories[0]!;
    assert.equal(textStyleResolver(state.document).character(text, text.paragraphs[0]!, 0).size, 48, 'one scrub is one Undo step');
    assert.equal(textStyleResolver(state.document).character(text, text.paragraphs[0]!, 0).underline, true, 'Undo preserves the preceding formatting edit');
    await page.locator('[data-topbar="inspector"]').click();
    assert.equal(await page.locator('[data-native-text-editor]').count(), 1);
    const size = page.locator('.fc-composed-bar').getByRole('spinbutton', { name: 'Font size', exact: true });
    await size.fill('56'); await size.press('Tab'); await settle(page);
    state = await model(page); text = state.document.stories[0]!;
    assert.equal(textStyleResolver(state.document).character(text, text.paragraphs[0]!, 0).size, 56);
    await page.locator('[data-native-text-editor]').focus(); await page.keyboard.press('ControlOrMeta+z'); await settle(page);
    state = await model(page); text = state.document.stories[0]!;
    assert.equal(textStyleResolver(state.document).character(text, text.paragraphs[0]!, 0).size, 48);
    await page.keyboard.press('ControlOrMeta+Shift+z'); await settle(page);
    await select(page, 0, 6);
    await page.evaluate(async () => { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob(['<b>Rich&nbsp;paste</b><br><i>Soft line</i>'], { type: 'text/html' }), 'text/plain': new Blob(['Rich\u00a0paste\u2028Soft line'], { type: 'text/plain' }) })]); });
    await page.keyboard.press('ControlOrMeta+v'); await settle(page);
    state = await model(page); assert.ok(state.document.stories[0]!.source.startsWith('Rich\u00a0paste\u2028Soft line'));
    await select(page, 0, 4); await page.locator('.fc-composed-bar').getByRole('button', { name: 'Insert emoji', exact: true }).click();
    await page.locator('.emoji-pop unicode-emoji-picker .emojis .emoji').filter({ hasText: '😀' }).first().click();
    await page.locator('.emoji-pop').waitFor({ state: 'detached' }); await settle(page);
    state = await model(page); assert.ok(state.document.stories[0]!.source.startsWith('😀\u00a0paste'));
    await page.keyboard.press('Backspace'); await settle(page); state = await model(page); assert.ok(state.document.stories[0]!.source.startsWith('\u00a0paste'));
    await page.keyboard.press('ControlOrMeta+z'); await settle(page); state = await model(page); assert.ok(state.document.stories[0]!.source.startsWith('😀\u00a0paste'));
    await select(page, state.document.stories[0]!.source.length);
    const client = await context.newCDPSession(page);
    await client.send('Input.imeSetComposition', { text: 'にほ', selectionStart: 2, selectionEnd: 2 });
    await page.evaluate(() => { const canvas = document.getElementById('tool-canvas') as CanvasCommitEl; (window as unknown as { composingNode: Node }).composingNode = document.getSelection()!.focusNode!; canvas.__lollyCommit!('background', '#eef1f4'); });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#tool-canvas .artboard')!).backgroundColor === 'rgb(238, 241, 244)');
    assert.ok(await page.evaluate(() => document.getSelection()!.focusNode === (window as unknown as { composingNode: Node }).composingNode));
    await client.send('Input.insertText', { text: '日本' }); await settle(page); await client.detach();
    const savedSource = (await model(page)).document.stories[0]!.source; assert.ok(savedSource.endsWith('日本'));
    await page.locator('.fc-composed-bar').getByRole('button', { name: 'Done', exact: true }).click();
    await page.keyboard.press('Escape'); await page.keyboard.press('t');
    const canvas = (await page.locator('#tool-canvas').boundingBox())!; await page.mouse.click(canvas.x + canvas.width * .6, canvas.y + canvas.height * .65);
    await page.locator('[data-native-text-editor]').waitFor(); await settle(page); await page.keyboard.insertText('New heading'); await settle(page);
    state = await model(page); assert.equal(state.document.stories.length, 2); assert.ok(state.boxes.some(box => box.textStory !== 'story' && JSON.parse(String(box.textFrame)).mode === 'auto-width'));
    for (const height of [844, 480]) {
      await page.setViewportSize({ width: 390, height });
      await page.waitForFunction(() => {
        const bar = document.querySelector('.fc-composed-bar')!.getBoundingClientRect();
        const selection = document.getSelection()!, range = document.createRange(); range.setStart(selection.focusNode!, selection.focusOffset); range.collapse(true);
        const caret = range.getBoundingClientRect(); return bar.left >= 0 && bar.right <= innerWidth && bar.bottom <= innerHeight && caret.bottom <= bar.top;
      });
      assert.ok(await page.locator('.fc-composed-bar').getByRole('button', { name: 'Done', exact: true }).isVisible());
      assert.ok(await page.locator('.fc-composed-bar').getByRole('button', { name: 'Paragraph', exact: true }).isVisible());
    }
    await page.locator('.fc-composed-bar').getByRole('button', { name: 'Paragraph', exact: true }).click();
    await page.getByRole('dialog', { name: 'Paragraph', exact: true }).getByLabel('Line height', { exact: true }).fill('1.4');
    await page.getByRole('dialog', { name: 'Paragraph', exact: true }).getByLabel('Line height', { exact: true }).press('Tab'); await settle(page);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('[data-native-text-editor]').count(), 1);
    await page.screenshot({ path: '/tmp/lolly-271-compact-text.png' });
    await page.locator('.fc-composed-bar').getByRole('button', { name: 'Done', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Fit all', exact: true }).click();
    await page.mouse.click(400, 800);
    await page.keyboard.press('Escape'); await page.keyboard.press('t');
    assert.ok(await page.getByText('Drag on the canvas to draw: Text. Press Escape to cancel.', { exact: true }).isVisible(), await page.evaluate(() => document.activeElement?.outerHTML.slice(0,300) ?? 'No focused element'));
    const area = (await page.locator('#tool-canvas').boundingBox())!;
    await page.mouse.move(area.x + area.width * .2, area.y + area.height * .65); await page.mouse.down();
    await page.mouse.move(area.x + area.width * .2 + 280, area.y + area.height * .65 + 120, { steps: 8 }); await page.mouse.up();
    await page.locator('[data-native-text-editor]').waitFor(); await settle(page); await page.keyboard.insertText('A fixed text frame'); await settle(page);
    state = await model(page); assert.equal(state.document.stories.length, 3); assert.equal(JSON.parse(String(state.boxes.at(-1)!.textFrame)).mode, 'fixed');
    await page.locator('.fc-composed-bar').getByRole('button', { name: 'Paragraph', exact: true }).click();
    const paragraphControls = page.getByRole('dialog', { name: 'Paragraph', exact: true });
    await paragraphControls.getByText('Frame options',{exact:true}).click();
    await paragraphControls.getByLabel('Text frame', { exact: true }).selectOption('auto-height'); await settle(page);
    await paragraphControls.getByLabel('Composition', { exact: true }).selectOption('balanced'); await settle(page);
    await paragraphControls.getByLabel('Avoid short last line', { exact: true }).check(); await settle(page);
    const lastStory = (await model(page)).document.stories.at(-1)!;
    assert.equal(lastStory.paragraphs[0]!.paragraph!.composition, 'balanced'); assert.ok(lastStory.paragraphs[0]!.paragraph!.shortLastLine!.enabled);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('[data-native-text-editor]').count(), 1);
    await page.locator('.fc-composed-bar').getByRole('button', { name: 'Done', exact: true }).click();
    const shared = parseUrlState(await expandQuery(new URL(await settledUrl(page)).search), manifest); assert.equal(JSON.parse(shared.values.textDocument as string).stories[0].source, savedSource);
    await page.reload(); await page.locator('[data-composed-text]').first().waitFor(); assert.equal((await model(page)).document.stories[0]!.source, savedSource);
    await page.locator('#tool-canvas [data-box-id="box"] .lolly-box-text').dblclick(); await settle(page); await select(page, savedSource.length);
    const imeClient = await context.newCDPSession(page);
    await imeClient.send('Input.imeSetComposition', { text: 'にほ', selectionStart: 2, selectionEnd: 2 });
    await page.evaluate(() => {
      const canvas = document.getElementById('tool-canvas') as CanvasCommitEl;
      const documentValue = JSON.parse(canvas.__lollyModel!().find(item => item.id === 'textDocument')!.value as string);
      const story = documentValue.stories[0]; story.source = 'Remote article'; story.revision++; story.spans = []; story.inlines = []; story.breaks = [];
      story.paragraphs = [{ id: story.paragraphs[0].id, start: 0, end: story.source.length }];
      canvas.__lollyCommit!('textDocument', JSON.stringify(documentValue));
    });
    await page.waitForFunction(() => JSON.parse((document.getElementById('tool-canvas') as CanvasCommitEl).__lollyModel!().find(item => item.id === 'textDocument')!.value as string).stories[0].source === 'Remote article');
    await imeClient.send('Input.insertText', { text: '日本' }); await imeClient.detach();
    await page.getByRole('button', { name: 'Previous text', exact: true }).waitFor(); await settle(page);
    assert.equal((await model(page)).document.stories[0]!.source, 'Remote article', 'IME completion preserves the incoming version');
    await page.getByRole('button', { name: 'Previous text', exact: true }).click();
    const recovery = page.getByRole('dialog', { name: 'Previous text', exact: true });
    assert.ok((await recovery.getByLabel('Recovered story text', { exact: true }).inputValue()).includes(savedSource + '日本'), 'the complete local IME draft remains recoverable');
    assert.ok(await recovery.getByLabel('Recovered story text', { exact: true }).getAttribute('readonly') !== null);
    const downloading = page.waitForEvent('download'); await recovery.getByRole('button', { name: 'Download recovery', exact: true }).click();
    const file = await downloading, recovered = JSON.parse(readFileSync((await file.path())!, 'utf8'));
    assert.equal(JSON.parse(recovered.values.textDocument).stories[0].source, savedSource + '日本');
    await recovery.getByRole('button', { name: 'Copy text', exact: true }).click(); await recovery.getByText('Text copied.', { exact: true }).waitFor();
    assert.ok((await page.evaluate(() => navigator.clipboard.readText())).includes(savedSource + '日本'));
    await recovery.getByRole('button', { name: 'Close', exact: true }).click();
    const currentStory=(await model(page)).document.stories[0]!,frameId=currentStory.frameIds[0]!;
    await page.locator(`#tool-canvas [data-box-id="${frameId}"]`).dblclick();await page.locator('[data-native-text-editor]').waitFor();await settle(page);await select(page,currentStory.source.length);
    const hidingClient=await context.newCDPSession(page);await hidingClient.send('Input.imeSetComposition',{text:'かき',selectionStart:2,selectionEnd:2});
    await page.evaluate(id=>{const canvas=document.getElementById('tool-canvas') as CanvasCommitEl;const boxes=canvas.__lollyModel!().find(item=>item.id==='boxes')!.value as Array<Record<string,unknown>>;canvas.__lollyCommit!('boxes',boxes.map(box=>box.id===id?{...box,hidden:true}:box) as InputValue);},frameId);
    await page.locator('[data-native-text-editor]').waitFor({state:'detached'});await hidingClient.detach();
    assert.equal((await model(page)).document.stories[0]!.source,'Remote article','hiding the active frame preserves received source');
    await page.getByRole('button',{name:'Previous text',exact:true}).click();
    assert.ok((await recovery.getByLabel('Recovered story text',{exact:true}).inputValue()).includes('Remote articleかき'),'an interrupted IME draft remains available when its frame becomes hidden');
    await recovery.getByRole('button',{name:'Close',exact:true}).click();
  } catch (error) { await diagnose(error); throw error; }
  finally { await context.close(); await closeBrowser(); }
});
