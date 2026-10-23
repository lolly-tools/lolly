# Batch und Multi-edit

Zwei Aufgaben tauchen auf, sobald Sie oft dieselbe Art von Datei erstellen. Manchmal brauchen Sie viele Versionen eines Designs: eine Karte in einem Dutzend Sprachen oder jede Größe eines Banners. Manchmal haben Sie mehrere verschiedene gespeicherte Designs und wollen, dass eine Änderung alle erreicht, etwa ein neues Datum oder eine neue Überschrift.

**Batch** erledigt die erste Aufgabe und **Multi-edit** die zweite. Beide laufen auf Ihrem Gerät und exportieren über denselben Render-Pfad wie die Tools selbst.

::: cols
## Batch

- Eine Vorlage, viele Zeilen. Jede Zeile ist ein Satz Eingaben und erzeugt eine Datei.
- Füllen Sie die Zeilen durch Tippen, Einfügen aus einer Tabelle oder den Import einer CSV.
- Keine Grenze für Zeilen; 50 werden pro Seite angezeigt.
- Öffnet sich über **Batch** in der Kopfzeile von Projects (`#/batch`).

## Multi-edit

- Zwei bis acht verschiedene gespeicherte Designs, nebeneinander als Live-Karten.
- Eine Seitenleiste bearbeitet die Eingaben, die sie teilen, dann die eigenen jeder Karte.
- Jedes Design speichert dorthin zurück, woher es kam.
- Öffnet sich über **Edit together** in der Auswahlleiste von Projects.
:::

## Viele Versionen eines Designs erstellen

Öffnen Sie **Projects** und drücken Sie in der Kopfzeile **Batch**. Das Raster beginnt mit einer Zeile: Wählen Sie darin eine Vorlage und duplizieren Sie dann die Zeile oder fügen Sie Daten aus Ihrer Tabelle ein. Wird Batch aus einem Ordner heraus geöffnet, bringt es Sie zu diesem Ordner zurück.

![Batch auf einem neuen Raster: oben der Dateiname und die Zeilenwerkzeuge, und die Vorlagenliste der ersten Zeile ist offen und zeigt die Tools, die Sie wählen können](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Die Zeilen füllen.** Tippen Sie in eine Zelle oder fügen Sie einen Block direkt aus Excel, Google Sheets oder einer anderen Tabelle ein. **Import CSV** fügt Zeilen hinzu oder ersetzt den Batch. Wenn Sie in eine Zelle mit Export-Einstellungen einfügen, fragt Lolly, welche Eingabe jede eingefügte Spalte füllt. **Export CSV** schreibt das Raster wieder aus. Öffnen Sie **Columns** unter dem Raster, um mehr Eingaben oder Breite, Höhe, Einheit und DPI je Zeile anzuzeigen.

**Die Ausgabe festlegen.** Die Symbolleiste legt den Dateinamen des Zips, das **Default format**, Einheiten und DPI für jede Zeile fest. Das Formatmenü ist die gruppierte Liste des Export-Panels und zeigt die Formate, die der Katalog bietet und Ihr Browser unterstützt. Eine Zeile mit eigenem Format, eigener Größe oder eigenem Dateinamen behält ihre eigene Einstellung.

**Rendern.** **Render all** exportiert jede Zeile in ein `.zip`. Wählen Sie zuerst Zeilen aus, und **Render selected**, **Export selected CSV** und **Print selected rows** wirken nur auf diese; heben Sie die Auswahl auf, um wieder am ganzen Batch zu arbeiten. **Print sheet** legt die Zeilen auf einem druckbaren Bogen aus. **Batch activity** meldet jeden Import und jedes Rendering und klappt zusammen, um der Tabelle mehr Platz zu geben.

**Den Batch behalten.** **Sessions** speichert das ganze Raster als benannte Batch-Sitzung, die sich später über Projects wieder öffnet. Sessions speichert immer jede Zeile, was auch ausgewählt ist. **Folders…** im selben Menü öffnet einen ganzen Projects-Ordner als Zeilen, eine je gespeicherter Sitzung, wobei jeder Dateiname seinen Ordnerpfad trägt.

::: details Zeilen und Zellen auswählen
Wählen Sie Zeilen mit ihren Kästchen aus oder klicken Sie mit Umschalt auf ein Kästchen für einen Bereich. Das Kästchen der Kopfzeile wählt die aktuelle Seite aus, und **Select all *N* rows** nimmt auch die Zeilen auf anderen Seiten dazu. Auswahlen bleiben beim Wechsel zwischen Seiten erhalten. **Edit input**, **Duplicate** und **Remove** wirken auf die ausgewählten Zeilen, und **Undo remove** stellt die zuletzt entfernten Zeilen wieder her. Aus einer fokussierten Zelle wählt Umschalt+Leertaste diese Zeile aus, und Escape hebt die Auswahl auf.

Ziehen Sie über Zellen, klicken Sie mit Umschalt auf eine Zelle oder nutzen Sie Umschalt+Pfeiltasten, um ein Rechteck auszuwählen. **Copy cells** oder Strg+C / Befehl+C kopiert die Werte für eine Tabelle. Strg+A / Befehl+A aus einer fokussierten Zelle wählt jede sichtbare Spalte auf jeder Seite aus; aus dem Kästchen einer Zeile wählt dasselbe Kürzel jede Zeile aus. Das Auswählen von Zellen lässt angekreuzte Zeilen angekreuzt. Doppelklicken Sie eine Zelle oder drücken Sie Enter, um ihren Text zu bearbeiten. Fügen Sie ein Rechteck aus der Zwischenablage ein oder fügen Sie einen Wert ein, um jede ausgewählte Zelle zu füllen; leere Zellen und mehrzeiliger Text behalten ihre Positionen.
:::

### Farbvarianten und Designs je Zeile

Jede Zeile behält ihre eigenen Design-Entscheidungen: hell oder dunkel und eine Farbvariante, wenn das Designsystem welche hat. Eine Zeile, die aus Projects, einem Ordner oder einem gespeicherten Batch geöffnet wurde, rendert mit den Entscheidungen, in denen ihre Sitzung gespeichert wurde, und ihre Vorschau öffnet sich in ihnen. Der Druckbogen, eine duplizierte Zeile und eine gefüllte Zeile behalten sie alle.

Eine CSV trägt die Entscheidungen in einer Spalte `_themes` nach den Größenspalten, die dasselbe JSON enthält wie der Link-Parameter `_themes`, zum Beispiel `{"":"dark","colourway":"beach"}`. Eine leere Zelle oder `{}` bedeutet die Standardwerte des Designsystems. Die Spalte wird nur geschrieben, wenn irgendeine Zeile Entscheidungen hat, sodass ein Batch ohne solche dieselbe CSV exportiert wie zuvor. Beim Import wird eine Zelle, die keine gültigen Design-Entscheidungen enthält, als Problem aufgelistet, und ihre Zeile rendert mit den Standardwerten. Das Raster hat noch kein Steuerelement, um die Entscheidungen einer Zeile zu ändern; legen Sie sie also in der CSV oder in der gespeicherten Sitzung fest.

### Batch oder Render folder

Batch erzeugt viele Varianten einer Vorlage. Um Sitzungen neu zu rendern, die Sie schon gespeichert haben, wählen Sie sie in Projects aus und nutzen **Render selection**, oder **Render folder** für einen ganzen Ordner; [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html#find-something-you-saved) behandelt beides.

## Mehrere gespeicherte Designs gemeinsam bearbeiten

Kreuzen Sie in **Projects** zwischen zwei und acht gespeicherte Sitzungen an und wählen Sie in der Auswahlleiste **Edit together**. Sie öffnen sich nebeneinander als Live-Karten unter `#/multi?s=<slot>,<slot>…`. Jede Karte ist ein echtes Rendering ihrer Sitzung, sodass das, was Sie sehen, das ist, was exportiert wird.

Eine Seitenleiste steuert sie alle:

- <!--i:sliders--> **Shared** kommt zuerst: jede Eingabe, die zwei oder mehr der Sitzungen gleich deklarieren (gleiche ID, gleicher Typ, gleiche Einschränkungen, die Regel, die das Batch-Raster für seine Spalten nutzt). Bearbeiten Sie ein gemeinsames Steuerelement einmal, und der Wert erreicht jede Sitzung, die die Eingabe deklariert, live auf jeder Karte. Zwei Sitzungen desselben Tools teilen alles; zwei verschiedene Tools teilen nur die Eingaben, die sie gemeinsam haben.
- <!--i:document--> Darunter enthält **eine eingeklappte Karte je Sitzung** alle eigenen Eingaben dieser Sitzung, so vollständig wie die Seitenleiste des Tools selbst, mit einem kompakten Export-Block: **Format**, **W** / **H**, **Unit**, **DPI** und **Download**. Dieser Download speichert zuerst die Sitzung und rendert dann die Datei mit demselben Dateinamen, Format und denselben Content Credentials, die sie vom Tool hätte.
- <!--i:search--> **Filter inputs…** oben schränkt die Steuerelemente auf jeder Karte gleichzeitig ein, sodass Sie "die Überschrift" in acht Sitzungen erreichen, ohne zu scrollen.

Klicken Sie eine beliebige Karte an (oder drücken Sie Enter darauf), um die Seitenleistenkarte dieser Sitzung zu öffnen. **Save all** schreibt jede Sitzung in ihren eigenen Slot zurück. **Download all** speichert zuerst und rendert dann den ganzen Satz in ein Zip, auf dieselbe Weise wie **Render selection** in Projects, wobei unterwegs die optionale Passwortsperre angeboten wird.

Jede Karte zeichnet mit den Design-Entscheidungen ihrer eigenen Sitzung, einschließlich eines Tools, das in das Design eingesetzt ist. Karten in verschiedenen Looks stehen nebeneinander, während die App um sie herum ihre eigenen Farben behält, und **Save all**, die Downloads, **Batch grid** und **Send to Print Sheet** behalten die Entscheidungen jeder Sitzung.

### Grenzen

- **Höchstens acht.** Jede Karte startet ihre eigene Live-Laufzeit, und acht ist die Zahl, bei der alles reaktionsfähig bleibt. Ein Link, der mehr verlangt oder eine Sitzung, die es nicht mehr gibt, sagt das, statt halb zu laden.
- **Der Link ist lokal.** Er nennt Ihre eigenen gespeicherten Slots und öffnet daher diesen Satz auf diesem Gerät wieder. Er ist kein Share-Link.
- **Für alles Größere** wählen Sie in derselben Auswahlleiste **Edit as sheet**. Das öffnet die ganze Auswahl als Zeilen im Batch-Raster (`#/batch?s=…`), ohne Größengrenze und ohne Regel, dass es dasselbe Tool sein muss. Ordner bleiben bei beidem außen vor: Öffnen Sie einen Ordner im Raster mit **Sessions → Folders…** oder rendern Sie einen mit **Render folder** in Projects.
- **Die Suche erreicht Multi-edit nicht.** Es ist die eine Ansicht, die die Suchleiste nicht kennt.

## Wie es weitergeht

- **[Eine Datei exportieren](/info/exporting.html)**: die Formate, Größen und Druckeinstellungen, die jede Zeile nutzen kann.
- **[Vorlagen](/info/templates.html)**: Ausgangspunkte, die eine gute erste Zeile ergeben.
- **[Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html)**: Projects, Ordner und das Rendern des Gespeicherten.
