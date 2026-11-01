# PhotoCraft PSD source

Source: https://github.com/storytold/photocraft/tree/97a83f074f5407841a1444ee3f9be478ce03368b/crates/psd
Commit: 97a83f074f5407841a1444ee3f9be478ce03368b (crate version 0.18.0; previously 7eb3b2e072aa3110da2a329bb49109744292a87b, 0.2.0)
Licence: MIT OR Apache-2.0. The upstream licence and notice files are retained here,
taken from the repository root at the same commit.

Only the standalone format crate is included: `src/`, `tests/` and
`proptest-regressions/`. Fuzz targets, examples and the upstream README and AGENTS.md
are left out. Lolly replaces workspace-inherited Cargo metadata with a standalone
manifest: it inlines the version, edition, licence and lint settings, keeps the
`rust_backend` flate2 backend (upstream's workspace selects `zlib-rs`), and adds
`proptest` as a dev-dependency for the integration tests. The `corpus` feature is
carried but its tests need upstream's corpus directory, which is not vendored.
Source files are otherwise unchanged. No application UI, branding, fonts, models or
preset assets are included.
