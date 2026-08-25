// SPDX-License-Identifier: MPL-2.0
// The dock stylesheet, as a string so BOTH consumers can use it: the web app
// injects it (a <style> the shell ensures once), and the static /info build
// inlines it. The string is the single source of truth. There is deliberately
// NO sibling styles.css to drift from it (the drift-guard house rule); a
// consumer that wants a file writes DOCK_CSS out at build time.
//
// Everything is scoped under `.audio-dock`. The look is a committed deep-teal /
// SUSE-green dock, expressed as CSS custom properties on the root so a host can
// override any token (e.g. brand-vars) without touching a rule. TYPE flows from the
// app's brand-font tokens: `--font-brand` (body) and `--font-mono` (eyebrows,
// section heads, pills, numerics), with literal fallbacks inside each var() so the
// shell still renders when a consumer hasn't defined them. The layering, back to
// front, is: viz canvas backdrop, then scrim (a LIGHT wash, not a frost), then controls face.

/** The <style> element id the shell dedupes on. */
export const DOCK_STYLE_ID = 'lolly-audio-dock-styles';

export const DOCK_CSS = `
.audio-dock {
  /* ── theme tokens (host-overridable) - the committed deep-teal/SUSE-green look ── */
  --dock-bg: hsl(171 62% 8%);
  --dock-bg-2: hsl(171 55% 13%);
  /* The controls face over the viz: near-opaque so text lists stay readable on top of
     a moving backdrop, while the header/transport still read the viz through the wash. */
  --dock-panel: hsl(171 62% 8% / .9);
  --dock-scrim: hsl(171 66% 5% / .28);
  --dock-fg: hsl(160 30% 96%);
  --dock-muted: hsl(158 16% 74%);
  --dock-accent: hsl(145 63% 49%);
  --dock-accent-fg: hsl(171 62% 8%);
  --dock-border: hsl(160 40% 96% / .14);
  /* Slider track (unfilled). A clean, faintly brand-tinted line - never the browser's
     default muddy grey (which accent-color forces on the unfilled portion). */
  --dock-track: hsl(160 30% 82% / .22);
  --dock-radius: 16px;
  --dock-shadow: 0 14px 44px rgb(0 0 0 / .46);

  position: fixed;
  right: 16px;
  bottom: calc(1rem + var(--safe-bottom));
  z-index: 9002;
  width: 320px;
  max-width: calc(100vw - 32px);
  isolation: isolate;
  overflow: hidden;
  border-radius: var(--dock-radius);
  background: var(--dock-bg);
  color: var(--dock-fg);
  box-shadow: var(--dock-shadow);
  font: 500 14px/1.4 var(--font-brand, system-ui, sans-serif);
  transition: width .2s cubic-bezier(.2,.7,.3,1);
}
.audio-dock *, .audio-dock *::before, .audio-dock *::after { box-sizing: border-box; }

/* ── layer 1: the viz canvas backdrop ───────────────────────────────────────── */
.audio-dock-viz {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  color: var(--dock-accent);          /* the drawer reads this as its bar colour */
  pointer-events: none;
}
/* Hidden when viz can't run (capability off / no signal / reduced motion / switched
   off) or is not declared - the static deep-teal ground (the root background) shows. */
.audio-dock:not([data-cap-viz]) .audio-dock-viz,
.audio-dock[data-viz="static"] .audio-dock-viz { display: none; }

/* ── layer 2: the scrim - a darkening wash ONLY (NO blur anywhere), so control text
      stays legible while the visualiser reads perfectly sharp behind it ── */
.audio-dock-scrim {
  position: absolute;
  inset: 0;
  pointer-events: none;
  /* Even, gentle darkening top and bottom for text contrast; the middle stays open so
     the moving picture shows through crisply. Deliberately NO backdrop-filter: a blur
     here softens the very visualiser it sits over. */
  background: linear-gradient(180deg, var(--dock-scrim) 0%, hsl(171 66% 5% / .1) 42%, var(--dock-scrim) 100%);
}

/* ── layer 3: the controls face ─────────────────────────────────────────────── */
/* A media-player column: the header + narration block at the TOP, a flexible viz/free
   space that GROWS to fill a tall window, then the music controls ANCHORED to the BOTTOM.
   In the default (auto-height) dock there is no slack, so the viz-space collapses to 0 and
   the controls sit directly under the header - no dangling empty area either way. */
.audio-dock-face { position: relative; display: flex; flex-direction: column; }
.audio-dock-main { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; }
.audio-dock-vizspace { flex: 1 1 auto; min-height: 0; position: relative; }   /* the free/viz region (grows); positions the centred brand mark */
/* Windowed / fullscreen: the face fills the window height so the flex slack lands in the
   viz-space and the music controls pin to the bottom edge. */
.audio-dock[data-windowed] .audio-dock-face,
.audio-dock:fullscreen .audio-dock-face,
.audio-dock[data-fullscreen] .audio-dock-face { height: 100%; min-height: 0; }

/* buttons (shared) */
.audio-dock-btn {
  flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
  border: none; background: transparent; color: var(--dock-fg);
  cursor: pointer; padding: 0; border-radius: 999px;
  width: 34px; height: 34px; transition: background .12s ease, transform .1s ease;
}
.audio-dock-btn:hover { background: hsl(0 0% 100% / .1); }
.audio-dock-btn:active { transform: scale(.92); }
.audio-dock-btn:focus-visible { outline: 2px solid var(--dock-accent); outline-offset: 2px; }
.audio-dock-btn[disabled] { opacity: .38; cursor: default; }
.audio-dock-btn[disabled]:hover { background: transparent; }
.audio-dock-btn svg { width: 18px; height: 18px; display: block; }

/* ── now-playing header (also the drag handle) ──────────────────────────────── */
.audio-dock-head { display: flex; align-items: center; gap: 8px; padding: 10px 10px 6px 14px;
  cursor: grab; touch-action: none; }
.audio-dock.is-dragging .audio-dock-head { cursor: grabbing; }
/* The controls in the header keep a normal cursor; only the bare area grabs. And they
   sit ABOVE the resize hit-zones (z:4 > the handles' z:3), so a click near a corner hits
   the button, not the resizer. */
.audio-dock-head .audio-dock-btn { cursor: pointer; position: relative; z-index: 4; }
.audio-dock-np { flex: 1; min-width: 0; }
.audio-dock-title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.audio-dock-sub { font-size: .74rem; color: var(--dock-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.audio-dock-sub:empty { display: none; }

/* ── transport + scrub ──────────────────────────────────────────────────────── */
/* position:relative so the repeat toggle can pin right while prev/play/next stay
   optically centred (matching the old music player). */
.audio-dock-transport { position: relative; display: flex; align-items: center; justify-content: center; gap: 14px; padding: 4px 12px 6px; }
.audio-dock-repeat { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; }
.audio-dock-repeat:active { transform: translateY(-50%) scale(.92); }
.audio-dock-repeat.is-active { color: var(--dock-accent); }
/* Volume speaker mirrors repeat on the left, so prev/play/next stay optically centred. */
.audio-dock-volbtn { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; }
.audio-dock-volbtn:active { transform: translateY(-50%) scale(.92); }
.audio-dock-volbtn.is-muted { color: var(--dock-muted); }
.audio-dock-volpop { position: absolute; z-index: 6; display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 12px 10px 10px; border: 1px solid var(--dock-border); border-radius: 12px;
  background: var(--dock-bg-2); box-shadow: var(--dock-shadow); }
.audio-dock-volpop[hidden] { display: none; }
/* Vertical range: modern standard (writing-mode) with max at the top. The input is the
   track's own thickness (6px) so the track fills it and the thumb centres on it with no
   margin:auto drift; the wider thumb simply overhangs into the popover's padding. */
.audio-dock-volrange { writing-mode: vertical-lr; direction: rtl; width: 6px; height: 120px; }
.audio-dock-volpct { font: 700 .62rem/1 var(--font-mono, ui-monospace, monospace); color: var(--dock-muted); }
.audio-dock-play {
  width: 46px; height: 46px; background: var(--dock-accent); color: var(--dock-accent-fg);
}
.audio-dock-play:hover { background: var(--dock-accent); filter: brightness(1.08); }
.audio-dock-scrub { padding: 0 14px 10px; }
.audio-dock-scrub input[type="range"] { width: 100%; }
.audio-dock-time { display: flex; justify-content: space-between; font-size: .68rem; color: var(--dock-muted);
  margin-top: 2px; font-family: var(--font-mono, ui-monospace, monospace); font-variant-numeric: tabular-nums; }
.audio-dock[data-seekable="false"] .audio-dock-scrub { display: none; }

/* Every range slider (scrub, master Volume, Music/Effects, atmosphere) is fully
   custom-styled so it shows the dock's own colours ONLY: a clean rounded track in
   --dock-track and an accent thumb - never the browser-default grey unfilled track that
   accent-color forces, and no resting border/box. The high-contrast a11y pref restores a
   1px track outline for definition; keyboard focus keeps its own focus ring regardless. */
.audio-dock input[type="range"] {
  -webkit-appearance: none; appearance: none;
  background: transparent; border: none; box-shadow: none; cursor: pointer;
}
.audio-dock input[type="range"]::-webkit-slider-runnable-track { background: var(--dock-track); border: none; border-radius: 999px; }
.audio-dock input[type="range"]::-moz-range-track { background: var(--dock-track); border: none; border-radius: 999px; }
.audio-dock input[type="range"]::-moz-range-progress { background: var(--dock-accent); border: none; border-radius: 999px; }
.audio-dock input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; border: none;
  width: 13px; height: 13px; border-radius: 999px; background: var(--dock-accent);
}
.audio-dock input[type="range"]::-moz-range-thumb { border: none; width: 13px; height: 13px; border-radius: 999px; background: var(--dock-accent); }
.audio-dock input[type="range"]:focus-visible { outline: 2px solid var(--dock-accent); outline-offset: 2px; }
/* Horizontal sliders: a thin 4px track with the thumb centred over it. The vertical
   Volume slider sizes its track thickness from its own 14px width instead. */
/* WebKit has no ::-moz-range-progress equivalent, so the filled portion before the thumb
   is faked with a --fill gradient (a % the JS sets per slider on input/paint) - so the
   volume level reads at a glance (plans/147). Firefox uses ::-moz-range-progress above. */
.audio-dock-scrub input[type="range"]::-webkit-slider-runnable-track,
.audio-dock-vol input[type="range"]::-webkit-slider-runnable-track,
.audio-dock-atmo-row input[type="range"]::-webkit-slider-runnable-track {
  height: 4px;
  background: linear-gradient(to right, var(--dock-accent) var(--fill, 0%), var(--dock-track) var(--fill, 0%));
}
.audio-dock-scrub input[type="range"]::-webkit-slider-thumb,
.audio-dock-vol input[type="range"]::-webkit-slider-thumb,
.audio-dock-atmo-row input[type="range"]::-webkit-slider-thumb { margin-top: -4.5px; }
html[data-a11y-contrast="high"] .audio-dock input[type="range"]::-webkit-slider-runnable-track { outline: 1px solid var(--dock-border); }
html[data-a11y-contrast="high"] .audio-dock input[type="range"]::-moz-range-track { outline: 1px solid var(--dock-border); }

/* ── capability sections (narration / music / atmosphere / visualiser) ──────── */
/* A near-opaque backing so dense text lists read on top of the moving backdrop; the
   header/transport above it keep the light scrim, so the viz still reads there. */
.audio-dock-sections { display: flex; flex-direction: column; background-color: #0005); }
.audio-dock-section { border-top: 1px solid var(--dock-border); }
.audio-dock-section-head {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 14px;
  border: none; background: transparent; color: var(--dock-muted); cursor: pointer;
  font: 700 .72rem/1 var(--font-mono, ui-monospace, monospace); text-transform: uppercase; letter-spacing: .05em;
}
.audio-dock-section-head:hover { color: var(--dock-fg); }
.audio-dock-section-head:focus-visible { outline: 2px solid var(--dock-accent); outline-offset: -2px; }
.audio-dock-caret { margin-left: auto; transition: transform .15s ease; }
.audio-dock-section[data-open="false"] .audio-dock-caret { transform: rotate(-90deg); }
.audio-dock-section[data-open="false"] .audio-dock-section-body { display: none; }
.audio-dock-section-body { padding: 2px 14px 12px; display: flex; flex-direction: column; gap: 10px; }

/* capability gating: hide a section whose capability the app did not turn on.
   The music section covers BOTH music and radio (radio is a group within it). */
.audio-dock:not([data-cap-narration]) [data-section="narration"] { display: none; }
.audio-dock:not([data-cap-music]):not([data-cap-radio]) [data-section="music"] { display: none; }
.audio-dock:not([data-cap-atmosphere]) [data-section="atmosphere"] { display: none; }

/* narration bits */
.audio-dock-caption { font-size: .82rem; color: var(--dock-fg); line-height: 1.45; min-height: 1.2em; }
.audio-dock-caption:empty { display: none; }
.audio-dock-narr-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.audio-dock-toggle {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px;
  border: 1px solid var(--dock-border); background: transparent; color: var(--dock-muted);
  cursor: pointer; font-size: .74rem;
}
.audio-dock-toggle[aria-pressed="true"] { background: var(--dock-accent); color: var(--dock-accent-fg); border-color: transparent; }
.audio-dock-toggle:focus-visible { outline: 2px solid var(--dock-accent); outline-offset: 2px; }
.audio-dock-toggle svg { width: 16px; height: 16px; }
.audio-dock-speed { display: inline-flex; align-items: center; gap: 6px; font-size: .74rem; color: var(--dock-muted); margin-left: auto; }
.audio-dock-speed select {
  border: 1px solid var(--dock-border); background: var(--dock-bg-2); color: var(--dock-fg);
  border-radius: 8px; padding: 3px 6px; font: inherit;
}
.audio-dock-disclosure { font-size: .68rem; color: var(--dock-muted); }
.audio-dock[data-collapse="compact"] .audio-dock-disclosure,
.audio-dock[data-collapse="compact"] .audio-dock-caption { display: none; }

/* volume sliders (music host: Music + interface Effects) */
.audio-dock-volumes { display: flex; flex-direction: column; gap: 7px; padding: 2px 14px 8px; }
.audio-dock-volumes:empty { display: none; }
.audio-dock-vol { display: flex; align-items: center; gap: 10px; font-size: .76rem; color: var(--dock-muted); }
.audio-dock-vol span { flex: 0 0 3.6em; }
.audio-dock-vol input[type="range"] { flex: 1; min-width: 0; accent-color: var(--dock-accent); cursor: pointer; }

/* track / preset search box (a long library wants search) */
.audio-dock-search {
  width: 100%; padding: 6px 10px; margin-bottom: 6px; border: 1px solid var(--dock-border);
  border-radius: 8px; background: var(--dock-bg-2); color: var(--dock-fg); font: inherit; font-size: .8rem;
}
.audio-dock-search:focus-visible { outline: 2px solid var(--dock-accent); outline-offset: 1px; }

/* provider attribution (SomaFM: its link must stay visible wherever it plays) */
.audio-dock-attr { margin: 8px 2px 0; font-size: .68rem; color: var(--dock-muted); line-height: 1.4; }
.audio-dock-attr a { color: var(--dock-accent); text-decoration: underline; font-weight: 600; }
.audio-dock-attr a:hover { text-decoration: none; }

/* picker list (music sources + viz presets share this) */
.audio-dock-list { list-style: none; margin: 0; padding: 0; max-height: min(46vh, 320px); overflow-y: auto; }
.audio-dock-list li[hidden] { display: none; }
.audio-dock-group { padding: 8px 2px 2px; font-size: .62rem; font-weight: 700; letter-spacing: .06em;
  text-transform: uppercase; color: var(--dock-muted); font-family: var(--font-mono, ui-monospace, monospace); }
.audio-dock-group:first-child { padding-top: 0; }
.audio-dock-src {
  display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border: none;
  border-radius: 8px; background: transparent; color: var(--dock-fg); font: inherit; font-size: .82rem;
  text-align: left; cursor: pointer;
}
.audio-dock-src:hover { background: hsl(0 0% 100% / .08); }
.audio-dock-src[aria-current="true"] { background: hsl(0 0% 100% / .12); font-weight: 700; }
.audio-dock-src[disabled] { opacity: .5; cursor: default; }
.audio-dock-src-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.audio-dock-src-mood { flex: 0 0 auto; font-size: .62rem; text-transform: uppercase; letter-spacing: .02em;
  color: var(--dock-muted); font-family: var(--font-mono, ui-monospace, monospace); }

/* atmosphere mixer (restored per-layer icons) */
.audio-dock-atmo-row { display: flex; align-items: center; gap: 8px; padding: 2px 0; }
.audio-dock-atmo-icon { flex: 0 0 auto; width: 22px; height: 22px; display: inline-flex; align-items: center;
  justify-content: center; border-radius: 7px; background: hsl(0 0% 100% / .06); color: var(--dock-muted);
  border: 0; padding: 0; cursor: pointer; }   /* a button: tap to mute/unmute the layer (plans/147) */
.audio-dock-atmo-icon:hover { background: hsl(0 0% 100% / .12); }
.audio-dock-atmo-row.is-on .audio-dock-atmo-icon:hover { filter: brightness(1.08); }
.audio-dock-atmo-icon svg { width: 14px; height: 14px; }
.audio-dock-atmo-row.is-on .audio-dock-atmo-icon { background: var(--dock-accent); color: var(--dock-accent-fg); }
.audio-dock-atmo-label { flex: 0 0 6em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .76rem; color: var(--dock-muted); }
.audio-dock-atmo-row.is-on .audio-dock-atmo-label { color: var(--dock-fg); }
.audio-dock-atmo-row input[type="range"] { flex: 1; min-width: 0; accent-color: var(--dock-accent); }

/* ── the narration BLOCK (page voice) - its own player, ABOVE the music block ── */
/* Coexists with the music player: voice can sound over an optional bed. Shown only when
   the host exposes a narrationBlock. */
.audio-dock-narrblock[hidden] { display: none; }
.audio-dock-narrblock { flex: 0 0 auto; display: flex; flex-direction: column; gap: 8px;
  padding: 8px 14px 10px; border-bottom: 1px solid var(--dock-border); background: var(--dock-panel); }
.audio-dock-narrblock-head { display: flex; align-items: center; gap: 8px; }
/* The title row IS the collapse toggle (a ▾ chevron folds the body - scrub, caption,
   Follow-along, Speed, disclosure - to just this row, like Tracks/Atmosphere). */
.audio-dock-narrblock-toggle { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px;
  border: none; background: transparent; color: inherit; cursor: pointer; text-align: left; padding: 0; font: inherit; }
.audio-dock-narrblock-toggle:focus-visible { outline: 2px solid var(--dock-accent); outline-offset: 2px; }
.audio-dock-narrblock-toggle .audio-dock-np { display: block; flex: 1; min-width: 0; }
.audio-dock-narrblock-toggle .audio-dock-title,
.audio-dock-narrblock-toggle .audio-dock-sub { display: block; }
.audio-dock-narrblock-toggle .audio-dock-caret { flex: 0 0 auto; margin-left: 4px; transition: transform .15s ease; }
.audio-dock-narrblock[data-narrblock-open="false"] .audio-dock-narrblock-toggle .audio-dock-caret { transform: rotate(-90deg); }
.audio-dock-narrblock[data-narrblock-open="false"] .audio-dock-narrblock-body { display: none; }
.audio-dock-narrblock-body { display: flex; flex-direction: column; gap: 8px; }
.audio-dock-play-sm { width: 38px; height: 38px; }
.audio-dock-narrblock[data-narr-seekable="false"] .audio-dock-scrub { display: none; }
.audio-dock[data-collapse="compact"] .audio-dock-narrblock .audio-dock-disclosure,
.audio-dock[data-collapse="compact"] .audio-dock-narrblock .audio-dock-caption { display: none; }

/* The MUSIC block wraps the transport + mixer + Tracks/Atmosphere, ANCHORED to the bottom
   of the window (a solid footer over the viz-space); hidden for a narration-block-only
   dock. flex:0 0 auto so it keeps its natural height while the viz-space above it grows. */
.audio-dock-musicblock { flex: 0 0 auto; background:transparent; }
.audio-dock-musicblock[hidden] { display: none; }

/* ── visualiser RIGHT-CLICK settings menu (on/off + theme pills + preset picker) ── */
/* The viz stays the ambient backdrop; its settings open on right-click. The menu lives
   inside the dock (which is overflow:hidden) and scrolls internally, so it never needs a
   portal or a second copy of the theme tokens. */
.audio-dock-vizmenu { position: absolute; z-index: 6; display: flex; flex-direction: column; gap: 6px;
  width: min(280px, calc(100% - 12px)); max-height: calc(100% - 12px); overflow-y: auto;
  padding: 10px; border: 1px solid var(--dock-border); border-radius: 12px;
  background: var(--dock-bg-2); box-shadow: var(--dock-shadow); }
.audio-dock-vizmenu[hidden] { display: none; }
.audio-dock-vizmenu-label { font: 700 .62rem/1 var(--font-mono, ui-monospace, monospace);
  text-transform: uppercase; letter-spacing: .06em; color: var(--dock-muted); padding-top: 2px; }
.audio-dock-viz-themes, .audio-dock-viz-transitions { display: flex; flex-wrap: wrap; gap: 4px; }
.audio-dock-viz-themes:empty, .audio-dock-viz-transitions:empty { display: none; }
.audio-dock-pill { border: none; border-radius: 999px; padding: 3px 10px; cursor: pointer;
  background: hsl(0 0% 100% / .08); color: var(--dock-muted);
  font: 600 .68rem/1.3 var(--font-mono, ui-monospace, monospace); letter-spacing: .01em; }
.audio-dock-pill:hover { color: var(--dock-fg); background: hsl(0 0% 100% / .14); }
.audio-dock-pill.is-on { background: var(--dock-accent); color: var(--dock-accent-fg); }
.audio-dock-pill:focus-visible { outline: 2px solid var(--dock-accent); outline-offset: 2px; }
.audio-dock-viz-searchbox { display: flex; align-items: center; gap: 6px; margin: 0; }
.audio-dock-viz-searchbox svg { flex: 0 0 auto; width: 14px; height: 14px; color: var(--dock-muted); }
.audio-dock-viz-searchbox input { flex: 1; min-width: 0; margin-bottom: 0; }
.audio-dock-viz-presets { max-height: min(38vh, 240px); }

/* ── the Mini size: now-playing + a play button, viz peeking behind ─────────── */
.audio-dock-mini { display: none; align-items: center; gap: 10px; padding: 10px 12px; width: 100%; text-align: left;
  cursor: grab; touch-action: none; }
.audio-dock.is-dragging .audio-dock-mini { cursor: grabbing; }
.audio-dock-mini .audio-dock-btn { cursor: pointer; }
.audio-dock-mini-np { flex: 1; min-width: 0; border: none; background: transparent; color: inherit; cursor: pointer; text-align: left; font: inherit; padding: 0; }
.audio-dock-mini-np:focus-visible { outline: 2px solid var(--dock-accent); outline-offset: 2px; }
.audio-dock[data-collapse="mini"] { width: auto; min-width: 200px; }
.audio-dock[data-collapse="mini"] .audio-dock-main { display: none; }
.audio-dock[data-collapse="mini"] .audio-dock-mini { display: flex; }

/* ── Windowed states (full + expanded): draggable + resizable ────────────────── */
/* Expanded (and a resized full) get an explicit inline size; disable the width
   transition so a drag/resize tracks the pointer instead of easing behind it. And the
   face scrolls within the fixed height so sections/sliders reflow rather than clip. */
.audio-dock[data-collapse="expanded"] { max-width: none; }
.audio-dock[data-windowed] { transition: none; }
.audio-dock.is-dragging, .audio-dock.is-resizing { transition: none; }
.audio-dock[data-windowed] .audio-dock-face { height: 100%; max-height: 100%; overflow-y: auto; }
/* Over a large/bright viz, give the header buttons a subtle backing so collapse ▾ / exit ↗
   stay obviously visible above the picture. */
.audio-dock[data-collapse="expanded"] .audio-dock-head .audio-dock-btn,
.audio-dock[data-fullscreen] .audio-dock-head .audio-dock-btn { background: rgb(0 0 0 / .32); }
.audio-dock[data-collapse="expanded"] .audio-dock-head .audio-dock-btn:hover,
.audio-dock[data-fullscreen] .audio-dock-head .audio-dock-btn:hover { background: rgb(0 0 0 / .55); }

/* ── 8-direction resize handles (edges + corners), a native-window feel ──────── */
/* Thin invisible edge hit-zones + larger corner zones, shown only in a resizable window
   (full/expanded, never mini/fullscreen). Inside the box (root is overflow:hidden), on top
   of content but BELOW the header buttons (z:3 < z:4) so they never block a control. */
.audio-dock-resizers { display: none; }
.audio-dock[data-resizable] .audio-dock-resizers { display: block; }
.audio-dock-rz { position: absolute; z-index: 3; touch-action: none; }
.audio-dock-rz-n { top: 0; left: 10px; right: 10px; height: 7px; cursor: ns-resize; }
.audio-dock-rz-s { bottom: 0; left: 10px; right: 10px; height: 7px; cursor: ns-resize; }
.audio-dock-rz-e { right: 0; top: 10px; bottom: 10px; width: 7px; cursor: ew-resize; }
.audio-dock-rz-w { left: 0; top: 10px; bottom: 10px; width: 7px; cursor: ew-resize; }
.audio-dock-rz-ne { top: 0; right: 0; width: 14px; height: 14px; cursor: nesw-resize; }
.audio-dock-rz-nw { top: 0; left: 0; width: 14px; height: 14px; cursor: nwse-resize; }
.audio-dock-rz-sw { bottom: 0; left: 0; width: 14px; height: 14px; cursor: nesw-resize; }
.audio-dock-rz-se { bottom: 0; right: 0; width: 16px; height: 16px; cursor: nwse-resize;
  display: flex; align-items: flex-end; justify-content: flex-end; padding: 2px; color: var(--dock-muted); }
.audio-dock-rz-se svg { opacity: .8; }
/* Touch (plans/147): fatten the invisible resize hit-zones to a comfortable target on
   coarse pointers - the visible corner grip glyph is unchanged, only the tap box grows. */
@media (pointer: coarse) {
  .audio-dock-rz-n, .audio-dock-rz-s { height: 20px; }
  .audio-dock-rz-e, .audio-dock-rz-w { width: 20px; }
  .audio-dock-rz-ne, .audio-dock-rz-nw, .audio-dock-rz-sw, .audio-dock-rz-se { width: 30px; height: 30px; }
}

/* ── Fullscreen (Fullscreen API on the dock; native :fullscreen + our attribute) ── */
.audio-dock:fullscreen, .audio-dock[data-fullscreen] {
  inset: 0 !important; left: 0 !important; top: 0 !important;
  width: 100vw !important; height: 100vh !important; max-width: none !important;
  border-radius: 0; transition: none;
}
.audio-dock:fullscreen .audio-dock-face, .audio-dock[data-fullscreen] .audio-dock-face {
  height: 100%; max-height: 100%; overflow-y: auto;
}

/* ── Brand silhouette over the viz (plans/147) ── the brand's MONO-REVERSE logo, painted
   under mix-blend-mode:difference so it reads over any preset colour while the effects
   still play THROUGH it. No z-index → it sits above the canvas/scrim but BELOW the controls
   face (opaque panels occlude it), so it fills the open viz area without covering controls.
   Only for the music player (--dock-brandmark set by host.viz.brandMark), and only when the
   viz is the star (fullscreen / immersive). Tap it to fade it away (data-brandmark-off). */
.audio-dock-brandmark {
  position: absolute; inset: 0; margin: auto;
  /* ~1/3 of the AVAILABLE AREA (plans/147, Andy). A square box sized as a % of the dock:
     with background-size:contain, a WIDE horizontal logo fits to the box WIDTH (≈1/3 of the
     viz width) and a tall/square one to the box HEIGHT (≈1/3 of the viz height) - so each
     orientation reads big without a per-orientation rule. Scales with the dock, so it's ⅓
     of the fullscreen viewport or ⅓ of a resized draggable window alike. */
  width: 34%; height: 34%;
  background: var(--dock-brandmark, none) center / contain no-repeat;
  background-color: transparent; border: 0; padding: 0; cursor: pointer;
  mix-blend-mode: exclusion;
  opacity: 1; transition: opacity .3s ease;
  display: none;
}
/* Shown whenever a mark resolved AND the vizspace has real room for it (data-brandmark-room,
   set in JS from the vizspace height) - so it appears in a windowed/fullscreen/immersive
   dock and turns OFF when the controls/sections crowd the clear area. */
.audio-dock[data-cap-music][data-has-brandmark][data-brandmark-room] .audio-dock-brandmark { display: block; }
.audio-dock[data-brandmark-off] .audio-dock-brandmark { opacity: 0; }
/* Viz-menu top row (plans/147): the viz On toggle + the Logo (brand-mark) toggle side by
   side. The Logo toggle is [hidden] until a mono-reverse mark resolves, so with no brand
   logo the On toggle keeps the whole row. */
.audio-dock-vizmenu-top { display: flex; gap: 8px; }
.audio-dock-vizmenu-top .audio-dock-toggle { flex: 1 1 auto; justify-content: center; }

/* ── Immersive full-page (plans/147) - app-managed fullscreen for touch (iOS can't
   native-FS a <div>). Fill the viewport, hide all controls + sections + chrome, leave the
   visualiser + the brand silhouette, keep only the tap-to-exit ↙ button top-right. ── */
.audio-dock[data-immersive] {
  position: fixed; inset: 0 !important; left: 0 !important; top: 0 !important;
  width: 100vw !important; height: 100vh !important; height: 100dvh !important;
  max-width: none !important; border-radius: 0; transition: none;
}
.audio-dock[data-immersive] .audio-dock-musicblock,
.audio-dock[data-immersive] .audio-dock-narrblock,
.audio-dock[data-immersive] .audio-dock-mini,
.audio-dock[data-immersive] .audio-dock-np,
.audio-dock[data-immersive] [data-collapse-btn],
.audio-dock[data-immersive] [data-close-btn],
.audio-dock[data-immersive] .audio-dock-resizers { display: none; }
.audio-dock[data-immersive] .audio-dock-face { height: 100%; }
.audio-dock[data-immersive] .audio-dock-head {
  position: absolute; left: auto; width: auto; background: none; border: 0; z-index: 4;
  top: 0; right: 0;
  padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) 8px 8px;
}

/* reduced motion - OS query. The app pref (data-a11y-motion) is added by the
   host on its own root; the viz loop also checks it in JS and stands down. */
@media (prefers-reduced-motion: reduce) {
  .audio-dock, .audio-dock-btn, .audio-dock-caret { transition: none; }
}
`;
