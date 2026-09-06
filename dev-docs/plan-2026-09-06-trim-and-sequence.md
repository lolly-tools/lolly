# Plan: the Trim utility and trimming in the sequence editor (2026-09-06)

Goal: trim a clip by dragging its edges over a filmstrip or waveform with a live preview, in the standalone Trim utility and in the design tool's timeline, with a modifier for the ripple and slip variants, and never lose the source so a trim can be undone many steps later.

File references: `lolly-web` at `45ee61a`, `lolly-tools` at `a892e36`.

## 1. What exists

**The sequence editor already has everything but the modifier.** The timeline panel (`shells/web/src/views/timeline-panel.ts`, arithmetic in `views/timeline-math.ts`, tunables in `views/timeline-config.ts`):

- Filmstrips and waveforms: `lib/clip-thumbs.ts` (`filmstrip()` at 912, `peaks()` at 2068, a seek queue at 505 that works around Safari cancelling overlapping seeks), drawn per bar at `timeline-panel.ts:6644` and `6792`; waveforms windowed to `[clipIn, clipIn + dur * speed]` so split halves differ.
- Trim handles: `EDGE_PX = 10` for precise pointers and `EDGE_PX_COARSE = 24` for touch (`timeline-config.ts:39,53`), chosen per event from `pointerType`; the gesture at `timeline-panel.ts:7290-7322`, one model write on pointer-up, a trim badge with absolute duration and signed delta (`:1637-1652`), a too-narrow state (`:2314-2325`), multi-clip trim on a selection (`:7315-7322`).
- Keyboard: `[` and `]` select an edge, `,` and `.` nudge (Shift is ten frames), `e` trims to the playhead (`:10136-10161`), all declared in `PANEL_SHORTCUTS` with a drift test.
- Pinch to zoom on touch (`:7808-7844`).

**The model is non-destructive.** `community/design/tool.json:353-355` maps `start`, `dur`, `clipIn`, `speed`; `trimClip` (`timeline-math.ts:1596-1683`) moves offsets (`in`: `start += d; dur -= d; clipIn += d * speed`; `out`: `dur += d`), clamped by `fitToMedia` (`:1213-1240`) so `clipIn + dur * speed <= mediaDurSec`; `splitAll` gives the second half a later `clipIn` on the same source; `joinClips` reverses it by that identity. The renderer re-derives `clipIn + (t - start) * speed` (`bridge/sequence-plan.ts`). A clip trimmed too far can always be dragged back to the full source, at any later point.

**The Trim utility has none of it.** `community/trim/template.html:6` has two range inputs, disabled until `loadedmetadata`, over no visual; `styles.css` styles none of the new markup and still carries an orphan `.rail` rule; `hooks.js:21` learns the duration only after the first trim job; the script at `template.html:27` has no null guard. `host.media.trim` (`shells/web/src/bridge/media-trim.ts`) does the work.

## 2. Design

### 2.1 A shared clip-range control

`components/clip-range.ts`: one clip bar over a `{ mediaUrl, kind: 'video' | 'audio', durationSec, inSec, outSec, speed? }` model with `onChange` and `onScrub`. It draws the filmstrip or waveform through `clip-thumbs.ts`, two edge grips sized from the same `EDGE_PX` constants, a playhead, and the trim badge. Arithmetic stays in `timeline-math.ts` (the panel's rule one); the control calls `trimClip` on a one-clip document and reads back `clipIn` and `dur`. Touch: pinch to zoom the bar, one finger pans, grips are 24 px.

The timeline panel does not switch to the control in this plan; it keeps its bar rendering. The control is extracted so the utility and the panel share the thumbnail and trim code, and the panel adopts it later if the extraction earns it.

### 2.2 The Trim utility

Tools cannot import shell components. The shell mounts the control for tools that ask: a manifest hint `"ui": { "clipRange": { "source": "source", "start": "start", "end": "end" } }` that `views/tool.ts` honours by mounting `clip-range` above the sidebar for that input trio, the way `blocks` inputs get their editor and `file` inputs get their drop zone. The tool's template drops the range inputs; the number fields stay for exact entry; the preview `<video>` or `<audio>` follows `onScrub`, which is what the existing `input` handler does today.

`hooks.js` reads the duration on `onInit` through `host.media` (a probe call, or `host.audio.analyse` for audio) so the control is live before the first job. `styles.css` gets rules for `.controls`, `.result` and `.check`, and drops `.rail`.

A CLI user gets the same result from `--start` and `--end`; the control is a shell affordance over the same inputs, so URL mode does not change.

### 2.3 Modifier-key trims in the sequence editor

`Alt` is the panel's single reserved chord and means "not the ordinary reading" (`timeline-config.ts:262-269`: bypass snapping, select one half of a linked pair, copy a keyframe). Extend it:

- `Alt` plus an edge drag: ripple trim. The edge moves and every later clip on the lane shifts by the same delta (reuse the `removeAndRipple` shift in `timeline-math.ts`).
- `Alt` plus a body drag: slip. `clipIn` moves, `start` and `dur` do not, bounded by `fitToMedia`.
- `Alt` plus `,` and `.`: ripple nudge.

New functions `rippleTrim` and `slipClip` in `timeline-math.ts`, keyframe tracks rebased the way `trimClip` already does (`:1667-1674`). Both go into `PANEL_SHORTCUTS` or the drift test fails. On touch there is no Alt: a long-press on an edge toggles ripple mode with a badge until release; a two-finger drag on a body slips.

Linked audio and video already trim together; `Alt`-click picks one half. Put both on the shortcuts sheet, which is where users look.

### 2.4 Preserving the source

Already true (section 1). Two additions make it visible: the trim badge shows the available media extent beyond the edge (the panel has the FCP-style extent at `:1623`; the control shows it too), and the inspector's Trim-in field shows "of 12.4 s" so a user knows a clip can grow back.

## 3. Tests

- `timeline-math.test.ts`: `rippleTrim` and `slipClip` cases, keyframe rebasing, bounds.
- `timeline-panel.test.ts`: the shortcuts drift test covers the new bindings; the Alt gesture branches.
- `components/clip-range.test.ts`: DOM contract, grip zones per pointer type, `onChange` values equal the arithmetic's.
- `tests/trim.test.ts` (umbrella): the tool renders at defaults, the manifest hint validates, the smoke render passes.

## 4. Order and size

1. `clip-range` extraction (M). 2. Trim utility wiring and manifest hint (S, `lolly-tools` and `lolly-web`, schema change in the umbrella). 3. Modifier trims and touch equivalents (S). 4. The extent affordances (S).
