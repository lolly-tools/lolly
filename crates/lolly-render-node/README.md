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

The same shape as `@resvg/resvg-js`: a main package, `@lolly-tools/render` (`package.json`, `index.cjs`, `index.d.ts`), that loads the binding for the machine it runs on from one of five optional platform packages (`npm/<platform>/`): `darwin-arm64`, `linux-x64-gnu`, `linux-x64-musl`, `linux-arm64-gnu` and `win32-x64-msvc`. There is no `darwin-x64`, because Intel Macs are no longer built for. Every package is `private: true`, so `npm publish` refuses them.

`.github/workflows/lolly-render-addon.yml` builds each platform on its own runner (musl inside Alpine), runs the unit tests and `test/smoke.cjs` where the runner can load the build, prints the oldest glibc a Linux build needs, and packs the six packages as artefacts. It runs on a manual dispatch and on changes under the two crates. It holds no registry token and no `id-token` permission, and it publishes nothing.

## Getting the binary to people

Two ways were weighed; the choice is the maintainer's.

1. **npm packages under `@lolly-tools`, published with provenance (recommended).** A person runs a publish workflow, like `publish-core.yml`, that uses npm Trusted Publishing and `npm publish --provenance`, after this workflow's artefacts are checked. `packages/node-shell` then lists `@lolly-tools/render` in `optionalDependencies`, which `scripts/pack-cli.ts` already copies into the CLI package, as it does for `@resvg/resvg-js`.
   - npm installs only the one binary the machine needs (1.5 MB on macOS arm64), and a machine with none still installs: the loader reports the binding absent and the default route draws.
   - Each binary carries a provenance statement naming the commit and workflow that built it, which `npm audit signatures` checks.
   - The TUI, the MCP server and the container images get the same binary through the same dependency.
   - The cost: six package names to publish together at each release, and an install that fetches the binary from the registry.
2. **The binaries inside the CLI tarball.** `scripts/pack-cli.ts` would copy all five builds into the package. One file to publish and no extra names, but every install carries every platform's binary (about five times the size), the pack step would depend on another workflow's artefacts, the binaries would carry no provenance of their own (the CLI is attached to a GitHub release and published by hand), and the other Node shells would need their own copies.

## Not verified

- Any build other than macOS arm64: the workflow is written and has not run. Linux musl is built inside Alpine with `-crt-static` off, untried here.
- The oldest glibc the Linux builds need: printed by the workflow, not measured. Runners build against a recent glibc, so an older Linux (SUSE Linux Enterprise 15 among them) may need a build against an older one.
- The TUI's use of the opt-in: wired as the CLI's is, not exercised by a test.
