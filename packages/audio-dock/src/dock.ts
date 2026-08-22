// SPDX-License-Identifier: MPL-2.0
// createAudioDock: the reusable, dependency-free audio-dock shell.
//
// ONE draggable/resizable window that can carry TWO coexisting players: a NARRATION
// block (page voice, with its own transport + follow/speed/caption) up top, and the MUSIC
// player below (transport + Music/Effects mixer + Tracks/Atmosphere + a butterchurn
// visualiser). Either block is optional, so a music-only, narration-only, or static host
// all render correctly. The visualiser is the ambient BACKDROP behind the controls. It
// EXPANDS to fullscreen via the header ↗, and its settings (theme, preset, on/off) live
// in a RIGHT-CLICK menu on the dock.
//
// Layered back to front: viz canvas backdrop, then scrim (a darkening wash, NO blur),
// then controls face. All audio is delegated to the injected DockHost; the HOST renders the
// rich visualiser through DockViz.mount, so this file imports NOTHING but its own types +
// stylesheet, and the static /info build can bundle it without the SPA module graph.

import type {
  AudioDockOptions,
  DockCapabilities,
  DockCollapse,
  DockController,
  DockHost,
  DockNarrationPlayer,
  DockNowPlaying,
  DockPlacement,
  DockSectionId,
  DockSource,
  DockVizPreset,
  DockVizTheme,
  DockVizTransition,
} from './types.ts';
import { DOCK_CSS, DOCK_STYLE_ID } from './styles.ts';

// Inline glyphs (currentColor, no external asset). The shell ships no icon
// registry so it stays host-agnostic.
const SVG = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${body}</svg>`;
const ICON = {
  play: SVG('<polygon points="6 3 21 12 6 21 6 3" fill="currentColor"/>'),
  pause: SVG('<rect x="5" y="3" width="5" height="18" rx="1" fill="currentColor"/><rect x="14" y="3" width="5" height="18" rx="1" fill="currentColor"/>'),
  prev: SVG('<polygon points="19 20 9 12 19 4 19 20" fill="currentColor"/><rect x="4" y="4" width="3" height="16" rx="1" fill="currentColor"/>'),
  next: SVG('<polygon points="5 4 15 12 5 20 5 4" fill="currentColor"/><rect x="17" y="4" width="3" height="16" rx="1" fill="currentColor"/>'),
  down: SVG('<polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  caret: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  follow: SVG('<path d="M12 5v14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="m19 12-7 7-7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  close: SVG('<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'),
  // The header ↗: expands the visualiser straight to fullscreen (Fullscreen API).
  expand: SVG('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  // ↙: the header ↗ swaps to this while fullscreen; clicking it exits fullscreen.
  compress: SVG('<path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M8 21v-3a2 2 0 0 0-2-2H3M16 21v-3a2 2 0 0 1 2-2h3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  // repeat = loop the current track; forward = play through the list.
  repeat: SVG('<path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  volume: SVG('<path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  volumeMuted: SVG('<path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor"/><path d="m16 9 5 6M21 9l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  forward: SVG('<path d="M12 12H3M16 6H3M12 18H3M16 6l5 6-5 6V6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  // The viz on/off toggle glyph: a little waveform.
  viz: SVG('<path d="M3 12h2l2-6 3 14 3-11 2 5h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  // A magnifier for the preset search box.
  search: SVG('<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  // The bottom-right resize grip (three diagonal ticks).
  grip: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M14 6L6 14M14 10l-4 4M14 2 2 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

const SECTION_LABEL: Record<DockSectionId, string> = {
  narration: 'Narration',
  music: 'Tracks',
  atmosphere: 'Atmosphere',
};

/** Below this drag distance a pointer press is a click, not a move. */
const DRAG_THRESHOLD = 4;

function prefersReducedMotion(win: Window): boolean {
  try {
    return typeof win.matchMedia === 'function'
      && win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function ensureStyles(doc: Document): void {
  if (doc.getElementById(DOCK_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = DOCK_STYLE_ID;
  style.textContent = DOCK_CSS;
  (doc.head ?? doc.documentElement).appendChild(style);
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));

/**
 * Build a mounted audio dock. Returns a controller; the audio itself lives in the
 * host, so instantiating this never touches an AudioContext.
 */
export function createAudioDock(opts: AudioDockOptions): DockController {
  const maybeDoc = opts.document ?? (typeof document !== 'undefined' ? document : undefined);
  if (!maybeDoc) throw new Error('createAudioDock: no document available (pass options.document)');
  const doc: Document = maybeDoc;
  const win: Window | null = doc.defaultView ?? (typeof window !== 'undefined' ? window : null);
  const raf = win && typeof win.requestAnimationFrame === 'function'
    ? win.requestAnimationFrame.bind(win) : null;
  const caf = win && typeof win.cancelAnimationFrame === 'function'
    ? win.cancelAnimationFrame.bind(win) : null;

  const host: DockHost = opts.host;
  let caps: DockCapabilities = { ...(opts.capabilities ?? {}) };
  let collapse: DockCollapse = opts.collapse ?? 'full';
  const openState: Record<DockSectionId, boolean> = {
    narration: true,
    music: true,
    atmosphere: false,
    ...(opts.openSections ?? {}),
  };

  let destroyed = false;
  let seeking = false;        // main (music) scrub
  let narrSeeking = false;    // narration scrub
  let vizRaf = 0;
  let tickRaf = 0;
  let vizAmp = 0;
  let freqData: Uint8Array<ArrayBuffer> | null = null;
  let framesUnsub: (() => void) | null = null;
  let hostVizActive = false;
  let sourcesBuilt = false;

  // The narration block subscribes independently (it is a second, coexisting player).
  let narrRef: DockNarrationPlayer | null = null;
  let narrUnsub: (() => void) | null = null;

  // ── placement (drag position + per-state window size) ───────────────────────
  const MIN_W = 260;
  const MIN_H = 200;
  const placementStore = opts.placement ?? null;
  let pos: { x: number; y: number } | null = null;
  let fsize: { w: number; h: number } | null = null;
  let esize: { w: number; h: number } | null = null;
  if (placementStore) {
    const p = placementStore.get();
    if (p) {
      if (typeof p.x === 'number' && typeof p.y === 'number') pos = { x: p.x, y: p.y };
      if (typeof p.fw === 'number' && typeof p.fh === 'number') fsize = { w: p.fw, h: p.fh };
      if (typeof p.ew === 'number' && typeof p.eh === 'number') esize = { w: p.ew, h: p.eh };
    }
  }
  function savePlacement(): void {
    if (!placementStore) return;
    const p: DockPlacement = {};
    if (pos) { p.x = pos.x; p.y = pos.y; }
    if (fsize) { p.fw = fsize.w; p.fh = fsize.h; }
    if (esize) { p.ew = esize.w; p.eh = esize.h; }
    placementStore.set(p);
  }

  // Viz picker state (feeds the right-click menu), cached so re-marks don't re-fetch.
  let vizPresets: DockVizPreset[] = [];
  let vizThemes: DockVizTheme[] = [];
  let vizTransitions: DockVizTransition[] = [];
  let vizBuilt = false;
  // The narration block collapses from its own header (like Tracks/Atmosphere). Session
  // state, matching the sections (which also don't persist across reloads).
  let narrBlockOpen = opts.openSections?.narration ?? true;

  let wasFullscreen = false;

  ensureStyles(doc);

  // ── skeleton ────────────────────────────────────────────────────────────────
  const root = doc.createElement('section');
  root.className = 'audio-dock';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Audio player');
  root.innerHTML = `
    <canvas class="audio-dock-viz" data-viz-canvas aria-hidden="true"></canvas>
    <div class="audio-dock-scrim" aria-hidden="true"></div>
    <div class="audio-dock-face">
      <div class="audio-dock-mini" data-drag-mini>
        <button type="button" class="audio-dock-mini-np" data-mini-expand aria-label="Expand player">
          <span class="audio-dock-title" data-mini-title></span>
          <span class="audio-dock-sub" data-mini-sub></span>
        </button>
        <button type="button" class="audio-dock-btn audio-dock-play" data-play-mini aria-label="Play">${ICON.play}</button>
      </div>
      <div class="audio-dock-main">
        <div class="audio-dock-head" data-drag-head>
          <div class="audio-dock-np">
            <div class="audio-dock-title" data-title></div>
            <div class="audio-dock-sub" data-sub></div>
          </div>
          <button type="button" class="audio-dock-btn" data-viz-expand aria-label="Fullscreen visualiser" hidden>${ICON.expand}</button>
          <button type="button" class="audio-dock-btn" data-collapse-btn aria-label="Collapse player">${ICON.down}</button>
          <button type="button" class="audio-dock-btn" data-close-btn aria-label="Close player" hidden>${ICON.close}</button>
        </div>

        <div class="audio-dock-narrblock" data-narrblock data-narrblock-open="true" hidden>
          <div class="audio-dock-narrblock-head">
            <button type="button" class="audio-dock-narrblock-toggle" data-narr-collapse aria-expanded="true" aria-label="Collapse narration">
              <span class="audio-dock-np">
                <span class="audio-dock-title" data-narr-title></span>
                <span class="audio-dock-sub" data-narr-sub></span>
              </span>
              <span class="audio-dock-caret">${ICON.caret}</span>
            </button>
            <button type="button" class="audio-dock-btn audio-dock-play audio-dock-play-sm" data-narr-play aria-label="Play">${ICON.play}</button>
          </div>
          <div class="audio-dock-narrblock-body">
            <div class="audio-dock-scrub">
              <input type="range" data-narr-scrub min="0" max="1000" step="1" value="0" aria-label="Seek within narration">
              <div class="audio-dock-time"><span data-narr-cur>0:00</span><span data-narr-dur>0:00</span></div>
            </div>
            <div class="audio-dock-caption" data-narr-caption aria-live="off"></div>
            <div class="audio-dock-narr-controls">
              <button type="button" class="audio-dock-toggle" data-narr-follow aria-pressed="true">${ICON.follow}<span>Follow along</span></button>
              <label class="audio-dock-speed">Speed <select data-narr-speed aria-label="Playback speed"></select></label>
            </div>
            <p class="audio-dock-disclosure" data-narr-disclosure></p>
          </div>
        </div>

        <div class="audio-dock-vizspace" data-vizspace aria-hidden="true"></div>

        <div class="audio-dock-musicblock" data-musicblock>
          <div class="audio-dock-transport">
            <button type="button" class="audio-dock-btn audio-dock-volbtn" data-vol-btn aria-label="Volume" aria-haspopup="true" aria-expanded="false" hidden>${ICON.volume}</button>
            <button type="button" class="audio-dock-btn" data-prev aria-label="Previous">${ICON.prev}</button>
            <button type="button" class="audio-dock-btn audio-dock-play" data-play aria-label="Play">${ICON.play}</button>
            <button type="button" class="audio-dock-btn" data-next aria-label="Next">${ICON.next}</button>
            <button type="button" class="audio-dock-btn audio-dock-repeat" data-repeat aria-label="Repeat this track" aria-pressed="false" hidden>${ICON.repeat}</button>
          </div>
          <div class="audio-dock-scrub">
            <input type="range" data-scrub min="0" max="1000" step="1" value="0" aria-label="Seek within track">
            <div class="audio-dock-time"><span data-time-cur>0:00</span><span data-time-dur>0:00</span></div>
          </div>
          <div class="audio-dock-volumes" data-volumes></div>
          <div class="audio-dock-sections">
            <section class="audio-dock-section" data-section="narration">
              <button type="button" class="audio-dock-section-head" data-sec-head="narration" aria-expanded="true">
                <span>${SECTION_LABEL.narration}</span><span class="audio-dock-caret">${ICON.caret}</span>
              </button>
              <div class="audio-dock-section-body">
                <div class="audio-dock-caption" data-caption aria-live="off"></div>
                <div class="audio-dock-narr-controls">
                  <button type="button" class="audio-dock-toggle" data-follow aria-pressed="true">${ICON.follow}<span>Follow along</span></button>
                  <label class="audio-dock-speed">Speed <select data-speed aria-label="Playback speed"></select></label>
                </div>
                <p class="audio-dock-disclosure" data-disclosure></p>
              </div>
            </section>
            <section class="audio-dock-section" data-section="music">
              <button type="button" class="audio-dock-section-head" data-sec-head="music" aria-expanded="true">
                <span>${SECTION_LABEL.music}</span><span class="audio-dock-caret">${ICON.caret}</span>
              </button>
              <div class="audio-dock-section-body">
                <input type="search" class="audio-dock-search" data-src-search placeholder="Search tracks…" aria-label="Search tracks" hidden>
                <ul class="audio-dock-list" data-src-list aria-label="Sources"></ul>
                <p class="audio-dock-attr" data-src-attr hidden></p>
              </div>
            </section>
            <section class="audio-dock-section" data-section="atmosphere">
              <button type="button" class="audio-dock-section-head" data-sec-head="atmosphere" aria-expanded="false">
                <span>${SECTION_LABEL.atmosphere}</span><span class="audio-dock-caret">${ICON.caret}</span>
              </button>
              <div class="audio-dock-section-body">
                <div data-atmo-rows></div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
    <div class="audio-dock-volpop" data-volpop hidden role="group" aria-label="Volume">
      <input type="range" class="audio-dock-volrange" data-vol-range min="0" max="1" step="0.01" value="1" aria-label="Volume" aria-orientation="vertical">
      <span class="audio-dock-volpct" data-vol-pct>100%</span>
    </div>
    <div class="audio-dock-vizmenu" data-vizmenu hidden role="menu" aria-label="Visualiser settings">
      <button type="button" class="audio-dock-toggle" data-viz-toggle aria-pressed="true">${ICON.viz}<span>On</span></button>
      <div class="audio-dock-vizmenu-label" data-viz-theme-label hidden>Brand colour</div>
      <div class="audio-dock-viz-themes" data-viz-themes role="group" aria-label="Brand colour scheme"></div>
      <div class="audio-dock-vizmenu-label" data-viz-transition-label hidden>Timing</div>
      <div class="audio-dock-viz-transitions" data-viz-transitions role="group" aria-label="Preset transition timing"></div>
      <div class="audio-dock-vizmenu-label" data-viz-preset-label hidden>Preset</div>
      <label class="audio-dock-viz-searchbox">${ICON.search}<input type="search" class="audio-dock-search" data-viz-search placeholder="Search presets…" aria-label="Search presets"></label>
      <ul class="audio-dock-list audio-dock-viz-presets" data-viz-presets aria-label="Presets"></ul>
    </div>
    <div class="audio-dock-resizers" data-resizers aria-hidden="true">
      <span class="audio-dock-rz audio-dock-rz-n" data-rz="n"></span>
      <span class="audio-dock-rz audio-dock-rz-s" data-rz="s"></span>
      <span class="audio-dock-rz audio-dock-rz-e" data-rz="e"></span>
      <span class="audio-dock-rz audio-dock-rz-w" data-rz="w"></span>
      <span class="audio-dock-rz audio-dock-rz-ne" data-rz="ne"></span>
      <span class="audio-dock-rz audio-dock-rz-nw" data-rz="nw"></span>
      <span class="audio-dock-rz audio-dock-rz-sw" data-rz="sw"></span>
      <span class="audio-dock-rz audio-dock-rz-se" data-rz="se">${ICON.grip}</span>
    </div>`;

  const q = <T extends Element = HTMLElement>(sel: string): T | null => root.querySelector<T>(sel);
  const setText = (sel: string, text: string): void => { const el = q<HTMLElement>(sel); if (el) el.textContent = text; };
  const vizCanvas = q<HTMLCanvasElement>('[data-viz-canvas]')!;
  const scrub = q<HTMLInputElement>('[data-scrub]')!;
  const speedSel = q<HTMLSelectElement>('[data-speed]')!;
  const srcList = q<HTMLUListElement>('[data-src-list]')!;
  const srcSearch = q<HTMLInputElement>('[data-src-search]')!;
  const srcAttr = q<HTMLElement>('[data-src-attr]')!;
  const atmoRows = q<HTMLElement>('[data-atmo-rows]')!;
  const volumesEl = q<HTMLElement>('[data-volumes]')!;
  const volBtn = q<HTMLButtonElement>('[data-vol-btn]');
  const volPop = q<HTMLElement>('[data-volpop]');
  const volRange = q<HTMLInputElement>('[data-vol-range]');
  const vizThemesEl = q<HTMLElement>('[data-viz-themes]')!;
  const vizTransitionsEl = q<HTMLElement>('[data-viz-transitions]')!;
  const vizPresetsEl = q<HTMLElement>('[data-viz-presets]')!;
  const vizSearchEl = q<HTMLInputElement>('[data-viz-search]')!;
  const vizMenu = q<HTMLElement>('[data-vizmenu]')!;
  const narrBlock = q<HTMLElement>('[data-narrblock]')!;
  const narrScrub = q<HTMLInputElement>('[data-narr-scrub]')!;
  const narrSpeedSel = q<HTMLSelectElement>('[data-narr-speed]')!;

  // ── capability gating ─────────────────────────────────────────────────────────
  function hasNarration(): boolean { return !!caps.narration && !!host.narration; }
  function hasPicker(): boolean { return (!!caps.music || !!caps.radio) && !!host.sources; }
  function hasAtmosphere(): boolean { return !!caps.atmosphere && !!host.atmosphere; }
  function hasVizCap(): boolean {
    return !!caps.viz && !!host.viz
      && (typeof host.viz.getAnalyser === 'function'
        || typeof host.viz.subscribeFrames === 'function'
        || typeof host.viz.mount === 'function');
  }
  // A HOST-RENDERED visualiser (butterchurn) with a preset/theme library → the right-click
  // settings menu is available.
  function hasRichViz(): boolean {
    return !!caps.viz && !!host.viz
      && typeof host.viz.mount === 'function' && typeof host.viz.presets === 'function';
  }
  function usesHostRenderer(): boolean {
    return !!caps.viz && !!host.viz && typeof host.viz.mount === 'function';
  }
  function canFullscreen(): boolean {
    return hasVizCap() && !!host.viz && host.viz.supported();
  }
  // ── the two coexisting players ───────────────────────────────────────────────
  function hasMusicCaps(): boolean { return !!caps.music || !!caps.radio || !!caps.atmosphere; }
  function hasNarrationBlock(): boolean { return !!host.narrationBlock; }
  // The MAIN (music/flat) block shows unless the host is a narration-block-only one.
  function showMainBlock(): boolean { return hasMusicCaps() || !hasNarrationBlock(); }
  // What the mini pill + head reflect: the flat host (music) unless this is a narration-
  // block-only dock, in which case the narration player is the primary.
  function primaryPlayer(): { isPlaying(): boolean; togglePlay(): void | Promise<void>; nowPlaying(): DockNowPlaying } {
    if (!showMainBlock() && host.narrationBlock) return host.narrationBlock;
    return host;
  }

  function applyCaps(): void {
    root.toggleAttribute('data-cap-narration', hasNarration());
    root.toggleAttribute('data-cap-music', !!caps.music && !!host.sources);
    root.toggleAttribute('data-cap-radio', !!caps.radio && !!host.sources);
    root.toggleAttribute('data-cap-atmosphere', hasAtmosphere());
    root.toggleAttribute('data-cap-viz', hasVizCap());
    root.toggleAttribute('data-cap-vizmenu', hasRichViz());
    q<HTMLElement>('[data-musicblock]')!.hidden = !showMainBlock();
  }

  // ── geometry helpers (drag + resize + fullscreen) ───────────────────────────
  function vp(): { w: number; h: number } {
    return { w: win?.innerWidth ?? 1024, h: win?.innerHeight ?? 768 };
  }
  function rootSize(): { w: number; h: number } {
    const r = root.getBoundingClientRect();
    return { w: r.width || 320, h: r.height || 200 };
  }
  function clampXY(x: number, y: number, w: number, h: number): { x: number; y: number } {
    const { w: VW, h: VH } = vp();
    return {
      x: Math.max(0, Math.min(x, Math.max(0, VW - w))),
      y: Math.max(0, Math.min(y, Math.max(0, VH - h))),
    };
  }
  function defaultExpanded(): { w: number; h: number } {
    const { w: VW, h: VH } = vp();
    const w = Math.min(560, Math.max(320, Math.round(VW * 0.42)));
    const h = Math.min(Math.round(w * 0.82), Math.max(260, VH - 96));
    return { w, h };
  }
  function setCurrentSize(w: number, h: number): void {
    if (collapse === 'expanded') esize = { w, h };
    else fsize = { w, h };
  }
  function applyWindowSize(): void {
    if (collapse === 'mini') { root.style.width = ''; root.style.height = ''; root.removeAttribute('data-windowed'); return; }
    const base = collapse === 'expanded' ? (esize ?? defaultExpanded()) : fsize;
    if (!base) { root.style.width = ''; root.style.height = ''; root.removeAttribute('data-windowed'); return; }
    const { w: VW, h: VH } = vp();
    const w = Math.min(Math.max(base.w, MIN_W), VW);
    const h = Math.min(Math.max(base.h, MIN_H), VH);
    root.style.width = `${w}px`;
    root.style.height = `${h}px`;
    root.setAttribute('data-windowed', '');
  }
  function resizable(): boolean {
    return !!placementStore && collapse !== 'mini' && !root.hasAttribute('data-fullscreen');
  }
  function applyPosition(): void {
    if (root.hasAttribute('data-fullscreen')) return;
    const { w, h } = rootSize();
    if (pos) {
      const c = clampXY(pos.x, pos.y, w, h);
      root.style.left = `${c.x}px`;
      root.style.top = `${c.y}px`;
      root.style.right = 'auto';
      root.style.bottom = 'auto';
    } else if (collapse === 'expanded') {
      const { w: VW, h: VH } = vp();
      root.style.left = `${Math.max(12, VW - w - 24)}px`;
      root.style.top = `${Math.max(12, Math.round(VH * 0.14))}px`;
      root.style.right = 'auto';
      root.style.bottom = 'auto';
    } else {
      root.style.left = '';
      root.style.top = '';
      root.style.right = '';
      root.style.bottom = '';
    }
  }

  // ── collapse ──────────────────────────────────────────────────────────────────
  function applyCollapse(): void {
    root.setAttribute('data-collapse', collapse);
    const btn = q<HTMLButtonElement>('[data-collapse-btn]');
    if (btn) btn.setAttribute('aria-label', collapse === 'mini' ? 'Minimize player' : 'Collapse player');
    applyWindowSize();
    root.toggleAttribute('data-resizable', resizable());
    applyPosition();
    updateExpandVisibility();
    syncViz();
  }
  const collapseOrder: DockCollapse[] = opts.collapseSizes?.length ? opts.collapseSizes : ['full', 'compact', 'mini'];
  function stepDownCollapse(): void {
    if (collapse === 'expanded') { setCollapse(collapseOrder[0]!); return; }
    const i = collapseOrder.indexOf(collapse);
    const next = i < 0 ? collapseOrder[0]! : collapseOrder[Math.min(i + 1, collapseOrder.length - 1)]!;
    setCollapse(next);
  }
  function updateExpandVisibility(): void {
    const el = q<HTMLButtonElement>('[data-viz-expand]');
    if (!el) return;
    const fs = root.hasAttribute('data-fullscreen');
    el.hidden = !((canFullscreen() || fs) && collapse !== 'mini');
    el.innerHTML = fs ? ICON.compress : ICON.expand;
    el.setAttribute('aria-label', fs ? 'Exit fullscreen' : 'Fullscreen visualiser');
  }

  // ── fullscreen (Fullscreen API on the dock; exit → EXPANDED) ─────────────────
  function goFullscreen(): void {
    const el = root as HTMLElement & { requestFullscreen?: () => Promise<void> };
    if (typeof el.requestFullscreen === 'function') {
      wasFullscreen = true;
      el.requestFullscreen().catch(() => { wasFullscreen = false; setCollapse('expanded'); });
    } else {
      setCollapse('expanded');
    }
  }
  function exitFullscreen(): void {
    if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
      void doc.exitFullscreen().catch(() => { /* closing anyway */ });
    } else {
      root.removeAttribute('data-fullscreen');
      updateExpandVisibility();
      setCollapse('expanded');
    }
  }
  function onFullscreenChange(): void {
    const isFs = doc.fullscreenElement === root;
    root.toggleAttribute('data-fullscreen', isFs);
    if (isFs) wasFullscreen = true;
    else if (wasFullscreen) { wasFullscreen = false; setCollapse('expanded'); }
    root.toggleAttribute('data-resizable', resizable());
    updateExpandVisibility();
    syncViz();
  }

  // ── sections ──────────────────────────────────────────────────────────────────
  function applySections(): void {
    for (const id of ['narration', 'music', 'atmosphere'] as DockSectionId[]) {
      const sec = q<HTMLElement>(`[data-section="${id}"]`);
      const head = q<HTMLElement>(`[data-sec-head="${id}"]`);
      const open = openState[id];
      sec?.setAttribute('data-open', String(open));
      head?.setAttribute('aria-expanded', String(open));
    }
  }

  // ── source picker (music + radio) ──────────────────────────────────────────────
  function rebuildSources(): void {
    if (!hasPicker() || !host.sources) return;
    const render = (rows: DockSource[]): void => {
      if (destroyed) return;
      sourcesBuilt = true;
      const groups: string[] = [];
      const byGroup = new Map<string, DockSource[]>();
      for (const r of rows) {
        const g = r.group ?? (r.kind === 'radio' ? 'Internet Radio' : 'Sources');
        if (!byGroup.has(g)) { byGroup.set(g, []); groups.push(g); }
        byGroup.get(g)!.push(r);
      }
      let html = '';
      for (const g of groups) {
        const isRadio = byGroup.get(g)!.every((r) => r.kind === 'radio');
        if (isRadio && !caps.radio) continue;
        if (!isRadio && !caps.music) continue;
        html += `<li class="audio-dock-group" data-group-head="${esc(g)}">${esc(g)}</li>`;
        for (const r of byGroup.get(g)!) {
          const searchKey = `${r.title} ${r.mood ?? ''}`.toLowerCase();
          html += `<li data-group="${esc(g)}" data-search="${esc(searchKey)}">`
            + `<button type="button" class="audio-dock-src" data-src-id="${esc(r.id)}"`
            + `${r.unavailable ? ' disabled' : ''}>`
            + `<span class="audio-dock-src-name">${esc(r.title)}</span>`
            + (r.mood ? `<span class="audio-dock-src-mood">${esc(r.mood)}</span>` : '')
            + `</button></li>`;
        }
      }
      srcList.innerHTML = html || '<li class="audio-dock-group">No sources</li>';
      srcSearch.hidden = !host.sources?.searchable;
      const attr = host.sources?.attribution?.() ?? null;
      if (attr) {
        srcAttr.innerHTML = `${esc(attr.text)} <a href="${esc(attr.href)}" target="_blank" rel="noopener noreferrer">${esc(attr.linkText)}</a>`;
        srcAttr.hidden = false;
      } else {
        srcAttr.textContent = '';
        srcAttr.hidden = true;
      }
      applySearch();
      paintCurrentSource();
    };
    const out = host.sources.list();
    if (out && typeof (out as Promise<DockSource[]>).then === 'function') {
      void (out as Promise<DockSource[]>).then(render).catch(() => { /* leave empty */ });
    } else {
      render(out as DockSource[]);
    }
  }
  function paintCurrentSource(): void {
    const cur = host.sources?.currentId?.() ?? '';
    for (const b of srcList.querySelectorAll<HTMLElement>('[data-src-id]')) {
      b.setAttribute('aria-current', String(b.dataset.srcId === cur));
    }
  }
  function applySearch(): void {
    const query = (srcSearch.hidden ? '' : srcSearch.value.trim().toLowerCase());
    const shown = new Map<string, number>();
    for (const li of srcList.querySelectorAll<HTMLElement>('li[data-group]')) {
      const g = li.dataset.group ?? '';
      const hit = !query || (li.dataset.search ?? '').includes(query);
      li.hidden = !hit;
      shown.set(g, (shown.get(g) ?? 0) + (hit ? 1 : 0));
    }
    for (const head of srcList.querySelectorAll<HTMLElement>('li[data-group-head]')) {
      head.hidden = (shown.get(head.dataset.groupHead ?? '') ?? 0) === 0;
    }
  }

  // ── volume sliders ───────────────────────────────────────────────────────────
  function rebuildVolumes(): void {
    const vols = host.volumes;
    if (!vols || !vols.length) { volumesEl.innerHTML = ''; return; }
    volumesEl.innerHTML = vols.map((v) =>
      `<label class="audio-dock-vol"><span>${esc(v.label)}</span>`
      + `<input type="range" min="0" max="1" step="0.05" value="${v.get()}" data-vol-id="${esc(v.id)}" aria-label="${esc(v.label)} volume"></label>`,
    ).join('');
  }
  function paintVolumes(): void {
    if (!host.volumes) return;
    const active = doc.activeElement;
    for (const range of volumesEl.querySelectorAll<HTMLInputElement>('[data-vol-id]')) {
      if (range === active) continue;
      const v = host.volumes.find((x) => x.id === range.dataset.volId);
      if (v) range.value = String(v.get());
    }
  }
  function paintRepeat(): void {
    const btn = q<HTMLButtonElement>('[data-repeat]');
    if (!btn) return;
    const show = !!host.repeat && !!caps.music;
    btn.hidden = !show;
    if (!show || !host.repeat) return;
    const repeat = host.repeat.get();
    btn.innerHTML = repeat ? ICON.repeat : ICON.forward;
    btn.classList.toggle('is-active', repeat);
    btn.setAttribute('aria-pressed', String(repeat));
    const label = repeat ? 'Repeat this track' : 'Play through the list';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }

  // ── master volume (speaker button + vertical slider) ─────────────────────────────
  function paintVolume(): void {
    if (!volBtn) return;
    const show = !!host.volume;
    volBtn.hidden = !show;
    if (!show || !host.volume) { closeVolPop(); return; }
    const v = host.volume.get();
    const muted = v <= 0.001;
    volBtn.innerHTML = muted ? ICON.volumeMuted : ICON.volume;
    volBtn.classList.toggle('is-muted', muted);
    const pct = Math.round(v * 100);
    volBtn.setAttribute('aria-label', `Volume ${pct}%`);
    volBtn.setAttribute('title', `Volume ${pct}%`);
    // Don't fight the slider while the user is dragging it.
    if (volRange && doc.activeElement !== volRange) volRange.value = String(v);
    const pctEl = q<HTMLElement>('[data-vol-pct]');
    if (pctEl) pctEl.textContent = `${pct}%`;
  }
  function openVolPop(): void {
    if (!host.volume || !volPop || !volBtn) return;
    paintVolume();
    volPop.hidden = false;
    volBtn.setAttribute('aria-expanded', 'true');
    // Sit centred over the button, clamped inside the dock (root is overflow:hidden).
    const r = root.getBoundingClientRect();
    const b = volBtn.getBoundingClientRect();
    const pw = volPop.offsetWidth || 46;
    const ph = volPop.offsetHeight || 150;
    const x = Math.max(6, Math.min(b.left - r.left + b.width / 2 - pw / 2, r.width - pw - 6));
    const y = Math.max(6, b.top - r.top - ph - 8);
    volPop.style.left = `${x}px`;
    volPop.style.top = `${y}px`;
    volRange?.focus();
  }
  function closeVolPop(): void {
    if (volPop && !volPop.hidden) volPop.hidden = true;
    volBtn?.setAttribute('aria-expanded', 'false');
  }

  // ── atmosphere mixer ────────────────────────────────────────────────────────────
  function rebuildAtmosphere(): void {
    if (!hasAtmosphere() || !host.atmosphere) return;
    const layers = host.atmosphere.layers();
    const groups = host.atmosphere.groups?.() ?? null;
    const order = groups ?? [...new Set(layers.map((l) => l.group ?? ''))];
    let html = '';
    for (const g of order) {
      const items = layers.filter((l) => (l.group ?? '') === g);
      if (!items.length) continue;
      if (g) html += `<div class="audio-dock-group">${esc(g)}</div>`;
      for (const l of items) {
        const v = host.atmosphere.getLevel(l.id);
        html += `<div class="audio-dock-atmo-row${v > 0 ? ' is-on' : ''}" data-atmo-row="${esc(l.id)}">`
          + (l.icon ? `<span class="audio-dock-atmo-icon" aria-hidden="true">${l.icon}</span>` : '')
          + `<span class="audio-dock-atmo-label">${esc(l.label)}</span>`
          + `<input type="range" min="0" max="1" step="0.01" value="${v}" data-atmo-range="${esc(l.id)}" aria-label="${esc(l.label)} level">`
          + `</div>`;
      }
    }
    atmoRows.innerHTML = html;
  }

  // ── visualiser right-click settings menu (on/off + theme + preset) ─────────────
  function vizOn(): boolean {
    if (host.viz?.enabled) { try { return host.viz.enabled(); } catch { return true; } }
    return true;
  }
  function paintVizToggle(): void {
    const btn = q<HTMLButtonElement>('[data-viz-toggle]');
    if (!btn) return;
    btn.hidden = typeof host.viz?.setEnabled !== 'function';
    const on = vizOn();
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Visualiser on' : 'Visualiser off');
    const span = btn.querySelector('span');
    if (span) span.textContent = on ? 'On' : 'Off';
  }
  function paintVizThemes(): void {
    const cur = host.viz?.currentTheme?.() ?? '';
    const label = q<HTMLElement>('[data-viz-theme-label]');
    if (label) label.hidden = !vizThemes.length;
    if (!vizThemes.length) { vizThemesEl.innerHTML = ''; return; }
    vizThemesEl.innerHTML = vizThemes.map((t) =>
      `<button type="button" class="audio-dock-pill${t.id === cur ? ' is-on' : ''}" data-viz-theme="${esc(t.id)}" aria-pressed="${t.id === cur}">${esc(t.name)}</button>`,
    ).join('');
  }
  function paintVizTransitions(): void {
    const cur = host.viz?.currentTransition?.() ?? '';
    const label = q<HTMLElement>('[data-viz-transition-label]');
    if (label) label.hidden = !vizTransitions.length;
    if (!vizTransitions.length) { vizTransitionsEl.innerHTML = ''; return; }
    vizTransitionsEl.innerHTML = vizTransitions.map((t) =>
      `<button type="button" class="audio-dock-pill${t.id === cur ? ' is-on' : ''}" data-viz-transition="${esc(t.id)}" aria-pressed="${t.id === cur}">${esc(t.name)}</button>`,
    ).join('');
  }
  function paintVizPresets(query = ''): void {
    const cur = host.viz?.currentPreset?.() ?? '';
    const label = q<HTMLElement>('[data-viz-preset-label]');
    if (label) label.hidden = !vizPresets.length;
    const qq = query.trim().toLowerCase();
    const rows = vizPresets.filter((p) => !qq
      || p.name.toLowerCase().includes(qq) || (p.group ?? '').toLowerCase().includes(qq));
    if (!rows.length) { vizPresetsEl.innerHTML = '<li class="audio-dock-group">No presets match</li>'; return; }
    vizPresetsEl.innerHTML = rows.map((p) =>
      `<li><button type="button" class="audio-dock-src" data-viz-preset="${esc(p.id)}" aria-current="${p.id === cur}">`
      + `<span class="audio-dock-src-name">${esc(p.name)}</span>`
      + (p.group ? `<span class="audio-dock-src-mood">${esc(p.group)}</span>` : '')
      + `</button></li>`,
    ).join('');
  }
  function markVizCurrent(): void {
    const curP = host.viz?.currentPreset?.() ?? '';
    for (const b of vizPresetsEl.querySelectorAll<HTMLElement>('[data-viz-preset]')) {
      b.setAttribute('aria-current', String(b.dataset.vizPreset === curP));
    }
    const mark = (el: HTMLElement, attr: 'vizTheme' | 'vizTransition', cur: string): void => {
      for (const b of el.querySelectorAll<HTMLElement>(`[data-${attr === 'vizTheme' ? 'viz-theme' : 'viz-transition'}]`)) {
        const on = b.dataset[attr] === cur;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      }
    };
    mark(vizThemesEl, 'vizTheme', host.viz?.currentTheme?.() ?? '');
    mark(vizTransitionsEl, 'vizTransition', host.viz?.currentTransition?.() ?? '');
  }
  async function rebuildVisualiser(): Promise<void> {
    if (!hasRichViz() || !host.viz) return;
    vizBuilt = true;
    paintVizToggle();
    if (typeof host.viz.themes === 'function') {
      try { const t = await Promise.resolve(host.viz.themes()); if (!destroyed) vizThemes = t; } catch { /* keep */ }
      paintVizThemes();
    }
    if (typeof host.viz.transitions === 'function') {
      try { const t = await Promise.resolve(host.viz.transitions()); if (!destroyed) vizTransitions = t; } catch { /* keep */ }
      paintVizTransitions();
    }
    if (typeof host.viz.presets === 'function') {
      try { const p = await Promise.resolve(host.viz.presets()); if (!destroyed) vizPresets = p; } catch { /* keep */ }
      paintVizPresets(vizSearchEl.value);
    }
  }
  function openVizMenu(clientX: number, clientY: number): void {
    if (!hasRichViz()) return;
    // Always refresh so the brand schemes + presets + timing are current (and recover from
    // a slow first load) every time the menu opens.
    void rebuildVisualiser();
    paintVizToggle();
    markVizCurrent();
    vizMenu.hidden = false;
    // Position within the dock (root is overflow:hidden, so the menu scrolls internally).
    const r = root.getBoundingClientRect();
    const mw = vizMenu.offsetWidth || 240;
    const mh = vizMenu.offsetHeight || 240;
    const x = Math.max(6, Math.min(clientX - r.left, r.width - mw - 6));
    const y = Math.max(6, Math.min(clientY - r.top, r.height - mh - 6));
    vizMenu.style.left = `${x}px`;
    vizMenu.style.top = `${y}px`;
    vizSearchEl.focus();
  }
  function closeVizMenu(): void { vizMenu.hidden = true; }

  // ── narration section (FLAT narration host) ────────────────────────────────────
  function rebuildNarration(): void {
    if (!hasNarration() || !host.narration) return;
    const speeds = host.narration.speeds();
    const cur = host.narration.getSpeed();
    speedSel.innerHTML = speeds
      .map((r) => `<option value="${r}"${r === cur ? ' selected' : ''}>${r}×</option>`)
      .join('');
    const disc = q<HTMLElement>('[data-disclosure]');
    if (disc) disc.textContent = host.narration.disclosure?.() ?? '';
  }

  // ── narration BLOCK (coexisting page voice) ────────────────────────────────────
  function rebuildNarrBlock(): void {
    const nb = host.narrationBlock;
    if (!nb) return;
    const speeds = nb.narration.speeds();
    const cur = nb.narration.getSpeed();
    narrSpeedSel.innerHTML = speeds
      .map((r) => `<option value="${r}"${r === cur ? ' selected' : ''}>${r}×</option>`)
      .join('');
  }
  // Collapse the narration block from its own header, like Tracks/Atmosphere fold to their
  // heads. A collapsed block shrinks to its title row, so the viz/free space and the bottom-
  // anchored music controls reflow around it.
  function applyNarrBlockOpen(): void {
    narrBlock.setAttribute('data-narrblock-open', String(narrBlockOpen));
    const btn = q<HTMLButtonElement>('[data-narr-collapse]');
    if (btn) {
      btn.setAttribute('aria-expanded', String(narrBlockOpen));
      btn.setAttribute('aria-label', narrBlockOpen ? 'Collapse narration' : 'Expand narration');
    }
  }
  function updateNarrScrub(): void {
    const nb = host.narrationBlock;
    if (!nb) return;
    const dur = nb.duration ? nb.duration() : 0;
    const finite = Number.isFinite(dur) && dur > 0;
    const seekable = nb.seekable ? nb.seekable() : typeof nb.seek === 'function';
    narrBlock.setAttribute('data-narr-seekable', String(seekable && finite));
    if (!finite) return;
    const t = nb.currentTime ? nb.currentTime() : 0;
    if (!narrSeeking) narrScrub.value = String(Math.round((t / dur) * 1000));
    setText('[data-narr-dur]', fmtTime(dur));
    if (!narrSeeking) setText('[data-narr-cur]', fmtTime(t));
  }
  function paintNarrBlock(): void {
    const nb = host.narrationBlock;
    narrBlock.hidden = !nb;
    if (!nb) return;
    const np = nb.nowPlaying();
    setText('[data-narr-title]', np.title);
    setText('[data-narr-sub]', np.subtitle ?? '');
    const playing = nb.isPlaying();
    const play = q<HTMLButtonElement>('[data-narr-play]');
    if (play) {
      play.innerHTML = playing ? ICON.pause : ICON.play;
      play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      play.setAttribute('aria-pressed', String(playing));
    }
    updateNarrScrub();
    const nar = nb.narration;
    setText('[data-narr-caption]', nar.caption?.() ?? '');
    const follow = q<HTMLButtonElement>('[data-narr-follow]');
    if (follow) follow.setAttribute('aria-pressed', String(nar.getFollow()));
    if (narrSpeedSel.value !== String(nar.getSpeed())) narrSpeedSel.value = String(nar.getSpeed());
    setText('[data-narr-disclosure]', nar.disclosure?.() ?? '');
  }
  // (Re)subscribe to the narration block's own change stream when it appears/changes.
  function syncNarrationSub(): void {
    const nb = host.narrationBlock ?? null;
    if (nb === narrRef) return;
    narrUnsub?.();
    narrUnsub = null;
    narrRef = nb;
    if (nb) { narrUnsub = nb.onChange(refresh); rebuildNarrBlock(); }
  }

  // ── the viz backdrop ─────────────────────────────────────────────────────────────
  function reduceMotion(): boolean {
    if (win && prefersReducedMotion(win)) return true;
    return doc.documentElement.getAttribute('data-a11y-motion') === 'reduce';
  }
  function canRunViz(): boolean {
    return hasVizCap() && !!host.viz && host.viz.supported() && !reduceMotion() && vizOn()
      && (usesHostRenderer() || !!raf);
  }
  function applyVizMode(): void {
    root.setAttribute('data-viz', canRunViz() ? 'live' : 'static');
  }
  function drawViz(): void {
    const cx = vizCanvas.getContext('2d');
    if (!cx) return;
    const dpr = Math.min((win?.devicePixelRatio ?? 1), 2);
    const cw = vizCanvas.clientWidth || 320;
    const ch = vizCanvas.clientHeight || 96;
    const w = Math.max(1, Math.round(cw * dpr));
    const hgt = Math.max(1, Math.round(ch * dpr));
    if (vizCanvas.width !== w) vizCanvas.width = w;
    if (vizCanvas.height !== hgt) vizCanvas.height = hgt;
    cx.clearRect(0, 0, w, hgt);
    const color = (win ? win.getComputedStyle(vizCanvas).color : '') || 'hsl(145 63% 49%)';
    cx.fillStyle = color;
    const analyser = host.viz?.getAnalyser?.() ?? null;
    if (analyser) {
      const n = analyser.frequencyBinCount;
      if (!freqData || freqData.length !== n) freqData = new Uint8Array(n);
      analyser.getByteFrequencyData(freqData);
      const BARS = 28;
      const usable = Math.max(1, n >> 1);
      const gap = Math.max(1, Math.round(dpr));
      const bw = (w - gap * (BARS - 1)) / BARS;
      for (let i = 0; i < BARS; i++) {
        const b0 = Math.floor((i / BARS) * usable);
        const b1 = Math.max(b0 + 1, Math.floor(((i + 1) / BARS) * usable));
        let sum = 0;
        for (let b = b0; b < b1; b++) sum += freqData[b] ?? 0;
        const level = sum / (b1 - b0) / 255;
        const bh = Math.max(dpr, level * hgt);
        cx.globalAlpha = 0.22 + 0.6 * level;
        cx.fillRect(i * (bw + gap), hgt - bh, bw, bh);
      }
    } else {
      const bh = Math.max(2, vizAmp * hgt);
      cx.globalAlpha = 0.16 + 0.5 * vizAmp;
      cx.fillRect(0, hgt - bh, w, bh);
    }
    cx.globalAlpha = 1;
  }
  function syncViz(): void {
    if (destroyed) return;
    applyVizMode();
    if (!canRunViz() || !host.viz) {
      if (vizRaf && caf) { caf(vizRaf); vizRaf = 0; }
      if (framesUnsub) { framesUnsub(); framesUnsub = null; }
      if (hostVizActive) { try { host.viz?.unmount?.(); } catch { /* gone */ } hostVizActive = false; }
      return;
    }
    if (usesHostRenderer()) {
      if (vizRaf && caf) { caf(vizRaf); vizRaf = 0; }
      if (framesUnsub) { framesUnsub(); framesUnsub = null; }
      hostVizActive = true;
      void Promise.resolve(host.viz.mount!(vizCanvas)).catch(() => { /* stays static */ });
      return;
    }
    if (!host.viz.getAnalyser && host.viz.subscribeFrames && !framesUnsub) {
      framesUnsub = host.viz.subscribeFrames((a) => { vizAmp = Math.max(0, Math.min(1, a)); });
    }
    if (vizRaf || !raf) return;
    const loop = (): void => {
      if (destroyed || !canRunViz()) {
        if (vizRaf && caf) caf(vizRaf);
        vizRaf = 0;
        if (framesUnsub) { framesUnsub(); framesUnsub = null; }
        applyVizMode();
        return;
      }
      drawViz();
      vizRaf = raf(loop);
    };
    vizRaf = raf(loop);
  }
  function teardownViz(): void {
    if (vizRaf && caf) caf(vizRaf);
    vizRaf = 0;
    if (framesUnsub) { framesUnsub(); framesUnsub = null; }
    if (hostVizActive) { try { host.viz?.unmount?.(); } catch { /* ignore */ } hostVizActive = false; }
  }

  // ── progress tick (advance both scrubs while EITHER player is sounding) ─────────
  function updateScrub(): void {
    const seekable = host.seekable ? host.seekable() : typeof host.seek === 'function';
    const dur = host.duration ? host.duration() : 0;
    const finite = Number.isFinite(dur) && dur > 0;
    root.setAttribute('data-seekable', String(seekable && finite));
    if (!finite) return;
    const cur = host.currentTime ? host.currentTime() : 0;
    if (!seeking) scrub.value = String(Math.round((cur / dur) * 1000));
    // A block-based narration keeps the position BAR but hides the M:SS labels: it has
    // no clock, so a time readout would be dishonest.
    const showTime = host.showScrubTime !== false;
    const timeEl = q<HTMLElement>('.audio-dock-musicblock .audio-dock-time');
    if (timeEl) timeEl.hidden = !showTime;
    if (!showTime) return;
    setText('[data-time-dur]', fmtTime(dur));
    if (!seeking) setText('[data-time-cur]', fmtTime(cur));
  }
  function anyPlaying(): boolean {
    return host.isPlaying() || (host.narrationBlock?.isPlaying() ?? false);
  }
  function startTick(): void {
    if (tickRaf || !raf) return;
    const loop = (): void => {
      if (destroyed) { tickRaf = 0; return; }
      updateScrub();
      if (host.narrationBlock) updateNarrScrub();
      tickRaf = anyPlaying() ? raf(loop) : 0;
    };
    tickRaf = raf(loop);
  }

  // ── the main repaint ─────────────────────────────────────────────────────────────
  function refresh(): void {
    if (destroyed) return;
    syncNarrationSub();
    applyCaps();   // block visibility can change as sources register/unregister
    // main (music/flat) transport + mini
    const playing = host.isPlaying();
    const mainPlay = q<HTMLButtonElement>('[data-play]');
    if (mainPlay) {
      mainPlay.innerHTML = playing ? ICON.pause : ICON.play;
      mainPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      mainPlay.setAttribute('aria-pressed', String(playing));
    }
    const prim = primaryPlayer();
    const primPlaying = prim.isPlaying();
    const miniPlay = q<HTMLButtonElement>('[data-play-mini]');
    if (miniPlay) {
      miniPlay.innerHTML = primPlaying ? ICON.pause : ICON.play;
      miniPlay.setAttribute('aria-label', primPlaying ? 'Pause' : 'Play');
      miniPlay.setAttribute('aria-pressed', String(primPlaying));
    }
    const np = host.nowPlaying();
    setText('[data-title]', np.title);
    setText('[data-sub]', np.subtitle ?? '');
    const primNp = prim.nowPlaying();
    setText('[data-mini-title]', primNp.title);
    setText('[data-mini-sub]', primNp.subtitle ?? '');

    const prev = q<HTMLButtonElement>('[data-prev]');
    const next = q<HTMLButtonElement>('[data-next]');
    if (prev) {
      prev.hidden = typeof host.prev !== 'function';
      prev.disabled = host.canPrev ? !host.canPrev() : false;
    }
    if (next) {
      next.hidden = typeof host.next !== 'function';
      next.disabled = host.canNext ? !host.canNext() : false;
    }
    paintRepeat();
    paintVolume();
    paintVolumes();
    updateScrub();

    if (hasNarration() && host.narration) {
      setText('[data-caption]', host.narration.caption?.() ?? '');
      const follow = q<HTMLButtonElement>('[data-follow]');
      if (follow) follow.setAttribute('aria-pressed', String(host.narration.getFollow()));
      if (speedSel.value !== String(host.narration.getSpeed())) speedSel.value = String(host.narration.getSpeed());
    }
    if (hasPicker()) {
      if (!sourcesBuilt) rebuildSources();
      else paintCurrentSource();
    }
    if (hasAtmosphere() && host.atmosphere) {
      const active = doc.activeElement;
      for (const row of atmoRows.querySelectorAll<HTMLElement>('[data-atmo-row]')) {
        const id = row.dataset.atmoRow ?? '';
        const v = host.atmosphere.getLevel(id);
        row.classList.toggle('is-on', v > 0);
        const range = row.querySelector<HTMLInputElement>('[data-atmo-range]');
        if (range && range !== active) range.value = String(v);
      }
    }
    if (hasRichViz() && !vizMenu.hidden) { paintVizToggle(); markVizCurrent(); }
    paintNarrBlock();
    if (anyPlaying()) startTick();
    syncViz();
  }

  // ── drag + resize (pointer events) ──────────────────────────────────────────────
  let suppressClickUntil = 0;
  root.addEventListener('click', (e) => {
    if (Date.now() < suppressClickUntil) { e.stopPropagation(); e.preventDefault(); suppressClickUntil = 0; }
  }, true);

  function makeDraggable(handle: HTMLElement, exclude: string): void {
    let start: { px: number; py: number; x: number; y: number; w: number; h: number } | null = null;
    let moved = false;
    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      if (root.hasAttribute('data-fullscreen')) return;
      const t = e.target as HTMLElement;
      if (t.closest?.(exclude)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const r = root.getBoundingClientRect();
      start = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, w: r.width, h: r.height };
      moved = false;
    });
    handle.addEventListener('pointermove', (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.px;
      const dy = e.clientY - start.py;
      if (!moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        moved = true;
        root.classList.add('is-dragging');
        try { handle.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
      }
      const c = clampXY(start.x + dx, start.y + dy, start.w, start.h);
      pos = { x: c.x, y: c.y };
      root.style.left = `${c.x}px`;
      root.style.top = `${c.y}px`;
      root.style.right = 'auto';
      root.style.bottom = 'auto';
    });
    const end = (e: PointerEvent): void => {
      if (!start) return;
      const wasMoved = moved;
      start = null;
      moved = false;
      root.classList.remove('is-dragging');
      try { if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (wasMoved) { suppressClickUntil = Date.now() + 400; savePlacement(); }
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function wireResizeHandle(handle: HTMLElement, dir: string): void {
    let start: { px: number; py: number; x: number; y: number; w: number; h: number } | null = null;
    handle.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!resizable()) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const r = root.getBoundingClientRect();
      start = { px: e.clientX, py: e.clientY, x: r.left, y: r.top, w: r.width, h: r.height };
      root.classList.add('is-resizing');
      try { handle.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
    });
    handle.addEventListener('pointermove', (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.px;
      const dy = e.clientY - start.py;
      let x = start.x;
      let y = start.y;
      let w = start.w;
      let h = start.h;
      if (dir.includes('e')) w = start.w + dx;
      if (dir.includes('s')) h = start.h + dy;
      if (dir.includes('w')) { w = start.w - dx; x = start.x + dx; }
      if (dir.includes('n')) { h = start.h - dy; y = start.y + dy; }
      const { w: VW, h: VH } = vp();
      if (w < MIN_W) { if (dir.includes('w')) x = start.x + (start.w - MIN_W); w = MIN_W; }
      if (h < MIN_H) { if (dir.includes('n')) y = start.y + (start.h - MIN_H); h = MIN_H; }
      w = Math.min(w, VW);
      h = Math.min(h, VH);
      x = Math.max(0, Math.min(x, Math.max(0, VW - w)));
      y = Math.max(0, Math.min(y, Math.max(0, VH - h)));
      setCurrentSize(w, h);
      pos = { x, y };
      root.style.width = `${w}px`;
      root.style.height = `${h}px`;
      root.style.left = `${x}px`;
      root.style.top = `${y}px`;
      root.style.right = 'auto';
      root.style.bottom = 'auto';
      root.setAttribute('data-windowed', '');
    });
    const end = (e: PointerEvent): void => {
      if (!start) return;
      start = null;
      root.classList.remove('is-resizing');
      try { if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      savePlacement();
      if (hostVizActive) host.viz?.resize?.();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  // ── wiring ────────────────────────────────────────────────────────────────────────
  q<HTMLButtonElement>('[data-play]')?.addEventListener('click', () => { void host.togglePlay(); refresh(); });
  q<HTMLButtonElement>('[data-play-mini]')?.addEventListener('click', (e) => { e.stopPropagation(); void primaryPlayer().togglePlay(); refresh(); });
  q<HTMLButtonElement>('[data-prev]')?.addEventListener('click', () => { void host.prev?.(); refresh(); });
  q<HTMLButtonElement>('[data-next]')?.addEventListener('click', () => { void host.next?.(); refresh(); });
  q<HTMLButtonElement>('[data-collapse-btn]')?.addEventListener('click', () => stepDownCollapse());
  q<HTMLButtonElement>('[data-mini-expand]')?.addEventListener('click', () => setCollapse('full'));
  q<HTMLButtonElement>('[data-viz-expand]')?.addEventListener('click', () => {
    if (root.hasAttribute('data-fullscreen')) exitFullscreen();
    else goFullscreen();
  });
  q<HTMLButtonElement>('[data-close-btn]')?.addEventListener('click', () => opts.onClose?.());
  q<HTMLButtonElement>('[data-repeat]')?.addEventListener('click', () => {
    if (host.repeat) host.repeat.set(!host.repeat.get());
    refresh();
  });
  volBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (volPop?.hidden) openVolPop(); else closeVolPop();
  });
  volRange?.addEventListener('input', () => {
    host.volume?.set(Number(volRange.value));
    paintVolume();
  });
  volRange?.addEventListener('change', () => host.volume?.commit?.(Number(volRange.value)));
  srcSearch.addEventListener('input', () => applySearch());
  volumesEl.addEventListener('input', (e) => {
    const range = (e.target as HTMLElement).closest?.<HTMLInputElement>('[data-vol-id]');
    if (!range) return;
    host.volumes?.find((v) => v.id === range.dataset.volId)?.set(Number(range.value));
  });
  volumesEl.addEventListener('change', (e) => {
    const range = (e.target as HTMLElement).closest?.<HTMLInputElement>('[data-vol-id]');
    if (!range) return;
    host.volumes?.find((v) => v.id === range.dataset.volId)?.commit?.(Number(range.value));
  });

  // main (music) scrub
  scrub.addEventListener('pointerdown', () => { seeking = true; });
  scrub.addEventListener('change', () => {
    const dur = host.duration ? host.duration() : 0;
    if (Number.isFinite(dur) && dur > 0 && typeof host.seek === 'function') host.seek((Number(scrub.value) / 1000) * dur);
    seeking = false;
  });
  scrub.addEventListener('input', () => {
    const dur = host.duration ? host.duration() : 0;
    if (Number.isFinite(dur)) setText('[data-time-cur]', fmtTime((Number(scrub.value) / 1000) * dur));
  });

  // narration block: collapse from its header, play / scrub / follow / speed
  q<HTMLButtonElement>('[data-narr-collapse]')?.addEventListener('click', () => {
    narrBlockOpen = !narrBlockOpen;
    applyNarrBlockOpen();
  });
  q<HTMLButtonElement>('[data-narr-play]')?.addEventListener('click', (e) => { e.stopPropagation(); void host.narrationBlock?.togglePlay(); refresh(); });
  narrScrub.addEventListener('pointerdown', () => { narrSeeking = true; });
  narrScrub.addEventListener('change', () => {
    const nb = host.narrationBlock;
    const dur = nb?.duration ? nb.duration() : 0;
    if (nb && Number.isFinite(dur) && dur > 0 && typeof nb.seek === 'function') nb.seek((Number(narrScrub.value) / 1000) * dur);
    narrSeeking = false;
  });
  narrScrub.addEventListener('input', () => {
    const nb = host.narrationBlock;
    const dur = nb?.duration ? nb.duration() : 0;
    if (Number.isFinite(dur)) setText('[data-narr-cur]', fmtTime((Number(narrScrub.value) / 1000) * dur));
  });
  q<HTMLButtonElement>('[data-narr-follow]')?.addEventListener('click', () => {
    const nar = host.narrationBlock?.narration;
    if (nar) nar.setFollow(!nar.getFollow());
    refresh();
  });
  narrSpeedSel.addEventListener('change', () => { host.narrationBlock?.narration.setSpeed(Number(narrSpeedSel.value)); });

  for (const head of root.querySelectorAll<HTMLButtonElement>('[data-sec-head]')) {
    head.addEventListener('click', () => toggleSection(head.dataset.secHead as DockSectionId));
  }
  q<HTMLButtonElement>('[data-follow]')?.addEventListener('click', () => {
    if (host.narration) host.narration.setFollow(!host.narration.getFollow());
    refresh();
  });
  speedSel.addEventListener('change', () => { host.narration?.setSpeed(Number(speedSel.value)); });

  srcList.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest?.<HTMLElement>('[data-src-id]');
    if (!btn || btn.hasAttribute('disabled')) return;
    void host.sources?.select(btn.dataset.srcId ?? '');
    refresh();
  });
  atmoRows.addEventListener('input', (e) => {
    const range = (e.target as HTMLElement).closest?.<HTMLInputElement>('[data-atmo-range]');
    if (!range) return;
    host.atmosphere?.setLevel(range.dataset.atmoRange ?? '', Number(range.value));
    range.closest('[data-atmo-row]')?.classList.toggle('is-on', Number(range.value) > 0);
  });

  // ── visualiser right-click menu ────────────────────────────────────────────────
  // Right-click the dock's PASSIVE surface (backdrop / chrome, never a control) → the viz
  // settings menu. Scoped so it never hijacks the native menu over a button/list/slider.
  root.addEventListener('contextmenu', (e) => {
    if (!hasRichViz()) return;
    const t = e.target as HTMLElement;
    if (t.closest?.('button, input, select, a, [data-src-id], [data-atmo-row], [data-vizmenu]')) return;
    e.preventDefault();
    openVizMenu(e.clientX, e.clientY);
  });
  q<HTMLButtonElement>('[data-viz-toggle]')?.addEventListener('click', () => {
    host.viz?.setEnabled?.(!vizOn());
    paintVizToggle();
    syncViz();
  });
  vizThemesEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest?.<HTMLElement>('[data-viz-theme]');
    if (!b) return;
    host.viz?.selectTheme?.(b.dataset.vizTheme ?? '');
    markVizCurrent();
  });
  vizTransitionsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest?.<HTMLElement>('[data-viz-transition]');
    if (!b) return;
    host.viz?.selectTransition?.(b.dataset.vizTransition ?? '');
    markVizCurrent();
  });
  vizPresetsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest?.<HTMLElement>('[data-viz-preset]');
    if (!b) return;
    host.viz?.selectPreset?.(b.dataset.vizPreset ?? '');
    markVizCurrent();
  });
  vizSearchEl.addEventListener('input', () => paintVizPresets(vizSearchEl.value));
  // Click-away closes the menu.
  root.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    if (!vizMenu.hidden && !t.closest?.('[data-vizmenu]')) closeVizMenu();
    if (volPop && !volPop.hidden && !t.closest?.('[data-volpop]') && !t.closest?.('[data-vol-btn]')) closeVolPop();
  }, true);

  // Escape: close an open popover; else step the dock down. Root-scoped (no global hijack).
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!vizMenu.hidden) { e.stopPropagation(); closeVizMenu(); return; }
    if (volPop && !volPop.hidden) { e.stopPropagation(); closeVolPop(); volBtn?.focus(); return; }
    if (collapse !== 'mini' && !root.hasAttribute('data-fullscreen')) { e.stopPropagation(); stepDownCollapse(); }
  });

  makeDraggable(q<HTMLElement>('[data-drag-head]')!, 'button, input, select, a, [data-scrub]');
  makeDraggable(q<HTMLElement>('[data-drag-mini]')!, '[data-play-mini]');
  for (const h of root.querySelectorAll<HTMLElement>('[data-rz]')) {
    wireResizeHandle(h, h.dataset.rz ?? 'se');
  }

  // Keep the viz backing store matched to the canvas's displayed size × dpr (crisp when
  // enlarged), on any size change. Debounced to one animation frame.
  let vizRoAf = 0;
  let vizRo: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function' && raf) {
    vizRo = new ResizeObserver(() => {
      if (vizRoAf) return;
      vizRoAf = raf(() => { vizRoAf = 0; if (hostVizActive) host.viz?.resize?.(); });
    });
    vizRo.observe(vizCanvas);
  }

  doc.addEventListener('fullscreenchange', onFullscreenChange);
  const onWinResize = (): void => { applyWindowSize(); applyPosition(); };
  win?.addEventListener('resize', onWinResize);

  // ── controller methods ──────────────────────────────────────────────────────────
  function setCapabilities(next: DockCapabilities): void {
    caps = { ...next };
    applyCaps();
    sourcesBuilt = false;
    rebuildNarration();
    rebuildSources();
    rebuildAtmosphere();
    void rebuildVisualiser();
    updateExpandVisibility();
    syncViz();
    refresh();
  }
  function setCollapse(size: DockCollapse): void {
    const changed = collapse !== size;
    collapse = size;
    applyCollapse();
    if (changed) opts.onCollapse?.(size);
  }
  function getCollapse(): DockCollapse { return collapse; }
  function toggleSection(id: DockSectionId, open?: boolean): void {
    openState[id] = open ?? !openState[id];
    applySections();
  }
  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    unsub();
    listUnsub?.();
    narrUnsub?.();
    teardownViz();
    vizRo?.disconnect();
    if (vizRoAf && caf) caf(vizRoAf);
    doc.removeEventListener('fullscreenchange', onFullscreenChange);
    win?.removeEventListener('resize', onWinResize);
    if (tickRaf && caf) caf(tickRaf);
    tickRaf = 0;
    root.remove();
  }

  // ── boot ────────────────────────────────────────────────────────────────────────
  const closeBtn = q<HTMLButtonElement>('[data-close-btn]');
  if (closeBtn) closeBtn.hidden = typeof opts.onClose !== 'function';
  applyCaps();
  applyCollapse();
  applySections();
  applyNarrBlockOpen();
  rebuildNarration();
  rebuildSources();
  rebuildAtmosphere();
  rebuildVolumes();
  void rebuildVisualiser();
  const unsub = host.onChange(refresh);
  const listUnsub = host.sources?.onListChange?.(rebuildSources) ?? null;
  syncNarrationSub();
  refresh();
  syncViz();

  if (opts.mount) opts.mount.appendChild(root);

  return { el: root, setCapabilities, setCollapse, getCollapse, toggleSection, refresh, destroy };
}
