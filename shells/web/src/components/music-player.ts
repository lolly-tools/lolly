// SPDX-License-Identifier: MPL-2.0
/**
 * Music-player body for Neurospicy Mode - now-playing meter, prev/play-pause/next
 * transport, a SEARCHABLE track dropdown (type to filter), and volume. Used both
 * in the Sound-settings popover and (chiefly) in the bottom-right toast dock
 * (neuro-dock.ts) that follows you across views while the mode is on.
 *
 * The level meter reads the analyser on the focus-loop audio graph, so it only
 * reacts to our LOCAL songs (zzfxm/opus); a radio stream plays outside that graph
 * and shows no meter. Self-styling; build with musicPlayerBodyHtml(), wire once in
 * the DOM with wireMusicPlayerBody(), and repaint on external state changes
 * (master mute, mode toggle) with paintMusicPlayer().
 */
import {
  getNeurospicy, setNeurospicyLoop, setNeurospicyVolume, listLoops, isNeurospicyPlaying,
  toggleNeurospicyPlay, cycleNeurospicyLoop, setNeurospicyRepeat,
  getNeurospicyAnalyser, getNeurospicyProgress, seekNeurospicy, neurospicySignalState,
  trackCategory, NEURO_CATEGORY_ORDER,
  type NeurospicyHost, type NeuroTrack,
} from '../lib/neurospicy.ts';
import {
  ATMOSPHERE_LAYERS, ATMOSPHERE_GROUPS, getAtmosphere, atmosphereLevel, activeAtmosphereCount,
  setAtmosphereLevel, toggleAtmosphereLayer, setAtmospherePanelOpen,
  type AmbienceKind,
} from '../lib/atmosphere.ts';
import { getSfxVolume, setSfxVolume } from '../lib/sfx.ts';
import { drawMeterBars, drawMeterBaseline } from '../lib/audio-meter.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { SOMAFM_HOME } from '../lib/radio.ts';
import { escape } from '../utils.ts';
// The transport glyphs come from the shared registry, so this player and the catalog's
// audio preview cannot drift into looking like different controls.
import { icon, hasIcon } from '../lib/icons.ts';

const PLAY = icon('play', { size: 18, filled: true });
const PAUSE = icon('pause', { size: 18, filled: true });

const PREV = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 5h2v14H6zM20 5.5v13a1 1 0 0 1-1.53.85l-9-6.5a1 1 0 0 1 0-1.7l9-6.5A1 1 0 0 1 20 5.5z"/></svg>`;
const NEXT = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M16 5h2v14h-2zM4 5.5v13a1 1 0 0 0 1.53.85l9-6.5a1 1 0 0 0 0-1.7l-9-6.5A1 1 0 0 0 4 5.5z"/></svg>`;
const CARET = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
// The two playback-order modes the little toggle (right of the transport) flips
// between: REPEAT = loop the current track; FORWARD = play through the list.
const REPEAT = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
const FORWARD = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/><path d="m16 12 5 3-5 3v-6Z"/></svg>`;

const STYLE_ID = 'lolly-music-player-styles';
const CSS = `
.neuro-player { display: flex; flex-direction: column; gap: 10px; }
.neuro-meter { width: 100%; height: 24px; display: block; border-radius: calc(var(--radius) * .6); background: hsl(var(--muted) / .5); color: hsl(var(--primary)); }
/* Very thin progress + skip-to bar under the meter. Hidden for internet radio (a
   live stream has no duration to seek within). */
.neuro-progress { position: relative; height: 4px; margin-top: -4px; border-radius: calc(var(--radius) * .6); background: hsl(var(--muted) / .5); cursor: pointer; touch-action: none; }
.neuro-progress[hidden] { display: none; }
/* Invisible hit extender: the bar stays 4px visually but accepts taps ±10px around
   it (it is the only seek surface, and a bare 4px strip is untappable on touch). */
.neuro-progress::before { content: ''; position: absolute; inset: -10px 0; }
.neuro-progress-fill { position: absolute; inset: 0 auto 0 0; width: 0%; background: hsl(var(--primary)); border-radius: inherit; }
.neuro-progress:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; }
/* position:relative so the tiny mode toggle can pin to the right edge while
   prev/play/next stay optically centred. */
.neuro-transport { position: relative; display: flex; align-items: center; justify-content: center; gap: 16px; }
.neuro-tbtn { width: 30px; height: 30px; border-radius: calc(var(--radius)*2); border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: hsl(var(--muted-foreground)); transition: color .15s ease, transform .1s ease; }
.neuro-tbtn:hover { color: hsl(var(--foreground)); }
.neuro-tbtn:active { transform: scale(.9); }
.neuro-tbtn.neuro-play { width: 42px; height: 42px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.neuro-tbtn.neuro-play:hover { filter: brightness(1.08); color: hsl(var(--primary-foreground)); }
.neuro-tbtn:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; }
/* The very small repeat/forward toggle, pinned to the right of the transport. */
.neuro-tbtn.neuro-mode { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 26px; height: 26px; }
.neuro-tbtn.neuro-mode:active { transform: translateY(-50%) scale(.9); }
.neuro-tbtn.neuro-mode.is-active { color: hsl(var(--primary)); }
/* searchable track picker - a flex item in the dock header row (grip · picker · min · close) */
.neuro-picker { flex: 1; min-width: 0; }
.neuro-picker-btn { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: 1px solid hsl(var(--border)); border-radius: var(--radius); background: hsl(var(--card)); color: hsl(var(--foreground)); font-size: .85rem; cursor: pointer; text-align: left; }
.neuro-picker-btn:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; }
.neuro-picker-cur { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.neuro-picker-caret { flex: 0 0 auto; color: hsl(var(--muted-foreground)); transition: transform .15s ease; }
.neuro-picker[data-open="true"] .neuro-picker-caret { transform: rotate(180deg); }
.neuro-chip { flex: 0 0 auto; font-size: .62rem; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; padding: 2px 7px; border-radius: 999px; background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); }
.neuro-picker-panel { position: absolute; left: 0; right: 0; bottom: calc(100% + 6px); z-index: 5; display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid hsl(var(--border)); border-radius: var(--radius); background: hsl(var(--popover, var(--card))); box-shadow: 0 8px 28px rgb(0 0 0 / .28); }
.neuro-picker-panel[hidden] { display: none; }
.neuro-search { width: 100%; padding: 7px 10px; border: 1px solid hsl(var(--border)); border-radius: var(--radius); background: hsl(var(--background)); color: hsl(var(--foreground)); font-size: .82rem; }
.neuro-search:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 1px; }
/* As tall as fits above the bottom-docked player without clipping the viewport top
   (the panel opens upward): grows with screen height but never dominates it. Low
   floor (120px) so it genuinely SHRINKS on short viewports, and a 52vh cap so it
   never runs too tall - it always scrolls the overflow. */
.neuro-list { list-style: none; margin: 0; padding: 0; max-height: clamp(120px, calc(100vh - 360px), 52vh); overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
.neuro-cat { list-style: none; }
.neuro-cat[hidden] { display: none; }
.neuro-cat-head { display: flex; align-items: center; gap: 8px; width: 100%;     padding: 22px 8px 8px 0px; border: none; background: transparent; color: hsl(var(--muted-foreground)); font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; cursor: pointer; border-radius: var(--radius); }
.neuro-cat-emoji { flex: 0 0 auto; font-size: 1.05rem; line-height: 1; }
.neuro-cat-head:hover { color: hsl(var(--foreground)); background: hsl(var(--muted) / .5); }
.neuro-cat-head:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: -2px; }
.neuro-cat-caret { display: inline-flex; transition: transform .15s ease; }
.neuro-cat.is-collapsed .neuro-cat-caret { transform: rotate(-90deg); }
.neuro-cat-count { margin-left: auto; font-weight: 600; opacity: .6; }
.neuro-cat-tracks { list-style: none; margin: 0 0 4px; padding: 0; display: flex; flex-direction: column; gap: 1px; }
.neuro-cat.is-collapsed .neuro-cat-tracks { display: none; }
.neuro-warn { display: inline-flex; color: hsl(var(--muted-foreground)); cursor: help; border: none; background: transparent; padding: 0; }
.neuro-warn:hover, .neuro-warn:focus-visible { color: hsl(var(--foreground)); }
.neuro-warn:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; border-radius: var(--radius); }
.neuro-warn svg { width: 13px; height: 13px; }
@media (prefers-reduced-motion: reduce) { .neuro-cat-caret { transition: none; } }
html[data-a11y-motion="reduce"] .neuro-cat-caret { transition: none; }
.neuro-track { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: none; border-radius: var(--radius); background: transparent; color: hsl(var(--foreground)); font-size: .82rem; text-align: left; cursor: pointer; transition: background .12s ease; }
.neuro-track:hover { background: hsl(var(--muted)); }
.neuro-track[aria-current="true"] { background: hsl(var(--primary) / .14); font-weight: 600; }
.neuro-track[hidden] { display: none; }
.neuro-track-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: var(--radius); background: hsl(var(--muted-foreground) / .5); }
.neuro-track[aria-current="true"] .neuro-track-dot { background: hsl(var(--primary)); }
.neuro-track-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.neuro-track-mood { flex: 0 0 auto; font-size: .62rem; text-transform: uppercase; letter-spacing: .02em; color: hsl(var(--muted-foreground)); }
.neuro-empty { padding: 8px 10px; font-size: .8rem; color: hsl(var(--muted-foreground)); }
/* ── Atmosphere: the collapsed-by-default background-noise mixer at the bottom of
   the player. One line per bed (icon · label · slider), sized so all seven rows
   still leave the dock a player rather than a mixing desk. */
.neuro-atmo { border-top: 1px solid hsl(var(--border) / .6); padding-top: 8px; }
.neuro-atmo-head { display: flex; align-items: center; gap: 7px; width: 100%; padding: 3px 2px; border: none; background: transparent; color: hsl(var(--muted-foreground)); font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; cursor: pointer; border-radius: var(--radius); }
.neuro-atmo-head:hover { color: hsl(var(--foreground)); }
.neuro-atmo-head:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; }
.neuro-atmo-caret { display: inline-flex; transition: transform .15s ease; transform: rotate(-90deg); }
.neuro-atmo[data-open="true"] .neuro-atmo-caret { transform: none; }
/* Count of layers currently turned up - the only cue that something is sounding
   while the section is folded away. */
.neuro-atmo-count { margin-left: auto; font-size: .7rem; font-weight: 700; letter-spacing: 0; text-transform: none; color: hsl(var(--primary)); }
.neuro-atmo-count[hidden] { display: none; }
/* Seven rows on top of a full player can push the bottom-docked panel off the top
   of a short viewport, so the rows scroll rather than growing the dock without
   limit. Tall screens still show all seven without a scrollbar. */
.neuro-atmo-rows { display: flex; flex-direction: column; gap: 1px; padding-top: 4px; max-height: min(40vh, 250px); overflow-y: auto; }
.neuro-atmo-rows[hidden] { display: none; }
.neuro-atmo-group { padding: 6px 2px 2px; font-size: .62rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: hsl(var(--muted-foreground) / .75); }
.neuro-atmo-group:first-child { padding-top: 0; }
.neuro-atmo-row { display: flex; align-items: center; gap: 8px; padding: 1px 0; }
.neuro-atmo-icon { flex: 0 0 auto; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border: none; border-radius: calc(var(--radius) * .8); background: hsl(var(--muted) / .6); color: hsl(var(--muted-foreground)); cursor: pointer; transition: background .12s ease, color .12s ease, transform .1s ease; }
.neuro-atmo-icon svg { width: 14px; height: 14px; }
.neuro-atmo-icon:hover { color: hsl(var(--foreground)); }
.neuro-atmo-icon:active { transform: scale(.9); }
.neuro-atmo-icon:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; }
.neuro-atmo-row.is-on .neuro-atmo-icon { background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.neuro-atmo-label { flex: 0 0 6.6em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .74rem; color: hsl(var(--muted-foreground)); }
.neuro-atmo-row.is-on .neuro-atmo-label { color: hsl(var(--foreground)); }
.neuro-atmo-row input[type="range"] { flex: 1; min-width: 0; }
@media (prefers-reduced-motion: reduce) { .neuro-atmo-caret, .neuro-atmo-icon { transition: none; } }
html[data-a11y-motion="reduce"] :is(.neuro-atmo-caret, .neuro-atmo-icon) { transition: none; }
.neuro-vol { display: flex; align-items: center; gap: 9px; font-size: .8rem; color: hsl(var(--muted-foreground)); }
.neuro-vol span { flex: 0 0 3.4em; }
.neuro-vol input[type="range"] { flex: 1; }
/* The Internet Radio info tooltip - a real, INTERACTIVE tooltip (the SomaFM link
   inside is clickable), portalled to <body> as position:fixed so the scrolling
   track list can't clip it. Hidden = opacity 0 + pointer-events none (never a
   display:none, so it can fade and be measured for positioning). */
.neuro-warn-tip { position: fixed; left: 0; top: 0; z-index: 2147483000; max-width: 224px; padding: 9px 12px; border: 1px solid hsl(var(--border)); border-radius: var(--radius); background: hsl(var(--popover, var(--card))); color: hsl(var(--foreground)); font-size: .72rem; line-height: 1.45; box-shadow: 0 10px 30px rgb(0 0 0 / .32); opacity: 0; pointer-events: none; transition: opacity .12s ease; }
.neuro-warn-tip.is-shown { opacity: 1; pointer-events: auto; }
.neuro-warn-tip a { color: hsl(var(--primary)); text-decoration: underline; font-weight: 600; }
.neuro-warn-tip a:hover { text-decoration: none; }
@media (prefers-reduced-motion: reduce) { .neuro-tbtn, .neuro-track, .neuro-picker-caret, .neuro-warn-tip { transition: none; } }
/* The app's own preference (data-a11y-motion, lib/a11y-prefs.ts) repeats each
   transition-killing rule above: parts/base.css deliberately does NOT zero
   transitions globally, so every component that tames its own has to honour
   both signals. Attribute absent ⇒ nothing matches. */
html[data-a11y-motion="reduce"] :is(.neuro-tbtn, .neuro-track, .neuro-picker-caret, .neuro-warn-tip) { transition: none; }`;

function ensureStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

const WARN = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`;

// ── Category info tooltip (a real, interactive tooltip - not a native title) ──
// Currently only the Internet Radio group uses it: it carries the SomaFM
// attribution + support link (which radio.ts asks us to keep in the UI) and the
// "needs a connection" note. One shared element on <body>, position:fixed so the
// scrolling track list never clips it, pointer-events:auto (with a short close
// delay + its own hover keep-alive) so the link is actually clickable.
const WARN_TIP_HTML: Record<string, string> = {
  radio: `Internet radio streams via <a href="${SOMAFM_HOME}" target="_blank" rel="noopener noreferrer">SomaFM</a> - free &amp; listener-supported. Needs an internet connection.`,
};
let warnTip: HTMLElement | null = null;
let warnTipTimer: ReturnType<typeof setTimeout> | undefined;
function ensureWarnTip(): HTMLElement {
  if (warnTip) return warnTip;
  const tip = document.createElement('div');
  tip.className = 'neuro-warn-tip';
  tip.setAttribute('role', 'tooltip');
  tip.addEventListener('mouseenter', () => clearTimeout(warnTipTimer)); // keep open to click the link
  tip.addEventListener('mouseleave', () => hideWarnTip());
  window.addEventListener('scroll', () => hideWarnTip(0), true); // don't strand it when the list scrolls
  document.body.appendChild(tip);
  warnTip = tip;
  return tip;
}
function showWarnTip(anchor: HTMLElement): void {
  const html = WARN_TIP_HTML[anchor.dataset.mpWarn ?? ''] ?? escape(anchor.getAttribute('aria-label') ?? '');
  if (!html) return;
  const tip = ensureWarnTip();
  clearTimeout(warnTipTimer);
  if (tip.dataset.html !== html) { tip.innerHTML = html; tip.dataset.html = html; }
  const r = anchor.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const left = Math.max(8, Math.min(Math.round(r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8));
  let top = Math.round(r.top - th - 8);
  if (top < 8) top = Math.round(r.bottom + 8); // flip below when there's no room above
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tip.classList.add('is-shown');
}
function hideWarnTip(delay = 140): void {
  clearTimeout(warnTipTimer);
  warnTipTimer = setTimeout(() => warnTip?.classList.remove('is-shown'), delay);
}

// Display metadata for the track-list groups. The ORDER comes from the library
// (NEURO_CATEGORY_ORDER) - the same order listLoops sorts into and prev/next walk - 
// so what you read here is what "next" plays. Only labels/icons live in the UI.
// The "Catalog" group is the brand catalog's OTHER audio (not the built-in focus
// sets) - e.g. the licensed music beds; it leads the list and is only rendered at
// all when the catalog ships such audio. Every group starts folded (it still
// expands on click, and while searching).
const CATEGORY_META: Record<string, { label: string; icon: string; warn?: string }> = {
  catalog: { label: 'Catalogue', icon: '🗂️' },
  uploads: { label: 'Uploads', icon: '📤' },
  lolly: { label: 'Lolly Sings', icon: '🍭' },
  ambient: { label: 'Ambient', icon: '🌊' },
  beats: { label: 'Beats', icon: '🥁' },
  radio: { label: 'Internet Radio', icon: '📻', warn: 'Internet radio, via SomaFM - needs an internet connection' },
};

/** Friendly mood label from a track's tags (for the now-playing + list chips). */
export function trackMood(tags: string[]): string {
  if (tags.includes('ambient')) return 'ambient';
  if (tags.includes('beat') || tags.includes('rhythm')) return 'beat';
  if (tags.includes('melodic')) return 'melodic';
  if (tags.includes('radio') || tags.includes('stream')) return 'radio';
  if (tags.includes('lofi')) return 'lo-fi';
  if (tags.includes('generated')) return 'generated';
  return '';
}

/** The repeat/forward toggle's markup - icon + labels reflect the current mode. */
function modeButtonHtml(): string {
  const repeat = getNeurospicy().repeat;
  const label = repeat ? 'Repeat this track' : 'Play through the list';
  return `<button type="button" class="neuro-tbtn neuro-mode${repeat ? ' is-active' : ''}" data-mp-mode`
    + ` aria-pressed="${repeat}" title="${label}" aria-label="${label}">${repeat ? REPEAT : FORWARD}</button>`;
}

/** Sync the mode toggle's icon/label/state to state.repeat (called on every paint). */
function paintModeButton(root: ParentNode): void {
  const btn = root.querySelector<HTMLButtonElement>('[data-mp-mode]');
  if (!btn) return;
  const repeat = getNeurospicy().repeat;
  btn.innerHTML = repeat ? REPEAT : FORWARD;
  btn.classList.toggle('is-active', repeat);
  btn.setAttribute('aria-pressed', String(repeat));
  const label = repeat ? 'Repeat this track' : 'Play through the list';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
}

/** The searchable track picker. Mounted in the dock header row (neuro-dock.ts) so
 *  the now-playing track name doubles as the player's title - no separate label. */
export function trackPickerHtml(): string {
  ensureStyles();
  return `<div class="neuro-picker" data-mp-picker data-open="false">
        <button type="button" class="neuro-picker-btn" data-mp-picker-btn aria-haspopup="true" aria-expanded="false" aria-label="Choose track">
          <span class="neuro-picker-cur" data-mp-current>Loading beats…</span>
          <span class="neuro-chip" data-mp-mood hidden></span>
          <span class="neuro-picker-caret">${CARET}</span>
        </button>
        <div class="neuro-picker-panel" data-mp-panel hidden>
          <!-- Search sits UNDER the list: the panel is bottom-anchored (it opens upward
               from the docked player), so results shrinking only moves the panel's TOP
               edge - the search box stays put instead of jumping as you type. -->
          <ul class="neuro-list" data-mp-list aria-label="Tracks"><li class="neuro-empty">Loading…</li></ul>
          <input type="search" class="neuro-search" data-mp-search placeholder="Search tracks…" aria-label="Search tracks">
        </div>
      </div>`;
}

/** Which optional parts of the body to render. Everything defaults to ON, so the
 *  dock's `musicPlayerBodyHtml()` call is unchanged; the visualizer popout turns the
 *  extras off because it has its own (a full-screen visualizer IS the level meter,
 *  and it hosts music volume as a speaker control in its toolbar instead). */
export interface MusicPlayerBodyOptions {
  /** The little canvas level meter. */
  meter?: boolean;
  /** The interface-sound (SFX) volume slider. */
  effects?: boolean;
  /** The inline "Music" volume slider. Off when the host supplies its own control - 
   *  any `[data-mp-volume]` input inside the same scope gets wired either way. */
  volume?: boolean;
  /** The Atmosphere section (background-noise beds mixed under the music). */
  atmosphere?: boolean;
}

/**
 * The Atmosphere mixer: a folded section of one-line rows, icon · label · slider.
 * Clicking an icon turns that bed on at the level it last had (or a default), and
 * dragging the slider does both jobs at once - there is no separate enable, which
 * is the point of a mixer strip. Levels are independent of the music volume and
 * persist; lib/atmosphere.ts owns all of that.
 */
function atmosphereHtml(): string {
  const open = getAtmosphere().open;
  const count = activeAtmosphereCount();
  const rowHtml = (l: (typeof ATMOSPHERE_LAYERS)[number]): string => {
    const v = atmosphereLevel(l.id);
    const glyph = hasIcon(l.icon) ? icon(l.icon, { size: 14 }) : '';
    return `<div class="neuro-atmo-row${v > 0 ? ' is-on' : ''}" data-atmo-row="${escape(l.id)}">`
      + `<button type="button" class="neuro-atmo-icon" data-atmo-toggle="${escape(l.id)}" aria-pressed="${v > 0}"`
      + ` title="${escape(l.label)}" aria-label="${escape(l.label)}">${glyph}</button>`
      + `<span class="neuro-atmo-label">${escape(l.label)}</span>`
      + `<input type="range" class="field-range" min="0" max="1" step="0.01" value="${v}"`
      + ` data-atmo-range="${escape(l.id)}" aria-label="${escape(l.label)} level">`
      + `</div>`;
  };
  // Grouped (Outside / Places / Noise) - fifteen unlabelled rows would be a wall.
  // The headings are one line each and carry no controls, so the section stays a
  // list you scan rather than a panel you read.
  const rows = ATMOSPHERE_GROUPS.map((g) => {
    const items = ATMOSPHERE_LAYERS.filter((l) => l.group === g);
    if (!items.length) return '';
    return `<div class="neuro-atmo-group">${escape(g)}</div>${items.map(rowHtml).join('')}`;
  }).join('');
  return `<div class="neuro-atmo" data-mp-atmo data-open="${open}">
      <!-- No aria-controls/id pair: the player body can be mounted several times at
           once (dock + popover + popout), and a duplicated id is worse than the
           implicit association a neighbouring aria-expanded already gives. -->
      <button type="button" class="neuro-atmo-head" data-mp-atmo-toggle aria-expanded="${open}">
        <span class="neuro-atmo-caret">${CARET}</span><span>Atmosphere</span>
        <span class="neuro-atmo-count" data-mp-atmo-count${count ? '' : ' hidden'}>${count} on</span>
      </button>
      <div class="neuro-atmo-rows" data-mp-atmo-rows${open ? '' : ' hidden'}>${rows}</div>
    </div>`;
}

/** The player body (meter, transport, volumes). The track picker is rendered
 *  separately (trackPickerHtml) up in the dock header row; both live under the
 *  same [data-music-player] scope (the dock <section>) so wiring finds them. */
export function musicPlayerBodyHtml(opts: MusicPlayerBodyOptions = {}): string {
  ensureStyles();
  const { meter = true, effects = true, volume = true, atmosphere = true } = opts;
  const playing = isNeurospicyPlaying();
  return `<div class="neuro-player">
      ${meter ? `<canvas class="neuro-meter" data-mp-meter width="260" height="24" aria-hidden="true"></canvas>` : ''}
      <div class="neuro-progress" data-mp-progress role="slider" tabindex="0" aria-label="Seek within track" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <span class="neuro-progress-fill" data-mp-progress-fill></span>
      </div>
      <div class="neuro-transport">
        <button type="button" class="neuro-tbtn" data-mp-prev aria-label="Previous track">${PREV}</button>
        <button type="button" class="neuro-tbtn neuro-play" data-mp-play aria-label="${playing ? 'Pause' : 'Play'}" aria-pressed="${playing}">${playing ? PAUSE : PLAY}</button>
        <button type="button" class="neuro-tbtn" data-mp-next aria-label="Next track">${NEXT}</button>
        ${modeButtonHtml()}
      </div>
      ${volume ? `<label class="neuro-vol"><span>Music</span><input type="range" class="field-range" min="0" max="1" step="0.05" value="${getNeurospicy().volume}" data-mp-volume aria-label="Music volume"></label>` : ''}
      ${effects ? `<label class="neuro-vol"><span>Effects</span><input type="range" class="field-range" min="0" max="1" step="0.05" value="${getSfxVolume()}" data-mp-sfx aria-label="Interface sound volume - how much of the UI you hear"></label>` : ''}
      ${atmosphere ? atmosphereHtml() : ''}
    </div>`;
}

/** Resolve the element carrying [data-music-player] - the dock <section> hosts it,
 *  so the header's track picker and the body's controls share one query scope. */
function playerRoot(root: ParentNode): HTMLElement | null {
  if (root instanceof HTMLElement && root.matches('[data-music-player]')) return root;
  return root.querySelector<HTMLElement>('[data-music-player]');
}

let tracksCache: NeuroTrack[] = [];

/** Sync transport icon, current-track label + mood, and the highlighted list row. */
export function paintMusicPlayer(root: ParentNode): void {
  const wrap = playerRoot(root);
  if (!wrap) return;
  const playing = isNeurospicyPlaying();
  const play = wrap.querySelector<HTMLButtonElement>('[data-mp-play]');
  if (play) {
    play.innerHTML = playing ? PAUSE : PLAY;
    play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    play.setAttribute('aria-pressed', String(playing));
  }
  const curId = getNeurospicy().loopId;
  const cur = tracksCache.find((t) => t.id === curId);
  const label = wrap.querySelector<HTMLElement>('[data-mp-current]');
  const chip = wrap.querySelector<HTMLElement>('[data-mp-mood]');
  if (label) label.textContent = cur ? cur.name : 'Select a track';
  if (chip) {
    const m = cur ? trackMood(cur.tags) : '';
    chip.textContent = m;
    chip.hidden = !m;
  }
  for (const btn of wrap.querySelectorAll<HTMLElement>('[data-mp-list] .neuro-track')) {
    btn.setAttribute('aria-current', String(btn.dataset.id === curId));
  }
  paintModeButton(wrap);
  paintAtmosphere(wrap);
  updateProgress(wrap);
}

/** Sync the Atmosphere rows to the stored levels - for a repaint driven from
 *  outside this instance (another mounted player moved a slider, the master mute
 *  changed). The input being dragged right now is left alone: writing its value
 *  back mid-drag would fight the pointer. */
export function paintAtmosphere(root: ParentNode): void {
  const wrap = playerRoot(root) ?? (root as ParentNode);
  const active = wrap instanceof HTMLElement ? wrap.ownerDocument.activeElement : null;
  for (const l of ATMOSPHERE_LAYERS) {
    const row = wrap.querySelector<HTMLElement>(`[data-atmo-row="${l.id}"]`);
    if (!row) continue;
    const v = atmosphereLevel(l.id);
    row.classList.toggle('is-on', v > 0);
    row.querySelector<HTMLButtonElement>('[data-atmo-toggle]')?.setAttribute('aria-pressed', String(v > 0));
    const range = row.querySelector<HTMLInputElement>('[data-atmo-range]');
    if (range && range !== active) range.value = String(v);
  }
  const count = activeAtmosphereCount();
  const badge = wrap.querySelector<HTMLElement>('[data-mp-atmo-count]');
  if (badge) { badge.textContent = `${count} on`; badge.hidden = count === 0; }
}

/** Reflect playback position in the thin skip-to bar. Radio hides it - a live
 *  stream has no duration to seek within. */
function updateProgress(root: ParentNode, p = getNeurospicyProgress()): void {
  const bar = root.querySelector<HTMLElement>('[data-mp-progress]');
  const fill = root.querySelector<HTMLElement>('[data-mp-progress-fill]');
  if (!bar || !fill) return;
  const cur = tracksCache.find((t) => t.id === getNeurospicy().loopId);
  bar.hidden = !!cur && trackCategory(cur) === 'radio';
  const frac = p ? p.position / p.duration : 0;
  fill.style.width = `${(frac * 100).toFixed(2)}%`;
  // Runs every animation frame while playing - only touch aria-valuenow when the
  // whole percent actually changes, or a focused slider becomes a screen-reader
  // announcement firehose.
  const now = String(Math.round(frac * 100));
  if (bar.getAttribute('aria-valuenow') !== now) bar.setAttribute('aria-valuenow', now);
}

/** Repaint + (re)start the meter - used by the dock when it's shown/expanded. */
export function refreshMusicPlayer(root: ParentNode): void {
  paintMusicPlayer(root);
  startMeter(root);
}

/** Force the track dropdown shut - used when the dock minimizes (the picker now
 *  lives in the header, so collapsing the body wouldn't otherwise hide an open panel). */
export function closeTrackPicker(root: ParentNode): void {
  const wrap = playerRoot(root);
  if (wrap) openPanel(wrap, false);
}

function openPanel(wrap: HTMLElement, open: boolean): void {
  const picker = wrap.querySelector<HTMLElement>('[data-mp-picker]');
  const btn = wrap.querySelector<HTMLButtonElement>('[data-mp-picker-btn]');
  const panel = wrap.querySelector<HTMLElement>('[data-mp-panel]');
  if (!picker || !btn || !panel) return;
  picker.dataset.open = String(open);
  btn.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;
  if (open) wrap.querySelector<HTMLInputElement>('[data-mp-search]')?.focus();
  // `wrap.ownerDocument`, not `document`: the visualizer popout mounts this player in a
  // SECOND window, where the module-global `document` is the opener's and its
  // activeElement is never inside this panel.
  else if (panel.contains(wrap.ownerDocument.activeElement)) btn.focus(); // return focus to the trigger
}

/**
 * Wire the player body: transport, the searchable track dropdown, volume, and the
 * meter. `host` drives track switching + persistence. Safe once the body is in the DOM.
 */
export function wireMusicPlayerBody(root: ParentNode, host: NeurospicyHost): void {
  ensureStyles();
  const wrap = playerRoot(root);
  if (!wrap) return;
  const list = wrap.querySelector<HTMLUListElement>('[data-mp-list]');
  const search = wrap.querySelector<HTMLInputElement>('[data-mp-search]');
  const vol = wrap.querySelector<HTMLInputElement>('[data-mp-volume]');

  const after = (): void => { paintMusicPlayer(wrap); startMeter(wrap); };

  wrap.querySelector<HTMLButtonElement>('[data-mp-play]')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await toggleNeurospicyPlay(host);
    after();
  });
  wrap.querySelector<HTMLButtonElement>('[data-mp-prev]')?.addEventListener('click', async (e) => {
    e.stopPropagation(); await cycleNeurospicyLoop(host, -1); after();
  });
  wrap.querySelector<HTMLButtonElement>('[data-mp-next]')?.addEventListener('click', async (e) => {
    e.stopPropagation(); await cycleNeurospicyLoop(host, 1); after();
  });
  // Repeat ⇄ play-through-list toggle (right of the transport).
  wrap.querySelector<HTMLButtonElement>('[data-mp-mode]')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await setNeurospicyRepeat(host, !getNeurospicy().repeat);
    paintModeButton(wrap);
  });
  // Category info tooltip (Internet Radio). Delegated to the persistent wrap since
  // the list re-renders; hover OR keyboard focus opens it.
  wrap.addEventListener('mouseover', (e) => {
    const w = (e.target as HTMLElement).closest?.('.neuro-warn');
    if (w) showWarnTip(w as HTMLElement);
  });
  wrap.addEventListener('mouseout', (e) => {
    if ((e.target as HTMLElement).closest?.('.neuro-warn')) hideWarnTip();
  });
  wrap.addEventListener('focusin', (e) => {
    const w = (e.target as HTMLElement).closest?.('.neuro-warn');
    if (w) showWarnTip(w as HTMLElement);
  });
  wrap.addEventListener('focusout', (e) => {
    if ((e.target as HTMLElement).closest?.('.neuro-warn')) hideWarnTip();
  });
  vol?.addEventListener('input', (e) => { e.stopPropagation(); setNeurospicyVolume(host, Number(vol.value)); });
  // The thin skip-to bar: click/drag to jump within the current local track; ←/→ nudge
  // ±5 s. All of it no-ops while nothing local is sounding (radio hides the bar).
  const progress = wrap.querySelector<HTMLElement>('[data-mp-progress]');
  if (progress) {
    const seekTo = (clientX: number): void => {
      const p = getNeurospicyProgress();
      if (!p) return;
      const r = progress.getBoundingClientRect();
      if (!r.width) return;
      const frac = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      seekNeurospicy(frac * p.duration);
      updateProgress(wrap);
    };
    progress.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      progress.setPointerCapture(e.pointerId);
      seekTo(e.clientX);
    });
    progress.addEventListener('pointermove', (e) => {
      if (progress.hasPointerCapture(e.pointerId)) seekTo(e.clientX);
    });
    progress.addEventListener('keydown', (e) => {
      const step = e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : null;
      if (step == null) return;
      const p = getNeurospicyProgress();
      if (!p) return;
      e.preventDefault();
      e.stopPropagation();
      seekNeurospicy(p.position + step);
      updateProgress(wrap);
    });
  }
  // Effects = interface-sound (SFX) volume. Live on drag; persist to the profile on release.
  const sfx = wrap.querySelector<HTMLInputElement>('[data-mp-sfx]');
  sfx?.addEventListener('input', (e) => { e.stopPropagation(); setSfxVolume(Number(sfx.value)); });
  sfx?.addEventListener('change', (e) => {
    e.stopPropagation();
    void host.profile.get().then((p) => host.profile.set({ ...p, sfxVolume: Number(sfx.value) })).catch(() => { /* best-effort */ });
  });

  // ── Atmosphere: fold toggle, per-layer icon toggles, per-layer sliders ──
  const atmo = wrap.querySelector<HTMLElement>('[data-mp-atmo]');
  if (atmo) {
    const rows = atmo.querySelector<HTMLElement>('[data-mp-atmo-rows]');
    const head = atmo.querySelector<HTMLButtonElement>('[data-mp-atmo-toggle]');
    head?.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = atmo.dataset.open !== 'true';
      atmo.dataset.open = String(open);
      head.setAttribute('aria-expanded', String(open));
      if (rows) rows.hidden = !open;
      setAtmospherePanelOpen(open);
    });
    // Delegated, so the handlers survive any future re-render of the rows.
    atmo.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest?.<HTMLElement>('[data-atmo-toggle]');
      if (!btn) return;
      e.stopPropagation();
      toggleAtmosphereLayer(host, btn.dataset.atmoToggle as AmbienceKind);
      paintAtmosphere(wrap);
    });
    atmo.addEventListener('input', (e) => {
      const range = (e.target as HTMLElement).closest?.<HTMLInputElement>('[data-atmo-range]');
      if (!range) return;
      e.stopPropagation();
      // The slider IS the enable: dragging up from zero starts that bed, dragging
      // back to zero stops it. setAtmosphereLevel handles both.
      setAtmosphereLevel(host, range.dataset.atmoRange as AmbienceKind, Number(range.value));
      paintAtmosphere(wrap);
    });
  }

  // Searchable dropdown open/close.
  wrap.querySelector<HTMLButtonElement>('[data-mp-picker-btn]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = wrap.querySelector<HTMLElement>('[data-mp-picker]')?.dataset.open === 'true';
    openPanel(wrap, !open);
  });
  search?.addEventListener('input', (e) => {
    e.stopPropagation();
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const cat of wrap.querySelectorAll<HTMLElement>('[data-mp-list] .neuro-cat')) {
      let catShown = 0;
      for (const btn of cat.querySelectorAll<HTMLElement>('.neuro-track')) {
        const hit = !q || (btn.dataset.search ?? '').includes(q);
        btn.hidden = !hit;
        if (hit) catShown++;
      }
      cat.hidden = catShown === 0;
      if (q) { // expand groups while searching so matches are never behind a fold
        cat.classList.remove('is-collapsed');
        cat.querySelector('[data-cat-toggle]')?.setAttribute('aria-expanded', 'true');
      }
      shown += catShown;
    }
    const empty = list?.querySelector<HTMLElement>('.neuro-empty');
    if (empty) empty.hidden = shown > 0;
  });
  // Escape anywhere in the open panel (search box OR a track button) closes just the
  // panel and stops the event so the dock's global Escape doesn't also minimize.
  wrap.querySelector<HTMLElement>('[data-mp-picker]')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && wrap.querySelector<HTMLElement>('[data-mp-picker]')?.dataset.open === 'true') {
      e.stopPropagation();
      openPanel(wrap, false);
    }
    // The search box sits at the panel's BOTTOM (the panel opens upward), AFTER the
    // list in DOM - so Tab from it would silently leave the still-open panel.
    // Redirect it to the first visible row (a category head or track) instead.
    if (e.key === 'Tab' && !e.shiftKey && (e.target as HTMLElement).closest?.('[data-mp-search]')) {
      const first = [...wrap.querySelectorAll<HTMLElement>('[data-mp-list] .neuro-cat-head, [data-mp-list] .neuro-track')]
        .find((el) => !el.hidden && el.offsetParent !== null);
      if (first) { e.preventDefault(); first.focus(); }
    }
  });
  // Click-away closes the panel. Bound to the wrap's OWN document so a player mounted
  // in the visualizer's popout window listens to clicks in that window: the opener's
  // document neither sees the popout's clicks (so the panel would never close) nor
  // should close it on unrelated clicks back in the app (so it would close at random).
  const ownDoc = wrap.ownerDocument;
  ownDoc.addEventListener('click', (e) => {
    if (!wrap.isConnected) return;
    const t = e.target;
    // `instanceof Node` is unreliable across documents - each realm has its own Node - 
    // so check for the shape the call below actually needs instead.
    const isNode = !!t && typeof (t as Node).nodeType === 'number';
    if (!isNode || !wrap.querySelector('[data-mp-picker]')?.contains(t as Node)) openPanel(wrap, false);
  });

  const rebuildList = (): void => {
    void listLoops(host).then((loops) => {
      tracksCache = loops;
      if (list) {
        // Keep the user's fold choices when the list re-renders (e.g. after an upload
        // arrives mid-session); categories they haven't touched keep their default.
        const prevFold = new Map<string, boolean>();
        for (const c of list.querySelectorAll<HTMLElement>('.neuro-cat')) {
          prevFold.set(c.dataset.cat ?? '', c.classList.contains('is-collapsed'));
        }
        if (!loops.length) {
          list.innerHTML = '<li class="neuro-empty">No beats found</li>';
        } else {
          const byCat = new Map<string, NeuroTrack[]>();
          for (const t of loops) { const c = trackCategory(t); (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(t); }
          const trackHtml = (t: NeuroTrack): string => {
            const m = trackMood(t.tags);
            return `<li><button type="button" class="neuro-track" data-id="${escape(t.id)}" data-search="${escape(t.name.toLowerCase())}">` +
              `<span class="neuro-track-dot"></span><span class="neuro-track-name">${escape(t.name)}</span>` +
              (m ? `<span class="neuro-track-mood">${escape(m)}</span>` : '') + `</button></li>`;
          };
          // Groups AND the rows inside them come out in listLoops' order - the one
          // canonical playlist order, so next/prev match what's on screen. No re-sort here.
          list.innerHTML = NEURO_CATEGORY_ORDER.map((key) => {
            const cat = CATEGORY_META[key] ?? { label: key, icon: '🎵' };
            const items = byCat.get(key) ?? [];
            if (!items.length) return '';
            const folded = prevFold.get(key) ?? true;
            return `<li class="neuro-cat${folded ? ' is-collapsed' : ''}" data-cat="${escape(key)}">` +
              `<button type="button" class="neuro-cat-head" data-cat-toggle aria-expanded="${!folded}">` +
              `<span class="neuro-cat-caret">${CARET}</span><span class="neuro-cat-emoji" aria-hidden="true">${cat.icon}</span><span>${escape(cat.label)}</span>` +
              (cat.warn ? `<span class="neuro-warn" tabindex="0" role="button" data-mp-warn="${escape(key)}" aria-label="${escape(cat.warn)}">${WARN}</span>` : '') +
              `<span class="neuro-cat-count">${items.length}</span></button>` +
              `<ul class="neuro-cat-tracks">${items.map(trackHtml).join('')}</ul></li>`;
          }).join('') + '<li class="neuro-empty" hidden>No matches</li>';
        }
        for (const btn of list.querySelectorAll<HTMLButtonElement>('.neuro-track[data-id]')) {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await setNeurospicyLoop(host, btn.dataset.id!);
            openPanel(wrap, false);
            after();
          });
        }
        for (const head of list.querySelectorAll<HTMLButtonElement>('[data-cat-toggle]')) {
          head.addEventListener('click', (e) => {
            e.stopPropagation();
            const collapsed = head.closest('.neuro-cat')?.classList.toggle('is-collapsed');
            head.setAttribute('aria-expanded', String(!collapsed));
          });
        }
        // Re-apply an active filter to the fresh rows (the input handler owns hidden/expanded).
        if (search?.value) search.dispatchEvent(new Event('input'));
      }
      paintMusicPlayer(wrap);
    });
  };
  rebuildList();
  // An audio upload/deletion invalidates the track list - rebuild it in place.
  // Self-removing: a player body can be torn down (the visualizer panel closing) and this
  // listener has no teardown hook of its own, so it retires as soon as its wrap is gone
  // rather than pinning the whole subtree and rebuilding a list nobody can see.
  const onTracks = (): void => {
    if (wrap.isConnected) rebuildList();
    else ownDoc.removeEventListener('lolly:neuro-tracks', onTracks);
  };
  ownDoc.addEventListener('lolly:neuro-tracks', onTracks);
  // Atmosphere levels are global, so a change made in ANOTHER mounted player (or by
  // the master mute) has to show up here. Self-removing on the same terms as above.
  const onAtmo = (): void => {
    if (wrap.isConnected) paintAtmosphere(wrap);
    else ownDoc.removeEventListener('lolly:atmosphere', onAtmo);
  };
  ownDoc.addEventListener('lolly:atmosphere', onAtmo);

  startMeter(wrap);
}

// ── level meter (local songs only) ──────────────────────────────────────────

/**
 * Advance just the seek bar, for a player body with no meter canvas.
 *
 * Keyed off the progress element rather than the canvas, and self-terminating on the same
 * terms as the meter loop: detached or not laid out stops it, and a transport change
 * ('lolly:neuro-playing' → refreshMusicPlayer) starts it again.
 */
function startProgressOnly(root: ParentNode): void {
  const bar = root.querySelector<HTMLElement>('[data-mp-progress]');
  if (!bar || bar.dataset.running === 'true') return;
  bar.dataset.running = 'true';
  const win = bar.ownerDocument.defaultView ?? window;
  const draw = (): void => {
    if (!bar.isConnected || bar.offsetParent === null) { bar.dataset.running = 'false'; return; }
    const p = getNeurospicyProgress();
    updateProgress(root, p);
    if (isNeurospicyPlaying() && p) win.requestAnimationFrame(draw);
    else bar.dataset.running = 'false';
  };
  win.requestAnimationFrame(draw);
}

/**
 * Drive the level meter AND the progress bar from the focus-loop analyser.
 *
 * The progress bar is advanced by this same loop, so a body rendered WITHOUT a meter - the
 * visualizer panel passes `meter: false`, since a full-screen visualizer is the meter - 
 * used to get a seek bar that never moved. When there's no canvas we still run a loop,
 * just a progress-only one.
 */
function startMeter(root: ParentNode): void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-mp-meter]');
  if (!canvas) { startProgressOnly(root); return; }
  if (canvas.dataset.running === 'true') return;
  const c2d = canvas.getContext('2d');
  if (!c2d) { startProgressOnly(root); return; }
  canvas.dataset.running = 'true';

  const draw = (): void => {
    // Stop when detached OR not visible (offsetParent is null for display:none - a
    // hidden or collapsed dock) so a minimized player doesn't spin rAF forever.
    if (!canvas.isConnected || canvas.offsetParent === null) { canvas.dataset.running = 'false'; return; }
    // Progress and signal are SEPARATE questions now that radio drives the meter: a live
    // stream has no duration (bar hidden) but does have samples (bars moving).
    updateProgress(root, getNeurospicyProgress()); // the skip-to bar advances with the same loop
    const a = getNeurospicyAnalyser();
    const w = canvas.width;
    const h = canvas.height;
    c2d.clearRect(0, 0, w, h);
    const color = getComputedStyle(canvas).color || '#888';
    if (neurospicySignalState() === 'live') {
      // Something is actually sounding - a local track or a tapped radio stream. Reduced
      // motion parks the meter on its baseline but keeps looping, so the (slow,
      // informational) progress bar still tracks the track.
      // Asked per frame, not once at import: the app's own pref (a data attribute
      // on <html>) can be flipped while the meter is running, and at import time
      // boot hydration hasn't applied the profile value yet.
      if (a && !prefersReducedMotion()) drawMeterBars(c2d, w, h, a, color);
      else drawMeterBaseline(c2d, w, h, color);
      requestAnimationFrame(draw);
    } else {
      // Idle/paused, a stream still connecting, a station that refused the analyser tap, or
      // the pre-gesture boot state: nothing to animate, so park on the baseline and stop.
      // notifyPlaying ('lolly:neuro-playing') / the next transport action restarts it.
      drawMeterBaseline(c2d, w, h, color);
      canvas.dataset.running = 'false';
    }
  };
  requestAnimationFrame(draw);
}
