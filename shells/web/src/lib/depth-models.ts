// SPDX-License-Identifier: MPL-2.0
/**
 * On-device monocular depth - the PURE catalogue half (plans/160 WP-A).
 *
 * The implementation MOVED to packages/node-shell/src/ml/depth-models.ts: it is
 * constants only (no onnxruntime, no DOM, no IndexedDB), and the SAME roster now
 * has to answer for the Node shells, which run these models on onnxruntime-node
 * (plans/183 WS2). Two copies would let `models()` / `modelBytes()` disagree
 * between the web shell and the CLI, so there is one copy, in the shared package
 * both shells can reach - the move net.ts and pptx.ts already made.
 *
 * This file stays as the import path lib/depth-job.ts and lib/depth-worker.ts
 * have always used, so nothing in the web shell changes.
 */
export * from '@lolly-tools/node-shell/ml/depth-models';
