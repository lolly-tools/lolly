# CLI

`lolly` runs any tool from the terminal - same engine, same render path, same output as the web shell. It's **URL mode under a different transport**: `--foo=bar` argv pairs become the exact values the web shell parses from `?foo=bar`, so the CLI can never drift from the GUI. Great for build pipelines, CI, scripting and batch generation.

> Want an **interactive** terminal experience instead of one-shot commands - browse tools, tweak inputs, save projects, all from the keyboard? Run `pnpm run tui` in a checkout (or `lolly tui` with a standalone binary), or see the [TUI](/info/tui.html). It shares this same engine and render path.


## Choose a guide

| Task | Guide |
| --- | --- |
| Choose export options, troubleshoot the browser renderer and render timelines or links. | [Render with the CLI](/info/cli-rendering.html) |
| Process local files, redactions, speech and on-device models. | [CLI file and media utilities](/info/cli-files.html) |
| Run batches, preflight outputs and integrate predictable results into scripts and CI. | [CLI batch and automation](/info/cli-automation.html) |
| Verify files, inspect metadata, configure completion and find local state. | [CLI verification and configuration](/info/cli-reference.html) |

## Install

Two routes to the same program.

**The desktop app.** Lolly for macOS, Windows and Linux carries its own tools,
catalog and this same CLI, so installing the app is enough. On macOS the command
is the app's own executable, `Lolly.app/Contents/MacOS/lolly-desktop`, and it
takes the same arguments. `run` uses the app's native off-screen WebView; the
other verbs are forwarded to the bundled Node package.

**A checkout.** In a clone of the Lolly source ([github.com/lolly-tools/lolly](https://github.com/lolly-tools/lolly)) the CLI is a package script.

::: note Before you start
You need Node.js 22.18 or later and pnpm; if `pnpm --version` fails, run `npm install --global pnpm` ([Prerequisites](/info/build-guide.html#prerequisites-all-targets)). Run `pnpm install` once at the repository root ([Getting the source](/info/build-guide.html#getting-the-source)), then run every command from that root. Arguments go straight after the tool id, with no `--` in between.
:::

```bash wrap
pnpm run cli qr-code --url=https://example.com --output=qr.svg
```

pnpm may print a warning of its own first. The CLI ends with a line that starts `✓ Wrote`, and `qr.svg` is written to the repository root, replacing any file of that name. If your own address contains `?` or `&`, put it in quotes. The general form is `pnpm run cli <tool-id> [--input=value ...] [--export=fmt] [--output=file]`. Examples on these pages that start with `lolly` run from a checkout as `pnpm run cli` followed by the same arguments.

### A standalone CLI carries no tools and no catalog

Tools and brand assets are content, not code, and a full set runs well past 100 MB. A standalone `lolly` (the packaged CLI, see [Build the CLI and TUI](/info/build-terminal.html#standalone-binary)) carries none of it, so point it at a root:

```bash
LOLLY_ROOT=/path/to/lolly lolly list
```

Two kinds of directory work: a **checkout** of this repository, where the resolver reads `profiles.json` and the packs under `community/` and `brands/`, and a **materialized** root - a real `tools/` + `catalog/` pair, which is what a `dist/` build, an RPM payload or a container image carries. The desktop app brings its own, so nothing needs pointing there. `lolly system import <pack.lolly>` is the third route, and it is a different thing: it imports **your design system** (colours, fonts, logos), which every render then uses, and it adds no tools, so it needs one of the other two routes as well.

Run a command that needs content without any and the CLI prints those three routes and exits **3** (`UNAVAILABLE_HERE`), the retry-somewhere-else code. It never downloads anything on its own.

> **Redirecting or piping? Use `pnpm --silent run cli`.** pnpm can print lines of its own on **stdout** (a warning, a run banner) ahead of anything the CLI writes, so `pnpm run cli qr-code --export=png > qr.png` can produce a file that does not start with the PNG and that `file` reports as `data`. The CLI's own rule holds - stdout is the payload - but the package manager's wrapper breaks it before the CLI runs. `--silent` suppresses those lines; an installed `lolly` binary never prints them. Every redirecting example below is written that way.

`lolly --help` prints the same surface this page documents - every flag and every exit code - so a script author never has to leave the terminal to find them. The document verbs have help of their own: `lolly read --help`, `lolly check --help`, `lolly package --help`, `lolly measure --help`, `lolly compose --help` and `lolly run <file.lolly> --help` each print that verb's flags, the inputs it reads and its exit codes.

## Discovering tools & assets

```bash
pnpm run cli                      # list every tool (id, status, description)
pnpm run cli list              # the same thing, spelled explicitly
pnpm run cli list --json --q=chart --limit=5  # bounded machine discovery
pnpm run cli describe qr-code  # that tool's inputs, defaults, and formats
pnpm run cli qr-code           # sugar for describe, when no flags follow
pnpm run cli assets            # list every catalog asset id (logos, icons, photos…)
pnpm run cli assets logo       # filter by substring
pnpm run cli assets --type=raster
```

`describe <tool-id>` (and its bare `<tool-id>` sugar) lists the tool's essential inputs with their defaults, plus a usage line (add `--all` for every input) - including a `↳` syntax hint for the non-scalar input types (how to express `asset`, `blocks`, `vector`, `file`, `color` values). The fastest way to learn what a tool accepts.

`list --q=<words>` filters by tool id, name, description, category and declared formats. Add `--limit=1..100` to keep a model's discovery response small; JSON includes `query`, `limit` and `total` when those options are used. With neither option, the complete listing remains available.

`--type=` is checked against the catalog: a value no asset carries is an error listing the real ones, not an empty list and exit 0.

```
$ lolly assets --type=rastor
Error: No catalog asset has type "rastor". This catalog has: audio, lottie, palette, raster, tokens, vector.
```

Any listed **asset id** can be passed to an `asset`-type input (the engine resolves it to the embedded asset), and so can a **`lolly.tools` tool URL** - a whole tool's render becomes the asset. To render a **bare asset** straight to a file, use the `asset-export` tool - note it ships with the **SUSE brand pack**, so it is profile-dependent and absent on a community-only profile (where these commands print `Tool not found: asset-export`):

```bash
pnpm run cli asset-export --src=suse/logo/hor-neg-green --export=svg --output=logo.svg
pnpm run cli asset-export --src='https://lolly.tools/tool/qr-code.svg?url=x' --output=qr.svg
```

### Document/compiler verbs

The versioned document API is available without rasterising a tool:

```bash
lolly schema qr-code
lolly compile qr-code --inputs=inputs.json > document.json
lolly validate document.json --document
lolly inspect document.json
lolly measure document.json
lolly diff before.json after.json
lolly optimize export.png --format=png --output=clean.png
lolly package document.json --output=session.lolly
```

`compile` emits the hydrated, typed document plus warnings; `schema` emits JSON
Schema; `inspect`, `measure` and `diff` are semantic reads. `optimize` reports
the immutable stages it ran when writing a file, and `package` writes an
`application/vnd.lolly+zip` share envelope. A logical asset input such as
`image://brand/logo`, `catalog://suse/logo/primary` or
`library://user/upload/…` is resolved by the same host bridge used for an
ordinary render. Device CLI runs deliberately leave credentialled `cms://` and
governed `net://` refs to Lolly Work.

`measure` and `package` also take a Design document directly. `lolly measure
--text=…` and `lolly measure <design.json> --text-layers` measure text before it
is drawn, and `lolly package <design.json>` writes a `.lolly` the app reopens with
its pictures. Both are described under
[Author, measure and package a Design document](#author-measure-and-package-a-design-document).
A compiled document keeps the behaviour above.

### Look at a picture in its own coordinates

The MCP server's looking tools are also CLI verbs, over the same code, so a script
sees what an agent sees. Each takes an SVG, PNG, JPEG, GIF or WebP file, or `-` to
read standard input:

```bash
lolly design --z=… --export=svg | lolly look - --output=look.png
lolly look poster.svg --region=0,0,400,300 --grid=20 --output=corner.png
lolly sample poster.svg --points="120,80;640,400" --radius=3
lolly trace photo.jpg --max-lines=20 --design-layers --json
```

`look` draws the picture, or one region of it enlarged, with a grid numbered in
the picture's own units: the SVG's viewBox, which for Design is the artboard
pixels that a layer's x, y, w and h use, or the pixels of a raster image.
`sample` gives the colour at each point, averaged over a small disc, and the
nearest colour of the active design system with its distance (ΔE in OKLab).
`trace` gives the picture's edges as lines in the same units, longest first;
`--design-layers` adds each line as a Design path layer. With `--json`, `look`
needs `--output`, because the picture and the envelope cannot share standard
output.

### Verbs, and why they exist

The first argument is either a **verb** or a **tool id**, and the verbs win. The verbs include `list`, `describe`, `run`, `assets`, `batch`, `smoke`, `validate`, `preflight`, `install-browser`, `completion`, `help`, `version`, `models`, `speak`, `transcribe`, `mix`, `upscale`, `matte`, `ocr`, `detect-ai`, `reword`, `depth`, `rebrand`, `read`, `check`, `compose`, `look`, `sample` and `trace`, plus `prepare`, `files`, `start`, `system`, `compile`, `schema`, `inspect`, `diff`, `measure`, `optimize`, `package`, `icons`, `pack` and `tui` - reserved words a tool id may never take, otherwise a brand pack shipping a tool called `batch` would be permanently unreachable. Run `lolly --help` for the full, current set. `lolly run <tool-id>` and `lolly describe <tool-id>` are the unambiguous spellings; the bare `lolly <tool-id>` sugar renders when flags follow and describes when they do not.

### Global flags

Valid on every command:

| Flag | Meaning |
|---|---|
| `--json` | one JSON envelope on stdout instead of human text (see [Machine interface](/info/cli-automation.html#machine-interface-json)). Not valid on a render. |
| `--quiet` | suppress non-error stderr: progress notes, warnings, the byte-count line. Errors still print. |
| `--verbose` | diagnostics and stack traces. `DEBUG=1` is an alias. |
| `--strict` | promote this run's warnings to a failure after the work is reported (exit 2 for a usage-class warning, 4 for a gate-class one). |
| `-h`, `--help`, `-v`, `--version` | recognised anywhere in the arguments. |
| `--` | ends option parsing. Everything after it is positional - the only way to pass a `longtext` value that itself starts with `--`. |

A flag that takes a value is refused in its bare form rather than parsed as the string `"1"`: `lolly qr-code --output` is an error, not a file called `1`. `NO_COLOR` is honoured alongside the TTY check.

## Rendering

```bash
# Write to a file (extension is yours to choose):
pnpm run cli qr-code --url=https://suse.com --output=./qr.svg

# Explicit format, stream to stdout (pipe or redirect):
pnpm --silent run cli qr-code --url=https://suse.com --export=png > qr.png
```

If `--output` is given, the file is written and a byte count is reported on stderr; otherwise the bytes go to **stdout** so you can pipe them.

### Review a timed composition

Use `--export=png --cuts=6 --output=frames.zip` for uniformly sampled stills, or
`--export=png --sampletimes=0,1.5,3 --output=frames.zip` for explicit timeline seconds.
One explicit time produces a single image; multiple times produce a ZIP for
PNG/JPG/WebP/SVG or one paged PDF. Both routes need the browser renderer. Explicit
times must be increasing and before the timeline end; they currently support
native timed layers and refuse unsupported animated media. See
[URL parameters](url-parameters.md#contact-sheets-cuts) for the full contract.

### The `--output` extension is a format request

An extension picks a format, so it is checked like one. If the tool does not declare it, the run stops - it does not fall back to the tool's first format and write those bytes under your filename:

```
$ lolly meeting-planner --output=times.csv
Error: --output=times.csv asks for ".csv", which "meeting-planner" does not produce.
Supported: png, jpeg, svg, ics, json. Name one with --export=<format> if you meant to
write it under that filename anyway.
```

Naming the format explicitly is how you opt out, because then you have said which bytes you expect: `lolly meeting-planner --export=json --output=times.notes` writes JSON under that name and exits 0. An `--output` with no extension at all renders the tool's default format.

## Rebrand: renovate an old deck

`lolly rebrand` reads a `.pptx` someone else made and turns it into the active design system's own: colours, fonts and logo snapped to the system, decoration and page furniture pulled out, kept content carried over. The app's Rebrand view does the same with a review screen, and [Rebrand a deck](/info/rebrand.html) explains the ideas both share. It runs in three explicit stages, so an agent or a script can look at what a deck's first pass proposed before anything is written:

```bash
lolly rebrand plan old.pptx --plan-out=plan.json
# writes plan.json (every object's proposal and review state) and plan.report.json (the counts)

lolly rebrand compile old.pptx --plan=plan.json --export=pptx
# writes old.lolly (a Design document), old.report.json, and old.rebranded.pptx

lolly rebrand inspect plan.json --source=old.pptx
# a summary, the review queue, and per-slide states; --slide=<n> lists one slide's objects
```

The plan is a plain JSON file whose schema is `schemas/rebrand-plan-v1.schema.json`: an editor, a script or an agent can open it between the two calls and change a row - drop a slide, keep a photo, map a colour to a different design-system token - and `compile` takes exactly the plan it is handed. The plan carries the source deck's hash, so compiling it against a different `.pptx` is refused rather than silently reconciled. `--accept-suggestions` answers every row still marked unreviewed the way the app's own "Accept all suggestions" does; `--accept-suggestions=all` also answers rows flagged as needing attention. `--auto-match` sets each slide's layout from the structure it reads as, the way the app's "Auto-match layouts" action does: `--auto-match=clear` takes only the clear reads, `=likely` adds the likely ones, and a bare flag or `=all` also takes the slides with no confident read. It never changes a slide whose layout a person or a preset set, and each file in the `--json` envelope counts the slides it set per band under `autoMatched`.

Each deck ends `ready`, `needs-review` or `failed` (`needs-review` is not a success: something in the compiled deck still needs a look). `compile` exits `5` when every deck compiled but at least one needs review (`ok: false` in `--json`), `4` on a refused plan or an existing output, and `2` on a usage error. `lolly rebrand plan|compile <dir>` runs over every `.pptx` a folder holds, `--recursive` includes its subfolders, `--jobs=<n>` runs several decks at once in worker threads, and `--resume` keeps a run record beside the outputs (`.lolly-rebrand-run.json`) so a second call only redoes the decks that still need it. `--preset=<id|file.json>` takes a renovation preset - a design system's or a person's own default decisions - resolved from the active content profile first and a personal presets file second; `lolly rebrand presets` lists what resolves. Every stage reads the active content profile's design system (`LOLLY_PROFILE`) and touches no network.

The full stage reference, the object classes a deck's contents are read into, and the plan-editing rules an agent should follow are in the [agent skill's Rebrand reference](/info/skills/lolly/reference/rebrand.md).

## Read a deck, then check the recreation

Rebrand changes a deck in place. When a person or an agent rebuilds a deck in Design instead, two verbs cover the two ends of that work: `lolly read` says what the old deck holds, and `lolly check` says whether the new document is right.

```bash
lolly read old.pptx --json --media=./media > old.inventory.json
lolly system context --json > brief.json
lolly check new.lolly --source=old.inventory.json
```

**`lolly read <deck>`** reads a `.pptx`, a PDF or a Photoshop `.psd` (or `-` for standard input) with the same reader and census as rebrand. For each slide it gives the text in reading order, each frame with its role (title, subtitle, body, label, caption, page number or footer) and its runs (bold, italic, colour, font, weight and size). It also gives the speaker notes, with paragraphs and line breaks kept apart, the pictures with their placement and crop, tables and charts as data, and the class of every object, so decoration can be told from content. With `--json` the envelope's `result` is the inventory, whose schema is `schemas/content-inventory-v1.schema.json`. Without it, an outline goes to standard output. `--media=<dir>` writes each distinct picture once, named by its SHA-256 (`<sha256>.<ext>`). A file already there with the same bytes is reused. A file there with other bytes is refused with exit `4`, and nothing is written, unless `--force` is given. A drawing is reported as its SVG, which is written too, with the drawing's raster stand-in as `fallbackRef`. `--thumbnails`, with `--media`, also draws each slide as a PNG there and records it as the slide's `thumbnail`. A slide that is one picture of a slide reads as a picture, because `read` runs no text recognition, and a `slide-flattened` warning says so. A hidden object, such as a Photoshop layer switched off, is left out of the text and pictures and listed under `objects` with `hidden`; a PDF's invisible text, the text layer of a scan, is kept and marked `hidden`.

**`lolly system context`** is the brief to read before composing. With no `--file` and no active terminal system, it answers for the active content profile's own design system, and `origin` in the result says which of the three answered. Beside the tokens, source evidence and rules, it gives the approved colour pairings, type per role, logos per surface, icons and their themes, photography and illustration families, the slide master's archetypes and the brand's house rules as machine-checkable records. A section the design system does not declare is marked `unavailable` or `derived` in `coverage`, never left out. The slide master, logos, icons and media come from the content profile's catalog, so they are in the brief only when the design system is the profile's own: a `--file` or terminal system from another brand gets the neutral master and no catalog assets, and `catalog` in the result is `null`. `lolly system check` applies the same house rules, with the same catalog choice. Its `designSystem` key has the same shape as in `lolly check`: `{ "origin": "file" | "terminal" | "profile", "profile"?, "tokensAsset"? }`.

**`lolly check <file>`** runs every check Lolly has on a Design document (`.json`), a `.lolly` or an export (`.pdf`, `.pptx`, `.png`, `.jpg`, `.webp`, `.svg`), and returns one findings list. Each finding has a stable dotted code, a severity (`error`, `warn` or `info`), the layer and artboard where there is one, the message the app shows, and a fix where one is safe to apply. The checks come in five families:

| Family | What it checks |
|---|---|
| `structure` | The document's own structure: layer ids, artboards, layers outside their artboard. A picture drawn at more than twice its pixel size is a `design.image.low-resolution` warning; the size is read from the bytes of an upload the `.lolly` carries or of a catalog file, and an SVG is never judged. |
| `render` | The checks the Design editor runs on the painted page: clipped text, contrast and font coverage, with the document's pictures painted, uploads included, so text over a photograph is judged against the photograph: the pixels under its lines are measured, and text that fails the minimum over nearly all of them is `design.text.contrast-low`, while text over a picture that is partly light and partly dark stays `design.text.contrast-review`, a visual check. These need the browser tier (`lolly install-browser` and a built web shell, or the desktop app). Without a browser tier, the family is `unavailable`, with the reason, and the other families still run. |
| `brand` | Colours, fonts and asset ids against the design system, and the brand's house rules (headline weight, alignment, approved colour pairings, accent edges on rounded shapes, dashed lines, logo per surface). Uploaded pictures are not catalog assets and are not reviewed. A palette colour with an alpha channel (`#13294bcc`) counts as that palette colour; any other translucent colour is `brand.color.unknown`. On a `.pptx`, the family reads the colours the slides paint (fills, outlines, text runs and each slide's ground) in the theme `--theme` names: a colour off the palette is `brand.color.review`, and a slide ground that is not the theme's surface, primary or secondary colour is `brand.ground.theme`, so a deck exported in the wrong theme does not read as clean. Other exports have no brand family. The design system comes from `--file`, then the active terminal system, then the content profile, as for `system context`. |
| `verify` | The Verify layout clues (a coloured edge on a rounded card, an eyebrow above a heading, decorative numbering), read from the document's own layers, or from the file for an export. Text recognition is off unless you pass `--ocr`, so two machines give the same answer. |
| `fidelity` | With `--source=<deck or inventory.json>`: every source string is in the result or listed as an edit, every speaker note is carried over, and the slide count and order match. Edits such as a change of case or spelling are listed for review and are not hidden. A string repeated on several slides must appear on each of their artboards; one found only on another artboard is reported as moved. `--edits=<edits.json>` (a JSON array of `{ "source", "result", "reason" }`) records wording changed on purpose: those findings stay in the report as notes marked excepted, and the strings are listed under `fidelity.excepted`, never as passed. |

`check` exits `0` when nothing needs attention (notes are allowed), `5` when there are warnings to review (`ok: false` in `--json`, with the full report), `4` when there is an error finding, `3` with `--browser=require` when a document has no browser tier to render it, `2` on a usage error (an unknown flag, or a `--theme` the design system does not declare) and `1` when a family itself failed or no page of an export could be decoded. An export has no render family, so `--browser=require` does not apply to an export. A check never reads as clean on what it did not read: an export page with no text layer, read without `--ocr`, is a `verify.text.unread` warning, and pages past the page cap are a `verify.pages-capped` warning. `--strict` turns weak Verify clues into errors and refuses on any warning. With `--json` the envelope's `result` is the report, whose schema is `schemas/check-report-v1.schema.json`. `--browser=off` skips the render family, `--theme=<name>` gives the token theme the document is checked in (its linked colours resolve there), `--themes=<a,b|all>` checks it in several themes in one report (the render, brand and Verify families run once per theme, the page painted in that theme, and each of their findings carries `theme`; structure and fidelity run once, in the first theme; a link that does not resolve in a theme is a `brand.token-link.unresolved` warning; `--theme` and `--themes` together are refused), and `--page-cap=<n>` limits how many artboards or pages Verify reads (1 to 100). Neither verb needs a catalog, so both run on a standalone CLI. On a standalone CLI with no design system, the brand family is `unavailable`.

The MCP server offers the same two verbs as `lolly_read` and `lolly_check`, over the same code; see [MCP Server](/info/mcp.html).

## Author, measure and package a Design document

The steps between reading a deck and checking its recreation are writing the Design document, fitting its text and handing it over as a file. Each has a verb.

```bash
lolly measure --text="Where we are" --width=900 --style=body
lolly measure deck.author.json --text-layers --layer=s1-title
lolly run design --document=deck.author.json --share
lolly package deck.author.json --asset=photo:title=title.jpg --label="Quarterly review" --output=review.lolly
lolly check review.lolly
lolly run review.lolly --export=pptx --output=review.pptx
```

**Authoring keys.** A Design document's rows may carry keys that start with `$`: `$in` writes a layer's position relative to its artboard, `$style` sets its text by a named style from the design brief or the document's own `$styles`, `$points` and `$d` draw a path in px, and `$stack`, `$grid` and `$table` lay out repeated rows. They are lowered to ordinary layers in global canvas coordinates, with every text field written out, before anything else reads the document, and they are never stored. `lolly run design --document=<file|->` renders such a document, and `--s=<slide>` renders one of its slides. `lolly compile design --inputs=<file>`, `lolly validate design --inputs=<file> --document`, `lolly check`, `lolly measure --text-layers` and `lolly package` all accept one. Text styles take their sizes and colours from the design system `lolly check` uses: `--file`, then the active terminal system, then the content profile. A key that cannot be lowered is refused with exit `4` and the JSON pointer of the key, and `lolly check` reports it as a `design.authoring.invalid` finding. A placeholder picture such as `photo:title` gets its bytes only when `lolly package --asset` writes the `.lolly`. Before that, `lolly run design --document` draws the slide without it and warns `Asset not in catalog: photo:title`, `--asset` is refused there, and `lolly check` on the authoring file lists the placeholder as a `brand.asset.review` finding, because it is not one of the design system's asset ids. To preview or check a document with its pictures, package it first and run or check the `.lolly`, as the last three lines of the example do. The keys, the style rules and the layouts are documented in the [agent skill's Design reference](/info/skills/lolly/reference/design.md); the schema is `schemas/design-authoring-v1.schema.json`.

**`lolly measure --text=<text|-> --width=<px>`** says where a plain text layer's lines break and how tall it is, before anything is drawn. It shapes the text with HarfBuzz in the faces the canvas loads and breaks it the way the browser does. For each line it gives the width, the space left over and a `nearEdge` flag for a line within a few px of breaking differently. It also gives the height, the `scrollHeight` the canvas reports and, with `--height=<px>`, whether the box clips the text. On `measure --text`, `--width` and `--height` are the text box in px. The layer's fields are `--font`, `--weight`, `--size`, `--line-height`, `--pad`, `--tracking`, `--italic` and `--valign`; a field left out takes the renderer's default (48 px, weight 700, line height 1.12, padding 8, middle). `--style=<id>` measures the box as an authored layer with that style, which starts from padding 0, top and left. A style's size scales with the artboard width, so give `--artboard-width=<px>` for an artboard that is not 1920 px wide (the default); the output says which width it used. A document's own `$styles` are measured with `lolly measure <file> --text-layers --layer=<id>`. `--italic` sets every run in emphasis, as an italic style writes `*...*`, so it measures the italic face the canvas draws. `--text=-` reads the text from standard input. `lolly measure <design.json|.lolly> --text-layers` measures every plain text layer of a document with its own fields; `--layer=<id>` (repeatable) picks layers. With `--json` the envelope's `result` is the measure, whose schema is `schemas/text-measure-v1.schema.json`. A clipped box is an answer, not a failure: the exit code is `0`. When `lolly check` cannot draw the page (`--browser=off`, or no browser tier), it uses the same measure to report text that would be clipped, as a `design.text.overflow` warning.

**`lolly package <design.json|-> --output=<file.lolly>`** writes a `.lolly` that the app reopens as the same document, with its pictures and its name. `--asset=KEY=PATH` (repeatable) gives the picture at PATH to every layer whose `image` is KEY, such as a placeholder `photo:title`. `--asset-dir=<dir>` resolves `user/media/<sha256>` references from the folder `lolly read --media` wrote, and `--source=<deck|file.lolly>` resolves them from the deck itself. Both also resolve a placeholder whose key ends in the first hex digits of a picture's SHA-256, such as the `photo:4fd58e623334` keys `lolly compose --suggest` writes, when exactly one picture there matches. Each picture is hashed and its type read from its bytes; a file that is not a picture is refused. Every other picture must be a catalog id of the active profile. A picture with no bytes or an unknown catalog id is refused with exit `4` unless `--allow-missing-media` is given, and a path layer that will not decode is always refused. `--label=<name>` is the name the app shows and the file name it exports under, kept as typed: a character a file name cannot hold, such as `:` or `?`, is replaced only when a file is saved. `--theme` and `--file` choose the design system the authoring styles resolve in. An existing output is refused unless `--force` is given. The file is read back after it is written, and the report lists the layers, the pictures by hash and the catalog references checked. With `--json` the envelope's `result` is that report (`schemas/design-package-v1.schema.json`); `--json` needs `--output`, because the envelope uses standard output. The zip times are the UTC time of `SOURCE_DATE_EPOCH` when it is set, so one document written by the same Lolly version gives the same bytes in any time zone. A compiled document of another tool keeps the share envelope described under [Document/compiler verbs](#document-compiler-verbs).

**`lolly run <file.lolly> --export=<format>`**, for a saved Design session such as one `lolly package` wrote, exports it with the app's own exporter: the file is opened in the web shell through its `#/open` route and exported from there, so the PPTX, PDF or image is the one the app writes. Formats are `pptx`, `pdf`, `png` (the default), `svg`, `jpg` and `webp`; `--output=<file>` writes there and reports the byte count on stderr (a folder that does not exist is refused with exit 2 before a browser starts; `run` always replaces an existing file, and accepts `--force` as `compose` and `package` do), and `--s=<slide>` picks one slide, by 1-based number or frame id. An `--s` that points at no frame the session renders is refused with exit 2 before a browser starts. A `png`, `svg`, `jpg` or `webp` from a deck of several frames with no `--s` is the first frame, and stderr says so. `--no-provenance`, `--c2pa=on|off` and `--imprint=0|1` work as on any other render. This needs the browser tier, as any Design export does: a built web shell (`pnpm run build:web`), or `LOLLY_WEB_BASE` set to the address of one you run (`pnpm run dev:web`) under the same `LOLLY_PROFILE` as the CLI. A one-slide picture paints that slide's own background (a colour, a gradient or a picture), as a whole-deck export does. A reusable tool `.lolly` keeps its `--trust-tool` path, and `--trust-tool` on a saved session is refused, because a session carries no code to trust.

**One document, every theme.** A Design document whose colours are token references (`{color.semantic.text}`, `{color.role.muted-ink}`), whose logos and icons are written as `<id>?theme=auto` and whose photographs carry a brand look (`user/media/<sha256>?treatment=<look id>`) follows the theme it is drawn in. `--themes=<a,b|all>` on `lolly run <file.lolly>` opens the file once and exports it once per theme, to `<stem>-<theme>.<ext>` beside `--output`: `lolly run deck.lolly --themes=light,dark --export=pptx --output=deck.pptx` writes `deck-light.pptx` and `deck-dark.pptx`. The same flag on `lolly run <tool>` (including `design --document`) runs one export per theme. The names are the themes the run's design system declares (`--file`, then the terminal system, then the content profile's), and `all` takes every one in its order. `--themes` needs `--output` (nothing is written without it), refuses a name the design system does not declare and lists the ones it does, and cannot be combined with `--_themes`, `--share` or `--production-repairs`. An input read from standard input (`--document=-`, or a file input given as `-`) is read once and given to every theme. For one file in one theme under the exact name you give, a saved session takes `--theme=<name>` (or `--_themes=<json>`): `lolly run deck.lolly --theme=light --export=pptx --output=light.pptx` writes `light.pptx`, where `--themes=light` would write `light-light.pptx`. It is the URL parameter `_themes` (see [URL parameters](/info/url-parameters.html)) once per theme. A photo look is baked into the picture's pixels when the document draws it; on a CLI without `@napi-rs/canvas` the plain picture is used and a warning says so.

A Design render on the CLI, `lolly run design --document`, a saved session and the `render` family of `lolly check`, reaches the web shell as a saved session through the same `#/open` route: the file is served once, from a random path on the same site, to a GET (up to 64 MB). The document's size, with its pictures at full resolution, no longer has to fit in an address. The desktop renderer keeps the address: under `LOLLY_RENDERER=auto` (the default) or `desktop`, a running or installed Lolly app renders a Design document from its address when that address is under the app's 1 MiB request limit, as it does for any other tool, and Chromium takes the session when no app is there. An address over 1 MiB goes to Chromium as a session, with a note when an app was there to take the job. On this path, as on every other, `--durable` checks that the served web shell has the TrustMark encoder model before a browser starts.

**A design system given with `--file`.** `lolly run design --file=<tokens.json>`, `lolly run <file.lolly> --file=<tokens.json>` and `lolly check --file=<tokens.json>` give the web shell's page that design system, so a document lowered with `lolly package --file` resolves its linked colours in one system everywhere: in the export, in the render checks and in the brand checks. With no `--file`, an active terminal system (`lolly system use`) is given to the page the same way; with neither, the page uses the content profile's own. The page holds the system in memory for that one job: nothing is installed in its store, and a `.lolly` never carries a design system to the page. So `lolly package --file` (or `lolly package` under an active terminal system) adds a `design-system.not-carried` note to its report when any layer links a colour, and its suggested next commands keep the `--file`: the app opens a `.lolly` in its own active design system, where each linked colour takes that system's value, so a person who should see the file as authored adds the tokens file as a design system in the app and switches to that system before opening the `.lolly`. The desktop app renders in its own design system, so a Design render with one of these goes to Chromium first and falls back to the app, with a note, only when Chromium is not there. `--file` belongs to Design: another tool refuses the flag, and so does `--share`, because a link cannot carry a design system.

On `lolly run design --document` and on a saved session, `--s` takes a 1-based slide number in presentation order (`--s=2`) or a frame id (`--s=s2`). A frame's name is not an address: on `run design --document`, `--s=Plan` for a frame named Plan exits `2` with nothing written, and so does any address that matches no slide. It is the `s` parameter described in [URL parameters](/info/url-parameters.html).

The MCP server offers the same measure and package as `lolly_measure_text` and `lolly_package`; see [MCP Server](/info/mcp.html).

## Compose slides from the slide master

For a deck, placing every layer by hand is the long way round. `lolly compose` lays each slide out from an archetype of the design system's slide master, the way the app's New slide from layout does, and writes the Design document that `lolly package`, `lolly check` and `lolly run design --document` take.

```bash
lolly compose --list
lolly compose --suggest --source=old.pptx --output=spec.json
lolly compose spec.json --source=old.pptx --output=deck.json --edits-out=edits.json
lolly package deck.json --source=old.pptx --label="Quarterly review" --output=review.lolly
lolly check review.lolly --source=old.pptx --edits=edits.json
```

**`lolly compose --list`** prints the master's archetypes, each with its slot keys (a role such as `title`, or `body#2` for the second body slot; `label?` is optional, `visual:image` and `data:table` name the slot's kind), its ground and its dark twin. With `--json` each slot also has its box in px at the master's own size.

**`lolly compose --suggest --source=<deck>`** (or `--inventory=<inventory.json>`) reads a deck and writes a first spec: an archetype for each slide with the reason it was chosen, the slots filled with `from` references to the deck's text, the deck's pictures as placeholder keys (`photo:` and the first 12 hex digits of the picture's SHA-256), and each slide's `source` and notes. It is a draft to edit, slide by slide.

**`lolly compose <spec.json|->`** composes a spec. The spec is JSON (schema `schemas/design-compose-v1.schema.json`): `slides`, each with an `archetype` and its `slots`, and optionally `cells` for the repeated cells of a columns or steps archetype, `source` (the 1-based source slide whose text `from` reads and whose notes are carried), `ground`, `notes`, `furniture` (`omit`, `footer`, `logo`), `emphasis`, `case`, and `under` and `over` rows written with the authoring keys, painted before and after the archetype's layers. At the top, `size`, `theme`, `themes`, `footer`, `pageNumbers`, `transition`, `gap` and `$styles` apply to the whole deck, and so do `furniture`, `emphasis` and `case` as defaults a slide's own merge over (the `omit` lists add up; a slide's `footer` and `logo` win). A slot takes Design text markup, `null` to leave it out, or an object with `from` (an inventory object id, and `para` for one paragraph of it (or a list), `join` to run all its lines into one with the text given, such as `": "`, or both to run the picked paragraphs' lines into one), `text` or `image`, `case` and `emphasis` for that slot, and any layer field to set over the master's (`x` and `y` relative to the slide, `w`, `h`, `fg`, `fontSize`, `weight`). `emphasis` is `accent` (a source's bold in a title, subtitle, quote or number slot set in the brand's accent colour, the default where a weight house rule forbids bold), `bold` or `keep` (bold with the source's own colours). `case: "sentence"` lowers Title Case words other than the first; it lowers proper nouns too, so it is never the default, and each change is an edit with its result. `lolly compose --help` prints the keys; the agent skill's [Design reference](/info/skills/lolly/reference/design.md) explains each.

Every slide keeps its binding to the master: the archetype, each slot's role and the master's furniture. That binding is why `lolly check` judges a composed slide by the master's house rules, and why the `.pptx` export has slide layouts with title, subtitle and body placeholders a person can edit. Every slot left empty is dropped and reported. Page numbers count the slides in presentation order, and the footer is the spec's text. `--theme=dark` (or a slide's `ground`) takes each archetype's dark twin, and a `flow-cards-N-C` or `flow-columns-N-C` layout takes a twin made from the master's dark content slide. A light archetype without a twin is drawn from the master under the design system's Dark theme, and the report says so; an archetype that is dark by design keeps its ground in a light deck, with a note when a slide asked it for light. With `themes` listing more than one theme (`"themes": ["light", "dark"]`, or `--themes=light,dark`), the document follows the theme: logo furniture is written as `<id>?theme=auto`, every ground, bar and ink the master takes from a token is stored as the colour of `theme` plus a link to that token, token references in `under` and `over` rows are lowered to links the same way, and on a dark deck a light archetype whose linked ground turns dark, with ink that still reads, is used in place of its dark twin. A colour the master states as a hex, and the accent ink given to a source's bold, stay literal. With `logo` left at `auto`, a slide whose `under` picture covers 90% of it or more takes the design system's on-photo mark. When the picture's bytes are at hand (from `--source`, or `--asset=KEY=PATH` for a placeholder key, repeatable as in `lolly package`), compose measures the picture under the logo and leaves the logo off, with a `compose.logo.photo-contrast` note, where no mark the brand allows on photography reaches 3:1 there. It draws the `under` rows as the canvas does (a box's opacity, a token fill, a linear `grad` with its `$tint`); a slide it cannot draw that way, such as a picture with a photo look, is left unmeasured with a `compose.logo.photo-unmeasured` note. A text slot whose ink falls short of 3:1 (large text) or 4.5:1 against the picture under it gets a `compose.text.photo-contrast` note and keeps its ink.

The master is the first of `--master=<masters.json>`, the slide master of the design system in use, and the engine's neutral master; the report says which master it used and where that master came from. The design system follows `system context`: `--file`, then the active terminal system, then the content profile. A `--file` system from another brand has no catalog master or logos here, so it composes on the neutral master with no logo, and a note says so. Every composed text slot is measured with the faces the canvas loads; the report lists each one that clips, and `--fit=shrink` steps it down in whole px to the smallest size the master sets for its role. `--size=WIDTHxHEIGHT` sets the slide size (1920x1080 by default).

`--edits-out=<edits.json>` writes the source wording the composed slides leave out or change, as `{ "edits": [...] }`, which `lolly check --edits` reads. Each entry carries a generic reason; write the real one before you hand the file to a person. Compose a whole deck, one slide per source slide: fidelity pairs artboards and source slides by their text, so a spec that recreates only some slides reports the others as missing.

`compose` exits `0` when it composed (a text slot that still clips is reported, not refused), `2` on a usage error (an unknown flag, a size or theme that is not one, a master or token file that will not read), `4` when it refuses the spec, with the JSON pointer of the key, or an output exists without `--force`, and `1` when the deck cannot be read. With `--json` the envelope's `result` holds the document (or, with `--output`, its path), the report, the edits, the pictures it named and the next commands to run.

The MCP server offers the same composer as `lolly_compose`, with `mode` `compose`, `list` or `suggest`; see [MCP Server](/info/mcp.html).

## Related

- [Signing from the terminal](/info/cli-signing.html) - set up a real signing identity, so exports carry a verifiable name rather than an anonymous on-device key.
- [TUI](/info/tui.html) - the interactive, full-screen terminal counterpart. Same engine, same output; keyboard-driven instead of one-shot.
- [URL Mode](/info/url-mode.html) - the parameter model the CLI shares with the web shell (and the reserved params).
- [Exporting & Formats](/info/exporting.html) - what each format is for.
- [AI Agents](/info/ai-agents.html) - driving the same surface from an LLM.
- **/pro batch** - the web shell's interactive counterpart to the scripted fan-out loop above: a spreadsheet-style grid with CSV round-trip, spreadsheet paste and per-row output across one or many tools.

### Motion delivery checks

`lolly inspect --motion movie.webm` checks the delivered file with optional
ffprobe/ffmpeg. It reports dimensions, duration, frame rate, audio presence,
loudness and true peak, plus black, frozen and silent spans for review.
Unavailable decoders produce explicit not-run results.

For Design movies, `--seqrange=2,5` exports an authored two-to-five-second range
with its mix. `--motionblur=8,180` integrates eight subframes with a 180-degree
shutter. The latter supports SDR flat Sequence output; unsupported colour and
tilt paths fail explicitly. Neither setting changes audio timing.
