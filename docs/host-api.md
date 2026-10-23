# Host API

You are writing a tool's `hooks.js` and need something the template cannot do alone: read the person's profile, place a brand asset, shape a headline into outlines or hand back a finished file. Every hook receives one object, `host`, that does those jobs for you.

The same hook runs unchanged in the web app, the desktop and mobile apps, the CLI, the TUI and the MCP server. Each of them implements `host` in its own way, so your tool never touches the DOM outside its template, the network or storage directly. (The TUI reuses the CLI's implementation, so anything this page says of the CLI applies to the TUI too.)

::: figure host-api-bridge
A tool hands every outside job to `host`. Six members exist on every shell; the rest are optional and grouped by job below. Each shell implements the same contract its own way.
:::

Every shell provides six members: `profile`, `assets`, `state`, `clipboard`, `export` and `log`. The rest are optional. Check for an optional API before you call it, or list the ones your hooks cannot do without in the manifest's `requires`, and a shell that lacks one refuses to open the tool instead of failing halfway.

Unless a section says otherwise, an API works on the device and sends nothing anywhere. Where the engine does the work, as it does for colour, geometry, connectors, codecs, audio analysis and layout, every shell runs the same engine code, so the web app and the CLI get the same numbers and the same bytes.

To type-check and test against this contract without cloning Lolly, install the SDK: `npm i -D @lolly-tools/core`. It installs the `HostV1` types, `validateTool` and `createMockHost` ([package page](https://www.npmjs.com/package/@lolly-tools/core)). The canonical declarations are in `packages/core/src/host-v1.ts`, a stable barrel over one file per API in `packages/core/src/host-v1/`, and an API snapshot test rejects accidental signature drift.

```js
function onInit({ model, host }) {
  host.log('info', 'tool booting', { shell: host.shell });
  // ... call host.profile / assets / state / clipboard / export / net / text
}
```

[Authoring Tools](/info/authoring-tools.html) covers a tool's anatomy, and [Tool hooks](/info/tool-hooks.html) covers when each hook runs.

## Rules of the contract

- **Additive only.** Methods may be added in a minor version, and are never removed or changed in signature without a major version. When v2 ships, v1 keeps working.
- **Check, or declare `requires`.** Check for an optional API before you call it (`host.text?.toPath`). When your hooks call one without checking, list it in the manifest's `requires` (`["text", "tokens"]`): the runtime then refuses to mount the tool on a shell that lacks one, before any hook runs, and the gallery greys the tool out there. `node scripts/tool-requires.ts --write` reads your `hooks.js` and writes the list. See [Tool manifests](/info/tool-manifest.html). `HOST_V1_OPTIONAL_APIS` in `packages/core/src/host-v1/apis.ts` is the complete list of optional APIs.
- **Device and network access needs a capability.** `net` (`network`), `capture` (`capture`), `compose` (`compose`) and `recorder` (`microphone`, `camera` or `screen`) need a matching flag in the manifest's `capabilities`. Every other optional API takes no flag and is present only on a shell that provides that API.
- **No platform-specific methods.** If only one shell can do something, it sits behind a `capabilities` flag, and shells that cannot fulfil it expose a stub or an error.
- **Identify the host.** `host.version` is `'1'`; `host.shell` is one of `web`, `tauri-desktop`, `tauri-mobile` or `cli`.
- **`host` is the portable surface, not a sandbox.** [Where hooks run](#where-hooks-run) says when a hook runs in the page and when it runs in a Worker.

## Find the API for your job

| Job | APIs |
|---|---|
| [What every shell provides](#what-every-shell-provides) | [`profile`](#host-profile), [`assets`](#host-assets), [`state`](#host-state), [`clipboard`](#host-clipboard), [`export`](#host-export), [file inputs](#file-inputs), [`log`](#host-log) |
| [Brand and type](#brand-and-type) | [`tokens`](#host-tokens), [`text`](#host-text), [`fonts`](#host-fonts), [`emoji`](#host-emoji), [`color`](#host-color) |
| [Pictures and pixels](#pictures-and-pixels) | [`images`](#host-images), [`raster`](#host-raster), [`codec`](#host-codec), [`layers`](#host-layers), [`scan`](#host-scan), [`lift`](#host-lift) |
| [Vector, layout and motion](#vector-layout-and-motion) | [`geom`](#host-geom), [`connectors`](#host-connectors), [`layout`](#host-layout), [`keyframes`](#host-keyframes) |
| [Documents and text](#documents-and-text) | [`pdf`](#host-pdf), [`pptx`](#host-pptx), [`prepare`](#host-prepare), [`compare`](#host-compare), [`textTools`](#host-texttools) |
| [Sound, speech and camera](#sound-speech-and-camera) | [`media`](#host-media), [`recorder`](#host-recorder), [`audio`](#host-audio), [`speech`](#host-speech), [`viz`](#host-viz) |
| [Reaching outside the tool](#reaching-outside-the-tool) | [`net`](#host-net), [`capture`](#host-capture), [`compose`](#host-compose), [`models`](#host-models) |
| [On-device AI models](#on-device-ai-models) | [`upscale`](#host-upscale), [`matte`](#host-matte), [`ocr`](#host-ocr) |
| [Provenance](#provenance) | [`c2pa`](#host-c2pa), [`export.imprint`](#host-export) |

## What every shell provides

### `host.profile`

The person's details. Tools read them; the person manages them in the host's own interface. Most tools never call this directly: declare `bindToProfile: "firstname"` on an input and the host fills it in for you.

| Method | Returns | Notes |
|---|---|---|
| `get()` | `Promise<Profile>` | Current profile |
| `subscribe(fn)` | `() => void` | Calls `fn(profile)` on change; returns an unsubscribe |

`Profile`: the fields a tool reads are `firstname, lastname, email, phone, title, org, city, country, lang, headshot (AssetRef), useDetails` and `custom`. `useDetails` is the opt-in that gates embedding author and contact details into export provenance. The rest are app preferences and interface records, not a tool concern: `featureFlags` (the person's local interface flags), `a11y`, `appearance`, `emoji`, `saveRenders`, `exportHome`, favourites, hidden tools, templates and assets, trusted sites and similar records.

### `host.assets`

The bridge to the catalog and the person's own library. For an `asset`-typed input the host builds the picker from your manifest declaration, so you rarely call `pick()` yourself. Use the `url` of an `AssetRef` in your template through the `asset` helper (`{{asset logo}}`).

::: details `host.assets` members
| Method | Returns | Notes |
|---|---|---|
| `get(id, opts?)` | `Promise<AssetRef>` | Resolve one asset (`opts.format`, `opts.version`); throws if missing |
| `query(filter)` | `Promise<AssetRef[]>` | Search the catalog |
| `pick(opts)` | `Promise<AssetRef \| null>` | Open the host's picker; `null` if cancelled |
| `isAvailable(id)` | `Promise<boolean>` | Is it cached and usable offline right now |
| `add(file)` | `Promise<AssetRef>` | Optional, v1.246. Save a file the person made into their Assets; see below |
| `bytes(target)` | `Promise<Uint8Array>` | Optional, v1.183. The bytes behind an `AssetRef`, or behind a url an earlier `get`, `pick` or `compose.render` returned. The portable replacement for `fetch(ref.url)`, which a strict Worker refuses and a headless shell lacks; an http(s) url goes through the tool's `host.net` allowlist |
| `credential(id)` | `Promise<{ store, format } \| null>` | Optional, v1.26. The Content Credentials a person's upload carried at ingest, kept as the raw manifest store so an export can carry them forward as an ingredient |
| `resolveProvider(ref)` | `Promise<AssetRef \| null>` | Optional. Resolve a logical `provider://scope/path` reference; `null` selects the normal fallback |

`AssetQuery` / `AssetPickerOpts`: `type` (`vector`·`raster`·`video`·`audio`·`lottie`·`model`·`lut`·`palette`·`tokens`·`font`·`profile`·`ratecard`·`text`·`data`), `namespace` (for example `lolly/logo`), `tags` (AND), `includeDeprecated` and `motion` (v1.154, widens an image query to admit video). The picker adds `types` (v1.191, several types in one picker), `title`, `allowUpload` and `current`.

`add({ name, bytes, mime? })` saves a file the person made with your tool, such as a render or a song file, into their Assets. It uses the same ingest as an upload: the extension decides the format, and a duplicate of something already in the library is offered back rather than stored twice. Call it only when the person asks to save. The web shell refuses a call on a page nobody has touched (`assets.add.no-gesture`), limits a burst of saves (`assets.add.rate`) and confirms each save with a toast that offers Undo. Check for `host.assets.add` and keep your download as the fallback, because the Node shells have no asset library and leave the method out.

`AssetRef`: `{ source: 'library'|'user'|'remote', id, type, format, url, width?, height?, version?, checksum?, meta? }`.
:::

### `host.state`

Per-tool saved state: IndexedDB on the web, the filesystem on Tauri and memory on the CLI. **Never use `localStorage`.** The host already saves and loads people's sessions, so reach for this only for state the tool manages itself.

| Method | Returns |
|---|---|
| `save(slot, data)` | `Promise<void>` |
| `load(slot)` | `Promise<object \| null>` |
| `list()` | `Promise<StateEntry[]>` |
| `delete(slot)` | `Promise<void>` |

`StateEntry`: `{ slot, toolId, toolVersion, updatedAt, label? }`.

### `host.clipboard`

| Method | Returns | Notes |
|---|---|---|
| `writeText(text)` | `Promise<void>` | |
| `writeImage(blob)` | `Promise<{ method: 'clipboard' \| 'download' }>` | Falls back to a download where image clipboard is not supported |

### `host.export`

The host owns the renderer, so tools do not bundle their own. `render` turns the tool's DOM into a file, `file` delivers bytes the tool made itself, and `imprint` marks an existing raster.

::: details `host.export` members
| Method | Returns | Notes |
|---|---|---|
| `render(node, format, opts?)` | `Promise<Blob>` | Rasterise or serialise a DOM node |
| `download(blob, filename)` | `Promise<void>` | Trigger a download (throws on the CLI; pipe via `--output` instead) |
| `file(blob, opts?)` | `Promise<void>` | Deliver a blob the **tool** produced (the transform path: file in, transformed file out), with `opts.filename`. Carries no watermark and no provenance; for on-device utilities whose `exportFile` hook returns the bytes |
| `imprint(bytes, format, opts?)` | `Promise<Uint8Array>` | v1.104. Apply Lolly's raster marks to finished image bytes: the pixel Imprint always, plus the neural Durable mark when `opts.durable`, re-encoded to the same format. For a tool that marks an existing file. A non-raster format, undecodable bytes or a tiny image come back unchanged, and the method never throws |
| `pack(spec)` *(optional, v1.178)* | `Promise<Uint8Array>` | Seal files the tool holds (fonts, app icons or any files) into a Linux package, an `.rpm` or a no-root `.tar.gz`. No watermark or provenance; check for it and fall back to a plain archive through `file()` |
| `share(blob, opts?)` *(optional, v1.126)* | `Promise<boolean>` | Hand a finished blob to the system share sheet. `true` when the sheet handled it, including a cancel; `false` means fall back to `download()` |
| `canShare(opts?)` *(optional, v1.126)* | `boolean` | Synchronous: will `share()` reach a share sheet for a file of this type on this shell? Show a "Send to" control only when this is `true` |
| `checkLayout(node)` *(optional)* | `Promise<{ ok, issues }>` | Measure declared text layout before export |

`format` is a format id. The `render.formats` enum in `schemas/tool.schema.json` is the full set: the catalog validator enforces it, a tool's manifest says which ids it offers, and [Every format Lolly can open and make](/info/formats.html) and [Exporting & Formats](/info/exporting.html) describe each one. The `ExportFormat` type in `packages/core/src/host-v1/export.ts` does not match the schema (it has no `webp`, `avif`, `tiff`, `pptx` or `zip`, for example), so check the schema, not the type. The unit maths is in `engine/src/units.ts`.
:::

::: details `ExportOpts` fields
| Field | Meaning |
|---|---|
| `width` / `height` | `number` = CSS px; `string` may carry a unit (`"210mm"`, `"8.5in"`, `"595pt"`) |
| `dpi` | Raster DPI for physical units (default 300; px → 96) |
| `scale` | Raster multiplier when width and height are absent (1, 2, 3) |
| `quality` | JPG quality 0–1 |
| `background` | Override transparency |
| `watermark` | On by default for experimental tools (never for on-device utilities); an explicit `false` turns it off |
| `meta` / `embedMeta` | Provenance metadata (assembled for you; set `embedMeta:false` to skip; on-device utilities skip it automatically). An assembled `ExportMeta` can also carry `designSystem` (`{ id, label }`), `designVersion` and `themes` (`{ group, kind?, id, name }[]`), each present only when known; see the design-system record below |
| `madeWith` | Whether the assembled `meta` records the design system and colourway that drew the export. Unset follows the runtime's switch (`runtime.setMadeWith()`, on by default; the export panel's **Design system** card, `_madewith=0` and `--no-madewith` set it); `false` leaves the record out of this one export. Ignored when the caller supplies its own `meta` |
| `colorProfile` | ICC handling: `'srgb'` (default raster), `'none'` to skip embedding or a CMYK press condition for `pdf-cmyk` |
| `filename` | Suggested output filename |
| `thumbnail` | A hint that this is a low-fidelity preview, not the deliverable (skips provenance) |
| `depth` | Requested bits per channel: `8`, `16`, `'float'` or `'auto'` (the default). A **request, not a promise**: depth follows provenance, so a deep container is never padded over an 8-bit render, and an unsupported request falls back to what the source really carries |
| `audio` | `{ id?, url, fadeIn?, fadeOut?, volume?, duck?, start? }`, an optional music bed for `webm`/`mp4`: decoded through Web Audio, muxed into the recording, plays for the clip duration and loops when the clip outlasts the track. `fadeIn`/`fadeOut` are seconds of linear gain ramp, `volume` is `0..1`, `duck` is the level the bed drops to while foreground audio plays and `start` is the bed's in-point in seconds (clamped into the source). Web shell; falls back to silence with a log warning where unsupported |
| `ingredients` | Content Credentials to carry forward from placed source assets, so the export's provenance chain records what it was built from. Opaque to the shell; ignored when the export is not C2PA-stamped |
| `c2paInputs` | A compact digest of the tool's scalar inputs (id → short string) that produced this render, recorded under `inputs` in the `tools.lolly.export` assertion |
| `c2paCapture` | `{ camera?, microphone? }`, set by the runtime when the essence came from a device sensor (a live camera frame, a recorder take), so the created step declares a real-world origin |
| `c2paTextAdded` | `{ sample? }`, set only when rendered text sits over an *opened* credentialed asset, which is a real "Added text" edit step. Text written from scratch is content, not an edit, and rides in `c2paInputs` instead |
| `c2paAiUpscale` | `{ model, version }`, set when the essence is an on-device AI-upscaled asset, so the credential records which model enlarged it |
| `rights` | `{ plan, fingerprint, onReceipt? }` (v1.197), the attribution plan for this export's recorded sources. A host that reads back the bytes it wrote calls `onReceipt` once, with `readback-confirmed` only when every required source was found in the file; a host that reads nothing back calls nothing. See [Creative rights](/info/creative-rights.html) |
| `signal` | An `AbortSignal` for a long export (v1.141). A shell polls it between frames, rows or pages and rejects with `AbortError`; an aborted result is never delivered |
| `cuts` | Uniform still count across a timed composition; `1` keeps the playhead frame |
| `sampleTimes` | Exact authored timeline seconds. One time returns a still; several return a ZIP or a paged PDF |
| `motionBlur` | `{ samples, shutterAngle }`, centred temporal exposure (`samples` is 1, 4, 8 or 16) |
| `sequenceRange` | `{ from, to }`, a temporary in and out range in seconds that leaves the saved marks alone |
| `sourceDocument` | `{ toolId, values }`, a frozen copy of the authored values, captured by the runtime for the structural exports (Lottie, IDML, Premiere XML) |
| `portableDocument` | `{ markup, styles, script, title, lang }`, an authored portable document the runtime supplies from the tool's declared files |
| `deepFrame` | A linear float `CodecFrame` a tool supplies, encoded through the normal metadata and credential path |
:::

::: details The design-system record in `meta`
When the runtime assembles `meta` with the record on, it reads `host.tokens.snapshot()` through the document's own theme choice and records the snapshot's `system`, its `version` unless that is the working head, and every theme choice except the light or dark one. A manifest that ignores an axis kind through `tokenAxes` records no choice of that kind. When a colourway is recorded, `description` gives the colourway beside the tool (`"Made with https://lolly.tools : Chart (Persimmon colourway)"`); a description bound with `bindToMeta` is left as written.

A shell writes the record as flat `designSystem`, `designSystemLabel`, `designVersion` and `themes` keys of the `tools.lolly.export` credential assertion (`designRecordEnvironment`), as `lolly:` XMP or SVG properties (`designRecordXml`) and as PDF keywords (`pdfKeywords`). `runtime.madeWithPreview()` returns the record and both descriptions without exporting, for a shell to show before anything is written, and `runtime.lastExportMeta` is the metadata the last export embedded, for a shell that stamps the credential afterwards. [Exporting](/info/exporting.html#the-design-system-record) describes what a person sees.
:::

### File inputs

A `file`-typed input (the person's own file, picked into memory) arrives as an **`InputFile`**: `{ __file: true, name, mime, size, bytes (Uint8Array), url }`. The hook reads `bytes` directly. There is no `host.*` call, because the bytes ride in the input value: the portable `host` surface has no file-read API, so the same hook runs on every shell. A `file` value never serialises to a URL and is never persisted. The `exportFile` hook transforms those bytes and returns `{ bytes, mime, filename }`, which the shell delivers through `host.export.file`. `strip-data` is the reference; [Authoring Tools](/info/authoring-tools.html) has the full pattern.

### `host.log`

`log(level, msg, ctx?)`: `level` is `debug`, `info`, `warn` or `error`. Goes to the console in development and to a diagnostics buffer for support. Hook errors are caught and logged, not thrown.

## Brand and type

### `host.tokens`

Design tokens (DTCG) for the active theme. The host's colour pickers draw their swatches from these, and the runtime resolves token-referenced input values against them. A shell without it offers no token-driven controls.

::: details `host.tokens` members
| Method | Returns | Notes |
|---|---|---|
| `get(opts?)` | `Promise<TokenSet>` | Resolved token set for the active choices. `opts.selection` replaces them; `opts.theme` picks that theme in the group that declares it and keeps the other groups' choices (engine 1.265) |
| `colors(opts?)` | `Promise<ColorSwatch[]>` | Colour tokens as picker-ready swatches |
| `resolve(ref, opts?)` | `Promise<unknown>` | Resolve a `{dotted.path}` alias (or bare path) to a concrete value |
| `themes()` | `Promise<{ name, group, id?, kind?, canonical? }[]>` | Themes declared in the document. `id` is present when the file gives one, and `kind` when the theme's group states one, such as `mode` or `colourway`; in such a group the canonical theme carries `canonical: true` (engine 1.265) |
| `axes()` *(optional)* | `Promise<TokenAxisInfo[]>` | Every theme group with its `group` id, `kind` (or `null`), `canonical` option id, default `rotation` (or `null`) and `options` in authored order, each with `id`, `name`, `canonical` and an optional date `window`. Structure only, so it takes no read options |
| `family(role?, opts?)` *(optional)* | `Promise<TokenFamilyMember[]>` | Every colourway's colour for one role, canonical first, in the look the read resolves to. `role` is a slot name (`primary`, the default, `secondary`, `on-primary`) or a full token path. `opts` works as for `get()`. Each member carries the colourway's `id`, `name`, `canonical`, `active` (the colourway this read resolves to) and `value` (a hex colour). Empty when the design system has no colourway group |
| `inspect(opts?)` *(optional)* | `Promise<TokenInspection>` | Resolution evidence for every retained token set, inactive definitions included |
| `list()` *(optional, v1.173)* | `Promise<DesignSystemSummary[]>` | Every design system this device holds. A read only: switching systems stays the person's choice in the host's interface |
| `active()` *(optional, v1.173)* | `Promise<DesignSystemSummary \| null>` | The design system the other reads resolve against, so a tool can say which one it drew with |
| `snapshot()` *(optional, v1.184)* | `Promise<TokensSnapshot>` | One immutable copy of the render context: the raw effective DTCG document for the resolved version, the active system, that version and the theme selection. For an exporter that keeps tokens and themes in its file, such as `.penpot` |
:::

**The family of leads.** A tool that uses several colours at once, such as chart series or a gradient's shuffle, can draw on every colourway's lead rather than one primary. `family()` lists them whatever colourway the artefact uses, and the artefact's own one has `active: true`. Treat fewer than two members as no family, and draw exactly as you would on a shell without the member:

```js
const family = typeof host.tokens?.family === 'function' ? await host.tokens.family('primary') : [];
const leads = family.length >= 2 ? family.map((m) => m.value) : [];
```

Put the leads ahead of the colours you would otherwise draw, never in their place. A design system with two colourways and no spectrum of its own still needs a full categorical palette, and two leads alone would repeat from the third series on. For chart series, prefer the brand's own `color.spectrum.*` tokens from `host.tokens.colors()` (they carry measured print inks), top up with [`host.color.distinct()`](#host-color) anchored on `{color.semantic.primary}` and keep your shipped palette as the fallback; `chart` is the reference.

The web shell, the CLI and the hook Worker answer `family()` and `axes()` with the same engine functions, scoped to the artefact's choices like every other read. The canvas carries the same family as CSS variables, `--brand-lead-1` onwards, described in [Authoring tools](/info/authoring-tools.html). A colourway or look switch re-points the slots without running `onInit`, so a hook that keeps colours it read there reads them again when `onInput` runs with `id: '__tokens'`, as [When the theme or colourway changes](/info/tool-hooks.html#when-the-theme-or-colourway-changes) describes. A hook can also compare `{color.semantic.primary}`, and any other slot it depends on, on each `onInput` and read again when the value changed, which catches an edit to the design system too. Chart, Mesh Gradient and Filter do both.

### `host.text`

Shape a text run and outline it into an SVG path with HarfBuzz, with correct kerning, ligatures and GPOS/GSUB. It needs no DOM: the web app, the CLI and the TUI all provide it, and in the Node shells fonts resolve off disk. The `wordmark` tool uses it to outline display type for crisp vector export.

::: details `host.text` members
| Method | Returns |
|---|---|
| `toPath({ text, fontUrl, fontSize, features?, letterSpacing?, variations?, fallbackFonts? })` | `Promise<TextPathResult>` |
| `preload(fontUrl)` | `Promise<void>` |
| `axisDefaults(fontUrl)` *(optional, v1.30)* | `Promise<Record<string, number>>` |
| `fontUrl(family, opts?)` *(optional, v1.60)* | `Promise<{ url, variations? } \| null>`: resolve a family the host knows (brand statics, user fonts, on-device Google Fonts, the platform face) to a fetchable file for `toPath()`; `null` when none matches, so keep a `<text>` fallback |
| `characters(fontUrl)` *(optional, v1.191)* | `Promise<number[]>`: the code points the font file itself maps, with no fallback |
| `fontInfo(font)` *(optional)* | `Promise<TextFontInfoV1>`: metadata for a content-pinned face, for authored text composition |
| `shapeRun(request)` *(optional)* | `Promise<TextShapedRunV1>`: shape one run with an explicit script, direction and language, keeping source clusters |
| `layoutRuns(request)` *(optional)* | `Promise<TextLayoutV1>`: shared paragraph composition over pinned source text and fonts. See [Authored text composition](/info/build/text-composition-engine.html) |

`TextPathResult`: `{ d, advanceWidth, bbox, notdef? }`, with the baseline at `y=0` and Y pointing down; `bbox` is `null` for whitespace-only runs.

`features` are OpenType tags (for example `['liga=0', 'salt=1']`) handed straight to HarfBuzz, so ligature and stylistic-alternate toggles bake into the outlined path (engine v1.12). `letterSpacing` (px, v1.12) adds uniform tracking to the pen advance, so letter-spaced type stays vector in SVG, PDF and EMF instead of falling back to a live `<text>` element.

**Variable fonts and fallback (v1.29–1.30).**

- `variations`: OpenType axis settings as HarfBuzz strings (`['wght=700']`). Without them a variable face shapes at its *default instance*, so a bold run would outline as regular. Unlisted axes take their default.
- `fallbackFonts`: an ordered `[{ fontUrl, variations? }]` chain for characters `fontUrl` has no glyph for, the job the browser's own fallback does. Webfont families arrive as **disjoint subsets** (Google Fonts' `latin` file has no `Ł`; its `latin-ext` file has no ASCII), so one face cannot outline `"Łódź"`.
- `notdef`: how many glyphs fell back to `.notdef` (no glyph anywhere in the chain). Outlining draws blanks, so if this is non-zero keep a live `<text>` fallback. Older hosts leave it out; treat that as `0`.
- `axisDefaults(fontUrl)`: the font's default axis values (`{ wght: 400 }`, or `{}` for a static font). A caller that embeds the raw file into a renderer with no axis control (jsPDF) gets exactly this instance, so it needs the defaults to know the weight it will actually get. Check for `axisDefaults` before calling.
:::

### `host.fonts`

*Optional, v1.262.* Read a font file's own tables and subset it to chosen text. The web, desktop, CLI, TUI and MCP shells provide it, and the same engine code answers on each, so the facts and the bytes match. Convert Font is the reference tool.

::: details `host.fonts` members
| Method | Returns | Notes |
|---|---|---|
| `inspect(bytes)` | `Promise<FontInspectionV1>` | TTF, OTF or WOFF. `container`, `outlines` (`truetype`, `cff`, `cff2`, `bitmap`, `none`), `family`, `style`, `fullName`, `version`, `postScriptName`, `glyphs`, `unitsPerEm`, `weight` (`value`, with `min`/`max` from a `wght` axis), `width`, `italic`, `axes`, named `instances`, `coverage` (`characters`, inclusive code point `ranges`, per-Unicode-block counts), `embedding` (the decoded `OS/2.fsType` and its raw value) and `subsetRefusal`. Rejects WOFF2, collections and anything unreadable |
| `subset(bytes, { text })` | `Promise<{ bytes, report }>` | Keeps the glyphs `text` needs plus what they depend on, with glyph ids kept. Returns a TrueType sfnt (a WOFF source is unwrapped; deliver it as `.woff` to rewrap). `report` gives `characters`, `kept`, `missing`, `inputBytes`, `outputBytes`, `policy` and `fsType` |

`subset` refuses before any work in three cases: the outlines are not TrueType (the pinned Skera build would drop a CFF table); the font's own fsType says restricted licence embedding, no subsetting or bitmap embedding only; or there is no OS/2 table to say anything. The rejection's `code` is the `subsetRefusal` value. Those flags are honoured, never bypassed, and the Skera runtime enforces the same rule for every caller. After subsetting, the output bytes are checked: TrueType outlines, every kept character still mapped to its original glyph with its outline present and an unchanged fsType. Output that fails is refused. fsType is the only licence signal a font file carries and is not the licence, so a subset is not a rights grant.
:::

### `host.emoji`

*Optional, v1.196.* The pinned vector emoji sets this shell's catalog mounts, so text in a render draws its emoji from the set the person chose rather than from the operating system's font. The runtime calls it for you after every paint and again inside an export, so most tools never call these methods. The web, desktop, CLI and TUI shells provide the API. A shell with no set mounted leaves it out, and the render shows the engine's neutral placeholder, never a system glyph.

The host supplies storage and transport only. Every decision about what to draw (sequence lookup, admission, fallback through the saved pins, the brand treatment and sizing) is the engine's, so a run of text looks the same on every shell.

::: details `host.emoji` members
| Member | Returns | Notes |
|---|---|---|
| `sets()` | `Promise<EmojiSetInfoV1[]>` | Every set this host can load. Never lists a system font |
| `manifest(pin)` | `Promise<Uint8Array \| null>` | The exact manifest bytes of a pinned set (id, version and the manifest's sha256), or `null` when that exact release is absent. A host never substitutes a different release |
| `artwork(pin, asset)` | `Promise<Uint8Array \| null>` | The exact source SVG bytes of one glyph of a pinned set, or `null` |
| `parseXml(source)` | `unknown` | Parse SVG text with a parser that makes no network requests |
| `renderSvg(source)` *(optional)* | `Promise<string>` | Resolve the emoji in a tool-generated SVG before it is baked into a bitmap |
| `renderText(opts)` *(optional)* | `Promise<{ svg, width, height, baseline, advanceWidth }>` | Draw one run of text as vector, with the document's chosen set and treatment |
| `install(bytes)` *(optional)* | `Promise<EmojiSetInfoV1>` | Admit and install a complete set; every glyph is checked before it is stored |
| `dependencies(pins)` *(optional)* | `Promise<AssetRef[]>` | The exact set assets a saved document or a portable file needs |
:::

### `host.color`

*Optional, v1.40.* Work from **brand primitives** without shipping colour science in every tool: perceptual distance, contrast (WCAG plus advisory APCA), smooth OKLab ramps, data class breaks, distinct categorical palettes, harmony schemes, CSS-correct mixing and gradient baking. Every method is **pure and synchronous**. Keep a small fallback for older shells. Every colour it emits is a gamut-mapped `#rrggbb` (`#rrggbbaa` when translucent).

::: details `host.color` members
| Member | Type | Notes |
|---|---|---|
| `deltaE(a, b)` | `number` | ΔEOK, perceptual distance in OKLab. `0` identical … ≈`1` black↔white; ~`0.02` is a just-noticeable difference |
| `contrast(a, b)` | `number` | WCAG 2.1 contrast ratio, 1–21, order-independent: the compliance number |
| `apca(text, bg)` | `number` | APCA-W3 Lc, signed (`+` dark on light). **Advisory**: reliable on dark-mode and mid-tone pairs where WCAG misjudges; \|60\| ≈ body text, \|75\| ≈ small text |
| `ramp(stops, n, opts?)` | `string[]` | `n` colours along a smooth OKLab Bézier through `stops`; `{ correctLightness: true }` re-spaces for perceptually even lightness steps (the "good multi-hue scale" recipe) |
| `breaks(data, mode, n)` | `number[]` | `n + 1` class boundaries over numeric data: `'e'` equal, `'l'` log₁₀ (positive data only), `'q'` quantile. Bin values onto a ramp |
| `distinct(n, opts?)` | `string[]` | Up to `n` visually distinct categorical colours (chart series), seeded from `opts.anchorHex` (your brand primary); the anchor is always the first colour |
| `schemes(seed, kind?)` | `ColorSchemeAccent[]` | **v1.60.** Harmony accents off one seed: `complement` (default), `adjacent-3`, `triad-3`, `tetrad-4`, `free-2`…`free-4` (the numeral is the scheme's total, seed included). The brand editor's own generator, attached verbatim, so a tool's harmonies match the editor's |
| `mix(a, b, t, opts?)` | `string \| null` | **v1.68.** Interpolate two colours the way CSS Color 4 does. `opts.space` picks the interpolation space (`oklab` default, plus `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`); `opts.hue` picks the travel around the circle for a polar space (`shorter` default, `longer`, `increasing`, `decreasing`). Alpha is **premultiplied**: a per-channel lerp toward `transparent` drags the colour toward transparent's *black*, so a red→transparent midpoint would come out dark red instead of plain red |
| `gradientCss(spec)` | `string \| null` | **v1.68.** A [gradient spec](#gradient-specs) string → a `linear-gradient(…)`/`radial-gradient(…)`/`conic-gradient(…)` value ready for `background-image`. Interpolates in the spec's space and **bakes** the result down to plain sRGB stops, so the same value renders identically on screen, in an exported SVG `<linearGradient>` and in a PDF axial shading |
| `gamut(color, space?)` · `maxChroma(l, h, space?)` · `slice(…)` · `gamutRegion(…)` · `oklch(color)` · `fromOklch(…)` | varies | **v1.69.** Gamut questions and OKLCH conversion: is a colour inside `srgb`/`display-p3`/`rec2020`, the most chroma available at a lightness and hue, and 2-D slices of the solid for plotting. Check for each |
| `iccProfile(bytes)` · `inProfileGamut(color, profile)` · `profileMaxChroma(…)` · `inkCoverage(color, profile)` | varies | **v1.70.** Treat a real ICC profile as the gamut: parse a press profile, ask whether a colour is printable in it and read total ink coverage. Check for each |
| `solveApca(hue, chroma, targetLc, bgHex, opts?)` | `{ hex, lc, reachable, … }` | **v1.107.** The inverse of `apca`: the lightness at this hue and chroma that reads closest to `targetLc` on `bgHex`, as gamut-mapped hex plus the Lc it achieves. `reachable` is `false` when the target is beyond what the hue can carry, and the answer is then the closest achievable. Check for it |
| `paletteExport(swatches, format, opts?)` · `paletteExportBytes(swatches, 'ase')` | `string` · `Uint8Array` | **v1.108.** Serialise a swatch list as DTCG tokens JSON, CSS custom properties, CSS utility classes, SCSS or a GIMP `.gpl` palette, or as a binary Adobe `.ase` file. The same serialisers as the brand editor's swatch download. Check for each |

**Which colour strings are accepted** differs by vintage. The metrics and generators (`deltaE`, `contrast`, `apca`, `ramp`, `breaks`, `distinct`, `schemes`) take hex (`#rgb`…`#rrggbbaa`) or `oklch()`/`lch()`, the forms token values take; resolve anything else first. The metrics (`deltaE`, `contrast`, `apca`) return `NaN` on unparseable input; `ramp` throws; `schemes` falls back to a neutral mid-blue seed; and `distinct` ignores an unparseable anchor and still returns colours. `mix` goes through the engine's full **CSS Color 4** parser, so it also accepts `rgb()`, `hsl()`, `hwb()`, `lab()`, `oklab()`, the CSS named colours and `color(display-p3 …)` / `color(rec2020 …)` / `color(prophoto-rgb …)` / `color(a98-rgb …)` / `color(srgb-linear …)` / `color(xyz-d50|xyz-d65 …)`, `none` components included; it returns `null` rather than guessing when either side does not parse.
:::

::: details Gradient specs
An authored gradient is **one URL-safe string**: `lin_90_30ba78-0_efefef-100` is "linear, 90°, brand green at 0%, fog at 100%". A gradient has to survive the same round trip every other input does (editor, block row, shared link, CLI, identical render). The grammar is `<kind>_<angle>_<colour>-<pos>_<colour>-<pos>…`:

- **Kind**: `lin` / `rad` / `con` (or the long `linear`/`radial`/`conic`).
- **Interpolation space**, as a dot suffix on the kind: `lin.srgb`, `lin.oklch.longer`. The spaces you can name are `oklab` (the default), `oklch`, `lab`, `lch`, `srgb`, `srgb-linear` and `hsl`; a polar space takes an optional hue travel (`shorter` default, `longer`, `increasing`, `decreasing`). The list is closed, so a typo reads as "unknown" rather than quietly picking a space nobody meant.
- **Angle** in degrees, CSS convention: `0` is to the top, `90` to the right. It is the gradient line for `linear`, the `from` angle for `conic` and unused for `radial`.
- **Stops**: up to 12, each a bare hex (`30ba78`, no `#`), a CSS colour name or `transparent`, then `-<pos>` in percent. Parsing is lenient (a leading `#`, an `@` separator, a missing angle, unpositioned stops and upper case all read fine) and writing is strict, so the round trip is byte-stable. Fewer than two usable stops answers `null`; a caller should fall back to a flat fill rather than paint something half-specified.

Read and written by `parseGradientSpec` / `formatGradientSpec` in the engine, and baked to CSS by `gradientCss`. The Design tool's per-box gradient fill is the reference consumer.
:::

## Pictures and pixels

### `host.images`

*Optional, v1.60.* Decode, resize and re-encode: the "HEIC to JPEG, compress to WebP, downscale" job as a first-class API. Encoded bytes (or a Blob) go in, and encoded bytes plus dimensions come out, so the shell owns the codec and the engine never sees a canvas or an `<img>`. Fall back gracefully where it is absent.

| Method | Returns | Notes |
|---|---|---|
| `decode(input)` | `Promise<ImageInfo>` | Pixel dimensions (EXIF-**oriented**) and a MIME type sniffed from the bytes, never from a filename. Rejects on bytes this shell cannot decode |
| `resize(input, opts)` | `Promise<ImageResult>` | Downscale with the aspect kept; it **never upscales**. `maxEdge` caps the longest edge; explicit `width`/`height` fit within that box |
| `encode(input, opts)` | `Promise<ImageResult>` | Re-encode at full oriented size. `format` is `webp` · `jpeg` · `png`, a narrower set than it can *read* |

An animated source flattens to its first frame. Read the *result's* `mime`, `width` and `height` rather than assuming the request was honoured, because a shell may fall back (PNG where WebP encoding is unsupported).

### `host.raster`

*Optional, v1.105.* The sibling of `host.images` for tools that composite, sample or change pixels *themselves* (Darkroom, the Filter tool, the logo composers, Redact). Where `images` converts bytes to bytes with no pixel access, this hands back drawable pixels. Fall back to your placeholder where it is absent. The headless CLI provides it when the optional Skia canvas (`@napi-rs/canvas`) resolves, which is what lets `lolly redact` repaint pixels locally; on a lean install without it the member stays undefined.

| Method | Returns | Notes |
|---|---|---|
| `canRaster()` | `boolean` | A realm-correct, **synchronous** capability probe. The reliable replacement for a hand-rolled `typeof document === 'undefined'`, which reports false inside a Worker where rastering works fine |
| `measure(src)` | `Promise<ImageInfo>` | Oriented dimensions and sniffed MIME, the same shape `images.decode` returns |
| `decode(src)` | `Promise<ImageBitmap>` | A drawable bitmap: EXIF baked in, HEIC/AVIF through the shell's fallback, SVG through its reliable path, all behind a decode-bomb guard. Valid on a main-thread `<canvas>` **and** a Worker `OffscreenCanvas`, unlike an `<img>`. Call `.close()` when done |
| `encode(source, opts)` | `Promise<ImageResult>` | Finished pixels to bytes. Takes an `ImageBitmap` (the cheap path, when you only composited) or a `RasterFrame` of raw RGBA (when you pulled pixels to do your own maths; a live `MediaFrame` passes straight through) |

`src` is a URL (including `blob:`/`data:`), an `AssetRef` or raw bytes or a Blob. Building and drawing *into* a canvas is left out of this API: `new OffscreenCanvas(w, h)` is a realm global a hook constructs directly, so a round trip through the host would buy nothing.

### `host.codec`

*Optional, v1.100.* Encode a float pixel frame into finished image bytes at real bit depth. It is the counterpart of `host.export.render`, which rasterises the DOM to 8-bit. A tool that computes its own high-precision pixels, such as a float grading pipeline or a renderer with real headroom, hands over a linear Float32 RGBA frame and gets back a 16-bit PNG, an OpenEXR or Radiance HDR master or an error-diffused 8-bit PNG, depths the browser's 8-bit canvas cannot originate. Fall back to the ordinary 8-bit export where it is absent. Darkroom is the reference consumer.

::: details `host.codec` members
A **`CodecFrame`** is `{ width, height, data: Float32Array, space? }`. `data` is RGBA interleaved, linear light, un-premultiplied and unbounded. `space` carries the working primaries with the buffer: `'srgb-linear'` (the default), `'display-p3-linear'` or `'rec2020-linear'`. The maths is the engine's own writers, so the shell only forwards, and web and CLI produce byte-identical output from the same frame.

| Method | Returns | Notes |
|---|---|---|
| `decode(source)` *(optional)* | `Promise<CodecFrame>` | Decode the original bytes into linear float pixels, never a preview |
| `preview(frame, exposure?)` *(optional)* | `Promise<RasterFrame>` | An SDR display transform for showing the frame; the frame itself is untouched |
| `compose(width, height, layers)` *(optional)* | `Promise<CodecFrame>` | Composite layers in linear light |
| `validate(frame)` *(optional)* | `Promise<void>` | Check dimensions, working space, finite samples and allocation limits |
| `png16(frame, opts?)` | `Promise<Uint8Array>` | 16-bit sRGB PNG: real per-channel precision, no HDR. `opts.dpi`, `opts.channels` (`3`/`4`) |
| `exr(frame, opts?)` | `Promise<Uint8Array>` | OpenEXR master. `opts.pixelType` (`'half'` default / `'float'`), `opts.channels` (`'rgba'`/`'rgb'`) |
| `radiance(frame, opts?)` | `Promise<Uint8Array>` | Radiance RGBE (`.hdr`) master. `opts.exposure` |
| `dither8(frame, opts?)` | `Promise<Uint8Array>` | Error-diffused (Floyd-Steinberg) 8-bit sRGB PNG from a deep source. `opts.dpi`, `opts.channels` |

The SDR encoders (`png16` and `dither8`) gamma-encode and clamp at their display boundary. `exr` and `radiance` keep the unbounded linear values. Every method is async, so a shell can move the encode to a Worker.

This pairs with a tool's **`exportStill`** hook. A tool declares `exportStill` in its manifest `hooks`, and the runtime calls it before `host.export.render` with `{ node, format, opts, host }`. Returning `{ bytes, mime }` short-circuits the export to those bytes (computed in float through `host.codec`). Returning `null` declines and falls through to the normal DOM raster path for that format, so a tool owns only the formats it has real depth for. Like the `exportFile` transform path, tool-supplied bytes carry no watermark and no engine provenance.
:::

### `host.layers`

*Optional, v1.102.* Write a set of positioned RGBA layers as a layered Photoshop **PSD** with the engine's own writer, so the file opens in Photoshop, GIMP and Krita. One method today. Like every `export.file` path, the result is never watermarked or provenance-stamped, because it is the person's own file.

| Method | Returns | Notes |
|---|---|---|
| `writePsd(doc)` | `Promise<Uint8Array>` | 8-bit RGB PSD. `doc` is `{ width, height, layers }`, layers **bottom to top** |

A `LayerWrite` is `{ name, x, y, width, height, pixels, opacity?, blend?, visible? }`: `pixels` is RGBA8, un-premultiplied sRGB (what a canvas `getImageData` gives), and `width`/`height` must match the buffer. `blend` takes a CSS `mix-blend-mode` value. The read side is **not** part of this API: PSD and XCF *import* is a shell ingest flow (the drop router turns each layer into a library asset), not something a running tool does.

### `host.scan`

*Optional, v1.153.* Find machine-readable codes (QR, Data Matrix, Aztec, PDF417 and the 1D families) in one RGBA frame. The web shell uses the browser's `BarcodeDetector` where present and a zxing-wasm decoder otherwise; the CLI and TUI load zxing-wasm from disk. Pair it with `host.media` for a live viewfinder, or use it alone on a still image. The Scan tool (`scan-code`) is the reference.

| Method | Returns | Notes |
|---|---|---|
| `formats()` | `string[]` | The formats this shell can decode now, in `BarcodeDetector` naming (`qr_code`, `data_matrix`, `ean_13`, …). Synchronous. The set can grow after the first `detect()`, so read it as "at least these" |
| `detect(frame, opts?)` | `Promise<ScanHit[]>` | Every code found in a `{ data, width, height }` RGBA frame (a live `MediaFrame` or a decoded still); an empty array when there is none. `opts.formats` narrows the search |

A **`ScanHit`** is `{ format, rawValue, rawBytes?, corners? }`. `rawValue` is untrusted input: show it, never act on it automatically. `rawBytes` is present when the content is not valid UTF-8, and `corners` is the code's quad for an overlay.

### `host.lift`

*Optional, v1.123.* `svg(source)` fetches and sanitises an SVG named by URL (a catalog asset, a `blob:` or a `data:` URL) and returns its layers in paint order as standalone SVG documents with their ink boxes, plus the source viewBox. A source that is not an SVG, or has fewer than two layers, comes back with `layers: []`; the method throws only on a fetch or parse failure. Turning layers into depth is the caller's job. The web and desktop shells provide it; the Node shells do not. Flythrough is the reference tool.

## Vector, layout and motion

### `host.geom`

*Optional, v1.64.* Path booleans, offsetting, stroke-to-fill outlining, pen-tool spline lowering, simplification and hit testing: the engine's geometry kernel, which keeps everything as real Béziers (nothing flattens, samples or rasterises). Every method is **pure and synchronous**, so a pen tool's geometry is identical in the browser, in Tauri and headless on the CLI.

The currency both ways is an **SVG path-data string**, which already lives in your template, your saved state and your URL. `parse` and `toPathData` expose the structured form (contours of whole cubics, 8 numbers each) for callers that want to walk or edit curves themselves.

**Failures are returned, never thrown.** Every method answers `{ ok: true, … }` or `{ ok: false, code, message }`, because a throw out of `onInit` or `onInput` is caught, logged and discarded by the runtime, which would leave a tool unresponsive rather than telling the person anything. A path result carries `{ d, contours, curves }`; a measurement result carries `{ value }`.

::: details `host.geom` members
| Member | Result | Notes |
|---|---|---|
| `union(paths, opts?)` | path | Everything any operand covers. `paths` is an array of `d` strings; one operand folds to its own canonical form |
| `paintAuthored(path, paint, width, height, prefix)` *(optional)* | `{ value }` string | Paint admitted contour metadata, using the authored path field as its only geometry |
| `intersect(paths, opts?)` | path | Only what every operand covers, folded left to right |
| `difference(paths, opts?)` | path | `paths[0]` minus every later one |
| `xor(paths, opts?)` | path | Covered by an odd number of operands |
| `selfUnion(d, opts?)` | path | Canonical form of ONE path: self-intersections resolved, holes wound opposite their shell, overlaps merged. Run it on a freshly closed path before filling. The only boolean that never reports `'limit'` |
| `offset(d, distance, opts?)` | path | Grow (`> 0`) or shrink (`< 0`). `opts`: `join` (`miter`·`round`·`bevel`), `miterLimit`, `tolerance` |
| `stroke(d, width, opts?)` | path | A stroked path in, a **filled outline** out (fills identically under the nonzero rule). Adds `cap` (`butt`·`round`·`square`); the defaults are SVG's own |
| `simplify(d, opts?)` | path | Fewer segments within `opts.tolerance` (default `0.01`px). For a *finished* path, never between booleans, which rely on output points lying exactly on their inputs |
| `fromNodes(authored)` | path | Lower `{ kind, nodes, closed, tension? }` to path data. Handles are **offsets** from the node (`hInX`/`hInY`/`hOutX`/`hOutY`); `kind` is a string the ENGINE validates, so a spline family added later needs no bridge change |
| `continuity(node, moved)` | node | Re-apply a node's `corner`·`smooth`·`symmetric` constraint after one handle moved (`'in'`/`'out'`), the operation a pen tool runs on every drag |
| `bounds(d)` | box \| `null` | Tight extent (the curves' real bounds, not their control hull) |
| `area(d)` | `number` | Signed and exact (Green's theorem per cubic). Positive is counter-clockwise in a y-up frame. Self-overlap gives the winding-weighted area; run `selfUnion` first for the filled one |
| `contains(d, x, y, opts?)` | `boolean` | Inside the fill, under `opts.fillRule` (`nonzero` default) |
| `winding(d, x, y)` | `number` | Signed wrap count; `contains` under nonzero is `winding !== 0` |
| `nearest(d, x, y)` | `{ x, y, distance, contour, curve, t }` | The nearest point ON the path, with the address that found it: hit test, snap and the `t` to split at to insert a node |
| `parse(d)` | contours | Every shorthand expanded: H/V → lines, Q/T → cubics exactly, A → cubics by the spec's endpoint parameterisation |
| `toPathData(contours, opts?)` | path | Straight pieces written as `L`; `opts.decimals` defaults to 4 |
| `limits()` | ceilings | `maxChars` / `maxCommands` / `maxCurves` / `maxCoordinate` / `maxPaths` / `maxNodes`; check a path before offering an operation on it |
| `encodeAuthored(path \| paths)` | string | One versioned, delimiter-safe string, so authored geometry survives an input value, a `blocks` sub-field and a share link unchanged |
| `decodeAuthored(value)` | authored paths | Always a list. `invalid-argument` on garbage or a newer format version; `too-large` past `limits().maxNodes` |

`code` on a failure tells you what to do: `'invalid-path'` (malformed `d`; reject it, do not retry), `'too-large'` (well-formed but past the ceilings above), `'limit'` (the answer exists and this engine declines to guess at it past its bounded-work ceiling; retry with simpler operands or a coarser `tolerance`), `'invalid-argument'`, `'unsupported'` (a spline kind this engine knows the name of but cannot lower yet) and `'internal'` (a bug; report the failure). **`ok: true` with `d: ''` is an answer**, not a failure: a non-overlapping intersection and an offset shrunk past its inradius are both legitimately empty. There is no degraded fallback anywhere in the API, so you are never handed a plausible-looking wrong path. Path data is parsed defensively (bounded size, command count, curve count and coordinate magnitude, with a grammar that rejects rather than guesses), so a `d` from a paste or a URL parameter is safe to hand straight in.
:::

### `host.connectors`

*Optional, v1.106.* Export-safe connector, line and arrow geometry: the engine's connector module behind a tool-facing surface, attached verbatim by every shell, so web, Tauri and CLI emit identical arrows. A canvas tool's `hooks.js` renders its connectors in one line, and a headless `--export` keeps them. Pure and synchronous, like `color` and `geom`. Everything below `build` is optional, so check for each member, not just the surface.

::: details `host.connectors` members
| Member | Returns | Notes |
|---|---|---|
| `build(edges, rectById, opts)` | `string` | The committed connector layer as an export-safe SVG string: every edge routed and decorated, wrapped in a canvas-sized `<svg>`. `rectById` maps a box id to its native rect; a free-point endpoint (`@x,y`) resolves without one |
| `pathHeadSvg(opts)` *(v1.110)* | `string` | An arrowhead or decoration fragment for **one** path tip, addressed by tip and outward tangent, so a spline, a line and a connector decorate identically. Baked coordinates, no transform, no `<marker>`, so it drops into any `<svg>` and survives the vector walkers |
| `pathHeadInset(head, width)` *(v1.110)* | `number` | How far to pull the shaft back off the head at stroke `width`, so a filled head is not stabbed through by its own line |
| `dashFit` *(v1.110)* | `DashFitAPI` | Manual dash entry plus corner-fit dash geometry |
| `routeStyleForKind(kind, override?, nodeCount?)` *(v1.111)* | `string` | The route a **bound** path is drawn with, from its own spline kind: `line` → straight (an authored polyline of 3+ nodes → elbow), `spiro` → arc, everything else → the smooth curved S. The box's explicit `route` field wins whenever it is one of `routeStyles` |
| `routeStyles` *(v1.111)* | `string[]` | The thirteen route styles `build` understands, in menu order, so a pack control and the editor offer one list |
:::

### `host.layout`

*Optional, v1.249.* `evaluate({ boxes, tracks? })` solves the Design tool's layout rules for a set of boxes and returns the solved `boxes`, any `findings` (`{ id, code, message }`), the number of `passes` and `solved` boxes, and the `grids` it laid out with their columns, rows and cells. The web, desktop, CLI and TUI shells provide the API. The Design tool is the reference consumer.

### `host.keyframes`

*Optional, v1.124.* `sample(kf, count)` evaluates a `kf` track (the format the Design tool's camera and every keyframed input use) at `count` evenly spaced times across its own span, and returns each pose as a channel-to-value map (`x`, `y`, `z`, `rx`, `ry`, …). The engine owns the parsing, interpolation and easing, so a template's motion matches the Design tool's; the template decides how the channels map onto its own scene. An empty or unreadable track returns `[]`. The web and desktop shells provide it; the Node shells do not. Flythrough is the reference tool.

## Documents and text

### `host.pdf`

Inspect a PDF, remove its metadata and make it smaller. The metadata and structural work is pure pdf-lib, so it runs even in the lean CLI; image recompression uses a browser canvas. `strip-data` and `compress-pdf` are built on this API. Check for each method (for example `host.pdf?.compress`): an older shell may provide `analyze` and `strip` but not `compress`, or no `host.pdf` at all.

::: details `host.pdf` members
| Method | Returns | Notes |
|---|---|---|
| `analyze(bytes)` | `Promise<{ findings }>` | Report the Info-dictionary and XMP metadata a PDF carries; read-only |
| `strip(bytes)` | `Promise<{ bytes }>` | Re-save with that metadata removed (re-serialised, so not byte-identical, and any signature is invalidated) |
| `compress(bytes, opts?)` | `Promise<{ bytes, before, after, images }>` | Re-save smaller: recompress oversized embedded JPEGs (canvas downsample and re-encode) and re-serialise with object streams. `opts.level` is `'light' \| 'balanced' \| 'strong'`; `opts.grayscale` drops colour. Text and vectors are untouched, and the result is never larger than the input. The lean CLI (no canvas) does the structural pass only |
| `redact(bytes, opts)` *(optional)* | `Promise<PdfRedactResult>` | Rasterise each page, burn in the given bars as opaque fills and build a new document from those images alone, so no text layer, font, annotation or metadata survives. Bars are in PDF points from the top of the page. Needs a canvas; the CLI provides it over `@napi-rs/canvas` |
| `pages(bytes, opts?)` *(optional)* | `Promise<PdfPagesResult>` | Each page as a self-contained SVG in PDF points from the top left, for a live preview to draw on. At most `maxPages` (default 40). The web shell provides it; the CLI does not |
| `organize(bytes, opts)` *(optional)* | `Promise<PdfOrganizeResult>` | Reorder, rotate, extract, delete, merge or split pages without rasterising them. Encrypted documents and XFA forms are refused by name |
| `fromImages(images, opts?)` *(optional, v1.262)* | `Promise<PdfImagesResult>` | A new PDF with one PNG or JPEG per page. JPEG data is embedded without re-encoding and its metadata is left out |
| `stamp(bytes, opts)` *(optional)* | `Promise<PdfStampResult>` | Place PNG or JPEG stamps at top-left PDF-point coordinates |
| `lock(bytes, password)` *(optional)* | `Promise<{ bytes }>` | Apply an AES-256 open password as the last step |
:::

### `host.pptx`

PowerPoint inspection and surgical rebranding (engine `1.58`). The shell unzips with fflate and injects its `DOMParser`, so the engine's OOXML reader and patcher need no zip or DOM code of their own. `rebrand-deck` is built on this API. Check for `host.pptx?.rebrand`, because an older shell may lack it entirely.

| Method | Returns | Notes |
|---|---|---|
| `inspect(bytes, opts?)` | `Promise<{ ok, slideCount, theme, colors, fonts, themeSuggestion? }>` | Read a deck: slide count, theme palette and fonts, plus the literal (not theme-linked) colours and typefaces found on slides. Pass brand `swatches`/`fonts` in `opts` to get nearest-brand suggestions per colour and font plus a suggested 12-slot theme. Never throws: unreadable input reports `ok: false`. All colours are `#RRGGBB` |
| `rebrand(bytes, plan?)` | `Promise<{ bytes, report }>` | Re-theme the deck surgically: swap the theme palette and fonts, remap hardcoded colours (`plan.colorMap`) and explicit typefaces (`plan.fontMap`), optionally strip embedded fonts. Everything else (charts, SmartArt, animations, media) passes through byte-identical. Throws on input that is not pptx |

### `host.prepare`

*Optional.* Inspect files for hidden data and personal values, then write copies with the replacements the person chose. Working values stay in memory, and the report leaves private values out. The web, desktop, CLI and TUI shells provide the API. Strip Hidden Data is the reference tool.

| Method | Returns | Notes |
|---|---|---|
| `inspect(sources, rules?)` | `Promise<PreparationInspection>` | Each source is `{ id, name, bytes, mime? }`. Reports scopes (with `inspected`, `partial` or `uninspected` status and their limitations), findings and replacement groups. `rules` adds literal or field values to look for |
| `apply(sources, inspection, choices, removeScopes?)` | `Promise<{ outputs, report, inspection }>` | Apply the chosen replacement per group (all occurrences, or listed finding ids). `report` records hashes, counts replaced and remaining and the limitations, without the private values; `inspection` is a fresh read of the outputs for local review |

### `host.compare`

*Optional, v1.189.* A bounded comparison of two immutable snapshots: text, structured data, YAML, tables or the reading units of a document. The shell resolves the sources; this API only compares what it is given. The web, desktop, CLI and TUI shells provide it, and the Compare view calls `run()`.

| Method | Returns | Notes |
|---|---|---|
| `run(request, options?)` | `Promise<ComparisonResult>` | Compare the sources in `request`. `options.signal` cancels. A refusal never implies the sources are equal |
| `visual(request, options?)` *(optional, v1.190)* | `Promise<VisualComparisonResult>` | Compare decoded preview pages pixel by pixel, aligned `native` or `fit`, with a channel `threshold` |

### `host.textTools`

*Optional, v1.191.* Portable text operations: the list a text utility offers, running one operation and highlighting code. The web, desktop, CLI and TUI shells provide the API, and the Text (`text-helper`) and Snippet tools are built on this API.

| Method | Returns | Notes |
|---|---|---|
| `operations()` | `Promise<TextOperation[]>` | Every operation, with its `id`, `label`, `group` (`Edit`, `Inspect`, `Convert` or `Generate`), search keywords and options |
| `run({ text, operation, options? })` | `Promise<{ text, format, notes, details? }>` | Run one operation. `details` holds observations, never proof of authorship or a root cause |
| `highlight(text, language?, options?)` | `Promise<{ html, language, truncated }>` | Syntax-highlighted HTML for a code sample |

## Sound, speech and camera

Five APIs cover sound and video, and each faces a different way:

| API | Direction | For |
|---|---|---|
| [`media`](#host-media) | Live frames in | A tool that reacts to the camera frame by frame |
| [`recorder`](#host-recorder) | A finished recording out | Recording the microphone, camera or screen to a file (permission-gated) |
| [`audio`](#host-audio) | A finished clip into numbers | Visuals that move with a clip, frame by frame |
| [`speech`](#host-speech) | Text into a clip, and a clip back into text | Voiceover and captions |
| [`viz`](#host-viz) | A shell-owned canvas | MilkDrop visualisations |

### `host.media`

*Optional, v1.4.* A live camera frame source for **motion-reactive** tools, such as a filter that responds to movement. It is progressive enhancement, not a gated capability: a tool offers a "live" control only where a camera exists and works as an ordinary still-image tool everywhere else, so do **not** list `camera` in the manifest's `capabilities`. Check for `host.media?.isAvailable()`. The web shell and Tauri (its webview) provide it through `getUserMedia`; the headless CLI does not.

| Method | Returns |
|---|---|
| `isAvailable()` | `boolean`: a camera is usable right now (a secure context) |
| `start()` | `Promise<void>`: begin the camera (prompts for permission); reference-counted |
| `stop()` | `void`: release one `start()`; the camera stops at the last release |
| `subscribe(cb)` | `() => void`: receive frames; returns an unsubscribe function |

A **`MediaFrame`** is `{ width, height, data: Uint8ClampedArray (RGBA), t }`: plain pixels, no DOM types, so the engine stays platform-agnostic, and the shell owns the `MediaStream`, the `<video>` and the grab loop, as it does for `capture`. `data` is valid only during the callback, so read it synchronously. Frames are downscaled and throttled, and pause while the document is hidden.

You rarely call `subscribe` yourself. Declare an **`onFrame`** hook and the runtime drives it once per camera frame; the shell's "Go live" toggle calls `runtime.startLive()` and `runtime.stopLive()`, and no camera outlives the tool. [Motion-reactive tools](/info/tool-hooks.html#motion-reactive-tools-onframe) has the pattern; the `filter` tool is the reference.

::: details `host.media.trim` options
`trim(bytes, opts)` cuts, converts or turns an uploaded audio or video file with the shell's own codecs, and resolves to `{ bytes, mime, container, durationBefore, durationAfter, lossless, report? }`. The web shell provides the method; the CLI does not, so check for `host.media?.trim`. The Trim tool (`community/trim`) is the reference.

| Option | Meaning |
|---|---|
| `start`, `end` | The range in seconds; an `end` of 0 means the end of the file |
| `container` | `keep`, `mp4`, `webm` or `gif` |
| `mute`, `audioOnly` | Remove the sound, or keep only the sound as `m4a`, `opus` or `wav` |
| `output` *(v1.262)* | `clip` (the default), `poster` (the frame at `start`) or `contact-sheet` (frames spread across the range) |
| `image`, `sheetFrames` *(v1.262)* | `jpeg` or `png` for a poster or contact sheet; 4 to 36 frames on a sheet |
| `rotate` *(v1.262)* | 0, 90, 180 or 270 degrees clockwise, on top of the source's own orientation |
| `cut` *(v1.262)* | How a clip starts when `start` falls between key frames. `exact` (the default) starts at `start`: MP4 and MOV copy from the key frame before and write an edit list that tells players to skip the frames before `start`, and other containers re-encode the picture. `reencode` re-encodes the picture in every container, so nothing before `start` is kept. `keyframe` copies from the key frame before, so the clip may begin early. A picture re-encoded for another reason always starts at `start` |
| `maxShortEdge`, `targetBytes` *(v1.262)* | A sharing copy: the largest shorter edge in pixels (never enlarged) and a file size to aim for. A copy that already fits the size is kept; otherwise the picture is re-encoded at a bitrate meant to fit, never above the source's own |

From engine **1.262** the result carries a `report`, measured on the written bytes rather than predicted. `tracks` lists every source track as `copy` (the written packets are byte-identical to the source's), `re-encode` or `drop`, with stable reason codes such as `cut-between-key-frames`, `codec-not-in-container` or `rotation-needs-pixels` for the tool to put into words. `actualStart` and `keyFrameGap` show where the clip really begins, and `hiddenLeadIn` gives the seconds of picture an MP4 or MOV copy keeps before `actualStart` for players to skip, which editors and upload sites that ignore edit lists show. `sync` compares when sound and picture start and end against the same range of the source, within one frame or audio packet, and matches the two tracks packet for packet when both were copied. `orientation` checks the displayed size against the requested turn, `color` compares the declared colour information, and `target` says whether a size limit was met and how many files it took; the smallest is the one returned. A track the person kept is never left out without a word: when a browser cannot copy or re-encode a track, `trim` rejects with the reason.
:::

### `host.recorder`

*Optional, v1.17; capability `microphone`, `camera` or `screen`.* Record the microphone (and optionally the camera or the screen) to a finished media Blob, plus a DOM-free **level meter** for a sound check before recording. The shell owns `getUserMedia` and `MediaRecorder`, and the engine only ever sees plain numbers (`AudioLevel`) and finished Blobs, never a `MediaStream` or a `<video>`. Recording prompts for a permission a shell may be unable to grant, so it **is** gated: declare `"microphone"` (and `"camera"` for video) in `capabilities`. The headless CLI provides no recorder. `voice-recorder` is the reference tool.

::: details `host.recorder` members
| Member | Type | Notes |
|---|---|---|
| `isAvailable(kind?)` | `boolean` | Is capture of `'audio'` (default) / `'video'` / `'screen'` usable right now (a secure context)? A `true` does not pre-grant permission |
| `meter` | `MeterAPI` | A live input-level meter for a sound check (below) |
| `record(opts?)` | `Promise<RecordSession>` | Open a capture session (prompts the first time); resolves once recording |
| `still(opts?)` *(v1.54)* | `Promise<Blob>` | One frame as an encoded image: `'screen'` (default) prompts the display picker, `'camera'` takes a camera frame. DOM-free: the shell owns the stream and the grab |

`MeterAPI`: `start()` (begin the mic and level loop, prompting once; reference-counted and idempotent like `media`), `stop()` (release one `start()`; the mic stops at the last release) and `subscribe(cb) → () => void` (receive `AudioLevel` frames; throttled, paused while the document is hidden). The web shell opens the meter **raw**, with noise suppression, automatic gain and echo cancellation off, so the level and the noise cues reflect the real room. `record()` keeps suppression on for a clean file, so the two use separate streams (the grant is per origin, so a sound check then a recording still prompts only once).

`RecordOpts`: `audio` (default `true`), `video` (default `false`; an audio and video clip when `true`), `source` (`'device'` default, or `'screen'` to record the display, gated by the `screen` capability), `systemAudio`, `format` (`'webm' | 'mp4'`, a hint: the shell falls back across containers, so read the returned Blob's `type`), `maxEdge` (video downscale, longest edge in px), `frame` (v1.165, `{width, height}`, video only: the camera is cover-cropped and scaled into a canvas of exactly that size and the canvas is what gets recorded, so a take can match a target such as the artboard's export dimensions; the self-view shows the same framing), `maxMs` (a hard length ceiling; the session stops itself) and `meta` (provenance stamped into the Blob).

`RecordSession`: `subscribe(cb)` (live `AudioLevel` during the take, the same shape as the meter, so coaching updates while recording), `stop() → Promise<Blob>` (finalise and resolve the media Blob) and `cancel()` (discard and release the devices; no Blob).

An **`AudioLevel`** is the audio counterpart to `MediaFrame` (all amplitudes `0..1` linear except `dbfs`): `{ rms, peak, dbfs, clipping, t }`, plus the optional **v1.19** background-noise cues `noiseFloor` / `snr` / `hum` / `hiss`. A tool rarely subscribes itself: it declares an `onLevel` hook and the runtime drives it from the meter and the take. [Recording tools](/info/tool-hooks.html#recording-tools-render-capture-onlevel) has the `onLevel` pattern.
:::

### `host.audio`

*Optional, v1.71.* Decode a finished clip and get back a **per-frame reactivity track**: loudness, a bass, mid and treble split, a log-spaced spectrum, brightness, onset strength, a tempo, beat times and, if you ask, raw time-domain windows. It is the primitive behind visuals that move with the music rather than sweeping a playhead over a static shape. Where `host.recorder.meter` reports the **live** microphone one sample at a time, a tool *drawing* a clip needs frame 200's bass while it is still rendering frame 1. Fall back to a static waveform where it is absent.

::: details `host.audio` members
| Method | Returns |
|---|---|
| `isAvailable()` | `boolean`: a decoder exists here. Does **not** promise a given file decodes |
| `analyse(src, opts?)` | `Promise<AudioAnalysis>`: decode and analyse; rejects on unfetchable bytes or a missing codec |
| `decode(src, opts?)` | `Promise<AudioDecoded>`: optional, v1.246. PCM for a recorded clip, or the rendered audio of a computed one |
| `clean(src, opts?)` | `Promise<AudioCleanResult>`: optional. Decode, clean and re-encode a clip on the device: `denoise`, `normalize` to a loudness target, `trimSilence` and an `output` format. The result reports loudness before and after, true peak and the operations applied. The Node shells read and write WAV only; a container a shell cannot handle is refused by name |

`src` is a URL (including `blob:` / `data:`), an `AssetRef` or raw encoded bytes; the last lets a `file` input's in-memory upload be analysed without being stored first.

`AudioAnalyseOpts`: `fps` (analysis frames per second, default 30; match your export fps), `bands` (spectrum bins per frame, default 64), `buckets` (static overview columns, default 128), `start` / `window` (seconds; trim to the clip you are actually showing, clamped rather than erroring) and `samples` (**opt in** to raw time-domain windows of N samples per frame, rounded up to a power of two).

`AudioAnalysis`: `duration` (of the **whole** source, not the analysed window), `sampleRate`, `channels`, the `start` / `window` / `fps` actually used, `peaks` (the overview waveform), `frames`, `bpm` and `beats`.

`AudioFrames` is **struct-of-arrays**, indexed by frame (a minute at 60fps is 3,600 frames, and a draw loop wants flat typed arrays, not 3,600 objects): `count`, `bands`, `samples`, then `t`, `rms`, `peak`, `bass`, `mid`, `treb`, `centroid` and `flux` (one entry per frame) and `magnitude`, `wave`, `waveL` and `waveR` (`count` consecutive rows; row *i* of the spectrum starts at `i * bands`).

Design around three behaviours:

- Everything is normalised `0..1` across the analysed window **except `peak`**, which stays absolute so you can still tell that a source clipped. Normalisation is what lets a quiet voice memo and a mastered single both fill the frame.
- `bass` / `mid` / `treb` share **one** scale, so they read as a balance. Normalised separately, a bass-only clip would report treble pinned at 1.0.
- **`bpm` is `null` when there is no rhythm to find**, and that is the common answer for speech, ambience and pads. Never treat null as 120: a visual built on a wrong beat grid looks far worse than one built on none.

The shell owns the decoder; the maths is the engine's `analysePcm`, attached rather than reimplemented. What differs is *coverage*: the web shell gets everything `decodeAudioData` supports, while the Node shells (CLI and TUI) decode **WAV**, Lolly's own **ZzFXM** songs and **rondocode** songs (rendered in a `worker_threads` Worker the shell can stop), and refuse anything needing a platform codec by name, rather than calling whatever ffmpeg happens to be on `PATH`.

**Computed audio.** `decode` returns `{ sampleRate, channels, seconds, findings, run }`, one `Float32Array` per channel. For a recorded clip that is the decoded file. For audio that is computed rather than recorded, the shell renders the source first: a rondocode song (an asset of format `rondo`, its `.rondo.json` bytes or a `https://rondocode.com/#s=` link), a ZzFXM song or a tracker module. `opts.seconds` sets the length of a computed source; a rondocode song renders exactly that long, or its own arrangement when no length is asked for. A song's code never runs in the tool's realm. The song runs in the `vm` execution class (QuickJS in WebAssembly, `packages/rondo`), and `run` records that class with the renderer's version and seed, so a tool can credit what made the sound. `findings` lists each part the shell could not play and why: a sung part without the voice models, a live microphone, a sample loaded into the editor and not saved with the song. Silence is never passed off as a complete render. Check for `host.audio.decode`, because the method is optional.
:::

### `host.speech`

*Optional, v1.96.* Turn a tool's own text into spoken audio, with no upload: on-device Kokoro TTS returns mono PCM plus word timings, which a shell can play, mix under a video export or hand straight back to `audio.analyse`. The word timings are what a caption or karaoke-highlight tool keys off. Hide the voiceover control where it is absent. The headless CLI provides it too, over the same models on onnxruntime-node, so a hook that speaks its own text renders headless. `lolly speak` and `lolly transcribe` are its discovery surface there, and a model that is not staged refuses by name instead of downloading itself.

::: details `host.speech` members
| Method | Returns | Notes |
|---|---|---|
| `isAvailable()` | `boolean` | This shell can synthesise, possibly after a model download. Sync |
| `cached()` | `Promise<boolean>` | Are the model bytes already on the device? Never downloads |
| `modelBytes()` | `number` | Approximate one-time download size, for a consent interface |
| `voices()` | `Promise<SpeechVoiceInfo[]>` | The voices the model can speak in |
| `synthesize(text, opts?)` | `Promise<SpeechResult>` | Text in, spoken PCM plus word timings out |

A **`SpeechResult`** is `{ pcm: Float32Array, sampleRate, duration, words, granularity }`. `sampleRate` is `24000` for Kokoro. `words` is an array of `{ text, start, end }` spans in seconds. `granularity` is `'word'`, `'sentence'` or `'none'`; check it rather than inferring alignment from span lengths. `SpeechSynthesizeOpts` takes `voice` (a `SpeechVoiceInfo.id`), `speed` (a rate multiplier; `1` is the natural pace), `signal` (an `AbortSignal`) and `onProgress`. An abort rejects the promise promptly with `AbortError`. An abort during the first-use download still lets the download finish in the background and cache, so the next request starts warm.

Transcription (v1.99) is the reverse: audio in, text plus word timings out, through on-device Whisper. The STT model is a separate download from the TTS model, gated by its own consent.

| Method | Returns | Notes |
|---|---|---|
| `transcribeAvailable()` | `boolean` | This shell can turn speech into text. The CLI omits it for now |
| `transcribeCached()` | `Promise<boolean>` | Are the STT model bytes already on the device? |
| `transcribeModelBytes()` | `number` | Approximate one-time STT download size |
| `transcribe(src, opts?)` | `Promise<SpeechTranscript>` | Audio in, text plus word timings out |

`src` is an `AudioSource`, the same URL / `AssetRef` / raw-bytes union `host.audio.analyse` takes. A **`SpeechTranscript`** is `{ text, words, lang, granularity }`. `lang` is the BCP 47 tag the model detected or was told, and `granularity` is `'word'` or `'segment'`. The timed spans match the shape synthesis emits, so caption code reads either source unchanged.
:::

### `host.viz`

*Optional, v1.72.* Availability and attribution only. A tool is data: it has no element to hand over and no business holding a GL context, so it renders a `[data-lolly-viz]` placeholder carrying its parameters, and the **shell** owns the canvas behind that placeholder. That is the same contract `[data-lottie-src]` uses, and it lets the context and its loaded preset survive the `innerHTML` rebuild every keystroke causes. A shell without this, or without WebGL2, means the tool draws its ordinary canvas style, never that it refuses to render.

| Method | Returns | Notes |
|---|---|---|
| `isAvailable()` | `boolean` | Synchronous, so a hook can branch on it before deciding what to analyse |
| `presets()` | `Promise<VizPresetInfo[]>` | Lolly's own first, then the artist pack; empty when that pack is not staged in this build |

A `VizPresetInfo` is `{ id, name, author, calm }`. `author` is not decoration: twenty years of MilkDrop craft ships alongside Lolly's own presets, so credit only a preset the shell **confirms** it has. Naming an artist whose work is not on screen is worse than crediting nobody. `calm` marks a preset safe to offer under reduced motion.

## Reaching outside the tool

### `host.net`

*Capability `network`.* `fetch(url, init?) → Promise<Response>`, an allowlisted fetch. Absent unless the tool declared `"network"`, and tools without it have **no supported network path**. For a hook that runs in the page realm that is a review rule, not a sandbox; a hook in a strict Worker has no network globals at all (see [Where hooks run](#where-hooks-run) and the [Threat model](/info/threat-model.html#trust-boundaries)). [Network access](/info/tool-hooks.html#network-access-host-net) covers the allowlist.

### `host.capture`

*Capability `capture`.* Rasterise a live URL to an image with a real browser engine. Only shells with an authoritative engine fulfil it: Tauri's webview, a headless-Chromium CLI or the browser extension. The plain web app cannot read cross-origin pixels, so it exposes a stub that throws. Capture is slow and has side effects, so call it from an explicit action, not on every keystroke. The `url-shot` tool calls `page()`.

| Method | Returns |
|---|---|
| `page(spec)` | `Promise<AssetRef>` |
| `vector(spec)` *(optional, v1.45)* | `Promise<AssetRef>` |

::: details `CaptureSpec` and vector capture
`CaptureSpec`: `{ url, width, height?, scrollDepth?, rangeTo?, waitMs?, dpr?, css?, crop?, isolation? }`. `page()` returns a raster `AssetRef` (`source: 'remote'`) that flows through the normal export path.

`isolation: 'isolated-public'` requests a fresh disposable browser session that reads public HTTP(S) resources without saved credentials. A host that cannot enforce this mode must refuse. The desktop implementation reads GET and HEAD through a checked, pinned network reader and refuses workers, sockets and child frames. Strict untrusted hooks receive this mode automatically where supported. Existing hook deadlines still apply; a slow page can exceed its caller's hook budget before the native capture deadline.

Windowing and vector capture (v1.45):

- `scrollDepth` frames a region (a 0..1 fraction of scroll height, or a px offset when > 1); `rangeTo` extends the shot *down* the page to that scroll position, producing a tall strip, the frame a scroll animation pans over. `crop` trims insets (each a `0..0.9` fraction). The returned ref's `width`/`height` are the **actual captured box** after crop and extension, so size your composite from the *result*, never the request. Hosts may also report `meta.pageWidth`/`pageHeight`/`scrollYPx` (treat them as optional).
- `vector(spec)` prints the URL to a **true vector** SVG `AssetRef` (`type: 'vector'`): geometry, not pixels, crisp at any zoom and re-editable, at the cost of pixel-perfection (webfonts resolve by family name). Same windowing as `page()`. Check for `host.capture.vector` and fall back to `page()` where it is absent.
:::

### `host.compose`

*Capability `compose`.* Render another tool's output to an embeddable asset: **tool composition**, or nested exports. The runtime resolves a manifest's `composes` entries through it and exposes each as `{{asset <id>}}`, so you rarely call it directly. A shell that cannot render a child to bytes (the no-raster CLI for a raster child, for example) leaves it out, and composition degrades gracefully.

| Method | Returns |
|---|---|
| `render(spec)` | `Promise<AssetRef>` |
| `renderUrl(url, opts?)` | `Promise<AssetRef \| null>` |

::: details `ComposeSpec` and pasted tool links
`ComposeSpec`: `{ toolId, inputs, format?, width?, height?, unit?, dpi?, transient?, settleMs? }` (`width`/`height` are in `unit`: `px` by default, or `mm`/`cm`/`in`/`pt`). The last two arrived in **v1.5**. `transient: true` skips the host's render cache entirely for a one-shot bake (a design import turning 30-odd scenes into stored assets), which means the *caller* owns the returned `url` and must release it once the bytes are copied. `settleMs` shortens the wait after mounting before the child is captured, for a child you know carries no images, Lottie or video to decode (advisory; a host may clamp or ignore the value).

`render` returns an `AssetRef` whose `url` is a `blob:` or `data:` URL, so the embedded render behaves like any other asset: an **SVG** child stays a true vector through the parent's SVG and PDF exports (and rasterises crisply for PNG), while **raster** children (`png`/`jpg`/`webp`) embed as images. SVG is the format the declarative `composes` path is built for. The `icon` tool calls `render` from its `exportStill` hook with `transient: true` to bake each member of an icon kit. The child render is guarded against depth and cycles and is never watermarked or provenance-stamped, because it is an intermediate. [Authoring Tools](/info/authoring-tools.html) has the `composes` manifest shape.

`renderUrl(url, opts?)` is the **end-user** counterpart to `render`, added in **engine v1.3**, so check for `host.compose?.renderUrl`. When a person pastes a Lolly tool *link* (an embed URL, a hash share route or a pretty path) into an asset picker, the host parses it against the tool's manifest (typed inputs coerce exactly as [URL mode](/info/url-mode.html) would), renders that tool and returns an `AssetRef` whose `id` is the **canonical embed URL** (`https://lolly.tools/tool/<id>.<ext>?…`). That id *is* the asset's persistent identity: it round-trips through URL mode and saved sessions, and the runtime feeds it back here to re-render on load, so a tool-sourced image survives a reload and travels inside a shared link, like a library asset id. `ComposeUrlOpts` (`format` · `width` · `height` · `unit` · `dpi`) overrides take precedence over anything parsed from the URL and are folded into the returned id. Like `render`, the child is never watermarked or provenance-stamped. It returns `null` when the URL is not a recognised tool URL or the tool cannot render (the caller leaves the slot empty); a pasted link can only render a tool that already ships in this build.
:::

### `host.models`

*Optional, v1.246.* Hand a tool the bytes of named files of an on-device model family. It is for a tool that runs a model in a context of its own, where the shell's model store is out of reach: the Rondocode utility's editor frame has an opaque origin, with no IndexedDB and no network of its own, so it asks here for the singing models its songs need. The web and desktop shells provide it; the Node shells do not.

| Method | Returns | Notes |
|---|---|---|
| `files(family, paths, opts?)` | `Promise<Record<string, Uint8Array> \| null>` | The bytes of each path, keyed as asked. `null` when the person declines the download or an AI policy forbids the family |

The shell decides everything about the download. When a named file is not on the device, it offers the family's download in place first, with the size and the licence facts, and nothing moves until the person says yes. A download made there is the same download Settings offers under **Available offline**, so Settings shows it as downloaded afterwards. A family tools may not read, or a path that is not one of the family's files, is refused by name: the promise rejects. Each value is the only view of its own `ArrayBuffer`, so the caller can transfer `bytes.buffer` to a frame without a copy.

::: details Which families a tool can read
Only `sing` is readable: rondocode's singing models, named by their path in the family (`rondocode/vec-768.onnx`, `supertonic/onnx/tts.json`, `supertonic/voice_styles/F1.json`). The download in Settings is the int8 path with all three voices, about 1.1 GB. The full-size aligner and the full-size Supertonic vector estimator and vocoder are fallbacks: asking for one that is not on the device brings up a consent line of its own, with its size. `runtime/<file>` asks for the onnxruntime-web WebAssembly binary the shell itself runs (`runtime/ort-wasm-simd-threaded.jsep.wasm`), for a frame that cannot load the shell's `/ort/` files. That binary matches the shell's own onnxruntime-web version, so the caller's bundled glue must be the same version. `ModelFilesOpts` takes `reason` (a short phrase the offer shows after "needed for:"), `onProgress` (`{ loaded, total }` for whatever is moving: the download first when one is needed, then the read) and `signal` (an `AbortSignal`; the call rejects with `AbortError` between steps).
:::

## On-device AI models

Three APIs run a model on the device: `upscale` enlarges a picture, `matte` cuts out its subject and `ocr` reads its text. They share one pattern. The shell owns the ONNX runtime, the one-time model download (made only with the person's consent) and the memory bound, and the tool only ever sees pixels. A run can take many seconds on a weak device, so it is never driven from a time-boxed hook: a shell offers it as an explicit, cancellable action with progress, whose result becomes an asset. Hide the control where the API is absent.

The headless CLI provides `upscale` and `matte` too, with onnxruntime-node and sharp in place of the browser's runtime and canvas, so a hook that uses them renders headless. The member stays undefined on a lean install that carries neither, and a model that is not staged refuses by name rather than downloading itself. The CLI attaches `ocr` once the model weights are staged.

What each records in the file differs, because what each invents differs:

| | Upscale | Matte | OCR |
|---|---|---|---|
| What the model makes | New pixels | Only the alpha channel; every RGB pixel is the original | Text, with boxes and confidences; no pixels |
| What the file records | A C2PA credential naming the model, disclosed as the IPTC `compositeWithTrainedAlgorithmicMedia` source type: a real photo, AI-enhanced, never claimed as fully generated. The asset is flagged AI-generated | An edit step, `Background removed with <model> <version>`, with the original kept as a C2PA ingredient; not flagged AI-generated | Nothing: no asset, so no provenance |
| Backend in the web and desktop shells | onnxruntime-web on WebGPU, falling back to WebAssembly when a WebGPU session cannot start | WebAssembly only | WebAssembly only |

### `host.upscale`

*Optional, v1.101.* Enlarge a low-resolution raster with no upload. For the person whose headshot is 400px beside colleagues' 2000px photos, it enlarges theirs offline. The Node shells run onnxruntime-node on the CPU, and their `backend()` answers `null`. An **`UpscaleFrame`** is `{ width, height, data: Uint8ClampedArray }`: RGBA, 8-bit, straight alpha, the shape a canvas `getImageData` gives and `putImageData` takes.

::: details `host.upscale` members
| Method | Returns | Notes |
|---|---|---|
| `isAvailable()` | `boolean` | A backend and a Worker exist here. Sync |
| `backend()` | `'webgpu' \| 'wasm' \| null` | The resolved execution backend, or `null` before one is probed |
| `models()` | `UpscaleModelInfo[]` | The model catalogue: ids, sizes, licences, warnings. Sync and static |
| `modelBytes(id)` | `number` | Approximate one-time download for a model, for a consent interface |
| `cached(id)` | `Promise<boolean>` | Are a model's bytes already on the device? Never downloads |
| `canRun(src, opts?)` | `Promise<UpscaleFeasibility>` | Whether this device can do the job, before any bytes move |
| `run(frame, opts?)` | `Promise<UpscaleFrame>` | Upscale a frame. Rejects (`AbortError`) on `opts.signal`; never half-produces |

An **`UpscaleModelInfo`** carries `id`, `name`, `scale` (`2`/`4`), `approxBytes`, `license`, `attribution`, `version` and an optional `warning`. The models ship under permissive licences (BSD-3-Clause, Apache-2.0), so the shell carries their attribution in its credits. `version` is written verbatim into the C2PA disclosure. The model ids are `realesr-general-x4v3`, `realesrgan-x4plus`, `realesrgan-x4plus-anime` (for illustration and line art) and `gfpgan-v1.4`. GFPGAN is a face restorer, so it can invent facial detail that was never in the source. Its `warning` reads exactly `warning can invent face details` and its `facesOnly` is `true`.

`UpscaleOpts` takes `model`, `scale` (`2`/`4`), `denoise` (`0..1`, the general model only), `targetMaxEdge` (a hard cap on the output's longest edge), `signal` (an `AbortSignal`) and `onProgress`. When `canRun` answers `ok: false` the shell reads `reason` (`memory` / `no-backend` / `too-large`), `message`, `suggestedMaxEdge` and `suggestedModel`, then offers that choice rather than attempting the run.
:::

### `host.matte`

*Optional, v1.103.* Remove the background from a raster with no upload: a plain RGBA frame goes in and the same frame comes out with a model-computed alpha matte. The web and desktop shells run the matte models on WebAssembly only, because onnxruntime-web's WebGPU kernels reject an operation these models use. The result is a same-format cutout that keeps its metadata, colour and credential intact.

A **`MatteFrame`** is `{ width, height, data: Uint8ClampedArray }`: RGBA, 8-bit, straight alpha. On the way in the model reads only RGB and ignores alpha. On the way out the RGB is byte for byte the input's and the alpha is the computed matte, so the result composites directly.

::: details `host.matte` members
| Method | Returns | Notes |
|---|---|---|
| `isAvailable()` | `boolean` | A backend and a Worker exist here. Sync |
| `backend()` | `'webgpu' \| 'wasm' \| null` | The resolved execution backend, or `null` before one is probed |
| `models()` | `MatteModelInfo[]` | The model catalogue: ids, tiers, sizes, licences. Sync and static |
| `modelBytes(id)` | `number` | Approximate one-time download for a model, for a consent interface |
| `cached(id)` | `Promise<boolean>` | Are a model's bytes already on the device? Never downloads |
| `canRun(src, opts?)` | `Promise<MatteFeasibility>` | Whether this device can do the job, before any bytes move |
| `run(frame, opts?)` | `Promise<MatteFrame>` | Cut out the subject. Rejects (`AbortError`) on `opts.signal`; never half-produces |

Two models tier the picker: `u2netp` (U²-Net lite, ~4.5 MB, the default and the one that works on any subject) and `modnet` (MODNet, ~26 MB, tuned for people and weaker on everything else). Both ship under Apache-2.0. The roster leaves out the popular non-commercial models such as BRIA RMBG. It also **narrows** over time (`isnet-general` was retired in 2026-08, the BiRefNet pair in 2026-08), so read `models()` rather than hard-coding an id; a shell that no longer carries the id you pass falls back to its default and logs, rather than failing the run. `MatteOpts` takes `model`, `maxEdge` (a cap on the output's longest edge), `signal` and `onProgress`. `MatteFeasibility` mirrors `UpscaleFeasibility`: `ok`, `reason`, `message`, `suggestedMaxEdge` and `suggestedModel`.
:::

### `host.ocr`

*Optional, v1.127.* Read the text in an image: a plain RGBA frame goes in, and lines of text with boxes and confidences come out. Recognition is a best-effort read, so show the text as a draft the person can correct. OCR reads pixels, so signals carried by digital text (invisible characters, homoglyphs, a text watermark) do not survive the trip through pixels. The web and desktop shells provide the API.

| Method | Returns | Notes |
|---|---|---|
| `isAvailable()` | `boolean` | Sync |
| `backend()` | `'wasm' \| null` | Never `webgpu` |
| `models()` | `OcrModelInfo[]` | Ids, `fast` / `default` / `accurate` tiers, sizes, licences and languages |
| `modelBytes(id)` | `number` | Approximate one-time download, for a consent interface |
| `cached(id)` | `Promise<boolean>` | Are the model's bytes on the device? Never downloads |
| `canRun(src, opts?)` | `Promise<OcrFeasibility>` | The same shape as the upscale and matte answers |
| `run(frame, opts?)` | `Promise<OcrResult>` | `{ text, lines, lang }`, each line `{ text, confidence, box }`. `opts` takes `model`, `singleLine`, `minConfidence`, `signal` and `onProgress` |

## Provenance

Ordinary exports get their Content Credentials through `host.export`, which owns ingredients, action history and the opt-in gates. Two narrower paths exist for files a tool did not render: [`host.export.imprint`](#host-export) marks an existing raster with the Lolly Imprint, and `host.c2pa` signs finished bytes.

### `host.c2pa`

*Optional, v1.85.* Embed a **freshly signed** C2PA manifest into finished bytes. It exists for the redacted-derivative path, where carrying the source's manifest forward would re-embed a pixel-accurate thumbnail of the unredacted original, so the output is signed as a **new work** instead, and the caller says so in its interface. Check for `host.c2pa?.sign`. Signing uses the enrolled device identity when one is valid, else an ephemeral on-device key.

| Method | Returns | Notes |
|---|---|---|
| `sign(bytes, format, opts?)` | `Promise<Uint8Array>` | The stamped bytes. `format` is the output format key (`pdf`, `png`, `jpg`, `mp4`, `m4a`, …). Two modes: the default derivative path (no ingredients), and the v1.104 any-media authorship path, which stamps an existing file with the artist's author, copyright and licence and carries manifests already inside it forward as ingredients. **Throws** when the format cannot carry a manifest or signing fails; the caller decides whether unsigned bytes may still ship |
| `readIngredients(bytes)` *(v1.104)* | `Promise<IngredientCredential[]>` | Every manifest a file already carries, packaged ready to pass to `sign({ ingredients })`: the file's own container credential plus element-level credentials nested inside it (today, signed rasters an SVG embeds through `<image href="data:…">`). Read-only and **never throws**: a file with nothing signed resolves to `[]` |

## Where hooks run

Hooks are loaded with `new Function('host', …)`, with `host` injected as closure scope. That is a **portability contract, not a security boundary**. A hook that runs in the page realm can, in a browser shell, reach `window`, `document` and `fetch`; `host` is the only surface guaranteed to exist on every shell. Module imports do not work, because hooks ship as a single source string.

Hooks can also run in a Worker:

- **Verified built-in tools** ask for it with manifest `isolate: true`, and the web shell then runs their hooks in a Worker, falling back to the page realm if a Worker cannot start. [Run hooks in a Worker](/info/tool-hooks.html#run-hooks-in-a-worker-isolate) says how the flag is set.
- **On the CLI**, `LOLLY_HOOK_WORKER=1` runs every tool's hooks in a `worker_threads` Worker.
- **Sideloaded and remote tools**, in the web shell, always run in a strict Worker that fails closed rather than falling back, with an allowlisted `host` facade and no network or storage globals. A strict Worker is terminated when a hook overruns its budget.

Sideloaded and remote code never reaches the page realm. Verified built-ins and visibly unsigned development tools still can, and for verified built-ins the signed catalog is the trust boundary. See the [Threat model](/info/threat-model.html#trust-boundaries).

Async hook results are time-boxed, and a late `onInit` or `onInput` result can still apply. [Tool hooks](/info/tool-hooks.html) owns the budgets, the late-result rule and how export hooks fail. `afterExport`, the cleanup guarantee, is always awaited and its errors are only logged. `onFrame` and `onLevel` run once per frame or level sample and are not time-boxed; the runtime drops a sample if the previous one is still rendering.
