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
 * A third way in is one rondocode song (plan 301): a `.rondo` or `.rondo.json` file,
 * or a rondocode share link. It is a soundtrack of one clip, so it goes through the
 * same mixer and the same limiter; `--seconds` sets its length, and without it the
 * song plays its own arrangement. The song's code runs in the `vm` execution class
 * inside a Worker (packages/node-shell/src/rondo.ts), never in this process's realm,
 * and every part it could not play is a warning that `--json` and `--strict` see.
 *
 * The decoder is the Node host's own (WAV, our procedural ZzFXM songs and rondocode
 * songs). A clip in a format that needs a platform codec is NAMED and left out rather
 * than mixed as silence - the same rule `host.audio.analyse` follows.
 *
 * A mix that holds a rondocode song is signed (Andy, 2026-10-08): its Content
 * Credentials carry one source ingredient per distinct song, with the `vm` execution
 * class and the renderer version, and a file whose whole sound is one song also
 * declares how that sound was made, in the created step and the RIFF comment. A mix
 * with no song is written as before, with no credential. `--c2pa=off` and
 * `--no-provenance` leave the credential out; `--sign-key`/`--sign-cert` sign with an
 * identity, as a render does. What the file records is read back from the written
 * bytes before the terminal is told.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { embedC2pa, embedWavInfo, isRondoFileName, isRondoShareLink, normalizeLang, rondoRecordedSentence } from '@lolly/engine';
import type { Profile } from '@lolly-tools/core/host-v1';
import { repoRoot } from '@lolly-tools/node-shell/repo-root';
import { decodeAudioPcm, decodeAudioSource, RondoAudioError } from '@lolly-tools/node-shell';
import type { ComputedAudioRun } from '@lolly-tools/node-shell';
import { buildExportC2paOpts } from '@lolly-tools/node-shell/c2pa-opts';
import { recordedSongs, singleSongEssence, songIngredients } from '@lolly-tools/node-shell/audio';
import {
  mixSequenceAudio, readSeqAudioPlan, sequenceMixToWav,
} from '@lolly-tools/node-shell/sequence-audio';
import type { SeqAudioPlan, SeqPcm, SeqElementLike } from '@lolly-tools/node-shell/sequence-audio';
import { CliError, authError, usageError, unavailableHere, EXIT } from './exit-codes.ts';
import { note, warn, writeOut } from './output.ts';
import { emitResult } from './envelope.ts';
import { cliAudioRunReporter, runFacts } from './song-report.ts';

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
  /** A rondocode song's length in seconds. Absent: the song's own arrangement. */
  seconds?: number;
  /** The raw `--c2pa` value (`off` leaves the credential out; 7/30/90/365 sets its lifetime). */
  c2pa?: string;
  /** `--no-provenance`: no credential and no declaration in the RIFF comment. */
  noProvenance?: boolean;
  /** `--sign-key` / `--sign-cert`: sign with an identity instead of the anonymous key. */
  signKey?: string;
  signCert?: string;
}

/** What the written file records about its songs, read back from its bytes. */
interface SongCredentials {
  /** The distinct songs the mix holds, by name. */
  songs: string[];
  /** The songs the file's Content Credentials record, read back after writing. */
  recorded: string[];
  /** True when a credential was written into the file. */
  written: boolean;
}

/**
 * Sign a mix that holds rondocode songs, then read the result back. A mix with no
 * song is returned untouched. Never fails the run over the credential: the WAV is
 * the deliverable, and a credential that could not be written is said out loud.
 */
async function stampSongMix(
  wav: Uint8Array, runs: readonly ComputedAudioRun[], opts: MixCliOptions,
): Promise<{ bytes: Uint8Array; credentials: SongCredentials | null }> {
  const ingredients = songIngredients(runs);
  if (!ingredients.length) return { bytes: wav, credentials: null };
  const songs = ingredients.map((i) => i.title);
  const raw = opts.c2pa?.trim().toLowerCase();
  const off = raw === 'off' || raw === '0' || raw === 'false' || raw === 'no';
  const asked = raw !== undefined && !off;
  const askedIdentity = Boolean(opts.signKey || opts.signCert);
  if (opts.noProvenance && (asked || askedIdentity)) {
    throw usageError('--no-provenance turns every provenance mark off, but this run also asks for a credential. Drop one of them.', 'CONFLICTING_FLAGS');
  }
  if (opts.noProvenance || off) {
    note('Note: Content Credentials are off for this run, so the file does not record its songs.');
    return { bytes: wav, credentials: { songs, recorded: [], written: false } };
  }
  const days = Number(raw);
  const { resolveSigningIdentity, SigningIdentityError, describeIdentity } = await import('@lolly-tools/node-shell/signing-identity');
  let identity: Awaited<ReturnType<typeof resolveSigningIdentity>> = null;
  try {
    identity = await resolveSigningIdentity({
      keyPath: opts.signKey,
      certPath: opts.signCert,
      promptPassword: async () => {
        const { promptPassphrase } = await import('./prompt.ts');
        return promptPassphrase('Passphrase for the signing key');
      },
    });
  } catch (e) {
    if (!(e instanceof SigningIdentityError)) throw e;
    throw e.code.startsWith('SIGN_KEY_PASSWORD') ? authError(e.message, e.code) : usageError(e.message, e.code);
  }
  if (identity) {
    note(describeIdentity(identity));
    for (const w of identity.warnings) warn('SIGN_CHAIN_INCOMPLETE', `Signing identity: ${w}`, 'gate');
  }
  let profile: Profile = {};
  if (opts.userProfile) profile = await (await import('./run.ts')).readProfile(opts.userProfile);
  const essence = singleSongEssence(runs);
  let bytes = wav;
  try {
    if (essence) {
      // The created step and the RIFF comment say how the sound was made. The tags go
      // in first, so the credential's hash covers the final byte layout.
      const artist = profile.useDetails === true
        ? [profile.firstname, profile.lastname].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ')
        : '';
      bytes = embedWavInfo(bytes, { title: essence.name, comment: essence.declaration, ...(artist ? { artist } : {}) });
    }
    bytes = await embedC2pa(bytes, 'wav', buildExportC2paOpts({
      surface: 'cli',
      manifest: { id: 'mix', name: essence ? essence.name : 'Soundtrack mix' },
      model: [],
      format: 'wav',
      days: [7, 30, 90, 365].includes(days) ? days : null,
      profile,
      ingredients,
      ...(essence ? { actions: [essence.action] } : {}),
      ...(identity ? { signer: identity.signer, signerValidity: { notBefore: identity.notBefore, notAfter: identity.notAfter } } : {}),
    }));
  } catch (e) {
    const message = `Content Credentials not attached, so the file does not record its songs - ${(e as Error).message}`;
    if (asked || askedIdentity) warn('C2PA_SKIPPED', message);
    else note(`Note: ${message}`);
    return { bytes: wav, credentials: { songs, recorded: [], written: false } };
  }
  return { bytes, credentials: { songs, recorded: await recordedSongs(bytes), written: true } };
}

/** Say what the written file records, and only that. */
function reportSongCredentials(c: SongCredentials | null): void {
  if (!c?.written) return;
  if (c.recorded.length) note(rondoRecordedSentence(c.recorded));
  else warn('C2PA_SONG_MISSING', 'The file was signed, but reading it back found no record of its songs in the Content Credentials.');
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
  // One rondocode song: a share link, or a song file.
  if (isRondoFileName(source) && !existsSync(source)) {
    throw usageError(`No song file at ${source}.`, 'FILE_NOT_FOUND');
  }
  if (isRondoShareLink(source) || isRondoFileName(source)) return mixSong(source, opts);
  if (opts.seconds !== undefined) {
    throw usageError('--seconds sets a rondocode song\'s length; a design state or a plan file carries its own.', 'CONFLICTING_FLAGS');
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
  const report = cliAudioRunReporter();
  // The songs each clip rendered, so the credential lists only what the file holds.
  const runsByClip = new Map<string, ComputedAudioRun[]>();
  for (const [id, src] of sources) {
    const clipRuns: ComputedAudioRun[] = [];
    runsByClip.set(id, clipRuns);
    const onRun = (run: ComputedAudioRun): void => { clipRuns.push(run); report(run); };
    try {
      pcm.set(id, await decodeAudioPcm(src, { repoRoot: repoRoot(), onRun }));
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

  // Only the songs whose clips the mixer kept (the same skips mixSequenceAudio makes):
  // a muted, struck-through or time-stretched clip is not in the file.
  const heard = plan.clips.filter((c) => !c.mute && !c.ignored && c.durMs > 0
    && (c.speed ?? 1) === 1 && (c.pitch ?? 0) === 0 && (pcm.get(c.id)?.channels[0]?.length ?? 0) > 0);
  const mixed = heard.flatMap((c) => runsByClip.get(c.id) ?? []);
  const { bytes, credentials } = await stampSongMix(sequenceMixToWav(mix), mixed, opts);
  const dest = opts.out && opts.out !== '-' ? resolve(process.cwd(), opts.out) : null;
  if (dest) {
    await writeFile(dest, bytes);
    note(`✓ Wrote ${bytes.length} bytes to ${dest} (${(mix.totalSamples / mix.sampleRate).toFixed(2)}s, ${mix.sampleRate} Hz stereo)`);
  } else {
    await writeOut(bytes);
  }
  reportSongCredentials(credentials);
  if (opts.json && dest && credentials) {
    await emitResult({
      output: dest,
      bytes: bytes.length,
      seconds: mix.totalSamples / mix.sampleRate,
      sampleRate: mix.sampleRate,
      credentials,
    });
  }
  return EXIT.OK;
}

/**
 * One rondocode song as a soundtrack of one clip: rendered in its Worker, then
 * through the same mixer and limiter a timeline goes through.
 */
async function mixSong(source: string, opts: MixCliOptions): Promise<number> {
  const dest = opts.out && opts.out !== '-' ? resolve(process.cwd(), opts.out) : null;
  if (opts.json && !dest) {
    throw usageError('--json writes the report to stdout, so the WAV needs a file: add --out=<song.wav>.', 'CONFLICTING_FLAGS');
  }
  const runs: ComputedAudioRun[] = [];
  const report = cliAudioRunReporter();
  let decoded: Awaited<ReturnType<typeof decodeAudioSource>>;
  try {
    decoded = await decodeAudioSource(
      isRondoShareLink(source) ? source : resolve(process.cwd(), source),
      { repoRoot: repoRoot(), onRun: (run) => { runs.push(run); report(run); } },
      opts.seconds !== undefined ? { seconds: opts.seconds } : {},
    );
  } catch (e) {
    if (e instanceof RondoAudioError) {
      // A song that cannot be read, or one that broke a limit, is the input's
      // fault; one that could not start is this installation's.
      const exit = e.code === 'rondo.vm.unavailable' ? EXIT.UNAVAILABLE_HERE
        : e.code.startsWith('rondo.source') || e.code === 'rondo.compile' || e.code === 'rondo.limits.seconds' ? EXIT.USAGE
        : EXIT.FAILED;
      const lines = e.diagnostics.map(d => `  ${d.line ? `line ${d.line}: ` : ''}${d.message}`);
      throw new CliError([e.message, ...lines].join('\n'), exit, e.code.toUpperCase().replace(/[^A-Z0-9]+/g, '_'), e.code);
    }
    throw e;
  }
  const totalSec = decoded.seconds;
  const plan: SeqAudioPlan = {
    totalSec,
    clips: [{ id: 'song', kind: 'audio', startMs: 0, durMs: totalSec * 1000 }],
    ...(opts.normalize !== undefined ? { normalize: opts.normalize } : {}),
  };
  const mix = mixSequenceAudio(plan, new Map<string, SeqPcm>([['song', decoded]]));
  for (const w of mix.warnings) warn('MIX_CLIP_SKIPPED', w);
  const { bytes, credentials } = await stampSongMix(sequenceMixToWav(mix), runs, opts);
  const seconds = mix.totalSamples / mix.sampleRate;
  if (dest) {
    await writeFile(dest, bytes);
    note(`✓ Wrote ${bytes.length} bytes to ${dest} (${seconds.toFixed(2)}s, ${mix.sampleRate} Hz stereo)`);
  } else {
    await writeOut(bytes);
  }
  reportSongCredentials(credentials);
  if (opts.json) {
    const run = runs[0];
    await emitResult({
      output: dest,
      bytes: bytes.length,
      seconds,
      sampleRate: mix.sampleRate,
      ...(run ? {
        song: {
          name: run.name,
          seconds: run.seconds,
          ...runFacts(run),
          findings: run.findings,
        },
      } : {}),
      ...(credentials ? { credentials } : {}),
    });
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
