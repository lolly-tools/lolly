# GridCraft model

Source: https://github.com/storytold/gridcraft/tree/11a5711ab11c4b94acce63faa07bb42c058c124f/crates/model
Commit: 11a5711ab11c4b94acce63faa07bb42c058c124f (upstream main after v0.19.1; head 927d4d6 has the same crate contents on 2026-11-22)
Licence: MIT OR Apache-2.0. The upstream licence and notice files are retained here.

Provenance statement from the upstream repository (AGENTS.md): GridCraft describes itself as clean-room.
Excel may be observed as a black box with synthetic workbooks; nothing inside the Office bundle is read or
copied, and no GPL, AGPL or LGPL code is copied. Function behaviour comes from public documentation and
observation. Stated limit: upstream reports 513 of 523 Excel function names present, and that results are
not conformance-tested against Excel. Lolly checks recomputation against cached Excel values in its own
tests (tests/gridcraft-calc.test.ts) and does not claim Excel parity beyond that.

No application UI, branding, fonts or assets are included. The NOTICE keeps only the copyright and licence
paragraph. The upstream third-party section covers fonts and icons in the GridCraft application, none of
which is included here.

Modifications by Lolly:
- Cargo.toml is standalone and points at the shared gridcraft-core copy. It does not depend on gridcraft-math.
- src/math_off.rs (new) stands in for the gridcraft-math crate, which lays equations out with RaTeX and would add twenty crates the module never runs. It has the names this crate reads, and its layout always answers with an error, so an equation shape is never laid out. src/lib.rs declares the module and src/features.rs imports it under the crate's name.
- src/features.rs: the two equation cache tests that check real layouts are ignored, with the reason given.
All other source files are unchanged. The whole crate is kept because gridcraft-calc builds on its workbook, sheet and cell types, although the module uses only a fraction of it.
