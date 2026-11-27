// SPDX-License-Identifier: MPL-2.0
/**
 * Frame source: the direct-canvas capture short-circuit (node.__lollyFrameCanvas).
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/bridge/frame-source-canvas.test.ts"
 *
 * The animated/video export path (gif/apng/webp-anim/webm/mp4) captures each frame
 * through createFrameSource(node).frame(t). A raster tool that already holds the finished
 * frame on a <canvas> can register node.__lollyFrameCanvas(t, durationMs) to hand it back
 * directly - skipping the dom-to-image serialise+decode that is both slow and the source
 * of an intermittent decode hang. These pin the two guarantees that matter:
 *   1. present and returning a canvas → frame() returns it (normalised) and dom-to-image
 *      is NEVER called;
 *   2. it THROWS → frame() falls through to dom-to-image (hang-safety), never wedges.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFrameSource, __setDomToImageForTest } from './export.ts';

type FakeCanvas = { width: number; height: number; __tag?: string };

// A dom-to-image double whose toCanvas is a spy; returns a target-sized fake canvas.
function fakeDomToImage() {
  const calls: Array<{ node: unknown; opts: unknown }> = [];
  const lib = {
    toCanvas: (node: unknown, opts: unknown) => {
      calls.push({ node, opts });
      return { width: 200, height: 150, __tag: 'dom-to-image' } as FakeCanvas;
    },
  };
  return { lib, calls };
}

// A minimal export node: no live canvases, no blob urls, no animations.
function fakeNode(extra: Record<string, unknown> = {}): Element {
  return {
    getBoundingClientRect: () => ({ width: 200, height: 150, x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 150 }),
    querySelectorAll: () => [] as unknown[],
    querySelector: () => null,
    ...extra,
  } as unknown as Element;
}

// createFrameSource builds a MutationObserver when one is a global; a plain-object node
// isn't a real Node, so neutralise it (and provide window) for the duration of the run.
async function withNeutralGlobals(run: () => Promise<void>) {
  const g = globalThis as Record<string, unknown>;
  const savedMO = g.MutationObserver, savedWin = g.window;
  g.MutationObserver = undefined;
  g.window = {};
  try { await run(); } finally { g.MutationObserver = savedMO; g.window = savedWin; }
}

test('frame(): a node.__lollyFrameCanvas returning a canvas is used directly; dom-to-image is never called', async () => {
  await withNeutralGlobals(async () => {
    const { lib, calls } = fakeDomToImage();
    __setDomToImageForTest(lib);
    const my = { width: 200, height: 150, __tag: 'effect-canvas' } as FakeCanvas;
    let seenT = -1, seenDur = -1;
    const node = fakeNode({
      __lollyFrameCanvas: (t: number, durationMs: number) => { seenT = t; seenDur = durationMs; return my; },
    });
    const src = await createFrameSource(node, { width: 200, height: 150, wait: 0, duration: 4 });
    try {
      const out = await src.frame(0.5);
      assert.equal(out, my as unknown, 'frame returned the effect canvas itself (dims already match target → normalise is a pass-through)');
      assert.equal(calls.length, 0, 'dom-to-image toCanvas was NOT called');
      assert.equal(seenT, 0.5, 'the frame time t was passed through');
      assert.equal(seenDur, 4000, 'the clip duration (ms) was passed through');
    } finally { src.dispose(); __setDomToImageForTest(null); }
  });
});

test('frame(): a THROWING __lollyFrameCanvas falls through to dom-to-image (hang-safety)', async () => {
  await withNeutralGlobals(async () => {
    const { lib, calls } = fakeDomToImage();
    __setDomToImageForTest(lib);
    const node = fakeNode({ __lollyFrameCanvas: () => { throw new Error('boom'); } });
    const src = await createFrameSource(node, { width: 200, height: 150, wait: 0 });
    try {
      const out = await src.frame(0) as unknown as FakeCanvas;
      assert.equal(calls.length, 1, 'dom-to-image toCanvas was called exactly once (fell through)');
      assert.equal(out.__tag, 'dom-to-image', 'frame returned the dom-to-image result, not the throwing hook');
    } finally { src.dispose(); __setDomToImageForTest(null); }
  });
});

test('frame(): a nullish __lollyFrameCanvas return also falls through to dom-to-image', async () => {
  await withNeutralGlobals(async () => {
    const { lib, calls } = fakeDomToImage();
    __setDomToImageForTest(lib);
    const node = fakeNode({ __lollyFrameCanvas: () => null });
    const src = await createFrameSource(node, { width: 200, height: 150, wait: 0 });
    try {
      const out = await src.frame(0) as unknown as FakeCanvas;
      assert.equal(calls.length, 1, 'a null hand-back is treated like an error: full rasterise');
      assert.equal(out.__tag, 'dom-to-image');
    } finally { src.dispose(); __setDomToImageForTest(null); }
  });
});

test('frame(): with no __lollyFrameCanvas, capture uses dom-to-image (baseline unchanged)', async () => {
  await withNeutralGlobals(async () => {
    const { lib, calls } = fakeDomToImage();
    __setDomToImageForTest(lib);
    const src = await createFrameSource(fakeNode(), { width: 200, height: 150, wait: 0 });
    try {
      await src.frame(0);
      assert.equal(calls.length, 1, 'the ordinary path still rasterises through dom-to-image');
    } finally { src.dispose(); __setDomToImageForTest(null); }
  });
});

// A video container has no alpha: frameBg is the opaque backdrop that keeps a
// transparentBg tool's mp4/webm off black. The alpha paths (gif/apng/webp-anim,
// favicons) pass no frameBg and must stay transparent.
test('frame(): frameBg is forwarded to dom-to-image as bgcolor (video is never transparent)', async () => {
  await withNeutralGlobals(async () => {
    const { lib, calls } = fakeDomToImage();
    __setDomToImageForTest(lib);
    const src = await createFrameSource(fakeNode(), { width: 200, height: 150, wait: 0, frameBg: '#0c322c' });
    try {
      await src.frame(0);
      assert.equal(calls.length, 1);
      assert.equal((calls[0]!.opts as { bgcolor?: string }).bgcolor, '#0c322c', 'the opaque backdrop reached dom-to-image');
    } finally { src.dispose(); __setDomToImageForTest(null); }
  });
});

test('frame(): with no frameBg, no bgcolor is set (alpha formats keep transparency)', async () => {
  await withNeutralGlobals(async () => {
    const { lib, calls } = fakeDomToImage();
    __setDomToImageForTest(lib);
    const src = await createFrameSource(fakeNode(), { width: 200, height: 150, wait: 0 });
    try {
      await src.frame(0);
      assert.equal(calls.length, 1);
      assert.equal('bgcolor' in (calls[0]!.opts as object), false, 'no backdrop forced on the alpha path');
    } finally { src.dispose(); __setDomToImageForTest(null); }
  });
});

// A clocked tool gets the clip length and target size on every call, including the two
// static-chrome probe phases and the repaint after them, which name only a time.
test('frame(): every clock call of a clip carries its length and size, in the real order', async () => {
  // The probe asks whether the node is itself a canvas; Node has no HTMLCanvasElement.
  const g = globalThis as Record<string, unknown>;
  const savedCanvas = g.HTMLCanvasElement;
  g.HTMLCanvasElement ??= class {};
  try {
  await withNeutralGlobals(async () => {
    const { lib } = fakeDomToImage();
    __setDomToImageForTest(lib);
    const calls: Array<[number, number | undefined, { width: number; height: number } | undefined]> = [];
    const node = fakeNode({
      __lollyFrameRender: (t: number, clipSec?: number, size?: { width: number; height: number }) => {
        calls.push([t, clipSec, size]);
      },
    });
    const src = await createFrameSource(node, { width: 200, height: 150, wait: 0, duration: 5 });
    try {
      await src.frame(0.1, 5);
      await src.frame(0.2, 5);
      assert.deepEqual(calls.map(([t]) => t), [0.1, 0.2, 0.37, 0.71, 0.2], 'frame 0, frame 1, the probe phases, then the repaint');
      for (const [t, clipSec, size] of calls) {
        assert.equal(clipSec, 5, `the call at ${t} names the clip length`);
        assert.deepEqual(size, { width: 200, height: 150 }, `the call at ${t} names the target size`);
      }
    } finally { src.dispose(); __setDomToImageForTest(null); }
  });
  } finally { g.HTMLCanvasElement = savedCanvas; }
});

// A video is encoded after its last frame is taken, and Chrome's encoder gives no output
// while the page repaints an expensive animation. So a caller with an encode still to run
// keeps the animations the capture paused, and gets the way to resume them.
test('dispose can hold the animations the capture paused, and hands back the resume', async () => {
  await withNeutralGlobals(async () => {
    const { lib } = fakeDomToImage();
    __setDomToImageForTest(lib);
    const animation = (playState: string) => {
      const a = { playState, currentTime: 0, plays: 0, pause() { a.playState = 'paused'; }, play() { a.plays++; a.playState = 'running'; } };
      return a;
    };
    try {
      const running = animation('running');
      const alreadyPaused = animation('paused');
      const node = fakeNode({ getAnimations: () => [running, alreadyPaused] });
      const src = await createFrameSource(node, { width: 200, height: 150, wait: 0, duration: 4 });
      await src.frame(0.5, 4);
      assert.equal(running.playState, 'paused', 'the capture pauses a running animation to pose the frame');
      assert.equal(running.currentTime, 2000);
      const resume = src.dispose({ holdAnimations: true });
      assert.equal(running.plays, 0, 'held: nothing runs while the encode is still to come');
      resume();
      assert.equal(running.plays, 1, 'resumed when the caller says the file is made');
      assert.equal(alreadyPaused.plays, 0, 'an animation the page had paused is left paused');
      resume();
      assert.equal(running.plays, 1, 'resuming twice plays nothing twice');

      const again = animation('running');
      const plain = await createFrameSource(fakeNode({ getAnimations: () => [again] }), { width: 200, height: 150, wait: 0, duration: 4 });
      await plain.frame(0.25, 4);
      plain.dispose();
      assert.equal(again.plays, 1, 'a plain dispose resumes at once, as it always did');
    } finally { __setDomToImageForTest(null); }
  });
});
