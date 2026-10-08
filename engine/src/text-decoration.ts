// SPDX-License-Identifier: MPL-2.0
/** Font-instance ascent facts for CSS strike paint, validated before drawing. HarfBuzz owns OpenType
 * ascent lookup and variation interpolation on the same instance that shapes the run.
 */
export interface StrikeMetrics { upem: number; ascent: number }
/** A strike rectangle relative to the run's baseline. */
export interface DrawStrike { y: number; height: number; width: number }

/** Missing or unusable font metrics must never become guessed decoration paint. */
export function strikeMetricsFact(upem: number, ascent: number | undefined): StrikeMetrics | null {
  if (!Number.isFinite(upem) || upem < 16 || upem > 16384 || ascent === undefined
    || !Number.isFinite(ascent) || ascent <= 0 || ascent > upem * 2) return null;
  return { upem, ascent };
}

/** Current Design HTML uses CSS auto line-through: one tenth em (at least 1px),
 * centered one third of the face ascent above the baseline. This is the pinned
 * Chromium reference policy, not the font OS/2 strike position/thickness.
 * Reference: Chromium 153.0.8010.12 text_decoration_info.cc and decoration_line_painter.cc.
 */
export function strikeGeometry(metrics: StrikeMetrics | null, size: number, width: number, baseline = 0): DrawStrike | null {
  if (!metrics || !strikeMetricsFact(metrics.upem, metrics.ascent)
    || !Number.isFinite(size) || size <= 0 || size > 16384 || !Number.isFinite(width) || width < 0 || width > 1e7 || !Number.isFinite(baseline) || Math.abs(baseline) > 1e7) return null;
  const height = Math.max(1, size / 10);
  const ascent = metrics.ascent * size / metrics.upem;
  // HTML layout uses the whole-pixel ascent; decoration paint uses FloatAscent
  // from the text top. Preserve that distinction before the solid-line snap.
  const top = baseline - Math.round(ascent) + 2 * ascent / 3 - height / 2;
  // Native HTML solid decoration snaps its local paint Y and floors thickness;
  // SVG text does not. Capture that before either emitter applies the row pose.
  return { y: Math.floor(top + .5) - baseline, height: Math.floor(height), width };
}
