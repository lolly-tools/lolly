// SPDX-License-Identifier: MPL-2.0
/** LMS compatibility presets: validated data that selects an existing course target. */
import type { LearningTarget } from '@lolly-tools/core/learning-v1';
import { LEARNING_TARGETS } from './delivery.ts';
import data from './lms-presets.json' with { type: 'json' };

export type LearningPresetCheck =
  | 'import'
  | 'launch'
  | 'media'
  | 'completion'
  | 'resume'
  | 'review'
  | 'replacement';
/** The learner sequence a preset needs before it shows Tested. Import alone never earns the label. */
export const LEARNING_PRESET_TESTED_CHECKS: readonly LearningPresetCheck[] = [
  'import',
  'launch',
  'media',
  'completion',
  'resume',
];
const CHECKS: readonly LearningPresetCheck[] = [
  ...LEARNING_PRESET_TESTED_CHECKS,
  'review',
  'replacement',
];
export interface LearningPresetEvidence {
  /** LMS product and version as tested, for example "Example LMS 4.2". */
  environment: string;
  testedAt: string;
  checks: LearningPresetCheck[];
  /** A short reference to the acceptance record. Never a tenant URL or learner detail. */
  record: string;
}
export interface LearningPreset {
  id: string;
  version: number;
  name: string;
  /** A standard target for any website or LMS. Generic presets never show Tested. */
  generic: boolean;
  aliases: string[];
  target: LearningTarget;
  /** Confirmed launch convention, or null while unknown. */
  launch: string | null;
  limits: { packageMB: number | null; stateChars: number | null };
  /** Confirmed media settings, or null while unknown. */
  media: string | null;
  instructions: string;
  /** Public vendor page. The only link a preset may hold. */
  documentation: string | null;
  evidence: LearningPresetEvidence[];
}
export interface LearningPresetStatus {
  tested: boolean;
  label: string;
  detail: string;
  evidence?: LearningPresetEvidence;
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const control = (v: string) => [...v].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exactKeys = (v: Record<string, unknown>, allowed: string) => {
  const names = allowed.split(' ');
  return Object.keys(v).length === names.length && names.every((k) => Object.hasOwn(v, k));
};
const normal = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const listed = (items: readonly string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

function plain(v: unknown, max: number): v is string {
  return (
    typeof v === 'string' &&
    v.length > 0 &&
    v.length <= max &&
    v.trim() === v &&
    !control(v) &&
    // Tenant URLs and contact details stay out of presets; documentation is the only link.
    !v.includes('://') &&
    !v.includes('@')
  );
}
function limit(v: unknown, integer: boolean): boolean {
  return (
    v === null ||
    (typeof v === 'number' && Number.isFinite(v) && v > 0 && (!integer || Number.isSafeInteger(v)))
  );
}
function publicPage(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v !== 'string' || v.length > 300) return false;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
function realDate(v: unknown): boolean {
  const m = typeof v === 'string' ? DATE.exec(v) : null;
  if (!m) return false;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return date.toISOString().slice(0, 10) === v;
}

function parseEvidence(v: unknown, fail: (problem: string) => never): LearningPresetEvidence {
  if (!record(v) || !exactKeys(v, 'environment testedAt checks record'))
    return fail('evidence must list environment, testedAt, checks and record only');
  if (!plain(v.environment, 120) || !/\d/.test(v.environment))
    return fail('evidence must name the LMS version tested');
  if (!realDate(v.testedAt)) return fail('evidence needs a testedAt date as YYYY-MM-DD');
  const checks = v.checks;
  if (
    !Array.isArray(checks) ||
    !checks.length ||
    new Set(checks).size !== checks.length ||
    !checks.every((c) => CHECKS.includes(c))
  )
    return fail(`evidence checks must be distinct values from: ${CHECKS.join(', ')}`);
  if (!plain(v.record, 200)) return fail('evidence needs a plain record reference');
  return {
    environment: v.environment,
    testedAt: v.testedAt as string,
    checks: [...checks],
    record: v.record,
  };
}

function parsePreset(v: unknown, index: number): LearningPreset {
  const label = record(v) && typeof v.id === 'string' ? v.id : `#${index + 1}`;
  const fail = (problem: string): never => {
    throw new Error(`LMS preset ${label}: ${problem}.`);
  };
  if (
    !record(v) ||
    !exactKeys(
      v,
      'id version name generic aliases target launch limits media instructions documentation evidence'
    )
  )
    return fail('unexpected or missing fields');
  if (typeof v.id !== 'string' || v.id.length > 64 || !SLUG.test(v.id))
    return fail('id must be a lower-case slug');
  if (!Number.isSafeInteger(v.version) || Number(v.version) < 1)
    return fail('version must be a positive whole number');
  if (!plain(v.name, 80)) return fail('name must be plain text');
  if (typeof v.generic !== 'boolean') return fail('generic must be true or false');
  const aliases = v.aliases;
  if (!Array.isArray(aliases) || aliases.length > 10 || !aliases.every((a) => plain(a, 80)))
    return fail('aliases must be up to 10 plain names');
  if (!LEARNING_TARGETS.some((t) => t.id === v.target))
    return fail('target must be a supported course target');
  if (v.launch !== null && !plain(v.launch, 200)) return fail('launch must be plain text or null');
  const limits = v.limits;
  if (
    !record(limits) ||
    !exactKeys(limits, 'packageMB stateChars') ||
    !limit(limits.packageMB, false) ||
    !limit(limits.stateChars, true)
  )
    return fail('limits must be positive numbers or null when unknown');
  if (v.media !== null && !plain(v.media, 200)) return fail('media must be plain text or null');
  if (!plain(v.instructions, 2000)) return fail('instructions must be plain text');
  if (!publicPage(v.documentation))
    return fail('documentation must be a public https page without credentials or a query');
  if (!Array.isArray(v.evidence) || v.evidence.length > 50)
    return fail('evidence must be a list of up to 50 records');
  const evidence = v.evidence.map((e) => parseEvidence(e, fail));
  if (v.generic && evidence.length) return fail('a standard target cannot hold LMS evidence');
  return {
    id: v.id,
    version: Number(v.version),
    name: v.name,
    generic: v.generic,
    aliases: [...(aliases as string[])],
    target: v.target as LearningTarget,
    launch: v.launch as string | null,
    limits: {
      packageMB: limits.packageMB as number | null,
      stateChars: limits.stateChars as number | null,
    },
    media: v.media as string | null,
    instructions: v.instructions,
    documentation: v.documentation as string | null,
    evidence,
  };
}

/** Validate a preset registry. Every course target needs exactly one standard preset. */
export function parseLearningPresets(value: unknown): LearningPreset[] {
  if (!record(value) || !exactKeys(value, 'schemaVersion presets') || value.schemaVersion !== 1)
    throw new Error('LMS presets must be { schemaVersion: 1, presets: [...] }.');
  if (!Array.isArray(value.presets) || !value.presets.length || value.presets.length > 200)
    throw new Error('LMS presets must list between 1 and 200 records.');
  const presets = value.presets.map(parsePreset);
  const ids = new Set<string>();
  const names = new Map<string, LearningPreset>();
  for (const preset of presets) {
    if (ids.has(preset.id)) throw new Error(`LMS preset ${preset.id}: id is used twice.`);
    ids.add(preset.id);
    for (const name of [preset.name, ...preset.aliases]) {
      const key = normal(name);
      const other = names.get(`${key}\n${preset.target}`);
      if (other && other !== preset)
        throw new Error(`LMS preset ${preset.id}: "${name}" already names ${other.id}.`);
      names.set(`${key}\n${preset.target}`, preset);
    }
  }
  const generic = new Set(presets.filter((p) => p.generic).map((p) => normal(p.name)));
  for (const preset of presets) {
    if (!preset.generic && [preset.name, ...preset.aliases].some((n) => generic.has(normal(n))))
      throw new Error(`LMS preset ${preset.id}: a named LMS cannot reuse a standard target name.`);
  }
  for (const target of LEARNING_TARGETS) {
    const count = presets.filter((p) => p.generic && p.target === target.id).length;
    if (count !== 1)
      throw new Error(`LMS presets need exactly one standard preset for ${target.label}.`);
  }
  return presets;
}

export const LEARNING_PRESETS: readonly LearningPreset[] = Object.freeze(
  parseLearningPresets(data)
);

function matches(name: string, presets: readonly LearningPreset[]): LearningPreset[] {
  const key = normal(name);
  if (!key) return [];
  return presets.filter((p) => [p.name, ...p.aliases].some((n) => normal(n) === key));
}
function testedEvidence(preset: LearningPreset): LearningPresetEvidence | undefined {
  if (preset.generic) return undefined;
  return preset.evidence
    .filter((e) => LEARNING_PRESET_TESTED_CHECKS.every((c) => e.checks.includes(c)))
    .sort((a, b) => b.testedAt.localeCompare(a.testedAt))[0];
}

/** Names for the searchable destination list: named LMS products, then the standard targets. */
export function learningPresetChoices(presets = LEARNING_PRESETS): string[] {
  const named = [...new Set(presets.filter((p) => !p.generic).map((p) => p.name))].sort((a, b) =>
    a.localeCompare(b, 'en')
  );
  return [...named, ...new Set(presets.filter((p) => p.generic).map((p) => p.name))];
}

/** The preset recorded for a destination name and an exact target. Unknown names use the standard target. */
export function learningPresetFor(
  name: string,
  target: LearningTarget,
  presets = LEARNING_PRESETS
): LearningPreset {
  const named = matches(name, presets).find((p) => p.target === target);
  const preset = named || presets.find((p) => p.generic && p.target === target);
  if (!preset) throw new Error('Unsupported course destination.');
  return preset;
}

/** The target to select when a destination name is chosen. An unknown name keeps the current target. */
export function learningPresetTarget(
  name: string,
  current: LearningTarget,
  presets = LEARNING_PRESETS
): LearningTarget {
  const found = matches(name, presets);
  if (!found.length || found.some((p) => p.target === current)) return current;
  return (found.find((p) => testedEvidence(p)) || found[0]!).target;
}

/** Tested needs recorded evidence of the full learner sequence for this exact target. */
export function learningPresetStatus(preset: LearningPreset): LearningPresetStatus {
  const evidence = testedEvidence(preset);
  if (evidence)
    return {
      tested: true,
      label: 'Tested',
      detail: `Tested in ${evidence.environment} on ${evidence.testedAt}. Checked ${listed(evidence.checks)}.`,
      evidence,
    };
  return {
    tested: false,
    label: 'Standard target',
    detail:
      preset.target === 'static'
        ? 'This website has not been tested.'
        : 'This LMS has not been tested.',
  };
}

/** The value a saved package artifact records, for example "other-scorm12@1". */
export function learningPresetRef(preset: LearningPreset): string {
  return `${preset.id}@${preset.version}`;
}
export function learningPresetByRef(
  ref: string,
  presets = LEARNING_PRESETS
): LearningPreset | undefined {
  return presets.find((p) => learningPresetRef(p) === ref);
}
