# CLI batch and automation

Put Lolly in a pipeline: render a spreadsheet of files, gate a whole catalog in CI, preflight a print job and check documents before they ship. Every command answers with an exit code a script can branch on, listed in the [CLI reference](/info/cli-reference.html#exit-codes) with the `--json` envelope.

## Render many files from a spreadsheet (lolly batch)

A batch is **many URL-mode rows in one file**: each row is a render, with its inputs as cells. Write a starter grid for one or more tools, with their input columns and the output columns:

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

A **`toolId`** column is required. **`format`**, **`width`**, **`height`**, **`unit`**, **`dpi`** and **`filename`** are per-row output settings. Every other column is a **tool input id**, and its cell takes any URL-mode form: plain text, JSON or tilde-separated blocks, `id.field` vectors. Rows can mix tools freely, and the last row above places a catalog asset by its id (`lolly assets` lists the ids your profile carries).

Any reserved URL parameter also works as a column, because a row's cells are read exactly as a link's query is. `bleed`, `marks` and `press-profile` work that way; add them to the header by hand.

Use an `input.<id>` column when an input shares a reserved name: `input.width` sets the tool's width input while `width` sets the export width. The starter `--template=` leaves reserved-name inputs out and reports them; add their prefixed columns when needed.

**A transform tool runs from a batch too** (a file in, bytes out, such as `strip-data`). Put the input file's path in the tool's own file column; it resolves against the working directory, as on `lolly run`. Leave that row's `format`, `width`, `height`, `unit` and `dpi` blank, because the output follows the input file, and `--template=` warns which columns those are. The output is named from the row's `filename` or the input file, with the extension of the bytes the tool produced.

**`batch` renders bare.** A row carries no Content Credentials and no Imprint unless it asks, because a regenerated folder should not differ from the last one in every file. A `c2pa`, `imprint` or `durable` column opts a row back in, read exactly as `?c2pa=` is.

A batch stops at a failing row unless you pass `--keep-going`. Either way, its exit code is the **worst row's**, and `--json` gives one document with a per-row `exit`, so a pipeline can retry just the exit-`3` rows on a runner that has a browser. A batch writes a folder rather than one archive, so you choose your own `zip` or `tar`; the TUI's batch packs a ZIP instead. `--output` is refused, because one path cannot name many files; use `--out-dir`.

The app's **Batch** view (`#/batch`) is the same idea as an interactive grid.

## Plan, resume and watch production batches

These production controls are available in the current checkout. A standalone CLI
package needs a build that includes these changes.

```bash
lolly batch rows.csv --dry-run --json --out-dir=./out
lolly batch rows.csv --preflight --jobs=2 --json --out-dir=./out
lolly batch rows.csv --jobs=2 --keep-going --out-dir=./out
lolly batch rows.csv --resume --jobs=2 --out-dir=./out
lolly batch rows.csv --watch --jobs=2 --out-dir=./out
```

Dry run reports planned paths and dependency readiness without exporting. Preflight
checks row content; renderer readiness is a separate report. Workers run in separate
processes, with a maximum of eight, so tool DOM/global state cannot cross jobs.
`lolly preflight --batch=rows.csv` also checks a batch.

The default receipt is `out/.lolly-batch.json`; `--journal=path` chooses another.
Resume reuses a successful output only when the row, source/content snapshot and
output hash still match. Changed files, tools, tokens or assets invalidate reuse.
Network, live media, model, composition, external assets and unqualified hook paths
are conservative reruns. Renderer-dependent raster/PDF jobs are also rerun until their
renderer inputs have a qualified snapshot; native-format jobs can be reused. A source change during a run makes its rows ineligible for reuse. Receipts
record reused versus newly rendered rows; failed rows are retried.

`--rows=1,3` selects original 1-based rows. A dry run returns a `planId`;
`--expect-plan=<id>` refuses a changed review before starting workers. The TUI queue
uses these same controls. An output-directory lock prevents overlapping runs; after
a crash, resume recovers a same-user lock only when its PID is dead and the lock has
not changed during the check. Live, malformed and replaced locks are retained.

Watch monitors the named CSV and its file-input paths, with debounce. It does not
watch every catalog/model directory. Output changes do not trigger another run.
Watch uses terminal progress; `--watch --json` refuses because ordinary JSON mode
produces one result per invocation. Run separate JSON jobs for machine consumers.
Interrupting stops queued jobs and workers, records completed results and preserves
finished outputs for resume.

## Private inputs and saved projects

```bash
lolly run qr-code --inputs=inputs.json --output=qr.svg
lolly run qr-code --inputs=- --output=qr.svg < inputs.json
lolly projects list --query=conference --json
lolly projects show '<slot>' --json
lolly projects export '<slot>' --output=project.json
lolly projects copy '<slot>' --label='Conference copy'
```

Input JSON holds values rather than shell flags; explicit flags win. Loaded binary
inputs need their original file paths rather than an expanded JSON byte array. A project export
contains private document state, refuses an existing destination and can be opened
in the TUI. Projects are read from the device's shared session directory.

`run --share` omits personal/profile-bound fields and lists omitted field IDs on
stderr. `--include-personal` explicitly includes those fields after review. Requested
size and format travel with the link. Export passwords do not travel with that link.

## Convert check results for local automation

Save a command's normal JSON envelope, then convert that result without rerunning the check:

```bash
lolly check design.json --browser=off --json > check.json
lolly reports check.json --to=junit --output=checks.xml
lolly reports check.json --to=sarif --output=checks.sarif
lolly reports checks.jsonl --to=junit --output=combined.xml
cat check.json | lolly reports - --to=jsonl
lolly projects list --query=conference --null | xargs -0 -I '{}' lolly projects show '{}'
lolly projects list --null --paths
```

`reports` accepts check/preflight/learning findings and production batch receipts. JSONL
input holds one original report per line; `--input-format=jsonl` selects that input on
stdin. JSONL output holds one normalized finding or row outcome per line. This is report
transport; ordinary batch rendering still takes its existing CSV/TSV transport.

JUnit retains failures and skipped/unavailable coverage. SARIF retains document pointers,
layer/page/theme context and stable finding fingerprints. A physical source location appears
only when the original finding supplied a file and line; document coordinates do not become
invented source lines. Unknown report shapes refuse. Existing output files are refused.
Conversion success means the report was written; the original command's verdict still
belongs to its saved envelope. Nothing is uploaded and no CI job starts.

Project `--null` output carries stable slot IDs, including names with spaces or newlines.
`--paths` selects the actual session files instead. `--json` and `--null` are separate output
choices; default project discovery keeps its existing JSON shape.

## Render-check the catalog (lolly smoke)

```bash
lolly smoke                              # render every tool at manifest defaults
lolly smoke --only=qr-code,chart         # just these ids
lolly smoke --format=svg                 # force one browser-free format
```

`lolly smoke` is the catalog-wide render gate. Every tool in the active profile renders at its defaults to its first browser-free format. A tool whose formats are all browser-only falls back to an `html` render, which still runs load, hydrate and hooks. Each output is checked for blank or empty results, each tool prints a ✓ or ✗ row and the exit code is non-zero if anything fails. Wired into CI, a `hooks.js` regression cannot ship a tool that renders blank. `smoke` renders bare, like `batch`.

A transform tool (`strip-data`, `compress-pdf` and the other on-device utilities) has nothing to render at its defaults, so smoke runs it once over a small committed fixture, chosen by the file types its input accepts. It passes when the output is non-empty and is one of the formats the tool declares; a hook error is a real failure.

::: details When smoke skips a tool
A tool is skipped, with the reason, when:

- it needs a live-capture capability (camera, microphone, screen, capture);
- its file input accepts no fixture type;
- its hook needs the paint tier or a model this machine has not staged;
- its file input is hidden at its defaults (`showIf`);
- a forced `--format` differs from the fixture's container.

The fixtures live in the checkout's `tests/fixtures`, so an installed CLI with no checkout skips every transform and says why.
:::

## Preflight an export (lolly preflight)

```bash
pnpm --silent run cli preflight qr-code --export=pdf-cmyk     # count and check, do not render
pnpm --silent run cli preflight qr-code --export=pdf-cmyk \
    --width=210 --height=297 --unit=mm --bleed=3mm --marks=crop,reg
pnpm --silent run cli preflight qr-code --export=svg --json | jq   # the machine report
pnpm --silent run cli preflight 'https://lolly.tools/t/qr-code?url=…&format=pdf-cmyk'
```

`lolly preflight` answers "what am I about to export, and is anything wrong with it" without rendering. It takes the **same** render flags a real run takes, including `--input.<id>=` and a pasted share link (`https` or `lolly://`), because checking other settings than the render would use proves nothing. The rules live in the engine (`engine/src/preflight.ts`), so the app's export panel and this command report the same findings for the same job. A reserved flag that shadows a tool input warns here as it does on `lolly run`, and the report records it as `collect.reserved-flag-shadows-input`.

| Flag | Effect |
|---|---|
| `--json` | One JSON document on stdout and nothing else. |
| `--strict` | Warnings fail the run too: an opt-in CI gate. |
| `--rate-card=<file>` | Price the job from a local rate-card file, adding a cost block. A path only: rates are never read from a pasted link, so a shared URL can never carry prices. |
| `--run-length=<n>` | The quantity the cost is worked out for. |
| `--use-expired-rates` | Opt in past a card's `validUntil`; otherwise expired rates hide the money figures while the counts still show. |

There is no `--out`: the report goes to stdout, so redirect it (`lolly preflight qr-code --json > report.json`). `--rates` is also refused; the flag is `--rate-card`. For many jobs, `lolly preflight --batch=rows.csv` uses the production batch checks described above.

Preflight exits `0` when there is nothing to fix, `4` when a check says no (an error finding, or a warning under `--strict`) and `2` when it could not run: an unknown tool, an unreadable manifest, a `zx=` link with no password or a refused flag. It never exits `1`. A count that cannot be **taken**, such as "needs the artwork on screen", "no brand palette resolved" or "no physical page size was set", is a stated gap in the report, not a failure. With `--json`, stdout holds exactly one document on every path, including exit `2`; read the findings at `.result.findings`.

The report's `job` records the context it was taken in as well as the tool and format: `source`, `modelPhase`, `stageMounted`, `paletteResolved` and the settings the findings were taken against. A clean report taken headlessly, with no palette and no `onInit` run, must not look like one taken with all three, because the report is the copy that travels.

The optional `checks` list records which rules ran: each is `completed` (including rules that do not apply to this job) or `undetermined`. A rule that throws adds a `check.incomplete` gap and no partial measurements. Older reports without `checks` have unknown coverage. Exit `0` does not mean every production requirement was measured; for that, see [Production checks](/info/production-checks.html).

::: warning A finish has a plate of its own only in the CMYK PDF
If your brand declares a spot ink that is really a **finish** (a foil, an emboss, a spot varnish, a cutting rule), the CMYK PDF writes it as its own named plate, which overprints the artwork beneath. Its process fallback is a 100% black mask, so a RIP that flattens spots prints an obvious mask rather than a plausible metallic. The CMYK TIFF and `eps-cmyk` have no named plates, so they write the finish as that black mask. Agree with your printer how they want the finish supplied before you send the file.
:::

<a id="check-a-design-document-in-ci-lolly-check"></a>
## Check a Lolly Design document in CI (lolly check)

`lolly check` gives one findings list for a Lolly Design document, a `.lolly` or an export, and its exit code is the branch:

```bash
lolly check slides.lolly --source=old.inventory.json --json > check.json
```

It exits `0` when there is nothing to fix, `5` when there are findings to review and none are errors, `4` on an error finding (or any warning under `--strict`), `3` with `--browser=require` on a runner with no paint tier, `2` on a usage error and `1` when a family failed to run. A runner with no browser reports the render family as `unavailable` and still runs the rest, so pass `--browser=require` where those checks must run. Text recognition is off unless you pass `--ocr`, so every runner gives the same answer. Read the findings at `.result.findings`, each with a stable `code`, its `severity` and the `layerId` it points at. [Check the recreation](/info/cli-decks.html#check-the-recreation) describes each family.

## Scripting & CI

The same inputs give the same **render** every time, which makes a tool a build step rather than a generator. Run the CLI wherever you make other build outputs:

```bash
# Generate an OG image at build time instead of committing a binary:
lolly link-card --url=https://example.com --heading="Ship today." --export=png --output=./public/og.png
```

The same render is not always the same bytes. A default render is signed, and the signature alone moves the bytes; the next two sections measure what that costs and which formats can repeat byte for byte.

### What provenance costs

Content Credentials and the Imprint are on by default, as in the app. They cost different things:

- **A credential is a signature and a metadata block.** It adds about 2 KB and no measurable time.
- **The Imprint is a pixel watermark.** On a raster it costs time that grows with the pixel count (about 0.06 s at 600 px, 0.35 s at 2000 px), and it grows a lossless PNG, because the mark adds fine detail that compression cannot squeeze out. The effect is far smaller in a lossy format and absent in a vector one, which has no pixels to mark.

::: figure cli-automation-provenance
How much bigger a QR code file gets than its bare render, for each mark.
:::

Leaving both on means the file carries a statement of where it came from that any C2PA reader can check, naming you if you have [set up an identity](/info/cli-signing.html), plus a mark that survives a re-encode or a screenshot, which a metadata credential does not. Turning them off with `--no-provenance` gives byte-identical output and the "bare" sizes below. `smoke` and `batch` already render bare.

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

```text
$ lolly qr-code --url=https://example.com --export=svg --output=d1.svg   # twice, defaults
$ lolly qr-code --url=https://example.com --export=svg --output=d2.svg
DIFFER
$ lolly qr-code --url=https://example.com --export=svg --no-provenance --output=n1.svg
$ lolly qr-code --url=https://example.com --export=svg --no-provenance --output=n2.svg
IDENTICAL
```

Even bare, only some formats repeat byte for byte. Measured by hashing two consecutive runs of the same command with `--no-provenance` (PNG from the browser-free tier gives the same result as SVG above):

| Path | Byte-identical across runs? | Measured with |
|---|---|---|
| **SVG**, **EMF**, **EPS**, **DXF** | **Yes.** Nothing in the format carries a clock or a random seed. | `qr-code --url=https://example.com` |
| **JSON, CSV, VCF, MD** | **Yes**, for the format. | `color-palette --export=csv`, `chart --export=md`, `meeting-planner --export=json`; no public tool exports VCF |
| **ICS** | **No.** RFC 5545 requires a `DTSTAMP`, which is the clock: two runs a second apart differ in exactly that line. | `calendar-ics --export=ics` |
| **PNG** from an `<svg>`-based tool (the resvg tier) | **Yes.** | `qr-code --export=png` |
| **PDF** | **No.** Every PDF carries `/CreationDate` and `/ModDate`: 128 bytes differed in a measured 57 KB file with `--c2pa=off`, all in the trailer and metadata. | `qr-code --export=pdf --c2pa=off` |
| **JPG, WebP, HTML-layout PNG** (the paint tier) | **No.** The browser's paint and encode change run to run; even the file length moves. | `qr-code --export=jpg`, `qr-code --export=webp` |
| **Video** (`gif`, `apng`, `webm`, `mp4`) and **PPTX** | **No**, for the same reason plus a frame-timed capture. They render here ([Video and timelines](/info/cli-rendering.html#video-and-timelines)); it is their byte identity that does not hold. | `design --export=mp4`, `design --export=webm`, `deck-studio --export=pptx` |
| Anything with `--c2pa`, `--durable` or `--imprint`, **which is the default** | **No.** Each credential has a fresh timestamp, and the Imprint moves the pixels. | `qr-code --export=svg` (defaults) |

Two limits the table cannot show. Format-level reproducibility is not tool-level: a tool that draws the current time or the weather gives different bytes in any format, and that is the tool doing its job. And these runs were on one machine, back to back; a different OS, font set or engine version moves the bytes of anything that shapes text.

So check the hash of an SVG rendered with `--no-provenance` into a lockfile if you like. Do **not** build a CI gate on the hash of a PDF, an ICS, a JPEG, a paint-tier PNG or anything signed: compare those by rendering and inspecting. [Determinism](/info/determinism.html) explains why the same inputs give the same render.

## The GitHub Action

The repository carries a GitHub Action, in the `action/` folder of the source, that runs this CLI inside a GitHub job: one render, or one file for each row of a CSV or TSV. The flags it passes are the same `--key=value` flags you type at a desk. Until the action has a release of its own, pin it to a commit:

```yaml
- uses: lolly-tools/lolly/action@<commit>
  id: render
  with:
    tool: qr-code
    args-json: '["--url=https://example.com"]'
    format: svg
- run: ls "${{ steps.render.outputs.out-dir }}"
```

`rows` takes the path of a batch sheet instead of `tool`, and `browser: 'true'` installs the scoped browser for raster, PDF and video from tools that lay out in HTML. [The action's README](https://github.com/lolly-tools/lolly/tree/main/action) lists every input and output, with a pinned commit and worked examples.

## Organisation jobs with Lolly Work

The `lolly` CLI renders on the machine that runs the command. When an organisation needs jobs it can keep, inspect, retry or deliver centrally, the optional Lolly Work control plane offers a separate `lw` client and authenticated APIs at `/api/v1/renders` and `/api/v1/render-batches`.

Those jobs run on the organisation's server, under its tool permissions and policy. Requests support idempotency keys, status, cancellation, retries and retained output; recovery after a restart needs a persistent deployment. Formats that need a browser need the configured render worker. Automation can sign in with a scoped service token, and governed delivery can use finished render output without uploading the bytes again.

The Lolly Work [render jobs](/info/work-renders.html), [lw CLI](/info/work-cli.html) and [delivery](/info/work-delivery.html) guides give the request formats and commands. The local batch and CI examples on this page keep working without Lolly Work.
