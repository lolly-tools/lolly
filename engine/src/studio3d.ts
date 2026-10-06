// SPDX-License-Identifier: MPL-2.0
/** Portable studio recipe validation, material finishes and repeatable camera time. */
import type {
  StudioCameraKeyV1,
  StudioFinish,
  StudioFinishSpec,
  StudioLightV1,
  StudioObjectV1,
  StudioSceneV1,
  StudioSourceV1,
  StudioVector3,
} from '@lolly-tools/core';
import {
  STUDIO_CAMERA_KEY_LIMIT,
  STUDIO_CAMERA_MOTIONS,
  studioCameraPreset,
  studioCameraTravels,
  studioIsCameraPreset,
} from './studio3d-camera-path.ts';
import {
  STUDIO_ARRANGEMENT_EXTENT,
  studioActiveObject,
  studioArrangementRows,
  studioObjectId,
  studioObjectName,
} from './studio3d-arrangement.ts';
import { studioActiveValues } from './studio3d-collection.ts';
import { STUDIO_KEY_CARD_OFFSET, STUDIO_PRESET_LIGHT_POSITIONS } from './studio3d-lights.ts';
import { STUDIO_MOTION_KINDS } from './studio3d-motion.ts';

type Values = Record<string, unknown>;
function record(value: unknown): Values {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Values) : {};
}
function number(value: unknown, fallback: number, min: number, max: number): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}
function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === 'string' && choices.includes(value as T) ? (value as T) : fallback;
}
function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : fallback;
}
function enabled(value: unknown, fallback = false): boolean {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return fallback;
}
function vector(
  value: unknown,
  keys: string[],
  defaults: StudioVector3,
  limit: number
): StudioVector3 {
  const v = record(value);
  return keys.map((key, i) => number(v[key], defaults[i]!, -limit, limit)) as StudioVector3;
}
function asset(value: unknown): { id: string; url: string; name: string; format: string } {
  const v = record(value);
  return {
    id: String(v.id || ''),
    url: typeof v.url === 'string' ? v.url : '',
    name: String(v.name || v.filename || record(v.meta).name || v.url || ''),
    format: String(v.format || '').toLowerCase(),
  };
}
export const STUDIO_FINISHES: StudioFinish[] = [
  'matte',
  'satin',
  'enamel',
  'metal',
  'chrome',
  'clay',
  'velvet',
  'glow',
  'neon',
  'glass',
  'frosted',
  'pearl',
  'iridescent',
];
const FINISHES = STUDIO_FINISHES;

/** The physical values behind each finish name; the same table on every host. */
export function studioFinish(finish: StudioFinish): StudioFinishSpec {
  switch (finish) {
    case 'matte':
      return { roughness: 0.8, metalness: 0, clearcoat: 0 };
    case 'enamel':
      return { roughness: 0.22, metalness: 0, clearcoat: 0.6 };
    case 'metal':
      return { roughness: 0.23, metalness: 1, clearcoat: 0.15 };
    case 'chrome':
      return { roughness: 0.04, metalness: 1, clearcoat: 0 };
    case 'clay':
      return { roughness: 1, metalness: 0, clearcoat: 0 };
    case 'velvet':
      return { roughness: 0.95, metalness: 0, clearcoat: 0, sheen: 1, sheenRoughness: 0.85 };
    case 'glow':
      return { roughness: 0.55, metalness: 0, clearcoat: 0, emissive: 1.6 };
    case 'neon':
      return { roughness: 0.3, metalness: 0, clearcoat: 0.4, emissive: 4 };
    case 'glass':
      return { roughness: 0.05, metalness: 0, clearcoat: 0, transmission: 1, ior: 1.5, thickness: 0.6 };
    case 'frosted':
      return { roughness: 0.45, metalness: 0, clearcoat: 0, transmission: 0.9, ior: 1.45, thickness: 0.8 };
    case 'pearl':
      return {
        roughness: 0.32,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        iridescence: 0.6,
        iridescenceIOR: 1.25,
      };
    case 'iridescent':
      return { roughness: 0.18, metalness: 0.7, clearcoat: 0.3, iridescence: 1, iridescenceIOR: 1.35 };
    default:
      return { roughness: 0.4, metalness: 0, clearcoat: 0.18 };
  }
}

/** The shared typesetting for every text source in a scene. */
function textSettings(v: Values): NonNullable<StudioSourceV1['text']> {
  const family = String(v.wordFont || 'sans')
    .replace(/[^\w -]/g, '')
    .trim();
  return {
    text: '',
    font: family || 'sans',
    weight: Math.round(number(v.wordWeight, 700, 100, 900) / 100) * 100,
    tracking: number(v.wordTracking, 0, -0.2, 1),
    lineHeight: number(v.wordLineHeight, 1.1, 0.7, 2),
    align: choice(v.wordAlign, ['left', 'center', 'right'] as const, 'center'),
  };
}

function sourceFrom(
  kindValue: unknown,
  picked: { id: string; url: string; name: string; format: string },
  modelFormatValue: unknown,
  primitiveValue: unknown,
  where: string,
  allowEmpty = false,
  words?: { text: unknown; settings: NonNullable<StudioSourceV1['text']> }
): StudioSourceV1 {
  const kind = choice(kindValue, ['artwork', 'model', 'primitive', 'text'] as const, 'primitive');
  const requestedFormat = choice(modelFormatValue, ['auto', 'glb', 'stl', '3mf'] as const, 'auto');
  const modelFormat =
    requestedFormat === 'auto'
      ? choice(
          picked.format,
          ['glb', 'stl', '3mf'] as const,
          [picked.name, picked.url].some((name) => /\.3mf(?:$|[?#])/i.test(name))
            ? '3mf'
            : [picked.name, picked.url].some((name) => /\.stl(?:$|[?#])/i.test(name))
              ? 'stl'
              : 'glb'
        )
      : requestedFormat;
  if (kind === 'text') {
    const text = String(words?.text ?? '')
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
      .slice(0, 200);
    if (!text && !allowEmpty) throw new Error(`${where}Type the words to set.`);
    return {
      kind: 'text',
      id: '',
      url: '',
      primitive: 'badge',
      text: { ...(words?.settings ?? textSettings({})), text },
    };
  }
  const source: StudioSourceV1 = {
    kind: kind === 'artwork' ? 'svg' : kind === 'model' ? modelFormat : 'primitive',
    id: picked.id,
    url: picked.url,
    primitive: choice(primitiveValue, ['badge', 'sphere', 'box', 'torus'] as const, 'badge'),
  };
  if (source.kind !== 'primitive' && !source.url && !allowEmpty)
    throw new Error(
      `${where}${
        kind === 'artwork'
          ? 'Choose an SVG or upload your artwork.'
          : 'Choose or upload a GLB, STL or 3MF model.'
      }`
    );
  return source;
}

/** Arrangement rows become placed objects with stable ids; a hidden object keeps its row. */
function arrangementObjects(v: Values): StudioObjectV1[] {
  // Rows are normalised below; the shared type settings come from the scene values.
  const taken = new Set<string>();
  return studioArrangementRows(v).map((row, index) => {
    const name = studioObjectName(row, index);
    const kind = choice(row.kind, ['artwork', 'model', 'primitive', 'text'] as const, 'artwork');
    // A freshly added row has no file or words yet. It stays in the arrangement so the
    // other objects keep rendering while the person fills it in; the notes name it.
    const source = sourceFrom(kind, asset(row.asset), row.modelFormat, row.primitive, `${name}: `, true, {
      text: row.text,
      settings: textSettings(v),
    });
    const pending =
      source.kind === 'text' ? !source.text?.text : source.kind !== 'primitive' && !source.url;
    return {
      id: studioObjectId(row, index, taken),
      name,
      source,
      ...(pending ? { pending: true } : {}),
      transform: {
        rotation: [
          number(row.rotX, 0, -360, 360),
          number(row.rotY, 0, -360, 360),
          number(row.rotZ, 0, -360, 360),
        ],
        position: [
          number(row.x, 0, -STUDIO_ARRANGEMENT_EXTENT, STUDIO_ARRANGEMENT_EXTENT),
          number(row.y, 0, -STUDIO_ARRANGEMENT_EXTENT, STUDIO_ARRANGEMENT_EXTENT),
          number(row.z, 0, -STUDIO_ARRANGEMENT_EXTENT, STUDIO_ARRANGEMENT_EXTENT),
        ],
        // A row without a scale is a newcomer to a group; 0.6 is the manifest default.
        scale: number(row.scale, 0.6, 0.1, 5),
      },
      grounded: enabled(row.grounded, true),
      visible: enabled(row.visible, true),
      bindings: { a: String(row.roleA || '').trim(), b: String(row.roleB || '').trim() },
    };
  });
}

/** Normalize user inputs once; the editor, renderer and headless shell share this recipe. */
export function buildStudioScene(input: unknown): StudioSceneV1 {
  const wrapper = record(input);
  if (wrapper.version !== 1) throw new Error('This studio recipe version is not supported.');
  const v = studioActiveValues(record(wrapper.values));
  const arrangement = v.source === 'arrangement';
  const objects = arrangement ? arrangementObjects(v) : [];
  if (arrangement && !objects.some((object) => object.visible && !object.pending))
    throw new Error(
      objects.some((object) => object.pending)
        ? 'Choose a file for an object, or add a sample shape, to see the arrangement.'
        : 'Show at least one object in the arrangement.'
    );
  const kind = choice(v.source, ['artwork', 'model', 'primitive', 'text'] as const, 'primitive');
  const uploaded = asset(v.upload);
  const selected = asset(kind === 'artwork' ? v.artwork : v.modelAsset);
  const source: StudioSourceV1 = arrangement
    ? (objects.find((object) => !object.pending) ?? objects[0]!).source
    : sourceFrom(kind, uploaded.url ? uploaded : selected, v.modelFormat, v.primitive, '', false, {
        text: v.words,
        settings: textSettings(v),
      });
  const primary = color(v.colorA, '#38b98a'),
    secondary = color(v.colorB, '#173d37');
  const keyColor = color(v.keyColor, '#d9fff1'),
    fillColor = color(v.fillColor, primary),
    rimColor = color(v.rimColor, primary);
  const coolColor = color(v.coolColor, '#426dff');
  const preset = choice(
    v.studio,
    ['soft', 'dramatic', 'electric', 'warm', 'custom'] as const,
    'dramatic'
  );
  const drama = number(v.drama, 0.7, 0, 1),
    light = record(v.lightLevels);
  const intensity = number(light.key, 2.5, 0, 20),
    fill = number(light.fill, 0.7, 0, 20),
    rim = number(light.rim, 3, 0, 20);
  const softness = number(v.softness, 1.5, 0, 5);
  const placed = (role: 'key' | 'fill' | 'rim'): StudioVector3 =>
    vector(v[`${role}Position`], ['x', 'y', 'z'], STUDIO_PRESET_LIGHT_POSITIONS[role], 30);
  const keyPosition = placed('key');
  let lights: StudioLightV1[] = [
    {
      id: 'key',
      kind: 'directional',
      color: preset === 'warm' ? color(v.warmColor, '#ffc196') : keyColor,
      intensity: preset === 'soft' ? intensity * 0.7 : intensity,
      position: keyPosition,
      size: softness,
      shadows: true,
    },
    {
      id: 'fill',
      kind: 'directional',
      color: preset === 'electric' ? coolColor : fillColor,
      intensity: fill * (preset === 'soft' ? 1.6 : 1 - drama * 0.65),
      position: placed('fill'),
      size: softness,
      shadows: false,
    },
    {
      id: 'rim',
      kind: 'directional',
      color: preset === 'warm' ? color(v.warmColor, '#ffc196') : rimColor,
      intensity: rim,
      position: placed('rim'),
      size: softness,
      shadows: false,
    },
    {
      id: 'key-card',
      kind: 'area',
      color: keyColor,
      intensity: 3,
      position: keyPosition.map((n, i) => n + STUDIO_KEY_CARD_OFFSET[i]!) as StudioVector3,
      size: Math.max(0.2, softness * 2),
      shadows: false,
    },
  ];
  if (preset === 'custom') {
    if (!Array.isArray(v.lights) || !v.lights.length)
      throw new Error('Add at least one light to the custom studio.');
    if (v.lights.length > 8) throw new Error('A studio supports up to eight lights.');
    lights = v.lights.map((row, i) => {
      const l = record(row);
      const kind = choice(l.kind, ['directional', 'point', 'spot', 'area'] as const, 'directional');
      return {
        id: `light-${i + 1}`,
        kind,
        color: color(l.color, keyColor),
        intensity: number(l.intensity, 2, 0, 50),
        position: [number(l.x, -3, -30, 30), number(l.y, 6, -30, 30), number(l.z, 4, -30, 30)],
        size: number(l.size, 1.5, 0.01, 10),
        shadows: kind !== 'area' && enabled(l.shadows, true),
      };
    });
  }
  const camera = record(v.camera),
    shape = record(v.shape),
    transform = record(v.transform),
    target = record(v.target);
  const backdrop = asset(v.backdropImage);
  const background = color(v.background, secondary);
  const environmentKind = choice(
    v.environment,
    ['room', 'softbox', 'window', 'studio', 'gallery', 'warehouse', 'stage', 'desert', 'synthwave', 'image'] as const,
    'room'
  );
  const environment = asset(v.environmentImage);
  if (environmentKind === 'image' && !environment.url)
    throw new Error(
      'Choose or upload a Radiance .hdr or OpenEXR .exr map for the lighting environment.'
    );
  const projection = choice(v.projection, ['perspective', 'orthographic'] as const, 'perspective');
  const rows = Array.isArray(v.materials) ? v.materials : [];
  if (rows.length > 32) throw new Error('A studio supports up to 32 material overrides.');
  const seen = new Set<string>();
  const overrides = rows.map((row, i) => {
    const m = record(row),
      slot = String(m.slot || i + 1).trim();
    if (seen.has(slot)) throw new Error(`Material slot ${slot} has more than one override.`);
    seen.add(slot);
    const finish = typeof m.finish === 'string' && FINISHES.includes(m.finish as StudioFinish) ? (m.finish as StudioFinish) : undefined;
    return {
      slot,
      color: color(m.color, primary),
      roughness: number(m.roughness, 0.4, 0.04, 1),
      metalness: number(m.metalness, 0, 0, 1),
      clearcoat: number(m.clearcoat, 0.2, 0, 1),
      ...(finish && finish !== 'satin' ? { finish } : {}),
    };
  });
  // The live view, named before the recipe is assembled because a camera move is made
  // from it (studio3d-camera-path.ts) while the recipe is being built.
  const view: StudioSceneV1['camera'] = {
    projection,
    azimuth: number(camera.azimuth, 25, -180, 180),
    elevation: number(camera.elevation, 14, -60, 80),
    fov: number(camera.fov, 29, 15, 80),
    zoom: number(camera.zoom, 1, 0.05, 3),
    target: [
      number(target.x, 0, -5, 5) + number(camera.panX, 0, -20, 20),
      number(target.y, 1.6, -5, 10) + number(camera.panY, 0, -20, 20),
      number(target.z, 0, -5, 5) + number(camera.panZ, 0, -20, 20),
    ],
    focus: number(v.focusDistance, 0, 0, 500),
    aperture:
      projection === 'perspective' && v.depthOfField === true
        ? number(v.aperture, 0.12, 0.01, 0.5)
        : 0,
  };
  const cameraKind = choice(v.cameraMotion, STUDIO_CAMERA_MOTIONS, 'still');
  const cameraAmount = number(v.cameraAmount, 1, 0.25, 2);
  // A camera move is key data: its rows are made here, once, from the live view, so the
  // path evaluator and every shell draw a move exactly as they draw authored keys.
  const authoredKeys = cameraKeys(v);
  return {
    version: 1,
    source,
    shape: {
      depth: number(shape.depth, 0.25, 0.01, 2),
      bevel: number(shape.bevel, 0.025, 0, 0.15),
      smoothness: Math.round(number(shape.smoothness, 24, 8, 64)),
      // count keeps Smoothness as the number of chords per curve, as every earlier
      // release did; auto asks the shell to read the count off the output size.
      detail: choice(v.curveDetail, ['count', 'auto'] as const, 'count'),
    },
    transform: arrangement
      ? objects[0]!.transform
      : {
          // Words read best square to the camera; the studio's tilted default pose is
          // for objects. A wordmark can still take the scene pose on request.
          rotation:
            source.kind === 'text' && choice(v.wordPose, ['front', 'scene'] as const, 'front') === 'front'
              ? [0, 0, 0]
              : vector(v.rotation, ['x', 'y', 'z'], [-6, -16, -7], 360),
          position: vector(v.position, ['x', 'y', 'z'], [0, 0.1, 0], 10),
          scale: number(transform.scale, 1, 0.1, 5),
        },
    camera: view,
    materials: {
      mode: choice(v.materialMode, ['source', 'pair', 'custom'] as const, 'source'),
      finishA: choice(v.finishA, FINISHES, 'satin'),
      finishB: choice(v.finishB, FINISHES, 'enamel'),
      colorA: primary,
      colorB: secondary,
      overrides,
      bindings: {
        a: String(v.materialSlotA || '').trim(),
        b: String(v.materialSlotB || '').trim(),
      },
      glow: number(v.glow, 0.45, 0, 1),
      ...(enabled(v.surfaceFinishes)
        ? {
            surfaces: Object.fromEntries(
              ['a', 'b'].map((role) => [
                role,
                Object.fromEntries(
                  ['face', 'bevel', 'side'].map((surface) => [
                    surface,
                    choice(
                      v[`${surface}Finish${role.toUpperCase()}`],
                      [...FINISHES, 'inherit'],
                      'inherit'
                    ),
                  ])
                ),
              ])
            ) as NonNullable<StudioSceneV1['materials']['surfaces']>,
          }
        : {}),
    },
    lights,
    environment: {
      intensity: number(v.environmentIntensity, 0.4, 0, 3),
      rotation: number(v.environmentRotation, 0, -180, 180),
      kind: environmentKind,
      url: environmentKind === 'image' ? environment.url : '',
      id: environmentKind === 'image' ? environment.id : '',
      background: enabled(v.environmentBackground),
      blur: number(v.environmentBlur, 0.3, 0, 1),
    },
    stage: {
      output: choice(v.outputMode, ['scene', 'object-shadow', 'object'] as const, 'scene'),
      floor: choice(v.floor, ['shadow', 'matte', 'cove'] as const, 'shadow'),
      floorColor: color(v.floorColor, secondary),
      shadowOpacity: number(v.shadowOpacity, 0.4, 0, 1),
      background,
      background2: color(v.background2, primary),
      backdrop: choice(v.backdrop, ['solid', 'gradient', 'image'] as const, 'gradient'),
      backdropUrl: backdrop.url,
      backdropId: backdrop.id,
      backdropStrength: number(v.backdropStrength, 0.5, 0, 1),
      pedestal: v.pedestal === true,
      atmosphere: v.atmosphere === true,
      atmosphereForms: choice(v.atmosphereForms, ['spheres', 'copies'] as const, 'copies'),
      atmosphereSpread: number(v.atmosphereSpread, 0.5, 0, 1),
      atmosphereCount: Math.round(number(v.atmosphereCount, 7, 1, 12)),
      seed: Math.round(number(v.seed, 1, 1, 99999)),
      // The hemisphere fill the stage has always used, declared so the tie to the
      // background is visible in the recipe.
      fill: { sky: primary, ground: background, intensity: 0.12 },
    },
    exposure: number(v.exposure, 1.1, 0.1, 4),
    quality: {
      previewSamples: 8,
      exportSamples: Math.round(number(v.samples, 64, 8, 256)),
      // Motion hides sampling noise a still would show, and a clip is hundreds of frames.
      clipSamples: Math.round(number(v.videoSamples, 16, 1, 64)),
    },
    motion: {
      kind: choice(v.motion, STUDIO_MOTION_KINDS, 'still'),
      seconds: number(v.duration, 5, 1, 30),
      degrees: number(v.turnDegrees, 360, -720, 720),
      // How far a loop travels, and how much of it a one-shot loop holds the rest
      // pose at the end. The defaults are the shapes the library was drawn at.
      amount: number(v.motionAmount, 1, 0.25, 2),
      rest: number(v.motionRest, 0.25, 0, 0.6),
    },
    lightAnimation: {
      kind: choice(v.lightMotion, ['still', 'orbit', 'breathe'] as const, 'still'),
      amount: number(v.lightMotionAmount, 0.35, 0, 1),
    },
    ...(arrangement ? { objects, activeObject: studioActiveObject(v) } : {}),
    cameraMotion: {
      kind: cameraKind,
      ease: choice(v.cameraEase, ['linear', 'smooth', 'flow'] as const, 'smooth'),
      loop: enabled(v.cameraLoop),
      amount: cameraAmount,
      keys: studioIsCameraPreset(cameraKind)
        ? studioCameraPreset(cameraKind, view, cameraAmount)
        : authoredKeys,
    },
  };
}

/** A key name is a label, not a description: long enough to name a view, short enough to read. */
const STUDIO_CAMERA_KEY_NAME_LIMIT = 40;

function cameraKeys(v: Values): StudioCameraKeyV1[] {
  const rows = Array.isArray(v.cameraKeys) ? v.cameraKeys : [];
  if (rows.length > STUDIO_CAMERA_KEY_LIMIT)
    throw new Error(`A camera path holds up to ${STUDIO_CAMERA_KEY_LIMIT} keys.`);
  return rows.map((row, i) => {
    const k = record(row);
    // A name is the reader's own label for the view. An unnamed key carries no name at
    // all, so a path saved before naming existed evaluates exactly as it always did.
    const name = String(k.name || '')
      .trim()
      .slice(0, STUDIO_CAMERA_KEY_NAME_LIMIT);
    return {
      ...(name ? { name } : {}),
      at: number(k.at, rows.length > 1 ? (i / (rows.length - 1)) * 100 : 0, 0, 100) / 100,
      azimuth: number(k.azimuth, 25, -720, 720),
      elevation: number(k.elevation, 14, -60, 80),
      fov: number(k.fov, 29, 15, 80),
      zoom: number(k.zoom, 1, 0.05, 3),
      target: [
        number(k.panX, 0, -25, 25),
        number(k.panY, 1.6, -25, 25),
        number(k.panZ, 0, -25, 25),
      ],
      focus: number(k.focusDistance, 0, 0, 500),
    };
  });
}

export function studioAnimated(scene: StudioSceneV1): boolean {
  return (
    scene.motion.kind !== 'still' ||
    studioCameraTravels(scene) ||
    !!(
      scene.lightAnimation &&
      scene.lightAnimation.kind !== 'still' &&
      scene.lightAnimation.amount > 0
    )
  );
}

/** Light animation uses clip time and returns to its authored pose at every loop boundary. */
export function studioLightMotion(
  scene: StudioSceneV1,
  time: number,
  clipSeconds?: number
): { angle: number; strength: number } {
  const motion = scene.lightAnimation;
  if (!motion || motion.kind === 'still') return { angle: 0, strength: 1 };
  const seconds = Number.isFinite(time)
    ? Math.max(0, time) * (clipSeconds && clipSeconds > 0 ? clipSeconds : scene.motion.seconds)
    : 0;
  const phase = (seconds / scene.motion.seconds) % 1;
  return {
    angle: motion.kind === 'orbit' ? Math.sin(phase * 2 * Math.PI) * Math.PI * motion.amount : 0,
    strength:
      motion.kind === 'breathe'
        ? 1 - (1 - Math.cos(phase * 2 * Math.PI)) * motion.amount * 0.35
        : 1,
  };
}

export function studioTime(scene: StudioSceneV1, time: number, clipSeconds?: number): number {
  if (scene.motion.kind === 'still') return 0;
  const seconds = Number.isFinite(time)
    ? Math.max(0, time) * (clipSeconds && clipSeconds > 0 ? clipSeconds : scene.motion.seconds)
    : 0;
  return ((seconds / scene.motion.seconds) * scene.motion.degrees * Math.PI) / 180;
}
