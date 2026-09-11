# Das Brand Studio

Das **Brand Studio** unter `#/start` ist der eine Ort, an dem Sie Ihre Marke gestalten - ihre Logos, Farben, Schrift, den Rest Ihrer Token und die Dateien, die sie verwahrt. Legen Sie es hier einmal fest, und jedes Tool, jede Seite und jeder Export folgt ihr *konstruktionsbedingt*, nicht durch Prüfung.

Änderungen zeigen sich **live in der gesamten App** in der Vorschau, während Sie sie vornehmen, sodass Sie sehen können, wie eine Farbe oder Schrift überall ankommt, bevor Sie sie festschreiben. Alles läuft auf dem Gerät: Ihre Markendateien und Token verlassen nie Ihren Rechner (die Auswahl einer Google-Schrift lädt diese eine Schriftfamilie einmalig von Google, nach einem Zustimmungsdialog), und die Marke reist als einzelne [Brand-Pack](#move-a-brand-between-devices)-Datei.

> **Dies ist der Editor. Das Dashboard ist der Spiegel.** Der Tab **Design-System** im Dashboard (`#/d`) *zeigt* Ihre Marke schreibgeschützt an; *bearbeiten* tun Sie sie hier unter `#/start`. Wenn Sie später eine Farbe ändern möchten, kommen Sie zurück zum Brand Studio.

## Die Räume

Das Studio ist eine Reihe von **Räumen**, aufgelistet in einer Leiste an der Seite - keine Schritte. Nichts ist nummeriert, nichts hängt von etwas anderem ab, und in jedem von ihnen anzukommen ist legitim:

- **Überblick** - der Ausgangspunkt. Was gerade vorhanden ist, auf einen Blick, mit einer Tür in jeden Raum.
- **Farben** - Farben einzeln hinzufügen, Rollen zuweisen oder eine ganze Palette aus einer erzeugen.
- **Schrift** - die vier Schriftschnitte, die die App, Ihre Tools und jeder Export lesen.
- **Logos** - Ihre Marken, in jeder Ausrichtung und Behandlung.
- **Token** - Eckenradius, Abstände, Schatten und der Rest des Systems.
- **Dateien** - die Bild-, Audio- und Bewegtbild-Dateien, die Ihre Marke verwahrt.

Auf einem Telefon wird dieselbe Liste zu einem horizontalen Chip-Streifen unter dem Header. Der Raumwechsel lädt nie etwas neu - der Editor behält alle seine Panels geladen und zeigt einfach das an, um das Sie gebeten haben.

**Verlinken Sie direkt zu einem Raum** mit `#/start?area=<key>`. Die Schlüssel sind `overview`, `color` *(beachten Sie die US-Schreibweise in der URL)*, `type`, `logos`, `tokens`, `catalogue` (der Files-Raum - der Panel-Schlüssel ist ein dauerhafter Vertrag, daher behält die URL den alten Namen) und `versions`. `?tab=` ist der seit langem bestehende Alias für dasselbe und wird weiterhin aufgelöst, sodass alte Links und Lesezeichen funktionsfähig bleiben; alles Unbekannte öffnet Overview, statt ins Leere zu laufen.

Am **unteren Ende der Leiste** angeheftet sind die Aktionen, die zum gesamten Designsystem gehören und nicht zu einem einzelnen Raum:

- **Add from…** - der Quellenwähler, um eine Marke aus einer Datei, einem PDF, einem Bild, einer Schrift oder einer Website zu übernehmen. Siehe [Eine Marke einbringen](#bring-a-brand-in) weiter unten.
- **Tray** - die Kandidaten, die ein Scan gefunden, aber noch nicht übernommen hat. Er bleibt verborgen, bis ein Scan tatsächlich etwas behält, und trägt dann eine Zahl; nichts darin ändert Ihre Marke, bevor Sie bei dieser Zeile auf Add drücken.
- **Export** - schreibt die gesamte Marke als eine `LollyBrand-…zip`.
- **Tokens (.json)** - das reine Design-Tokens-Dokument für sich allein, für ein Repo, einen Build-Schritt oder ein anderes Tokens-Tool.
- **Versions** - veröffentlicht, aktiviert und stellt benannte Kopien des Designsystems wieder her. Verborgen, bis es etwas Eigenes zum Veröffentlichen gibt (oder ein `?area=versions`-Link ausdrücklich danach verlangt).

![Die Studio-Raumleiste - Overview, Colours, Type, Logos, Tokens und Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview ist der Raum, in dem Sie landen, und er hat zwei Gesichter.

Wenn **noch nichts eingerichtet ist**, bietet er zwei Türen - **Start from a file** (Design-Tokens, ein Penpot-Projekt, ein Design-System-Paket oder eine SVG) und **Start from scratch** (eine Farbe hinzufügen, dann weitermachen, wann immer Sie wollen) - sowie einen dezenten **Explore the tools**-Ausgang darunter, denn auch das Gehen ist eine legitime Antwort.

Sobald ein Designsystem existiert, zeigt derselbe Raum **was Sie haben**: die Palette und ihre Farbanzahl, die geltenden Schriftfamilien, wie viele Logo-Plätze belegt sind, wie viele Tokens es gibt und den Files-Raum. Jeder Block ist eine Tür in seinen Raum. Hier gibt es Zählungen, nie eine Fortschrittsleiste und nie eine Abschlusskarte - in diesem Studio ist nichts geschuldet.

## Logos

Beginnen Sie damit, Ihren Ordner voller Zeichen in die Ablagezone oben zu leeren: **"Drop marks here, or choose several at once"** nimmt so viele Dateien entgegen, wie Sie auf einmal haben. Jede Datei wird auf ihre Form und ihre Farbe hin gelesen und dann unter **Waiting for a slot** als Chip eingereiht, der sagt, was er vermutet - *"Looks like the Horizontal primary"*, mit dem Maß, auf dem das beruht, und einer **Place**-Schaltfläche (**Replace**, wo dieser Platz bereits belegt ist). Wo er sich nicht sicher ist, sagt der Chip das offen und bietet stattdessen **Change slot** an, der alle acht auflistet. Nichts wird platziert, bevor Sie etwas drücken.

Rund um diese Warteschlange geschehen zwei Dinge. Ein Zeichen mit überschüssigem leerem Rand erhält zuerst ein **Zuschnittsangebot** - beantworten Sie es oder drücken Sie Escape, dann geht die Originaldatei unverändert ein. Und wo ein Zeichen einen leeren Nachbarplatz füllen kann, bietet der Raum die abgeleitete **Mono**- oder **Reverse**-Version als eigenen Chip an, markiert als *Generated*, der wieder verschwindet, sobald Sie diesen Platz anderweitig füllen.

Darunter liegt das Raster, in dem jedes Zeichen landet - Plätze aus **Ausrichtung × Behandlung**:

- **Ausrichtungen:** Horizontal (Wortmarke + Symbol in einer Reihe) und Vertical (gestapelt, für quadratische und hohe Flächen).
- **Behandlungen:** Primary, Primary reverse (für dunkle Hintergründe), Mono (eine Farbe) und Mono reverse.

Das sind acht optionale Plätze. Klicken Sie auf einen Platz, um ein PNG, SVG, JPEG oder WebP hinzuzufügen; klicken Sie auf einen belegten Platz, um ihn zu ersetzen. Jeder Platz ist optional, und alles bleibt auf diesem Gerät.

![Die Logo-Matrix - jede Ausrichtung oben, jede Behandlung als eigener gestrichelter Platz, alle optional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - fügen Sie unter **Custom marks** Zeichen hinzu, die Ihre Marke auf ihre eigene Art benennt (ein Icon, ein Wappen, ein Favicon); benennen Sie es und wählen Sie eine Datei.
- **More identities** - eine Submarke, ein Produkt oder ein Event kann einen eigenen vollständigen Logosatz haben. Nutzen Sie **+ Add another logo** und benennen Sie ihn; Ihr Hauptsatz heißt schlicht "Your logo".
- **Laden Sie ein SVG hoch, und Lolly liest seine Farben.** Bei einer brandneuen Installation setzt es leise Ihre Primärfarbe aus dem Logo und sagt Ihnen das. Bei einer bestehenden Marke bietet es die Farbe stattdessen als Vorschlag an - *"Found in the logo: #…"* mit einer **Use as primary**-Schaltfläche daneben - drüben im Colours-Raum, wo Sie sie annehmen oder verwerfen können.

## Colours

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Der reichhaltigste Raum, in zwei Bereichen. Links arbeiten Sie; rechts ist Ihre **Live-Palette**. Ziehen Sie die Trennlinie zwischen ihnen, um die Größe anzupassen (Enter darauf klappt die Palette aus dem Weg).

![Der Colours-Raum - eine Primärfarbe leitet Verläufe ab, Musterkarten mit Kontrastverhältnissen und eine Live-Palette](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Fügen Sie eine Farbe hinzu und geben Sie ihr dann eine Aufgabe

**Add a colour** ist der ganze einfache Weg: Fügen Sie eine Farbe in beliebiger Notation ein oder wählen Sie sie aus, und sie wird genau ein Token. Nichts wird davon abgeleitet, nichts wird hineingedacht, nichts weiter wird verlangt. Fügen Sie eine ganze *Liste* von Farben ein, und jede wird zu einem Chip, den Sie einzeln hinzufügen können.

**Roles** ist die Schicht darüber - welche Farbe welche Rolle spielt. Rollen sind optional (ein Designsystem aus drei losen Farben ohne Rollen ist völlig in Ordnung), jede Farbfläche kann eine annehmen, und der Kontrastwert wird gegen die Fläche gemessen, zuerst nach APCA.

### Die Experten-Flügel

Unter diesen beiden liegen vier eingeklappte Abschnitte. Öffnen Sie den gewünschten; jeder ist direkt verlinkbar als `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - eine Farbe wird zu einem vollständigen Satz von Schattierungen. Unten beschrieben.
- **Shade curves** (`focus=curves`) - formen Sie einen Verlauf Punkt für Punkt um. Helligkeit, Chroma und Farbton haben jeweils eine eigene Kurve, umschaltbar mit L / C / H, und die Schattierungen darunter werden live neu berechnet, während Sie ziehen.
- **Contrast** (`focus=contrast`) - **Contrast-lock** stimmt einen Verlauf neu ab, um APCA-Zielwerte gegen einen von Ihnen gewählten Hintergrund zu erreichen, wobei jede Stufe ihren eigenen Farbton und ihre Chroma behält; **Rotate hue** dreht den gesamten Verlauf körperlich um das Farbrad, wobei jede Schattierung ihre Helligkeit und Chroma behält.
- **Print** (`focus=print`) - was aus der Primärfarbe im Druck wird: ihr automatischer Rasterwert, oder stattdessen ein festgelegter CMYK-Aufbau oder eine benannte Schmuckfarbe.

### Eine Farbe, eine ganze Palette

Innerhalb von **Generate a starter palette** wählen Sie eine **Primary colour**, und Lolly errechnet eine vollständige Palette - helle und dunkle Flächen, Text, Akzente und vollständige Tönungs-/Schattierungsverläufe - mit derselben perzeptiven Farbmathematik (OKLCH), die die Engine überall verwendet. Stellen Sie die Ableitung fein ein:

- **Scheme** - Mono, Complement, Analogous oder Triad - legt fest, wie die Sekundärfarbe zu Ihrer Primärfarbe steht.
- **Shades** - ein Schieberegler von 3 bis 20 (Standard 5) bestimmt, wie viele Stufen jeder Verlauf erzeugt.
- **Fine-tune** (eingeklappt) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) und **Text on brand** (Auto / Light / Dark).

Nichts in diesem Flügel schreibt irgendetwas in Ihre Marke. Es ist eine Vorschau, live in der ganzen App, damit Sie sie beurteilen können, bis Sie **Replace palette** (unten) drücken.

Unter der Primärfarbe sehen Sie die Live-Verläufe **Primary / Neutral / Secondary / Blend** sowie Light- und Dark-Musterkarten, jede mit ihrem eigenen Kontrastwert - das WCAG-Verhältnis mit der APCA-`Lc`-Zahl daneben. **Klicken Sie auf eine Stufe im Neutral- oder Secondary-Verlauf**, um diese Schattierung statt des abgeleiteten Standards zu verankern.

![Die vier Verläufe übereinander, über den Light- und Dark-Musterkarten, jede mit eigenem WCAG-Kontrastverhältnis](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Bauen Sie Ihre Palette (Harmonie-Generator)

Noch im selben Flügel erzeugt **Build your palette** passende Akzentfarben aus Ihrer Primärfarbe. Wählen Sie eine **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** oder **Analogous** (was seine eigene **Accents**-Anzahl von 2 bis 5 sowie einen Farbton-**Angle** von 10° bis 45° mitbringt) - und jeder Kandidat kommt mit einem automatisch erzeugten, menschenlesbaren Namen und einer **+ Add**-Schaltfläche. Das Hinzufügen legt diese Farbe sofort in Ihre Palette, ein Druck für ein Token. *"Your palette, applied"* zeigt den gesamten Satz an echten Grafiken in der Vorschau.

![Erzeugte Akzente, jeder mit einer Farbfläche, einem automatisch erzeugten Namen, seinem Hex-Wert und einer Add-Schaltfläche](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Eine erzeugte Palette übernehmen

**Replace palette** ist die einzige Steuerung in diesem Flügel, die etwas schreibt, und sie schreibt es nie sofort. Drücken Sie sie, und zuerst öffnet sich eine Prüfkarte, überschrieben mit **"Replace the palette?"**, die genau auflistet, was gleich geschieht: wie viele Rollen so bleiben, wie Sie sie zugewiesen haben, wie viele selbst hinzugefügte Farben erhalten bleiben, wie viele Schattierungskurven neu verankert werden, wie viele Druckfestlegungen neu verankert werden, wie viele verborgene Schattierungen verborgen bleiben, wie viele Verlaufsstopps ihre Farbe behalten.

**Replace palette** auf dieser Karte übernimmt sie; **Cancel** verlässt sie, ohne etwas zu ändern. Nachdem sie ausgeführt wurde, wird die Karte zu **"Palette replaced."** mit einer bereits fokussierten **Undo**-Schaltfläche - und ein Prüfpunkt des gesamten Designsystems wird *vor* dem Wechsel angelegt, sodass "stelle es wieder her, wie es war" eine Wiederherstellung ist und kein verlorener Nachmittag.

### Die Palette, das Diagramm und jede Farbfläche

Der rechte Bereich listet jede Farbe auf, die Ihre Marke trägt, gruppiert (Primary, Neutral, Secondary, Spectrum, Custom, Roles), jede Gruppe einklappbar mit eigenem **+ Add**. Darunter klappt **Colour chart** auf zwei Ansichten derselben Farbflächen auf: das **Wheel** (das OKLCH-Rad - ziehen Sie einen Punkt, um ihn umzufärben, klicken Sie auf einen Punkt, um ihn zu bearbeiten, oder klicken Sie auf leeren Raum, um eine neue Farbfläche abzulegen) und das **Gamut**-Diagramm, das zeigt, wo der darstellbare Bereich tatsächlich endet. `#/start?area=color&focus=chart` öffnet die Karte direkt, ebenso wie `?wheel` es immer schon tat.

![Der Palettenbereich, jede Gruppe einklappbar, mit der Download-Pille am unteren Rand](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Das OKLCH-Rad - der Winkel steht für den Farbton, der Abstand von der Mitte für das Chroma, und die Grautöne verlaufen seitlich auf einer Helligkeitsschiene](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klicken Sie auf eine beliebige Farbfläche, um deren Editor zu öffnen:

- **Umbenennen**.
- **Farbe festlegen** - der Farbwähler öffnet mit perzeptuellen **OKLCH**-Reglern, mit Modi für **Hex**, **HSL**, **RGB** und **CMYK**; das Wertefeld liest *und* schreibt in dem jeweils aktiven Farbraum, sodass Sie einen Hex-Wert einfügen oder Farbanteile in Prozent eingeben können. Beachten Sie: Die Eingabe von CMYK legt die *Bildschirm*farbe per Umrechnung fest - um exakte Druckfarben festzulegen, verwenden Sie die Drucksperre weiter unten.
- **Gespeichert als** - legen Sie fest, wie die Farbe gespeichert wird: **LCH** (Standard - perzeptuell, weiter Farbraum, die beste Wahl zum Bearbeiten), Hex, RGB oder HSL. Überschreiben Sie dies, wenn Sie einen exakten alten Hex-Wert oder einen sRGB-Wert festhalten müssen.
- **Verwenden als** - weisen Sie dieser Farbe direkt eine der Markenrollen zu, ohne zum Rollen-Panel zurückzukehren. (Die Kachel einer Rolle selbst bietet dies nicht an - eine Rolle kann keine Rolle übernehmen.)
- **Druckersatz** (eingeklappt) - das Druckverhalten der Farbe festlegen:
  - **CMYK** - von **Auto** auf **Gesperrt** umschalten, um die automatische sRGB→CMYK-Umrechnung durch exakte Druckfarbwerte zu ersetzen (C/M/Y/K, 0–100).
  - **Sonderfarbe** - von **Keine** auf **Festgelegt** umschalten, um die Farbe auf eine Sonderfarbe zu sperren; vergeben Sie einen **Namen** (z. B. `PANTONE 186 C`), optional ein **Farbbuch** und optional eine **Veredelung** (standardmäßig Normale Druckfarbe) für den Fall, dass es sich gar nicht um eine Druckfarbe handelt - eine Folie, eine Prägung (erhaben oder vertieft), einen Schmucklack, eine Soft-Touch-Veredelung oder einen Stanz-, Rill- oder Perforationsschnitt.
- **In anderen Farbräumen** (eingeklappt) - dieselbe Idee erweitert: jede Zeile ist ein Farbraum, in dem diese Farbe ausgedrückt werden kann, entweder abgeleitet vom kanonischen Wert oder von Ihnen selbst festgelegt, wobei ein selbst festgelegter Wert beim Export Vorrang hat.

Diese Drucksperren sind das, was eine Druckerei verwendet, wenn Sie ein CMYK-PDF oder -TIFF exportieren - siehe [Exportieren](/info/exporting.html#colour-profiles).

**Eine Farbe zu löschen** ist sicher: abgeleitete Verlaufsstufen und Theme-Rollen werden *ausgeblendet* (das zugrunde liegende Token wird weiterhin aufgelöst, sodass nichts nachgelagert kaputtgeht), während selbst hinzugefügte Farben vollständig entfernt werden.

### Verläufe

Ein optionales Panel **Verläufe** erzeugt Übergangs-Tokens aus Ihrer Palette für Hintergründe und Akzente. Überspringen Sie es ganz, wenn Ihre Marke keine Verläufe verwendet. Jeder Verlauf hat eine Vorschau, benannte Stopps (2–8) und einen Winkel. Das entscheidende Verhalten: **ein Stopp verweist auf eine Farbe**, ändern Sie also diese Farbe, folgt der Verlauf. Die Interpolation läuft in OKLCH für saubere Übergänge. Löschen Sie einen Stopp, um die Reihe zu kürzen.

### Die Palette anderswo nutzen

Die schwebende Pille am unteren Rand des Paletten-Bereichs lädt die gesamte Palette als **Design Tokens (JSON)**, **CSS-Variablen**, **CSS-Klassen**, **SCSS-Variablen**, eine **GIMP-Palette (.gpl)** oder ein **Adobe Swatch Exchange (.ase)** herunter - sodass die Marke direkt in Illustrator, Figma, GIMP oder ein Stylesheet übernommen werden kann. Sie sitzt außerhalb des Scrollbereichs des Panels und behält daher ihren Platz, egal wie weit die Palette gescrollt wird. (Sie können die Palette auch aus der Ansicht [Katalog](/info/using.html) herunterladen.)

## Schrift

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Der Raum beginnt mit **vier Rollenkarten** - den vier Schriftarten, die die App, Ihre Tools und jeder Export tatsächlich verwenden. Jede Karte zeigt, was diese Rolle gerade bedient, gesetzt in dieser Schriftart, mit einer Zeile echtem Text darunter:

- **Primär** - Fließtext, Buttons und jedes Tool.
- **Überschriften** - die Display-Schriftart für `h1`/`h2`.
- **Code** - eine Monospace-Schriftart für Code und Daten.
- **Kursiv** - ein echter kursiver Begleiter für Betonungen, Zitate und Nebenbemerkungen.

Überschriften, Code und Kursiv fallen jeweils auf die primäre Schriftart zurück, bis Sie sie zuweisen, sodass eine Marke mit nur einer Schriftart hier gar keine Entscheidungen treffen muss. Nichts auf einer Karte legt etwas fest: **Change** (Ändern; bzw. **Choose a face** bei einer leeren Rolle) öffnet die **Vergleichsbühne**, beschränkt auf diese Rolle.

![Der Schrift-Raum - die Rollenkarten und eine Live-Schriftprobe jeder Schriftart bei der Arbeit](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Die Vergleichsbühne

Die Bühne öffnet sich **inline im Raum**, nicht in einem Dialog, sodass die Karten, von denen Sie kamen, sichtbar bleiben. Suchen Sie eine Google-Fonts-Familie (Inter, Fraunces, Space Grotesk…) oder ziehen Sie eine Schriftdatei hinein, drücken Sie **Add to the comparison**, und die Kandidaten stehen mit denselben Wörtern nebeneinander, bevor auch nur einer davon installiert wird. Escape bricht ab und gibt die Tastatur an die Karte zurück, von der aus Sie sie geöffnet haben.

Das ist die eine Tür herein, weshalb nichts ungesehen in Ihre Marke gelangt. Unter der Bühne liegen die beiden Verwaltungspanels:

- **Fonts on this device** (Schriftarten auf diesem Gerät) - jede installierte Familie, die Rollen, die sie bedient, und eine Löschfunktion. **Add a face** öffnet hier dieselbe Vergleichsbühne ohne Rolleneinschränkung.
- **Your fonts** (Ihre Schriftarten) - laden Sie eine **TTF**-, **OTF**- oder **WOFF**-Datei von Ihrem eigenen Rechner hoch. Das ist der Weg für eine lizenzierte Unternehmensschrift, die Sie bereits besitzen.

So oder so bleibt die Schriftart auf diesem Gerät, wird in der App, in Ihren Tools und in jedem Export gerendert, für immer offline, und reist mit Ihrem Markenpaket - beim Rendern wird nichts nachgeladen. Alles auf Google Fonts wird unter einer offenen Lizenz (OFL/Apache/UFL) veröffentlicht.

Das Panel **Type roles** (Schriftrollen) am unteren Ende zeigt eine Live-Schriftprobe jeder Rolle - Fließtext und UI in der Primärschrift, eine optionale Display-Schrift für die obersten Überschriften, eine Kursive für Betonungen, eine Monospace-Schrift für Code und Daten - sodass Sie das gesamte Set im Zusammenspiel sehen können.

![Die Schriftrollen-Probe - Überschrift, Fließtext, Kursiv und Code, jeweils in der Schriftart gesetzt, die dieser Rolle zugeordnet ist, mit dem Schriftnamen daneben](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokens

Der Rest des Design-Systems, bearbeitbar ohne Code anzufassen:

![Der Tokens-Raum - ein Regler für Eckenradien sowie Abstände, Größen, Schatten und der Rest des Systems](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Abgerundete Ecken** - ein einzelner Radius-Regler (0–1.5rem), dem Karten, Buttons und Panels in der gesamten App folgen.
- **Weitere Tokens** - fügen Sie **Abstände**, **Größen**, **Strichstärke**, **Deckkraft**, **Rotation**, einfache **Zahlen** und **Schatten** hinzu und bearbeiten Sie sie. Wählen Sie einen Typ, benennen Sie ihn (*Gutter, Card shadow…*) und legen Sie seinen Wert fest. Diese werden als standardmäßige [Design Tokens](/info/design-tokens.html) (DTCG) gespeichert und reisen mit Ihrer Marke.

## Dateien

Legen Sie hier die Dateien ab, die Ihre Marke aufbewahrt - abgesehen von Logos: **Vektor**-, **Bild**-, **Audio**- und **Bewegtbild**-Assets (Video, Lottie, animiert). Sie landen in Ihrem [Katalog](/info/using.html), nach Bereichen sortiert und in der Asset-Auswahl jedes Tools bereit. Alles bleibt auf diesem Gerät. (Die Leiste beschriftet den Raum mit **Files** (Dateien); der URL-Schlüssel bleibt `catalogue`, weil ein Panel-Schlüssel ein dauerhafter Vertrag ist.)

## Eine Marke importieren

**Add from…** am unteren Ende der Leiste öffnet eine zweistufige Auswahl. Die erste Stufe fragt, was Sie *haben*, nicht welches Format es ist:

- **Design Tokens oder eine Design-Datei** - DTCG- oder Tokens-Studio-JSON, ein Penpot-Projekt, ein **Zip mit Token-Sets**, ein Lolly-Design-System-Paket oder eine SVG.
- **PDF** - eine Präsentation oder eine Richtliniendatei, auf diesem Gerät gelesen für ihre Farben, ihre Marken und ihre eingebetteten Schriftarten.
- **Bild** - ein Screenshot oder ein Foto; dessen Farben werden auf diesem Gerät gelesen, und nichts wird hochgeladen.
- **Schriftdatei** - TTF, OTF oder WOFF. Öffnet den Schrift-Raum, in dem die Schriftart installiert wird.
- **Website** - eine einzelne Seite, gelesen für ihre Farben und Schrift. Diese Kachel erscheint nur auf einem Gerät, das tatsächlich eine Seite lesen kann, denn eine deaktivierte Kachel, die etwas bewirbt, das niemand anklicken kann, ist schlechter als gar keine Kachel. Wo sie erscheint, nennt sie ihre Lesequelle klar: von der App auf diesem Gerät abgerufen, oder über die Browser-Erweiterung in einem Hintergrund-Tab gelesen, angemeldet als Sie. Das Eintragen einer URL *befüllt* das Feld nur vorab - der Abrufen-Button ist die Zustimmung, sodass ein Link, den Ihnen jemand schickt, niemals von sich aus einen Abruf auslösen kann.

Wählen Sie die Design-Datei-Quelle, und die zweite Stufe ist die Karte unten: die akzeptierten Formate führen als Icon-Kacheln in Präferenzreihenfolge an, und die gesamte Karte ist ein einziges Drop-Ziel - klicken Sie irgendwo darauf oder ziehen Sie eine Datei darauf. Sie können eine Datei auch direkt auf das Studio ziehen.

![Die Import-Karte - die akzeptierten Formate führen als Icon-Kacheln an, und die gesamte Karte ist ein einziges Drop-Ziel](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Was jede Design-Datei bietet:

- ein **LollyBrand**-Paket (`.zip`) - installiert in einem Schritt;
- ein **Penpot**-Export (`.penpot`) - übernimmt dessen Design Tokens;
- eine **Design Tokens**-Datei (`.json`) - W3C DTCG;
- eine **Tokens Studio**-Datei (`.json`) - Tokens Studio;
- eine **einfache SVG** (`.svg`) - Lolly scannt deren Farben und lässt Sie auswählen, welche behalten werden sollen, wobei die erste zu Ihrer Primärfarbe wird.

Eine Quell-Installation legt zuerst einen **Checkpoint** an, sodass „Zurück zum Stand vor dem Import“ nur eine Wiederherstellung ist. Und was ein Scan findet, wird nicht direkt übernommen: Kandidaten landen im **Tray**, wo jeder einzeln per eigenem Klick hinzugefügt wird, über den Raum, dem diese Art von Material gehört.

`#/start?source=<kind>` öffnet die Auswahl bei einer bestimmten Quelle (`file`, `pdf`, `image`, `font`, `url`), und `?import` öffnet sie bei der einfachen Liste.

## Eine Marke zwischen Geräten übertragen

**Export** am unteren Ende der Leiste schreibt eine einzelne **`LollyBrand-…zip`** - Ihre Tokens, Schriftarten, Logos und Theme-Präferenz, mit einem Integritäts-Manifest, das beim Wiedereinlesen überprüft wird. Daneben schreibt **Tokens (.json)** das reine Design-Tokens-Dokument für sich: keine Schriftarten, keine Logos, nur die Tokens - genau das, was ein Repo, ein CI-Schritt oder ein anderes Tokens-Tool tatsächlich liest.

Eine zurückzuholen geht über **Add from… → Design tokens or a design file** (oben), oder per Drag-and-Drop auf das Studio. So gibt Ihnen ein Kollege eine Marke weiter, oder so bringen Sie eine zu einer zweiten Installation - kein Konto, keine Cloud. Um eine Marke stattdessen über die Kommandozeile einzubringen, siehe [`ingest:brand`](/info/configuration.html#brand-packs).

## Versionen

**Versionen** am Fuß der Leiste ist der Ort, an dem ein Designsystem aufhört, ein bewegliches Ziel zu sein. Veröffentlichen Sie eine, und Sie erhalten eine **dauerhafte, benannte Kopie**, die auf diesem Gerät verbleibt: Sie ändert sich danach nie mehr, sodass ein Tool, das sie fixiert, immer dasselbe zeichnet. Das Panel bleibt verborgen, bis es etwas Eigenes zu veröffentlichen gibt, sodass ein Studio, das nie veröffentlicht, die Steuerelemente auch nie zu sehen bekommt.

Drei Dinge sollten Sie wissen, bevor Sie irgendetwas drücken, und das Panel nennt alle drei vor dem Drücken, nicht danach:

- **Eine Version ist dauerhaft.** Es gibt noch kein Löschen, daher hält das Panel fest, was aufbewahrt wurde und dass es aufbewahrt bleibt, statt eine Schaltfläche anzubieten, die lügt.
- **Entfernungen führen die Kompatibilitätskarte an.** Hinzugefügte und geänderte Tokens sind Neuigkeiten; ein *entferntes* ist das, was ein Tool zerbricht, daher wird es zuerst genannt und beim Namen genannt.
- **Veröffentlichen lässt sich nicht rückgängig machen; Wiederherstellen schon.** *Aktuellsten Stand aus dieser Version wiederherstellen* ist eine gewöhnliche Bearbeitung des Kopfs, daher landet sie auf dem Undo-Stapel des Studios, und das Panel bietet Ihnen sofort das **Rückgängig** an.

Sie können **Nur veröffentlichen** oder **Veröffentlichen und aktivieren** - der Unterschied besteht darin, ob Tools und die App ab jetzt dieser Version folgen oder weiter Ihrer neuesten Bearbeitung folgen. **Wieder der neuesten folgen** bringt jede Bearbeitung im selben Moment live, in dem sie gemacht wird. `#/start?area=versions` öffnet das Panel direkt.

## Wenn die Marke fest ist

Manche Builds liefern eine **gesperrte Marke** aus - ihre Farben, Schriften und Token sind das, was jedes Tool und jeder Export verwendet, und es gibt nichts zu ändern. In diesem Fall wird das Studio durch einen kurzen Hinweis ersetzt, der erklärt, dass dieser Build mit einer festen Marke ausgeliefert wird und die Bearbeitung deaktiviert ist. Das ist Absicht: So garantiert eine Organisation, dass alles markenkonform bleibt.

## Wie es weitergeht

- **[Lolly benutzen](/info/using.html)** - die Zeichenfläche, Speichern, Projekte und der Katalog.
- **[Design-Token](/info/design-tokens.html)** - das Token-Modell, in dem Ihre Marke ausgedrückt wird.
- **[Exportieren & Formate](/info/exporting.html)** - Druckeinheiten, CMYK und die Formate, in die Ihre Marke gerendert wird.
