// SPDX-License-Identifier: MPL-2.0
/**
 * @lolly-tools/rondo: a rondocode song in, stereo PCM out, on any shell.
 *
 *   1. Stage: the song's code runs in the `vm` class (src/vm.ts).
 *   2. Inspect: the staged data is validated as untrusted (src/staged.ts).
 *   3. Render: upstream's fixed DSP reads the data (src/render.ts).
 *
 * Every shell calls this one function, so web, CLI and MCP render the same bytes
 * from the same song. A shell owns two things only: loading the staging bundle's
 * text, and running this inside a worker it can stop.
 */
import { RONDO_LIMITS, type RondoLimits } from './limits.ts';
import { parseStaged } from './staged.ts';
import { findingsFor, renderStagedSong, type RondoFinding } from './render.ts';
import { stageInVm, EXECUTION_CLASS, VM_SEED, type PreparedSong } from './vm.ts';
import { ADAPTER_REVISION, UPSTREAM_COMMIT } from './extension.ts';

export { RONDO_LIMITS } from './limits.ts';
export { RONDO_EXTENSION, UPSTREAM_COMMIT, ADAPTER_REVISION } from './extension.ts';
export { VmError, SongError, EXECUTION_CLASS, VM_SEED, quickjs } from './vm.ts';
export { StagedError } from './staged.ts';
export { RenderError, type RondoFinding } from './render.ts';

export interface RondoRenderRequest {
  /** The song's source text. */
  source: string;
  /** Which language the source is in. 'auto' is upstream's sniff. Default 'auto'. */
  lang?: 'js' | 'rondo' | 'auto';
  /**
   * How long to render. Omitted: the song's own arrangement when there is one,
   * otherwise upstream's bounce default of 8 cycles. A clip asks for its own length.
   */
  seconds?: number;
}

export interface RondoRun {
  executionClass: typeof EXECUTION_CLASS;
  seed: number;
  upstream: string;
  adapter: number;
}

export interface RondoPcm {
  sampleRate: number;
  left: Float32Array;
  right: Float32Array;
  seconds: number;
  cycles: number;
  cps: number;
  lang: 'js' | 'rondo';
  normalized: boolean;
  findings: RondoFinding[];
  /** What ran it, for a receipt or a C2PA ingredient. */
  run: RondoRun;
}

export class RondoLimitError extends Error {
  override name = 'RondoLimitError';
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export interface RondoEnv {
  /** The text of generated/stage.js. */
  stageSource: string | (() => string | Promise<string>);
  limits?: Partial<RondoLimits>;
}

const utf8Length = (s: string): number => new TextEncoder().encode(s).length;

export async function renderRondo(req: RondoRenderRequest, env: RondoEnv): Promise<RondoPcm> {
  const lim = { ...RONDO_LIMITS, ...env.limits };
  if (typeof req.source !== 'string' || req.source.trim() === '') {
    throw new RondoLimitError('The song is empty.', 'rondo.source.empty');
  }
  if (utf8Length(req.source) > lim.maxSourceBytes) {
    throw new RondoLimitError(`The song is larger than ${Math.round(lim.maxSourceBytes / 1024)} KB.`, 'rondo.limits.source');
  }
  if (req.seconds !== undefined && (!Number.isFinite(req.seconds) || req.seconds <= 0)) {
    throw new RondoLimitError('The length must be a positive number of seconds.', 'rondo.limits.seconds');
  }
  if (req.seconds !== undefined && req.seconds > lim.maxSeconds) {
    throw new RondoLimitError(`A render can be at most ${lim.maxSeconds} seconds long.`, 'rondo.limits.seconds');
  }
  const stageSource = typeof env.stageSource === 'function' ? await env.stageSource() : env.stageSource;

  const extra: RondoFinding[] = [];
  const window = (p: PreparedSong): { cycles: number; seconds: number } => {
    if (req.seconds !== undefined) {
      // Whole cycles covering the window; the render itself stops at `seconds`.
      return { cycles: Math.max(1, Math.ceil(req.seconds * p.cps - 1e-9)), seconds: req.seconds };
    }
    const cycles = p.naturalCycles ?? lim.defaultCycles;
    const natural = cycles / p.cps;
    if (natural <= lim.maxSeconds) return { cycles, seconds: natural };
    extra.push({
      code: 'rondo.limits.length',
      message: `The song runs for ${Math.round(natural)} s; the render stops at ${lim.maxSeconds} s.`,
      parts: [],
    });
    return { cycles: Math.ceil(lim.maxSeconds * p.cps), seconds: lim.maxSeconds };
  };

  const staged = await stageInVm({ source: req.source, lang: req.lang ?? 'auto', window, stageSource, limits: lim });
  const song = parseStaged(staged.stagedText, staged.seconds);
  const pcm = renderStagedSong(song, staged.seconds);
  return {
    ...pcm,
    seconds: staged.seconds,
    cycles: staged.cycles,
    cps: staged.prepared.cps,
    lang: staged.prepared.lang,
    findings: [...extra, ...findingsFor(song, staged.prepared)],
    run: { executionClass: EXECUTION_CLASS, seed: VM_SEED, upstream: UPSTREAM_COMMIT, adapter: ADAPTER_REVISION },
  };
}
