// SPDX-License-Identifier: MPL-2.0
/**
 * The numbers behind the handles on 3D Studio's selected object (plan 368, W3): the floor
 * ring round the object's footprint, where it falls on the screen, and the snapping a turn,
 * a lift and a scale follow. Pure: a camera and a footprint in, screen points out, so the
 * same answers are tested without a browser (handle-geometry.test.ts).
 *
 * Screen points are fractions of the canvas, 0 to 1 from the left and from the top, so
 * the caller multiplies by the canvas's box on the page; the canvas itself is never read.
 */
import * as THREE from 'three';
import { studioBox } from './clip.ts';

/** A turn by the ring snaps to this many degrees. */
export const STUDIO_TURN_SNAP = 15;
/** A lift this close to the stage, in studio units, snaps down to the stage. */
export const STUDIO_LIFT_SNAP = 0.05;
/** The uniform scale an object may take; the same range the engine's edit builder keeps. */
export const STUDIO_SCALE_MIN = 0.1;
export const STUDIO_SCALE_MAX = 5;
/** Points on the floor ring. Enough that the ring reads as a circle at any size on screen. */
export const STUDIO_RING_SEGMENTS = 72;
/** The ring stands this much outside the footprint, as a share of its radius. */
const RING_MARGIN = 1.08;

/** A screen point as fractions of the canvas: 0 to 1 from the left, 0 to 1 from the top. */
export type StudioScreenPoint = [number, number];

/** An angle kept in -180 to 180, with 180 kept rather than turned into -180. */
export function studioWrapDegrees(angle: number): number {
  const turned = ((((angle + 180) % 360) + 360) % 360) - 180;
  return turned === -180 && angle > 0 ? 180 : turned;
}

/** A turn in -180 to 180, on the nearest 15 degrees unless `free` (Alt held). Whole degrees either way. */
export function studioSnapTurn(degrees: number, free = false): number {
  const wrapped = studioWrapDegrees(degrees);
  const snapped = free ? Math.round(wrapped) : Math.round(wrapped / STUDIO_TURN_SNAP) * STUDIO_TURN_SNAP;
  return studioWrapDegrees(snapped) || 0;
}

/** A height that snaps to the stage (0) when it comes within `near` of the stage, unless `free`. */
export function studioSnapLift(height: number, free = false, near = STUDIO_LIFT_SNAP): number {
  if (!Number.isFinite(height)) return 0;
  if (!free && Math.abs(height) < near) return 0;
  return Math.round(height * 1000) / 1000;
}

/** A uniform scale held in 0.1 to 5, to two places. */
export function studioClampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.round(Math.max(STUDIO_SCALE_MIN, Math.min(STUDIO_SCALE_MAX, scale)) * 100) / 100;
}

/**
 * The floor under an object: the centre of its footprint, on the surface it stands on, and
 * the radius of a ring that holds the footprint with a margin.
 */
export interface StudioFootprint {
  center: THREE.Vector3;
  radius: number;
  /** The object's world bounds: their height is the height of the upright drum below. */
  box: THREE.Box3;
}

/**
 * The footprint of a placed object. The radius is the smaller of two outer bounds: the half
 * diagonal of the world box (exact for a box turned square to the axes) and the reach of
 * each mesh's bounding sphere (exact for a sphere or a disc), so a ball gets a ring the size
 * of the ball rather than the size of its box.
 */
export function studioFootprint(object: THREE.Object3D, floor: number): StudioFootprint | null {
  object.updateMatrixWorld(true);
  const box = studioBox(object);
  if (box.isEmpty()) return null;
  const center = new THREE.Vector3((box.min.x + box.max.x) / 2, floor, (box.min.z + box.max.z) / 2);
  const diagonal = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z) / 2;
  let reach = 0;
  const scale = new THREE.Vector3();
  object.traverse((node) => {
    const geometry = (node as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!(node as THREE.Mesh).isMesh || !geometry?.attributes?.position) return;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    if (!sphere) return;
    const middle = sphere.center.clone().applyMatrix4(node.matrixWorld);
    node.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    const radius = sphere.radius * Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
    reach = Math.max(reach, Math.hypot(middle.x - center.x, middle.z - center.z) + radius);
  });
  const radius = (reach > 0 ? Math.min(diagonal, reach) : diagonal) * RING_MARGIN;
  return radius > 0 ? { center, radius, box } : null;
}

/** The point on the ring at a floor angle, in degrees, measured as a turn is: 0 faces +z. */
export function studioRingPoint(footprint: StudioFootprint, degrees: number): THREE.Vector3 {
  const angle = THREE.MathUtils.degToRad(degrees);
  return new THREE.Vector3(
    footprint.center.x + footprint.radius * Math.sin(angle),
    footprint.center.y,
    footprint.center.z + footprint.radius * Math.cos(angle)
  );
}

/** The floor angle of a world point about the footprint's centre, in degrees (0 faces +z). */
export function studioFloorAngle(footprint: StudioFootprint, point: THREE.Vector3): number {
  return THREE.MathUtils.radToDeg(Math.atan2(point.x - footprint.center.x, point.z - footprint.center.z));
}

/** The floor angle of the ring's point nearest the eye: where the knob rests. */
export function studioRingFront(camera: THREE.Camera, footprint: StudioFootprint): number {
  const eye = camera.getWorldPosition(new THREE.Vector3());
  if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    // A parallel view has no eye point: the front is the side the view comes from.
    const toward = camera.getWorldDirection(new THREE.Vector3()).negate();
    return THREE.MathUtils.radToDeg(Math.atan2(toward.x, toward.z));
  }
  return studioFloorAngle(footprint, eye);
}

/** A world point on the canvas, or null when it is behind the camera. */
export function studioProject(camera: THREE.Camera, point: THREE.Vector3): StudioScreenPoint | null {
  camera.updateMatrixWorld();
  const near = (camera as THREE.PerspectiveCamera).near ?? 0;
  if (point.clone().applyMatrix4(camera.matrixWorldInverse).z > -near) return null;
  const ndc = point.clone().project(camera);
  if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return null;
  return [(ndc.x + 1) / 2, (1 - ndc.y) / 2];
}

/**
 * The place of a light's handle, as fractions of the frame. A light in front of the camera
 * stands where the light is seen, which may be outside the frame: a rim light or a side
 * light usually is. A light behind the camera cannot be seen at all, so `behind` is true
 * and `point` is a direction from the middle of the frame (x to the right, y down, length
 * one) for the caller to stand the handle beyond the frame's edge on that side.
 */
export function studioLightPoint(camera: THREE.Camera, position: THREE.Vector3): { point: StudioScreenPoint; behind: boolean } {
  const seen = studioProject(camera, position);
  if (seen) return { point: seen, behind: false };
  camera.updateMatrixWorld();
  const view = position.clone().applyMatrix4(camera.matrixWorldInverse);
  const length = Math.hypot(view.x, view.y);
  // Straight behind the eye there is no side to choose, so the handle stands above the frame.
  return { point: length > 1e-6 ? [view.x / length, -view.y / length] : [0, -1], behind: true };
}

/**
 * Keep a handle in reach. `to` is where the handle would stand and `from` is a point
 * inside `rect` (the point the lights aim at). When `to` is outside `rect`, the answer is
 * the point where the line from `from` to `to` leaves `rect`, so the handle stands at the
 * edge on the side its light is on. `held` says whether the point was moved.
 */
export function studioHoldInRect(
  from: readonly [number, number],
  to: readonly [number, number],
  rect: { left: number; top: number; right: number; bottom: number },
): { point: [number, number]; held: boolean } {
  const inside = to[0] >= rect.left && to[0] <= rect.right && to[1] >= rect.top && to[1] <= rect.bottom;
  if (inside || !(rect.right > rect.left) || !(rect.bottom > rect.top)) return { point: [to[0], to[1]], held: false };
  const fx = Math.min(rect.right, Math.max(rect.left, from[0])), fy = Math.min(rect.bottom, Math.max(rect.top, from[1]));
  const dx = to[0] - fx, dy = to[1] - fy;
  let t = 1;
  if (dx > 0) t = Math.min(t, (rect.right - fx) / dx);
  if (dx < 0) t = Math.min(t, (rect.left - fx) / dx);
  if (dy > 0) t = Math.min(t, (rect.bottom - fy) / dy);
  if (dy < 0) t = Math.min(t, (rect.top - fy) / dy);
  t = Math.max(0, t);
  return { point: [fx + dx * t, fy + dy * t], held: true };
}

/**
 * True when the object stands between the eye and a point on the ring. The object is taken
 * as an upright drum: the footprint's own radius (inside the ring's margin), from the
 * bottom of its bounds to the top. A box would be too big: a ring that hugs a ball passes
 * inside the corners of the ball's box, and its front would be hidden by corners that are
 * not there.
 */
function hidden(camera: THREE.Camera, footprint: StudioFootprint, point: THREE.Vector3): boolean {
  let origin: THREE.Vector3, direction: THREE.Vector3;
  if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
    direction = camera.getWorldDirection(new THREE.Vector3());
    origin = point.clone().addScaledVector(direction, -1000);
  } else {
    origin = camera.getWorldPosition(new THREE.Vector3());
    direction = point.clone().sub(origin).normalize();
  }
  const reach = footprint.radius / RING_MARGIN;
  const ox = origin.x - footprint.center.x,
    oz = origin.z - footprint.center.z;
  // Where the ray crosses the drum's wall: |o + t d| = reach in the floor plane.
  const a = direction.x * direction.x + direction.z * direction.z;
  const b = 2 * (ox * direction.x + oz * direction.z);
  const c = ox * ox + oz * oz - reach * reach;
  const disc = b * b - 4 * a * c;
  if (a < 1e-12 || disc <= 0) return false;
  const far = point.distanceTo(origin) - 1e-4;
  const { min, max } = footprint.box;
  for (const t of [(-b - Math.sqrt(disc)) / (2 * a), (-b + Math.sqrt(disc)) / (2 * a)]) {
    if (t <= 0 || t >= far) continue;
    const y = origin.y + t * direction.y;
    if (y >= min.y - 1e-6 && y <= max.y + 1e-6) return true;
  }
  return false;
}

/**
 * The ring as runs of screen points. A run breaks where the ring passes behind the camera
 * or behind the object, so the drawn line never crosses the subject it surrounds; a ring
 * seen whole is one run that closes on its first point.
 */
export function studioRingRuns(
  camera: THREE.Camera,
  footprint: StudioFootprint,
  segments = STUDIO_RING_SEGMENTS
): StudioScreenPoint[][] {
  camera.updateMatrixWorld();
  const points: (StudioScreenPoint | null)[] = [];
  for (let i = 0; i < segments; i++) {
    const world = studioRingPoint(footprint, (i * 360) / segments);
    points.push(hidden(camera, footprint, world) ? null : studioProject(camera, world));
  }
  if (points.every(Boolean)) return [[...(points as StudioScreenPoint[]), points[0]!]];
  // Start the walk just after a gap, so a run that crosses the seam is drawn as one.
  const start = points.findIndex((point, i) => point && !points[(i + segments - 1) % segments]);
  if (start < 0) return [];
  const runs: StudioScreenPoint[][] = [];
  let run: StudioScreenPoint[] = [];
  for (let k = 0; k < segments; k++) {
    const point = points[(start + k) % segments];
    if (point) run.push(point);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  return runs.filter((r) => r.length > 1);
}
