// SPDX-License-Identifier: MPL-2.0
import { xmlText } from '@lolly-tools/node-shell/text-xml';
import { parentPort, workerData } from 'node:worker_threads';
import { runTextTool } from '@lolly/engine';
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
