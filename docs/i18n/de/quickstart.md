# Schnellstart

Lolly verwandelt Ihre Regeln - Farben, Schrift, Layouts, Logik - in Werkzeuge, mit denen jeder fertige Dateien erstellen kann: Bilder, PDFs, Social-Media-Karten, Video, indem er ein paar Felder ausfüllt. Es gibt wenig zu lernen und nichts hochzuladen: Erstellen und Exportieren laufen auf Ihrem Gerät, online wie offline.

Dies ist die eine Seite, die Sie zuerst lesen sollten. Zwei Dinge machen Sie produktiv: **Machen Sie Lolly zu Ihrem eigenen** und **bringen Sie ein, was Sie bereits haben** (Ihre Designdateien und Tokens). Alles Weitere ist nur einen Link entfernt.

> Neu bei Lolly und möchten einfach etwas erstellen? [In 60 Sekunden etwas erstellen](/info/make-something.html) führt Sie durch drei Beispiele, oder [öffnen Sie die App](/#/), wählen Sie ein beliebiges Werkzeug aus der Galerie, füllen Sie die Lücken aus und klicken Sie auf **Export**. Kommen Sie hierher zurück, wenn es *Ihre* Marke tragen soll.

![Die Utilities-Ansicht - die Arbeitspferde auf dem Gerät wie Strip Hidden Data, Compress PDF und Convert Image, alle an einem Ort](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Machen Sie es zu Ihrem eigenen - richten Sie Ihr Design-System ein

Ihre Marke in Lolly ist ein kleines **Design-Tokens**-Dokument - Farben, Schriften und einige wenige Regeln -, an dem sich jedes Werkzeug beim Rendern orientiert. Legen Sie es einmal fest, und alles, was Sie erstellen, ist von der Anlage her markenkonform, nicht erst nach einer Prüfung. Es gibt drei Wege hinein; wählen Sie den, der dazu passt, wo Ihre Marke bereits lebt.

### Von Grund auf neu beginnen (der Design-System-Baukasten)

Beim ersten Start landen Sie in der **Galerie**, darüber ein kurzer Willkommensdialog mit drei Wegen hinein - **Machen Sie es sich zu eigen** (das Brand Studio unter `#/start`), **Bringen Sie Ihr Design mit** (legen Sie eine Figma-, Penpot-, InDesign- oder PDF-Datei ab, und sie öffnet sich als bearbeitbares Layout - der schnellste Weg zu [Bringen Sie ein, was Sie bereits haben](#2-bring-in-what-you-already-have) weiter unten) und **Community-Tools entdecken** - dazu eine Reihe von Sprachen, falls Englisch nicht Ihre ist. Nehmen Sie die erste Karte, und Sie landen im [**Brand Studio**](/info/brand-studio.html). Geben Sie ihm einen Namen und eine Primärfarbe, und Lolly *leitet* daraus eine vollständige, barrierefreie Palette ab - helle/dunkle Oberflächen, Text, Akzente - mit derselben Farbmathematik, die die Engine überall sonst verwendet.

![Der Raum Farben im Brand Studio - eine Primärfarbe und die barrierefreie Palette, die Lolly daraus ableitet](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Wählen Sie eine Schrift, und Sie haben in weniger als einer Minute eine funktionierende Marke. Von dort führen Sie die sechs Räume des Studios - Übersicht, Farben, Typografie, Logos, Tokens, Dateien - so weit, wie Sie möchten, in beliebiger Reihenfolge, und Sie können jederzeit zurückkommen und alles nachschärfen. Der Tab **Design-System** im Dashboard (`#/d`) zeigt das Ergebnis nur zur Ansicht und verweist zurück auf `#/start`, wo bearbeitet wird (es sei denn, Sie nutzen einen markengesperrten Build von Lolly, bei dem die Marke fest steht und es nichts zu ändern gibt).

### Eine bereits vorhandene Marke importieren

Wenn Ihre Marke bereits als Design-Tokens erfasst ist - aus **Penpot**, **Tokens Studio** (Figma) oder einer einfachen **DTCG**-Datei -, bringen Sie sie komplett mit, anstatt sie erneut einzutippen. Zwei Wege:

- <!--i:palette--> **In der App:** Der [Design-System-Baukasten: Brand Studio](/info/brand-studio.html) (`#/start`) nimmt sie über **Add from…** am Fuß der Raumleiste entgegen - eine Token-Datei, einen Penpot-Export, ein SVG oder ein `LollyBrand`-Paket. Legen Sie sie ab, und die Palette erwacht zum Leben.
- <!--i:code--> **Über die Kommandozeile**, um ein wiederverwendbares Markenpaket aufzusetzen:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` akzeptiert alle drei Containerformen, in denen Penpot / Tokens Studio dasselbe Dokument exportieren - eine einzelne `tokens.json`, ein Verzeichnis (`$metadata.json` + Dateien pro Set) oder ein `project.penpot`-Archiv. Mit `--activate` registriert es die Marke als Profil, wechselt zu ihr und baut den Katalog neu auf. Siehe [Konfiguration](/info/configuration.html) dafür, wie Markenpakete und Profile zusammenpassen.

### In der App feinabstimmen

Sobald eine Marke aktiv ist, formen Sie sie im [**Brand Studio**](/info/brand-studio.html) (`#/start`) weiter - ändern Sie eine Farbe oder eine Rolle, und jede Vorschau in der App aktualisiert sich während der Eingabe. (Der Tab **Design-System** im Dashboard unter `#/d` *zeigt* die Marke nur an; bearbeitet wird sie im Studio.)

![Der Tab Design-System im Dashboard - die aktive Marke, nur zur Ansicht](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Dieselbe Marke wird auf der Karte **Profil → Ihre Marke** zusammengefasst. Schriften sind echt: Wählen Sie aus Google Fonts, und Lolly speichert die Datei **auf Ihrem Gerät** als Marken-Asset, sodass Ihre Typografie offline verfügbar bleibt und beim Rendern nichts abgerufen wird.

Wenn Sie zufrieden sind, **exportieren Sie die Marke als `LollyBrand`-Paket** - eine einzelne Datei, die ein Kollege importieren kann, um exakt dieselbe Palette, dieselben Schriften und Regeln zu erhalten. So bewegt sich eine Marke zwischen Menschen und Maschinen, ohne dass ein Server dazwischensteht.

> **Marken-Tokens funktionieren in beide Richtungen.** Da Lollys Marke DTCG-Tokens *ist* - das Format, das Penpot nativ liest und schreibt und das Tokens Studio zu Figma bringt -, sind die Palette, mit der Sie *gestalten*, und die Palette, die Lolly *durchsetzt*, ein einziges Dokument und keine zwei Listen, die Sie von Hand synchron halten müssen. Siehe [Design Tokens](/info/design-tokens.html).

## 2. Bringen Sie ein, was Sie bereits haben

Sie beginnen nicht bei null. Lolly öffnet die Designarbeit und die offenen Formate, die Sie bereits besitzen.

### Open-Source-Designdateien

Fertige Arbeiten aus **Figma, Penpot, Illustrator, InDesign oder einer beliebigen SVG-App** müssen nicht in der App eingeschlossen bleiben, in der Sie sie gezeichnet haben. Öffnen Sie **Design**, klicken Sie auf **Ein Design importieren**, und die Datei öffnet sich als *lebendiges Layout* - kein flaches Bild. Jede Ebene wird zu einer bearbeitbaren Box: Text bleibt neu eintippbar, Formen bleiben Formen, Bilder landen in Ihrer Bibliothek und komplexe Vektorgrafiken bleiben originalgetreu erhalten. Sie kommt bereits an Ihre Markenschriften und Farbregeln angepasst an.

| Sie haben | Bringen Sie es ein als |
|---|---|
| Ein Figma-Frame | Nativ `.fig` (Datei → Lokale Kopie speichern) oder ein SVG-Export |
| Ein Penpot-Design | Sein `.penpot`-Export oder eine beliebige SVG |
| Eine Illustrator-Datei | Nativ `.ai` (PDF-kompatibel) oder `.pdf` - öffnet sich direkt |
| Ein InDesign-Layout | `.idml` (Datei → Exportieren → InDesign-Markup) |
| Alles andere | **Beliebige SVG** - die universelle Tür hinein |

Der gesamte Import erfolgt **auf Ihrem Gerät** - die Datei wird in Ihrem Browser verarbeitet, und nichts wird hochgeladen. Alle Details und was genau übernommen wird, finden Sie unter [Ein Design importieren](/info/design-import.html).

Stattdessen ein **PowerPoint-Deck**? Legen Sie die `.pptx` auf **Deck Builder**, um es Folie für Folie zu bearbeiten, schon auf Ihre Marke gesetzt - oder starten Sie **Ein Deck rebranden**, und Sie bekommen dasselbe Deck neu eingefärbt zurück, mit Diagrammen und Animationen intakt.

### Vom Einzelstück zur Vorlage

Und hier liegt der Gewinn: Ein importiertes Layout ist eine ganz normale Design-Sitzung. Sobald Sie es **speichern**, lebt es unter einer URL. Jeder mit Lolly kann diese URL öffnen, die Wörter ändern, ein Bild austauschen und seine eigene Version rendern - ohne Design-App, und die gesperrten Teile bleiben gesperrt. Aus einem einmaligen Design wird ein wiederverwendbares Werkzeug. Das ist die ganze Idee, erreicht ohne eine einzige Zeile Konfiguration.

### Offene Daten und offene Werkzeuge

Die [Community-Werkzeugsammlung](/info/builders.html) ist Open Source und markenunabhängig - QR-Codes, Stadtpläne, Filter, Datenschutz-Werkzeuge - und rendert gegen *Ihre* Marke, sobald Sie sie aktivieren.

Füttern Sie die Werkzeuge auch mit Ihren eigenen offenen Daten: Fügen Sie eine **CSV**- oder **JSON**-Tabelle ein oder legen Sie sie ab, und die sich wiederholenden Felder eines Werkzeugs werden daraus befüllt - ein fertiges Asset pro Zeile.

## 3. Erstellen Sie etwas - und teilen oder automatisieren Sie es

Mit einer aktiven Marke und Ihrem Material zur Hand erzeugt jedes Werkzeug eine fertige Datei:

- <!--i:download--> **Rendern** Sie jedes Werkzeug als **SVG, PDF, PNG, JPG, WebP, Video** und mehr - bei Bedarf in echten Druckgrößen und physischen Einheiten. Siehe [Export & Formate](/info/exporting.html).
- <!--i:link--> **Teilen Sie einen Link.** Jeder Werkzeugzustand ist eine URL, sodass ein fertiges Asset reproduzierbar und über Parameter adressierbar ist - committen Sie den Link, erzeugen Sie ihn bei Bedarf neu.
- <!--i:layers--> **Erledigen Sie es in Serie.** Steuern Sie eine Vorlage über eine Tabellenkalkulation im [Batch-Raster](/info/exporting.html): ein fertiges Asset pro Zeile.
- <!--i:cpu--> **Automatisieren Sie es.** Derselbe Render-Vorgang läuft über die [CLI](/info/cli.html) und über einen [KI-Agenten](/info/ai-agents.html) - eine URL ist die API.

„Eine URL ist die API“ ist wörtlich zu nehmen. Das Diagramm unten hat niemand gezeichnet: Sein Typ, seine Überschrift und die gesamte Datentabelle wurden in die Adresszeile eingetippt, und derselbe Link rendert auf jedem Gerät dasselbe Diagramm.

![Ein Flächendiagramm monatlicher Anmeldungen, dessen sämtliche Werte als Query-Parameter statt per Klick ankamen](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Wie es weitergeht

Drei Wege, je nachdem, was Sie hier vorhaben:

- <!--i:people--> **[Lolly für Kreative](/info/creators.html)** - Sie erstellen Dinge. Die Vorteile und wie Sie das Meiste aus der App herausholen.
- <!--i:code--> **[Lolly für Entwickler](/info/builders.html)** - Sie verfassen Werkzeuge, integrieren und stellen bereit. Die technische Dokumentation.
- <!--i:shieldcheck--> **[Lolly für Betreiber](/info/operators.html)** - Sie sind verantwortlich für Marke, Sicherheit und Rollout in einer Organisation.
