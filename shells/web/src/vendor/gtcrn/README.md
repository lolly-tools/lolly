# Vendored GTCRN (WebAssembly)

`gtcrn-core.mjs` is the GTCRN speech-enhancement engine (an ultra-lightweight
48.2K-parameter model, ICASSP 2024) from **@sapphi-red/web-noise-suppressor
0.4.0** (MIT), with two patches: the AudioWorklet registration is sliced off so
the raw Emscripten factory and the per-channel `GtcrnProcessor` are importable
headlessly, and `gtcrn.wasm` is base64-embedded so node tests and the browser
load the identical bytes with no fetch seam (the stretcher precedent).
`shells/web/src/lib/audio-clean-core.ts` drives it (PCM in, PCM out) for the
fx grammar's `clean()` entry - the export mix, the preview bounce and node:test
all run the IDENTICAL model.

**Do not hand-edit `gtcrn-core.mjs`.** Regenerate from the npm tarball:

```
npm pack @sapphi-red/web-noise-suppressor@0.4.0 && tar xzf *.tgz
# slice package/dist/gtcrn/workletProcessor.js at the marker
#   var s=class extends AudioWorkletProcessor
# then append the wasm-embed + export block (see the patch comment in the file).
```

## Provenance and checksums

- Source: `@sapphi-red/web-noise-suppressor@0.4.0` from the public npm registry.
- Upstream `dist/gtcrn/workletProcessor.js` sha256:
  `96f24f42e0e839ad7fd73bd146bae6c63ccfc1b9e6cfb6356d8a47c7b5dfa1af`
- Upstream `dist/gtcrn.wasm` sha256 (the embedded bytes):
  `01a5286ddaa1ce6d0dd5510bd9241f3bf0cc727a05d5767ae6881d85d9983719`
- Patched `gtcrn-core.mjs` sha256 (pinned by tests/audio-clean.test.ts):
  `d7a9b779510e8328374591ea901ad4d4c2784d1fe98bc38ead05e4039f2983ff`
- THE PATCH: everything from the worklet-registration marker onward is dropped;
  a base64 embed of the upstream wasm plus
  `export { i as gtcrnFactory, r as GtcrnProcessor }` and `gtcrnWasmBinary()`
  is appended. The minified identifiers `i`/`r` are stable properties of this
  exact upstream build - a version bump re-verifies them.
- The engine exposes a NATIVE 48 kHz path (`_gtcrn_process_48k`, 768-sample
  frames) beside the model's 16 kHz form - the driver uses it, so the mix never
  resamples.

## Licensing

- GTCRN model + weights: **MIT**, (c) 2024 Rong Xiaobin - the official
  [Xiaobin-Rong/gtcrn](https://github.com/Xiaobin-Rong/gtcrn) repository is MIT
  and ships its checkpoints under the same terms (trained on DNS3 /
  VCTK-DEMAND). License text carried in the file header and
  `LICENSE.gtcrn.txt`.
- pffft (the FFT inside the wasm): BSD-style (UCAR/NCAR + Pommier/Ayguen/
  Mambro) - `LICENSE.pffft.txt`, also carried in the file header.
- Wrapper build: MIT, sapphi-red (`@sapphi-red/web-noise-suppressor`).

All reproduced in THIRD-PARTY-NOTICES.md via `scripts/build-licenses.ts`.
