# JPEG XL

Engine 1.213 adds still JPEG XL imports, exports and Convert operations through the same pinned libjxl WASM on web and Node (0.13.0 since 2026-11-21; see `packages/node-shell/wasm/jxl/README.md`). Native browser support is not required. The codec loads on demand and is available offline after its worker and WASM have been cached.

## Source and editing view

A JPEG XL upload stays one raster asset with `format: jxl` and unchanged encoded bytes. Its ordinary `url` points to a full-resolution, oriented PNG prepared as 8-bit sRGB. `original.url` identifies the encoded source; `host.assets.bytes(ref)` reads it, while fetching `ref.url` reads the editing view. Original download and `.lolly`/beam transfer retain source bytes. History saves the durable identity and recreates both URLs on reopen.

Source dimensions, depth, colour encoding, orientation, HDR indicators and JPEG reconstruction availability are recorded separately from the display depth/space. HDR inputs receive an SDR view; the master is unchanged. Wide colour / HDR editing uses the original float decode in Design and Darkroom, including Sequence. See [HDR editing](../docs/hdr-editing.md). Import refuses animation and auxiliary channels, instead of silently discarding them. A metadata-removal upload preference refuses JXL before storage because a verified JXL metadata scrubber is not available. Explicit large-image resizing remains an optional rewrite under the existing upload policy.

## Output and conversion

- **JPEG XL** encodes the rendered 8-bit sRGB image with lossy colour and lossless alpha. Quality 0.9 is the render default; Convert uses its existing 0.92 default. Effort is 5.
- **JPEG XL lossless** uses the codec's true lossless mode, preserving the supplied rendered samples. A canvas render, resize or colour transform may already have changed the original samples. It never reduces quality to satisfy a byte target.
- **JPEG XL with original JPEG** accepts original JPEG bytes directly. It restores and compares every byte before accepting the copy, including metadata. It refuses resize and byte-target requests. The result may be larger.
- **Restore original JPEG** is offered only after reconstruction succeeds. An ordinary JXL can be rendered into a new JPEG through the separate JPEG target.

CLI examples:

```sh
lolly files convert photo.jpg --to=jxl-recompress --output=photo.jxl
lolly files convert photo.jxl --to=jpeg-original --output=restored.jpg
lolly files convert image.png --to=jxl-lossless --output=image.jxl
lolly qr-code --url=https://example.com --export=jxl-lossless --output=qr.jxl
```

Ordinary conversion drops source descriptive metadata and records its 8-bit SDR boundary. Generated exports can carry new descriptive XMP in a bounded XML box. Original preservation is distinct from metadata carry or removal. Signed C2PA output is unavailable for JXL; explicit credential requests fail or use the CLI's unsupported-provenance warning/strict refusal. Source-credit delivery is not promised through JXL metadata. Lossless output retains applied pixel marks; lossy watermark survival has not been calibrated.

## Bounds and verification

Encoded input/output: 128 MiB. Decode: 16 MP. Encode: 8 MP. Edge: 16384 pixels. Codec allocations: 384 MiB, within a 768 MiB WASM ceiling. Operations run serially in disposable workers with cancellation and a two-minute deadline. XML inspection does not inflate compressed metadata and accepts at most 1 MiB of XML across a walk of 4096 boxes.

The tests use the actual codec for 8-bit RGBA, 16-bit samples, all eight orientations, grayscale, Display P3, PQ, progressive JPEG metadata/restoration and unsupported animation/auxiliary/oversized inputs. The independent jxl-oxide 0.12.6 decoder verifies generated lossless pixels. See `packages/node-shell/wasm/jxl/README.md` for reproducible build pins, licenses and measured desktop memory/timing, and `tests/fixtures/jxl/README.md` for fixture provenance.

HDR still export uses PQ Rec.2020 16-bit samples. The document float path also supports linear EXR and float TIFF masters. Physical HDR-display parity and mobile memory behaviour have not been verified on hardware.
