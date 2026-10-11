// SPDX-License-Identifier: MPL-2.0

interface InitialViewportOptions {
  signal: AbortSignal;
  pending: () => boolean;
  initialize: () => void;
  reveal: () => void;
}

const opening = new WeakSet<HTMLElement>();

/** Reveal once the first fitted geometry settles; later gestures remain untouched. */
export function revealInitialViewport(canvas: HTMLElement, options: InitialViewportOptions): void {
  if (opening.has(canvas) || options.signal.aborted || !options.pending()) return;
  const browser = canvas.ownerDocument.defaultView;
  if (!browser) return;
  opening.add(canvas);
  let frame = 0;
  let timer = 0;
  let stableFrames = 0;
  let baseline: number[] | undefined;
  let stopped = false;
  let fontsReady = !canvas.ownerDocument.fonts;
  const stop = (): void => {
    stopped = true;
    browser.cancelAnimationFrame(frame);
    browser.clearTimeout(timer);
    options.signal.removeEventListener('abort', stop);
    opening.delete(canvas);
  };
  const finish = (): void => {
    if (stopped) return;
    const current = canvas.isConnected && !options.signal.aborted && options.pending();
    stop();
    if (current) options.reveal();
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
