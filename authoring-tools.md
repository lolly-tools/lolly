# Authoring Tools

A tool is a folder. Drop it in `tools/`, add a `tool.json` + `template.html`, run `npm run build:catalog` to register it, done. (`catalog/tools/index.json` is **generated** from the manifests - never hand-edited; see Publishing.)

## Authoring with AI Agents

If you have the lolly.tools repo in front of your agents, you can simply ask them to make tools for you using whatever challenge you think will resolve the design solution. 

Sounds hard? not if you have the tokens and any source material. 
Lolly developers tested 600+ human-created logo lock-up combinations as separate svg files with only paths.  
They then directed agents to create a tool that could reproduce the source material.

One lunch-break later and the tool became real, and behaved to our satisfaction.
Even if you rely mostly on this method, it's good to understand how tools operate.

## Start from a design you already have

You don't always start from a blank manifest. If the layout already exists in **Figma, Penpot, Illustrator or InDesign**, bring it in with the **Design** tool's **[Import a design](/info/design-import.html)** button and skip straight to a working artboard.

A finished file - a native Figma `.fig`, a Penpot export or *any SVG* (InDesign and Illustrator export it, and nearly every design app can) - is parsed on your device and opens on the free canvas as editable boxes: text stays retypable, shapes stay shapes, images join your library and type and colours conform to the brand globals. From there it's an ordinary session, so it already behaves like a tool:

- **Save it and it's a reusable template** at a URL - anyone with Lolly can open, refill and render it - locked parts still locked - with no design app.
- **Mix in other tools.** Drop a QR code, a live chart or another render into any box through the asset picker; embedded tools stay live and re-render on load.
- **Render and scale** through the same deterministic export path - SVG/PDF/PNG/video, the batch grid, Projects folders.

Import gets you the visual 90% without writing a line of `tool.json`. Reach for a hand-authored, fully declarative tool (sidebar inputs, hard-coded constraints, hooks) when you need those knobs - the anatomy below is that path.

## Anatomy

```
tools/your-tool-id/
├── tool.json           # required - declares inputs, outputs, identity
├── template.html       # required - Handlebars-flavoured markup
├── styles.css          # optional - auto-scoped to #tool-canvas
├── hooks.js            # optional - imperative escape hatch
├── thumb.png           # optional - gallery thumbnail (recommended)
├── templates/          # optional - curated starting points (see Templates & presets)
├── i18n/               # optional - <lang>.json string overlays (see Localizing a tool)
└── assets/             # optional - tool-local images, fonts, etc.
```

## The manifest (`tool.json`)

Validated against `schemas/tool.schema.json`. Required fields:

- `id` - lowercase, hyphen-separated, **never changes** once published
- `name`
- `version` - SemVer; bump on every change
- `engineVersion` - SemVer range, e.g. `"^1.0.0"`
- `status` - `official` | `community` | `experimental`. Experimental tools **watermark every export** (the host applies it - your tool does nothing). This is the positive counterpart to the `privacy: "on-device"` "no watermark" rule below.
- `render` - see [The `render` block](#the-render-block) below. At minimum `{ width, height, formats }`.
- `inputs` - array of input declarations (see below)

Strongly recommended but not schema-required: `description` (the gallery's About card reads it), `category` and `tags`.

Optional:

- `requires` - the optional `host.*` APIs your hooks call **without** feature-detecting them: `["text", "tokens"]`, say. The runtime refuses to mount the tool on a shell that lacks one, before any hook runs, and the gallery greys it out there. An API you guard (`if (host.text)`, `host.text?.toPath(...)`) is progressive enhancement and must not be listed. You do not have to maintain this by hand: `node scripts/tool-requires.ts --write` reads your `hooks.js`, writes the list, and raises `engineVersion` to the minor that introduced the newest API you depend on; `validate:catalog` warns when the manifest and the hooks disagree.
- `capabilities` - `["network", "filesystem", "clipboard", "camera", "microphone", "ffmpeg", "wasm", "capture", "compose", "screen"]`. Device abilities rather than bridge APIs (that is `requires`, above). Required for the host to expose those APIs to your tool, and what shells use to gate/label the tool where a capability can't be fulfilled. Tools without `"network"` cannot call `host.net.fetch` - and a `"network"` tool must also declare *which* URLs (see `network`, next); tools that use `composes` (below) declare `"compose"`; a tool that records audio through `host.recorder` declares `"microphone"`.
- `network` - `{ "allowlist": [...] }`. The https URLs `host.net.fetch` may reach, for tools with the `"network"` capability. Fail-closed: no allowlist, no fetch. See [Network access](#network-access-host-net).
- `examples` - example input value-sets that demonstrate the tool's range, rendered live as the gallery tile's preview strip. See [Example looks](#example-looks-examples).
- `listed` - boolean, defaults `true`. Whether the tool appears in the gallery listing: the grid, search, favourites and the featured/utility strips. Set `false` to **unlist** a tool that is a *mechanism* invoked from context rather than a destination someone browses to - `asset-export`, reached from the catalog's per-asset **Download**, is the only unlisted tool in the SUSE pack. An unlisted tool still loads normally via `#/tool/<id>`, URL mode and the CLI; unlisting only removes it from the listing.
- `new` - boolean. Forces the gallery's **New** badge on this tool regardless of catalog position. Newness is otherwise inferred from catalog order - the most-recently-appended tools wear the badge and it self-expires as later tools ship - so set this to keep a tool flagged after it drops out of that trailing window.
- `privacy` - `"on-device"`. Marks a content-transform utility that processes the user's own file entirely on the device. Shows the "Runs on your device - nothing is uploaded" badge; enforces (validated) that the tool is never `experimental` and (at runtime) that exports carry no provenance metadata and no watermark. See the `file` input + `exportFile` hook below.
- `hooks` - `{ onInit?, onInput?, onFrame?, onLevel?, beforeExport?, afterExport?, exportFile?, exportStill? }` boolean flags. If any are true, you must ship `hooks.js` with the matching functions. (`exportFile` is the transform path - file bytes in → transformed bytes out; `exportStill` lets a tool own a raster still at a bit depth the 8-bit DOM raster cannot originate (16-bit/HDR PNG, OpenEXR, Radiance); `onFrame` makes the tool react to a live camera; `onLevel` makes it react to live audio levels while recording - all covered below.) The list is exhaustive and the schema sets `additionalProperties: false`, so a hook name that is not here is rejected at validation rather than accepted and silently ignored.
- `composes` - embed another tool's render as an image (tool composition; see below). Requires the `"compose"` capability.
- `a11yLabel` - accessible description of the rendered output. The preview canvas is exposed to screen readers as a single `role="img"`; this is its label. It's a Handlebars string hydrated with the current input values (same context as the template), so it stays accurate as the user edits - e.g. `"QR code linking to {{url}}"` or `"Meeting plan for {{default count \"a\"}} people"`. Use `{{default x \"fallback\"}}` for empty inputs. Omit it and the label falls back to `"<name> preview"`. Keep it short and factual - it replaces, not supplements, the canvas contents for SR users.

None of those fields stay private to the repo. The gallery's About card is the manifest read back to whoever is deciding whether to open the tool: name, category and status from identity, the export chips and canvas size from `render`, the version and a `capabilities` line whenever the tool declared any.

![The About card for the Filter tool, listing its exports grouped as vector, raster and video chips, its 1080 by 1080 canvas and its version, all read straight from the manifest](/t/url-shot?url=%2F%23%2F%3Ftool%3Dfilter&width=1440&height=1200&dpi=192&waitMs=2200&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&format=svg&walker=1&cropSelector=.meta-dialog-body&dark=1&filename=at2-manifest-about-card)

### The `render` block

Most of what `render` declares surfaces in one place the user sees: the export popup. Formats, page size and unit, the Convert paths outlining toggle and the Content Credentials card are all keys below.

![The export popup - format and size fields, a Convert paths toggle and a pre-ticked Content Credentials card](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Foptions&width=1440&height=900&dpi=192&waitMs=2200&css=.export-popup%7Bwidth%3A360px!important%7D&walker=1&format=svg&cropSelector=.export-popup&dark=1&filename=auth-export-popup)

`render` carries `width`, `height`, `formats` (`svg`, `png`, `pdf` and the rest of the ids in the `render.formats` enum in `schemas/tool.schema.json` - vector, raster, print, document, motion, audio, data and font outputs. The enum is the authority on the whole set; [URL Mode](/info/url-mode.html) says what each id produces), plus these optional keys:

- `actions` - which action buttons to show. One or more of `copy`, `download`, `save`, `share`. **Defaults to `['copy','download','save']`** if omitted.
- `export` - set `false` for utility/interactive tools with no export (hides the download/copy/format/dimension bar; shows **Save** only when the tool has inputs).
- `layout` - `sidebar` (default), `canvas`, `editor`, `document` or `deck`. `canvas` hides the sidebar and presents the tool as a full-bleed working area; a single declared `file` input becomes a drag-and-drop / click-to-pick zone on the canvas itself (used by `strip-data` - drop a file → get a file back). `editor` is a chromeless **free-canvas WYSIWYG** surface: the sidebar is hidden but the render canvas and export controls stay, and the shell mounts a select / drag / resize / rotate / snap overlay driven by one `blocks` input whose rows carry a `canvas` geometry flag (x/y/w/h/rotation). The shell also provides pasteboard behaviour for free: boxes dragged past the artboard stay visible and selectable (gently faded outside the frame, which keeps its shadow as the export boundary), while exports remain bounded by the canvas in every format - the tool template does nothing to opt in. The data stays flat and URL-expressible, so CLI and URL renders are identical. `design` is the reference tool. `document` is a chromeless **multi-page rich-text document** surface for paged tools: like `editor` it keeps the render canvas and export controls, but the shell mounts a word-processor editor (an on-canvas format ribbon for paragraph style H1–H4 / bold / italic / lists / colour, per-block width/align/move/delete, click-to-edit contentEditable and rich-HTML paste that becomes headings/lists/tables). It drives one `blocks` input (`content`) whose rows are content blocks (heading/text/lolly/table); **pagination lives in the tool's hook** (blocks flow into fixed-size `[data-pdf-page]` boxes, the same paged-export mechanism `multi-page-pdf` uses), so CLI and URL render the same document with no editor. `doc-studio` is the reference tool. `deck` is a **slide-deck editor** and, unlike the other three, it **keeps the input sidebar**: the shell mounts a live on-canvas overlay over one `blocks` input whose rows are slides, so a slide can be clicked and its text, colour and images edited in place, with a thumbnail rail for navigation. The DOM stays bounded because edit mode renders one active slide plus tiny thumbnails; the overlay restores a full-deck render before export.
- `units` - defaults `true`. Set `false` to offer **pixels only**: it hides the physical-unit (`mm`/`cm`/`in`/`pt`) selector and the DPI field from the download bar, so width and height stay in px and an on-screen pixel is an exported pixel. Use it for output that is inherently pixel-measured (screen assets, favicons) where a print size would make the width/height inputs disagree with the true raster resolution.
- `convertPaths` - defaults `true`. When the tool exports a vector format, the engine **auto-injects a "Convert paths" toggle** that outlines text to vector paths (in SVG/PDF/PDF-CMYK) so the output renders identically without the fonts installed. Set `false` to suppress it and never outline - e.g. a capture tool whose output is raster (`url-shot`), or a tool that draws its text as raster/canvas before export (`event-name-badge`, `wayfinding-signage`).
- `transparentBg` - defaults `false`. Adds a **"No BG"** (transparent background) toggle to the export bar; the engine injects it into the input model so hooks can react via `onInit`/`onInput` (`chart-creator`).
- `preview` - `{ format?, auto? }`. Marks a tool whose live canvas is a placeholder until an explicit, expensive render runs (e.g. a capture tool that screenshots a page in `beforeExport`); the shell wires a `[data-preview]` control. `auto: true` renders one frame on load. Used by `url-shot`.
- `video` - `{ wait?, duration? }` (seconds; defaults `1` / `5`). Capture timing used when `webm`/`mp4`/`gif`/`apng` is in `formats` (`digi-ad`).
- `liveMaxEdge` - integer px. For `onFrame` (live camera) tools only: the requested longest edge of the working camera frame handed to the hook. The shell downscales the source camera to a small default that suits a vector trace, so a raster-output effect (the `filter` tool's pixel-stretch) raises this for sharper output. The shell clamps it to the native camera frame - it never upscales - and to its own ceiling, and ignores it for tools without `onFrame`. A companion `liveMaxEdgeInput` names a number input whose value overrides it, so the resolution can be a user-facing slider (re-applied to the live stream on change).
- `c2pa` - defaults **`true`** (Content Credentials are **opt-out**). The **Content Credentials** card in the export popup is pre-checked for every stampable format (`pdf`, `png`/`apng`, `jpg`, `gif`, `svg`, `tiff`/`cmyk-tiff`, `webp`, `mp4`/`webm`, zip members), so the finished file gets a signed C2PA manifest (on-device key, so viewers report it as an unverified credential). Set `false` to opt a tool out. Forced **off** for `privacy: "on-device"` tools, which must never embed provenance into a user's own file. A `?c2pa=` link/save value overrides this per export.
- `dims` - set `false` to hide the export dimension inputs in the download bar.
- `aspectWarning` - `{ min?, max?, message }`. An **editor-only** amber caution shown in the Export popup when the chosen page aspect (`width ÷ height`) falls outside `[min, max]` (either bound optional). It's purely a guard against picking a size that breaks the layout - it never appears in the exported output. `multi-page-pdf` declares `{ "max": 1, "message": "…" }` (portrait-only).

**Physical units & print.** `width`/`height` are values in the export's `unit` (`px` default, or `mm`/`cm`/`in`/`pt`), and `dpi` sets raster resolution for physical units. PDF exports a true page size; the CMYK formats (`pdf-cmyk`, `cmyk-tiff`) pair with the `convertPaths` outlining toggle to produce print-ready, fonts-not-installed output. A `select` option can also carry `width`/`height`/`unit` to drive the export page size from a dropdown - e.g. `wayfinding-signage`'s **Sign size** select (A4/A3/A2… in mm) sets the printed page proportions when chosen.

- `printMarks` - unset by default: the print-finishing card is offered for the print-capable formats, but its master toggle starts **off** for RGB vector output (`pdf`/`svg`/`eps`) and on only for the separating press formats (`pdf-cmyk`/`cmyk-tiff`/`eps-cmyk`). Set `true` to **declare print intent** - the card then defaults on for every print-capable format. Set `false` to opt a tool out of the card entirely (crop/registration/bleed marks). Multi-page PDF tools set `false` because their output is a paginated RGB document, not a single marked plate. Physical units (`mm`/`cm`/`in` + `dpi`) alone never enable marks or bleed - an explicit `bleed=`/`marks=` link, a user toggle or declared print intent does.
- `paged` - defaults `false`. Marks a multi-page document tool (one that lays out several `[data-pdf-page]` boxes, like `multi-page-pdf`); the gallery renders each page as its own horizontally-scrollable preview slide rather than input-variant examples.
- `paginate` - `{ "source": "<tableInputId>" }`. **Engine-driven pagination**: the runtime hydrates your template once per row of the named `table` input and wraps each hydration in its own `[data-pdf-page]` box - you author ONE page and never manage pagination, page counts or loops. Each hydration's context gains a `page` object: `page.index`/`page.number`/`page.count`, `page.first` (the row's first cell - the natural page title), `page.cells` (`[{ column, value, col }]` for every column - `col` is the cell's original column index, stable even when the template renders only a subset), `page.fields` (cells minus the first - the labelled body fields, whose labels are the user's own column headings) and `page.byColumn` (trimmed lower-cased column name → the row's cell, for by-name lookup: `{{lookup page.byColumn "icon"}}`). A template can opt any rendered cell into the web shell's on-canvas editing by stamping it `data-cell="{{page.index}}:{{col}}"` (add `data-cell-md` when the cell holds markdown rendered with `{{{markdown value}}}` - edits round-trip back to markdown in the table input; without it the cell edits as plain text), and can offer a click-to-pick image slot with `data-cell-pick="{{page.index}}"` plus `data-pick-column="Icon"` (the column written to, created if absent) and optional `data-pick-tag="icon"` (catalog tag filter). Pair with `paged: true` for the scrolling all-pages canvas and filmstrip. `battlecards` is the reference tool: a hook-free one-card template that turns any pasted table into a multi-page PDF, one card per row.
- `filmstrip` - `"left"` (default) or `"bottom"`. Which edge a `paged` tool's slide-sorter thumbnail rail runs along. `left` is a vertical rail beside the canvas, right for tall documents; `bottom` is the deck-strip shape, for tools whose pages are wide and few (cards, slides), where a left rail eats the width the page needs. `battlecards` uses `bottom`.
- `pages` - `{ count, width, height, gap?, min?, max? }`. Turns an `editor`-layout tool into a **multi-page canvas** (the social-carousel pattern): the shell sizes the canvas to a horizontal strip of N same-size page frames and the free-canvas overlay places boxes across all of them. Box coordinates stay one flat, global, URL-expressible array; the tool's hook derives which page each box belongs to and emits one `[data-pdf-page]` frame per page, so headless CLI/URL renders match and export fans out (multi-page PDF, or one still per page). Requires `layout: "editor"` and `paged: true`. Each property names the input id the geometry is read from (`count`/`width`/`height` are number inputs), so the shell stays generic.

**Multi-page PDF.** A tool builds a paginated PDF by marking page boxes in its template with `data-pdf-page` - each flagged element becomes one true PDF page sized to its own CSS box, so a cover, content that flows across pages and a back page render as real pages rather than one tall image. Pages are drawn as vectors (text outlined to paths) and the document can carry an open-`password`. The path falls back to the normal single-page renderer when no `[data-pdf-page]` boxes are present, and it bypasses the crop/bleed print-finishing path (pair it with `printMarks: false`). See the `multi-page-pdf` tool for the reference layout (cover + flowing `blocks` content + back page).

### Example looks (`examples`)

A tool ships one committed thumbnail, but `examples` lets its gallery tile demonstrate *range*: an array of example input value-sets, each rendered live on the client (the same off-screen engine path an export takes) as a horizontally-scrollable preview strip - and, when the tool is `featured`, as the hero row's cross-fade. Each look is memoised, so later visits are instant. Omit it for a tool whose single committed preview says enough.

```jsonc
"examples": [
  { "label": "Launch teal",  "values": { "heading": "Ship it", "background": "#0c322c" } },
  { "label": "Reverse mark", "theme": "dark", "values": { "ink": "mono" } }
]
```

- **Key `values` by input `id` - never by `urlKey`.** Example values seed the runtime the way batch-row values do: resolved by input id only. A `urlKey` is URL-mode transport, so a urlKey-keyed value would silently render the tool's *default* look - and the validator errors on it. When copying a compact share link into an example, translate each short key back to its input id first.
- `label` documents the look's intent (it isn't shown to end users). `theme` (`light` / `dark`) is only for looks that render ink on a **transparent** background (e.g. a reverse/white logo) - the clashing theme filters that look out of the strip; omit it when the look bakes its own background.
- `width` / `height` in `values` are honoured as per-example preview dimensions even when the tool declares no such inputs.
- An `asset` value must be a **ref object**, never a bare string: `{ "source": "library", "id": "your/asset/id", "_unresolved": true }` (optionally with a `?theme=` suffix on a themable icon id). A `blocks` value is an array of row objects keyed by the block's declared field ids.

`npm run validate:catalog` checks every look: `values` keys must be declared input ids (a urlKey gets a pointed error naming the right id), catalog asset refs must exist (and any `?theme=` suffix must name a real icon theme), blocks-row keys must be declared fields. It also warns when a tool declares looks but no gallery-displayable format (svg/png/jpg/jpeg/webp), and when a strip exceeds 8 looks - each look is a live render, so keep it to a handful of genuinely different ones.

The pre-`examples` alias `featured.variants` still renders but is deprecated - author `examples`.

### A short walkthrough (`guide`)

Some tools aren't finished when the render is. An email signature is finished the moment it's pasted into Gmail's settings, and nothing on the canvas says so. `guide` is a handful of steps for that last mile, shown by the shell as a dialog behind a help button beside the tool's name - and opened once automatically the first time a device opens the tool.

```jsonc
"guide": {
  "title": "Put it in Gmail",
  "tracks": [
    {
      "id": "desktop",
      "label": "On a computer",
      "steps": [
        "Open **Export**, set the format to **HTML**, and press **Copy**.",
        "In Gmail, open **Settings** and choose **See all settings**.",
        "Paste into **General → Signature**, then press **Save Changes**."
      ],
      "note": "Outlook and Apple Mail take the same paste."
    },
    { "id": "mobile", "label": "On a phone", "steps": ["…"] }
  ]
}
```

- **One track per route the user might take** (on a computer vs on a phone). A single track renders as a plain numbered list; two or more render as tabs, so the alternative is visible rather than buried. Up to four tracks, eight steps each.
- **Steps are plain text.** `**bold**` is the only markup, for naming the control a step points at - everything else is escaped. Link to the docs from a step when the long version is what's wanted: this is a nudge, not documentation.
- **`id` is a contract like an input id** - the i18n sidecar path is built from it (`guide.tracks.<id>.label` / `.note` / `.steps.<index>`, plus `guide.title`), so renaming one orphans its translations.
- Point at controls the shell actually has. If a step says "set the format to HTML", `render.formats` had better still include `html`.

### Input types

Each declaration becomes a real control, built by the shell from the input model - you never write the UI. Six lines of `inputs` in `qr-code`'s manifest produce this entire sidebar.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

![The QR tool's sidebar - a URL field, two colour swatches, an error-correction dropdown, a quiet-zone slider and a joined-modules toggle, all generated from the manifest](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-inputs&dark=1&filename=auth-input-controls)

| Type             | What it produces                                          | UI control          |
|------------------|-----------------------------------------------------------|---------------------|
| `text`           | string                                                    | text input          |
| `longtext`       | string                                                    | textarea            |
| `number`         | number                                                    | input or slider     |
| `boolean`        | boolean                                                   | checkbox            |
| `color`          | string (hex)                                              | color picker, or constrained to a palette asset via `palette: "asset/id"` |
| `select`         | string (one of `options[].value`); an option may carry `width`/`height`/`unit` to set the export page size | dropdown            |
| `asset`          | `AssetRef` object (id, url, type, etc.)                   | host-provided asset picker |
| `date`           | ISO date string                                           | text input in the sidebar; native date field in the `/pro` grid |
| `time`           | `HH:MM` string                                            | time input          |
| `datetime-local` | ISO datetime string                                       | flatpickr datetime picker |
| `url`            | string                                                    | text input          |
| `blocks`         | array of objects (repeating field groups)                | add/remove/reorder row editor |
| `vector`         | object `{ fieldId: number }` (a fixed set of numbers)    | one row of zoom x/y controls |
| `file`           | a `FileRef` (the user's own file: `name`/`mime`/`size`/`bytes`) | file picker (on-device utilities) |
| `table`          | `{ columns: string[], rows: string[][] }` - a user-defined grid where the column headings AND rows are data (unlike `blocks`, whose fields you declare) | minimal grid editor with spreadsheet paste (TSV / Markdown / CSV), copy-out and a pop-out floating window |

For existing flat `blocks` inputs, `tableColumns: ["place", "label", "annotation"]` opts into this same editor, with fixed headings in the requested field order (remaining fields follow). Objects, row ids and positional URL encoding stay unchanged. All fields must be scalar; nested or conditional blocks keep their block editor. Timezone is the reference. Paste accepts matching field ids or labels as spreadsheet headers, or a plain city list in the first column.

A `table` input is the batch-creation primitive: paste a table copied from Excel / Google Sheets / Notion / Slack / Markdown and it replaces the whole grid; the Copy button writes TSV *and* a real HTML `<table>` back to the clipboard so the round trip into collaboration tools is lossless. Cells can hold whole paragraphs. Pair it with `render.paginate` (below) and each row becomes a page. In URL mode the entire table is ONE compact param; in the CLI, `--<inputId>-data=table.csv` fills it from a CSV/TSV/Markdown file.

Four declarations of four different types are four different controls. `color-palette` declares exactly that and nothing else: a `color`, a `select`, a `number` and a `boolean`.

![Colour Palette's whole sidebar - a swatch trigger, a harmony dropdown, a shades slider and a neutrals switch, one control per declared type](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3D%25232563eb%26harmony%3Dtetrad-4%26steps%3D9&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=%23tool-inputs&walker=1&dark=1&filename=at2-input-types-palette)

`text` and `longtext` differ only in the declaration, and the shell picks the control: a single-line field for one, a sized textarea for the other. `prompt-card`'s prompt is a `longtext`.

![The prompt field in Prompt to Image - a tall textarea holding many lines, produced by nothing more than type longtext](/t/url-shot?url=%2F%23%2Ftool%2Fprompt-card&width=1440&height=900&dpi=192&waitMs=2000&css=%23tool-canvas%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.input-row%3Ahas%28%5Bdata-input-id%3D%22text%22%5D%29&dark=1&filename=at2-input-longtext)

The three moment types (`date`, `time`, `datetime-local`) are real input types with real controls, but no tool in the open community set declares one, so there is no screenshot of them here.

#### `blocks` - repeating groups

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

In the template, iterate with `{{#each people}}…{{/each}}`. The value round-trips to the URL as a JSON array (see `docs/url-mode.md`); very large lists outgrow a pasteable link - the shell auto-compresses long queries (the packed `z` form) and warns past ~2,000 chars, so share those states via a saved-state `slot` instead. Blocks are edited in a side panel, and clicking a rendered block on the canvas focuses that block's field. `meeting-planner` is the reference implementation for the simple (homogeneous) case.

![Deck Studio's blocks input - each row is its own card of fields, carrying the row type as its label and an Add slide button below the stack](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=.blocks-input%5Bdata-input-id%3D%22deck%22%5D&dark=1&filename=auth-blocks-rows)

**Advanced blocks (typed / heterogeneous rows).** Sub-fields aren't limited to `text` - a field may be `text`, `color`, `select`, `asset`, `number` or `boolean`. And the row set can be **discriminated** by a `select` sub-field:

- `addMenu: { field, label }` turns the **"+ Add"** button into a typed menu - each option of the named discriminator sub-field becomes a menu entry. The discriminator is fixed at creation and shown as the block's label rather than an editable control. An entry already used is disabled unless its option sets `repeatable: true`.
- `showFor: ["kind"]` on a sub-field limits it to blocks whose discriminator value is listed.
- `multilineFor: ["kind"]` (with optional `rows`) renders a text sub-field as a textarea for those discriminator values.

`color-block` is the reference for typed/heterogeneous blocks (`addMenu` keyed on a `kind` select, `showFor`, `multilineFor` and the full sub-field type set).

**Drop files to add rows.** A `blocks` input may declare `dropToAdd: { field, accept }` - dropping one or more files onto the blocks list appends one row per file, uploading each into the named `asset` sub-`field` (the row's other fields start at their defaults). `accept` is a MIME filter (default `image/*`). `logo-wall` is the reference: drop many logos → one block each. (It ships with the **SUSE brand pack**, so it is only on disk on a profile that mounts that pack.)

**Paste a Markdown document (`mdPaste`).** A `blocks` input may set `mdPaste: true` to add a **Paste Markdown** button to the blocks toolbar: it reads the clipboard, splits the Markdown into one block per heading (heading line → the block's `heading` field, the section beneath → its `body` field, kept as Markdown for a `{{markdown}}` render) and appends the blocks - so a whole document arrives as editable, page-flowing blocks. Used by the paged/document tools.

**Import rows from a spreadsheet (`importData`).** A `blocks` input may declare `importData: { formats?, mode?, columns? }` to offer an **Import data** button that fills the whole list from a **CSV or JSON** file - the ingest counterpart to CSV/JSON *export*. The engine (`parseDataRows`) maps columns onto the block's sub-fields: an explicit `columns` map (`{ fieldId: "Column Name" }`) wins, otherwise each column header/key is matched case-insensitively to a field's `id` then its `label`. `formats` limits the accepted types (default both); `mode` is `replace` (default) or `append`. JSON may be an array of objects, an array of arrays (positional, in field order) or `{ "data": [ … ] }`. The imported rows are ordinary blocks - they serialise to the URL and save like any hand-entered data. `chart-creator` is the reference: import a two-column `Label,Value` sheet to chart it.

**Reference pickers (`optionsFrom`).** A sub-field can be a dropdown whose choices are the *rows of another blocks input* - so a row references another row by a friendly name instead of a hand-typed id. Declare `optionsFrom` on the field:

```json
{ "id": "parent", "label": "Reports to",
  "optionsFrom": { "input": "nodes", "value": "nodeId", "label": "label",
                   "excludeSelf": true, "excludeDescendants": true, "emptyLabel": "- Top level -" } }
```

The value **stored** is the target row's *derived id* - `slug(value field)`, else `slug(label)`, else an ordinal, de-duplicated - i.e. exactly the id a hook resolves with (your hook should slug both a row's id and the back-reference, so the two agree). A stored value matching no current row is shown as a selected **"(unknown)"** option rather than vanishing, so a stale reference is visible. Options: `value`/`label`/`prefix` (the source sub-fields + ordinal prefix), `sources: [{input,value,label}]` to merge several inputs (e.g. cards **and** layers, de-duped by value), `freeText: true` for a combobox (datalist) that also accepts a typed-in value (e.g. a new kanban column), `excludeSelf`, `excludeDescendants` (needs `nesting`, below) and `emptyLabel`.

**Tree blocks (`nesting`).** A `blocks` input can be edited as a tree: the sidebar renders the flat array as an **indented outline** (pre-order) and the header drag drops a card **above / below** (sibling) or **inside** (child) another, updating its parent reference - the whole subtree travels with it. The data stays a flat reference-by-id array, so it serialises and renders exactly as before (the renderer still walks the parent pointers). Declare `nesting` on the input:

```json
{ "id": "nodes", "type": "blocks", "nesting": {
    "parentField": "parent", "keyField": "nodeId", "labelField": "label",
    "activeWhen": { "diagramType": ["org", "mindmap"] } } }
```

`activeWhen` gates tree mode by top-level input values (an array value matches by membership); omit it to always nest. `diagram-builder` is the reference for both `optionsFrom` and `nesting` (org / mind map nest; process / kanban / layercake stay flat and reference by picker).

#### Editor canvas: connectors, grid & fixed size (`canvas.connect` / `grid` / `fixedCanvas`)

A `blocks` input carrying a `canvas` object is the free-form WYSIWYG artboard behind `render.layout: "editor"` (see [The `render` block](#the-render-block)): its `*Field` keys map each row's geometry (`xField`/`yField`/`wField`/`hField`/`rotationField`, plus fill/text/image sub-fields) so the shell can mount its select / drag / resize / rotate overlay while the data stays a flat, URL-expressible array. The shell mounts the whole editor rail for you - add, arrange, undo and the primary export actions - so the manifest declares geometry fields and nothing else.

![The free-canvas editor rail the shell mounts for an editor layout - add, arrange, undo and export, none of it declared by the manifest](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&css=.fc-toolbar%7Bopacity%3A1!important%7D&walker=1&format=svg&cropSelector=.fc-toolbar&dark=1&filename=auth-editor-rail)

Three of the `canvas` keys turn a plain box canvas into a **diagram editor**:

- **`grid`** - `{ size, default }`. Opt into snap-to-grid: the overlay rounds drag/resize to a lattice of `size` canvas px, starting on when `default` is true (per-axis alignment guides still win; holding Alt disables the snap).
- **`fixedCanvas`** - `true` locks the canvas to `render.width`/`render.height`: the shell withholds `setCanvasSize` and ignores reserved `?width`/`?height`, so box coordinates stay 1:1 with the render size. **Required whenever a hook draws into a fixed-viewBox overlay** - e.g. connector arrows in an `<svg>` sized to the artboard.
- **`connect`** - opts into connector authoring: a Connect-mode rail button (click a source box, then targets), a live connector preview and an Auto-arrange (tidy-tree) button. **Edges are stored as rows of a _second_ `blocks` input** named by `input`; the tool's `hooks.js` reads that array and renders the arrows (as an SVG of filled paths - one artboard-sized `<svg>` per the `org-chart` pattern). The `*Field` keys name sub-fields of that connectors block:

  ```json
  "connect": {
    "input": "connectors",
    "fromField": "from", "toField": "to",
    "styleField": "style", "arrowField": "arrow", "headField": "head",
    "colorField": "color", "dashField": "dash", "widthField": "width",
    "layerClass": "oc-connectors",
    "defaultStyle": "elbow", "defaultArrow": "end", "defaultHead": "triangle",
    "defaultColor": "#94a3b8", "defaultWidth": 2.5
  }
  ```

  - `fromField` / `toField` (default `from` / `to`) hold the source and target **box ids**.
  - `styleField` - route flavour select (`straight` / `elbow` / `elbow-v` / `elbow-h` / `elbow-src` / `elbow-tgt` / `curved`).
  - `arrowField` - which ends carry an arrow (`none` / `end` / `both`); `headField` - arrowhead **shape** (`triangle` / `open` / `circle` / `diamond` / `bar`).
  - `colorField` (color) / `dashField` (`solid` / `dashed` / `dotted`) / `widthField` (number, px) - the edge's line styling.
  - `layerClass` - the CSS class on the tool's rendered connector `<svg>`, which the shell hides mid-drag while it paints its own live preview.
  - `default*` (`defaultStyle` / `defaultArrow` / `defaultHead` / `defaultColor` / `defaultWidth`) - the values a newly-drawn edge starts at.

`org-chart` is the reference implementation: an `editor`-layout box canvas with `grid`, `fixedCanvas: true` and a `connect` writing to a `connectors` blocks input whose rows its hook turns into one artboard `<svg>` of arrows. It ships with the **SUSE brand pack**, so it is only on disk on a profile that mounts that pack.

A canvas that maps the **ten time sub-fields** (`startField`, `durField`, `clipInField`, `speedField`, `enterField`, `exitField`, `enterMsField`, `exitMsField`, `muteField`, `laneField`) becomes a timeline editor: the shell mounts the timeline panel, the clock and the sequence export path. All ten or none - a partial mapping gives the panel somewhere to read from and nowhere to write, so it is treated as absent. Three further keys are **optional** on top of that, each additive on its own:

- **`zField`** - names the `number` sub-field holding a box's depth (px above the surface). Consumed by the projection and depth-ordering math; the depth shadow (below) reads the same field.
- **`kfField`** - names the `text` sub-field holding a box's keyframe track (see `docs/url-mode.md`'s Keyframe tracks section for the wire grammar). A track can key a box's **size** as well as its pose (`w`/`h`, absolute px), and that is the one channel pair whose effect is a real re-layout: a size tween reflows, so text rewraps and a border stays one pixel wide. Hooks must treat this field as **strict emission only**: parse it and re-serialise the result, never pass the raw stored value through to a rendered attribute - a hand-edited share URL can put anything in a text field, so the re-serialise step is what keeps only charset-clean tokens on the page.
- **`linkField`** - names the `text` sub-field holding the **A/V detach back-reference**: the id of the box this one was detached from (or onto), written on **both** sides when a clip's audio is split onto its own lane, so re-attaching works from either end. Machine-written by the timeline panel and never typed, so it wants `showFor: []`. It is not an instancing or geometry-sharing mechanism; a tool that omits it is still fully time-capable, it just never offers "Detach audio".

Two more depth affordances are values inside existing declarations rather than `canvas` keys. A box `kind` of **`camera`** is a non-visual marker that aims and dollies the view: it has **no canvas footprint** - excluded from hit-testing, marquee, align/distribute and z-order, selected from its timeline bar or chip and contributing no pixels to the export. And the `shadow` select can gain a **`depth`** option alongside the existing choices - a drop-shadow derived from the box's `zField` value (falling off with depth) rather than a manually authored offset/blur/colour.

#### `vector` - a group of numbers as one control

Use `vector` when a few related numbers belong together - zoom + pan, an x/y offset, padding, margins. Instead of separate `number` inputs (one column each in `/pro` bulk mode), a `vector` is **one input, one control, one column**: a row of compact number fields where each label can be dragged to scrub the value (Figma-style) or typed into. Declare the numeric sub-fields under `fields`:

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

![A vector control in Mesh Gradient - one labelled row of compact number fields you can drag to scrub or type into](/t/url-shot?url=%2F%23%2Ftool%2Fgradient&width=1440&height=900&dpi=192&waitMs=2000&css=%23tool-canvas%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.input-row%3Ahas%28.vector-input%5Bdata-input-id%3D%22pos1%22%5D%29&dark=1&filename=auth-vector-control)

The value is an object keyed by field id, so the template reads each part with dot access: `{{imageFraming.zoom}}`, `{{imageFraming.x}}`, `{{imageFraming.y}}`. Each field clamps to its own `min`/`max` and falls back to its `default`.

In URL mode (and `/pro` CSV) each field is its **own flat param/column**, namespaced `"<inputId>.<fieldId>"` - e.g. `?imageFraming.zoom=200&imageFraming.x=30&imageFraming.y=70`, or CSV columns `imageFraming.zoom`, `imageFraming.x`, `imageFraming.y`. There is no `urlKey` on a vector. `quotes` (`imageFraming`) is the reference implementation; the `filter` tool carries the same control per raster effect (namespaced, e.g. `du_imageFraming`).

`imageFraming` is a **canonical input** (see below) - reuse that id and field set verbatim for any zoom/pan-an-image control rather than inventing a synonym.

#### Framing an image: one pattern, every tool

Placing, cropping, straightening and perspective-correcting an image is ONE control everywhere (plans/148). Do not write an `object-position` string by hand, and do not invent a second set of ids for the same job: a divergent id or range forfeits the shared `/pro` column, and a hand-written recipe drifts from what the export paths actually do.

Three declarations make an image slot framable:

```json
{ "id": "image", "type": "asset", "assetType": "image", "label": "Image" },
{ "id": "imageFraming", "type": "vector", "label": "Zoom & Position", "framingFor": "image",
  "fields": [
    { "id": "zoom",   "label": "Zoom",       "min": 100,  "max": 400, "step": 1,   "default": 100 },
    { "id": "x",      "label": "X",          "min": 0,    "max": 100, "step": 1,   "default": 50  },
    { "id": "y",      "label": "Y",          "min": 0,    "max": 100, "step": 1,   "default": 50  },
    { "id": "rotate", "label": "Rotate",     "min": -180, "max": 180, "step": 0.5, "default": 0   },
    { "id": "pitch",  "label": "Vertical",   "min": -45,  "max": 45,  "step": 0.5, "default": 0   },
    { "id": "yaw",    "label": "Horizontal", "min": -45,  "max": 45,  "step": 0.5, "default": 0   }
  ] },
{ "id": "imageFit", "type": "select", "label": "Fit", "attachTo": "image", "display": "icon-toggle",
  "default": "cover",
  "options": [
    { "value": "cover",   "label": "Fill", "icon": "fitCover" },
    { "value": "contain", "label": "Fit",  "icon": "fitContain" }
  ] }
```

Every field is opt-in: declare `x`/`y` alone for a pan-only slot, add `rotate` to straighten, add `pitch`/`yaw` for perspective correction (the Geometry panel in Lightroom, "Adjust" in Instagram). `framingFor` names the asset input the vector frames, and it is what turns the sidebar numbers into a real on-canvas control.

Render it with the **`{{framing}}` helper**, which emits the placement CSS *and* the marker the shell binds to, in one call:

```html
<img src="{{asset image}}" {{framing "imageFraming"}}>
```

The argument is the input's **id**, not its value - the helper needs the id for the marker, and reads the value (and the companion `imageFit`) off the render context. A `style=` option appends your own declarations after the geometry, and `persp=` overrides the viewing distance the pitch/yaw envelope projects through.

What the author gets for those three declarations, with no shell code and no per-tool branch:

- **on the canvas** - tap the image to arm it, then drag to move, scroll or pinch to zoom about the pointer, drag the top handle to straighten (Shift snaps to 15 degrees), hold Alt and drag to correct converging verticals, double-click to reset, arrow keys to nudge, Escape to release. One drag is one undo step;
- **"Use as a new image"** - bakes the framing into new pixels saved to the user's library as a child of the original, with the source carried as a Content Credential ingredient, then points the input at the child and resets the framing. Only ever on an explicit click; the default outcome is always that the original is untouched and the framing lives in the URL;
- **URL and CLI parity** - `?imageFraming.zoom=180&imageFraming.yaw=-6`, or `--imageFraming.yaw=-6`, with no extra work;
- **export parity** - the same numbers place the image in the SVG walker, the PDF vector path, the raster path and PPTX.

One caveat before you offer `pitch`/`yaw`: a tilted plane is a projective homography, which SVG and PDF have no transform for. Pan, zoom and roll stay fully vector; a *tilted* image exports through the walker's posed-raster path for that element instead. Leave the two fields out of a tool whose output must stay vector at all costs.

**Canvas-drawing tools** (a hook compositing into a `<canvas>`) call `drawFramed(ctx, source, iw, ih, W, H, framing, fit)` from `community/_shared/framing.js` instead of the helper, and mark the rendered element with `data-framing="imageFraming"` by hand. It is the same maths - a fixture table pins the two implementations equal - so a canvas tool and a DOM tool place the same photo the same way.

**Inside a `blocks` row** a sub-field cannot be a `vector`, so the same values live as sibling numbers `<prefix>Zoom` / `<prefix>X` / `<prefix>Y` / `<prefix>Rotate` / `<prefix>Pitch` / `<prefix>Yaw`. Put `framingFor: "<prefix>"` on the row's asset sub-field and render with the helper's block mode:

```html
{{#each blocks}}<img src="{{asset this.bgImage}}" {{framing "bg" block="blocks" index=@index}}>{{/each}}
```

Whole marks are the documented exception: `logo-wall`, `logo-lockup-partner` and `snippet`'s title icon offer scale only, because a logo is not cropped.

#### `asset` - library or device upload

An `asset` input opens the host's asset picker and stores the chosen `AssetRef` - uniform whether it came from the catalog or the user's device:

```json
{
  "id": "logo",
  "type": "asset",
  "label": "Logo",
  "assetType": "image",    // vector | raster | image | video | audio | lottie | any - constrains the picker
  "allowUpload": true       // also let the user add an image from their device
}
```

`assetType` constrains what the picker offers: `raster` (bitmaps only), `vector` (SVG only - for inline-recolourable logos), `image` (**any still image - raster _or_ vector**, the right choice for a generic picture slot), `video`, `audio` (`audiogram` uses this), `lottie` or `any` (everything, including non-image assets). Prefer `image` over `raster` for photo/illustration slots so users can also pick or upload SVGs.

![The Image row in the Filter tool - a thumbnail slot and a Choose asset button that opens the host's picker, with nothing about pickers in the manifest](/t/url-shot?url=%2F%23%2Ftool%2Ffilter&width=1440&height=900&dpi=192&waitMs=2000&css=%23tool-canvas%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.input-row%3Ahas%28.asset-picker-trigger%5Bdata-input-id%3D%22image%22%5D%29&dark=1&filename=at2-input-asset-picker)

When `allowUpload` is `true`, the picker offers the user's **personal image library** alongside the catalog. Users add images from their device; the host stores the bytes **verbatim** (a silent re-encode would break a Content Credential's hard binding) and only offers to downscale when a file is genuinely huge. Metadata stripping is a separate, opt-in user preference (*Strip metadata from uploads*, default off). The library is **not capped by count** - the only limit is the device's own storage, checked before each write - and it is reusable across tools and managed in **Profile → Storage → My images**. SVG uploads are sanitised on ingest (script/handler stripping) and pass through without rasterising.

These images are **device-local**: their `AssetRef.source` is `"user"` and their `user/…` id is meaningful only on the device that holds the bytes, so they are **omitted from shareable URLs** (see `docs/url-mode.md`). Tools treat `user` and `library` assets identically - no tool code is involved in the upload.

**Use any tool as an image (paste a Lolly link).** Every `asset` input also accepts a **Lolly tool link** pasted into the picker's search box - a share link copied from another tool (`…/#/tool/qr-code?url=…`) or an embed URL (`…/tool/qr-code.svg?…`). The host renders that tool (via `host.compose`) and drops the result into the slot; the user can pick the render format and size before committing. This is the **end-user** counterpart to authored `composes` (below) - no manifest declaration needed, and it works in every tool's image inputs by default. The picker offers SVG **and** bitmap render formats for any image slot (SVG is the default - it stays crisp and inlines as true vector in SVG/PDF export, and rasterises cleanly for PNG); a `vector`-typed slot is restricted to SVG. The chosen asset's identity is the canonical embed URL, so it **persists in saved sessions and shareable links** and re-renders on load - exactly like a library id. (The picker offers this whenever the shell can compose; the `compose` *capability* gates only authored `composes`, not this end-user path.)

#### `file` - the user's own file (on-device utilities)

A `file` input takes a file the user picks **into memory** and hands its raw bytes to the tool. It's the input shape for **content-transform utilities** - the "boring file jobs you'd otherwise hand to a stranger's website": strip EXIF, crop, compress, convert. Unlike `asset` (which is for *brand* imagery and goes through the catalog/upload library), a `file` is the user's own content that's processed and handed straight back, never stored or uploaded.

With `layout: "canvas"` a single `file` input stops being a sidebar row and becomes the working area itself - the drop zone `strip-data` opens with.

![Strip Hidden Data's canvas - a drag-and-drop file zone with a Choose a file button and the note that nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=1800&walker=1&format=svg&cropSelector=%23tool-content&dark=1&filename=auth-file-input)

```json
{
  "id": "photo",
  "type": "file",
  "label": "Photo",
  "accept": ["image/jpeg", "image/png", ".jpg", ".png"],
  "maxSize": 52428800
}
```

- `accept` - allowlist of MIME types and/or extensions for the picker (a UX hint; still validate bytes in the hook). Omit to accept anything.
- `maxSize` - max bytes; the host rejects larger files at pick time.

The value is a **`FileRef`**: `{ __file: true, name, mime, size, bytes, url }`. The `bytes` are a `Uint8Array` the hook reads directly (no `host.*` call - the bytes ride in the value by design, because the portable `host.*` surface has no file-read API). A `file` value is **never serialised into a URL** (binary has no shareable form) and **never persisted** - it lives only in memory on the device, which is the whole privacy point. In CLI transport a file param is a path the runner loads: `--photo=./pic.jpg`.

#### Producing output: the `exportFile` hook + `privacy: "on-device"`

A content-transform utility doesn't rasterise the canvas - it produces a *transformed file*. Declare the `exportFile` hook and mark the tool as an on-device utility:

```json
{
  "status": "official",
  "privacy": "on-device",
  "render": { "width": 760, "height": 620, "formats": ["jpg"], "export": false, "actions": [] },
  "hooks": { "onInput": true, "exportFile": true }
}
```

- `privacy: "on-device"` shows the **"Runs on your device - nothing is uploaded"** badge and enforces (validated) that the tool is never `experimental`, and (at runtime) that exports carry **no provenance metadata and no watermark** - you must not stamp anything into a user's own file.
- `render.export: false` hides the standard format/size/download bar; `"actions": []` opts out of the default Save/Share buttons (saving would persist the user's bytes - never do that).
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

`/pro` (the web shell's batch mode) is a **spreadsheet grid** that renders many rows at once across one or many tools - CSV/TSV round-trip and spreadsheet paste in, a `.zip` of per-row outputs out, with collapsible export columns and saved batch sessions. Because it lays every selected tool's inputs out as a grid, the `id`/constraint choices you make below directly shape that grid.

`/pro` batch mode lays every selected tool's inputs out as a grid. **It keys each column by input `id`** - so two tools that call the same concept by the same id collapse into *one* column, and if they also agree on type + constraints (number `min`/`max`/`step`, select options, color palette), that column becomes **bulk-writable**: the user types one value and it fills every row. Diverge on the id (or the constraints) and you get a separate, cell-by-cell column instead. So picking a shared id is a real UX decision, not a style preference.

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

Labels are *advisory* - show whatever label fits your tool; the `/pro` header just uses the first non-empty one, and bulk-write only cares about id + type + constraints. Adding a genuinely new shared input? Add it to `schemas/canonical-inputs.json` first, then adopt it - `npm run validate:catalog` emits a **warning** (never an error) when a tool uses a canonical id with a divergent type or constraints, so drift stays visible.

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

- `{{value}}` - HTML-escapes by default. Always use this for user input.
- `{{{value}}}` - raw, no escape. Only for trusted, system-generated HTML.
- Block helpers: `{{#if}}`, `{{#each}}`, `{{#unless}}`. No arbitrary JS.

`wordmark` is about as small as a template gets: one string, one face, one weight. Everything below came from the link's params flowing into `{{ }}` slots, with no code in between.

![The Wordmark canvas rendering the word Handlebars at weight 800, the whole output of a template whose only moving part is one text value](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHandlebars%26weight%3D800%26size%3D150%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=at2-template-wordmark)

**Custom helpers.** The engine registers these in `engine/src/template.ts` (the source of truth - this table should list exactly what it registers, no more, no fewer):

| Helper | What it does |
|---|---|
| `{{default x "fallback"}}` | `x` unless it's null/undefined, then the fallback. |
| `{{upper s}}` / `{{lower s}}` | Upper/lower-case a string. |
| `{{eq a b}}` | Strict equality - use inside a condition, e.g. `{{#if (eq kind "note")}}`. |
| `{{markdown body}}` | Render a **small Markdown subset** to safe HTML: `#`…`######` headings, `**bold**`, `*italic*`, `~~strike~~`, bullet and numbered lists, `[label](url)` links and `![alt](url)` images. Author text is HTML-escaped **before** any tag is introduced, and link/image URLs are scheme-allowlisted (links: http/https/mailto/tel; images add data:/blob:) - anything else renders as plain text. Images carry `class="md-image"` so a tool can size them. Use `{{{markdown body}}}` (triple braces). Used for `blocks` bodies, `table` cells and pasted Markdown. |
| `{{arrow text}}` | A leading `>` `<` `^` `v` becomes `→ ← ↑ ↓` (for directional labels). |
| `{{asset ref}}` | The resolved URL of an asset input. Use in `src`/`href`. |
| `{{asset ref "width"}}` | A specific field of the asset (`width`, `height`, …). |
| `{{media ref}}` | Emits the right element for **any** asset kind - `<img>`, `<video>` or a Lottie marker - from one call. Options hash: `class`, `style`, `loop`, `autoplay`, `muted`, `controls`, `fit` (`contain`/`cover`), `key`. |

The data-format helpers `{{icsStamp}}`, `{{rfcText}}` and `{{csvCell}}` are for the sibling text templates - see [Data formats](#data-formats-json-csv-ics-vcf) below.

### Canvas tools: readiness, the frame clock and GPU rendering

A template may paint into a `<canvas>` instead of markup (`3d`, `synth`, `gradient` and `spatial-photo` do). The export path reads that canvas back as pixels, so three small contracts keep exports correct:

- **Readiness.** If the first frame arrives asynchronously (a model or a library load), set `window.__toolHasReadySignal = true` at the top of the template script and dispatch `tool:ready` on `document` once the first frame is painted. The shell waits for it before capturing; without it a slow first frame exports blank.
- **The frame clock.** For animated output (gif, apng, webp-anim and frame-by-frame video) store a function on the canvas element: `canvas.__lollyFrameRender = function (t) { … }` renders the exact frame at normalised loop time `t` in `[0, 1)`. The shell sets `canvas.__lollyFrameDriven = true` while it drives frames, so the tool's own `requestAnimationFrame` loop should stop advancing while that flag is set. Stills call it with `0`. Store it on the canvas, never on `window`: a global leaks across tool navigation.
- **Real-time video.** Mark the canvas `data-capture-stream` and webm/mp4 record it live through `captureStream()` instead of frame by frame, so a self-looping animation records as one continuous loop with no cut at the join.

**GPU rendering (WebGL, WebGPU).** Never let the export path read a GPU canvas directly. A WebGPU canvas is cleared as soon as its frame is presented and has no `preserveDrawingBuffer`, so anything read later is blank, and a WebGL canvas only survives the read with `preserveDrawingBuffer: true`, which costs memory and a copy per frame. Render into a detached scratch canvas instead and, inside the same frame callback, draw it onto the visible 2D canvas:

```js
var view = document.getElementById('my-canvas');   // the template's canvas, plain 2D
var ctx = view.getContext('2d');
var gpu = document.createElement('canvas');         // never enters the DOM
gpu.width = view.width; gpu.height = view.height;
// … create the WebGPU or WebGL context on `gpu` and render into it …
function present() { ctx.clearRect(0, 0, view.width, view.height); ctx.drawImage(gpu, 0, 0); }
```

Call `present()` at the end of every render, including inside `__lollyFrameRender`. The visible canvas then always holds the last frame, every export reader sees pixels, and the tool is free to pick WebGPU where the browser offers it and fall back to WebGL 2 where it does not. `3d` does this with three.js's `WebGPURenderer({ forceWebGL })` and reports its choice as `data-backend` on the canvas. Feature-detect with `navigator.gpu.requestAdapter()`: an adapter that resolves to `null` means no WebGPU, whatever `navigator.gpu` says.

## Styles (`styles.css`)

Scoped automatically. Write top-level selectors targeting your own classes. Don't write global rules (`body`, `html`); they'll be scoped to `#tool-canvas` and probably won't do what you want.

### What the vector export keeps

SVG and PDF exports are not screenshots. The exporter reads each element's computed style and re-emits it as vector, so the CSS you choose decides whether a feature survives as geometry, is rasterised into the file, or is dropped. A row marked *raster* still exports correctly, but that one element becomes a bitmap inside an otherwise vector file.

| You write | In the SVG / PDF |
|---|---|
| `border` (one width and colour all round), `border-radius`, `dashed`, `dotted` | Kept as a stroke, dash pattern included. |
| A border that differs per side | Kept as flat edges. A corner radius or dash on a mixed border is lost. |
| `outline` | Not exported. Use `border`, or `box-shadow` spread, for a visible ring. |
| `box-shadow` (outer and `inset`), `text-shadow`, `filter: drop-shadow()` | Kept: native SVG filters, or the shape redrawn; PDF bakes only a blurred shadow. |
| `filter: blur()` | Kept in SVG. PDF rasterises the element. |
| `opacity`, `mix-blend-mode` | Kept in SVG. Blend modes rasterise in PDF. |
| `overflow: hidden`; `clip-path` with `circle()`, `ellipse()`, `inset()` or `polygon()` | Kept as a clip. `clip-path: url()` or `path()` rasterises. |
| `mask-image`, `mask` | Raster. |
| `backdrop-filter` | A plain `blur()` is kept in snapshot exports; anything richer rasterises. |
| Text | Outlined to paths with the real font, including `-webkit-text-stroke` and `paint-order`. A glyph the font lacks (an emoji, say) keeps that whole line as live `<text>`, which then needs the font on the viewer's machine. |
| `background-image` | Gradients become real gradients and a single image an `<image>`; `conic-gradient` rasterises. |
| `transform` | 2-D transforms are kept. 3-D (`rotateY`, `perspective`) is not. |

The `penpot` format keeps this same vector set, as editable Penpot shapes instead of SVG elements. What costs you those shapes is not the *raster* column: the lowering reads the exported SVG, and one `<clipPath>`, `<filter>`, `<pattern>`, `<mask>`, `<use>` or inline `<style>` anywhere in it puts the **whole** render on the board as a single picture instead. On an HTML layout those come from a rounded `overflow: hidden` box whose content reaches a corner, an `object-fit: cover` or circular image crop, a `background-image`, a `clip-path` and a blurred `text-shadow`. `box-shadow` is not one of them: the Penpot render draws shadows as geometry rather than as an SVG filter.

### Letting the DOCUMENT bring its own CSS

A tool can also give the person using it a stylesheet - Design does, as its `customCss`
input. Three rules make that safe, and a tool that offers user CSS is expected to follow
all three (`community/design/hooks.js` is the reference; `tests/design-custom-css.test.ts`
is the security shape to copy):

1. **Sanitise in the hook, never in the shell.** The hook neutralises `</style` and strips
   `@import`, then hands back a string the template emits inside `<style>`. Doing it in the
   hook is what makes the CLI's output identical to the browser's - a shell-side filter
   would leave the headless render unfiltered.
2. **Emit, then let the shell scope.** The shell re-scopes template `<style>` to the tool
   canvas (`scopeTemplateStyles`), and its scoper handles top-level `@keyframes` correctly,
   so real animations belong at the document level rather than nested per element.
3. **Give the CSS something to aim at.** Free-text rules need stable handles: Design stamps
   `data-frame-id` on each artboard, sanitised `data-frame-state` tokens from a per-frame
   `state` field, and a per-box `cls` field whose tokens join the element's class list
   (`.callout { … }`). Those pass through the same parse-and-re-serialise treatment as any
   other free text - lowercased, cleaned to `[a-z0-9_-]`, and refused where they'd collide
   with the app's own namespaces (`lolly-`, `pr-`, `seq-`, `fc-`).

**Custom JS is not offered, and should not be.** Hooks are closure-injected, not sandboxed,
so a per-document script input would be stored XSS in every shared URL. The escape hatch
that exists is composition: a `sandbox` tool link placed as a box.

## Templates & presets (`templates/`)

A tool's curated starting points live as one file per template in `tools/<id>/templates/`:

```json
{
  "id": "poster",
  "name": "Poster",
  "category": "Poster",
  "description": "One artboard, one message.",
  "values": { "<inputId>": "<value>" },
  "presets": [
    { "id": "story", "name": "Story", "description": "9:16 for social stories.",
      "values": { "<inputId>": "<overlay value>" } }
  ]
}
```

- **`id` must equal the file basename** (`poster.json` → `"id": "poster"`) - it is the
  stable address the `?template=` launcher and the chooser use. Ids are permanent, like
  tool ids.
- **`values` is a full input seed**: input ids from your manifest mapped to values of the
  right type. It is what a fresh session opens with when the person picks this template.
- **`presets` are variants inside the template** - each one a values overlay merged over
  the template's base (shallow, per input id, preset wins). A size variant of a blocks
  composition therefore carries the FULL replacement array, not a fragment. Deep-link a
  preset as `?template=<tid>&preset=<pid>`.
- The synced catalog index carries **metadata only** (names, categories, descriptions -
  never `values`), so templates cost nothing at rest however large the seed grows; the
  values file is fetched when picked. Run `npm run build:catalog` after adding or editing
  one, and `npm run validate:catalog` checks the shape (ids, uniqueness, object values).
- With at least one template, a blank fresh open of your tool presents the **Start
  chooser** (search, category chips, live-rendered tiles, preset chips); the tools view
  shows the count on your card, lists every template in the About dialog, and finds the
  tool by its template and preset names in search. In the editor layouts, "New from
  template" in the Lolly menu reopens the chooser mid-session.
- Keep names and descriptions short and plain - they are user-facing copy and will be
  localized.

People also save their own templates in the app (see Publishing) - those join the same
chooser under "Your templates", no files involved.

### Curated Design motion

Design templates can carry optional `motion` metadata beside `values`:

```json
"motion": {
  "collection": "Launch",
  "recipe": "assemble-loop",
  "durationMs": 6000,
  "posterMs": 3300,
  "beats": ["Assemble", "Settle", "Hold", "Unwind"]
}
```

The catalog carries this small description; the animation itself stays in the
ordinary `boxes` keyframes and clips. The gallery and template chooser render the
poster at `posterMs` and offer a live preview using the same sequence clock as
export. Reduced-motion users see the poster until they explicitly play it. Picking
an example opens an editable document at its readable poster; pace presets scale
that opening position with their duration. An explicit `_t=` link still wins.

Use semantic brand colours and font roles, allow enough reading time after the
last entrance, and keep every part of a compound card aligned throughout its move.
The four Launch templates include 6-second base, 7.5-second Calm and 4.2-second
Brisk treatments. Their Choreograph recipes expand to ordinary editable tracks.
Motion metadata currently enables live discovery previews for Design. Durations
must be 800–30000 ms, with a poster inside that interval and one to eight short
beat descriptions. Run `build:catalog:all` and `validate:catalog:all` after changing
a community template so every mounted brand receives the new metadata.

## Data formats (`json` / `csv` / `ics` / `vcf`)

Some tools export *data* alongside the rendered image - a calendar invite, a contact card, the underlying numbers. These come from the **input model**, not the pixels, so they work in every shell (including the CLI) and don't need a browser.

- **`json`** - no template needed. Add `"json"` to `render.formats` and the export is `{ tool, version, inputs: { … } }` (the resolved input values), serialized automatically.
- **`csv` / `ics` / `vcf`** - add the format to `render.formats` **and** ship a sibling text template `template.<ext>` (e.g. `template.ics`). It's a Handlebars template hydrated against the same context as `template.html` (input values + hook `extras`), but **without HTML escaping** - so `{{title}}` emits the value verbatim. Escape per the target format with the built-in helpers:
  - `{{icsStamp meetingTime}}` - a `date`/`datetime-local` value → iCalendar basic form (`20260915T143000`).
  - `{{rfcText x}}` - escape an iCalendar (RFC 5545) **or** vCard (RFC 6350) text field (`\` `;` `,` newline).
  - `{{csvCell x}}` - quote a CSV field per RFC 4180 only when needed.
- **`srt` / `vtt`** (v1.150) - the same sibling-template mechanism, for subtitle sidecars: ship `template.srt` or `template.vtt`. The cue text itself is a hook extra (a captions tool already holds one in its target input), so the template is usually a single `{{captions}}`. SRT downloads as `text/plain` (SubRip has no registered MIME), WebVTT as `text/vtt`.
- **`css` / `scss` / `gpl`** - the same sibling-template mechanism, for palette output: ship `template.css`, `template.scss` or `template.gpl`. `color-palette` is the reference (its `ase` sibling is binary, so that one comes from an `exportStill` hook instead of a template).

Example `template.ics` (see `tools/meeting-planner/`):

```handlebars
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:{{icsStamp meetingTime}}
SUMMARY:{{rfcText title}}
LOCATION:{{rfcText city}}
END:VEVENT
END:VCALENDAR
```

Reference wirings: `meeting-planner`→ICS, `email-signature`→vCard, `chart-creator`→CSV. Raster, `pdf`, video, `zip` and `ico` come from a browser engine - the web shell, the Tauri-bundled CLI or the node CLI's raster tiers (resvg renders `png` from SVG-native tools browser-free; a scoped Chromium via `lolly install-browser` covers the rest) - while the node CLI writes `svg`/`svgz`/`emf`/`wmf`/`eps`/`eps-cmyk`/`dxf`/`bmp` and the text/data formats DOM-free. The CMYK formats pair with the `convertPaths` outlining toggle (see [The `render` block](#the-render-block)) for fonts-not-installed print fidelity; `pdf-cmyk` ships on more tools than `cmyk-tiff` does (a subset) - e.g. `qr-code` offers both, while `wayfinding-signage` and `event-name-badge` ship `pdf-cmyk`.

## Hooks (`hooks.js`)

Optional. Required only if you need computed values, async data or anything the template can't express.

A layout no logic-less template could reach is the sign that you need one. The Chart tool parses its pasted table, runs the layout and hands the template a finished shape list as extras; the template itself just prints it.

![A treemap from the Chart tool - nested rectangles sized and placed by a hook, with the template only printing the shapes it was handed](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dtreemap%26full&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=at2-hooks-d3-treemap&try=1)

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
  // The transform path - for on-device utilities with a `file` input. Read the
  // picked file's bytes and return the transformed file: { bytes, mime, filename }.
  // Bypasses the DOM render/export pipeline entirely. See the `file` input above.
}

function exportStill({ node, format, opts, host }) {
  // Own a raster still the 8-bit DOM raster cannot originate - 16-bit or HDR PNG,
  // OpenEXR, Radiance. Called before host.export.render; `opts` carries depth/hdr/
  // width/height/dpi. Return { bytes, mime } to short-circuit the export to those
  // bytes (computed in float, via host.codec), or null to decline and fall through
  // to the normal path for that format.
  return null;
}

function onFrame({ frame, model, host }) {
  // Live camera (v1.4). Runs once per webcam frame so the render reacts to motion.
  // `frame` = { width, height, data (RGBA Uint8ClampedArray), t }. Read pixels
  // synchronously; return a patch like onInput. See "Motion-reactive tools" below.
  return { svgContent: traceFrame(frame, model) };
}
```

Declared hooks must be flagged in the manifest's `hooks` object (`{ "onInit": true, ... }`) - a manifest with no `hooks` object never loads hooks.js at all, and the flags are what validation and shell affordances (e.g. the transform-download wiring for `exportFile`) read.

### Shared helper regions (`community/_shared/`)

hooks.js must stay **self-contained** (no `import`/`require` - tools are data), so helpers that several tools need (the filter overlay block, `canRaster`, `loadImage`, `esc`, `clamp`, `safeColor`) are maintained once in `community/_shared/*.js` and copied byte-for-byte into each consumer between marker comments:

```js
// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===
```

Never hand-edit inside the markers: edit the canonical file, run `npm run sync:shared` and `npm run validate:catalog` fails on any drift. See `community/_shared/README.md`.

### Motion-reactive tools (`onFrame`)

Declare an `onFrame` hook and your tool can react to a **live camera** - the shell shows a "Go live" toggle wherever a camera is available (`host.media`), and the runtime drives `onFrame` once per frame. This is **pure progressive enhancement**: `onFrame` is never called where there's no camera, so the tool still works as an ordinary still-image tool. **Do not** add `camera` to `capabilities` - that would *require* a camera and hide the tool where there isn't one.

A frame carries raw pixels (`frame.data`, RGBA), so the usual move is to wrap them in a canvas the still pipeline already understands and reuse it:

```js
function onFrame({ frame, model }) {
  const c = document.createElement('canvas');
  c.width = frame.width; c.height = frame.height;
  c.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
  return { svgContent: build(c, inputsFrom(model)) }; // same builder as onInit/onInput
}
```

Keep it cheap - `onFrame` isn't time-boxed, but the runtime drops a frame if the previous one is still rendering, so an expensive per-frame render just lowers the frame rate. The `filter` tool's effects are the reference (halftone/scanline/posterise/duotone); pixel-tracers wrap the frame as above, while the SVG-filter duotone hands the frame back as a data-URL image instead.

### Recording tools (`render.capture` + `onLevel`)

Set `render.capture` and the tool grows a **record** button that captures the user's mic, camera or screen to a file - the audio/video counterpart to the `file` transform path. Four modes:

- `"audio"` - **mic only** (a voice recorder). Also shows a live input-level meter when the tool declares an `onLevel` hook.
- `"video"` - **camera only, silent** (no mic track).
- `"av"` - **camera + mic** (a talking-head recorder - use this, not `"video"`, when the clip needs sound); the shell also mounts an audio-level + background-noise coaching HUD.
- `"screen"` - **display capture** (engine v1.54). The shell mounts a Screenshot + Record pair and the browser's own picker chooses the screen, window or tab, so the tool never names or sees a target it wasn't handed.

Recording prompts for a device permission, so - unlike the live-camera `onFrame` path - it **is** a gated capability: declare `"microphone"` for `audio`, `"camera"` for `video`, **both** for `av` and `"screen"` for `screen`. The tool is then unavailable on shells that can't record (the headless CLI provides no `host.recorder`). The recorded bytes reach the user through the transform path (`host.export.file`, never watermarked) or become a template asset a compositing tool wraps.

```json
"render": { "width": 1080, "height": 1080, "formats": ["png", "svg"], "capture": "audio", "actions": ["download", "save"] },
"capabilities": ["microphone"],
"hooks": { "onInit": true, "onLevel": true }
```

**The `onLevel` hook - a live VU meter / sound check.** Declare it and the runtime drives it once per audio-level sample (from the pre-record meter, and again during the take), exactly like `onFrame` drives a camera frame - drop-overlap, not time-boxed. It returns a patch like `onInput`:

```js
function onLevel({ level, model, host }) {
  // `level` is an AudioLevel (below). Return a patch the template renders.
  return { barPct: Math.round(Math.min(1, level.rms / 0.5) * 100), tooHot: level.clipping };
}
```

An **`AudioLevel`** is `{ rms, peak, dbfs, clipping, t }` - `rms` (0–1 loudness, the value a VU bar tracks), `peak` (0–1 instantaneous), `dbfs` (peak in dB; `0` = clip, `−∞` = silence) and `clipping` (true while peak sits at the "too hot" threshold, ~0.99). Engine **v1.19** adds four optional background-noise cues (feature-detect - `undefined` on shells that don't compute spectral levels): `noiseFloor` (dBFS floor in the quiet gaps), `snr` (dB signal-to-noise; ≲15 dB = a noisy room), `hum` (0–1 share of energy in the mains bands - electrical hum / ground loop) and `hiss` (0–1 spectral flatness - broadband fan/HVAC hiss). The noise cues are trustworthy only from the **raw** meter (the sound-check runs the mic with noise-suppression/AGC off); a recording session runs them on for a clean file, so its floor reads artificially low.

`voice-recorder` (`capture: "audio"` + `onLevel` coaching), `top-tail-recorder` (`capture: "av"`) and `screencap` (`capture: "screen"`, declaring `["screen", "microphone"]`) are the reference tools; the `host.recorder` bridge (`meter` / `record`) is documented in [Host API](/info/host-api.html).

**What you can call:**
- Everything on `host.*` your manifest's `capabilities` allows.
- Pure JS computation.

**What to stay away from:**
- `window`, `document`, `fetch`, `localStorage`. Hooks are loaded via `new Function` with `host` injected as closure scope - a **portability contract, not a sandbox** - so in a browser shell these globals *are* technically reachable. But leaning on them ties your tool to browser shells (it breaks headless in the CLI) and will break outright when hooks move into Worker isolation. `host.*` is the only supported surface. (Browser-only paths like the `onFrame` canvas trick above are the deliberate exception.)
- Importing other modules. Hooks are loaded as a single source string, so `import` doesn't work.
- Slow work. Async hook results are time-boxed (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile` 10s) and a result that arrives late is discarded; a synchronous overrun can't be preempted and just gets logged as a warning.

### Transcribing audio (`render.transcribe`)

Engine **v1.150**. Point at an audio/video input and a text input, and the shell mounts the whole speech-to-text affordance for you - consent for the one-time on-device model download, a background job whose toast owns progress and cancel, and one undoable write into the target input:

```json
"render": {
  "width": 1920, "height": 1080, "formats": ["png", "srt"],
  "transcribe": { "source": "clip", "target": "captions", "format": "srt", "auto": "autoCaption" }
}
```

- **`source`** - id of the `asset` input holding the clip. While it is empty the button is disabled and says why.
- **`target`** - id of the `longtext` (or `text`) input the result is written into. One write, so one undo.
- **`format`** - `"srt"` (default) or `"vtt"` for numbered subtitle cue blocks, or `"words"` for the plain spoken text, one cue per line, no timestamps.
- **`auto`** - optional id of a `boolean` input. While it is on, a freshly recorded or freshly picked source runs with no click. The consent sheet still appears the first time the model is not on-device.

Everything runs locally: the clip is decoded and read on the device, and nothing is uploaded. A clip with no speech writes an **empty value** and says so - never invented text. The declaration is feature-detected, not capability-gated, so a shell without on-device speech (the headless CLI) mounts nothing and leaves the target input exactly as the URL or the saved session set it. Pair it with a `template.srt` / `template.vtt` sibling (see [Data formats](#data-formats-json--csv--ics--vcf)) to export the cues as a sidecar file.

### Newer optional host APIs (feature-detect)

The bridge grows by **addition**: new `host.*` APIs arrive in minor engine versions, are never removed and are optional - an older shell simply doesn't have them yet. Feature-detect and degrade. If your tool genuinely can't work without one, raise the manifest's `engineVersion` floor instead (e.g. `">=1.60"`) - the engine refuses to load a tool whose range excludes the running version, which fails clearer than a missing method would. Recent additions:

- **`host.images`** - on-device image decode / resize / re-encode: the "HEIC to JPEG, compress to WebP, downscale" utility shape as a first-class API. Bytes (or a Blob) in, encoded bytes + dimensions out; `decode` reports EXIF-oriented dimensions and a MIME type sniffed from the bytes; `resize` never upscales; `encode` converts to `webp` / `jpeg` / `png` (it reads more formats than it writes); an animated source flattens to its first frame. Read the *result's* `mime`/`width`/`height` rather than assuming the request was honoured exactly - a shell may fall back (e.g. PNG where WebP encoding is unsupported). Not gated by a `capabilities` flag: `if (host.images) …` and degrade where it's absent. Everything runs locally; the bytes are never uploaded.
- **`host.geom`** (v1.64) - exact vector geometry: path booleans (`union` / `intersect` / `difference` / `xor` over an array of paths, plus `selfUnion` for the canonical form of one), `offset`, `stroke` (a stroked path in, a filled outline out), `simplify`, `fromNodes` + `continuity` (pen-tool node lists with handles and a continuity constraint) and measurement (`bounds`, `area`, `contains`, `winding`, `nearest`, which reports the contour / curve / `t` to split at). The currency both ways is an **SVG path-data string** - the thing already in your template, your state and your URL - with `parse` / `toPathData` exposing whole cubics for callers that want to walk the curves. Nothing flattens or samples: results stay real Béziers. **Failures are returned, not thrown** - every method answers `{ ok: true, … }` or `{ ok: false, code, message }`, so `if (!r.ok) …` and render something sensible; a throw out of a hook would only be logged and discarded, leaving your tool silently unresponsive. The `code` tells you what to do: `'invalid-path'` (malformed `d` - reject it), `'too-large'` (past the parse ceilings, which `limits()` reports), `'limit'` (the answer exists but this engine won't guess at it past its bounded-work ceiling - retry with simpler operands or a coarser `tolerance`), `'invalid-argument'`, `'unsupported'`. `ok: true` with `d: ''` is an **answer** - a legitimately empty region (a non-overlapping intersection, an over-shrunk offset) - not a failure. Path data is parsed defensively, so a pasted or URL-supplied `d` is safe to hand straight in. Feature-detect `host.geom`.

  ```js
  function onInput({ model, host }) {
    if (!host.geom) return {};                      // older shell: leave the path alone
    const values = Object.fromEntries(model.map(i => [i.id, i.value]));
    const cut = host.geom.difference([values.shape, values.hole]);
    if (!cut.ok) return { pathError: cut.code };     // never silently wrong
    const outline = host.geom.stroke(cut.d, 4, { cap: 'round', join: 'round' });
    return { shapePath: cut.d, outlinePath: outline.ok ? outline.d : '' };
  }
  ```
- **`host.text.fontUrl(family, { weight?, italic? })`** - resolve a font *family* the host knows (brand statics, user-uploaded faces, on-device Google Fonts, the platform face) to a fetchable font file usable as `fontUrl` in `host.text.toPath()` / `preload()`. A variable face comes back with the `variations` (e.g. `["wght=700"]`) needed to reach the requested weight - pass them through to `toPath()`, which otherwise shapes the default instance. Resolves `null` when no file can be found for the family, so keep your `<text>`/CSS fallback. Feature-detect `host.text?.fontUrl`.

## Network access (`host.net`)

Tools are offline-first: by default a tool gets no `host.net`, so it has no supported way to reach the network (per the hooks note above, that's a review-enforced contract, not a sandbox - yet). A live-data tool (weather, status, an RSS ticker, an iCal feed) opts in with two manifest declarations - the capability, and an explicit allowlist of what it may fetch:

```jsonc
"capabilities": ["network"],
"network": {
  "allowlist": [
    "https://api.example.com/*",
    "https://example.com/status.json"
  ]
}
```

The allowlist rules:

- **`https` only.** Entries are full URLs; plain `http` never validates.
- **A bare entry allows that exact URL only** - byte-for-byte, query string included.
- **A trailing `/*` makes an entry a prefix wildcard** - `https://api.example.com/*` allows everything under that path. The wildcard must follow a path separator (`/*`, never a bare `*`), so a prefix can't bleed into a lookalike host: `https://api.example.com*` would also match `https://api.example.com.evil.io/`.
- **1-32 entries.** Small by design - name the endpoints you actually call.
- **Fail-closed everywhere.** No `network` block, or a URL no entry matches, means every `host.net.fetch` rejects - identically in the web shell, offscreen batch/gallery renders, the CLI and the TUI. The host applies the allowlist per mounted tool; nothing a hook does can widen it. Response bodies are also size-capped (64 MB), so a wrong or compromised endpoint can't stream unbounded bytes into memory.

In hooks, `host.net.fetch` is an ordinary `fetch` - just gated:

```js
async function onInit({ model, host }) {
  try {
    const res = await host.net.fetch('https://api.example.com/v1/status');
    if (!res.ok) return { statusText: 'unavailable' };
    return { statusText: (await res.json()).status };
  } catch {
    return { statusText: 'offline' }; // the tool must still mount without a network
  }
}
```

Keep fetches inside the hook time budget (`onInit` 5s, `onInput` 2s), return template-ready extras and always render something sensible when the fetch fails - a network tool that renders blank offline is a bug, not a constraint.

## Composition (`composes`)

A tool can embed **another tool's rendered output** as an image instead of re-implementing it. Declare it in the manifest and reference it in the template like any asset - no hook code, no copy-paste.

```jsonc
// tool.json
"capabilities": ["compose"],
"composes": [
  { "id": "badgeQr", "tool": "qr-code", "format": "svg",
    "inputs": { "url": "{{url}}", "color": "#0c322c", "join": true } }
]
```
```handlebars
{{!-- template.html - guard it: composition can fail gracefully --}}
{{#if badgeQr}}<img src="{{asset badgeQr}}" alt="">{{/if}}
```

- Each entry renders `tool` with `inputs` and exposes the result under `id` as an `{{asset <id>}}` extra (the same store hook-computed values use).
- String `inputs` values are **Handlebars**, hydrated against your tool's own context (its input values + extras), so a child input can bind to a parent value - e.g. `"url": "{{url}}"`.
- `format` (defaults to the child tool's first declared format, `render.formats[0]`) fixes the child render; `width`/`height` (px) default to the child's native size. **Compose any tool's render: an `svg` child stays a true vector when the parent exports to SVG or PDF and rasterises crisply for PNG; raster children (`png`, `jpg`/`jpeg`, `webp`) embed as images.** `svg` is the only format wired declaratively today (`event-name-badge` composes `qr-code` as `svg`) and is the best-supported. The enum also lists `pdf`, but a **PDF child is not supported as a source** - nothing inlines a PDF blob, so don't set `format: "pdf"`. HTML / Markdown / plain-text composition is **not** supported.
- The composed value is a **normal asset URL**, so it works in a CSS `url()` background just as well as in an `<img src>` - bring another tool in exactly like a library image.
- The child renders through the **same engine path** (pixel-identical) and is never watermarked or provenance-stamped (it's an intermediate). Recursion is **depth- and cycle-guarded**: `a → b → a` fails gracefully and the slot stays empty, so always `{{#if}}`-guard the reference.
- Works wherever the shell can render the child to bytes; the lean CLI composes `svg` children. The mechanism is `host.compose` - see [Host API](/info/host-api.html).
- **End users get this too, without a manifest.** Any `asset` input can take a pasted Lolly tool link (see [`asset` - library or device upload](#asset--library-or-device-upload) above); the host renders it through the same `host.compose` path. `composes` is for renders *you* wire into the layout; the pasted-link path is for the user to choose which tool fills an image slot.

### Composition depth and baking

Nesting is capped at **3 levels** - a tool composing a tool composing a tool. A deeper chain fails the same way a cycle does: gracefully, with an empty slot. When a design genuinely needs to go deeper, **bake** the inner render: tick *Freeze as a static image* in the picker's render card. A baked image is a frozen copy - self-contained bytes that consume **no** nesting depth and never live-re-render - so it won't update when the source tool changes. Its slot shows a "❄ baked from …" row with a **Re-bake** button (and an Edit path into the source tool's inputs) that re-renders on demand, so a stale copy is one click from fresh.

## Brand logo (auto-switching)

The catalog ships the SUSE logo as **8 variants** under `suse/logo/` - `{hor|vert}-{neg|pos}-{green|white|black}` (`hor`/`vert` = wide vs stacked; `neg` = for **dark** backgrounds, `pos` = for **light**; `green` is the brand mark, `white`/`black` are the high-contrast mono pair). A tool shouldn't hard-code one - it should pick the variant that fits the current background and space, and use the **actual SVG image** (this is distinct from `brand-lockup`, which renders the wordmark from the SUSE font, outlined via HarfBuzz `host.text`).

The pattern: a hook chooses the id, resolves it with `host.assets.get()` and hands the template a ready `<image>`/`<img>`:

```js
// hooks.js - WCAG luminance decides neg/pos; orientation + ink come from inputs.
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
<!-- template.html - the actual SVG asset, not a font lockup -->
{{#if logo}}<image href="{{asset logo}}" .../>{{/if}}   <!-- inside an <svg> → true vector export -->
{{!-- or, in an HTML canvas: --}}
{{#if logo}}<img src="{{asset logo}}" alt="Logo">{{/if}}
```

Putting the `<image>` inside an `<svg>` lets the export inline it (data-URI) and emit **true vector SVG**; an `<img>` in an HTML canvas exports raster/PDF only. `tools/tool-logo/` is the reference implementation (background colour, orientation, brand/mono, transparent-bg export). Reusing this in another org: keep the structure and swap the `suse/logo/...` id prefix for your own logo namespace (same variant matrix).

## Brand overlays (`extends`)

A brand pack that only needs to tweak a community tool - a different template, a handful of re-worded translations - shouldn't carry a whole fork that silently drifts from its base. Instead, declare the brand's tool dir an **overlay**:

```json
// brands/<brand>/tools/<id>/tool.json - same id as the community tool
{
  "id": "color-palette",
  "extends": "community",
  ...
}
```

and keep **only the files that differ** in the overlay dir. When `scripts/use-profile.ts` builds the `tools/` view, that tool's view dir becomes the per-file union of the base (`community/<id>/`) and the overlay (`brands/<brand>/tools/<id>/`):

- **Overlay wins** on any filename collision; everything else comes from the base.
- Composition recurses **one level** into subdirs (`i18n/`, `assets/`) - files there union per-file too; anything nested deeper is taken wholesale from the winning side.
- The `extends` field is **stripped from the composed `tool.json`**, so the engine, shells and catalog scripts always see a plain tool. That one file is materialised (a real file, not a symlink) - edit the pack source, not the view copy; every other composed file keeps normal write-through symlinks in local (symlink) mode, and the Vercel copy mode composes identically.
- Overlay and base **share the same tool id** (ids are permanent contracts; the view path `tools/<id>/` never changes), so the overlay's `tool.json` doubles as the marker carrier even when it's otherwise identical to the base's.

**Fail-closed:** a declared overlay whose base is missing (`community/<id>/tool.json` doesn't exist), an `extends` value other than `"community"` (the only base pack in v1) or an `extends` declared on a community tool itself fails the profile build loudly - even in `postinstall --auto` - and is also rejected by `npm run validate:catalog`. You never get a silent partial tool. The composed result is validated like any other tool, since the validator runs against the `tools/` view.

## Publishing

There are two ways a reusable starting point ships - pick per context:

- **In the app, no build step.** In the open Lolly app, **Save** a [Design](/info/using.html) doc as your own **template** or **variation** and it joins that tool's "New from template" chooser on your device - no `tool.json`, no catalog build, no git. Share it as a `.lolly` file for anyone to import, or submit it for catalog inclusion. Anyone using the open version can do this; it's the fastest path to a personal or team starting point. (A saved template is a values seed under an existing tool; authoring a wholly new *tool* - its own manifest, icon and formats - is the catalog route below.)
- **Into a catalog, for a shared library.** To publish a hand-authored tool into a catalog that many people sync - the model an organisation *can* manage as a Git repo so every change gets review and an audit trail (an option, not a requirement) - add the folder and rebuild the index:

1. Place your folder under `tools/`.
2. Run `npm run build:catalog` - this regenerates `catalog/tools/index.json` from
   the manifests (don't hand-edit the index; it's generated) and refreshes asset
   checksums.
3. Run `npm run validate:catalog` to confirm the catalog is consistent.
4. Build & deploy the catalog. The shell picks it up on next boot.

For development:

```bash
npm run dev:web
# open localhost - your tool appears in the gallery
```

### Try it without the monorepo

You do not need the full clone to run a tool you wrote. Zip the tool folder and drop the zip on [lolly.tools](https://lolly.tools) or any Lolly instance. The drop sheet offers **Install this tool**; take it and the tool installs on that device and opens. Zipping the folder and zipping its contents both work, because a single top-level folder is stripped. Nothing is uploaded: the zip is read in the page, and the files go to the same device-local store a `.lolly`'s carried tool uses.

Your `hooks.js` is code that runs in the page, so the install asks the same **Trust this tool?** consent a `.lolly` asks, and you should read a stranger's tool before you accept it. Drop an edited zip again and Lolly offers to replace your copy, which is the loop to use while you iterate. An id the catalogue already lists is refused rather than installed, because an installed tool never shadows a catalogue one, so give yours its own id.

When it works, open a pull request against [`lolly-tools`](https://github.com/lolly-tools/lolly-tools), the small public repo of community tools. To test hooks without a browser, install the tool-author SDK from npm:

```bash
npm i -D @lolly-tools/core
```

It exports `createMockHost`, an in-memory host bridge a plain node test can drive, `validateTool`, the same manifest check the catalog CI runs, and the `HostV1` types for your editor. It depends only on `ajv`, so nothing from the platform comes with it. The package [README on npm](https://www.npmjs.com/package/@lolly-tools/core) walks a four-file tool through that test.

### Sharing a tool without a catalog (`.lolly`)

Neither route above helps if you have no catalog to build into and no repo to push to. The third path is the share file: open your tool, choose **Share → Download .lolly** and tick **Include the tool**. The file then carries `tool.json`, `template.html`, `styles.css`, `hooks.js`, `icon.svg`, whichever sibling text templates the declared formats call for and the sidecar for the active language, all alongside the design, so it opens on a device that has never seen the tool. The checkbox arrives ticked for any tool the deployment's signed catalog doesn't list, which is the state of anything you just authored (and of every tool on a build that signs nothing).

The thumbnail and anything under your tool's `assets/` are picked up from the signed catalog's own file list, so an unsigned build packs neither. If your tool is going out this way before it is ever published, inline its art in the template rather than referencing `/tools/<id>/assets/…`, which would 404 on the recipient's device.

**Their consent is what stands between your `hooks.js` and their device.** On import Lolly asks **Trust this tool?** - naming the tool, naming you as its author when the file carries your details, and saying that opening it runs the tool's own code on their device - with **Trust & install** as the way through. Decline and your design still arrives in their Projects, waiting there for the day they have the tool. Two things to author for:

- **Classic `hooks.js` only.** A manifest declaring `hooks.module` is refused at install, so a module-code tool cannot travel this way yet.
- **Nothing re-verifies your tool on the far side.** A sideloaded tool loads outside the recipient's signed-catalog check, and the file's own checksums only prove your bytes arrived intact. Their decision at that dialog is the whole control, so keep a hand-shared tool's hooks short enough for a careful recipient to read.

The end-user view of the same file - what it carries, what it asks and what happens on a decline - is [Sharing your work](/info/using.html#sharing-your-work), and the boundary itself is a row in the [Threat Model](/info/threat-model.html).

## Localizing a tool

A tool's user-facing strings live in the manifest (English by default). To translate it, add an `i18n/<lang>.json` sidecar - a sparse, flat, dotted-path overlay of just the strings a translator touched:

```json
// tools/your-tool-id/i18n/de.json
{
  "name": "…",
  "description": "…",
  "inputs.headline.label": "…",
  "inputs.headline.help": "…",
  "inputs.size.options.a4": "…"
}
```

The same sidebar, opened with `?lang=de`: labels, help text and select options all come from the sidecar, and the tool code is untouched.

![The QR tool's sidebar in German - every label, hint and dropdown option translated by the i18n sidecar](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Flang%3Dde%26url%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-inputs&dark=1&filename=auth-tool-localized)

When a tool loads with a language set (the reserved `lang` URL/CLI param, or the user's profile language), the engine best-effort fetches the matching `i18n/<lang>.json` and merges it onto the manifest **before any shell or the input model sees it** - one overlay point, every shell (web, CLI, TUI) benefits. Anything missing - no sidecar, an absent key, a malformed file - falls back to the manifest's English, so a translation gap never breaks a tool load. Keys cover `name`, `description`, `a11yLabel`, per-input `label` / `help` / `placeholder` / `section` / `suffix` / `options.<value>` (block and vector sub-fields as `inputs.<id>.fields.<fieldId>.…`) and the walkthrough (`guide.title`, `guide.tracks.<id>.label` / `.note` / `.steps.<index>`). `validate:catalog` checks the keys, so a typo is caught at build time rather than silently ignored.

- **Pre-fill the user's language.** An input can declare `bindToProfile: "lang"` to seed from the active language (a canonical short code - `en`, `de`, `ar`, …).
- **Right-to-left.** Arabic and other RTL languages mirror the whole UI. Author your template and CSS so they mirror too - prefer logical properties and `[dir]`-aware rules over hard-coded left/right - and the shell sets document direction from the active language.

## Example tools

- `tools/color-palette/` - one input per simple type (`color`, `select`, `number`, `boolean`) with `onInit`/`onInput` deriving the palette - the tool shown in the input-types section above
- `tools/qr-code/` - uses `hooks.js` (`onInit`/`onInput`/`beforeExport`) to encode the QR matrix; composed as an `svg` child by `event-name-badge`
- `tools/quotes/` - multi-input form with `longtext`, `select` and `asset` inputs with `allowUpload: true` (personal-image library)
- `tools/meeting-planner/` - `blocks` input for repeating rows; `onInit`/`onInput` shaping; ICS data export
- `tools/color-block/` - advanced `blocks`: typed `addMenu` discriminator + `showFor` / `multilineFor` heterogeneous rows
- `tools/wayfinding-signage/` - `blocks` rows that auto-shrink label text to fit (or show a sponsor image), and a `size` select that drives the print page size; CMYK export
- `tools/tool-logo/` - auto-switching brand logo: a hook picks the right `suse/logo/` SVG by background/orientation; true vector SVG export
- `tools/digi-ad/` - video/gif output with `render.video` timing config
