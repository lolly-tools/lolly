// SPDX-License-Identifier: MPL-2.0
import type { DeckCensusV1, LayoutFeaturesV1, SourceObjectV1, SlideSourceV1 } from '../../packages/core/src/rebrand-v1.ts';
import { neutralSlideMaster } from '../../engine/src/rebrand-design-system.ts';
import { layoutReadOpts, matchSlideLayout } from '../../engine/src/rebrand-structure.ts';
import { prepareCandidates, validateBrief } from './candidates.ts';
import type { SlideBrief } from './types.ts';

export interface CorpusRow {
  id: string;
  deck: string;
  page: number;
  title: string;
  mode: 'native' | 'ocr' | 'ocr-needed';
  status: 'ready' | 'inspect';
  categories: string[];
  reasons: string[];
  candidateCount: number;
  preview: boolean;
}
export interface OcrAudit {
  state: string;
  model?: string;
  calls: number;
  ms: number;
  before: number;
  after: number;
  meanConfidence?: number;
  error?: string;
}
export interface CorpusCase extends CorpusRow {
  brief?: SlideBrief;
  features: LayoutFeaturesV1;
  readout: Array<{ id: string; text: string; kind: string; classification: string; excluded: boolean }>;
  baseline: { layout?: string; band?: string; reasons: string[] };
  ocr?: OcrAudit;
  warnings: string[];
  picture?: { id: string; file: string };
}
export interface CorpusIndex {
  version: 1;
  created: string;
  engine: string;
  decks: number;
  cases: CorpusRow[];
  errors: Array<{ name: string; error: string }>;
}

const FURNITURE = new Set(['template-furniture', 'decoration', 'logo-candidate', 'known-logo', 'recurring-text', 'page-number', 'footer', 'date']);
export const sourceText = (o: SourceObjectV1): string => o.text?.paras.map(p => p.runs.map(r => r.text).join('')).join('\n') ?? '';
const maxPt = (o: SourceObjectV1): number => Math.max(0, ...(o.text?.paras.flatMap(p => p.runs.map(r => r.sizePt ?? 0)) ?? []));

export function caseFromSource(deck: string, id: string, slide: SlideSourceV1, census: DeckCensusV1, ocr?: OcrAudit): CorpusCase {
  const classes = new Map(census.objects.map(o => [o.id, o.hypothesis.class]));
  const excluded = (o: SourceObjectV1): boolean => o.hidden === true || FURNITURE.has(classes.get(o.id) ?? '');
  const content = slide.objects.filter(o => !excluded(o));
  const text = content.filter(o => sourceText(o).trim());
  const pics = content.filter(o => o.kind === 'pic');
  const features = census.layouts.find(l => l.slideId === slide.id)!;
  const match = matchSlideLayout(slide, features, layoutReadOpts(slide, new Set(slide.objects.filter(excluded).map(o => o.id)), oid => classes.get(oid), neutralSlideMaster()));
  const title = [...text].sort((a, b) => Number(classes.get(b.id) === 'title') - Number(classes.get(a.id) === 'title') || maxPt(b) - maxPt(a) || a.box.y - b.box.y)[0];
  const titleText = title ? sourceText(title) : `Slide ${slide.index + 1}`;
  const categories: string[] = [];
  if (slide.origin.flattened) categories.push('flattened');
  if (text.length > 6) categories.push('dense text');
  if (pics.length) categories.push(pics.length > 1 ? 'multiple pictures' : 'picture');
  if (content.some(o => o.kind === 'chart' || classes.get(o.id) === 'chart')) categories.push('chart');
  if (content.some(o => o.kind === 'table')) categories.push('table');
  if (content.some(o => o.kind === 'vector' || o.vectorItems)) categories.push('vector');
  if (!categories.length) categories.push('text');
  const reasons: string[] = [];
  const mode = slide.origin.flattened ? ocr?.state === 'text-found' ? 'ocr' : 'ocr-needed' : 'native';
  if (mode === 'ocr-needed') reasons.push(ocr?.error ?? 'No editable text has been recovered from this flattened slide.');
  if (content.some(o => ['chart', 'table', 'vector', 'unknown'].includes(o.kind))) reasons.push('Chart, table, vector or unknown content needs a richer layout contract.');
  if (content.some(o => o.kind === 'shape' && !sourceText(o).trim())) reasons.push('A content shape or connector needs its relationships preserved.');
  if (content.some(o => o.fidelity.state === 'unavailable')) reasons.push('The reader reports unavailable source content.');
  if (pics.length > 1) reasons.push('The first lab supports at most one content picture.');
  if (!title) reasons.push('No readable title or body text was found.');
  if (text.length > 7) reasons.push('More than six body objects need grouping before this lab can recommend a layout.');
  if (pics.some(o => !o.media)) reasons.push('A source picture has no stored bytes.');
  let brief: SlideBrief | undefined;
  let candidateCount = 0;
  if (!reasons.length && title) {
    const order = new Map(slide.readingOrder.map((oid, i) => [oid, i]));
    const body = text.filter(o => o !== title).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const blocks = body.map(o => {
      const paras = o.text!.paras.map(p => p.runs.map(r => r.text).join(''));
      const heading = paras.length > 1 && paras[0]!.length <= 160 ? paras.shift()! : '';
      return { id: o.id, heading, text: paras.join('\n') };
    });
    try {
      brief = validateBrief({ id, title: titleText, request: 'Recommend an appropriate layout for this slide.', blocks, ...(pics[0] ? { image: { id: pics[0].id, description: pics[0].alt || 'Original slide picture' } } : {}) });
      candidateCount = prepareCandidates(brief, features).eligible.length;
      if (!candidateCount) reasons.push('No candidate passed the content and estimated-fit checks.');
    } catch (error) { reasons.push(error instanceof Error ? error.message : String(error)); }
  }
  return {
    id, deck, page: slide.index + 1, title: titleText.slice(0, 200), mode, status: reasons.length ? 'inspect' : 'ready', categories, reasons, candidateCount, preview: false,
    brief, features, baseline: { layout: match.archetype, band: match.match?.band, reasons: match.reasons.map(r => r.text) }, ocr,
    readout: slide.objects.map(o => ({ id: o.id, text: sourceText(o), kind: o.kind, classification: classes.get(o.id) ?? 'unknown', excluded: excluded(o) })),
    warnings: slide.warnings.map(w => w.message),
  };
}
