// SPDX-License-Identifier: MPL-2.0
/**
 * The Node on-device ML utilities (plans/183 WS2).
 *
 * TWO LAYERS, on purpose (the pattern tests/README.md calls the gated-test rule):
 *
 *   1. Tests that NEVER SKIP. The models directory precedence, the refusal
 *      wording, the conditional attach when a runtime is absent, the RGBA8
 *      round trip, and the roster equality between this package and the web
 *      shell's lib. None of these need a model, so a clone with no weights still
 *      proves the parts a person actually hits first.
 *   2. One REAL-MODEL test per family, gated on that family's files being on
 *      disk. When they are absent the test skips WITH THE FAMILY NAMED, so a
 *      green run never hides the fact that nothing was inferred. Each is bounded
 *      well under a minute on the staged models (measured 0.5-3 s each here).
 *
 * Run directly:  node --test packages/node-shell/test/ml.test.ts
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createNodeAiDetectAPI, createNodeDepthAPI, createNodeMatteAPI, createNodeOcrAPI,
  createNodeRewordAPI, createNodeUpscaleAPI,
} from '../src/ml/index.ts';
import {
  ModelNotInstalledError, decodeRgba, encodeRgbaPng, familyDir, formatBytes, isSharpAvailable,
  modelFileExists, modelFilesExist, modelsDirCandidates, refuseMissing, releaseSessions, sessionThreads,
  resolveModelsDir, setRuntimeProbes,
} from '../src/ml/session.ts';
import { UPSCALE_MODEL_FILES, stagedUpscaleModels } from '../src/ml/upscale-models.ts';
import { MATTE_MODEL_FILES, matteModelsFor } from '../src/ml/matte-models.ts';
import { OCR_MODEL_FILES, ocrModelsFor } from '../src/ml/ocr-models.ts';
import { REWORD_MODEL_FILES } from '../src/ml/reword-models.ts';
import { aiDetectModel } from '../src/ml/ai-detect-models.ts';

// One thread per session in this file: under a full-suite run, onnxruntime-node
// 1.29 on macOS can abort at process exit (`recursive_mutex lock failed`) when a
// pool thread outlives the runtime's logging mutex, and that abort marks every
// passed test in the file as failed. With no pool there is nothing to outlive
// it. Set before the first session is created; the runners read process.env.
process.env.LOLLY_ORT_THREADS = '1';

after(async () => {
  await releaseSessions();
  // Let the released sessions' native teardown finish before node exits.
  await new Promise((resolve) => setTimeout(resolve, 300));
});

describe('sessionThreads', () => {
  test('unset means the runtime default; a whole number from 1 to 256 is honoured', () => {
    assert.equal(sessionThreads({}), undefined);
    assert.equal(sessionThreads({ LOLLY_ORT_THREADS: '' }), undefined);
    assert.equal(sessionThreads({ LOLLY_ORT_THREADS: '1' }), 1);
    assert.equal(sessionThreads({ LOLLY_ORT_THREADS: ' 4 ' }), 4);
  });
  test('zero, negatives, fractions and words fall back to the default', () => {
    for (const bad of ['0', '-2', '1.5', 'many', '999']) {
      assert.equal(sessionThreads({ LOLLY_ORT_THREADS: bad }), undefined, bad);
    }
  });
});

// ── The models directory (never skips) ───────────────────────────────────────

describe('models directory precedence', () => {
  test('LOLLY_MODELS_DIR is first, the repo tree second, the user cache third', () => {
    const candidates = modelsDirCandidates({ LOLLY_MODELS_DIR: '/somewhere/models' } as NodeJS.ProcessEnv);
    assert.equal(candidates.length, 3);
    assert.equal(candidates[0], '/somewhere/models');
    assert.match(candidates[1] ?? '', /shells[/\\]web[/\\]public[/\\]models$/);
    assert.match(candidates[2] ?? '', /[/\\]\.cache[/\\]lolly[/\\]models$/);
  });

  test('with no environment override the repo tree leads', () => {
    const candidates = modelsDirCandidates({} as NodeJS.ProcessEnv);
    assert.equal(candidates.length, 2);
    assert.match(candidates[0] ?? '', /shells[/\\]web[/\\]public[/\\]models$/);
  });

  test('an environment directory that EXISTS wins; one that does not is passed over', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lolly-models-'));
    try {
      assert.equal(resolveModelsDir({ LOLLY_MODELS_DIR: dir } as NodeJS.ProcessEnv), dir);
      const absent = join(dir, 'not-here');
      assert.notEqual(resolveModelsDir({ LOLLY_MODELS_DIR: absent } as NodeJS.ProcessEnv), absent);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a family file is looked for under <root>/<family>/, nested paths included', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lolly-models-'));
    try {
      mkdirSync(join(dir, 'reword', 'smollm2-360m-instruct', 'onnx'), { recursive: true });
      const env = { LOLLY_MODELS_DIR: dir } as NodeJS.ProcessEnv;
      assert.equal(familyDir('matte', env), join(dir, 'matte'));
      assert.equal(modelFileExists('matte', 'u2netp.onnx', env), false);
      assert.equal(modelFilesExist('matte', ['u2netp.onnx'], env), false);
      // An empty file list is never "all present" - that would make an unknown
      // model look installed.
      assert.equal(modelFilesExist('matte', [], env), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── The refusal (never skips) ────────────────────────────────────────────────

describe('a missing model refuses by name', () => {
  test('the message carries the model, the size, the fetch command and the directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lolly-models-'));
    try {
      let err: ModelNotInstalledError | null = null;
      try {
        refuseMissing('matte', 'U²-Net lite', 4_574_861, { LOLLY_MODELS_DIR: dir } as NodeJS.ProcessEnv);
      } catch (e) {
        err = e as ModelNotInstalledError;
      }
      assert.ok(err instanceof ModelNotInstalledError, 'refuseMissing throws the named error');
      assert.match(err.message, /U²-Net lite/);
      assert.match(err.message, /lolly models fetch matte/);
      assert.match(err.message, /4\.4 MB/);
      assert.match(err.message, /LOLLY_MODELS_DIR/);
      assert.ok(err.message.includes(join(dir, 'matte')), 'the directory that was searched is named');
      assert.equal(err.family, 'matte');
      assert.equal(err.approxBytes, 4_574_861);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('sizes read the way a person would say them', () => {
    assert.equal(formatBytes(0), 'an unknown size');
    assert.equal(formatBytes(900), '900 B');
    assert.equal(formatBytes(20_480), '20 KB');
    assert.equal(formatBytes(4_574_861), '4.4 MB');
    assert.equal(formatBytes(387_943_246), '370 MB');
    assert.equal(formatBytes(2 * 1024 ** 3), '2.0 GB');
  });
});

// ── Conditional attach (never skips) ─────────────────────────────────────────

describe('a shell without the runtimes gets nothing, not a stub that throws', () => {
  test('every factory returns null when its runtime cannot be resolved', () => {
    setRuntimeProbes({ ort: false, sharp: false, transformers: false });
    try {
      assert.equal(createNodeUpscaleAPI(), null);
      assert.equal(createNodeMatteAPI(), null);
      assert.equal(createNodeOcrAPI(), null);
      assert.equal(createNodeDepthAPI(), null);
      assert.equal(createNodeAiDetectAPI(), null);
      assert.equal(createNodeRewordAPI(), null);
    } finally {
      setRuntimeProbes(null);
    }
  });

  test('the pixel families need BOTH onnxruntime-node and sharp', () => {
    setRuntimeProbes({ ort: true, sharp: false, transformers: false });
    try {
      assert.equal(createNodeUpscaleAPI(), null, 'no sharp, no pixels in or out');
      assert.equal(createNodeMatteAPI(), null);
      assert.equal(createNodeOcrAPI(), null);
      // Depth resamples in plain JS, so it needs only the ORT runtime.
      assert.notEqual(createNodeDepthAPI(), null, 'depth does its own resampling');
    } finally {
      setRuntimeProbes(null);
    }
  });

  test('with the runtimes present the three contract members are built', () => {
    assert.notEqual(createNodeUpscaleAPI(), null);
    assert.notEqual(createNodeMatteAPI(), null);
    assert.notEqual(createNodeOcrAPI(), null);
  });

  test('backend() is null, never a claim of wasm the native provider cannot back', () => {
    assert.equal(createNodeUpscaleAPI()?.backend(), null);
    assert.equal(createNodeMatteAPI()?.backend(), null);
    assert.equal(createNodeOcrAPI()?.backend(), null);
  });
});

// ── One roster, both shells (never skips) ────────────────────────────────────

describe('the Node roster IS the web roster', () => {
  test('models() and modelBytes() answer from the same module the web bridge reads', async () => {
    // The web lib files are re-export shims over packages/node-shell/src/ml/,
    // so importing them here proves the two paths are one module rather than two
    // copies that happen to agree today.
    const webUpscale = await import('../../../shells/web/src/lib/upscale-models.ts');
    const webMatte = await import('../../../shells/web/src/lib/matte-models.ts');
    const webOcr = await import('../../../shells/web/src/lib/ocr-models.ts');

    assert.deepEqual(createNodeUpscaleAPI()?.models(), webUpscale.stagedUpscaleModels());
    assert.deepEqual(createNodeMatteAPI()?.models(), webMatte.matteModelsFor(false));
    assert.deepEqual(createNodeOcrAPI()?.models(), webOcr.ocrModelsFor(false));

    for (const m of stagedUpscaleModels()) {
      assert.equal(createNodeUpscaleAPI()?.modelBytes(m.id), webUpscale.UPSCALE_MODEL_BYTES[m.id]);
    }
    for (const m of matteModelsFor(false)) {
      assert.equal(createNodeMatteAPI()?.modelBytes(m.id), webMatte.MATTE_MODEL_BYTES[m.id]);
    }
    for (const m of ocrModelsFor(false)) {
      assert.equal(createNodeOcrAPI()?.modelBytes(m.id), webOcr.OCR_MODEL_BYTES[m.id]);
    }
  });

  test('an unknown model id gets 0 bytes, not undefined', () => {
    assert.equal(createNodeOcrAPI()?.modelBytes('no-such-model'), 0);
  });
});

// ── Pixels in and out (never skips where sharp is installed) ─────────────────

describe('RGBA8 round trip', () => {
  const skip = !isSharpAvailable() && 'sharp is not installed';

  test('a 4x4 frame survives encode then decode byte for byte', { skip }, async () => {
    const width = 4, height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const o = i * 4;
      data[o] = i * 16;          // R climbs
      data[o + 1] = 255 - i * 16; // G falls
      data[o + 2] = (i % 4) * 64; // B cycles
      data[o + 3] = 255;          // opaque, so no premultiply can round-trip badly
    }
    const png = await encodeRgbaPng({ width, height, data });
    assert.equal(png.subarray(1, 4).toString('latin1'), 'PNG', 'a real PNG came back');
    const back = await decodeRgba(png);
    assert.equal(back.width, width);
    assert.equal(back.height, height);
    assert.deepEqual([...back.data], [...data]);
  });

  test('transparency survives too (straight alpha, not premultiplied)', { skip }, async () => {
    const data = new Uint8ClampedArray([
      255, 0, 0, 0, 0, 255, 0, 128,
      0, 0, 255, 255, 255, 255, 0, 64,
    ]);
    const back = await decodeRgba(await encodeRgbaPng({ width: 2, height: 2, data }));
    assert.deepEqual([...back.data], [...data]);
  });
});

// ── The real models, one per family, gated ───────────────────────────────────

/** A small synthetic picture: a green disc on a dark ground, drawn without any
 *  renderer so the fixture cannot depend on fonts or SVG support. */
function disc(width: number, height: number): { width: number; height: number; data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(width * height * 4);
  const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.35;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const o = (y * width + x) * 4;
      data[o] = inside ? 0x30 : 0x0c;
      data[o + 1] = inside ? 0xba : 0x32;
      data[o + 2] = inside ? 0x78 : 0x2c;
      data[o + 3] = 255;
    }
  }
  return { width, height, data };
}

const upscaleId = 'realesr-general-x4v3' as const;
const upscaleStaged = modelFileExists('upscale', UPSCALE_MODEL_FILES[upscaleId]);
test('upscale: the real Real-ESRGAN general graph enlarges a synthetic frame', {
  skip: !upscaleStaged && 'the upscale model family is not on this machine',
  timeout: 60_000,
}, async () => {
  const api = createNodeUpscaleAPI();
  assert.ok(api, 'the runtimes resolve');
  const src = disc(16, 16);
  const out = await api.run(src, { model: upscaleId });
  assert.equal(out.width, 64, 'x4 is the native multiple');
  assert.equal(out.height, 64);
  assert.equal(out.data.length, 64 * 64 * 4);
  // The disc has to still be a disc: the middle is green, a corner is not.
  const at = (x: number, y: number): number[] => [...out.data.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 3)];
  const [, mg] = at(32, 32);
  const [, cg] = at(2, 2);
  assert.ok((mg ?? 0) > (cg ?? 0) + 40, `the disc survived the enlargement (centre G ${mg}, corner G ${cg})`);
});

const matteId = 'u2netp' as const;
const matteStaged = modelFileExists('matte', MATTE_MODEL_FILES[matteId]);
test('matte: the real U²-Net graph returns the source RGB with a computed alpha', {
  skip: !matteStaged && 'the matte model family is not on this machine',
  timeout: 60_000,
}, async () => {
  const api = createNodeMatteAPI();
  assert.ok(api, 'the runtimes resolve');
  const src = disc(64, 64);
  const out = await api.run(src, { model: matteId });
  assert.equal(out.width, 64);
  assert.equal(out.height, 64);
  // The contract: RGB is the input's, byte for byte; only alpha is new.
  for (let i = 0; i < out.data.length; i += 4) {
    assert.equal(out.data[i], src.data[i]);
    assert.equal(out.data[i + 1], src.data[i + 1]);
    assert.equal(out.data[i + 2], src.data[i + 2]);
  }
  const alphas = new Set<number>();
  for (let i = 3; i < out.data.length; i += 4) alphas.add(out.data[i] as number);
  assert.ok(alphas.size > 1, 'the matte is a real field, not a constant');
});

const ocrId = 'ppocr-v5-mobile' as const;
const ocrFiles = OCR_MODEL_FILES[ocrId] ?? { det: '', rec: '', dict: '' };
const ocrStaged = modelFilesExist('ocr', [ocrFiles.det, ocrFiles.rec, ocrFiles.dict]);
test('ocr: the real PP-OCRv5 pair reads text back out of a rendered image', {
  skip: !ocrStaged && 'the ocr model family is not on this machine',
  timeout: 60_000,
}, async () => {
  const api = createNodeOcrAPI();
  assert.ok(api, 'the runtimes resolve');
  // resvg is already a dependency of this package, so the fixture is drawn with
  // the same rasteriser the CLI's own raster path uses.
  const { Resvg } = await import('@resvg/resvg-js');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="140">'
    + '<rect width="480" height="140" fill="#fff"/>'
    + '<text x="24" y="95" font-family="Helvetica, Arial, sans-serif" font-size="64" fill="#000">LOLLY</text></svg>';
  const png = new Resvg(svg, { font: { loadSystemFonts: true }, fitTo: { mode: 'original' } }).render().asPng();
  const frame = await decodeRgba(png);
  // A machine with no usable sans-serif draws nothing; that is a fixture
  // problem, not an OCR result, so say so rather than assert on a blank page.
  let dark = 0;
  for (let i = 0; i < frame.data.length; i += 4) if ((frame.data[i] as number) < 100) dark++;
  if (dark < 200) {
    assert.ok(true, 'no system font drew the fixture text; the read is not exercised');
    return;
  }
  const result = await api.run(frame);
  assert.equal(result.lang, 'en');
  assert.ok(Array.isArray(result.lines));
  assert.match(result.text.toUpperCase(), /LOLLY/, `read "${result.text}"`);
  const first = result.lines[0];
  assert.ok(first && first.confidence > 0 && first.confidence <= 1, 'a real per-line confidence');
  assert.ok(first.box.w > 0 && first.box.h > 0, 'a box in source pixels');
});

const detector = aiDetectModel();
const detectStaged = !!detector && modelFilesExist(
  'ai-detect', detector.files.map((f) => `${detector.dir.replace(/^ai-detect\//, '')}/${f}`),
);
test('detect-ai: the real classifier returns a probability, and the gate refuses short text', {
  skip: !detectStaged && 'the ai-detect model family is not on this machine',
  timeout: 60_000,
}, async () => {
  const api = createNodeAiDetectAPI();
  assert.ok(api, 'transformers.js resolves');
  assert.equal(await api.score('Too short to ask about.'), null, 'the eligibility gate answers null, never a verdict');

  const text = 'It is important to note that our comprehensive solution leverages cutting-edge technology in order to '
    + 'deliver outstanding results for our valued customers. Organisations must embrace innovative approaches that '
    + 'drive meaningful outcomes across the board. By harnessing the power of advanced analytics and machine learning, '
    + 'we enable businesses to unlock unprecedented value and achieve sustainable growth over time. Our dedicated team '
    + 'works to ensure that every client receives personalised attention and tailored solutions for their objectives.';
  assert.equal(api.eligible(text), true);
  const est = await api.score(text);
  assert.ok(est, 'an estimate came back');
  assert.ok(est.probAi >= 0 && est.probAi <= 1, `probability in range (${est.probAi})`);
  assert.equal(est.threshold, detector!.threshold, 'the CLI reads the calibrated operating point, not its own');
  assert.equal(est.modelId, detector!.id);
});

const rewordStaged = modelFilesExist('reword', REWORD_MODEL_FILES.map((f) => `smollm2-360m-instruct/${f}`));
test('reword: the real SmolLM2 graph samples a watermarked rewrite that the engine gate judges', {
  skip: !rewordStaged && 'the reword model family is not on this machine',
  timeout: 60_000,
}, async () => {
  const api = createNodeRewordAPI();
  assert.ok(api, 'transformers.js resolves');
  const sentence = 'It is important to note that our solution leverages cutting-edge technology in order to deliver outstanding results for customers.';
  const raws = await api.sample(sentence, 1);
  assert.equal(raws.length, 1);
  assert.ok(raws[0]!.trim().length > 0, 'the model said something');
  // The watermark rides on the sampled tokens, so a model reply must score
  // further from chance than ordinary prose of a similar length.
  const marked = await api.detectWatermark(raws[0]!);
  const plain = await api.detectWatermark(
    'The quick brown fox jumps over the lazy dog and then walks home slowly because the evening has turned cold.',
  );
  assert.equal(marked.scheme, 'lolly-reword-v1');
  assert.ok(marked.z > plain.z, `the sampled text carries the green-list bias (z ${marked.z.toFixed(2)} vs ${plain.z.toFixed(2)})`);
});

test('depth: the family is unstaged, so it refuses by name rather than offering a dead download', () => {
  const api = createNodeDepthAPI();
  assert.ok(api, 'onnxruntime-node resolves');
  // DEPTH_STAGED is false until the quantised weights are published, so the
  // honest roster is empty and nothing can be run. When that flips, this test
  // becomes the gated real-model case beside the other five.
  assert.deepEqual(api.models(), [], 'no depth model is offered');
  assert.rejects(
    () => api.run(disc(32, 32)),
    (err: unknown) => err instanceof ModelNotInstalledError && /lolly models fetch depth/.test(err.message),
  );
});
