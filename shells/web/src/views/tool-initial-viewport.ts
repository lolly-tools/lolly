// SPDX-License-Identifier: MPL-2.0

interface InitialViewportOptions {
  signal: AbortSignal;
  pending: () => boolean;
  initialize: () => void;
  reveal: () => void;
}

const opening = new WeakMap<HTMLElement, Promise<boolean>>();

/** Export reads computed visibility, so opening chrome must settle before capture. */
export async function waitForInitialViewport(canvas: HTMLElement | null, signal: AbortSignal): Promise<void> {
  const ready = canvas && opening.get(canvas);
  if (signal.aborted || (canvas && !canvas.isConnected) || (ready && !await ready)) {
    throw new DOMException('The document closed before its canvas was ready to export', 'AbortError');
  }
  // A navigation can dispose the view while its opening promise is settling.
  if (signal.aborted || (canvas && !canvas.isConnected)) {
    throw new DOMException('The document closed before its canvas was ready to export', 'AbortError');
  }
}

/** Reveal once the first fitted geometry settles; later gestures remain untouched. */
export function revealInitialViewport(canvas: HTMLElement, options: InitialViewportOptions): void {
  if (opening.has(canvas) || options.signal.aborted || !options.pending()) return;
  const browser = canvas.ownerDocument.defaultView;
  if (!browser) return;
  let complete!: (revealed: boolean) => void;
  opening.set(canvas, new Promise(resolve => { complete = resolve; }));
  let frame = 0;
  let timer = 0;
  let stableFrames = 0;
  let baseline: number[] | undefined;
  let stopped = false;
  let fontsReady = !canvas.ownerDocument.fonts;
  const settle = (revealed: boolean): void => {
    stopped = true;
    browser.cancelAnimationFrame(frame);
    browser.clearTimeout(timer);
    options.signal.removeEventListener('abort', stop);
    opening.delete(canvas);
    complete(revealed);
  };
  const stop = (): void => { settle(false); };
  const finish = (): void => {
    if (stopped) return;
    const current = canvas.isConnected && !options.signal.aborted && options.pending();
    if (!current) { stop(); return; }
    try { options.reveal(); } catch (error) { stop(); throw error; }
    settle(true);
  };
  const measure = (): void => {
    if (stopped) return;
    if (!canvas.isConnected || options.signal.aborted || !options.pending()) { stop(); return; }
    const rect = canvas.getBoundingClientRect();
    const next = [rect.x, rect.y, rect.width, rect.height];
    // Compare the whole quiet interval, so a slow spring cannot creep past the check.
    if (fontsReady && baseline && next.every((value, i) => Math.abs(value - baseline![i]!) < 0.05)) stableFrames++;
    else { baseline = next; stableFrames = 0; }
    if (stableFrames >= 4) finish();
    else frame = browser.requestAnimationFrame(measure);
  };
  options.signal.addEventListener('abort', stop, { once: true });
  try { options.initialize(); } catch (error) { finish(); throw error; }
  if (stopped) return;
  void canvas.ownerDocument.fonts?.ready.then(() => { if (!stopped) fontsReady = true; });
  // Background tabs, late fonts and continuous resizing must not leave an editor hidden.
  timer = browser.setTimeout(finish, 500);
  frame = browser.requestAnimationFrame(measure);
}
