// SPDX-License-Identifier: MPL-2.0
/**
 * intent-v1: a caller states what a piece has to do for its reader, and the engine's
 * `resolveIntent` chooses the tool, fills its inputs from the content given and says why
 * (plan 350 W4). `lolly intent`, the `lolly_resolve_intent` MCP tool and any later route
 * return the same `IntentResolutionV1`, mirrored by schemas/intent-resolution-v1.schema.json.
 * The request is mirrored by schemas/visual-intent-v1.schema.json. Each has a
 * byte-identical copy under `packages/core/schema/` for the SDK.
 *
 * No model is in this path. A person or an agent writes the intent; the resolver reads
 * closed values only and never reads meaning from text. Three kinds of value are kept
 * apart in the types, because they are treated differently wherever they are stored:
 *
 * - **Closed values** (`IntentClosedFactsV1`): purpose, surface ids, language, chosen tool,
 *   rules version. Vocabulary or facts of this repository, safe to show as they are.
 * - **Free text** (`IntentFreeTextV1`): occasion, audience, region. Written by the caller.
 *   Recorded with the intent and read by nothing that decides.
 * - **The prompt** (`VisualIntentV1.prompt`): the words the user first said to an agent.
 *   Bounded, carried and digested, and never read by the resolver.
 *
 * Types and constants only: no runtime, no DOM, no I/O.
 */

/** Report discriminator, as `CHECK_FORMAT` is for a check report. */
export const INTENT_RESOLUTION_FORMAT = 'lolly-intent-resolution' as const;
/** Bumped only for a change an older reader would misread. */
export const INTENT_RESOLUTION_VERSION = 1 as const;
/** The version a `VisualIntentV1` document states. */
export const VISUAL_INTENT_VERSION = 1 as const;
/** Bumped when a purpose, a role or a named surface is added or changes meaning. */
export const INTENT_VOCABULARY_VERSION = 2 as const;

/**
 * What a piece has to do for its reader. Closed: each one is served by at least one real
 * tool in the catalog (`tests/intent.test.ts` pins that), so a purpose is never a promise
 * nothing keeps. Adding one is additive and bumps `INTENT_VOCABULARY_VERSION`.
 */
export const INTENT_PURPOSES = [
  'announce',
  'compare',
  'demonstrate',
  'direct',
  'explain',
  'identify',
  'invite',
  'offer',
  'present',
  'promote',
  'recognise',
  'report',
  'schedule',
] as const;
export type IntentPurposeV1 = (typeof INTENT_PURPOSES)[number];

/** One line on each purpose, for a person choosing one or an agent reading its user's prompt. */
export const INTENT_PURPOSE_MEANINGS: Readonly<Record<IntentPurposeV1, string>> = Object.freeze({
  announce: 'Tell people that something has happened or is about to.',
  compare: 'Set options, values or results side by side so a reader can weigh them.',
  demonstrate: 'Show how something looks or works, as a mock-up or a framed example.',
  direct: 'Send a reader somewhere: to a place, a room or a link.',
  explain: 'Help a reader understand a subject or a set of numbers.',
  identify: 'Say who someone is and how to reach them.',
  invite: 'Ask a reader to attend something and give them the time and place.',
  offer: 'Say what is on offer and what it costs.',
  present: 'Carry a talk or a meeting, slide by slide.',
  promote: 'Bring a reader to a page, a product or an idea.',
  recognise: 'Honour a person, an achievement or the people behind something.',
  report: 'State results or progress over a period.',
  schedule: 'Say when things happen.',
});

/**
 * A role in `content`: what a value is to the piece, whatever a tool calls its input.
 * `accepts` lists the input types the role may fill. Mirrored by the `roles` section of
 * schemas/canonical-inputs.json (`tests/intent.test.ts` holds the two together).
 *
 * Colours and framing are absent on purpose: an intent says what to say, and the design
 * system says how it looks.
 */
export const INTENT_ROLES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  address: ['text'],
  awarddate: ['date'],
  awardtopic: ['text'],
  bgImage: ['asset'],
  body: ['longtext', 'text'],
  company: ['text'],
  cta: ['text'],
  currency: ['select'],
  data: ['longtext', 'table', 'blocks'],
  email: ['text'],
  eventEnd: ['datetime-local'],
  eventLocation: ['text'],
  eventName: ['text'],
  eventStart: ['datetime-local'],
  firstname: ['text'],
  heading: ['text'],
  headshot: ['asset'],
  image: ['asset'],
  jobTitle: ['text'],
  lastname: ['text'],
  /** The partner's mark in a co-branded piece: the guest's logo, never the lead brand's
   *  (vocabulary 2, Lolly Work plan 82 M7). The lead brand's own logo is not a role,
   *  because the design system supplies the look. */
  partnerMark: ['asset'],
  phone: ['text'],
  recipient: ['text'],
  sender: ['text'],
  sourceAuthor: ['text'],
  subheading: ['text'],
  url: ['url', 'text'],
});

/** A size unit an intent may name. The set a select option's `unit` already uses. */
export const INTENT_SURFACE_UNITS = ['px', 'mm', 'cm', 'in', 'pt'] as const;
export type IntentSurfaceUnitV1 = (typeof INTENT_SURFACE_UNITS)[number];

export type IntentMediumV1 = 'screen' | 'print';

/** One named surface: where a piece will be seen, as a size. */
export interface IntentSurfaceSpecV1 {
  id: string;
  width: number;
  height: number;
  unit: IntentSurfaceUnitV1;
  medium: IntentMediumV1;
}

/**
 * The named surfaces. The screen ids and sizes are the ones Certificate's `pageSize`
 * options already use, and the print sizes are the ones the size selects of the print
 * tools use, so a tool's own options answer most of these without any new declaration.
 * No platform names: a size outlives the service that uses it this year.
 */
export const INTENT_SURFACES: readonly IntentSurfaceSpecV1[] = Object.freeze([
  { id: 'slide', width: 1920, height: 1080, unit: 'px', medium: 'screen' },
  { id: 'screen', width: 1600, height: 1000, unit: 'px', medium: 'screen' },
  { id: 'social-landscape', width: 1200, height: 628, unit: 'px', medium: 'screen' },
  { id: 'social-square', width: 1080, height: 1080, unit: 'px', medium: 'screen' },
  { id: 'social-portrait', width: 1080, height: 1350, unit: 'px', medium: 'screen' },
  { id: 'story', width: 1080, height: 1920, unit: 'px', medium: 'screen' },
  { id: 'banner', width: 1200, height: 400, unit: 'px', medium: 'screen' },
  { id: 'a4-portrait', width: 210, height: 297, unit: 'mm', medium: 'print' },
  { id: 'a4-landscape', width: 297, height: 210, unit: 'mm', medium: 'print' },
  { id: 'a3-portrait', width: 297, height: 420, unit: 'mm', medium: 'print' },
  { id: 'a3-landscape', width: 420, height: 297, unit: 'mm', medium: 'print' },
  { id: 'a2-portrait', width: 420, height: 594, unit: 'mm', medium: 'print' },
  { id: 'a2-landscape', width: 594, height: 420, unit: 'mm', medium: 'print' },
  { id: 'a1-portrait', width: 594, height: 841, unit: 'mm', medium: 'print' },
  { id: 'letter-portrait', width: 8.5, height: 11, unit: 'in', medium: 'print' },
  { id: 'letter-landscape', width: 11, height: 8.5, unit: 'in', medium: 'print' },
  { id: 'business-card', width: 85, height: 55, unit: 'mm', medium: 'print' },
]);

/** The ceilings `parseVisualIntent` refuses past. Refused, never truncated. */
export const INTENT_LIMITS = Object.freeze({
  /** UTF-16 units in `prompt`. Enough for a request typed at an agent, not for a brief. */
  promptChars: 2000,
  /** UTF-16 units in each of occasion, audience and region. */
  freeTextChars: 200,
  /** Entries in `surfaces`. */
  surfaces: 32,
  /** Keys in `content`. The vocabulary is smaller; this bounds what is read before refusing the rest. */
  contentKeys: 64,
  /** Nesting depth of a content value. */
  depth: 16,
  /** UTF-16 units of the whole request once serialised. */
  totalChars: 2 * 1024 * 1024,
  /** UTF-16 units of one tool's `intents.json`. */
  toolIntentsChars: 64 * 1024,
  /** Pixels on one side of a sized surface, and its equal in other units once converted. */
  sidePx: 100000,
});

/** The fields `IntentFreeTextV1` holds, for anything that treats them differently. */
export const INTENT_FREE_TEXT_FIELDS = ['occasion', 'audience', 'region'] as const;

/**
 * Words a caller wrote about the circumstances. Recorded and returned; nothing that decides
 * ever reads them, so the same request resolves the same way whatever they say.
 */
export interface IntentFreeTextV1 {
  occasion?: string;
  audience?: string;
  region?: string;
}

/** Where a piece will be seen: a named surface, or a size. `format` asks for one output format. */
export type IntentSurfaceRequestV1 =
  | { id: string; format?: string }
  | { width: number; height: number; unit?: IntentSurfaceUnitV1; format?: string };

/**
 * A request: what the piece has to do, where it will be seen and what it has to say.
 *
 * `purpose` may be left out only when `prompt` is given, and the answer is then
 * `outcome: 'purpose-needed'`, carrying the purposes and the tools so the agent that read
 * its own user's words can choose one and call again. `surfaces` is required with a purpose.
 */
export interface VisualIntentV1 extends IntentFreeTextV1 {
  version: typeof VISUAL_INTENT_VERSION;
  purpose?: IntentPurposeV1;
  /** The user's first words to an agent, at most `INTENT_LIMITS.promptChars`. Never read for meaning. */
  prompt?: string;
  /** Asks a render to record the prompt's own words in the file's credential. Default false: a fingerprint. A run's own answer wins. */
  recordPrompt?: boolean;
  /** Content by role: keys are `INTENT_ROLES`. */
  content?: Record<string, unknown>;
  /** A short language tag such as `de` or `pt-BR`. Selects where a tool offers that language. */
  language?: string;
  surfaces?: IntentSurfaceRequestV1[];
  /** Rank this tool first among the ones that fit the surface. */
  prefer?: { toolId: string };
}

/** The file a tool declares its purposes in, beside its manifest. Optional: a tool with none is not offered for an intent. */
export const TOOL_INTENTS_FILE = 'intents.json' as const;
/** The version a tool's `intents.json` states. */
export const TOOL_INTENTS_VERSION = 1 as const;

/**
 * A tool's `intents.json`, mirrored by schemas/tool-intents-v1.schema.json. It sits beside the
 * manifest and not inside it on purpose: loading a tool never reads this file, so a tool that
 * has one needs no new manifest key and no raised engine floor, and an older app is unaffected.
 */
export interface ToolIntentsFileV1 {
  version: typeof TOOL_INTENTS_VERSION;
  intents: ToolIntentV1[];
}

/** A tool's declaration that it serves one purpose (an entry of `intents.json`). */
export interface ToolIntentV1 {
  purpose: IntentPurposeV1;
  /** Roles this tool cannot serve the purpose without. Missing ones are reported, never invented. */
  needs?: string[];
  /** Role to input id, where the input's id is not the role's own. */
  roles?: Record<string, string>;
  /** Input values this purpose starts from, such as blanking a tool's sample wording. Content overrides them. */
  set?: Record<string, unknown>;
  /**
   * Surfaces this tool draws correctly, each with the input values that give that size.
   * Only for what a select's sized options cannot already say: an option with `width` and
   * `height` answers for itself.
   */
  surfaces?: Record<string, Record<string, unknown>>;
}

/**
 * The facts the resolver reads: a parsed `tool.json` with the entries of the tool's
 * `intents.json` as `intents` (the engine's `loadIntentTools` puts the two together). A caller
 * filters first to what the caller may use. The resolver has no idea of permission: Work
 * narrows this list by policy before calling.
 */
export interface IntentToolFactsV1 {
  id: string;
  name?: string;
  version?: string;
  engineVersion?: string;
  deprecated?: boolean;
  intents?: readonly ToolIntentV1[];
  inputs?: readonly {
    id: string;
    type: string;
    required?: boolean;
    default?: unknown;
    options?: readonly unknown[];
    showIf?: unknown;
    group?: string;
  }[];
  render?: {
    width?: number;
    height?: number;
    unit?: string;
    formats?: readonly string[];
    export?: boolean;
    followsCanvasSize?: boolean;
  };
}

/** How a tool fits a surface, best first in `IntentChoiceV1` ranking. */
export const INTENT_FITS = ['declared', 'option', 'follows', 'natural'] as const;
export type IntentFitV1 = (typeof INTENT_FITS)[number];

export type IntentSurfaceStatusV1 = 'ready' | 'needs-content' | 'refused';
export type IntentOutcomeV1 = 'ready' | 'partial' | 'needs-content' | 'refused' | 'purpose-needed';

/** Why a tool was left out for one surface. Stable codes: branch on these. */
export const INTENT_REFUSAL_CODES = [
  'purpose-other',
  'surface-no-fit',
  'format-unsupported',
  'not-exportable',
  'deprecated',
] as const;
export type IntentRefusalCodeV1 = (typeof INTENT_REFUSAL_CODES)[number];

/** Why a surface has no tool. */
export const INTENT_SURFACE_REFUSAL_CODES = ['no-tool-for-purpose', 'no-tool-for-surface', 'format-unsupported'] as const;
export type IntentSurfaceRefusalCodeV1 = (typeof INTENT_SURFACE_REFUSAL_CODES)[number];

/** What is missing before a tool can serve the purpose. */
export const INTENT_GAP_CODES = ['role-missing', 'input-required'] as const;
export type IntentGapCodeV1 = (typeof INTENT_GAP_CODES)[number];

/** Why a piece of content went unused by the chosen tool. */
export const INTENT_UNUSED_CODES = ['no-input', 'value-refused', 'replaced-by-surface'] as const;
export type IntentUnusedCodeV1 = (typeof INTENT_UNUSED_CODES)[number];

/** Something the caller should know that did not stop the resolution. */
export const INTENT_NOTE_CODES = ['language-applied', 'language-not-offered', 'prefer-not-available'] as const;
export type IntentNoteCodeV1 = (typeof INTENT_NOTE_CODES)[number];

/** What a request's parser refuses. Stable codes: branch on these. */
export const INTENT_ERROR_CODES = [
  'intent.not-object',
  'intent.too-large',
  'intent.unknown-key',
  'intent.version',
  'intent.purpose-or-prompt',
  'intent.purpose-unknown',
  'intent.prompt-invalid',
  'intent.prompt-too-long',
  'intent.free-text-invalid',
  'intent.record-prompt-invalid',
  'intent.language-invalid',
  'intent.prefer-invalid',
  'intent.surfaces-required',
  'intent.surfaces-invalid',
  'intent.surface-unknown',
  'intent.surface-duplicate',
  'intent.content-invalid',
  'intent.role-unknown',
] as const;
export type IntentErrorCodeV1 = (typeof INTENT_ERROR_CODES)[number];

/** The stable code on a result whose request gave a prompt and no purpose. */
export const INTENT_PURPOSE_NEEDED = 'intent.purpose-needed' as const;

export interface IntentErrorV1 {
  code: IntentErrorCodeV1;
  /** JSON pointer into the request. */
  path: string;
  message: string;
}

/** A surface after parsing: always a size, named when the size is one of the named surfaces. */
export interface IntentResolvedSurfaceV1 {
  /** The named surface id, or `<width>x<height><unit>` for any other size. */
  id: string;
  named: boolean;
  width: number;
  height: number;
  unit: IntentSurfaceUnitV1;
  medium: IntentMediumV1;
  format?: string;
}

export interface IntentReasonV1 {
  code: string;
  message: string;
}

export interface IntentGapV1 {
  code: IntentGapCodeV1;
  /** The role to supply. Absent when a required input has no role. */
  role?: string;
  /** The tool's input it would fill. */
  input?: string;
  message: string;
}

export interface IntentUnusedV1 {
  role: string;
  code: IntentUnusedCodeV1;
  message: string;
}

export interface IntentNoteV1 {
  code: IntentNoteCodeV1;
  message: string;
}

/** The size to ask the render path for. */
export interface IntentExportDimsV1 {
  width: number;
  height: number;
  unit: IntentSurfaceUnitV1;
}

/** The tool chosen for one surface, and everything needed to run that tool. */
export interface IntentChoiceV1 {
  toolId: string;
  toolVersion: string | null;
  fit: IntentFitV1;
  format: string;
  /** Input values to render with: `set`, then content, then the surface's own overlay. */
  inputs: Record<string, unknown>;
  /** The size the file comes out at. */
  exportDims: IntentExportDimsV1;
  /**
   * What sets that size. `input`: one of `inputs` is a size option, and the tool applies it, so
   * a render passes no export size. `export`: pass `exportDims` as the render's width, height and unit.
   */
  sizeSetBy: 'input' | 'export';
  gaps: IntentGapV1[];
  unused: IntentUnusedV1[];
  /** Inputs that will print the tool's own default wording or sample, since nothing set them. */
  defaultsInUse: string[];
  notes: IntentNoteV1[];
}

export interface IntentCandidateV1 {
  toolId: string;
  fit: IntentFitV1;
  preferred: boolean;
  /** The needed roles and required inputs still missing. */
  missing: string[];
  contentUsed: number;
  reasons: IntentReasonV1[];
}

export interface IntentRefusalV1 {
  toolId: string;
  code: IntentRefusalCodeV1;
  message: string;
}

/** The answer for one requested surface. */
export interface IntentSurfaceResultV1 {
  surface: IntentResolvedSurfaceV1;
  status: IntentSurfaceStatusV1;
  /** The best candidate: the one to render when `ready`, the one to complete when `needs-content`. */
  chosen: IntentChoiceV1 | null;
  /** Every tool that fits, best first. */
  candidates: IntentCandidateV1[];
  refusals: IntentRefusalV1[];
  refusal: { code: IntentSurfaceRefusalCodeV1; message: string } | null;
}

/** One surface's chosen tool, as a closed fact. */
export interface IntentChosenFactV1 {
  surface: string;
  toolId: string | null;
  toolVersion: string | null;
  fit: IntentFitV1 | null;
  status: IntentSurfaceStatusV1;
}

/**
 * The closed values of a resolution: vocabulary and repository facts, never anything a
 * caller typed. Everything here may be shown or stored as it is.
 */
export interface IntentClosedFactsV1 {
  /** Null only when the request gave a prompt and no purpose. */
  purpose: IntentPurposeV1 | null;
  surfaces: string[];
  /** The normalised language tag, or null. */
  language: string | null;
  chosen: IntentChosenFactV1[];
  rulesVersion: string;
  vocabularyVersion: typeof INTENT_VOCABULARY_VERSION;
}

/** What an agent needs to choose a purpose itself. Only on `outcome: 'purpose-needed'`. */
export interface IntentPurposeNeededV1 {
  code: typeof INTENT_PURPOSE_NEEDED;
  message: string;
  purposes: { purpose: IntentPurposeV1; meaning: string; tools: string[] }[];
  tools: { toolId: string; name: string | null; purposes: IntentPurposeV1[] }[];
  surfaces: string[];
  roles: string[];
}

/**
 * The answer. Same shape for every outcome, so one reader handles them all. Stable and
 * versioned: `format` and `formatVersion` say which reading applies.
 *
 * `closed`, `freeText` and `prompt` are separate on purpose. Whatever stores this object
 * can treat each by what it is without reading any of them for meaning.
 */
export interface IntentResolutionV1 {
  format: typeof INTENT_RESOLUTION_FORMAT;
  formatVersion: typeof INTENT_RESOLUTION_VERSION;
  /** `sha256:` of the canonical request, prompt and content included. */
  intentDigest: string;
  closed: IntentClosedFactsV1;
  freeText: IntentFreeTextV1;
  /** The user's words as given, or null. Carried, never read. */
  prompt: string | null;
  /** The request's own answer on recording the prompt's words. A run's own answer wins. */
  recordPrompt: boolean;
  outcome: IntentOutcomeV1;
  /** Empty on `purpose-needed`. */
  surfaces: IntentSurfaceResultV1[];
  purposeNeeded: IntentPurposeNeededV1 | null;
  /** How many tools were handed in, whether or not they declare intents. */
  toolsConsidered: number;
}
