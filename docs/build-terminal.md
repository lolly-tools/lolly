# Build the CLI and TUI

This page is for a developer who wants to run Lolly from a terminal straight from a checkout, or package the command-line app for other machines. Running from source needs no build step: after [Get the source](/info/contributing-setup.html), both terminal apps work at once.

## Run them from the checkout

The CLI renders a tool from flags, the same way a share link sets a tool's inputs:

```bash
pnpm run cli                                   # list the tools this profile can see
pnpm run cli qr-code                           # show one tool's inputs
pnpm run cli qr-code --url=https://example.com --color=#0c322c --output=./qr.svg
pnpm run cli qr-code --url=https://example.com --export=png --output=./qr.png
```

The TUI is the same engine and render path under an interactive, keyboard-first interface built on Ink. It needs a real terminal, not a captured pipe:

```bash
pnpm run tui
```

The TUI keeps saved sessions, project folders and your profile on disk, in the directory all three local apps share: `$LOLLY_STATE_DIR`, else the desktop app's data directory when the app is installed on the machine, else `~/.lolly`. It saves exports to `~/Desktop` by default. The [TUI guide](/info/tui.html) has the full key map and views.

The CLI reads saved sessions from that same directory, so a session saved in the desktop app or the TUI loads there too. It writes there only when you set `$LOLLY_STATE_DIR`; otherwise a save lasts for that one run, so a plain render leaves no files behind.

## What renders without a browser

Most formats come straight from the engine. The rest need a paint tier: a Lolly desktop app on the same machine when one is running, otherwise a scoped headless Chromium that both terminal apps share.

::: cols
## Works with nothing extra

- SVG and SVGZ, EMF, WMF, EPS and DXF, for tools whose template is an `<svg>`
- PNG from those same tools, rasterised by resvg
- HTML and the text and data formats: JSON, CSV, ICS, VCF and Markdown
- `.penpot`, dotLottie, IDML, Premiere XML and JPEG XL, where a tool offers them
- Outlined static Design PDFs, with `--export=pdf --text=outline`

## Needs Chromium or the desktop app

- JPG and WebP
- Other PDFs and PPTX
- Video: GIF, APNG, WebM and MP4
- PNG of an HTML layout
- `url-shot` captures of a live web page
:::

[CLI rendering](/info/cli-rendering.html) holds the complete, current list per tier. ZIP is the one format the lean CLI leaves out, so a batch writes a folder instead.

To turn the browser tier on from a checkout, install Chromium once and build the web app the browser drives:

```bash
pnpm run install:browser   # Chromium into .browsers at the repository root
pnpm run build:web         # the web app the browser drives for pixel-identical output
```

An existing Chromium under `services/mcp/.browsers` is reused read-only if present, so a machine set up for the MCP render tier needs no second download. The browser starts only on the first export that needs it, never at startup. Without it, those formats fail with a setup message and the TUI writes HTML instead.

To point elsewhere, set `LOLLY_BROWSER_CHANNEL` or `LOLLY_BROWSER_PATH` for a browser you already have, or `LOLLY_WEB_BASE` or `LOLLY_WEB_DIST` for a running or prebuilt web app.

## Standalone binary

Package the terminal apps for machines that have no checkout. Run these from the repository root after `pnpm install`:

```bash
pnpm run pack:cli                          # an npm-compatible package with the CLI and TUI
pnpm run build:cli-sidecar                 # a native executable with its own Node runtime
node scripts/build-cli-sidecar.ts --install   # put those resources into the desktop app for packaging
```

**The npm package** is written to `dist/cli-pack/`, with a tarball and a manifest that records its source commit and checksum. Packaging installs it into a temporary project and checks version reporting, tool listing, SVG rendering, the missing-content error and the TUI entry.

**The native build** is written to `dist/cli-sidecar/bin/` and `dist/cli-sidecar/cli-lib/`. Keep both directories together. It uses Node's single executable application support for a small launcher, and the CLI and TUI stay as ESM resources beside it, so a single CommonJS bundle cannot replace that layout. It includes the matching resvg library. Build it on the target platform, or supply a matching Node runtime and native binding with the options in `scripts/build-cli-sidecar.ts`. The desktop release build runs the installer step for you.

Both forms need content. Set `LOLLY_ROOT` to a Lolly checkout or a materialised public content bundle; the package itself carries no brand pack or tool catalog. A packaged desktop app extracts its embedded content for its CLI. The package's version is independent of the desktop app's version.

Both forms include the TUI. Start it with `lolly tui` in a real terminal.
