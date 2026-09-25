# CLI

`lolly` runs any tool from the terminal - same engine, same render path, same output as the web shell. It's **URL mode under a different transport**: `--foo=bar` argv pairs become the exact values the web shell parses from `?foo=bar`, so the CLI can never drift from the GUI. Great for build pipelines, CI, scripting and batch generation.

> Want an **interactive** terminal experience instead of one-shot commands - browse tools, tweak inputs, save projects, all from the keyboard? Run `lolly tui`, or see the [TUI](/info/tui.html). It shares this same engine and render path.


## Choose a guide

| Task | Guide |
| --- | --- |
| Choose export options, troubleshoot the browser renderer and render timelines or links. | [Render with the CLI](/info/cli-rendering.html) |
| Process local files, redactions, speech and on-device models. | [CLI file and media utilities](/info/cli-files.html) |
| Run batches, preflight outputs and integrate predictable results into scripts and CI. | [CLI batch and automation](/info/cli-automation.html) |
| Verify files, inspect metadata, configure completion and find local state. | [CLI verification and configuration](/info/cli-reference.html) |

## Install

Three routes to the same program.

**npm.** The published package carries both terminal doors, `lolly` and `lolly-tui`:

```bash
npm i -g @lolly-tools/cli
lolly --help
```

**The desktop app.** Lolly for macOS, Windows and Linux carries its own tools,
catalog, and this same CLI, so installing the app is enough. `run` uses the
app's native off-screen WebView; the other verbs are forwarded to the bundled
Node package.

**A checkout.** In the repo it's wired as an npm script (note the `--` to pass args through):

```bash
pnpm run cli <tool-id> [--input=value ...] [--export=fmt] [--output=file]
# or, once installed as a binary:
lolly <tool-id> [--input=value ...] [--export=fmt] [--output=file]
```

### The npm package ships no tools and no catalog

Tools and brand assets are content, not code, and a full set runs well past 100 MB. The package carries none of it, so point it at a root:

```bash
LOLLY_ROOT=/path/to/lolly lolly list
```

Two kinds of directory work: a **checkout** of this repository, where the resolver reads `profiles.json` and the packs under `community/` and `brands/`, and a **materialized** root - a real `tools/` + `catalog/` pair, which is what a `dist/` build, an RPM payload or a container image carries. The desktop app brings its own, so nothing needs pointing there. `lolly system import <pack.lolly>` is the third route, and it is a different thing: it imports **your design system** (colours, fonts, logos), which every render then uses, and it adds no tools, so it wants one of the other two beside it.

Run a command that needs content without any and the CLI prints those three routes and exits **3** (`UNAVAILABLE_HERE`), the retry-somewhere-else code. It never downloads anything on its own.

> **Redirecting or piping? Use `pnpm --silent run cli`.** npm prints its own two-line run banner (`> lolly@0.1.0 cli` …) on **stdout**, ahead of anything the CLI writes, so `pnpm run cli qr-code --export=png > qr.png` produces a file whose PNG magic starts 95 bytes in and `file` reports as `data`. The CLI's own rule holds - stdout is the payload - but npm's wrapper breaks it before the CLI runs. `--silent` suppresses the banner; an installed `lolly` binary never has it. Every redirecting example below is written that way.

`lolly --help` prints the same surface this page documents - every flag and every exit code - so a script author never has to leave the terminal to find them.

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

`describe <tool-id>` (and its bare `<tool-id>` sugar) prints the input schema and a usage line - including a `↳` syntax hint for the non-scalar input types (how to express `asset`, `blocks`, `vector`, `file`, `color` values). The fastest way to learn what a tool accepts.

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

### Verbs, and why they exist

The first argument is either a **verb** or a **tool id**, and the verbs win. The verbs include `list`, `describe`, `run`, `assets`, `batch`, `smoke`, `validate`, `preflight`, `install-browser`, `completion`, `help`, `version`, `models`, `speak`, `transcribe`, `mix`, `upscale`, `matte`, `ocr`, `detect-ai`, `reword`, `depth` and `rebrand`, plus `prepare`, `files`, `start`, `system`, `compile`, `schema`, `inspect`, `diff`, `measure`, `optimize`, `package`, `icons`, `pack` and `tui` - reserved words a tool id may never take, otherwise a brand pack shipping a tool called `batch` would be permanently unreachable. Run `lolly --help` for the full, current set. `lolly run <tool-id>` and `lolly describe <tool-id>` are the unambiguous spellings; the bare `lolly <tool-id>` sugar renders when flags follow and describes when they do not.

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

`lolly rebrand` reads a `.pptx` someone else made and turns it into the active design system's own: colours, fonts and logo snapped to the system, decoration and page furniture pulled out, kept content carried over. It runs in three explicit stages, so an agent or a script can look at what a deck's first pass proposed before anything is written:

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

## Related

- [Signing from the terminal](/info/cli-signing.html) - set up a real signing identity, so exports carry a verifiable name rather than an anonymous on-device key.
- [TUI](/info/tui.html) - the interactive, full-screen terminal counterpart. Same engine, same output; keyboard-driven instead of one-shot.
- [URL Mode](/info/url-mode.html) - the parameter model the CLI shares with the web shell (and the reserved params).
- [Exporting & Formats](/info/exporting.html) - what each format is for.
- [AI Agents](/info/ai-agents.html) - driving the same surface from an LLM.
- **/pro batch** - the web shell's interactive counterpart to the scripted fan-out loop above: a spreadsheet-style grid with CSV round-trip, spreadsheet paste and per-row output across one or many tools.
