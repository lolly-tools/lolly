// SPDX-License-Identifier: MPL-2.0

import { t } from '../i18n.ts';
import type { IconName } from '../lib/icons.ts';
import type { KfChannel } from '../../../../engine/src/keyframes.ts';
import { clamp } from '@lolly/engine';
export { clamp };

// ── tunables ──────────────────────────────────────────────────────────────────

/** Panel height floor, px (section 2 docking clamp). */
export const MIN_PANEL_H = 112;

/** Panel height on first open, px. Session-local; never persisted. */
export const DEFAULT_PANEL_H = 190;

/** One ordinary lane plus its gap - the least a tracks area can usefully show. */
export const ONE_LANE_H = 34;

/** Side panels share this reserve, so it must meet the sequence editor without a gap. */
export const RESERVE_PAD = 0;

/** Zoom floor/ceiling and the per-click step. */
export const MIN_PPS = 4;

export const MAX_PPS = 600;

export const ZOOM_STEP = 1.25;

/**
 * Edge-trim hit zone, px each side, for a PRECISE pointer (mouse / trackpad).
 *
 * The HIT size and the VISUAL size are deliberately different numbers: the grip drawn
 * inside `.tl-edge` stays a 3px hairline (a fat handle on a 40px bar is the bar), while
 * the zone that responds is this wide. IMG.LY ship the same split on their mobile
 * timeline - "more than twice as wide as the visual appearance suggests".
 *
 * Was 8, which was under every published floor. See EDGE_PX_COARSE for the one that
 * actually has a standard behind it; this one is the pointer that can be precise.
 */
export const EDGE_PX = 10;

/**
 * Edge-trim hit zone for a COARSE pointer (finger / pen), px each side.
 *
 * 24 is WCAG 2.5.8's target-size floor (AA), and the smallest of the three standards
 * in play - Apple asks 44pt, Material 48dp. Those two are about a target you TAP; this
 * is a target you press and drag along one axis, where the other axis is the full lane
 * height, so the AA floor is the honest number rather than the ambitious one.
 *
 * Picked per EVENT from `e.pointerType`, not from a media query: a touch laptop reports
 * `pointer: coarse` for the whole document while the user is on the trackpad, and
 * `matchMedia` is also absent under jsdom. The event knows exactly which finger arrived.
 */
export const EDGE_PX_COARSE = 24;

/** Seam (junction) hit zone, px each side. */
export const SEAM_PX = 8;

/**
 * Snap tolerance, screen px, by pointer kind. The module default in timeline-math
 * (SNAP_PX = 6) stays where it is - that is the value every OTHER caller of snapTime
 * gets; these two are the panel's own gesture tolerances, raised because a snap you
 * cannot land is a snap that does not exist, and a finger is not a cursor.
 */
export const SNAP_PX_FINE = 8;

export const SNAP_PX_COARSE = 12;

/** Arrow-key step: one frame at 30fps; Shift steps a whole second. */
export const FRAME_S = 1 / 30;

/** Keyboard trim step multiplier when Shift is held (`,`/`.` nudge the focused edge). */
export const TRIM_SHIFT_FRAMES = 10;

/** Filmstrip frames are never packed tighter than this, px. */
export const MIN_FRAME_PX = 40;

/**
 * Voiceover take limits. `maxMs` mirrors record-control's audio cap (10 minutes) - a
 * runaway take is a runaway upload, and the panel warns before it starts. `countInMs`
 * is one beat of the 3-2-1 count-in.
 *
 * MUTABLE on purpose, like the engine's HOOK_BUDGET_MS: a jsdom test drives the whole
 * take through in one tick by zeroing the count-in, rather than sleeping 1.8 s.
 */
export const TAKE_TIMING = {
  countInMs: 600,
  maxMs: 10 * 60 * 1000,
  videoMaxMs: 2 * 60 * 1000,
  warnMs: 5000,
};

/**
 * The depth SLIDER's travel (plans/104 section 5.3). NOT a clamp: `KF_Z_FIELD_CLAMP` is the
 * engine's, it is what every write is held to, and it is deliberately wider than this.
 *
 * 0–300 is the band section 5.3 calls tasteful - at P = 1200 it spans eff 1.00–1.33, with the
 * 1.05–1.2 lift landing mid-travel and "Lift layers"' 0/40/80 stagger in the first
 * fifth. Deeper moves belong to the camera dolly, not to a per-box depth, so the slider
 * stops where taste does while the NUMBER beside it still accepts the whole field range
 * (−300…900, negative = sunken). A test pins this inside the engine's clamp.
 */
export const KF_Z_SLIDER: readonly [number, number] = Object.freeze([0, 300] as const);

/**
 * The TILT controls' travel (P2) - the same kind of promise `KF_Z_SLIDER` makes, and
 * made for an essential reason rather than for taste alone.
 *
 * `KF_CLAMPS.rx/ry` is ±180 because it is a WIRE clamp: a hand-edited share link may
 * say anything and the parser has to hold it to something. It is not a control range,
 * and wiring the Tilt X / Tilt Y fields straight to it (which is what P2 first did)
 * put a reachable value on the other side of an invariant the plan path depends on.
 * `buildPlan`'s depth sort is by resolved `z`, and that reproduces a perspective render
 * only while `κ = cos(rx)·cos(ry) > 0` - past a quarter turn the sign flips, the far
 * layer becomes the one painted last, and a "lifted" layer SHRINKS. At `rx = −120`
 * three layers at z 0/100/200 come out fully opaque, view-axis depths 1200/1250/1300,
 * painted in exactly the wrong order, with the behind-camera guard never engaging
 * because `D = P − κζ` GROWS with ζ once κ < 0.
 *
 * ±75 keeps `κ ≥ cos(75°)² = 0.067 > 0` for every combination of the two, so the sort
 * is correct by construction everywhere a control or a gesture can reach - and it is
 * generous for the pictures the presets are built from (Surface glide's −40°, Orbit's
 * ±25°, Depthfield's own −38°). Past ~75° a screen-parallel plane is nearly edge-on
 * and there is no artwork left to look at, so nothing is being withheld.
 *
 * The wire stays ±180 (a link that says 120 still parses and still renders - it is
 * simply not something the UI will author), exactly as `z`'s wire stays ±12000 while
 * its slider stops at 300. `timeline-panel.test.ts` pins the containment.
 */
export const KF_TILT_CONTROL: readonly [number, number] = Object.freeze([-75, 75] as const);

/** The two channels `KF_TILT_CONTROL` governs, for `kfPoseAt`'s channel list. */
export const TILT_CHANNELS: readonly KfChannel[] = Object.freeze(['rx', 'ry'] as const);

/**
 * The camera moves that write keyframes (plans/104 section 8, section 12 Q8) - stored EXPANDED.
 *
 * Each `track` is the plan's own literal wire sketch, parsed by the ENGINE's `parseKf`
 * on the way in and re-serialised on the way out, so a preset is indistinguishable from
 * a hand-authored move the moment it is applied: no preset name is stored anywhere, nothing
 * downstream has to resolve one, and every key is editable, retimeable and deletable
 * like any other (plan 101's rule, which this plan inherits).
 *
 * The first five exercise v1 channels only. **Surface glide and Orbit are P2's** and
 * are the first two that author `rx`/`ry`; both obey THE RESOLUTION RULE (Andy,
 * 2026-08-12, binding on every generated animation): *"elements lift off and rest back
 * down on the page; the animations showing them falling apart need to close out with it
 * all coming together."* Their last keyframe IS the rest pose - every channel the track
 * touches returns to its default - so the move is a departure that comes home rather
 * than a shot that ends stranded at an angle. `tests/keyframes-tilt.test.ts` asserts it
 * by evaluating each tilt track at its own end.
 *
 * ⚑ MEASURED, NOT FIXED HERE: the five P1 presets above predate that rule and do NOT
 * obey it - `push-in` ends at `z −220`, `pull-back` at `z 0` (it does), `pan-across` at
 * `x 140`, `rise` at `y −120, z −80`, `reveal` at rest. Bringing `push-in`, `pan-across`
 * and `rise` home would change what three shipped moves MEAN (a push-in that pushes back
 * out is a different shot), which is a product call and not a P2 one. Flagged for Andy
 * with the numbers rather than changed in passing.
 *
 * ⚑ THE DOLLY SIGN IS INVERTED FROM section 8's SKETCHES, and deliberately. The engine's own
 * projection is `eff = P / (P − (z − camZ))` (`projectDepth`), so a camera whose `z`
 * GROWS is a camera moving AWAY: a layer at z = 0 under camZ = 220 renders at
 * eff = 1200/1420 = 0.845, i.e. smaller. section 8's sketch for "Push in" ends at z 220 and
 * would therefore pull back, and "Pull back" would push in - the two sketches are each
 * other's. section 4.3's own Vertigo derivation agrees with the formula and not with the
 * sketches (`camZ = P·(1/c − 1) + z_s` puts camZ BELOW the subject plane to magnify
 * it, and names camZ ≈ −600 for the recipe), so the sketch is what is wrong here. The
 * FORM of every preset is kept exactly as authored - the same instants, the same
 * eases, the same start-or-end-at-rest structure - with the dolly's sign flipped so
 * that each move does what its name says. Flagged for the plan to correct section 8.
 *
 * The labels go through `t()` HERE, at module scope, for the reason PANEL_SHORTCUTS
 * states: literal `t('…')` call sites are what scripts/translate.ts's corpus scan
 * extracts, and a `t(preset.label)` at render time would need every name hand-listed
 * in extra-keys.spa.json instead.
 *
 * The `track` times are AUTHORED absolutes (4–5.2 s); `applyCameraPreset` rescales them
 * to the scene's own duration (`rescaleKfTrack`, audit A1#5) so a move fits any clip.
 */
/**
 * The shortest a rescaled preset may become - a floor under `applyCameraPreset`'s scene
 * scale so a pathologically brief scene compresses the move to a fast glide rather than a
 * single-frame strobe. Only bites below 0.8 s, which no real flythrough scene reaches.
 */
export const PRESET_MIN_MS = 800;

export const KF_CAMERA_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  track: string;
  icon: IconName;
}> = [
  { id: 'push-in', label: t('Push in'), track: 't0_z0*t4000_eo_z-220', icon: 'zoomIn' },
  { id: 'pull-back', label: t('Pull back'), track: 't0_z-220*t4000_eio_z0', icon: 'zoomOut' },
  { id: 'pan-across', label: t('Pan across'), track: 't0_x-140*t4000_el_x140', icon: 'move' },
  { id: 'rise', label: t('Rise'), track: 't0_y120_z-40*t4000_eo_y-120_z-80', icon: 'arrowsV' },
  { id: 'reveal', label: t('Reveal'), track: 't0_z-260_a0.5_f200*t3500_eo_z0_a0', icon: 'eye' },
  // ── P2: the two tilt moves ────────────────────────────────────────────────
  //
  // SURFACE GLIDE is the signature move. section 9's re-sequencing verdict said: "what I'm
  // seeing show up are all top-down views, not angled glides along the surface of
  // the image, POV style". The acceptance phrase was "to feel INSIDE the landscape
  // of the image". The move opens down among the lifted surfaces: `rx −40` pitches
  // the camera so the near edge sits at the bottom of frame and the far edge
  // recedes to a horizon. The focus plane sits out at z 160 with the aperture open,
  // so the flat board is soft and only the lifted layers are sharp. It then drifts
  // laterally (per the P4 study: "the camera NEVER sits still") and RESOLVES: pitch,
  // both pans, focus, and aperture all land on 0 at 5.2s, the same instant the
  // shipped Screenshot-flythrough template settles on. It is linear out of the
  // first key, because a drift that eases is a drift that wobbles, and ease-out
  // into the second key, so the shot settles rather than stops.
  //
  // ⚑ NO DOLLY. This is a MEASURED decision, not an omission. A `camZ` push was
  // tried and removed: on the affine tier camZ is a pure magnification, but under a
  // pitch it also DISPLACES, because it moves the aim point along the world z axis
  // instead of along the camera's own view axis. Measured on the P1 demo scene,
  // adding `z −180` to the opening key lifted every layer about 130px up the frame
  // on top of the magnification, and pushed two of the four lifted cards clean off
  // the top edge (card B to y −110 on a 540-tall stage). A signature preset must
  // not open with half the artwork out of frame. Dollying ALONG the view axis under
  // tilt is the right fix, but it is a projection change, not a preset one. Noted
  // for P2b.
  //
  // ORBIT is no longer inert. It shipped disabled at P1 with the reason "Needs tilt
  // (coming)". That reason no longer applies as of this milestone: the engine's
  // camera model ORBITS its aim point rather than swivelling in place (see
  // `surfaceMatrix`), so a keyframed `ry` IS an orbit: the camera swings around the
  // artwork while the centre of frame stays put. This codebase's rule is not to
  // leave a control dimmed behind a reason that has stopped being true. The move
  // swings right, past the front, to the left, and settles square, returning like
  // its sibling move, with a shallow `rx` through the arc so it reads as an orbit
  // rather than a horizontal wipe.
  {
    id: 'surface-glide',
    label: t('Surface glide'),
    track: 't0_el_x-120_y60_rx-40_f160_a0.8*t2600_eo_x-40_y36_rx-24_f90_a0.4*t5200_x0_y0_rx0_f0_a0',
    icon: 'plane',
  },
  {
    id: 'orbit',
    label: t('Orbit'),
    track: 't0_el_rx-14_ry34*t2600_es_rx-14_ry-34*t5200_rx0_ry0',
    icon: 'refresh',
  },
];

/** One row of the shortcuts sheet - and one branch of `onKey`. */
export interface PanelShortcut {
  /** What the sheet prints in the keys column. Key NAMES, deliberately untranslated. */
  keys: string;
  /** What the key does. */
  label: string;
  /** Second line, for a modifier that changes the same key's behaviour. */
  hint?: string;
  /**
   * Every literal `KeyboardEvent.key` this row handles, with the modifier that arms
   * it. This is the MACHINE half of the row: the drift guard in timeline-panel.test.ts
   * drives each one through `onKey` and asserts it was handled, and checks the reverse
   * direction against a literal list of `onKey`'s case labels - so a shortcut cannot
   * be added without documenting it, or documented without existing.
   *
   * Empty for a modifier-only row (Alt), which has no keydown branch of its own.
   *
   * `altKey` is the ONE chord this panel binds, and it is documented rather than
   * hidden: Alt+←/→ (previous/next keyframe) reuses the arrow keys the bare press
   * already owns, because "the same key, one step coarser" is the only mapping that
   * needs no second thing to remember - and Alt is already this panel's modifier
   * vocabulary (it bypasses snapping everywhere else, i.e. it always means "not the
   * ordinary reading of this gesture").
   */
  events: Array<{ key: string; shiftKey?: boolean; altKey?: boolean }>;
}

/**
 * The panel's keyboard, written ONCE.
 *
 * Users learn splitting and trimming by shortcut - every canonical NLE chord for those
 * (Cmd/Ctrl+B, Cmd/Ctrl+Shift+B, Cmd/Ctrl+K) collides with a browser binding whose
 * preventDefault() is unreliable, and a shortcut that silently does nothing is worse
 * than one that has to be learned. So the panel binds bare letters and Shift+letter,
 * which nothing fights for - and that trade only holds if the list is SHOWN. This
 * constant is both the sheet (`?`) and the contract `onKey` is written against.
 *
 * Labels go through `t()` here, at module scope, on purpose: this is a lazily imported
 * view, so the catalog has long since loaded by the time it evaluates, and switching
 * language reloads the page (i18n.ts's switchLang). Literal `t('…')` call sites are
 * also what scripts/translate.ts extracts - a `t(row.label)` at render time would need
 * every string hand-listed in extra-keys.spa.json instead.
 */
export const PANEL_SHORTCUTS: PanelShortcut[] = [
  { keys: 'Space', label: t('Play or pause'), events: [{ key: ' ' }, { key: 'Spacebar' }] },
  {
    keys: '← →',
    label: t('Move the playhead'),
    events: [{ key: 'ArrowLeft' }, { key: 'ArrowRight' }],
  },
  {
    keys: 'Home  End',
    label: t('Jump to the start or the end'),
    events: [{ key: 'Home' }, { key: 'End' }],
  },
  {
    keys: '↑ ↓',
    label: t('Select the previous or next clip'),
    events: [{ key: 'ArrowUp' }, { key: 'ArrowDown' }],
  },
  { keys: '[  ]', label: t('Select the in or out edge'), events: [{ key: '[' }, { key: ']' }] },
  {
    keys: ',  .',
    label: t('Nudge the selected edge'),
    hint: t('Hold Shift for ten frames'),
    events: [{ key: ',' }, { key: '.' }, { key: '<' }, { key: '>' }],
  },
  {
    keys: 'Alt + ← →',
    label: t('Previous or next keyframe'),
    events: [
      { key: 'ArrowLeft', altKey: true },
      { key: 'ArrowRight', altKey: true },
    ],
  },
  {
    keys: 'K',
    label: t('+Keyframe'),
    hint: t('Adds or updates the pose at the playhead'),
    events: [{ key: 'k' }],
  },
  { keys: 'E', label: t('Trim to the playhead'), events: [{ key: 'e' }] },
  { keys: 'S', label: t('Split at playhead'), events: [{ key: 's' }] },
  {
    keys: 'Shift + S',
    label: t('Split every clip at the playhead'),
    events: [{ key: 'S', shiftKey: true }],
  },
  { keys: 'Shift + D', label: t('Detach audio'), events: [{ key: 'D', shiftKey: true }] },
  {
    keys: 'O',
    label: t('Onion skin'),
    hint: t('Hold Shift for its options'),
    events: [{ key: 'o' }, { key: 'O', shiftKey: true }],
  },
  { keys: 'Alt', label: t('Hold to turn snapping off'), events: [] },
  {
    keys: '+  −',
    label: t('Zoom'),
    events: [{ key: '+' }, { key: '-' }, { key: '=' }, { key: '_' }],
  },
  { keys: 'F', label: t('Fit to view'), events: [{ key: 'f' }] },
  {
    keys: 'Delete',
    label: t('Delete the clip'),
    events: [{ key: 'Delete' }, { key: 'Backspace' }],
  },
  {
    keys: 'Shift + F10',
    label: t('Open the clip menu'),
    events: [{ key: 'F10', shiftKey: true }, { key: 'ContextMenu' }],
  },
  { keys: '?', label: t('Keyboard shortcuts'), events: [{ key: '?' }] },
  { keys: 'Esc', label: t('Step back, then close'), events: [{ key: 'Escape' }] },
];

export const finite = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

/**
 * The middle dot between two readings inside ONE inspector chip. A separator, not a
 * word - no `t()`, and it must never be built by concatenating a translated fragment
 * either side of it, which is how a summary turns into an untranslatable sentence.
 * (Between two SEPARATE chips the sheet draws a `border-inline-start` instead, which is
 * why that rule is logical rather than a physical left border: see parts/timeline.css.)
 */
export const CHIP_SEP = ' · ';
