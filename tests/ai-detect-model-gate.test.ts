// SPDX-License-Identifier: MPL-2.0
/**
 * The staged AI-text detector vs the FP corpus - gate step 6, made permanent.
 *
 * GATED: the model files are gitignored (vendored by
 * scripts/fetch-ai-detect-models.ts), so on a clone without them every test
 * here skips. With them present, the REAL quantized graph runs over the same
 * fixtures tests/text-signals-corpus.test.ts pins, through the same engine
 * fold the views use - so a model upgrade, a re-quantization or a threshold
 * edit cannot silently start convicting the corpus's humans. The non-native
 * English sample is the one that matters most: detector models are documented
 * to over-score exactly that writing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeTextSignals, applyModelEstimate } from '../engine/src/text-signals.ts';
import { aiDetectModel } from '../shells/web/src/lib/ai-detect-models.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_DIR = join(ROOT, 'shells/web/public/models');
const model = aiDetectModel();
const staged = model !== null
  && existsSync(join(MODELS_DIR, model.dir, 'onnx', 'model_quantized.onnx'));

/** The corpus fixtures, split at the AI-shaped marker - the same strings the
 *  FP contract pins, lifted from the source so new samples are covered here
 *  automatically. Concatenated '+'-joined single-quoted literals. */
function corpusFixtures(): { human: string[]; ai: string[] } {
  const src = readFileSync(join(ROOT, 'tests/text-signals-corpus.test.ts'), 'utf8');
  // The section BANNER, not the bare phrase - the header prose mentions
  // "AI-shaped samples" too, which would split before every fixture.
  const split = src.indexOf('── AI-shaped samples');
  assert.ok(split > 0, 'the corpus AI-shaped section banner moved');
  const human: string[] = [];
  const ai: string[] = [];
  const re = /const text =\s*((?:'(?:[^'\\]|\\.)*'\s*\+?\s*)+);/g;
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    const parts = [...m[1]!.matchAll(/'((?:[^'\\]|\\.)*)'/g)]
      .map((p) => p[1]!.replace(/\\'/g, "'").replace(/\\n/g, '\n'));
    (m.index < split ? human : ai).push(parts.join(''));
  }
  return { human, ai };
}

test('staged detector honours the FP corpus contract', { skip: !staged && 'ai-detect model not staged locally' }, async () => {
  const m = model!;
  const { env, AutoTokenizer, AutoModelForSequenceClassification } = await import('@huggingface/transformers');
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = `${MODELS_DIR}/`;
  const [tokenizer, classifier] = await Promise.all([
    AutoTokenizer.from_pretrained(m.dir),
    AutoModelForSequenceClassification.from_pretrained(m.dir, { dtype: 'q8' }),
  ]);

  // Gate 5: the staged config's labels resolve the AI side by NAME.
  const id2label = (classifier as unknown as { config: { id2label?: Record<string, string> } }).config.id2label ?? {};
  const aiIndex = Object.entries(id2label).find(([, v]) => m.aiLabel.test(v))?.[0];
  assert.ok(aiIndex !== undefined, `no id2label entry matches ${m.aiLabel} in ${JSON.stringify(id2label)}`);

  const probAi = async (text: string): Promise<number> => {
    const inputs = (tokenizer as unknown as (t: string, o: object) => Record<string, unknown>)(
      text, { truncation: true, max_length: m.maxTokens },
    );
    const { logits } = await (classifier as unknown as (i: Record<string, unknown>) => Promise<{ logits: { data: Float32Array } }>)(inputs);
    const row = [...logits.data];
    const max = Math.max(...row);
    const exps = row.map((v) => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps[Number(aiIndex)]! / sum;
  };

  const { human, ai } = corpusFixtures();
  assert.ok(human.length >= 4 && ai.length >= 2, `corpus extraction broke: ${human.length} human, ${ai.length} ai`);

  // Every pinned-human fixture stays below the operating point, and the full
  // engine fold keeps its band at the corpus ceiling.
  for (const text of human) {
    const p = await probAi(text);
    assert.ok(p < m.threshold, `human fixture fired at ${p.toFixed(4)} (threshold ${m.threshold}): ${text.slice(0, 60)}`);
    const folded = applyModelEstimate(analyzeTextSignals(text, { source: 'digital' }), {
      probAi: p, threshold: m.threshold, modelId: m.id, modelName: m.name,
    });
    assert.ok(folded.band === 'none' || folded.band === 'weak',
      `human fixture band ${folded.band} after the fold: ${text.slice(0, 60)}`);
  }

  // The detector must still be worth shipping: at least one pinned-AI fixture
  // clears the threshold with room (measured 0.88-0.93 at staging).
  const aiScores = await Promise.all(ai.map(probAi));
  assert.ok(aiScores.some((p) => p >= m.threshold + 0.1),
    `no AI fixture cleared threshold+0.1: ${aiScores.map((p) => p.toFixed(3)).join(', ')}`);
});
