// SPDX-License-Identifier: MPL-2.0
/** Shutter integration around the shared sequence executor, including its media clocks. */
import { ShutterAccumulator, shutterTimes, type MotionBlur } from '../../../../engine/src/motion-sampling.ts';
import { KF_HOLD_EASE } from '../../../../engine/src/keyframes.ts';
import { crossfadeJunctions, sequenceError } from './sequence-plan.ts';
import type { AnyCanvas, AnyCtx, SeqJob, SeqJobIO } from './sequence-render.worker.ts';

export function shutterCuts(job: Pick<SeqJob, 'layers'>): number[] {
  const junctions = crossfadeJunctions(job.layers.map(layer => ({ ...layer, split: layer.split ?? '', splitUnits: layer.splitUnits ?? 0 })));
  const fadesIn = new Set(junctions.map(j => j.bIdx)), fadesOut = new Set(junctions.map(j => j.aIdx));
  const cuts = new Set<number>();
  for (const layer of job.layers) {
    if (layer.ignored || layer.kind === 'audio') continue;
    for (let i = 1; i < layer.kf.length; i++) if (layer.kf[i - 1]!.ease === KF_HOLD_EASE) cuts.add(layer.startMs + layer.kf[i]!.t);
    if (layer.kind === 'camera' || (!fadesIn.has(layer.idx) && (!layer.enter || layer.enter === 'none' || !layer.enterMs))) cuts.add(layer.startMs);
    if (!layer.openEnded && (layer.kind === 'camera' || (!fadesOut.has(layer.idx) && (!layer.exit || layer.exit === 'none' || !layer.exitMs)))) cuts.add(layer.startMs + layer.durMs);
  }
  return [...cuts].filter(Number.isFinite).sort((a, b) => a - b);
}

export async function runShutterJob(
  job: SeqJob, canvas: AnyCanvas, ctx: AnyCtx, io: SeqJobIO,
  run: (job: SeqJob, canvas: AnyCanvas, ctx: AnyCtx, io: SeqJobIO) => Promise<void>,
): Promise<void> {
  const blur = job.motionBlur as MotionBlur;
  const cuts = shutterCuts(job), grid: number[] = [], ends = new Map<number, number>();
  const from = job.rangeFromMs ?? job.grid[0] ?? 0, to = job.rangeToMs ?? job.totalMs;
  for (let i = 0; i < job.frameCount; i++) {
    grid.push(...shutterTimes(job.grid[i]!, job.fps, from, to, cuts, blur));
    ends.set(grid.length - 1, i);
  }
  const accumulator = new ShutterAccumulator(job.outW * job.outH * 4);
  io.log?.('info', `sequence: temporal motion blur ${blur.samples} samples, ${blur.shutterAngle} degrees, ${(1000 / job.fps * blur.shutterAngle / 360).toFixed(3)} ms exposure; ${job.outW * job.outH * 20} scratch bytes`);
  await run({ ...job, motionBlur: undefined, grid, frameCount: grid.length }, canvas, ctx, {
    ...io,
    progress: undefined,
    frame: async (c, cx, index) => {
      if (io.aborted?.()) throw new DOMException('Sequence export cancelled', 'AbortError');
      const pixels = cx.getImageData(0, 0, job.outW, job.outH);
      accumulator.add(pixels.data);
      const output = ends.get(index);
      if (output !== undefined) {
        accumulator.finish(pixels.data); cx.putImageData(pixels, 0, 0);
        await io.frame(c, cx, output, Math.round(output * 1e6 / job.fps));
        io.progress?.(output + 1, job.frameCount);
      }
      // Give cancellation and worker messages a turn between samples.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    },
  });
}

/** Refuse overlap before opening any source decoder. */
export function assertVideoOverlap(layers: readonly { idx: number; kind: string }[], count: number, windows: Map<number, { first: number; last: number }>, limit: number): void {
  let peak = 0;
  for (let i = 0; i < count; i++) {
    let n = 0;
    for (const layer of layers) {
      const window = windows.get(layer.idx);
      if (layer.kind === 'video' && window && window.first >= 0 && i >= window.first && i <= window.last) n++;
    }
    peak = Math.max(peak, n);
  }
  if (peak > limit) throw sequenceError('SEQ_TOO_HEAVY', `${peak} video clips overlap; at most ${limit} can be decoded at once`);
}
