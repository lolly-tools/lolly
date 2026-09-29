// SPDX-License-Identifier: MPL-2.0
import { VIDEO_CODEC_STRINGS, validateSampleTimes, validateMotionBlur, validateMotionRange, type MotionBlur, type MotionRange } from '@lolly/engine';
import type { VideoCodecName, VideoQuality } from '../../../engine/src/url-mode.ts';

export interface MotionExportSettings {
  motionBlur?: MotionBlur;
  sequenceRange?: MotionRange;
  sampleTimes?: number[];
  fps?: number;
  seconds?: number;
  wait?: number;
  codec?: VideoCodecName;
  vq?: VideoQuality;
}

export const MOTION_EXPORT_ARGS = {
  motionBlur: { type: 'object', properties: { samples: { type: 'integer', enum: [1, 4, 8, 16] }, shutterAngle: { type: 'number', minimum: 0, maximum: 360 } }, required: ['samples', 'shutterAngle'], additionalProperties: false, description: 'Temporal exposure for deterministic Sequence exports. Off when absent. SDR sRGB only.' },
  sequenceRange: { type: 'object', properties: { from: { type: 'number', minimum: 0 }, to: { type: 'number', maximum: 3600 } }, required: ['from', 'to'], additionalProperties: false, description: 'Temporary authored in/out seconds for a movie preview, including the full mix. Saved markers are unchanged.' },
  sampleTimes: { type: 'array', minItems: 1, maxItems: 64, items: { type: 'number', minimum: 0, maximum: 3600 }, description: 'Exact authored timeline seconds for still export, strictly increasing and before the timeline end. One time returns one still; several return a ZIP or paged PDF. Cannot combine with cuts.' },
  fps: { type: 'integer', minimum: 1, maximum: 120, description: 'Movie frames per second. Overrides the project rate without changing playback speed.' },
  seconds: { type: 'number', minimum: 0.5, maximum: 3600, description: 'Requested movie length in seconds. Omit to use the composition duration.' },
  wait: { type: 'number', minimum: 0, maximum: 30, description: 'Settle time before capture, in seconds. Does not seek the timeline.' },
  codec: { type: 'string', enum: Object.keys(VIDEO_CODEC_STRINGS), description: 'Requested video codec; availability depends on the browser render tier.' },
  vq: { type: 'string', enum: ['smaller', 'balanced', 'best'], description: 'Video quality setting.' },
};

/** Reject invalid explicit settings before they can become default exports. */
export function motionExportSettings(args: Record<string, unknown>): MotionExportSettings {
  const result: MotionExportSettings = {};
  if (args.motionBlur !== undefined) result.motionBlur = validateMotionBlur(args.motionBlur);
  if (args.sequenceRange !== undefined) result.sequenceRange = validateMotionRange(args.sequenceRange);
  if (args.sampleTimes !== undefined) result.sampleTimes = validateSampleTimes(args.sampleTimes);
  if (result.sampleTimes && Number(args.cuts) > 1) throw new Error('Choose cuts or sampleTimes, not both.');
  for (const key of ['fps', 'seconds', 'wait'] as const) {
    const value = args[key];
    if (value === undefined) continue;
    const rule = MOTION_EXPORT_ARGS[key];
    if (typeof value !== 'number' || !Number.isFinite(value)
      || value < rule.minimum || value > rule.maximum || (key === 'fps' && !Number.isInteger(value))) {
      throw new Error(`${key} must be ${key === 'fps' ? 'an integer' : 'a number'} from ${rule.minimum} to ${rule.maximum}.`);
    }
    result[key] = value;
  }
  if (args.codec !== undefined) {
    if (typeof args.codec !== 'string' || !Object.hasOwn(VIDEO_CODEC_STRINGS, args.codec)) {
      throw new Error(`codec must be one of ${MOTION_EXPORT_ARGS.codec.enum.join(', ')}.`);
    }
    result.codec = args.codec as VideoCodecName;
  }
  if (args.vq !== undefined) {
    if (typeof args.vq !== 'string' || !MOTION_EXPORT_ARGS.vq.enum.includes(args.vq)) {
      throw new Error('vq must be smaller, balanced or best.');
    }
    result.vq = args.vq as VideoQuality;
  }
  return result;
}
