// SPDX-License-Identifier: MPL-2.0
import * as THREE from 'three';
import {
  type StudioObjectBox,
  studioArrangementPivot,
} from '../../../../../engine/src/studio3d-arrangement.ts';
import {
  STUDIO_POSE_REST,
  studioObjectPose,
} from '../../../../../engine/src/studio3d-motion.ts';
import type {
  StudioObjectV1,
  StudioPoseV1,
  StudioSceneV1,
} from '../../../../../packages/core/src/studio3d-v1.ts';
import { studioCamera } from './stage.ts';

/** The height of the surface a grounded subject stands on: the pedestal's top, or the floor. */
export function studioFloorHeight(recipe: StudioSceneV1): number {
  return recipe.stage.pedestal && recipe.stage.output === 'scene' ? 0.3 : 0;
}

/** True when a pose moves the subject at all. A rest pose leaves the scene exactly as it was. */
function posing(pose: StudioPoseV1): boolean {
  return (
    pose.spin !== 0 ||
    pose.lift !== 0 ||
    pose.tilt[0] !== 0 ||
    pose.tilt[1] !== 0 ||
    pose.scale[0] !== 1 ||
    pose.scale[1] !== 1 ||
    pose.scale[2] !== 1
  );
}

/**
 * Pose one subject: the row's rotation and scale, the loop's pose over them, then ground
 * contact or a free pivot.
 *
 * The loop's rocking tilt is added to the row's own rotation and its turn to the y axis,
 * where the turntable's spin has always gone. The row's scale is multiplied by the pose's
 * axis by axis, so the loop's own squash and stretch reach the subject whatever size the
 * row asks for.
 *
 * Grounding measures the box the pose actually leaves, so the lowest point of the subject
 * rests on the floor at every phase: a squash flattens onto the floor rather than floating
 * over it, a stretch grows upward from it, and a tilt rocks on its lowest corner, which is
 * what the spin has always done. The loop's lift is added after that, so a jump rises from
 * the floor it just left.
 */
function placeObject(
  object: THREE.Object3D,
  spec: StudioObjectV1,
  recipe: StudioSceneV1,
  pose: StudioPoseV1
): void {
  object.visible = spec.visible;
  object.rotation.set(
    ...(spec.transform.rotation.map(THREE.MathUtils.degToRad) as [number, number, number])
  );
  object.rotation.x += pose.tilt[0];
  object.rotation.z += pose.tilt[1];
  object.rotation.y += pose.spin;
  object.scale.set(
    spec.transform.scale * pose.scale[0],
    spec.transform.scale * pose.scale[1],
    spec.transform.scale * pose.scale[2]
  );
  object.position.set(0, 0, 0);
  const bounds = new THREE.Box3().setFromObject(object);
  object.position.set(
    spec.transform.position[0],
    (spec.grounded ? -bounds.min.y + studioFloorHeight(recipe) : 0) + spec.transform.position[1] + pose.lift,
    spec.transform.position[2]
  );
}

export function placeStudioObject(
  object: THREE.Object3D,
  recipe: StudioSceneV1,
  time = 0,
  seconds?: number
): void {
  placeObject(
    object,
    {
      id: 'object',
      name: 'Object',
      source: recipe.source,
      transform: recipe.transform,
      grounded: true,
      visible: true,
      bindings: { a: '', b: '' },
    },
    recipe,
    studioObjectPose(recipe, time, seconds)
  );
  object.updateMatrixWorld(true);
}

/**
 * Place every subject under one root at one moment of the loop. A single object takes the
 * pose itself; an arrangement takes it as a group about the centre of its footprint at time
 * zero, which is where the turntable has always turned it. The caller may hand in the pose
 * it already worked out for this frame; otherwise it is read from the recipe here.
 */
export function placeStudioScene(
  root: THREE.Object3D,
  placed: { object: THREE.Object3D; spec: StudioObjectV1 }[],
  recipe: StudioSceneV1,
  time = 0,
  seconds?: number,
  pose: StudioPoseV1 = studioObjectPose(recipe, time, seconds)
): StudioObjectBox[] {
  const grouped = !!recipe.objects;
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);
  root.scale.set(1, 1, 1);
  for (const { object, spec } of placed)
    placeObject(object, spec, recipe, grouped ? STUDIO_POSE_REST : pose);
  root.updateMatrixWorld(true);
  const boxes: StudioObjectBox[] = placed
    .filter(({ spec }) => spec.visible)
    .map(({ object, spec }) => {
      const bounds = new THREE.Box3().setFromObject(object);
      return {
        id: spec.id,
        name: spec.name,
        min: [bounds.min.x, bounds.min.y, bounds.min.z],
        max: [bounds.max.x, bounds.max.y, bounds.max.z],
      };
    });
  if (grouped && posing(pose)) {
    const [px, , pz] = studioArrangementPivot(boxes);
    for (const { object } of placed) object.position.sub(new THREE.Vector3(px, 0, pz));
    // The pivot sits on the floor, so a group squash flattens onto it and a group lift
    // raises the whole arrangement off it.
    root.position.set(px, pose.lift, pz);
    root.rotation.set(pose.tilt[0], pose.spin, pose.tilt[1]);
    root.scale.set(pose.scale[0], pose.scale[1], pose.scale[2]);
    root.updateMatrixWorld(true);
  }
  return boxes;
}

/** Fit the transformed subject with a ten-percent border at this output aspect ratio. */
export function fitStudioObject(
  object: THREE.Object3D,
  recipe: StudioSceneV1,
  aspect: number
): { zoom: number; target: THREE.Vector3 } {
  const box = new THREE.Box3().setFromObject(object),
    target = box.getCenter(new THREE.Vector3());
  const camera = studioCamera(recipe, aspect),
    inverse = camera.quaternion.clone().invert();
  const tangent = Math.tan(THREE.MathUtils.degToRad(recipe.camera.fov / 2));
  let distance = 0,
    zoom = 3;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).sub(target).applyQuaternion(inverse);
        distance = Math.max(
          distance,
          p.z + Math.max(Math.abs(p.y), Math.abs(p.x) / aspect) / (tangent * 0.8)
        );
        zoom = Math.min(
          zoom,
          2.4 / Math.max(1e-6, Math.abs(p.y)),
          (2.4 * aspect) / Math.max(1e-6, Math.abs(p.x))
        );
      }
  if (recipe.camera.projection === 'perspective') zoom = 11.3 / distance;
  if (zoom < 0.05) throw new Error('Use a wider image or reduce the object scale to fit this view.');
  return { zoom: Math.max(0.05, Math.min(3, zoom)), target };
}

/** Focus is axial distance to the lens plane, not the longer off-axis ray distance. */
export function pickStudioFocus(
  object: THREE.Object3D,
  recipe: StudioSceneV1,
  aspect: number,
  x: number,
  y: number
): number | null {
  const camera = studioCamera(recipe, aspect);
  camera.updateMatrixWorld(true);
  object.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x, y), camera);
  const hit = ray.intersectObject(object, true)[0];
  if (!hit) return null;
  const depth = hit.point.sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3()));
  return Math.max(0.01, Math.min(500, depth));
}
