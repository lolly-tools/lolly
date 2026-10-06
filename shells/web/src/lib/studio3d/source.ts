// SPDX-License-Identifier: MPL-2.0
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREE_MF_UPLOAD_LIMIT } from '../three-mf.ts';
import { loadThreeMf } from './three-mf.ts';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { extrudeStudioShape, studioChordTolerance } from './geometry.ts';
import { makeGeomApi } from '../../../../../engine/src/geom-api.ts';
import type {
  StudioSceneV1,
  StudioSourceInfo,
} from '../../../../../packages/core/src/studio3d-v1.ts';

export interface StudioAsset {
  object: THREE.Group;
  info: StudioSourceInfo;
  originals: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  dispose(): void;
}
export type StudioRead = (url: string, signal: AbortSignal) => Promise<Uint8Array>;
/** The output a load builds geometry for: the longest side of the frame, in pixels. */
export interface StudioDetailTarget {
  pixels: number;
}
/** The frame a mount previews in, which mount.ts caps at this many pixels on the long side. */
export const STUDIO_PREVIEW_PIXELS = 800;
/** One shaped line: an SVG path with the baseline at y=0, plus its advance, at `fontSize` px. */
export type StudioShaper = (
  line: string,
  font: NonNullable<StudioSceneV1['source']['text']>,
  fontSize: number,
  signal: AbortSignal
) => Promise<{ d: string; advance: number }>;

/** Words become one filled SVG: each line shaped by the host, stacked and aligned, then extruded like artwork. */
export async function studioTextSvg(
  spec: NonNullable<StudioSceneV1['source']['text']>,
  color: string,
  shaper: StudioShaper,
  signal: AbortSignal
): Promise<string> {
  const size = 100;
  const lines = spec.text.split('\n');
  if (lines.length > 8) throw new Error('Set up to eight lines of words.');
  const shaped: { d: string; advance: number }[] = [];
  for (const line of lines) {
    shaped.push(line ? await shaper(line, spec, size, signal) : { d: '', advance: 0 });
    signal.throwIfAborted();
  }
  const widest = Math.max(...shaped.map((line) => line.advance), 1);
  const paths = shaped.map((line, i) => {
    if (!line.d) return '';
    const dx =
      spec.align === 'left'
        ? 0
        : spec.align === 'right'
          ? widest - line.advance
          : (widest - line.advance) / 2;
    const dy = size * 0.8 + i * size * spec.lineHeight;
    return `<path fill="${color}" transform="translate(${dx.toFixed(3)} ${dy.toFixed(3)})" d="${line.d}"/>`;
  });
  if (!paths.some(Boolean)) throw new Error('The words have no visible letters in this font.');
  return `<svg xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`;
}

/**
 * A placed copy of a loaded source. Geometry and textures stay owned by the shared asset;
 * the copy owns only its transform and its material assignments, which it restores on dispose.
 */
export function instantiateStudioAsset(asset: StudioAsset): StudioAsset {
  const object = asset.object.clone(true);
  const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) originals.set(node, node.material);
  });
  return {
    object,
    originals,
    info: asset.info,
    dispose: () => {
      for (const [mesh, material] of originals) mesh.material = material;
      object.removeFromParent();
    },
  };
}
const geom = makeGeomApi();
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_TRIANGLES = 1_000_000;
const ALLOWED = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'line',
  'defs',
  'style',
  'title',
  'desc',
  'metadata',
]);

function pathData(path: THREE.Path): string {
  let d = '';
  for (const curve of path.curves) {
    const start = curve.getPoint(0);
    if (!d) d = `M${start.x} ${start.y}`;
    if (curve instanceof THREE.LineCurve) d += `L${curve.v2.x} ${curve.v2.y}`;
    else if (curve instanceof THREE.CubicBezierCurve)
      d += `C${curve.v1.x} ${curve.v1.y} ${curve.v2.x} ${curve.v2.y} ${curve.v3.x} ${curve.v3.y}`;
    else if (curve instanceof THREE.QuadraticBezierCurve)
      d += `Q${curve.v1.x} ${curve.v1.y} ${curve.v2.x} ${curve.v2.y}`;
    else if (curve instanceof THREE.EllipseCurve) {
      let delta = curve.aEndAngle - curve.aStartAngle;
      if (Math.abs(delta) >= Math.PI * 2 - 1e-9)
        delta = curve.aClockwise ? -Math.PI * 2 : Math.PI * 2;
      else if (curve.aClockwise && delta > 0) delta -= Math.PI * 2;
      else if (!curve.aClockwise && delta < 0) delta += Math.PI * 2;
      const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)));
      const c = Math.cos(curve.aRotation),
        s = Math.sin(curve.aRotation);
      const point = (a: number, tangent = false): [number, number] => {
        const x = (tangent ? -Math.sin(a) : Math.cos(a)) * curve.xRadius;
        const y = (tangent ? Math.cos(a) : Math.sin(a)) * curve.yRadius;
        return [x * c - y * s + (tangent ? 0 : curve.aX), x * s + y * c + (tangent ? 0 : curve.aY)];
      };
      for (let i = 0; i < segments; i++) {
        const a = curve.aStartAngle + (delta * i) / segments,
          b = a + delta / segments;
        const p = point(a),
          q = point(b),
          t = point(a, true),
          u = point(b, true),
          k = (4 / 3) * Math.tan((b - a) / 4);
        d += `C${p[0] + k * t[0]} ${p[1] + k * t[1]} ${q[0] - k * u[0]} ${q[1] - k * u[1]} ${q[0]} ${q[1]}`;
      }
    } else throw new Error('This SVG contains a curve the studio cannot extrude.');
  }
  return d + (path.autoClose ? 'Z' : '');
}

function answer(result: ReturnType<typeof geom.selfUnion>): string {
  if (!result.ok) throw new Error(`Artwork preparation failed: ${result.message}`);
  return result.d;
}

/** Preserve paint order before extrusion so overlapping paths do not fight for depth. */
export function prepareStudioSvg(text: string): { svg: string; slots: StudioSourceInfo['slots'] } {
  if (text.length > 1_000_000 || /<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('Use an SVG smaller than 1 MB without external entities.');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
    throw new Error('The artwork is not a valid SVG.');
  for (const metadata of doc.querySelectorAll('metadata')) metadata.remove();
  let nodes = 0;
  for (const el of doc.querySelectorAll('*')) {
    if (++nodes > 512)
      throw new Error('This SVG has too many elements. Simplify it before extrusion.');
    if (!ALLOWED.has(el.localName))
      throw new Error(`Convert SVG ${el.localName} content to plain paths before extrusion.`);
    for (const attr of el.attributes) {
      if (
        /^(on|href|filter|mask|clip-path|marker|display|visibility|paint-order|vector-effect|stroke-dash)/i.test(
          attr.name
        ) ||
        /url\s*\(/i.test(attr.value)
      )
        throw new Error(
          'Use plain SVG fills and strokes without linked content, masks, filters or dashed strokes.'
        );
    }
    const css = el.localName === 'style' ? el.textContent || '' : el.getAttribute('style') || '';
    if (
      /@|url\s*\(|(?:filter|mask|clip-path|display|visibility|opacity|paint-order|vector-effect|stroke-dasharray|stroke-dashoffset)\s*:/i.test(
        css
      )
    )
      throw new Error(
        'This SVG stylesheet uses unsupported appearance rules. Convert it to plain paths.'
      );
  }
  const loader = new SVGLoader(),
    parsed = loader.parse(new XMLSerializer().serializeToString(doc));
  if (parsed.paths.length > 128) throw new Error('Use artwork with at most 128 paths.');
  const curves = parsed.paths.reduce(
    (count, path) => count + path.subPaths.reduce((n, subpath) => n + subpath.curves.length, 0),
    0
  );
  if (curves > 2048)
    throw new Error('Simplify this SVG to fewer than 2048 curve segments before extrusion.');
  const paints = new Map<string, string>();
  let work = 0;
  const paint = (d: string, c: string, fillRule: 'nonzero' | 'evenodd') => {
    const normalized = answer(geom.selfUnion(d, { fillRule, decimals: 7 }));
    if (!normalized) return;
    if (++work > 256) throw new Error('This artwork exceeds the studio geometry budget.');
    for (const [key, previous] of paints)
      if (key !== c && previous)
        paints.set(key, answer(geom.difference([previous, normalized], { decimals: 7 })));
    paints.set(
      c,
      paints.get(c) ? answer(geom.union([paints.get(c)!, normalized], { decimals: 7 })) : normalized
    );
    if (paints.size > 16) throw new Error('Use artwork with at most 16 solid colours.');
  };
  for (const path of parsed.paths) {
    const style = path.userData?.style as Record<string, unknown>;
    if (!style) throw new Error('The SVG paint could not be read.');
    for (const property of ['opacity', 'fillOpacity', 'strokeOpacity'])
      if (style[property] !== undefined && Number(style[property]) !== 1)
        throw new Error('Flatten translucent SVG artwork before extrusion.');
    const d = path.subPaths.map(pathData).join(' ');
    const rule = style.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
    if (style.fill !== 'none') paint(d, '#' + path.color.getHexString(), rule);
    if (style.stroke && style.stroke !== 'none') {
      if (doc.querySelector('[transform]'))
        throw new Error('Convert transformed SVG strokes to filled paths before extrusion.');
      const strokeColor = new THREE.Color(String(style.stroke));
      const outline = geom.stroke(d, Number(style.strokeWidth || 1), {
        join:
          style.strokeLineJoin === 'round'
            ? 'round'
            : style.strokeLineJoin === 'bevel'
              ? 'bevel'
              : 'miter',
        cap:
          style.strokeLineCap === 'round'
            ? 'round'
            : style.strokeLineCap === 'square'
              ? 'square'
              : 'butt',
        miterLimit: Number(style.strokeMiterLimit || 4),
        decimals: 7,
      });
      paint(answer(outline), '#' + strokeColor.getHexString(), 'nonzero');
    }
  }
  const slots = [...paints]
    .filter(([, d]) => d)
    .map(([c], i) => ({ id: `paint:${c}`, label: `${i + 1}: ${c}`, color: c }));
  if (!slots.length) throw new Error('The SVG has no visible solid paths.');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">${slots.map((slot) => `<path fill="${slot.color}" d="${paints.get(slot.color)}"/>`).join('')}</svg>`;
  return { svg, slots };
}

function svgObject(
  text: string,
  scene: StudioSceneV1,
  pixels: number
): { object: THREE.Group; info: StudioSourceInfo } {
  const prepared = prepareStudioSvg(text),
    paths = new SVGLoader().parse(prepared.svg).paths;
  const bounds = paths.map((path) => geom.bounds(path.subPaths.map(pathData).join(' ')));
  const boxes = bounds.flatMap((b) => (b.ok && b.value ? [b.value] : []));
  const span = Math.max(
    Math.max(...boxes.map((b) => b.x1)) - Math.min(...boxes.map((b) => b.x0)),
    Math.max(...boxes.map((b) => b.y1)) - Math.min(...boxes.map((b) => b.y0))
  );
  if (!Number.isFinite(span) || span < 1e-6) throw new Error('The artwork has no measurable area.');
  const scale = 3.25 / span,
    bevel = scene.shape.bevel / scale;
  // Curve detail that follows the output is measured in the artwork's own units, so every
  // shape in this file is flattened finely enough for the frame it will be drawn in.
  const tolerance = scene.shape.detail === 'auto' ? studioChordTolerance(pixels, span) : undefined;
  const object = new THREE.Group();
  const warnings: string[] = [];
  try {
    for (const [index, path] of paths.entries()) {
      const material = new THREE.MeshPhysicalMaterial({ color: path.color, roughness: 0.4 });
      material.name = prepared.slots[index]!.id;
      for (const shape of path.toShapes()) {
        const result = extrudeStudioShape(
          shape,
          scene.shape.depth / scale,
          bevel,
          scene.shape.smoothness,
          tolerance
        );
        if (result.bevel < bevel - 1e-8) {
          const message = `${material.name}: bevel reduced from ${scene.shape.bevel.toPrecision(3)} to ${(result.bevel * scale).toPrecision(3)} studio units to preserve narrow details. Reduce the requested bevel or widen the source detail for a stronger edge.`;
          if (!warnings.includes(message)) warnings.push(message);
        }
        const mesh = new THREE.Mesh(result.geometry, [material, material, material]);
        mesh.userData.studioSurfaces = true;
        object.add(mesh);
      }
    }
    object.scale.set(scale, -scale, scale);
    return { object, info: { slots: prepared.slots, triangles: 0, warnings } };
  } catch (error) {
    disposeObject(object);
    throw error;
  }
}

function disposeObject(object: THREE.Object3D): void {
  const materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    for (const material of Array.isArray(node.material) ? node.material : [node.material])
      materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material))
      if (value instanceof THREE.Texture) textures.add(value);
    material.dispose();
  }
  for (const texture of textures) {
    const image = texture.image as { close?: () => void } | undefined;
    image?.close?.();
    texture.dispose();
  }
}

/**
 * An STL whose facet normals are all zero, or that carries none, renders black: the file
 * gives the shading nothing to work with, and three's loader keeps what the file says. The
 * studio computes the normals from the triangles instead. STL is a facet format and the
 * loader builds one unshared triangle per facet, so the computed normals are flat, one per
 * facet, which is what the file describes. True when the studio had to compute them.
 */
function computeStlNormals(geometry: THREE.BufferGeometry): boolean {
  const normals = geometry.getAttribute('normal');
  if (normals)
    for (let i = 0; i < normals.count; i++)
      if (normals.getX(i) || normals.getY(i) || normals.getZ(i)) return false;
  geometry.computeVertexNormals();
  return true;
}

function inspectGlb(bytes: Uint8Array): void {
  if (bytes.byteLength < 20) throw new Error('The GLB file is incomplete.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.length ||
    view.getUint32(16, true) !== 0x4e4f534a
  )
    throw new Error('Use a self-contained glTF 2.0 binary (.glb) model.');
  const length = view.getUint32(12, true);
  if (length > 2_000_000 || length + 20 > bytes.length)
    throw new Error('The GLB manifest is invalid or too large.');
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))) as {
    buffers?: { uri?: string }[];
    images?: { uri?: string }[];
    extensionsRequired?: string[];
  };
  for (const item of [...(json.buffers || []), ...(json.images || [])])
    if (item.uri && !item.uri.startsWith('data:'))
      throw new Error(
        'This GLB links external files. Embed its textures and buffers before importing.'
      );
  if (
    json.extensionsRequired?.some((e) =>
      ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(e)
    )
  )
    throw new Error('Export this model without Draco, Meshopt or KTX2 compression.');
}

export async function loadStudioSource(
  scene: StudioSceneV1,
  read: StudioRead,
  signal: AbortSignal,
  shaper?: StudioShaper,
  target?: StudioDetailTarget
): Promise<StudioAsset> {
  let raw = new THREE.Group();
  let info: StudioSourceInfo = { slots: [], triangles: 0, warnings: [] };
  // Without a target the geometry is built for the studio's own preview frame.
  const pixels = target?.pixels ?? STUDIO_PREVIEW_PIXELS;
  try {
    if (scene.source.kind === 'text') {
      if (!scene.source.text?.text) throw new Error('Type the words to set.');
      if (!shaper) throw new Error('This app cannot outline text; open the studio in the web app.');
      const svg = await studioTextSvg(scene.source.text, scene.materials.colorA, shaper, signal);
      signal.throwIfAborted();
      ({ object: raw, info } = svgObject(svg, scene, pixels));
      info.slots = [{ id: 'paint:words', label: '1: words', color: scene.materials.colorA }];
      // Letters are thin next to the whole word, so a long word or a large bevel gets
      // trimmed. One plain note replaces the per-colour report artwork gets.
      if (info.warnings.some((warning) => /bevel reduced/.test(warning)))
        info.warnings = [
          ...info.warnings.filter((warning) => !/bevel reduced/.test(warning)),
          'Words: the letters take a finer bevel than requested so their counters keep their shape. Reduce Bevel under Shape to silence this, or raise Depth for a chunkier edge.',
        ];
      for (const mesh of raw.children)
        if (mesh instanceof THREE.Mesh)
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
            material.name = 'paint:words';
    } else if (scene.source.kind === 'primitive') {
      if (scene.source.primitive === 'badge') {
        const example = `<svg xmlns="http://www.w3.org/2000/svg"><path fill="${scene.materials.colorA}" d="M20 0a20 20 0 1 1 0 40a20 20 0 1 1 0-40M20 5a15 15 0 1 0 0 30a15 15 0 1 0 0-30"/><path fill="${scene.materials.colorB}" d="M21 9L12 23h7v9l9-15h-7z"/></svg>`;
        ({ object: raw, info } = svgObject(example, scene, pixels));
      } else {
        const geometry =
          scene.source.primitive === 'sphere'
            ? new THREE.SphereGeometry(1.6, 64, 48)
            : scene.source.primitive === 'torus'
              ? new THREE.TorusGeometry(1.15, 0.45, 32, 96)
              : new THREE.BoxGeometry(2.4, 2.4, 2.4);
        const material = new THREE.MeshPhysicalMaterial({
          color: scene.materials.colorA,
          roughness: 0.4,
        });
        material.name = 'surface';
        raw.add(new THREE.Mesh(geometry, material));
      }
    } else {
      const bytes = await read(scene.source.url, signal);
      signal.throwIfAborted();
      if (
        !bytes.length ||
        bytes.length > (scene.source.kind === '3mf' ? THREE_MF_UPLOAD_LIMIT : MAX_BYTES)
      )
        throw new Error(
          scene.source.kind === '3mf'
            ? 'Use a 3MF file between 1 byte and 128 MB.'
            : 'Use a source file between 1 byte and 32 MB.'
        );
      if (scene.source.kind === 'svg')
        ({ object: raw, info } = svgObject(new TextDecoder().decode(bytes), scene, pixels));
      else if (scene.source.kind === '3mf') {
        const model = loadThreeMf(bytes);
        raw.add(model.object);
        info.warnings.push(...model.warnings);
      } else if (scene.source.kind === 'stl') {
        const geometry = new STLLoader().parse(bytes.slice().buffer);
        const material = new THREE.MeshPhysicalMaterial({
          color: scene.materials.colorA,
          roughness: 0.45,
        });
        material.name = 'surface';
        raw.add(new THREE.Mesh(geometry, material));
        info.warnings.push(
          'STL has no standard units or materials. This is a visual preview; print dimensions are not inferred.'
        );
        if (computeStlNormals(geometry))
          info.warnings.push(
            'This STL carried no facet normals; the studio computed them from the triangles.'
          );
      } else {
        inspectGlb(bytes);
        const manager = new THREE.LoadingManager();
        manager.setURLModifier((url) => {
          if (!/^(data:|blob:)/.test(url))
            throw new Error('External model resources are not supported.');
          return url;
        });
        const gltf = await new GLTFLoader(manager).parseAsync(bytes.slice().buffer, '');
        raw.add(gltf.scene);
        if (gltf.animations.length)
          info.warnings.push(
            'The studio uses the model pose at import. Baked animation clips are not played.'
          );
      }
    }
    signal.throwIfAborted();
    const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>(),
      slots = new Map<string, StudioSourceInfo['slots'][number]>();
    const named = new Map<string, THREE.Material>();
    raw.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const position = node.geometry.getAttribute('position');
      if (!position?.count) throw new Error('The model contains an empty mesh.');
      info.triangles += (node.geometry.index?.count || position.count) / 3;
      if (info.triangles > MAX_TRIANGLES)
        throw new Error('Simplify the model to fewer than one million triangles.');
      for (let i = 0; i < position.count; i++)
        if (![position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite))
          throw new Error(
            'The geometry contains invalid coordinates. Reduce the bevel or repair the source.'
          );
      node.castShadow = true;
      node.receiveShadow = true;
      originals.set(node, node.material);
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        let id = material.name || `material-${slots.size + 1}`;
        const base = id;
        for (let suffix = 2; named.has(id) && named.get(id) !== material; suffix++)
          id = `${base}-${suffix}`;
        material.name = id;
        named.set(id, material);
        const c =
          material instanceof THREE.MeshStandardMaterial
            ? '#' + material.color.getHexString()
            : '#ffffff';
        slots.set(id, { id, label: id, color: c });
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) {
            const image = value.image as { width?: number; height?: number };
            if ((image?.width || 0) > 8192 || (image?.height || 0) > 8192)
              throw new Error('Reduce model textures to 8192 pixels or less.');
          }
      }
    });
    if (!info.triangles) throw new Error('The source has no renderable mesh.');
    if (!info.slots.length) info.slots = [...slots.values()];
    const bounds = new THREE.Box3().setFromObject(raw),
      size = bounds.getSize(new THREE.Vector3()),
      span = Math.max(size.x, size.y, size.z);
    if (!Number.isFinite(span) || span < 1e-9) throw new Error('The model has no measurable size.');
    // What the file itself measures, kept before the longest side is scaled to 3.25. Only a
    // model file has units of its own to report: artwork, words and the built-in shapes are
    // drawn to fit, so a size in their own space would mean nothing to the reader.
    if (scene.source.kind === 'glb' || scene.source.kind === 'stl' || scene.source.kind === '3mf') {
      info.bounds = { x: size.x, y: size.y, z: size.z, span };
      const units = (value: number) => Math.round(value * 100) / 100;
      info.warnings.push(
        `Model spans ${units(size.x)} by ${units(size.y)} by ${units(size.z)} ${scene.source.kind === '3mf' ? 'millimeters' : 'units'} in its file; shown at 3.25 studio units.`
      );
    }
    if (
      scene.source.kind !== 'svg' &&
      !(scene.source.kind === 'primitive' && scene.source.primitive === 'badge')
    )
      raw.scale.multiplyScalar(3.25 / span);
    const centered = new THREE.Box3().setFromObject(raw).getCenter(new THREE.Vector3());
    raw.position.sub(centered);
    const object = new THREE.Group();
    object.add(raw);
    return {
      object,
      originals,
      info,
      dispose: () => {
        for (const [mesh, material] of originals) mesh.material = material;
        disposeObject(object);
      },
    };
  } catch (error) {
    disposeObject(raw);
    throw error;
  }
}
