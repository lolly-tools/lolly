# GridCraft core types

Source: https://github.com/storytold/gridcraft/tree/11a5711ab11c4b94acce63faa07bb42c058c124f/crates/core
Commit: 11a5711ab11c4b94acce63faa07bb42c058c124f (upstream main after v0.19.1; head 927d4d6 has the same crate contents on 2026-11-22)
Licence: MIT OR Apache-2.0. The upstream licence and notice files are retained here.

Modifications by Lolly:
- Cargo.toml is standalone. The wasm-only js-sys dependency and chrono's clock feature are removed.
- src/date.rs: the system clock is replaced by an injected value. set_now_ms(Option<f64>)
  supplies the time and unix_now_ms() returns it (None until supplied), so the compiled
  module imports nothing from the host and its output is deterministic. The one clock test
  in that file injects a value.
All other source files are unchanged. The whole crate is kept, not only what number formats
use, so the later formula engine can extend this module without another vendoring pass.
The NOTICE keeps the copyright and licence paragraph and, from the upstream third-party section, the Unicode License v3 paragraph for the CLDR regional data in src/region.rs. The rest of that section covers fonts, icons and window decorations in the GridCraft application, none of which is included here.
