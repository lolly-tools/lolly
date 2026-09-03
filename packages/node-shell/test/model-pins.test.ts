// SPDX-License-Identifier: MPL-2.0
/**
 * Drift guard for `packages/node-shell/src/ml/model-pins.ts`.
 *
 * Those pins are a SECOND COPY of the PINS tables in
 * scripts/fetch-{upscale,matte,ocr,ai-detect,reword,depth}-models.ts. The
 * scripts run `main()` at module scope, so importing one would start a download
 * and they cannot be read as data - the same problem SPEECH_MODEL_FILES has, and
 * the same answer: parse the script text and compare, one test per family, so a
 * pin refreshed in one place and not the other fails here rather than at a
 * user's `lolly models fetch`.
 *
 * Nothing in this file touches the network. What the MIRROR serves was checked
 * by hand when the pins were written (every file downloaded from
 * https://lolli.li/models/<family>/ and hashed, 2026-09-03); a test that
 * re-downloaded 900 MB on every run would not be a test.
 *
 * Run with: node --test packages/node-shell/test/model-pins.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ML_MODEL_FILES } from '../src/ml/model-pins.ts';
import type { MlModelFamily } from '../src/ml/model-pins.ts';
import { pinnedBytes } from '../src/models-dir.ts';
import { AI_DETECT_MODELS, AI_DETECT_STAGED } from '../src/ml/ai-detect-models.ts';
import { REWORD_MODEL_BYTES, REWORD_MODEL_FILES, REWORD_MODEL_ID } from '../src/ml/reword-models.ts';
import { UPSCALE_MODEL_FILES, UPSCALE_STAGED } from '../src/ml/upscale-models.ts';
import { MATTE_MODEL_FILES } from '../src/ml/matte-models.ts';
import { OCR_MODEL_FILES } from '../src/ml/ocr-models.ts';

const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');

interface ScriptPin {
  sha256: string | null;
  bytes: number | null;
}

/**
 * Pull a fetch script's PINS table out of its source. Entry values are object
 * literals whose fields are in no fixed order and may carry comments, so the
 * keys are found by regex and each value is read by walking its braces.
 * A value that is a helper CALL rather than a literal (the ai-detect
 * placeholders) has no braces to walk and is skipped, which is correct: those
 * carry no verified pin.
 */
function pinsFromScript(rel: string): Map<string, ScriptPin> {
  const src = readFileSync(join(REPO, rel), 'utf8');
  const start = src.indexOf('const PINS');
  assert.ok(start >= 0, `${rel}: no PINS table`);
  const out = new Map<string, ScriptPin>();
  for (const m of src.slice(start).matchAll(/'([^']+)':\s*\{/g)) {
    const key = m[1] as string;
    const open = start + (m.index ?? 0) + (m[0] as string).length - 1;
    let depth = 0;
    let end = open;
    for (let i = open; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    const body = src.slice(open, end + 1);
    const sha = /sha256:\s*'([0-9a-f]{64})'/.exec(body);
    const bytes = /bytes:\s*([\d_]+)/.exec(body);
    out.set(key, {
      sha256: sha ? (sha[1] as string) : null,
      bytes: bytes ? Number((bytes[1] as string).replace(/_/g, '')) : null,
    });
  }
  return out;
}

/** The subset of a script's table that carries a real (non-placeholder) pin. */
function verifiedPins(rel: string): Map<string, { sha256: string; bytes: number }> {
  const out = new Map<string, { sha256: string; bytes: number }>();
  for (const [key, pin] of pinsFromScript(rel)) {
    if (pin.sha256 && pin.bytes != null) out.set(key, { sha256: pin.sha256, bytes: pin.bytes });
  }
  return out;
}

/** Every registered file of a family matches the script's pin for it, apart from
 *  any path the caller exempts (which then needs its own provenance check). */
function assertMatches(
  family: MlModelFamily, rel: string, keyOf: (path: string) => string, exempt: ReadonlySet<string> = new Set(),
): void {
  const pins = verifiedPins(rel);
  for (const file of ML_MODEL_FILES[family].files) {
    if (exempt.has(file.path)) continue;
    const pin = pins.get(keyOf(file.path));
    assert.ok(pin, `${family}/${file.path} has no verified pin in ${rel}`);
    assert.equal(file.sha256, pin.sha256, `${family}/${file.path} sha256`);
    assert.equal(file.bytes, pin.bytes, `${family}/${file.path} bytes`);
  }
}

describe('the ML pin tables match the fetch scripts', () => {
  test('upscale', () => {
    const script = 'scripts/fetch-upscale-models.ts';
    const registered = new Set(ML_MODEL_FILES.upscale.files.map((f) => f.path));

    // The anime model is the one file with no fetch-script pin: it has no
    // published ONNX mirror and is converted on-device, so its provenance is
    // scripts/convert-anime-upscale-onnx.py and the CREDITS-anime.txt that
    // script writes. Everything else must match the fetch script exactly.
    const ANIME = 'realesrgan-x4plus-anime.onnx';
    assert.ok(registered.has(ANIME), 'the anime model is staged, so a fetch must stage it');
    assert.ok(
      !verifiedPins(script).has(ANIME),
      `${script} now pins ${ANIME}: read the pin from there instead of carrying it here`,
    );
    const converter = readFileSync(join(REPO, 'scripts/convert-anime-upscale-onnx.py'), 'utf8');
    assert.ok(converter.includes(ANIME), 'the converter still writes the file this pin describes');

    assertMatches('upscale', script, (p) => p, new Set([ANIME]));
    // ...which the line above would also pass by registering nothing, so pin the
    // set itself: every model UPSCALE_STAGED offers, plus the face detector.
    for (const [id, staged] of Object.entries(UPSCALE_STAGED)) {
      const file = UPSCALE_MODEL_FILES[id as keyof typeof UPSCALE_MODEL_FILES];
      assert.equal(
        registered.has(file), staged,
        `${file} is ${staged ? 'staged but not registered' : 'registered but not staged'}`,
      );
    }
    assert.ok(registered.has('face-detect.onnx'), 'the GFPGAN face detector is pinned and published');
    // The denoise partner is a PLACEHOLDER pin: offering it would promise a
    // download that can only 404.
    assert.ok(!registered.has('realesr-general-wdn-x4v3.onnx'), 'the WDN partner has no verified pin');
  });

  test('matte', () => {
    assertMatches('matte', 'scripts/fetch-matte-models.ts', (p) => p);
    const registered = new Set(ML_MODEL_FILES.matte.files.map((f) => f.path));
    for (const file of Object.values(MATTE_MODEL_FILES)) {
      assert.ok(registered.has(file), `${file} is on the matte roster but not registered`);
    }
  });

  test('ocr', () => {
    assertMatches('ocr', 'scripts/fetch-ocr-models.ts', (p) => p);
    const registered = new Set(ML_MODEL_FILES.ocr.files.map((f) => f.path));
    for (const set of Object.values(OCR_MODEL_FILES)) {
      for (const file of [set.det, set.rec, set.dict]) {
        assert.ok(registered.has(file), `${file} is on the OCR roster but not registered`);
      }
    }
  });

  test('ai-detect', () => {
    // The script's keys are already family-relative (<roster dir>/<file>).
    assertMatches('ai-detect', 'scripts/fetch-ai-detect-models.ts', (p) => p);
    const registered = new Set(ML_MODEL_FILES['ai-detect'].files.map((f) => f.path));
    for (const model of AI_DETECT_MODELS) {
      const prefix = model.dir.replace(/^ai-detect\//, '');
      for (const file of model.files) {
        const path = `${prefix}/${file}`;
        assert.equal(
          registered.has(path), AI_DETECT_STAGED[model.id] === true,
          `${path}: registration must follow AI_DETECT_STAGED`,
        );
      }
    }
    // The roster's consent size is the sum of exactly these files.
    const staged = AI_DETECT_MODELS.find((m) => AI_DETECT_STAGED[m.id]);
    assert.ok(staged);
    assert.equal(pinnedBytes(ML_MODEL_FILES['ai-detect'].files), staged.bytes);
  });

  test('reword', () => {
    // The script writes into models/reword/<REWORD_MODEL_ID>/, so its keys are
    // one directory shallower than the family-relative paths.
    assertMatches('reword', 'scripts/fetch-reword-models.ts', (p) => p.replace(`${REWORD_MODEL_ID}/`, ''));
    const registered = new Set(ML_MODEL_FILES.reword.files.map((f) => f.path));
    for (const file of REWORD_MODEL_FILES) {
      assert.ok(registered.has(`${REWORD_MODEL_ID}/${file}`), `${file} is on the reword roster but not registered`);
    }
    assert.equal(registered.size, REWORD_MODEL_FILES.length, 'no extra reword files');
    assert.equal(pinnedBytes(ML_MODEL_FILES.reword.files), REWORD_MODEL_BYTES, 'the consent size is the sum');
  });

  test('depth is registered as unpublished, not as an empty family', () => {
    const pins = pinsFromScript('scripts/fetch-depth-models.ts');
    assert.ok(pins.size > 0, 'the depth fetch script still has a table');
    for (const [file, pin] of pins) {
      assert.equal(pin.sha256, null, `${file} now has a real pin - register the depth family and drop the refusal`);
    }
    assert.equal(ML_MODEL_FILES.depth.files.length, 0);
    assert.ok(ML_MODEL_FILES.depth.unpublished, 'an unpublished family says why');
    assert.match(ML_MODEL_FILES.depth.unpublished, /PLACEHOLDER/);
  });
});

describe('the pins describe the files staged in this checkout', () => {
  // Only meaningful where the weights are actually here. Where they are not, a
  // skip is honest: the pin tables above are still compared to the scripts.
  const root = join(REPO, 'shells', 'web', 'public', 'models');
  const families: MlModelFamily[] = ['upscale', 'matte', 'ocr', 'ai-detect', 'reword'];
  for (const family of families) {
    const files = ML_MODEL_FILES[family].files;
    const dir = join(root, family);
    const staged = files.every((f) => existsSync(join(dir, ...f.path.split('/'))));
    test(`${family}: every staged file is the size its pin claims`, { skip: staged ? false : `${family} is not staged under ${dir}` }, () => {
      for (const pin of files) {
        const path = join(dir, ...pin.path.split('/'));
        assert.equal(readFileSync(path).byteLength, pin.bytes, `${family}/${pin.path}`);
      }
    });
  }

  test('the anime pin matches what the converter recorded', () => {
    const credits = join(root, 'upscale', 'CREDITS-anime.txt');
    if (!existsSync(credits)) return; // never converted here; the pin still stands
    const pin = ML_MODEL_FILES.upscale.files.find((f) => f.path === 'realesrgan-x4plus-anime.onnx');
    assert.ok(pin);
    assert.match(readFileSync(credits, 'utf8'), new RegExp(`ONNX sha256:${pin.sha256}`));
  });
});
