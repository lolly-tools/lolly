// SPDX-License-Identifier: MPL-2.0
/**
 * Music `DockHost` adapter for the LIVE Neurospicy dock (plan "this-is-a-very-
 * sparkling-eich", Phase 2b - the migration onto @lolly-tools/audio-dock).
 *
 * It drives the shared audio-dock shell from the neurospicy ENGINE (lib/neurospicy.ts)
 * without touching it: every transport method here is a thin delegate to an exported
 * engine function. The sibling `lib/docs-narration-host.ts` is the narration counterpart;
 * the two prove one dock shell serves both players.
 *
 * VISUALISER (2026-08-15). The rich MilkDrop/Butterchurn visualiser now lives INSIDE
 * the dock - there is no separate fullscreen panel any more. The shell owns the canvas
 * (backdrop / expanded window / fullscreen) plus the drag/resize/fullscreen chrome and
 * the visualiser SECTION UI; this adapter is the `DockViz` renderer it drives: `mount`/
 * `unmount` wrap lib/butterchurn-viz.ts's `mountViz`, and `presets`/`themes`/`select*`
 * wrap the same viz-presets / viz-stock / viz-schemes system the old components/
 * viz-overlay.ts panel used. The shell package stays butterchurn-free - the dependency
 * enters only here, on the app side, so the static /info build never pulls it in.
 *
 * The one real piece of transport logic is `onChange`: the engine has no single
 * "something changed" callback, only DOM events (`lolly:neuro-playing` / `-enabled` /
 * `-tracks` and `lolly:atmosphere`). This adapter fans them into the dock's single
 * change subscription, and also emits after each of its OWN async transport calls
 * resolve, so the now-playing line and picker settle once the operation lands.
 */
import {
  getNeurospicy, toggleNeurospicyPlay, cycleNeurospicyLoop, setNeurospicyLoop,
  setNeurospicyVolume, setNeurospicyRepeat, seekNeurospicy, getNeurospicyProgress,
  getNeurospicyAnalyser, isNeurospicyPlaying, listLoops, trackCategory,
  type NeurospicyHost, type NeuroTrack,
} from './neurospicy.ts';
import {
  ATMOSPHERE_LAYERS, ATMOSPHERE_GROUPS, atmosphereLevel, setAtmosphereLevel,
  type AmbienceKind,
} from './atmosphere.ts';
import { getSfxVolume, setSfxVolume } from './sfx.ts';
import { SOMAFM_HOME, radioAvailable } from './radio.ts';
import { vizSupported } from './viz-support.ts';
import { neuroDemoActive, DEMO_VIZ_PRESET_ID, demoVizWave, pumpVizDemoFrames } from './neuro-demo.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import { perfUiOn } from '../feature-flags.ts';
import { icon, hasIcon } from './icons.ts';
import { mountViz, type VizHandle } from './butterchurn-viz.ts';
import { VIZ_PRESETS, vizPresetById, defaultVizPresetId } from './viz-presets.ts';
import {
  stockPresetIndex, loadStockPreset, readBrandTint,
  type BrandTint, type StockPresetInfo,
} from './viz-stock.ts';
import { vizSchemes, vizSchemeById, type VizScheme } from './viz-schemes.ts';
import { CYCLE_CHOICES, loadCycleSeconds, saveCycleSeconds } from './viz-cycle.ts';
import type { VizPalette, VizPaletteHost } from './viz-palette.ts';
import type {
  DockHost, DockNowPlaying, DockSource, DockSources, DockAtmosphere, DockViz,
  DockRepeat, DockVolume, DockAttribution, DockVizPreset, DockVizTheme, DockVizTransition,
  DockBrandMark,
} from '@lolly-tools/audio-dock';

/** The web shell's full host satisfies both what the transport needs (NeurospicyHost)
 *  and the token slice the visualiser palette reads (VizPaletteHost). */
type MusicHost = NeurospicyHost & VizPaletteHost;

/** Friendly section labels for the picker groups, in the engine's canonical order
 *  (NEURO_CATEGORY_ORDER). The dock renders groups in first-seen order, and listLoops
 *  hands tracks back pre-sorted into that order, so what shows is what next/prev walk. */
const CATEGORY_LABEL: Record<string, string> = {
  catalog: 'Catalog',
  uploads: 'Uploads',
  lolly: 'Lolly Sings',
  ambient: 'Ambient',
  beats: 'Beats',
  radio: 'Internet Radio',
};

/** Persisted visualiser prefs (device-local, like the old panel's). */
const ENABLED_KEY = 'lolly:vizEnabled';
const SCHEME_KEY = 'lolly:vizScheme';

/**
 * The preset the dock opens on (Andy's pick): flexi's bouncing-balls mindblob, a
 * bright tier-1 artist preset. It's a STOCK preset, staged from a build-time
 * dependency (see lib/viz-stock.ts), so a clone without the pack has no artist
 * presets - `openingPresetId` falls back to a brand-native default there, and
 * under reduced motion. The auto-cycle still draws at random from the whole
 * library; this only pins the FIRST frame, so leaving Bars always lands on the
 * same good look rather than a random draw that could be near-black.
 */
const START_PRESET_ID = 'flexi-bouncing-balls-double-mindblob-neon-mix';

/** A short mood/genre chip from a track's tags (mirrors music-player.ts's trackMood,
 *  inlined so this adapter stays decoupled from the old component). */
function trackMood(tags: string[]): string {
  if (tags.includes('ambient')) return 'ambient';
  if (tags.includes('beat') || tags.includes('rhythm')) return 'beat';
  if (tags.includes('melodic')) return 'melodic';
  if (tags.includes('radio') || tags.includes('stream')) return 'radio';
  if (tags.includes('lofi')) return 'lo-fi';
  if (tags.includes('generated')) return 'generated';
  return '';
}

export interface NeurospicyDockHandle {
  /** The DockHost to hand to createAudioDock. */
  host: DockHost;
  /** Drop the document-event subscriptions AND release the visualiser (WebGL). The
   *  neurospicy ENGINE keeps running (audio, persistence). */
  destroy(): void;
}

/** Build a music `DockHost` over the neurospicy engine for the given app host. */
export function createNeurospicyDockHost(nhost: MusicHost): NeurospicyDockHandle {
  const host = new NeurospicyDockHost(nhost);
  return { host, destroy: () => host.destroy() };
}

/**
 * The `DockViz` renderer: butterchurn over the shell's ONE canvas, plus the preset +
 * theme (colour-scheme) controls the visualiser section drives. All the surface chrome
 * (backdrop / expanded / fullscreen, drag, resize) is the shell's - this only owns the
 * renderer and the library.
 */
class NeuroDockViz implements DockViz {
  private readonly host: MusicHost;
  private handle: VizHandle | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private mounting: Promise<void> | null = null;
  private vizEnabled: boolean;
  private presetId = '';
  private stock: StockPresetInfo[] = [];
  private brandTint: BrandTint = 'strong';
  private schemes: VizScheme[] = [];
  private schemeId = '';
  private destroyed = false;
  /** The analyser the current handle is bound to, so we know to remount when the LIVE
   *  analyser appears (idle → reactive). */
  private mountedAnalyser: AnalyserNode | null = null;
  /** A silent, unconnected analyser (its own suspended AudioContext) so butterchurn
   *  IDLE-ANIMATES with nothing playing - many presets move from time alone, and the docs
   *  ?neuro=viz capture needs a live picture without audio. Created lazily. */
  private silentCtx: AudioContext | null = null;
  private silentNode: AnalyserNode | null = null;
  /** Preset auto-cycle: seconds between changes (0 = off) + the timer. */
  private cycleSeconds = 0;
  private cycleTimer: ReturnType<typeof setInterval> | undefined;

  constructor(host: MusicHost) {
    this.host = host;
    let saved = '1';
    try { saved = localStorage.getItem(ENABLED_KEY) ?? '1'; } catch { /* private mode */ }
    this.vizEnabled = saved !== '0';
    this.cycleSeconds = loadCycleSeconds();
  }

  // ── support probe + live analyser (also feeds the shell's 2D backdrop fallback) ──
  supported(): boolean { return vizSupported(); }
  getAnalyser(): AnalyserNode | null { return getNeurospicyAnalyser(); }

  // The brand silhouette for the immersive/fullscreen viz (plans/147): the brand's
  // MONO-REVERSE logo (a one-colour, dark-background mark), resolved across BOTH logo
  // systems - user-uploaded variants (`user/logo/horizontal-mono-reverse`) AND pack/catalog
  // logos, whose naming differs per brand (SUSE's is `suse/logo/hor-neg-white`: neg =
  // reverse, white = mono). So match on reverse + mono rather than one rigid id. Null when
  // the brand carries no such mark. Cached - resolved once per dock.
  private brandMarkCache: DockBrandMark | null | undefined;
  async brandMark(): Promise<DockBrandMark | null> {
    if (this.brandMarkCache !== undefined) return this.brandMarkCache;
    const cands: Array<{ id: string; url: string }> = [];
    try {
      const users = this.host.assets._listUserAssets ? await this.host.assets._listUserAssets() : [];
      for (const a of users) if (a.url && /logo/i.test(a.id)) cands.push({ id: a.id, url: a.url });
    } catch { /* no user assets on this host */ }
    try {
      // Pack/catalog logos are vectors (SVG).
      const vecs = await this.host.assets.query({ type: 'vector' });
      for (const r of vecs) if (r.url && /logo/i.test(r.id)) cands.push({ id: r.id, url: r.url });
    } catch { /* no catalog query on this host */ }
    // A mono-reverse mark is BOTH reverse (dark-bg: neg/reverse/knockout) AND mono
    // (one-colour: mono/white). Keep BOTH orientations so the shell can match the viz
    // shape. A brand with only positive/full-colour logos yields nothing - a coloured
    // logo under difference isn't a silhouette.
    const reverse = (id: string): boolean => /neg|reverse|knockout/i.test(id);
    const mono = (id: string): boolean => /mono|white/i.test(id);
    const isH = (id: string): boolean => /(^|[^a-z])(hor|horizontal)([^a-z]|$)/i.test(id);
    const isV = (id: string): boolean => /(^|[^a-z])(vert|vertical)([^a-z]|$)/i.test(id);
    const monoRev = cands.filter((c) => reverse(c.id) && mono(c.id));
    const horizontal = monoRev.find((c) => isH(c.id))?.url ?? null;
    const vertical = monoRev.find((c) => isV(c.id))?.url ?? null;
    this.brandMarkCache = (horizontal || vertical) ? { horizontal, vertical } : null;
    return this.brandMarkCache;
  }

  // ── on/off ──────────────────────────────────────────────────────────────────
  enabled(): boolean { return this.vizEnabled; }
  setEnabled(on: boolean): void {
    this.vizEnabled = on;
    try { localStorage.setItem(ENABLED_KEY, on ? '1' : '0'); } catch { /* best-effort */ }
    if (!on) this.unmount();
    // When switched on the shell re-calls mount() itself (syncViz) with the canvas.
  }

  /** A silent AnalyserNode that outputs zeros - butterchurn idles against it. */
  private silentAnalyser(): AnalyserNode | null {
    if (this.silentNode) return this.silentNode;
    try {
      const Ctx = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      const ctx = new Ctx();
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0.8;
      // Deliberately connected to NOTHING → the analyser reads silence (128), which is a
      // valid idle input; no sound is produced and no gesture is needed (WebGL renders
      // regardless of whether the context is suspended).
      this.silentCtx = ctx;
      this.silentNode = an;
      return an;
    } catch { return null; }
  }

  // ── renderer lifecycle ────────────────────────────────────────────────────────
  async mount(canvas: HTMLCanvasElement): Promise<void> {
    // The rich dock visualiser idle-animates off a silent analyser even with nothing
    // playing, so it's an ambient loop - don't start it under reduced motion or perf-ui.
    if (this.destroyed || !this.vizEnabled || !vizSupported() || prefersReducedMotion() || perfUiOn()) return;
    // Render IMMEDIATELY, audio or not: use the live analyser when it exists (reactive),
    // else a silent one (idle animation). When the live analyser first appears we remount
    // so the picture starts reacting.
    const desired = getNeurospicyAnalyser() ?? this.silentAnalyser();
    // Already rendering the right thing on this canvas → cheap no-op.
    if (this.handle && this.canvas === canvas && this.handle.running() && this.mountedAnalyser === desired) return;
    // A stood-down loop, a new canvas, or the analyser changed (idle → live) → remount.
    if (this.handle && (this.canvas !== canvas || !this.handle.running() || this.mountedAnalyser !== desired)) {
      this.handle.destroy();
      this.handle = null;
    }
    this.canvas = canvas;
    if (this.mounting) return this.mounting;
    this.mounting = this.mountOnce(canvas, desired).finally(() => { this.mounting = null; });
    return this.mounting;
  }

  private async mountOnce(canvas: HTMLCanvasElement, analyser: AnalyserNode | null): Promise<void> {
    await this.ensureData();
    if (this.destroyed || this.canvas !== canvas || this.handle) return;
    const palette = this.currentPalette();
    // The ?neuro=viz capture affordance (lib/neuro-demo.ts): the enlarged viz
    // lives in this dock now, so the deterministic demo contract the panel
    // carried has to hold here too - pinned preset, injected wave, seeded
    // randomness, a driven fixed-frame pump instead of the live rAF loop, and
    // `data-demo-settled` on the dock root when the picture freezes. Without
    // this branch a ?neuro=viz capture is a live loop that never settles and a
    // baseline that churns every run.
    const demo = neuroDemoActive();
    if (demo) this.presetId = DEMO_VIZ_PRESET_ID;
    let handle: VizHandle | null = null;
    try {
      handle = await mountViz(canvas, this.host, this.presetId,
        (err) => console.error('[lolly:viz] the dock visualiser stopped', err), palette,
        // pixelRatioCap 2 → crisp when the window is enlarged/fullscreen (the backdrop
        // just resamples down). `analyser` forces the silent idle source when there's no
        // live audio yet.
        demo
          ? { pixelRatioCap: 2, audio: { frame: () => ({ wave: demoVizWave(), seed: 0 }) }, deterministic: true, driven: true, capture: true }
          : { pixelRatioCap: 2, ...(analyser ? { audio: { analyser } } : {}) });
    } catch (err) {
      console.error('[lolly:viz] mount failed', err);
      return;
    }
    // Null only when WebGL2 is genuinely unavailable now (we always pass an analyser).
    if (!handle) return;
    if (this.destroyed || this.canvas !== canvas || this.handle) { handle.destroy(); return; }
    this.handle = handle;
    this.mountedAnalyser = analyser;
    if (demo) {
      // Stamp the dock window root (`section.audio-dock`, the canvas's parent) - the
      // element a capture recipe frames. No auto-cycle: a preset change would repaint
      // the frozen field.
      pumpVizDemoFrames(handle, () => this.handle === handle, canvas.closest('.audio-dock') ?? canvas.parentElement);
      return;
    }
    // An ARTIST preset opened on the fallback - fetch + apply the real one now.
    if (this.isStock(this.presetId)) void this.applyStock(this.presetId);
    this.startCycle();   // resume auto-cycling once there is a renderer to drive
  }

  /** Re-measure the canvas and resize the renderer to its displayed size × dpr (crisp). */
  resize(): void { this.handle?.resize(); }

  unmount(): void {
    this.stopCycle();
    if (this.handle) { this.handle.destroy(); this.handle = null; }
    this.canvas = null;
    this.mountedAnalyser = null;
  }

  // ── preset library ────────────────────────────────────────────────────────────
  async presets(): Promise<DockVizPreset[]> {
    await this.ensureData();
    const ours: DockVizPreset[] = VIZ_PRESETS.map((d) => ({ id: d.id, name: d.name, group: 'Lolly' }));
    const artist: DockVizPreset[] = this.stock.map((x) => ({ id: x.id, name: x.name, group: x.author || 'Artist' }));
    return [...ours, ...artist];
  }
  currentPreset(): string { return this.presetId; }
  selectPreset(id: string): void {
    if (!id) return;
    this.presetId = id;
    if (this.isStock(id)) void this.applyStock(id);
    else this.handle?.setPreset(id);
  }

  // ── themes (brand colour schemes) ───────────────────────────────────────────
  async themes(): Promise<DockVizTheme[]> {
    await this.ensureData();
    // Label by the FIRST colour only ("Jungle / Lilac" → "Jungle"); the two-colour scheme
    // still drives the palette, only the label is trimmed.
    return this.schemes.map((s) => ({ id: s.id, name: s.name.split(/\s*\/\s*/)[0]!.trim() || s.name }));
  }
  currentTheme(): string { return this.schemeId; }
  selectTheme(id: string): void {
    if (!this.schemes.length) return;
    const sc = vizSchemeById(this.schemes, id);
    this.schemeId = sc.id;
    try { localStorage.setItem(SCHEME_KEY, sc.id); } catch { /* best-effort */ }
    this.handle?.setPalette(sc.palette);
  }

  // ── transitions (preset auto-cycle timing) ──────────────────────────────────
  transitions(): DockVizTransition[] {
    return CYCLE_CHOICES.map((sec) => ({ id: String(sec), name: sec === 0 ? 'Off' : `${sec}s` }));
  }
  currentTransition(): string { return String(this.cycleSeconds); }
  selectTransition(id: string): void {
    this.cycleSeconds = Number(id) || 0;
    saveCycleSeconds(this.cycleSeconds);
    this.startCycle();
  }
  /** Rotate the preset every `cycleSeconds` (0 = off). A random pick from the whole library
   *  each tick - the breadth is the point; skipped while the renderer isn't drawing. */
  private startCycle(): void {
    this.stopCycle();
    if (this.cycleSeconds <= 0) return;
    this.cycleTimer = setInterval(() => {
      if (!this.handle || !this.handle.running()) return;
      const pool = [...VIZ_PRESETS.map((d) => d.id), ...this.stock.map((x) => x.id)];
      const others = pool.filter((id) => id !== this.presetId);
      const next = others[Math.floor(Math.random() * others.length)];
      if (next) this.selectPreset(next);
    }, this.cycleSeconds * 1000);
  }
  private stopCycle(): void {
    if (this.cycleTimer !== undefined) { clearInterval(this.cycleTimer); this.cycleTimer = undefined; }
  }

  // ── internals ────────────────────────────────────────────────────────────────
  private isStock(id: string): boolean { return this.stock.some((x) => x.id === id); }

  private currentPalette(): VizPalette | null {
    if (!this.schemes.length) return null;
    return vizSchemeById(this.schemes, this.schemeId).palette;
  }

  /** Load the artist-preset index + the brand's schemes once, and settle the opening
   *  preset. Cheap after the first call. */
  private async ensureData(): Promise<void> {
    if (this.stock.length === 0) {
      this.brandTint = readBrandTint();
      try { this.stock = await stockPresetIndex(); } catch { /* absent pack → ours only */ }
    }
    if (this.schemes.length === 0) {
      try {
        const resolved = await vizSchemes(this.host);
        if (resolved.length > 0) {
          this.schemes = resolved;
          let saved: string | null = null;
          try { saved = localStorage.getItem(SCHEME_KEY); } catch { /* private mode */ }
          this.schemeId = vizSchemeById(this.schemes, saved).id;
        }
      } catch { /* no schemes → the renderer keeps its default palette */ }
    }
    if (!this.presetId) this.presetId = this.openingPresetId();
  }

  /** The preset the dock opens on: the pinned artist preset when the pack is staged
   *  and motion is allowed, else a brand-native default. `this.stock` is already
   *  loaded above, so the pin resolves in one pass (no settle-later needed). */
  private openingPresetId(): string {
    if (prefersReducedMotion()) return defaultVizPresetId(true);
    if (this.isStock(START_PRESET_ID)) return START_PRESET_ID;
    return defaultVizPresetId(false);
  }

  /** Fetch an artist preset, brand-blend it, and hand it to the renderer (mirrors the
   *  old viz-overlay applyStockPreset). Falls back to a brand-native default when the
   *  pack isn't staged or the file is missing, rather than a black frame. */
  private async applyStock(id: string): Promise<void> {
    const handle = this.handle;
    if (!handle) return;
    const preset = await loadStockPreset(id, handle.palette(), this.brandTint);
    if (this.handle !== handle || this.presetId !== id) return;
    if (!preset) { handle.setPreset(vizPresetById(null).id); return; }
    handle.setRawPreset(id, preset);
  }

  destroy(): void {
    this.destroyed = true;
    this.unmount();
    if (this.silentCtx) {
      void this.silentCtx.close().catch(() => { /* already closed */ });
      this.silentCtx = null;
      this.silentNode = null;
    }
  }
}

class NeurospicyDockHost implements DockHost {
  readonly sources: DockSources;
  readonly atmosphere: DockAtmosphere;
  readonly viz: NeuroDockViz;
  readonly repeat: DockRepeat;
  readonly volume: DockVolume;
  readonly volumes: DockVolume[];

  private readonly nhost: MusicHost;
  private readonly changeListeners = new Set<() => void>();
  private readonly listListeners = new Set<() => void>();
  private readonly docListeners: Array<[string, EventListener]> = [];
  /** Cached track list - the source of truth for the now-playing title + current row.
   *  Kept in lockstep with listLoops (which owns the canonical playlist order). */
  private tracks: NeuroTrack[] = [];
  private destroyed = false;

  constructor(nhost: MusicHost) {
    this.nhost = nhost;

    this.sources = {
      list: () => this.buildSources(),
      select: (id) => this.select(id),
      currentId: () => getNeurospicy().loopId,
      onListChange: (l) => { this.listListeners.add(l); return () => this.listListeners.delete(l); },
      // A long library (whole catalog audio + uploads + radio) wants type-to-filter.
      searchable: true,
      // radio.ts asks the SomaFM attribution + support link stay visible wherever its
      // stations play - shown whenever radio is in the list (i.e. online).
      attribution: (): DockAttribution | null =>
        radioAvailable()
          ? { text: 'Internet radio, free & listener-supported, via', href: SOMAFM_HOME, linkText: 'SomaFM' }
          : null,
    };

    this.atmosphere = {
      // Restore the per-layer ICONS (the 2b migration dropped them): the shell ships no
      // icon registry, so hand it the finished inline-SVG glyph.
      layers: () => ATMOSPHERE_LAYERS.map((l) => ({
        id: l.id, label: l.label, group: l.group,
        icon: hasIcon(l.icon) ? icon(l.icon, { size: 14 }) : '',
      })),
      groups: () => ATMOSPHERE_GROUPS,
      getLevel: (id) => atmosphereLevel(id as AmbienceKind),
      // The slider IS the enable (0 stops the bed); setAtmosphereLevel handles both.
      setLevel: (id, level) => setAtmosphereLevel(this.nhost, id as AmbienceKind, level),
    };

    // The rich in-dock visualiser (butterchurn) + its preset/theme library.
    this.viz = new NeuroDockViz(nhost);

    this.repeat = {
      get: () => getNeurospicy().repeat,
      set: (v) => { void setNeurospicyRepeat(this.nhost, v); },
    };

    // Music is the MASTER volume - the speaker button + vertical slider on the transport
    // (same control the docs player uses). Effects (interface sound) stays a labelled
    // slider in the volumes block; it is a different level, so it is not folded in.
    this.volume = {
      id: 'music', label: 'Music',
      get: () => getNeurospicy().volume,
      set: (v) => setNeurospicyVolume(this.nhost, v), // persists on every input (as before)
    };
    this.volumes = [
      {
        id: 'effects', label: 'Effects',
        get: () => getSfxVolume(),
        set: (v) => setSfxVolume(v),             // live on drag
        commit: (v) => this.persistSfx(v),       // persist to the profile on release
      },
    ];

    // Fan the engine's DOM events into the dock's single change subscription.
    if (typeof document !== 'undefined') {
      const onChange = (): void => this.emitChange();
      const onTracks = (): void => { void this.reloadTracks(); };
      const wire = (name: string, fn: EventListener): void => {
        document.addEventListener(name, fn);
        this.docListeners.push([name, fn]);
      };
      wire('lolly:neuro-playing', onChange);   // audio started (incl. boot autoplay-resume)
      wire('lolly:neuro-enabled', onChange);   // mode toggled
      wire('lolly:atmosphere', onChange);      // an ambience level changed elsewhere
      wire('lolly:neuro-tracks', onTracks);    // an upload/deletion changed the library
    }
    // Prime the cache so the now-playing title is right on first paint.
    void this.reloadTracks();
    // Lock-screen / control-centre transport + now-playing (plans/146) - what makes the
    // backgrounded radio feel like a podcast app. No-op where Media Session is absent.
    this.wireMediaSession();
  }

  // ── Media Session - OS lock-screen transport + now-playing (plans/146) ─────────
  // Mirrors docs/player/narration-host.ts's wireMediaSession, over this player's
  // transport. Metadata + playbackState are pushed on every change via syncMediaSession
  // (called from emitChange); this only sets the action handlers, once.

  private wireMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => { if (!isNeurospicyPlaying()) void this.togglePlay(); });
      ms.setActionHandler('pause', () => { if (isNeurospicyPlaying()) void this.togglePlay(); });
      ms.setActionHandler('nexttrack', () => void this.next());
      ms.setActionHandler('previoustrack', () => void this.prev());
    } catch { /* partial Media Session support: the in-app transport still works */ }
  }

  private syncMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.playbackState = isNeurospicyPlaying() ? 'playing' : 'paused';
      const np = this.nowPlaying();
      if (np.title && np.title !== 'Select a track' && typeof MediaMetadata !== 'undefined') {
        ms.metadata = new MediaMetadata({
          title: np.title,
          artist: np.kind === 'radio' ? 'Internet radio · SomaFM' : (np.subtitle || 'Neurospicy'),
          album: 'Lolly',
        });
      }
    } catch { /* MediaMetadata unsupported: playback is unaffected */ }
  }

  private clearMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const ms = navigator.mediaSession;
      ms.metadata = null;
      for (const a of ['play', 'pause', 'nexttrack', 'previoustrack'] as const) ms.setActionHandler(a, null);
    } catch { /* fine */ }
  }

  // ── DockHost: transport ──────────────────────────────────────────────────────

  isPlaying(): boolean { return isNeurospicyPlaying(); }

  async togglePlay(): Promise<void> {
    await toggleNeurospicyPlay(this.nhost);
    this.emitChange();
  }

  // cycleNeurospicyLoop wraps infinitely, so stepping is always possible - canNext/
  // canPrev are omitted (the dock then treats them as true).
  async next(): Promise<void> {
    await cycleNeurospicyLoop(this.nhost, 1);
    this.emitChange();
  }

  async prev(): Promise<void> {
    await cycleNeurospicyLoop(this.nhost, -1);
    this.emitChange();
  }

  // getNeurospicyProgress() is null for radio / while nothing local sounds → duration 0
  // and seekable false, which hides the scrub (a live stream has nothing to seek).
  currentTime(): number { return getNeurospicyProgress()?.position ?? 0; }
  duration(): number { return getNeurospicyProgress()?.duration ?? 0; }
  seekable(): boolean { return getNeurospicyProgress() != null; }
  seek(seconds: number): void { seekNeurospicy(seconds); }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  // ── DockHost: now-playing ────────────────────────────────────────────────────

  nowPlaying(): DockNowPlaying {
    const id = getNeurospicy().loopId;
    const t = this.tracks.find((x) => x.id === id);
    if (!t) return { title: 'Select a track', kind: 'music' };
    const radio = trackCategory(t) === 'radio';
    return {
      title: t.name,
      subtitle: radio ? 'Internet radio' : (trackMood(t.tags) || undefined),
      kind: radio ? 'radio' : 'music',
    };
  }

  // ── internals ────────────────────────────────────────────────────────────────

  private async buildSources(): Promise<DockSource[]> {
    const loops = await listLoops(this.nhost);
    this.tracks = loops;
    return loops.map((t): DockSource => {
      const cat = trackCategory(t);
      const radio = cat === 'radio';
      const mood = trackMood(t.tags);
      return {
        id: t.id,
        title: t.name,
        kind: radio ? 'radio' : 'music',
        group: CATEGORY_LABEL[cat] ?? cat,
        ...(mood ? { mood } : {}),
      };
    });
  }

  private async select(id: string): Promise<void> {
    await setNeurospicyLoop(this.nhost, id);
    this.emitChange();
  }

  /** Re-read the library (listLoops owns the order), then repaint the picker AND the
   *  now-playing line from the fresh cache. Used to prime at boot and on every
   *  `lolly:neuro-tracks`. */
  private async reloadTracks(): Promise<void> {
    try { this.tracks = await listLoops(this.nhost); } catch { /* keep the last good list */ }
    if (this.destroyed) return;
    this.emitList();
    this.emitChange();
  }

  private persistSfx(v: number): void {
    void this.nhost.profile.get()
      .then((p) => this.nhost.profile.set({ ...p, sfxVolume: v }))
      .catch(() => { /* best-effort, exactly like the old player */ });
  }

  private emitChange(): void {
    if (this.destroyed) return;
    this.syncMediaSession();   // keep the lock screen in step with every transport change
    for (const l of this.changeListeners) { try { l(); } catch { /* one bad listener never blocks the rest */ } }
  }

  private emitList(): void {
    if (this.destroyed) return;
    for (const l of this.listListeners) { try { l(); } catch { /* ditto */ } }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.viz.destroy();
    if (typeof document !== 'undefined') {
      for (const [name, fn] of this.docListeners) document.removeEventListener(name, fn);
    }
    this.docListeners.length = 0;
    this.changeListeners.clear();
    this.listListeners.clear();
    this.clearMediaSession();
  }
}
