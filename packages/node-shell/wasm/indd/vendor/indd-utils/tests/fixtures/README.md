# Test fixtures

`tests/fixtures.rs` runs smoke tests on six open-licensed sample files:
five InDesign documents and one print PDF. The files are not in the
repository. `manifest.json` lists where to download each one, pinned to a
commit where the source is a Git repository, with its size and SHA-256.

## Fetching

```sh
python3 -I tools/fetch_fixtures.py
```

The script saves the files in `tests/fixtures/files/` (git-ignored),
checks each one's size and SHA-256, and skips files that are already
present and correct. It exits non-zero if any file fails.

Without `tests/fixtures/files/`, the fixture tests pass without checking
anything and print a note. If the directory exists, every file must be
present.

Never commit the downloaded files. Other samples stay in the local,
git-ignored `corpus/` directory.

## Files

| Path under `files/` | InDesign version | Licence | Source |
|---|---|---|---|
| `opf-neddy-flyer/Neddy_Flyer_HeatherRyan.indd` | 3.0 (big-endian) | CC0, Heather Ryan (waiver in [the README next to it](https://github.com/openpreserve/format-corpus/blob/0bd37b0d10f397e0c2a7785befa2253f912b77fc/desktop-publishing/InDesign/Neddy_Flyer_README_HeatherRyan.md.rtf)) | [openpreserve/format-corpus](https://github.com/openpreserve/format-corpus/tree/0bd37b0d10f397e0c2a7785befa2253f912b77fc/desktop-publishing/InDesign) @ `0bd37b0d10f3` |
| `opf-neddy-flyer/Neddy_Flyer_HeatherRyan.pdf` | Print PDF of the flyer | As above | As above |
| `lizdenys-minizine/indesign-minizine-template.indd` | 20.3 | [CC0](https://creativecommons.org/publicdomain/zero/1.0/), Liz Denys | [lizdenys.com](https://lizdenys.com/journal/articles/indesign-minizine-template.html) (not versioned; the SHA-256 detects changes) |
| `bootstrap3-template/bootstrap3-indesign-template.indd` | 9.2 | MIT, © 2014 Miix ([LICENSE](https://github.com/jeffing/bootstrap3-indesign-template/blob/59a7d9fbe360a495066a4dafb194ff59dde01c10/LICENSE)) | [jeffing/bootstrap3-indesign-template](https://github.com/jeffing/bootstrap3-indesign-template/tree/59a7d9fbe360a495066a4dafb194ff59dde01c10) @ `59a7d9fbe360` |
| `xmp-toolkit-bluesquare/BlueSquare.indd` | 4.0 (big-endian) | BSD 3-Clause, © Adobe ([LICENSE](https://github.com/adobe/XMP-Toolkit-SDK/blob/7093513bd3caaad29da01db0f275d88a39d6bcc2/LICENSE)) | [adobe/XMP-Toolkit-SDK](https://github.com/adobe/XMP-Toolkit-SDK/tree/7093513bd3caaad29da01db0f275d88a39d6bcc2/samples/testfiles) @ `7093513bd3ca` |
| `scml-template/scml.indt` | 7.5 | MIT, © 2014 Scribe, Inc. ([LICENSE](https://github.com/scribenet/scr-scml-indesign-templates/blob/556f09acc5ab48fa9957732c115f8eb78ca09717/LICENSE)) | [scribenet/scr-scml-indesign-templates](https://github.com/scribenet/scr-scml-indesign-templates/tree/556f09acc5ab48fa9957732c115f8eb78ca09717) @ `556f09acc5ab` |

None of the documents has a matching IDML file. The tests check that each
file opens, its header and container are read, its objects are read, and
the converter runs without error. For the two big-endian files they also
check values that can be seen without an IDML (see
`docs/format/big-endian.md`).
