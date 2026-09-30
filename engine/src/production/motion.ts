// SPDX-License-Identifier: MPL-2.0
/** Encoded delivery requirements and explicitly sampled appearance coverage. */
import { compareProductionPixels } from './compare.ts';
import type { ProductionCheck, ProductionFacts, ProductionMotionContract } from './types.ts';

export function motionProductionChecks(contract: ProductionMotionContract, facts: ProductionFacts): ProductionCheck[] {
  const m = contract.motion, f = facts.motion ?? {};
  const check = (id: string, actual: number | boolean | null | undefined, expected: number | boolean, tolerance = 0, operator?: 'max' | 'min'): ProductionCheck => {
    const measured = typeof actual === 'boolean' ? String(actual) : actual === null ? 'non-finite' : actual;
    const want = typeof expected === 'boolean' ? String(expected) : expected;
    const pass = measured === undefined ? undefined : typeof want === 'number' ? typeof measured === 'number' && Number.isFinite(measured)
      && (operator === 'max' ? measured <= want : operator === 'min' ? measured >= want : Math.abs(measured - want) <= tolerance) : measured === want;
    return { id: `motion.${id}`, state: pass === undefined ? 'undetermined' : pass ? 'pass' : 'fail', method: 'decoded-media', location: `motion.${id}`, expected: want,
      ...(measured === undefined ? {} : { actual: measured }), ...(tolerance ? { tolerance } : {}), ...(operator ? { operator } : {}), waivable: false,
      reason: measured === undefined ? 'decoded-measurement-unavailable' : 'authored-motion-requirement' };
  };
  const checks = [check('seconds', f.seconds, m.seconds, m.secondsTolerance), check('fps', f.fps, m.fps, m.fpsTolerance),
    check('frameCount', f.frameCount, m.frameCount), check('timestampError', f.timestampError, m.timestampTolerance, 0, 'max'), check('audio', f.audio, m.audio)];
  if (m.audio) checks.push(check('audioSeconds', f.audioSeconds, m.seconds, m.audioSecondsTolerance),
    check('audioTimestampError', f.audioTimestampError, m.audioSecondsTolerance!, 0, 'max'));
  if (m.loudness) checks.push(check('loudness.min', f.loudness, m.loudness.min, 0, 'min'), check('loudness.max', f.loudness, m.loudness.max, 0, 'max'));
  if (m.truePeakMax !== undefined) checks.push(check('truePeak', f.truePeak, m.truePeakMax, 0, 'max'));
  if (m.comparison) for (const [index, time] of m.comparison.times.entries()) {
    const sample = f.samples?.filter(s => s.time === time);
    checks.push(check(`sample.${index}.timestamp`, sample?.length === 1 ? sample[0]!.timestamp : undefined, time, m.timestampTolerance));
  }
  return checks;
}

export function compareProductionMotion(reference: ProductionFacts | undefined, candidate: ProductionFacts, contract: ProductionMotionContract, signal?: AbortSignal): ProductionCheck[] {
  const p = contract.motion.comparison;
  if (!p) return [];
  return p.times.flatMap((time, index) => {
    const a = reference?.motion?.samples?.filter(s => s.time === time), b = candidate.motion?.samples?.filter(s => s.time === time);
    const valid = (samples: typeof a) => samples?.length === 1 && Math.abs(samples[0]!.timestamp - time) <= contract.motion.timestampTolerance ? samples[0]!.pixels : undefined;
    return compareProductionPixels(valid(a), valid(b), p, signal).map(check => ({ ...check, id: `sample.${index}.${check.id}`, location: `time:${time}/${check.location}`,
      expected: check.id === 'appearance.whole' ? p.maxChangedFraction : check.id.endsWith('.ssim') ? p.regions.find(r => `appearance.${r.id}.ssim` === check.id)!.minSsim : p.regions.find(r => `appearance.${r.id}.ink` === check.id)!.maxInkDelta,
      operator: check.id.endsWith('.ssim') ? 'min' as const : 'max' as const,
    }));
  });
}
