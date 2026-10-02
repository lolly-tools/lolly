// SPDX-License-Identifier: MPL-2.0
/** Evidence grouping and byte-bound reports do not create probability claims. */
import { productionDigest } from '../production/contract.ts';
import { sha256Hex } from '../bytes.ts';
import { forensicTextFindings, forensicNumberingFindings } from './text.ts';
import { forensicLayoutFindings } from './layout.ts';
import {
  FORENSIC_VERSION,
  type ForensicReport,
  type ForensicPage,
  type ForensicCoverage,
  type ForensicFinding,
  type ForensicModelObservation,
  type ForensicOrigin,
  type ForensicFormat,
} from './types.ts';

export async function forensicReport(
  bytes: Uint8Array,
  pages: ForensicPage[],
  coverage: ForensicCoverage[],
  models: ForensicModelObservation[] = [],
  additional: ForensicFinding[] = [],
  origins: ForensicOrigin[] = [],
  format: ForensicFormat = 'unknown'
): Promise<ForensicReport> {
  if (
    pages.length > 100 ||
    pages.some((p) => p.text.length > 65_536 || p.lines.length > 10_000 || p.shapes.length > 1000)
  )
    throw new Error('Forensic report budget exceeded.');
  const findings = [
    ...pages.flatMap((p) => [
      ...forensicTextFindings(p).filter(
        (f) => pages.length === 1 || f.family !== 'decorative-numbering'
      ),
      ...forensicLayoutFindings(p, p.layoutMethod),
    ]),
    ...additional,
  ];
  if (pages.length > 1) {
    const joined = pages.map((p) => p.text).join('\n\n');
    if (joined.length <= 65_536) {
      const whole: ForensicPage = {
        id: 'document',
        width: 0,
        height: 0,
        text: joined,
        source: pages.some((p) => p.source === 'ocr') ? 'ocr' : 'digital',
        ...(pages.every((p) => p.docKind === 'markdown') ? { docKind: 'markdown' as const } : {}),
        complete:
          pages.every((p) => p.complete) &&
          !coverage.some((c) => ['pages', 'page'].includes(c.collector) && c.state !== 'completed'),
        lines: [],
        shapes: [],
      };
      for (const f of forensicNumberingFindings(whole)) {
        f.locations = f.locations.flatMap((location) => {
          const span = location.span!;
          let offset = 0;
          for (const page of pages) {
            if (span.index >= offset && span.index < offset + page.text.length)
              return [
                {
                  page: page.id,
                  span: {
                    index: span.index - offset,
                    length: Math.min(span.length, offset + page.text.length - span.index),
                  },
                },
              ];
            offset += page.text.length + 2;
          }
          return [];
        });
        findings.push(f);
      }
    } else
      coverage = [
        ...coverage,
        {
          collector: 'numbering',
          state: 'partial',
          reason:
            'Document-wide sequence exceeds the 65,536-character budget. No short-list claim was made.',
          version: FORENSIC_VERSION,
        },
      ];
  }
  for (const m of models)
    if (m.rawMean >= m.threshold)
      findings.push({
        id: `${m.page}:model:${m.model}`,
        rule: 'classifier-threshold',
        family: 'local-classifier',
        version: m.version,
        modality: 'text',
        label: 'Local classifier threshold exceeded',
        detail:
          'The aggregate raw classifier score exceeds its provisional evidence threshold. This is not a calibrated probability.',
        method: 'local-classifier',
        confidence: 1,
        confidenceBasis: 'observed',
        contribution: 'weak-clue',
        alternatives: [
          'Non-native English, templated human prose and distribution changes can produce high classifier scores.',
        ],
        locations: m.windows.map((w) => ({
          page: m.page,
          span: { index: w.index, length: w.length },
        })),
        measurements: { rawMean: m.rawMean, threshold: m.threshold, complete: m.complete },
      });
  for (const f of findings)
    for (const location of f.locations) {
      const page = pages.find((p) => p.id === location.page);
      if (!location.box && location.span && page?.lines.length) {
        let offset = 0;
        for (const line of page.lines) {
          const start = page.text.indexOf(line.text, offset);
          if (start < 0) continue;
          offset = start + line.text.length;
          if (start < location.span.index + location.span.length && offset > location.span.index) {
            location.box = line.box;
            break;
          }
        }
      }
    }
  const groups = new Map<string, ForensicFinding>();
  for (const f of findings) {
    const key = `${f.family}:${f.contribution}`;
    const prior = groups.get(key);
    const observation = {
      method: f.method,
      confidence: f.confidence,
      measurements: f.measurements,
      locations: f.locations,
    };
    if (!prior) groups.set(key, { ...f, locations: [...f.locations], observations: [observation] });
    else {
      prior.locations.push(...f.locations);
      prior.observations!.push(observation);
      prior.confidence = Math.max(prior.confidence, f.confidence);
    }
  }
  const grouped = [...groups.values()].sort((a, b) => a.family.localeCompare(b.family));
  const scored = grouped.filter((f) => f.contribution !== 'context-excluded');
  const specific = scored.filter((f) => f.contribution === 'specific-artifact').length;
  const score = Math.min(
    100,
    Math.round(
      100 *
        (1 -
          Math.exp(
            -(
              0.9 * specific +
              Math.min(
                1,
                (scored.filter((f) => f.family !== 'local-classifier').length - specific) * 0.12 +
                  (scored.some((f) => f.family === 'local-classifier') ? 0.45 : 0)
              )
            )
          ))
    )
  );
  const body = {
    profile: 'lolly/forensic-ai-v1' as const,
    version: FORENSIC_VERSION,
    artifactSha256: await sha256Hex(bytes),
    format,
    origins,
    pages,
    findings: grouped,
    coverage,
    models,
    evidence: {
      score,
      band:
        score >= 72
          ? ('strong' as const)
          : score >= 45
            ? ('notable' as const)
            : score > 0
              ? ('weak' as const)
              : ('none' as const),
      families: scored.length,
    },
    likelihood: {
      state: 'unavailable' as const,
      reason:
        'No released calibration matches this assessment. Style clues and raw model scores do not establish probability.',
    },
    limitations: [
      'Style and layout patterns can occur in human work.',
      'Finding confidence describes pattern detection, not authorship.',
      'Absence of evidence does not establish human authorship.',
    ],
  };
  return { ...body, reportSha256: await productionDigest(body) };
}
/** Validate imported display data before checking its byte binding. */
export async function verifyForensicReport(
  report: ForensicReport,
  bytes: Uint8Array
): Promise<boolean> {
  try {
    const str = (v: unknown): v is string => typeof v === 'string' && v.length <= 65_536;
    const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const unit = (v: unknown): v is number => num(v) && v >= 0 && v <= 1;
    const integer = (v: unknown, max: number): v is number =>
      num(v) && Number.isInteger(v) && v >= 0 && v <= max;
    const array = (v: unknown, max: number): v is unknown[] => Array.isArray(v) && v.length <= max;
    const box = (b: { x: number; y: number; width: number; height: number }) =>
      b &&
      [b.x, b.y, b.width, b.height].every((n) => num(n) && Math.abs(n) <= 10_000_000) &&
      b.width >= 0 &&
      b.height >= 0;
    const measurement = (m: Record<string, unknown>) =>
      m &&
      typeof m === 'object' &&
      !Array.isArray(m) &&
      Object.keys(m).length <= 256 &&
      Object.entries(m).every(([k, v]) => str(k) && (str(v) || num(v) || typeof v === 'boolean'));
    if (
      report?.profile !== 'lolly/forensic-ai-v1' ||
      report.version !== FORENSIC_VERSION ||
      ![
        'text',
        'markdown',
        'png',
        'jpeg',
        'webp',
        'svg',
        'pdf',
        'pptx',
        'docx',
        'unknown',
      ].includes(report.format)
    )
      return false;
    if (
      !array(report.pages, 100) ||
      new Set(report.pages.map((p) => p.id)).size !== report.pages.length ||
      report.pages.some(
        (p) =>
          !p ||
          !str(p.id) ||
          !str(p.text) ||
          !num(p.width) ||
          !num(p.height) ||
          p.width < 0 ||
          p.height < 0 ||
          typeof p.complete !== 'boolean' ||
          !['digital', 'ocr'].includes(p.source) ||
          !array(p.lines, 10_000) ||
          !array(p.shapes, 1000) ||
          p.lines.some((l) => !str(l.text) || !unit(l.confidence) || !box(l.box)) ||
          p.shapes.some((s) => !box(s.box) || !num(s.radius) || !str(s.fill))
      )
    )
      return false;
    const location = (l: import('./types.ts').ForensicLocation) => {
      const page = l && report.pages.find((p) => p.id === l.page);
      return (
        !!page &&
        (!l.box || box(l.box)) &&
        (!l.span ||
          (integer(l.span.index, page.text.length) &&
            integer(l.span.length, page.text.length - l.span.index)))
      );
    };
    if (
      !array(report.findings, 4096) ||
      new Set(report.findings.map((f) => f.id)).size !== report.findings.length ||
      report.findings.some(
        (f) =>
          !f ||
          ![f.id, f.rule, f.family, f.version, f.label, f.detail, f.method].every(str) ||
          !['text', 'layout'].includes(f.modality) ||
          !['heuristic', 'observed'].includes(f.confidenceBasis) ||
          !unit(f.confidence) ||
          !['weak-clue', 'specific-artifact', 'context-excluded'].includes(f.contribution) ||
          !array(f.alternatives, 100) ||
          !f.alternatives.every(str) ||
          !array(f.locations, 10_000) ||
          !f.locations.every(location) ||
          !measurement(f.measurements) ||
          (f.observations &&
            (!array(f.observations, 10_000) ||
              f.observations.some(
                (o) =>
                  !str(o.method) ||
                  !unit(o.confidence) ||
                  !measurement(o.measurements) ||
                  !array(o.locations, 10_000) ||
                  !o.locations.every(location)
              )))
      )
    )
      return false;
    if (
      !array(report.coverage, 4096) ||
      report.coverage.some(
        (c) =>
          !c ||
          ![c.collector, c.reason, c.version].every(str) ||
          ![
            'completed',
            'partial',
            'skipped',
            'unsupported',
            'unavailable',
            'failed',
            'cancelled',
          ].includes(c.state) ||
          (c.ranges &&
            (!array(c.ranges, 8192) ||
              c.ranges.some((r) => !integer(r.index, 65_536) || !integer(r.length, 65_536))))
      )
    )
      return false;
    if (
      !array(report.models, 100) ||
      report.models.some(
        (m) =>
          !m ||
          ![m.model, m.version].every(str) ||
          !unit(m.rawMean) ||
          !unit(m.threshold) ||
          typeof m.complete !== 'boolean' ||
          !array(m.windows, 128) ||
          m.windows.some(
            (w) =>
              !integer(w.tokens, 100_000) ||
              !unit(w.rawScore) ||
              !location({ page: m.page, span: w })
          ) ||
          (m.chunks !== undefined &&
            (!array(m.chunks, 128) ||
              m.chunks.some((c) => !unit(c.rawScore) || !location({ page: m.page, span: c })))) ||
          (m.chunkThreshold !== undefined && !unit(m.chunkThreshold)) ||
          (m.chunkFloor !== undefined && !unit(m.chunkFloor)) ||
          (m.chunkVersion !== undefined && !str(m.chunkVersion))
      )
    )
      return false;
    if (
      !array(report.origins, 100) ||
      report.origins.some(
        (o) =>
          !o ||
          !['generated', 'composite', 'container-hint'].includes(o.kind) ||
          !['credential', 'metadata', 'container-signature'].includes(o.source) ||
          !['verified', 'unverified', 'unsigned'].includes(o.integrity) ||
          o.scope !== 'document'
      )
    )
      return false;
    if (
      !integer(report.evidence.score, 100) ||
      !integer(report.evidence.families, 4096) ||
      !['none', 'weak', 'notable', 'strong'].includes(report.evidence.band) ||
      !array(report.limitations, 100) ||
      !report.limitations.every(str)
    )
      return false;
    if (
      report.likelihood.state === 'unavailable'
        ? !str(report.likelihood.reason)
        : report.likelihood.state !== 'calibrated' ||
          !unit(report.likelihood.probability) ||
          !str(report.likelihood.population) ||
          !str(report.likelihood.calibration)
    )
      return false;
    const { reportSha256, ...body } = report;
    return (
      report.artifactSha256 === (await sha256Hex(bytes)) &&
      reportSha256 === (await productionDigest(body))
    );
  } catch {
    return false;
  }
}
