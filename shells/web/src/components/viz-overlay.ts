// SPDX-License-Identifier: MPL-2.0
/**
 * The MilkDrop visualizer's surfaces. lib/butterchurn-viz.ts owns the GL and audio;
 * this file owns the chrome and decides where the picture goes. Three of them, in
 * escalating size, all showing the brand-seeded presets from lib/viz-presets.ts:
 *
 *   INLINE  a 4:3 panel that IS the Neurospicy dock's body, replacing the old strip
 *           level meter - the default, always running while the dock is open.
 *   PANEL   an enlarged, draggable, resizable player floating over the app, carrying a
 *           full transport so it can stand in for the dock.
 *
 * There is deliberately NO separate popout WINDOW. An earlier version used
 * `window.open`, and a second document turned out to be the single largest source of
 * defects in this feature: music-player.ts is written against the module-global
 * `document`, so its click-away listener, its `activeElement` check and its tooltip all
 * bound to the opener; `instanceof Node` is unreliable across realms; devicePixelRatio
 * was read from the wrong window; and every listener it registered leaked because the
 * child's teardown could not reach them. A floating in-page panel gives the same thing
 * (a big visualizer with its own player, movable and resizable) with none of that.
 *
 * FULLSCREEN is a state of a surface, not a third surface: `requestFullscreen` on the
 * panel. So Escape leaves fullscreen and lands back on the player, which is what you
 * expect, rather than dropping into some intermediate full-window mode.
 *
 * Click or right-click either surface for the options menu. Only ONE panel exists at a
 * time and it SUSPENDS the inline one while open: two live surfaces would mean two
 * WebGL contexts and two audio taps rendering the same thing.
 *
 * Preset choice and auto-cycling are module-level rather than per-surface, so the
 * picture doesn't jump when you escalate from inline to fullscreen. The new surface
 * opens on whatever the old one was showing.
 *
 * Interaction follows the MilkDrop/Winamp convention the feature is borrowed from:
 * right-click for options, Escape to leave, double-click for fullscreen. Overriding
 * the context menu is normally off-limits here, so two things keep it honest: it's
 * scoped to the visualizer canvas alone (nowhere else in the app), and every action
 * in that menu is also reachable from a visible toolbar, so right-click is a
 * shortcut rather than the only door.
 *
 * Escape is layered around what's already listening: the dock's own Escape only fires
 * when focus is inside the dock (neuro-dock.ts), and the browser owns Escape while an
 * element is fullscreen. So the handler here stands down when `fullscreenElement` is
 * set. The browser's own exit runs and returns you to the panel; a SECOND Escape then
 * closes the panel back to the dock.
 */
import { mountViz, vizAudioReady, vizHasSignal, type VizHandle } from '../lib/butterchurn-viz.ts';
import {
  getNeurospicy, neurospicySignalState,
  type NeurospicyHost, type NeuroSignalState,
} from '../lib/neurospicy.ts';
import {
  musicPlayerBodyHtml, trackPickerHtml, wireMusicPlayerBody, refreshMusicPlayer,
} from './music-player.ts';
import { vizSupported } from '../lib/viz-support.ts';
import { neuroDemoActive, DEMO_VIZ_PRESET_ID, demoVizWave, pumpVizDemoFrames } from '../lib/neuro-demo.ts';
import { CYCLE_CHOICES, loadCycleSeconds, saveCycleSeconds } from '../lib/viz-cycle.ts';
import { drawMeterBars, drawMeterBaseline } from '../lib/audio-meter.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import {
  BRAND_TINTS, loadStockPreset, readBrandTint, stockPresetIndex, writeBrandTint,
  type BrandTint, type StockPresetInfo,
} from '../lib/viz-stock.ts';
import { getNeurospicyAnalyser } from '../lib/neurospicy.ts';
import { VIZ_PRESETS, defaultVizPresetId, nextVizPresetId, vizPresetById } from '../lib/viz-presets.ts';
import { randomVizSchemeId, vizSchemeById, vizSchemes, type VizScheme } from '../lib/viz-schemes.ts';
import type { VizPaletteHost } from '../lib/viz-palette.ts';
import { icon } from '../lib/icons.ts';
import { panelGripsHtml, wirePanelGrips } from '../lib/panel-grips.ts';
import { attachWobble } from '../lib/wobble.ts';
import { escape } from '../utils.ts';

const STYLE_ID = 'lolly-viz-overlay-styles';
const SCHEME_KEY = 'lolly:vizScheme';
const MODE_KEY = 'lolly:vizMode';
const PANEL_KEY = 'lolly:vizPanelBox';
/**
 * Announced when the enlarged panel opens or closes.
 *
 * The dock listens and steps aside: the panel carries a complete player, so
 * showing both would put two transports on screen fighting over the same
 * audio. This is a document event rather than a direct call because
 * neuro-dock.ts already dynamically imports THIS module; calling back into it
 * would close the cycle. Same pattern as 'lolly:neuro-playing'.
 */
const PANEL_EVENT = 'lolly:viz-panel';

function announcePanel(open: boolean): void {
  document.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: { open } }));
}
/** Vertical room the floating panel reserves for its player below the 4:3 canvas, so the
 *  default size shows a properly proportioned frame rather than a squashed one. */
const PLAYER_ALLOWANCE = 150;
/** Auto-cycle intervals + the saved preference now live in lib/viz-cycle.ts, shared
 *  with the catalog's audio details modal so the two surfaces cannot drift apart on
 *  what "cycling" means or on what the user already chose. */
/** The interval a fresh install starts on. */
/**
 * The visualizer is a full-screen takeover, so it sits at the very top of the
 * z-stack. The app's own chrome climbs to 100001 (the portalled popovers and
 * the top-bar cluster), well past the dock's 9002, and anything below that
 * shows THROUGH the black canvas. 2147483000 is the ceiling this codebase
 * already uses for genuinely top-most layers (the player's portalled tooltip).
 */
const TOP_Z = 2147483000;
const CSS = `
.viz-surface { position: fixed; z-index: ${TOP_Z}; background: #000; overflow: hidden;
  display: flex; align-items: center; justify-content: center; }
.viz-surface canvas { display: block; width: 100%; height: 100%; }
/* The floating PANEL: an enlarged player over the app, moved by dragging its toolbar and
   resized from any edge or corner (the eight grips of lib/panel-grips.ts - this used to be
   the native CSS resize corner, which is one corner and fires no events, so people who
   reached for a side found nothing there). Position and size are restored from the last
   session. */
.viz-panel.is-idle-blank { background: hsl(var(--card) / .82); backdrop-filter: blur(12px); }
.viz-panel { border-radius: 16px; box-shadow: 0 24px 70px rgb(0 0 0 / .55);
  border: 1px solid rgb(255 255 255 / .12); min-width: 280px; min-height: 220px;
  max-width: 100vw; max-height: 100vh; }
/* No transition on left/top/width/height: they're written on every pointermove, so an
   eased one lags the cursor by its own duration and the panel swims. */
.viz-panel.is-resizing, .viz-panel.is-dragging { user-select: none; }
/* Fullscreen strips the framing - the panel becomes the whole screen. */
.viz-panel:fullscreen { border-radius: 0; border: none; width: 100vw !important;
  height: 100vh !important; inset: 0 !important; }
/* The viewport-fallback twin (no element fullscreen on iOS Safari): same look,
   pinned to the tab. dvh tracks the mobile toolbars; vh covers older engines. */
.viz-panel.is-fullpage { border-radius: 0; border: none; width: 100vw !important;
  height: 100vh !important; height: 100dvh !important; inset: 0 !important;
  transform: none !important; z-index: 2147483000; }
/* Dragging by the toolbar; the buttons keep their own cursor. */
.viz-panel .viz-bar { cursor: grab; }
.viz-panel.is-dragging .viz-bar { cursor: grabbing; }
.viz-panel .viz-bar button, .viz-panel .viz-bar .viz-vol { cursor: pointer; }
/* The corner mark rides the SE grip itself (lib/panel-grips.css) and takes its colour
   from here, since the panel is dark whatever the theme is. */
.viz-panel .panel-grip--se { color: #fff; }
/* Toolbar: the visible twin of the right-click menu, so no action is mouse-secret.
   Fades out when the pointer rests, like a video player's controls.
   NO scrim gradient behind it: a dark band across the top of the frame hides part of the
   very thing you opened, and it isn't needed - every control carries its own translucent
   pill and the title has a text-shadow. */
.viz-bar { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; gap: 8px;
  padding: 10px 12px; opacity: 1; transition: opacity .3s ease; }
/* Idle-hiding only in fullscreen: on the floating panel the toolbar is also the drag
   handle and the only way out, so it must not disappear. */
.viz-surface.is-idle:fullscreen .viz-bar,
.viz-surface.is-idle.is-fullpage .viz-bar { opacity: 0; pointer-events: none; }
.viz-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: #fff; font-size: .82rem; font-weight: 600; letter-spacing: .01em; text-shadow: 0 1px 3px rgb(0 0 0 / .6); }
.viz-btn { flex: 0 0 auto; width: 30px; height: 30px; border: none; border-radius: 50%; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  /* Carries its own backdrop, since there's no toolbar scrim to sit on. */
  background: rgb(0 0 0 / .38); color: #fff; backdrop-filter: blur(6px);
  transition: background .12s ease; }
.viz-btn:hover { background: rgb(0 0 0 / .62); }
.viz-btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
/* Centred status card - "press play", "radio has no signal", "no WebGL2". Centred
   explicitly rather than leaning on an abspos element's static position inside the
   flex parent, which is spec'd but easy to knock loose. */
.viz-note { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  max-width: 30ch; padding: 14px 18px; border-radius: 12px;
  background: rgb(0 0 0 / .6); color: #fff; font-size: .86rem; line-height: 1.5; text-align: center;
  backdrop-filter: blur(6px); }
.viz-note[hidden] { display: none; }
/* Right-click menu. Positioned at the pointer, clamped inside the surface. */
.viz-menu { position: absolute; z-index: 2; min-width: 190px; padding: 6px;
  border: 1px solid rgb(255 255 255 / .16); border-radius: 10px; background: rgb(18 18 18 / .94);
  box-shadow: 0 14px 44px rgb(0 0 0 / .5); backdrop-filter: blur(10px); }
.viz-menu[hidden] { display: none; }
.viz-menu-label { padding: 6px 10px 4px; color: rgb(255 255 255 / .5); font-size: .66rem;
  font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
.viz-menu-item { display: flex; align-items: center; gap: 9px; width: 100%; padding: 7px 10px;
  border: none; border-radius: 7px; background: transparent; color: #fff; font-size: .82rem;
  text-align: left; cursor: pointer; }
.viz-menu-item:hover { background: rgb(255 255 255 / .13); }
.viz-menu-item:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
.viz-menu-item[aria-checked="true"] { font-weight: 700; }
.viz-menu-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: transparent; }
.viz-menu-item[aria-checked="true"] .viz-menu-dot { background: currentColor; }
.viz-menu-sep { height: 1px; margin: 5px 6px; background: rgb(255 255 255 / .14); }
/* With 200+ artist presets a flat list is unusable, so the menu is a SEARCH list: a filter
   field over a scrolling result set. The field and the setting rows sit OUTSIDE the
   scroller, so they stay put while results change under them. */
/* The menu is settings-then-library: a short block of pill rows at a fixed height, and
   under it ONE tall scroller holding every preset. Sized generously (2026-07-31) - with
   200+ entries the old min(72vh, 520px) box, most of it spent on rows and headings, showed
   about six presets at a time.

   The menu keeps its own 'overflow-y: auto' as a SAFETY VALVE, not as a normal scroller:
   on a tall window the settings block and the list both fit and it never scrolls, but on a
   short one it is what stops the fixed rows being clipped outright. ('overflow: hidden'
   here was tried and is wrong - at 86vh of a 500px window the rows plus the list's floor
   exceed the box, and hidden means the bottom of the list is simply unreachable.) Wheel
   chaining from the list into it is already prevented by the list's 'overscroll-behavior',
   which is what actually made nested scrollers feel like a fight. */
.viz-menu { display: flex; flex-direction: column; width: min(340px, calc(100vw - 24px));
  max-height: min(86vh, 720px); overflow-y: auto; overscroll-behavior: contain; }
.viz-search { flex: 0 0 auto; width: 100%; margin: 2px 0 6px; padding: 7px 10px;
  border: 1px solid rgb(255 255 255 / .18); border-radius: 8px;
  background: rgb(255 255 255 / .08); color: #fff; font-size: .8rem; }
.viz-search::placeholder { color: rgb(255 255 255 / .45); }
.viz-search:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
/* The list is the ONLY child of the flex column that can shrink (every other row is sized
   by its content), so it absorbs the whole overflow - which is why it needs a FLOOR rather
   than min-height:0. With 0 the flex algorithm was free to shrink it to exactly 0px, and
   did: a brand whose palette yields ~6+ colour-scheme rows pushed the fixed rows past
   max-height, the list took the entire difference, and the menu showed a search field with
   NOTHING under it. The presets were all in the DOM the whole time, in a 0px-tall box - so
   it read as "search finds nothing" rather than as a layout collapse. (Those schemes are a
   pill row now, so that particular pressure is gone, but the floor is what makes the
   collapse impossible rather than merely unlikely.)

   Raised 7rem → 14rem (2026-07-31): 7rem is ~4 rows, which is a peephole onto 200+ presets.
   Kept as a flat rem rather than a 'min(…, 40vh)': the viewport clamp was tried, and it
   both breaks the floor's own regression test (viz-menu-layout.test.ts parses this value)
   and solves a problem the menu's safety-valve scroll already solves. On a window too short
   for 14rem the menu scrolls, which is the documented behaviour, not a collapse. */
.viz-list { flex: 1 1 auto; min-height: 14rem; overflow-y: auto; overscroll-behavior: contain;
  /* A visible, grabbable bar: this is now the only scroller in the menu and it is holding
     200+ rows, so the overlay-style thin bar that appears on scroll is not enough of an
     affordance. */
  scrollbar-width: thin; scrollbar-color: rgb(255 255 255 / .3) transparent;
  scroll-padding-block: 4px; }
.viz-list::-webkit-scrollbar { width: 10px; }
.viz-list::-webkit-scrollbar-thumb { border: 3px solid transparent; border-radius: 999px;
  background: rgb(255 255 255 / .3); background-clip: padding-box; }
.viz-list::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / .5); background-clip: padding-box; }
.viz-list-empty { padding: 8px 10px; color: rgb(255 255 255 / .55); font-size: .78rem; }
/* Author, right-aligned and quiet - attribution without competing with the title. */
.viz-menu-item .viz-by { margin-left: auto; padding-left: 10px; flex: 0 0 auto;
  color: rgb(255 255 255 / .45); font-size: .66rem; max-width: 11ch;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* The cycle-interval row: a label and a segmented set of intervals, "Off" included as a
   choice rather than a separate toggle - one row, four states, no ambiguity about what
   "on" currently means. */
.viz-menu-row { display: flex; align-items: center; gap: 10px; padding: 6px 10px; }
.viz-menu-row-label { flex: 0 0 auto; color: #fff; font-size: .82rem; }
/* Pills WRAP and take the leftover width. The colour-scheme row put word-length labels
   ('Jungle / Persimmon', up to MAX_SCHEMES of them) into what had only ever held 2-4 short
   ones, and a non-wrapping 'flex: 0 0 auto' group would push the row past the menu. */
.viz-pills { flex: 1 1 auto; display: flex; flex-wrap: wrap; justify-content: flex-end;
  gap: 3px; padding: 2px; border-radius: 12px; background: rgb(255 255 255 / .1); }
.viz-pill { border: none; border-radius: 999px; padding: 3px 9px; cursor: pointer;
  background: transparent; color: rgb(255 255 255 / .7);
  font-size: .7rem; font-weight: 600; letter-spacing: .01em; }
.viz-pill:hover { color: #fff; background: rgb(255 255 255 / .14); }
.viz-pill.is-on { background: #fff; color: #111; }
.viz-pill:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
/* The panel carries a full player so it can STAND IN for the dock. Reuses
   music-player.ts wholesale, so transport/seek/volume/track-search behave identically. */
.viz-player { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%);
  width: min(340px, calc(100vw - 32px)); padding: 10px 12px 12px;
  border-radius: 16px; background: rgb(18 18 18 / .82); backdrop-filter: blur(12px);
  box-shadow: 0 14px 44px rgb(0 0 0 / .5); color: #fff;
  opacity: 1; transition: opacity .3s ease; }
/* Deliberately NOT hidden on idle. The popout's player is the primary control surface
   in that window - Andy's "substitute for the dock" - and an earlier version faded it to
   opacity 0 with pointer-events:none after 2.6s, which made choosing a track impossible
   and left the now-playing label apparently blank. It dims slightly and stays live. */
.viz-surface.is-idle:fullscreen .viz-player,
.viz-surface.is-idle.is-fullpage .viz-player { opacity: .72; }
.viz-player:hover, .viz-player:focus-within { opacity: 1 !important; }
/* This card is dark whatever the app theme, but the embedded music-player body colours
   its text with theme tokens - in a light theme --foreground is near-black, so the
   ACTIVE atmosphere labels (and the transport/header/icon hover states) went black on
   dark. Pin the text that sits directly on the card to white. The track picker is
   exempt: its popover brings its own themed background, so tokens are right there. */
.viz-player .neuro-atmo-row.is-on .neuro-atmo-label,
.viz-player .neuro-tbtn:hover,
.viz-player .neuro-atmo-head:hover,
.viz-player .neuro-atmo-icon:hover { color: #fff; }
/* position:relative so the track picker's panel (music-player.ts) anchors here and
   opens upward, exactly as it does in the dock. */
.viz-player-head { position: relative; margin-bottom: 8px; }
/* Music volume lives in the toolbar as a speaker + vertical slider rather than a row
   in the player: the popout has no room to spare below, and a visualizer already IS
   a level meter, so the panel drops the meter and the interface-sound slider too. */
.viz-vol { position: relative; flex: 0 0 auto; }
.viz-vol-pop { position: absolute; top: calc(100% + 8px); right: 0; display: flex; justify-content: center;
  padding: 14px 10px; border-radius: 12px; background: rgb(18 18 18 / .94);
  border: 1px solid rgb(255 255 255 / .16); box-shadow: 0 14px 44px rgb(0 0 0 / .5);
  backdrop-filter: blur(10px); }
.viz-vol-pop[hidden] { display: none; }
/* A genuinely vertical range: writing-mode vertical-rl is the modern way and
   appearance:slider-vertical the legacy fallback, so both engines get it. */
.viz-vol-pop input[type="range"] { writing-mode: vertical-rl; direction: rtl;
  -webkit-appearance: slider-vertical; appearance: slider-vertical;
  width: 24px; height: 108px; margin: 0; accent-color: hsl(var(--primary)); }
/* The INLINE surface: the dock's body. In MilkDrop mode it's 4:3 - a MilkDrop frame
   needs real height to read as anything - and sized off the dock's width so it holds
   that ratio on phones where the dock goes full-bleed.
   In BAR mode it collapses to a strip and hands the space back, which is the point of
   being able to toggle: pick the visualiser you want and the dock resizes to suit. */
.viz-inline { position: relative; width: 100%; aspect-ratio: 4 / 3; overflow: hidden;
  border-radius: calc(var(--radius) + 2px); background: #000; cursor: pointer;
  transition: aspect-ratio .22s ease, height .22s ease, background-color .22s ease; }
/* Nothing playing = no black slab. A visualizer with no signal has nothing to show, and an
   opaque black rectangle sitting in the dock looks broken rather than idle - so the surface
   goes transparent and the dock's own background shows through. The canvas is hidden rather
   than merely transparent so a stale last frame can't linger behind it. */
.viz-surface.is-idle-blank { background: transparent; }
.viz-surface.is-idle-blank > canvas { visibility: hidden; }
.viz-inline canvas { display: block; width: 100%; height: 100%; }
/* Bars mode: a short strip on the DOCK'S OWN surface, not on black. The MilkDrop field
   is a self-lit image so black is right for it; the meter is chrome, and a black slab
   behind it would ignore the light/dark theme the rest of the dock follows. */
.viz-inline[data-mode="meter"] { aspect-ratio: auto; height: 52px;
  background: hsl(var(--muted) / .45); }
@media (prefers-reduced-motion: reduce) { .viz-inline { transition: none; } }
html[data-a11y-motion="reduce"] .viz-inline { transition: none; }
/* The inline panel is overflow:hidden (it crops the canvas to its 4:3 box), which also
   crops any menu opened inside it - and the options menu is taller than the panel. So
   the inline surface's menu is PORTALLED to <body> as position:fixed instead, the same
   escape hatch the app's other clipped popovers use. */
.viz-menu.is-portalled { position: fixed; z-index: ${TOP_Z}; }
/* (A second .viz-menu max-height rule used to live here, left over from when the menu was
   a flat preset list. Same specificity, later in the sheet, so it quietly beat the search-list
   rule above and shaved 60px off the box for no reason. The one declaration up there owns the
   menu's height and scrolling now.) */
/* No instructional overlay. The panel is plainly interactive (it has a pointer cursor
   and a right-click menu); a caption explaining that is clutter on a small surface, and
   the actions are all in the menu anyway. Discovery over instruction. */
/* The inline panel has no toolbar - the dock's own header is right above it. */
.viz-inline .viz-bar { display: none; }
/* Enlarge: a vertical double-arrow turned 45deg, the conventional diagonal expand mark.
   Deliberately tiny and low-contrast until approached - it sits ON the artwork, so it
   should read as a handle rather than as chrome. */
.viz-expand { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%; padding: 0; cursor: pointer;
  background: rgb(0 0 0 / .3); color: #fff; opacity: .55;
  transition: opacity .15s ease, background-color .15s ease; }
.viz-expand svg { transform: rotate(45deg); }
.viz-inline:hover .viz-expand { opacity: 1; }
.viz-expand:hover { background: rgb(0 0 0 / .6); }
/* Always fully visible when focused, or a keyboard user can't see where they are. */
.viz-expand:focus-visible { opacity: 1; outline: 2px solid #fff; outline-offset: 2px; }
/* Nothing to enlarge when there's nothing playing - the surface is transparent then. */
.viz-surface.is-idle-blank .viz-expand { opacity: 0; pointer-events: none; }
/* No hover on touch - keep the handle visible at the same full opacity a fine-pointer
   hover gives it (the idle-blank rule above still wins - higher specificity). */
@media (hover: none) { .viz-expand { opacity: 1; } }
/* A generous fingertip target - the artwork carries no other affordance here. */
@media (pointer: coarse) { .viz-expand { width: 36px; height: 36px; } }
@media (prefers-reduced-motion: reduce) { .viz-expand { transition: none; } }
@media (prefers-reduced-motion: reduce) {
  .viz-bar, .viz-player { transition: none; }
}
/* Repeated for the app's own preference (data-a11y-motion, lib/a11y-prefs.ts):
   parts/base.css tames animations under the attribute but deliberately leaves
   transitions alone, so each component still owns the ones it kills. */
html[data-a11y-motion="reduce"] :is(.viz-expand, .viz-bar, .viz-player) { transition: none; }`;

function ensureStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

/**
 * The preset the visualizer opens on when you leave Bars: a pinned one (Andy's
 * pick, 2026-07-31), falling back to a random draw when it isn't staged.
 *
 * It used to be random every time, on the reasoning that a 200+ library should
 * land somewhere different each session. That is right for the CYCLE (which
 * still draws at random, every `CYCLE_DEFAULT` seconds) and wrong for the
 * OPENING frame: switching off the analyser is the moment the visualizer has
 * to justify itself, and a random draw could land on the fifth of the pack
 * that is technically fine but reads as almost-black. A pinned opener makes
 * that first impression the same good one every time; breadth arrives seconds
 * later on its own.
 *
 * The pin is a STOCK preset, and the artist pack is staged from a build-time
 * dependency (see lib/viz-stock.ts): a clone without it has no artist presets
 * at all. So this is a preference, not a requirement. If the id isn't in the
 * staged index, this falls back to the random draw exactly as before. Reduced
 * motion still opens on a `calm` brand-native preset; the artist set is
 * uniformly intense.
 *
 * Called twice per session: once synchronously (brand-native pool only, so
 * there IS a preset before the artist index loads) and once after
 * `initStock`, over the whole library.
 */
const START_PRESET_ID = 'flexi-bouncing-balls-double-mindblob-neon-mix';

function startPresetId(): string {
  if (neuroDemoActive()) return DEMO_VIZ_PRESET_ID;   // a capture must open on the same preset every run
  if (prefersReducedMotion()) return defaultVizPresetId(true);
  // Only once the artist index is in can we know the pin resolves. Before
  // that, this falls through to the brand-native draw, and the post-initStock
  // call settles on the pin.
  if (stock.some((x) => x.id === START_PRESET_ID)) return START_PRESET_ID;
  const pool = presetPool();
  return pool[Math.floor(Math.random() * pool.length)] ?? defaultVizPresetId(false);
}

// ── the ?neuro demo (lib/neuro-demo.ts) - deterministic, silent, capture-only ─

// The pinned preset, injected wave and fixed-frame pump all live in
// lib/neuro-demo.ts now (DEMO_VIZ_PRESET_ID / demoVizWave / pumpVizDemoFrames),
// shared with the dock's DockViz renderer so both surfaces settle identically.

/**
 * The saved cycle interval, delegated to lib/viz-cycle.ts.
 *
 * The policy (which intervals exist, the reduced-motion default, and
 * migrating the old boolean form) is shared with the catalog's audio details
 * modal, so a rhythm chosen in one place is honoured in the other and neither
 * can drift. Only the '0' fast path stays local: the shared loader already
 * returns 0 for it via the choices check.
 */
function readCyclePref(): number {
  return loadCycleSeconds();
}
function writeCyclePref(seconds: number): void {
  saveCycleSeconds(seconds);
}

type SurfaceKind = 'inline' | 'panel';

/**
 * Which visualiser is drawing. `meter` is the frequency-bar analyser that
 * catalog audio previews use, the same `drawMeterBars` that paints the
 * player's strip meter, so the two surfaces speak one visual language.
 * Left-click flips between them; right-click still opens the options menu.
 *
 * `meter` is the DEFAULT: it's the quiet, cheap, always-readable view (no
 * WebGL context, no preset download), and MilkDrop is the thing you opt into.
 */
type VizMode = 'milkdrop' | 'meter';

function readModePref(): VizMode {
  // The ?neuro demo exists to show the visualizer; the meter default would leave a
  // flat baseline (its analyser never exists in the demo). In-memory only.
  if (neuroDemoActive()) return 'milkdrop';
  try { return localStorage.getItem(MODE_KEY) === 'milkdrop' ? 'milkdrop' : 'meter'; } catch { return 'meter'; }
}
function writeModePref(m: VizMode): void {
  try { localStorage.setItem(MODE_KEY, m); } catch { /* best-effort */ }
}

/** One live visualizer surface. */
interface Surface {
  kind: SurfaceKind;
  doc: Document;
  win: Window;
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  note: HTMLElement;
  menu: HTMLElement;
  title: HTMLElement | null;
  handle: VizHandle | null;
  /**
   * The mount in flight, if any.
   *
   * `handle` is not assigned until after two awaits (the butterchurn dynamic
   * import and the token read), so `if (s.handle) return` is NOT sufficient
   * re-entrancy protection. Two calls inside that window both pass it and both
   * call `createVisualizer` on the same canvas, producing two renderers over
   * one GL context: doubled cost, garbled output, and an unreachable first
   * handle whose audio tap can never be disconnected. Several paths hit this
   * deterministically (showNeuroDock builds the dock AND then calls
   * refreshDockViz; reopenNeuroDock calls it twice).
   */
  mounting: Promise<void> | null;
  /** Which visualiser is showing. */
  mode: VizMode;
  /** rAF id of the 2D meter loop, when `mode === 'meter'`. */
  meterRaf: number;
  /** Listeners registered outside `root`, to unregister on teardown. */
  cleanup: Array<() => void>;
}

/** The dock's 4:3 panel. Suspended (fully torn down) while an expanded surface is open. */
let inlineSurface: Surface | null = null;
/** The dock element the inline panel lives in, remembered across suspension so closing
 *  an overlay can rebuild the panel. Kept separately from `inlineSurface` because that
 *  is nulled on teardown: a half-destroyed surface object whose document listeners had
 *  been removed but whose fields survived was a real source of dead controls. */
let inlineContainer: HTMLElement | null = null;
/** The overlay or the popout - at most one, and it takes over from `inlineSurface`. */
let expanded: Surface | null = null;

/** Preset + cycling are MODULE state, shared by every surface, so escalating from the
 *  dock panel to fullscreen continues the same picture instead of restarting. */
let currentPresetId = '';
/** Whether the session's opening preset has been drawn from the FULL library (which needs
 *  the artist index loaded), or is still the synchronous brand-native stand-in. A deliberate
 *  pick also sets it, so nothing overwrites a choice already made. */
let startPicked = false;
/** Seconds between automatic preset changes; 0 = off. */
let cycleSeconds = 0;
let cycleTimer: ReturnType<typeof setInterval> | undefined;
/** The artist presets available, and how hard the brand overrides their colour. */
let stock: StockPresetInfo[] = [];
let brandTint: BrandTint = 'strong';
/** The current preset id may name one of OURS or one of THEIRS; ids can't collide because
 *  artist ids are slugs derived from filenames and ours are short keywords. */
function isStockId(id: string): boolean { return stock.some((x) => x.id === id); }

/** The brand's colour schemes, and which one is showing. */
let schemes: VizScheme[] = [];
let currentSchemeId = '';


/** Every surface currently alive, for broadcasting a preset change. */
function liveSurfaces(): Surface[] {
  return [inlineSurface, expanded].filter((s): s is Surface => s !== null);
}
/**
 * The host, kept for the lifetime of the module: a popout (or a re-mount after the
 * first 'press play') needs it again to re-derive the palette AND to wire the
 * popout's own player. It's the web shell's full host, which satisfies both the
 * NeurospicyHost the player needs and the tokens slice the palette reads.
 */
let vizHost: (NeurospicyHost & VizPaletteHost) | undefined;

// ── surface construction ─────────────────────────────────────────────────────

/** Chrome the floating panel carries. The inline panel sits directly under the dock's own
 *  header, which already shows the track, so a second toolbar there would be noise. */
function barHtml(kind: SurfaceKind): string {
  if (kind === 'inline') return '';
  return `<div class="viz-bar" data-viz-bar data-viz-drag>
      <span class="viz-title" data-viz-title></span>
      <span class="viz-vol" data-viz-vol>
        <button type="button" class="viz-btn" data-viz-vol-btn aria-label="Music volume" aria-expanded="false">${icon('volumeOn', { size: 16 })}</button>
        <div class="viz-vol-pop" data-viz-vol-pop hidden>
          <input type="range" min="0" max="1" step="0.05" value="${getNeurospicy().volume}" data-mp-volume aria-label="Music volume" aria-orientation="vertical">
        </div>
      </span>
      <button type="button" class="viz-btn" data-viz-menu-btn aria-label="Visualizer options" aria-haspopup="menu" aria-expanded="false">${icon('menuDots', { size: 16 })}</button>
      <button type="button" class="viz-btn" data-viz-full aria-label="Fullscreen">${icon('monitor', { size: 16 })}</button>
      <button type="button" class="viz-btn" data-viz-close aria-label="Close visualizer">${icon('close', { size: 16, strokeWidth: 2.4 })}</button>
    </div>`;
}

/** Where the floating panel was left last time, so it reopens where you put it. */
interface PanelBox { x: number; y: number; w: number; h: number }
function readPanelBox(): PanelBox {
  const w = Math.min(560, Math.max(300, Math.round(window.innerWidth * 0.42)));
  const h = Math.round(w * 0.75) + PLAYER_ALLOWANCE;
  const fallback: PanelBox = {
    x: Math.max(12, window.innerWidth - w - 24),
    y: Math.max(12, Math.round(window.innerHeight * 0.18)),
    w, h,
  };
  try {
    const raw = localStorage.getItem(PANEL_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<PanelBox>;
    if ([p.x, p.y, p.w, p.h].some((n) => typeof n !== 'number' || !Number.isFinite(n))) return fallback;
    return clampPanel({ x: p.x!, y: p.y!, w: p.w!, h: p.h! });
  } catch {
    return fallback;
  }
}
function writePanelBox(b: PanelBox): void {
  try { localStorage.setItem(PANEL_KEY, JSON.stringify(b)); } catch { /* best-effort */ }
}

/** Keep the panel on screen. A saved position from a larger monitor, or a window that has
 *  since been resized, must not strand it somewhere unreachable. */
function clampPanel(b: PanelBox): PanelBox {
  const w = Math.min(Math.max(b.w, 280), window.innerWidth);
  const h = Math.min(Math.max(b.h, 220), window.innerHeight);
  return {
    w,
    h,
    x: Math.min(Math.max(b.x, 0), Math.max(0, window.innerWidth - w)),
    y: Math.min(Math.max(b.y, 0), Math.max(0, window.innerHeight - h)),
  };
}

/**
 * Build a surface's DOM. `host` is the element to fill: for the inline panel that's a
 * container the dock already placed, for the floating panel a fresh element we position.
 */
function buildSurface(kind: SurfaceKind, host: HTMLElement): Surface {
  ensureStyles(document);
  const root = host;
  if (kind === 'inline') {
    root.classList.add('viz-inline');
    root.setAttribute('aria-label', 'Music visualizer');
  } else {
    root.className = 'viz-surface viz-panel';
    root.setAttribute('aria-label', 'Music visualizer');
    // Deliberately NOT role="dialog"/aria-modal: the panel is a movable, non-modal
    // utility over the app - the rest of the page stays usable, so trapping focus in it
    // would be wrong. Escape still closes it.
    root.setAttribute('role', 'group');
    const box = readPanelBox();
    root.style.cssText = `left:${box.x}px;top:${box.y}px;width:${box.w}px;height:${box.h}px`;
    // music-player.ts scopes every query to the [data-music-player] node, and the panel's
    // volume control lives in the toolbar rather than the player body - so the scope has
    // to be the whole surface.
    root.setAttribute('data-music-player', '');
  }

  root.innerHTML = `
    <canvas data-viz-canvas></canvas>
    ${barHtml(kind)}
    <div class="viz-note" data-viz-note hidden></div>
    ${kind === 'inline' ? `<button type="button" class="viz-expand" data-viz-expand aria-label="Enlarge the player" title="Enlarge">${icon('arrowsV', { size: 14 })}</button>` : ''}
    ${kind === 'panel' ? `<section class="viz-player" aria-label="Music player">
      <div class="viz-player-head">${trackPickerHtml()}</div>
      ${musicPlayerBodyHtml({ meter: false, effects: false, volume: false })}
    </section>` : ''}
    <div class="viz-menu" data-viz-menu hidden role="menu"></div>
    ${kind === 'panel' ? panelGripsHtml() : ''}`;

  const menu = root.querySelector<HTMLElement>('[data-viz-menu]')!;
  if (kind === 'inline') {
    // The panel crops itself to 4:3 with overflow:hidden, which also crops a menu opened
    // inside it - and the menu is taller than the panel. Move it to <body> and position
    // it as fixed so it can overhang.
    menu.classList.add('is-portalled');
    document.body.appendChild(menu);
  }
  // CSS keys the inline panel's shape off this, so it must be set before first paint.
  root.dataset.mode = readModePref();
  return {
    kind, doc: document, win: window, root,
    canvas: root.querySelector<HTMLCanvasElement>('[data-viz-canvas]')!,
    note: root.querySelector<HTMLElement>('[data-viz-note]')!,
    menu,
    title: root.querySelector<HTMLElement>('[data-viz-title]'),
    handle: null,
    mounting: null,
    mode: readModePref(),
    meterRaf: 0,
    cleanup: [],
  };
}

/** Reflect the current preset (and scheme) name wherever a surface shows it. */
function paintTitle(s: Surface): void {
  if (!s.title) return;
  if (s.mode === 'meter') { s.title.textContent = 'Bars'; return; }
  const scheme = schemes.length > 1 ? vizSchemeById(schemes, currentSchemeId).name : '';
  s.title.textContent = scheme
    ? `${vizPresetById(currentPresetId).name} · ${scheme}`
    : vizPresetById(currentPresetId).name;
}

/** Show a centred message, or clear it. */
function setNote(s: Surface, html: string | null): void {
  s.note.innerHTML = html ?? '';
  s.note.hidden = html === null;
}

/**
 * Work out what, if anything, to tell the user. Three states the visualizer
 * can't draw through: no WebGL2, audio never started, and internet radio
 * (which plays outside the Web Audio graph, so the analyser stays flat).
 *
 * The inline panel stays QUIET about the transport: it's two centimetres under
 * a play button, so "press play" there states the obvious in a space too
 * small to spare.
 */
/** What to say when there's no signal, per the reason there isn't one. Only the panel/overlay
 *  shows these; the inline strip is too small to explain anything (see below). */
const NOTE_BY_SIGNAL: Record<NeuroSignalState, string | null> = {
  live: null,
  idle: 'Paused &mdash; the visualizer follows the music.',
  connecting: 'Connecting to the stream&hellip;',
  unanalysable: 'This station won&rsquo;t let its audio be analysed, so there&rsquo;s nothing to visualise. Try another station, or a local track.',
};

function refreshNote(s: Surface): void {
  // A ?neuro demo renders from injected audio, so the audio-readiness states below
  // don't apply: never blank, never a "press play"/"connecting" note over the shot.
  const demo = neuroDemoActive();
  // Blank out the surface when there is genuinely nothing to draw, so the dock shows its
  // own background instead of an opaque black panel.
  const blank = s.mode === 'milkdrop' && !demo && (!vizSupported() || !vizAudioReady() || !vizHasSignal());
  s.root.classList.toggle('is-idle-blank', blank);
  if (s.mode === 'meter') { setNote(s, null); return; }
  if (!vizSupported()) {
    setNote(s, s.kind === 'inline' ? null : 'This browser can&rsquo;t run the visualizer &mdash; it needs WebGL&nbsp;2.');
    return;
  }
  if (demo) { setNote(s, null); return; }
  if (!vizAudioReady() || !vizHasSignal()) {
    if (s.kind === 'inline') { setNote(s, null); return; }
    if (!vizAudioReady()) { setNote(s, 'Press play to start the visualizer.'); return; }
    // Several different things leave the analyser flat, and they have
    // different fixes, so name the actual one instead of blaming the
    // transport for a stream's CORS policy.
    setNote(s, NOTE_BY_SIGNAL[neurospicySignalState()]);
    return;
  }
  setNote(s, null);
}

// ── the bar-meter mode ───────────────────────────────────────────────────────

/**
 * Draw the frequency-bar meter into the surface's canvas.
 *
 * Deliberately reuses `drawMeterBars` from lib/audio-meter.ts, the same
 * function that paints catalog audio previews and the player's strip meter,
 * instead of a lookalike, so all three read as one thing. `attachAudioMeter`
 * is NOT usable here: it wants an <audio> element, and the focus loop plays
 * through Web Audio buffer sources. We already hold the graph's analyser,
 * which is what the drawing actually needs.
 *
 * The canvas is shared with the MilkDrop mode. A canvas can only ever have ONE
 * context type, so switching modes tears the WebGL visualizer down first; see
 * `setMode`.
 */
function startMeter(s: Surface): void {
  stopMeter(s);
  const c2d = s.canvas.getContext('2d');
  if (!c2d) return;
  const clock = s.canvas.ownerDocument.defaultView ?? window;
  const frame = (): void => {
    if (s.mode !== 'meter' || !s.canvas.isConnected || s.canvas.offsetParent === null) {
      s.meterRaf = 0;
      return;
    }
    // Size the backing store to the box, as the GL path does.
    const r = s.canvas.getBoundingClientRect();
    const dpr = Math.min(clock.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (s.canvas.width !== w) s.canvas.width = w;
    if (s.canvas.height !== h) s.canvas.height = h;
    const colour = meterColour(s);
    c2d.clearRect(0, 0, w, h);
    const a = getNeurospicyAnalyser();
    // Read per frame: the app pref is a live attribute on <html>, so a toggle
    // mid-playback parks the bars on the baseline without restarting the loop.
    if (a && vizHasSignal() && !prefersReducedMotion()) drawMeterBars(c2d, w, h, a, colour);
    else drawMeterBaseline(c2d, w, h, colour);
    s.meterRaf = clock.requestAnimationFrame(frame);
  };
  s.meterRaf = clock.requestAnimationFrame(frame);
}

function stopMeter(s: Surface): void {
  if (!s.meterRaf) return;
  (s.canvas.ownerDocument.defaultView ?? window).cancelAnimationFrame(s.meterRaf);
  s.meterRaf = 0;
}

/**
 * The meter's bar colour: the active scheme's hero, so both modes agree about
 * what colour the brand is and a scheme change shows up in either.
 *
 * The INLINE meter sits on the dock's themed surface rather than on black, so
 * it uses the scheme's mid-ramp tone. The hero itself can be too light to read
 * on a light theme, and the ramp already carries a full dark-to-light range of
 * the same hue to choose from.
 */
function meterColour(s: Surface): string {
  const p = schemes.length ? vizSchemeById(schemes, currentSchemeId).palette : null;
  if (!p) return getComputedStyle(s.canvas).color || '#888';
  const hex = (c: readonly number[]): string =>
    `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  if (s.kind !== 'inline' || p.ramp.length === 0) return hex(p.hero);
  // Pick from the ramp by the surface's own background: a light dock wants
  // the darker end of the brand's range, a dark dock the lighter end.
  const bg = getComputedStyle(s.root).backgroundColor;
  const m = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(bg);
  const bgLum = m
    ? (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255
    : 0;
  const i = bgLum > 0.5
    ? Math.floor(p.ramp.length * 0.25)
    : Math.floor(p.ramp.length * 0.72);
  return hex(p.ramp[Math.min(i, p.ramp.length - 1)]!);
}

/**
 * Flip a surface between the MilkDrop visualizer and the bar meter.
 *
 * The two share one canvas, and a canvas is permanently bound to the first
 * context type it hands out, so this is a genuine teardown/rebuild, not a
 * draw-mode flag. Cheap enough (butterchurn's module is already loaded) that
 * it feels instant.
 */
function setMode(s: Surface, mode: VizMode): void {
  if (s.mode === mode) return;
  s.mode = mode;
  writeModePref(mode);
  s.root.dataset.mode = mode;
  if (mode === 'meter') {
    s.handle?.destroy();
    s.handle = null;
    // The GL context still owns the old canvas, so swap in a fresh one for 2D.
    replaceCanvas(s);
    startMeter(s);
  } else {
    stopMeter(s);
    // Drop any handle still pointing at the outgoing canvas, or ensureMounted's
    // `if (s.handle) return` would short-circuit and the surface would never re-mount.
    s.handle?.destroy();
    s.handle = null;
    replaceCanvas(s);
    void ensureMounted(s);
  }
  refreshNote(s);
  for (const t of liveSurfaces()) if (!t.menu.hidden) rerenderMenu(t, `[data-viz-mode="${mode}"]`);
}

/** Swap the canvas for a fresh one, carrying the listeners over. Necessary because a
 *  canvas that has produced a WebGL context can never produce a 2D one, or vice versa. */
function replaceCanvas(s: Surface): void {
  const fresh = s.doc.createElement('canvas');
  fresh.setAttribute('data-viz-canvas', '');
  s.canvas.replaceWith(fresh);
  s.canvas = fresh;
  wireCanvas(s);
}

// ── preset + auto-cycling (module-level, shared by every surface) ─────────────

/**
 * Switch preset on every live surface. `remember` distinguishes a deliberate
 * choice (the cycle clock restarts so the pick gets its full turn) from an
 * automatic rotation, which must not push the timer out and stall the
 * rotation it was started by.
 *
 * Nothing is written to storage either way. The visualizer always opens on
 * its own opener (see `startPresetId`), so a remembered pick would only ever
 * be ignored.
 */
function applyPreset(id: string, opts: { remember: boolean }): void {
  currentPresetId = id;
  if (opts.remember) {
    startPicked = true;
    startCycle();
  }
  for (const s of liveSurfaces()) {
    if (isStockId(id)) void applyStockPreset(s, id);
    else s.handle?.setPreset(id);
    paintTitle(s);
    // An open menu shows which preset is current; keep its checkmark honest.
    if (!s.menu.hidden) rerenderMenu(s, `[data-viz-preset="${id}"]`);
  }
}

/**
 * Fetch an artist preset, wrap it with the brand blend, and hand it to the renderer.
 *
 * Falls back to the brand-native default when the pack isn't staged or the
 * file is missing, instead of leaving a black frame. A clone without the
 * optional dependency should still have a working visualizer.
 */
async function applyStockPreset(s: Surface, id: string): Promise<void> {
  const handle = s.handle;
  if (!handle) return;
  const preset = await loadStockPreset(id, handle.palette(), brandTint);
  // The surface can be gone, or the user can have moved on, across that fetch.
  if (!liveSurfaces().includes(s) || s.handle !== handle || currentPresetId !== id) return;
  if (!preset) {
    handle.setPreset(vizPresetById(null).id);
    return;
  }
  handle.setRawPreset(id, preset);
}

/** Re-apply the current preset so a tint change takes effect immediately. */
function setBrandTint(t: BrandTint): void {
  brandTint = t;
  writeBrandTint(t);
  if (isStockId(currentPresetId)) {
    for (const s of liveSurfaces()) void applyStockPreset(s, currentPresetId);
  }
}

/** Every preset that can be shown: ours and the artists'. Empty of artist entries until
 *  `initStock` has run, which is why the opening pick happens twice. */
function presetPool(): string[] {
  return [...VIZ_PRESETS.map((d) => d.id), ...stock.map((x) => x.id)];
}

/**
 * The next preset for auto-cycling, drawn at random from the WHOLE library
 * (ours and the artists'), because that breadth is the point of having them.
 * Random rather than sequential: with 200+ entries a sequential walk would
 * take hours to come round, and consecutive artist presets are often
 * near-variants of each other.
 *
 * Reduced motion stays on our own `calm` presets only: the artist set is
 * uniformly intense and none of it is appropriate for someone who asked for
 * less movement.
 */
function nextCyclePresetId(): string {
  if (prefersReducedMotion()) return nextVizPresetId(currentPresetId, true);
  const pool = presetPool();
  if (pool.length <= 1) return currentPresetId;
  const others = pool.filter((id) => id !== currentPresetId);
  return others[Math.floor(Math.random() * others.length)]!;
}

function startCycle(): void {
  stopCycle();
  if (cycleSeconds <= 0) return;
  cycleTimer = setInterval(() => {
    // A stood-down surface (collapsed dock: the canvas stops being laid out,
    // so the render loop retires but the handle survives) must not be cycled.
    // setPreset on a renderer that isn't drawing costs a full preset rebuild
    // for nothing, every interval.
    if (!liveSurfaces().some((s) => s.handle?.running() || s.meterRaf !== 0)) return;
    // Don't rotate through presets nobody can see: with no audio signal the
    // field is static anyway, and cycling would just churn the GPU behind a
    // status note.
    if (!vizHasSignal()) return;
    applyPreset(nextCyclePresetId(), { remember: false });
    // Colour changes WITH the style, and at random: the schemes are few, so
    // stepping them in order reads as an obvious loop after one lap. Skipped
    // under reduced motion, since swapping the whole palette is itself motion.
    if (!prefersReducedMotion() && schemes.length > 1) {
      applyScheme(randomVizSchemeId(schemes, currentSchemeId), { remember: false });
    }
  }, cycleSeconds * 1000);
}

function stopCycle(): void {
  if (cycleTimer !== undefined) {
    clearInterval(cycleTimer);
    cycleTimer = undefined;
  }
}

/** Switch colour scheme on every live surface. Like `applyPreset`, an automatic change
 *  is not persisted - otherwise cycling would overwrite the user's chosen scheme. */
function applyScheme(id: string, opts: { remember: boolean }): void {
  if (schemes.length === 0) return;
  const scheme = vizSchemeById(schemes, id);
  currentSchemeId = scheme.id;
  if (opts.remember) {
    try { localStorage.setItem(SCHEME_KEY, scheme.id); } catch { /* best-effort */ }
    startCycle();
  }
  for (const s of liveSurfaces()) {
    s.handle?.setPalette(scheme.palette);
    paintTitle(s);
    if (!s.menu.hidden) rerenderMenu(s, `[data-viz-scheme="${scheme.id}"]`);
  }
}

function setCycle(seconds: number): void {
  cycleSeconds = seconds;
  writeCyclePref(seconds);
  startCycle();
}

// ── options menu ─────────────────────────────────────────────────────────────

function menuHtml(s: Surface): string {
  const full = document.fullscreenElement !== null || isFullpage(s);
  const choices = CYCLE_CHOICES.map((sec) =>
    `<button type="button" class="viz-pill${sec === cycleSeconds ? ' is-on' : ''}" role="menuitemradio"`
    + ` aria-checked="${sec === cycleSeconds}" data-viz-cycle="${sec}"`
    + ` aria-label="${sec === 0 ? 'Do not cycle presets' : `Cycle presets every ${sec} seconds`}">`
    + `${sec === 0 ? 'Off' : `${sec}s`}</button>`).join('');
  const modeRow = `<div class="viz-menu-row"><span class="viz-menu-row-label">Visualiser</span>`
    + `<span class="viz-pills" role="group" aria-label="Visualiser">`
    + `<button type="button" class="viz-pill${s.mode === 'milkdrop' ? ' is-on' : ''}" role="menuitemradio"`
    + ` aria-checked="${s.mode === 'milkdrop'}" data-viz-mode="milkdrop">MilkDrop</button>`
    + `<button type="button" class="viz-pill${s.mode === 'meter' ? ' is-on' : ''}" role="menuitemradio"`
    + ` aria-checked="${s.mode === 'meter'}" data-viz-mode="meter">Bars</button>`
    + `</span></div>`;
  const actions = `<div class="viz-menu-row"><span class="viz-menu-row-label">Cycle</span>`
    + `<span class="viz-pills" role="group" aria-label="Cycle interval">${choices}</span></div>`
    + `<button type="button" class="viz-menu-item" role="menuitem" data-viz-act="full"><span class="viz-menu-dot"></span>${full ? 'Exit fullscreen' : 'Fullscreen'}</button>`
    + (s.kind === 'inline'
      ? `<button type="button" class="viz-menu-item" role="menuitem" data-viz-act="pop"><span class="viz-menu-dot"></span>Enlarge</button>`
      : `<button type="button" class="viz-menu-item" role="menuitem" data-viz-act="close"><span class="viz-menu-dot"></span>Close visualizer</button>`);

  // Bars mode has no preset or colour of its own - offer only what applies.
  if (s.mode !== 'milkdrop') return `${modeRow}<div class="viz-menu-sep"></div>${actions}`;


  const tintRow = stock.length > 0
    ? `<div class="viz-menu-row"><span class="viz-menu-row-label">Brand colour</span>`
      + `<span class="viz-pills" role="group" aria-label="How strongly the brand recolours artist presets">`
      + BRAND_TINTS.map((t) =>
        `<button type="button" class="viz-pill${t === brandTint ? ' is-on' : ''}" role="menuitemradio"`
        + ` aria-checked="${t === brandTint}" data-viz-tint="${t}">${t === 'off' ? 'Off' : t[0]!.toUpperCase() + t.slice(1)}</button>`).join('')
      + `</span></div>`
    : '';
  // Colour schemes as a PILL ROW, like every other setting here: one
  // horizontal group per decision, so the settings read as a compact block of
  // toggles and the preset list gets the rest of the height. As rows they
  // were the one setting that grew with the brand (up to MAX_SCHEMES = 6
  // full-width items), pushing the list down by exactly as much.
  const schemeRow = schemes.length > 1
    ? `<div class="viz-menu-row"><span class="viz-menu-row-label">Colour</span>`
      + `<span class="viz-pills" role="group" aria-label="Colour scheme">`
      + schemes.map((sc) =>
        `<button type="button" class="viz-pill${sc.id === currentSchemeId ? ' is-on' : ''}" role="menuitemradio"`
        + ` aria-checked="${sc.id === currentSchemeId}" data-viz-scheme="${escape(sc.id)}">${escape(sc.name)}</button>`).join('')
      + `</span></div>`
    : '';
  // Settings first (fixed height), then the search + list, which take
  // everything left. `actions` moves ABOVE the list rather than below it:
  // trailing rows under a scroller are rows the list has to give height back
  // to, and Fullscreen/Close are one click each.
  return `${modeRow}${tintRow}${schemeRow}<div class="viz-menu-sep"></div>${actions}`
    + `<div class="viz-menu-sep"></div>`
    + `<input type="search" class="viz-search" data-viz-search placeholder="Search ${presetCount()} presets…" aria-label="Search presets" autocomplete="off">`
    + `<div class="viz-list" data-viz-list>${presetListHtml()}</div>`;
}

function presetCount(): number { return VIZ_PRESETS.length + stock.length; }

/**
 * The preset rows, filtered by `query`: ONE flat scrolling list of everything.
 *
 * NO GROUP HEADINGS, and the brand-native presets no longer lead (2026-07-31).
 * They used to get a "Brand" heading and the top of the list, on the
 * reasoning that they are the guaranteed-on-brand set. But every artist
 * preset is run through the brand blend too (lib/viz-stock.ts), so
 * "on-brand" was never the distinction it claimed to be, and Andy's read is
 * that ours are the weakest-looking of the pack. Leading with them meant the
 * first screen of a 200+ library was its worst screen. They stay in the
 * list, just not announced and not first.
 *
 * Headings went with them: with one heading per group the sticky-free labels
 * were pure scroll cost, and a flat list is what makes a long scroll feel
 * short.
 *
 * Order is by TIER: butterchurn's own packs (1 = the 29 it opens with, ...
 * 6 = in no pack), the only real quality signal the corpus has. Ours sort in
 * at tier 3, so they sit mid-list among peers rather than at either extreme.
 * Each artist row keeps its author: these are other people's work, and
 * attribution belongs next to it rather than buried in a licence file.
 */
function presetListHtml(query = ''): string {
  const q = query.trim().toLowerCase();
  const hit = (...fields: string[]): boolean => !q || fields.some((f) => f.toLowerCase().includes(q));
  const row = (id: string, name: string, author?: string): string =>
    `<button type="button" class="viz-menu-item" role="menuitemradio" data-viz-preset="${escape(id)}"`
    + ` aria-checked="${id === currentPresetId}"><span class="viz-menu-dot"></span>${escape(name)}`
    + (author ? `<span class="viz-by">${escape(author)}</span>` : '') + '</button>';

  // `tier` is optional on an index staged before tiers existed - treat a missing one as
  // the bottom tier rather than as 0, or an old index would sort itself to the front.
  const OURS_TIER = 3;
  const entries: Array<{ tier: number; id: string; name: string; author?: string }> = [
    ...VIZ_PRESETS.filter((d) => hit(d.name)).map((d) => ({ tier: OURS_TIER, id: d.id, name: d.name })),
    ...stock.filter((x) => hit(x.name, x.author))
      .map((x) => ({ tier: x.tier ?? (x.popular ? 1 : 6), id: x.id, name: x.name, author: x.author })),
  ];
  if (!entries.length) return '<div class="viz-list-empty">No presets match</div>';
  entries.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
  return entries.map((e) => row(e.id, e.name, e.author)).join('');
}

/**
 * Re-render an open menu in place and put focus back where it was.
 *
 * The mode, tint and cycle rows deliberately keep the menu open so the change
 * is visible, but replacing `innerHTML` destroys the focused element, which
 * silently drops keyboard focus to <body>, stranding anyone who opened the
 * menu with Enter. `selector` names the control to refocus: its identity
 * survives the re-render even though the node doesn't. The search query is
 * carried across too, or filtering would reset on every click.
 */
function rerenderMenu(s: Surface, selector: string): void {
  const hadFocus = s.menu.contains(s.doc.activeElement);
  const query = s.menu.querySelector<HTMLInputElement>('[data-viz-search]')?.value ?? '';
  s.menu.innerHTML = menuHtml(s);
  const search = s.menu.querySelector<HTMLInputElement>('[data-viz-search]');
  if (search && query) {
    search.value = query;
    paintPresetList(s, query);
  }
  if (!hadFocus) return;
  const target = s.menu.querySelector<HTMLElement>(selector)
    ?? s.menu.querySelector<HTMLElement>('.viz-menu-item, .viz-pill');
  target?.focus();
}

/** Repaint only the result rows, so typing doesn't rebuild (and refocus) the whole menu. */
function paintPresetList(s: Surface, query: string): void {
  const list = s.menu.querySelector<HTMLElement>('[data-viz-list]');
  if (list) list.innerHTML = presetListHtml(query);
}

function closeMenu(s: Surface): void {
  s.menu.hidden = true;
  s.root.querySelector<HTMLButtonElement>('[data-viz-menu-btn]')?.setAttribute('aria-expanded', 'false');
}

/** Open the menu at viewport point (x, y), clamped so it never spills off-surface. */
function openMenu(s: Surface, x: number, y: number): void {
  s.menu.innerHTML = menuHtml(s);
  s.menu.hidden = false;
  const mw = s.menu.offsetWidth;
  const mh = s.menu.offsetHeight;
  if (s.menu.classList.contains('is-portalled')) {
    // position:fixed on <body>, so the pointer's viewport coords are used
    // directly and clamped to the viewport. Opens upward from the click when
    // there's room above.
    s.menu.style.left = `${Math.max(8, Math.min(x - mw / 2, s.win.innerWidth - mw - 8))}px`;
    const above = y - mh - 10;
    s.menu.style.top = `${above >= 8 ? above : Math.max(8, Math.min(y + 10, s.win.innerHeight - mh - 8))}px`;
  } else {
    const r = s.root.getBoundingClientRect();
    s.menu.style.left = `${Math.max(8, Math.min(x - r.left, r.width - mw - 8))}px`;
    s.menu.style.top = `${Math.max(8, Math.min(y - r.top, r.height - mh - 8))}px`;
  }
  // Focus the search field on a FINE pointer: with 200+ presets, typing is the primary
  // way in and the list is far too long to hunt by eye. On TOUCH, though, a two-finger tap
  // routes here (via contextmenu) and focusing the field pops the soft keyboard the instant
  // the menu opens - jarring, and typing isn't the touch primary. So on coarse pointers focus
  // the colour-scheme control ("the brand colour") instead: it's a button, so no keyboard.
  const search = s.menu.querySelector<HTMLInputElement>('[data-viz-search]');
  const coarse = s.win.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (search && !coarse) search.focus();
  else (s.menu.querySelector<HTMLButtonElement>('.viz-pill, .viz-menu-item') ?? search)?.focus();
}

/** The non-native full-VIEWPORT state - iOS Safari has no element fullscreen, so
 *  "fullscreen" there means filling the tab. Same look, different mechanism; the
 *  ResizeObserver picks the size change up like any other. */
function isFullpage(s: Surface): boolean {
  return s.root.classList.contains('is-fullpage');
}
function setFullpage(s: Surface, on: boolean): void {
  s.root.classList.toggle('is-fullpage', on);
}

function toggleFullscreen(s: Surface): void {
  if (isFullpage(s)) { setFullpage(s, false); return; }
  if (document.fullscreenElement) { void document.exitFullscreen().catch(() => { /* denied */ }); return; }
  // Fullscreening the inline panel would fullscreen a 300px element inside the dock, so
  // escalate: open the floating panel and fullscreen THAT. Leaving fullscreen then lands
  // on the player rather than on some intermediate mode.
  if (s.kind === 'inline') { void openVizPanel(vizHost, { fullscreen: true }); return; }
  // Native where it exists; the viewport fallback where the API is missing or
  // refuses (iOS Safari on any element). Never silently nothing.
  if (s.root.requestFullscreen) {
    s.root.requestFullscreen().catch(() => setFullpage(s, true));
    return;
  }
  setFullpage(s, true);
}

/**
 * Make the panel draggable by its toolbar, and remember where it ends up.
 *
 * Pointer events with capture, not mouse events, so a fast drag that leaves
 * the element still tracks. Skipped entirely while fullscreen, where the
 * panel IS the screen and has nowhere to move.
 */
function wireDrag(s: Surface): void {
  const bar = s.root.querySelector<HTMLElement>('[data-viz-drag]');
  if (!bar) return;
  const wobble = attachWobble(s.root);
  s.cleanup.push(() => wobble.dispose());
  let from: { px: number; py: number; x: number; y: number } | null = null;
  let prevX = 0;
  let prevY = 0;
  bar.addEventListener('pointerdown', (e) => {
    // Let the controls in the bar work; only bare bar area starts a drag.
    if ((e.target as HTMLElement).closest('button, input, .viz-vol')) return;
    if (document.fullscreenElement || isFullpage(s)) return;
    from = { px: e.clientX, py: e.clientY, x: s.root.offsetLeft, y: s.root.offsetTop };
    prevX = e.clientX;
    prevY = e.clientY;
    bar.setPointerCapture(e.pointerId);
    s.root.classList.add('is-dragging');
    wobble.grab(e.clientX, e.clientY);
  });
  bar.addEventListener('pointermove', (e) => {
    if (!from) return;
    const box = clampPanel({
      x: from.x + (e.clientX - from.px),
      y: from.y + (e.clientY - from.py),
      w: s.root.offsetWidth,
      h: s.root.offsetHeight,
    });
    s.root.style.left = `${box.x}px`;
    s.root.style.top = `${box.y}px`;
    wobble.drag(e.clientX - prevX, e.clientY - prevY);
    prevX = e.clientX;
    prevY = e.clientY;
  });
  const end = (e: PointerEvent): void => {
    if (!from) return;
    from = null;
    s.root.classList.remove('is-dragging');
    if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
    wobble.release();
    persistPanel(s);
  };
  bar.addEventListener('pointerup', end);
  bar.addEventListener('pointercancel', end);

  // Resize from any edge or corner. The shared eight-grip primitive (lib/panel-grips.ts,
  // also worn by the Colour Lab's popped-out charts) replaced the native CSS `resize`
  // corner: one corner is not where people reach, and it reported nothing, so the canvas
  // had to be re-measured by observation rather than told.
  s.cleanup.push(wirePanelGrips(s.root, {
    read: () => ({ x: s.root.offsetLeft, y: s.root.offsetTop, w: s.root.offsetWidth, h: s.root.offsetHeight }),
    apply: (b) => {
      s.root.style.left = `${b.x}px`;
      s.root.style.top = `${b.y}px`;
      s.root.style.width = `${b.w}px`;
      s.root.style.height = `${b.h}px`;
    },
    clamp: clampPanel,
    min: { w: 280, h: 220 },
    locked: () => document.fullscreenElement !== null,
    onMove: () => s.handle?.resize(),
    onEnd: () => persistPanel(s),
  }));

  // A window resize re-clamps the panel, and that change arrives through no
  // gesture, so the box is observed as well as driven.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(() => {
      s.handle?.resize();
      persistPanel(s);
    });
    ro.observe(s.root);
    s.cleanup.push(() => ro.disconnect());
  }
}

function persistPanel(s: Surface): void {
  if (s.kind !== 'panel' || document.fullscreenElement) return;
  writePanelBox({ x: s.root.offsetLeft, y: s.root.offsetTop, w: s.root.offsetWidth, h: s.root.offsetHeight });
}

// ── wiring ──────────────────────────────────────────────────────────────────

/**
 * Canvas-only listeners. Split out from `wireSurface` because switching
 * visualiser mode REPLACES the canvas element (a canvas is permanently bound
 * to its first context type), so these have to be re-attachable independently
 * of the rest of the surface.
 */
function wireCanvas(s: Surface): void {
  // Right-click opens the options menu - the MilkDrop/Winamp convention, and scoped to
  // the canvas alone so the rest of the app keeps its native menu.
  s.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openMenu(s, e.clientX, e.clientY);
  });
  // LEFT-click flips visualiser: MilkDrop ⇄ the bar meter. A plain click is the cheapest
  // possible way to say "show me the other one", and it keeps the panel useful on touch
  // where there is no right-click at all.
  s.canvas.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!s.menu.hidden) { closeMenu(s); return; }
    setMode(s, s.mode === 'milkdrop' ? 'meter' : 'milkdrop');
  });
  s.canvas.addEventListener('dblclick', () => toggleFullscreen(s));
}

function wireSurface(s: Surface): void {
  const menuBtn = s.root.querySelector<HTMLButtonElement>('[data-viz-menu-btn]');

  wireCanvas(s);
  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!s.menu.hidden) { closeMenu(s); return; }
    const r = menuBtn.getBoundingClientRect();
    menuBtn.setAttribute('aria-expanded', 'true');
    openMenu(s, r.left, r.bottom + 6);
  });
  // Typing filters the rows in place. `input` on the menu (delegated) rather than on the
  // field itself, because the field is recreated on every menu re-render.
  s.menu.addEventListener('input', (e) => {
    const field = (e.target as HTMLElement).closest<HTMLInputElement>('[data-viz-search]');
    if (field) paintPresetList(s, field.value);
  });
  // Enter in the search box activates the first result - the fast path when you know the
  // preset's name and don't want to reach for the mouse.
  s.menu.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (!(e.target as HTMLElement).closest('[data-viz-search]')) return;
    e.preventDefault();
    s.menu.querySelector<HTMLElement>('[data-viz-list] [data-viz-preset]')?.click();
  });
  s.menu.addEventListener('click', (e) => {
    e.stopPropagation();
    const item = (e.target as HTMLElement).closest<HTMLElement>('[data-viz-preset], [data-viz-scheme], [data-viz-act], [data-viz-cycle], [data-viz-mode], [data-viz-tint]');
    if (!item) return;
    const tint = item.dataset.vizTint;
    if (tint) {
      setBrandTint(tint as BrandTint);
      rerenderMenu(s, `[data-viz-tint="${tint}"]`);
      return;
    }
    const mode = item.dataset.vizMode;
    if (mode === 'milkdrop' || mode === 'meter') {
      setMode(s, mode);
      rerenderMenu(s, `[data-viz-mode="${mode}"]`);
      return;
    }
    const scheme = item.dataset.vizScheme;
    if (scheme) {
      // Stays OPEN, like the mode/tint/cycle pills it now sits beside: comparing colour
      // schemes means flipping between them, and reopening the menu for each was the
      // cost of it having been a full-width row. applyScheme re-renders the open menu
      // itself (it has to - an automatic scheme change must update the checkmarks too).
      applyScheme(scheme, { remember: true });
      return;
    }
    const cycle = item.dataset.vizCycle;
    if (cycle !== undefined) {
      // Keep the menu open so the selected interval visibly takes effect.
      setCycle(Number(cycle));
      rerenderMenu(s, `[data-viz-cycle="${cycle}"]`);
      return;
    }
    const preset = item.dataset.vizPreset;
    if (preset) {
      applyPreset(preset, { remember: true });
      closeMenu(s);
      return;
    }
    closeMenu(s);
    const act = item.dataset.vizAct;
    if (act === 'full') toggleFullscreen(s);
    else if (act === 'pop') void openVizPanel(vizHost);
    else closeVizOverlay();
  });
  // Click away closes the menu.
  const onDocClick = (e: Event): void => {
    if (s.menu.hidden) return;
    const t = e.target as Node;
    if (!s.menu.contains(t) && !(t as HTMLElement).closest?.('[data-viz-menu-btn], [data-viz-canvas]')) closeMenu(s);
  };
  s.doc.addEventListener('click', onDocClick);
  s.cleanup.push(() => s.doc.removeEventListener('click', onDocClick));
  // Enlarge opens the panel WITHOUT going fullscreen - the beat-mark grip in the dock is
  // the "make it as big as possible" route; this one is "give me the bigger player".
  s.root.querySelector<HTMLButtonElement>('[data-viz-expand]')?.addEventListener('click', (e) => {
    e.stopPropagation();   // don't let the canvas's click-to-switch-visualiser fire too
    void openVizPanel(vizHost);
  });
  s.root.querySelector<HTMLButtonElement>('[data-viz-full]')?.addEventListener('click', () => toggleFullscreen(s));
  s.root.querySelector<HTMLButtonElement>('[data-viz-pop]')?.addEventListener('click', () => void openVizPanel(vizHost));
  s.root.querySelector<HTMLButtonElement>('[data-viz-close]')?.addEventListener('click', () => closeVizOverlay());

  // Music volume (popout only): speaker button toggles a vertical slider. The slider
  // carries [data-mp-volume], so music-player.ts's own wiring drives it - this only
  // opens and closes the popover.
  const volBtn = s.root.querySelector<HTMLButtonElement>('[data-viz-vol-btn]');
  const volPop = s.root.querySelector<HTMLElement>('[data-viz-vol-pop]');
  if (volBtn && volPop) {
    const openVol = (open: boolean): void => {
      volPop.hidden = !open;
      volBtn.setAttribute('aria-expanded', String(open));
    };
    volBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openVol(volPop.hidden);
      if (!volPop.hidden) volPop.querySelector<HTMLInputElement>('input')?.focus();
    });
    volPop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); openVol(false); volBtn.focus(); }
    });
    s.root.addEventListener('click', (e) => {
      if (!volPop.hidden && !volPop.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-viz-vol-btn]')) openVol(false);
    });
  }

  // Escape. While fullscreen the browser's own exit owns the key, so we stand down and
  // a second press closes. The INLINE panel never closes on Escape - it's part of the
  // dock, and the dock has its own Escape (collapse) that must keep working.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (!s.menu.hidden) { e.stopPropagation(); closeMenu(s); return; }
    if (s.kind === 'inline') return;
    if (s.doc.fullscreenElement) return;
    // The viewport-fallback full page peels off one layer per press, like the
    // native exit does: first Escape back to the windowed panel, second closes.
    if (isFullpage(s)) { e.stopPropagation(); setFullpage(s, false); return; }
    e.stopPropagation();
    closeVizOverlay();
  };
  s.doc.addEventListener('keydown', onKey);
  s.cleanup.push(() => s.doc.removeEventListener('keydown', onKey));

  if (s.kind !== 'inline') {
    // Idle-hide the toolbar, like a video player.
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const wake = (): void => {
      s.root.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        // Never idle out from under an open menu OR an open track picker - the picker
        // belongs to music-player.ts, so ask the DOM rather than tracking its state.
        const pickerOpen = s.root.querySelector('[data-mp-picker]')?.getAttribute('data-open') === 'true';
        if (s.menu.hidden && !pickerOpen) s.root.classList.add('is-idle');
      }, 2600);
    };
    s.root.addEventListener('pointermove', wake);
    s.root.addEventListener('pointerdown', wake);
    // Keyboard users never move the pointer, so focus must wake it too - otherwise the
    // toolbar fades out and Tab lands on controls that are `pointer-events: none`.
    s.root.addEventListener('focusin', wake);
    wake();
    s.cleanup.push(() => clearTimeout(idleTimer));
  }

  // Fullscreen and window resizes both change the canvas box.
  const onResize = (): void => s.handle?.resize();
  s.doc.addEventListener('fullscreenchange', onResize);
  s.win.addEventListener('resize', onResize);
  s.cleanup.push(() => s.doc.removeEventListener('fullscreenchange', onResize));
  s.cleanup.push(() => s.win.removeEventListener('resize', onResize));

  // Transport changes flip the status note, and the very first play is what makes a
  // visualizer possible at all.
  const onPlaying = (): void => {
    void ensureMounted(s);
    refreshNote(s);   // also drives the idle-blank surface state
    // The popout carries its own player, and nothing else repaints it: a track changed
    // from the dock (or an auto-advance to the next track) would otherwise leave its
    // now-playing label showing the previous song indefinitely.
    if (s.kind === 'panel') refreshMusicPlayer(s.root);
  };
  document.addEventListener('lolly:neuro-playing', onPlaying);
  s.cleanup.push(() => document.removeEventListener('lolly:neuro-playing', onPlaying));
  if (s.kind === 'panel') {
    // An upload/deletion invalidates the track list; music-player rebuilds its own rows
    // but the surrounding label still needs a repaint.
    const onTracks = (): void => refreshMusicPlayer(s.root);
    document.addEventListener('lolly:neuro-tracks', onTracks);
    s.cleanup.push(() => document.removeEventListener('lolly:neuro-tracks', onTracks));
  }
}

/** Mount the GL visualizer if it isn't already and the prerequisites are met. */
function ensureMounted(s: Surface): Promise<void> {
  // The bar meter owns the canvas in that mode - don't create a GL context over it.
  if (s.mode === 'meter') { startMeter(s); return Promise.resolve(); }
  // A ?neuro demo mounts against injected audio, so the analyser (which only exists
  // once real audio has started - never in a capture) must not gate it.
  if (s.handle || (!vizAudioReady() && !neuroDemoActive()) || !vizSupported()) return Promise.resolve();
  // Coalesce concurrent callers onto the one in-flight mount. Assigned synchronously,
  // before any await, or the guard would have the same hole it is here to close.
  if (s.mounting) return s.mounting;
  s.mounting = mountOnce(s).finally(() => { s.mounting = null; });
  return s.mounting;
}

async function mountOnce(s: Surface): Promise<void> {
  // A render failure has to reach the screen: butterchurn throwing mid-frame
  // just stops the rAF chain, and the result is an unexplained black rectangle.
  const onError = (err: unknown): void => {
    console.error('[lolly:viz] the visualizer stopped', err);
    if (!liveSurfaces().includes(s)) return;
    const msg = err instanceof Error ? err.message : String(err);
    setNote(s, `The visualizer stopped: ${escape(msg)}`);
  };
  // Captured BEFORE the awaits so the result can be validated against them: a
  // click on the canvas during the (hundreds of ms) load switches mode and
  // REPLACES the canvas, and a handle bound to the discarded one is both
  // invisible and unkillable.
  const forCanvas = s.canvas;
  const forMode = s.mode;
  await initStock();
  // `initPrefs` could only draw from the brand-native handful. Now that the
  // artist index is in, re-draw over the whole library so the FIRST preset of
  // the session is as varied as every one the cycle picks after it. Once per
  // session, and never over a pick the user (or the cycle) has already made,
  // which would yank the picture out from under them.
  if (!startPicked) {
    startPicked = true;
    currentPresetId = startPresetId();
  }
  const scheme = await initSchemes();
  let handle: VizHandle | null = null;
  try {
    handle = await mountViz(forCanvas, vizHost, currentPresetId, onError, scheme?.palette ?? null,
      // The ?neuro demo has no analyser (audio never starts in a capture), so
      // feed butterchurn a fixed injected window with a pinned per-frame seed
      // instead. `driven` plus the fixed pump below replace the rAF loop: a
      // self-driven loop renders as many frames as the display happens to
      // give it, and the docs pipeline compares vector baselines
      // byte-exactly. The picture must be the SAME frame every capture, not
      // "whatever frame 4.5s landed on". `capture` keeps the drawing buffer
      // readable so the SVG walker's toDataURL sees the frame instead of a
      // cleared buffer.
      neuroDemoActive()
        ? { audio: { frame: () => ({ wave: demoVizWave(), seed: 0 }) }, deterministic: true, driven: true, capture: true }
        : undefined);
  } catch (err) {
    onError(err);
    return;
  }
  // Discard the result if anything moved under us: the surface was torn down, the mode
  // changed, the canvas was swapped, or another mount already won.
  if (!liveSurfaces().includes(s) || s.mode !== forMode || s.canvas !== forCanvas || s.handle) {
    handle?.destroy();
    return;
  }
  s.handle = handle;
  // An ARTIST preset isn't in our registry, so mountViz opened on the
  // fallback. Fetch and apply the real one now that there's a renderer to
  // give it to.
  if (isStockId(currentPresetId)) void applyStockPreset(s, currentPresetId);
  if (neuroDemoActive() && handle) pumpDemoFrames(s, handle);
  startCycle();
  refreshNote(s);
}

/** Step a ?neuro demo surface through the shared FIXED frame sequence
 *  (lib/neuro-demo.ts), stamping `data-demo-settled` on THIS surface's root.
 *  The alive guard stands the pump down if the surface was torn down or
 *  remounted under it. */
function pumpDemoFrames(s: Surface, handle: VizHandle): void {
  pumpVizDemoFrames(handle, () => s.handle === handle, s.root);
}

/** Tear a surface down without touching the others. */
function destroySurface(s: Surface): void {
  stopMeter(s);
  for (const off of s.cleanup) off();
  s.cleanup.length = 0;
  s.handle?.destroy();
  s.handle = null;
  // A portalled menu lives on <body>, not inside the surface - clearing the surface's
  // markup would otherwise leave it orphaned there forever.
  if (s.menu.classList.contains('is-portalled')) s.menu.remove();
}

// ── public API ───────────────────────────────────────────────────────────────

/** Seed the module's shared preset/cycle state, once. */
function initPrefs(): void {
  if (!currentPresetId) currentPresetId = startPresetId();
  cycleSeconds = readCyclePref();
}

/**
 * Resolve the brand's schemes once, and settle on the saved one (or the
 * brand's own accent family, which `deriveVizSchemes` sorts first).
 *
 * `deriveVizSchemes` never returns an empty array: a brand with no usable
 * colour still yields a single fallback scheme, so `schemes.length === 0`
 * after this means the await genuinely failed. Callers treat a null return
 * as "no scheme override".
 */
/** Load the artist preset index once. Absent pack means an empty list, and
 *  the menu simply shows only the brand-native presets. */
async function initStock(): Promise<void> {
  if (stock.length === 0) {
    brandTint = readBrandTint();
    stock = await stockPresetIndex();
  }
}

async function initSchemes(): Promise<VizScheme | null> {
  if (schemes.length === 0) {
    const resolved = await vizSchemes(vizHost);
    if (resolved.length > 0) {
      schemes = resolved;
      let saved: string | null = null;
      try { saved = localStorage.getItem(SCHEME_KEY); } catch { /* private mode */ }
      currentSchemeId = vizSchemeById(schemes, saved).id;
    }
  }
  return schemes.length ? vizSchemeById(schemes, currentSchemeId) : null;
}

/**
 * Attach the inline 4:3 panel to a container the dock provides: the default
 * surface, and the dock's body. Safe to call repeatedly: it re-mounts a panel
 * whose render loop stood itself down (which happens whenever the dock
 * collapses and the canvas stops being laid out), and does nothing while the
 * floating panel has taken over.
 */
export async function mountInlineViz(container: HTMLElement, host?: NeurospicyHost & VizPaletteHost): Promise<void> {
  if (typeof document === 'undefined' || !vizSupported()) return;
  if (host) vizHost = host;
  initPrefs();
  if (inlineSurface && inlineSurface.root !== container) {
    destroySurface(inlineSurface);
    inlineSurface = null;
  }
  inlineContainer = container;
  if (!inlineSurface) {
    inlineSurface = buildSurface('inline', container);
    wireSurface(inlineSurface);
  }
  // Suspended while the floating panel owns the picture - don't run two contexts.
  if (expanded) return;
  // The loop stands itself down when the canvas isn't laid out (a collapsed dock). The
  // handle survives that, so drop it before re-mounting or ensureMounted short-circuits.
  if (inlineSurface.handle && !inlineSurface.handle.running()) {
    inlineSurface.handle.destroy();
    inlineSurface.handle = null;
  }
  await ensureMounted(inlineSurface);
  // `inlineSurface` can have been replaced or dropped across that await.
  if (inlineSurface) refreshNote(inlineSurface);
}

/** Tear the inline panel down but remember where it lived, so the floating panel can hand
 *  the picture back on close. */
function suspendInline(): void {
  if (!inlineSurface) return;
  destroySurface(inlineSurface);
  inlineSurface.root.innerHTML = '';
  inlineSurface = null;
}

/** Drop the inline panel for good - the dock calls this when Neurospicy Mode is switched
 *  off, so the WebGL context is released rather than merely hidden. */
export function unmountInlineViz(): void {
  suspendInline();
  inlineContainer = null;
  if (!expanded) stopCycle();
}

/** Is the enlarged panel open? The inline one doesn't count - it's part of the dock. */
export function isVizOpen(): boolean { return expanded !== null; }

/**
 * Open the enlarged, draggable panel over the app. Safe to call when
 * unsupported: it opens and explains itself instead of failing silently,
 * which is the difference between a feature that looks broken and one that
 * looks unavailable.
 */
export async function openVizPanel(
  host?: NeurospicyHost & VizPaletteHost,
  opts: { fullscreen?: boolean } = {},
): Promise<void> {
  if (typeof document === 'undefined') return;
  if (host) vizHost = host;
  initPrefs();
  if (expanded) {
    // Already open - just honour a fullscreen request rather than building a second one.
    if (opts.fullscreen && !document.fullscreenElement) toggleFullscreen(expanded);
    return;
  }
  // Hand the picture over: the inline panel is about to be covered, and two live contexts
  // rendering the same thing is pure waste. Torn down COMPLETELY (surface nulled,
  // container remembered) so closing rebuilds and re-wires it.
  suspendInline();

  const root = document.createElement('div');
  document.body.appendChild(root);
  const s = buildSurface('panel', root);
  expanded = s;
  // Tell the dock to stand down before anything else paints, so there is never a frame
  // with two players visible.
  announcePanel(true);
  paintTitle(s);
  wireSurface(s);
  wireDrag(s);
  // The panel carries its own player so it can substitute for the dock entirely.
  if (vizHost) {
    wireMusicPlayerBody(s.root, vizHost);
    refreshMusicPlayer(s.root);
  }
  refreshNote(s);
  s.root.querySelector<HTMLButtonElement>('[data-viz-menu-btn]')?.focus();
  if (opts.fullscreen) toggleFullscreen(s);
  await ensureMounted(s);
}

/** Close the enlarged panel and give the dock its inline one back. */
export function closeVizOverlay(): void {
  const s = expanded;
  if (!s) return;
  expanded = null;
  persistPanel(s);
  destroySurface(s);
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => { /* closing anyway */ });
  s.root.remove();
  // Bring the dock back BEFORE re-mounting its inline panel: while superseded the dock is
  // display:none, so the canvas has no layout box and the render loop would immediately
  // stand itself down again.
  announcePanel(false);
  if (inlineContainer?.isConnected) void mountInlineViz(inlineContainer);
  else stopCycle();
}

/** Back-compat alias - the dock and any older call sites open the enlarged panel. */
export const openVizOverlay = openVizPanel;
