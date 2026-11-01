# Image trace adapter

Lolly's browser and Node shells use one committed `image-trace.wasm` to turn a raster image into filled vector paths. Design's Trace image action runs it in a worker. The engine never loads the module: `engine/src/image-trace.ts` takes the module's output through a function the shell supplies, in the way `readPsdPortable` reaches the PSD module.

The tracer is VectorCraft's `vectorcraft-trace` crate (MIT OR Apache-2.0) at commit `05d5f99fd7e7dc00db3a9754d594b1214945d855`, with its `vectorcraft-geom` dependency. Source, licence choices, upstream's provenance statement with its limits, and the modifications are under `vendor/`. The image decoding code is removed, so the module takes decoded RGBA pixels and decodes no file format. The Lolly byte adapter in `src/lib.rs` is MPL-2.0.

The raw ABI is `image_trace_alloc`, `_free`, `_run(ptr, len, preset)`, `_result_ptr` and `_result_len`. A request is the width and height as little-endian u32, then the RGBA bytes. The preset is 1 logo, 2 illustration, 3 line art or 4 centreline. A result is JSON, or a plain-English message when `_run` returns 1.

Limits: 4 megapixels, 300,000 anchor points, 64 MB of output, 17 MB request. The module imports nothing, uses no clock, random source or thread, and returns the same bytes for the same pixels and preset.

The quality harness is `pnpm run image-trace:quality` (`scripts/image-trace-quality.ts`). It draws its inputs in code and prints colour error (CIEDE2000), anchors, paths and specks per input.

Rebuild with `pnpm run build:image-trace`. Run the vendored crates' own tests with `cargo test --workspace --release` in this directory.
