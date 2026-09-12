# Releasing the desktop app

Read this before cutting a Flatpak, an RPM, or any other packaged build. Every item
here is something that has actually shipped wrong, not a hypothetical.

## The one that bites hardest

**Any packaging that calls `cargo build` directly MUST pass
`--features tauri/custom-protocol`.**

`tauri build` adds it for you. Tauri's `is_dev()` is literally
`!cfg!(feature = "custom-protocol")` (`tauri/src/lib.rs:309`), so without it you get a
DEVELOPMENT binary that ignores the embedded `frontendDist` and tries to load
`devUrl` (`http://localhost:5173`).

Nothing fails. It compiles, links, exits 0, passes `flatpak-builder-lint`, installs,
launches, and spawns WebKit. The only symptoms:

- the window says **"Could not connect to localhost: Connection refused"**, and
- the binary is **~43 MB instead of ~110 MB**.

**Check the binary size before believing any packaging build.** It is the only
reliable signal. `rpm/lolly-desktop.spec`'s `%check` fails under 80 MB for this reason.

## `build:frontend` does less than `build:web` - know what you are missing

The root `build:web` runs `build:ort`, `build:info`, the OG card generators and then
Vite. This shell's `build:frontend` has historically run only some of that, and each
omission shipped as a silent, user-visible hole:

| Step | Symptom when missing | Status |
|---|---|---|
| `build:info` | `/info` HTML absent, so every in-app `#/docs` route 404s and the footer "What?" button does nothing | **fixed** - `build:frontend` runs it |
| `precacheManifest` | no `dist/precache.json`, so the whole "Available offline" model list reads "Not offered by this server" | **fixed** - plugin added to this shell's vite config |
| `build:ort` | `/ort/` and `/ort-hf/` unstaged. Worse than it first looked: `lib/ort.ts` pins `wasmPaths = '/ort/'` same-origin, so with no `/ort/` in the bundle **every on-device ML tool fails to load its wasm** - background removal, upscale, OCR, ai-detect, reword | **fixed** - `build:frontend` runs it |

`build:ort` also **blocks the web build outright** on a fresh clone, which makes it
worse than it looks. `vite.config.js`'s `ortWasmFromPublic()` plugin hard-fails:

    vite.config: .../ort.bundle.min.mjs loads ort-wasm-simd-threaded.jsep.wasm,
    but public/ort/ort-wasm-simd-threaded.jsep.wasm is missing - run pnpm run build:ort

and because `pnpm run previews` drives a web build, **you cannot rebuild tool previews
without running `pnpm run build:ort` first**. The error surfaces buried under a rolldown
worker-bundling stack trace, so it reads like a bundler bug rather than a missing step.
Run it before `previews`.

If you add a step to `build:web`, ask whether this shell needs it too.

## Tool previews: rebuild them, and decide whether to ship them

`catalog/previews/` is **git-ignored and generated** - 190 per-tool SVG previews built
by `pnpm run previews` (a real browser via Playwright; `pnpm exec playwright install chromium`
first). They are the gallery's tool thumbnails.

```bash
pnpm run build:ort         # REQUIRED FIRST - previews drives a web build, which hard-fails without it
pnpm exec playwright install chromium   # once; the generator renders in a real browser
pnpm run previews          # build-previews + optimize-preview-webp + build-preview-bundle
```

**They are NOT in the default packaged build.** `LOLLY_EMBED_CATALOG` defaults to
`neutral` in both Tauri shells - the deliberate "community/app-store" mode (plans/131
WP-A), whose seed carries no `previews/` and no `og/` because brand content is meant to
arrive from a connected instance or a loaded `.lolly` pack. `assertDistState` asserts
their absence, so this is enforced, not incidental.

The consequence, which is easy to miss until you look at a fresh install: **with no
previews shipped, every tool tile renders itself on first load.** The gallery starts
blank and fills in.

So decide, per release:

- `pnpm run build` - neutral. Small, no thumbnails, tiles generate on first load.
- `pnpm run build:profile` - embeds the active `tools/` + `catalog/` views including
  previews and og cards. On the `lolly-start` profile that content is the public blank
  brand, so it is safe to ship; on `suse` it is NOT (private pack).

Whichever you pick, run `pnpm run previews` first if the tool set changed, or you will
embed stale art.

## Profile safety

The active content profile decides what gets baked in. **`brands/suse` is private and
must never reach a public artifact.** `pnpm run profile` shows which one this checkout
resolves to; `LOLLY_PROFILE=lolly-start` selects the public blank brand for one command.
`rpm/make-sources.sh` and `release/common.sh` both ask the resolver and refuse to run on
the `suse` profile for this reason; the Flathub manifest gets it right
structurally, by pinning this repository as its one source with
`disable-submodules: true`, so `brands/suse` is never fetched.

## Flatpak / Flathub

- Two manifests, deliberately: `flatpak/` unpacks a prebuilt `.deb` (fine for bundles
  we hand out), `flatpak/flathub/` builds from source offline (what Flathub requires).
  Keep app id, runtime version, `command` and `finish-args` in agreement.
- The app id is **`tools.lolly.Desktop`**, capital D. `flatpak-builder-lint` rejects an
  id ending in lowercase `desktop` and the docs say that exception "is never granted".
- Screenshot mirroring errors from `flatpak-builder-lint repo` are expected locally;
  Flathub's own builders mirror automatically.
- Bump `runtime-version` and the CI container tag together. GNOME 47 is EOL and no
  longer published, which is why the manifest moved to 49.

## Arch / AUR

The AUR package (`lolly-desktop-bin`) repacks the released `.deb`, integration files
and all - the PKGBUILD lives in `linux/arch/`, with its README covering the
per-release ritual: bump `pkgver`, update `sha256sums`, regenerate `.SRCINFO`, push to AUR.

## Before you call a build good

1. Binary size is ~110 MB, not ~43 MB.
2. The app launches and **renders its UI** - not just "the process is alive". A missing
   frontend still starts, still spawns WebKit, and still passes every automated check.
3. `dist/info/*.html` is non-empty (docs bundled).
4. `dist/precache.json` exists (offline manager works).
5. If you shipped profile mode, `dist/catalog/previews/` is populated.
