# Rebrand PDF fixture (plan 274 work package 2)

`editable.pdf` and its labels, built by `scripts/build-rebrand-pdf-fixtures.ts`
and committed. The PDF reader tests (`tests/pdf-read.test.ts`) and the PDF source
adapter tests (`tests/rebrand-source-pdf.test.ts`) read them, so they run on
every machine with nothing extra installed.

```bash
node scripts/build-rebrand-pdf-fixtures.ts     # rewrite the files in place
node --test "tests/rebrand-source-pdf.test.ts"  # includes the byte-for-byte rebuild check
```

The file is written by hand, the same way `flattened.pdf` is: no creation date,
a fixed trailer `/ID`, uncompressed content streams, and the one compressed
payload (the picture) through the in-repo `zlibCompress`. The rebuild check fails
when the builder changes and the committed bytes do not.

## What editable.pdf holds

Three 16:9 pages, 720 by 405 points (960 by 540 reference px), each painting in
this order:

- a white ground, which the adapter reads as the slide background;
- a running header inside `/Artifact <</Type /Pagination /Subtype /Header>>`:
  a line of grey text and a stroked rule, so both a text node and a path have
  to be reached by the span;
- a title in Helvetica-Bold at 28 point in `#1f4e79`;
- two body lines at 16 point, the second changing colour to `#d65a28` and back
  inside one `BT` block, so the line holds three runs;
- a note at 11 point in `#555555`;
- a small mark at the same place on every page: a circle drawn with curves
  (read as an ellipse) and a triangle beside it, which cluster into one vector
  object;
- a picture: pages 2 and 3 draw one image object, page 1 draws a second object
  holding the same bytes, so a reader that stores by content stores one picture;
- a thin bar across the foot of the page, a shape;
- a footer inside `/Artifact <</Type /Pagination /Subtype /Footer>>`, and a page
  number outside it.

`editable.labels.json` follows `RebrandFixtureLabelsV1` in
`tests/helpers/rebrand-fixtures.ts`. Object ids are the adapter's own form,
`<page id>.<position in paint order>`, so a test finds an object by id. Text
labels carry the expected `text`; pictures, the mark and the bar carry `boxPx`.
The mark's box is the frame of its SVG: the mark with a 2 point margin.

The header and footer labels are listed with their page under `slides[].objects`,
not under `inherited`: a PDF artifact is painted by the page itself, and
`inherited` holds what a pptx slide takes from its master or layout.

## Coverage this fixture does not have

Each of these is probed instead with a small PDF built in memory by
`buildProbePdf` in the same script, in `tests/rebrand-source-pdf.test.ts` and
`tests/pdf-read.test.ts`: a tagged structure tree and two-column text (reading
order), clipping paths over a picture and a shape, a searchable scan's
invisible text layer, a photo beside vector lettering, a pattern fill with no
decoder, a form over the content budget, a compressed picture that inflates
far past its declared size, the interpreter's node ceiling, a page turn, a
crop box and an inline picture.

Still not covered anywhere:

- No soft-masked picture, no JPEG, no Type3 font.
- No artifact span or invisible render mode inside a form XObject, which the
  reader does not see.
