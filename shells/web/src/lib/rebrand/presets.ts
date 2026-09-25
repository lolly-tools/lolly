// SPDX-License-Identifier: MPL-2.0
/**
 * Renovation presets in the web shell (plan 274 section 2.2 and section 10 decision 7).
 *
 * A preset is `RenovationPresetV1` from `@lolly-tools/core`: a few stated differences from the
 * first pass's own rules ("remove page numbers without asking", "take the content
 * layout on a tie"). Presets come from two places, listed in this order:
 *
 *   1. The design system: every `data` asset tagged `slides` and `rebrand-preset`, a
 *      file `{ "version": 1, "presets": [ ... ] }` (`lolly/slides/presets` in
 *      lolly-start ships "Tidy"). The same files the CLI reads
 *      (`@lolly-tools/node-shell/rebrand/presets`).
 *   2. The personal layer: the person's own presets, kept as user template records
 *      (plan 226) on the profile, `toolId: "rebrand"` with `scope: "look"` so no
 *      template chooser or Projects collection ever offers one as a starting point.
 *      The record's `values.preset` holds the preset. Profile records travel in the
 *      portable backup like every other template. Never `localStorage`.
 *
 * An id both places hold resolves to the design system's preset and the personal one
 * is left out, which is the CLI's rule too. "Save as my preset" writes the personal
 * layer only; publishing a preset into a pack is a design system studio action.
 *
 * `presetFromPlan` turns the decisions on a plan into a preset: for each object class
 * where every row the person decided took the same action, that action and an
 * `accepted` review; a layout per source layout where the person chose one
 * consistently, the fallback, and the logo policy. A class the person decided both
 * ways is left to the rules, since a preset that picks one of the two would be a guess.
 *
 * The file reader checks every field the engine reads against the contract's own
 * lists and drops a preset that does not pass, so a broken pack file never reaches the
 * first pass. It takes and refuses exactly what the CLI's `presetProblems` does (a
 * field the engine does not read is refused, `name` and `description` aside, and
 * `excludeSlideIds` and `lockedColors` are checked and carried), so one pack preset
 * renovates the same deck the same way in both; `tests/rebrand-presets.test.ts` runs
 * both over one table. The CLI's validator says why; this one answers yes or no,
 * which is all the view needs.
 */
import {
  OBJECT_CLASSES,
  PLAN_ACTIONS,
  REVIEW_STATES,
  isArchetypeRef,
  type ArchetypeRefV1,
  type DeckCensusV1,
  type ObjectClassV1,
  type PlanActionV1,
  type RenovationPlanV1,
  type RenovationPresetV1,
  type ReviewStateV1,
} from '@lolly-tools/core/rebrand-v1';
import { createUserTemplateStore, type UserTemplate, type UserTemplateHost } from '../user-templates.ts';
import type { MasterAssetsApi } from './design-system.ts';

/** The tags a design system's preset asset carries. */
export const PRESET_ASSET_TAGS = ['slides', 'rebrand-preset'] as const;

/** The tool id personal preset records are filed under on the profile. */
export const PERSONAL_PRESET_TOOL_ID = 'rebrand';

/** Where a preset came from. */
export type RebrandPresetOriginV1 = 'pack' | 'personal';

/** One preset as the view lists it. */
export interface RebrandPresetEntryV1 {
  preset: RenovationPresetV1;
  name: string;
  description?: string;
  origin: RebrandPresetOriginV1;
  /** The user template record a personal preset lives in. */
  recordId?: string;
}

const LOGO_POLICIES = ['brand', 'keep', 'drop'] as const;
const REPLACEABLE: ReadonlySet<string> = new Set(['known-logo', 'logo-candidate']);
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
/** The fields a preset may carry: the engine's, then the two for people. */
const PRESET_FIELDS: ReadonlySet<string> = new Set([
  'id', 'version', 'actions', 'review', 'layout', 'logo', 'excludeSlideIds', 'minSeparation', 'lockedColors',
  'name', 'description',
]);
const LOGO_FIELDS: ReadonlySet<string> = new Set(['policy', 'variantByBackground']);
/**
 * The layout fields this build reads. A preset naming another is refused, which is
 * how a build from before plan 275 meets `byStructure` or `bySourceLayoutName`:
 * it drops the preset rather than applying part of it.
 */
const LAYOUT_FIELDS: ReadonlySet<string> = new Set(['bySourceLayout', 'bySourceLayoutName', 'byStructure', 'fallback', 'minGap']);
/** A map key that names a built-in property of every JavaScript object. */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** A key to archetype map from a preset file, null when a key or a value would not validate, undefined when absent. */
function archetypeMap(value: unknown): Record<string, ArchetypeRefV1> | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const out: Record<string, ArchetypeRefV1> = {};
  for (const [key, archetype] of Object.entries(value)) {
    if (!key || key.length > 512 || RESERVED_KEYS.has(key) || !isArchetypeRef(archetype)) return null;
    out[key] = archetype;
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Whether `value` is one of the entries of `list`, narrowed to that list. */
function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

const isClass = (value: unknown): value is ObjectClassV1 => oneOf(OBJECT_CLASSES, value);

/** A per-class map, null when an entry is outside the lists of the contract, undefined when absent. */
function classMap<T extends string>(value: unknown, allowed: readonly T[]): Partial<Record<ObjectClassV1, T>> | undefined | null {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return null;
  const out: Partial<Record<ObjectClassV1, T>> = {};
  for (const [klass, entry] of Object.entries(value)) {
    if (!isClass(klass) || !oneOf(allowed, entry)) return null;
    out[klass] = entry;
  }
  return out;
}

/**
 * The engine's fields of one preset from a file, or null when it would not validate.
 * `name` and `description` are for people and never reach the engine.
 */
export function presetOf(value: unknown): RenovationPresetV1 | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) return null;
  for (const key of Object.keys(value)) if (!PRESET_FIELDS.has(key)) return null;
  for (const key of ['name', 'description'] as const) if (value[key] !== undefined && typeof value[key] !== 'string') return null;
  const preset: RenovationPresetV1 = { id: value.id };
  if (value.version !== undefined) {
    if (typeof value.version !== 'string') return null;
    preset.version = value.version;
  }
  const actions = classMap<PlanActionV1>(value.actions, PLAN_ACTIONS);
  if (actions === null) return null;
  if (actions) {
    for (const [klass, action] of Object.entries(actions)) if (action === 'replace' && !REPLACEABLE.has(klass)) return null;
    preset.actions = actions;
  }
  const review = classMap<ReviewStateV1>(value.review, REVIEW_STATES);
  if (review === null) return null;
  if (review) preset.review = review;
  if (value.layout !== undefined) {
    const layout = value.layout;
    if (!isRecord(layout)) return null;
    for (const key of Object.keys(layout)) if (!LAYOUT_FIELDS.has(key)) return null;
    const out: NonNullable<RenovationPresetV1['layout']> = {};
    const bySourceLayout = archetypeMap(layout.bySourceLayout);
    const bySourceLayoutName = archetypeMap(layout.bySourceLayoutName);
    const byStructure = archetypeMap(layout.byStructure);
    if (bySourceLayout === null || bySourceLayoutName === null || byStructure === null) return null;
    if (bySourceLayout) out.bySourceLayout = bySourceLayout;
    if (bySourceLayoutName) out.bySourceLayoutName = bySourceLayoutName;
    if (byStructure) out.byStructure = byStructure;
    if (layout.fallback !== undefined) {
      if (!isArchetypeRef(layout.fallback)) return null;
      out.fallback = layout.fallback;
    }
    if (layout.minGap !== undefined) {
      if (!(typeof layout.minGap === 'number' && Number.isFinite(layout.minGap) && layout.minGap >= 0)) return null;
      out.minGap = layout.minGap;
    }
    preset.layout = out;
  }
  if (value.logo !== undefined) {
    const logo = value.logo;
    if (!isRecord(logo) || !oneOf(LOGO_POLICIES, logo.policy)) return null;
    for (const key of Object.keys(logo)) if (!LOGO_FIELDS.has(key)) return null;
    if (logo.variantByBackground !== undefined && typeof logo.variantByBackground !== 'boolean') return null;
    preset.logo = {
      policy: logo.policy,
      ...(typeof logo.variantByBackground === 'boolean' ? { variantByBackground: logo.variantByBackground } : {}),
    };
  }
  if (value.excludeSlideIds !== undefined) {
    const ids = value.excludeSlideIds;
    if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string')) return null;
    preset.excludeSlideIds = [...ids];
  }
  if (value.minSeparation !== undefined) {
    if (!(typeof value.minSeparation === 'number' && Number.isFinite(value.minSeparation) && value.minSeparation > 0)) return null;
    preset.minSeparation = value.minSeparation;
  }
  if (value.lockedColors !== undefined) {
    const locks = lockedColorsOf(value.lockedColors);
    if (!locks) return null;
    preset.lockedColors = locks;
  }
  return preset;
}

/** A preset's pinned colours, null when an entry would not validate. */
function lockedColorsOf(value: unknown): NonNullable<RenovationPresetV1['lockedColors']> | null {
  if (!Array.isArray(value)) return null;
  const out: NonNullable<RenovationPresetV1['lockedColors']> = [];
  for (const lock of value) {
    if (!isRecord(lock) || typeof lock.useId !== 'string' || !lock.useId) return null;
    if (typeof lock.to !== 'string' || !HEX_PATTERN.test(lock.to)) return null;
    if (lock.toPath !== undefined && typeof lock.toPath !== 'string') return null;
    out.push({ useId: lock.useId, to: lock.to, ...(typeof lock.toPath === 'string' ? { toPath: lock.toPath } : {}) });
  }
  return out;
}

/** The entries of one preset file, the ones that validate, in file order. */
export function presetsFromFile(file: unknown, origin: RebrandPresetOriginV1): RebrandPresetEntryV1[] {
  if (!isRecord(file) || file.version !== 1 || !Array.isArray(file.presets)) return [];
  const out: RebrandPresetEntryV1[] = [];
  for (const entry of file.presets) {
    const preset = presetOf(entry);
    if (!preset || !isRecord(entry)) continue;
    const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : preset.id;
    const description = typeof entry.description === 'string' && entry.description.trim() ? entry.description.trim() : undefined;
    out.push({ preset, name, origin, ...(description ? { description } : {}) });
  }
  return out;
}

/** The design system's presets: every tagged data asset, in asset id order. */
export async function readPackPresets(assets: MasterAssetsApi): Promise<RebrandPresetEntryV1[]> {
  let found: Array<{ id?: string; url?: string }>;
  try {
    found = await assets.query({ type: 'data', tags: [...PRESET_ASSET_TAGS] });
  } catch {
    return [];
  }
  const ordered = [...(Array.isArray(found) ? found : [])].sort((a, b) => ((a.id ?? '') < (b.id ?? '') ? -1 : (a.id ?? '') > (b.id ?? '') ? 1 : 0));
  const out: RebrandPresetEntryV1[] = [];
  for (const ref of ordered) {
    try {
      let target: { id?: string; url?: string } = ref;
      if (!target.url && ref.id && assets.get) target = (await assets.get(ref.id)) ?? ref;
      if (!assets.bytes) continue;
      const raw = await assets.bytes(target.url ?? target);
      out.push(...presetsFromFile(JSON.parse(new TextDecoder().decode(raw)), 'pack'));
    } catch {
      // One unreadable pack file leaves the others on offer.
    }
  }
  return out;
}

/** The person's own presets, newest first. */
export async function readPersonalPresets(host: UserTemplateHost): Promise<RebrandPresetEntryV1[]> {
  let records: UserTemplate[];
  try {
    records = await createUserTemplateStore(host).listLooks(PERSONAL_PRESET_TOOL_ID);
  } catch {
    return [];
  }
  const out: RebrandPresetEntryV1[] = [];
  for (const record of records) {
    const preset = presetOf(record.values.preset);
    if (!preset) continue;
    out.push({
      preset,
      name: record.name,
      origin: 'personal',
      recordId: record.id,
      ...(record.description ? { description: record.description } : {}),
    });
  }
  return out;
}

/** Pack presets first, then personal ones whose id no pack preset holds. */
export function mergePresets(pack: RebrandPresetEntryV1[], personal: RebrandPresetEntryV1[]): RebrandPresetEntryV1[] {
  const ids = new Set<string>();
  const out: RebrandPresetEntryV1[] = [];
  for (const entry of [...pack, ...personal]) {
    if (ids.has(entry.preset.id)) continue;
    ids.add(entry.preset.id);
    out.push(entry);
  }
  return out;
}

/** A personal preset id from its name: `mine/<slug>`. */
export function personalPresetId(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return `mine/${slug || 'preset'}`;
}

/**
 * Write a preset to the personal layer. A personal preset with the same id is replaced
 * in place, under the name given now, and its version counted up; otherwise a new
 * record is added. The view asks before replacing one.
 */
export async function savePersonalPreset(
  host: UserTemplateHost,
  preset: RenovationPresetV1,
  name: string,
  description?: string,
): Promise<RebrandPresetEntryV1> {
  const store = createUserTemplateStore(host);
  const existing = (await store.listLooks(PERSONAL_PRESET_TOOL_ID)).find((record) => presetOf(record.values.preset)?.id === preset.id);
  if (existing) {
    const before = presetOf(existing.values.preset);
    const version = String(Math.max(1, Math.trunc(Number(before?.version) || 1)) + 1);
    const next: RenovationPresetV1 = { ...preset, version };
    const updated = await store.updateLook(existing.id, { preset: next });
    if (updated) {
      if (name.trim() && updated.name !== name.trim()) await store.rename(updated.id, name);
      return { preset: next, name: name.trim() || updated.name, origin: 'personal', recordId: updated.id };
    }
  }
  const values = { preset: { ...preset } };
  const saved = await store.save({
    toolId: PERSONAL_PRESET_TOOL_ID,
    name,
    values,
    scope: 'look',
    ...(description ? { description } : {}),
  });
  return { preset, name: saved.name, origin: 'personal', recordId: saved.id };
}

/** One value when every entry holds it, else undefined. */
function consistent<T>(values: readonly T[]): T | undefined {
  const [first] = values;
  if (first === undefined) return undefined;
  return values.every((value) => value === first) ? first : undefined;
}

export interface PresetFromPlanOptsV1 {
  id: string;
  /** The preset the plan ran with, whose entries stand where the person decided nothing. */
  base?: RenovationPresetV1;
}

/**
 * The person's decisions on a plan as a preset. Only a person's own decisions count
 * (`author: "user"`); a proposal a rule or a preset wrote says nothing about what the
 * person wants. Classes the person did not decide keep the base preset's entries.
 *
 * A class counts only when the person changed at least one of its proposals. Accept all
 * suggestions writes every proposal as the person's decision, and a preset built from
 * those would mark every class accepted, flagged ones included, so the next deck would
 * arrive with nothing left to review. A class the person only confirmed stays with the
 * rules, which already propose what they confirmed.
 */
export function presetFromPlan(plan: RenovationPlanV1, census: DeckCensusV1 | null, opts: PresetFromPlanOptsV1): RenovationPresetV1 {
  const base = opts.base;
  const decided = new Map<ObjectClassV1, PlanActionV1[]>();
  const changed = new Set<ObjectClassV1>();
  for (const slide of plan.slides) {
    for (const row of slide.objects) {
      if (row.author !== 'user' || row.decision === undefined) continue;
      const list = decided.get(row.class) ?? [];
      list.push(row.decision);
      decided.set(row.class, list);
      if (row.decision !== row.proposal) changed.add(row.class);
    }
  }
  const actions: Partial<Record<ObjectClassV1, PlanActionV1>> = { ...(base?.actions ?? {}) };
  const review: Partial<Record<ObjectClassV1, ReviewStateV1>> = { ...(base?.review ?? {}) };
  for (const klass of [...decided.keys()].sort()) {
    if (!changed.has(klass)) continue;
    const action = consistent(decided.get(klass) ?? []);
    if (action === undefined || (action === 'replace' && !REPLACEABLE.has(klass))) continue;
    actions[klass] = action;
    review[klass] = 'accepted';
  }

  const sourceLayout = new Map((census?.layouts ?? []).map((row) => [row.slideId, row.sourceLayout]));
  const chosen = new Map<string, ArchetypeRefV1[]>();
  const userLayouts: ArchetypeRefV1[] = [];
  for (const slide of plan.slides) {
    if (slide.layoutSource !== 'user') continue;
    userLayouts.push(slide.layout);
    const name = sourceLayout.get(slide.id);
    if (!name) continue;
    const list = chosen.get(name) ?? [];
    list.push(slide.layout);
    chosen.set(name, list);
  }
  const bySourceLayout: Record<string, ArchetypeRefV1> = { ...(base?.layout?.bySourceLayout ?? {}) };
  for (const name of [...chosen.keys()].sort()) {
    const archetype = consistent(chosen.get(name) ?? []);
    if (archetype) bySourceLayout[name] = archetype;
  }
  const fallback = consistent(userLayouts) ?? base?.layout?.fallback;

  const preset: RenovationPresetV1 = { id: opts.id, version: '1' };
  if (Object.keys(actions).length) preset.actions = actions;
  if (Object.keys(review).length) preset.review = review;
  const layout: NonNullable<RenovationPresetV1['layout']> = {};
  if (Object.keys(bySourceLayout).length) layout.bySourceLayout = bySourceLayout;
  if (base?.layout?.bySourceLayoutName) layout.bySourceLayoutName = { ...base.layout.bySourceLayoutName };
  if (base?.layout?.byStructure) layout.byStructure = { ...base.layout.byStructure };
  if (fallback) layout.fallback = fallback;
  if (base?.layout?.minGap !== undefined) layout.minGap = base.layout.minGap;
  if (Object.keys(layout).length) preset.layout = layout;
  preset.logo = { policy: plan.logo.policy, variantByBackground: plan.logo.variantByBackground };
  if (base?.minSeparation !== undefined) preset.minSeparation = base.minSeparation;
  if (base?.lockedColors?.length) preset.lockedColors = base.lockedColors.map((lock) => ({ ...lock }));
  return preset;
}
