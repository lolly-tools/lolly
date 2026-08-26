// SPDX-License-Identifier: MPL-2.0
/**
 * Growth (community/growth) - the simulation contract.
 *
 * The tool's promise is that state(t) is a pure function of (params, seed,
 * step): the same link, the same CLI run and the same export frame all produce
 * the same nodes. The first test checks it, and it is why the sim lives as
 * DOM-free functions in hooks.js rather than inside the template script.
 *
 * The rest pins the ceilings (nodes / steps / text), the resampler the seeds
 * depend on, the symmetry stamp count, and the vector-only output that makes
 * the plotter claim true.
 *
 * Run with: node --test tests/growth.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const PKG = join(COMMUNITY, 'growth');
const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(PKG, 'tool.json')),
    'community/growth/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const HOOK_SRC = SKIP ? '' : readFileSync(join(PKG, 'hooks.js'), 'utf8');
const TEMPLATE_SRC = SKIP ? '' : readFileSync(join(PKG, 'template.html'), 'utf8');
const manifest: any = SKIP ? null : JSON.parse(readFileSync(join(PKG, 'tool.json'), 'utf8'));

/**
 * The sim core, lifted straight out of hooks.js module scope - the same way
 * engine/src/runtime.ts compiles a hook file, so what the tests exercise is
 * exactly what ships.
 */
function sim(): any {
  const factory = new Function('host', `${HOOK_SRC}; return {
    mulberry32, resampleClosed, flattenPath, maskContours, ringPoints, buildSeed,
    buildParams, simState, stepOnce, runTo, pathD, symmetryStamps, loopsToPaths,
    clampText, compute,
    MAX_NODES, MAX_STEPS, MAX_TEXT, MAX_NODE_STEPS,
  };`) as (h: unknown) => any;
  return factory({ log: () => {} });
}

const G: any = SKIP ? null : sim();

/**
 * Run the template's per-paint IIFE over the hydrated markup, the way a shell
 * would: the sim handed over on the realm, `document.currentScript` null (so the
 * script falls back to the document root), rAF stubbed so nothing free-runs.
 */
function runTemplate(html: string): { doc: any; clock: any } {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
  const win: any = dom.window;
  win.__lollyGrowthSim = {
    simState: G.simState, stepOnce: G.stepOnce, runTo: G.runTo, pathD: G.pathD, flipX: G.flipX,
  };
  const src = html.match(/<script>([\s\S]*?)<\/script>/)![1]!;
  new Function('window', 'document', 'requestAnimationFrame', src)(win, win.document, () => 1);
  return { doc: win.document, clock: win.document.querySelector('.gr-clock') };
}

function seedD(html: string, loop = 0): string {
  const state = JSON.parse(html.match(/class="gr-state">([\s\S]*?)<\/script>/)![1]!);
  return G.pathD(state.seed[loop]);
}

function dOf(doc: any, sel: string): string {
  return doc.querySelector(sel).getAttribute('d');
}

function grow(over: Record<string, unknown>, steps: number): any {
  const P = G.buildParams({ density: 58, seed: 7, steps, symmetry: 'none', ...over });
  const seed = G.buildSeed(String(over.seedShape ?? 'ring'), null, P, G.mulberry32(P.seed));
  const st = G.simState(seed, P);
  G.runTo(st, P, steps);
  return { st, P };
}

test('the same params and seed grow the same nodes, twice', { skip: SKIP }, () => {
  const a = grow({ seedShape: 'burst' }, 120);
  const b = grow({ seedShape: 'burst' }, 120);
  assert.equal(a.st.step, 120);
  assert.ok(a.st.nodes > 200, `expected real growth, got ${a.st.nodes} nodes`);
  assert.deepEqual(a.st.loops, b.st.loops);

  // ...and a different seed does not, or "seeded" would be decoration.
  const c = grow({ seedShape: 'burst', seed: 8 }, 120);
  assert.notDeepEqual(a.st.loops, c.st.loops);
});

test('stepping one at a time equals running straight to the step', { skip: SKIP }, () => {
  const P = G.buildParams({ density: 58, seed: 3, steps: 60, symmetry: 'none' });
  const seed = G.buildSeed('ring', null, P, G.mulberry32(P.seed));
  const a = G.simState(seed, P);
  for (let i = 0; i < 60; i++) G.stepOnce(a, P);
  const b = G.runTo(G.simState(seed, P), P, 60);
  assert.deepEqual(a.loops, b.loops);
});

test('the node, step and node-step ceilings all hold', { skip: SKIP }, () => {
  assert.equal(G.MAX_NODES, 8000);
  assert.equal(G.MAX_STEPS, 2400);

  // Finest density + a step count far past the cap: nodes must stop dead at the
  // ceiling and the node-step budget must end the run before MAX_STEPS.
  const { st } = grow({ seedShape: 'burst', density: 100 }, 99999);
  assert.ok(st.nodes <= G.MAX_NODES, `nodes ${st.nodes} exceeded the cap`);
  assert.ok(st.step < G.MAX_STEPS, `node-step budget did not bite (ran ${st.step} steps)`);
  assert.ok(st.work <= G.MAX_NODE_STEPS + st.nodes, 'node-step budget overshot by more than one step');

  // steps is clamped, not trusted: a hostile URL value can't outrun MAX_STEPS.
  assert.equal(G.buildParams({ steps: 1e9 }).steps, G.MAX_STEPS);
  assert.equal(G.buildParams({ steps: -50 }).steps, 0);
  assert.equal(G.buildParams({ steps: 'nonsense' }).steps, 300);
});

test('the text seed is capped at 60 characters', { skip: SKIP }, () => {
  const long = 'x'.repeat(500);
  assert.equal(G.clampText(long).length, G.MAX_TEXT);
  assert.equal(G.MAX_TEXT, 60);
  assert.equal(G.clampText('  line\nbreak  '), 'line break');
  assert.equal(G.clampText(null), '');
  const declared = manifest.inputs.find((i: any) => i.id === 'text');
  assert.equal(declared.maxLength, G.MAX_TEXT, 'the manifest cap and the hook cap must agree');
});

test('resampling a closed ring is stable under a second pass', { skip: SKIP }, () => {
  const ring = G.ringPoints(600, 600, 200, 37);
  const once = G.resampleClosed(ring, 20);
  const twice = G.resampleClosed(once, 20);
  assert.equal(once.length, twice.length);
  let worst = 0;
  for (let i = 0; i < once.length; i += 2) {
    worst = Math.max(worst, Math.hypot(once[i] - twice[i], once[i + 1] - twice[i + 1]));
  }
  assert.ok(worst < 1, `resample drifted by ${worst}px on a second pass`);

  // Even spacing is the property the sim depends on (spacing < repel radius).
  const n = once.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const d = Math.hypot(once[j * 2] - once[i * 2], once[j * 2 + 1] - once[i * 2 + 1]);
    assert.ok(Math.abs(d - 20) < 2, `segment ${i} was ${d}px, expected ~20`);
  }
});

test('every subpath of a glyph outline becomes its own loop', { skip: SKIP }, () => {
  // An "O": outer contour then its counter, the shape the money-shot seed rides on.
  const d = 'M0,0L100,0L100,100L0,100ZM25,25L25,75L75,75L75,25Z';
  const loops = G.flattenPath(d);
  assert.equal(loops.length, 2, 'the counter must grow as a loop of its own');
  assert.equal(loops[0].length, 8);
  // Curves are flattened, not dropped.
  assert.ok(G.flattenPath('M0,0Q50,-50 100,0C120,20 120,80 100,100L0,100Z')[0].length > 20);
});

test('a mask traces one loop per region and one per hole', { skip: SKIP }, () => {
  // 6x6 filled square with a 2x2 hole - the logo-seed case.
  const w = 6;
  const mask = new Uint8Array(w * w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) mask[y * w + x] = 1;
  for (let y = 2; y < 4; y++) for (let x = 2; x < 4; x++) mask[y * w + x] = 0;
  const loops = G.maskContours(mask, w, w);
  assert.equal(loops.length, 2);
  const lens = loops.map((l: number[]) => l.length / 2).sort((a: number, b: number) => a - b);
  assert.deepEqual(lens, [8, 24], 'outer perimeter 24 vertices, hole 8');
});

test('symmetry stamps the organism the declared number of times', { skip: SKIP }, () => {
  assert.equal(G.symmetryStamps('none', 1200, 1200).length, 1);
  assert.equal(G.symmetryStamps('mirror', 1200, 1200).length, 2);
  assert.equal(G.symmetryStamps('radial-3', 1200, 1200).length, 3);
  assert.equal(G.symmetryStamps('radial-6', 1200, 1200).length, 6);
  assert.equal(G.symmetryStamps('nonsense', 1200, 1200).length, 1);
  assert.match(G.symmetryStamps('radial-6', 1200, 1200)[1], /rotate\(60,600,600\)/);
});

test('the render is vector paths and nothing else', { skip: SKIP }, () => {
  const { st } = grow({ seedShape: 'ring' }, 40);
  const svg = G.loopsToPaths(st.loops, ['#111', '#222', '#333'], 2, false);
  assert.match(svg, /^<path /);
  assert.ok(!/<image|<canvas|<foreignObject/.test(svg), 'no raster fallback may appear');
  // Presentation as ATTRIBUTES, not classes - the walker exports these verbatim.
  assert.match(svg, /fill="none"/);
  assert.match(svg, /stroke-width="2"/);
  assert.match(svg, /d="M[-\d.,]+L/);

  // Taper thins later loops; without it every loop keeps the set weight.
  const many = [G.ringPoints(0, 0, 10, 8), G.ringPoints(0, 0, 20, 8), G.ringPoints(0, 0, 30, 8)];
  const tapered = G.loopsToPaths(many, ['#111'], 4, true).match(/stroke-width="([\d.]+)"/g);
  assert.deepEqual(tapered, ['stroke-width="4"', 'stroke-width="2.9"', 'stroke-width="1.8"']);
});

test('the tool source is deterministic and re-runnable per paint', { skip: SKIP }, () => {
  for (const [name, src] of [['hooks.js', HOOK_SRC], ['template.html', TEMPLATE_SRC]] as const) {
    assert.ok(!/Math\.random/.test(src), `${name} must not use Math.random - the seed is the contract`);
    assert.ok(!/Date\.now|new Date\(\)/.test(src), `${name} must not read the wall clock`);
  }
  assert.match(TEMPLATE_SRC, /\(function \(\) \{[\s\S]*\}\)\(\);/, 'the template script must be an IIFE');
  assert.ok(!/^\s*(let|const) /m.test(TEMPLATE_SRC.split('<script>')[1] ?? ''),
    'the template script re-runs per paint, so it must declare with var');
  assert.match(TEMPLATE_SRC, /__lollyFrameRender/, 'animated export needs the frame clock');
  assert.match(TEMPLATE_SRC, /__lollyFrameDriven/, 'the rAF loop must yield while the export drives frames');
  assert.match(TEMPLATE_SRC, /setAttribute\('d'/, 'growth must reuse the path elements, never rebuild them');
});

test('every example hydrates into real paths with no hook error', { skip: SKIP }, async () => {
  const tool: any = await loadTool('growth', (p: string) => readFile(join(COMMUNITY, p), 'utf8'));
  for (const ex of manifest.examples) {
    const rt = await createRuntime(tool, baseHost(), { ...ex.values, steps: 40 });
    const html = rt.getHydrated() as string;
    assert.deepEqual(rt.hookErrors ?? [], [], `${ex.label}: hook errors`);
    assert.match(html, /<path data-l="0"/, `${ex.label}: rendered no paths`);
    assert.ok(!/<image/.test(html), `${ex.label}: rasterised something`);
  }
});

test('a text seed grows the glyph outline AND its counters', { skip: SKIP }, async () => {
  const tool: any = await loadTool('growth', (p: string) => readFile(join(COMMUNITY, p), 'utf8'));
  // A stand-in "O": outer contour plus the counter, the two subpaths a real
  // host.text.toPath returns for that glyph.
  const host = baseHost({
    tokens: { resolve: async () => 'Stub Sans' },
    text: {
      fontUrl: async () => ({ url: 'font:stub' }),
      toPath: async () => ({
        d: 'M0,0L200,0L200,200L0,200ZM60,60L60,140L140,140L140,60Z',
        advanceWidth: 200,
        bbox: { x1: 0, y1: 0, x2: 200, y2: 200 },
        notdef: 0,
      }),
    },
  });
  const rt = await createRuntime(tool, host, { seedShape: 'text', text: 'O', steps: 60, seed: 4 });
  const html = rt.getHydrated() as string;
  assert.deepEqual(rt.hookErrors ?? [], [], 'hook errors');
  assert.ok(!/class="gr-note"/.test(html), 'a resolved font must not show the fallback note');
  assert.match(html, /<path data-l="0"/);
  assert.match(html, /<path data-l="1"/, 'the counter must grow as a loop of its own');
  // Both directions actually moved: neither loop is still its seeded rectangle.
  const ds = [...html.matchAll(/data-l="[01]" d="([^"]+)"/g)].map(m => m[1]!);
  assert.equal(ds.length, 2);
  for (const d of ds) assert.ok(d.split('L').length > 60, 'a grown loop should carry many nodes');
});

test('a still export of a grown piece is never rewound to the seed', { skip: SKIP }, async () => {
  // renderRaster/renderBitmap seek EVERY frame clock they find to t = 0 on the
  // LIVE node before capturing, so a finished piece must not register one.
  const tool: any = await loadTool('growth', (p: string) => readFile(join(COMMUNITY, p), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), { seedShape: 'ring', steps: 200, grown: true, seed: 5 });
  const html = rt.getHydrated() as string;
  const { doc, clock } = runTemplate(html);

  const grownD = dOf(doc, '[data-l="0"]');
  assert.notEqual(grownD, seedD(html), 'the still markup must already be grown');
  assert.equal(typeof clock.__lollyFrameRender, 'undefined', 'a finished piece must not be export-driven');
  if (typeof clock.__lollyFrameRender === 'function') clock.__lollyFrameRender(0);
  assert.equal(dOf(doc, '[data-l="0"]'), grownD, 'the export base frame rewound the live DOM to the seed');
});

test('the growth-from-zero state IS export-driven', { skip: SKIP }, async () => {
  const tool: any = await loadTool('growth', (p: string) => readFile(join(COMMUNITY, p), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), { seedShape: 'ring', steps: 200, grown: false, seed: 5 });
  const html = rt.getHydrated() as string;
  const { doc, clock } = runTemplate(html);

  assert.equal(dOf(doc, '[data-l="0"]'), seedD(html), 'un-grown markup starts at the seed');
  assert.equal(typeof clock.__lollyFrameRender, 'function', 'animated export needs the clock here');
  clock.__lollyFrameRender(1);
  const end = dOf(doc, '[data-l="0"]');
  assert.notEqual(end, seedD(html));
  clock.__lollyFrameRender(0);
  assert.equal(dOf(doc, '[data-l="0"]'), seedD(html), 'seeking back must re-run from the seed');
});

test('mirror symmetry flips the path data, never the group scale', { skip: SKIP }, async () => {
  // A scale(-1) group exports every stroke inside it at the PDF walker's 0.1pt
  // floor (it averages the group's x/y scale into the stroke multiplier).
  assert.deepEqual(G.symmetryStamps('mirror', 1200, 1200), ['', '']);

  const tool: any = await loadTool('growth', (p: string) => readFile(join(COMMUNITY, p), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), { seedShape: 'ring', symmetry: 'mirror', steps: 40, grown: true });
  const html = rt.getHydrated() as string;
  assert.ok(!/scale\(-/.test(html), 'no reflected group transform may reach the export');
  const { doc } = runTemplate(html);
  const plain = dOf(doc, 'g:not([data-flip]) [data-l="0"]');
  const flipped = dOf(doc, 'g[data-flip] [data-l="0"]');
  assert.notEqual(plain, flipped, 'the mirrored copy must carry its own geometry');
  const x = (d: string) => Number(d.slice(1).split(',')[0]);
  assert.ok(Math.abs(x(plain) + x(flipped) - 1200) < 0.02, 'the copy must be the x-mirror about the frame');
});

test('symmetry moves a traced seed off the mirror axis', { skip: SKIP }, () => {
  // Stamping simulates ONE organism, so a seed centred on the frame would be
  // stamped straight back onto itself - all cost, no rosette.
  const contours = G.flattenPath('M0,0L200,0L200,200L0,200ZM60,60L60,140L140,140L140,60Z');
  const centre = (sym: string) => {
    const P = G.buildParams({ density: 58, seed: 7, steps: 0, symmetry: sym });
    const loops = G.buildSeed('text', contours, P, G.mulberry32(P.seed));
    let sx = 0, sy = 0, n = 0;
    for (const L of loops) for (let i = 0; i < L.length; i += 2) { sx += L[i]; sy += L[i + 1]; n++; }
    return { x: sx / n, y: sy / n, loops };
  };
  assert.ok(Math.abs(centre('none').x - 600) < 1, 'unstamped, it stays centred');
  assert.ok(Math.abs(centre('mirror').x - 600) > 100, 'mirror stamps about x = 600');
  assert.ok(Math.abs(centre('radial-6').y - 600) > 100, 'the radial stamps rotate about the centre');
  // ...and the smaller organism still fits inside the frame.
  for (const L of centre('radial-6').loops) {
    for (let i = 0; i < L.length; i += 2) {
      assert.ok(L[i] > 0 && L[i] < 1200 && L[i + 1] > 0 && L[i + 1] < 1200, 'a stamped seed left the frame');
    }
  }
});

test('the node ceiling binds on the seed, not just on growth', { skip: SKIP }, () => {
  // A striped mask is what any detailed logo looks like to the tracer: many
  // contours, each one long. Unbounded, this seeded ~5x the DOM ceiling.
  const w = 128;
  const mask = new Uint8Array(w * w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) mask[y * w + x] = y % 4 < 2 ? 1 : 0;
  const contours = G.maskContours(mask, w, w);
  assert.ok(contours.length > 20, `expected a detailed trace, got ${contours.length} contours`);

  const P = G.buildParams({ density: 100, seed: 7, steps: 0, symmetry: 'none' });
  const seed = G.buildSeed('logo', contours, P, G.mulberry32(P.seed));
  const nodes = seed.reduce((n: number, L: number[]) => n + L.length / 2, 0);
  assert.ok(nodes <= G.MAX_NODES, `seeded ${nodes} nodes, past the ${G.MAX_NODES} ceiling`);
  assert.ok(seed.length >= contours.length - 1, 'coarsening must keep the contours, not drop them');
});

test('a text seed with no font falls back to a ring and says so', { skip: SKIP }, async () => {
  const tool: any = await loadTool('growth', (p: string) => readFile(join(COMMUNITY, p), 'utf8'));
  // baseHost has no host.text, which is exactly the "no font file resolves" case.
  const rt = await createRuntime(tool, baseHost(), { seedShape: 'text', text: 'O', steps: 20 });
  const html = rt.getHydrated() as string;
  assert.match(html, /<path data-l="0"/, 'never a silently empty canvas');
  assert.match(html, /class="gr-note"/, 'the fallback must be visible, not silent');
});
