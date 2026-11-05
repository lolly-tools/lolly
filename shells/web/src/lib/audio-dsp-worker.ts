// SPDX-License-Identifier: MPL-2.0
/**
 * Audio DSP worker. Loudness metering, repair stages and clip alignment are real work on
 * a long recording (a 10 minute stereo file is tens of millions of samples through
 * spectral stages), so they run here and the page stays responsive. The module is
 * fetched on first use and the PCM arrives by structured clone.
 */
import { createAudioDspKernel, type AudioDspKernel } from '../../../../packages/node-shell/src/audio-dsp.ts';
import type { RepairStage } from '../../../../engine/src/audio-repair.ts';

type Request =
  | { id: number; op: 'measure'; channels: Float32Array[]; sampleRate: number; series: boolean; monoAsStereo: boolean }
  | { id: number; op: 'repair'; channels: Float32Array[]; sampleRate: number; stages: RepairStage[] }
  | { id: number; op: 'align'; a: Float32Array[]; b: Float32Array[]; sampleRate: number; maxLagSeconds?: number };

const post = postMessage as (message: unknown, transfer: Transferable[]) => void;

let kernel: Promise<AudioDspKernel> | undefined;
function load(): Promise<AudioDspKernel> {
  kernel ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/audio-dsp/audio-dsp.wasm', import.meta.url));
    if (!response.ok) throw new Error('The audio module could not be loaded.');
    return createAudioDspKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { kernel = undefined; throw error; });
  return kernel;
}

addEventListener('message', (e: MessageEvent<Request>) => {
  const req = e.data;
  void (async () => {
    try {
      const k = await load();
      if (req.op === 'measure') post({ id: req.id, result: k.measureLoudness(req.channels, req.sampleRate, { series: req.series, monoAsStereo: req.monoAsStereo }) }, []);
      else if (req.op === 'repair') {
        const result = k.repair(req.channels, req.sampleRate, req.stages);
        post({ id: req.id, result }, result.channels.map(c => c.buffer as ArrayBuffer));
      } else post({ id: req.id, result: k.alignClips(req.a, req.b, req.sampleRate, req.maxLagSeconds === undefined ? {} : { maxLagSeconds: req.maxLagSeconds }) }, []);
    } catch (err) {
      post({ id: req.id, error: err instanceof Error ? err.message : String(err) }, []);
    }
  })();
});
