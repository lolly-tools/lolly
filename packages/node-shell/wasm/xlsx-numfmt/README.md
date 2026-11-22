# Excel number-format adapter

Lolly's browser and Node shells use one committed `xlsx-numfmt.wasm` to show spreadsheet cells the way Excel does when an XLSX file is imported: dates in both date systems, currency, percentages, fractions, conditional sections, text sections and the built-in formats. The engine never loads the module. It takes an optional `formatCell` function in `readXlsx` options, and the shells supply one backed by this module.

The format engine is GridCraft's `gridcraft-numfmt` crate (MIT OR Apache-2.0) at commit `11a5711ab11c4b94acce63faa07bb42c058c124f` (version 0.19.1, upstream main after the tag), with its `gridcraft-core` dependency. Source, licence choices and the modifications are under `vendor/`. The one change is that the clock is an injected value, so the module imports nothing and its output is deterministic. The Lolly byte adapter in `src/lib.rs` is MPL-2.0.

The raw ABI is `xlsx_numfmt_alloc`, `_free`, `_run(ptr, len, op)`, `_result_ptr` and `_result_len`. Operation 1 formats a batch. A later formula engine adds operations to this module rather than shipping another.

Rebuild with `pnpm run build:xlsx-numfmt`. The build writes source paths under fixed prefixes, so the same source builds the same bytes wherever the repository is checked out. Run the vendored crates' own tests with `cargo test --workspace` in this directory.
