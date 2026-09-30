// SPDX-License-Identifier: MPL-2.0
import type { ProductionCheck, ProductionComparison, ProductionPixels } from './types.ts';
export const PRODUCTION_MAX_PIXELS = 16_000_000;
export function validProductionPixels(p: ProductionPixels | undefined): p is ProductionPixels {
  return !!p && Number.isSafeInteger(p.width) && p.width > 0 && Number.isSafeInteger(p.height) && p.height > 0
    && p.width * p.height <= PRODUCTION_MAX_PIXELS && (p.rgba instanceof Uint8Array || p.rgba instanceof Uint8ClampedArray)
    && p.rgba.length === p.width * p.height * 4;
}
/** Native RGBA comparison. No resize, alignment, or white-only alpha erasure. */
export function compareProductionPixels(a: ProductionPixels | undefined, b: ProductionPixels | undefined, policy: ProductionComparison, signal?: AbortSignal): ProductionCheck[] {
  const check = (id: string, location: string, pass: boolean | undefined, reason: string, actual?: number, expected?: number): ProductionCheck => ({
    id, location, state: pass === undefined ? 'undetermined' : pass ? 'pass' : 'fail', method: 'decoded-pixels', reason, waivable: true,
    ...(actual === undefined ? {} : { actual }), ...(expected === undefined ? {} : { expected }),
  });
  if (!validProductionPixels(a) || !validProductionPixels(b)) return [check('appearance.whole', 'artifact', undefined, 'native-pixels-unavailable'),
    ...policy.regions.flatMap(r => [check(`appearance.${r.id}.ssim`, r.id, undefined, 'native-pixels-unavailable'), check(`appearance.${r.id}.ink`, r.id, undefined, 'native-pixels-unavailable')])];
  if (a.width !== b.width || a.height !== b.height) return [check('appearance.whole', 'artifact', false, 'native-size-mismatch'),
    ...policy.regions.flatMap(r => [check(`appearance.${r.id}.ssim`, r.id, undefined, 'native-size-mismatch'), check(`appearance.${r.id}.ink`, r.id, undefined, 'native-size-mismatch')])];
  let changed = 0;
  for (let i = 0; i < a.rgba.length; i += 4) {
    if (i % 65536 === 0) signal?.throwIfAborted();
    let delta = 0;
    for (let c = 0; c < 4; c++) delta = Math.max(delta, Math.abs(a.rgba[i + c]! - b.rgba[i + c]!));
    if (delta > policy.channelTolerance) changed++;
  }
  const fraction = changed / (a.width * a.height);
  const out = [check('appearance.whole', 'artifact', fraction <= policy.maxChangedFraction, 'native-rgba-changed-fraction', fraction, policy.maxChangedFraction)];
  // Region luminance includes alpha; whole-image RGBA still catches hidden RGB and alpha changes.
  const lum = (p: ProductionPixels, i: number): number => (p.rgba[i]! * .2126 + p.rgba[i + 1]! * .7152 + p.rgba[i + 2]! * .0722) * p.rgba[i + 3]! / 255 + 255 - p.rgba[i + 3]!;
  let regionPixels = 0;
  for (const r of policy.regions) {
    signal?.throwIfAborted(); regionPixels += r.width * r.height;
    if (r.x + r.width > a.width || r.y + r.height > a.height || regionPixels > PRODUCTION_MAX_PIXELS * 4) {
      out.push(check(`appearance.${r.id}.ssim`, r.id, undefined, 'region-budget-or-bounds'), check(`appearance.${r.id}.ink`, r.id, undefined, 'region-budget-or-bounds')); continue;
    }
    let ma = 0, mb = 0, aa = 0, bb = 0, ab = 0, samples = 0, ia = 0, ib = 0;
    const n = r.width * r.height;
    for (let y = r.y; y < r.y + r.height; y++) {
      if (y % 64 === 0) signal?.throwIfAborted();
      for (let x = r.x; x < r.x + r.width; x++) {
        const i = (y * a.width + x) * 4, va = lum(a, i), vb = lum(b, i);
        samples++; const da = va - ma, db = vb - mb; ma += da / samples; mb += db / samples;
        aa += da * (va - ma); bb += db * (vb - mb); ab += da * (vb - mb);
        if (va < 250) ia++; if (vb < 250) ib++;
      }
    }
    const va = Math.max(0, aa / n), vb = Math.max(0, bb / n), cov = ab / n;
    const ssim = ((2 * ma * mb + 6.5025) * (2 * cov + 58.5225)) / ((ma * ma + mb * mb + 6.5025) * (va + vb + 58.5225));
    const ink = Math.abs(ia - ib) / n;
    out.push(check(`appearance.${r.id}.ssim`, r.id, ssim >= r.minSsim, 'region-luminance-ssim', ssim, r.minSsim), check(`appearance.${r.id}.ink`, r.id, ink <= r.maxInkDelta, 'region-ink-fraction-delta', ink, r.maxInkDelta));
  }
  return out;
}
