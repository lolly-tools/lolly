# Tool manifests

`tool.json` is the one file Lolly reads to know what a tool is: its name, what people can change, which files it can export and how it appears in the gallery. This page is the field reference. Look up the field you need; [Build a tool](/info/authoring-tools.html) shows a complete small manifest first.

## The manifest (`tool.json`)

Every manifest is validated against `schemas/tool.schema.json`. Seven fields are required:

| Field | What it holds |
| --- | --- |
| `id` | Lowercase and hyphen-separated. It **never changes** once published, because links, saved sessions and the CLI all address the tool by its id. |
| `name` | The name people see. |
| `version` | SemVer. Bump it on every change. |
| `engineVersion` | The SemVer range of engines the tool runs on, such as `"^1.0.0"`. An engine outside the range refuses to load the tool. |
| `status` | `official`, `community` or `experimental`. Experimental tools **watermark their exports by default**; the caller can turn the watermark off, and on-device tools never get one. |
| `render` | At minimum `{ width, height, formats }`. See [The `render` block](#the-render-block). |
| `inputs` | The input declarations. See [Tool inputs](/info/tool-inputs.html). |

The schema does not require `description`, `category` and `tags`, but give every tool all three: the gallery's About card reads the description, and search and filters use the other two.

None of these fields stay private to the repository. The About card is the manifest read back to whoever is deciding whether to open the tool: name, category and status from identity, the export chips and canvas size from `render`, the version and a `capabilities` line whenever the tool declares any.

![The About card for the Filter tool, listing its exports grouped as vector, raster and video chips, its 1080 by 1080 canvas and its version, all read straight from the manifest](/t/url-shot?url=%2F%23%2F%3Ftool%3Dfilter&width=1440&height=1200&dpi=192&waitMs=2200&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&format=svg&walker=1&cropSelector=.meta-dialog-body&dark=1&filename=at2-manifest-about-card)

### Listing and identity

- `listed` - boolean, default `true`. Whether the tool appears in the gallery listing: the grid, search, favourites and the featured and utility strips. Set `false` for a tool that is a mechanism reached from context rather than a place someone browses to, such as `asset-export`, which opens from **Download** on an asset in Assets. An unlisted tool still loads through `#/tool/<id>`, URL mode and the CLI.
- `featured` - `{ blurb?, order? }`. Its presence, even as `{}`, puts the tool in the gallery's **Featured** row. `blurb` is the one-line hook shown over the tile, and `order` sorts the row in ascending order; tools without one follow in catalog order.
- `new` - boolean. Keeps the gallery's **New** badge on the tool. Without it, newness comes from catalog order: the most recently added tools wear the badge, and it expires as later tools ship.
- `deprecated` and `replacedBy` - retire a tool gently. The id stays a permanent contract, so saved links and sessions still open the tool. A deprecated tool must also be `listed: false`, which the validator checks, and `replacedBy` gives the successor's id, which must exist in the same profile.
- `a11yLabel` - the accessible description of the rendered output. The preview canvas reaches screen readers as one `role="img"`, and this is its label. It is a Handlebars string filled with the current input values, so it stays accurate while the person edits: `"QR code linking to {{url}}"`. Use `{{default x "fallback"}}` for empty inputs. Without it the label is `"<name> preview"`. Keep it short and factual, because it replaces the canvas contents for a screen-reader user.

`templates` and `galleryArt` are on [Tool templates and presets](/info/tool-starters.html), `extends` on [Composition and brand overlays](/info/tool-composition.html) and `designTool` on [Design tool contract](/info/design-tool-contract.html).

### What the tool needs from the host

- `requires` - the optional `host.*` APIs your hooks call **without** checking for them first, such as `["text", "tokens"]`. The runtime refuses to mount the tool on a shell that lacks one, before any hook runs, and the gallery greys the tool out there. An API you check for (`if (host.text)`) is a progressive enhancement and must not be listed. `node scripts/tool-requires.ts --write` reads `hooks.js`, writes the list and raises `engineVersion` to the release that added the newest API you depend on; `validate:catalog` warns when the manifest and the hooks disagree.
- `capabilities` - device abilities, from `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `ffmpeg`, `wasm`, `capture`, `compose` and `screen`. The host exposes the matching APIs only to tools that declare them, and shells use the list to label or disable a tool they cannot serve. A tool without `network` cannot call `host.net.fetch`; a tool that uses [`composes`](/info/tool-composition.html) declares `compose`; a tool that records through `host.recorder` declares `microphone`.
- `network` - `{ "allowlist": [...] }`, the https URLs `host.net.fetch` may reach. No allowlist means no fetch. See [Network access](/info/tool-hooks.html#network-access-host-net).
- `hooks` - boolean flags for `onInit`, `onInput`, `onFrame`, `onLevel`, `beforeExport`, `afterExport`, `exportFile` and `exportStill`. Any `true` flag means `hooks.js` must define that function. The list is closed: the schema rejects any other hook name. [Tool hooks and host capabilities](/info/tool-hooks.html) covers each hook.
- `privacy` - `"on-device"` marks a utility that processes the person's own file entirely on the device. The tool shows the **Runs on your device - nothing is uploaded** badge, may never be `experimental` and exports no provenance metadata and no watermark. [Assets and file utilities](/info/tool-files.html#producing-output-the-exportfile-hook-privacy-on-device) owns the details.
- `isolate` - boolean. Asks the shell to run a built-in tool's hooks in a Worker. See [Run hooks in a Worker](/info/tool-hooks.html#run-hooks-in-a-worker-isolate).
- `singleInstance` - boolean. Set `true` when only one copy of the tool can run on a page, for example a tool that holds a WebGL context or keeps a handle on `window` (the 3D viewers, `spatial-photo`, `synth`). Multi-edit then shows its cells as still previews one after another instead of live copies. The single-tool view, URL mode and the CLI are unaffected.
- `composes` - embed another tool's render as an image. Requires the `compose` capability. See [Composition and brand overlays](/info/tool-composition.html).

### Design-system behaviour

- `designVersion` - a published design-system version slug, or `latest`, that the tool renders against. Unlike `engineVersion` it is not enforced at load: a version this device does not have falls through to the active version, then to the newest. `?designv=` overrides it for one render.
- `tokenAxes` - keeps the tool on the canonical option of a kind of theme group, for a tool whose colours are its content. See [Colours that are the content](#colours-that-are-the-content).

## The `render` block

Most of what `render` declares reaches people in one place: the export popup. Formats, page size and unit, the **Convert paths** toggle and the Content Credentials card all come from keys below.

![The export popup - format and size fields, a Convert paths toggle and a pre-ticked Content Credentials card](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Foptions&width=1440&height=900&dpi=192&waitMs=2200&css=.export-popup%7Bwidth%3A360px!important%7D&walker=1&format=svg&cropSelector=.export-popup&dark=1&filename=auth-export-popup)

`render` carries `width`, `height` and `formats`. The `render.formats` enum in `schemas/tool.schema.json` is the authority on the format ids, which cover vector, raster, print, document, motion, audio, data and font output; [URL Mode](/info/url-mode.html) says what each id produces. The optional keys follow, grouped by what they change.

### Export controls

- `actions` - the action buttons to show, from `copy`, `download`, `save` and `share`. Default `['copy','download','save']`.
- `export` - set `false` for a utility or interactive tool with no export. The download, copy, format and size bar disappears, and **Save** shows only when the tool has inputs.
- `filenameFrom` - input ids whose current values name the exported file, slugified in order (`ana-kovac`, or a URL's host and path). The tool name is the fallback when every listed value is empty, and the Batch grid builds each row's file name from the same inputs. `qr-code` and `certificate` declare one.
- `dims` - set `false` to hide the export size fields.
- `units` - default `true`. Set `false` to offer **pixels only**: the physical unit selector (`mm`, `cm`, `in`, `pt`) and the DPI field disappear, so an on-screen pixel is an exported pixel. Use it for screen assets and favicons, where a print size would contradict the true raster resolution.
- `convertPaths` - default `true`. A tool that exports a vector format gets a **Convert paths** toggle that outlines text to paths in SVG, PDF and PDF CMYK, so the file renders the same without the fonts installed. Set `false` to never outline, as a capture tool (`url-shot`) or a camera effect (`filter`) does.
- `transparentBg` - default `false`. Adds a **No BG** toggle to the export bar. The engine adds it to the input model, so hooks can react in `onInit` and `onInput` (`chart`).
- `c2pa` - default `true`: Content Credentials are on unless someone turns them off. The card in the export popup starts ticked for every format that can carry one (`pdf`, `png`, `apng`, `jpg`, `gif`, `svg`, `tiff`, `cmyk-tiff`, `webp`, `mp4`, `webm` and zip members). The file is signed on the device, so viewers report an unverified credential unless the person has [enrolled an identity](/info/content-credentials-identity.html). Set `false` to opt the tool out; `privacy: "on-device"` tools are always off. A `?c2pa=` link or saved value overrides this for one export.
- `aspectWarning` - `{ min?, max?, message }`. An amber caution in the export popup when the chosen page aspect (`width ÷ height`) falls outside the bounds. It guards against a size that breaks the layout and never appears in the output. `multi-page-pdf` declares `{ "max": 1, "message": "…" }` for portrait only.
- `preview` - `{ format?, auto? }`. For a tool whose live canvas is a placeholder until an explicit, expensive render runs, such as a capture tool that screenshots a page in `beforeExport`. The shell adds a `[data-preview]` control, and `auto: true` renders one frame on load. `url-shot` declares one.
- `video` - `{ wait?, duration? }` in seconds, default `1` and `5`. Capture timing when `webm`, `mp4`, `gif` or `apng` is among the formats (`lottie-digi-ad`).

### Layout and sidebar

`layout` decides what surrounds the canvas.

| `layout` | What people see | Reference |
| --- | --- | --- |
| `sidebar` (default) | The input sidebar beside the canvas. | `qr-code` |
| `canvas` | No sidebar: the tool fills the working area. A single `file` input becomes a drop zone on the canvas. | `strip-data` |
| `editor` | No sidebar. A free-canvas editor where boxes are selected, dragged, resized, rotated and snapped. The render canvas and export controls stay. | `design`, `org-chart` |
| `document` | No sidebar. A multi-page rich-text editor with a formatting ribbon on the canvas. The render canvas and export controls stay. | `doc-studio` |
| `deck` | Keeps the sidebar and adds an on-canvas slide editor with a thumbnail rail. | None in `community/` yet; `deck-studio` uses the default layout with `paged` |

In all five, the data stays flat and expressible as URL parameters, so the CLI and URL mode render exactly what the editor shows.

::: details How the editor, document and deck layouts work
- **`editor`** drives one `blocks` input whose rows carry `canvas` geometry (x, y, width, height and rotation). The shell provides the pasteboard: boxes dragged past the artboard stay visible and selectable, faded outside the frame, which keeps its shadow as the export boundary. Exports stay bounded by the canvas in every format, and the template does nothing to opt in. The `canvas` keys are on [Structured inputs and canvas controls](/info/tool-structured-inputs.html#editor-canvas-connectors-grid-fixed-size-canvas-connect-grid-fixedcanvas).
- **`document`** drives one `blocks` input (`content`) of content blocks: heading, text, lolly and table. The editor offers paragraph styles H1 to H4, bold, italic, lists and colour, per-block width, alignment, move and delete, click-to-edit text and rich HTML paste that becomes headings, lists and tables. **Pagination lives in the tool's hook**: blocks flow into fixed-size `[data-pdf-page]` boxes, the paged export `multi-page-pdf` also uses, so the CLI and URL mode render the same document with no editor.
- **`deck`** mounts a live overlay over one `blocks` input whose rows are slides, so a slide's text, colour and images can be edited in place. Edit mode renders one active slide plus small thumbnails to keep the page light, and the overlay restores a full-deck render before export.
:::

- `sidebar` - default `true`. Set `false` when the template edits its own inputs on the canvas (`sandbox`). The inputs stay in the synced input model (URL, saved sessions, collaboration, CLI) but get no sidebar, and a tool that exports keeps its export controls.
- `webPreview` - default `false`. For a web-page tool with no export: the preview becomes a real viewport that fills the pane's width, reflows when the pane resizes and scrolls, instead of a scaled artboard (`jump`, `scan-code`).
- `urlSync` - default `true`. Set `false` to keep live edits out of the address bar. Explicit URL inputs and generated share links still work, and local recovery uses the session slot.
- `denseSections` - `input.section` labels whose short controls the web sidebar lays out two to a row. A presentation hint only: the input model, URL encoding and every headless render are untouched, and the grid falls back to one column on a narrow panel or with large text.
- `sectionIcons` - maps an `input.section` label to a shell icon name, drawn before the label on the folded section head. A tool with many sections (`chart` declares seventeen) can then be scanned by glyph as well as by word. Same contract as `denseSections`: an unknown icon name draws nothing, and the CLI and TUI ignore the map. Give each section an icon from the shell registry, keep a section's fields consecutive and put primary content before secondary settings. Translated section captions keep their icon and density.

### Live camera

These keys apply only to tools with an `onFrame` hook; others ignore them.

- `liveMaxEdge` - the longest edge, in pixels, of the camera frame handed to the hook. The shell scales the camera down to a small default that suits a vector trace, so a raster effect (the `filter` tool's pixel-stretch) raises it for sharper output. The shell never upscales past the native camera frame, and caps the value at its own ceiling. `liveMaxEdgeInput` points at a number input whose value overrides it, so resolution can be a slider that re-applies to the live stream.
- `liveDefault` - an animated SVG catalog asset the shell plays as a moving subject when no camera is in use (`filter`).
- `liveFacing` - the camera that opens first: `user` (front, the default) or `environment` (rear).
- `liveCameraWhen` - `{ input, value }`. Starts the camera while that input holds that value and stops it otherwise (`scan-code` in camera mode).

### Print and pages

`width` and `height` are in the export's unit, and physical units come with a DPI; [Reserved URL parameters](/info/url-parameters.html) covers `unit`, `dpi`, bleed and marks in links. PDF exports a true page size. The CMYK formats (`pdf-cmyk`, `cmyk-tiff`) pair with **Convert paths** for print files that need no installed fonts. A `select` option can carry `width`, `height` and `unit` to set the export page size from a dropdown, as `wayfinding-signage`'s **Sign size** does.

- `printMarks` - unset by default. The print-finishing card (crop marks, registration marks, bleed) is offered for print-capable formats; its master toggle starts off for RGB vector output (`pdf`, `svg`, `eps`) and on for the separating press formats (`pdf-cmyk`, `cmyk-tiff`, `eps-cmyk`). Set `true` to declare print intent, which turns the card on by default for every print-capable format. Set `false` to remove the card, the usual choice for a multi-page document, whose output is a paginated RGB document rather than one marked plate. Physical units alone never turn marks or bleed on: an explicit `bleed=` or `marks=` link, a toggle or declared print intent does.
- `paged` - default `false`. Marks a multi-page tool that lays out several `[data-pdf-page]` boxes. The gallery shows each page as its own preview slide instead of example looks.
- `paginate` - `{ "source": "<tableInputId>" }`. The engine paginates for you: it fills your template once per row of the named `table` input and wraps each in its own `[data-pdf-page]` box. Author one page. `battlecards` is the reference: a hook-free, one-card template that turns any pasted table into a multi-page PDF.
- `filmstrip` - `"left"` (default) or `"bottom"`: the edge the page thumbnail rail of a `paged` tool runs along. Use `bottom` for wide pages that are few in number, such as cards or slides, where a left rail takes width the page needs. `battlecards` uses `bottom`.
- `pages` - `{ count, width, height, gap?, min?, max? }`. Turns an `editor` tool into a **multi-page canvas**, the social-carousel pattern: a horizontal strip of same-size page frames, with boxes placed across all of them. Box coordinates stay one flat, global array; the hook works out which page each box belongs to and emits one `[data-pdf-page]` frame per page, so headless renders match and export fans out to a multi-page PDF or one still per page. Requires `layout: "editor"` and `paged: true`. Each property holds the id of the number input its value comes from.

::: details What `paginate` gives each page
Each filled page gets a `page` object:

- `page.index`, `page.number` and `page.count`.
- `page.first`: the row's first cell, the natural page title.
- `page.cells`: `[{ column, value, col }]` for every column. `col` is the cell's original column index, stable even when the template shows only some columns.
- `page.fields`: the cells after the first, labelled with the person's own column headings.
- `page.byColumn`: the trimmed, lower-cased column name mapped to the row's cell, for lookups such as `{{lookup page.byColumn "icon"}}`.

A template can make any cell editable on the canvas by stamping it `data-cell="{{page.index}}:{{col}}"`. Add `data-cell-md` when the cell holds Markdown rendered with `{{{markdown value}}}`, so edits go back into the table as Markdown; without it the cell edits as plain text. A click-to-pick image slot takes `data-cell-pick="{{page.index}}"` plus `data-pick-column="Icon"` for the column it writes to (created if absent) and an optional `data-pick-tag="icon"` catalog tag filter. Pair `paginate` with `paged: true` for the scrolling all-pages canvas and filmstrip.
:::

::: details How a multi-page PDF is built
A template marks its page boxes with `data-pdf-page`. Each marked element becomes one true PDF page, sized to its own CSS box, so a cover, content that flows across pages and a back page render as real pages rather than one tall image. Pages are drawn as vectors with text outlined to paths, and the document can carry an open `password`. Without any `[data-pdf-page]` box the export falls back to the single-page renderer. The multi-page path skips print finishing, so pair it with `printMarks: false`. `multi-page-pdf` is the reference layout: a cover, flowing `blocks` content and a back page.
:::

The recording key (`capture`) and the speech-to-text key are on [Tool hooks and host capabilities](/info/tool-hooks.html), and `portable` is on [Templates and rendering](/info/tool-rendering.html#animated-html).

## Opening catalog assets (`openWith`)

An optional `openWith` array lets Assets offer your tool as a place to edit an asset. Each entry has a permanent `id`, the asset `types` it accepts, optional lowercase `formats` and a `binding`. The whole selection must match. Leave out `multiple` for one source; set it to `true` only when the tool can receive the selection in one session. Animated rasters need `animated: true`, a promise to keep their animation.

For an ordinary tool input, bind its id:

```json
{
  "openWith": [
    {
      "id": "source-photo",
      "types": ["raster"],
      "formats": ["png", "jpg", "jpeg", "webp"],
      "binding": { "kind": "input", "input": "image" }
    }
  ]
}
```

The binding must point at an `asset`, `file`, `text` or `longtext` input, and file limits and acceptance filters still apply. A `multiple` binding must point at a `file` input that declares `multiple: true`. Opening creates a fresh tool session. Asset references keep their names, versions and attribution, and file bytes stay transient under the normal file-input rules.

Editor bindings use adapters the shell supports: `canvas` places image references on a blank canvas, `timeline` places timed media and opens Sequence and `text` uses the Text editor's source-aware handoff. The declarations hold no route strings or executable methods. A tool without `openWith` stays valid and never appears through a guessed binding, and the web shell checks the loaded manifest again before opening.

Declaring an export format in `render.formats` does not claim the tool can convert any file into that format. Conversion in Assets is a separate feature.

::: details What Convert in Assets offers
Assets also offers **Convert**, which lists the transformations the source and the device support before showing their settings. That list comes from concrete file operations, separately from `openWith` and `render.formats`. An on-device utility conversion keeps its watermark and provenance policy. PDF page splitting produces a ZIP of static single-page PDFs, and PDF page rendering produces a ZIP of PNG images. Their fidelity notes and refusal conditions appear before conversion.
:::

## Colours that are the content

A design system can offer several colourways, and a person picks one per piece in the tool sidebar's **Design system** section. Every colour a tool links to the design system follows that choice, which is what most tools want. A tool whose colours are its content, such as a tonal ramp or a palette pinned to a dataset, can opt out:

```json
{ "tokenAxes": { "colourway": "ignore" } }
```

The keys are the kinds of theme group in [What a theme group means](/info/design-tokens.html#what-a-theme-group-means): `mode`, `colourway`, `expression`, `medium`, `contrast`, `density`, `campaign` and `brand`. The only value is `"ignore"`. For each kind it ignores, the tool renders in that group's canonical option whatever a link, a saved session or the design system's stored choice asks for, and the sidebar does not offer that group in this tool.

The pin covers every colour the render reads, so a print export uses the CMYK or spot build the design system authored for the canonical option. `"mode": "ignore"` keeps a print piece in the canonical look; in a design system with no `mode` group, its light and dark themes with no group count as the mode.

When a link or the CLI asks for an option the tool ignores, `lolly run` prints a `THEME_CHOICE_IGNORED` warning and an MCP render adds the same sentence to its warnings, so the request is never dropped silently. Engines older than the field refuse a manifest that declares `tokenAxes`, so raise `engineVersion` to the release that added the field, as listed in `engine/CHANGELOG.md`.

A switch redraws the mounted tool in place, with no reload. Linked colours and `var(--brand-*)` variables follow by themselves. A hook that keeps colours it read from `host.tokens` reads them again when `onInput` runs with `id: '__tokens'`, as [When the theme or colourway changes](/info/tool-hooks.html#when-the-theme-or-colourway-changes) shows.

::: details How Lolly decides which theme groups a tool offers
The sidebar offers a group only when switching it changes what the tool draws, so a tool that never reads a colour a group changes needs no field: the group does not appear. Lolly works this out from the tool's own files and its current values.

The colours a tool reads are the canvas variables its template, styles, hooks and portable presentation use (`var(--brand-primary)` and the rest), the token references its inputs link and the references its hooks pass to `host.tokens.resolve`. A reference a hook finishes at run time, such as `'{asset.logo.' + variant + '}'`, counts every token under its fixed start.

A hook that reads the colour list or the token set, a reference built from no fixed start, module hooks and a tool that composes another tool all count as reading every token, so every group that changes a token stays. A treated picture counts as changing with every choice, because a photo look can keep a variant per theme. Declare `tokenAxes` when the tool does read the colours a group changes and must still keep its own.
:::

## Example looks (`examples`)

A tool ships one gallery preview, but `examples` lets its tile show range: an array of example input values, each rendered live on the device through the same off-screen path an export takes, as a horizontally scrolling preview strip. When the tool is `featured`, the looks also cross-fade in the hero row. Each look is cached, so later visits are instant. Leave `examples` out when one preview says enough.

```jsonc
"examples": [
  { "label": "Launch teal",  "values": { "heading": "Ship today", "background": "#0c322c" } },
  { "label": "Reverse mark", "theme": "dark", "values": { "ink": "mono" } }
]
```

- **Key `values` by input `id`, never by `urlKey`.** Example values seed the runtime the way batch rows do, by input id only. A `urlKey` belongs to URL transport, so a value keyed by one would render the tool's default look, and the validator reports an error. When you copy a compact share link into an example, translate each short key back to its input id.
- `label` records the look's intent and is not shown to people. `theme` (`light` or `dark`) is only for looks that draw ink on a **transparent** background, such as a reverse logo; the clashing theme leaves that look out of the strip. Leave it out when the look draws its own background.
- `width` and `height` in `values` set that example's preview size, even when the tool declares no such inputs.
- An `asset` value must be a **reference object**, never a bare string: `{ "source": "library", "id": "your/asset/id", "_unresolved": true }`, optionally with a `?theme=` suffix on a themable icon id. A `blocks` value is an array of row objects keyed by the block's field ids.

`pnpm run validate:catalog` checks every look. `values` keys must be declared input ids, with a pointed error that gives the right id when a `urlKey` is used. Catalog asset references must exist, and a `?theme=` suffix must be a real icon theme. Blocks row keys must be declared fields. The validator also warns when a tool declares looks but no format the gallery can show (`svg`, `png`, `jpg`, `jpeg`, `webp`), and when a strip has more than 8 looks: each look is a live render, so keep to a handful of different ones.

The older alias `featured.variants` still renders but is deprecated. Write `examples`.

## A short walkthrough (`guide`)

Some tools are not finished when the render is. An email signature is finished when it is pasted into the mail app's settings, and nothing on the canvas shows that step. `guide` is a few steps for that last stretch. The shell shows them in a dialog behind a help button beside the tool's name, and opens the dialog once by itself the first time a device opens the tool.

```jsonc
"guide": {
  "title": "Put it in Gmail",
  "tracks": [
    {
      "id": "desktop",
      "label": "On a computer",
      "steps": [
        "Open **Export**, set the format to **HTML** and press **Copy**.",
        "In Gmail, open **Settings** and choose **See all settings**.",
        "Paste into **General → Signature**, then press **Save Changes**."
      ],
      "note": "Outlook and Apple Mail take the same paste."
    },
    { "id": "mobile", "label": "On a phone", "steps": ["…"] }
  ]
}
```

- **One track per route someone might take**, such as a computer and a phone. One track renders as a numbered list; two or more render as tabs, so the alternative is visible. Up to four tracks of eight steps each.
- **Steps are plain text.** `**bold**` is the only markup, for the control a step points at; everything else is escaped. Link to the docs from a step when the long version is what people need, because the guide is a nudge, not documentation.
- **A track `id` is a contract, like an input id.** Translation keys are built from it (`guide.tracks.<id>.label`, `.note` and `.steps.<index>`, plus `guide.title`), so renaming one orphans its translations.
- Point at controls the shell has. If a step says "set the format to HTML", keep `html` in `render.formats`.
