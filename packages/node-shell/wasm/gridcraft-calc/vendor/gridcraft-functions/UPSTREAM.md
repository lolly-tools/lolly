# GridCraft function library

Source: https://github.com/storytold/gridcraft/tree/5e415cdd34d287b90a4a9df67eb4f532f6f72d96/crates/functions
Commit: 5e415cdd34d287b90a4a9df67eb4f532f6f72d96
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
- Cargo.toml is standalone. The regex dependency is optional behind a default-on `regex` feature, and the Lolly module builds with default features off.
- src/text.rs: REGEXTEST, REGEXEXTRACT, REGEXREPLACE and their helpers sit in a module compiled only with the `regex` feature, and the three function registrations are added only then. Their tests carry the same gate (src/lib.rs has one more).
Reason: the regex engine with Unicode tables roughly doubles the compiled module, past the size budget. With the feature on, the source behaves exactly as upstream.
