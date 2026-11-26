// SPDX-License-Identifier: MPL-2.0
/**
 * The canvas's on-screen scale, published for tools that draw their own controls.
 *
 * The fit (views/tool/stage-layout.ts) scales `#tool-canvas` to the stage, and the stage
 * navigation zooms it again (views/tool-stage-nav.ts). Their product, the number of
 * screen pixels per canvas pixel, is written as `--lolly-stage-scale` on the live
 * `#tool-canvas`, so a data tool that has not moved its controls to the stage kit can
 * still hold them at screen size: `calc(44px / var(--lolly-stage-scale, 1))`.
 *
 * Three rules keep it honest. It is written only on the live canvas, by the fit and the
 * stage zoom. An export takes it away for as long as the export runs (`holdStageScale`,
 * views/tool/exporting.ts), so a render reads the tool's own fallback, exactly as an
 * offscreen stage or the CLI does. And nothing in the shell reads it: it is a bridge for
 * tools, not a value the shell lays itself out by (lib/stage-scale.test.ts pins that).
 */
export const STAGE_SCALE_PROP = '--lolly-stage-scale';

interface ScaleState { holds: number; latest: string }
const states = new WeakMap<HTMLElement, ScaleState>();

function stateOf(canvas: HTMLElement): ScaleState {
  let s = states.get(canvas);
  if (!s) { s = { holds: 0, latest: '' }; states.set(canvas, s); }
  return s;
}

/** Write the canvas's on-screen scale. A value that is not a positive number is ignored. */
export function publishStageScale(canvas: HTMLElement | null | undefined, scale: number): void {
  if (!canvas || !Number.isFinite(scale) || !(scale > 0)) return;
  const value = String(Math.round(scale * 10_000) / 10_000);
  const s = stateOf(canvas);
  s.latest = value;
  if (s.holds) return;
  if (canvas.style.getPropertyValue(STAGE_SCALE_PROP) !== value) canvas.style.setProperty(STAGE_SCALE_PROP, value);
}

/**
 * Take the scale off the canvas until the returned release is called, then put back the
 * latest value written meanwhile. Holds nest; the release is idempotent.
 */
export function holdStageScale(canvas: HTMLElement | null | undefined): () => void {
  if (!canvas) return () => {};
  const s = stateOf(canvas);
  if (s.holds++ === 0) canvas.style.removeProperty(STAGE_SCALE_PROP);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--s.holds) return;
    if (s.latest) canvas.style.setProperty(STAGE_SCALE_PROP, s.latest);
  };
}
