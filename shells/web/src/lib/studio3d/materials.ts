// SPDX-License-Identifier: MPL-2.0
import * as THREE from 'three';
import { studioFinish } from '../../../../../engine/src/studio3d.ts';
import type {
  StudioFinishSpec,
  StudioSceneV1,
} from '../../../../../packages/core/src/studio3d-v1.ts';
import type { StudioAsset } from './source.ts';

/** Glass over a transparent output has nothing to see through, so it shows as solid crystal. */
export function cutoutFinish(
  spec: StudioFinishSpec,
  output: StudioSceneV1['stage']['output']
): StudioFinishSpec {
  if (!spec.transmission || output === 'scene') return spec;
  return {
    ...spec,
    transmission: 0,
    thickness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    roughness: Math.max(0.08, spec.roughness),
    metalness: 0.1,
  };
}

/** True when any finish in play is self-lit, so the capture draws its halo. */
export function studioHasEmissive(scene: StudioSceneV1): boolean {
  const finishes = [
    scene.materials.finishA,
    scene.materials.finishB,
    ...Object.values(scene.materials.surfaces?.a ?? {}),
    ...Object.values(scene.materials.surfaces?.b ?? {}),
    ...scene.materials.overrides.map((o) => o.finish),
  ];
  return finishes.some((f) => f && f !== 'inherit' && (studioFinish(f).emissive ?? 0) > 0);
}

/** True when any finish in play lets light through, which a transparent output cannot show. */
export function studioHasTransmission(scene: StudioSceneV1): boolean {
  const finishes = [
    scene.materials.finishA,
    scene.materials.finishB,
    ...Object.values(scene.materials.surfaces?.a ?? {}),
    ...Object.values(scene.materials.surfaces?.b ?? {}),
    ...scene.materials.overrides.map((o) => o.finish),
  ];
  return finishes.some((f) => f && f !== 'inherit' && (studioFinish(f).transmission ?? 0) > 0);
}

/** Write a finish onto a physical material; members a finish leaves out fall back to plain. */
export function applyFinish(physical: THREE.MeshPhysicalMaterial, spec: StudioFinishSpec): void {
  physical.roughness = spec.roughness;
  physical.metalness = spec.metalness;
  physical.clearcoat = spec.clearcoat;
  physical.clearcoatRoughness = spec.clearcoatRoughness ?? 0.05;
  physical.transmission = spec.transmission ?? 0;
  physical.ior = spec.ior ?? 1.5;
  physical.thickness = spec.thickness ?? 0;
  physical.sheen = spec.sheen ?? 0;
  physical.sheenRoughness = spec.sheenRoughness ?? 1;
  physical.sheenColor.copy(physical.color).lerp(new THREE.Color('#ffffff'), 0.5);
  physical.iridescence = spec.iridescence ?? 0;
  physical.iridescenceIOR = spec.iridescenceIOR ?? 1.3;
  if (spec.emissive) {
    physical.emissive.copy(physical.color);
    physical.emissiveIntensity = spec.emissive;
  } else {
    physical.emissive.set('#000000');
    physical.emissiveIntensity = 1;
  }
  // Glass and frosted bodies keep their alpha solid: transmission is light through a
  // surface that still exists, so a cutout export holds the object, not a hole.
  physical.transparent = false;
  physical.opacity = 1;
}

export function applyStudioMaterials(asset: StudioAsset, scene: StudioSceneV1): () => void {
  const changed = new Set<THREE.Material>();
  const slots = asset.info.slots;
  const overrides = scene.materials.overrides;
  const selected = new Set<number>();
  const bindings = scene.materials.bindings;
  const explicit = scene.materials.mode === 'pair' && !!(bindings?.a || bindings?.b);
  const roles = new Map<number, 'a' | 'b'>();
  if (explicit)
    for (const role of ['a', 'b'] as const) {
      const name = bindings?.[role];
      if (!name) continue;
      const index = slots.findIndex((slot, i) => slot.id === name || String(i + 1) === name);
      if (index < 0)
        throw new Error(`Material role ${role.toUpperCase()} names missing slot ${name}.`);
      if (roles.has(index)) throw new Error('Material roles A and B must name different slots.');
      roles.set(index, role);
    }
  if (scene.materials.mode === 'custom')
    for (const override of overrides) {
      const index = slots.findIndex(
        (slot, i) => slot.id === override.slot || String(i + 1) === override.slot
      );
      if (index < 0)
        throw new Error(`Material slot ${override.slot} does not exist in this object.`);
      if (selected.has(index))
        throw new Error(`Material slot ${override.slot} has more than one override.`);
      selected.add(index);
    }
  const cache = new Map<string, THREE.Material>();
  const alter = (original: THREE.Material, surface?: 'face' | 'bevel' | 'side'): THREE.Material => {
    const key = `${original.uuid}:${surface || ''}`;
    if (cache.has(key)) return cache.get(key)!;
    const index = Math.max(
      0,
      slots.findIndex((slot) => slot.id === original.name)
    );
    const override =
      scene.materials.mode === 'custom'
        ? overrides.find((o) => o.slot === original.name || o.slot === String(index + 1))
        : undefined;
    if (explicit && !roles.has(index)) return original;
    if (
      (scene.source.kind === 'glb' || scene.source.kind === '3mf') &&
      (scene.materials.mode === 'source' || (scene.materials.mode === 'custom' && !override))
    )
      return original;
    const physical =
      original instanceof THREE.MeshPhysicalMaterial
        ? original.clone()
        : new THREE.MeshPhysicalMaterial();
    if (
      original instanceof THREE.MeshStandardMaterial &&
      !(original instanceof THREE.MeshPhysicalMaterial)
    ) {
      physical.color.copy(original.color);
      physical.map = original.map;
      physical.normalMap = original.normalMap;
      physical.roughnessMap = original.roughnessMap;
      physical.metalnessMap = original.metalnessMap;
      physical.aoMap = original.aoMap;
      physical.emissive.copy(original.emissive);
      physical.emissiveMap = original.emissiveMap;
      physical.roughness = original.roughness;
      physical.metalness = original.metalness;
      physical.side = original.side;
      physical.transparent = original.transparent;
      physical.opacity = original.opacity;
      physical.alphaMap = original.alphaMap;
      physical.alphaTest = original.alphaTest;
      physical.normalScale.copy(original.normalScale);
    }
    physical.vertexColors = original instanceof THREE.MeshStandardMaterial && original.vertexColors;
    physical.name = original.name;
    // Words and STL models keep the colour A they were loaded with, and a colour edit does
    // not load them again, so the current colour A is set here. Finishes below copy it
    // into the sheen and the glow.
    if (
      (scene.source.kind === 'text' && original.name === 'paint:words') ||
      (scene.source.kind === 'stl' && original.name === 'surface')
    )
      physical.color.set(scene.materials.colorA);
    const useB = explicit ? roles.get(index) === 'b' : index % 2 !== 0;
    if (scene.materials.mode === 'pair') {
      physical.vertexColors = false;
      physical.color.set(useB ? scene.materials.colorB : scene.materials.colorA);
      physical.map = null;
      physical.roughnessMap = null;
      physical.metalnessMap = null;
    }
    const finish = studioFinish(useB ? scene.materials.finishB : scene.materials.finishA);
    // A finish replaces the whole physical description on materials the studio owns and in
    // colour-pair mode; a GLB's authored material under a numeric override keeps its own
    // transmission, sheen and the rest and takes only the finish's three numbers.
    if (scene.materials.mode === 'pair' || scene.source.kind !== 'glb')
      applyFinish(physical, cutoutFinish(finish, scene.stage.output));
    else {
      physical.roughness = finish.roughness;
      physical.metalness = finish.metalness;
      physical.clearcoat = finish.clearcoat;
    }
    if (override) {
      physical.vertexColors = false;
      physical.color.set(override.color);
      physical.map = null;
      physical.roughnessMap = null;
      physical.metalnessMap = null;
      // The numbers alone leave the source's other physical features (a GLB's own
      // transmission or sheen) intact; a named finish replaces them as a whole.
      if (override.finish)
        applyFinish(physical, cutoutFinish(studioFinish(override.finish), scene.stage.output));
      else {
        physical.roughness = override.roughness;
        physical.metalness = override.metalness;
        physical.clearcoat = override.clearcoat;
      }
    }
    const surfaceFinish = surface && scene.materials.surfaces?.[useB ? 'b' : 'a'][surface];
    if (surfaceFinish && surfaceFinish !== 'inherit')
      applyFinish(physical, cutoutFinish(studioFinish(surfaceFinish), scene.stage.output));
    cache.set(key, physical);
    changed.add(physical);
    return physical;
  };
  for (const [mesh, original] of asset.originals)
    mesh.material = Array.isArray(original)
      ? original.map((material, i) =>
          alter(
            material,
            mesh.userData.studioSurfaces ? (['face', 'bevel', 'side'] as const)[i] : undefined
          )
        )
      : alter(original);
  return () => {
    for (const [mesh, original] of asset.originals) mesh.material = original;
    for (const material of changed) material.dispose();
  };
}
