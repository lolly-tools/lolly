# Read and extract fixtures (plan 203, rank 10)

Three small files and their labels, built by
`scripts/build-read-extract-fixtures.ts` and committed.
`tests/read-extract-fixtures.test.ts` reads each one through the host reader and
`readExtract`, and scores the result against the labels with `scoreExtract`.

```bash
node scripts/build-read-extract-fixtures.ts       # rewrite the files in place
node --import ./tests/css-stub.mjs --test tests/read-extract-fixtures.test.ts
```

Every word was written for these files. The pictures are drawn by seeded code
and the scans use a five by seven bitmap face declared in the builder, so no
font file, photograph or scan from elsewhere is in them, and they are
redistributable under the repository's licence (MPL-2.0). The builder is
reproducible: stored zip entries at one fixed time, a fixed `now` for the pptx
writer, hand-written PDFs with no dates or ids, and page pictures compressed by
the in-repo `zlibCompress`. The test rebuilds every file in memory and compares
the bytes, so a builder change that is not regenerated fails.

## The files

| File | What it holds |
|---|---|
| `multilingual.pptx` | Five slides of authored text: English, French, German and Spanish, Greek and Russian, Japanese and Arabic. Slide 1 has a picture and speaker notes, slide 4 has Greek notes, and slide 5 has a table whose cells mix Latin, Greek and Japanese. |
| `multilingual.pdf` | Page 1 has a full-width title over two columns of five lines each, so a reader that runs across the gutter interleaves them. Page 2 has French, German and Spanish with their accents, in WinAnsi Helvetica. Page 3 is a searchable scan: one page picture, with its words as invisible text (render mode 3) over the painted lines. |
| `scan.pdf` | Two scanned pages with no text layer. Page 1 is English, in three lines of two sizes. Page 2 is French, with an accented capital and a faint grey line that a recogniser should be less sure of. Only text recognition can read these words. |

## The labels

Each file has a sidecar named after it with `.labels.json` added
(`multilingual.pptx.labels.json`), typed `ReadExtractFixtureLabelsV1` in the
builder. Per page it states:

- `languages`: the BCP 47 tags of the text on the page;
- `blocks`: the text blocks a correct reading returns, in reading order, each
  with its words and its `origin` (`authored`, `text-layer` or `recognized`),
  and a `role` where the fixture pins one;
- `notes`, `tables` and `pictures` where the page has them;
- for a scanned page, `scanned`, `read` (how its words reach the extract), the
  size of its `picture` and every `drawn` line: its text, its top left corner in
  picture pixels, its scale (pixels per glyph dot, on a six dot advance) and its
  ink colour. A test reads those lines back to stand in for a recogniser, so the
  rebuild and the recognition record are exercised on every machine.

A PDF reader makes one text frame per line, so each PDF line is its own block,
and the searchable scan's text layer is one block with a line per drawn line.
