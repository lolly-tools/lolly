# Tool inputs

Choose input types, visibility, profile prefills and common meanings.

Part of [Authoring Tools](/info/authoring-tools.html).

## Input types

Each declaration becomes a real control, built by the shell from the input model - you never write the UI. `qr-code` declares 45 inputs, and `showIf` shows only the ones that apply to the chosen payload, so a web address gets the sidebar below.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

![The QR tool's sidebar - a URL field, two colour swatches, an error-correction dropdown, a quiet-zone slider and a joined-modules toggle, all generated from the manifest](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-inputs&dark=1&filename=auth-input-controls)

| Type             | What it produces                                          | UI control          |
|------------------|-----------------------------------------------------------|---------------------|
| `text`           | string                                                    | text input          |
| `longtext`       | string                                                    | textarea            |
| `number`         | number                                                    | input or slider     |
| `boolean`        | boolean                                                   | checkbox            |
| `color`          | string (hex)                                              | color picker; `palette: "colourway-leads"` offers the design system's colourway leads (see below) |
| `select`         | string (one of `options[].value`); an option may carry `width`/`height`/`unit` to set the export page size | dropdown            |
| `asset`          | `AssetRef` object (id, url, type, etc.)                   | host-provided asset picker |
| `date`           | ISO date string                                           | text input in the sidebar; native date field in the Batch grid |
| `time`           | `HH:MM` string                                            | time input          |
| `datetime-local` | ISO datetime string                                       | flatpickr datetime picker |
| `url`            | string                                                    | text input          |
| `blocks`         | array of objects (repeating field groups)                | add/remove/reorder row editor |
| `vector`         | object `{ fieldId: number }` (a fixed set of numbers)    | one row of zoom x/y controls |
| `file`           | a `FileRef` (the user's own file: `name`/`mime`/`size`/`bytes`) | file picker (on-device utilities) |
| `table`          | `{ columns: string[], rows: string[][] }` - a user-defined grid where the column headings AND rows are data (unlike `blocks`, whose fields you declare) | minimal grid editor with spreadsheet paste (TSV / Markdown / CSV), copy-out and a pop-out floating window |

For existing flat `blocks` inputs, `tableColumns: ["place", "label", "annotation"]` opts into this same editor, with fixed headings in the requested field order (remaining fields follow). Objects, row ids and positional URL encoding stay unchanged. All fields must be scalar; nested or conditional blocks keep their block editor. Timezone is the reference. Paste accepts matching field ids or labels as spreadsheet headers, or a plain city list in the first column.

A `color` input with `"palette": "colourway-leads"` offers the design system's colourway leads as its swatches: every colourway's lead colour in the artefact's look, canonical first, each labelled with the colourway's name. Add `"swatchesOnly": true` to hide the free picker so a person can only choose a lead. A chosen lead is stored as a plain colour, not a token link. With fewer than two colourways the field offers the design system's ordinary palette, so the input works the same on every design system. Any other `palette` value is read as a palette asset id; the field does not read that asset yet and offers the ordinary palette.

A `table` input is the batch-creation primitive: paste a table copied from Excel / Google Sheets / Notion / Slack / Markdown and it replaces the whole grid; the Copy button writes TSV *and* a real HTML `<table>` back to the clipboard so the round trip into collaboration tools is lossless. Cells can hold whole paragraphs. Pair it with [`render.paginate`](/info/tool-manifest.html#the-render-block) and each row becomes a page. In URL mode the entire table is ONE compact param; in the CLI, `--<inputId>-data=table.csv` fills it from a CSV/TSV/Markdown file.

Four declarations of four different types are four different controls. The first four inputs of `color-palette` are a `color`, a `select`, a `number` and a `boolean`; its other seven sit in the folded **Contrast** and **Output** sections.

![Colour Palette's sidebar - a swatch trigger, a harmony dropdown, a shades slider and a neutrals switch, one control per declared type](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3D%25232563eb%26harmony%3Dtetrad-4%26steps%3D9&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=%23tool-inputs&walker=1&dark=1&filename=at2-input-types-palette)

`text` and `longtext` differ only in the declaration, and the shell picks the control: a single-line field for one, a sized textarea for the other. `prompt-card`'s prompt is a `longtext`.

![The prompt field in Prompt to Image - a tall textarea holding many lines, produced by nothing more than type longtext](/t/url-shot?url=%2F%23%2Ftool%2Fprompt-card&width=1440&height=900&dpi=192&waitMs=2000&css=%23tool-canvas%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.input-row%3Ahas%28%5Bdata-input-id%3D%22text%22%5D%29&dark=1&filename=at2-input-longtext)

The three moment types (`date`, `time`, `datetime-local`) are real input types with real controls. `certificate` declares a `date`, and `meeting-planner`, `calendar-ics` and the calendar payload of `qr-code` declare `datetime-local`.

### `showIf`

Any input can declare `showIf` to render only while other inputs hold given values. One object is every pair required, and a value may be a list of accepted values:

```json
{ "id": "lineWidth", "type": "number", "showIf": { "renderMode": "vector", "chartType": ["line", "area"] } }
```

An array of such objects renders when any one of them matches, for the conditions a single map cannot say ("a vector bar, or a 3-D bar scene"):

```json
"showIf": [
  { "renderMode": "vector", "chartType": ["bar", "bar-horizontal"] },
  { "renderMode": "scene", "sceneType": "bar3d" }
]
```

A `select` option can carry its own `showIf` with the same shape, so a choice the current mode cannot honour is not offered. The option that is currently selected always stays offered, marked not applicable, so a saved session or a shared link never changes meaning when the sidebar is rebuilt.

All of this is a visibility overlay on the sidebar. URL params, hooks, the CLI and validation see every input and every option regardless, and a hidden input keeps its value. Chart is the reference: its render modes park the previous mode's type, so most of its controls gate on both. `validate:catalog` checks that every id a `showIf` names is a declared input.

### `bindToProfile`

Any input can declare `bindToProfile: "firstname"` (or `email`, `headshot`, etc). When the tool mounts, it pre-fills from the user's profile. They can override per-session.

## Input properties

Every input needs `id` and `type`. The `id` is the template variable and the URL parameter, and never changes once published. Any input can also carry these:

| Property | What it does |
|---|---|
| `label`, `help`, `placeholder` | The control's label, the text behind its info button, and the hint inside an empty field. |
| `notice` | Fine print always shown above the control, for what a person should read before typing, such as a consent note on a value that triggers a network lookup. |
| `default` | The starting value. |
| `required` | Marks an input that should not be left empty; the export preflight warns when it is. |
| `section` | The folded sidebar section the control sits in. |
| `group` | A free-form grouping tag. The reserved value `export` moves the input out of the sidebar into the export panel. |
| `urlKey` | A short URL alias (`textColor` becomes `tc`). Links carry it forever, so never rename or reuse one. See [URL Mode](/info/url-mode.html). |
| `showIf`, `bindToProfile` | Conditional visibility and profile pre-fill, above. |
| `bindToMeta` | Writes the value into the export's metadata and Content Credentials as `author`, `contact`, `description`, `copyright` or `license`. |
| `sharePrivacy` | `"personal"` keeps the value out of generated links until the person has reviewed the value. See [Personal values in links](/info/authoring-tools.html#personal-values-in-links). |
| `attachTo` | Draws the control inside a sibling input's row, for a compact modifier such as a fit toggle on an image slot. |
| `matchExportFormat` | On an `asset` or `file` input: the default export format follows the uploaded file's format until the person picks one. |
| `dataSource` | Adds **Add data**: the person picks a CSV, JSON, text, Markdown or XLSX file, or a catalog text asset, and its content fills the field. |

Some properties belong to one type:

| Type | Extra properties |
|---|---|
| `text` | `minLength`, `maxLength`, `pattern`; `display: "curve"` for a tone-curve value |
| `longtext` | `maxLength`, `rows` |
| `number` | `min`, `max`, `step`; `display: "slider"`; `rangeWhen` for slider bounds that change with another input |
| `color` | `palette`, `swatchesOnly` (see above) |
| `select` | `options`; `display: "icon-toggle"` or `"segmented"` |
| `asset` | `assetType`, `allowUpload`, `filter` (see [Assets and file utilities](/info/tool-files.html)) |
| `file` | `accept`, `maxSize`, `multiple` (see [Assets and file utilities](/info/tool-files.html)) |
| `table` | `columnEditors` (`text`, `url` or `emoji` for each column); `tableEditor` for a full table editor with typed columns (`agenda`) |
| `blocks`, `vector` | See [Structured inputs and canvas controls](/info/tool-structured-inputs.html) |

## Canonical inputs (reuse shared ids)

**Batch** (`#/batch`, the web shell's batch mode) is a **spreadsheet grid** that renders many rows at once across one or many tools - CSV/TSV round-trip and spreadsheet paste in, a `.zip` of per-row outputs out, with collapsible export columns and saved batch sessions. Because it lays every selected tool's inputs out as a grid, the `id`/constraint choices you make below directly shape that grid.

Batch lays every selected tool's inputs out as a grid. **It keys each column by input `id`** - so two tools that call the same concept by the same id collapse into *one* column, and if they also agree on type + constraints (number `min`/`max`/`step`, select options, color palette), that column becomes **bulk-writable**: the user types one value and it fills every row. Diverge on the id (or the constraints) and you get a separate, cell-by-cell column instead. So picking a shared id is a real UX decision, not a style preference.

To make this the default path, the blessed ids and their constraints live in **`schemas/canonical-inputs.json`**. When your tool needs one of these concepts, copy the id (and constraints) verbatim:

| Concept | Canonical id | Type |
|---|---|---|
| First name | `firstname` | `text` |
| Last name | `lastname` | `text` |
| Headline | `heading` | `text` |
| Sub-headline | `subheading` | `text` |
| Body copy | `body` | `longtext` |
| Call to action | `cta` | `text` |
| Ink / foreground colour | `color` | `color` |
| Background colour | `background` | `color` |
| Primary image · portrait · backdrop | `image` · `headshot` · `bgImage` | `asset` |
| Background image dimming | `bgOpacity` | `number` (0–1, step 0.01) |
| Zoom + pan an image | `imageFraming` | `vector` `{ zoom, x, y, rotate, pitch, yaw }` (declare only the fields you use) |
| How the image fills its frame | `imageFit` | `select` (`cover` / `contain`) |
| Crop rectangle that sets the output size | `imageCrop` | `vector` `{ x, y, w, h }` (percent) |
| Window buttons on a framed window | `windowStyle` | `select` (`cupertino` / `redmond` / `nuremberg`) |
| Event name · location | `eventName` · `eventLocation` | `text` |
| Event start · end | `eventStart` · `eventEnd` | `datetime-local` |
| Course or award · award date | `awardtopic` · `awarddate` | `text` · `date` |
| Source author | `sourceAuthor` | `text` |

Conventions: per-element typography numbers are `<element>FontSize` / `<element>FontWeight` (weight `100`–`900` step `100`), e.g. `headingFontSize`, `bodyFontWeight`.

Labels are *advisory* - show whatever label fits your tool; the Batch header just uses the first non-empty one, and bulk-write only cares about id + type + constraints. Adding a genuinely new shared input? Add it to `schemas/canonical-inputs.json` first, then adopt it - `pnpm run validate:catalog` emits a **warning** (never an error) when a tool uses a canonical id with a divergent type or constraints, so drift stays visible.

[Back to Authoring Tools](/info/authoring-tools.html).
