# Reserved URL parameters

Most of a Lolly link is the design itself: each parameter is one of the tool's inputs. A short list of names is kept back for the app. They choose the file's format and size, what happens when the link opens and what goes into the file's metadata. No tool may use one of these names for an input, so `format=pdf` means the same thing in every tool.

Look a name up below. Each row says where it works, and links to the page that explains it in full where there is one. For worked examples, such as downloading on open, a print-ready PDF or presenting a deck, start with [Links that do something on open](/info/url-export.html).

Some rules hold for every table:

- **Presence flags.** `export`, `copy`, `full`, `iframe`, `options`, `nostage`, `present` and `kiosk` are presence flags. Their value is ignored; what matters is whether the key appears in the link.
- **Reserved namespaces.** Any name that starts with `_` is skipped before input matching, and no tool input or `urlKey` may claim one, so future reserved names come from there and can never collide with a tool's inputs. Parameters that start with `pkg.` are kept for Linux package metadata in the same way.
- **The CLI.** Each name works on the command line as `--name=value`, unless its row says web only. A row marked CLI only has no meaning in a browser.

## What happens on open

| Param | Where | What it does |
|---|---|---|
| `export` | web + CLI | Download the file as soon as the tool finishes rendering. [How to use](/info/url-export.html#download-a-file) |
| `copy` | web only | Get the Copy button ready; the copy runs on your first click, because a browser allows clipboard writes only after a gesture. [How to use](/info/url-export.html#copy-to-the-clipboard) |
| `full` | web only | Open with the sidebar collapsed, so the canvas fills the window. [How to use](/info/url-export.html#open-clean-embed-or-publish) |
| `iframe` | web only | Show only the rendered output, for a tool placed inside another page. Implies `full`, removes every piece of the app's chrome and keeps nothing on the device. [How to use](/info/url-export.html#open-clean-embed-or-publish) |
| `options` | web only | Open with the export settings panel expanded instead of the collapsed Render button. `full` wins if both are set. |
| `nostage` | web only | On a tool that exports: the `html` export fills the whole window, with no centred card. On a tool with no export: open as a plain web page with no controls. [How to use](/info/url-export.html#open-clean-embed-or-publish) |
| `present` | web only | Open a Design document as a fullscreen, click-advanced deck, or start a timed document's playback. [How to use](/info/url-export.html#present-a-deck) |
| `s` | web + CLI | A slide's address in a deck: a 1-based position, a frame id or `2.3` for a build step. With `present` it opens that slide; with an export format it renders that slide alone. |
| `kiosk` | web only | With `present`: wrap at the ends and loop a timed document, for signage. |
| `slot` | web only | Load a saved session by name. Other parameters in the link override the saved values. [How to use](/info/url-export.html#resume-a-saved-session) |
| `template` | web only | Start a fresh session from one of the tool's `templates[]` entries, skipping the **New from template** chooser. |
| `preset` | web only | With `template`: apply one of that template's presets, such as `?template=poster&preset=story`. |

::: details More on iframe, present, s and kiosk
**`iframe`** is for a tool shown inside another page: a Design slide, a docs page, a second screen or a kiosk. It keeps no saved session, no history entry, no sounds and no changes to the address. `export`, `copy`, `options`, `present` and `slot` are ignored when it is set. Which pages may frame the app is set by the deployment.

**`present`** turns a frame document (Design) into a deck: its frames become slides in presentation order (`order`, then `x` to break a tie). A timed document that is not made of frames mounts normally and starts its sequence transport instead. The CLI accepts the flag and does nothing with it, because there is no screen to present on.

**`s`** takes `s=2` as the 1-based position in presentation order. Any other value (`s=slide1`, a ULID) is a frame id, and an `.N` suffix (`s=2.3`) picks a build step. Without `present`, the editor centres that frame when it opens. As a still-export filter, `?s=2&format=png` renders just that slide, which gives every slide an image link, and `lolly design --s=2 --export=png` means the same thing, because both shells resolve the address with the same engine code. Build steps are for the presenter only: a still export always shows every build. Formats that carry the whole deck (`pdf`, `zip`, `pptx`, `html`, `scorm`) and the motion formats, where time picks the frame, are rendered whole, and the CLI reports that it ignored the filter. An address that matches no slide never falls back to slide 1: the web app exports the whole deck and reports the mismatch, and the CLI exits 2 and writes nothing.

**`kiosk`** makes the presenter wrap at the ends and a timed document's transport loop, so `?present&kiosk` is digital signage; pair it with each frame's `dur` for the dwell time. The flag was called `loop` until 2026-08-28. `loop` is an input id in several tools, so the name could not be reserved; old `?present&loop` links no longer loop and need `kiosk` instead.

**`template` and `preset`** read the entry's values inside the app; they are never packed into the link. An unknown or missing template id opens the tool as usual, and an unknown preset applies the template's base values alone. A bare `?template=` opens the chooser itself. The CLI has no chooser, so it ignores both.

**`slot`** is ignored by the CLI, which has no saved-session store.
:::

## The file

| Param | Where | What it does |
|---|---|---|
| `format` | web + CLI | The output format (`png`, `svg`, `pdf`, …). Used by `export` and `copy`. It takes any value in the tool's `render.formats`. [Every format value](/info/url-export.html#download-a-file) lists the values, and [Every format Lolly can open and make](/info/formats.html) says what each format is for. |
| `filename` | web only | Name of the downloaded file, without the extension. Defaults to the tool id. |
| `output` | CLI only | The path to write the file to. Defaults to stdout. |
| `width` / `w` | web + CLI | Output width, as a value in `unit`. Also fills in the export panel. [How to use](/info/url-export.html#set-the-size) |
| `height` / `h` | web + CLI | Output height, as a value in `unit`. Also fills in the export panel. |
| `unit` | web + CLI | The unit for `width` and `height`: `px` (the default), `mm`, `cm`, `in`, `pt` or `pc`. |
| `dpi` | web + CLI | Raster resolution for physical units (default `300`). Ignored for `px` and for vector formats. |
| `password` | web + CLI | An open password for `pdf` and `zip`, standard tier only. It travels in clear text in the link, so it deters casual opening and does not protect confidential material. [Exporting](/info/exporting.html#password-protection) |

::: details Size on a document with several artboards
On a Design document with more than one artboard, the artboards are the size truth. `width` and `height` describe the active artboard: the selected one for still formats, the one under the playhead for animated ones. In the app the export panel mirrors that artboard as it changes, and editing the fields resizes that artboard.

Each format resolves the boards its own way. Still images fan out to one file per artboard at that board's own size, zipped when there is more than one, and `?s=` narrows the set to one board. PDF and PPTX carry every board as a page at its own size. The animated formats composite every scene into a `width` by `height` frame, letterboxing a board whose aspect differs. So on a framed document `w` and `h` never scale the whole set: they are the size of one board, and of the video frame.
:::

::: details More on password
The export panel's strong AES-256 tier, which also covers `pdf-cmyk`, is typed at export and never travels in a link. The CLI applies `password` wherever it can render a PDF. It is ignored when `bleed` or `marks` is on, because an encrypted PDF cannot carry print finishing, and it cannot be combined with `c2pa` on a PDF.
:::

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
Each of `fps`, `seconds`, `wait`, `codec` and `vq` is the URL form of a control in the export panel: the Frame rate select (24, 25, 30, 50 or 60 there; any whole number here), the Duration field, the Start after field, the Codec select and the Quality select, which drives the bitrate ladder. On the CLI, `--fps=60` and the rest are forwarded to the browser tier.

**`seconds`** is carried as `durationUserSet`, so a tool whose hook would stretch the clip (the Audiogram runs to the end of its audio; a Sequence to its timeline) renders exactly this long. It is called `seconds` because `duration` is an input id in several tools (3D, Flythrough, Spatial Photo), and a reserved name must collide with none. `vq` is short for the same reason: `quality` is an input of Convert Image.

**`codec`** left at Auto is AV1 on many machines. Pin `codec=h264` when the file has to play in every browser's `<video>` or on an older phone.

**`sampletimes`** takes 1 to 64 strictly increasing finite times, from zero and before the composition ends. One time returns one still; several return a ZIP or a paged PDF. It cannot be combined with `cuts` above 1. Raster samples use the Sequence compositor for animated sources; unsupported SVG motion and tilted scenes fail with a message rather than a wrong file.

**`motionblur`** works for SDR sRGB Sequence movies and explicit raster samples. Paths it does not support fail with a message.

**`cuts`** at the default `1` keeps the playhead still. PNG, JPG, WebP and SVG sheets return a ZIP; PDF returns one document with a page per still. The CLI and MCP need the browser tier for a contact sheet.
:::

## Print

| Param | Where | What it does |
|---|---|---|
| `bleed` | web + CLI (browser tier) | Bleed for `pdf`, `pdf-cmyk` and `cmyk-tiff`, as a dimension such as `3mm` or `0.125in`. [How to use](/info/url-export.html#print-ready-output) |
| `marks` | web + CLI (browser tier) | Print marks for the same formats, as a list of `crop`, `reg`, `bleed`, `bars` and `prov`. |
| `profile` | web + CLI | The colour profile. For `png` and `jpg`, `srgb` (the default) embeds an sRGB profile and `none` leaves it out. For `pdf-cmyk` and `cmyk-tiff`, the press condition, such as `fogra51`, or `own` to embed a CMYK profile loaded on this device. |

::: details More on profile
For the print formats, a named condition such as `fogra51` is written into the PDF's output intent without profile bytes, because no CMYK ICC profile ships with Lolly, and recorded in the TIFF's provenance. `profile=own` embeds a CMYK profile loaded on the device the link is opened on, which a conformant PDF/X-4 Print PDF needs; [Print-ready output](/info/url-export.html#print-ready-output) covers what else can withhold that claim. `own` resolves only when exactly one such profile is loaded; otherwise it writes no output intent and declares nothing. A profile's digest never travels in a link: which profile is embedded, and so the file's size, is the recipient device's business.
:::

## Provenance and metadata

| Param | Where | What it does |
|---|---|---|
| `c2pa` | web + CLI (on by default) | Content Credentials. `c2pa=off` turns them off for one export; `c2pa=7`, `30`, `90` or `365` sets the certificate lifetime in days. [Content Credentials](/info/content-credentials-identity.html) |
| `imprint` | web + CLI (on by default) | The Lolly Imprint, a pixel watermark on raster art Lolly rendered. `imprint=0` or `imprint=off` turns it off. [Exporting](/info/exporting.html#provenance-watermark) |
| `durable` | web (off by default) | A Durable Content Credential: a TrustMark-format watermark that survives a metadata strip. `durable=1` turns it on. |
| `meta` | web + CLI (on by default) | The plain generator field (`Lolly lolly.tools`) in formats that have one. `meta=off` (or `meta=0`) leaves it out. |
| `_madewith` | web + CLI (`--no-madewith`) + MCP (`madeWith: false`) | The design-system record: which design system, version and colourway drew the file. On by default; `_madewith=0` leaves it out. [Exporting](/info/exporting.html#the-design-system-record) |
| `licence` | web + CLI (`--licence=`) | The licence you declare for your own export, written into the file's licence metadata. |

::: details More on c2pa
A tool opts out with `render.c2pa: false`, and an on-device privacy utility never carries a credential. `c2pa=1`, or a bare `--c2pa` on the CLI, uses the default lifetime of 30 days. In the web app, an enrolled identity's certificate window, fixed at enrolment, takes precedence and the lifetime value is ignored. The CLI signs with an ephemeral certificate only. `--no-provenance` turns off the credential and the imprint together, which is how you get byte-identical output from run to run. On a PDF, `c2pa` cannot be combined with `password`.
:::

::: details More on imprint
The imprint marks raster exports (`png`, `jpg`/`jpeg`, `webp`, `avif` and the RGB `tiff`, not Print TIFF). It also marks raster content Lolly rendered inside a `pdf`, `pdf-cmyk` or `pptx` export, such as a composed tool render, a gradient or filter fallback and an SVG illustration walked to pixels. A `zip` carries it through to whichever members qualify. It never marks your own uploaded image, only art Lolly rasterised.

`imprint=1`, or a bare `?imprint`, is still accepted for older links. The CLI marks by default too, and its browser-free resvg PNG path embeds the mark itself rather than moving to the browser tier. A render below the watermark's detection floor is reported and written unmarked.

A credential lives in a metadata container and is lost to any re-save or strip. The imprint survives metadata stripping, recompression down to about JPEG quality 50 and a crop aligned to 8 pixels, so it complements the credential. TIFF, being lossless, keeps the mark exactly. AVIF applies the mark before encoding, but how well it survives the AV1 encode is not yet measured. It does not survive an arbitrary resize, and its detector key is public, so it is an integrity hint rather than a hardened claim. [Verify](/verify) detects it on the device; for `pdf`, `pdf-cmyk` and `pptx` files it scans the embedded rasters Lolly rendered, not the whole page or slide.
:::

::: details More on durable, meta, _madewith and licence
**`durable`** marks raster exports (`png`, `jpg`/`jpeg`, `webp`, `avif`, `tiff`) with a neural TrustMark-format watermark that carries Lolly's own identifier, so the "made with Lolly" link survives a social upload or a re-save, and any TrustMark-aware tool can recover the identifier. It is off by default because the encode is heavy and its model is fetched once; `durable=on` also works. It does nothing when the encoder model is not on the device (`scripts/convert-trustmark-encoder-onnx.py` builds it), and it does not mark the rasters inside `pdf` or `pptx`. It adds to the imprint and the credential rather than replacing either. [Verify](/verify) shows it as a "Lolly durable mark".

**`meta`** covers EPS `%%Creator`, the DXF `999` comment, EXR and Radiance `software`/`SOFTWARE=` and the PDF `Producer`. The text is plain ASCII with no punctuation an old reader could stumble on. `meta=off` drops only that text, not the credential or the imprint. A file of your own goes through the on-device transform path (Strip Hidden Data), which never adds metadata.

**`_madewith`** records the design system, its published version and the colourway in the file's metadata and its Content Credential, and gives the colourway beside the tool in the description: *"Made with https://lolly.tools : Chart (Beach colourway)"*. It matches the export panel's ticked **Design system** card. `_madewith=0` (or `off`) leaves every one of those fields out and keeps the description plain. On-device utilities never record a design system.

**`licence`** takes one of `CC0-1.0`, `CC-PDM-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `CC-BY-NC-4.0`, `CC-BY-NC-SA-4.0`, `CC-BY-ND-4.0` or `CC-BY-NC-ND-4.0`. Its name and deed link go into EXIF, XMP, RIFF and the Content Credential's rights field, wherever the format carries one. Absent, or any other value, means no declaration: all rights reserved. A tool with its own licence input (Claim) keeps that input's value. It travels in a share link, because a licence belongs to the document.
:::

## Colour depth and HDR

| Param | Where | What it does |
|---|---|---|
| `hdr` | web + CLI/MCP | HDR raster export (`png`, `jpg`/`jpeg`, `avif`, `tiff`) in Rec.2100 PQ, so brand colours and white text reach peak brightness on an HDR display. Off by default; `hdr=1` turns it on. [Exporting](/info/exporting.html#hdr-bright-colours) |
| `depth` | web, CLI | Requested bit depth: `8`, `16`, `float` or `auto` (the default). A request, not a promise: Lolly writes deep bits only where the pipeline made them. |

::: details More on hdr
`hdr` re-encodes the pixels with BT.2020 primaries and the SMPTE ST 2084 transfer, and tags the file so a colour-managed viewer reads it that way: an ICC v4 profile with a `cicp` tag for `jpg` and `tiff`, a `cICP` chunk for `png`, a rewritten `colr` box for `avif`. It changes the pixels rather than labelling them, so it is off by default; `hdr=on` and `hdr=pq` also turn it on.

A tuned form carries the export panel's four dials in one value: `hdr=<peakNits>-<reach>-<lift>-<focus>`, such as `hdr=1600-60-0-50` (White 1600 nits, Reach 60, Dark lift 0, Focus 50). `hdr=1` means the defaults, `1000-45-0-40`. The boost is gated on OKLab lightness and keeps hue, so darks stay dark and a brand green does not drift towards mint.

`webp` is excluded, because it is 8-bit and has no working HDR decode path: a PQ WebP looks dark. So are the vector formats and PDF. Many platforms re-encode uploads and strip the HDR signal, which can leave the image looking dark.

On the CLI and MCP, `hdr` is also what makes the float formats possible. `--export=exr` and `--export=hdr` need `--hdr=1`, because the terminal render path rasterises to 8-bit sRGB and the HDR view transform is the only step that makes real range above 1.0. Without it, or when a render has nothing to lift, the export refuses rather than padding 8 bits into float.
:::

::: details More on depth
`float` means floating-point samples, the depth film and VFX formats use. A 16-bit file made from an 8-bit canvas render is padding, so Lolly writes the 8-bit file instead of a bigger one with no more picture. `auto` asks for the deepest the chain supports, so deep output becomes the default as more of the pipeline can make it, the same rule gamut follows ([how colour is written](/info/colour-engine.html#writing)).

Formats that are deep by nature (OpenEXR, Radiance `.hdr`) ignore the parameter except for one choice: on the CLI, `depth=float` writes an EXR with 32-bit float samples instead of the default 16-bit half. An HDR PNG is written at 16 bits regardless, because 8-bit PQ bands; `depth=8` there falls back to the older encode. The CLI does not honour `depth=16` for `png` or `tiff`: its render path rasterises to 8-bit sRGB, so the request is ignored. Invalid values (`depth=32`, `depth=deep`, an empty value) read as `auto` rather than failing the export.
:::

## Design system, language and emoji

| Param | Where | What it does |
|---|---|---|
| `_themes` | web + CLI (`--themes=`) + `/tool/<id>.<ext>` | The **theme** chosen in each token group of the design system, as JSON: `_themes={"":"dark"}` picks the `dark` theme of a design system whose themes have no group, and `_themes={"":"dark","colourway":"beach"}` also picks a [colourway](/info/colourways.html). A document whose colours are token references then renders in that theme, logos and photo looks included. A choice the design system does not declare draws that group's default theme, with no warning. The public route `/tool/<id>.<ext>` draws only the tools it can render without a browser, so it refuses a Design document in any theme: render one with `--themes` on the CLI. |
| `ds` | web + CLI | The design system to draw with: the id of one held on the device (`default`, `shipped` or a slug such as `acme-2026`). Never written into a share link. |
| `designv` | web + CLI | The design-system version to draw with: a published version's slug, or `latest` for the edit head. Never written into a share link. |
| `lang` | web + CLI | The interface language for this session, as a short code such as `ja` or `ar`. The recipient's saved preference is untouched. |
| `emoji` | web + CLI (`--emoji=`) | The emoji set to draw every emoji from, as `<id>@<version>`, such as `emoji=twemoji/color-starter@17.0.3`. Travels in a share link. |
| `emojifx` | web + CLI (`--emojifx=`) | The brand treatment for that artwork: `original`, `influence:<bps>`, `snap`, `mono` or `duotone`. |
| `emojistyle` | web + CLI (`--emojistyle=`) | An exact `EmojiStyleV1` JSON snapshot. Generated links carry it, and it takes precedence over `emoji` and `emojifx`. |

::: details More on _themes
A tool whose manifest ignores a kind of theme group (`tokenAxes`, see [Tool manifests](/info/tool-manifest.html#colours-that-are-the-content)) renders that group in its canonical option, and the CLI and MCP warn when a link asks for another. On the CLI, `--themes=light,dark` (or `--themes=all`) exports one file per theme, named `<stem>-<theme>.<ext>`, and needs `--output`. Only `--themes` refuses a name the design system does not declare, and lists the ones it does. [Colourways](/info/colourways.html#choose-a-colourway-for-one-piece) covers choosing a colourway in the app.
:::

::: details More on ds and designv
**`ds`** values that fail the id grammar read as absent. An id for a system the device does not hold falls through to the active one with a warning, so a link never fails to draw. It is never written into a share link: a design system belongs to whoever holds it, and a link must not pin its recipient to one that is not theirs. Pair it with `designv` to choose a published version of that system.

**`designv`** is the highest rung of the resolution ladder. It beats a tool's `designVersion` manifest pin and the active version, and it falls through to the next rung when it points at nothing this device has. It is a testing lever for authors ("check against `latest`, fix, then publish"). It is never written into a share link, because a version belongs to the design system it was published in. On a device that has never published a version, every value resolves to the edit head. The shells differ in one way today: the CLI reads the pin from the tool's manifest as the rung below this parameter, while the web app resolves this parameter and the active version only, so a manifest pin does not change what a browser draws yet.
:::

::: details More on lang
The codes are `en` (the default), `es`, `de`, `fr`, `zh` (Simplified), `zh-hant` (Traditional), `ja`, `ko`, `vi`, `pt`, `it`, `nl`, `sv`, `no`, `pl`, `cs`, `ro`, `tr`, `uk`, `bg`, `ms`, `id`, `tl`, `hi`, `bn`, `ur` and `ar`; the `LANGS` set in `engine/src/lang.ts` is the source of truth. Arabic and Urdu render right to left, and the whole interface mirrors. The informal aliases `cn`, `jp` and `in` (for `id`) are accepted. Without a recognised value, the language comes from the profile, then the preference saved in this browser, then the browser's language, then English. `lang` is the one reserved parameter that changes the interface rather than the file.
:::

![The Colour Palette controls with every label, hint and dropdown option in Japanese, from one lang param](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Flang%3Dja&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-inputs&css=%23tool-canvas%7Bdisplay%3Anone%7D&dark=1&filename=um-lang-japanese)

::: details More on emoji, emojifx and emojistyle
**`emoji`** draws every emoji in the text from the set's pinned vector artwork rather than whatever emoji font the machine has, so the same link draws the same picture everywhere. The full form is `emoji=community/emoji/twemoji/color-starter@17.0.3`; the short form works when its last two segments match one set the device holds, and resolves its checksum from the local listing. A glyph the set does not carry, or a set the device does not hold, draws a neutral placeholder rather than a system glyph. A device with no sets at all leaves the characters as the tool wrote them. Unlike `ds` and `designv`, `emoji` travels in a share link, because the emoji a document draws belong to the document.

**`emojifx`**: `influence:<bps>` pulls every colour towards its nearest brand colour, from 1 to 9999 basis points; `snap` takes the nearest brand colour outright; `mono` lays one brand colour's hue over each colour's own lightness; `duotone` ramps between a dark and a light brand colour. Skin tones, flags and custom brand symbols keep their own colours unless you add `,unprotected` (`emojifx=snap,unprotected`). Without `emojistyle`, the palette comes from the brand in force when the link opens. A treatment with no `emoji` set is reported, since there is no artwork to treat.

**`emojistyle`** includes manifest checksums, ordered fallback sets, the palette and the protection setting, and generated links pin the original palette in the snapshot. Malformed or oversized snapshots are reported. The set's own bytes travel in portable `.lolly` documents, not in links.
:::

## The link itself

| Param | Where | What it does |
|---|---|---|
| `z` | web + CLI | A packed link: the whole readable query, compressed and base64url-encoded. [Packed links](/info/url-mode.html#packed-links-z) |
| `zx` | web only | An encrypted link: the packed state encrypted under a password the link never holds. [Encrypted links](/info/url-mode.html#encrypted-links-zx) |
| `_v` | web + CLI | The tool version the link was made against, such as `1.0.0`. Ignored when it does not match, so a link keeps working. |
| `pkg.*` | web + CLI | Kept for Linux package metadata (`pkg.name`, `pkg.version`, `pkg.dest` and the like). Skipped before input matching, so no tool input can use one. The web app's `rpm` and `tar.gz` export reads these values from its export panel, not from a link. |

The reserved `z` and `zx` are top-level parameters only. A box's own `z` depth field and a keyframe track's `z` channel live inside the `boxes` block's per-box fields, a separate namespace read by position, so the names never collide.

::: note Building links in the app
You rarely need to write these by hand. **Share**, in the export panel, offers a ready-to-copy link and a tick box for each on-visit flag: **Open in fullscreen (hide controls)** (`full`), **Open with the export panel expanded** (`options`), **Download automatically when opened** (`export`), **Copy to clipboard on visit** (`copy`, worded **Copy image to clipboard on visit** for an image) and **Pin this tool version** (`_v`). Ticking a box rewrites the link in place. The copy box appears only for PNG, JPG, WebP, AVIF, text, Markdown and HTML. A tool with no export offers **Open as a web page (no controls)** (`nostage`) instead of fullscreen. **Projects → Share link** opens the same dialog for any saved session, rebuilding the link from the saved inputs.
:::
