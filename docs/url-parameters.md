# Reserved URL parameters

Most parameters in a Lolly link are the tool's inputs. The names below are reserved for the app: they set the file's format and size, what happens when the link opens and the file's metadata. No tool may use a reserved name for an input, so `format=pdf` means the same thing in every tool.

Each row says where the name works and links to a fuller explanation where one exists. For worked examples, see [Links that do something on open](/info/url-export.html).

Rules for every table:

- **Presence flags.** `export`, `copy`, `full`, `iframe`, `options`, `nostage`, `present` and `kiosk` work by appearing in the link. Their value is ignored.
- **Reserved namespaces.** A name that starts with `_` is skipped before input matching, and no tool input or `urlKey` may claim one. A new reserved name comes from this namespace, so the name never collides with a tool's inputs. A name that starts with `pkg.` is kept for Linux package metadata in the same way.
- **The CLI.** Each name works on the command line as `--name=value`, unless its row says web only. A web-only name changes nothing in a CLI render, and the CLI prints a warning. With `--strict`, that warning makes the run exit 2. A name marked CLI only has no meaning in a browser.

<!--i:eti-external-link-->
## What happens on open

| Param | Where | What it does |
|---|---|---|
| `export` | web + CLI | Download the file as soon as the tool finishes rendering. [How to use](/info/url-export.html#download-a-file) |
| `copy` | web only | Ready the Copy button. The copy runs on your first click, because a browser allows clipboard writes only after a gesture. [How to use](/info/url-export.html#copy-to-the-clipboard) |
| `full` | web only | Open with the sidebar collapsed, so the canvas fills the window. [How to use](/info/url-export.html#open-clean-embed-or-publish) |
| `iframe` | web only | Show only the rendered output, for a tool inside another page. Implies `full`, removes all app chrome and keeps nothing on the device. [How to use](/info/url-export.html#open-clean-embed-or-publish) |
| `options` | web only | Open with the export settings panel expanded instead of the collapsed Render button. `full` wins if both are set. |
| `nostage` | web only | On a tool that exports: the `html` export fills the whole window, with no centred card. On a tool with no export: open as a plain web page with no controls. [How to use](/info/url-export.html#open-clean-embed-or-publish) |
| `present` | web only | Open a Lolly Design document as a fullscreen, click-advanced deck, or start a timed document's playback. [How to use](/info/url-export.html#present-a-deck) |
| `s` | web + CLI | A slide's address in a deck: a 1-based position, a frame id or `2.3` for a build step. With `present` it opens that slide; with an export format it renders that slide alone. |
| `kiosk` | web only | With `present`: wrap at the ends and loop a timed document, for signage. |
| `slot` | web only | Load a saved session by name. Other parameters in the link override the saved values. [How to use](/info/url-export.html#resume-a-saved-session) |
| `template` | web only | Start a fresh session from one of the tool's `templates[]` entries, skipping the **New from template** chooser. |
| `preset` | web only | With `template`: apply one of that template's presets, such as `?template=poster&preset=story`. |

::: details More on iframe, present, s and kiosk
**`iframe`** shows a tool inside another page: a Lolly Design slide, a docs page, a second screen or a kiosk. It keeps no saved session, no history entry, no sounds and no address changes. It ignores `export`, `copy`, `options`, `present` and `slot`. The deployment sets which pages may frame the app.

**`present`** turns a frame document (Lolly Design) into a deck. Its frames become slides in presentation order (`order`, then `x` to break a tie). A timed document without frames mounts normally and starts its sequence transport instead. The CLI warns that the flag has no effect.

**`s`** reads a number such as `s=2` as the 1-based position in presentation order. Any other value (`s=slide1`, a ULID) is a frame id, and an `.N` suffix (`s=2.3`) picks a build step. Without `present`, the editor centres that frame when it opens. As a still-export filter, `?s=2&format=png` renders only that slide. `lolly design --s=2 --export=png` does the same, because both shells resolve the address with the same engine code. Build steps are for the presenter only: a still export always shows every build. Formats that carry the whole deck (`pdf`, `zip`, `pptx`, `html`, `scorm`) and the motion formats, where time picks the frame, render whole, and the CLI reports that it ignored the filter. An address that matches no slide never falls back to slide 1: the web app exports the whole deck and reports the mismatch, and the CLI exits 2 and writes nothing.

**`kiosk`** makes the presenter wrap at the ends and a timed document's transport loop, so `?present&kiosk` suits digital signage. Set each frame's `dur` for the dwell time. Until 2026-08-28 the flag was called `loop`. `loop` is an input id in several tools, so the name could not be reserved. Old `?present&loop` links no longer loop and need `kiosk` instead.

**`template` and `preset`** read the entry's values inside the app and are never packed into the link. An unknown or missing template id opens the tool as usual. An unknown preset applies only the template's base values. A bare `?template=` opens the chooser. The CLI does not apply a template entry and warns that both had no effect; give the entry's values as flags instead.

**`slot`** has no effect on a CLI render, and the CLI warns. Read the projects saved on this computer with `lolly projects list` and `lolly projects show <slot>`.
:::

<!--i:eti-file-->
## The file

| Param | Where | What it does |
|---|---|---|
| `format` | web + CLI | The output format (`png`, `svg`, `pdf`, …), used by `export` and `copy`. Any value in the tool's `render.formats`. [Every format value](/info/url-export.html#download-a-file) lists the values, and [Every format Lolly can open and make](/info/formats.html) says what each format is for. |
| `filename` | web + CLI | Name of the downloaded file, without the extension. Defaults to the tool id. On the CLI, `--filename=<name>` writes to the working directory under that exact name, so include the extension. `--output` wins if both are given, with a warning. A `filename` in a link that holds a path is refused, and nothing is written. |
| `output` | CLI only | The path to write the file to. Defaults to stdout. |
| `width` / `w` | web + CLI | Output width, as a value in `unit`. Also fills in the export panel. [How to use](/info/url-export.html#set-the-size) |
| `height` / `h` | web + CLI | Output height, as a value in `unit`. Also fills in the export panel. |
| `unit` | web + CLI | The unit for `width` and `height`: `px` (the default), `mm`, `cm`, `in`, `pt` or `pc`. |
| `dpi` | web + CLI | Raster resolution for physical units (default `300`). Ignored for `px` and for vector formats. |
| `password` | web + CLI | An open password for `pdf` and `zip`, standard tier only, read when a link opens. It deters casual opening and does not protect confidential material. Lolly never writes it into a link. [Exporting](/info/exporting.html#password-protection) |
| `_text` | web + CLI (`--text=outline`) | How an `emf` export writes text. Off by default: text stays live and the fonts on the reader's device draw the letters. `_text=outline` draws each line as vector outlines, like ticking **Outline fonts** in the export panel. A line that no font here can draw goes in as a picture. The CLI passes the setting to the browser when `lolly <tool> --export=emf --text=outline` needs the browser. |

::: warning A password in a link can stay in your browser's history
The web app removes `password` from the address when the link opens, but your browser may still remember the address you opened. Type the password in the export panel when you can.
:::

::: details Size on a document with several artboards
On a Lolly Design document with more than one artboard, the artboards set the size. `width` and `height` describe the active artboard: the selected one for still formats, the one under the playhead for animated ones. In the app, the export panel follows that artboard, and editing the fields resizes the artboard.

Still images give one file per artboard at that board's size, zipped when there is more than one, and `?s=` narrows the set to one board. PDF and PPTX carry every board as a page at its own size. The animated formats composite every scene into a `width` by `height` frame and letterbox a board whose aspect differs. On a framed document, `w` and `h` never scale the whole set: they are the size of one board and of the video frame.
:::

::: details More on password
The web app reads a link's password and removes it from the address at once, along with `export` and `copy`, so a reload opens the tool instead of writing the file again with no lock. The address bar, a copied link, a saved session and the file's metadata never hold the password.

A password must be able to protect the file, or nothing is written. In the web app, the CLI and the TUI, `password` on any format other than `pdf` or `zip`, or on a `pdf` with `bleed` or `marks`, is refused. So is a `pdf` password beyond plain ASCII, because readers cannot open a file locked that way at this tier. Only the first 32 characters of a `pdf` password count. An encrypted PDF cannot take `c2pa`, so a locked PDF holds no credential.

The export panel's strong AES-256 tier also covers `pdf-cmyk`, print marks and any alphabet. It is typed at export and never travels in a link. The hot-link render URL has no lock and refuses `password` with a 400.
:::

<!--i:eti-animation-->
## Motion and timed documents

| Param | Where | What it does |
|---|---|---|
| `fps` | web + CLI/MCP | Frame rate for `mp4`, `webm`, `gif`, `apng` and `webp-anim`: a whole number from 1 to 120. Absent or invalid keeps each format's default (30 for video). |
| `seconds` | web + CLI/MCP | Clip length, from 0.5 to 3600 seconds. A length given here is kept exactly, even where a tool would stretch the clip to its material. |
| `wait` | web + CLI/MCP | Seconds to wait (0 to 30) before the first frame is captured, for a fade-in or a data fetch. |
| `codec` | web + CLI/MCP | Video codec for `mp4` and `webm`: `h264`, `hevc`, `vp9` or `av1` (`avc`, `h265`, `vp09` and `av01` read the same). Absent means the best the encoder offers. |
| `vq` | web + CLI/MCP | Video quality: `smaller`, `balanced` (the default) or `best`. |
| `cuts` | web, CLI and MCP | A contact sheet: `2` to `64` stills sampled across a timed composition. [How to use](/info/url-export.html#contact-sheets) |
| `sampletimes` | web auto-export, CLI; MCP `sampleTimes` | Stills at exact timeline seconds, such as `0,1.5,3`. |
| `motionblur` | web, CLI, MCP `motionBlur` | Temporal samples and shutter angle, such as `8,180`. Off when absent. |
| `seqrange` | web, CLI, MCP `sequenceRange` | A temporary movie in and out, in seconds, such as `1,3`. Includes the whole mix and leaves the saved markers alone. |

::: details More on the motion settings
`fps`, `seconds`, `wait`, `codec` and `vq` match controls in the export panel: the Frame rate select (24, 25, 30, 50 or 60 there; any whole number here), the Duration field, the Start after field, the Codec select and the Quality select, which sets the bitrate ladder. On the CLI, `--fps=60` and the rest go to the browser tier.

**`seconds`** is carried as `durationUserSet`, so a tool whose hook would stretch the clip (the Audiogram runs to the end of its audio; a Sequence to its timeline) renders exactly this long. `duration` is an input id in several tools (3D, Lolly Flythrough, Spatial Photo), and a reserved name must collide with none, so the name is `seconds`. `vq` is short for the same reason: `quality` is an input of Convert Image.

**`codec`** left at Auto is AV1 on many machines. Pin `codec=h264` when the file has to play in every browser's `<video>` or on an older phone.

**`sampletimes`** takes 1 to 64 strictly increasing finite times, from zero and before the composition ends. One time returns one still; several return a ZIP or a paged PDF. It cannot be combined with `cuts` above 1. Raster samples use the Sequence compositor for animated sources. Unsupported SVG motion and tilted scenes fail with a message.

**`motionblur`** works for SDR sRGB Sequence movies and explicit raster samples. Paths it does not support fail with a message.

**`cuts`** at the default `1` keeps the playhead still. PNG, JPG, WebP and SVG sheets return a ZIP; PDF returns one document with a page per still. The CLI and MCP need the browser tier for a contact sheet.
:::

<!--i:eti-scissors-->
## Print

| Param | Where | What it does |
|---|---|---|
| `bleed` | web + CLI (browser tier) | Bleed for `pdf`, `pdf-cmyk` and `cmyk-tiff`, as a dimension such as `3mm` or `0.125in`. [How to use](/info/url-export.html#print-ready-output) |
| `marks` | web + CLI (browser tier) | Print marks for the same formats, as a list of `crop`, `reg`, `bleed`, `bars` and `prov`. |
| `profile` | web + CLI | The colour profile. For `png` and `jpg`, `srgb` (the default) embeds an sRGB profile and `none` leaves it out. For `pdf-cmyk` and `cmyk-tiff`, the press condition, such as `fogra51`, or `own` to embed a CMYK profile loaded on this device. |
| `_spots` | web + CLI (`--spots=process`) + MCP (`spots: "process"`) + terminal app | How the CMYK formats print the design system's spot inks. Off by default: each spot ink prints on its own named plate. `_spots=process` prints each spot ink with the four process inks instead. Finishes keep their own plates. [Exporting](/info/exporting.html#spot-inks-as-process) |

::: details More on profile and _spots
For the print formats, a named condition such as `fogra51` goes into the PDF's output intent without profile bytes and into the TIFF's provenance. Lolly's one bundled CMYK profile, Coated FOGRA39, converts colours for the default condition but is not embedded: it is ICC version 4.3, and PDF/X-4 accepts versions up to 4.2. `profile=own` embeds a CMYK profile loaded on the device that opens the link. A conformant PDF/X-4 Print PDF needs one; [Print-ready output](/info/url-export.html#print-ready-output) covers what else can withhold that claim. `own` resolves only when exactly one such profile is loaded; otherwise it writes no output intent and declares nothing. A profile's digest never travels in a link, so the recipient's device decides which profile is embedded, and so the file's size.

**`_spots=process`** writes each spot ink as the CMYK build the design system gives that colour. A colour with no build of its own takes the press condition's conversion, like any other colour in the artwork. The Print PDF then has the four process plates and nothing more. A finish such as foil, emboss, spot varnish or a die line is not an ink and keeps its own named plate. Printing a finish in process would put its black mask on the page. The Print TIFF and `eps-cmyk` have no named plates, so they print each ink in process with or without this parameter. Only `process` turns the choice on; any other value, or none, keeps the spot plates. The choice travels in a share link, like `profile`, and is not recorded in the file.
:::

<!--i:eti-stamp-->
## Provenance and metadata

| Param | Where | What it does |
|---|---|---|
| `c2pa` | web + CLI (on by default) | Content Credentials. `c2pa=off` turns them off for one export; `c2pa=7`, `30`, `90` or `365` sets the certificate lifetime in days. [Content Credentials](/info/content-credentials-identity.html) |
| `imprint` | web + CLI (on by default) | The Lolly Imprint, a pixel watermark on raster art Lolly rendered. `imprint=0` or `imprint=off` turns it off. [Exporting](/info/exporting.html#provenance-watermark) |
| `durable` | web (off by default) | A Durable Content Credential: a TrustMark-format watermark that survives a metadata strip. `durable=1` turns it on. |
| `meta` | web + CLI (on by default) | The plain generator field (`Lolly lolly.tools`) in formats that have one. `meta=off` (or `meta=0`) leaves it out. |
| `_madewith` | web + CLI (`--no-madewith`) + MCP (`madeWith: false`) | The design-system record: which design system, version and colourway drew the file, plus the brand page address when its publisher opted in. On by default; `_madewith=0` leaves it out. [Exporting](/info/exporting.html#the-design-system-record) |
| `licence` | web + CLI (`--licence=`) | The licence you declare for your own export, written into the file's licence metadata. |

::: details More on c2pa
`c2pa=off` means the file holds no credential. An SVG or SVGZ that inlines credentialed artwork, such as a catalog logo, loses that artwork's credential too, because a verifier reads the inlined credential as the file's own. Only the credential goes; the Lolly Imprint and the file's other metadata stay. The same applies to unticking the export card's box, to `--c2pa=off` and `--no-provenance` on the CLI and to the TUI's C2PA row at `off`. With no setting, nothing here changes the file.

A tool opts out with `render.c2pa: false`, and an on-device privacy utility never carries a credential. `c2pa=1`, or a bare `--c2pa` on the CLI, uses the default lifetime of 30 days. In the web app, an enrolled identity's certificate window, fixed at enrolment, takes precedence and the lifetime value is ignored. The CLI signs with an ephemeral certificate only. `--no-provenance` turns off the credential and the imprint together, for byte-identical output from run to run. On a PDF, `c2pa` cannot be combined with `password`. The MCP server's `lolly_render` takes the same values through its `c2pa` argument and has its own default: [Content Credentials and the c2pa argument](/info/mcp.html#content-credentials-and-the-c2pa-argument).
:::

::: details More on imprint
The imprint marks raster exports (`png`, `jpg`/`jpeg`, `webp`, `avif` and the RGB `tiff`, not Print TIFF). It also marks raster content Lolly rendered inside a `pdf`, `pdf-cmyk` or `pptx` export, such as a composed tool render, a gradient or filter fallback and an SVG illustration walked to pixels. A `zip` carries the mark to the members that qualify. It never marks your own uploaded image, only art Lolly rasterised.

`imprint=1`, or a bare `?imprint`, still works for older links. The CLI marks by default too; its browser-free resvg PNG path embeds the mark itself without moving to the browser tier. A render below the watermark's detection floor is reported and written unmarked.

A credential lives in a metadata container and is lost to any re-save or strip. The imprint survives metadata stripping, recompression down to about JPEG quality 50 and a crop aligned to 8 pixels. TIFF is lossless and keeps the mark exactly. AVIF applies the mark before encoding, but how well the mark survives the AV1 encode is not yet measured. The imprint does not survive an arbitrary resize, and its detector key is public, so it is an integrity hint, not a hardened claim. [Lolly Verify](/#/verify) detects the imprint on the device. For `pdf`, `pdf-cmyk` and `pptx` files it scans the embedded rasters Lolly rendered, not the whole page or slide.
:::

::: details More on durable, meta, _madewith and licence
**`durable`** marks raster exports (`png`, `jpg`/`jpeg`, `webp`, `avif`, `tiff`) with a neural TrustMark-format watermark that carries Lolly's identifier. The "made with Lolly" link then survives a social upload or a re-save, and any TrustMark-aware tool can recover the identifier. It is off by default because the encode is heavy and its model is fetched once. `durable=on` also works. It does nothing when the encoder model is not on the device (`scripts/convert-trustmark-encoder-onnx.py` builds the model), and it does not mark the rasters inside `pdf` or `pptx`. It adds to the imprint and the credential and replaces neither. [Lolly Verify](/#/verify) shows it as a "Lolly durable mark".

**`meta`** covers EPS `%%Creator`, the DXF `999` comment, EXR and Radiance `software`/`SOFTWARE=` and the PDF `Producer`. The text is plain ASCII with no punctuation that could trip an old reader. `meta=off` drops only that text, not the credential or the imprint. A file of your own goes through the on-device transform path (Lolly Strip Hidden Data), which never adds metadata.

**`_madewith`** records the design system, its published version and the colourway in the file's metadata and its Content Credential. The description gives the colourway after the tool: *"Made with https://lolly.tools : Chart (Beach colourway)"*. It matches the export panel's ticked **Design system** card. `_madewith=0` (or `off`) leaves all those fields out and keeps the description plain. On-device utilities never record a design system.

**`licence`** takes one of `CC0-1.0`, `CC-PDM-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `CC-BY-NC-4.0`, `CC-BY-NC-SA-4.0`, `CC-BY-ND-4.0` or `CC-BY-NC-ND-4.0`. Its name and deed link go into EXIF, XMP, RIFF and the Content Credential's rights field, wherever the format has one. Absent, or any other value, means no declaration: all rights reserved. A tool with its own licence input (Claim) keeps that input's value. The choice travels in a share link, because a licence belongs to the document.
:::

<!--i:eti-sun-->
## Colour depth and HDR

| Param | Where | What it does |
|---|---|---|
| `hdr` | web + CLI/MCP | HDR raster export (`png`, `jpg`/`jpeg`, `avif`, `tiff`) in Rec.2100 PQ, so brand colours and white text reach peak brightness on an HDR display. Off by default; `hdr=1` turns it on. [Exporting](/info/exporting.html#hdr-bright-colours) |
| `depth` | web, CLI | Requested bit depth: `8`, `16`, `float` or `auto` (the default). A request, not a promise: Lolly writes deep bits only where the pipeline made them. |

::: details More on hdr
`hdr` re-encodes the pixels with BT.2020 primaries and the SMPTE ST 2084 transfer, and tags the file for a colour-managed viewer: an ICC v4 profile with a `cicp` tag for `jpg` and `tiff`, a `cICP` chunk for `png`, a rewritten `colr` box for `avif`. It changes the pixels, not only the label, so it is off by default. `hdr=on` and `hdr=pq` also turn it on.

A tuned form carries the export panel's four dials in one value: `hdr=<peakNits>-<reach>-<lift>-<focus>`, such as `hdr=1600-60-0-50` (White 1600 nits, Reach 60, Dark lift 0, Focus 50). `hdr=1` means the defaults, `1000-45-0-40`. The boost is gated on OKLab lightness and keeps hue, so darks stay dark and a brand green does not drift towards mint.

`webp` is excluded: it is 8-bit and has no working HDR decode path, so a PQ WebP looks dark. The vector formats and PDF are excluded too. Many platforms re-encode uploads and strip the HDR signal, which can leave the image looking dark.

On the CLI and MCP, `hdr` also makes the float formats possible: `--export=exr` and `--export=hdr` need `--hdr=1`. The terminal render path rasterises to 8-bit sRGB, and the HDR view transform is the only step that makes real range above 1.0. Without that setting, or when a render has nothing to lift, the export refuses and does not pad 8 bits into float.
:::

::: details More on depth
`float` means floating-point samples, as film and VFX formats use. A 16-bit file made from an 8-bit canvas render is only padding, so Lolly writes the 8-bit file. `auto` asks for the deepest the chain supports, so deep output becomes the default as more of the pipeline can make deep output, the same rule gamut follows ([how colour is written](/info/colour-engine.html#writing)).

Formats that are deep by nature (OpenEXR, Radiance `.hdr`) ignore the parameter except for one choice: on the CLI, `depth=float` writes an EXR with 32-bit float samples instead of the default 16-bit half. An HDR PNG is written at 16 bits regardless, because 8-bit PQ bands; `depth=8` there falls back to the older encode. The CLI ignores `depth=16` for `png` or `tiff`, because its render path rasterises to 8-bit sRGB. Invalid values (`depth=32`, `depth=deep`, an empty value) read as `auto` and do not fail the export.
:::

<!--i:eti-palette-->
## Design system, language and emoji

| Param | Where | What it does |
|---|---|---|
| `_themes` | web + CLI (`--themes=`) + `/tool/<id>.<ext>` | The **theme** chosen in each token group of the design system, as JSON: `_themes={"":"dark"}` picks the `dark` theme of a design system whose themes have no group, and `_themes={"":"dark","colourway":"beach"}` also picks a [colourway](/info/colourways.html). A document whose colours are token references then renders in that theme, logos and photo looks included. A choice the design system does not declare draws that group's default theme, with no warning. The public route `/tool/<id>.<ext>` draws only tools it can render without a browser, so it refuses a Lolly Design document in any theme. Render one with `--themes` on the CLI. |
| `ds` | web + CLI | The design system to draw with: the id of one held on the device (`default`, `shipped` or a slug such as `acme-2026`). Never written into a share link. |
| `designv` | web + CLI | The design-system version to draw with: a published version's slug, or `latest` for the edit head. Never written into a share link. |
| `_kit` | web, with Lolly Work | The partner kit a piece carries as a guest, as `<id>@<revision>`: the kit's catalog id and the revision attached, such as `_kit=inst/5b2e@2`. Travels in a share link and never carries the kit's files. Someone the kit is not served to sees the piece without the kit. |
| `lang` | web + CLI | The interface language for this session, as a short code such as `ja` or `ar`. The recipient's saved preference is untouched. |
| `emoji` | web + CLI (`--emoji=`) | The emoji set to draw every emoji from, as `<id>@<version>`, such as `emoji=twemoji/color-starter@17.0.3`. Travels in a share link. |
| `emojifx` | web + CLI (`--emojifx=`) | The brand treatment for that artwork: `original`, `influence:<bps>`, `snap`, `mono` or `duotone`. |
| `emojistyle` | web + CLI (`--emojistyle=`) | An exact `EmojiStyleV1` JSON snapshot. Generated links carry it, and it takes precedence over `emoji` and `emojifx`. |

::: details More on _themes
A tool whose manifest ignores a kind of theme group (`tokenAxes`, see [Tool manifests](/info/tool-manifest.html#colours-that-are-the-content)) renders that group in its canonical option, and the CLI and MCP warn when a link asks for another. On the CLI, `--themes=light,dark` (or `--themes=all`) exports one file per theme, named `<stem>-<theme>.<ext>`, and needs `--output`. Only `--themes` refuses a name the design system does not declare, and lists the ones it does. [Colourways](/info/colourways.html#choose-a-colourway-for-one-piece) covers choosing a colourway in the app.
:::

::: details More on ds and designv
**`ds`** values that fail the id grammar read as absent. `ds=shipped` also brings back a supplied design system you removed, like **Bring back** on its card. An id the device does not hold falls through to the active design system with a warning, so a link never fails to draw. It is never written into a share link: a design system belongs to whoever holds it, and a link must not pin its recipient to one that is not theirs. Pair it with `designv` to choose a published version of that system.

**`designv`** is the highest rung of the resolution ladder. It beats a tool's `designVersion` manifest pin and the active version, and falls through to the next rung when it points at nothing this device has. Authors use it for testing ("check against `latest`, fix, then publish"). It is never written into a share link, because a version belongs to the design system it was published in. On a device that has never published a version, every value resolves to the edit head. The shells differ in one way: the CLI reads the tool's manifest pin as the rung below this parameter, while the web app resolves only this parameter and the active version. A manifest pin does not yet change what a browser draws.
:::

::: details More on lang
The codes are `en` (the default), `es`, `de`, `fr`, `zh` (Simplified), `zh-hant` (Traditional), `ja`, `ko`, `vi`, `pt`, `it`, `nl`, `sv`, `no`, `pl`, `cs`, `ro`, `tr`, `uk`, `bg`, `ms`, `id`, `tl`, `hi`, `bn`, `ur` and `ar`; the `LANGS` set in `engine/src/lang.ts` is the source of truth. Arabic and Urdu render right to left, and the interface mirrors. The informal aliases `cn`, `jp` and `in` (for `id`) are accepted. Without a recognised value, the language comes from the profile, then the preference saved in this browser, then the browser's language, then English. `lang` is the only reserved parameter that changes the interface and not the file, with one exception: a tool that prints its own wording, such as Agenda or Certificate, prints that wording in this language when it holds a translation.
:::

![The Colour Palette controls with every label, hint and dropdown option in Japanese, from one lang param](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Flang%3Dja&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-inputs&css=%23tool-canvas%7Bdisplay%3Anone%7D&dark=1&filename=um-lang-japanese)

::: details More on emoji, emojifx and emojistyle
**`emoji`** draws every emoji in the text from the set's pinned vector artwork, not the machine's emoji font, so the same link draws the same picture everywhere. The full form is `emoji=community/emoji/twemoji/color-starter@17.0.3`. The short form works when its last two segments match one set the device holds, and takes its checksum from the local listing. A glyph the set does not carry, or a set the device does not hold, draws a neutral placeholder, never a system glyph. A device with no sets leaves the characters as the tool wrote them. Unlike `ds` and `designv`, `emoji` travels in a share link, because the emoji a document draws belong to the document.

**`emojifx`**: `influence:<bps>` pulls every colour towards its nearest brand colour, from 1 to 9999 basis points; `snap` takes the nearest brand colour outright; `mono` lays one brand colour's hue over each colour's own lightness; `duotone` ramps between a dark and a light brand colour. Skin tones, flags and custom brand symbols keep their own colours unless you add `,unprotected` (`emojifx=snap,unprotected`). Without `emojistyle`, the palette comes from the brand in force when the link opens. A treatment with no `emoji` set is reported, since there is no artwork to treat. A treatment with no `emoji` set is reported.

**`emojistyle`** includes manifest checksums, ordered fallback sets, the palette and the protection setting, and generated links pin the original palette in the snapshot. Malformed or oversized snapshots are reported. The set's own bytes travel in portable `.lolly` documents, not in links.
:::

<!--i:eti-link-->
## The link itself

| Param | Where | What it does |
|---|---|---|
| `z` | web + CLI | A packed link: the whole readable query, compressed and base64url-encoded. [Packed links](/info/url-mode.html#packed-links-z) |
| `zx` | web + CLI | An encrypted link: the packed state encrypted under a password the link never holds. The CLI takes the password as `--link-password`; a missing or wrong password exits 6 and renders nothing. [Encrypted links](/info/url-mode.html#encrypted-links-zx) |
| `_v` | web + CLI | The tool version the link was made against, such as `1.0.0`. Ignored when it does not match, so a link keeps working. |
| `pkg.*` | web + CLI | Kept for Linux package metadata (`pkg.name`, `pkg.version`, `pkg.dest` and the like). Skipped before input matching, so no tool input can use one. The web app's `rpm` and `tar.gz` export reads these values from its export panel, not from a link. |

The reserved `z` and `zx` are top-level parameters only. A box's `z` depth field and a keyframe track's `z` channel are inside the `boxes` block's per-box fields, a separate namespace read by position, so the names never collide.

::: note Building links in the app
**Share**, in the export panel, offers a ready-to-copy link and a tick box for each on-visit flag: **Open in fullscreen (hide controls)** (`full`), **Open with the export panel expanded** (`options`), **Download automatically when opened** (`export`), **Copy to clipboard on visit** (`copy`, worded **Copy image to clipboard on visit** for an image) and **Pin this tool version** (`_v`). Ticking a box rewrites the link in place. The copy box appears only for PNG, JPG, WebP, AVIF, text, Markdown and HTML. A tool with no export offers **Open as a web page (no controls)** (`nostage`) instead of fullscreen. **Projects → Share link** opens the same dialog for any saved session, rebuilding the link from the saved inputs.
:::
