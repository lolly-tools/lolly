// SPDX-License-Identifier: MPL-2.0
import type { TextToolsAPI, TextToolRequest, TextToolResult } from '@lolly-tools/core/host-v1';
/** Disposable workers bound expensive parsing and user-supplied expressions. */
export function runTextOperation(
  request: TextToolRequest,
  signal?: AbortSignal
): Promise<TextToolResult> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const worker = new Worker(new URL('./text-tools-worker.ts', import.meta.url), {
      type: 'module',
    });
    const finish = (): void => {
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener('abort', abort);
    };
    const abort = (): void => {
      finish();
      reject(new Error('Cancelled.'));
    };
    const timer = setTimeout(() => {
      finish();
      reject(
        new Error('This action took too long. Try a smaller excerpt or a simpler expression.')
      );
    }, 10000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = (e: MessageEvent<{ result?: TextToolResult; error?: string }>) => {
      finish();
      if (e.data.result) resolve(e.data.result);
      else reject(new Error(e.data.error ?? 'The text action failed.'));
    };
    worker.onerror = () => {
      finish();
      reject(new Error('The text action could not run.'));
    };
    worker.postMessage(request);
  });
}
export function createWebTextTools(): TextToolsAPI {
  return {
    run: (request) => runTextOperation(request),
    async operations() {
      return (await import('@lolly/engine')).TEXT_OPERATIONS;
    },
    async highlight(text, language, options) {
      return (await import('@lolly/engine')).highlightCode(text, language, options);
    },
  };
}
