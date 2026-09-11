// SPDX-License-Identifier: MPL-2.0
/**
 * sfx - a tiny, dependency-free UI sound layer for the web shell.
 *
 * This is host CHROME, not part of a render path, so it lives in the shell (never
 * the engine - the engine is DOM/platform-free). It plays short, tasteful cues for
 * interface actions in the Projects view: pressing an option button, picking up /
 * dropping a card, and deleting a session or asset.
 *
 * Sound source: the cues are SYNTHESISED on the fly with the Web Audio API - a few
 * oscillator + gain envelopes per voice. That means zero shipped assets, zero bytes
 * to sync, works offline, and - importantly for this repo's licensing split - zero
 * new licence obligations (nothing to attribute, nothing copyleft).
 *
 * Swapping in recorded samples later: if you'd rather use recorded clips, Kenney's
 * "Interface Sounds" / "UI Audio" packs are CC0 (public domain - https://kenney.nl).
 * Drop the WAVs under an assets folder, decode each once into an AudioBuffer, and
 * replace the VOICES table in ./sfx-voices.ts with `bufferSource` playback keyed by
 * SfxName. The public API (playSfx / mute) stays identical, so no call site changes.
 *
 * Module split: this file owns mute/volume state, dispatch and the app-wide cue
 * delegation; the SYNTHESIS (tone primitives + the VOICES / THEME_VOICES tables + the
 * per-view arrival renderers) lives in ./sfx-voices.ts, dynamic-imported OFF the boot
 * path and warmed at installGlobalSfx() - audio is gesture-gated, never first paint.
 *
 * Playback rules baked in:
 *  - Gesture-gated: the AudioContext is created lazily on the first playSfx() call,
 *    which always originates inside a user gesture (click / dragstart / drop), so
 *    browser autoplay policy is satisfied. resume() is called defensively.
 *  - Mute-aware: an in-memory flag (mirrored to localStorage synchronously, so it's
 *    known before the profile loads) short-circuits playback. The profile is the
 *    canonical store - see hydrateSfxMuted() - mirroring how the theme persists.
 *  - Default: interface sounds are OFF for new users (no stored preference yet);
 *    an explicit stored preference - localStorage mirror or the profile - always
 *    wins, so anyone who has turned sound on keeps it. (Reduced-motion is about
 *    MOTION, not audio, so it is not what silences sounds here.)
 */

export type SfxName = 'click' | 'pickup' | 'drop' | 'delete' | 'toggle' | 'navigate' | 'shutter' | 'shuffle' | 'coverflow' | 'gallery' | 'save' | 'saveProfile' | 'whoosh' | 'vacuum' | 'fanfare' | 'twinkle' | 'shimmer' | 'ding' | 'victory' | 'braaam' | 'sign' | 'warn' | 'ghost' | 'shoo' | 'reel' | 'aperture' | 'scribble' | 'waveform' | 'flick' | 'optIn' | 'optOut' | 'byebye' | 'key' | 'slider' | 'scrub' | 'select' | 'hydraulicOpen' | 'hydraulicClose' | 'verify' | 'dashboard' | 'newSession' | 'leaveSession' | 'whisper' | 'crystal' | 'land';

/** localStorage mirror of the mute flag ('1' muted / '0' on). Canonical store is the profile. */
const MUTE_KEY = 'lolly:sfxMuted';

// ── mute state ───────────────────────────────────────────────────────────────

let muted = readInitialMuted();

function readInitialMuted(): boolean {
  try {
    const stored = localStorage.getItem(MUTE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch { /* private mode / no storage - fall through to the default */ }
  return true; // no explicit preference yet → interface sounds OFF by default for new users
}

export function isSfxMuted(): boolean {
  return muted;
}

/** Set + persist (localStorage mirror only) the mute flag. Profile write is the caller's job. */
export function setSfxMuted(next: boolean): void {
  muted = next;
  try { localStorage.setItem(MUTE_KEY, next ? '1' : '0'); } catch { /* best-effort */ }
}

/**
 * Reconcile from the profile (canonical) once it has loaded at boot. Only adopts an
 * explicit boolean; leaves the localStorage-derived value in place otherwise. Also
 * writes the value back through the localStorage mirror so the two stay in sync.
 */
export function hydrateSfxMuted(profileMuted: boolean | undefined): void {
  if (typeof profileMuted !== 'boolean') return;
  setSfxMuted(profileMuted);
}

// ── volume (0–1, how loud interface cues are - separate from the on/off mute) ────
/** Base headroom so overlapping cues don't clip; the user's volume (0–1) scales it. */
const SFX_HEADROOM = 0.26;
const VOLUME_KEY = 'lolly:sfxVolume';
let sfxVolume = readInitialVolume();

function readInitialVolume(): number {
  try {
    const s = localStorage.getItem(VOLUME_KEY);
    if (s !== null) { const v = parseFloat(s); if (Number.isFinite(v)) return Math.max(0, Math.min(1, v)); }
  } catch { /* no storage - full by default */ }
  return 1;
}

export function getSfxVolume(): number { return sfxVolume; }

/** Set + persist (localStorage mirror) the interface-sound volume; applies live to the
 *  master gain. Profile write is the caller's job (mirrors setSfxMuted). */
export function setSfxVolume(v: number): void {
  sfxVolume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem(VOLUME_KEY, String(sfxVolume)); } catch { /* best-effort */ }
  if (master) master.gain.value = SFX_HEADROOM * sfxVolume;
}

/** Reconcile from the profile (canonical) at boot, like hydrateSfxMuted. */
export function hydrateSfxVolume(profileVolume: number | undefined): void {
  if (typeof profileVolume === 'number' && Number.isFinite(profileVolume)) setSfxVolume(profileVolume);
}

// ── audio graph (lazy, shared) ─────────────────────────────────────────────────

type WindowWithWebkitAudio = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

/** Lazily build (and resume) the shared context + master gain. Returns null where unavailable. */
function audio(): { ctx: AudioContext; master: GainNode } | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = SFX_HEADROOM * sfxVolume; // headroom scaled by the user's interface-sound volume
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => { /* stays suspended until the next gesture */ });
  return { ctx, master: master! };
}

// ── lazy voice bank ──────────────────────────────────────────────────────────
// The synthesis (tone primitives + the VOICES / THEME_VOICES tables + the arrival
// renderers) lives in ./sfx-voices.ts, dynamic-imported OFF the boot path - it is
// gesture-gated audio, never needed for first paint. installGlobalSfx() warms it at
// boot, so by the first user gesture it is loaded and the dispatch below takes its sync
// path. A cue / theme cue / arrival fired in the sub-second window before it resolves is
// buffered (one slot each) and flushed on load, so nothing is silently dropped.
let voicesMod: typeof import('./sfx-voices.ts') | null = null;
let voicesLoading: Promise<typeof import('./sfx-voices.ts')> | null = null;
let pendingCue: SfxName | null = null;
let pendingTheme: string | null = null;

function ensureVoices(): Promise<typeof import('./sfx-voices.ts')> {
  return (voicesLoading ??= import('./sfx-voices.ts').then((m) => { voicesMod = m; flushPending(); return m; }));
}
// Play any cue/theme buffered before the voice bank loaded. Early-returns when there is
// nothing pending, so the boot-time warm never creates the AudioContext ahead of a gesture.
function flushPending(): void {
  const m = voicesMod;
  if (!m || (!pendingCue && !pendingTheme)) return;
  if (!muted) {
    const a = audio();
    if (a) {
      try { if (pendingCue) m.VOICES[pendingCue]?.(a.ctx, a.master); } catch { /* best-effort */ }
      try { if (pendingTheme) (m.THEME_VOICES[pendingTheme] ?? m.THEME_VOICES.light)?.(a.ctx, a.master); } catch { /* best-effort */ }
    }
  }
  pendingCue = null;
  pendingTheme = null;
}

/** Play a named interface cue. No-op when muted, when audio is unavailable, or on error. */
export function playSfx(name: SfxName): void {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const m = voicesMod;
  if (m) { try { m.VOICES[name]?.(a.ctx, a.master); } catch { /* audio is best-effort, never throws into the UI */ } return; }
  pendingCue = name;   // pre-warm window - flushed when the boot-warmed import resolves
  void ensureVoices();
}

// Rate-limited detent ticks for DRAGGING a continuous control. The caller fires one per
// value step (so a slow drag ticks each step, like a ratchet); the cap here keeps a fast
// drag from machine-gunning into a solid tone. Global - only one control is dragged at a
// time. Used both by native <input type=range> (below) and by the tool view's CUSTOM
// slider + Figma-style number scrubs, which aren't range inputs so the global input
// listener never sees them.
let _lastSliderTick = 0;
export function playSliderTick(): void {
  const now = nowMs();
  if (now - _lastSliderTick < 40) return; // ≤ ~25 ticks/sec
  _lastSliderTick = now;
  playSfx('slider');
}
let _lastScrubTick = 0;
export function playScrubTick(): void {
  const now = nowMs();
  if (now - _lastScrubTick < 32) return; // a hair faster than the slider - the scrub is finer
  _lastScrubTick = now;
  playSfx('scrub');
}

// Speak a control's NAME in a robot voice - build-time clips at /voice/<slug>.mp3 (see
// scripts/build-voice-clips.ts). Lazy-loaded + cached per slug; respects the sound mute.
// A control opts in with `data-voice="<label>"`, spoken by the global click delegation.
const voiceCache = new Map<string, HTMLAudioElement>();
export function playVoice(text: string): void {
  if (muted || typeof Audio === 'undefined') return;
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) return;
  let a = voiceCache.get(slug);
  if (!a) { a = new Audio(`/voice/${slug}.mp3`); a.volume = 0.6; a.preload = 'auto'; voiceCache.set(slug, a); }
  try { a.currentTime = 0; void a.play().catch(() => { /* autoplay-gated or clip missing */ }); } catch { /* best-effort */ }
}

/**
 * Play the magical theme-change chime for `theme` ('light' | 'dark' | 'brand' | …).
 * A longer, shimmering cue that differs per theme; falls back to the light chime for
 * an unknown theme. Same mute / availability / never-throw guarantees as playSfx.
 * Call ONLY at user-initiated switches (not applyTheme, which also runs at boot).
 */
export function playThemeSfx(theme: string): void {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const m = voicesMod;
  if (m) { try { (m.THEME_VOICES[theme] ?? m.THEME_VOICES.light)?.(a.ctx, a.master); } catch { /* best-effort */ } return; }
  pendingTheme = theme;
  void ensureVoices();
}

type ArrivalRender = (ctx: AudioContext, out: AudioNode) => void;
let pendingArrival: ArrivalRender | null = null; // an arrival hit waiting for the first gesture
let arrivalArmed = false;                         // a one-shot gesture listener is pending (autoplay-gated)

/** Play an arrival cue (a view landing) - now if audio is live, else on the first gesture. */
function scheduleArrival(render: ArrivalRender): void {
  if (muted) return;
  const a = audio();
  if (!a) return;
  if (a.ctx.state === 'running') { try { render(a.ctx, a.master); } catch { /* best-effort */ } return; }
  pendingArrival = render;
  armArrival(); // autoplay-gated - play once on the first gesture, if the view is still up
}

// The arrival renderers live in the lazy voice bank, so an arrival first loads it (usually
// already warm), then schedules through the existing gesture-gated path. `arrivalToken`
// invalidates an in-flight lazy arrival if the view is left (cancelArrivalAah) or another
// arrival supersedes it before the import resolves - so a late .then can't fire on the
// wrong page.
let arrivalToken = 0;
function scheduleArrivalLazy(pick: (m: typeof import('./sfx-voices.ts')) => ArrivalRender): void {
  if (muted) return;
  const token = ++arrivalToken;
  if (voicesMod) { scheduleArrival(pick(voicesMod)); return; }
  void ensureVoices().then((m) => { if (token === arrivalToken) scheduleArrival(pick(m)); });
}

/** The gallery's arrival - faint, high fairy bells (a sparkly "ding-a-ring-ding"). */
export function playGalleryAah(): void { scheduleArrivalLazy((m) => m.renderGalleryBell); }
/** The catalog's arrival - a deep harbour foghorn with books stacking over its sustain. */
export function playCatalogAah(): void { scheduleArrivalLazy((m) => m.renderCatalogHorn); }
/** The projects tab's arrival - the stacking clicks, then a soft quick puff of wind. */
export function playProjectsAah(): void { scheduleArrivalLazy((m) => m.renderProjectsWind); }
/** Cancel a pending arrival hit - call on leaving a view so it can't fire on another page. */
export function cancelArrivalAah(): void { pendingArrival = null; arrivalToken++; }

function armArrival(): void {
  if (arrivalArmed || typeof document === 'undefined') return;
  arrivalArmed = true;
  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  const go = (): void => {
    for (const ev of events) document.removeEventListener(ev, go, true);
    arrivalArmed = false;
    const render = pendingArrival;
    pendingArrival = null;
    if (!render) return; // navigated away before the first gesture
    const a = audio();
    if (a && !muted) { try { render(a.ctx, a.master); } catch { /* best-effort */ } }
  };
  for (const ev of events) document.addEventListener(ev, go, { passive: true, capture: true });
}

// ── app-wide delegation ─────────────────────────────────────────────────────────
// One set of document-level listeners drives cues for the WHOLE app, so a view never
// has to wire sounds itself. A control opts into a richer cue with `data-sfx="<name>"`;
// the shared destructive-confirm button plays "delete"; everything else clicks.

/** Button-like controls that should tick on click. Plain text / range inputs stay quiet. */
const INTERACTIVE_SEL =
  'button, [role="button"], a.btn, .btn, summary, label.switch, ' +
  'input[type="checkbox"], input[type="radio"], select, [data-sfx]';

function isSfxName(v: string | undefined): v is SfxName {
  return v === 'click' || v === 'pickup' || v === 'drop' || v === 'delete' || v === 'toggle'
    || v === 'navigate' || v === 'shutter' || v === 'shuffle' || v === 'coverflow' || v === 'gallery'
    || v === 'save' || v === 'saveProfile' || v === 'whoosh' || v === 'vacuum' || v === 'fanfare'
    || v === 'twinkle' || v === 'shimmer' || v === 'ding' || v === 'victory' || v === 'braaam' || v === 'warn' || v === 'ghost'
    || v === 'shoo' || v === 'reel' || v === 'aperture' || v === 'scribble' || v === 'waveform' || v === 'flick'
    || v === 'optIn' || v === 'optOut' || v === 'byebye' || v === 'key' || v === 'slider' || v === 'scrub'
    || v === 'select' || v === 'hydraulicOpen' || v === 'hydraulicClose' || v === 'verify' || v === 'dashboard' || v === 'newSession' || v === 'leaveSession'
    || v === 'whisper' || v === 'crystal' || v === 'land';
}

/** Decide which cue a clicked control should make. */
function cueForTarget(el: Element): SfxName {
  const tagged = el.closest<HTMLElement>('[data-sfx]');
  if (tagged && isSfxName(tagged.dataset.sfx)) return tagged.dataset.sfx as SfxName;
  // The shared confirm dialog's destructive button (confirm-dialog.ts, danger:true) - 
  // fires the "gone" cue at the moment of confirmation, everywhere it's used.
  if (el.closest('.modal-danger')) return 'delete';
  return 'click';
}

let installed = false;

/**
 * Install the app-wide interface-sound cues. Idempotent; call once at boot. Listeners
 * are CAPTURE-phase so they run before a view's own handler can stopPropagation or remove
 * the node (e.g. the confirm dialog closing itself) - the clicked control is still live.
 */
export function installGlobalSfx(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const el = t.closest<HTMLElement>(INTERACTIVE_SEL);
    if (!el) return;
    if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return;
    playSfx(cueForTarget(el));
    const voiced = el.closest<HTMLElement>('[data-voice]');
    if (voiced?.dataset.voice) playVoice(voiced.dataset.voice); // robot voice speaks the name
  }, true);

  // HTML5 drag-and-drop, app-wide: a card / asset lifts out, then lands.
  document.addEventListener('dragstart', (e) => {
    const t = e.target;
    if (t instanceof Element && t.closest('[draggable="true"]')) playSfx('pickup');
  }, true);
  document.addEventListener('drop', () => { playSfx('drop'); }, true);

  // Typing - a soft keyboard clack per keystroke in a text-editable field. Skips auto-
  // repeat (a held key), pure modifier presses, and any keystroke carrying a Ctrl/Meta
  // shortcut, so it tracks actual typing and never machine-guns.
  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || MODIFIER_KEYS.has(e.key)) return;
    if (isTextEditable(e.target)) playSfx('key');
  }, true);

  // Slider drag - a detent tick as a native range input's value changes (the tool view's
  // custom slider / scrub fields tick themselves via playSliderTick / playScrubTick, since
  // they aren't <input type=range> and never fire a native 'input' here).
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === 'range') playSliderTick();
  }, true);

  // Select - a soft detent when the chosen option actually changes.
  document.addEventListener('change', (e) => {
    if (e.target instanceof HTMLSelectElement) playSfx('select');
  }, true);

  // Any native <dialog> modal dismissing - a quick "shoo". The close event doesn't
  // bubble, so (like the others) catch it in the capture phase. Fires on a button
  // close, Esc/cancel, or a form method="dialog", covering the share/confirm dialogs,
  // the catalog download dialog, the headshot cropper, etc. with no per-site wiring.
  // A dialog can opt OUT (dataset.sfxClose === 'off') to own its own dismiss cue - 
  // e.g. the unsaved-changes dialog plays 'land' on Cancel instead of a generic shoo.
  document.addEventListener('close', (e) => {
    if (e.target instanceof HTMLDialogElement && e.target.dataset.sfxClose !== 'off') playSfx('shoo');
  }, true);

  // Warm the lazy voice bank now - promptly (this runs at boot) but OFF the critical
  // preload set - so the synthesis is loaded well before the first user gesture and every
  // cue takes playSfx's synchronous path. flushPending() is a no-op here (nothing buffered
  // yet, and it won't create the AudioContext before a gesture).
  void ensureVoices();
}

/** Keys that are held/pressed without "typing" a character - no keyboard clack for these. */
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'Dead', 'Tab']);

// input types that aren't text entry (their own cue or none), PLUS password - a per-key
// clack there would audibly betray the password's length to anyone nearby. No clack.
const NON_TEXT_INPUT = new Set(['range', 'checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image', 'password']);

/** True when a keystroke on this target is genuine text entry (text-like input / textarea / contenteditable). */
function isTextEditable(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT.has(target.type);
  return target instanceof HTMLElement && target.isContentEditable;
}

/** Monotonic-ish millisecond clock for rate-limiting (shell code - performance/Date are fine). */
function nowMs(): number {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}
