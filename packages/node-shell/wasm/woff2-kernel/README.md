# WOFF2 decoder

Lolly's browser, command line, desktop and MCP shells share one committed `woff2-kernel.wasm` that turns a WOFF2 web font back into the TrueType or OpenType bytes HarfBuzz and the font readers need. Every caller reaches it through `decodeWoff2` in `packages/node-shell/src/woff2.ts`, which reads the header first, runs each font in a worker of its own and checks what comes back.

## What is inside

- [wuff](https://crates.io/crates/wuff) 0.2.10 (MIT), Nico Burns's hand port of Google's woff2 C++ library, which rebuilds the font tables. It has no unsafe code. Its bundled Brotli and zlib backends are turned off.
- [brotli-decompressor](https://crates.io/crates/brotli-decompressor) 6.2.0 (BSD-3-Clause or MIT), Dropbox's Rust Brotli decoder, with alloc-no-stdlib 3.0.0. This is a separate code base from Google's C decoder. It is built without its `unsafe` feature, so the crate's own `forbid(unsafe_code)` applies, as it does in alloc-no-stdlib. 6.2.0 returns an error for the block switch behind CVE-2026-111497 in the C decoder; earlier releases panic on such a stream.
- bytes 1.12.1 (MIT), which wuff reads and writes through. Of the linked crates, only bytes contains unsafe code.
- The Lolly byte adapter in `src/lib.rs` (MPL-2.0). It forbids unsafe code in its decoding module; the exported functions allow it only for their symbol names.

The three crates are the versions wuff 0.2.10's own `Cargo.lock` pins, so the module is built from the set wuff was published and tested with. wuff publishes no licence file in its crate, so `LICENSE.wuff` is the `LICENSE` of its repository at the commit the crate was published from (`0bb77cb3448100b8f560abf796014c8b85d75e23`).

## What the adapter adds

- A Brotli target over 30 MiB is refused before the buffer for it is allocated.
- The Brotli stream is read in RFC 7932 mode. The large-window extension, which allows windows up to 1 GiB, is refused, as Google's decoder refuses it by default.
- An allocation the module cannot make is a refusal with a reason, not a trap.

The module is linked with a 256 MiB memory ceiling and a 1 MiB stack and imports nothing from the host. Each shell compiles it once and instantiates it afresh for every font, so nothing one decode leaves in memory reaches the next.

## Interface

The raw ABI is `woff2_alloc`, `woff2_free`, `woff2_run(ptr, len, op)`, `woff2_result_ptr` and `woff2_result_len`. Operation 1 decodes one WOFF2 file: status 0 leaves the sfnt (or collection) bytes in the result, status 1 a plain-text reason. `packages/node-shell/src/woff2-kernel.ts` is the TypeScript side.

## Output

For all 23 public WOFF2 fonts in the tree the module returns the same bytes woff2-encoder 2.0.0 (google/woff2 with Brotli 1.0.3) returned; the SHA-256 values are pinned in `packages/node-shell/test/fixtures/woff2-corpus.json`. One known difference: wuff refuses a file whose header declares a totalSfntSize of zero, which google/woff2 ignored. No real font declares zero.

## Building

Build with Rust 1.96.0 and the `wasm32-unknown-unknown` target:

```sh
rustup target add wasm32-unknown-unknown
pnpm run build:woff2-kernel
```

The build uses `Cargo.lock` and writes source paths under fixed prefixes, so the same source builds the same bytes wherever the repository is checked out. It also rewrites `LICENSES.txt`. Run the adapter's own tests with `cargo test` in this directory.
