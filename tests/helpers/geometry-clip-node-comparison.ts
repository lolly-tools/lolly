// SPDX-License-Identifier: MPL-2.0
/** Independent Node qualification can run while the browser's HTTP fixture remains responsive. */
import { Worker } from 'node:worker_threads';
import type { ClipWireCase } from './geometry-clip-cases.ts';
import type { qualifyClipping } from './geometry-clip-qualification.ts';

export function startNodeClipComparison(code: string, wasm: Uint8Array, inputs: ClipWireCase[]) {
  const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  const source = `import {parentPort} from 'node:worker_threads'; import {createGeometryClipping,qualifyClipping} from ${JSON.stringify(moduleUrl)}; parentPort.once('message',async ({wasm,inputs})=>{try{parentPort.postMessage({result:qualifyClipping(await createGeometryClipping(wasm),inputs)})}catch(error){parentPort.postMessage({error:String(error)})}});`;
  const worker = new Worker(new URL('data:text/javascript;base64,' + Buffer.from(source).toString('base64')), { env: {}, execArgv: [] });
  const result = new Promise<ReturnType<typeof qualifyClipping>>((resolve, reject) => {
    worker.once('message', (message: { result?: ReturnType<typeof qualifyClipping>; error?: string }) => message.result ? resolve(message.result) : reject(Error(message.error ?? 'Node clipping worker returned no result.')));
    worker.once('error', reject);
    worker.once('exit', code => { if (code !== 0) reject(Error(`Node clipping worker exited ${code}.`)); });
  });
  worker.postMessage({ wasm, inputs });
  return { result, dispose: () => worker.terminate() };
}
