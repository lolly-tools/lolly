# Authoring Tools

A tool is a folder. Drop it in `tools/`, add it to `catalog/tools/index.json`, done.

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
- `status` — `official` | `community` | `experimental`
- `render` — `{ width, height, formats, actions? }`
- `inputs` — array of input declarations (see below)

Optional:

- `capabilities` — `["network", "filesystem", "clipboard", "camera", "ffmpeg", "wasm"]`. Required for the host to expose those APIs to your tool. Tools without `"network"` cannot call `host.net.fetch`.
- `hooks` — `{ onInit?, onInput?, beforeExport?, afterExport? }` boolean flags. If any are true, you must ship `hooks.js` with the matching functions.
- `a11yLabel` — accessible description of the rendered output. The preview canvas is exposed to screen readers as a single `role="img"`; this is its label. It's a Handlebars string hydrated with the current input values (same context as the template), so it stays accurate as the user edits — e.g. `"QR code linking to {{url}}"` or `"Meeting plan for {{default count \"a\"}} people"`. Use `{{default x \"fallback\"}}` for empty inputs. Omit it and the label falls back to `"<name> preview"`. Keep it short and factual — it replaces, not supplements, the canvas contents for SR users.

### Input types

| Type             | What it produces                                          | UI control          |
|------------------|-----------------------------------------------------------|---------------------|
| `text`           | string                                                    | text input          |
| `longtext`       | string                                                    | textarea            |
| `number`         | number                                                    | input or slider     |
| `boolean`        | boolean                                                   | checkbox            |
| `color`          | string (hex)                                              | color picker, or constrained to a palette asset via `palette: "asset/id"` |
| `select`         | string (one of `options[].value`)                         | dropdown            |
| `asset`          | `AssetRef` object (id, url, type, etc.)                   | host-provided asset picker |
| `date`           | ISO date string                                           | date input          |
| `time`           | `HH:MM` string                                            | time input          |
| `datetime-local` | ISO datetime string                                       | flatpickr datetime picker |
| `url`            | string                                                    | text input          |
| `blocks`         | array of objects (repeating field groups)                | add/remove/reorder row editor |
| `vector`         | object `{ fieldId: number }` (a fixed set of numbers)    | one row of zoom x/y controls |

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

In the template, iterate with `{{#each people}}…{{/each}}`. The value round-trips to the URL as a JSON array (see `docs/url-mode.md`); rows larger than ~8 KB fall back to saved-state slots. `meeting-planner` is the reference implementation.

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

#### `bindToProfile`

Any input can declare `bindToProfile: "firstname"` (or `email`, `headshot`, etc). When the tool mounts, it pre-fills from the user's profile. They can override per-session.

## Canonical inputs (reuse shared ids)

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

Reference wirings: `meeting-planner`→ICS, `email-signature`→vCard, `chart-creator`→CSV. Raster/PDF/ZIP/ICO come from the browser (web shell) or the Tauri-bundled CLI — the node CLI handles only text/data formats.

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
```

Declared hooks must be flagged in the manifest's `hooks` object (`{ "onInit": true, ... }`) — the loader only invokes hooks the manifest opts into.

**What you can call:**
- Everything on `host.*` your manifest's `capabilities` allows.
- Pure JS computation. No fetch, no DOM, no globals.

**What you can't:**
- `window`, `document`, `fetch`, `localStorage`. They're not in scope.
- Importing other modules. Hooks are loaded as a single source string.

## Brand logo (auto-switching)

The catalog ships the SUSE logo as **8 variants** under `suse/logo/` — `{hor|vert}-{neg|pos}-{green|white|black}` (`hor`/`vert` = wide vs stacked; `neg` = for **dark** backgrounds, `pos` = for **light**; `green` is the brand mark, `white`/`black` are the high-contrast mono pair). A tool shouldn't hard-code one — it should pick the variant that fits the current background and space, and use the **actual SVG image** (this is distinct from `lockup`, which renders the wordmark from the SUSE font via ligatures).

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
- `tools/qr-code/` — uses `hooks.js` to encode the QR matrix; shows `asset` input with `allowUpload: false`
- `tools/quotes/` — multi-input form with `longtext`, `select`, and optional `asset` upload
- `tools/meeting-planner/` — `blocks` input for repeating rows; `onInit`/`onInput` shaping
- `tools/daily-card/` — declares `"network"` capability; pulls live weather/time via `host.net`
- `tools/lockup/` — text-to-path via opentype.js in `beforeExport`/`afterExport` (SVG outlining)
- `tools/tool-logo/` — auto-switching brand logo: a hook picks the right `suse/logo/` SVG by background/orientation; true vector SVG export
- `tools/bag-video/` — video/gif output with `render.video` timing config
- `tools/film-burn-filter/` — experimental status; `asset` input with `allowUpload: true`
