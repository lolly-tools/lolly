# Camera raw decoder

Lolly's browser, command line and Node shells share one committed `camera-raw.wasm` and a small TypeScript wrapper (`packages/node-shell/src/camera-raw.ts`). It develops a camera raw file into a picture on the device, with no upload.

The source decoder is PhotoCraft's MIT OR Apache-2.0 `photocraft-raw` crate at commit `97a83f074f5407841a1444ee3f9be478ce03368b`. Its source, licence choices, NOTICE, edits and clean-room caveats are under `vendor/photocraft-raw/`. The JPEG XL decoder is left out. The Lolly byte adapter in `src/` is MPL-2.0.

## What it returns

- 16-bit linear ProPhoto RGB (`developLinear`), or sRGB 8-bit RGBA for display (`developDisplay`), already upright.
- Metadata: format, make, model, ISO, exposure time, aperture, orientation, baseline exposure, white balance (multipliers and source), the DNG colour matrices (ColorMatrix, ForwardMatrix, CameraCalibration, AnalogBalance), the CFA pattern, warnings, and whether the colour is exact.
- DNG files use the matrices they carry and are labelled **exact colour**. Every other raw format has no embedded matrices, so the colour is a per-file fit of a 3x3 matrix and a tone curve to the camera's own embedded JPEG, labelled **approximate colour** wherever the user sees it. When the fit is not clearly better than a neutral rendering the neutral rendering is used and the label stays.
- Variants the crate cannot decode (Canon CR3 and sRAW, compressed RAF, Pentax compressed PEF, JPEG XL DNG) fall back to the embedded JPEG preview, labelled as a preview.

## Limits

The module is linked with a 512 MiB memory ceiling and a 1 MiB stack. A file is refused with a message before development when the input, the sensor data and the 16-bit frame together would exceed 480 MiB (about 50 megapixels at typical raw sizes), when it has more than 64 megapixels, or when it is larger than 192 MiB. Development takes seconds, so the web shell runs it on a worker.

Build with Rust 1.96.0 and the `wasm32-unknown-unknown` target:

```sh
rustup target add wasm32-unknown-unknown
pnpm run build:camera-raw
node scripts/camera-raw-corpus.ts --fetch   # CC0 files from raw.pixls.us into plans/corpora/camera-raw
node scripts/camera-raw-corpus.ts           # decode every file and print the report
```

The build uses `Cargo.lock`; intermediates and downloaded corpora live in ignored `plans/` storage. The release profile uses `opt-level = 3`: it is three times faster than `s` on a 12 megapixel file and costs 90 KB of wasm.
