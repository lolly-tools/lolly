# Release Notes — v0.01 (2026-06-12)

First tagged release of Lolly. The web shell is live, the engine is stable, and the initial tool set covers the most common employee and designer workflows.

---

## What's new

### Product Lockup tool
Generate SUSE product name lockups as outlined SVG paths. Official status — exports are brand-approved and watermark-free.

### Fullscreen and drag-to-resize sidebar
The sidebar can now be resized by dragging its right edge and collapsed entirely to give the canvas full screen space. A floating reopen button appears when collapsed. State persists across sessions.

Shortcut: append `?full` to any tool URL to open it with the sidebar already collapsed.

### URL-controlled canvas dimensions
`?w=` / `?width=` (and `?h=` / `?height=`) now set both the canvas document size and pre-fill the export dimensions panel in one step. Works on the web and via CLI:

```
/#/tool/qr-code?url=https://suse.com&w=1200&h=628
brand-tool qr-code --url=https://suse.com --w=1200 --h=628 --export=png
```

### Utility tool layout
Tools that declare `"export": false` and have no inputs now render fullscreen with no sidebar — the canvas takes the whole viewport. Color Palette uses this mode.

### `afterExport` hook
Tools can now declare an `afterExport` lifecycle hook that fires after the export blob is produced. Useful for cleanup, telemetry, or chaining exports.

### Session thumbnails
Saving a session now captures a thumbnail (max 100×100 px) of the canvas at the moment of save. Thumbnails appear in the saved sessions list on the home screen so you can identify sessions at a glance without reopening them. Deleting a session removes the thumbnail with it.

### URL filename parameter
`?filename=` sets the download filename for auto-exports. The format extension is appended automatically:

```
/#/tool/qr-code?url=https://suse.com&export=png&filename=homepage-qr
→ downloads as homepage-qr.png
```

Without `filename=`, the download falls back to the tool ID.

---

## Tools shipped

| Tool | Status | Category |
|---|---|---|
| QR Code Generator | Official | Employee |
| Quote Card | Official | Employee |
| Color Palette | Official | Designer |
| Product Lockup | Official | Designer |
| Bag Video | Official | Product |
| Film Burn Filter | Experimental | Designer |

---

## Platform changes

| Area | Change |
|---|---|
| Engine | `afterExport` hook added to the tool lifecycle |
| Schema | `render.export: false` flag for no-export utility tools |
| Schema | `hooks.afterExport` flag |
| URL mode | `width`/`w`, `height`/`h`, `full`, `filename` are now reserved params (not forwarded to tool inputs) |
| URL mode | `?filename=` sets the download filename for auto-exports |
| Web shell | Sidebar: drag-to-resize, collapsible, localStorage persistence |
| Web shell | Canvas scales responsively via CSS transform + ResizeObserver |
| Web shell | Click a canvas element to focus its sidebar control |
| Web shell | Saved sessions capture a thumbnail on save; displayed in the home screen session list |

---

## Known limitations

- Saved state is per-device (no SUSE ID sync). Clearing browser storage loses sessions.

---

# Since v0.01 (2026-06-13 → 2026-06-15)

---

## What's new

### Email Signature tool
Generate on-brand SUSE email signatures ready to paste into any email client. Supports first name, last name, job title, certifications, email, phone, mobile, fax, address, IM handle, and an optional executive headshot. Exports as HTML (copyable), plain text, or PNG. Profile bindings auto-fill name, email, and phone from saved profile. Includes Germany, Business, and Culture legal appends.

### Executive headshots as pre-loaded assets
SUSE executive headshots are now bundled into the asset catalog and available offline. They appear automatically in any `asset` input that filters on `suse/executives` — no upload required. The email signature tool uses this to let you pick an exec photo for event-facing signatures.

### Gallery redesign and tool thumbnails
The tools gallery has been reworked: tool cards now show a live thumbnail preview, layout adapts cleanly to narrow screens, and the overall page is faster to scan. Tool thumbnails load from saved session state where available.

### Sticky header
The app header is now sticky on scroll. Long tool canvases no longer lose the navigation bar.

### Mobile polish
Sidebar and canvas layout now behave correctly at mobile breakpoints.

### Input click-to-focus improvements
Clicking any element on the canvas now highlights its corresponding sidebar control with improved scroll-into-view behavior and visual feedback.

---

## Tools shipped

| Tool | Status | Category |
|---|---|---|
| QR Code Generator | Official | Employee |
| Quote Card | Official | Employee |
| Email Signature | Official | Employee |
| Color Palette | Official | Designer |
| Product Lockup | Official | Designer |
| Bag Video | Official | Product |
| Film Burn Filter | Experimental | Designer |

---

## Platform changes

| Area | Change |
|---|---|
| Catalog | Executive headshots added to `suse/executives` asset namespace; bundled for offline use |
| Export bridge | HTML and plain-text export formats added alongside existing PNG/SVG/PDF |
| Web shell | Gallery: card thumbnails, responsive layout rework |
| Web shell | App header is now sticky on scroll |
| Web shell | Mobile layout fixes for sidebar and canvas |
| Web shell | Click-to-focus scroll-into-view and highlight polish |

---

# Since v0.01 (2026-06-16)

---

## What's new

### Day Brief tool
A daily briefing card with the quote of the day, live weather, local time, and a world-map locator for any city. First tool to use the `"network"` capability — it fetches weather/time through `host.net`, the allowlisted fetch bridge.

### Code Canvas tool
Turn code snippets into beautiful, shareable images — syntax highlighted and brand themed. Exports as PNG or SVG.

### Team Map tool
Show a distributed team on a world map with each person's local time. Introduces the `blocks` input type — a repeating group editor (add / remove / reorder rows) that round-trips to the URL as JSON.

### Countdown Timer tool
A focused countdown with a live donut progress ring; click to pause. Utility-category, HTML render.

### Quote of the day refresh
The quote pool behind the daily tools was expanded and refreshed.

### Stable-framerate animated export
WebM and GIF recording was reworked to a two-phase render-then-replay pipeline. Each frame is rendered sequentially (slower than real time on weak hardware) so every frame is unique — no dropped or duplicated frames. Output plays back at the intended rate regardless of render speed. WebM gains an optional **60fps** toggle for high-smoothness clips.

### Clear-all inputs
A "Clear all" button in the tool sidebar blanks every input back to its default in one click.

### Gallery & profile storage management
Saved sessions now show their size and timestamp, and display the export filename (falling back to the tool ID). The profile page gained per-category storage controls: clear saved sessions, clear the asset cache, or clear everything, each with live usage readouts.

---

## Tools shipped

| Tool | Status | Category |
|---|---|---|
| QR Code Generator | Official | Employee |
| Quote Card | Official | Employee |
| Email Signature | Official | Employee |
| Day Brief | Official | Employee |
| Code Canvas | Official | Employee |
| Team Map | Official | Employee |
| Countdown Timer | Official | Utility |
| Color Palette | Official | Utility |
| Product Lockup | Experimental | Designer |
| Bag Video | Experimental | Designer |
| Film Burn Filter | Experimental | Designer |

---

## Platform changes

| Area | Change |
|---|---|
| Schema | `blocks`, `time`, and `datetime-local` input types added |
| Engine | `onInit`/`onInput` hooks may be async; hook calls are wrapped with timeouts (onInit 5s, onInput 2s) |
| Export bridge | Two-phase stable-framerate WebM/GIF capture; optional 60fps WebM |
| Catalog sync | Tool index always fetched fresh with localStorage offline fallback; asset ETags moved to localStorage; service-worker cache-first for `/tools/**` |
| Web shell | "Clear all" inputs button; saved-session size/time/filename display; profile storage management (sessions / cache / everything) |
| Web shell | opentype.js lazy-loaded on demand (`lockup`); email-signature headshots downscaled for the Gmail 10 KB signature limit |

---

# Since v0.01 (2026-06-21)

This is the largest update since the first release — four new tools, plus major engine, batch, units, and export work.

---

## What's new

### Dynamic Layout tool
A do-anything layout that recomposes around whatever you add, at any size — text, images, and assets flow into a balanced, on-brand composition without manual positioning. (everyone, official)

### Logo tool
Place the SUSE logo and it auto-picks the right variant for the theme/background and exports as clean vector. Ships alongside the full SUSE logo asset set (8 variants) bundled into the catalog. (everyone, official)

### URL Screenshot tool
Capture any web page — at any scroll depth, with optional custom CSS injected before the shot. Introduces the `capture` bridge capability: native on Tauri (headless Chromium), and on the web via a companion **Chrome extension** that drives capture through the Chrome DevTools Protocol. (utility, experimental)

### Chart Creator tool
On-brand charts from your data — bar, donut, pie, or stacked — exported as vector. (designer, official)

### Vector input type
A new compound `vector` input (zoom / x / y) with Figma-style scrubbers, presented as a single control and a single batch column. Embedded SVGs now render as true vectors with improved curve handling.

### Physical units & DPI
`width`/`height` accept physical units (`mm`/`cm`/`in`/`pt`, `px` default), with `dpi` controlling raster resolution. Conversion is applied per format at export — PDF in true points, SVG in units, raster at DPI (PNG embeds a `pHYs` chunk). Batch rows support per-row unit and DPI.

### Batch (Pro) mode
A power-user bulk grid at `#/pro` for generating many assets at once from a spreadsheet-like editor, with shared canonical input columns.

### Feature flags
The profile page gained feature-flag toggles (default on) that hide gallery categories and the Batch link, so a deployment can present a trimmed-down tool set.

### Export provenance
Exports now embed authorship/Lolly provenance metadata per format (PNG iTXt, JPEG EXIF, PDF info, SVG metadata, GIF comment) — no copyright symbol, and no personal data unless explicitly opted in.

---

## Tools shipped

| Tool | Status | Category |
|---|---|---|
| QR Code Generator | Official | Everyone |
| Quote Card | Official | Everyone |
| Email Signature | Official | Everyone |
| Day Brief | Official | Everyone |
| Code Canvas | Official | Everyone |
| Meeting Planner | Official | Everyone |
| Dynamic Layout | Official | Everyone |
| Logo | Official | Everyone |
| Chart Creator | Official | Designer |
| Duotone Filter | Official | Designer |
| Product Lockup | Experimental | Designer |
| Bag Video | Experimental | Designer |
| Film Burn Filter | Experimental | Designer |
| Color Palette | Official | Utility |
| Countdown Timer | Official | Utility |
| URL Screenshot | Experimental | Utility |

---

## Platform changes

| Area | Change |
|---|---|
| Engine | `capture` bridge capability (web/CLI stubbed, Tauri native); embedded-SVG vector rendering via `convertPaths` |
| Schema | `vector` compound input type; canonical inputs vocabulary (`schemas/canonical-inputs.json`) |
| Units | Physical units (`mm`/`cm`/`in`/`pt`) + `dpi`, converted per format in `engine/src/units.js`; per-row unit/DPI in batch |
| Export bridge | Per-format provenance metadata; MP4 export support; data/CSV exports |
| Catalog | SUSE logo asset set (8 variants); logo auto-switching by theme |
| Web shell | Batch (Pro) grid at `#/pro`; profile feature flags; "Render" promoted as the hero action |
| Shells | Tauri native URL capture (headless Chromium); Chrome capture extension for the web app |

---

## Known limitations

- Saved state is per-device (no SUSE ID sync). Clearing browser storage loses sessions.
- URL capture is native-only — fully functional on Tauri and via the Chrome extension on the web; the bare web shell and CLI stub it.

---

# Since v0.01 (2026-06-22 → 2026-06-27)

Eleven new tools — across the Designer, Event, and offline-utility sets — plus tool composition, on-device file utilities, and new vector/data export paths.

---

## What's new

### Color Block tool
Typed colour blocks that auto-compose into a grid which fills any frame, at any size. (everyone, official)

### Brand Lockup tool
Official SUSE logo lockups — chameleon, wordmark, and a product or team name — exported as outlined vector. Replaces the earlier Product Lockup tool. (designer, official)

### Street Map tool
A clean vector street-block map of a bundled city; renders fully offline. (designer, official)

### Halftone Filter tool
Turns a photo into a vector halftone dot grid, exported as SVG or transparent PNG/WebP/AVIF. (designer, official)

### Scanline Filter tool
Turns a photo into a retro scanline grid — alternate lines drop out and the rest is posterised into brand tones as crisp rects, exported as SVG or transparent PNG/WebP/AVIF. (designer, official)

### Animated Ad tool
Builds a looping digital ad from scenes — exported as a self-contained HTML banner, GIF, MP4, or a still poster. (designer, official)

### Event Name Badge tool
Print-ready conference name badges with a role colour and an optional QR code. First tool to use **composition** — it renders the QR Code tool inline via the new `compose` capability. (event, official)

### Wayfinding Signage tool
Directional event signs, each destination paired with an arrow; print-ready. (event, official)

### Calendar ICS tool
Turns an event into a calendar `.ics` for Outlook, Google, or Apple, alongside a shareable card. (event, official)

### Strip Hidden Data tool
Reveals and removes hidden metadata from images and PDFs entirely on-device — nothing is uploaded. (utility, official)

### Text Helper tool
Format, decode, hash, and de-identify text (JSON/YAML/Helm/JWT and more), all on-device. (utility, official)

### Compress PDF tool
Shrinks a PDF by recompressing its images, on-device. (utility, official)

### Tool composition
A tool can now render another tool as an image. Manifests declare `composes`, the engine resolves the nested render through `host.compose`, and the result is embedded without its own watermark. Tools are also addressable as portable embed URLs.

### On-device file utilities
A new `file` input type lets a tool take the user's own file as bytes held in memory. The transform path (`host.export.file` plus the `exportFile` hook, gated by `privacy: "on-device"`) processes the file locally and writes the result straight back — never embedding a watermark or provenance, and never uploading.

---

## Tools shipped

| Tool | Status | Category |
|---|---|---|
| Color Block | Official | Everyone |
| Dynamic Layout | Official | Everyone |
| Quote Card | Official | Everyone |
| Code Canvas | Official | Everyone |
| QR Code Generator | Official | Everyone |
| Day Brief | Official | Everyone |
| Logo | Official | Everyone |
| Email Signature | Official | Everyone |
| Meeting Planner | Official | Event |
| Event Name Badge | Official | Event |
| Wayfinding Signage | Official | Event |
| Calendar ICS | Official | Event |
| Chart Creator | Official | Designer |
| Duotone Filter | Official | Designer |
| Street Map | Official | Designer |
| Brand Lockup | Official | Designer |
| Halftone Filter | Official | Designer |
| Scanline Filter | Official | Designer |
| Animated Ad | Official | Designer |
| Bag Video | Experimental | Designer |
| Color Palette | Official | Utility |
| Countdown Timer | Official | Utility |
| Strip Hidden Data | Official | Utility |
| Text Helper | Official | Utility |
| Compress PDF | Official | Utility |
| URL Screenshot | Experimental | Utility |

---

## Platform changes

| Area | Change |
|---|---|
| Engine | Tool composition: `compose` capability + manifest `composes`; nested renders via `host.compose`; portable embed URLs |
| Engine | `file` input type and an on-device transform path (`host.export.file`, `exportFile` hook, `privacy: "on-device"`) |
| Bridge | `host.pdf` API: analyze, strip, and compress PDFs on-device |
| Export bridge | EMF replaces EPS as the vector export for Office; data exports `.ics`, `.vcf`, `.csv`, and `.json` generated from the input model |
| Catalog | New "Event Kit" category; renames — `exif-stripper` → `strip-data`, `text-tools` → `text-helper`; the Product Lockup tool retired in favour of Brand Lockup |

---

## Known limitations

- Saved state is per-device (no SUSE ID sync). Clearing browser storage loses sessions.
