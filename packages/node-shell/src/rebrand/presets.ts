// SPDX-License-Identifier: MPL-2.0
/**
 * Renovation presets for a terminal, a script or a test (plan 274 section 2.2).
 *
 * A preset is `RenovationPresetV1` (`@lolly-tools/core`): a few stated
 * differences from the first pass's own rules, such as "remove page numbers
 * without asking" or "prefer the content layout on a tie". It travels as data,
 * never as code, in the same file shape a slide master uses:
 *
 *   { "version": 1, "presets": [ { "id": "tidy", "name": "Tidy", ... } ] }
 *
 * WHERE PRESETS COME FROM, in the order they are listed and looked up:
 *
 *   1. The active content profile's design system: every `data` asset tagged
 *      `slides` and `rebrand-preset`, in asset id order, the way the slide
 *      master is found (`lolly/slides/presets` in lolly-start).
 *   2. The personal presets file, `rebrand-presets.json` in the state directory
 *      (`LOLLY_STATE_DIR`, see state-dir.ts), which a person writes by hand or a
 *      later "Save as my preset" writes for them.
 *
 * An id both places hold resolves to the design system's preset, and the
 * personal one is listed as shadowed, so a team preset means the same thing on
 * every machine that has the pack. A personal preset that wants to differ takes
 * its own id.
 *
 * `resolvePreset(spec)` takes an id or a file. A spec ending in `.json`, or
 * naming a path, is a file: one preset object, or a preset file that holds
 * exactly one. Anything else is an id looked up in the two places above. The
 * failures carry stable codes (`RebrandPresetError.code`):
 *
 *   preset.unknown     no preset has that id here
 *   preset.invalid     the preset does not validate; the message lists why
 *   preset.unreadable  the file could not be read or is not JSON
 *
 * VALIDATION is `presetProblems`: every field the engine reads is checked
 * against the contract's own lists (object classes, actions, review states),
 * an archetype is one of the twelve or a layout library id written the way the
 * contract writes one (`isArchetypeRef`), and a field the engine does not read is
 * a problem, so a typo
 * such as `action` for `actions` is caught rather than silently ignored. `name`
 * and `description` are the two fields a file may carry for people and the
 * engine never sees; `toRenovationPreset` drops them. A preset may propose
 * `replace` only for the two logo classes, since those are the only classes
 * whose replacement the first pass can name.
 *
 * Reads files and nothing else: no network, no clock.
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

import { ARCHETYPE_IDS, OBJECT_CLASSES, PLAN_ACTIONS, REVIEW_STATES, isArchetypeRef, type RenovationPresetV1 } from '@lolly-tools/core';

import { contentRoots, contentUrlFile, readAssetIndex, type ContentRoots } from '../content-roots.ts';
import { stateDir } from '../state-dir.ts';

// ─── the file ────────────────────────────────────────────────────────────────

/** The tags a design system's preset asset carries. */
export const PRESET_ASSET_TAGS = ['slides', 'rebrand-preset'] as const;
/** Format stamp of a preset file. */
export const PRESET_FILE_VERSION = 1 as const;
/** The personal presets file, inside the state directory. */
export const PERSONAL_PRESETS_FILE = 'rebrand-presets.json';

/** A preset as a file holds it: the engine's fields plus a name and a sentence for people. */
export interface PresetEntryV1 extends RenovationPresetV1 {
  name?: string;
  description?: string;
}

/** A preset file on disk. */
export interface PresetFileV1 {
  version: typeof PRESET_FILE_VERSION;
  presets: PresetEntryV1[];
}

export type PresetErrorCodeV1 = 'preset.unknown' | 'preset.invalid' | 'preset.unreadable';

/** A preset failure with a stable code, so a caller branches on `code`, never on the wording. */
export class RebrandPresetError extends Error {
  readonly code: PresetErrorCodeV1;
  constructor(code: PresetErrorCodeV1, message: string) {
    super(message);
    this.name = 'RebrandPresetError';
    this.code = code;
  }
}

// ─── validation ──────────────────────────────────────────────────────────────

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const LOGO_POLICIES = ['brand', 'keep', 'drop'] as const;
/** The classes a preset may propose `replace` for: the first pass names their replacement. */
const REPLACEABLE_CLASSES: readonly string[] = ['known-logo', 'logo-candidate'];
const ENGINE_FIELDS = ['id', 'version', 'actions', 'review', 'layout', 'logo', 'excludeSlideIds', 'minSeparation', 'lockedColors'] as const;
const PEOPLE_FIELDS = ['name', 'description'] as const;
/**
 * The layout fields. `bySourceLayoutName` and `byStructure` are plan 275's; a build
 * from before them refuses a preset that uses one as "not a layout field", which is
 * the forward-compatibility policy: refuse with this build's own message, never misread.
 */
const LAYOUT_FIELDS = ['bySourceLayout', 'bySourceLayoutName', 'byStructure', 'fallback', 'minGap'] as const;
/** The three layout maps and what their keys name, for the messages. */
const LAYOUT_MAPS = [
  ['bySourceLayout', 'source layout part'],
  ['bySourceLayoutName', 'source layout name'],
  ['byStructure', 'structure signature or layout library id'],
] as const;
/** A map key that names a built-in property of every JavaScript object, refused whatever the map. */
const RESERVED_KEYS: readonly string[] = ['__proto__', 'constructor', 'prototype'];
/** What an archetype value takes, said once for every message. */
const ARCHETYPE_WORDS = `one of ${ARCHETYPE_IDS.join(', ')}, or a layout library id in lower case letters, digits and dashes`;

const has = (list: readonly string[], value: unknown): boolean => typeof value === 'string' && list.includes(value);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Checks a per-class map (`actions` or `review`) against the contract's lists. */
function classMapProblems(field: string, value: unknown, allowed: readonly string[], out: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    out.push(`"${field}" is an object from object class to value`);
    return;
  }
  for (const [klass, entry] of Object.entries(value)) {
    if (!has(OBJECT_CLASSES, klass)) out.push(`"${field}.${klass}" is not an object class; the classes are ${OBJECT_CLASSES.join(', ')}`);
    else if (!has(allowed, entry)) out.push(`"${field}.${klass}" is ${JSON.stringify(entry)}; it takes one of ${allowed.join(', ')}`);
  }
}

/**
 * Why a value is not a renovation preset this build can apply, one plain
 * sentence each. Empty when it validates.
 */
export function presetProblems(value: unknown): string[] {
  const out: string[] = [];
  if (!isRecord(value)) return ['a preset is a JSON object'];

  for (const key of Object.keys(value)) {
    if (!has(ENGINE_FIELDS, key) && !has(PEOPLE_FIELDS, key)) out.push(`"${key}" is not a preset field`);
  }
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) {
    out.push('"id" is a string of letters, digits, dots, slashes, dashes or underscores, 1 to 128 long');
  }
  for (const key of ['version', 'name', 'description'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'string') out.push(`"${key}" is a string`);
  }

  classMapProblems('actions', value.actions, PLAN_ACTIONS, out);
  classMapProblems('review', value.review, REVIEW_STATES, out);
  if (isRecord(value.actions)) {
    for (const [klass, action] of Object.entries(value.actions)) {
      if (action === 'replace' && has(OBJECT_CLASSES, klass) && !REPLACEABLE_CLASSES.includes(klass)) {
        out.push(`"actions.${klass}" is replace, and only a logo has a replacement the first pass can name`);
      }
    }
  }

  const layout = value.layout;
  if (layout !== undefined) {
    if (!isRecord(layout)) {
      out.push('"layout" is an object');
    } else {
      for (const key of Object.keys(layout)) {
        if (!has(LAYOUT_FIELDS, key)) out.push(`"layout.${key}" is not a layout field`);
      }
      for (const [field, keyWords] of LAYOUT_MAPS) {
        const map = layout[field];
        if (map === undefined) continue;
        if (!isRecord(map)) {
          out.push(`"layout.${field}" is an object from ${keyWords} to archetype`);
          continue;
        }
        for (const [name, archetype] of Object.entries(map)) {
          if (!name || name.length > 512 || RESERVED_KEYS.includes(name)) out.push(`"layout.${field}" has the key ${JSON.stringify(name)}, which is not a ${keyWords}`);
          else if (!isArchetypeRef(archetype)) out.push(`"layout.${field}.${name}" is ${JSON.stringify(archetype)}; it takes ${ARCHETYPE_WORDS}`);
        }
      }
      if (layout.fallback !== undefined && !isArchetypeRef(layout.fallback)) {
        out.push(`"layout.fallback" is ${JSON.stringify(layout.fallback)}; it takes ${ARCHETYPE_WORDS}`);
      }
      if (layout.minGap !== undefined && !(typeof layout.minGap === 'number' && Number.isFinite(layout.minGap) && layout.minGap >= 0)) {
        out.push('"layout.minGap" is a number from 0 up');
      }
    }
  }

  const logo = value.logo;
  if (logo !== undefined) {
    if (!isRecord(logo)) out.push('"logo" is an object with a "policy"');
    else {
      if (!has(LOGO_POLICIES, logo.policy)) out.push(`"logo.policy" takes one of ${LOGO_POLICIES.join(', ')}`);
      if (logo.variantByBackground !== undefined && typeof logo.variantByBackground !== 'boolean') out.push('"logo.variantByBackground" is true or false');
      for (const key of Object.keys(logo)) {
        if (key !== 'policy' && key !== 'variantByBackground') out.push(`"logo.${key}" is not a logo field`);
      }
    }
  }

  if (value.excludeSlideIds !== undefined
    && !(Array.isArray(value.excludeSlideIds) && value.excludeSlideIds.every((id) => typeof id === 'string'))) {
    out.push('"excludeSlideIds" is a list of slide ids');
  }
  if (value.minSeparation !== undefined
    && !(typeof value.minSeparation === 'number' && Number.isFinite(value.minSeparation) && value.minSeparation > 0)) {
    out.push('"minSeparation" is a number above 0');
  }
  if (value.lockedColors !== undefined) {
    if (!Array.isArray(value.lockedColors)) out.push('"lockedColors" is a list');
    else {
      value.lockedColors.forEach((lock, index) => {
        if (!isRecord(lock) || typeof lock.useId !== 'string' || !lock.useId) out.push(`"lockedColors[${index}].useId" is a colour use id`);
        else if (typeof lock.to !== 'string' || !HEX_PATTERN.test(lock.to)) out.push(`"lockedColors[${index}].to" is a colour written #rrggbb`);
        else if (lock.toPath !== undefined && typeof lock.toPath !== 'string') out.push(`"lockedColors[${index}].toPath" is a token path`);
      });
    }
  }
  return out;
}

/** The fields the engine reads, copied, with the two fields for people dropped. */
export function toRenovationPreset(entry: PresetEntryV1): RenovationPresetV1 {
  const out: RenovationPresetV1 = { id: entry.id };
  if (entry.version !== undefined) out.version = entry.version;
  if (entry.actions) out.actions = { ...entry.actions };
  if (entry.review) out.review = { ...entry.review };
  if (entry.layout) {
    out.layout = { ...entry.layout };
    if (entry.layout.bySourceLayout) out.layout.bySourceLayout = { ...entry.layout.bySourceLayout };
    if (entry.layout.bySourceLayoutName) out.layout.bySourceLayoutName = { ...entry.layout.bySourceLayoutName };
    if (entry.layout.byStructure) out.layout.byStructure = { ...entry.layout.byStructure };
  }
  if (entry.logo) out.logo = { ...entry.logo };
  if (entry.excludeSlideIds) out.excludeSlideIds = [...entry.excludeSlideIds];
  if (entry.minSeparation !== undefined) out.minSeparation = entry.minSeparation;
  if (entry.lockedColors) out.lockedColors = entry.lockedColors.map((lock) => ({ ...lock }));
  return out;
}

// ─── reading ─────────────────────────────────────────────────────────────────

/** Where a resolved preset came from. */
export type PresetOriginV1 = 'pack' | 'personal' | 'file';

/** One preset that validates, with where it came from. */
export interface ResolvedPresetV1 {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  /** What the first pass takes. */
  preset: RenovationPresetV1;
  origin: PresetOriginV1;
  /** The file it was read from. */
  file: string;
  /** The catalog asset, for a design-system preset. */
  assetId?: string;
  /** True for a personal preset whose id a design-system preset also holds. */
  shadowed?: boolean;
}

/** One preset (or file) that was found and could not be used, and why. */
export interface PresetProblemV1 {
  origin: PresetOriginV1;
  file: string;
  id?: string;
  assetId?: string;
  problems: string[];
}

/** Everything that resolves here, and everything that was found but did not validate. */
export interface PresetListingV1 {
  /** The content profile the design-system presets were read from, or null when none resolves. */
  profile: string | null;
  /** The personal presets file, whether or not it exists. */
  personalFile: string;
  presets: ResolvedPresetV1[];
  invalid: PresetProblemV1[];
}

export interface PresetOptsV1 {
  /** A content profile name; the active one (LOLLY_PROFILE, then the default) when left out. */
  profile?: string;
  /** A checkout or content root other than the one the marker walk finds. */
  root?: string;
  /** The environment the state directory is read from. `process.env` when left out. */
  env?: NodeJS.ProcessEnv;
  /** The personal presets file, in place of `<state dir>/rebrand-presets.json`. */
  personalFile?: string;
}

/** A parsed file's entries: a preset file, or one bare preset object. */
function entriesOf(parsed: unknown): unknown[] | null {
  if (!isRecord(parsed)) return null;
  if (Array.isArray(parsed.presets)) return parsed.version === PRESET_FILE_VERSION ? parsed.presets : null;
  return typeof parsed.id === 'string' ? [parsed] : null;
}

/** Reads one preset file; throws `preset.unreadable` when it cannot. */
function readPresetFile(file: string): unknown[] {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    throw new RebrandPresetError('preset.unreadable', `The preset file ${file} could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new RebrandPresetError('preset.unreadable', `The preset file ${file} is not JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  const entries = entriesOf(parsed);
  if (!entries) {
    throw new RebrandPresetError('preset.invalid', `The preset file ${file} is not a preset: it holds one preset object with an "id", or {"version": 1, "presets": [...]}.`);
  }
  return entries;
}

/** Splits a file's entries into the presets that validate and the problems of the rest. */
function sortEntries(
  entries: unknown[],
  where: { origin: PresetOriginV1; file: string; assetId?: string },
): { good: ResolvedPresetV1[]; bad: PresetProblemV1[] } {
  const good: ResolvedPresetV1[] = [];
  const bad: PresetProblemV1[] = [];
  for (const entry of entries) {
    const problems = presetProblems(entry);
    const id = isRecord(entry) && typeof entry.id === 'string' ? entry.id : undefined;
    if (problems.length > 0) {
      bad.push({ ...where, ...(id !== undefined ? { id } : {}), problems });
      continue;
    }
    const preset = entry as PresetEntryV1;
    good.push({
      id: preset.id,
      ...(preset.name !== undefined ? { name: preset.name } : {}),
      ...(preset.description !== undefined ? { description: preset.description } : {}),
      ...(preset.version !== undefined ? { version: preset.version } : {}),
      preset: toRenovationPreset(preset),
      ...where,
    });
  }
  return { good, bad };
}

interface IndexAsset {
  id: string;
  type?: string;
  tags?: string[];
  deprecated?: boolean;
  formats?: Array<{ url?: string }>;
}

/** The design system's preset assets, in asset id order, with the file behind each. */
function packPresetFiles(roots: ContentRoots): Array<{ assetId: string; file: string | null }> {
  const index = readAssetIndex(roots) as { assets?: unknown[] };
  const assets = (index.assets ?? []).filter((a): a is IndexAsset => isRecord(a) && typeof a.id === 'string');
  return assets
    .filter((asset) => asset.deprecated !== true && asset.type === 'data'
      && PRESET_ASSET_TAGS.every((tag) => Array.isArray(asset.tags) && asset.tags.includes(tag)))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((asset) => {
      let file: string | null = null;
      for (const format of asset.formats ?? []) {
        file = format.url ? contentUrlFile(format.url, roots) : null;
        if (file) break;
      }
      return { assetId: asset.id, file };
    });
}

/** The personal presets file for these options. */
export function personalPresetsFile(opts: PresetOptsV1 = {}): string {
  return opts.personalFile ?? join(stateDir(opts.env ?? process.env), PERSONAL_PRESETS_FILE);
}

/**
 * Every preset that resolves for the active content profile: the design
 * system's first, then the personal file's. A file that cannot be read and a
 * preset that does not validate are listed under `invalid` rather than thrown,
 * so one broken file does not hide the rest.
 */
export function listPresets(opts: PresetOptsV1 = {}): PresetListingV1 {
  const presets: ResolvedPresetV1[] = [];
  const invalid: PresetProblemV1[] = [];
  const personalFile = personalPresetsFile(opts);

  let roots: ContentRoots | null = null;
  try {
    roots = contentRoots({
      ...(opts.profile !== undefined ? { profile: opts.profile } : {}),
      ...(opts.root !== undefined ? { root: opts.root } : {}),
    });
  } catch {
    roots = null;
  }
  if (roots) {
    let files: Array<{ assetId: string; file: string | null }> = [];
    try {
      files = packPresetFiles(roots);
    } catch (err) {
      invalid.push({ origin: 'pack', file: roots.profile, problems: [`the asset index could not be read: ${err instanceof Error ? err.message : String(err)}`] });
    }
    for (const { assetId, file } of files) {
      if (!file) {
        invalid.push({ origin: 'pack', file: assetId, assetId, problems: ['the asset has no file on disk'] });
        continue;
      }
      try {
        const sorted = sortEntries(readPresetFile(file), { origin: 'pack', file, assetId });
        presets.push(...sorted.good);
        invalid.push(...sorted.bad);
      } catch (err) {
        invalid.push({ origin: 'pack', file, assetId, problems: [err instanceof Error ? err.message : String(err)] });
      }
    }
  }

  if (existsSync(personalFile)) {
    try {
      const sorted = sortEntries(readPresetFile(personalFile), { origin: 'personal', file: personalFile });
      // A design-system preset that does not validate still holds its id, so a
      // personal preset never stands in for it on one machine and not another.
      const packIds = new Set([
        ...presets.filter((one) => one.origin === 'pack').map((one) => one.id),
        ...invalid.filter((one) => one.origin === 'pack' && one.id !== undefined).map((one) => one.id),
      ]);
      for (const one of sorted.good) presets.push(packIds.has(one.id) ? { ...one, shadowed: true } : one);
      invalid.push(...sorted.bad);
    } catch (err) {
      invalid.push({ origin: 'personal', file: personalFile, problems: [err instanceof Error ? err.message : String(err)] });
    }
  }

  // Inside one origin a repeated id resolves to its first entry; the later one is
  // reported rather than left to win or lose silently.
  const seen = new Set<string>();
  const kept: ResolvedPresetV1[] = [];
  for (const one of presets) {
    const key = `${one.shadowed ? 'shadowed:' : ''}${one.id}`;
    if (seen.has(key)) {
      invalid.push({ origin: one.origin, file: one.file, id: one.id, ...(one.assetId ? { assetId: one.assetId } : {}), problems: [`the id ${one.id} is already taken by an earlier preset`] });
      continue;
    }
    seen.add(key);
    kept.push(one);
  }
  return { profile: roots?.profile ?? null, personalFile, presets: kept, invalid };
}

/** True when a `--preset` value names a file rather than an id. */
export function isPresetFileSpec(spec: string): boolean {
  return /\.json$/i.test(spec) || spec.startsWith('.') || isAbsolute(spec) || spec.includes('\\');
}

/**
 * The preset a `--preset` value names: a file (see `isPresetFileSpec`), else an
 * id among the presets `listPresets` finds. Throws `RebrandPresetError`.
 */
export function resolvePreset(spec: string, opts: PresetOptsV1 = {}): ResolvedPresetV1 {
  if (!spec) throw new RebrandPresetError('preset.unknown', 'A preset is named by an id or a .json file.');
  if (isPresetFileSpec(spec)) {
    const file = resolve(spec);
    const sorted = sortEntries(readPresetFile(file), { origin: 'file', file });
    const bad = sorted.bad[0];
    if (bad) {
      const named = bad.id !== undefined ? `The preset ${bad.id} in ${file}` : `The preset in ${file}`;
      throw new RebrandPresetError('preset.invalid', `${named} does not validate: ${bad.problems.join('; ')}.`);
    }
    if (sorted.good.length !== 1) {
      throw new RebrandPresetError('preset.invalid', `${file} holds ${sorted.good.length} presets (${sorted.good.map((one) => one.id).join(', ')}); a file named by --preset holds one.`);
    }
    return sorted.good[0]!;
  }

  const listing = listPresets(opts);
  const found = listing.presets.find((one) => one.id === spec && !one.shadowed);
  if (found) return found;
  const broken = listing.invalid.find((one) => one.id === spec && one.origin === 'pack')
    ?? listing.invalid.find((one) => one.id === spec);
  if (broken) {
    throw new RebrandPresetError('preset.invalid', `The preset ${spec} in ${broken.file} does not validate: ${broken.problems.join('; ')}.`);
  }
  const known = listing.presets.filter((one) => !one.shadowed).map((one) => one.id);
  throw new RebrandPresetError(
    'preset.unknown',
    known.length > 0
      ? `No preset has the id ${spec} here. Presets that resolve here: ${known.join(', ')}.`
      : `No preset has the id ${spec} here, and none resolve for this content profile.`,
  );
}
