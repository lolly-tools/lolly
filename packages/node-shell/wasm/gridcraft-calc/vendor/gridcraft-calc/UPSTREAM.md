# GridCraft calculation engine

Source: https://github.com/storytold/gridcraft/tree/11a5711ab11c4b94acce63faa07bb42c058c124f/crates/calc
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
- Cargo.toml is standalone and points at the shared gridcraft-core and gridcraft-numfmt copies.
- src/recalc.rs: Calc::set_seed seeds the generator behind RAND, RANDBETWEEN and RANDARRAY. Upstream always starts from one constant.
- src/eval.rs: MAX_CELLS (largest array) is 4,194,304 instead of 16,000,000, and LAMBDA_FUEL (lambda calls one cell may make) is 100,000 instead of MAX_CELLS. The module runs on the page's thread; these bound the work and memory one formula can ask for. EVAL_WORK, upstream's work budget for one formula, stays sixteen times MAX_CELLS, so it falls with it to 67,108,864 units.
- src/eval/array.rs: the two broadcast tests that assume upstream's MAX_CELLS (4,000 by 4,000) use 2,000 and 2,048 squared instead.
The clock comes from gridcraft-core's injected value (see its UPSTREAM.md), so this crate reads nothing from the host. Everything else is unchanged.
