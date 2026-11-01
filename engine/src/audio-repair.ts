// SPDX-License-Identifier: MPL-2.0
/**
 * audio-repair.ts - the plan for model-free audio repair (plans/342, package K4).
 *
 * Turns a person's choices (hum, noise, harsh "s" sounds, clicks, room echo) into an
 * ordered list of stages with fixed settings and a plain-words label for each. Pure
 * and deterministic. The engine never runs the stages: a shell with the audio module
 * does, then hands the repaired PCM to `cleanAudioPcm` as `repaired`. That keeps the
 * engine free of WebAssembly, and the same plan runs the same stages in the browser
 * and in Node.
 *
 * Model-free means plain signal processing, with no downloaded model: it works
 * offline and in the command line, and it sits next to the model-based speech
 * clean-up (`denoise` in `CleanPcmOptions`), not in place of the model.
 */

export type RepairStrength = 'off' | 'light' | 'strong';

export interface AudioRepairOpts {
  /** Steady background noise (fans, hiss, air handling). */
  noise?: RepairStrength;
  /** Mains hum and its harmonics: 50 Hz or 60 Hz. */
  hum?: 'off' | '50' | '60';
  /** Harsh "s" and "sh" sounds. */
  deEss?: RepairStrength;
  /** Clicks and pops. */
  declick?: boolean;
  /** Room echo and reverberant tails. */
  dereverb?: RepairStrength;
}

/** Ids of the stages the audio module knows. */
export type RepairStageId = 'declick' | 'dehum' | 'denoise' | 'dereverb' | 'deesser';

export interface RepairStage {
  id: RepairStageId;
  /** Parameter values by the module's parameter ids. */
  params: Record<string, number>;
  /** What to tell the person happened. */
  label: string;
}

/** Whether any repair is requested. */
export function repairRequested(opts: AudioRepairOpts | undefined): boolean {
  if (!opts) return false;
  return (opts.noise ?? 'off') !== 'off' || (opts.hum ?? 'off') !== 'off' || (opts.deEss ?? 'off') !== 'off'
    || Boolean(opts.declick) || (opts.dereverb ?? 'off') !== 'off';
}

const NOISE = {
  light: { reduction: 8, threshold: 6, smoothing: 60 },
  strong: { reduction: 18, threshold: 6, smoothing: 50 },
} as const;
const DE_ESS = {
  light: { frequency: 6000, threshold: -14, reduction: 5 },
  strong: { frequency: 6000, threshold: -20, reduction: 12 },
} as const;
const DEREVERB = {
  light: { amount: 35, rt60: 0.8 },
  strong: { amount: 70, rt60: 1.0 },
} as const;

/**
 * The stages to run, in the order that works best: clicks first (so they do not smear
 * through the spectral stages), then hum, noise, room echo and finally the "s" sounds.
 */
export function planRepair(opts: AudioRepairOpts | undefined): RepairStage[] {
  const stages: RepairStage[] = [];
  if (!opts) return stages;
  if (opts.declick) stages.push({ id: 'declick', params: { threshold: 30, complexity: 16 }, label: 'Repaired clicks and pops' });
  if (opts.hum === '50' || opts.hum === '60') {
    stages.push({
      id: 'dehum',
      params: { frequency: opts.hum === '60' ? 1 : 0, harmonics: 5, q: 30, amount: 100 },
      label: `Removed ${opts.hum} Hz hum`,
    });
  }
  if (opts.noise === 'light' || opts.noise === 'strong') {
    stages.push({ id: 'denoise', params: { ...NOISE[opts.noise] }, label: `${opts.noise === 'strong' ? 'Strongly reduced' : 'Reduced'} steady background noise` });
  }
  if (opts.dereverb === 'light' || opts.dereverb === 'strong') {
    stages.push({ id: 'dereverb', params: { ...DEREVERB[opts.dereverb] }, label: `${opts.dereverb === 'strong' ? 'Strongly reduced' : 'Reduced'} room echo` });
  }
  if (opts.deEss === 'light' || opts.deEss === 'strong') {
    stages.push({ id: 'deesser', params: { ...DE_ESS[opts.deEss] }, label: `${opts.deEss === 'strong' ? 'Strongly softened' : 'Softened'} harsh s sounds` });
  }
  return stages;
}
