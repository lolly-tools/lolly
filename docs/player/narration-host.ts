// SPDX-License-Identifier: MPL-2.0
/**
 * Narration `DockHost` adapter for the STATIC /info docs site.
 *
 * Phase 2c of the unified audio-dock effort: the published /info narration
 * player is migrated OFF its bespoke `.ldp` dock and ONTO the shared
 * @lolly-tools/audio-dock shell - so the docs use the SAME dock component as the
 * app (one component everywhere). This file is the /info counterpart to the
 * app's shells/web/src/lib/docs-narration-host.ts: same audio-index.json
 * resolution, same per-block cues.json for caption + follow-along highlight, same
 * speed model (SPEEDS, 1.25× default).
 *
 * ISOLATION (hard constraint): /info is a SEPARATE document that must NOT pull in
 * the SPA module graph, so this file imports NOTHING from shells/web. Its only
 * shared dependency is the dependency-free audio-dock package (by RELATIVE path,
 * esbuild-bundled by docs/build.ts). `extractSpokenText` comes from scripts/lib
 * (not shells/web); its node:crypto import is aliased to a browser stub by the
 * same esbuild step (see docs/build.ts's bundleDocsPlayer + crypto-stub.ts).
 *
 * WHAT MOVED VS. THE OLD PLAYER: the butterchurn visualiser and the procedural
 * atmosphere mixer are dropped - both required code from shells/web (ambience-dsp
 * lived there) and both are absent from the app's own narration host, which is
 * the reference shape. In their place the dock draws its OWN built-in 2D
 * frequency backdrop from the `<audio>` analyser tap this host exposes via
 * `DockViz.getAnalyser` (no `DockViz.mount`, so the shell never bundles
 * butterchurn). Everything narration keeps: transport, cross-page prev/next
 * playlist + auto-advance, follow-along highlight/scroll, chapter-seek, speed,
 * the AI disclosure, captions, and OS Media Session.
 *
 * ENGLISH-ONLY: all committed audio is English (urls under /info/audio/en/…), and
 * the follow-along block map is re-derived from the ENGLISH markdown twin, so a
 * slug with no entry in audio-index.json resolves to null and the caller (the
 * Listen pill) mounts NOTHING - the content gate stays exactly as it was.
 */
import { extractSpokenText, type SpokenBlock } from '../../scripts/lib/docs-spoken-text.ts';
import type { DockHost, DockNarration, DockNowPlaying, DockViz, DockVolume } from '../../packages/audio-dock/src/index.ts';

interface Cue { blockId: string; start: number; end: number }
export interface Track { slug: string; title: string; url: string; duration: number; bytes: number }

/** Playback speeds + default, identical to the old player (1.25× default, range
 *  0.5×–2×: narration is to learn from, so the control leans slower). */
const SPEEDS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_DEFAULT_IDX = SPEEDS.indexOf(1.25);

/** The follow-along highlight class, styled on the page by /info/docs-player.css. */
const HERE_CLASS = 'docs-narr-here';
/** Set on <html> while narration is loaded, so headings read as seek targets
 *  (the chapter-seek cursor rule lives in docs-player.css). */
const OPEN_CLASS = 'docs-narr-open';
/** Scroll-idle grace before follow-along re-engages after a user scroll. */
const IDLE_MS = 4000;
const DISCLOSURE = 'AI narration. The page text is the original.';

/** Playlist hand-off between pages - the ONLY thing this player persists.
 *  Session-scoped by design: the docs site has no host.state, and this is
 *  chrome-transient, not tool state. */
const STORE_KEY = 'lolly-docs-listen';
/** The Follow toggle's opt-out, remembered for the session. Every docs
 *  navigation is a fresh document, so "for the session" has to mean
 *  sessionStorage - in memory alone, auto-advance would silently re-engage
 *  follow-along on every page a reader had opted out of. */
const FOLLOW_KEY = 'lolly-docs-follow-off';
/** The chosen speed (as a RATE, not an index), remembered like Follow so a
 *  listener's choice rides the auto-advance hand-off. -v3 matches the old
 *  player's key so a returning listener's stored rate carries over. */
const SPEED_KEY = 'lolly-docs-speed-v3';
/** Master volume (0..1), remembered like speed so a listener's level rides the
 *  auto-advance hand-off and carries to the device-voice host too. */
const VOLUME_KEY = 'lolly-docs-volume';

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Block map - narrated blockIds onto the live DOM (ported verbatim from the
// old docs/player/player.ts) ─────────────────────────────────────────────────
// cues.json speaks in the blockIds the spoken-text extraction minted from the
// markdown SOURCE. Headings carry the same ids in the built page by construction
// (headingId parity); paragraphs and list items don't, so they are re-derived
// here by re-running the same extraction over the page's published markdown twin
// (/info/<slug>.md) and walking the section's p/li elements in order, matched
// loosely by text. Whole-document scope (`.docs-content` or <body>) so it also
// works on the landing page, which mints its own section ids. Synthetic blocks
// ("Code example omitted.") have no DOM twin and stay unmapped - the highlight
// skips them.
function buildBlockMap(blocks: SpokenBlock[]): Map<string, HTMLElement> {
  const root = document.querySelector<HTMLElement>('.docs-content') ?? document.body;
  const map = new Map<string, HTMLElement>();
  const flow = Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li'));
  const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();
  let cursor = 0;
  for (const b of blocks) {
    if (b.kind === 'heading') {
      const el = document.getElementById(b.blockId);
      if (el && root.contains(el)) {
        map.set(b.blockId, el);
        const i = flow.indexOf(el);
        if (i >= 0) cursor = i + 1;
      }
      continue;
    }
    const want = norm(b.text).slice(0, 40);
    if (!want) continue;
    // Look a bounded distance ahead so one unmatched block can't derail the
    // whole rest of the section; stop at the next heading - that's a new section.
    for (let j = cursor; j < Math.min(cursor + 14, flow.length); j++) {
      const el = flow[j]!;
      if (/^H[1-4]$/.test(el.tagName)) break;
      const got = norm(el.textContent ?? '');
      if (got.slice(0, 40) === want || got.startsWith(want.slice(0, 24))) {
        map.set(b.blockId, el);
        cursor = j + 1;
        break;
      }
    }
  }
  return map;
}

export interface CreateDocsNarrationOpts {
  slug: string;
  title: string;
}

/**
 * Resolve the narration track for a docs slug over /info/audio-index.json and, if
 * one exists, build the `DockHost` for it. Returns null when the slug has no
 * committed audio - the caller then mounts no dock (content gate). English-only:
 * the index and the block map are English.
 */
export async function createDocsNarrationHost(opts: CreateDocsNarrationOpts): Promise<DocsNarrationHost | null> {
  // The produced track is Ogg/Opus. A browser that can't decode it (iOS Safari before
  // 18.4) gets null here so the caller falls back to the device voice (plan 131 B.3),
  // instead of a host that owns an <audio> element it can never play.
  try {
    if (!new Audio().canPlayType('audio/ogg; codecs=opus')) return null;
  } catch { /* no Audio support at all: let the caller try the device voice */ return null; }

  const index = await fetch('/info/audio-index.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []) as Track[];
  const playlist = Array.isArray(index) ? index : [];
  const track = playlist.find((t) => t.slug === opts.slug);
  if (!track) {
    // The button only renders when audio exists - but never trust that from
    // here, and never fail silently when the index disagrees with the page.
    console.warn(`docs player: no narration for "${opts.slug}" in /info/audio-index.json`);
    return null;
  }
  // The playlist hand-off that opened this page is consumed now.
  try { sessionStorage.removeItem(STORE_KEY); } catch { /* storage may be disabled */ }

  const host = new DocsNarrationHost(playlist, track, opts.title || track.title);
  host.start();
  return host;
}

export class DocsNarrationHost implements DockHost {
  readonly narration: DockNarration;
  readonly viz: DockViz;
  readonly volume: DockVolume;

  private readonly playlist: Track[];
  private readonly track: Track;
  private readonly slug: string;
  private readonly title: string;
  // preservesPitch keeps the voice natural at every rate (a pace choice, never a
  // quality downgrade). Browsers default this true; set it so the promise holds.
  private readonly audio = Object.assign(new Audio(), { preservesPitch: true });
  private readonly listeners = new Set<() => void>();
  private readonly cleanups: Array<() => void> = [];

  private cues: Cue[] = [];
  private cueIdx = -1;
  private captionText = '';
  private blockMap = new Map<string, HTMLElement>();
  private blockText = new Map<string, string>();
  private highlighted: HTMLElement | null = null;

  private speedIdx = SPEED_DEFAULT_IDX;

  // Follow-along: `followOff` is the dock toggle (session opt-out, mirrored to
  // sessionStorage so it survives prev/next + auto-advance); `suspended` is the
  // instant, temporary loss to a user scroll (re-engages after IDLE_MS idle).
  private followOff = false;
  private suspended = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Scroll events before this timestamp are our own drift, not the user's. */
  private autoUntil = 0;

  // The live audio tap for the dock's built-in viz backdrop (created lazily on
  // first play, a user gesture, so the AudioContext starts running). The audio is
  // same-origin, so the MediaElementSource tap involves no CORS and no taint.
  private actx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  private destroyed = false;

  constructor(playlist: Track[], track: Track, title: string) {
    this.playlist = playlist;
    this.track = track;
    this.slug = track.slug;
    this.title = title;

    try { this.followOff = sessionStorage.getItem(FOLLOW_KEY) === '1'; } catch { /* storage may be disabled */ }
    try {
      const savedRate = Number(sessionStorage.getItem(SPEED_KEY));
      const savedIdx = SPEEDS.indexOf(savedRate);
      if (savedIdx >= 0) this.speedIdx = savedIdx;
    } catch { /* storage may be disabled */ }

    this.audio.src = track.url;
    this.audio.preload = 'auto';
    this.audio.playbackRate = SPEEDS[this.speedIdx]!;
    try {
      const savedVol = Number(sessionStorage.getItem(VOLUME_KEY));
      if (Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 1) this.audio.volume = savedVol;
    } catch { /* storage may be disabled */ }

    this.narration = {
      getFollow: () => !this.followOff,
      setFollow: (on) => this.setFollow(on),
      getSpeed: () => SPEEDS[this.speedIdx]!,
      setSpeed: (rate) => this.setSpeed(rate),
      speeds: () => SPEEDS,
      caption: () => this.captionText,
      disclosure: () => DISCLOSURE,
    };
    this.volume = {
      id: 'master',
      label: 'Volume',
      get: () => this.audio.volume,
      set: (v) => {
        this.audio.volume = Math.max(0, Math.min(1, v));
        try { sessionStorage.setItem(VOLUME_KEY, String(this.audio.volume)); } catch { /* best effort */ }
        this.emit();
      },
    };
    // The dock draws its OWN 2D frequency backdrop - supported() gates that loop,
    // which a Canvas 2D context always satisfies. getAnalyser() is null until the
    // tap is created (first play); the dock then shows the static ground and
    // starts reacting the moment the node appears. No mount() - so the shell never
    // pulls butterchurn into the /info bundle.
    this.viz = {
      supported: () => true,
      getAnalyser: () => this.analyser,
    };
  }

  /** Wire the audio element, mount it (so its captions <track> is in the document
   *  for AT), wire the page interactions, and kick off the sidecar fetches. */
  start(): void {
    const a = this.audio;
    const onPlay = (): void => this.emit();
    const onPause = (): void => this.emit();
    const onTimeUpdate = (): void => this.onTime();
    const onEnded = (): void => { this.emit(); this.go(1, true); };
    const onDur = (): void => this.emit();
    const onMeta = (): void => this.emit();
    const onSeeked = (): void => { this.cueIdx = -1; this.onTime(); };
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('timeupdate', onTimeUpdate);
    a.addEventListener('ended', onEnded);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('seeked', onSeeked);
    this.cleanups.push(() => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('timeupdate', onTimeUpdate);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('seeked', onSeeked);
    });

    // captions.vtt as a first-class <track> - programmatic value (textTracks API
    // for AT/extensions/UAs); the dock's caption line is the visible surface. Not
    // `default`, so nothing double-renders where a UA does surface it.
    const captionTrack = document.createElement('track');
    captionTrack.kind = 'captions';
    captionTrack.srclang = 'en';
    captionTrack.label = 'English';
    captionTrack.src = `${this.track.url.replace(/\/[^/]*$/, '')}/captions.vtt`;
    a.appendChild(captionTrack);

    // The element is invisible (no controls); it lives in the document so the
    // captions track loads. Removed on destroy.
    a.hidden = true;
    a.style.display = 'none';
    document.body.appendChild(a);

    document.documentElement.classList.add(OPEN_CLASS);
    this.wireFollowAlong();
    this.wireHeadingSeek();
    this.wireMediaSession();
    this.loadSidecars();
  }

  // ── DockHost: transport ──────────────────────────────────────────────────────

  isPlaying(): boolean { return !this.audio.paused && !this.audio.ended; }

  async togglePlay(): Promise<void> {
    if (this.audio.paused) await this.play();
    else this.audio.pause();
  }

  /** Explicit play (the Listen press, an auto-advance arrival, MediaSession). */
  async play(): Promise<void> {
    this.ensureTap();
    // Autoplay after a cross-page auto-advance can be refused - the dock then
    // just sits paused with everything loaded, one press from resuming.
    try { await this.audio.play(); } catch { /* blocked: stay paused, visibly */ }
  }

  next(): void { this.go(1); }
  prev(): void { this.go(-1); }
  canPrev(): boolean { return this.idx() > 0; }
  canNext(): boolean { const i = this.idx(); return i >= 0 && i < this.playlist.length - 1; }

  currentTime(): number { return this.audio.currentTime || 0; }
  duration(): number {
    const d = this.audio.duration;
    return Number.isFinite(d) && d > 0 ? d : (this.track.duration || 0);
  }
  seekable(): boolean { return true; }
  seek(seconds: number): void { this.audio.currentTime = Math.max(0, seconds); }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── DockHost: now-playing ────────────────────────────────────────────────────

  nowPlaying(): DockNowPlaying {
    return { title: this.title, subtitle: 'AI narration', kind: 'narration' };
  }

  // ── narration internals ──────────────────────────────────────────────────────

  private idx(): number { return this.playlist.findIndex((t) => t.slug === this.slug); }

  private emit(): void {
    if (this.destroyed) return;
    for (const l of this.listeners) { try { l(); } catch { /* one bad listener never blocks the rest */ } }
  }

  /** Session-scoped like Follow (never localStorage): a listener's choice rides the
   *  auto-advance hand-off, but a fresh visit meets the 1.25× default. Stores the
   *  RATE, not the index - an index silently re-maps whenever SPEEDS changes. */
  private setSpeed(rate: number): void {
    const idx = SPEEDS.indexOf(rate);
    if (idx < 0) return; // only curated stops
    this.speedIdx = idx;
    this.audio.playbackRate = SPEEDS[idx]!;
    try { sessionStorage.setItem(SPEED_KEY, String(SPEEDS[idx])); } catch { /* best effort */ }
    this.emit();
  }

  private setFollow(on: boolean): void {
    this.followOff = !on;
    try {
      if (on) sessionStorage.removeItem(FOLLOW_KEY);
      else sessionStorage.setItem(FOLLOW_KEY, '1');
    } catch { /* storage disabled: the opt-out lasts this page only */ }
    if (on) { this.suspended = false; this.drift(); }
    this.emit();
  }

  /** Follow-along is live: on, not opted out, not mid-suspension, not reduced motion. */
  private following(): boolean {
    return !this.followOff && !this.suspended && !reduced();
  }

  private onTime(): void {
    const t = this.audio.currentTime;
    if (this.cues.length) {
      // Cues are ordered; scan forward from the cached index.
      let i = this.cueIdx;
      if (i < 0 || i >= this.cues.length || t < this.cues[i]!.start) i = 0;
      while (i + 1 < this.cues.length && t >= this.cues[i + 1]!.start) i++;
      if (i !== this.cueIdx) {
        this.cueIdx = i;
        const cue = this.cues[i]!;
        this.captionText = this.blockText.get(cue.blockId) ?? '';
        this.highlight(cue.blockId);
      }
    }
    this.emit();
  }

  private highlight(blockId: string): void {
    const el = this.blockMap.get(blockId) ?? null;
    if (this.highlighted && this.highlighted !== el) this.highlighted.classList.remove(HERE_CLASS);
    this.highlighted = el;
    if (!el) return;
    el.classList.add(HERE_CLASS);
    if (this.following() && !this.audio.paused) this.drift();
  }

  private drift(): void {
    if (!this.following() || !this.highlighted) return;
    // Our own scroll must not read as the user's; the guard window outlives the
    // smooth scroll for any plausible distance.
    this.autoUntil = performance.now() + 1600;
    this.highlighted.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
  }

  /** The reader's scroll wins instantly: any user-initiated movement suspends
   *  follow-along mid-gesture, and after ~4 s of idle the anchor re-engages and
   *  gently returns to the narrated block. Whole-window, like the old player. */
  private wireFollowAlong(): void {
    const userScroll = (): void => {
      if (reduced() || this.followOff) return;
      this.suspended = true;
      // Halt an in-flight smooth drift so the viewport is never fought over
      // mid-gesture - but ONLY inside our own drift window; outside it, an
      // unconditional scrollTo would kill native momentum scrolling every tick.
      if (performance.now() <= this.autoUntil) {
        this.autoUntil = 0;
        window.scrollTo({ top: window.scrollY, behavior: 'auto' });
      }
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        this.suspended = false;
        if (!this.audio.paused) this.drift();
      }, IDLE_MS);
    };
    const onWheel = (): void => userScroll();
    const onTouch = (): void => userScroll();
    const onKeyNav = (e: KeyboardEvent): void => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) userScroll();
    };
    // Scrollbar drags produce only scroll events; anything outside our own drift
    // window is treated as the user's hand.
    const onScroll = (): void => { if (performance.now() > this.autoUntil) userScroll(); };
    addEventListener('wheel', onWheel, { passive: true });
    addEventListener('touchmove', onTouch, { passive: true });
    addEventListener('keydown', onKeyNav);
    addEventListener('scroll', onScroll, { passive: true });
    this.cleanups.push(() => {
      removeEventListener('wheel', onWheel);
      removeEventListener('touchmove', onTouch);
      removeEventListener('keydown', onKeyNav);
      removeEventListener('scroll', onScroll);
      if (this.idleTimer) clearTimeout(this.idleTimer);
    });
  }

  /** While the player is open, click a heading with a cue to jump the narration
   *  there; click the current highlight to re-engage follow-along. */
  private wireHeadingSeek(): void {
    const onClick = (e: MouseEvent): void => {
      const h = (e.target as HTMLElement | null)?.closest?.('h1[id],h2[id],h3[id],h4[id]') as HTMLElement | null;
      if (h) {
        const cue = this.cues.find((c) => c.blockId === h.id);
        if (cue) { this.audio.currentTime = cue.start; void this.play(); }
        return;
      }
      if (this.highlighted && (e.target as HTMLElement | null)?.closest?.(`.${HERE_CLASS}`)) {
        this.suspended = false;
        this.setFollow(true);
        this.drift();
      }
    };
    document.addEventListener('click', onClick);
    this.cleanups.push(() => document.removeEventListener('click', onClick));
  }

  /** cues.json (caption + highlight timings) and the English markdown twin (block
   *  ids + text). Both non-blocking - transport works before either lands. */
  private loadSidecars(): void {
    const base = this.track.url.replace(/\/[^/]*$/, '');
    void fetch(`${base}/cues.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { blocks?: Cue[] } | null) => {
        if (this.destroyed) return;
        if (j?.blocks?.length) { this.cues = j.blocks; this.cueIdx = -1; this.onTime(); }
      })
      .catch(() => { /* no cues: playback without captions/highlight */ });

    // The page's markdown twin re-yields the narrated blocks - ids for the DOM
    // map, text for the caption line. The title is the same string build.ts
    // stamped on the Listen button, so the meta-title skip lands identically here
    // and the blockIds stay in lockstep with cues.json.
    void fetch(`/info/${this.slug}.md`)
      .then((r) => (r.ok ? r.text() : null))
      .then((md) => {
        if (!md || this.destroyed) return;
        const blocks = extractSpokenText(md, { pageTitle: this.title });
        for (const b of blocks) this.blockText.set(b.blockId, b.text);
        this.blockMap = buildBlockMap(blocks);
        // A cue may already be showing; refresh its caption/highlight now the map exists.
        this.cueIdx = -1;
        this.onTime();
      })
      .catch(() => { /* unmapped: dock still plays, captions may be empty */ });
  }

  // ── the viz analyser tap ──────────────────────────────────────────────────────

  /** Create the AudioContext tap on first use. A tapped MediaElementSource mutes
   *  the element's direct output, so it is reconnected to the destination FIRST - 
   *  the narration stays audible whatever happens after. Idempotent; a failure
   *  leaves the element playing untapped (no viz, narration unaffected). */
  private ensureTap(): void {
    if (this.actx) {
      // A context created under an autoplay hand-off can arrive suspended; every
      // play press is a chance to resume it.
      if (this.actx.state === 'suspended') void this.actx.resume().catch(() => { /* retry next gesture */ });
      return;
    }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(this.audio);
      src.connect(ctx.destination); // keep the narration audible
      const an = ctx.createAnalyser();
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0.75;
      src.connect(an);
      this.actx = ctx;
      this.analyser = an;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => { /* resumed by the next gesture */ });
    } catch { /* no Web Audio: playback continues without the viz backdrop */ }
  }

  // ── cross-page playlist: prev/next + auto-advance over audio-index.json ────────

  /** Step to another page's narration. A cross-page hand-off: the next page's
   *  Listen loader reads STORE_KEY and opens the player without a press; play
   *  state carries over. `fromEnded` distinguishes auto-advance (last track
   *  stops, doesn't wrap) from an explicit prev/next press. */
  private go(delta: number, fromEnded = false): void {
    const i = this.idx();
    const next = i >= 0 ? this.playlist[i + delta] : undefined;
    if (!next) return; // edge of the playlist (or ended on the last track): stop
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ slug: next.slug, auto: fromEnded || !this.audio.paused }));
    } catch { /* storage disabled: the next page just shows its button */ }
    location.href = next.slug === 'index' ? '/info/index.html' : `/info/${next.slug}.html`;
  }

  // ── Media Session - OS media keys + lock-screen transport ──────────────────────

  private wireMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: this.title,
        artist: 'Lolly docs',
        album: 'lolly.tools/info',
        // index (the landing narration) has no per-page OG card - fall back to
        // the site card rather than a silently-404ing lock-screen artwork.
        artwork: [{ src: this.slug === 'index' ? '/info/og.png' : `/info/og/${this.slug}.png`, sizes: '1200x630', type: 'image/png' }],
      });
      ms.setActionHandler('play', () => void this.play());
      ms.setActionHandler('pause', () => this.audio.pause());
      ms.setActionHandler('seekbackward', (d) => { this.audio.currentTime = Math.max(0, this.audio.currentTime - (d.seekOffset ?? 10)); });
      ms.setActionHandler('seekforward', (d) => { this.audio.currentTime = this.audio.currentTime + (d.seekOffset ?? 10); });
      ms.setActionHandler('seekto', (d) => { if (d.seekTime != null) this.audio.currentTime = d.seekTime; });
      ms.setActionHandler('previoustrack', () => this.go(-1));
      ms.setActionHandler('nexttrack', () => this.go(1));
    } catch { /* partial Media Session support: playback is unaffected */ }
    this.cleanups.push(() => {
      try { navigator.mediaSession.metadata = null; } catch { /* fine */ }
    });
  }

  // ── teardown ───────────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try { this.audio.pause(); } catch { /* ignore */ }
    if (this.highlighted) { this.highlighted.classList.remove(HERE_CLASS); this.highlighted = null; }
    document.documentElement.classList.remove(OPEN_CLASS);
    for (const c of this.cleanups) { try { c(); } catch { /* ignore */ } }
    this.cleanups.length = 0;
    this.listeners.clear();
    try { this.audio.removeAttribute('src'); this.audio.load(); } catch { /* ignore */ }
    this.audio.remove();
    // The tap dies with the dock - a closed context releases the element, so a
    // future player instance can tap a fresh <audio> without a stale graph.
    if (this.actx) { void this.actx.close().catch(() => { /* already closed */ }); this.actx = null; this.analyser = null; }
  }
}
