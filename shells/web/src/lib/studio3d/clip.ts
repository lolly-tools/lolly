// SPDX-License-Identifier: MPL-2.0
/**
 * Baked animation clips in 3D Studio: the bounds of a model over a whole clip, and the
 * bounds every placement reads once a clip plays.
 *
 * A model that moves has no single box. Measuring the frame on screen would rest the model
 * on the floor again at every frame and fit the camera again at every frame, so a jump
 * would never leave the ground and the framing would breathe. The studio measures the clip
 * once instead, at the fixed moments the engine lists, and every later question about the
 * model's size is answered from that one measurement.
 */
import * as THREE from 'three';

/** Vertex positions read across the whole measurement before every nth vertex is read instead. */
const VERTEX_BUDGET = 3_000_000;

/** One box per mesh, in the space of the object that carries them, covering the whole clip. */
export class StudioClipBounds {
  readonly boxes: THREE.Box3[];
  constructor(boxes: THREE.Box3[]) {
    this.boxes = boxes;
  }
  /** Every box as one, in the space they were measured in. */
  union(): THREE.Box3 {
    const all = new THREE.Box3();
    for (const box of this.boxes) all.union(box);
    return all;
  }
  /** The boxes carried through a scale and then a move, as the loader normalises a model. */
  placed(scale: number, offset: THREE.Vector3): StudioClipBounds {
    return new StudioClipBounds(
      this.boxes.map(
        (box) =>
          new THREE.Box3(
            box.min.clone().multiplyScalar(scale).add(offset),
            box.max.clone().multiplyScalar(scale).add(offset)
          )
      )
    );
  }
}

/** A mesh whose vertices move without its node moving: it has a skeleton or morph targets. */
export function studioDeforms(mesh: THREE.Mesh): boolean {
  return (
    (mesh as THREE.SkinnedMesh).isSkinnedMesh === true ||
    Object.keys(mesh.geometry.morphAttributes ?? {}).length > 0
  );
}

/**
 * The bounds of every mesh under `root` over one clip, in world space, with `root` posed
 * at each of `times` in turn. A rigid mesh contributes its geometry's box carried by its
 * node at that moment; a skinned or morphing mesh is read vertex by vertex, because its
 * node says nothing about where its surface is. The model is left posed at `times[0]`.
 */
export function measureStudioClip(
  root: THREE.Object3D,
  clip: THREE.AnimationClip,
  times: number[]
): StudioClipBounds {
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry.getAttribute('position')) meshes.push(node);
  });
  const deforming = meshes.filter(studioDeforms);
  const vertices = deforming.reduce((n, mesh) => n + mesh.geometry.getAttribute('position').count, 0);
  const stride = Math.max(1, Math.ceil((vertices * times.length) / VERTEX_BUDGET));
  const boxes = meshes.map(() => new THREE.Box3());
  const mixer = new THREE.AnimationMixer(root);
  const point = new THREE.Vector3();
  const box = new THREE.Box3();
  try {
    // Played once and held, so the last moment measured is the clip's last pose and not
    // its first again, which is what a repeating clip shows at its own length.
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    for (const time of times) {
      mixer.setTime(time);
      root.updateMatrixWorld(true);
      for (const [i, mesh] of meshes.entries()) {
        if (deforming.includes(mesh)) {
          const count = mesh.geometry.getAttribute('position').count;
          for (let vertex = 0; vertex < count; vertex += stride) {
            mesh.getVertexPosition(vertex, point);
            boxes[i]!.expandByPoint(point.applyMatrix4(mesh.matrixWorld));
          }
        } else {
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          boxes[i]!.union(box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld));
        }
      }
    }
    mixer.setTime(times[0] ?? 0);
    root.updateMatrixWorld(true);
  } finally {
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
  }
  return new StudioClipBounds(boxes.filter((each) => !each.isEmpty()));
}

function clipBoundsOf(node: THREE.Object3D): StudioClipBounds | null {
  const held: unknown = node.userData.studioClipBounds;
  return held instanceof StudioClipBounds ? held : null;
}

/**
 * The world bounds of an object. An object that plays a clip answers with the bounds of
 * the whole clip, carried by its own placement, whatever pose it holds now; anything else
 * is measured the way three measures any object. A tree with no playing object takes exactly the
 * path it always took.
 */
export function studioBox(object: THREE.Object3D): THREE.Box3 {
  let playing = false;
  object.traverse((node) => {
    if (clipBoundsOf(node)) playing = true;
  });
  if (!playing) return new THREE.Box3().setFromObject(object);
  const out = new THREE.Box3();
  const scratch = new THREE.Box3();
  const visit = (node: THREE.Object3D): void => {
    node.updateWorldMatrix(false, false);
    const held = clipBoundsOf(node);
    if (held) {
      for (const each of held.boxes) out.union(scratch.copy(each).applyMatrix4(node.matrixWorld));
      return;
    }
    const geometry = (node as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (geometry?.getAttribute?.('position')) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      out.union(scratch.copy(geometry.boundingBox!).applyMatrix4(node.matrixWorld));
    }
    for (const child of node.children) visit(child);
  };
  object.updateWorldMatrix(true, false);
  visit(object);
  return out;
}
