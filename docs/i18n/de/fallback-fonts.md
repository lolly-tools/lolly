# Ersatzschriften

Wenn die Schriften eines Designsystems einen Buchstaben nicht zeichnen können, zeichnet Lolly ihn mit einer offenen Noto-Schrift, sodass der Export den Buchstaben als Vektorumriss statt als Bild erhält. Die Schriften von Lolly Demo, Outfit für Überschriften und SUSE für Text, haben keine kyrillischen, griechischen, arabischen, hebräischen, Devanagari-, bengalischen, thailändischen, chinesischen, japanischen oder koreanischen Buchstaben.

Die Schriften des Designsystems kommen immer zuerst, in ihrer aufgelisteten Reihenfolge. Outfit hat keine vietnamesischen Buchstaben, daher übernimmt eine vietnamesische Überschrift diese aus SUSE, der nächsten Schrift in der Liste von Lolly Demo. Eine Ersatzschrift zeichnet nur die Zeichen, die keine dieser Schriften zeichnen kann. Eine Markenschrift behält jeden Buchstaben, jede Ziffer und jedes Zeichen, die sie enthält, einschließlich chinesischer Zeichen, auch innerhalb eines Wortes in einem anderen Schriftsystem.

<!--i:eti-package-->
## Was mitgeliefert wird

Fünfzehn Schriften, alle von Google Fonts aus einem festgelegten Commit. Jede Datei wird mit ihrer Downloadgröße angezeigt.

| Schriftsystem | Schrift | Version | Download |
|---|---|---|---|
| Arabisch, einschließlich Urdu- und persischer Buchstaben | Noto Sans Arabic | 2.012 | 211 KB |
| Hebräisch | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepali) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengalisch | Noto Sans Bengali | 3.011 | 139 KB |
| Thailändisch | Noto Sans Thai | 2.002 | 62 KB |
| Kyrillisch | Noto Sans, kyrillische Buchstaben | 2.015 | 115 KB, kursiv 132 KB |
| Griechisch | Noto Sans, griechische Buchstaben | 2.015 | 77 KB, kursiv 83 KB |
| Lateinisch, einschließlich vietnamesischer und anderer akzentuierter Buchstaben | Noto Sans, lateinische Buchstaben | 2.015 | 316 KB, kursiv 350 KB |
| Vereinfachtes Chinesisch, die GB-2312-Zeichen | Noto Sans SC | 2.004 | 2,0 MB |
| Traditionelles Chinesisch, die Big5-Zeichen | Noto Sans TC | 2.004 | 3,8 MB |
| Japanisch, die Shift_JIS-Zeichen | Noto Sans JP | 2.004 | 2,2 MB |
| Koreanisch, jede Hangul-Silbe und die KS-X-1001-Zeichen | Noto Sans KR | 2.004 | 2,5 MB |

Jede Schrift behält alle Strichstärken auf ihrer Strichstärkenachse, sodass eine fette chinesische, japanische oder koreanische Überschrift fett ist. Bei den Noto Sans-Schriften ist die Breitenachse auf Normal festgelegt, was jede Datei halbiert. Die chinesischen, japanischen und koreanischen Schriften haben keine Breitenachse. Noto Sans ist nach Schriftsystem aufgeteilt, sodass ein kyrillisches Wort nur die kyrillischen Buchstaben herunterlädt. Die Umrisse sind gegenüber dem Original unverändert.

::: details Wo die Schriften liegen und wie sie erstellt werden
Die Schriften liegen in einem gemeinsamen Ordner, `community/fallback-fonts`, und werden wie die Emoji-Sets unter `/catalog/packs/fallback-fonts/` an jedes Designsystem ausgeliefert. `scripts/import-fallback-fonts.ts` erstellt die Dateien aus den in `scripts/data/fallback-fonts.json` festgelegten Originalschriften, prüft jede Originaldatei gegen ihren festgehaltenen SHA-256 und schreibt die Lizenztexte neben die Schriften.
:::

<!--i:eti-globe-->
## Chinesisch, Japanisch und Koreanisch

Eine ungekürzte chinesische, japanische oder koreanische Schrift ist 9,6 MB bis 17,8 MB groß. Jede wird auf ihren nationalen Zeichensatz gekürzt, ergänzt um die Satzzeichen, Kana, vollbreiten Formen und Symbole von Fließtext:

- Vereinfachtes Chinesisch: GB 2312, die 6.763 gebräuchlichen Hanzi und seine Symbole, insgesamt 7.522 Zeichen.
- Traditionelles Chinesisch: Big5, seine 13.053 Hanzi und seine Symbole, insgesamt 13.629 Zeichen. Das Hong Kong Supplementary Character Set ist nicht enthalten.
- Japanisch: Shift_JIS, wie Windows und das Web es lesen, also JIS X 0208 mit den NEC- und IBM-Ergänzungen, die Namen wie 髙 und 﨑 benötigen, allen Kana und den halbbreiten Katakana, insgesamt 7.432 Zeichen.
- Koreanisch: alle 11.172 Hangul-Silben und KS X 1001 mit seinen 4.888 Hanja, insgesamt 17.082 Zeichen.

Diese vier Schriften lassen lateinische, griechische und kyrillische Buchstaben weg, die von den Schriften des Designsystems und den oben genannten Schriften gezeichnet werden. Die Zeichensätze stammen aus den Indexdateien des Encoding Standard aus einem festgelegten Commit, sodass ein erneuter Build dieselben Dateien erzeugt.

Chinesisch, Japanisch und Koreanisch teilen die meisten ihrer Zeichen, zeichnen viele davon aber unterschiedlich. 直 etwa wird im Chinesischen anders geschrieben als im Japanischen. Ein Textabschnitt bezieht alle seine gemeinsamen Zeichen aus einer dieser Schriften, niemals aus zweien. Lolly wählt diese Schrift in folgender Reihenfolge:

1. Die Sprache des Textabschnitts, aus dem `lang` seines Elements oder des nächstgelegenen umgebenden Elements im Dokument. Die Spracheinstellung eines Tools, etwa Language beim Zertifikat, legt dies fest. Die Sprache von Lollys eigener Oberfläche und die Sprache des Designsystems zählen nicht, sodass ein Dokument für alle gleich exportiert wird.
2. Das Schriftsystem des Textabschnitts: Kana bedeutet Japanisch und Hangul bedeutet Koreanisch. Enthält der Abschnitt keines von beiden, liest Lolly das Dokument, sodass eine Überschrift nur aus Kanji in einem japanischen Dokument japanisch gezeichnet wird. Ein Dokument mit Kana und Hangul führt in diesem Schritt zu keiner Entscheidung.
3. Ein Zeichen, das nur das traditionelle Chinesisch verwendet, etwa 體 oder 說, im Textabschnitt oder andernfalls im Dokument bedeutet traditionelles Chinesisch, sofern derselbe Text nicht auch eines enthält, das nur das vereinfachte Chinesisch verwendet.
4. Andernfalls vereinfachtes Chinesisch.

Ein Zeichen, das der gewählten Schrift fehlt, wird nie aus einer der anderen drei übernommen. Es bleibt ein Bild. Kana oder Hangul, die der gewählten Schrift fehlen, etwa koreanische Wörter in einer als japanisch markierten Zeile, können weiterhin aus der japanischen oder koreanischen Schrift stammen, aber nur, wenn diese Schrift kein gemeinsames Zeichen der Zeile zeichnen würde.

Auf der Seite listet eine Arbeitsfläche mit zwei dieser Sprachen beide Schriften auf, und der Browser zeichnet die gemeinsamen Zeichen mit der ersten. Der Export zeichnet jeden Textabschnitt mit seiner eigenen.

<!--i:eti-download-->
## Wann eine Schrift heruntergeladen wird

Nichts wird heruntergeladen, bis ein Dokument ein Zeichen enthält, das keine Schrift seines Designsystems zeichnen kann. Ein Symbol in einer englischen Zeile, etwa ★ oder ※, lädt nie eine chinesische, japanische oder koreanische Schrift herunter.

Wenn ein Dokument zum ersten Mal eine Ersatzschrift benötigt, lädt Lolly diese eine Schrift herunter und behält sie auf Ihrem Gerät. Ein japanisches Dokument lädt nur die japanische Schrift mit 2,2 MB herunter, ein traditionell chinesisches die traditionelle Schrift mit 3,8 MB. Von da an wird das Schriftsystem offline gezeichnet, und die Schrift bleibt erhalten, wenn der Katalog aufgeräumt wird. Die Schrift wird bei den Katalogdateien aufbewahrt, nie bei Ihren hochgeladenen Schriften, und erscheint nicht in der Schriftliste Ihrer Marke.

Die Befehlszeile, die Terminal-App und der MCP-Server lesen dieselben Dateien vom Datenträger und benötigen deshalb keinen Download.

<!--i:eti-eye-->
## Auf der Seite und im Export

Die Seite verwendet dieselbe Ersatzschrift wie der Export, sodass eine Zeile mit solchen Buchstaben in beiden dieselbe Breite hat. Nur auf dieser Arbeitsfläche fügt Lolly die Ersatzschrift nach den eigenen Schriften des Designsystems und vor jeder Systemschrift ein. Ein Tool, das in seinen Styles oder auf seinen Elementen eine eigene Schriftliste festlegt, erhält die Ersatzschrift an derselben Stelle. Eine Arbeitsfläche, die das Designsystem abdeckt, behält ihre Schriftliste unverändert.

Die Seite lässt eine Schriftliste unverändert, wenn sie mit einer Systemschrift wie `system-ui` oder Helvetica beginnt, weil der Export diesen Text mit den Schriften des Designsystems zeichnet, die Seite aber nicht.

In einem PDF werden die Wörter bei jeder Texteinstellung zu Umrissen in der Ersatzschrift, weil Live-Text in PDF kein Schriftsystem enthalten kann, das der eingebetteten Schrift fehlt. In SVG, EMF, EPS, DXF und WMF werden sie zu Umrissen, sobald Text in Umrisse umgewandelt wird. Bleibt Text als Live-Text erhalten, zeichnen ihn die eigenen Schriften des Betrachters. Wenn eine Ersatzschrift einen Teil eines Exports gezeichnet hat, zeigt das Export-Panel einen Hinweis wie diesen:

> Japanischer Text wird mit Noto Sans JP gezeichnet, weil die Schriften dieses Designsystems diese Buchstaben nicht enthalten.

Die Befehlszeile gibt denselben Satz als Hinweis aus.

<!--i:eti-image-->
## Was ein Bild bleibt

Ein Zeichen außerhalb der vier nationalen Zeichensätze, etwa 𠮷 oder ein Hongkonger Ergänzungszeichen, hat keine Ersatzschrift. Seltene Zeichen wie 𠮷, die für Hongkong durch seinen Ergänzungszeichensatz hinzugefügten Zeichen und Schriftsysteme ohne Ersatzschrift wie Tamil, Äthiopisch oder Syrisch werden alle gleich behandelt. Auch ein Schriftsystem wie Tamil, Äthiopisch oder Syrisch hat keine Ersatzschrift. In einem PDF wird die Zeile mit solchem Text als Bild mit 300 dpi eingefügt, und das Export-Panel listet die Schriftsysteme auf. In einem SVG bleibt der Abschnitt Live-Text, den die eigenen Schriften des Betrachters zeichnen.

::: details In EPS-, WMF- und EMF-Exporten
Ein EPS, WMF oder EMF mit eingeschaltetem **Outline fonts** kann nicht auf Live-Text zurückgreifen, daher wird der Textabschnitt ebenfalls als Bild mit 300 dpi eingefügt. Das Bild zeichnet die Textfarbe nur dort, wo die Buchstaben sind, sodass der Hintergrund durchscheint. Das Export-Panel listet die Schriftsysteme auf. Ein Bild wird nur aufrecht gezeichnet, daher stoppt ein gedrehter oder geneigter Textabschnitt den Export mit einer Meldung, die den Abschnitt zitiert. In einem WMF oder EMF besteht das Bild aus zwei Bitmap-Operationen, einer Maske und einem Farbauftrag. Microsoft Office und LibreOffice zeichnen sie wie vorgesehen. Eine App, die sie ignoriert, etwa Inkscape, zeigt die Wörter auf einem weißen Rechteck.

Ein EMF mit ausgeschaltetem **Outline fonts** behält einen solchen Abschnitt als Live-Text, den die eigenen Schriften des Betrachters zeichnen. Die Ausnahme ist ein Abschnitt, den Live-Text in EMF nicht abbilden kann, etwa Text mit Zeichenabstand. Lolly wandelt diesen Abschnitt in Umrisse um, sodass ein Abschnitt, den keine Schrift zeichnen kann, auch dort als Bild eingefügt wird.
:::

::: warning Ein DXF-Export stoppt bei Text, den keine Schrift zeichnen kann
Ein DXF geht an Schneidemaschinen und CAD-Software, die Umrisse benötigen. Daher stoppt ein Textabschnitt, den keine Schrift zeichnen kann, einen DXF-Export. Die Meldung zitiert den Abschnitt und nennt sein Schriftsystem. Fügen Sie eine Schrift mit diesen Buchstaben hinzu oder exportieren Sie SVG oder PDF.
:::

<!--i:eti-checklist-->
## Die Prüfung vor dem Export

Die Karte **Before you export** von Lolly Design und die `render`-Prüfungen von `lolly check` melden Text, den keine Schrift zeichnen kann. Sie berücksichtigen die Ersatzschriften wie ein Export anhand derselben Zeichenlisten pro Schrift, sodass Text, den eine Ersatzschrift zeichnet, nicht gemeldet wird. Ein Schriftsystem ohne Ersatzschrift, etwa Tamil, und ein chinesisches, japanisches oder koreanisches Zeichen außerhalb der nationalen Zeichensätze werden weiterhin gemeldet, weil der Export sie als Bild oder Live-Text zeichnet und ein DXF-Export bei ihnen stoppt. Die Prüfung liest diese Listen aus dem Katalog und lädt keine Schrift herunter.

<!--i:eti-stamp-->
## Lizenzen und Urheberangaben

Jede Ersatzschrift steht unter der SIL Open Font License 1.1. Jeder Katalogeintrag hält diese Lizenz mit einem Hash des Lizenztexts fest, sodass die Rechteregeln unter [Rechte an kreativen Werken und Quellenangaben](/info/creative-rights.html) die Lizenz wie die jeder anderen Schrift lesen. Die Lizenztexte liegen neben den Schriften. Die Noto Sans-Dateien geben keinen Reserved Font Name an. Die chinesischen, japanischen und koreanischen Schriften stammen von Adobe und reservieren den Namen Source. Die gekürzten Dateien behalten ihre Noto-Namen, die diesen Namen nicht verwenden.

Die Lizenz besagt, dass ihre Bedingungen nicht für Dokumente gelten, die mit den Schriften erstellt wurden. Ein Export enthält nur die Umrisse der verwendeten Buchstaben, wie bei den eigenen Schriften des Designsystems. Lolly fügt für eine Ersatzschrift kein Schriftprogramm, keine Urheberzeile und keinen neuen Eintrag im Content Credential hinzu.
