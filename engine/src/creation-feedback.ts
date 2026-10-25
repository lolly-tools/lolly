// SPDX-License-Identifier: MPL-2.0
/**
 * Creation feedback for a Design document: one report that informs a person or an
 * agent while they make the document, and never blocks anything.
 *
 * Two readings sit in the report:
 *
 *  - House rules. `checkDesignHouseRules` against the design system's rules (by
 *    default `brandSystemOf(doc).rules`), the same check `lolly check` runs in its
 *    brand family. A finding informs; which findings matter is the reader's call.
 *    Rules of the `BRAND_RULE_KINDS` are answered by the Usage room's examples, not
 *    by layers, so they are left to it; a kind no checker knows is listed in
 *    `unknown`, never passed.
 *  - Writing. `analyzeTextSignals(text, { source: 'digital' })` over the text the
 *    document draws, the score Verify shows for text. It is a signal, never a
 *    verdict or a probability: the report carries the engine's own summary
 *    sentence, the band and the score, plus the strongest flagged phrases with the
 *    layer each sits in, so a model can revise those layers.
 *
 * The text is read layer by layer in reading order: artboards in the order the
 * structure check lists them, then each artboard's layers top to bottom and left to
 * right, then loose layers. Markup is dropped (`plainOfDesignText`), a composed
 * story is read from the `textDocument`, and layers are joined with a blank line so
 * a flagged span leads back to one layer. Hidden layers, members of a hidden
 * artboard and members of a hidden group are left out, and the report says how many.
 *
 * `creationFeedbackDelta` compares two reports for the layers one edit touched, the
 * compact answer an agent gets after each change.
 *
 * Pure and deterministic: no DOM, no clock, no network, no randomness. The same
 * boxes, rules and design system give the same report on every host.
 */
import type { BrandRuleV1 } from '@lolly-tools/core/brand-system-v1';
import { BRAND_RULE_KINDS } from './brand-rules.ts';
import { brandSystemOf } from './brand-system.ts';
import { checkDesignHouseRules, type HouseRuleFinding } from './design-house-rules.ts';
import { plainOfDesignText } from './design-text.ts';
import { analyzeTextSignals, LEXICON_VERSION, type TextSignalBand, type TextSignalFinding, type TextSignalTier } from './text-signals.ts';

/** Report discriminator. */
export const CREATION_FEEDBACK_FORMAT = 'lolly-creation-feedback' as const;
/** Bumped only for a change an older reader would misread. */
export const CREATION_FEEDBACK_VERSION = 1 as const;

/** Most characters scored, the forensic page budget: whole layers only. */
export const CREATION_FEEDBACK_TEXT_LIMIT = 65_536;
/** Phrases kept by default. */
const DEFAULT_PHRASES = 5;
/** Writing findings kept in the report, strongest first. */
const FINDING_LIMIT = 12;
/** Longest phrase quoted back; a longer span is cut with an ellipsis. */
const PHRASE_MAX = 120;
/** Hidden layer ids named in the report; the count is always whole. */
const HIDDEN_ID_LIMIT = 20;
/** Rows read, the house-rule checker's own ceiling. */
const ROW_LIMIT = 5000;
const JOIN = '\n\n';
/** Kinds that draw no words on the page. */
const NOT_TEXT = new Set(['frame', 'group', 'image', 'audio', 'camera', '3d', 'web']);

/** One layer's slice of the scored text. */
export interface DesignTextSegment {
  layerId: string;
  artboardId?: string;
  /** Offset of this layer's words in `text`, in UTF-16 code units. */
  index: number;
  length: number;
}

/** The words a Design document draws, with each layer's place in them. */
export interface DesignVisibleText {
  text: string;
  segments: DesignTextSegment[];
  /** Text layers that were hidden and so left out. */
  hidden: number;
  /** Up to 20 of those layer ids, in document order. */
  hiddenLayerIds: string[];
  /** True when the text passed `CREATION_FEEDBACK_TEXT_LIMIT` and later layers were left out. */
  truncated: boolean;
}

export interface DesignVisibleTextOpts {
  /** Design's `textDocument` input, for layers whose words live in a composed story. */
  textDocument?: unknown;
  /** Most characters to read. Default `CREATION_FEEDBACK_TEXT_LIMIT`. */
  maxChars?: number;
}

/** One flagged phrase and the layer it sits in. */
export interface CreationFeedbackPhrase {
  layerId: string;
  artboardId?: string;
  /** The words as drawn, cut at 120 characters; an invisible character reads as `[U+200B]`. */
  text: string;
  /** The text-signal kind that flagged it (`llm-lexicon`, `chatbot-boilerplate`, ...). */
  kind: string;
  label: string;
  heat: number;
}

/** One writing signal, compact. */
export interface CreationFeedbackSignal {
  kind: string;
  tier: TextSignalTier;
  label: string;
  detail?: string;
  heat: number;
  weight: number;
  /** The layers its spans fall in, in document order; empty for a whole-text signal. */
  layerIds: string[];
}

export interface CreationFeedbackWriting {
  /** `scored` when there was visible text, `no-text` otherwise (score 0, band none). */
  state: 'scored' | 'no-text';
  /** 0 to 100: a signal, not a probability. */
  score: number;
  band: TextSignalBand;
  /** The engine's own plain, non-accusatory sentence, verbatim. */
  summary: string;
  /** The tell lists that produced the score. */
  lexicon: number;
  textLayers: number;
  characters: number;
  /** True when later layers were left out at the text limit. */
  partial: boolean;
  signals: CreationFeedbackSignal[];
  /** The strongest flagged phrases, hottest first. */
  phrases: CreationFeedbackPhrase[];
}

export interface CreationFeedbackHouseRules {
  /** `checked` when rules ran; `no-rules` when the design system states none for Design; `no-design-system` without one. */
  state: 'checked' | 'no-rules' | 'no-design-system';
  /** How many rules were checked. */
  checked: number;
  findings: HouseRuleFinding[];
  /** Rule ids with no checker in this build: listed, never passed. */
  unknown: string[];
}

export interface CreationFeedbackReportV1 {
  format: typeof CREATION_FEEDBACK_FORMAT;
  version: typeof CREATION_FEEDBACK_VERSION;
  houseRules: CreationFeedbackHouseRules;
  writing: CreationFeedbackWriting;
  /** Text layers left out because they are hidden, and up to 20 of their ids. */
  hidden: { layers: number; layerIds: string[] };
  /** Plain English an agent can act on. */
  summary: string;
}

export interface CreationFeedbackOpts extends DesignVisibleTextOpts {
  /** The token theme the document is composed in, for alias colours. */
  theme?: string;
  /** Catalog facts (`DesignBriefCatalogV1`): the logo set a logo rule falls back to, and each asset's display name for a logo finding's message. */
  catalog?: unknown;
  /** Design's `background` input, which a document with no frames paints under every layer. */
  background?: unknown;
  /** Phrases to keep, 0 to 20. Default 5. */
  maxPhrases?: number;
}

type Row = Record<string, unknown>;
const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const truthy = (v: unknown): boolean => v === true || v === 'true' || v === 1 || v === '1';
const num = (v: unknown, fallback: number): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** Story source by its first frame id, as `forensic/design.ts` reads it; null when unreadable. */
function storiesOf(input: unknown): Map<string, string> | null {
  let doc: unknown = input;
  if (typeof input === 'string') {
    if (!input.trim()) return new Map();
    try { doc = JSON.parse(input); } catch { return null; }
  }
  if (doc === undefined || doc === null) return new Map();
  if (!record(doc) || !Array.isArray(doc.stories)) return null;
  const out = new Map<string, string>();
  for (const story of doc.stories) {
    if (!record(story) || typeof story.source !== 'string' || !Array.isArray(story.frameIds)) continue;
    const first = story.frameIds.find((id): id is string => typeof id === 'string');
    // U+FFFC holds an inline object (an emoji, an icon): it draws no word.
    if (first && !out.has(first)) out.set(first, story.source.replace(/\uFFFC/g, ''));
  }
  return out;
}

const selfHidden = (row: Row): boolean => truthy(row.hidden) || row.__offPage === true;

/**
 * Whether a row is drawn, as Design decides: its own `hidden` flag, and a hidden frame
 * takes its page with it and a hidden group its members.
 */
function hiddenTest(rows: readonly Row[]): (row: Row) => boolean {
  const byId = new Map<string, Row>();
  for (const row of rows) {
    const id = str(row.id);
    if (id && !byId.has(id)) byId.set(id, row);
  }
  return (row) => {
    if (selfHidden(row)) return true;
    const frame = byId.get(str(row.frame));
    if (frame && frame !== row && frame.kind === 'frame' && selfHidden(frame)) return true;
    let group = byId.get(str(row.group));
    for (let depth = 0; group && depth < 65; depth++) {
      if (group.kind === 'group' && selfHidden(group)) return true;
      group = byId.get(str(group.group));
    }
    return false;
  };
}

/**
 * The words a Design document draws, layer by layer in reading order, with the
 * hidden layers left out and counted.
 */
export function designVisibleText(boxes: unknown, opts: DesignVisibleTextOpts = {}): DesignVisibleText {
  const rows = (Array.isArray(boxes) ? boxes : []).slice(0, ROW_LIMIT).map((row, index) => ({ row, index })).filter((r): r is { row: Row; index: number } => record(r.row));
  const hidden = hiddenTest(rows.map((r) => r.row));
  const frames = rows
    .filter((r) => r.row.kind === 'frame' && str(r.row.id))
    .sort((a, b) => num(a.row.order, a.index) - num(b.row.order, b.index) || num(a.row.x, 0) - num(b.row.x, 0) || str(a.row.id).localeCompare(str(b.row.id)));
  const frameIds = new Set(frames.map((f) => str(f.row.id)));
  const reading = (a: { row: Row; index: number }, b: { row: Row; index: number }): number =>
    num(a.row.y, 0) - num(b.row.y, 0) || num(a.row.x, 0) - num(b.row.x, 0) || a.index - b.index;
  const groups: Array<{ artboardId?: string; members: Array<{ row: Row; index: number }> }> = frames.map((f) => ({
    artboardId: str(f.row.id),
    members: rows.filter((r) => r.row.kind !== 'frame' && str(r.row.frame) === str(f.row.id)).sort(reading),
  }));
  groups.push({ members: rows.filter((r) => r.row.kind !== 'frame' && !frameIds.has(str(r.row.frame))).sort(reading) });

  const stories = storiesOf(opts.textDocument);
  const limit = Math.max(0, Math.floor(num(opts.maxChars, CREATION_FEEDBACK_TEXT_LIMIT)));
  const segments: DesignTextSegment[] = [];
  const hiddenLayerIds: string[] = [];
  let hiddenCount = 0;
  let text = '';
  let truncated = false;
  for (const group of groups) {
    for (const { row } of group.members) {
      const id = str(row.id);
      if (!id || NOT_TEXT.has(str(row.kind))) continue;
      const words = str(row.textStory) ? (stories?.get(id) ?? '') : plainOfDesignText(str(row.text));
      if (!words.trim()) continue;
      if (hidden(row)) {
        hiddenCount++;
        if (hiddenLayerIds.length < HIDDEN_ID_LIMIT) hiddenLayerIds.push(id);
        continue;
      }
      if (truncated) continue;
      const lead = text ? JOIN : '';
      if (text.length + lead.length + words.length > limit) { truncated = true; continue; }
      text += lead;
      segments.push({ layerId: id, ...(group.artboardId ? { artboardId: group.artboardId } : {}), index: text.length, length: words.length });
      text += words;
    }
  }
  return { text, segments, hidden: hiddenCount, hiddenLayerIds, truncated };
}

/** The segment a code unit offset falls in, or undefined for the blank line between two. */
function segmentAt(segments: readonly DesignTextSegment[], index: number): DesignTextSegment | undefined {
  let lo = 0, hi = segments.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = segments[mid]!;
    if (index < s.index) hi = mid - 1;
    else if (index >= s.index + s.length) lo = mid + 1;
    else return s;
  }
  return undefined;
}

/** A phrase as an agent can find it again: invisible and format characters spelled out, length capped. */
function visiblePhrase(raw: string): string {
  const spelled = raw.replace(/\p{Cf}|\p{Cc}|\p{Variation_Selector}|[\u00A0\u2000-\u200A\u202F\u205F\u3000]/gu, (ch) => {
    if (ch === '\n' || ch === '\t') return ' ';
    return `[U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}]`;
  }).replace(/\s+/g, ' ').trim();
  return spelled.length > PHRASE_MAX ? `${spelled.slice(0, PHRASE_MAX - 1)}…` : spelled;
}

/** Strongest first, then the earliest span: a stable order whatever the analyser's own. */
const byStrength = (a: TextSignalFinding, b: TextSignalFinding): number =>
  b.heat - a.heat || b.weight - a.weight || (a.spans?.[0]?.index ?? Infinity) - (b.spans?.[0]?.index ?? Infinity) || a.kind.localeCompare(b.kind);

/** The writing score for the words a Design document draws. */
export function designWritingScore(boxes: unknown, opts: CreationFeedbackOpts = {}): CreationFeedbackWriting & { hidden: number; hiddenLayerIds: string[] } {
  const read = designVisibleText(boxes, opts);
  const base = { lexicon: LEXICON_VERSION, textLayers: read.segments.length, characters: read.text.length, partial: read.truncated, hidden: read.hidden, hiddenLayerIds: read.hiddenLayerIds };
  if (!read.text.trim()) {
    return { ...base, state: 'no-text', score: 0, band: 'none', summary: 'There is no visible text to score.', signals: [], phrases: [] };
  }
  const report = analyzeTextSignals(read.text, { source: 'digital' });
  const findings = [...report.findings].sort(byStrength);
  const signals: CreationFeedbackSignal[] = findings.slice(0, FINDING_LIMIT).map((f) => {
    const layerIds: string[] = [];
    for (const span of f.spans ?? []) {
      const id = segmentAt(read.segments, span.index)?.layerId;
      if (id && !layerIds.includes(id)) layerIds.push(id);
    }
    return { kind: f.kind, tier: f.tier, label: f.label, ...(f.detail ? { detail: f.detail } : {}), heat: f.heat, weight: Math.round(f.weight * 1000) / 1000, layerIds };
  });
  const maxPhrases = Math.max(0, Math.min(20, Math.floor(num(opts.maxPhrases, DEFAULT_PHRASES))));
  const phrases: CreationFeedbackPhrase[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    // A region note spans whole paragraphs; its layers are in `signals` already.
    if (f.kind === 'ai-span') continue;
    for (const span of f.spans ?? []) {
      if (phrases.length >= maxPhrases) break;
      const seg = segmentAt(read.segments, span.index);
      if (!seg) continue;
      const phrase = visiblePhrase(read.text.slice(span.index, Math.min(span.index + span.length, seg.index + seg.length)));
      const key = `${seg.layerId}\u0000${phrase.toLowerCase()}`;
      if (!phrase || seen.has(key)) continue;
      seen.add(key);
      phrases.push({ layerId: seg.layerId, ...(seg.artboardId ? { artboardId: seg.artboardId } : {}), text: phrase, kind: f.kind, label: f.label, heat: f.heat });
    }
  }
  return { ...base, state: 'scored', score: report.score, band: report.band, summary: report.summary, signals, phrases };
}

/** The house rules a Design document is checked against: every rule a layer can answer, plus unknown kinds to list. */
function rulesForDesign(rules: readonly BrandRuleV1[] | null | undefined): BrandRuleV1[] {
  const list: readonly BrandRuleV1[] = Array.isArray(rules) ? rules : [];
  return list.filter((r) => record(r) && !(BRAND_RULE_KINDS as readonly string[]).includes(String(r.kind)));
}

const quote = (s: string): string => `"${s}"`;
const layerList = (ids: readonly string[]): string => {
  const shown = ids.slice(0, 3).map(quote);
  const more = ids.length - shown.length;
  if (!more) return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown.join('');
  return `${shown.join(', ')} and ${more} more`;
};

function houseRuleSentence(h: CreationFeedbackHouseRules): string {
  if (h.state === 'no-design-system') return 'No design system was given, so no house rules were checked.';
  if (h.state === 'no-rules') return 'The design system states no house rules for Design, so none were checked.';
  const parts: string[] = [];
  if (!h.findings.length) parts.push(`Checked ${plural(h.checked, 'house rule')}: no findings.`);
  else {
    const layers = [...new Set(h.findings.map((f) => f.layerId))];
    const first = h.findings[0]!;
    parts.push(`Checked ${plural(h.checked, 'house rule')}: ${plural(h.findings.length, 'finding')} ${h.findings.length === 1 ? 'informs' : 'inform'} ${plural(layers.length, 'layer')}. The first, on layer ${quote(first.layerId)}: ${first.message}`);
  }
  if (h.unknown.length) parts.push(`${plural(h.unknown.length, 'rule')} could not be checked in this build: ${h.unknown.slice(0, 5).join(', ')}${h.unknown.length > 5 ? ` and ${h.unknown.length - 5} more` : ''}.`);
  return parts.join(' ');
}

function writingSentence(w: CreationFeedbackWriting): string {
  if (w.state === 'no-text') return w.summary;
  const parts = [`Writing signal (${w.band}): ${w.summary}`];
  if (w.partial) parts.push(`Only the first ${CREATION_FEEDBACK_TEXT_LIMIT} characters were scored.`);
  if (w.band !== 'none' && w.phrases.length) {
    const layers = [...new Set(w.phrases.map((p) => p.layerId))];
    const shown = w.phrases.slice(0, 3).map((p) => `${quote(p.text)} in layer ${quote(p.layerId)}`).join('; ');
    parts.push(`Strongest flagged phrases: ${shown}. To lower the score, revise the flagged phrases in ${layers.length === 1 ? 'layer' : 'layers'} ${layerList(layers)} where they do not read as intended.`);
  }
  return parts.join(' ');
}

/**
 * The creation feedback for one Design document: house-rule findings against
 * `rules` (the design system's own when `rules` is undefined) and the writing
 * score of the text it draws.
 */
export function creationFeedback(boxes: unknown, rules: readonly BrandRuleV1[] | null | undefined, doc: unknown, opts: CreationFeedbackOpts = {}): CreationFeedbackReportV1 {
  const writing = designWritingScore(boxes, opts);
  const { hidden, hiddenLayerIds, ...writingPart } = writing;
  const stated = rules === undefined ? (brandSystemOf(doc)?.rules ?? []) : rules;
  const designRules = rulesForDesign(stated);
  let houseRules: CreationFeedbackHouseRules;
  if (rules === undefined && !record(doc)) houseRules = { state: 'no-design-system', checked: 0, findings: [], unknown: [] };
  else if (!designRules.length) houseRules = { state: 'no-rules', checked: 0, findings: [], unknown: [] };
  else {
    // The checker leaves out what Design does not draw, hidden artboards and groups included.
    const result = checkDesignHouseRules(boxes, designRules, doc, {
      ...(opts.theme ? { theme: opts.theme } : {}),
      ...(opts.catalog !== undefined ? { catalog: opts.catalog } : {}),
      ...(opts.background !== undefined ? { background: opts.background } : {}),
    });
    houseRules = result.checked || result.findings.length || result.unknown.length
      ? { state: 'checked', checked: result.checked, findings: result.findings, unknown: result.unknown }
      : { state: 'no-rules', checked: 0, findings: [], unknown: [] };
  }
  const parts = [houseRuleSentence(houseRules), writingSentence(writingPart)];
  if (hidden) parts.push(`${plural(hidden, 'hidden layer')} with text ${hidden === 1 ? 'was' : 'were'} left out.`);
  parts.push('This feedback informs; it never blocks an export.');
  return {
    format: CREATION_FEEDBACK_FORMAT,
    version: CREATION_FEEDBACK_VERSION,
    houseRules,
    writing: writingPart,
    hidden: { layers: hidden, layerIds: hiddenLayerIds },
    summary: parts.join(' '),
  };
}

/** The compact answer after one edit: what changed on the layers it touched. */
export interface CreationFeedbackDeltaV1 {
  summary: string;
  writing: { score: number; band: TextSignalBand; previousScore?: number; previousBand?: TextSignalBand };
  /** House-rule findings on the touched layers that are new or say something new. */
  findings: HouseRuleFinding[];
  /** Earlier findings on the touched layers that no longer apply. */
  resolved: number;
  /** Flagged phrases that sit in the touched layers. */
  phrases: CreationFeedbackPhrase[];
}

const findingKey = (f: HouseRuleFinding): string => `${f.ruleId}\u0000${f.layerId}\u0000${f.field ?? ''}`;

/**
 * Compare two reports over the layers one edit touched (`touched`, the changed and
 * removed layer ids). `before` may be null when nothing was read before the edit.
 */
export function creationFeedbackDelta(before: CreationFeedbackReportV1 | null, after: CreationFeedbackReportV1, touched: readonly string[]): CreationFeedbackDeltaV1 {
  const ids = new Set(touched);
  const was = new Map((before?.houseRules.findings ?? []).filter((f) => ids.has(f.layerId)).map((f) => [findingKey(f), f.message]));
  const now = after.houseRules.findings.filter((f) => ids.has(f.layerId));
  const findings = now.filter((f) => was.get(findingKey(f)) !== f.message);
  const nowKeys = new Set(now.map(findingKey));
  const resolved = [...was.keys()].filter((k) => !nowKeys.has(k)).length;
  const phrases = after.writing.phrases.filter((p) => ids.has(p.layerId));
  const w = after.writing;
  const prev = before?.writing;
  const writing = {
    score: w.score,
    band: w.band,
    ...(prev ? { previousScore: prev.score, previousBand: prev.band } : {}),
  };

  const parts: string[] = [];
  if (w.state === 'no-text') parts.push('There is no visible text to score.');
  else {
    const change = !prev || prev.state === 'no-text' ? '' : prev.score === w.score ? ', unchanged' : `, was ${prev.score}`;
    parts.push(`Writing signal: ${w.band}, ${w.score}/100${change}. ${w.summary}`);
  }
  if (after.houseRules.state !== 'checked') parts.push(houseRuleSentence(after.houseRules));
  else if (findings.length) {
    const first = findings[0]!;
    parts.push(`${plural(findings.length, 'new house-rule finding', 'new house-rule findings')} on the layers this change touched. The first, on layer ${quote(first.layerId)}: ${first.message}`);
  } else parts.push('No new house-rule findings on the layers this change touched.');
  if (resolved) parts.push(`${plural(resolved, 'earlier finding')} on those layers no longer ${resolved === 1 ? 'applies' : 'apply'}.`);
  if (phrases.length && w.band !== 'none') {
    parts.push(`Flagged phrases in the touched layers: ${phrases.slice(0, 3).map((p) => `${quote(p.text)} in layer ${quote(p.layerId)}`).join('; ')}.`);
  }
  parts.push('Guidance to act on, not a gate.');
  return { summary: parts.join(' '), writing, findings, resolved, phrases };
}
