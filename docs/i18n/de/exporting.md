# Eine Datei exportieren

Drücken Sie **Export**, die linke Hälfte der Pille **Export | Save**, wählen Sie neben dem Dateinamen ein Format und drücken Sie **Download**. Die Datei wird auf Ihrem Gerät erstellt.

Die Datei enthält, was Sie auf der Arbeitsfläche sehen. Das Formatmenü listet nur die Formate auf, die dieses Tool in diesem Browser erstellen kann.

Für die meisten Aufgaben brauchen Sie eines von drei Formaten:

| Für | Wählen Sie | Weil |
|---|---|---|
| Einen Bildschirm, eine Nachricht oder eine Folie | **PNG** | Jede App kann es öffnen und es erhält einen transparenten Hintergrund, wenn das Tool einen anbietet |
| Eine fertige Seite oder etwas zum Drucken | **PDF** | Eine echte Seitengröße, die wie angezeigt gedruckt wird; **Print PDF** ist, sofern das Tool es anbietet, die CMYK-Version für eine Druckmaschine |
| Grafiken, die in jeder Größe scharf bleiben müssen | **SVG** | Vektorformen |

::: check Prüfen Sie die Datei in ihrer späteren Nutzungsgröße
Öffnen Sie die Datei vor dem Senden auf dem Bildschirm, für den sie erstellt wurde, oder drucken Sie sie in Originalgröße.
:::

::: details Freigaben und Lieferung mit Lolly Work (optional)
Eine [Organisation mit Lolly Work](/info/organisation.html) kann auswählen, welche Formate und Exporteinstellungen ihre Mitglieder sehen. Wenn eine Freigabe erforderlich ist, ersetzt **Request approval** die Schaltfläche **Download**. Befolgen Sie die Richtlinie, die Ihre Instanz anzeigt.

Lolly Work kann eine Datei auch mit Freigabeschritten, Lieferbelegen und Audit-Protokoll an konfigurierte S3-, WebDAV- und HTTP-Ziele liefern. Diese Lieferung sendet die Datei an den Dienst der Organisation. Ein normaler Download bleibt auf Ihrem Gerät. Persönliche Send-Ziele und die Lieferung der Organisation werden separat konfiguriert.

Betreiber richten dies anhand des [Leitfadens zur Lieferung der Organisation](/info/work-delivery.html) ein. Für Server-Renderings und Batches in der Warteschlange siehe [CLI-Batch und Automatisierung](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## So funktioniert der Export

Drei Wege führen zu einer Datei. Die meisten Tools **rendern die Arbeitsfläche**. Text- und Datenformate (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) werden **aus dem Inhalt des Tools erzeugt**. Datenschutz-Utilities wie *Lolly Strip Hidden Data* **wandeln die ausgewählte Datei um**, auf Ihrem Gerät. Das Ergebnis hat keine Arbeitsfläche, kein Wasserzeichen und keine hinzugefügten Metadaten.

![Drei Exportwege führen zu einer fertigen Datei: die Arbeitsfläche rendern, Text oder Daten aus Inhalten erzeugen oder eine ausgewählte Datei auf dem Gerät umwandeln.](/info/diagrams/concepts/three-export-paths.svg)

Wer ein Tool erstellt, legt fest, welche Aktionen das Exportpanel anbietet. Standardmäßig sind es Copy, Download und Save.

- <!--i:download--> **Download** speichert die Datei. Falls Sie sie anschließend nicht finden, siehe [Eine heruntergeladene Datei finden](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** legt das Bild in die Zwischenablage. Kann ein Browser keine Bilder kopieren, lädt Copy stattdessen die Datei herunter und informiert Sie darüber.
- <!--i:folder--> **Save** behält das aktuelle Design in Projects und lädt niemals eine Datei herunter. **Save as** neben **Download** fragt nach dem Speicherort (siehe [Speichern und Fortsetzen](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** öffnet den Share-Dialog: ein Link, der das Design reproduziert, die Schalter für den Besuch (Vollbild, Exportpanel, Download oder Kopie beim Öffnen) und ein optionaler **Shortest link**, der den Zustand in ein kompaktes Token packt (siehe [URL-Modus](/info/url-mode.html)).

**Send to**, eine Karte im Exportpanel, sendet die Datei an einen von Ihnen verbundenen Dienst. Nach dem Senden an Google Drive, Nextcloud, einen S3-Bucket, Dropbox oder OneDrive kann **Create a share link** dort einen Link ohne erneuten Upload erstellen. Der Abschnitt **Share through your cloud** im Share-Dialog sendet eine `.lolly`-Datei und erstellt ihren Link in einem Schritt. Das Link-Panel zeigt, wer den Link öffnen kann, wo die Datei liegt und wann der Link abläuft. Mit **Links you've shared** im Share-Dialog beenden Sie die Freigabe. Nextcloud-Links können ein Passwort und ein Ablaufdatum haben. S3-Links sind 1 bis 7 Tage gültig und lassen sich nicht vorzeitig deaktivieren. Lolly speichert weder eine Kopie der Datei noch ein Anmeldetoken auf einem Server. [Datenschutz](/info/privacy.html#every-network-request-the-app-can-make) listet auf, was jeder Dienst erhält.

![Das Exportpanel - Format, Größe und die Aktionen Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Wenn ein Design das Rendering eines anderen Tools einbettet, etwa eine Bildbox in Lolly Design mit einem QR Code-Link, zeichnet der Export des übergeordneten Designs das eingebettete Rendering. In SVG und PDF bleibt es ein Vektor, in PNG, JPG und WebP wird es gerastert. Das eingebettete Rendering erhält kein eigenes Wasserzeichen und keine eigene Herkunftsangabe; diese erhält nur die fertige Datei. HTML-, Markdown- und TXT-Exporte können kein zusammengesetztes Rendering enthalten.

<!--i:eti-file-->
## Ein Format auswählen

Dateiname und Formatmenü stehen unter **Download** zusammen als ein Paar `name.format`.

![Das Dateinamensfeld ist mit der Formatauswahl verbunden, sodass der Export als ein Paar name.format erscheint](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Gehen Sie vom Ziel der Datei aus. Jede Karte listet die dafür passenden Formate auf.

::: figure exporting-format-chooser
Sechs Ziele mit den jeweils passenden Formaten.
:::

Eine in der Schrift Ihres Designsystems gesetzte Wortmarke wird als SVG exportiert, in dem jeder Buchstabe ein Umrisspfad ist. Die Datei bleibt in jeder Größe scharf.

Text in einer anderen Sprache hängt von den vorhandenen Schriften ab. Enthält eine Schrift Ihres Designsystems die Buchstaben, zeichnen SVG und PDF sie als Umrisse, mit korrekter Formgebung und Leserichtung, auch bei Zeilen von rechts nach links. Enthält keine sie, verwendet Lolly eine [Ersatzschrift](/info/fallback-fonts.html) und die Exportkarte zeigt diese Schrift an. Text, den keine Ersatzschrift abdeckt, bleibt in einem SVG Live-Text, der mit den eigenen Schriften des Betrachters gezeichnet wird. In einem PDF, EPS oder WMF sowie in einem EMF mit eingeschaltetem **Outline fonts** wird dieser Text zu Bildern. Diese Wörter sehen aus wie auf der Seite, lassen sich aber weder auswählen noch durchsuchen. Die Exportkarte listet diese Schriftsysteme auf. Fügen Sie eine Schrift mit diesen Buchstaben hinzu, um sie als Vektortext zu erhalten.

![Eine Wortmarke mit dem Schriftzug Aurora in haarfeinen, weit gesperrten Buchstaben, ein Beispiel für die reine Vektorgrafik in der SVG-Zeile der Tabelle](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Alle Formate und ihre Verwendung
| Sie möchten | Verwenden Sie | Warum |
|---|---|---|
| Scharfe Logos oder skalierbare Grafiken | **SVG** | Vektor: skalierbar, klein und bearbeitbar; ein Effekt, den der Vektorexport nicht zeichnen kann, wird als Bild eingebettet |
| Vektoren für Office- und Windows-Apps | **EMF** | Lässt sich als bearbeitbarer Vektor mit Live-Text in PowerPoint und Word einfügen; Google Drive öffnet es in Google Drawings |
| Vektoren für Druck- und Design-Apps | **EPS** oder **EPS (CMYK)** | PostScript-Vektoren für Illustrator und Druckabläufe |
| Vektoren für Schneidemaschinen | **DXF** | Laserschneider, Vinylplotter und CNC: Umrisspfade in Millimetern |
| Ein bearbeitbares Foliendeck | **PowerPoint** (PPTX) | Native bearbeitbare Texte und Formen, Bilder und Vektoren bleiben extrahierbar |
| Ein bearbeitbares Textdokument | **Word** (DOCX) oder **OpenDocument** (ODT) | Absätze und Überschriften, die sich in einem Textverarbeitungsprogramm weiterbearbeiten lassen (Lolly Doc Studio) |
| Ein Layout für InDesign | **InDesign IDML (static subset)** | Text, Rechtecke, Ovale und Bilder, ein Druckbogen pro Artboard (Lolly Design) |
| Ein bearbeitbares Penpot-Dokument | **Penpot** | Boards, Formen, Text und verknüpfte Tokens |
| Ein Foto oder ein Bild für allgemeine Zwecke | **PNG** (verlustfrei) oder **JPG** (kleiner) | Universelles Rasterformat |
| Kleinere moderne Bilder | **WebP** oder **AVIF** | Bessere Kompression mit Transparenz |
| Druck | **PDF** oder **Print PDF** (CMYK) | Echte Seitengröße; CMYK für eine Druckmaschine |
| Druckraster für eine Druckmaschine | **Print TIFF** (CMYK) | DeviceCMYK-Pixel für ein RIP |
| Animationen fürs Web | **GIF** | Wird überall abgespielt; größere Dateien |
| Animationen mit voller Farbe und echter Transparenz | **APNG** | Animiertes PNG: keine Palettenbegrenzung |
| Animationen mit kleinster Dateigröße | **Animated WebP** | Volle Farbe und Transparenz, kleiner als GIF oder APNG |
| Skalierbare Vektoranimationen | **Animated SVG** | Eigenständig; läuft in einer Schleife im Browser oder in einem `<img>`, in jeder Größe (Lottie Ad) |
| Eine bearbeitbare Animation | **dotLottie** | Formen, Pfade und äußere Transformations-Keyframes aus der Zeitleiste von Lolly Design |
| Eine Übergabe an Premiere | **Premiere XML + media** | Clips mit Zeitangaben und Originalmedien für Premiere (Lolly Design) |
| Videos für soziale Medien und zum Teilen | **MP4** oder **WebM** | Beste Qualität für die Dateigröße (siehe [Video](#video)) |
| Untertitel | **SRT** oder **VTT** | Text mit Zeitangaben für einen Videoplayer (Captions, Audiogram und Record) |
| Untertitel für den Rundfunk | **TTML** oder **SCC** | IMSC1.1-Text mit Zeitangaben oder CEA-608-Pop-on-Untertitel (Captions; siehe [Untertitel für den Rundfunk](#broadcast-captions)) |
| Einen Schulungskurs | **SCORM (LMS)** | Eine versionierte Website, ein SCORM- oder xAPI-Paket (siehe [SCORM](#scorm-course-packages)) |
| Formatierten Text oder eine E-Mail-Signatur | **HTML** | Lässt sich formatiert in E-Mail-Programme einfügen |
| Eine Animation, die im Browser läuft | **HTML** | Ein Player in einer einzigen Datei, aus der Zeitleiste von Lolly Design oder aus Snippet (siehe [Video](#video)) |
| Reine Inhalte | **MD** oder **TXT** | Nur Text |
| Einen Kalendereintrag | **ICS** | Lässt sich in jede Kalender-App importieren |
| Eine Kontaktkarte | **VCF** | Lässt sich in Adressbücher importieren |
| Strukturierte Daten zum erneuten Import | **JSON** oder **CSV** | Ermöglicht den Export und erneuten Import des Tool-Inhalts |
| Ein Favicon | **ICO** | Website-Symbol in mehreren Größen; **ZIP** bündelt mehrere Formate |
:::

### Transparenz

Tools, die dies unterstützen, bieten einen Schalter für einen transparenten Hintergrund, etwa **No BG**. PNG, WebP, AVIF, SVG, APNG und Animated WebP erhalten Transparenz, GIF erhält eine harte Kante. JPG und PDF sind immer undurchsichtig. TIFF reduziert das Bild auf einen weißen Hintergrund oder beim [HDR](#hdr-bright-colours)-Verfahren auf Schwarz.

<!--i:eti-crop-->
## Größe und Druckeinheiten

Exporte verwenden die native Pixelgröße des Tools, sofern das Tool keine **Abmessungen** anbietet. Dann legen Sie Breite, Höhe und eine **Einheit** fest:

- **px** (der Standard) gibt exakte Pixel an.
- **mm, cm, in, pt** und **pc** sind physische Größen. Bei einer physischen Einheit legen Sie auch **DPI** fest (standardmäßig 300). Ein **PDF** wird zu einer echten Seite in dieser Größe. Ein **Rasterbild** erhält die Pixelzahl für diesen DPI-Wert und verzeichnet die Auflösung. Ein **SVG** behält die physische Einheit mit einer viewBox in Pixeln.

Für ein Rasterbild mit höherer Auflösung geben Sie eine größere Breite und Höhe ein oder wählen eine physische Einheit und erhöhen den DPI-Wert (Pixel = Größe × DPI). Breite `210`, Höhe `297` und die Einheit `mm` ergeben eine A4-Seite.

![Die Maßzeile ist auf 210 mal 297 mm eingestellt. Das DPI-Feld wird angezeigt, weil eine physische Einheit gewählt ist](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Standbilder aus einer zeitgesteuerten Komposition

Bei einer zeitgesteuerten Komposition, etwa einer [Sequence](/info/sequence-editor.html)-Zeitleiste in Lolly Design, erfasst ein Standbildexport **das Bild am Abspielkopf**. Setzen Sie den Abspielkopf an die gewünschte Bildposition und exportieren Sie.

Für mehrere Zeitpunkte verwenden Sie das Feld **Frames** neben der Ausgabegröße. Es erscheint nur bei einer zeitgesteuerten Komposition und einem Standbildformat (PNG, JPG, WebP, SVG oder PDF). `1` liefert das Bild am Abspielkopf. Eine höhere Zahl liefert entsprechend viele Standbilder, gleichmäßig über die Sequenz verteilt:

- PNG, JPG, WebP und SVG werden als eine ZIP-Datei ausgegeben: `<name>-01.png`, `-02.png` und so weiter.
- PDF wird als ein Dokument mit entsprechend vielen Seiten ausgegeben.

Jedes Standbild stammt aus der Mitte seines Zeitleistenabschnitts. So ist das erste nie eine halbfertige Einblendung und das letzte nie der leere Moment nach dem Ende der Clips.

::: figure exporting-contact-sheet
Frames: 4 teilt die Sequenz in vier gleich große Abschnitte und nimmt jeweils die Mitte.
:::

Verwenden Sie Frames für ein Storyboard, einen Kontaktbogen zur Prüfung oder ein Karussell für soziale Medien aus einem Videoschnitt. Die Anzahl ist auf 64 begrenzt. Jede andere Eingabe im Feld fällt auf `1` zurück. Jedes Bild ist ein gewöhnliches Standbild. Herkunftsnachweise, Imprint, physische Einheiten und DPI verhalten sich deshalb wie bei einem einzelnen Export. Ein Exportlink, die CLI und MCP fordern denselben Bogen mit `cuts=` an (siehe [Kontaktbögen](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Viele Dateien auf einmal

Lolly bietet drei Wege für die Arbeit mit größeren Mengen:

::: cols
## Aus einer Tabelle wird ein Dokument
Ein Tool, das Tabelleneingaben auf Seiten verteilt, macht aus jeder Zeile eine Seite. Fügen Sie eine Tabelle aus Ihrer Tabellenkalkulation ein, um ein PDF zu erhalten. Um Zeilen zu korrigieren, bearbeiten Sie die Tabelle und fügen sie erneut ein. Battlecards ist das Referenz-Tool. Es liegt im Open-Source-Ordner `community` und wird auf lolly.tools nicht aufgeführt.
## Aus einer CSV-Datei wird eine Datei pro Zeile
**Batch** (`#/batch`) nimmt eine CSV-Datei an und rendert für jede Zeile einen Export, etwa Namensschilder oder Zertifikate, die in einer ZIP-Datei ausgegeben werden. Siehe [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Mehrere Designs erhalten dieselbe Änderung
**Lolly Multi-edit** öffnet mehrere gespeicherte Sitzungen nebeneinander, um in jeder dieselbe Änderung vorzunehmen. Siehe [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Ein Tool mit mehreren Seiten, etwa Booklet, Print Sheet, Lolly Doc Studio oder Lolly Markdown Slides, exportiert PNG, JPG, WebP, SVG und die anderen Einzelbildformate als eine Datei pro Seite, bei mehreren Seiten in einer ZIP-Datei. Print Sheet erhält den vollständigen Bogen und die Schnittmarken beim gewählten DPI-Wert.

In **Projects** exportiert **Render folder** jede gespeicherte Sitzung in einem Ordner und seinen Unterordnern als eine verschachtelte ZIP-Datei. **Render selection** macht dasselbe für eine Mehrfachauswahl. Eine einzelne gespeicherte Sitzung wird in eine eigene Datei gerendert. Projects kann eine gespeicherte Sitzung auch erneut als Tool-Link teilen, der die Sitzung mit denselben Einstellungen öffnet.

<!--i:eti-pen-->
## Dateien, die anderswo bearbeitbar bleiben

Einige Formate übergeben Ihre Arbeit als bearbeitbaren Inhalt an eine andere Anwendung statt als Bild.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart und Agenda exportieren ein PowerPoint-Deck mit einer Folie pro Seite. Jede Seite wird in native Objekte aufgeteilt, die eine Kollegin oder ein Kollege bearbeiten und extrahieren kann:

- <!--i:font--> **Text** wird zu bearbeitbaren PowerPoint-Textfeldern mit Schriftgröße, Farbe, Schriftstärke, Kursivierung und Ausrichtung des Layouts. Ein Lolly Design-Deck legt die Markenschrift für jeden Textabschnitt fest, auch ohne Folienmaster.
- <!--i:pentool--> **Vektoren** wie Logos und Symbole werden als SVG-Bilder eingebettet. PowerPoint kann darauf *Convert to Shape* anwenden.
- <!--i:photos--> **Bilder** werden als separate Bilder in nativer Auflösung übernommen. Ein zugeschnittenes Hauptbild behält das vollständige Bild hinter dem Zuschnitt. Filter oder Mischmodi eines Bildes werden fest eingerechnet.
- <!--i:layers--> **Hintergründe, Rahmen und Linien** werden zu Rechteck- und Linienformen. Kreise, Ellipsen und Pillen aus Lolly Design bleiben native, bearbeitbare Formen.

![Das Exportpanel mit ausgewähltem PowerPoint: eine Folie pro Seite, Text und Formen bleiben bearbeitbar](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Das Layout wird näherungsweise übernommen. Alles, was der Walker nicht nativ ausdrücken kann, etwa ein komplexer gefilterter oder maskierter Bereich, wird als Bild eingebettet. Ein Deck hat eine Foliengröße, die von der ersten Seite übernommen wird.

PowerPoint bietet auch einen Weg hinein: [Ein Deck auf eine andere Marke umstellen](/info/rebrand.html) überträgt ein Deck auf Ihr Designsystem und [Ein Design importieren](/info/design-import.html) öffnet eines in Lolly Design.

### Penpot

Die meisten Tools, die SVG exportieren, exportieren auch eine **Penpot-Datei** (`.penpot`).

| Was Sie erstellt haben | In Penpot |
|---|---|
| Text | Bearbeitbare Textobjekte |
| Formen, Pfade, Verläufe und Bilder | Bearbeitbare Vektorformen |
| Eine Farbe oder Schrift aus einem Designsystem-Token | Eine Live-Verknüpfung zum Token: Bearbeiten Sie das Token und jede Form, die es erbt, folgt der Änderung |
| Das gesamte Design | Eine wiederverwendbare Komponente im Assets-Panel |
| Eine komplexe Illustration oder eine Live-Arbeitsfläche | Ein eingebettetes Bild; der umgebende Inhalt bleibt bearbeitbar |

Aus Lolly Design wird jeder Rahmen zu einem Penpot-Board. Die Farben und Typografien des Designsystems kommen in das Assets-Panel, sein vollständiger Token-Satz in das Tokens-Panel. Penpot behält eine eigene Kopie. Ein in Penpot bearbeitetes Token kommt über den Import in [Lolly Design System Setup](/info/brand-studio.html) zurück.

![Das Exportpanel mit ausgewähltem Penpot: die .penpot-Datei und Send to Penpot neben dem Download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Um die Datei zu öffnen, starten Sie Penpot, wählen ein Projekt und dann **Import**. Wenn Sie sich über das Exportpanel bei Penpot anmelden, importiert **Send to Penpot** die Datei für Sie.

### Word, OpenDocument und InDesign

**Lolly Doc Studio** exportiert **Word** (DOCX) und **OpenDocument** (ODT) mit bearbeitbaren Absätzen und Überschriften. Die Word-Datei legt die Schriften und Textfarbe der Marke über die Formatvorlagen des Dokuments fest, folgt der gewählten Seitengröße und fügt neben einem SVG-Logo ein PNG für Apps hinzu, die SVG nicht zeichnen können.

**Lolly Design** exportiert **InDesign IDML (static subset)**: Text, Rechtecke, Ovale und PNG- oder JPEG-Bilder, ein Druckbogen pro Artboard. Unterstützte Inline-Formatierungen bleiben bearbeitbar, Bilder werden in `Links` mitgegeben und Koordinaten werden zu InDesign-Punkten. Erneutes Verknüpfen, Schriftersetzung und geänderte Umbrüche können Nacharbeit erfordern. Effekte, Animationen, zusammengesetzte Textflüsse und nicht unterstützte Geometrie stoppen den Export mit einem Bericht, der sie auflistet. IDML erhält das ursprüngliche Dokument nicht. Senden Sie fertige Grafiken als PDF.

### Zeitleisten: dotLottie und Premiere

Aus der Zeitleiste von Lolly Design schreibt **dotLottie** eine Animation, die in Lottie-Tools bearbeitbar bleibt; [Lottie-Animationen](/info/sequence-editor.html#lottie-animations) listet auf, was erhalten bleibt. **Premiere XML + media** verpackt Clips mit Zeitangaben und ihre Originalmedien für Premiere; siehe [Premiere-XML-Austausch](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (Kurspakete)

Der Kursexport ist ausgeschaltet, bis Sie **Training and courses** unter Settings → Preferences → Feature flags einschalten.

Wählen Sie dann **Export course** in einem unterstützten Tool, einem Projektordner oder einer Auswahl. In Lolly Design öffnet die Auswahl von **SCORM (LMS)** und **Download** denselben Kursablauf. Lolly speichert die Arbeit, zeigt den Kursinhalt und die Reihenfolge zur Prüfung an und öffnet dann das Modul mit seinem Exportdialog.

- <!--i:layers--> Wählen Sie für jede Quelle eine Ausgabeform: statische Seiten, Bewegung als Video, Audio oder eine Ressource zum Herunterladen. Fügen Sie im Modul Lektionstext und Lesealternativen hinzu.
- <!--i:clock--> Sehen Sie sich die Vorschau des Players für Lernende an und prüfen Sie Beschreibungen und Untertitel. Bewegung, auch stumme Animation, wird als Video aufgenommen.
- <!--i:document--> Wählen Sie Website, SCORM 1.2, SCORM 2004 4th Edition oder ein experimentelles xAPI-Ziel. Prüfen Sie den Inhalt und die ZIP-Größe, speichern Sie dann die geprüfte Version und laden Sie sie herunter.
- <!--i:check--> Zum Abschluss müssen alle erforderlichen Lektionen bestätigt und Finish gewählt werden.

![Das Exportpanel eines Lolly Design-Decks mit ausgewähltem SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Das Paket enthält seine fertigen Inhalte und benötigt kein Lolly-Konto. Legen Sie eine Website-ZIP auf einem HTTP(S)-Host ab; importieren Sie eine LMS-ZIP unverändert. Testen Sie das Ziel, bevor Sie den Kurs teilen. Für einen Kurs aus mehreren gespeicherten Werken siehe [Einen Schulungskurs erstellen](/info/training-creators.html).

### Untertitel für den Rundfunk

Das Tool Captions kann auch **TTML** und **SCC** exportieren. Beide werden aus derselben Cue-Liste wie die SRT- und VTT-Dateien geschrieben, sodass Wörter und Zeiten übereinstimmen.

- **TTML** verwendet das IMSC1.1 Text Profile mit Zeitangaben relativ zur Medienzeit und einem Bereich unten in der Mitte. Es enthält keine Farbe, Schrift oder Position für einzelne Untertitel, da Lollys Untertitel nur Start, Ende und Text enthalten.
- **SCC** enthält CEA-608-Pop-on-Untertitel auf Kanal 1 bei 29,97 Bildern pro Sekunde mit Drop-Frame-Timecode. Es unterstützt die nordamerikanischen Grundzeichen sowie die Sonder- und erweiterten Zeichen. Enthält ein Untertitel ein Zeichen außerhalb dieses Zeichensatzes, stoppt der Export und nennt das Zeichen. Jeder Untertitel wird auf 32 Spalten und höchstens 15 Zeilen umgebrochen. Ein Untertitel, der nicht vor seiner Startzeit geladen werden kann, wird um einige Bilder verzögert.
- Roll-up- und Paint-on-Untertitel werden nicht geschrieben.

::: note SCC wurde noch nicht in einem Rundfunk-Tool geprüft
Es wurde auch noch nicht mit einem Hardware-Decoder getestet. Testen Sie vor der Lieferung eine Datei in Ihrem eigenen Ablauf.
:::

### DXF (Schneidedateien)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding und Wordmark exportieren **DXF**, das AutoCAD R12-Austauschformat, das Laserschneider, Vinylplotter und CNC-Software lesen. Geometrie wird als Umrisspfade in Millimetern geschrieben und Text in Umrisse umgewandelt. Farben werden dem nächstliegenden AutoCAD Color Index zugeordnet, der üblicherweise den Schneidevorgang steuert. DXF enthält nur Liniengrafik: Ein fotografischer oder gefilterter Bereich hat keinen Schneidepfad und wird mit einer Warnung weggelassen. Verwenden Sie SVG oder PDF, um Rasterinhalte zu erhalten. Text, den keine Schrift abdeckt, auch keine [Ersatzschrift](/info/fallback-fonts.html), stoppt den Export mit einer Meldung, die diesen Text zitiert.

Ein Street Map-Design besteht ausschließlich aus Strichen. Deshalb wird jede Straße und jeder Kanal zu einem Schneidepfad.

::: showcase
![Ein Street Map-Rendering von Paris in Tintenfarbe auf Creme - reine Liniengrafik, sodass jeder Strich den Weg zur Schneidemaschine übersteht](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Beim Scrollen fährt die Kamera durch die Geometrie zurück: sieben Pfade und keine Pixel. Eine Schneidemaschine liest dieselbe Datei.
:::

<!--i:eti-stamp-->
## Druck

**Print PDF** schreibt CMYK für eine benannte Druckbedingung, standardmäßig **Coated FOGRA39**. Markenfarbfelder mit gemessenen Druckfarbenwerten behalten diese Werte. Andere Farben werden über ein Druckprofil umgerechnet: standardmäßig Lollys eigenes Coated FOGRA39-Profil oder Ihr eigenes Profil, wenn Sie dessen Zeile **Embed** wählen. Grautöne und Schwarz bleiben ausschließlich auf der Schwarzplatte, sodass bei kleiner Schrift keine Passerfehler entstehen können. FOGRA51, SWOP und GRACoL verwenden eine Standard-Geräteumrechnung. Schwarze Schrift überdruckt zudem die darunterliegende Farbe, sodass eine leicht versetzte Druckmaschine keine weißen Ränder um die Buchstaben hinterlässt. **Print TIFF** schreibt DeviceCMYK-Pixel für ein RIP. Das Steuerelement Colour profile steuert beide ([Farbprofile](#colour-profiles)). Print TIFF und **EPS (CMYK)** separieren Farben über dasselbe Druckprofil wie Print PDF.

**Print marks & bleed** hat bei den Druckformaten eine eigene Karte: der Beschnitt in Millimetern sowie Crop, Registration, Bleed, Colour bars und Stamp details. Stamp details druckt das Datum, das Tool und Ihren Namen in den Rand. Ein Name oder Tool-Name mit Zeichen, die der Randschrift fehlen, etwa arabischen, chinesischen oder kyrillischen Zeichen oder einem Emoji, wird als Bild im selben Grau gezeichnet. Die Exportkarte listet diese Schriftsysteme auf.

Einige Tools, etwa *Booklet*, erstellen ein **mehrseitiges PDF**: ein Deckblatt, Inhalt, der sich auf so viele Seiten wie nötig verteilt, und eine Rückseite. Jede Seite ist eine echte PDF-Seite im Hochformat in A4, US Letter oder A5. Sie können für jeden Block eine neue Seite erzwingen. Dies sind RGB-Dokumente ohne Schnitt- oder Beschnittmarken; diese Marken gehören zum einseitigen Print PDF. Ein PDF aus Lolly Design kann auch ein **Notes handout** sein: eine Hochformatseite für jede Folie mit den Sprechernotizen darunter.

**Vor dem Export.** Eine Karte **Before you export** am unteren Ende des Panels zeigt, was eine Druckerei sehen wird: Format, Größe und Beschnitt, Endformat- und Beschnittbereiche, Farbauftrag, Platten- und Seitenzahl, mit einer Bewertung neben der Überschrift. Die Karte blockiert niemals einen Export. Lolly Design zeigt die Karte immer mit seinen eigenen Prüfungen, darunter die internen Regeln des Designsystems für jede Ebene und die Schreibbewertung für den Text des Dokuments ([Vor dem Export](/info/design.html#before-you-export)). Lolly Design ergänzt diese Druckprüfungen, wenn **Print preflight** eingeschaltet ist. In anderen Tools schalten Sie **Print preflight** unter Settings → Preferences → Feature flags ein. Es ist standardmäßig ausgeschaltet und eine Lolly Work-Instanz kann es für ihre Mitglieder einschalten.

**Nach dem Export.** Lolly liest die fertige Datei wieder ein und vergleicht sie mit Ihrer Auswahl: Format, Pixel- oder Seitengröße, Cliplänge, transparenter Hintergrund, CMYK-Farbe, HDR, Content Credentials und ein PDF- oder ZIP-Passwort. Jede Abweichung wird auf der Exportkarte vermerkt. Jede Messung stammt aus der Datei, niemals aus der Einstellung. Eine Eigenschaft, über die die Datei keine Auskunft gibt, wird nicht als Übereinstimmung gezählt. Die Kommandozeile schreibt mit `--export-report` den vollständigen Vergleich (siehe [Mit der CLI rendern](/info/cli-rendering.html)).

::: details Prüfungen der PDF-Barrierefreiheit über die Kommandozeile
**Prüfungen der PDF-Barrierefreiheit.** Für ein PDF listet die Kommandozeile in der Datei `--export-report` unter `pdfAccessibility` zusätzlich 32 Prüfungen zur Barrierefreiheit auf. Jede Prüfung hat eine ID, eine verständliche Beschreibung, ein Ergebnis und die Stelle in der Datei, an der sie ein Problem gefunden hat:

- **Passed**: Die Prüfung hat etwas untersucht und keinen Fehler gefunden.
- **Failed**: Die Prüfung hat ein Problem gefunden. Die zugehörigen Seitenzahlen oder Tags werden aufgelistet.
- **Not applicable**: Die Datei enthielt nichts Entsprechendes zum Prüfen, etwa bei Tabellenprüfungen in einer Datei ohne Tabellen. Dies sagt nichts über die Datei aus.
- **Needs a person**: Sechs Prüfungen kann ein Programm nicht beurteilen (Lesereihenfolge, Farbkontrast, Blinken, Skripte, Zeitlimits und wiederholte Links).

Die Liste ist kein abschließendes Urteil. Sie besagt weder, dass ein PDF PDF/UA erfüllt, noch, dass Menschen mit assistiven Technologien das PDF nutzen können. Ein Mensch muss die Datei weiterhin mit einem Screenreader prüfen. Lollys eigene PDFs bestehen derzeit die Tagging-Prüfungen nicht, da die Exporter noch keine Tags schreiben. Die Prüfung liest die Datei auf Ihrem Gerät und verändert nichts. Dateien, die ein Passwort benötigen, werden als ungeprüft bezeichnet, nicht als bestanden. Um ein erhaltenes PDF zu prüfen, ziehen Sie es in [Lolly Strip Hidden Data](/info/utilities.html). Dort erscheint dieselbe Liste unter **PDF accessibility checks**.
:::

Die Inspektorprüfungen von Lolly Design und der Markenvergleich in Lolly Design System Setup betrachten das Design. Diese beiden Karten betrachten die Datei.

::: details Kosten aus einer Preisliste
Unterhalb der Druckvorprüfung rechnet eine Kostenkarte dieselben Mengen in Geld um, auch wenn die Karte zur Druckvorprüfung ausgeschaltet ist. Sie benötigt zwei Dinge: einen Auftrag, für den eine Preisliste Preise berechnen kann (Platten, Bogen, Fläche, Seiten, Variantenzeilen oder Ausgabedateien, weshalb ein einfaches Logo-PNG die Karte nie zeigt), und eine **Preisliste** im JSON-Format von Ihrer Druckerei. Ein Standard-Build enthält keine Preisliste und bietet keine Möglichkeit, eine in der App zu laden. Eine Preisliste wird als Katalog-Asset mit einer Instanz ausgeliefert oder über die optionale Preislisten-Erweiterung bereitgestellt, die ein Selbsthoster oder eine Steuerungsebene einschaltet. Ohne Preisliste wird nichts angezeigt.

Jeder Betrag ergibt sich aus einem von Ihnen bereitgestellten Preissatz mal einer von Lolly gezählten Menge, etwa `4 plate × €35.00`. Die Summe zeigt ihre Quelle: den Herausgeber auf der Preisliste und das Datum der Preise. Es gibt weder eine Standardwährung noch einen Platzhalterpreis. Was die Datei über sich selbst sagt, bleibt eine wiedergegebene Aussage: *„Die Datei sagt: … Lolly hat dies nicht überprüft.“*

Lässt sich ein Betrag nicht berechnen, wird die Tabelle ausgeblendet statt ausgefüllt:

- Positionen, für die die Preisliste keinen Preis angibt, bedeuten **überhaupt keine Gesamtsumme**, sondern nur eine Überschrift mit der Anzahl der Positionen ohne Preis.
- Ist eine Menge eine Obergrenze, wird **„bis zu“** in ihre Zwischensumme übernommen.
- Bei Preisen nach ihrem Gültigkeitsdatum werden **nur Mengen** angezeigt, bis Sie *Use these rates anyway* drücken; das Ablaufdatum bleibt dann beim Betrag stehen.
- Beim Öffnen über einen **Link** bleiben Geldbeträge verborgen, bis Sie sie auf diesem Gerät anfordern. Die CLI nimmt `--rate-card=<file.json>` als lokale Datei an, niemals als Linkparameter.

Die Karte wird aus jeder Exportstufe entfernt und verändert die Datei nie. Es ist eine Berechnung, kein Angebot. Nur Ihre Druckerei kann ein Angebot machen.
:::

<!--i:eti-film-->
## Bewegung und Ton

### Video

Animierte Tools exportieren **MP4** und **WebM**. Ein geteilter `?format=`-Link, der einen Container anfordert, den dieser Browser nicht erzeugen kann, fällt auf den anderen zurück, mit passendem Dateinamen. **Start after** hält die Arbeitsfläche still, damit Animationen und Schriften vor der Aufnahme ihren endgültigen Zustand erreichen. **Duration** legt die Länge des fertigen Clips fest. **Motion blur** (Off, Draft quality, Standard oder High, mit einem **Shutter angle**) zeichnet schnelle Bewegungen weich und verlangsamt das Rendern. Wenn der Browser es unterstützt, nimmt **Record live** die Bildschirmvorschau in Echtzeit über eine Bildschirmfreigabe auf.

![Die Zeiteinstellungen für einen animierten Export: Start after, Duration, Motion blur mit seinem Shutter angle und Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** wählt Smaller file, Balanced oder Best quality. **Advanced** öffnet **Codec**, **Frame rate**, **Rate mode** und **Hardware acceleration**. Wenn ein Tool Untertitel hat, wählt **Captions** einen **Embedded track** oder eine **Sidecar .vtt + .srt** neben dem Video. Ein Link überträgt Qualität, Codec, Bildrate, Dauer und Startverzögerung als `vq`, `codec`, `fps`, `seconds` und `wait` ([URL-Parameter](/info/url-parameters.html)).

Videoexporte behalten ihren Ton. Ein Tool kann den Clip mit **Hintergrundmusik** unterlegen: ein Audio-Asset, das in einer Schleife läuft oder auf Cliplänge zugeschnitten wird, mit Ein- und Ausblendungen, Lautstärke und Absenkung unter dem Originalton des Filmmaterials. Die Aufnahmetools übernehmen ihr Live-Audio in die Datei.

Ein per Klick gesteuertes Deck aus Lolly Design lässt sich auch als Video exportieren. **Export slides as video** im Present-Menü öffnet den Exportdialog mit MP4. Jede Folie läuft für ihre eigene Verweildauer oder für die Duration des Exportdialogs, wenn sie keine hat. Der Folienübergang des Decks läuft zwischen den Folien als Überblendung. Das Dokument bleibt unverändert.

**HTML** aus einem zeitgesteuerten Lolly Design-Dokument oder aus Snippet ist ein Player in einer einzigen Datei: Steuerelemente für Wiedergabe, Positionssuche und Ton über der Animation, mit eingebetteten unterstützten Schriften, Bildern und Ton. Die Datei wird offline abgespielt. Ein Lolly Design-Film mit Szenen ergänzt ein Menü seiner Szenen. Eine Sequenz mit einem Video-, Lottie- oder 3D-Clip lässt sich noch nicht als HTML exportieren; exportieren Sie die Sequenz als Video.

### Animierte Bilder

**GIF** wird überall abgespielt und eignet sich für Chat und E-Mail; es ist größer und hat weniger Farben als Video. **APNG** und **Animated WebP** erhalten volle Farbe und Transparenz. **Lottie Ad** exportiert auch **Animated SVG**: Vektorbilder mit eingebetteten CSS-Keyframes, die sich auf jede Größe skalieren lassen und ohne Codec in einem Browser-Tab oder einem `<img>` in einer Schleife laufen. Der Text wird in Umrisse umgewandelt. Die Standardbildrate ist niedriger, weil jedes Bild mehr Daten benötigt als eine Bitmap. Alle diese Formate sind stumm.

### Audio

Einige Tools exportieren Ton allein. **Lolly Voice Recorder** zeichnet eine Mikrofonaufnahme mit Live-Pegelanzeige auf und speichert sie als **MP3**, **WAV**, **M4A (AAC)** oder **Opus (WebM)**, auf Ihrem Gerät codiert. `wav`, `mp3`, `m4a` und `opus` sind gewöhnliche Format-IDs. Ein Audioexport lässt sich deshalb ebenso teilen und per Skript steuern wie ein PNG.

Die Asset-Auswahl akzeptiert viele Audioformate für Hintergrundmusik, von MP3 und FLAC bis zu MIDI und Tracker-Modulen; [Formate](/info/formats.html) listet sie auf. Ein [Lolly Rondocode-Song](/info/rondocode.html) spielt so lange, wie sein Clip es anfordert.

<!--i:eti-palette-->
## Farbe und HDR

Lolly liest jede moderne CSS-Farbe, führt Farbberechnungen wahrnehmungsbezogen durch und schreibt jede Datei in einem Farbraum, den ein Leseprogramm öffnen kann: sRGB für Bildschirme, CMYK für den Druck und Rec.2100 PQ für HDR ([Farbe in der Engine](/info/colour-engine.html)). Ein Lolly Design-Dokument mit der Einstellung **Wide colour / HDR** folgt eigenen Regeln: siehe [Bearbeiten mit erweitertem Farbraum und HDR](/info/hdr-editing.html).

### Farbprofile

Exporte werden mit einem Farbprofil gekennzeichnet, damit Anwendungen mit Farbmanagement, etwa in Druckereien, Photoshop und Browser, die Farben so lesen, wie Sie sie gesehen haben. Miniaturbilder und Vorschauen lassen diese Kennzeichnung weg, um klein zu bleiben.

- **PNG und JPG** enthalten ein eingebettetes **sRGB**-ICC-Profil, den Farbraum, in dem die Vorschau gezeichnet wird. Die Pixel werden gekennzeichnet, nicht neu codiert.
- **Print PDF (CMYK)** gibt seine Druckbedingung im *OutputIntent* an. So weiß eine Druckerei, wie die CMYK-Druckfarben zu lesen sind.
- **Print TIFF (CMYK)** schreibt nicht gekennzeichnete DeviceCMYK-Pixel und verzeichnet die Druckbedingung in seinen TIFF-Metadaten. Ein TIFF kann kein Druckprofil einbetten, weshalb eine **Embed**-Zeile nur den Namen dieses Profils verzeichnet.
- **TIFF (RGB)** ist die unkomprimierte sRGB-Version für das Archiv oder die Bearbeitung mit anschließender Rückgabe. Beide TIFFs sind nur auf dem Desktop verfügbar, da Browser keine TIFF-Vorschau anzeigen können.
- **SVG**, **EMF**, **EPS** und **DXF** sind Vektoren ohne eingebettetes Profil: SVG-Farben sind sRGB, EMF und EPS verwenden Geräte-RGB, **EPS (CMYK)** schreibt DeviceCMYK und DXF verwendet den AutoCAD Color Index. SVG, EPS und DXF wandeln Text in Umrisspfade um. EMF erhält Text als Live-Text, der in Office und Google Slides bearbeitbar bleibt, und wandelt nur die Abschnitte in Umrisse um, die das Format nicht ausdrücken kann. Die Option **Outline fonts** im Exportpanel erzwingt überall Pfade, ebenso wie `_text=outline` in einem Link und `--text=outline` auf der Kommandozeile. SVG bildet außerdem innere und äußere CSS-Boxschatten nach.

::: details PDF/X-4 und Ihr eigenes Druckprofil
Lolly liefert ein CMYK-Profil mit, das an Fogras FOGRA39-Charakterisierungsdaten angepasst und unter CC0 veröffentlicht wurde, und rechnet darüber Farben für die Standard-Druckbedingung um. Das Profil wird nicht eingebettet, da es die ICC-Version 4.3 hat und PDF/X-4 Versionen bis 4.2 akzeptiert. Eine benannte Druckbedingung schreibt deshalb den Output Intent, ohne PDF/X-4-Konformität zu beanspruchen.

Laden Sie ein eigenes CMYK-Profil und wählen Sie dessen Zeile **Embed** im Steuerelement Colour profile. Es wird als *DestOutputProfile* der Datei eingebettet und das PDF beansprucht PDF/X-4-Konformität, sofern der Rest der Datei dies zulässt. Die angegebene Druckbedingung wird aus diesem Profil gelesen: ein registrierter Name, wenn das Profil einen nachweist, oder `Custom` unter dem eigenen Namen des Profils.

Drei Dinge verhindern den Konformitätsanspruch, während der Output Intent erhalten bleibt: RGB-Grafiken, die der CMYK-Durchlauf nicht umrechnen konnte, der Herkunftstext am Prüfrand `prov` (gezeichnet in einer nicht eingebetteten Standardschrift) und ein **Strong**-Passwort, da PDF/X-4 Verschlüsselung verbietet. Jedes PDF enthält zudem PDF/X-4-Metadaten: Seitenrahmen, XMP, eine Dokument-ID und einen sRGB-Output-Intent mit seinem Profil.
:::

### Sonderfarben als Prozessfarben

Ein Designsystem kann einer Farbe eine Sonderfarbe zuweisen, etwa eine Pantone- oder HLC-Farbe. **Print PDF** druckt diese Farbe dann auf einer eigenen Platte. Lolly Demo weist jeder Farbe eine Sonderfarbe zu, außer seinen Weißtönen Sugar und Daylight und seinem Schwarz Void. Ein in Lolly Demo erstelltes Print PDF druckt die meisten Farben auf Sonderfarbplatten und Schwarz auf der Schwarzplatte.

Für eine reine Vierfarbdatei aktivieren Sie **Print spot inks as process** in der Karte Profile des Export-Panels. Jede Sonderfarbe wird dann mit Cyan, Magenta, Gelb und Schwarz gedruckt, mit den CMYK-Werten, die das Designsystem dieser Farbe zuweist. Eine Farbe ohne eigene CMYK-Werte übernimmt die Umrechnung des Druckprofils, wie jede andere Farbe in der Grafik. Die Datei enthält dann nur die vier Prozessfarbplatten. Die Option ist standardmäßig ausgeschaltet. Das Panel zeigt das Kästchen nur für **Print PDF** und nur, wenn das Designsystem einer Farbe eine Sonderfarbe zuweist.

Eine Veredelung ist keine Druckfarbe. Folie, Hochprägung, Tiefprägung, partieller Lack, Softtouch, Stanzen, Rillen und Perforation behalten bei aktiviertem Kästchen ihre eigenen benannten Platten, weil eine als Prozessfarbe gedruckte Veredelung ihre schwarze Maske auf die Seite drucken würde.

Die Karte **Before you export** und `lolly preflight` zählen die Platten, die die Datei enthalten wird. Bei aktiviertem Kästchen zählen sie die vier Prozessfarbplatten und alle Veredelungsplatten und geben an, dass die Sonderfarben als Prozessfarben gedruckt werden und keine Platten hinzufügen. Bei deaktiviertem Kästchen zählen sie bis zu eine Sonderfarbplatte für jede vom Designsystem zugewiesene Sonderfarbe. Eine Preisliste berechnet die Kosten anhand dieser Zahlen, sodass sie nie eine Sonderfarbplatte berechnet, die die Datei nicht enthalten wird.

**Print TIFF** und **EPS (CMYK)** haben keine benannten Platten und drucken daher unabhängig von der Option jede Druckfarbe als Prozessfarbe. Für diese beiden Formate zählen die Karte und `lolly preflight` die vier Prozessfarbplatten und nie eine Sonderfarb- oder Veredelungsplatte. Eine Veredelung geht als schwarze Maske auf der Schwarzplatte in sie ein, und die Karte meldet dies als Fehler.

Ein Link fordert dieselbe Datei mit `_spots=process` an, die Befehlszeile mit `--spots=process`, der [MCP-Server](/info/mcp.html) mit `spots: "process"` und die Terminal-App mit ihrer Zeile **Spot inks**. Die Option selbst wird nicht in der Datei vermerkt: Nur die Druckfarben ändern sich.

### HDR (helle Farben)

Die Karte **HDR** im Export-Panel hellt gewöhnliche Grafiken für HDR-Bildschirme auf. Wie Sie HDR-Originale bei der Bearbeitung erhalten, erklärt [Bearbeiten mit großem Farbumfang und HDR](/info/hdr-editing.html).

Ein gewöhnlicher Export ist sRGB: Eine gesättigte Markenfarbe ist so hell wie das normale Weiß des Bildschirms. Ein HDR-Display kann heller werden. Die Karte **HDR** verstärkt Ihre Markenfarben und weißen Text in Richtung Spitzenhelligkeit. Dunkle Bereiche bleiben dunkel.

![Die Karte HDR im Export-Panel, eingeschaltet, mit den darunter eingeblendeten Reglern White / Reach / Dark lift / Focus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formate.** PNG, JPG, AVIF und TIFF. WebP hat 8 Bit und keinen funktionierenden HDR-Dekodierpfad, und Vektoren und PDF haben kein HDR-Modell.
- **Standardmäßig aus**, weil es die Pixel verändert. Aktivieren Sie die Karte oder übergeben Sie `hdr=1` in einem Freigabelink.
- **Die Regler.** **White** (die Obergrenze der Spitzenhelligkeit, 400 bis 2000 Nits), **Reach** (wie weit sich das Leuchten in dunklere Tonwerte ausbreitet), **Dark lift** (wie stark dunkle Bereiche aufgehellt werden; `0` hält sie dunkel) und **Focus** (wie viel Farbsättigung die Verstärkung erhält). Sie werden als ein Wert übertragen: `hdr=1600-60-0-50` steht für White 1600, Reach 60, Dark lift 0 und Focus 50.
- **Was geschrieben wird.** PNG erhält 16-Bit-Rec.2100-PQ mit einem `cICP`-Chunk. JPG ist ein Gain-Map-JPEG nach ISO 21496-1: ein gewöhnliches SDR-Bild mit einer angehängten Gain Map. AVIF erhält eine neu geschriebene `colr`-Box. TIFF erhält PQ-Pixel mit einem erzeugten ICC-v4-Profil, das ein `cicp`-Tag enthält. TIFF wird auf Schwarz reduziert, weil Weiß in PQ dem Code für 10.000 Nits entspricht und um jede Kante einen hellen Saum erzeugen würde. Die Verstärkung folgt der wahrgenommenen Helligkeit (OKLab) und erhält den Farbton, sodass ein Markengrün heller wird und nicht mintfarben.
- **Wo das Leuchten sichtbar wird.** In farbverwalteten Betrachtern auf einem HDR-Display: Preview, Quick Look und Safari auf Apple-Geräten oder Chrome auf einem HDR-Monitor. Ein SDR-Bildschirm zeigt ein normales Bild.
- **Vom Terminal aus.** `--hdr=1` mit `--export=png` oder `--export=jpg` schreibt auf der [CLI](/info/cli.html) dasselbe PNG und Gain-Map-JPEG mit denselben Encodern der Engine, ohne Browser. AVIF und TIFF sind vorerst nur als Web-Exporte verfügbar.

::: warning Viele Plattformen entfernen das HDR-Signal
Eine Plattform, die Uploads neu kodiert, kann das Bild dunkel oder ausgewaschen erscheinen lassen. Verwenden Sie HDR, wo Sie das Ziel kontrollieren, etwa auf Ihrer eigenen Website, einer Videowand oder in einem Deck auf einem hellen Display.
:::

<!--i:eti-badge-check-->
## Was Ihre Datei mitnimmt

Eine fertige Datei kann mehrere Angaben enthalten. Manche liegen neben den Pixeln und verschwinden, wenn die Datei neu gespeichert, als Screenshot aufgenommen oder bereinigt wird. Zwei Markierungen liegen in den Pixeln.

::: figure exporting-what-travels
Wo jede Angabe liegt, ob sie standardmäßig eingeschaltet ist und welcher Linkparameter sie steuert.
:::

Das Export-Panel fasst **Licence**, **Source credits**, **Password**, **C2PA Credentials**, den **Lolly Imprint** und den **Durable credential** in einer Gruppe **Content protection** zusammen, die nur die Karten zeigt, die das gewählte Format nutzen kann. Die Gruppe öffnet sich von selbst, wenn ein Link oder Dokument bereits eine Lizenz angibt oder eine Quelle Ihre Entscheidung erfordert. Die Karte **Design system** bleibt außerhalb der Gruppe und bei jedem Export sichtbar.

![Die geöffnete Gruppe Content protection bei einem PNG-Export, mit nur den dafür geltenden Karten](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Herkunft & Wasserzeichen

Wo das Format die Felder bietet, enthalten Exporte **Herkunftsmetadaten**: die Software, die Quelle, den Namen des Tools und Ihre Urheberzeile aus dem Profil, geschrieben in PNG-iTXt, JPEG-EXIF, PDF-Info, SVG-`<metadata>` oder einen GIF-Kommentar. Sie halten nur die Urheberschaft fest. Nichts wird hochgeladen. **Experimentelle** Tools bringen außerdem ein sichtbares Wasserzeichen an. Der Host fügt das Wasserzeichen hinzu, sodass es sich durch Bearbeiten des Tools nicht entfernen lässt.

**Der Lolly Imprint** ist ein unsichtbares Pixelwasserzeichen, **standardmäßig eingeschaltet**. Es übersteht erneute Komprimierung, sodass eine Kopie weiterhin als mit Lolly erstellt erkannt werden kann. Es ist ein Hinweis, keine kryptografische Garantie, und enthält keine personenbezogenen Daten. Es wird in JPEG XL, PNG, JPG, WebP, AVIF, TIFF und BMP geschrieben sowie in die Rasterbilder, die Lolly in ein PDF oder PPTX rendert, niemals in ein von Ihnen eingebettetes Bild. Deaktivieren Sie **Lolly Imprint** oder übergeben Sie `imprint=0`, um den Imprint wegzulassen. Wie gut er eine erneute AVIF-Kodierung übersteht, ist noch nicht kalibriert. [Lolly Verify](/#/verify) erkennt den Imprint auf Ihrem Gerät; siehe [Der Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Der Durable credential** schreibt Lollys ID mit einem neuronalen Modell auf dem Gerät im TrustMark-Format in die Pixel, sodass die Verbindung „mit Lolly erstellt“ das Entfernen der Metadaten und eine erneute Kodierung übersteht und von Tools gelesen werden kann, die TrustMark unterstützen. Er ist **standardmäßig ausgeschaltet**, weil er pro Export einen Durchlauf des neuronalen Modells und einen einmaligen Modelldownload erfordert. Er umfasst PNG, JPG, WebP, AVIF und TIFF. Aktivieren Sie ihn im Panel oder übergeben Sie `durable=1`. Die Desktop- und Mobil-Apps blenden die Karte aus, weil sie offline keine Origin haben, von der sie das Modell abrufen könnten.

**Licence.** Wählen Sie, wie andere Ihre Arbeit nutzen dürfen: standardmäßig *None (all rights reserved)*, CC0 1.0, Public Domain Mark 1.0 oder eine Creative-Commons-4.0-Lizenz (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Der Lizenzname und ein Link zu ihrer Kurzfassung werden in die Lizenzmetadaten der Datei (EXIF, XMP und RIFF, wo das Format sie bietet) und ihren Content Credential aufgenommen. Die Auswahl wird mit dem Dokument gespeichert und in einem Link als `licence=` weitergegeben. Lolly schreibt die von Ihnen gewählte Lizenz. Lolly prüft die Bedingungen nicht und setzt sie nicht durch. Ein Tool mit einem eigenen Lizenzfeld, etwa Claim, behält stattdessen dieses Feld.

### Die Designsystem-Angabe

Ein Export hält fest, welches Designsystem die Datei erstellt hat: seinen Namen, die veröffentlichte Version, aus der sie gezeichnet wurde (wenn dies nicht die Arbeitsversion ist), und die [Farbvariante](/info/colourways.html), in der sie gezeichnet wurde. Jede andere Theme-Auswahl, die ein Designsystem angibt, etwa eine Dichte, wird genauso festgehalten. Die Wahl zwischen hell und dunkel wird weggelassen, weil das Bild bereits zeigt, was verwendet wurde.

**Sie sehen die Angabe, bevor etwas geschrieben wird.** Die standardmäßig aktivierte Karte **Design system** zeigt den genauen Wortlaut, den die Datei enthalten wird, etwa *Records: Acme · Colourway: Beach*, und die Beschreibung. Der Name eines Designsystems entspricht dem, was seine Eigentümer eingegeben haben, und die Karte zeigt ihn unverändert. Deaktivieren Sie die Karte, um die Angabe bei diesem Export wegzulassen. Das Dokument-Panel von Lolly Design listet denselben Wortlaut unter *Embedded in exports* auf.

**Die Beschreibung nennt die Farbvariante neben dem Tool.** Bei aktivierter Karte wird aus *"Made with https://lolly.tools : Chart"* der Text *"Made with https://lolly.tools : Chart (Beach colourway)"*. Der eigene Name des Designsystems bleibt in der Angabe, nicht in der Beschreibung. Eine Beschreibung ohne Toolnamen oder eine, die ein Tool aus seinen eigenen Eingaben schreibt, bleibt unverändert. Ein Tool, das Farbvarianten über `tokenAxes` ignoriert, hält keine fest, und die Herkunftsangabe im PDF-Proof (die Druckmarke `prov`) folgt derselben Regel.

::: details Marken-Skills, Markenseiten und Partnerunternehmen in der Angabe
**Marken-Skills, die einen Agenten angeleitet haben.** Wenn ein Agent das Werk erstellt und die [Marken-Skills](/info/brand-skills.html) genannt hat, die er gelesen und befolgt hat, listet die Angabe außerdem jeden Skill mit seiner Revision auf, etwa *Guided by: acme-brand 1.0*. Der Wortlaut bedeutet, dass der Skill die Arbeit angeleitet hat. Lolly prüft das Werk nicht gegen einen Skill. Nur die eigene Aussage des Agenten fügt die Liste hinzu. Derzeit geschieht das über das Argument `brandSkills` von `lolly_render` des [MCP-Servers](/info/mcp.html), sodass ein in der App oder über einen Freigabelink erstelltes Werk keine solche Liste enthält. Der Content Credential enthält die Liste als `brandSkills`, einen JSON-Wert mit ID, Name, Revision und SHA-256-Hash jedes Skills. Das XMP-Paket und die SVG-Metadaten enthalten denselben Wert als `lolly:BrandSkills`. Ein aus der Angabe geschriebenes PDF erhält ein Schlüsselwort pro Skill. Die Beschreibung bleibt unverändert. Der Text eines internen Skills wird nie festgehalten. Dieselben Schalter lassen die Liste mit dem Rest der Angabe weg: die Karte **Design system**, `_madewith=0`, `--no-madewith` und `madeWith: false`. Wenn der MCP-Server die Datei in einem Browser zeichnet (ein PDF, ein JPEG und die anderen Formate, die sein browserfreier Pfad nicht schreiben kann), enthalten die eigenen Metadaten der Datei keine Liste. Dort kann nur ein Content Credential die Liste enthalten. Übergeben Sie `c2pa`, um die Angabe zu erhalten. Ohne Credential warnt das Rendering, dass die Marken-Skills nicht festgehalten wurden.

**Die Markenseite, wenn ihr Herausgeber zustimmt.** Der Herausgeber eines Designsystems kann festlegen, dass die Adresse seiner [Markenseite](/info/brand-page.html#lead-back-from-your-files) in Exporten festgehalten wird. Die Einstellung gilt pro Designsystem und ist standardmäßig ausgeschaltet. Die Karte ergänzt dann die Adresse in derselben Zeile, etwa *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Wird die Karte deaktiviert, wird die Adresse mit dem Rest entfernt. Die Angabe enthält die Adresse und sonst nichts über die Seite. Sonst ändert sich nichts in der Datei. Ein Designsystem ohne Adresse schreibt dieselbe Datei wie zuvor.

**Die Adresse wird nicht mit einem Paket weitergegeben.** Eine Angabe in einer signierten Datei gilt als die eigene Angabe des Unterzeichners. Eine Adresse darf sich nicht für jemanden selbst aktivieren, der diese Adresse nicht gewählt hat, und ein Paket darf die Dateien anderer nicht auf eine Seite seiner Wahl verweisen können. Ein `.lolly`-Paket, eine Kopie oder ein Fork eines Designsystems, **Try these colours**, ein wiederhergestelltes Backup und eine für einen einzelnen Durchlauf bereitgestellte Token-Datei kommen alle mit ausgeschalteter Einstellung an. Sie können die Einstellung selbst mit einer von Ihnen eingegebenen Adresse einschalten. Ein verwaltetes Designsystem ist die einzige Ausnahme: Es behält die Adresse, die seine Verwaltung in den Quell-Tokens festgelegt hat. [Von Ihren Dateien zurückführen](/info/brand-page.html#lead-back-from-your-files) enthält die Einzelheiten.

**Das Partnerunternehmen in einem Lolly Work-Partnerprogramm.** Ein für ein Partnerunternehmen erstelltes Werk hält das Unternehmen und sein Programm in derselben Zeile fest, etwa *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, mit der Revision der Unternehmensangaben in der Datei. Die Angabe enthält keine Person, Kontaktdaten, Adresse oder Währung. Ist das Partner-Kit des Unternehmens angehängt, ergänzt die Zeile die Revision des Kits, etwa *, kit revision 2*, und der Credential enthält ID und Revision des Kits, niemals seine Farben oder Regeln. Wird die Karte deaktiviert, wird der Partner mit dem Rest der Angabe entfernt. Ein PDF erhält das Schlüsselwort *Partner: Northwind IT*, und [Lolly Verify](/info/what-verify-checks.html#partner) zeigt die Angabe als **Partner** ([Die Partnerangabe in Dateien](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Die Angabe wieder auslesen.** [Lolly Verify](/#/verify) listet die Angabe als **Design system** in den Credential-Details einer Datei und alle Marken-Skills als **Guided by** auf. Eine Markenseite erscheint separat als [Adressangabe des Unterzeichners](/info/what-verify-checks.html#brand-page). *Recreate with these settings* öffnet das Tool erneut in der festgehaltenen Version und Farbvariante. Der Link öffnet sich mit dem festgehaltenen Designsystem, wenn dieses Gerät eines mit derselben ID und demselben Namen enthält; andernfalls öffnet er sich mit Ihrem aktiven Designsystem.

::: details Was wo geschrieben wird und welche Durchläufe die Angabe weglassen
| Wo | Was geschrieben wird |
|---|---|
| Content Credential | `designSystem` (die ID), `designSystemLabel`, `designVersion` und `themes` in der Assertion `tools.lolly.export`, jeweils als Klartextwert; `themes` ist eine JSON-Liste der Auswahlwerte. `brandPage`, wenn der Herausgeber zugestimmt hat |
| PNG, JPEG, WebP und JXL | Dieselben Werte als `lolly:`-Eigenschaften im XMP-Paket der Datei, im Namensraum `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage`, wenn der Herausgeber zugestimmt hat |
| SVG | Dieselben `lolly:`-Eigenschaften innerhalb des `<metadata>`-Blocks |
| PDF | Schlüsselwörter wie *Design system: Acme*, *Colourway: Beach* und, wenn der Herausgeber zugestimmt hat, *Brand page: https://acme.example/brand/acme/* |
| Jedes Format mit einem Beschreibungsfeld | Die Beschreibung mit der Farbvariante neben dem Tool |

Die Karte erscheint nur, wenn es etwas festzuhalten gibt und das Format die Angabe aufnehmen kann. CSV, JSON, eine Kalenderdatei und andere Text- oder Datenformate enthalten keine Metadaten, und EPS, EMF, DXF und BMP haben kein Feld für die Angabe. HTML, Markdown und CSS enthalten die Angabe nur in ihrem Content Credential, deshalb zeigt die Karte für sie keine Beschreibungszeile und wird ausgeblendet, solange **C2PA Credentials** ausgeschaltet ist. Ein Feld, das das Designsystem nicht angibt, bleibt aus der Datei ausgeschlossen.

Ein Freigabelink schaltet die Angabe mit `_madewith=0` aus ([URL-Parameter](/info/url-parameters.html)). Die Befehlszeile nimmt `--no-madewith` an, `lolly_render` des [MCP-Servers](/info/mcp.html) nimmt `madeWith: false` an, und das Export-Panel der Terminal-App hat eine Zeile **Design system**. Die Befehlszeile gibt den Wortlaut einer fertigen Datei über die Standardfehlerausgabe aus, sowohl für das Rendering eines Tools als auch für jede Datei, die `lolly run` aus einer gespeicherten Lolly Design-Sitzung exportiert. Ein MCP-Rendering gibt den Wortlaut neben der Datei aus. Beide lesen den Wortlaut aus der Datei zurück. Ein PNG, das die Befehlszeile ohne Browser zeichnet, enthält keine Dateimetadaten, sodass seine Angabe nur im Credential weitergegeben wird. Utilities auf dem Gerät fügen keine Metadaten hinzu.

Durchläufe ohne Karte **Design system** lassen die Angabe weg: ein Lolly Batch-Durchlauf, ein aus Projects exportierter Ordner und der Export einer 3D-Sammlung sowie in der Terminal-App ein CSV-Batch, der Export eines Projects-Ordners oder einer Auswahl und die Ansicht zum Rendern aller Inhalte. Exportieren Sie eine einzelne Datei aus dem Tool, um das Designsystem festzuhalten.
:::

### Content Credentials (C2PA)

Exporte können **Content Credentials** enthalten: ein signiertes [C2PA](https://c2pa.org)-Manifest, das festhält, womit, wann und wo die Datei erstellt wurde, gebunden an einen Hash der Dateibytes, sodass jede spätere Änderung erkennbar ist. Lolly schreibt standardkonforme Manifeste, die jeder C2PA-Reader prüfen kann.

![Die aktivierte Karte C2PA Credentials mit der Gültigkeitsdauer des Credentials neben dem Kontrollkästchen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Standardmäßig eingeschaltet.** Die Karte **C2PA Credentials** ist für fast jedes Tool aktiviert. Deaktivieren Sie sie für einen Export oder übergeben Sie `c2pa=off` in einem Link. Die Datei enthält dann keinen Credential, und ein SVG, das Grafiken mit Credentials direkt einbettet, etwa ein Kataloglogo, verliert auch den Credential dieser Grafik. Der Lolly Imprint und die anderen Metadaten der Datei bleiben erhalten. Ein Tool kann dies in seinem Manifest ausschalten.
- **Formate.** PDF (RGB und Print), PNG und APNG, JPG, GIF, SVG und SVGZ, TIFF (RGB und Print), WebP (statisch und animiert), AVIF, MP4, WebM, HTML, Markdown, CSS und die Audiocontainer MP3, WAV, M4A, OGG/Opus und FLAC. Ein ZIP versieht jeden unterstützten Eintrag mit einem Credential, so erhält auch ein Animated SVG einen Credential. MP4, AVIF und M4A verwenden die standardmäßige BMFF-Bindung und MP3 seine ID3v2-Zuordnung, sodass `c2patool` und andere Reader sie verifizieren. Für WebM und OGG/Opus gibt es noch keine standardmäßige Zuordnung, daher speichert Lolly das Manifest als Matroska-Anhang und als OpusTags-Feld, die Lollys eigene Prüfung kontrolliert. Ein SVGZ ist ein komprimiertes SVG. Die C2PA-Spezifikation definiert keine komprimierte Form, deshalb wird der Credential vor der Komprimierung in das SVG geschrieben. Lollys Prüfung liest die Datei unverändert; `c2patool` liest denselben Credential, sobald die Datei dekomprimiert ist (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, die Office-Formate und die anderen Text- und Datenformate haben keinen C2PA-Container.
- **Was festgehalten wird.** Das Tool und die App, die die Datei erstellt haben, der Signierzeitpunkt und die Shell, die die Datei exportiert hat. Bei einer als Bild, SVG oder PDF exportierten Lolly Design-Seite der Renderer, der die Seite gezeichnet hat (`route` in der Assertion `tools.lolly.export`: `gpu` für den GPU-Seitenrenderer, `operations` für die als Vektoren geschriebenen Zeichenoperationen, `compatibility` für den eigenen Renderer des Browsers), und die Version dieses Renderers (`renderer`: das GPU-Rezept, `design-draw-v` und seine Version oder `dom-to-image` und `dom-walker`). Das [Designsystem und die Farbvariante](#the-design-system-record), solange die Karte **Design system** aktiviert ist. Die aktiven Einstellungen: Menüauswahlen, Zahlen, Schalter und Farben unverändert und alles Eingegebene (Titel, Namen, Notizen, Links und Daten) nur als Fingerabdruck, sodass der Wortlaut nicht in der Datei steht. Profilgebundene Felder, inaktive Steuerelemente, Browserversionen und Angaben zum Betriebssystem werden weggelassen. Ihr Name und Ihre E-Mail-Adresse erscheinen nur als Urheber, wenn **Use my details to create** unter Settings → Preferences → Your details eingeschaltet ist. Quellen, die ein Export platziert, werden als Bestandteile mitgeführt. Jedes Bild auf der Seite, das einen eigenen Content Credential enthält, wird als Bestandteil der Seite festgehalten, mit diesem Credential und jedem darin angegebenen KI-Quelltyp. Das gilt für PNG, JPEG, WebP, AVIF, TIFF, SVG oder PDF sowie für GIF, APNG, animiertes WebP, MP4 oder WebM, wenn das Bild in mindestens einem Frame des exportierten Bereichs gezeichnet wird. Das einzelne Bild, das ein Tool wie Darkroom, Filter oder Asset Export verändert, wird stattdessen als Ursprungsdatei festgehalten, zuerst geöffnet und gefolgt von den Änderungen, die das Tool am Bild vorgenommen hat. Weitere Bestandteile sind [Werke mit Quellenangabe](#source-credits) wie Emoji, [Lolly Rondocode-Songs](/info/rondocode.html#songs-in-the-credential) in einem Video- oder Audioexport und [gespeicherte Musikstücke](/info/generated-music.html#what-a-track-records) in einem Video- oder Audioexport. Jedes gespeicherte Musikstück enthält seinen Namen, die Lizenz, sofern das Musikstück eine festhält, den SHA-256 seines Rezepts, die Engine-Version und die Kennzeichnung als algorithmisches Medium. Der Ersteller eines gespeicherten Musikstücks (der Profilname, mit dem es gespeichert wurde) wird wie Ihr eigener Name nur hinzugefügt, solange **Use my details to create** eingeschaltet ist. Nur dann zeigt das Export-Panel den Ersteller vor dem Export an.
- **Eine Freigabe, wenn eine festgehalten wurde.** Eine über [Lolly Work](/info/work-approvals.html#review-an-exported-file) freigegebene Datei kann eine zweite, signierte Angabe über diesem Credential enthalten: die Freigabe-ID, das Datum der Entscheidung und den Digest der geprüften Datei. Sie enthält keine Namen, E-Mail-Adressen, Gruppen, Kommentare oder Kettennamen. Sie ist im Anfragedialog standardmäßig aktiviert und kann für eine Anfrage deaktiviert oder für eine Instanz ausgeschaltet werden. Sie hält fest, dass ein Unterzeichner eine Entscheidung erklärt hat. Sie besagt nicht, dass das Werk einen Standard erfüllt.
- **Was ausgeführt werden sollte, bei einer aus einer [Intention](/info/visual-intent.html#what-goes-in-the-file) erstellten Datei.** Der Zweck, die Ausgabefläche, das Tool, die Sprache, die Versionen der Regeln und des Vokabulars und der Digest der Intention. Anlass, Zielgruppe, Region und Prompt sind nur Fingerabdrücke, es sei denn, die Person oder der Agent, die das Rendering ausführen, verlangen, den Wortlaut des Prompts festzuhalten. Nur ein Rendering, das von einer Intention ausgegangen ist, enthält diese Angabe. Der Durchlauf gibt an, was er festgehalten hat, und die Angabe kann weggelassen werden.
- **Was Empfänger sehen.** C2PA-Tools wie Adobe-Apps, `c2patool` und contentcredentials.org/verify lesen das Manifest und zeigen die Aussage an. Lolly signiert mit einem auf Ihrem Gerät erzeugten Schlüssel, nicht mit einem Zertifikat aus einer Vertrauensliste, daher melden Betrachter einen *nicht verifizierten* Credential. Die Struktur und der Manipulationsnachweis sind gültig, aber niemand bürgt für den Unterzeichner. Um das zu ändern, registrieren Sie eine **verifizierte Identität** unter Settings → Preferences → Content Credentials; siehe [Content Credentials-Identität](/info/content-credentials-identity.html).
- **Eine Datei prüfen.** Ziehen Sie eine beliebige Datei auf [Lolly Verify](/#/verify) oder führen Sie `lolly validate <file>` aus, um auf dem Gerät einen Bericht zu erhalten, der zuerst angibt, ob Lolly die Datei erstellt hat und ob sie seitdem verändert wurde. Lolly Verify prüft auch über den Credential hinaus; siehe [Was Lolly Verify prüft](/info/what-verify-checks.html).
- **Datenschutz.** Der Signierschlüssel wird für den Export erzeugt und verlässt Ihr Gerät nie. Die Aussage enthält nur, was die Herkunftsmetadaten bereits enthalten. Datenschutz-Utilities, die Ihre eigenen Dateien umwandeln, fügen keinen Credential hinzu, und *Lolly Strip Hidden Data* entfernt ein C2PA-Manifest wie alle anderen Metadaten. Das Utility Rondocode erzeugt neues Audio und signiert deshalb, was es schreibt ([Lolly Rondocode-Songs](/info/rondocode.html#files-from-the-rondocode-utility)). Der Musikgenerator signiert jeden WAV- oder M4A-Download. Der Credential hält fest, dass Lollys Musikgenerator den Track erstellt hat, und nennt die Lizenz, unter der die Musik steht, CC BY 4.0, mit ihrer Urheberangabe ([Was ein Track festhält](/info/generated-music.html#what-a-track-records)).
- **Wechselwirkungen.** Ein passwortgeschütztes PDF kann auf keiner der beiden Stufen Content Credentials enthalten. Der Credential wird zuletzt über die fertigen Bytes hinzugefügt, nach DPI, EXIF, Farbprofil, PDF/X-Metadaten und Druckmarken.

### Quellenangaben

Ein Export, der das Werk einer anderen Person platziert, hält diese Quelle im Credential fest. Der häufigste Fall ist ein Emoji aus dem gewählten Emoji-Set: Das Werk, sein Urheber, die Lizenz, die Herkunft der exakten Bytes und alle Änderungen werden mit der Datei weitergegeben. Text in einem Tool mit einer SVG-Vorlage behält die eigenen Emoji des Systems, sodass dort keine Quellenangabe erfolgt. Vor dem Download zeigt die Zeile **Source credits**, welche Anforderungen die Quellen an die Auslieferung stellen. Nach dem Download liest die Zeile die ausgelieferten Bytes zurück, bevor sie bestätigt, dass die Quellenangaben in der Datei sind. Eine Lizenz, die eine Entscheidung verlangt, etwa bei einer umgefärbten CC-BY-SA-Glyphe, die Sie teilen wollen, erhält eine Karte mit den Optionen. Der Download wird nie blockiert. [Rechte an kreativen Werken und Quellenangaben](/info/creative-rights.html) enthält den Wortlaut, die geprüften Lizenzen und das, was Ihnen gehört.

<!--i:eti-lock-->
## Passwortschutz

Lolly erzeugt zwei Arten von Sperren, beide auf Ihrem Gerät. Die Karte **Password** im Export-Panel stellt beide ein.

![Die aufgeklappte Karte Password bei einem PDF-Export mit dem Passwortfeld und den beiden Schutzstufen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Ein Passwort zum Öffnen eines PDFs** hat zwei Stufen, sobald Sie ein Passwort eingeben:

- **Weak**: 40-Bit-RC4, für RGB-`pdf` ohne Druckmarken oder Beschnitt und mit reinen ASCII-Passwörtern. Ein Passwort mit anderen Zeichen wechselt zu Strong, weil Reader eine so gesperrte Datei auf dieser Stufe nicht öffnen können. Nur die ersten 32 Zeichen zählen.
- **Strong**: AES-256 (PDF 2.0). Dies gilt auch für Print PDFs und jedes PDF in einem Batch-ZIP. Ein mit Strong gesperrtes Print PDF behält CMYK, Marken und Output Intent, lässt aber die PDF/X-4-Konformitätsangabe weg.

::: warning Weak schreckt ab, schützt aber nicht
Verwenden Sie **Strong** für eine vertrauliche Datei.
:::

**Ein gesperrtes ZIP** umfasst einen ZIP-Export, einen Ordnerdownload aus Projects oder einen Batch, mit einem Passwort auf zwei Stufen: **Weak** (ZipCrypto, zur Abschreckung) oder **Strong** (AES-256). Das Passwort schützt jeden Eintrag. Jedes enthaltene PDF wird zusätzlich für sich mit AES-256 gesperrt, sodass es nach dem Entpacken des ZIPs gesperrt bleibt. Die Abfrage erscheint beim Start des Downloads. Ein leeres Passwort bedeutet keine Sperre.

**Ein eingegebenes Passwort bleibt auf beiden Stufen aus Links ausgeschlossen.** Kommt eine Datei über einen `?password=`-Link an, liest Lolly den Wert und entfernt ihn sofort aus der Adresse. Ein Link, der eine Sperre verlangt, die seine Datei nicht unterstützen kann, schreibt keine Datei und nennt den Grund (siehe [`password`](/info/url-parameters.html)).

**Ein passwortgeschützter Freigabelink** fragt den Empfänger vor dem Öffnen nach einem Passwort. Der Linkzustand wird mit AES-256 unter einem aus dem Passwort abgeleiteten Schlüssel (PBKDF2) verschlüsselt. Nur der Geheimtext wird übertragen, und die Entschlüsselung erfolgt im Browser des Empfängers. Der Server, der den Link ausliefert, sieht weder das Passwort noch das Design. Schalten Sie dies im Dialog **Share** ein. Ein verschlüsselter Link öffnet sich nur in Lolly, nie als eingebettetes Bild. Siehe [URL-Modus](/info/url-mode.html).

<!--i:eti-monitor-->
## Auf einem Smartphone

Die Export-Steuerelemente liegen hinter der schwebenden Schaltfläche **Export**, die das Panel **Export** öffnet: dieselben Formate, Größe, Kopieren, Download und Teilen, für die Touch-Bedienung angepasst.

<!--i:eti-code-->
## Format-IDs für Links und die CLI

Dies sind die Werte für den URL-Parameter `format=` und das CLI-Flag `--export=` (siehe [URL-Parameter](/info/url-parameters.html) und [CLI](/info/cli.html)). Das Menü eines Tools zeigt nur die Formate, die dieses Tool erzeugen kann.

| Art | IDs |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (mit gzip komprimiertes SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (Schneidedatei) |
| Seite und Dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot-Designdatei) · `scorm` (Kurspaket, ein ZIP) |
| Bewegung | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + Medien) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (MIDI-Noten, aus Lolly Rondocode) |
| Text und Daten | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (GIMP-Palette) |
| Bündel und Pakete | `zip` · `rpm` und `tar.gz` (das Rendering in ein Linux-Paket eingeschlossen) |

Einige IDs stammen aus dem eigenen Exportcode eines Tools: `ase` (Adobe Swatch Exchange, aus Lolly Palette Lab) sowie `exr` und `hdr` (Raster mit hohem Dynamikumfang, aus Lolly Darkroom). **Convert Font** schreibt `ttf`, `otf` und `woff` aus einer von Ihnen bereitgestellten Schriftdatei, sodass ein bloßer Link dem Tool nichts zum Rendern gibt.
