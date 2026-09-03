// SPDX-License-Identifier: MPL-2.0
/**
 * `host.ocr` for the Node shells: PP-OCRv5 (a DBNet detector, then a CRNN/SVTR
 * recogniser, CTC-decoded against a character dictionary) over onnxruntime-node,
 * with sharp where the web runner uses a canvas.
 *
 * The web twin is shells/web/src/lib/ocr.ts, and every number is the SAME
 * module: ml/ocr-math.ts owns the CTC decode, the connected-component boxing,
 * the unclip, the reading-order sort, the detector input size and the channel
 * packing, and ocr.ts imports it too. Only the crop and the resize differ.
 *
 * A logical model is THREE files (detector, recogniser, dictionary) and they
 * download as a set, so `cached()` is true only when all three are present and a
 * missing set refuses once, by name.
 */
import type {
  OcrAPI, OcrBox, OcrFeasibility, OcrFrame, OcrLine, OcrModelId, OcrModelInfo, OcrOpts, OcrResult,
} from '@lolly-tools/core/host-v1';
import { readFile } from 'node:fs/promises';
import {
  OCR_DEFAULT_MODEL, OCR_MODEL_BYTES, OCR_MODEL_FILES, OCR_MODEL_SPEC, ocrModelsFor, stagedOcrModels,
  type OcrModelSpec,
} from './ocr-models.ts';
import {
  connectedComponentBoxes, ctcGreedyDecode, detSize, orderBoxesReadingOrder, packNchw, recWidthFor, unclipBox,
} from './ocr-math.ts';
import {
  checkSignal, createSession, cropResizeRgba, firstOutput, loadOrt, modelFilesExist, modelPath,
  pixelMlAvailable, refuseMissing, resizeRgba, tensorFloats, type OrtSessionLike, type RgbaFrame,
} from './session.ts';

interface Loaded {
  det: OrtSessionLike;
  rec: OrtSessionLike;
  /** charset[0] is the CTC blank; [1..N] the dictionary; a space is appended. */
  charset: string[];
  spec: OcrModelSpec;
}

const loadedByModel = new Map<OcrModelId, Promise<Loaded>>();

async function load(id: OcrModelId): Promise<Loaded> {
  const existing = loadedByModel.get(id);
  if (existing) return existing;
  const files = OCR_MODEL_FILES[id];
  const spec = OCR_MODEL_SPEC[id];
  if (!files || !spec) throw new Error(`Unknown OCR model: ${id}`);
  if (!modelFilesExist('ocr', [files.det, files.rec, files.dict])) {
    const info = stagedOcrModels().find((m) => m.id === id);
    refuseMissing('ocr', info?.name ?? id, OCR_MODEL_BYTES[id] ?? 0);
  }
  const p = (async (): Promise<Loaded> => {
    const dict = await readFile(modelPath('ocr', files.dict), 'utf8');
    const lines = dict.split(/\r?\n/).filter((l) => l.length > 0);
    // PP-OCR CTCLabelDecode: [blank] + dictionary + [space].
    const charset = ['', ...lines, ' '];
    const [det, rec] = await Promise.all([
      createSession(modelPath('ocr', files.det)),
      createSession(modelPath('ocr', files.rec)),
    ]);
    return { det, rec, charset, spec };
  })();
  loadedByModel.set(id, p);
  try { return await p; } catch (err) { loadedByModel.delete(id); throw err; }
}

/** Honest feasibility - the models are small, so this only refuses an empty frame. */
function feasibility(src: { width: number; height: number }): OcrFeasibility {
  if (!stagedOcrModels().length) return { ok: false, reason: 'no-backend', message: 'No OCR model is installed yet.' };
  if (src.width < 1 || src.height < 1) return { ok: false, reason: 'too-large', message: 'That image has no pixels to read.' };
  return { ok: true };
}

/**
 * The Node `host.ocr`, or null when onnxruntime-node or sharp cannot be resolved
 * here. A shell then leaves `host.ocr` undefined.
 */
export function createNodeOcrAPI(): OcrAPI | null {
  if (!pixelMlAvailable()) return null;
  return {
    isAvailable: () => true,
    backend: () => null,
    models: (): OcrModelInfo[] => ocrModelsFor(false).map((m) => ({ ...m })),
    modelBytes: (id) => OCR_MODEL_BYTES[id] ?? 0,
    cached: async (id) => {
      const files = OCR_MODEL_FILES[id];
      return !!files && modelFilesExist('ocr', [files.det, files.rec, files.dict]);
    },
    canRun: async (src) => feasibility(src),

    async run(frame: OcrFrame, opts: OcrOpts = {}): Promise<OcrResult> {
      checkSignal(opts.signal);
      const id = opts.model ?? OCR_DEFAULT_MODEL;
      const { det, rec, charset, spec } = await load(id);
      checkSignal(opts.signal);

      const ort = await loadOrt();
      const source: RgbaFrame = { width: frame.width, height: frame.height, data: frame.data };
      const bounds = { w: frame.width, h: frame.height };

      let boxes: OcrBox[];
      if (opts.singleLine) {
        boxes = [{ x: 0, y: 0, w: frame.width, h: frame.height }];
      } else {
        opts.onProgress?.({ phase: 'detect' });
        const { dw, dh } = detSize(frame.width, frame.height, spec.det.limitSide);
        const scaled = await resizeRgba(source, dw, dh);
        const nchw = packNchw(scaled.data, dw, dh, spec.det.mean, spec.det.std);
        const detOut = await det.run({ [spec.det.inputName]: new ort.Tensor('float32', nchw, [1, 3, dh, dw]) });
        checkSignal(opts.signal);
        const first = firstOutput(detOut);
        const ph = Number(first.dims[2] ?? dh);
        const pw = Number(first.dims[3] ?? dw);
        const mapBoxes = connectedComponentBoxes(tensorFloats(first), pw, ph, {
          binThresh: spec.det.binThresh, minArea: spec.det.minBoxArea, boxThresh: spec.det.boxThresh,
        });
        // Map boxes from the (scaled) det map back to source pixels, then unclip.
        const sx = frame.width / pw;
        const sy = frame.height / ph;
        boxes = orderBoxesReadingOrder(
          mapBoxes.map((b) => unclipBox(
            { x: Math.round(b.x * sx), y: Math.round(b.y * sy), w: Math.round(b.w * sx), h: Math.round(b.h * sy) },
            spec.det.unclipRatio, bounds,
          )),
        );
      }

      opts.onProgress?.({ phase: 'recognize' });
      const lines: OcrLine[] = [];
      const min = opts.minConfidence ?? 0;
      for (let i = 0; i < boxes.length; i++) {
        checkSignal(opts.signal);
        const box = boxes[i];
        if (!box || box.w < 2 || box.h < 2) continue;
        const rw = recWidthFor(box, spec.rec.height, spec.rec.maxWidth);
        const crop = await cropResizeRgba(source, box.x, box.y, box.w, box.h, rw, spec.rec.height);
        const recNchw = packNchw(crop.data, rw, spec.rec.height, spec.rec.mean, spec.rec.std);
        const recOut = await rec.run({ [spec.rec.inputName]: new ort.Tensor('float32', recNchw, [1, 3, spec.rec.height, rw]) });
        const ro = firstOutput(recOut);
        const T = Number(ro.dims[1] ?? 0);
        const C = Number(ro.dims[2] ?? 0);
        const { text, confidence } = ctcGreedyDecode(tensorFloats(ro), T, C, charset);
        if (text.trim() && confidence >= min) lines.push({ text: text.trim(), confidence, box });
        opts.onProgress?.({ phase: 'recognize', fraction: (i + 1) / boxes.length });
      }

      return {
        text: lines.map((l) => l.text).join('\n'),
        lines,
        lang: stagedOcrModels().find((m) => m.id === id)?.languages[0] ?? 'en',
      };
    },
  };
}
