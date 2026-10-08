# Build the CLI and TUI

Run the terminal shells from source or package the CLI binary.

Part of [Build Guide](/info/build-guide.html).

## CLI

### Development use (no build needed)

The CLI shell runs directly from the repo with Node.js:

```bash
# List available tools
pnpm run cli

# Show inputs for a tool
pnpm run cli qr-code

# Run a tool and write output
pnpm run cli qr-code --url=https://suse.com --color=#0c322c --output=./qr.svg

# Explicit format
pnpm run cli quotes --quote="Open source wins." --name="Andy" --export=png --output=./quote.png
```

The CLI supports **SVG, EMF, EPS, HTML and the text/data formats** (JSON, CSV, ICS, VCF, MD, TXT) natively - hydrated by the engine with no browser engine needed (SVG/EMF only for tools with an `<svg>`-based template, since the lean CLI has no layout engine). **PNG** from an `<svg>`-based tool is also browser-free: resvg rasterises the engine's own SVG (Tier A). Outlined static Design PDFs also render without a browser with `--export=pdf --text=outline`, using the shared print/metadata finishing pass; unsupported documents retain the browser route. See [CLI rendering](/info/cli-rendering.html). The remaining paint formats - **JPG, WebP, other PDF and video (GIF, WebM, MP4)**, plus HTML-layout PNG - render through the CLI's own scoped headless Chromium (Tier B): install it once with `lolly install-browser`, then they export straight from the CLI. (ZIP is the one format the lean CLI leaves out - no zip dependency - so its batch writes a folder instead.)

### Standalone binary

Run these commands from the repository root after `pnpm install`:

```bash
# An npm-compatible package containing both CLI and TUI
pnpm run pack:cli

# A native executable with its own Node runtime and companion resources
pnpm run build:cli-sidecar

# Install those resources into the desktop shell for Tauri packaging
node scripts/build-cli-sidecar.ts --install
```

The package is written to `dist/cli-pack/`, with a tarball and a manifest recording its source commit and checksum. Packaging also installs it into a temporary consumer and checks version reporting, tool listing, SVG rendering, the missing-content error and the TUI entry.

The native build is written to `dist/cli-sidecar/bin/` and `dist/cli-sidecar/cli-lib/`. Keep both directories together. It uses Node's single executable application support for a small launcher; the CLI and TUI remain ESM resources. A single CommonJS bundle cannot replace that layout.

Native builds include the matching resvg library. Build on the target platform, or provide a matching Node runtime and native binding using the options in `scripts/build-cli-sidecar.ts`. The desktop release build runs this installer automatically.

Both forms need a content root. Set `LOLLY_ROOT` to a Lolly checkout or a materialised public content bundle; packaged desktop apps extract their embedded content for the CLI. The terminal package itself contains no brand pack or tool catalog. Its package version is independent of the desktop app version.

---

## TUI

### TUI development use (no build needed)

The interactive terminal shell runs straight from the repo - it needs a real TTY, so run it in your terminal rather than a captured pipe:

```bash
pnpm run tui
```

It's the CLI's engine and render path under an interactive, keyboard-first UI (built on Ink, run through `tsx`). The DOM-free formats - **SVG, EMF, EPS, HTML and the text/data formats** - render with nothing extra. State (saved sessions, project folders, profile) persists on disk in the directory all three local shells share - `$LOLLY_STATE_DIR`, else the desktop app's data directory when the app is installed here, else `~/.lolly`; exports default to `~/Desktop`. See the [TUI guide](/info/tui.html) for the full key map and views.

### Browser render tier (raster / PDF / video / URL capture)

Unlike the bare CLI, the TUI can produce browser-bound formats via a scoped headless Chromium - the same one the MCP server uses. Set it up once:

```bash
pnpm run install:browser   # Chromium → services/mcp/.browsers (shared with services/mcp)
pnpm run build:web         # a built web shell the TUI drives for pixel-identical raster/pdf/video
```

With those present, raster (PNG/JPG), PDF, video and the `url-shot` live-URL capture all export from the terminal; without them, those formats fail with a clear setup message and the TUI writes HTML instead. The browser is lazy - it launches only on the first such export, never at startup. Override the browser with `LOLLY_BROWSER_CHANNEL` / `LOLLY_BROWSER_PATH`, or point at a running/prebuilt web shell with `LOLLY_WEB_BASE` / `LOLLY_WEB_DIST`.

The packaged CLI and native sidecar both include the TUI. Start it with `lolly tui` in a real terminal.

---

[Back to Build Guide](/info/build-guide.html).
