// SPDX-License-Identifier: MPL-2.0
// The two contracts at the heart of @lolly-tools/audio-dock.
//
// The dock is ONE UI shell that two different hosts drive: the Lolly web app
// (music / internet radio / atmosphere soundbeds, via neurospicy.ts) and the
// static /info docs site (page narration, via docs/player/player.ts). The shell
// owns none of the audio. It renders controls and delegates every action to a
// `DockHost` the host implements. `DockCapabilities` is what the APP declares
// CAN appear; the user drives collapse size + which sections are open.
//
// Designed against the real player APIs (neurospicy.ts / music-player.ts /
// docs/player/player.ts). Everything beyond bare transport is optional per
// capability, so a narration-only host and a music-only host both satisfy it.

/**
 * What the host declares the dock is ALLOWED to show. Orthogonal to collapse and
 * to which sections the user has open. This is the app's policy, not the user's.
 * All flags default to absent/false, so an empty object is a transport-only dock.
 */
export interface DockCapabilities {
  /** Page narration: caption/preview, follow-along, speed, the AI disclosure. */
  narration?: boolean;
  /** A music track/source picker (now-playing + a grouped list). */
  music?: boolean;
  /** Internet-radio stations, shown as a group inside the same picker. */
  radio?: boolean;
  /** The soundbeds/ambience layer mixer. */
  atmosphere?: boolean;
  /** Animate the backdrop canvas from the host's analyser / frame amplitudes. */
  viz?: boolean;
}

/** The kind of thing currently sounding. Drives the now-playing label and the
 *  picker grouping (radio is a music source of a distinct kind). */
export type DockSourceKind = 'narration' | 'music' | 'radio' | 'atmosphere';

/** What the now-playing line shows. `subtitle`/`kind` are optional; a
 *  narration host may give just a page title. */
export interface DockNowPlaying {
  title: string;
  /** A secondary line: station vibe, mood chip text, "AI narration", etc. */
  subtitle?: string;
  kind?: DockSourceKind;
}

/** One row in the music/radio picker. `group` is the section heading (the app's
 *  own vocabulary, e.g. Catalog / Uploads / Internet Radio); `kind: 'radio'`
 *  marks a station so the radio capability can gate its group. */
export interface DockSource {
  id: string;
  title: string;
  kind?: DockSourceKind;
  /** The picker section this row belongs under; rows with no group share one. */
  group?: string;
  /** A short mood/genre chip ("ambient", "lo-fi", "spy jazz"). */
  mood?: string;
  /** Rendered but non-selectable (e.g. a station that is offline right now). */
  unavailable?: boolean;
}

/** A required-credit line for a source provider (e.g. SomaFM asks that its
 *  attribution + support link stay visible wherever its stations play). Rendered
 *  by the shell as one small line: `text`, then a single anchor (`linkText` →
 *  `href`, opened in a new tab). Optional; a provider with no credit obligation
 *  returns null. */
export interface DockAttribution { text: string; href: string; linkText: string }

/** The music/radio adapter. Present only for a host that offers a picker.
 *  Narration hosts omit it entirely (they page with prev/next, not a dropdown). */
export interface DockSources {
  /** The rows, in the host's canonical order (the SAME order prev/next walk). */
  list(): DockSource[] | Promise<DockSource[]>;
  /** Switch to a source by id (persists + plays, host's business). */
  select(id: string): void | Promise<void>;
  /** The id of the current selection, for the highlighted row. */
  currentId(): string;
  /** Subscribe to list changes (an upload arrived, radio came online). Returns
   *  an unsubscribe. Optional; a fixed list never calls it. */
  onListChange?(listener: () => void): () => void;
  /** When true the shell renders a type-to-filter box over the list (a long
   *  music library wants search). Absent/false ⇒ no box. Additive; a fixed
   *  narration-style list omits it. */
  searchable?: boolean;
  /** A provider credit to keep visible (see {@link DockAttribution}). Returns null
   *  when nothing is owed right now (e.g. no radio group in the list). Optional. */
  attribution?(): DockAttribution | null;
}

/** A labelled volume slider the shell renders (a music host exposes Music + the
 *  interface-sound Effects level; narration omits it and no slider appears). Levels
 *  are 0..1. `set` fires live on drag; `commit` (optional) fires on release, for a
 *  host that persists only on release rather than on every input. */
export interface DockVolume {
  id: string;
  label: string;
  get(): number;
  set(v: number): void;
  commit?(v: number): void;
}

/** Repeat/loop-mode for a music host (neurospicy's repeat ⇄ play-through toggle).
 *  The contract carries no such notion for narration, so this is optional and the
 *  shell renders the toggle only for a host that provides it. */
export interface DockRepeat {
  /** true = loop the current track forever; false = advance through the list. */
  get(): boolean;
  /** Flip the mode (the host persists + re-arms the live source). */
  set(repeat: boolean): void;
}

/** One soundbed/ambience layer. `icon` is optional inline SVG markup (or plain text)
 *  the shell renders beside the slider. The shell ships no icon registry, so the host
 *  supplies the finished glyph and the shell inserts it as-is (trusted, first-party
 *  host). Absent/'' ⇒ no glyph, just the label. */
export interface DockAtmosphereLayer {
  id: string;
  label: string;
  /** A section heading to group rows under (Outside / Places / Noise). */
  group?: string;
  /** Inline SVG markup (or text) rendered as the per-layer icon. */
  icon?: string;
}

/** The atmosphere mixer adapter. Levels are 0..1; the slider IS the enable
 *  (dragging up from zero starts a bed, back to zero stops it), matching both
 *  players. `master` is optional; the docs player has one, neurospicy does not. */
export interface DockAtmosphere {
  layers(): DockAtmosphereLayer[];
  /** The display groups in order, if the host groups its layers. */
  groups?(): readonly string[];
  getLevel(id: string): number;
  setLevel(id: string, level: number): void;
  /** Optional overall ambience level (docs player only). */
  getMaster?(): number;
  setMaster?(level: number): void;
}

/** One entry in the visualiser section's preset picker (a MilkDrop/Butterchurn
 *  preset). `group` is an optional heading (author / pack). */
export interface DockVizPreset {
  id: string;
  name: string;
  group?: string;
}

/** One colour scheme / theme the visualiser can recolour to (a brand-tinted palette). */
export interface DockVizTheme {
  id: string;
  name: string;
}

/** One preset-transition timing option (how often / how the visualiser moves between
 *  presets, e.g. Off / 8s / 15s / 30s auto-cycle). */
export interface DockVizTransition {
  id: string;
  name: string;
}

/**
 * The visualiser adapter. TWO tiers, both driven from the shell's ONE canvas:
 *
 *   - The BUILT-IN backdrop. With just `supported()` + a signal source
 *     (`getAnalyser`/`subscribeFrames`) the shell draws its own simple 2D
 *     frequency/amplitude backdrop. That is all a narration host provides.
 *   - A HOST-RENDERED visualiser. A music host additionally supplies `mount`/
 *     `unmount` (its butterchurn/MilkDrop renderer) plus the preset + theme
 *     controls. The shell keeps butterchurn OUT of its own bundle (so the static
 *     /info build never pulls it in). The host owns the renderer and the shell
 *     only hands it a canvas and draws the section UI + drag/resize/fullscreen
 *     chrome around it.
 *
 * Everything past `supported`/`getAnalyser`/`subscribeFrames` is optional and
 * additive: a host that provides none still gets the built-in backdrop.
 */
export interface DockViz {
  /** WebGL2 / hardware probe. When false the shell shows the static ground and
   *  never starts the rAF loop (matches viz-support.ts `vizSupported`). */
  supported(): boolean;
  /** The live analyser both players already expose. Null until audio starts.
   *  Feeds the built-in 2D backdrop when no host renderer is supplied. */
  getAnalyser?(): AnalyserNode | null;
  /** Fallback signal when there is no analyser: a per-frame amplitude in 0..1.
   *  Returns an unsubscribe. The shell prefers the analyser when both exist. */
  subscribeFrames?(listener: (amplitude: number) => void): () => void;

  // ── host-rendered visualiser (butterchurn etc.): all optional/additive ──
  /** Whether the visualiser is switched on. A user pref the host persists; the
   *  shell's on/off toggle in the visualiser section flips it. Absent ⇒ always on. */
  enabled?(): boolean;
  setEnabled?(on: boolean): void;
  /**
   * Attach the host's renderer to `canvas` and start drawing. The shell hands it
   * ONE persistent canvas, reused across the backdrop / expanded window / fullscreen
   * (the shell only repositions + resizes it). MUST be safe to call repeatedly: a
   * call re-mounts a loop that stood itself down (a collapsed dock stops laying the
   * canvas out) and is a no-op when already running on the same canvas. When absent
   * the shell draws its own 2D backdrop instead.
   */
  mount?(canvas: HTMLCanvasElement): void | Promise<void>;
  /** Stop rendering and release the renderer (WebGL context + audio tap). */
  unmount?(): void;
  /** Re-measure the canvas and resize the renderer's backing store to the displayed
   *  CSS size × devicePixelRatio, so an enlarged / fullscreen / resized window renders
   *  crisply instead of upscaling a small buffer. The shell drives this from a
   *  ResizeObserver on the canvas (debounced to an animation frame). */
  resize?(): void;
  /** The preset library, for the visualiser section's picker. May be async (the
   *  artist pack is fetched lazily). */
  presets?(): DockVizPreset[] | Promise<DockVizPreset[]>;
  currentPreset?(): string;
  selectPreset?(id: string): void;
  /** The colour schemes/themes (brand-tinted palettes), for the settings menu. */
  themes?(): DockVizTheme[] | Promise<DockVizTheme[]>;
  currentTheme?(): string;
  selectTheme?(id: string): void;
  /** The preset-transition timing options (auto-cycle interval), for the settings menu. */
  transitions?(): DockVizTransition[] | Promise<DockVizTransition[]>;
  currentTransition?(): string;
  selectTransition?(id: string): void;
}

/**
 * A self-contained narration mini-player, rendered as its OWN block in the dock ABOVE the
 * music player, so page voice and music can sound AT THE SAME TIME (voice over an optional
 * bed) in the one unified window. It is a SUBSET of {@link DockHost} (its own transport,
 * now-playing, and change subscription) plus the required {@link DockNarration} adapter, so
 * a narration host already satisfies it verbatim. Optional + additive: a host with no
 * `narrationBlock` renders no narration block, and a music-only / static host is byte-
 * identical to before.
 */
export interface DockNarrationPlayer {
  isPlaying(): boolean;
  togglePlay(): void | Promise<void>;
  currentTime?(): number;
  duration?(): number;
  seekable?(): boolean;
  seek?(seconds: number): void;
  nowPlaying(): DockNowPlaying;
  onChange(listener: () => void): () => void;
  narration: DockNarration;
}

/** Narration extras. Present only for a docs-style host. Everything here is
 *  narration-specific (the music side has no speed or follow-along). */
export interface DockNarration {
  /** Follow-along (auto-scroll to the narrated block) on/off. */
  getFollow(): boolean;
  setFollow(on: boolean): void;
  /** The current playback rate, and the discrete rates the control offers. */
  getSpeed(): number;
  setSpeed(rate: number): void;
  speeds(): readonly number[];
  /** The live caption/cue text for the current block, if any. */
  caption?(): string;
  /** The always-visible AI-disclosure line (EU AI Act Art. 50). */
  disclosure?(): string;
}

/**
 * The adapter each host implements so ONE dock drives both players. A plain
 * interface of getters + callbacks; no app types leak in. Bare transport +
 * now-playing + a change subscription are required; every capability surface is
 * optional, so narration-only and music-only hosts both satisfy this.
 */
export interface DockHost {
  // ── transport (required) ──────────────────────────────────────────────────
  /** Is audio actually sounding right now (not paused, not muted)? */
  isPlaying(): boolean;
  /** Play/pause toggle. Drives the main and mini play buttons. */
  togglePlay(): void | Promise<void>;
  /** Step to the next source/page. Omit for a host with no stepping; the shell
   *  then hides the next button. */
  next?(): void | Promise<void>;
  prev?(): void | Promise<void>;
  /** Whether stepping is possible from here. A paged narration host disables at
   *  the ends; a wrapping music host returns true. Absent ⇒ treated as true. */
  canNext?(): boolean;
  canPrev?(): boolean;
  /** Current position / total, in seconds. `duration` may be 0 or non-finite for
   *  a live stream, the shell hides the scrub then (see `seekable`). */
  currentTime?(): number;
  duration?(): number;
  /** Whether the current source can be seeked (false for radio / live streams). */
  seekable?(): boolean;
  seek?(seconds: number): void;
  /** Subscribe to any state change (play/pause, position, track, caption) so the
   *  shell re-renders. Returns an unsubscribe. This is the one required callback. */
  onChange(listener: () => void): () => void;

  // ── now-playing (required) ────────────────────────────────────────────────
  nowPlaying(): DockNowPlaying;

  // ── capability adapters (optional; presence is gated by DockCapabilities) ──
  narration?: DockNarration;
  sources?: DockSources;
  atmosphere?: DockAtmosphere;
  viz?: DockViz;
  /** Repeat/loop-mode toggle for a music host (see {@link DockRepeat}). Rendered in
   *  the transport when present and the music capability is on. Optional. */
  repeat?: DockRepeat;
  /** Volume sliders (Music, interface Effects, …) for a music host. Rendered as a
   *  small block below the transport when present. Optional; narration omits it. */
  volumes?: DockVolume[];
  /** A SECOND, self-contained narration player rendered as its own block above the main
   *  (music) player, so the unified dock can carry BOTH page voice and music at once.
   *  Absent ⇒ no narration block. Additive/optional; see {@link DockNarrationPlayer}. */
  narrationBlock?: DockNarrationPlayer;
}

/**
 * The dock sizes.
 *   - `mini`     the compact now-playing pill (no viz-expand affordance).
 *   - `compact`  narration's trimmed body (music treats compact == full).
 *   - `full`     the anchored bottom-right dock.
 *   - `expanded` a free-floating window: draggable AND resizable, the visualiser
 *                large behind the docked controls. The state you land in when you
 *                leave fullscreen. Every state but `mini` is draggable.
 */
export type DockCollapse = 'full' | 'compact' | 'mini' | 'expanded';

/** The capability-gated, user-openable panels. (The visualiser has no section; its
 *  settings live in a right-click menu on the viz, and it expands via the header ↗.) */
export type DockSectionId = 'narration' | 'music' | 'atmosphere';

/** Where the user has dragged the player to, and how big they sized each window
 *  state. `x`/`y` are the top-left in viewport px (applied in every state once the
 *  player has been dragged; absent ⇒ the default anchored corner). Sizes persist PER
 *  STATE: `fw`/`fh` for the full window, `ew`/`eh` for the expanded window (mini is
 *  fixed-size and never resizes). All optional so a partial record round-trips. */
export interface DockPlacement {
  x?: number;
  y?: number;
  fw?: number;
  fh?: number;
  ew?: number;
  eh?: number;
}

/** A tiny storage port for {@link DockPlacement}. The host owns persistence (the
 *  shell stays storage-agnostic); absent ⇒ position + size are session-only. */
export interface DockPlacementStore {
  get(): DockPlacement | null;
  set(p: DockPlacement): void;
}

/** Options for {@link createAudioDock}. */
export interface AudioDockOptions {
  host: DockHost;
  /** What the app allows to appear. Defaults to `{}` (transport-only). */
  capabilities?: DockCapabilities;
  /** If given, the dock element is appended into it; else the caller mounts
   *  `controller.el` wherever it likes (both players append to <body>). */
  mount?: HTMLElement;
  /** The initial collapse size. Defaults to `'full'`. */
  collapse?: DockCollapse;
  /** Which sections start open. Defaults: narration + music open, atmosphere
   *  closed. Only sections whose capability is on can actually show. */
  openSections?: Partial<Record<DockSectionId, boolean>>;
  /** The document to build in, for a popout window or a test DOM. Defaults to
   *  the ambient `globalThis.document`. */
  document?: Document;
  /** When present, the shell renders a close (×) button in the header and calls
   *  this on click. The host decides what "close" means (neurospicy leaves the
   *  mode). Absent ⇒ no close button (a narration dock only collapses). Optional. */
  onClose?(): void;
  /** Notified on EVERY collapse change (the collapse button, the mini expander, the
   *  Escape step-down), so a host can persist the size. Optional. */
  onCollapse?(size: DockCollapse): void;
  /** The ordered sizes the step-down (collapse button / Escape) walks through.
   *  Defaults to `['full', 'compact', 'mini']`. A host with no meaningful compact
   *  state (music: compact == full) can pass `['full', 'mini']` for a binary
   *  expand/minimize. `expanded` is never in this list; it steps down to the first
   *  entry. Only affects stepping; `setCollapse` still accepts any size. */
  collapseSizes?: DockCollapse[];
  /** Persist where the user dragged the player + how big they made the expanded
   *  window. Absent ⇒ position/size live only for the session. */
  placement?: DockPlacementStore;
}

/** The handle {@link createAudioDock} returns. */
export interface DockController {
  /** The root dock element (mounted, or for the caller to mount). */
  readonly el: HTMLElement;
  /** Re-declare what CAN appear; re-renders capability-gated sections. */
  setCapabilities(capabilities: DockCapabilities): void;
  /** Change the collapse size (Full / Compact / Mini). */
  setCollapse(size: DockCollapse): void;
  getCollapse(): DockCollapse;
  /** Open or close (or toggle, when `open` is omitted) a capability section. */
  toggleSection(id: DockSectionId, open?: boolean): void;
  /** Re-read every value from the host and repaint. Cheap; safe to call often. */
  refresh(): void;
  /** Tear down: unsubscribe, stop the rAF loops, remove the element + styles. */
  destroy(): void;
}
