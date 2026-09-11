# Exportieren & Formate

Wie man eine fertige Datei aus einem Tool herausbekommt - das richtige Format wählen, die Ausgabegröße festlegen und was jede Option bewirkt. Wie alles andere findet der **Export auf Ihrem Gerät** statt; es wird nichts hochgeladen.

## Wie der Export funktioniert

Die Vorschau *ist* die Datei. Beim Export rendert der Host diese Zeichenfläche in das gewählte Format und übergibt Ihnen einen Download (oder legt ihn in Ihre Zwischenablage). Ein Tool bietet nur die Formate an, die sein Autor deklariert hat, und der Auswähler blendet jedes aus, das Ihr Browser nicht erzeugen kann (siehe [Video](#video)).

Drei Wege erzeugen eine Datei. Die meisten Tools **rendern die Zeichenfläche** in das gewählte Format. Text- und Datenformate (HTML, MD, TXT, JSON, CSV, ICS, VCF) werden stattdessen **aus dem Inhalt des Tools generiert**, nicht aus dem Bild gerastert. Und Datenschutz-Werkzeuge (z. B. *Versteckte Daten entfernen*) nutzen einen dritten Weg: Die Datei, die *Sie* auswählen, wird byteweise auf dem Gerät transformiert und direkt zurückgegeben - keine Zeichenfläche, kein Wasserzeichen und keine hinzugefügten Herkunftsmetadaten, weil es bereits Ihre eigene Datei ist.

Die Aktionen in den Exportsteuerelementen:

- <!--i:download--> **Download** - die Datei speichern (die Hauptaktion).
- <!--i:photos--> **Kopieren** - das Bild in Ihre Zwischenablage legen, um es direkt in Slack, E-Mail oder ein Dokument einzufügen. Kann ein Browser keine Bilder kopieren, lädt er stattdessen herunter und sagt Ihnen das.
- <!--i:folder--> **Speichern** - das aktuelle Design als gespeicherte Tool-Sitzung in Ihrer Bibliothek behalten.
- <!--i:link--> **Teilen** - öffnet den **Dialog Teilen**: einen kopierbaren Link, der das Design reproduziert, Umschalter beim Besuch (Vollbild, Exportpanel, Download- oder Kopieren-beim-Öffnen) und einen optionalen **Kürzesten Link**, der den gesamten Zustand in ein kompaktes Token packt (siehe [URL-Modus](/info/url-mode.html)).

(Welche davon erscheinen, wählt der Autor eines Tools; die Standardauswahl ist Kopieren, Download und Speichern.)

![Das Exportpanel - Format, Größe und die Aktionen Kopieren / Download / Speichern / Teilen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Teilen öffnet sich über dem Tool, mit dem bereits erstellten Link und den Umschaltern beim Besuch darunter.

### Mehrere auf einmal rendern

Ein einzelner Export ist eine Datei, aber Sie können in einem Durchgang **viele** rendern - jede als ein `.zip` geliefert:

- <!--i:folder--> **Projekte → Ordner rendern** exportiert jede gespeicherte Sitzung in einem Ordner (und seinen Unterordnern) als ein verschachteltes Zip; **Auswahl rendern** tut dasselbe für jede Mehrfachauswahl; eine einzelne gespeicherte Sitzung rendert direkt in ihre eigene Datei. Kein Batch/Pro nötig - siehe [Lolly benutzen → Projekte](/info/using.html).
- <!--i:layers--> **Batch (Pro)** rendert ein Raster von Eingabesätzen - jede Variante einer Vorlage auf einmal.

Eine gespeicherte Sitzung kann auch aus Projekte erneut als Tool-Link geteilt werden (er rekonstruiert die Tool-URL aus den gespeicherten Eingaben), sodass ein Link es mit exakt denselben Einstellungen wieder öffnet.

## Ein Format wählen

Das Dateinamensfeld und der Format-Auswähler sitzen oben im Panel als ein Paar `name.format`, und der Auswähler listet nur die Formate, die der Autor dieses Tools deklariert hat.

![Das Dateinamensfeld mit dem Format-Auswähler verschmolzen, sodass der Export als ein Paar name.format erscheint](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Sie möchten… | Verwenden Sie | Warum |
|---|---|---|
| Scharfe Logos / Grafiken, die skalieren | **SVG** | Vektor - unendlich skalierbar, klein, bearbeitbar |
| Vektor für Office- / Windows-Anwendungen | **EMF** | Wird als bearbeitbarer Vektor in PowerPoint / Word eingefügt; Text bleibt lebendig und editierbar, und Google Drive öffnet es in Google Drawings für Slides |
| Vektor für Druck- / Designanwendungen | **EPS** oder **EPS (CMYK)** | PostScript-Vektor für Illustrator / Druckworkflows |
| Vektor für Schneid- / CAD-Maschinen | **DXF** | Laserschneider, Vinylplotter, CNC - Konturpfade in Millimetern |
| Eine bearbeitbare Präsentation | **PowerPoint** (PPTX) | Nativ bearbeitbarer Text und Formen, Bilder und Vektoren bleiben extrahierbar |
| Ein Kurs, den ein LMS importieren kann | **SCORM** (LMS) | Ein Zip mit Manifest, Startseite, den Folien und dem vertonten Film mit Untertiteln - aus einem Design-Deck |
| Ein bearbeitbares Textdokument | **Word** (DOCX) oder **OpenDocument** (ODT) | Echte Absätze und Überschriften, die ein Textverarbeitungsprogramm weiter bearbeiten kann (Doc Studio) |
| Ein Foto oder allgemeines Bild | **PNG** (verlustfrei) oder **JPG** (kleiner) | Universelles Rasterbild |
| Kleinere moderne Bilder | **WebP** / **AVIF** | Bessere Komprimierung, Alphakanal |
| Druck | **PDF** oder **Print PDF** (CMYK) | Echte Seitengröße; CMYK für den Druck |
| Druck-Raster für eine Druckerei | **Print TIFF** (CMYK) | DeviceCMYK-Pixel für einen RIP |
| Animiert fürs Web | **GIF** | Funktioniert überall, größere Dateien |
| Animiert mit Vollfarbe und echtem Alphakanal | **APNG** | Animiertes PNG - keine Palettenbegrenzung, echte Transparenz |
| Animiert, kleinste Datei | **Animiertes WebP** | Vollfarbe und Alphakanal, besser komprimiert als GIF oder APNG |
| Animierter Vektor, der skaliert | **Animiertes SVG** | In sich geschlossen; läuft in einem Browser oder `<img>` in Schleife, kein Codec, jede Größe |
| Video für Social Media / zum Teilen | **MP4** oder **WebM** | Bestes Qualität-pro-Byte-Verhältnis (siehe unten) |
| Rich Text / E-Mail-Signatur | **HTML** | Wird formatiert in Mailprogramme eingefügt |
| Reiner Inhalt | **MD** / **TXT** | Nur Text |
| Ein Kalendertermin | **ICS** | Wird in jede Kalender-App importiert |
| Eine Visitenkarte | **VCF** | Wird in Kontakte / Adressbücher importiert |
| Strukturierte Daten zum erneuten Import | **JSON** / **CSV** | Der Inhalt des Tools lässt sich damit hin und zurück übertragen |
| Ein Favicon | **ICO** | Website-Icon in mehreren Größen (**ZIP** bündelt mehrere Formate) |

Die erste Zeile ist der häufige Fall. Ein in Ihrer Markenschrift gesetztes Wortzeichen wird als SVG exportiert, wobei jeder Buchstabe ein umrissener Pfad statt eines Pixels ist, sodass es aus derselben Datei sowohl in Visitenkartengröße als auch in Gebäudewand-Größe scharf bleibt.

![Ein feines, weit gespurtes Wortzeichen mit der Aufschrift Aurora, die Art reiner Vektorgrafik, um die es in der SVG-Zeile der Tabelle geht](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Größe & Druckeinheiten

Standardmäßig verwenden Exporte die native Pixelgröße des Tools. Wo ein Tool **Maße** anbietet, können Sie Breite × Höhe und eine **Einheit** festlegen:

- **px** (Standard) - exakte Pixel.
- **mm · cm · in · pt · pc** - physische/Druckgrößen. Mit einer physischen Einheit legen Sie auch die **DPI** fest (Standard **300** für den Druck); die Engine rechnet je nach Format korrekt um - **PDF** wird zu einer echten Seite in dieser Größe, **Raster** rendert mit der richtigen Pixelzahl für die DPI (und bettet die Auflösung ein), **SVG** behält die physische Einheit mit einem px-viewBox.

Um ein höher aufgelöstes Raster zu erhalten, geben Sie eine größere Breite/Höhe ein, oder wählen Sie eine physische Einheit und erhöhen Sie die DPI (Pixel = Größe × DPI). Es gibt keinen Ein-Klick-Skalierungsschalter.

Beispiel: Breite `210`, Höhe `297`, Einheit `mm` → eine A4-Seite.

![Die Maßzeile auf 210 mal 297 mm gesetzt, mit dem DPI-Feld sichtbar, weil die Einheit physisch ist](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Standbilder aus einer zeitbasierten Komposition

Eine **zeitbasierte Komposition** - eine [Sequence](/info/using.html#timeline-sequence)-Timeline in Design oder ein beliebiges timeline-gesteuertes Artboard - ist etwas Bewegtes, daher muss ein Standbild-Export beantworten: "welcher Moment?". Die Regel ist die erwartbare: **das Bild an der Abspielposition**. Setzen Sie die Abspielposition auf das gewünschte Bild und exportieren Sie; was Sie sehen, ist, was herauskommt.

Wenn Sie mehr als einen Moment wollen, erscheint das Feld **Frames** neben der Ausgabegröße (nur bei einer zeitbasierten Komposition und nur bei einem Standbild-Format - PNG, JPG, WebP, SVG oder PDF). Lassen Sie es bei `1` für das Bild am Abspielkopf. Erhöhen Sie es, und Sie erhalten so viele Standbilder, in gleichen Abständen über die gesamte Sequenz abgetastet:

- **Raster und SVG** kommen als eine **Zip-Datei** zurück - `<name>-01.png`, `-02.png` und so weiter.
- **PDF** kommt als **ein einzelnes Dokument mit ebenso vielen Seiten** zurück.

Nützlich für ein Storyboard, ein Miniaturbild-Blatt, einen Kontaktabzug zur Durchsicht oder ein Social-Carousel, direkt aus einem Videoschnitt herausgeschnitten.

Die Abtastung erfolgt am **Mittelpunkt** jedes Intervalls statt an den Rändern, weil der erste Moment einer Sequenz oft eine Einblend-Transition ist, die noch nicht eingeblendet hat, und der letzte der Zustand nach dem Ende jedes Clips - eine Abtastung an den Endpunkten würde zwei Ihrer Frames an nahezu leere verschwenden. Die Anzahl ist auf **64** begrenzt (ein Kontaktabzug ist zum Lesen durch einen Menschen gedacht), und alles Unsinnige, das in das Feld eingegeben wird, fällt auf `1` zurück, statt den Export scheitern zu lassen. Jeder Frame ist ein gewöhnliches Standbild, sodass Content Credentials, der Imprint, physische Einheiten und DPI sich genau so verhalten wie bei einem einzelnen Export.

Das Feld **Frames** ist heute der Weg, um ein Blatt zu bekommen. Die Engine reserviert einen passenden URL-Parameter `cuts`, aber noch liest kein Shell ihn aus einem Link, sodass ein geteilter Link immer wieder auf dem Abspielkopf-Bild öffnet - siehe [URL-Modus](/info/url-mode.html#contact-sheets-cuts).

## Mehrseitiges PDF

Manche Tools erstellen ein **mehrseitiges PDF-Dokument** statt einer einzelnen Grafik - ein Deckblatt, Inhalte, die sich über so viele Seiten verteilen wie nötig, und eine Rückseite, alles in einer Datei (siehe das *Booklet*-Tool). Jede Seite ist eine **echte PDF-Seite**, passend zur Größe dieser Seite, sodass Leser und Drucker echte Seiten erhalten, kein einziges langes Bild.

- **Seiten aus Inhalt.** Fügen Sie Text- und Bildblöcke hinzu; neue Seiten entstehen automatisch, sobald sich die Blöcke füllen, und Sie können jeden Block dazu zwingen, eine neue Seite zu beginnen.
- **Echte Seitengrößen.** Wählen Sie A4, US Letter oder A5 (Hochformat - das zweispaltige Layout ist dafür ausgelegt) - jede Seite und das exportierte PDF werden exakt in dieser Größe gerendert.

Mehrseitige PDFs sind RGB-Dokumente und tragen keine Anschnitt-/Beschnittmarken - die gehören zum einseitigen **Print PDF**-Pfad oben. Sie tragen dieselben **PDF/X-4-Metadaten** wie jeder PDF-Export (Seitenboxen, XMP, Dokument-ID, ein sRGB-Ausgabeziel mit eingebettetem Profil) und bieten **Content Credentials** (unten) - beim *Booklet*-Tool ist die Option bereits vorausgewählt.

## Viele Dinge auf einmal erstellen

Lolly bietet drei unterschiedliche Wege, um in größerem Umfang zu arbeiten, und sie lösen unterschiedliche Aufgaben - Stapelbearbeitung ist eine fest verankerte Fähigkeit der Plattform, nicht etwas, das jedes Tool neu erfindet:

- <!--i:document--> **Ein Design × eine Tabelle mit Zeilen → ein mehrseitiges Dokument.** Tools mit einer `table`-Eingabe (wie *Battlecards*) verwandeln jede Zeile automatisch in eine Seite - fügen Sie eine Tabelle aus Ihrer Tabellenkalkulation ein und erhalten Sie ein PDF im Deck-Format. Ihr eigentlicher Stapel-Editor bleibt die Tabellenkalkulation: Korrigieren Sie dort zehn Zeilen und fügen Sie erneut ein. Das Tool selbst verwaltet niemals Seiten.
- <!--i:layers--> **Ein Design × eine Datendatei → viele separate Dateien.** Das `/pro`-Stapelraster nimmt eine CSV-Datei und rendert einen Export *pro Zeile* - Namensschilder, Zertifikate, jeweils eine Datei.
- <!--i:sliders--> **Viele verschiedene Assets, nebeneinander bearbeitet.** *Multi-edit* öffnet mehrere gespeicherte Sitzungen in einer Ansicht für koordinierte Anpassungen über unterschiedliche Designs hinweg.

Faustregel: Zeilen desselben Designs, die in **ein Dokument** gehören → ein tabellengesteuertes Tool; Zeilen, die als **separate Dateien** ausgeliefert werden müssen → `/pro`; **unterschiedliche Designs**, die dieselbe Anpassung brauchen → Multi-edit. (Eine geplante Renderoption "Medien kombinieren" wird die ersten beiden verbinden - Exporte im selben Format werden zu einem PDF, einem Video oder einem Kontaktabzug für die Prüfung zusammengeführt.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart und Diagrams können ein **PowerPoint-Deck** exportieren - eine Folie pro Seite. Es geht nicht um einen pixelgenauen Screenshot, sondern darum, einer Kollegin oder einem Kollegen ein Deck zu übergeben, das sie oder er tatsächlich **bearbeiten und aus dem sich Inhalte entnehmen lassen**. Deshalb wird jede Seite in native Objekte zerlegt:

- <!--i:font--> **Text** wird zu echten, **bearbeitbaren PowerPoint-Textfeldern** - mit Schriftgröße, Farbe, Schriftstärke, Kursivierung und Ausrichtung aus dem Layout - sodass Sie einen Tippfehler korrigieren oder in PowerPoint neu gestalten können.
- <!--i:pentool--> **Vektoren** (Logos, Icons, die SUSE-Marke) werden als **echte SVG-Bilder** eingebettet - sie bleiben in jeder Größe scharf, und PowerPoint kann sogar *In Form konvertieren* auf sie anwenden.
- <!--i:photos--> **Bilder** kommen in ihrer nativen Auflösung als eigenständige, extrahierbare Bilder durch (ein mit `cover` zugeschnittenes Hero-Bild behält das vollständige Bild hinter dem Zuschnitt, sodass Sie den Ausschnitt neu setzen können), wobei jede Bildbearbeitung (Filter, Overlays) originalgetreu eingebrannt ist.
- <!--i:layers--> **Hintergründe, Rahmen und Linien** werden zu echten Rechteck-/Linienformen.

![Das Export-Panel mit ausgewähltem PowerPoint: eine Folie pro Seite, Text und Formen bleiben bearbeitbar](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Das Layout ist bewusst approximativ - das Ziel ist originalgetreuer, wiederverwendbarer **Inhalt**, kein fixierter Screenshot. Alles, was der Walker nicht nativ ausdrücken kann (ein komplexer gefilterter oder maskierter Bereich), wird als Bild eingebettet, damit nichts verloren geht. Ein Deck hat eine einzige Foliengröße, übernommen von der ersten Seite.

PowerPoint funktioniert auch als Weg **hinein**. Legen Sie eine `.pptx` auf einer beliebigen Upload-Fläche ab und wählen Sie die gewünschten Folien aus - jede wird zu einem Asset, das sich platzieren, abstimmen oder weiterverarbeiten lässt. **Markdown Slides** schreibt aus Markdown ein neues Deck (und gibt eine gebrandete `.pptx`-Vorlage aus), und das **Rebrand**-Werkzeug thematisiert ein bestehendes Deck an Ort und Stelle neu - Themenpalette, fest codierte Farben und Schriftarten - ohne dessen Diagramme, SmartArt oder Animationen anzutasten, und gibt eine `.pptx` zurück. Siehe [Ein Design importieren → Decks und Dokumente](/info/design-import.html#decks-and-documents).

## Penpot

Jedes Tool, das SVG exportieren kann, kann auch eine **Penpot-Datei** (`.penpot`) exportieren - das Dokument, bereit zum Weiterbearbeiten in Penpot, nicht nur zum Betrachten.

- <!--i:layout--> Aus **Design** wird jeder Frame zu einem Penpot-**Board**, jede Box darauf wird zu einer eigenen bearbeitbaren Form übertragen - Rechteck, Ellipse, Text, Bild oder Pfad - und das Ergebnis kommt als wiederverwendbare **Komponente** im Assets-Panel an, bereit zum erneuten Herausziehen.
- <!--i:pentool--> Aus einem Tool, dessen Render **reine Geometrie** ist - die Vektor-Tools wie QR Code, Street Map, Wordmark und Palette Lab - wird jeder Pfad, jedes Rechteck, jede Textzeile und jeder Verlauf auf dieselbe Weise übertragen, als eigene bearbeitbare Form.
- <!--i:font--> Bei einem Tool, das sein Render in **HTML** aufbaut, **bleibt der Text Text** - ein bearbeitbares Penpot-Textobjekt pro Zeile, keine Kontur und kein flaches Bild. Eine Grafik, für die Penpot kein Konstrukt kennt - eine komplexe Illustration, eine Live-Canvas - reist als eigenständiges Bild mit, damit der Text und die Boxen darum nie plattgedrückt werden. Ein ganzes Layout, das Penpot nicht originalgetreu trennen kann, kommt dennoch als ein einziges Bild in voller Wiedergabetreue an, sodass nie etwas verloren geht.
- <!--i:palette--> Eine Farbe oder Schrift, die eine Form **von einem Marken-Token erbt**, bleibt in der Datei mit diesem Token **verknüpft**: Ändern Sie das Token in Penpots Tokens-Panel, passt sich jede Form, die es erbt, gemeinsam neu an, während eine einmalige feste Farbe genau bleibt, wo sie ist. Die Farben und Schriftarten der Marke landen zudem im **Assets**-Panel und ihr vollständiger Design-Token-Satz im **Tokens**-Panel - derselbe DTCG-Token-Satz, den auch Lollys eigene Palette verwendet. Penpot behält davon eine eigene Kopie: Eine Änderung im dortigen Tokens-Panel fließt nicht von selbst, sondern über [Brand Studios Import](/info/design-import.html) in die Marke zurück.

| Was Sie erstellt haben | In Penpot |
|---|---|
| Text | Bearbeitbare Textobjekte - Tippfehler korrigieren oder neu gestalten |
| Formen, Pfade, Verläufe, Bilder | Eigene bearbeitbare Vektorformen |
| Eine Farbe oder Schrift aus einem Marken-Token | Eine lebendige Token-Verknüpfung - Token bearbeiten, jede erbende Form folgt |
| Das gesamte Design | Eine wiederverwendbare Komponente im Assets-Panel |
| Eine komplexe Illustration oder Live-Canvas | Eigenständig als Bild eingebettet, der bearbeitbare Inhalt drumherum unangetastet |

![Das Export-Panel mit ausgewähltem Penpot: die .penpot-Datei und Send to Penpot neben dem Download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Um sie zu öffnen, starten Sie Penpot, wählen Sie ein Projekt und dann **Import**. Bei Penpot vom Export-Panel aus angemeldet, erledigt **Send to Penpot** diesen Schritt für Sie - wählen Sie dort ein Projekt, und die Datei geht direkt hinein.

## SCORM (Kurspakete)

Ein Design-Deck kann als **SCORM-Paket** ausgegeben werden - das Zip, das ein Lernmanagementsystem importiert, ob Moodle, Canvas, Blackboard oder ein firmeneigenes LMS. Wählen Sie **SCORM (LMS)** im Format-Auswähler, und der Export schreibt:

- <!--i:layout--> **Die Folien**, ein Bild pro Artboard, als Vektor, wo das Artboard es zulässt, und nur dort als Pixel, wo es das nicht tut.
- <!--i:play--> **Den vertonten Film** mit seiner Untertitelspur - die Sprechernotizen, vorgelesen von einer On-Device-Stimme, genau so, wie [Presenting](/info/create/using.html#presenting) sie abspielt.
- <!--i:file--> **Eine Startseite**, die durch die Folien führt, den Film abspielt und den Abschluss über die SCORM-1.2-Laufzeitumgebung an das LMS zurückmeldet - die Version, die jedes LMS akzeptiert.
- <!--i:font--> Die vom Deck verwendeten Schriftarten, damit die Startseite offline gleich aussieht.

![Das Export-Panel eines Design-Decks mit ausgewähltem SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Nichts im Paket telefoniert nach Hause: Es sind Dateien in einem Zip, und es läuft im LMS ohne Bundler, ohne CDN und ohne Konto. Die Web- und Desktop-Apps erstellen es; die CLI nicht, weil das Fotografieren der Artboards und das Encodieren des Films den Browser brauchen.

## DXF (Schnittdateien)

Vektor-Tools (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, die Logo-Lockups, Diagram Builder) können als **DXF** exportieren - dem AutoCAD-R12-Austauschformat, das Lasercutter, Vinylplotter und CNC-/CAD-Software lesen. Geometrie wird als Umriss-**Pfade in Millimetern** geschrieben (Kurven mit feiner Toleranz geglättet), Text wird zu Pfaden konturiert, und Farbe wird auf den nächstliegenden AutoCAD Color Index abgebildet (der auf einem Cutter typischerweise das Werkzeug bzw. den Vorgang steuert). DXF ist reine Strichgrafik - ein fotografischer oder gefilterter Bereich hat keine Schnittpfad-Form und wird verworfen (Lolly warnt davor), verwenden Sie also SVG/PDF, wenn Sie Rasterinhalte behalten müssen.

Street Map ist der klarste Fall: Das gesamte Design besteht bereits aus Strichen, sodass jede Straße und jeder Kanal zu einem Schnittpfad wird, ohne dass etwas verworfen werden muss.

::: showcase
![Ein Street-Map-Rendering von Paris in Tinte auf Creme - reine Strichgrafik, sodass jeder Strich die Reise zum Cutter übersteht](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scrollen Sie, und die Kamera zoomt durch die tatsächliche Geometrie zurück: sieben Pfade, nirgends Pixel, jeder Strich haarscharf bei jeder Zoomstufe. Das ist dieselbe Datei, die ein Cutter liest.
:::

## Animiertes SVG

Motion-Tools (Animated Ad, Lottie Ad) können **Animiertes SVG** exportieren - eine in sich geschlossene, *vektorielle* Animation. Anders als GIF/APNG/WebP (die jedes Frame in Pixel rastern) stapelt ein animiertes SVG Vektor-Schnappschüsse mit eingebetteten CSS-Keyframes, sodass es **ohne Codec und ohne externe Laufzeitumgebung auf jede Größe skaliert** - es läuft in einem Browser-Tab oder einem `<img>` in einer Schleife. Text bleibt konturiert, sodass er überall gerendert wird. Es teilt sich die **Dauer**-/Bildrate-Regler der animierten Formate und nutzt (da pro Frame schwerer als ein Bitmap) standardmäßig eine niedrigere Bildrate.

## Transparenz

Tools, die das unterstützen, bieten einen Schalter für **transparenten Hintergrund** (z. B. *No BG*). Transparenz bleibt erhalten bei PNG, WebP, AVIF, SVG (statisch und animiert), APNG und Animated WebP. JPG und PDF sind immer deckend, und TIFF flacht auf Weiß ab (auf dem HDR-Pfad auf Schwarz - siehe unten).

## Farbräume

Zwei unterschiedliche Fragen, die man auseinanderhalten sollte: welche Farbräume Lolly **lesen und in denen es denken** kann, und welche es **schreibt**.

**Lesen.** Wo auch immer eine Farbe geschrieben steht - im Stylesheet eines Tools, in der Füllung eines importierten SVG, im Wert eines Design-Tokens, in einem Schatten oder Farbverlauf innerhalb einer CSS-Kurzschreibweise - liest Lolly das vollständige **CSS-Color-4**-Vokabular: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, die benannten CSS-Farben und `color()` in den vordefinierten Räumen - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - einschließlich Komponenten, die als `none`-Schlüsselwort geschrieben sind. Ein einziger Parser übernimmt das für die gesamte Plattform, sodass der Browser und jeder Export-Walker sich darüber einig sind, was ein Farbstring bedeutet.

Das ist wichtiger, als es klingt, denn ein Browser löst modernes CSS zu modernem CSS auf. Schreiben Sie `color-mix(in oklab, …)`, berechnet Chrome `oklab(…)`; verwenden Sie ein Marken-Token, das als `oklch()` gespeichert ist, ist genau das der Wert, den der Export-Walker sieht. Farben in diesen Formen werden korrekt gelesen statt verworfen - was ein Walker tat, der nur `rgb()` verstand: er exportierte markenfarbigen Text als Schwarz, verlor eingefärbte Panels und Tabellenlinien und las `oklch(0.7 0.1 200) 0px 2px 4px` als Schattenversatz von 0,7 mal 0,1.

**Denkweise.** Farbmathematik läuft perzeptuell ab statt in rohen Kanälen. Palettenherleitung, Verläufe, Harmonien und Kontrast laufen in **OKLCH/OKLab**, und eine Farbe außerhalb des Gamuts wird durch CSS Color 4's eigenen Gamut-Mapping-Algorithmus in den Bereich gebracht - Chromareduktion mit einer Prüfung des perzeptuellen Abstands - statt durch Kappen der Kanäle, sodass eine kräftige Farbe bei der nächstliegenden Farbe landet, die Sie tatsächlich akzeptieren würden, statt bei einer abgeflachten. Verläufe interpolieren in einem von Ihnen gewählten Raum (standardmäßig OKLab, oder `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, mit einer Farbtonrichtung für die polaren), und das Mischen ist **vormultipliziert**, sodass ein Übergang zu transparent die richtige Farbe behält, statt auf dem Weg Richtung Schwarz abzudunkeln. Ein einziger Interpolator bedient sowohl die Vorschau als auch die Export-Walker - genau das hat verhindert, dass ein konischer Verlauf auf dem Bildschirm anders gemischt wird als in der exportierten Datei.

**Schreiben.** Die Ausgabe ist bewusst enger gefasst als die Eingabe, denn eine Datei muss von dem lesbar sein, was sie auch immer öffnet, und ein Raum wird beim Schreiben nur dann *deklariert*, wenn die Werte tatsächlich in ihn umgerechnet wurden. Bildschirm- und Web-Formate werden als **sRGB** geschrieben und entsprechend getaggt; die Druckformate werden als **CMYK** gegenüber einem benannten Druckbedingungsprofil geschrieben (unten); und der HDR-Pfad ist **Rec.2100 PQ** (oben). Eine Farbe mit weitem Gamut, die einen Export erreicht, wird nach sRGB abgebildet statt falsch gekennzeichnet - `color(display-p3 …)` bis in eine Vektordatei durchzureichen ist eine geplante Erweiterung, kein Anspruch heutiger Exporte. Ein in OKLab erstellter Farbverlauf wird beim Export zu einfachen sRGB-Stopps *gebacken*, wobei zusätzliche Stopps nur dort eingefügt werden, wo sRGB sichtbar von der perzeptuellen Kurve abweichen würde, weil ein SVG-`<linearGradient>` und eine PDF-Achsenschattierung keine Einstellung für den Interpolationsraum besitzen, um die Absicht zu tragen. Ein erstellter Wert, drei Renderer, keine Abweichung.

## Farbprofile

Damit Farben in farbmanagementfähigen Anwendungen (Druckereien, Photoshop, Browser) originalgetreu wiedergegeben werden, sind Exporte **mit einem Farbprofil getaggt**:

- **PNG / JPG** tragen ein eingebettetes **sRGB**-ICC-Profil - den Farbraum, in dem die Vorschau tatsächlich gerendert wird - sodass nichts geraten werden muss. (Nur Tagging; die Pixel werden nicht neu kodiert.)
- **Print-PDF (CMYK)** deklariert in seinem *OutputIntent* eine Ziel-**Druckbedingung** (Standard *Coated FOGRA39*), die einem RIP/einer Druckerei mitteilt, wie ihre CMYK-Farben zu lesen sind. Markenfarben mit gemessenen Farbwerten werden exakt konvertiert; andere Farben nutzen eine Standard-Geräteumrechnung. Diese Deklaration ist ein *Name*: Mit Lolly wird kein CMYK-Profil ausgeliefert, und PDF/X-4 verlangt das eingebettete Profil, sodass eine benannte Bedingung den Output-Intent schreibt, ohne PDF/X-4-Konformität zu beanspruchen. Laden Sie ein eigenes CMYK-Profil und wählen Sie dessen **Embed**-Zeile in der Farbprofil-Steuerung, wird es als *DestOutputProfile* der Datei eingebettet - erst dann kann das PDF wirklich PDF/X-4 sein, und es beansprucht das, wann immer der Rest der Datei es zulässt. Drei Dinge verhindern die Beanspruchung, während der Output-Intent erhalten bleibt (ein RIP will den weiterhin): RGB-Motive, die der CMYK-Durchlauf nicht konvertieren konnte, der `prov`-Vermerktext im Prüfrand (in einer Standardschrift gesetzt, die nicht eingebettet ist, und X-4 macht dafür keine Ausnahme) und ein **Strong**-Passwort, da X-4 Verschlüsselung verbietet. Die deklarierte Bedingung wird dann aus diesem Profil ausgelesen: ein registrierter Name, wo das Profil einen nachweist, `Custom` unter dem eigenen Namen des Profils, wo nicht - sodass die Datei niemals eine Druckbedingung benennen kann, während sie die Messwerte einer anderen trägt.
- **Print-TIFF (CMYK)** schreibt ungetaggte **DeviceCMYK**-Pixel und vermerkt dieselbe Druckbedingung als Herkunftsangabe in seinen TIFF-Metadaten (*ImageDescription*), statt ein Profil einzubetten. Dieselbe Farbprofil-Steuerung treibt beide CMYK-Formate an - ein TIFF kann überhaupt kein Druckprofil einbetten, sodass eine **Embed**-Zeile dort nur den Namen dieses Profils vermerkt und sonst nichts.
- **TIFF (RGB)** ist das schlichte, unkomprimierte sRGB-Geschwister - ein verlustfreies Raster in der gewählten DPI für die Archivierung oder einen Editor-Roundtrip, mit Herkunftsangabe in denselben TIFF-Metadaten. Jede Transparenz wird auf Weiß abgeflacht (dieses Profil trägt keinen Alphakanal). Wie das CMYK-TIFF ist es nur für den Desktop, da Browser ein TIFF nicht in der Vorschau anzeigen können und mobile Downloads in eine Sackgasse führen.
- **SVG**, **EMF**, **EPS** und **DXF** sind auflösungs- und profilunabhängige Vektoren ohne eingebettetes Profil - die Farben von SVG sind einfaches sRGB, die von EMF und EPS sind Geräte-RGB (und **EPS (CMYK)** schreibt naives DeviceCMYK), und **DXF** trägt den nächstgelegenen AutoCAD Color Index. (SVG, EPS und DXF konturieren wie PDF jeden Text zu Vektorpfaden, sodass das Ergebnis auch dort gerendert wird, wo die Schrift nicht installiert ist. EMF hält Text stattdessen standardmäßig LIVE - echte Metafile-Textdatensätze, die in Office und Google Slides auswählbar und bearbeitbar bleiben, und fällt nur bei Textläufen, die das Format nicht ausdrücken kann, auf Konturen zurück; die Option "Outline fonts" im Exportbereich erzwingt überall Pfade.) **SVG** gibt außerdem CSS-`box-shadow` aus dem HTML wieder - jeder äußere Schatten wird hinter der Box gezeichnet, mit Versatz/Streuung und Gauß-Weichzeichnung passend zum Browser, und innere Schatten werden auf dieselbe Weise in der Box gezeichnet.

Das geschieht automatisch - es gibt keine Einstellung, an der man herumfummeln muss. Miniaturansichten und Vorschauen lassen das Tag weg, um klein zu bleiben. Ein Profil ist tatsächlich eine Entscheidung, weil es die Pixel verändert statt sie nur zu kennzeichnen - siehe **HDR** unten.

## HDR (leuchtende Farben)

Normale Exporte sind sRGB: Weiß ist Weiß, und eine gesättigte Markenfarbe ist so hell wie das normale Weiß des Bildschirms. Auf einem HDR-fähigen Display gibt es darüber noch viel Spielraum, und die **HDR**-Karte im Exportbereich nutzt ihn - Ihre Markenfarben und weißer Text werden in Richtung Spitzenhelligkeit angehoben, sodass sie tatsächlich *leuchten*, während die dunklen Bereiche dunkel bleiben und dem Leuchten seinen Kontrast geben.

![Die HDR-Karte im Exportbereich, eingeschaltet, mit den darunter sichtbaren Reglern Weiß / Reichweite / Dunkelaufhellung / Fokus](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formate.** Die Rasterformate mit einem Platz für das Signal: **PNG**, **JPG**, **AVIF** und **TIFF**. (Nicht WebP - es ist 8-Bit ohne funktionierenden HDR-Dekodierpfad, sodass ein PQ-WebP schlicht dunkel aussehen würde. Vektoren und PDF haben überhaupt kein HDR-Modell.)
- **Standardmäßig aus**, anders als die Farbkennzeichnung - es verändert die Pixel, daher ist es Opt-in. Aktivieren Sie die Karte, oder übergeben Sie `hdr=1` in einem Share-Link.
- **Was tatsächlich geschrieben wird.** Die Pixel werden nach **Rec.2100 PQ** neu codiert - BT.2020-Primärvalenzen mit der SMPTE-ST-2084(PQ)-Übertragungskurve - und der Container trägt das passende Signal, damit eine farbverwaltete Anwendung weiß, sie so zu lesen: ein generiertes **ICC-v4-Profil mit `cicp`-Tag** (JPG, TIFF), ein **`cICP`-Chunk** (PNG) oder eine umgeschriebene `colr`-Box (AVIF). Die Aufhellung ist an die **perzeptuelle (OKLab-)Helligkeit** gekoppelt, sodass mittlere und hellere Farben bis zur Spitzenhelligkeit ausschlagen und dunkle beruhigt statt ausgebrannt werden, und sie ist farbtontreu - ein Markengrün wird heller, nicht minzig.
- **Die Regler.** Vier, sichtbar sobald die Karte aktiv ist: **White** (die Spitzenhelligkeits-Obergrenze, 400-2000 Nits), **Reach** (wie weit sich der Glanz in die Tonwerte hinunter ausbreitet), **Dark lift** (wie stark die Dunkelheiten aufgehellt werden - `0` hält sie dunkel) und **Focus** (wie viel Farbreichtum die Aufhellung behält). Sie fahren im selben Parameter mit wie ein kompakter abgestimmter Wert - `hdr=1600-60-0-50` bedeutet White 1600, Reach 60, Dark lift 0, Focus 50 - sodass ein abgestimmter Look über den Link reproduzierbar ist.
- **Wo Sie es sehen werden.** Farbverwaltete Betrachter auf einem HDR-Display: Preview / Quick Look / Safari auf Apple-Geräten, Chrome auf einem HDR-Monitor. Auf einem gewöhnlichen SDR-Bildschirm zeigt sich die Datei weiterhin als normales Bild.
- **Bevor Sie es veröffentlichen.** Viele Plattformen **codieren neu**, was Sie hochladen, und entfernen dabei das HDR-Signal - soziale Netzwerke, Messaging-Apps, manche CMS -, was das Bild dunkel oder blass wirken lassen kann. Verwenden Sie HDR dort, wo Sie das Ziel selbst kontrollieren (eine Website, die Sie selbst bauen, eine Videowand, ein Deck auf einem hellen Panel), nicht standardmäßig für alles.
- **Transparenz.** PNG und AVIF behalten ihren Alphakanal; JPG ist wie immer deckend. Der **TIFF**-Pfad legt auf **Schwarz** an, nicht wie der SDR-Pfad auf Weiß - in PQ ist Weiß der 10.000-Nit-Code, sodass ein Anlegen darauf jede Kante mit einem blendenden Halo umranden würde.
- **Dieselben Bytes aus dem Terminal.** `--hdr=1` zusammen mit `--export=png` oder `--export=jpg` schreibt auch auf der [CLI](/info/cli.html) das 16-Bit-Rec.2100-PQ-PNG und das ISO-21496-1-Gain-Map-JPEG, aus denselben Engine-Encodern statt aus einem Browser - sodass ein `<svg>`-natives Tool eine HDR-Datei ohne jedes Chromium im Pfad erzeugt und das PNG byte-identisch zu dem der Web-Shell ist. AVIF und TIFF bleiben vorerst Web-Shell-Exporte.

## Video

Animierte Tools exportieren Bewegung als **MP4**, **WebM** oder **GIF** - und, wo angeboten, **APNG**, **Animated WebP** oder das vektorielle **Animierte SVG** (oben). Welchen Video-Container Sie sehen, hängt von Ihrem Browser ab - die Auswahl zeigt nur, was er tatsächlich aufzeichnen kann:

| Browser | Zeigt |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 und WebM** |
| Älteres Chrome | **WebM** |

GIF funktioniert überall (ideal für Chat/E-Mail; größer und farbärmer als Video). Animierte Tools bieten außerdem **Wait** (Sekunden, damit sich die Animation vor der Aufnahme einpendelt) und **Duration** (Cliplänge).

> Ein geteilter `?format=…`-Link, der einen Container anfordert, den Ihr Browser nicht aufzeichnen kann, weicht sanft auf den anderen aus und benennt die Datei entsprechend.

**Ton.** Videoexporte sind nicht stumm. Ein Tool kann einen **Musikbett** unter den Clip legen - ein Audio-Asset aus dem Katalog, in Schleife oder auf die Cliplänge zugeschnitten, mit Ein-/Ausblenden, Lautstärke und automatischem Ducking unter dem eigenen Ton des Filmmaterials - und die Aufnahme-Tools führen den Live-Ton ihres Filmmaterials direkt in die Datei durch. **MP4** und **WebM** behalten die gemischte Spur; GIF und die animierten Bildformate (APNG, Animated WebP, Animated SVG) sind von Natur aus stumm.

## Audio

Manche Tools exportieren **Audio eigenständig**, nicht nur als Videospur. Der **Voice Recorder** nimmt eine Mikrofonaufnahme mit Live-Pegelanzeige und sanftem Coaching auf und speichert sie als **MP3** (Standard, in Ihrem Browser transkodiert) oder in ihrem nativen Container - **M4A** (AAC), **OGG** oder **WebM** (Opus), je nachdem, was Ihr Browser aufgezeichnet hat. Wie bei allem anderen geschieht die Kodierung auf Ihrem Gerät - nichts wird hochgeladen.

Audio, das Sie *mitbringen*, ist ebenso breit gefächert. Der Asset-Picker akzeptiert **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** und **FLAC** (byte-genau erhalten und auf dem Gerät dekodiert), **MIDI** (`.mid` - beim Import in eine winzige On-Device-Synth-Spur umgewandelt) und **Tracker-Module** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (auf dem Gerät durch einen mitgelieferten Player dekodiert, wenige Kilobyte Songdaten). Jedes davon kann zum **Musikbett** unter einem Videoexport werden oder im Ambient-Player des Neurospicy Mode abgespielt werden.

Audio *ist* Teil der `format=`/`--export=`-Pipeline weiter unten: `wav`, `mp3`, `m4a` und `opus` sind gewöhnliche Format-IDs, sodass ein reiner Audioexport ebenso teilbar und skriptfähig ist wie ein PNG. Was dabei herauskommt, ist allein der Ton, kein Bild.

## Herkunft & Wasserzeichen

Wo das Format es unterstützt, tragen Exporte **Herkunftsmetadaten** - Software, Quelle, der Name des Tools und Ihre Profil-Credit-Zeile - nativ eingebettet (PNG iTXt, JPEG EXIF, PDF-Info, SVG `<metadata>`, GIF-Kommentar). Es geht nur um Urheberschaft; nichts wird hochgeladen. **Experimentelle** Tools stempeln zusätzlich ein sichtbares Wasserzeichen auf, angewendet vom Host, sodass es nicht durch Bearbeiten des Tools entfernt werden kann.

**Der Lolly Imprint.** Rasterexporte tragen außerdem Lollys eigenes **unsichtbares Pixel-Wasserzeichen** - den *Lolly Imprint* - **standardmäßig aktiviert**, genau wie Content Credentials. Während die Credential und die Herkunftsmetadaten *neben* den Pixeln mitreisen und bei einem erneuten Speichern, einem Screenshot oder einem Metadaten-Strip verloren gehen, lebt der Imprint *in* den Pixeln und übersteht eine Neukomprimierung - sodass eine Kopie des Bildes später noch als Lolly-Erzeugnis erkennbar bleibt. Es ist ein dauerhafter Hinweis, keine kryptografische Garantie, und rein präsenzbasiert (es trägt keine personenbezogenen Daten). Er reist in **PNG, JPG, WebP, AVIF, TIFF und BMP** sowie in den von Lolly gerenderten Rasterbildern, die in ein **PDF oder PPTX** eingebettet werden - niemals in einem Bild, das *Sie* eingebettet haben, nur in dem, was Lolly selbst rendert. Deaktivieren Sie die **Lolly Imprint**-Karte im Exportbereich, um ihn zu überspringen, oder übergeben Sie `imprint=0` in einem Share-Link. (Das Überstehen einer AVIF-Neukodierung ist noch nicht kalibriert; die PDF/PPTX-Erkennung deckt die eingebetteten Lolly-Rasterbilder ab.) [/verify](/verify) erkennt ihn auf dem Gerät - siehe [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**Die dauerhafte Credential.** Ein zweites, schwereres Merkmal steht neben dem Imprint: **Durable credential**, die mit einem On-Device-Neuronalmodell (TrustMark-Format) Lollys ID *in* die Pixel schreibt, sodass die "mit Lolly erstellt"-Verbindung einen Metadaten-Strip, eine Neukodierung und ein erneutes Auslesen sowohl durch TrustMark-fähige Tools als auch durch Lollys eigene übersteht. Sie ist **standardmäßig deaktiviert** - anders als der reine JavaScript-Imprint kostet sie einen neuronalen Durchlauf pro Export plus einen einmaligen Modell-Download, ist also ein bewusstes Opt-in statt einer stillen Abgabe. Nur Rasterformate (**PNG, JPG, WebP, AVIF, TIFF**), aktivierbar im Exportbereich oder übergeben als `durable=1` in einem Share-Link. In den Desktop- und Mobile-Apps wird die Karte gänzlich ausgeblendet statt als wirkungslos angezeigt zu werden, da es offline keine Quelle gibt, von der das Modell geladen werden könnte.

**Content protection.** Im Exportbereich fasst sich *Passwortschutz*, **C2PA Credentials**, der **Lolly Imprint** und die **Durable credential** zu einer eingeklappten, formatabhängigen **Content protection**-Gruppe zusammen, sodass die Herkunfts- und Schutzoptionen einer Datei an einem Ort liegen - die Gruppe zeigt nur die Karten, die auf das gewählte Format zutreffen, und blendet sich ganz aus, wenn keine davon zutrifft. Druckmarken sind bewusst *nicht* darin enthalten: Sie sind Druckproduktionsgeometrie und kein Schutz, daher behält **Print marks & bleed** - das Beschnittmaß in Millimetern plus Schnitt-, Passer-, Beschnitt-, Farbbalken- und Stempeldetails - eine eigene übergeordnete Karte bei den Druckformaten.

![Die Content-protection-Gruppe geöffnet bei einem PNG-Export, mit nur den zutreffenden Karten](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Vor dem Export (Druck-Preflight).** Aktivieren Sie **Print preflight** (`export-preflight`) in den Feature-Flags Ihres Profils - es ist **standardmäßig deaktiviert**, sodass eine Einzelperson, die ein PNG für eine Chat-Nachricht exportiert, nie von Druckvorstufenbefunden überrascht wird, und eine Deployment-Steuerungsebene ([lolly.work](https://lolly.work)) es für ihre Mitglieder standardmäßig aktivieren kann - und am Fuß des Bereichs, unmittelbar über den Schaltflächen, erscheint eine **Before you export**-Karte, sobald die Druckregeln zum Auftrag etwas Zutreffendes zu sagen haben: Format, Größe und Beschnitt, dann Schnitt- und Beschnittflächen, Farbdeckung, Plattenzahl und Seitenzahl, mit einem Urteil neben der Überschrift. Sie sitzt unter jeder Einstellung, weil sie eine Aussage *über* diese Einstellungen ist statt eine weitere von ihnen - und sie blockiert niemals einen Export. Sie sagt Ihnen, was eine Druckerei gleich zu sehen bekommt.

**Kosten, aus Ihrer Preisliste errechnet.** Unterhalb des Preflights - ganz zuletzt, immer noch über den Schaltflächen - sitzt eine Karte, die dieselben Zahlen in Geld umrechnet, und zwar ausschließlich aus Preisen, die ihr jemand vorgegeben hat. Sie liest, was der Preflight-Durchlauf gezählt hat, unabhängig davon, ob die Preflight-Karte selbst eingeschaltet ist, und braucht zwei Dinge, damit sie überhaupt etwas zeigt: Der Auftrag muss etwas enthalten, das eine Preisliste überhaupt bepreisen kann (Platten, Bogen, Fläche, Seiten, Variantenzeilen oder Ausgabedateien - ein einfaches Logo-PNG zeigt sie also nie), **und** eine **Preiskarte** muss vorhanden sein. Eine Preiskarte ist eine JSON-Preisliste Ihrer Druckerei. Ein Standard-Build enthält keine und hat keine In-App-Möglichkeit, eine zu laden: Sie kommt entweder als Katalog-Asset, das ein Deployment mitliefert, oder über die optionale Preiskarten-Erweiterung, die ein Self-Hoster oder eine Steuerungsebene aktiviert. Ohne Preiskarte wird nichts angezeigt - kein Hinweis, keine leere Tabelle.

Die Regel, um die das Ganze gebaut ist, lautet: **Es erfindet nie Geld.** Jede Zahl ist ein von Ihnen angegebener Satz mal eine von Lolly gezählte Menge - `4 Platten × 35,00 €` - und die Summe nennt ihre eigene Quelle im selben Satz wie die Zahl: den von der Karte genannten Herausgeber und das Datum, zu dem die Karte ihre Preise angibt. Es gibt keine Standardwährung, keinen Platzhalter und keine Null, die für einen fehlenden Preis einsteht. Was die Datei über sich selbst sagt, bleibt indirekte Rede: *"Die Datei sagt: … Lolly hat dies nicht überprüft."*

Und wenn nicht ehrlich gerechnet werden kann, **verschwindet** die Arbeitstabelle, statt zu einer ausgegrauten oder aufgefüllten Zahl zu verkommen:

- Zeilen, die die Karte nicht bepreist, bedeuten **überhaupt keine Summe** - nur eine Kopfzeile, die angibt, wie viele davon unbepreist sind. Eine Teilsumme ist keine kleinere Antwort, sie ist eine falsche.
- Eine Menge, die eine Obergrenze statt einer exakten Zahl ist, trägt **"bis zu"** bis in ihre Zwischensumme weiter, sodass eine Grenze nie zu einer flachen Zahl gewaschen wird.
- Preise, deren Gültigkeitsdatum abgelaufen ist, zeigen **nur Mengen**, bis Sie *Use these rates anyway* drücken - dann reist das Ablaufdatum mit der Zahl mit, sodass eine abgelaufene Summe nicht als aktuell gelesen werden kann.
- Über einen **Link** geöffnet, bleibt Geld verborgen, bis Sie auf diesem Gerät danach fragen. Weder die Karte noch diese Enthüllung reisen je in einer URL - aus demselben Grund nimmt die CLI `--rate-card=<file.json>` als lokale Datei-Flag und nie als Link-Parameter.

Die Karte ist Chrome, nie Inhalt: Sie wird aus jeder Exportstufe entfernt und kann daher kein Pixel der heruntergeladenen Datei bewegen. Und sie ist Arithmetik, kein Angebot - nur Ihre Druckerei kann Ihnen eines geben.

**Zusammengesetzte Renderings.** Wenn ein Tool die Ausgabe eines anderen Tools einbettet (z. B. ein *Event Name Badge*, das einen *QR Code* einbettet), wird das verschachtelte Rendering in den Export des übergeordneten Tools eingefügt - es bleibt in SVG und PDF ein **echter Vektor** und rastert scharf in PNG/JPG/WebP. Das eingebettete Kind ist ein Zwischenprodukt: Es erhält *kein* Wasserzeichen und *keine* eigene Herkunft; nur das fertige übergeordnete Asset erhält beides. (Komposition deckt SVG und die Rasterformate ab; HTML/MD/TXT können nicht zusammengesetzt werden.)

## Passwortschutz

Zwei unabhängige Arten von Sperren, beide vollständig auf dem Gerät.

**PDF-Öffnungspasswort** - die *Passwortschutz*-Karte im Exportbereich bietet zwei Stufen:

![Die Passwortschutz-Karte aufgeklappt bei einem PDF-Export, mit dem Passwortfeld und den beiden Sicherheitsstufen](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - eine einfache 40-Bit-Sperre (RC4). Sie öffnet sich in *jeder* PDF-App und kann - als leichte Abschreckung, kein echter Schutz - in einem Share-Link mitreisen (Klartext, mit Absicht). Nur RGB-`pdf`.
- **Strong** - AES-256 (PDF 2.0). Ihr Passwort wird beim Export eingegeben und **niemals** in einen Link gesetzt; sie öffnet sich nur in neueren PDF-Apps (Acrobat/Preview ~2018 an), und ältere Apps melden die Datei möglicherweise als beschädigt. Strong gilt auch für **Print-/CMYK-PDFs** und für **jedes PDF in einem Batch-ZIP** (der Batch-Bestätigungsdialog erfasst das Passwort). Da PDF/X-4 Verschlüsselung verbietet, behält ein Strong-gesperrtes Print-PDF sein CMYK, seine Marken und seinen Output-Intent, verliert aber die PDF/X-4-Konformitätsangabe.

Jede Stufe schließt sich mit Content Credentials gegenseitig aus (ein verschlüsseltes PDF kann die Credential nicht aufnehmen).

**Gesperrte Downloads (ganzes ZIP + Defense-in-Depth)** - ein **ZIP**-Export (das *ZIP*-Format des Exportbereichs, das mehrere Formate eines Tools bündelt), ein **Ordner**-Download (Projects → Download) oder das **Batch-Grid** können das gesamte ZIP mit einem Passwort auf zwei Stufen sperren:

- **Standard** - klassisches **ZipCrypto**: öffnet sich in *jedem* Entpackungstool, einschließlich des in Windows Explorer eingebauten Extrahierens, aber schwach (eine Abschreckung). Ihr Passwort kann in einem `?password=`-Share-Link mitreisen.
- **Strong** - **AES-256** (WinZip AE-2): stark, öffnet sich aber **nicht** im in Windows Explorer eingebauten Extrahieren - der Empfänger braucht 7-Zip/WinZip/Keka/macOS. Beim Export eingegeben, nie in einen Link gesetzt.

Dieselbe *Passwortschutz*-Karte im Exportbereich steuert sowohl die PDF- als auch die ZIP-Sperre und formuliert sich für das gewählte Format um. Das eine Passwort schützt **jedes** Mitglied - Bilder, SVG, alles, PDFs eingeschlossen (nur der ZIP-Container kann Nicht-PDF-Dateien schützen, die keine eigene Sperre haben). Und es ist **Defense-in-Depth**: Jedes enthaltene PDF wird *zusätzlich* einzeln mit demselben Passwort AES-256-gesperrt, sodass ein PDF auch nach dem Entpacken des ZIP gesperrt bleibt. Die Eingabeaufforderung erscheint beim Start des Downloads; ein leeres Passwort bedeutet keine Sperre.

**Passwortgeschützte Share-Links** - jeder Share-Link kann so verschlüsselt werden, dass das Öffnen den Empfänger nach einem Passwort fragt. Der gesamte Link-Zustand wird AES-256-verschlüsselt, unter einem aus dem Passwort abgeleiteten Schlüssel (PBKDF2); nur Chiffretext reist mit, sodass das **Passwort nie im Link steht** und die Entschlüsselung **im Browser des Empfängers** stattfindet - der Server, der den Link ausliefert, sieht nur den Chiffretext in der URL, nie das Passwort und nie das entschlüsselte Design. Aktivieren Sie es im **Share**-Dialog. Ein verschlüsselter Link lässt sich nur in Lolly *öffnen* (er kann nicht als Bild eingebettet werden, da dieser Pfad nicht nach einem Passwort fragen kann). Siehe [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Exporte können **Content Credentials** tragen - ein signiertes [C2PA](https://c2pa.org)-Manifest, in die Datei eingebettet, das manipulationssicher festhält, dass die Datei mit Lolly erstellt und seither nicht verändert wurde. Es ist die standardisierte Version der oben genannten Herkunftsmetadaten: ein kryptografischer Anspruch (was die Datei erstellt hat, wann, von wem und wo), gebunden an einen Hash der Bytes der Datei, sodass jede spätere Bearbeitung von einem C2PA-fähigen Viewer erkennbar ist. Der Standard wird von der [Content Authenticity Initiative](https://contentauthenticity.org) betreut (Adobe, BBC, Microsoft, Nikon und andere), sodass dieselben Credentials, die Lolly schreibt, auch von Kameras, Nachrichtenredaktionen und Kreativ-Suiten übernommen werden.

![Die C2PA-Credentials-Karte, vorab angehakt, mit der Gültigkeitsdauer der Credential daneben](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formate.** Jeder Container mit C2PA-Einbettung: **PDF** (sowohl RGB als auch Print), **PNG/Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB und Print), **WebP** (Standbild und animiert), **AVIF**, **MP4**, **WebM** und die Audio-Container **MP3**, **WAV**, **M4A** und **OGG/Opus** - sodass ein aufgenommener oder synthetisierter Sprachclip mit derselben Credential ausgeliefert wird wie ein Bild. Ein **ZIP**-Bündel stempelt jedes unterstützte Mitglied einzeln, was auch der Weg ist, auf dem ein **Animated SVG** eine erhält (es ist darunter ein gewöhnliches SVG-Dokument; ein direkter Animated-SVG-Export bietet keine eigene Karte). MP4, AVIF und M4A nutzen die BMFF-Bindung der Spezifikation und MP3 ihre ID3v2-Zuordnung, sodass `c2patool` und andere C2PA-fähige Viewer sie verifizieren; **WebM** und **OGG/Opus** haben noch keine standardisierte C2PA-Zuordnung, daher trägt Lolly das Manifest als Matroska-Anhang bzw. als OpusTags-Feld, was Lollys eigener Verifizierer (und die CLI) prüft. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, die Office-Formate und die Text-/Datenformate haben keinen C2PA-Container.)
- **Standardmäßig aktiviert.** Die **C2PA-Credentials**-Karte im Exportbereich ist für fast jedes Tool vorab ausgewählt - deaktivieren Sie sie, um die Credential bei einem einzelnen Export zu überspringen (oder übergeben Sie `c2pa=off` in einem Share-Link). Ein Tool kann in seinem Manifest ganz abwählen.
- **Was sie festhält.** Das Tool und die App, die die Datei erstellt haben, den Signierzeitpunkt, die Exportoberfläche (Browser-Engine-Familie + Betriebssystem-Familie - absichtlich grob, nie ein Fingerabdruck) und - nur wenn *Profile → Use my details* aktiviert ist - Ihren Namen und Ihre E-Mail-Adresse als Urheber des Werks.
- **Was Empfänger sehen.** Tools zur Prüfung von Content Credentials (Adobe-Apps, `c2patool`, contentcredentials.org/verify) lesen das Manifest und zeigen den Anspruch an. Da Lolly mit einem **auf Ihrem Gerät** erzeugten Schlüssel signiert - nicht mit einem Zertifikat aus einer Vertrauensliste -, melden Viewer sie als *unverifizierte* Credential. Die Struktur und die Manipulationssicherheit sind real; nur die Identität des Signierers wird von keiner Autorität bezeugt. Um das zu erweitern, können Sie eine **verifizierte Identität** anmelden (Profile → Content Credentials): ein kurzlebiges Zertifikat der Lolly-CA bindet Ihre E-Mail-Adresse an Ihre Exporte, während der Signierschlüssel weiterhin nie Ihr Gerät verlässt - siehe [Content Credentials Identity](/info/content-credentials-identity.html).
- **Eine Datei prüfen.** Lolly verifiziert auch seine eigenen Credentials: Legen Sie eine beliebige Datei auf [/verify](/verify) ab (oder führen Sie `lolly validate <file>` in der CLI aus) für einen On-Device-Bericht - angeführt davon, ob die Datei tatsächlich mit Lolly erstellt und seither unverändert ist. Die Web-Verify-Ansicht liest weit über die Credential hinaus: Sie markiert **KI-generierte Inhalte**, erkennt den **Lolly Imprint**, prüft **SEAL**-Signaturen und (opt-in) Pixel-Wasserzeichen Dritter und deckt **versteckte Daten** auf - alles auf dem Gerät, nichts wird hochgeladen. Siehe [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Datenschutz.** Alles geschieht auf Ihrem Gerät: Der Signierschlüssel wird für den Export erzeugt und verlässt nie den Browser, nichts wird hochgeladen, und der Anspruch enthält nur das, was die Herkunftsmetadaten ohnehin schon tragen. Datenschutz-Utilities (On-Device-Transformationen *Ihrer eigenen* Dateien) fügen nie Credentials hinzu, und *Strip Hidden Data* entfernt ein C2PA-Manifest wie jedes andere eingebettete Metadatum.
- **Wechselwirkungen.** Bei PDFs schließen sich Content Credentials und **Passwortschutz** (beide Stufen - siehe oben) gegenseitig aus (ein verschlüsseltes PDF kann den Credential-Anhang nicht aufnehmen). Die Credential wird als letzter Schritt über den fertigen Bytes hinzugefügt - nach DPI/EXIF/Farbprofil-Stempelung, PDF/X-Metadaten und Druckmarken.

## Auf einem Smartphone

Die Exportsteuerung liegt hinter der schwebenden **Render**-Schaltfläche, die das **Export**-Sheet öffnet - dieselben Formate, Größe, Kopieren, Herunterladen und Teilen, für Touch dimensioniert.

## Formatreferenz

Jede ID, die der Host rendern kann, gruppiert. Dies sind auch die Werte für den URL-Parameter `format=` und das CLI-Flag `--export=` - siehe [URL Mode](/info/url-mode.html) und [CLI](/info/cli.html). Ein Tool bietet nur die Teilmenge an, die sein Autor deklariert hat, daher ist der Picker immer kürzer als diese Liste.

| Art | IDs |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (gzipptes SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (Schneiddatei) |
| Seite & Dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (SCORM-Kurspaket, ein Zip) · `penpot` (Penpot-Designdatei) · `docx` (Word) · `odt` (OpenDocument Text) |
| Bewegtbild | `gif` · `apng` (Animiertes PNG) · `webp-anim` (Animiertes WebP) · `svg-anim` (Animiertes SVG) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Text & Daten | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (GIMP-Palette) |
| Bündel | `zip` |

Ein paar weitere IDs stammen aus dem **eigenen Export-Hook eines Tools** statt aus dem gemeinsamen Renderpfad: `ase` (Adobe Swatch Exchange, aus Palette Lab), `exr` und `hdr` (Darkrooms High-Dynamic-Range-Rasterbilder) sowie `ttf`/`otf`/`woff` (Font Convert). Sie wählen ein Format auf dieselbe Weise - der Picker, `format=`, `--export=` - nur die Bytes werden vom Tool selbst gebaut. Font Convert ist die eine Ausnahme: Es transformiert eine Schriftdatei, die *Sie* bereitstellen, daher gibt es für eine bloße URL nichts zu rendern.
