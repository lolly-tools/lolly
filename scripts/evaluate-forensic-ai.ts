// SPDX-License-Identifier: MPL-2.0
/** Group-disjoint baseline, fusion, calibration and locked holdout evaluation. */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  analyzeTextSignals,
  forensicReport,
  forensicFeatures,
  productionDigest,
  FORENSIC_VERSION,
} from '../engine/src/index.ts';
import { createNodeAiDetectAPI } from '../packages/node-shell/src/ml/ai-detect.ts';
interface Document {
  id: string;
  sourceGroup: string;
  generatorFamily: string;
  domain: string;
  language: string;
  source: 'digital' | 'ocr';
  label: 0 | 1;
  text: string;
}
interface Observation {
  document: Omit<Document, 'text'>;
  split: 'development' | 'calibration' | 'holdout';
  oldIndex: number;
  newIndex: number;
  oldRaw: number | null;
  newRaw: number | null;
  features: Record<string, number>;
  complete: boolean;
}
const positionals = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dir = resolve(positionals[0] ?? 'plans/287-verify-forensics/corpus'),
  output = resolve(positionals[1] ?? 'plans/287-verify-forensics/evaluation-v3');
const holdout = process.argv.includes('--holdout');
const modelMethod = 'window-policy/3;onnx-cpu-basic';
if (!holdout) {
  const frozen = await access(join(output, 'preregistration.json')).then(
    () => true,
    () => false
  );
  if (frozen)
    throw new Error(
      'This evaluation is frozen. Use a new output directory for another development run.'
    );
}
const docs = (await readFile(join(dir, 'documents.jsonl'), 'utf8'))
  .trim()
  .split('\n')
  .map((s) => JSON.parse(s) as Document);
if (
  docs.length > 20_000 ||
  docs.some((d) => !d.sourceGroup || ![0, 1].includes(d.label) || d.text.length > 65_536)
)
  throw new Error('Invalid or excessive evaluation corpus.');
const corpusSha256 = await productionDigest(docs),
  api = createNodeAiDetectAPI();
if (holdout) {
  const prereg = JSON.parse(await readFile(join(output, 'preregistration.json'), 'utf8'));
  const frozen = JSON.parse(await readFile(join(output, 'baseline.json'), 'utf8'));
  if (
    prereg.baselineSha256 !== (await productionDigest(frozen)) ||
    prereg.corpusSha256 !== corpusSha256 ||
    prereg.rules !== FORENSIC_VERSION
  )
    throw new Error('Holdout requires a matching frozen preregistration.');
}
if (!api || !(await api.cached()))
  throw new Error('Stage the pinned local classifier before evaluation.');
await mkdir(output, { recursive: true });
let cached: Observation[] = [];
try {
  const saved = JSON.parse(await readFile(join(output, 'observations.json'), 'utf8'));
  if (saved.corpusSha256 === corpusSha256 && saved.rules === FORENSIC_VERSION && saved.modelMethod === modelMethod)
    cached = saved.observations;
} catch {
  /* A first evaluation has no cache. */
}
const observations: Observation[] = [...cached],
  byId = new Map(cached.map((o) => [o.document.id, o]));
for (const [index, document] of docs.entries()) {
  const bucket =
    Number.parseInt((await productionDigest(document.sourceGroup)).slice(0, 8), 16) % 100;
  const split = bucket < 60 ? 'development' : bucket < 80 ? 'calibration' : 'holdout';
  if ((split === 'holdout' && !holdout) || byId.has(document.id)) continue;
  const page = {
    id: '1',
    width: 0,
    height: 0,
    text: document.text,
    source: document.source,
    complete: true,
    lines: [],
    shapes: [],
  };
  const old = analyzeTextSignals(document.text, { source: document.source }),
    eligible = old.docKind !== 'code' && api.eligible(document.text);
  const prefix = eligible ? await api.score(document.text, { prefixOnly: true }) : null,
    estimate = eligible ? await api.score(document.text) : null;
  const report = await forensicReport(
    new TextEncoder().encode(document.text),
    [page],
    [],
    estimate?.windows
      ? [
          {
            page: '1',
            model: estimate.modelId,
            version: 'window-policy/3;onnx-cpu-basic',
            windows: estimate.windows,
            complete: !!estimate.complete,
            threshold: estimate.threshold,
            rawMean: estimate.probAi,
          },
        ]
      : []
  );
  const { text: _text, ...metadata } = document;
  observations.push({
    document: metadata,
    split,
    oldIndex: old.score / 100,
    newIndex: report.evidence.score / 100,
    oldRaw: prefix?.probAi ?? null,
    newRaw: estimate?.probAi ?? null,
    features: forensicFeatures(report),
    complete: !!estimate?.complete,
  });
  if (index % 50 === 0) {
    await writeFile(
      join(output, 'observations.json'),
      JSON.stringify({ corpusSha256, rules: FORENSIC_VERSION, modelMethod, observations })
    );
    console.log(`${index}/${docs.length} assessed`);
  }
}
await writeFile(
  join(output, 'observations.json'),
  JSON.stringify({ corpusSha256, rules: FORENSIC_VERSION, modelMethod, observations })
);
const eligible = observations.filter((o) => o.newRaw !== null && o.complete);
const development = eligible.filter((o) => o.split === 'development'),
  calibration = eligible.filter((o) => o.split === 'calibration'),
  test = eligible.filter((o) => o.split === 'holdout');
if (!development.length || !calibration.length)
  throw new Error('Not enough group-disjoint eligible development/calibration data.');
function wilson(k: number, n: number): [number, number] {
  if (!n) return [0, 1];
  const z = 1.96,
    p = k / n,
    d = 1 + (z * z) / n,
    c = (p + (z * z) / (2 * n)) / d,
    r = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, c - r), Math.min(1, c + r)];
}
const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z))));
const features = [...new Set(development.flatMap((o) => Object.keys(o.features)))].sort();
function fit(data: Observation[], keys: string[]) {
  const weights = keys.map(() => 0);
  let intercept = 0;
  const human = data.filter((o) => !o.document.label).length,
    ai = data.length - human;
  if (!human || !ai) throw new Error('Both labels are required in each fitting split.');
  for (let step = 0; step < 1200; step++) {
    const gradient = keys.map(() => 0);
    let gb = 0;
    for (const row of data) {
      const z =
          intercept + keys.reduce((sum, k, i) => sum + weights[i]! * (row.features[k] ?? 0), 0),
        error = ((sigmoid(z) - row.document.label) * 0.5) / (row.document.label ? ai : human);
      gb += error;
      keys.forEach((k, i) => {
        gradient[i] = gradient[i]! + error * (row.features[k] ?? 0);
      });
    }
    intercept -= 0.2 * gb;
    keys.forEach((_, i) => {
      weights[i] = weights[i]! - 0.2 * (gradient[i]! + 0.01 * weights[i]!);
    });
  }
  return {
    keys,
    weights,
    intercept,
    score: (row: Observation) =>
      sigmoid(
        intercept + keys.reduce((sum, k, i) => sum + weights[i]! * (row.features[k] ?? 0), 0)
      ),
  };
}
const fusion = fit(development, features),
  modelOnly = fit(development, ['model.rawMean']);
const calRows = calibration.map((o) => ({
  ...o,
  features: {
    logit: Math.log(Math.max(1e-8, fusion.score(o)) / Math.max(1e-8, 1 - fusion.score(o))),
  },
}));
const transform = fit(calRows, ['logit']);
const calibrated = (o: Observation) =>
  transform.score({
    ...o,
    features: {
      logit: Math.log(Math.max(1e-8, fusion.score(o)) / Math.max(1e-8, 1 - fusion.score(o))),
    },
  });
function operating(
  data: Observation[],
  score: (o: Observation) => number,
  reference: Observation[]
) {
  const humans = reference
    .filter((o) => !o.document.label)
    .map(score)
    .sort((a, b) => a - b);
  return [0.01, 0.05].map((target) => {
    const threshold =
      (humans[Math.min(humans.length - 1, Math.ceil((1 - target) * humans.length) - 1)] ?? 1) +
      Number.EPSILON;
    const negative = data.filter((o) => !o.document.label),
      positive = data.filter((o) => o.document.label),
      fp = negative.filter((o) => score(o) >= threshold).length,
      tp = positive.filter((o) => score(o) >= threshold).length;
    return {
      target,
      threshold,
      human: negative.length,
      ai: positive.length,
      falsePositives: fp,
      truePositives: tp,
      falsePositiveRate: fp / (negative.length || 1),
      falsePositive95: wilson(fp, negative.length),
      recall: tp / (positive.length || 1),
      recall95: wilson(tp, positive.length),
    };
  });
}
function reliability(data: Observation[], score: (o: Observation) => number) {
  const bins = Array.from({ length: 10 }, (_, i) => ({
    lower: i / 10,
    upper: (i + 1) / 10,
    count: 0,
    prediction: 0,
    positive: 0,
  }));
  let brier = 0,
    logLoss = 0;
  for (const o of data) {
    const p = Math.min(1 - 1e-8, Math.max(1e-8, score(o))),
      y = o.document.label,
      bin = bins[Math.min(9, Math.floor(p * 10))]!;
    bin.count++;
    bin.prediction += p;
    bin.positive += y;
    brier += (p - y) ** 2;
    logLoss -= y * Math.log(p) + (1 - y) * Math.log(1 - p);
  }
  const rows = bins.map((b) => ({
    ...b,
    prediction: b.count ? b.prediction / b.count : 0,
    positive: b.count ? b.positive / b.count : 0,
    positive95: wilson(b.positive, b.count),
  }));
  return {
    brier: brier / (data.length || 1),
    logLoss: logLoss / (data.length || 1),
    ece:
      rows.reduce((s, b) => s + b.count * Math.abs(b.prediction - b.positive), 0) /
      (data.length || 1),
    bins: rows,
  };
}
const baseline = {
  corpusSha256,
  rules: FORENSIC_VERSION,
  model: api.model()?.id,
  modelMethod,
  population:
    'RAID clean English scientific abstracts; older model families. Reference mixture is the sample composition, not deployment prevalence.',
  split:
    'SHA-256(sourceGroup) modulo 100: 0..59 development, 60..79 calibration, 80..99 holdout. All versions of one source remain together.',
  sample: {
    documents: docs.length,
    eligible: eligible.length,
    abstentions: observations.filter((o) => o.newRaw === null || !o.complete).length,
    development: development.length,
    calibration: calibration.length,
  },
  featureKeys: features,
  candidate: {
    weights: fusion.weights,
    intercept: fusion.intercept,
    calibrationSlope: transform.weights[0],
    calibrationIntercept: transform.intercept,
  },
  development: {
    oldIndex: operating(development, (o) => o.oldIndex, calibration),
    newIndex: operating(development, (o) => o.newIndex, calibration),
    oldPrefix: operating(development, (o) => o.oldRaw!, calibration),
    newWindows: operating(development, (o) => o.newRaw!, calibration),
    modelOnly: operating(development, modelOnly.score, calibration),
    fusion: operating(development, fusion.score, calibration),
    reliability: reliability(calibration, calibrated),
  },
  limitations: [
    'Not representative of creative files, mixed authorship, translated prose, OCR or current generators.',
    'Generator/template/creator disjointness beyond source groups is not established; pretrained exposure is unknown.',
    'Visual authorship ablation requires reviewed design history; these text documents cannot establish visual utility.',
    'No numeric probability is released.',
  ],
};
if (!holdout) {
  await writeFile(join(output, 'baseline.json'), JSON.stringify(baseline, null, 2));
  console.log(
    `Baseline digest ${await productionDigest(baseline)}. Freeze a preregistration.json before examining holdout.`
  );
} else {
  const preregistration = JSON.parse(await readFile(join(output, 'preregistration.json'), 'utf8'));
  const frozen = JSON.parse(await readFile(join(output, 'baseline.json'), 'utf8'));
  if (
    preregistration.baselineSha256 !== (await productionDigest(frozen)) ||
    preregistration.corpusSha256 !== corpusSha256 ||
    preregistration.rules !== FORENSIC_VERSION
  )
    throw new Error('Preregistration does not match the frozen baseline and corpus.');
  const results = {
    baselineSha256: await productionDigest(frozen),
    preregistrationSha256: await productionDigest(preregistration),
    holdoutSha256: await productionDigest(test.map((o) => o.document)),
    count: test.length,
    human: test.filter((o) => !o.document.label).length,
    ai: test.filter((o) => o.document.label).length,
    oldIndex: operating(test, (o) => o.oldIndex, calibration),
    newIndex: operating(test, (o) => o.newIndex, calibration),
    oldPrefix: operating(test, (o) => o.oldRaw!, calibration),
    newWindows: operating(test, (o) => o.newRaw!, calibration),
    modelOnly: operating(test, modelOnly.score, calibration),
    fusion: operating(test, fusion.score, calibration),
    reliability: reliability(test, calibrated),
    subgroups: Object.fromEntries(
      [...new Set(test.map((o) => o.document.generatorFamily))].map((f) => [
        f,
        {
          count: test.filter((o) => o.document.generatorFamily === f).length,
          operating: operating(
            test.filter((o) => o.document.generatorFamily === f),
            (o) => o.newRaw!,
            calibration
          ),
        },
      ])
    ),
    released: false,
    limitations: baseline.limitations,
  };
  await writeFile(join(output, 'holdout.json'), JSON.stringify(results, null, 2));
  const bins = results.reliability.bins;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="380" viewBox="0 0 520 380"><rect width="520" height="380" fill="white"/><path d="M50 20V330H490M50 330L490 20" stroke="#666" fill="none"/>${bins
    .filter((b) => b.count)
    .map(
      (b) =>
        `<circle cx="${50 + b.prediction * 440}" cy="${330 - b.positive * 310}" r="5" fill="#0068bd"/><text x="${50 + b.prediction * 440}" y="${320 - b.positive * 310}" font-size="11">n=${b.count}</text>`
    )
    .join(
      ''
    )}<text x="150" y="370">Predicted contribution (candidate only)</text><text x="55" y="18">Observed AI share</text></svg>`;
  await writeFile(join(output, 'reliability.svg'), svg);
  console.log(
    JSON.stringify({
      count: results.count,
      rawWindows: results.newWindows,
      reliability: results.reliability.ece,
      released: false,
    })
  );
}
