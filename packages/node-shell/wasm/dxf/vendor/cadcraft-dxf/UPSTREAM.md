# CADCraft DXF tag reader

Source: https://github.com/storytold/cadcraft/tree/258c89fbb021fd22cf25ef519e5caf018b692093/crates/dxf
Commit: 258c89fbb021fd22cf25ef519e5caf018b692093
Licence: MIT OR Apache-2.0. The upstream licence and notice files are retained here.

The crate is the standalone DXF tag reader and writer: ASCII and binary, R12 to 2018, the
`$DWGCODEPAGE` code pages and the `\U+` and `\M+` escapes. Nothing else from CADCraft is included:
no drawing model, no DWG reader (its acadrust dependency is MPL-2.0 and stays out), no application
UI, branding, fonts or assets. Lolly's own entity mapping lives in `../../src/read.rs`.

Modifications by Lolly:
- Cargo.toml is standalone: workspace-inherited metadata and lints are replaced by explicit values.
- src/lib.rs: binary DXF written by AutoCAD R12 and earlier uses one-byte group codes (255 then a
  two-byte code for the large ones), where upstream reads only the two-byte codes of R13 and later.
  `parse_with_limit` now tells the two apart from the bytes after the sentinel (an R13 file starts
  with the two-byte code 0, an R12 file with the one-byte code 0 and then the letters of SECTION)
  and reads either. The new `short_codes` tests cover it. Everything else in the file is unchanged.
- The NOTICE keeps the copyright and licence paragraph and the non-affiliation line. The upstream
  third-party section covers DWG, PDF, fonts and icons in the CADCraft application, none of which is
  included here.

The upstream tests under `tests/` are kept and run with `cargo test --workspace` in the parent
directory.

## Clean-room position

Upstream says the crate was written from Autodesk's published DXF Reference and depends on nothing
else in its workspace. Lolly has not audited that claim beyond reading the source.
