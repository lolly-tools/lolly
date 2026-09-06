# lolly-mobile

The Tauri 2 mobile app, iOS and Android.

## Read this first: there is no `src/` here

**This directory contains no application code.** The app *is* the web shell. `vite.config.js` sets `root` to `../web`, so `vite` builds `shells/web/index.html` and `shells/web/src/main.ts` exactly as the PWA does, and then substitutes three modules at build time.

Everything in this directory is therefore one of four things:

| Path | What it is |
|---|---|
| `vite.config.js` | The substitution mechanism, plus dev-server middleware for `/tools/` and `/catalog/` |
| `bridge-overrides/*.ts` | The three replacement modules |
| `src-tauri/` | The Rust side plus, for Android, a real native project under `gen/android/` |
| `package.json`, `dist/` | Scripts and build output |

If you are looking for a view, a style or an input control, it is in [`shells/web/src/`](../web/src/README.md). If you change something there, it changes here too.

Own repo `lolly-mobile`, mounted in the umbrella [`lolly`](https://github.com/lolly-tools/lolly) as a git submodule at `shells/tauri-mobile/`. See the [submodule caveat](#submodule-caveat).

## Entry point

Two of them, in sequence.

The **native** entry is `src-tauri/src/main.rs`, which calls `run()` in `src-tauri/src/lib.rs`. It builds the Tauri app, registers the `fs` and `http` plugins, and exposes the small native command surface for website-source ingest plus iOS deep-link/document-open delivery.

The **frontend** entry is the web shell's, `shells/web/index.html` → `/src/main.js` → `shells/web/src/main.ts`. `src-tauri/tauri.conf.json` points `devUrl` at `http://localhost:5174` (a different port from desktop's 5173, so both dev servers can run at once) and `frontendDist` at `../dist`.

On Android there is a third entry that runs before either: `MainActivity.kt`, described below.

## How the bridge gets composed: build-time module substitution

This is the single most confusing thing about this directory, and until now it was explained only inside the override files themselves.

The web shell's `src/bridge/index.ts` composes the host from **relative sibling imports**: `./state.ts`, `./capabilities-provided.ts`, `./export.ts`. The `overrideBridgeModules` plugin in `vite.config.js` is a `resolveId` hook with `enforce: 'pre'` that intercepts those specifiers and returns a path in `bridge-overrides/` instead. The bridge index itself is unmodified and unaware.

Two details of that hook are hard-won and easy to break:

- It matches on the **extension-less basename** of the specifier, so it fires whether the bridge imports `./state.js` or `./state.ts`. An earlier version keyed on `.js`, and after the web shell's TypeScript migration every override silently stopped firing, so the app shipped browser IndexedDB state instead of the filesystem one.
- It requires the **importer** to live in a `bridge/` directory. This is what makes it safe: it cannot be `resolve.alias`, because a path regex cannot match a relative specifier without also catching same-named files elsewhere in the tree.

### The three overrides, and why each exists

| Module | Replaced with | Why |
|---|---|---|
| `state` | `bridge-overrides/state.ts` | Filesystem state via `tauri-plugin-fs` instead of IndexedDB, at `$APPDATA/Lolly/saved-state/<slot>.json`. The API surface has to match the web original method for method, because nothing downstream knows which implementation is running, so a missing method crashes boot - as of the TS conversion that is enforced: `createFsStateAPI` returns the web module's own `WebStateAPI`, imported type-only, so a method added there and forgotten here fails `npm run typecheck` instead of a device boot. The logic (slot-name codec, legacy-filename migration, record shape, asset-ref collection) lives in `../tauri-shared/bridge-overrides/state-fs.ts`, shared with the desktop shell, because the two copies were byte-identical apart from comments and every fix had to be made twice. What stays here is the `tauri-plugin-fs` adapter passed into it, which is where **mobile-specific divergence** such as iCloud sync or Android scoped storage lands, without touching desktop. It is an adapter rather than a plain import because the Tauri shells are not npm workspaces, so the parent repo cannot resolve `@tauri-apps/plugin-fs`. |
| `capabilities-provided` | `bridge-overrides/capabilities-provided.ts` | The web list, spread, with `'screen'` filtered out and `'filesystem'` added. It spreads rather than re-lists so a capability added on the web side can never silently go missing here. |
| `export` | `bridge-overrides/export.ts` | Delivery only. The web `download()` uses `URL.createObjectURL` plus an `<a download>` click, and the Android WebView has no download handler, so the click is silently dropped and every export no-ops. The override replaces `download` and `file` with a real save through `tauri-plugin-fs`, then hands the file to the OS share sheet. `render()` and the rasteriser are inherited unchanged. |

### What mobile deliberately does *not* override

The desktop shell also overrides `capture`, with a native headless-Chrome implementation. **Mobile does not.** There is no such implementation for iOS or Android, so this shell inherits the web `capture.ts` stub, which throws, and `'capture'` is absent from its capability list so the URL Screenshot tool stays gated off rather than failing at the tap. `'screen'` is subtracted for the same reason: display capture is `getDisplayMedia`, absent on iOS entirely and without a picker in Android's WebView.

A first attempt at native iOS capture (a `bridge-overrides/capture.ts` plus a `src-tauri/src/capture.rs`) was deleted 2026-09-05. It bound the vector pipeline to `WKWebView` through the typed `objc2-web-kit` crate, whose bindings declare `WKWebView` with the macOS superclass chain, so the import does not resolve on the `aarch64-apple-ios` target. Neither file was ever wired in (the Rust module was not a `mod` in `lib.rs`; the vite override key was never added). If iOS capture is picked up again, reach for a Swift plugin instead - WKWebView's `createPDF` is a short call in Swift/UIKit, and Tauri v2 supports iOS plugins.

That pattern, subtract a capability rather than let a tool fail at the tap, is the rule these two shells follow. Compare [`../tauri-desktop/README.md`](../tauri-desktop/README.md) before changing it.

There is also no `site-fetch` bridge override (a stale vite.config.js map key for one was removed 2026-09-05, and it never fired). The Design System studio's Website source calls the native `site_fetch` command directly: it probes Tauri's own `__TAURI_INTERNALS__.invoke` global at runtime (`detectSiteTransport` in `shells/web/src/lib/design-system/sources/website.ts`) rather than going through a build-time module substitution.

The `export` override opens with `export * from '../../web/src/bridge/export.ts'` for the same reason the desktop one does: the substitution replaces that module for **every** importer inside `bridge/`, so it has to carry the original's whole public surface or a sibling such as `export-pptx.ts` fails the build. The star re-export forwards live bindings, which matters because the web module assigns an `export let _host`.

### `vite.config.js` also carries two other plugins

- **`jsToTsFallback`** maps a missing `.js` specifier to its sibling `.ts`. The web shell's `index.html` still names `/src/main.js`; the plugin only fires when the `.js` is genuinely absent and the `.ts` exists.
- **`bundleRepoDirs`** serves `/tools/` and `/catalog/` from the repo root in dev, and copies them into `dist/` on build with `dereference: true`, because those paths are symlink farms built by `scripts/use-profile.ts`.

`build.target` and `optimizeDeps.esbuildOptions.target` are both `esnext` because harfbuzzjs, the text-to-path WASM, uses top-level await, which the default `es2020` target rejects. Without it `build:ios` fails in esbuild transpile.

## The Rust side, and the Android project

`src-tauri/Cargo.toml` declares `lolly-mobile`, edition 2021, with `tauri` (`devtools` feature), `tauri-plugin-fs`, bounded native `reqwest` commands, `serde` and `serde_json`. `src-tauri/capabilities/default.json` grants only the filesystem verbs used by state/pack storage and export, with exact scopes for `$APPDATA/saved-state/**`, `$APPDATA/pack-store/**`, and the Lolly subfolder under the platform's Downloads/Files root; it cannot traverse the rest of those base directories. There is no raw HTTP plugin permission: `remote_fetch` accepts only HTTPS, pins public DNS answers, rechecks redirects, strips credentials on cross-origin redirects, and caps headers and bodies while still supporting remote instances and user-chosen providers. The Content Security Policy is a `<meta>` tag in the built `index.html`, written by the shared `../tauri-shared/vite-csp.mjs` plugin, and `tauri.conf.json` keeps `app.security.csp`/`devCsp` null on purpose: with a CSP in the config, Tauri's codegen re-serialises every `.html` asset (the signed tool templates included), so the catalog digests no longer match and no tool loads under the release build's verified-only trust mode (`tests/tauri-csp.test.ts` pins this). `unsafe-eval` remains temporarily because verified built-in tool hooks still use the compatibility executor.

The interesting native code is Kotlin, and it is **committed**, which is unusual for a `gen/` directory. `src-tauri/gen/android/` is a real Android Studio project carrying hand-maintained source, and this shell's `.gitignore` says so explicitly: it ignores only `src-tauri/gen/schemas/` (pure regenerated ACL output) and lets the nested `gen/android/.gitignore` exclude the Gradle and IDE noise. Blanket-ignoring the parent directory once shadowed that and left the hand edits untracked with no way to survive a fresh clone.

What is hand-maintained in there:

- **`app/src/main/java/tools/lolly/mobile/MainActivity.kt`** extends `TauriActivity` and does two jobs. Inbound: it handles `ACTION_SEND`, `ACTION_SEND_MULTIPLE` and provider-backed `ACTION_VIEW` documents, reads the shared/opened file into a capped in-memory slot and exposes it to the WebView through a `@JavascriptInterface` object registered as **`LollyShare`**, which the web shell's share-target ingest polls. It only ingests on a genuinely fresh launch, because after a process death Android redelivers its own persisted launch Intent and would otherwise resurrect an already-handled file. Outbound: `shareFile()` fires `ACTION_SEND` through a `FileProvider`, which is what the `export` override calls after saving.
- **`AndroidManifest.xml`** carries the `SEND` intent filter and the `FileProvider` declaration, and **`res/xml/file_paths.xml`** the provider paths.

## Deep links: `lolly://` and App Links

Both mobile apps open the `lolly://` scheme (the grammar is in `docs/url-mode.md`, the mapper in `shells/web/src/lib/deep-link.ts`), and Android also opens `https://lolly.tools/t/…` App Links (plan 171, pending the `assetlinks.json` fingerprint).

- **Android** - `AndroidManifest.xml` carries a `BROWSABLE` VIEW filter for the scheme beside the App-Link filter; `MainActivity.ingestViewIntent` stashes either kind of link on the `LollyShare` bridge (`pendingDeepLink`, latest wins, consumed on read) and fires the `lolly-deep-link` window event when the app is already running.
- **iOS** - `gen/apple/lolly-mobile_iOS/Info.plist` declares `CFBundleURLTypes` for the scheme; iOS delivers an open as `RunEvent::Opened`, which `src/lib.rs` queues in `MobileEvents`, and the web shell drains through the `mobile_poll_events` command.

The web side is one function, `initDeepLinkIntake` in `shells/web/src/lib/drop-router.ts`: it prefers the Android bridge and polls the Rust queue only where that bridge is absent, so a link that arrives before the web shell boots is not lost on either platform.

## `.lolly` documents

`bundle.fileAssociations` declares `.lolly` as `application/vnd.lolly+zip`, with the
exported Apple UTI `tools.lolly.pack` and Android `VIEW` intent action. The generated iOS
Info.plist therefore makes Lolly an owner/editor in Files and share sheets; the generated
Android manifest makes Lolly an **Open with** target for a matching content document.

Registration is paired with intake, not just metadata:

- **Android:** an `ACTION_VIEW content://…` takes the same capped `LollyShare` byte slot as
  an inbound share. The JS side constructs a `File` and runs the universal importer.
- **iOS/iPadOS:** `RunEvent::Opened` captures a `file://` document's bytes immediately while
  its security-scoped URL is live, retains at most four files at 48 MB each, and gives the
  web shell a one-use token. `mobile_take_open_file` returns those bytes to that same importer.

In both cases an opened `.lolly`, a file chosen inside the app and a dropped/shared file all
land on the same integrity-checking `lolly-pack.ts` reader.

The bundle also declares lower-priority **Open with** support for the foreign formats that
router can genuinely handle: `.penpot`, `.fig`, `.idml`, PDF-compatible `.ai`, `.svg`, `.pdf`,
`.xlsx`, `.csv`, `.tsv`, `.pptx`, `.docx`, `.psd`, `.psb` and `.xcf`. `.lolly` alone is ranked
Owner; every helper association is Alternate. A spreadsheet is handed to the dedicated
on-device Spreadsheet utility. Raw `.indd` is intentionally absent because its useful route
requires an exported IDML package.

## Run it

```bash
npm run dev:android    # tauri android dev
npm run dev:ios        # tauri ios dev
npm run dev:frontend   # just vite, in a desktop browser, with the mobile overrides active
```

`dev:frontend` is the fast loop for anything that is not native: it exercises the override modules with no Android or Xcode toolchain, though `tauri-plugin-fs` calls will fail without an `invoke` host.

## Build it

```bash
npm run build:android   # build:frontend then tauri android build
npm run build:ios       # build:frontend then tauri ios build
npm run build:frontend  # frontend only, into ./dist
```

Android needs the SDK, NDK and a JDK; iOS needs Xcode and `minimumSystemVersion` 14.3 or later per `tauri.conf.json`.

`tsconfig.json` here typechecks `bridge-overrides/` only - the frontend is covered by `tsc -p shells/web`. It is reached from the umbrella's `npm run typecheck` through `scripts/typecheck-tauri.ts` rather than as a bare `tsc -p` step, because the overrides import `@tauri-apps/api` and `@tauri-apps/plugin-fs` and **this shell is not an npm workspace**, so a root `npm ci` never creates its `node_modules`. That script SKIPS with a logged reason when they are absent, so a plain clone is not punished; CI installs both Tauri shells (`--omit=dev`) and then re-runs it with `--strict`, which fails on a skip, so the gate cannot quietly become a no-op. To run it locally:

```bash
npm --prefix shells/tauri-mobile ci --omit=dev   # once
npm run typecheck:tauri
```

## Surprising things

- Everything under [How the bridge gets composed](#how-the-bridge-gets-composed-build-time-module-substitution).
- **Android's "Downloads" is not the user's Downloads.** `BaseDirectory.Download` here is the app-private external files directory, invisible to most users, which is exactly why the `export` override follows the save with a share-sheet handoff rather than just showing a saved toast. On iOS, or on a build without the `LollyShare` interface, it falls back to the toast.
- **`src-tauri/gen/android/` is committed on purpose.** Do not add it to `.gitignore`, and do not assume a Tauri regeneration is lossless there.
- **A state file name must not begin with a dot.** `tauri-plugin-fs` defaults `require_literal_leading_dot` to `cfg!(unix)`, true on Android, so the `$APPDATA/saved-state/**` scope cannot match a dotfile and every access to one is rejected as a forbidden path.
- `vite.config.js` is still `.js` while `bridge-overrides/` is now `.ts`. The Vite config is a build-tool file (Biome excludes `**/*.config.js` repo-wide) and is not part of the shipped app; the overrides are.

## Submodule caveat

This shell builds **inside the umbrella repo** and nowhere else. Its Vite root is `../web`, its overrides import `../../web/src/bridge/…`, it resolves `@lolly/engine` and `@tauri-apps/*` through the umbrella's workspaces and its own `package-lock.json`, and it copies the repo-root `tools/` and `catalog/` profile views into `dist/`. A standalone clone of `lolly-mobile` builds nothing at all.

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
# or, in an existing clone, BEFORE npm install:
git submodule update --init --recursive
```

Commit changes to files in this directory in the `lolly-mobile` repo, then commit the moved pointer in the umbrella. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md) section 4.
