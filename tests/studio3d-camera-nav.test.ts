// SPDX-License-Identifier: MPL-2.0
/**
 * The maths behind 3D Studio's canvas gestures (shells/web/src/lib/studio3d/camera-nav.ts):
 * the orbit wraps instead of stopping, the arrow keys go the way a drag goes, a pan keeps
 * the point under the pointer and moves in the view plane, the zoom stays in its range,
 * and every value is one the engine keeps as it is (plan 368, W2).
 *
 * Run directly:
 *   node --test tests/studio3d-camera-nav.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildStudioScene } from '../engine/src/studio3d.ts';
import {
  STUDIO_REST_CAMERA,
  STUDIO_VIEW_PRESETS,
  arrowOrbit,
  clampElevation,
  clampZoom,
  orbitBy,
  panBy,
  turnBy,
  viewAxes,
  wheelZoomFactor,
  worldPerPixel,
  wrapAzimuth,
  zoomBy,
  type StudioView,
} from '../shells/web/src/lib/studio3d/camera-nav.ts';

const rest: StudioView = { azimuth: 25, elevation: 14, zoom: 1, panX: 0, panY: 0, panZ: 0 };
const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

test('the orbit wraps all the way round instead of stopping at the seam', () => {
  assert.equal(wrapAzimuth(190), -170);
  assert.equal(wrapAzimuth(-190), 170);
  assert.equal(wrapAzimuth(540), 180, 'a turn that arrives at the seam from below keeps 180');
  assert.equal(wrapAzimuth(-180), -180);
  assert.equal(wrapAzimuth(725.5), 5.5);
  assert.equal(wrapAzimuth(Number.NaN), 0);
  // A long drag to the left keeps turning: 1300 px is 390 degrees, past the old stop at 180.
  const turned = orbitBy({ ...rest, azimuth: 170 }, -100, 0);
  assert.equal(turned.azimuth, -160, '170 + 30 wraps to -160');
  let view = rest;
  for (let i = 0; i < 13; i++) view = orbitBy(view, -100, 0);
  assert.equal(view.azimuth, wrapAzimuth(25 + 390));
});

test('elevation keeps its limits, and a drag down looks from above', () => {
  assert.equal(orbitBy(rest, 0, 100).elevation, 34);
  assert.equal(orbitBy(rest, 0, 10_000).elevation, 80);
  assert.equal(orbitBy(rest, 0, -10_000).elevation, -60);
  assert.equal(clampElevation(Number.NaN), 0);
});

test('each arrow key orbits the way a drag in its direction does, 5 degrees and 15 with Shift', () => {
  const drag = { ArrowLeft: [-50, 0], ArrowRight: [50, 0], ArrowUp: [0, -50], ArrowDown: [0, 50] } as const;
  for (const [key, [dx, dy]] of Object.entries(drag)) {
    const byDrag = orbitBy(rest, dx, dy);
    const byKey = turnBy(rest, arrowOrbit(key, false)!);
    assert.equal(Math.sign(byKey.azimuth - rest.azimuth), Math.sign(byDrag.azimuth - rest.azimuth), `${key} turns as a drag that way does`);
    assert.equal(Math.sign(byKey.elevation - rest.elevation), Math.sign(byDrag.elevation - rest.elevation), `${key} tilts as a drag that way does`);
  }
  assert.deepEqual(arrowOrbit('ArrowLeft', false), { azimuth: 5, elevation: 0 });
  assert.deepEqual(arrowOrbit('ArrowRight', true), { azimuth: -15, elevation: 0 });
  assert.equal(arrowOrbit('a', false), null);
  assert.equal(turnBy({ ...rest, azimuth: 178 }, arrowOrbit('ArrowLeft', false)!).azimuth, -177, 'keys wrap too');
});

test('a pan moves the target in the view plane and keeps the point under the pointer', () => {
  const lens = { fov: 29 };
  const height = 800;
  // Front view: the camera's right is +x and its up is +y, so a drag right moves the target left.
  const front: StudioView = { ...rest, azimuth: 0, elevation: 0 };
  const right = panBy(front, lens, 100, 0, height);
  const k = worldPerPixel(lens, 1, height);
  close(right.panX, Math.round(-100 * k * 1000) / 1000, 1e-3);
  assert.equal(right.panY, 0);
  assert.equal(right.panZ, 0);
  const down = panBy(front, lens, 0, 100, height);
  close(down.panY, Math.round(100 * k * 1000) / 1000, 1e-3);
  // The pan is always perpendicular to the line of sight.
  for (const [az, el] of [[25, 14], [120, -40], [-70, 60]] as const) {
    const view = { ...rest, azimuth: az, elevation: el };
    const moved = panBy(view, lens, 37, -21, height);
    const delta = [moved.panX - view.panX, moved.panY - view.panY, moved.panZ - view.panZ];
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    const sight = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
    close(delta.reduce((sum, d, i) => sum + d * sight[i]!, 0), 0, 2e-3);
    const { right: r, up: u } = viewAxes(az, el);
    close(r.reduce((s, x, i) => s + x * u[i]!, 0), 0);
  }
  // Closer views pan less per pixel; an orthographic camera pans by its own height.
  assert.ok(worldPerPixel(lens, 2, height) < worldPerPixel(lens, 1, height));
  close(worldPerPixel({ fov: 29, projection: 'orthographic' }, 1, 600), 6 / 600);
  // Each pan input stays within the engine's +-20.
  assert.equal(panBy(front, lens, -1e7, 0, height).panX, 20);
});

test('the zoom stays in 0.05 to 3, from a wheel, a pinch or a key', () => {
  assert.equal(clampZoom(10), 3);
  assert.equal(clampZoom(0.001), 0.05);
  assert.equal(zoomBy(rest, 1000).zoom, 3);
  assert.equal(zoomBy(rest, 0).zoom, 1, 'a nonsense factor changes nothing');
  assert.ok(wheelZoomFactor(-100) > 1, 'scrolling up comes closer');
  assert.ok(wheelZoomFactor(100) < 1);
  assert.equal(wheelZoomFactor(10_000), wheelZoomFactor(120), 'one event moves at most 120 pixels worth');
  assert.equal(wheelZoomFactor(3, 1), wheelZoomFactor(48), 'a line counts sixteen pixels');
});

test('the rest camera and the named views are values the engine keeps as they are', () => {
  const scene = buildStudioScene({ version: 1, values: {} });
  assert.equal(scene.camera.azimuth, STUDIO_REST_CAMERA.azimuth);
  assert.equal(scene.camera.elevation, STUDIO_REST_CAMERA.elevation);
  assert.equal(scene.camera.fov, STUDIO_REST_CAMERA.fov);
  assert.equal(scene.camera.zoom, STUDIO_REST_CAMERA.zoom);
  for (const view of STUDIO_VIEW_PRESETS) {
    const built = buildStudioScene({ version: 1, values: { camera: { azimuth: view.azimuth, elevation: view.elevation } } });
    assert.equal(built.camera.azimuth, view.azimuth, view.id);
    assert.equal(built.camera.elevation, view.elevation, view.id);
  }
  // A wrapped orbit is accepted as saved, not clamped back.
  let view = rest;
  for (let i = 0; i < 20; i++) view = orbitBy(view, -97, 13);
  const built = buildStudioScene({ version: 1, values: { camera: { ...view } } });
  assert.equal(built.camera.azimuth, view.azimuth);
  assert.equal(built.camera.elevation, view.elevation);
  assert.equal(built.camera.zoom, view.zoom);
});

test('the View menu offers Front, Side, Top and Three-quarter, each one camera edit', async () => {
  const { studioBarHarness } = await import('./helpers/studio3d-bar.ts');
  const bar = await studioBarHarness({ camera: { azimuth: 90, elevation: 0, zoom: 1.4 } });
  const view = bar.action('studio-view');
  assert.ok(view?.menu, 'a View action with a menu');
  const items = view.menu!();
  assert.deepEqual(items.map((item) => item.label), ['Front', 'Side', 'Top', 'Three-quarter']);
  assert.deepEqual(items.filter((item) => item.checked).map((item) => item.id), ['side'], 'the current view is ticked');
  items.find((item) => item.id === 'top')!.onPress();
  assert.equal(bar.edits.length, 1, 'one write, so one undo step');
  const { id, value } = bar.edits[0] as { id: string; value: Record<string, unknown> };
  assert.equal(id, 'camera');
  assert.equal(value.azimuth, 0);
  assert.equal(value.elevation, 80);
});
