# PdfCraft sources

Source: https://github.com/storytold/pdfcraft
Commit: 47f42ba07b61553da50ca2df91b070519bd3386e
Licence: MIT OR Apache-2.0. Each vendored crate keeps `LICENSE-MIT`, `LICENSE-APACHE` and a `NOTICE`
that holds only the copyright and licence paragraph. The upstream NOTICE also covers icons, fonts and
brand marks of the PdfCraft application. None of those are included here.

Vendored crates, from `crates/` at that commit: `a11y` (the checker, trimmed), `cos` (PDF object
layer), `crypt` (the standard security handler), `filters` (stream filters), `model` (page tree),
`content` (content stream operators) and, for text-keeping redaction, `redact`, `annot`, `forms`,
`fonts`, `edit` and `xfa`, all trimmed as described under "Redaction". Their `Cargo.toml` files are rewritten as workspace members of
this module, and their `tests/` directories, examples and READMEs are left out.

## What is not here

- Tagging, auto-fix and tag editing. `a11y` is the read-only checker only. These files and
  functions are removed: `autotag.rs`, `autotag_fields.rs`, `tags.rs`, `headings.rs`, the fix
  functions in `alt.rs` (`set_alt`, `mark_decorative`, `mark_tag_artifact` and their errors), and the
  upstream tests that exercise them. The remaining `alt.rs` holds the read-only structure helpers
  the rules share, plus `figures`.
- The `fonts` crate. Only the removed `headings.rs` used it.
- The renderer's tokenizer (`hayro-syntax`). See the patch to `content` below.

## Modifications by Lolly

- `a11y/src/lib.rs`: the removed modules and their `pub use` lines are gone, and `page_count` is added
  so the adapter need not depend on the page-model crate.
- `a11y/src/tests.rs`: 27 of the 60 upstream tests are removed because they set up or assert through
  tagging, tag editing or heading detection. The other 33 run unchanged and `structure.rs` keeps its
  one unit test. The 7 tests in upstream `tests/cross_stream.rs` all use the removed functions and are
  gone, so the suite goes from 68 tests to 34. Helper functions only the removed tests used are removed
  too.
- `content/src/lib.rs`: `renderer_image_end` returns `None`. Upstream asks hayro-syntax where an inline
  image ends. That crate is a full renderer front end and is not part of this module, so every inline
  image takes the parser's own end-of-data rules and is marked ambiguous, as upstream already does when
  the renderer reads none. Content after an inline image whose data contains the bytes `EI` can differ
  from a renderer's reading. The checker reports from marked content, so the effect is on which
  operators follow such an image in a rule scan. `content/src/tests.rs` is removed with it.
- `a11y/src/applicability.rs` (new), `a11y/src/structure.rs` and `a11y/src/lib.rs`: `check_with_applicability`
  returns the report and the set of rules that had something to look at. `structure::Seen` records which
  kinds of element the existing walk met. Upstream reports a rule with nothing to check as Passed; Lolly
  shows it as not applicable. The rule results themselves are unchanged. These files are Lolly's, offered
  under the same MIT OR Apache-2.0 terms as the crate they sit in.
- `a11y/src/alt.rs`: `#[allow(dead_code)]` on `Element`, whose `parent` and `depth` only the removed
  code read.

The dependency crates (`cos`, `crypt`, `filters`, `model`, `content`) are otherwise unchanged. Their
unit tests need dev dependencies (`proptest`, `weezl`, `hayro-jbig2`) that Lolly does not vendor, so
`cargo test` in the parent directory runs the adapter and the checker only.

## Redaction (operation 2)

`redact` is vendored whole apart from its tests (they need `testkit`, `proptest` and bundled fonts).
Its upstream dependencies pull in about 40,000 lines of editor, forms, annotation and XFA code, and
bundled font files that Lolly does not ship, so those crates are cut down to what redaction reaches:

- `fonts`: only `Std14` and its metrics, WinAnsi encoding, the `pdf` font-metrics reader and the small
  helpers in `lib.rs`. The bundled Inter and script fonts, shaping, embedding and fallback modules are
  gone. `skrifa` 0.47 stays because the metrics reader reads advance widths from embedded fonts.
- `annot`: whole minus tests. `forms`: whole minus tests.
- `edit`: `flatten.rs`, `place.rs` (`stamp`), a reduced `marks.rs` (`MarkKind` and the number
  formatters) and a `lib.rs` that keeps `EditError` and `text::MAX_FORM_DEPTH`. The text editor,
  added content, images, backdrops, header, footer and watermark code are gone.
- `xfa`: `xfa_shape`, `strip` and `drop_usage_rights` from `pdf/strip.rs`. The XDP parser, layout engine
  and scripting runtime are gone, so `strip` no longer counts unbound data or names packets inside an
  XDP envelope.
- `redact/src/sanitize.rs`: the form-field flattening branch of `remove_hidden` is switched off
  (`let fields = false`), which keeps `flatten`, `redraw_field` and annotation drawing out of the
  binary. Lolly's adapter only asks for metadata, attachments and private data.
- `redact/src/interp.rs`, `glyph_hit`: a glyph is removed when a region overlaps it sideways by more than
  0.05 points. Upstream kept a glyph that a region overlapped by up to a fifth of its width or a point,
  which left a half-covered letter in the text. The vertical margin is upstream's.
- The adapter in `src/lib.rs` writes the Redact marks itself instead of calling `annot::add_annotation`,
  which keeps annotation drawing out of the binary, and saves with `write_full` only.

Upstream's 157 redaction tests are not run here. Lolly's checks are `tests/redact-keep-text.test.ts`
(including a generated corpus read by an independent oracle), the `pdf-redact-keep` fuzz target and the
shell's own check of every result (`packages/node-shell/src/pdf-redact-keep.ts`).

## Clean-room and provenance caveats

PdfCraft says it is a clean-room implementation from ISO 32000 and black-box observation. The checker
follows the structure of Acrobat's Accessibility Checker: its seven categories, its 32 rule ideas and
its manual-check list. Upstream's rule names and descriptions echo that product's wording. Lolly does
not show them. The Lolly report words each rule itself, in `engine/src/pdf-accessibility.ts`, and it
shows upstream's finding sentences, which describe the file. Adobe and Acrobat are trademarks of Adobe
Inc. Lolly is not affiliated with or endorsed by Adobe, and the check is not Acrobat's and not a
PDF/UA conformance validator.

## Updating

Replace the six crates from a new upstream commit at a pinned SHA, reapply the edits above, change the
commit here, then run `pnpm run build:pdf-a11y`, `cargo test` in the parent directory and
`node --test tests/pdf-a11y.test.ts`. The baseline in `tests/fixtures/pdf-a11y-baseline.json` changes
only when the checker or Lolly's exports change; review each difference.
