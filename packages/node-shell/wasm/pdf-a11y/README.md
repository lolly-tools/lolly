# PDF accessibility check and text-keeping redaction

Lolly's browser, Node and command-line shells use one committed `pdf-a11y.wasm` to read a PDF and list which of 32 accessibility checks it passes, fails or leaves to a person. Operation 1 reads only: it writes no PDF, adds no tags and fixes nothing. The engine never loads the module: it takes an optional `pdfAccessibility` reader in `verifyExport`, and the shells supply one backed by this module.

The checks are PdfCraft's `pdfcraft-a11y` crate (MIT OR Apache-2.0) at commit `47f42ba07b61553da50ca2df91b070519bd3386e`, with the crates it reads PDFs through: `cos`, `crypt`, `filters`, `model` and `content`. Source, licence choices, the removed tagging and auto-fix code, the patches and the provenance caveats are in `vendor/UPSTREAM.md`. The Lolly byte adapter in `src/lib.rs` is MPL-2.0.

The raw ABI is `pdf_a11y_alloc`, `_free`, `_run(ptr, len, op)`, `_result_ptr` and `_result_len`. Operation 1 takes the PDF bytes and returns a JSON report. A failed open returns a message that starts `not-pdf:`, `encrypted:` or `damaged:`. Input is capped at 256 MB and output at 16 MB, and the link step caps memory at 512 MB.

Operation 2 is text-keeping redaction, PdfCraft's `redact` crate. The request is a 4-byte little-endian length, that many bytes of JSON (`bars` in points from the top-left of the MediaBox, `fill`, `label`, `labelColor`, `sanitize`) and then the PDF. The answer is a 4-byte length, a JSON summary of what was removed, and the rewritten PDF, always a full rewrite. A refusal starts `refused:` or `bad-request:`. The module does not vouch for its own result: `packages/node-shell/src/pdf-redact-keep.ts` reads the new file again and refuses it when anything is left under a box.

Rebuild with `pnpm run build:pdf-a11y`. Run the checker's own tests with `cargo test` in this directory.
