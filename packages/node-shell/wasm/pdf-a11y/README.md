# PDF accessibility check

Lolly's browser, Node and command-line shells use one committed `pdf-a11y.wasm` to read a PDF and list which of 32 accessibility checks it passes, fails or leaves to a person. It reads only. It writes no PDF, adds no tags and fixes nothing. The engine never loads the module: it takes an optional `pdfAccessibility` reader in `verifyExport`, and the shells supply one backed by this module.

The checks are PdfCraft's `pdfcraft-a11y` crate (MIT OR Apache-2.0) at commit `47f42ba07b61553da50ca2df91b070519bd3386e`, with the crates it reads PDFs through: `cos`, `crypt`, `filters`, `model` and `content`. Source, licence choices, the removed tagging and auto-fix code, the patches and the provenance caveats are in `vendor/UPSTREAM.md`. The Lolly byte adapter in `src/lib.rs` is MPL-2.0.

The raw ABI is `pdf_a11y_alloc`, `_free`, `_run(ptr, len, op)`, `_result_ptr` and `_result_len`. Operation 1 takes the PDF bytes and returns a JSON report. A failed open returns a message that starts `not-pdf:`, `encrypted:` or `damaged:`. Input is capped at 256 MB and output at 16 MB, and the link step caps memory at 512 MB.

A later PDF operation (text-keeping redaction is planned) adds an operation number to this module rather than shipping another.

Rebuild with `pnpm run build:pdf-a11y`. Run the checker's own tests with `cargo test` in this directory.
