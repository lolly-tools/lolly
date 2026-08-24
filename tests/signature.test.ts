// SPDX-License-Identifier: MPL-2.0
/**
 * Signature (community/signature) - stroke data contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine. What each test pins:
 *
 *  - parsing is tolerant AND honest: compact pad output, hand-pasted spaced
 *    path data and outright junk all read, and every skipped stroke is counted
 *    into the warning rather than disappearing;
 *  - trim is arithmetic anyone can check: the ink box grown by half the pen
 *    plus a fixed margin, and the full frame when there is nothing to trim;
 *  - smoothing is one deterministic local pass, the SAME one whether or not the
 *    host offers a geometry kernel (host.geom.simplify was measured and is not
 *    used - see the hook header), and it can only pull the line inward, which is
 *    what lets the trim margin be a constant;
 *  - the stroke data survives a URL: its urlKey is not one the engine reserves,
 *    so a share link still carries the signature;
 *  - the sheet is transparent by default: no background is painted, and the
 *    export bar's toggle reaches the raster path;
 *  - every shipped example hydrates with no hook error and draws its strokes.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/signature.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { parseUrlState, serializeUrlState, RESERVED } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';

// signature ships in the PUBLIC community pack. Load from the SOURCE pack, not
// the gitignored tools/ profile view, so the suite is profile-independent: skip
// only when community/ isn't checked out (a clone without submodules).
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const TOOL_DIR = join(COMMUNITY, 'signature');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(TOOL_DIR, 'tool.json')),
    'community/signature/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('signature', fetchFile);

const MANIFEST = PACK_MOUNTED
  ? JSON.parse(readFileSync(join(TOOL_DIR, 'tool.json'), 'utf8')) as {
      render: { transparentBg?: boolean; width: number; height: number };
      inputs: Array<{ id: string; type: string; urlKey?: string; default?: unknown }>;
      examples?: Array<{ label?: string; values: Record<string, unknown> }>;
    }
  : null;
const TEMPLATE = PACK_MOUNTED ? readFileSync(join(TOOL_DIR, 'template.html'), 'utf8') : '';
const STYLES = PACK_MOUNTED ? readFileSync(join(TOOL_DIR, 'styles.css'), 'utf8') : '';
const HOOKS_SRC = PACK_MOUNTED ? readFileSync(join(TOOL_DIR, 'hooks.js'), 'utf8') : '';

/** Mount with (default) or without the geometry kernel the shells attach. */
async function mount(state: Record<string, any>, opts: { geom?: boolean } = {}) {
  const over: Record<string, unknown> = {};
  if (opts.geom !== false) over.geom = makeGeomApi();
  return createRuntime(tool, baseHost(over), state);
}

function extra(rt: any, name: string): string {
  return rt.getHydratedString(`{{${name}}}`) as string;
}

function paths(rt: any): string[] {
  return (rt.getHydratedString('{{#each paths}}{{d}};{{/each}}') as string)
    .split(';').filter(Boolean);
}

/** Every coordinate in a path-data string, in order. */
function coords(d: string): number[] {
  return (d.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
}

// ── parsing ──────────────────────────────────────────────────────────────────

test('the pad form, spaced path data and a lone dot all parse', { skip: SKIP }, async () => {
  const compact = await mount({ strokes: 'M10,20L30,40L50,45 M60,60L70,70', smoothing: 0 });
  assert.equal(extra(compact, 'strokeCount'), '2');
  assert.equal(extra(compact, 'pointCount'), '5');
  assert.equal(paths(compact)[0], 'M10,20L30,40L50,45');

  // Pasted from somewhere else: same numbers, spaces and separate commands.
  const spaced = await mount({ strokes: 'M 10 20 L 30 40 L 50 45 M 60 60 L 70 70', smoothing: 0 });
  assert.deepEqual(paths(spaced), paths(compact),
    'splitting on the move command, not on whitespace, is what makes a paste readable');

  // A tap is one point, drawn as a zero-length subpath (round cap = a dot).
  const dot = await mount({ strokes: 'M100,100', smoothing: 0 });
  assert.equal(paths(dot)[0], 'M100,100L100,100');
});

test('junk is skipped and COUNTED, never silently dropped', { skip: SKIP }, async () => {
  const rt = await mount({ strokes: 'oops M10,20L30,40 M M50,50L60,60', smoothing: 0 });
  assert.equal(extra(rt, 'strokeCount'), '2', 'the two readable strokes still draw');
  assert.equal(extra(rt, 'warning'), '2 strokes were unreadable and skipped.');

  const one = await mount({ strokes: 'M M10,20L30,40', smoothing: 0 });
  assert.equal(one.getHydratedString('{{warning}}'), '1 stroke was unreadable and skipped.');

  // Nothing readable at all is still an honest count, not an empty sheet with
  // no explanation.
  const none = await mount({ strokes: 'not a path at all', smoothing: 0 });
  assert.equal(extra(none, 'strokeCount'), '0');
  assert.equal(extra(none, 'isEmpty'), 'true');
  assert.match(extra(none, 'warning'), /unreadable/);

  // An empty value is the blank pad, not a warning.
  const blank = await mount({ strokes: '', smoothing: 0 });
  assert.equal(extra(blank, 'warning'), '');
  assert.equal(extra(blank, 'isEmpty'), 'true');
});

test('a coordinate past the sanity ceiling takes its stroke with it', { skip: SKIP }, async () => {
  const rt = await mount({ strokes: 'M999999999,1L2,2 M10,10L20,20', smoothing: 0 });
  // Corrupt data, so the whole stroke goes and is counted - keeping the points
  // that happened to look sane would draw a signature nobody wrote.
  assert.deepEqual(paths(rt), ['M10,10L20,20']);
  assert.equal(extra(rt, 'warning'), '1 stroke was unreadable and skipped.');
  for (const d of paths(rt)) {
    for (const n of coords(d)) assert.ok(Math.abs(n) <= 100000, `${n} is past the coordinate ceiling`);
  }
});

test('a command the parser cannot draw takes its stroke with it', { skip: SKIP }, async () => {
  // A curve, an arc or a relative m/l would have its numbers read as bare
  // coordinate pairs (control points, radii and flags drawn as ink), so the
  // whole segment is counted as unreadable instead of half-drawn.
  for (const junk of [
    'M10,20C30,40 50,60 70,80',      // cubic control points are not points on the line
    'M10,20A30,30 0 0 1 70,80',      // arc radii and flags are not coordinates at all
    'm10,20l30,40',                  // relative, so absolute coordinates would be wrong
    'M10,20H90',                     // one coordinate, not a pair
    'M1e7,1L2,2',                    // an exponent this parser does not read
  ]) {
    const rt = await mount({ strokes: junk + ' M100,100L200,200', smoothing: 0 });
    assert.deepEqual(paths(rt), ['M100,100L200,200'], `${junk} must not be drawn as a polyline`);
    assert.equal(extra(rt, 'warning'), '1 stroke was unreadable and skipped.',
      `${junk} must be counted, not dropped in silence`);
  }
});

test('a signature past the point budget is clipped, never blanked', { skip: SKIP }, async () => {
  // One pasted stroke bigger than the whole budget: dropping it would leave an
  // empty sheet with a warning about strokes, which is neither true nor useful.
  let huge = 'M0,0';
  for (let i = 1; i <= 7000; i++) huge += `L${i % 1000},${i % 400}`;
  const rt = await mount({ strokes: huge, smoothing: 0 });
  assert.equal(extra(rt, 'isEmpty'), 'false', 'the ink that fits still draws');
  assert.equal(extra(rt, 'pointCount'), '6000');
  assert.match(extra(rt, 'warning'), /6000-point limit/,
    'the warning names the ceiling that actually tripped');
});

test('the committed value is written back in canonical form', { skip: SKIP }, async () => {
  // The pad appends to strokesValue, so a broken paste is normalised by the
  // next stroke rather than being concatenated onto.
  const rt = await mount({ strokes: 'junk M 10 20 L 30 40', smoothing: 0 });
  assert.equal(extra(rt, 'strokesValue'), 'M10,20L30,40');
});

// ── URL ──────────────────────────────────────────────────────────────────────

test('the signature survives a share link (no input rides a reserved param)', { skip: SKIP }, () => {
  for (const i of MANIFEST!.inputs) {
    assert.ok(!RESERVED.has(i.id), `input id "${i.id}" is a reserved URL param`);
    if (i.urlKey) {
      assert.ok(!RESERVED.has(i.urlKey),
        `urlKey "${i.urlKey}" (input ${i.id}) is a reserved URL param - parseUrlState drops it, so the value never comes back`);
    }
  }

  // The whole point of the tool is a signature you can send. Round-trip it
  // through the real encoder and parser, beyond the reserved-name check above.
  const strokes = 'M100,100L200,150 M300,300L320,280';
  const query = serializeUrlState(
    MANIFEST!.inputs.map((i) => ({ ...i, value: i.id === 'strokes' ? strokes : i.default })) as never,
  );
  assert.equal(parseUrlState(query, MANIFEST! as never).values.strokes, strokes);
});

// ── trim ─────────────────────────────────────────────────────────────────────

test('trim is the ink box grown by half the pen plus a fixed margin', { skip: SKIP }, async () => {
  // Ink box 100,100 -> 200,150. pen 10 => pad 5 + 12 = 17.
  const rt = await mount({ strokes: 'M100,100L200,150', penWidth: 10, trim: true, smoothing: 0 });
  assert.equal(extra(rt, 'viewBox'), '83 83 134 84');
  assert.equal(extra(rt, 'trimmed'), 'true');

  // A wider pen paints further out, so the box has to grow with it - otherwise
  // every export clips the outer edge of the line.
  const fat = await mount({ strokes: 'M100,100L200,150', penWidth: 40, trim: true, smoothing: 0 });
  assert.equal(extra(fat, 'viewBox'), '68 68 164 114');

  const off = await mount({ strokes: 'M100,100L200,150', penWidth: 10, trim: false, smoothing: 0 });
  assert.equal(off.getHydratedString('{{viewBox}}'), '0 0 1200 400');
  assert.equal(off.getHydratedString('{{trimmed}}'), 'false');

  // Nothing to trim: the full drawing frame, so the pad is the size it claims.
  const blank = await mount({ strokes: '', trim: true });
  assert.equal(blank.getHydratedString('{{viewBox}}'), '0 0 1200 400');
  assert.equal(blank.getHydratedString('{{trimmed}}'), 'false');

  // A single dot still yields a real box, never a zero-sized viewBox.
  const dot = await mount({ strokes: 'M600,200', penWidth: 8, trim: true });
  assert.equal(dot.getHydratedString('{{viewBox}}'), '584 184 32 32');
});

test('the trimmed box matches the drawing frame the manifest declares', { skip: SKIP }, () => {
  assert.equal(MANIFEST!.render.width, 1200);
  assert.equal(MANIFEST!.render.height, 400);
});

// ── smoothing ────────────────────────────────────────────────────────────────

// A stroke long enough that a curve fit has something to do.
const WAVY = 'M100,200L120,170L140,150L160,145L180,160L200,190L220,220L240,240L260,245'
  + 'L280,235L300,210L320,180L340,155L360,145L380,150L400,170';

test('smoothing 0 is the recorded polyline, untouched', { skip: SKIP }, async () => {
  const rt = await mount({ strokes: WAVY, smoothing: 0 });
  assert.equal(paths(rt)[0], WAVY);
  assert.equal(extra(rt, 'smoothMode'), 'raw');
});

test('smoothing repeats exactly, and does not depend on host.geom being there', { skip: SKIP }, async () => {
  const a = await mount({ strokes: WAVY, smoothing: 60 });
  const b = await mount({ strokes: WAVY, smoothing: 60 });
  assert.equal(extra(a, 'smoothMode'), 'smooth');
  assert.deepEqual(paths(a), paths(b), 'the same input must give byte-identical path data');
  assert.notEqual(paths(a)[0], WAVY, 'a pass that changed nothing would make the slider a lie');

  // The geometry kernel is measured, not used (see the hook header: it fits
  // CURVES, and a recorded stroke is line segments). A shell that has it and a
  // shell that does not must therefore draw the same signature, byte for byte.
  const noGeom = await mount({ strokes: WAVY, smoothing: 60 }, { geom: false });
  assert.deepEqual(paths(noGeom), paths(a),
    'a host with no geometry bridge is not a degraded render here, it is the same render');
  assert.equal(extra(noGeom, 'smoothMode'), 'smooth');
});

test('smoothing rounds corners inward and answers in line segments', { skip: SKIP }, async () => {
  const a = await mount({ strokes: WAVY, smoothing: 60 }, { geom: false });
  assert.ok(!/[CQAS]/.test(paths(a)[0]!), 'the pass answers in line segments only');

  // Corner cutting blends neighbouring points, so it can only move the line
  // inward. That is what lets the trim margin be a constant rather than a
  // function of the smoothing setting.
  const raw = coords(WAVY);
  const xs = raw.filter((_, i) => i % 2 === 0);
  const ys = raw.filter((_, i) => i % 2 === 1);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const got = coords(paths(a)[0]!);
  for (let i = 0; i < got.length; i += 2) {
    assert.ok(got[i]! >= box.x0 - 0.05 && got[i]! <= box.x1 + 0.05, `x ${got[i]} left the ink box`);
    assert.ok(got[i + 1]! >= box.y0 - 0.05 && got[i + 1]! <= box.y1 + 0.05, `y ${got[i + 1]} left the ink box`);
  }

  // Above the halfway mark a second pass runs, so the two halves of the slider
  // are not the same picture.
  const gentle = await mount({ strokes: WAVY, smoothing: 25 }, { geom: false });
  assert.notEqual(paths(gentle)[0], paths(a)[0]);
});

test('a two-point stroke is left alone by either route', { skip: SKIP }, async () => {
  for (const geom of [true, false]) {
    const rt = await mount({ strokes: 'M10,10L90,90', smoothing: 80 }, { geom });
    assert.equal(paths(rt)[0], 'M10,10L90,90', 'there is no corner to cut on a straight line');
    assert.equal(extra(rt, 'smoothMode'), 'raw');
  }
});

// ── transparency ─────────────────────────────────────────────────────────────

test('the sheet is transparent by default and paints no background', { skip: SKIP }, () => {
  assert.equal(MANIFEST!.render.transparentBg, true);
  assert.ok(!/\.sg-wrap\s*\{[^}]*background/.test(STYLES),
    'a background on the wrap would bake into every raster export');
  assert.ok(!/<rect/i.test(TEMPLATE), 'the sheet is strokes only - no backing rect');
});

test('beforeExport clears the container fill only when the toggle is on', { skip: SKIP }, () => {
  // The runtime hands beforeExport { node, format, opts, host } and NO model
  // (engine/src/runtime.ts), so the toggle can only be read during onInit /
  // onInput. A hook that goes looking for ctx.model here is inert and the
  // raster export keeps whatever fill the shell put behind it.
  const factory = new Function(
    'host',
    `${HOOKS_SRC}; return {
      onInput: onInput,
      beforeExport: typeof beforeExport !== 'undefined' ? beforeExport : null,
    };`,
  ) as (host: unknown) => {
    onInput: (ctx: { model: Array<{ id: string; value: unknown }> }) => unknown;
    beforeExport: (ctx: { format: string; opts: Record<string, unknown> }) => void;
  };
  const hooks = factory(null);
  const model = (transparent: boolean) => [
    { id: 'strokes', value: 'M10,10L90,90' },
    { id: 'transparentBg', value: transparent },
  ];

  hooks.onInput({ model: model(true) });
  const on = { format: 'png', opts: {} as Record<string, unknown> };
  hooks.beforeExport(on);
  assert.equal(on.opts.background, 'transparent');

  hooks.onInput({ model: model(false) });
  const off = { format: 'png', opts: {} as Record<string, unknown> };
  hooks.beforeExport(off);
  assert.equal(off.opts.background, undefined, 'with the toggle off the shell owns the background');

  // The toggle is not part of the render, so flipping it must not be swallowed
  // by the memo that skips recomputing an unchanged signature.
  hooks.onInput({ model: model(true) });
  const back = { format: 'png', opts: {} as Record<string, unknown> };
  hooks.beforeExport(back);
  assert.equal(back.opts.background, 'transparent', 'the toggle is read on every render, memo or not');
});

test('the pad chrome never reaches an export', { skip: SKIP }, () => {
  for (const cls of ['sg-hint', 'sg-bar', 'sg-note']) {
    const row = TEMPLATE.split('\n').find((l) => l.includes(`class="${cls}"`));
    assert.ok(row, `${cls} is missing from the template`);
    assert.match(row!, /data-export-hide/, `${cls} must be excluded from every export`);
  }
});

// ── the pad ──────────────────────────────────────────────────────────────────

/**
 * Mount the REAL hydrated template in jsdom and hand it a commit channel, the
 * way shells/web/src/lib/canvas-commit.ts does. innerHTML never runs a script,
 * so the pad's own IIFE is read back off the DOM and called - which is also how
 * it behaves in the shell when document.currentScript is null.
 *
 * No layout in jsdom, so the svg is given the box a 1200 x 400 sheet has.
 */
async function pad(strokes: string) {
  const { JSDOM } = await import('jsdom'); // typed by tests/jsdom.d.ts
  const rt = await mount({ strokes, trim: false });
  const dom = new JSDOM('<!DOCTYPE html><body><div data-lolly-canvas></div></body>');
  const doc = dom.window.document;
  const canvas = doc.querySelector('[data-lolly-canvas]') as HTMLElement & {
    __lollyCommit?: (id: string, value: unknown) => void;
  };
  canvas.innerHTML = rt.getHydrated() as string;

  const commits: Array<[string, unknown]> = [];
  canvas.__lollyCommit = (id, value) => { commits.push([id, value]); };

  const svg = canvas.querySelector('svg.sg-svg') as SVGSVGElement;
  svg.getBoundingClientRect = () => ({
    left: 0, top: 0, width: 1200, height: 400, right: 1200, bottom: 400, x: 0, y: 0, toJSON() {},
  });

  // jsdom without runScripts has no JS realm of its own, so the pad's only
  // global (document) is passed in - currentScript is null either way.
  const src = (canvas.querySelector('script') as HTMLScriptElement).textContent ?? '';
  new Function('document', src)(doc);

  const send = (type: string, x: number, y: number) => {
    const ev = new dom.window.Event(type, { bubbles: true }) as Event & Record<string, unknown>;
    ev.pointerId = 1;
    ev.clientX = x;
    ev.clientY = y;
    svg.dispatchEvent(ev);
  };
  const stroke = (from: [number, number], to: [number, number]) => {
    send('pointerdown', ...from);
    send('pointermove', ...to);
    send('pointerup', ...to);
  };
  return { commits, stroke, canvas };
}

test('a second stroke drawn before the repaint keeps the first', { skip: SKIP }, async () => {
  const { commits, stroke } = await pad('');

  // Two strokes back to back - dotting an i is exactly this - with no repaint
  // in between, so the pad is still showing the DOM the first commit was made
  // against. Reading the pre-commit value here would lose the stroke before.
  stroke([100, 100], [200, 150]);
  stroke([300, 300], [320, 280]);

  assert.deepEqual(commits.map((c) => c[0]), ['strokes', 'strokes']);
  assert.equal(commits[0]![1], 'M100,100L200,150');
  assert.equal(commits[1]![1], 'M100,100L200,150 M300,300L320,280',
    'the second commit must carry the first stroke, not replace it');
});

test('the pad appends to the committed value it was rendered with', { skip: SKIP }, async () => {
  // Rendered from a share link: what the pad appends to is the parsed, canonical
  // form, so somebody else's broken paste is healed rather than concatenated on.
  const { commits, stroke } = await pad('junk M 10 20 L 30 40');
  stroke([600, 200], [640, 240]);
  assert.equal(commits[0]![1], 'M10,20L30,40 M600,200L640,240');
});

test('with no commit channel the pad renders but shows no controls', { skip: SKIP }, async () => {
  // The offscreen export stage, the gallery preview and any older shell: there
  // is no way to record a stroke there, so the buttons must not be offered.
  const { JSDOM } = await import('jsdom');
  const rt = await mount({ strokes: 'M100,100L200,150' });
  const dom = new JSDOM('<!DOCTYPE html><body><div></div></body>');
  const host = dom.window.document.querySelector('div') as HTMLElement;
  host.innerHTML = rt.getHydrated() as string;
  new Function('document', (host.querySelector('script') as HTMLScriptElement).textContent ?? '')(dom.window.document);

  assert.equal(host.querySelector('.sg-bar'), null, 'the undo/clear bar is gone');
  assert.equal(host.querySelectorAll('path').length, 1, 'the signature still draws');
});

// ── examples and templates ───────────────────────────────────────────────────

test('every shipped example and template seed hydrates and draws', { skip: SKIP }, async () => {
  const seeds: Array<{ what: string; values: Record<string, unknown> }> = [];
  for (const ex of MANIFEST!.examples ?? []) {
    seeds.push({ what: `example "${ex.label ?? '(unlabelled)'}"`, values: ex.values });
  }
  const templatesDir = join(TOOL_DIR, 'templates');
  if (existsSync(templatesDir)) {
    for (const file of readdirSync(templatesDir).filter((f) => f.endsWith('.json'))) {
      const t = JSON.parse(readFileSync(join(templatesDir, file), 'utf8')) as {
        id: string; values: Record<string, unknown>;
        presets?: Array<{ id: string; values: Record<string, unknown> }>;
      };
      assert.equal(t.id, file.replace(/\.json$/, ''), 'a template id is its filename');
      seeds.push({ what: `template ${t.id}`, values: t.values });
      for (const p of t.presets ?? []) {
        seeds.push({ what: `preset ${t.id}/${p.id}`, values: { ...t.values, ...p.values } });
      }
    }
  }
  assert.ok(seeds.length >= 3, 'the gallery strip wants three or four looks');

  for (const seed of seeds) {
    const rt = await mount(seed.values);
    assert.equal(rt.getHydratedString('{{warning}}'), '', `${seed.what}: hydrated with a warning`);
    const drawn = paths(rt);
    assert.ok(drawn.length > 0, `${seed.what}: drew nothing`);

    // The hydrated sheet carries one stroked <path> per stroke, in the ink
    // colour the seed asked for - the extras being right is not the same as
    // the template using them.
    const html = rt.getHydrated() as string;
    const ink = String(seed.values.color).toLowerCase();
    assert.equal((html.match(new RegExp(`stroke="${ink}"`, 'g')) ?? []).length, drawn.length,
      `${seed.what}: one inked path per stroke (the button glyphs paint currentColor)`);

    for (const d of drawn) {
      assert.ok(/^M/.test(d), `${seed.what}: a path that does not start with a move is not drawable`);
      for (const n of coords(d)) assert.ok(Number.isFinite(n), `${seed.what}: ${n} is not a coordinate`);
    }
  }
});

test('the examples cover both an untouched and a heavily smoothed look', { skip: SKIP }, () => {
  const smoothings = (MANIFEST!.examples ?? []).map((e) => Number(e.values.smoothing));
  assert.ok(smoothings.some((s) => s <= 20), 'one look should show the recorded line');
  assert.ok(smoothings.some((s) => s >= 60), 'one look should show what the slider does');
});
