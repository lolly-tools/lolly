// SPDX-License-Identifier: MPL-2.0
/**
 * The automatic Performance UI decision (lib/perf-ui-auto-detect.ts), driven with
 * synthetic frames on a synthetic clock: render-bound long frames, late frames on an
 * idle main thread (the compositor signal), and requestAnimationFrame intervals. Pure,
 * so no DOM.
 *
 * Run directly:  node --test shells/web/src/lib/perf-ui-auto-detect.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDLE_MAIN_SHARE_MAX, MIN_SPAN_MS, PATH_RULES, PerfEvidence, SCRIPT_SHARE_MAX, WARMUP_MS,
  classifyLongFrame, isCompositorLate, isSoftwareRenderer, type LongFrame, type MeasurePath,
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

// ── The compositor signal (Long Animation Frames path): late frames, idle main thread ──

interface CompositorRun {
  from: number;
  to: number;
  /** Gap between frames, in ms. */
  interval: number;
  /** Main-thread time the wiring measured inside each gap. */
  mainMs: number;
  /** A long task (start, duration) delivered for the frame ending at `end`, if any. */
  task?: (end: number) => [number, number] | null;
  /** A long animation frame reported for the gap ending at `end`, if any. */
  longFrame?: (start: number, end: number) => LongFrame | null;
}

/** Frames every `interval` ms through each run, inputs every 200 ms, settling once a
 *  second; long tasks and long frames are delivered 300 ms after their frame, as a
 *  browser delivers them late. Returns when it decided (or null) and the evidence. */
function playCompositor(runs: CompositorRun[], until?: number): { decidedAt: number | null; evidence: PerfEvidence } {
  const evidence = new PerfEvidence('loaf');
  const events: Array<{ at: number; run: () => void }> = [];
  for (const r of runs) {
    for (let t = r.from; t < r.to; t += 200) events.push({ at: t, run: () => { evidence.interaction(t, true); } });
    for (let end = r.from + r.interval; end < r.to; end += r.interval) {
      const start = end - r.interval;
      events.push({ at: end, run: () => { evidence.compositorFrame(end, r.interval, r.mainMs); } });
      const task = r.task?.(end);
      if (task) events.push({ at: end + 300, run: () => { evidence.longTask(task[0], task[1]); } });
      const lf = r.longFrame?.(start, end);
      if (lf) events.push({ at: end + 300, run: () => { evidence.frameWork(lf); } });
    }
  }
  const end = until ?? Math.max(...runs.map(r => r.to)) + 5000;
  for (let t = 0; t <= end; t += 1000) events.push({ at: t + 0.5, run: () => {} });
  events.sort((a, b) => a.at - b.at);
  let decidedAt: number | null = null;
  let nextSettle = 0;
  for (const e of events) {
    while (nextSettle <= e.at) {
      if (evidence.settle(nextSettle) && decidedAt === null) decidedAt = nextSettle;
      nextSettle += 1000;
    }
    e.run();
  }
  return { decidedAt, evidence };
}

test('compositor: is a frame late on an idle main thread? 50 ms or more, a quarter or less of it busy', () => {
  assert.equal(isCompositorLate(70, 5), true);
  assert.equal(isCompositorLate(50, 12.5), true, 'exactly a quarter busy');
  assert.equal(isCompositorLate(50, 13), false, 'more than a quarter busy: the main thread may have made it late');
  assert.equal(isCompositorLate(49, 0), false, 'under 50 ms is not jank a person sees');
  assert.equal(isCompositorLate(1001, 0), false, 'over a second is a pause, not a frame');
  assert.equal(isCompositorLate(70, -1), false);
  assert.equal(isCompositorLate(Number.NaN, 0), false);
  assert.ok(IDLE_MAIN_SHARE_MAX <= SCRIPT_SHARE_MAX, 'no looser than the share of script a render-bound long frame may hold');
});

test('compositor: frames 70 ms apart on an idle main thread, through a minute of use, switch after the 30 s span', () => {
  const { decidedAt, evidence } = playCompositor([{ from: 20_000, to: 80_000, interval: 70, mainMs: 6 }]);
  assert.ok(decidedAt !== null, 'decided');
  assert.ok(decidedAt >= 20_000 + MIN_SPAN_MS, `not before 30 s of evidence (decided at ${decidedAt})`);
  assert.ok(evidence.lateCounted > 0);
});

test('compositor: long frames that are only the wait for a held-back rendering update do not rule late frames out', () => {
  // What software compositing with heavy blur produced on this Mac: a long animation frame
  // spans each gap from the first task after the last frame, with no script and a 1 ms
  // rendering phase at its very end. The main thread waited; it did not work.
  const waiting = (start: number, end: number): LongFrame => ({
    startTime: start + 4, duration: end - start - 3, renderStart: end, styleAndLayoutStart: end, scripts: [],
  });
  const { decidedAt } = playCompositor([{ from: 20_000, to: 80_000, interval: 220, mainMs: 12, longFrame: waiting }]);
  assert.ok(decidedAt !== null);
});

test('compositor: a busy main thread never counts, however late the frames', () => {
  // Measured main-thread time over a quarter of each gap (what 20x CPU throttling gives).
  const measured = playCompositor([{ from: 20_000, to: 200_000, interval: 67, mainMs: 60 }]);
  assert.equal(measured.decidedAt, null);
  assert.equal(measured.evidence.lateCounted, 0);
  // Measured parts look idle, but a long task falls in every gap.
  const tasks = playCompositor([{ from: 20_000, to: 200_000, interval: 70, mainMs: 5, task: end => [end - 60, 55] }]);
  assert.equal(tasks.decidedAt, null);
  assert.equal(tasks.evidence.lateCounted, 0);
  // Long frames report scripts filling most of each gap.
  const scripted = playCompositor([{
    from: 20_000, to: 200_000, interval: 70, mainMs: 5,
    longFrame: (start, end) => ({ startTime: start, duration: end - start, renderStart: end - 2, styleAndLayoutStart: end - 1, scripts: [{ startTime: start + 2, duration: 40 }] }),
  }]);
  assert.equal(scripted.decidedAt, null);
  assert.equal(scripted.evidence.lateCounted, 0);
});

test('compositor: a long task delivered after its frame still rules the frame out', () => {
  const evidence = new PerfEvidence('loaf');
  for (let t = 20_000; t < 23_000; t += 200) evidence.interaction(t, true);
  evidence.compositorFrame(21_070, 70, 4);
  evidence.settle(21_500); // too early to judge: long tasks may still arrive
  evidence.longTask(21_020, 52); // delivered 800 ms after the frame
  evidence.settle(25_000);
  assert.equal(evidence.lateCounted, 0);
});

test('compositor: short bursts never decide, however bad', () => {
  const burst = playCompositor([{ from: 20_000, to: 32_000, interval: 90, mainMs: 3 }], 120_000);
  assert.equal(burst.decidedAt, null, 'twelve bad seconds, then nothing');
  // Bad seconds among good ones: a burst of late frames every 10 s, two seconds long.
  const runs: CompositorRun[] = [];
  for (let from = 20_000; from < 200_000; from += 10_000) {
    runs.push({ from, to: from + 2000, interval: 90, mainMs: 3 });
    runs.push({ from: from + 2000, to: from + 10_000, interval: 17, mainMs: 3 });
  }
  const scattered = playCompositor(runs);
  assert.equal(scattered.decidedAt, null, 'two struggling seconds in ten is not seven in ten');
});

test('compositor: thresholds are the Long Animation Frames ones, never looser', () => {
  // Four 55 ms late frames a second is 220 ms, under a quarter of each second.
  const runs: CompositorRun[] = [];
  for (let s = 20_000; s < 200_000; s += 1000) runs.push({ from: s, to: s + 225, interval: 55, mainMs: 2 }, { from: s + 225, to: s + 1000, interval: 17, mainMs: 2 });
  assert.equal(playCompositor(runs).decidedAt, null);
  assert.deepEqual(PATH_RULES.loaf, { struggleMs: 250, minSeconds: 12, share: 0.7 }, 'one rule for both kinds of slow time');
});

test('compositor: late frames outside interaction, or with ineligible input, are not counted', () => {
  const evidence = new PerfEvidence('loaf');
  for (let end = 20_070; end < 120_000; end += 70) {
    evidence.compositorFrame(end, 70, 4);
    if (end % 1000 < 70) evidence.settle(end);
  }
  evidence.settle(130_000);
  assert.deepEqual(evidence.summary(), { active: 0, struggling: 0, spanMs: 0 });
});
