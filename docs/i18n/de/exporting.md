# Eine Datei exportieren

Sie haben etwas erstellt, und es muss Lolly verlassen: ein PNG für einen Chat, ein PDF für die Druckerei, ein Deck, das eine Kollegin weiterbearbeiten wird. Drücken Sie **Export**, die linke Hälfte der Pille **Export | Save**. Wählen Sie neben dem Dateinamen ein Format und drücken Sie dann **Download**. Die Datei wird auf Ihrem Gerät erzeugt.

Was Sie auf der Arbeitsfläche sehen, ist das, was die Datei enthält. Das Formatmenü listet nur auf, was dieses Tool in diesem Browser erzeugen kann.

Für die meisten Aufgaben ist eines von drei Formaten richtig:

| Für | Verwenden Sie | Weil |
|---|---|---|
| Einen Bildschirm, eine Nachricht oder eine Folie | **PNG** | Jede App öffnet es, und es behält einen transparenten Hintergrund, wenn das Tool einen anbietet |
| Eine fertige Seite oder etwas Gedrucktes | **PDF** | Eine echte Seitengröße, die so druckt, wie sie aussieht; **Print PDF**, wo ein Tool es anbietet, ist die CMYK-Version für den Druck |
| Grafik, die in jeder Größe scharf bleiben muss | **SVG** | Vektorformen, scharf vom Badge bis zum Banner |

::: check Prüfen Sie die Datei in der Größe, in der sie verwendet wird
Bevor Sie sie versenden, öffnen Sie sie auf dem Bildschirm, für den sie gemacht wurde, oder drucken Sie sie in ihrer tatsächlichen Größe.
:::

::: details Freigaben und Lieferung mit Lolly Work (optional)
Eine [Organisation, die Lolly Work betreibt,](/info/organisation.html) kann steuern, welche Formate und Export-Einstellungen ihre Mitglieder sehen. Wo eine Freigabe verlangt wird, tritt **Request approval** an die Stelle von **Download**. Folgen Sie der Richtlinie, die Ihre Instanz zeigt.

Lolly Work kann eine Datei auch an konfigurierte S3-, WebDAV- und HTTP-Ziele liefern, mit Freigabeschritten, Lieferbelegen und einem Audit-Protokoll. Das Einreichen einer Datei für diesen Ablauf sendet sie an den Dienst der Organisation; ein gewöhnlicher Download bleibt auf Ihrem Gerät. Persönliche Send-Ziele und die Lieferung der Organisation werden getrennt konfiguriert.

Betreiber richten dies mit dem [Leitfaden zur Lieferung der Organisation](/info/work-delivery.html) ein. Für Server-Renderings und Batches in der Warteschlange siehe [CLI-Batch und Automatisierung](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Wie der Export funktioniert

Beim Export wird die Arbeitsfläche des Tools in das gewählte Format gerendert und Ihnen als Download übergeben oder in Ihre Zwischenablage gelegt.

Drei Wege erzeugen eine Datei. Die meisten Tools **rendern die Arbeitsfläche**. Text- und Datenformate (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) werden **aus dem Inhalt des Tools erzeugt**, statt aus dem Bild gezeichnet. Datenschutz-Utilities wie *Strip Hidden Data* **wandeln die Datei um, die Sie gewählt haben**, auf Ihrem Gerät, und geben sie ohne Arbeitsfläche, Wasserzeichen oder hinzugefügte Metadaten zurück, weil sie ohnehin Ihre eigene Datei ist.

![Drei Exportwege laufen auf einer fertigen Datei zusammen: die Arbeitsfläche rendern, Text oder Daten aus Inhalt erzeugen oder eine gewählte Datei auf dem Gerät umwandeln.](/info/diagrams/concepts/three-export-paths.svg)

Das Export-Panel bietet diese Aktionen. Die Autorin oder der Autor eines Tools wählt, welche erscheinen; der Standardsatz ist Copy, Download und Save.

- <!--i:download--> **Download** speichert die Datei. Wenn Sie sie danach nicht finden, siehe [Eine heruntergeladene Datei finden](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** legt das Bild in Ihre Zwischenablage, bereit zum Einfügen in einen Chat, eine E-Mail oder ein Dokument. Wo ein Browser keine Bilder kopieren kann, lädt es stattdessen herunter und sagt Ihnen das.
- <!--i:folder--> **Save** behält das aktuelle Design mit einem Klick in Projects und lädt nie eine Datei herunter. **Save as** neben **Download** fragt, wohin (siehe [Speichern und Weitermachen](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** öffnet den Share-Dialog: ein Link, der das Design reproduziert, die Schalter für den Besuch (Vollbild, Export-Panel, Download oder Kopie beim Öffnen) und ein optionaler **Shortest link**, der den ganzen Zustand in ein kompaktes Token packt (siehe [URL-Modus](/info/url-mode.html)).

![Das Exportpanel - Format, Größe und die Aktionen Kopieren / Download / Speichern / Teilen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Wenn ein Design das Rendering eines anderen Tools einbettet, etwa eine Design-Bildbox mit einem QR-Code-Link, wird das verschachtelte Rendering in den Export des Elternteils gezeichnet. Es bleibt in SVG und PDF echter Vektor und rastert in PNG, JPG und WebP scharf. Das eingebettete Rendering erhält kein Wasserzeichen und keine eigene Herkunftsangabe; nur die fertige Datei erhält sie. HTML-, Markdown- und TXT-Exporte können kein zusammengesetztes Rendering enthalten.

## Ein Format wählen

Der Dateiname und das Formatmenü sitzen zusammen als ein `name.format`-Paar, unterhalb von **Herunterladen**.

![Das Dateinamensfeld mit dem Format-Auswähler verschmolzen, sodass der Export als ein Paar name.format erscheint](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Beginnen Sie damit, wohin die Datei geht. Jede Karte listet die Formate auf, die zu diesem Ziel passen; ein Tool zeigt nur die, die es erzeugen kann.

::: figure exporting-format-chooser
Sechs Ziele und die Formate, die zu jedem passen.
:::

Eine Wortmarke in der Schrift Ihres Designsystems exportiert als SVG mit jedem Buchstaben als Umrisspfad, sodass eine Datei in Visitenkartengröße und in Gebäudeverhüllungsgröße scharf bleibt.

![Eine haarfeine, weit gesperrte Wortmarke mit der Aufschrift Aurora, die Art reiner Vektorgrafik, um die es in der SVG-Zeile der Tabelle geht](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Jedes Format und wofür es da ist
| Sie wollen | Nutzen Sie | Warum |
|---|---|---|
| Scharfe Logos oder Grafiken, die skalieren | **SVG** | Vektor: skalierbar, klein und bearbeitbar; ein Effekt, den der Vektorexport nicht zeichnen kann, wird als Bild eingebettet |
| Vektor für Office- und Windows-Apps | **EMF** | Fügt sich als bearbeitbarer Vektor in PowerPoint und Word ein, mit Live-Text; Google Drive öffnet es in Google Zeichnungen |
| Vektor für Druck und Design-Apps | **EPS** oder **EPS (CMYK)** | PostScript-Vektor für Illustrator und Druck-Workflows |
| Vektor für Schneidemaschinen | **DXF** | Laserschneider, Vinylplotter und CNC: Umrisspfade in Millimetern |
| Ein bearbeitbares Foliendeck | **PowerPoint** (PPTX) | Native bearbeitbare Texte und Formen, mit extrahierbar gehaltenen Bildern und Vektoren |
| Ein bearbeitbares Textdokument | **Word** (DOCX) oder **OpenDocument** (ODT) | Echte Absätze und Überschriften, die ein Textverarbeitungsprogramm weiterbearbeiten kann (Doc Studio) |
| Ein Layout für InDesign | **InDesign IDML (static subset)** | Text, Rechtecke, Ovale und Bilder, ein Druckbogen pro Artboard (Design) |
| Ein bearbeitbares Penpot-Dokument | **Penpot** | Boards, Formen, Text und verknüpfte Tokens |
| Ein Foto oder ein universelles Bild | **PNG** (verlustfrei) oder **JPG** (kleiner) | Universelles Raster |
| Kleinere moderne Bilder | **WebP** oder **AVIF** | Bessere Kompression, mit Transparenz |
| Druck | **PDF** oder **Print PDF** (CMYK) | Echte Seitengröße; CMYK für eine Druckmaschine |
| Druckraster für eine Druckmaschine | **Print TIFF** (CMYK) | DeviceCMYK-Pixel für ein RIP |
| Animiert für das Web | **GIF** | Läuft überall; größere Dateien |
| Animiert mit voller Farbe und echter Transparenz | **APNG** | Animiertes PNG: keine Palettengrenze |
| Animiert, kleinste Datei | **Animated WebP** | Volle Farbe und Transparenz, kleiner als GIF oder APNG |
| Animierter Vektor, der skaliert | **Animated SVG** | In sich geschlossen; läuft in Schleife in einem Browser oder einem `<img>`, in jeder Größe (Lottie Ad) |
| Eine Animation, die bearbeitbar bleibt | **dotLottie** | Formen, Pfade und äußere Transformations-Keys aus der Zeitleiste von Design |
| Eine Übergabe an Premiere | **Premiere XML + media** | Zeitlich gesetzte Clips und Originalmedien für Premiere (Design) |
| Video für Social Media und Teilen | **MP4** oder **WebM** | Beste Qualität für die Dateigröße (siehe [Video](#video)) |
| Untertitel | **SRT** oder **VTT** | Zeitlich gesetzter Text für einen Videoplayer (Captions, Audiogram und Record) |
| Ein Trainingskurs | **SCORM (LMS)** | Eine versionierte Website, ein SCORM- oder xAPI-Paket (siehe [SCORM](#scorm-course-packages)) |
| Formatierter Text oder eine E-Mail-Signatur | **HTML** | Fügt sich formatiert in Mailprogramme ein |
| Einfacher Inhalt | **MD** oder **TXT** | Nur Text |
| Ein Kalendereintrag | **ICS** | Lässt sich in jede Kalender-App importieren |
| Eine Kontaktkarte | **VCF** | Lässt sich in Adressbücher importieren |
| Strukturierte Daten zum erneuten Import | **JSON** oder **CSV** | Round-Trip des Inhalts des Tools |
| Ein Favicon | **ICO** | Website-Icon in mehreren Größen; **ZIP** bündelt mehrere Formate |
:::

### Transparenz

Tools, die es unterstützen, bieten einen Schalter für transparenten Hintergrund, etwa **No BG**. PNG, WebP, AVIF, SVG, APNG und Animated WebP behalten Transparenz, und GIF behält eine harte Kante. JPG und PDF sind immer deckend. TIFF wird auf Weiß verflacht, auf dem unter [HDR](#hdr-bright-colours) beschriebenen HDR-Pfad auf Schwarz.

## Größe und Druckeinheiten

Exporte nutzen die native Pixelgröße des Tools, sofern das Tool keine **dimensions** bietet. Dann legen Sie Breite, Höhe und eine **unit** fest:

- **px** (der Standard) sind exakte Pixel.
- **mm, cm, in, pt** und **pc** sind physische Größen. Bei einer physischen Einheit legen Sie außerdem **DPI** fest (standardmäßig 300). Ein **PDF** wird zu einer echten Seite in dieser Größe, ein **Raster** erhält die Pixelzahl für diese DPI und hält die Auflösung fest, und eine **SVG** behält die physische Einheit mit einer Pixel-viewBox.

Für ein Raster mit höherer Auflösung geben Sie eine größere Breite und Höhe ein oder wählen eine physische Einheit und erhöhen die DPI (Pixel = Größe × DPI). Breite `210`, Höhe `297` und Einheit `mm` ergeben eine A4-Seite.

![Die Maßzeile auf 210 mal 297 mm gesetzt, mit dem DPI-Feld sichtbar, weil die Einheit physisch ist](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Standbilder aus einer zeitbasierten Komposition

Eine zeitlich gesetzte Komposition, etwa eine [Sequenz](/info/sequence-editor.html)-Zeitleiste in Design, bewegt sich, sodass ein Standbild-Export einen Moment wählen muss: **das Bild am Abspielkopf**. Setzen Sie den Abspielkopf dorthin, wo Sie das Bild wollen, und exportieren Sie.

Für mehr als einen Moment erscheint neben der Ausgabegröße das Feld **Frames**. Es zeigt sich nur bei einer zeitlich gesetzten Komposition und einem Standbildformat (PNG, JPG, WebP, SVG oder PDF). Lassen Sie es auf `1` für das Bild am Abspielkopf. Erhöhen Sie es, und Sie erhalten so viele Standbilder, gleichmäßig über die ganze Sequenz verteilt:

- PNG, JPG, WebP und SVG kommen als ein ZIP zurück: `<name>-01.png`, `-02.png` und so weiter.
- PDF kommt als ein Dokument mit so vielen Seiten zurück.

Jedes Standbild stammt aus der Mitte seines Abschnitts der Zeitleiste, sodass das erste Bild nie ein halb eingeblendeter Auftritt ist und das letzte nie der leere Moment, nachdem jeder Clip geendet hat.

::: figure exporting-contact-sheet
Frames: 4 schneidet die Sequenz in vier gleiche Abschnitte und nimmt die Mitte jedes Abschnitts.
:::

Nutzen Sie es für ein Storyboard, einen Kontaktbogen zur Prüfung oder ein Social-Media-Karussell aus einem Videoschnitt. Die Zahl ist auf 64 begrenzt, und alles andere, was ins Feld getippt wird, fällt auf `1` zurück. Jedes Bild ist ein gewöhnliches Standbild, sodass Credentials, das Imprint, physische Einheiten und DPI sich verhalten wie bei einem Export. Ein Export-Link, die CLI und MCP verlangen denselben Bogen mit `cuts=` (siehe [Kontaktbögen](/info/url-export.html#contact-sheets)).

## Viele Dateien auf einmal

Lolly hat drei Wege, in Menge zu arbeiten, jeder für eine andere Aufgabe:

::: cols
## Eine Tabelle wird ein Dokument
Ein Tool mit einer Tabelleneingabe, etwa **Battlecards**, macht aus jeder Zeile eine Seite. Fügen Sie eine Tabelle aus Ihrer Tabellenkalkulation ein und erhalten Sie ein PDF. Korrigieren Sie Zeilen in der Tabellenkalkulation und fügen Sie erneut ein.
## Eine CSV wird eine Datei pro Zeile
**Batch** (`#/batch`) nimmt eine CSV und rendert einen Export für jede Zeile: Namensschilder oder Zertifikate, je eine Datei, in einem ZIP geliefert. Siehe [Batch](/info/batch.html#make-many-versions-of-one-design).
## Mehrere Designs erhalten eine Änderung
**Multi-edit** öffnet mehrere gespeicherte Sitzungen nebeneinander für dieselbe Korrektur an verschiedenen Designs. Siehe [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Aus **Projects** exportiert **Render folder** jede gespeicherte Sitzung in einem Ordner und seinen Unterordnern als ein verschachteltes ZIP, und **Render selection** tut dasselbe für jede Mehrfachauswahl; eine gespeicherte Sitzung rendert in ihre eigene Datei. Eine gespeicherte Sitzung kann auch aus Projects erneut als Tool-Link geteilt werden, der sie mit denselben Einstellungen wieder öffnet.

## Dateien, die anderswo bearbeitbar bleiben

Manche Formate übergeben Ihre Arbeit als bearbeitbaren Inhalt statt als Bild an eine andere Anwendung.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart und Agenda exportieren ein PowerPoint-Deck, eine Folie pro Seite. Jede Seite wird in native Objekte zerlegt, sodass eine Kollegin oder ein Kollege das Deck bearbeiten und Assets daraus entnehmen kann:

- <!--i:font--> **Text** wird zu bearbeitbaren PowerPoint-Textfeldern mit Schriftgröße, Farbe, Stärke, Kursivierung und Ausrichtung des Layouts.
- <!--i:pentool--> **Vektoren** wie Logos und Icons werden als SVG-Bilder eingebettet; sie bleiben scharf, und PowerPoint kann sie *In Form konvertieren*.
- <!--i:photos--> **Bilder** kommen in nativer Auflösung als eigene Bilder an. Ein beschnittenes Hero-Bild behält das volle Bild hinter dem Beschnitt, und jeder Filter oder Mischmodus darauf ist eingebrannt.
- <!--i:layers--> **Hintergründe, Rahmen und Linien** werden zu Rechteck- und Linienformen.

![Das Export-Panel mit ausgewähltem PowerPoint: eine Folie pro Seite, Text und Formen bleiben bearbeitbar](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Das Layout ist annähernd; das Ziel ist wiederverwendbarer Inhalt. Alles, was der Walker nicht nativ ausdrücken kann, etwa ein komplexer gefilterter oder maskierter Bereich, wird als Bild eingebettet, damit nichts verloren geht. Ein Deck hat eine Foliengröße, von der ersten Seite übernommen.

PowerPoint ist auch ein Weg hinein: [Ein Deck neu branden](/info/rebrand.html) überträgt ein Deck auf Ihr Designsystem, und [Ein Design importieren](/info/design-import.html) öffnet eines in Design.

### Penpot

Die meisten Tools, die SVG exportieren, exportieren auch eine **Penpot-Datei** (`.penpot`), bereit zum Weiterbearbeiten in Penpot.

| Was Sie erstellt haben | In Penpot |
|---|---|
| Text | Bearbeitbare Textobjekte: einen Tippfehler korrigieren oder neu gestalten |
| Formen, Pfade, Verläufe und Bilder | Eigene bearbeitbare Vektorformen |
| Eine Farbe oder Schrift aus einem Designsystem-Token | Ein lebendiger Token-Link: Bearbeiten Sie den Token, und jede Form, die ihn erbt, folgt |
| Das ganze Design | Eine wiederverwendbare Komponente im Panel Assets |
| Eine komplexe Illustration oder Live-Arbeitsfläche | Für sich als Bild eingebettet, der bearbeitbare Inhalt drumherum bleibt unberührt |

Aus Design wird jeder Frame zu einem Penpot-Board. Die Farben und Typografien des Designsystems landen im Panel Assets und sein voller Token-Satz im Panel Tokens. Penpot behält von dort aus seine eigene Kopie: Ein in Penpot bearbeiteter Token kommt über den Import in [Design System Setup](/info/brand-studio.html) zurück.

![Das Export-Panel mit ausgewähltem Penpot: die .penpot-Datei und Send to Penpot neben dem Download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Um die Datei zu öffnen, starten Sie Penpot, wählen ein Projekt und wählen **Import**. Wenn Sie im Export-Panel bei Penpot angemeldet sind, erledigt **Send to Penpot** diesen Schritt für Sie.

### Word, OpenDocument und InDesign

**Doc Studio** exportiert **Word** (DOCX) und **OpenDocument** (ODT) mit echten Absätzen und Überschriften.

**Design** exportiert **InDesign IDML (static subset)**: Text, Rechtecke, Ovale und PNG- oder JPEG-Bilder, ein Druckbogen pro Artboard. Unterstützte Inline-Formatierung bleibt bearbeitbar, Bilder reisen in `Links`, und Koordinaten werden zu InDesign-Punkten. Neuverknüpfung, Schriftersetzung und geänderter Umbruch können Aufmerksamkeit brauchen. Effekte, Animation, zusammengesetzte Stories und nicht unterstützte Geometrie stoppen den Export mit einem Bericht, der sie auflistet. IDML bewahrt das ursprüngliche Dokument nicht, senden Sie daher für fertige Grafik ein PDF.

### Zeitleisten: dotLottie und Premiere

Aus der Zeitleiste von Design schreibt **dotLottie** eine Animation, die in Lottie-Tools bearbeitbar bleibt; [Lottie-Animationen](/info/sequence-editor.html#lottie-animations) listet auf, was sie behält. **Premiere XML + media** packt zeitlich gesetzte Clips und ihre Originalmedien für Premiere; siehe [Premiere-XML-Austausch](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (Kurspakete)

Der Kursexport ist aus, bis Sie unter Settings → Preferences → Feature flags **Training and courses** einschalten.

Wählen Sie dann **Export course** aus einem unterstützten Tool, einem Projektordner oder einer Auswahl. In Design öffnet die Wahl von **SCORM (LMS)** und **Download** denselben Kurs-Ablauf. Lolly speichert die Arbeit, lässt Sie Kursinhalt und Reihenfolge prüfen und öffnet dann das Modul und seinen Export-Dialog.

- <!--i:layers--> Wählen Sie für jede Quelle eine Darstellung: Standbild-Seiten, Bewegung als Video, Audio oder eine herunterladbare Ressource. Fügen Sie im Modul Lektionstext und Lesealternativen hinzu.
- <!--i:clock--> Sehen Sie sich den Lernenden-Player in der Vorschau an und prüfen Sie Beschreibungen und Untertitel. Bewegung ist als Video enthalten, auch stumme Animation.
- <!--i:document--> Wählen Sie Website, SCORM 1.2, SCORM 2004 4th Edition oder ein experimentelles xAPI-Ziel. Prüfen Sie Inhalt und ZIP-Größe, speichern Sie dann die geprüfte Version und laden Sie sie herunter.
- <!--i:check--> Der Abschluss setzt voraus, jede erforderliche Lektion zu bestätigen und Finish zu wählen.

![Das Export-Panel eines Design-Decks mit ausgewähltem SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Das Paket enthält seinen fertigen Inhalt und braucht kein Lolly-Konto. Legen Sie ein Website-ZIP auf einem HTTP(S)-Host ab; importieren Sie ein LMS-ZIP unverändert. Testen Sie das Ziel, bevor Sie den Kurs teilen. Für einen Kurs aus mehreren gespeicherten Kreationen siehe [Einen Trainingskurs erstellen](/info/training-creators.html).

### DXF (Schneidedateien)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding und Wordmark exportieren **DXF**, das AutoCAD-R12-Austauschformat, das Laserschneider, Vinylplotter und CNC-Software lesen. Geometrie wird als Umrisspfade in Millimetern geschrieben, Text wird in Umrisse umgewandelt, und Farbe wird dem nächsten AutoCAD Color Index zugeordnet, der meist die Operation der Maschine steuert. DXF ist nur Strichgrafik: Ein fotografischer oder gefilterter Bereich hat keinen Schneidepfad und wird mit einer Warnung weggelassen. Nutzen Sie SVG oder PDF, um Rasterinhalt zu behalten.

Street Map ist der klarste Fall. Das ganze Design besteht schon aus Strichen, sodass jede Straße und jeder Kanal zu einem Schneidepfad wird.

::: showcase
![Ein Street-Map-Rendering von Paris in Tinte auf Creme - reine Strichgrafik, sodass jeder Strich die Reise zum Cutter übersteht](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scrollen Sie, und die Kamera zoomt durch die tatsächliche Geometrie zurück: sieben Pfade, nirgends Pixel, jeder Strich haarscharf bei jeder Zoomstufe. Das ist dieselbe Datei, die ein Cutter liest.
:::

## Druck

**Print PDF** schreibt CMYK gegen eine benannte Druckbedingung, standardmäßig **Coated FOGRA39**. Markenfarbfelder mit gemessenen Farbwerten werden exakt umgerechnet; andere Farben nutzen eine Standard-Geräteumrechnung. **Print TIFF** schreibt DeviceCMYK-Pixel für ein RIP und hält dieselbe Druckbedingung in seinen TIFF-Metadaten fest. Das Steuerelement Colour profile steuert beide; [Farbprofile](#colour-profiles) hat die Einzelheiten.

**Print marks & bleed** hat auf den Druckformaten eine eigene Karte: den Beschnitt in Millimetern plus Details zu Crop, Registration, Bleed, Colour bars und Stamp.

Manche Tools bauen ein **mehrseitiges PDF**: ein Cover, Inhalt, der auf so viele Seiten fließt, wie er braucht, und eine Rückseite, wie im Tool *Booklet*. Jede Seite ist eine echte Hochformat-PDF-Seite in A4, US Letter oder A5, und Sie können jeden Block auf eine neue Seite zwingen. Das sind RGB-Dokumente ohne Schnitt- oder Beschnittmarken, die zum einseitigen Print PDF gehören. Ein Design-PDF kann auch ein **Notes handout** sein: eine Hochformatseite je Folie mit ihren Sprechernotizen darunter.

**Vor dem Export.** Eine Karte **Before you export** am Fuß des Panels sagt, was eine Druckerei gleich sehen wird: Format, Größe und Beschnitt, Beschnitt- und Anschnittbereiche, Farbauftrag, Anzahl der Druckplatten und Seitenzahl, mit einem Urteil neben ihrer Überschrift. Sie blockiert nie einen Export. Design zeigt die Karte immer mit eigenen Prüfungen, darunter die Hausregeln des Designsystems Ebene für Ebene und das Schreibsignal für den Text des Dokuments ([Vor dem Export](/info/design.html#before-you-export)), und ergänzt diese Druckprüfungen, wenn **Print preflight** an ist. Schalten Sie in anderen Tools **Print preflight** unter Settings → Preferences → Feature flags ein; es ist standardmäßig aus, und eine Lolly-Work-Bereitstellung kann es für ihre Mitglieder einschalten.

**Nach dem Export.** Sobald die Datei fertig ist, liest Lolly sie zurück und vergleicht sie mit dem, was Sie gewählt haben: Format, Pixel- oder Seitengröße, Cliplänge, einen transparenten Hintergrund, CMYK-Farbe, HDR, Content Credentials und ein PDF- oder ZIP-Passwort. Alles, was abweicht, wird auf die Export-Karte geschrieben. Jede Messung stammt aus der Datei, nie aus der Einstellung, und eine Eigenschaft, die die Datei nicht beantworten kann, zählt nicht als Übereinstimmung. Die Kommandozeile schreibt den vollständigen Vergleich mit `--export-report` (siehe [Mit der CLI rendern](/info/cli-rendering.html)).

Die Inspektor-Prüfungen von Design und der Markenvergleich in Design System Setup sind getrennte Prüfungen: Sie betrachten das Design, während diese beiden Karten die Datei betrachten.

::: details Kosten aus einer Preisliste
Unterhalb des Preflights wandelt eine Kostenkarte dieselben Zählwerte in Geld um, mit ausschließlich Preisen, die jemand geliefert hat. Sie liest diese Zählwerte auch dann, wenn die Preflight-Karte selbst aus ist. Sie braucht zwei Dinge: einen Auftrag, den eine Preisliste bewerten kann (Platten, Bogen, Fläche, Seiten, Variantenzeilen oder Ausgabedateien, sodass ein einfaches Logo-PNG sie nie zeigt) und eine **Preiskarte**, eine JSON-Preisliste Ihrer Druckerei. Ein Standard-Build bringt keine mit und hat keinen Weg in der App, eine zu laden. Eine Preiskarte kommt als Katalog-Asset, das eine Bereitstellung ausliefert, oder über die optionale Preiskarten-Erweiterung, die ein Selbsthoster oder eine Steuerungsebene einschaltet. Ohne Preiskarte wird nichts gezeigt.

Jede Zahl ist ein von Ihnen gelieferter Preis mal einer von Lolly gezählten Menge, etwa `4 plate × €35.00`, und die Summe trägt ihre Quelle: den Aussteller auf der Karte und das Datum, aus dem ihre Preise stammen. Es gibt keine Standardwährung und keinen Platzhalterpreis. Was die Datei über sich selbst sagt, bleibt indirekte Rede: *"The file says: … Lolly has not verified this."*

Wenn sich eine Zahl nicht berechnen lässt, wird die Tabelle zurückgezogen, statt aufgefüllt zu werden:

- Zeilen, die die Karte nicht bepreist, bedeuten **gar keine Summe**, nur eine Überschrift, die sagt, wie viele unbepreist sind.
- Eine Menge, die eine Obergrenze ist, trägt **"up to"** in ihre Zwischensumme.
- Preise nach ihrem Gültig-bis-Datum zeigen **nur Zählwerte**, bis Sie *Use these rates anyway* drücken; das Ablaufdatum reist dann mit der Zahl.
- Wird sie über einen **Link** geöffnet, bleibt Geld verborgen, bis Sie es auf diesem Gerät verlangen. Die CLI nimmt `--rate-card=<file.json>` als lokale Datei und nie als Link-Parameter.

Die Karte wird aus jeder Export-Stufe entfernt und ändert daher nie die Datei. Sie ist Rechnerei, kein Angebot; nur Ihre Druckerei kann ein Angebot machen.
:::

## Bewegung und Ton

### Video

Animierte Tools exportieren **MP4** und **WebM**. Die Auswahl zeigt nur die Container, die dieser Browser erzeugen kann, und ein geteilter Link `?format=`, der einen verlangt, den er nicht erzeugen kann, fällt auf den anderen zurück, mit passendem Dateinamen. Animierte Tools bieten außerdem **Start after**, das die Arbeitsfläche einen Moment ruhig hält, damit sich Animationen und Schriften vor der Aufnahme setzen, und **Duration**, die Länge des fertigen Clips. **Motion blur** (Off, Draft quality, Standard oder High, mit einem **Shutter angle**) verwischt schnelle Bewegung auf Kosten der Renderzeit. Wo der Browser es unterstützt, zeichnet **Record live** die Vorschau auf dem Bildschirm stattdessen in Echtzeit über eine Bildschirmfreigabe auf.

![Die Timing-Einstellungen für einen animierten Export: Start after, Duration, Motion blur mit seinem Shutter angle und Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** wählt Smaller file, Balanced oder Best quality. **Advanced** öffnet **Codec**, **Frame rate**, **Rate mode** und **Hardware acceleration**. Wo ein Tool Untertitel hat, wählt **Captions** eine **Embedded track** oder eine **Sidecar .vtt + .srt** neben dem Video. Ein Link trägt Qualität, Codec, Bildrate, Dauer und Startverzögerung als `vq`, `codec`, `fps`, `seconds` und `wait` ([URL-Parameter](/info/url-parameters.html)).

Video-Exporte behalten ihren Ton. Ein Tool kann ein **Musikbett** unter den Clip legen: ein Audio-Asset, in Schleife oder auf die Cliplänge gekürzt, mit Ein- und Ausblendungen, Lautstärke und Ducking unter dem eigenen Ton des Materials. Die Aufnahme-Tools tragen ihr Live-Audio bis in die Datei.

Ein Design-Deck, das ein Klick-Deck bleibt, kann trotzdem als Video hinausgehen. **Export slides as video** im Menü Present öffnet das Export-Blatt auf MP4. Jede Folie läuft ihre eigene Verweildauer oder, wenn sie keine hat, die Duration des Export-Blatts, und der Folienübergang des Decks läuft zwischen ihnen als Überblendung. Das Dokument selbst ändert sich nicht.

### Animierte Bilder

**GIF** läuft überall und eignet sich für Chat und E-Mail; es ist größer und hat weniger Farben als Video. **APNG** und **Animated WebP** behalten volle Farbe und Transparenz. **Lottie Ad** exportiert auch **Animated SVG**: Vektor-Frames mit eingebetteten CSS-Keyframes, sodass es auf jede Größe skaliert und in einem Browser-Tab oder einem `<img>` ohne Codec in Schleife läuft. Sein Text ist in Umrisse umgewandelt, und es nutzt eine niedrigere Standard-Bildrate, weil jedes Bild schwerer ist als ein Bitmap. Alle diese sind stumm.

### Audio

Manche Tools exportieren Ton für sich. **Voice Recorder** nimmt einen Mikrofon-Take mit Live-Pegelanzeige auf und speichert ihn als **MP3**, **WAV**, **M4A (AAC)** oder **Opus (WebM)**, auf Ihrem Gerät kodiert. `wav`, `mp3`, `m4a` und `opus` sind gewöhnliche Format-IDs, sodass ein Audio-Export so teilbar und skriptbar ist wie ein PNG.

Die Asset-Auswahl akzeptiert eine breite Palette von Audio für ein Musikbett, von MP3 und FLAC bis zu MIDI und Tracker-Modulen; [Formate](/info/formats.html) listet sie auf. Ein [Rondocode-Song](/info/rondocode.html) läuft in der Länge, die sein Clip verlangt.

## Farbe und HDR

Lolly liest jede moderne CSS-Farbe, führt seine Farbmathematik wahrnehmungsbasiert aus und schreibt jede Datei in einem Farbraum, den ein Leseprogramm öffnen kann: sRGB für Bildschirme, CMYK für Druck und Rec.2100 PQ für HDR. [Farbe in der Engine](/info/colour-engine.html) erklärt, wie. Ein Design-Dokument, das auf **Wide colour / HDR** gesetzt ist, folgt eigenen Regeln, beschrieben in [Weite Farbe und HDR-Bearbeitung](/info/hdr-editing.html).

### Farbprofile

Exporte werden mit einem Farbprofil markiert, sodass farbverwaltete Apps wie Druckereien, Photoshop und Browser die Farben so lesen, wie Sie sie gesehen haben. Das geschieht automatisch; Vorschaubilder und Vorschauen überspringen die Markierung, um klein zu bleiben.

- **PNG und JPG** tragen ein eingebettetes ICC-Profil **sRGB**, den Raum, in dem die Vorschau gezeichnet wird. Die Pixel werden markiert, nicht neu kodiert.
- **Print PDF (CMYK)** deklariert seine Druckbedingung in seinem *OutputIntent* und sagt einer Druckerei, wie seine CMYK-Farben gelesen werden sollen.
- **Print TIFF (CMYK)** schreibt nicht markierte DeviceCMYK-Pixel und hält die Druckbedingung in seinen TIFF-Metadaten fest. Ein TIFF kann kein Druckprofil einbetten, sodass eine Zeile **Embed** nur den Namen dieses Profils festhält.
- **TIFF (RGB)** ist das unkomprimierte sRGB-Geschwister für Archiv oder einen Round-Trip mit einem Editor. Es verflacht Transparenz auf Weiß. Beide TIFFs gibt es nur auf dem Desktop, weil Browser kein TIFF in der Vorschau zeigen können.
- **SVG**, **EMF**, **EPS** und **DXF** sind Vektoren ohne eingebettetes Profil: Die Farben von SVG sind sRGB, EMF und EPS nutzen Geräte-RGB, **EPS (CMYK)** schreibt DeviceCMYK, und DXF nutzt den AutoCAD Color Index. SVG, EPS und DXF wandeln Text in Pfade um. EMF hält Text in Office und Google Folien live und bearbeitbar und fällt nur bei Textläufen, die das Format nicht ausdrücken kann, auf Umrisse zurück; die Option **Outline fonts** des Export-Panels erzwingt überall Pfade. SVG gibt außerdem CSS-Box-Schatten wieder, innen und außen.

::: details PDF/X-4 und Ihr eigenes Druckprofil
Mit Lolly wird kein CMYK-Profil ausgeliefert. Eine benannte Druckbedingung schreibt den Output Intent, ohne PDF/X-4-Konformität zu behaupten, weil PDF/X-4 das eingebettete Profil verlangt.

Laden Sie ein eigenes CMYK-Profil und wählen Sie seine Zeile **Embed** im Steuerelement Colour profile. Es wird als *DestOutputProfile* der Datei eingebettet, und das PDF beansprucht PDF/X-4, wann immer der Rest der Datei es erlaubt. Die Druckbedingung, die es deklariert, wird aus diesem Profil gelesen: ein registrierter Name, wo das Profil einen belegt, oder `Custom` unter dem eigenen Namen des Profils.

Drei Dinge halten den Anspruch zurück und behalten den Output Intent: RGB-Grafik, die der CMYK-Durchlauf nicht umrechnen konnte, der Credit-Text `prov` im Beschnittrand (in einer Standardschrift gezeichnet, die nicht eingebettet ist) und ein **Strong**-Passwort, da PDF/X-4 Verschlüsselung verbietet. Jedes PDF trägt außerdem PDF/X-4-Metadaten: Seitenboxen, XMP, eine Dokument-ID und einen sRGB-Output-Intent mit seinem Profil.
:::

### HDR (leuchtende Farben)

Das ist die Karte **HDR** des Export-Panels, die gewöhnliche Grafik für HDR-Bildschirme aufhellt. HDR-Originale durch die Bearbeitung zu behalten ist eine andere Funktion: [Weite Farbe und HDR-Bearbeitung](/info/hdr-editing.html).

Ein gewöhnlicher Export ist sRGB: Eine gesättigte Markenfarbe ist so hell wie das normale Weiß des Bildschirms. Ein HDR-Display hat darüber Spielraum. Die Karte **HDR** hebt Ihre Markenfarben und weißen Text in Richtung Spitzenhelligkeit, während dunkle Bereiche dunkel bleiben und dem Leuchten seinen Kontrast geben.

![Die HDR-Karte im Exportbereich, eingeschaltet, mit den darunter sichtbaren Reglern Weiß / Reichweite / Dunkelaufhellung / Fokus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formate.** PNG, JPG, AVIF und TIFF. WebP ist 8-Bit ohne funktionierenden HDR-Dekodierpfad, und Vektoren und PDF haben kein HDR-Modell.
- **Standardmäßig aus**, weil es die Pixel ändert. Kreuzen Sie die Karte an oder übergeben Sie `hdr=1` in einem Share-Link.
- **Die Regler.** **White** (die Obergrenze der Spitzenhelligkeit, 400 bis 2000 Nits), **Reach** (wie weit das Leuchten in die Tonwerte hinabreicht), **Dark lift** (wie stark die Dunklen aufhellen; `0` hält sie dunkel) und **Focus** (wie viel Farbfülle die Anhebung behält). Sie reisen als ein Wert: `hdr=1600-60-0-50` ist White 1600, Reach 60, Dark lift 0 und Focus 50.
- **Was geschrieben wird.** PNG erhält 16-Bit-Rec.2100-PQ mit einem `cICP`-Chunk. JPG ist ein Gain-Map-JPEG nach ISO 21496-1: ein gewöhnliches SDR-Bild plus eine angehängte Gain Map. AVIF erhält eine neu geschriebene `colr`-Box. TIFF erhält PQ-Pixel mit einem erzeugten ICC-v4-Profil mit einem `cicp`-Tag und verflacht auf Schwarz, weil Weiß in PQ der 10.000-Nit-Code ist und jede Kante mit einem Halo umgeben würde. Die Anhebung folgt der wahrnehmungsbasierten (OKLab) Helligkeit und behält den Farbton, sodass ein Markengrün heller wird, nicht minzig.
- **Wo das Leuchten sichtbar ist.** Farbverwaltete Betrachter auf einem HDR-Display: Vorschau, Übersicht und Safari auf Apple-Geräten oder Chrome auf einem HDR-Monitor. Ein SDR-Bildschirm zeigt ein normales Bild.
- **Bevor Sie ausliefern.** Viele Plattformen kodieren Uploads neu und entfernen das HDR-Signal, wodurch das Bild dunkel oder blass werden kann. Nutzen Sie HDR dort, wo Sie das Ziel kontrollieren, etwa auf Ihrer eigenen Website, einer Videowand oder einem Deck auf einem hellen Display.
- **Vom Terminal.** `--hdr=1` mit `--export=png` oder `--export=jpg` schreibt dasselbe PNG und Gain-Map-JPEG in der [CLI](/info/cli.html), aus denselben Engine-Encodern, ohne Browser im Weg. AVIF und TIFF bleiben vorerst Web-Exporte.

## Was mit Ihrer Datei mitreist

Eine fertige Datei kann neben dem Bild mehrere Aufzeichnungen tragen. Manche reisen neben den Pixeln und verschwinden, wenn die Datei neu gespeichert oder bereinigt wird; zwei Markierungen leben in den Pixeln selbst.

::: figure exporting-what-travels
Wo jede Aufzeichnung liegt, ob sie standardmäßig an ist und welcher Link-Parameter jede steuert.
:::

Das Export-Panel fasst **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, das **Lolly Imprint** und das **Durable credential** in einer Gruppe **Content protection** zusammen, die nur die Karten zeigt, die das gewählte Format nutzen kann. Sie öffnet sich von selbst, wenn ein Link oder Dokument bereits eine Lizenz deklariert oder wenn eine Quelle eine Entscheidung von Ihnen braucht. Die Karte **Design system** bleibt außerhalb der Gruppe und ist bei jedem Export sichtbar.

![Die Content-protection-Gruppe geöffnet bei einem PNG-Export, mit nur den zutreffenden Karten](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Herkunft und Wasserzeichen

Wo das Format die Felder hat, tragen Exporte **Herkunfts-Metadaten**: die Software, die Quelle, den Namen des Tools und Ihre Urheberzeile aus dem Profil, geschrieben in PNG-iTXt, JPEG-EXIF, PDF-Info, SVG-`<metadata>` oder einen GIF-Kommentar. Sie hält nur die Urheberschaft fest, und nichts wird hochgeladen. **Experimentelle** Tools prägen außerdem ein sichtbares Wasserzeichen auf, das der Host anwendet, damit die Bearbeitung des Tools die Markierung nicht entfernen kann.

**Das Lolly Imprint** ist ein unsichtbares Pixel-Wasserzeichen, **standardmäßig an**. Das Credential und die Metadaten reisen neben den Pixeln und gehen bei einem erneuten Speichern, einem Screenshot oder dem Entfernen der Metadaten verloren. Das Imprint lebt in den Pixeln und überdauert eine Neukomprimierung, sodass eine Kopie weiterhin als mit Lolly erstellt erkannt werden kann. Es ist ein Hinweis, keine kryptografische Garantie, und es trägt keine personenbezogenen Daten. Es steckt in JPEG XL, PNG, JPG, WebP, AVIF, TIFF und BMP sowie in den Rastern, die Lolly in ein PDF oder PPTX rendert, nie in einem Bild, das Sie eingebettet haben. Entfernen Sie das Häkchen bei **Lolly Imprint** oder übergeben Sie `imprint=0`, um das Imprint wegzulassen. Das Überleben von AVIF bei der Neukodierung ist noch nicht kalibriert. [Verify](/verify) erkennt es auf Ihrem Gerät; siehe [Das Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Das Durable credential** schreibt Lollys ID mit einem neuronalen Modell auf dem Gerät im Format TrustMark in die Pixel, sodass der Link "mit Lolly erstellt" das Entfernen von Metadaten und eine Neukodierung überdauert und von TrustMark-fähigen Tools gelesen werden kann. Es ist **standardmäßig aus**, weil es pro Export einen neuronalen Durchlauf und einen einmaligen Modell-Download kostet. Es deckt PNG, JPG, WebP, AVIF und TIFF ab; kreuzen Sie es im Panel an oder übergeben Sie `durable=1`. Die Desktop- und Mobil-Apps blenden die Karte aus, weil sie offline keinen Origin haben, von dem sie das Modell holen könnten.

**Lizenz.** Wählen Sie, wie andere Ihre Arbeit nutzen dürfen: standardmäßig *None (all rights reserved)*, CC0 1.0, die Public Domain Mark 1.0 oder eine Creative-Commons-4.0-Lizenz (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Der Lizenzname und ein Link zu ihrer Kurzfassung gehen in die Lizenz-Metadaten der Datei (EXIF, XMP und RIFF, wo das Format sie hat) und in ihr Content Credential. Die Wahl wird mit dem Dokument gespeichert und reist in einem Link als `licence=`. Lolly schreibt die Lizenz, die Sie gewählt haben; es prüft oder erzwingt die Bedingungen nicht. Ein Tool mit eigenem Lizenzfeld, etwa Claim, behält stattdessen dieses Feld.

### Der Designsystem-Eintrag

Ein Export hält das Designsystem fest, das die Datei erstellt hat: seinen Namen, die veröffentlichte Version, aus der es gezeichnet wurde (wenn das nicht die Arbeitsversion ist), und die [Farbvariante](/info/colourways.html), in der es gezeichnet wurde. Jede andere Design-Wahl, die ein Designsystem deklariert, etwa eine Dichte, wird auf dieselbe Weise festgehalten. Die Wahl hell oder dunkel bleibt weg, weil das Bild schon zeigt, welche genutzt wurde.

**Sie sehen den Eintrag, bevor etwas geschrieben wird.** Die Karte **Design system**, standardmäßig angekreuzt, zeigt den genauen Wortlaut, den die Datei tragen wird, etwa *Records: Acme · Colourway: Beach*, und die Beschreibung, wie sie lauten wird. Der Name eines Designsystems ist, was seine Verantwortlichen getippt haben, und die Karte zeigt ihn wie geschrieben. Entfernen Sie das Häkchen der Karte, um den Eintrag aus diesem Export wegzulassen. Das Dokument-Panel von Design listet denselben Wortlaut unter *Embedded in exports*.

**Die Beschreibung nennt die Farbvariante neben dem Tool.** Bei angekreuzter Karte wird aus *"Made with https://lolly.tools : Chart"* *"Made with https://lolly.tools : Chart (Beach colourway)"*. Der eigene Name des Designsystems bleibt im Eintrag, nicht in der Beschreibung. Eine Beschreibung ohne Tool-Namen oder eine, die ein Tool aus seinen eigenen Eingaben schreibt, bleibt, wie sie ist. Ein Tool, das Farbvarianten über `tokenAxes` ignoriert, hält keine fest, und der PDF-Proof-Credit (die Druckmarke `prov`) folgt derselben Regel.

**Marken-Skills, die einen Agenten geleitet haben.** Wenn ein Agent das Werk erstellt hat und die [Marken-Skills](/info/brand-skills.html) nannte, die er gelesen und befolgt hat, listet der Eintrag zusätzlich jeden Skill mit seiner Revision, etwa *Guided by: acme-brand 1.0*. Die Worte bedeuten, dass der Skill die Arbeit geleitet hat. Sie sind keine Prüfung: Lolly testet das Werk nicht gegen einen Skill. Nur die eigene Aussage des Agenten fügt die Liste hinzu, was heute das Argument `brandSkills` von `lolly_render` des [MCP-Servers](/info/mcp.html) bedeutet, sodass ein Werk aus der App oder aus einem Share-Link keines trägt. Das Content Credential hält die Liste als `brandSkills`, ein JSON-Wert mit ID, Name, Revision und SHA-256-Hash jedes Skills. Das XMP-Paket und die SVG-Metadaten halten denselben Wert als `lolly:BrandSkills`, ein aus dem Eintrag geschriebenes PDF erhält pro Skill ein Schlüsselwort, und die Beschreibung bleibt, wie sie war. Ein interner Skill wird mit ID, Name, Revision und Hash festgehalten, nie mit seinem Text. Dieselben Schalter lassen die Liste mit dem Rest des Eintrags weg: die Karte **Design system**, `_madewith=0`, `--no-madewith` und `madeWith: false`. Zeichnet der MCP-Server die Datei in einem Browser (ein PDF, ein JPEG und die anderen Formate, die sein browserfreier Pfad nicht schreiben kann), enthalten die eigenen Metadaten der Datei keine Liste, und nur ein Content Credential kann eine halten. Übergeben Sie `c2pa`, um den Eintrag zu behalten; ohne Credential warnt das Rendering, dass die Marken-Skills nicht festgehalten wurden.

**Den Eintrag zurücklesen.** [Verify](/verify) listet den Eintrag als **Design system** in den Credential-Details einer Datei und alle Marken-Skills als **Guided by**. *Recreate with these settings* öffnet das Tool in der festgehaltenen Version und Farbvariante erneut. Der Link öffnet sich mit dem festgehaltenen Designsystem, wenn dieses Gerät eines mit derselben ID und demselben Namen hält; sonst öffnet er sich mit Ihrem aktiven Designsystem.

::: details Was wo geschrieben wird und welche Läufe den Eintrag weglassen
| Wo | Was geschrieben wird |
|---|---|
| Content Credential | `designSystem` (die ID), `designSystemLabel`, `designVersion` und `themes` in der Assertion `tools.lolly.export`, jeweils ein einfacher Textwert; `themes` ist eine JSON-Liste der Wahlen |
| PNG, JPEG, WebP und JXL | Dieselben vier Werte als `lolly:`-Eigenschaften des XMP-Pakets der Datei, im Namespace `https://lolly.tools/ns/export/1.0/` |
| SVG | Dieselben `lolly:`-Eigenschaften im Block `<metadata>` |
| PDF | Schlüsselwörter wie *Design system: Acme* und *Colourway: Beach* |
| Jedes Format mit einem Beschreibungsfeld | Die Beschreibung, mit der Farbvariante neben dem Tool |

Die Karte erscheint nur, wenn es etwas festzuhalten gibt und das Format den Eintrag halten kann. CSV, JSON, eine Kalenderdatei und andere Text- oder Datenformate halten keine Metadaten, und EPS, EMF, DXF und BMP haben kein Feld für den Eintrag. HTML, Markdown und CSS halten den Eintrag nur in ihrem Content Credential, sodass die Karte für sie keine Beschreibungszeile zeigt und sich ausblendet, solange **C2PA Credentials** aus ist. Ein Feld, das das Designsystem nicht liefert, bleibt aus der Datei.

Ein Share-Link schaltet den Eintrag mit `_madewith=0` ab ([URL-Parameter](/info/url-parameters.html)); die Kommandozeile nimmt `--no-madewith`, `lolly_render` des [MCP-Servers](/info/mcp.html) nimmt `madeWith: false`, und das Export-Panel der Terminal-App hat eine Zeile **Design system**. Die Kommandozeile gibt den Wortlaut, den eine fertige Datei trägt, auf der Standardfehlerausgabe aus, für ein Tool-Rendering und für jede Datei, die `lolly run` aus einer gespeicherten Design-Sitzung exportiert, und ein MCP-Rendering gibt ihn neben der Datei aus, beides aus der Datei zurückgelesen. Ein PNG, das die Kommandozeile ohne Browser zeichnet, trägt keine Datei-Metadaten, sodass sein Eintrag allein im Credential reist. Utilities auf dem Gerät fügen gar keine Metadaten hinzu.

Läufe ohne Karte **Design system** lassen den Eintrag weg: ein Batch-Lauf, ein aus Projects exportierter Ordner und ein 3D-Sammlungsexport, in der Terminal-App ein CSV-Batch, ein Export eines Projects-Ordners oder einer Auswahl und die Ansicht "alles rendern". Exportieren Sie eine Datei aus dem Tool, um das Designsystem festzuhalten.
:::

### Content Credentials (C2PA)

Exporte können **Content Credentials** tragen: ein signiertes [C2PA](https://c2pa.org)-Manifest, das festhält, was die Datei erstellt hat, wann und wo, gebunden an einen Hash der Bytes der Datei, sodass jede spätere Änderung erkennbar ist. Die Spezifikation wird von der C2PA veröffentlicht, und Lolly schreibt Standardmanifeste, die jeder C2PA-Leser prüfen kann.

![Die Karte C2PA Credentials, angekreuzt, mit der Gültigkeitsdauer des Credentials neben dem Kästchen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Standardmäßig an.** Die Karte **C2PA Credentials** ist bei fast jedem Tool vorausgewählt. Entfernen Sie das Häkchen für einen Export oder übergeben Sie `c2pa=off` in einem Link. Ein Tool kann sich in seinem Manifest abmelden.
- **Formate.** PDF (RGB und Print), PNG und APNG, JPG, GIF, SVG, TIFF (RGB und Print), WebP (Standbild und animiert), AVIF, MP4, WebM, die Audio-Container MP3, WAV, M4A, OGG/Opus und FLAC sowie HTML, Markdown und CSS. Ein ZIP stempelt jedes unterstützte Mitglied, womit auch ein Animated SVG eines erhält. MP4, AVIF und M4A nutzen die BMFF-Standardbindung und MP3 seine ID3v2-Zuordnung, sodass `c2patool` und andere Leser sie verifizieren. WebM und OGG/Opus haben noch keine Standardzuordnung, daher trägt Lolly das Manifest als Matroska-Anhang und als OpusTags-Feld, die Lollys eigener Verifizierer prüft. ICO, EPS, EMF, DXF, BMP, PPTX, die Office-Formate und die übrigen Text- und Datenformate haben keinen C2PA-Container.
- **Was es festhält.** Das Tool und die App, die die Datei erstellt haben, die Signaturzeit, die Shell, die sie exportiert hat, das [Designsystem und die Farbvariante](#the-design-system-record), solange die Karte **Design system** angekreuzt ist, und Fingerabdrücke aktiver Eingaben. Eingabetext, an das Profil gebundene Felder, inaktive Steuerelemente, Browserversionen und Angaben zum Betriebssystem bleiben weg. Ihr Name und Ihre E-Mail-Adresse erscheinen nur dann als Autor, wenn **Use my details to create** unter Settings → Preferences → Your details an ist. Quellen, die ein Export platziert, reisen als Ingredients: [genannte Werke](#source-credits) wie Emoji und [Rondocode-Songs](/info/rondocode.html#songs-in-the-credential) in einem Video- oder Audioexport.
- **Was Empfänger sehen.** C2PA-Tools wie Adobe-Apps, `c2patool` und contentcredentials.org/verify lesen das Manifest und zeigen die Aussage. Lolly signiert mit einem Schlüssel, der auf Ihrem Gerät entsteht, nicht mit einem Zertifikat aus einer Vertrauensliste, sodass Betrachter ein *unverified* Credential melden: Die Struktur und der Manipulationsnachweis sind echt, für den Unterzeichner wird nicht gebürgt. Um das zu ändern, registrieren Sie eine **verifizierte Identität** unter Settings → Preferences → Content Credentials; siehe [Content-Credentials-Identität](/info/content-credentials-identity.html).
- **Eine Datei prüfen.** Legen Sie eine beliebige Datei auf [Verify](/verify) ab oder führen Sie `lolly validate <file>` aus, für einen Bericht auf dem Gerät, der damit beginnt, ob Lolly die Datei erstellt hat und ob sie sich seither verändert hat. Verify sieht auch über das Credential hinaus; siehe [Was Verify prüft](/info/what-verify-checks.html).
- **Datenschutz.** Der Signaturschlüssel entsteht für den Export und verlässt Ihr Gerät nie, und die Aussage enthält nur, was die Herkunfts-Metadaten ohnehin tragen. Datenschutz-Utilities, die Ihre eigenen Dateien umwandeln, fügen kein Credential hinzu, und *Strip Hidden Data* entfernt ein C2PA-Manifest wie alle anderen Metadaten. Das Utility Rondocode erzeugt neues Audio und signiert daher, was es schreibt ([Rondocode-Songs](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Wechselwirkungen.** Ein passwortgeschütztes PDF kann in keiner Stufe Content Credentials tragen. Das Credential wird zuletzt hinzugefügt, über die fertigen Bytes, nach DPI, EXIF, Farbprofil, PDF/X-Metadaten und Druckmarken.

### Quellen-Credits

Ein Export, der die Arbeit anderer platziert, hält diese Quelle im Credential fest. Ein Emoji aus dem gewählten Emoji-Set ist der Alltagsfall: Das Werk, seine Urheberin, die Lizenz, woher die genauen Bytes stammen und was geändert wurde, reisen alle mit der Datei. Text in einem Tool, dessen Vorlage eine SVG ist, behält die Emoji des Systems, sodass dort nichts genannt wird. Die Zeile **Source credits** sagt vor dem Download, was die Quellen von der Auslieferung verlangen, und liest nach dem Download die gelieferten Bytes zurück, bevor sie sagt, dass die Credits in der Datei stehen. Eine Lizenz, die Sie wählen lässt, etwa ein umgefärbtes CC-BY-SA-Zeichen, das Sie teilen wollen, erhält eine Karte mit den Optionen; der Download wird nie blockiert. [Kreativrechte und Credits](/info/creative-rights.html) hat den Wortlaut, die geprüften Lizenzen und was Ihnen bleibt.

## Passwortschutz

Zwei Arten von Sperre, beide auf Ihrem Gerät erzeugt. Die Karte *Password protect* des Export-Panels steuert beide.

![Die Passwortschutz-Karte aufgeklappt bei einem PDF-Export, mit dem Passwortfeld und den beiden Sicherheitsstufen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Ein PDF-Öffnungspasswort** hat zwei Stufen, sobald Sie ein Passwort tippen:

- **Weak**: 40-Bit-RC4, eher Abschreckung als Schutz. Sein Passwort kann im Klartext in einem Share-Link reisen. Nur RGB-`pdf`.
- **Strong**: AES-256 (PDF 2.0). Beim Export getippt und nie in einen Link gelegt. Es gilt auch für Print PDFs und für jedes PDF in einem Batch-ZIP. Ein mit Strong gesperrtes Print PDF behält sein CMYK, die Marken und den Output Intent, verliert aber den PDF/X-4-Anspruch.

**Ein gesperrtes ZIP** deckt einen ZIP-Export, einen Ordner-Download aus Projects oder einen Batch ab, mit einem Passwort in zwei Stufen: **Weak** (ZipCrypto, Abschreckung; es kann in einem Link `?password=` reisen) oder **Strong** (AES-256, beim Export getippt, nie in einem Link). Das Passwort schützt jedes Mitglied, und jedes PDF darin ist zusätzlich mit AES-256 für sich gesperrt, sodass es nach dem Entpacken des ZIPs gesperrt bleibt. Die Eingabeaufforderung erscheint, wenn der Download beginnt; ein leeres Passwort bedeutet keine Sperre.

**Ein passwortgeschützter Share-Link** fragt die Empfängerin oder den Empfänger vor dem Öffnen nach einem Passwort. Der ganze Link-Zustand wird mit AES-256 unter einem aus dem Passwort abgeleiteten Schlüssel (PBKDF2) verschlüsselt, sodass nur Chiffretext reist und die Entschlüsselung im Browser der Empfängerin oder des Empfängers geschieht. Der Server, der den Link ausliefert, sieht nie das Passwort oder das Design. Schalten Sie es im Dialog **Share** ein. Ein verschlüsselter Link öffnet sich nur in Lolly, nie als eingebettetes Bild. Siehe [URL-Modus](/info/url-mode.html).

## Auf einem Smartphone

Die Export-Steuerelemente liegen hinter der schwebenden Schaltfläche **Export**, die das Blatt **Export** öffnet: dieselben Formate, Größe, Kopieren, Download und Teilen, für Touch bemessen.

## Format-IDs für Links und die CLI

Das sind die Werte für den URL-Parameter `format=` und das CLI-Flag `--export=` (siehe [URL-Parameter](/info/url-parameters.html) und [CLI](/info/cli.html)). Das Menü eines Tools zeigt nur die Formate, die das Tool erzeugen kann, und ist daher immer kürzer als diese Liste.

| Art | IDs |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB-TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (gzippte SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (Schneidedatei) |
| Seite und Dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (Penpot-Designdatei) · `scorm` (Kurspaket, ein ZIP) |
| Bewegung | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Audio | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Text und Daten | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (GIMP-Palette) |
| Bundles und Pakete | `zip` · `rpm` und `tar.gz` (das Rendering, in ein Linux-Paket versiegelt) |

Einige IDs stammen aus dem eigenen Export-Code eines Tools: `ase` (Adobe Swatch Exchange, aus Palette Lab) sowie `exr` und `hdr` (Raster mit hohem Dynamikumfang, aus Darkroom). **Convert Font** schreibt `ttf`, `otf` und `woff` aus einer Schriftdatei, die Sie liefern, sodass ein bloßer Link nichts zu rendern hat.
