# PatchMatch inpainting adapter

Lolly's Retouch uses one committed `inpaint.wasm` to remove large objects from a photo. The painted area is rebuilt from similar patches elsewhere in the picture, from a coarse level to a fine one. The engine never loads the module. The shell worker chooses between the engine's Telea fill for small marks and this module for large regions, so the engine stays free of WebAssembly.

The kernel is LightCraft's `lightcraft-inpaint` crate (MIT OR Apache-2.0) at commit `07301cbd1e1cab5c152228891d9c9ed87e263003`, with its thread pool removed. Source, licence choices, provenance and the modifications are under `vendor/lightcraft-inpaint/`. The Lolly byte adapter in `src/lib.rs` is MPL-2.0.

The raw ABI is `inpaint_alloc`, `_free`, `_run(ptr, len, op)`, `_result_ptr`, `_result_len` and `_release_result`. Operation 1 takes a 16-byte header (width, height, patch radius, a zero reserved word, all little-endian), the RGBA bytes and one mask byte per pixel, and returns the RGBA bytes. Only the window around the mask, plus context of half its larger side, is processed. The module imports nothing from the host, has no clock or random source, and gives the same bytes for the same request.

Caps: 16,777,216 pixels per image, a processed window of 13,000,000 pixels, patch radius 1 to 8, 2 GiB of WASM memory.

Size: 63 KB raw, 26 KB gzip. Timing in Node 26 on an Apple-silicon laptop, one thread, on a 4000 by 3000 textured image with one round mask:

| Painted area | Time |
| --- | --- |
| 1% | about 2 to 3 s |
| 5% | about 8 to 10 s |
| 15% | about 28 s |

Rebuild with `pnpm run build:inpaint`. Run the crate tests with `cargo test --workspace` in this directory.
