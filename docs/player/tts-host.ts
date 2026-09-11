// SPDX-License-Identifier: MPL-2.0
/**
 * Device-voice narration `DockHost` for the docs (plan 131 B.3).
 *
 * The counterpart to narration-host.ts. That host plays a committed `.opus` baked
 * by Kokoro; this one speaks the page with the reader's OWN device voice via
 * `window.speechSynthesis`, so a Listen pill can sit on EVERY docs page - every
 * locale, the reference pages, the generated side-doors - none of which has (or
 * needs) produced audio. It is what makes the apps' dropped narration (the ~30 MB
 * of .opus the binary excludes, plan 131 B.3 / vite-embed.mjs) still speak, and it
 * extends Listen to the wave languages at zero produced bytes: the OS voice speaks
 * whatever `<html lang>` says.
 *
 * HONEST DEGRADATION (plan 131 B.3): speechSynthesis has no Web Audio graph, so
 * there is no analyser and the dock's frequency backdrop stays quiet (viz
 * unsupported). There is no fixed timeline, so there is no scrub bar (not seekable);
 * navigation is by block/chapter (click a heading). Follow-along is block-level:
 * each block is its own utterance, so the active block is known from its onstart
 * without needing word-boundary events (those aren't fired on every platform). Speed
 * maps to utterance.rate, which is pitch-preserving - the slow-down-costs-nothing
 * promise holds.
 *
 * ISOLATION: imports nothing from shells/web - only the DOM extractor beside it and
 * the dock contract (a relative path, esbuild-bundled by docs/build.ts).
 */
import type { DockHost, DockNarration, DockNowPlaying, DockViz, DockVolume } from '../../packages/audio-dock/src/index.ts';
import { extractDomSpokenText, type DomBlock } from './dom-spoken-text.ts';

/** Speeds + default, shared with the produced-audio host (1.25× default). */
const SPEEDS: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SPEED_DEFAULT_IDX = SPEEDS.indexOf(1.25);
/** Same follow-along + open classes the produced host uses, so docs-player.css
 *  styles both identically (highlight, chapter-seek cursor). */
const HERE_CLASS = 'docs-narr-here';
const OPEN_CLASS = 'docs-narr-open';
const IDLE_MS = 4000;
const DISCLOSURE = 'Read aloud by your device’s voice. The page text is the original.';
/** Shared prefs with the produced host, so a listener's choices carry across both. */
const FOLLOW_KEY = 'lolly-docs-follow-off';
const SPEED_KEY = 'lolly-docs-speed-v3';
const VOLUME_KEY = 'lolly-docs-volume';

const reduced = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface CreateDocsTtsOpts {
  slug: string;
  title: string;
  /** The reader's content node (the in-app #/docs reader renders into its own node,
   *  not the live .docs-content). Omit on the static site. */
  contentRoot?: HTMLElement;
}

/**
 * Build the device-voice host for the current page, or null when it can't run: no
 * speechSynthesis (some webkitgtk builds - the Linux Tauri gap, which will get a
 * native speech-dispatcher command), or a page with nothing speakable. The caller
 * then mounts no dock, exactly as it does for a slug with no produced audio.
 */
export function createDocsTtsHost(opts: CreateDocsTtsOpts): DocsTtsHost | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    return null;
  }
  const blocks = extractDomSpokenText(opts.title, opts.contentRoot);
  if (!blocks.length) return null;
  const host = new DocsTtsHost(blocks, opts.title);
  host.start();
  return host;
}

export class DocsTtsHost implements DockHost {
  readonly narration: DockNarration;
  readonly viz: DockViz;
  readonly volume: DockVolume;
  /** The scrub bar shows position through the blocks, but there is no clock behind
   *  device voice, so the dock hides the M:SS labels (plan 131 B.3 honesty). */
  readonly showScrubTime = false;

  private vol = 1;
  private readonly blocks: DomBlock[];
  private readonly title: string;
  private readonly listeners = new Set<() => void>();
  private readonly cleanups: Array<() => void> = [];

  private idx = 0;
  private speedIdx = SPEED_DEFAULT_IDX;
  private finished = false;
  private destroyed = false;
  /** Bumped on every (re)start so a cancelled utterance's late onend/onstart,
   *  which fire asynchronously, are ignored instead of advancing a stale queue. */
  private gen = 0;

  private highlighted: HTMLElement | null = null;
  private followOff = false;
  private suspended = false;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private autoUntil = 0;

  constructor(blocks: DomBlock[], title: string) {
    this.blocks = blocks;
    this.title = title;

    try { this.followOff = sessionStorage.getItem(FOLLOW_KEY) === '1'; } catch { /* storage may be disabled */ }
    try {
      const savedIdx = SPEEDS.indexOf(Number(sessionStorage.getItem(SPEED_KEY)));
      if (savedIdx >= 0) this.speedIdx = savedIdx;
    } catch { /* storage may be disabled */ }
    try {
      const savedVol = Number(sessionStorage.getItem(VOLUME_KEY));
      if (Number.isFinite(savedVol) && savedVol >= 0 && savedVol <= 1) this.vol = savedVol;
    } catch { /* storage may be disabled */ }

    this.narration = {
      getFollow: () => !this.followOff,
      setFollow: (on) => this.setFollow(on),
      getSpeed: () => SPEEDS[this.speedIdx]!,
      setSpeed: (rate) => this.setSpeed(rate),
      speeds: () => SPEEDS,
      caption: () => this.blocks[this.idx]?.block.text ?? '',
      disclosure: () => DISCLOSURE,
    };
    this.volume = {
      id: 'master',
      label: 'Volume',
      get: () => this.vol,
      set: (v) => {
        this.vol = Math.max(0, Math.min(1, v));
        try { sessionStorage.setItem(VOLUME_KEY, String(this.vol)); } catch { /* best effort */ }
        // speechSynthesis has no live volume control; re-queue the rest at the new level.
        if (this.isPlaying() || (speechSynthesis.speaking && speechSynthesis.paused)) this.speakFrom(this.idx);
        this.emit();
      },
    };
    // No Web Audio graph behind speechSynthesis: report the visualiser unsupported so
    // the dock shows its static ground and never starts a reaction loop it can't feed.
    this.viz = { supported: () => false };
  }

  start(): void {
    document.documentElement.classList.add(OPEN_CLASS);
    this.wireFollowAlong();
    this.wireHeadingSeek();
    // A same-tab navigation (or tab close) must not leave the voice talking over the
    // next page; browsers vary on auto-cancel, so do it explicitly.
    const onHide = (): void => { try { speechSynthesis.cancel(); } catch { /* fine */ } };
    addEventListener('pagehide', onHide);
    this.cleanups.push(() => removeEventListener('pagehide', onHide));
    // getVoices() is populated asynchronously on some browsers; re-emit when it arrives
    // so a voice chosen mid-play reflects, and so the first play picks a real voice.
    const onVoices = (): void => this.emit();
    try { speechSynthesis.addEventListener('voiceschanged', onVoices); } catch { /* older API */ }
    this.cleanups.push(() => { try { speechSynthesis.removeEventListener('voiceschanged', onVoices); } catch { /* fine */ } });
  }

  // ── DockHost: transport ──────────────────────────────────────────────────────

  isPlaying(): boolean {
    try { return speechSynthesis.speaking && !speechSynthesis.paused; } catch { return false; }
  }

  async togglePlay(): Promise<void> {
    try {
      if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); this.emit(); return; }
      if (speechSynthesis.speaking && speechSynthesis.paused) { speechSynthesis.resume(); this.emit(); return; }
    } catch { /* fall through to a fresh start */ }
    await this.play();
  }

  /** Start (or restart) speaking from the current block. */
  async play(): Promise<void> {
    if (this.finished) { this.finished = false; this.idx = 0; }
    this.speakFrom(this.idx);
    this.emit();
  }

  // Block-based scrub: the bar tracks position through the page's blocks (no timeline).
  // duration = block count, currentTime = the active block, seek jumps to a block.
  seekable(): boolean { return this.blocks.length > 1; }
  duration(): number { return this.blocks.length; }
  currentTime(): number { return this.idx; }
  seek(n: number): void {
    const at = Math.max(0, Math.min(Math.round(n), this.blocks.length - 1));
    this.finished = false;
    this.speakFrom(at);
    this.emit();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  nowPlaying(): DockNowPlaying {
    return { title: this.title, subtitle: 'Device voice', kind: 'narration' };
  }

  // ── speech queue ───────────────────────────────────────────────────────────────

  private speakFrom(from: number): void {
    this.gen++;
    const myGen = this.gen;
    try { speechSynthesis.cancel(); } catch { /* nothing queued */ }
    this.idx = Math.max(0, Math.min(from, this.blocks.length - 1));
    const rate = SPEEDS[this.speedIdx]!;
    const voice = this.pickVoice();
    const lang = document.documentElement.lang || 'en';
    for (let i = this.idx; i < this.blocks.length; i++) {
      const u = new SpeechSynthesisUtterance(this.blocks[i]!.block.text);
      u.rate = rate;
      u.volume = this.vol;
      u.lang = lang;
      if (voice) u.voice = voice;
      u.onstart = (): void => {
        if (myGen !== this.gen || this.destroyed) return;
        this.idx = i;
        this.highlight(i);
        this.emit();
      };
      u.onend = (): void => {
        if (myGen !== this.gen || this.destroyed) return;
        if (i === this.blocks.length - 1) { this.finished = true; this.clearHighlight(); this.emit(); }
      };
      try { speechSynthesis.speak(u); } catch { /* a queue push can throw mid-teardown */ }
    }
  }

  private pickVoice(): SpeechSynthesisVoice | null {
    let voices: SpeechSynthesisVoice[] = [];
    try { voices = speechSynthesis.getVoices(); } catch { /* not ready */ }
    if (!voices.length) return null; // let the platform pick its default this pass
    const lang = (document.documentElement.lang || 'en').toLowerCase();
    const base = lang.split('-')[0]!;
    return (
      voices.find((v) => v.lang.toLowerCase() === lang) ??
      voices.find((v) => { const l = v.lang.toLowerCase(); return l === base || l.startsWith(`${base}-`); }) ??
      voices.find((v) => v.default) ??
      voices[0] ??
      null
    );
  }

  private setSpeed(rate: number): void {
    const idx = SPEEDS.indexOf(rate);
    if (idx < 0) return;
    this.speedIdx = idx;
    try { sessionStorage.setItem(SPEED_KEY, String(rate)); } catch { /* best effort */ }
    // speechSynthesis has no live rate control: re-queue the rest at the new rate.
    if (this.isPlaying() || (speechSynthesis.speaking && speechSynthesis.paused)) this.speakFrom(this.idx);
    this.emit();
  }

  // ── follow-along highlight (same visual contract as the produced host) ───────────

  private highlight(i: number): void {
    const el = this.blocks[i]?.el ?? null;
    if (this.highlighted && this.highlighted !== el) this.highlighted.classList.remove(HERE_CLASS);
    this.highlighted = el;
    if (!el) return;
    el.classList.add(HERE_CLASS);
    if (this.following()) this.drift();
  }

  private clearHighlight(): void {
    if (this.highlighted) { this.highlighted.classList.remove(HERE_CLASS); this.highlighted = null; }
  }

  private following(): boolean {
    return !this.followOff && !this.suspended && !reduced();
  }

  private drift(): void {
    if (!this.following() || !this.highlighted) return;
    this.autoUntil = performance.now() + 1600;
    this.highlighted.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
  }

  private setFollow(on: boolean): void {
    this.followOff = !on;
    try {
      if (on) sessionStorage.removeItem(FOLLOW_KEY);
      else sessionStorage.setItem(FOLLOW_KEY, '1');
    } catch { /* storage disabled: opt-out lasts this page only */ }
    if (on) { this.suspended = false; this.drift(); }
    this.emit();
  }

  private wireFollowAlong(): void {
    const userScroll = (): void => {
      if (reduced() || this.followOff) return;
      this.suspended = true;
      if (performance.now() <= this.autoUntil) {
        this.autoUntil = 0;
        window.scrollTo({ top: window.scrollY, behavior: 'auto' });
      }
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => { this.suspended = false; if (this.isPlaying()) this.drift(); }, IDLE_MS);
    };
    const onScroll = (): void => { if (performance.now() > this.autoUntil) userScroll(); };
    const onKeyNav = (e: KeyboardEvent): void => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) userScroll();
    };
    addEventListener('wheel', userScroll, { passive: true });
    addEventListener('touchmove', userScroll, { passive: true });
    addEventListener('keydown', onKeyNav);
    addEventListener('scroll', onScroll, { passive: true });
    this.cleanups.push(() => {
      removeEventListener('wheel', userScroll);
      removeEventListener('touchmove', userScroll);
      removeEventListener('keydown', onKeyNav);
      removeEventListener('scroll', onScroll);
      if (this.idleTimer) clearTimeout(this.idleTimer);
    });
  }

  /** Click a heading to start reading from there (chapter seek); click the current
   *  highlight to re-engage follow-along. No scrub bar, so this IS the seek. */
  private wireHeadingSeek(): void {
    const onClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement | null;
      const h = target?.closest?.('h1[id],h2[id],h3[id],h4[id]') as HTMLElement | null;
      if (h) {
        const at = this.blocks.findIndex((b) => b.el === h);
        if (at >= 0) { this.finished = false; this.speakFrom(at); this.emit(); }
        return;
      }
      if (this.highlighted && target?.closest?.(`.${HERE_CLASS}`)) {
        this.suspended = false;
        this.setFollow(true);
        this.drift();
      }
    };
    document.addEventListener('click', onClick);
    this.cleanups.push(() => document.removeEventListener('click', onClick));
  }

  private emit(): void {
    if (this.destroyed) return;
    for (const l of this.listeners) { try { l(); } catch { /* one bad listener never blocks the rest */ } }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.gen++; // orphan any in-flight utterance callbacks
    try { speechSynthesis.cancel(); } catch { /* already idle */ }
    this.clearHighlight();
    document.documentElement.classList.remove(OPEN_CLASS);
    for (const c of this.cleanups) { try { c(); } catch { /* ignore */ } }
    this.cleanups.length = 0;
    this.listeners.clear();
  }
}
