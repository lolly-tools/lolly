# Driving Lolly from an AI agent

Give your model a **deterministic, reviewable creative layer** instead of asking it to hallucinate pixels. A tool invocation is just a **URL with parameters** — a few tokens that produce a press-quality, on-brand file, the same way every time. No image model, no creative drift, no data leaving the device.

## The model: a URL is the API

Every tool is fully described by its URL. The agent's job is to build that URL (or the equivalent CLI command) from structured inputs:

```
https://<host>/#/tool/<tool-id>?<input>=<value>&<input>=<value>
```

Open it and the tool renders with those inputs applied. Add reserved params to control output and trigger a download. Same inputs → same output, always — so results are reproducible, auditable, and version-controllable.

```
Use Lolly to generate the conference badge:
  tool: event-name-badge
  eventName: "KubeCon 2026"   firstname: "Ada"   lastname: "Lovelace"   company: "SUSE"
Return the file URL.
```

## Discover a tool's inputs

Don't guess parameters — read them. The tool's manifest (`tools/<id>/tool.json`) lists every input id, type, and default, or use the CLI:

```bash
npm run cli -- event-name-badge  # prints inputs, defaults, and supported formats
npm run cli                      # lists every available tool
```

Feed that schema to the model so it only emits valid inputs.

## Reserved parameters

These are the common ones; anything outside the full reserved set is a tool input. (Full reference: [URL Mode](/info/url-mode.html).)

| Param | Effect |
|---|---|
| `format` | Output format (`png`, `svg`, `pdf`, `mp4`, …) |
| `export` | Presence flag — render and **download immediately** on load |
| `copy` | Presence flag — copy the result to the clipboard on load |
| `width` / `w`, `height` / `h` | Output size (value in `unit`) |
| `unit`, `dpi` | Physical sizing (`mm`/`cm`/`in`/`pt`) + raster resolution |
| `bleed`, `marks` | Print bleed and crop marks |
| `profile` | Colour profile — raster ICC (`srgb`/`none`) or CMYK press condition |
| `filename`, `output` | Download filename / CLI output path |
| `password` | Lock the exported PDF |
| `_v` | Pin the tool version for stable output |
| `slot` | Open a saved session |

The complete reserved set also includes `full` and `options`; everything else is forwarded to the tool as an input.

So a one-shot, ready-to-download link is just:

```
/#/tool/qr-code?url=https://suse.com&format=svg&export
```

## Getting an actual file

- **Interactive / in a browser session:** append `&export` (or `&copy`) — the file downloads (or lands on the clipboard) on load.
- **Headless / server-side automation:** use the **[CLI](/info/cli.html)** — it's the same parameter surface and writes bytes to a file or stdout:

  ```bash
  npm run cli -- qr-code --url=https://suse.com/kubecon --color=0c322c \
    --export=svg --output=./qr.svg
  ```

  (The lean node CLI renders SVG and text/data formats; raster/PDF/video need the desktop-bundled build — see [CLI](/info/cli.html).)

  Pipe stdout straight into another step in your pipeline.

A few tools won't hand back a file this way:

- **Non-exporting utilities** (`color-palette`, `countdown-timer`, `strip-data`, `text-helper`) set `render.export: false` — `&export`/`&copy` are no-ops.
- **Experimental tools** (currently `bag-video`, `lockup`, `url-shot`) watermark every export until they're promoted, so their output isn't press-clean yet.
- **File-input tools** like `strip-data` transform the user's own bytes in memory; they need a file the agent can't supply through a URL (see the device-local note below).

## Why this beats prompting an image model

- **Quality doesn't drift.** Layout, type, colour, and spacing are structural — hard-coded by the tool author, not prompted. A lazy model can't degrade them.
- **Cheap.** A parameterised URL is a handful of tokens versus thousands for a brief + generation — and the result is production-grade.
- **Deterministic & auditable.** Every output is reproducible from its inputs; pin `_v` for byte-stable results across tool updates.
- **Private by default.** It runs on the device — no customer data sent to a third-party model or service.

## Tips

- **Pin `_v`** in automation so a tool update can't silently change output.
- **Compact encodings:** some tools define short `urlKey` aliases and tilde-delimited arrays to keep links short — see [URL Mode](/info/url-mode.html).
- **Validate against the schema** before emitting a URL; unknown params are ignored and bad input values fall back to defaults, so a malformed call fails quietly rather than loudly.
- **Device-local images** (user uploads) can't travel in a URL — agents should reference catalog assets by id, not local uploads.
- **One tool, many outputs:** change `format`/`unit`/`width` to emit the same design as SVG, print PDF, and social MP4 from one set of inputs.
- **Portable embed URL:** an agent can emit `https://lolly.tools/tool/<id>.<ext>?<inputs>` (image extensions `png`, `jpg`, `jpeg`, `webp`, `svg`) and drop it straight into HTML as an `<img src=…>`. It renders locally in the live web view — nothing is fetched from lolly.tools.
