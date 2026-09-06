# Plan: the mobile shell (2026-09-06)

The defects seen on the iOS build that are shell-level: files that never appear, uploads that vanish, the Sign utility unusable in portrait, the Clean utility refusing audio, the asset picker's overflowing action row, the design toolbar sitting on the timeline, and colour pickers with no eyedropper. Each traced to code; sizes S under a day, M one to three days.

File references: `lolly-web` at `45ee61a`, `lolly-tools` at `a892e36`, `lolly-mobile` (Tauri) at the umbrella's pointer.

## 1. Downloads on iOS and Android (ZIPs and every non-bridge save)

**Cause.** `shells/tauri-mobile/bridge-overrides/export.ts:161-171` overrides `host.export.download`, `file` and `share` to write under `$DOCUMENT/Lolly/` and open the share sheet. That works for Sign, which calls `host.export.file`. Batch and multi-edit ZIPs never reach it: `shells/web/src/pro/zip.ts:331-341` (`saveBlob`) and `:346-360` (`saveSequential`) click a raw `<a download>`. `pro/` is outside `bridge/`, so the Tauri resolve hook (`shells/tauri-mobile/vite.config.js:62-76`, which only rewrites imports from inside `bridge/`) never applies, and wry cancels an anchor download outright when no download handler is registered (`shells/tauri-desktop/bridge-overrides/export.ts:5-17` quotes the wry source). The render finishes; the file never appears.

Eleven more raw-anchor sites: `pro/index.ts:1635`, `views/profile.ts:2096,2200`, `views/start.ts:1158,1264`, `lib/brand-editor.ts:3592,6172,6299`, `views/catalog.ts:5676`, `components/rate-cards-manager.ts:230`, `bridge/clipboard.ts:85-92`.

**Fix (S, `lolly-web`).**

1. `saveBlob` and `saveSequential` become async and call `host.export.download(blob, filename)`; update `pro/run-overlay.ts:635,651,671` and `views/catalog.ts:5644-5652`. This one change fixes multi-edit "Download all", Projects "Render selection", the catalogue image ZIP and the `/pro` batch runner.
2. Sweep the eleven other sites; `pro/folder-export.ts:220` and `views/tool.ts:5646` are the model.
3. A guard test beside `boot-path-guard.test.ts`: no file outside `bridge/` may assign `.download` on a created anchor. The fix becomes a rule.
4. Check the mobile override's `webShare` accepts `application/zip` (Chromium's safelist rejects `application/vnd.lolly+zip`, noted at `bridge/export.ts:568-573`); fall back to the Files write with a toast naming the folder.

**Acceptance.** Multi-edit "Download all" on iOS opens the share sheet with the ZIP and the ZIP is in Files under Lolly; the guard test fails on any new raw anchor.

## 2. Uploaded assets vanish on iOS (Sign's initials, and every other upload)

**Cause.** Uploaded images are `asset` inputs with `allowUpload` and persist to the IndexedDB `user-assets` store (`shells/web/src/bridge/assets.ts:621-812`). The mobile shell overrides only `state`, `export` and `capabilities-provided`; its own comment at `bridge-overrides/state.ts:57-62` says why state and packs were moved to the filesystem: WKWebView purges site data under storage pressure. User assets were never moved. The drawn signature is a `longtext` input saved through `host.state`, so it survives; an uploaded initials image does not. `navigator.storage.persist()` (`bridge/index.ts:88-92`) is best-effort on Safari.

**Fix (M, `lolly-web` and `lolly-mobile`).** Add `shells/tauri-mobile/bridge-overrides/assets.ts` storing user-asset bytes under `$DOCUMENT/Lolly/assets/<id>/<version>` through the same fs adapter as `state-fs.ts`, keeping IndexedDB as the index (records, versions, tags). `bridge/assets.ts` already separates record from bytes, so the override wraps the byte read and write only. Register it in `vite.config.js` beside the three existing overrides and widen `src-tauri/capabilities/default.json`. Asset history (`bridge/asset-history.ts`) follows the same path.

**Acceptance.** Upload initials in Sign, force-quit, clear Safari website data, reopen: the initials are there. A tauri-mobile test round-trips `assets.bytes` through the fs adapter.

## 3. Sign in portrait: gestures and layout

**Cause.** `community/sign/template.html:53-65` is a single-pointer SVG pad; nothing in the tool handles a second touch. `styles.css:22-23` puts `touch-action: none` on the pad, the page preview and the placed signature, so the browser's pinch and pan are suppressed too. Resizing the placed signature is the number field at `template.html:23` only. The layout is a two-column grid at every width (`styles.css:21`; the sole media query at line 25 narrows the left column), `.card` is `overflow: hidden`, and the download button is the card's last flex child. Because `render.layout` is `canvas`, `fitCanvas()` (`views/tool.ts:2361`) scales the whole 820 by 650 layout to fit a portrait stage instead of letting it reflow. The preview size is hardcoded to fit 465 by 390 (`hooks.js:140`).

**Fix (M, `lolly-tools`, small `lolly-web` change).**

1. Two-finger pinch and pan on `.page-stage` with `touch` events, following `views/timeline-panel.ts:7808-7844` and its note on why pointer events cannot survive a browser-claimed two-finger pan. The stage gets `touch-action: pan-x pan-y`; only the pad keeps `none`. Pinch over the placed signature writes the `width` input; pinch elsewhere zooms the preview.
2. Corner handles on `.placed-signature` with 24 px targets on coarse pointers.
3. A stacked layout under `(max-width: 640px), (orientation: portrait)`: controls above the page, `.card` scrolls, the footer with the download button stays pinned, the preview fills the width with `aspect-ratio` from `pageW/pageH`, and the `hooks.js:140` fit becomes CSS.
4. Shell: allow a `canvas`-layout tool to declare a portrait size (`render.portrait: { width, height }`) that `fitCanvas()` picks on portrait stages; the mobile top pad at `views/tool.ts:2383-2388` is where it plugs in.
5. Hide "Add Content Credential" when `host.c2pa` is absent instead of failing at export; the hooks already feature-detect it.

**Acceptance.** iPhone portrait: controls stack, the page scrolls, the download button is reachable, two fingers zoom and pan, pinching the signature updates the width field. `tests/sign.test.ts` gains a layout-contract test.

## 4. Clean: "Audio cleanup is not available in this app" (diagnosed from code, not on a device)

`host.audio.clean` is an optional member of the audio API. The tool guards it and shows the refusal panel after the file is picked. The Tauri WKWebView build either does not ship the clean path or fails its feature check.

**Fix (S to M, `lolly-web`).** Find the gate in `shells/web/src/bridge/audio.ts`; if it is a capability probe WKWebView fails wrongly, fix the probe; if the path genuinely needs an API WKWebView lacks, declare a sub-capability and let `toolSupport` (`shells/web/src/capabilities.ts`) mark the utility unavailable on the card with the same copy, before the pick. The Trim card gets the same treatment for `host.media.trim`.

## 5. Asset picker: Private assets first and default; the action row behind a "+" on phones

**Cause.** `views/picker.ts:527-532` pushes Catalogue first unconditionally; the default is `library` unless remembered (`:548`, `lolly:pickerTab` at `:2841`); the library pane is the only one rendered un-hidden (`:582`), which `picker-initial-tab.test.ts` warns about. The footer (`:598-614`) is a flex row with no wrap, no scroll and no media query (`styles/picker.css:816-853`), unlike the tabs, which scroll (`:75-83`).

**Fix (S, `lolly-web`).** Order `uploads`, `sessions`, `library`, `projects`, `tools`; the un-hidden pane follows the first tab; default `uploads` when present, with `initialTab` and the remembered tab as overrides. Under 640 px replace the row with a "+" button hosted in the float cluster (`lib/float-cluster.ts`, adopted into open dialogs) opening a `body-popover` menu (`components/body-popover.ts`, which already documents opening from inside a native dialog and system-Back on touch). Add `projects` to `syncTabCounts` (`:620-639`).

**Acceptance.** On a phone the picker opens on Private assets with no horizontal overflow and "+" opens the actions; `picker-initial-tab.test.ts` and a footer contract test pass.

## 6. The design toolbar and the timeline on phones

**Cause.** Under `(pointer: coarse) and (max-width: 640px)` the toolbar dock becomes a 52 px horizontal scroller pinned `8px` above `--stage-reserve-bottom` (`styles/parts/editor.css:981-1036`) and its grip is hidden (`:1020`), so it cannot be moved. The timeline is a fixed full-width 112 px strip (`styles/parts/timeline.css:201-207`) whose `bottom` honours `--safe-bottom` and `--vv-bottom`; the dock's does not, and the dock's `z-index: 24` beats the timeline's 22. On a notched phone or with the keyboard up the toolbar covers the strip. There is no collapse control at any width. Opening the timeline needs the Design outcome dropdown (Video, Slides or Screencast; `views/design-workspace.ts:88-90`), and at phone widths the density ladder folds the Timeline toggle into More (`views/design-topbar.ts:771-797`), so nothing on screen says the editor exists.

**Fix (M, `lolly-web`).**

1. The mobile dock's `bottom` uses the same three insets the timeline uses; `reserveBottom()` (`free-canvas.ts:2223-2231`) reads the panel's painted height rather than a constant.
2. A collapse chevron on the toolbar at every width, to a single "Tools" pill, remembered per device under the `lolly:` prefix.
3. Long-press drag on phones to snap the dock to the top or bottom of the stage.
4. A Timeline button in the mobile toolbar row for every design outcome; first use sets the outcome to Video with a one-line notice. Remove the `Alt+1` hint on touch.
5. Fix the stale comment at `free-canvas.ts:4242-4245` (folding is the JS density ladder; `design-topbar.css` has no 640 px rule).

**Acceptance.** Toolbar and strip never overlap with the keyboard up or in landscape; the toolbar collapses and restores; the timeline opens from the toolbar. `primitive-guards.test.ts` gains a rule that the coarse-pointer dock `bottom` references all three insets.

## 7. The design tool mobile review

A checklist pass at 390 by 844 with a coarse pointer, one small PR per finding. Known from code: the navigator strip and text editing both hide the toolbar (`editor.css:1027,1033`) with no way back (the collapsed pill fixes it); the inspector is hidden on phones (`timeline.css:227`) and `.tl-mobile-tools` is the only route to snapping and keyframes; stage pinch (`views/tool-stage-nav.ts:471-476`) and timeline pinch (`timeline-panel.ts:7808`) need checking together; the colour popover is `position: fixed` (the reason the dock moves by `left`/`top`, `free-canvas.ts:3721-3725`) and must survive the keyboard. Add a phone-viewport docs shot for the design page so regressions show.

## 8. Eyedropper on iOS and Android

**Cause.** Both eyedroppers duck-check `window.EyeDropper` and remove the button when absent (`components/color-field.ts:1975-1978`, `lib/design-system/add-color.ts:219-243`). iOS Safari, Android Chrome and both Tauri WebViews have none, so phones have no control. No in-app sampling exists; the only single-pixel `getImageData` is a filter probe (`lib/canvas-filter-probe.ts:77`). `html2canvas` is stubbed out (`vite.config.js:614-618`).

**Fix (M, `lolly-web`).** `lib/eyedropper.ts` with `pickColor({ root })`: native `EyeDropper` when present; otherwise render the tool canvas once through `host.export.render(node, 'png')` (`bridge/export.ts:463`), draw it to an offscreen canvas with `willReadFrequently`, show a full-screen loupe following the finger, and read the pixel on release. Scope is the app's own surfaces; the OS screen is unreachable from a WebView. Both call sites use the helper and keep the `interact(true/false)` bracketing and `applyColor` shape. Lazy import; it must not land on the boot path.

**Acceptance.** On iOS the eyedropper button appears in the colour field and in Add colour; dragging over the tool canvas shows a loupe and picks the pixel. `lib/eyedropper.test.ts` with a stubbed render returning a two-colour PNG.

## 9. Loose ends from the screenshots

- "Reading depth" runs while the picker is open for a preview; the depth job should start only for a placed asset (`lib/depth-job.ts` from the picker's tile hydration). S.
- `Lolly/02-3d` renders a blank tile: 3D assets have no picker thumbnail; use the model's baked preview or a cube glyph. S.

## Order

Day one: items 1, 5 and 9 (all S, every mobile user hits them). Then 2 (unblocks Sign and every upload), 3, 6, 8, and 4 once the device diagnosis is in. Item 7 runs as its own checklist after 6. Every PR ends with `npm run check:bundle` (the boot path is at 135.8 of 136.0 KB, so the "+" menu and the eyedropper load lazily) and the maintainability budget (`free-canvas.ts` and `picker.ts` must not grow).
