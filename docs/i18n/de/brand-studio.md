# Das Brand Studio

Das **Brand Studio** unter `#/start` ist der eine Ort, an dem Sie Ihre Marke gestalten - ihre Logos, Farben, Schrift, den Rest Ihrer Token und die Dateien, die sie verwahrt. Legen Sie es hier einmal fest, und jedes Tool, jede Seite und jeder Export folgt ihr *konstruktionsbedingt*, nicht durch Prüfung.

Änderungen zeigen sich **live in der gesamten App** in der Vorschau, während Sie sie vornehmen, sodass Sie sehen können, wie eine Farbe oder Schrift überall ankommt, bevor Sie sie festschreiben. Alles läuft auf dem Gerät: Ihre Markendateien und Token verlassen nie Ihren Rechner (die Auswahl einer Google-Schrift lädt diese eine Schriftfamilie einmalig von Google, nach einem Zustimmungsdialog), und die Marke reist als einzelne [Brand-Pack](#move-a-brand-between-devices)-Datei.

> **Dies ist der Editor. Das Dashboard ist der Spiegel.** Der Tab **Design-System** im Dashboard (`#/d`) *zeigt* Ihre Marke schreibgeschützt an; *bearbeiten* tun Sie sie hier unter `#/start`. Wenn Sie später eine Farbe ändern möchten, kommen Sie zurück zum Brand Studio.

## Die Räume

Das Studio ist eine Reihe von **Räumen**, aufgelistet in einer Leiste an der Seite - keine Schritte. Nichts ist nummeriert, nichts hängt von etwas anderem ab, und in jedem von ihnen anzukommen ist legitim:

- **Übersicht** - der Knotenpunkt. Was gerade vorhanden ist, auf einen Blick, mit einer Tür in jeden Raum.
- **Farben** - Farben einzeln hinzufügen, Rollen zuweisen oder eine ganze Palette aus einer erzeugen.
- **Schrift** - die vier Schriftschnitte, die die App, die Tools und jeder Export lesen.
- **Logos** - Ihre Marken, in jeder Ausrichtung und Behandlung.
- **Tokens** - Eckenradius, Abstände, Schatten und der Rest des Systems.
- **Dateien** - die Bild-, Audio- und Bewegtbild-Dateien, die Ihre Marke verwahrt.

Auf einem Telefon wird dieselbe Liste zu einem horizontalen Chip-Streifen unter dem Header. Der Raumwechsel lädt nie etwas neu - der Editor behält alle seine Panels geladen und zeigt einfach das an, um das Sie gebeten haben.

**Verlinken Sie direkt zu einem Raum** mit `#/start?area=<key>`. Die Schlüssel sind `overview`, `color` *(beachten Sie die US-Schreibweise in der URL)*, `type`, `logos`, `tokens`, `catalogue` (der Files-Raum - der Panel-Schlüssel ist ein dauerhafter Vertrag, daher behält die URL den alten Namen) und `versions`. `?tab=` ist der seit langem bestehende Alias für dasselbe und wird weiterhin aufgelöst, sodass alte Links und Lesezeichen funktionsfähig bleiben; alles Unbekannte öffnet Overview, statt ins Leere zu laufen.

Am **unteren Ende der Leiste** angeheftet sind die Aktionen, die zum gesamten Designsystem gehören und nicht zu einem einzelnen Raum:

- **Add from…** - der Quellenwähler, um eine Marke aus einer Datei, einem PDF, einem Bild, einer Schrift oder einer Website zu übernehmen. Siehe [Eine Marke einbringen](#bring-a-brand-in) weiter unten.
- **Tray** - die Kandidaten, die ein Scan gefunden, aber noch nicht übernommen hat. Er bleibt verborgen, bis ein Scan tatsächlich etwas behält, und trägt dann eine Zahl; nichts darin ändert Ihre Marke, bevor Sie bei dieser Zeile auf Add drücken.
- **Export** - schreibt das gesamte Designsystem als eine `LollyBrand-….lolly`.
- **Tokens (.json)** - das reine Design-Tokens-Dokument für sich allein, für ein Repo, einen Build-Schritt oder ein anderes Tokens-Tool.
- **Restore brand settings** - kehrt zu einem Checkpoint zurück, der vor einem Import oder einem Ersetzen der Markeneinstellungen gespeichert wurde.
- **Versionen** - veröffentlicht, aktiviert und stellt benannte Kopien des Designsystems wieder her. Verborgen, bis es etwas Eigenes zum Veröffentlichen gibt (oder ein `?area=versions`-Link ausdrücklich danach verlangt).

![Die Studio-Raumleiste - Overview, Colours, Type, Logos, Tokens und Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview ist der erste Raum, und er hat zwei Gesichter.

Mit **noch nichts ausgewählt** heißt es **Machen Sie es sich zu eigen**. **Start from a reference** öffnet den Quellenwähler für ein Logo, einen Screenshot, eine Webseite oder eine Design-Datei. **Farbe auswählen**, **Schriftschnitt auswählen** und **Logo hinzufügen** öffnen direkt ihre vorhandenen Steuerelemente. Jeder Weg beginnt mit einer Entscheidung; das Öffnen eines Wegs schreibt nichts. **Werkzeuge entdecken** steht sofort zur Verfügung.

Sobald irgendetwas Ihnen gehört, zeigt derselbe Raum **was Sie haben**, angeführt von den Zählungen, die Sie erzeugt haben. Colours liest die Anzahl der Farben, die das Designsystem trägt, und ergänzt ein gedämpftes `· N starter` nur dort, wo geerbte Farben zu sehen sind; der Streifen daneben setzt zuerst die Farben, die Sie selbst gewählt haben, dann eine Haarlinie und die verblassten Starter-Farben. Schrift liest nach Rolle (*Inter für Überschriften*, mit *Starter für den Rest · SUSE, SUSE Mono* darunter). Logos liest, wie viele Plätze belegt sind, oder **Nicht festgelegt**. Tokens trägt den Eckenradius, markiert als *starter*, bis Sie ihn verschieben. Dateien sagt **Noch nichts**, solange die Bibliothek leer ist. Jeder Block ist eine Tür in seinen Raum. Es gibt hier Zählungen, nie eine Fortschrittsleiste und nie eine Abschlusskarte - in diesem Studio ist nichts geschuldet.

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

Der Raum wächst mit dem Designsystem mit. Nichts, was Sie noch nicht gebraucht haben, steht auf der Seite, sodass ein erster Besuch eine Entscheidung ist und der Rest eintrifft, sobald die Palette wächst.

### Die erste Farbe

Ein Designsystem ohne eigene Farben öffnet auf einer zentrierten Spalte: **Mit einer Farbe beginnen**, ein großer Live-Chip, ein Feld und eine ruhige Zeile, die besagt, dass Rollen, Schattierungen und Druckeinstellungen eintreffen, sobald das System wächst.

- **Der Chip ist der Farbwähler.** Drücken Sie ihn, und die eigene OKLCH-Karte des Studios öffnet sich am Chip, vorbelegt mit dem, was das Feld gerade enthält: ein Name, das Rad, die vier Regler, Alpha und **Gespeichert als**, mit **Abbrechen** und **Farbe hinzufügen** am Fuß. Das Ziehen an einem Regler bemalt den Chip und schreibt das Feld dabei live um, und nichts erreicht das Designsystem, bevor Sie **Farbe hinzufügen** drücken.
- **Das Feld nimmt jede Notation an** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` oder einen einfachen Farbnamen - und eine ganze *Liste* von Farben wird zu einer Reihe von Chips, die Sie einzeln hinzufügen.
- **Zwei weitere Türen liegen daneben.** Die Pipette (bei einem Browser, der eine hat) entnimmt eine Farbe vom Bildschirm, und **Aus einem Bild** liest einen Screenshot oder ein Foto auf diesem Gerät und bietet die gefundenen Farben an.
- **Hinzufügen ist nie deaktiviert.** Steht nichts Lesbares im Feld, öffnet es den Farbwähler, was ein leerer Druck meist bedeutet; Text, den es nicht verarbeiten kann, erhält eine Zeile unter dem Feld, die das sagt, statt einer toten Schaltfläche.

Die erste Farbe wird zu **Primär**, und der Chip, der auf das Hinzufügen antwortet, sagt das - *„Primär ist jetzt Vivid Violet"* - mit **Feinabstimmung** daneben.

![Der Colours-Raum mit noch nichts ausgewählt - ein großer Live-Chip, ein Feld und eine Zeile darüber, was später eintrifft](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** ist das Wort für alles, was mit der App mitkam, statt gewählt zu werden. Eine frische Installation trägt überhaupt keine Farbe: Was sie hat, ist ein neutraler Verlauf, Tinte durch Papier, sodass Flächen, Text und Haarlinien gerendert werden, bevor irgendjemand irgendetwas entschieden hat. Diese Neutraltöne sind Gerüst, werden also nicht als Farben gezählt und nicht in der Palettenfläche gezeichnet. Sie leben im Raum [Tokens](#tokens) als **Neutraltöne · Starter · 9**, mit einem **Öffnen**, das sie im Colours-Bereich als eine eingeklappte, markierte Gruppe zeigt (`#/start?area=color&group=neutral`).

Dasselbe Wort zieht sich durch jeden Raum: Eine Rolle, die auf einer Starter-Farbe steht, liest *„Starter Paper springt ein"*, und ihr Farbwähler bietet **Auswählen…**; ein Starter-Schriftschnitt trägt eine **Starter**-Markierung und keine Tönung; ein Starter-Eckenradius ist auf der Overview markiert. Geerbtes Material wird nie mit gestricheltem Rand gezeichnet, weil ein gestrichelter Rand hier ein Ablageziel bedeutet.

### Während die Palette wächst

Ihre Farben bleiben auf einem breiten Bildschirm neben einer **Im Kontext**-Vorschau, und stapeln sich auf kleineren Bildschirmen darüber. Die Vorschau kann ein Poster, ein Diagramm oder eine Interface-Karte zeigen, die Ihre Palette verwendet. Starter-Farben bleiben in ihrer eigenen einklappbaren Gruppe, getrennt von den Farben, die Sie hinzufügen.

Fügen Sie einzelne Farben oder einen Satz Schattierungen hinzu, weisen Sie ihnen Rollen zu, und öffnen Sie die erweiterten Abschnitte, wenn Sie sie brauchen. Das Farbdiagramm, die Verläufe und die Download-Steuerelemente bleiben bei der Palette.

![Der Colours-Raum nach dem Hinzufügen einer Farbe, mit seiner Palette und einer Live-Kompositionsvorschau](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Rollen - was Tools lesen

**Rollen** sind die Schicht über den Farbflächen: welche Farbe welchen Part in jedem Tool und Export übernimmt. Rollen sind optional (ein Designsystem aus drei losen Farben ohne Rollen ist eine völlig gute Wahl), jede Farbfläche kann eine annehmen, und der Kontrastwert wird gegen die Fläche gemessen, zuerst nach APCA.

Eine Zeile liest sich in einem von drei Registern, sodass der Streifen nie eine Entscheidung behauptet, die niemand getroffen hat:

- eine eigene Farbe, die die Rolle bedient, in voller Stärke;
- **Starter *Paper* springt ein** - gedämpft, mit **Auswählen…** an ihrem Farbwähler;
- **↳ folgt Primär** - die Rolle löst sich über Primär auf, statt über eine eigene Farbe.

Sobald die Palette Schattierungen hat, wächst der Streifen auf alle sieben Plätze, die ein Tool lesen kann: Primär, Sekundär, Oberfläche, Text, Gedämpft, Kante und Auf Primärfarbe. Auf Primärfarbe wird von Primär abgeleitet, liest sich als **Abgeleitet** und trägt keinen Farbwähler.

**Der eigene Akzent der App ist eine Präferenz, kein Token.** Standardmäßig folgt die Oberfläche dem Designsystem, und der Chrome-Akzent übernimmt die Primärfarbe. Das ist eine Darstellungseinstellung in [Ihrem Profil](/info/profile.html) - **Die Oberfläche folgt dem Designsystem** - und sie auszuschalten lässt das Chrome neutral. Tools, Canvases und Exporte sind in beiden Fällen unberührt, und die Schriften und der Eckenradius folgen dem Designsystem, ob die Einstellung an oder aus ist.

### Die Experten-Flügel

Vier eingeklappte Abschnitte liegen unter der Kompositionsvorschau und den Farbrollen. Öffnen Sie den gewünschten; jeder ist direkt verlinkbar als `#/start?area=color&focus=<wing>`, was ihn öffnet, egal was der Raum sonst gerade zeigt:

- **Schattierungen & Harmonien erkunden** (`focus=generate`) - eine Farbe wird zu einem vollständigen Satz von Schattierungen. Unten beschrieben.
- **Schattenkurven** (`focus=curves`) - formen Sie einen Verlauf Punkt für Punkt um. Helligkeit, Chroma und Farbton erhalten jeweils eine eigene Kurve, umschaltbar mit L / C / H, und die Schattierungen darunter werden live neu berechnet, während Sie ziehen.
- **Kontrast** (`focus=contrast`) - **Kontrastsperre** stimmt einen Verlauf neu ab, um APCA-Zielwerte gegen einen von Ihnen gewählten Hintergrund zu erreichen, wobei jede Stufe ihren eigenen Farbton und ihre Chroma behält; **Farbton drehen** dreht den gesamten Verlauf körperlich um das Rad, wobei jede Schattierung ihre Helligkeit und Chroma behält.
- **Drucken** (`focus=print`) - was aus der Primärfarbe im Druck wird: ihr automatischer Rasterwert, oder stattdessen ein festgelegter CMYK-Aufbau oder eine benannte Schmuckfarbe.

### Eine Farbe, eine ganze Palette

Wählen Sie innerhalb von **Schattierungen & Harmonien erkunden** eine **Starting colour**. Lolly schlägt passende Schattierungen vor, mit derselben perzeptiven Farbmathematik (OKLCH), die die Engine überall sonst verwendet. Stellen Sie die Vorschläge fein ein:

- **Schema** - Mono, Komplementär, Analog oder Triade - legt fest, wie die Sekundärfarbe zur Primärfarbe steht.
- **Schattierungen** - ein Schieberegler von 3 bis 20 (Standard 5) steuert, wie viele Stufen jeder Verlauf erzeugt.
- **Feinabstimmung** (eingeklappt) - **UI-Intensität** (Gedämpft / Kräftig), **Kontrast** (Komfort / Hoch) und **Text auf Marke** (Auto / Hell / Dunkel).

Das Ändern der Startfarbe und der Regler ändert nur die Vorschläge. Klicken Sie auf eine Schattierung, um diese Farbe hinzuzufügen, oder auf **5 Schattierungen hinzufügen**, um eine Gruppe hinzuzufügen (die Anzahl folgt Ihrer Shades-Einstellung). Bestehende Farben und Rollen bleiben an ihrem Platz. Rückgängig entfernt die Hinzufügung.

Die Zeilen **Primär**, **Neutral** und **Sekundär** zeigen die vorgeschlagenen Schattierungen. Öffnen Sie **Theme preview**, um Hell- und Dunkel-Beispiele und ihre Kontrastwerte zu prüfen. Wählen Sie dort eine Neutral- oder Sekundär-Stufe, um die vorgeschlagenen Theme-Anker anzupassen. Das Neuaufbauen der ganzen Palette bleibt eine separate, geprüfte Aktion weiter unten.

![Drei vorgeschlagene Schattierungsgruppen, mit einzelnen Hinzufügen-Steuerelementen und einer separaten Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Die Palette aufbauen (Harmonie-Generator)

Bei **Passende Farben finden** schlägt der Harmonie-Generator passende Akzentfarben aus der Primärfarbe vor. Wählen Sie eine **Harmonie** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** oder **Analogous** (was seine eigene **Accents**-Anzahl von 2 bis 5 sowie einen Farbton-**Winkel** von 10° bis 45° mitbringt) - und jeder Kandidat kommt mit einem automatisch erzeugten, menschenlesbaren Namen und einer **+ Hinzufügen**-Schaltfläche. Das Hinzufügen einer Farbe legt sie sofort in die Palette, ein Druck für ein Token. **Im Kontext** zeigt Ihre hinzugefügten Farben in Beispielkompositionen.

![Erzeugte Akzente, jeder mit einer Farbfläche, einem automatisch erzeugten Namen, seinem Hex-Wert und einer Add-Schaltfläche](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Eine erzeugte Palette übernehmen

Das Hinzufügen einer vorgeschlagenen Farbe oder Schattierungsgruppe behält den Rest Ihrer Palette. Für einen vollständigen Ersatz öffnen Sie **Rebuild the whole palette…** und drücken **Preview full rebuild**. Die Übersicht erklärt die Änderungen: wie viele Rollen so bleiben, wie Sie sie zugewiesen haben, wie viele selbst hinzugefügte Farben erhalten bleiben, wie viele Schattenkurven neu verankert werden, wie viele Drucksperren neu verankert werden, wie viele verborgene Schattierungen verborgen bleiben, wie viele Verlaufsstopps ihre Farbe behalten.

**Apply rebuilt palette** auf dieser Karte übernimmt sie; **Abbrechen** verlässt sie, ohne etwas zu ändern. Nachdem es gelaufen ist, bietet die Karte **Rückgängig** mit bereits gesetztem Fokus an - und ein Checkpoint des gesamten Designsystems wird *vor* dem Wechsel angelegt, sodass „stelle es wieder her, wie es war" eine Wiederherstellung ist und kein verlorener Nachmittag.

### Die Palette, das Diagramm und jede Farbfläche

Die Palette listet die Farben des Designsystems in einklappbaren Gruppen auf, jede mit ihrem eigenen **+ Hinzufügen**-Steuerelement. Erstellen und benennen Sie Gruppen um, um Ihre Arbeit zu organisieren. Eine Rolle erzeugt nie eine zweite Kachel: ein Token ist eine Kachel, und eine Kachel, auf die eine Rolle zeigt, trägt stattdessen eine kleine Eckmarkierung (**P**, **S**, **Su**, **T**). Unter den Kacheln klappt **Farbdiagramm** auf zwei Ansichten derselben Farbflächen auf: das **Rad** (das OKLCH-Rad - ziehen Sie einen Punkt, um ihn umzufärben, klicken Sie auf einen Punkt, um ihn zu bearbeiten, oder klicken Sie auf leeren Raum, um eine neue Farbfläche abzulegen) und das **Gamut**-Diagramm, das zeigt, wo der darstellbare Bereich tatsächlich endet. `#/start?area=color&focus=chart` öffnet die Karte direkt, wie es `?wheel` immer schon getan hat.

![Der Palettenbereich, jede Gruppe einklappbar, mit der Download-Pille am unteren Rand](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Das OKLCH-Rad - der Winkel steht für den Farbton, der Abstand von der Mitte für das Chroma, und die Grautöne verlaufen seitlich auf einer Helligkeitsschiene](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Arbeiten mit vielen Farbflächen

Jede Farbfläche hat einen eigenen Ziehgriff. Ziehen Sie daran, um Farben innerhalb ihrer Gruppe neu zu ordnen, oder fokussieren Sie sie, drücken Sie die Leertaste, nutzen Sie die Pfeiltasten und drücken Sie erneut die Leertaste zum Ablegen. Escape bricht ab. Die Reihenfolge übersteht ein erneutes Öffnen des Studios und lässt sich rückgängig machen. Um Farben zwischen Gruppen zu verschieben, nutzen Sie das **Gruppieren**-Steuerelement des Farbflächen-Editors oder wählen Sie mehrere Farben aus und nutzen Sie **Verschieben**. Token-Namen und Rollenverweise bleiben intakt.

Die Auswahl im Palettenbereich ist eine Geste, kein Modus. Es gibt keine Schaltfläche, die Sie zuerst drücken müssen, und die Leiste erscheint mit der ersten ausgewählten Kachel und verschwindet mit der letzten.

- **Ziehen Sie auf der leeren Fläche des Bereichs**, um ein Rechteck aufzuziehen: jede Kachel, die es berührt, tritt der Auswahl bei, über Gruppengrenzen hinweg. Ein eingeklappter Abschnitt trägt nichts bei, und ein Ziehen, das sich nie bewegt, leert die Auswahl.
- **Umschalt-Klick** nimmt den Bereich in Lesereihenfolge; **Cmd/Ctrl-Klick** schaltet eine Kachel um; ein einfacher Klick öffnet weiterhin den Editor dieser Kachel.
- Jede Gruppenüberschrift trägt **Alle auswählen**, und **Cmd-A** mit einer fokussierten Kachel nimmt jede Farbe, die das Designsystem besitzt - nie eine Starter-Farbe.
- Das Raster hat einen Tab-Stopp. Pfeile bewegen sich darin, Umschalt-Pfeile erweitern die Auswahl, die Leertaste schaltet eine Kachel um, Entfernen entfernt die Auswahl und Escape leert sie. (Pfeile bewegen nur den Fokus: Um einen Kanal zu justieren, drücken Sie zuerst `l`, `c` oder `h`, wie es der Messwert sagt.)
- Auf einem Touchscreen gibt es kein Rechteck. Halten Sie eine Kachel gedrückt, um eine Auswahl zu beginnen, dann tippen Sie zum Hinzufügen; **Alle auswählen** je Gruppe übernimmt den Rest.

Die Leiste selbst liest **{n} ausgewählt**, dann **Verschieben nach** (eine bestehende Gruppe oder eine neue, die Sie im Menü benennen), **Rolle zuweisen** (jede ausgewählte Farbe übernimmt der Reihe nach die nächste Rolle, sodass vier Kacheln alle vier Rollen in einem Druck füllen), **Herunterladen** (die Auswahl in einem der sechs Palettenformate), **Werte kopieren** (eine Zeile pro Farbe in ihrer gespeicherten Notation) und **Löschen**. Verschieben nach und Rolle zuweisen erscheinen erst, sobald die Palette Schattierungen zum Verschieben hat. Ein einziges Strg/Cmd-Z macht eine ganze Sammelaktion rückgängig - ein Verschieben von vierzig, ein Rollen-Durchlauf, ein Löschen - und ein Löschen sagt, was es behalten hat, weil eine Auswahl auch Kacheln erreicht, die dieser Raum nicht entfernt.

### Verläufe

Ein optionales Panel **Verläufe** baut Übergangs-Tokens aus der Palette für Hintergründe und Akzente. Überspringen Sie es ganz, wenn das Designsystem keine Verläufe macht. Jeder Verlauf hat eine Vorschau, benannte Stopps (2-8) und einen Winkel. Das entscheidende Verhalten: **ein Stopp verweist auf eine Farbfläche**, ändern Sie also diese Farbfläche, folgt der Verlauf. Die Interpolation läuft in OKLCH für saubere Übergänge. Löschen Sie einen Stopp, um die Reihe zu kürzen.

### Die Palette anderswo nutzen

Die schwebende Pille am unteren Rand des Palettenbereichs lädt die ganze Palette als **Design-Tokens (JSON)**, **CSS-Variablen**, **CSS-Klassen**, **SCSS-Variablen**, eine **GIMP-Palette (.gpl)** oder ein **Adobe Swatch Exchange (.ase)** herunter - sodass das Designsystem direkt in Illustrator, Figma, GIMP oder ein Stylesheet übernommen werden kann. Sie sitzt außerhalb des Scrollbereichs des Panels, behält also ihren Platz, wie weit die Palette auch scrollt, und erscheint, sobald die Palette Schattierungen hat. (Sie können die Palette auch aus [Assets](/info/using.html#assets-your-library) herunterladen.)

## Schrift

Dieser Raum wächst auf dieselbe Weise. Ohne eigenen Schriftschnitt ist er eine Karte und eine Entscheidung: **Primär**, gesetzt in Lesegröße im Schriftschnitt, der sie heute bedient, eine **Starter**-Markierung neben dem Namen, ein ausgefülltes **Schriftschnitt auswählen** und die Zeile „Es wird nichts installiert, bis Sie eines auswählen." Unter der Karte steht „Überschriften, Code und Kursiv fallen auf die primäre Schriftart zurück, bis Sie sie zuweisen", mit **Einzeln auswählen**, das die anderen drei Karten für den Rest des Besuchs aufdeckt.

![Der Schrift-Raum mit noch keinem gewählten Schriftschnitt - eine Karte in Lesegröße, eine Starter-Markierung darauf und ein ausgefülltes Schriftschnitt auswählen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Wählen Sie einen Schriftschnitt, und der Raum öffnet sich zu **vier Rollenkarten**, der Schriften-Liste und der Live-Schriftprobe. Die vier Schriftschnitte sind die, die die App, die Tools und jeder Export tatsächlich lesen:

- **Primär** - Fließtext, Buttons und jedes Tool.
- **Überschriften** - die Display-Schriftart für `h1`/`h2`.
- **Code** - eine Monospace-Schriftart für Code und Daten.
- **Kursiv** - ein echter kursiver Begleiter für Betonungen, Zitate und Nebenbemerkungen.

Überschriften, Code und Kursiv fallen jeweils auf die primäre Schriftart zurück, bis Sie sie zuweisen, sodass ein Designsystem mit nur einer Schriftart hier gar keine Entscheidungen treffen muss.

**Eine Einfärbung bedeutet, dass Sie sie gewählt haben.** Eine Karte ist nur dort eingefärbt, wo Sie diesen Schriftschnitt installiert haben. Ein Starter-Schriftschnitt trägt dieselbe **Starter**-Markierung, die die geerbten Gruppen der Palette tragen, im gedämpften Register und ohne Einfärbung, und eine Rolle, die niemand gewählt hat, liest **↳ folgt Primär**, statt den Namen der Primärfarbe zu wiederholen, als wäre sie ausgewählt worden. Die Schaltfläche sagt **Ändern** bei einem eigenen Schriftschnitt und **Schriftschnitt auswählen** überall sonst. Nichts auf einer Karte legt etwas fest: Die Schaltfläche öffnet die **Vergleichsbühne**, beschränkt auf diese Rolle.

![Die vier aufgedeckten Rollenkarten - jede gesetzt in dem Schriftschnitt, der sie bedient, mit einer Starter-Markierung, wo niemand eine gewählt hat, und Kursiv, das Primär folgt](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Die Vergleichsbühne

![Die geöffnete Vergleichsbühne unter ihrer Karte, mit der Suchzeile, den angepinnten Familien und den zu einem einzeiligen Streifen eingeklappten Karten](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Die Bühne öffnet sich **inline im Raum**, nicht in einem Dialog, und direkt unter der Karte, die Sie gedrückt haben. Während sie offen ist, klappen die Karten zu einem einzeiligen Streifen aus Rolle und Schriftschnitt zusammen, sodass die Bühne selbst auf einem Smartphone auf dem ersten Bildschirm liegt. Escape bricht ab und gibt die Tastatur zurück an die Karte, von der aus Sie sie geöffnet haben.

Einen Schriftschnitt zu wählen sind drei Drücke:

1. **Schriftschnitt auswählen** auf der Karte.
2. Tippen Sie einen Familiennamen ein und drücken Sie **Vorschau** - oder drücken Sie eine der sechs **Angepinnt**-Familien unter dem Feld, ein Druck je Familie. Die Karte erscheint bereits ladend, mit einem Skeleton-Balken dort, wo die Schriftprobe stehen wird, statt des Interface-Schriftschnitts, der für einen noch nicht gesehenen Schriftschnitt einspringt.
3. **Diese Schriftschnitt verwenden**.

**Die Zustimmung wird einmal abgefragt, beim Druck, den Sie gemacht haben.** Wenn eine Vorschau zum ersten Mal Google Fonts erreicht, sagt ein Dialog, was passiert: *Google erfährt den Familiennamen und Ihre IP-Adresse. Die Datei wird danach auf diesem Gerät gespeichert und offline verwendet. Dies ist der einzige Schritt im Studio, der einen Dritten erreicht.* **Von Google abrufen** macht weiter und wird gemerkt. **Abbrechen** verlässt die Karte mit *„Nicht abgerufen. Es wurde nichts an Google gesendet."*, mit ihrem eigenen, weiterhin aktiven **Von Google abrufen**, sodass es sich anders zu überlegen ein Druck auf die Karte selbst ist. Keine Karte zeigt je eine tote Schaltfläche: In welchem Zustand sie auch ist, ihre eine primäre Schaltfläche sagt, was der nächste Schritt ist.

**Legen Sie eine Schriftdatei auf der Bühne ab**, und sie wird sofort in der Vorschau angezeigt - **TTF**, **OTF** oder **WOFF** von Ihrem eigenen Rechner, was der Weg für einen lizenzierten Unternehmens-Schriftschnitt ist, den Sie bereits besitzen. Diese Ablagezone ist die einzige Datei-Tür in diesem Raum.

So oder so bleibt der Schriftschnitt auf diesem Gerät, wird in der App, in den Tools und in jedem Export gerendert, für immer offline, und reist in der Designsystem-Datei - beim Rendern wird nichts nachgeladen. Alles auf Google Fonts wird unter einer offenen Lizenz (OFL/Apache/UFL) veröffentlicht.

### Schriften auf diesem Gerät

Das Panel **Schriften** listet jeden Schriftschnitt auf, den dieses Gerät besitzt, und die Rolle, die er bedient. Von Ihnen hinzugefügte Schriftschnitte führen unter **In the design system**, jeder mit seinen Rollen und einer Löschfunktion, und der, der Primär bedient, trägt das Abzeichen. Die Starter-Schriftschnitte folgen in einer eingeklappten Zeile - *Starter · SUSE, SUSE Mono · bedient Primär und Code, bis Sie wählen* - gedämpft, ohne Löschfunktion und ohne etwas zu befördern, weil keins von beidem eine Entscheidung ist, die irgendjemand getroffen hat. **Schriftschnitt hinzufügen** öffnet dieselbe Vergleichsbühne ohne Einschränkung.

Das Panel **Schriftrollen** am Fuß zeigt eine Live-Schriftprobe jeder Rolle - Fließtext und UI in Primär, ein optionaler Display-Schriftschnitt für die obersten Überschriften, ein Kursiv für Betonungen, ein Mono für Code und Daten - mit der Familie und ihrem Zustand neben jeder einzelnen (*Inter*, *SUSE · starter*, *SUSE · folgt Primär*), sodass sich das gesamte Set auf einen Blick lesen lässt.

## Tokens

Der Rest des Design-Systems, bearbeitbar ohne Code anzufassen:

![Der Tokens-Raum - ein Regler für Eckenradien sowie Abstände, Größen, Schatten und der Rest des Systems](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Abgerundete Ecken** - ein einzelner Radius-Regler (0-1.5rem), dem Karten, Buttons und Panels in der gesamten App folgen.
- **Neutraltöne** - der Tinte-durch-Papier-Verlauf, mit dem eine frische Installation ausgeliefert wird, aufgeführt als **Neutraltöne · Starter · 9** mit ihren neun Stufen und einem **Öffnen** in den Colours-Bereich. Es ist der einzige Ort, an dem die Starter-Neutraltöne verwaltet werden, und die *starter*-Markierung verschwindet in dem Moment, in dem der Verlauf erzeugt statt geerbt wird.
- **Weitere Tokens** - fügen Sie **Abstände**, **Größen**, **Strichstärke**, **Deckkraft**, **Rotation**, einfache **Zahlen** und **Schatten** hinzu und bearbeiten Sie sie. Wählen Sie einen Typ, benennen Sie ihn (*Gutter, Card shadow…*) und legen Sie seinen Wert fest. Diese werden als standardmäßige [Design Tokens](/info/design-tokens.html) (DTCG) gespeichert und reisen mit dem Designsystem.

## Dateien

Legen Sie hier die Dateien ab, die Ihre Marke aufbewahrt - abgesehen von Logos: **Vektor**-, **Bild**-, **Audio**- und **Bewegtbild**-Assets (Video, Lottie, animiert). Sie landen in [Assets](/info/using.html#assets-your-library), nach Bereichen sortiert und in der Asset-Auswahl jedes Tools bereit. Alles bleibt auf diesem Gerät. (Die Leiste beschriftet den Raum **Dateien**; der URL-Schlüssel bleibt `catalogue`, weil ein Panel-Schlüssel ein dauerhafter Vertrag ist.)

## Eine Marke importieren

**Add from…** am unteren Ende der Leiste öffnet eine zweistufige Auswahl. Die erste Stufe fragt, was Sie *haben*, nicht welches Format es ist:

- **Design Tokens oder eine Design-Datei** - DTCG- oder Tokens-Studio-JSON, ein Penpot-Projekt, ein **Zip mit Token-Sets**, ein Lolly-Design-System-Paket oder eine SVG.
- **PDF** - eine Präsentation oder eine Richtliniendatei, auf diesem Gerät gelesen für ihre Farben, ihre Marken und ihre eingebetteten Schriftarten.
- **Logo oder Screenshot** - ein Bild wird zu einer vorgeschlagenen Palette, gelesen auf diesem Gerät. Nichts wird hochgeladen. Das liest Farben, nicht den Schriftschnitt oder das Layout im Bild.
- **Gespeicherte Webseite** - wählen Sie eine HTML-Datei und ihre CSS-Dateien, oder fügen Sie HTML oder CSS ein. Bis zu 20 Dateien und 2 MB insgesamt. Nur der gelieferte Text wird gelesen; verlinkte Ressourcen werden nicht abgerufen, und Skripte laufen nicht. Dieser Weg funktioniert auch ohne die Erweiterung oder die Desktop-App.
- **Schriftdatei** - TTF, OTF oder WOFF. Öffnet den Schrift-Raum, in dem die Schriftart installiert wird.
- **Website** - eine einzelne Seite, gelesen für ihre Farben und Schrift. Diese Kachel erscheint nur auf einem Gerät, das tatsächlich eine Seite lesen kann, denn eine deaktivierte Kachel, die etwas bewirbt, das niemand anklicken kann, ist schlechter als gar keine Kachel. Wo sie erscheint, nennt sie ihre Lesequelle klar: von der App auf diesem Gerät abgerufen, oder über die Browser-Erweiterung in einem Hintergrund-Tab gelesen, angemeldet als Sie. Das Eintragen einer URL *befüllt* das Feld nur vorab - der Abrufen-Button ist die Zustimmung, sodass ein Link, den Ihnen jemand schickt, niemals von sich aus einen Abruf auslösen kann.

Wählen Sie die Design-Datei-Quelle, und die zweite Stufe ist die Karte unten: die akzeptierten Formate führen als Icon-Kacheln in Präferenzreihenfolge an, und die gesamte Karte ist ein einziges Drop-Ziel - klicken Sie irgendwo darauf oder ziehen Sie eine Datei darauf. Sie können eine Datei auch direkt auf das Studio ziehen.

![Die Import-Karte - die akzeptierten Formate führen als Icon-Kacheln an, und die gesamte Karte ist ein einziges Drop-Ziel](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Was jede Design-Datei bietet:

- ein **Lolly-Design-System-Paket** (`.lolly`; die alte Form `.zip` wird weiterhin akzeptiert) - installiert in einem Schritt;
- ein **Penpot**-Export (`.penpot`) - übernimmt dessen Design Tokens;
- eine **Design Tokens**-Datei (`.json`) - W3C DTCG;
- eine **Tokens Studio**-Datei (`.json`) - Tokens Studio;
- eine **einfache SVG** (`.svg`) - Lolly scannt deren Farben und lässt Sie auswählen, welche behalten werden sollen, wobei die erste zu Ihrer Primärfarbe wird.

Ein Logo/Screenshot, eine Website oder eine gespeicherte Seite öffnet **Your suggested design system**. Sehen Sie ein Beispiel mit den vorgeschlagenen Farben, wählen Sie bei Bedarf eine andere **Main colour**, und benennen Sie das System. **Use this design system** wendet die erzeugten Hell- und Dunkel-Paletten an und kehrt zur Overview zurück. Bestehende Schriftschnitte bleiben an ihrem Platz. Dies ersetzt die Farben und andere Token-Einstellungen des aktiven Systems. Ein Checkpoint muss zuerst gelingen; **Restore brand settings** stellt die vorherigen Einstellungen wieder her.

**Source details and individual choices** zeigt, was gelesen wurde, erkannte Schriftnamen und den Text-/Aktions-Kontrast der Vorschau. Es bietet außerdem **Choose individual items in the tray** und **Download design context**. Der JSON-Bericht trägt Beobachtungen, vorgeschlagene Tokens und Quellinformationen; gespeichertes HTML/CSS enthält einen SHA-256 des gelieferten Texts. Er enthält keinen rohen Seitentext und ist kein signiertes Content Credential. Schriftnamen sind Vorschläge: Schrift bleibt der Ort, an dem Schriftschnitte gewählt und installiert werden.

PDF- und andere Design-Datei-Importe behalten ihre bestehenden Prüf-Steuerelemente. Elemente, die im **Tray** aufbewahrt werden, ändern nichts, bevor sie über den Raum hinzugefügt werden, dem diese Art von Material gehört.

`#/start?source=<kind>` öffnet die Auswahl bei einer bestimmten Quelle (`file`, `pdf`, `image`, `font`, `url`, `page`), und `?import` öffnet sie bei der einfachen Liste.

## Eine Marke zwischen Geräten übertragen

**Export** am unteren Ende der Leiste schreibt eine einzelne **`LollyBrand-….lolly`** - Ihre Tokens, Schriftschnitte, Logos und Theme-Präferenz, mit einem Integritäts-Manifest, das beim Wiedereinlesen überprüft wird. Web-Releases vor 1.0.7 nannten dieselbe Nutzlast `.zip`; diese alte Schreibweise wird weiterhin akzeptiert. Daneben schreibt **Tokens (.json)** das reine Design-Tokens-Dokument für sich: keine Schriftschnitte, keine Logos, nur die Tokens - genau das, was ein Repo, ein CI-Schritt oder ein anderes Tokens-Tool tatsächlich liest.

Eine zurückzuholen geht über **Add from… → Design tokens or a design file** (oben), oder per Drag-and-Drop auf das Studio. So gibt Ihnen ein Kollege eine Marke weiter, oder so bringen Sie eine zu einer zweiten Installation - kein Konto, keine Cloud. Um eine Marke stattdessen über die Kommandozeile einzubringen, siehe [`ingest:brand`](/info/configuration.html#brand-packs).

## Frühere Einstellungen wiederherstellen

Wählen Sie **Restore brand settings** am Fuß der Leiste, wählen Sie einen datierten Checkpoint, und drücken Sie dann **Wiederherstellen**. Es stellt Farben, Schrift-Einstellungen und andere Markentokens für die aktive Marke wieder her. Schrift- und Bilddateien bleiben, wie sie sind.

Lolly speichert Ihre aktuellen Einstellungen als **Before restore**, bevor der Checkpoint angewendet wird. Wählen Sie diesen Checkpoint, um die Wiederherstellung umzukehren, auch nach dem Schließen und erneuten Öffnen des Browsers. Die letzten 20 Checkpoints werden auf diesem Gerät aufbewahrt. Kann der Speicher nicht gelesen werden oder können die aktuellen Einstellungen nicht gespeichert werden, meldet der Dialog das Problem, damit Sie es erneut versuchen können.

## Versionen

**Versionen** am Fuß der Leiste ist der Ort, an dem ein Designsystem aufhört, ein bewegliches Ziel zu sein. Veröffentlichen Sie eine, und Sie erhalten eine **dauerhafte, benannte Kopie**, die auf diesem Gerät verbleibt: Sie ändert sich danach nie mehr, sodass ein Tool, das sie fixiert, immer dasselbe zeichnet. Das Panel bleibt verborgen, bis es etwas Eigenes zu veröffentlichen gibt, sodass ein Studio, das nie veröffentlicht, die Steuerelemente auch nie zu sehen bekommt.

Drei Dinge sollten Sie wissen, bevor Sie irgendetwas drücken, und das Panel nennt alle drei vor dem Drücken, nicht danach:

- **Eine Version ist dauerhaft.** Es gibt noch kein Löschen, daher hält das Panel fest, was aufbewahrt wurde und dass es aufbewahrt bleibt, statt eine Schaltfläche anzubieten, die lügt.
- **Entfernungen führen die Kompatibilitätskarte an.** Hinzugefügte und geänderte Tokens sind Neuigkeiten; ein *entferntes* ist das, was ein Tool zerbricht, daher wird es zuerst genannt und beim Namen genannt.
- **Veröffentlichen lässt sich nicht rückgängig machen; Wiederherstellen schon.** *Aktuellsten Stand aus dieser Version wiederherstellen* ist eine gewöhnliche Bearbeitung des Kopfs, daher landet sie auf dem Undo-Stapel des Studios, und das Panel bietet Ihnen sofort das **Rückgängig** an.

Sie können **Nur veröffentlichen** oder **Veröffentlichen und aktivieren** - der Unterschied besteht darin, ob Tools und die App ab jetzt dieser Version folgen oder weiter Ihrer neuesten Bearbeitung folgen. **Wieder der neuesten folgen** bringt jede Bearbeitung im selben Moment live, in dem sie gemacht wird. `#/start?area=versions` öffnet das Panel direkt.

## Wenn die Marke fest ist

Manche Builds liefern ein **gesperrtes Designsystem** aus, etwa die SUSE Brand. Es zu öffnen zeigt einen schreibgeschützten Hinweis mit **Erstellen Sie eine bearbeitbare Kopie** und **Wechseln**. Seine ursprünglichen Farben, Schriftschnitte und Tokens bleiben intakt. Ihre eigenen lokalen Systeme bleiben bearbeitbar, selbst wenn das gesperrte System das erste auf dem Gerät war. Im Profil wählt **Öffnen** ein System aus und öffnet dessen Studio; **Neues erstellen** erstellt ein lokales System und öffnet es unter `#/start` mit fokussiertem Namensfeld.

## Wie es weitergeht

- **[Lolly benutzen](/info/using.html)** - die Zeichenfläche, Speichern, Projekte und Assets.
- **[Design-Token](/info/design-tokens.html)** - das Token-Modell, in dem Ihre Marke ausgedrückt wird.
- **[Exportieren & Formate](/info/exporting.html)** - Druckeinheiten, CMYK und die Formate, in die Ihre Marke gerendert wird.


## Einen Look finden und vergleichen

Öffnen Sie **Find a look** über Overview oder die Designsystem-Liste im Profil. Durchsuchen Sie auf diesem Gerät gespeicherte Systeme und einige wiederverwendbare Lolly-Beispiele. Suchen Sie nach Name, Farb-Tag oder angegebener Schrift. **Closest to my current palette** sortiert nach gemessener Farbähnlichkeit, wobei passende Schriftfamilien Gleichstände auflösen; das ist keine Qualitätsbewertung.

Wählen Sie einen Look aus, um ihn zu prüfen, oder zwei, um sie zu vergleichen. Die Prüfen-Schaltfläche bleibt auf einem kleinen Bildschirm verfügbar. Das Auswählen eines Looks ändert nichts. **Use this saved system** wechselt durch die bestehende Designsystem-Registrierung. **Diese Farben verwenden** wendet ein Beispiel über den normalen Checkpoint- und Installationsablauf an und bewahrt die aktuellen Schriftschnitte. **Restore brand settings** kann den vorherigen Look wiederherstellen.

Unter **Details and design context** haben gespeicherte Systeme bearbeitbare **Search tags** und einen Kontext-Download. Beispiele verwenden originale Lolly-Farbrezepte; es gibt keine ferngeladene Inspirationssammlung und kein erforderliches Konto.

![Sunroom und Orchard nebeneinander vergleichen, bevor eines der beiden Farbsysteme angewendet wird.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Der Vergleich hält beide Paletten gemeinsam sichtbar. Das Prüfen eines Looks ändert nichts, bis Sie **Diese Farben verwenden** oder **Use this saved system** wählen.

## Quellbelege lesen

Die optionalen Details der Quellprüfung zeigen Typografie, Abstände, Innenabstände und Eckenwerte, wo beobachtet. Gespeichertes HTML/CSS und native Website-Lesevorgänge melden Deklarationen, die von der gerenderten Seite möglicherweise nicht verwendet werden. Die Browser-Erweiterung kann gemessene Stile aus einer begrenzten Stichprobe sichtbarer Elemente melden, mit ihrem Viewport und ihrer Browser-Farbpräferenz. Ältere Erweiterungen funktionieren weiterhin mit deklarierten Stilen. Fehlende Felder sagen **Not observed**.

Das sind Beobachtungen, keine automatischen Stileinstellungen. Schriftdateien werden von einem Referenz-Scan weder abgerufen noch installiert, und Quell-Abstände ersetzen nicht heimlich Ihre eigenen. Zählungen beschreiben Vorkommen in der Stichprobe, nicht Konfidenz oder Qualität.

## Eine Komposition gegen das Designsystem prüfen

Öffnen Sie in Design **Export**, dann **Bevor Sie exportieren**. Die Prüfung verwendet dieselbe wirksame Designsystem-Version wie das Render. Sie vergleicht verfasste Farben, Token-Aliasse, Schriftwahl und Bild-Asset-IDs. Eigene Werte können beabsichtigt sein; ein Bild außerhalb der deklarierten Markenassets ist ein Prüfpunkt, kein verbotenes Bild.

Wo ein konkreter Farb- oder Schriftvorschlag verfügbar ist, ändert seine Schaltfläche genau diese eine Ebene. Das normale **Rückgängig** stellt den ursprünglichen Wert wieder her. Gesperrte oder geänderte Ebenen werden von einem alten Vorschlag nicht überschrieben. Fehlende Quellbelege bleiben getrennt von einer Übereinstimmung. Gerenderter Kontrast und Textlayout werden von den bestehenden eingebundenen Prüfungen kontrolliert. Verläufe, Effekte, verschachtelte Tool-Inhalte, Rechte und subjektive Qualität werden vom Markenvergleich nicht bewertet. Prüfungen blockieren **Herunterladen** nicht.

## Design-Kontext lokal nutzen

**Download design context** enthält das Token-Dokument, aufgelöste Farben, deklarierte Schriftfamilien, Asset-IDs, Quellbelege, wo erfasst, Abdeckung und explizite Regeln. Es enthält keine Schriftdateien oder Eigentumsnachweise. Die Referenzprüfung enthält außerdem ihre vorgeschlagenen Tokens und Beobachtungen.

Die CLI kann beide Downloads ohne Server lesen:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` akzeptiert Design-Eingaben mit einem `boxes`-Array oder einem kompilierten Design-Dokument. Es meldet vorgeschlagene Korrekturen, ohne die Komposition zu ändern. Es kann weder Browser-Layout noch gerenderten Kontrast messen. Die bestehende MCP-Ressource **lolly://design-context** legt den Kontext des wirksamen Systems über den konfigurierten lokalen MCP-Prozess offen; es ist kein neuer gehosteter Dienst und kein API-Schlüssel nötig.
