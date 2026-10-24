# Design System Setup

Ihr Logo, Ihre Farben und Schriften gehören an einen Ort, damit jedes Tool, jede Seite und jeder Export mit ihnen zeichnet. Dieser Ort ist **Design System Setup** unter `#/start`, und sein Leitsatz sagt, wofür es da ist: *Make it yours*.

Beginnen Sie mit dem, was Sie haben. Legen Sie ein Logo ab, und Lolly liest seine Farben. Wählen Sie eine Schrift oder legen Sie die Schriftdatei ab, die Ihr Unternehmen lizenziert hat. Jede Änderung zeigt sich sofort in der ganzen App. Ihr Logo, Ihre Schriften und Tokens bleiben auf diesem Gerät. Eine Google Font zu wählen ist der eine Schritt, der nach außen greift: Lolly fragt zuerst, dann holt es die Familie einmal.

Wenn es stimmt, geben Sie dem Designsystem einen Namen und drücken **Export**. Sie erhalten eine `.lolly`-Datei zum Aufbewahren, zum Öffnen auf einem anderen Gerät oder zur Weitergabe an eine Kollegin oder einen Kollegen. [Einstellungen](/info/dashboard.html#design-system) zeigt das aktive System schreibgeschützt, und seine Titelseite verlinkt zum Bearbeiten hierher zurück.

## In fünf Minuten zu Ihrem machen

::: timeline
- <!--i:upload--> **Legen Sie Ihr Logo ab** auf der Ablagefläche in **Logos**. Lolly liest seine Form und seine Farben.
- <!--i:palette--> **Nutzen Sie diese Farben.** Die Hauptfarbe des Logos wird Ihre Primärfarbe, und ein dunkles Neutral aus dem Logo wird Ihre Textfarbe.
- <!--i:font--> **Wählen Sie eine Schrift** in **Type**: eine Google Font oder eine Schriftdatei, die Sie besitzen.
- <!--i:pentool--> **Benennen Sie das System.** Ihre erste Bearbeitung erzeugt ein eigenes Designsystem, und Lolly fragt einmal nach seinem Namen.
- <!--i:download--> **Export** schreibt das ganze System als eine Datei `LollyBrand-….lolly`.
:::

Die Kopfzeile zeigt, welches Designsystem Sie **Editing**, und sein Name ist ein Feld, das Sie jederzeit ändern können. Wenn Ihre erste Bearbeitung **What is this design system called?** fragt, sind die Worte aus Ihrem Logo eingetragen, wenn das Logo sie ausschreibt. **Save name** behält den Namen; **Not now** behält einen Platzhalter, bis Sie in der Kopfzeile einen eintippen. Der Name beschriftet das System in Settings und beim Wechseln und wird zum Namen der Datei, die **Export** schreibt.

## Die Räume

Das Studio besteht aus Räumen in einer Leiste an der Seite, in keiner festen Reihenfolge: Nichts ist nummeriert, und nichts wartet auf etwas anderes. Auf einem Smartphone wird die Leiste zu einem Streifen aus Chips unter der Kopfzeile.

![Die Raumleiste des Studios: Overview, Colours, Type, Logos, Tokens, Files und Usage & rules](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Raum | Was Sie dort tun | Link-Schlüssel |
|---|---|---|
| **Overview** | Sehen, was das System enthält, mit einer Tür in jeden Raum | `overview` |
| **Colours** | Farben hinzufügen, ihnen Rollen geben, Abstufungen und eine Palette bauen | `color` |
| **Type** | Die vier Schriften wählen, die die App, die Tools und jeder Export lesen | `type` |
| **Logos** | Ihre Zeichen in jeder Ausrichtung und Behandlung platzieren | `logos` |
| **Tokens** | Ecken, Abstände, Schatten und jeder andere benannte Wert | `tokens` |
| **Files** | Die Bild-, Audio- und Bewegungsdateien, die Ihre Marke behält | `catalogue` |
| **Usage & rules** | Die Regeln, die Ihre Marke anwendet, an echten Beispielen geprüft | `usage` |

Verlinken Sie einen Raum mit `#/start?area=<key>`. Der Raum Files behält den Schlüssel `catalogue`, weil ein Raumschlüssel ein dauerhafter Vertrag ist, und `?tab=` funktioniert weiter als älterer Alias. Ein unbekannter Schlüssel öffnet Overview.

Der **Fuß der Leiste** enthält die Aktionen für das ganze System statt für einen Raum. **Add from…** bringt eine Marke herein ([Eine Marke einbringen](#bring-a-brand-in)), und das **Tray** hält, was ein Scan gefunden hat und Sie noch nicht hinzugefügt haben. **Export**, **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions** und **Restore brand settings** behalten und bewegen das System ([Ihr Designsystem behalten und bewegen](#keep-and-move-your-design-system)). Jede erscheint, sobald es etwas gibt, worauf sie wirken kann.

## Overview

Solange noch nichts gewählt ist, bietet Overview vier Wege zum Start. **Start from a reference** öffnet die Quellenauswahl für ein Logo, einen Screenshot, eine Webseite oder eine Design-Datei, und **Pick a colour**, **Choose a face** und **Add a logo** öffnen diese Steuerelemente direkt. Das Öffnen schreibt nichts, und **Explore the tools** ist von Anfang an da.

Sobald irgendetwas Ihr eigenes ist, zeigt Overview, was Sie haben, mit Ihren eigenen Zählwerten vorn. Colours nennt die Zahl der Farben, mit einem gedämpften `· N starter`, wo geerbte Farben erscheinen; sein Streifen stellt Ihre Farben zuerst, dann eine Haarlinie, dann die ausgeblendeten Starter-Farben. Type liest sich nach Rolle (*Inter for headings*, mit *Starter for the rest* in der Zeile darunter). Logos nennt, wie viele Slots gefüllt sind (oder **Not set**), Tokens zeigt den Eckenradius, und Files sagt **Nothing yet**, solange die Bibliothek leer ist. Jeder Block öffnet seinen Raum.

### Starter und Ihr eigenes

**Starter** ist das Wort für alles, was mit der App kam, statt gewählt zu werden. Eine frische Installation trägt gar keine Farbe, nur eine neutrale Rampe von Tinte zu Papier, damit Flächen, Text und Haarlinien rendern können, bevor irgendjemand etwas entscheidet. Dasselbe Wort kennzeichnet geerbtes Material in jedem Raum.

::: cols
## Starter

- Kam mit der App: die Neutralen von Tinte zu Papier, die Starter-Schriften, der Standard-Eckenradius.
- Gedämpft, mit einem Tag **Starter** und ohne Tönung.
- Nicht als Ihre Farben gezählt. Die Neutralen liegen in **Tokens** als **Neutrals · starter · 9**, und **Open** zeigt sie in Colours als eine eingeklappte Gruppe (`#/start?area=color&group=neutral`).
- Eine Rolle, die auf einer Starter-Farbe steht, liest sich *"Starter Paper stands in"*, mit **Choose…** in ihrer Auswahl.

## Ihr eigenes

- Von Ihnen gewählt oder installiert.
- Volle Stärke und eine getönte Karte, wo Sie eine Schrift installiert haben.
- Gezählt in Overview und in Tokens.
- Eine Rolle, die einer anderen folgt, liest sich **↳ follows Primary**, statt den Namen der Primärfarbe zu wiederholen.
:::

Geerbtes Material wird nie mit gestricheltem Rahmen gezeichnet, weil ein gestrichelter Rahmen hier ein Ablageziel bedeutet.

## Logos

Leeren Sie Ihren Ordner mit Zeichen in die Ablagefläche oben: **"Drop marks here, or choose several at once"** nimmt so viele Dateien an, wie Sie haben. Jede Datei wird auf Form und Farbe gelesen und wartet dann unter **Waiting for a slot** als Chip, der sagt, wie sie aussieht, etwa *"Looks like the Horizontal primary"*, mit der Messung, die er genutzt hat, und einer Schaltfläche **Place** (**Replace**, wo der Slot gefüllt ist). Wo er unsicher ist, sagt der Chip das und bietet **Change slot** mit allen acht. Nichts wird platziert, bis Sie etwas drücken.

Ein Zeichen mit überschüssigem leerem Rand erhält zuerst ein Beschnittangebot; beantworten Sie es oder drücken Sie Escape, und das Original geht unberührt hinein. Wo ein Zeichen einen leeren Nachbar-Slot füllen kann, bietet der Raum die abgeleitete Version **mono** oder **reverse** als Chip mit der Kennzeichnung *Generated*.

Jedes Zeichen landet in einem Raster aus acht optionalen Slots, je einer pro **Ausrichtung** und **Behandlung**:

- **Ausrichtungen:** Horizontal (Wortmarke und Symbol in einer Reihe) und Vertical (gestapelt, für quadratische und hohe Flächen).
- **Behandlungen:** Primary, Primary reverse (für dunkle Hintergründe), Mono (eine Farbe) und Mono reverse.

Eine Gruppe ohne Zeichen klappt zu einer Zeile zusammen; öffnen Sie sie, um ihre Slots zu sehen. Klicken Sie einen Slot an, um ein PNG, SVG, JPEG oder WebP hinzuzufügen, oder klicken Sie einen gefüllten Slot an, um das Zeichen zu ersetzen. Alles bleibt auf diesem Gerät.

![Die Logo-Slots mit geöffneten Horizontal und Vertical: Jede Behandlung ist ein eigener Slot, und jeder Slot ist optional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** sind Zeichen, die Ihre Marke mit eigenem Namen anspricht, etwa ein Icon, ein Wappen oder ein Favicon.
- **More identities.** Eine Untermarke, ein Produkt oder ein Event kann einen eigenen vollen Satz haben: **+ Add another logo** und geben Sie dem Satz einen Namen. Ihr Hauptsatz ist "Your logo". [Marken-Architekturen](/info/brand-architectures.html) zeigt, wann eine Logo-Identität der richtige Baustein ist.
- **Lolly liest die Farben des Logos.** Eine Karte unter der Ablagefläche und noch einmal oben in Colours listet die Farben des Logos und fragt **Which is the main colour?**, mit bereits ausgewählter stärkster Farbe (nie das Weiß, auf dem es exportiert wurde). **Use these colours** fügt sie Ihrer Palette hinzu, macht die Hauptfarbe zu Ihrer Primärfarbe und, wenn das Logo ein dunkles Neutral hat, das auf Papier lesbar ist, macht dieses zur Textfarbe. **Not now** lässt sie im Tray. Bei einer ganz neuen Installation wird die wahrscheinlichste Antwort sofort angewendet, und die Karte bietet **Undo** oder eine andere Hauptfarbe. Eine SVG liefert genaue Farben; ein PNG, JPEG oder WebP liefert die Farben, die einen echten Anteil des Zeichens abdecken.

## Colours

Der Raum wächst mit dem Designsystem: Ein erster Besuch ist eine Entscheidung, und der Rest kommt mit der Palette.

### Die erste Farbe

Ein System ohne eigene Farben öffnet sich auf einem großen Chip und einem Feld, mit einer Zeile, die sagt, dass Rollen, Abstufungen und Druckeinstellungen mit dem Wachsen des Systems hinzukommen.

- **Der Chip ist die Auswahl.** Drücken Sie **Pick a colour**, und die OKLCH-Karte des Studios öffnet sich, vorbelegt mit dem, was das Feld enthält: ein Name, das Rad, die vier Regler, Alpha und **Stored as**, mit **Cancel** und **Add colour** am Fuß. Nichts erreicht das System, bis Sie **Add colour** drücken.
- **Das Feld nimmt jede Notation**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` oder einen Farbnamen. Fügen Sie eine Liste ein, und sie wird zu einer Reihe von Chips, die Sie einzeln oder mit **Add all** hinzufügen.
- **Zwei weitere Wege hinein.** **Pick a colour from the screen** nutzt die Pipette, wo der Browser eine hat, und **Take colours from an image** liest einen Screenshot oder ein Foto auf diesem Gerät.
- **Add ist nie deaktiviert.** Ist das Feld leer, öffnet es die Auswahl; Text, den es nicht lesen kann, erhält unter dem Feld eine Zeile, die das sagt.

Ihre erste Farbe wird die **Primärfarbe**, und ein Chip bestätigt das, etwa *"Primary is now Vivid Violet"*, mit **Fine-tune**, um die Farbe anzupassen.


### Während die Palette wächst

Ihre Farben stehen neben einer Vorschau **In context** auf einem breiten Bildschirm und darüber auf einem kleineren. Die Vorschau zeigt ein Poster, ein Diagramm oder eine Oberflächenkarte in Ihrer Palette. Starter-Farben bleiben in ihrer eigenen einklappbaren Gruppe.

![Der Raum Colours bei Lolly Demo: die Palette in einklappbaren Gruppen, jede Farbe mit Name und Hex, und die Download-Pille am Fuß](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Der Colours-Raum nach dem Hinzufügen einer Farbe, mit seiner Palette und einer Live-Kompositionsvorschau](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Rollen: was Tools lesen

**Rollen** sagen, welche Farbe in jedem Tool und Export welche Aufgabe übernimmt. Sie sind optional (drei lose Farben und keine Rollen sind ein vollkommen gutes System), jede Farbe kann eine übernehmen, und die Kontrastanzeige wird gegen die Fläche gemessen, APCA zuerst. Jede Rollenzeile zeigt eine eigene Farbe in voller Stärke, eine einspringende Starter-Farbe oder **↳ follows Primary**.

Sobald die Palette Abstufungen hat, zeigt der Streifen alle sieben Rollen, die ein Tool lesen kann: Primary, Secondary, Surface, Text, Muted, Edge und On primary. On primary wird aus der Primärfarbe abgeleitet, steht als **Derived** und hat keine Auswahl.

Der eigene Akzent der App folgt standardmäßig dem Designsystem. Das ist die Einstellung **Interface follows the design system** unter **Settings → Appearance**; ist sie aus, bleibt das Chrome der App neutral, während Tools, Arbeitsflächen und Exporte dem Designsystem in beiden Fällen folgen.

**Farbvarianten.** Ein Designsystem kann mehrere Leitfarben enthalten, je Werk gewählt. Lolly behält jede Farbvariante, aber dieser Raum kann noch keine verfassen: Eine Farbvariante wird in der Token-Datei geschrieben. Bei einem System mit Farbvarianten braucht jede Farbvariante eine eigene Primär- und Sekundärfarbe und, wenn sie den Hintergrund tönt, eine eigene Fläche; diese Rollen bleiben daher im Farbfeld-Editor gesetzt. [Lolly Demo im Einsatz](/info/lolly-demo-in-use.html#colourways-on-real-work) zeigt Farbvarianten an echter Arbeit, und [Farbvarianten zu einem Designsystem hinzufügen](/info/colourways.html#add-colourways-to-a-design-system) hat das Format.

### Weitere Farben finden

Drei Werkzeuge bauen auf Ihrer Primärfarbe auf. Die ersten beiden schlagen nur vor, und das dritte ersetzt die Palette, nachdem Sie die Änderung geprüft haben.

::: cols
## Explore shades & harmonies

Wählen Sie eine **Starting colour**, ein **Scheme** (Mono, Complement, Analogous oder Triad) und wie viele **Shades** (3 bis 20, Standard 5). **Fine-tune** legt UI-Intensität, Kontrast und Text auf der Marke fest. Klicken Sie eine Abstufung an, um sie hinzuzufügen, oder **Add 5 shades** für eine Gruppe. Ihre Farben und Rollen bleiben.

## Find matching colours

Wählen Sie eine **Harmony**: Complementary, Adjacent, Triad, Tetrad oder Analogous (mit **Accents** von 2 bis 5 und einem **Angle** von 10° bis 45°). Jeder Kandidat hat einen erzeugten Namen und **+ Add**, ein Druck pro Farbe.

## Rebuild the whole palette

Ersetzt die Palette aus einer Ausgangsfarbe, nach einer Prüfung dessen, was sich ändert und was bleibt. Zuerst wird ein Checkpoint angelegt, und danach wird **Undo** angeboten.
:::

Alle drei nutzen dieselbe wahrnehmungsbasierte Farbmathematik (OKLCH) wie die Engine. In **Explore shades & harmonies** zeigen die Zeilen **Primary**, **Neutral** und **Secondary** die vorgeschlagenen Abstufungen, und **Theme preview** zeigt helle und dunkle Beispiele mit ihren Kontrastwerten.

![Drei vorgeschlagene Schattierungsgruppen, mit einzelnen Hinzufügen-Steuerelementen und einer separaten Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Erzeugte Akzente, jeder mit einer Farbfläche, einem automatisch erzeugten Namen, seinem Hex-Wert und einer Add-Schaltfläche](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Eine erzeugte Palette übernehmen

Öffnen Sie **Rebuild the whole palette…** und drücken Sie **Preview full rebuild**. Die Prüfung zählt, wie viele Rollen bleiben, wie Sie sie zugewiesen haben, wie viele Ihrer eigenen Farben behalten werden und wie viele Abstufungskurven, Druck-Sperren, ausgeblendete Abstufungen und Verlaufsstopps neu verankert oder behalten werden. **Apply rebuilt palette** übernimmt; **Cancel** ändert nichts. Danach bietet die Karte **Undo** mit Fokus darauf, und der Checkpoint vor dem Austausch stellt das ganze System wieder her.

Ein System mit Farbvarianten behält bei einem Neuaufbau jede Farbvariante. Die kanonische Farbvariante folgt der neuen Ausgangsfarbe, und jede andere Farbvariante behält ihre eigenen Farben, ihren Namen, ihre Reihenfolge und ihre Einstellungen. Die Prüfung listet auf, welche Farbvariante folgt und welche ihre Farben behalten. Lolly baut kein System neu auf, das seine Farbvarianten so kodiert, dass es sie nicht bearbeiten kann; die Karte sagt warum, und nichts ändert sich.

### Die Expertenabschnitte

Vier eingeklappte Abschnitte liegen unter der Vorschau und den Rollen. Jeder öffnet sich direkt mit `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), oben beschrieben.
- **Shade curves** (`focus=curves`) formen eine Rampe Punkt für Punkt um, mit getrennten Kurven für Helligkeit, Buntheit und Farbton (L / C / H), und die Abstufungen werden beim Ziehen neu gezeichnet.
- **Contrast** (`focus=contrast`): **Contrast-lock** tont eine Rampe auf APCA-Ziele gegen einen gewählten Hintergrund um, und **Rotate hue** dreht die ganze Rampe um das Rad.
- **Print** (`focus=print`) legt fest, was die Primärfarbe im Druck wird: ihren automatischen Wert, einen festgelegten CMYK-Aufbau oder eine benannte Sonderfarbe.

### Die Palette und jedes Farbfeld

Die Palette listet Ihre Farben in einklappbaren Gruppen, jede mit ihrem eigenen **+ Add**. Legen Sie Gruppen an und benennen Sie sie nach Belieben um. Eine Rolle erzeugt nie eine zweite Kachel: Eine Kachel, auf die eine Rolle zeigt, trägt stattdessen eine kleine Markierung (**P**, **S**, **Su**, **T**). **Colour chart** unter den Kacheln zeigt dieselben Farben auf dem OKLCH-**Wheel** (ziehen Sie einen Punkt zum Umfärben, klicken Sie in leeren Raum, um ein Farbfeld hinzuzufügen) und im **Gamut**-Diagramm, das zeigt, wo der darstellbare Bereich endet. `#/start?area=color&focus=chart` öffnet das Diagramm direkt.

![Der Palettenbereich, jede Gruppe einklappbar, mit der Download-Pille am unteren Rand](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Das OKLCH-Rad - der Winkel steht für den Farbton, der Abstand von der Mitte für das Chroma, und die Grautöne verlaufen seitlich auf einer Helligkeitsschiene](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klicken Sie ein Farbfeld an, um seinen Editor zu öffnen:

- **Rename** das Farbfeld.
- **Set the colour** auf OKLCH-Reglern oder in **Hex**, **HSL**, **RGB** oder **CMYK**. Das Wertefeld liest und schreibt im aktiven Raum. CMYK setzt hier die Bildschirmfarbe durch Umrechnung; um genaue Druckfarben festzulegen, nutzen Sie **Print substitutes**.
- **Stored as** wählt, wie das Farbfeld gespeichert wird: **LCH** (der Standard, wahrnehmungsbasiert und mit weitem Farbraum), Hex, RGB oder HSL.
- **Use as** gibt dem Farbfeld direkt eine Rolle. Drücken Sie eine hervorgehobene Rolle erneut, um die Rolle zu löschen.
- **Print substitutes** (eingeklappt): sperren Sie **CMYK** von **Auto** auf genaue Druckfarbwerte oder legen Sie eine **Spot colour** mit einem **Name** (etwa `PANTONE 186 C`), einem optionalen **Book** und einem **Finish** für Folie, Prägung, Blindprägung, Spotlack, Soft Touch oder Stanzung, Rillung oder Perforation fest. Eine Druckmaschine nutzt diese Sperren, wenn Sie ein CMYK-PDF oder TIFF exportieren; siehe [Farbprofile](/info/exporting.html#colour-profiles).
- **In other spaces** (eingeklappt): ein Wert pro Farbraum, abgeleitet oder von Ihnen verfasst, und ein verfasster gewinnt beim Export.

**Ein Farbfeld zu löschen** ist sicher. Abgeleitete Abstufungen und Design-Rollen werden ausgeblendet, sodass nichts kaputtgeht, was sie liest, während von Ihnen hinzugefügte Farben entfernt werden.

::: details Mit vielen Farbfeldern arbeiten
Jedes Farbfeld hat einen Ziehgriff. Ziehen Sie, um innerhalb einer Gruppe neu zu ordnen, oder fokussieren Sie den Griff, drücken Sie Space, nutzen Sie die Pfeiltasten und drücken Sie Space erneut zum Ablegen; Escape bricht ab. Um Farben zwischen Gruppen zu verschieben, nutzen Sie das Steuerelement **Group** des Editors oder wählen Sie mehrere aus und nutzen **Move to**.

Die Auswahl braucht keinen Modus. Die Leiste erscheint mit der ersten ausgewählten Kachel und verschwindet mit der letzten.

- **Ziehen auf leerem Raum** zeichnet ein Rechteck; jede Kachel, die es berührt, kommt in die Auswahl, über Gruppen hinweg. Ein eingeklappter Abschnitt fügt nichts hinzu.
- **Umschalt-Klick** nimmt einen Bereich in Leserichtung, **Cmd/Strg-Klick** schaltet eine Kachel um, und ein einfacher Klick öffnet den Editor.
- Jede Gruppenkopfzeile hat **Select all**, und **Cmd-A** bei fokussierter Kachel nimmt jede Farbe, die Sie besitzen, nie eine Starter-Farbe.
- Das Raster hat einen Tabstopp: Pfeile bewegen, Umschalt-Pfeile erweitern, Space schaltet um, Delete entfernt und Escape leert. Um einen Kanal zu verschieben, drücken Sie zuerst `l`, `c` oder `h`.
- Drücken und halten Sie auf einem Touchscreen eine Kachel, um eine Auswahl zu beginnen, und tippen Sie dann zum Hinzufügen.

Die Leiste zeigt **{n} selected**, dann **Move to**, **Give a role** (jede Farbe übernimmt der Reihe nach die nächste Rolle), **Download** (die Auswahl in jedem der sechs Palettenformate), **Duplicate** (eine Kopie von jeder, nach dem Original platziert), **Copy values** und **Delete**. Eine Kopie öffnet sich direkt im Editor; mehrere bleiben ausgewählt. Ein Cmd/Strg-Z macht eine ganze Sammelaktion rückgängig.
:::

### Verläufe

Das optionale Panel **Gradients** baut Verlaufs-Tokens aus der Palette. Jeder Verlauf hat eine Vorschau, 2 bis 8 benannte Stopps und einen Winkel. Ein Stopp zeigt auf ein Farbfeld; färben Sie das Farbfeld um, und der Verlauf folgt. Verläufe laufen in OKLCH.

Die Palette-Downloads (Design-Tokens, CSS, SCSS, GIMP und Adobe Swatch Exchange) liegen in einer Pille am Fuß der Palette, sobald es Abstufungen gibt. [Palette und Schriften überallhin mitnehmen](/info/using.html#take-your-palette-and-fonts-anywhere) beschreibt jedes Format.

## Schrift

Ohne eigene Schrift ist der Raum eine Karte: **Primary**, in Lesegröße in der Schrift gesetzt, die heute dient, mit einem Tag **Starter**, einer Schaltfläche **Choose a face** und der Zeile *"Nothing installs until you choose one."* Headings, Code und Italic folgen der Primärschrift, bis Sie sie wählen; **Choose them separately** zeigt ihre Karten.

![Der Schrift-Raum mit noch keinem gewählten Schriftschnitt - eine Karte in Lesegröße, eine Starter-Markierung darauf und ein ausgefülltes Schriftschnitt auswählen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Wählen Sie eine Schrift, und der Raum öffnet sich zu vier Rollenkarten, der Liste Fonts und einem Live-Muster:

- **Primary**: Fließtext, Schaltflächen und jedes Tool.
- **Headings**: die Auszeichnungsschrift für `h1` und `h2`.
- **Code**: eine Festbreitenschrift für Code und Daten.
- **Italic**: eine echte Kursive für Betonung, Zitate und Randbemerkungen.

Eine Karte ist nur getönt, wo Sie diese Schrift installiert haben, und ihre Schaltfläche sagt **Change** bei einer eigenen Schrift und überall sonst **Choose a face**. Nichts auf einer Karte übernimmt etwas: Die Schaltfläche öffnet die Vergleichsbühne für diese Rolle.

![Die vier aufgedeckten Rollenkarten - jede gesetzt in dem Schriftschnitt, der sie bedient, mit einer Starter-Markierung, wo niemand eine gewählt hat, und Kursiv, das Primär folgt](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Die Vergleichsbühne

Die Bühne öffnet sich im Raum, unter der Karte, die Sie gedrückt haben, und die Karten klappen zu einem einzeiligen Streifen zusammen, damit die Bühne auf dem ersten Bildschirm eines Smartphones sichtbar ist. Escape bricht ab und gibt den Fokus an die Karte zurück.

1. Drücken Sie **Choose a face** auf der Karte.
2. Tippen Sie einen Familiennamen und drücken Sie **Preview**, oder drücken Sie eine der sechs **Pinned**-Familien unter dem Feld.
3. Drücken Sie **Use this face**.

![Die geöffnete Vergleichsbühne unter ihrer Karte, mit der Suchzeile, den angepinnten Familien und den zu einem einzeiligen Streifen eingeklappten Karten](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Die Einwilligung wird einmal erfragt.** Wenn eine Vorschau zum ersten Mal Google Fonts erreicht, erklärt ein Dialog: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** macht weiter und wird gemerkt. **Cancel** lässt die Karte *"Not fetched. Nothing was sent to Google."* lesen, mit ihrem eigenen **Fetch from Google**.

**Legen Sie eine Schriftdatei auf der Bühne ab** (TTF, OTF oder WOFF), um eine lizenzierte Schrift, die Sie schon besitzen, in der Vorschau zu sehen. So oder so bleibt die Schrift auf diesem Gerät, rendert offline in der App, den Tools und jedem Export und reist in der Designsystem-Datei mit. Alles auf Google Fonts wird unter einer offenen Lizenz ausgeliefert (OFL, Apache oder UFL).

### Schriften auf diesem Gerät

Das Panel **Fonts** listet jede Schrift auf diesem Gerät und die Rolle, der sie dient. Von Ihnen hinzugefügte Schriften stehen vorn unter **In the design system**, jede mit ihren Rollen und einem Löschen. Die Starter-Schriften folgen in einer gedämpften, eingeklappten Zeile. **Add a face** öffnet die Vergleichsbühne für jede Rolle. Das Panel **Type roles** zeigt ein Live-Muster jeder Rolle mit ihrer Familie und ihrem Zustand, etwa *Inter* oder *Inter · follows Primary*.

## Tokens

Tokens sind die benannten Werte hinter dem Designsystem: Farben, Schriften, Logos, Ecken und Abstände. Tools lesen sie über ihren Namen, sodass eine Änderung hier jedes Tool auf einmal erreicht.

![Der Raum Tokens: der Kopf mit einem Beispiel aus dem System und den Dateiaktionen, Kacheln, die jede Art von Token zählen, dann die Farbpaare mit ihren Kontrastwerten](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Der Kopf** gibt ein Beispiel aus Ihrem eigenen System (*Primary is Spearmint, #033633*) und die Dateiaktionen: **Download** (das ganze System als Design-Tokens oder die Palette in fünf weiteren Formaten), **Copy CSS** und **Add from…**, um eine JSON-Datei wieder einzulesen.
- **Kacheln** zählen jede Art von Token und springen zu ihrem Abschnitt: Colours, Type, Logos, Shape and spacing, More und All tokens. Sie zählen, was Ihr eigenes ist, wie Overview. Auf einem Smartphone scrollen die Kacheln seitwärts.
- **Colours** beginnt mit den Paaren, die Tools zusammensetzen (Text auf Fläche, auf Primärfarbe, gedämpft auf Fläche), mit einer APCA-Anzeige in hell und dunkel, und markiert **Weak contrast**, wo ein Paar nicht genügt. Dann jede Farbgruppe: eine Rampe als eine Reihe von Chips, andere Farben mit ihrem Wert und der Referenz, die Tools nutzen, etwa `{color.brand.spearmint}`. Drücken Sie eine Referenz, um die Referenz zu kopieren. **Edit in Colours** öffnet eine Gruppe im Raum Colours.
- **Type** und **Logos** listen die Schrift für jede Rolle und jeden Logo-Slot, mit **Edit in Type** und **Edit in Logos**, sobald Sie eigene haben.
- **Shape and spacing** enthält **Rounded corners** (`shape.radius`) und **Spacing rhythm** (`space.base`). Jedes zeigt *Lolly default*, bis Sie den Regler bewegen, und danach *Yours*, speichert sofort und lässt sich rückgängig machen.
- **More tokens** ergänzt Abstände, Größen, Strichstärke, Deckkraft, Drehung, einfache Zahlen und Schatten, gespeichert als Standard-[Design-Tokens](/info/design-tokens.html).
- **App appearance (advanced)** listet die Farben, Größen und Schatten auf, die Lollys eigene Bildschirme nutzen, und **Inspect every token (advanced)** durchsucht und bearbeitet jeden gespeicherten Wert und zeigt jede Änderung zuerst zur Prüfung.

Ein Abschnitt, in dem nichts steht, bietet den Weg, die Lücke zu füllen: **Pick a colour**, **Choose a face** oder **Add a logo**.

## Dateien

Legen Sie die Dateien ab, die Ihre Marke außer Logos behält: **vector**-, **image**-, **audio**- und **motion**-Dateien (Video, Lottie und Animationen). Sie erscheinen in [Assets](/info/using.html#assets-your-library), nach Abschnitten sortiert und bereit in der Asset-Auswahl jedes Tools, und sie bleiben auf diesem Gerät.

## Usage & rules

**Usage & rules** setzt die Entscheidungen Ihrer Marke in Kraft: was Menschen ändern können, was fest bleibt und was Lolly prüfen kann.

![Usage & rules bei Lolly Demo: eine leere Karte Brand rules mit Add your first rule, dann Try your brand in use mit bereiten Beispielen zum Rendern](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** listet Ihre Regeln. **Add rule** (oder **Add your first rule**) öffnet ein kurzes Formular:

- ein **Rule name** in Ihren eigenen Worten, etwa *Beacon accents*;
- der **Check**: **Colour choices**, **Font choices**, **Fixed artwork** oder **Text length**, mit der Markenrolle, die er nutzt, unter Ihrem eigenen Namen für die Rolle;
- das **Example**, auf das er angewendet wird (Poster, Title slide, Content slide oder Chart), der **Mode** und ob er **Required** oder **Advisory** ist;
- **Reviewed by**, dann **Save draft** oder **Approve & save**.

Die Freigabe hält Ihre eigene Entscheidung auf diesem Gerät fest. Freigegebene Pflichtregeln beschränken das wiederverwendbare Poster, und Prüfungen betreffen nur die Beispiel-PNGs; sie ändern kein anderes Tool.

Regeln, die ein Designsystem in seiner Token-Datei mitbringt, etwa freigegebene Farbpaare, Textstärke und Ausrichtung oder ein Logo je Fläche, werden hier als **Checked in Design** aufgeführt. Design prüft sie Ebene für Ebene in der Karte **Before you export** des Export-Panels, und `lolly check` tut dasselbe für ein gespeichertes Design-Dokument ([Vor dem Export](/info/design.html#before-you-export)). Eine Regel, für die dieser Build keine Prüfung hat, wird wie geliefert behalten und mit **Unchecked** markiert.

**Try your brand in use** rendert vier Beispiele aus der aktuellen Revision mit **Render & check examples**. Wählen Sie einen **Brand mode** und **Try your own text** für Überschrift, Begleittext und Foliensatz. Jedes Beispiel berichtet, was gemessen wurde, mit **See checks & sources** und **Download check report**, und **Make reusable poster** lädt eine `.lolly` herunter, deren festes Layout und freigegebene Eingabeoptionen mit der Datei reisen. Beispiele sind lokal: Durch eine Prüfung wird nichts veröffentlicht oder freigegeben.

Ein Build, der mit einer festen Marke ausgeliefert wird, zeigt dieselben Regeln und Beispiele schreibgeschützt, unter *This brand is set*.

## Eine Marke importieren

**Add from…** am Fuß der Leiste öffnet eine Auswahl, die fragt, was Sie haben, nicht welches Format es ist:

- **Design tokens or a design file**: DTCG- oder Tokens-Studio-JSON, ein Penpot-Projekt, ein Zip aus Token-Sätzen, ein Lolly-Designsystem-Paket oder eine SVG.
- **PDF**: ein Deck oder eine Richtliniendatei, auf diesem Gerät auf Farben, Zeichen und eingebettete Schriften gelesen.
- **Logo or screenshot**: Ein Bild wird zu einer vorgeschlagenen Palette, auf diesem Gerät gelesen. Es liest Farben, nicht Schrift oder Layout.
- **Saved web page**: eine HTML-Datei und ihre CSS-Dateien oder eingefügtes HTML oder CSS, bis zu 20 Dateien und 2 MB. Nur der Text, den Sie liefern, wird gelesen: Verknüpfte Ressourcen werden nicht abgerufen, und Skripte laufen nicht.
- **Font file**: TTF, OTF oder WOFF. Öffnet den Raum Type, wo die Schrift installiert wird.
- **Website**: eine Seite, auf Farben und Schrift gelesen. Diese Kachel erscheint nur auf einem Gerät, das eine Seite lesen kann, und sagt, welchen Leser es nutzt: die App auf diesem Gerät oder die Browser-Erweiterung in einem Hintergrund-Tab, als Sie angemeldet. Das Nennen einer URL füllt nur das Feld; das Drücken von Fetch ist die Einwilligung.

Wählen Sie die Quelle Design-Datei, und die nächste Karte listet die akzeptierten Formate als Symbolkacheln, wobei die ganze Karte ein Ablageziel ist. Sie können eine Datei auch direkt auf dem Studio ablegen.

![Die Import-Karte - die akzeptierten Formate führen als Icon-Kacheln an, und die gesamte Karte ist ein einziges Drop-Ziel](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Ein **Lolly-Designsystem-Paket** (`.lolly` oder eine ältere `.zip`) wird in einem Schritt installiert.
- Ein **Penpot**-Export (`.penpot`) bringt seine Design-Tokens.
- Eine **Design Tokens**-Datei (W3C DTCG) oder **Tokens Studio**-Datei (`.json`) bringt ihre Tokens.
- Eine **einfache SVG** wird auf Farben gescannt, aus denen Sie wählen, wobei die erste Ihre Primärfarbe wird.

### Eine Referenz prüfen

Ein Logo, ein Screenshot, eine Website oder eine gespeicherte Seite öffnet **Try these colours**: ein Beispiel in den vorgeschlagenen Farben, eine **Main colour**, die Sie ändern können, und einen Namen für ein neues System. Ein Kasten buchstabiert aus, was das Anwenden bewirkt: Es **ersetzt** die aktiven Token-Einstellungen durch die erzeugte Palette und Standardstile, **behält** Ihre Schriften und Bibliotheksdateien, und das vorherige System lässt sich **wiederherstellen**. **Apply suggested settings** wendet die hellen und dunklen Paletten an, nach einem Checkpoint, und **Restore brand settings** kann die alten Einstellungen zurückbringen. **Change reference** wählt eine andere Quelle.

**Palette, source details and individual choices** zeigt, was gelesen wurde, gefundene Schriftnamen und den Kontrast der Vorschau. Schriftnamen sind nur Vorschläge; Type bleibt der Ort, an dem Sie eine Schrift installieren. Die Quelldetails können Typografie, Abstände, Innenabstände und Eckenwerte enthalten, wo beobachtet, sonst mit **Not observed** gekennzeichnet. Eine gespeicherte Seite oder ein nativer Website-Lesevorgang meldet deklarierte Stile, die die Seite eventuell nicht nutzt, und die Browser-Erweiterung kann gemessene Stile aus einer Stichprobe sichtbarer Elemente melden. Das sind Beobachtungen: Nichts wird installiert, und Quellabstände ersetzen nie Ihre eigenen. **Choose individual items in the tray** behält einzelne Elemente, und **Download design context** speichert einen JSON-Bericht mit Beobachtungen, vorgeschlagenen Tokens und Quellinformationen (mit einem SHA-256 jedes gelieferten HTML oder CSS). Der Bericht enthält keinen rohen Seitentext und ist kein signiertes Content Credential.

PDF- und Design-Datei-Importe behalten ihre eigenen Prüfsteuerungen. Elemente im **Tray** ändern nichts, bis Sie sie in dem Raum hinzufügen, dem diese Art von Material gehört. `#/start?source=<kind>` öffnet die Auswahl auf einer Quelle (`file`, `pdf`, `image`, `font`, `url`, `page`), und `?import` öffnet die einfache Liste.

### Einen Look finden und vergleichen

Öffnen Sie **Find a look** aus Overview oder aus der Designsystem-Liste in Settings. Durchsuchen Sie Systeme, die auf diesem Gerät gespeichert sind, und einige wiederverwendbare Lolly-Beispiele und suchen Sie nach Name, Farb-Tag oder deklarierter Schrift. **Closest to my current palette** sortiert nach gemessener Farbähnlichkeit, wobei passende Schriften Gleichstände auflösen; es ist kein Qualitätswert.

Wählen Sie einen Look zur Prüfung aus oder zwei zum Vergleich nebeneinander. Das Auswählen ändert nichts. **Use this saved system** wechselt dorthin, und **Use these colours** wendet die Farben eines Beispiels über den üblichen Checkpoint an und behält Ihre Schriften. **Restore brand settings** stellt den vorherigen Look wieder her. Gespeicherte Systeme haben bearbeitbare **Search tags** unter **Details and design context**. Die Beispiele sind originale Lolly-Farbrezepte, ohne gescrapte Sammlung und ohne Konto.

![Sunroom und Orchard nebeneinander vergleichen, bevor eines der beiden Farbsysteme angewendet wird.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Ihr Designsystem behalten und bewegen

### Eine Marke zwischen Geräten bewegen

**Export** schreibt eine Datei **`LollyBrand-….lolly`**: Ihre Tokens, Schriften, Logos und Design-Einstellung, mit einem Integritätsmanifest, das beim Zurückholen geprüft wird. Web-Releases vor 1.0.7 nannten dieselbe Datei `.zip`, und diese Schreibweise wird weiterhin akzeptiert. **Tokens (.json)** schreibt das einfache Design-Tokens-Dokument für sich, ohne Schriften oder Logos, für ein Repository, einen Build-Schritt oder ein anderes Tokens-Tool.

Um eine zurückzuholen, nutzen Sie **Add from… → Design tokens or a design file** oder legen Sie die Datei auf dem Studio ab. So reicht Ihnen eine Kollegin oder ein Kollege eine Marke, oder so nehmen Sie eine auf eine zweite Installation mit, ohne Konto und ohne Cloud. Um eine Marke über die Kommandozeile einzubringen, siehe [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** packt die von Ihnen hinzugefügten Schriften in ein installierbares RPM. Wenn Sie welche selbst hochgeladen haben, bittet Lolly Sie zuerst zu bestätigen, dass Sie sie weitergeben dürfen.

### Frühere Einstellungen wiederherstellen

Wählen Sie **Restore brand settings**, wählen Sie einen datierten Checkpoint und drücken Sie **Restore**. Er stellt Farben, Schrifteinstellungen und andere Tokens der aktiven Marke wieder her; Schrift- und Bilddateien bleiben, wie sie sind. Lolly speichert Ihre aktuellen Einstellungen zuerst als **Before restore**, sodass Sie eine Wiederherstellung auch nach dem Schließen des Browsers rückgängig machen können. Die letzten 20 Checkpoints bleiben auf diesem Gerät.

### Versionen

Eine veröffentlichte Version ist eine **dauerhafte, benannte Kopie**, die auf diesem Gerät behalten wird. Sie ändert sich nie, sodass ein Tool oder ein Link, der sie festlegt (mit `designv`), immer dasselbe zeichnet. Ein System mit etwas Eigenem zeigt am Fuß der Leiste einen unaufdringlichen Link **Versions & publishing**; nach Ihrer ersten Veröffentlichung wird daraus der Eintrag **Versions**. `#/start?area=versions` öffnet ihn direkt.

- **Eine Version ist dauerhaft.** Es gibt noch kein Löschen, und das Panel sagt das.
- **Entfernungen führen die Kompatibilitätskarte an**, weil ein entfernter Token das ist, was ein Tool kaputt macht.
- **Veröffentlichen lässt sich nicht rückgängig machen; Wiederherstellen schon.** *Restore latest from this version* ist eine gewöhnliche Bearbeitung, mit sofort angebotenem **Undo**.

**Publish only** behält eine Version, ohne zu ändern, was Tools verfolgen; **Publish and make active** lässt Tools und die App dieser Version folgen. **Follow the latest again** schaltet jede Bearbeitung in dem Moment live, in dem Sie sie vornehmen.

## Ihre Designsysteme verwalten

Öffnen Sie **Settings → Preferences → Design systems**, um Systeme zu wechseln, hinzuzufügen oder zu entfernen. **Open** wählt ein System aus und öffnet es hier; **Make a new one** erzeugt ein lokales System und öffnet es mit bereitem Namensfeld. Jeweils ein System ist aktiv, für das ganze Gerät. [Marken-Architekturen](/info/brand-architectures.html) hilft zu entscheiden, wann eine Marke ein eigenes Designsystem braucht.

**Woher ein System kommt.** Das System, das der Katalog einer Bereitstellung liefert, heißt **Came with this app** oder, in einer App, die mit einer Instanz verbunden ist, **From this instance**. Klappen Sie **Catalogue source** auf, um zu sehen, wer es liefert, sein Tokens-Asset und seinen Namespace und seine bekannte Version oder Prüfsumme; schlägt eine Aktualisierung fehl, wird zwischengespeichertes Material gekennzeichnet.

**Verwaltete Systeme sind schreibgeschützt.** Ein System heißt **Managed by this instance** (oder **Managed by this app** in der Desktop-App ohne Instanz), wenn sein Katalog das System sperrt. Sie können es nutzen und herunterladen, und sein Öffnen hier zeigt einen Hinweis zum Lesen mit **Make an editable copy** und **Switch**. Ihre eigenen lokalen Systeme bleiben bearbeitbar, auch wenn das verwaltete zuerst da war. Ein Build mit einer festen Marke öffnet Design System Setup auf *This brand is set*, mit den Tokens und Nutzungsregeln der Marke zum Lesen.

**Jedes andere gelieferte System gehört Ihnen** zum Ausblenden, Bearbeiten und Zurücksetzen, einschließlich Lolly Demo und Lolly Starter auf lolly.tools. Eine Bearbeitung behält seinen Namen und kennzeichnet die Zeile mit **Edited here**, und **Reset to original** in seinem Menü verwirft die Änderungen, die auf diesem Gerät vorgenommen wurden. Der leere Starter ist die Ausnahme: Eine erste Änderung dort beginnt ein eigenes Designsystem, weshalb Lolly einmal fragt, wie das neue System heißen soll. [Lolly Demo im Einsatz](/info/lolly-demo-in-use.html#switch-to-your-own) zeigt, was Ihr eigenes System ersetzt.

### Ein Designsystem entfernen

Wählen Sie **Remove** im Menü eines Systems; die Bestätigung sagt, welches System danach aktiv ist. Gespeicherte Sitzungen, Uploads und mit einem anderen System geteiltes Material bleiben.

Das Entfernen eines gelieferten Systems blendet es nur aus: Seine Katalog-Assets bleiben, **Bring back** zeigt es wieder, und es kehrt von selbst zurück, wenn Sie alles andere entfernen. Das Entfernen einer importierten oder bearbeiteten Kopie entfernt weder das gelieferte System noch seine Logos oder Schriften, und war die Kopie aktiv, wird das gelieferte System wieder aktiv. Das Entfernen einer aktiven gehosteten Kopie löscht nur die Verbindung dieser Kopie; eine getrennt gewählte Instanz bleibt ausgewählt.

Das Ändern dessen, was ein Server liefert, ist Aufgabe der Administration: Ihr Betreiber ändert den Quellkatalog und stellt neu bereit, oder eine Lolly-Work-Administratorin prüft und übernimmt eine Serveränderung. Bearbeitungen hier bleiben lokal. Siehe [Ein Katalog-Designsystem entfernen](/info/configuration.html#removing-a-catalogue-design-system) und [Konfiguration](/info/configuration.html#supplied-and-local-design-systems).

## Den Design-Kontext außerhalb der App nutzen

**Download design context** speichert das Token-Dokument, aufgelöste Farben, deklarierte Schriftfamilien, Asset-IDs, Quellennachweise, wo erfasst, Abdeckung und ausdrückliche Regeln, ohne Schriftdateien und ohne Eigentumsnachweis. Die Kommandozeile liest die Datei ohne Server: `lolly system import` macht sie zum Designsystem des Terminals, und `lolly system check` prüft Design-Eingaben gegen den gespeicherten Kontext. [Ihr Designsystem einbringen](/info/cli.html#bring-your-design-system) behandelt den Import, [Welches Designsystem ein Befehl nutzt](/info/cli-decks.html#which-design-system-a-command-uses) die Prüfung, und ein MCP-Client liest dasselbe Briefing über `lolly://design-context` ([MCP-Server](/info/mcp.html)).

## Wie es weitergeht

- **[Lolly nutzen](/info/using.html)**: die Tools, Speichern, Teilen und Assets.
- **[Marken-Architekturen](/info/brand-architectures.html)**: wie sich Bereiche, Produkte, mitgetragene Marken, Kunden und Saisons auf Designsysteme, Farbvarianten und Logo-Identitäten abbilden.
- **[Design-Tokens](/info/design-tokens.html)**: das Token-Modell, in dem Ihre Marke geschrieben ist.
- **[Eine Datei exportieren](/info/exporting.html)**: Druckeinheiten, CMYK und die Formate, in die Ihre Marke rendert.
