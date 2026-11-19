// SPDX-License-Identifier: MPL-2.0
/**
 * Cover Flow's Open control stays out of the way while the fan moves and comes
 * back once a cover has rested in the centre, as the Open button on the /info
 * landing does (lib/covers-flow.ts, REST_MS). The fan moves by writing the
 * viewport's scroll position, so a scroll event is the one signal for "moving".
 *
 * The control keeps its place in the tab order. The stylesheet shows the button
 * while the keyboard is on the control, whatever the fan is doing.
 */

/** How long a cover rests in the centre before Open appears. The same wait as /info. */
export const OPEN_REST_MS = 900;

/** Show `button` (`.is-on`) only while `viewport` has been still for `restMs`. */
export function showOpenAtRest(viewport: HTMLElement, button: HTMLElement, signal: AbortSignal, restMs = OPEN_REST_MS): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const rest = (): void => {
    clearTimeout(timer);
    timer = setTimeout(() => button.classList.add('is-on'), restMs);
  };
  viewport.addEventListener('scroll', () => { button.classList.remove('is-on'); rest(); }, { signal, passive: true });
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  rest();
}
