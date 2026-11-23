# lolly-render-node

The Node binding of [`lolly-render`](../lolly-render/README.md), built with napi-rs. It takes the lolly-render envelope (a compiled Design page and its pictures, as JSON text or a Buffer) and gives back a result object: the page drawn, or the reasons it was not.

**No default route uses this binding.** The Node shells load the binding only when `LOLLY_DESIGN_RASTER=lolly-render` asks for it (`packages/node-shell/src/lolly-render.ts` finds it, `packages/node-shell/src/design-still.ts` calls it), and a page it refuses, or a machine without it, goes on to the default route with the reason in the log.

## What it exposes

```ts
admit(envelope)            // { ok, width, height } or the refusals; reads the page, draws nothing
renderPng(envelope)        // { ok, png } with the crate's own PNG encoder
renderRgba(envelope)       // { ok, rgba, width, height }: straight RGBA8 rows
renderPngAsync(envelope)   // the same, on the libuv thread pool
renderRgbaAsync(envelope)
renderer()                 // "lolly-render-0.1.0+tiny-skia-0.12.0-scalar"
refusalCodes()             // the crate's stable codes, then "internal"
```

A refused page is a value, `{ ok: false, code, detail, refusals: [{ code, id, detail }] }`, never a thrown string. A panic inside the renderer is caught here and returned as the `internal` refusal; the release profile unwinds for that reason. The only throw is for an argument that is neither a string nor a Buffer. An envelope over 64 MiB is refused before the renderer sees a byte (a Buffer is not copied for that check; a string has already been converted by Node-API); every other limit is the core crate's. `lolly-render` keeps `forbid(unsafe_code)`; this crate holds only the Node-API glue, which napi-rs's macros write with `unsafe` blocks.

## Building it here

```bash
cargo build --release          # the toolchain in rust-toolchain.toml
cargo test --release           # the panic guard and the result shapes
cargo +stable fmt --check && cargo +stable clippy --all-targets -- -D warnings
```

The loader finds `target/release/liblolly_render_node.dylib` (or `.so`, `lolly_render_node.dll`) in this checkout by itself; `LOLLY_RENDER_ADDON=<path>` names another build. Then:

```bash
LOLLY_DESIGN_RASTER=lolly-render pnpm run cli design --s=cover --export=png --output=cover.png ...
```

To try the package's own loader, copy the build beside `index.cjs` as `lolly-render.<platform>.node` (for example `lolly-render.darwin-arm64.node`) and run `node test/smoke.cjs`: every core fixture must draw to the bytes pinned in `../lolly-render/tests/render.rs`.

`LICENSES.txt` lists every crate linked into the binding with its licence text; `node scripts/build-lolly-render-notices.ts` writes it from the pinned `Cargo.lock`, and `--check` fails when it is not current.

## Packages

The same shape as `@resvg/resvg-js`: a main package, `@lolly-tools/render` (`package.json`, `index.cjs`, `index.d.ts`), that loads the binding for the machine it runs on from one of five optional platform packages (`npm/<platform>/`): `darwin-arm64`, `linux-x64-gnu`, `linux-x64-musl`, `linux-arm64-gnu` and `win32-x64-msvc`. There is no `darwin-x64`, because Intel Macs are no longer built for. The packages carry the Lolly release version, as the CLI does (`tests/release-version-sync.test.ts`); the crates keep their own semver. Every package is `private: true` in the tree, so nothing can be published by accident.

`.github/workflows/lolly-render-addon.yml` builds each platform on its own runner, runs the unit tests and `test/smoke.cjs` (the eight core fixtures must draw to their pinned bytes through the package's own loader), and packs the six packages as artefacts. It runs on a manual dispatch and on changes under the two crates, holds no registry token and no `id-token` permission, and publishes nothing.

## The glibc floor

The Linux gnu builds run on SUSE Linux Enterprise Server 15 SP7 and 16.1, the latest point releases of 15 and 16, so the floor is the lower of the two glibc versions: **glibc 2.38**.

- SLES 15 SP7 ships glibc 2.38: release notes, section "glibc 2.38" (<https://www.suse.com/releasenotes/x86_64/SUSE-SLES/15-SP7/index.html>), and the package `glibc-2.38-150600.14.61.1` in the Basesystem Module 15 SP7 (SUSE Customer Center package search for product `SLES/15.7/x86_64`, <https://scc.suse.com/api/package_search/packages?product_id=2793&query=glibc>).
- SLES 16.1 ships glibc 2.40: the package `glibc-2.40-160100.4.1` (the same search for `SLES/16.1/x86_64`, <https://scc.suse.com/api/package_search/packages?product_id=3231&query=glibc>; 16.0 also shipped 2.40); 16.1's release notes were published 2026-11-18 (<https://documentation.suse.com/releasenotes/sles/16.1/index.html>).

The workflow builds `linux-x64-gnu` and `linux-arm64-gnu` inside the SLE BCI base image for 15 SP7 (`registry.suse.com/bci/bci-base:15.7`, pinned by digest), so they link against glibc 2.38 and `test/smoke.cjs` loads them there. A step reads the highest `GLIBC_` symbol version the binding needs (`objdump -T`) and fails the job above 2.38. Read on 2026-11-23; a later point release with an older glibc would lower the floor.

## Publishing

npm under `@lolly-tools`, with Trusted Publishing and provenance (the maintainer's decision, 2026-11-23). `.github/workflows/publish-lolly-render.yml` is the only way to publish, and only a person can start it: a manual dispatch of main, a `confirm` input that reads exactly `publish @lolly-tools/render <version>`, a version equal to the release version that every package declares, no package still private, then approval in the `release-npm` environment, the only job that holds the OIDC identity. It reuses the build workflow and publishes the five platform packages, then the main one, each with `npm publish --provenance`.

At release time:
1. In the release commit, remove `"private": true` from the six `package.json` files (the versions already follow the release).
2. Once, before the first release: create the `release-npm` environment with required reviewers and a main-only branch policy, as `release-images` has, and on npmjs.com name this repository, `publish-lolly-render.yml` and `release-npm` as the Trusted Publisher of each package.
3. Add `@lolly-tools/render` to `optionalDependencies` in `packages/node-shell/package.json`; `scripts/pack-cli.ts` carries it into the CLI package as it carries `@resvg/resvg-js`, and npm installs only the one platform binary a machine needs. A machine with none still installs: the loader reports the binding absent and the default route draws.

## Not verified

- Every build but macOS arm64: the workflows are written and have not run. The likeliest to need a fix: musl in Alpine (JavaScript actions in an Alpine container, `-crt-static` off), the SLES 15 SP7 container (the tools it installs with zypper from the BCI repository) and Windows (the unit tests linking with `dyn-symbols`).
- The publish workflow: not run; the `release-npm` environment does not exist yet.
- The TUI's use of the opt-in: wired as the CLI's is, not exercised by a test.
