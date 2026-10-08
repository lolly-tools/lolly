// SPDX-License-Identifier: MPL-2.0
// The Design web page box (plan 288 M3): the kind, its fields, the marker the hook emits,
// and what the read model and the compact URL make of the box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { serializeUrlState, parseUrlState } from '../engine/src/url-mode.ts';
import { buildInputModel } from '../engine/src/inputs.ts';
import type { InputModelItem } from '../engine/src/inputs.ts';
import { inspectDesignV1 } from '../packages/core/src/design-v1.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const designTool: any = await loadTool('design', (path: string) => readFile(join(ROOT, 'community', path), 'utf8'));
const boxesField = designTool.manifest.inputs.find((i: { id: string }) => i.id === 'boxes');

const webBox = (extra: Record<string, unknown> = {}) => ({
  id: 'demo', kind: 'web', x: 100, y: 80, w: 960, h: 540, bg: '', shape: 'rounded', text: '',
  web: 'https://lolly.tools/#/tool/sandbox?html=%3Ch1%3Ehi', ...extra,
});

async function marker(box: Record<string, unknown>): Promise<HTMLElement> {
  const rt = await createRuntime(designTool, baseHost(), { boxes: [box] as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const html = rt.getHydrated() as string;
  const doc = new JSDOM(`<body>${html}</body>`).window.document;
  assert.equal(doc.querySelector('iframe'), null, 'the hook never emits a frame');
  const el = doc.querySelector('.lolly-box-web') as HTMLElement | null;
  assert.ok(el, 'the web marker is emitted');
  return el!;
}

test('web keeps its original fields and appends interaction fields', () => {
  const kind = boxesField.fields.find((f: { id: string }) => f.id === 'kind');
  assert.ok(kind.options.some((o: { value: string }) => o.value === 'web'));
  const add = boxesField.canvas.addKinds.find((k: { id: string }) => k.id === 'web');
  assert.equal(add.seed.kind, 'web');
  const ids = boxesField.fields.map((f: { id: string }) => f.id);
  assert.deepEqual(ids.slice(114), ['web', 'webView', 'webLoad', 'webCss', 'webHideCookies', 'interact', 'interactOpts']);
  for (const id of ['web', 'webView', 'webLoad', 'webCss', 'webHideCookies', 'interact', 'interactOpts']) {
    assert.deepEqual(boxesField.fields.find((f: { id: string }) => f.id === id).showFor, [], `${id} is edited in the inspector, not the sidebar`);
  }
  const load = boxesField.fields.find((f: { id: string }) => f.id === 'webLoad');
  assert.deepEqual(load.options.map((o: { value: string }) => o.value), ['slide', 'early', 'keep', 'click']);
});

test('the marker carries the link inert, with a placeholder card when there is no poster', async () => {
  const el = await marker(webBox({ name: 'Live demo', webView: 1280, webLoad: 'keep' }));
  assert.equal(el.dataset.lollyWeb, 'https://lolly.tools/#/tool/sandbox?html=%3Ch1%3Ehi');
  assert.equal(el.dataset.webView, '1280');
  assert.equal(el.dataset.webLoad, 'keep');
  assert.equal(el.dataset.webState, 'poster');
  assert.equal(el.querySelector('.lolly-box-web-label')?.textContent, 'Sandbox demo');
  assert.equal(el.querySelector('.lolly-box-web-title')?.textContent, 'Live demo');
  assert.equal(el.querySelector('[src]'), null, 'nothing loads from the link');
});

test('a poster is drawn as an image, and a site link names its host', async () => {
  const el = await marker(webBox({ web: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', image: { id: 'user/p', type: 'raster', url: 'data:image/png;base64,AAAA' } }));
  const img = el.querySelector('img.lolly-box-web-poster') as HTMLImageElement | null;
  assert.ok(img, 'the poster is an <img>');
  assert.ok(img!.getAttribute('src') && !/youtube/.test(img!.getAttribute('src')!), 'its src is the poster asset, never the link');
  assert.equal(img!.getAttribute('alt'), 'youtube.com');
  const card = await marker(webBox({ web: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }));
  assert.equal(card.querySelector('.lolly-box-web-label')?.textContent, 'youtube.com');
  const empty = await marker(webBox({ web: '' }));
  assert.equal(empty.querySelector('.lolly-box-web-label')?.textContent, 'Web page');
  assert.equal(empty.dataset.webLoad, 'slide', 'the default load rule');
});

test('a hostile link stays an attribute value', async () => {
  const el = await marker(webBox({ web: 'https://x.example/"><img src=x onerror=alert(1)>', name: '<b>t</b>' }));
  assert.equal(el.dataset.lollyWeb, 'https://x.example/"><img src=x onerror=alert(1)>');
  assert.equal(el.querySelectorAll('img').length, 0, 'no element was injected');
  assert.equal(el.querySelector('.lolly-box-web-title')?.textContent, '<b>t</b>');
});

test('page appearance is inert, escaped and absent from unchanged objects', async () => {
  const css = 'h1::after { content: "</style><img src=x onerror=alert(1)>"; }';
  const el = await marker(webBox({ webCss: css, webHideCookies: true }));
  assert.equal(el.dataset.webCss, css);
  assert.equal(el.dataset.webHideCookies, '1');
  assert.equal(el.querySelectorAll('style,img').length, 0);
  const plain = await marker(webBox());
  assert.equal(plain.hasAttribute('data-web-css'), false);
  assert.equal(plain.hasAttribute('data-web-hide-cookies'), false);
});

test('the read model reports the link, a missing link and a missing poster', () => {
  const report = inspectDesignV1([webBox(), webBox({ id: 'b2', web: '' })]);
  const layer = report.layers.find((l) => l.id === 'demo')!;
  assert.equal(layer.kind, 'web');
  assert.equal(layer.web, 'https://lolly.tools/#/tool/sandbox?html=%3Ch1%3Ehi');
  const ids = report.findings.map((f) => `${f.id}:${f.layerId}`);
  assert.ok(ids.includes('design.web.no-poster:demo'));
  assert.ok(ids.includes('design.web.empty:b2'));
  assert.ok(!report.findings.some((f) => f.id === 'design.layer.kind-unknown'));
});

test('a link with commas and tildes survives the compact URL', () => {
  const link = 'https://example.com/a,b~c?x=1,2&y=~3';
  const css = 'h1 { color: red; } /* commas, and ~tildes */';
  const model = buildInputModel(designTool.manifest, { initial: { boxes: [webBox({ web: link, webCss: css, webHideCookies: true })] as never } });
  const query = serializeUrlState(model as InputModelItem[], { keepUserIds: true });
  const back = parseUrlState(query, designTool.manifest).values.boxes as Record<string, unknown>[];
  assert.equal(back[0]!.kind, 'web');
  assert.equal(back[0]!.web, link);
  assert.equal(back[0]!.webCss, css);
  assert.equal(String(back[0]!.webHideCookies), 'true');
});


test('interaction attributes remain inert and escaped, with no focus step on legacy objects', async () => {
  const wire = 'hl=ring;stops=0,640,%23pricing;hlc="><img src=x>';
  const live = await marker(webBox({ interact: 0, interactOpts: wire }));
  assert.equal(live.dataset.interact, '0');
  assert.equal(live.dataset.interactOpts, wire);
  assert.equal(live.querySelector('img,iframe'), null);
  const legacy = await marker(webBox());
  assert.equal(legacy.hasAttribute('data-interact'), false);
  assert.equal(legacy.hasAttribute('data-interact-opts'), false);
  const disabled = await marker(webBox({ interact: '' }));
  assert.equal(disabled.hasAttribute('data-interact'), false);
});

test('interaction step zero and encoded stops survive a compact URL round trip', () => {
  const interactOpts = 'hl=spotlight;stops=0,%23price%2Cvariants,100%25;auto=focus;hand=1';
  const model = buildInputModel(designTool.manifest, { initial: { boxes: [webBox({ interact: 0, interactOpts })] as never } });
  const query = serializeUrlState(model as InputModelItem[], { keepUserIds: true });
  const back = parseUrlState(query, designTool.manifest).values.boxes as Record<string, unknown>[];
  assert.equal(String(back[0]!.interact), '0');
  assert.equal(back[0]!.interactOpts, interactOpts);
});
