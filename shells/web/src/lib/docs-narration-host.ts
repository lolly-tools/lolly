// SPDX-License-Identifier: MPL-2.0
/**
 * Narration `DockHost` adapter for the IN-APP documentation reader (#/docs/<slug>).
 *
 * This is the first MIGRATION increment of the unified audio-dock effort (plan
 * "this-is-a-very-sparkling-eich", Phase 2): it drives the shared
 * @lolly-tools/audio-dock shell from the app context, validating the `DockHost`
 * contract against REAL committed narration audio. It is ADDITIVE - the reader
 * had no player before - so nothing existing breaks.
 *
 * It deliberately reuses the LOGIC of docs/player/player.ts (the static-site
 * player) without touching it: same /info/audio-index.json resolution, same
 * per-block cues.json for the caption + follow-along highlight, same speed model
 * (SPEEDS, 1.25× default). What it does NOT do:
 *   - a live AudioContext viz tap is created lazily on first play (for the dock's
 *     own frequency backdrop) - the dock owns the drawing; we only expose the node.
 *   - prev/next: narration is PER-PAGE here. Stepping across narrated pages would
 *     mean SPA navigation from inside the adapter, which the increment forbids, so
 *     the host defines no next/prev and the dock hides those buttons (see report).
 *
 * ENGLISH-ONLY: all committed audio is English (urls under /info/audio/en/…), and
 * the follow-along block map is re-derived from the ENGLISH markdown twin, so the
 * caller must only mount this on an English reader page. If a slug has no entry in
 * audio-index.json, `createDocsNarrationHost` returns null and the caller mounts
 * NOTHING (the "no dead affordance" rule).
 *
 * The spoken-text extraction below is a browser-safe PORT of the pure functions in
 * scripts/lib/docs-spoken-text.ts. That module is imported here NOT by reference
 * for two reasons: it lives outside the web shell's tsconfig `include`, and it
 * imports `node:crypto` at top level (for its staleness hash, `spokenTextHash`),
 * which cannot bundle for the browser. Only the pure block extraction is needed,
 * so it is copied verbatim (minus the hash) and kept in lockstep by eye - the
 * canonical copy stays scripts/lib/docs-spoken-text.ts.
 */
import type { DockHost, DockNarration, DockNarrationPlayer, DockNowPlaying, DockViz, DockVolume } from '@lolly-tools/audio-dock';
import { prefersReducedMotion } from './a11y-prefs.ts';

// ── ported spoken-text extraction (see file header) ──────────────────────────

interface SpokenBlock {
  blockId: string;
  kind: 'heading' | 'para' | 'listItem';
  level?: number;
  text: string;
}

/** Does a leading H1 merely restate the page title? (scripts/lib/docs-spoken-text.ts) */
function isMetaTitle(spoken: string, pageTitle: string): boolean {
  const title = pageTitle.trim().replace(/\s+/g, ' ');
  if (!title) return false;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(\\s*[-–-:]\\s+.+)?$`, 'i').test(spoken);
}

/** docs/build.ts's headingId, duplicated verbatim (parity pinned by the pipeline). */
function headingId(text: string, ordinal: number): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `section-${ordinal}`;
}

/** Inline markdown → the words a narrator says. */
function speakInline(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\bhttps?:\/\/([^/\s)\]"'>]+)[^\s)\]"'>]*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract the ordered spoken-text blocks from a docs page's markdown source. */
function extractSpokenText(markdown: string, pageTitle: string): SpokenBlock[] {
  const lines = markdown.split('\n');
  const out: SpokenBlock[] = [];
  let headingOrdinal = 0;
  let sectionId = 'intro';
  let paraIndex = 0;
  let inFence = false;
  let i = 0;

  const push = (kind: SpokenBlock['kind'], text: string, level?: number): void => {
    const spoken = speakInline(text);
    if (!spoken) return;
    if (kind === 'heading') {
      if (out.length === 0 && level === 1 && pageTitle && isMetaTitle(spoken, pageTitle)) {
        headingOrdinal++;
        return;
      }
      headingOrdinal++;
      sectionId = headingId(spoken, headingOrdinal);
      paraIndex = 0;
      out.push({ blockId: sectionId, kind, level, text: spoken });
    } else {
      paraIndex++;
      out.push({ blockId: `${sectionId}:p${paraIndex}`, kind, text: spoken });
    }
  };

  while (i < lines.length) {
    const line = lines[i]!;
    const fence = /^\s*```(.*)$/.exec(line);
    if (fence) {
      if (!inFence && fence[1]!.trim() !== 'narrate-skip') push('para', 'Code example omitted.');
      inFence = !inFence;
      i++;
      continue;
    }
    if (inFence) { i++; continue; }
    if (/^\s*%(?:file|entity|act|detail|sig)\{/.test(line)) { i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const prev = out[out.length - 1];
      if (!prev || prev.kind === 'heading') push('para', 'Table omitted.');
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i]!)) i++;
      continue;
    }
    if (/^\s*:::/.test(line) || /^-{3,}$/.test(line.trim())) { i++; continue; }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) { push('heading', heading[2]!, heading[1]!.length); i++; continue; }
    const item = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    if (item) { push('listItem', item[1]!); i++; continue; }
    if (line.trim() === '') { i++; continue; }
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i]!;
      if (l.trim() === '' || /^\s*```/.test(l) || /^#{1,4}\s/.test(l)
        || /^\s*(?:[-*]|\d+\.)\s+/.test(l) || /^\s*\|.*\|\s*$/.test(l)
        || /^\s*:::/.test(l) || /^-{3,}$/.test(l.trim())
        || /^\s*%(?:file|entity|act|detail|sig)\{/.test(l)) break;
      para.push(l.replace(/^\s*>\s?/, ''));
      i++;
    }
    push('para', para.join(' '));
  }
  return out;
}

/**
 * Map narrated blockIds onto the reader's rehosted `.docs-content` DOM. Headings
 * carry their blockId as the element `id` by construction; paragraphs/list items
 * are matched by text against the section's flow, forward from the last match, so
 * one unmapped block can't derail the section. Adapted from docs/player/player.ts's
 * buildBlockMap, but SCOPED to the reader's fragment (`root`) rather than the whole
 * document - the app has other content around the reader.
 */
function buildBlockMap(blocks: SpokenBlock[], root: HTMLElement): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  const flow = Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li'));
  const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();
  let cursor = 0;
  for (const b of blocks) {
    if (b.kind === 'heading') {
      const el = root.querySelector<HTMLElement>(`#${CSS.escape(b.blockId)}`);
      if (el && root.contains(el)) {
        map.set(b.blockId, el);
        const idx = flow.indexOf(el);
        if (idx >= 0) cursor = idx + 1;
      }
      continue;
    }
    const want = norm(b.text).slice(0, 40);
    if (!want) continue;
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

// ── the adapter ──────────────────────────────────────────────────────────────

interface Cue { blockId: string; start: number; end: number }
interface Track { slug: string; title: string; url: string; duration: number; bytes: number }

/** Playback speeds + default, identical to docs/player/player.ts (1.25× default,
 *  range 0.5×–2×: narration is to learn from, so the control leans slower). */
const SPEEDS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_DEFAULT_IDX = SPEEDS.indexOf(1.25);
/** The follow-along highlight class - styled in styles/parts/docs.css. */
const HERE_CLASS = 'docs-narr-here';
/** Scroll-idle grace before follow-along re-engages after a user scroll. */
const IDLE_MS = 4000;
const DISCLOSURE = 'AI narration. The page text is the original.';

export interface DocsNarrationHandle {
  /** The narration player the caller registers into the app-global audio dock as its
   *  narration BLOCK (a DocsNarrationHost satisfies DockNarrationPlayer verbatim). */
  host: DockNarrationPlayer;
  /** Tear down: stop audio, remove listeners + the <audio> element, close the tap. */
  destroy(): void;
}

/**
 * Resolve the narration track for a reader slug and, if one exists, build a
 * `DockHost` for it. Returns null when the slug has no committed audio - the
 * caller then mounts no dock (content gate). English-only: the caller must gate on
 * an English reader page before calling (the audio and the block map are English).
 */
export async function createDocsNarrationHost(opts: {
  slug: string;
  contentRoot: HTMLElement;
  /** Fallback page title; the audio-index title wins when present. */
  title?: string;
}): Promise<DocsNarrationHandle | null> {
  const index = await fetch('/info/audio-index.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []) as Track[];
  const list = Array.isArray(index) ? index : [];
  const track = list.find((t) => t.slug === opts.slug);
  if (!track) return null; // no audio for this slug → caller mounts nothing

  const host = new DocsNarrationHost(track, opts.contentRoot, opts.title ?? track.title);
  host.start();
  return { host, destroy: () => host.destroy() };
}

class DocsNarrationHost implements DockHost {
  readonly narration: DockNarration;
  readonly viz: DockViz;
  readonly volume: DockVolume;

  private readonly track: Track;
  private readonly root: HTMLElement;
  private readonly audio: HTMLAudioElement;
  private readonly title: string;
  private readonly listeners = new Set<() => void>();
  private readonly cleanups: Array<() => void> = [];

  private cues: Cue[] = [];
  private cueIdx = -1;
  private captionText = '';
  private blockMap = new Map<string, HTMLElement>();
  private blockText = new Map<string, string>();
  private highlighted: HTMLElement | null = null;

  private speedIdx = SPEED_DEFAULT_IDX;

  // Follow-along: `followOff` is the dock toggle; `suspended` is the instant,
  // temporary loss to a user scroll (re-engages after IDLE_MS of scroll-idle).
  private followOff = false;
  private suspended = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Scroll events before this timestamp are our own drift, not the user's. */
  private autoUntil = 0;

  // The live audio tap for the dock's viz backdrop (created lazily on first play,
  // a user gesture, so the AudioContext starts running). The audio is same-origin,
  // so the MediaElementSource tap involves no CORS and no taint.
  private actx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  private destroyed = false;

  constructor(track: Track, root: HTMLElement, title: string) {
    this.track = track;
    this.root = root;
    this.title = title;
    // preservesPitch keeps the voice natural at every rate (a pace choice, never a
    // quality downgrade). Browsers default this true; set it so the promise holds.
    this.audio = Object.assign(new Audio(), { preservesPitch: true });
    this.audio.src = track.url;
    this.audio.preload = 'auto';
    this.audio.playbackRate = SPEEDS[this.speedIdx]!;

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
      set: (v) => { this.audio.volume = Math.max(0, Math.min(1, v)); this.emit(); },
    };
    // The dock draws its OWN 2D frequency backdrop - supported() gates that loop,
    // which a Canvas 2D context always satisfies. getAnalyser() is null until the
    // tap is created (first play); the dock then shows the static ground and
    // starts reacting the moment the node appears.
    this.viz = {
      supported: () => true,
      getAnalyser: () => this.analyser,
    };
  }

  /** Wire the audio element, mount it (so its captions <track> is in the document
   *  for AT), and kick off the non-blocking sidecar fetches. */
  start(): void {
    const a = this.audio;
    const onPlay = (): void => { this.startMeterHint(); this.emit(); };
    const onPause = (): void => this.emit();
    const onTimeUpdate = (): void => this.onTime();
    const onEnded = (): void => this.emit(); // per-page: no auto-advance, just stop
    const onDur = (): void => this.emit();
    const onSeeked = (): void => { this.cueIdx = -1; this.onTime(); };
    const onMeta = (): void => this.emit();
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('timeupdate', onTimeUpdate);
    a.addEventListener('ended', onEnded);
    a.addEventListener('durationchange', onDur);
    a.addEventListener('seeked', onSeeked);
    a.addEventListener('loadedmetadata', onMeta);
    this.cleanups.push(() => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('timeupdate', onTimeUpdate);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('durationchange', onDur);
      a.removeEventListener('seeked', onSeeked);
      a.removeEventListener('loadedmetadata', onMeta);
    });

    // captions.vtt as a first-class <track> - programmatic value (textTracks API
    // for AT/extensions/UAs); the dock's caption line is the visible surface.
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

    this.wireFollowAlong();
    this.wireHeadingSeek();
    this.loadSidecars();
  }

  // ── DockHost: transport ──────────────────────────────────────────────────────

  isPlaying(): boolean { return !this.audio.paused && !this.audio.ended; }

  async togglePlay(): Promise<void> {
    if (this.audio.paused) {
      this.ensureTap();
      try { await this.audio.play(); } catch { /* blocked: stay paused, visibly */ }
    } else {
      this.audio.pause();
    }
  }

  currentTime(): number { return this.audio.currentTime || 0; }

  duration(): number {
    const d = this.audio.duration;
    return Number.isFinite(d) && d > 0 ? d : (this.track.duration || 0);
  }

  seekable(): boolean { return true; }

  seek(seconds: number): void {
    this.audio.currentTime = Math.max(0, seconds);
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── DockHost: now-playing ────────────────────────────────────────────────────

  nowPlaying(): DockNowPlaying {
    return { title: this.title, subtitle: 'AI narration', kind: 'narration' };
  }

  // ── narration internals ──────────────────────────────────────────────────────

  private emit(): void {
    if (this.destroyed) return;
    for (const l of this.listeners) { try { l(); } catch { /* one bad listener never blocks the rest */ } }
  }

  private setSpeed(rate: number): void {
    const idx = SPEEDS.indexOf(rate);
    if (idx < 0) return; // only curated stops
    this.speedIdx = idx;
    this.audio.playbackRate = SPEEDS[idx]!;
    this.emit();
  }

  private setFollow(on: boolean): void {
    this.followOff = !on;
    if (on) { this.suspended = false; this.drift(); }
    this.emit();
  }

  /** Follow-along is live: on, not opted out, not mid-suspension, not reduced motion. */
  private following(): boolean {
    return !this.followOff && !this.suspended && !prefersReducedMotion();
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
    this.highlighted.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }

  /** The reader scrolls the document (html is the scroller; body grows with #view),
   *  so follow-along listens on window - a user gesture suspends the anchor, and
   *  after IDLE_MS of scroll-idle it re-engages and drifts back. */
  private wireFollowAlong(): void {
    const userScroll = (): void => {
      if (prefersReducedMotion() || this.followOff) return;
      this.suspended = true;
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

  /** Click a heading with a cue to jump the narration there; click the current
   *  highlight to re-engage follow-along. Scoped to the reader's fragment. */
  private wireHeadingSeek(): void {
    const onClick = (e: MouseEvent): void => {
      const h = (e.target as HTMLElement | null)?.closest?.('h1[id],h2[id],h3[id],h4[id]') as HTMLElement | null;
      if (h) {
        const cue = this.cues.find((c) => c.blockId === h.id);
        if (cue) { this.audio.currentTime = cue.start; void this.togglePlayIfPaused(); }
        return;
      }
      if (this.highlighted && (e.target as HTMLElement | null)?.closest?.(`.${HERE_CLASS}`)) {
        this.suspended = false;
        this.setFollow(true);
        this.drift();
      }
    };
    this.root.addEventListener('click', onClick);
    this.cleanups.push(() => this.root.removeEventListener('click', onClick));
  }

  private async togglePlayIfPaused(): Promise<void> {
    if (this.audio.paused) {
      this.ensureTap();
      try { await this.audio.play(); } catch { /* blocked: stay paused */ }
    }
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

    // The audio-index title is the same string the pipeline stamped, so the
    // meta-title skip lands identically here and the blockIds stay in lockstep
    // with cues.json.
    void fetch(`/info/${this.track.slug}.md`)
      .then((r) => (r.ok ? r.text() : null))
      .then((md) => {
        if (!md || this.destroyed) return;
        const blocks = extractSpokenText(md, this.track.title);
        for (const b of blocks) this.blockText.set(b.blockId, b.text);
        this.blockMap = buildBlockMap(blocks, this.root);
        // A cue may already be showing; refresh its caption/highlight now the map exists.
        this.cueIdx = -1;
        this.onTime();
      })
      .catch(() => { /* unmapped: dock still plays, caption may be empty */ });
  }

  // ── the viz tap ──────────────────────────────────────────────────────────────

  /** Create the AudioContext tap on first use. A tapped MediaElementSource mutes
   *  the element's direct output, so it is reconnected to the destination FIRST - 
   *  the narration stays audible whatever happens after. Idempotent; a failure
   *  leaves the element playing untapped (no viz, narration unaffected). */
  private ensureTap(): void {
    if (this.actx) {
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

  /** No-op placeholder: the dock owns the rAF that reads the analyser. Kept as the
   *  seam where a future app-side meter could hook the same tap. */
  private startMeterHint(): void { /* dock-driven */ }

  // ── teardown ───────────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try { this.audio.pause(); } catch { /* ignore */ }
    if (this.highlighted) { this.highlighted.classList.remove(HERE_CLASS); this.highlighted = null; }
    for (const c of this.cleanups) { try { c(); } catch { /* ignore */ } }
    this.cleanups.length = 0;
    this.listeners.clear();
    try { this.audio.removeAttribute('src'); this.audio.load(); } catch { /* ignore */ }
    this.audio.remove();
    if (this.actx) { void this.actx.close().catch(() => { /* already closed */ }); this.actx = null; this.analyser = null; }
  }
}
