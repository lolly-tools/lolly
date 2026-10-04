// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const tool = await loadTool('agenda', path => readFile(new URL('../community/' + path, import.meta.url), 'utf8'));
const skip = !existsSync(chromium.executablePath()) && 'Install Playwright Chromium for Agenda browser coverage';
let browser: Browser;
type Screen = HTMLElement & { __lollyPresentation: { prepare(format: string, opts: Record<string, unknown>): () => void; kit(): {readme:string;variants:Array<{name:string;markup:string;static?:boolean}>} } };
type ClockCanvas = HTMLCanvasElement & { __lollyFrameDriven: boolean; __lollyFrameRender(time: number, duration: number): void };
async function open(values: Record<string, unknown> = {}, width = 1280, height = 720, scripts = true, noGl = false): Promise<Page> {
  const runtime = await createRuntime(tool, baseHost(), { now: '2026-10-14T09:30', ...values });
  const page = await browser.newPage({ viewport: { width, height }, javaScriptEnabled: scripts });
  if (noGl) await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
      return type === 'webgl2' ? null : Reflect.apply(get, this, [type, ...args]);
    } as typeof get;
  });
  await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body:
    `<style>html,body{margin:0;width:100%;height:100%}${tool.styles}</style><body data-lolly-portable><div style="width:100%;height:100%">${runtime.getHydrated()}</div></body>` }));
  await page.goto('http://agenda.test/');
  if (scripts) await page.waitForFunction(() => !!(document.querySelector('[data-portable-root]') as Screen)?.__lollyPresentation);
  return page;
}

describe('Agenda browser presentation', { skip }, () => {
  before(async () => { browser = await chromium.launch({ headless: true }); });
  after(async () => { await browser?.close(); });

  it('recomposes at landscape, portrait, square and ribbon sizes without horizontal overflow', async () => {
    for (const [layout, width, height] of [['overview',1920,1080],['overview',1080,1920],['overview',1080,1080],['ribbon',1920,320]] as const) {
      const sessions = { columns: ['Date','Start','End','Title','Speaker','Track','Room'], rows: Array.from({length: 4}, (_, i) => ['2026-10-14','09:00','10:00', i ? 'Another session' : 'Making a long conference title readable for every audience, every room and every screen without losing its words', 'A speaker', 'Design', 'Room ' + i]) };
      const page = await open({ layout, sessions }, width, height);
      try {
        const bounds = await page.locator('[data-portable-root]').evaluate(root => ({
          horizontal: root.scrollWidth - root.clientWidth,
          vertical: root.querySelector('.ag-scene-list')!.scrollHeight - root.querySelector('.ag-scene-list')!.clientHeight,
        }));
        assert.ok(bounds.horizontal <= 1, `${layout} ${width}x${height}: width`);
        assert.ok(bounds.vertical <= 1, `${layout} ${width}x${height}: height`);
      } finally { await page.close(); }
    }
  });

  it('seeks directly to the same text and shader frame and wraps under reduced motion', async () => {
    const page = await open();
    try {
      assert.equal(await page.evaluate(() => {
        const root = document.querySelector('[data-portable-root]')!, canvas = root.querySelector('canvas') as ClockCanvas;
        canvas.__lollyFrameDriven = true;
        const sample = (t: number) => { canvas.__lollyFrameRender(t, 60); return root.querySelector('.ag-live')!.innerHTML + canvas.toDataURL(); };
        const first = sample(.2); sample(.8); return first === sample(.2);
      }), true);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => {
        // Playback replaces title nodes; read both styles from the current node.
        const style = getComputedStyle(document.querySelector('.ag-title-text')!);
        return style.whiteSpace === 'normal' && style.transform === 'none';
      });
    } finally { await page.close(); }
  });

  it('restores the interactive programme after a rejected short movie export', async () => {
    const page = await open({ layout: 'page' }, 390, 844);
    try {
      const state = await page.evaluate(() => {
        const root = document.querySelector('[data-portable-root]') as Screen;
        let message = '';
        try { root.__lollyPresentation.prepare('mp4', { width: 1280, height: 720, duration: 1, durationUserSet: true }); }
        catch (error) { message = (error as Error).message; }
        return { message, page: root.classList.contains('ag-page'), search: !!root.querySelector('input[type=search]'), width: root.style.width };
      });
      assert.match(state.message, /needs .* seconds/);
      assert.equal(state.page, true); assert.equal(state.search, true); assert.equal(state.width, '');
      await page.getByRole('searchbox').fill('no session matches this');
      assert.equal(await page.locator('.ag-page-results article').count(), 0);
    } finally { await page.close(); }
  });

  it('keeps a readable programme without scripts or WebGL', async () => {
    for (const scripts of [false, true]) {
      const page = await open({ layout: 'page' }, 320, 700, scripts, true);
      try {
        const selector = scripts ? '.ag-page-results article' : '.ag-fallback article';
        assert.ok(await page.locator(selector).count() > 0);
        assert.equal(await page.locator('[data-portable-root]').evaluate(root => root.scrollWidth <= root.clientWidth + 1), true);
      } finally { await page.close(); }
    }
  });

  it('lays out physical print pages in their requested units', async () => {
    const page = await open();
    try {
      const size = await page.evaluate(() => {
        const root = document.querySelector('[data-portable-root]') as Screen;
        const restore = root.__lollyPresentation.prepare('pdf', {width:210,height:297,unit:'mm'});
        const bounds = root.querySelector('[data-pdf-page]')!.getBoundingClientRect();
        const result = {width:bounds.width,height:bounds.height}; restore(); return result;
      });
      assert.ok(Math.abs(size.width - 210 * 96 / 25.4) < .1);
      assert.ok(Math.abs(size.height - 297 * 96 / 25.4) < .1);
    } finally { await page.close(); }
  });

  it('captures one thumbnail scene while full programme exports still require every page', async () => {
    const sessions = { columns: ['Date','Start','End','Title','Speaker','Room'], rows: Array.from({length: 30}, (_, i) => ['2026-10-14','09:00','12:00','Session ' + i,'Speaker ' + i,'Room ' + i]) };
    const page = await open({sessions},1280,720);
    try {
      const result = await page.evaluate(() => {
        const root = document.querySelector('[data-portable-root]') as Screen;
        let fullError = '';
        try { root.__lollyPresentation.prepare('svg',{width:1280,height:720}); }
        catch (error) { fullError = String(error); }
        const restore = root.__lollyPresentation.prepare('svg',{width:1280,height:720,thumbnail:true});
        const titles = [...root.querySelectorAll('.ag-live .ag-title-text')].map(node => node.textContent);
        const pages = root.querySelectorAll('[data-pdf-page]').length;
        restore();
        return {fullError,titles,pages,restored:!root.classList.contains('ag-export-pages')};
      });
      assert.match(result.fullError,/full programme needs/);
      assert.ok(result.titles.includes('Session 0'));
      assert.ok(result.titles.length < 30);
      assert.equal(result.pages,0);
      assert.equal(result.restored,true);
    } finally { await page.close(); }
  });

  it('keeps playback controls reachable from the attendee page and returns to reading', async () => {
    const page = await open({layout:'page'},390,844);
    try {
      await page.getByRole('button',{name:'Play overview',exact:true}).click();
      await page.getByRole('button',{name:'Pause',exact:true}).click();
      assert.equal(await page.locator('.ag-paused').count(),1);
      await page.getByRole('button',{name:'Programme',exact:true}).click();
      await page.getByRole('searchbox').fill('no session matches');
      assert.equal(await page.getByText('No sessions match these filters.').isVisible(),true);
    } finally { await page.close(); }
  });

  it('keeps room variants operational when the source is a legacy print layout', async () => {
    const page = await open({layout:'grid'});
    try {
      const kit = await page.locator('[data-portable-root]').evaluate(root => (root as Screen).__lollyPresentation.kit());
      const variants = kit.variants;
      assert.match(kit.readme, /Snapshot.*Reference time:/);
      assert.doesNotMatch(kit.readme, /follow the device clock/);
      const room = variants.find(v=>v.name.startsWith('room-'))!;
      assert.ok(room);
      assert.doesNotMatch(room.markup,/class="[^"]*ag-legacy/);
      const contact=variants.find(v=>v.name==='contact-sheet')!;
      assert.equal(contact.static,true);
      assert.match(contact.markup,/ag-contact-sheet/);
      const result=await page.evaluate(() => {
        const root=document.querySelector('[data-portable-root]') as Screen;
        const restoreThumb=root.__lollyPresentation.prepare('svg',{width:1280,height:720,thumbnail:true});
        const thumbnailLegacy=root.classList.contains('ag-legacy');restoreThumb();
        const restore=root.__lollyPresentation.prepare('pdf',{width:1280,height:720});
        const pages=root.querySelectorAll('[data-pdf-page]').length;
        const hidden=root.classList.contains('ag-legacy');restore();return {pages,hidden,thumbnailLegacy,restored:root.classList.contains('ag-legacy')};
      });
      assert.ok(result.pages>0);assert.equal(result.hidden,false);assert.equal(result.thumbnailLegacy,true);assert.equal(result.restored,true);
    } finally {await page.close();}
  });

  it('reports measurable scene coverage and holds each long title for its full travel', async () => {
    const sessions={columns:['Date','Start','End','Title','Room'],rows:Array.from({length:12},(_,i)=>['2026-10-14','09:00','12:00','A long session title about '+('accessible international programmes and useful details '.repeat(4))+i,'Room '+i])};
    const page=await open({sessions,layout:'overview'},1920,1080);
    try {
      const report=JSON.parse((await page.locator('[data-portable-root]').getAttribute('data-coverage'))!);
      assert.equal(report.complete,true);assert.equal(report.items.length,12);assert.ok(report.titlePixels>20);assert.ok(report.anchorPixels>10);assert.ok(report.seconds>=report.scenes*12);
      await page.getByRole('button',{name:'Scenes and coverage',exact:true}).click();
      assert.equal(await page.locator('.ag-coverage .ag-contact-item').count(),report.scenes);
    } finally {await page.close();}
  });
});
