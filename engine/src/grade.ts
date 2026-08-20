// SPDX-License-Identifier: MPL-2.0
/**
 * Colour grading: LUT reading, LUT sampling, and the film grain + vignette pass.
 *
 * This is the pure, DOM-free half of the darkroom tool's look engine, promoted
 * into the engine so a shell can grade something the tool cannot: a VIDEO. The
 * darkroom tool renders one still on a canvas; plans/130's video grade walks a
 * decoded clip frame by frame, and every frame needs the same `.cube` reader,
 * the same tetrahedral sampler and the same grain lattice the still uses, or a
 * graded clip would not match the graded frame the user was looking at when
 * they picked the look.
 *
 * WHERE IT CAME FROM. Every function here is a typed port of
 * `community/darkroom/hooks.js` - `parseCube` (line 450), `parse3dl` (485),
 * `parseLutFile` (513), `sampleLut` (583), `applyPipelineLut` (940), and
 * `grainVignettePass`, the tool's own named grain + vignette pass. The maths,
 * the bounds, the branch order of the tetrahedral cases and the error strings
 * are carried across unchanged; the arithmetic is bit-for-bit the same so a
 * frame graded here and the still graded in the tool agree.
 *
 * DARKROOM KEEPS ITS COPY, ON PURPOSE. Tools never import from the engine -
 * that is what lets one tool run unchanged in a browser, in Tauri and in the
 * CLI - so `hooks.js` cannot be rewritten to call this module, and deleting its
 * copy is not an option. Two copies of the same maths drift silently, so
 * `tests/grade-drift.test.ts` lifts darkroom's functions out of the hook source
 * the same way the runtime compiles them and asserts the two agree: the parsers
 * on a corpus of good and malformed text, the sampler to 1e-6 on a random
 * lattice, and the frame apply and the grain + vignette pass byte-for-byte.
 * Change the maths in one place and that test fails until you change it in the
 * other.
 *
 * TWO DELIBERATE DIFFERENCES, both of them optional arguments that default to
 * darkroom's own behaviour, so the guard above still compares like for like.
 *
 * The first is the grain seed. A still seeds its noise lattice once; a clip
 * that reused one lattice for every frame would show grain frozen onto the
 * picture like dirt on the lens instead of the boiling texture real stock has.
 * So `applyGrainVignette` advances the seed per frame (`seed + frameIndex *
 * 9973`, an odd prime stride so nearby frames land far apart in the generator's
 * sequence) - and `frameIndex` 0 reduces to exactly darkroom's seeding, so a
 * one-frame grade reproduces the still.
 *
 * The second is `refLongEdge`, the reference resolution the grain lattice is
 * measured against - see `grainCellPx`. A still tool grades one canvas and
 * never notices that its cell size is in raw device pixels; the video path
 * previews small and renders at source resolution, and the same slider on two
 * frame sizes is two different textures. Omit it (or pass 0) and the cell is
 * the absolute pixel count darkroom uses.
 *
 * DOMAIN CONVENTIONS, which are easy to mix up because the tool mixes them:
 * `sampleLut` is 0..1 floats in and out; `applyLutFrame` is 0..255 bytes in a
 * `Uint8ClampedArray`, relying on the clamped writes for out-of-range results
 * exactly as `applyPipelineLut` does; `applyGrainVignette` is the same byte
 * domain and divides by 255 for its luminance weight.
 *
 * The LUT parsers read UNTRUSTED bytes (a user-picked LUT file, fuzzed under
 * target 'lut-parse'). `CUBE_MAX_N` / `TDL_MAX_N` are the only thing bounding
 * parse memory, so both checks stay BEFORE the `Float32Array` allocation.
 */

/** A parsed colour lookup table. `data` is red-fastest: `size³·3` floats for a
 *  3D grid, `size·3` for a 1D one. The shape is identical to what the darkroom
 *  tool's `buildPipelineLut` produces, so a file-loaded LUT and a baked look
 *  are interchangeable everywhere below. */
export interface GradeLut {
  kind: '1d' | '3d';
  size: number;
  data: Float32Array;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  title: string;
}

/** `.cube` grid cap. A grid of N costs N³ float triples, so this is what bounds
 *  parse memory: 129³·3 floats is about 25 MB, the practical ceiling shipping
 *  `.cube` files use. */
export const CUBE_MAX_N = 129;
/** `.3dl` grid cap - those grids top out at 64+1 in the wild. */
export const TDL_MAX_N = 65;

const LUM_R = 0.2126;
const LUM_G = 0.7152;
const LUM_B = 0.0722; // Rec.709 luma

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Darkroom's deterministic PRNG, transcribed from `hooks.js` lines 192-200.
 *
 * DO NOT DEDUPE THIS AGAINST `mulberry32` IN `zzfx-compose.ts`. They share a
 * name and an ancestor and produce DIFFERENT sequences: that one seeds `a >>> 0`
 * and mixes `t ^= t + Math.imul(t ^ (t >>> 7), t | 61)`, this one seeds `a |= 0`
 * and mixes `t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t`. Swapping one for
 * the other changes every grain pixel, which is precisely the thing the drift
 * guard exists to stop. Exported so the tests can build a reference lattice.
 */
export function gradeMulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── parsers ──────────────────────────────────────────────────────────────────

/**
 * Adobe/IRIDAS `.cube`. Throws with a friendly message on anything that is not
 * one. Data order for a 3D grid is red-fastest, per the format spec.
 *
 * Lenient in the way the format is used in the wild: unknown `LUT_*` keywords
 * are ignored, any line of three finite numbers is data, and a line of three
 * non-finite values is skipped rather than fatal. The strictness that matters
 * is the declared size - checked against the cap before anything is allocated.
 */
export function parseCubeLut(text: string): GradeLut {
  const lines = String(text).split(/\r?\n/);
  let size = 0;
  let kind: '1d' | '3d' | null = null;
  let title = '';
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const data: number[] = [];
  const triple = (parts: string[]): [number, number, number] => [
    Number(parts[1]),
    Number(parts[2]),
    Number(parts[3]),
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line[0] === '#') continue;
    const up = line.toUpperCase();
    if (up.indexOf('TITLE') === 0) {
      const m = line.match(/"(.*)"/);
      title = m ? m[1]! : line.slice(5).trim();
      continue;
    }
    if (up.indexOf('LUT_1D_SIZE') === 0) { kind = '1d'; size = parseInt(line.split(/\s+/)[1]!, 10); continue; }
    if (up.indexOf('LUT_3D_SIZE') === 0) { kind = '3d'; size = parseInt(line.split(/\s+/)[1]!, 10); continue; }
    if (up.indexOf('DOMAIN_MIN') === 0) { domainMin = triple(line.split(/\s+/)); continue; }
    if (up.indexOf('DOMAIN_MAX') === 0) { domainMax = triple(line.split(/\s+/)); continue; }
    if (up.indexOf('LUT_') === 0) continue; // unknown keyword
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) continue;
    data.push(r, g, b);
  }
  if (!kind || !(size >= 2)) throw new Error('Not a .cube LUT (no LUT_1D_SIZE / LUT_3D_SIZE)');
  if (size > CUBE_MAX_N) throw new Error(`LUT grid too large (max ${CUBE_MAX_N})`);
  const expect = kind === '3d' ? size * size * size * 3 : size * 3;
  if (data.length < expect) {
    throw new Error(`LUT is truncated (${data.length / 3} of ${expect / 3} rows)`);
  }
  return {
    kind,
    size,
    data: new Float32Array(data.slice(0, expect)),
    domainMin,
    domainMax,
    title,
  };
}

/**
 * Autodesk `.3dl`: a mesh line of grid input levels, then size³ integer
 * triples, BLUE-fastest (red slowest - the opposite of `.cube`), on a
 * 0..(2^depth − 1) output scale detected from the data. Reordered here to
 * red-fastest so one sampler serves both formats.
 *
 * The row-count check runs before the cap check, matching the tool: a file
 * declaring an absurd mesh width almost never carries the rows to match, so it
 * is rejected as "not a .3dl" rather than as "too large". Either way the
 * allocation below is unreachable until both have passed.
 */
export function parse3dlLut(text: string): GradeLut {
  const lines = String(text).split(/\r?\n/);
  let mesh: number[] | null = null;
  const rows: number[][] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line || line[0] === '#' || /^[A-Za-z]/.test(line)) continue; // skip keywords/comments
    const parts = line.split(/\s+/).map(Number);
    if (parts.some((v) => !isFinite(v))) continue;
    if (!mesh && parts.length > 3) { mesh = parts; continue; } // the mesh line
    if (parts.length >= 3) rows.push(parts.slice(0, 3));
  }
  const size = mesh ? mesh.length : Math.round(Math.pow(rows.length, 1 / 3));
  if (!(size >= 2) || rows.length < size * size * size) throw new Error('Not a .3dl LUT');
  if (size > TDL_MAX_N) throw new Error(`LUT grid too large (max ${TDL_MAX_N} for .3dl)`);
  let peak = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    peak = Math.max(peak, row[0]!, row[1]!, row[2]!);
  }
  const scale = peak > 4095 ? 65535 : peak > 1023 ? 4095 : peak > 255 ? 1023 : 255;
  const data = new Float32Array(size * size * size * 3);
  let k = 0;
  for (let rI = 0; rI < size; rI++) {
    for (let gI = 0; gI < size; gI++) {
      for (let bI = 0; bI < size; bI++) {
        const row = rows[k++]!;
        const out = ((bI * size + gI) * size + rI) * 3; // red-fastest destination
        data[out] = row[0]! / scale;
        data[out + 1] = row[1]! / scale;
        data[out + 2] = row[2]! / scale;
      }
    }
  }
  return { kind: '3d', size, data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '' };
}

/**
 * Read LUT text of unknown format. A name ending `.3dl` goes straight to the
 * `.3dl` reader; everything else is tried as `.cube` first and falls back to
 * `.3dl`, so a `.3dl` renamed `.txt` still loads.
 *
 * Throws on failure, unlike darkroom's `parseLutFile`, which returns
 * `{ error }` because it feeds a tool patch. Callers here get a real Error.
 * The fallback swallows the `.cube` message and reports the `.3dl` one, so a
 * mangled `.cube` reports 'Not a .3dl LUT' - a known wart of the chain, kept
 * because changing it would change what the tool's own error banner says.
 */
export function parseLutText(text: string, name?: string): GradeLut {
  const lower = String(name || '').toLowerCase();
  if (lower.slice(-4) === '.3dl') return parse3dlLut(text);
  try {
    return parseCubeLut(text);
  } catch {
    return parse3dlLut(text);
  }
}

// ── sampling ─────────────────────────────────────────────────────────────────

/**
 * Sample a parsed LUT at r,g,b (0..1), returning [r,g,b] in 0..1.
 *
 * 3D uses tetrahedral interpolation - the standard for grading, because it is
 * exact on the grid and behaves best along the neutral diagonal, where
 * trilinear drifts off grey. 1D interpolates each channel linearly.
 */
export function sampleLut(lut: GradeLut, r: number, g: number, b: number): [number, number, number] {
  const dm = lut.domainMin;
  const dM = lut.domainMax;
  const rr = clamp((r - dm[0]) / (dM[0] - dm[0] || 1), 0, 1);
  const gg = clamp((g - dm[1]) / (dM[1] - dm[1] || 1), 0, 1);
  const bb = clamp((b - dm[2]) / (dM[2] - dm[2] || 1), 0, 1);
  const N = lut.size;
  const d = lut.data;
  if (lut.kind === '1d') {
    const out: [number, number, number] = [rr, gg, bb];
    for (let c = 0; c < 3; c++) {
      const x = out[c]! * (N - 1);
      const i0 = Math.floor(x);
      const f = x - i0;
      const i1 = Math.min(i0 + 1, N - 1);
      out[c] = d[i0 * 3 + c]! * (1 - f) + d[i1 * 3 + c]! * f;
    }
    return out;
  }
  const x = rr * (N - 1);
  const y = gg * (N - 1);
  const z = bb * (N - 1);
  let x0 = Math.min(Math.floor(x), N - 2);
  let y0 = Math.min(Math.floor(y), N - 2);
  let z0 = Math.min(Math.floor(z), N - 2);
  if (N === 2) { x0 = 0; y0 = 0; z0 = 0; }
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const at = (xi: number, yi: number, zi: number, c: number): number => d[((zi * N + yi) * N + xi) * 3 + c]!; // red-fastest
  // Pick the tetrahedron of the cube cell containing (fx,fy,fz) and
  // barycentric-blend its four corners.
  const out3: [number, number, number] = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    const c000 = at(x0, y0, z0, ch);
    const c111 = at(x0 + 1, y0 + 1, z0 + 1, ch);
    let v: number;
    if (fx >= fy) {
      if (fy >= fz) { // x ≥ y ≥ z
        v = (1 - fx) * c000 + (fx - fy) * at(x0 + 1, y0, z0, ch) + (fy - fz) * at(x0 + 1, y0 + 1, z0, ch) + fz * c111;
      } else if (fx >= fz) { // x ≥ z > y
        v = (1 - fx) * c000 + (fx - fz) * at(x0 + 1, y0, z0, ch) + (fz - fy) * at(x0 + 1, y0, z0 + 1, ch) + fy * c111;
      } else { // z > x ≥ y
        v = (1 - fz) * c000 + (fz - fx) * at(x0, y0, z0 + 1, ch) + (fx - fy) * at(x0 + 1, y0, z0 + 1, ch) + fy * c111;
      }
    } else {
      if (fz >= fy) { // z ≥ y > x
        v = (1 - fz) * c000 + (fz - fy) * at(x0, y0, z0 + 1, ch) + (fy - fx) * at(x0, y0 + 1, z0 + 1, ch) + fx * c111;
      } else if (fz >= fx) { // y > z ≥ x
        v = (1 - fy) * c000 + (fy - fz) * at(x0, y0 + 1, z0, ch) + (fz - fx) * at(x0, y0 + 1, z0 + 1, ch) + fx * c111;
      } else { // y > x > z
        v = (1 - fy) * c000 + (fy - fx) * at(x0, y0 + 1, z0, ch) + (fx - fz) * at(x0 + 1, y0 + 1, z0, ch) + fz * c111;
      }
    }
    out3[ch] = v;
  }
  return out3;
}

/** Whether a LUT's domain is the plain 0..1 unit cube - the case the fast
 *  per-pixel loop below assumes, and the only one darkroom's baked pipeline
 *  LUTs ever have. */
function isUnitDomain(lut: GradeLut): boolean {
  const a = lut.domainMin;
  const b = lut.domainMax;
  return a[0] === 0 && a[1] === 0 && a[2] === 0 && b[0] === 1 && b[1] === 1 && b[2] === 1;
}

/**
 * Apply a LUT to an RGBA byte frame in place. Alpha is untouched.
 *
 * `intensity` lerps original → sampled, so a shell can dial a look back without
 * rebuilding the table; at 1 (the default) the writes are byte-identical to
 * darkroom's `applyPipelineLut`, which is what the drift test pins.
 *
 * `data` MUST be a `Uint8ClampedArray`. Like the tool, the hot loop writes
 * `255 * …` with no clamp of its own and leans on the clamped store for an
 * out-of-range table value; a plain `Uint8Array` would wrap instead.
 *
 * A 3D LUT on the unit domain takes the inlined flat-index loop (the shape
 * every baked look and nearly every shipped `.cube` has). A 1D table, or a
 * `.cube` that declares its own DOMAIN_MIN/MAX, goes through `sampleLut`
 * instead - slower per pixel, but correct for files darkroom's own hot loop
 * would have misread, since it never sees anything but its own pipeline LUT.
 */
export function applyLutFrame(data: Uint8ClampedArray, lut: GradeLut, intensity = 1): void {
  const t = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
  if (!(t > 0)) return;
  const mix = t < 1;
  const d = data;
  if (lut.kind !== '3d' || !isUnitDomain(lut)) {
    for (let i = 0; i < d.length; i += 4) {
      const r0 = d[i]!;
      const g0 = d[i + 1]!;
      const b0 = d[i + 2]!;
      const s = sampleLut(lut, r0 / 255, g0 / 255, b0 / 255);
      const nr = 255 * s[0];
      const ng = 255 * s[1];
      const nb = 255 * s[2];
      if (mix) {
        d[i] = r0 + (nr - r0) * t;
        d[i + 1] = g0 + (ng - g0) * t;
        d[i + 2] = b0 + (nb - b0) * t;
      } else {
        d[i] = nr;
        d[i + 1] = ng;
        d[i + 2] = nb;
      }
    }
    return;
  }
  const tab = lut.data;
  const N = lut.size;
  const N1 = N - 1;
  const sx = 3;
  const sy = N * 3;
  const sz = N * N * 3;
  for (let i = 0; i < d.length; i += 4) {
    const r0 = d[i]!;
    const g0 = d[i + 1]!;
    const b0 = d[i + 2]!;
    const x = (r0 / 255) * N1;
    const y = (g0 / 255) * N1;
    const z = (b0 / 255) * N1;
    let x0 = x | 0;
    let y0 = y | 0;
    let z0 = z | 0;
    if (x0 > N - 2) x0 = N - 2;
    if (y0 > N - 2) y0 = N - 2;
    if (z0 > N - 2) z0 = N - 2;
    const fx = x - x0;
    const fy = y - y0;
    const fz = z - z0;
    const i000 = ((z0 * N + y0) * N + x0) * 3;
    const i111 = i000 + sx + sy + sz;
    let w0: number;
    let w1: number;
    let w2: number;
    let w3: number;
    let ia: number;
    let ib: number;
    if (fx >= fy) {
      if (fy >= fz) { w0 = 1 - fx; w1 = fx - fy; w2 = fy - fz; w3 = fz; ia = i000 + sx; ib = i000 + sx + sy; }
      else if (fx >= fz) { w0 = 1 - fx; w1 = fx - fz; w2 = fz - fy; w3 = fy; ia = i000 + sx; ib = i000 + sx + sz; }
      else { w0 = 1 - fz; w1 = fz - fx; w2 = fx - fy; w3 = fy; ia = i000 + sz; ib = i000 + sx + sz; }
    } else {
      if (fz >= fy) { w0 = 1 - fz; w1 = fz - fy; w2 = fy - fx; w3 = fx; ia = i000 + sz; ib = i000 + sy + sz; }
      else if (fz >= fx) { w0 = 1 - fy; w1 = fy - fz; w2 = fz - fx; w3 = fx; ia = i000 + sy; ib = i000 + sy + sz; }
      else { w0 = 1 - fy; w1 = fy - fx; w2 = fx - fz; w3 = fz; ia = i000 + sy; ib = i000 + sx + sy; }
    }
    const nr = 255 * (w0 * tab[i000]! + w1 * tab[ia]! + w2 * tab[ib]! + w3 * tab[i111]!);
    const ng = 255 * (w0 * tab[i000 + 1]! + w1 * tab[ia + 1]! + w2 * tab[ib + 1]! + w3 * tab[i111 + 1]!);
    const nb = 255 * (w0 * tab[i000 + 2]! + w1 * tab[ia + 2]! + w2 * tab[ib + 2]! + w3 * tab[i111 + 2]!);
    if (mix) {
      d[i] = r0 + (nr - r0) * t;
      d[i + 1] = g0 + (ng - g0) * t;
      d[i + 2] = b0 + (nb - b0) * t;
    } else {
      d[i] = nr;
      d[i + 1] = ng;
      d[i + 2] = nb;
    }
  }
}

// ── grain + vignette ─────────────────────────────────────────────────────────

/** The texture parameters the grain + vignette pass reads, normalised the way
 *  darkroom's `paramsFrom` normalises them: `grain` and `vignette` 0..1,
 *  `grainSize` the lattice cell in px (1..4 in the tool), `seed` an integer. */
export interface GrainVignetteParams {
  grain: number;
  grainSize: number;
  vignette: number;
  seed: number;
}

/** The frame long edge `grainSize` is authored against - the cell is exactly
 *  `grainSize` px on a frame this wide, and proportionally wider on a larger
 *  one (a 1920-px clip gets cells 1.78x the slider value). The number itself
 *  only sets the overall scale; what matters is that every video consumer
 *  passes THE SAME one as `refLongEdge` - the preview, which grades a
 *  downscaled frame, and the render, which grades the source - so both draw the
 *  same texture at the same fraction of the picture. */
export const GRAIN_REF_LONG_EDGE = 1080;

/** Below about half a pixel the lattice is finer than the grid it is sampled
 *  on, so the bilinear read degenerates into per-pixel white noise and the
 *  allocation grows for nothing. A tiny thumbnail against a 1080 reference
 *  lands there, so the scaled cell is floored here. */
const GRAIN_CELL_MIN_PX = 0.5;

/**
 * The grain lattice cell, in pixels of the frame being graded.
 *
 * `grainSize` is a cell size, not a frequency, so on its own it ties the
 * texture to the pixel grid rather than to the picture: 2 px cells are a coarse
 * boil across a 960-wide preview and a fine dust across the 1920-wide render of
 * the same clip - a 2x difference in exactly the thing the user is judging by
 * eye. Amplitude does not drift with resolution and neither does the vignette
 * (it normalises against the corner radius), which is what makes this easy to
 * miss.
 *
 * With `refLongEdge` set, the cell scales with the frame's long edge, so the
 * lattice is a constant fraction of the picture: at the reference the slider
 * value is the pixel count, at double the resolution the cells are twice as
 * wide and the texture looks identical. Absent or 0 keeps the absolute-pixel
 * reading darkroom's still has, which is what the drift guard pins.
 *
 * Exported because it is the whole of the resolution question and deserves to
 * be tested directly rather than inferred from noise statistics.
 */
export function grainCellPx(
  grainSize: number,
  width: number,
  height: number,
  refLongEdge?: number,
): number {
  // A zero/NaN cell would make the lattice dimensions infinite; the tool cannot
  // produce one (its slider clamps to 1..4) but a shell passes this in raw.
  const base = grainSize > 0 ? grainSize : 1;
  const ref = refLongEdge ?? 0;
  if (!(ref > 0)) return base;
  const scaled = base * (Math.max(width, height) / ref);
  return scaled > GRAIN_CELL_MIN_PX ? scaled : GRAIN_CELL_MIN_PX;
}

/**
 * Film grain + vignette over an RGBA byte frame, in place. Alpha is untouched.
 *
 * Grain is value noise on a lattice of `grainSize`-px cells, bilinearly
 * sampled and luminance-weighted so it peaks in the midtones and fades out of
 * the blacks and the highlights, the way real stock behaves. The vignette is a
 * smoothstep on squared radius from the centre, so it stays a soft falloff
 * rather than a visible ring.
 *
 * `frameIndex` advances the noise: the lattice is drawn from
 * `seed + frameIndex * 9973`, so consecutive frames get uncorrelated grain
 * while the whole clip stays reproducible from one seed. At `frameIndex` 0 the
 * seeding collapses to darkroom's own, so a single-frame grade is pixel-identical
 * to the still the tool shows.
 *
 * `refLongEdge` measures the grain lattice against a reference picture height
 * instead of the pixel grid (see `grainCellPx`); a caller that grades the same
 * clip at two sizes - a capped preview and a full-resolution render - must pass
 * `GRAIN_REF_LONG_EDGE` at both, or the texture the user approved is not the
 * texture that ships. Omitted, the cell is `grainSize` in raw pixels, which is
 * what the still tool does.
 *
 * `data` must be a `Uint8ClampedArray` of at least `width * height * 4` bytes,
 * and out-of-range results rely on its clamped writes exactly as the tool's
 * ImageData pass does.
 */
export function applyGrainVignette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  p: GrainVignetteParams,
  frameIndex?: number,
  refLongEdge?: number,
): void {
  const W = width | 0;
  const H = height | 0;
  if (W <= 0 || H <= 0) return;
  if (data.length < W * H * 4) {
    throw new Error(`grain/vignette: frame is ${data.length} bytes, ${W}×${H} needs ${W * H * 4}`);
  }
  if (!(p.grain > 0) && !(p.vignette > 0)) return;

  const gd = data;
  const cx2 = W / 2;
  const cy2 = H / 2;
  const maxR2 = cx2 * cx2 + cy2 * cy2;
  const cell = grainCellPx(p.grainSize, W, H, refLongEdge);
  const gw = Math.ceil(W / cell) + 2;
  const gh = Math.ceil(H / cell) + 2;
  let lattice: Float32Array | null = null;
  if (p.grain > 0) {
    lattice = new Float32Array(gw * gh);
    const seedInput = p.seed + (frameIndex ?? 0) * 9973;
    const rng = gradeMulberry32(((seedInput * 2654435761) >>> 0) || 1);
    for (let li = 0; li < lattice.length; li++) lattice[li] = rng() * 2 - 1;
  }
  const gAmt = p.grain * 34;
  const vAmt = p.vignette;
  for (let y2 = 0; y2 < H; y2++) {
    const gy = y2 / cell;
    const gy0 = gy | 0;
    const gfy = gy - gy0;
    for (let x3 = 0; x3 < W; x3++) {
      const i5 = (y2 * W + x3) * 4;
      let r5 = gd[i5]!;
      let g5 = gd[i5 + 1]!;
      let b5 = gd[i5 + 2]!;
      if (lattice) {
        const gx = x3 / cell;
        const gx0 = gx | 0;
        const gfx = gx - gx0;
        const l00 = lattice[gy0 * gw + gx0]!;
        const l10 = lattice[gy0 * gw + gx0 + 1]!;
        const l01 = lattice[(gy0 + 1) * gw + gx0]!;
        const l11 = lattice[(gy0 + 1) * gw + gx0 + 1]!;
        const nv = (l00 * (1 - gfx) + l10 * gfx) * (1 - gfy) + (l01 * (1 - gfx) + l11 * gfx) * gfy;
        const lum2 = (LUM_R * r5 + LUM_G * g5 + LUM_B * b5) / 255;
        const gw2 = 4 * lum2 * (1 - lum2); // midtone-weighted (peaks at 0.5)
        const add = nv * gAmt * (0.35 + 0.65 * gw2);
        r5 += add;
        g5 += add;
        b5 += add;
      }
      if (vAmt > 0) {
        const dx2 = x3 - cx2;
        const dy2 = y2 - cy2;
        const vr = (dx2 * dx2 + dy2 * dy2) / maxR2;
        const vk = 1 - vAmt * smoothstep(0.28, 1.05, vr) * 0.82;
        r5 *= vk;
        g5 *= vk;
        b5 *= vk;
      }
      gd[i5] = r5;
      gd[i5 + 1] = g5;
      gd[i5 + 2] = b5;
    }
  }
}
