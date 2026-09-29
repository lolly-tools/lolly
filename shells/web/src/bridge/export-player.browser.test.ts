// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { snippetRender, snippetTool } from '../../../../tests/helpers/snippet.ts';

const root = new URL('../../../../', import.meta.url).pathname;
const skip = !existsSync(chromium.executablePath()) && 'Chromium is not installed';
let compiled: Promise<{ player: string; writer: string }> | undefined;
function bundles() {
  if (compiled) return compiled;
  compiled = (async () => {
    const options = { absWorkingDir: root, bundle: true, minify: true, write: false, format: 'iife' as const, platform: 'browser' as const, logLevel: 'silent' as const,
      loader: { '.css': 'empty' as const }, alias: { '@lolly/engine': root + 'engine/src/index.ts' } };
    const [player, writer] = await Promise.all([
      build({ ...options, entryPoints: ['shells/web/src/bridge/portable-player.ts'] }),
      build({ ...options, stdin: { resolveDir: root, contents: `
        import { renderPlayerHtml } from './shells/web/src/bridge/export-player.ts';
        import { renderPortableHtml } from './shells/web/src/bridge/export-portable.ts';
        import { createSequenceTime } from './shells/web/src/bridge/sequence-dom.ts';
        import { rasterBox, plateWindowDemands } from './shells/web/src/bridge/sequence-render.ts';
        import { readLayer } from './shells/web/src/bridge/sequence-plan.ts';
        window.writeHtml = async (opts) => (await renderPlayerHtml(document.querySelector('#tool-canvas'),opts,null)).text();
        window.writePortable = async () => (await renderPortableHtml(document.querySelector('#tool-canvas'), {
          markup: document.querySelector('#tool-canvas').outerHTML, styles: '', script: '', title: 'Font test', lang: 'en'
        })).text();
        window.shadowProof = async () => {
          const box = document.querySelector('.shadow-proof'), layer = readLayer(box, 0, 1000);
          const pad = plateWindowDemands([layer], [0], 1000).get(0).pad;
          const plate = await rasterBox(box, 1, [], { pad });
          return { pad, width: plate.width, alpha: plate.getContext('2d').getImageData(pad + 90, pad + 40, 1, 1).data[3] };
        };
        window.pose = createSequenceTime(document.querySelector('#tool-canvas'));`, loader: 'ts' } }),
    ]);
    assert.ok(player.outputFiles![0]!.contents.length < 100_000, 'the portable player must not embed app translations or catalog bundles');
    return { player: player.outputFiles![0]!.text, writer: writer.outputFiles![0]!.text };
  })();
  return compiled;
}

test('Design HTML preserves scoped styling and seeks offline through the shared timeline', { skip }, async () => {
  const source = await bundles(), browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 800, height: 500 } });
    const page = await context.newPage();
    await page.route('http://lolly.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    await page.route('**/portable/player.js', route => route.fulfill({ contentType: 'text/javascript', body: source.player }));
    await page.goto('http://lolly.test/');
    await page.setContent(`<style data-lolly-scope="#tool-canvas">#tool-canvas .lolly-box{position:absolute;font:40px sans-serif;color:rgb(80,20,160)}</style>
      <div id="tool-canvas" style="width:640px;height:360px"><div class="artboard" data-sequence data-seq-ms="2000" style="position:relative;width:640px;height:360px;background:#eee">
      <div class="lolly-box" data-t-start="0" data-t-dur="2000" data-t-enter="fade" data-t-enter-ms="500" style="left:50px;top:50px;width:300px;height:100px">Editable text</div></div></div>`);
    await page.addScriptTag({ content: source.writer });
    const before = await page.evaluate(() => { (window as any).pose.apply(750); return document.querySelector('.lolly-box')!.getAttribute('style'); });
    const html = await page.evaluate(() => (window as any).writeHtml({ sourceDocument: { toolId: 'design', values: {} } }));
    assert.equal(await page.locator('.lolly-box').getAttribute('style'), before, 'export restores the editor pose');
    const offline = await context.newPage(), requests: string[] = [], errors: string[] = [];
    offline.on('pageerror', error => errors.push(error.message));
    await offline.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    await offline.setContent(html);
    await offline.evaluate(() => (window as any).lollyPlayer.ready);
    assert.equal(await offline.locator('.lolly-box').evaluate(el => getComputedStyle(el).position), 'absolute');
    assert.equal(await offline.locator('.lolly-box').evaluate(el => getComputedStyle(el).color), 'rgb(80, 20, 160)');
    assert.equal(await offline.evaluate(() => (window as any).lollyPlayer.playing), false);
    await offline.getByRole('button', { name: 'Play animation', exact: true }).click();
    await offline.waitForFunction(() => (window as any).lollyPlayer.time > .1);
    await offline.getByRole('button', { name: 'Pause', exact: true }).click();
    const poses = [];
    for (const seconds of [.25, 1.5, .25]) {
      await offline.evaluate(t => (window as any).lollyPlayer.seek(t), seconds);
      poses.push(await offline.locator('.lolly-box').getAttribute('style'));
    }
    assert.equal(poses[0], poses[2], 'reverse seeking reproduces the exact pose');
    assert.notEqual(poses[0], poses[1], 'the exported native transition advances');
    assert.equal(await offline.evaluate(() => (window as any).lollyPlayer.time), .25);
    await offline.evaluate(() => (window as any).lollyPlayer.seek(2));
    assert.equal(await offline.getByRole('button', { name: 'Replay animation', exact: true }).count(), 1);
    await offline.setViewportSize({ width: 390, height: 844 });
    const bar = await offline.locator('.lp-bar').boundingBox(); assert.ok(bar && bar.width <= 390);
    assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('portable fonts use one available source per face and keep their descriptors offline', { skip }, async () => {
  const source = await bundles(), browser = await chromium.launch();
  const font = readFileSync(root + 'shells/web/public/fonts/SUSE[wght].woff2');
  try {
    const page = await browser.newPage(), requested: string[] = [];
    await page.route('http://lolly.test/**', route => {
      const path = new URL(route.request().url()).pathname;
      requested.push(path);
      if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' });
      if (path.endsWith('available.woff2')) return route.fulfill({ contentType: 'font/woff2', body: font });
      return route.fulfill({ status: 404, body: 'Missing font' });
    });
    await page.goto('http://lolly.test/');
    await page.setContent(`<style>
      @font-face { font-family: 'Portable font'; src: url('/available.woff2') format('woff2'), url('/unused.woff2') format('woff2'); font-weight: 100 900; font-display: swap; unicode-range: U+0000-007F; }
      @font-face { font-family: 'Portable font'; src: url('/missing.woff2') format('woff2'), url('/subset-available.woff2') format('woff2'); font-weight: 100 900; font-display: swap; unicode-range: U+0080-00FF; }
      </style><div id="tool-canvas" style="font:700 40px 'Portable font'">Editable café</div>`);
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ content: source.writer });
    requested.length = 0;
    const html: string = await page.evaluate(() => (window as any).writePortable());
    assert.deepEqual(requested, ['/available.woff2', '/missing.woff2', '/subset-available.woff2']);
    const offline = await browser.newPage(), external: string[] = [];
    await offline.route('**/*', route => { external.push(route.request().url()); return route.abort(); });
    await offline.setContent(html);
    await offline.evaluate(() => document.fonts.ready);
    const faces = await offline.evaluate(() => [...document.fonts].map(face => ({ status: face.status, weight: face.weight, range: face.unicodeRange })));
    assert.deepEqual(faces, [
      { status: 'loaded', weight: '100 900', range: 'U+0-7F' },
      { status: 'loaded', weight: '100 900', range: 'U+80-FF' },
    ]);
    assert.deepEqual(external, []);
    await page.evaluate(() => {
      const rule = document.styleSheets[0]!.cssRules[0] as CSSFontFaceRule;
      rule.style.setProperty('src', 'url(/missing-one.woff2), url(/missing-two.woff2)');
    });
    await assert.rejects(page.evaluate(() => (window as any).writePortable()), /document resource could not be embedded/);
  } finally { await browser.close(); }
});

test('Snippet HTML replays its declared scene offline with the same shared controls', { skip }, async () => {
  const source = await bundles(), browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    await page.route('http://lolly.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    await page.route('**/portable/player.js', route => route.fulfill({ contentType: 'text/javascript', body: source.player }));
    await page.goto('http://lolly.test/');
    const rendered = await snippetRender({ scene: 'autocomplete', code: 'const message = "Hello from Lolly";', language: 'javascript' });
    await page.setContent(`<div id="tool-canvas" style="width:1200px;height:800px">${rendered.html}</div>`);
    await page.addScriptTag({ content: source.writer });
    const html = await page.evaluate(doc => (window as any).writeHtml({ portableDocument: doc }), {
      markup: rendered.html, styles: '', script: snippetTool.presentationSource!, title: 'Snippet', lang: 'en',
    });
    const offline = await browser.newPage(), requests: string[] = [], errors: string[] = [];
    offline.on('pageerror', error => errors.push(error.message));
    await offline.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    await offline.setContent(html); await offline.evaluate(() => (window as any).lollyPlayer.ready);
    const duration = await offline.evaluate(() => (window as any).lollyPlayer.duration);
    const states = [];
    for (const seconds of [0, duration * .5, duration, duration * .5]) {
      await offline.evaluate(t => (window as any).lollyPlayer.seek(t), seconds);
      states.push(await offline.locator('#cc-code').textContent());
    }
    assert.equal(states[0], ''); assert.equal(states[2], 'const message = "Hello from Lolly";');
    assert.equal(states[1], states[3]); assert.notEqual(states[0], states[2]);
    assert.equal(await offline.locator('.cc-playback').isVisible(), false);
    assert.equal(await offline.getByRole('navigation', { name: 'Animation controls' }).count(), 1);
    assert.equal(await offline.getByRole('button', { name: 'Mute', exact: true }).count(), 0, 'silent scenes have no sound control');
    assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('multi-scene HTML preserves child motion, isolated cameras, fitted pages and chapter navigation offline', { skip }, async () => {
  const source = await bundles(), browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('http://lolly.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    await page.route('**/portable/player.js', route => route.fulfill({ contentType: 'text/javascript', body: source.player }));
    await page.goto('http://lolly.test/');
    await page.setContent(`<style data-lolly-scope="#tool-canvas">#tool-canvas .lolly-box{position:absolute;font:32px sans-serif}#tool-canvas .seq-off{visibility:hidden}</style>
      <div id="tool-canvas" style="width:1600px;height:600px"><div class="lolly-frames" data-sequence data-seq-ms="6000" data-deck-transition="fade">
      <div data-pdf-page data-frame-id="a" data-frame-name="First scene" data-t-start="0" data-t-dur="2000" data-t-lane="seq" style="position:absolute;left:100px;top:50px;width:640px;height:360px;background:#e8d0ff">
        <div class="lolly-box" data-box-id="first" style="left:40px;top:50px;width:400px;height:60px">First scene</div>
        <div class="lolly-box" data-t-kf="t0_x80" style="width:1px;height:1px"><i data-cam></i></div>
      </div>
      <div data-pdf-page data-frame-id="b" data-frame-name="Second &lt;scene&gt;" data-t-start="2000" data-t-dur="2000" data-t-lane="seq" style="position:absolute;left:800px;top:80px;width:320px;height:360px;background:#acf0df">
        <div class="lolly-box" data-box-id="second" data-t-start="2000" data-t-dur="2000" data-t-kf="t0_el_x0*t1000_x120" style="left:20px;top:60px;width:220px;height:60px">Second scene</div>
      </div>
      <div data-pdf-page data-frame-id="c" data-frame-name="Closing scene" data-t-start="4000" data-t-dur="2000" data-t-lane="seq" style="position:absolute;left:1200px;top:80px;width:640px;height:360px;background:#fed">
        <div class="lolly-box" data-box-id="closing" data-pr-enter="fade" data-pr-enter-ms="1000" style="left:40px;top:60px;width:400px;height:60px">Closing scene</div>
        <svg data-artwork width="135" height="39"><path d="M0 0H135V39H0Z" fill="purple"/></svg>
      </div><div class="lolly-box" data-box-id="scratch">Scratch content</div></div></div>`);
    await page.addScriptTag({ content: source.writer });
    const expected = await page.evaluate(() => {
      (window as any).pose.apply(2500);
      return { pose: document.querySelector('[data-box-id="second"]')!.getAttribute('style'),
        first: document.querySelector('[data-box-id="first"]')!.getAttribute('style') };
    });
    const before = await page.locator('#tool-canvas').innerHTML();
    const html = await page.evaluate(() => (window as any).writeHtml({ sourceDocument: { toolId: 'design', values: {} } }));
    assert.equal(await page.locator('#tool-canvas').innerHTML(), before, 'export restores every scene pose and timing attribute');
    const offline = await browser.newPage(), requests: string[] = [], errors: string[] = [];
    offline.on('pageerror', error => errors.push(error.message));
    await offline.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
    await offline.setContent(html); await offline.evaluate(() => (window as any).lollyPlayer.ready);
    assert.deepEqual(await offline.evaluate(() => (window as any).lollyPlayer.scenes.map((scene: any) => [scene.id, scene.start, scene.end])), [['a', 0, 2], ['b', 2, 4], ['c', 4, 6]]);
    assert.equal(await offline.locator('[data-box-id="scratch"]').count(), 0);
    assert.equal(await offline.evaluate(() => (window as any).lollyPlayer.width), 640);
    const poses = [];
    for (const seconds of [2.5, .5, 4.5, 2.5]) {
      await offline.evaluate(t => (window as any).lollyPlayer.seek(t), seconds);
      poses.push(await offline.locator('[data-box-id="second"]').getAttribute('style'));
    }
    assert.equal(poses[0], poses[3]); assert.equal(poses[0], expected.pose);
    assert.match(poses[0]!, /translate\(60px/);
    assert.equal(await offline.locator('[data-box-id="first"]').getAttribute('style'), expected.first, 'another scene camera cannot reach this page');
    assert.equal(await offline.locator('[data-frame-id="b"]').evaluate(el => getComputedStyle(el.parentElement!).left), '160px', 'portrait scene is centred without stretching');
    await offline.evaluate(() => (window as any).lollyPlayer.seek(2.23));
    for (const id of ['a', 'b']) {
      const opacity = Number(await offline.locator(`[data-frame-id="${id}"]`).evaluate(el => getComputedStyle(el).opacity));
      assert.ok(opacity > 0 && opacity < 1, 'both pages blend, including the page containing a camera');
    }
    await offline.getByRole('button', { name: 'Scenes', exact: true }).click();
    await offline.getByRole('button', { name: '0:04 Closing scene' }).click();
    assert.equal(await offline.evaluate(() => (window as any).lollyPlayer.time), 4);
    await offline.keyboard.press('PageUp');
    assert.equal(await offline.evaluate(() => (window as any).lollyPlayer.time), 2, 'chapter keys work after choosing a scene with the button');
    await offline.keyboard.press('PageDown');
    assert.equal(await offline.evaluate(() => (window as any).lollyPlayer.time), 4);
    await offline.evaluate(() => (window as any).lollyPlayer.seek(4.5));
    const opacity = Number(await offline.locator('[data-box-id="closing"]').evaluate(el => getComputedStyle(el).opacity));
    assert.ok(opacity > 0 && opacity < 1, 'a with-the-scene entrance begins on its own scene clock');
    assert.equal(await offline.locator('[data-artwork]').evaluate(el => getComputedStyle(el).width), '135px', 'player icon styling cannot resize SVG artwork or shaped text');
    await offline.setViewportSize({ width: 390, height: 844 });
    await offline.getByRole('button', { name: 'Scenes', exact: true }).click();
    const menu = await offline.getByRole('navigation', { name: 'Scenes', exact: true }).boundingBox();
    assert.ok(menu && menu.x >= 0 && menu.x + menu.width <= 390);
    const item = await offline.locator('[data-scene-index="2"]').boundingBox();
    assert.ok(item && item.width > 250 && item.height < 65, 'scene labels keep a readable width on mobile');
    await offline.keyboard.press('Escape');
    assert.equal(await offline.getByRole('navigation', { name: 'Scenes', exact: true }).isVisible(), false);
    assert.deepEqual(requests, []); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('movie layer capture retains shadow pixels outside its authored border', { skip }, async () => {
  const source = await bundles(), browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="tool-canvas"><div class="shadow-proof lolly-box" style="width:80px;height:80px;background:#f76;border-radius:12px;box-shadow:12px 16px 12px 0px #000"></div></div>');
    await page.addScriptTag({ content: source.writer });
    const before = await page.locator('.shadow-proof').getAttribute('style');
    const proof = await page.evaluate(() => (window as any).shadowProof());
    assert.equal(proof.pad, 34); assert.equal(proof.width, 148);
    assert.ok(proof.alpha > 0, 'the actual raster contains the outer shadow');
    assert.equal(await page.locator('.shadow-proof').getAttribute('style'), before);
  } finally { await browser.close(); }
});

test('untimed artboards export as chapters with their declared dwell, leaving the source untouched', { skip }, async () => {
  const source = await bundles(), browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('http://lolly.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
    await page.route('**/portable/player.js', route => route.fulfill({ contentType: 'text/javascript', body: source.player }));
    await page.goto('http://lolly.test/');
    await page.setContent('<div id="tool-canvas"><div class="lolly-frames"><div data-pdf-page data-frame-id="a" data-frame-dur="3000" style="width:640px;height:360px">A</div><div data-pdf-page data-frame-id="b" data-frame-dur="2000" style="width:640px;height:360px">B</div></div></div>');
    await page.addScriptTag({ content: source.writer });
    const before = await page.locator('#tool-canvas').innerHTML();
    const html = await page.evaluate(() => (window as any).writeHtml({ sourceDocument: { toolId: 'design', values: {} } }));
    assert.equal(await page.locator('#tool-canvas').innerHTML(), before);
    await page.setContent(html); await page.evaluate(() => (window as any).lollyPlayer.ready);
    assert.equal(await page.evaluate(() => (window as any).lollyPlayer.duration), 5);
    assert.equal(await page.evaluate(() => (window as any).lollyPlayer.scenes[1].start), 3);
  } finally { await browser.close(); }
});
