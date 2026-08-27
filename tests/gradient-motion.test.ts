// SPDX-License-Identifier: MPL-2.0
/**
 * Mesh Gradient (community/gradient) - motion export contract.
 *
 * The tool has always drifted on screen; what is pinned here is that the drift
 * is EXPORTABLE and that turning it off changes nothing. Three promises:
 *
 *   1. The manifest declares the motion formats (webm / mp4 / gif) plus the
 *      render.video timing block the export bar seeds itself from.
 *   2. Drift off is byte-identical to the pre-motion render - no <style>, no
 *      keyframes, the same SVG string (pinned by hash below).
 *   3. beforeExport plays the drift for a motion format and freezes the base
 *      pose for every other one, sets the clip to exactly one loop, and yields
 *      to a length the user typed in the export bar (opts.durationUserSet).
 *
 * Plus the wave standard: every example, template and preset seed hydrates
 * with no hook error.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/gradient-motion.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// gradient ships in the PUBLIC community pack. Load from the SOURCE pack, not
// the gitignored tools/ profile view, so the suite is profile-independent: skip
// only when community/ isn't checked out (a clone without submodules); with it
// present, a missing tool dir means a rename/delete and must FAIL loudly.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const PKG = join(COMMUNITY, 'gradient');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(PKG, 'tool.json')),
    'community/gradient/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('gradient', fetchFile);
const manifest: any = SKIP ? null : JSON.parse(readFileSync(join(PKG, 'tool.json'), 'utf8'));

/** The rendered gradient itself - the hook extra the template drops in raw. */
async function render(values: any): Promise<{ svg: string; rt: any }> {
  const rt = await createRuntime(tool, baseHost(), values);
  return { svg: rt.getHydratedString('{{{svgContent}}}') as string, rt };
}

test('the manifest declares the motion formats and the video timing block', { skip: SKIP }, () => {
  const formats: string[] = manifest.render.formats;
  for (const f of ['webm', 'mp4', 'gif']) {
    assert.ok(formats.includes(f), `render.formats must offer ${f}`);
  }
  // svg-anim is deliberately NOT declared: that path re-walks the live DOM into
  // one vector snapshot per frame, so a 12 s loop would stack ~120 copies of the
  // gradient (and its turbulence filter) into one file. Raster motion covers it.
  assert.ok(!formats.includes('svg-anim'), 'svg-anim stays off the list (see the note above)');

  const video = manifest.render.video;
  assert.equal(video.wait, 0, 'capture starts immediately - the hook restarts the loop at t=0');
  // render.video.duration is what the export bar's Duration field SHOWS, and the
  // hook then exports one whole loop. With the drift at its default speed those
  // two must agree, or the bar promises a length the file does not have.
  const speedDefault = manifest.inputs.find((i: { id: string }) => i.id === 'speed').default;
  assert.equal(video.duration, speedDefault,
    'the export bar must show the clip length the hook actually produces at the default speed');

  const ids = new Set<string>(manifest.inputs.map((i: { id: string }) => i.id));
  for (const id of ['animate', 'speed', 'distance']) {
    assert.ok(ids.has(id), `the drift control "${id}" must keep its id (it is a URL contract)`);
  }
});

// The pre-motion render, pinned. Regenerate ONLY with a deliberate change to the
// still output: mount the tool with {} and hash getHydratedString('{{{svgContent}}}').
const DRIFT_OFF_SHA = '59e6b8edc6d12e60f9e63292daa4178640035fbf493778f14c561d5401ea9f89';

test('drift off renders exactly what it always did', { skip: SKIP }, async () => {
  const { svg } = await render({});
  assert.ok(!svg.includes('<style>'), 'a still render carries no animation stylesheet');
  assert.ok(!svg.includes('@keyframes'), 'a still render carries no keyframes');
  assert.equal(createHash('sha256').update(svg).digest('hex'), DRIFT_OFF_SHA,
    `the default still render changed (${svg.length} chars) - motion work must not move a static pixel`);
});

test('drift on emits one keyframe orbit per colour point', { skip: SKIP }, async () => {
  const { svg } = await render({ animate: true, count: 3, speed: 9 });
  for (let n = 1; n <= 3; n++) {
    assert.ok(svg.includes(`@keyframes mg-d${n}{`), `colour point ${n} needs its own orbit`);
    assert.ok(svg.includes(`.mg-blob-${n}{animation:mg-d${n} 9s linear infinite`),
      `colour point ${n} runs the loop at the chosen speed`);
  }
  assert.ok(!svg.includes('@keyframes mg-d4{'), 'no orbit for a colour point that is not shown');
  // Every orbit passes through the set position at t=0, so a still export and the
  // first video frame are the same pose.
  assert.ok(/@keyframes mg-d1\{0\.0%\{transform:translate\(0\.0px,0\.0px\)\}/.test(svg),
    'the loop starts on the set position');
  // Freezing the float distance must leave the blobs on their set positions.
  const still = await render({ animate: true, count: 3, distance: 0 });
  assert.ok(/@keyframes mg-d1\{(0\.0%|\d+\.\d%)\{transform:translate\(-?0\.0px,-?0\.0px\)\}/.test(still.svg),
    'distance 0 keeps every waypoint on the set position');
});

// ── beforeExport: what the shell's export bar actually sees ──────────────────

interface HookModule {
  onInit: (ctx: unknown) => Promise<Record<string, string>>;
  beforeExport: (ctx: { node: unknown; format: string; opts: Record<string, unknown> }) => void;
  afterExport: (ctx?: { node: unknown }) => void;
}

/**
 * Compile hooks.js exactly as engine/src/runtime.ts getHookFactory does, against
 * the REAL host.log shape - `(level, msg, ctx?) => void`, a function, not an
 * object of per-level methods. A stub with `log.warn` on it lets a hook that
 * calls the wrong shape pass while shipping a warning nobody ever sees.
 */
function compileHooks(logs: string[] = []): HookModule {
  const src = readFileSync(join(PKG, 'hooks.js'), 'utf8');
  const factory = new Function(
    'host',
    `${src}; return {` +
    `onInit: typeof onInit !== 'undefined' ? onInit : null,` +
    `beforeExport: typeof beforeExport !== 'undefined' ? beforeExport : null,` +
    `afterExport: typeof afterExport !== 'undefined' ? afterExport : null` +
    `};`,
  ) as (host: unknown) => HookModule;
  return factory({ log: (level: string, msg: string) => { logs.push(`${level}: ${msg}`); }, tokens: null });
}

/**
 * A stand-in for the rendered canvas: one <svg class="mg-svg"> whose classes we
 * watch. `log` records the ORDER of the class writes and of every layout read,
 * because the animation restart is only real if a reflow separates the freeze
 * from the unfreeze.
 */
function fakeNode(): { node: any; classes: Set<string>; log: string[] } {
  const classes = new Set<string>();
  const log: string[] = [];
  const svg = {
    classList: {
      add: (c: string) => { log.push(`+${c}`); classes.add(c); },
      remove: (c: string) => { log.push(`-${c}`); classes.delete(c); },
    },
    getBoundingClientRect: () => { log.push('reflow'); return {}; },
  };
  const node = {
    get offsetWidth() { log.push('reflow'); return 0; },
    querySelector: (sel: string) => (sel === 'svg.mg-svg' ? svg : null),
  };
  return { node, classes, log };
}

/** Prime the hook module's drift state, then run one export through it. */
async function exportWith(
  values: Record<string, unknown>,
  format: string,
  opts: Record<string, unknown> = {},
): Promise<{ classes: Set<string>; opts: Record<string, unknown>; hooks: HookModule; node: any; log: string[]; logs: string[] }> {
  const logs: string[] = [];
  const hooks = compileHooks(logs);
  const model = manifest.inputs.map((i: { id: string; default?: unknown }) => ({
    id: i.id,
    value: Object.prototype.hasOwnProperty.call(values, i.id) ? values[i.id] : i.default,
  }));
  await hooks.onInit({ model, host: null });
  const { node, classes, log } = fakeNode();
  hooks.beforeExport({ node, format, opts });
  return { classes, opts, hooks, node, log, logs };
}

test('a motion export plays one drift loop; a still export freezes the pose', { skip: SKIP }, async () => {
  for (const format of ['webm', 'mp4', 'gif']) {
    const { classes, opts } = await exportWith({ animate: true, speed: 10 }, format);
    assert.ok(classes.has('mg-export'), `${format}: drift must run during capture, reduced motion or not`);
    assert.ok(!classes.has('mg-frozen'), `${format}: the loop is restarted, not left frozen`);
    assert.equal(opts.duration, 10, `${format}: the clip is exactly one loop`);
    assert.equal(opts.wait, 0, `${format}: capture starts at the loop origin`);
  }
  for (const format of ['svg', 'png', 'jpg', 'webp', 'avif']) {
    const { classes, opts } = await exportWith({ animate: true, speed: 10 }, format);
    assert.ok(classes.has('mg-frozen'), `${format}: a still must not bake a mid-loop pose`);
    assert.equal(opts.duration, undefined, `${format}: a still has no clip length`);
  }
});

test('the frame budget shortens a long loop, and a typed duration wins', { skip: SKIP }, async () => {
  // 24 s at 60 fps is past the frame ceiling, so the clip is cut to what fits.
  const fast = await exportWith({ animate: true, speed: 24 }, 'webm', { fps: 60 });
  assert.equal(fast.opts.duration, Math.floor(595 / 60), 'a 60 fps clip is capped by the frame budget');
  // A shortened loop pops at the seam, so the tool has to SAY so. host.log is a
  // (level, msg) function; calling it as an object of level methods logs nothing.
  assert.match(fast.logs.join('\n'), /^warn: gradient: 24s loop shortened to 9s/m,
    'the seam warning must actually reach host.log');
  const whole = await exportWith({ animate: true, speed: 8 }, 'webm', { fps: 60 });
  assert.deepEqual(whole.logs, [], 'a loop that fits warns about nothing');
  // ANDY'S RULE (shared with the sequence path): a length the user typed wins.
  const typed = await exportWith({ animate: true, speed: 12 }, 'mp4', { duration: 3, durationUserSet: true });
  assert.equal(typed.opts.duration, 3, 'a user-set duration is never overwritten');
  assert.ok(typed.classes.has('mg-export'), 'the drift still runs for the user-set clip');
});

// GIF ignores opts.fps (the encoder is fixed at 15 fps) and its frame ceiling
// scales with device memory, so the loop is bounded in SECONDS instead - the same
// bound the digi-ad tools use. A 24 s loop at 1600x900 would otherwise be 360
// quantised full-size frames, truncated mid-clip on a small device.
test('a GIF loop is bounded in seconds, not by the video frame budget', { skip: SKIP }, async () => {
  const short = await exportWith({ animate: true, speed: 12 }, 'gif', { fps: 60 });
  assert.equal(short.opts.duration, 12, 'a loop inside the bound is exported whole, whatever fps says');
  const long = await exportWith({ animate: true, speed: 24 }, 'gif', { fps: 60 });
  assert.equal(long.opts.duration, 16, 'a longer loop is cut to the GIF bound');
});

// host.compose renders this tool as a CHILD of another one and inlines the result
// into the parent's export, with a length its caller already chose and bounded
// (pro/render-export EMBED_MAX_DURATION). Stretching that to a whole loop embeds a
// clip several times the size the parent asked for.
test('a composed child keeps the length its caller set', { skip: SKIP }, async () => {
  const { classes, opts } = await exportWith(
    { animate: true, speed: 24 }, 'gif', { duration: 6, thumbnail: true },
  );
  assert.equal(opts.duration, 6, 'an embedded clip is not lengthened to a full loop');
  assert.equal(opts.wait, 0, 'it still starts at the loop origin');
  assert.ok(classes.has('mg-export'), 'and it still drifts');
});

test('afterExport clears every export-only class and restarts the drift', { skip: SKIP }, async () => {
  const { classes, hooks, node, log } = await exportWith({ animate: true }, 'webm');
  log.length = 0;
  hooks.afterExport({ node });
  assert.equal(classes.size, 0, 'the live canvas goes back to how it was');
  // A motion capture pauses every CSS animation to scrub it and never resumes
  // them, so unfreezing is not enough - the animation property has to go away and
  // come back across a reflow, which cancels the paused ones and starts fresh.
  assert.deepEqual(log, ['-mg-export', '+mg-frozen', 'reflow', '-mg-frozen'],
    'the drift is restarted, not just unfrozen');

  const still = await exportWith({ animate: true }, 'png');
  still.hooks.afterExport({ node: still.node });
  assert.equal(still.classes.size, 0, 'a frozen still export unfreezes too');

  // Older shells called afterExport with no ctx; it must still force the reflow.
  const bare = await exportWith({ animate: true }, 'webm');
  bare.log.length = 0;
  bare.hooks.afterExport();
  assert.equal(bare.classes.size, 0, 'no ctx still leaves a clean canvas');
  assert.ok(bare.log.includes('reflow'), 'no ctx still forces the restart reflow');
});

test('with drift off the export hook touches nothing', { skip: SKIP }, async () => {
  const { classes, opts } = await exportWith({ animate: false }, 'webm');
  assert.equal(classes.size, 0, 'no drift means no class changes');
  assert.equal(opts.duration, undefined, 'no drift means the export bar keeps its own length');
});

test('every example, template and preset seed hydrates', { skip: SKIP }, async () => {
  const seeds: Array<[string, Record<string, unknown>]> = [];
  for (const ex of manifest.examples) seeds.push([`example "${ex.label}"`, ex.values]);

  const dir = join(PKG, 'templates');
  const files = readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  assert.ok(files.length >= 3, 'the tool ships at least three starting templates');
  for (const file of files) {
    const t = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    assert.equal(t.id, file.replace(/\.json$/, ''), `${file}: template id must match its basename`);
    seeds.push([`template "${t.id}"`, t.values]);
    for (const p of t.presets ?? []) {
      seeds.push([`preset "${t.id}/${p.id}"`, { ...t.values, ...p.values }]);
    }
  }

  const declared = new Set<string>(manifest.inputs.map((i: { id: string }) => i.id));
  for (const [label, values] of seeds) {
    for (const key of Object.keys(values)) {
      assert.ok(declared.has(key), `${label} sets "${key}", which is not a declared input`);
    }
    const { svg } = await render(values);
    /* Each mode has its own root: blend an <svg> of radial gradients,
       subdivide an <svg> of flat quads, mesh/warp/flow a <canvas> the
       template script paints. */
    const mode = (values.mode as string) ?? 'blend';
    if (mode === 'blend') {
      assert.match(svg, /^<svg class="mg-svg"/, `${label} must render the gradient`);
      assert.ok(svg.includes('<radialGradient'), `${label} must paint colour points`);
      assert.ok(!/stop-color=""/.test(svg), `${label} left a colour empty`);
    } else if (mode === 'subdivide') {
      assert.match(svg, /^<svg class="mg-svg mg-sub"/, `${label} must render the subdivided mesh`);
      assert.ok(svg.includes('<path '), `${label} must emit mesh quads`);
    } else {
      assert.match(svg, new RegExp(`^<canvas class="mg-${mode}-canvas"`), `${label} must mount the ${mode} canvas`);
    }
    assert.ok(!svg.includes('{color.'), `${label} leaked a token alias into the render`);
  }

  const drifting = manifest.examples.filter((ex: { values: Record<string, unknown> }) => ex.values.animate === true);
  assert.ok(drifting.length >= 1, 'the gallery advertises the motion path with at least one drifting example');
  for (const ex of drifting) {
    const { svg } = await render(ex.values);
    assert.ok(svg.includes('@keyframes mg-d1{'), `example "${ex.label}" claims drift, so it must animate`);
  }
});
