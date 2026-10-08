# Portable scalar maths

A dependency-free Rust crate that exports `sin`, `cos`, `tan`, `acos`, `cbrt`,
`log2`, `atan2` and `pow` for float64, built for `wasm32-unknown-unknown` with the
pinned toolchain in `rust-toolchain.toml`. The module imports nothing from its
host, so every JavaScript engine that loads these bytes computes the same bits.

The engine embeds the bytes in `engine/src/geom/portable-math-wasm.ts` and
`engine/src/geom/portable-math.ts` calls them for the geometry's transcendental
functions. `geometry-fit-portable.wasm` links the same compiled functions from the
same toolchain, so the TypeScript reference and the WASM fitter agree exactly.

```bash
node scripts/build-portable-math.ts           # rebuild with pinned Rust, then re-embed
node scripts/build-portable-math.ts --check   # no Rust needed: embed equals the committed .wasm
```

A rebuild that changes any byte changes geometry answers: treat it as a new
geometry revision (`GEOMETRY_REVISION` in `packages/node-shell/src/geometry-host.ts`)
and update the pinned digests in `tests/helpers/portable-math-cases.ts`.
`tests/geom-portable-math.test.ts` checks the embed, V8 `hypot` equality, agreement
with the fitter's exports and the pinned digests; the browser test of the same
name requires those digests in Chromium, Firefox and WebKit, main realm and worker.
