# Vendored libopenmpt (WebAssembly)

`libopenmpt.mjs` is a self-contained Emscripten build of **libopenmpt 0.8.7** used to decode
tracker modules (`.mod`, `.xm`, `.s3m`, `.it`, `.stm`, `.mtm`, …) to PCM for the Neurospicy
player and for baking module music into video exports. It is driven headlessly (bytes → PCM)
by `shells/web/src/lib/mod-worker.ts`; there is no live-player wrapper.

**Do not hand-edit `libopenmpt.mjs`.** Regenerate it with:

```
scripts/build-libopenmpt-wasm.sh
```

## Provenance
- libopenmpt **0.8.7** - makefile-flavour release tarball from lib.openmpt.org
- Emscripten **6.0.2** (emsdk `latest` at build time)
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
