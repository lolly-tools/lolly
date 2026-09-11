# CLI

`lolly` runs any tool from the terminal - same engine, same render path, same output as the web shell. It's **URL mode under a different transport**: `--foo=bar` argv pairs become the exact values the web shell parses from `?foo=bar`, so the CLI can never drift from the GUI. Great for build pipelines, CI, scripting and batch generation.

> Want an **interactive** terminal experience instead of one-shot commands - browse tools, tweak inputs, save projects, all from the keyboard? Run `lolly tui`, or see the [TUI](/info/tui.html). It shares this same engine and render path.

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

Any directory holding `tools/` and `catalog/` works; a checkout has both once `pnpm install` has built its profile views. The desktop app brings its own, so nothing needs pointing there. `lolly system import <pack.lolly>` is the third route, and it is a different thing: it imports **your design system** (colours, fonts, logos), which every render then uses, and it adds no tools, so it wants one of the other two beside it.

Run a command that needs content without any and the CLI prints those three routes and exits **3** (`UNAVAILABLE_HERE`), the retry-somewhere-else code. It never downloads anything on its own.

> **Redirecting or piping? Use `pnpm --silent run cli`.** npm prints its own two-line run banner (`> lolly@0.1.0 cli` …) on **stdout**, ahead of anything the CLI writes, so `pnpm run cli qr-code --export=png > qr.png` produces a file whose PNG magic starts 95 bytes in and `file` reports as `data`. The CLI's own rule holds - stdout is the payload - but npm's wrapper breaks it before the CLI runs. `--silent` suppresses the banner; an installed `lolly` binary never has it. Every redirecting example below is written that way.

`lolly --help` prints the same surface this page documents - every flag and every exit code - so a script author never has to leave the terminal to find them.

## Discovering tools & assets

```bash
pnpm run cli                      # list every tool (id, status, description)
pnpm run cli list              # the same thing, spelled explicitly
pnpm run cli describe qr-code  # that tool's inputs, defaults, and formats
pnpm run cli qr-code           # sugar for describe, when no flags follow
pnpm run cli assets            # list every catalog asset id (logos, icons, photos…)
pnpm run cli assets logo       # filter by substring
pnpm run cli assets --type=raster
```

`describe <tool-id>` (and its bare `<tool-id>` sugar) prints the input schema and a usage line - including a `↳` syntax hint for the non-scalar input types (how to express `asset`, `blocks`, `vector`, `file`, `color` values). The fastest way to learn what a tool accepts.

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

The first argument is either a **verb** or a **tool id**, and the verbs win. `list`, `describe`, `run`, `assets`, `batch`, `smoke`, `validate`, `preflight`, `install-browser`, `completion`, `help`, `version`, `models`, `speak`, `transcribe`, `mix`, `upscale`, `matte`, `ocr`, `detect-ai`, `reword` and `depth` are reserved words a tool id may never take - otherwise a brand pack shipping a tool called `batch` would be permanently unreachable. `lolly run <tool-id>` and `lolly describe <tool-id>` are the unambiguous spellings; the bare `lolly <tool-id>` sugar renders when flags follow and describes when they do not.

### Global flags

Valid on every command:

| Flag | Meaning |
|---|---|
| `--json` | one JSON envelope on stdout instead of human text (see [Machine interface](#machine-interface-json)). Not valid on a render. |
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

An extension names a format, so it is checked like one. If the tool does not declare it, the run stops - it does not fall back to the tool's first format and write those bytes under your filename:

```
$ lolly meeting-planner --output=times.csv
Error: --output=times.csv asks for ".csv", which "meeting-planner" does not produce.
Supported: png, jpeg, svg, ics, json. Name one with --export=<format> if you meant to
write it under that filename anyway.
```

Naming the format explicitly is how you opt out, because then you have said which bytes you expect: `lolly meeting-planner --export=json --output=times.notes` writes JSON under that name and exits 0. An `--output` with no extension at all renders the tool's default format.

## Flags

| Flag | Meaning |
|---|---|
| `--output=<path>` | Write to a file (`-` is stdout). Omit to stream to stdout. |
| `--filename=<name>` | Name the output file in the working directory, without giving a path. `--output` wins if both are given, with a warning. |
| `--export=<fmt>` | Output format (`png`, `svg`, `pdf`, `gif`, …). Defaults to the `--output` extension, then the tool's first declared format. **Refused** by on-device transform tools (see below). |
| `--input.<id>=<value>` | Set a tool input whose id collides with a reserved export flag (`width`, `height`, `format`). Without it the value goes to the export, not the input. |
| `--text=outline\|live` | Vector text as real paths or editable text. Anything else is a usage error. `svg` defaults to `outline`, with `live` keeping editable `<text>`. `emf` defaults to `live` - real metafile text records, editable in Office and Google Slides, with runs the format cannot express (tracking, feature settings, strokes, skew) outlined per run - and takes `outline` to force paths everywhere. `live` cannot apply to `wmf`/`eps`/`dxf`, and the browser render tier follows the web defaults rather than the flag; both cases warn rather than pretend. |
| `--html-fallback` | Opt in: when the requested format cannot be produced here, write HTML under a `.html` name instead of failing. Off by default. |
| `--depth=8\|16\|float`, `--hdr=1` | Requested bits per channel, and the HDR view transform that generates genuine float headroom. Asking for a float format over an 8-bit render is refused (exit 4) rather than padded. With `--hdr=1`, **PNG** is written at 16 bits per channel in Rec.2100 PQ (a cICP tag and the PQ profile; `--depth=8` is answered rather than obeyed, because 8-bit PQ bands in the shadows) and **JPG** is written as an ISO 21496-1 gain-map file - an ordinary SDR JPEG with a second image appended saying how much brighter each pixel gets, so a viewer that has never heard of gain maps sees the SDR picture byte for byte. Both are encoded in this shell (natively for `png` and `jpg`, on either tier's pixels), so they are the same bytes as a web or desktop export of the same render, and an `<svg>`-native tool writes a gain-map JPEG with no browser at all. `--hdr` and `--durable` cannot be combined here (exit 3, `error.kind` `HDR_DURABLE_UNAVAILABLE`): the durable credential needs the browser's neural encoder. For `avif` and `tiff`, and the 10-bit `mp4`/`webm` containers, the request is forwarded to the browser tier, which writes them exactly as the web shell does. `webp` stays SDR everywhere: 8-bit, with no working HDR decode path, so the web shell excludes it too. |
| `--tier-b-debug` | Keep the headless browser's console, page errors and network log for this run, and write them beside the output if it fails. `LOLLY_TIER_B_DEBUG=1` is the environment spelling. Off by default; a successful run writes nothing. See [When the browser tier fails](#when-the-browser-tier-fails-ask-it-why-tier-b-debug). |
| `--width=`, `--height=` | Output size (numbers). |
| `--unit=` | `px` (default), `mm`, `cm`, `in`, `pt`, `pc` - physical sizing. |
| `--dpi=` | Raster DPI for physical units (default 300). |
| `--c2pa[=7\|30\|90\|365]` | Stamp [Content Credentials](/info/exporting.html) into the output, signed with an ephemeral on-device certificate of that lifetime (default 30 days). **On by default**, exactly as in the app: a tool opts out with `render.c2pa:false`, an on-device privacy utility never carries them at all and `--c2pa=off` opts out per run. Verify with `lolly validate <file>`. Sign with a real identity instead of an anonymous key with `--sign-key`/`--sign-cert` - see [Signing from the terminal](/info/cli-signing.html). |
| `--imprint` | Embed the [Lolly Imprint](/info/exporting.html) pixel watermark. **On by default** too, for the formats whose bytes can carry it (`png`, `jpg`, `webp`, `avif`, `tiff`, `pdf`, `pdf-cmyk`, `pptx`); `--imprint=0` opts out. On a browser-free PNG render the mark is embedded by the CLI itself - it never forces the browser tier. A render too small to carry a detectable mark says so and writes the file unmarked. |
| `--no-provenance` | One word for a bare render: no credential, no imprint, no durable mark. **This is the byte-determinism switch** - both default marks embed a fresh timestamp, so two runs of the same defaulted command differ. `smoke` and `batch` apply it themselves. Combining it with an explicit `--c2pa`/`--imprint`/`--durable` is a usage error rather than a guess. |
| `--durable=1` | Embed the opt-in durable (TrustMark-format) credential. **Off** by default (a neural encode plus a model download). Needs the encoder model on-device. |
| `--password=<pw>` | Open password for a rendered PDF. Visible in `ps` - prefer `--password-stdin`. |
| `--password-stdin` | Read that password from stdin instead of the argument list. Giving both is an error. |
| `--cuts=<n>` | **Refused** on the CLI (exit 3): a contact sheet of `n` stills needs the web shell's sequence renderer, and one frame under that filename would be a different artefact. |
| `--fps=<n>`, `--seconds=<s>`, `--wait=<s>`, `--codec=h264\|hevc\|vp9\|av1`, `--vq=smaller\|balanced\|best` | Video clip controls for `mp4` / `webm` / `gif` / `apng`: frame rate, clip length, settle time before the first frame, codec and quality - the export panel's fields, forwarded to the browser tier as the URL params of the same names (see [URL mode](/info/url-mode.html)). `--seconds` is a deliberate length: a tool that would run to the end of its material (the Audiogram's audio, a Sequence's timeline) renders exactly this long instead. `--codec=h264` when the file has to play everywhere; Auto may pick AV1. |
| `--bleed=<dim>`, `--marks=<list>` | Print bleed and marks (`crop`, `reg`, `bleed`, `bars`, `prov`) for the print formats. Browser tier only. |
| `--press-profile=<cond>` | CMYK press condition (`fogra39`, `fogra51`, `swop`, `gracol`) - **named** in the PDF's output intent. The CLI has no profile store, so it cannot embed one, and a named-only intent is not PDF/X-4: the output intent is written, the `GTS_PDFXVersion` claim is not. Embedding a profile you loaded is a web-shell feature today (`profile=own`). **Not** `--profile` - see the warning below. |
| `--user-profile=<file.json>` | A user-profile JSON file, used to pre-fill `bindToProfile` inputs. A path that cannot be read or parsed is an error (exit 2), not a warning. |
| `--lang=<code>` | Content language (`de`, `ja`, `ar`, …). |
| `--share`, `--link` | Print a shareable `lolly.tools` link for these inputs instead of rendering anything. |
| `--z=<token>` | Expand a packed link token into the inputs it encodes. |
| `--zx=<token>`, `--link-password=<pw>` | A password-protected share link's state, and its password. A missing or wrong password is an error (exit 6), never a silent render of the tool's defaults. |
| `--<inputId>-data=<file>` | Fill an input from a file: CSV/TSV/JSON/Markdown or `.xlsx`. Works on `blocks` (rows into the repeating group), `table` (first row = headings) and `text`/`longtext` (the file's content fills the field). The ingest counterpart of CSV export. Add `--<inputId>-sheet=<name\|index>` to pick a sheet from a multi-sheet workbook; without it the first is read, and the CLI says so. |
| `--verify` | For an on-device utility, print one line per file saying its export checks ran and none failed. A failed check writes nothing and exits `1` (`FAILED`) - the gate lives in the tool's own hook, which throws like any other failure, so this shell does not claim to tell it apart from one. |
| `--<inputId>=<value>` | Any tool input (see the tool's schema). |
| `--<flag>` | A bare flag (no `=`) is truthy - handy for boolean inputs. |

> **`--profile` means the press condition.** It is an alias of `--press-profile`, matching URL mode's reserved `profile` param, so a pasted share link's `profile=fogra51` and a typed `--profile=fogra51` mean the same thing. The *user-profile JSON file* has its own flag, `--user-profile=<file.json>`. Before GA, `--profile` meant the file and was quietly remapped for links; that remap is gone.

Everything that isn't a reserved flag is treated as a tool input and validated against the manifest. Example - an A4 page:

```bash
pnpm run cli quotes --quote="Ship it." --width=210 --height=297 --unit=mm --export=pdf --output=page.pdf   # `quotes` is a SUSE-pack tool
```

## What the CLI can render

The CLI renders in a headless DOM (jsdom), so **vector and structured** formats - **SVG (and SVGZ), EMF, WMF, EPS (and EPS-CMYK), DXF, BMP, HTML, plus the data formats JSON, CSV, ICS, VCF, MD** (the engine hydrates those payloads) - work natively and reproducibly, no browser needed. The float formats **EXR** and **HDR** join them, over a resvg-rasterised frame, when a render asks for the headroom (`--hdr=1`). EMF, EPS and DXF are emitted straight from the template's vector primitives (no rasteriser), and the CLI carries the **same HarfBuzz text-shaping as the web shell** (`host.text`), so live `<text>` runs are outlined to true vector paths at export - EPS and DXF ship real text as geometry with no fonts needed on the receiving end, EMF keeps plain runs as live, editable text records by default (`--text=outline` forces paths), and font-driven tools (a wordmark lockup built on `host.text`, say) render headlessly too. Shaping resolves sfnt fonts (ttf/otf) under the repo root - catalog and tool-local faces; a browser-only woff2 face is rejected with a clear error rather than silently shaping blanks. **PNG** from an `<svg>`-based tool is also browser-free - resvg rasterises the engine's own SVG (Tier A), and so are the two **HDR stills** over that same frame (`--hdr=1` with `png` or `jpg`): the 16-bit Rec.2100-PQ PNG and the ISO 21496-1 gain-map JPEG are written by the engine's own encoders, which is why a JPEG that would otherwise need the paint tier comes out of a plain install here. **`penpot`** from an `<svg>`-based tool is browser-free the same way, and for the same reason as EMF/EPS/DXF above - it is built straight from the template's vector primitives, with the brand's colours and design tokens packed in alongside. No rasteriser and no browser sit in that path, so it needs neither the resvg tier PNG uses nor a Chromium; type styles come from the app's own font-role read, so a CLI archive carries no library typographies. An HTML-layout tool has no root `<svg>` to build from, so it goes to the full-fidelity tiers below and says so before it does. The remaining raster formats - **JPG, WebP, PDF, PPTX and video (GIF, APNG, WebM, MP4)**, plus HTML-layout PNG - need a real paint engine. `LOLLY_RENDERER=auto` (the default) walks three rungs: a Lolly desktop app that is **already listening** (the app writes its loopback port and a per-launch token to `render.json` in its data directory, and the CLI sends the job there and reads the bytes back on the same connection), then an **installed** app that is not listening yet, started in its hidden `--render-server` mode and given a bounded wait to answer (an app that predates the endpoint is never started, since it would read the flag as a request for a window; `lolly list --json` says so by name), then the CLI's own **scoped headless Chromium**, unchanged. `LOLLY_RENDERER=desktop` or `chromium` pins one of those, and `desktop` reports the app's failure rather than quietly rendering somewhere else; `LOLLY_DESKTOP_BIN` names an app executable in an unusual place and `LOLLY_RENDER_SERVER` points at a `render.json` directly. If Chromium is selected, install it once with `lolly install-browser` (or `pnpm run install:browser`). `lolly list --json` names the chosen renderer as `result.environment.renderer` (`desktop-running`, `desktop-installed`, `chromium` or `none`) and the resolved order under `result.environment.tiers.desktop`. Those paths are measured rather than assumed - [Video and timelines](#video-and-timelines) has the wall times and the file sizes. **ZIP** is the one format the lean CLI leaves out - no zip dependency - so its batch writes a folder instead. `ico` (favicons) and `txt` are full-fidelity formats like the raster set: `txt` is not a data format the engine hydrates, it is the *rendered* page serialised to plain text, which is why it needs a paint tier and not just jsdom. `jpg` and `jpeg` are one format with two spellings and either flag works on either kind of tool - manifests are split between the two, and `--export=` resolves to whichever the tool declared. (Requesting a format a tool doesn't declare prints a clear error listing what it supports - and so does asking for one via the `--output` extension.)

Which tier is available here is not a guess: `lolly list --json` reports it per tier, with a reason for each one that is missing. See [Discovery, for an agent](#discovery-for-an-agent).

### When the browser tier fails, ask it why (`--tier-b-debug`)

A Tier B failure used to be one sentence with no evidence in it. "The web shell produced no mp4 in time" does not say which of the five steps ran out, and the browser console line that would explain it died with the page. `--tier-b-debug` (or `LOLLY_TIER_B_DEBUG=1`) keeps the headless page's console, its page errors and its network log, times every step and **on failure** writes the lot to `<output>.tier-b-debug.log` - or to `lolly-tier-b-debug-<tool>.<format>.log` in the working directory when there is no `--output`. A run that succeeds writes nothing. Each section is capped at 500 lines, so a chatty page cannot fill a disk.

```
$ lolly wordmark --export=jpg --tier-b-debug --output=fail.jpg
Error: Cannot export "jpeg". Reason: The web shell produced no "jpeg" file for "wordmark"
in time … Timed out in step "wait for the jpeg download" after 59.9s.
Debug log: ./fail.jpg.tier-b-debug.log  No file was written.

$ cat fail.jpg.tier-b-debug.log
Lolly Tier-B debug - wordmark.jpeg
failed: no "jpeg" file (step "wait for the jpeg download" after 60.0s)

STEPS (the last one is where it stopped)
  serve the built web shell: 0.00s
  launch the browser: 0.27s
  open the tool page: 0.03s
  wait for the jpeg download: 59.97s

CONSOLE (1)
  [0.31s] error: stub dist: no export path here

NETWORK (1)
  [0.28s] 200 GET http://127.0.0.1:49404/
```

Two things about the tier changed with it, and both are visible without the flag. **A failed browser render now exits.** The pooled Chromium and the local static server used to be torn down only on the success path, so a Tier B failure printed its error and then sat there with a live event loop; it read as a hang rather than as a failure. It exits `3` (`UNAVAILABLE_HERE`) now, and the failure sentence names the step that ran out of time. And **the page the CLI drives is cross-origin isolated**, sending the same `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` pair production sends. Without them `SharedArrayBuffer` was absent in every headless render, so threaded on-device models ran under different rules in the terminal than in a browser - which is what made `--durable=1` and `validate --deep` unreliable here.

## Video and timelines

`--export=mp4`, `--export=webm`, `--export=gif` and `--export=apng` drive the app's own sequence renderer inside the scoped Chromium. Nothing is re-implemented for the terminal: the CLI hands the built web shell this tool's state, the shell records its timeline through WebCodecs and the finished container comes back as bytes. A `design` document with a Sequence timeline, a deck's `pptx`, an animated tool's `gif` - one path, one set of frames, the same file the export panel would have written.

Every browser-tier export, measured on one machine (Apple silicon, a built `shells/web/dist` and the scoped Chromium) from a nine-box animated `design` state and a four-slide deck:

| Command | Wall | What came out |
|---|---|---|
| `design --z=… --export=mp4` | 20.9 s | 359,632 B - AV1, 1920x1080, 30 fps, 90 frames, 3.00 s |
| `design --z=… --export=webm` | 24.0 s | 359,579 B - AV1 in Matroska, the same frames |
| `design --z=… --export=gif` | 30.7 s | 1,030,239 B - 1920x1080, 45 frames |
| `design --z=… --export=apng` | 95.9 s | 8,905,914 B |
| `design --z=… --export=pdf` | 32.8 s | 29,882 B |
| `deck-studio --export=pptx` | 7.0 s | 383,207 B - 4 slides, layouts and media |
| `design --bx=…` with an audio box, `--export=mp4` | 8.4 s | 69,801 B - AV1 video plus AAC, 48 kHz stereo |

Your numbers will differ; the pattern will not. A timeline carrying an audio box comes back with real sound and a real master pass: the measured peak of that last file sits at the -1 dBTP limiter's ceiling. `tests/cli-tierb-video.test.ts` is what keeps the table honest - it renders an mp4 and a pptx through the built dist, reads the mp4 as an ISO base media file and the pptx through its central directory and skips by naming the missing half (and the command that supplies it) when there is no dist or no browser.

The clip is yours to shape: `--fps=60 --seconds=6 --codec=h264 --vq=best` renders six seconds at 60 frames a second in H.264, and `--wait=2` holds two seconds before the first frame for a tool that fades in. These are the export panel's Frame rate, Duration, Start after, Codec and Quality fields; the CLI hands them to the browser tier as the URL params `fps`, `seconds`, `wait`, `codec` and `vq`, so a share link carrying them and this command render the same clip. Without them the tool's own defaults apply - 30 frames a second, the manifest's length or the material's, whichever the tool's hook decides.

Video bytes are **not** reproducible run to run. The browser's paint and encode move, and a frame-timed capture moves with them. Compare video by rendering and inspecting, never by digest - see [How far "the same" goes](#how-far-the-same-goes-byte-for-byte).

### The soundtrack, with no browser (`lolly mix`)

The frames need a paint engine. The sound does not: a timeline's mix is a closed form over decoded PCM, and every number in it - the equal-power pan, the fades, the signal-derived ducking, the BS.1770 loudness meter, the -1 dBTP true-peak limiter - is engine code shared with the app. `lolly mix` is the door onto that, for a pipeline that wants to hear a timeline, diff two mixes or feed a mastering step without a Chromium in the picture.

```bash
# A design state: a share link, a bare query, or a file holding one
pnpm run cli mix 'https://lolly.tools/#/tool/design?bx=…' --out=mix.wav

# Or a plan JSON: { totalSec, clips: [{ id, src, startMs, durMs, … }], bed }
pnpm run cli mix ./plan.json --out=mix.wav --normalize=-16
```

`--normalize=<LKFS>` sets a loudness target (`-14`, `-16`, `-23`); without it the mix is not normalised, and the limiter runs either way because it is not optional on any path. The result is bit-identical to the web shell's, which a test pins by running both over one specification and comparing sample for sample.

The decoder is the honest limit. Node reads WAV and our procedural ZzFXM songs; an mp3, m4a, opus, flac or webm clip needs a platform codec this shell does not have, so it is **named and left out** rather than mixed as silence, and a timeline where nothing could be decoded refuses rather than writing silence under your filename. The catalog's own music library is `.opus`, so a design state pointing at a shipped loop reaches that refusal today and is told which door does work (`lolly design --export=wav`, which drives the browser tier). Two things the Node plan reader does not take off a design state, both warned about rather than silently applied: `data-t-kf` volume keyframes and the crossfades a sequence lane derives from its neighbours. A plan JSON can carry the crossfade values itself.

## File inputs & on-device utilities

Some tools take **your own file** as input (a `file`-typed input) and hand back a transformed copy - the on-device "utility" shape (strip EXIF, crop, convert). On the CLI, pass the file as a path; the runner loads its bytes:

```bash
pnpm run cli strip-data --source=./holiday.jpg --output=./holiday-clean.jpg
```

These tools produce their output via the `exportFile` transform path (bytes in → bytes out), not a DOM render, so there is no render format to choose: the output container follows the file you gave it. `--export=` is therefore **refused**, not ignored - it used to be accepted and dropped, which printed a success line for a file whose contents did not match its name:

```
$ lolly strip-data --source=./photo.jpg --export=png --output=./clean.png
Error: "strip-data" is an on-device transform (file in → file out), so --export=png has
nothing to act on: the output container follows the file you gave it, and the reserved
export format never reaches the tool. Drop the flag, or use one of the tool's own inputs
if it offers a conversion.
```

A tool that genuinely converts does it through its **own input**, not the export flag. `convert-image` declares an input literally called `format`, which the reserved export param shadows, so it is set with the explicit namespace:

```bash
pnpm run cli convert-image --source=./photo.heic --input.format=png --output=./photo.png
```

Choosing an `--output` name whose extension disagrees with the bytes a transform produces is a **warning**, not a refusal - the transform cannot change the container to match, and the file is written under the name you asked for with that fact stated on stderr.

The transformed bytes are written to `--output` (or `--filename=`), or streamed to **stdout** if you omit both. Nothing is ever uploaded; the file is read locally and handed straight back.

Most utilities run entirely in the headless DOM. A few **rebuild real pixels** - `redact` repaints an image on a canvas and rasterises PDF pages - which jsdom cannot do on its own, so the CLI puts a real 2D canvas behind it (Skia, via `@napi-rs/canvas`) and rasterises PDF pages with Lolly's own page interpreter. That runs locally with no browser: `lolly redact` on a PDF or an image reports `tier: node`, and the bars it burns cover exactly the pixels the web app's would - the bar geometry is one shared module, called by both. `--verify` re-scans the finished copy here the same way it does anywhere else, so a redaction is still gated before any bytes are written.

One gap in the terminal's page render, stated because a redacted page is a picture of the original: text, vector geometry and embedded rasters all come through, but shadings, tiling patterns and graphics-state soft masks do not - their decoders are web-shell modules. A gradient paints the flat back-stop the engine emits for it. Text and geometry, which is what a redaction covers, are complete.

If that canvas is not installed (a lean install), or a tool needs something only a browser engine can do, the CLI re-runs the same export in the scoped Chromium driving the built web shell (the Tier B path above). It says so on stderr when it switches. If the browser or the built shell is missing it stops and names what to install (`lolly install-browser`, `pnpm run build:web`); it never writes a file that was not actually redacted.

### Redaction instructions: one string, many files

A redaction is fully described by its bars plus its options, and that description is ordinary URL state - so the same string works as a share link, as CLI flags and as an [MCP](/info/mcp.html) call. Bar fields are `page,x,y,w,h`: PDF bars in points from the page's top-left, image bars in pixels.

```bash
# Compact rows (tilde-separated), the form a share link uses:
pnpm run cli redact --source=./contract.pdf --bars='1,40,60,200,24~2,40,100,120,14' \
  --grayscale --output=./contract-redacted.pdf --verify

# The same instructions as JSON, or from a spreadsheet:
pnpm run cli redact --source=./scan.png --bars='[{"page":1,"x":40,"y":60,"w":200,"h":24}]' --output=./scan-redacted.png
pnpm run cli redact --source=./scan.png --bars-data=./bars.csv --output=./scan-redacted.png
```

Because the instructions are just a link, you can mark up one document in the app, hit **Share** and run that link headlessly over every other copy - forms, certificates, invoices and anything else where the same fields sit in the same place on every page:

```bash
for f in ./inbox/*.pdf; do
  pnpm run cli "$SHARE_LINK" --source="$f" --output="./clean/$(basename "$f")" --verify || echo "FAILED: $f"
done
```

`--verify` prints a line per file once the tool's own gate has run: the redacted copy is re-opened and re-scanned (no metadata, one end-of-file marker, no recoverable covered text, bar regions re-sampled as solid fill) before any bytes are written. A failed check is a non-zero exit with the tool's own sentence and **no output file**, so a shell loop can treat failures as failures. What it cannot tell you is whether an invisible whole-image watermark was present: nothing here detects or removes one.

## Speech

Two speech commands, both reaching the same `host.speech` a tool's own `hooks.js` reaches. Nothing is uploaded and nothing is called out to: the models run here, on this machine. Because the bridge carries `host.speech` now, a tool that speaks its own text - a narration tool, a caption track, the audiogram's voiceover - renders headlessly with no extra flags.

```bash
pnpm run cli speak "Constraint first, on device, from the terminal." --out=./clip.wav
pnpm run cli speak "…" --voice=af_heart --speed=0.95 --out=./clip.wav --json
pnpm run cli transcribe ./clip.wav --lang=en --json
```

**`lolly speak`** writes a 24 kHz mono WAV. `--out=<file>` names it (`--out=-` streams it to stdout, `speech.wav` is the default name), `--speed=<n>` is a rate multiplier where `1` is the natural pace and `--voice=<id>` picks one of the 28 Kokoro voices - 20 en-US and 8 en-GB, `bf_lily` by default because "lolly" is a British word and Lolly's own voice should sound like one. A voice can be a **blend**: `--voice=af_heart+bf_lily:0.3` mixes two with the weights normalised, the same setting the app's voice controls write. Progress goes to stderr, per sentence.

**`lolly transcribe <clip.wav>`** reads a clip back as text. The text is stdout and nothing else is, so `lolly transcribe take.wav > take.txt` is a whole workflow; `--lang=<code>` names the spoken language, and `--json` adds the word timings.

**WAV in, and it says so when it cannot.** Node has no MP3, AAC or Opus decoder, and shelling out to whatever `ffmpeg` happens to sit on `PATH` would make a headless run depend on a binary nobody declared. So an `mp3`, `m4a`, `aac`, `ogg`, `oga`, `opus`, `flac`, `weba`, `webm`, `mp4` or `mov` file is refused **by name** rather than read as noise, and a generated ZzFXM song is refused too (it carries no speech to quote back):

```
$ lolly transcribe ./interview.m4a
Error: speech: m4a needs a platform codec this shell does not have - hand it a WAV, or run
it in a browser shell
```

**The WAV is written plain.** `lolly speak` is a subcommand, not a `lolly run`, so the export pipeline never sees its bytes and no Content Credential is stamped on them. If you are shipping generated speech somewhere it has to declare itself, that declaration is yours to add for now.

`--json` on either command puts the result in the [standard envelope](#machine-interface-json). `speak` reports `output`, `voice`, `speed`, `sampleRate`, `duration`, `granularity`, the sentence `script` and a `words` array of `{ text, start, end }` spans in seconds; the reverse direction reports `text`, `words`, `lang` and `granularity`. Those spans are what a caption or a karaoke highlight keys off, so read `granularity` rather than inferring alignment from span lengths.

### The models, and who decides they download

Nothing here fetches anything on its own. Every family is read from a models directory, and a family that is not in it is a **refusal naming the command that would fetch it**, the bytes that would move and the directory that was searched.

That directory is `$LOLLY_MODELS_DIR` when you set one, then the repo's own `shells/web/public/models` when it exists (so a dev checkout shares one copy with the web shell), then `~/.cache/lolly/models`.

`lolly models ls` names every family these shells can run - `kokoro` and `whisper` for speech, plus `upscale`, `matte`, `ocr`, `ai-detect`, `reword` and `depth` - with what is present, what is missing and the fetch command for anything incomplete. On a machine that has staged them all:

```
$ lolly models ls
Model files under /Users/andy/Build/lolly/shells/web/public/models
  kokoro     speech synthesis (lolly speak)     complete (102.0 MB)
  whisper    transcription (lolly transcribe)   complete (76.0 MB)
  upscale    AI enlargement (lolly upscale)     complete (410.7 MB)
  matte      background removal (lolly matte)   complete (29.1 MB)
  ocr        text recognition (lolly ocr)       complete (20.5 MB)
  ai-detect  AI-text estimate (lolly detect-ai) complete (33.0 MB)
  reword     on-device rewrite (lolly reword)   complete (372.0 MB)
  depth      depth map (lolly depth)            not published yet
```

`lolly models fetch <family> --yes` stages any of them from `https://lolli.li/models/` (`$LOLLY_MODELS_BASE` overrides the host). `depth` is the one exception, and it is honest about it: no depth model is published yet, so there is nothing to download and the command says so instead of inventing a URL.

The fetch prints the file count, the total size and the biggest files by name **before** a byte moves, then asks - `upscale` is 410.7 MB because 324.5 MB of it is the GFPGAN face model, and a total that says so is not a surprise. `--yes` answers in advance; on a runner with no terminal and no `--yes` it downloads nothing, says how to proceed and exits `0`. Every file is checked against a pinned SHA-256 **before** it is written, and a mismatch writes nothing and exits `4` (`REFUSED`). Each file is written as `.part` and renamed on success, so an interrupted fetch cannot leave a half-file that looks whole.

A missing model is never a silent download:

```
$ lolly speak "hello there"
Error: speech: the kokoro model is not on this machine - missing onnx/model_quantized.onnx,
voices/bf_lily.bin, tokenizer.json, and 2 more under …/models/kokoro. It is a one-time
88.6 MB (92886949 bytes) download: run  lolly models fetch kokoro
```

Exit `3` (`UNAVAILABLE_HERE`) - "may well succeed on another runner" - with `error.kind` of `MODEL_NOT_STAGED`. The missing files are listed biggest first, so the sentence opens with the weights rather than with three config files.

## On-device ML

Six utilities over the same models the app runs. Each is a thin wrapper over the API a tool's hook reaches through `host.*` - there is no second implementation of a model, a tiling scheme or a gate anywhere in the CLI - and each refuses by model name when its weights are absent, exits `3` and downloads nothing. They exist so that a capability nothing surfaces is still findable: `host.upscale`, `host.matte` and `host.ocr` are on the CLI bridge now, so a tool that feature-detects one gets it in a headless `lolly run`, and these six commands are how a person checks it runs on their machine.

```
$ lolly upscale ./small.png --scale=4 --out=./big.png
Error: The Real-ESRGAN general (fast) model is not on this machine. Run `lolly models fetch
upscale` to download it (4.0 MB), or point LOLLY_MODELS_DIR at a directory that already has
it. Looked in /…/models/upscale.
```

- **`lolly upscale <image> [--scale=2|4] [--model=<id>] [--max-edge=N] [--out=<file.png>] [--models]`** - AI enlargement, PNG out, per-tile progress on stderr. `--scale` takes `2` or `4`; the models are natively x4 and `2` trims the result. `--models` prints the roster with sizes and licences: `realesr-general-x4v3` (4.0 MB, fast), `realesrgan-x4plus` (63.9 MB, quality), `realesrgan-x4plus-anime` (17.1 MB) and `gfpgan-v1.4` (340 MB, face restore, flagged "can invent face details"). An image the model cannot be run over is refused with the reason (exit `4`), not attempted and truncated.
- **`lolly matte <image> [--model=u2netp|modnet] [--max-edge=N] [--out=<file.png>] [--models]`** - background removal. `u2netp` (4.4 MB) is the default, `modnet` (24.7 MB) the portrait model. Every RGB pixel out is the input's byte for byte and only the alpha is computed, which is why a matte is disclosed as an edit in the app and an upscale is not.
- **`lolly ocr <image> [--json] [--single-line] [--min-confidence=<n>] [--models]`** - text recognition with `ppocr-v5-mobile` (20.5 MB, ten languages). The recognised text **is** stdout, so `lolly ocr shot.png > shot.txt` works; `--json` adds per-line confidence and a box in source pixels. Nothing read is exit `5` (`NOT_FOUND`), a legitimate negative answer rather than a failure.
- **`lolly detect-ai "<text>" [--json] [--in=<file.txt>]`** (a pipe works too) - prints an **estimate** with its operating point and the model that produced it, never a verdict. Under 50 words, or mostly non-Latin script, it prints "Not checked" with the reason and exits `5`: the detector is trained on English and over-scores non-native-English prose, and an absent check is not an answer.
- **`lolly reword "<sentence>" [--style=plain] [--samples=N] [--json] [--in=<file.txt>]`** - on-device rewrites, shorter and plainer, one per line. Only `--style=plain` is accepted; anything else is a usage error that says why, because the prompt is engine data asking for exactly one thing and a silently ignored style would be the class of quiet failure this shell exists to remove. No candidate passing the gate (longer, off-topic, or a changed fact) is exit `5`, not a crash.
- **`lolly depth <image> [--max-edge=N] [--out=<file.png>]`** - a greyscale depth map, white nearest. It refuses today, by name: no depth model is published, so there is nothing to fetch and nothing to run.

Two things to know about these six. They write **plain files**: they are not a `lolly run`, so the export pipeline's Content Credentials and Imprint do not apply, and an upscaled PNG from the terminal carries no credential naming the model. And the execution provider is **CPU by default**, because that is what the app's WASM kernels match numerically and what every model on the roster is verified against. `LOLLY_ORT_EP=coreml` (or `=cuda`) opts into the accelerated provider, which is faster and can move the numbers on some graphs - an opt-in, never a default. `LOLLY_ORT_THREADS=<n>` caps the threads each model session may use (unset means every core); `1` runs a graph on the calling thread with no pool, which is slower but keeps the cost predictable on a shared machine.

## Composed tools

Some tools **embed another tool's render** as an asset - declared in the manifest (`composes`) with no tool-to-tool imports. For example, `event-name-badge` composes `qr-code` as an SVG. Composition is transparent on the CLI: the runtime resolves it on mount, so the embedding tool renders headlessly with **no extra flags**.

It follows the same vector stance as the rest of the CLI: an **SVG child composes end-to-end and stays vector**, while a **raster child is omitted gracefully** (the parent still renders, just without that slot). For full raster-child composition, run the Tauri-bundled build - the same boundary as raster export above.

## Batch

A batch is **many URL-mode rows under one file** - the same principle as a single render, tabulated. `lolly batch <rows.csv>` renders one output per row into a directory (a directory, not a zip: the lean CLI has no zip dependency, and a folder composes with your own `zip`/`tar`; the TUI's batch packs a zip instead).

```bash
# Author a starter grid for one or more tools (their input columns + reserved columns):
pnpm --silent run cli batch --template=qr-code,chart-creator > rows.csv

# Render every row → ./out/NN-<name>.<fmt>
pnpm run cli batch rows.csv --out-dir=./out [--keep-going]
```

The header row names the columns: a **`toolId`** column is required; **`format` · `width` · `height` · `unit` · `dpi` · `filename`** are per-row output settings; every other column is a **tool input id** whose cell is a value (any URL-mode form - plain text, JSON/tilde blocks, `id.field` vectors). Rows can mix tools freely. Example:

```csv
toolId,format,url,color,src
qr-code,svg,https://suse.com,#0c322c,
qr-code,png,https://opensuse.org,#30ba78,
asset-export,pdf,,,suse/logo/hor-neg-green
```

(That last row uses `asset-export` and a `suse/…` asset id, so it needs the SUSE brand pack mounted - swap in a tool and asset from your own profile.)

The header *is* the namespace here - a batch has no `--input.<id>=` escape - so an input whose id is one of those reserved names (`chart-creator` declares `width` and `height`) cannot be set per row, and `--template=` leaves it out rather than emitting a second column with the same name. It says which inputs it dropped. Render those with `lolly run … --input.width=…`.

`--template=` writes the input columns plus those six output columns. It is not the whole set: **any reserved URL param works as a column**, because a row's cells are read exactly as a URL's query is. `bleed`/`marks`/`press-profile` ride that way; add them to the header by hand.

**`batch` renders bare.** Unlike a single `lolly run`, a batch row carries no Content Credentials and no Imprint unless it asks - a batch is a build step, and a regenerated folder should not differ from its predecessor in every file. A `c2pa` column (or `imprint`, or `durable`) opts a row back in and is read exactly as `?c2pa=` is. `smoke` renders bare for the same reason.

`--keep-going` renders past a failing row (otherwise the batch stops with a non-zero exit). Either way the batch's exit code is the **worst row's** code, not a flat 1, and `--json` gives one document with a per-row `exit` so a pipeline can retry just the exit-3 rows on a runner that has a browser. `--output` is refused: a batch has many outputs and one path cannot name them - use `--out-dir=`.

## Render-check the catalog (`lolly smoke`)

```bash
pnpm run cli smoke                              # render EVERY tool at manifest defaults
pnpm run cli smoke --only=qr-code,chart-creator # just these ids
pnpm run cli smoke --format=svg                 # force one Node-native format
```

`lolly smoke` is the catalog-wide render gate: every tool in the active profile renders at its manifest defaults to its first Node-native format - browser-free; a tool whose declared formats are all browser-only falls back to an `html` render, which still exercises load → hydrate → hooks. Every output is checked for blank or empty results, each tool prints a ✓/✗ row and the exit code is non-zero if anything fails - so wired into CI, a `hooks.js` regression can never ship a tool that renders blank. Tools that legitimately can't render headlessly are skipped with a reason, never failed: transform tools (file in → bytes out; nothing to render at defaults) and tools gated on a live capture capability (camera / microphone / screen / capture).

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
| **Video** (`gif`/`apng`/`webm`/`mp4`) and **PPTX** | **No**, for the row above's reason plus a frame-timed capture. These do render here, and what they cost and produce is measured ([Video and timelines](#video-and-timelines)); it is their run-to-run byte identity that is not, and nothing about a browser encode suggests it holds. | `design --export=mp4`, `design --export=webm`, `deck-studio --export=pptx` |
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

`--json` is valid on `list`, `describe`, `assets`, `validate`, `smoke`, `batch`, `preflight`, `models`, `speak`, `transcribe`, `ocr`, `detect-ai` and `reword`. It puts **one JSON document on stdout and nothing else**; every human line moves to stderr. It is deliberately **not** available on a render, because a render's stdout is the exported file - asking for both is a usage error rather than a silently ignored flag. `lolly speak --out=- --json` is refused for the same reason: the WAV and the document cannot both be stdout.

Every one of those but the last three answers in the shared envelope below. `ocr`, `detect-ai` and `reword` currently emit their own smaller `{ "ok": true, "command": …, … }` document instead - one JSON document on stdout either way, but do not expect `schemaVersion` or `warnings` from those three yet.

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

## Run a share link

A pasted `lolly.tools` tool URL can be the **first argument**: the CLI splits it into a tool id plus its query and renders that, with any following flag overriding what the link carried.

Three link shapes are recognised - the Share dialog's hash route, the pretty path and the canonical embed URL:

```bash
pnpm run cli 'https://lolly.tools/#/tool/qr-code?url=https://suse.com&color=%230c322c' --export=svg --output=qr.svg
pnpm run cli 'https://lolly.tools/qr-code?url=https://suse.com&color=%230c322c' --export=svg --output=qr.svg
pnpm run cli 'https://lolly.tools/tool/qr-code.svg?url=https://suse.com' --output=qr.svg
```

Anything else is a usage error naming the URL, not a render of the tool's defaults.

The reverse direction is `--share` (or `--link`), which prints a link for the inputs you passed instead of rendering:

```bash
pnpm run cli qr-code --url=https://suse.com --share
```

## Verify a file (`lolly validate`)

The read side of [Content Credentials](/info/content-credentials-identity.html) - entirely on-device, nothing uploaded:

```bash
pnpm run cli validate ./poster.pdf
pnpm run cli validate ./poster.pdf --json
pnpm run cli validate ./poster.png --deep
pnpm run cli validate ./poster.pdf --trust-anchor=./corp-root.pem
pnpm run cli validate ./poster.svg --no-default-anchors    # trust only what you pinned
```

### Which anchors produced the verdict

Trust is only meaningful next to "trusted by what", so every report says which anchor set it used. The default set is the **Lolly CA root** plus the **vendored C2PA known-certificate list** (camera makers, the big generators) plus anything you pinned - the same set the web `/valid` view uses, so one word means one thing on every surface:

```
$ lolly validate ./qr.svg
./qr.svg  [svg]
✦ Made with Lolly - credential intact, file unchanged since export
  …
  ℹ signingCredential.untrusted - signing certificate untrusted - an ephemeral on-device key, not a CA-issued identity
  Trust anchors: C2PA known-certificate list (54) · pinned: none · Lolly CA root

$ lolly validate ./qr.svg --no-default-anchors
  …
  Trust anchors: no built-in anchors · pinned: none · Lolly CA root NOT pinned
```

Both exit 0 here: this file is signed with an ephemeral on-device key that chains to nothing, which is the designed posture for a terminal render, not damage. `--no-default-anchors` is the bare-trust check - useful when the only trust you accept is a root you pinned yourself.

| Flag | Meaning |
|---|---|
| `--json` | The shared envelope instead of the human summary. `result.files[]` carries one record per file - `verdict` (the stable slug), `resolved` (the engine's semantic verdict), `report` (the full verifier output), `metadata` (the `--metadata` report, or `null` when it did not run) and `anchors` (which trust anchors produced the verdict). A file that could not be read is a record with its own `error`, not a silence, so a list of ten does not lose nine to one typo. |
| `--deep` | Additionally run the neural pixel-watermark scan (TrustMark / Content Seal / the Lolly durable mark). Needs the browser tier, and is **advisory** - it never changes the exit code. |
| `--trust-anchor=<root.pem>` | Trust an additional root certificate. Repeatable, for an organisation's own CA. `$LOLLY_TRUST_ANCHOR` adds more as a `PATH`-style list (`:` on Unix, `;` on Windows); a leading `~` expands. Flag first, then environment. A pinned root that cannot be read stops the run (exit 2) rather than quietly downgrading the verdict. |
| `--no-default-anchors` | Trust **only** what you pinned: drops the Lolly CA root and the vendored C2PA known-certificate list. With nothing pinned the anchor set is empty and every signer reads untrusted by construction - the bare-trust check. |
| `--metadata` | Also report what else is in the file: embedded metadata, PDF structure and text that is present in the file but not visible on the page. |
| `--rebuild=<session.lolly>` | The reproducibility receipt: render the `.lolly`'s session again here and report `IDENTICAL` (exit 0) or `DIFFERENT` (exit 1) with every reason it could check - engine version, tool version, a font that resolves differently, or the offset where the content first diverges. `svg`, `emf`, `eps`, `dxf` and `csv` only; a raster or PDF artifact is refused with exit 2, because those bytes come from a browser engine rather than the engine's own emitters. See [Reproducibility](/info/reproducibility.html#prove-it-yourself). |

The summary headlines whether the file was genuinely made with Lolly and is unchanged since. The exit code follows the table above: **0** the file matches what was signed (including an expired certificate - Lolly signs with short-lived on-device certificates, so any other rule would fail every gate on its own correct output within a month), **4** a credential is present and the bytes no longer match it, **5** no credential at all, **2** the path could not be read. `--strict` promotes expired to 4; `--require=none` turns off verdict-based exit codes entirely ("just tell me what is in this file"). Several files can be given at once - the exit code is the worst one's.

### `--metadata`: what else is in this file

`--metadata` answers the question people actually have before sending a file on. It adds, on top of the credential verdict:

- **Embedded metadata** - EXIF, XMP and IPTC fields, a GPS fix if the file records one, an AI source-type *declaration* if the generator wrote one and any bytes riding after the container's end (the appended-payload pattern). Fields the engine considers personally identifying are marked.
- **PDF structure** - pages, page sizes, fonts, images, annotations, the Info dictionary, whether an XMP packet is present and how much text is extractable. Pages carrying no text layer are called out as scans needing OCR.
- **Text present in the file but not visible on the page** - the classic failed redaction, where a black bar is drawn over words that are still in the content stream. The report says where those words are and quotes them back. It does not say why they are there: a botched redaction and a layering mistake look identical from outside.

```bash
pnpm run cli validate ./contract.pdf --metadata
pnpm run cli validate ./photo.jpg --metadata --require=none    # report only, never a gate
pnpm run cli validate ./contract.pdf --metadata --json
```

Honesty rules this output holds to, because a person decides what to send based on it:

- The report ends with what it did **not** check, every time. Nothing found is not the same as nothing there.
- **No invisible or neural watermark detection runs here.** SynthID is not detected by Lolly at all. The TrustMark, Content Seal and Lolly durable pixel marks need the browser tier - that is `--deep`, not `--metadata`.
- The hidden-text pass covers one case: text under an opaque shape that covers most of the line. Text hidden by invisible render mode, by a clip path, by white-on-white colouring, or under a bar drawn tightly around the glyphs is not reported.
- PDFs are read to a page cap (25). When a document is longer, the report says how many pages it read and claims nothing about the rest.
- A file too broken to parse produces fewer findings plus an explicit "this report is incomplete" line, never a crash and never a clean bill of health.

With `--strict`, a finding that would matter before sharing - hidden text, a GPS fix, or undeclared bytes appended past the container - exits 4 (REFUSED). Without `--metadata` those passes never run, so `--strict` cannot fire on them.

## Shell completion (`lolly completion`)

`lolly completion bash|zsh|fish` prints a completion script to stdout. It completes verbs, flags, and tool ids read from the active profile's catalog at the moment the script is generated:

```bash
lolly completion bash > /usr/local/etc/bash_completion.d/lolly   # Homebrew bash-completion
lolly completion zsh  > ~/.zsh/completions/_lolly                # then: autoload -U compinit && compinit
lolly completion fish > ~/.config/fish/completions/lolly.fish
```

The tool-id list is a snapshot. Install new tools, then run `lolly completion <shell>` again to pick them up - there is no live catalog read from inside a shell's completion function.

## Point it at another brand pack (`LOLLY_ROOT`)

The CLI reads tools and the asset catalog from the repo root it finds itself in. Set `LOLLY_ROOT` to render from any directory with the same layout - a `tools/` directory of tool folders and a built `catalog/`:

```bash
LOLLY_ROOT=/path/to/brand-pack pnpm run cli qr-code --url=https://example.com --output=qr.svg
```

The override is **marker-validated**: the directory must hold a generated catalog index (`catalog/tools/index.json` or `catalog/assets/index.json`), and a `LOLLY_ROOT` without one is ignored - resolution falls back to walking up from the CLI itself, then the working directory. That makes the CLI a generic brand-pack renderer: build a pack's `tools/` + `catalog/` and every command here - render, batch, smoke, assets - runs against it, with zero code change.

## Where saved sessions live

A `lolly` run is ephemeral: state a tool saves stays in memory for that run and is gone when it exits. What it does read is the saved sessions this machine already has. One directory serves all three local shells - the desktop app, the TUI and the CLI - and they pick it in this order:

1. `$LOLLY_STATE_DIR`, when you name one.
2. `$LOLLY_TUI_DIR`, the old name for the same thing. It still works and prints a one-line note saying which name replaced it.
3. The desktop app's own data directory, when the app is installed here: `~/Library/Application Support/tools.lolly.Desktop` on macOS, `$XDG_DATA_HOME/tools.lolly.Desktop` (or `~/.local/share/...`) on Linux, `%APPDATA%\tools.lolly.Desktop` on Windows.
4. `~/.lolly`.

Sessions sit in `saved-state/<slot>.json` there, in the record the desktop app writes, so a project saved in the app loads in the terminal by its slot and a project saved in the TUI opens in the app.

Writing is the one asymmetry, and it is deliberate: `lolly` only writes state to disk when rungs 1 or 2 name the directory. A headless render should not leave files in your home directory, or in the app's store, that nobody asked for. Name a directory and a state-saving tool becomes scriptable across runs.

## Related

- [Signing from the terminal](/info/cli-signing.html) - set up a real signing identity, so exports carry a verifiable name rather than an anonymous on-device key.
- [TUI](/info/tui.html) - the interactive, full-screen terminal counterpart. Same engine, same output; keyboard-driven instead of one-shot.
- [URL Mode](/info/url-mode.html) - the parameter model the CLI shares with the web shell (and the reserved params).
- [Exporting & Formats](/info/exporting.html) - what each format is for.
- [AI Agents](/info/ai-agents.html) - driving the same surface from an LLM.
- **/pro batch** - the web shell's interactive counterpart to the scripted fan-out loop above: a spreadsheet-style grid with CSV round-trip, spreadsheet paste and per-row output across one or many tools.
