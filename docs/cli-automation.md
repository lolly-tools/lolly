# CLI batch and automation

Use Lolly in a pipeline: render files from a spreadsheet, check the catalog in CI, preflight a print job and check documents before they ship. Every command returns an exit code a script can branch on; the [CLI reference](/info/cli-reference.html#exit-codes) lists the codes and the `--json` envelope.

<!--i:eti-table-->
## Render many files from a spreadsheet (lolly batch)

A batch is **many URL-mode rows in one file**. Each row is one render, with its inputs as cells. Write a starter grid for one or more tools, with their input and output columns:

```bash
pnpm --silent run cli batch --template=qr-code,asset-export > rows.csv
```

Fill in one row per file, then render every row into `./out/NN-<name>.<fmt>`:

```bash
lolly batch rows.csv --out-dir=./out
```

```csv
toolId,format,url,color,src
qr-code,svg,https://example.com,#0c322c,
qr-code,png,https://lolly.tools,#30ba78,
asset-export,pdf,,,lolly/logo/primary
```

Each row becomes one file, numbered in row order:

| Row in `rows.csv` | File in `./out` |
|---|---|
| `qr-code,svg,https://example.com,#0c322c,` | `01-qr-code.svg` |
| `qr-code,png,https://lolly.tools,#30ba78,` | `02-qr-code.png` |
| `asset-export,pdf,,,lolly/logo/primary` | `03-asset-export.pdf` |

A **`toolId`** column is required. **`format`**, **`width`**, **`height`**, **`unit`**, **`dpi`** and **`filename`** are per-row output settings. Every other column is a **tool input id**. Its cell takes any URL-mode form: plain text, JSON or tilde-separated blocks, `id.field` vectors. Rows can mix tools. The last row above places a catalog asset by its id; `lolly assets` lists the ids your profile carries.

A row's cells are read as a link's query is, so any reserved URL parameter also works as a column. Add `bleed`, `marks` and `press-profile` to the header by hand.

Use an `input.<id>` column when an input shares a reserved name: `input.width` sets the tool's width input, and `width` sets the export width. The starter `--template=` leaves reserved-name inputs out and reports them. Add their prefixed columns when needed.

**A transform tool runs from a batch too** (a file in, bytes out, such as `strip-data`). Put the input file's path in the tool's file column. The path resolves against the working directory, as on `lolly run`. Leave that row's `format`, `width`, `height`, `unit` and `dpi` blank, because the output follows the input file; `--template=` warns which columns those are. The output takes its name from the row's `filename` or the input file, and its extension from the bytes the tool produced.

::: note A batch renders bare
A row carries no Content Credentials and no Imprint unless it asks, because a regenerated folder should not differ from the last one in every file. A `c2pa`, `imprint` or `durable` column opts a row back in, read as `?c2pa=` is.
:::

A batch stops at a failing row unless you pass `--keep-going`. Either way, its exit code is the **worst row's**. `--json` gives one document with a per-row `exit`, so a pipeline can retry only the exit-`3` rows on a runner that has a browser. A batch writes a folder, not an archive: pack the folder with your own `zip` or `tar`. The TUI's batch packs a ZIP instead. `--output` is refused, because one path cannot name many files; use `--out-dir`.

The app's **Batch** view (`#/batch`) does the same in an interactive grid.

<!--i:eti-clipboard-->
## Plan, resume and watch production batches

::: note Needs Lolly 1.2.0
A standalone CLI from an earlier release does not have these production controls.
:::

```bash
lolly batch rows.csv --dry-run --json --out-dir=./out
lolly batch rows.csv --preflight --jobs=2 --json --out-dir=./out
lolly batch rows.csv --jobs=2 --keep-going --out-dir=./out
lolly batch rows.csv --resume --jobs=2 --out-dir=./out
lolly batch rows.csv --watch --jobs=2 --out-dir=./out
```

**Plan before you run.** A dry run reports planned paths and dependency readiness without exporting. Preflight checks row content; renderer readiness is a separate report. Workers run in separate processes, at most eight, so tool DOM/global state cannot cross jobs.

**Receipts and resume.** The default receipt is `out/.lolly-batch.json`; `--journal=path` chooses another. Resume reuses a successful output only when the row, the source/content snapshot and the output hash still match. Changed files, tools, tokens or assets stop reuse. Rows with network, live media, model, composition, external assets or unqualified hook paths are rerun to be safe. Renderer-dependent raster/PDF jobs are also rerun until their renderer inputs have a qualified snapshot; native-format jobs can be reused. A source change during a run makes its rows ineligible for reuse. Receipts record which rows were reused and which were rendered again. Failed rows are retried.

**Rows, plans and locks.** `--rows=1,3` selects original rows, counted from 1. A dry run returns a `planId`; `--expect-plan=<id>` refuses to start workers when the reviewed plan has changed. The TUI queue uses the same controls. A lock on the output directory prevents overlapping runs. After a crash, resume recovers a lock from the same user only when its PID is dead and the lock has not changed during the check. Live, malformed and replaced locks are kept.

**Watch.** Watch monitors the named CSV and its file-input paths, with debounce. It does not watch every catalog/model directory. Output changes do not trigger another run. Watch shows terminal progress. `--watch --json` is refused, because JSON mode gives one result per run; run separate JSON jobs for machine consumers. An interrupt stops queued jobs and workers, records completed results and keeps finished outputs for resume.

<!--i:eti-lock-->
## Private inputs and saved projects

```bash
lolly run qr-code --inputs=inputs.json --output=qr.svg
lolly run qr-code --inputs=- --output=qr.svg < inputs.json
lolly projects list --query=conference --json
lolly projects show '<slot>' --json
lolly projects export '<slot>' --output=project.json
lolly projects copy '<slot>' --label='Conference copy'
```

Input JSON holds values, not shell flags; explicit flags win. A binary input needs its original file path, not an expanded JSON byte array. A project export contains private document state, refuses an existing destination and opens in the TUI. Projects are read from the device's shared session directory.

`run --share` omits personal/profile-bound fields and lists their IDs on stderr. `--include-personal` includes those fields after review. The requested size and format travel with the link. Export passwords do not travel with the link.

<!--i:eti-file-->
## Convert check results for local automation

Save a command's JSON envelope, then convert the result without rerunning the check:

```bash
lolly check design.json --browser=off --json > check.json
lolly reports check.json --to=junit --output=checks.xml
lolly reports check.json --to=sarif --output=checks.sarif
lolly reports checks.jsonl --to=junit --output=combined.xml
cat check.json | lolly reports - --to=jsonl
lolly projects list --query=conference --null | xargs -0 -I '{}' lolly projects show '{}'
lolly projects list --null --paths
```

**What `reports` reads.** `reports` accepts check/preflight/learning findings and production batch receipts. JSONL input holds one original report per line; `--input-format=jsonl` selects that input on stdin. JSONL output holds one normalised finding or row outcome per line. This JSONL is for reports only; batch rendering still takes CSV/TSV.

**JUnit and SARIF.** JUnit has failures and skipped/unavailable coverage. SARIF has document pointers, layer/page/theme context and stable finding fingerprints. A source file and line appear only when the original finding supplied them; document coordinates do not become invented source lines. Unknown report shapes and existing output files are refused. Conversion success means the report was written. The verdict stays in the original command's saved envelope. Nothing is uploaded and no CI job starts.

**Project lists for scripts.** Project `--null` output carries stable slot IDs, including names with spaces or newlines. `--paths` gives the session files instead. `--json` and `--null` are separate output choices; the default project listing keeps its JSON shape.

<!--i:eti-flask-->
## Render-check the catalog (lolly smoke)

```bash
lolly smoke                              # render every tool at manifest defaults
lolly smoke --only=qr-code,chart         # just these ids
lolly smoke --format=svg                 # force one browser-free format
```

`lolly smoke` renders every tool in the active profile at its defaults, to its first browser-free format. A tool whose formats are all browser-only falls back to an `html` render, which still runs load, hydrate and hooks. Each output is checked for blank or empty results. Each tool prints a ✓ or ✗ row, and the exit code is non-zero if anything fails. In CI, this stops a `hooks.js` regression from shipping a tool that renders blank. `smoke` renders bare, like `batch`.

A transform tool (`strip-data`, `pages` and the other on-device utilities) has nothing to render at its defaults. Smoke runs the tool once over a small committed fixture, chosen by the file types its input accepts. It passes when the output is non-empty and in a format the tool declares. A hook error is a failure.

::: details When smoke skips a tool
A tool is skipped, with the reason, when:

- it needs a live-capture capability (camera, microphone, screen, capture);
- its file input accepts no fixture type;
- its hook needs the paint tier or a model this machine has not staged;
- its file input is hidden at its defaults (`showIf`);
- a forced `--format` differs from the fixture's container.

The fixtures live in the checkout's `tests/fixtures`, so an installed CLI with no checkout skips every transform and says why.
:::

<!--i:eti-checklist-->
## Preflight an export (lolly preflight)

```bash
pnpm --silent run cli preflight qr-code --export=pdf-cmyk     # count and check, do not render
pnpm --silent run cli preflight qr-code --export=pdf-cmyk \
    --width=210 --height=297 --unit=mm --bleed=3mm --marks=crop,reg
pnpm --silent run cli preflight qr-code --export=svg --json | jq   # the machine report
pnpm --silent run cli preflight 'https://lolly.tools/t/qr-code?url=…&format=pdf-cmyk'
```

`lolly preflight` reports what you are about to export and what is wrong, without rendering. It takes the **same** render flags as a run, including `--input.<id>=` and a pasted share link (`https` or `lolly://`). The rules live in the engine (`engine/src/preflight.ts`), so the app's export panel and this command report the same findings for the same job. A reserved flag that shadows a tool input warns as on `lolly run`, and the report records `collect.reserved-flag-shadows-input`. For a Design document, `--file=<tokens.json>` picks the design system as on `lolly run design`. The plates and inks are then counted from that system's colours, not the content profile's. A pasted link cannot pick the file: type `--file` after the link. A theme choice (`--_themes=<json>` or a link's `_themes`) decides which colours are counted, as in the export.

| Flag | Effect |
|---|---|
| `--json` | One JSON document on stdout and nothing else. |
| `--strict` | Warnings fail the run too: an opt-in CI gate. |
| `--rate-card=<file>` | Price the job from a local rate-card file, adding a cost block. A path only: rates are never read from a pasted link, so a shared URL can never carry prices. |
| `--run-length=<n>` | The quantity the cost is worked out for. |
| `--use-expired-rates` | Opt in past a card's `validUntil`; otherwise expired rates hide the money figures while the counts still show. |

There is no `--out`. The report goes to stdout; redirect stdout to a file (`lolly preflight qr-code --json > report.json`). `--rates` is also refused; the flag is `--rate-card`. For many jobs, `lolly preflight --batch=rows.csv` runs the production batch checks above.

Preflight exits `0` when there is nothing to fix, `4` when a check says no (an error finding, or a warning under `--strict`) and `2` when it could not run: an unknown tool, an unreadable manifest, a `zx=` link with no password or a refused flag. It never exits `1`. A count that cannot be **taken**, such as "needs the artwork on screen", "no brand palette resolved" or "no physical page size was set", is a stated gap in the report, not a failure. With `--json`, stdout holds exactly one document on every path, including exit `2`; read the findings at `.result.findings`.

The report's `job` records the tool, the format and the context: `source`, `modelPhase`, `stageMounted`, `paletteResolved` and the settings the findings were taken against. The report is the copy that travels, so a clean report taken headlessly, with no palette and no `onInit` run, must not look like one taken with all three.

The optional `checks` list records which rules ran: each is `completed` (including rules that do not apply to this job) or `undetermined`. A rule that throws adds a `check.incomplete` gap and no partial measurements. A report without `checks` has unknown coverage. Exit `0` does not mean every production requirement was measured; for that, see [Production checks](/info/production-checks.html).

::: warning A finish has a plate of its own only in the CMYK PDF
If your brand declares a spot ink that is a **finish** (a foil, an emboss, a spot varnish, a cutting rule), the CMYK PDF writes the finish as its own named plate, which overprints the artwork beneath. Its process fallback is a 100% black mask, so a RIP that flattens spots prints an obvious mask, not a plausible metallic. The CMYK TIFF and `eps-cmyk` have no named plates, so they write the finish as that black mask. Before you send the file, agree with your printer how to supply the finish.
:::

`--spots=process` prints every spot **ink** with the four process inks, for one export. Each ink takes the CMYK build its design system gives it, so a CMYK PDF has only the cyan, magenta, yellow and black plates. Use the flag when a printer asks for a plain four-colour file from a design system that gives its colours spot inks, such as Lolly Demo:

```bash
LOLLY_PROFILE=lolly-demo lolly run design --boxes-data=slides.json --export=pdf-cmyk --spots=process --output=four-colour.pdf
```

A finish is not an ink, so it keeps its own plate with `--spots=process`. Printing a finish in process would put its black mask on the page. The CMYK TIFF and `eps-cmyk` already print every ink in process, so the flag does not change them. The flag is off by default. It is the same choice as `_spots=process` in a link and **Print spot inks as process** in the app. The file records nothing about the choice. Any value other than `process` is refused with exit `2`. `lolly preflight` takes the flag too, and then counts the four process plates and any finish plates, with no spot plates.

<a id="check-a-design-document-in-ci-lolly-check"></a>
<!--i:eti-badge-check-->
## Check a Lolly Design document in CI (lolly check)

`lolly check` gives one findings list for a Lolly Design document, a `.lolly` or an export. Branch on its exit code:

```bash
lolly check slides.lolly --source=old.inventory.json --json > check.json
```

It exits `0` when there is nothing to fix, `5` when there are findings to review and none are errors, `4` on an error finding (or any warning under `--strict`), `3` with `--browser=require` on a runner with no paint tier, `2` on a usage error and `1` when a family failed to run. A runner with no browser reports the render family as `unavailable` and still runs the rest. Pass `--browser=require` where those checks must run. Text recognition is off unless you pass `--ocr`, so every runner gives the same answer. Each finding at `.result.findings` has a stable `code`, its `severity` and the `layerId` it points at. [Check the recreation](/info/cli-decks.html#check-the-recreation) describes each family.

`--kit=<partner-kit.json>` adds a partner kit's minimum size, clear space and treatment checks. Each is a brand review, never an error ([the other check flags](/info/cli-decks.html#the-other-check-flags)).

<!--i:eti-code-->
## Scripting & CI

The same inputs give the same **render** every time, so a tool can be a build step. Run the CLI where you make other build outputs:

```bash
# Generate an OG image at build time instead of committing a binary:
lolly link-card --url=https://example.com --heading="Ship today." --export=png --output=./public/og.png
```

The same render is not always the same bytes, because a default render is signed.

### What provenance costs

Content Credentials and the Imprint are on by default, as in the app. They cost different things:

- **A credential is a signature and a metadata block.** It adds about 2 KB and no measurable time.
- **The Imprint is a pixel watermark.** On a raster it costs time that grows with the pixel count (about 0.06 s at 600 px, 0.35 s at 2000 px). It also makes a lossless PNG larger, because compression cannot remove the fine detail the mark adds. The effect is far smaller in a lossy format and absent in a vector format, which has no pixels to mark.

::: figure cli-automation-provenance
How much bigger a QR code file gets than its bare render, for each mark.
:::

With both on, the file carries a statement of its origin that any C2PA reader can check. The statement identifies you if you have [set up an identity](/info/cli-signing.html). The mark survives a re-encode or a screenshot; a metadata credential does not. `--no-provenance` turns both off and gives the "bare" sizes below.

::: details The measurements
Measured in August 2026 on one machine (Apple silicon, Node tier, five runs per case, best to worst shown). Your numbers will differ; the pattern will not.

| Case | Time | Output |
|---|---|---|
| `qr-code --export=svg` bare | 0.38 to 0.39 s | 17,205 B |
| same, defaults (credential; SVG carries no Imprint) | 0.39 to 0.44 s | 19,946 B (+2,741 B, +16%) |
| `qr-code --export=png` 600 px, bare | 0.46 to 0.47 s | 14,786 B |
| same, credential only (`--imprint=0`) | 0.46 to 0.48 s | 16,799 B (+14%) |
| same, Imprint only (`--c2pa=off`) | 0.52 to 0.66 s | 36,572 B (+147%) |
| same, defaults (both) | 0.52 to 0.70 s | 38,586 B (+161%) |
| `qr-code --export=png` 2000 px, bare | 0.48 to 0.49 s | 62,357 B |
| same, defaults | 0.83 to 0.93 s | 228,825 B (+267%) |
:::

### How far byte-identical output goes

A default render is **not** byte-reproducible. A credential is signed with a fresh key and a fresh timestamp every time, and the Imprint moves the pixels. Pass `--no-provenance` for a bare render:

```bash
$ lolly qr-code --url=https://example.com --export=svg --output=d1.svg   # twice, defaults
$ lolly qr-code --url=https://example.com --export=svg --output=d2.svg
DIFFER
$ lolly qr-code --url=https://example.com --export=svg --no-provenance --output=n1.svg
$ lolly qr-code --url=https://example.com --export=svg --no-provenance --output=n2.svg
IDENTICAL
```

Even bare, only some formats repeat byte for byte. Measured by hashing two consecutive runs of the same command with `--no-provenance` (PNG from the browser-free tier matches SVG above):

| Path | Byte-identical across runs? | Measured with |
|---|---|---|
| **SVG**, **EMF**, **EPS**, **DXF** | **Yes.** Nothing in the format carries a clock or a random seed. | `qr-code --url=https://example.com` |
| **JSON, CSV, VCF, MD** | **Yes**, for the format. | `color-palette --export=csv`, `chart --export=md`, `meeting-planner --export=json`; no public tool exports VCF |
| **ICS** | **No.** RFC 5545 requires a `DTSTAMP`, which is the clock: two runs a second apart differ in exactly that line. | `meeting-planner --export=ics` |
| **PNG** from an `<svg>`-based tool (the resvg tier) | **Yes.** | `qr-code --export=png` |
| **PDF** | **No.** Every PDF carries `/CreationDate` and `/ModDate`: 128 bytes differed in a measured 57 KB file with `--c2pa=off`, all in the trailer and metadata. | `qr-code --export=pdf --c2pa=off` |
| **JPG, WebP, HTML-layout PNG** (the paint tier) | **No.** The browser's paint and encode change run to run; even the file length moves. | `qr-code --export=jpg`, `qr-code --export=webp` |
| **Video** (`gif`, `apng`, `webm`, `mp4`) and **PPTX** | **No**, for the same reason plus a frame-timed capture. They render here ([Video and timelines](/info/cli-rendering.html#video-and-timelines)); it is their byte identity that does not hold. | `design --export=mp4`, `design --export=webm`, `deck-studio --export=pptx` |
| Anything with `--c2pa`, `--durable` or `--imprint`, **which is the default** | **No.** Each credential has a fresh timestamp, and the Imprint moves the pixels. | `qr-code --export=svg` (defaults) |

::: note Lolly 1.2.0 draws headless canvases on the CPU
From Lolly 1.2.0, the browser that the CLI and the terminal app launch, and the MCP renderer, draw export canvases on the CPU, so the same render draws the same pixels. A running desktop app, which `LOLLY_RENDERER=auto` tries first, is not covered. The table above was measured before that change; its paint-tier rows have not been measured again.
:::

The table does not show two limits. A tool that draws the current time or the weather gives different bytes in any format. And these runs were on one machine, back to back; a different OS, font set or engine version changes the bytes of anything that shapes text.

You can check the hash of an SVG rendered with `--no-provenance` into a lockfile. [Determinism](/info/determinism.html) explains why the same inputs give the same render.

::: warning Do not gate CI on these hashes
For a PDF, an ICS, a JPEG, a paint-tier PNG or anything signed, compare by rendering and inspecting instead.
:::

**Check the file a render wrote.** `--export-report=<path>` compares what a render asked for with what the file's bytes hold. Each difference warns, so `--strict` exits `4` when the file is not what was asked for. For a PDF the report also lists the accessibility checks, each passed, failed, not applicable or needing a person to look. The report never claims that a PDF is accessible. [The render flags](/info/cli-rendering.html#flags) list what it reads.

<!--i:eti-package-->
## The GitHub Action

The `action/` folder of the repository has a GitHub Action that runs this CLI in a GitHub job: one render, or one file for each row of a CSV or TSV. It passes the same `--key=value` flags you type in a terminal. Until the action has its own release, pin the action to a commit:

```yaml
- uses: lolly-tools/lolly/action@<commit>
  id: render
  with:
    tool: qr-code
    args-json: '["--url=https://example.com"]'
    format: svg
- run: ls "${{ steps.render.outputs.out-dir }}"
```

`rows` takes the path of a batch sheet instead of `tool`. `browser: 'true'` installs the scoped browser for raster, PDF and video from tools that lay out in HTML. [The action's README](https://github.com/lolly-tools/lolly/tree/main/action) lists every input and output, with a pinned commit and worked examples.

<!--i:eti-building-->
## Organisation jobs with Lolly Work

The `lolly` CLI renders on the machine that runs the command. For jobs an organisation keeps, inspects, retries or delivers centrally, the optional Lolly Work control plane offers a separate `lw` client and authenticated APIs at `/api/v1/renders` and `/api/v1/render-batches`.

Those jobs run on the organisation's server, under its tool permissions and policy. Requests support idempotency keys, status, cancellation, retries and retained output. Recovery after a restart needs a persistent deployment. From Lolly Work 1.2.0 a job can also [call back a URL when it finishes](/info/work-renders.html#be-told-when-a-render-finishes), and a batch can [fill its rows from a data source](/info/work-renders.html#fill-the-rows-from-a-data-source) and [download as one ZIP](/info/work-renders.html#download-a-batch-as-one-zip). Formats that need a browser need the configured render worker. Automation can sign in with a scoped service token, and governed delivery can use finished render output without uploading the bytes again.

The Lolly Work [render jobs](/info/work-renders.html), [lw CLI](/info/work-cli.html) and [delivery](/info/work-delivery.html) guides give the request formats and commands. The local batch and CI examples on this page work without Lolly Work.
