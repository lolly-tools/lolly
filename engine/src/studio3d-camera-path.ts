// SPDX-License-Identifier: MPL-2.0
/** Camera paths: keys captured from the live view, sampled deterministically over the loop. */
import type { StudioCameraKeyV1, StudioSceneV1, StudioVector3 } from '@lolly-tools/core';

export type StudioValues = Record<string, unknown>;
export const STUDIO_CAMERA_KEY_LIMIT = 12;

function record(value: unknown): StudioValues {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as StudioValues) : {};
}
const num = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : fallback;
};

/** The pose the camera holds when it is not travelling. */
export function studioRestPose(scene: StudioSceneV1): StudioCameraKeyV1 {
  const c = scene.camera;
  return {
    at: 0,
    azimuth: c.azimuth,
    elevation: c.elevation,
    fov: c.fov,
    zoom: c.zoom,
    target: [...c.target] as StudioVector3,
    focus: c.focus,
  };
}

/** Catmull-Rom through four values; t runs 0 to 1 between the middle two. */
function spline(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t,
    t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function mix(keys: StudioCameraKeyV1[], leg: number, t: number, ease: string): StudioCameraKeyV1 {
  const a = keys[leg]!,
    b = keys[leg + 1]!;
  const pick = (key: StudioCameraKeyV1): number[] => [
    key.azimuth,
    key.elevation,
    key.fov,
    key.zoom,
    key.target[0],
    key.target[1],
    key.target[2],
    key.focus,
  ];
  let values: number[];
  if (ease === 'flow' && keys.length > 2) {
    const before = keys[Math.max(0, leg - 1)]!,
      after = keys[Math.min(keys.length - 1, leg + 2)]!;
    values = pick(a).map((_, i) =>
      spline(pick(before)[i]!, pick(a)[i]!, pick(b)[i]!, pick(after)[i]!, t)
    );
  } else {
    const s = ease === 'linear' ? t : t * t * (3 - 2 * t);
    values = pick(a).map((v, i) => v + (pick(b)[i]! - v) * s);
  }
  // Focus at 0 means automatic on either key, so a leg touching automatic stays automatic.
  const focus = a.focus > 0 && b.focus > 0 ? values[7]! : 0;
  return {
    at: a.at + (b.at - a.at) * t,
    azimuth: values[0]!,
    elevation: values[1]!,
    fov: values[2]!,
    zoom: values[3]!,
    target: [values[4]!, values[5]!, values[6]!],
    focus,
  };
}

/** Where the camera is at loop time `time` (0 to 1 of the clip); still scenes hold the rest pose. */
export function studioCameraPose(
  scene: StudioSceneV1,
  time: number,
  clipSeconds?: number
): StudioCameraKeyV1 {
  const motion = scene.cameraMotion;
  // A preset carries its synthesised rows in `keys`, so one evaluator draws every move.
  if (!motion || motion.kind === 'still' || motion.keys.length < 2) return studioRestPose(scene);
  const seconds = Number.isFinite(time)
    ? Math.max(0, time) * (clipSeconds && clipSeconds > 0 ? clipSeconds : scene.motion.seconds)
    : 0;
  // A closed loop wraps; an open move holds its last key once the clip is used up.
  const progress = seconds / scene.motion.seconds;
  const phase = motion.loop ? progress % 1 : Math.min(1, progress);
  const keys = [...motion.keys].sort((x, y) => x.at - y.at);
  if (motion.loop) keys.push({ ...keys[0]!, at: 1 });
  const first = keys[0]!,
    last = keys[keys.length - 1]!;
  if (phase <= first.at) return { ...first, at: phase };
  if (phase >= last.at) return { ...last, at: phase };
  for (let leg = 0; leg < keys.length - 1; leg++) {
    const a = keys[leg]!,
      b = keys[leg + 1]!;
    if (phase >= a.at && phase <= b.at) {
      const span = b.at - a.at;
      return mix(keys, leg, span > 0 ? (phase - a.at) / span : 1, motion.ease);
    }
  }
  return { ...last, at: phase };
}

export function studioCameraTravels(scene: StudioSceneV1): boolean {
  return (
    !!scene.cameraMotion &&
    scene.cameraMotion.kind !== 'still' &&
    scene.cameraMotion.keys.length >= 2
  );
}

/** The camera moves that are made from the live view rather than authored key by key. */
export const STUDIO_CAMERA_PRESETS = [
  'sweep',
  'pushin',
  'dolly',
  'reveal',
  'crane',
  'orbit',
] as const;
export type StudioCameraPreset = (typeof STUDIO_CAMERA_PRESETS)[number];
/** Every value the Camera select offers, in the order it offers them. */
export const STUDIO_CAMERA_MOTIONS = ['still', 'keys', ...STUDIO_CAMERA_PRESETS] as const;
export type StudioCameraMotion = (typeof STUDIO_CAMERA_MOTIONS)[number];

/** What a preset calls its rows once they are handed over as keys. */
const PRESET_NAMES: Record<StudioCameraPreset, string> = {
  sweep: 'Sweep',
  pushin: 'Push in',
  dolly: 'Dolly',
  reveal: 'Reveal',
  crane: 'Crane',
  orbit: 'Orbit',
};

/** How far the shell puts the camera from the target at zoom 1 (shells/web stage.ts). */
export const STUDIO_CAMERA_DISTANCE = 11.3;

type StudioCameraView = StudioSceneV1['camera'];

/**
 * Every synthesised number is clamped to the range a saved key holds and rounded to
 * three decimals, so a preset reads the same on every host and the rows the author
 * receives from Convert to keys are the rows the preset itself drew.
 */
function clamp(value: number, min: number, max: number): number {
  const held = Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  return Math.round(held * 1000) / 1000;
}

function presetKey(
  view: StudioCameraView,
  at: number,
  over: { azimuth?: number; elevation?: number; fov?: number; zoom?: number }
): StudioCameraKeyV1 {
  return {
    at,
    azimuth: clamp(over.azimuth ?? view.azimuth, -720, 720),
    elevation: clamp(over.elevation ?? view.elevation, -60, 80),
    fov: clamp(over.fov ?? view.fov, 15, 80),
    zoom: clamp(over.zoom ?? view.zoom, 0.05, 3),
    target: view.target.map((n) => clamp(n, -25, 25)) as StudioVector3,
    focus: clamp(view.focus, 0, 500),
  };
}

/**
 * How big the subject looks at a key: the half width of the view where the subject is,
 * which is the distance times the tangent of half the field of view. A dolly zoom holds
 * this while the lens changes, which is what makes the background slide.
 */
export function studioCameraApparentSize(view: { fov: number; zoom: number }): number {
  return (STUDIO_CAMERA_DISTANCE / view.zoom) * Math.tan((view.fov * Math.PI) / 360);
}

export function studioIsCameraPreset(kind: string): kind is StudioCameraPreset {
  return (STUDIO_CAMERA_PRESETS as readonly string[]).includes(kind);
}

/**
 * The keys a camera move is made of, drawn from the live view. `amount` (0.25 to 2)
 * scales the sweep angle, the push, the crane and the reveal's arc. An orthographic
 * camera ignores the field of view, so a dolly zoom under one makes no keys at all and
 * the camera holds still. An orbit is always one whole turn, so the amount leaves it alone.
 */
export function studioCameraPreset(
  kind: StudioCameraPreset,
  view: StudioCameraView,
  amount = 1
): StudioCameraKeyV1[] {
  const a = Math.min(2, Math.max(0.25, Number.isFinite(amount) ? amount : 1));
  switch (kind) {
    case 'sweep': {
      const angle = 20 * a;
      return [
        presetKey(view, 0, { azimuth: view.azimuth - angle }),
        presetKey(view, 0.5, { azimuth: view.azimuth + angle }),
        presetKey(view, 1, { azimuth: view.azimuth - angle }),
      ];
    }
    case 'pushin':
      return [
        presetKey(view, 0, { zoom: view.zoom * (1 - 0.15 * a) }),
        presetKey(view, 1, { zoom: view.zoom * (1 + 0.15 * a) }),
      ];
    case 'dolly': {
      if (view.projection === 'orthographic') return [];
      // Hold distance * tan(fov / 2) at the live view, so the subject keeps its size
      // while the lens goes wide. distance is 11.3 / zoom, so zoom follows tan(fov / 2).
      // The path between two keys is a straight line in both, and tan is not, so a key
      // in the middle of the lens travel keeps the subject inside 1 percent all through
      // where two keys alone let it shrink by nearly 3 percent halfway.
      const half = (fov: number) => Math.tan((fov * Math.PI) / 360);
      const zoomFor = (fov: number) => (view.zoom * half(fov)) / half(view.fov);
      return [60, 42, 24].map((fov, i) =>
        presetKey(view, i / 2, { fov, zoom: zoomFor(fov) })
      );
    }
    case 'reveal':
      return [
        presetKey(view, 0, {
          azimuth: view.azimuth - 90 * a,
          elevation: 30,
          zoom: view.zoom * 0.8,
        }),
        presetKey(view, 1, {}),
      ];
    case 'crane':
      return [
        presetKey(view, 0, {
          elevation: view.elevation + 25 * a,
          zoom: view.zoom * (1 - 0.15 * a),
        }),
        presetKey(view, 1, {}),
      ];
    case 'orbit':
      // One whole turn about the target, from the live view and back to the same view,
      // with the elevation and the distance held. The turn is two keys 360 degrees
      // apart, so the evaluator interpolates the angle itself: no frame inside the clip
      // repeats the first, and the frame after the last is the first again. The angle
      // rises, which is the direction the older 3D tool's orbit went.
      return [presetKey(view, 0, {}), presetKey(view, 1, { azimuth: view.azimuth + 360 })];
  }
}

/** The preset's keys as saved rows, named so the author can tell them apart. */
export function studioCameraPresetRows(scene: StudioSceneV1): StudioValues[] {
  const motion = scene.cameraMotion;
  const kind = motion?.kind ?? 'still';
  if (!motion || !studioIsCameraPreset(kind)) throw new Error('No camera move is chosen.');
  return motion.keys.map((key, i) => ({
    at: Math.round(key.at * 1000) / 10,
    azimuth: key.azimuth,
    elevation: key.elevation,
    fov: key.fov,
    zoom: key.zoom,
    panX: key.target[0],
    panY: key.target[1],
    panZ: key.target[2],
    focusDistance: key.focus,
    name: `${PRESET_NAMES[kind]} ${i + 1}`,
  }));
}

/** Convert to keys: the move becomes editable rows, in one edit so one undo takes it back. */
export function studioCameraPresetEdit(scene: StudioSceneV1): { id: string; value: unknown }[] {
  const rows = studioCameraPresetRows(scene);
  if (rows.length < 2) throw new Error('This camera move makes no keys for the current view.');
  return [
    { id: 'cameraKeys', value: rows },
    { id: 'cameraMotion', value: 'keys' },
  ];
}

/** A key row from the live camera values, as the sidebar stores them. */
export function studioCameraKeyFromView(values: StudioValues): StudioValues {
  const camera = record(values.camera),
    target = record(values.target);
  return {
    azimuth: num(camera.azimuth, 25),
    elevation: num(camera.elevation, 14),
    fov: num(camera.fov, 29),
    zoom: num(camera.zoom, 1),
    panX: num(num(target.x, 0) + num(camera.panX, 0), 0),
    panY: num(num(target.y, 1.6) + num(camera.panY, 0), 1.6),
    panZ: num(num(target.z, 0) + num(camera.panZ, 0), 0),
    focusDistance: num(values.focusDistance, 0),
  };
}

/** Append the live view as a key; keys are spaced evenly in time when one is added. */
export function studioAddCameraKey(values: StudioValues): { id: string; value: unknown } {
  const rows = Array.isArray(values.cameraKeys) ? (values.cameraKeys as StudioValues[]) : [];
  if (rows.length >= STUDIO_CAMERA_KEY_LIMIT)
    throw new Error(`A camera path holds up to ${STUDIO_CAMERA_KEY_LIMIT} keys.`);
  const next = [...rows, studioCameraKeyFromView(values)];
  return {
    id: 'cameraKeys',
    value: next.map((row, i) => ({
      ...row,
      at: Math.round((next.length > 1 ? (i / (next.length - 1)) * 100 : 0) * 10) / 10,
    })),
  };
}

function cameraKeyRows(values: StudioValues): StudioValues[] {
  return Array.isArray(values.cameraKeys) ? (values.cameraKeys as StudioValues[]) : [];
}

/** A key's own name, as the recipe normalises it: trimmed, at most 40 characters, often empty. */
export function studioCameraKeyName(row: StudioValues | undefined): string {
  return String(row?.name || '')
    .trim()
    .slice(0, 40);
}

/** How a key reads in the preview: its number in the path, and its name when it has one. */
export function studioCameraKeyLabel(values: StudioValues, index: number): string {
  const rows = cameraKeyRows(values);
  const name = studioCameraKeyName(rows[index]);
  return `Key ${index + 1} of ${rows.length}${name ? `: ${name}` : ''}`;
}

/**
 * The saved camera values that show a key's view, for a jump to it. `which` is the key's
 * position in the path, or a name the reader gave one, matched whatever the letter case.
 */
export function studioCameraFromKey(
  values: StudioValues,
  which: number | string
): { id: string; value: unknown }[] {
  const rows = cameraKeyRows(values);
  // An empty name matches nothing: unnamed keys are reached by position, never by name.
  const wanted = typeof which === 'string' ? which.trim().toLowerCase() : '';
  const key =
    typeof which === 'number'
      ? rows[which]
      : wanted
        ? rows.find((row) => studioCameraKeyName(row).toLowerCase() === wanted)
        : undefined;
  if (!key) throw new Error('That camera key does not exist.');
  const target = record(values.target);
  return [
    {
      id: 'camera',
      value: {
        azimuth: num(key.azimuth, 25),
        elevation: num(key.elevation, 14),
        fov: num(key.fov, 29),
        zoom: num(key.zoom, 1),
        panX: num(num(key.panX, 0) - num(target.x, 0), 0),
        panY: num(num(key.panY, 1.6) - num(target.y, 1.6), 0),
        panZ: num(num(key.panZ, 0) - num(target.z, 0), 0),
      },
    },
    { id: 'focusDistance', value: num(key.focusDistance, 0) },
  ];
}
