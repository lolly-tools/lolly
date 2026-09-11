// SPDX-License-Identifier: MPL-2.0
/**
 * Pure video-exposure coaching - the DOM-free core behind the record tool's live
 * exposure warnings. This is the VISUAL counterpart to audio-coach-core.ts: where that
 * turns an `AudioLevel` into a levels/room verdict, this turns a camera frame's luma
 * statistics into a plain-language exposure verdict - too dark, too bright, or
 * overexposed (blown highlights / backlit).
 *
 * Two steps, both pure (no DOM, no `announce`) so they can be unit tested directly
 * (see tests/video-coaching.test.ts):
 *   - frameLuma(rgba) → LumaStats   (mean brightness + clipped-pixel fractions)
 *   - coachVideo(stats) → VideoCoaching   (tone / warning / recording-tip cue)
 * The DOM HUD that shows the verdict lives in audio-coaching.ts (mountCoachHud); the
 * frame sampling that feeds it lives in views/record-control.ts.
 */
import type { TipCue } from './recording-tips.ts';

export interface LumaStats {
  /** Mean luma across the sampled pixels, 0..1 (0 = black, 1 = white). */
  mean: number;
  /** Fraction of sampled pixels at/near pure white - blown highlights, 0..1. */
  clipHi: number;
  /** Fraction of sampled pixels at/near pure black - crushed shadows, 0..1. */
  clipLo: number;
  /** How many pixels were actually sampled (0 = nothing worth judging yet). */
  samples: number;
}

export interface VideoCoaching {
  tone: 'ok' | 'low' | 'hot';
  warning: string;      // '' when there's nothing to say
  cue: TipCue | null;   // recording-tip cue this exposure argues for (null = flag nothing)
}

// Rec. 709 luma weights ×256 (integers so the hot inner loop stays in ints; sum = 256,
// so `>> 8` maps a weighted RGB back to 0..255).
const LR = 54, LG = 183, LB = 19;
const HI = 244;  // a channel-luma ≥ this (of 255) counts as a blown-white pixel
const LO = 8;    // ≤ this counts as a crushed-black pixel

/**
 * Average luma + clipped-pixel fractions from tightly-packed RGBA bytes (as from
 * MediaFrame.data / getImageData). Subsamples with an even stride to visit at most
 * ~`cap` pixels, so it stays cheap to run several times a second on a live frame.
 */
export function frameLuma(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  cap = 4096,
): LumaStats {
  const px = Math.max(0, Math.floor(width)) * Math.max(0, Math.floor(height));
  if (px === 0 || data.length < px * 4) return { mean: 0, clipHi: 0, clipLo: 0, samples: 0 };
  const stride = Math.max(1, Math.floor(px / cap));
  let sum = 0, hi = 0, lo = 0, n = 0;
  for (let p = 0; p < px; p += stride) {
    const i = p * 4;
    // `?? 0` keeps TS's noUncheckedIndexedAccess happy; the length guard above means the
    // indices are always in range, so the fallback never actually fires.
    const y = ((data[i] ?? 0) * LR + (data[i + 1] ?? 0) * LG + (data[i + 2] ?? 0) * LB) >> 8;  // 0..255
    sum += y;
    if (y >= HI) hi++; else if (y <= LO) lo++;
    n++;
  }
  if (n === 0) return { mean: 0, clipHi: 0, clipLo: 0, samples: 0 };
  return { mean: sum / n / 255, clipHi: hi / n, clipLo: lo / n, samples: n };
}

// Exposure thresholds (mean luma / clipped fractions), tuned for a webcam self-view.
const DARK_MEAN = 0.16;    // average this dim = underlit
const BRIGHT_MEAN = 0.82;  // average this bright = overlit / washed out
const BLOWN_FRAC = 0.22;   // this share of the frame pure-white = blown highlights / backlit
const CRUSH_FRAC = 0.55;   // this share pure-black = mostly darkness (reinforces "too dark")
const MIN_SAMPLES = 64;    // below this we haven't really seen a frame yet - say nothing

/**
 * Turn a frame's LumaStats into an exposure verdict. Ordered by how actionable each
 * problem is: blown highlights first (fires even at a moderate mean - a backlit subject
 * is a dark face against a bright window), then washed-out bright, then too dark.
 */
export function coachVideo(stats: LumaStats): VideoCoaching {
  if (stats.samples < MIN_SAMPLES) return { tone: 'ok', warning: '', cue: null };
  if (stats.clipHi >= BLOWN_FRAC) {
    return {
      tone: 'hot', cue: 'glare',
      warning: 'Overexposed - highlights are blown out. Move out of direct sun, or don’t sit with a bright window behind you.',
    };
  }
  if (stats.mean >= BRIGHT_MEAN) {
    return { tone: 'hot', cue: 'bright', warning: 'Too bright - dim the light or step back a little.' };
  }
  if (stats.mean <= DARK_MEAN || stats.clipLo >= CRUSH_FRAC) {
    return { tone: 'low', cue: 'dark', warning: 'Too dark - add light or turn to face a window.' };
  }
  return { tone: 'ok', warning: '', cue: null };
}
