// SPDX-License-Identifier: MPL-2.0
/**
 * Chart's own export preparation survives the web shell's still hold.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test tests/chart-export-hold.test.ts
 *
 * The web shell holds a frame-clock tool still for every export that reads the page
 * (shells/web/src/bridge/frame-clock.ts). Chart prepares its own vector exports in
 * beforeExport: a Statistical chart with Reveal or Build poses its complete poster for SVG,
 * SVGZ and PDF, and a chart animated by a frame column builds a self-contained SMIL
 * flipbook. A hold that called the clock after that hook redrew the entrance's first
 * frame over both: the reveal clip came out 0 wide, every Build mark at opacity 0, and
 * the animated SVG a single static frame. These mount the real template, Observable Plot,
 * d3 and hooks in jsdom, export through the engine runtime the way the web shell wraps
 * it, and read the result.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = new URL('../community/', import.meta.url);
const tool: any = await loadTool('chart', (path: string) => readFile(new URL(path, COMMUNITY), 'utf8'));
const lib = (file: string) => readFileSync(new URL(`chart/lib/${file}`, COMMUNITY), 'utf8');

// One document for the file: the export bridge reads the DOM globals once, at import.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/', runScripts: 'dangerously', pretendToBeVisual: true } as never);
const win = dom.window as unknown as Window & typeof globalThis & { eval(source: string): unknown };
for (const file of ['d3.min.js', 'observable-plot.min.js', 'chart-plot.js']) win.eval(lib(file));
const g = globalThis as Record<string, unknown>;
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLCanvasElement', 'SVGElement', 'NodeFilter', 'MutationObserver', 'XMLSerializer', 'DOMParser', 'getComputedStyle']) {
  if (g[key] === undefined) g[key] = key === 'window' ? win : key === 'getComputedStyle' ? win.getComputedStyle.bind(win) : (win as unknown as Record<string, unknown>)[key];
}
const { createExportAPI } = await import('../shells/web/src/bridge/export.ts');
const { holdStillExports, holdStillFrame } = await import('../shells/web/src/bridge/frame-clock.ts');
after(() => win.close());

const frames = (n: number) => new Promise<void>((done) => {
  const step = (k: number): void => { if (k) win.requestAnimationFrame(() => step(k - 1)); else done(); };
  step(n);
});

type Render = (node: Element, format: string, opts?: Record<string, unknown>) => Promise<Blob>;

/** Mount the chart as the tool view does: hydrated markup, its scripts run, the runtime wrapped. */
async function mount(values: Parameters<typeof createRuntime>[2], render: Render) {
  const rt = await createRuntime(tool, baseHost({ export: { render } }), values);
  const stage = win.document.createElement('div');
  stage.innerHTML = rt.getHydrated();
  win.document.body.replaceChildren(stage);
  for (const old of Array.from(stage.querySelectorAll('script'))) {
    if (old.type === 'application/json') continue;
    const run = win.document.createElement('script');
    run.textContent = old.textContent;
    old.replaceWith(run);
  }
  await frames(4);
  return { runtime: holdStillExports(rt, tool), stage };
}

const OPTS = { embedMeta: false, watermark: false };

/** The reveal clip and every Build mark's opacity, as the page stands. */
function pose(stage: Element) {
  const clip = stage.querySelector('defs[data-lolly-motion] rect')?.getAttribute('width') ?? null;
  const svg = stage.querySelector('[data-chart-plot-root] svg');
  const marks = svg ? Array.from(svg.querySelectorAll('circle,path,rect,line')).map((el) => (el as SVGElement).style.opacity).filter(Boolean) : [];
  return { clip: clip === null ? null : Number(clip), hidden: marks.filter((o) => Number(o) < 1).length, marks: marks.length };
}

/**
 * The shell's export entry, as far as the hold goes: it takes its own hold before the page
 * is read (export.ts renderFormat). jsdom's serializer cannot write Plot's markup as XML, so
 * this reads the pose the walker would read instead of writing the file.
 */
function entry(seen: Array<ReturnType<typeof pose>>, stage: () => Element): Render {
  return async (node, format) => {
    const release = holdStillFrame(node, format);
    try { seen.push(pose(stage())); return new Blob([]); }
    finally { release(); }
  };
}

test('a Statistical Reveal or Build chart exports SVG, SVGZ and PDF with every mark drawn', async () => {
  for (const preset of ['reveal', 'stagger']) {
    const seen: Array<ReturnType<typeof pose>> = [];
    let stage: Element | null = null;
    const chart = await mount({ renderMode: 'statistical', plotType: 'dot-strip', plotMotionPreset: preset }, entry(seen, () => stage!));
    stage = chart.stage;
    const live = pose(stage);
    if (preset === 'reveal') assert.ok(live.clip !== null && live.clip < 1280, `${preset}: the preview is mid-reveal when the export starts (${live.clip})`);
    else assert.ok(live.hidden > 0, `${preset}: the preview is mid-build when the export starts`);
    for (const format of ['svg', 'svgz', 'pdf']) {
      seen.length = 0;
      await chart.runtime.export(stage, format, OPTS);
      const [read] = seen;
      if (preset === 'reveal') assert.ok(read!.clip! > 1279, `${preset} ${format}: the reveal is complete, ${read!.clip} wide`);
      else assert.deepEqual([read!.hidden, read!.marks > 0], [0, true], `${preset} ${format}: every mark is drawn`);
    }
  }
});

test('a format the hook leaves alone is frozen where the preview stood, never redrawn from its first frame', async () => {
  const seen: Array<ReturnType<typeof pose>> = [];
  let stage: Element | null = null;
  const chart = await mount({ renderMode: 'statistical', plotType: 'dot-strip', plotMotionPreset: 'reveal' }, entry(seen, () => stage!));
  stage = chart.stage;
  const clock = stage.querySelector('[data-chart-plot-clock]') as HTMLCanvasElement & { __lollyFrameDriven?: boolean };
  for (const format of ['pdf-cmyk', 'penpot', 'emf', 'pptx']) {
    seen.length = 0;
    const live = pose(stage);
    await chart.runtime.export(stage, format, OPTS);
    assert.equal(seen[0]!.clip, live.clip, `${format}: the reveal stays where it was, not at width 0`);
    assert.equal(clock.__lollyFrameDriven, false, `${format}: the preview plays on after the export`);
  }
});

test('a chart animated by a frame column still exports its SMIL flipbook as an animated SVG', async () => {
  const api = createExportAPI({ log: () => {} } as never);
  const chart = await mount({ frameColumn: '1' }, (node, format, opts) => api.render(node, format, opts as never));
  const svg = await (await chart.runtime.export(chart.stage, 'svg', OPTS)).text();
  // The same counts the browser writes on main: 60 sampled frames, each with its animation.
  assert.equal((svg.match(/<animate\b/g) ?? []).length, 60, 'every frame of the flipbook keeps its animation');
  assert.equal((svg.match(/<rect\b/g) ?? []).length, 313, 'and its drawing');
});
