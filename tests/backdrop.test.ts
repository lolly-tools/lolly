// SPDX-License-Identifier: MPL-2.0
/**
 * Backdrop - the vendored Paper Shaders harness (plans/164 section 2b).
 *
 * Run with: node --test tests/backdrop.test.ts
 *
 * Drives the SHIPPED community/backdrop/hooks.js the way the engine's
 * in-realm executor does, and pins the contracts that keep the tool honest:
 *
 *   - determinism: the same model renders byte-identical markup across two
 *     independent hooks loads, and hooks.js never calls Math.random.
 *   - sanitisation: colour values land in an inline style attribute and a
 *     JSON data attribute, so only strict hex survives; junk takes the
 *     brand-agnostic fallbacks and an unknown effect falls back to metaballs.
 *   - manifest: all fifteen effect options carry a family badge and a formats
 *     subset of render.formats; the two STILL effects (waves, dot-grid) offer
 *     no video; the density/speed gates exclude exactly the effects whose
 *     config maps no such knob; the Moment default sits past the start.
 *   - the template's EFFECTS table covers exactly the manifest's options.
 *   - the vendored lib ships beside its Apache-2.0 LICENSE and exposes every
 *     fragment shader the table mounts.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'community', 'backdrop');
const hooksSource = readFileSync(join(DIR, 'hooks.js'), 'utf8');
const templateSource = readFileSync(join(DIR, 'template.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(DIR, 'tool.json'), 'utf8'));

interface BackdropPatch { svgContent: string }
interface Hooks {
  onInit: ((ctx: unknown) => BackdropPatch) | null;
  onInput: ((ctx: unknown) => BackdropPatch) | null;
}

/** Mirror of the engine's getHookFactory wrapper (engine/src/runtime.ts). */
function loadHooks(): Hooks {
  const factory = new Function(
    'host',
    `${hooksSource}; return {` +
    `onInit: typeof onInit !== 'undefined' ? onInit : null,` +
    `onInput: typeof onInput !== 'undefined' ? onInput : null};`,
  );
  return factory({ log: () => {} }) as Hooks;
}

function model(values: Record<string, unknown>): Array<{ id: string; value: unknown }> {
  const base: Record<string, unknown> = {
    effect: 'metaballs', count: 4,
    color1: '#30ba78', color2: '#00bda7', color3: '#f2a65a', color4: '#5b8def',
    background: '#0b1021', intensity: 50, density: 50, scale: 100, rotation: 0,
    speed: 100, phase: 35,
    ...values,
  };
  return Object.entries(base).map(([id, value]) => ({ id, value }));
}

const STILL_EFFECTS = ['waves', 'dot-grid'];

test('hooks render byte-identical across independent loads, with no Math.random call', () => {
  assert.ok(!/Math\.random\s*\(/.test(hooksSource), 'no Math.random() in hooks.js');
  const m = model({ effect: 'god-rays', intensity: 62 });
  const a = loadHooks().onInput!({ model: m });
  const b = loadHooks().onInput!({ model: m });
  assert.equal(a.svgContent, b.svgContent);
});

test('markup: host + config attribute + fallback wash, with strict-hex sanitisation', () => {
  const out = loadHooks().onInput!({ model: model({ color1: 'javascript:alert(1)', background: '#abc' }) });
  assert.ok(out.svgContent.startsWith('<div class="bd-host"'), 'bd-host root');
  assert.ok(out.svgContent.includes('bd-wash'), 'fallback wash layer present');
  const cfg = JSON.parse(/data-bd='([^']+)'/.exec(out.svgContent)![1]!);
  assert.equal(cfg.colors[0], '#6d5bd8', 'junk colour takes the fallback');
  assert.equal(cfg.background, '#aabbcc', '#rgb expands to #rrggbb');
  assert.ok(!out.svgContent.includes('javascript:'), 'no unsanitised value reaches the markup');

  const unknown = loadHooks().onInput!({ model: model({ effect: '<script>' }) });
  assert.equal(JSON.parse(/data-bd='([^']+)'/.exec(unknown.svgContent)![1]!).effect, 'metaballs');
});

test('manifest: fifteen badged effect options, formats subsets, stills offer no video', () => {
  const effectInput = manifest.inputs.find((i: { id: string }) => i.id === 'effect');
  assert.equal(effectInput.options.length, 15);
  const union = new Set<string>(manifest.render.formats);
  for (const o of effectInput.options) {
    assert.ok(o.badge, `${o.value} carries a family badge`);
    assert.ok(Array.isArray(o.formats) && o.formats.length, `${o.value} declares formats`);
    for (const f of o.formats) assert.ok(union.has(f), `${o.value} format ${f} within render.formats`);
    const hasVideo = o.formats.some((f: string) => ['webm', 'mp4', 'gif'].includes(f));
    assert.equal(hasVideo, !STILL_EFFECTS.includes(o.value),
      `${o.value} ${STILL_EFFECTS.includes(o.value) ? 'is a still pattern - no video' : 'animates - offers video'}`);
  }
});

test('manifest: knob gates and the Moment default', () => {
  const byId = new Map(manifest.inputs.map((i: { id: string }) => [i.id, i]));
  const effects = (byId.get('effect') as { options: Array<{ value: string }> }).options.map(o => o.value);
  const densityGate = (byId.get('density') as { showIf: { effect: string[] } }).showIf.effect;
  assert.deepEqual(effects.filter(e => !densityGate.includes(e)), ['dithering'],
    'density hides exactly for dithering (its config maps no second knob)');
  const speedGate = (byId.get('speed') as { showIf: { effect: string[] } }).showIf.effect;
  assert.deepEqual(effects.filter(e => !speedGate.includes(e)).sort(), STILL_EFFECTS.sort(),
    'speed hides exactly for the still patterns');
  assert.equal((byId.get('phase') as { default: number }).default, 35,
    'the Moment default sits past the start - several effects are still gathering themselves at 0');
});

test('the template EFFECTS table covers exactly the manifest options', () => {
  const tableKeys = [...templateSource.matchAll(/^\s{6}'([a-z-]+)': \{ frag:/gm)].map(m => m[1]!);
  const manifestValues = manifest.inputs.find((i: { id: string }) => i.id === 'effect')
    .options.map((o: { value: string }) => o.value);
  assert.deepEqual(tableKeys.sort(), manifestValues.sort());
});

test('the vendored lib ships with its licence and every mounted fragment', () => {
  const libPath = join(DIR, 'lib', 'paper-shaders.min.js');
  assert.ok(existsSync(libPath), 'lib/paper-shaders.min.js present');
  assert.ok(existsSync(join(DIR, 'lib', 'LICENSE')), 'lib/LICENSE present (Apache-2.0)');
  const lib = readFileSync(libPath, 'utf8');
  assert.ok(lib.startsWith('/*! Paper Shaders'), 'attribution banner survives minification');
  for (const frag of [...templateSource.matchAll(/frag: '(\w+)'/g)].map(m => m[1]!)) {
    assert.ok(lib.includes(frag), `bundle exposes ${frag}`);
  }
  assert.ok(lib.includes('ShaderMount') && lib.includes('getShaderNoiseTexture'),
    'bundle exposes the mount and the noise texture helper');
});
