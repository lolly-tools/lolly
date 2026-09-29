// SPDX-License-Identifier: MPL-2.0
import { assertMotionRequest, blurEnabled } from '../../../../engine/src/motion-sampling.ts';
import { authoredMotionBlur } from './sequence-range.ts';
import { wantsCuts } from './sequence-cuts.ts';
import type { ExportOpts } from './export.ts';

export function sequenceExportRequest(node: Element, format: string, opts: ExportOpts, timed: boolean): { opts: ExportOpts; samples: boolean } {
  if (opts.sampleTimes) opts = { ...opts, motionBlur: authoredMotionBlur(node, opts.motionBlur) };
  assertMotionRequest(format, opts);
  if ((blurEnabled(opts.motionBlur) || opts.sequenceRange) && !timed) throw new Error('Motion settings require a timed Sequence composition.');
  if ((opts.sampleTimes !== undefined || (opts.cuts ?? 1) > 1) && !timed) throw new Error('Timeline samples need a timed composition.');
  return { opts, samples: timed && (opts.sampleTimes !== undefined || wantsCuts(format, opts.cuts, true)) };
}
