// SPDX-License-Identifier: MPL-2.0
/**
 * plans/104 P3 — THE LIFT-LAYERS EXIT DEMO, run as a test.
 *
 * §9's P3 exit criterion, enacted end to end in a real browser: "url-shot → Lift layers
 * → preset → mp4 in under a minute of user effort." Every step below is the shipping
 * one — the walker that takes the screenshot, the engine enumerator that finds the
 * layers, the writer that turns them into boxes, the export funnel that renders them —
 * and every number is measured from the exported FILE, never from an intermediate the
 * pipeline also produced.
 *
 * WHY IT IS A TEST AND NOT A SCRIPT, and how to run it: exactly as
 * `depth-flythrough.browser.test.ts` (P1's demo), whose shape this follows. It rides the
 * gated browser tier — skipped with the install command when there is no browser, and
 * the H.264 cases skipped when the launched build cannot encode one — so it stays green
 * on a bare machine and bites on a real one. `LOLLY_P3_DEMO_OUT=<dir>` also WRITES the
 * artefacts (the mp4s, the source and derived SVGs, the still, the contact sheet), which
 * is what makes it a demo as well as a gate.
 *
 * ── THE FOUR STEPS, and what is real in each ────────────────────────────────────
 *
 * 1. SCREENSHOT. `SEQ.walkToSvg` reproduces `main.ts`'s `__lollyWalkerShot` hook call
 *    for call — `export.render(node, 'svg', …)` with the same option bag, `layerIds`
 *    included. That hook IS url-shot's vector capture path: `scripts/build-docs-shots.ts`
 *    drives it for every `walker=1&format=svg` recipe. The hook itself cannot be reached
 *    from here (the web shell installs it at boot and the built shell is untracked build
 *    output), so its body is reproduced rather than driven — the walker, the export
 *    funnel and the passthrough flag are the shipping ones either way.
 *
 * 2. LIFT. `enumerateSvgLayers` (engine, DOM-free) reads the walked bytes on the NODE
 *    side, which is the honest place for it: it is the same function the dialog calls,
 *    and running it out-of-page proves it needs no DOM. `liftRows` (the shell's writer)
 *    then produces the rows, including the z stagger, the `KF_Z_FIELD_CLAMP` and the
 *    `shadow: depth` pre-set. Each derived document is DOMPurify-sanitised in the page
 *    before it reaches a box, because that is where the real lift sanitises it
 *    (`runLift` → `storeUserUpload` → `sanitizeSvgFile`).
 *
 * 3. PRESET. The scene camera is §5.4's implicit untimed one, carrying the SHIPPED
 *    "Push in" track from `KF_CAMERA_PRESETS` verbatim (`t0_z0*t4000_eo_z-220`; the
 *    dolly sign is the engine's, see that constant's comment).
 *
 * 4. EXPORT. Through `api.render` — the public funnel every real export takes — twice
 *    for webm (the byte-identity pair) and once for mp4, plus a mid-move still and a
 *    `cuts=4` contact sheet.
 *    P1's demo is the reason this is not `renderSequence`: the funnel detaches
 *    `[data-export-hide]` nodes, which used to include the camera marker and produced a
 *    completely motionless flythrough that a direct-render test could not see.
 *
 * ── THE FIXTURE, and why it is shaped this way ──────────────────────────────────
 *
 * A 960×540 page that reads like a Lolly gallery screenshot: a header bar with a title,
 * and a 2×2 grid of tool cards, each a flat colour with a caption, each carrying the
 * `data-box-id` a design board stamps on its boxes. The passthrough therefore has
 * real work to do, and the four cards come back out of the enumerator NAMED — which is
 * also how this file finds them again to measure them, rather than by an index that
 * would silently follow a re-ordering.
 *
 * The four card centres are offset (±124, ±70) from the stage centre — all 142.4 px in
 * magnitude. That equality is the measurement. A lifted layer is a FULL-STAGE box —
 * every derived document keeps the source's root coordinates, which is what makes the
 * lift geometry-free — so every lifted box has the same centre, and a pure dolly moves
 * every box's centre by the same amount. What differs is the ink INSIDE: a point p in a
 * layer at depth z lands at `W/2 + (p − W/2)·eff(z)`, so its displacement is
 * `|p − centre| · Δeff(z)`. Hold the lever equal across the four cards and depth is the
 * only thing left that can order them — the same trick P1's demo used, applied to ink
 * instead of boxes.
 *
 * The cards are also SMALL and TIGHT to the centre, which is not taste. A colour
 * centroid is only the ink's position while all of that ink is on screen and unoccluded,
 * and a push-in magnifies every layer about the stage centre: the first draft used
 * 300×180 cards at (±180, ±110) and by the last frame the deepest was half off-stage,
 * so the "parallax" it measured was the clipping — it came back 12.8 px where the engine
 * says 106.9, DECREASING with depth. 180×100 cards at (±124, ±70) survive the deepest
 * layer's maximum eff (1.94 at t = 4 s) wholly on-stage and pairwise disjoint, which is
 * what makes the centroid mean what the assertion says it means.
 *
 * Note what the demo does NOT hide: the captions and the header lift into their own
 * layers, at their own depths, so they drift relative to the cards they belong to. That
 * is what lifting a screenshot along its real element boundaries does, and it is the
 * effect the feature exists to produce.
 *
 * ── WHAT THE GATE RENDERS AT, AND WHY (measured, not guessed) ───────────────────
 *
 * A lifted layer is a FULL-STAGE box, so its `shadow: depth` drop-shadow is a
 * full-frame gaussian — and while a camera is moving `ownsLayerFx` gives that filter to
 * the COMPOSITOR, which means N full-frame blurs on every frame. That was the dominant
 * cost of this whole feature, and it is worth stating in numbers rather than adjectives.
 *
 * P3.1 FIXED IT (plans/104 §9, measured failure 1) by noticing that the effect does not
 * change: §5.3's depth shadow is derived from the box's `z` alone, so for a layer at a
 * fixed depth it is ONE filter over ONE unchanging plate, and the camera move lives
 * entirely in the destination transform. So the filtered picture is now rendered once
 * and re-composited per frame — `fxPlateKey` in `bridge/sequence-render.worker.ts` — and
 * the composite is the identical `drawImage` the uncached path issues, which is why the
 * gate below can assert the two decode to the same pixels rather than to a tolerance.
 *
 * Measured on this fixture (macOS 27, bundled Chromium 151, in-thread, mp4 via the
 * public funnel), BEFORE = the same build with the cache turned off:
 *
 *      layers  shadows  out width  fps    before        after      speed-up
 *        11      yes      960      30    854 ms/frame   47 ms/frame   18×
 *        11      yes      960      24    980            45           22×
 *        11      yes      960      15    998            62           16×
 *        11      NO       960      30     51            48            —   ← the floor
 *        11      yes      720      15    611            48           13×
 *        11      yes      480      15    281            36            8×
 *         6      yes      960      30    327            19           17×
 *
 * The mp4s are byte-for-byte the same size in every row. Shadows-on at full width now
 * costs what shadows-OFF costs (47 against 48 ms/frame), i.e. the depth shadow has
 * stopped being a per-frame cost at all — and the plan's own bar was "within ~4× of the
 * shadows-off baseline". The earlier table's top row read ABORTED, because on a slower
 * machine the encoder's stall watchdog fires before the frame does.
 *
 * READ THE RATIO, NOT THE ABSOLUTE. A repeat of the same table on the same machine came
 * back 57 / 70 / 93 / 60(off) / 76 / 53 / 30 — everything up by about half, including
 * the shadows-off control, which is what a loaded or thermally-limited laptop looks
 * like. The number that does NOT move between runs is the one the fix is about: with
 * the cache on, shadows-on and shadows-off are the same cost to within the noise.
 *
 * So the gate renders the stability pair at {@link GATE_FPS}/{@link GATE_WIDTH} — enough
 * frames and enough pixels to decide byte identity, funnel transparency and a monotone
 * parallax ladder, and cheap enough to belong in a suite. Under `LOLLY_P3_DEMO_OUT` it
 * ALSO renders one full-quality pass for the artefact. Nothing about the projection or
 * the parallax depends on either number: the measurement is taken in STAGE px (output
 * px ÷ the export scale), which is why the same assertions hold at any width.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openHarness, browserGate, usingChannel, type Harness } from './helpers/sequence-browser.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { enumerateSvgLayers, type SvgLayer } from '../engine/src/svg-layers.ts';
import { parseKf, resolveCamera, projectLayer, KF_Z_FIELD_CLAMP } from '../engine/src/keyframes.ts';
import { parseCssMatrix } from '../engine/src/css-box.ts';
import { liftRows, applyLift, liftDepths, liftSlots, LIFT_EFF_CEIL, type Box } from '../shells/web/src/views/free-canvas-math.ts';

const gate = browserGate();

/** Where to write the artefacts, or null to only assert. */
const OUT = process.env.LOLLY_P3_DEMO_OUT || null;

/** Everything the demo measured, printed at the end of the run. */
const measured: string[] = [];
const say = (line: string): void => { measured.push(line); };

// ── the page that gets screenshotted ─────────────────────────────────────────

const W = 960;
const H = 540;
const MS = 4000;

/**
 * What the GATE renders the stability pair at — see the cost table in the header.
 * 15 fps over 4 s is 60 frames; 480 px out is an export scale of exactly 0.5, so the
 * stage-px conversion is a halving rather than a ratio with rounding in it.
 */
const GATE_FPS = 15;
const GATE_WIDTH = 480;
/** frameTimestamps(4000, 15) = 60 frames at n·1000/15, so the last is 3933.33 ms. */
const LAST = 59;
const tOf = (n: number): number => (n * 1000) / GATE_FPS;

/** What DEMO mode additionally renders, for an artefact worth watching. */
const DEMO_FPS = 24;
const DEMO_WIDTH = W;

/** The shipped preset track, copied verbatim from `KF_CAMERA_PRESETS`. */
const PUSH_IN = 't0_z0*t4000_eo_z-220';

const CARD_W = 180;
const CARD_H = 100;
const CARDS = [
  { id: 'b1', cx: 356, cy: 200, rgb: [200, 60, 60] as [number, number, number], label: 'QR Code' },
  { id: 'b2', cx: 604, cy: 200, rgb: [60, 180, 90] as [number, number, number], label: 'Street Map' },
  { id: 'b3', cx: 356, cy: 340, rgb: [230, 190, 40] as [number, number, number], label: 'Mesh Gradient' },
  { id: 'b4', cx: 604, cy: 340, rgb: [110, 90, 220] as [number, number, number], label: 'Design' },
] as const;

/** Every card centre is this far from the stage centre — the lever the parallax uses. */
const LEVER = Math.hypot(CARDS[0].cx - W / 2, CARDS[0].cy - H / 2);

const PAGE = `<div id="shot" style="position:relative;width:${W}px;height:${H}px;background:#0b1220;
    font-family:system-ui,-apple-system,sans-serif;overflow:hidden">
  <div style="position:absolute;left:0;top:0;width:${W}px;height:56px;background:#16213c"></div>
  <div style="position:absolute;left:24px;top:16px;color:#dbe4f7;font:600 22px system-ui">Gallery</div>
  ${CARDS.map((c) => `<div data-box-id="${c.id}" style="position:absolute;left:${c.cx - CARD_W / 2}px;top:${c.cy - CARD_H / 2}px;
        width:${CARD_W}px;height:${CARD_H}px;background:rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]});border-radius:14px"></div>
    <div style="position:absolute;left:${c.cx - CARD_W / 2 + 12}px;top:${c.cy + CARD_H / 2 - 26}px;
        color:#ffffff;font:600 15px system-ui">${c.label}</div>`).join('')}
</div>`;

const TARGETS = CARDS.map((c) => c.rgb);

// ── the model the lift writes into (the canvas's field names) ────────────────
//
// The ids are design's own sub-field names, so `liftRows` is exercised with the
// configuration it ships against rather than a synthetic one.
const CFG = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rotation',
  imageField: 'image', groupField: 'group', zField: 'z', shadowField: 'shadow',
  textField: 'text', fillField: 'fill', gradField: 'grad',
};

/** The single box the user right-clicks: the screenshot, dropped on the stage at 1:1. */
const SOURCE: Box = {
  id: 'src', x: 0, y: 0, w: W, h: H, rotation: 0,
  image: 'shot.svg', start: 0, dur: MS,
};

interface BoxLike {
  x?: number; y?: number; w?: number; h?: number; bg?: string; svg?: string;
  start?: number; dur?: number;
  z?: number; kf?: string; camera?: boolean; depthShadow?: boolean;
}
interface StageLike { w: number; h: number; seqMs: number; bg: string; boxes: BoxLike[] }

// ── what the ENGINE says should happen (predicted before anything is measured) ──

/** The camera pose at sequence time `t`, resolved by the engine itself. */
function poseAt(kf: string, t: number): ReturnType<typeof resolveCamera> {
  return resolveCamera([{ start: 0, end: null, base: null, track: parseKf(kf) }], t);
}

/**
 * Where a point of INK inside a full-stage lifted layer lands, stage-native px.
 *
 * `projectLayer` answers for the box: its centre moves by `dx/dy` and it scales by
 * `eff`. A lifted layer's box is the whole stage, so the ink is what moves — mapped
 * through the same uniform scale about the box centre that both executors apply
 * (`drawItem`'s translate → rotate → scale, and the DOM applier's composed transform).
 */
function inkAt(kf: string, t: number, z: number, px: number, py: number): { x: number; y: number } {
  const proj = projectLayer({ ...poseAt(kf, t), w: W, h: H }, { bx: W / 2, by: H / 2, z });
  return {
    x: W / 2 + proj.dx + (px - W / 2) * proj.scale,
    y: H / 2 + proj.dy + (py - H / 2) * proj.scale,
  };
}

/** Predicted |displacement| of one card's ink between two frames. */
function predictedInkParallax(kf: string, tA: number, tB: number, z: number, card: { cx: number; cy: number }): number {
  const a = inkAt(kf, tA, z, card.cx, card.cy);
  const b = inkAt(kf, tB, z, card.cx, card.cy);
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// ── the run ──────────────────────────────────────────────────────────────────

describe('plans/104 P3 — the Lift-layers exit demo', { skip: gate ?? false, concurrency: 1 }, () => {
  let Hn: Harness;
  const page = (): Harness['page'] => Hn.page;
  let mp4 = false;

  /** Step 1 + 2, run once in `before` and shared: the funnel up to the finished stage. */
  let shotSvg = '';
  let layers: SvgLayer[] = [];
  let warnings: string[] = [];
  let rows: Box[] = [];
  /** The lifted rows' depths, in paint order. */
  let zs: number[] = [];
  /** Where each named card ended up: boxId → its row's z. */
  const cardZ = new Map<string, number>();
  let spec: StageLike;
  /** Wall clock of the whole funnel, screenshot → stage ready. */
  let liftMs = 0;

  before(async () => {
    Hn = await openHarness();
    const p = Hn.probe;
    mp4 = p.avcEncode;
    console.log(`[browser] ${usingChannel() ? `channel=${process.env.LOLLY_BROWSER_CHANNEL ?? process.env.LOLLY_BROWSER_PATH}` : 'bundled Chromium'} :: ${p.ua}`);
    console.log(`[codecs] avcEncode=${p.avcEncode} vp8=${p.vp8} vp9=${p.vp9}`);
    if (OUT) { mkdirSync(OUT, { recursive: true }); console.log(`[demo] writing artefacts to ${OUT}`); }
    assert.ok(p.webcodecs, 'the launched browser has no WebCodecs at all');

    const t0 = Date.now();
    // 1 — the screenshot.
    const walk = await page().evaluate(async (html) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      return await S.walkToSvg(html);
    }, PAGE);
    shotSvg = walk.svg;
    say(`[demo] 1. screenshot: the walker turned a ${walk.rect.w}×${walk.rect.h} page carrying ${walk.ids.length} data-box-id into ${walk.bytes} B of SVG in ${Math.round(walk.ms)} ms`);

    // 2 — the lift: enumerate (engine, out of page) then write the rows (shell writer).
    const enumerated = enumerateSvgLayers(shotSvg);
    layers = enumerated.layers;
    warnings = enumerated.warnings;
    rows = liftRows(
      SOURCE,
      layers.map((l, i) => ({
        src: `layer-${i + 1}.svg`, id: `L${i + 1}`, crop: l.viewBox ?? null, bbox: l.bbox,
      })),
      CFG,
      { zClamp: KF_Z_FIELD_CLAMP, group: 'g1', viewBox: enumerated.viewBox, fit: 'fill' },
    );
    zs = rows.map((r) => Number(r.z));
    for (const l of layers) if (l.boxId) cardZ.set(l.boxId, zs[l.index] as number);

    // 3 — the stage: the lifted rows, plus §5.4's implicit untimed scene camera.
    spec = {
      w: W, h: H, seqMs: MS, bg: 'transparent',
      boxes: [
        ...rows.map((r, i) => ({
          x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h),
          svg: layers[i]!.markup,
          start: 0, dur: MS,
          z: Number(r.z),
          depthShadow: r.shadow === 'depth',
        })),
        { x: 0, y: 0, w: 8, h: 8, camera: true, kf: PUSH_IN },
      ],
    };
    liftMs = Date.now() - t0;

    if (OUT) {
      writeFileSync(join(OUT, 'source-screenshot.svg'), shotSvg);
      for (const l of layers) writeFileSync(join(OUT, `lifted-layer-${String(l.index + 1).padStart(2, '0')}.svg`), l.markup);
    }
  });

  after(async () => {
    await Hn?.close();
    await closeBrowser();
    for (const line of measured) console.log(line);
  });

  /** Pull a stored blob out of the page and write it, when an out dir was given. */
  async function save(key: string, name: string): Promise<string | null> {
    if (!OUT) return null;
    const b64 = await page().evaluate((k) => (window as never as { SEQ: SeqApi }).SEQ.blobBytes(k), key);
    const path = join(OUT, name);
    writeFileSync(path, Buffer.from(b64, 'base64'));
    return path;
  }

  // ── 1. the lift itself: the page comes apart along the canvas's own boxes ────

  test('the walked screenshot enumerates into named layers, and the writer stacks them at depth', () => {
    assert.ok(shotSvg.startsWith('<?xml') || shotSvg.includes('<svg'), 'the walker produced no SVG');
    assert.ok(layers.length >= 2, `a lift needs at least two layers, got ${layers.length}`);

    // The identity passthrough closed the loop: every card the PAGE stamped comes back
    // named, and nothing else does. This is what makes a screenshot "semantically
    // explodable" (§7) rather than explodable along whatever the markup happened to group.
    const named = layers.filter((l) => l.boxId).map((l) => l.boxId);
    assert.deepEqual([...named].sort(), CARDS.map((c) => c.id).sort(),
      `the lifted layers should name exactly the page's four boxes, got ${JSON.stringify(named)}`);

    // Labels are indices, never names out of the file (the PII posture, §7).
    for (const l of layers) assert.equal(l.label, `Layer ${l.index + 1}`, `unexpected label ${l.label}`);

    // The writer's own contract (1.121, plans/104 P3.2): one row per layer, depths
    // climbing a fixed magnification BAND rather than a fixed 40 px step, `shadow:
    // depth` pre-set, one shared group — and each row SIZED TO ITS INK wherever the
    // engine could crop its document safely, which is what stops a 16 px icon's
    // depth shadow costing a full-frame gaussian.
    assert.equal(rows.length, layers.length, 'one row per layer');
    assert.deepEqual(zs, liftDepths(liftSlots(layers.map((l) => l.bbox ?? l.viewBox ?? null)), KF_Z_FIELD_CLAMP),
      'the depths are the ladder, not a per-test formula');
    assert.equal(new Set(zs).size, zs.length, 'every depth distinct');
    assert.ok(Math.max(...zs) <= 1200 * (1 - 1 / LIFT_EFF_CEIL) + 0.01,
      `the stack must fit the band, got ${Math.max(...zs)}`);
    assert.ok(zs.every((z) => z > KF_Z_FIELD_CLAMP[0] && z < KF_Z_FIELD_CLAMP[1]),
      'and no row is pinned at the field clamp');
    let cropped = 0;
    for (let i = 0; i < rows.length; i++) {
      assert.equal(rows[i]!.shadow, 'depth', `row ${i} carries no depth shadow`);
      assert.equal(rows[i]!.group, 'g1', `row ${i} left the group`);
      // Cropped or not, a row is inside the box the artwork was in — a derived layer
      // keeps the ROOT coordinate system, and its crop is a window on it.
      const x = Number(rows[i]!.x), y = Number(rows[i]!.y);
      const w = Number(rows[i]!.w), h = Number(rows[i]!.h);
      assert.ok(x >= 0 && y >= 0 && x + w <= W + 0.01 && y + h <= H + 0.01,
        `row ${i} landed outside the source box: ${x},${y} ${w}×${h}`);
      if (layers[i]!.viewBox) {
        cropped++;
        assert.ok(w < W || h < H, `row ${i} carries a crop but still fills the stage`);
      } else {
        assert.equal(w, W, `row ${i} is uncropped, so it is the whole stage`);
        assert.equal(h, H);
      }
    }
    assert.ok(cropped >= 4, `expected the cards to crop to their own ink, got ${cropped} cropped rows`);
    // …and the stack replaces the source in place, keeping its position in the array
    // (array order IS z-order on this canvas).
    const board: Box[] = [{ id: 'below' }, SOURCE, { id: 'above' }];
    const after = applyLift(board, 1, rows);
    assert.equal(after.length, board.length - 1 + rows.length);
    assert.equal(after[0]!.id, 'below');
    assert.equal(after[after.length - 1]!.id, 'above');

    const names = layers.map((l) => `${l.label}${l.boxId ? ` (${l.boxId})` : ''}@z${zs[l.index]}`
      + `[${l.bbox ? `${l.bbox.w.toFixed(0)}x${l.bbox.h.toFixed(0)}@${l.bbox.x.toFixed(0)},${l.bbox.y.toFixed(0)}` : 'unmeasured'}]`);
    say(`[demo] 2. lift: ${layers.length} layers — ${names.join(', ')}`);
    say(`[demo]    warnings: ${warnings.length ? warnings.join(' | ') : '(none)'}`);
    say(`[demo]    screenshot → stage ready in ${liftMs} ms of machine time (the user's part is: right-click → Lift layers → confirm)`);
  });

  // ── 2. the flythrough: stable twice over, with a depth-ordered parallax ─────

  test('push-in over the lifted stack: two runs are byte-identical, and parallax is ordered by depth', async () => {
    const r = await page().evaluate(async ({ spec, fps, width, targets, last }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      // THE STABILITY PAIR IS WEBM, AND IT IS COMPARED BYTE FOR BYTE — see the block
      // below for why it is not an mp4 pair. Both through the PUBLIC FUNNEL, which is
      // the lesson P1's demo paid for.
      const wa = await S.exportViaApi(spec, 'webm', { fps, width });
      const wb = await S.exportViaApi(spec, 'webm', { fps, width });
      // The compositor called directly, as the control: the funnel must add nothing and
      // take nothing away — and on this container it can be held to the same byte.
      const direct = await S.exportSeq(spec, 'webm', { fps, width });
      // The OTHER container, once: mp4 and webm share the whole render and differ only
      // in the encoder and the muxer, so one H.264 pass shows the lifted stack survives
      // a second container — and it is the file the parallax below is measured from, so
      // the measurement is taken off a real mp4 rather than off the container the
      // stability claim was made in.
      const a = await S.exportViaApi(spec, 'mp4', { fps, width });
      return {
        a: { err: a.error, size: a.size, key: a.key, ms: a.ms, logs: a.logs },
        webm: {
          a: { err: wa.error, size: wa.size, ms: wa.ms, sha: wa.key ? await S.blobSha(wa.key) : null },
          b: { err: wb.error, size: wb.size, sha: wb.key ? await S.blobSha(wb.key) : null },
        },
        direct: {
          err: direct.error, size: direct.size,
          sha: direct.key ? await S.blobSha(direct.key) : null,
        },
        track: a.key ? await S.trackColors(a.key, [0, last], fps, targets) : null,
      };
    }, {
      spec, fps: GATE_FPS, width: GATE_WIDTH,
      targets: TARGETS as unknown as [number, number, number][], last: LAST,
    });

    // STABILITY. §9's criterion as AMENDED by P1's demo: BYTE identity for webm, which
    // is the render's own claim and the one that catches a nondeterministic compositor,
    // plate ladder or projection.
    //
    // AN MP4 PAIR CANNOT CARRY THIS CLAIM, and the earlier draft of this test asked it
    // to. Two mp4 exports of an unchanged render are NOT the same bytes — measured on
    // this fixture, they differ in 7 bytes at offsets 51/55, 167/171, 267/271 and 1020,
    // i.e. the mvhd/tkhd/mdhd creation+modification stamps and one SPS/SEI byte: the
    // wall clock, exactly as this file's header says. So the strongest thing an mp4 pair
    // can assert is that the two DECODE to the same pixels — which quietly puts an
    // H.264 encoder and an H.264 decoder inside a determinism chain that is about the
    // COMPOSITOR, and leaves the assertion resting on the hope that the encoder's
    // non-metadata bits never move. Under a loaded machine they can (rate control is
    // free to reach a different answer), and it fails as "the two flythroughs decoded to
    // different pixels" — a message that indicts the lift, the plate ladder and the
    // projection for something none of them did.
    //
    // webm's VP8/VP9 lane is libvpx, in-process and deterministic, and its muxer stamps
    // no clock: two runs of an unchanged render are the same bytes, funnel and direct
    // alike. That is STRICTLY STRONGER than the pixel comparison it replaces — a
    // compositor, plate ladder or projection that moved changes the bytes too — and it
    // is decoder-free, so nothing outside the render can make it lie.
    assert.equal(r.webm.a.err, null, `first flythrough failed: ${JSON.stringify(r.webm.a.err)}`);
    assert.equal(r.webm.b.err, null, `second flythrough failed: ${JSON.stringify(r.webm.b.err)}`);
    assert.equal(r.webm.a.sha, r.webm.b.sha,
      `the two flythroughs are not byte-identical:\n  A ${r.webm.a.size} B sha ${r.webm.a.sha}\n  B ${r.webm.b.size} B sha ${r.webm.b.sha}`);
    assert.equal(r.direct.err, null, `the direct control export failed: ${JSON.stringify(r.direct.err)}`);
    assert.equal(r.direct.sha, r.webm.a.sha,
      `the public export funnel and a direct renderSequence disagree — something in api.render is changing the stage:\n  funnel ${r.webm.a.size} B sha ${r.webm.a.sha}\n  direct ${r.direct.size} B sha ${r.direct.sha}`);

    if (!mp4 && r.a.err) {
      say(`[demo] 3. flythrough @${GATE_WIDTH}px/${GATE_FPS}fps: webm ${r.webm.a.size} B in ${Math.round(r.webm.a.ms)} ms/run, byte-identical across two runs AND to a direct renderSequence`);
      say(`[skip] mp4: this build cannot encode H.264 (${r.a.err.code}) — rerun with LOLLY_BROWSER_CHANNEL=chrome`);
      return;
    }
    assert.equal(r.a.err, null, `the mp4 flythrough failed: ${JSON.stringify(r.a.err)}`);
    say(`[demo] 3. flythrough @${GATE_WIDTH}px/${GATE_FPS}fps: webm ${r.webm.a.size} B in ${Math.round(r.webm.a.ms)} ms/run, byte-identical across two runs AND to a direct renderSequence; mp4 ${r.a.size} B in ${Math.round(r.a.ms)} ms`);

    // PARALLAX — measured from the decoded frames, in stage px, per NAMED card.
    const t = r.track!;
    const k = t.w / W;
    const first = t.frames[0]!;
    const lastF = t.frames[1]!;
    const moved = CARDS.map((_, i) => {
      const A = first[i]!;
      const B = lastF[i]!;
      return Math.hypot(B.cx - A.cx, B.cy - A.cy) / k;
    });
    const depth = CARDS.map((c) => cardZ.get(c.id) as number);
    const predicted = CARDS.map((c, i) => predictedInkParallax(PUSH_IN, tOf(0), tOf(LAST), depth[i]!, c));

    for (let i = 0; i < CARDS.length; i++) {
      assert.ok(first[i]!.n > 500 && lastF[i]!.n > 500,
        `card "${CARDS[i]!.label}" is not on screen in both frames (px: ${first[i]!.n} then ${lastF[i]!.n})`);
      say(`[demo]    parallax ${CARDS[i]!.id} z=${String(depth[i]).padStart(3)} "${CARDS[i]!.label}": measured ${moved[i]!.toFixed(1)} px, engine predicts ${predicted[i]!.toFixed(1)} px (Δ ${(moved[i]! - predicted[i]!).toFixed(2)})`);
    }

    // The depths are what the WRITER chose, and they must rise with paint order or the
    // ladder below would be testing the fixture rather than the lift.
    for (let i = 1; i < depth.length; i++) {
      assert.ok(depth[i]! > depth[i - 1]!, `lifted depths are not staggered: ${depth.join(', ')}`);
    }
    // ⚑ 1.121 changed what this fixture MEANS, and the assertion follows it.
    // The four cards are a 2×2 grid of identical boxes — geometric peers — so
    // `liftSlots` now puts them on ONE rung, a whisper apart (plans/104 P3.2:
    // "grids stay grids"). Before, they were 40 px apart and drifted 3.6–4.7 px
    // relative to each other over the push-in; a grid does not do that. So the
    // headline here is that they move TOGETHER…
    const spread = Math.max(...moved) - Math.min(...moved);
    assert.ok(spread < 2,
      `the card grid must move as one surface, spread ${spread.toFixed(2)} px: ${moved.map((m) => m.toFixed(1)).join(', ')}`);
    // …while the STACK still has depth: the same camera moves the bottom layer and
    // the top of the ladder measurably differently, which is the parallax the whole
    // feature exists for. (Engine arithmetic, not pixels — the two extremes are the
    // page background and the topmost label, neither of which is colour-tracked.)
    const ends = [Math.min(...zs), Math.max(...zs)]
      .map((z) => predictedInkParallax(PUSH_IN, tOf(0), tOf(LAST), z, { cx: CARDS[0]!.cx, cy: CARDS[0]!.cy }));
    assert.ok(ends[1]! - ends[0]! > 3,
      `the ladder must separate its ends: ${ends[0]!.toFixed(1)} px at z=${Math.min(...zs)} vs ${ends[1]!.toFixed(1)} px at z=${Math.max(...zs)}`);
    say(`[demo]    the grid moves as one (spread ${spread.toFixed(2)} px) while the ladder's ends separate by ${(ends[1]! - ends[0]!).toFixed(1)} px`);
    // Every measurement inside 2 px of the engine's own arithmetic — the same bound P1's
    // demo used, and for the same reason: the tolerance is for the centroid of a
    // chroma-subsampled edge, not for the projection (a real fold error is tens of px).
    for (let i = 0; i < moved.length; i++) {
      assert.ok(Math.abs(moved[i]! - predicted[i]!) < 2,
        `card "${CARDS[i]!.label}": exported displacement ${moved[i]!.toFixed(2)} px disagrees with the engine's ${predicted[i]!.toFixed(2)} px`);
    }
    say(`[demo]    lever ${LEVER.toFixed(1)} px on every card, so the ratio IS the depth ratio: ${(moved[3]! / moved[0]!).toFixed(3)} measured, ${(predicted[3]! / predicted[0]!).toFixed(3)} predicted`);

    const path = await save(r.a.key!, `lift-push-in-${GATE_WIDTH}w-${GATE_FPS}fps.mp4`);
    if (path) say(`[demo] wrote ${path}`);

    // DEMO MODE ONLY: the artefact a human watches, at full stage width. Asserted
    // lightly (it renders, it is an mp4, it is not empty) because the picture it makes
    // is the same picture the gate above already measured — what this adds is the
    // wall-clock of a full-quality pass, which is the number the P4 preset work will
    // have to care about.
    if (OUT) {
      const big = await page().evaluate(async ({ spec, fps, width }) => {
        const S = (window as never as { SEQ: SeqApi }).SEQ;
        const x = await S.exportViaApi(spec, 'mp4', { fps, width });
        return { err: x.error, size: x.size, key: x.key, ms: x.ms, logs: x.logs };
      }, { spec, fps: DEMO_FPS, width: DEMO_WIDTH });
      if (big.err) {
        say(`[demo]    full-quality pass (${DEMO_WIDTH}px/${DEMO_FPS}fps) FAILED: ${big.err.code} ${big.err.message}`);
      } else {
        assert.ok(big.size > 0, 'the full-quality pass produced an empty file');
        const p2 = await save(big.key!, `lift-push-in-${DEMO_WIDTH}w-${DEMO_FPS}fps.mp4`);
        say(`[demo]    full-quality pass: ${big.size} B in ${Math.round(big.ms)} ms (${Math.round(big.ms / (DEMO_FPS * (MS / 1000)))} ms/frame over ${DEMO_FPS * (MS / 1000)} frames)${p2 ? ` → ${p2}` : ''}`);
      }
    }
  });

  // ── 2b. the cached shadow plate is a CACHE, not a cheaper lane ──────────────

  test('cached and uncached shadows decode to the SAME pixels, and the cache is what makes this affordable', async () => {
    const r = await page().evaluate(async ({ spec, fps, width, last }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      // The compositor directly, both ways, in ONE run on ONE engine — the only way to
      // say "identical pixels" about a cache rather than to hope it across builds.
      // `fxCacheBytes: 0` is `_setFxCacheBytes(0)`: the allowance is nothing, so every
      // layer re-renders its filter on every frame, which is the path that shipped
      // before P3.1 and the path the numbers below are measured against.
      const off = await S.exportSeq(spec, 'mp4', { fps, width, fxCacheBytes: 0 });
      const on = await S.exportSeq(spec, 'mp4', { fps, width });
      const idx = [0, Math.round(last / 3), Math.round((2 * last) / 3), last];
      return {
        on: { err: on.error, size: on.size, ms: on.ms, pix: on.key ? await S.frameHashes(on.key, idx, fps) : [] },
        off: { err: off.error, size: off.size, ms: off.ms, pix: off.key ? await S.frameHashes(off.key, idx, fps) : [] },
      };
    }, { spec, fps: GATE_FPS, width: GATE_WIDTH, last: LAST });

    if (!mp4 && r.on.err) {
      say('[skip] mp4: this build cannot encode H.264 — rerun with LOLLY_BROWSER_CHANNEL=chrome');
      return;
    }
    assert.equal(r.off.err, null, `the uncached control failed: ${JSON.stringify(r.off.err)}`);
    assert.equal(r.on.err, null, `the cached render failed: ${JSON.stringify(r.on.err)}`);
    // THE CLAIM. Not "within a tolerance" — the cached frame is composited by the same
    // `ctx.drawImage`, of the same canvas, at the same four numbers.
    assert.deepEqual(r.on.pix, r.off.pix,
      `the cached shadow plate changed the picture:\n  cached   ${r.on.pix.join('\n           ')}\n  uncached ${r.off.pix.join('\n           ')}`);
    assert.equal(r.on.size, r.off.size, 'and the encoder agreed, byte for byte of container');

    const frames = LAST + 1;
    const per = (ms: number): number => Math.round(ms / frames);
    say(`[demo] 3b. depth shadows @${GATE_WIDTH}px/${GATE_FPS}fps over ${rows.length} lifted layers `
      + `(${rows.filter((r, i) => layers[i]!.viewBox).length} of them cut to their own ink): `
      + `${per(r.off.ms)} ms/frame uncached → ${per(r.on.ms)} ms/frame cached `
      + `(${(r.off.ms / Math.max(1, r.on.ms)).toFixed(1)}×), identical decoded pixels and identical ${r.on.size} B`);
  });

  // ── 3. the posed still stays VECTOR, and so does the lifted artwork ─────────

  test('the still at the playhead, mid-move, is real SVG: the lifted artwork survives as geometry', async () => {
    const r = await page().evaluate(async ({ spec, t }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      return await S.vectorStillAt(spec, t, 'svg');
    }, { spec, t: 2000 });

    assert.equal(r.type, 'image/svg+xml', `the still is not SVG: ${r.type}`);
    assert.ok(r.text.includes('<svg'), 'no <svg> root in the still');
    // The load-bearing claim: nothing rasterised. A lifted layer is an <img> holding an
    // SVG, so this also proves `inlineSvgFromImg` carried the derived document through
    // as a nested <svg> rather than falling back to an <image>.
    const rasters = (r.text.match(/<image\b/g) ?? []).length;
    assert.equal(rasters, 0, `the posed still embedded ${rasters} raster(s)`);

    const mats = [...r.text.matchAll(/matrix\(([^)]*)\)/g)].map((m) => `matrix(${m[1]})`);
    const scales: number[] = [];
    for (const m of mats) {
      const parsed = parseCssMatrix(m);
      assert.ok(parsed, `parseCssMatrix refused a transform the walker emitted: ${m}`);
      scales.push(parsed.a);
    }
    assert.ok(mats.length >= layers.length,
      `expected at least one matrix() per lifted layer, found ${mats.length} for ${layers.length} layers`);
    // Each layer sits at its own depth, so each carries its own projected scale.
    const wanted = zs.map((z) => projectLayer({ ...poseAt(PUSH_IN, 2000), w: W, h: H }, { bx: W / 2, by: H / 2, z }).scale);
    for (const s of wanted) {
      assert.ok(scales.some((v) => Math.abs(v - s) < 0.01),
        `no matrix in the still carries the projected scale ${s.toFixed(4)}; got ${[...new Set(scales.map((v) => v.toFixed(4)))].join(', ')}`);
    }
    // The soft shadows are geometry too: one <feDropShadow> per lifted layer, derived
    // from z by §5.3's straight-overhead formula.
    const fd = (r.text.match(/<feDropShadow/g) ?? []).length;
    assert.equal(fd, rows.length, `expected one <feDropShadow> per lifted layer, got ${fd}`);
    // And the ARTWORK is still artwork: the cards' rounded rects survive as <rect rx>,
    // one per card, which is what "lifted layers stay vector" has to mean.
    const rounded = (r.text.match(/<rect[^>]*\brx="14"/g) ?? []).length;
    assert.ok(rounded >= CARDS.length,
      `the four lifted cards should still be rounded <rect>s, found ${rounded}`);
    say(`[demo] 4. still @2000 ms: ${r.size} B SVG — ${mats.length} matrix() (all parseCssMatrix-accepted) + ${fd} feDropShadow + ${rounded} rounded card rects + ${rasters} rasters`);
    say(`[demo]    projected scales ${[...new Set(scales.map((v) => v.toFixed(3)))].join(' / ')} (engine: ${[...new Set(wanted.map((v) => v.toFixed(3)))].join(' / ')})`);

    const path = await save(r.key, 'lift-still-mid-move.svg');
    if (path) say(`[demo] wrote ${path}`);
  });

  // ── 4. the contact sheet comes free ────────────────────────────────────────

  test('cuts=4 walks the same flythrough into a four-up contact sheet', async () => {
    const r = await page().evaluate(async ({ spec }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      return await S.cutsAt(spec, 4, 'svg', [{ x: 356, y: 200 }]);
    }, { spec });

    assert.equal(r.type, 'application/zip', `cuts=4 did not produce an archive: ${r.type}`);
    assert.equal(r.names!.length, 4, `expected 4 members, got ${r.names!.join(', ')}`);
    assert.ok(r.restored, 'the contact sheet left the artboard modified');

    // Each cut is a different instant of the same move, read from the markup (Chromium
    // refuses `createImageBitmap` on the walker's viewBox-only SVG) — which is the
    // stronger check anyway: it proves the sheet is vector AND that the camera advanced.
    const scalesPer = (r.texts ?? []).map((svg) => {
      const set = new Set<string>();
      for (const m of svg.matchAll(/matrix\(([^)]*)\)/g)) {
        const p = parseCssMatrix(`matrix(${m[1]})`);
        if (p) set.add(p.a.toFixed(4));
      }
      return [...set].sort();
    });
    for (let i = 0; i < 4; i++) {
      assert.ok(scalesPer[i]!.length >= 2,
        `cut ${i + 1} carries ${scalesPer[i]!.length} distinct projected scales: ${scalesPer[i]!.join(', ')}`);
    }
    assert.equal(new Set(scalesPer.map((s) => s.join('|'))).size, 4,
      `the four cuts are not four different instants: ${scalesPer.map((s) => s.join('/')).join('  ||  ')}`);
    say(`[demo] 5. contact sheet: ${r.size} B zip, members ${r.names!.join(', ')}; distinct projected scales per cut ${scalesPer.map((s) => s.length).join('/')}`);

    const path = await save(r.key!, 'lift-contact-sheet-cuts4.zip');
    if (path) say(`[demo] wrote ${path}`);
  });
});

// ── the page-side API, typed only as far as this file uses it ────────────────

interface RunLike {
  key: string | null; type: string; size: number; ms: number; logs: string[];
  error: { code: string; message: string } | null;
}
interface SeqApi {
  exportSeq(spec: unknown, format: 'mp4' | 'webm' | 'gif' | 'apng', opts?: Record<string, unknown>): Promise<RunLike>;
  exportViaApi(spec: unknown, format: string, opts?: Record<string, unknown>): Promise<RunLike>;
  blobBytes(key: string): Promise<string>;
  /** SHA-256 of a stored blob's whole byte stream — the determinism probe. */
  blobSha(key: string): Promise<string>;
  frameHashes(key: string, frameIdx: number[], fps: number): Promise<string[]>;
  trackColors(key: string, frameIdx: number[], fps: number, targets: [number, number, number][], tol?: number):
    Promise<{ w: number; h: number; frames: { n: number; cx: number; cy: number }[][] }>;
  walkToSvg(html: string, opts?: Record<string, unknown>): Promise<{
    svg: string; bytes: number; type: string; ms: number; logs: string[];
    ids: (string | null)[]; rect: { w: number; h: number };
  }>;
  vectorStillAt(spec: unknown, tMs: number, format?: 'svg' | 'pdf'): Promise<{
    text: string; size: number; type: string; key: string;
    posed: { z: string | null; transform: string; filter: string; opacity: string; zIndex: string; off: boolean }[];
  }>;
  cutsAt(spec: unknown, cuts: number, format: string, probes: { x: number; y: number }[]): Promise<{
    key: string | null; type: string; size: number; names?: string[]; texts?: string[];
    notes?: string[]; restored: boolean;
  }>;
}
