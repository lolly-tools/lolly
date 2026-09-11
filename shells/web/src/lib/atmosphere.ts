// SPDX-License-Identifier: MPL-2.0
/**
 * Atmosphere - layered background noise (rain, waves, wind, fire, and the three
 * noise colours) that plays UNDER the Neurospicy music rather than instead of it.
 *
 * This is an accessibility feature before it is a nice-to-have: masking noise is
 * how a lot of neurodivergent people hold focus, and mixing it with music is the
 * combination people actually want. So the rules here are deliberate - 
 *
 *   - Every layer has its OWN level, independent of the music volume. The layers
 *     connect straight to the context destination, bypassing the music gain.
 *   - Levels persist (profile, canonical; localStorage mirror for the pre-profile
 *     paint), so a set-up someone tuned once is still there tomorrow.
 *   - Nothing ever starts on its own. A persisted layer resumes only on the first
 *     user gesture (browsers require one anyway), and only for layers the user
 *     themselves left above zero.
 *   - The interface-sound mute is the master mute here too: mute means silence,
 *     with the levels kept for when it comes back.
 *
 * The beds are SYNTHESISED (lib/ambience-dsp.ts) - no audio files, so this works
 * offline on a cold install, adds nothing to the bundle, and carries no licence
 * that a user could breach by exporting a video. Buffers are baked lazily when a
 * layer is first raised and dropped when it returns to zero.
 */
import { AMBIENCE_SECONDS, type AmbienceKind } from './ambience-dsp.ts';
import { bakeAmbienceOffThread } from './ambience-render.ts';
import { neuroAudioContext } from './neurospicy.ts';
import { isSfxMuted } from './sfx.ts';

export type { AmbienceKind };

/** A row in the Atmosphere panel. `icon` is a lib/icons.ts registry name. */
export interface AtmosphereLayer { id: AmbienceKind; label: string; icon: string; group: AtmosphereGroup }

/** Fifteen rows is a list, not a row of tiles - three headings turn it back into
 *  something scannable. Same grouping idea as Blanket's, which is the vocabulary
 *  people arrive with. */
export type AtmosphereGroup = 'Outside' | 'Places' | 'Noise';
export const ATMOSPHERE_GROUPS: readonly AtmosphereGroup[] = ['Outside', 'Places', 'Noise'];

/** The rows, in display order. Scenes first (what most people reach for), the
 *  three noise colours last as the plain/clinical options. */
export const ATMOSPHERE_LAYERS: readonly AtmosphereLayer[] = [
  { id: 'rain', label: 'Rain', icon: 'cloudRain', group: 'Outside' },
  { id: 'thunder', label: 'Thunder', icon: 'cloudLightning', group: 'Outside' },
  { id: 'waves', label: 'Ocean waves', icon: 'waves', group: 'Outside' },
  { id: 'stream', label: 'Stream', icon: 'droplet', group: 'Outside' },
  { id: 'wind', label: 'Wind', icon: 'wind', group: 'Outside' },
  { id: 'birds', label: 'Birdsong', icon: 'bird', group: 'Outside' },
  { id: 'night', label: 'Crickets', icon: 'moon', group: 'Outside' },
  { id: 'chimes', label: 'Windchimes', icon: 'chimes', group: 'Outside' },
  { id: 'city', label: 'Busy street', icon: 'city', group: 'Places' },
  { id: 'train', label: 'Train', icon: 'train', group: 'Places' },
  { id: 'keyboard', label: 'Keyboard', icon: 'keyboard', group: 'Places' },
  { id: 'fire', label: 'Fireplace', icon: 'flame', group: 'Places' },
  { id: 'white', label: 'White noise', icon: 'noise', group: 'Noise' },
  { id: 'pink', label: 'Pink noise', icon: 'noise', group: 'Noise' },
  { id: 'brown', label: 'Brown noise', icon: 'noise', group: 'Noise' },
];

export type AtmosphereLevels = Partial<Record<AmbienceKind, number>>;
export interface AtmosphereState {
  /** Per-layer level 0–1. Absent or 0 = off. */
  levels: AtmosphereLevels;
  /** Whether the panel is expanded - a UI preference, but it belongs with the rest
   *  of the state so it survives a reload like everything else in the player. */
  open: boolean;
}

const KEY = 'lolly:atmosphere';
/** The level a layer comes back at when its icon is clicked and nothing is remembered. */
const DEFAULT_LEVEL = 0.35;
/** Fade time for starting, stopping and dragging a layer. Long enough that no
 *  change clicks, short enough that a slider still feels live. */
const FADE = 0.35;

let state: AtmosphereState = readInitial();
/** Per-layer memory of the last audible level, so the icon toggles back to where
 *  the user had it rather than to a default they never chose. Seeded from the
 *  persisted levels at boot. */
const lastAudible = new Map<AmbienceKind, number>();

function clamp01(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Layers renamed since a level was last stored. The bed built as café babble came
 *  out sounding like windchimes and was renamed to match; anyone who already had it
 *  turned up keeps their level rather than silently losing it. */
const RENAMED: Record<string, AmbienceKind> = { cafe: 'chimes' };

function sanitise(raw: unknown): AtmosphereState {
  const o = (raw ?? {}) as Partial<AtmosphereState>;
  const levels: AtmosphereLevels = {};
  const src = { ...(o.levels ?? {}) } as Record<string, unknown>;
  for (const [was, now] of Object.entries(RENAMED)) {
    if (Object.hasOwn(src, was) && !Object.hasOwn(src, now)) src[now] = src[was];
  }
  // Whitelisted by iterating OUR list, never the stored object's keys - a persisted
  // blob is untrusted input, and reading its keys is how prototype junk gets in.
  for (const l of ATMOSPHERE_LAYERS) {
    const v = clamp01(src[l.id]);
    if (v > 0) levels[l.id] = v;
  }
  return { levels, open: o.open === true };
}

function readInitial(): AtmosphereState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitise(JSON.parse(raw));
  } catch { /* private mode / bad JSON - defaults */ }
  return { levels: {}, open: false };
}

function persistLocal(): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* best-effort */ }
}

/** The host surface this module needs - just the profile, for the canonical copy. */
export interface AtmosphereHost { profile: { get(): Promise<object>; set(p: object): Promise<unknown> } }

async function persistProfile(host: AtmosphereHost | null): Promise<void> {
  if (!host) return;
  try { const p = await host.profile.get(); await host.profile.set({ ...p, atmosphere: { ...state } }); } catch { /* best-effort */ }
}

/** Reconcile from the profile (canonical) at boot; leaves the local mirror otherwise. */
export function hydrateAtmosphere(fromProfile: unknown): void {
  if (fromProfile && typeof fromProfile === 'object') {
    state = sanitise(fromProfile);
    persistLocal();
  }
  for (const [id, v] of Object.entries(state.levels)) lastAudible.set(id as AmbienceKind, v);
}

/** Demo override for the ?neuro deep-link (lib/neuro-demo.ts): set levels + the
 *  panel-open state IN MEMORY only - no persistLocal/persistProfile, and no
 *  startLayer, so nothing ever sounds. A dock built after this renders the
 *  Atmosphere section open at these levels. Levels are whitelisted through the
 *  same sanitise() the persisted blob goes through. */
export function demoAtmosphere(levels: AtmosphereLevels, opts: { open?: boolean } = {}): void {
  state = sanitise({ levels, open: opts.open ?? state.open });
}

export function getAtmosphere(): AtmosphereState { return { levels: { ...state.levels }, open: state.open }; }
export function atmosphereLevel(id: AmbienceKind): number { return state.levels[id] ?? 0; }
/** How many layers are currently turned up - the panel's collapsed-state badge. */
export function activeAtmosphereCount(): number { return Object.values(state.levels).filter((v) => v > 0).length; }
/** The level the icon toggle would restore for a layer that is currently off. */
export function rememberedLevel(id: AmbienceKind): number { return lastAudible.get(id) ?? DEFAULT_LEVEL; }

export function setAtmospherePanelOpen(open: boolean): void {
  state.open = open;
  persistLocal();
}

/** The player body can be mounted more than once at a time (the dock, the Sound
 *  popover, the visualizer's popout window), so a change made in one has to
 *  repaint the others. A DOM event, like the rest of the player's cross-instance
 *  signals - no lib↔component dependency. */
function notifyChanged(): void {
  if (typeof document !== 'undefined') document.dispatchEvent(new Event('lolly:atmosphere'));
}

// ── audio graph ──────────────────────────────────────────────────────────────
// One node pair per sounding layer, hung off the shared focus-audio context but
// connected to its destination directly (see neuroAudioContext's note).

interface Layer { src: AudioBufferSourceNode; gain: GainNode }
const playing = new Map<AmbienceKind, Layer>();
const buffers = new Map<AmbienceKind, AudioBuffer>();
/** In-flight bakes, so a slider dragged across zero can't start two sources. */
const baking = new Map<AmbienceKind, Promise<AudioBuffer | null>>();
let lastHost: AtmosphereHost | null = null;

/** Is ambience allowed to sound at all right now? (Master mute is the only gate - 
 *  the music transport's play/pause deliberately is NOT: pausing the music to
 *  think is exactly when someone wants the rain to keep going.) */
function allowed(): boolean { return !isSfxMuted(); }

async function ensureBuffer(ctx: AudioContext, id: AmbienceKind): Promise<AudioBuffer | null> {
  const have = buffers.get(id);
  if (have) return have;
  const inflight = baking.get(id);
  if (inflight) return inflight;
  const job = (async (): Promise<AudioBuffer | null> => {
    try {
      // Off the main thread: a bed is 50–500 ms of synthesis (the café murmur is the
      // worst), which would freeze the UI on the very click that turns it on. One-off
      // per layer per session - the buffer is cached until the layer goes back to zero.
      const chans = await bakeAmbienceOffThread(id, ctx.sampleRate);
      const buf = ctx.createBuffer(chans.length, chans[0]!.length, ctx.sampleRate);
      // The cast is the TS 5.7 typed-array generic, not a shape claim: bakeAmbience
      // always allocates plain ArrayBuffer-backed views, but a bare `Float32Array`
      // is `Float32Array<ArrayBufferLike>`, which copyToChannel won't take.
      for (let c = 0; c < chans.length; c++) buf.copyToChannel(chans[c]! as Float32Array<ArrayBuffer>, c);
      buffers.set(id, buf);
      return buf;
    } catch { return null; } finally { baking.delete(id); }
  })();
  baking.set(id, job);
  return job;
}

async function startLayer(id: AmbienceKind, level: number): Promise<void> {
  if (playing.has(id) || !allowed()) return;
  const ctx = neuroAudioContext();
  if (!ctx) return;
  // Claim the slot before the await: two rapid changes must not race into two sources.
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const src = ctx.createBufferSource();
  src.loop = true;
  playing.set(id, { src, gain });
  const buf = await ensureBuffer(ctx, id);
  // The layer may have been switched off (or muted) while the bake ran.
  if (!buf || playing.get(id)?.src !== src || !allowed() || !(state.levels[id]! > 0)) {
    if (playing.get(id)?.src === src) playing.delete(id);
    return;
  }
  src.buffer = buf;
  src.connect(gain);
  gain.connect(ctx.destination);
  // A random start offset means two people (or two layers) never hear the same
  // swell at the same moment, and a restart doesn't replay the same opening.
  src.start(0, Math.random() * AMBIENCE_SECONDS[id]);
  gain.gain.setTargetAtTime(level, ctx.currentTime, FADE / 3);
}

/** Fade a layer out and release it (and, unless `keepBuffer`, its PCM). */
function stopLayer(id: AmbienceKind, keepBuffer = false): void {
  const layer = playing.get(id);
  playing.delete(id);
  if (!keepBuffer) buffers.delete(id);
  if (!layer) return;
  const ctx = neuroAudioContext();
  const { src, gain } = layer;
  if (!ctx) { try { src.stop(); } catch { /* never started */ } src.disconnect(); gain.disconnect(); return; }
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setTargetAtTime(0, ctx.currentTime, FADE / 3);
  const at = ctx.currentTime + FADE * 2;
  try { src.stop(at); } catch { /* not started yet - the guard in startLayer drops it */ }
  src.onended = (): void => { src.disconnect(); gain.disconnect(); };
}

/**
 * Set a layer's level (0 turns it off). The single entry point the UI uses for
 * both the slider and the icon toggle, so the two can never disagree.
 */
export function setAtmosphereLevel(host: AtmosphereHost | null, id: AmbienceKind, level: number): void {
  lastHost = host ?? lastHost;
  const v = clamp01(level);
  if (v > 0) { state.levels[id] = v; lastAudible.set(id, v); } else { delete state.levels[id]; }
  persistLocal();
  void persistProfile(lastHost);
  notifyChanged();
  if (v <= 0) { stopLayer(id); return; }
  const layer = playing.get(id);
  if (!layer) { void startLayer(id, v); return; }
  const ctx = neuroAudioContext();
  if (ctx) layer.gain.gain.setTargetAtTime(v, ctx.currentTime, FADE / 4);
}

/** Turn a layer off/on from its icon - back to the level it last had. Returns the new level. */
export function toggleAtmosphereLayer(host: AtmosphereHost | null, id: AmbienceKind): number {
  const on = atmosphereLevel(id) > 0;
  const next = on ? 0 : rememberedLevel(id);
  setAtmosphereLevel(host, id, next);
  return next;
}

/**
 * Re-evaluate every layer against the master mute - the mirror of applyNeurospicy,
 * called from the same place (applySfxMuted). Muting stops the sources but keeps
 * the levels; un-muting brings back exactly what was sounding.
 */
export function applyAtmosphere(host?: AtmosphereHost): void {
  lastHost = host ?? lastHost;
  if (!allowed()) { for (const id of [...playing.keys()]) stopLayer(id, true); return; }
  for (const l of ATMOSPHERE_LAYERS) {
    const v = state.levels[l.id] ?? 0;
    if (v > 0 && !playing.has(l.id)) void startLayer(l.id, v);
  }
}

/** Stop everything now, keeping the saved levels - used when Neurospicy Mode is
 *  switched off (its player is the only place these controls live, so ambience
 *  must not outlive it) and when the feature flag goes away. */
export function stopAtmosphere(): void {
  for (const id of [...playing.keys()]) stopLayer(id);
}

/** Is any layer actually sounding? */
export function isAtmospherePlaying(): boolean { return playing.size > 0; }

/**
 * Autoplay policy: audio can't start before a gesture, so a persisted set-up is
 * armed rather than started. Only layers the user left above zero come back, and
 * only once - this is a resume, never an introduction.
 */
export function armAtmosphere(host: AtmosphereHost): void {
  lastHost = host;
  if (!activeAtmosphereCount() || typeof document === 'undefined') return;
  const go = (): void => {
    document.removeEventListener('pointerdown', go, true);
    document.removeEventListener('keydown', go, true);
    applyAtmosphere(host);
  };
  document.addEventListener('pointerdown', go, { capture: true, passive: true });
  document.addEventListener('keydown', go, { capture: true, passive: true });
}

// Neurospicy Mode going off takes the ambience with it. Wired as a DOM event
// (the same one the player's toggles repaint on) rather than a call from
// neurospicy.ts, which would make the two modules import each other.
if (typeof document !== 'undefined') {
  document.addEventListener('lolly:neuro-enabled', () => {
    void import('./neurospicy.ts').then((m) => { if (!m.getNeurospicy().enabled) stopAtmosphere(); });
  });
}
