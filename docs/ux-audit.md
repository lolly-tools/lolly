# UX Audit — web shell

Audit of all web-shell views (gallery, tool runner, profile, capabilities, platform,
privacy notice, Pro batch mode — including the grid, the side-docked blocks-editor
panel, and the collapsible export columns / relevance tag bar) plus the shared
design system. Findings are in priority order. `[systemic]` = surfaced across
multiple views, so one fix lands everywhere.

Severity: **Critical** blocks a core task or excludes a user group · **High**
frequent friction or a broken state · **Medium** noticeable · **Low** polish.
Effort: **S** <1h · **M** a few hours · **L** a day+.

> Status legend: ✅ done in the first quick-wins pass · ⬜ open.

> Line refs need a refresh pass: `tool.js` is now ~3973 lines and most `tool.js`
> anchors below have drifted (e.g. `967`→`989` `.canvas-error`, `3034`→`3121`
> export `aria-busy`, `2047`→`2092` block remove). Each still points at the right
> construct; the numbers are just off enough to slow a reader.

---

## P0 — Critical

1. ✅ **Tool canvas render-failure state.** A throwing template script left a stale/
   half-built canvas with no signal. `tool.js:967`. → Wrapped the render (innerHTML +
   `runTemplateScripts`) in try/catch; on failure shows a `.canvas-error` `role="alert"`
   banner on the stage (sibling of the canvas, survives the per-render rebuild, cleared
   on next good render). `syncUrl` still runs so the link stays correct. Solid
   destructive banner — AA in all themes. **Open:** async/network tool scripts still
   need a `tool:error` channel for Retry (audit #8) — bigger, deferred.
2. ⬜ **Batch render freezes the tab.** The per-row loop now `await`s
   `renderRowToBlob` each iteration with a per-row `isCancelled()` check
   (`pro/batch.js:47,62`), so cancel/progress already update between rows — but a
   heavy synchronous render inside that await, plus the still-synchronous `zipSync`
   (`pro/zip.js:101`, "synchronous; fine for a click-time action"), still pin the tab.
   → Yield around the render; add a "Packaging…" state before zip; move to a worker. **M**
3. ✅ **Profile save ejected you and had no failure path.** Redirected home after 800ms;
   on failure the submit button stayed permanently disabled. `profile.js:433`.
   → Removed the redirect, added try/catch + announced error + button restore.

---

## P1 — High

4. ✅ **Theme contrast failures `[systemic]`.** Light `muted-foreground` on `muted`
   ≈4.30:1; float-label resting text at 0.65 alpha ≈2.49:1; SUSE border ≈1.67:1.
   → Darkened/lightened `--muted-foreground`, raised resting-label alpha to 0.9,
   bumped light + SUSE `--border`/`--input`. (Borders are a moderate bump — may want
   to go further after a visual check.)
5. ✅ **Focus rings inconsistent / sub-threshold `[systemic]`.** Many inputs replaced the
   global ring with `outline:none` + a 0.15-alpha shadow on `:focus`; select / dim-unit /
   hex / search got only a 1px border tint. → Added a consolidated `:focus-visible` block
   restoring a real 2px ring on all flagged controls (text/select/time/block/vec/dim/
   export/password/filename/profile/hex/info-dot) and strengthened the slider thumb ring
   from 0.3-alpha to solid. Mouse focus keeps the subtle styled look; keyboard focus now
   shows a high-contrast ring in every theme. Verified: light `#0c322c`, SUSE `#30ba78`.
6. ⬜ **Offline & sync state promised but never rendered `[systemic]`.** `sync.js:12`
   describes an offline indicator that doesn't exist; failed catalog fetch just logs
   (`sync.js:50,99`). → Ship an offline chip + boot loading state + retry banner. **M**
7. ⬜ **Missing accessible names / keyboard on custom controls.**
   - ✅ Sliders had no accessible name (`role="slider"`, no label) — added `aria-label`. `tool.js:2185`.
   - ⬜ Block reorder is pointer-only DnD, no keyboard path. `tool.js:2076`. **L**
   - ⬜ Pro grid has a full keyboard model but zero ARIA grid roles. `grid.js:242`. **M**
8. ⬜ **No header/nav landmark.** `main.js` wires `.nav-btn[data-route]` elements that
   don't exist in the DOM (`main.js:41`). (Skip-link is fine — already scoped to the
   tool route via `:has()`, `app.css:28`.) → Render a real banner/nav or remove the
   orphaned wiring. **M**
9. ⬜ **Search buried and weak.** Lives in the fixed bottom footer
   (`gallery.js:133`, inside the footer at `:130`). It now auto-focuses on
   fine-pointer load and renders an `aria-live` results region with a
   `No tools match "…"` message (`gallery.js:111,224,227`), so it is no longer a
   silent dead end — but it still matches name only (`index.tools.filter(t => t.name…)`)
   and offers no browse-all recovery. → Promote to top; match
   name+description+category; add a clear/browse-all recovery. **M**
10. ✅ **Export progress for slow formats.** CMYK/large-raster/PDF only disabled the
    button; failures weren't announced. `tool.js:3034`. → Non-animated exports now show
    "Exporting…", set `aria-busy`, and announce start/complete/fail. Verified: button
    flips Download→"Exporting…"→Download with aria-busy toggling correctly.
11. ⬜ **Destructive actions lack undo `[systemic]`.** Two-step confirms now exist for
    the high-stakes deletes: typed (card) block rows arm a "Delete?" button
    (`tool.js:2092-2120`; compact name/value rows still delete immediately) and Pro
    row-delete arms a red "Remove?" with a 3s auto-cancel (`pro/index.js:241-262`).
    But none of them restore — and "Clear changes" is still a single confirm with no
    restore (`tool.js:1039`), while CSV/session import bypasses the dirty-guard
    (`pro/index.js:210-222` guards nav but not import). → Snapshot + "Undo" toast on
    every delete; run the dirty-guard before CSV/session import. **S–M**
12. ⬜ **Profile save model is split.** Theme/flags/headshot autosave, identity fields
    need explicit Save → leaving loses them. `profile.js:78,433`. → Autosave identity
    fields on blur (or dirty-guard nav). **M**
13. ✅/⬜ **Sub-44px touch targets `[systemic]`.** Added 44px to nav / fullscreen / stage-nav
    / export-close / privacy-dismiss in the coarse-pointer block. **Still open:** corner
    overlay deletes (`.saved-delete`, `.userimg-delete`, `.headshot-remove`,
    `.block-remove`) — deferred, enlarging them risks stealing taps from the card. **M**
14. ⬜ **Pro batch unusable on touch, never said so.** Resize/scrub/reorder/clear are
    hover/precise-pointer only. → Touch affordances or an honest "best on a larger
    screen" notice on coarse pointers. **L**
15. ✅ **"No servers" privacy claim was inaccurate.** The app does fetch its catalog from
    an origin. `privacy-notice.js:38`. → Reworded to "Everything stays on your device —
    no tracking, no accounts." (docs/privacy.md keeps the accurate "no servers that see
    your data" framing.)

---

## P2 — Medium

- ⬜ **No loading/skeleton states `[systemic]`** — gallery/profile/platform `await`
  before first paint. Paint the shell first, fill async.
- ⬜ **Pro partial-failure buried** — "Done — N files" even when rows errored. Add an
  "X of Y, Z failed" headline + per-row status. `pro/index.js:1088`.
- ⬜ **Typing lag** — `showIf` flips force a full sidebar rebuild (flatpickr teardown +
  `syncUrl`/`replaceState` per keystroke). `inputs-sync.js:47`, `tool.js:1683`.
- ⬜ **Color popover not a managed dialog** — focus not trapped, dismissal varies.
  `color-field.js:148`.
- ⬜ **Theme picker isn't a radio group** — three `aria-pressed` buttons, no group/
  arrow-keys. `profile.js:110`.
- ⬜ **No field validation/types** — email/phone are `type="text"`. `profile.js:82`.
- ✅ **Reduced-motion gap (shutter)** — full-viewport rotating iris ignored the
  preference; now `transition: none` under reduced motion. **Still open:** info-dot
  tooltips are hover-only (unreachable on touch).
- ⬜ **`alert()` for headshot/image errors** — `profile.js:254,309`. Use the in-page pattern.
- ⬜ **Fragmented breakpoints** — 640/641 vs a 756px gallery query.
- ⬜ **Pro discoverability** — CSV import hidden in the Sessions dialog; add-row
  shortcuts are comment-only. `pro/index.js:721,858`.
- ⬜ **Reserved-column collisions** — a tool input named `width`/`format`/etc. routes
  CSV/paste to export dims silently. `pro/io.js:31`.
- ⬜ **Empty states missing** — no first-render canvas placeholder; no gallery first-run
  orientation (H1 is visually-hidden).
- ⬜ **Composed (nested) renders fail silently `[systemic]`** — tools can embed another
  tool's render (e.g. event-name-badge composes qr-code; `lolly.tools/tool/…` embed URLs
  are neutralised then hydrated locally at `tool.js:1014,1019` and in batch export at
  `render-export.js`). When a composed child errors, cycles, or times out, its slot is
  cleared with no signal (`{{#if id}}` just hides it) — the same silent-failure theme as
  P0 #1's render work, but with no `role="alert"` equivalent. (Compose UX only; the
  format-support contract lives in the authoring/compose docs.)
- ⬜ **File-input drop-zone unaudited** — tools with a `file` input + `render.layout:canvas`
  (strip-data) present a full-bleed drop zone for an on-device transform. No item covers
  its drag-drop affordance, keyboard path, or the file-picker/empty UX for these utilities
  (the "Empty states" and dropped-asset items only graze it).
- ⬜ **Pro blocks-editor side panel unaudited** — `pro/blocks-editor.js` (wired at
  `pro/index.js:27`/`676`) is a side-docked panel with a debounced (~400ms) live preview
  and its own focus handling; never reviewed for focus trap, dismissal, or touch.

---

## P3 — Low

- ⬜ Button primitives reinvented 8+ times; hardcoded `hsl(0 72% 51%)` danger colors that
  don't theme. Extract `.btn-primary/.btn-danger`, use `var(--destructive)`. `app.css:2914`.
- ⬜ px-based type scale (~130 sizes, `body:14px`) ignores browser font-size preference —
  phase a `rem` migration. **L**
- ⬜ Category headings render raw enum keys uppercased ("EVERYONE") — add a display map.
- ⬜ Community/install badges use non-token colors failing AA at 10px.
- ⬜ Pro quips: a couple are broken/off-brand ("3 extra months free" on a free product) —
  copy edit. `pro/quips.js`.
- ⬜ No shared toast/snackbar primitive — "Copied" feedback is bespoke per surface.

---

## Strengths (don't regress)

Reduced-motion policy (keeps functional transitions, exempts the creative canvas) ·
focus preservation across full sidebar rebuilds · the picker's 2D arrow-key grid nav ·
storage transparency + portable export/import · Pro's failure-isolation + reproducible-run
zip · the skip-link correctly scoped to the tool route via `:has()`.
