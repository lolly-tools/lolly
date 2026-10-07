# Pixel kernel reference

First-party MPL-2.0 Rust code, with no registry dependencies. This initial module
is the numerical reference for `lut-webgpu-v1`. The creative shell executes LUT
sampling with WebGPU; this WASM module is used by comparison tests.

From the repository root, run `pnpm run build:pixel-kernel`. The toolchain is
pinned to Rust 1.96.0 with `wasm32-unknown-unknown`. Cargo.lock, release settings
and the build script pin the source graph, optimisation, 192 MiB linear-memory
ceiling and 1 MiB stack. The committed WASM lets Node tests run without Rust.
Native checks use `cargo test --locked` from this directory.

The byte ABI exports `memory`, `lolly_alloc(length)`, `lolly_free(pointer)`,
`lolly_allocated_bytes()` and `lolly_grade_lut(pixels, samples, kind, size,
intensity, minR, minG, minB, maxR, maxG, maxB)`. Pointers identify live owned
allocations; unknown or identical input handles fail. LUT samples are
little-endian float32 triples in red-fastest order. Kind 0 is 1D, kind 1 is 3D.
Status 0 means success, 1 invalid handles, 2 rejected input or allocation failure.
The pixels are changed only after validation. Callers copy output and free both
allocations in `finally`.

Admission limits are 8,388,608 RGBA8 pixels, LUT sizes 2 through 129, finite
samples with absolute value at most 64, and finite domain endpoints with absolute
value at most 1,000,000. A nonzero domain span that collapses in float32 is
rejected. Intensity is finite and clamped to 0 through 1. Each owned allocation
is at most 32 MiB; the registry accounts at most 80 MiB. Temporary table decoding
also lives within the linear-memory ceiling. The implementation uses safe Rust
buffers; the narrowly allowed attributes expose symbol names, with no unsafe
memory access.

The reference uses float64 arithmetic in the established TypeScript order and
rounds ties to even. Alpha bytes are preserved. GPU interpolation uses float32;
the admitted comparison corpus allows at most one RGB code value of error, with
exact alpha and selected identity, constant and no-op cases. This bound is tested
per adapter, not a promise of universal byte identity.

Run `node --test packages/node-shell/test/pixel-kernel.test.ts` for WASM/TypeScript
comparison and allocation checks. `pnpm run test:webgpu` requires an installed
Chrome and a usable adapter, and fails on absence. Set `LOLLY_BROWSER_CHANNEL`
for another installed Chromium channel. CI explicitly selects software WebGPU
with `LOLLY_WEBGPU_TEST_ADAPTER=swiftshader`; hardware evidence uses the default
adapter. The test flags follow [Chromium's WebGPU test configuration](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/web_tests/FlagSpecificConfig).

The web executor supports up to eight RGBA8 LUT passes with one upload and final
readback. Warm jobs reuse a device-owned pair of frame buffers, readback buffer
and aligned parameter slots; LUT tables remain per-job. Frame/uniform buffers
plus active tables are bounded at 128 MiB per device, with a 32 MiB table ceiling.
Workspaces and the LUT worker expire after 30 seconds idle. Cancellation/failure
releases the affected workspace; loss invalidates every resource on that device.
Worker cancellation holds admission until cleanup acknowledgement or termination.

The required browser suite checks chain equivalence to sequential GPU passes,
warm allocation reuse, smaller readback ranges, cancellation and loss recovery.
Reports include complete cold/warm PNG bakes paired with fresh-worker bakes.
Wider pixel processing, preview residency, geometry, native host integration and
document compilation remain subsequent migration work.
