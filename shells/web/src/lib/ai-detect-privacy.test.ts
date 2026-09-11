// SPDX-License-Identifier: MPL-2.0
/**
 * AI-detect privacy DRIFT GUARD - a static source-scan of the detector worker,
 * in the reword-privacy.test.ts mould. The "no text ever leaves the device"
 * promise rides on the same three assignments, and no runtime unit test can
 * see them (the worker needs transformers.js and a wasm runtime to import).
 *
 * Run directly:  node --test shells/web/src/lib/ai-detect-privacy.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(LIB_DIR, 'ai-detect-worker.ts'), 'utf8');

describe('ai-detect worker privacy pins', () => {
  test('remote models stay disabled outright', () => {
    assert.match(src, /env\.allowRemoteModels\s*=\s*false/,
      'the worker must set env.allowRemoteModels = false');
  });

  test('models load from `${MODELS_BASE}/models/` and the wasm runtime from ORT_HF_BASE', () => {
    assert.match(src, /env\.localModelPath\s*=\s*`\$\{MODELS_BASE\}\/models\//,
      'the worker must set env.localModelPath = `${MODELS_BASE}/models/`');
    assert.match(src, /import\s*\{\s*MODELS_BASE\s*\}\s*from\s*'\.\/models-base\.ts'/,
      'MODELS_BASE must be imported from ./models-base.ts');
    assert.match(src, /\.wasmPaths\s*=\s*ORT_HF_BASE/,
      'the worker must point wasmPaths at ORT_HF_BASE');
    assert.match(src, /import\s*\{\s*ORT_HF_BASE\s*\}\s*from\s*'\.\/ort-hf-base\.ts'/,
      'ORT_HF_BASE must come from ./ort-hf-base.ts');
  });

  test('no huggingface.co (or any absolute http URL) in the worker source', () => {
    assert.ok(!src.includes('huggingface.co'), 'no huggingface.co reference');
    assert.ok(!/https?:\/\//.test(src.replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '')),
      'no absolute http(s) URL outside comments');
  });
});
