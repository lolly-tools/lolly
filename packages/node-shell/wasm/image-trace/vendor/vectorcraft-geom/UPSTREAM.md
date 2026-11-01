# VectorCraft geometry kernel

Source: https://github.com/storytold/vectorcraft/tree/05d5f99fd7e7dc00db3a9754d594b1214945d855/crates/geom
Commit: 05d5f99fd7e7dc00db3a9754d594b1214945d855 (workspace version 0.19.0)
Licence: MIT OR Apache-2.0. The upstream licence files are retained here, and the NOTICE keeps only the copyright and licence paragraph. The upstream third-party section covers fonts and icons in the VectorCraft application, none of which is included here.

The image tracer uses this crate for its anchor-based path model. See `../vectorcraft-trace/UPSTREAM.md` for the provenance statement.

Modifications by Lolly:
- Cargo.toml is standalone: workspace inheritance is replaced by explicit versions, and the dev-dependencies on upstream's test kit and proptest are replaced by `serde_json` alone.
All source files are unchanged, and the unit tests inside them are kept.
