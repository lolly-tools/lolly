// SPDX-License-Identifier: MPL-2.0
/**
 * Pose Geeko's alive loop (brands/suse/tools/pose-geeko, Motion: Alive).
 *
 * The loop is SMIL written inside each pose's own <svg> by hooks.js. These pin the
 * properties everything downstream relies on:
 *   • Still emits no motion at all (the default render is the pose, as before);
 *   • every track is a well-formed loop of exactly the chosen length whose end meets its start, so a
 *     Design clip or a video of that length repeats without a jump;
 *   • frame 0 of every track IS the posed still, so a renderer that ignores SMIL
 *     (resvg, the PDF walker) draws exactly what Still draws;
 *   • only <animateTransform> is used: the shell's sanitiser strips <animate>, <set> and
 *     <use> when it inlines a composed SVG into Design, so anything else would vanish;
 *   • the loop length the Design side reads off the markup (svgLoopMs) is the loop.
 *
 * Private: brands/suse is a private submodule, so every test skips without it (listed
 * in tests/expected-skips.json under brand:suse).
 *
 * Run with: node --test tests/pose-geeko-alive.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { loadTool, createRuntime } from '../engine/src/index.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';
import { svgLoopMs } from '../shells/web/src/lib/anim-detect.ts';

const DIR = fileURLToPath(new URL('../brands/suse/tools/pose-geeko/', import.meta.url));
const SKIP = existsSync(`${DIR}tool.json`) ? false : 'brands/suse is not checked out, so the suse profile cannot be resolved here';
const POSES = ['curious', 'sitting', 'laying', 'dangling'] as const;
/** The drawn pose: the <svg> element itself (the template's CSS comments mention "<svg>" too). */
const POSE_SVG = /<svg\s+class="[^"]*spot-illustration[\s\S]*?<\/svg>/;

async function hydrate(values: Record<string, unknown>): Promise<string> {
  const host = await createCliBridge({ dom: new JSDOM('<!doctype html><html><body></body></html>') } as Parameters<typeof createCliBridge>[0]);
  const tool = await loadTool('pose-geeko', async (path: string) => readFileSync(DIR + path.replace(/^pose-geeko\//, ''), 'utf8'));
  const rt = await createRuntime(tool, host, values as never);
  return rt.getHydrated();
}

interface Track { type: string; additive: boolean; dur: string; times: number[]; values: string[]; tag: string }
function tracks(html: string): Track[] {
  const out: Track[] = [];
  for (const tag of html.match(/<animateTransform\b[^>]*>/g) ?? []) {
    const attr = (n: string): string => (new RegExp(`\\b${n}="([^"]*)"`).exec(tag)?.[1] ?? '');
    out.push({
      type: attr('type'), additive: attr('additive') === 'sum', dur: attr('dur'),
      times: attr('keyTimes').split(';').map(Number), values: attr('values').split(';'), tag,
    });
  }
  return out;
}

test('Still emits no motion: no SMIL, no clip length, the CSS breath left to the idle toggle', { skip: SKIP }, async () => {
  for (const pose of POSES) {
    const html = await hydrate({ pose });
    assert.equal(tracks(html).length, 0, pose);
    assert.ok(!html.includes('data-clip-ms'), pose);
    assert.match(html, /<div class="scene"[^>]*data-idle="on"/, pose);
  }
});

test('every alive track is a well-formed loop of exactly the chosen length that ends where it starts', { skip: SKIP }, async () => {
  for (const pose of POSES) {
    for (const loop of [4, 8, 13]) {
      const html = await hydrate({ pose, motion: 'alive', loop });
      const all = tracks(html);
      assert.ok(all.length >= 4, `${pose}: ${all.length} tracks`);
      for (const tr of all) {
        assert.equal(tr.dur, `${loop}s`, `${pose} dur`);
        assert.match(tr.tag, /repeatCount="indefinite"/);
        assert.equal(tr.times.length, tr.values.length, `${pose} ${tr.type}: one value per key time`);
        assert.equal(tr.times[0], 0);
        assert.equal(tr.times.at(-1), 1);
        for (let i = 1; i < tr.times.length; i++) assert.ok(tr.times[i]! > tr.times[i - 1]!, `${pose} ${tr.type}: key times rise`);
        assert.equal(tr.values[0], tr.values.at(-1), `${pose} ${tr.type}: the loop ends where it starts`);
      }
      assert.match(html, new RegExp(`data-clip-ms="${loop * 1000}"`), `${pose}: the export bar follows one loop`);
      // Measured on the pose's own <svg>, which is what an SVG export (and so a Design
      // box) carries: the template's outer <style>, with the CSS idle breath, never ships.
      const svg = html.match(POSE_SVG)![0];
      assert.equal(svgLoopMs(svg), loop * 1000, `${pose}: the loop Design reads off the markup`);
      assert.match(html, /<div class="scene"[^>]*data-idle="off"/, 'the CSS breath steps aside for the loop');
    }
  }
});

test('frame 0 of the loop is the posed still', { skip: SKIP }, async () => {
  for (const pose of POSES) {
    const posed = { pose, eyeX: 40, eyeY: -20, headTilt: 6, blink: pose === 'dangling' ? 0 : 20 };
    const still = await hydrate(posed);
    const alive = await hydrate({ ...posed, motion: 'alive' });
    for (const tr of tracks(alive)) {
      const v0 = tr.values[0]!.split(' ').map(Number);
      if (tr.type === 'rotate') assert.equal(v0[0], 0, `${pose}: a rotation starts at rest`);
      else if (tr.type === 'scale' && tr.additive) assert.deepEqual(v0, [1, 1], `${pose}: the breath starts at rest`);
      else if (tr.type === 'scale') assert.deepEqual(v0, [1, 0], `${pose}: the blink starts open`);
      else if (tr.type === 'translate' && !tr.additive) {
        // The pupil: its first value is the translate the still bakes on the pupil group.
        const baked = /class="(?:dg-pupil)"[^>]*transform="translate\(([^)]*)\)"|id="g[cpl]-pupil" transform="translate\(([^)]*)\)"/.exec(still);
        const want = (baked?.[1] ?? baked?.[2] ?? '0 0').split(' ').map(Number);
        assert.deepEqual(v0, want, `${pose}: the eyes start where the sliders put them`);
      }
    }
    // Stripped of its motion, the alive render keeps every pose attribute the still bakes.
    const strip = (h: string): string => h
      .replace(/<animateTransform\b[^>]*>/g, '')
      .replace(/<g class="gk-[a-zA-Z]+">/g, '')
      .replace(/data-idle="[a-z]+"| data-clip-ms="\d+"/g, '');
    // (dangling's head sits under a mirror, so its +6 is baked as -6.)
    assert.match(strip(alive), /transform="rotate\(-?6 /, `${pose}: the head keeps its dialled tilt under the loop`);
  }
});

test('only <animateTransform>: nothing the shell\'s SVG sanitiser would strip', { skip: SKIP }, async () => {
  for (const pose of POSES) {
    const html = await hydrate({ pose, motion: 'alive', energy: 100 });
    const svgs = html.match(new RegExp(POSE_SVG.source, 'g')) ?? [];
    assert.equal(svgs.length, 1, `${pose}: one pose drawn`);
    assert.ok(!/<animate[\s>]|<set[\s>]|<use[\s>]|<animateMotion|<animateColor/.test(svgs[0]!), pose);
  }
});
