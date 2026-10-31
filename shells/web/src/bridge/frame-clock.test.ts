// SPDX-License-Identifier: MPL-2.0
/**
 * The export frame clock carries a clip's length and pixel size to every clocked call.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/bridge/frame-clock.test.ts
 *
 * createFrameSource names the clip length and size on each frame, but the static-chrome
 * probe and the repaint after it name only a time. The clock remembers the last values it
 * was given between begin and end, so those calls render the same kind of frame.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setExportHost } from './export-shared.ts';
import type { WebHost } from './export-shared.ts';
import { beginFrameClock, declaresStillPose, endFrameClock, frameClockCanvas, holdStillExports, holdStillFrame, holdsStill, renderFrameAt } from './frame-clock.ts';
import type { FrameClockCanvas, FrameClockSize } from './frame-clock.ts';

type Call = [number, number | undefined, FrameClockSize | undefined];

/**
 * A stand-in canvas whose clock records every call; `throws` makes the hook fail, and
 * `stillPose` declares that t 0 with no clip length is the finished piece.
 */
function clockCanvas(throws = false, stillPose = false) {
  const calls: Call[] = [];
  const canvas = {
    __lollyFrameDriven: false,
    __lollyFrameRender(t: number, clipSec?: number, size?: FrameClockSize) {
      calls.push([t, clipSec, size]);
      if (throws) throw new Error('frame failed');
    },
    querySelectorAll: () => [],
  };
  if (stillPose) Object.assign(canvas.__lollyFrameRender, { stillPose: true });
  return { canvas: canvas as unknown as FrameClockCanvas, calls };
}

/** A clock that declares a still pose, as Certificate's does. */
const posedClock = () => clockCanvas(false, true);

test('a call that names only a time reuses the clip length and size given since begin', () => {
  const { canvas, calls } = clockCanvas();
  const size = { width: 320, height: 240 };
  const fc = beginFrameClock(canvas);
  assert.equal(fc, canvas);
  assert.equal(canvas.__lollyFrameDriven, true, 'begin raises the capture flag');
  renderFrameAt(fc, 0.1, 5, size);
  renderFrameAt(fc, 0.37);
  renderFrameAt(fc, 0.71);
  assert.deepEqual(calls, [
    [0.1, 5, size],
    [0.37, 5, size],
    [0.71, 5, size],
  ]);
  endFrameClock(fc);
  assert.equal(canvas.__lollyFrameDriven, false, 'end clears the capture flag');
});

test('a still names a size and no clip length, and the size alone is carried', () => {
  const { canvas, calls } = clockCanvas();
  const fc = beginFrameClock(canvas);
  renderFrameAt(fc, 0, undefined, { width: 64, height: 32 });
  renderFrameAt(fc, 0.5);
  assert.deepEqual(calls, [
    [0, undefined, { width: 64, height: 32 }],
    [0.5, undefined, { width: 64, height: 32 }],
  ]);
  endFrameClock(fc);
});

test('a later explicit value replaces the remembered one', () => {
  const { canvas, calls } = clockCanvas();
  const fc = beginFrameClock(canvas);
  renderFrameAt(fc, 0, 5, { width: 10, height: 10 });
  renderFrameAt(fc, 0.2, 8, { width: 20, height: 20 });
  renderFrameAt(fc, 0.3);
  assert.deepEqual(calls[2], [0.3, 8, { width: 20, height: 20 }]);
  endFrameClock(fc);
});

test('a new begin forgets what the previous capture named', () => {
  const { canvas, calls } = clockCanvas();
  const first = beginFrameClock(canvas);
  renderFrameAt(first, 0.1, 5, { width: 200, height: 150 });
  const second = beginFrameClock(canvas);
  renderFrameAt(second, 0.37);
  assert.deepEqual(calls[1], [0.37, undefined, undefined]);
  endFrameClock(second);
});

test('end forgets what the capture named', () => {
  const { canvas, calls } = clockCanvas();
  const fc = beginFrameClock(canvas);
  renderFrameAt(fc, 0.1, 5, { width: 200, height: 150 });
  endFrameClock(fc);
  renderFrameAt(fc, 0.4);
  assert.deepEqual(calls[1], [0.4, undefined, undefined]);
});

test('a throwing clock is logged as a warning, not thrown', () => {
  const logged: [string, string][] = [];
  setExportHost({ log: (level: string, message: string) => logged.push([level, message]) } as unknown as WebHost);
  try {
    const { canvas, calls } = clockCanvas(true);
    const fc = beginFrameClock(canvas);
    assert.doesNotThrow(() => renderFrameAt(fc, 0.25, 5, { width: 8, height: 8 }));
    assert.equal(calls.length, 1);
    assert.deepEqual(logged, [['warn', '__lollyFrameRender threw: frame failed']]);
    endFrameClock(fc);
  } finally {
    setExportHost(null as unknown as WebHost);
  }
});

test('a node without a clock gets no canvas, and the calls do nothing', () => {
  const node = { querySelectorAll: () => [] } as unknown as Element;
  assert.equal(frameClockCanvas(node), null);
  const fc = beginFrameClock(node);
  assert.equal(fc, null);
  assert.doesNotThrow(() => {
    renderFrameAt(fc, 0.5, 5, { width: 1, height: 1 });
    endFrameClock(fc);
  });
});

test('a clock canvas inside the exported node is found', () => {
  const { canvas } = clockCanvas();
  const node = { querySelectorAll: (selector: string) => (selector === 'canvas' ? [canvas] : []) } as unknown as Element;
  assert.equal(frameClockCanvas(node), canvas);
});

/** The stills that read the page rather than posing the clock at the file's pixel size. */
const PAGE_STILLS = ['svg', 'svgz', 'pdf', 'pdf-cmyk', 'penpot', 'eps', 'emf', 'wmf', 'dxf', 'docx', 'odt', 'pptx', 'html', 'md', 'txt'];

// A still export walked the live page with no clock call at all for every format but the
// rasters, so a tool playing an entrance (Certificate's reveal) exported whatever moment
// the walk met. A clock that declares its still pose now gets it for these formats too.
test('a still hold asks a declared clock for its still pose and keeps the flag up until it is released', () => {
  for (const format of PAGE_STILLS) {
    const { canvas, calls } = posedClock();
    assert.equal(declaresStillPose(canvas), true);
    const release = holdStillFrame(canvas, format);
    assert.deepEqual(calls, [[0, undefined, undefined]], `${format}: one call, t 0, no clip length`);
    assert.equal(canvas.__lollyFrameDriven, true, `${format}: the tool's own loop is frozen for the render`);
    release();
    assert.equal(canvas.__lollyFrameDriven, false, `${format}: the release hands the loop back`);
  }
});

// Round 1 held every clock. Growth's t 0 is the bare seed, so an SVG or PDF of a piece that
// had finished growing came out as a seed (about 103 KB of SVG on main, a few dots with the
// hold). A clock that does not declare a still pose is left exactly as it was on main.
test('a clock with no still pose is never called or frozen by a still that reads the page', async () => {
  for (const format of PAGE_STILLS) {
    const { canvas, calls } = clockCanvas();
    assert.equal(declaresStillPose(canvas), false);
    const release = holdStillFrame(canvas, format);
    assert.deepEqual(calls, [], `${format}: no clock call`);
    assert.equal(canvas.__lollyFrameDriven, false, `${format}: the flag is untouched`);
    release();
    const seen: Array<boolean | undefined> = [];
    const held = holdStillExports(stubRuntime(() => { seen.push(canvas.__lollyFrameDriven); return new Blob([]); }), {});
    await held.export(canvas, format);
    assert.deepEqual([calls, seen], [[], [false]], `${format}: through a runtime too, the page is read as it stands`);
  }
  // A property other than a literal true is not a declaration.
  const loose = clockCanvas();
  Object.assign(loose.canvas.__lollyFrameRender!, { stillPose: 'yes' });
  holdStillFrame(loose.canvas, 'svg')();
  assert.deepEqual(loose.calls, []);
});

test('a clip, sound, a data file, a container, the structural writers and the self-posing rasters are never held', () => {
  // The rasters pose the clock themselves at the file's pixel size; a hold first would make
  // the 3D studio draw every PNG twice (tests/export-still-frame-clock.test.ts pins one call).
  // A data file is built from the inputs, so posing the tool for it would only move the preview.
  for (const format of ['mp4', 'webm', 'gif', 'apng', 'webp-anim', 'svg-anim', 'wav', 'opus', 'zip', 'rpm', 'tar.gz', 'lottie', 'idml', 'premiere-xml',
    'json', 'csv', 'ics', 'vcf', 'srt', 'vtt', 'css', 'scss', 'gpl',
    'png', 'jpg', 'jpeg', 'webp', 'avif', 'jxl', 'tiff', 'bmp', 'cmyk-tiff', 'ico']) {
    const { canvas, calls } = posedClock();
    assert.equal(holdsStill(format), false, format);
    const release = holdStillFrame(canvas, format);
    assert.deepEqual(calls, [], `${format}: no clock call`);
    assert.equal(canvas.__lollyFrameDriven, false, `${format}: the flag is untouched`);
    release();
  }
});

test('a raster capture inside a still hold does not lower the flag before the hold ends', () => {
  const { canvas, calls } = posedClock();
  const release = holdStillFrame(canvas, 'pdf');
  const inner = beginFrameClock(canvas);
  renderFrameAt(inner, 0, undefined, { width: 40, height: 30 });
  endFrameClock(inner);
  assert.equal(canvas.__lollyFrameDriven, true, 'the PDF is still being written');
  assert.deepEqual(calls[1], [0, undefined, { width: 40, height: 30 }]);
  release();
  assert.equal(canvas.__lollyFrameDriven, false);
});

test('a second hold on a held canvas only adds a count, and a node with no clock is never held', () => {
  const { canvas, calls } = posedClock();
  const outer = holdStillFrame(canvas, 'svg');
  const nested = holdStillFrame(canvas, 'svg');
  nested();
  assert.equal(canvas.__lollyFrameDriven, true, 'only the last release lowers the flag');
  assert.equal(calls.length, 1);
  outer();
  assert.equal(canvas.__lollyFrameDriven, false);
  const bare = { querySelectorAll: () => [] } as unknown as Element;
  assert.doesNotThrow(() => holdStillFrame(bare, 'pdf')());
});

// Two exports of one canvas can overlap (a copy while a download is written). With one flag
// per canvas, the first to finish lowered it under the other, and a second release from the
// same hold would have lowered it under a third.
test('overlapping holds keep the flag up until the last one ends, and a release counts once', () => {
  const { canvas, calls } = posedClock();
  const first = holdStillFrame(canvas, 'pdf');
  const second = holdStillFrame(canvas, 'svg');
  first();
  first();
  assert.equal(canvas.__lollyFrameDriven, true, 'the SVG is still being written');
  second();
  assert.equal(canvas.__lollyFrameDriven, false);
  assert.equal(calls.length, 1, 'the still pose is asked for once');
});

/**
 * A runtime stand-in with the engine's order: the tool's beforeExport, then the shell's
 * export entry, which takes its own hold (export.ts renderFormat) and reads the page.
 */
function engineOrder(canvas: FrameClockCanvas, calls: Call[], beforeExport: () => void) {
  const seen: Array<{ driven: boolean | undefined; calls: number }> = [];
  const runtime = {
    async export(node: unknown, format: string) {
      beforeExport();
      const release = holdStillFrame(node as Element, format);
      try { seen.push({ driven: canvas.__lollyFrameDriven, calls: calls.length }); return new Blob([]); }
      finally { release(); }
    },
  };
  return { runtime, seen };
}

// Chart poses its complete poster in beforeExport, and builds a SMIL flipbook there for an
// animated SVG. Round 1's hold called the clock after the hook and drew the entrance's first
// frame over both. Chart declares no still pose, so its hook runs with the preview as it
// stood and nothing is called or frozen, as on main.
test('a tool with a beforeExport hook and no still pose keeps its own pose and its own loop', async () => {
  for (const format of ['svg', 'svgz', 'pdf', 'pdf-cmyk', 'penpot', 'emf', 'pptx']) {
    const { canvas, calls } = clockCanvas();
    let posed = 0;
    const { runtime, seen } = engineOrder(canvas, calls, () => { posed++; });
    const held = holdStillExports(runtime, {});
    await held.export(canvas, format);
    assert.equal(posed, 1, `${format}: the hook ran`);
    assert.deepEqual(calls, [], `${format}: nothing redraws what the hook posed`);
    assert.deepEqual(seen, [{ driven: false, calls: 0 }], `${format}: the page is read as it stands`);
  }
});

test('a declared clock is posed before the engine starts, once, ahead of a beforeExport hook', async () => {
  const { canvas, calls } = posedClock();
  let atHook: { driven: boolean | undefined; calls: number } | null = null;
  const { runtime, seen } = engineOrder(canvas, calls, () => { atHook = { driven: canvas.__lollyFrameDriven, calls: calls.length }; });
  const held = holdStillExports(runtime, {});
  await held.export(canvas, 'pdf');
  assert.deepEqual(atHook, { driven: true, calls: 1 }, 'posed and frozen before anything else in the export runs');
  assert.deepEqual(seen, [{ driven: true, calls: 1 }], 'the entry hold adds a count, not a second call');
  assert.deepEqual(calls, [[0, undefined, undefined]]);
  assert.equal(canvas.__lollyFrameDriven, false);
});

/** A runtime whose export does nothing but `body` (by default, hand back an empty file). */
function stubRuntime(body: () => Blob = () => new Blob([])) {
  return { async export(_node: unknown, _format: string) { return body(); } };
}

test('a wrapped runtime releases its hold when the export fails, and leaves clips and rasters to their renderers', async () => {
  const { canvas, calls } = posedClock();
  const failing = holdStillExports(stubRuntime(() => { throw new Error('render failed'); }), {});
  await assert.rejects(failing.export(canvas, 'svg'), /render failed/);
  assert.equal(canvas.__lollyFrameDriven, false, 'a failed export does not leave the loop frozen');
  calls.length = 0;
  const passing = holdStillExports(stubRuntime(), {});
  for (const format of ['png', 'mp4', 'gif', 'zip', 'json']) await passing.export(canvas, format);
  assert.deepEqual(calls, []);
});

test('Markdown from a template.md is built from the inputs, so only Markdown read off the page is posed', async () => {
  const { canvas, calls } = posedClock();
  const templated = holdStillExports(stubRuntime(), { textTemplates: { md: '# {{title}}' } });
  await templated.export(canvas, 'md');
  assert.deepEqual(calls, []);
  const walked = holdStillExports(stubRuntime(), { textTemplates: {} });
  await walked.export(canvas, 'md');
  assert.deepEqual(calls, [[0, undefined, undefined]]);
});
