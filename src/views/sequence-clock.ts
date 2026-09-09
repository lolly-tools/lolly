// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-clock.ts - the playhead (Fable timeline, phase 2 section 3).
 *
 * One mounted composition's *time*: where the playhead is, what that means for
 * every timed box on the live canvas, and - while playing - a conductor that keeps
 * the <video>s, the Lottie players and the wall clock in step.
 *
 * THE ONE RULE THIS MODULE LIVES BY: it is a READER. Timing comes exclusively from
 * the DOM the tool hook already stamped (`data-t-start` & friends on each
 * `.lolly-box`, `data-seq-ms` on the `[data-sequence]` artboard). It never reads the
 * input model, never calls `runtime.setInput`, never runs a hook and never writes
 * innerHTML. Everything it *does* write - one class and two inline properties per
 * box - is captured first and restored exactly on `destroy()`, so removing the clock
 * leaves every declaration as it found it. That is what lets a scrub run at
 * 60 Hz with zero re-renders and zero undo-stack entries.
 *
 * Composition, not clobbering: a box carries AUTHORED inline styles from the hook - 
 * `transform:rotate(-4deg)`, `opacity:0.8`. An entrance animation must add to those,
 * never replace them, so the authored string is captured once per element and the
 * animation is rebuilt around it every frame (declaration-identical, not byte-identical:
 * writing through CSSStyleDeclaration re-serialises the whole `style` attribute, so
 * nothing downstream may diff innerHTML and expect a match):
 *
 *     translate(dx,dy)  <authored…>  rotate(animRot)  scale(sc)
 *
 * which multiplies out to the same matrix order the video compositor uses in
 * bridge/export.ts (`translate → rotate(authored+anim) → scale`), so a scrubbed
 * preview and the rendered file agree. The transition maths itself is IMPORTED from
 * lib/transitions.ts - never re-derived here.
 *
 * Master clock is `AudioContext.currentTime`, not `performance.now()`: audio is the
 * one media element that cannot be nudged without an audible artefact, so everything
 * else is slaved to its timebase. Videos free-run and are re-seeked only when they
 * drift past ~80 ms.
 *
 * AUDIO BOXES ARE SCHEDULED, NOT DRIVEN. A `[data-audio-src]` box has no element to
 * play - the tool hook emits an inert marker div - so each one is handed to that same
 * AudioContext as a single `AudioBufferSourceNode.start(when, offset, duration)`,
 * placed once, ahead of time, against `t0`. The frame loop never advances it: it only
 * asserts the invariant "every box that should be sounding has a placement", and every
 * exit from playback (pause, seek, repaint, hidden tab, destroy) stops the sources
 * outright. Semantics are the export mix's, so preview and file agree - see driveAudio.
 *
 * Seeks are strictly serialised per element (the Safari rule - a seek issued while
 * another is in flight is silently cancelled, so scrubbing returns a lottery of
 * frames). The queue is the shared, already-tested one from lib/clip-thumbs.ts; this
 * module adds only what playback needs on top: latest-wins scrub throttling and a
 * single confirm-and-nudge retry when a decoder lands short of the requested time.
 *
 * NOT EVERY AUDIO SOURCE IS A CONTAINER. A box may carry a TRACKER MODULE
 * (.mod/.xm/.it/.s3m/.stm/.mtm) - a score plus its instrument samples, not encoded
 * audio, so `decodeAudioData` cannot parse a byte of it. Those are rendered to PCM by
 * libopenmpt (lib/mod-render.ts, lazily imported) and enter the ordinary decode cache
 * as an AudioBuffer, so everything downstream - the ceilings, the abort plumbing, the
 * scheduling triple - is unchanged. See "tracker modules" below for how one is
 * recognised, and bridge/sequence-providers.ts for the export half of the same story.
 *
 * BROWSER-ONLY SURFACES (deliberately isolated behind injectable seams so the rest is
 * unit-testable in jsdom): `AudioContext`, `requestVideoFrameCallback`,
 * `requestAnimationFrame`, and real layout for box sizes.
 */

import { clipGainEvents, clipGainValueAt, isTrivialGain, scheduleGainEvents } from '../bridge/audio-envelope.ts';
// The ref test alone - deliberately a leaf module (see its header) so the composer
// stays out of this module's eager graph; the composer itself is imported lazily in
// renderZzfxmToBuffer below.
import { volumeKeysOf } from '../bridge/sequence-plan.ts';
import { isZzfxmRef } from '../../../../engine/src/zzfxm-ref.ts';
import type { ZzfxSong } from '../../../../engine/src/zzfxm.ts';
import {
  createSeekQueue, readBounded, withinDecodeBudget, MAX_AUDIO_DECODE_BYTES,
  type SeekableEl,
} from '../lib/clip-thumbs.ts';
import { lottiePlayerFor } from './lottie-mount.ts';
// The rate range is timeline-math's (a pure, DOM-free module): the tool hook, the
// panel's writers and this reader must clamp identically, so there is exactly one
// declaration of it. Re-exported below so this module's own surface is unchanged.
import { MIN_SPEED, MAX_SPEED } from './timeline-math.ts';

// ── tunables ────────────────────────────────────────────────────────────────

/** Per-seek confirmation budget while scrubbing/drift-correcting. */
export const SEEK_CONFIRM_MS = 300;
/** A landed frame further than this from the request earns one nudge. 1.5 frames @30. */
export const SEEK_TOLERANCE_S = 1.5 / 30;
/** How far past the target the single nudge asks for. A quarter of a frame @30. */
export const SEEK_NUDGE_S = 0.25 / 30;
/** While the pointer is down, at most one seek request per element per this long. */
export const SCRUB_THROTTLE_MS = 100;
/** Playback drift past this (seconds) triggers a corrective re-seek. */
export const DRIFT_TOLERANCE_S = 0.08;
/** How far short of a source's own end the last held frame sits. */
export const MEDIA_END_EPS_S = 0.04;
/**
 * How many DISTINCT audio sources one preview will ever decode.
 *
 * Decoded PCM is raw f32 - roughly 10 MB per minute per channel - and there is no
 * streaming decode in the platform API, so the only defence is refusing to start.
 * The compressed fetch is already bounded by MAX_AUDIO_DECODE_BYTES (shared with the
 * waveform reader, so a file the timeline refused to draw is never decoded for
 * preview either); these two ceilings bound what a composition full of music beds can
 * cost. Past either one the box is simply silent in preview and a warning is logged - 
 * NEVER a throw, because the picture must keep playing.
 */
export const MAX_PREVIEW_AUDIO_SOURCES = 6;
/**
 * Ceiling on the decoded PCM this clock will hold at once, bytes.
 *
 * A tracker module is bounded differently on the way IN - its file is a few hundred
 * kB, so MAX_AUDIO_DECODE_BYTES says nothing useful about how long it plays - and its
 * own ceiling is the decode worker's `MAX_SECONDS` (480 s, lib/mod-worker.ts), after
 * which it stops rendering. What lands here is then accounted exactly like a decoded
 * file: a pathological module spends the whole budget and the tracks after it are
 * silent in preview WITH A WARNING, which is the same degradation an over-long wav
 * already gets. There is deliberately no second, module-specific budget.
 */
export const MAX_PREVIEW_PCM_BYTES = 96 * 1024 * 1024;
/** Clamps mirroring the tool hook's own attribute clamps. */
export { MIN_SPEED, MAX_SPEED };
// MIN_/MAX_TRANSITION_MS are re-exported below, from the module that now owns the
// applier - one declaration, same names on this module's surface as before.

// ── tracker modules: recognising one ────────────────────────────────────────
//
// A .mod/.xm/.it/.s3m/.stm/.mtm file is a SCORE plus the instrument samples it plays - 
// there is no encoded audio stream in it at all. `decodeAudioData` fails on one and so
// does mediabunny; the only thing in this codebase that can turn it into sound is
// libopenmpt (lib/mod-render.ts). So before either decoder is handed the bytes,
// something has to say "this is a module" - and that is harder than it sounds:
//
//   • THE FORMAT FIELD WOULD BE THE BEST SIGNAL AND IS NOT AVAILABLE HERE. An uploaded
//     asset's `AssetRef.format` is exactly 'mod'/'xm'/… (that is what the export bar
//     switches on - views/tool-actions.ts, `isModuleFormat(r.format)`), but the
//     sequence tool's hook emits only `data-audio-src="<url>"`, so by the time a box
//     reaches this module the format has been thrown away. Recovering it means a new
//     `data-audio-format` attribute in community/sequence-studio/hooks.js - reported,
//     not done here.
//   • THE EXTENSION IS NOT ENOUGH. A user upload resolves to a `blob:` URL minted by
//     bridge/assets.ts (`URL.createObjectURL`) with no path, no extension and a MIME
//     type of whatever the OS guessed - and an upload is the ONLY way a module gets
//     into a composition today (no brand catalog ships one; the picker accepts
//     .mod/.xm/.it/.s3m/.stm/.mtm as uploads).
//
// So the signal is the BYTES, with the extension as a free fast path when there is
// one. Both live here, pure and exported, and bridge/sequence-providers.ts imports
// them for the export mix - one definition, so preview and export can never disagree
// about what is a module. (That import direction, bridge → this file, is the same
// read-only reuse the seek helpers below already have; the reverse would be a cycle.)

/** The module formats libopenmpt decodes for us. Mirrors `MODULE_FORMATS` in
 *  lib/mod-render.ts, which is the shipped list - a test asserts they are identical
 *  rather than importing it, because that module must stay out of the eager graph. */
export const MODULE_EXTENSIONS = ['mod', 'xm', 's3m', 'it', 'stm', 'mtm'] as const;

/** A url's own path extension, lowercased. '' for a blob:/data: url, or a query-only
 *  match - the query and fragment are cut first, so `?src=x.mod` is NOT an extension. */
export function urlExtension(url: string): string {
  const path = (url.split('#')[0] ?? '').split('?')[0] ?? '';
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
}

/** Does this url NAME a tracker module? A fast path only - see the section header. */
export function isModuleUrl(url: string): boolean {
  return (MODULE_EXTENSIONS as readonly string[]).includes(urlExtension(url));
}

/** Original-MOD channel magics that are not a literal 4CHN/16CH-style pattern. */
const MOD_MAGIC = new Set([
  'M.K.', 'M!K!', 'M&K!', 'N.T.', 'FLT4', 'FLT8', 'EXO4', 'EXO8',
  'OCTA', 'OKTA', 'CD81', 'FA04', 'FA06', 'FA08',
]);
/** `4CHN`, `16CH`, `TDZ3` - the channel-count magics, written as patterns. */
const MOD_MAGIC_RE = /^(?:[1-9]CHN|[1-9][0-9]C[HN]|TDZ[1-9])$/;
/** ScreamTracker 2 identifies itself at offset 20, with 0x1A as the EOF marker at 28. */
const STM_TAGS = new Set(['!scream!', 'bmod2stm', 'wuzamod!', 'swavepro']);

/**
 * Is this a tracker module, by its own bytes?
 *
 * Each of the six formats carries a magic, just not all in the same place: IT and XM
 * at the very start, MTM likewise, S3M at 0x2C, STM at 0x14, and the original MOD
 * family at 1080 - AFTER its 31 sample headers, which is why the buffer has to be at
 * least 1084 bytes before that one can be read at all.
 *
 * HONEST LIMIT: a 15-instrument SoundTracker MOD (pre-1987 layout) has NO magic
 * anywhere - nothing can identify it but its extension and a heuristic on its sample
 * table, and a heuristic that guesses wrong sends an mp3 to libopenmpt. So this
 * returns false for one, the extension path catches the ones named `.mod`, and the
 * rest degrade to the same logged silence as any other undecodable box. libopenmpt
 * itself sniffs the real format from the bytes, so this only has to decide WHO
 * decodes, never WHICH format it is.
 */
export function sniffTrackerModule(src: ArrayBuffer | Uint8Array): boolean {
  const b = src instanceof Uint8Array ? src : new Uint8Array(src);
  if (b.length < 32) return false;
  const tag = (at: number, len: number): string => {
    let s = '';
    for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i] as number);
    return s;
  };
  if (tag(0, 4) === 'IMPM') return true;                                  // Impulse Tracker
  if (tag(0, 17) === 'Extended Module: ') return true;                    // FastTracker 2
  if (tag(0, 3) === 'MTM' && (b[3] as number) < 0x20) return true;        // MultiTracker
  if (b.length >= 48 && tag(44, 4) === 'SCRM') return true;               // ScreamTracker 3
  if (STM_TAGS.has(tag(20, 8).toLowerCase()) && b[28] === 0x1a) return true; // ScreamTracker 2
  if (b.length >= 1084) {                                                 // MOD and friends
    const magic = tag(1080, 4);
    if (MOD_MAGIC.has(magic) || MOD_MAGIC_RE.test(magic)) return true;
  }
  return false;
}

/** The one question both the preview and the export mix ask: does libopenmpt own this? */
export function looksLikeTrackerModule(url: string, bytes?: ArrayBuffer | Uint8Array | null): boolean {
  if (isModuleUrl(url)) return true;
  return !!bytes && sniffTrackerModule(bytes);
}

// ── the public contract ─────────────────────────────────────────────────────

/** The playhead, as the timeline panel consumes it. */
export interface SequenceClock {
  /** Current playhead position, ms. Updates synchronously on `seek`. */
  t(): number;
  /** Sequence length in ms, read from the live DOM's `data-seq-ms`. 0 when untimed. */
  duration(): number;
  /** Move the playhead. rAF-coalesced; `scrubbing` throttles the video seeks. */
  seek(tMs: number, opts?: { scrubbing?: boolean }): void;
  play(): void;
  pause(): void;
  playing(): boolean;
  /** Re-assert the current time after the canvas innerHTML was rebuilt. */
  reapply(): void;
  /** Subscribe to applied frames (play or scrub). Returns an unsubscribe. */
  onTick(cb: (tMs: number) => void): () => void;
  /** Stop everything and restore every inline style/mute flag this clock touched. */
  destroy(): void;
}

/** The (optional) host slice this module uses - logging only. */
export interface ClockHost {
  log?(level: string, msg: string): void;
}

export interface SequenceClockOpts {
  canvasEl: HTMLElement;
  host?: ClockHost;
  /** Test seam: schedule a frame. Defaults to rAF (setTimeout where absent). */
  raf?: (cb: () => void) => number;
  /** Test seam: cancel a scheduled frame. */
  caf?: (handle: number) => void;
  /** Test seam: monotonic ms - scrub throttling and the fallback playback timebase. */
  now?: () => number;
  /**
   * Test seam: fetch + decode ONE audio source, or null when it must stay silent.
   * Defaults to a size-bounded fetch through the shared decode ceiling followed by
   * `AudioContext.decodeAudioData`. Rejections are caught by the caller and logged.
   */
  loadAudio?: (url: string, signal: AbortSignal) => Promise<AudioBuffer | null>;
  /**
   * Test seam: render tracker-module BYTES to an AudioBuffer on the clock's context.
   * Defaults to the libopenmpt worker client, imported lazily at the point of use so
   * its WASM never enters the first-paint graph (see `defaultRenderModule`).
   */
  renderModule?: (ctx: BaseAudioContext, bytes: Uint8Array) => Promise<AudioBuffer>;
}

/**
 * The shipped module renderer, behind a dynamic import.
 *
 * lib/mod-render.ts spawns a Worker carrying the libopenmpt WASM. A static import
 * would put its chunk in this module's eager graph - and this module is on the editor's
 * first-paint path - for a format almost no composition contains. So it is pulled only
 * when a box's bytes actually turn out to be a module, exactly as mediabunny is in
 * bridge/sequence-providers.ts.
 */
async function defaultRenderModule(ctx: BaseAudioContext, bytes: Uint8Array): Promise<AudioBuffer> {
  const mod = await import('../lib/mod-render.ts');
  return mod.renderModToAudioBuffer(ctx, bytes);
}

/**
 * A PROCEDURAL BED (`zzfxm:<seed>[:<style>]`) is not a file: nothing can fetch it,
 * so handing it to `fetch` produced "Failed to fetch - silent in preview" for the
 * one audio source the Video template ships by default. The export mix composes the
 * seeded song on demand (bridge/sequence-providers' openZzfxmAudio); preview renders
 * the SAME song here - same seed→spec draw, same length quantiser - so what plays is
 * what exports. Composer and renderer stay behind dynamic imports for the same
 * reason libopenmpt does above: a composition with no procedural bed never loads them.
 *
 * `wantedSec` is the SEQUENCE length - the ceiling on what a bed can be heard under
 * (audioEndSec clips every box to the sequence). A bed trimmed in with a large
 * clipIn can outrun the composed length and end early; that is the same degradation
 * class as the decode budgets, never a throw.
 */
async function renderZzfxmToBuffer(ctx: BaseAudioContext, url: string, wantedSec: number): Promise<AudioBuffer> {
  const [{ parseZzfxmRef }, { composeSong, generatedSongSpec }, { zzfxmTargetSec }, { renderSongToAudioBuffer }] = await Promise.all([
    import('../../../../engine/src/zzfxm-ref.ts'),
    import('../../../../engine/src/zzfx-compose.ts'),
    import('../bridge/sequence-providers.ts'),
    import('../lib/zzfxm-render.ts'),
  ]);
  const ref = parseZzfxmRef(url);
  if (!ref) throw new Error(`malformed procedural audio ref: ${url}`);
  return renderSongToAudioBuffer(ctx, composeSong(generatedSongSpec(ref.seed, zzfxmTargetSec(wantedSec), ref.style)));
}

/**
 * An UPLOADED ZzFXM SONG (a MIDI ingested as a `format:'zzfxm'` asset) resolves to a
 * blob: URL whose bytes are song JSON, and the hook's `data-audio-src` carries only
 * that URL - the format is gone by the time a box reaches this module, exactly the
 * tracker-module situation above. The bytes are already in hand when this is asked,
 * so recognising one costs a JSON parse on a '{'-leading buffer and no second fetch.
 */
function parseZzfxmSongJson(bytes: ArrayBuffer): ZzfxSong | null {
  try {
    const o = JSON.parse(new TextDecoder().decode(bytes)) as ZzfxSong;
    return o && Array.isArray(o.instruments) && Array.isArray(o.patterns) && Array.isArray(o.sequence) ? o : null;
  } catch {
    return null;
  }
}

// ── the DOM applier: IMPORTED, never re-derived ─────────────────────────────
//
// The half-open activity window, the transition resolution and the composition with
// each box's authored transform/opacity used to live here. They now live in
// bridge/sequence-dom.ts, because a second caller needs exactly them: export.ts's
// "Record live" has to advance this same playhead over the real DOM while a
// MediaRecorder films it (nothing else moves a sequence stage), and the planned
// contact-sheet export walks the same applier across t. Two copies of this
// arithmetic drifting apart is the specific bug class this codebase keeps getting
// bitten by, so there is one copy and the clock is one of its two users.
//
// views -> bridge is the ordinary direction (bridge -> views is the forbidden edge).
// Everything is re-exported, so this module's public surface is unchanged.
export {
  readTiming, endOf, isActiveAt, transitionAt, composeTransform, composeOpacity,
  createAuthoredStore, applyTimeToElements, OFF_CLASS, SHOT_CLASS, BORROW_ATTR,
  releaseShotBorrow, stageNativeSize, sequenceStageOf,
  registerSequenceWriter, withAuthoredDom, authoredStyleOf, borrowAuthoredPose,
  MIN_TRANSITION_MS, MAX_TRANSITION_MS,
} from '../bridge/sequence-dom.ts';
export type {
  Timing, TransitionAt, AuthoredStore, ApplyCtx, AuthoredStyle, SequenceWriter,
} from '../bridge/sequence-dom.ts';

import {
  readTiming, endOf, createAuthoredStore, applyTimeToElements, OFF_CLASS,
  releaseShotBorrow, stageNativeSize, sequenceStageOf, registerSequenceWriter,
  sequenceTimeElements,
  type Timing, type SequenceWriter,
} from '../bridge/sequence-dom.ts';

// ── per-video seek queue ────────────────────────────────────────────────────

/** A queued, throttled, never-overlapping seeker for one media element. */
export interface VideoSeeker {
  /** Ask for a position (seconds). Latest-wins; throttled while `scrubbing`. */
  request(tSec: number, opts?: { scrubbing?: boolean }): void;
  /** True while a seek is awaiting confirmation. Never true for two at once. */
  inFlight(): boolean;
  /** How many nudge retries this seeker has issued (diagnostics + tests). */
  nudges(): number;
  destroy(): void;
}

/** The element slice a seeker needs. Duck-typed so a test can pass a plain object. */
export interface SeekableMedia extends SeekableEl {
  currentTime: number;
}

export interface SeekerDeps {
  /** Confirm the seek completed; resolves the presented time (or null). */
  waitFrame(el: SeekableMedia, signal?: AbortSignal): Promise<number | null>;
  now?(): number;
  /** Schedule the trailing scrub flush. Returns a canceller. */
  schedule?(fn: () => void, ms: number): () => void;
}

/**
 * Serialised seeking for one element - the Safari rule made mechanical.
 *
 * Two seeks in flight on one element is not "slower", it is WRONG: WebKit cancels
 * the earlier one and the frame you get back is whichever the decoder felt like. So
 * the underlying queue (shared with lib/clip-thumbs.ts, already tested there) never
 * runs two, and this wrapper adds the two things playback needs:
 *
 *   • scrub throttling - at most one request per SCRUB_THROTTLE_MS while the pointer
 *     is down, ALWAYS with a trailing flush so the final position of a drag lands
 *     even if it arrived inside the throttle window;
 *   • one nudge - decoders routinely land on the nearest keyframe rather than the
 *     requested time. If the confirmed frame is more than SEEK_TOLERANCE_S away we
 *     ask once more, a quarter-frame past the target. ONCE: a decoder that cannot
 *     hit the time will not hit it on the third try either, and a retry loop on a
 *     long-GOP file is a hang.
 */
export function createVideoSeeker(el: SeekableMedia, deps: SeekerDeps): VideoSeeker {
  const queue = createSeekQueue(el, (target, signal) => deps.waitFrame(target as SeekableMedia, signal));
  const now = deps.now || (() => Date.now());
  const schedule = deps.schedule || ((fn, ms) => {
    const h = setTimeout(fn, ms) as unknown as number;
    return () => clearTimeout(h as unknown as ReturnType<typeof setTimeout>);
  });

  let want: number | null = null;
  let cancelTrailing: (() => void) | null = null;
  let lastIssued = Number.NEGATIVE_INFINITY;
  let nudgeCount = 0;
  let dead = false;
  let generation = 0;

  function issue(t: number): void {
    if (dead) return;
    lastIssued = now();
    const mine = ++generation;
    void queue.seek(t, { supersede: true }).then((landed) => {
      if (dead || landed == null) return;
      // A newer target has been issued since: nudging toward THIS one would fight it.
      // The generation check is the required one - `pending()` is NOT enough,
      // because the queue's pump shifts the next job off SYNCHRONOUSLY before this
      // `.then` microtask runs, so by now the newer seek is in flight (pending 0)
      // and a nudge toward the stale target would be queued behind it and land LAST.
      if (mine !== generation) return;
      // Belt and braces for anything queued or in flight from another caller.
      if (want !== null || queue.pending() > 0 || queue.inFlight()) return;
      if (Math.abs(landed - t) <= SEEK_TOLERANCE_S) return;
      nudgeCount++;
      // Deliberately NOT supersede: this is a follow-up to a seek that already
      // completed, and it must not evict a scrub request that lands beside it.
      void queue.seek(t + SEEK_NUDGE_S);
    });
  }

  return {
    request(tSec, opts) {
      if (dead || !Number.isFinite(tSec)) return;
      const t = Math.max(0, tSec);
      if (!opts?.scrubbing) {
        // Not a scrub (pointer-up, playback drift correction, a keyboard step): this
        // is authoritative, so drop any trailing flush and go now.
        want = null;
        cancelTrailing?.();
        cancelTrailing = null;
        issue(t);
        return;
      }
      const since = now() - lastIssued;
      if (since >= SCRUB_THROTTLE_MS && !cancelTrailing) { want = null; issue(t); return; }
      want = t;
      if (!cancelTrailing) {
        const wait = Math.max(0, SCRUB_THROTTLE_MS - since);
        cancelTrailing = schedule(() => {
          cancelTrailing = null;
          const w = want;
          want = null;
          if (w != null) issue(w);
        }, wait);
      }
    },
    inFlight: () => queue.inFlight(),
    nudges: () => nudgeCount,
    destroy() {
      dead = true;
      cancelTrailing?.();
      cancelTrailing = null;
      want = null;
      queue.clear();
    },
  };
}

/**
 * Real confirmation that a seek presented a frame: rVFC where it exists (its
 * `mediaTime` is the frame actually on screen, unlike `currentTime` which is merely
 * what we asked for), the `seeked` event racing alongside for engines that skip rVFC
 * on a paused element, and a hard timeout so a stalled decoder cannot wedge the queue.
 *
 * Browser-only by nature; the seeker takes it as a dependency so tests inject a fake.
 */
// An intersection, not an `extends`: newer lib.dom declares both members as REQUIRED on
// HTMLVideoElement, and re-declaring them optional in a subinterface is a TS2430 conflict.
// Intersecting keeps the widening additive for older lib versions and conflict-free for new ones.
type RvfcVideo = HTMLVideoElement & {
  requestVideoFrameCallback?(cb: (now: number, meta: { mediaTime?: number }) => void): number;
  cancelVideoFrameCallback?(handle: number): void;
};

export function waitSeekConfirmed(el: SeekableMedia, signal?: AbortSignal, timeoutMs = SEEK_CONFIRM_MS): Promise<number | null> {
  const v = el as unknown as RvfcVideo;
  if (typeof v.addEventListener !== 'function') return Promise.resolve(el.currentTime);
  return new Promise((resolve) => {
    let done = false;
    let handle = 0;
    const cleanup = (): void => {
      clearTimeout(timer);
      v.removeEventListener('seeked', onSeeked);
      v.removeEventListener('error', onFail);
      signal?.removeEventListener('abort', onFail);
      if (handle) { try { v.cancelVideoFrameCallback?.(handle); } catch { /* already gone */ } }
    };
    const finish = (value: number | null): void => {
      if (done) return;
      done = true;
      cleanup();
      resolve(value);
    };
    const onSeeked = (): void => finish(v.currentTime);
    const onFail = (): void => finish(null);
    const timer = setTimeout(() => finish(null), timeoutMs);
    if (typeof v.requestVideoFrameCallback === 'function') {
      try {
        handle = v.requestVideoFrameCallback((_now, meta) => {
          finish(typeof meta?.mediaTime === 'number' ? meta.mediaTime : v.currentTime);
        });
      } catch { handle = 0; }
    }
    v.addEventListener('seeked', onSeeked, { once: true });
    v.addEventListener('error', onFail, { once: true });
    if (signal?.aborted) { finish(null); return; }
    signal?.addEventListener('abort', onFail, { once: true });
  });
}

// ── the clock ───────────────────────────────────────────────────────────────

interface VideoRec {
  seeker: VideoSeeker;
  /** The element's own `muted` before we touched it, restored on pause/destroy. */
  mutedWas: boolean | null;
  /** The element's own `loop` before we touched it, restored on pause/destroy. The
   *  clock owns the clip's end while it drives: a looping element wraps to 0 inside
   *  a window trimmed past its media, where the export holds the last frame. */
  loopWas: boolean | null;
  playing: boolean;
}

/**
 * One audio box's place in the preview mix.
 *
 * `node` is null both BEFORE the decode lands and AFTER a source ends or is refused - 
 * the record's existence, not its node, is what says "this box has been dealt with at
 * the current playhead", so a box that cannot sound is never re-attempted 60 times a
 * second. `key` is every attribute that decides WHETHER and WHERE it sounds: when it
 * changes (the user muted the clip, dragged it, retrimmed it) the record is torn down
 * and the box is re-placed on the next frame.
 */
interface AudioRec {
  key: string;
  node: AudioBufferSourceNode | null;
  /** The per-box gain stage (volume, fades, volume keyframes), torn down with the source. */
  gainNode: GainNode | null;
  panNode?: StereoPannerNode | null;
}

type AudioCtxCtor = new () => AudioContext;

export function createSequenceClock(opts: SequenceClockOpts): SequenceClock {
  const { canvasEl, host } = opts;
  const g = globalThis as typeof globalThis & { AudioContext?: AudioCtxCtor; webkitAudioContext?: AudioCtxCtor };
  const raf = opts.raf
    || (typeof requestAnimationFrame === 'function'
      ? (cb: () => void): number => requestAnimationFrame(() => cb())
      : (cb: () => void): number => setTimeout(cb, 16) as unknown as number);
  const caf = opts.caf
    || (typeof cancelAnimationFrame === 'function'
      ? (h: number): void => cancelAnimationFrame(h)
      : (h: number): void => clearTimeout(h as unknown as ReturnType<typeof setTimeout>));
  const nowMs = opts.now
    || (typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? (): number => performance.now()
      : (): number => Date.now());

  const store = createAuthoredStore();
  /**
   * True while the export-time read/restore seam is holding this stage at its AUTHORED
   * pose (bridge/sequence-dom.ts's writer registry, plans/104 section 6 point 0). Set only by
   * the registry, and always balanced by it.
   */
  let paused = false;
  const videos = new Map<HTMLVideoElement, VideoRec>();
  const ticks = new Set<(tMs: number) => void>();
  /** Live preview-mix records, one per audio box currently placed. */
  const audios = new Map<HTMLElement, AudioRec>();
  /** Decoded PCM, one entry per SOURCE URL (many boxes can share a track). */
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** Sources that failed or were refused: never fetched twice, never counted twice. */
  const audioFailed = new Set<string>();
  /** Every in-flight audio fetch, so destroy() abandons them rather than leaking. */
  const audioAborts = new Set<AbortController>();

  let tMs = 0;
  let scrubbing = false;
  let frame = 0;            // pending apply frame
  let loop = 0;             // pending playback frame
  let isPlaying = false;
  let ctx: AudioContext | null = null;
  let t0 = 0;               // ctx.currentTime at playhead 0 (audio timebase)
  let wall0 = 0;            // nowMs() at playhead 0 (fallback timebase)
  let dead = false;
  let pcmBytes = 0;         // decoded PCM currently held, bytes
  let ctxWasRunning = false; // last seen ctx.state, to re-place audio after a resume

  const log = (level: string, msg: string): void => { try { host?.log?.(level, msg); } catch { /* logging is never fatal */ } };

  // ── DOM reads ─────────────────────────────────────────────────────────────

  function boxes(): HTMLElement[] {
    // THE APPLIER'S OWN ENUMERATION, imported rather than re-typed: this selector and
    // `createSequenceTime`'s were two copies of the same rule and drifted apart from
    // the planner's (plans/104 P1 review, HIGH 1 - an untimed "Always on" camera has no
    // `data-t-start`, so the preview could not see the one box whose job is to move
    // everything else). See `sequenceTimeElements` for what is in the set and why.
    return sequenceTimeElements(sequenceStageOf(canvasEl) ?? canvasEl);
  }

  function seqMs(): number {
    const el = canvasEl.matches?.('[data-seq-ms]')
      ? canvasEl
      : canvasEl.querySelector<HTMLElement>('[data-seq-ms]');
    if (!el) return 0;
    const v = parseFloat(el.getAttribute('data-seq-ms') || '');
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  // ── media plumbing ────────────────────────────────────────────────────────

  function seekerFor(video: HTMLVideoElement): VideoRec {
    let rec = videos.get(video);
    if (!rec) {
      rec = {
        seeker: createVideoSeeker(video, { waitFrame: (el, signal) => waitSeekConfirmed(el, signal) }),
        mutedWas: null,
        loopWas: null,
        playing: false,
      };
      videos.set(video, rec);
      // A video still LOADING when this pass runs cannot be posed yet - and nothing
      // else re-applies when its data lands, so it would sit at frame 0 (or, with the
      // hook's authored autoplay, free-run) until the next scrub. One apply pass when
      // it becomes drawable puts it at the playhead's own frame. {once} self-cleans.
      if (typeof video.addEventListener === 'function' && video.readyState < 2 /* HAVE_CURRENT_DATA */) {
        video.addEventListener('loadeddata', () => { if (!dead) schedule(); }, { once: true });
      }
    }
    return rec;
  }

  /** Put a video back exactly as found: paused where we started it, muted as authored. */
  function releaseVideo(video: HTMLVideoElement, rec: VideoRec): void {
    if (rec.playing) { try { video.pause(); } catch { /* detached */ } rec.playing = false; }
    if (rec.mutedWas != null) { try { video.muted = rec.mutedWas; } catch { /* detached */ } rec.mutedWas = null; }
    if (rec.loopWas != null) { try { video.loop = rec.loopWas; } catch { /* detached */ } rec.loopWas = null; }
  }

  // ── preview audio: SCHEDULED against the master clock, never polled ──────────
  //
  // An audio box paints nothing (the tool hook emits a bare `[data-audio-src]`
  // marker), so unlike a <video> there is no element whose own clock could carry it.
  // It is placed directly on the shared AudioContext instead - the same context whose
  // `currentTime` IS this module's timebase - with one AudioBufferSourceNode per box:
  //
  //     start(t0 + boxStart, clipIn + alreadyElapsed, howMuchIsLeft)
  //
  // so the sound is handed to the audio thread once, ahead of time, and is sample-
  // accurate against the playhead by construction. Nothing here runs off rAF: a frame
  // loop can be throttled, descheduled or run at 120 Hz, and audio started from one
  // drifts audibly within seconds. The per-frame pass below only ASSERTS the invariant
  // (every box that should be sounding has a record), it never advances the sound.
  //
  // Semantics are the export mix's, deliberately, so a preview and the rendered file
  // agree: silent when `data-t-mute` is set, offset by `data-clip-in`, clipped both
  // to the box's own window and to the sequence's end - and at speed ≠ 1 the window
  // is BOUNCED through the same pitch-preserving stretcher the export runs
  // (plans/165 WP-7), then scheduled like any decoded track.

  /**
   * The audio source URL a box carries, or '' when it is not an audio box. A marker
   * counts only when THIS host is its nearest timed ancestor: in a frames document the
   * slide page is a timed host too, and a narration box inside it is a timed host of
   * its own, so the page used to place the same clip a second time and every narrated
   * slide spoke in two voices (Andy, 2026-09-03). The box sounds; the page stays quiet.
   */
  function audioSrcOf(el: HTMLElement): string {
    const m = el.matches?.('[data-audio-src]') ? el : el.querySelector?.('[data-audio-src]');
    if (!m) return '';
    if (m !== el && m.closest('[data-t-start]') !== el) return '';
    return m.getAttribute('data-audio-src') || '';
  }

  /** Everything that decides WHETHER and WHERE a box sounds. */
  function audioKey(url: string, timing: Timing): string {
    return `${url}|${timing.start}|${timing.dur}|${timing.clipIn}|${timing.speed}|${timing.mute ? 1 : 0}`
      + `|${timing.ignored ? 1 : 0}`
      + `|${timing.gain}|${timing.pan}|${timing.duck}|${timing.pitch}|${timing.varispeed ? 1 : 0}|${timing.fx}|${timing.enter ?? ''}:${timing.enterMs}|${timing.exit ?? ''}:${timing.exitMs}`;
  }

  /**
   * Other audible clips' windows, CLIP-LOCAL to `selfEl` (plans/165 WP-6 preview
   * parity): the DOM read of the same set duckSpansFor derives from the layer walk
   * on export. Computed when a box is PLACED, not per frame - a neighbour edited
   * mid-play re-ducks on the next placement, and the export is always exact.
   */
  function duckSpansOf(selfEl: HTMLElement, timing: Timing): { from: number; to: number }[] {
    const seq = seqMs();
    const a0 = timing.start;
    const a1 = audioEndSec(timing, seq) * 1000;
    const hosts = new Set<HTMLElement>();
    for (const m of canvasEl.querySelectorAll<HTMLElement>('[data-audio-src], video')) {
      const w = m.closest<HTMLElement>('[data-t-start]');
      if (w && w !== selfEl) hosts.add(w);
    }
    const out: { from: number; to: number }[] = [];
    for (const w of hosts) {
      const t = readTiming(w);
      if (t.mute || t.ignored) continue;
      const from = Math.max(t.start, a0);
      const to = Math.min(endOf(t, seq), a1);
      if (to - from > 50) out.push({ from: (from - a0) / 1000, to: (to - a0) / 1000 });
    }
    return out;
  }

  function stopAudioNode(node: AudioBufferSourceNode, gainNode?: GainNode | null, panNode?: StereoPannerNode | null): void {
    try { node.onended = null; } catch { /* fake/detached node */ }
    try { node.stop(); } catch { /* never started, or already ended */ }
    try { node.disconnect(); } catch { /* already torn down */ }
    if (gainNode) { try { gainNode.disconnect(); } catch { /* already torn down */ } }
  }

  /** Silence one box and forget it, so the next pass may re-place it. */
  function stopAudioFor(el: HTMLElement): void {
    const rec = audios.get(el);
    if (!rec) return;
    audios.delete(el);
    if (rec.node) stopAudioNode(rec.node, rec.gainNode, rec.panNode);
  }

  /** Silence the whole preview mix. Every exit from playback goes through here. */
  function stopAllAudio(): void {
    for (const [, rec] of audios) if (rec.node) stopAudioNode(rec.node, rec.gainNode, rec.panNode);
    audios.clear();
  }

  /**
   * Fetch + decode one source, at most once per clock.
   *
   * Bounded twice over: the declared Content-Length is refused before the body is
   * touched, and the read itself is abandoned at the same ceiling so an unlabelled
   * response cannot buffer a 500 MB asset just to be refused afterwards. Both ceilings
   * are the waveform reader's, so "too big to draw" and "too big to hear" agree.
   */
  async function fetchAndDecode(url: string, signal: AbortSignal): Promise<AudioBuffer | null> {
    const c = audioCtx();
    if (!c || typeof fetch !== 'function') return null;
    // Not a file - composed, not fetched. Sized to the sequence, the ceiling on
    // what any box can be heard under. See renderZzfxmToBuffer.
    if (isZzfxmRef(url)) return renderZzfxmToBuffer(c, url, seqMs() / 1000);
    const res = await fetch(url, { signal });
    if (!res.ok || signal.aborted) return null;
    const declared = Number(res.headers?.get?.('content-length') ?? Number.NaN);
    if (!withinDecodeBudget(Number.isFinite(declared) ? declared : null)) {
      log('warn', `sequence audio: ${url} is larger than the decode ceiling - silent in preview`);
      return null;
    }
    const bytes = await readBounded(res, MAX_AUDIO_DECODE_BYTES, signal);
    if (!bytes || signal.aborted) return null;
    // A TRACKER MODULE holds no encoded audio, so `decodeAudioData` would throw
    // `EncodingError` on it and the box would be silent with only a generic warning.
    // The bytes are already in hand, so recognising one costs a handful of byte
    // comparisons and no second fetch; libopenmpt renders it at the context's own
    // sample rate and the result joins the cache as an ordinary AudioBuffer.
    if (looksLikeTrackerModule(url, bytes)) {
      try {
        // `renderMod` TRANSFERS this buffer to the worker; nothing below reads it again.
        return await renderModule(c, new Uint8Array(bytes));
      } catch (err) {
        // Named, never swallowed - bufferFor's catch logs it against this url.
        throw new Error(`tracker module could not be rendered (${err instanceof Error ? err.message : String(err)})`);
      }
    }
    // An ingested-MIDI song asset: JSON bytes behind a blob: URL. See parseZzfxmSongJson.
    if (new Uint8Array(bytes)[0] === 0x7b /* '{' */) {
      const song = parseZzfxmSongJson(bytes);
      if (song) {
        const { renderSongToAudioBuffer } = await import('../lib/zzfxm-render.ts');
        return await renderSongToAudioBuffer(c, song);
      }
    }
    return await c.decodeAudioData(bytes);
  }

  const loadAudio = opts.loadAudio || fetchAndDecode;
  const renderModule = opts.renderModule || defaultRenderModule;

  /** Bytes of raw PCM one decoded buffer holds. */
  function pcmSizeOf(buf: AudioBuffer): number {
    const frames = Number(buf.length) || 0;
    const ch = Math.max(1, Number(buf.numberOfChannels) || 1);
    return frames * ch * 4;
  }

  /** The decoded buffer for a source, decoding it once and guarding the memory. */
  function bufferFor(url: string): Promise<AudioBuffer | null> {
    const hit = buffers.get(url);
    if (hit) return hit;
    if (audioFailed.has(url)) return Promise.resolve(null);
    if (buffers.size >= MAX_PREVIEW_AUDIO_SOURCES) {
      audioFailed.add(url);
      log('warn', `sequence audio: more than ${MAX_PREVIEW_AUDIO_SOURCES} distinct tracks in one composition - the rest are silent in preview`);
      return Promise.resolve(null);
    }
    if (pcmBytes >= MAX_PREVIEW_PCM_BYTES) {
      audioFailed.add(url);
      log('warn', 'sequence audio: decoded-audio budget reached - this track is silent in preview');
      return Promise.resolve(null);
    }
    const ac = new AbortController();
    audioAborts.add(ac);
    const p = loadAudio(url, ac.signal)
      .then((buf) => {
        if (!buf || dead) { buffers.delete(url); audioFailed.add(url); return null; }
        pcmBytes += pcmSizeOf(buf);
        return buf;
      })
      .catch((err: unknown) => {
        // An undecodable, offline or aborted track degrades to silence. It must never
        // reject into the frame loop: the picture keeps playing without the sound.
        buffers.delete(url);
        audioFailed.add(url);
        log('warn', `sequence audio: ${url} could not be decoded (${err instanceof Error ? err.message : String(err)}) - silent in preview`);
        return null;
      })
      .finally(() => { audioAborts.delete(ac); });
    buffers.set(url, p);
    return p;
  }

  /** A box's end on the timeline, seconds - its own window, capped by the sequence. */
  function audioEndSec(timing: Timing, seq: number): number {
    const end = endOf(timing, seq);
    return (seq > 0 ? Math.min(end, seq) : end) / 1000;
  }

  /**
   * Hand one decoded buffer to the audio thread, positioned against the master clock.
   *
   * `from` is where on the TIMELINE the sound begins: the box's start when it is still
   * ahead of the playhead (the look-ahead case, scheduled precisely), or the playhead
   * itself when we are already inside the box (play from the middle, a seek into it, a
   * decode that landed late) - in which case `when` is already past and the platform
   * starts it immediately with the matching offset, which is exactly right.
   */
  function startAudio(el: HTMLElement, timing: Timing, buf: AudioBuffer): void {
    const c = ctx;
    const rec = audios.get(el);
    if (!c || !rec || rec.node || !isPlaying || dead) return;
    if (!canvasEl.contains(el)) return;             // repainted away while decoding
    const seq = seqMs();
    const startSec = timing.start / 1000;
    const endSec = audioEndSec(timing, seq);
    const from = Math.max(startSec, c.currentTime - t0);
    if (!(endSec > from)) return;                   // the window has already closed
    const offset = timing.clipIn / 1000 + (from - startSec);
    const srcDur = Number.isFinite(buf.duration) ? buf.duration : 0;
    if (srcDur > 0 && offset >= srcDur) return;     // trimmed past the end of the file
    let dur = endSec - from;
    if (srcDur > 0) dur = Math.min(dur, srcDur - offset);
    if (!(dur > 0)) return;
    // The box's gain timeline (volume, fades - plans/165 WP-1/2), the SAME
    // clipGainEvents list the export mix evaluates, so what plays is what renders.
    // Events are CLIP-LOCAL; the schedule is anchored at the clip's start on the
    // context timeline (t0 + startSec), which is exactly right whether playback
    // begins at the clip's head or mid-window (a set/ramp scheduled in the past
    // resolves to its current value). Span anchors to the PLACED audible length,
    // matching the export's placed-PCM anchor.
    const spanSec = srcDur > 0
      ? Math.min(endSec - startSec, Math.max(0, srcDur - timing.clipIn / 1000))
      : endSec - startSec;
    const events = clipGainEvents({
      spanSec,
      gain: timing.gain,
      fadeInSec: timing.enter ? timing.enterMs / 1000 : 0,
      fadeOutSec: timing.exit ? timing.exitMs / 1000 : 0,
      volumeKeys: volumeKeysOf(timing.kf) ?? undefined,
      duck: timing.duck < 1 ? { level: timing.duck, spans: duckSpansOf(el, timing) } : undefined,
    });
    let node: AudioBufferSourceNode;
    let gainNode: GainNode | null = null;
    let panNode: StereoPannerNode | null = null;
    // The box's pan (plans/165 WP-5): a real StereoPannerNode, the same law the
    // export mix applies analytically, so the preview's stereo image matches the
    // file's. Only audio boxes reach this graph - a video element's sound cannot
    // pan in preview, which the inspector's Pan row states.
    const pan = Math.max(-1, Math.min(1, timing.pan ?? 0));
    try {
      node = c.createBufferSource();
      node.buffer = buf;
      if (pan !== 0 && typeof c.createStereoPanner === 'function') {
        panNode = c.createStereoPanner();
        panNode.pan.value = pan;
        panNode.connect(c.destination);
      }
      const sink: AudioNode = panNode ?? c.destination;
      if (isTrivialGain(events)) {
        node.connect(sink);
      } else {
        gainNode = c.createGain();
        scheduleGainEvents(gainNode.gain, events, t0 + startSec);
        node.connect(gainNode);
        gainNode.connect(sink);
      }
    } catch (err) {
      log('warn', `sequence audio: could not connect a source - ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    rec.node = node;
    rec.gainNode = gainNode;
    rec.panNode = panNode;
    node.onended = (): void => {
      // Keep the RECORD (the box has been dealt with at this playhead) but drop the
      // node, so the per-frame pass neither restarts it nor stops a dead node.
      const cur = audios.get(el);
      if (cur === rec && cur.node === node) { cur.node = null; cur.gainNode = null; cur.panNode = null; }
      try { node.disconnect(); } catch { /* already torn down */ }
      if (gainNode) { try { gainNode.disconnect(); } catch { /* already torn down */ } }
      if (panNode) { try { panNode.disconnect(); } catch { /* already torn down */ } }
    };
    try {
      node.start(Math.max(t0 + from, c.currentTime), offset, dur);
    } catch (err) {
      rec.node = null;
      rec.gainNode = null;
      stopAudioNode(node, gainNode, panNode);
      log('warn', `sequence audio: start refused - ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * The stretch-bounce cache (plans/165 WP-7): one rendered AudioBuffer per sped
   * clip placement, keyed by the SAME audioKey that re-places a box when its
   * timing changes - so a re-trim or speed change simply misses and re-bounces.
   * Small and FIFO-capped: a bounce is one clip window, not a whole track.
   */
  const bounces = new Map<string, Promise<AudioBuffer | null>>();
  function bounceStretch(buf: AudioBuffer, timing: Timing, key: string): Promise<AudioBuffer | null> {
    const hit = bounces.get(key);
    if (hit) return hit;
    const p = (async (): Promise<AudioBuffer | null> => {
      const seq = seqMs();
      const spanSec = Math.max(0, audioEndSec(timing, seq) - timing.start / 1000);
      const srcRate = buf.sampleRate;
      const from = Math.round((timing.clipIn / 1000) * srcRate);
      const srcN = Math.min(Math.max(0, buf.length - from), Math.round(spanSec * timing.speed * srcRate));
      if (!(srcN > 0) || !(spanSec > 0)) return null;
      const chs: Float32Array[] = [];
      for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) {
        const all = buf.getChannelData(c);
        chs.push(all.subarray(from, from + srcN).slice());
      }
      const { stretchPcm } = await import('../lib/audio-stretch-core.ts');
      const pitchSt = Math.max(-12, Math.min(12, timing.pitch ?? 0));
      const out = await stretchPcm(chs, timing.varispeed && timing.speed !== 1
        ? { speed: timing.speed, factor: timing.speed * 2 ** (pitchSt / 12), rate: srcRate }
        : { speed: timing.speed, semitones: pitchSt, rate: srcRate });
      // The fx chain, after the stretch - the same order the export applies
      // (effects process the remapped output, so echo times read in timeline
      // seconds), with the shell's cleanup driver spliced in at each clean()
      // token exactly as the export does. The engine parser drops unknown
      // tokens silently here; the export path is where the skip warning lives.
      // clean() runs only at 48 kHz (the model's native mix-rate path) - at any
      // other decode rate it degrades to the rest of the chain.
      if (timing.fx) {
        const { parseFxChain: parse, processFxPcm: apply } = await import('../../../../engine/src/audio-fx.ts');
        const parsed = parse(timing.fx);
        let planes: Float32Array[] = out;
        let seg: typeof parsed.entries = [];
        for (const entry of parsed.entries) {
          if (entry.name !== 'clean') { seg.push(entry); continue; }
          if (seg.length) { apply(planes, srcRate, seg); seg = []; }
          if (srcRate === 48_000) {
            const { cleanPcm } = await import('../lib/audio-clean-core.ts');
            planes = await cleanPcm(planes, srcRate);
          }
        }
        if (seg.length) apply(planes, srcRate, seg);
        for (let c = 0; c < out.length; c++) out[c] = planes[c]!;
      }
      const bounced = new AudioBuffer({ length: out[0]!.length, numberOfChannels: out.length, sampleRate: srcRate });
      for (let c = 0; c < out.length; c++) bounced.copyToChannel(out[c] as Float32Array<ArrayBuffer>, c);
      return bounced;
    })().catch((err: unknown) => {
      log('warn', `sequence audio: stretch bounce failed (${err instanceof Error ? err.message : String(err)}) - this clip is silent in preview`);
      return null;
    });
    bounces.set(key, p);
    if (bounces.size > 8) { const oldest = bounces.keys().next().value as string; bounces.delete(oldest); }
    return p;
  }

  /**
   * Make sure one audio box is placed for the CURRENT playhead. Idempotent: the record
   * is written before the decode is even requested, so a box that is downloading, or
   * that was refused, costs nothing on the next 59 frames of the second.
   */
  function placeAudio(el: HTMLElement, url: string, timing: Timing, key: string): void {
    if (!isPlaying || dead || audios.has(el)) return;
    if (!audioCtx()) return;                        // no output device: picture only
    const seq = seqMs();
    if (tMs / 1000 >= audioEndSec(timing, seq)) return;   // already past it
    // Muted or ignored (strikethrough, plans/174): reserve the slot so the box is not
    // re-placed every frame, but schedule no source - it stays silent.
    if (timing.mute || timing.ignored) { audios.set(el, { key, node: null, gainNode: null }); return; }
    if (!url) return;
    audios.set(el, { key, node: null, gainNode: null });
    if (timing.speed !== 1 || timing.pitch !== 0 || timing.fx !== '') {
      // Pitch/stretch/fx bounce (plans/165 WP-7/7b, plans/101 fx): the box's window is
      // rendered once by the SAME headless stretcher the export mix runs, cached
      // by the placement key (which carries speed, trim and window), and the
      // bounced buffer schedules exactly like any decoded track - so scrubbing
      // stays cheap and preview matches the file.
      void bufferFor(url).then(async (buf) => {
        const cur = audios.get(el);
        if (!buf || !cur || cur.key !== key || cur.node) return;
        const bounced = await bounceStretch(buf, timing, key);
        const cur2 = audios.get(el);
        if (!bounced || !cur2 || cur2.key !== key || cur2.node) return;
        startAudio(el, { ...timing, clipIn: 0, speed: 1, pitch: 0, fx: '' }, bounced);
      });
      return;
    }
    void bufferFor(url).then((buf) => {
      const cur = audios.get(el);
      if (!buf || !cur || cur.key !== key || cur.node) return;
      startAudio(el, timing, buf);
    });
  }

  /**
   * The per-frame assertion for one audio box. It only ever CORRECTS state:
   * re-places a box whose timing changed under it, silences one the playhead has left,
   * and places one that has never been placed (a box minted by a repaint mid-play).
   */
  function driveAudio(el: HTMLElement, timing: Timing, active: boolean): void {
    const url = audioSrcOf(el);
    if (!url) return;
    const key = audioKey(url, timing);
    const rec = audios.get(el);
    // Muted mid-playback, dragged, retrimmed: the placement is stale, drop it and let
    // the same frame re-place it against the new attributes.
    if (rec && rec.key !== key) { stopAudioFor(el); }
    if (!isPlaying) { stopAudioFor(el); return; }
    // PAST the window (not merely "not yet in it" - a box scheduled ahead of the
    // playhead is inactive on purpose and must keep its pending source).
    if (!active && tMs >= timing.start) { stopAudioFor(el); return; }
    placeAudio(el, url, timing, key);
  }

  function driveMedia(el: HTMLElement, timing: Timing, sourceMs: number, active: boolean): void {
    const video = el.querySelector('video');
    if (video) {
      const rec = seekerFor(video);
      // Clamp against the SOURCE's own length. A clip can legitimately be trimmed
      // longer than its media (dur is clamped to MAX_TIME_S, never to the file), and
      // without this the element pins at its end while the target keeps climbing - 
      // drift stays above tolerance and a corrective seek is issued EVERY frame for
      // the rest of the clip. Past the end we hold the last frame instead.
      const rawSec = sourceMs / 1000;
      const mediaEnd = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const pastEnd = mediaEnd > 0 && rawSec >= mediaEnd;
      const targetSec = pastEnd ? Math.max(0, mediaEnd - MEDIA_END_EPS_S) : rawSec;
      if (!active) {
        releaseVideo(video, rec);
        // The hook authors `autoplay loop` for the NO-CLOCK experience (ambient
        // scenery). With a timeline mounted the clock owns time: an off-window video
        // left free-running burns its decoder invisibly, and rec.playing only tracks
        // playback WE started - so silence the element itself, not just our record.
        if (!video.paused) { try { video.pause(); } catch { /* detached */ } }
      } else if (isPlaying) {
        // Free-run: the element's own clock is the smoothest thing available, so we
        // only intervene on drift. Rate follows the clip's speed so a 2× clip plays
        // 2× rather than being re-seeked 60 times a second.
        if (rec.mutedWas == null) { rec.mutedWas = video.muted; }
        // The authored `loop` belongs to the NO-CLOCK ambience. Under the clock a
        // looping element wraps to 0 inside a window trimmed past its media - the
        // export holds the last frame there, and the preview must show the same.
        if (rec.loopWas == null) { rec.loopWas = video.loop; try { video.loop = false; } catch { /* detached */ } }
        // Preserve-pitch parity for the element path (plans/165 WP-7b): the browser
        // holds a sped element's pitch by default, exactly like the export's
        // stretch; a varispeed clip flips the element to tape-style too.
        try { if (video.preservesPitch !== !timing.varispeed) video.preservesPitch = !timing.varispeed; } catch { /* older engine */ }
        const wantMuted = !!timing.mute || !!timing.ignored;
        if (video.muted !== wantMuted) video.muted = wantMuted;   // no per-frame write
        // Clip volume + fades on the element (plans/165 WP-1/2): the closed form of
        // the exact envelope the export mixes with. The element caps at 1, so a
        // boosted clip (gain > 1) previews at full and boosts only in the file -
        // stated in the inspector's copy. Fades follow the export's kind rule: a
        // video's soundtrack fades only under the `fade` kind.
        if (!wantMuted) {
          const spanRawSec = (endOf(timing, seqMs()) - timing.start) / 1000;
          const gainSpanSec = mediaEnd > 0
            ? Math.min(spanRawSec, Math.max(0, mediaEnd - timing.clipIn / 1000))
            : spanRawSec;
          const vol = clipGainValueAt({
            spanSec: gainSpanSec,
            gain: timing.gain,
            fadeInSec: timing.enter === 'fade' ? timing.enterMs / 1000 : 0,
            fadeOutSec: timing.exit === 'fade' ? timing.exitMs / 1000 : 0,
            volumeKeys: volumeKeysOf(timing.kf) ?? undefined,
            tSec: (tMs - timing.start) / 1000,
          });
          const capped = Math.min(1, vol);
          if (Math.abs(video.volume - capped) > 0.003) { try { video.volume = capped; } catch { /* detached */ } }
        }
        try { video.playbackRate = timing.speed; } catch { /* rate out of engine range */ }
        if (pastEnd) {
          // Media exhausted inside the window: hold the last frame, exactly as the
          // compositor renders it. The element would otherwise fire `ended` (or, on
          // a shorter media, sit wherever it stopped) while the box stays visible.
          if (!video.paused) { try { video.pause(); } catch { /* detached */ } }
          rec.playing = false;
          if (Math.abs((video.currentTime || 0) - targetSec) > DRIFT_TOLERANCE_S) rec.seeker.request(targetSec);
        } else {
          const drift = Math.abs((video.currentTime || 0) - targetSec);
          if (drift > DRIFT_TOLERANCE_S) rec.seeker.request(targetSec);
          if (!rec.playing) {
            rec.playing = true;
            try { void video.play()?.catch(() => { /* autoplay policy - silent */ }); } catch { /* detached */ }
          }
        }
      } else {
        // A parked editor holds every video FROZEN at the playhead's frame. Pause the
        // ELEMENT unconditionally, not just when rec.playing says we started it: the
        // hook's authored `autoplay` free-runs a clip that finished loading after the
        // last apply pass, and a paused canvas showing a moving picture reads as
        // broken (it also diverges from what the export will render).
        if (!video.paused) { try { video.pause(); } catch { /* detached */ } }
        rec.playing = false;
        // Past the source end the target no longer moves, so only ask once.
        if (!pastEnd || Math.abs((video.currentTime || 0) - targetSec) > DRIFT_TOLERANCE_S) {
          rec.seeker.request(targetSec, { scrubbing });
        }
      }
      return;
    }
    // Lottie: the player is mounted asynchronously by lottie-mount, so it is simply
    // absent for the first frames after a repaint - that is a no-op, not an error.
    // goToAndStop(value, isFrame=false) takes MILLISECONDS of the animation's own
    // timeline, which is exactly what `sourceMs` is (clipIn + local × speed).
    const marker = el.matches?.('[data-lottie-src]') ? el : el.querySelector('[data-lottie-src]');
    if (marker) {
      const player = lottiePlayerFor(marker);
      if (player && active) { try { player.goToAndStop(sourceMs, false); } catch { /* player mid-teardown */ } }
    }
    // Audio boxes (.lolly-box-audio) have no visual and no element to drive, so their
    // sound is placed on the shared AudioContext instead. This is the assertion pass,
    // not the transport: see driveAudio.
    driveAudio(el, timing, active);
  }

  // ── the apply pass ────────────────────────────────────────────────────────

  function applyNow(): void {
    if (dead) return;
    const els = boxes();
    store.prune(new Set(els));
    // Never let one bad element kill the frame: an exception escaping the rAF
    // callback would strand playback with `isPlaying === true`, videos still
    // playing and mute flags unrestored. Log and carry on - the release pass and
    // the subscriber fan-out below MUST still run.
    try {
      // PAUSED means an export (or another photographer) is holding this stage at its
      // AUTHORED pose - plans/104 section 6 point 0. The clock keeps its own time and keeps
      // fanning out ticks; what it must not do is put a frame back on the DOM between
      // two plate shots, because the exporter reads authored geometry off these very
      // elements. `store` was handed back when the pause was taken, so there is
      // nothing on them to re-assert until it lifts.
      //
      // The media drive rides inside the same call deliberately: an export owns the
      // playback of every clip it is compositing, and a preview seek landing mid-shot
      // is the same class of interference as a style write.
      if (!paused) {
        // `stage` is a lazy getter, not two numbers: measuring the artboard forces
        // layout, and a composition that authors no depth must not pay for that once
        // per frame. The applier calls it only when something actually projects.
        applyTimeToElements(els, tMs, {
          seqMs: seqMs(),
          store,
          media: driveMedia,
          stage: () => stageNativeSize(sequenceStageOf(canvasEl) ?? canvasEl),
        });
      }
    } catch (err) {
      log('warn', `sequence-clock: frame failed - ${err instanceof Error ? err.message : String(err)}`);
    }
    // Videos a repaint orphaned: PAUSE and un-mute them before dropping the record.
    // `releaseVideo` is the only path that restores `muted` and stops playback, so
    // skipping it leaves a detached element playing its audio until GC - one more
    // overlapping soundtrack per repaint during playback.
    for (const [video, rec] of [...videos]) {
      if (!canvasEl.contains(video)) { releaseVideo(video, rec); rec.seeker.destroy(); videos.delete(video); }
    }
    // Audio boxes a repaint orphaned. A scheduled source is on the AUDIO THREAD, not
    // on the element, so dropping the detached box without stopping it leaves the
    // track playing to the end of the sequence with nothing on screen to explain it - 
    // and a second copy starts the moment the fresh box is placed.
    for (const [el] of [...audios]) if (!canvasEl.contains(el)) stopAudioFor(el);
    for (const cb of [...ticks]) { try { cb(tMs); } catch { /* a bad subscriber never stops the clock */ } }
  }

  function schedule(): void {
    if (dead || frame) return;
    frame = raf(() => { frame = 0; applyNow(); });
  }

  // ── playback ──────────────────────────────────────────────────────────────

  function audioCtx(): AudioContext | null {
    if (ctx) return ctx;
    const Ctor = g.AudioContext || g.webkitAudioContext;
    if (!Ctor) return null;
    try { ctx = new Ctor(); } catch { ctx = null; }
    return ctx;
  }

  /**
   * Elapsed playback time, ms. The AudioContext is the master timebase - but ONLY
   * while it is actually running. A context refused by the autoplay policy (or one
   * whose `resume()` never settles) has a frozen `currentTime`, which would freeze
   * the playhead forever with `playing()` still true and the rAF loop still burning
   * a full apply pass per frame. And the old no-context fallback added a fixed 16 ms
   * per frame, so the sequence played at 2× on a 120 Hz display and in slow motion
   * under load. Both cases now fall back to real elapsed wall time, and the two
   * baselines are kept in step so a context that starts running mid-play takes over
   * without a jump.
   */
  function elapsedMs(): number {
    const c = ctx;
    if (c && c.state === 'running') {
      const v = (c.currentTime - t0) * 1000;
      wall0 = nowMs() - v;
      return v;
    }
    const v = nowMs() - wall0;
    if (c) t0 = c.currentTime - v / 1000;
    return v;
  }

  function tick(): void {
    if (dead || !isPlaying) return;
    // A context the autoplay policy refused has a FROZEN currentTime, so elapsedMs
    // keeps re-basing t0 against wall time while it stays suspended - which means
    // anything scheduled meanwhile sits at the wrong place on the audio timeline. The
    // frame `resume()` finally lands is the one frame where every source has to be
    // re-placed; the apply pass below does it from the cached buffers.
    const running = ctx ? ctx.state === 'running' : false;
    if (running !== ctxWasRunning) { ctxWasRunning = running; stopAllAudio(); }
    const dur = duration();
    let next = tMs;
    try { next = elapsedMs(); } catch { /* a dying context must not strand playback */ }
    if (dur > 0 && next >= dur) {
      tMs = dur;
      applyNow();
      pause();          // hold at the end, the editor convention
      return;
    }
    tMs = Math.max(0, next);
    try {
      applyNow();
    } finally {
      // Rescheduling in `finally`: playback must survive a frame that threw.
      if (isPlaying && !dead) loop = raf(tick);
    }
  }

  function pause(): void {
    if (!isPlaying) return;
    isPlaying = false;
    if (loop) { caf(loop); loop = 0; }
    for (const [video, rec] of videos) releaseVideo(video, rec);
    // Before the context is suspended: a suspended context never fires `onended`, so
    // a source left running here would be resurrected mid-note by the next resume.
    stopAllAudio();
    try { void ctx?.suspend?.(); } catch { /* context already closed */ }
    applyNow();          // settle every box at the held position
  }

  function duration(): number { return seqMs(); }

  function onVisibility(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') pause();
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  const clock: SequenceClock = {
    t: () => tMs,
    duration,
    seek(next, o) {
      if (dead) return;
      const dur = duration();
      const v = Number.isFinite(next) ? Math.max(0, next) : 0;
      tMs = dur > 0 ? Math.min(v, dur) : v;
      scrubbing = !!o?.scrubbing;
      if (isPlaying) {                                   // keep playback in step
        if (ctx) t0 = ctx.currentTime - tMs / 1000;
        wall0 = nowMs() - tMs;
        // Every scheduled source was placed against the OLD t0 and is now in the wrong
        // place. Drop them all; the apply pass this seek schedules re-places every box
        // against the new playhead (from the cached buffers, so no refetch).
        stopAllAudio();
      } else {
        // Seeking while paused must be silent - including a scrub that crosses an
        // audio box, and including the settling pass pause() itself runs.
        stopAllAudio();
      }
      // A DISCRETE seek applies before returning; only a SCRUB coalesces to rAF.
      // Callers act on the new position the moment seek() returns - the panel's
      // pointerup runs sync() → emitTime, whose active-ids signature is computed
      // from the MODEL and gates the next fire - so a deferred apply left every
      // synchronous reader (the off-playhead banner, the selection chrome) reading
      // the PREVIOUS position's DOM, permanently one seek behind: the very next
      // apply changed nothing the signature could see. A scrub keeps the rAF
      // coalescing (60 Hz of pointermoves must not each pay a full apply pass);
      // its consumers ride onTick, which applyNow fans out AFTER applying.
      if (scrubbing) schedule(); else applyNow();
    },
    play() {
      if (dead || isPlaying) return;
      const dur = duration();
      // Nothing timed = nothing to play. Without this the playhead would climb
      // forever (tick's end-of-sequence ceiling needs dur > 0) while the canvas
      // never changed.
      if (dur <= 0) return;
      if (tMs >= dur) tMs = 0;                 // at the end: Space replays from the top
      const c = audioCtx();
      if (c) { try { void c.resume?.(); } catch { /* resume is best-effort */ } }
      t0 = c ? c.currentTime - tMs / 1000 : 0;
      wall0 = nowMs() - tMs;
      if (!c) log('warn', 'sequence-clock: no AudioContext - playback falls back to frame stepping (audio boxes stay silent)');
      isPlaying = true;
      scrubbing = false;
      ctxWasRunning = c?.state === 'running';
      applyNow();          // places every audio box against the timebase set above
      loop = raf(tick);
    },
    pause,
    playing: () => isPlaying,
    reapply() {
      if (dead) return;
      // The canvas was rebuilt: every element the store remembers is detached, so
      // there is nothing to restore - just forget them and paint the new nodes.
      store.prune(new Set(boxes()));
      applyNow();
    },
    onTick(cb) {
      ticks.add(cb);
      return () => { ticks.delete(cb); };
    },
    destroy() {
      if (dead) return;
      dead = true;
      isPlaying = false;
      if (frame) { caf(frame); frame = 0; }
      if (loop) { caf(loop); loop = 0; }
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      for (const [video, rec] of videos) { releaseVideo(video, rec); rec.seeker.destroy(); }
      videos.clear();
      // Sound first: a scheduled source outlives the element, the canvas and this
      // object, and would go on playing into a closed editor.
      stopAllAudio();
      for (const ac of [...audioAborts]) { try { ac.abort(); } catch { /* already settled */ } }
      audioAborts.clear();
      buffers.clear();               // the last reference to every decoded buffer
      audioFailed.clear();
      pcmBytes = 0;
      // Every class and inline property this clock ever wrote, undone - plus any
      // thumbnail shot's borrow, so a restore landing after this cannot re-hide a box
      // nothing is left to un-hide it again.
      for (const el of boxes()) { el.classList.remove(OFF_CLASS); releaseShotBorrow(el); }
      store.restoreAll();
      ticks.clear();
      // Nothing composes on this canvas any more, so the read/restore seam must stop
      // counting this clock - a registry entry outliving its clock would hold the
      // canvas element alive and answer authored reads out of a dead store.
      unregisterWriter();
      try { void ctx?.close?.(); } catch { /* already closed */ }
      ctx = null;
    },
  };

  // The clock announces itself to the export-time read/restore seam (plans/104 section 6
  // point 0): it is the writer whose per-frame transform/opacity/filter/z-index sit on
  // the very elements an export is about to read authored geometry off. `reapply` is
  // the clock's own - re-asserting the CURRENT playhead, so an export that finishes
  // hands the editor back the frame the user was looking at, not frame 0.
  const writer: SequenceWriter = {
    root: canvasEl,
    store,
    setPaused(v) { paused = v; },
    reapply() { if (!paused) clock.reapply(); },
  };
  const unregisterWriter = registerSequenceWriter(writer);

  return clock;
}
