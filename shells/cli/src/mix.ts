// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly mix <design state|plan.json> --out=mix.wav` - a design timeline's soundtrack,
 * written without a browser.
 *
 * The video frames of a sequence still need a real paint engine (Tier B), but the
 * SOUND does not: the mix is a closed form over decoded PCM, and every number in it
 * is engine code (the true-peak limiter, the BS.1770 meter, the fx kernels). This is
 * the door onto that, so a pipeline can hear what a timeline sounds like, diff two
 * mixes, or feed a mastering step, with no Chromium in the picture.
 *
 * Two ways in, because the state a person has is not always the state a script has:
 *
 *   • A DESIGN STATE - a `#/tool/design?...` link, a bare query (`bx=…`, `z=…`), or a
 *     file holding one. The tool is hydrated in the same jsdom the renderer uses and
 *     the plan is read off the `data-t-*` attributes its own template emitted, so the
 *     timeline's wire grammar stays the design tool's business, not this file's.
 *   • A PLAN JSON - `{ totalSec, clips: [{ id, src, startMs, durMs, … }], bed }`, the
 *     `SeqAudioPlan` shape with a `src` per clip. For a caller that already knows what
 *     it wants mixed and has the files.
 *
 * The decoder is the Node host's own (WAV and our procedural ZzFXM songs). A clip in a
 * format that needs a platform codec is NAMED and left out rather than mixed as
 * silence - the same rule `host.audio.analyse` follows.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeLang } from '@lolly/engine';
import { repoRoot } from '@lolly-tools/node-shell/repo-root';
import { decodeAudioPcm } from '@lolly-tools/node-shell';
import {
  mixSequenceAudio, readSeqAudioPlan, sequenceMixToWav,
} from '@lolly-tools/node-shell/sequence-audio';
import type { SeqAudioPlan, SeqPcm, SeqElementLike } from '@lolly-tools/node-shell/sequence-audio';
import { usageError, unavailableHere, EXIT } from './exit-codes.ts';
import { note, warn, writeOut } from './output.ts';

/** A plan JSON's clip carries the source alongside the placement. */
interface PlanFileClip { id?: string; src?: string }

export interface MixCliOptions {
  /** Where the WAV goes. Absent (or `-`) streams it to stdout. */
  out?: string;
  json?: boolean;
  /** A loudness target in LKFS (-14 / -16 / -23). Absent means no normalisation, and
   *  the -1 dBTP limiter still runs: it is not optional on any path. */
  normalize?: number;
  /** `--user-profile=path.json`, threaded to the bridge exactly as a render does. */
  userProfile?: string;
}

/** The tool id a design-state link names, defaulting to the design tool. */
function toolIdOf(source: string): string {
  const m = /#\/tool\/([^?#/]+)/.exec(source);
  return m ? decodeURIComponent(m[1]!) : 'design';
}

/** Everything after the first `?`, or the whole string when it is already a query. */
function queryOf(source: string): string {
  const q = source.indexOf('?');
  return q >= 0 ? source.slice(q + 1) : source.replace(/^#?\/?/, '');
}

export async function mixCli(source: string, opts: MixCliOptions = {}): Promise<number> {
  if (!source) {
    throw usageError('lolly mix needs a design state or a plan file: `lolly mix "bx=…" --out=mix.wav`.', 'MISSING_ARG');
  }
  // A path wins over a URL reading: a file called `bx=…` is not a thing, and a caller
  // who passed a path that does not exist wants to hear about the path.
  let text = source;
  if (existsSync(source)) text = await readFile(source, 'utf8');

  let plan: SeqAudioPlan;
  let sources: Map<string, string>;
  const warnings: string[] = [];

  const asJson = text.trimStart().startsWith('{') ? JSON.parse(text) as SeqAudioPlan & { clips?: PlanFileClip[] } : null;
  if (asJson && Array.isArray(asJson.clips)) {
    plan = asJson as SeqAudioPlan;
    sources = new Map<string, string>();
    for (const [i, c] of (asJson.clips as PlanFileClip[]).entries()) {
      const id = c.id ?? `clip${i}`;
      if (c.src) sources.set(id, c.src);
      else warnings.push(`clip "${id}" has no "src" and was left out.`);
    }
    if (!Number.isFinite(plan.totalSec)) {
      throw usageError('the plan needs a numeric "totalSec" - the mix has to know how long it is.', 'BAD_PLAN');
    }
  } else {
    const read = await readDesignState(toolIdOf(text.trim()), queryOf(text.trim()), opts);
    plan = read.plan;
    sources = read.sources;
    warnings.push(...read.warnings);
  }

  if (opts.normalize !== undefined) plan = { ...plan, normalize: opts.normalize };

  // Decode every source the plan needs. A failure is NAMED and the clip dropped; the
  // rest of the timeline still mixes, which is what a person editing wants when one
  // box happens to be an mp3.
  const pcm = new Map<string, SeqPcm>();
  for (const [id, src] of sources) {
    try {
      pcm.set(id, await decodeAudioPcm(src, { repoRoot: repoRoot() }));
    } catch (e) {
      // The source is TRUNCATED: a design state inlines an audio box as a data URL,
      // and a megabyte of base64 in a warning is not a message, it is a denial of
      // service on the terminal. Same 120-char cut the web shell's own log takes.
      warnings.push(`clip "${id}" (${src.length > 120 ? `${src.slice(0, 120)}…` : src}): ${(e as Error).message}`);
    }
  }

  const mix = mixSequenceAudio(plan, pcm);
  for (const w of [...warnings, ...mix.warnings]) warn('MIX_CLIP_SKIPPED', w);
  if (!mix.hasClipAudio && !mix.hasBed) {
    throw unavailableHere(
      'nothing in this timeline could be mixed here - no clip carried audio this shell can decode. '
      + 'Node reads WAV and our procedural ZzFXM songs; an mp3/opus box needs a browser shell '
      + '(`lolly design --export=wav` drives one). Nothing was written.',
      'MIX_EMPTY',
    );
  }

  const bytes = sequenceMixToWav(mix);
  const dest = opts.out && opts.out !== '-' ? resolve(process.cwd(), opts.out) : null;
  if (dest) {
    await writeFile(dest, bytes);
    note(`✓ Wrote ${bytes.length} bytes to ${dest} (${(mix.totalSamples / mix.sampleRate).toFixed(2)}s, ${mix.sampleRate} Hz stereo)`);
  } else {
    await writeOut(bytes);
  }
  return EXIT.OK;
}

/**
 * Hydrate a tool from a URL state and read the mix plan off the markup its template
 * produced. Same jsdom, same bridge, same runtime the render path uses - a mix must
 * never see a different document than an export would.
 */
async function readDesignState(
  toolId: string, query: string, opts: MixCliOptions,
): Promise<{ plan: SeqAudioPlan; sources: Map<string, string>; warnings: string[] }> {
  const jsdom = await import('jsdom');
  const dom = new jsdom.JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Element = dom.window.Element;

  const { loadToolOrThrow, readToolFile, readProfile } = await import('./run.ts');
  const { createCliBridge, applyBrandVars } = await import('./bridge.ts');
  const { createRuntime, parseUrlState, expandQuery } = await import('@lolly/engine');

  // The same expansion the render path runs, so a packed `z=` link mixes identically.
  const expanded = await expandQuery(query);
  const params = Object.fromEntries(new URLSearchParams(expanded));
  const tool = await loadToolOrThrow(toolId, readToolFile, { lang: normalizeLang(params.lang) ?? undefined });
  const profile = await readProfile(opts.userProfile);
  const host = await createCliBridge({ dom, profile, networkAllowlist: tool.manifest.network?.allowlist });
  const { values } = parseUrlState(expanded, tool.manifest as never);
  const runtime = await createRuntime(tool, host, values as never);

  const canvas = dom.window.document.getElementById('canvas')!;
  await applyBrandVars(canvas as unknown as HTMLElement, host);
  canvas.innerHTML = runtime.getHydrated();
  return readSeqAudioPlan(canvas as unknown as SeqElementLike);
}
