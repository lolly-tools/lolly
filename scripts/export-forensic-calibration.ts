// SPDX-License-Identifier: MPL-2.0
/** Export a non-released candidate from frozen evaluation records, without refitting. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { productionDigest } from '../engine/src/production/contract.ts';
import type { ForensicCalibration } from '../engine/src/forensic.ts';
const directory = resolve(process.argv[2] ?? 'plans/287-verify-forensics/evaluation-v2');
const baseline = JSON.parse(await readFile(join(directory, 'baseline.json'), 'utf8'));
const preregistration = JSON.parse(await readFile(join(directory, 'preregistration.json'), 'utf8'));
const holdout = JSON.parse(await readFile(join(directory, 'holdout.json'), 'utf8'));
if (
  preregistration.baselineSha256 !== (await productionDigest(baseline)) ||
  holdout.baselineSha256 !== preregistration.baselineSha256 ||
  holdout.preregistrationSha256 !== (await productionDigest(preregistration))
)
  throw new Error('Frozen evaluation record digests do not match.');
const operating = holdout.fusion[0],
  fit = baseline.candidate;
const body: Omit<ForensicCalibration, 'sha256'> = {
  id: 'raid-abstracts-development-2026-09-30',
  version: 'candidate/1',
  rulesVersion: baseline.rules,
  target: 'substantive-generative-contribution',
  population: `${baseline.population} Fusion was fitted with equal label weighting; empirical reliability was tested on the sampled class mixture.`,
  prior: 0.5,
  modalities: ['text'],
  formats: ['text'],
  sources: ['digital'],
  modelIds: [baseline.model],
  modelVersions: ['window-policy/2'],
  features: baseline.featureKeys,
  weights: fit.weights.map((w: number) => w * fit.calibrationSlope),
  intercept: fit.intercept * fit.calibrationSlope + fit.calibrationIntercept,
  gates: { preregistrationSha256: holdout.preregistrationSha256, ...preregistration.gates },
  evaluation: {
    holdoutSha256: holdout.holdoutSha256,
    documents: holdout.count,
    humanDocuments: holdout.human,
    aiDocuments: holdout.ai,
    brier: holdout.reliability.brier,
    logLoss: holdout.reliability.logLoss,
    ece: holdout.reliability.ece,
    falsePositiveRate: operating.falsePositiveRate,
    falsePositiveUpper95: operating.falsePositive95[1],
    recall: operating.recall,
    released: false,
  },
};
await writeFile(
  join(directory, 'calibration-candidate.json'),
  JSON.stringify({ ...body, sha256: await productionDigest(body) }, null, 2)
);
console.log('Exported a non-released candidate. No product calibration was installed.');
