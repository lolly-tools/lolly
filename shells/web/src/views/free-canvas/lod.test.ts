// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { nextLodBucket, type LodBucket } from './lod.ts';
import { createMediaGate, isMediaGated } from '../canvas-media-gate.ts';
import { holdStageView, onStageViewHold, setStageView, STAGE_LOD_ATTR, STAGE_MOTION_ATTR } from '../../lib/stage-lod.ts';

test('buckets follow the thresholds and keep a hysteresis band', () => {
  const walk = (start: LodBucket, zooms: number[]) => zooms.reduce<LodBucket>((b, z) => nextLodBucket(b, z), start);
  assert.equal(walk('near', [1, 0.6]), 'near');
  assert.equal(walk('near', [0.47]), 'near');          // inside the band under 0.5
  assert.equal(walk('near', [0.47, 0.4]), 'mid');
  assert.equal(walk('mid', [0.21]), 'mid');
  assert.equal(walk('mid', [0.19]), 'mid');            // inside the band under 0.2
  assert.equal(walk('mid', [0.17]), 'far');
  assert.equal(walk('far', [0.2]), 'far');             // inside the band over 0.2
  assert.equal(walk('far', [0.23]), 'mid');
  assert.equal(walk('far', [0.066]), 'far');
  assert.equal(walk('far', [0.05]), 'overview');
  assert.equal(walk('overview', [0.073]), 'overview');
  assert.equal(walk('overview', [0.08]), 'far');
  assert.equal(walk('overview', [1]), 'near');
  assert.equal(nextLodBucket('far', NaN), 'far');
});

class FakeEl {
  isConnected = true; autoplay = true; paused = false; readyState = 4; tagName = 'VIDEO'; plays = 0;
  pause() { this.paused = true; }
  play() { this.paused = false; this.plays++; return Promise.resolve(); }
}
function gateFixture() {
  const vid = new FakeEl();
  let cb: ((e: unknown[]) => void) | null = null;
  class IO { constructor(f: (e: unknown[]) => void) { cb = f; } observe() {} unobserve() {} disconnect() {} }
  const canvas = { querySelectorAll: () => [vid] } as unknown as Element;
  const gate = createMediaGate({ root: {} as Element, canvas, IntersectionObserver: IO as never });
  return { vid, gate, report: (isIntersecting: boolean) => cb!([{ target: vid, isIntersecting }]) };
}

test('the media gate pauses off-screen and far clips, and plays only what it paused', () => {
  const f = gateFixture();
  f.gate.scan();
  assert.equal(f.vid.paused, false);
  f.report(false);
  assert.equal(f.vid.paused, true);
  assert.ok(isMediaGated(f.vid as never));
  f.report(true);
  assert.equal(f.vid.paused, false);
  assert.equal(isMediaGated(f.vid as never), false);
  f.gate.setFrozen(true);
  assert.equal(f.vid.paused, true);
  f.gate.setHeld(true);                                // a render resumes everything
  assert.equal(f.vid.paused, false);
  f.gate.setHeld(false);
  assert.equal(f.vid.paused, true);
  f.gate.destroy();                                    // leaves nothing paused behind
  assert.equal(f.vid.paused, false);
});

test('a clip someone else paused is left alone', () => {
  const f = gateFixture();
  f.vid.paused = true;
  f.gate.scan();
  f.gate.setFrozen(true);
  f.gate.setFrozen(false);
  assert.equal(f.vid.plays, 0);
});

test('holdStageView strips both attributes and puts the latest values back', () => {
  const attrs = new Map<string, string>();
  const stage = {
    closest: () => stage,
    getAttribute: (k: string) => attrs.get(k) ?? null,
    setAttribute: (k: string, v: string) => { attrs.set(k, v); },
    removeAttribute: (k: string) => { attrs.delete(k); },
  } as unknown as Element;
  const events: boolean[] = [];
  onStageViewHold(stage, (h) => events.push(h));
  setStageView(stage, STAGE_LOD_ATTR, 'far');
  setStageView(stage, STAGE_MOTION_ATTR, '');
  const a = holdStageView(stage), b = holdStageView(stage);
  assert.equal(attrs.size, 0);
  setStageView(stage, STAGE_LOD_ATTR, 'overview');     // asked while held: only remembered
  assert.equal(attrs.size, 0);
  a(); a();
  assert.equal(attrs.size, 0);
  b();
  assert.equal(attrs.get(STAGE_LOD_ATTR), 'overview');
  assert.equal(attrs.get(STAGE_MOTION_ATTR), '');
  assert.deepEqual(events, [true, false]);
});

test('the CSS keys on stage attributes and will-change lives only under data-fc-moving', () => {
  const css = readFileSync(fileURLToPath(new URL('../../styles/parts/editor.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*will-change[^{}]*)\}/g)) {
    assert.match(m[1]!, /data-fc-moving/, `will-change outside the moving attribute: ${m[1]!.trim()}`);
  }
  assert.doesNotMatch(css, /content-visibility|data-fc-lod[^{]*\{[^}]*display\s*:\s*none/);
});
