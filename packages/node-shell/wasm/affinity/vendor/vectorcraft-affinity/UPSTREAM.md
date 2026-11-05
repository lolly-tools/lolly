# VectorCraft Affinity reader source

Source: https://github.com/storytold/vectorcraft/tree/05d5f99fd7e7dc00db3a9754d594b1214945d855/crates/affinity
Commit: 05d5f99fd7e7dc00db3a9754d594b1214945d855 (crate version 0.19.0)
Licence: MIT OR Apache-2.0. The upstream licence files are retained here, taken from the
repository root at the same commit, with a NOTICE that keeps the copyright line and states that
the ArtCraft marks are not part of this source.

The crate is self-contained: the document model is `src/model.rs` and `src/model/`, so no other
VectorCraft crate is needed. Included: `src/` (about 5.7k lines of Rust, with its unit tests and the
`synth` builders those tests use, compiled only under `cfg(test)` or the off-by-default `synth`
feature) and the upstream README. Left out: the integration tests (they need upstream's corpus
helpers and `xtask`), the `fuzz/` crate and the `Cargo.toml` workspace settings. Lolly replaces the
manifest with a standalone one: it inlines the workspace version, edition, licence and lints,
trims `image` to `png` and `jpeg`, keeps the `rust_backend` flate2 backend and adds `proptest` as a
dev-dependency for the unit tests.

Two edits to the sources: `model::read_within` (read with a caller-chosen pixel budget) is `pub`
and re-exported from `model`, so the Lolly adapter can cap pixel decoding below upstream's
512-megapixel default. Nothing else is changed. No Affinity software, documents, fonts or colour
profiles are included.

## Provenance and clean-room

Andy accepted this provenance on 2026-11-02 (Storytold adoption plan, decision 4), when he asked for
Affinity import. In plain terms:

- The file layout was learned from [VMDevCpp/afread](https://github.com/VMDevCpp/afread) (MIT, at
  `04b672334a43e3e37ded6b5ffc57af231d589774`, written for container versions 7 to 11) and re-described
  in upstream's own words before the Rust was written. No code was translated.
- No Affinity software was used. Upstream states that Affinity was never downloaded, installed, run,
  scripted, screenshotted or disassembled for this work, that nothing from an Affinity installation
  was read, and that every sample is a document its author published.
- The structures were checked against public files. afread does not say how its author learned the
  format, so nothing rests on it alone: each archive entry carries a CRC-32 that must match, and
  every field in the object stream names its own type, so a misread layout fails loudly. What shapes,
  paints, text and pixels mean was fitted by comparing renders with the thumbnail every Affinity
  document embeds, on 176 public documents (now 189) saved by Affinity 1.x, 2.x and 3.x.
- The work is treated as AI-assisted. Upstream's crate documentation does not say how the code was
  written; Lolly's Storytold review recorded it as AI-assisted, and the upstream repository carries
  agent instruction files (AGENTS.md, CLAUDE.md). Upstream does state that no GPL or AGPL code (such
  as Inkscape's Affinity extension) was read.
- afread itself has no stated account of how its author learned the format, and there is no
  published specification, so completeness is not claimed. Documents from builds or platforms
  outside the public set can fail or approximate.

Upstream's README section "Provenance and clean-room" says the reader "is built only from a public
description of the format and from public files, never from Affinity itself", that nothing of
Affinity's is in its repository, and that nothing is written in Affinity's format. That section is
kept whole in `README.md` here.

Before vendoring, Lolly searched this crate's sources and README for GPL, AGPL and copyleft terms
and found only upstream's statement that such code was not read, and found no sample documents (the
public corpus is fetched by hash into ignored storage and never committed; see
`scripts/affinity-corpus.ts`). Affinity and the ArtCraft names are trademarks of their owners; Lolly
is not affiliated with or endorsed by either.

## Updating

Replace `src/` from a new upstream commit, reapply the `read_within` edit, change the commit here,
then run `pnpm run build:affinity`, `cargo test --release` in this directory and
`node --test tests/affinity.test.ts`.
