# Fallback fonts

When a design system's fonts cannot draw a letter, Lolly draws the letter with an open Noto font, so the export keeps the letter as a vector outline instead of a picture. Lolly Demo's fonts, Outfit for headings and SUSE for text, have no Cyrillic, Greek, Arabic, Hebrew, Devanagari, Bengali, Thai, Chinese, Japanese or Korean letters.

The design system's fonts always come first, in their listed order. Outfit has no Vietnamese letters, so a Vietnamese heading takes them from SUSE, the next font in Lolly Demo's list. A fallback font draws only the characters that none of those fonts can draw. A brand font keeps every letter, digit and mark it has, Chinese characters included, even inside a word in another script.

<!--i:eti-package-->
## What is bundled

Fifteen fonts, all from Google Fonts at a pinned commit. Each file is shown with its download size.

| Script | Font | Version | Download |
|---|---|---|---|
| Arabic, including Urdu and Persian letters | Noto Sans Arabic | 2.012 | 211 KB |
| Hebrew | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepali) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengali | Noto Sans Bengali | 3.011 | 139 KB |
| Thai | Noto Sans Thai | 2.002 | 62 KB |
| Cyrillic | Noto Sans, Cyrillic letters | 2.015 | 115 KB, italic 132 KB |
| Greek | Noto Sans, Greek letters | 2.015 | 77 KB, italic 83 KB |
| Latin, including Vietnamese and other accented letters | Noto Sans, Latin letters | 2.015 | 316 KB, italic 350 KB |
| Simplified Chinese, the GB 2312 characters | Noto Sans SC | 2.004 | 2.0 MB |
| Traditional Chinese, the Big5 characters | Noto Sans TC | 2.004 | 3.8 MB |
| Japanese, the Shift_JIS characters | Noto Sans JP | 2.004 | 2.2 MB |
| Korean, every Hangul syllable and the KS X 1001 characters | Noto Sans KR | 2.004 | 2.5 MB |

Each font keeps every weight on its weight axis, so a bold Chinese, Japanese or Korean heading is bold. The Noto Sans fonts have their width axis fixed at normal, which halves each file. The Chinese, Japanese and Korean fonts have no width axis. Noto Sans is split by script, so a Cyrillic word downloads only the Cyrillic letters. The outlines are unchanged from upstream.

::: details Where the fonts live and how they are built
The fonts live in one shared folder, `community/fallback-fonts`, served to every design system from `/catalog/packs/fallback-fonts/`, like the emoji sets. `scripts/import-fallback-fonts.ts` builds the files from the upstream fonts pinned in `scripts/data/fallback-fonts.json`, checks every upstream file against its recorded SHA-256 and writes the licence texts beside the fonts.
:::

<!--i:eti-globe-->
## Chinese, Japanese and Korean

An uncut Chinese, Japanese or Korean font is 9.6 MB to 17.8 MB. Each is cut to its national character set, plus the punctuation, kana, fullwidth forms and symbols of running text:

- Simplified Chinese: GB 2312, the 6,763 common hanzi and its symbols, 7,522 characters in all.
- Traditional Chinese: Big5, its 13,053 hanzi and its symbols, 13,629 characters in all. The Hong Kong Supplementary Character Set is not included.
- Japanese: Shift_JIS as Windows and the web read it, which is JIS X 0208 with the NEC and IBM additions that names such as 髙 and 﨑 need, every kana and the halfwidth katakana, 7,432 characters in all.
- Korean: all 11,172 Hangul syllables and KS X 1001, with its 4,888 hanja, 17,082 characters in all.

These four fonts leave out Latin, Greek and Cyrillic letters, which the design system's fonts and the fonts above draw. The sets come from the Encoding Standard's index files at a pinned commit, so a rebuild gives the same files.

Chinese, Japanese and Korean share most of their characters but draw many of them differently. 直, for example, is written one way in Chinese and another in Japanese. One run of text takes all its shared characters from one of these fonts, never two. Lolly picks that font in this order:

1. The run's language, from the `lang` of its element or the nearest one around it in the document. A tool's language setting, such as the certificate's Language, sets that. The language of Lolly's own interface and the design system's language do not count, so a document exports the same for everyone.
2. The run's script: kana means Japanese and Hangul means Korean. When the run has neither, Lolly reads the document, so a kanji-only heading in a Japanese document is drawn in Japanese. A document with both kana and Hangul settles nothing at this step.
3. A character that only Traditional Chinese uses, such as 體 or 說, in the run or else in the document, means Traditional Chinese, unless the same text also holds one that only Simplified Chinese uses.
4. Otherwise, Simplified Chinese.

A character the chosen font lacks is never taken from one of the other three. It stays a picture. Kana or Hangul that the chosen font lacks, such as Korean words in a line marked as Japanese, can still come from the Japanese or Korean font, but only when that font would draw no shared character of the line.

On the page, a canvas holding two of these languages lists both fonts, and the browser draws the shared characters with the first. The export draws each run with its own.

<!--i:eti-download-->
## When a font downloads

Nothing downloads until a document holds a character that no font of its design system can draw. A symbol in an English line, such as ★ or ※, never downloads a Chinese, Japanese or Korean font.

The first time a document needs a fallback font, Lolly downloads that one font and keeps it on your device. A Japanese document downloads only the Japanese font, 2.2 MB, and a Traditional Chinese one the 3.8 MB Traditional font. From then on the script draws offline, and the font stays when the catalog is tidied up. The font is kept with the catalog's files, never among your uploaded fonts, and does not appear in your brand's font list.

The command line, the terminal app and the MCP server read the same files from disk, so they need no download.

<!--i:eti-eye-->
## On the page and in the export

The page uses the same fallback font as the export, so a line that holds such letters has the same width in both. On that canvas only, Lolly adds the fallback font after the design system's own fonts and before any system font. A tool that sets its own font list, in its styles or on its elements, gets the fallback font in the same place. A canvas the design system covers keeps its font list unchanged.

The page leaves a font list alone when it starts with a system font, such as `system-ui` or Helvetica, because the export draws that text with the design system's fonts and the page does not.

In a PDF the words become outlines in the fallback font with any text setting, because live PDF text cannot carry a script the embedded font lacks. In SVG, EMF, EPS, DXF and WMF they become outlines whenever text is converted to outlines. With text kept live, the reader's own fonts draw them. When a fallback font drew part of an export, the export panel shows a note such as:

> Japanese text is drawn with Noto Sans JP, because this design system's fonts do not have those letters.

The command line prints the same sentence as a note.

<!--i:eti-image-->
## What stays a picture

A character outside the four national sets, such as 𠮷 or a Hong Kong supplementary character, has no fallback font. Rare characters such as 𠮷, the characters added for Hong Kong by its supplementary set, and scripts without a fallback font, such as Tamil, Ethiopic or Syriac, are all treated the same way. Nor does a script such as Tamil, Ethiopic or Syriac. In a PDF the line that holds such text goes in as a 300 dpi picture, and the export panel lists the scripts. In an SVG the run stays live text, which the reader's own fonts draw.

::: details In EPS, WMF and EMF exports
An EPS, a WMF or an EMF with **Outline fonts** on has no live text to fall back on, so the run goes in as a 300 dpi picture too. The picture paints the text's colour only where the letters are, so the background shows through. The export panel lists the scripts. A picture is drawn upright only, so a turned or slanted run stops the export with a message that quotes the run. In a WMF or EMF the picture is a pair of bitmap operations, a mask and a paint. Microsoft Office and LibreOffice draw them as intended. An app that ignores them, such as Inkscape, shows the words on a white box.

An EMF with **Outline fonts** off keeps such a run as live text, which the reader's own fonts draw. The exception is a run that live EMF text cannot carry, such as text with letter spacing. Lolly outlines that run, so a run no font can draw goes in as a picture there as well.
:::

::: warning A DXF export stops at text no font can draw
A DXF goes to cutting machines and CAD software, which need outlines, so a run no font can draw stops a DXF export. The message quotes the run and gives its script. Add a font with those letters, or export SVG or PDF.
:::

<!--i:eti-checklist-->
## The check before you export

Lolly Design's **Before you export** card and the `render` checks of `lolly check` report text that no font can draw. They count the fallback fonts as an export does, from the same per-font character lists, so text a fallback font draws is not reported. A script with no fallback font, such as Tamil, and a Chinese, Japanese or Korean character outside the national sets are still reported, because the export draws them as a picture or as live text, and a DXF export stops at them. The check reads those lists from the catalog and downloads no font.

<!--i:eti-stamp-->
## Licences and credits

Every fallback font is under the SIL Open Font License 1.1. Each catalog entry records that licence with a hash of the licence text, so the rights rules in [Creative rights and credits](/info/creative-rights.html) read the licence like any other font's. The licence texts sit beside the fonts. The Noto Sans files declare no Reserved Font Name. The Chinese, Japanese and Korean fonts are Adobe's and reserve the name Source. The cut files keep their Noto names, which do not use that name.

The licence says its terms do not apply to documents made with the fonts. An export holds only the outlines of the letters it uses, as with the design system's own fonts. Lolly adds no font program, no credit line and no new content credential entry for a fallback font.
