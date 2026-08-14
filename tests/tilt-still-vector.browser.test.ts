// SPDX-License-Identifier: MPL-2.0
/**
 * plans/104 §12 Q2 — THE TILTED STILL, in a real browser.
 *
 * The one export a tilted scene has besides mp4 is the posed still, and §1 names it as
 * the thing Depthfield structurally cannot do: *"the posed still stays vector"*. §12 Q2
 * says how, and spike S2 cleared it unreserved: **keep every untilted layer vector and
 * embed a per-box captured raster for the tilted boxes only**, with an amber notice.
 * House style degrades visibly; nothing refuses.
 *
 * ⚑ WHY THIS FILE EXISTS. Before it, a tilted still went out as a WRONG PICTURE with no
 * notice, and no test looked at one — `tilt-capture.browser.test.ts` covers the motion
 * path only. SVG has no perspective transform, so `parseCssMatrix` refuses a `matrix3d`
 * carrying a perspective row, both walkers fell through to the AABB path,
 * `neutraliseTransform` wrote `transform: none`, and the subtree came out AXIS-ALIGNED,
 * stretched to fill the projected bounding box. Measured (two cards at z 0/200 under
 * `rx −45`, still at t = 500 ms): 495 B of SVG, zero `matrix3d`, zero `<image>`, two
 * upright `<rect>`s — precisely the failure S2 §4 measured for the raster escape hatch
 * ("trapezoid → rectangle"), reproduced in the vector still.
 *
 * So the assertions here are about the SHAPE OF THE PICTURE, not about the presence of a
 * feature: the tilted box's embed must be a real trapezoid whose taper matches the
 * engine's own projection, and an untilted box must still be geometry.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openHarness, browserGate, usingChannel, type Harness } from './helpers/sequence-browser.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { parseKf, resolveCamera, projectSurfacePoint } from '../engine/src/keyframes.ts';

const gate = browserGate();

const W = 640;
const H = 360;
const MS = 1000;
/** The instant every still is taken at — mid-clip, so nothing is at a transition edge. */
const AT = 500;
/** A hard pitch: big enough that a trapezoid is unmistakable, short of edge-on. */
const TILT_KF = 't0_rx-45';
const FLAT_KF = 't0_x0';

/** One card, flat, and one lifted — so the two disagree about how far the tilt moves them. */
const CARD = { x: 200, y: 60, w: 240, h: 80, bg: 'rgb(230,60,90)', start: 0, dur: MS, z: 0 };
const LIFTED = { x: 200, y: 220, w: 240, h: 80, bg: 'rgb(60,190,230)', start: 0, dur: MS, z: 200 };

interface BoxLike { [k: string]: unknown }
interface StageLike { w: number; h: number; seqMs: number; bg: string; boxes: BoxLike[] }

const scene = (cameraKf: string): StageLike => ({
  w: W, h: H, seqMs: MS, bg: 'rgb(8,10,16)',
  boxes: [
    { ...CARD }, { ...LIFTED },
    { x: 0, y: 0, w: 8, h: 8, camera: true, kf: cameraKf },
  ],
});

/**
 * The taper the ENGINE says a pitched camera gives a screen-parallel card: the ratio of
 * its near (bottom) edge to its far (top) edge, from `projectSurfacePoint` alone.
 *
 * This is the number the raster has to reproduce, and it is why the test cannot be
 * satisfied by any axis-aligned emission: a rectangle's ratio is exactly 1.
 */
function analyticTaper(kf: string, box: { x: number; y: number; w: number; h: number; z: number }): number {
  const pose = { ...resolveCamera([{ start: 0, end: null, base: null, track: parseKf(kf) }], AT), w: W, h: H };
  const at = (px: number, py: number): { x: number; y: number } => {
    const p = projectSurfacePoint(pose, px, py, box.z);
    assert.ok(p, 'the fixture must be in front of the camera');
    return { x: p.x, y: p.y };
  };
  const top = at(box.x, box.y).x - at(box.x + box.w, box.y).x;
  const bot = at(box.x, box.y + box.h).x - at(box.x + box.w, box.y + box.h).x;
  return Math.abs(bot) / Math.abs(top);
}

const measured: string[] = [];

describe('plans/104 §12 Q2 — a tilted still keeps the untilted layers vector', { skip: gate ?? false, concurrency: 1 }, () => {
  let Hn: Harness;
  const page = (): Harness['page'] => Hn.page;

  before(async () => {
    Hn = await openHarness();
    console.log(`[browser] ${usingChannel() ? 'channel' : 'bundled Chromium'} :: ${Hn.probe.ua}`);
  });
  after(async () => {
    await Hn?.close();
    await closeBrowser();
    for (const line of measured) console.log(line);
  });

  // ── 1: the tilted boxes become per-box images; nothing is emitted upright ───

  test('each tilted box goes out as ONE <image> at its posed bounding box, not as a rect', async () => {
    const out = await page().evaluate(async ({ spec, t }) => {
      const S = (window as never as { SEQ: { vectorStillAt: (s: unknown, t: number, f: string) => Promise<{ text: string; size: number; posed: Array<{ transform: string }> }> } }).SEQ;
      return await S.vectorStillAt(spec, t, 'svg');
    }, { spec: scene(TILT_KF), t: AT });

    // The applier really did pose both cards with a perspective matrix — otherwise this
    // test would be asserting the walker's behaviour on a scene that was never tilted.
    const posed = out.posed.filter((p) => /matrix3d/.test(p.transform));
    assert.equal(posed.length, 2, `both cards must carry a matrix3d, got ${JSON.stringify(out.posed)}`);

    const images = out.text.match(/<image\b[^>]*>/g) ?? [];
    assert.equal(images.length, 2, `one embed per tilted box, got ${images.length}`);

    // …and NOT as geometry. The card colours are the discriminator: an upright <rect>
    // filled with one of them is exactly the wrong picture this test exists to refuse.
    for (const bg of [CARD.bg, LIFTED.bg]) {
      const rects = (out.text.match(/<rect\b[^>]*>/g) ?? []).filter((r) => r.includes(bg));
      assert.equal(rects.length, 0, `a tilted card came out as an axis-aligned rect: ${rects[0]}`);
    }
    // The stage background is untilted and MUST still be geometry — the floor.
    assert.match(out.text, /<rect[^>]*fill="rgb\(8, ?10, ?16\)"/, 'the untilted background stayed vector');
    measured.push(`tilted still: ${out.size} B, ${images.length} embeds, background vector`);
  });

  // ── 2: the embed is a TRAPEZOID, and its taper is the engine's ──────────────

  test('the embedded raster is the tilted picture — its taper matches the projection', async () => {
    const r = await page().evaluate(async ({ spec, t }) => {
      const S = (window as never as { SEQ: { vectorStillAt: (s: unknown, t: number, f: string) => Promise<{ text: string }> } }).SEQ;
      const { text } = await S.vectorStillAt(spec, t, 'svg');
      const hrefs = [...text.matchAll(/<image\b[^>]*href="([^"]+)"/g)].map((m) => m[1]!);
      // Measure each embed the way S2's edge probe did: the painted row width near the
      // top and near the bottom of the ink. A perspective card tapers; a stretched
      // rectangle does not.
      const shape = async (url: string): Promise<{ top: number; bottom: number; rows: number; drift: number }> => {
        const bmp = await new Promise<HTMLImageElement>((res, rej) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => rej(new Error('embed did not decode'));
          im.src = url;
        });
        const c = document.createElement('canvas');
        c.width = bmp.naturalWidth; c.height = bmp.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(bmp, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data;
        const widthAt = (y: number): number => {
          let lo = -1, hi = -1;
          for (let x = 0; x < c.width; x++) {
            const a = px[(y * c.width + x) * 4 + 3]!;
            if (a > 24) { if (lo < 0) lo = x; hi = x; }
          }
          return hi < 0 ? 0 : hi - lo + 1;
        };
        const centreAt = (y: number): number => {
          let lo = -1, hi = -1;
          for (let x = 0; x < c.width; x++) {
            const a = px[(y * c.width + x) * 4 + 3]!;
            if (a > 200) { if (lo < 0) lo = x; hi = x; }
          }
          return hi < 0 ? -1 : (lo + hi) / 2;
        };
        // The ink band, so the probes land inside the card and clear of its corners.
        let first = -1, last = -1;
        for (let y = 0; y < c.height; y++) if (widthAt(y) > 0) { if (first < 0) first = y; last = y; }
        const band = last - first;
        // Every row's horizontal centre, sampled — see the drift assertion below.
        const mids: number[] = [];
        for (let i = 1; i < 12; i++) {
          const m = centreAt(first + Math.round((band * i) / 12));
          if (m >= 0) mids.push(m);
        }
        return {
          top: widthAt(first + Math.round(band * 0.15)),
          bottom: widthAt(first + Math.round(band * 0.85)),
          rows: band + 1,
          drift: mids.length ? Math.max(...mids) - Math.min(...mids) : -1,
        };
      };
      return { n: hrefs.length, shapes: await Promise.all(hrefs.map(shape)) };
    }, { spec: scene(TILT_KF), t: AT });

    assert.equal(r.n, 2, 'two embeds to measure');
    const wanted = [
      analyticTaper(TILT_KF, { x: CARD.x, y: CARD.y, w: CARD.w, h: CARD.h, z: CARD.z }),
      analyticTaper(TILT_KF, { x: LIFTED.x, y: LIFTED.y, w: LIFTED.w, h: LIFTED.h, z: LIFTED.z }),
    ];
    const lines: string[] = [];
    r.shapes.forEach((s, i) => {
      assert.ok(s.rows > 8 && s.top > 8 && s.bottom > 8,
        `embed ${i} is not a picture: ${JSON.stringify(s)}`);
      const got = s.bottom / s.top;
      lines.push(`embed ${i}: rows ${s.rows}, top ${s.top}px, bottom ${s.bottom}px, `
        + `taper ${got.toFixed(4)} (engine ${wanted[i]!.toFixed(4)}), centre drift ${s.drift.toFixed(2)}px`);
      // NO SHEAR. Under a pure `rx` pitch the card stays left-right symmetric, so every
      // row's horizontal centre sits at the same x. This pins the ORDER of the capture's
      // composed transform, which is the one subtle thing about it: the fit translate
      // must sit LEFT of the pose in the list, where `(s·x + tx·w)/w = s·(x/w) + tx`
      // makes it land after the perspective divide. Put it on the right and each row
      // shears by `tx·(1/w − 1)` — a fraction of a pixel here, several at a steep angle,
      // and invisible to a taper measurement because a per-row shift does not change a
      // per-row width.
      assert.ok(s.drift >= 0 && s.drift < 0.75,
        `embed ${i} shears across rows by ${s.drift}px — the fit transform is inside the divide`);
      // The fixture has to taper at all, or the rest of this proves nothing.
      assert.ok(wanted[i]! - 1 > 0.02, `the fixture is not tilted enough: engine taper ${wanted[i]}`);
      // A rectangle stretched to the AABB reads exactly 1.0000. THAT is what this
      // refuses; the engine's own number is what it accepts, inside 4 % relative — the
      // slack the ink threshold costs, which S2 measured as a 3–5 px inset per edge.
      assert.ok(Math.abs(got - wanted[i]!) < 0.04 * wanted[i]!,
        `embed ${i} taper ${got.toFixed(4)} is not the engine's ${wanted[i]!.toFixed(4)} — ` +
        'an untilted stretch would read 1.0000');
      // …and stated the other way round, so the bound above cannot be satisfied by a
      // rectangle if someone widens it: most of the predicted taper is really present.
      assert.ok(got - 1 > 0.5 * (wanted[i]! - 1),
        `embed ${i} taper ${got.toFixed(4)} is closer to a rectangle than to the projection`);
    });
    measured.push(...lines);
  });

  // ── 3: the untilted floor — no camera angle, no raster, byte for byte ───────

  test('an untilted still is unchanged: zero embeds, the cards are rects', async () => {
    const out = await page().evaluate(async ({ spec, t }) => {
      const S = (window as never as { SEQ: { vectorStillAt: (s: unknown, t: number, f: string) => Promise<{ text: string; size: number }> } }).SEQ;
      return await S.vectorStillAt(spec, t, 'svg');
    }, { spec: scene(FLAT_KF), t: AT });

    assert.equal((out.text.match(/<image\b/g) ?? []).length, 0,
      'an untilted scene must never take the posed-raster hatch');
    for (const bg of [CARD.bg, LIFTED.bg]) {
      assert.ok((out.text.match(/<rect\b[^>]*>/g) ?? []).some((s) => s.includes(bg)),
        `the untilted card ${bg} must still be a rect`);
    }
    measured.push(`untilted still: ${out.size} B, 0 embeds`);
  });

  // ── 4: PDF takes the same hatch (it inherits the same refusal) ──────────────

  test('PDF embeds the tilted boxes as images too', async () => {
    const r = await page().evaluate(async ({ tilt, flat, t }) => {
      const S = (window as never as { SEQ: {
        vectorStillAt: (s: unknown, t: number, f: string) => Promise<{ size: number; key: string }>;
        blobBytes: (k: string) => Promise<string>;
      } }).SEQ;
      const a = await S.vectorStillAt(tilt, t, 'pdf');
      const b = await S.vectorStillAt(flat, t, 'pdf');
      return { tiltSize: a.size, flatSize: b.size, head: (await S.blobBytes(a.key)).slice(0, 24) };
    }, { tilt: scene(TILT_KF), flat: scene(FLAT_KF), t: AT });

    assert.match(atob(r.head).slice(0, 5), /^%PDF-/, 'it is a PDF');
    // Two embedded PNGs against two vector rects: the file has to be substantially
    // larger. This is a coarse instrument on purpose — the fine one is the SVG taper
    // above, and the point here is only that PDF took the same branch rather than
    // silently keeping the AABB path.
    assert.ok(r.tiltSize > r.flatSize * 1.5,
      `a tilted PDF (${r.tiltSize}B) should carry rasters the untilted one (${r.flatSize}B) does not`);
    measured.push(`pdf: tilted ${r.tiltSize} B vs untilted ${r.flatSize} B`);
  });

  // ── 5: S2's own discriminator, kept as a test (S2 §9.1) ────────────────────

  test('the capture is NOT the shipped escape hatch: pointing that at a tilted node loses the tilt', async () => {
    // S2 §4 measured `rasterizeNodeToDataUrl` destroying a pose (mean 35/255, IoU 0.88)
    // because it overwrites the clone root's transform and resizes the root to the
    // PROJECTED AABB. `rasterizePosedNodeToDataUrl` exists for that reason, and this
    // pins the difference so a later simplification cannot quietly merge the two.
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: { posedVsHatch: () => Promise<{
        posed: string | null; hatch: string | null;
        posedRect: { x: number; y: number; w: number; h: number } | null;
        aabb: { x: number; y: number; w: number; h: number };
      }> } }).SEQ;
      return await S.posedVsHatch();
    });

    assert.ok(r.posed, 'the posed capture must produce something');
    assert.ok(r.hatch, 'the control capture must produce something');
    assert.notEqual(r.posed, r.hatch,
      'the posed capture and the AABB escape hatch must not be the same bytes — if they are, '
      + 'the wrapper-shaped capture S2 §4 requires has been lost');
    // S2 §3a: the placement rect is `getBoundingClientRect()` straight off the DOM, so no
    // second implementation of the projection can drift from §4's module. With no effect
    // to spill, the two are the same rectangle.
    assert.ok(r.posedRect, 'the posed capture reports where to place it');
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      assert.ok(Math.abs(r.posedRect![k] - r.aabb[k]) < 0.01,
        `placement ${k}: ${r.posedRect![k]} vs the DOM's ${r.aabb[k]}`);
    }
  });
});
