// SPDX-License-Identifier: MPL-2.0
/** Serial, disposable preview work. Only the newest request can reach the UI. */
export function latestPreview<T, R>(render: (input: T, signal: AbortSignal) => Promise<R>, events: {
  pending(): void; ready(result: R): void; failed(error: unknown): void;
}, delay = 160) {
  let revision = 0;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let queue = Promise.resolve();
  return {
    update(input: T): void {
      if (disposed) return;
      const current = ++revision;
      clearTimeout(timer);
      controller?.abort();
      events.pending();
      timer = setTimeout(() => {
        queue = queue.then(async () => {
          if (disposed || current !== revision) return;
          const own = new AbortController();
          controller = own;
          try {
            const result = await render(input, own.signal);
            if (!disposed && current === revision) events.ready(result);
          } catch (error) {
            if (!disposed && current === revision) events.failed(error);
          }
        });
      }, delay);
    },
    dispose(): void { disposed = true; revision++; clearTimeout(timer); controller?.abort(); },
  };
}
