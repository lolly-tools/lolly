# Fallback fonts

A design system's fonts often cover only some of the world's scripts. Lolly Demo sets headings in Outfit and text in SUSE, and neither font has Cyrillic, Greek, Arabic, Hebrew, Devanagari, Bengali, Thai, Chinese, Japanese or Korean letters. When a document holds letters its design system's fonts cannot draw, Lolly draws those letters with an open Noto font, so the export keeps them as vector outlines instead of turning the words into a picture.

The design system's fonts always come first, in the order the design system lists them. Outfit has no Vietnamese letters, so a Vietnamese heading takes them from SUSE, the next font in Lolly Demo's list. A fallback font draws only the characters that none of those fonts can draw, so a brand font keeps every letter, digit and mark it has, even inside a word in another script. A brand font that has a Chinese character keeps that character too.

## What is bundled

Fifteen fonts, all from Google Fonts at a pinned commit and all under the SIL Open Font License 1.1. Each file is shown with its download size.

| Script | Font | Version | Download |
|---|---|---|---|
| Arabic, including Urdu and Persian letters | Noto Sans Arabic | 2.012 | 206 KB |
| Hebrew | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepali) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengali | Noto Sans Bengali | 3.011 | 136 KB |
| Thai | Noto Sans Thai | 2.002 | 61 KB |
| Cyrillic | Noto Sans, Cyrillic letters | 2.015 | 112 KB, italic 129 KB |
| Greek | Noto Sans, Greek letters | 2.015 | 75 KB, italic 81 KB |
| Latin, including Vietnamese and other accented letters | Noto Sans, Latin letters | 2.015 | 309 KB, italic 342 KB |
| Simplified Chinese, the GB 2312 characters | Noto Sans SC | 2.004 | 1.9 MB |
| Traditional Chinese, the Big5 characters | Noto Sans TC | 2.004 | 3.6 MB |
| Japanese, the Shift_JIS characters | Noto Sans JP | 2.004 | 2.1 MB |
| Korean, every Hangul syllable and the KS X 1001 characters | Noto Sans KR | 2.004 | 2.4 MB |

The weight axis of each font is kept whole, so every weight a design asks for still draws, and a bold Chinese, Japanese or Korean heading is bold. The width axis of the Noto Sans fonts is fixed at normal, which halves each file; the Chinese, Japanese and Korean fonts have no width axis. Noto Sans is split by script, so a Cyrillic word downloads only the Cyrillic letters. The outlines are the upstream outlines, unchanged.

The fonts live in one shared folder, `community/fallback-fonts`, served to every design system from `/catalog/packs/fallback-fonts/`, the same way the emoji sets are shared. `scripts/import-fallback-fonts.ts` builds the files from the upstream fonts pinned in `scripts/data/fallback-fonts.json`, checks every upstream file against its recorded SHA-256 and writes the licence texts beside the fonts.

## Chinese, Japanese and Korean

A whole Chinese, Japanese or Korean font is 9.6 MB to 17.8 MB, so each of these fonts is cut to the national character set its readers use every day, plus the punctuation, kana, fullwidth forms and symbols of running text:

- Simplified Chinese: GB 2312, the 6,763 common hanzi and its symbols, 7,522 characters in all.
- Traditional Chinese: Big5, its 13,053 hanzi and its symbols, 13,629 characters in all. The Hong Kong Supplementary Character Set is not included.
- Japanese: Shift_JIS as Windows and the web read it, which is JIS X 0208 with the NEC and IBM additions that names such as 髙 and 﨑 need, every kana and the halfwidth katakana, 7,432 characters in all.
- Korean: all 11,172 Hangul syllables and KS X 1001, with its 4,888 hanja, 17,082 characters in all.

Latin, Greek and Cyrillic letters are left out of these four fonts, because the design system's fonts and the fonts above draw them. The sets are read from the Encoding Standard's index files at a pinned commit, so a rebuild gives the same files.

Chinese, Japanese and Korean share most of their characters, but each draws many of them differently. The same character 直 is written one way in Chinese and another in Japanese. So one run of text takes all its shared characters from one of these fonts, never two, and Lolly picks that font in this order:

1. The run's language, from the `lang` of its element or the nearest one around it in the document. A tool's language setting, such as the certificate's Language, sets that. The language of Lolly's own interface and the design system's language do not count, so a document exports the same for everyone.
2. The run's script: kana means Japanese and Hangul means Korean. When the run itself has neither, the whole document is read, so a heading of kanji alone in a Japanese document is drawn in Japanese. A document that holds both kana and Hangul settles nothing here.
3. A character that only Traditional Chinese uses, such as 體 or 說, in the run or else in the document, means Traditional Chinese, unless the same text also holds one that only Simplified Chinese uses.
4. Otherwise, Simplified Chinese.

A character the chosen font does not have is never taken from one of the other three. It stays a picture, as described below. Kana or Hangul that the chosen font lacks, such as Korean words in a line marked as Japanese, can still come from the Japanese or Korean font, but only when that font would draw no shared character of the line.

On the page, a canvas holding two of these languages lists both fonts, and the browser draws the shared characters with the first. The export draws each run with its own.

## When a font downloads

Nothing downloads until a document holds a character that no font of its design system can draw. A document in English, or in any language its design system covers, never downloads a fallback font. A symbol in an English line, such as ★ or ※, never downloads a Chinese, Japanese or Korean font.

The first time a document needs one, Lolly downloads that one font, for that one script, and keeps it on your device. A Japanese document downloads the Japanese font alone, 2.1 MB, and a Traditional Chinese one the 3.6 MB Traditional font. From then on the script draws offline, and the font stays when the catalog is tidied up. The font is kept with the catalog's own files, never among the fonts you uploaded, so it does not appear in your brand's font list.

The command line, the terminal app and the MCP server read the same files from disk, so they need no download.

## On the page and in the export

The page uses the same fallback font as the export. Without this, a browser draws such letters in a system font while the export uses Noto, and a line that holds them changes width between the two. Lolly adds the fallback font to the end of the design system's font list on that canvas only, after the design system's own fonts and before any system font. A tool that sets its own font list, in its styles or on its elements, gets the fallback font in the same place: after the fonts the list gives and before any system font. A canvas the design system covers keeps its font list exactly as before.

The page leaves a font list alone when it starts with a system font, such as `system-ui` or Helvetica, because the export draws that text with the design system's fonts and the page does not.

In a PDF the words become outlines drawn with the fallback font, whichever text setting you choose, because live PDF text cannot carry a script the embedded font lacks. In SVG, EMF, EPS, DXF and WMF they become outlines whenever text is converted to outlines; with text kept live, the reader's own fonts draw them, as before. When a fallback font drew some of an export, the export panel shows a note such as:

> Japanese text is drawn with Noto Sans JP, because this design system's fonts do not have those letters.

The command line prints the same sentence as a note.

## What stays a picture

A character outside the four national sets has no fallback font. Rare characters such as 𠮷, the characters added for Hong Kong by its supplementary set, and scripts without a fallback font, such as Tamil, Ethiopic or Syriac, are all treated the same way. In a PDF the line that holds one goes in as a 300 dpi picture, and the export panel lists the scripts. In an SVG the run stays live text, which the reader's own fonts draw.

## The check before you export

Lolly Design's **Before you export** card, and the `render` checks of `lolly check`, report text that no font can draw. They count the fallback fonts the way an export does, from the same lists of the characters each font has, so text a fallback font draws is not reported. A script with no fallback font, such as Tamil, and a Chinese, Japanese or Korean character outside the national sets are still reported, because the export draws them as a picture or as live text. The check reads those lists from the catalog and downloads no font.

## Licences and credits

Every fallback font is under the SIL Open Font License 1.1, and each catalog entry records that licence with a hash of the licence text, so the rights rules in [Creative rights and credits](/info/creative-rights.html) read the licence like any other font's. The licence texts sit beside the fonts. The Noto Sans files declare no Reserved Font Name. The Chinese, Japanese and Korean fonts are Adobe's, and reserve the name Source; the cut files keep their Noto names, which do not use that name.

The licence says that its terms do not apply to documents made with the fonts. An export holds only the drawn outlines of the letters it uses, as it does for the design system's own fonts, and Lolly adds no font program, no credit line and no new content credential entry for a fallback font.
