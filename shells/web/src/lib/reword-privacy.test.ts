// SPDX-License-Identifier: MPL-2.0
/**
 * Reword-privacy DRIFT GUARD - a static source-scan of the reword worker, in
 * the speech-kokoro-privacy.test.ts mould. The "no text ever leaves the
 * device" promise rides on three assignments in lib/reword-worker.ts, and no
 * runtime unit test can see them (the worker needs transformers.js and a wasm
 * runtime to even import). A transformers.js upgrade or an innocent refactor
 * must not silently re-enable huggingface.co fetches.
 *
 * Run directly:  node --test shells/web/src/lib/reword-privacy.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(LIB_DIR, 'reword-worker.ts'), 'utf8');

describe('reword worker privacy pins', () => {
  test('remote models stay disabled outright', () => {
    assert.match(src, /env\.allowRemoteModels\s*=\s*false/,
      'the worker must set env.allowRemoteModels = false');
  });

  test('models load from `${MODELS_BASE}/models/` (same-origin on the web build)', () => {
    // MODELS_BASE is a build-time constant: '' on the web build → same-origin
    // '/models/' (byte-identical to before), overridable via VITE_MODELS_BASE ONLY
    // for a shell that self-hosts the weights elsewhere (the desktop app points it
    // at https://lolly.tools). This moves only WHERE the static model file is
    // fetched from; no text ever leaves the device, and the HF hub stays off
    // (allowRemoteModels = false, asserted above).
    assert.match(src, /env\.localModelPath\s*=\s*`\$\{MODELS_BASE\}\/models\//,
      'the worker must set env.localModelPath = `${MODELS_BASE}/models/`');
    assert.match(src, /import\s*\{\s*MODELS_BASE\s*\}\s*from\s*'\.\/models-base\.ts'/,
      'MODELS_BASE must be imported from ./models-base.ts');
    const basePath = join(LIB_DIR, 'models-base.ts');
    assert.ok(existsSync(basePath), 'models-base.ts must exist');
    const baseSrc = readFileSync(basePath, 'utf8');
    assert.match(baseSrc, /VITE_MODELS_BASE\s*\?\?\s*''/,
      "MODELS_BASE must default to '' (same-origin) when VITE_MODELS_BASE is unset");
  });

  test('the ONNX wasm runtime loads same-origin', () => {
    const m = src.match(/\.wasmPaths\s*=\s*([^;\n]+)/);
    assert.ok(m, 'the worker must set wasmPaths');
    const rhs = m![1]!.trim();
    if (/^['"]/.test(rhs)) {
      assert.match(rhs, /^['"]\/[^'"]*['"]$/, `wasmPaths literal must start with '/' (got ${rhs})`);
    } else {
      assert.equal(rhs, 'ORT_HF_BASE', `wasmPaths must be a same-origin literal or ORT_HF_BASE (got ${rhs})`);
      assert.match(src, /import\s*\{\s*ORT_HF_BASE\s*\}\s*from\s*'\.\/ort-hf-base\.ts'/,
        'ORT_HF_BASE must come from ./ort-hf-base.ts');
      const basePath = join(LIB_DIR, 'ort-hf-base.ts');
      assert.ok(existsSync(basePath), 'ort-hf-base.ts must exist (scripts/copy-transformers-ort.ts generates it)');
      assert.match(readFileSync(basePath, 'utf8'), /ORT_HF_BASE\s*=\s*'\/[^']*'/,
        "ORT_HF_BASE must be an origin-relative path starting with '/'");
    }
  });

  test('no huggingface.co (or any absolute http URL) in the worker source', () => {
    assert.ok(!src.includes('huggingface.co'), 'no huggingface.co reference');
    assert.ok(!/https?:\/\//.test(src.replace(/^\s*\*.*$/gm, '').replace(/\/\/.*$/gm, '')),
      'no absolute http(s) URL outside comments');
  });
});
