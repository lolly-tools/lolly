# Host API (HostV1)

The **capability bridge** is the versioned contract between a tool and whatever shell it runs in (web PWA, Tauri desktop/mobile, CLI and the interactive TUI). Tools call `host.*`. Each shell implements the same surface its own way. This is what lets one tool run unchanged everywhere. (The TUI reuses the CLI's bridge implementation, so anything true of the CLI here applies to it too.)

Tools receive `host` inside their **hooks** (`hooks.js`). They never touch the DOM outside their template, never `fetch` directly, never read storage directly - they go through `host`. See [Authoring Tools](/info/authoring-tools.html) for the tool anatomy and [Overview](/info/overview.html) for the bigger picture. The canonical public entry point is `packages/core/src/host-v1.ts`, a stable barrel over capability-sized declarations in `packages/core/src/host-v1/`; the API snapshot rejects accidental signature drift. It is the tool-author SDK `@lolly-tools/core`, so a third party can build against the contract without depending on the engine. `engine/src/bridge/host-v1.ts` is a type re-export of it. That SDK is published on npm - `npm i -D @lolly-tools/core` - and installs the `HostV1` types, `validateTool` and `createMockHost`, so you can type-check and test a tool with no clone of this repository ([package page](https://www.npmjs.com/package/@lolly-tools/core)).

```js
function onInit({ model, host }) {
  host.log('info', 'tool booting', { shell: host.shell });
  // ... call host.profile / assets / state / clipboard / export / net / text
}
```

## Rules of the contract

- **Additive only.** Methods may be added in a minor version; never removed or signature-changed without a major bump. When v2 ships, v1 keeps working.
- **No platform-specific methods.** If only one shell can do something, it sits behind a `capabilities` flag in `tool.json` and shells that can't fulfil it expose a stub/error.
- **Capabilities gate access.** `net` (`network`), `capture` (`capture`), `compose` (`compose`) and `recorder` (`microphone` / `camera` / `screen`) require a matching flag in the manifest's `capabilities`. `tokens`, `text`, `pdf`, `pptx`, `media`, `audio`, `codec`, `layers`, `speech`, `upscale`, `matte`, `viz`, `color`, `images`, `raster`, `geom`, `connectors` and `c2pa` are optional and present only when the shell provides them (feature-detect, don't flag). Declare what you need.
- `host.version` is `'1'`; `host.shell` is one of `web` · `tauri-desktop` · `tauri-mobile` · `cli`.

## `host.profile`

User details. Tools read; the user manages them via the host UI.

| Method | Returns | Notes |
|---|---|---|
| `get()` | `Promise<Profile>` | Current profile |
| `subscribe(fn)` | `() => void` | Calls `fn(profile)` on change; returns an unsubscribe |

`Profile`: `firstname, lastname, email, phone, title, city, country, lang, headshot (AssetRef), useDetails, custom, featureFlags`, plus per-user UI overlays (`favourites`, `favouriteAssets`, `assetCategories`, `hiddenAssets`) (`featureFlags` is the user's local UI flag map, default ON - not a tool concern; `useDetails` is the opt-in that gates embedding author/contact details into export provenance). Most tools don't call this directly - declare `bindToProfile: "firstname"` on an input and the host pre-fills it for you.

## `host.assets`

The bridge to the catalog and the user's local images.

| Method | Returns | Notes |
|---|---|---|
| `get(id, opts?)` | `Promise<AssetRef>` | Resolve one asset (`opts.format`, `opts.version`); throws if missing |
| `query(filter)` | `Promise<AssetRef[]>` | Search the catalog |
| `pick(opts)` | `Promise<AssetRef \| null>` | Open the host's picker UI; `null` if cancelled |
| `isAvailable(id)` | `Promise<boolean>` | Is it cached/usable offline right now |

`AssetQuery` / `AssetPickerOpts`: `type` (`vector`·`raster`·`video`·`audio`·`lottie`·`palette`·`tokens`·`font`), `namespace` (e.g. `suse/logo`), `tags` (AND), `includeDeprecated`; picker adds `title`, `allowUpload`, `current`. For an `asset`-typed input the host generates the picker from your manifest declaration - you usually don't call `pick()` yourself.

`AssetRef`: `{ source: 'library'|'user'|'remote', id, type, format, url, width?, height?, version?, checksum?, meta? }`. Use `url` in your template via the `asset` helper (`{{asset logo}}`).

## `host.state`

Per-tool persistent state (IndexedDB on web, filesystem on Tauri, memory on CLI). **Never use `localStorage`.**

| Method | Returns |
|---|---|
| `save(slot, data)` | `Promise<void>` |
| `load(slot)` | `Promise<object \| null>` |
| `list()` | `Promise<StateEntry[]>` |
| `delete(slot)` | `Promise<void>` |

`StateEntry`: `{ slot, toolId, toolVersion, updatedAt, label? }`. The host already saves/loads user sessions; reach for this only for tool-managed state.

## `host.clipboard`

| Method | Returns | Notes |
|---|---|---|
| `writeText(text)` | `Promise<void>` | |
| `writeImage(blob)` | `Promise<{ method: 'clipboard' \| 'download' }>` | Falls back to a download where image-clipboard isn't supported |

## `host.export`

The host owns the renderer - tools don't bundle their own.

| Method | Returns | Notes |
|---|---|---|
| `render(node, format, opts?)` | `Promise<Blob>` | Rasterise/serialize a DOM node |
| `download(blob, filename)` | `Promise<void>` | Trigger a download (throws on CLI - pipe via `--output` instead) |
| `file(blob, opts?)` | `Promise<void>` | Deliver a blob the **tool** produced (the transform path: file in → transformed file out), with `opts.filename`. Carries no watermark and no provenance - for on-device utilities whose `exportFile` hook returns the bytes |

`format` is an `ExportFormat` - the render formats are `png · jpg/jpeg · webp · avif · svg · svg-anim · emf · eps · eps-cmyk · dxf · pdf · pdf-cmyk · cmyk-tiff · tiff · pptx · html · ico · zip · webm · mp4 · gif · apng · webp-anim` (availability is per-tool via the manifest, and per-browser for the recorded video formats `webm`/`mp4` - Safari records mp4, Firefox webm; `gif`/`apng`/`webp-anim` are encoded in-engine, `svg-anim` is a self-contained vector flipbook, `dxf` is an AutoCAD cut file, `pptx` decomposes each page into native PowerPoint shapes, `tiff` is a plain RGB raster, `cmyk-tiff` its print sibling and `ico`/`zip` are icon/bundle outputs). Separately, tools produce the **text/data formats** `md · txt · json · csv · css · scss · gpl · ics · vcf` from the input model (not a DOM render - see [Exporting & Formats](/info/exporting.html)), plus the document (`docx` · `odt`), audio (`wav` · `mp3` · `m4a` · `opus`), float (`exr` · `hdr`) and font (`ttf` · `otf` · `woff`) outputs. The `render.formats` enum in `schemas/tool.schema.json` is the authority on the whole set - the catalog validator enforces it, and [URL Mode](/info/url-mode.html) says what each id produces. *(The `ExportFormat` union in `engine/src/bridge/host-v1.ts` is itself stale - it omits most of the raster/bundle formats - and is being reconciled with the schema. Track the schema, not the type.)*

`ExportOpts`:

| Field | Meaning |
|---|---|
| `width` / `height` | `number` = CSS px; `string` may carry a unit (`"210mm"`, `"8.5in"`, `"595pt"`) |
| `dpi` | Raster DPI for physical units (default 300; px → 96) |
| `scale` | Raster multiplier when width/height absent (1, 2, 3) |
| `quality` | JPG quality 0–1 |
| `background` | Override transparency |
| `watermark` | Forced `true` for experimental tools by the host (never for on-device utilities) |
| `meta` / `embedMeta` | Provenance metadata (auto-assembled; set `embedMeta:false` to skip - on-device utilities skip it automatically) |
| `colorProfile` | ICC handling: `'srgb'` (default raster), `'none'` to skip embedding or a CMYK press condition for `pdf-cmyk` |
| `filename` | Suggested output filename |
| `thumbnail` | Hint that this is a low-fidelity preview, not the deliverable (skips provenance) |
| `depth` | Requested bits per channel: `8`, `16`, `'float'` or `'auto'` (the default). A **request, not a promise** - depth follows provenance, so a deep container is never padded over an 8-bit render; an unsupported request degrades to what the source honestly carries |
| `audio` | `{ id?, url, fadeIn?, fadeOut?, volume?, duck?, start? }` - optional music bed for `webm`/`mp4`: decoded via Web Audio, muxed into the recording, plays for the clip duration and loops when the clip outlasts the track. `fadeIn`/`fadeOut` are seconds of linear gain ramp, `volume` is `0..1`, `duck` is the level the bed drops to while foreground audio plays and `start` is the bed's in-point in seconds (clamped into the source). Web shell; degrades to silent + log warning where unsupported |
| `ingredients` | Content Credentials to carry forward from placed source assets, so the export's provenance chain names what it was built from. Opaque to the shell; ignored when the export isn't C2PA-stamped |
| `c2paInputs` | A compact digest of the tool's scalar inputs (id → short string) that produced this render, recorded under `inputs` in the `tools.lolly.export` assertion |
| `c2paCapture` | `{ camera?, microphone? }` - set by the runtime when the essence came from a device sensor (a live camera frame, a recorder take), so the created step declares a real-world origin |
| `c2paTextAdded` | `{ sample? }` - set only when rendered text sits over an *opened* credentialed asset, which is a genuine "Added text" edit step. From-scratch text is content, not an edit, and rides in `c2paInputs` instead |
| `c2paAiUpscale` | `{ model, version }` - set when the essence is an on-device AI-upscaled asset, so the credential names the model that enlarged it |

See [Exporting & Formats](/info/exporting.html) for the user-facing view, and `engine/src/units.ts` for the unit math.

## `host` - file inputs

A `file`-typed input (the user's own file, picked into memory) arrives as an **`InputFile`**: `{ __file: true, name, mime, size, bytes (Uint8Array), url }`. The hook reads `bytes` directly - there's no `host.*` call, because the bytes ride in the input value (by design: the portable `host.*` surface has no file-read API, so the same hook runs on every shell). A `file` value never serialises to a URL and is never persisted. The `exportFile` hook transforms those bytes and returns `{ bytes, mime, filename }`, which the shell delivers via `host.export.file`. See [Authoring Tools](/info/authoring-tools.html) for the full pattern; `strip-data` is the reference.

## `host.net` *(capability: `network`)*

`fetch(url, init?) → Promise<Response>` - allowlisted fetch. Absent unless the tool declared `"network"`. Tools without it have **no supported network path** - though remember hooks are a portability contract, not a sandbox (see [Authoring Tools](/info/authoring-tools.html)), so "can't" here means "review failure", not "physically impossible" until Worker isolation ships.

## `host.text` *(text-to-path)*

Shape and outline a text run into an SVG path via HarfBuzz (correct kerning, ligatures, GPOS/GSUB). Optional and feature-detected, but **DOM-free** - the web PWA, the CLI and the TUI all provide it (in the Node shells fonts resolve off disk).

| Method | Returns |
|---|---|
| `toPath({ text, fontUrl, fontSize, features?, letterSpacing?, variations?, fallbackFonts? })` | `Promise<TextPathResult>` |
| `preload(fontUrl)` | `Promise<void>` |
| `axisDefaults(fontUrl)` *(optional, v1.30)* | `Promise<Record<string, number>>` |
| `fontUrl(family, opts?)` *(optional, v1.60)* | `Promise<{ url, variations? } \| null>` - resolve a family the host knows (brand statics, user fonts, on-device Google Fonts, the platform face) to a fetchable file for `toPath()`; `null` when none matches, so keep a `<text>` fallback |

`TextPathResult`: `{ d, advanceWidth, bbox, notdef? }` - baseline at `y=0`, Y-down; `bbox` is `null` for whitespace-only runs. The `brand-lockup` tool uses this to outline display type for crisp vector export.

`features` are OpenType tags (e.g. `['liga=0', 'salt=1']`) handed straight to HarfBuzz, so ligature and stylistic-alternate toggles bake into the outlined path (engine v1.12). `letterSpacing` (px, v1.12) adds uniform tracking to the pen advance, so letter-spaced type stays vector in SVG/PDF/EMF instead of falling back to a live `<text>` element.

**Variable fonts and fallback (v1.29–1.30).**

- `variations` - OpenType axis settings as HarfBuzz strings (`['wght=700']`). Without them a variable face shapes at its *default instance*, so a bold run would outline as regular. Unlisted axes take their default.
- `fallbackFonts` - an ordered `[{ fontUrl, variations? }]` chain for characters `fontUrl` has no glyph for, the job the browser's own fallback does. It's needed because webfont families arrive as **disjoint subsets** (Google Fonts' `latin` file has no `Ł`; its `latin-ext` file has no ASCII), so one face can't outline `"Łódź"`.
- `notdef` - how many glyphs fell back to `.notdef` (no glyph anywhere in the chain). Outlining draws blanks/tofu, so if this is non-zero keep a live `<text>` fallback. Absent on older hosts - treat as `0`.
- `axisDefaults(fontUrl)` - the font's default axis values (`{ wght: 400 }`, `{}` for a static font). A caller that embeds the raw file into a renderer with no axis control (jsPDF) gets exactly this instance, so it needs the defaults to know the weight it will actually get. Feature-detect it.

## `host.tokens` *(optional)*

Design tokens (DTCG) for the active theme. The host UI sources colour-picker swatches from these, and the runtime resolves token-referenced input values against them.

| Method | Returns | Notes |
|---|---|---|
| `get(opts?)` | `Promise<TokenSet>` | Resolved token set for the active (or `opts.theme`) theme |
| `colors(opts?)` | `Promise<ColorSwatch[]>` | Colour tokens as picker-ready swatches |
| `resolve(ref, opts?)` | `Promise<unknown>` | Resolve a `{dotted.path}` alias (or bare path) to a concrete value |
| `themes()` | `Promise<{ name, group }[]>` | Theme names declared in the document |

Optional and additive - a shell without it just doesn't offer token-driven UI.

## `host.pdf` *(optional)*

On-device PDF inspection, metadata removal and compression (pure pdf-lib for the metadata + structural work, so it runs even in the lean CLI; image recompression uses a browser canvas). Used by `strip-data` and `compress-pdf`.

| Method | Returns | Notes |
|---|---|---|
| `analyze(bytes)` | `Promise<{ findings }>` | Report the Info-dictionary + XMP metadata a PDF carries; read-only |
| `strip(bytes)` | `Promise<{ bytes }>` | Re-save with that metadata removed (re-serialised - not byte-identical, and any signature is invalidated) |
| `compress(bytes, opts?)` | `Promise<{ bytes, before, after, images }>` | Re-save smaller: recompress oversized embedded JPEGs (canvas downsample + re-encode) and re-serialise with object streams. `opts.level` is `'light' \| 'balanced' \| 'strong'`; `opts.grayscale` drops colour. Text/vectors are untouched, and the result is never larger than the input. The lean CLI (no canvas) does the structural pass only |

Feature-detect each method (e.g. `host.pdf?.compress`) - an older shell may provide `analyze`/`strip` but not `compress`, or no `host.pdf` at all.

## `host.pptx` *(optional)*

On-device PowerPoint inspection and surgical rebranding (engine `1.58`; the shell unzips with fflate and injects its `DOMParser` - the engine's OOXML reader/patcher stays zip- and DOM-free). Used by `rebrand-deck`.

| Method | Returns | Notes |
|---|---|---|
| `inspect(bytes, opts?)` | `Promise<{ ok, slideCount, theme, colors, fonts, themeSuggestion? }>` | Read a deck: slide count, theme palette + fonts and the literal (non-theme-linked) colours and typefaces found on slides. Pass brand `swatches`/`fonts` in `opts` to get nearest-brand suggestions per colour/font plus a suggested 12-slot theme. Never throws - unreadable input reports `ok: false`. All colours are `#RRGGBB` |
| `rebrand(bytes, plan?)` | `Promise<{ bytes, report }>` | Surgically re-theme the deck: swap the theme palette and fonts, remap hardcoded colours (`plan.colorMap`) and explicit typefaces (`plan.fontMap`), optionally strip embedded fonts. Everything else - charts, SmartArt, animations, media - passes through byte-identical. Throws on non-pptx input |

Feature-detect (`host.pptx?.rebrand`) - an older shell may lack it entirely.

## `host.images` *(image convert - optional, v1.60)*

On-device decode / resize / re-encode: the "HEIC to JPEG, compress to WebP, downscale" shape as a first-class API rather than upload-pipeline plumbing. DOM-free - encoded bytes (or a Blob) in, encoded bytes plus dimensions out - so the shell owns the codec and the engine never sees a canvas or an `<img>`. Not a gated capability; feature-detect `host.images` and degrade where it's absent. Everything runs locally; the bytes are never uploaded.

| Method | Returns | Notes |
|---|---|---|
| `decode(input)` | `Promise<ImageInfo>` | Pixel dimensions (EXIF-**oriented**) and a MIME type sniffed from the bytes, never from a filename. Rejects on bytes this shell can't decode |
| `resize(input, opts)` | `Promise<ImageResult>` | Downscale, aspect preserved - it **never upscales**. `maxEdge` caps the longest edge; explicit `width`/`height` fit within that box |
| `encode(input, opts)` | `Promise<ImageResult>` | Re-encode at full oriented size. `format` is `webp` · `jpeg` · `png` - deliberately narrower than what it can *read* |

An animated source flattens to its first frame. Read the *result's* `mime`/`width`/`height` rather than assuming the request was honoured - a shell may fall back (PNG where WebP encoding is unsupported).

## `host.raster` *(pixel work in a hook - optional, v1.105)*

The sibling of `host.images` for tools that composite, sample or mutate pixels *themselves* (Darkroom, the Filter tool, the logo composers, Redact). Where `images` is the convert path - encoded bytes in, encoded bytes out, no pixel access - this hands back drawable pixels. Not a gated capability; feature-detect `host.raster` and degrade to the existing placeholder where it is absent. The headless CLI provides it when the optional Skia canvas (`@napi-rs/canvas`) resolves, which is what makes `lolly redact` repaint pixels locally; on a lean install without it the member stays undefined, as it always did.

| Method | Returns | Notes |
|---|---|---|
| `canRaster()` | `boolean` | Realm-correct, **synchronous** capability probe. The honest replacement for a hand-rolled `typeof document === 'undefined'`, which reports false inside a Worker where rastering works fine |
| `measure(src)` | `Promise<ImageInfo>` | Oriented dimensions + sniffed MIME, the same shape `images.decode` returns |
| `decode(src)` | `Promise<ImageBitmap>` | A drawable bitmap - EXIF baked in, HEIC/AVIF via the shell's fallback, SVG via its reliable path, all behind a decode-bomb guard. Valid on a main-thread `<canvas>` **and** a Worker `OffscreenCanvas`, unlike an `<img>`. Call `.close()` when done |
| `encode(source, opts)` | `Promise<ImageResult>` | Finished pixels to bytes. Takes an `ImageBitmap` (the cheap path - you only composited) or a `RasterFrame` of raw RGBA (you pulled pixels to do your own maths; a live `MediaFrame` passes straight through) |

`src` is a URL (including `blob:`/`data:`), an `AssetRef` or raw bytes / a Blob. Building and drawing *into* a canvas is deliberately not here - `new OffscreenCanvas(w, h)` is a realm global a hook constructs directly, so an RPC round trip would buy nothing.

## `host.capture` *(capability: `capture`)*

Rasterise a live URL to an image using a real browser engine. Only shells with an authoritative engine fulfil it (Tauri's webview, a headless-Chromium CLI or the browser extension) - the plain web PWA cannot read cross-origin pixels, so it exposes a stub that throws.

| Method | Returns |
|---|---|
| `page(spec)` | `Promise<AssetRef>` |
| `vector(spec)` *(optional, v1.45)* | `Promise<AssetRef>` |

`CaptureSpec`: `{ url, width, height?, scrollDepth?, rangeTo?, waitMs?, dpr?, css?, crop? }`. `page()` returns a raster `AssetRef` (`source: 'remote'`) that flows through the normal export path. `url-shot` uses it. Slow and side-effectful - call from an explicit action, not on every keystroke.

Windowing and vector capture (v1.45):

- `scrollDepth` frames a region (0..1 fraction of scroll height, or a px offset when > 1); `rangeTo` extends the shot *down* the page to that scroll position, producing a tall strip - the frame a scroll animation pans over. `crop` trims insets (each a `0..0.9` fraction). The returned ref's `width`/`height` are the **actual captured box** after crop/extension, so size your composite from the *result*, never the request. Hosts may also report `meta.pageWidth`/`pageHeight`/`scrollYPx` (treat as optional).
- `vector(spec)` prints the URL to a **true vector** SVG `AssetRef` (`type: 'vector'`) - geometry, not pixels: crisp at any zoom and re-editable, at the cost of pixel-perfection (webfonts resolve by family name). Same windowing as `page()`. Feature-detect `host.capture.vector` and fall back to `page()` where absent.

## `host.compose` *(capability: `compose`)*

Render another tool's output to an embeddable asset - **tool composition** ("nested exports"). The runtime resolves a manifest's `composes` entries through this and exposes each as `{{asset <id>}}`, so you rarely call it directly.

| Method | Returns |
|---|---|
| `render(spec)` | `Promise<AssetRef>` |
| `renderUrl(url, opts?)` | `Promise<AssetRef \| null>` |

`ComposeSpec`: `{ toolId, inputs, format?, width?, height?, unit?, dpi?, transient?, settleMs? }` (`width`/`height` are in `unit` - `px` default, or `mm`/`cm`/`in`/`pt`). The last two arrived in **v1.5**: `transient: true` skips the host's render cache entirely for a one-shot bake (a design import turning 30-odd scenes into stored assets), which means the *caller* owns the returned `url` and must release it once the bytes are copied; `settleMs` shortens the post-mount wait before the child is captured, for a child you know carries no images, Lottie or video to decode (advisory - a host may clamp or ignore it). Returns an `AssetRef` whose `url` is a `blob:`/`data:` URL, so the embedded render behaves like any other asset: an **SVG** child stays a true vector through the parent's SVG and PDF exports (and rasterises crisply for PNG), while **raster** children (`png`/`jpg`/`webp`) embed as images. SVG is the only format used declaratively today - `event-name-badge` composes `qr-code` as `svg`. The child render is depth- and cycle-guarded and is never watermarked or provenance-stamped (it's an intermediate). Optional: a shell that can't render a child to bytes (e.g. the no-raster CLI for a raster child) just doesn't provide it, and composition degrades gracefully. See [Authoring Tools](/info/authoring-tools.html) for the `composes` manifest shape.

`renderUrl(url, opts?)` is the **end-user** counterpart to `render` - added in **engine v1.3**, so feature-detect `host.compose?.renderUrl`. When a user pastes a Lolly tool *link* (embed URL, hash share route or pretty path) into an asset picker, the host parses it manifest-aware - typed inputs coerce exactly as [URL mode](/info/url-mode.html) would - renders that tool and returns an `AssetRef` whose `id` is the **canonical embed URL** (`https://lolly.tools/tool/<id>.<ext>?…`). That id *is* the asset's persistent identity: it round-trips through URL mode and saved sessions, and the runtime feeds it back here to re-render on load - so a tool-sourced image survives reload and travels inside a shared link, like a library asset id. `ComposeUrlOpts` (`format` · `width` · `height` · `unit` · `dpi`) overrides take precedence over anything parsed from the URL and are folded into the returned id. Like `render`, the child is never watermarked or provenance-stamped. Returns `null` when the URL isn't a recognised tool URL or the tool can't render (the caller leaves the slot empty) - a pasted link can only render a tool that already ships in this build.

## `host.media` *(live camera - optional, v1.4)*

A live camera frame source for **motion-reactive** tools - a tool can react to a webcam stream frame by frame (e.g. a filter that responds to movement). Optional and additive (engine **v1.4**); feature-detect `host.media?.isAvailable()`. **Not** a gated capability - it's pure progressive enhancement: a tool offers a "live" affordance only where a camera exists and runs as an ordinary still-image tool everywhere else, so do **not** list `camera` in the manifest's `capabilities`.

| Method | Returns |
|---|---|
| `isAvailable()` | `boolean` - a camera is usable right now (a secure context) |
| `start()` | `Promise<void>` - begin the camera (prompts for permission); reference-counted |
| `stop()` | `void` - release one `start()`; the camera stops at the last release |
| `subscribe(cb)` | `() => void` - receive frames; returns an unsubscribe function |

A **`MediaFrame`** is `{ width, height, data: Uint8ClampedArray (RGBA), t }` - plain pixels, no DOM types, so the engine stays platform-agnostic (the shell owns the `MediaStream` / `<video>` / grab loop, mirroring `capture`). `data` is valid only for the synchronous duration of the callback, so read it synchronously; frames are downscaled + throttled and pause while the document is hidden.

You rarely call `subscribe` yourself. A tool declares an **`onFrame`** hook and the runtime drives it once per camera frame - it owns the start → subscribe → `onFrame` → re-render loop and **drops overlapping frames** so a slow per-frame render self-throttles. The shell shows a "Go live" toggle that calls `runtime.startLive()` / `runtime.stopLive()` (released on unmount, so no camera outlives the tool). See [Authoring Tools](/info/authoring-tools.html) for the `onFrame` pattern; the four `filter-*` tools are the reference. Web + Tauri (its webview) provide it via `getUserMedia`; the headless CLI does not.

## `host.recorder` *(device capture - optional, v1.17; capability: `microphone` / `camera` / `screen`)*

Record the microphone (and optionally the camera) to a finished media Blob, plus a DOM-free **level meter** for a pre-record sound check. The dual of `host.media`: where `media` is a live frame *source*, `recorder` is a *sink* - the shell owns `getUserMedia` + `MediaRecorder` and the engine only ever sees plain numbers (`AudioLevel`) and finished Blobs, never a `MediaStream` or `<video>`. Because recording prompts for a permission a shell may be unable to grant, it **is** gated - declare `"microphone"` (and `"camera"` for video) in `capabilities`; the headless CLI provides none. Feature-detect `host.recorder`.

| Member | Type | Notes |
|---|---|---|
| `isAvailable(kind?)` | `boolean` | Is capture of `'audio'` (default) / `'video'` / `'screen'` usable right now (a secure context)? A `true` doesn't pre-grant permission |
| `meter` | `MeterAPI` | Live input-level meter - a pre-record "sound check" (below) |
| `record(opts?)` | `Promise<RecordSession>` | Open a capture session (prompts the first time); resolves once recording |
| `still(opts?)` *(v1.54)* | `Promise<Blob>` | One frame as an encoded image - `'screen'` (default) prompts the display picker, `'camera'` takes a camera frame. DOM-free: the shell owns the stream and the grab |

`MeterAPI`: `start()` (begin the mic + level loop, prompting once; reference-counted + idempotent like `media`), `stop()` (release one `start()`; the mic stops at the last release), `subscribe(cb) → () => void` (receive `AudioLevel` frames; throttled, paused while the document is hidden). The web shell opens the meter **raw** - noise-suppression / AGC / echo-cancellation off - so the level and the noise cues reflect the true room. `record()` keeps suppression on for a clean file, so the two use separate streams (the grant is per-origin, so a sound-check then a record still prompts only once).

`RecordOpts`: `audio` (default `true`), `video` (default `false` - an audio+video clip when `true`), `source` (`'device'` default, or `'screen'` to record the display - gated by the `screen` capability), `systemAudio`, `format` (`'webm' | 'mp4'` - a hint; the shell falls back across containers, so read the returned Blob's `type`), `maxEdge` (video downscale, longest edge in px), `frame` (v1.165 - `{width, height}`, video only: the camera is cover-cropped and scaled into a canvas of exactly that size and the canvas is what gets recorded, so a take can match a target such as the artboard's export dimensions; the self-view shows the same framing), `maxMs` (hard length ceiling; the session auto-stops), `meta` (provenance stamped into the Blob).

`RecordSession`: `subscribe(cb)` (live `AudioLevel` during the take, same shape as the meter, so coaching UI updates while recording), `stop() → Promise<Blob>` (finalise and resolve the media Blob), `cancel()` (discard and release the devices - no Blob).

An **`AudioLevel`** is the audio counterpart to `MediaFrame` (all amplitudes `0..1` linear except `dbfs`): `{ rms, peak, dbfs, clipping, t }`, plus the optional **v1.19** background-noise cues `noiseFloor` / `snr` / `hum` / `hiss`. A tool rarely subscribes itself - it declares an `onLevel` hook and the runtime drives it from the meter (and the take). See [Authoring Tools](/info/authoring-tools.html) for the `onLevel` pattern and the full field list; `voice-recorder` (mic-only) and `top-tail-recorder` (camera+mic) are the reference tools.

## `host.audio` *(audio analysis - optional, v1.71)*

Decode a finished clip and get back a **per-frame reactivity track**: loudness, a bass/mid/treble split, a log-spaced spectrum, brightness, onset strength, a tempo, beat times and optionally raw time-domain windows. This is the primitive behind audio-reactive visuals - waveforms that actually move with the music rather than sweeping a playhead over a static shape.

The dual of `host.recorder.meter`, which reports the **live** microphone one sample at a time. Anything *drawing* a clip needs the opposite: frame 200's bass while it is still rendering frame 1. Not a gated capability; feature-detect `host.audio` and fall back to a static waveform. The audio never leaves the device.

| Method | Returns |
|---|---|
| `isAvailable()` | `boolean` - a decoder exists here. Does **not** promise a given file decodes |
| `analyse(src, opts?)` | `Promise<AudioAnalysis>` - decode + analyse; rejects on unfetchable bytes or a missing codec |

`src` is a URL (including `blob:` / `data:`), an `AssetRef` or raw encoded bytes - the last so a `file` input's in-memory upload can be analysed without being stored first.

`AudioAnalyseOpts`: `fps` (analysis frames per second, default 30 - match your export fps), `bands` (spectrum bins per frame, default 64), `buckets` (static overview columns, default 128), `start` / `window` (seconds - trim to the clip you are actually showing; clamped rather than erroring), `samples` (**opt in** to raw time-domain windows of N samples per frame, rounded up to a power of two).

`AudioAnalysis`: `duration` (of the **whole** source, not the analysed window), `sampleRate`, `channels`, the `start` / `window` / `fps` actually used, `peaks` (the overview waveform), `frames`, `bpm` and `beats`.

`AudioFrames` is **struct-of-arrays**, indexed by frame - a minute at 60fps is 3,600 frames, and a draw loop wants flat typed arrays, not 3,600 objects: `count`, `bands`, `samples`, then `t`, `rms`, `peak`, `bass`, `mid`, `treb`, `centroid`, `flux` (one entry per frame) and `magnitude`, `wave`, `waveL`, `waveR` (`count` consecutive rows - row *i* of the spectrum starts at `i * bands`).

Three behaviours worth designing around:

- Everything is normalised `0..1` across the analysed window **except `peak`**, which stays absolute so you can still tell that a source clipped. Normalisation is what lets a quiet voice memo and a mastered single both fill the frame.
- `bass` / `mid` / `treb` share **one** scale, so they read as a balance. Normalised separately, a bass-only clip would report treble pinned at 1.0.
- **`bpm` is `null` when there is no rhythm to find**, and that is the common answer for speech, ambience and pads. Never treat null as 120 - a visual built on a wrong beat grid looks far worse than one built on none.

The shell owns the decoder; the maths is the engine's `analysePcm`, attached rather than reimplemented, so the browser and the terminal read identical numbers off the same clip. What differs is *coverage*: the web shell gets everything `decodeAudioData` supports, while the Node shells (CLI/TUI) decode **WAV** plus our own **ZzFXM** songs and reject anything needing a platform codec by name, rather than shelling out to whatever ffmpeg happens to be on `PATH`.

## `host.codec` *(deep image codecs - optional, v1.100)*

Encode a float pixel frame into finished image bytes at real bit depth. This is the dual of `host.export.render`, which rasterises the DOM to 8-bit. A tool that computes its own high-precision pixels - a float grading pipeline, or a renderer with real headroom - hands over a linear Float32 RGBA frame. It gets back a 16-bit PNG, an OpenEXR or Radiance HDR master or an error-diffused 8-bit PNG. These are depths the browser's 8-bit canvas cannot originate. Not a gated capability. Feature-detect `host.codec` and fall back to the ordinary 8-bit export where it is absent. The pixels never leave the device.

A **`CodecFrame`** is `{ width, height, data: Float32Array, space? }`. `data` is RGBA interleaved, linear light, un-premultiplied and unbounded. `space` carries the working primaries with the buffer - `'srgb-linear'` (the default), `'display-p3-linear'` or `'rec2020-linear'`. The maths is the engine's own writers, so the shell only forwards. Web and CLI produce byte-identical output from the same frame.

| Method | Returns | Notes |
|---|---|---|
| `png16(frame, opts?)` | `Promise<Uint8Array>` | 16-bit sRGB PNG - real per-channel precision, no HDR. `opts.dpi`, `opts.channels` (`3`/`4`) |
| `exr(frame, opts?)` | `Promise<Uint8Array>` | OpenEXR master. `opts.pixelType` (`'half'` default / `'float'`), `opts.channels` (`'rgba'`/`'rgb'`) |
| `radiance(frame, opts?)` | `Promise<Uint8Array>` | Radiance RGBE (`.hdr`) master. `opts.exposure` |
| `dither8(frame, opts?)` | `Promise<Uint8Array>` | Error-diffused (Floyd-Steinberg) 8-bit sRGB PNG from a deep source. `opts.dpi`, `opts.channels` |

The SDR encoders (`png16` and `dither8`) gamma-encode and clamp at their display boundary. `exr` and `radiance` keep the unbounded linear values. Every method is async, so a shell can offload the encode to a Worker.

This pairs with a tool's **`exportStill`** hook. A tool declares `exportStill` in its manifest `hooks`, and the runtime calls it before `host.export.render` with `{ node, format, opts, host }`. Returning `{ bytes, mime }` short-circuits the export to those bytes (computed in float via `host.codec`). Returning `null` declines and falls through to the normal DOM raster path for that format, so a tool owns only the formats it has real depth for. Like the `exportFile` transform path, tool-supplied bytes carry no watermark and no engine provenance. Darkroom is the reference consumer.

## `host.layers` *(layered bitmap write-back - optional, v1.102)*

Serialise a set of positioned RGBA layers as a layered Photoshop **PSD** - the engine's own writer, so the file opens in Photoshop, GIMP and Krita. One method today. Feature-detect `host.layers?.writePsd`; it runs locally and, like every `export.file` path, the result is never watermarked or provenance-stamped, because it is the user's own file.

| Method | Returns | Notes |
|---|---|---|
| `writePsd(doc)` | `Promise<Uint8Array>` | 8-bit RGB PSD. `doc` is `{ width, height, layers }`, layers **bottom to top** |

A `LayerWrite` is `{ name, x, y, width, height, pixels, opacity?, blend?, visible? }` - `pixels` is RGBA8, un-premultiplied sRGB (what a canvas `getImageData` gives), and `width`/`height` must match the buffer. `blend` takes a CSS `mix-blend-mode` value. Async, so a shell may offload the encode; the maths is the engine's, so web and CLI emit identical bytes for identical documents.

The read side is deliberately **not** here: PSD/XCF *import* is a shell ingest flow (drop router → per-layer library assets), not something a running tool does.

## `host.upscale` *(on-device AI upscaling - optional, v1.101)*

Enlarge a low-resolution raster on the device, with no upload. For the person whose headshot is 400px beside colleagues' 2000px photos, this enlarges it offline. The added pixels are model-inferred, so the output carries a C2PA credential that names the model. The runtime discloses it as the IPTC `compositeWithTrainedAlgorithmicMedia` source type - a real photo, AI-enhanced, never claimed as fully generated. Not a gated capability. Feature-detect `host.upscale` and hide the affordance where it is absent. The headless CLI provides it too - onnxruntime-node and sharp in place of the browser's runtime and canvas - so a hook that upscales renders headlessly; the member stays undefined on a lean install that carries neither, and a model that is not staged refuses by name rather than downloading itself. Same for `host.matte`.

The shell owns the model runtime (onnxruntime-web, with WebGPU where present and a WASM fallback), the backend choice, the one-time consented weight download and the memory-bounded tiling. The tool only ever sees pixels. An **`UpscaleFrame`** is `{ width, height, data: Uint8ClampedArray }` - RGBA, 8-bit, straight alpha, the shape a canvas `getImageData` gives and `putImageData` takes. The run can take many seconds on a weak device, so it is never driven from a time-boxed hook. A shell offers it as an explicit, cancellable, progress-bearing action whose result becomes an asset.

| Method | Returns | Notes |
|---|---|---|
| `isAvailable()` | `boolean` | A backend and a Worker exist here. Sync |
| `backend()` | `'webgpu' \| 'wasm' \| null` | The resolved execution backend, or `null` before one is probed |
| `models()` | `UpscaleModelInfo[]` | The model catalogue - ids, sizes, licences, warnings. Sync and static |
| `modelBytes(id)` | `number` | Approximate one-time download for a model, for a consent UI |
| `cached(id)` | `Promise<boolean>` | Are a model's bytes already on-device? Never downloads |
| `canRun(src, opts?)` | `Promise<UpscaleFeasibility>` | Honest feasibility on this device, before any bytes move |
| `run(frame, opts?)` | `Promise<UpscaleFrame>` | Upscale a frame. Rejects (`AbortError`) on `opts.signal`; never half-produces |

An **`UpscaleModelInfo`** carries `id`, `name`, `scale` (`2`/`4`), `approxBytes`, `license`, `attribution`, `version` and an optional `warning`. The models ship under permissive licences (BSD-3-Clause, Apache-2.0), so the shell carries their attribution in its credits. `version` is written verbatim into the C2PA disclosure. The model ids are `realesr-general-x4v3`, `realesrgan-x4plus` and `gfpgan-v1.4`. GFPGAN is a face restorer, so it can invent facial detail that was never in the source. Its `warning` reads exactly `warning can invent face details` and its `facesOnly` is `true`.

`UpscaleOpts` takes `model`, `scale` (`2`/`4`), `denoise` (`0..1`, the general model only), `targetMaxEdge` (a hard cap on the output's longest edge), `signal` (an `AbortSignal`) and `onProgress`. When `canRun` answers `ok: false` the shell reads `reason` (`memory` / `no-backend` / `too-large`), `message`, `suggestedMaxEdge` and `suggestedModel`, then offers the lever rather than attempting the run.

## `host.matte` *(on-device background removal - optional, v1.103)*

Remove the background from a raster on the device, with no upload. A plain RGBA frame goes in and the same frame comes out with a model-computed alpha matte. It works like `host.upscale`: the shell owns the ONNX runtime, the WebGPU-to-WASM backend, the one-time consented model download and the memory bound. The tool only ever sees pixels. Not a gated capability. Feature-detect `host.matte` and hide the Remove-Background affordance where it is absent. Like `upscale`, it is never driven from a time-boxed hook - a shell surfaces it as an explicit, cancellable, progress-bearing action whose result is an asset.

The provenance differs from `upscale` on purpose. Upscale invents pixels, so it discloses a trained-algorithm composite and flags the asset AI-generated. A matte invents nothing. Every RGB pixel is the original, and only the alpha channel is computed - a selection, not image content. So the honest disclosure is an edit step, `Background removed with <model> <version>`, with the original kept as a C2PA ingredient. It is not a generated or composite claim, and the asset is not flagged AI-generated. That distinction is the point of hosting this: a same-format cutout that keeps its metadata, colour and credential intact, where other removers strip all three.

A **`MatteFrame`** is `{ width, height, data: Uint8ClampedArray }` - RGBA, 8-bit, straight alpha. On the way in the model reads only RGB and ignores alpha. On the way out the RGB is byte-for-byte the input's and the alpha is the computed matte, so the result composites directly.

| Method | Returns | Notes |
|---|---|---|
| `isAvailable()` | `boolean` | A backend and a Worker exist here. Sync |
| `backend()` | `'webgpu' \| 'wasm' \| null` | The resolved execution backend, or `null` before one is probed |
| `models()` | `MatteModelInfo[]` | The model catalogue - ids, tiers, sizes, licences. Sync and static |
| `modelBytes(id)` | `number` | Approximate one-time download for a model, for a consent UI |
| `cached(id)` | `Promise<boolean>` | Are a model's bytes already on-device? Never downloads |
| `canRun(src, opts?)` | `Promise<MatteFeasibility>` | Honest feasibility on this device, before any bytes move |
| `run(frame, opts?)` | `Promise<MatteFrame>` | Cut out the subject. Rejects (`AbortError`) on `opts.signal`; never half-produces |

Two models tier the picker: `u2netp` (U²-Net lite, ~4.5 MB - the default, and the one that works on any subject) and `modnet` (MODNet, ~26 MB - tuned for people, weaker on everything else). Both ship under Apache-2.0. The roster leaves out the popular non-commercial models such as BRIA RMBG. It also **narrows** over time - `isnet-general` was retired in 2026-08, the BiRefNet pair in 2026-08 - so read `models()` rather than hard-coding an id; a shell that no longer carries the id you pass falls back to its default and logs, rather than failing the run. `MatteOpts` takes `model`, `maxEdge` (a cap on the output's longest edge), `signal` and `onProgress`. `MatteFeasibility` mirrors `UpscaleFeasibility` - `ok`, `reason`, `message`, `suggestedMaxEdge` and `suggestedModel`.

## `host.speech` *(speech synthesis + transcription - optional, v1.96)*

Turn a tool's own text into spoken audio on the device, with no upload. On-device Kokoro TTS returns mono PCM plus word timings. This is the dual of `host.audio`: where `analyse` turns a finished clip into numbers a tool can draw, `synthesize` turns text into a clip. A shell can play that clip, mix it under a video export or hand it straight back to `audio.analyse`. The word timings are what a caption or karaoke-highlight tool keys off, so they ride in the same result. Not a gated capability. Feature-detect `host.speech` and hide the voiceover affordance where it is absent. The headless CLI provides it as well, over the same models on onnxruntime-node, so a hook that speaks its own text renders headlessly. `lolly speak` and `lolly transcribe` are its discovery surface there, and a model that is not staged refuses by name instead of downloading itself.

| Method | Returns | Notes |
|---|---|---|
| `isAvailable()` | `boolean` | This shell can synthesise, possibly after a model download. Sync |
| `cached()` | `Promise<boolean>` | Are the model bytes already on-device? Never downloads |
| `modelBytes()` | `number` | Approximate one-time download size, for a consent UI |
| `voices()` | `Promise<SpeechVoiceInfo[]>` | The voices the model can speak in |
| `synthesize(text, opts?)` | `Promise<SpeechResult>` | Text in, spoken PCM plus word timings out |

A **`SpeechResult`** is `{ pcm: Float32Array, sampleRate, duration, words, granularity }`. `sampleRate` is `24000` for Kokoro. `words` is an array of `{ text, start, end }` spans in seconds. `granularity` is `'word'`, `'sentence'` or `'none'` - check it rather than inferring alignment from span lengths. `SpeechSynthesizeOpts` takes `voice` (a `SpeechVoiceInfo.id`), `speed` (a rate multiplier, `1` is the natural pace), `signal` (an `AbortSignal`) and `onProgress`. An abort rejects the promise promptly with `AbortError`. An abort during the first-use download still lets the download finish in the background and cache, so the next request starts warm.

Transcription (v1.99) is the reverse - audio in, text plus word timings out, via on-device Whisper. It is feature-detected like synthesis, not capability-gated, and the audio never leaves the device. The STT model is a separate download from the TTS model, gated by its own consent.

| Method | Returns | Notes |
|---|---|---|
| `transcribeAvailable()` | `boolean` | This shell can transcribe. The CLI omits it for now |
| `transcribeCached()` | `Promise<boolean>` | Are the STT model bytes already on-device? |
| `transcribeModelBytes()` | `number` | Approximate one-time STT download size |
| `transcribe(src, opts?)` | `Promise<SpeechTranscript>` | Audio in, text plus word timings out |

`src` is an `AudioSource` - the same URL / `AssetRef` / raw-bytes union `host.audio.analyse` takes. A **`SpeechTranscript`** is `{ text, words, lang, granularity }`. `lang` is the BCP 47 tag the model detected or was told, and `granularity` is `'word'` or `'segment'`. The timed spans match the shape synthesis emits, so caption plumbing reads either source unchanged.

## `host.viz` *(MilkDrop visualisation - optional, v1.72)*

Availability and attribution, and deliberately nothing else. A tool is data: it has no element to hand over and no business holding a GL context, so it renders a `[data-lolly-viz]` placeholder carrying its parameters and the **shell** owns the canvas behind it - the same contract `[data-lottie-src]` uses, which is what lets the context and its loaded preset survive the `innerHTML` rebuild every keystroke causes. Not a gated capability: a shell without this, or without WebGL2, means the tool draws its ordinary canvas style, never that it refuses to render.

| Method | Returns | Notes |
|---|---|---|
| `isAvailable()` | `boolean` | Synchronous, so a hook can branch on it before deciding what to analyse |
| `presets()` | `Promise<VizPresetInfo[]>` | Ours first, then the artist pack - empty when that pack isn't staged in this build |

A `VizPresetInfo` is `{ id, name, author, calm }`. `author` is not decoration: twenty years of MilkDrop craft ships alongside our own presets, so credit only a preset the shell **confirms** it has - naming an artist whose work is not on screen is worse than crediting nobody. `calm` marks a preset safe to offer under reduced-motion.

## `host.color` *(perceptual colour tools - optional, v1.40)*

Extrapolate from **brand primitives** without shipping colour science in every tool: perceptual distance, contrast (WCAG + advisory APCA), smooth OKLab ramps, data class-breaks, distinct categorical palettes, harmony schemes, CSS-correct mixing and gradient baking. Every method is **pure and synchronous** - the same engine math on every shell (web, CLI, Tauri), so results never drift between them. Not a gated capability; feature-detect `host.color` and keep a small fallback for older shells. Every emitted colour is a gamut-mapped `#rrggbb` (`#rrggbbaa` when translucent).

| Member | Type | Notes |
|---|---|---|
| `deltaE(a, b)` | `number` | ΔEOK - perceptual distance in OKLab. `0` identical … ≈`1` black↔white; ~`0.02` is a just-noticeable difference |
| `contrast(a, b)` | `number` | WCAG 2.1 contrast ratio, 1–21, order-independent - the compliance number |
| `apca(text, bg)` | `number` | APCA-W3 Lc, signed (`+` dark-on-light). **Advisory** - honest on dark-mode/mid-tone pairs where WCAG misjudges; \|60\| ≈ body text, \|75\| ≈ small text |
| `ramp(stops, n, opts?)` | `string[]` | `n` colours along a smooth OKLab bézier through `stops`; `{ correctLightness: true }` re-spaces for perceptually even lightness steps - the "good multi-hue scale" recipe |
| `breaks(data, mode, n)` | `number[]` | `n + 1` class boundaries over numeric data - `'e'` equal, `'l'` log₁₀ (positive data only), `'q'` quantile. Bin values onto a ramp |
| `distinct(n, opts?)` | `string[]` | Up to `n` visually distinct categorical colours (chart series), seeded from `opts.anchorHex` (your brand primary) - the anchor is always the first colour |
| `schemes(seed, kind?)` | `ColorSchemeAccent[]` | **v1.60.** Harmony accents off one seed - `complement` (default), `adjacent-3`, `triad-3`, `tetrad-4`, `free-2`…`free-4` (the numeral is the scheme's total, seed included). The brand editor's own generator, attached verbatim, so a tool's harmonies match the editor's |
| `mix(a, b, t, opts?)` | `string \| null` | **v1.68.** Interpolate two colours the way CSS Color 4 does. `opts.space` picks the interpolation space (`oklab` default, plus `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`); `opts.hue` picks the travel around the circle for a polar space (`shorter` default, `longer`, `increasing`, `decreasing`). Alpha is **premultiplied** - a per-channel lerp toward `transparent` drags the colour toward transparent's *black*, so a red→transparent midpoint comes out dark red instead of plain red |
| `gradientCss(spec)` | `string \| null` | **v1.68.** A [gradient spec](#gradient-specs) string → a `linear-gradient(…)`/`radial-gradient(…)`/`conic-gradient(…)` value ready for `background-image`. Interpolates in the spec's space and **bakes** the result down to plain sRGB stops, so the same value renders identically on screen, in an exported SVG `<linearGradient>` and in a PDF axial shading |
| `gamut(color, space?)` · `maxChroma(l, h, space?)` · `slice(…)` · `gamutRegion(…)` · `oklch(color)` · `fromOklch(…)` | varies | **v1.69.** Gamut interrogation and OKLCH conversion - is a colour inside `srgb`/`display-p3`/`rec2020`, the most chroma available at a lightness/hue and 2-D slices of the solid for plotting. Feature-detect each |
| `iccProfile(bytes)` · `inProfileGamut(color, profile)` · `profileMaxChroma(…)` · `inkCoverage(color, profile)` | varies | **v1.70.** Treat a real ICC profile as the gamut - parse a press profile, ask whether a colour is printable in it and read total ink coverage. Feature-detect each |

**Which colour strings are accepted** differs by vintage, and that is on purpose. The metrics and generators (`deltaE`, `contrast`, `apca`, `ramp`, `breaks`, `distinct`, `schemes`) take hex (`#rgb`…`#rrggbbaa`) or `oklch()`/`lch()` - the forms token values take; resolve anything else first. The metrics (`deltaE`, `contrast`, `apca`) return `NaN` on unparseable input; `ramp` throws; `schemes` falls back to a neutral mid-blue seed; and `distinct` ignores an unparseable anchor and still returns colours. `mix` goes through the engine's full **CSS Color 4** parser, so it also accepts `rgb()`, `hsl()`, `hwb()`, `lab()`, `oklab()`, the CSS named colours and `color(display-p3 …)` / `color(rec2020 …)` / `color(prophoto-rgb …)` / `color(a98-rgb …)` / `color(srgb-linear …)` / `color(xyz-d50|xyz-d65 …)` - including `none` components; it returns `null` rather than guessing when either side won't parse.

### Gradient specs

An authored gradient is **one URL-safe string** - `lin_90_30ba78-0_efefef-100` is "linear, 90°, brand green at 0%, fog at 100%" - because a gradient has to survive the same round trip every other input does: editor → block row → shared link → CLI → identical render. The grammar is `<kind>_<angle>_<colour>-<pos>_<colour>-<pos>…`:

- **Kind** - `lin` / `rad` / `con` (or the long `linear`/`radial`/`conic`).
- **Interpolation space**, as a dot-suffix on the kind: `lin.srgb`, `lin.oklch.longer`. The spaces you can name for a gradient are `oklab` (the default), `oklch`, `lab`, `lch`, `srgb`, `srgb-linear` and `hsl`; a polar space takes an optional hue travel (`shorter` default, `longer`, `increasing`, `decreasing`). The list is closed on purpose, so a typo reads as "unknown" rather than silently picking a space nobody meant.
- **Angle** in degrees, CSS convention - `0` is to the top, `90` to the right. It's the gradient line for `linear`, the `from` angle for `conic` and unused for `radial`.
- **Stops** - up to 12, each a bare hex (`30ba78`, no `#`), a CSS colour name or `transparent`, then `-<pos>` in percent. Parsing is lenient (a leading `#`, an `@` separator, a missing angle, unpositioned stops, upper case all read fine) and writing is strict, so the round trip is byte-stable. Fewer than two usable stops answers `null` - a caller should fall back to a flat fill rather than paint something half-specified.

Read and written by `parseGradientSpec` / `formatGradientSpec` in the engine, baked to CSS by `gradientCss` above. The Design tool's per-box gradient fill is the reference consumer.

The idiomatic chart pattern - series colours that follow the **active brand** (see `chart`, the reference implementations): prefer the brand's own `color.spectrum.*` tokens from `host.tokens.colors()` (they carry measured print inks), top up with `distinct()` anchored on `{color.semantic.primary}` and keep your shipped palette as the fallback for shells without `host.color`.

## `host.geom` *(exact vector geometry - optional, v1.64)*

Path booleans, offsetting, stroke-to-fill outlining, pen-tool spline lowering, simplification and hit testing - the engine's geometry kernel, which keeps everything as real Béziers (nothing flattens, samples or rasterises). Every method is **pure and synchronous** - the same engine math on every shell, so a pen tool's geometry is identical in the browser, in Tauri and headlessly in the CLI. Not a gated capability; feature-detect `host.geom`.

The currency both ways is an **SVG path-data string** - what already lives in your template, your saved state and your URL. `parse` / `toPathData` expose the structured form (contours of whole cubics, 8 numbers each) for callers that want to walk or edit curves themselves.

**Failures are returned, never thrown.** Every method answers `{ ok: true, … }` or `{ ok: false, code, message }`, because a throw out of `onInit`/`onInput` is caught, logged and discarded by the runtime - which would leave a tool silently unresponsive rather than telling the user anything. A path result carries `{ d, contours, curves }`; a measurement result carries `{ value }`.

| Member | Result | Notes |
|---|---|---|
| `union(paths, opts?)` | path | Everything any operand covers. `paths` is an array of `d` strings; one operand folds to its own canonical form |
| `intersect(paths, opts?)` | path | Only what every operand covers, folded left to right |
| `difference(paths, opts?)` | path | `paths[0]` minus every later one |
| `xor(paths, opts?)` | path | Covered by an odd number of operands |
| `selfUnion(d, opts?)` | path | Canonical form of ONE path: self-intersections resolved, holes wound opposite their shell, overlaps merged. Run it on a freshly-closed path before filling. The only boolean that never reports `'limit'` |
| `offset(d, distance, opts?)` | path | Grow (`> 0`) / shrink (`< 0`). `opts`: `join` (`miter`·`round`·`bevel`), `miterLimit`, `tolerance` |
| `stroke(d, width, opts?)` | path | A stroked path in, a **filled outline** out (fills identically under the nonzero rule). Adds `cap` (`butt`·`round`·`square`); defaults are SVG's own |
| `simplify(d, opts?)` | path | Fewer segments within `opts.tolerance` (default `0.01`px). For a *finished* path - never between booleans, which rely on output points lying exactly on their inputs |
| `fromNodes(authored)` | path | Lower `{ kind, nodes, closed, tension? }` to path data. Handles are **offsets** from the node (`hInX`/`hInY`/`hOutX`/`hOutY`); `kind` is a string the ENGINE validates, so a spline family added later needs no bridge change |
| `continuity(node, moved)` | node | Re-apply a node's `corner`·`smooth`·`symmetric` constraint after one handle moved (`'in'`/`'out'`) - the operation a pen tool runs on every drag |
| `bounds(d)` | box \| `null` | Tight extent (the curves' real bounds, not their control hull) |
| `area(d)` | `number` | Signed, exact (Green's theorem per cubic). Positive = counter-clockwise in a y-up frame. Self-overlap gives the winding-weighted area - `selfUnion` first for the filled one |
| `contains(d, x, y, opts?)` | `boolean` | Inside the fill, under `opts.fillRule` (`nonzero` default) |
| `winding(d, x, y)` | `number` | Signed wrap count; `contains` under nonzero is `winding !== 0` |
| `nearest(d, x, y)` | `{ x, y, distance, contour, curve, t }` | Nearest point ON the path, with the address that found it - hit test, snap and the `t` to split at to insert a node |
| `parse(d)` | contours | Every shorthand expanded: H/V → lines, Q/T → cubics exactly, A → cubics by the spec's endpoint parameterisation |
| `toPathData(contours, opts?)` | path | Straight pieces written as `L`; `opts.decimals` defaults to 4 |
| `limits()` | ceilings | `maxChars` / `maxCommands` / `maxCurves` / `maxCoordinate` / `maxPaths` / `maxNodes` - check a path before offering an operation on it |
| `encodeAuthored(path \| paths)` | string | One versioned, delimiter-safe string, so authored geometry survives an input value, a `blocks` sub-field and a share link unchanged |
| `decodeAuthored(value)` | authored paths | Always a list. `invalid-argument` on garbage or a newer format version; `too-large` past `limits().maxNodes` |

`code` on a failure tells you what to do, and the distinctions are deliberate: `'invalid-path'` (malformed `d` - reject it, don't retry), `'too-large'` (well-formed but past the ceilings above), `'limit'` (the answer exists and this engine declines to guess at it past its bounded-work ceiling - retry with simpler operands or a coarser `tolerance`), `'invalid-argument'`, `'unsupported'` (a spline kind this engine knows the name of but cannot lower yet), `'internal'` (a bug - report it). **`ok: true` with `d: ''` is an answer**, not a failure: a non-overlapping intersection and an offset shrunk past its inradius are both legitimately empty. There is no degraded fallback anywhere in the API - you are never handed a plausible-looking wrong path. Path data is parsed defensively (bounded size, command count, curve count and coordinate magnitude, with a grammar that rejects rather than guesses), so a `d` from a paste or a URL param is safe to hand straight in.

## `host.connectors` *(committed connector geometry - optional, v1.106)*

Export-safe connector / line / arrow geometry: the engine's connector module behind a tool-facing surface, attached verbatim by every shell, so web, Tauri and CLI emit identical arrows - a canvas tool's `hooks.js` renders its connectors in one line and a headless `--export` keeps them. Pure and synchronous, like `color` and `geom`. Not a gated capability; feature-detect `host.connectors`.

| Member | Returns | Notes |
|---|---|---|
| `build(edges, rectById, opts)` | `string` | The committed connector layer as an export-safe SVG string - every edge routed and decorated, wrapped in a canvas-sized `<svg>`. `rectById` maps a box id to its native rect; a free-point endpoint (`@x,y`) resolves without one |
| `pathHeadSvg(opts)` *(v1.110)* | `string` | An arrowhead/decoration fragment for **one** path tip, addressed by tip + outward tangent, so a spline, a line and a connector decorate identically. Baked coordinates, no transform, no `<marker>` - it drops into any `<svg>` and survives the vector walkers |
| `pathHeadInset(head, width)` *(v1.110)* | `number` | How far to pull the shaft back off the head at stroke `width`, so a filled head isn't stabbed through by its own line |
| `dashFit` *(v1.110)* | `DashFitAPI` | Manual dash entry plus corner-fit dash geometry |
| `routeStyleForKind(kind, override?, nodeCount?)` *(v1.111)* | `string` | The route a **bound** path is drawn with, from its own spline kind - `line` → straight (an authored polyline of 3+ nodes → elbow), `spiro` → arc, everything else → the smooth curved S. The box's explicit `route` field wins whenever it names one of `routeStyles` |
| `routeStyles` *(v1.111)* | `string[]` | The thirteen route styles `build` understands, in menu order, so a pack control and the editor offer one list rather than each spelling it out |

Everything below `build` is optional/additive - feature-detect each member, not just the surface.

## `host.c2pa` *(sign finished bytes - optional, v1.85)*

Embed a **freshly signed** C2PA manifest into finished bytes. This is not a general provenance surface: ordinary exports keep going through `host.export`, which owns ingredients, action history and the opt-in gates. This exists for the redacted-derivative path, where carrying the source's manifest forward would re-embed a pixel-accurate thumbnail of the un-redacted original - so the output is signed as a **new work** instead, and the caller says so in the UI. Not a gated capability; feature-detect `host.c2pa?.sign`. Signing runs locally with the enrolled device identity when one is valid, else an ephemeral on-device key; the bytes are never uploaded.

| Method | Returns | Notes |
|---|---|---|
| `sign(bytes, format, opts?)` | `Promise<Uint8Array>` | The stamped bytes. `format` is the output format key (`pdf`, `png`, `jpg`, `mp4`, `m4a`, …). Two modes: the default derivative path (no ingredients), and the v1.104 any-media authorship path, which stamps an existing file with the artist's author / copyright / licence and carries manifests already inside it forward as ingredients. **Throws** when the format can't carry a manifest or signing fails - the caller decides whether unsigned bytes may still ship |
| `readIngredients(bytes)` *(v1.104)* | `Promise<IngredientCredential[]>` | Every manifest a file already carries, packaged ready to pass to `sign({ ingredients })` - the file's own container credential plus element-level credentials nested inside it (today: signed rasters an SVG embeds via `<image href="data:…">`). Read-only and **never throws**: a file with nothing signed resolves to `[]` |

## `host.log`

`log(level, msg, ctx?)` - `level` is `debug`·`info`·`warn`·`error`. Goes to the console in dev and a diagnostics buffer for support. Hook errors are caught and logged, not thrown.

## Hook execution - scope & time budgets

Hooks are loaded via `new Function('host', …)` with the capability bridge injected as closure scope. That is a **portability contract, not a security boundary**: hooks still run in the page realm, so in a browser shell they *can* reach `window`, `document` and `fetch` - `host.*` is simply the only surface guaranteed to exist on every shell (browser, Tauri, CLI). Module imports don't work (hooks ship as a single source string), and third-party/untrusted tool code is **not** safe to run until Worker isolation ships - today the catalog origin is the trust boundary.

Async hook results are **time-boxed**: `onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s. On overrun the runtime stops waiting and **discards the late result** - it never patches inputs or extras after the race is lost - but the hook itself keeps executing (there is no in-realm preemption; a *synchronous* runaway hook can't be interrupted at all, so its overrun is just measured and logged as a warning). `onInit`/`onInput` overruns and errors are logged, never fatal. Export-path hooks differ: a `beforeExport`, `exportFile` or `exportStill` error (including a timeout) fails that export visibly, while `afterExport` - the cleanup guarantee - is always awaited and its errors only logged. `onFrame` (live camera) and `onLevel` (audio meter) run once per frame / level sample and are **not** time-boxed - keep them cheap; the runtime simply drops a sample if the previous one is still rendering.
