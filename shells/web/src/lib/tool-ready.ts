// SPDX-License-Identifier: MPL-2.0
/** Optional behavior for a mounted tool, with teardown on navigation. */
export interface ReadyTool {
  readonly toolId: string;
  readonly view: HTMLElement;
  readonly collaborating: boolean;
  /** A recovered or late-edited draft must not be replaced by a room snapshot. */
  readonly unsaved?: () => boolean;
}
type Consumer = (tool: ReadyTool, current: () => boolean) => undefined | (() => void);
let live: ReadyTool | null = null;
let consumer: Consumer | null = null;
let dispose: (() => void) | undefined;
function attach(): void {
  dispose?.();
  dispose = undefined;
  const tool = live;
  if (tool && consumer) dispose = consumer(tool, () => live === tool) || undefined;
}
export function registerToolReady(fn: Consumer): () => void {
  consumer = fn;
  attach();
  return () => {
    if (consumer !== fn) return;
    consumer = null;
    dispose?.();
    dispose = undefined;
  };
}
/** A scope change can keep the same mounted tool and address. */
export function refreshToolReady(): void {
  attach();
}
export function publishToolReady(tool: ReadyTool): () => void {
  live = tool;
  attach();
  return () => {
    if (live !== tool) return;
    live = null;
    dispose?.();
    dispose = undefined;
  };
}
