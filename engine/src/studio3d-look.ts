// SPDX-License-Identifier: MPL-2.0
/**
 * The boundary between a studio and a document (plan 265 step 2, milestone 2 lane A).
 *
 * A studio is the half of a 3D Studio document that can be reused: the lighting rig
 * and its animation, the environment, the materials mode and pair, the surface
 * finishes, the glow, the stage, the exposure, the render quality, the extrusion the
 * studio gives a flat mark, the camera projection and field of view, the motion and
 * the camera path. The other half stays with the document: the source and its words,
 * the collection and arrangement rows, the object placement, the orbit, elevation,
 * zoom, pan and focus, the output mode and the per-slot material overrides.
 *
 * Both halves are named here as data, so a saved studio is a plain values map and the
 * partition can be checked against the tool manifest by a test rather than by reading.
 * `tests/studio3d-look.test.ts` asserts that every input id in
 * `community/3d-studio/tool.json` is covered exactly once.
 *
 * A key is an input id, or `<inputId>.<field>` for one field of a vector input. Only
 * the camera needs the second form: its seven fields hold both the field of view,
 * which belongs to the studio, and the orbit, elevation, zoom and pan, which belong
 * to the document.
 *
 * Everything here is pure. Applying a studio writes ordinary input values, so the
 * recipe, URL mode, the CLI and MCP never see a reference: `buildStudioScene` reads
 * the same values it always did.
 */

export type StudioLookValues = Record<string, unknown>;

/**
 * What a saved studio carries. Order is the manifest's own, so a saved studio reads
 * in the order its controls appear.
 */
export const STUDIO_LOOK_KEYS: readonly string[] = [
  // Look
  'studio',
  'materialMode',
  'colorA',
  'colorB',
  'finishA',
  'finishB',
  'glow',
  'surfaceFinishes',
  'faceFinishA',
  'bevelFinishA',
  'sideFinishA',
  'faceFinishB',
  'bevelFinishB',
  'sideFinishB',
  'drama',
  'softness',
  'exposure',
  'lightMotion',
  'lightMotionAmount',
  // Shape: how the studio builds a flat mark into a solid. One depth and bevel is
  // shared by every object in an arrangement, which is what makes it studio-wide.
  'shape',
  'curveDetail',
  // Camera language, without the framing.
  'projection',
  'camera.fov',
  // Lens character. The focus distance depends on the subject, so it stays below.
  'depthOfField',
  'aperture',
  // Depth forms sit in front of and behind the subject, as part of the set.
  'atmosphere',
  'atmosphereForms',
  'atmosphereSpread',
  'atmosphereCount',
  'seed',
  // Stage
  'backdrop',
  'background',
  'background2',
  'backdropImage',
  'backdropStrength',
  'floor',
  'floorColor',
  'shadowOpacity',
  'pedestal',
  // Lighting rig and environment
  'keyColor',
  'fillColor',
  'rimColor',
  'coolColor',
  'warmColor',
  'lightLevels',
  'keyPosition',
  'fillPosition',
  'rimPosition',
  'environment',
  'environmentImage',
  'environmentBackground',
  'environmentBlur',
  'environmentIntensity',
  'environmentRotation',
  'lights',
  // Quality
  'samples',
  'videoSamples',
  // Motion and the camera path
  'motion',
  'motionAmount',
  'motionRest',
  'cameraMotion',
  'cameraAmount',
  'cameraKeys',
  'cameraEase',
  'cameraLoop',
  'duration',
  'turnDegrees',
];

/** What stays with the document when a studio is applied to it. */
export const STUDIO_INSTANCE_KEYS: readonly string[] = [
  // The subject
  'controls',
  'source',
  'primitive',
  'artwork',
  'modelAsset',
  'modelFormat',
  // A model's own animation belongs to the model, so a saved studio leaves both alone.
  'playClip',
  'clipIndex',
  'words',
  'wordFont',
  'wordWeight',
  'wordPose',
  'wordTracking',
  'wordLineHeight',
  'wordAlign',
  // The collection and the arrangement
  'collectionName',
  'activeSubject',
  'subjects',
  'activeObject',
  'objects',
  // Framing
  'rotation',
  'position',
  'transform',
  'target',
  'camera.azimuth',
  'camera.elevation',
  'camera.zoom',
  'camera.panX',
  'camera.panY',
  'camera.panZ',
  'focusDistance',
  // The slots and overrides of this document's own model
  'materials',
  'materialSlotA',
  'materialSlotB',
  // Delivery
  'outputMode',
  'collectionSize',
  // The link itself
  'studioRef',
  'studioOverrides',
];

/** The input id a key lives on: `camera.fov` is a field of the `camera` input. */
export function studioKeyInput(key: string): string {
  const dot = key.indexOf('.');
  return dot < 0 ? key : key.slice(0, dot);
}

/** The field of a vector input a key names, or null for a whole input. */
export function studioKeyField(key: string): string | null {
  const dot = key.indexOf('.');
  return dot < 0 ? null : key.slice(dot + 1);
}

/** The input ids a saved studio writes to. Deduplicated, manifest order. */
export const STUDIO_LOOK_INPUT_IDS: readonly string[] = [
  ...new Set(STUDIO_LOOK_KEYS.map(studioKeyInput)),
];

function record(value: unknown): StudioLookValues {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as StudioLookValues)
    : {};
}

/** A copy deep enough that a caller cannot reach back into the source values. */
function clone<T>(value: T): T {
  return value === undefined || value === null || typeof value !== 'object'
    ? value
    : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * The studio half of a document's values. A key the document has no value for is
 * left out, so a studio saved from a document that never touched a control does not
 * pin that control's default onto every document it is applied to.
 */
export function studioLookOf(values: StudioLookValues): StudioLookValues {
  const look: StudioLookValues = {};
  for (const key of STUDIO_LOOK_KEYS) {
    const id = studioKeyInput(key);
    const field = studioKeyField(key);
    if (field === null) {
      if (values[id] !== undefined) look[id] = clone(values[id]);
      continue;
    }
    const from = record(values[id]);
    if (from[field] === undefined) continue;
    const into = record(look[id]);
    into[field] = clone(from[field]);
    look[id] = into;
  }
  return look;
}

/**
 * Apply a studio to a document. `overrides` names input ids the document owns: a
 * control the reader changed after applying a studio keeps its value, and so does
 * every look field on the same input. Whole-input granularity is deliberate, because
 * the hook that records an override sees the input that changed and not which of a
 * vector's fields moved: an orbit therefore protects the field of view as well.
 *
 * The returned values are the document's, with the studio written over them. Fields
 * of a vector input are merged, so applying a studio to a document that is framed its
 * own way changes the field of view and leaves the orbit where the reader put it.
 */
export function studioApplyLook(
  values: StudioLookValues,
  look: StudioLookValues,
  overrides: readonly string[] = []
): StudioLookValues {
  const kept = new Set(overrides.map(studioKeyInput));
  const next: StudioLookValues = { ...values };
  for (const key of STUDIO_LOOK_KEYS) {
    const id = studioKeyInput(key);
    if (kept.has(id)) continue;
    const field = studioKeyField(key);
    if (field === null) {
      if (look[id] !== undefined) next[id] = clone(look[id]);
      continue;
    }
    const from = record(look[id]);
    if (from[field] === undefined) continue;
    next[id] = { ...record(next[id]), [field]: clone(from[field]) };
  }
  return next;
}

/** A studio reference: the saved studio's id and the version of it that was applied. */
export interface StudioRef {
  id: string;
  version: number;
}

/** `<templateId>@<lookVersion>`, or null when the text is not one. */
export function studioParseRef(value: unknown): StudioRef | null {
  const text = String(value ?? '').trim();
  const at = text.lastIndexOf('@');
  if (at <= 0 || at === text.length - 1) return null;
  const id = text.slice(0, at);
  const version = Number(text.slice(at + 1));
  if (!Number.isInteger(version) || version < 1) return null;
  return { id, version };
}

/** The text form of a reference. */
export function studioFormatRef(ref: StudioRef): string {
  return `${ref.id}@${ref.version}`;
}

/** The override list a document carries, as input ids. Anything else is ignored. */
export function studioParseOverrides(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    try {
      parsed = JSON.parse(text);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const ids = new Set<string>();
  for (const entry of parsed) {
    const id = studioKeyInput(String(entry ?? '').trim());
    if (STUDIO_LOOK_INPUT_IDS.includes(id)) ids.add(id);
  }
  return [...ids].sort();
}

/** The text form of an override list, written back into `studioOverrides`. */
export function studioFormatOverrides(ids: readonly string[]): string {
  const clean = studioParseOverrides(ids);
  return clean.length ? JSON.stringify(clean) : '';
}

/**
 * Record a control the reader changed while a studio is attached. Returns the list
 * unchanged when the id is not a studio control, so a caller can write the result
 * back without checking.
 */
export function studioRecordOverride(overrides: unknown, changedId: string): string[] {
  const ids = studioParseOverrides(overrides);
  const id = studioKeyInput(String(changedId ?? ''));
  if (!STUDIO_LOOK_INPUT_IDS.includes(id) || ids.includes(id)) return ids;
  return [...ids, id].sort();
}
