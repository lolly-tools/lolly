# Lolly Batch und Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** erstellt viele Versionen eines Designs, etwa eine Karte in einem Dutzend Sprachen oder jede Größe eines Banners. **Lolly Multi-edit** nimmt eine Änderung, etwa ein neues Datum oder eine neue Überschrift, an mehreren verschiedenen gespeicherten Designs vor.

Beide laufen auf Ihrem Gerät und exportieren über denselben Render-Pfad wie die Tools.

::: cols
## Batch

- Eine Vorlage, viele Zeilen. Jede Zeile ist ein Satz von Eingaben und erzeugt eine Datei.
- Füllen Sie die Zeilen durch Tippen, Einfügen aus einer Tabelle oder Importieren einer CSV-Datei.
- Keine Begrenzung der Zeilenanzahl; 50 werden pro Seite angezeigt.
- Öffnet sich über **Lolly Batch** in der Kopfzeile von Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Zwei bis acht verschiedene gespeicherte Designs nebeneinander als Live-Karten.
- Eine Seitenleiste bearbeitet die gemeinsamen Eingaben, dann die eigenen Eingaben jeder Karte.
- Jedes Design wird wieder dort gespeichert, wo es herkam.
- Öffnet sich über **Edit together** in der Auswahlleiste von Projects.
:::

<!--i:eti-table-->
## Viele Versionen eines Designs erstellen

Öffnen Sie die Ansicht **Projects** und drücken Sie **Batch** in ihrer Kopfzeile. Das Raster beginnt mit einer Zeile. Wählen Sie in dieser Zeile eine Vorlage und duplizieren Sie dann die Zeile oder fügen Sie Daten aus einer Tabelle ein. Wenn Sie Batch aus einem Ordner öffnen, gelangen Sie danach in diesen Ordner zurück.

![Batch mit einem neuen Raster: oben der Dateiname und die Zeilenwerkzeuge, in der ersten Zeile die geöffnete Vorlagenliste mit den verfügbaren Tools](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Die Zeilen füllen.** Tippen Sie in eine Zelle oder fügen Sie einen Bereich aus Excel, Google Sheets oder einer anderen Tabelle ein. **Import CSV** fügt Zeilen hinzu oder ersetzt den Batch. Wenn Sie in eine Zelle mit Export-Einstellungen einfügen, fragt Lolly, welche Eingabe jede eingefügte Spalte füllt. **Export CSV** schreibt das Raster in eine Datei. Öffnen Sie **Columns** unter dem Raster, um weitere Eingaben oder Breite, Höhe, Einheit und DPI pro Zeile anzuzeigen. Das **Fill**-Popover einer Zahlen-, Text- oder Auswahlspalte hat außerdem einen Abschnitt **Design token**, der ein Token über die Zeilen der Spalte hinweg verknüpft ([Viele Dokumente auf einmal verknüpfen](/info/token-workflows.html#link-many-documents-at-once)).

**Die Ausgabe festlegen.** Die Werkzeugleiste legt den Dateinamen der ZIP-Datei, **Default format**, Einheiten und DPI für alle Zeilen fest. Das Formatmenü entspricht der gruppierten Liste im Export-Panel mit den Formaten, die der Katalog anbietet und Ihr Browser unterstützt. Eine Zeile mit eigenem Format, eigener Größe oder eigenem Dateinamen behält ihre Einstellung.

**Rendern.** **Render all** exportiert jede Zeile in eine gemeinsame `.zip`. Sind Zeilen ausgewählt, wirken **Render selected**, **Export selected CSV** und **Print selected rows** nur auf diese Zeilen. Heben Sie die Auswahl auf, um wieder den gesamten Batch zu bearbeiten. **Print sheet** ordnet die Zeilen auf einem druckbaren Bogen an. **Batch activity** meldet jeden Import und Rendervorgang und lässt sich einklappen.

**Den Batch behalten.** **Sessions** speichert jede Zeile des Rasters als benannte Batch-Sitzung, unabhängig von der Auswahl. Die Sitzung lässt sich über Projects wieder öffnen. **Folders…** im selben Menü öffnet einen Projects-Ordner als Zeilen, eine pro gespeicherter Sitzung; jeder Dateiname enthält seinen Ordnerpfad.

::: details Zeilen und Zellen auswählen
Wählen Sie Zeilen über ihre Kontrollkästchen aus oder klicken Sie mit gedrückter Umschalttaste auf ein Kontrollkästchen, um einen Bereich auszuwählen. Das Kontrollkästchen in der Kopfzeile wählt die aktuelle Seite aus, und **Select all *N* rows** nimmt auch die Zeilen auf anderen Seiten dazu. Die Auswahl bleibt beim Seitenwechsel erhalten. **Edit input**, **Duplicate** und **Remove** wirken auf die ausgewählten Zeilen, und **Undo remove** stellt die zuletzt entfernten Zeilen wieder her. Hat eine Zelle den Fokus, wählt Umschalt+Leertaste ihre Zeile aus, und Escape hebt die Auswahl auf.

Ziehen Sie über Zellen, klicken Sie mit gedrückter Umschalttaste auf eine Zelle oder verwenden Sie Umschalt+Pfeiltasten, um einen rechteckigen Bereich auszuwählen. **Copy cells** oder Strg+C / Command+C kopiert die Werte für eine Tabellenkalkulation. Strg+A / Command+A wählt bei fokussierter Zelle jede sichtbare Spalte auf jeder Seite aus; bei fokussiertem Zeilen-Kontrollkästchen wählt dasselbe Tastenkürzel jede Zeile aus. Beim Auswählen von Zellen bleiben angekreuzte Zeilen angekreuzt. Doppelklicken Sie auf eine Zelle oder drücken Sie Enter, um ihren Text zu bearbeiten. Fügen Sie einen rechteckigen Bereich aus der Zwischenablage ein oder einen einzelnen Wert, um jede ausgewählte Zelle zu füllen; leere Zellen und mehrzeiliger Text behalten ihre Positionen.
:::

### Farbvarianten und Themes pro Zeile

Jede Zeile behält ihre eigene Theme-Auswahl: hell oder dunkel sowie eine Farbvariante, wenn das Designsystem welche anbietet. Eine Zeile, die aus Projects, einem Ordner oder einem gespeicherten Batch geöffnet wird, verwendet beim Rendern und in der Vorschau die Auswahl, mit der ihre Sitzung gespeichert wurde. Der Druckbogen, eine duplizierte Zeile und eine gefüllte Zeile behalten sie bei.

Eine CSV-Datei enthält die Auswahl in einer Spalte `_themes` nach den Größenspalten. Die Spalte enthält dasselbe JSON wie der Linkparameter `_themes`, zum Beispiel `{"":"dark","colourway":"beach"}`. Eine leere Zelle oder `{}` steht für die Standardwerte des Designsystems. Die Spalte wird nur geschrieben, wenn mindestens eine Zeile eine Auswahl hat. Beim Import wird eine Zelle, die keine gültige Theme-Auswahl enthält, als Problem aufgeführt, und ihre Zeile wird mit den Standardwerten gerendert.

::: note Die Auswahl einer Zeile in der CSV-Datei festlegen
Das Raster hat noch kein Steuerelement, um die Auswahl einer Zeile zu ändern. Legen Sie sie deshalb in der CSV-Datei oder in der gespeicherten Sitzung fest.
:::

### Eine Sprache pro Zeile

Ein Tool, das eigene Formulierungen ausgibt, etwa Certificate, kann eine Spalte `language` mit einem kurzen Sprachcode wie `de`, `ja` oder `ar` verwenden. Jede Zeile gibt dann ihre Formulierungen und ihr Datum in dieser Sprache aus. Arabische und Urdu-Zeilen werden von rechts nach links angeordnet. Eine leere Zelle folgt der Sprache der App. Eine Sprache, für die Lolly noch keine Übersetzung hat, wird einschließlich Datum auf Englisch ausgegeben, sodass ein Zertifikat nie nur halb übersetzt ist.

### Batch oder Render folder

Um bereits gespeicherte Sitzungen erneut zu rendern, wählen Sie sie in Projects aus und verwenden Sie **Render selection** oder **Render folder** für einen ganzen Ordner. [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html#find-something-you-saved) behandelt beides.

<!--i:eti-layers-->
## Mehrere gespeicherte Designs gemeinsam bearbeiten

Kreuzen Sie in **Projects** zwei bis acht gespeicherte Sitzungen an und wählen Sie **Edit together** in der Auswahlleiste. Sie öffnen sich nebeneinander als Live-Karten unter `#/multi?s=<slot>,<slot>…`. Jede Karte ist ein echtes Rendering ihrer Sitzung und zeigt, was exportiert wird.

Eine Seitenleiste steuert sie alle:

- <!--i:sliders--> **Shared** kommt zuerst: jede Eingabe, die zwei oder mehr Sitzungen auf dieselbe Weise deklarieren (gleiche ID, gleicher Typ und gleiche Einschränkungen, nach derselben Regel, die das Batch-Raster für seine Spalten verwendet). Eine Änderung an einem gemeinsamen Steuerelement erreicht jede Sitzung, die diese Eingabe deklariert, live auf jeder Karte. Zwei Sitzungen desselben Tools teilen alle Eingaben; zwei verschiedene Tools teilen nur ihre gemeinsamen Eingaben. Das Menü **Input actions** der Shared-Karte verknüpft ein Design-Token in jeder Sitzung, die diese Eingabe deklariert.
- <!--i:document--> Unter der Shared-Karte enthält **eine eingeklappte Karte pro Sitzung** alle eigenen Eingaben dieser Sitzung, wie in der Seitenleiste des Tools, mit einem kompakten Exportblock: **Format**, **W** / **H**, **Unit**, **DPI** und **Download**. Die Aktion Download speichert zuerst die Sitzung und rendert dann die Datei mit demselben Dateinamen, Format und denselben Content Credentials wie im Tool.
- <!--i:search--> **Filter inputs…** ganz oben grenzt die Steuerelemente auf allen Karten gleichzeitig ein.

Klicken Sie auf eine Karte (oder drücken Sie auf der Karte Enter), um die Seitenleistenkarte dieser Sitzung zu öffnen. **Save all** schreibt jede Sitzung an ihren eigenen Speicherplatz zurück. **Download all** speichert zuerst, rendert dann alle zusammen in eine ZIP-Datei, wie **Render selection** in Projects, und bietet eine optionale Passwortsperre an.

Jede Karte zeichnet mit der Theme-Auswahl ihrer eigenen Sitzung. Das gilt auch für ein Tool, das im Design platziert ist. Die App rund um die Karten behält ihre eigenen Farben. **Save all**, die Downloads, **Batch grid** und **Send to Print Sheet** behalten die Auswahl jeder Sitzung bei.

### Grenzen

- **Höchstens acht.** Jede Karte lädt ihre eigene Live-Laufzeitumgebung, und acht Karten bleiben reaktionsfähig. Ein Link, der mehr Karten oder eine nicht mehr vorhandene Sitzung anfordert, meldet dies und lädt nicht nur einen Teil.
- **Der Link ist lokal.** Er nennt Ihre eigenen Speicherplätze und öffnet diese Zusammenstellung auf diesem Gerät erneut. Er ist kein Link zum Teilen.
- **Für größere Zusammenstellungen** wählen Sie **Edit as sheet** in derselben Auswahlleiste. Dies öffnet die Auswahl als Zeilen im Batch-Raster (`#/batch?s=…`), ohne Größenbegrenzung und ohne Beschränkung auf dasselbe Tool. Ordner bleiben bei beiden außen vor: Öffnen Sie einen Ordner im Raster mit **Sessions → Folders…** oder rendern Sie ihn mit **Render folder** in Projects.
- **Die Suche erreicht Lolly Multi-edit nicht.** Dies ist die einzige Ansicht, die die Suchleiste nicht abdeckt.

<!--i:eti-map-pin-->
## Nächste Schritte

- **[Eine Datei exportieren](/info/exporting.html)**: die Formate, Größen und Druckeinstellungen, die jede Zeile verwenden kann.
- **[Vorlagen](/info/templates.html)**: Ausgangspunkte für eine gute erste Zeile.
- **[Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html)**: Projects, Ordner und das Rendern gespeicherter Arbeit.
