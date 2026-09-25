# Render with the CLI

Choose export options, troubleshoot the browser renderer and render timelines or links.

Part of [CLI](/info/cli.html).

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
| `--rights=private` | Say this render stays private, so no delivery claim is recorded. The **Rights** block still prints what the placed sources ask for (the credit, the licence, what changed), but a choice that only matters once a file is shared - a recoloured CC BY-SA emoji that would need a compatible licence - is not owed, and the run exits `0`. Without it, a render whose sources still need a decision writes the file and exits `4` (`REFUSED`) so a pipeline cannot ship it unnoticed. There is no flag for ignoring a licence condition. See [Creative rights and credits](/info/creative-rights.html). |
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

The CLI renders in a headless DOM (jsdom), so **vector and structured** formats - **SVG (and SVGZ), EMF, WMF, EPS (and EPS-CMYK), DXF, BMP, HTML, plus the data formats JSON, CSV, ICS, VCF, MD** (the engine hydrates those payloads) - work natively and reproducibly, no browser needed. The float formats **EXR** and **HDR** join them, over a resvg-rasterised frame, when a render asks for the headroom (`--hdr=1`). EMF, EPS and DXF are emitted straight from the template's vector primitives (no rasteriser), and the CLI carries the **same HarfBuzz text-shaping as the web shell** (`host.text`), so live `<text>` runs are outlined to true vector paths at export - EPS and DXF ship real text as geometry with no fonts needed on the receiving end, EMF keeps plain runs as live, editable text records by default (`--text=outline` forces paths), and font-driven tools (a wordmark lockup built on `host.text`, say) render headlessly too. Shaping resolves sfnt fonts (ttf/otf) under the repo root - catalog and tool-local faces; a browser-only woff2 face is rejected with a clear error rather than silently shaping blanks. **PNG** from an `<svg>`-based tool is also browser-free - resvg rasterises the engine's own SVG (Tier A), and so are the two **HDR stills** over that same frame (`--hdr=1` with `png` or `jpg`): the 16-bit Rec.2100-PQ PNG and the ISO 21496-1 gain-map JPEG are written by the engine's own encoders, which is why a JPEG that would otherwise need the paint tier comes out of a plain install here. **`penpot`** from an `<svg>`-based tool is browser-free the same way, and for the same reason as EMF/EPS/DXF above - it is built straight from the template's vector primitives, with the brand's colours and design tokens packed in alongside. No rasteriser and no browser sit in that path, so it needs neither the resvg tier PNG uses nor a Chromium; type styles come from the app's own font-role read, so a CLI archive carries no library typographies. An HTML-layout tool has no root `<svg>` to build from, so it goes to the full-fidelity tiers below and says so before it does. The remaining raster formats - **JPG, WebP, PDF, PPTX and video (GIF, APNG, WebM, MP4)**, plus HTML-layout PNG - need a real paint engine. `LOLLY_RENDERER=auto` (the default) walks three rungs: a Lolly desktop app that is **already listening** (the app writes its loopback port and a per-launch token to `render.json` in its data directory, and the CLI sends the job there and reads the bytes back on the same connection), then an **installed** app that is not listening yet, started in its hidden `--render-server` mode and given a bounded wait to answer (an app that predates the endpoint is never started, since it would read the flag as a request for a window; `lolly list --json` says so by name), then the CLI's own **scoped headless Chromium**, unchanged. `LOLLY_RENDERER=desktop` or `chromium` pins one of those, and `desktop` reports the app's failure rather than quietly rendering somewhere else; `LOLLY_DESKTOP_BIN` gives the path to an app executable in an unusual place and `LOLLY_RENDER_SERVER` points at a `render.json` directly. If Chromium is selected, install it once with `lolly install-browser` (or `pnpm run install:browser`). `lolly list --json` reports the chosen renderer as `result.environment.renderer` (`desktop-running`, `desktop-installed`, `chromium` or `none`) and the resolved order under `result.environment.tiers.desktop`. Those paths are measured rather than assumed - [Video and timelines](#video-and-timelines) has the wall times and the file sizes. **ZIP** is the one format the lean CLI leaves out - no zip dependency - so its batch writes a folder instead. `ico` (favicons) and `txt` are full-fidelity formats like the raster set: `txt` is not a data format the engine hydrates, it is the *rendered* page serialised to plain text, which is why it needs a paint tier and not just jsdom. `jpg` and `jpeg` are one format with two spellings and either flag works on either kind of tool - manifests are split between the two, and `--export=` resolves to whichever the tool declared. (Requesting a format a tool doesn't declare prints a clear error listing what it supports - and so does asking for one via the `--output` extension.)

Which tier is available here is not a guess: `lolly list --json` reports it per tier, with a reason for each one that is missing. See [Discovery, for an agent](/info/cli-automation.html#discovery-for-an-agent).

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

Two things about the tier changed with it, and both are visible without the flag. **A failed browser render now exits.** The pooled Chromium and the local static server used to be torn down only on the success path, so a Tier B failure printed its error and then sat there with a live event loop; it read as a hang rather than as a failure. It exits `3` (`UNAVAILABLE_HERE`) now, and the failure sentence says which step ran out of time. And **the page the CLI drives is cross-origin isolated**, sending the same `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` pair production sends. Without them `SharedArrayBuffer` was absent in every headless render, so threaded on-device models ran under different rules in the terminal than in a browser - which is what made `--durable=1` and `validate --deep` unreliable here.

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

Video bytes are **not** reproducible run to run. The browser's paint and encode move, and a frame-timed capture moves with them. Compare video by rendering and inspecting, never by digest - see [How far "the same" goes](/info/cli-automation.html#how-far-the-same-goes-byte-for-byte).

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

## Composed tools

Some tools **embed another tool's render** as an asset - declared in the manifest (`composes`) with no tool-to-tool imports. For example, `event-name-badge` composes `qr-code` as an SVG. Composition is transparent on the CLI: the runtime resolves it on mount, so the embedding tool renders headlessly with **no extra flags**.

It follows the same vector stance as the rest of the CLI: an **SVG child composes end-to-end and stays vector**, while a **raster child is omitted gracefully** (the parent still renders, just without that slot). For full raster-child composition, run the Tauri-bundled build - the same boundary as raster export above.

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

[Back to CLI](/info/cli.html).
