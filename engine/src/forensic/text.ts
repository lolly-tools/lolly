// SPDX-License-Identifier: MPL-2.0
/** Source offsets, language eligibility and bounded document-wide windows. */
import { analyzeTextSignals, quotedAt } from '../text-signals.ts';
import { FORENSIC_VERSION, type ForensicFinding, type ForensicPage } from './types.ts';

const ENGLISH = new Set(
  'the and of to in is that for with it as was on be are this by from or an at we you have not they will their can has but our which when these more also been its would about than into'.split(
    ' '
  )
);
const OTHER = new Set(
  'le la les des du une et est dans pour que qui sur avec un der die das und ist ein eine mit den dem zu von el los las del una y en es por para con se il gli lo di che per non'.split(
    ' '
  )
);
export function forensicLanguage(text: string): 'english' | 'other-or-uncertain' | 'too-short' {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length < 50) return 'too-short';
  const en = words.filter((w) => ENGLISH.has(w)),
    other = words.filter((w) => OTHER.has(w));
  return en.length / words.length >= 0.08 && new Set(en).size >= 4 && en.length > other.length * 1.5
    ? 'english'
    : 'other-or-uncertain';
}
export function forensicTextWindows(text: string, cap = 32): { index: number; length: number }[] {
  if (!Number.isInteger(cap) || cap < 2 || cap > 128 || text.length > 65_536)
    throw new Error('Forensic text window budget exceeded.');
  const ends: { index: number; length: number }[] = [];
  for (let index = 0; index < text.length; ) {
    let end = Math.min(text.length, index + 1200);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end);
      if (space > index + 800) end = space;
    }
    ends.push({ index, length: end - index });
    if (end === text.length) break;
    const space = text.indexOf(' ', Math.max(index + 1, end - 200));
    index = space >= 0 && space < end ? space + 1 : end;
  }
  if (ends.length <= cap) return ends;
  return Array.from(
    { length: cap },
    (_, i) => ends[Math.round((i * (ends.length - 1)) / (cap - 1))]!
  );
}
export function forensicTextFindings(page: ForensicPage): ForensicFinding[] {
  const report = analyzeTextSignals(page.text, {
    source: page.source,
    ...(page.docKind ? { docKind: page.docKind } : {}),
  });
  const out: ForensicFinding[] = report.findings.map((f) => {
    const spans = f.spans ?? [];
    const excluded =
      spans.length > 0 &&
      spans.every(
        (s) =>
          quotedAt(page.text, s.index, s.length) ||
          /(?:example|quoted|detector|AI writing|AI-generated)/i.test(
            page.text.slice(Math.max(0, s.index - 100), s.index)
          )
      );
    return {
      id: `${page.id}:text:${f.kind}`,
      rule: f.kind,
      family: f.kind,
      version: FORENSIC_VERSION,
      modality: 'text',
      label: f.label,
      detail: f.detail ?? f.label,
      method: page.source === 'ocr' ? 'ocr' : 'original-text',
      confidence: f.heat,
      confidenceBasis: 'heuristic',
      contribution: excluded
        ? 'context-excluded'
        : f.tier === 'artifact'
          ? 'specific-artifact'
          : 'weak-clue',
      alternatives: ['Human writing, quotations and templates can contain this pattern.'],
      locations: spans.length
        ? spans.map((span) => ({ page: page.id, span }))
        : [{ page: page.id }],
      measurements: { weight: f.weight },
    };
  });
  return [...out, ...forensicNumberingFindings(page)];
}
export function forensicNumberingFindings(page: ForensicPage): ForensicFinding[] {
  const out: ForensicFinding[] = [];
  const lines = [...page.text.matchAll(/^.*$/gm)].filter((m) => m[0].trim());
  const numbered = lines.flatMap((m) => {
    const n = /^(?:\s*)([#–—-]\s*)?(0[1-9]|[1-9]\d{0,3})(?:[.)]\s+|\s+|$)/u.exec(m[0]);
    return n
      ? [
          {
            number: Number(n[2]),
            decorated:
              (!!n[1] && !(page.docKind === 'markdown' && n[1].trim() === '#')) ||
              n[2]!.startsWith('0'),
            literal: n[0].trim(),
            index: m.index!,
            length: m[0].length,
          },
        ]
      : [];
  });
  let sequence: typeof numbered = [];
  const emit = (): void => {
    if (
      sequence.length < 2 ||
      sequence.length > 9 ||
      !sequence.some((n) => n.decorated)
    )
      return;
    if (sequence[0]!.number !== 1 || sequence.some((n, i) => n.number !== i + 1)) return;
    const context = sequence.map((n) => page.text.slice(n.index, n.index + n.length)).join(' ');
    const excluded =
      /\b(?:chapter|clause|version|page|step|procedure|example|numbering|score)\b/i.test(context);
    out.push({
      id: `${page.id}:numbering:${sequence[0]!.index}`,
      rule: page.complete ? 'decorative-numbering' : 'decorative-numbering-partial',
      family: 'decorative-numbering',
      version: FORENSIC_VERSION,
      modality: 'text',
      label: page.complete ? 'Decorative numbering in a short list' : 'Decorated labels in a partial extract',
      detail: `${sequence.length} observed items use labels such as ${sequence.find((n) => n.decorated)!.literal}.${page.complete ? '' : ' Unread content may continue the sequence, so no short-list claim is made.'}`,
      method: page.source === 'ocr' ? 'ocr' : 'original-text',
      confidence: page.source === 'ocr' ? 0.6 : 0.9,
      confidenceBasis: 'heuristic',
      contribution: excluded || !page.complete ? 'context-excluded' : 'weak-clue',
      alternatives: [
        'An ordered procedure, identifier or established editorial style may require these labels.',
      ],
      locations: sequence.map((n) => ({
        page: page.id,
        span: { index: n.index, length: n.length },
      })),
      measurements: { count: sequence.length, complete: page.complete },
    });
  };
  for (const n of numbered) {
    if (
      sequence.length &&
      (n.number !== sequence.at(-1)!.number + 1 || n.index - sequence.at(-1)!.index > 2000)
    ) {
      emit();
      sequence = [];
    }
    sequence.push(n);
  }
  emit();
  return out;
}
