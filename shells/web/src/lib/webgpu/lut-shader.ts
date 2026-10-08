// SPDX-License-Identifier: MPL-2.0
/** RGBA8 with exact alpha preservation and red-fastest LUT storage. */
export const LUT_SHADER = /* wgsl */ `
struct Params {
  count: u32, size: u32, kind: u32, row_width: u32,
  intensity: f32, pad0: f32, pad1: f32, pad2: f32,
  domain_min: vec4<f32>, domain_max: vec4<f32>,
};
@group(0) @binding(0) var<storage, read> source: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<storage, read> lut: array<f32>;
@group(0) @binding(3) var<uniform> params: Params;

fn triple(index: u32) -> vec3<f32> {
  return vec3<f32>(lut[index], lut[index + 1u], lut[index + 2u]);
}
fn sample_lut(rgb: vec3<f32>) -> vec3<f32> {
  let span = params.domain_max.xyz - params.domain_min.xyz;
  let domain = select(vec3<f32>(1.0), span, span != vec3<f32>(0.0));
  let p = clamp((rgb - params.domain_min.xyz) / domain, vec3<f32>(0.0), vec3<f32>(1.0)) * f32(params.size - 1u);
  if (params.kind == 0u) {
    let first = vec3<u32>(floor(p));
    let second = min(first + vec3<u32>(1u), vec3<u32>(params.size - 1u));
    let fraction = p - vec3<f32>(first);
    return vec3<f32>(
      lut[first.x * 3u] * (1.0 - fraction.x) + lut[second.x * 3u] * fraction.x,
      lut[first.y * 3u + 1u] * (1.0 - fraction.y) + lut[second.y * 3u + 1u] * fraction.y,
      lut[first.z * 3u + 2u] * (1.0 - fraction.z) + lut[second.z * 3u + 2u] * fraction.z
    );
  }
  let cell = vec3<u32>(min(floor(p), vec3<f32>(f32(params.size - 2u))));
  let f = p - vec3<f32>(cell);
  let sx = 3u;
  let sy = params.size * 3u;
  let sz = params.size * params.size * 3u;
  let base = ((cell.z * params.size + cell.y) * params.size + cell.x) * 3u;
  var weights: vec4<f32>;
  var a: u32;
  var b: u32;
  if (f.x >= f.y) {
    if (f.y >= f.z) { weights = vec4<f32>(1.0-f.x, f.x-f.y, f.y-f.z, f.z); a=base+sx; b=base+sx+sy; }
    else if (f.x >= f.z) { weights = vec4<f32>(1.0-f.x, f.x-f.z, f.z-f.y, f.y); a=base+sx; b=base+sx+sz; }
    else { weights = vec4<f32>(1.0-f.z, f.z-f.x, f.x-f.y, f.y); a=base+sz; b=base+sx+sz; }
  } else {
    if (f.z >= f.y) { weights = vec4<f32>(1.0-f.z, f.z-f.y, f.y-f.x, f.x); a=base+sz; b=base+sy+sz; }
    else if (f.z >= f.x) { weights = vec4<f32>(1.0-f.y, f.y-f.z, f.z-f.x, f.x); a=base+sy; b=base+sy+sz; }
    else { weights = vec4<f32>(1.0-f.y, f.y-f.x, f.x-f.z, f.z); a=base+sy; b=base+sx+sy; }
  }
  return weights.x * triple(base) + weights.y * triple(a) + weights.z * triple(b) + weights.w * triple(base+sx+sy+sz);
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
  let rgb = vec3<f32>(f32(pixel & 255u), f32((pixel >> 8u) & 255u), f32((pixel >> 16u) & 255u));
  let graded = sample_lut(rgb / 255.0) * 255.0;
  let result = rgb + (graded - rgb) * params.intensity;
  output[index] = byte(result.x) | (byte(result.y) << 8u) | (byte(result.z) << 16u) | (pixel & 0xff000000u);
}
`;
