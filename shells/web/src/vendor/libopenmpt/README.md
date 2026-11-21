# Vendored libopenmpt (WebAssembly)

`libopenmpt.mjs` is a self-contained Emscripten build of **libopenmpt 0.8.10** used to decode
tracker modules (`.mod`, `.xm`, `.s3m`, `.it`, `.stm`, `.mtm`, …) to PCM for the Neurospicy
player and for baking module music into video exports. It is driven headlessly (bytes → PCM)
by `shells/web/src/lib/mod-worker.ts`; there is no live-player wrapper.

**Do not hand-edit `libopenmpt.mjs`.** Regenerate it with:

```
scripts/build-libopenmpt-wasm.sh
```

## Provenance
- libopenmpt **0.8.10** - makefile-flavour release tarball from lib.openmpt.org. The release
  page publishes no checksum, so the pinned SHA-256 was taken from two downloads that agreed, and
  the files carrying the security fixes (`soundlib/SampleFormats.cpp`, `WAVTools.cpp`,
  `tuning.cpp`, `Load_symmod.cpp`, `Snd_fx.cpp`) match the `libopenmpt-0.8.10` tag of the
  OpenMPT Git mirror.
- 0.8.9 and 0.8.10 are security releases. 0.8.9 fixes a possible heap out-of-bounds write while
  loading SymMOD files with IMA ADPCM WAV samples (GHSA-fxf7-wc37-p2cx) and a possible heap
  out-of-bounds read while loading custom tunings from MPTM files. 0.8.10 fixes a possible
  division by zero for an embedded IMA ADPCM WAV sample that claims 0 channels and an oversized
  allocation from a WAV fact chunk. libopenmpt picks the loader from the bytes, not the file
  name, so an upload named `.mod` can still reach the SymMOD or MPTM loader.
- The same script at 0.8.7 reproduced the previous committed module byte for byte. Rendered at
  48 kHz, seven catalog modules and libopenmpt's own `test.mod`, `test.s3m`, `test.xm` and
  `test.mptm` give identical float PCM with 0.8.7 and 0.8.10.
- Emscripten **6.0.2**, with SDK source commit `ca38f487f28b7c3c16f8f70cd0e012099ac4b7e2` pinned in the build script.
- The source archive is SHA-256 checked before extraction. The distributed artifact's exact hash is in `security/vendor-artifacts.json` and verified during SBOM generation.
- Build target: `CONFIG=emscripten EMSCRIPTEN_TARGET=wasm`, then linked
  `MODULARIZE + EXPORT_ES6 + SINGLE_FILE` (wasm embedded as base64), `ENVIRONMENT=web,worker`,
  `FILESYSTEM=0`, exception catching enabled.
- **Fixed 256 MB heap, no memory growth** (`INITIAL_MEMORY=268435456`, `ALLOW_MEMORY_GROWTH=0`).
  This is load-bearing: a growable heap is a *resizable* `ArrayBuffer`, and Chrome refuses
  `crypto.getRandomValues()` on a view into one - which libopenmpt hits while seeding a module,
  throwing at decode time. Do not re-enable memory growth.

## Licensing - 100% permissive, no copyleft
Built with libopenmpt's **default internal codecs**, so nothing LGPL is linked:
| Component | Licence |
|---|---|
| libopenmpt | BSD-3-Clause (`LICENSE.libopenmpt.txt`) |
| minimp3 (internal MP3) | CC0-1.0 / public domain (`LICENSE.minimp3.txt`) |
| stb_vorbis (internal Vorbis) | public domain / MIT |
| miniz (internal zlib) | MIT |
| Emscripten runtime glue | MIT |

The LGPL `libmpg123` / `libvorbis` path is **opt-in only** in libopenmpt's Makefile
(`ALLOW_LGPL=1`). The build script never sets it. **Do not** add `ALLOW_LGPL=1` or
`--use-port=mpg123/vorbis` without a licensing review.
