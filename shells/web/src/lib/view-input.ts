// SPDX-License-Identifier: MPL-2.0
/**
 * When a mounted view starts to take input.
 *
 * Most views take input as soon as their mount returns. The tool view that opens a
 * saved document keeps its "Opening…" card up a little longer, until the runtime has
 * settled (views/tool/open-document.ts). That card is a modal dialog, so the page under
 * it takes no focus and no keystrokes. The router announces a view ("Tool loaded") and
 * moves focus into it (main.ts navigate()), and it must do neither while the card is
 * up: a person told the tool is ready types into a page the card still blocks, and the
 * keystrokes are lost.
 *
 * A view that is not ready when its mount returns hands the router a promise here. It
 * resolves true when the view takes input, and false when the open stopped instead
 * (Cancel, or a navigation away), so that nothing is announced for a view that is
 * going away.
 */
const pending = new WeakMap<HTMLElement, Promise<boolean>>();

/** `view` takes input once `usable` resolves true. */
export function holdViewInput(view: HTMLElement, usable: Promise<boolean>): void {
  pending.set(view, usable);
}

/** Take the promise `view` handed over, or null when the view takes input now. */
export function takeViewInput(view: HTMLElement): Promise<boolean> | null {
  const usable = pending.get(view) ?? null;
  pending.delete(view);
  return usable;
}
