# Tool manifests

Declare identity, rendering, examples and a short walkthrough.

Part of [Authoring Tools](/info/authoring-tools.html).

## The manifest (`tool.json`)

Validated against `schemas/tool.schema.json`. Required fields:

- `id` - lowercase, hyphen-separated, **never changes** once published
- `name`
- `version` - SemVer; bump on every change
- `engineVersion` - SemVer range, e.g. `"^1.0.0"`
- `status` - `official` | `community` | `experimental`. Experimental tools **watermark exports by default** (the runtime applies it unless the caller overrides that choice). This is the positive counterpart to the `privacy: "on-device"` "no watermark" rule below.
- `render` - see [The `render` block](#the-render-block) below. At minimum `{ width, height, formats }`.
- `inputs` - array of input declarations (see [Tool inputs](/info/tool-inputs.html))

Strongly recommended but not schema-required: `description` (the gallery's About card reads it), `category` and `tags`.

Optional:

- `requires` - the optional `host.*` APIs your hooks call **without** feature-detecting them: `["text", "tokens"]`, say. The runtime refuses to mount the tool on a shell that lacks one, before any hook runs, and the gallery greys it out there. An API you guard (`if (host.text)`, `host.text?.toPath(...)`) is progressive enhancement and must not be listed. You do not have to maintain this by hand: `node scripts/tool-requires.ts --write` reads your `hooks.js`, writes the list, and raises `engineVersion` to the minor that introduced the newest API you depend on; `validate:catalog` warns when the manifest and the hooks disagree.
- `capabilities` - `["network", "filesystem", "clipboard", "camera", "microphone", "ffmpeg", "wasm", "capture", "compose", "screen"]`. Device abilities rather than bridge APIs (that is `requires`, above). Required for the host to expose those APIs to your tool, and what shells use to gate/label the tool where a capability can't be fulfilled. Tools without `"network"` cannot call `host.net.fetch` - and a `"network"` tool must also declare *which* URLs (see `network`, next); tools that use [`composes`](/info/tool-composition.html) declare `"compose"`; a tool that records audio through `host.recorder` declares `"microphone"`.
- `network` - `{ "allowlist": [...] }`. The https URLs `host.net.fetch` may reach, for tools with the `"network"` capability. Fail-closed: no allowlist, no fetch. See [Network access](/info/tool-hooks.html#network-access-host-net).
- `examples` - example input value-sets that demonstrate the tool's range, rendered live as the gallery tile's preview strip. See [Example looks](#example-looks-examples).
- `listed` - boolean, defaults `true`. Whether the tool appears in the gallery listing: the grid, search, favourites and the featured/utility strips. Set `false` to **unlist** a tool that is a *mechanism* invoked from context rather than a destination someone browses to - `asset-export`, reached from the per-asset **Download** in Assets, is the only unlisted tool in the SUSE pack. An unlisted tool still loads normally via `#/tool/<id>`, URL mode and the CLI; unlisting only removes it from the listing.
- `new` - boolean. Forces the gallery's **New** badge on this tool regardless of catalog position. Newness is otherwise inferred from catalog order - the most-recently-appended tools wear the badge and it self-expires as later tools ship - so set this to keep a tool flagged after it drops out of that trailing window.
- `privacy` - `"on-device"`. Marks a content-transform utility that processes the user's own file entirely on the device. Shows the "Runs on your device - nothing is uploaded" badge; enforces (validated) that the tool is never `experimental` and (at runtime) that exports carry no provenance metadata and no watermark. See [file inputs](/info/tool-files.html) and [the `exportFile` hook](/info/tool-hooks.html).
- `hooks` - `{ onInit?, onInput?, onFrame?, onLevel?, beforeExport?, afterExport?, exportFile?, exportStill? }` boolean flags. If any are true, you must ship `hooks.js` with the matching functions. (`exportFile` is the transform path - file bytes in → transformed bytes out; `exportStill` lets a tool own a raster still at a bit depth the 8-bit DOM raster cannot originate (16-bit/HDR PNG, OpenEXR, Radiance); `onFrame` makes the tool react to a live camera; `onLevel` makes it react to live audio levels while recording - all covered in [Tool hooks](/info/tool-hooks.html).) The list is exhaustive and the schema sets `additionalProperties: false`, so a hook name that is not here is rejected at validation rather than accepted and silently ignored.
- `composes` - embed another tool's render as an image (see [Tool composition](/info/tool-composition.html)). Requires the `"compose"` capability.
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
- `liveMaxEdge` - integer px. For `onFrame` (live camera) tools only: the requested longest edge of the working camera frame handed to the hook. The shell downscales the source camera to a small default that suits a vector trace, so a raster-output effect (the `filter` tool's pixel-stretch) raises this for sharper output. The shell clamps it to the native camera frame - it never upscales - and to its own ceiling, and ignores it for tools without `onFrame`. A companion `liveMaxEdgeInput` points at a number input whose value overrides it, so the resolution can be a user-facing slider (re-applied to the live stream on change).
- `c2pa` - defaults **`true`** (Content Credentials are **opt-out**). The **Content Credentials** card in the export popup is pre-checked for every stampable format (`pdf`, `png`/`apng`, `jpg`, `gif`, `svg`, `tiff`/`cmyk-tiff`, `webp`, `mp4`/`webm`, zip members), so the finished file gets a signed C2PA manifest (on-device key, so viewers report it as an unverified credential). Set `false` to opt a tool out. Forced **off** for `privacy: "on-device"` tools, which must never embed provenance into a user's own file. A `?c2pa=` link/save value overrides this per export.
- `dims` - set `false` to hide the export dimension inputs in the download bar.
- `aspectWarning` - `{ min?, max?, message }`. An **editor-only** amber caution shown in the Export popup when the chosen page aspect (`width ÷ height`) falls outside `[min, max]` (either bound optional). It's purely a guard against picking a size that breaks the layout - it never appears in the exported output. `multi-page-pdf` declares `{ "max": 1, "message": "…" }` (portrait-only).
- `denseSections` - an array of `input.section` labels whose short controls the web sidebar lays out two to a row. A presentation hint only: the input model, URL encoding and every headless render are untouched, and the grid drops back to one column on a narrow panel or under large text.
- `sectionIcons` - a map from an `input.section` label to the name of a shell icon, drawn before the label on the folded section head so a tool with many sections (`chart` declares sixteen) can be scanned by glyph as well as by word. Same presentation-only contract as `denseSections`: an unknown icon name draws nothing, and the CLI and TUI ignore it. Give each authored section an icon from the shell registry. Keep fields in a section consecutive, with primary content before secondary settings. Localized section captions retain their icon and density associations.

**Physical units & print.** `width`/`height` are values in the export's `unit` (`px` default, or `mm`/`cm`/`in`/`pt`), and `dpi` sets raster resolution for physical units. PDF exports a true page size; the CMYK formats (`pdf-cmyk`, `cmyk-tiff`) pair with the `convertPaths` outlining toggle to produce print-ready, fonts-not-installed output. A `select` option can also carry `width`/`height`/`unit` to drive the export page size from a dropdown - e.g. `wayfinding-signage`'s **Sign size** select (A4/A3/A2… in mm) sets the printed page proportions when chosen.

- `printMarks` - unset by default: the print-finishing card is offered for the print-capable formats, but its master toggle starts **off** for RGB vector output (`pdf`/`svg`/`eps`) and on only for the separating press formats (`pdf-cmyk`/`cmyk-tiff`/`eps-cmyk`). Set `true` to **declare print intent** - the card then defaults on for every print-capable format. Set `false` to opt a tool out of the card entirely (crop/registration/bleed marks). Multi-page PDF tools set `false` because their output is a paginated RGB document, not a single marked plate. Physical units (`mm`/`cm`/`in` + `dpi`) alone never enable marks or bleed - an explicit `bleed=`/`marks=` link, a user toggle or declared print intent does.
- `paged` - defaults `false`. Marks a multi-page document tool (one that lays out several `[data-pdf-page]` boxes, like `multi-page-pdf`); the gallery renders each page as its own horizontally-scrollable preview slide rather than input-variant examples.
- `paginate` - `{ "source": "<tableInputId>" }`. **Engine-driven pagination**: the runtime hydrates your template once per row of the named `table` input and wraps each hydration in its own `[data-pdf-page]` box - you author ONE page and never manage pagination, page counts or loops. Each hydration's context gains a `page` object: `page.index`/`page.number`/`page.count`, `page.first` (the row's first cell - the natural page title), `page.cells` (`[{ column, value, col }]` for every column - `col` is the cell's original column index, stable even when the template renders only a subset), `page.fields` (cells minus the first - the labelled body fields, whose labels are the user's own column headings) and `page.byColumn` (trimmed lower-cased column name → the row's cell, for by-name lookup: `{{lookup page.byColumn "icon"}}`). A template can opt any rendered cell into the web shell's on-canvas editing by stamping it `data-cell="{{page.index}}:{{col}}"` (add `data-cell-md` when the cell holds markdown rendered with `{{{markdown value}}}` - edits round-trip back to markdown in the table input; without it the cell edits as plain text), and can offer a click-to-pick image slot with `data-cell-pick="{{page.index}}"` plus `data-pick-column="Icon"` (the column written to, created if absent) and optional `data-pick-tag="icon"` (catalog tag filter). Pair with `paged: true` for the scrolling all-pages canvas and filmstrip. `battlecards` is the reference tool: a hook-free one-card template that turns any pasted table into a multi-page PDF, one card per row.
- `filmstrip` - `"left"` (default) or `"bottom"`. Which edge a `paged` tool's slide-sorter thumbnail rail runs along. `left` is a vertical rail beside the canvas, right for tall documents; `bottom` is the deck-strip shape, for tools whose pages are wide and few (cards, slides), where a left rail eats the width the page needs. `battlecards` uses `bottom`.
- `pages` - `{ count, width, height, gap?, min?, max? }`. Turns an `editor`-layout tool into a **multi-page canvas** (the social-carousel pattern): the shell sizes the canvas to a horizontal strip of N same-size page frames and the free-canvas overlay places boxes across all of them. Box coordinates stay one flat, global, URL-expressible array; the tool's hook derives which page each box belongs to and emits one `[data-pdf-page]` frame per page, so headless CLI/URL renders match and export fans out (multi-page PDF, or one still per page). Requires `layout: "editor"` and `paged: true`. Each property holds the input id the geometry is read from (`count`/`width`/`height` are number inputs), so the shell stays generic.

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

`pnpm run validate:catalog` checks every look: `values` keys must be declared input ids (a urlKey gets a pointed error naming the right id), catalog asset refs must exist (and any `?theme=` suffix must name a real icon theme), blocks-row keys must be declared fields. It also warns when a tool declares looks but no gallery-displayable format (svg/png/jpg/jpeg/webp), and when a strip exceeds 8 looks - each look is a live render, so keep it to a handful of genuinely different ones.

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

[Back to Authoring Tools](/info/authoring-tools.html).
