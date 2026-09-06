# Plan: mobile fixes, utilities, revision history, and an agent skill (2026-09-06)

Scope: the fourteen items Andy raised from the iOS build on 2026-09-06 (screenshots: Sign in portrait, Clean refusing audio, the asset picker's bottom row, the design tool with the timeline strip under the toolbar). Every item below was traced to code before a fix was proposed; file references are to the umbrella at `3fea3b9`, `lolly-web` at `30507a4`, `lolly-tools` at `a892e36`, `lolly-work` at `987ab54`. Where a claim could not be verified on a device it says so.

Sizes: S is under a day, M is one to three days, L is a week or more. Waves at the end order the work so each PR is small and testable.

## 1. Sign: pinch, pan, resize; portrait layout; initials on iOS

**What is wrong.** Three separate defects in `community/sign/`:

- No two-finger gesture exists anywhere in the tool. The pad (`template.html:53-65`) is a single-pointer SVG with `setPointerCapture`, and `styles.css:22-23` sets `touch-action: none` on the pad, the page preview and the placed signature. So the browser's own pinch and pan are suppressed and nothing replaces them. Resizing the placed signature is a number field only (`template.html:23`, `Width (pt)`), with no drag handles.
- The layout never stacks. `.workspace` is a two-column grid at every width (`styles.css:21`; the one media query at line 25 narrows the left column to 220px). The card is `overflow: hidden` and the footer with the download button is its last flex child, so in portrait the whole 820 by 650 canvas is scaled down by `fitCanvas()` (`views/tool.ts:2361`) and the controls become unusably small rather than scrolling.
- Initials and signature images are `asset` inputs with `allowUpload` (`tool.json:16,24`). Uploads persist to the IndexedDB `user-assets` store (`shells/web/src/bridge/assets.ts:621-812`). The Tauri mobile shell overrides `state`, `export` and `capabilities-provided` only (`shells/tauri-mobile/bridge-overrides/`), and its own comment in `bridge-overrides/state.ts:57-62` explains why state and packs were moved to the filesystem: WKWebView purges site data under storage pressure. User assets were never moved, so a drawn signature (a `longtext` input, saved through `host.state`) survives and an uploaded initials image does not.

**Fix.**

1. Gestures (`community/sign/template.html`, `styles.css`). Add a pinch and two-finger pan on `.page-stage` using `touch` events, the same way the timeline panel does it (`shells/web/src/views/timeline-panel.ts:7808-7844` and its comment on why pointer events cannot survive a browser-claimed two-finger pan). Keep `touch-action: none` on the pad only; give the stage `touch-action: pan-x pan-y` so one finger still scrolls. Pinch over the placed signature scales its width (writes the same `width` input the number field writes, through `commit`); pinch elsewhere zooms the page preview with a transform on `.page` and pans within `.page-stage`. Add corner drag handles on `.placed-signature` for mouse and stylus, 24px hit targets on coarse pointers.
2. Portrait (`styles.css`). Replace the fixed two-column grid with `@media (max-width: 640px), (orientation: portrait)`: stack controls above the page, let `.card` scroll (`overflow: auto`), pin the footer with the download button at the bottom of the card, and lift the hardcoded 465 by 390 preview fit in `hooks.js:140` to a CSS-driven size (`width: 100%`, `aspect-ratio` from `pageW/pageH`). Ask the shell for a taller canvas in portrait: `render.layout: "canvas"` tools get `fitCanvas()` scaling, so either declare a portrait `render` variant or let the tool set `min-height` on the stage; the shell change is in `views/tool.ts:2383-2388` where the mobile top pad is applied.
3. Initials persistence (`lolly-web` and `tauri-mobile`). Add `shells/tauri-mobile/bridge-overrides/assets.ts` that stores uploaded user assets under `$DOCUMENT/Lolly/assets/` through the same `fs` adapter as `state-fs.ts`, and register it in `shells/tauri-mobile/vite.config.js` next to the three existing overrides. Keep the IndexedDB path as the index (ids, metadata, versions) and move only the bytes; `bridge/assets.ts` already separates record and bytes. Extend the capability scope in `src-tauri/capabilities/default.json`. This also fixes every other uploaded asset on iOS (logos, photos), not just initials.
4. Declare `requires` honestly: the hooks feature-detect `host.pdf`, `host.raster` and `host.c2pa`, so the manifest stays without `requires`, but the "Add Content Credential" checkbox should hide when `host.c2pa` is absent instead of failing at export.

**Acceptance.** On an iPhone in portrait: controls stack, the page scrolls, the download button is reachable; two fingers zoom and pan the page; pinching the signature changes the width field; an uploaded initials image is still there after force-quitting the app and clearing Safari data. Test: `tests/sign.test.ts` gains a layout-contract test (the stacked media query exists, no `touch-action: none` on the stage), and a tauri-mobile bridge test that `assets.bytes` round-trips through the fs adapter.

**Size.** M (gestures S, layout S, asset override M). Repos: `lolly-tools`, `lolly-web`, `lolly-mobile`, umbrella pointer.

## 2. Clean: "Audio cleanup is not available in this app" on iOS

**What is wrong (probable, not verified on device).** The Clean utility calls `host.audio.clean`, an optional member of the audio API (`packages/core/src/host-conformance.ts` lists it as optional). On the web the implementation is a WASM or WebCodecs path that the WKWebView build either does not ship or feature-detects away; the tool's guard then shows the red "Cannot continue" panel. Since the tool's manifest declares no `requires`, the gallery cannot grey it out and the user only learns at the end.

**Fix.** Find the `audio.clean` implementation in `shells/web/src/bridge/audio.ts` and its capability gate; if the gate is a `navigator.userAgent` or `AudioWorklet` check that WKWebView fails, fix the gate or ship the fallback. If the feature genuinely cannot run in WKWebView, add `requires: ["audio"]` is wrong (audio is present, clean is not), so instead add a `capabilities` flag for the sub-feature and let `toolSupport` (`shells/web/src/capabilities.ts`) show the utility as unavailable with the reason before the user picks a file. Either way the refusal moves from after the pick to the card.

**Acceptance.** On iOS the Clean card either works or is marked unavailable in the utilities grid with the same copy the panel shows now.

**Size.** S to M depending on cause. Repos: `lolly-web`, possibly `lolly-tools`.

## 3. Downloads of ZIPs (and every non-bridge save) on iOS and Android

**What is wrong.** Sign's download works on iOS because it goes through `host.export.file`, which `shells/tauri-mobile/bridge-overrides/export.ts:161-171` overrides to write under `$DOCUMENT/Lolly/` and open the share sheet. Batch and multi-edit ZIPs do not: `shells/web/src/pro/zip.ts:331-341` (`saveBlob`) and `:346-360` (`saveSequential`) create a raw `<a download>` and click it. `pro/` is outside `bridge/`, so the Tauri override never applies (`shells/tauri-mobile/vite.config.js:62-76` only rewrites imports from inside `bridge/`), and wry cancels an anchor download outright when no download handler is registered (`shells/tauri-desktop/bridge-overrides/export.ts:5-17` quotes the wry source). The render completes; the file never appears.

The same raw-anchor pattern is in eleven more places: `pro/index.ts:1635`, `views/profile.ts:2096,2200`, `views/start.ts:1158,1264`, `lib/brand-editor.ts:3592,6172,6299`, `views/catalog.ts:5676`, `components/rate-cards-manager.ts:230`, `bridge/clipboard.ts:85-92`.

**Fix.**

1. Make `saveBlob` and `saveSequential` in `pro/zip.ts` call `host.export.download(blob, filename)` (async) and update the three call sites in `pro/run-overlay.ts:635,651,671` and `views/catalog.ts:5644-5652`. This single change fixes multi-edit "Download all", Projects "Render selection", the catalogue image ZIP and the whole `/pro` batch runner.
2. Sweep the other eleven sites onto `host.export.download`. `folder-export.ts:220` and `views/tool.ts:5646` are the correct model.
3. Add a guard test in `shells/web/src/` (a sibling of `boot-path-guard.test.ts`): no file outside `bridge/` may contain `createElement('a')` with a `download` assignment. That turns the fix into a rule.
4. On iOS the share sheet is the only way to "see" a file; check the mobile override's `webShare` accepts `application/zip` (Chromium's safelist rejects `application/vnd.lolly+zip`, noted at `bridge/export.ts:568-573`), and fall back to the Files write plus a toast that names the folder.

**Acceptance.** Multi-edit "Download all" on iOS opens the share sheet with the ZIP, and the ZIP is in Files under Lolly. The guard test fails on any new raw anchor.

**Size.** S. Repos: `lolly-web`.

## 4. Trim: filmstrip, waveform and in/out handles; modifier-key trim in the sequence editor

**What exists.** Everything the trim utility needs already ships in the web shell: `lib/clip-thumbs.ts` (`filmstrip()` at line 912, `peaks()` at 2068, a seek queue that works around Safari cancelling overlapping seeks), the waveform path builder in `lib/vector-paint.ts`, and a complete trim-handle implementation in the timeline panel (`views/timeline-panel.ts:7290-7322`, coarse-pointer 24px edge zones from `timeline-config.ts:53`, the trim badge at 1637). The trim tool itself (`community/trim/`) has two disabled range inputs over nothing (`template.html:6`), no styles for them (`styles.css` has an orphan `.rail` rule instead), and reads duration only after the first job completes (`hooks.js:21`).

Clips in the sequence editor are already non-destructive: `community/design/tool.json:353-355` maps `start`, `dur`, `clipIn` and `speed`, `trimClip` in `views/timeline-math.ts:1596-1683` moves offsets and never cuts, `splitAll` gives the second half a later `clipIn` on the same source, and `joinClips` reverses it. Re-trimming a clip that was trimmed too far earlier already works by dragging the edge back out, bounded by `fitToMedia` (`timeline-math.ts:1213-1240`). The final render re-derives `clipIn + (t - start) * speed` (`bridge/sequence-plan.ts`). So "preserve the full clip until the final render" is already the model; the gap is only that the standalone Trim utility does not show it.

**Fix.**

1. A shared clip-range control. Extract from the timeline panel a `components/clip-range.ts` that renders one clip bar with a filmstrip (video) or waveform (audio) background, two edge grips, a playhead, and the trim badge, over a `{ mediaUrl, durationSec, inSec, outSec }` model with `onChange`. It reuses `clip-thumbs.ts` and `timeline-math.ts` (the panel's rule one: arithmetic stays in `timeline-math.ts`). The panel keeps its own bar rendering for now; the extraction is for the utility, and the panel adopts it later if it earns it.
2. Trim utility (`community/trim/`). Tools cannot import shell components, so the shell mounts the control for tools that declare it: add an input type or a manifest flag (`"ui": { "clipRange": { "start": "start", "end": "end" } }`) that `views/tool.ts` honours by mounting `clip-range` above the sidebar for that input pair, the way `blocks` inputs get their editor. The tool's template drops the range inputs; the number fields stay for exact entry. Live preview: the control seeks the `<video>`/`<audio>` in the template to the dragged edge (the utility already does this on `input`).
3. Duration before the first job: `hooks.js` should read `durationBefore` through `host.media` probe (or `host.audio.analyse` for audio) on `onInit` rather than after the first trim.
4. Modifier-key trim in the sequence editor. `Alt` is the panel's only chord and means "not the ordinary reading of this gesture" (`timeline-config.ts:262-269`). Add: `Alt` plus an edge drag is a ripple trim (neighbours shift to close the gap, via `removeAndRipple` semantics in `timeline-math.ts`); `Alt` plus a drag on the body is a slip (moves `clipIn` without moving `start` or `dur`). Both are new functions in `timeline-math.ts` with tests, and both must be added to `PANEL_SHORTCUTS` (`timeline-config.ts:289-360`) or the drift test fails. On touch, a long-press on an edge toggles ripple mode with a badge, since there is no Alt.
5. Audio and video together: a linked A/V pair already trims as a group (`timeline-panel.ts:7315-7322`); `Alt`-click selects one half. Document this on the shortcuts sheet, which is where the user is looking for it.

**Acceptance.** Trim on a phone: drag an in point across a filmstrip, hear and see the preview follow, export; the CSV of the numbers matches the handles. In the sequence editor: Alt-drag ripples, plain drag does not, and a clip trimmed too far can be dragged back out to the full source after any number of other edits. Tests: `timeline-math` gains ripple and slip cases; a `clip-range.test.ts` checks the DOM contract; the trim tool's smoke render still passes.

**Size.** M for the utility (control extraction M, tool wiring S), S for the modifier keys. Repos: `lolly-web`, `lolly-tools`.

## 5. Full revision history, visual, local and on lolly-work

**What exists.** Locally, a saved creation is one record overwritten in place (`shells/web/src/bridge/state.ts:94-113`); trash is a rename (`lib/batch-slots.ts:21`). There is no `state-versions` store. Three near-misses exist and are worth copying: per-asset byte history with a cap of 20 versions and a 512 MB ceiling (`bridge/asset-history.ts`, UI in `views/asset-versions.ts`), export history with a data-URL thumbnail per entry (`lib/export-history.ts`), and the in-memory undo stack (`views/tool-history.ts`). Every save already carries a thumbnail (`StateRecord.thumb`), which is what makes a visual timeline cheap.

On lolly-work, revisions exist server-side: `session_revisions` (migration `0004`), `SESSION_REVISION_LIMIT = 20` (`server/src/store/types.ts:241`), appended on every `PUT /api/v1/sessions/:id` (`api/app.ts:5531`) and bulk edit (`:5616`) with `actor = user.id`, and on collab quiesce with `actor = 'collab'`. `GET /api/v1/sessions/:id/revisions` exists (`app.ts:5552`) and is documented (`docs/api.md:283`). Nothing reads it: not the web shell (`org/session-source.ts` calls projects and sessions only), not the console. There is no restore route and no thumbnail on a revision.

**Fix.**

1. Local store (`lolly-web`). Add a `state-versions` object store keyed `[slot, versionId]` (bump `DB_VERSION` in `bridge/db.ts:37`, add to `REQUIRED_STORES`), copying `user-asset-versions`. In `createStateAPI().save()` push the previous `{ data, thumb, updatedAt }` before overwriting; cap at 30 per slot and share the 512 MB ceiling with asset history through `lib/file-history-storage.ts` so the storage screen stays honest. Restore is `save(slot, snapshot.data, snapshot.thumb)`, so the pre-restore state becomes the newest version.
2. Visual timeline (`lolly-web`). A `views/session-versions.ts` modal: a horizontal filmstrip of thumbnails newest-first, each with time, size and a "Restore" action, plus "Compare" that shows the two thumbnails side by side. Entry points: the Projects tile context menu (`views/projects.ts:1588`) beside Duplicate, and the tool view's Save menu. Diff of inputs (changed keys) under each tile is cheap because both `data` objects are plain input maps.
3. lolly-work. Add `POST /api/v1/sessions/:id/revisions/:rev/restore` that CAS-writes the chosen `inputs` at the current `rev` and appends a revision (restore is itself history), gated on `session.edit`, audited as `session.restore`. Add `thumb` to `SessionRevision.meta` written by the shell on save (a 320px JPEG data URL, capped at 24 KB) so the timeline needs no render round-trip; render on demand through `/render` only for revisions that predate the change. Raise the limit to 50 with cursor paging on `GET .../revisions` (`?before=rev`). Resolve `actor` to a display name in the response (`'collab'` becomes "Shared editing session").
4. Shell seam. `lib/session-source.ts` gains `listRevisions(sessionId)` and `restoreRevision(sessionId, rev)`; the local source implements them over `state-versions`, the org source over the two routes. The modal is the same component for both, which is the point: "on lolly-work it is linked to a user; standalone it is all local" becomes a source difference, not a UI difference.

**Acceptance.** Save a creation five times, open History, see five thumbnails, restore the second, see six. On a lolly-work instance the same modal shows the editor's name per revision and a restore audits. Tests: `bridge/state.test.ts` (versions, cap, restore ordering), lolly-work `tests/sessions.test.ts` (restore route, paging, thumb size cap), and a cross-source contract test in `lib/session-source.test.ts`.

**Size.** L overall (local store and modal M, lolly-work M). Repos: `lolly-web`, `lolly-work`.

## 6. Asset picker: Private assets first and default; the bottom row behind a floating "+" on mobile

**What is wrong.** Tab order is a hard-coded push sequence with Catalogue first (`views/picker.ts:527-532`), the default is `library` unless remembered (`:548`, memory key `lolly:pickerTab` at `:2841`), and the library pane is the only one rendered un-hidden in the markup (`:582`), so even a switched default paints Catalogue for one frame (the trap `picker-initial-tab.test.ts` documents). The footer (`:598-614`) is a `flex` row with no wrap, no scroll and no media query (`styles/picker.css:816-853`), so on a phone four or five buttons overflow horizontally, which is the screenshot.

**Fix.**

1. Order and default: push `uploads` first when `showUserAssets`, then `sessions`, then `library`, `projects`, `tools`; make the un-hidden pane follow the first tab rather than being baked to library; default to `uploads` when present. Keep `initialTab` and the remembered tab as overrides. Update `picker-initial-tab.test.ts`.
2. Mobile footer: under `(max-width: 640px)` replace the row with a floating "+" button bottom-right of the panel that opens a `body-popover` menu (`components/body-popover.ts`, which already documents opening from inside a native dialog and system-Back on touch) listing Upload, Take a photo, Capture screen (hidden when `getDisplayMedia` is absent, as now), Script audio, Upscale, Remove background. Host the button in the float cluster (`lib/float-cluster.ts`) so it stays clickable over the modal. Above 640px the row stays.
3. While there: the projects tab is missing from `syncTabCounts` (`picker.ts:620-639`); add it.

**Acceptance.** On a phone the picker opens on Private assets with no horizontal overflow; "+" opens the action menu; the remembered tab still wins for a user who switched to Catalogue. `picker-initial-tab.test.ts` and a new footer contract test pass.

**Size.** S. Repos: `lolly-web`.

## 7. Combine the dashboard with the profile view

**What exists.** `#/d` (`views/dashboard.ts`, 1517 lines, tabs device, brand, caps, activity) is documented as a read-only mirror of Profile (`dashboard.ts:1-35`). `#/profile` (`views/profile.ts`, 3361 lines) is the managing surface with thirteen collapsible sections. Activity and storage appear in both; the brand hero and "Adjust your brand" live in the dashboard only, while a stale comment in `brand-vars.ts:268` says profile gates that card. Both views mount the same home FAB and back pill.

**Fix.** One view, `#/profile`, with the dashboard's tabs as its top-level sections and the profile's cards inside them:

- Brand tab: the dashboard hero and instruments, then the Design systems card.
- You tab: Your details, Content Credentials, Appearance, Accessibility, Connected services.
- Device tab: This device, Storage (the managing version), Available offline, Hot folder, Capabilities.
- Activity tab: activity summary, Your renders, Feature flags, Lolly instance.

`#/d`, `#/dashboard`, `#/platform`, `#/capabilities`, `#/b` and `#/brand` (`main.ts:1727-1741,1829-1833,1890`) redirect to `#/profile?tab=…`; `?focus=<section>` keeps working. `views/dashboard.ts` becomes `views/profile-brand-tab.ts` and the registry in `views/dashboard-registry.ts` merges with `profile.ts:247-266`. This is also the seam the maintainability budget wants: `profile.ts` is a hotspot at 2438 logical lines and the merge should split it into one module per tab rather than growing it.

**Acceptance.** Every old route lands on the right tab; the docs shots for the dashboard and profile are re-captured (`scripts/build-docs-shots.ts --only=…`); the maintainability baseline for `profile.ts` goes down, not up.

**Size.** M. Repos: `lolly-web`, `lolly-docs` (shots and the two pages that name the dashboard).

## 8. The sequence editor on mobile, and the design tool's toolbar

**What is wrong.** The timeline is reachable on a phone only through the Design outcome dropdown (Video, Slides or Screencast make the Timeline toggle appear; `views/design-workspace.ts:88-90`), and at phone widths the top bar's density ladder folds that toggle into the More menu (`views/design-topbar.ts:771-797`). So it exists, but nothing on screen says so. Once open, the timeline is a fixed full-width 112px strip (`styles/parts/timeline.css:201-207`) and the toolbar dock is re-laid as a 52px horizontal scroller pinned `8px` above `--stage-reserve-bottom` (`styles/parts/editor.css:981-1036`). The dock's `bottom` ignores `--safe-bottom` and `--vv-bottom` while the timeline honours both, the dock is `z-index: 24` over the timeline's 22, and the grip that moves it is hidden under 640px (`editor.css:1020`). On a notched phone or with the keyboard up the toolbar sits on the strip, which is the screenshot. There is no collapse control at any width.

**Fix.**

1. Stacking: compute the mobile dock `bottom` from the same three terms the timeline uses (`--stage-reserve-bottom`, `--safe-bottom`, `--vv-bottom`), and have `reserveBottom()` (`free-canvas.ts:2223-2231`) read the timeline panel's actual painted height rather than a constant, so the two can never overlap.
2. Collapse: add a chevron at the end of the toolbar (all widths) that collapses the rail to a single "Tools" pill; remember the state per device in `localStorage` under the `lolly:` prefix. On phones the pill sits bottom-left and the timeline gets the full width beneath.
3. Move on mobile: keep the grip under 640px but make it a long-press drag (a plain drag scrolls the row), snapping the dock to top or bottom of the stage; persist the choice.
4. Opening the timeline: put the Timeline toggle into the mobile toolbar row itself (it is already `fc-btn-timeline` in the rail for timed tools at `free-canvas.ts:4604-4612`; make it visible for all design outcomes and let it set the outcome to Video on first use with a one-line notice). Add "Timeline" to the More menu label with its `Alt+1` hint removed on touch.
5. Fix the stale comment at `free-canvas.ts:4242-4245` (there is no 640px rule in `design-topbar.css`; folding is the JS density ladder).

**Acceptance.** On an iPhone with the timeline open: toolbar and strip never overlap with the keyboard up or in landscape; the toolbar collapses to a pill and back; the timeline can be opened from the toolbar without knowing about the outcome dropdown. `primitive-guards.test.ts` gains a rule that any `.fc-toolbar-dock` `bottom` under the coarse media query references all three insets.

**Size.** M. Repos: `lolly-web`.

## 9. The design tool's mobile review

Beyond item 8, a pass over the design tool at 390 by 844 with a coarse pointer. Known from code:

- The navigator strip hides the toolbar when open (`editor.css:1027`) and text editing hides it (`:1033`); both are right, but nothing shows how to get it back. Add the collapsed pill in those states.
- The inspector is hidden on phones (`timeline.css:227`) and the mobile tools expansion (`.tl-mobile-tools`) is the only way to reach snapping, keyframes and zoom. Audit which of those a phone user needs at all.
- Pinch to zoom exists on the stage (`views/tool-stage-nav.ts:471-476`) and the timeline (`timeline-panel.ts:7808`); check the two do not fight when the timeline is open.
- The colour popover positions with `position: fixed` and is why the dock is moved with `left`/`top` instead of transforms (`free-canvas.ts:3721-3725`); verify it stays on screen with the keyboard up.

Run it as a checklist with screenshots per state, file each finding as its own small PR, and add the phone viewport to the docs shots for the design page so regressions show.

**Size.** M (review) plus S per finding. Repos: `lolly-web`.

## 10. A skill for agents to drive Lolly

**What exists.** No `SKILL.md` or `.claude/skills/` anywhere in the repos. The raw material is spread across `docs/ai-agents.md`, `docs/mcp.md`, `services/mcp/README.md` (the best agent-facing text, with worked `layerOperations` examples for design), `docs/url-mode.md`, the built `/agents.md`, `/llms.txt` and `/openapi.json` (`docs/agents-pages.ts`), lolly-work's `docs/api.md` and `docs/renders.md`, and the CLI's `USAGE` block (`shells/cli/bin/lolly.ts:32-175`). One drift to fix first: `docs/mcp.md:54` says "The seven tools"; `services/mcp/src/tools.ts:233-379` exposes thirteen, and the six missing ones (`lolly_compile`, `lolly_inspect`, `lolly_measure`, `lolly_validate`, `lolly_diff`, `lolly_package`) include the validate-before-render step the server's own prompts insist on.

**Deliverable.** `skills/lolly/SKILL.md` in the umbrella (published under `docs/` so `/info` carries it, and mirrored to `.claude/skills/lolly/` so Claude Code picks it up), with reference files beside it:

- `SKILL.md`: when to use which surface. URL mode when the result is a link or an `<img>`; the public `GET /tool/<id>.<ext>` for bytes without auth (SVG and the browser-free formats only, C2PA off, deterministic); MCP for discover, describe, validate, render and the document verbs; the CLI when the agent has a shell (same argv as URL mode, `--output`, `--export`, `--no-provenance` for byte-stable output, `batch`, `smoke`); lolly-work's `/api/v1` when the target is a governed instance (sessions, `renders`, `render-batches`, `batch`, the `Idempotency-Key` and async job pattern). A decision table, then the canonical workflow: `lolly_list_tools` or `/llms.txt`, `lolly_describe_tool`, `lolly_validate`, `lolly_build_url` or `lolly_render`, share the editable link.
- `reference/url-mode.md`: the reserved params table from `docs/url-mode.md:220-278`, compact encoding, `z=` packed links, the embed URL grammar, multi-artboard and `s=` rules.
- `reference/tools.md`: every catalogue tool in one table (id, name, category, formats, `requires`, capabilities, one-line purpose), generated from `catalog/tools/index.json` by a script so it cannot drift, with the utilities grouped separately.
- `reference/chart.md`: the 133 inputs with their `urlKey` aliases, the CSV grammar for `d=`, the `chart-v1` spec schema, palette rules, motion presets, and five worked URLs.
- `reference/design.md`: the `boxes` block fields (99), the design-v1 read model (`inspectDesignV1`), `layerOperations` and `layerPatches` shapes, artboards and `frame`, timing fields, the ten templates, and worked examples for a poster, a carousel and a timed video.
- `reference/deck.md`: `deck-studio` (public) with the `spec` markdown dialect from `engine/src/deck-md.ts:12-49` and the `deck` blocks; `deck-builder` noted as SUSE-only.
- `reference/lolly-work-api.md`: the `/api/v1` surface with error codes, from `docs/api.md`.

Ship the generator (`scripts/gen-agent-skill.ts`) with a drift test so the tables regenerate with the catalog, the same pattern as `engine/README.md`.

**Acceptance.** An agent given only the skill can produce a chart PNG by URL, a design SVG through MCP with one `layerOperations` add, and a five-slide deck PPTX through the CLI, without reading any other doc. `tests/agent-skill.test.ts` checks the generated tables against the catalog and that every MCP tool in `tools.ts` is named in the skill.

**Size.** M. Repos: umbrella, `lolly-docs`.

## 11. The brand in force card: text colour by APCA

**What is wrong.** The hero is in the dashboard (`views/dashboard.ts:196-227`), not the profile. Its background and text come straight from brand custom properties written by `applyBrandVars` (`brand-vars.ts:1002-1019`) with shell-token fallbacks (`styles/parts/dashboard.css:201-207,239-261`); text colour is the brand's own `text` and `on-primary` slots, never derived from the background. A brand whose surface and text slots are both light paints unreadable copy.

**Fix.** In the hydration block (`dashboard.ts:1044-1056`), after the vars are applied, read the resolved `--brand-surface` and `--brand-primary`, compute `apcaContrast('#000', bg)` and `apcaContrast('#fff', bg)` (`engine/src/color-tools.ts:143`), and set `--brand-hero-ink` and `--brand-hero-on-primary` to whichever of black or white has the larger absolute Lc; the CSS uses those with the brand slots as a last fallback. Keep the brand's own `on-primary` when its Lc against `--brand-primary` clears `apcaUse` "body" (`color-tools.ts:212`); otherwise override. Do the same for the profile's Design systems card summary. Item 7 moves the hero into the profile, so land this first on the dashboard and carry it across.

**Acceptance.** A brand with a pale surface gets black ink; a dark one gets white; a brand whose own `on-primary` already reads keeps it. Test: `views/dashboard.test.ts` (or the merged profile test) with three token sets.

**Size.** S. Repos: `lolly-web`.

## 12. Start colour view: a "+" on blend and step swatches

**What is wrong.** Blend swatches in the brand editor (`lib/brand-editor.ts:417-430`, `blendRow`) are `<span>`s with a title and no action; ramp steps are buttons only where a step can be selected (`:399-402`). In the Colour Lab (`views/color-lab.ts:2687-2818`) blend stops copy to the clipboard by design ("take it away and use it"). There is no add-to-brand affordance on any blend or step swatch. The add API exists and is the sanctioned route: `BrandEditorHandle.addColors()` (`lib/brand-editor.ts:1103`, implemented at `:4519-4535`), which writes into the live document and persists once per batch.

**Fix.** In `blendRow` and `rampRow`, render each cell as a button with a small "+" that appears on hover and always on coarse pointers; clicking calls `addColorEntries([{ hex, name: 'Blend 3' }])` and flashes the swatch. In the Colour Lab, add an "Add to brand" action next to Copy on blend stops when a `BrandEditorHandle` is reachable (the Lab already reads the brand through `.lab-brand-rail`; give it the write seam through `views/start.ts`'s `addColorsToSystem` at `:1341`). Naming: "Blend {n}" and "{role} step {n}", editable afterwards in the Colours room.

**Acceptance.** Tapping "+" on a blend swatch adds it to the custom group and the palette rail updates without a reload. Test: `lib/brand-editor.test.ts` for `blendRow` markup and `addColorEntries` being called once per tap.

**Size.** S. Repos: `lolly-web`.

## 13. Eyedropper on iOS and Android

**What is wrong.** Both eyedroppers duck-check `window.EyeDropper` and remove the button when it is absent (`components/color-field.ts:1975-1978`, `lib/design-system/add-color.ts:219-243`). iOS Safari, Android Chrome and both Tauri WebViews have no `EyeDropper`, so on every phone there is no control at all. No in-app sampling exists: the only single-pixel `getImageData` in the tree is a filter feature probe (`lib/canvas-filter-probe.ts:77`). `html2canvas` is stubbed out (`shells/web/vite.config.js:614-618`).

**Fix.** An in-app sampler behind the same button:

1. `lib/eyedropper.ts`: `pickColor({ root })`. If `window.EyeDropper` exists, use it. Otherwise render the current tool canvas once through `host.export.render(node, 'png')` (`bridge/export.ts:463`), draw it to an offscreen canvas with `willReadFrequently`, overlay a full-screen magnifier loupe that follows the finger, and read `getImageData(x, y, 1, 1)` under it; commit on release. Scope is the app's own surfaces (the tool canvas, the brand editor previews), which is the stated requirement; the OS screen is out of reach in a WebView.
2. `components/color-field.ts:1975-1992` and `add-color.ts:426-430` call the helper instead of duck-checking; keep the `interact(true/false)` bracketing and `applyColor` shape.
3. Watch `detachExportHidden` (`bridge/export.ts:481`), which strips `[data-export-hide]` chrome before rendering; the sample should include the canvas only, so that is correct.

**Acceptance.** On iOS, the eyedropper button appears in the colour field and in Add colour; dragging over the tool canvas shows a loupe and picks the pixel colour. Test: `lib/eyedropper.test.ts` with a stubbed `render` returning a two-colour PNG.

**Size.** M. Repos: `lolly-web`.

## 14. Loose ends seen in the screenshots

- The "Reading depth" toast runs over the asset picker while picking a photo; the depth job should not start for a picker preview, only for a placed asset (`lib/depth-job.ts`, triggered from the picker's tile hydration). S.
- The `Lolly/02-3d` private asset renders a blank tile: 3D assets have no thumbnail in the picker. Use the model's baked preview or a cube glyph. S.
- The Clean and Trim cards should carry the same "works on this device" badge the gallery shows for capability-gated tools (item 2 covers the gate).

## Sequencing

Wave 1 (a day, all S, ship first because every mobile user hits them): item 3 (ZIP downloads, plus the guard test), item 6 (picker default and "+"), item 11 (APCA ink), item 12 (blend "+"), item 2 (Clean gate).

Wave 2 (mobile core): item 1 (Sign), item 8 (toolbar and timeline stacking, collapse, open path), item 13 (eyedropper), item 14.

Wave 3 (structure): item 7 (profile and dashboard merge, which also pays down the profile hotspot), item 9 (the design mobile checklist, one PR per finding).

Wave 4 (features): item 4 (Trim control and modifier trims), item 5 (revision history, local first, then lolly-work), item 10 (agent skill; can run in parallel with anything since it is docs plus a generator).

Every wave ends with `npm run check:bundle` (the boot path is at 135.8 of 136.0 KB, so the picker FAB and eyedropper must load lazily), the maintainability budget (items 7 and 8 must lower `profile.ts` and `free-canvas.ts`, not raise them), and a docs shot re-capture for any surface that moved.
