# Portable Photoshop adapter

Lolly's browser and Node shells use the same committed `adobe-psd.wasm` and shared TypeScript preview mapping. Ordinary RGB, grayscale and CMYK imports retain the established TypeScript reader. Files refused for colour mode or depth can use this adapter for bounded 8/16/32-bit RGB, grayscale, CMYK and Lab previews.

The source parser and writer are PhotoCraft's MIT OR Apache-2.0 `photocraft-psd` crate at commit `7eb3b2e072aa3110da2a329bb49109744292a87b`. Its source, licence choices and NOTICE are under `vendor/photocraft-psd/`. The Lolly byte adapter is MPL-2.0. The main ArtCraft editor and services are excluded.

Build with Rust 1.96.0 and the `wasm32-unknown-unknown` target:

```sh
rustup target add wasm32-unknown-unknown
pnpm run build:adobe-psd
pnpm run fetch:adobe-corpus
pnpm run verify:adobe-corpus
```

The build uses `Cargo.lock`; intermediates and downloaded corpora live in ignored `plans/` storage. Input is capped at 64 MiB, decoded data at 128 MiB, metadata at 2 MiB, layers at 1024 and WASM memory at 512 MiB. A caller's decode budget includes raw samples and RGBA preview allocations. No-edit preservation is a separate operation from Lolly's composed PSD export. The preview uses 8-bit display pixels; 32-bit HDR values are clipped for display and Lab is converted to sRGB. Source bytes, unknown blocks and source precision remain available to the preservation writer. Semantic edit-back and visual parity across all Photoshop features are outside this adapter's contract.
