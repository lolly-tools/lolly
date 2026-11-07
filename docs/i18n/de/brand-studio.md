# Lolly Design System Setup

<a id="design-system-setup"></a>

Ihr Logo, Ihre Farben und Schriften gehören an einen Ort, damit jedes Tool, jede Seite und jeder Export mit ihnen zeichnet. Dieser Ort ist **Lolly Design System Setup** unter `#/start`.

Beginnen Sie mit dem, was Sie haben. Legen Sie ein Logo ab, und Lolly liest seine Farben. Wählen Sie eine Schrift oder legen Sie die Schriftdatei ab, die Ihr Unternehmen lizenziert hat. Jede Änderung zeigt sich sofort in der ganzen App. Ihr Logo, Ihre Schriften und Tokens bleiben auf diesem Gerät. Eine Google Font zu wählen ist der eine Schritt, der nach außen greift: Lolly fragt zuerst, dann holt es die Familie einmal.

Wenn es stimmt, geben Sie dem Designsystem einen Namen und drücken **Export**. Sie erhalten eine `.lolly`-Datei zum Aufbewahren, zum Öffnen auf einem anderen Gerät oder zur Weitergabe an eine Kollegin oder einen Kollegen. [Lolly Settings](/info/dashboard.html#design-system) zeigt das aktive System schreibgeschützt, und seine Titelseite verlinkt zum Bearbeiten hierher zurück.

## In fünf Minuten zu Ihrem machen

::: timeline
- <!--i:upload--> **Legen Sie Ihr Logo ab** auf der Ablagefläche in **Logos**. Lolly liest seine Form und seine Farben.
- <!--i:palette--> **Nutzen Sie diese Farben.** Die Hauptfarbe des Logos wird Ihre Primärfarbe, und ein dunkles Neutral aus dem Logo wird Ihre Textfarbe.
- <!--i:font--> **Wählen Sie eine Schrift** in **Type**: eine Google Font oder eine Schriftdatei, die Sie besitzen.
- <!--i:pentool--> **Benennen Sie das System.** Ihre erste Bearbeitung erzeugt ein eigenes Designsystem, und Lolly fragt einmal nach seinem Namen.
- <!--i:download--> **Export** schreibt das ganze System als eine Datei `LollyBrand-….lolly`.
:::

Die Leiste oben im Studio trägt den Namen des Designsystems, und der Name ist ein Feld, das Sie jederzeit ändern können: **Enter** behält einen neuen Namen, **Escape** stellt den alten wieder her. Wenn Ihre erste Bearbeitung **What is this design system called?** fragt, sind die Worte aus Ihrem Logo eingetragen, wenn das Logo sie ausschreibt. **Save name** behält den Namen; **Not now** behält einen Platzhalter, bis Sie in der Leiste einen eintippen. Der Name beschriftet das System in Settings und beim Wechseln und wird zum Namen der Datei, die **Export** schreibt.

## Die Räume

Das Studio besteht aus Räumen in keiner festen Reihenfolge: Nichts ist nummeriert, und nichts wartet auf etwas anderes. Am Schreibtisch liegen die Räume in einem Streifen unter der Leiste. Auf einem Smartphone wandern sie in eine Leiste am unteren Rand, wo ein Daumen sie erreicht, wobei der offene Raum ins Bild gerollt wird; das Palettenblatt und das Tray steigen über diese Leiste auf, und die Leiste weicht, während Sie tippen. Mit der Tastatur erreicht Tab den Streifen einmal, und die Pfeiltasten, Home und End bewegen von Raum zu Raum.

![Die Leiste des Studios und ihre Räume: Board, Colours, Type, Logos, Tokens, Files, Rules und Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Raum | Was Sie dort tun | Link-Schlüssel |
|---|---|---|
| **Board** | Sehen, was das System enthält, mit einer Tür in jeden Raum | `overview` |
| **Colours** | Farben hinzufügen, ihnen Rollen geben, Abstufungen und eine Palette bauen | `color` |
| **Type** | Die vier Schriften wählen, die die App, die Tools und jeder Export lesen | `type` |
| **Logos** | Ihre Zeichen in jeder Ausrichtung und Behandlung platzieren | `logos` |
| **Tokens** | Ecken, Abstände, Schatten und jeder andere benannte Wert | `tokens` |
| **Files** | Die Bild-, Audio- und Bewegungsdateien, die Ihre Marke behält | `catalogue` |
| **Rules** | Die Regeln, die Ihre Marke anwendet, an echten Beispielen geprüft | `usage` |
| **Skills** | Die schriftlichen Standards der Marke für Menschen und Agenten, zum Lesen und Herunterladen | `skills` |

Verlinken Sie einen Raum mit `#/start?area=<key>`. Der Raum Files behält den Schlüssel `catalogue`, das Board behält `overview` und Rules behält `usage`, weil ein Raumschlüssel ein dauerhafter Vertrag ist, und `?tab=` funktioniert weiter als älterer Alias. Ein unbekannter Schlüssel öffnet das Board.

Die **Leiste** enthält die Aktionen für das ganze System statt für einen Raum. **Add from…** bringt eine Marke herein ([Eine Marke einbringen](#bring-a-brand-in)), und das **Tray** hält, was ein Scan gefunden hat und Sie noch nicht hinzugefügt haben. **Export** schreibt das System als eine Datei, und **More** enthält **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** und **Design systems**, das die Liste in Settings öffnet, wo Sie wechseln ([Ihr Designsystem behalten und bewegen](#keep-and-move-your-design-system)). Jede erscheint, sobald es etwas gibt, worauf sie wirken kann. Auf einem Smartphone wandert **Add from…** in **More**, und **Export** erscheint als sein Symbol.

## Board

Solange noch nichts gewählt ist, bietet das Board vier Wege zum Start. **Start from a reference** öffnet die Quellenauswahl für ein Logo, einen Screenshot, eine Webseite oder eine Design-Datei, und **Pick a colour**, **Choose a face** und **Add a logo** öffnen diese Steuerelemente direkt. Das Öffnen schreibt nichts, und **Explore the tools** ist von Anfang an da.

Sobald irgendetwas Ihr eigenes ist, zeigt das Board, was Sie haben, mit Ihren eigenen Zählwerten vorn. Colours nennt die Zahl der Farben, mit einem gedämpften `· N starter`, wo geerbte Farben erscheinen; sein Streifen stellt Ihre Farben zuerst, dann eine Haarlinie, dann die ausgeblendeten Starter-Farben. Colourways zeigt jedes Colourway als kleine Kachel in seiner Leitfarbe. Type liest sich nach Rolle und setzt jede Familie in ihrer eigenen Schrift (*Inter for headings*, mit *Starter for the rest* in der Zeile darunter). Logos nennt, wie viele Slots gefüllt sind (oder **Not set**), Tokens zeigt den Eckenradius, und Files sagt **Nothing yet**, solange die Bibliothek leer ist. Jeder Block öffnet seinen Raum.

Ein Designsystem, das mit der App kam und bearbeitet werden kann, etwa Lolly Demo, hat all das von Anfang an: Das Board zeigt seine Farben, Colourways, Schriften und Zeichen, mit einem Tag **Came with this app** neben der Überschrift.

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
- Gezählt im Board und in Tokens.
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

![Die Logo-Slots mit geöffneten Horizontal und Vertical: Jede Behandlung ist ein eigener Slot, und jeder Slot ist optional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** sind Zeichen, die Ihre Marke mit eigenem Namen anspricht, etwa ein Icon, ein Wappen oder ein Favicon.
- **More identities.** Eine Untermarke, ein Produkt oder ein Event kann einen eigenen vollen Satz haben: **+ Add another logo** und geben Sie dem Satz einen Namen. Ihr Hauptsatz ist "Your logo". [Marken-Architekturen](/info/brand-architectures.html) zeigt, wann eine Logo-Identität der richtige Baustein ist.
- **Lolly liest die Farben des Logos.** Eine Karte unter der Ablagefläche und noch einmal oben in Colours listet die Farben des Logos und fragt **Which is the main colour?**, mit bereits ausgewählter stärkster Farbe (nie das Weiß, auf dem es exportiert wurde). **Use these colours** fügt sie Ihrer Palette hinzu, macht die Hauptfarbe zu Ihrer Primärfarbe und, wenn das Logo ein dunkles Neutral hat, das auf Papier lesbar ist, macht dieses zur Textfarbe. **Not now** lässt sie im Tray. Bei einer ganz neuen Installation wird die wahrscheinlichste Antwort sofort angewendet, und die Karte bietet **Undo** oder eine andere Hauptfarbe. Eine SVG liefert genaue Farben; ein PNG, JPEG oder WebP liefert die Farben, die einen echten Anteil des Zeichens abdecken.

## Colours

Der Raum wächst mit dem Designsystem: Ein erster Besuch ist eine Entscheidung, und der Rest kommt mit der Palette.

### Die erste Farbe

Ein System ohne eigene Farben zeigt die Neutralen des Starters, geöffnet in ihrer eigenen Gruppe, und oben im Raum ein gestricheltes Feld zum Einfügen und Ablegen: ein großer Chip und ein Feld. Legen Sie ein Bild oder eine Farbliste irgendwo auf dem Feld ab, und Lolly liest die Farben aus dem, was Sie abgelegt haben.

- **Der Chip ist die Auswahl.** Drücken Sie **Pick a colour**, und die OKLCH-Karte des Studios öffnet sich, vorbelegt mit dem, was das Feld enthält: zuerst Name und Hex der Farbe, dann die Farbräume, das Rad, die vier Regler und Alpha unter **Fine-tune**, mit **Cancel** und **Add colour** am Fuß. Nichts erreicht das System, bis Sie **Add colour** drücken.
- **Das Feld nimmt jede Notation**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` oder einen Farbnamen. Fügen Sie eine Liste ein, und sie wird zu einer Reihe von Chips, die Sie einzeln oder mit **Add all** hinzufügen.
- **Zwei weitere Wege hinein.** **Pick a colour from the screen** nutzt die Pipette, wo der Browser eine hat, und **Take colours from an image** liest einen Screenshot oder ein Foto auf diesem Gerät.
- **Add ist nie deaktiviert.** Ist das Feld leer, öffnet es die Auswahl; Text, den es nicht lesen kann, erhält unter dem Feld eine Zeile, die das sagt.

Ihre erste Farbe wird die **Primärfarbe**, und ein Chip bestätigt das, etwa *"Primary is now Vivid Violet"*, mit **Fine-tune**, um die Farbe anzupassen.


### Während die Palette wächst

Ihre Farben stehen neben einer Vorschau **In context** auf einem breiten Bildschirm und darüber auf einem kleineren. Die Vorschau zeigt ein Poster, ein Diagramm oder eine Oberflächenkarte in Ihrer Palette. Starter-Farben bleiben in ihrer eigenen einklappbaren Gruppe, die sich einklappt, sobald das System eigene Farben hat, und das Feld zum Einfügen und Ablegen wird zu einer kompakten Zeile. Export liegt in **Export** der Leiste und im Raum Tokens, daher trägt der Kopf des Raums keinen.

![Der Raum Colours bei Lolly Demo: die Palette in einklappbaren Gruppen, jede Farbe mit Name und Hex, und der Palette-Download im Kopf](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Der Raum Colours bei Lolly Demo nach dem Hinzufügen einer Farbe: die Tabelle Colour roles, dann der Chip der neuen Farbe mit Use as Lead? und Fine-tune, neben einer Live-Kompositionsvorschau](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Farbrollen: wie die Farben heißen

Das Designsystem sagt, wie seine Farben heißen und wofür jede da ist, und Lolly liest das. **Colour roles** steht am Kopf des Raums Colours. Auf einem breiten Bildschirm teilt sich **In context** die Ansicht, sodass eine Änderung sofort auf Poster, Diagramm und Oberflächenkarte erscheint.

![Die Tabelle Colour roles bei Wefthouse, einer erfundenen Textilmarke, in den eigenen Worten: die Chips der Farbvarianten Indigo, Madder und Weld, dann Main, Accent, Supporting und Tertiary, jeweils mit ihrer hellen und dunklen Farbe, gelesen als Leitfarbe, Partnerfarbe und nur nach Namen, und Background, Text, Quiet text und Hairlines unter der Tabelle als die Lesarten, die keine Rolle belegt](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Die Tabelle hat vier Spalten, und auf einem Smartphone wird jede Zeile zu einer Karte, die Hell und Dunkel nebeneinander hält:

| Spalte | Was sie enthält |
|---|---|
| **Role** | Das eigene Wort des Designsystems, das Sie direkt bearbeiten können, und eine Zeile, die sagt, wofür die Farbe da ist |
| **Light** und **Dark** | Die Farbe in diesem Look für die gewählte Farbvariante, mit Name oder Wert und ihrem Kontrast |
| **Lolly reads this as** | Was ein Tool mit der Rolle macht, in Lollys eigenen Worten |

**Wie Lolly eine Rolle liest.** Jede Lesart gehört genau einer Rolle: Wählen Sie eine Lesart, die eine andere Rolle hält, wandert diese Lesart hierher. Lolly liest nie eine Bedeutung aus einem Wort.

| Lesart | Was daraus folgt |
|---|---|
| **Lead colour** | Große Formen, Schaltflächen, die Farbe, mit der ein Tool führt |
| **Partner colour** | Die zweite Farbe, nach der ein Tool greift |
| **Background** | Liegt hinter allem anderen |
| **Text** | Überschriften und Fließtext |
| **Quiet text** | Bildunterschriften und Kleingedrucktes |
| **Hairlines** | Linien, Rahmen und Trenner |
| **By name only** | Kein Tool wählt die Rolle von selbst. Sie wird in jedem Farbfeld und in Design angeboten, wo eine Wahl verknüpft bleibt, sodass sie der Farbvariante folgt |

Eine Lesart, die keine Rolle belegt, bleibt, wie das Designsystem sie festlegt, und der Raum listet sie unter der Tabelle auf. Eine Rolle mit der ID einer Lesart, etwa eine Rolle namens Primary, ist diese Lesart und lässt sich nicht verschieben.

**In einem Diagramm.** Die Palette **Design system - colour roles first** von Lolly Chart gibt den Datenreihen zuerst die Farbrollen des Designsystems in dessen eigener Reihenfolge, danach den Rest seiner Palette. Eine Rolle, die als Background, Text, Quiet text oder Hairlines gelesen wird, bleibt ausgelassen, weil das Diagramm seinen Grund und seine Schrift in diesen Farben zeichnet. Nichts ändert sich, bis Sie diese Palette wählen, und ein Designsystem ohne Farbrollen zeichnet die Palette wie **Design system - ordered**.

**Werte.** Drücken Sie einen Wert, um für diese Rolle, in diesem Look, in der gewählten Farbvariante eine Farbe zu wählen. **Same as light** lässt den dunklen Wert dem hellen folgen, bis Sie eine eigene Farbe wählen. Der Chip **Aa** zeigt den Text, den Lolly für diese Farbe wählt, und die Zeile unter dem Wert sagt je Look, wie dieser Text sich liest: **Text reads well**, **Large text only** oder **Hard to read as text**. Das betrifft Text auf der Farbe und sagt nichts gegen die Farbe selbst, die für Formen und große Flächen weiter taugen kann. Eine Rolle, die nur über den Namen gelesen wird, zeigt dieselben Worte ohne Warnfarbe, weil kein Tool von selbst Text darauf setzt. Die Zahlen hinter den Worten, APCA zuerst und WCAG danach, stehen im Tooltip und in der Auswahl. **Own text colour** kennzeichnet einen Wert, dessen Datei die Textfarbe festlegt, die bleibt. **Copied** kennzeichnet einen Wert, der aus einer anderen Farbvariante oder von der Partnerfarbe stammt und den noch niemand gewählt hat; **Keep this colour** in der Auswahl besiegelt den Wert.

**Ausgangspunkte.** Ein Designsystem ohne eigene Rollen zeigt die heutigen Worte: Primary, Secondary, Surface und Text. Nichts wird geschrieben, bis Sie eines ändern. **+ Add a role** bietet **Primary, Secondary** oder **Main, Accent, Supporting, Tertiary** als Vorschläge an oder beliebige Worte, die Sie tippen, mit der Lesart, die jedes bekäme. Die ersten beiden Worte werden zur Leitfarbe und zur Partnerfarbe. Tools zeichnen weiter dieselben Farben, und in einem System mit einer Leitfarbe ist die erste Farbvariante nach dieser Farbe benannt.

**Umbenennen, umordnen, entfernen.** Ein Umbenennen ändert nur das Wort, daher funktioniert alles, was die Rolle nutzt, weiter. Ziehen Sie eine Rolle an ihrem Griff, oder drücken Sie auf dem Griff Space, nutzen Sie die Pfeiltasten und drücken Sie Space zum Ablegen. **Remove** sagt, was die Rolle noch nutzt. Lesen Tools sie, lässt **Remove and keep those colours** jede Lesart bei der Farbe, mit der sie jetzt zeichnet. Eine Hausregel, eine Leitfaden-Gruppe, ein Tool-Feld oder ein anderes Token, das die Rolle nutzt, hält sie, bis sich diese Nutzung ändert. Ein gespeichertes Design-Dokument kann eine Rolle auch über den Namen nutzen, und das sieht Lolly in der Token-Datei nicht: Ein solches Dokument meldet die Farbe als nicht aufgelöst.

**Eine handgeschriebene Datei.** Farben, die eine Token-Datei enthält und die keine Rolle deklariert, stehen unter **In this file, with no role yet**, jede mit einem Feld für ein Wort und **Make a role**. Sie funktionieren in beiden Fällen weiter über den Namen. Ein Token mit Ziffern im Namen kann keine Rolle sein, daher bleibt es in der Datei und funktioniert weiter über seinen Pfad. Ein Eintrag in der Datei, der die Prüfung nicht besteht, zeigt die Tabelle ohne Steuerelemente und sagt, warum.

**Der Rest des Raums spricht dieselben Worte.** Die Chips, die Zeile **Use as** des Farbfelds und die Gruppe **Colour roles** der Palette nutzen alle die Worte des Designsystems, und die Kachel einer Farbrolle öffnet ihren Wert. Exportierte Dateien halten nichts Neues zu Rollen fest: Die Farben in einem Render ändern sich, weil sich die Tokens geändert haben.

**Wohin die Worte gehen.** Die Worte und Beschreibungen reisen mit dem Designsystem. Agenten lesen sie im Design-Brief, in `lolly://tokens` und in der `AGENTS.md` einer Markenseite, das Terminal zeigt sie in `lolly system status`, und eine Markenseite listet sie in `brand.json` auf und misst für jede Rolle ein Kontrastpaar. Jedes Exportformat behält, wofür es Platz hat: DTCG- und Tokens-Studio-Dateien behalten alles, `DESIGN.md` behält die Worte und die Lesarten, und ein PowerPoint-Theme behält nur die Reihenfolge der Marke. [Farbrollen in anderen Formaten](/info/design-tokens.html#colour-roles-in-other-formats) hat die vollständige Liste. Worte werden stets als Daten des Designsystems zitiert und nie als Anweisungen gelesen.

**Wo eine Farbe gewählt wird.** Jedes Farbfeld in einem Tool und in Lolly Design führt mit den Rollen des Designsystems, in dessen eigener Reihenfolge, mit sichtbarem Wort und sichtbarem Zweck der Farbe. **Aa** neben einer Rolle wählt die Farbe, die auf dieser Rolle sitzt. Der Rest folgt unter **Other colours**, ohne die eigenen Kopien einer Farbvariante, die On-Farben und jede Lesart, die eine Rolle schon belegt. Eine Wahl bleibt mit der Rolle verknüpft und folgt der Farbvariante, das Feld zeigt das Wort weiter an, welche Farbvariante auch gewählt ist, und auch Settings und Tokens nutzen das Wort. Ein Designsystem ohne Rollen behält das Raster aus Farbfeldern, das es immer hatte.

### Jede Farbe, die ein Tool liest

Bei geschlossenem **Colour roles** führen die ersten Entscheidungen den Raum als Chips an, jeder mit der Farbe, die die Rolle spielt, und ihrem Namen. In einem System ohne eigene Worte sind das **Primary**, **Secondary**, **Surface** und **Text**. Drücken Sie einen Chip, um seine Farbe aus den eigenen Farbfeldern der Palette zu wählen. **Every colour a tool reads** am Fuß von **Colour roles** hat den vollständigen Streifen.

Der Streifen zeigt die sieben Farben, die ein Tool lesen kann: Primary, Secondary, Surface, Text, Muted, Edge und On primary, in den eigenen Worten des Designsystems, wo es welche hat. Jede übernimmt in jedem Tool und Export dieselbe Aufgabe. Keine muss gesetzt sein (drei lose Farben sind ein gutes System), jede Farbe kann eine belegen, und die Anzeige sagt, wie sich Text liest, gemessen gegen die Fläche, APCA zuerst. Jede Zeile zeigt eine eigene Farbe in voller Stärke, eine einspringende Starter-Farbe oder **↳ follows Primary**.

On primary wird aus der Primärfarbe abgeleitet, steht als **Derived** und hat keine Auswahl. Der Schalter **Light** und **Dark** daneben und der neben **In context** wählen, welchen Look der Streifen, die Palette und die Vorschau zeigen.

Der eigene Akzent der App folgt standardmäßig dem Designsystem. Das ist die Einstellung **Interface follows the design system** unter **Settings → Appearance**; ist sie aus, bleibt das Chrome der App neutral, während Tools, Arbeitsflächen und Exporte dem Designsystem in beiden Fällen folgen.

**Farbvarianten.** Ein Designsystem kann mehrere Leitfarben enthalten, je Werk gewählt. Die Zeile **Colourways** am Kopf von **Colour roles** zeigt einen Chip je Farbvariante, mit **Default** auf der kanonischen. **+ Add** startet eine neue Farbvariante aus einer der Farben der Palette. Wählen Sie einen Chip, und die Tabelle, der Streifen, die Palette und die Vorschauen zeigen diese Farbvariante; die gewählte Farbvariante lässt sich umbenennen, duplizieren, zur Standardvariante machen oder entfernen. Bei einem System mit Farbvarianten braucht jede Farbvariante eine eigene Primär- und Sekundärfarbe und, wenn die Farbvarianten den Hintergrund tönen, eine eigene Fläche; diese Rollen bleiben daher im Farbfeld-Editor gesetzt. [Farbvarianten zu einem Designsystem hinzufügen](/info/colourways.html#add-colourways-to-a-design-system) hat die Schritte und das Token-Format, und [Lolly Demo im Einsatz](/info/lolly-demo-in-use.html#colourways-on-real-work) zeigt Farbvarianten an echter Arbeit.

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

Die Palette listet Ihre Farben in einklappbaren Gruppen, jede mit ihrem eigenen **+ Add**. Legen Sie Gruppen an und benennen Sie sie nach Belieben um. Eine Rolle erzeugt nie eine zweite Kachel: Eine Kachel, auf die eine Rolle zeigt, trägt stattdessen den Namen der Rolle, etwa **Primary**. **Colour chart** unter den Kacheln zeigt dieselben Farben auf dem OKLCH-**Wheel** (ziehen Sie einen Punkt zum Umfärben, klicken Sie in leeren Raum, um ein Farbfeld hinzuzufügen) und im **Gamut**-Diagramm, das zeigt, wo der darstellbare Bereich endet. `#/start?area=color&focus=chart` öffnet das Diagramm direkt.

![Der Palettenbereich, jede Gruppe einklappbar, mit dem Palette-Download in ihrem Kopf](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Das OKLCH-Rad - der Winkel steht für den Farbton, der Abstand von der Mitte für das Chroma, und die Grautöne verlaufen seitlich auf einer Helligkeitsschiene](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klicken Sie ein Farbfeld an, um seinen Editor zu öffnen:

- **Rename** das Farbfeld.
- **Set the colour** auf OKLCH-Reglern oder in **Hex**, **HSL**, **RGB** oder **CMYK**. Das Wertefeld liest und schreibt im aktiven Raum. CMYK setzt hier die Bildschirmfarbe durch Umrechnung; um genaue Druckfarben festzulegen, nutzen Sie **Print substitutes**.
- **Stored as** wählt, wie das Farbfeld gespeichert wird: **LCH** (der Standard, wahrnehmungsbasiert und mit weitem Farbraum), Hex, RGB oder HSL.
- **Use as** gibt dem Farbfeld direkt eine Rolle, in den eigenen Worten des Designsystems, wo es welche hat. Drücken Sie eine hervorgehobene Rolle erneut, um die Rolle zu löschen.
- **Print substitutes** (eingeklappt): sperren Sie **CMYK** von **Auto** auf genaue Druckfarbwerte oder legen Sie eine **Spot colour** mit einem **Name** (etwa `PANTONE 186 C`), einem optionalen **Book** und einem **Finish** für Folie, Prägung, Blindprägung, Spotlack, Soft Touch oder Stanzung, Rillung oder Perforation fest. Eine Druckmaschine nutzt diese Sperren, wenn Sie ein CMYK-PDF oder TIFF exportieren; siehe [Farbprofile](/info/exporting.html#colour-profiles).
- **In other spaces** (eingeklappt): ein Wert pro Farbraum, abgeleitet oder von Ihnen verfasst, und ein verfasster gewinnt beim Export.

**Ein Farbfeld zu löschen** ist sicher. Abgeleitete Abstufungen und Design-Rollen werden ausgeblendet, sodass nichts kaputtgeht, was sie liest, während von Ihnen hinzugefügte Farben entfernt werden.

::: details Mit vielen Farbfeldern arbeiten
Jedes Farbfeld hat einen Ziehgriff. Ziehen Sie, um innerhalb einer Gruppe neu zu ordnen, oder fokussieren Sie den Griff, drücken Sie Space, nutzen Sie die Pfeiltasten und drücken Sie Space erneut zum Ablegen; Escape bricht ab. Auf einem Smartphone zeigt die Palette vier Farben pro Zeile, und die Griffe erscheinen im Modus Select statt als Zeile unter jeder Farbe. Um Farben zwischen Gruppen zu verschieben, nutzen Sie das Steuerelement **Group** des Editors oder wählen Sie mehrere aus und nutzen **Move to**.

Die Auswahl braucht keinen Modus. Die Leiste und die Kontrollkästchen erscheinen mit der ersten ausgewählten Kachel und verschwinden mit der letzten.

- **Ziehen auf leerem Raum** zeichnet ein Rechteck; jede Kachel, die es berührt, kommt in die Auswahl, über Gruppen hinweg. Ein eingeklappter Abschnitt fügt nichts hinzu.
- **Umschalt-Klick** nimmt einen Bereich in Leserichtung, **Cmd/Strg-Klick** schaltet eine Kachel um, und ein einfacher Klick öffnet den Editor.
- Jede Gruppenkopfzeile hat **Select all**, und **Cmd-A** bei fokussierter Kachel nimmt jede Farbe, die Sie besitzen, nie eine Starter-Farbe.
- Das Raster hat einen Tabstopp: Pfeile bewegen, Umschalt-Pfeile erweitern, Space schaltet um, Delete entfernt und Escape leert. Um einen Kanal zu verschieben, drücken Sie zuerst `l`, `c` oder `h`.
- Drücken und halten Sie auf einem Touchscreen eine Kachel, um eine Auswahl zu beginnen, und tippen Sie dann zum Hinzufügen.

Die Leiste zeigt **{n} selected**, dann **Move to**, **Give a role** (jede Farbe übernimmt der Reihe nach die nächste Rolle), **Download** (die Auswahl in jedem der sechs Palettenformate), **Duplicate** (eine Kopie von jeder, nach dem Original platziert), **Copy values** und **Delete**. Eine Kopie öffnet sich direkt im Editor; mehrere bleiben ausgewählt. Ein Cmd/Strg-Z macht eine ganze Sammelaktion rückgängig.
:::

### Verläufe

Das optionale Panel **Gradients** baut Verlaufs-Tokens aus der Palette. Jeder Verlauf hat eine Vorschau, 2 bis 8 benannte Stopps und einen Winkel. Ein Stopp zeigt auf ein Farbfeld; färben Sie das Farbfeld um, und der Verlauf folgt. Verläufe laufen in OKLCH.

Die Palette-Downloads (Design-Tokens, CSS, SCSS, GIMP und Adobe Swatch Exchange) liegen im Kopf der Palette, neben ihrer Überschrift. [Palette und Schriften überallhin mitnehmen](/info/using.html#take-your-palette-and-fonts-anywhere) beschreibt jedes Format.

## Schrift

Ohne eigene Schrift ist der Raum eine Karte: **Primary**, in Lesegröße in der Schrift gesetzt, die heute dient, mit einem Tag **Starter**, einer Schaltfläche **Choose for Primary** und der Zeile *"Nothing installs until you choose one."* Headings, Code und Italic folgen der Primärschrift, bis Sie sie wählen; **Choose them separately** zeigt ihre Karten.

![Der Schrift-Raum mit noch keinem gewählten Schriftschnitt - eine Karte in Lesegröße, eine Starter-Markierung darauf und ein ausgefülltes Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Wählen Sie eine Schrift, und der Raum öffnet sich zu vier Rollenkarten, der Liste Fonts und einem Live-Muster:

- **Primary**: Fließtext, Schaltflächen und jedes Tool.
- **Headings**: die Auszeichnungsschrift für `h1` und `h2`.
- **Code**: eine Festbreitenschrift für Code und Daten.
- **Italic**: eine echte Kursive für Betonung, Zitate und Randbemerkungen.

Eine Karte ist nur getönt, wo Sie diese Schrift installiert haben. Ihre Schaltfläche sagt, für welche Rolle sie ist: **Change Headings** bei einer eigenen Schrift und überall sonst **Choose for Headings**. Die Beispielzeile bricht um, statt abgeschnitten zu werden. Nichts auf einer Karte übernimmt etwas: Die Schaltfläche öffnet die Vergleichsbühne für diese Rolle.

![Die vier aufgedeckten Rollenkarten - jede gesetzt in dem Schriftschnitt, der sie bedient, mit einer Starter-Markierung, wo niemand eine gewählt hat, und Kursiv, das Primär folgt](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Die Vergleichsbühne

Die Bühne öffnet sich im Raum, unter der Karte, die Sie gedrückt haben, und die Karten klappen zu einem einzeiligen Streifen zusammen, damit die Bühne auf dem ersten Bildschirm eines Smartphones sichtbar ist. Escape bricht ab und gibt den Fokus an die Karte zurück.

1. Drücken Sie **Choose for** und die Rolle auf der Karte.
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
- **Kacheln** zählen jede Art von Token und springen zu ihrem Abschnitt: Colours, Type, Logos, Shape and spacing, More und All tokens. Sie zählen, was jeder Abschnitt enthält; ein Abschnitt, der nur enthält, was mit dem leeren Starter kam, trägt einen Tag **Starter**, und ein System, das mit der App kam, zählt sein eigenes Material ohne einen. Auf einem Smartphone brechen die Kacheln in zwei Reihen zu je drei um.
- **Colours** beginnt mit den Paaren, die Tools zusammensetzen (Text auf Fläche, auf Primärfarbe, gedämpft auf Fläche), mit einer APCA-Anzeige in hell und dunkel, und markiert **Weak contrast**, wo ein Paar nicht genügt. Dann jede Farbgruppe: eine Rampe als eine Reihe von Chips, andere Farben mit ihrem Wert und der Referenz, die Tools nutzen, etwa `{color.brand.spearmint}`. Drücken Sie eine Referenz, um die Referenz zu kopieren. **Edit in Colours** öffnet eine Gruppe im Raum Colours. Bei einem Designsystem mit [Farbrollen](#colour-roles-what-the-colours-are-called) steht **Colour roles** zuerst, mit jeder Rolle einmal in den eigenen Worten und der Reihenfolge des Systems. Eine Rolle hält eine Farbe für jede Farbvariante und jeden Look, und diese Farben bleiben bei der Rolle, statt als eigene Farben zu erscheinen: Ändern Sie sie in der Tabelle Colour roles.
- **Type** und **Logos** listen die Schrift für jede Rolle und jeden Logo-Slot, mit **Edit in Type** und **Edit in Logos**, sobald Sie eigene haben.
- **Shape and spacing** enthält **Rounded corners** (`shape.radius`) und **Spacing rhythm** (`space.base`). Jedes zeigt *Lolly default*, bis Sie den Regler bewegen, und danach *Yours*, speichert sofort und lässt sich rückgängig machen.
- **More tokens** ergänzt Abstände, Größen, Strichstärke, Deckkraft, Drehung, einfache Zahlen und Schatten, gespeichert als Standard-[Design-Tokens](/info/design-tokens.html).
- **App appearance (advanced)** listet die Farben, Größen und Schatten auf, die Lollys eigene Bildschirme nutzen, und **Inspect every token (advanced)** durchsucht und bearbeitet jeden gespeicherten Wert und zeigt jede Änderung zuerst zur Prüfung. Dort werden die Werte einer Farbrolle in jeder Farbvariante mit der Rolle aufgeführt: Wählen Sie das Token der Rolle, um eine Zeile pro Farbvariante zu sehen, hell und dunkel nebeneinander, und die Zählzeile sagt, wie viele Werte die Rollen halten. Ein schreibgeschütztes Designsystem zeigt dieselbe Liste.

Ein Abschnitt, in dem nichts steht, bietet den Weg, die Lücke zu füllen: **Pick a colour**, **Choose a face** oder **Add a logo**.

## Dateien

Legen Sie die Dateien ab, die Ihre Marke außer Logos behält: **vector**-, **image**-, **audio**- und **motion**-Dateien (Video, Lottie und Animationen). Sie erscheinen in [Assets](/info/using.html#assets-your-library), nach Abschnitten sortiert und bereit in der Asset-Auswahl jedes Tools, und sie bleiben auf diesem Gerät.

## Rules

**Rules** setzt die Entscheidungen Ihrer Marke in Kraft: was Menschen ändern dürfen, was fest bleibt und was Lolly prüfen kann.

![Rules bei Lolly Demo: vier Hausregeln, jede als Checked in Lolly Design und als Required oder Advisory markiert, dann Try your design system in use mit seinen zum Rendern bereiten Beispielen](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** listet Ihre Regeln. **Add rule** (oder **Add your first rule**) öffnet ein kurzes Formular:

- ein **Rule name** in Ihren eigenen Worten, etwa *Beacon accents*;
- die **Check**: **Colour choices**, **Font choices**, **Fixed artwork** oder **Text length**, mit der Markenrolle, die sie nutzt, unter Ihrem eigenen Namen für die Rolle;
- das **Example**, auf das sie sich bezieht (Poster, Title slide, Content slide oder Lolly Chart), der **Mode** und ob sie **Required** oder **Advisory** ist;
- **Reviewed by**, dann **Save draft** oder **Approve & save**.

Die Freigabe hält Ihre eigene Entscheidung auf diesem Gerät fest. Freigegebene Pflichtregeln beschränken das wiederverwendbare Poster, und Prüfungen betreffen nur die Beispiel-PNGs; sie ändern kein anderes Tool.

Regeln, die ein Designsystem in seiner Token-Datei mitbringt, etwa freigegebene Farbpaarungen, Schriftstärke und Ausrichtung oder ein Logo je Fläche, stehen hier als **Checked in Lolly Design**. Lolly Design prüft sie Ebene für Ebene in der Karte **Before you export** des Export-Panels, und `lolly check` tut dasselbe für ein gespeichertes Lolly-Design-Dokument ([Vor dem Export](/info/design.html#before-you-export)). Eine Regel, für die dieser Build keine Prüfung hat, bleibt wie geliefert erhalten und ist als **Unchecked** markiert.

Lolly Demo bringt vier freigegebene Hausregeln mit. Überschriften werden nie in Großbuchstaben gesetzt: Diese Regel ist verpflichtend, daher meldet `lolly check` eine Überschrift in Großbuchstaben als Fehler. Die anderen drei sind beratend. Fließtext ist linksbündig. Primäre Zeichen stehen auf hellen Flächen und umgekehrte auf dunklen. Gestrichelte Linien bedeuten: hier ablegen.

**Try your design system in use** rendert vier Beispiele aus der aktuellen Revision mit **Render & check examples**. Wählen Sie einen **Mode** und **Try your own text** für Überschrift, Begleittext und Folientext. Jedes Beispiel meldet, was gemessen wurde, mit **See checks & sources** und **Download check report**, und **Make reusable poster** lädt eine `.lolly` herunter, deren festes Layout und freigegebene Eingabewahlen mit der Datei reisen. Beispiele sind lokal: Nichts wird veröffentlicht oder freigegeben, wenn Sie eine Prüfung ausführen.

Ein Build, der mit einer festen Marke ausgeliefert wird, zeigt dieselben Regeln und Beispiele schreibgeschützt, unter *This brand is set*.

## Skills

**Skills** listet die [Marken-Skills](/info/brand-skills.html) des aktiven Designsystems: die schriftlichen Standards der Marke, einer je Disziplin, für Menschen und KI-Agenten. Jede Zeile nennt die Disziplin, den eigenen Status der Marke (**Entwurf** oder **Freigegeben**), ob der Skill öffentlich oder intern ist, und seine Revision. Wählen Sie eine Zeile, um den Skill neben seiner Abdeckung zu lesen, die die Zeilen des Skills gegen Ihre Tokens hält: was Lolly prüft, was kollidiert, was übereinstimmt und was nur Orientierung ist.

**Skill herunterladen (.zip)** schreibt den Skill als Agent-Skills-Ordner für ein Agenten-Tool, mit Katalog-Links, die auf dieses Lolly zeigen, und **Als eine Datei kopieren** legt denselben Text für ein Chat-Fenster in die Zwischenablage. Ein Designsystem ohne eigene Skills listet eine Basis, die Lolly bei jedem Lesen aus seinen Tokens und Hausregeln schreibt. Der Raum liest Skills und bearbeitet sie nie.

## Eine Marke importieren

**Add from…** in der Leiste öffnet eine Auswahl, die fragt, was Sie haben, nicht, welches Format es hat:

- **Design tokens or a design file**: DTCG- oder Tokens-Studio-JSON, ein Penpot-Projekt, ein Zip mit Token-Sets, ein Lolly-Designsystem-Paket, ein SVG, eine `DESIGN.md` oder ein Markenseiten-Ordner.
- **PDF**: eine Präsentation oder eine Richtliniendatei, auf diesem Gerät auf Farben, Zeichen und eingebettete Schriften gelesen.
- **Logo or screenshot**: Ein Bild wird zu einer vorgeschlagenen Palette, auf diesem Gerät gelesen. Es liest Farben, nicht die Schrift oder das Layout.
- **Saved web page**: eine HTML-Datei und ihre CSS-Dateien oder eingefügtes HTML oder CSS, bis zu 20 Dateien und 2 MB. Gelesen wird nur der Text, den Sie liefern: Verlinkte Ressourcen werden nicht abgerufen, und Skripte laufen nicht.
- **Font file**: TTF, OTF oder WOFF. Öffnet den Raum Type, in dem die Schrift installiert wird.
- **Website**: eine Seite, auf Farben und Schrift gelesen. Diese Kachel erscheint nur auf einem Gerät, das eine Seite lesen kann, und sagt, welchen Leser es nutzt: die App auf diesem Gerät oder die Browser-Erweiterung in einem Hintergrund-Tab, als Sie angemeldet. Eine URL zu nennen füllt nur das Feld aus; der Druck auf Abrufen ist die Zustimmung.

Wählen Sie die Quelle Design-Datei, und die nächste Karte listet die akzeptierten Formate als Symbolkacheln, wobei die ganze Karte ein Ablageziel ist. Sie können eine Datei auch direkt auf dem Studio ablegen.

![Die Import-Karte - die akzeptierten Formate führen als Icon-Kacheln an, und die gesamte Karte ist ein einziges Drop-Ziel](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Ein **Lolly design-system pack** (`.lolly` oder ein älteres `.zip`) wird in einem Schritt installiert.
- Ein **Penpot**-Export (`.penpot`) bringt seine Design-Tokens mit.
- Eine **Design Tokens**- (W3C DTCG) oder **Tokens Studio**-Datei (`.json`) bringt ihre Tokens mit. Eine Beschreibung, die einen Leser bittet, Anweisungen zu ignorieren, Berechtigungen behauptet oder zum Ausführen von Code auffordert, wird weggelassen, und der Import sagt, wo sie stand. Das ist eine zeilenweise Prüfung und übersieht andere Formulierungen, also lesen Sie eine Datei von jemandem, den Sie nicht kennen, bevor Sie die Tokens anwenden.
- Ein **plain SVG** wird auf Farben gescannt, aus denen Sie wählen, wobei die erste Ihre Primärfarbe wird.
- Eine **`DESIGN.md`** (`.md`) geht mit ihren Tokens, wie geschrieben, zu **Try these colours**. Ihr Text kann als Entwurf einer Marken-Skill behalten werden, und die Karte markiert Zeilen, die einen Leser bitten, Anweisungen zu ignorieren, Berechtigungen zu beanspruchen oder Code auszuführen. Agenten und Markenseiten sehen einen Entwurf nicht, bis Sie im Raum Skills **Keep this skill** drücken, und eine behaltene Skill bleibt intern.
- Ein **Markenseiten-Ordner**, als Ordner gewählt, abgelegt oder gezippt, geht an dieselbe Prüfung. Jede Datei wird gegen die `brand.json` des Ordners geprüft, und eine, die nicht passt, weist den ganzen Ordner zurück. Er fügt die Tokens hinzu. Logos und Schriften bleiben im Ordner.

Lolly liest eine Markenseite aus Dateien, die Sie liefern. Es ruft die Adresse einer anderen Website nicht ab.

### Eine Datei mit eigenen Farbworten

Eine Token-Datei oder eine `DESIGN.md` kann für ihre Farben eigene Worte nutzen, etwa main, accent, supporting und tertiary. Findet Lolly solche Worte, listet die Prüfung jedes auf, bevor etwas angewendet wird: das Wort, seine Farbe in jedem Look, das Token, aus dem es stammt, und als was Lolly es lesen würde. Lolly schlägt diese Lesarten allein aus den Worten vor, anhand einer kurzen Liste, und nutzt kein Modell. Ein Wort außerhalb der Liste kommt als eigenes der Marke an, **By name only**. Benennen Sie ein Wort um, sagen Sie, wofür es da ist, lesen Sie es als etwas anderes oder nehmen Sie das Häkchen weg, um es als benannte Farbe zu belassen.

**Install with these roles** schreibt sie, und **Install without roles** installiert die Datei genau so, wie sie kam. Eine Datei ohne solche Worte zeigt keinen neuen Schritt. Eine Datei, die ihre eigenen Rollen angibt, etwa eine, die Lolly geschrieben hat, zeigt sie wie geschrieben und installiert sie unverändert, und Sie können sie danach im Raum Colours bearbeiten. Das Terminal hat keine Prüfung, daher behält `lolly system import` einen angegebenen Eintrag und lässt die Worte anderer Dateien als benannte Farben.

### Eine Referenz prüfen

Ein Logo, ein Screenshot, eine Website oder eine gespeicherte Seite öffnet **Try these colours**: ein Beispiel in den vorgeschlagenen Farben, eine **Main colour**, die Sie ändern können, und einen Namen für ein neues System. Ein Kasten buchstabiert aus, was das Anwenden bewirkt: Es **ersetzt** die aktiven Token-Einstellungen durch die erzeugte Palette und Standardstile, **behält** Ihre Schriften und Bibliotheksdateien, und das vorherige System lässt sich **wiederherstellen**. **Apply suggested settings** wendet die hellen und dunklen Paletten an, nach einem Checkpoint, und **Restore brand settings** kann die alten Einstellungen zurückbringen. **Change reference** wählt eine andere Quelle.

**Palette, source details and individual choices** zeigt, was gelesen wurde, gefundene Schriftnamen und den Kontrast der Vorschau. Schriftnamen sind nur Vorschläge; Type bleibt der Ort, an dem Sie eine Schrift installieren. Die Quelldetails können Typografie, Abstände, Innenabstände und Eckenwerte enthalten, wo beobachtet, sonst mit **Not observed** gekennzeichnet. Eine gespeicherte Seite oder ein nativer Website-Lesevorgang meldet deklarierte Stile, die die Seite eventuell nicht nutzt, und die Browser-Erweiterung kann gemessene Stile aus einer Stichprobe sichtbarer Elemente melden. Das sind Beobachtungen: Nichts wird installiert, und Quellabstände ersetzen nie Ihre eigenen. **Choose individual items in the tray** behält einzelne Elemente, und **Download design context** speichert einen JSON-Bericht mit Beobachtungen, vorgeschlagenen Tokens und Quellinformationen (mit einem SHA-256 jedes gelieferten HTML oder CSS). Der Bericht enthält keinen rohen Seitentext und ist kein signiertes Content Credential.

PDF- und Design-Datei-Importe behalten ihre eigenen Prüfsteuerungen. Elemente im **Tray** ändern nichts, bis Sie sie in dem Raum hinzufügen, dem diese Art von Material gehört. `#/start?source=<kind>` öffnet die Auswahl auf einer Quelle (`file`, `pdf`, `image`, `font`, `url`, `page`), und `?import` öffnet die einfache Liste.

### Einen Look finden und vergleichen

Öffnen Sie **Find a look** aus dem Board oder aus der Designsystem-Liste in Settings. Durchsuchen Sie Systeme, die auf diesem Gerät gespeichert sind, und einige wiederverwendbare Lolly-Beispiele und suchen Sie nach Name, Farb-Tag oder deklarierter Schrift. **Closest to my current palette** sortiert nach gemessener Farbähnlichkeit, wobei passende Schriften Gleichstände auflösen; es ist kein Qualitätswert.

Klicken Sie einen Look an, um ihn im Zusammenhang anzusehen. Das Ansehen ändert nichts. **Use this look** auf jeder Karte nutzt diesen Look. Ein gespeichertes System wird zum aktiven, was nichts bearbeitet. Die Farben eines Beispiels gehen über den üblichen Checkpoint in das geöffnete Designsystem, dessen Logos, Schriften und alles andere, was das Beispiel nicht festlegt, bleiben, wie sie sind. **Compare looks** fügt jeder Karte ein Kontrollkästchen hinzu, damit Sie zwei wählen und nebeneinander vergleichen können. **Restore brand settings** holt den vorigen Look zurück. Gespeicherte Systeme haben bearbeitbare **Search tags** unter **Details and design context**. Die Beispiele sind eigene Farbrezepte von Lolly, ohne gescrapte Sammlung und ohne Konto.

![Sunroom und Orchard nebeneinander vergleichen, bevor eines der beiden Farbsysteme angewendet wird.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Ihr Designsystem behalten und bewegen

### Eine Marke zwischen Geräten bewegen

**Export** schreibt eine Datei **`LollyBrand-….lolly`**: Ihre Tokens, Schriften, Logos und Design-Einstellung, mit einem Integritätsmanifest, das beim Zurückholen geprüft wird. Web-Releases vor 1.0.7 nannten dieselbe Datei `.zip`, und diese Schreibweise wird weiterhin akzeptiert. **Tokens (.json)** schreibt das einfache Design-Tokens-Dokument für sich, ohne Schriften oder Logos, für ein Repository, einen Build-Schritt oder ein anderes Tokens-Tool.

Um eine zurückzuholen, nutzen Sie **Add from… → Design tokens or a design file** oder legen Sie die Datei auf dem Studio ab. So reicht Ihnen eine Kollegin oder ein Kollege eine Marke, oder so nehmen Sie eine auf eine zweite Installation mit, ohne Konto und ohne Cloud. [Zusammenarbeit mit Partnern](/info/partners.html) behandelt, was Sie sonst noch senden sollten, wenn die Person, die Ihre Marke erhält, für eine andere Organisation arbeitet. Um eine Marke über die Kommandozeile einzubringen, siehe [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** packt die von Ihnen hinzugefügten Schriften in ein installierbares RPM. Wenn Sie welche selbst hochgeladen haben, bittet Lolly Sie zuerst zu bestätigen, dass Sie sie weitergeben dürfen.

### Frühere Einstellungen wiederherstellen

Öffnen Sie **More** in der Leiste, wählen Sie **Restore brand settings**, wählen Sie einen datierten Checkpoint und drücken Sie **Restore**. Er stellt Farben, Schrifteinstellungen und andere Tokens der aktiven Marke wieder her; Schrift- und Bilddateien bleiben, wie sie sind. Lolly speichert Ihre aktuellen Einstellungen zuerst als **Before restore**, sodass Sie eine Wiederherstellung auch nach dem Schließen des Browsers rückgängig machen können. Die letzten 20 Checkpoints bleiben auf diesem Gerät.

### Versionen

Eine veröffentlichte Version ist eine **dauerhafte, benannte Kopie**, die auf diesem Gerät behalten wird. Sie ändert sich nie, sodass ein Tool oder ein Link, der sie festlegt (mit `designv`), immer dasselbe zeichnet. Ein System mit etwas Eigenem listet **Versions & publishing** im Menü **More** der Leiste; nach Ihrer ersten Veröffentlichung kommt **Versions** zu den Räumen hinzu. `#/start?area=versions` öffnet ihn direkt.

- **Eine Version ist dauerhaft.** Es gibt noch kein Löschen, und das Panel sagt das.
- **Entfernungen führen die Kompatibilitätskarte an**, weil ein entfernter Token das ist, was ein Tool kaputt macht.
- **Veröffentlichen lässt sich nicht rückgängig machen; Wiederherstellen schon.** *Restore latest from this version* ist eine gewöhnliche Bearbeitung, mit sofort angebotenem **Undo**.

**Publish only** behält eine Version, ohne zu ändern, was Tools verfolgen; **Publish and make active** lässt Tools und die App dieser Version folgen. **Follow the latest again** schaltet jede Bearbeitung in dem Moment live, in dem Sie sie vornehmen.

### Eine Markenseite veröffentlichen

Eine [Markenseite](/info/brand-page.html) ist eine Adresse für Menschen und für Agenten: eine Seite, die Logos, Farben, Schrift und Beispiele zeigt, mit denselben Fakten in Dateien neben der Seite. **Publish a brand page** unter Versions & publishing zeigt die Live-Seite und neben der Seite:

- **Goes public**: jede Datei, gruppiert, mit ihrer Größe.
- **Held back**: was draußen blieb, und warum. Ein Logo ohne erfasste Lizenz bleibt draußen, bis Sie den Namen des Logos ankreuzen. Eine Schriftdatei braucht eine erfasste Lizenz, die die Weitergabe erlaubt, und die Seite zeigt ein umrissenes Muster, wenn die Datei draußen bleibt. Interne Marken-Skills erscheinen nie.
- **What was checked**: Farbpaare je Farbvariante und Modus sowie die Hausregeln. Das sind Messungen, kein Urteil.
- **In your words**: eine Nutzungserklärung und ein Kontakt. Die Seite druckt, was Sie schreiben, und Lolly fügt keine Lizenz und keine rechtliche Aussage hinzu. Ein Schalter blendet die Zeile „Made with Lolly“ in der Fußzeile aus.
- **On exports**: ein Schalter, der [die Adresse der Seite in den Exporten dieses Designsystems festhält](/info/brand-page.html#lead-back-from-your-files). Er ist aus, bis Sie ihn einschalten, er braucht eine `https`-Adresse, und er reist nicht mit einem Paket oder einer Kopie. Ein gesperrtes Designsystem zeigt den Schalter nicht, weil sein Verwalter entscheidet.

**Download folder** speichert den Ordner als ZIP, das Sie hosten, wo Sie wollen, und nichts wird öffentlich, bevor Sie das tun. In einem Terminal schreibt `lolly system publish --out=<dir>` denselben Ordner. Eine Instanz, die Markenseiten ausliefert, bietet außerdem **Publish to** ihre Adresse an, was ein ausdrücklicher Druck ist und, wenn es eine gibt, durch ihre Freigabekette läuft. Ein verwaltetes Designsystem wird nur veröffentlicht, wenn sein Verwalter es erlaubt.

### Einen Agenten verbinden

**Connect an agent** am selben Ort gibt Ihnen Text zum Einfügen und sagt, was jede Option kann:

- **`AGENTS.md`** in einem Projekt: Agenten lesen die Namen und Regeln des Systems. Es zeichnet nichts und braucht keinen Server.
- **Lollys öffentlicher Server**: zeichnet mit Lolly Demo, welches System Sie hier auch geöffnet haben. Er braucht keinen Schlüssel.
- **Ihre Instanz**: zeichnet mit den Systemen, die die Instanz hält, und liest ein Service-Token aus einer Umgebungsvariablen. Das Blatt nennt den Namen der Variablen und zeigt nie ein Token.

Zeichnet kein gehosteter Server mit Ihrem System, sagt das Blatt es.

## Ihre Designsysteme verwalten

Öffnen Sie **Settings → Preferences → Design systems**, um Systeme zu wechseln, hinzuzufügen oder zu entfernen. **Open** wählt ein System aus und öffnet es hier; **Make a new one** erzeugt ein lokales System und öffnet es mit bereitem Namensfeld. Jeweils ein System ist aktiv, für das ganze Gerät. [Marken-Architekturen](/info/brand-architectures.html) hilft zu entscheiden, wann eine Marke ein eigenes Designsystem braucht.

**Woher ein System kommt.** Das System, das der Katalog einer Bereitstellung liefert, heißt **Came with this app** oder, in einer App, die mit einer Instanz verbunden ist, **From this instance**. Klappen Sie **Catalogue source** auf, um zu sehen, wer es liefert, sein Tokens-Asset und seinen Namespace und seine bekannte Version oder Prüfsumme; schlägt eine Aktualisierung fehl, wird zwischengespeichertes Material gekennzeichnet.

**Verwaltete Systeme sind schreibgeschützt.** Ein System liest sich als **Managed by this instance** (oder **Managed by this app** in der Desktop-App ohne Instanz), wenn sein Katalog das System sperrt. Sie können es nutzen und herunterladen, und sein Öffnen hier zeigt einen Schreibschutz-Hinweis mit **Make an editable copy** und **Switch**, dann seine Farbrollen und Tokens ohne Bearbeitungssteuerung. Ihre eigenen lokalen Systeme bleiben bearbeitbar, auch wenn das verwaltete zuerst da war. Ein Build mit einer festen Marke öffnet Lolly Design System Setup auf *This brand is set*, mit den Tokens und Nutzungsregeln der Marke zum Lesen.

**Jedes andere gelieferte System gehört Ihnen** zum Ausblenden, Bearbeiten und Zurücksetzen, einschließlich Lolly Demo und Lolly Starter auf lolly.tools. Eine Bearbeitung behält seinen Namen und kennzeichnet die Zeile mit **Edited here**, und **Reset to original** in seinem Menü verwirft die Änderungen, die auf diesem Gerät vorgenommen wurden. Der leere Starter ist die Ausnahme: Eine erste Änderung dort beginnt ein eigenes Designsystem, weshalb Lolly einmal fragt, wie das neue System heißen soll. [Lolly Demo im Einsatz](/info/lolly-demo-in-use.html#switch-to-your-own) zeigt, was Ihr eigenes System ersetzt.

### Ein Designsystem entfernen

Wählen Sie **Remove** im Menü eines Systems; die Bestätigung sagt, welches System danach aktiv ist. Gespeicherte Sitzungen, Uploads und mit einem anderen System geteiltes Material bleiben.

Das Entfernen eines gelieferten Systems blendet es nur aus: Seine Katalog-Assets bleiben, **Bring back** zeigt es wieder, und es kehrt von selbst zurück, wenn Sie alles andere entfernen. Das Entfernen einer importierten oder bearbeiteten Kopie entfernt weder das gelieferte System noch seine Logos oder Schriften, und war die Kopie aktiv, wird das gelieferte System wieder aktiv. Das Entfernen einer aktiven gehosteten Kopie löscht nur die Verbindung dieser Kopie; eine getrennt gewählte Instanz bleibt ausgewählt.

Zu ändern, was ein Server liefert, ist Aufgabe einer Administratorin oder eines Administrators: Sein Betreiber ändert den Quellkatalog und stellt neu bereit, oder ein Lolly-Work-Administrator prüft und wendet eine Server-Änderung an. Bearbeitungen hier bleiben lokal, mit einer Ausnahme: Auf einer Lolly-Work-Instanz, die Ihnen `brand.edit` gewährt, bietet ein verwaltetes System außerdem **Edit for** diese Instanz an, was eine Bearbeitungskopie öffnet, und **Send to** diese Instanz in **Versions** sendet seine Farben, Farbvarianten, Farbrollen und die Adresse der Markenseite zurück. [Diese Instanz aus dem Studio bearbeiten](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) behandelt, was eine Bearbeitung ändern kann und wie die Instanz die Änderung ausliefert. Siehe [Ein Katalog-Designsystem entfernen](/info/configuration.html#removing-a-catalogue-design-system) und [Konfiguration](/info/configuration.html#supplied-and-local-design-systems).

## Den Design-Kontext außerhalb der App nutzen

**Download design context** speichert das Token-Dokument, aufgelöste Farben, deklarierte Schriftfamilien, Asset-IDs, Quellennachweise, wo erfasst, Abdeckung und ausdrückliche Regeln, ohne Schriftdateien und ohne Eigentumsnachweis. Die Kommandozeile liest die Datei ohne Server: `lolly system import` macht sie zum Designsystem des Terminals, und `lolly system check` prüft Lolly-Design-Eingaben gegen den gespeicherten Kontext. [Ihr Designsystem mitbringen](/info/cli.html#bring-your-design-system) behandelt den Import und [Welches Designsystem ein Befehl nutzt](/info/cli-decks.html#which-design-system-a-command-uses) die Prüfung, und ein MCP-Client liest denselben Brief aus `lolly://design-context` ([MCP-Server](/info/mcp.html)).

## Wie es weitergeht

- **[Lolly nutzen](/info/using.html)**: die Tools, Speichern, Teilen und Assets.
- **[Markenarchitekturen](/info/brand-architectures.html)**: wie Sparten, Produkte, empfohlene Marken, Kunden und Saisons auf Designsysteme, Farbvarianten und Logo-Identitäten abgebildet werden.
- **[Mit Partnern arbeiten](/info/partners.html)**: Ihre Marke mit einem Partner teilen und in einer Marke arbeiten, die man Ihnen gegeben hat.
- **[Markenseiten](/info/brand-page.html)**: Ihr Designsystem an einer Adresse veröffentlichen, als Pressekit und als Agenten-Kit.
- **[Design Tokens](/info/design-tokens.html)**: das Token-Modell, in dem Ihre Marke geschrieben ist.
- **[Eine Datei exportieren](/info/exporting.html)**: Druckeinheiten, CMYK und die Formate, in die Ihre Marke rendert.
