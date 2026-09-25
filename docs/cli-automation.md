# CLI batch and automation

Run batches, preflight outputs and integrate predictable results into scripts and CI.

Part of [CLI](/info/cli.html).

## Batch

A batch is **many URL-mode rows under one file** - the same principle as a single render, tabulated. `lolly batch <rows.csv>` renders one output per row into a directory (a directory, not a zip: the lean CLI has no zip dependency, and a folder composes with your own `zip`/`tar`; the TUI's batch packs a zip instead).

```bash
# Author a starter grid for one or more tools (their input columns + reserved columns):
pnpm --silent run cli batch --template=qr-code,chart-creator > rows.csv

# Render every row → ./out/NN-<name>.<fmt>
pnpm run cli batch rows.csv --out-dir=./out [--keep-going]
```

The header row lists the columns: a **`toolId`** column is required; **`format` · `width` · `height` · `unit` · `dpi` · `filename`** are per-row output settings; every other column is a **tool input id** whose cell is a value (any URL-mode form - plain text, JSON/tilde blocks, `id.field` vectors). Rows can mix tools freely. Example:

```csv
toolId,format,url,color,src
qr-code,svg,https://suse.com,#0c322c,
qr-code,png,https://opensuse.org,#30ba78,
asset-export,pdf,,,suse/logo/hor-neg-green
```

(That last row uses `asset-export` and a `suse/…` asset id, so it needs the SUSE brand pack mounted - swap in a tool and asset from your own profile.)

The header *is* the namespace here - a batch has no `--input.<id>=` escape - so an input whose id is one of those reserved names (`chart-creator` declares `width` and `height`) cannot be set per row, and `--template=` leaves it out rather than emitting a second column with the same name. It says which inputs it dropped. Render those with `lolly run … --input.width=…`.

`--template=` writes the input columns plus those six output columns. It is not the whole set: **any reserved URL param works as a column**, because a row's cells are read exactly as a URL's query is. `bleed`/`marks`/`press-profile` ride that way; add them to the header by hand.

**A transform tool (`hooks.exportFile`: a file in, bytes out) runs from a batch too.** A row puts its input file in the tool's own file-input column, the path resolving against the working directory exactly as it does on `lolly run`. Leave that row's `format`, `width`, `height`, `unit` and `dpi` cells blank - a transform's output follows its input file's container, so it takes no export format, and `--template=` warns which columns to leave blank for the tools you named. The output is written `<seq>-<name>.<ext>`, the name from the row's `filename` column or the input file and the extension from the bytes the tool actually produced.

**`batch` renders bare.** Unlike a single `lolly run`, a batch row carries no Content Credentials and no Imprint unless it asks - a batch is a build step, and a regenerated folder should not differ from its predecessor in every file. A `c2pa` column (or `imprint`, or `durable`) opts a row back in and is read exactly as `?c2pa=` is. `smoke` renders bare for the same reason.

`--keep-going` renders past a failing row (otherwise the batch stops with a non-zero exit). Either way the batch's exit code is the **worst row's** code, not a flat 1, and `--json` gives one document with a per-row `exit` so a pipeline can retry just the exit-3 rows on a runner that has a browser. `--output` is refused: a batch has many outputs and one path cannot name them - use `--out-dir=`.

## Render-check the catalog (`lolly smoke`)

```bash
pnpm run cli smoke                              # render EVERY tool at manifest defaults
pnpm run cli smoke --only=qr-code,chart-creator # just these ids
pnpm run cli smoke --format=svg                 # force one Node-native format
```

`lolly smoke` is the catalog-wide render gate: every tool in the active profile renders at its manifest defaults to its first Node-native format - browser-free; a tool whose declared formats are all browser-only falls back to an `html` render, which still exercises load → hydrate → hooks. Every output is checked for blank or empty results, each tool prints a ✓/✗ row and the exit code is non-zero if anything fails - so wired into CI, a `hooks.js` regression can never ship a tool that renders blank.

A transform tool (`hooks.exportFile`: a file in, bytes out - `strip-data`, `compress-pdf`, and the rest of the on-device utilities) has nothing to render at manifest defaults, so smoke runs it once over a small committed fixture instead, chosen by the file type its input accepts, through the same transform path `lolly <tool> --source=<file>` takes. It passes when the output is non-empty and its bytes are one of the formats the tool declares, and a hook error is a real failure. A tool is skipped, with a reason, rather than run for any of these: it is gated on a live-capture capability (camera, microphone, screen, capture); its file input accepts no fixture type; its hook needs the browser tier or a model this host does not have staged; its file input is hidden at manifest defaults (`showIf`); or a forced `--format` differs from the fixture's container. The fixtures live in the source checkout's `tests/fixtures`, so an installed CLI with no checkout skips every transform and reports why.

## Preflight an export (`lolly preflight`)

```bash
pnpm --silent run cli preflight qr-code --export=pdf-cmyk     # count and check, do not render
pnpm --silent run cli preflight qr-code --export=pdf-cmyk \
    --width=210 --height=297 --unit=mm --bleed=3mm --marks=crop,reg
pnpm --silent run cli preflight qr-code --export=svg --json | jq   # the machine artifact
pnpm --silent run cli preflight 'https://lolly.tools/#/tool/qr-code?url=…&format=pdf-cmyk'
```

`lolly preflight` answers "what am I about to export, and is anything wrong with it" without rendering anything. It takes the SAME render flags a real run takes - `--export`, `--width`/`--height`/`--unit`/`--dpi`, `--bleed`, `--marks`, `--press-profile`, `--cuts`, `--hdr`, `--durable`, `--z`/`--zx` and a pasted share link (https or `lolly://`) - because preflighting settings other than the ones a render would use is worthless. The rules live in the engine (`engine/src/preflight.ts`), so the web export panel and this subcommand report the same findings for the same job.

That includes `--input.<id>=<value>`: a tool whose own input is called `width` is preflighted exactly as it would render, and a reserved flag that shadows one of the tool's inputs prints the same warning here as it does on `lolly run` (and carries it into the report as `collect.reserved-flag-shadows-input`).

It has five flags of its own:

| Flag | Effect |
|---|---|
| `--json` | one JSON document on stdout and nothing else |
| `--strict` | warnings fail the run too (opt-in CI gate) |
| `--rate-card <file>` | price the job from a local rate-card file, adding the cost block to the report. A path only - rates are never read off a pasted link's query, so a shared URL can never bring money with it |
| `--run-length <n>` | the quantity the cost is worked out for (a run of n) |
| `--use-expired-rates` | opt in past a card's `validUntil` - expired rates otherwise suppress the money figures while the counts still show |

There is no `--out`. The report always goes to stdout, so redirect it: `lolly preflight qr-code --json > report.json`.

Exit codes: **0** it ran and there is nothing to fix, **4** (`REFUSED`) it ran and a check said no - at least one error finding, or a warning under `--strict`, **2** (`USAGE`) it could not run at all: unknown tool, unreadable manifest, a `zx=` link with no password, a refused flag. It never returns `1`: a preflight that ran is not a failed run, and `4` is the code `lolly validate` already uses for the same event, so one CI branch handles both. A count that cannot be TAKEN is never a failure: "needs the artwork on screen", "no brand palette resolved", "no physical page size was set" are stated gaps in the report, and they exit 0 permanently. With `--json`, stdout carries exactly one JSON document on **every** path, including exit 2 - the shared envelope, with the report as `result` and, on the failure path, `ok:false` plus an `error` - so `lolly preflight X --json > r.json` never leaves an unparseable file behind. Read the findings at `.result.findings`.

The report's `job` member carries the collection context as well as the tool and format - `source`, `modelPhase`, `stageMounted`, `paletteResolved` and an echo of the settings the findings were taken against. A clean report taken headlessly with an unresolved palette and an un-run `onInit` must not look identical to one taken with all three in hand, because the artifact is the copy that travels.

Three things it deliberately refuses rather than silently ignoring: `--rate-card` (preflight counts, it does not cost - there are no rates and no money anywhere in it), `--batch` (not implemented yet; a silently-ignored `--batch=rows.csv` would print a confident single-job report that reads like a 50-row answer) and `--out` (removed before GA, with the redirect named in the message).

The finding to know about: if your brand declares a spot ink that is actually a FINISH (a foil, an emboss, a spot varnish, a cutting rule), Lolly writes it as its own named plate whose process fallback is a 100% black mask, in every CMYK sink - the CMYK PDF, the CMYK TIFF and `eps-cmyk` in both the browser and this CLI. It is never given the swatch's own colour build, so a RIP that flattens spots paints an unmistakable mask rather than a plausible metallic. What is still wrong, and what the error actually says: **overprint is implemented nowhere in the platform, so the finish plate knocks out the artwork beneath it**. Agree with your printer how they want the finish supplied before sending the file.

## Scripting & CI

The same inputs give the same **render** every time - that is what makes a tool a build artifact rather than a generation - so you can run the CLI wherever you generate other build outputs. ("The same render" is not "the same bytes": see the measurements below, and note that a default render is *signed*, which alone is enough to move the bytes.)

```bash
# Generate an OG image at build time instead of committing a binary:
pnpm run cli quotes --quote="Ship it." --export=svg --output=./public/og.svg   # `quotes` is a SUSE-pack tool
```

### What provenance costs

Content Credentials and the Imprint are on by default here, exactly as in the app. Turning them off is a supported choice, so here is what it buys, measured on one machine (Apple silicon, Node tier, five runs per case, best-to-worst spread shown). Your numbers will differ; the pattern will not.

| Case | Time | Output |
|---|---|---|
| `qr-code --export=svg` bare | 0.38 - 0.39 s | 17,205 B |
| same, defaults (credential; SVG carries no Imprint) | 0.39 - 0.44 s | 19,946 B (+2,741 B, +16%) |
| `qr-code --export=png` 600 px, bare | 0.46 - 0.47 s | 14,786 B |
| same, credential only (`--imprint=0`) | 0.46 - 0.48 s | 16,799 B (+14%) |
| same, Imprint only (`--c2pa=off`) | 0.52 - 0.66 s | 36,572 B (+147%) |
| same, defaults (both) | 0.52 - 0.70 s | 38,586 B (+161%) |
| `qr-code --export=png` 2000 px, bare | 0.48 - 0.49 s | 62,357 B |
| same, defaults | 0.83 - 0.93 s | 228,825 B (+267%) |

The two marks cost different things. **A credential is a signature and a metadata block**: about 2 KB, and no measurable time. **The Imprint is a pixel watermark**, so on a raster it costs time that scales with pixel count (about 0.06 s at 600 px, about 0.35 s at 2000 px) and it grows the file, because the mark adds fine detail that lossless PNG compression cannot squeeze away. That size effect is much smaller in a lossy format, and absent in a vector one, which has no pixels to mark.

Leaving them on means the file carries a verifiable statement of where it came from: a credential that any C2PA reader can check and that names your identity if you have [set one up](/info/cli-signing.html), plus a mark that survives a re-encode or a screenshot, which a metadata credential does not. Turning them off means byte-reproducible output, the times and sizes in the "bare" rows and no embedded timestamp.

`--no-provenance` is the switch, per run. `smoke` and `batch` already render bare, because a machine path wants reproducibility by default.

### How far "the same" goes, byte for byte

Reproducible *renders* and reproducible *bytes* are not the same promise, and only some formats keep the second one.

**Start here: a default render is not byte-reproducible, and that is deliberate.** Content Credentials and the Lolly Imprint are on by default (as in the app), and a credential is signed with a fresh key and a fresh timestamp every time. Pass **`--no-provenance`** for a bare render, which is what the rows below are measured with. `smoke` and `batch` already do.

```
$ lolly qr-code --url=https://suse.com --export=svg --output=d1.svg   # twice, defaults
$ lolly qr-code --url=https://suse.com --export=svg --output=d2.svg
DIFFER
$ lolly qr-code --url=https://suse.com --export=svg --no-provenance --output=n1.svg
$ lolly qr-code --url=https://suse.com --export=svg --no-provenance --output=n2.svg
IDENTICAL
```

Same result for `--export=png` (the browser-free resvg tier), measured the same way.

Measured, not assumed - two consecutive runs of the same command, hashed, **with `--no-provenance`**:

| Path | Byte-identical across runs? | Measured with |
|---|---|---|
| **SVG**, **EMF**, **EPS**, **DXF** | **Yes.** Nothing in the format carries a clock or a random seed. | `qr-code --url=https://suse.com` |
| **JSON, CSV, VCF, MD** | **Yes**, for the format. | `chart-creator --export=csv`, `quotes --export=md`†, `email-signature --export=vcf`†, `meeting-planner --export=json`† |
| **ICS** | **No.** RFC 5545 requires a `DTSTAMP`, which is the clock: two runs a second apart differ in exactly that line. | `calendar-ics --export=ics`† |
| **PNG** from an `<svg>`-based tool (the resvg tier) | **Yes.** | `qr-code --export=png` |
| **PDF** | **No.** Every PDF carries `/CreationDate` and `/ModDate`; two runs a second apart differ in those bytes (128 differing bytes in a measured 57 KB file with `--c2pa=off`, all of them in the trailer and metadata). | `qr-code --export=pdf --c2pa=off` |
| **JPG, WebP, HTML-layout PNG** (the headless-Chromium tier) | **No.** The browser's paint and encode are not byte-reproducible run to run; the file length itself moves between runs. | `qr-code --export=jpg`, `qr-code --export=webp`, `color-block --export=png`† |
| **Video** (`gif`/`apng`/`webm`/`mp4`) and **PPTX** | **No**, for the row above's reason plus a frame-timed capture. These do render here, and what they cost and produce is measured ([Video and timelines](/info/cli-rendering.html#video-and-timelines)); it is their run-to-run byte identity that is not, and nothing about a browser encode suggests it holds. | `design --export=mp4`, `design --export=webm`, `deck-studio --export=pptx` |
| Anything carrying `--c2pa`, `--durable` or `--imprint` - **which is the default** | **No.** A credential is signed with a fresh timestamp, by design; the Imprint moves the pixels. Drop them with `--no-provenance`. | `qr-code --export=svg` (defaults) |

† These commands name tools from the **SUSE brand pack**, which is a private submodule. On a community-only clone the active profile is `lolly-start` and they print `Tool not found`. The measurements were taken on the SUSE profile; the format-level claim in each row is what travels, not the specific command.

Two caveats the table cannot carry. **Format-level reproducibility is not tool-level reproducibility**: a tool that renders the current time, the weather or a live clock produces different bytes in any format, and that is the tool doing its job. And these are *this machine, back to back* - a different OS, a different font set or a different engine version will move the bytes of anything that shapes text.

So: check a hash of an SVG into a lockfile if you like - **rendered with `--no-provenance`** - and do **not** build a CI gate on the hash of a PDF, an ICS, a JPEG, a browser-tier PNG, or anything signed. Compare those by rendering and inspecting, not by digest.

### Exit codes

One code per outcome, so a pipeline can branch instead of grepping stderr. Frozen at GA:

| Code | Name | Meaning |
|---|---|---|
| 0 | `OK` | The requested thing was produced. |
| 1 | `FAILED` | It was possible, it ran, it failed (a hook threw, the render produced nothing). |
| 2 | `USAGE` | Wrong invocation: unknown tool, undeclared format, missing argument, unreadable path. |
| 3 | `UNAVAILABLE_HERE` | Impossible in **this** installation - no browser, an unmet capability, a Tier B render that could not produce the file, an on-device model that is not staged (`error.kind` `MODEL_NOT_STAGED` or `MODEL_NOT_INSTALLED`), a runtime this install does not carry (`CAPABILITY_UNAVAILABLE`), or `--hdr` with `--durable` (`HDR_DURABLE_UNAVAILABLE`). May well succeed on another runner; this is the code to retry elsewhere on. |
| 4 | `REFUSED` | A protective check **this shell** ran said no: the bytes were not the format claimed, a credential is present but broken, `--strict` promoted a gate-class warning, `--depth=float` over an 8-bit render. A gate inside a tool's own hook (`--verify`) throws like any other hook and exits with `1`. |
| 5 | `NOT_FOUND` | A legitimate negative answer. `validate`: no credential present. Not an error. |
| 6 | `AUTH` | Missing or wrong password. |
| 70 | `INTERNAL` | Unclassified exception: a bug in Lolly. Distinct so an agent stops retrying it. |

Messages go to stderr (`--verbose`, or `DEBUG=1`, adds stack traces). Input validation failures list each offending field.

### Machine interface (`--json`)

`--json` is valid on `list`, `describe`, `assets`, `validate`, `smoke`, `batch`, `preflight`, `models`, `speak`, `transcribe`, `ocr`, `detect-ai`, `reword` and `rebrand`. It puts **one JSON document on stdout and nothing else**; every human line moves to stderr. It is deliberately **not** available on a render, because a render's stdout is the exported file - asking for both is a usage error rather than a silently ignored flag. `lolly speak --out=- --json` is refused for the same reason: the WAV and the document cannot both be stdout.

Every one of those except `ocr`, `detect-ai` and `reword` answers in the shared envelope below. Those three currently emit their own smaller `{ "ok": true, "command": …, … }` document instead - one JSON document on stdout either way, but do not expect `schemaVersion` or `warnings` from those three yet.

Every command answers in the same envelope:

```json
{
  "schemaVersion": 1,
  "command": "validate",
  "ok": true,
  "engine": "1.115.0",
  "cli": "0.1.0",
  "result": { },
  "warnings": [{ "code": "UNKNOWN_FLAG", "message": "…", "kind": "usage" }],
  "error": null
}
```

The two version strings are whatever *this* installation runs, not a fixed pair - read them from the envelope rather than from this page.

The envelope covers the **failure** path too: a missing file, an unknown tool, a crash - stdout still carries a complete document, so `lolly … --json > r.json` never leaves an unparseable file behind. On that path `result` is `null` and `error` is filled in:

```json
"error": { "code": "UNAVAILABLE_HERE", "exit": 3, "kind": "FORMAT_UNAVAILABLE", "message": "…" }
```

Branch on `error.kind` and `error.exit`, never on `error.message` - the wording is not a stable interface. `ok` mirrors the exit code; note that a real *answer* can be non-zero (`validate` reporting no credential exits 5 with a full `result`).

**Compatibility rules.** Keys may be added inside `result`, `error` and `warnings` at any time, and enum values may be added, so a consumer must ignore unknown keys and have a default branch. `schemaVersion` increments only when a key is removed, retyped, or changes meaning.

### Discovery, for an agent

```bash
lolly list --json          # every tool + what THIS installation can do
lolly describe qr-code --json    # one tool's full input schema
```

`list --json` carries a `result.environment` block: the engine and CLI versions, the resolved content root, the host capabilities this shell provides, the browser-free formats and a per-tier availability report (`domFree`, `raster`, `browser`, `images`) with the reason each unavailable tier is unavailable. Each tool in the list carries `capabilities`, `unmetCapabilities`, `nativeFormats` and `runnableHere` - so an agent can tell that `screencap` will exit 3 here **before** it tries, rather than after.

`describe --json` returns each input's declared spec plus three things the manifest cannot know: `flag` (the actual command-line spelling), `urlParam` (the compact alias, when the tool declares one) and `syntax` (how a non-scalar type is expressed). For the handful of inputs whose id collides with a reserved export flag - `width`, `height`, `format` - `flag` is `--input.<id>=` and `shadowedByReservedParam` is `true`, which is exactly the case where reading the bare id off the manifest would set the export size instead of the input.

[Back to CLI](/info/cli.html).
