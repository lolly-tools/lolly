// SPDX-License-Identifier: MPL-2.0
import { Worker } from 'node:worker_threads';
import type { TextToolsAPI, TextToolResult } from '@lolly-tools/core/host-v1';
import { TEXT_OPERATIONS, highlightCode } from '@lolly/engine';
export function createNodeTextTools(): TextToolsAPI {
  return {
    async operations() {
      return structuredClone(TEXT_OPERATIONS);
    },
    async highlight(text, language, options) {
      return highlightCode(text, language, options);
    },
    run(request) {
      return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./text-tools-worker.ts', import.meta.url), {
          workerData: request,
        });
        const timer = setTimeout(() => {
          void worker.terminate();
          reject(new Error('This text action exceeded ten seconds.'));
        }, 10000);
        worker.once('message', (value: { result?: TextToolResult; error?: string }) => {
          clearTimeout(timer);
          void worker.terminate();
          if (value.result) resolve(value.result);
          else reject(new Error(value.error));
        });
        worker.once('error', (error) => {
          clearTimeout(timer);
          void worker.terminate();
          reject(error);
        });
        worker.once('exit', (code) => {
          clearTimeout(timer);
          if (code) reject(new Error('The text action stopped.'));
        });
      });
    },
  };
}
