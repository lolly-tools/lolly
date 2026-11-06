# Ersatzschriften

Die Schriften eines Designsystems decken oft nur einen Teil der Schriftsysteme der Welt ab. Lolly Demo setzt Überschriften in Outfit und Text in SUSE, und keine der beiden Schriften hat kyrillische, griechische, arabische, hebräische, Devanagari-, bengalische, thailändische, chinesische, japanische oder koreanische Buchstaben. Enthält ein Dokument Buchstaben, die die Schriften seines Designsystems nicht zeichnen können, zeichnet Lolly diese Buchstaben mit einer offenen Noto-Schrift. So behält der Export sie als Vektorumrisse, statt die Wörter in ein Bild zu verwandeln.

Die Schriften des Designsystems haben immer Vorrang, in der Reihenfolge, in der das Designsystem sie aufführt. Outfit hat keine vietnamesischen Buchstaben, daher holt sich eine vietnamesische Überschrift diese aus SUSE, der nächsten Schrift in der Liste von Lolly Demo. Eine Ersatzschrift zeichnet nur die Zeichen, die keine dieser Schriften zeichnen kann. Eine Markenschrift behält also jeden Buchstaben, jede Ziffer und jedes Zeichen, das sie hat, sogar innerhalb eines Wortes in einer anderen Schrift. Hat eine Markenschrift ein chinesisches Zeichen, behält sie auch dieses.

## Was mitgeliefert wird

Fünfzehn Schriften, alle von Google Fonts bei einem festgelegten Commit und alle unter der SIL Open Font License 1.1. Jede Datei steht mit ihrer Downloadgröße da.

| Schriftsystem | Schrift | Version | Download |
|---|---|---|---|
| Arabisch, einschließlich der Buchstaben für Urdu und Persisch | Noto Sans Arabic | 2.012 | 206 KB |
| Hebräisch | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (Hindi, Marathi, Nepali) | Noto Sans Devanagari | 2.007 | 147 KB |
| Bengalisch | Noto Sans Bengali | 3.011 | 136 KB |
| Thai | Noto Sans Thai | 2.002 | 61 KB |
| Kyrillisch | Noto Sans, kyrillische Buchstaben | 2.015 | 112 KB, kursiv 129 KB |
| Griechisch | Noto Sans, griechische Buchstaben | 2.015 | 75 KB, kursiv 81 KB |
| Lateinisch, einschließlich Vietnamesisch und anderer Buchstaben mit Akzent | Noto Sans, lateinische Buchstaben | 2.015 | 309 KB, kursiv 342 KB |
| Vereinfachtes Chinesisch, die GB-2312-Zeichen | Noto Sans SC | 2.004 | 1,9 MB |
| Traditionelles Chinesisch, die Big5-Zeichen | Noto Sans TC | 2.004 | 3,6 MB |
| Japanisch, die Shift_JIS-Zeichen | Noto Sans JP | 2.004 | 2,1 MB |
| Koreanisch, jede Hangul-Silbe und die KS-X-1001-Zeichen | Noto Sans KR | 2.004 | 2,4 MB |

Die Gewichtsachse jeder Schrift bleibt vollständig erhalten, daher wird jedes Gewicht, das ein Design verlangt, weiterhin gezeichnet, und eine fette chinesische, japanische oder koreanische Überschrift ist fett. Die Breitenachse der Noto-Sans-Schriften ist auf normal festgelegt, was jede Datei halbiert; die chinesischen, japanischen und koreanischen Schriften haben keine Breitenachse. Noto Sans ist nach Schriftsystem aufgeteilt, daher lädt ein kyrillisches Wort nur die kyrillischen Buchstaben herunter. Die Umrisse sind die unveränderten Umrisse des Originals.

Die Schriften liegen in einem gemeinsamen Ordner, `community/fallback-fonts`, der jedem Designsystem unter `/catalog/packs/fallback-fonts/` bereitgestellt wird, genau wie die Emoji-Sets gemeinsam genutzt werden. `scripts/import-fallback-fonts.ts` baut die Dateien aus den Originalschriften, die in `scripts/data/fallback-fonts.json` festgelegt sind, prüft jede Originaldatei gegen ihren erfassten SHA-256 und schreibt die Lizenztexte neben die Schriften.

## Chinesisch, Japanisch und Koreanisch

Eine vollständige chinesische, japanische oder koreanische Schrift ist 9,6 MB bis 17,8 MB groß. Deshalb wird jede dieser Schriften auf den nationalen Zeichensatz zugeschnitten, den ihre Leserinnen und Leser täglich verwenden, dazu die Satzzeichen, Kana, Vollbreitenformen und Symbole des laufenden Textes:

- Vereinfachtes Chinesisch: GB 2312, die 6.763 gebräuchlichen Hanzi und seine Symbole, insgesamt 7.522 Zeichen.
- Traditionelles Chinesisch: Big5, seine 13.053 Hanzi und seine Symbole, insgesamt 13.629 Zeichen. Der Hong Kong Supplementary Character Set ist nicht enthalten.
- Japanisch: Shift_JIS, wie Windows und das Web es lesen, also JIS X 0208 mit den Ergänzungen von NEC und IBM, die Namen wie 髙 und 﨑 brauchen, dazu jedes Kana und das halbbreite Katakana, insgesamt 7.432 Zeichen.
- Koreanisch: alle 11.172 Hangul-Silben und KS X 1001 mit seinen 4.888 Hanja, insgesamt 17.082 Zeichen.

Lateinische, griechische und kyrillische Buchstaben fehlen in diesen vier Schriften, weil die Schriften des Designsystems und die oben genannten Schriften sie zeichnen. Die Zeichensätze werden aus den Indexdateien des Encoding Standard bei einem festgelegten Commit gelesen, daher ergibt ein erneuter Build dieselben Dateien.

Chinesisch, Japanisch und Koreanisch teilen die meisten ihrer Zeichen, zeichnen aber viele davon unterschiedlich. Dasselbe Zeichen 直 wird auf Chinesisch auf die eine Weise geschrieben und auf Japanisch auf eine andere. Deshalb nimmt ein Textabschnitt alle seine gemeinsamen Zeichen aus einer dieser Schriften, nie aus zweien, und Lolly wählt diese Schrift in dieser Reihenfolge:

1. Die Sprache des Textabschnitts, aus dem `lang` seines Elements oder des nächsten umgebenden Elements im Dokument. Die Spracheinstellung eines Tools, etwa die Language des Zertifikats, legt sie fest. Die Sprache von Lollys eigener Oberfläche und die Sprache des Designsystems zählen nicht, daher wird ein Dokument für alle gleich exportiert.
2. Das Schriftsystem des Textabschnitts: Kana bedeutet Japanisch und Hangul bedeutet Koreanisch. Hat der Abschnitt selbst keines von beiden, wird das ganze Dokument gelesen, daher wird eine Überschrift nur aus Kanji in einem japanischen Dokument auf Japanisch gezeichnet. Ein Dokument, das Kana und Hangul enthält, entscheidet hier nichts.
3. Ein Zeichen, das nur im traditionellen Chinesisch vorkommt, etwa 體 oder 說, im Abschnitt oder sonst im Dokument, bedeutet traditionelles Chinesisch, es sei denn, derselbe Text enthält auch eines, das nur im vereinfachten Chinesisch vorkommt.
4. Andernfalls vereinfachtes Chinesisch.

Ein Zeichen, das die gewählte Schrift nicht hat, wird nie aus einer der drei anderen genommen. Es bleibt ein Bild, wie unten beschrieben. Kana oder Hangul, die der gewählten Schrift fehlen, etwa koreanische Wörter in einer als Japanisch markierten Zeile, können weiterhin aus der japanischen oder koreanischen Schrift kommen, aber nur, wenn diese Schrift kein gemeinsames Zeichen der Zeile zeichnen würde.

Auf der Seite führt eine Arbeitsfläche mit zwei dieser Sprachen beide Schriften auf, und der Browser zeichnet die gemeinsamen Zeichen mit der ersten. Der Export zeichnet jeden Textabschnitt mit seiner eigenen.

## Wann eine Schrift heruntergeladen wird

Nichts wird heruntergeladen, bis ein Dokument ein Zeichen enthält, das keine Schrift seines Designsystems zeichnen kann. Ein Dokument auf Englisch oder in einer anderen Sprache, die sein Designsystem abdeckt, lädt nie eine Ersatzschrift herunter. Ein Symbol in einer englischen Zeile, etwa ★ oder ※, lädt nie eine chinesische, japanische oder koreanische Schrift herunter.

Beim ersten Mal, wenn ein Dokument eine braucht, lädt Lolly diese eine Schrift für dieses eine Schriftsystem herunter und behält sie auf Ihrem Gerät. Ein japanisches Dokument lädt allein die japanische Schrift herunter, 2,1 MB, ein traditionell chinesisches die traditionelle Schrift mit 3,6 MB. Von da an wird das Schriftsystem offline gezeichnet, und die Schrift bleibt erhalten, wenn der Katalog aufgeräumt wird. Die Schrift wird bei den eigenen Dateien des Katalogs aufbewahrt, nie unter den Schriften, die Sie hochgeladen haben, daher erscheint sie nicht in der Schriftenliste Ihrer Marke.

Die Kommandozeile, die Terminal-App und der MCP-Server lesen dieselben Dateien von der Festplatte, daher brauchen sie keinen Download.

## Auf der Seite und im Export

Die Seite nutzt dieselbe Ersatzschrift wie der Export. Ohne das zeichnet ein Browser solche Buchstaben in einer Systemschrift, während der Export Noto verwendet, und eine Zeile, die sie enthält, ändert zwischen beiden ihre Breite. Lolly hängt die Ersatzschrift nur auf dieser Arbeitsfläche ans Ende der Schriftenliste des Designsystems an, nach den eigenen Schriften des Designsystems und vor jeder Systemschrift. Eine Arbeitsfläche, die das Designsystem abdeckt, behält ihre Schriftenliste genau wie zuvor.

In einem PDF werden die Wörter zu Umrissen, die mit der Ersatzschrift gezeichnet sind, welche Texteinstellung Sie auch wählen, denn Live-Text im PDF kann kein Schriftsystem tragen, das der eingebettete Font nicht hat. In SVG, EMF, EPS, DXF und WMF werden sie zu Umrissen, wann immer Text in Umrisse umgewandelt wird; bleibt der Text live, zeichnen die eigenen Schriften der Leserin oder des Lesers ihn wie bisher. Hat eine Ersatzschrift einen Teil eines Exports gezeichnet, zeigt das Export-Panel einen Hinweis wie diesen:

> Japanischer Text wird mit Noto Sans JP gezeichnet, weil die Schriften dieses Designsystems diese Buchstaben nicht haben.

Die Kommandozeile gibt denselben Satz als Hinweis aus.

## Was ein Bild bleibt

Für ein Zeichen außerhalb der vier nationalen Zeichensätze gibt es keine Ersatzschrift. Seltene Zeichen wie 𠮷, die für Hongkong ergänzten Zeichen des Supplementary Character Set und Schriftsysteme ohne Ersatzschrift, etwa Tamil, Äthiopisch oder Syrisch, werden alle gleich behandelt. In einem PDF kommt die Zeile, die eines enthält, als Bild mit 300 dpi hinein, und das Export-Panel listet die Schriftsysteme auf. In einem SVG bleibt der Textabschnitt Live-Text, den die eigenen Schriften der Leserin oder des Lesers zeichnen.

## Lizenzen und Credits

Jede Ersatzschrift steht unter der SIL Open Font License 1.1, und jeder Katalogeintrag erfasst diese Lizenz mit einem Hash des Lizenztextes, daher liest das Regelwerk zu Rechten in [Kreativrechte und Credits](/info/creative-rights.html) die Lizenz wie die jeder anderen Schrift. Die Lizenztexte liegen neben den Schriften. Die Noto-Sans-Dateien deklarieren keinen Reserved Font Name. Die chinesischen, japanischen und koreanischen Schriften stammen von Adobe und reservieren den Namen Source; die zugeschnittenen Dateien behalten ihre Noto-Namen, die diesen Namen nicht verwenden.

Die Lizenz sagt, dass ihre Bedingungen nicht für Dokumente gelten, die mit den Schriften erstellt wurden. Ein Export enthält nur die gezeichneten Umrisse der verwendeten Buchstaben, wie bei den eigenen Schriften des Designsystems, und Lolly fügt für eine Ersatzschrift kein Schriftprogramm, keine Credit-Zeile und keinen neuen Content-Credentials-Eintrag hinzu.
