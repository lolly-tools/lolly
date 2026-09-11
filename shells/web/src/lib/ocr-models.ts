// SPDX-License-Identifier: MPL-2.0
/**
 * On-device OCR - the PURE catalogue half of `host.ocr` (plans/125).
 *
 * The implementation MOVED to packages/node-shell/src/ml/ocr-models.ts: it is
 * constants only (no onnxruntime, no DOM, no IndexedDB), and the SAME roster now
 * has to answer for the Node shells, which run these models on onnxruntime-node
 * (plans/183 WS2). Two copies would let `models()` / `modelBytes()` disagree
 * between the web shell and the CLI, so there is one copy, in the parent repo
 * that both submodules can reach - the move net.ts and pptx.ts already made.
 *
 * This file stays as the import path lib/ocr-wasm-api.ts, lib/ocr.ts and
 * lib/ocr-worker.ts have always used, so nothing in the web shell changes.
 */
export * from '../../../../packages/node-shell/src/ml/ocr-models.ts';
