# Render with the CLI

Most formats are written on this machine with nothing else installed. The rest need a paint engine, and the CLI finds one for you. This page shows which formats render where, how to size a print page or shape a video and what to do when the browser step fails. Every flag is listed at the end.

## What the CLI can render

::: figure cli-rendering-tiers
Each rung adds formats. The CLI takes the lowest rung that can write the format you asked for.
:::

1. **Nothing extra.** SVG, SVGZ, EMF, WMF, EPS, EPS-CMYK, DXF, HTML and the data formats (JSON, CSV, ICS, VCF, Markdown) are written in Node. So are `penpot` from an `<svg>`-based tool and Lottie, IDML and Premiere XML from a Design document.
2. **Pixels from a vector tool.** resvg turns an `<svg>`-based tool's own SVG into pixels, still with no browser. PNG, BMP and JPEG XL come from that frame, and so do the HDR stills (`--hdr=1` with `png` or `jpg`) and the float formats EXR and HDR.
3. **Everything else.** JPG, WebP, PPTX, video, most PDFs, PNG from page-layout tools, `ico` and `txt` need a paint engine: a running Lolly desktop app, an installed one the CLI starts in the background or the CLI's own headless Chromium.

`lolly list --json` reports which rungs this machine has, and why any is missing ([Discovery, for an agent](/info/cli-reference.html#discovery-for-an-agent)).

### Formats with no browser

The CLI renders in a headless DOM (jsdom), and those formats come straight from the template's own shapes and data, with no rasteriser. It carries the same HarfBuzz text shaping as the app (`host.text`), so text becomes true vector paths at export: EPS and DXF carry text as geometry that needs no fonts, and EMF keeps plain runs as editable text records unless you pass `--text=outline`. Font-driven tools, such as a wordmark built on `host.text`, render here too.

Shaping reads `ttf` and `otf` fonts under the content root, from the catalog and the tool's own folder. A browser-only `woff2` face is refused with a clear error rather than shaped as blanks.

`penpot` packs the brand's colours and design tokens beside the vector shapes; type styles come from the app's own font-role read, so a CLI archive carries no library typographies. An HTML-layout tool has no root `<svg>` to build from, so it goes to the paint tier and says so first.

`txt` is not a data format: it is the rendered page as plain text, which is why it needs the paint tier. `jpg` and `jpeg` are one format with two spellings, and either flag works on any tool.

### The paint tier

`LOLLY_RENDERER=auto` (the default) tries three renderers in order:

1. a Lolly desktop app that is **already listening**: the app writes its loopback port and a per-launch token to `render.json` in its data directory, and the CLI sends the job there and reads the bytes back;
2. an **installed** app, started in its hidden `--render-server` mode and given a bounded wait. An app too old to have that mode is never started, because it would open a window; `lolly list --json` says so by name;
3. the CLI's own **headless Chromium**, which drives the built web shell.

`LOLLY_RENDERER=desktop` or `chromium` pins one of them, and `desktop` reports the app's failure rather than rendering somewhere else. `LOLLY_DESKTOP_BIN` points at an app executable in an unusual place, and `LOLLY_RENDER_SERVER` points at a `render.json` directly. `lolly list --json` reports the choice as `result.environment.renderer` (`desktop-running`, `desktop-installed`, `chromium` or `none`) and the order under `result.environment.tiers.desktop`.

For Chromium, install it once with `lolly install-browser` and build the web shell with `pnpm run build:web`. `LOLLY_BROWSER_PATH` uses a browser binary you already have, `LOLLY_BROWSER_CHANNEL=chrome` uses an installed Chrome or Edge, and `LOLLY_WEB_DIST` or `LOLLY_WEB_BASE` points at a web shell built or served elsewhere.

The web shell needs WebGPU, so Chromium starts with SwiftShader, its software WebGPU adapter, by default. That gives every machine the same GPU results, and it is why a CI runner with no GPU renders the same files as a laptop. The page is also cross-origin isolated, with the same headers production sends, so threaded on-device models run under the same rules as in a browser.

### A Design deck with no browser

For a static Design document, `--export=pdf --text=outline` writes the whole deck in Node with the same drawing operations and PDF finishing as the app: authored page sizes, outlined words, JPEG and PNG pictures, print page boxes, bleed and marks, PDF/X metadata and final Content Credentials.

```bash
lolly run design --boxes-data=slides.json --export=pdf --text=outline --bleed=3mm --marks=crop,reg --output=deck.pdf
```

A static Design frame also exports as `svgz` with no browser (select one with `--s=<frame-id>`). Outlined strike-through and underline keep each run's font weight, colour and placement in SVG, SVGZ and PDF, and an underline clears descenders the way the browser does. A shared link's **Convert paths** setting is kept; by default words stay editable.

Some documents still take the browser route, with the reason reported: live text, composed text stories, password-protected PDFs, credentialed pictures, themed asset compositions, watermarks, unsupported effects or picture formats and runs whose glyph or decoration metrics cannot be resolved. The CLI sends the document once. A failed finishing or security pass fails the export, even with `--html-fallback`, and a hook failure is never retried as a tier limit. `pdf-cmyk` always takes the browser route, and a packed `.lolly` uses the app's exporter. `lolly list --json` lists `pdf` among Design's `nativeFormats` as a candidate, with these checks still applied to each document.

### Capture a web page

`url-shot` captures a live page from the terminal through the headless Chromium, as PNG, JPG, PDF or SVG. WebP capture needs the desktop app.

### The output extension is a format request

An extension picks a format, so it is checked like one. If the tool does not declare it, the run stops instead of writing the tool's first format under your filename:

```text
$ lolly qr-code --output=qr.csv
Error: --output=qr.csv asks for ".csv", which "qr-code" does not produce. Supported: svg,
penpot, png, jpeg, webp, avif, tiff, pdf, pdf-cmyk, cmyk-tiff, eps, eps-cmyk, dxf, emf,
svgz, wmf, bmp, jxl, jxl-lossless. Name one with --export=<format> if you meant to write
it under that filename anyway.
```

Naming the format is how you opt out: `lolly qr-code --export=svg --output=qr.notes` writes SVG under that name and exits `0`. An `--output` with no extension renders the tool's default format.

## Size, units and print

Everything that is not a reserved flag is a tool input, checked against the tool's manifest. Size, units and print settings are reserved flags. An A4 page:

```bash
lolly wordmark --text="Ship today." --width=210 --height=297 --unit=mm --export=pdf --output=page.pdf
```

`--unit` takes `px` (the default), `mm`, `cm`, `in`, `pt` or `pc`, and `--dpi` sets raster resolution for physical units (300 by default). `--bleed=<dim>` and `--marks=crop,reg,bleed,bars,prov` add print bleed and marks. They are browser-free for an outlined Design PDF and use the paint tier for other print formats.

`--press-profile=fogra39` (or `fogra51`, `swop`, `gracol`) **names** the CMYK press condition in the PDF's output intent. The CLI has no profile store, so it cannot embed one, and a named-only intent is not PDF/X-4: the output intent is written, the PDF/X-4 version claim is not. Embedding a profile you loaded is a web-shell feature today.

::: note --profile means the press condition
`--profile` is an alias of `--press-profile`, matching URL mode's reserved `profile` parameter, so a pasted link's `profile=fogra51` and a typed `--profile=fogra51` mean the same thing. A user-profile JSON file has its own flag, `--user-profile=<file.json>`.
:::

`lolly preflight` counts and checks a print job before you render it ([Preflight an export](/info/cli-automation.html#preflight-an-export-lolly-preflight)).

## Provenance on every file

Like the app, a CLI render carries two marks by default:

- a [Content Credential](/info/content-credentials-identity.html), signed with an anonymous on-device certificate unless you [set up your own identity](/info/cli-signing.html);
- the [Lolly Imprint](/info/exporting.html), a pixel watermark, in the formats whose bytes can carry a mark.

It also records the [design system](/info/exporting.html#the-design-system-record) it drew with, and prints that line before `✓ Wrote`. That system is the one a `--file` tokens document names, else the active terminal design system, else the catalog's own tokens.

`--no-provenance` turns off the credential, the Imprint and the durable mark in one word. Both default marks embed a fresh timestamp, so it is also the switch for byte-identical output; `smoke` and `batch` apply it themselves ([How far byte-identical output goes](/info/cli-automation.html#how-far-byte-identical-output-goes)). `--c2pa=off` and `--imprint=0` turn off one mark, and `--no-madewith` leaves out the design-system record. A tool opts out for everyone with `render.c2pa: false`, and an on-device privacy utility never carries either mark.

A render whose placed sources still need a licence decision writes the file and exits `4`, so a pipeline cannot ship it unnoticed. `--rights=private` says the render stays private, which settles a choice that only matters once a file is shared ([Creative rights and credits](/info/creative-rights.html)). Check any file with `lolly validate` ([Verify a file](/info/cli-reference.html#verify-a-file-lolly-validate)).

## Video and timelines

`--export=mp4`, `webm`, `gif`, `apng` or `webp-anim` drives the app's own sequence renderer inside the headless Chromium. Nothing is rebuilt for the terminal: the CLI hands the built web shell the tool's state, the shell records its timeline through WebCodecs and the finished file comes back as bytes. A Design timeline, a deck's `pptx` and an animated tool's `gif` all take that one path, so the file is the one the export panel would write.

The clip is yours to shape: `--fps=60 --seconds=6 --codec=h264 --vq=best` renders six seconds at 60 frames a second in H.264, and `--wait=2` holds two seconds before the first frame for a tool that fades in. These are the export panel's Frame rate, Duration, Start after, Codec and Quality fields, handed over as the URL parameters `fps`, `seconds`, `wait`, `codec` and `vq`, so a share link carrying them renders the same clip. `--seconds` sets an exact length even for a tool that would run to the end of its material. Without these flags the tool's own defaults apply: 30 frames a second and the length the tool or its material sets. Use `--codec=h264` when the file has to play everywhere, because Auto may pick AV1.

For Design movies, `--seqrange=2,5` exports the authored two-to-five-second range with its mix. `--motionblur=8,180` blends eight subframes with a 180-degree shutter; it supports SDR flat Sequence output, unsupported colour and tilt paths fail explicitly. Neither setting changes audio timing.

A long movie can take much longer to render than to play. The CLI waits as long as the render keeps reporting progress: each frame restarts a ten-minute idle wait. A stall still stops the render, and a page crash fails at once. Set `LOLLY_EXPORT_IDLE_TIMEOUT` in seconds to allow more (`1800` is thirty minutes); desktop render endpoints use `LOLLY_CLI_TIMEOUT` instead. A web shell built before progress reporting gets the longer wait but cannot restart the timer, so rebuild the web shell.

::: details Measured times and sizes
Measured in September 2026 on one machine (Apple silicon, a built `shells/web/dist` and the headless Chromium), from a nine-box animated `design` state and a four-slide deck. Your numbers will differ; the pattern will not.

| Command | Wall | What came out |
|---|---|---|
| `design --z=… --export=mp4` | 20.9 s | 359,632 B: AV1, 1920x1080, 30 fps, 90 frames, 3.00 s |
| `design --z=… --export=webm` | 24.0 s | 359,579 B: AV1 in Matroska, the same frames |
| `design --z=… --export=gif` | 30.7 s | 1,030,239 B: 1920x1080, 45 frames |
| `design --z=… --export=apng` | 95.9 s | 8,905,914 B |
| `design --z=… --export=pdf` | 32.8 s | 29,882 B |
| `deck-studio --export=pptx` | 7.0 s | 383,207 B: 4 slides, layouts and media |
| `design --bx=…` with an audio box, `--export=mp4` | 8.4 s | 69,801 B: AV1 video plus AAC, 48 kHz stereo |

A timeline with an audio box comes back with real sound and a master pass: the peak of that last file sits at the -1 dBTP limiter's ceiling. `tests/cli-tierb-video.test.ts` renders an mp4 and a pptx through the built web shell and reads both back, and skips by name when the web shell or the browser is missing.
:::

Video bytes are **not** the same run to run, because the browser's paint and encode move. Compare video by rendering and inspecting, never by digest.

### Review a timed composition

Use `--export=png --cuts=6 --output=frames.zip` for six evenly spaced stills, or `--sampletimes=0,1.5,3` for exact timeline seconds. One time gives one image; several give a ZIP of PNG, JPG, WebP or SVG stills, or one paged PDF. Both need the paint tier and exit `3` without one. Times must increase and fall before the timeline ends; they cover native timed layers and refuse unsupported animated media. [Contact sheets](/info/url-export.html#contact-sheets) has the full contract.

### Motion delivery checks

`lolly inspect --motion movie.webm` checks a delivered file with `ffprobe` and `ffmpeg`, when they are installed. It reports dimensions, duration, frame rate, audio, loudness and true peak, plus black, frozen and silent spans for review. A missing decoder gives an explicit not-run result. To check a video against agreed numbers, see [Production checks](/info/production-checks.html#check-a-video-delivery).

### The soundtrack, with no browser (lolly mix)

The frames need a paint engine; the sound does not. A timeline's mix is a closed form over decoded audio, and every number in it (the equal-power pan, the fades, the ducking, the BS.1770 loudness meter, the -1 dBTP true-peak limiter) is engine code shared with the app. `lolly mix` lets a pipeline hear a timeline, compare two mixes or feed a mastering step with no Chromium.

It takes a design state as a share link, a bare query or a file holding one, or a plan JSON (`{ totalSec, clips: [{ id, src, startMs, durMs, … }], bed }`):

```bash
lolly mix 'https://lolly.tools/#/tool/design?bx=…' --out=mix.wav
lolly mix ./plan.json --out=mix.wav --normalize=-16
```

`--normalize=<LKFS>` sets a loudness target (`-14`, `-16`, `-23`); without it the mix is not normalised. The limiter runs either way. The result is bit-identical to the app's, which a test pins by running both over one specification.

Node reads WAV and Lolly's generated ZzFXM songs. An mp3, m4a, opus, flac or webm clip needs a codec this shell does not have, so it is **named and left out** rather than mixed as silence, and a timeline where nothing decodes is refused. The catalog's own music is `.opus`, so a state that uses a shipped loop is refused and told which route works: `lolly design --export=wav`, through the paint tier. The Node plan reader also leaves out volume keyframes and the crossfades a sequence lane derives from its neighbours, with a warning; a plan JSON can carry crossfade values itself. [CLI file and media utilities](/info/cli-files.html#text-to-speech-and-back) lists the decoder limits.

A rondocode song can be the whole soundtrack: give `lolly mix` a `.rondo` file, a `.rondo.json` file or a `rondocode.com` share link, and `--seconds=<n>` for its length (without it, the song's own arrangement, or eight cycles):

```bash
lolly mix ./acid.rondo --seconds=20 --out=acid.wav --json
```

The song's code runs in the `vm` execution class, QuickJS in WebAssembly with no host, inside a worker the CLI stops when its time runs out; one line on stderr says so, with the renderer's version and seed. A part the render cannot play is a warning with its own code (`RONDO_PART_MIC`, `RONDO_PART_SING`, `RONDO_PART_SAMPLE`), so `--strict` exits `2`, and `--json` carries the class and findings under `result.song`. A plan clip can point at a song, and so can a tool's audio input (`lolly audiogram --audio=acid.rondo`).

A mix that holds a song is signed with Content Credentials that record each song as a source: its name, the SHA-256 of its `.rondo.json` and how it was rendered. When the whole file is one song, the credential and the WAV's comment tag also say the music was computed from the song's code with no trained model. The CLI reads the file back and lists the songs its credential records, and `--json` carries the same under `result.credentials`. `--c2pa=off` or `--no-provenance` leaves this out, and `--sign-key`/`--sign-cert` sign with your identity. A mix with no song carries no credential.

## Composed tools

Some tools place another tool's render as an asset, declared in the manifest (`composes`), with no tool-to-tool imports. No tool in the public catalog declares `composes` today; a brand pack's tool can, for example a badge that places a `qr-code` render. The runtime resolves it on mount, so the outer tool renders with **no extra flags**.

On the CLI an SVG child composes end to end and stays vector. A raster child is left out and the outer tool still renders, without that slot. The app composes a raster child in full.

## Run a share link

A pasted `lolly.tools` tool link can be the **first argument**. The CLI splits it into a tool id and its inputs, and any flag after it overrides what the link carried:

```bash
lolly 'https://lolly.tools/t/qr-code?url=https://example.com&color=%230c322c' --export=svg --output=qr.svg
lolly 'https://lolly.tools/#/tool/qr-code?url=https://example.com&color=%230c322c' --export=svg --output=qr.svg
lolly 'https://lolly.tools/tool/qr-code.svg?url=https://example.com' --output=qr.svg
```

The first is the link the app's address bar and Share dialog give you, the second the older route form and the third the embed URL, whose extension picks the format. The `/tool/<id>` spelling, a bare `/<id>` and a `lolly://` link work too. Anything else is a usage error naming the URL, never a render of the tool's defaults.

The reverse is `--share` (or `--link`), which prints a link for the inputs you passed instead of rendering:

```bash
lolly qr-code --url=https://example.com --share
```

## When the browser tier fails, ask it why (--tier-b-debug)

A failed paint-tier render exits `3` and says which step ran out of time. `--tier-b-debug` (or `LOLLY_TIER_B_DEBUG=1`) keeps the headless page's console, page errors and network log, times every step and **on failure** writes them to `<output>.tier-b-debug.log`, or to `lolly-tier-b-debug-<tool>.<format>.log` in the working directory when there is no `--output`. A run that succeeds writes nothing, and each section stops at 500 lines.

```text
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

## Flags

Every reserved flag below works on `lolly run` and on the bare `lolly <tool-id>` form. Anything else is a tool input (`--<inputId>=<value>`), and a bare flag with no `=` is true, which suits boolean inputs. Flags that apply to every command, such as `--json` and `--strict`, are in the [CLI reference](/info/cli-reference.html#global-flags).

::: details Output and format
| Flag | Meaning |
|---|---|
| `--output=<path>` | Write to a file (`-` is stdout). Omit it to stream to stdout. |
| `--filename=<name>` | Name the output file in the working directory, without a path. `--output` wins if both are given, with a warning. |
| `--export=<fmt>` | Output format (`png`, `svg`, `pdf`, `gif`, …). Defaults to the `--output` extension, then the tool's first format. Refused by on-device transform tools ([CLI file and media utilities](/info/cli-files.html)). |
| `--input.<id>=<value>` | Set a tool input whose id is also a reserved flag (`width`, `height`, `format`). Without it the value goes to the export. |
| `--text=outline\|live` | Vector text as paths or editable text. `svg` defaults to `outline`. `emf` defaults to `live`: real metafile text records, editable in Office and Google Slides, with runs the format cannot express (tracking, feature settings, strokes, skew) outlined per run. `live` cannot apply to `wmf`, `eps` or `dxf`, and the paint tier follows the app's defaults; both cases warn. |
| `--html-fallback` | Opt in: when the format cannot be produced here, write HTML under a `.html` name instead of failing. Hook, integrity and PDF finishing failures still fail. |
| `--export-report=<path>` | After the file is written, compare what was asked for with what the file holds, read from its bytes: container, size, page count, resolution, duration and frames, alpha, colour model, HDR signalling, Content Credentials presence, encryption and fonts. The JSON report is bound to the bytes by SHA-256 (`-` writes it to stderr). A value the file cannot supply is a gap, never a pass, and each difference warns, so `--strict` exits `4` when the file is not what was asked for. A credential is reported as present, not verified; run `lolly validate` for that. With `--bleed` or `--marks`, a PDF with a trim box is compared with the trim, one with only a media box with the whole sheet and a CMYK TIFF with the whole sheet's pixels. On-device transforms refuse the flag. |
:::

::: details Size, print and colour
| Flag | Meaning |
|---|---|
| `--width=`, `--height=` | Output size (numbers), in `--unit`. |
| `--unit=` | `px` (default), `mm`, `cm`, `in`, `pt`, `pc`. |
| `--dpi=` | Raster DPI for physical units (default 300). |
| `--bleed=<dim>`, `--marks=<list>` | Print bleed and marks (`crop`, `reg`, `bleed`, `bars`, `prov`). |
| `--press-profile=<cond>` | CMYK press condition (`fogra39`, `fogra51`, `swop`, `gracol`), named in the PDF's output intent. `--profile` is its alias. |
| `--depth=8\|16\|float`, `--hdr=1` | Bits per channel, and the HDR view transform. A float format over an 8-bit render is refused (exit `4`). With `--hdr=1`, **PNG** is written at 16 bits in Rec.2100 PQ (`--depth=8` is answered rather than obeyed, because 8-bit PQ bands in the shadows) and **JPG** as an ISO 21496-1 gain-map file, an ordinary SDR JPEG that older viewers show unchanged. Both are encoded in this shell, so they match an app export byte for byte, and an `<svg>`-based tool writes a gain-map JPEG with no browser. `avif`, `tiff` and 10-bit `mp4`/`webm` go to the paint tier. `webp` stays 8-bit SDR everywhere. `--hdr` with `--durable` exits `3` (`HDR_DURABLE_UNAVAILABLE`), because the durable mark needs the browser's encoder. |
| `--lang=<code>` | Content language (`de`, `ja`, `ar`, …). |
:::

::: details Provenance and rights
| Flag | Meaning |
|---|---|
| `--c2pa[=7\|30\|90\|365]` | Content Credentials, signed with an on-device certificate of that lifetime in days (default 30). **On by default**; `--c2pa=off` opts out. Sign with your own identity with `--sign-key`/`--sign-cert` ([Signing from the terminal](/info/cli-signing.html)). |
| `--imprint` | The Lolly Imprint pixel watermark. **On by default** for `png`, `jpg`, `webp`, `avif`, `tiff`, `bmp`, `jxl`, `jxl-lossless`, `pdf`, `pdf-cmyk` and `pptx`; `--imprint=0` opts out. In `pdf`, `pdf-cmyk` and `pptx` the mark rides only the raster images the file embeds, so a page of text and shapes carries none. On a browser-free PNG the CLI embeds the mark itself. A render too small to carry a detectable mark says so and is written unmarked. |
| `--no-provenance` | No credential, no Imprint, no durable mark: the switch for byte-identical output. Combining it with an explicit `--c2pa`, `--imprint` or `--durable` is a usage error. |
| `--no-madewith` | Leave out the [design-system record](/info/exporting.html#the-design-system-record): the design system, version and colourway in the metadata and credential, and the colourway beside the tool in the description. **On by default**; `--_madewith=0` is the same switch. The record holds no timestamp, so `--no-provenance` leaves it alone. |
| `--rights=private` | This render stays private, so no delivery claim is recorded. The **Rights** block still prints what the placed sources ask for, but a choice that only matters once a file is shared is not owed, and the run exits `0`. There is no flag for ignoring a licence condition. |
| `--durable=1` | The opt-in durable (TrustMark-format) mark. **Off** by default: it is a neural encode and needs the encoder model on this machine. |
| `--password=<pw>`, `--password-stdin` | An open password for a rendered PDF. `--password` is visible in `ps`, so prefer `--password-stdin`; giving both is an error. |
:::

::: details Video and timeline flags
| Flag | Meaning |
|---|---|
| `--fps=<n>`, `--seconds=<s>`, `--wait=<s>`, `--codec=h264\|hevc\|vp9\|av1`, `--vq=smaller\|balanced\|best` | Clip controls for `mp4`, `webm`, `gif`, `apng` and `webp-anim`, as the URL parameters of the same names ([URL Mode](/info/url-mode.html)). |
| `--cuts=<n>`, `--sampletimes=<s,…>` | Stills from a timed composition, as a ZIP or one paged PDF ([Review a timed composition](#review-a-timed-composition)). |
| `--seqrange=<a,b>`, `--motionblur=<n,deg>` | A range of a Design movie, and subframe motion blur. |
| `--s=<slide>` | One slide or frame of a Design document, by 1-based number or frame id. |
:::

::: details Links, design systems and data
| Flag | Meaning |
|---|---|
| `--share`, `--link` | Print a `lolly.tools` link for these inputs instead of rendering. |
| `--z=<token>` | Expand a packed link token into the inputs it holds. |
| `--zx=<token>`, `--link-password=<pw>` | A password-protected link's state, and its password. A missing or wrong password exits `6`, never a render of the tool's defaults. |
| `--designv=<slug\|latest>` | The design-system version to render against ([URL parameters](/info/url-parameters.html)). |
| `--emoji=<set@version>`, `--emojifx=<treatment>`, `--emojistyle=<json>` | The emoji set, its brand treatment and an exact style snapshot ([URL parameters](/info/url-parameters.html)). |
| `--user-profile=<file.json>` | A user-profile JSON file that pre-fills `bindToProfile` inputs. A path that cannot be read or parsed exits `2`. |
| `--<inputId>-data=<file>` | Fill an input from CSV, TSV, JSON, Markdown or `.xlsx`: rows into a `blocks` input, a `table` (first row as headings) or a `text`/`longtext` field. `--<inputId>-sheet=<name\|index>` picks a sheet; without it the first is read, and the CLI says so. |
| `--verify` | For an on-device utility, print one line per file once its export checks ran. A failed check writes nothing and exits `1`. |
| `--tier-b-debug` | Keep the headless page's logs and write them beside the output on failure ([When the browser tier fails](#when-the-browser-tier-fails-ask-it-why-tier-b-debug)). |
:::
