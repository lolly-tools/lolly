// SPDX-License-Identifier: MPL-2.0
/**
 * URL Screenshot (community/url-shot) - the multi-viewport compare frame.
 *
 * `compare` captures the SAME page twice, once at the export size and once at a
 * phone viewport, and lays both out in one frame (side by side, or the phone
 * tucked over the desktop's lower right corner). Two things have to stay true at
 * once: the new layouts must actually compose, and the default - single - must
 * render exactly the markup it rendered before the feature existed.
 *
 * What is pinned here:
 *  - single mode is BYTE-IDENTICAL to the pre-feature template. The proof is not
 *    a hand-written snapshot: the pre-feature template is reconstructed from the
 *    shipped one by removing exactly the two edits (the root's {{cmpClass}} and
 *    the standalone {{#if cmpPhone}} block), then both are driven through the
 *    real engine and the hydrated strings are compared;
 *  - each compare mode marks the root with its own modifier and no other, and
 *    draws the phone frame at the proportions the two viewport inputs name;
 *  - the capture REQUESTS: one in single mode, two in a compare mode, carrying
 *    the desktop and phone viewports and otherwise the same page spec; the same
 *    doubling on the vector path;
 *  - a video export stays a single desktop pan: the phone frame is hidden AND the
 *    layout modifier comes off, so the pan fills the frame instead of sitting
 *    inset in a padded row;
 *  - the phone's own placeholder comes down once its capture arrives (it sits over
 *    the screen, so leaving it up would hide the second shot entirely) and stays
 *    up when nothing arrived;
 *  - the placeholder path: with no capture available, a compare frame waits as
 *    TWO placeholders, not one placeholder and an empty slab;
 *  - the layouts are CSS, so the two geometries are pinned in styles.css.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/url-shot-compare.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// Load from the SOURCE pack, not the gitignored tools/ profile view, so the
// suite is profile-independent: skip only when community/ is not checked out.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const TOOL_DIR = join(COMMUNITY, 'url-shot');
const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(TOOL_DIR, 'tool.json')),
    'community/url-shot/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const MANIFEST = SKIP ? null : JSON.parse(readFileSync(join(TOOL_DIR, 'tool.json'), 'utf8')) as {
  inputs: Array<{ id: string; default?: unknown }>;
  examples?: Array<{ label: string; values: Record<string, unknown> }>;
};
const TEMPLATE = SKIP ? '' : readFileSync(join(TOOL_DIR, 'template.html'), 'utf8');
const STYLES = SKIP ? '' : readFileSync(join(TOOL_DIR, 'styles.css'), 'utf8');
const HOOKS_SRC = SKIP ? '' : readFileSync(join(TOOL_DIR, 'hooks.js'), 'utf8');

const tool: any = SKIP ? null : await loadTool('url-shot', fetchFile);

async function render(state: Record<string, any>): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), state);
  return rt.getHydrated() as string;
}

// ─── single mode is byte-identical to the pre-feature template ───────────────

/** The template as it was before compare shipped: the root class back to a plain
 *  literal, and the phone block gone, line and all. If either edit ever stops
 *  matching, this throws rather than quietly comparing the file to itself. */
function preFeatureTemplate(): string {
  const noClass = TEMPLATE.replace('class="url-shot{{cmpClass}}"', 'class="url-shot"');
  assert.notEqual(noClass, TEMPLATE, 'the root no longer carries {{cmpClass}} - update this reconstruction');
  const noPhone = noClass.replace(/\{\{#if cmpPhone\}\}\n[\s\S]*?\{\{\/if\}\}\n/, '');
  assert.notEqual(noPhone, noClass, 'the phone pane is no longer a standalone {{#if cmpPhone}} block');
  return noPhone;
}

test('single mode renders exactly what the tool rendered before compare existed', { skip: SKIP }, async () => {
  const pre = preFeatureTemplate();
  const preTool: any = await loadTool('url-shot', async (path: string) =>
    path === 'url-shot/template.html' ? pre : fetchFile(path));

  const states: Array<Record<string, any>> = [
    {},
    { compare: 'single' },
    // The viewport inputs exist in every mode; in single they must not leak
    // one byte into the output.
    { compare: 'single', mobileWidth: 428, mobileHeight: 926 },
    { url: 'https://example.invalid/docs', scrollDepth: 0.4, cropTop: 0.1 },
  ];
  for (const state of states) {
    const now = await render(state);
    const before = await createRuntime(preTool, baseHost(), state).then(rt => rt.getHydrated() as string);
    assert.equal(now, before, `single mode drifted for ${JSON.stringify(state)}`);
  }
});

test('single mode carries no compare markup at all', { skip: SKIP }, async () => {
  const html = await render({});
  assert.ok(html.includes('<div class="url-shot" data-shot-root'),
    'the root class must be the bare one, with no empty modifier left behind');
  for (const token of ['cmp-phone', 'data-capture-mobile', 'url-shot--', 'aspect-ratio']) {
    assert.ok(!html.includes(token), `single mode emitted "${token}"`);
  }
});

// ─── the two layouts ─────────────────────────────────────────────────────────

test('each compare mode marks the root with its own modifier and no other', { skip: SKIP }, async () => {
  for (const [mode, cls] of [['side', 'url-shot--side'], ['overlap', 'url-shot--overlap']] as const) {
    const html = await render({ compare: mode });
    assert.ok(html.includes(`<div class="url-shot ${cls}" data-shot-root`),
      `compare=${mode} did not reach ${cls}`);
    for (const other of ['url-shot--side', 'url-shot--overlap']) {
      if (other === cls) continue;
      assert.ok(!html.includes(other), `compare=${mode} also rendered ${other}`);
    }
    assert.ok(html.includes('data-cmp-phone') && html.includes('data-capture-mobile'),
      `compare=${mode} drew no phone frame`);
    // Order is the layout: side by side is a plain flex row, so the phone has to
    // follow BOTH the desktop capture and the placeholder that stands in for it,
    // or an uncaptured frame puts the phone on the left.
    assert.ok(html.indexOf('data-cmp-phone') > html.indexOf('data-placeholder'),
      `compare=${mode} places the phone before the desktop frame`);
  }
});

test('the phone frame takes its proportions from the two viewport inputs', { skip: SKIP }, async () => {
  const dflt = await render({ compare: 'side' });
  assert.ok(dflt.includes('aspect-ratio:390 / 844'), 'the default phone frame is 390 x 844');

  const custom = await render({ compare: 'side', mobileWidth: 428, mobileHeight: 926 });
  assert.ok(custom.includes('aspect-ratio:428 / 926'), 'a typed viewport must reach the frame');

  // Junk never reaches the style attribute as junk - an unparseable aspect-ratio
  // is a dropped declaration, i.e. a collapsed frame.
  for (const bad of [{ mobileWidth: 'wide' }, { mobileWidth: -20 }, { mobileHeight: null }, { mobileHeight: 99999 }]) {
    const html = await render({ compare: 'side', ...bad });
    assert.match(html, /aspect-ratio:\d+ \/ \d+"/, `junk viewport ${JSON.stringify(bad)} broke the frame`);
    assert.ok(!html.includes('wide') && !html.includes('-20'),
      `junk viewport ${JSON.stringify(bad)} reached the markup`);
  }
});

test('with no capture available a compare frame waits as TWO placeholders', { skip: SKIP }, async () => {
  // baseHost has no capture bridge, which is the web PWA's own situation: the
  // tool must still compose, showing which page each frame is waiting for.
  const html = await render({ compare: 'side', url: 'https://lolly.tools/gallery' });
  assert.ok(html.includes('data-placeholder'), 'the desktop placeholder must survive');
  assert.ok(html.includes('cmp-phone-ph'), 'the phone frame needs its own placeholder');
  assert.equal(html.split('https://lolly.tools/gallery').length - 1, 3,
    'the URL is named on the root, in the desktop placeholder and in the phone one');
});

test('the two layouts are real geometry in styles.css, not just class names', { skip: SKIP }, async () => {
  const block = (sel: string): string => {
    const at = STYLES.indexOf(sel);
    assert.notEqual(at, -1, `styles.css has no rule for ${sel}`);
    return STYLES.slice(at, STYLES.indexOf('}', at));
  };
  // Side by side: the root becomes a row, so the two frames sit next to each other.
  assert.match(block('.url-shot--side {'), /flex-direction:\s*row/,
    'side by side must lay the root out as a row');
  // Overlap: the phone leaves the flow and tucks into the lower right corner.
  const over = block('.url-shot--overlap .cmp-phone');
  assert.match(over, /position:\s*absolute/, 'the overlapping phone must leave the flow');
  assert.match(over, /right:/, 'the overlapping phone tucks against the right edge');
  assert.match(over, /bottom:/, 'the overlapping phone tucks against the bottom edge');
  // An uncaptured phone screen shows its placeholder rather than a broken image.
  assert.match(block('.url-shot .cmp-phone-shot:not([src])'), /display:\s*none/);
  // The bezel's proportions come from the UNCROPPED viewport, so a cropped shot
  // has a different aspect than its screen. Contain letterboxes it; cover would
  // trim the edges off the capture without saying so - the same call the desktop
  // frame already makes.
  assert.match(block('.url-shot .cmp-phone-shot {'), /object-fit:\s*contain/,
    'the phone screen must letterbox its capture, never crop it');
});

// ─── the capture requests ────────────────────────────────────────────────────

interface HookModule {
  onInit: (ctx: { model: Array<{ id: string; value: unknown }> }) => unknown;
  beforeExport: (ctx: Record<string, unknown>) => Promise<void>;
}

/** Compile hooks.js the way engine/src/runtime.ts getHookFactory does. */
function compileHooks(): HookModule {
  const factory = new Function('host',
    `${HOOKS_SRC}; return { onInit, beforeExport };`) as (host: unknown) => HookModule;
  return factory(null);
}

/** The input model the runtime would build: manifest defaults plus overrides. */
function model(over: Record<string, unknown> = {}): Array<{ id: string; value: unknown }> {
  return MANIFEST!.inputs.map(i => ({ id: i.id, value: i.id in over ? over[i.id] : i.default }));
}

function fakeEl(): any {
  const attrs: Record<string, string> = {};
  const classes = new Set<string>();
  return {
    attrs,
    style: {},
    classes,
    setAttribute: (k: string, v: string) => { attrs[k] = v; },
    getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
    classList: { add: (c: string) => classes.add(c), remove: (...c: string[]) => c.forEach(x => classes.delete(x)) },
  };
}

/** A stand-in for the rendered canvas: only the handles the hook reaches for. */
function fakeNode(withPhone: boolean, mode: 'side' | 'overlap' = 'side', has: { mobileImg?: boolean } = {}) {
  const img = fakeEl(), canvas = fakeEl(), placeholder = fakeEl();
  const phone = fakeEl(), mobileImg = fakeEl(), phonePh = fakeEl();
  canvas.getContext = () => ({ clearRect() {}, drawImage() {} });
  const map: Record<string, any> = {
    '[data-capture]': img,
    '[data-shot-canvas]': canvas,
    '[data-placeholder]': placeholder,
    '[data-cmp-phone]': withPhone ? phone : null,
    '[data-capture-mobile]': withPhone && has.mobileImg !== false ? mobileImg : null,
    '[data-cmp-placeholder]': withPhone ? phonePh : null,
  };
  const node: any = fakeEl();
  // The root IS the hook's `root`, so it carries the layout modifier the template
  // stamped on it - that is what a video export has to be able to strip.
  if (withPhone) node.classes.add(`url-shot--${mode}`);
  node.matches = (sel: string) => sel === '.url-shot';
  node.querySelector = (sel: string) => map[sel] ?? null;
  return { node, img, canvas, phone, mobileImg, phonePh };
}

interface Shot { kind: string; spec: any }

function fakeHost(opts: { vector?: boolean } = {}) {
  const shots: Shot[] = [];
  const take = (kind: string) => async (spec: any) => {
    shots.push({ kind, spec });
    return { url: `${kind}:${spec.width}x${spec.height}`, width: spec.width, height: spec.height };
  };
  const capture: any = { page: take('page') };
  if (opts.vector) capture.vector = take('vector');
  return { host: { capture, log() {} }, shots };
}

const EXPORT_OPTS = { width: 1280, height: 720 };

test('single mode issues exactly one capture, at the export size', { skip: SKIP }, async () => {
  const hooks = compileHooks();
  hooks.onInit({ model: model({ url: 'https://lolly.tools' }) });
  const { node, img } = fakeNode(false);
  const { host, shots } = fakeHost();

  await hooks.beforeExport({ node, format: 'png', opts: EXPORT_OPTS, host });

  assert.equal(shots.length, 1, 'single mode must not capture twice');
  assert.equal(shots[0]!.spec.width, 1280);
  assert.equal(shots[0]!.spec.height, 720);
  assert.equal(img.attrs.src, 'page:1280x720');
});

test('a compare mode captures the same page once per viewport', { skip: SKIP }, async () => {
  for (const mode of ['side', 'overlap']) {
    const hooks = compileHooks();
    hooks.onInit({ model: model({ url: 'https://lolly.tools', compare: mode, cropTop: 0.1 }) });
    const { node, img, mobileImg, phone } = fakeNode(true);
    const { host, shots } = fakeHost();

    await hooks.beforeExport({ node, format: 'png', opts: EXPORT_OPTS, host });

    assert.equal(shots.length, 2, `compare=${mode} must issue exactly two capture requests`);
    const [desk, mob] = shots as [Shot, Shot];
    assert.deepEqual([desk.spec.width, desk.spec.height], [1280, 720], 'the first shot is the export size');
    assert.deepEqual([mob.spec.width, mob.spec.height], [390, 844], 'the second shot is the phone viewport');
    // Same page, same framing - only the viewport differs.
    for (const key of ['url', 'scrollDepth', 'waitMs', 'css', 'dpr']) {
      assert.deepEqual(mob.spec[key], desk.spec[key], `the phone shot changed ${key}`);
    }
    assert.deepEqual(mob.spec.crop, desk.spec.crop, 'the trim insets are viewport fractions, so they carry over');
    assert.equal(img.attrs.src, 'page:1280x720');
    assert.equal(mobileImg.attrs.src, 'page:390x844');
    assert.equal(mobileImg.attrs.width, '390');
    assert.equal(mobileImg.attrs.height, '844');
    assert.equal(phone.hidden, false, 'the phone frame shows for a still');
  }
});

test('the phone placeholder is taken down once its capture arrives', { skip: SKIP }, async () => {
  // .cmp-phone-ph is position:absolute over the phone screen with an opaque
  // background, so leaving it up hides the second capture completely - the whole
  // feature renders as one screenshot next to a blank slab.
  const hooks = compileHooks();
  hooks.onInit({ model: model({ url: 'https://lolly.tools', compare: 'side' }) });
  const { node, phonePh, mobileImg } = fakeNode(true);
  const { host } = fakeHost();

  await hooks.beforeExport({ node, format: 'png', opts: EXPORT_OPTS, host });

  assert.ok(mobileImg.attrs.src, 'the phone capture must reach the second frame');
  assert.equal(phonePh.style.display, 'none', 'the phone placeholder still covers its own capture');
});

test('with no second capture the phone placeholder stays up', { skip: SKIP }, async () => {
  // A stale paint can carry the bezel without its image slot. Nothing reached
  // the phone frame, so the URL line has to stay: a blank bezel says nothing
  // about which page never arrived.
  const hooks = compileHooks();
  hooks.onInit({ model: model({ url: 'https://lolly.tools', compare: 'side' }) });
  const { node, phonePh } = fakeNode(true, 'side', { mobileImg: false });
  const { host } = fakeHost();

  await hooks.beforeExport({ node, format: 'png', opts: EXPORT_OPTS, host });

  assert.notEqual(phonePh.style.display, 'none',
    'with no phone capture the placeholder must stay visible');
});

test('a video export in a compare mode drops the layout with the bezel', { skip: SKIP }, async () => {
  // The bezel is hidden for a pan, so the row/overlap geometry has to go too:
  // .url-shot--side pads the root by 4% and rounds + shadows the surface, which
  // would inset the pan instead of filling the frame the way single mode does.
  const priorImage = (globalThis as any).Image;
  (globalThis as any).Image = class {
    naturalWidth = 1280;
    naturalHeight = 4000;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = '';
    set src(_v: string) { queueMicrotask(() => this.onload?.()); }
  };
  try {
    for (const mode of ['side', 'overlap'] as const) {
      const hooks = compileHooks();
      hooks.onInit({ model: model({ url: 'https://lolly.tools', compare: mode }) });
      const { node } = fakeNode(true, mode);
      const { host } = fakeHost();

      assert.ok(node.classes.has(`url-shot--${mode}`), 'the template stamped the modifier');
      await hooks.beforeExport({ node, format: 'mp4', opts: EXPORT_OPTS, host });
      assert.equal(node.classes.size, 0, `compare=${mode} left its layout on a video pan`);
    }
  } finally {
    (globalThis as any).Image = priorImage;
  }
});

test('a still export keeps the layout modifier it was hydrated with', { skip: SKIP }, async () => {
  const hooks = compileHooks();
  hooks.onInit({ model: model({ url: 'https://lolly.tools', compare: 'overlap' }) });
  const { node } = fakeNode(true, 'overlap');
  const { host } = fakeHost();
  await hooks.beforeExport({ node, format: 'png', opts: EXPORT_OPTS, host });
  assert.ok(node.classes.has('url-shot--overlap'), 'a still must not strip its own layout');
});

test('typed viewports reach the second capture request', { skip: SKIP }, async () => {
  const hooks = compileHooks();
  hooks.onInit({ model: model({ url: 'https://lolly.tools', compare: 'side', mobileWidth: 428, mobileHeight: 926 }) });
  const { node } = fakeNode(true);
  const { host, shots } = fakeHost();
  await hooks.beforeExport({ node, format: 'png', opts: EXPORT_OPTS, host });
  assert.deepEqual([shots[1]!.spec.width, shots[1]!.spec.height], [428, 926]);

  // Junk never becomes a capture spec.
  const junk = compileHooks();
  junk.onInit({ model: model({ url: 'https://lolly.tools', compare: 'side', mobileWidth: 'wide', mobileHeight: -5 }) });
  const second = fakeNode(true);
  const other = fakeHost();
  await junk.beforeExport({ node: second.node, format: 'png', opts: EXPORT_OPTS, host: other.host });
  assert.deepEqual([other.shots[1]!.spec.width, other.shots[1]!.spec.height], [390, 844]);
});

test('the vector path doubles too, so an SVG compare frame is not half raster', { skip: SKIP }, async () => {
  const hooks = compileHooks();
  hooks.onInit({ model: model({ url: 'https://lolly.tools', compare: 'side' }) });
  const { node } = fakeNode(true);
  const { host, shots } = fakeHost({ vector: true });

  await hooks.beforeExport({ node, format: 'svg', opts: EXPORT_OPTS, host });

  assert.deepEqual(shots.map(s => s.kind), ['vector', 'vector'],
    'both frames of a vector export must be printed, not rasterised');
});

test('a video export stays one desktop pan and hides the phone frame', { skip: SKIP }, async () => {
  // The pan surface is a single canvas, so compare has nothing to place beside
  // it; an empty bezel there would be furniture, not a comparison.
  const priorImage = (globalThis as any).Image;
  (globalThis as any).Image = class {
    naturalWidth = 1280;
    naturalHeight = 4000;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decoding = '';
    set src(_v: string) { queueMicrotask(() => this.onload?.()); }
  };
  try {
    const hooks = compileHooks();
    hooks.onInit({ model: model({ url: 'https://lolly.tools', compare: 'side' }) });
    const { node, phone, canvas } = fakeNode(true);
    const { host, shots } = fakeHost();

    await hooks.beforeExport({ node, format: 'webm', opts: EXPORT_OPTS, host });

    assert.equal(shots.length, 1, 'a video export captures the scroll strip and nothing else');
    assert.equal(shots[0]!.spec.rangeTo, 1, 'the strip still spans the pan');
    assert.equal(phone.hidden, true, 'the phone frame is hidden for a video');
    assert.equal(typeof canvas.__lollyFrameRender, 'function', 'the pan canvas keeps its frame clock');
  } finally {
    (globalThis as any).Image = priorImage;
  }
});

// Every shipped starting point has to mount and draw. url-shot ships none today
// (no examples array, no templates/ directory) - the loop is here so that adding
// one is covered the moment it appears, and the count below says what it found.
test('every example, template and preset seed hydrates', { skip: SKIP }, async () => {
  const ids = new Set(MANIFEST!.inputs.map(i => i.id));
  const seeds: Array<{ label: string; values: Record<string, unknown> }> = [];
  for (const ex of MANIFEST!.examples ?? []) seeds.push({ label: `example ${ex.label}`, values: ex.values });
  const dir = join(TOOL_DIR, 'templates');
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue;
      const t = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      seeds.push({ label: `template ${t.id}`, values: t.values });
      for (const p of t.presets ?? []) {
        seeds.push({ label: `template ${t.id} preset ${p.id}`, values: { ...t.values, ...p.values } });
      }
    }
  }
  console.log(`url-shot seeds checked: ${seeds.length}`);

  for (const { label, values } of seeds) {
    for (const key of Object.keys(values)) {
      assert.ok(ids.has(key), `${label} seeds "${key}", which is not an input`);
    }
    const html = await render(values);
    assert.ok(html.includes('data-shot-root'), `${label} did not render`);
  }
});
