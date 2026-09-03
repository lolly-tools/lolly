// SPDX-License-Identifier: MPL-2.0
/**
 * What each on-device ML family is MADE OF: every file, its size, and the
 * SHA-256 a download must match before it is written.
 *
 * `lolly models ls` reads this to say what is here, and `lolly models fetch
 * <family>` reads it to know what to ask https://lolli.li/models/<family>/ for
 * and what to verify each answer against. Paths are relative to
 * `<modelsDir>/<family>/`, which is also the mirror's path under
 * `/models/<family>/`, and they are the same paths the runners in this directory
 * check for presence - so "is it staged", "what would a fetch download" and
 * "where does it go" are one answer, not three.
 *
 * SECOND COPY, GUARDED. The pins are mirrored from the PINS tables in
 * scripts/fetch-{upscale,matte,ocr,ai-detect,reword,depth}-models.ts. Those
 * scripts run `main()` at module scope, so importing one would start a download;
 * they cannot be read as data. packages/node-shell/test/model-pins.test.ts
 * therefore parses each script and fails when the two tables drift apart - the
 * same guard SPEECH_MODEL_FILES carries in speech.ts. Every pin below was also
 * checked against what the mirror actually serves (byte length and SHA-256 of
 * the downloaded file, 2026-09-03).
 *
 * A PLACEHOLDER pin in a fetch script is NOT registered here. The upscale
 * denoise partner (realesr-general-wdn-x4v3.onnx) and the ModernBERT AI-text
 * detector have no verified source yet, and offering them would promise a
 * download that can only 404.
 */
import type { ModelFilePin } from '../models-dir.ts';

/** The families with a Node runner in this directory. */
export type MlModelFamily = 'upscale' | 'matte' | 'ocr' | 'ai-detect' | 'reword' | 'depth';

export interface MlFamilyPins {
  /** Every file the family needs, relative to `<modelsDir>/<family>/`. Empty
   *  when nothing is published. */
  files: readonly ModelFilePin[];
  /** Why there is nothing to fetch, when there is nothing to fetch. A fetch
   *  refuses with this sentence instead of asking the mirror for a file that is
   *  not there. */
  unpublished?: string;
}

export const ML_MODEL_FILES: Record<MlModelFamily, MlFamilyPins> = {
  upscale: {
    files: [
      // The four with real pins in scripts/fetch-upscale-models.ts.
      { path: 'realesr-general-x4v3.onnx', bytes: 4_871_181, sha256: '09b757accd747d7e423c1d352b3e8f23e77cc5742d04bae958d4eb8082b76fa4' },
      { path: 'realesrgan-x4plus.onnx', bytes: 67_051_616, sha256: '5c586662929cbc686c1a5c38d9c060dbdb4ea5863a1f7672b8c0761e6b89c033' },
      // CONVERSION-SOURCED, so no fetch script carries this pin: the anime model
      // has no published ONNX mirror and is reproduced from the upstream BSD-3
      // .pth by scripts/convert-anime-upscale-onnx.py, which prints and records
      // this hash in the CREDITS-anime.txt it writes beside the file. Verified
      // here against both that staged copy and the mirror (2026-09-03). It is
      // staged in UPSCALE_STAGED, so leaving it out would make a completed
      // `models fetch upscale` still refuse `--model=realesrgan-x4plus-anime`.
      { path: 'realesrgan-x4plus-anime.onnx', bytes: 17_939_969, sha256: 'e188e709d4ee43c7154c1e981cb37469089311178c01a39b92bd28b39e5d188a' },
      { path: 'gfpgan-v1.4.onnx', bytes: 340_299_087, sha256: 'accc4757b26bdb89b32b4d3500d4f79c9dff97c1dd7c7104bf9dcb95e3311385' },
      // Optional at RUN time (GFPGAN falls back to a centre crop without it),
      // required at FETCH time: half a megabyte, and staging it is what makes
      // the fallback unnecessary.
      { path: 'face-detect.onnx', bytes: 535_842, sha256: '564740c5146673c840257402cee8309161848e48e64d277a862ab4d501adf8a5' },
    ],
  },
  matte: {
    files: [
      { path: 'u2netp.onnx', bytes: 4_574_861, sha256: '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8' },
      { path: 'modnet.onnx', bytes: 25_888_640, sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9' },
    ],
  },
  ocr: {
    files: [
      { path: 'ppocrv5-mobile-det.onnx', bytes: 4_826_518, sha256: '1eb7b4f7ab657ebd1c66d5f79bca7497f29768a2e3c15e52daecbba1a8e4a039' },
      { path: 'ppocrv5-mobile-rec.onnx', bytes: 16_562_373, sha256: '243a0f06d826761323e9045e9b113ab2c191c3aa50565585e628300b8eda0224' },
      { path: 'ppocrv5-dict.txt', bytes: 74_012, sha256: 'd1979e9f794c464c0d2e0b70a7fe14dd978e9dc644c0e71f14158cdf8342af1b' },
    ],
  },
  'ai-detect': {
    // Only the e5 detector: AI_DETECT_STAGED withholds modernbert-raid-mage
    // (measured saturation, no honest threshold), and its pins are placeholders.
    files: [
      { path: 'e5-small-ai-detector/config.json', bytes: 728, sha256: 'a9f7b8cd66a10a5e34cdd676d208c2d0df021b666ba130b407894cddc76a0b07' },
      { path: 'e5-small-ai-detector/tokenizer.json', bytes: 711_396, sha256: 'd241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66' },
      { path: 'e5-small-ai-detector/tokenizer_config.json', bytes: 1_301, sha256: 'f3d4f87daa8290a5145f49a61c0623f29730e6aecd4583200d1ddc8e2c3aebe7' },
      { path: 'e5-small-ai-detector/special_tokens_map.json', bytes: 695, sha256: '5d5b662e421ea9fac075174bb0688ee0d9431699900b90662acd44b2a350503a' },
      { path: 'e5-small-ai-detector/onnx/model_quantized.onnx', bytes: 33_934_808, sha256: '6bdfbf199a48a3d57426f830353f7d58d4e86f79bd069405c7ca54dd1d83695d' },
    ],
  },
  reword: {
    // scripts/fetch-reword-models.ts writes into models/reword/<REWORD_MODEL_ID>/,
    // so its PINS keys are one directory deeper than the family root.
    files: [
      { path: 'smollm2-360m-instruct/config.json', bytes: 846, sha256: '224f72354f10d617a359cc82ad15a3c96e866b9b2ffadb81997eeea9e88e22ee' },
      { path: 'smollm2-360m-instruct/generation_config.json', bytes: 132, sha256: '87b916edaaab66b3899b9d0dd0752727dff6666686da0504d89ae0a6e055a013' },
      { path: 'smollm2-360m-instruct/special_tokens_map.json', bytes: 655, sha256: '2b7379f3ae813529281a5c602bc5a11c1d4e0a99107aaa597fe936c1e813ca52' },
      { path: 'smollm2-360m-instruct/tokenizer.json', bytes: 2_104_556, sha256: '9ca9acddb6525a194ec8ac7a87f24fbba7232a9a15ffa1af0c1224fcd888e47c' },
      { path: 'smollm2-360m-instruct/tokenizer_config.json', bytes: 3_764, sha256: '4ec77d44f62efeb38d7e044a1db318f6a939438425312dfa333b8382dbad98df' },
      { path: 'smollm2-360m-instruct/onnx/model_q4.onnx', bytes: 387_943_246, sha256: 'a4ffda96e65beafc6f6cef0cbcf9fdc1cbdd79c230906bf3897d190547c7a596' },
    ],
  },
  depth: {
    files: [],
    // scripts/fetch-depth-models.ts holds one entry and its sha256 is still the
    // PLACEHOLDER string, so nothing was ever verified and nothing was ever
    // published: /models/depth/depth-anything-v2-small.onnx answers 404. A
    // --refresh-pins candidate does sit at /models/depth/.candidates/, which is
    // deliberately not the served path - an unverified 26 MB ONNX must not be
    // reachable by the name the runtime loads. Registering the family with an
    // empty file list is what turns `lolly models fetch depth` into an honest
    // refusal rather than a download that 404s halfway.
    unpublished:
      'no depth model is published yet: scripts/fetch-depth-models.ts still carries a PLACEHOLDER pin for '
      + 'depth-anything-v2-small.onnx, so there is nothing verified to download. The candidate under '
      + 'models/depth/.candidates/ is deliberately not served under the name the runtime loads.',
  },
};
