// SPDX-License-Identifier: MPL-2.0
/**
 * The node OCR runner (`../ml/ocr.ts`, PP-OCR over onnxruntime-node and sharp)
 * as the `ocr` a flattened rebuild takes (`FlattenedOcrV1`, plan 274 section 6).
 *
 * For a caller that already decided OCR may run here: the CLI behind
 * `aiEnabled`, a script, a test. The pipeline itself never calls this; it takes
 * whatever `ocr` it is given, so a surface without OCR (the hosted MCP server)
 * simply passes none and its flattened slides stay pictures.
 *
 * NOTHING IS DOWNLOADED. The runner refuses a model that is not on disk, and this
 * adapter asks first: when the runtime or the model files are missing it returns
 * `{ ok: false }` with the reason and the sentence to show, which names the
 * `lolly models fetch ocr` command, and never starts a download itself.
 *
 * Each call reads one crop: the whole slide picture first, then tiles of it,
 * lines whose box does not fit their ink, pieces of lines too long to read
 * whole (48 calls a slide at most, `maxOcrCalls`), and regions the colour
 * finder calls text that no line explained (`reconstructFlattenedSlide`'s page
 * reading). The runner scales a crop down to its detector's input itself (960
 * px on the long side for PP-OCR), so the whole slide goes in as it is. The boxes come back in
 * the crop's own pixels, which is what `reconstructFlattenedSlide` expects, and
 * the lines are returned as the runner read them: the confidence floor is the
 * rebuild's (`minConfidence`), so a low line still reaches the evidence.
 */

import type { OcrAPI, OcrLine, OcrModelId } from '@lolly-tools/core/host-v1';
import type { FlattenedOcrV1 } from './flattened.ts';

export interface NodeFlattenedOcrOptsV1 {
  /** The OCR model to read with. The runner's default when left out. */
  model?: OcrModelId;
  /** The runner to adapt. `createNodeOcrAPI()` when left out; null says this host has none. */
  api?: OcrAPI | null;
  /** Passed to every run, so a cancelled deck stops between regions. */
  signal?: AbortSignal;
}

export type NodeFlattenedOcrV1 =
  | {
    ok: true;
    /** The `ocr` option for `readDeck`, `planDeck` or `reconstructFlattenedSlide`. */
    ocr: FlattenedOcrV1;
    /** The model id, for the `ocrModel` option, so the evidence names it. */
    model: OcrModelId;
  }
  | {
    ok: false;
    /** `no-runtime`: onnxruntime-node or sharp is not installed here. `model-missing`: the model files are not on disk. */
    reason: 'no-runtime' | 'model-missing';
    /** A plain sentence for the person, naming what to do. */
    message: string;
  };

/**
 * The node OCR runner adapted to a flattened rebuild, or the reason it cannot
 * run here. Checks for the model files before anything is loaded and downloads
 * nothing.
 */
export async function nodeFlattenedOcr(opts: NodeFlattenedOcrOptsV1 = {}): Promise<NodeFlattenedOcrV1> {
  let api: OcrAPI | null;
  if (opts.api !== undefined) {
    api = opts.api;
  } else {
    const { createNodeOcrAPI } = await import('../ml/ocr.ts');
    api = createNodeOcrAPI();
  }
  if (!api?.isAvailable()) {
    return {
      ok: false,
      reason: 'no-runtime',
      message: 'Text in pictures cannot be read here: the on-device OCR runtime (onnxruntime-node and sharp) is not installed.',
    };
  }
  let model: OcrModelId | undefined = opts.model;
  if (model === undefined) {
    const { OCR_DEFAULT_MODEL } = await import('../ml/ocr-models.ts');
    model = OCR_DEFAULT_MODEL;
  }
  if (!(await api.cached(model))) {
    const name = api.models().find((m) => m.id === model)?.name ?? model;
    return {
      ok: false,
      reason: 'model-missing',
      message: `Text in pictures cannot be read here: the ${name} model is not on this machine. Run \`lolly models fetch ocr\` to download it, or point LOLLY_MODELS_DIR at a directory that already has it.`,
    };
  }
  const runner = api;
  const id = model;
  const signal = opts.signal;
  const ocr: FlattenedOcrV1 = async (frame): Promise<OcrLine[]> => {
    const result = await runner.run(frame, { model: id, ...(signal ? { signal } : {}) });
    return result.lines;
  };
  return { ok: true, ocr, model: id };
}
