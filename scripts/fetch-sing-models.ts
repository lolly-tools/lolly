#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Downloads the models rondocode's sing() needs into shells/web/public/models/sing/,
 * the tree scripts/upload-models.ts publishes to the model host (lolli.li/models/sing/).
 *
 * ANDY-RUN ONLY, and NOT part of `node scripts/vendor-models.ts` with no arguments:
 * the family is about 2.9 GB, so it is fetched only on request
 * (`node scripts/vendor-models.ts --only=sing` or this script). In the app the same
 * rule holds: the singing models are a named opt-in in Profile and an in-place offer
 * when a song sings, never part of a "download everything" sweep (Andy, 2026-10-07).
 *
 * ── Sources, pinned ──────────────────────────────────────────────────────
 *   rondocode/     huggingface.co/hi-im-vijay/rondocode-sing at commit 528c7e4e: the
 *                  wav2vec2 phoneme aligner exported to ONNX (phoneme.onnx), the
 *                  ContentVec encoder (vec-768.onnx) and three RVC voice generators
 *                  (gen_kizuna, gen_barbara, gen_rise). The repository states no licence
 *                  and no provenance for these files; CREDITS.txt says so plainly.
 *                  Hosting them was Andy's decision (2026-10-07), made knowing that.
 *                  The int8 builds (phoneme-int8, tts_vector_estimator-int8,
 *                  tts_vocoder-int8) exist only on upstream's unversioned host
 *                  models.rondocode.com, so they are pinned by hash alone.
 *   supertonic/    huggingface.co/Supertone/supertonic-3 at commit 3cadd1ee
 *                  (OpenRAIL-M; LICENSE.txt travels with the files, and its use
 *                  restrictions bind anyone who uses these weights).
 *   wav2vec2/      vocab.json from huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft
 *                  at commit ae45363b (Apache-2.0), the vocabulary the aligner decodes against.
 *
 * Integrity: every file is pinned to a SHA-256 and verified BEFORE it is moved into
 * place (downloads stream to a temporary file while hashing). A mismatch exits
 * non-zero and leaves nothing behind. A file already on disk whose hash matches is
 * skipped without touching the network. For a deliberate upgrade, run with
 * --refresh-pins and paste the printed lines over PINS.
 *
 * Usage:
 *   node scripts/fetch-sing-models.ts
 *   node scripts/fetch-sing-models.ts --refresh-pins
 */
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT = join(ROOT, 'shells/web/public/models/sing');

const RONDO_HF = 'https://huggingface.co/hi-im-vijay/rondocode-sing/resolve/528c7e4eaec2a0a71cb6f02c2169f16ee11c55b1/';
const RONDO_R2 = 'https://models.rondocode.com/';
const SUPERTONIC = 'https://huggingface.co/Supertone/supertonic-3/resolve/3cadd1ee6394adea1bd021217a0e650ede09a323/';
const WAV2VEC2 = 'https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft/resolve/ae45363bf3413b374fecd9dc8bc1df0e24c3b7f4/';

/** [path under models/sing/, source URL]. */
const FILES: [string, string][] = [
  ['rondocode/phoneme.onnx', `${RONDO_HF}phoneme.onnx`],
  ['rondocode/phoneme-int8.onnx', `${RONDO_R2}phoneme-int8.onnx`],
  ['rondocode/tts_vector_estimator-int8.onnx', `${RONDO_R2}tts_vector_estimator-int8.onnx`],
  ['rondocode/tts_vocoder-int8.onnx', `${RONDO_R2}tts_vocoder-int8.onnx`],
  ['rondocode/vec-768.onnx', `${RONDO_HF}vec-768.onnx`],
  ['rondocode/gen_kizuna.onnx', `${RONDO_HF}gen_kizuna.onnx`],
  ['rondocode/gen_barbara.onnx', `${RONDO_HF}gen_barbara.onnx`],
  ['rondocode/gen_rise.onnx', `${RONDO_HF}gen_rise.onnx`],
  ['supertonic/onnx/duration_predictor.onnx', `${SUPERTONIC}onnx/duration_predictor.onnx`],
  ['supertonic/onnx/text_encoder.onnx', `${SUPERTONIC}onnx/text_encoder.onnx`],
  ['supertonic/onnx/vector_estimator.onnx', `${SUPERTONIC}onnx/vector_estimator.onnx`],
  ['supertonic/onnx/vocoder.onnx', `${SUPERTONIC}onnx/vocoder.onnx`],
  ['supertonic/onnx/tts.json', `${SUPERTONIC}onnx/tts.json`],
  ['supertonic/onnx/unicode_indexer.json', `${SUPERTONIC}onnx/unicode_indexer.json`],
  ...['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'].map((v): [string, string] => [`supertonic/voice_styles/${v}.json`, `${SUPERTONIC}voice_styles/${v}.json`]),
  // The static model host answers 404 for a name with no extension, so the licence carries one.
  ['supertonic/LICENSE.txt', `${SUPERTONIC}LICENSE`],
  ['wav2vec2/vocab.json', `${WAV2VEC2}vocab.json`],
];

/**
 * SHA-256 per path. The Hugging Face LFS hashes match the hub API at the pinned commits;
 * the int8 builds, the JSON files and the licence were hashed from the 2026-10-07 download.
 */
const PINS: Record<string, string> = {
  'rondocode/phoneme.onnx': '93265694093f5f91497181ed9d7791f43bc818d2e23c46caf988fd9b8b1a1fba',
  'rondocode/phoneme-int8.onnx': 'c33c7a69ce5241e3b9daf899a49a34e7015579f99208a85496a5ada8754d1185',
  'rondocode/tts_vector_estimator-int8.onnx': '438af999004c541c9824b58db18f8a53a3fde15044b87c6b0ab9e4cea7522b43',
  'rondocode/tts_vocoder-int8.onnx': 'be0ee45e8bb8a73dca082572eb1894280bca790e9a43e89f5d5211779b04fb5f',
  'rondocode/vec-768.onnx': 'b3886e7dff1495cda514f94f4680a7b1261e05d6929f5c764cdb17934b413c2a',
  'rondocode/gen_kizuna.onnx': '931dd7f754a2220316882764d189ac9815fdcf35af87e8913875fb23633236c8',
  'rondocode/gen_barbara.onnx': 'c70221cf7279dce21dede0973b65c9212bf4cbd5c2a8a6f32ff9ab36b3b4b056',
  'rondocode/gen_rise.onnx': '33bb6ec4eba5591d066793ee00cd261eedafc49e589367689cec78895c862edb',
  'supertonic/onnx/duration_predictor.onnx': 'c3eb91414d5ff8a7a239b7fe9e34e7e2bf8a8140d8375ffb14718b1c639325db',
  'supertonic/onnx/text_encoder.onnx': 'c7befd5ea8c3119769e8a6c1486c4edc6a3bc8365c67621c881bbb774b9902ff',
  'supertonic/onnx/vector_estimator.onnx': '883ac868ea0275ef0e991524dc64f16b3c0376efd7c320af6b53f5b780d7c61c',
  'supertonic/onnx/vocoder.onnx': '085de76dd8e8d5836d6ca66826601f615939218f90e519f70ee8a36ed2a4c4ba',
  'supertonic/onnx/tts.json': '42078d3aef1cd43ab43021f3c54f47d2d75ceb4e75f627f118890128b06a0d09',
  'supertonic/onnx/unicode_indexer.json': '9bf7346e43883a81f8645c81224f786d43c5b57f3641f6e7671a7d6c493cb24f',
  'supertonic/voice_styles/F1.json': 'bbdec6ee00231c2c742ad05483df5334cab3b52fda3ba38e6a07059c4563dbc2',
  'supertonic/voice_styles/F2.json': '7c722c6a72707b1a77f035d67f0d1351ba187738e06f7683e8c72b1df3477fc6',
  'supertonic/voice_styles/F3.json': '12f6ef2573baa2defa1128069cb59f203e3ab67c92af77b42df8a0e3a2f7c6ab',
  'supertonic/voice_styles/F4.json': 'c2fa764c1225a76dfc3e2c73e8aa4f70d9ee48793860eb34c295fff01c2e032b',
  'supertonic/voice_styles/F5.json': '45966e73316415626cf41a7d1c6f3b4c70dbc1ba2bee5c1978ef0ce33244fc8d',
  'supertonic/voice_styles/M1.json': 'e35604687f5d23694b8e91593a93eec0e4eca6c0b02bb8ed69139ab2ea6b0a5b',
  'supertonic/voice_styles/M2.json': 'b76cbf62bac707c710cf0ae5aba5e31eea1a6339a9734bfae33ab98499534a50',
  'supertonic/voice_styles/M3.json': 'ea1ac35ccb91b0d7ecad533a2fbd0eec10c91513d8951e3b25fbba99954e159b',
  'supertonic/voice_styles/M4.json': 'ca8eefad4fcd989c9379032ff3e50738adc547eeb5e221b82593a6d7b3bac303',
  'supertonic/voice_styles/M5.json': 'dd22b92740314321f8ae11c5e87f8dd60d060f15dd3a632b5adf77f471f77af2',
  'supertonic/LICENSE.txt': '0d944a9110fed9a9602d60e0423a272903e7bd21ab060490774efc77c2275e9f',
  'wav2vec2/vocab.json': 'd732ab2456c0c017930001dc9af0b41b3b93d25b2eb9740bf9d925508d7d87d0',
};

const CREDITS = `Singing models for rondocode's sing(), hosted by Lolly at lolli.li/models/sing/.

rondocode/phoneme.onnx, rondocode/phoneme-int8.onnx
  The wav2vec2 phoneme aligner exported to ONNX by rondocode's author, from
  facebook/wav2vec2-lv-60-espeak-cv-ft (Apache-2.0). Source:
  huggingface.co/hi-im-vijay/rondocode-sing (commit 528c7e4e) and models.rondocode.com.

rondocode/vec-768.onnx
  The ContentVec speech encoder used for voice conversion, as distributed by
  huggingface.co/hi-im-vijay/rondocode-sing (commit 528c7e4e). No licence is stated
  in that repository.

rondocode/gen_kizuna.onnx, rondocode/gen_barbara.onnx, rondocode/gen_rise.onnx
  RVC voice generators as distributed by huggingface.co/hi-im-vijay/rondocode-sing
  (commit 528c7e4e). The repository states no licence and no provenance for these
  voices: who trained them, and on what recordings, is not recorded.

rondocode/tts_vector_estimator-int8.onnx, rondocode/tts_vocoder-int8.onnx
  Dynamic-int8 builds of two Supertonic-3 models made by rondocode's author, from
  models.rondocode.com. Derived from Supertonic-3, so the OpenRAIL-M licence and its
  use restrictions in supertonic/LICENSE.txt apply to them.

supertonic/
  Supertonic-3 by Supertone Inc., huggingface.co/Supertone/supertonic-3
  (commit 3cadd1ee), released under the OpenRAIL-M licence in LICENSE.txt. The
  licence's use-based restrictions apply to every use of these weights.

wav2vec2/vocab.json
  The vocabulary of facebook/wav2vec2-lv-60-espeak-cv-ft (commit ae45363b), Apache-2.0.
`;

const sha256File = (path: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(path).on('data', (c) => h.update(c)).on('error', reject).on('end', () => resolve(h.digest('hex')));
  });

async function fetchTo(url: string, dest: string): Promise<string> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const h = createHash('sha256');
  const tmp = `${dest}.part`;
  mkdirSync(dirname(dest), { recursive: true });
  const body = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream<Uint8Array>);
  body.on('data', (c: Buffer) => h.update(c));
  await pipeline(body, createWriteStream(tmp));
  return h.digest('hex');
}

const refresh = process.argv.includes('--refresh-pins');
const printed: string[] = [];
let failed = 0;
for (const [rel, url] of FILES) {
  const dest = join(OUT, rel);
  const pin = PINS[rel];
  if (!refresh && pin && existsSync(dest) && (await sha256File(dest)) === pin) {
    console.log(`ok (cached) ${rel}`);
    continue;
  }
  process.stdout.write(`fetch ${rel} ... `);
  try {
    const got = await fetchTo(url, dest);
    if (!refresh && !pin) throw new Error(`no pin for ${rel}; run with --refresh-pins after checking the source`);
    if (!refresh && got !== pin) throw new Error(`hash mismatch for ${rel}: got ${got}, pinned ${pin}`);
    renameSync(`${dest}.part`, dest);
    console.log('ok');
    printed.push(`  '${rel}': '${got}',`);
  } catch (e) {
    rmSync(`${dest}.part`, { force: true });
    console.log('FAILED');
    console.error(`  ${e instanceof Error ? e.message : String(e)}`);
    failed++;
  }
}
writeFileSync(join(OUT, 'CREDITS.txt'), CREDITS);
if (refresh) console.log(`\nPINS:\n${printed.join('\n')}`);
if (failed) {
  console.error(`${failed} file(s) failed; nothing unverified was kept. Re-run to resume.`);
  process.exit(1);
}
