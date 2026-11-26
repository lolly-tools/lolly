# Lolly Rondocode-Songs

<a id="rondocode-songs"></a>

Ein rondocode-Song ist als Code geschriebene Musik: Synthesizer, Patterns und ein Mix, die während der Eingabe gespielt werden. Lolly kann einen Song unter einem Video abspielen, und das Utility **Rondocode** schreibt Songs und exportiert sie als Audio; beide halten den Song in den Content Credentials der Datei fest.

<!--i:eti-music-->
## Einen Song in Lolly abspielen

Die Asset-Auswahl nimmt einen Song als `.rondo`- oder `.rondo.json`-Datei oder als eingefügten `rondocode.com`-Freigabelink an. Ein Song spielt so lange, wie sein Clip es vorgibt. Er kann die **Hintergrundmusik** unter einem Videoexport sein oder im Ambient-Player des Neurospicy-Modus laufen.

Der Code des Songs läuft in Lollys Sandbox, ohne Netzwerk und ohne Zugriff auf Ihre Dateien. Jeder Teil, den ein Rendering nicht abspielen kann, etwa ein Live-Mikrofon oder Gesang ohne die Stimmmodelle, wird in den Details des Assets aufgelistet.

Vom Terminal aus nimmt `lolly mix` einen Song als gesamten Soundtrack an; siehe [CLI-Rendering](/info/cli-rendering.html).

<!--i:eti-code-->
## Einen Song schreiben und exportieren

Öffnen Sie das Tool **Rondocode** unter **Utilities**, um einen Song im Live-Editor von rondocode zu schreiben und ihn während der Eingabe zu hören. Exportieren Sie ihn als **WAV**, **MP3**, **M4A**, **Opus** oder **FLAC**, als ZIP mit Stems, als **MIDI** oder als Aufnahme dessen, was gerade spielt. Vom Terminal aus schreibt `lolly rondocode --export=mid` dieselbe MIDI-Datei. **Export length** legt fest, wie viele Sekunden ein Audioexport dauert. Die Songdatei (`.rondo.json`) enthält Ihren Code so, wie Sie ihn geschrieben haben, ohne Zusätze.

Ein Song kann seinen Text mit `sing()` singen. Heruntergeladene Stimmmodelle erzeugen den Gesang auf Ihrem Gerät. Eine Datei mit synthetisiertem Gesang kennzeichnet diesen immer als KI-generiert (siehe [KI-Funktionen](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Songs im Credential

Ein Video- oder Audioexport, der einen rondocode-Song abspielt, hält jeden Song in seinen Content Credentials als Quelle fest:

- den Namen des Songs;
- den SHA-256 seiner `.rondo.json`-Datei;
- wie er gerendert wurde: in Lollys Sandbox, der Ausführungsklasse `vm`, mit Version und Seed des Renderers und jedem Teil, den das Rendering nicht abspielen konnte.

Musik, die aus dem Code eines Songs berechnet wird, wird als algorithmisches Medium gekennzeichnet, sodass Lolly Verify sie nicht als KI markiert. Vor dem Export listet eine Zeile unter **Download** die Songs auf, die der Credential festhalten wird. Nach dem Export meldet dieselbe Zeile, was beim Auslesen der ausgelieferten Datei gefunden wurde. Deaktivieren Sie **C2PA Credentials**, um die Angabe wegzulassen. Ein Standbild hält keinen Song fest, weil es keinen Ton hat. Ein Standbild hält keinen Song fest. `lolly mix` und der [MCP-Server](/info/mcp.html) schreiben dieselbe Angabe.

<!--i:eti-file-->
## Dateien aus dem Utility Rondocode

Die meisten Utilities auf dem Gerät schreiben keinen Credential, weil sie eine Datei umwandeln, die Ihnen bereits gehört. Lolly Rondocode erzeugt neues Audio, deshalb enthält jede Audiodatei, die es schreibt, Content Credentials, die den Song als ihre Quelle festhalten: WAV, MP3, M4A, Opus, FLAC, jeder Stem in einem Stems-ZIP und eine Aufnahme dessen, was gerade spielt.

- Die eigenen Renderings des Editors laufen in seinem privaten Frame (der Ausführungsklasse `frame`) und halten die Version des Editors fest.
- Ein über die CLI oder einen Freigabelink erstelltes Rendering läuft in der Klasse `vm` und hält Version und Seed des Renderers fest.
- Ein WAV gibt dasselbe auch in seinem RIFF-Kommentar an.

Wenn ein Song singt, ist die KI-Kennzeichnung maschinenlesbar. Der digitale Quelltyp des Credentials ist ein zusammengesetztes Medium, das mit trainierten Modellen erstellt wurde. Die Angabe listet die gesungenen Teile auf, und eine C2PA-KI-Offenlegung pro Modell identifiziert jedes Modell, das der Gesang durchlaufen hat: Supertonic-3 Text-to-Speech, den Phonem-Aligner wav2vec 2.0, den ContentVec-Encoder und die RVC-Stimme, mit dem Repository und Commit, aus denen Lolly es hostet.

### Was die MIDI-Datei enthält

Die MIDI-Datei ist ein Standard MIDI File, Format 1. Die erste Spur enthält das Tempo und eine 4/4-Taktart, gefolgt von einer Spur pro Synthesizer, die nach ihm benannt ist. Jede Note behält ihren Beginn, ihre Länge und ihre Anschlagstärke. Ein Synthesizer, dessen Name ein Instrument bezeichnet, etwa Bass, Streicher, Pad oder Klavier, erhält das passende General-MIDI-Instrument, und ein Name, der nach Schlagzeug klingt, wird Kanal 10 zugeordnet. Eine nicht zwölftönige Stimmung wird mit einem Pitch Bend auf den nächsten Halbton gerundet.

Eine MIDI-Datei kann keine Synthesizer-Einstellungen, Filter, Effekte, Busse, Samples oder Gesang enthalten, daher spielt eine DAW die Noten mit ihren eigenen Instrumenten. Das Tempo wird aus den Zyklen pro Sekunde des Songs abgeleitet, wobei ein Zyklus als Takt mit vier Schlägen gilt, weil die eigene Taktart des Songs nicht zu dem gehört, was der Renderer zurückgibt.

Eine MIDI-Datei hat keinen Platz für einen Credential, daher trägt ein Textereignis in der Datei die Aussage, und das Export-Panel weist Sie darauf hin. Das Panel beschreibt all dies vor dem Export. Nach jedem Export liest der Editor die gespeicherte Datei zurück und meldet nur, was dabei gefunden wurde.

Was Content Credentials allgemein festhalten, erklärt [Eine Datei exportieren](/info/exporting.html#content-credentials-c2pa).
