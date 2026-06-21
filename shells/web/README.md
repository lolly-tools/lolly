# Web Shell (PWA)

The web shell is the primary MVP target. It:

- Hosts the engine at a public URL (`brand-tools.suse.com`)
- Implements the capability bridge against browser APIs (IndexedDB, Clipboard API, etc.)
- Registers a service worker for offline tool caching
- Renders the gallery, profile, saved-state, and tool UI chrome
- Drives the engine's lifecycle

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
