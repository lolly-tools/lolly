// SPDX-License-Identifier: MPL-2.0
/** Evaluate the production recommendation contract against the private corpus cache. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { censusDeck } from '../../engine/src/deck-census.ts';
import { firstPass } from '../../engine/src/rebrand-plan.ts';
import { recommendLayoutOptions, layoutOptionCatalog, layoutOptionQuery } from '../../engine/src/rebrand-layout-options.ts';
import { pipelineAlgorithms, themeFactsOf } from '../../packages/node-shell/src/rebrand/pipeline.ts';
import { resolveProfileDesignSystem } from '../../packages/node-shell/src/rebrand/design-system.ts';
import type { SlideSourceV1, SourceDeckV1 } from '../../packages/core/src/rebrand-v1.ts';
import { resolveModelsDir } from '../../packages/node-shell/src/ml/session.ts';

const root = path.resolve(process.argv[2] ?? '.scratch/layout-lab/real');
const profile = process.argv[3] ?? 'lolly-start';
const resolved = await resolveProfileDesignSystem({ profile });
if (!resolved || resolved.profile !== profile) throw new Error(`Design system unavailable: ${profile}`);
const { system } = resolved;
const useModel = process.argv.includes('--model');
interface Extractor {
  (text: string, opts: { pooling: 'mean'; normalize: boolean }): Promise<{ data: Float32Array }>;
  dispose(): Promise<void>;
}
let extractor: Extractor | undefined;
const vectors = new Map<string, Float32Array>();
if (useModel) {
  const requireTf = createRequire(new URL('../../packages/node-shell/package.json', import.meta.url));
  const tf = requireTf('@huggingface/transformers');
  tf.env.allowRemoteModels = false; tf.env.allowLocalModels = true; tf.env.localModelPath = `${resolveModelsDir()}/`;
  extractor = await tf.pipeline('feature-extraction', 'embed', { dtype: 'q8', device: 'cpu', session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 } }) as Extractor;
  for (const item of layoutOptionCatalog(system.input.master)) vectors.set(item.id, (await extractor(item.description, { pooling: 'mean', normalize: true })).data);
}
const json = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
const rows: Array<Record<string, unknown>> = [];
for (const hash of readdirSync(root).filter(name => /^[0-9a-f]{16}$/.test(name)).sort()) {
  const dir = path.join(root, hash);
  const source = json<SourceDeckV1>(path.join(dir, 'source.json'));
  const ocrFile = readdirSync(dir).find(name => /^ocr-.*\.json$/.test(name));
  const ocr = ocrFile ? json<Record<string, { slide: SlideSourceV1 }>>(path.join(dir, ocrFile)) : {};
  source.slides = source.slides.map(slide => ocr[slide.id]?.slide ?? slide);
  const census = censusDeck(source);
  const plan = firstPass({ source, census, designSystem: system.firstPass, algorithms: pipelineAlgorithms(source.source.kind), ...themeFactsOf(system) });
  for (const slide of source.slides) {
    const start = performance.now();
    const input = { source: { ...source, slides: [slide] }, plan: { ...plan, slides: plan.slides.filter(row => row.id === slide.id) }, census, system };
    let semantic: Record<string, number> | undefined;
    if (extractor) {
      const query = (await extractor(layoutOptionQuery(input.source, input.plan), { pooling: 'mean', normalize: true })).data;
      semantic = Object.fromEntries([...vectors].map(([id, vector]) => [id, query.reduce((sum, n, i) => sum + n * vector[i]!, 0)]));
    }
    const result = await recommendLayoutOptions({ ...input, semantic });
    rows.push({ id: `${hash}-p${slide.index + 1}`, deck: source.source.name, slide: slide.index + 1, ocr: Boolean(slide.recovery), ms: Math.round(performance.now() - start), checked: result.checked,
      options: result.options.map(({ id, frameCount, keptObjects }) => ({ id, frameCount, keptObjects })), rejected: result.rejected });
  }
  console.log(`${source.source.name}: ${rows.filter(r => r.deck === source.source.name && (r.options as unknown[]).length).length}/${source.slides.length} with checked choices`);
  writeFileSync(path.join(root, `recommendations-${profile}${useModel ? '-embed' : ''}.json`), JSON.stringify({ profile, useModel, rows }, null, 2));
}
const withOptions = rows.filter(r => (r.options as unknown[]).length);
const times = rows.map(r => r.ms as number).sort((a, b) => a - b);
console.log(JSON.stringify({ slides: rows.length, withOptions: withOptions.length, ocrWithOptions: withOptions.filter(r => r.ocr).length, medianMs: times[Math.floor(times.length / 2)], p95Ms: times[Math.floor(times.length * .95)] }));
await extractor?.dispose();
