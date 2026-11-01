// SPDX-License-Identifier: MPL-2.0
/**
 * host.audio.clean's implementation - decode, resample, the engine's clean DSP,
 * optional on-device denoise, encode, and the video remux path. Loaded on demand
 * by bridge/audio.ts: the bridge is first-paint code and a clean is a user action,
 * so none of this may sit on the boot path (scripts/check-bundle-budget.ts).
 * `toPcm` is passed in rather than imported so this file never points back at
 * the bridge module that loads it.
 */
import type { AudioSource, AudioCleanOpts, AudioCleanResult } from '@lolly-tools/core/host-v1';
import { cleanAudioPcm, resamplePcm, cleanAudioPreview } from '../../../../engine/src/audio-clean.ts';
import { planRepair, repairRequested } from '../../../../engine/src/audio-repair.ts';
import type { AudioLoudnessReport } from '@lolly-tools/core/host-v1';

type Decoder = (src: AudioSource) => Promise<{ channels: Float32Array[]; sampleRate: number }>;

function videoHint(opts: AudioCleanOpts): boolean {
  return String(opts.sourceMime || '').startsWith('video/') || /\.(mp4|m4v|mov|webm|mkv)$/i.test(String(opts.sourceName || ''));
}

export async function runAudioClean(src: AudioSource, opts: AudioCleanOpts, toPcm: Decoder): Promise<AudioCleanResult> {
  const decoded = await toPcm(src);
  const channels = resamplePcm(decoded.channels, decoded.sampleRate);
  // Model-free repair first, in the audio worker. Its output is what the speech model sees.
  let repaired: Float32Array[] | undefined;
  let repairOperations: string[] = [];
  let clicksRepaired: number | undefined;
  if (repairRequested(opts.repair)) {
    const stages = planRepair(opts.repair);
    try {
      const { repairAudio } = await import('./audio-dsp.ts');
      const r = await repairAudio(channels.slice(0, 2), 48_000, stages);
      repaired = r.channels;
      repairOperations = stages.map(s => s.label);
      if (stages.some(s => s.id === 'declick')) clicksRepaired = r.clicksRepaired;
    } catch (error) {
      throw new Error(`audio clean: the repair step could not run (${String((error as Error)?.message || error)})`);
    }
  }
  let enhanced: Float32Array[] | undefined;
  if ((opts.denoise ?? 'off') !== 'off') {
    try {
      const { cleanPcm } = await import('../lib/audio-clean-core.ts');
      enhanced = await cleanPcm(repaired ?? channels, 48_000);
    } catch (error) {
      throw new Error(`audio clean: the on-device speech denoiser could not run (${String((error as Error)?.message || error)})`);
    }
  }
  const cleaned = cleanAudioPcm(channels, 48_000, {
    ...opts, trimSilence: videoHint(opts) ? false : opts.trimSilence,
    ...(enhanced ? { enhanced } : {}), ...(repaired ? { repaired, repairOperations } : {}),
  });
  // Full R128 readings of the input and the output. The true peak replaces the sample peak.
  let report: { before: AudioLoudnessReport; after: AudioLoudnessReport } | undefined;
  try {
    const { measureLoudness } = await import('./audio-dsp.ts');
    const [before, after] = await Promise.all([
      measureLoudness(channels.slice(0, 2), 48_000), measureLoudness(cleaned.channels, 48_000),
    ]);
    report = { before: before.report, after: after.report };
  } catch { /* A shell without the audio module reports integrated loudness only. */ }
  const result = {
    ...cleaned,
    ...(report ? { report, truePeakDb: report.after.truePeakDb ?? -Infinity } : {}),
    ...(clicksRepaired !== undefined ? { clicksRepaired } : {}),
  };
  const format = opts.output ?? 'wav';
  if (videoHint(opts)) {
    const { encodeAudio } = await import('../lib/audio-encode.ts');
    const { remuxCleanedTracks } = await import('./audio-clean-video.ts');
    const audioFormat = /webm|matroska/i.test(opts.sourceMime || '') || /\.(webm|mkv)$/i.test(opts.sourceName || '') ? 'opus' : 'm4a';
    const audioBlob = await encodeAudio(audioFormat, { channels: result.channels, sampleRate: result.sampleRate });
    let remuxed: { bytes: Uint8Array; mime: string; container: string };
    try { remuxed = await remuxCleanedTracks(src as Uint8Array, new Uint8Array(await audioBlob.arrayBuffer()), opts); }
    catch (error) { throw new Error(`audio clean: video remux failed (${String((error as Error)?.message || error)})`); }
    return {
      ...result, ...remuxed, format, preview: cleanAudioPreview(result),
      videoPreserved: true,
      operations: [...result.operations, `Copied every ${remuxed.container.toUpperCase()} picture packet unchanged; video timing and silent edges kept`],
    };
  }
  const { encodeAudio, audioMime } = await import('../lib/audio-encode.ts');
  let blob: Blob;
  try {
    blob = await encodeAudio(format, { channels: result.channels, sampleRate: result.sampleRate });
  } catch (error) {
    throw new Error(`audio clean: ${format} encoder is unavailable (${String((error as Error)?.message || error)})`);
  }
  return {
    ...result,
    bytes: new Uint8Array(await blob.arrayBuffer()), mime: audioMime(format), format, preview: cleanAudioPreview(result),
  };
}
