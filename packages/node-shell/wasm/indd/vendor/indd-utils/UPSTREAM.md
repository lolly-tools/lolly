# indd-utils source

Source: https://github.com/storytold/indd-utils
Commit: 136f973a9d5f1b3ef34e46e27f4a08af196efde7
Licence: MIT OR Apache-2.0. The upstream licence files, the clean-room statement and the
Adobe XMP Toolkit licence are retained here.

Included: the library sources under `src/` (about 36.7k lines of Rust, no dependencies), the
fixture smoke tests under `tests/` and the notices. Lolly replaces the upstream manifest with a
standalone library manifest and leaves out the `indd` command line binary (`src/main.rs`), the
Python tools, `docs/` and the CI configuration. Source files are otherwise unchanged. The only
other edit is in `tests/fixtures.rs`: the `INDD_FIXTURES` environment variable can name the
directory the fixtures were fetched into (`node scripts/indd-corpus.ts fetch-fixtures` uses
`plans/corpora/indd-fixtures`). No sample documents are included.

## Clean-room caveats

Andy accepted these on 2026-11-01. They are quoted from upstream's `CLEANROOM.md`, which is kept
in this directory.

- Adobe's XMP Toolkit SDK source, published under the BSD 3-Clause licence, was read. Its INDD
  handler informed the outer container layout (master pages, contiguous objects, the byte-order
  flag). Each of those facts was also checked against sample files. The licence text is in
  `third_party/xmp-toolkit-sdk/LICENSE`.
- An AI model did the format analysis. The model may have seen InDesign SDK material in its
  training data. Upstream's rules forbid using it, and each recorded fact rests on sample
  evidence, but the absence of such knowledge cannot be proved.
- There was no two-team separation between the people who studied the format and the people who
  wrote the code. The same process did both. Upstream measures the converter against InDesign's
  own IDML export instead.
- A few facts rest on one third-party sample that is not public. Upstream marks each one.

Adobe and InDesign are trademarks of Adobe Inc. Lolly is not affiliated with or endorsed by Adobe.

## Updating

Replace the files from a new upstream commit, reapply the two edits above, change the commit
here, then run `pnpm run build:indd`, `cargo test --release` in this directory (set
`INDD_FIXTURES`) and `node --test tests/indd.test.ts`. The golden hashes in that test change
only when the converter output changes.
