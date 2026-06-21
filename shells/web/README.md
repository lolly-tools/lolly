# Web Shell (PWA)

The web shell is the primary MVP target. It:

- Hosts the engine at a public URL (`brand-tools.suse.com`)
- Implements the capability bridge against browser APIs (IndexedDB, Clipboard API, etc.)
- Registers a service worker for offline tool caching
- Renders the gallery, profile, saved-state, and tool UI chrome
- Drives the engine's lifecycle

## Running locally

From the **repo root** (not this workspace):

```bash
npm run dev:web     # Vite dev server + live-rebuild of the /info docs pages
npm run build:web   # production build (builds the /info pages first)
```

`dev:web` runs two things in parallel: the Vite dev server **and** `node docs/build.js --watch`,
which generates the static `/info` site into `public/info/` and rebuilds it whenever anything
under `docs/` (or the root `README.md`) changes.

> **Heads-up:** running this workspace's own `npm run dev` (plain `vite`) does **not** build or
> watch the `/info` pages — so `/info/*` will 404 or serve stale content. Use `npm run dev:web`
> from the repo root. If you do want the bare `vite` server, run `npm run build:info` once from the
> root first to generate the pages.

## Bridge implementation

| Capability     | Web implementation |
|----------------|--------------------|
| `state`        | IndexedDB via `idb` |
| `profile`      | IndexedDB + in-memory cache |
| `assets`       | Cache API (synced catalog) + IndexedDB (user uploads) |
| `clipboard`    | `navigator.clipboard` with download fallback |
| `export.render`| `dom-to-image-more` for PNG/JPG, native serialiser for SVG, `pdf-lib` for PDF, native serialiser for HTML/TXT |
| `net.fetch`    | `fetch()` with allowlist enforcement |

## What is NOT here

- No tool source files. Tools are synced at runtime from the catalog manifest.
- No SUSE branding-specific code. The shell renders whatever tools the catalog gives it.
- No Tauri code. That lives in `shells/tauri-desktop` and `shells/tauri-mobile`.
