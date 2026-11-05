# PhotoCraft raw source

Source: https://github.com/storytold/photocraft/tree/97a83f074f5407841a1444ee3f9be478ce03368b/crates/raw
Commit: 97a83f074f5407841a1444ee3f9be478ce03368b (crate version 0.18.0)
Licence: MIT OR Apache-2.0. `LICENSE-MIT`, `LICENSE-APACHE` and `NOTICE` are taken from the
repository root at the same commit and retained here. Upstream's README is kept as
`README.upstream.md` (it holds the support matrix and the provenance statement).

Included: the library sources under `src/` and the integration tests under `tests/`. Left out:
the `rawinfo` example, the cargo-fuzz harness (Lolly fuzzes through `tests/fuzz/targets.ts`) and
the upstream workspace manifest, which Lolly replaces with a standalone one. No sample images,
brand assets, fonts or models are included.

## Edits Lolly made

1. `Cargo.toml` is standalone: version, edition, licence and the `unsafe_code = "forbid"` lint
   are inlined. `flate2` uses the `rust_backend` feature (upstream's workspace selects `zlib-rs`).
   `jxl-oxide` is removed, and so are the dev-dependencies `png` and `zune-jpegxl`. `rayon`
   stays for native test runs and is not part of the WASM build.
2. `src/jxl.rs` keeps only the stub upstream already uses on wasm32: JPEG XL-compressed DNG
   (DNG 1.7, Compression 52546) is reported as unsupported on every target. Upstream decodes it
   with the native `jxl-oxide` crate, which Lolly does not ship.
3. `tests/it/dng.rs`: the JPEG XL section is removed, because its tests build codestreams with
   the removed encoder. `tests/it/hostile.rs`: the JPEG XL sample is a six-byte stand-in and
   `originals_develop` expects it to be unsupported.

Everything else is unchanged. All 134 unit tests and 86 integration tests pass natively
(`cargo test --release` in this directory).

## Provenance and clean-room caveats

Upstream states that the crate is clean-room, and says so in its README, in `src/lib.rs` and in
`src/nefc.rs`: it was written from public specifications, papers and observation of sample files,
and "no code from dcraw, LibRaw, rawspeed, rawler, rawloader or darktable was read or used, and no
camera colour tables were copied". Lolly checked the vendored tree for those names and found them
only in that disclaimer. The limits of that statement, as upstream records them:

- **Sources are prose and tag documentation.** TIFF 6.0, TIFF/EP, the Adobe DNG Specification,
  ITU-T T.81 Annex H, the published CR2 container description, ExifTool's public tag tables for
  Canon, Nikon, Sony, Panasonic, Olympus and Fujifilm maker notes, and write-ups by Laurent Clevy
  (NEF structure) and Bill Claff (NEF compression). ExifTool's tag documentation was read; its
  code was not.
- **Nikon compressed NEF Huffman tables** are not stored in the files. Upstream recovered them by
  black-box analysis of CC0 raw.pixls.us samples (the same scene shot compressed and
  uncompressed) in the sibling LightCraft project, storytold/lightcraft#86, and took over the
  facts and the tables. They are format facts measured from files, and the account rests on
  upstream's word.
- **Sony cRAW and Sony SR2 metadata** (the 11 + 7 bit scheme, the encrypted SR2SubIFD key bytes
  `11 22 33 44`) were established by observation of sample files and measured against ExifTool's
  metadata output (`docs/sony-arw-metadata.md` upstream).
- **Panasonic RW2 format 3/4 and uncompressed ORF and RAF** layouts were established by observation
  of sample files.
- **The Nikon D4 camera profile** in `src/cameras.rs` (matrix, tone curve and black point) copies
  the default rendering of Adobe Camera Raw, measured black-box by opening 29 NEFs in Photoshop
  and comparing against the crate's own linear development. It is a measurement of an Adobe
  product's output, not Adobe code or tables, and it is the only built-in camera profile. Lolly
  labels a result that uses it "approximate colour".
- **The per-file colour fit** (`src/look.rs`, "approximate colour") follows the prose description
  in LightCraft's `docs/camera-preview-colour.md` (Apache-2.0, same organisation). No LightCraft
  code was used.
- Formats with no public description (Nikon lossy-after-split, Sony Compressed RAW 2, Pentax
  compressed PEF, RW2 format 6 and newer, Olympus compressed ORF, Fujifilm compressed RAF, Canon
  CR3 and sRAW) are reported as unsupported rather than guessed. Upstream says it found only GPL
  decoder source for several of them and did not read it.
- Nobody outside upstream has audited the "no copied tables" claim. Lolly relies on the stated
  method, the absence of those names in the tree, and the sample-based tests.

## Patents

The decoder reads TIFF, Deflate (zlib), lossless JPEG (ITU-T T.81 process 14) and baseline JPEG
(DNG lossy tiles and embedded previews). None of these is a patent-pool codec. The JPEG XL path is
removed. The crate does not decode H.264, HEVC, AAC, ProRes or any video codec. Canon CR3 stores
its previews in an ISO base media container, which the crate reads only as a box structure.

## Updating

Replace `src/` and `tests/` from a new upstream commit, reapply the three edits above, change the
commit here, then run `cargo test --release` in this directory, `pnpm run build:camera-raw`,
`node --test tests/camera-raw.test.ts` and `node scripts/camera-raw-corpus.ts`.
