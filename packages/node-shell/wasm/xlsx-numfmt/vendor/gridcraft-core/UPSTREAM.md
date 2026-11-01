# GridCraft core types

Source: https://github.com/storytold/gridcraft/tree/5e415cdd34d287b90a4a9df67eb4f532f6f72d96/crates/core
Commit: 5e415cdd34d287b90a4a9df67eb4f532f6f72d96
Licence: MIT OR Apache-2.0. The upstream licence and notice files are retained here.

Modifications by Lolly:
- Cargo.toml is standalone. The wasm-only js-sys dependency and chrono's clock feature are removed.
- src/date.rs: the system clock is replaced by an injected value. set_now_ms(Option<f64>)
  supplies the time and unix_now_ms() returns it (None until supplied), so the compiled
  module imports nothing from the host and its output is deterministic. The one clock test
  in that file injects a value.
All other source files are unchanged. The whole crate is kept, not only what number formats
use, so the later formula engine can extend this module without another vendoring pass.
The NOTICE keeps only the copyright and licence paragraph. The upstream third-party section covers fonts and icons in the GridCraft application, none of which is included here.
