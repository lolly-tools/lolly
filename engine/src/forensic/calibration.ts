// SPDX-License-Identifier: MPL-2.0
/** Candidate fits remain unavailable until reviewed, preregistered gates pass. */
import { productionDigest } from '../production/contract.ts';
import { FORENSIC_VERSION, type ForensicReport, type ForensicFormat } from './types.ts';
import { forensicLanguage } from './text.ts';
export interface ForensicCalibration {
  id: string;
  version: string;
  rulesVersion: string;
  target: 'substantive-generative-contribution';
  population: string;
  prior: number;
  modalities: ('text' | 'layout')[];
  formats: ForensicFormat[];
  sources: ('digital' | 'ocr')[];
  modelIds: string[];
  modelVersions: string[];
  features: string[];
  weights: number[];
  intercept: number;
  gates: {
    preregistrationSha256: string;
    minDocuments: number;
    maxEce: number;
    maxFalsePositiveUpper95: number;
    minRecall: number;
    maxBrier: number;
  };
  evaluation: {
    holdoutSha256: string;
    documents: number;
    humanDocuments: number;
    aiDocuments: number;
    brier: number;
    logLoss: number;
    ece: number;
    falsePositiveRate: number;
    falsePositiveUpper95: number;
    recall: number;
    released: boolean;
  };
  sha256: string;
}
export function forensicFeatures(report: ForensicReport): Record<string, number> {
  const features: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const f of report.findings)
    if (f.contribution !== 'context-excluded')
      features[f.family] = Math.max(features[f.family] ?? 0, f.confidence);
  if (report.models.length)
    features['model.rawMean'] =
      report.models.reduce((sum, m) => sum + m.rawMean, 0) / report.models.length;
  features['coverage.partial'] = report.coverage.some(
    (c) => c.state !== 'completed' && c.state !== 'unsupported'
  )
    ? 1
    : 0;
  return features;
}
export async function applyForensicCalibration(
  report: ForensicReport,
  calibration: ForensicCalibration
): Promise<ForensicReport> {
  const { sha256, ...body } = calibration,
    e = calibration.evaluation,
    g = calibration.gates;
  const numeric = [
    e.documents,
    e.humanDocuments,
    e.aiDocuments,
    e.brier,
    e.logLoss,
    e.ece,
    e.falsePositiveRate,
    e.falsePositiveUpper95,
    e.recall,
    g.minDocuments,
    g.maxEce,
    g.maxFalsePositiveUpper95,
    g.minRecall,
    g.maxBrier,
  ];
  const eligible =
    numeric.every(Number.isFinite) &&
    sha256 === (await productionDigest(body)) &&
    calibration.rulesVersion === FORENSIC_VERSION &&
    report.version === FORENSIC_VERSION &&
    calibration.formats.includes(report.format) &&
    calibration.target === 'substantive-generative-contribution' &&
    /^[a-f0-9]{64}$/.test(g.preregistrationSha256) &&
    /^[a-f0-9]{64}$/.test(e.holdoutSha256) &&
    e.released &&
    e.documents >= g.minDocuments &&
    e.humanDocuments >= 100 &&
    e.aiDocuments >= 100 &&
    e.ece <= g.maxEce &&
    e.falsePositiveUpper95 <= g.maxFalsePositiveUpper95 &&
    e.recall >= g.minRecall &&
    e.brier <= g.maxBrier &&
    calibration.prior > 0 &&
    calibration.prior < 1 &&
    calibration.population.length > 0 &&
    calibration.modalities.length > 0 &&
    calibration.features.length > 0 &&
    calibration.features.length <= 256 &&
    calibration.features.length === calibration.weights.length &&
    Number.isFinite(calibration.intercept) &&
    calibration.weights.every(Number.isFinite) &&
    report.pages.length > 0 &&
    report.pages.every(
      (p) =>
        p.complete &&
        calibration.sources.includes(p.source) &&
        (!calibration.modalities.includes('text') || forensicLanguage(p.text) === 'english')
    ) &&
    report.models.every(
      (m) =>
        m.complete &&
        calibration.modelIds.includes(m.model) &&
        calibration.modelVersions.includes(m.version)
    );
  if (!eligible) return report;
  if (
    report.coverage.some(
      (c) =>
        ['pages', 'page', 'extraction', 'assessment'].includes(c.collector) &&
        c.state !== 'completed'
    )
  )
    return report;
  if (
    calibration.modalities.includes('layout') &&
    (report.coverage.some((c) => /layout/.test(c.collector) && c.state !== 'completed') ||
      report.pages.some(
        (p) =>
          !p.width ||
          !p.height ||
          !report.coverage.some(
            (c) => c.page === p.id && /layout/.test(c.collector) && c.state === 'completed'
          )
      ))
  )
    return report;
  const features = forensicFeatures(report);
  if (
    calibration.features.includes('model.rawMean') &&
    (features['model.rawMean'] === undefined ||
      report.models.length !== report.pages.length ||
      report.pages.some((p) => report.models.filter((m) => m.page === p.id).length !== 1))
  )
    return report;
  const z =
    calibration.intercept +
    calibration.features.reduce(
      (sum, key, i) => sum + (features[key] ?? 0) * calibration.weights[i]!,
      0
    );
  const { reportSha256: _old, ...base } = report;
  const next = {
    ...base,
    likelihood: {
      state: 'calibrated' as const,
      probability: 1 / (1 + Math.exp(-z)),
      calibration: calibration.id,
      population: calibration.population,
    },
  };
  return { ...next, reportSha256: await productionDigest(next) };
}
