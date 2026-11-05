# Audio loudness, repair and clip alignment

Lolly's browser and Node shells use one committed `audio-dsp.wasm` for three jobs: a full EBU R128 loudness reading (momentary, short-term, integrated, loudness range, sample peak and true peak), model-free audio repair (steady-noise reduction, mains-hum removal, de-essing, click repair and room-echo reduction) and finding the offset between two recordings of the same event (GCC-PHAT). The engine never loads the module. `engine/src/audio-repair.ts` only plans the repair stages, the shells run them and hand the repaired PCM to `cleanAudioPcm` as `repaired`, so the engine stays free of WebAssembly. The model-free repair sits beside the model-based speech clean-up in `cleanAudioPcm`, not in place of it.

The DSP is FilmCraft's `audio-dsp` crate (MIT OR Apache-2.0) at commit `9c6d66114c71179f66d21933b6bf6b88311adf46`, unchanged, under `vendor/filmcraft-audio-dsp/`. It has no dependencies and no unsafe code. The clean-room statement and its limits are in `vendor/filmcraft-audio-dsp/UPSTREAM.md`. The Lolly byte adapter in `src/lib.rs` is MPL-2.0.

## ABI

`audio_dsp_alloc`, `_free`, `_run(ptr, len, op)`, `_result_ptr` and `_result_len`, with no host imports. A request and a reply are a little-endian `u32` JSON length, the JSON, then planar little-endian `f32` samples. Operations: 1 open a meter, 2 push samples, 3 read the meter, 4 open a repair chain, 5 process, 6 flush, 7 align, 8 close a session. Meters and chains are sessions, so a long recording streams through in chunks of a few seconds with bounded memory and the same result however it is cut. The shared wrapper is `packages/node-shell/src/audio-dsp.ts`, the Node loader is `audio-dsp-node.ts` and the browser runs it in `shells/web/src/lib/audio-dsp-worker.ts`.

## Numbers

| | |
|---|---|
| `.wasm` size | 242,791 bytes raw, 89,510 bytes gzip (budget 1.5 MB raw or 600 KB gzip) |
| Stereo, 25 s of speech-like signal | loudness reading in a few hundred milliseconds in Node |
| Declared limits | 160 MiB per request, 8 sessions, 8 channels, 192 kHz, 12M samples per clip when aligning, 512 MiB memory |

Against ffmpeg `ebur128` on the stored readings in `tests/fixtures/audio-dsp/ebur128-reference.json` (sine, pink noise, speech-like, gated stereo, an inter-sample peak and a 44.1 kHz mono programme): integrated within 0.01 LU, loudness range within 0.05 LU, momentary and short-term within 0.002 LU, true peak within 0.1 dB of the analytic value. Regenerate the readings with `node scripts/audio-dsp-oracle.ts` (needs ffmpeg).

## Rebuild and test

`pnpm run build:audio-dsp` rebuilds the module and `LICENSES.txt`. `cargo test -p lolly-audio-dsp` runs the adapter tests. `cargo test --release -p filmcraft-audio-dsp --lib` runs the vendored crate's own tests; run it in release mode, because one upstream timing test fails in a debug build. `node --test tests/audio-dsp.test.ts` runs the Node tests.
