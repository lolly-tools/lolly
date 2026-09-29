// SPDX-License-Identifier: MPL-2.0
import { createRequire } from 'node:module';
import { parentPort } from 'node:worker_threads';
import { createRanker } from './runtime.ts';
import { resolveModelsDir } from '../../packages/node-shell/src/ml/session.ts';
import type { Candidate, Method, SlideBrief } from './types.ts';

const requireTf = createRequire(new URL('../../packages/node-shell/package.json', import.meta.url));
const runner = createRanker(async () => {
  const tf = requireTf('@huggingface/transformers');
  tf.env.allowRemoteModels = false;
  tf.env.allowLocalModels = true;
  tf.env.localModelPath = `${resolveModelsDir()}/`;
  return tf;
}, 'node-cpu');

parentPort!.on('message', async (request: { brief: SlideBrief; candidates: Candidate[]; method: Method }): Promise<void> => {
  parentPort!.postMessage(await runner.rank(request.brief, request.candidates, request.method));
});
