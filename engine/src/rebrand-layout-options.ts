// SPDX-License-Identifier: MPL-2.0
/** Bounded layout recommendations, checked against a real single-slide compile. */
import type { CompiledDeckV1, CompiledFrameV1, DeckCensusV1, RenovationPlanV1, SlideMasterV1, SlidePlanV1, SlideSourceV1, SourceDeckV1 } from '@lolly-tools/core';
import { compileRenovated, compileSystemOpts } from './deck-compile.ts';
import { scoreArchetypes } from './rebrand-archetype.ts';
import type { RebrandDesignSystemV1 } from './rebrand-design-system.ts';
import { findStructure } from './slide-structures.ts';
import { plainOfDesignText } from './design-text.ts';
import { compareCodeUnits } from './rebrand-order.ts';
import { slideLayoutChoices, withSlideLayoutComponents } from './slide-layout-components.ts';

export const LAYOUT_OPTIONS_VERSION = 'layout-options-2';
export const LAYOUT_OPTION_LIMIT = 16;

export interface LayoutOptionDescription {
  id: string;
  name: string;
  description: string;
}

/** Only layouts actually supplied by this design system can be selected. */
export function layoutOptionCatalog(master: SlideMasterV1, allowed?: readonly string[]): LayoutOptionDescription[] {
  return master.archetypes.filter(a => !a.variantOf && (!allowed?.length || allowed.includes(a.id))).slice(0, 96).map(a => {
    const structure = findStructure(a.structure ?? a.id);
    const roles = new Map<string, number>();
    for (const p of a.placeholders) roles.set(p.role, (roles.get(p.role) ?? 0) + 1);
    const slots = [...roles].map(([role, n]) => `${n} ${role}`).join(', ');
    return { id: a.id, name: a.name, description: `${a.name}. ${structure?.keywords.join(', ') ?? ''}. ${slots}.`.slice(0, 600) };
  });
}

/** A short, corrected reading; never include another slide or removed content. */
export function layoutOptionQuery(source: SourceDeckV1, plan: RenovationPlanV1, intent = ''): string {
  const slide = source.slides[0];
  const rows = new Map(plan.slides[0]?.objects.map(row => [row.id, row]) ?? []);
  const text = (slide?.objects ?? []).filter(object => {
    const row = rows.get(object.id);
    return row && (row.decision ?? row.proposal) === 'keep';
  }).map(object => {
    const row = rows.get(object.id)!;
    return (row.textOverride ?? object.text?.paras.map(p => p.runs.map(r => r.text).join('')).join(' ') ?? '').slice(0, 180);
  }).filter(Boolean);
  // Put the request first: the model truncates to its own context window.
  return [intent.slice(0, 400), ...text].join('. ').slice(0, 1600);
}

export type LayoutOptionIssue = 'compile-failed' | 'unread-picture' | 'missing-content' | 'tray' | 'unresolved' | 'overflow' | 'unreadable' | 'omitted-vector' | 'empty' | 'placeholders';
export interface LayoutOptionAudit {
  issues: LayoutOptionIssue[];
  frameCount: number;
  keptObjects: number;
}
export interface LayoutOption extends LayoutOptionDescription, LayoutOptionAudit {
  frames: CompiledFrameV1[];
}
export interface LayoutOptionsResult {
  options: LayoutOption[];
  checked: number;
  rejected: Array<{ id: string; issues: LayoutOptionIssue[] }>;
  modelUsed: boolean;
}

/** Lineage must reach visible layers, not just a report entry or the unused tray. */
export function auditLayoutOption(deck: CompiledDeckV1, slide: SlidePlanV1, source?: SlideSourceV1): LayoutOptionAudit {
  const issues = new Set<LayoutOptionIssue>();
  const frames = deck.frames.filter(f => f.sourceSlideId === slide.id);
  if (!frames.length) issues.add('empty');
  const layers = new Map(frames.flatMap(f => f.layers.map(l => [String(l.id), l] as const)));
  const forward = new Map(deck.lineage.forward.map(row => [row.sourceObjectId, row.layerIds]));
  const kept = slide.objects.filter(row => (row.decision ?? row.proposal) !== 'remove');
  if (kept.some(row => !forward.get(row.id)?.length || forward.get(row.id)!.some(id => !layers.has(id)))) issues.add('missing-content');
  const words = (value: string): string[] => value.normalize('NFKC').match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const row of kept) {
    if ((row.decision ?? row.proposal) !== 'keep') continue;
    const object = source?.objects.find(o => o.id === row.id);
    if (object?.kind !== 'text' && object?.kind !== 'table') continue;
    const expected = words(object.kind === 'table' ? object.table?.flat().join(' ') ?? ''
      : row.textOverride ?? object.text?.paras.map(p => p.runs.map(r => r.text).join('')).join('\n') ?? '');
    const actual = words((forward.get(row.id) ?? []).map(id => plainOfDesignText(String(layers.get(id)?.text ?? ''))).join('\n'));
    // Merged slots can contain other objects too; every occurrence of this
    // object's words still has to survive, including repeated numbers.
    const counts = new Map<string, number>();
    for (const word of actual) counts.set(word, (counts.get(word) ?? 0) + 1);
    for (const word of expected) {
      const n = counts.get(word) ?? 0;
      if (!n) { issues.add('missing-content'); break; }
      counts.set(word, n - 1);
    }
  }
  if (deck.tray.length) issues.add('tray');
  if (frames.some(f => f.placeholderLayerIds.length)) issues.add('placeholders');
  for (const entry of deck.report.entries) {
    if (entry.slideId && entry.slideId !== slide.id) continue;
    if (entry.disposition === 'unresolved' || entry.code === 'object.unresolved') issues.add('unresolved');
    if (entry.code === 'text.overflow') issues.add('overflow');
    if (entry.code === 'layout.below-readable-size' || entry.code === 'layout.overlap-with-furniture') issues.add('unreadable');
    if (entry.code === 'vector.items-omitted' || entry.code === 'source.media-skipped' || entry.code === 'source.cap-reached') issues.add('omitted-vector');
  }
  return { issues: [...issues], frameCount: frames.length, keptObjects: kept.length };
}

export interface LayoutOptionsInput {
  source: SourceDeckV1;
  plan: RenovationPlanV1;
  census?: DeckCensusV1;
  system: RebrandDesignSystemV1;
  allowed?: readonly string[];
  /** Cosines from a local embedder, keyed by catalog id. No generated geometry. */
  semantic?: Record<string, number>;
  intent?: string;
  adaptive?: boolean;
}

/** Content-sized choices share the same compiler and audit as authored layouts. */
function choicesFor(input: LayoutOptionsInput): LayoutOptionDescription[] {
  const ids = input.adaptive === false ? [] : slideLayoutChoices(input.source.slides[0]!, input.plan.slides[0]!);
  const generated = withSlideLayoutComponents(input.system.input.master, ids);
  const catalog = layoutOptionCatalog(input.system.input.master, input.allowed);
  return [...layoutOptionCatalog(generated, ids).filter(c => ids.includes(c.id)), ...catalog];
}

/** Single-slide inputs are mandatory, including on worker and CLI paths. */
export function layoutOptionOrder(input: LayoutOptionsInput): LayoutOptionDescription[] {
  const { source, plan, system } = input;
  if (source.slides.length !== 1 || plan.slides.length !== 1 || source.slides[0]?.id !== plan.slides[0]?.id) {
    throw new Error('Layout recommendations require one matching source slide and plan row.');
  }
  const row = plan.slides[0]!;
  const catalog = choicesFor(input);
  const features = input.census?.layouts.find(f => f.slideId === row.id);
  const rules = features ? scoreArchetypes(features, system.input.master, { structure: row.layoutMatch?.structure, coverSlide: source.slides[0]!.index === 0 }) : [];
  const ruleRank = new Map(rules.map((r, i) => [r.id, i]));
  const score = (id: string): number => Number.isFinite(input.semantic?.[id]) ? Math.max(-1, Math.min(1, input.semantic![id]!)) : -1;
  const ranked = [...catalog].sort((a, b) => input.semantic
    ? score(b.id) - score(a.id) || compareCodeUnits(a.id, b.id)
    : (ruleRank.get(a.id) ?? 999) - (ruleRank.get(b.id) ?? 999) || compareCodeUnits(a.id, b.id));
  const structural = row.layoutMatch?.structure;
  const match = structural ? catalog.find(c => system.input.master.archetypes.find(a => a.id === c.id)?.structure === structural || c.id === structural)?.id : undefined;
  // Reserve the current and structural choices, then let semantic matching bring
  // library layouts into the bounded compile even when legacy rules lack them.
  const adaptive = catalog.filter(c => c.id.startsWith('flow-')).map(c => c.id);
  const ids = [...new Set([...adaptive, row.layout, match, row.layoutAlternative, ...ranked.slice(0, 10).map(c => c.id), ...rules.slice(0, 5).map(c => c.id)])];
  return ids.flatMap(id => { const c = catalog.find(c => c.id === id); return c ? [c] : []; }).slice(0, LAYOUT_OPTION_LIMIT);
}

export function compileLayoutOption(input: LayoutOptionsInput, id: string): LayoutOption {
  layoutOptionOrder(input);
  const description = choicesFor(input).find(c => c.id === id);
  if (!description) throw new Error('The design system does not offer this layout.');
  const row: SlidePlanV1 = { ...input.plan.slides[0]!, include: true, layout: id, layoutSource: 'user' };
  delete row.arrangement;
  const deck = compileRenovated({
    source: input.source, census: input.census, plan: { ...input.plan, slides: [row] },
    master: input.system.input.master, designSystem: input.system.compile,
    opts: { ...compileSystemOpts(input.system.input), applyUnreviewed: true, applyNeedsAttention: true },
  });
  return { ...description, ...auditLayoutOption(deck, row, input.source.slides[0]), frames: deck.frames };
}

/** The caller yields or runs in a worker between candidates and owns cancellation. */
export async function recommendLayoutOptions(input: LayoutOptionsInput, checkpoint: (done: number, total: number) => void | Promise<void> = () => {}): Promise<LayoutOptionsResult> {
  const candidates = layoutOptionOrder(input);
  const result: LayoutOptionsResult = { options: [], checked: 0, rejected: [], modelUsed: Boolean(input.semantic) };
  const slide = input.source.slides[0]!;
  if (slide.origin.flattened && !slide.recovery) {
    result.rejected.push({ id: '', issues: ['unread-picture'] });
    return result;
  }
  const row = input.plan.slides[0]!;
  const match = row.layoutMatch;
  const structureOf = (id: string): string => input.system.input.master.archetypes.find(a => a.id === id)?.structure ?? id;
  const structural = (id: string): number => !input.intent?.trim() && match?.band === 'clear' && structureOf(id) === match.structure ? 1 : 0;
  const score = (id: string): number => Number.isFinite(input.semantic?.[id]) ? input.semantic![id]! : -1;
  const compare = (a: LayoutOption, b: LayoutOption): number => a.frameCount - b.frameCount || Number(b.id.startsWith('flow-')) - Number(a.id.startsWith('flow-')) || structural(b.id) - structural(a.id)
    || (input.semantic ? score(b.id) - score(a.id) : 0)
    || candidates.findIndex(c => c.id === a.id) - candidates.findIndex(c => c.id === b.id);
  for (const candidate of candidates) {
    await checkpoint(result.checked, candidates.length);
    let option: LayoutOption;
    try { option = compileLayoutOption(input, candidate.id); }
    catch { result.rejected.push({ id: candidate.id, issues: ['compile-failed'] }); result.checked++; continue; }
    result.checked++;
    if (option.issues.length) result.rejected.push({ id: candidate.id, issues: option.issues });
    else {
      result.options.push(option);
      result.options.sort(compare);
      // Release losing frames as we go, rather than holding every compile.
      result.options = result.options.slice(0, 3);
    }
  }
  await checkpoint(result.checked, candidates.length);
  // Do not fill the result with layouts that add pages when a compact choice
  // passed. A single good option is more useful than unnecessary continuations.
  const compact = result.options[0]?.frameCount;
  result.options = result.options.filter(option => option.frameCount === compact);
  if (result.options.some(option => option.id.startsWith('flow-'))) result.options = result.options.filter(option => option.id.startsWith('flow-'));
  return result;
}
