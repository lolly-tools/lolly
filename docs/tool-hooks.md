# Tool hooks and host capabilities

Most tools need no code: the template prints what people type. Add a `hooks.js` when the picture depends on a calculation the template cannot do, such as laying out a chart from a pasted table, encoding a QR code or reacting to a camera.

The Chart tool is a typical case. Its hook parses the pasted table, runs the layout and hands the template a finished list of shapes; the template only prints them.

![A treemap from the Chart tool - nested rectangles sized and placed by a hook, with the template only printing the shapes it was handed](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dtreemap%26full&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=at2-hooks-d3-treemap&try=1)

## How a hook works

A hook is a plain top-level function with a known name, such as `onInit` or `onInput`. Lolly calls each one at a known moment, passes it the current inputs and a `host` object and merges what it returns into the render:

- A key that matches a declared input `id` changes that input's value.
- Any other key becomes a computed value, an **extra**, that the template prints like an input.

```js
// Top-level functions are picked up by name. Declare the ones you need.
function onInit({ model, host }) {
  // Runs once when the tool opens. Return a patch to seed computed values.
  return { computedThing: derive(model) };
}

function onInput({ id, value, model, host }) {
  // Runs after every input change. Return a patch, or nothing.
  return { computedThing: derive(model) };
}
```

Flag each hook you define in the manifest's `hooks` object (`{ "onInit": true }`). A manifest with no `hooks` object never loads `hooks.js` at all, and validation and the shell read the flags, for example to wire the download for `exportFile`.

Hooks behave the same in the web app, the desktop apps and the command line when they use only `host.*`. [Host API](/info/host-api.html) lists everything `host` offers.

### When each hook runs

Async results are time-boxed. The budget in each step below is how long the runtime waits for a hook's promise before it moves on:

::: timeline
- <!--i:star--> **The tool opens: `onInit`, 5 seconds.** Runs once and seeds computed values.
- <!--i:sliders--> **Each edit: `onInput`, 2 seconds.** Runs after every input change, with the changed input's `id` and `value`.
- <!--i:download--> **An export starts: `beforeExport`, 5 seconds.** Adjust the node or call host APIs before the file is drawn. Receives `{ node, format, opts, host }`.
- <!--i:document--> **The tool makes the file itself: `exportStill` or `exportFile`, 10 seconds.** `exportStill` owns a raster still the 8-bit page render cannot make, such as a 16-bit or HDR PNG, OpenEXR or Radiance; it receives `opts` with depth, HDR, size and DPI, and returns `{ bytes, mime }`, or `null` to let the normal path draw that format. `exportFile` is the transform path for on-device utilities ([Assets and file utilities](/info/tool-files.html#producing-output-the-exportfile-hook-privacy-on-device)).
- <!--i:check--> **The export ends: `afterExport`, 5 seconds.** Runs after the file is made, for cleanup and chaining. Receives `{ node, format, blob, host }`.
:::

When a hook overruns, the runtime applies nothing at first, but the hook keeps running. A late `onInit` or `onInput` result **still applies when it arrives**, unless a newer `onInit` or `onInput` run has started since. Export hooks never apply late: a `beforeExport`, `exportFile` or `exportStill` overrun or error fails that export where people can see the failure. `afterExport` runs even when the render fails, so cleanup always happens; its overruns and errors are only logged. Errors in `onInit` and `onInput` are logged, never fatal. A synchronous overrun cannot be interrupted in the page, so it is measured and logged as a warning; in a Worker, an overrunning hook is stopped.

`onFrame` and `onLevel` run once per camera frame or audio sample, are **not** time-boxed and drop a sample while the previous one is still rendering. They are under [Live input](#live-input) below.

### What every hook receives

| Field | What it holds |
| --- | --- |
| `model` | The input model: every declared input with its current value. |
| `host` | The host bridge. |
| `lang` | The language the tool is rendering in, such as `de`; `en` when none is set. |
| `view` | Local presentation choices, when the shell sets any (below). |
| `report(patch, { ready })` | `onInit` and `onInput` only: publish an intermediate patch before the hook finishes. A report is ignored once a newer run has started. In `onInit`, `{ ready: true }` tells a view that shows partial renders that the document can be shown as it stands (engine v1.228). |
| `progressive` | `onInit` only: `true` when a view is showing reported patches as they arrive, so a partial render is worth sending. |

`onInput` also gets `id` and `value`, the input that changed. Three reserved ids mark runs the runtime starts itself: `'__view'` (a view change, below), `'__tokens'` (a theme or colourway change, below) and `'__emoji'`, which runs when the emoji set changes for a tool that drew emoji itself through `host.emoji.renderSvg`, `host.emoji.renderText` or `host.text.layoutRuns`.

## Reacting to the view and the design system

**View changes.** Engine v1.255 adds an optional `ctx.view` for local presentation choices. Design uses `ctx.view.pageId` to render the page the viewer chose while `ctx.model` keeps the whole document. A shell can call `runtime.setViewState()` to refresh that view through `onInput` with `id: '__view'`; the patch from this run can update computed extras but cannot write declared inputs. View state stays out of saved sessions, links, undo and collaboration. A one-shot document render leaves `pageId` absent and renders every page.

### When the theme or colourway changes

A person can switch a mounted tool to another theme or colourway from the sidebar's **Design system** section or Design's inspector, and the tool redraws in place. The shell calls `runtime.setTokenSelection()`. The runtime resolves every input linked to the design system again, runs `onInput` for each one whose colour moved, then runs `onInput` once more with `id: '__tokens'`, whether or not the tool links anything. `onInit` does not run again, because that would reset the person's inputs. As with `'__view'`, the patch from the `'__tokens'` run can update computed extras but cannot write declared inputs.

Colours that reach the template through a linked input or a `var(--brand-*)` variable follow the switch with no work from the hook. A hook that read colours from `host.tokens` and kept them, such as a palette, a paper colour or a set of treatment seeds, drops what it kept when `id` is `'__tokens'` and reads again:

```js
var palette = null;   // read once, because onInput runs on every keystroke

async function onInput({ id, model, host }) {
  if (id === '__tokens') palette = null;   // a theme or colourway switch: read again
  palette = palette || await readPalette(host);
  return draw(model, palette);
}
```

An isolated hook sees the new choice too: before any hook runs under it, the runtime hands the Worker a fresh copy of the design system through the executor's `tokensChanged`. Return a computed colour under a name of its own, never under the id of a declared colour input. Writing that id replaces the input's design-system link with a fixed colour, and the next switch leaves the colour behind. `tests/tool-theme-switch.test.ts` mounts every community tool, switches it live and checks that the render matches a fresh mount in the new choice.

## Live input

### Motion-reactive tools (`onFrame`)

Declare an `onFrame` hook and your tool can react to a **live camera**. The shell shows a **Go live** toggle wherever a camera is available (`host.media`), and the runtime calls `onFrame` once per frame with `{ frame, model, host }`, where `frame` is `{ width, height, data, t }` and `data` is RGBA pixels. Return a patch, as from `onInput`.

This is pure progressive enhancement: `onFrame` is never called where there is no camera, so the tool still works as an ordinary still-image tool. **Do not** add `camera` to `capabilities`, which would require a camera and hide the tool where there is none.

The usual move is to wrap the pixels in a canvas the still pipeline already understands and reuse it:

```js
function onFrame({ frame, model }) {
  const c = document.createElement('canvas');
  c.width = frame.width; c.height = frame.height;
  c.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
  return { svgContent: build(c, inputsFrom(model)) }; // same builder as onInit/onInput
}
```

Keep it cheap: `onFrame` is not time-boxed, but the runtime drops a frame while the previous one is still rendering, so an expensive render only lowers the frame rate. The `filter` tool's effects are the reference (halftone, scanline, posterise and duotone). Pixel tracers wrap the frame as above, while the SVG-filter duotone hands the frame back as a data-URL image. The `render` keys that tune the camera are under [Live camera](/info/tool-manifest.html#live-camera).

### Recording tools (`render.capture` + `onLevel`)

Set `render.capture` and the tool gets a **record** button that captures the person's microphone, camera or screen to a file, the audio and video counterpart to the `file` transform path. Four modes:

- `"audio"` - **microphone only**, for a voice recorder. Also shows a live input-level meter when the tool declares an `onLevel` hook.
- `"video"` - **camera only, silent**, with no microphone track.
- `"av"` - **camera and microphone**, for a talking-head recorder. Use it rather than `"video"` when the clip needs sound. The shell also mounts a coaching display for audio level and background noise.
- `"screen"` - **display capture** (engine v1.54). The shell mounts a Screenshot and Record pair, and the browser's own picker chooses the screen, window or tab, so the tool never sees a target it was not handed.

Recording asks for a device permission, so, unlike the live camera, it **is** a gated capability: declare `microphone` for `audio`, `camera` for `video`, **both** for `av` and `screen` for `screen`. The tool is then unavailable on shells that cannot record; the headless CLI provides no `host.recorder`. The recorded bytes reach the person through the transform path (`host.export.file`, never watermarked) or become a template asset that a compositing tool wraps.

```json
"render": { "width": 1080, "height": 1080, "formats": ["png", "svg"], "capture": "audio", "actions": ["download", "save"] },
"capabilities": ["microphone"],
"hooks": { "onInit": true, "onLevel": true }
```

**The `onLevel` hook** is a live level meter and sound check. The runtime calls it once per audio-level sample, from the meter before recording and again during the take, the same way `onFrame` handles camera frames: overlapping samples are dropped, and it is not time-boxed. It returns a patch, like `onInput`:

```js
function onLevel({ level, model, host }) {
  // `level` is an AudioLevel. Return a patch the template renders.
  return { barPct: Math.round(Math.min(1, level.rms / 0.5) * 100), tooHot: level.clipping };
}
```

::: details The fields of an `AudioLevel`
- `rms` - loudness from 0 to 1, the value a level bar follows.
- `peak` - the instantaneous peak, from 0 to 1.
- `dbfs` - the peak in decibels: `0` is clipping and `−∞` is silence.
- `clipping` - true while the peak sits at the "too hot" threshold, about 0.99.
- `t` - the sample's time.

Engine v1.19 adds four optional background-noise cues. Check for them first, because a shell that does not compute spectral levels leaves them `undefined`:

- `noiseFloor` - the level in the quiet gaps, in dBFS.
- `snr` - signal to noise in dB; about 15 dB or less means a noisy room.
- `hum` - from 0 to 1, the share of energy in the mains bands, a sign of electrical hum or a ground loop.
- `hiss` - from 0 to 1, the spectral flatness, a sign of broadband fan or air-conditioning hiss.

The noise cues are trustworthy only from the **raw** meter: the sound check runs the microphone with noise suppression and automatic gain off. A recording session turns them on for a clean file, so its noise floor reads lower than the room really is.
:::

`voice-recorder` (`capture: "audio"` with `onLevel` coaching), `record` (`capture: "av"`) and `screencap` (`capture: "screen"`, declaring `screen` and `microphone`) are the reference tools. The `host.recorder` bridge, with `meter` and `record`, is on [Host API](/info/host-api.html).

### Transcribing audio (`render.transcribe`)

Engine **v1.150**. Point at an audio or video input and a text input, and the shell mounts the whole speech-to-text feature for you: consent for the one-time on-device model download, a background job whose notice shows progress and offers cancel and one undoable write into the target input.

```json
"render": {
  "width": 1920, "height": 1080, "formats": ["png", "srt"],
  "transcribe": { "source": "clip", "target": "captions", "format": "srt", "auto": "autoCaption" }
}
```

- **`source`** - the id of the `asset` input holding the clip. While it is empty the button is disabled and says why.
- **`target`** - the id of the `longtext` or `text` input the result is written into. One write, so one undo.
- **`format`** - `"srt"` (the default) or `"vtt"` for numbered subtitle cue blocks or `"words"` for the plain spoken text, one cue per line with no timestamps.
- **`auto`** - the optional id of a `boolean` input. While it is on, a freshly recorded or picked clip is processed with no click. The consent sheet still appears the first time the model is not on the device.

Everything runs locally: the clip is decoded and read on the device, and nothing is uploaded. A clip with no speech writes an **empty value** and says so in the interface, never invented text. The declaration is feature-detected rather than capability-gated, so a shell without on-device speech, such as the headless CLI, mounts nothing and leaves the target input with the value the link or saved session gave. Pair it with a `template.srt` or `template.vtt` ([Data formats](/info/tool-rendering.html#data-formats-json-csv-ics-vcf)) to export the cues as a separate file.

## Network access (`host.net`)

Tools work offline first. By default a tool gets no `host.net`, so it has no supported way to reach the network. That is a contract checked in review, not isolation: [Portability and isolation](#portability-and-isolation) explains why. A live-data tool, such as weather, status, a news ticker or a calendar feed, opts in with two manifest declarations: the capability, and an explicit list of what it may fetch.

```jsonc
"capabilities": ["network"],
"network": {
  "allowlist": [
    "https://api.example.com/*",
    "https://example.com/status.json"
  ]
}
```

The allowlist rules:

- **`https` only.** Entries are full URLs; plain `http` never validates.
- **A bare entry allows exactly that URL**, including its query string.
- **A trailing `/*` makes an entry a prefix**: `https://api.example.com/*` allows everything under that path. The wildcard must follow a path separator (`/*`, never a bare `*`), so a prefix cannot spill into a lookalike host: `https://api.example.com*` would also match `https://api.example.com.evil.io/`.
- **1 to 32 entries.** Small on purpose: list the endpoints you call.
- **Closed when unsure, everywhere.** No `network` block, or a URL no entry matches, means every `host.net.fetch` rejects, the same way in the web shell, off-screen batch and gallery renders, the CLI and the TUI. The host applies the allowlist per mounted tool, and nothing a hook does can widen the list. Response bodies are capped at 64 MB, so a wrong or compromised endpoint cannot stream unbounded bytes into memory.

In a hook, `host.net.fetch` is an ordinary `fetch` behind that gate:

```js
async function onInit({ model, host }) {
  try {
    const res = await host.net.fetch('https://api.example.com/v1/status');
    if (!res.ok) return { statusText: 'unavailable' };
    return { statusText: (await res.json()).status };
  } catch {
    return { statusText: 'offline' }; // the tool must still mount without a network
  }
}
```

Keep fetches inside the hook budgets above, return extras the template can print as they are and always render something sensible when the fetch fails. A network tool that renders blank offline is a bug.

## Portability and isolation

`host.*` is the only surface every shell guarantees, so build on `host.*`.

- **Stay away from `window`, `document`, `fetch` and `localStorage`.** Hooks are loaded with `new Function` and `host` injected as closure scope, so in a browser shell those globals are technically reachable. Using them ties your tool to browser shells, breaks headless rendering in the CLI and rules out strict Worker execution; sideloaded tools already run strictly isolated. The `onFrame` canvas pattern above is a deliberate browser-only exception. That this injection is a portability rule and not a security sandbox is set out in the [Threat Model](/info/threat-model.html#trust-boundaries).
- **No module imports.** Hooks are loaded as one source string, so `import` does not work.

### Run hooks in a Worker (`isolate`)

A built-in tool can set `isolate: true` in its manifest (engine v1.105 and later) to ask the web shell to run its hooks in a Web Worker while the tool is open for editing. The executor keeps colour, geometry and design-token calls inside the Worker and forwards the other `host.*` calls to the shell. If a Worker cannot start, the shell runs the hooks in the page instead. The CLI runs hooks in a worker thread only when `LOLLY_HOOK_WORKER=1` is set.

Do not set the flag by hand. `node scripts/tool-isolation.ts --verify --write` sets it only when both checks pass: the hooks use none of the page-only globals a Worker lacks (`document`, `window`, `Image` and the like), and `lolly smoke` renders the tool byte for byte the same in the page and in a worker thread. A tool that later gains a page dependency fails `--verify` and loses the flag the same way.

The flag is a request. A sideloaded or remote tool always runs its hooks in strict isolation, whatever its manifest says, and refuses to run when isolation is unavailable.

### Shared helper regions (`community/_shared/`)

`hooks.js` must stay self-contained, because tools are data and cannot `import` or `require`. Helpers that several tools need, such as the filter overlay block, `canRaster`, `loadImage`, `esc`, `clamp` and `safeColor`, are kept once in `community/_shared/*.js` and copied byte for byte into each tool that uses them, between marker comments:

```js
// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run pnpm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===
```

Never edit inside the markers. Edit the shared file and run `pnpm run sync:shared`; `pnpm run validate:catalog` fails on any drift. `community/_shared/README.md` has the details.

## Newer optional host APIs (feature-detect)

The bridge grows by addition: new `host.*` APIs arrive in minor engine versions, are never removed and are optional, so an older shell may not have them yet. Check for an API, and keep the tool working when the API is missing. If your tool cannot work without one, list it in `requires` ([Tool manifests](/info/tool-manifest.html#what-the-tool-needs-from-the-host)) or raise the manifest's `engineVersion` floor, so the engine refuses the tool clearly instead of a method being missing. Three recent additions tools reach for:

- [`host.images`](/info/host-api.html#host-images-image-convert-optional-v1-60) - decode, resize and re-encode images on the device. Read the result's `mime`, `width` and `height` rather than assuming the request was honoured exactly.
- [`host.geom`](/info/host-api.html#host-geom-exact-vector-geometry-optional-v1-64) - exact vector geometry on SVG path strings: booleans, offset, stroke, simplify and measurement. Failures are returned, never thrown.
- [`host.text.fontUrl`](/info/host-api.html#host-text-text-to-path) - resolve a font family the host knows to a file for `host.text.toPath()`, with the `variations` a variable face needs. It resolves `null` when no file is found, so keep your `<text>` fallback.

The pattern for any of them is to check, try and render something sensible either way. With `host.geom`:

```js
function onInput({ model, host }) {
  if (!host.geom) return {};                      // older shell: leave the path alone
  const values = Object.fromEntries(model.map(i => [i.id, i.value]));
  const cut = host.geom.difference([values.shape, values.hole]);
  if (!cut.ok) return { pathError: cut.code };     // never silently wrong
  const outline = host.geom.stroke(cut.d, 4, { cap: 'round', join: 'round' });
  return { shapePath: cut.d, outlinePath: outline.ok ? outline.d : '' };
}
```

A throw out of a hook is only logged and discarded, leaving the tool silently unresponsive, which is why `host.geom` returns `{ ok: false, code, message }` instead of throwing.
