# Host API (HostV1)

The **capability bridge** is the versioned contract between a tool and whatever shell it runs in (web PWA, Tauri desktop/mobile, CLI). Tools call `host.*`; each shell implements the same surface its own way. This is what lets one tool run unchanged everywhere.

Tools receive `host` inside their **hooks** (`hooks.js`). They never touch the DOM outside their template, never `fetch` directly, never read storage directly — they go through `host`. See [Authoring Tools](/info/authoring-tools.html) for the tool anatomy and [Overview](/info/overview.html) for the bigger picture. The canonical definition lives in `engine/src/bridge/host-v1.ts`.

```js
function onInit({ model, host }) {
  host.log('info', 'tool booting', { shell: host.shell });
  // ... call host.profile / assets / state / clipboard / export / net / text
}
```

## Rules of the contract

- **Additive only.** Methods may be added in a minor version; never removed or signature-changed without a major bump. When v2 ships, v1 keeps working.
- **No platform-specific methods.** If only one shell can do something, it sits behind a `capabilities` flag in `tool.json` and shells that can't fulfil it expose a stub/error.
- **Capabilities gate access.** `net` (`network`), `capture` and `compose` require a matching flag in the manifest's `capabilities`. `tokens`, `text`, `pdf` and `media` are optional and present only when the shell provides them (feature-detect, don't flag). Declare what you need.
- `host.version` is `'1'`; `host.shell` is one of `web` · `tauri-desktop` · `tauri-mobile` · `cli`.

## `host.profile`

User details. Tools read; the user manages them via the host UI.

| Method | Returns | Notes |
|---|---|---|
| `get()` | `Promise<Profile>` | Current profile |
| `subscribe(fn)` | `() => void` | Calls `fn(profile)` on change; returns an unsubscribe |

`Profile`: `firstname, lastname, email, phone, city, country, headshot (AssetRef), custom, featureFlags` (`featureFlags` is the user's local UI flag map, default ON — not a tool concern). Most tools don't call this directly — declare `bindToProfile: "firstname"` on an input and the host pre-fills it for you.

## `host.assets`

The bridge to the catalog and the user's local images.

| Method | Returns | Notes |
|---|---|---|
| `get(id, opts?)` | `Promise<AssetRef>` | Resolve one asset (`opts.format`, `opts.version`); throws if missing |
| `query(filter)` | `Promise<AssetRef[]>` | Search the catalog |
| `pick(opts)` | `Promise<AssetRef \| null>` | Open the host's picker UI; `null` if cancelled |
| `isAvailable(id)` | `Promise<boolean>` | Is it cached/usable offline right now |

`AssetQuery` / `AssetPickerOpts`: `type` (`vector`·`raster`·`video`·`palette`·`font`), `namespace` (e.g. `suse/logo`), `tags` (AND), `includeDeprecated`; picker adds `title`, `allowUpload`, `current`. For an `asset`-typed input the host generates the picker from your manifest declaration — you usually don't call `pick()` yourself.

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

The host owns the renderer — tools don't bundle their own.

| Method | Returns | Notes |
|---|---|---|
| `render(node, format, opts?)` | `Promise<Blob>` | Rasterise/serialize a DOM node |
| `download(blob, filename)` | `Promise<void>` | Trigger a download (throws on CLI — pipe via `--output` instead) |
| `file(blob, opts?)` | `Promise<void>` | Deliver a blob the **tool** produced (the transform path: file in → transformed file out), with `opts.filename`. Carries no watermark and no provenance — for on-device utilities whose `exportFile` hook returns the bytes |

`format` is an `ExportFormat` — the render formats are `png · jpg/jpeg · webp · avif · svg · emf · eps · eps-cmyk · pdf · pdf-cmyk · cmyk-tiff · html · ico · zip · webm · mp4 · gif` (availability is per-tool via the manifest, and per-browser for the recorded video formats `webm`/`mp4` — Safari records mp4, Firefox webm; `gif` is encoded in-engine, and `ico`/`zip` are icon/bundle outputs). Separately, tools produce the **text/data formats** `md · txt · json · csv · ics · vcf` from the input model (not a DOM render — see [Exporting & Formats](/info/exporting.html)). This is the same 24-value enum the catalog validator enforces in `schemas/tool.schema.json`. *(The `ExportFormat` union in `engine/src/bridge/host-v1.ts` is itself stale — it carries a defunct token and omits the raster/bundle formats — and is being reconciled with the schema; track the schema, not the type.)*

`ExportOpts`:

| Field | Meaning |
|---|---|
| `width` / `height` | `number` = CSS px; `string` may carry a unit (`"210mm"`, `"8.5in"`, `"595pt"`) |
| `dpi` | Raster DPI for physical units (default 300; px → 96) |
| `scale` | Raster multiplier when width/height absent (1, 2, 3) |
| `quality` | JPG quality 0–1 |
| `background` | Override transparency |
| `watermark` | Forced `true` for experimental tools by the host (never for on-device utilities) |
| `meta` / `embedMeta` | Provenance metadata (auto-assembled; set `embedMeta:false` to skip — on-device utilities skip it automatically) |
| `colorProfile` | ICC handling: `'srgb'` (default raster), `'none'` to skip embedding, or a CMYK press condition for `pdf-cmyk` |
| `filename` | Suggested output filename |
| `thumbnail` | Hint that this is a low-fidelity preview, not the deliverable (skips provenance) |

See [Exporting & Formats](/info/exporting.html) for the user-facing view, and `engine/src/units.js` for the unit math.

## `host` — file inputs

A `file`-typed input (the user's own file, picked into memory) arrives as an **`InputFile`**: `{ __file: true, name, mime, size, bytes (Uint8Array), url }`. The hook reads `bytes` directly — there's no `host.*` call, because the bytes ride in the input value (the sandbox has no `fetch`). A `file` value never serialises to a URL and is never persisted. The `exportFile` hook transforms those bytes and returns `{ bytes, mime, filename }`, which the shell delivers via `host.export.file`. See [Authoring Tools](/info/authoring-tools.html) for the full pattern; `strip-data` is the reference.

## `host.net` *(capability: `network`)*

`fetch(url, init?) → Promise<Response>` — allowlisted fetch. Absent unless the tool declared `"network"`. Tools without it cannot reach the network at all.

## `host.text` *(text-to-path)*

Shape and outline a text run into an SVG path via HarfBuzz (correct kerning, ligatures, GPOS/GSUB). Optional — not all shells implement it (CLI has no DOM).

| Method | Returns |
|---|---|
| `toPath({ text, fontUrl, fontSize, features? })` | `Promise<TextPathResult>` |
| `preload(fontUrl)` | `Promise<void>` |

`TextPathResult`: `{ d, advanceWidth, bbox }` — baseline at `y=0`, Y-down; `bbox` is `null` for whitespace-only runs. The `brand-lockup` tool uses this to outline display type for crisp vector export.

## `host.tokens` *(optional)*

Design tokens (DTCG) for the active theme. The host UI sources colour-picker swatches from these, and the runtime resolves token-referenced input values against them.

| Method | Returns | Notes |
|---|---|---|
| `get(opts?)` | `Promise<TokenSet>` | Resolved token set for the active (or `opts.theme`) theme |
| `colors(opts?)` | `Promise<ColorSwatch[]>` | Colour tokens as picker-ready swatches |
| `resolve(ref, opts?)` | `Promise<unknown>` | Resolve a `{dotted.path}` alias (or bare path) to a concrete value |
| `themes()` | `Promise<{ name, group }[]>` | Theme names declared in the document |

Optional and additive — a shell without it just doesn't offer token-driven UI.

## `host.pdf` *(optional)*

On-device PDF inspection, metadata removal and compression (pure pdf-lib for the metadata + structural work, so it runs even in the lean CLI; image recompression uses a browser canvas). Used by `strip-data` and `compress-pdf`.

| Method | Returns | Notes |
|---|---|---|
| `analyze(bytes)` | `Promise<{ findings }>` | Report the Info-dictionary + XMP metadata a PDF carries; read-only |
| `strip(bytes)` | `Promise<{ bytes }>` | Re-save with that metadata removed (re-serialised — not byte-identical, and any signature is invalidated) |
| `compress(bytes, opts?)` | `Promise<{ bytes, before, after, images }>` | Re-save smaller: recompress oversized embedded JPEGs (canvas downsample + re-encode) and re-serialise with object streams. `opts.level` is `'light' \| 'balanced' \| 'strong'`; `opts.grayscale` drops colour. Text/vectors are untouched, and the result is never larger than the input. The lean CLI (no canvas) does the structural pass only |

Feature-detect each method (e.g. `host.pdf?.compress`) — an older shell may provide `analyze`/`strip` but not `compress`, or no `host.pdf` at all.

## `host.capture` *(capability: `capture`)*

Rasterise a live URL to an image using a real browser engine. Only shells with an authoritative engine fulfil it (Tauri's webview, a headless-Chromium CLI, or the browser extension) — the plain web PWA cannot read cross-origin pixels, so it exposes a stub that throws.

| Method | Returns |
|---|---|
| `page(spec)` | `Promise<AssetRef>` |

`CaptureSpec`: `{ url, width, height?, scrollDepth?, waitMs?, dpr?, css? }`. Returns a raster `AssetRef` (`source: 'remote'`) that flows through the normal export path. `url-shot` uses it. Slow and side-effectful — call from an explicit action, not on every keystroke.

## `host.compose` *(capability: `compose`)*

Render another tool's output to an embeddable asset — **tool composition** ("nested exports"). The runtime resolves a manifest's `composes` entries through this and exposes each as `{{asset <id>}}`, so you rarely call it directly.

| Method | Returns |
|---|---|
| `render(spec)` | `Promise<AssetRef>` |
| `renderUrl(url, opts?)` | `Promise<AssetRef \| null>` |

`ComposeSpec`: `{ toolId, inputs, format?, width?, height?, unit?, dpi? }` (`width`/`height` are in `unit` — `px` default, or `mm`/`cm`/`in`/`pt`). Returns an `AssetRef` whose `url` is a `blob:`/`data:` URL, so the embedded render behaves like any other asset: an **SVG** child stays a true vector through the parent's SVG and PDF exports (and rasterises crisply for PNG), while **raster** children (`png`/`jpg`/`webp`) embed as images. SVG is the only format used declaratively today — `event-name-badge` composes `qr-code` as `svg`. The child render is depth- and cycle-guarded and is never watermarked or provenance-stamped (it's an intermediate). Optional: a shell that can't render a child to bytes (e.g. the no-raster CLI for a raster child) just doesn't provide it, and composition degrades gracefully. See [Authoring Tools](/info/authoring-tools.html) for the `composes` manifest shape.

`renderUrl(url, opts?)` is the **end-user** counterpart to `render` — added in **engine v1.3**, so feature-detect `host.compose?.renderUrl`. When a user pastes a Lolly tool *link* (embed URL, hash share route, or pretty path) into an asset picker, the host parses it manifest-aware — typed inputs coerce exactly as [URL mode](/info/url-mode.html) would — renders that tool, and returns an `AssetRef` whose `id` is the **canonical embed URL** (`https://lolly.tools/tool/<id>.<ext>?…`). That id *is* the asset's persistent identity: it round-trips through URL mode and saved sessions, and the runtime feeds it back here to re-render on load — so a tool-sourced image survives reload and travels inside a shared link, like a library asset id. `ComposeUrlOpts` (`format` · `width` · `height` · `unit` · `dpi`) overrides take precedence over anything parsed from the URL and are folded into the returned id. Like `render`, the child is never watermarked or provenance-stamped. Returns `null` when the URL isn't a recognised tool URL or the tool can't render (the caller leaves the slot empty) — a pasted link can only render a tool that already ships in this build.

## `host.media` *(live camera — optional, v1.4)*

A live camera frame source for **motion-reactive** tools — a tool can react to a webcam stream frame by frame (e.g. a filter that responds to movement). Optional and additive (engine **v1.4**); feature-detect `host.media?.isAvailable()`. **Not** a gated capability — it's pure progressive enhancement: a tool offers a "live" affordance only where a camera exists and runs as an ordinary still-image tool everywhere else, so do **not** list `camera` in the manifest's `capabilities`.

| Method | Returns |
|---|---|
| `isAvailable()` | `boolean` — a camera is usable right now (a secure context) |
| `start()` | `Promise<void>` — begin the camera (prompts for permission); reference-counted |
| `stop()` | `void` — release one `start()`; the camera stops at the last release |
| `subscribe(cb)` | `() => void` — receive frames; returns an unsubscribe function |

A **`MediaFrame`** is `{ width, height, data: Uint8ClampedArray (RGBA), t }` — plain pixels, no DOM types, so the engine stays platform-agnostic (the shell owns the `MediaStream` / `<video>` / grab loop, mirroring `capture`). `data` is valid only for the synchronous duration of the callback, so read it synchronously; frames are downscaled + throttled and pause while the document is hidden.

You rarely call `subscribe` yourself. A tool declares an **`onFrame`** hook and the runtime drives it once per camera frame — it owns the start → subscribe → `onFrame` → re-render loop and **drops overlapping frames** so a slow per-frame render self-throttles. The shell shows a "Go live" toggle that calls `runtime.startLive()` / `runtime.stopLive()` (released on unmount, so no camera outlives the tool). See [Authoring Tools](/info/authoring-tools.html) for the `onFrame` pattern; the four `filter-*` tools are the reference. Web + Tauri (its webview) provide it via `getUserMedia`; the headless CLI does not.

## `host.log`

`log(level, msg, ctx?)` — `level` is `debug`·`info`·`warn`·`error`. Goes to the console in dev and a diagnostics buffer for support. Hook errors are caught and logged, not thrown.

## Sandbox

Hooks run in a sandboxed `Function('host', …)` scope: only `host` is in reach. **No** `window`, `document`, `fetch`, `localStorage`, or module imports. `onInit` is allotted 5s, `onInput` 2s; overruns and errors are logged, never fatal. `onFrame` (live camera) runs once per camera frame and is **not** time-boxed — keep it cheap; the runtime simply drops a frame if the previous one is still rendering.
