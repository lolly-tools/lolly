// SPDX-License-Identifier: MPL-2.0
/**
 * Neurospicy Mode - a background focus-beat player. Loops ONE catalog audio asset (any
 * type:'audio' catalog entry - the focus loops/songs tagged 'neurospicy' plus the brand's
 * other audio, e.g. licensed music beds) continuously while using the app, with a
 * volume. State (enabled / loop id / volume) persists to the PROFILE (canonical) + a
 * localStorage mirror (known before the profile loads), exactly like the sfx mute. Gapless:
 * each loop is decoded into an AudioBuffer and played via an AudioBufferSourceNode(loop=true)
 * - so mp3/aac priming gaps never apply. Shell chrome (host audio), never the engine.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { ZzfxSong } from '../../../../engine/src/zzfxm.ts';
import { renderSongToAudioBuffer } from './zzfxm-render.ts';
import { renderModToAudioBuffer, isModuleFormat } from './mod-render.ts';
import { RADIO_STATIONS, radioStation, isRadioId, radioAvailable, resolveStreamUrl } from './radio.ts';
import { isSfxMuted } from './sfx.ts';

// Just the host surface this module uses - the catalog assets (loop list + bytes) and the
// profile (persist). host.profile.set is a web-shell capability, not on the read-only engine
// ProfileAPI, so this is the shared shape the shell and this module agree on.
export type NeurospicyHost = {
  // `_listUserAssets` is a web-shell-internal method (not on the read-only engine
  // AssetAPI) - used to surface the user's OWN uploaded audio (which query() can't
  // see, as it only reads catalog assets). Optional so non-web hosts just skip it.
  assets: Pick<HostV1['assets'], 'get' | 'query'> & {
    _listUserAssets?(): Promise<Array<{ id: string; type?: string; format?: string; url?: string; meta?: Record<string, unknown> }>>;
  };
  profile: { get(): Promise<object>; set(p: object): Promise<unknown> };
};

export interface NeurospicyState { enabled: boolean; loopId: string; volume: number; repeat: boolean; }
const KEY = 'lolly:neurospicy';
// repeat: the classic behaviour - the selected track loops forever. false = play
// FORWARD through the list, advancing to the next track when the current one ends.
// Defaults to repeat (true), so nothing changes for anyone who never touches the
// toggle; spread into readInitial/hydrate so older persisted states inherit it.
const DEFAULTS: NeurospicyState = { enabled: false, loopId: '', volume: 0.5, repeat: true };

let state: NeurospicyState = readInitial();
function readInitial(): NeurospicyState {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<NeurospicyState>) }; } catch { /* no storage */ }
  return { ...DEFAULTS };
}
function persistLocal(): void { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* best-effort */ } }
async function persistProfile(host: NeurospicyHost): Promise<void> {
  try { const p = await host.profile.get(); await host.profile.set({ ...p, neurospicy: { ...state } }); } catch { /* best-effort */ }
}
export function getNeurospicy(): NeurospicyState { return { ...state }; }
/** Demo override for the ?neuro deep-link (lib/neuro-demo.ts): assign player state
 *  IN MEMORY only - no persistLocal, no persistProfile - so a shared demo link
 *  affects exactly one page load. `paused: false` makes isNeurospicyPlaying()
 *  report the "playing" look; nothing here touches the audio graph, so no audio
 *  ever autoplays. */
export function demoNeurospicy(partial: Partial<NeurospicyState> & { paused?: boolean }): void {
  const { paused: p, ...rest } = partial;
  state = { ...state, ...rest };
  if (p !== undefined) paused = p;
}
/** Reconcile from the profile (canonical) at boot; leaves defaults if absent. */
export function hydrateNeurospicy(fromProfile: unknown): void {
  if (fromProfile && typeof fromProfile === 'object') { state = { ...DEFAULTS, ...(fromProfile as Partial<NeurospicyState>) }; persistLocal(); }
}

// ── audio graph (own context, so muting sfx never touches the focus loop) ────────
type WinAudio = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;
// A pass-through analyser between the gain and the speakers, so the player can draw a
// level meter and the MilkDrop visualizer has something to react to. Everything audible
// flows through it: local buffer sources (zzfxm/opus/mod) AND, when the station's server
// allows it, the radio <audio> element (see `radioSource`).
let analyser: AnalyserNode | null = null;
let src: AudioBufferSourceNode | null = null;
// Progress bookkeeping for the current LOCAL source: position within the looping
// buffer = (ctx.currentTime - srcStartedAt + srcOffset) % duration. Radio has neither
// (a live stream has no duration), so the seek bar hides for it.
let srcStartedAt = 0;
let srcOffset = 0;
// Radio plays through an <audio> element (a live stream has no buffer to decode), but it
// is routed INTO the graph via createMediaElementSource so the meter and the visualizer
// see it - SomaFM's icecast sends `Access-Control-Allow-Origin: *`, which is exactly what
// a MediaElementSource needs, and radio is where people end up once they've heard their
// own catalogue enough times.
//
// The tap is FAIL-CLOSED: `crossOrigin` must be set before `src`, and an element loading a
// stream whose server omits the header refuses to play at all - silence, not just a dark
// meter. So a refused load remembers that host and replays the same URL on a fresh,
// untapped element. An element can only ever produce ONE MediaElementSource, so the
// element and its node are created and dropped together.
let radioEl: HTMLAudioElement | null = null;
let radioSource: MediaElementAudioSourceNode | null = null;
// ── Apple-mobile radio VISUALISER tap (plans/146 upgrade) ─────────────────────────
// On Apple mobile the audible radio element (radioEl) is deliberately BARE so it survives
// backgrounding (iOS suspends Web Audio). That leaves the visualiser with no signal. So a
// SECOND element plays the same stream tapped into its own analyser through a zero-gain sink
// - silent, purely to drive the viz in the FOREGROUND (where it's the only place a viz is
// seen), paused when the app is hidden to spare the extra stream. The audible element is
// never touched, so background playback is provably unaffected; a station that refuses the
// CORS tap, or an iOS that won't grant a 2nd stream, simply yields no viz.
let vizEl: HTMLAudioElement | null = null;
let vizSource: MediaElementAudioSourceNode | null = null;
let vizAnalyser: AnalyserNode | null = null;
let vizSilent: GainNode | null = null;
let vizUrl = '';           // the stream URL the viz element is (re)connected to
let vizVisWired = false;   // the visibilitychange listener is installed once
/** Stream hosts that refused a tapped load. Keyed by HOST, not a session-wide flag: the
 *  header is a property of the server, so one station without it must not cost every other
 *  station its meter for the rest of the session. */
const untappedHosts = new Set<string>();
/** There's no graph to tap into at all (no Web Audio in this browser) - then nothing is
 *  ever tapped, and that IS session-wide. */
let graphTapUnavailable = false;
let playingId = '';
let paused = false;   // transient transport pause (the play/pause button) - mode stays enabled
const buffers = new Map<string, AudioBuffer>();
const urlById = new Map<string, string>();
// A track is either an encoded audio file (fetch + decodeAudioData) or a ZzFXM
// song (format 'zzfxm' → render to PCM). Cache the format alongside the URL so
// loadBuffer picks the right path.
const formatById = new Map<string, string>();
// The most recent host play() ran with - so seekNeurospicy (which carries no host
// of its own) and a source's natural-end handler can advance the playlist in
// FORWARD mode without threading host through every call site.
let activeHost: NeurospicyHost | null = null;

/**
 * Wire a freshly-created buffer source's end behaviour to the current mode:
 * repeat → loop forever (onended never fires); forward → play once and advance to
 * the next track when it ends. onended ALSO fires on a manual stop() (track
 * switch, seek, pause), so those paths null it out BEFORE stopping (see
 * stopSource / seekNeurospicy) - leaving only a natural end to trigger an advance.
 */
function armSourceEnd(s: AudioBufferSourceNode, host: NeurospicyHost | null): void {
  s.loop = state.repeat;
  s.onended = state.repeat ? null : () => {
    // Ignore a stale source (another already took over) or a state that means we
    // shouldn't keep going (paused, disabled, sound muted).
    if (s !== src || !state.enabled || paused || isSfxMuted()) return;
    // Drop the spent one-shot BEFORE advancing: cycleNeurospicyLoop → play() and,
    // for a single-track (or wrap-to-self) list, that lands on the SAME id - where
    // play()'s idempotency guard (`src && playingId === loopId`) would otherwise
    // short-circuit and never build a fresh source, leaving audio dead. Clearing
    // src here forces the rebuild.
    stopSource();
    if (host) void cycleNeurospicyLoop(host, 1, { skipStreams: true });
  };
}

function makeAnalyser(c: AudioContext): AnalyserNode {
  const a = c.createAnalyser();
  a.fftSize = 128;
  a.smoothingTimeConstant = 0.8;
  return a;
}

function audio(): { ctx: AudioContext; gain: GainNode } | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as WinAudio).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    gain = ctx.createGain();
    gain.gain.value = state.volume;
    analyser = makeAnalyser(ctx);
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    startAnalyserWatchdog();
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* stays suspended until the next gesture */ });
  return { ctx, gain: gain! };
}

// ── analyser stall watchdog (iOS/WebKit) ─────────────────────────────────────────
// iOS stalls a *running* AnalyserNode after a while: audio keeps flowing through it to
// `destination` (still audible) and rAF keeps firing, but getByte*Data stops updating - so
// the visualizer's kicks/waveforms flat-line while playback and theme transitions carry on
// (confirmed on-device 2026-08-29, across SomaFM streams and catalog tracks). A fresh node
// reconnected into the same graph resumes updating; the source→gain path is never touched,
// so audio does not drop during the swap. getNeurospicyAnalyser() returns the live
// `analyser`, and the meter + visualizer both re-read it per frame, so they pick up the
// replacement on the next frame with no extra wiring.
const WATCHDOG_MS = 700;
const STALL_TICKS = 4; // ~2.8s of a byte-identical waveform while live → treat as stalled
let watchdog: ReturnType<typeof setInterval> | null = null;
let lastWave: Uint8Array | null = null;
let stallTicks = 0;

function reviveAnalyser(): void {
  if (!ctx || !gain) return;
  try { gain.disconnect(analyser!); } catch { /* wasn't connected */ }
  try { analyser?.disconnect(); } catch { /* wasn't connected */ }
  const a = makeAnalyser(ctx);
  gain.connect(a);
  a.connect(ctx.destination);
  analyser = a;
}

// The iOS-radio parallel viz tap (plans/146 upgrade path) is subject to the SAME analyser
// stall, so the watchdog can revive it too - rewiring vizSource → new analyser → the silent
// sink, leaving the audible bare element (radioEl) untouched.
function reviveVizAnalyser(): void {
  if (!ctx || !vizSource || !vizSilent) return;
  try { vizSource.disconnect(); } catch { /* wasn't connected */ }
  try { vizAnalyser?.disconnect(); } catch { /* wasn't connected */ }
  const a = makeAnalyser(ctx);
  vizSource.connect(a);
  a.connect(vizSilent);
  vizAnalyser = a;
}

function startAnalyserWatchdog(): void {
  if (watchdog != null || typeof setInterval === 'undefined') return;
  watchdog = setInterval(() => {
    // Watch whichever analyser is actually carrying the signal - the main one, or the iOS
    // parallel viz tap (getNeurospicyAnalyser prefers vizAnalyser when it exists).
    const active = getNeurospicyAnalyser();
    // Only judge while a signal is actually live: the raw time-domain waveform changes every
    // read when audio flows, so byte-equality across STALL_TICKS reads means the node froze.
    if (!active || neurospicySignalState() !== 'live') { stallTicks = 0; lastWave = null; return; }
    const buf = new Uint8Array(active.fftSize);
    active.getByteTimeDomainData(buf);
    const same = lastWave != null && lastWave.length === buf.length && buf.every((v, i) => v === lastWave![i]);
    if (same) {
      if (++stallTicks >= STALL_TICKS) {
        if (vizAnalyser && active === vizAnalyser) reviveVizAnalyser(); else reviveAnalyser();
        stallTicks = 0; lastWave = null;
      }
    } else {
      stallTicks = 0;
      lastWave = buf;
    }
  }, WATCHDOG_MS);
  // In a browser setInterval returns a number and this is a no-op; under node (the test
  // runner imports this module for real) it returns a Timeout whose open handle would
  // hold the child process alive forever - a watchdog must never keep the lights on.
  (watchdog as unknown as { unref?: () => void }).unref?.();
}

/** The analyser the meter + visualiser read each frame. Normally the focus-loop graph's,
 *  but the iOS parallel viz tap (see startVizTap) has its OWN analyser fed by the silent
 *  second element - prefer it when present so radio reacts on iOS too. Null until audio starts. */
export function getNeurospicyAnalyser(): AnalyserNode | null { return vizAnalyser ?? analyser; }

/**
 * The shared focus-audio context, built and resumed on demand - for the Atmosphere
 * ambience layers (lib/atmosphere.ts), which sound alongside the music rather than
 * through it. Browsers cap how many AudioContexts a page may hold, so ambience
 * borrows this one instead of opening a second; it connects to `ctx.destination`
 * directly, NOT to this module's gain, so the music volume slider never drags the
 * ambience with it (the point of the feature: noise under music, mixed separately).
 */
export function neuroAudioContext(): AudioContext | null { return audio()?.ctx ?? null; }

/** Is the current selection a live stream rather than a decodable track? */
export function isNeurospicyRadio(): boolean {
  return isRadioId(state.loopId) || formatById.get(state.loopId) === 'stream';
}

/**
 * Whether anything is actually reaching the analyser, and if not, why - the one predicate
 * the level meter and the visualizer both branch on, so they can never disagree about
 * whether there's a signal.
 *
 *   live - a local buffer source, or a tapped radio stream, is sounding
 *   idle - paused, disabled, or interface sound is muted
 *   connecting - playing, but the track/stream hasn't started producing samples yet
 *   unanalysable - a radio stream whose server wouldn't allow the tap, so it plays but
 *                   can't be drawn. A UI that shows a meter has to say this out loud, or
 *                   it just looks broken.
 */
export type NeuroSignalState = 'live' | 'idle' | 'connecting' | 'unanalysable';
export function neurospicySignalState(): NeuroSignalState {
  if (src?.buffer) return 'live';
  if (radioSource && radioEl && !radioEl.paused && radioEl.readyState >= 2) return 'live';
  // The iOS parallel viz tap: the audible radioEl is bare, but the silent vizEl is feeding
  // the analyser, so there IS a signal to draw (foreground only - it's paused when hidden).
  if (vizEl && !vizEl.paused && vizEl.readyState >= 2) return 'live';
  if (!isNeurospicyPlaying()) return 'idle';
  // A viz tap that exists but isn't producing yet is buffering (or paused-because-hidden),
  // not unanalysable - keep the UI on "connecting" rather than flashing "can't visualise".
  if (vizEl) return 'connecting';
  // An untapped element on a radio selection with no viz tap can never produce samples,
  // however well it's playing - say so rather than leaving the UI on "connecting" forever.
  if (isNeurospicyRadio() && radioEl && !radioSource) return 'unanalysable';
  return 'connecting';
}

/** Position within the current LOCAL track (a looping buffer, so it wraps). Null for
 *  radio or while no local source is sounding - callers hide their seek bar then. */
export function getNeurospicyProgress(): { position: number; duration: number } | null {
  if (!src?.buffer || !ctx) return null;
  const dur = src.buffer.duration;
  if (!(dur > 0)) return null;
  const pos = (ctx.currentTime - srcStartedAt + srcOffset) % dur;
  return { position: pos < 0 ? pos + dur : pos, duration: dur };
}

/** Jump to `seconds` within the current local track (the player's skip-to bar). A
 *  buffer source is one-shot, so seeking = swap in a new source starting at that
 *  offset. No-op for radio / while nothing local is sounding. */
export function seekNeurospicy(seconds: number): void {
  const a = audio();
  const buf = src?.buffer;
  if (!a || !src || !buf) return;
  const offset = ((seconds % buf.duration) + buf.duration) % buf.duration;
  src.onended = null; // our own swap, not a natural end - don't advance the list
  try { src.stop(); } catch { /* already stopped */ }
  src.disconnect();
  const s = a.ctx.createBufferSource();
  s.buffer = buf; s.connect(a.gain);
  armSourceEnd(s, activeHost); // keep the same repeat/forward behaviour after a seek
  s.start(0, offset);
  src = s;
  srcStartedAt = a.ctx.currentTime; srcOffset = offset;
}

function stopSource(): void {
  if (src) { src.onended = null; try { src.stop(); } catch { /* already stopped */ } src.disconnect(); src = null; }
  // The element (and its one-per-element source node) is kept for reuse; only the stream
  // is dropped. `onerror` goes first: clearing `src` can itself fire an error event, and
  // the tap-demotion path must not read a deliberate stop as a CORS refusal.
  if (radioEl) {
    radioEl.onerror = null;
    try { radioEl.pause(); } catch { /* ignore */ }
    radioEl.removeAttribute('src');
  }
  dropVizTap();   // stop the silent iOS viz stream too (no-op off Apple mobile / when never started)
  playingId = '';
}

function streamHost(url: string): string {
  try { return new URL(url, location.href).host; } catch { return url; }
}

/** iOS / iPadOS (incl. iPadOS 13+ reporting a Mac UA behind a touch screen). On these,
 *  a radio <audio> element tapped through the AudioContext goes SILENT the moment the app
 *  is backgrounded - iOS suspends Web Audio. Played BARE (untapped) straight to the
 *  hardware, the same element keeps sounding in the background / on the lock screen, given
 *  the Tauri iOS shell's .playback audio session + UIBackgroundModes:audio. The trade is
 *  no radio VISUALISER on iOS (local-loop viz, a buffer source through the analyser, is
 *  unaffected in the foreground). See plans/146. */
function isAppleMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

/** Whether to route a radio stream INTO the Web Audio graph (for the meter + visualiser),
 *  or play it bare. Pure, so the one rule that matters - never tap on Apple mobile, so
 *  background playback survives - is unit-tested (neurospicy-radio-tap.test.ts). */
export function tapDecision(o: { untappedHost: boolean; graphUnavailable: boolean; appleMobile: boolean }): boolean {
  return !o.graphUnavailable && !o.untappedHost && !o.appleMobile;
}

/** Is this stream one we should try to tap? */
function shouldTap(url: string): boolean {
  return tapDecision({
    untappedHost: untappedHosts.has(streamHost(url)),
    graphUnavailable: graphTapUnavailable,
    appleMobile: isAppleMobile(),
  });
}

/**
 * The <audio> element radio streams through, tapped into the graph if it can be.
 *
 * Order matters: `crossOrigin` before any `src`, and `createMediaElementSource` while the
 * element is still fresh. With the tap in place the element's output goes gain → analyser →
 * destination like everything else, so volume and the meter come for free.
 *
 * A change of tap state needs a NEW element: an element that has produced a
 * MediaElementSource can never produce another, and can never be rid of the one it has.
 */
function ensureRadioEl(tap: boolean): HTMLAudioElement {
  if (radioEl && !!radioSource === tap) return radioEl;
  dropRadioEl();
  const el = new Audio();
  el.preload = 'none';
  // Belt-and-braces beside main.ts's Tauri-wide document policy: icecast 403s
  // localhost-ish referers. Honoured by desktop browsers; Android WebView skips
  // the attribute for media and relies on the document meta instead. Attribute
  // form: this tsconfig's lib.dom predates the referrerPolicy property.
  el.setAttribute('referrerpolicy', 'no-referrer');
  if (tap) {
    el.crossOrigin = 'anonymous';
    const a = audio();
    try {
      if (!a) throw new Error('no audio graph');
      radioSource = a.ctx.createMediaElementSource(el);
      radioSource.connect(a.gain);
    } catch {
      // No Web Audio at all (or the node was refused): play it bare rather than not at all.
      radioSource = null;
      graphTapUnavailable = true;
      el.removeAttribute('crossorigin');
    }
  }
  radioEl = el;
  return el;
}

/** Drop the element AND its source node together - the only way to un-tap, since an element
 *  that has produced a MediaElementSource can never produce another. */
function dropRadioEl(): void {
  if (radioSource) { try { radioSource.disconnect(); } catch { /* already gone */ } radioSource = null; }
  if (radioEl) {
    radioEl.onerror = null;
    try { radioEl.pause(); } catch { /* ignore */ }
    radioEl.removeAttribute('src');
    try { radioEl.load(); } catch { /* ignore */ }   // abort the in-flight connection
    radioEl = null;
  }
}

/** Start (or re-point) the silent viz element for the current stream. No-op when Web Audio
 *  is unavailable or the stream can't be CORS-tapped; the audible bare element is untouched
 *  in every case, so the worst outcome is simply no viz. Skips streaming while the app is
 *  hidden (the viz isn't seen then, and the extra stream is wasted). */
function startVizTap(url: string): void {
  const a = audio();
  if (!a) return;
  wireVizVisibility();
  vizUrl = url;
  if (!vizEl) {
    const el = new Audio();
    el.preload = 'none';
    el.setAttribute('referrerpolicy', 'no-referrer');
    el.crossOrigin = 'anonymous';   // required for the analyser tap; do NOT set el.muted (Safari
                                    // mutes the graph path too, which would starve the analyser)
    try {
      vizSource = a.ctx.createMediaElementSource(el);
      vizAnalyser = makeAnalyser(a.ctx);
      vizSilent = a.ctx.createGain();
      vizSilent.gain.value = 0;      // inaudible, but keeps a live path to destination so the
                                     // element's samples actually flow into the analyser
      vizSource.connect(vizAnalyser);
      vizAnalyser.connect(vizSilent);
      vizSilent.connect(a.ctx.destination);
    } catch {
      dropVizTap();   // no tap possible on this browser → no viz, audible path unaffected
      return;
    }
    // A CORS refusal or a drop on the viz element is viz-only: give up quietly, never touch radioEl.
    el.onerror = (): void => { dropVizTap(); };
    vizEl = el;
  }
  if (typeof document !== 'undefined' && document.hidden) return; // don't open the 2nd stream unseen
  vizEl.src = url;
  void vizEl.play().catch(() => { /* needs the connection / a gesture; retried on next radio start */ });
}

/** Tear down the viz tap and its element+nodes together (an element that has produced a
 *  MediaElementSource can never produce another). */
function dropVizTap(): void {
  if (vizSource) { try { vizSource.disconnect(); } catch { /* gone */ } vizSource = null; }
  if (vizAnalyser) { try { vizAnalyser.disconnect(); } catch { /* gone */ } vizAnalyser = null; }
  if (vizSilent) { try { vizSilent.disconnect(); } catch { /* gone */ } vizSilent = null; }
  if (vizEl) {
    vizEl.onerror = null;
    try { vizEl.pause(); } catch { /* ignore */ }
    vizEl.removeAttribute('src');
    try { vizEl.load(); } catch { /* ignore */ }
    vizEl = null;
  }
  vizUrl = '';
}

/** Pause the silent viz stream while the app is hidden (nothing to see, don't waste the
 *  second connection); resume it on return if a station is still playing. Installed once. */
function wireVizVisibility(): void {
  if (vizVisWired || typeof document === 'undefined') return;
  vizVisWired = true;
  document.addEventListener('visibilitychange', () => {
    if (!vizEl) return;
    if (document.hidden) {
      try { vizEl.pause(); } catch { /* ignore */ }
    } else if (vizUrl && isNeurospicyPlaying() && isNeurospicyRadio()) {
      if (!vizEl.getAttribute('src')) vizEl.src = vizUrl;
      void vizEl.play().catch(() => { /* transient - next start retries */ });
    }
  });
}

/** Volume lives on the graph's gain when the stream is tapped, and on the element itself
 *  when it isn't - otherwise the slider would move nothing in one of the two paths. */
function applyRadioVolume(): void {
  if (!radioEl) return;
  if (radioSource) {
    radioEl.volume = 1;
    if (gain) gain.gain.value = state.volume;
  } else {
    radioEl.volume = state.volume;
  }
}

/**
 * Point the radio element at a resolved stream URL and play.
 *
 * A load error on a TAPPED element is treated as the CORS refusal it almost always is: drop
 * the tap and replay the same URL untapped, so the worst case is a dark visualizer rather
 * than silence. Exactly one retry - the rebuilt element is untapped, so a second error falls
 * through as the genuine stream failure it then is.
 */
function startRadioStream(url: string, id: string): void {
  audio();   // build/resume the context: a tapped element is silent while it's suspended
  const el = ensureRadioEl(shouldTap(url));
  el.onerror = (): void => {
    el.onerror = null;
    // A cleared src (our own stop) is not a failure, and an already-untapped element that
    // errors is a real stream problem - leave it silent, as before.
    if (!el.getAttribute('src') || !radioSource) return;
    console.warn('[lolly:neuro] the station refused a CORS-tapped load - replaying it without the analyser tap');
    untappedHosts.add(streamHost(url));
    dropRadioEl();
    if (state.loopId === id && state.enabled && !paused && !isSfxMuted()) startRadioStream(url, id);
  };
  // A stream takes a moment to connect and buffer, so it is NOT yet 'live' when play() is
  // called. The meter and the visualizer both stand themselves down when there's no signal
  // and restart on this event - without it they'd park on the baseline for the whole track.
  el.onplaying = (): void => notifyPlaying();
  el.src = url;
  applyRadioVolume();
  void el.play().catch(() => { /* needs a gesture or a live connection */ });
  playingId = id;
  // Apple mobile only: the audible element above is bare (untapped) for background survival,
  // so light up the visualiser with a separate silent tap on the same stream. Everywhere else
  // the audible element is itself tapped into the main analyser, so the viz already works.
  if (!radioSource && isAppleMobile()) startVizTap(url);
  notifyPlaying();
}

// Play a live radio stream (resolving the current stream URL from the station's .pls).
// Silent no-op offline or on stream error.
async function playRadio(): Promise<void> {
  const id = state.loopId;
  const station = radioStation(id);
  if (!station) return;
  if (playingId === id && radioEl && !radioEl.paused) { applyRadioVolume(); return; }
  stopSource();
  try {
    const streamUrl = await resolveStreamUrl(station.pls);
    if (state.loopId !== id || !state.enabled || paused || isSfxMuted()) return; // state changed while resolving
    startRadioStream(streamUrl, id);
  } catch { /* offline / stream unavailable - leave silent */ }
}

// Decoded PCM is big (~1.4 MB per stereo second) and the track list now spans the
// whole catalog, including multi-minute music beds (tens of MB each decoded) - so the
// cache is bounded by BYTES, not entries, evicting least-recently-played first. The
// currently-sounding buffer is skipped (its source holds it alive regardless, so
// evicting it would only force a pointless re-decode on replay).
const MAX_BUFFER_BYTES = 96 * 1024 * 1024;
const bufferBytes = (b: AudioBuffer): number => b.length * b.numberOfChannels * 4;

async function loadBuffer(id: string, url: string, format: string | undefined): Promise<AudioBuffer | null> {
  const cached = buffers.get(id);
  if (cached) { buffers.delete(id); buffers.set(id, cached); return cached; } // refresh recency
  const a = audio(); if (!a) return null;
  try {
    let buf: AudioBuffer;
    if (format === 'zzfxm') {
      // A ZzFXM song: a few KB of nested-array data, synthesised to PCM in a worker.
      const song = (await (await fetch(url)).json()) as ZzfxSong;
      buf = await renderSongToAudioBuffer(a.ctx, song);
    } else if (isModuleFormat(format)) {
      // A tracker module (.mod/.xm/.s3m/.it/…): tiny sample-based song data no browser
      // <audio> can play. libopenmpt (WASM) decodes it to PCM in a worker, one pass, so
      // it flows through this same buffer path - meter, seek, loop all come for free.
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      buf = await renderModToAudioBuffer(a.ctx, bytes);
    } else {
      const bytes = await (await fetch(url)).arrayBuffer();
      buf = await a.ctx.decodeAudioData(bytes);
    }
    buffers.set(id, buf);
    let total = 0;
    for (const b of buffers.values()) total += bufferBytes(b);
    for (const [k, b] of buffers) {
      if (total <= MAX_BUFFER_BYTES) break;
      if (k === id || k === playingId) continue;
      buffers.delete(k);
      total -= bufferBytes(b);
    }
    return buf;
  } catch { return null; }
}

// Start (or switch to) the selected loop; idempotent when already playing it.
async function play(host: NeurospicyHost): Promise<void> {
  activeHost = host; // remembered for seek + end-of-track advance (see armSourceEnd)
  // The interface-sound mute is the MASTER mute: while sound is off, the focus loop is silent
  // too (its enabled preference is kept, so it resumes when sound is turned back on).
  if (!state.enabled || !state.loopId || isSfxMuted() || paused) { stopSource(); return; }
  // Radio station? Stream it via <audio>, not the focus-loop buffer path.
  if (isRadioId(state.loopId) || formatById.get(state.loopId) === 'stream') { await playRadio(); return; }
  if (src && playingId === state.loopId) { if (gain) gain.gain.value = state.volume; return; }
  const a = audio(); if (!a) return;
  // Capture the target now: awaits below can interleave with another play() (rapid
  // next/next, or a concurrent playRadio), so re-validate the selection afterwards
  // - otherwise a slow load could start a stale source over the current one.
  const id = state.loopId;
  let url = urlById.get(id);
  let format = formatById.get(id);
  if (!url || format === undefined) {
    try {
      const ref = await host.assets.get(id);
      url = ref.url; format = ref.format;
      if (url) urlById.set(id, url);
      if (format) formatById.set(id, format);
    } catch { return; }
  }
  if (!url || state.loopId !== id) return;
  const buf = await loadBuffer(id, url, format);
  if (!buf || state.loopId !== id || !state.enabled || paused || isSfxMuted()) return;
  stopSource();
  const s = a.ctx.createBufferSource();
  s.buffer = buf; s.connect(a.gain);
  armSourceEnd(s, host); // loop (repeat) or advance-on-end (forward), per state.repeat
  a.gain.gain.value = state.volume; s.start();
  src = s; playingId = id;
  srcStartedAt = a.ctx.currentTime; srcOffset = 0;
  notifyPlaying();
}

// Signal that audio just started, so the dock's level meter (re)starts its rAF - 
// notably on the boot autoplay-resume path, where the analyser doesn't exist until
// the armed gesture fires play(). Kept as a DOM event to avoid the lib↔component dep.
function notifyPlaying(): void {
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('lolly:neuro-playing'));
}

// Signal that the enabled flag changed, so other rendered instances of the Sound-settings
// toggle (e.g. an already-open popover elsewhere) can repaint to match - see wireNeurospicy
// in sound-toggle.ts.
function notifyEnabledChanged(): void {
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('lolly:neuro-enabled'));
}

export async function applyNeurospicy(host: NeurospicyHost): Promise<void> { await play(host); }

export async function setNeurospicyEnabled(host: NeurospicyHost, on: boolean): Promise<void> {
  state.enabled = on;
  notifyEnabledChanged();
  paused = false; // enabling/disabling the mode always resets the transport to "play"
  if (on && !state.loopId) { const loops = await listLoops(host); state.loopId = loops[0]?.id ?? ''; }
  persistLocal(); void persistProfile(host);
  await play(host);
}

/** Is the loop actually sounding right now (mode on, not paused, sound not muted)? */
export function isNeurospicyPlaying(): boolean {
  return state.enabled && !paused && !isSfxMuted();
}
/** The play/pause transport - pause/resume WITHOUT turning the mode off. Returns the new playing state. */
export async function toggleNeurospicyPlay(host: NeurospicyHost): Promise<boolean> {
  paused = !paused;
  if (paused) stopSource(); else await play(host);
  return !paused;
}
export async function setNeurospicyLoop(host: NeurospicyHost, id: string): Promise<void> {
  state.loopId = id; persistLocal(); void persistProfile(host);
  await play(host);
}
export function setNeurospicyVolume(host: NeurospicyHost, v: number): void {
  state.volume = Math.max(0, Math.min(1, v)); persistLocal(); void persistProfile(host);
  if (gain) gain.gain.value = state.volume;
  applyRadioVolume();
}
/** Switch between repeat (loop the current track) and forward (advance through
 *  the list when a track ends). Re-arms the live source so it takes effect at once
 * - repeat→forward lets the current track finish then advances; forward→repeat
 *  makes it loop from here on. */
export async function setNeurospicyRepeat(host: NeurospicyHost, repeat: boolean): Promise<void> {
  state.repeat = repeat; persistLocal(); void persistProfile(host);
  activeHost = host;
  if (src) armSourceEnd(src, host);
}
/** Stop playback now WITHOUT changing the saved enabled state - used when the
 *  Neurospicy feature flag is switched off (hide + silence, keep the preference). */
export function stopNeurospicy(): void { stopSource(); }

// ── the track catalogue (every type:'audio' catalog asset) ──────────────────────
// Optional hand-picked slugs (no path prefix) to float to the top of the picker;
// everything else sorts alphabetically. Shared by BOTH the Neurospicy select and the
// video music picker (tool.ts). Empty by default - populate with real catalog ids.
export const FEATURED_LOOPS: string[] = [];
export function loopRank(id: string): number {
  const slug = id.split('/').pop() ?? '';
  const fi = FEATURED_LOOPS.indexOf(slug);
  return fi >= 0 ? fi : 1000;                // featured up top; the rest alphabetical
}

/** A track for the player: id + display name, plus tags (for a mood chip) and the
 *  format (zzfxm/opus → local, meter-capable; a future 'stream' → radio, no meter). */
export interface NeuroTrack { id: string; name: string; tags: string[]; format: string }

// ── playlist order ──────────────────────────────────────────────────────────
// ONE order for the whole feature: listLoops returns tracks in it, the player's
// picker renders them in it (grouped by these keys), and prev/next + the
// end-of-track advance walk it. They must not diverge - "next" has to go where
// the list says it goes.
export const NEURO_CATEGORY_ORDER: string[] = ['catalog', 'uploads', 'lolly', 'ambient', 'beats', 'radio'];

/** Which playlist group a track belongs to (the picker's section, and the sort key). */
export function trackCategory(t: NeuroTrack): string {
  if (t.format === 'stream' || t.tags.includes('radio') || t.tags.includes('stream')) return 'radio';
  if (t.id.startsWith('user/')) return 'uploads';       // the user's own uploads
  if (!t.tags.includes('neurospicy')) return 'catalog'; // catalog audio outside the focus sets (music beds…)
  if (t.format === 'zzfxm') return 'lolly';             // our generated / MIDI-converted tracks
  if (t.tags.includes('lofi')) return 'ambient';        // the lo-fi loops
  return 'beats';                                       // the remaining loops (breakbeats)
}

/** Sort comparator for the canonical playlist order: group, then any featured
 *  slugs, then alphabetical within the group. */
function byPlaylistOrder(a: NeuroTrack, b: NeuroTrack): number {
  const rank = (t: NeuroTrack): number => {
    const i = NEURO_CATEGORY_ORDER.indexOf(trackCategory(t));
    return i < 0 ? NEURO_CATEGORY_ORDER.length : i; // an unknown group trails, never leads
  };
  return rank(a) - rank(b) || loopRank(a.id) - loopRank(b.id) || a.name.localeCompare(b.name);
}
// Cache only the connectivity-INDEPENDENT part (catalog + user uploads). Radio is
// appended fresh on every call so it appears/disappears with `navigator.onLine`
// instead of being frozen at whatever the first call saw.
let localLoopsCache: NeuroTrack[] | null = null;
export async function listLoops(host: NeurospicyHost): Promise<NeuroTrack[]> {
  if (!localLoopsCache) {
    let loops: NeuroTrack[] = [];
    try {
      // ALL catalog audio, not just the 'neurospicy'-tagged focus sets - the brand's
      // other audio (e.g. licensed music beds) is playable here too; the player's
      // picker groups it under a separate "Catalog" section (see trackCategory).
      const refs = await host.assets.query({ type: 'audio' });
      for (const r of refs) { if (r.url) urlById.set(r.id, r.url); if (r.format) formatById.set(r.id, r.format); }
      loops = refs.map((r): NeuroTrack => ({
        id: r.id,
        name: String((r.meta?.name as string | undefined) ?? r.id),
        tags: Array.isArray(r.meta?.tags) ? (r.meta.tags as string[]) : [],
        format: r.format ?? '',
      }));
    } catch { loops = []; }
    // The user's OWN uploaded audio - query() only reads catalog assets, so pull user
    // uploads separately and merge them in. ANY user audio plays here (tags only drive
    // the picker grouping/mood chip - older uploads, e.g. MIDI-converted songs, predate
    // the ingest tagging and must not be dropped).
    try {
      const userAssets = host.assets._listUserAssets ? await host.assets._listUserAssets() : [];
      for (const a of userAssets) {
        const tags = Array.isArray(a.meta?.tags) ? (a.meta.tags as string[]) : [];
        if (a.type !== 'audio') continue;
        if (a.url) urlById.set(a.id, a.url);
        if (a.format) formatById.set(a.id, a.format);
        loops.push({ id: a.id, name: String((a.meta?.name as string | undefined) ?? a.id), tags, format: a.format ?? '' });
      }
    } catch { /* no user assets on this host */ }
    // Sort catalog + uploads TOGETHER into the canonical playlist order, so this list
    // is exactly what the picker shows and exactly what next/prev step through.
    loops.sort(byPlaylistOrder);
    // Never cache EMPTINESS: on a cold install the dock builds before the catalog
    // sync lands, and caching that zero-track answer would hide the whole library
    // until reload. An empty result stays uncached so the next call re-queries
    // (main.ts also invalidates once the sync resolves).
    if (loops.length) localLoopsCache = loops;
    else return radioTracks();
  }
  // Opt-in radio (SomaFM) trails the local tracks - re-evaluated each call so it
  // appears/disappears with `navigator.onLine` instead of freezing in the cache.
  return localLoopsCache.concat(radioTracks());
}

/** The connectivity-gated radio stations (empty offline; fresh each call). */
function radioTracks(): NeuroTrack[] {
  if (!radioAvailable()) return [];
  for (const s of RADIO_STATIONS) formatById.set(s.id, 'stream');
  return RADIO_STATIONS.map((s): NeuroTrack => ({ id: s.id, name: s.name, tags: ['radio', 'stream'], format: 'stream' }));
}

/** Drop the cached track list (an audio upload changed it) and nudge any mounted
 *  player to rebuild - listLoops re-queries on its next call. */
export function invalidateNeurospicyTracks(): void {
  localLoopsCache = null;
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('lolly:neuro-tracks'));
}

/** DELETED assets need more than a list rebuild: purge them from every player cache,
 *  and if one of them is the CURRENT track, stop it - the looping source would keep
 *  sounding with no row in the picker and a dangling persisted loopId. When the mode
 *  was actively sounding, move on to the first remaining track (like pressing next);
 *  otherwise just clear the selection. */
export async function dropNeurospicyTracks(host: NeurospicyHost, ids: string[]): Promise<void> {
  for (const id of ids) { buffers.delete(id); urlById.delete(id); formatById.delete(id); }
  localLoopsCache = null;
  if (ids.includes(state.loopId)) {
    const wasSounding = !!src && state.enabled && !paused && !isSfxMuted();
    stopSource();
    state.loopId = '';
    // Skip radio when advancing: it's an OPT-IN networked source - a delete
    // gesture must never silently start (and persist) a live internet stream.
    const next = (await listLoops(host)).find((t) => !ids.includes(t.id) && t.format !== 'stream' && !t.tags.includes('radio'));
    if (next && wasSounding) {
      await setNeurospicyLoop(host, next.id); // persists + plays
    } else {
      persistLocal(); void persistProfile(host);
    }
  }
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('lolly:neuro-tracks'));
}

/** Boot reconcile for a persisted selection that no longer exists. A loopId lives in the
 *  PROFILE (+ localStorage mirror), so an asset RETIRED FROM THE CATALOG since the user
 *  last picked it (they didn't delete it - we did) leaves a dangling id that nothing
 *  self-heals: play() calls assets.get(), it throws, the catch silently returns, and the
 *  mode sits enabled-but-silent with no row selected. Same cure as dropNeurospicyTracks:
 *  clear it, and advance to the first real track if the mode was left on.
 *  Call ONLY after the catalog sync resolves - see the empty-list guard below. */
export async function reconcileNeurospicySelection(host: NeurospicyHost): Promise<void> {
  const id = state.loopId;
  if (!id || isRadioId(id)) return;              // nothing picked, or a station (always resolvable)
  const loops = await listLoops(host);
  // Local = catalog assets + the user's own uploads. Radio is appended fresh on every
  // call and is present even offline, so it must NOT count as evidence the catalog loaded:
  // on a cold/offline boot listLoops() legitimately returns radio-only, and treating that
  // as "your track is gone" would wipe a perfectly good selection.
  const local = loops.filter((t) => t.format !== 'stream' && !t.tags.includes('radio'));
  if (!local.length) return;                     // catalog not loaded yet - never clear on no evidence
  if (local.some((t) => t.id === id)) return;    // still there - nothing to do
  const wasEnabled = state.enabled;
  stopSource();
  state.loopId = '';
  const next = local[0];                         // never radio: an opt-in stream must not auto-start
  if (next && wasEnabled) {
    await setNeurospicyLoop(host, next.id);      // persists + plays
  } else {
    persistLocal(); void persistProfile(host);
  }
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('lolly:neuro-tracks'));
}

/** Step to the previous/next track in picker order (wraps) - the SAME order the
 *  player's list shows, since listLoops owns it. Keeps the mode enabled.
 *  `skipStreams` walks past the radio stations: used by the end-of-track advance,
 *  which must never silently (and persistently) start a live internet stream.
 *  A pressed next/prev button passes it off - radio is right there in the list. */
export async function cycleNeurospicyLoop(
  host: NeurospicyHost, dir: 1 | -1, opts: { skipStreams?: boolean } = {},
): Promise<void> {
  const loops = await listLoops(host);
  if (!loops.length) return;
  const cur = loops.findIndex((l) => l.id === state.loopId);
  const from = cur < 0 ? (dir === 1 ? -1 : 0) : cur;
  for (let step = 1; step <= loops.length; step++) {
    const t = loops[(((from + dir * step) % loops.length) + loops.length) % loops.length]!;
    if (opts.skipStreams && trackCategory(t) === 'radio') continue;
    await setNeurospicyLoop(host, t.id);
    return;
  }
}

// Autoplay policy: audio can't start before a user gesture. If enabled at boot, arm a
// one-shot gesture that (re)starts the loop.
export function armNeurospicy(host: NeurospicyHost): void {
  if (!state.enabled || !state.loopId || typeof document === 'undefined') return;
  const go = (): void => {
    document.removeEventListener('pointerdown', go, true);
    document.removeEventListener('keydown', go, true);
    void play(host);
  };
  document.addEventListener('pointerdown', go, { capture: true, passive: true });
  document.addEventListener('keydown', go, { capture: true, passive: true });
}
