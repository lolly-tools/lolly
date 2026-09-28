// SPDX-License-Identifier: MPL-2.0
/** Bounded paragraph optimisation over admitted source boundaries. */
import type { TextParagraphStyleV1 } from '@lolly-tools/core';
export interface TextBreakCandidate { at: number; hyphen: boolean; hyphenWidth: number }
export interface TextLineGraph {
  candidates: TextBreakCandidate[];
  width(line: number): number;
  measure(start: number, end: number): number;
  /** Total natural advance of stretchable spaces, excluding line-end whitespace. */
  spaces?(start: number, end: number): number;
  words(start: number, end: number): number;
  settings: TextParagraphStyleV1;
  forbidden?: ReadonlySet<string>;
}
interface Node { end: number; hyphens: number; cost: number; previous?: Node }
export const TEXT_LINE_GRAPH_BUDGET = 40000;
export function paragraphLineFit(graph: Pick<TextLineGraph, 'settings' | 'measure' | 'spaces' | 'candidates'>, start: number, end: number, room: number) {
  const natural = graph.measure(start, end), last = end === graph.candidates.length - 1;
  const align = last ? graph.settings.lastAlign ?? (graph.settings.align === 'justify' ? 'start' : graph.settings.align) : graph.settings.align;
  const spacing = graph.settings.wordSpacing ?? { min: .8, ideal: 1, max: 1.5 };
  const spaces = graph.spaces?.(start, end) ?? 0, ideal = spacing.ideal || 1;
  const shrink = align === 'justify' ? spaces * (1 - spacing.min / ideal) : 0;
  const stretch = align === 'justify' ? spaces * (spacing.max / ideal - 1) : 0;
  const residual = room - natural, allowance = residual < 0 ? shrink : stretch;
  // A justified line with no stretchable space cannot reach the measure: a lone word
  // is left with the rest of the line empty. It stays a possible line, because a long
  // word may have nowhere else to go, but it is priced as far worse than any line that
  // only needs its spaces widened. At a flat 10 it cost about as much as a moderately
  // loose line, so Best paragraph would set "Jefferson" alone on an indented first
  // line to save a little looseness further down.
  return { fits: natural - shrink <= room + .001, cost: align === 'justify'
    ? allowance > .0001 ? Math.abs(residual / allowance) ** 3 : Math.abs(residual) < .001 ? 0 : 1000
    : (residual / Math.max(1, room)) ** 2 };
}
export function chooseParagraphBreaks(graph: TextLineGraph, greedy: number[]): { ends: number[]; limited: boolean } {
  const { candidates, settings, width, measure, words } = graph;
  const mode = settings.composition ?? 'standard', short = settings.shortLastLine;
  if (mode === 'standard' && !short?.enabled || greedy.length < 2) return { ends: greedy, limited: false };
  if (candidates.length > 2048 || greedy.length > 128) return { ends: greedy, limited: true };
  const targetLines = mode === 'balanced' ? greedy.length : null;
  const final = candidates.length - 1, total = measure(0, final), target = total / greedy.length;
  // Keyed by end and consecutive hyphens as one number (hyphens stay far below the
  // multiplier), so pricing a candidate allocates no string.
  let frontier = new Map<number, Node>([[0, { end: 0, hyphens: 0, cost: 0 }]]), winner: Node | undefined, work = 0;
  const maximum = targetLines ?? Math.min(final, greedy.length + 8);
  // Justified spaces shrink to at most min/ideal of their width, so a line can never
  // be narrower than that share of its text. Once a line's text alone is wider than
  // the room at that share, no later end can fit either: text only grows with the
  // end, so the scan stops instead of measuring every remaining candidate.
  const spacing = settings.wordSpacing ?? { min: .8, ideal: 1, max: 1.5 };
  const floor = settings.align === 'justify' ? Math.min(1, spacing.min / (spacing.ideal || 1)) : 1;
  for (let line = 0; line < maximum && frontier.size; line++) {
    const next = new Map<number, Node>(), room = Math.max(1, width(line));
    for (const previous of frontier.values()) {
      for (let end = previous.end + 1; end <= final; end++) {
        if (++work > TEXT_LINE_GRAPH_BUDGET) return { ends: greedy, limited: true };
        const candidate = candidates[end]!, natural = measure(previous.end, end), hyphens = candidate.hyphen ? previous.hyphens + 1 : 0;
        const fit = paragraphLineFit(graph, previous.end, end, room);
        if (!fit.fits) {
          if (floor > 0 && (natural - candidate.hyphenWidth) * floor > room + .001) break;
          continue;
        }
        if (graph.forbidden?.size && graph.forbidden.has(`${previous.end}:${end}`)) continue;
        if (candidate.hyphen && hyphens > (settings.hyphenation?.consecutive ?? 2)) continue;
        if (targetLines && (end === final) !== (line === targetLines - 1)) continue;
        const last = end === final;
        let cost = mode === 'balanced' ? ((natural - target) / room) ** 2 : last && settings.lastAlign !== 'justify' ? 0 : fit.cost;
        if (mode === 'standard' && greedy[line] !== end) cost += .05;
        if (candidate.hyphen) cost += .035 + previous.hyphens * .06;
        if (last && line > 0 && short?.enabled) {
          const intentional = line === 1 && words(0, final) <= 2;
          if (!intentional && (words(previous.end, end) < short.words || natural < room * short.fraction)) cost += 4;
        }
        cost += previous.cost + .002;
        const node: Node = { end, hyphens, cost, previous };
        if (last) { if (!winner || cost < winner.cost - 1e-9) winner = node; continue; }
        const key = end * 65536 + hyphens, held = next.get(key);
        if (!held || cost < held.cost - 1e-9) next.set(key, node);
      }
    }
    frontier = next;
  }
  if (!winner) return { ends: greedy, limited: false };
  const ends: number[] = [];
  for (let node: Node | undefined = winner; node?.previous; node = node.previous) ends.push(node.end);
  return { ends: ends.reverse(), limited: false };
}
