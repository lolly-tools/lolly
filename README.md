# lolly-desktop

The Tauri 2 desktop app (macOS, Windows, Linux, plus a Flatpak manifest under `flatpak/`).

## Read this first: there is no `src/` here

**This directory contains no application code.** The app *is* the web shell. `vite.config.js` sets `root` to `../web`, so `vite` builds `shells/web/index.html` and `shells/web/src/main.ts` exactly as the PWA does, and then substitutes four modules at build time.

Everything in this directory is therefore one of five things:

| Path | What it is |
|---|---|
| `vite.config.js` | The substitution mechanism, plus dev-server middleware for `/tools/` and `/catalog/` |
| `bridge-overrides/*.ts` | The four replacement modules |
| `src-tauri/` | The Rust side: the Tauri app, its permissions and native page capture |
| `package.json`, `flatpak/`, `dist/` | Scripts, packaging, build output |
| `macos/quicklook/` | Sandboxed Finder thumbnail and Space-bar preview extensions for `.lolly` files |

If you are looking for a view, a style or an input control, it is in [`shells/web/src/`](../web/src/README.md). If you change something there, it changes here too.

Own repo `lolly-desktop`, mounted in the umbrella [`lolly`](https://github.com/lolly-tools/lolly) as a git submodule at `shells/tauri-desktop/`. See the [submodule caveat](#submodule-caveat).

## Entry point

Two of them, in sequence.

The **native** entry is `src-tauri/src/main.rs`, which calls `run()` in
`src-tauri/src/lib.rs`. That dispatches GUI, hidden search-provider or headless
CLI mode, composes the filesystem, dialog, deep-link, single-instance,
window-state, updater, notification and process plugins, and registers the
native command surface. There is no HTTP plugin - see the `remote_fetch` note
further down. OAuth and file reveal use narrow Rust commands; the generic
shell-open plugin is intentionally absent.

The **frontend** entry is the web shell's, `shells/web/index.html` → `/src/main.js` → `shells/web/src/main.ts`. `src-tauri/tauri.conf.json` points `devUrl` at `http://localhost:5173` and `frontendDist` at `../dist`, and its `beforeDevCommand` and `beforeBuildCommand` run this package's `dev:frontend` and `build:frontend`, both plain `vite`.

## How the bridge gets composed: build-time module substitution

This is the single most confusing thing about this directory, and until now it was explained only inside the override files themselves.

The web shell's `src/bridge/index.ts` composes the host from **relative sibling imports**: `./state.ts`, `./capture.ts`, `./capabilities-provided.ts`, `./export.ts`. The `overrideBridgeModules` plugin in `vite.config.js` is a `resolveId` hook with `enforce: 'pre'` that intercepts those specifiers and returns a path in `bridge-overrides/` instead. The bridge index itself is unmodified and unaware.

Two details of that hook are hard-won and easy to break:

- It matches on the **extension-less basename** of the specifier, so it fires whether the bridge imports `./state.js` or `./state.ts`. An earlier version keyed on `.js`, and after the web shell's TypeScript migration every override silently stopped firing, so the desktop app shipped browser IndexedDB state and a throwing capture stub.
- It requires the **importer** to live in a `bridge/` directory. This is what makes it safe: it cannot be `resolve.alias`, because a path regex cannot match a relative specifier without also catching same-named files elsewhere in the tree. Matching on importer plus basename works for both the absolute filesystem importer that `vite build` passes and the root-relative URL importer the dev server passes.

### The four overrides, and why each exists

| Module | Replaced with | Why |
|---|---|---|
| `state` | `bridge-overrides/state.ts` | Filesystem state via `tauri-plugin-fs` instead of IndexedDB. Saved sessions become `$APPDATA/Lolly/saved-state/<slot>.json`. The API surface has to match the web original method for method, because nothing downstream knows which implementation is running, so a missing method crashes boot - as of the TS conversion that is enforced: `createFsStateAPI` returns the web module's own `WebStateAPI`, imported type-only, so a method added there and forgotten here fails `npm run typecheck` instead of a device boot. The logic (slot-name codec, legacy-filename migration, record shape, asset-ref collection) lives in `../tauri-shared/bridge-overrides/state-fs.ts`, shared with the mobile shell; this file is just the `tauri-plugin-fs` binding it is handed, which is also where desktop-only storage behaviour would go. It is an adapter rather than a plain import because the Tauri shells are not npm workspaces, so the parent repo cannot resolve `@tauri-apps/plugin-fs`. |
| `capture` | `bridge-overrides/capture.ts` | Real page capture instead of the web shell's throwing stub. `page(spec)` calls the native `capture_page` for a raster plus page geometry; `vector(spec)` calls `capture_page_pdf` and converts the vector PDF to a standalone SVG through the engine's PDF interpreter, then windows it so a vector shot frames identical content to a raster shot of the same spec. |
| `capabilities-provided` | `bridge-overrides/capabilities-provided.ts` | Declares a genuine superset: it spreads the web list, filters out `'screen'` and adds `'filesystem'` and `'capture'`. It spreads rather than re-lists so that a capability added on the web side can never silently go missing here and gate a tool off as "desktop only" on the desktop itself. `'screen'` is subtracted because display capture is `getDisplayMedia`, and wry's webviews do not grant it without the host app answering a permission delegate that this shell does not implement, so advertising it would un-grey the screen-capture tool and then fail at the tap. |
| `export` | `bridge-overrides/export.ts` | Delivery only. The web `download()` uses `URL.createObjectURL` plus an `<a download>` click. WKWebView hands that navigation to wry, which **cancels** it outright unless a native download handler is registered. The override replaces `download` and `file` with a real save through `tauri-plugin-fs`: fast Download writes to a de-collided `Downloads/Lolly` filename, while the desktop-only **Save as…** action uses the native dialog, remembers its last folder and lets the OS confirm replacement. A successful save offers Reveal through a native recent-path allowlist. `render()` and the rasteriser are inherited unchanged. |

The `export` override does one thing worth calling out: it opens with `export * from '../../web/src/bridge/export.ts'`. The substitution replaces that module for **every** importer inside `bridge/`, not just the bridge index, so it has to carry the original's whole public surface or a sibling such as `export-pptx.ts` fails the build. The star re-export forwards live bindings, which matters because the web module assigns an `export let _host`, and the local `createExportAPI` shadows the starred one per ES module semantics.

The mobile shell uses the same mechanism with a different set of three overrides. Compare [`../tauri-mobile/README.md`](../tauri-mobile/README.md) before you change a shared pattern.

#### Three more overrides that are NOT in the map

`bridge-overrides/notify.ts`, `zoom.ts` and `updater.ts` are not entries in
`overrideBridgeModules`. They cannot be: the map fires only for a module imported
from inside a `bridge/` directory, and their callers are `lib/job-toast.ts`,
`src-tauri/src/menu.rs` and `views/profile.ts`. Relaxing the matcher to also
accept a specifier naming `bridge/` was tried and rejected - it would also catch
`pro/run-overlay.ts`'s dynamic `import('../bridge/export.ts')` and hand it the
wrong module.

So each publishes one small global that the web shell probes for, and
`capabilities-provided.ts` imports all three for their side effect. That override
loads with the bridge on every boot, which makes it the one guaranteed-early
place to install them - the same reason `eyedropper-shim.ts` is imported there.

| Global | File | What the web shell does with it |
|---|---|---|
| `window.__lollyNotify` | `bridge-overrides/notify.ts` | `lib/job-toast.ts` posts a finished-job notice through `tauri-plugin-notification` - the real platform service, so it outlives the window - instead of the webview's own `Notification`. Absent, and the web API is used, which still works inside the webview. |
| `window.__lollyZoom` | `bridge-overrides/zoom.ts` | Whole-UI zoom. A wry webview has none, so Cmd/Ctrl `=` `-` `0` did nothing here. The View > Zoom menu items in `src-tauri/src/menu.rs` carry the accelerators and call this; it drives `WebviewWindow.setZoom`, clamps to 0.5-3 and saves the factor in the profile store. |
| `window.__lollyUpdater` | `bridge-overrides/updater.ts` | `views/profile.ts` renders a "Check for updates" row in the Lolly instance card only when this exists, so a browser and the mobile app show nothing rather than a dead button. It wraps `tauri-plugin-updater` and asks twice: once to download, again to install and restart. |

#### Website source transport

There is no `site-fetch` bridge override, and there never fired one (a stale vite.config.js map key for it was removed 2026-09-05). The Design System studio's Website source calls the native `site_fetch` command directly: it probes Tauri's own `__TAURI_INTERNALS__.invoke` global at runtime (`detectSiteTransport` in `shells/web/src/lib/design-system/sources/website.ts`) and, when present, invokes `site_fetch` (`src-tauri/src/site_fetch.rs`) without going through a build-time module substitution at all.



### `vite.config.js` also carries two other plugins

- **`jsToTsFallback`** maps a missing `.js` specifier to its sibling `.ts`. The web shell's `index.html` still names `/src/main.js`; the plugin only fires when the `.js` is genuinely absent and the `.ts` exists, so it can never shadow a real `.js`.
- **`bundleRepoDirs`** serves `/tools/` and `/catalog/` from the repo root in dev, and copies them into `dist/` on build with `dereference: true`, because those paths are symlink farms built by `scripts/use-profile.ts` and the WebView needs real files.
- **`pruneEmbeddedDownloads`** deletes `dist/models/` after the build. Vite's `publicDir` copy pulls the whole of `../web/public/` into `dist/`, including the ~1 GB of on-device ONNX models (matte/upscale/kokoro/whisper/trustmark - gitignored, Andy-staged). Tauri embeds *all* of `frontendDist` into the binary via `generate_context!()`, and embedding ~1.8 GB tips the crate's rlib past the 32-bit `ar` archive-offset limit - the Rust build dies with `truncated or malformed object`. The web shell already excludes `/models/` from its own app bundle (they download on demand via the offline manager); this makes the desktop build do the same, keeping the binary buildable and lean. It's a list - add any future runtime-downloaded tree here. **If a build ever fails with `truncated or malformed object`, it's this: `dist/` grew past ~2 GB; prune more.**

The desktop crate likewise emits only an `rlib`. Tauri's cross-platform template
normally adds `staticlib` and `cdylib` products for iOS/Android, but this is the
desktop-only shell; those products are unused and each duplicates the embedded
frontend, wasting gigabytes of temporary build space.

`build.target` and `optimizeDeps.esbuildOptions.target` are both `esnext` because harfbuzzjs, the text-to-path WASM, uses top-level await, which the default `es2020` target rejects.

## The Rust side

`src-tauri/` is small and does exactly two jobs: host the WebView, and fulfil the `capture` capability.

- `Cargo.toml` declares `lolly-desktop`, edition 2021, with Tauri's filesystem,
  dialog, deep-link, single-instance, window-state, updater, notification and
  process plugins plus **`headless_chrome`**. There is no HTTP plugin. OAuth
  opens through the dedicated `oauth_open` command, which accepts only parsed,
  credential-free HTTPS URLs; the generic shell-open plugin is deliberately not
  installed.
- `src/main.rs` and `src/lib.rs`: `run()` reads argv and **dispatches** - GUI, or a headless CLI render (see [Command-line mode](#command-line-mode-one-binary-gui-and-cli)). There is exactly one `generate_context!()` call site (in `dispatch`), so the frontend assets are embedded once; `--help`/`--version` are answered without building the app at all. `run_gui()` is the old body (plugins + `capture_page`/`capture_page_pdf` handlers).
- `src/cli.rs`: the command-line half - argv classifier, URL-mode query builder, the off-screen headless-render window (`build_offscreen_window`, shared with the render endpoint), and the `cli_write`/`cli_done`/`cli_fail`/`cli_log` invoke handlers.
- `src/render_server.rs`: the loopback render endpoint (`--render-server`) - the framed JSON protocol, the token and peer checks, the `render.json` advert, and the one-job-at-a-time runner. Its own `cli_write`/`cli_done`/`cli_fail`/`cli_log` handlers hand each finished render back to the waiting connection instead of exiting the process. See [The render endpoint](#the-render-endpoint---render-server).
- `src/capture.rs` (312 lines): the only substantial Rust in the project. It drives a **headless Chrome over the DevTools Protocol**, deliberately not the app's own WKWebView or WebView2, because Tauri 2 has no stable API for screenshotting arbitrary content with viewport and scroll control. `capture_page` uses `Page.captureScreenshot`, and its clip rect is **document-space** when `captureBeyondViewport` is true, so scroll depth resolves into `clip.y` rather than into a `window.scrollTo`. An earlier version scrolled and then clipped at `y = 0`, which silently framed the page top at every depth. `capture_page_pdf` uses `Page.printToPDF` under `screen` media emulation for a true vector print. Both run on `spawn_blocking`, because `headless_chrome` is blocking. Both require a Chrome or Chromium install. Only non-http(s) schemes are rejected: capturing localhost or a private dev server is a feature here, because the user runs the tool on their own machine.
- `src-tauri/capabilities/default.json` holds the Tauri permission set. Filesystem access is limited to the verbs used by state/pack storage and export, with exact scopes for `$APPDATA/saved-state/**`, `$APPDATA/pack-store/**`, and `$DOWNLOAD/Lolly/**`; it cannot traverse the rest of AppData or Downloads. There is no `tauri-plugin-http`. Outbound HTTP goes through `remote_fetch` (`src-tauri/src/remote_fetch.rs`), a narrow native command built on `reqwest` that the webview cannot bypass: HTTPS only, bounded URL/header/body/response sizes, resolution restricted to public IP space, and the resolved address pinned into a fresh no-proxy client with the same checks re-applied on every redirect (five max) - a deliberate replacement for the webview-visible `plugin:http|*` command family, kept narrow because remote instances and user-chosen export providers are first-class callers. The Content Security Policy is a `<meta>` tag in the built `index.html`, written by the shared `../tauri-shared/vite-csp.mjs` plugin, and `tauri.conf.json` keeps `app.security.csp`/`devCsp` null on purpose: with a CSP in the config, Tauri's codegen re-serialises every `.html` asset (the signed tool templates included), so the catalog digests no longer match and no tool loads under the release build's verified-only trust mode (`tests/tauri-csp.test.ts` pins this). `unsafe-eval` remains temporarily because verified built-in tool hooks still use the compatibility executor.

## Updates

`plugins.updater` in `tauri.conf.json` points at
`https://lolli.li/updates/{{target}}/{{arch}}/latest.json`, one small manifest per
target and arch. `release/build-latest-json.ts` writes them; run it with no
arguments for a dry run that prints each manifest and the `lolli.py` command that
would publish it.

Two things have to be true before any of it works.

**A signing keypair.** `plugins.updater.pubkey` ships as the literal
`PLACEHOLDER-RUN-TAURI-SIGNER-GENERATE`. Mint the real one with
`npm exec tauri signer generate -- -w ~/.lolly-updater.key`, paste the public half
into `tauri.conf.json`, and keep the private half and its password as the CI
secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` -
`tauri build` reads those to sign the artifact. `build-latest-json.ts` refuses to
write a manifest while the placeholder is in place, and `cargo test --lib` pins
the endpoint shape and the placeholder spelling so the two files cannot drift.

**An artifact the updater can install.** `bundle.createUpdaterArtifacts` is on, so
`tauri build` emits a `.app.tar.gz` on macOS (and a `.msi.zip` / `.nsis.zip` on
Windows) beside its `.sig`. The `.dmg`, `.deb`, `.rpm`, `.flatpak` and Arch
package are NOT updater artifacts - a package manager owns those files, and
replacing them from inside the app would leave it describing files that are gone.
Those users update the way they installed. Serving Linux through the updater
means adding an AppImage bundle to the release first.

## Command-line mode: one binary, GUI *and* CLI

The macOS bundle ships a single Mach-O at `Lolly.app/Contents/MacOS/lolly-desktop`. Launched with no arguments (or from Finder) it opens the app, unchanged. Launched with a tool it renders **headlessly** and exits:

```bash
Lolly.app/Contents/MacOS/lolly-desktop qr-code --url=https://suse.com --output=qr.png
Lolly.app/Contents/MacOS/lolly-desktop run color-palette --format=svg -o palette.svg
Lolly.app/Contents/MacOS/lolly-desktop qr-code --url=https://x.com --format=svg -o -   > qr.svg
Lolly.app/Contents/MacOS/lolly-desktop --help        # usage; --version; both answered in Rust, no window
```

There is **no second renderer**. A Lolly tool can only render with a JavaScript runtime (the engine renders into a DOM), and the desktop render path *is* the web shell in a WebView - so "headless" is that same web shell, driven through URL mode. `src/cli.rs`:

1. `classify()` turns argv into a job: tool id + `--k=v` params become a `#/tool/<id>?…&export=1` hash (`--output`/`-o` and `--format`/`-f`/`--export` are lifted out; `-o -` means stdout). A pasted `…/#/tool/<id>?…` link works too; later `--flags` override it.
2. `run_cli()` builds the app with the config window cleared (`config_mut().app.windows.clear()`, so nothing visible auto-opens) and creates one **off-screen** window (`-4000,-4000`, visible so WKWebView doesn't throttle its rAF) pointed at that hash, with `window.__LOLLY_CLI__` and an unknown-tool guard injected as an `initialization_script`. macOS activation policy is `Accessory` (no dock icon).
3. The web shell auto-exports on an `export=` deep link (shells/web `views/tool.ts`), calling `host.export.download`. The [`export` override](#the-four-overrides-and-why-each-exists), seeing `window.__LOLLY_CLI__`, sends the bytes to `cli_write` (→ the exact `--output` path, or stdout) instead of Downloads, then `cli_done` exits 0.
4. A watchdog thread (`LOLLY_CLI_TIMEOUT`, default 90s) is the hard stop; page-side `console.error`/uncaught errors are forwarded to stderr via `cli_log`. **stdout carries only the payload; every diagnostic is on stderr** - the Node CLI's contract.

Two boot-path facts this depends on, both **load-bearing**:

- **The window must be a real `.app` bundle.** WKWebView spawns its WebContent process over XPC and a bare `target/release/lolly-desktop` can't - the window opens but no page ever loads. Test the *bundled* binary, never the loose one.
- **Interactive first-run gates must be skipped headlessly.** `maybeShowFirstRunInstanceSheet` (shells/web `lib/instance-choice.ts`) `await`s a modal on a fresh Tauri shell, *before* the first catalog sync - with no human it hangs boot forever and the tool never mounts (rAF runs, nothing appears, no error - a nasty silent stall). That function now early-returns when `window.__LOLLY_CLI__` is set.

### The bundled Node CLI (plans/202 WP1.3)

`run` is the only verb the Rust answers. Everything else the terminal knows -
`list`, `describe`, `batch`, `preflight`, `validate`, `models`, `completion`,
`tui` and the rest of `RESERVED_SUBCOMMANDS` - is forwarded to a **Node CLI
bundled beside the app** as a Tauri `externalBin`, so an installed Lolly is the
whole command line and not a subset of it:

```bash
Lolly list --json
Lolly batch rows.csv --out-dir=./out
Lolly tui
Lolly models ls
Lolly validate poster.png
```

- **The executable** is `bin/lolly-cli-<target-triple>`, built by
  `node scripts/build-cli-sidecar.ts` in the parent repo. It is a Node 24 single
  executable whose embedded main is a small launcher. Only the launcher is
  inside the binary: Node's SEA main runs as CommonJS, the CLI bundle is ESM
  with top-level await, so the compiled CLI rides beside it. The build script's
  header records what was measured before that shape was chosen.
- **The payload** is the `cli-lib` bundle resource: the compiled ESM bundle, the
  one native addon (`@resvg/resvg-js`) loose in `cli-lib/addons/`, and the few
  packages that carry their own wasm. `cli.rs` passes its location in
  `LOLLY_SIDECAR_HOME`.
- **The content root** is written out of this binary rather than shipped twice.
  `tools/` and `catalog/` are already embedded through `frontendDist`, and the
  rlib sits near the 2 GB `ar` archive-offset limit (see the
  `pruneEmbeddedDownloads` note in `vite.config.js`), so a second copy as bundle
  resources is not on. `src/root_export.rs` materialises the embedded content
  into `<app data>/root/<app version>/` on first use, skipping `catalog/og/` and
  `catalog/previews/`, and `cli.rs` points `LOLLY_ROOT` at it. An explicit
  `LOLLY_ROOT` in the environment always wins. `Lolly --export-root <dir>` runs
  the same export against a directory of your choosing; it is hidden from
  `--help` because it exists for packaging and for reading what shipped.
- **The installed app is the first full-fidelity rung.** `cli.rs` passes its own
  executable as `LOLLY_DESKTOP_BIN`; the Node shell's default `auto` order asks the
  app before it asks Chromium, and falls back when the app cannot complete the
  export. `LOLLY_RENDERER=desktop` or `chromium` pins one rung explicitly. The
  request goes over the render endpoint below.

## The render endpoint (`--render-server`)

`Lolly --render-server` starts the app with no visible window and one listener on
`127.0.0.1`, on a port the operating system picks. `src/render_server.rs` serves it.

- **Address and credential.** The port, a per-launch token, the process id and the
  app version are written to `render.json` in the app data directory, mode 0600 on
  unix, and the file is removed when the process exits. `packages/node-shell/src/state-dir.ts`
  derives the same directory in Node, so the CLI, the TUI and the MCP service find
  the endpoint without being told where the app is. `LOLLY_RENDER_SERVER` points at
  a specific file when the app lives somewhere unusual.
- **Protocol.** `u32` big-endian length, then that many bytes of JSON: one request
  frame in, one reply frame out, then the connection closes. The same framing
  `native_transport.rs` uses, without the Noise layer, because this socket never
  leaves the machine. No web-server crate was added.
- **Refusals.** A non-loopback peer is dropped before its bytes are read. A wrong
  or missing token is refused with no other information. A request frame over 1 MiB
  is refused before anything is allocated for it.
- **One job at a time.** The accept loop is a single thread and finishes each
  connection before taking the next, so exactly one off-screen window exists at any
  moment. That window is built by `cli::build_offscreen_window`, the same function
  `Lolly run <tool>` uses, and the job is parsed by the same `cli::classify`, so a
  tool link cannot mean two things depending on which door it came in.
- **Idle exit.** With nothing to do for 15 minutes the server removes its advert and
  exits, so a caller that started it for one render leaves no process behind.
  `LOLLY_RENDER_IDLE=<seconds>` changes that, and `0` keeps it up.

On Linux the `org.lolly.Desktop1.Render(toolUrl, outPath)` D-Bus method is the other
door. It is served from the GUI process, whose visible window already holds the label
an off-screen render needs, so it runs this executable's CLI mode as a child and waits
for the file. It answers `written:<path>` or `error:<reason>`.

**Release step (per target, before `tauri build`):**

```bash
# in the parent repo, on a machine of the target architecture
node scripts/build-cli-sidecar.ts --install
# cross-targeting: pass that platform's node binary and its resvg binding
npm i --no-save @resvg/resvg-js-linux-x64-gnu
node scripts/build-cli-sidecar.ts --target=x86_64-unknown-linux-gnu \
  --node=/path/to/linux-x64/node --install
```

`--install` writes `src-tauri/bin/lolly-cli-<triple>` and `src-tauri/cli-lib/`,
both gitignored. `tauri build` then picks them up from `bundle.externalBin` and
`bundle.resources`. The release build's `beforeBuildCommand` runs the installer
for the current target; an intentional cross build still passes that platform's
Node binary and resvg binding explicitly. macOS signing needs nothing extra:
the sidecar is signed ad-hoc by the build script and re-signed with the real
identity when `tauri build` signs the app bundle.

## Deep links: `lolly://`

The desktop app owns the `lolly://` URL scheme (plans/174): `lolly://<route>` is `https://lolly.tools/<route>` with the site name taken for granted, so a launcher, a Shortcut, a `.desktop` Action, a GNOME Shell or KRunner result or a terminal (`open` / `xdg-open` / `start`) can open a tool with its inputs filled. The grammar is documented in `docs/url-mode.md` ("The `lolly://` scheme"); the web-side mapper is `shells/web/src/lib/deep-link.ts`, and it refuses anything that is not a parsing tool address or a word from the app's frozen route vocabulary.

Two halves, per platform:

| | Registration (who tells the OS) | Delivery (how the URL reaches the queue) |
|---|---|---|
| macOS | The bundler writes `CFBundleURLTypes` into the `.app`'s Info.plist from `tauri.conf.json` > `plugins.deep-link.desktop.schemes`. Only an installed bundle is registered; `tauri dev` on a Mac cannot receive the scheme. | Apple Events, never argv: Tauri surfaces them as `RunEvent::Opened { urls }`, handled in `lib.rs`'s run callback by `desktop_integration::classify_opened` (a `.lolly` double-clicked in Finder arrives the same way as a `file://` URL). |
| Windows | The NSIS/MSI installers write `HKCU\Software\Classes\lolly` (`URL Protocol` + `shell\open\command`) from the same config block and remove it on uninstall. A debug build registers itself at launch (`register_all`). | argv: a fresh process is started with the URL, and `tauri-plugin-single-instance` forwards that argv to the running one; both go through `classify_argv`. |
| Linux | `MimeType=…;x-scheme-handler/lolly;` in the `.desktop` entry - the deb's `linux/deb/lolly.desktop.hbs`, the curated `flatpak/tools.lolly.Desktop.desktop` (also the rpm's), and the entry the bundler generates. A debug build registers itself at launch. | argv, as on Windows. |

Every path ends in one place: the `DesktopEvents` queue (`desktop_integration.rs`) that the web shell drains every 1200 ms (`shells/web/src/lib/linux-desktop-boot.ts`). The `tauri-plugin-deep-link` crate is what makes the config block real (and what registers a dev build); its own events are not used for delivery, so a URL is never routed twice. `cli.rs` classifies a leading `lolly://` argument as GUI, never as a headless render - `Lolly lolly://tool/qr-code` opens the window on that tool.

To try it on an installed build:

```bash
open "lolly://t/qr-code?url=https://suse.com"          # macOS
xdg-open "lolly://tool/strip-data"                       # Linux
start "lolly://lab"                                      # Windows
```

## `.lolly` documents

`bundle.fileAssociations` in `src-tauri/tauri.conf.json` registers `.lolly` as
`application/vnd.lolly+zip` on every desktop installer. Lolly ranks as the owner/editor,
and defines the Apple UTI `tools.lolly.pack` as a public data/archive type. Opening a file
starts or focuses Lolly and sends it through the `DesktopEvents` queue, then through the
web shell's universal drop importer - a double-click and a drop cannot disagree.

Lolly also registers as an **alternate** opener for formats it genuinely handles on-device:
Penpot (`.penpot`), Figma (`.fig`), IDML, PDF-compatible Illustrator, SVG, PDF, Excel/CSV/TSV,
PowerPoint, Word, Photoshop and GIMP documents. Alternate means “show in Open With”, not
“replace the specialist app as the default”. A spreadsheet lands in the Spreadsheet utility;
design documents go through the Design/import chooser; layered images and office documents
get their own relevant routes. Raw `.indd` is deliberately not registered because Lolly needs
an exported `.idml` package. Keep this list aligned with `lib/drop-router.ts`: an association
must never advertise a file for which the router has no honest destination.

- **macOS:** Tauri writes `CFBundleDocumentTypes` and `UTExportedTypeDeclarations`.
  `src-tauri/Info.plist` adds the icon keys that Tauri's association schema cannot express,
  and `icons/lolly-document.icns` is bundled as the Finder document icon. It is generated
  directly from the rich root `icon-primary.svg` by `npm run icons`; do not wrap it in a
  mock sheet of paper, because Finder already supplies the file context. Two sandboxed app
  extensions under `macos/quicklook/` make the file itself visible too: Finder thumbnails
  work on macOS 10.15+, and the data-based Space-bar preview on macOS 12+. Both lift only the
  bounded embedded PNG from a `lolly-share` manifest, verify its ZIP CRC, stay offline, and
  fall back to the document icon for brand packs, old files and corrupt archives. They are
  built universal, ad-hoc signed for local packaging, embedded under `Contents/PlugIns`, and
  re-signed with the containing app for distribution.
- **Windows:** NSIS/MSI register the extension, type description and the app's icon/open
  command. Windows preserves the person's default-app choice; Lolly is available through
  Open With. The single-instance handler forwards a file opened while Lolly is already live.
- **Linux:** the deb/rpm/Flatpak desktop entry claims the MIME type; shared-mime-info
  supplies the `*.lolly` glob and the hicolor mimetype icons under `linux/icons/`.
  Those icons are generated directly from the rich root `icon-primary.svg` by `npm run
  icons`, with no mock page treatment, and are consumed by both GNOME Files and KDE Dolphin.
  GNOME Files may replace this fallback with the actual embedded preview when a session share
  carries one; KDE uses the primary MIME icon because no KIO thumbnail plugin is installed.

The MIME, extension, Apple UTI, handler-rank and document-icon declarations are
contract-tested from the umbrella repo. If one changes, change all package formats together.

## Run it

```bash
npm run dev            # tauri dev, which starts vite via beforeDevCommand, then the app
npm run dev:frontend   # just vite, in a browser, with the desktop overrides active
```

`dev:frontend` is genuinely useful: it lets you exercise the override modules without a Rust build, though `capture` will fail because there is no `invoke` host.

## Build it

```bash
npm run build          # tauri build; its hook builds the frontend + macOS Quick Look extensions
npm run build:frontend # frontend only, into ./dist
npm run build:quicklook # universal Finder thumbnail + Quick Look extensions (macOS only)
```

Requires a Rust toolchain. Note that `dist/` here is this shell's own output, distinct from `shells/web/dist`.

`tsconfig.json` here typechecks `bridge-overrides/` only - the frontend is covered by `tsc -p shells/web`. It is reached from the umbrella's `npm run typecheck` through `scripts/typecheck-tauri.ts` rather than as a bare `tsc -p` step, because the overrides import `@tauri-apps/api` and `@tauri-apps/plugin-fs` and **this shell is not an npm workspace**, so a root `npm ci` never creates its `node_modules`. That script SKIPS with a logged reason when they are absent, so a plain clone is not punished; CI installs both Tauri shells (`--omit=dev`) and then re-runs it with `--strict`, which fails on a skip, so the gate cannot quietly become a no-op. To run it locally:

```bash
npm --prefix shells/tauri-desktop ci --omit=dev   # once
npm run typecheck:tauri
```

## Surprising things

- Everything under [How the bridge gets composed](#how-the-bridge-gets-composed-build-time-module-substitution), which is the whole point of this section existing.
- **A state-override file name must not begin with a dot.** `tauri-plugin-fs` defaults `require_literal_leading_dot` to `cfg!(unix)`, true on macOS, so the `$APPDATA/saved-state/**` scope cannot match a dotfile and every access to one is rejected as a forbidden path. As `.slotname-v1` the migration marker's rejection propagated out and failed every state call, so the app could not boot. It is `slotname-v1.marker` now.
- `vite.config.js` is still `.js` while `bridge-overrides/` is now `.ts`. The Vite config is a build-tool file (Biome excludes `**/*.config.js` repo-wide) and is not part of the shipped app; the overrides are.
- The desktop app cannot do screen capture even though it is native. See the `'screen'` subtraction above.

## Submodule caveat

This shell builds **inside the umbrella repo** and nowhere else, more strictly than any other. Its Vite root is `../web`, its overrides import `../../web/src/bridge/…`, it resolves `@lolly/engine` and `@tauri-apps/*` through the umbrella's workspaces and its own `package-lock.json`, and it copies the repo-root `tools/` and `catalog/` profile views into `dist/`. A standalone clone of `lolly-desktop` builds nothing at all.

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
# or, in an existing clone, BEFORE npm install:
git submodule update --init --recursive
```

Commit changes to files in this directory in the `lolly-desktop` repo, then commit the moved pointer in the umbrella. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) section 4.
