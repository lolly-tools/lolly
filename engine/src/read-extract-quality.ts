// SPDX-License-Identifier: MPL-2.0
/**
 * read-extract-quality.ts - how close an extract is to a hand-labelled reading of
 * the same file (plan 203, rank 10). Text recognition and reading order are
 * measured, not assumed: "some text came back" is not a pass.
 *
 * `scoreExtract(labels, extract)` compares the labelled blocks of each page with
 * the extract's text blocks on that page and reports:
 *   - `cer`, the character error rate over each page's text joined in reading
 *     order: edits (insertions, deletions, substitutions of code points) divided
 *     by the labelled characters. Order mistakes cost characters here too, so a
 *     page read out of order scores worse than one read in order;
 *   - `wer`, the same over words;
 *   - `recall`, the share of labelled blocks the extract holds, each matched to
 *     its closest unmatched extracted block on the page when their error rate is
 *     at most `MATCH_CER`;
 *   - `order`, the share of pairs of matched blocks on one page that come in the
 *     labelled order (1 when no page has two matched blocks);
 *   - `origin`, the share of matched blocks whose origin (authored, text layer or
 *     recognised) is the labelled one, over the labels that state an origin.
 *
 * Text is compared after Unicode NFC and with runs of white space folded to one
 * space. Case and punctuation count: a recogniser that drops accents is wrong.
 *
 * Pure and deterministic.
 */

import type { ExtractOriginV1, ReadExtractV1 } from '@lolly-tools/core';

/** One labelled block: what a correct reading of the page returns, in reading order. */
export interface LabelledBlockV1 {
  page: number;
  text: string;
  origin?: ExtractOriginV1;
}

export interface ExtractScoreV1 {
  cer: number;
  wer: number;
  recall: number;
  order: number;
  /** Null when no matched label states an origin. */
  origin: number | null;
  labelled: number;
  matched: number;
}

/** A labelled block and an extracted one match when their character error rate is at most this. */
export const MATCH_CER = 0.34;

/** NFC, white space folded to single spaces and trimmed. */
export function normaliseForScore(text: string): string {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Levenshtein distance between two sequences, in two rows of memory. */
export function editDistance<T>(a: readonly T[], b: readonly T[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let row = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, row] = [row, prev];
  }
  return prev[b.length]!;
}

const charsOf = (text: string): string[] => Array.from(normaliseForScore(text));
const wordsOf = (text: string): string[] => normaliseForScore(text).split(' ').filter(Boolean);

/** Edits per labelled character, by code point. 0 for two empty strings, 1 for any reading of nothing. */
export function characterErrorRate(truth: string, read: string): number {
  const t = charsOf(truth);
  const r = charsOf(read);
  if (t.length === 0) return r.length === 0 ? 0 : 1;
  return editDistance(t, r) / t.length;
}

/** Edits per labelled word. */
export function wordErrorRate(truth: string, read: string): number {
  const t = wordsOf(truth);
  const r = wordsOf(read);
  if (t.length === 0) return r.length === 0 ? 0 : 1;
  return editDistance(t, r) / t.length;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Score an extract against labelled blocks. Pages the labels name are the pages scored. */
export function scoreExtract(labels: readonly LabelledBlockV1[], extract: ReadExtractV1): ExtractScoreV1 {
  const pages = [...new Set(labels.map((l) => l.page))].sort((a, b) => a - b);
  let charEdits = 0;
  let charTotal = 0;
  let wordEdits = 0;
  let wordTotal = 0;
  let matched = 0;
  let pairs = 0;
  let pairsInOrder = 0;
  let originStated = 0;
  let originAgreed = 0;

  for (const page of pages) {
    const truth = labels.filter((l) => l.page === page);
    const read = extract.blocks.filter((b) => b.page === page && b.kind === 'text');
    const truthText = truth.map((l) => l.text).join('\n');
    const readText = read.map((b) => b.text).join('\n');
    const tc = charsOf(truthText);
    const tw = wordsOf(truthText);
    charEdits += editDistance(tc, charsOf(readText));
    charTotal += tc.length;
    wordEdits += editDistance(tw, wordsOf(readText));
    wordTotal += tw.length;

    const used = new Set<number>();
    const positions: number[] = [];
    for (const label of truth) {
      let best = -1;
      let bestRate = Number.POSITIVE_INFINITY;
      for (const [k, block] of read.entries()) {
        if (used.has(k)) continue;
        const rate = characterErrorRate(label.text, block.text);
        if (rate < bestRate) {
          best = k;
          bestRate = rate;
        }
      }
      if (best < 0 || bestRate > MATCH_CER) continue;
      used.add(best);
      matched++;
      positions.push(read[best]!.order);
      if (label.origin) {
        originStated++;
        if (read[best]!.origin === label.origin) originAgreed++;
      }
    }
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        pairs++;
        if (positions[i]! < positions[j]!) pairsInOrder++;
      }
    }
  }

  return {
    cer: round4(charTotal === 0 ? 0 : charEdits / charTotal),
    wer: round4(wordTotal === 0 ? 0 : wordEdits / wordTotal),
    recall: round4(labels.length === 0 ? 1 : matched / labels.length),
    order: round4(pairs === 0 ? 1 : pairsInOrder / pairs),
    origin: originStated === 0 ? null : round4(originAgreed / originStated),
    labelled: labels.length,
    matched,
  };
}
