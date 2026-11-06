# Fallback fonts

A design system's fonts often cover only some of the world's scripts. Lolly Demo sets headings in Outfit and text in SUSE, and neither font has Cyrillic, Greek, Arabic, Hebrew, Devanagari, Bengali or Thai letters. When a document holds letters its design system's fonts cannot draw, Lolly draws those letters with an open Noto font, so the export keeps them as vector outlines instead of turning the words into a picture.

The design system's fonts always come first, in the order the design system lists them. Outfit has no Vietnamese letters, so a Vietnamese heading takes them from SUSE, the next font in Lolly Demo's list. A fallback font draws only the characters that none of those fonts can draw, so a brand font keeps every letter, digit and mark it has, even inside a word in another script.

## What is bundled

Eleven fonts, all from Google Fonts at a pinned commit and all under the SIL Open Font License 1.1. Each file is shown with its download size.

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

The weight axis of each font is kept whole, so every weight a design asks for still draws. The width axis is fixed at normal, which halves each file. Noto Sans is split by script, so a Cyrillic word downloads only the Cyrillic letters. The outlines are the upstream outlines, unchanged.

The fonts live in one shared folder, `community/fallback-fonts`, served to every design system from `/catalog/packs/fallback-fonts/`, the same way the emoji sets are shared. `scripts/import-fallback-fonts.ts` builds the files from the upstream fonts pinned in `scripts/data/fallback-fonts.json`, checks every upstream file against its recorded SHA-256 and writes the licence texts beside the fonts.

## When a font downloads

Nothing downloads until a document holds a character that no font of its design system can draw. A document in English, or in any language its design system covers, never downloads a fallback font.

The first time a document needs one, Lolly downloads that one font, for that one script, and keeps it on your device. From then on the script draws offline, and the font stays when the catalog is tidied up. The font is kept with the catalog's own files, never among the fonts you uploaded, so it does not appear in your brand's font list.

The command line, the terminal app and the MCP server read the same files from disk, so they need no download.

## On the page and in the export

The page uses the same fallback font as the export. Without this, a browser draws such letters in a system font while the export uses Noto, and a line that holds them changes width between the two. Lolly adds the fallback font to the end of the design system's font list on that canvas only, after the design system's own fonts and before any system font. A canvas the design system covers keeps its font list exactly as before.

In a PDF the words become outlines drawn with the fallback font, whichever text setting you choose, because live PDF text cannot carry a script the embedded font lacks. In SVG, EMF, EPS, DXF and WMF they become outlines whenever text is converted to outlines; with text kept live, the reader's own fonts draw them, as before. When a fallback font drew some of an export, the export panel shows a note such as:

> Arabic text is drawn with Noto Sans Arabic, because this design system's fonts do not have those letters.

The command line prints the same sentence as a note.

## What stays a picture

Chinese, Japanese and Korean are not bundled yet, because their fonts are large: the upstream files are 9.6 MB to 17.8 MB each. Any script without a fallback font, such as Tamil, Ethiopic or Syriac, is treated the same way. In a PDF those words go in as a 300 dpi picture, and the export panel lists the scripts. In an SVG they stay live text, which the reader's own fonts draw.

## Licences and credits

Every fallback font is under the SIL Open Font License 1.1, and each catalog entry records that licence with a hash of the licence text, so the rights rules in [Creative rights and credits](/info/creative-rights.html) read it like any other font. The licence texts sit beside the fonts. These Noto files declare no Reserved Font Name, so the cut files keep the Noto names.

The licence says that its terms do not apply to documents made with the fonts. An export holds only the drawn outlines of the letters it uses, as it does for the design system's own fonts, and Lolly adds no font program, no credit line and no new content credential entry for a fallback font.
