# Authoring Tools

A tool is a folder. Drop it in `tools/`, add a `tool.json` + `template.html`, run `npm run build:catalog` to register it, done. (`catalog/tools/index.json` is **generated** from the manifests — never hand-edited; see Publishing.)

## Authoring with AI Agents

If you have the lolly.tools repo in front of your agents, you can simply ask them to make tools for you using whatever challenge you think will resolve the design solution. 

Sounds hard? not if you have the tokens and any source material. 
Lolly developers tested 600+ human-created logo lock-up combinations as separate svg files with only paths.  
They then directed agents to create a tool that could reproduce the source material.

One lunch-break later and the tool became real, and behaved to our satisfaction.
Even if you rely mostly on this method, it's good to understand how tools operate.

## Anatomy

```
tools/your-tool-id/
├── tool.json           # required — declares inputs, outputs, identity
├── template.html       # required — Handlebars-flavoured markup
├── styles.css          # optional — auto-scoped to #tool-canvas
├── hooks.js            # optional — imperative escape hatch
├── thumb.png           # optional — gallery thumbnail (recommended)
└── assets/             # optional — tool-local images, fonts, etc.
```

## The manifest (`tool.json`)

Validated against `schemas/tool.schema.json`. Required fields:

- `id` — lowercase, hyphen-separated, **never changes** once published
- `name`, `description`
- `version` — SemVer; bump on every change
- `engineVersion` — SemVer range, e.g. `"^1.0.0"`
- `status` — `official` | `community` | `experimental`. Experimental tools **watermark every export** (the host applies it — your tool does nothing). This is the positive counterpart to the `privacy: "on-device"` "no watermark" rule below.
- `render` — see [The `render` block](#the-render-block) below. At minimum `{ width, height, formats }`.
- `inputs` — array of input declarations (see below)

Optional:

- `capabilities` — `["network", "filesystem", "clipboard", "camera", "ffmpeg", "wasm", "capture", "compose"]`. Required for the host to expose those APIs to your tool. Tools without `"network"` cannot call `host.net.fetch`; tools that use `composes` (below) declare `"compose"`.
- `privacy` — `"on-device"`. Marks a content-transform utility that processes the user's own file entirely on the device. Shows the "Runs on your device — nothing is uploaded" badge; enforces (validated) that the tool is never `experimental` and (at runtime) that exports carry no provenance metadata and no watermark. See the `file` input + `exportFile` hook below.
- `hooks` — `{ onInit?, onInput?, beforeExport?, afterExport?, exportFile? }` boolean flags. If any are true, you must ship `hooks.js` with the matching functions. (`exportFile` is the transform path — file bytes in → transformed bytes out; see below.)
- `composes` — embed another tool's render as an image (tool composition; see below). Requires the `"compose"` capability.
- `a11yLabel` — accessible description of the rendered output. The preview canvas is exposed to screen readers as a single `role="img"`; this is its label. It's a Handlebars string hydrated with the current input values (same context as the template), so it stays accurate as the user edits — e.g. `"QR code linking to {{url}}"` or `"Meeting plan for {{default count \"a\"}} people"`. Use `{{default x \"fallback\"}}` for empty inputs. Omit it and the label falls back to `"<name> preview"`. Keep it short and factual — it replaces, not supplements, the canvas contents for SR users.

### The `render` block

`render` carries `width`, `height`, `formats` (one or more of `svg`, `emf`, `pdf`, `pdf-cmyk`, `cmyk-tiff`, `png`, `jpg`/`jpeg`, `webp`, `avif`, `webm`, `mp4`, `gif`, `html`, `md`, `txt`, `json`, `csv`, `ics`, `vcf`, `ico`, `zip`), plus these optional keys:

- `actions` — which action buttons to show. One or more of `copy`, `download`, `save`, `share`. **Defaults to `['copy','download','save']`** if omitted.
- `export` — set `false` for utility/interactive tools with no export (hides the download/copy/format/dimension bar; shows **Save** only when the tool has inputs).
- `layout` — `sidebar` (default) or `canvas`. `canvas` hides the sidebar and presents the tool as a full-bleed working area; a single declared `file` input becomes a drag-and-drop / click-to-pick zone on the canvas itself. Used by `strip-data` (drop a file → get a file back).
- `convertPaths` — defaults `true`. When the tool exports a vector format, the engine **auto-injects a "Convert paths" toggle** that outlines text to vector paths (in SVG/PDF/PDF-CMYK) so the output renders identically without the fonts installed. Set `false` to suppress it and never outline — e.g. a capture tool whose output is raster (`url-shot`), or a tool that draws its text as raster/canvas before export (`event-name-badge`, `wayfinding-signage`).
- `transparentBg` — defaults `false`. Adds a **"No BG"** (transparent background) toggle to the export bar; the engine injects it into the input model so hooks can react via `onInit`/`onInput` (`chart-creator`).
- `preview` — `{ format?, auto? }`. Marks a tool whose live canvas is a placeholder until an explicit, expensive render runs (e.g. a capture tool that screenshots a page in `beforeExport`); the shell wires a `[data-preview]` control. `auto: true` renders one frame on load. Used by `url-shot`.
- `video` — `{ wait?, duration? }` (seconds; defaults `1` / `5`). Capture timing used when `webm`/`mp4`/`gif` is in `formats` (`bag-video`).
- `dims` — set `false` to hide the export dimension inputs in the download bar.

**Physical units & print.** `width`/`height` are values in the export's `unit` (`px` default, or `mm`/`cm`/`in`/`pt`), and `dpi` sets raster resolution for physical units. PDF exports a true page size; the CMYK formats (`pdf-cmyk`, `cmyk-tiff`) pair with the `convertPaths` outlining toggle to produce print-ready, fonts-not-installed output. A `select` option can also carry `width`/`height`/`unit` to drive the export page size from a dropdown — e.g. `wayfinding-signage`'s **Sign size** select (A4/A3/A2… in mm) sets the printed page proportions when chosen.

### Input types

| Type             | What it produces                                          | UI control          |
|------------------|-----------------------------------------------------------|---------------------|
| `text`           | string                                                    | text input          |
| `longtext`       | string                                                    | textarea            |
| `number`         | number                                                    | input or slider     |
| `boolean`        | boolean                                                   | checkbox            |
| `color`          | string (hex)                                              | color picker, or constrained to a palette asset via `palette: "asset/id"` |
| `select`         | string (one of `options[].value`); an option may carry `width`/`height`/`unit` to set the export page size | dropdown            |
| `asset`          | `AssetRef` object (id, url, type, etc.)                   | host-provided asset picker |
| `date`           | ISO date string                                           | date input          |
| `time`           | `HH:MM` string                                            | time input          |
| `datetime-local` | ISO datetime string                                       | flatpickr datetime picker |
| `url`            | string                                                    | text input          |
| `blocks`         | array of objects (repeating field groups)                | add/remove/reorder row editor |
| `vector`         | object `{ fieldId: number }` (a fixed set of numbers)    | one row of zoom x/y controls |
| `file`           | a `FileRef` (the user's own file: `name`/`mime`/`size`/`bytes`) | file picker (on-device utilities) |

#### `blocks` — repeating groups

A `blocks` input is a list of repeating sub-records (e.g. team members, each with a name and city). Declare the per-row fields under `fields`:

```json
{
  "id": "people",
  "type": "blocks",
  "label": "Team members",
  "fields": [
    { "id": "name", "type": "text",  "label": "Name" },
    { "id": "city", "type": "text",  "label": "City" }
  ]
}
```

In the template, iterate with `{{#each people}}…{{/each}}`. The value round-trips to the URL as a JSON array (see `docs/url-mode.md`); rows larger than ~8 KB fall back to saved-state slots. Blocks are edited in a side panel, and clicking a rendered block on the canvas focuses that block's field. `meeting-planner` is the reference implementation for the simple (homogeneous) case.

**Advanced blocks (typed / heterogeneous rows).** Sub-fields aren't limited to `text` — a field may be `text`, `color`, `select`, `asset`, or `number`. And the row set can be **discriminated** by a `select` sub-field:

- `addMenu: { field, label }` turns the **"+ Add"** button into a typed menu — each option of the named discriminator sub-field becomes a menu entry. The discriminator is fixed at creation and shown as the block's label rather than an editable control. An entry already used is disabled unless its option sets `repeatable: true`.
- `showFor: ["kind"]` on a sub-field limits it to blocks whose discriminator value is listed.
- `multilineFor: ["kind"]` (with optional `rows`) renders a text sub-field as a textarea for those discriminator values.

`color-block` is the reference for typed/heterogeneous blocks (`addMenu` keyed on a `kind` select, `showFor`, `multilineFor`, and the full sub-field type set).

#### `vector` — a group of numbers as one control

Use `vector` when a few related numbers belong together — zoom + pan, an x/y offset, padding, margins. Instead of separate `number` inputs (one column each in `/pro` bulk mode), a `vector` is **one input, one control, one column**: a row of compact number fields where each label can be dragged to scrub the value (Figma-style) or typed into. Declare the numeric sub-fields under `fields`:

```json
{
  "id": "imageFraming",
  "type": "vector",
  "label": "Zoom & Position",
  "fields": [
    { "id": "zoom", "label": "Zoom", "min": 100, "max": 400, "step": 1, "default": 100 },
    { "id": "x",    "label": "X",    "min": 0,   "max": 100, "step": 1, "default": 50  },
    { "id": "y",    "label": "Y",    "min": 0,   "max": 100, "step": 1, "default": 50  }
  ]
}
```

The value is an object keyed by field id, so the template reads each part with dot access: `{{imageFraming.zoom}}`, `{{imageFraming.x}}`, `{{imageFraming.y}}`. Each field clamps to its own `min`/`max` and falls back to its `default`.

In URL mode (and `/pro` CSV) each field is its **own flat param/column**, namespaced `"<inputId>.<fieldId>"` — e.g. `?imageFraming.zoom=200&imageFraming.x=30&imageFraming.y=70`, or CSV columns `imageFraming.zoom`, `imageFraming.x`, `imageFraming.y`. There is no `urlKey` on a vector. `duotone-filter` and `quotes` (both `imageFraming`) are the reference implementations.

`imageFraming` is a **canonical input** (see below) — reuse that id and field set verbatim for any zoom/pan-an-image control rather than inventing a synonym.

#### `asset` — library or device upload

An `asset` input opens the host's asset picker and stores the chosen `AssetRef` — uniform whether it came from the catalog or the user's device:

```json
{
  "id": "logo",
  "type": "asset",
  "label": "Logo",
  "assetType": "raster",   // vector | raster | video | any — constrains the picker
  "allowUpload": true       // also let the user add an image from their device
}
```

When `allowUpload` is `true`, the picker offers the user's **personal image library** alongside the catalog. Users add images from their device; the host downscales each to 3840px on the longest edge, re-encodes it (WebP, with EXIF/GPS metadata stripped), and stores it locally (IndexedDB on web and Tauri). The library is capped (currently 50 images), reusable across tools, and managed in **Profile → Storage → My images**. SVG uploads are sanitised on ingest (script/handler stripping) and pass through without rasterising.

These images are **device-local**: their `AssetRef.source` is `"user"` and their `user/…` id is meaningful only on the device that holds the bytes, so they are **omitted from shareable URLs** (see `docs/url-mode.md`). Tools treat `user` and `library` assets identically — no tool code is involved in the upload.

#### `file` — the user's own file (on-device utilities)

A `file` input takes a file the user picks **into memory** and hands its raw bytes to the tool. It's the input shape for **content-transform utilities** — the "boring file jobs you'd otherwise hand to a stranger's website": strip EXIF, crop, compress, convert. Unlike `asset` (which is for *brand* imagery and goes through the catalog/upload library), a `file` is the user's own content that's processed and handed straight back, never stored or uploaded.

```json
{
  "id": "photo",
  "type": "file",
  "label": "Photo",
  "accept": ["image/jpeg", "image/png", ".jpg", ".png"],
  "maxSize": 52428800
}
```

- `accept` — allowlist of MIME types and/or extensions for the picker (a UX hint; still validate bytes in the hook). Omit to accept anything.
- `maxSize` — max bytes; the host rejects larger files at pick time.

The value is a **`FileRef`**: `{ __file: true, name, mime, size, bytes, url }`. The `bytes` are a `Uint8Array` the hook reads directly (no `host.*` call — the bytes ride in the value because the hook sandbox has no `fetch`). A `file` value is **never serialised into a URL** (binary has no shareable form) and **never persisted** — it lives only in memory on the device, which is the whole privacy point. In CLI transport a file param is a path the runner loads: `--photo=./pic.jpg`.

#### Producing output: the `exportFile` hook + `privacy: "on-device"`

A content-transform utility doesn't rasterise the canvas — it produces a *transformed file*. Declare the `exportFile` hook and mark the tool as an on-device utility:

```json
{
  "status": "official",
  "privacy": "on-device",
  "render": { "width": 760, "height": 620, "formats": ["jpg"], "export": false, "actions": [] },
  "hooks": { "onInput": true, "exportFile": true }
}
```

- `privacy: "on-device"` shows the **"Runs on your device — nothing is uploaded"** badge and enforces (validated) that the tool is never `experimental`, and (at runtime) that exports carry **no provenance metadata and no watermark** — you must not stamp anything into a user's own file.
- `render.export: false` hides the standard format/size/download bar; `"actions": []` opts out of the default Save/Share buttons (saving would persist the user's bytes — never do that).
- The `exportFile` hook reads the picked file and returns the transformed bytes as a plain record:

```js
function exportFile({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.photo;                       // the FileRef
  const cleaned = stripMetadata(f.bytes);       // your transform (pure bytes → bytes)
  return { bytes: cleaned, mime: f.mime, filename: f.name.replace(/(\.\w+)?$/, '-clean$1') };
}
```

In the template, a `<button data-export-file>Download…</button>` triggers the hook; the shell wraps the bytes in a Blob and delivers them via `host.export.file` (download on web, `--output` on the CLI). Use `onInput`/`onInit` to return *extras* the template displays (e.g. what metadata was found). `strip-data` is the reference implementation.

#### `bindToProfile`

Any input can declare `bindToProfile: "firstname"` (or `email`, `headshot`, etc). When the tool mounts, it pre-fills from the user's profile. They can override per-session.

## Canonical inputs (reuse shared ids)

`/pro` (the web shell's batch mode) is a **spreadsheet grid** that renders many rows at once across one or many tools — CSV/TSV round-trip and spreadsheet paste in, a `.zip` of per-row outputs out, with collapsible export columns and saved batch sessions. Because it lays every selected tool's inputs out as a grid, the `id`/constraint choices you make below directly shape that grid.

`/pro` batch mode lays every selected tool's inputs out as a grid. **It keys each column by input `id`** — so two tools that call the same concept by the same id collapse into *one* column, and if they also agree on type + constraints (number `min`/`max`/`step`, select options, color palette), that column becomes **bulk-writable**: the user types one value and it fills every row. Diverge on the id (or the constraints) and you get a separate, cell-by-cell column instead. So picking a shared id is a real UX decision, not a style preference.

To make this the default path, the blessed ids and their constraints live in **`schemas/canonical-inputs.json`**. When your tool needs one of these concepts, copy the id (and constraints) verbatim:

| Concept | Canonical id | Type |
|---|---|---|
| Headline | `heading` | `text` |
| Sub-headline | `subheading` | `text` |
| Body copy | `body` | `longtext` |
| Call to action | `cta` | `text` |
| Ink / foreground colour | `color` | `color` |
| Background colour | `background` | `color` |
| Primary image · portrait · backdrop | `image` · `headshot` · `bgImage` | `asset` |
| Background image dimming | `bgOpacity` | `number` (0–1, step 0.01) |
| Zoom + pan an image | `imageFraming` | `vector` `{ zoom, x, y }` (zoom optional) |

Conventions: per-element typography numbers are `<element>FontSize` / `<element>FontWeight` (weight `100`–`900` step `100`), e.g. `headingFontSize`, `bodyFontWeight`.

Labels are *advisory* — show whatever label fits your tool; the `/pro` header just uses the first non-empty one, and bulk-write only cares about id + type + constraints. Adding a genuinely new shared input? Add it to `schemas/canonical-inputs.json` first, then adopt it — `npm run validate:catalog` emits a **warning** (never an error) when a tool uses a canonical id with a divergent type or constraints, so drift stays visible.

## The template (`template.html`)

Handlebars-flavoured. **Logic-less by design.**

```html
<div class="my-tool">
  {{#if heading}}
    <h1>{{heading}}</h1>
  {{else}}
    <p>(enter a heading)</p>
  {{/if}}

  {{#if logo}}
    <img src="{{asset logo}}" alt="" width="{{asset logo "width"}}">
  {{/if}}
</div>
```

- `{{value}}` — HTML-escapes by default. Always use this for user input.
- `{{{value}}}` — raw, no escape. Only for trusted, system-generated HTML.
- `{{asset assetInput}}` — returns the resolved URL of an asset input. Use in `src`, `href`.
- `{{asset assetInput "width"}}` — returns a specific property.
- Block helpers: `{{#if}}`, `{{#each}}`, `{{#unless}}`. No arbitrary JS.

## Styles (`styles.css`)

Scoped automatically. Write top-level selectors targeting your own classes. Don't write global rules (`body`, `html`); they'll be scoped to `#tool-canvas` and probably won't do what you want.

## Data formats (`json` / `csv` / `ics` / `vcf`)

Some tools export *data* alongside the rendered image — a calendar invite, a contact card, the underlying numbers. These come from the **input model**, not the pixels, so they work in every shell (including the CLI) and don't need a browser.

- **`json`** — no template needed. Add `"json"` to `render.formats` and the export is `{ tool, version, inputs: { … } }` (the resolved input values), serialized automatically.
- **`csv` / `ics` / `vcf`** — add the format to `render.formats` **and** ship a sibling text template `template.<ext>` (e.g. `template.ics`). It's a Handlebars template hydrated against the same context as `template.html` (input values + hook `extras`), but **without HTML escaping** — so `{{title}}` emits the value verbatim. Escape per the target format with the built-in helpers:
  - `{{icsStamp meetingTime}}` — a `date`/`datetime-local` value → iCalendar basic form (`20260915T143000`).
  - `{{rfcText x}}` — escape an iCalendar (RFC 5545) **or** vCard (RFC 6350) text field (`\` `;` `,` newline).
  - `{{csvCell x}}` — quote a CSV field per RFC 4180 only when needed.

Example `template.ics` (see `tools/meeting-planner/`):

```handlebars
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:{{icsStamp meetingTime}}
SUMMARY:{{rfcText title}}
LOCATION:{{rfcText hostCity}}
END:VEVENT
END:VCALENDAR
```

Reference wirings: `meeting-planner`→ICS, `email-signature`→vCard, `chart-creator`→CSV. Raster (`png`/`jpg`/`webp`/`avif`/`gif`), `svg`, `pdf`, the print/CMYK formats (`pdf-cmyk`, `cmyk-tiff`), video (`webm`/`mp4`), `zip`, and `ico` come from the browser (web shell) or the Tauri-bundled CLI — the node CLI handles only text/data formats. The CMYK formats pair with the `convertPaths` outlining toggle (see [The `render` block](#the-render-block)) for fonts-not-installed print fidelity; `pdf-cmyk` ships on ten tools today and `cmyk-tiff` on six (a subset) — e.g. `qr-code` offers both, while `wayfinding-signage` and `event-name-badge` ship `pdf-cmyk`.

## Hooks (`hooks.js`)

Optional. Required only if you need computed values, async data, or anything the template can't express.

```js
// Top-level functions are picked up by name. Declare any you need.
function onInit({ model, host }) {
  // Run once. Return a patch object to seed derived values.
  return { computedThing: derive(model) };
}

function onInput({ id, value, model, host }) {
  // Run after every input change. Return a patch (or nothing).
  return { computedThing: derive(model) };
}

function beforeExport({ node, format, opts, host }) {
  // Modify the node, or call host APIs before raster/serialize.
}

function afterExport({ node, format, blob, host }) {
  // Fires after the export blob is produced. Cleanup, telemetry, chaining.
}

function exportFile({ model }) {
  // The transform path — for on-device utilities with a `file` input. Read the
  // picked file's bytes and return the transformed file: { bytes, mime, filename }.
  // Bypasses the DOM render/export pipeline entirely. See the `file` input above.
}
```

Declared hooks must be flagged in the manifest's `hooks` object (`{ "onInit": true, ... }`) — the loader only invokes hooks the manifest opts into.

**What you can call:**
- Everything on `host.*` your manifest's `capabilities` allows.
- Pure JS computation. No fetch, no DOM, no globals.

**What you can't:**
- `window`, `document`, `fetch`, `localStorage`. They're not in scope.
- Importing other modules. Hooks are loaded as a single source string.

## Composition (`composes`)

A tool can embed **another tool's rendered output** as an image instead of re-implementing it. Declare it in the manifest and reference it in the template like any asset — no hook code, no copy-paste.

```jsonc
// tool.json
"capabilities": ["compose"],
"composes": [
  { "id": "badgeQr", "tool": "qr-code", "format": "svg",
    "inputs": { "url": "{{url}}", "color": "#0c322c", "join": true } }
]
```
```handlebars
{{!-- template.html — guard it: composition can fail gracefully --}}
{{#if badgeQr}}<img src="{{asset badgeQr}}" alt="">{{/if}}
```

- Each entry renders `tool` with `inputs` and exposes the result under `id` as an `{{asset <id>}}` extra (the same store hook-computed values use).
- String `inputs` values are **Handlebars**, hydrated against your tool's own context (its input values + extras), so a child input can bind to a parent value — e.g. `"url": "{{url}}"`.
- `format` (defaults to the child tool's first declared format, `render.formats[0]`) fixes the child render; `width`/`height` (px) default to the child's native size. **Compose any tool's render: an `svg` child stays a true vector when the parent exports to SVG or PDF and rasterises crisply for PNG; raster children (`png`, `jpg`/`jpeg`, `webp`) embed as images.** `svg` is the only format wired declaratively today (`event-name-badge` composes `qr-code` as `svg`) and is the best-supported. The enum also lists `pdf`, but a **PDF child is not supported as a source** — nothing inlines a PDF blob, so don't set `format: "pdf"`. HTML / Markdown / plain-text composition is **not** supported.
- The composed value is a **normal asset URL**, so it works in a CSS `url()` background just as well as in an `<img src>` — bring another tool in exactly like a library image.
- The child renders through the **same engine path** (pixel-identical, on-brand) and is never watermarked or provenance-stamped (it's an intermediate). Recursion is **depth- and cycle-guarded**: `a → b → a` fails gracefully and the slot stays empty, so always `{{#if}}`-guard the reference.
- Works wherever the shell can render the child to bytes; the lean CLI composes `svg` children. The mechanism is `host.compose` — see [Host API](/info/host-api.html).

## Brand logo (auto-switching)

The catalog ships the SUSE logo as **8 variants** under `suse/logo/` — `{hor|vert}-{neg|pos}-{green|white|black}` (`hor`/`vert` = wide vs stacked; `neg` = for **dark** backgrounds, `pos` = for **light**; `green` is the brand mark, `white`/`black` are the high-contrast mono pair). A tool shouldn't hard-code one — it should pick the variant that fits the current background and space, and use the **actual SVG image** (this is distinct from `brand-lockup`, which renders the wordmark from the SUSE font, outlined via HarfBuzz `host.text`).

The pattern: a hook chooses the id, resolves it with `host.assets.get()`, and hands the template a ready `<image>`/`<img>`:

```js
// hooks.js — WCAG luminance decides neg/pos; orientation + ink come from inputs.
function logoId(inputs) {
  const dark   = relLuminance(inputs.background) < 0.5;   // dark bg → neg
  const orient = inputs.orientation === 'vertical' ? 'vert' : 'hor';
  const ink    = inputs.ink === 'mono' ? (dark ? 'white' : 'black') : 'green';
  return `suse/logo/${orient}-${dark ? 'neg' : 'pos'}-${ink}`;
}
async function onInit({ model }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  return { logo: await host.assets.get(logoId(inputs)) }; // → extras.logo (an AssetRef)
}
```

```html
<!-- template.html — the actual SVG asset, not a font lockup -->
{{#if logo}}<image href="{{asset logo}}" .../>{{/if}}   <!-- inside an <svg> → true vector export -->
{{!-- or, in an HTML canvas: --}}
{{#if logo}}<img src="{{asset logo}}" alt="Logo">{{/if}}
```

Putting the `<image>` inside an `<svg>` lets the export inline it (data-URI) and emit **true vector SVG**; an `<img>` in an HTML canvas exports raster/PDF only. `tools/tool-logo/` is the reference implementation (background colour, orientation, brand/mono, transparent-bg export). Reusing this in another org: keep the structure and swap the `suse/logo/...` id prefix for your own logo namespace (same variant matrix).

## Publishing

1. Place your folder under `tools/`.
2. Run `npm run build:catalog` — this regenerates `catalog/tools/index.json` from
   the manifests (don't hand-edit the index; it's generated) and refreshes asset
   checksums.
3. Run `npm run validate:catalog` to confirm the catalog is consistent.
4. Build & deploy the catalog. The shell picks it up on next boot.

For development:

```bash
npm run dev:web
# open localhost — your tool appears in the gallery
```

## Example tools

- `tools/color-palette/` — pure declarative, no inputs, asset reference only
- `tools/qr-code/` — uses `hooks.js` (`onInit`/`onInput`/`beforeExport`) to encode the QR matrix; composed as an `svg` child by `event-name-badge`
- `tools/quotes/` — multi-input form with `longtext`, `select`, and `asset` inputs with `allowUpload: true` (personal-image library)
- `tools/meeting-planner/` — `blocks` input for repeating rows; `onInit`/`onInput` shaping; ICS data export
- `tools/color-block/` — advanced `blocks`: typed `addMenu` discriminator + `showFor` / `multilineFor` heterogeneous rows
- `tools/wayfinding-signage/` — `blocks` rows that auto-shrink label text to fit (or show a sponsor image), and a `size` select that drives the print page size; CMYK export
- `tools/tool-logo/` — auto-switching brand logo: a hook picks the right `suse/logo/` SVG by background/orientation; true vector SVG export
- `tools/bag-video/` — video/gif output with `render.video` timing config
