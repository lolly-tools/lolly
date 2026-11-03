// SPDX-License-Identifier: MPL-2.0
import { xmlText } from '@lolly-tools/node-shell/text-xml';
import { parentPort, workerData } from 'node:worker_threads';
// The text module alone, not the engine index: a fresh worker loads it in a few
// hundred milliseconds, where the whole engine took several seconds and ran past
// the 2 s onInput budget (text-helper timed out on every theme switch).
import { runTextTool } from '@lolly/engine/text-tools';
try {
  const result = await runTextTool(workerData, {
    digest: async (algorithm, bytes) =>
      new Uint8Array(await crypto.subtle.digest(algorithm, bytes as BufferSource)),
    xml: xmlText,
    random: (length) => crypto.getRandomValues(new Uint8Array(length)),
  });
  parentPort?.postMessage({ result });
} catch (error) {
  parentPort?.postMessage({ error: error instanceof Error ? error.message : String(error) });
}
