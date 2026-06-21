# Tauri Desktop Shell

Wraps the web shell in Tauri 2 for macOS, Windows, and Linux distribution. The web shell's source is built with an aliased `state.js` that uses `tauri-plugin-fs` for filesystem-backed saved state instead of IndexedDB.

## What's different from the web shell

| Concern | Web | Desktop |
|---|---|---|
| State persistence | IndexedDB (per-browser) | `$APPDATA/Lolly/saved-state/*.json` |
| Assets cache | Cache API | Filesystem (future milestone) |
| Export: PNG/PDF | `dom-to-image-more` | Same (uses WebView renderer) |
| Export: ffmpeg/sidecar | ❌ | Planned via `tauri-plugin-shell` sidecar |
| Offline | Service worker | Native (app is local) |

## Structure

```
shells/tauri-desktop/
├── package.json              # npm scripts + JS dependencies
├── vite.config.js            # builds web shell src with state.js aliased
├── bridge-overrides/
│   └── state.js              # filesystem state — replaces IndexedDB at build time
├── dist/                     # Vite output consumed by Tauri (gitignored)
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json       # productName, identifier, window config
    ├── capabilities/
    │   └── default.json      # fs + shell + http permissions
    └── src/
        ├── main.rs
        └── lib.rs
```

## Dev

```bash
cd shells/tauri-desktop
npm install
npm run dev
```

Tauri opens a native window backed by the Vite dev server. Hot reload works.

## Build

```bash
cd shells/tauri-desktop
npm run build
```

Outputs the signed installer to `src-tauri/target/release/bundle/`.

See `docs/build-guide.md` for full platform-specific instructions, prerequisite setup, and icon generation.
