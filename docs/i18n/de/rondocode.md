# Rondocode-Songs

Ein Rondocode-Song ist Musik, als Code geschrieben: Synthesizer, Patterns und ein Mix, die beim Tippen abgespielt werden. Lolly kann einen Song unter einem Video abspielen, und das Utility **Rondocode** lässt Sie einen schreiben und als Audio exportieren. Beide halten den Song in den Content Credentials der Datei fest, sodass die Musik sagt, woher sie stammt.

## Einen Song in Lolly abspielen

Die Asset-Auswahl nimmt einen Song als Datei `.rondo` oder `.rondo.json` oder als eingefügten `rondocode.com`-Share-Link. Ein Song ist Code, der seinen eigenen Klang erzeugt, und läuft daher in der Länge, die sein Clip verlangt. Er kann das **Musikbett** unter einem Video-Export sein oder im Ambient-Player des Neurospicy Mode laufen.

Der Code des Songs läuft in Lollys Sandbox, ohne Netzwerk und ohne Zugriff auf Ihre Dateien. Jeder Teil, den ein Rendering nicht abspielen kann, etwa ein Live-Mikrofon oder Gesang ohne die Stimmmodelle, wird in den Details des Assets aufgelistet.

Vom Terminal aus nimmt `lolly mix` einen Song als gesamten Soundtrack; siehe [CLI-Rendering](/info/cli-rendering.html).

## Einen Song schreiben und exportieren

Öffnen Sie **Rondocode** aus **Utilities**, um in Rondocodes Live-Editor einen Song zu schreiben und ihn beim Tippen zu hören. Exportieren Sie ihn als **WAV**, **MP3**, **M4A**, **Opus** oder **FLAC**, als ZIP aus Stems, als **MIDI** oder als Aufnahme dessen, was gerade läuft. **Export length** legt fest, wie viele Sekunden ein Audioexport dauert. Die Song-Datei selbst (`.rondo.json`) ist Ihr Code, wie geschrieben, und trägt nichts Hinzugefügtes.

Ein Song kann seine Texte mit `sing()` singen. Der Gesang wird auf Ihrem Gerät von heruntergeladenen Stimmmodellen erzeugt, und eine Datei mit synthetisiertem Gesang erklärt den Gesang immer als KI-erzeugt (siehe [KI-Funktionen](/info/ai-features.html)).

## Songs im Credential

Ein Video- oder Audioexport, der einen Rondocode-Song abspielt, hält jeden Song als Quelle in seinen Content Credentials fest:

- den Namen des Songs;
- das SHA-256 seiner Datei `.rondo.json`;
- wie er gerendert wurde: in Lollys Sandbox, die Ausführungsklasse `vm`, mit Version und Seed des Renderers und jedem Teil, den das Rendering nicht abspielen konnte.

Musik, die aus dem Code eines Songs berechnet wird, ist als algorithmische Medien gekennzeichnet, sodass Verify sie nicht als KI markiert. Vor dem Export listet eine Zeile unter **Download** die Songs auf, die das Credential festhalten wird; nach dem Export meldet dieselbe Zeile, was ein Lesen der gelieferten Datei ergeben hat. Entfernen Sie das Häkchen bei **C2PA Credentials**, um den Eintrag wegzulassen. Ein Standbild hält keinen Song fest, weil es keinen Ton trägt. `lolly mix` und der [MCP-Server](/info/mcp.html) schreiben denselben Eintrag.

## Dateien aus dem Utility Rondocode

Die meisten Utilities auf dem Gerät schreiben kein Credential, weil sie eine Datei umwandeln, die Ihnen schon gehört. Rondocode erzeugt neues Audio, sodass jede Audiodatei, die es schreibt, Content Credentials trägt, die den Song als ihre Quelle festhalten: seinen Namen, das SHA-256 seiner Datei `.rondo.json` und wo sein Code lief. Das umfasst WAV, MP3, M4A, Opus, FLAC, jeden Stem in einem Stems-ZIP und eine Aufnahme dessen, was gerade läuft.

- Die eigenen Renderings des Editors laufen in seinem privaten Frame (die Ausführungsklasse `frame`) und halten die Version des Editors fest.
- Ein Rendering über die CLI oder einen Share-Link läuft in der Klasse `vm` und hält Version und Seed des Renderers fest.
- Ein WAV gibt dasselbe außerdem in seinem RIFF-Kommentar an.
- Musik, die aus dem Code des Songs berechnet wird, ist algorithmische Medien und nicht als KI gekennzeichnet.

Wenn ein Song singt, erklärt die Datei diesen Gesang in maschinenlesbarer Form als KI-erzeugt. Der digitale Quelltyp des Credentials ist zusammengesetzte Medien, die mit trainierten Modellen erstellt wurden, der Eintrag listet die gesungenen Teile auf, und eine C2PA-KI-Offenlegung pro Modell nennt jedes Modell, durch das der Gesang lief: Supertonic-3 Text-to-Speech, den Phonem-Aligner wav2vec 2.0, den ContentVec-Encoder und die RVC-Stimme, mit dem Repository und Commit, von dem Lolly es hostet. Eine Datei mit synthetisiertem Gesang wird nie ohne diese Erklärung gespeichert.

Eine MIDI-Datei hat keinen Platz für ein Credential, daher trägt ein Text-Ereignis in der Datei die Aussage stattdessen, und das Export-Panel sagt Ihnen das. Das Panel beschreibt all das vor dem Export, und nach jedem Export liest der Editor die gespeicherte Datei zurück und meldet nur, was dieses Lesen ergeben hat.

Zu dem, was Content Credentials allgemein festhalten, siehe [Eine Datei exportieren](/info/exporting.html#content-credentials-c2pa).
