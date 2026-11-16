// SPDX-License-Identifier: MPL-2.0
/**
 * Shared browser harness for the 3D Studio renderer suites.
 *
 * Every studio browser file uses this module instead of building its own page, so a
 * new suite adds one test file and touches no other. The page is a bare document
 * with the studio mount module bundled into it, the hydrated 3d-studio template
 * (expert controls) and a small page API, `window.studioTest`.
 *
 * Node API:
 *   studioSkip                  false, or the skip reason when Playwright Chromium is missing.
 *   startStudioHarness(options) takes the encode tier (holdEncodeTier), builds the bundles,
 *                               loads the template, serves the page and fixtures, and launches
 *                               headless Chromium. It returns a StudioHarness:
 *     origin                    the fixture server, http://127.0.0.1:<port>.
 *     errors                    page errors and console errors from every page opened.
 *     open(bundle?)             a new page with the default bundle, or a named extra bundle.
 *     render(page, values)      studioTest.render(values), returning a StudioFrame.
 *     rendererName(page)        UNMASKED_RENDERER_WEBGL from a throwaway context, or 'unknown'.
 *     close()                   closes Chromium and the server, then releases the tier.
 *   studioPageSource(mount)     the page API source, importing the mount module at `mount`.
 *   studioDefaults              the values every render() starts from (harness colours, 8 samples).
 *   saveShot(file, png)         writes a data URL PNG under STUDIO_SHOTS when it is set.
 *   fixtureSvg, tetraStl, tetraBinaryStl, radianceHdr(), radianceExr()
 *                               the fixture generators behind the default routes.
 *
 * Options:
 *   size         the #content box in CSS px (default 360); the viewport matches it.
 *   routes       extra routes merged over the defaults. A value is bytes, a string, a
 *                function of the request path that resolves to either, or null for an
 *                empty 204 answer. A key ending in `*` matches every path with that prefix.
 *                A route that throws answers 404; a path with no route gets the page.
 *   extraSource  page code appended to the default bundle. It may import repo modules by
 *                a path relative to the repo root (imports are hoisted, so they may come
 *                anywhere in it; alias a name the page source already imports) and may add
 *                methods to window.studioTest. It shares the page source's top-level names:
 *                container (#content), read and shapeText (the mount options render() uses),
 *                mountToolStudio, prepareToolStudio, destroyToolStudio, studioCanvas(),
 *                nextFrame() (resolves on the next animation frame),
 *                stageTemplate(values) (a fresh template with the defaults under `values`;
 *                returns the marker) and readFrame(marker, previous) (a StudioFrame of the
 *                canvas as it is now).
 *   bundles      extra named bundles: { resolveDir, mountModule, nodePaths?, extraSource? }.
 *                Each is the same page API with its mount import pointed at mountModule
 *                (relative to resolveDir), served at /bundle-<name>.js and opened with
 *                open(name). nodePaths defaults to this checkout's node_modules folders, so
 *                an extracted tree outside the repo still resolves `three`.
 *
 * Default routes: /bundle.js, /fixture.svg, /duck.glb (community/3d/assets), /bad.glb,
 * /tetra.stl, /binary.stl, /light.hdr, /light.exr, /icons/<file> (the twelve public icon
 * fixtures, see studio3d-icons.ts) and /favicon.ico (204). With STUDIO_SUSE set,
 * /geeko/<id> and /suse/<id> serve the private SUSE models and icons.
 *
 * Page API, window.studioTest:
 *   render(values)   mounts the template with studioDefaults under `values`, waits two
 *                    animation frames (so the new marker's first resize callback finds the
 *                    cached preview instead of drawing a later one), prepares an export
 *                    frame and returns it. `__noShaper: true` mounts without the text shaper.
 *   prepare(), destroy()   prepareToolStudio and destroyToolStudio on #content.
 *   sample(time)     a 5 second clip frame at `time`, as a data URL.
 *   resample(size)   an export frame at a pixel size; returns the canvas and CSS sizes.
 *   race()           a stale slow load followed by a newer one; returns the final state.
 *   frameDriven(on)  raises or clears __lollyFrameDriven on the studio canvas.
 * window.shaped lists every call to the stand-in shaper, which draws each letter as a box.
 *
 * Flag hygiene: only frameDriven(true) leaves __lollyFrameDriven raised. render() does not
 * touch it (mountToolStudio sets ready to false before its first await, so a resize cannot
 * paint a half-built scene), and sample() and resample() raise it for their own call and
 * put back the value they found in a finally block.
 *
 * Environment: STUDIO_NATIVE=1 launches Chromium with the Metal ANGLE backend instead of
 * software WebGL, STUDIO_SUSE enables the private routes, STUDIO_SHOTS names the folder
 * saveShot writes to.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { Socket } from 'node:net';
import { extname, isAbsolute, join, resolve } from 'node:path';
import { build } from 'esbuild';
import { type Browser, chromium, type Page } from 'playwright';
import { loadTool } from '../../engine/src/loader.ts';
import { createRuntime } from '../../engine/src/runtime.ts';
import { baseHost } from './host.ts';
import { holdEncodeTier } from './sequence-browser.ts';
import { studioIconsDir } from './studio3d-icons.ts';

const root = resolve(import.meta.dirname, '..', '..');
const MOUNT_MODULE = 'shells/web/src/lib/studio3d/mount.ts';

/** Why the studio browser suites cannot run here, or false when they can. */
export const studioSkip: false | string =
  !existsSync(chromium.executablePath()) && 'Install Playwright Chromium for 3D Studio coverage';

export type StudioValues = Record<string, unknown>;

/** One prepared export frame, read back through a 2D copy (so the pixels are un-premultiplied). */
export interface StudioFrame {
  /** The studio canvas as a PNG data URL. */
  png: string;
  /** RGBA bytes, row by row. */
  pixels: number[];
  width: number;
  height: number;
  /** The scene's source notes, kept on the marker (lib/studio3d/mount.ts). */
  info: string;
  /** The marker's data-studio-state. */
  state: string;
  /** Fixture reads made by this page so far. */
  reads: number;
  /** True when the mount kept the canvas the previous render used. */
  reused: boolean;
}

export interface StudioResample {
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
}

export interface StudioTestApi {
  render(values: StudioValues): Promise<StudioFrame>;
  prepare(): void;
  destroy(): void;
  sample(time: number): string;
  resample(size: { width: number; height: number }): StudioResample;
  race(): Promise<string>;
  frameDriven(on: boolean): void;
}

declare global {
  interface Window {
    /** The 3D Studio harness page API (tests/helpers/studio3d-browser.ts). */
    studioTest?: StudioTestApi;
    /** Calls to the harness's stand-in shaper: [line, font role, weight, size]. */
    shaped?: [string, string, number, number][];
  }
}

export type StudioRouteBody = Uint8Array | string;
export type StudioRoute = StudioRouteBody | ((path: string) => Promise<StudioRouteBody>) | null;

export interface StudioBundle {
  /** The directory the mount import and nodePaths resolve from. */
  resolveDir: string;
  /** The studio mount module, relative to resolveDir. */
  mountModule: string;
  /** Folders searched for bare imports such as `three`. */
  nodePaths?: string[];
  /** Page code appended to this bundle, resolved from resolveDir. */
  extraSource?: string;
}

export interface StudioHarnessOptions {
  size?: number;
  routes?: Record<string, StudioRoute>;
  extraSource?: string;
  bundles?: Record<string, StudioBundle>;
}

export interface StudioHarness {
  origin: string;
  errors: string[];
  open(bundle?: string): Promise<Page>;
  render(page: Page, values: StudioValues): Promise<StudioFrame>;
  rendererName(page: Page): Promise<string>;
  close(): Promise<void>;
}

/** The values every render() starts from: the harness colours and 8 samples. */
export const studioDefaults = {
  colorA: '#30ba78',
  colorB: '#0c322c',
  background: '#0c322c',
  background2: '#30ba78',
  samples: 8,
} as const;

/** A ring and a bolt in two inline fills on a 40-unit viewBox. */
export const fixtureSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="#30ba78" d="M20 1a19 19 0 1 1 0 38a19 19 0 1 1 0-38M20 6a14 14 0 1 0 0 28a14 14 0 1 0 0-28"/><path fill="#0c322c" d="M21 8L11 24h7v9l12-17h-9z"/></svg>';

const facets = [
  [
    [0, 0, 0],
    [0, 1, 0],
    [1, 0, 0],
  ],
  [
    [0, 0, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
];

/** A unit tetrahedron as an ASCII STL file. */
export const tetraStl =
  'solid tetra\n' +
  facets
    .map(
      (f) =>
        'facet normal 0 0 0\nouter loop\n' +
        f.map((v) => 'vertex ' + v.join(' ')).join('\n') +
        '\nendloop\nendfacet'
    )
    .join('\n') +
  '\nendsolid tetra';

/** The same tetrahedron as a binary STL file. */
export const tetraBinaryStl = new Uint8Array(84 + facets.length * 50);
const stlView = new DataView(tetraBinaryStl.buffer);
stlView.setUint32(80, facets.length, true);
for (const [i, f] of facets.entries())
  for (const [j, n] of f.flat().entries()) stlView.setFloat32(84 + i * 50 + 12 + j * 4, n, true);

/**
 * A 16 by 8 radiance map lit over the longitudes that face +x, which is the middle half
 * of an equirectangular strip, and dark elsewhere, so one side of a mirror sphere reads bright.
 */
export function radianceHdr(width = 16, height = 8): Uint8Array {
  const header = new TextEncoder().encode(
    `#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`
  );
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Exponent 129 doubles the mantissa: about 1.95 radiance on the lit side.
      if (x >= width / 4 && x < (3 * width) / 4) pixels.set([250, 220, 170, 129], i);
      else pixels.set([6, 6, 8, 128], i);
    }
  const out = new Uint8Array(header.length + pixels.length);
  out.set(header);
  out.set(pixels, header.length);
  return out;
}

/** The same map as an uncompressed OpenEXR file with FLOAT channels. */
export function radianceExr(): Uint8Array {
  const width = 16,
    height = 8;
  const parts: Uint8Array[] = [];
  const text = (value: string) => new TextEncoder().encode(value + '\0');
  const int32 = (...values: number[]) => {
    const view = new DataView(new ArrayBuffer(values.length * 4));
    for (const [i, value] of values.entries()) view.setInt32(i * 4, value, true);
    return new Uint8Array(view.buffer);
  };
  const float32 = (...values: number[]) => {
    const view = new DataView(new ArrayBuffer(values.length * 4));
    for (const [i, value] of values.entries()) view.setFloat32(i * 4, value, true);
    return new Uint8Array(view.buffer);
  };
  const attribute = (name: string, type: string, value: Uint8Array) =>
    parts.push(text(name), text(type), int32(value.length), value);
  parts.push(int32(20000630, 2));
  const channels: Uint8Array[] = [];
  for (const channel of ['B', 'G', 'R'])
    channels.push(text(channel), int32(2), new Uint8Array([0, 0, 0, 0]), int32(1, 1));
  channels.push(new Uint8Array([0]));
  attribute('channels', 'chlist', Uint8Array.from(channels.flatMap((c) => [...c])));
  attribute('compression', 'compression', new Uint8Array([0]));
  attribute('dataWindow', 'box2i', int32(0, 0, width - 1, height - 1));
  attribute('displayWindow', 'box2i', int32(0, 0, width - 1, height - 1));
  attribute('lineOrder', 'lineOrder', new Uint8Array([0]));
  attribute('pixelAspectRatio', 'float', float32(1));
  attribute('screenWindowCenter', 'v2f', float32(0, 0));
  attribute('screenWindowWidth', 'float', float32(1));
  parts.push(new Uint8Array([0]));
  const headerLength = parts.reduce((n, part) => n + part.length, 0);
  const chunkLength = 8 + width * 4 * 3;
  const offsets = new DataView(new ArrayBuffer(height * 8));
  for (let y = 0; y < height; y++)
    offsets.setBigUint64(y * 8, BigInt(headerLength + height * 8 + y * chunkLength), true);
  parts.push(new Uint8Array(offsets.buffer));
  const lit: Record<string, number> = { B: 1.33, G: 1.72, R: 1.95 };
  for (let y = 0; y < height; y++) {
    const line: number[] = [];
    for (const channel of ['B', 'G', 'R'])
      for (let x = 0; x < width; x++) line.push(x >= 4 && x < 12 ? lit[channel]! : 0.023);
    parts.push(int32(y, width * 4 * 3), float32(...line));
  }
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Writes a PNG data URL to STUDIO_SHOTS/<file> when STUDIO_SHOTS is set; otherwise does nothing. */
export async function saveShot(file: string, png: string): Promise<void> {
  const dir = process.env.STUDIO_SHOTS;
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, file), Buffer.from(png.split(',')[1] ?? '', 'base64'));
}

/**
 * The page API source (see the header). `mountModule` is resolved from the bundle's
 * resolveDir; a bare path such as `shells/web/src/lib/studio3d/mount.ts` is taken as relative.
 */
export function studioPageSource(mountModule: string): string {
  const specifier =
    mountModule.startsWith('./') || mountModule.startsWith('../') || isAbsolute(mountModule)
      ? mountModule
      : './' + mountModule;
  return `
import { mountToolStudio, prepareToolStudio, destroyToolStudio } from ${JSON.stringify(specifier)};
const container = document.querySelector('#content');
const studioDefaults = ${JSON.stringify(studioDefaults)};
let reads = 0;
const read = async (url, signal) => {
  reads++;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Fixture missing');
  return new Uint8Array(await res.arrayBuffer());
};
// A stand-in for the host's HarfBuzz shaper: every letter is a box, so the text
// pipeline (lines, alignment, extrusion) is exercised without a font file.
window.shaped = [];
const shapeText = async (line, font, size) => {
  window.shaped.push([line, font.font, font.weight, size]);
  if (font.font === 'missing') throw new Error('The font "missing" is not available on this device.');
  const w = size * 0.6, adv = w + size * 0.1 + font.tracking * size;
  let d = '';
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ' ') continue;
    const x = i * adv;
    d += 'M' + x + ' ' + (-size * 0.7) + 'h' + w + 'v' + (size * 0.7) + 'h' + (-w) + 'Z';
  }
  return { d, advance: line.length * adv };
};
const studioCanvas = () => {
  const canvas = container.querySelector('canvas');
  if (!canvas) throw new Error('No studio canvas is mounted.');
  return canvas;
};
// A fresh template in #content with the harness defaults under the given values.
const stageTemplate = (values) => {
  container.innerHTML = window.fixtureTemplate;
  const marker = container.querySelector('[data-lolly-studio]');
  marker.dataset.lollyStudio = JSON.stringify({ version: 1, values: { ...studioDefaults, ...values } });
  return marker;
};
// The canvas as it is now, read through a 2D copy.
const readFrame = (marker, previous) => {
  const canvas = studioCanvas();
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  return {
    png: canvas.toDataURL(),
    pixels: Array.from(ctx.getImageData(0, 0, copy.width, copy.height).data),
    width: canvas.width,
    height: canvas.height,
    info: marker.dataset.studioNotes || '',
    state: marker.dataset.studioState,
    reads,
    reused: !previous || previous === canvas,
  };
};
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
// Raise the capture flag for one call only, and put back the value that was there.
const frameDriven = (run) => {
  const canvas = studioCanvas();
  const was = canvas.__lollyFrameDriven === true;
  canvas.__lollyFrameDriven = true;
  try {
    return run(canvas);
  } finally {
    canvas.__lollyFrameDriven = was;
  }
};
window.studioTest = {
  async render(values) {
    const previous = container.querySelector('canvas');
    const marker = stageTemplate(values);
    await mountToolStudio(container, { read, shapeText: values.__noShaper ? undefined : shapeText });
    // The new marker's first resize callback comes with the next painted frame. Waiting two
    // frames lets it find the preview the mount already drew (a cached frame), instead of
    // drawing another preview at some point after render() returns.
    await nextFrame();
    await nextFrame();
    prepareToolStudio(container);
    return readFrame(marker, previous);
  },
  prepare() {
    prepareToolStudio(container);
  },
  destroy() {
    destroyToolStudio(container);
  },
  sample(time) {
    return frameDriven((canvas) => {
      canvas.__lollyFrameRender(time, 5);
      return canvas.toDataURL();
    });
  },
  resample(size) {
    return frameDriven((canvas) => {
      canvas.__lollyFrameRender(0, undefined, size);
      const box = canvas.getBoundingClientRect();
      return { width: canvas.width, height: canvas.height, cssWidth: Math.round(box.width), cssHeight: Math.round(box.height) };
    });
  },
  async race() {
    container.innerHTML = window.fixtureTemplate;
    const marker = container.querySelector('[data-lolly-studio]');
    marker.dataset.lollyStudio = JSON.stringify({ version: 1, values: { source: 'artwork', artwork: { url: '/slow.svg' }, samples: 8 } });
    let release;
    const delayed = new Promise((resolve) => (release = resolve));
    const slow = mountToolStudio(container, {
      read: async (url, signal) => {
        await delayed;
        signal.throwIfAborted();
        return read('/fixture.svg', signal);
      },
    });
    marker.dataset.lollyStudio = JSON.stringify({ version: 1, values: { source: 'primitive', primitive: 'sphere', samples: 8 } });
    await mountToolStudio(container, { read });
    release();
    await slow;
    prepareToolStudio(container);
    return marker.dataset.studioState;
  },
  frameDriven(on) {
    studioCanvas().__lollyFrameDriven = Boolean(on);
  },
};
`;
}

async function bundle(
  resolveDir: string,
  contents: string,
  nodePaths: string[] | undefined
): Promise<string> {
  const result = await build({
    stdin: { resolveDir, loader: 'ts', contents },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
    loader: { '.css': 'empty' },
    ...(nodePaths ? { nodePaths } : {}),
  });
  return result.outputFiles[0]!.text;
}

const CONTENT_TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
};

/** One file name segment from a prefix route, refusing anything that could leave the folder. */
function segment(path: string, prefix: string): string {
  const rest = path.slice(prefix.length);
  if (!rest || /[/\\]|^\.\.?$/.test(rest)) throw new Error('Not a fixture name');
  return rest;
}

function defaultRoutes(): Record<string, StudioRoute> {
  const routes: Record<string, StudioRoute> = {
    '/fixture.svg': fixtureSvg,
    '/duck.glb': () => readFile(join(root, 'community/3d/assets/duck.glb')),
    '/bad.glb': 'not a model',
    '/tetra.stl': tetraStl,
    '/binary.stl': tetraBinaryStl,
    '/light.hdr': async () => radianceHdr(),
    '/light.exr': async () => radianceExr(),
    '/icons/*': (path) => readFile(join(studioIconsDir(), segment(path, '/icons/'))),
    '/favicon.ico': null,
  };
  if (process.env.STUDIO_SUSE) {
    routes['/geeko/*'] = (path) =>
      readFile(
        join(root, 'brands/suse/catalog/assets/suse/models', segment(path, '/geeko/') + '.glb')
      );
    routes['/suse/*'] = (path) =>
      readFile(
        join(
          root,
          'brands/suse/catalog/assets/suse/icons',
          'icon-' + segment(path, '/suse/') + '.svg'
        )
      );
  }
  return routes;
}

function findRoute(routes: Record<string, StudioRoute>, path: string): StudioRoute | undefined {
  if (Object.hasOwn(routes, path)) return routes[path];
  let best: string | undefined;
  for (const key of Object.keys(routes))
    if (
      key.endsWith('*') &&
      path.startsWith(key.slice(0, -1)) &&
      (!best || key.length > best.length)
    )
      best = key;
  return best === undefined ? undefined : routes[best];
}

/** Starts the harness described in the header. Call close() in after(), even when a test failed. */
export async function startStudioHarness(
  options: StudioHarnessOptions = {}
): Promise<StudioHarness> {
  const size = options.size ?? 360;
  const bundles = options.bundles ?? {};
  for (const name of Object.keys(bundles))
    if (!/^[a-z0-9-]+$/i.test(name))
      throw new Error(`Bundle name "${name}" must be letters, digits or dashes.`);
  // Software WebGL starves the video encode suites of CPU, so take their tier.
  const releaseTier = await holdEncodeTier();
  let server: Server | undefined;
  let browser: Browser | undefined;
  const sockets = new Set<Socket>();
  const stop = async () => {
    try {
      await browser?.close();
    } finally {
      try {
        for (const socket of sockets) socket.destroy();
        const closing = server;
        if (closing) await new Promise<void>((done) => closing.close(() => done()));
      } finally {
        releaseTier();
      }
    }
  };
  // The lock is a shared folder, so releasing it twice could remove another run's
  // lock: every close() after the first returns the first one's promise.
  let stopped: Promise<void> | undefined;
  const shutdown = () => {
    stopped ??= stop();
    return stopped;
  };
  try {
    const defaultNodePaths = ['node_modules', 'shells/web/node_modules', 'engine/node_modules']
      .map((dir) => join(root, dir))
      .filter((dir) => existsSync(dir));
    const built = await Promise.all([
      bundle(root, studioPageSource(MOUNT_MODULE) + (options.extraSource ?? ''), undefined),
      ...Object.values(bundles).map((spec) =>
        bundle(
          spec.resolveDir,
          studioPageSource(spec.mountModule) + (spec.extraSource ?? ''),
          spec.nodePaths ?? defaultNodePaths
        )
      ),
    ]);
    const routes: Record<string, StudioRoute> = { '/bundle.js': built[0]! };
    for (const [i, name] of Object.keys(bundles).entries())
      routes[`/bundle-${name}.js`] = built[i + 1]!;
    Object.assign(routes, defaultRoutes(), options.routes);

    const tool = await loadTool('3d-studio', (p) => readFile(join(root, 'community', p), 'utf8'));
    const runtime = await createRuntime(tool, baseHost(), { controls: 'expert' });
    const template = runtime.getHydrated();
    runtime.destroy();
    const pageHtml = (name: string | null) =>
      `<!doctype html><html><meta charset="utf-8"><style>html,body{margin:0}#content{width:${size}px;height:${size}px}${tool.styles}</style><div id="content"></div><script>window.fixtureTemplate=${JSON.stringify(template).replace(/</g, '\\u003c')}</script><script src="${name ? `/bundle-${name}.js` : '/bundle.js'}"></script></html>`;

    const listening = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      try {
        const route = findRoute(routes, url.pathname);
        if (route === undefined) {
          const name = url.searchParams.get('bundle');
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(pageHtml(name && Object.hasOwn(bundles, name) ? name : null));
          return;
        }
        if (route === null) {
          res.writeHead(204).end();
          return;
        }
        const body = typeof route === 'function' ? await route(url.pathname) : route;
        const type = CONTENT_TYPES[extname(url.pathname)];
        if (type) res.setHeader('Content-Type', type);
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    });
    server = listening;
    listening.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((done) => listening.listen(0, '127.0.0.1', done));
    const origin = `http://127.0.0.1:${(listening.address() as { port: number }).port}`;
    const launched = await chromium.launch({
      headless: true,
      ...(process.env.STUDIO_NATIVE
        ? { executablePath: chromium.executablePath(), args: ['--use-angle=metal'] }
        : {}),
    });
    browser = launched;
    const errors: string[] = [];
    return {
      origin,
      errors,
      async open(name) {
        if (name !== undefined && !Object.hasOwn(bundles, name))
          throw new Error(`No bundle named "${name}" was built.`);
        const opened = await launched.newPage({ viewport: { width: size, height: size } });
        opened.on('pageerror', (error) => errors.push(error.message));
        opened.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        await opened.goto(origin + (name ? `/?bundle=${name}` : '/'));
        await opened.waitForFunction(() => Boolean(window.studioTest));
        return opened;
      },
      render: (target, values) =>
        target.evaluate(async (values) => window.studioTest!.render(values), values),
      rendererName: (target) =>
        target.evaluate(() => {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (!gl) return 'unknown';
          const debug = gl.getExtension('WEBGL_debug_renderer_info');
          const name = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null;
          gl.getExtension('WEBGL_lose_context')?.loseContext();
          return typeof name === 'string' && name ? name : 'unknown';
        }),
      close: shutdown,
    };
  } catch (error) {
    // A failed start must not hold the tier until the stale takeover.
    await shutdown().catch(() => {});
    throw error;
  }
}
