# How this converter is developed

The INDD format is undocumented. This project learns it only by examining
INDD files and comparing them with IDML files exported from the same
documents.

## Rules

- **No Adobe software.** Contributors who analyse the format have not
  installed InDesign or accepted Adobe's terms of use.
- **Only files made by others, for other purposes.** Sample documents come
  from published templates, test suites and archives. We do not ask anyone
  to create documents for this project.
- **No Adobe binaries, and no code under incompatible licences.** We do not
  read, decompile or use InDesign binaries, the InDesign SDK, or code from
  other INDD readers whose licence is incompatible with this project's.
- **Published source under compatible licences may be used**, with
  attribution. The list is in "Permitted references" below.
- **The IDML side follows Adobe's published IDML specification.**
- **No sample files are committed.** The open-licensed test fixtures
  are downloaded from their sources (`tests/fixtures/README.md`). Other
  samples stay in the git-ignored `corpus/` directory.

## Method

The format was learned by black-box observation of files. Nothing else
was examined.

### What was done

1. **Collected third-party samples.** 357 INDD files made by other people
   for other purposes: published templates, test suites and archives.
   240 of them come with an IDML file exported from the same document.
   No INDD file was made for this project, and we cannot make one: we
   have no InDesign. The samples stay in the local, git-ignored
   `corpus/` directory and are not redistributed.
2. **Paired INDD objects with IDML elements.** An IDML element's `Self`
   identifier is the INDD object's UID in hexadecimal (`Self="u1a2"` is
   UID 0x1A2). This lets us put an INDD object's bytes next to the
   attributes InDesign exported for the same object.
3. **Correlated fields across many files.** For each candidate field we
   counted how often the INDD value equals the IDML value, over every
   pair in the corpus. A fact is accepted only when it holds across the
   samples. Values that are the same in every sample are not mapped,
   because they cannot be told apart.
4. **Recorded each fact with its evidence.** `docs/format/` states each
   fact, the files it was checked on, and the match count (for example
   "171 of 171"). The code relies only on facts recorded there.
5. **Checked the converter against the reference IDMLs.**
   `tools/compare.py` converts every corpus pair and compares the result
   with the IDML that InDesign exported. Output is also validated
   against the IDML RelaxNG schemas.

### What was not done

- InDesign was never installed and Adobe's terms of use were never
  accepted.
- No Adobe binary was disassembled, decompiled, traced or opened,
  including the InDesign application bundle and its plug-ins.
- The InDesign SDK and its documentation were not used.
- No code from other INDD readers was used.
- No one was asked to create INDD files for this project.

### Points a reviewer should know

- **A few facts rest on a sample that is not public.** Where no public
  sample shows a value, the owner allowed the use of an INDD file made
  by a third party for another purpose, before this project, together
  with its print PDF. It has no IDML and is not redistributable, so
  those facts cannot be re-checked by others. They were found by
  black-box observation of the PDF (rendered glyphs, text positions,
  page labels), and `docs/format/` marks each one.

- **Adobe XMP Toolkit source was read.** The XMP Toolkit SDK is published
  by Adobe under the BSD 3-Clause licence. Its INDD handler
  (`InDesign_Handler.cpp`) was used for the outer container: master
  pages, contiguous objects and the byte-order flag
  (`docs/format/container.md`). Every one of those facts was also
  checked against the corpus. If a reviewer needs the work to rely on no
  vendor source at all, the container section can be re-derived from the
  corpus alone and the reference removed.
- **The analysis was done with an AI model.** The model may have seen
  InDesign SDK material in its training data. The rules above forbid
  using such knowledge, and every recorded fact rests on corpus evidence
  rather than on recall. Absence of such knowledge cannot be proved,
  though.
- **There was no two-team separation.** A traditional clean room keeps
  the people who study the format apart from the people who write the
  code. Here the same process did both. In its place, every fact in
  `docs/format/` can be re-checked by anyone with similar sample files,
  and the converter is measured against InDesign's own IDML output.

## Where format knowledge is recorded

Each fact about the INDD format is written in `docs/format/` together with
the observation that supports it, before or alongside the code that relies
on it.

## Permitted references

| Reference | Licence | Used for |
|---|---|---|
| [Adobe XMP Toolkit SDK](https://github.com/adobe/XMP-Toolkit-SDK), `InDesign_Handler.cpp` | BSD 3-Clause (`third_party/xmp-toolkit-sdk/LICENSE`) | Master pages and contiguous objects (`docs/format/container.md`) |
| Adobe IDML specification | Published specification | IDML output |
| IDML RelaxNG schemas (generated by InDesign, published in the metanorma/idml repository) | Published with the IDML specification | Validating converter output locally. Not committed. |
