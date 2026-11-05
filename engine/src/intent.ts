// SPDX-License-Identifier: MPL-2.0
/**
 * Visual intent: a caller states what a piece has to do, and this module chooses the tool
 * for each surface, fills its inputs from the content given and says why (plan 350 W4). The
 * types and vocabulary are in `@lolly-tools/core/intent-v1`.
 *
 * Pure: no DOM, no clock, no network, no randomness, and no model. The same request and the
 * same tools, in any order, give the same answer. Free text and the prompt are carried and
 * digested and never read by anything that decides.
 *
 * The order is explainable, and each step is recorded on the candidate:
 *
 *   1. the tool declares the purpose (otherwise it is refused, `purpose-other`);
 *   2. the tool can draw the surface (otherwise it is refused, `surface-no-fit`);
 *   3. every role the tool needs is present, because a tool that cannot be filled must not
 *      beat one that can merely for fitting the size more exactly;
 *   4. how closely the tool matches: declared, then a sized option at the same shape, then a
 *      tool that lays itself out for the canvas, then the tool's own size at the same shape;
 *   5. how much of the content the tool uses;
 *   6. the tool id, so a tie has one answer.
 *
 * `prefer.toolId` moves that tool first among the ones that fit, and the reasons record the preference.
 *
 * It refuses rather than guesses and never invents a value. A missing role is a gap for the
 * caller to fill, and the tool's own sample wording that would still print is listed in
 * `defaultsInUse`. Permission is not its concern: it takes the tools it may consider.
 */
import {
  INTENT_FITS,
  INTENT_FREE_TEXT_FIELDS,
  INTENT_LIMITS,
  INTENT_PURPOSES,
  INTENT_PURPOSE_MEANINGS,
  INTENT_PURPOSE_NEEDED,
  INTENT_RESOLUTION_FORMAT,
  INTENT_RESOLUTION_VERSION,
  INTENT_ROLES,
  INTENT_SURFACES,
  INTENT_SURFACE_UNITS,
  INTENT_VOCABULARY_VERSION,
  TOOL_INTENTS_VERSION,
  VISUAL_INTENT_VERSION,
  type IntentCandidateV1,
  type IntentChoiceV1,
  type IntentErrorCodeV1,
  type IntentErrorV1,
  type IntentFitV1,
  type IntentFreeTextV1,
  type IntentGapV1,
  type IntentNoteV1,
  type IntentOutcomeV1,
  type IntentPurposeNeededV1,
  type IntentPurposeV1,
  type IntentReasonV1,
  type IntentRefusalV1,
  type IntentResolutionV1,
  type IntentResolvedSurfaceV1,
  type IntentSurfaceResultV1,
  type IntentSurfaceSpecV1,
  type IntentSurfaceUnitV1,
  type IntentToolFactsV1,
  type IntentUnusedV1,
  type ToolIntentV1,
} from '@lolly-tools/core/intent-v1';
import { sha256Hex } from './bytes.ts';
import { canonicalJson } from './canonical-json.ts';
import { matchesShowIf } from './inputs.ts';

/** Which rules made an answer. Bumped when the order or a rule changes, so old answers stay explained. */
export const INTENT_RULES_VERSION = 'intent-rules-2026-11-05.1';

/** Two shapes count as the same when their width-to-height ratios differ by at most this. */
const SHAPE_TOLERANCE = 0.01;

/** Input types whose default is wording or sample content rather than a look. */
const CONTENT_TYPES: ReadonlySet<string> = new Set([
  'text', 'longtext', 'url', 'date', 'time', 'datetime-local', 'table', 'blocks', 'asset',
]);

const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);
const TOP_KEYS: ReadonlySet<string> = new Set([
  'version', 'purpose', 'prompt', 'recordPrompt', 'content', 'language', 'surfaces', 'prefer', ...INTENT_FREE_TEXT_FIELDS,
]);
const SURFACES_BY_ID: ReadonlyMap<string, IntentSurfaceSpecV1> = new Map(INTENT_SURFACES.map((s) => [s.id, s]));
const FIT_RANK: Readonly<Record<IntentFitV1, number>> = Object.fromEntries(
  INTENT_FITS.map((fit, index) => [fit, INTENT_FITS.length - index]),
) as Record<IntentFitV1, number>;

/** Code-unit order: the same in every locale and on every host. */
const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** A request a parser refused, with every problem it found. */
export class IntentInvalidError extends Error {
  readonly errors: readonly IntentErrorV1[];
  constructor(errors: readonly IntentErrorV1[]) {
    super(errors.map((e) => `${e.path || '/'}: ${e.message}`).join(' '));
    this.name = 'IntentInvalidError';
    this.errors = errors;
  }
}

/** A request after parsing: surfaces are all sizes, the language normalised, unknowns refused. */
export interface ParsedVisualIntent {
  version: typeof VISUAL_INTENT_VERSION;
  purpose: IntentPurposeV1 | null;
  prompt: string | null;
  recordPrompt: boolean;
  freeText: IntentFreeTextV1;
  language: string | null;
  content: Record<string, unknown>;
  surfaces: IntentResolvedSurfaceV1[];
  preferToolId: string | null;
}

export type ParseVisualIntentResult =
  | { ok: true; intent: ParsedVisualIntent }
  | { ok: false; errors: IntentErrorV1[] };

const UNIT_TO_MM: Readonly<Record<IntentSurfaceUnitV1, number>> = { px: 25.4 / 96, mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72 };
const toMm = (value: number, unit: string): number => value * (UNIT_TO_MM[unit as IntentSurfaceUnitV1] ?? UNIT_TO_MM.px);

/** A value's nesting depth is bounded and it holds no key that could reach a prototype. */
function checkValue(value: unknown, depth: number): 'depth' | 'key' | 'type' | null {
  if (depth > INTENT_LIMITS.depth) return 'depth';
  // An undefined key is an absent key, as it is once serialised.
  if (value === undefined || value === null || typeof value === 'string' || typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'type';
  if (Array.isArray(value)) {
    for (const item of value) {
      const problem = checkValue(item, depth + 1);
      if (problem) return problem;
    }
    return null;
  }
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      if (UNSAFE_KEYS.has(key)) return 'key';
      const problem = checkValue(value[key], depth + 1);
      if (problem) return problem;
    }
    return null;
  }
  return 'type';
}

/**
 * A language tag normalised to its form here: the primary subtag lower-cased, any region or
 * script kept upper or title-cased as written, or null when it is not a tag at all.
 */
function normaliseLanguage(raw: string): string | null {
  const parts = raw.trim().split('-');
  if (!/^[A-Za-z]{2,3}$/.test(parts[0] ?? '')) return null;
  if (parts.slice(1).some((part) => !/^[A-Za-z0-9]{1,8}$/.test(part))) return null;
  return [parts[0]!.toLowerCase(), ...parts.slice(1)].join('-');
}

function parseSurface(raw: unknown, path: string, errors: IntentErrorV1[]): IntentResolvedSurfaceV1 | null {
  const fail = (code: IntentErrorCodeV1, message: string): null => {
    errors.push({ code, path, message });
    return null;
  };
  if (!isRecord(raw)) return fail('intent.surfaces-invalid', 'A surface is an object with an id, or a width and a height.');
  for (const key of Object.keys(raw)) {
    if (!['id', 'width', 'height', 'unit', 'format'].includes(key)) {
      return fail('intent.surfaces-invalid', `A surface does not take "${key}".`);
    }
  }
  const format = raw.format;
  if (format !== undefined && (typeof format !== 'string' || !/^[a-z0-9-]{1,32}$/.test(format))) {
    return fail('intent.surfaces-invalid', 'format is a lower-case format name.');
  }
  const withFormat = (surface: IntentResolvedSurfaceV1): IntentResolvedSurfaceV1 =>
    typeof format === 'string' ? { ...surface, format } : surface;
  if (raw.id !== undefined) {
    if (raw.width !== undefined || raw.height !== undefined || raw.unit !== undefined) {
      return fail('intent.surfaces-invalid', 'A named surface carries its own size. Give an id or a size, not both.');
    }
    const spec = typeof raw.id === 'string' ? SURFACES_BY_ID.get(raw.id) : undefined;
    if (!spec) {
      return fail('intent.surface-unknown', `Unknown surface. Named surfaces: ${INTENT_SURFACES.map((s) => s.id).join(', ')}.`);
    }
    return withFormat({ ...spec, named: true });
  }
  const unit = raw.unit ?? 'px';
  if (!(INTENT_SURFACE_UNITS as readonly unknown[]).includes(unit)) {
    return fail('intent.surfaces-invalid', `unit is one of ${INTENT_SURFACE_UNITS.join(', ')}.`);
  }
  const typedUnit = unit as IntentSurfaceUnitV1;
  const { width, height } = raw;
  const maxSide = toMm(INTENT_LIMITS.sidePx, 'px');
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0 || toMm(width, typedUnit) > maxSide
    || typeof height !== 'number' || !Number.isFinite(height) || height <= 0 || toMm(height, typedUnit) > maxSide) {
    return fail('intent.surfaces-invalid', 'width and height are positive numbers within the size limit.');
  }
  // A size that IS a named surface is that surface, so both spellings give one answer.
  const named = INTENT_SURFACES.find((s) => s.width === width && s.height === height && s.unit === typedUnit);
  if (named) return withFormat({ ...named, named: true });
  return withFormat({
    id: `${width}x${height}${typedUnit}`, named: false, width, height, unit: typedUnit,
    medium: typedUnit === 'px' ? 'screen' : 'print',
  });
}

/**
 * Read a request. Every problem is reported at once with a JSON pointer and a stable code,
 * and nothing past a limit is cut down to fit.
 */
export function parseVisualIntent(value: unknown): ParseVisualIntentResult {
  const errors: IntentErrorV1[] = [];
  const add = (code: IntentErrorCodeV1, path: string, message: string): void => {
    errors.push({ code, path, message });
  };
  if (!isRecord(value)) {
    return { ok: false, errors: [{ code: 'intent.not-object', path: '', message: 'An intent is a JSON object.' }] };
  }
  const safety = checkValue(value, 0);
  if (safety) {
    const message = safety === 'depth'
      ? `An intent nests at most ${INTENT_LIMITS.depth} levels.`
      : safety === 'key' ? 'An intent cannot use a key that names a prototype.' : 'An intent holds JSON values only.';
    return { ok: false, errors: [{ code: 'intent.content-invalid', path: '', message }] };
  }
  if (canonicalJson(value).length > INTENT_LIMITS.totalChars) {
    return { ok: false, errors: [{ code: 'intent.too-large', path: '', message: `An intent is at most ${INTENT_LIMITS.totalChars} characters.` }] };
  }
  for (const key of Object.keys(value)) {
    if (!TOP_KEYS.has(key)) add('intent.unknown-key', `/${key}`, `An intent does not take "${key}".`);
  }
  if (value.version !== VISUAL_INTENT_VERSION) add('intent.version', '/version', `version is ${VISUAL_INTENT_VERSION}.`);

  let prompt: string | null = null;
  if (value.prompt !== undefined) {
    if (typeof value.prompt !== 'string' || !value.prompt.trim()) {
      add('intent.prompt-invalid', '/prompt', 'prompt is the user\'s words, as a string with something in it.');
    } else if (value.prompt.length > INTENT_LIMITS.promptChars) {
      add('intent.prompt-too-long', '/prompt', `prompt is at most ${INTENT_LIMITS.promptChars} characters and this one has ${value.prompt.length}. It is refused rather than cut.`);
    } else prompt = value.prompt;
  }

  let purpose: IntentPurposeV1 | null = null;
  if (value.purpose !== undefined) {
    if ((INTENT_PURPOSES as readonly unknown[]).includes(value.purpose)) purpose = value.purpose as IntentPurposeV1;
    else add('intent.purpose-unknown', '/purpose', `Unknown purpose. Purposes: ${INTENT_PURPOSES.join(', ')}.`);
  } else if (value.prompt === undefined) {
    add('intent.purpose-or-prompt', '', 'An intent needs a purpose, or a prompt for the calling agent to choose a purpose from.');
  }

  let recordPrompt = false;
  if (value.recordPrompt !== undefined) {
    if (typeof value.recordPrompt === 'boolean') recordPrompt = value.recordPrompt;
    else add('intent.record-prompt-invalid', '/recordPrompt', 'recordPrompt is true or false.');
  }

  const freeText: IntentFreeTextV1 = {};
  for (const field of INTENT_FREE_TEXT_FIELDS) {
    const text = value[field];
    if (text === undefined) continue;
    if (typeof text !== 'string' || text.length > INTENT_LIMITS.freeTextChars) {
      add('intent.free-text-invalid', `/${field}`, `${field} is text of at most ${INTENT_LIMITS.freeTextChars} characters.`);
    } else if (text.trim()) freeText[field] = text;
  }

  let language: string | null = null;
  if (value.language !== undefined) {
    language = typeof value.language === 'string' ? normaliseLanguage(value.language) : null;
    if (!language) add('intent.language-invalid', '/language', 'language is a short tag such as de or pt-BR.');
  }

  let preferToolId: string | null = null;
  if (value.prefer !== undefined) {
    const prefer = value.prefer;
    if (!isRecord(prefer) || typeof prefer.toolId !== 'string' || Object.keys(prefer).length !== 1) {
      add('intent.prefer-invalid', '/prefer', 'prefer is { "toolId": "<id>" }.');
    } else preferToolId = prefer.toolId;
  }

  const content: Record<string, unknown> = {};
  if (value.content !== undefined) {
    if (!isRecord(value.content) || Object.keys(value.content).length > INTENT_LIMITS.contentKeys) {
      add('intent.content-invalid', '/content', `content is an object of at most ${INTENT_LIMITS.contentKeys} roles.`);
    } else {
      for (const role of Object.keys(value.content).sort(byString)) {
        if (!Object.hasOwn(INTENT_ROLES, role)) {
          add('intent.role-unknown', `/content/${role}`, `Unknown role. Roles: ${Object.keys(INTENT_ROLES).join(', ')}.`);
          continue;
        }
        const item = value.content[role];
        if (item === undefined || item === null) {
          add('intent.content-invalid', `/content/${role}`, 'Leave out a role with no value.');
          continue;
        }
        content[role] = item;
      }
    }
  }

  const surfaces: IntentResolvedSurfaceV1[] = [];
  if (value.surfaces === undefined) {
    if (purpose !== null) add('intent.surfaces-required', '/surfaces', 'An intent with a purpose names at least one surface.');
  } else if (!Array.isArray(value.surfaces) || value.surfaces.length > INTENT_LIMITS.surfaces
    || (value.surfaces.length === 0 && purpose !== null)) {
    add('intent.surfaces-invalid', '/surfaces', `surfaces is a list of 1 to ${INTENT_LIMITS.surfaces} surfaces.`);
  } else {
    const seen = new Set<string>();
    value.surfaces.forEach((raw, index) => {
      const path = `/surfaces/${index}`;
      const surface = parseSurface(raw, path, errors);
      if (!surface) return;
      const key = `${surface.id}|${surface.format ?? ''}`;
      if (seen.has(key)) add('intent.surface-duplicate', path, `Surface "${surface.id}" is listed twice with the same format.`);
      seen.add(key);
      surfaces.push(surface);
    });
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    intent: { version: VISUAL_INTENT_VERSION, purpose, prompt, recordPrompt, freeText, language, content, surfaces, preferToolId },
  };
}

interface FitAnswer {
  fit: IntentFitV1;
  overlay: Record<string, unknown>;
  dims: { width: number; height: number; unit: IntentSurfaceUnitV1 };
  sizeSetBy: 'input' | 'export';
  message: string;
}

const sameShape = (aw: number, ah: number, bw: number, bh: number): boolean => {
  // Cross-multiplied so the comparison needs no division that rounds differently per host.
  const left = aw * bh;
  const right = bw * ah;
  return Math.abs(left - right) <= SHAPE_TOLERANCE * right;
};

/** Two sizes in comparable units agree on both sides within the tolerance. */
const sameSize = (aw: number, ah: number, aUnit: string, bw: number, bh: number, bUnit: string): boolean => {
  // Pixels and physical units have no fixed relation, so they never count as the same size.
  if ((aUnit === 'px') !== (bUnit === 'px')) return false;
  const a = toMm(aw, aUnit), b = toMm(bw, bUnit), c = toMm(ah, aUnit), d = toMm(bh, bUnit);
  return Math.abs(a - b) <= SHAPE_TOLERANCE * b && Math.abs(c - d) <= SHAPE_TOLERANCE * d;
};

interface SizedOption { input: string; value: unknown; width: number; height: number; unit: string }

/** Every select option that states the export size it implies, in manifest order. */
function sizedOptions(tool: IntentToolFactsV1): SizedOption[] {
  const found: SizedOption[] = [];
  for (const input of tool.inputs ?? []) {
    if (input.type !== 'select') continue;
    for (const option of input.options ?? []) {
      if (!isRecord(option)) continue;
      const { width, height, unit, value } = option;
      if (typeof width === 'number' && typeof height === 'number') {
        found.push({ input: input.id, value, width, height, unit: typeof unit === 'string' ? unit : 'px' });
      }
    }
  }
  return found;
}

/**
 * Can this tool draw this surface, and how? Stated sizes only: a tool is never stretched,
 * and a shape it does not have is a refusal rather than a letterbox.
 */
function surfaceFit(tool: IntentToolFactsV1, entry: ToolIntentV1, surface: IntentResolvedSurfaceV1): FitAnswer | null {
  const { width, height, unit } = surface;
  const own = { width, height, unit };
  if (surface.named && entry.surfaces && Object.hasOwn(entry.surfaces, surface.id)) {
    return { fit: 'declared', overlay: entry.surfaces[surface.id] ?? {}, dims: own, sizeSetBy: 'export', message: `The tool declares surface ${surface.id}.` };
  }
  const options = sizedOptions(tool);
  const exact = options.find((o) => sameSize(o.width, o.height, o.unit, width, height, unit));
  if (exact) {
    return {
      fit: 'declared',
      overlay: { [exact.input]: exact.value },
      dims: { width: exact.width, height: exact.height, unit: exact.unit as IntentSurfaceUnitV1 },
      // The option is the tool's own size, so the tool applies the option and a render
      // needs no export size.
      sizeSetBy: 'input',
      message: `The tool's ${exact.input} option ${String(exact.value)} is this size.`,
    };
  }
  const shaped = options.find((o) => sameShape(o.width, o.height, width, height));
  if (shaped) {
    return {
      fit: 'option',
      overlay: { [shaped.input]: shaped.value },
      dims: own,
      sizeSetBy: 'export',
      message: `The tool's ${shaped.input} option ${String(shaped.value)} is this shape, and exports at this size.`,
    };
  }
  if (tool.render?.followsCanvasSize === true) {
    return { fit: 'follows', overlay: {}, dims: own, sizeSetBy: 'export', message: 'The tool lays itself out for the canvas size.' };
  }
  const naturalWidth = tool.render?.width, naturalHeight = tool.render?.height;
  if (typeof naturalWidth === 'number' && typeof naturalHeight === 'number' && sameShape(naturalWidth, naturalHeight, width, height)) {
    return { fit: 'natural', overlay: {}, dims: own, sizeSetBy: 'export', message: `The tool's own ${naturalWidth} by ${naturalHeight} is this shape.` };
  }
  return null;
}

const FORMAT_SYNONYMS: Readonly<Record<string, string>> = { jpeg: 'jpg', jpg: 'jpeg' };

/** The tool's own spelling of the asked format, or the medium's usual one, or the tool's first. */
function chooseFormat(tool: IntentToolFactsV1, surface: IntentResolvedSurfaceV1): string | null {
  const formats = tool.render?.formats ?? [];
  if (surface.format) {
    if (formats.includes(surface.format)) return surface.format;
    const other = FORMAT_SYNONYMS[surface.format];
    return other && formats.includes(other) ? other : null;
  }
  const usual = surface.medium === 'print' ? 'pdf' : 'png';
  return formats.includes(usual) ? usual : formats[0] ?? null;
}

/** Null when `value` can fill `input`, otherwise why not. */
function valueProblem(input: NonNullable<IntentToolFactsV1['inputs']>[number], value: unknown): string | null {
  switch (input.type) {
    case 'text': case 'longtext': case 'url': case 'date': case 'time': case 'datetime-local': case 'asset':
      if (typeof value !== 'string') return `${input.id} takes text.`;
      if (input.type === 'longtext' || input.type === 'text' || input.type === 'url') return null;
      return value.trim() ? null : `${input.id} takes a value with something in it.`;
    case 'select':
      return (input.options ?? []).some((o) => (isRecord(o) ? o.value : o) === value) ? null : `${input.id} does not offer ${String(value)}.`;
    case 'table':
      if (typeof value === 'string') return null;
      if (isRecord(value) && Array.isArray(value.columns) && Array.isArray(value.rows)) return null;
      return `${input.id} takes a table: { columns, rows } or CSV text.`;
    case 'blocks':
      return Array.isArray(value) && value.every(isRecord) ? null : `${input.id} takes a list of rows, each an object.`;
    default:
      return `${input.id} is a ${input.type} input, which a role cannot fill.`;
  }
}

/** Which input a role fills for this tool and purpose, or null. */
function inputForRole(tool: IntentToolFactsV1, entry: ToolIntentV1, role: string): NonNullable<IntentToolFactsV1['inputs']>[number] | null {
  const id = entry.roles && Object.hasOwn(entry.roles, role) ? entry.roles[role] : role;
  const input = (tool.inputs ?? []).find((i) => i.id === id);
  if (!input) return null;
  return (INTENT_ROLES[role] ?? []).includes(input.type) ? input : null;
}

const hasValue = (value: unknown): boolean => {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

interface Evaluated {
  candidate: IntentCandidateV1;
  choice: IntentChoiceV1;
  fitRank: number;
}

function evaluateTool(
  tool: IntentToolFactsV1,
  intent: ParsedVisualIntent,
  purpose: IntentPurposeV1,
  surface: IntentResolvedSurfaceV1,
): { refusal: IntentRefusalV1 } | { evaluated: Evaluated } {
  const refuse = (code: IntentRefusalV1['code'], message: string) => ({ refusal: { toolId: tool.id, code, message } });
  const entry = (tool.intents ?? []).find((i) => i.purpose === purpose);
  if (!entry) return refuse('purpose-other', `Declares ${(tool.intents ?? []).map((i) => i.purpose).join(', ')}, not ${purpose}.`);
  if (tool.deprecated === true) return refuse('deprecated', 'The tool is deprecated.');
  if (tool.render?.export === false || !(tool.render?.formats?.length)) return refuse('not-exportable', 'The tool makes no exportable file.');
  const fit = surfaceFit(tool, entry, surface);
  if (!fit) return refuse('surface-no-fit', `Draws no ${surface.id} shape and would have to be stretched or letterboxed.`);
  const format = chooseFormat(tool, surface);
  if (!format) return refuse('format-unsupported', `Does not export ${surface.format}. It exports ${(tool.render?.formats ?? []).join(', ')}.`);

  const values = new Map<string, unknown>(Object.entries(entry.set ?? {}));
  const unused: IntentUnusedV1[] = [];
  const bound = new Set<string>();
  const overlayInputs = new Set(Object.keys(fit.overlay));
  for (const role of Object.keys(intent.content).sort(byString)) {
    const input = inputForRole(tool, entry, role);
    if (!input) {
      unused.push({ role, code: 'no-input', message: `The tool has no input for ${role}.` });
      continue;
    }
    const problem = valueProblem(input, intent.content[role]);
    if (problem) {
      unused.push({ role, code: 'value-refused', message: problem });
      continue;
    }
    if (overlayInputs.has(input.id)) {
      unused.push({ role, code: 'replaced-by-surface', message: `${input.id} sets the size for this surface.` });
      continue;
    }
    values.set(input.id, intent.content[role]);
    bound.add(role);
  }
  for (const [id, value] of Object.entries(fit.overlay)) values.set(id, value);

  const notes: IntentNoteV1[] = [];
  if (intent.language) {
    const primary = intent.language.split('-')[0]!;
    const select = (tool.inputs ?? []).find((i) => i.id === 'language' && i.type === 'select');
    const offered = (select?.options ?? []).some((o) => (isRecord(o) ? o.value : o) === primary);
    if (offered) {
      values.set('language', primary);
      notes.push({ code: 'language-applied', message: `The tool prints in ${primary}.` });
    } else {
      notes.push({ code: 'language-not-offered', message: `The tool has no language choice for ${primary}. The language is recorded only.` });
    }
  }

  // Visibility is read over defaults and values together, the way the runtime reads visibility.
  const effective: Record<string, unknown> = {};
  for (const input of tool.inputs ?? []) if (input.default !== undefined) effective[input.id] = input.default;
  for (const [id, value] of values) effective[id] = value;

  const gaps: IntentGapV1[] = [];
  for (const role of [...(entry.needs ?? [])].sort(byString)) {
    if (bound.has(role)) continue;
    const input = inputForRole(tool, entry, role);
    gaps.push({
      code: 'role-missing', role, ...(input ? { input: input.id } : {}),
      message: `The tool cannot serve this purpose without ${role}.`,
    });
  }
  const gapInputs = new Set(gaps.map((gap) => gap.input));
  const defaultsInUse: string[] = [];
  for (const input of tool.inputs ?? []) {
    const visible = matchesShowIf(input.showIf as Parameters<typeof matchesShowIf>[0], effective);
    if (!visible) continue;
    if (input.required === true && !hasValue(effective[input.id]) && !gapInputs.has(input.id)) {
      gaps.push({ code: 'input-required', input: input.id, message: `The tool requires ${input.id}.` });
    }
    if (values.has(input.id) || gapInputs.has(input.id) || input.group === 'export') continue;
    if (CONTENT_TYPES.has(input.type) && hasValue(input.default)) defaultsInUse.push(input.id);
  }
  gaps.sort((a, b) => byString(a.role ?? a.input ?? '', b.role ?? b.input ?? ''));
  defaultsInUse.sort(byString);

  const reasons: IntentReasonV1[] = [
    { code: 'purpose', message: `Declares ${purpose}.` },
    { code: `surface-${fit.fit}`, message: fit.message },
  ];
  const missing = gaps.map((gap) => gap.role ?? gap.input ?? '');
  reasons.push(missing.length
    ? { code: 'needs-missing', message: `Still needs ${missing.join(', ')}.` }
    : { code: 'needs-met', message: 'Has everything it needs.' });
  const offered = Object.keys(intent.content).length;
  reasons.push({ code: 'content-used', message: `Uses ${bound.size} of ${offered} content ${offered === 1 ? 'role' : 'roles'}.` });
  const preferred = intent.preferToolId === tool.id;
  if (preferred) reasons.push({ code: 'preferred', message: 'The request prefers this tool.' });

  const inputs = Object.fromEntries([...values.entries()].sort(([a], [b]) => byString(a, b)));
  return {
    evaluated: {
      fitRank: FIT_RANK[fit.fit],
      candidate: { toolId: tool.id, fit: fit.fit, preferred, missing, contentUsed: bound.size, reasons },
      choice: {
        toolId: tool.id, toolVersion: tool.version ?? null, fit: fit.fit, format, inputs, exportDims: fit.dims, sizeSetBy: fit.sizeSetBy,
        gaps, unused, defaultsInUse, notes,
      },
    },
  };
}

function resolveSurface(
  surface: IntentResolvedSurfaceV1,
  purpose: IntentPurposeV1,
  intent: ParsedVisualIntent,
  tools: readonly IntentToolFactsV1[],
): IntentSurfaceResultV1 {
  const refusals: IntentRefusalV1[] = [];
  const evaluated: Evaluated[] = [];
  for (const tool of tools) {
    if (!tool.intents?.length) continue;
    const answer = evaluateTool(tool, intent, purpose, surface);
    if ('refusal' in answer) refusals.push(answer.refusal);
    else evaluated.push(answer.evaluated);
  }
  evaluated.sort((a, b) =>
    Number(b.candidate.preferred) - Number(a.candidate.preferred)
    || Number(a.candidate.missing.length > 0) - Number(b.candidate.missing.length > 0)
    || b.fitRank - a.fitRank
    || b.candidate.contentUsed - a.candidate.contentUsed
    || byString(a.candidate.toolId, b.candidate.toolId));
  const best = evaluated[0];
  if (!best) {
    const served = refusals.some((r) => r.code !== 'purpose-other');
    const formatOnly = served && refusals.every((r) => r.code === 'purpose-other' || r.code === 'format-unsupported');
    const refusal = formatOnly
      ? { code: 'format-unsupported' as const, message: `No tool serving ${purpose} exports ${surface.format} at ${surface.id}.` }
      : served
        ? { code: 'no-tool-for-surface' as const, message: `No tool serving ${purpose} can draw ${surface.id}.` }
        : { code: 'no-tool-for-purpose' as const, message: `No available tool declares ${purpose}.` };
    return { surface, status: 'refused', chosen: null, candidates: [], refusals, refusal };
  }
  const choice = best.choice;
  if (intent.preferToolId && !best.candidate.preferred) {
    choice.notes = [...choice.notes, { code: 'prefer-not-available', message: `${intent.preferToolId} does not fit this surface or is not available.` }];
  }
  return {
    surface,
    status: best.candidate.missing.length ? 'needs-content' : 'ready',
    chosen: choice,
    candidates: evaluated.map((e) => e.candidate),
    refusals,
    refusal: null,
  };
}

function outcomeOf(results: readonly IntentSurfaceResultV1[]): IntentOutcomeV1 {
  const count = (status: IntentSurfaceResultV1['status']) => results.filter((r) => r.status === status).length;
  if (count('ready') === results.length) return 'ready';
  if (count('ready') > 0) return 'partial';
  return count('needs-content') > 0 ? 'needs-content' : 'refused';
}

/** Tools in one order whatever order they came in; the first of a repeated id wins. */
function orderedTools(tools: readonly IntentToolFactsV1[]): IntentToolFactsV1[] {
  const seen = new Set<string>();
  return [...tools]
    .sort((a, b) => byString(a.id, b.id) || byString(canonicalJson(a), canonicalJson(b)))
    .filter((tool) => {
      if (seen.has(tool.id)) return false;
      seen.add(tool.id);
      return true;
    });
}

function purposeNeeded(tools: readonly IntentToolFactsV1[]): IntentPurposeNeededV1 {
  const declaring = tools.filter((tool) => tool.intents?.length);
  return {
    code: INTENT_PURPOSE_NEEDED,
    message: 'Nothing here reads meaning from a prompt. Read your user\'s words, choose a purpose and surfaces, and call again with them.',
    purposes: INTENT_PURPOSES.map((purpose) => ({
      purpose,
      meaning: INTENT_PURPOSE_MEANINGS[purpose],
      tools: declaring.filter((tool) => tool.intents!.some((i) => i.purpose === purpose)).map((tool) => tool.id),
    })),
    tools: declaring.map((tool) => ({
      toolId: tool.id, name: tool.name ?? null,
      purposes: [...new Set(tool.intents!.map((i) => i.purpose))].sort(byString),
    })),
    surfaces: INTENT_SURFACES.map((s) => s.id),
    roles: Object.keys(INTENT_ROLES).sort(byString),
  };
}

/** Same request, same digest, whatever order its keys came in. A false `recordPrompt` is the default, so it is left out. */
function digestPayload(intent: ParsedVisualIntent): Record<string, unknown> {
  return {
    version: intent.version,
    ...(intent.purpose ? { purpose: intent.purpose } : {}),
    ...(intent.prompt !== null ? { prompt: intent.prompt } : {}),
    ...(intent.recordPrompt ? { recordPrompt: true } : {}),
    ...intent.freeText,
    ...(intent.language ? { language: intent.language } : {}),
    content: intent.content,
    surfaces: intent.surfaces.map((s) => ({ id: s.id, ...(s.format ? { format: s.format } : {}) })),
    ...(intent.preferToolId ? { prefer: intent.preferToolId } : {}),
  };
}

/**
 * Resolve a request against the tools a caller may consider. Throws `IntentInvalidError` for
 * a request the parser refuses; every other answer, refusals included, is the result.
 */
export async function resolveIntent(request: unknown, tools: readonly IntentToolFactsV1[]): Promise<IntentResolutionV1> {
  const parsed = parseVisualIntent(request);
  if (!parsed.ok) throw new IntentInvalidError(parsed.errors);
  const intent = parsed.intent;
  const ordered = orderedTools(tools);
  const purpose = intent.purpose;
  const results = purpose ? intent.surfaces.map((surface) => resolveSurface(surface, purpose, intent, ordered)) : [];
  const digest = await sha256Hex(new TextEncoder().encode(canonicalJson(digestPayload(intent))));
  return {
    format: INTENT_RESOLUTION_FORMAT,
    formatVersion: INTENT_RESOLUTION_VERSION,
    intentDigest: `sha256:${digest}`,
    closed: {
      purpose,
      surfaces: intent.surfaces.map((s) => s.id),
      language: intent.language,
      chosen: results.map((r) => ({
        surface: r.surface.id,
        toolId: r.chosen?.toolId ?? null,
        toolVersion: r.chosen?.toolVersion ?? null,
        fit: r.chosen?.fit ?? null,
        status: r.status,
      })),
      rulesVersion: INTENT_RULES_VERSION,
      vocabularyVersion: INTENT_VOCABULARY_VERSION,
    },
    freeText: intent.freeText,
    prompt: intent.prompt,
    recordPrompt: intent.recordPrompt,
    outcome: purpose ? outcomeOf(results) : 'purpose-needed',
    surfaces: results,
    purposeNeeded: purpose ? null : purposeNeeded(ordered),
    toolsConsidered: ordered.length,
  };
}

/** A problem with a tool's `intents.json`, for the catalog validator. */
export interface ToolIntentIssue {
  path: string;
  message: string;
}

export type ParseToolIntentsResult =
  | { ok: true; intents: ToolIntentV1[] }
  | { ok: false; errors: ToolIntentIssue[] };

const TOOL_INTENT_KEYS: ReadonlySet<string> = new Set(['purpose', 'needs', 'roles', 'set', 'surfaces']);

/**
 * Read the text of a tool's `intents.json`. Shape only: `checkToolIntents` holds the entries
 * against the tool's manifest. Pure, and it never throws on bad input.
 */
export function parseToolIntents(text: string): ParseToolIntentsResult {
  const fail = (path: string, message: string): ParseToolIntentsResult => ({ ok: false, errors: [{ path, message }] });
  if (text.length > INTENT_LIMITS.toolIntentsChars) return fail('', `intents.json is at most ${INTENT_LIMITS.toolIntentsChars} characters.`);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (err) {
    return fail('', `intents.json is not JSON (${(err as Error).message}).`);
  }
  if (!isRecord(value)) return fail('', 'intents.json is a JSON object.');
  if (checkValue(value, 0)) return fail('', 'intents.json holds plain JSON, nested at most a bounded depth, with no key that names a prototype.');
  const errors: ToolIntentIssue[] = [];
  for (const key of Object.keys(value)) {
    if (key !== 'version' && key !== 'intents') errors.push({ path: key, message: `intents.json does not take "${key}".` });
  }
  if (value.version !== TOOL_INTENTS_VERSION) errors.push({ path: 'version', message: `version is ${TOOL_INTENTS_VERSION}.` });
  const entries = value.intents;
  if (!Array.isArray(entries) || !entries.length || entries.length > INTENT_PURPOSES.length) {
    errors.push({ path: 'intents', message: `intents is a list of 1 to ${INTENT_PURPOSES.length} entries.` });
    return { ok: false, errors };
  }
  const isStringMap = (v: unknown): boolean => isRecord(v) && Object.values(v).every((item) => typeof item === 'string');
  entries.forEach((entry: unknown, index) => {
    const at = `intents/${index}`;
    if (!isRecord(entry)) { errors.push({ path: at, message: 'An entry is an object.' }); return; }
    for (const key of Object.keys(entry)) {
      if (!TOOL_INTENT_KEYS.has(key)) errors.push({ path: `${at}/${key}`, message: `An entry does not take "${key}".` });
    }
    if (!(INTENT_PURPOSES as readonly unknown[]).includes(entry.purpose)) errors.push({ path: `${at}/purpose`, message: `Unknown purpose. Purposes: ${INTENT_PURPOSES.join(', ')}.` });
    if (entry.needs !== undefined && !(Array.isArray(entry.needs) && entry.needs.every((role) => typeof role === 'string'))) errors.push({ path: `${at}/needs`, message: 'needs is a list of roles.' });
    if (entry.roles !== undefined && !isStringMap(entry.roles)) errors.push({ path: `${at}/roles`, message: 'roles maps a role to an input id.' });
    if (entry.set !== undefined && !isRecord(entry.set)) errors.push({ path: `${at}/set`, message: 'set maps an input id to a value.' });
    if (entry.surfaces !== undefined && !(isRecord(entry.surfaces) && Object.values(entry.surfaces).every(isRecord))) errors.push({ path: `${at}/surfaces`, message: 'surfaces maps a surface to input values.' });
  });
  return errors.length ? { ok: false, errors } : { ok: true, intents: entries as ToolIntentV1[] };
}

/** Where `loadIntentTools` reads from. A shell supplies these through its own content resolver. */
export interface IntentToolSource {
  ids: readonly string[];
  /** The text of the tool's `intents.json`, or null when the tool has none. */
  sidecar(id: string): string | null | Promise<string | null>;
  manifest(id: string): unknown;
  /** Told about a sidecar that will not parse. That tool is left out; the others still resolve. */
  onInvalid?(id: string, errors: readonly ToolIntentIssue[]): void;
}

/**
 * The tools a caller can hand to `resolveIntent`: each manifest with the entries of its
 * sidecar as `intents`. A tool with no `intents.json` is left out, so it is not offered. The
 * manifest is only read for a tool that has a sidecar. Pure apart from the reads it is given.
 */
export async function loadIntentTools(source: IntentToolSource): Promise<IntentToolFactsV1[]> {
  const tools: IntentToolFactsV1[] = [];
  for (const id of source.ids) {
    const text = await source.sidecar(id);
    if (text === null) continue;
    const parsed = parseToolIntents(text);
    if (!parsed.ok) { source.onInvalid?.(id, parsed.errors); continue; }
    tools.push({ ...(await source.manifest(id) as IntentToolFactsV1), intents: parsed.intents });
  }
  return tools;
}

/**
 * What the schema cannot say about a tool's `intents.json`: roles that exist, inputs that
 * exist and take the role, surfaces that are named, select values that are offered, one
 * entry per purpose, a required input that can be reached and a file the tool can export.
 */
export function checkToolIntents(tool: IntentToolFactsV1): ToolIntentIssue[] {
  const issues: ToolIntentIssue[] = [];
  const entries = tool.intents ?? [];
  if (!entries.length) return issues;
  const add = (path: string, message: string): void => { issues.push({ path, message }); };
  if (tool.render?.export === false || !(tool.render?.formats?.length)) add('intents', 'A tool that exports no file cannot declare an intent.');
  const inputs = new Map((tool.inputs ?? []).map((input) => [input.id, input]));
  const checkValues = (path: string, values: Record<string, unknown>): void => {
    for (const [id, value] of Object.entries(values)) {
      const input = inputs.get(id);
      if (!input) { add(`${path}/${id}`, `No input "${id}".`); continue; }
      if (input.type !== 'select') continue;
      const offered = (input.options ?? []).map((o) => (isRecord(o) ? o.value : o));
      if (!offered.includes(value)) add(`${path}/${id}`, `"${String(value)}" is not an option of ${id}.`);
    }
  };
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    const at = `intents/${index}`;
    if (seen.has(entry.purpose)) add(at, `Purpose ${entry.purpose} is declared twice.`);
    seen.add(entry.purpose);
    for (const [role, id] of Object.entries(entry.roles ?? {})) {
      if (!Object.hasOwn(INTENT_ROLES, role)) { add(`${at}/roles/${role}`, `Unknown role "${role}".`); continue; }
      const input = inputs.get(id);
      if (!input) add(`${at}/roles/${role}`, `No input "${id}".`);
      else if (!(INTENT_ROLES[role] ?? []).includes(input.type)) add(`${at}/roles/${role}`, `Role ${role} cannot fill a ${input.type} input.`);
    }
    for (const role of entry.needs ?? []) {
      if (!Object.hasOwn(INTENT_ROLES, role)) add(`${at}/needs/${role}`, `Unknown role "${role}".`);
      else if (!inputForRole(tool, entry, role)) add(`${at}/needs/${role}`, `Needs ${role}, and no input takes it.`);
    }
    checkValues(`${at}/set`, entry.set ?? {});
    for (const [id, overlay] of Object.entries(entry.surfaces ?? {})) {
      if (!SURFACES_BY_ID.has(id)) add(`${at}/surfaces/${id}`, `Unknown surface "${id}".`);
      checkValues(`${at}/surfaces/${id}`, overlay ?? {});
    }
    // A required, visible input no role can reach would leave the purpose unservable.
    const effective: Record<string, unknown> = {};
    for (const input of tool.inputs ?? []) if (input.default !== undefined) effective[input.id] = input.default;
    Object.assign(effective, entry.set ?? {});
    const reachable = new Set(Object.keys(INTENT_ROLES).map((role) => inputForRole(tool, entry, role)?.id));
    for (const input of tool.inputs ?? []) {
      if (input.required !== true || hasValue(effective[input.id]) || reachable.has(input.id)) continue;
      if (matchesShowIf(input.showIf as Parameters<typeof matchesShowIf>[0], effective)) {
        add(`${at}`, `Input ${input.id} is required and no role can fill it.`);
      }
    }
  });
  return issues;
}
