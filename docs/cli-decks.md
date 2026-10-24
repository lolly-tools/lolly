# Rebuild a deck from the terminal

An old deck needs to become your design system's own, and you want a script or an agent to do the work. The CLI has the same deck reader, slide composer and checks as the app, so the result matches what a person would get there.

There are two routes:

- **Renovate in place** with `lolly rebrand`. Colours, fonts and the logo snap to the design system, decoration and page furniture come out and the content carries over. Choose this to keep the deck's own layout.
- **Rebuild in Design.** Read what the old deck holds, compose new slides from the design system's slide master, then package, check and export them. Choose this when the deck should look like your other new decks.

::: figure cli-decks-routes
Both routes start from the old deck and end in a file the app opens.
:::

The deck verbs are also MCP tools over the same code ([The same verbs over MCP](#the-same-verbs-over-mcp)), and each one prints its own flags, inputs and exit codes with `--help`.

## Renovate in place with lolly rebrand

`lolly rebrand` reads a deck someone else made (`.pptx`, `.pdf` or Photoshop `.psd`) and works in three stages, so an agent or a script can look at the first pass before anything is written:

```bash
lolly rebrand plan old.pptx --plan-out=plan.json
# writes plan.json (every object's proposal and review state) and plan.report.json (the counts)

lolly rebrand compile old.pptx --plan=plan.json --export=pptx
# writes old.lolly (a Design document), old.report.json and old.rebranded.pptx

lolly rebrand inspect plan.json --source=old.pptx
# a summary, the review queue and per-slide states; --slide=<n> lists one slide's objects
```

The plan is plain JSON (`schemas/rebrand-plan-v1.schema.json`). Between the two calls, an editor, a script or an agent can change a row: drop a slide, keep a photo, map a colour to another design-system token. `compile` takes exactly the plan it is handed. The plan records the source deck's hash, so compiling it against a different deck is refused.

The app's Rebrand view does the same work with a review screen, and two flags give you its bulk actions:

- `--accept-suggestions` answers every unreviewed row, like **Accept all suggestions**; `=all` also answers rows that need attention.
- `--auto-match` sets each slide's layout from the structure it reads as, like **Auto-match layouts**: `=clear` takes only clear reads, `=likely` adds likely ones and a bare flag or `=all` takes every slide. It never changes a layout a person or a preset set, and the `--json` envelope counts the slides it set per band under `autoMatched`.

Each deck ends `ready`, `needs-review` or `failed`. `compile` exits `5` when every deck compiled but at least one needs review, `4` on a refused plan or an existing output and `2` on a usage error ([Exit codes](/info/cli-reference.html#exit-codes)).

::: details Folders, presets and longer runs
- `lolly rebrand plan|compile <dir>` works through every deck a folder holds; `--recursive` adds its subfolders, mirrored in the output. A PDF beside a `.pptx` of the same name is left out.
- `--jobs=<n>` runs up to eight decks at once in worker threads. `--keep-going` records a failed deck and moves on.
- `--resume` keeps a run record beside the outputs (`.lolly-rebrand-run.json`), so a second call redoes only the decks that still need work.
- `--preset=<id|file.json>` applies a renovation preset: a design system's or a person's default decisions. It resolves from the content profile first and then from `rebrand-presets.json` in the state directory; `lolly rebrand presets` lists what resolves.
- `--dry-run` runs every stage and writes nothing. `--ocr` reads slides that are pictures of slides, using the text recognition model already on this machine.

Every stage reads the content profile's design system (`LOLLY_PROFILE`) and touches no network. The full stage reference, the object classes and the plan-editing rules for an agent are in the [agent skill's Rebrand reference](/info/skills/lolly/reference/rebrand.md), and [Rebrand a deck](/info/rebrand.html) explains the ideas the CLI and the app share.
:::

## Rebuild in Design: the seven commands

These commands take an old deck to a checked, exported PowerPoint file. The sections below explain each step.

```bash
lolly read old.pptx --json --media=./media > old.inventory.json
lolly system context --json > brief.json
lolly compose --suggest --source=old.pptx --output=spec.json
lolly compose spec.json --source=old.pptx --output=deck.json --edits-out=edits.json
lolly package deck.json --source=old.pptx --label="Quarterly review" --output=review.lolly
lolly check review.lolly --source=old.pptx --edits=edits.json
lolly run review.lolly --export=pptx --output=review.pptx
```

`read` and `check` need no catalog, so both run on a standalone CLI.

## Read the old deck

`lolly read <deck>` reads a `.pptx`, a PDF or a Photoshop `.psd` (or `-` for standard input) with the same reader rebrand uses. For each slide it gives:

- the text in reading order, each frame with its role (title, subtitle, body, label, caption, page number or footer) and its runs (bold, italic, colour, font, weight and size);
- the speaker notes, with paragraphs and line breaks kept apart;
- the pictures with their placement and crop, and tables and charts as data;
- the class of every object, so decoration can be told from content.

With `--json` the envelope's `result` is the inventory (`schemas/content-inventory-v1.schema.json`); without it, an outline goes to standard output.

`--media=<dir>` writes each distinct picture once, named by its SHA-256 (`<sha256>.<ext>`). A file already there with the same bytes is reused; one with other bytes is refused with exit `4` and nothing is written, unless you pass `--force`. A drawing is written as its SVG, with its raster stand-in as `fallbackRef`. `--thumbnails` also draws each slide there as a PNG and records it as the slide's `thumbnail`.

A slide that is one picture of a slide reads as a picture, with a `slide-flattened` warning. `--ocr` reads the text of such pages with the text recognition model on this machine (`lolly models fetch ocr` downloads it; `read` never does). Each frame read that way carries a `recognition` record: the model, its release and languages and its confidence. A scan's own text layer is listed as hidden text with the model `pdf-text-layer`.

A hidden object, such as a Photoshop layer switched off, is left out of the text and pictures and listed under `objects` with `hidden`. Macros, scripts, controls and embedded files are never run or opened; a warning says when the file carries any.

### Extract blocks for an agent

`lolly read <file> --extract` writes the file as blocks in reading order instead: on each page the text frames, then tables, charts, pictures and speaker notes. Each block records its page, its source object and where its words came from: `authored`, `text-layer` (a scan's invisible text) or `recognized` (with the model and its confidence).

- `--pages=<range>` reads only those pages (`3`, `1-4`, `2,5-7`, `9-`); a page outside the file is refused.
- `--max-chars=N` stops before the block that would pass N characters and gives that block's id as `next`; `--from=<block>` with the same `--pages` reads on from there.
- Plain text is the default, `--markdown` writes Markdown and `--json` gives a `ReadExtractV1` (`schemas/read-extract-v1.schema.json`).

The app's Read and extract view (`#/extract`) runs the same extract on the device.

## Which design system a command uses

The Design verbs on this page (`system context`, `compose`, `measure`, `package`, `check` and `run design`) look for a design system in the same three places, in this order:

1. `--file=<tokens.json>`;
2. the active terminal system (`lolly system use`);
3. the content profile's own system (`LOLLY_PROFILE`).

`lolly rebrand` is the exception: it always reads the content profile's own system.

`lolly system context` is the brief to read before composing, and its `origin` says which of the three answered. Beside the tokens, source evidence and rules, it gives the approved colour pairings, type per role, logos per surface, icons and their themes, photography and illustration families, the slide master's archetypes and the brand's house rules, as records a program can check. A section the design system does not declare is marked `unavailable` or `derived` in `coverage`, never left out.

**`lolly system skills`** lists the content profile's [brand skills](/info/brand-skills.html), the brand's own guidance per discipline, plus the baseline generated from the design brief. `lolly system skill <name>` prints one skill. With `--into=<dir>` it writes the skill as an Agent Skills folder instead; `--mode=linked|bundled`, `--origin=<url>` and `--include-licensed` decide how catalog links travel. `lolly system skill coverage <name>` sets the skill against the design system, and `lolly system skill check <folder>` reports whether an exported copy is the current revision. The CLI reads the brand pack on your own disk, so `internal` skills are listed too.

The slide master, logos, icons and media come from the content profile's catalog. So they are in the brief only when the design system is the profile's own: a `--file` or terminal system from another brand gets the neutral master and no catalog assets, and `catalog` in the result is `null`. `lolly system check` applies the same house rules with the same catalog choice. Its `designSystem` key has the same shape as in `lolly check`: `{ "origin": "file" | "terminal" | "profile", "profile"?, "tokensAsset"? }`.

::: details How a --file system reaches a render
`lolly run design --file=<tokens.json>`, `lolly run <file.lolly> --file=<tokens.json>` and `lolly check --file=<tokens.json>` hand the web shell's page that design system. A document lowered with `lolly package --file` then resolves its linked colours in one system everywhere: the export, the render checks and the brand checks. With no `--file`, an active terminal system is handed over the same way; with neither, the page uses the content profile's own.

The page holds the system in memory for that one job. Nothing is installed in its store, and a `.lolly` never carries a design system. So when any layer links a colour, `lolly package --file` (or `package` under an active terminal system) adds a `design-system.not-carried` note to its report, and its suggested next commands keep the `--file`. The app opens a `.lolly` in its own active design system, so someone who should see the file as authored adds the tokens file as a design system in the app and switches to it first.

The desktop app renders in its own design system, so a Design render with one of these goes to Chromium first and falls back to the app, with a note, only when Chromium is not there. `--file` belongs to Design: another tool refuses the flag, and so does `--share`, because a link cannot carry a design system.
:::

## Compose slides from the slide master

Placing every layer by hand is the long way round. `lolly compose` lays out each slide from an archetype of the design system's slide master, the way **New slide from layout** does in the app, and writes the Design document that `package`, `check` and `run design --document` take.

```bash
lolly compose --list
lolly compose --suggest --source=old.pptx --output=spec.json
lolly compose spec.json --source=old.pptx --output=deck.json --edits-out=edits.json
```

**`--list`** prints the master's archetypes, each with its slot keys, its ground and its dark twin. A slot key is a role such as `title`, or `body#2` for the second body slot; `label?` is optional, and `visual:image` and `data:table` name the slot's kind. With `--json`, each slot also has its box in px at the master's own size.

**`--suggest --source=<deck>`** (or `--inventory=<inventory.json>`) writes a first spec: an archetype for each slide with the reason it was chosen, the slots filled with `from` references to the deck's text, the pictures as placeholder keys (`photo:` and the first 12 hex digits of the picture's SHA-256), and each slide's `source` and notes. Treat it as a draft to edit slide by slide.

**`compose <spec.json|->`** composes a spec (`schemas/design-compose-v1.schema.json`): a list of `slides`, each with an `archetype` and its `slots`. A slot takes Design text markup, `null` to leave it out or an object with `from` (an inventory object id), `text` or `image`, plus any layer field to set over the master's. `lolly compose --help` prints every key, and the agent skill's [Design reference](/info/skills/lolly/reference/design.md) explains each.

::: details Every key a spec can carry
A slide can also carry `cells` for the repeated cells of a columns or steps archetype, `source` (the 1-based source slide whose text `from` reads and whose notes are carried), `ground`, `notes`, `furniture` (`omit`, `footer`, `logo`), `emphasis` and `case`, plus `under` and `over` rows written with the authoring keys, painted before and after the archetype's layers.

At the top, `size`, `theme`, `themes`, `footer`, `pageNumbers`, `transition`, `gap` and `$styles` apply to the whole deck. `furniture`, `emphasis` and `case` there are defaults a slide's own merge over: the `omit` lists add up, and a slide's `footer` and `logo` win.

A slot object's `from` takes `para` for one paragraph (or a list), `join` to run all its lines into one with the text given (such as `": "`), or both. A slot can also set `case`, `emphasis` and any layer field: `x` and `y` relative to the slide, `w`, `h`, `fg`, `fontSize`, `weight`.

`emphasis` is `accent` (a source's bold in a title, subtitle, quote or number slot set in the brand's accent colour, the default where a weight house rule forbids bold), `bold` or `keep` (bold with the source's own colours). `case: "sentence"` lowers Title Case words other than the first. It lowers proper nouns too, so it is never the default, and each change is an edit with its result.
:::

Every slide keeps its binding to the master: the archetype, each slot's role and the master's furniture. That binding is why `lolly check` judges a composed slide by the master's house rules, and why the `.pptx` export has slide layouts with title, subtitle and body placeholders a person can edit. Every empty slot is dropped and reported. Page numbers count the slides in presentation order, and the footer is the spec's text.

The master is the first of these: `--master=<masters.json>`, the slide master of the design system in use or the engine's neutral master. The report says which it used. A `--file` system from another brand has no catalog master or logos here, so it composes on the neutral master with no logo, and a note says so.

::: details Dark slides, themes and logos on photographs
`--theme=dark` (or a slide's `ground`) takes each archetype's dark twin, and a `flow-cards-N-C` or `flow-columns-N-C` layout takes a twin made from the master's dark content slide. A light archetype without a twin is drawn from the master under the design system's Dark theme, and the report says so. An archetype that is dark by design keeps its ground in a light deck, with a note when a slide asked for light.

With `themes` listing more than one theme (`"themes": ["light", "dark"]`, or `--themes=light,dark`), the document follows the theme it is drawn in. Logo furniture is written as `<id>?theme=auto`. Every ground, bar and ink the master takes from a token is stored as the colour of `theme` plus a link to that token, and token references in `under` and `over` rows are lowered to links the same way. On a dark deck, a light archetype whose linked ground turns dark, with ink that still reads, is used in place of its dark twin. A colour the master states as a hex, and the accent ink given to a source's bold, stay literal.

With `logo` left at `auto`, a slide whose `under` picture covers 90% of it or more takes the design system's on-photo mark. When the picture's bytes are at hand (from `--source`, or `--asset=KEY=PATH` for a placeholder key, repeatable), compose measures the picture under the logo. Where no mark the brand allows on photography reaches 3:1 there, it leaves the logo off with a `compose.logo.photo-contrast` note. It draws the `under` rows as the canvas does (a box's opacity, a token fill, a linear `grad` with its `$tint`); a slide it cannot draw that way, such as a picture with a photo look, gets a `compose.logo.photo-unmeasured` note. A text slot whose ink falls short of 3:1 (large text) or 4.5:1 against the picture under it gets a `compose.text.photo-contrast` note and keeps its ink.
:::

Every composed text slot is measured with the faces the canvas loads. The report lists each one that clips, and `--fit=shrink` steps it down in whole px to the smallest size the master sets for its role. `--size=WIDTHxHEIGHT` sets the slide size (1920x1080 by default).

`--edits-out=<edits.json>` writes the source wording the composed slides leave out or change, as `{ "edits": [...] }`, which `lolly check --edits` reads. Each entry carries a generic reason; write the real one before you hand the file to a person.

Compose a whole deck, one slide per source slide. The fidelity check pairs artboards and source slides by their text, so a spec that recreates only some slides reports the others as missing.

`compose` exits `0` when it composed (a slot that still clips is reported, not refused), `2` on a usage error (an unknown flag, a size or theme that is not one, a master or token file that will not read), `4` when it refuses the spec (with the JSON pointer of the key) or an output exists without `--force`, and `1` when the deck cannot be read. With `--json` the envelope's `result` holds the document (or, with `--output`, its path), the report, the edits, the pictures it named and the next commands to run.

## Write and fit the text

You can also write a Design document by hand, or edit the one compose wrote. Its rows may carry **authoring keys**, which start with `$`:

- `$in` writes a layer's position relative to its artboard;
- `$style` sets its text by a named style from the design brief or the document's own `$styles`;
- `$points` and `$d` draw a path in px;
- `$stack`, `$grid` and `$table` lay out repeated rows.

Before anything else reads the document, these are lowered to ordinary layers in canvas coordinates, with every text field written out; they are never stored. Text styles take their sizes and colours from the design system the command uses. A key that cannot be lowered is refused with exit `4` and the JSON pointer of the key, and `lolly check` reports it as `design.authoring.invalid`. The keys, the style rules and the layouts are in the agent skill's [Design reference](/info/skills/lolly/reference/design.md); the schema is `schemas/design-authoring-v1.schema.json`.

Every verb here accepts an authoring document: `run design --document=<file|->`, `compile design --inputs=<file>`, `validate design --inputs=<file> --document`, `check`, `measure --text-layers` and `package`.

A placeholder picture such as `photo:title` gets its bytes only when `lolly package --asset` writes the `.lolly`. Before that, `run design --document` draws the slide without it and warns `Asset not in catalog: photo:title`, `--asset` is refused there and `check` lists it as a `brand.asset.review` finding, because it is not one of the design system's asset ids. To preview or check a document with its pictures, package it first and run or check the `.lolly`.

### Measure text before it is drawn

```bash
lolly measure --text="Where we are" --width=900 --style=body
lolly measure deck.json --text-layers --layer=s1-title
```

`lolly measure --text=<text|-> --width=<px>` says where a plain text layer's lines break and how tall it is. It shapes the text with HarfBuzz in the faces the canvas loads and breaks it the way the browser does. For each line it gives the width, the space left and a `nearEdge` flag for a line within a few px of breaking differently. It also gives the height, the `scrollHeight` the canvas reports and, with `--height=<px>`, whether the box clips the text. A clipped box is an answer, not a failure: the exit code is `0`.

The layer's fields are `--font`, `--weight`, `--size`, `--line-height`, `--pad`, `--tracking`, `--italic` and `--valign`; a field left out takes the renderer's default (48 px, weight 700, line height 1.12, padding 8, middle). `--style=<id>` measures the box as an authored layer with that style, starting from padding 0, top and left. A style's size scales with the artboard, so give `--artboard-width=<px>` for one that is not 1920 px wide; the output says which width it used. `--italic` measures the italic face the canvas draws, and `--text=-` reads the text from standard input.

`lolly measure <design.json|.lolly> --text-layers` measures every plain text layer with its own fields, including a document's own `$styles`; `--layer=<id>` (repeatable) picks layers. With `--json` the `result` follows `schemas/text-measure-v1.schema.json`. When `lolly check` cannot draw the page, it uses the same measure to report text that would clip, as a `design.text.overflow` warning.

## Package and export

```bash
lolly package deck.json --source=old.pptx --label="Quarterly review" --output=review.lolly
lolly run review.lolly --export=pptx --output=review.pptx
```

**`lolly package <design.json|-> --output=<file.lolly>`** writes a `.lolly` the app reopens as the same document, with its pictures and its name. It finds each picture's bytes in one of these places:

- `--asset=KEY=PATH` (repeatable) gives the picture at PATH to every layer whose `image` is KEY, such as `photo:title`;
- `--asset-dir=<dir>` resolves `user/media/<sha256>` references from the folder `lolly read --media` wrote;
- `--source=<deck|file.lolly>` resolves them from the deck itself.

The last two also resolve a key ending in the first hex digits of a picture's SHA-256, such as the `photo:4fd58e623334` keys `compose --suggest` writes, when exactly one picture matches. Each picture is hashed and its type read from its bytes; a file that is not a picture is refused. Every other picture must be a catalog id of the active profile. A picture with no bytes or an unknown catalog id is refused with exit `4` unless you pass `--allow-missing-media`, and a path layer that will not decode is always refused.

`--label=<name>` is the name the app shows and exports under, kept as typed; a character a file name cannot hold is replaced only when a file is saved. `--theme` and `--file` choose the design system the authoring styles resolve in. An existing output is refused unless you pass `--force`. The file is read back after it is written, and the report lists the layers, the pictures by hash and the catalog references checked (`schemas/design-package-v1.schema.json`; `--json` needs `--output`). The zip times are the UTC time of `SOURCE_DATE_EPOCH` when it is set, so one document written by the same Lolly version gives the same bytes in any time zone.

**`lolly run <file.lolly> --export=<format>`** exports a saved Design session with the app's own exporter, so the PPTX, PDF or image is the one the app writes. Formats are `pptx`, `pdf`, `png` (the default), `svg`, `jpg` and `webp`.

- `--output=<file>` writes there and reports the byte count. `run` always replaces an existing file, and accepts `--force` as `compose` and `package` do; a folder that does not exist is refused with exit `2` before a browser starts.
- `--s=<slide>` picks one slide. On `lolly run design --document` and on a saved session, `--s` takes a 1-based slide number in presentation order (`--s=2`) or a frame id (`--s=s2`). A frame's name is not an address, and an `--s` that matches no slide exits `2` with nothing written.
- A `png`, `svg`, `jpg` or `webp` from a deck of several frames with no `--s` is the first frame, and stderr says so. A one-slide picture paints that slide's own background.
- `--no-provenance`, `--c2pa`, `--imprint` and `--no-madewith` work as on any other render.

This needs the browser tier, as every Design export does: a built web shell (`pnpm run build:web`), or `LOLLY_WEB_BASE` set to the address of one you run (`pnpm run dev:web`) under the same `LOLLY_PROFILE` as the CLI ([Render with the CLI](/info/cli-rendering.html#what-the-cli-can-render)). A reusable tool `.lolly` keeps its `--trust-tool` path; `--trust-tool` on a saved session is refused, because a session carries no code to trust.

### One document, every theme

A Design document follows the theme it is drawn in when its colours are token references (`{color.semantic.text}`), its logos and icons are written as `<id>?theme=auto` and its photographs carry a brand look (`user/media/<sha256>?treatment=<look id>`).

`--themes=<a,b|all>` exports once per theme, to `<stem>-<theme>.<ext>` beside `--output`:

```bash
lolly run deck.lolly --themes=light,dark --export=pptx --output=deck.pptx
# writes deck-light.pptx and deck-dark.pptx
```

The names are the themes the design system declares, and `all` takes every look in order. A design system with [colourways](/info/colourways.html) keeps them out of `all`, so each look is exported once, in the colourway the session was saved in or else the canonical one. Name a colourway, as in `--themes=Beach`, to export in that colourway. The same flag works on `lolly run <tool>`, including `design --document`.

`--themes` needs `--output`, refuses a name the design system does not declare (and lists the ones it does), and cannot be combined with `--_themes`, `--share` or `--production-repairs`. Standard input is read once and given to every theme. For one file in one theme under the exact name you give, use `--theme=<name>` (or `--_themes=<json>`, the URL parameter `_themes`): `--theme=light --output=light.pptx` writes `light.pptx`, where `--themes=light` would write `light-light.pptx`. A photo look is baked into the picture's pixels; on a CLI without `@napi-rs/canvas` the plain picture is used and a warning says so.

::: details How a Design document reaches the browser
`lolly run design --document`, a saved session and the `render` family of `lolly check` all reach the web shell as a saved session through its `#/open` route. The file is served once, from a random path on the same local server, to one GET of up to 64 MB, so a document with full-resolution pictures never has to fit in an address.

The desktop renderer keeps the address. Under `LOLLY_RENDERER=auto` (the default) or `desktop`, a running or installed Lolly app renders a Design document from its address when that address is under the app's 1 MiB request limit, and Chromium takes the session when no app is there. An address over 1 MiB goes to Chromium as a session, with a note when an app was there to take the job. On every path, `--durable` checks that the served web shell has the TrustMark encoder model before a browser starts.
:::

## Check the recreation

```bash
lolly check review.lolly --source=old.inventory.json --json > check.json
```

`lolly check <file>` runs every check Lolly has on a Design document (`.json`), a `.lolly` or an export (`.pdf`, `.pptx`, `.png`, `.jpg`, `.webp`, `.svg`) and returns one findings list. Each finding has a stable dotted code, a severity (`error`, `warn` or `info`), the layer and artboard where there is one, the message the app shows and a fix where one is safe to apply. With `--json` the `result` follows `schemas/check-report-v1.schema.json`.

The checks come in five families:

| Family | What it checks |
|---|---|
| `structure` | Layer ids, artboards and layers outside their artboard. A picture drawn at more than twice its pixel size is `design.image.low-resolution`, read from the picture's own bytes; an SVG is never judged. |
| `render` | What the Design editor checks on the painted page: clipped text, contrast and font coverage, with the pictures painted. Text over a photograph is measured against the pixels under its lines: failing over nearly all of them is `design.text.contrast-low`, and a partly light, partly dark picture is `design.text.contrast-review`. Needs the browser tier; without one this family is `unavailable`, with the reason, and the others still run. |
| `brand` | Colours, fonts and asset ids against the design system, and its house rules: headline weight, alignment, approved colour pairings, accent edges on rounded shapes, dashed lines, logo per surface. A layer Design does not draw (hidden, on a hidden artboard or inside a hidden group) is not checked. A palette colour with an alpha channel counts as that colour; any other translucent colour is `brand.color.unknown`. Uploaded pictures are not reviewed. On a `.pptx` it reads the colours the slides paint in the `--theme` given: an off-palette colour is `brand.color.review`, and a slide ground that is not the theme's surface, primary or secondary colour is `brand.ground.theme`. Other exports have no brand family. |
| `verify` | The Verify layout clues (a coloured edge on a rounded card, an eyebrow above a heading, decorative numbering), from the layers or, for an export, from the file. Text recognition is off unless you pass `--ocr`, so two machines give the same answer. A document also gets one `verify.writing-score` finding: the writing score Verify shows for its visible text, hidden layers left out, as a note below the strong band and a warning at it, never an error. The score is a signal, not a verdict. |
| `fidelity` | With `--source=<deck or inventory.json>`: every source string is in the result or listed as an edit, every speaker note is carried over and the slide count and order match. A change of case or spelling is listed for review. A string repeated on several slides must appear on each of their artboards; one found only on another artboard is reported as moved. `--edits=<edits.json>` (a JSON array of `{ "source", "result", "reason" }`, or the file `compose --edits-out` writes) records wording changed on purpose: those findings stay as notes marked excepted, listed under `fidelity.excepted`, never as passed. |

A check never reads as clean on what it did not read. An export page with no text layer, read without `--ocr`, is a `verify.text.unread` warning, and pages past the cap are a `verify.pages-capped` warning.

`check` exits `0` when nothing needs attention (notes are allowed), `5` when there are warnings to review, `4` on an error finding, `3` with `--browser=require` when a document has no browser tier to render it, `2` on a usage error and `1` when a family itself failed or no page of an export could be decoded. An export has no render family, so `--browser=require` does not apply to one, and one command line can check documents and their PDF exports together. The writing score never changes the exit code, with `--strict` or without: a document whose only warning is a strong writing score exits `0`. Read the house-rule findings and the writing score as feedback, revise the layers they name and check again.

::: details The other check flags
- `--strict` turns weak Verify clues into errors and refuses on any warning. The writing score stays a note or a warning and is never counted.
- `--browser=off` skips the render family.
- `--theme=<name>` is the token theme the document is checked in; a theme the design system does not declare is a usage error.
- `--themes=<a,b|all>` checks in several themes in one report. The render, brand and Verify families run once per theme and each finding carries `theme`. Structure and fidelity run once. A link that does not resolve in a theme is `brand.token-link.unresolved`. `--theme` and `--themes` together are refused.
- `--page-cap=<n>` limits how many artboards or pages Verify reads (1 to 100).
- On a standalone CLI with no design system, the brand family is `unavailable`.
:::

[CLI batch and automation](/info/cli-automation.html#check-a-design-document-in-ci-lolly-check) shows `check` as a CI gate.

## The same verbs over MCP

The [MCP server](/info/mcp.html) offers each verb as a tool, over the same code, so an agent connected there gets the same answers:

| CLI | MCP tool |
|---|---|
| `lolly rebrand` | `lolly_rebrand` |
| `lolly read` | `lolly_read` |
| `lolly compose` | `lolly_compose` (`mode` is `compose`, `list` or `suggest`) |
| `lolly measure --text` | `lolly_measure_text` |
| `lolly package` | `lolly_package` |
| `lolly check` | `lolly_check` |
