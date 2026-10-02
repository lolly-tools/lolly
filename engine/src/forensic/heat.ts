// SPDX-License-Identifier: MPL-2.0
/**
 * A per-sentence view of a forensic report, for drawing heat over the text and
 * the page. Derived from the report on demand and never stored in it, so the
 * report's contract and digest do not change: the same findings always give
 * the same heat.
 *
 * Heat is a reading aid, not a score. It shows where the located findings sit
 * and how much weight each kind of finding deserves (its guidance level), so a
 * reader can open any sentence and see exactly which observations touch that sentence.
 * Classifier chunk scores are carried beside the heat, never mixed into it,
 * because a raw model score and a located pattern are different kinds of
 * evidence.
 */
import type {
  ForensicBox,
  ForensicFinding,
  ForensicModelChunk,
  ForensicReport,
} from './types.ts';

/** How much weight a signal deserves when reading it, strongest first. */
export type ForensicGuidance = 'artifact' | 'clue' | 'context';

/** Heat multiplier per guidance level: an artifact reads at full strength, a
 *  style clue at a little over half, and an excluded match adds nothing. */
export const FORENSIC_GUIDANCE_WEIGHT: Record<ForensicGuidance, number> = {
  artifact: 1,
  clue: 0.6,
  context: 0,
};

/** Sentence chunks for the classifier: at least this many words each, which
 *  keeps every chunk above the detector's own 50-word eligibility floor. */
export const FORENSIC_CHUNK_MIN_WORDS = 55;
export const FORENSIC_CHUNK_CAP = 64;
export const FORENSIC_CHUNK_VERSION = 'chunk-policy/1;sentences>=55w';

export interface ForensicSegment {
  index: number;
  length: number;
  /** A line with no sentence punctuation (a heading, a label, a list item). */
  kind: 'sentence' | 'line';
}

export interface ForensicHeatSignal {
  finding: string;
  family: string;
  label: string;
  guidance: ForensicGuidance;
  /** Pattern confidence times the guidance weight, 0-1. */
  strength: number;
  /** The finding's matched spans inside this segment. */
  spans: { index: number; length: number }[];
}

export interface ForensicHeatSegment extends ForensicSegment {
  /** 1 - product of (1 - strength) over the distinct findings here, 0-1. */
  heat: number;
  signals: ForensicHeatSignal[];
  /** Raw classifier score of the chunk holding this segment, when one was scored. */
  model?: number;
}

export interface ForensicRegionHeat {
  box: ForensicBox;
  heat: number;
  signals: Omit<ForensicHeatSignal, 'spans'>[];
}

export interface ForensicPageHeat {
  page: string;
  segments: ForensicHeatSegment[];
  /** Findings on this page that point at the whole text rather than a span. */
  document: Omit<ForensicHeatSignal, 'spans'>[];
  regions: ForensicRegionHeat[];
  /** Classifier chunk layer, when the page was scored in chunks. Scores under
   *  `floor` are not drawn; `threshold` marks a chunk as over. */
  model?: { model: string; threshold: number; floor: number; chunks: ForensicModelChunk[] };
  max: number;
}

// Abbreviations that end in a full stop without ending the sentence.
const ABBREVIATIONS = new Set(
  'e.g i.e etc vs mr mrs ms dr prof sr jr st no fig approx inc ltd co corp dept est u.s u.k a.m p.m'.split(
    ' '
  )
);

/**
 * Split text into sentences and sentence-less lines, with exact offsets.
 * Leading and trailing whitespace stays outside every segment, so a pasted
 * line's indentation is never highlighted.
 */
export function forensicSegments(text: string): ForensicSegment[] {
  const out: ForensicSegment[] = [];
  const bounded = text.slice(0, 65_536);
  for (const line of bounded.matchAll(/[^\n]+/g)) {
    const raw = line[0];
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (!body) continue;
    const base = line.index! + lead;
    let start = 0;
    const ends = /[.!?…]+["'”’)\]]*(?=\s+\S|$)/g;
    let found = false;
    for (const end of body.matchAll(ends)) {
      const stop = end.index! + end[0].length;
      const before = body.slice(start, end.index!).match(/(\S+)$/)?.[1]?.toLowerCase() ?? '';
      const next = body.slice(stop).trimStart()[0] ?? '';
      // A full stop after an abbreviation, an initial or a number, or one
      // followed by a lower-case word, does not end a sentence.
      if (
        end[0] === '.' &&
        stop < body.length &&
        (ABBREVIATIONS.has(before.replace(/^[("'“‘]+/, '')) ||
          /^[a-z]$/i.test(before) ||
          /\d$/.test(before) ||
          /[a-z]/.test(next))
      )
        continue;
      out.push({ index: base + start, length: stop - start, kind: 'sentence' });
      found = true;
      start = stop + (body.slice(stop).length - body.slice(stop).trimStart().length);
      if (out.length >= 4000) return out;
    }
    if (start < body.length)
      out.push({
        index: base + start,
        length: body.length - start,
        kind: found || /[.!?…]["'”’)\]]*$/.test(body) ? 'sentence' : 'line',
      });
    if (out.length >= 4000) return out;
  }
  return out;
}

const words = (s: string): number => (s.match(/\S+/g) ?? []).length;

/**
 * Sentence-aligned chunks for per-chunk classifier scoring: consecutive
 * segments gathered until each chunk reaches the word floor. A short tail is
 * folded into the chunk before it so it never goes unscored.
 */
export function forensicChunkSpans(
  text: string,
  minWords = FORENSIC_CHUNK_MIN_WORDS,
  cap = FORENSIC_CHUNK_CAP
): { index: number; length: number }[] {
  const chunks: { index: number; length: number; words: number }[] = [];
  let open: { index: number; end: number; words: number } | null = null;
  for (const s of forensicSegments(text)) {
    const w = words(text.slice(s.index, s.index + s.length));
    if (!open) open = { index: s.index, end: s.index + s.length, words: w };
    else {
      open.end = s.index + s.length;
      open.words += w;
    }
    if (open.words >= minWords) {
      chunks.push({ index: open.index, length: open.end - open.index, words: open.words });
      open = null;
    }
  }
  if (open) {
    const last = chunks.at(-1);
    if (last) {
      last.length = open.end - last.index;
      last.words += open.words;
    } else if (open.words >= 50)
      chunks.push({ index: open.index, length: open.end - open.index, words: open.words });
  }
  const spans = chunks.map(({ index, length }) => ({ index, length }));
  if (spans.length <= cap) return spans;
  return Array.from(
    { length: cap },
    (_, i) => spans[Math.round((i * (spans.length - 1)) / (cap - 1))]!
  );
}

/** Score each sentence chunk with the caller's classifier. */
export async function forensicChunkScores(
  text: string,
  score: (chunk: string) => Promise<number | null>,
  cancelled: () => boolean = () => false
): Promise<ForensicModelChunk[]> {
  const out: ForensicModelChunk[] = [];
  for (const span of forensicChunkSpans(text)) {
    if (cancelled()) break;
    const raw = await score(text.slice(span.index, span.index + span.length));
    if (typeof raw === 'number' && Number.isFinite(raw))
      out.push({ ...span, rawScore: Math.min(1, Math.max(0, raw)) });
  }
  return out;
}

export function forensicGuidance(f: ForensicFinding): ForensicGuidance {
  return f.contribution === 'specific-artifact'
    ? 'artifact'
    : f.contribution === 'context-excluded'
      ? 'context'
      : 'clue';
}

const overlaps = (a: { index: number; length: number }, b: { index: number; length: number }) =>
  a.index < b.index + b.length && b.index < a.index + a.length;

const combine = (strengths: number[]): number =>
  1 - strengths.reduce((product, s) => product * (1 - Math.min(1, Math.max(0, s))), 1);

/**
 * The heat view of one page. The aggregate classifier finding is listed as a
 * whole-document signal rather than spread over the text, because its windows
 * are hundreds of words long and would warm every sentence equally.
 */
export function forensicHeat(report: ForensicReport, pageId: string): ForensicPageHeat {
  const page = report.pages.find((p) => p.id === pageId);
  const segments: ForensicHeatSegment[] = page
    ? forensicSegments(page.text).map((s) => ({ ...s, heat: 0, signals: [] }))
    : [];
  const wholePage: ForensicPageHeat['document'] = [];
  const regions = new Map<string, ForensicRegionHeat>();
  for (const f of report.findings) {
    const guidance = forensicGuidance(f);
    const strength = Math.min(1, Math.max(0, f.confidence)) * FORENSIC_GUIDANCE_WEIGHT[guidance];
    const signal = { finding: f.id, family: f.family, label: f.label, guidance, strength };
    const here = f.locations.filter((l) => l.page === pageId);
    if (!here.length) continue;
    if (f.family === 'local-classifier') {
      wholePage.push(signal);
      continue;
    }
    const spans = here.flatMap((l) => (l.span ? [l.span] : []));
    if (!spans.length && !here.some((l) => l.box)) wholePage.push(signal);
    for (const span of spans)
      for (const segment of segments) {
        if (segment.index >= span.index + span.length) break;
        if (!overlaps(segment, span)) continue;
        const prior = segment.signals.find((s) => s.finding === f.id);
        const clipped = {
          index: Math.max(span.index, segment.index),
          length:
            Math.min(span.index + span.length, segment.index + segment.length) -
            Math.max(span.index, segment.index),
        };
        if (prior) prior.spans.push(clipped);
        else segment.signals.push({ ...signal, spans: [clipped] });
      }
    for (const l of here) {
      if (!l.box) continue;
      const key = [l.box.x, l.box.y, l.box.width, l.box.height].map((n) => n.toFixed(2)).join(',');
      const region = regions.get(key) ?? { box: l.box, heat: 0, signals: [] };
      if (!region.signals.some((s) => s.finding === f.id)) region.signals.push(signal);
      regions.set(key, region);
    }
  }
  const observation = report.models.find((m) => m.page === pageId && m.chunks?.length);
  for (const segment of segments) {
    segment.heat = combine(segment.signals.map((s) => s.strength));
    segment.signals.sort((a, b) => b.strength - a.strength || a.finding.localeCompare(b.finding));
    if (observation?.chunks) {
      const middle = segment.index + segment.length / 2;
      const chunk = observation.chunks.find(
        (c) => middle >= c.index && middle < c.index + c.length
      );
      if (chunk) segment.model = chunk.rawScore;
    }
  }
  const regionList = [...regions.values()].map((r) => ({
    ...r,
    heat: combine(r.signals.map((s) => s.strength)),
  }));
  return {
    page: pageId,
    segments,
    document: wholePage,
    regions: regionList,
    ...(observation?.chunks
      ? {
          model: {
            model: observation.model,
            threshold: observation.chunkThreshold ?? 1,
            floor: Math.min(observation.chunkFloor ?? 0.5, observation.chunkThreshold ?? 1),
            chunks: observation.chunks,
          },
        }
      : {}),
    max: Math.max(0, ...segments.map((s) => s.heat), ...regionList.map((r) => r.heat)),
  };
}
