// SPDX-License-Identifier: MPL-2.0
/** Layout motifs remain weak authorship clues even when geometry is clear. */
import { FORENSIC_VERSION, type ForensicFinding, type ForensicPage } from './types.ts';

const words = (text: string): Set<string> =>
  new Set(
    (text.toLowerCase().match(/\p{L}{3,}/gu) ?? []).filter(
      (w) => !['the', 'with', 'and', 'for', 'our', 'your'].includes(w)
    )
  );
export function forensicLayoutFindings(
  page: ForensicPage,
  method: 'source-geometry' | 'decoded-pixels' = 'source-geometry'
): ForensicFinding[] {
  const findings: ForensicFinding[] = [];
  for (const [i, shape] of page.shapes.entries()) {
    if (!shape.accent || shape.radius <= 0 || shape.accent.width <= 0) continue;
    const side = ['left', 'right'].includes(shape.accent.edge) ? shape.box.width : shape.box.height;
    if (shape.accent.width / side > 0.15) continue;
    const excluded =
      /finger\s*nail\s*cards|rounded.{0,40}(?:border|card)|(?:border|card).{0,40}rounded/i.test(
        page.text
      );
    findings.push({
      id: `${page.id}:card:${i}`,
      rule: 'fingernail-card',
      family: 'fingernail-card',
      version: FORENSIC_VERSION,
      modality: 'layout',
      label: 'Rounded card with a coloured edge',
      detail: `A rounded container has a solid accent on its ${shape.accent.edge} edge.`,
      method,
      confidence: method === 'source-geometry' ? 0.9 : 0.7,
      confidenceBasis: 'heuristic',
      contribution: excluded ? 'context-excluded' : 'weak-clue',
      alternatives: [
        'Status, selection, accessibility or an established design system may explain the accent.',
      ],
      locations: [{ page: page.id, box: shape.box }],
      measurements: {
        radius: shape.radius,
        edge: shape.accent.edge,
        stripWidth: shape.accent.width,
        colour: shape.accent.colour,
      },
    });
  }
  const lines = page.lines
    .filter((l) => l.confidence >= 0.6)
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  for (const [i, a] of lines.entries()) {
    const b = lines
      .slice(i + 1)
      .find(
        (l) =>
          l.box.y >= a.box.y + a.box.height * 0.5 &&
          l.box.y - (a.box.y + a.box.height) < Math.max(20, a.box.height * 1.8) &&
          Math.abs(l.box.x - a.box.x) <= Math.max(12, a.box.height)
      );
    if (!b || a.text.length > 100 || !a.text.trim()) continue;
    const ratio = (b.size ?? b.box.height) / Math.max(1, a.size ?? a.box.height);
    if (ratio < 1.5 || ratio > 6) continue;
    const wa = words(a.text),
      wb = words(b.text),
      overlap = [...wa].filter((w) => wb.has(w)).length / Math.max(1, wa.size);
    const redundant = overlap >= 0.6 && wa.size > 0;
    const excluded =
      /eyebrow|pre.heading|redundant information/i.test(page.text);
    findings.push({
      id: `${page.id}:eyebrow:${i}`,
      rule: redundant ? 'redundant-eyebrow' : 'eyebrow-heading',
      family: 'eyebrow-heading',
      version: `${FORENSIC_VERSION};eyebrow/2`,
      modality: 'layout',
      label: 'Eyebrow',
      detail: `“${a.text}” precedes “${b.text}”${redundant ? ' and repeats its vocabulary' : ''}.`,
      method: page.source === 'ocr' ? 'ocr' : method,
      confidence: Math.min(a.confidence, b.confidence, 0.85),
      confidenceBasis: 'heuristic',
      contribution: excluded ? 'context-excluded' : 'weak-clue',
      alternatives: [
        'A useful category, date or editorial kicker can introduce a heading. Geometry does not establish semantic redundancy.',
      ],
      locations: [
        { page: page.id, box: a.box },
        { page: page.id, box: b.box },
      ],
      measurements: {
        sizeRatio: ratio,
        lexicalOverlap: overlap,
        uppercase: a.text === a.text.toUpperCase(),
      },
    });
  }
  return findings;
}
