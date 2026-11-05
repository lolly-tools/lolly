# VectorCraft image tracer

Source: https://github.com/storytold/vectorcraft/tree/05d5f99fd7e7dc00db3a9754d594b1214945d855/crates/trace
Commit: 05d5f99fd7e7dc00db3a9754d594b1214945d855 (workspace version 0.19.0)
Licence: MIT OR Apache-2.0. The upstream licence files are retained here, and the NOTICE keeps only the copyright and licence paragraph. The upstream third-party section covers fonts and icons in the VectorCraft application, none of which is included here. The ArtCraft name and logos are trademarks that the licence does not cover, and none are included.

Provenance statement, copied from the crate's own documentation and recorded with its stated limit: upstream describes this as "a clean-room tracer built from the published ideas behind bitmap tracers (the potrace paper and classic colour quantisation), not from any existing implementation". Lolly has not audited that claim independently and relies on the upstream statement. Upstream's own quality document compares the output only with the open tracer Inkscape Trace Bitmap, and its inputs are not committed.

Modifications by Lolly:
- Cargo.toml is standalone: workspace inheritance is replaced by explicit versions, the `image` dependency is removed, and `serde_json` is a dev-dependency only.
- src/raster.rs: `Raster::decode`, `Raster::decode_to_fit`, `Raster::encode_png` and the `MAX_SOURCE_PIXELS` constant are removed, because they were the only users of the `image` crate. `Raster` stays a plain RGBA buffer built with `Raster::new`.
- src/lib.rs and src/quantize.rs: the test-only re-exports for the removed upstream test suite are dropped.
- src/tests.rs (the 2,636-line integration test file) and the crate's `tests/` directory are not vendored, because they decode images and use upstream's test kit. The unit tests inside the other source files are kept. Lolly's own tests are in `tests/image-trace.test.ts`.
All other source files are unchanged. The tracer's parallel layer map has a serial path for wasm32 (`layers.rs`), which is the only path this module compiles. No clock, random source or thread is used, and the k-means seeds are fixed constants.
