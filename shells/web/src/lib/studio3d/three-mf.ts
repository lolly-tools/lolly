// SPDX-License-Identifier: MPL-2.0
import * as THREE from 'three';
import { threeMfEntries } from '../three-mf.ts';

const CORE = 'http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const PRODUCTION = 'http://schemas.microsoft.com/3dmanufacturing/production/2015/06';
const units: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};
const children = (el: Element, name: string) =>
  Array.from(el.children).filter((n) => n.localName === name);
const child = (el: Element, name: string) => children(el, name)[0];

function pathOf(path: string, from = ''): string {
  const parts: string[] = [];
  const pathText = path.startsWith('/')
    ? path.slice(1)
    : from.slice(0, from.lastIndexOf('/') + 1) + path;
  for (const part of pathText.split('/')) {
    if (part === '..') {
      if (!parts.length) throw new Error('Invalid 3MF model path.');
      parts.pop();
    } else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

function transform(el: Element): THREE.Matrix4 {
  const text = el.getAttribute('transform');
  if (!text) return new THREE.Matrix4();
  const n = text.trim().split(/\s+/).map(Number);
  if (n.length !== 12 || !n.every(Number.isFinite)) throw new Error('Invalid 3MF transform.');
  return new THREE.Matrix4().set(
    n[0]!,
    n[3]!,
    n[6]!,
    n[9]!,
    n[1]!,
    n[4]!,
    n[7]!,
    n[10]!,
    n[2]!,
    n[5]!,
    n[8]!,
    n[11]!,
    0,
    0,
    0,
    1
  );
}

/** Core meshes and production components (including Bambu's separate object parts). */
export function loadThreeMf(bytes: Uint8Array): { object: THREE.Group; warnings: string[] } {
  const entries = threeMfEntries(bytes, true);
  const parse = (data: Uint8Array) => {
    const text = new TextDecoder().decode(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('3MF XML entities are not supported.');
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid 3MF XML.');
    return doc;
  };
  const rels = parse(entries['_rels/.rels']!);
  const rel = Array.from(rels.getElementsByTagNameNS('*', 'Relationship')).find((n) =>
    /\/3dmodel$/.test(n.getAttribute('Type') || '')
  );
  if (!rel || rel.getAttribute('TargetMode') === 'External')
    throw new Error('The 3MF model must be inside its package.');
  const rootPath = pathOf(rel.getAttribute('Target') || '');
  const docs = new Map<string, Element>();
  let triangles = 0;
  for (const [path, data] of Object.entries(entries)) {
    if (!/\.model$/i.test(path)) continue;
    const text = new TextDecoder().decode(data);
    triangles += (text.match(/<(?:[\w.-]+:)?triangle\s/g) || []).length;
    if (triangles > 1_000_000)
      throw new Error(
        'Simplify the 3MF to fewer than one million triangles for an interactive preview.'
      );
    const root = parse(data).documentElement;
    if (root.localName !== 'model' || root.namespaceURI !== CORE)
      throw new Error('Invalid 3MF model document.');
    if (!units[root.getAttribute('unit') || 'millimeter']) throw new Error('Unknown 3MF units.');
    docs.set(path, root);
  }
  const root = docs.get(rootPath);
  if (!root) throw new Error('The 3MF model relationship names a missing file.');
  const cache = new Map<string, THREE.Group>();
  const visiting = new Set<string>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const warnings = new Set<string>();
  const build = (path: string, id: string, depth = 0): THREE.Group => {
    const key = `${path}#${id}`;
    if (depth > 64 || visiting.has(key))
      throw new Error('The 3MF contains circular or overly nested components.');
    const hit = cache.get(key);
    if (hit) return hit.clone(true);
    const model = docs.get(path);
    const resources = model && child(model, 'resources');
    const object =
      resources && children(resources, 'object').find((n) => n.getAttribute('id') === id);
    if (!object || !model || !resources) throw new Error('The 3MF references a missing object.');
    visiting.add(key);
    const group = new THREE.Group();
    group.name = object.getAttribute('name') || `Object ${id}`;
    const mesh = child(object, 'mesh');
    if (mesh) {
      const vertices = child(mesh, 'vertices');
      const faces = child(mesh, 'triangles');
      if (!vertices || !faces) throw new Error('The 3MF mesh has no vertices or triangles.');
      const verts = children(vertices, 'vertex').map((v) =>
        ['x', 'y', 'z'].map((a) => (v.hasAttribute(a) ? Number(v.getAttribute(a)) : NaN))
      );
      if (!verts.every((v) => v.every(Number.isFinite))) throw new Error('Invalid 3MF vertex.');
      const positions: number[] = [],
        colors: number[] = [];
      let colored = false;
      for (const face of children(faces, 'triangle')) {
        const pid = face.getAttribute('pid') ?? object.getAttribute('pid');
        const palette =
          pid && Array.from(resources.children).find((n) => n.getAttribute('id') === pid);
        for (let corner = 1; corner <= 3; corner++) {
          const indexText = face.getAttribute(`v${corner}`);
          const index = Number(indexText);
          if (indexText === null || !Number.isInteger(index) || !verts[index])
            throw new Error('Invalid 3MF triangle index.');
          positions.push(...verts[index]!);
          const prop = Number(
            face.getAttribute(`p${corner}`) ??
              face.getAttribute('p1') ??
              object.getAttribute('pindex') ??
              '0'
          );
          const entry = palette ? palette.children[prop] : undefined;
          const colorText =
            entry && (entry.getAttribute('displaycolor') || entry.getAttribute('color'));
          const color = new THREE.Color(colorText?.slice(0, 7) || '#b0b8b0');
          if (colorText) colored = true;
          colors.push(color.r, color.g, color.b);
          if (palette && !['basematerials', 'colorgroup'].includes(palette.localName))
            warnings.add('Some 3MF material properties are not supported in this preview.');
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometries.add(geometry);
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      if (colored) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshStandardMaterial({
        color: colored ? '#ffffff' : '#b0b8b0',
        vertexColors: colored,
        roughness: 0.55,
      });
      material.name = group.name;
      materials.add(material);
      group.add(new THREE.Mesh(geometry, material));
    }
    const components = child(object, 'components');
    if (components)
      for (const part of children(components, 'component')) {
        const reference = part.getAttributeNS(PRODUCTION, 'path');
        const targetPath = reference ? pathOf(reference, path) : path;
        const nested = build(targetPath, part.getAttribute('objectid') || '', depth + 1);
        const target = docs.get(targetPath)!;
        nested.scale.multiplyScalar(
          units[target.getAttribute('unit') || 'millimeter']! /
            units[model.getAttribute('unit') || 'millimeter']!
        );
        nested.applyMatrix4(transform(part));
        group.add(nested);
      }
    let triangleCount = 0;
    group.traverse((node) => {
      if (node instanceof THREE.Mesh)
        triangleCount += node.geometry.getAttribute('position').count / 3;
    });
    if (triangleCount > 1_000_000)
      throw new Error(
        'Simplify the 3MF to fewer than one million triangles for an interactive preview.'
      );
    if (!group.children.length) throw new Error('The 3MF object has no renderable mesh.');
    visiting.delete(key);
    cache.set(key, group);
    return group.clone(true);
  };
  try {
    const result = new THREE.Group();
    const buildSection = child(root, 'build');
    if (!buildSection) throw new Error('The 3MF has no build section.');
    for (const item of children(buildSection, 'item')) {
      const reference = item.getAttributeNS(PRODUCTION, 'path');
      const path = reference ? pathOf(reference, rootPath) : rootPath;
      const object = build(path, item.getAttribute('objectid') || '');
      const model = docs.get(path)!;
      object.scale.multiplyScalar(
        units[model.getAttribute('unit') || 'millimeter']! /
          units[root.getAttribute('unit') || 'millimeter']!
      );
      object.applyMatrix4(transform(item));
      result.add(object);
      let count = 0;
      result.traverse((node) => {
        if (node instanceof THREE.Mesh) count += node.geometry.getAttribute('position').count / 3;
      });
      if (count > 1_000_000)
        throw new Error(
          'Simplify the 3MF to fewer than one million triangles for an interactive preview.'
        );
    }
    result.scale.setScalar(units[root.getAttribute('unit') || 'millimeter']!);
    result.rotation.x = -Math.PI / 2;
    warnings.add(
      '3MF dimensions are in millimeters. Slicer settings and painted filament assignments are not applied in this visual preview.'
    );
    return { object: result, warnings: [...warnings] };
  } catch (error) {
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    throw error;
  }
}
