// SPDX-License-Identifier: MPL-2.0
/**
 * The trusted render: validated staged data in, stereo PCM and findings out.
 *
 * Upstream's fixed DSP interpreter (`renderMix`, via generated/render.mjs) reads
 * the data and nothing else; no song code runs here. What the render cannot
 * produce is reported by name rather than passed off as silence, which is the
 * document model's rule for a part a host cannot render
 * (docs/spec/document-model/09-extensions.md).
 */
import { RONDO_LIMITS } from './limits.ts';
import { builtInSampleNames, renderMix, sampleNamesIn, usesMicIn } from '../generated/render.mjs';
import type { GraphData, StagedSong } from './staged.ts';
import type { PreparedSong } from './vm.ts';

export interface RondoFinding {
  /** Stable code: rondo.part.sing, rondo.part.mic, rondo.part.sample, rondo.part.ddsp, rondo.limits.length, rondo.warning. */
  code: string;
  /** One plain sentence for a person. */
  message: string;
  /** The synths, samples or models it concerns. */
  parts: string[];
}

export interface RenderedPcm {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  /** True when upstream scaled a hot mix down to its 0.89 ceiling. */
  normalized: boolean;
}

export class RenderError extends Error {
  override name = 'RenderError';
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const list = (xs: Iterable<string>): string[] => [...new Set(xs)].sort();
const join = (xs: string[]): string => (xs.length > 6 ? `${xs.slice(0, 6).join(', ')} and ${xs.length - 6} more` : xs.join(', '));

const graphsOf = (song: StagedSong): { owner: string; graph: GraphData }[] => {
  const out: { owner: string; graph: GraphData }[] = [];
  for (const [name, def] of song.synths) {
    out.push({ owner: name, graph: def.graph });
    if (def.post) out.push({ owner: name, graph: def.post });
  }
  for (const [name, bus] of song.buses) out.push({ owner: name, graph: bus.graph });
  return out;
};

/** What this render cannot play, named. */
export function findingsFor(song: StagedSong, prepared: PreparedSong): RondoFinding[] {
  const findings: RondoFinding[] = [];
  const sung = list(prepared.sings.map((s) => s.synth));
  if (sung.length) {
    findings.push({ code: 'rondo.part.sing', message: `Sung parts need the singing models, so these are silent: ${join(sung)}.`, parts: sung });
  }
  const builtIn = new Set(builtInSampleNames());
  const mic: string[] = [];
  const samples: string[] = [];
  const models: string[] = [];
  for (const { owner, graph } of graphsOf(song)) {
    if (usesMicIn(graph)) mic.push(owner);
    for (const name of sampleNamesIn(graph)) if (!builtIn.has(name)) samples.push(name);
    for (const n of graph.nodes) {
      if (n.type === 'ddsp' && typeof n.config?.model === 'string') models.push(n.config.model);
    }
  }
  if (mic.length) {
    const m = list(mic);
    findings.push({ code: 'rondo.part.mic', message: `Parts that play the live microphone are silent in a render: ${join(m)}.`, parts: m });
  }
  if (samples.length) {
    const s = list(samples);
    findings.push({ code: 'rondo.part.sample', message: `Samples loaded into the editor do not travel with a song, so these are silent: ${join(s)}.`, parts: s });
  }
  if (models.length) {
    const d = list(models);
    findings.push({ code: 'rondo.part.ddsp', message: `Instrument models loaded into the editor do not travel with a song, so these are silent: ${join(d)}.`, parts: d });
  }
  for (const w of prepared.warnings) {
    findings.push({ code: 'rondo.warning', message: w.line ? `Line ${w.line}: ${w.message}` : w.message, parts: [] });
  }
  return findings;
}

/** Render validated staged data for `seconds` at the fixed sample rate. */
export function renderStagedSong(song: StagedSong, seconds: number): RenderedPcm {
  const opts: Record<string, unknown> = { sampleRate: RONDO_LIMITS.sampleRate, cps: song.cps };
  // Same option assembly as upstream's mixOptsFor: the bytes match upstream's render.
  if (song.sidechain) opts.sidechain = song.sidechain;
  if (song.masterComp) opts.masterComp = song.masterComp;
  if (song.masterGain !== undefined) opts.masterGain = song.masterGain;
  if (song.stereo !== undefined) opts.stereo = song.stereo;
  if (song.buses.size > 0) {
    opts.buses = song.buses;
    opts.sends = song.sends;
  }
  if (Object.keys(song.wavetables).length > 0) opts.wavetables = song.wavetables;
  const mix = renderMix(song.synths, song.events, seconds, opts);
  for (const ch of [mix.left, mix.right]) {
    for (let i = 0; i < ch.length; i++) {
      if (!Number.isFinite(ch[i] as number)) throw new RenderError('the render produced samples that are not numbers', 'rondo.render.nonfinite');
    }
  }
  return { sampleRate: mix.sampleRate, left: mix.left, right: mix.right, normalized: mix.normalized };
}
