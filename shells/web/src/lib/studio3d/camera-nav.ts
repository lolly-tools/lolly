// SPDX-License-Identifier: MPL-2.0
/**
 * Moving 3D Studio's camera on the canvas: the maths behind the gestures in controls.ts,
 * kept pure so the wrap, the pan and the limits are tested without a browser
 * (tests/studio3d-camera-nav.test.ts). The gesture model is Chart's (community/chart/lib/
 * chart-three.js, `wireView`), the one plan 368 W2 makes the standard for 3-D canvases:
 *
 *  - a drag orbits, and the orbit wraps all the way round;
 *  - an arrow key orbits the way a drag in that direction does;
 *  - Shift-drag, a middle-button drag or two fingers pan the target in the view plane;
 *  - a pinch, a plain wheel or plus and minus zoom, within the saved range.
 *
 * Every value stays inside the limits the engine applies when it builds the scene
 * (engine/src/studio3d.ts): azimuth -180 to 180, elevation -60 to 80, zoom 0.05 to 3 and
 * each pan +-20. The azimuth is brought into range rather than stopped at the seam.
 */

/** The camera values a gesture changes, as the `camera` input stores them. */
export interface StudioView {
  azimuth: number;
  elevation: number;
  zoom: number;
  panX: number;
  panY: number;
  panZ: number;
}

/** The lens a pan is measured through. */
export interface StudioLens {
  fov: number;
  projection?: 'perspective' | 'orthographic';
}

export const STUDIO_ELEVATION_RANGE = [-60, 80] as const;
export const STUDIO_ZOOM_RANGE = [0.05, 3] as const;
export const STUDIO_PAN_LIMIT = 20;
/** Degrees of orbit per pixel of drag, across and up the canvas. */
export const STUDIO_ORBIT_RATE = { azimuth: 0.3, elevation: 0.2 } as const;
/** Degrees per arrow key press, and with Shift. */
export const STUDIO_KEY_STEP = { small: 5, large: 15 } as const;
/** Zoom factor per plus or minus press. */
export const STUDIO_KEY_ZOOM = 1.15;
/** The distance from the target at zoom 1 (lib/studio3d/stage.ts, `studioCamera`). */
const DISTANCE = 11.3;
/** Half the height an orthographic camera shows at zoom 1 (`studioCamera`). */
const ORTHO_HALF_HEIGHT = 3;

/** The camera the studio rests at: the engine's defaults, which Reset puts back. */
export const STUDIO_REST_CAMERA = { azimuth: 25, elevation: 14, fov: 29, zoom: 1, panX: 0, panY: 0, panZ: 0 } as const;

/**
 * The named views the View menu offers (lib/studio3d/toolbar.ts gives each its label).
 * Each sets the azimuth and elevation only; Top is the highest elevation the engine keeps.
 */
export const STUDIO_VIEW_PRESETS = [
  { id: 'front', azimuth: 0, elevation: 0 },
  { id: 'side', azimuth: 90, elevation: 0 },
  { id: 'top', azimuth: 0, elevation: 80 },
  { id: 'three-quarter', azimuth: 45, elevation: 25 },
] as const;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const round = (n: number, places: number): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f || 0;
};

/**
 * An angle in degrees brought into -180 to 180, so an orbit keeps turning past the seam.
 * 180 and -180 are the same view; a turn that arrives there from below keeps 180.
 */
export function wrapAzimuth(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  const turned = ((((degrees + 180) % 360) + 360) % 360) - 180;
  return round(turned === -180 && degrees > 0 ? 180 : turned, 2);
}

export function clampElevation(degrees: number): number {
  return round(clamp(Number.isFinite(degrees) ? degrees : 0, ...STUDIO_ELEVATION_RANGE), 2);
}

export function clampZoom(zoom: number): number {
  return round(clamp(Number.isFinite(zoom) ? zoom : 1, ...STUDIO_ZOOM_RANGE), 4);
}

function clampPan(value: number): number {
  return round(clamp(value, -STUDIO_PAN_LIMIT, STUDIO_PAN_LIMIT), 3);
}

/**
 * The view after a drag of `dx`, `dy` screen pixels. A drag to the left turns the camera
 * the other way round the subject, so the subject appears to follow the pointer; a drag
 * down lifts the camera to look from above.
 */
export function orbitBy(view: StudioView, dx: number, dy: number): StudioView {
  return {
    ...view,
    azimuth: wrapAzimuth(view.azimuth - dx * STUDIO_ORBIT_RATE.azimuth),
    elevation: clampElevation(view.elevation + dy * STUDIO_ORBIT_RATE.elevation),
  };
}

/**
 * The orbit an arrow key makes, in degrees: the same direction as a drag that way, so the
 * left arrow and a drag to the left agree. Null for any other key.
 */
export function arrowOrbit(key: string, large: boolean): { azimuth: number; elevation: number } | null {
  const step = large ? STUDIO_KEY_STEP.large : STUDIO_KEY_STEP.small;
  switch (key) {
    case 'ArrowLeft': return { azimuth: step, elevation: 0 };
    case 'ArrowRight': return { azimuth: -step, elevation: 0 };
    case 'ArrowUp': return { azimuth: 0, elevation: -step };
    case 'ArrowDown': return { azimuth: 0, elevation: step };
    default: return null;
  }
}

/** Turn the view by an angle pair, with the same wrap and limits as a drag. */
export function turnBy(view: StudioView, turn: { azimuth: number; elevation: number }): StudioView {
  return { ...view, azimuth: wrapAzimuth(view.azimuth + turn.azimuth), elevation: clampElevation(view.elevation + turn.elevation) };
}

/** The camera's right and up directions in the world, for an azimuth and elevation in degrees. */
export function viewAxes(azimuth: number, elevation: number): { right: [number, number, number]; up: [number, number, number] } {
  const a = (azimuth * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  return {
    right: [Math.cos(a), 0, -Math.sin(a)],
    up: [-Math.sin(a) * Math.sin(e), Math.cos(e), -Math.cos(a) * Math.sin(e)],
  };
}

/** World units per screen pixel at the target, on a canvas `height` pixels tall. */
export function worldPerPixel(lens: StudioLens, zoom: number, height: number): number {
  const z = clampZoom(zoom);
  const visible = lens.projection === 'orthographic'
    ? (2 * ORTHO_HALF_HEIGHT) / z
    : 2 * (DISTANCE / z) * Math.tan((clamp(lens.fov, 1, 179) * Math.PI) / 360);
  return visible / Math.max(1, height);
}

/**
 * The view after a pan of `dx`, `dy` screen pixels: the target moves in the view plane by
 * the amount that keeps the point under the pointer under the pointer.
 */
export function panBy(view: StudioView, lens: StudioLens, dx: number, dy: number, height: number): StudioView {
  const k = worldPerPixel(lens, view.zoom, height);
  const { right, up } = viewAxes(view.azimuth, view.elevation);
  // Dragging right carries the picture right, so the target moves left; dragging down
  // carries the picture down, so the target moves up.
  const move = (i: 0 | 1 | 2): number => (-right[i] * dx + up[i] * dy) * k;
  return {
    ...view,
    panX: clampPan(view.panX + move(0)),
    panY: clampPan(view.panY + move(1)),
    panZ: clampPan(view.panZ + move(2)),
  };
}

/** The view zoomed by a factor (above 1 comes closer), within the saved range. */
export function zoomBy(view: StudioView, factor: number): StudioView {
  return Number.isFinite(factor) && factor > 0 ? { ...view, zoom: clampZoom(view.zoom * factor) } : view;
}

/**
 * The zoom factor for one wheel event, Chart's curve: a line-mode wheel counts sixteen
 * pixels a line and a page-mode wheel a screen, and one event moves at most 120 pixels'
 * worth, so a fast flick does not jump to the end of the range.
 */
export function wheelZoomFactor(deltaY: number, deltaMode = 0): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(-clamp(pixels, -120, 120) * 0.0016);
}
