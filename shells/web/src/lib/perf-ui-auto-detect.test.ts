// SPDX-License-Identifier: MPL-2.0
/**
 * The automatic Performance UI decision (lib/perf-ui-auto-detect.ts), driven with
 * synthetic frames on a synthetic clock. Pure, so no DOM.
 *
 * Run directly:  node --test shells/web/src/lib/perf-ui-auto-detect.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SPAN_MS, PATH_RULES, PerfEvidence, WARMUP_MS,
  classifyLongFrame, isSoftwareRenderer, type LongFrame, type MeasurePath,
} from './perf-ui-auto-detect.ts';

/** A long frame starting at `start`: `render` ms of style, layout and paint at its end,
 *  `script` ms of reported script. */
function frame(start: number, duration: number, render: number, script = 0): LongFrame {
  return {
    startTime: start,
    duration,
    renderStart: render > 0 ? start + duration - render : 0,
    styleAndLayoutStart: render > 0 ? start + duration - render : 0,
    scripts: script > 0 ? [{ duration: script }] : [],
  };
}

interface Burst {
  from: number;
  to: number;
  /** Long frames (LoAF) or frame intervals (rAF) inside the burst, by start time. */
  frames?: (t: number) => LongFrame | null;
  /** rAF interval length for the burst, if any. */
  interval?: number;
  eligible?: boolean;
}

/**
 * Play bursts of interaction against one evidence object, settling once a second as the
 * wiring does, and return the time it decided (or null) plus the final summary.
 */
function play(path: MeasurePath, bursts: Burst[], until?: number): { decidedAt: number | null; evidence: PerfEvidence } {
  const evidence = new PerfEvidence(path);
  let decidedAt: number | null = null;
  let nextSettle = 0;
  const end = until ?? Math.max(...bursts.map(b => b.to)) + 5000;
  const settleTo = (t: number): void => {
    while (nextSettle <= t) {
      if (evidence.settle(nextSettle) && decidedAt === null) decidedAt = nextSettle;
      nextSettle += 1000;
    }
  };
  for (const b of bursts) {
    for (let t = b.from; t < b.to; t += 100) {
      settleTo(t);
      if (t % 200 === 0) evidence.interaction(t, b.eligible ?? true);
      const f = b.frames?.(t);
      if (f) evidence.longFrame(f);
      if (b.interval) {
        // Frame intervals ending inside this 100 ms step.
        const first = Math.ceil(t / b.interval) * b.interval;
        for (let e = first; e < t + 100; e += b.interval) if (e > b.from) evidence.frameInterval(e, b.interval);
      }
    }
  }
  settleTo(end);
  return { decidedAt, evidence };
}

const renderBound = (t: number): LongFrame => frame(t, 80, 70);
const scriptBound = (t: number): LongFrame => frame(t, 80, 10, 60);

// ── Classifying one long frame ─────────────────────────────────────────────────

test('a frame spent mostly in style, layout and paint is render-bound', () => {
  assert.equal(classifyLongFrame(frame(0, 100, 80)), 'render');
  assert.equal(classifyLongFrame(frame(0, 100, 50, 25)), 'render', 'exactly half render, a quarter script');
});

test('a frame spent mostly in script is script-bound and never counts', () => {
  assert.equal(classifyLongFrame(frame(0, 100, 20, 70)), 'script');
  assert.equal(classifyLongFrame(frame(0, 100, 60, 30)), 'mixed', 'over a quarter script is not render-bound');
  assert.equal(classifyLongFrame(frame(0, 100, 0)), 'mixed', 'no style and layout phase at all');
  assert.equal(classifyLongFrame({ ...frame(0, 100, 80), duration: 0 }), 'mixed');
});

// ── Signal (b): sustained render-bound slowness ────────────────────────────────

test('render-bound slowness through a minute of chrome use switches, after the 30 s span', () => {
  const { decidedAt } = play('loaf', [{ from: 20_000, to: 80_000, frames: renderBound }]);
  assert.ok(decidedAt !== null, 'decided');
  assert.ok(decidedAt >= 20_000 + MIN_SPAN_MS, `not before 30 s of evidence (decided at ${decidedAt})`);
  assert.ok(decidedAt <= 20_000 + MIN_SPAN_MS + 3000, `promptly once it has it (decided at ${decidedAt})`);
});

test('script-bound slowness of the same size never switches', () => {
  const { decidedAt, evidence } = play('loaf', [{ from: 20_000, to: 200_000, frames: scriptBound }]);
  assert.equal(decidedAt, null);
  assert.equal(evidence.summary().struggling, 0, 'not one second counted as struggling');
  assert.ok(evidence.summary().active >= 30, 'the seconds were active, just not render-bound');
});

test('struggling spread over several separate bursts still adds up', () => {
  const bursts = [20_000, 45_000, 70_000].map(from => ({ from, to: from + 6000, frames: renderBound }));
  const { decidedAt } = play('loaf', bursts);
  assert.ok(decidedAt !== null, 'three 6 s bursts over 56 s decide');
});

test('one bad burst never decides, however bad: the span rule', () => {
  const { decidedAt, evidence } = play('loaf', [
    { from: 20_000, to: 45_000, frames: renderBound },
    { from: 45_000, to: 70_000 },
  ]);
  assert.equal(decidedAt, null);
  assert.ok(evidence.summary().struggling > 0, 'the burst is in the window, it just cannot decide alone');
});

test('a fast device with the odd render-bound long frame never switches', () => {
  const { decidedAt, evidence } = play('loaf', [{ from: 16_000, to: 600_000, frames: t => (t % 5000 === 0 ? frame(t, 60, 50) : null) }]);
  assert.equal(decidedAt, null);
  assert.equal(evidence.summary().struggling, 0);
});

test('slow frames with no interaction (idle, or a hidden tab) are not counted', () => {
  const evidence = new PerfEvidence('loaf');
  for (let t = 20_000; t < 120_000; t += 100) {
    evidence.longFrame(renderBound(t));
    if (t % 1000 === 0) assert.equal(evidence.settle(t), false);
  }
  assert.deepEqual(evidence.summary(), { active: 0, struggling: 0, spanMs: 0 });
});

test('hiding the tab closes the window: frames after it are not counted', () => {
  const evidence = new PerfEvidence('loaf');
  evidence.interaction(20_000, true);
  evidence.cut(20_100);
  for (let t = 20_100; t < 21_000; t += 100) evidence.longFrame(renderBound(t));
  evidence.settle(30_000);
  assert.equal(evidence.summary().active, 0, '100 ms of interaction is not an active second');
});

test('busy work (an ineligible input) is never counted', () => {
  const { decidedAt, evidence } = play('loaf', [{ from: 20_000, to: 120_000, frames: renderBound, eligible: false }]);
  assert.equal(decidedAt, null);
  assert.equal(evidence.summary().active, 0);
});

test('work starting mid-window closes it at once', () => {
  const evidence = new PerfEvidence('loaf');
  evidence.interaction(20_000, true);
  evidence.interaction(20_200, false);
  for (let t = 20_200; t < 21_000; t += 100) evidence.longFrame(renderBound(t));
  evidence.settle(30_000);
  assert.equal(evidence.summary().active, 0);
});

test('the first seconds after load never count', () => {
  const { decidedAt, evidence } = play('loaf', [{ from: 0, to: WARMUP_MS, frames: renderBound }], 60_000);
  assert.equal(decidedAt, null);
  assert.equal(evidence.summary().active, 0);
});

test('once decided it never decides again, in either direction', () => {
  const { decidedAt, evidence } = play('loaf', [{ from: 20_000, to: 80_000, frames: renderBound }]);
  assert.ok(decidedAt !== null);
  assert.equal(evidence.done, true);
  for (let t = 80_000; t < 200_000; t += 100) {
    evidence.interaction(t, true);
    if (t % 1000 === 0) assert.equal(evidence.settle(t), false, 'no second decision');
  }
  assert.equal(evidence.done, true, 'still decided: nothing switches back');
});

// ── The rAF path (Safari, Firefox): stricter ───────────────────────────────────

test('rAF: sustained frames below 20 fps switch', () => {
  const { decidedAt } = play('raf', [{ from: 20_000, to: 90_000, interval: 70 }]);
  assert.ok(decidedAt !== null);
  assert.ok(decidedAt >= 20_000 + MIN_SPAN_MS);
});

test('rAF: 25 fps, and the 30 fps cap of a phone in Low Power Mode, never switch', () => {
  assert.equal(play('raf', [{ from: 20_000, to: 200_000, interval: 40 }]).decidedAt, null);
  assert.equal(play('raf', [{ from: 20_000, to: 200_000, interval: 33 }]).decidedAt, null);
});

test('rAF: a gap of over a second is a pause, not a frame', () => {
  const { decidedAt, evidence } = play('raf', [{ from: 20_000, to: 200_000, interval: 1500 }]);
  assert.equal(decidedAt, null);
  assert.equal(evidence.summary().struggling, 0);
});

test('rAF is stricter than LoAF: a quarter of each second lost decides LoAF only', () => {
  // Four 75 ms render-bound frames a second: 300 ms lost per second.
  const FOUR = [0, 300, 500, 800];
  const loaf = play('loaf', [{ from: 20_000, to: 120_000, frames: t => (FOUR.includes(t % 1000) ? frame(t, 75, 70) : null) }]);
  assert.ok(loaf.decidedAt !== null, 'LoAF decides on 300 ms a second');
  const evidence = new PerfEvidence('raf');
  for (let t = 20_000; t < 120_000; t += 100) {
    if (t % 200 === 0) evidence.interaction(t, true);
    if (FOUR.includes(t % 1000)) evidence.frameInterval(t + 75, 75);
    if (t % 1000 === 0) assert.equal(evidence.settle(t), false);
  }
  assert.ok(PATH_RULES.raf.struggleMs > PATH_RULES.loaf.struggleMs);
  assert.ok(PATH_RULES.raf.minSeconds > PATH_RULES.loaf.minSeconds);
  assert.ok(PATH_RULES.raf.share > PATH_RULES.loaf.share);
});

// ── Signal (a): software rendering ─────────────────────────────────────────────

test('software renderer strings and fallback adapters are recognised', () => {
  for (const renderer of [
    'SwiftShader Device (Subzero)',
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'Google SwiftShader',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'Mesa/X.org, llvmpipe (LLVM 17.0.6, 256 bits)',
    'lavapipe',
    'Microsoft Basic Render Driver',
    'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'GDI Generic',
    'Apple Software Renderer',
  ]) assert.equal(isSoftwareRenderer({ renderer }), true, renderer);
  // What Chromium's WebGPU adapter reports for SwiftShader (probed, Chromium 153).
  assert.equal(isSoftwareRenderer({ vendor: 'google', architecture: 'swiftshader', device: '', description: '', isFallbackAdapter: true }), true);
  assert.equal(isSoftwareRenderer({ vendor: 'google', architecture: 'swiftshader' }), true, 'the architecture alone');
  assert.equal(isSoftwareRenderer({ isFallbackAdapter: true }), true, 'the fallback flag alone');
});

test('hardware renderers, and no facts at all, are not', () => {
  for (const renderer of [
    'ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)',
    'NVIDIA GeForce RTX 4070/PCIe/SSE2',
    'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Mali-G78',
    'Adreno (TM) 740',
    'AMD Radeon Pro 5500M OpenGL Engine',
    'Apple GPU',
  ]) assert.equal(isSoftwareRenderer({ renderer }), false, renderer);
  // This Mac's adapter, probed with hardware acceleration on.
  assert.equal(isSoftwareRenderer({ vendor: 'apple', architecture: 'metal-3', device: '', description: '', isFallbackAdapter: false }), false);
  assert.equal(isSoftwareRenderer(null), false);
  assert.equal(isSoftwareRenderer({}), false);
  assert.equal(isSoftwareRenderer({ vendor: '', architecture: '' }), false, 'a browser that withholds the strings');
});
