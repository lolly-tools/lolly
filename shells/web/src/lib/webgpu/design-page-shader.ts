// SPDX-License-Identifier: MPL-2.0
/** Primitive coverage and source-over are GPU work. No SVG, DOM or CPU mask is uploaded. */
export const DESIGN_PAGE_SHADER = /* wgsl */ `
struct Primitive { box: vec4<f32>, color: vec4<f32>, shape: vec4<f32>, mirror: vec4<f32> }
struct Size { page: vec2<f32>, pixels: vec2<f32> }
@group(0) @binding(0) var<storage, read> ops: array<Primitive>;
@group(0) @binding(1) var<uniform> size: Size;
struct Vertex { @builtin(position) position: vec4<f32>, @location(0) @interpolate(flat) index: u32 }
@vertex fn vertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) index: u32) -> Vertex {
  let p = ops[index];
  let half = p.box.zw * 0.5;
  let extent = vec2<f32>(abs(p.shape.z) * half.x + abs(p.shape.w) * half.y,
                         abs(p.shape.w) * half.x + abs(p.shape.z) * half.y) + size.page / size.pixels;
  let corners = array<vec2<f32>, 6>(vec2<f32>(-1,-1), vec2<f32>(1,-1), vec2<f32>(-1,1),
                                  vec2<f32>(-1,1), vec2<f32>(1,-1), vec2<f32>(1,1));
  let point = p.box.xy + half + corners[vertex] * extent;
  var result: Vertex;
  result.position = vec4<f32>(point.x / size.page.x * 2.0 - 1.0, 1.0 - point.y / size.page.y * 2.0, 0, 1);
  result.index = index;
  return result;
}
fn inside(point: vec2<f32>, p: Primitive) -> bool {
  let delta = point - p.box.xy - p.box.zw * 0.5;
  let local = vec2<f32>(p.shape.z * delta.x + p.shape.w * delta.y,
                      -p.shape.w * delta.x + p.shape.z * delta.y) * p.mirror.xy;
  let half = p.box.zw * 0.5;
  if p.shape.y > 0.5 { let unit = local / half; return dot(unit, unit) <= 1.0; }
  let q = abs(local) - half + vec2<f32>(p.shape.x);
  return length(max(q, vec2<f32>(0))) + min(max(q.x, q.y), 0.0) <= p.shape.x;
}
@fragment fn fragment(v: Vertex) -> @location(0) vec4<f32> {
  let p = ops[v.index];
  var coverage = 0.0;
  for (var y = 0u; y < 4u; y++) { for (var x = 0u; x < 4u; x++) {
    let offset = (vec2<f32>(f32(x), f32(y)) + 0.5) / 4.0 - 0.5;
    if inside((v.position.xy + offset) * size.page / size.pixels, p) { coverage += 1.0 / 16.0; }
  } }
  let alpha = p.color.a * coverage;
  return vec4<f32>(p.color.rgb * alpha, alpha);
}
`;

/** Convert the rendered premultiplied texture to tightly packed straight RGBA8 on the GPU. */
export const DESIGN_PAGE_READBACK_SHADER = /* wgsl */ `
struct Size { width: u32, height: u32, row: u32, spare: u32 }
@group(0) @binding(0) var image: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> pixels: array<u32>;
@group(0) @binding(2) var<uniform> size: Size;
@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.y * size.row + id.x;
  if index >= size.width * size.height { return; }
  let value = textureLoad(image, vec2<i32>(i32(index % size.width), i32(index / size.width)), 0);
  var color = vec3<f32>(0);
  if value.a > 0.0 { color = value.rgb / value.a; }
  pixels[index] = pack4x8unorm(vec4<f32>(color, value.a));
}
`;
