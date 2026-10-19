// SPDX-License-Identifier: MPL-2.0
import { DESIGN_RASTER_MAX_CLIP_POINTS } from '../../../../../engine/src/design-draw-raster.ts';

/** The primitive shader in parts, so the gradient pass draws exactly the primitive's coverage. */
const PRIMITIVE_HEAD = /* wgsl */ `
struct Primitive { box: vec4<f32>, color: vec4<f32>, shape: vec4<f32>, mirror: vec4<f32> }
struct Size { page: vec2<f32>, pixels: vec2<f32> }
@group(0) @binding(0) var<storage, read> ops: array<Primitive>;
@group(0) @binding(1) var<uniform> size: Size;
struct Vertex { @builtin(position) position: vec4<f32>, @location(0) @interpolate(flat) index: u32 }
`;
const PRIMITIVE_VERTEX = /* wgsl */ `@vertex fn vertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) index: u32) -> Vertex {
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
`;
const PRIMITIVE_COVERAGE = /* wgsl */ `fn localPoint(point: vec2<f32>, p: Primitive) -> vec2<f32> {
  let delta = point - p.box.xy - p.box.zw * 0.5;
  return vec2<f32>(p.shape.z * delta.x + p.shape.w * delta.y,
                      -p.shape.w * delta.x + p.shape.z * delta.y) * p.mirror.xy;
}
fn curveDistance(local: vec2<f32>, p: Primitive) -> f32 {
  let half = p.box.zw * 0.5;
  // This ellipse bound cannot skip a pixel that intersects the curve: the
  // normalized radius changes by at most distance / the smaller radius.
  if p.shape.y > 0.5 { return (length(local / half) - 1.0) * min(half.x, half.y); }
  let q = abs(local) - half + vec2<f32>(p.shape.x);
  return length(max(q, vec2<f32>(0))) + min(max(q.x, q.y), 0.0) - p.shape.x;
}
fn curveInside(local: vec2<f32>, p: Primitive) -> bool {
  var unit = abs(local) / (p.box.zw * 0.5);
  if p.shape.y < 0.5 {
    let q = abs(local) - p.box.zw * 0.5 + vec2<f32>(p.shape.x);
    if min(q.x, q.y) <= 0.0 { return max(q.x, q.y) <= p.shape.x; }
    unit = q / p.shape.x;
  }
  let sector = min(floor(atan2(unit.y, unit.x) * (2.0 / 3.14159265359) * p.mirror.z), p.mirror.z - 1.0);
  let angle = (sector + 0.5) * (3.14159265359 * 0.5 / p.mirror.z);
  return dot(unit, vec2<f32>(cos(angle), sin(angle))) <= p.mirror.w;
}
fn rectangleCoverage(pixel: vec2<f32>, p: Primitive) -> f32 {
  // Clip the whole output pixel against all four finite edges. A nearest-edge
  // ramp loses corner coverage and overstates rectangles narrower than a pixel.
  // Coordinates stay near the pixel centre to avoid cancelling large areas.
  let step = size.page / size.pixels;
  let centre = localPoint(pixel * step, p);
  let reach = vec2<f32>(abs(p.shape.z) * step.x + abs(p.shape.w) * step.y,
                        abs(p.shape.w) * step.x + abs(p.shape.z) * step.y) * 0.5;
  let half = p.box.zw * 0.5;
  if all(abs(centre) + reach <= half) { return 1.0; }
  if any(abs(centre) - reach >= half) { return 0.0; }
  let signs = array<vec2<f32>, 4>(vec2<f32>(-0.5,-0.5), vec2<f32>(0.5,-0.5),
                                vec2<f32>(0.5,0.5), vec2<f32>(-0.5,0.5));
  var polygon: array<vec2<f32>, 8>;
  var count = 4u;
  for (var i = 0u; i < 4u; i++) {
    let offset = signs[i] * step;
    polygon[i] = vec2<f32>(p.shape.z * offset.x + p.shape.w * offset.y,
                          -p.shape.w * offset.x + p.shape.z * offset.y) * p.mirror.xy;
  }
  for (var edge = 0u; edge < 4u; edge++) {
    if count == 0u { return 0.0; }
    let axis = edge / 2u;
    let direction = select(-1.0, 1.0, edge % 2u == 1u);
    let bound = p.box.zw[axis] * 0.5 - direction * centre[axis];
    var next: array<vec2<f32>, 8>;
    var n = 0u;
    var previous = polygon[count - 1u];
    var previousDistance = direction * previous[axis] - bound;
    for (var i = 0u; i < count; i++) {
      let current = polygon[i];
      let distance = direction * current[axis] - bound;
      if (distance < 0.0 && previousDistance > 0.0) || (distance > 0.0 && previousDistance < 0.0) {
        next[n] = mix(previous, current, previousDistance / (previousDistance - distance)); n++;
      }
      if distance <= 0.0 { next[n] = current; n++; }
      previous = current; previousDistance = distance;
    }
    polygon = next; count = n;
  }
  var twiceArea = 0.0;
  for (var i = 0u; i < count; i++) {
    let a = polygon[i]; let b = polygon[(i + 1u) % count];
    twiceArea += a.x * b.y - a.y * b.x;
  }
  return clamp(abs(twiceArea) * 0.5 / (step.x * step.y), 0.0, 1.0);
}
fn stripPixelArea(points: array<vec2<f32>, 4>) -> f32 {
  var polygon: array<vec2<f32>, 8>;
  for (var i = 0u; i < 4u; i++) { polygon[i] = points[i]; }
  var count = 4u;
  // The strip already lies inside this pixel's Y interval. Clip both X edges.
  for (var side = 0u; side < 2u; side++) {
    if count == 0u { return 0.0; }
    let direction = select(-1.0, 1.0, side == 1u);
    let bound = f32(side);
    var next: array<vec2<f32>, 8>;
    var n = 0u;
    var previous = polygon[count - 1u];
    var previousDistance = direction * previous.x - bound;
    for (var i = 0u; i < count; i++) {
      let current = polygon[i];
      let distance = direction * current.x - bound;
      if (distance < 0.0 && previousDistance > 0.0) || (distance > 0.0 && previousDistance < 0.0) {
        next[n] = mix(previous, current, previousDistance / (previousDistance - distance)); n++;
      }
      if distance <= 0.0 { next[n] = current; n++; }
      previous = current; previousDistance = distance;
    }
    polygon = next; count = n;
  }
  var twiceArea = 0.0;
  for (var i = 0u; i < count; i++) {
    let a = polygon[i]; let b = polygon[(i + 1u) % count];
    twiceArea += a.x * b.y - a.y * b.x;
  }
  return abs(twiceArea) * 0.5;
}
fn scanlineRectangleCoverage(pixel: vec2<f32>, p: Primitive) -> f32 {
  // Quantized rows may move a finite edge across a pixel. Preserve the original
  // rectangle's empty support and full interior before estimating partial rows.
  let finite = rectangleCoverage(pixel, p);
  if finite == 0.0 || finite == 1.0 { return finite; }
  // Experimental analytic row quantization: endpoint Y uses quarter pixels;
  // each row's left/right intersections use sixteenth pixels. All math remains
  // on the GPU; no native rasterizer or per-fixture mask is consulted.
  let step = size.page / size.pixels;
  let half = p.box.zw * 0.5;
  let origin = floor(pixel);
  let signs = array<vec2<f32>, 4>(vec2<f32>(-0.5,-0.5), vec2<f32>(0.5,-0.5),
                                vec2<f32>(0.5,0.5), vec2<f32>(-0.5,0.5));
  var points: array<vec2<f32>, 4>;
  var cuts = array<f32, 6>(0.0, 1.0, 0.0, 0.0, 0.0, 0.0);
  for (var i = 0u; i < 4u; i++) {
    let local = signs[i] * p.box.zw * p.mirror.xy;
    let point = (p.box.xy + half + vec2<f32>(p.shape.z * local.x - p.shape.w * local.y,
                                             p.shape.w * local.x + p.shape.z * local.y)) / step;
    let endpoint = trunc(point * 256.0) / 256.0;
    points[i] = vec2<f32>(endpoint.x, floor(endpoint.y * 4.0 + 0.5) * 0.25) - origin;
    cuts[i + 2u] = clamp(points[i].y, 0.0, 1.0);
  }
  for (var i = 0u; i < 6u; i++) { for (var j = i + 1u; j < 6u; j++) {
    if cuts[j] < cuts[i] { let old = cuts[i]; cuts[i] = cuts[j]; cuts[j] = old; }
  } }
  var coverage = 0.0;
  for (var strip = 0u; strip < 5u; strip++) {
    let top = cuts[strip]; let bottom = cuts[strip + 1u];
    if top == bottom { continue; }
    let middle = (top + bottom) * 0.5;
    var ends: array<vec2<f32>, 2>;
    var count = 0u;
    for (var edge = 0u; edge < 4u; edge++) {
      let a = points[edge]; let b = points[(edge + 1u) % 4u];
      if min(a.y, b.y) < middle && middle < max(a.y, b.y) && count < 2u {
        let slope = (b.x - a.x) / (b.y - a.y);
        ends[count] = floor((a.x + slope * (vec2<f32>(top, bottom) - a.y)) * 16.0 + 0.5) / 16.0;
        count++;
      }
    }
    if count != 2u { continue; }
    if ends[0].x + ends[0].y > ends[1].x + ends[1].y {
      let old = ends[0]; ends[0] = ends[1]; ends[1] = old;
    }
    coverage += stripPixelArea(array<vec2<f32>, 4>(vec2<f32>(ends[0].x, top),
      vec2<f32>(ends[1].x, top), vec2<f32>(ends[1].y, bottom), vec2<f32>(ends[0].y, bottom)));
  }
  return clamp(coverage, 0.0, 1.0);
}
`;
const PRIMITIVE_FRAGMENT = /* wgsl */ `@fragment fn fragment(v: Vertex) -> @location(0) vec4<f32> {
  let p = ops[v.index];
  let scanlineRectangle = p.shape.y < 0.5 && p.shape.x == 0.0
    && abs(p.shape.z) > 0.00001 && abs(p.shape.w) > 0.00001;
  var coverage = 0.0;
  if p.shape.y < 0.5 && p.shape.x == 0.0 {
    if scanlineRectangle { coverage = scanlineRectangleCoverage(v.position.xy, p); }
    else { coverage = rectangleCoverage(v.position.xy, p); }
  } else {
    let step = size.page / size.pixels;
    let distance = curveDistance(localPoint(v.position.xy * step, p), p);
    let reach = length(step) * 0.5 + max(step.x, step.y) / 16.0;
    if distance <= -reach { coverage = 1.0; }
    else if distance < reach {
      for (var y = 0u; y < 8u; y++) { for (var x = 0u; x < 8u; x++) {
        let offset = (vec2<f32>(f32(x), f32(y)) + 0.5) / 8.0 - 0.5;
        if curveInside(localPoint((v.position.xy + offset) * step, p), p) { coverage += 1.0 / 64.0; }
      } }
    }
  }
  if scanlineRectangle {
    // Byte paint premultiplication precedes the byte coverage multiplication.
    let paint8 = floor(p.color * 255.0 + 0.5);
    let rgb8 = floor(paint8.rgb * (paint8.a / 255.0) + 0.5);
    let aa = min(255.0, floor(clamp(coverage, 0.0, 1.0) * 256.0));
    return floor(vec4<f32>(rgb8, paint8.a) * ((aa + 1.0) / 256.0)) / 255.0;
  }
  // Experimental opaque solid coverage: match byte-scaled source paint before
  // the RGBA8 attachment rounds it. Translucent paint keeps its existing path.
  if p.color.a == 1.0 {
    let aa = floor(clamp(coverage, 0.0, 1.0) * 255.0 + 0.5);
    let rgb8 = floor(floor(p.color.rgb * 255.0 + 0.5) * ((aa + 1.0) / 256.0));
    return vec4<f32>(rgb8 / 255.0, aa / 255.0);
  }
  let alpha = p.color.a * coverage;
  return vec4<f32>(p.color.rgb * alpha, alpha);
}
`;
/** Primitive coverage and source-over are GPU work. No SVG, DOM or CPU mask is uploaded. */
export const DESIGN_PAGE_SHADER = PRIMITIVE_HEAD + PRIMITIVE_VERTEX + PRIMITIVE_COVERAGE + PRIMITIVE_FRAGMENT;

/** A primitive's coverage at a pixel, chosen as the primitive pass chooses it, for passes that reuse an outline. */
const PRIMITIVE_SELECT = /* wgsl */ `
fn primitiveCoverage(position: vec2<f32>, p: Primitive) -> f32 {
  let scanlineRectangle = p.shape.y < 0.5 && p.shape.x == 0.0
    && abs(p.shape.z) > 0.00001 && abs(p.shape.w) > 0.00001;
  var coverage = 0.0;
  if p.shape.y < 0.5 && p.shape.x == 0.0 {
    if scanlineRectangle { coverage = scanlineRectangleCoverage(position, p); }
    else { coverage = rectangleCoverage(position, p); }
  } else {
    let step = size.page / size.pixels;
    let distance = curveDistance(localPoint(position * step, p), p);
    let reach = length(step) * 0.5 + max(step.x, step.y) / 16.0;
    if distance <= -reach { coverage = 1.0; }
    else if distance < reach {
      for (var y = 0u; y < 8u; y++) { for (var x = 0u; x < 8u; x++) {
        let offset = (vec2<f32>(f32(x), f32(y)) + 0.5) / 8.0 - 0.5;
        if curveInside(localPoint((position + offset) * step, p), p) { coverage += 1.0 / 64.0; }
      } }
    }
  }
  return coverage;
}
`;

/**
 * Gradients over a primitive's outline: the primitive's own coverage, coloured per pixel.
 * Each gradient carries its primitive's index, its kind (0 linear, 1 radial) and its stops, as
 * pairs of an offset and a straight sRGB colour with alpha.
 */
export const DESIGN_GRADIENT_SHADER = PRIMITIVE_HEAD + /* wgsl */ `struct Gradient { geometry: vec4<f32>, tile: vec4<f32>, info: vec4<u32> }
@group(0) @binding(2) var<storage, read> gradients: array<Gradient>;
@group(0) @binding(3) var<storage, read> stops: array<vec4<f32>>;
` + /* wgsl */ `@vertex fn vertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) index: u32) -> Vertex {
  let p = ops[gradients[index].info.x];
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
` + PRIMITIVE_COVERAGE + PRIMITIVE_SELECT + /* wgsl */ `// CSS repeats the gradient over its tile and interpolates premultiplied colour between
// the two stops either side; before the first stop and after the last the colour holds.
fn gradientColor(point: vec2<f32>, g: Gradient) -> vec4<f32> {
  let q = g.tile.xy + (point - g.tile.xy) - floor((point - g.tile.xy) / g.tile.zw) * g.tile.zw;
  var t = length((q - g.geometry.xy) / g.geometry.zw);
  if g.info.y == 0u {
    let d = g.geometry.zw - g.geometry.xy;
    t = dot(q - g.geometry.xy, d) / dot(d, d);
  }
  let first = g.info.z; let last = g.info.z + (g.info.w - 1u) * 2u;
  var lower = stops[first + 1u]; var upper = lower; var u = 0.0;
  if t >= stops[last].x { lower = stops[last + 1u]; upper = lower; }
  else if t > stops[first].x {
    for (var i = first; i < last; i += 2u) {
      let a = stops[i].x; let b = stops[i + 2u].x;
      if t < b { lower = stops[i + 1u]; upper = stops[i + 3u]; u = (t - a) / (b - a); break; }
    }
  }
  let premultiplied = mix(vec4<f32>(lower.rgb * lower.a, lower.a), vec4<f32>(upper.rgb * upper.a, upper.a), u);
  return premultiplied;
}
@fragment fn fragment(v: Vertex) -> @location(0) vec4<f32> {
  let g = gradients[v.index];
  let p = ops[g.info.x];
  var coverage = primitiveCoverage(v.position.xy, p);
  // The colour at the pixel centre, in the box's own frame before its pose.
  let step = size.page / size.pixels;
  let point = p.box.xy + p.box.zw * 0.5 + localPoint(v.position.xy * step, p);
  return gradientColor(point, g) * clamp(coverage, 0.0, 1.0);
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

/**
 * Filled outlines (paths and outlined words). A pixel's coverage is its area-weighted
 * winding number, summed exactly over the fill's straight edges: each edge adds the part
 * of the pixel row to its left, signed by its direction. Nonzero clamps that to one;
 * even-odd folds the winding back into zero to one. Edges arrive in output pixel coordinates.
 */
export const DESIGN_FILL_SHADER = /* wgsl */ `
struct Fill { bounds: vec4<f32>, color: vec4<f32>, range: vec4<u32> }
struct Size { page: vec2<f32>, pixels: vec2<f32> }
@group(0) @binding(0) var<storage, read> fills: array<Fill>;
@group(0) @binding(1) var<storage, read> edges: array<vec4<f32>>;
@group(0) @binding(2) var<uniform> size: Size;
struct Vertex { @builtin(position) position: vec4<f32>, @location(0) @interpolate(flat) index: u32 }
@vertex fn vertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) index: u32) -> Vertex {
  let f = fills[index];
  let pad = size.page / size.pixels;
  let corners = array<vec2<f32>, 6>(vec2<f32>(0,0), vec2<f32>(1,0), vec2<f32>(0,1),
                                  vec2<f32>(0,1), vec2<f32>(1,0), vec2<f32>(1,1));
  let point = mix(f.bounds.xy - pad, f.bounds.zw + pad, corners[vertex]);
  var result: Vertex;
  result.position = vec4<f32>(point.x / size.page.x * 2.0 - 1.0, 1.0 - point.y / size.page.y * 2.0, 0, 1);
  result.index = index;
  return result;
}
// The mean of clamp(t, 0, 1) as t runs linearly from u to v.
fn clampedMean(u: f32, v: f32) -> f32 {
  if abs(v - u) < 1e-6 { return clamp((u + v) * 0.5, 0.0, 1.0); }
  let cu = select(select(u - 0.5, u * u * 0.5, u < 1.0), 0.0, u < 0.0);
  let cv = select(select(v - 0.5, v * v * 0.5, v < 1.0), 0.0, v < 0.0);
  return (cv - cu) / (v - u);
}
@fragment fn fragment(v: Vertex) -> @location(0) vec4<f32> {
  let f = fills[v.index];
  let pixel = floor(v.position.xy);
  var winding = 0.0;
  for (var i = f.range.x; i < f.range.x + f.range.y; i++) {
    let e = edges[i];
    if e.y == e.w { continue; }
    let top = max(min(e.y, e.w), pixel.y);
    let bottom = min(max(e.y, e.w), pixel.y + 1.0);
    if top >= bottom { continue; }
    let slope = (e.z - e.x) / (e.w - e.y);
    let xTop = e.x + slope * (top - e.y) - pixel.x;
    let xBottom = e.x + slope * (bottom - e.y) - pixel.x;
    winding += select(-1.0, 1.0, e.w > e.y) * (bottom - top) * clampedMean(xTop, xBottom);
  }
  var coverage = min(abs(winding), 1.0);
  if f.range.z == 1u {
    let folded = abs(winding) - 2.0 * floor(abs(winding) * 0.5);
    coverage = select(folded, 2.0 - folded, folded > 1.0);
  }
  let alpha = f.color.a * clamp(coverage, 0.0, 1.0);
  return vec4<f32>(f.color.rgb * alpha, alpha);
}
`;

/** A clip outline bound as a primitive at `binding`, and its coverage at a pixel. */
const clipPart = (binding: number) => /* wgsl */ `
@group(0) @binding(${binding}) var<uniform> clip: Primitive;
fn clipCoverage(position: vec2<f32>) -> f32 { return primitiveCoverage(position, clip); }
`;

/** Bytes of one row clip uniform: bounds, the point count, then the points two to a vector. */
export const DESIGN_ROW_CLIP_BYTES = 32 + DESIGN_RASTER_MAX_CLIP_POINTS * 8;
/**
 * A row's clip polygon bound at `binding`, in output pixels, and its coverage at a pixel: the
 * pixel's area-weighted winding over the polygon's edges under the nonzero rule, summed as
 * the fill pass sums a fill's edges.
 */
const rowClipPart = (binding: number) => /* wgsl */ `
struct RowClip { bounds: vec4<f32>, count: vec4<u32>, points: array<vec4<f32>, ${DESIGN_RASTER_MAX_CLIP_POINTS / 2}> }
@group(0) @binding(${binding}) var<uniform> rowClip: RowClip;
fn rowClipPoint(i: u32) -> vec2<f32> {
  let pair = rowClip.points[i / 2u];
  return select(pair.xy, pair.zw, i % 2u == 1u);
}
fn rowClipMean(u: f32, v: f32) -> f32 {
  if abs(v - u) < 1e-6 { return clamp((u + v) * 0.5, 0.0, 1.0); }
  let cu = select(select(u - 0.5, u * u * 0.5, u < 1.0), 0.0, u < 0.0);
  let cv = select(select(v - 0.5, v * v * 0.5, v < 1.0), 0.0, v < 0.0);
  return (cv - cu) / (v - u);
}
fn rowClipCoverage(position: vec2<f32>) -> f32 {
  let pixel = floor(position);
  let b = rowClip.bounds;
  if pixel.x + 1.0 <= b.x || pixel.x >= b.z || pixel.y + 1.0 <= b.y || pixel.y >= b.w { return 0.0; }
  let n = rowClip.count.x;
  var winding = 0.0;
  for (var i = 0u; i < n; i++) {
    let a = rowClipPoint(i);
    let e = rowClipPoint(select(i + 1u, 0u, i + 1u == n));
    if a.y == e.y { continue; }
    let top = max(min(a.y, e.y), pixel.y);
    let bottom = min(max(a.y, e.y), pixel.y + 1.0);
    if top >= bottom { continue; }
    let slope = (e.x - a.x) / (e.y - a.y);
    winding += select(-1.0, 1.0, e.y > a.y) * (bottom - top)
      * rowClipMean(a.x + slope * (top - a.y) - pixel.x, a.x + slope * (bottom - a.y) - pixel.x);
  }
  return min(abs(winding), 1.0);
}
`;
/** A fragment whose coverage is multiplied by each named coverage just before `anchor`, which must occur once. */
function covered(fragment: string, anchor: string, factors: readonly string[]): string {
  const at = fragment.indexOf(anchor);
  if (at < 0 || fragment.indexOf(anchor, at + 1) >= 0) throw new Error(`The clip anchor does not occur exactly once: ${anchor}`);
  return `${fragment.slice(0, at)}${factors.map(f => `  coverage = coverage * ${f}(v.position.xy);\n`).join('')}${fragment.slice(at)}`;
}
const clipped = (fragment: string, anchor: string) => covered(fragment, anchor, ['clipCoverage']);
const PRIMITIVE_STRUCT = PRIMITIVE_HEAD.slice(PRIMITIVE_HEAD.indexOf('struct Primitive'), PRIMITIVE_HEAD.indexOf('struct Size'));
const PRIMITIVE_ANCHOR = '  if scanlineRectangle {\n    // Byte paint';
const FILL_ANCHOR = '  let alpha = f.color.a * clamp(coverage, 0.0, 1.0);';
const GRADIENT_ANCHOR = '  // The colour at the pixel centre';

/**
 * The same passes inside the frame's clip, as Chromium clips a board's children: each
 * draw's coverage times the clip outline's anti-aliased coverage. A page without a clip
 * keeps the shaders above.
 */
export const DESIGN_PAGE_CLIPPED_SHADER = PRIMITIVE_HEAD + PRIMITIVE_VERTEX + PRIMITIVE_COVERAGE + PRIMITIVE_SELECT + clipPart(2)
  + clipped(PRIMITIVE_FRAGMENT, PRIMITIVE_ANCHOR);
export const DESIGN_FILL_CLIPPED_SHADER = PRIMITIVE_STRUCT + clipped(DESIGN_FILL_SHADER, FILL_ANCHOR)
  + PRIMITIVE_COVERAGE + PRIMITIVE_SELECT + clipPart(3);
export const DESIGN_GRADIENT_CLIPPED_SHADER = clipped(DESIGN_GRADIENT_SHADER, GRADIENT_ANCHOR) + clipPart(4);

/**
 * The passes inside a row's clip polygon, as Chromium draws an element with
 * `clip-path: polygon()`: each draw's coverage times the polygon's. The bindings follow the
 * frame's clip when the row lies inside both.
 */
const ROW = ['rowClipCoverage'], BOTH = ['clipCoverage', 'rowClipCoverage'];
export const DESIGN_PAGE_ROW_CLIPPED_SHADER = PRIMITIVE_HEAD + PRIMITIVE_VERTEX + PRIMITIVE_COVERAGE + rowClipPart(2)
  + covered(PRIMITIVE_FRAGMENT, PRIMITIVE_ANCHOR, ROW);
export const DESIGN_FILL_ROW_CLIPPED_SHADER = covered(DESIGN_FILL_SHADER, FILL_ANCHOR, ROW) + rowClipPart(3);
export const DESIGN_GRADIENT_ROW_CLIPPED_SHADER = covered(DESIGN_GRADIENT_SHADER, GRADIENT_ANCHOR, ROW) + rowClipPart(4);
export const DESIGN_PAGE_BOTH_CLIPPED_SHADER = PRIMITIVE_HEAD + PRIMITIVE_VERTEX + PRIMITIVE_COVERAGE + PRIMITIVE_SELECT + clipPart(2) + rowClipPart(3)
  + covered(PRIMITIVE_FRAGMENT, PRIMITIVE_ANCHOR, BOTH);
export const DESIGN_FILL_BOTH_CLIPPED_SHADER = PRIMITIVE_STRUCT + covered(DESIGN_FILL_SHADER, FILL_ANCHOR, BOTH)
  + PRIMITIVE_COVERAGE + PRIMITIVE_SELECT + clipPart(3) + rowClipPart(4);
export const DESIGN_GRADIENT_BOTH_CLIPPED_SHADER = covered(DESIGN_GRADIENT_SHADER, GRADIENT_ANCHOR, BOTH) + clipPart(4) + rowClipPart(5);
