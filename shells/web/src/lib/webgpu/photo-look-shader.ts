// SPDX-License-Identifier: MPL-2.0
/**
 * Gradient-map, greyscale and duotone looks over straight-alpha RGBA8, ported from
 * engine/src/photo-look.ts in f32: the same tables, the same Newton cube root, the
 * same order of operations and Uint8ClampedArray rounding. Alpha is copied exactly.
 * Each kind has its own recipe id (pixel-kernel-recipe.ts); a change to a kind's
 * branch, or to the shared code it uses, is a new recipe for that kind.
 */
export const PHOTO_LOOK_TABLE_UNIT = 0;
export const PHOTO_LOOK_TABLE_LINEAR = 256;
export const PHOTO_LOOK_TABLE_TONE = 512;
export const PHOTO_LOOK_TABLE_RAMP = 1280;
/** Floats in one look's table buffer: unit, linear, tone (256 x RGB) and up to three ramp colours. */
export const PHOTO_LOOK_TABLE_FLOATS = PHOTO_LOOK_TABLE_RAMP + 9;
export const PHOTO_LOOK_KIND_CODE = { 'gradient-map': 0, greyscale: 1, duotone: 2 } as const;

export const PHOTO_LOOK_SHADER = /* wgsl */ `
struct Params {
  count: u32, row_width: u32, look_kind: u32, steps: u32,
  amount: f32, pad0: f32, pad1: f32, pad2: f32,
};
@group(0) @binding(0) var<storage, read> source: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<storage, read> tables: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;

const LINEAR = ${PHOTO_LOOK_TABLE_LINEAR}u;
const TONE = ${PHOTO_LOOK_TABLE_TONE}u;
const RAMP = ${PHOTO_LOOK_TABLE_RAMP}u;

fn cube_root(value: f32) -> f32 {
  if (!(value > 0.0)) { return 0.0; }
  var scale = 1.0;
  var r = value;
  for (var i = 0u; i < 64u && r < 0.125; i++) { r = r * 8.0; scale = scale * 0.5; }
  for (var i = 0u; i < 64u && r > 1.0; i++) { r = r / 8.0; scale = scale * 2.0; }
  var x = 0.4526 + r * (0.8288 - 0.2816 * r);
  for (var i = 0u; i < 5u; i++) { x = (2.0 * x + r / (x * x)) / 3.0; }
  return x * scale;
}
fn oklab_lightness(rgb: vec3<u32>) -> f32 {
  let lr = tables[LINEAR + rgb.x];
  let lg = tables[LINEAR + rgb.y];
  let lb = tables[LINEAR + rgb.z];
  let l = cube_root(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  let m = cube_root(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  let s = cube_root(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}
fn tone_at(index: u32) -> vec3<f32> {
  let at = TONE + index * 3u;
  return vec3<f32>(tables[at], tables[at + 1u], tables[at + 2u]);
}
fn ramp_at(index: u32) -> vec3<f32> {
  let at = RAMP + index * 3u;
  return vec3<f32>(tables[at], tables[at + 1u], tables[at + 2u]);
}
fn gradient_map(rgb: vec3<u32>) -> vec3<f32> {
  let lightness = oklab_lightness(rgb);
  var lf = lightness * 255.0;
  if (lightness <= 0.0) { lf = 0.0; } else if (lightness >= 1.0) { lf = 255.0; }
  let i0 = u32(lf);
  let fraction = lf - f32(i0);
  let i1 = min(i0 + 1u, 255u);
  return tone_at(i0) * (1.0 - fraction) + tone_at(i1) * fraction;
}
fn luma_map(graded: vec3<f32>) -> vec3<f32> {
  if (params.look_kind == 1u) {
    return vec3<f32>(clamp(0.213 * graded.x + 0.715 * graded.y + 0.072 * graded.z, 0.0, 1.0));
  }
  let y = clamp(0.2126 * graded.x + 0.7152 * graded.y + 0.0722 * graded.z, 0.0, 1.0);
  let n = f32(params.steps);
  let position = y * n;
  var k = params.steps - 1u;
  if (position < n) { k = u32(position); }
  let fraction = position - f32(k);
  let low = ramp_at(k);
  return low + (ramp_at(k + 1u) - low) * fraction;
}
fn byte(value: f32) -> u32 {
  let v = clamp(value, 0.0, 255.0);
  let lower = floor(v);
  let fraction = v - lower;
  let integer = u32(lower);
  return integer + select(0u, 1u, fraction > 0.5 || (fraction == 0.5 && (integer & 1u) == 1u));
}
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x + id.y * params.row_width;
  if (index >= params.count) { return; }
  let pixel = source[index];
  let rgb = vec3<u32>(pixel & 255u, (pixel >> 8u) & 255u, (pixel >> 16u) & 255u);
  let graded = vec3<f32>(tables[rgb.x], tables[rgb.y], tables[rgb.z]);
  var result: vec3<f32>;
  if (params.look_kind == 0u) {
    result = (graded + (gradient_map(rgb) - graded) * params.amount) * 255.0;
  } else {
    let mapped = luma_map(graded);
    // The reference writes a full-strength luma look without the blend.
    result = select((graded + (mapped - graded) * params.amount) * 255.0, mapped * 255.0, params.amount == 1.0);
  }
  output[index] = byte(result.x) | (byte(result.y) << 8u) | (byte(result.z) << 16u) | (pixel & 0xff000000u);
}
`;
