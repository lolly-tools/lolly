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
- **Capabilities gate access.** `net` and `text` are optional and only present when granted. Declare what you need in the manifest's `capabilities`.
- `host.version` is `'1'`; `host.shell` is one of `web` · `tauri-desktop` · `tauri-mobile` · `cli`.

## `host.profile`

User details. Tools read; the user manages them via the host UI.

| Method | Returns | Notes |
|---|---|---|
| `get()` | `Promise<Profile>` | Current profile |
| `subscribe(fn)` | `() => void` | Calls `fn(profile)` on change; returns an unsubscribe |

`Profile`: `firstname, lastname, email, phone, city, country, headshot (AssetRef), custom`. Most tools don't call this directly — declare `bindToProfile: "firstname"` on an input and the host pre-fills it for you.

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

| Method | Returns |
|---|---|
| `render(node, format, opts?)` | `Promise<Blob>` |
| `download(blob, filename)` | `Promise<void>` |

`format` is one of `png · jpg`/`jpeg` · `webp · avif · svg · pdf · pdf-cmyk · html · md · txt · webm · mp4 · gif` (availability is per-tool via the manifest, and per-browser for video).

`ExportOpts`:

| Field | Meaning |
|---|---|
| `width` / `height` | `number` = CSS px; `string` may carry a unit (`"210mm"`, `"8.5in"`, `"595pt"`) |
| `dpi` | Raster DPI for physical units (default 300; px → 96) |
| `scale` | Raster multiplier when width/height absent (1, 2, 3) |
| `quality` | JPG quality 0–1 |
| `background` | Override transparency |
| `watermark` | Forced `true` for experimental tools by the host |
| `meta` / `embedMeta` | Provenance metadata (auto-assembled; set `embedMeta:false` to skip) |

See [Exporting & Formats](/info/exporting.html) for the user-facing view, and `engine/src/units.js` for the unit math.

## `host.net` *(capability: `network`)*

`fetch(url, init?) → Promise<Response>` — allowlisted fetch. Absent unless the tool declared `"network"`. Tools without it cannot reach the network at all.

## `host.text` *(text-to-path)*

Shape and outline a text run into an SVG path via HarfBuzz (correct kerning, ligatures, GPOS/GSUB). Optional — not all shells implement it (CLI has no DOM).

| Method | Returns |
|---|---|
| `toPath({ text, fontUrl, fontSize, features? })` | `Promise<TextPathResult>` |
| `preload(fontUrl)` | `Promise<void>` |

`TextPathResult`: `{ d, advanceWidth, bbox }` — baseline at `y=0`, Y-down; `bbox` is `null` for whitespace-only runs. The `lockup` tool uses this to outline display type for crisp vector export.

## `host.log`

`log(level, msg, ctx?)` — `level` is `debug`·`info`·`warn`·`error`. Goes to the console in dev and a diagnostics buffer for support. Hook errors are caught and logged, not thrown.

## Sandbox

Hooks run in a sandboxed `Function('host', …)` scope: only `host` is in reach. **No** `window`, `document`, `fetch`, `localStorage`, or module imports. `onInit` is allotted 5s, `onInput` 2s; overruns and errors are logged, never fatal.
