// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM-free maths of `host.ocr`: the CTC greedy decode, the DBNet
 * connected-component boxing, the box unclip, the reading-order sort, the
 * detector input size and the channel packing.
 *
 * SPLIT OUT of shells/web/src/lib/ocr.ts (2026-09-03, plans/183 WS2), which
 * keeps importing and re-exporting every symbol below, so lib/ocr.test.ts and
 * the worker path are unchanged. The split exists because the Node OCR runner
 * (packages/node-shell/src/ml/ocr.ts) needs the exact same numbers and cannot
 * import ocr.ts: that file pulls in lib/ort.ts, which is onnxruntime-web plus
 * OffscreenCanvas.
 *
 * Everything here is verified as data by the web suite. Only the CROP and the
 * RESIZE differ between the shells (canvas there, sharp here).
 */

import type { OcrBox } from '@lolly-tools/core/host-v1';

export interface DetBox extends OcrBox {
  /** Mean detector probability inside the region - the box's confidence. */
  score: number;
}

/**
 * CTC greedy decode. `probs` is time-major (`probs[t * C + c]` is class c's
 * probability at step t). Collapses runs of the same class, drops the blank
 * (index 0), and maps the rest through `charset` (`charset[0]` is the blank slot).
 * `confidence` is the mean of the kept steps' peak probabilities.
 */
export function ctcGreedyDecode(
  probs: ArrayLike<number>, T: number, C: number, charset: string[],
): { text: string; confidence: number } {
  let out = '';
  let prev = -1;
  let sum = 0;
  let kept = 0;
  for (let t = 0; t < T; t++) {
    let best = 0;
    let bestP = -Infinity;
    const base = t * C;
    for (let c = 0; c < C; c++) {
      const p = probs[base + c] ?? 0;
      if (p > bestP) { bestP = p; best = c; }
    }
    // Collapse repeats first, then drop the blank (CTC's rule, in that order).
    if (best !== prev && best !== 0) {
      out += charset[best] ?? '';
      sum += bestP;
      kept++;
    }
    prev = best;
  }
  return { text: out, confidence: kept ? sum / kept : 0 };
}

/**
 * DBNet post-process: turn a probability map into axis-aligned text boxes. The
 * map is thresholded to a binary mask, 4-connected components are labelled, and
 * each component becomes a box whose `score` is its mean probability. Boxes below
 * `minArea` or `boxThresh` are dropped. Boxes are in MAP pixel coordinates.
 */
export function connectedComponentBoxes(
  prob: ArrayLike<number>, w: number, h: number,
  { binThresh, minArea, boxThresh }: { binThresh: number; minArea: number; boxThresh: number },
): DetBox[] {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack: number[] = [];
  const boxes: DetBox[] = [];
  const at = (i: number): number => prob[i] ?? 0;
  for (let start = 0; start < n; start++) {
    if (seen[start] || at(start) < binThresh) continue;
    // Flood-fill this component (iterative, 4-connectivity).
    let minX = w, minY = h, maxX = 0, maxY = 0, count = 0, probSum = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const idx = stack.pop() ?? 0;
      const x = idx % w;
      const y = (idx - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count++;
      probSum += at(idx);
      if (x > 0 && !seen[idx - 1] && at(idx - 1) >= binThresh) { seen[idx - 1] = 1; stack.push(idx - 1); }
      if (x < w - 1 && !seen[idx + 1] && at(idx + 1) >= binThresh) { seen[idx + 1] = 1; stack.push(idx + 1); }
      if (y > 0 && !seen[idx - w] && at(idx - w) >= binThresh) { seen[idx - w] = 1; stack.push(idx - w); }
      if (y < h - 1 && !seen[idx + w] && at(idx + w) >= binThresh) { seen[idx + w] = 1; stack.push(idx + w); }
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const score = probSum / count;
    if (bw * bh >= minArea && score >= boxThresh) {
      boxes.push({ x: minX, y: minY, w: bw, h: bh, score });
    }
  }
  return boxes;
}

/**
 * DBNet "unclip": the net emits a SHRUNK region, so a box is expanded outward
 * before cropping. For an axis-aligned box the offset is `area * ratio /
 * perimeter` (the rectangle case of the polygon offset PP-OCR uses), clamped to
 * the map bounds.
 */
export function unclipBox(box: OcrBox, ratio: number, bounds: { w: number; h: number }): OcrBox {
  const area = box.w * box.h;
  const perim = 2 * (box.w + box.h);
  const d = perim > 0 ? Math.round((area * ratio) / perim) : 0;
  const x = Math.max(0, box.x - d);
  const y = Math.max(0, box.y - d);
  const x2 = Math.min(bounds.w, box.x + box.w + d);
  const y2 = Math.min(bounds.h, box.y + box.h + d);
  return { x, y, w: x2 - x, h: y2 - y };
}

/**
 * Reading order: group boxes into lines (vertical overlap > half the shorter box),
 * order lines top→bottom, and each line's boxes left→right. Stable for a column of
 * text and for a paragraph; a multi-column layout reads column-naively (a later
 * refinement), which is honest for the flat documents this targets.
 */
export function orderBoxesReadingOrder<T extends OcrBox>(boxes: T[]): T[] {
  const byTop = [...boxes].sort((a, b) => a.y - b.y);
  const lines: T[][] = [];
  for (const b of byTop) {
    const line = lines.find((ln) => {
      const ref = ln[0];
      if (!ref) return false;
      const overlap = Math.min(b.y + b.h, ref.y + ref.h) - Math.max(b.y, ref.y);
      return overlap > Math.min(b.h, ref.h) / 2;
    });
    if (line) line.push(b);
    else lines.push([b]);
  }
  for (const ln of lines) ln.sort((a, b) => a.x - b.x);
  lines.sort((a, b) => (a[0]?.y ?? 0) - (b[0]?.y ?? 0));
  return lines.flat();
}

/** RGBA → CHW float32, per-channel (v/255 - mean)/std. The loop itself lives in
 *  ml/tensor.ts, shared with the upscaler; re-exported here because lib/ocr.ts
 *  (and its test) have always imported it alongside the rest of this maths. */
export { packNchw } from './tensor.ts';

/** Detector input size: fit the long side to limitSide, round both to a /32 multiple. */
export function detSize(w: number, h: number, limitSide: number): { dw: number; dh: number } {
  const scale = Math.min(1, limitSide / Math.max(w, h));
  const round32 = (v: number): number => Math.max(32, Math.round((v * scale) / 32) * 32);
  return { dw: round32(w), dh: round32(h) };
}

/** The recogniser's crop width for one box: the box's aspect at the model's fixed
 *  height, floored at that height and capped at the spec's maximum. */
export function recWidthFor(box: OcrBox, height: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(height, Math.round((box.w / box.h) * height)));
}
