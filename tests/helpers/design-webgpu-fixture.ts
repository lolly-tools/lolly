// SPDX-License-Identifier: MPL-2.0
/** Real Design hooks and compiled GPU modules on an owned loopback origin. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import { loadTool } from '../../engine/src/loader.ts';
import { createRuntime } from '../../engine/src/runtime.ts';
import { compileDesignDraw, type DesignDrawPage } from '../../engine/src/design-draw.ts';
import { designDrawSvg } from '../../engine/src/design-draw-svg.ts';
import { baseHost } from './host.ts';
import { makeColorApi } from '../../engine/src/color-tools.ts';
import { makeGeomApi } from '../../engine/src/geom-api.ts';
import { makeConnectorsApi } from '../../engine/src/connectors.ts';

export const primitiveRows = (transparent = false): DesignBoxRowV1[] => [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: transparent ? '#ffffff00' : '#f4f1ea' },
  { id: 'rect', frame: 'page', kind: 'box', x: 20, y: 20, w: 90, h: 70, bg: '#d9480f' },
  { id: 'overlap', frame: 'page', kind: 'box', x: 65, y: 65, w: 90, h: 65, bg: '#1c7ed6', opacity: 55 },
  { id: 'rounded', frame: 'page', kind: 'box', x: 180, y: 25, w: 100, h: 60, shape: 'rounded', radius: 18, bg: '#2b8a3e' },
  { id: 'pill', frame: 'page', kind: 'box', x: 180, y: 110, w: 100, h: 40, shape: 'pill', bg: '#862e9c' },
  { id: 'ellipse', frame: 'page', kind: 'box', x: 20, y: 150, w: 100, h: 60, shape: 'ellipse', bg: '#e8590c' },
  { id: 'turned', frame: 'page', kind: 'box', x: 180, y: 180, w: 80, h: 30, rot: 17, flipH: true, flipV: true, bg: '#5c940d' },
  { id: 'outside', frame: 'page', kind: 'box', x: -20, y: 90, w: 50, h: 45, bg: '#e03131' },
];

export function primitiveDrawing(transparent = false): DesignDrawPage {
  return compileDesignDraw(primitiveRows(transparent), { width: 320, height: 240 }, { effects: true, colors: 'resolved' });
}

/** Odd dimensions and fractional output scale put edges between output pixels. */
export const edgeRows = (transparent = false): DesignBoxRowV1[] => [
  { id: 'page', kind: 'frame', x: 0, y: 0, w: 320, h: 240, bg: transparent ? '#ffffff00' : '#f4f1ea' },
  { id: 'gentle', frame: 'page', kind: 'box', x: 32, y: 32, w: 71, h: 39, rot: 5, bg: '#d9480f' },
  { id: 'overlap', frame: 'page', kind: 'box', x: 55, y: 50, w: 69, h: 43, rot: -17, bg: '#1c7ed6', opacity: 55 },
  { id: 'steep', frame: 'page', kind: 'box', x: 180, y: 35, w: 81, h: 31, rot: 37, flipH: true, bg: '#5c940d' },
  { id: 'quarter', frame: 'page', kind: 'box', x: 225, y: 130, w: 41, h: 73, rot: 90, flipV: true, bg: '#862e9c' },
  { id: 'outside', frame: 'page', kind: 'box', x: -20, y: 140, w: 51, h: 39, rot: 17, bg: '#e8590c' },
  { id: 'axis', frame: 'page', kind: 'box', x: 110, y: 180, w: 71, h: 31, bg: '#1c7ed6' },
  { id: 'thin-vertical', frame: 'page', kind: 'box', x: 145, y: 100, w: 1, h: 43, rot: 17, bg: '#e03131' },
  { id: 'thin-horizontal', frame: 'page', kind: 'box', x: 130, y: 150, w: 31, h: 1, rot: -37, bg: '#5c940d', opacity: 55 },
];

export function designGpuCases() {
  const cases = [];
  for (const transparent of [false, true]) for (const scale of [1, 2]) {
    cases.push({ key: `${transparent ? 'transparent' : 'opaque'}-${scale}`, transparent, scaleX: scale, scaleY: scale, rows: primitiveRows(transparent), original: true });
  }
  for (const transparent of [false, true]) for (const [scaleX, scaleY] of [[1, 1], [1.5, 1.5], [1.5, 2]]) {
    cases.push({ key: `edges-${transparent ? 'transparent' : 'opaque'}-${scaleX}x${scaleY}`, transparent, scaleX: scaleX!, scaleY: scaleY!, rows: edgeRows(transparent), original: false });
  }
  return cases.map(c => ({ ...c, drawing: compileDesignDraw(c.rows, { width: 320, height: 240 }, { effects: true, colors: 'resolved' }) }));
}

const program = `
import {prepareDesignRaster} from './engine/src/design-draw-raster.ts';
import {renderDesignRaster} from './shells/web/src/lib/webgpu/design-page.ts';
import {requireWebGpu,resetWebGpuDevice} from './shells/web/src/lib/webgpu/device.ts';
import {createRasterAPI} from './shells/web/src/bridge/raster.ts';
const worker=new Worker('/worker.js',{type:'module'}), pending=new Map(); let id=0;
worker.onmessage=({data})=>{const p=pending.get(data.id);if(p){pending.delete(data.id);clearTimeout(p.timer);p.resolve(data);}};
worker.onerror=e=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error(e.message));}pending.clear();worker.terminate();};
window.designRasterProbe={prepareDesignRaster,renderDesignRaster,requireWebGpu,resetWebGpuDevice,raster:createRasterAPI(),
render(page,output){return new Promise((resolve,reject)=>{const current=++id;const timer=setTimeout(()=>{pending.delete(current);worker.terminate();reject(new Error('Owned primitive worker exceeded 30 seconds'));},30000);pending.set(current,{resolve,reject,timer});worker.postMessage({kind:'render',id:current,page,output});});},
close(){worker.terminate();for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Owned fixture closed'));}pending.clear();}};
`;

export async function createDesignGpuFixture() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const [entry, worker, tool] = await Promise.all([
    build({ stdin: { contents: program, resolveDir: root, sourcefile: 'design-gpu-fixture.ts' }, bundle: true, write: false, format: 'esm', platform: 'browser' }),
    build({ entryPoints: [root + 'shells/web/src/lib/webgpu/design-page-worker.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' }),
    loadTool('design', p => readFile(root + 'community/' + p, 'utf8')),
  ]);
  const pages = new Map<string, string>();
  for (const { key, rows, drawing, scaleX, scaleY, original } of designGpuCases()) {
    const runtime = await createRuntime(tool, Object.assign(baseHost(), { color: makeColorApi(), geom: makeGeomApi(), connectors: makeConnectorsApi() }), { boxes: rows as never });
    assert.deepEqual(runtime.hookErrors ?? [], [], 'real Design hooks rendered without errors');
    const style = '<style>html,body{margin:0;background:transparent}#tool-canvas{position:relative;width:320px;height:240px;overflow:hidden;transform-origin:0 0;transform:scale(' + scaleX + ',' + scaleY + ')}</style>';
    pages.set('/design/' + key, `<!doctype html>${style}<style>${tool.styles ?? ''}</style><div id="tool-canvas">${runtime.getHydrated()}</div>`);
    const svg = designDrawSvg(drawing, { assetHref: () => undefined, family: () => 'system-ui', mono: 'monospace' });
    const svgStyle = original ? `svg{width:${320 * scaleX}px;height:${240 * scaleY}px}` : `svg{width:320px;height:240px;transform-origin:0 0;transform:scale(${scaleX},${scaleY})}`;
    pages.set('/svg/' + key, `<!doctype html><style>html,body{margin:0;background:transparent}${svgStyle}</style>${svg}`);
  }
  const server = createServer((request, response) => {
    const body = request.url === '/entry.js' ? entry.outputFiles[0]!.text : request.url === '/worker.js' ? worker.outputFiles[0]!.text : pages.get(request.url ?? '');
    if (body !== undefined) { response.setHeader('content-type', request.url?.endsWith('.js') ? 'text/javascript' : 'text/html'); response.end(body); }
    else if (request.url === '/') { response.setHeader('content-type', 'text/html'); response.end('<!doctype html><script type="module" src="/entry.js"></script>'); }
    else { response.statusCode = 404; response.end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Owned loopback fixture failed');
  return { origin: `http://127.0.0.1:${address.port}`, sourceHashes: { entry: createHash('sha256').update(entry.outputFiles[0]!.text).digest('hex'), worker: createHash('sha256').update(worker.outputFiles[0]!.text).digest('hex'),
    hooks: createHash('sha256').update(tool.hooksSource ?? '').digest('hex'), styles: createHash('sha256').update(tool.styles ?? '').digest('hex') },
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
