// SPDX-License-Identifier: MPL-2.0
import { xmlText } from '@lolly-tools/node-shell/text-xml';
import { runTextTool } from '@lolly/engine';
import type { TextToolRequest } from '@lolly-tools/core/host-v1';
self.onmessage = async (e: MessageEvent<TextToolRequest>) => {
  try {
    const result = await runTextTool(e.data, {
      digest: async (algorithm, bytes) =>
        new Uint8Array(await crypto.subtle.digest(algorithm, bytes as BufferSource)),
      xml: xmlText,
      random: (length) => crypto.getRandomValues(new Uint8Array(length)),
    });
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
