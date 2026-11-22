# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup** unter `#/start` enthält Ihr Logo, Ihre Farben und Ihre Schriften. Jedes Tool, jede Seite und jeder Export zeichnet damit.

Ziehen Sie ein Logo hinein, und Lolly liest seine Farben aus. Wählen Sie eine Schrift oder ziehen Sie die Schriftdatei hinein, die Ihr Unternehmen lizenziert hat. Jede Änderung erscheint sofort in der gesamten App. Ihr Logo, Ihre Schriften und Tokens bleiben auf diesem Gerät. Nur die Auswahl einer Google Font stellt eine Verbindung nach außen her: Lolly fragt zuerst und lädt die Schriftfamilie dann einmal herunter.

Geben Sie dem Designsystem einen Namen und drücken Sie **Export**, um eine `.lolly`-Datei zu erhalten. Bewahren Sie die Datei auf, öffnen Sie sie auf einem anderen Gerät oder geben Sie sie an eine Kollegin oder einen Kollegen weiter. [Lolly Settings](/info/dashboard.html#design-system) zeigt das aktive System schreibgeschützt; sein Deckblatt verlinkt zum Bearbeiten zurück hierher.

<!--i:eti-clock-->
## In fünf Minuten an Ihre Wünsche anpassen

::: timeline
- <!--i:upload--> **Ziehen Sie Ihr Logo** auf die Ablagefläche in **Logos**. Lolly liest seine Form und seine Farben aus.
- <!--i:palette--> **Use these colours.** Die Hauptfarbe des Logos wird Ihre Primärfarbe, und ein dunkler Neutralton aus dem Logo wird Ihre Textfarbe.
- <!--i:font--> **Choose a face** in **Type**: eine Google Font oder eine Schriftdatei, die Ihnen gehört.
- <!--i:pentool--> **Benennen Sie das System.** Ihre erste Änderung erstellt Ihr eigenes Designsystem, und Lolly fragt einmal nach seinem Namen.
- <!--i:download--> **Export** schreibt das gesamte System als eine Datei `LollyBrand-….lolly`.
:::

Die Leiste oben im Studio zeigt den Namen des Designsystems als bearbeitbares Feld. **Enter** übernimmt einen neuen Namen, und **Escape** stellt den alten wieder her. Wenn bei Ihrer ersten Änderung **What is this design system called?** erscheint, trägt Lolly die Wörter aus Ihrem Logo ein, sofern es welche enthält. **Save name** behält den Namen; **Not now** behält einen Platzhalter, bis Sie einen Namen in die Leiste eingeben. Der Name bezeichnet das System in Settings und beim Wechseln und ist der Name der Datei, die **Export** schreibt.

<!--i:eti-grid-->
## Die Bereiche

Das Studio besteht aus Bereichen ohne feste Reihenfolge. Kein Bereich setzt einen anderen voraus. Auf einem Desktop-Bildschirm stehen die Bereiche in einer Reihe unter der Leiste. Auf einem Smartphone wandern sie in eine Leiste am unteren Rand; der geöffnete Bereich wird in die Ansicht gescrollt. Das Paletten-Panel und die Ablage öffnen sich über dieser Leiste, und die Leiste weicht während der Eingabe aus. Mit der Tastatur erreichen Sie die Reihe mit einem Tab-Stopp; die Pfeiltasten, Pos1 und Ende wechseln zwischen den Bereichen.

![Die Leiste des Studios und seine Bereiche: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules und Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Bereich | Was Sie dort tun | Link-Schlüssel |
|---|---|---|
| **Board** | Sehen, was das System enthält, mit Zugang zu jedem Bereich | `overview` |
| **Colours** | Farben hinzufügen, ihnen Rollen zuweisen, Abstufungen und eine Palette erstellen | `color` |
| **Type** | Die vier Schriften wählen, die die App, die Tools und jeder Export verwenden | `type` |
| **Logos** | Ihre Zeichen in jeder Ausrichtung und Ausführung platzieren | `logos` |
| **Tokens** | Ecken, Abstände, Schatten und alle anderen benannten Werte | `tokens` |
| **Files** | Die Bilder, Audio- und Bewegungsdateien Ihrer Marke | `catalogue` |
| **Sound** | Klangidentität, Musik für verschiedene Zwecke und den Bezug zur Stimme gestalten | `sound` |
| **Rules** | Die Regeln Ihrer Marke, an echten Beispielen geprüft | `usage` |
| **Skills** | Die schriftlichen Standards der Marke für Menschen und Agenten, zum Lesen und Herunterladen | `skills` |

Verlinken Sie einen Bereich mit `#/start?area=<key>`. Die Bereichsschlüssel sind dauerhaft, daher behält Files `catalogue`, Board behält `overview` und Rules behält `usage`. `?tab=` funktioniert weiterhin als älterer Alias. Ein unbekannter Schlüssel öffnet Board.

Die **Leiste** enthält Aktionen für das gesamte System. **Add from…** importiert eine Marke ([Eine Marke importieren](#bring-a-brand-in)). **Tray** enthält, was ein Scan gefunden hat und Sie noch nicht hinzugefügt haben. **Export** schreibt das System als eine Datei. **More** enthält **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** und **Design systems**, das die Liste in Settings öffnet, in der Sie wechseln ([Ihr Designsystem aufbewahren und übertragen](#keep-and-move-your-design-system)). Jede Aktion erscheint, sobald es etwas gibt, worauf sie sich anwenden lässt. Auf einem Smartphone wandert **Add from…** in **More**, und **Export** erscheint als Symbol.

Solange das Designsystem das mit der App gelieferte ist, beginnt die Leiste mit **Make it yours**, einem Menü mit **Find a look**, **Add from…** und **Pick a colour**. Sobald Sie ein eigenes System haben, nimmt **Export** diesen Platz wieder ein.

<!--i:eti-clipboard-->
## Board

Solange noch nichts ausgewählt ist, bietet Board vier Einstiegsmöglichkeiten. **Start from a reference** öffnet die Quellenauswahl für ein Logo, einen Screenshot, eine Webseite oder eine Designdatei. **Pick a colour**, **Choose a face** und **Add a logo** öffnen die jeweiligen Steuerelemente. Das Öffnen speichert nichts. Darunter bietet **Find a look** fertige Farben und Schriften zum Ausprobieren, und **Explore the tools** steht von Anfang an bereit.

Sobald Sie etwas Eigenes haben, zeigt Board Ihren Bestand, Ihre eigenen Anzahlen zuerst. Colours nennt die Anzahl der Farben, mit einem dezenten `· N starter` für übernommene Farben. Die Leiste zeigt Ihre Farben, dann eine Haarlinie und anschließend die verblassten Ausgangsfarben. Colourways zeigt jede Farbvariante als kleine Kachel in ihrer Leitfarbe. Type listet jede Rolle auf und setzt jede Familie in ihrer eigenen Schrift (*Inter for headings*, mit *Starter for the rest* in der Zeile darunter). Logos nennt die Anzahl der belegten Plätze (oder **Not set**), Tokens zeigt den Eckenradius und Files meldet **Nothing yet**, solange die Bibliothek leer ist. Jeder Block öffnet seinen Bereich.

Ein bearbeitbares Designsystem, das mit der App geliefert wurde, etwa Lolly Demo, zeigt von Anfang an seine Farben, Farbvarianten, Schriften und Zeichen auf Board, mit einer Kennzeichnung **Came with this app** neben der Überschrift. Darüber bietet **Start here** die Optionen **Find a look**, **Add from…** und **Pick a colour**.

### Ausgangswerte und Ihre Auswahl

In jedem Bereich kennzeichnet **Starter** alles, was mit der App geliefert wurde und niemand ausgewählt hat. Eine neue Installation enthält keine Farbe, nur eine neutrale Abstufung von Druckschwarz bis Papierweiß, damit Hintergründe, Text und Haarlinien schon vor einer Auswahl gerendert werden können.

::: cols
## Starter

- Mit der App geliefert: die Neutraltöne von Druckschwarz bis Papierweiß, die Ausgangsschriften und der standardmäßige Eckenradius.
- Dezent, mit einer Kennzeichnung **Starter** und ohne Farbtönung.
- Zählt nicht zu Ihren Farben. Die Neutraltöne liegen in **Tokens** als **Neutrals · starter · 9**, und **Open** zeigt sie in Colours als eine eingeklappte Gruppe (`#/start?area=color&group=neutral`).
- Eine Rolle, die eine Ausgangsfarbe verwendet, zeigt *"Starter Paper stands in"*, mit **Choose…** in ihrer Auswahl.

## Ihre Auswahl

- Von Ihnen ausgewählt oder installiert.
- In voller Intensität und mit einer getönten Karte, wenn Sie eine Schrift installiert haben.
- Auf Board und in Tokens mitgezählt.
- Eine Rolle, die einer anderen folgt, zeigt **↳ follows Primary**.
:::

Übernommenes Material hat nie einen gestrichelten Rahmen. Ein gestrichelter Rahmen kennzeichnet eine Ablagefläche.

<!--i:eti-shapes-->
## Logos

Die Ablagefläche oben, **"Drop marks here, or choose several at once"**, nimmt beliebig viele Dateien auf. Lolly liest aus jeder Datei ihre Form und ihre Farbe aus. Die Datei wartet dann unter **Waiting for a slot** als Chip, der ihr Aussehen beschreibt, etwa *"Looks like the Horizontal primary"*, mit dem verwendeten Messwert und einer Schaltfläche **Place** (**Replace**, wenn der Platz belegt ist). Wenn Lolly unsicher ist, sagt der Chip das und bietet **Change slot** mit allen acht Plätzen an. Nichts wird platziert, bis Sie eine Schaltfläche drücken.

Bei einem Zeichen mit überflüssigem Leerraum wird zuerst ein Zuschnitt angeboten. Beantworten Sie das Angebot oder drücken Sie Escape, um das unveränderte Original zu platzieren. Wenn ein Zeichen einen leeren verwandten Platz belegen kann, bietet der Bereich die abgeleitete **mono**- oder **reverse**-Version als Chip mit der Kennzeichnung *Generated* an.

Jedes Zeichen kommt in ein Raster aus acht optionalen Plätzen, je einer pro **Ausrichtung** und **Ausführung**:

- **Ausrichtungen:** Horizontal (Wortmarke und Symbol in einer Reihe) und Vertical (übereinander, für quadratische und hohe Flächen).
- **Ausführungen:** Primary, Primary reverse (für dunkle Hintergründe), Mono (einfarbig) und Mono reverse.

Eine Gruppe ohne Zeichen klappt auf eine Zeile zusammen; öffnen Sie sie, um ihre Plätze zu sehen. Klicken Sie auf einen Platz, um eine PNG-, SVG-, JPEG- oder WebP-Datei hinzuzufügen, oder auf einen belegten Platz, um das Zeichen zu ersetzen. Ein leerer Platz nimmt auch eine hineingezogene Datei auf. Horizontale Zeichen liegen in breiten Kacheln, vertikale in quadratischen, jeweils auf dem Hintergrund, für den sie erstellt wurden, mit einem Freiraum von einem Viertel ihrer Höhe. Alles bleibt auf diesem Gerät.

![Die Logoplätze mit geöffneten Gruppen Horizontal und Vertical: jede Ausführung hat ihren eigenen Platz, und jeder Platz ist optional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** sind Zeichen, die Ihre Marke mit einem eigenen Namen bezeichnet, etwa ein Icon, ein Wappen oder ein Favicon.
- **Weitere Identitäten.** Eine Untermarke, ein Produkt oder eine Veranstaltung kann einen eigenen vollständigen Satz haben: Drücken Sie **+ Add another logo** und geben Sie dem Satz einen Namen. Ihr Hauptsatz heißt „Your logo“. [Markenarchitekturen](/info/brand-architectures.html) zeigt, wann Sie eine Logo-Identität verwenden sollten.
- **Lolly liest die Farben des Logos aus.** Eine Karte unter der Ablagefläche und oben in Colours listet die Farben des Logos auf und fragt **Which is the main colour?**. Die kräftigste Farbe ist ausgewählt, nie das Weiß, auf dem das Logo exportiert wurde. **Use these colours** fügt sie Ihrer Palette hinzu und macht die Hauptfarbe zu Ihrer Primärfarbe. Wenn das Logo einen dunklen Neutralton enthält, der auf Papier gut lesbar ist, wird dieser zur Textfarbe. **Not now** lässt sie in Tray. Bei einer ganz neuen Installation wendet Lolly die wahrscheinlichste Antwort sofort an, und die Karte bietet **Undo** oder eine andere Hauptfarbe. Eine SVG-Datei liefert genaue Farben; eine PNG-, JPEG- oder WebP-Datei liefert die Farben, die einen wesentlichen Anteil des Zeichens bedecken.

<!--i:eti-palette-->
## Farben

Der Bereich wächst mit dem Designsystem. Beim ersten Besuch steht eine Entscheidung an; mit der Palette erscheinen weitere Steuerelemente.

### Die erste Farbe

Ein System ohne eigene Farben zeigt die Ausgangsneutraltöne in einer eigenen geöffneten Gruppe. Oben im Bereich liegt ein gestrichelt umrandetes Feld zum Einfügen und Ablegen: ein großer Chip und ein Feld. Ziehen Sie ein Bild oder eine Farbliste an eine beliebige Stelle des Feldes, und Lolly liest die Farben aus.

- **Der Chip ist der Farbwähler.** **Pick a colour** öffnet die OKLCH-Karte des Studios mit dem Inhalt des Feldes als Ausgangswert. Die Karte zeigt zuerst den Namen und den Hex-Wert der Farbe. Die Farbräume, das Farbrad, die vier Drehregler und Alpha liegen unter **Fine-tune**, und **Cancel** und **Add colour** stehen unten. Nichts gelangt ins System, bis Sie **Add colour** drücken.
- **Das Feld nimmt jede Schreibweise an**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` oder einen Farbnamen. Eine eingefügte Liste wird zu einer Reihe von Chips, die Sie einzeln oder mit **Add all** hinzufügen können.
- **Zwei weitere Wege.** **Pick a colour from the screen** verwendet die Pipette, sofern der Browser eine bietet, und **Take colours from an image** liest einen Screenshot oder ein Foto auf diesem Gerät aus.
- **Add ist nie deaktiviert.** Wenn das Feld leer ist, öffnet es den Farbwähler; bei Text, den es nicht lesen kann, weist eine Zeile unter dem Feld darauf hin.

Ihre erste Farbe wird die **Primärfarbe**. Ein Chip bestätigt die Änderung, etwa *"Primary is now Vivid Violet"*, mit **Fine-tune** zum Anpassen der Farbe.


### Wenn die Palette wächst

Auf einem breiten Bildschirm stehen Ihre Farben neben einer Vorschau **In context**, auf einem kleineren über ihr. Die Vorschau zeigt ein Poster, ein Diagramm oder eine Karte der Oberfläche in Ihrer Palette. Ausgangsfarben haben eine eigene Gruppe, die sich einklappt, sobald das System eigene Farben hat. Das Feld zum Einfügen und Ablegen wird zu einer kompakten Zeile. Der Kopf des Bereichs enthält keinen Export; verwenden Sie **Export** in der Leiste oder den Bereich Tokens.

![Der Bereich Colours in Lolly Demo: oben die Rollen-Chips und das Feld zum Einfügen und Ablegen, darunter die Palette in einklappbaren Gruppen, jede Farbe mit ihrem Namen und Hex-Wert](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Der Bereich Colours in Lolly Demo nach dem Hinzufügen einer Farbe: die Tabelle Colour roles, darunter der Chip der neuen Farbe mit Use as Lead? und Fine-tune, daneben eine Live-Vorschau der Komposition](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Farbrollen: wie die Farben heißen

Das Designsystem gibt seinen Farben Namen und sagt, wofür jede gedacht ist; Lolly liest beides. **Colour roles** steht oben im Bereich Colours. **In context** zeigt jede Änderung sofort.

![Die Tabelle Colour roles von Wefthouse, einer erfundenen Textilmarke, in deren eigenen Worten: die Farbvarianten-Chips Indigo, Madder und Weld, darunter Main, Accent, Supporting und Tertiary, jeweils mit heller und dunkler Farbe, interpretiert als Leitfarbe, Partnerfarbe und nur nach Namen, sowie Background, Text, Quiet text und Hairlines unter der Tabelle als Verwendungen, die keine Rolle erfüllt](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Die Tabelle hat vier Spalten. Auf einem Smartphone wird jede Zeile zu einer Karte, auf der Hell und Dunkel nebeneinander stehen:

| Spalte | Inhalt |
|---|---|
| **Role** | Der eigene Begriff des Designsystems, den Sie direkt bearbeiten können, und eine Zeile, die sagt, wofür die Farbe gedacht ist |
| **Light** und **Dark** | Die Farbe in diesem Look für die gewählte Farbvariante, mit ihrem Namen oder Wert und ihrem Kontrast |
| **Lolly reads this as** | Was ein Tool mit der Rolle macht, in Lollys eigenen Worten |

**Wie Lolly eine Rolle liest.** Jede Lesart ist genau einer Rolle zugeordnet. Wenn Sie eine Lesart wählen, die eine andere Rolle belegt, wechselt die Lesart zu dieser Rolle. Lolly leitet nie eine Bedeutung aus einem Wort ab.

| Lesart | Was daraus folgt |
|---|---|
| **Lead colour** | Große Formen, Schaltflächen, die Farbe, die ein Tool vorrangig verwendet |
| **Partner colour** | Die zweite Farbe, auf die ein Tool zurückgreift |
| **Background** | Liegt hinter allem anderen |
| **Text** | Überschriften und Fließtext |
| **Quiet text** | Bildunterschriften und Kleingedrucktes |
| **Hairlines** | Linien, Rahmen und Trennlinien |
| **By name only** | Kein Tool wählt die Rolle von sich aus. Sie wird in jedem Farbfeld und in Design angeboten, wo eine Auswahl verknüpft bleibt und so der Farbvariante folgt |

Eine Lesart, die keine Rolle belegt, behält die Definition des Designsystems. Der Bereich listet diese Lesarten unter der Tabelle auf. Eine Rolle mit derselben ID wie die Lesart selbst, etwa eine Rolle namens Primary, ist diese Lesart und kann nicht verschoben werden.

**In einem Diagramm.** Die Palette **Design system - colour roles first** von Lolly Chart weist den Datenreihen zuerst die Farbrollen des Designsystems in dessen eigener Reihenfolge zu, dann den Rest der Palette. Eine Rolle, die als Hintergrund, Text, dezenter Text oder feine Linien gelesen wird, wird ausgelassen, weil das Diagramm seinen Hintergrund und seine Wörter in diesen Farben zeichnet. Nichts ändert sich, bis Sie diese Palette wählen. Ein Designsystem ohne Farbrollen zeigt die Palette als **Design system - ordered**.

**Werte.** Drücken Sie auf einen Wert, um die Farbe dieser Rolle für diesen Look und die gewählte Farbvariante auszuwählen. **Same as light** lässt den dunklen Wert dem hellen folgen, bis Sie eine dunkle Farbe wählen. Der Chip **Aa** zeigt die Textfarbe, die Lolly für diese Farbe wählt. Die Zeile unter dem Wert sagt, wie sich dieser Text in jedem Look liest: **Text reads well**, **Large text only** oder **Hard to read as text**. Die Bewertung betrifft nur Text auf dieser Farbe; für Formen und große Flächen kann die Farbe trotzdem geeignet sein. Eine Rolle, die nur nach Namen gelesen wird, zeigt dieselben Wörter ohne Warnfarbe, weil kein Tool von sich aus Text auf diese Rolle setzt. Der Tooltip und der Farbwähler zeigen die Zahlen, APCA zuerst und WCAG danach. **Own text colour** kennzeichnet einen Wert, dessen Datei die Textfarbe vorgibt; diese Textfarbe bleibt erhalten. **Copied** kennzeichnet einen Wert aus einer anderen Farbvariante oder von der Partnerfarbe, den noch niemand gewählt hat; **Keep this colour** im Farbwähler bestätigt den Wert.

**Ausgangspunkte.** Ein Designsystem ohne eigene Rollen zeigt die bisherigen Wörter: Primary, Secondary, Surface und Text. Nichts wird geschrieben, bis Sie eines ändern. **+ Add a role** schlägt **Primary, Secondary** oder **Main, Accent, Supporting, Tertiary** vor oder nimmt beliebige Wörter entgegen, die Sie eingeben, und zeigt die Lesart, die jedes erhalten würde. Die ersten beiden Wörter werden zur Leitfarbe und zur Partnerfarbe. Tools zeichnen weiterhin dieselben Farben. Bei einem System mit einer Leitfarbe übernimmt die erste Farbvariante den Namen dieser Farbe.

**Umbenennen, neu ordnen, entfernen.** Eine Umbenennung ändert nur das Wort; alles, was die Rolle verwendet, funktioniert weiter. Ziehen Sie eine Rolle an ihrem Griff oder drücken Sie die Leertaste auf dem Griff, verwenden Sie die Pfeiltasten und drücken Sie zum Ablegen die Leertaste. **Remove** sagt, was die Rolle noch verwendet. Wenn Tools die Rolle lesen, belässt **Remove and keep those colours** jede Lesart bei ihrer aktuellen Farbe. Eine Gestaltungsregel, eine Hilfsliniengruppe, ein Tool-Feld oder ein anderes Token, das die Rolle verwendet, hält die Rolle fest, bis diese Verwendung geändert wird. Auch ein gespeichertes Design-Dokument kann eine Rolle nach Namen verwenden, und Lolly kann das aus der Token-Datei nicht erkennen. Ein solches Dokument meldet die Farbe als nicht aufgelöst.

::: details Rollen in einer von Hand geschriebenen Token-Datei
**Eine von Hand geschriebene Datei.** Farben in einer Token-Datei, die keine Rolle deklariert, stehen unter **In this file, with no role yet**, jeweils mit einem Feld für ein Wort und **Make a role**. Sie funktionieren in jedem Fall weiter nach Namen. Ein Token mit Ziffern im Namen kann keine Rolle sein; es bleibt in der Datei und funktioniert weiter über seinen Pfad. Wenn ein Datensatz in der Datei die Validierung nicht besteht, zeigt sich die Tabelle ohne Steuerelemente und nennt den Grund.
:::

**Der Rest des Bereichs verwendet dieselben Wörter.** Die Chips, die Zeile **Use as** des Farbfelds und die Gruppe **Colour roles** der Palette verwenden alle die Wörter des Designsystems. Die Kachel einer Farbrolle öffnet ihren Wert. Exportierte Dateien halten nichts Neues über Rollen fest; die Farben eines Renderings ändern sich, weil sich die Tokens geändert haben.

**Wohin die Wörter gelangen.** Die Wörter und Beschreibungen werden mit dem Designsystem weitergegeben. Agenten lesen sie im Designbriefing, in `lolly://tokens` und in der `AGENTS.md` einer Markenseite. Das Terminal zeigt sie in `lolly system status`. Eine Markenseite listet sie in `brand.json` auf und misst für jede Rolle ein Kontrastpaar. DTCG- und Tokens Studio-Dateien behalten alles, `DESIGN.md` behält die Wörter und die Lesarten und ein PowerPoint-Design behält nur die Reihenfolge der Marke. [Farbrollen in anderen Formaten](/info/design-tokens.html#colour-roles-in-other-formats) enthält die vollständige Liste. Wörter werden immer als Daten des Designsystems zitiert und nie als Anweisungen gelesen.

**Wo eine Farbe gewählt wird.** Jedes Farbfeld in einem Tool und in Lolly Design listet zuerst die Rollen des Designsystems in dessen eigener Reihenfolge auf, mit jedem Wort und seinem Zweck. **Aa** neben einer Rolle wählt die Farbe, die auf dieser Rolle liegt. Die übrigen Farben folgen unter **Other colours**, ohne die eigenen Kopien einer Farbvariante, die Vordergrundfarben und jede Lesart, die eine Rolle bereits belegt. Eine Auswahl bleibt mit der Rolle verknüpft und folgt der Farbvariante. Das Feld zeigt das Wort in jeder Farbvariante, und auch Settings und Tokens verwenden das Wort. Ein Designsystem ohne Rollen behält sein Raster aus Farbfeldern.

### Jede Farbe, die ein Tool liest

Wenn **Colour roles** geschlossen ist, beginnt der Bereich mit Chips für die ersten Entscheidungen. Jeder Chip zeigt die Farbe und den Namen der Rolle. Bei einem System ohne eigene Wörter sind dies **Primary**, **Secondary**, **Surface** und **Text**. Drücken Sie auf einen Chip, um seine Farbe aus den Farbfeldern der Palette zu wählen. **Every colour a tool reads** unten in **Colour roles** enthält die vollständige Leiste.

Die Leiste zeigt die sieben Farben, die ein Tool lesen kann: Primary, Secondary, Surface, Text, Muted, Edge und On primary, in den eigenen Wörtern des Designsystems, sofern vorhanden. Jede erfüllt in jedem Tool und Export dieselbe Aufgabe. Keine muss festgelegt werden, und jede Farbe kann eine davon belegen. Drei frei gewählte Farben ergeben ein gutes System. Die Anzeige sagt, wie sich Text auf der Hintergrundfläche liest, APCA zuerst. Jede Zeile zeigt Ihre eigene Farbe in voller Stärke, eine Ausgangsfarbe als Ersatz oder **↳ follows Primary**.

On primary wird von der Primärfarbe abgeleitet, zeigt **Derived** und hat keinen Farbwähler. Die Schalter **Light** und **Dark** neben On primary sowie die neben **In context** wählen, welchen Look die Leiste, die Palette und die Vorschau zeigen.

Die eigene Akzentfarbe der App folgt standardmäßig dem Designsystem, über die Einstellung **Interface follows the design system** unter **Settings → Appearance**. Wenn die Einstellung ausgeschaltet ist, bleibt die Bedienoberfläche der App neutral. Tools, Arbeitsflächen und Exporte folgen in beiden Fällen dem Designsystem.

**Farbvarianten.** Ein Designsystem kann mehrere Leitfarben enthalten, die pro Werk gewählt werden. Die Zeile **Colourways** am Anfang von **Colour roles** zeigt einen Chip pro Farbvariante, mit **Default** auf der kanonischen. **+ Add** beginnt eine neue Farbvariante mit einer Palettenfarbe. Wählen Sie einen Chip, und die Tabelle, die Leiste, die Palette und die Vorschauen zeigen diese Farbvariante. Sie können die gewählte Farbvariante umbenennen, duplizieren, entfernen oder als Standard festlegen. Bei einem System mit Farbvarianten braucht jede Farbvariante eine eigene Primär- und Sekundärfarbe sowie eine eigene Hintergrundfläche, wenn die Farbvarianten den Hintergrund einfärben. Diese Rollen bleiben im Farbfeld-Editor gesetzt. [Farbvarianten zu einem Designsystem hinzufügen](/info/colourways.html#add-colourways-to-a-design-system) enthält die Schritte und das Token-Format, und [Lolly Demo im Einsatz](/info/lolly-demo-in-use.html#colourways-on-real-work) zeigt Farbvarianten an echter Arbeit. Jede Person kann unter **Settings → Appearance** eine Farbvariante als ihre eigene wählen ([Eine Farbvariante zu Ihrer eigenen machen](/info/colourways.html#make-a-colourway-your-own)).

### Weitere Farben finden

Drei Tools bauen auf Ihrer Primärfarbe auf. Die ersten beiden machen nur Vorschläge; das dritte ersetzt die Palette.

::: cols
## Farbabstufungen & Harmonien erkunden

Wählen Sie eine **Starting colour**, ein **Scheme** (Mono, Complement, Analogous oder Triad) und die Anzahl der **Shades** (3 bis 20, standardmäßig 5). **Fine-tune** legt die UI-Intensität, den Kontrast und Text auf der Markenfarbe fest. Klicken Sie auf eine Abstufung, um sie hinzuzufügen, oder auf **Add 5 shades** für eine Gruppe. Ihre Farben und Rollen bleiben erhalten.

## Passende Farben finden

Wählen Sie eine **Harmony**: Complementary, Adjacent, Triad, Tetrad oder Analogous (mit **Accents** von 2 bis 5 und einem **Angle** von 10° bis 45°). Jeder Vorschlag hat einen generierten Namen und **+ Add**, ein Klick pro Farbe.

## Die gesamte Palette neu aufbauen

Ersetzt die Palette ausgehend von einer Ausgangsfarbe, nach einer Prüfung dessen, was sich ändert und was bleibt.
:::

Alle drei verwenden dieselbe wahrnehmungsbasierte Farbmathematik (OKLCH) wie die Engine. In **Explore shades & harmonies** zeigen die Zeilen **Primary**, **Neutral** und **Secondary** die vorgeschlagenen Abstufungen, und **Theme preview** zeigt helle und dunkle Beispiele mit ihren Kontrastwerten.

![Drei vorgeschlagene Gruppen von Farbabstufungen mit einzelnen Steuerelementen zum Hinzufügen und einer separaten Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Generierte Akzentfarben, jeweils mit einem Farbfeld, einem automatisch generierten Namen, ihrem Hex-Wert und einer Add-Schaltfläche](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Eine generierte Palette übernehmen

Öffnen Sie **Rebuild the whole palette…** und drücken Sie **Preview full rebuild**. Die Prüfung zählt, wie viele Rollen so bleiben, wie Sie sie zugewiesen haben, wie viele Ihrer eigenen Farben erhalten bleiben und wie viele Abstufungskurven, Druckfestlegungen, ausgeblendete Abstufungen und Verlaufsstopps neu verankert oder beibehalten werden. **Apply rebuilt palette** übernimmt die Änderungen; **Cancel** ändert nichts. Danach bietet die Karte **Undo** an, das bereits den Fokus hat, und der vor dem Austausch angelegte Sicherungspunkt stellt das gesamte System wieder her.

Ein System mit Farbvarianten behält beim Neuaufbau jede Farbvariante. Die kanonische Farbvariante folgt der neuen Ausgangsfarbe, und jede andere Farbvariante behält ihre eigenen Farben, ihren Namen, ihre Reihenfolge und ihre Einstellungen. Die Prüfung listet auf, welche Farbvariante folgt und welche ihre Farben behalten. Lolly baut ein System nicht neu auf, wenn dessen Farbvarianten so codiert sind, dass Lolly sie nicht bearbeiten kann; die Karte nennt den Grund, und nichts ändert sich.

### Die Abschnitte für Fachleute

Unter der Vorschau und den Rollen liegen vier eingeklappte Abschnitte. Jeder lässt sich mit `#/start?area=color&focus=<name>` öffnen:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) formt eine Farbreihe Punkt für Punkt um, mit getrennten Kurven für Helligkeit, Chroma und Farbton (L / C / H). Die Abstufungen werden beim Ziehen neu gezeichnet.
- **Contrast** (`focus=contrast`): **Contrast-lock** passt die Tonwerte einer Farbreihe an, um APCA-Zielwerte gegenüber einem von Ihnen gewählten Hintergrund zu erreichen, und **Rotate hue** dreht die gesamte Farbreihe auf dem Farbkreis.
- **Print** (`focus=print`) legt fest, was aus der Primärfarbe im Druck wird: ihr automatischer Wert, eine festgelegte CMYK-Zusammensetzung oder eine benannte Sonderfarbe.

### Die Palette und jedes Farbfeld

Die Palette listet Ihre Farben in einklappbaren Gruppen auf, jede mit einem eigenen **+ Add**. Sie können Gruppen erstellen und umbenennen. Eine Rolle erzeugt nie eine zweite Kachel; die Kachel, auf die eine Rolle verweist, zeigt den Namen der Rolle, etwa **Primary**. **Colour chart** unter den Kacheln zeigt dieselben Farben auf dem OKLCH-**Wheel** (ziehen Sie einen Punkt, um die Farbe zu ändern, klicken Sie auf eine leere Stelle, um ein Farbfeld hinzuzufügen) und im **Gamut**-Diagramm, das zeigt, wo der darstellbare Bereich endet. `#/start?area=color&focus=chart` öffnet das Diagramm.

![Der Palettenbereich, jede Gruppe einklappbar](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Der OKLCH-Farbkreis - der Winkel ist der Farbton, der Abstand zur Mitte ist Chroma, und die Grautöne liegen auf einer Helligkeitsleiste an der Seite](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klicken Sie auf ein Farbfeld, um seinen Editor zu öffnen:

- **Rename** benennt das Farbfeld um.
- **Legen Sie die Farbe fest**, mit OKLCH-Schiebereglern oder in **Hex**, **HSL**, **RGB** oder **CMYK**. Das Wertefeld liest und schreibt im aktiven Farbraum. CMYK legt hier die Bildschirmfarbe durch Umrechnung fest; um exakte Druckfarben festzulegen, verwenden Sie **Print substitutes**.
- **Stored as** wählt, wie das Farbfeld gespeichert wird: **LCH** (der Standard, wahrnehmungsbasiert und mit großem Farbumfang), Hex, RGB oder HSL.
- **Use as** gibt dem Farbfeld eine Rolle, in den eigenen Wörtern des Designsystems, sofern vorhanden. Drücken Sie erneut auf eine hervorgehobene Rolle, um die Rolle zu entfernen.
- **Print substitutes** (eingeklappt): Legen Sie für **CMYK** statt **Auto** exakte Druckfarbenwerte fest oder legen Sie eine **Spot colour** mit einem **Name** (etwa `PANTONE 186 C`), einem optionalen **Book** und einem **Finish** für Folie, Hochprägung, Tiefprägung, partiellen Lack, Softtouch oder eine Stanzung, Rillung oder Perforation fest. Eine Druckmaschine verwendet diese Festlegungen, wenn Sie ein CMYK-PDF oder -TIFF exportieren; siehe [Farbprofile](/info/exporting.html#colour-profiles). Eine Sonderfarbe wird in einem Print PDF auf einer eigenen Platte gedruckt; um alle Sonderfarben für einen Export in Prozessfarben zu drucken, siehe [Sonderfarben als Prozessfarben](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (eingeklappt): ein Wert pro Farbraum, abgeleitet oder von Ihnen festgelegt. Ein von Ihnen festgelegter Wert hat beim Export Vorrang.

**Ein Farbfeld zu löschen** ist sicher. Abgeleitete Abstufungen und Designrollen werden ausgeblendet, sodass alles, was sie liest, weiter funktioniert. Von Ihnen hinzugefügte Farben werden entfernt.

::: details Mit vielen Farbfeldern arbeiten
Im Ruhezustand zeigt ein Farbfeld seine Farbe, seinen Namen und seinen Hex-Wert. Select zeigt auf jedem Bildschirm das Kontrollkästchen und den Ziehgriff jedes Farbfelds, und eine Kachel mit Tastaturfokus zeigt ebenfalls ihren Griff. Ziehen Sie einen Griff, um die Reihenfolge innerhalb einer Gruppe zu ändern, oder setzen Sie den Fokus auf den Griff, drücken Sie die Leertaste, verwenden Sie die Pfeiltasten und drücken Sie zum Ablegen erneut die Leertaste; Escape bricht ab. Auf einem Smartphone zeigt die Palette vier Farben pro Zeile. Um Farben zwischen Gruppen zu verschieben, verwenden Sie das Steuerelement **Group** im Editor oder wählen Sie mehrere aus und verwenden Sie **Move to**.

Die Auswahl braucht keinen eigenen Schalter: Die Leiste und die Kontrollkästchen erscheinen mit der ersten ausgewählten Kachel und verschwinden mit der letzten.

- **Ziehen Sie auf einer leeren Fläche**, um ein Rechteck zu zeichnen; jede Kachel, die es berührt, wird gruppenübergreifend zur Auswahl hinzugefügt. Ein eingeklappter Abschnitt fügt nichts hinzu.
- **Umschalt-Klick** wählt einen Bereich in Leserichtung, **Cmd/Strg-Klick** schaltet eine einzelne Kachel um, und ein einfacher Klick öffnet den Editor.
- Jede Gruppenüberschrift hat **Select all**, und **Cmd-A** wählt bei fokussierter Kachel jede Ihrer eigenen Farben, nie eine Ausgangsfarbe.
- Das Raster hat einen Tabstopp: Pfeiltasten bewegen den Fokus, Umschalt-Pfeiltasten erweitern die Auswahl, die Leertaste schaltet um, Delete entfernt und Escape hebt die Auswahl auf. Um einen Kanal schrittweise zu ändern, drücken Sie zuerst `l`, `c` oder `h`.
- Halten Sie auf einem Touchscreen eine Kachel gedrückt, um eine Auswahl zu beginnen, und tippen Sie dann auf weitere Kacheln, um sie hinzuzufügen.

Die Leiste zeigt **{n} selected**, dann **Move to**, **Give a role** (jede Farbe erhält der Reihe nach die nächste Rolle), **Download** (die Auswahl in einem der sechs Palettenformate), **Duplicate** (eine Kopie jeder Farbe, hinter dem Original platziert), **Copy values** und **Delete**. Eine einzelne Kopie öffnet sich im Editor; mehrere bleiben ausgewählt. Einmal Cmd/Strg-Z macht eine Sammelaktion rückgängig.
:::

### Verläufe

Das optionale Panel **Gradients** erstellt Verlaufstokens aus der Palette. Jeder Verlauf hat eine Vorschau, 2 bis 8 benannte Stopps und einen Winkel. Ein Stopp verweist auf ein Farbfeld. Wenn Sie also die Farbe des Farbfelds ändern, folgt der Verlauf. Verläufe werden in OKLCH berechnet.

Die Paletten-Downloads (Design-Tokens, CSS, SCSS, GIMP und Adobe Swatch Exchange) liegen im Kopfbereich der Palette. [Ihre Palette und Schriften überall verwenden](/info/using.html#take-your-palette-and-fonts-anywhere) beschreibt jedes Format.

<!--i:eti-type-->
## Schrift

Ohne eigene Schrift zeigt der Bereich eine Karte: **Primary**, in der aktuellen Schrift in Lesegröße gesetzt, mit einem **Starter**-Label, einer Schaltfläche **Choose for Primary** und der Zeile *„Nichts wird installiert, bis Sie eine auswählen.“* Überschriften, Code und Kursivschrift folgen der Primärschrift, bis Sie sie wählen; **Choose them separately** zeigt ihre Karten.

![Der Bereich Type, in dem noch keine Schrift gewählt wurde - eine Karte in Lesegröße mit einem Starter-Label und einer ausgefüllten Schaltfläche Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Wählen Sie eine Schrift, und der Bereich erweitert sich zu vier Rollenkarten, der Liste Fonts und einem Live-Schriftmuster:

- **Primary**: Fließtext, Schaltflächen und jedes Tool.
- **Headings**: die Auszeichnungsschrift für `h1` und `h2`.
- **Code**: eine dicktengleiche Schrift für Code und Daten.
- **Italic**: eine echte Kursivschrift für Hervorhebungen, Zitate und Einschübe.

Eine Karte ist nur dort eingefärbt, wo Sie diese Schrift installiert haben. Ihre Schaltfläche zeigt die Rolle: **Change Headings** bei einer eigenen Schrift und **Choose for Headings** überall sonst. Die Beispielzeile bricht um. Nichts auf einer Karte übernimmt eine Änderung; die Schaltfläche öffnet die Vergleichsansicht für diese Rolle.

![Die vier eingeblendeten Rollenkarten - jede in der zugehörigen Schrift gesetzt, mit einem Starter-Label, wo noch niemand eine gewählt hat, und Italic, das der Primärschrift folgt](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Die Vergleichsansicht

Die Ansicht öffnet sich unter der Karte, die Sie gedrückt haben. Die Karten klappen zu einer einzeiligen Leiste zusammen, damit die Ansicht auf einem Smartphone sofort sichtbar ist. Escape bricht ab und gibt den Fokus an die Karte zurück.

1. Drücken Sie auf der Karte **Choose for** mit der Rolle.
2. Geben Sie den Namen einer Schriftfamilie ein und drücken Sie **Preview** oder drücken Sie auf eine der sechs **Pinned**-Familien unter dem Feld.
3. Drücken Sie **Use this face**.

![Die unter ihrer Karte geöffnete Vergleichsansicht mit der Suchzeile, den angehefteten Schriftfamilien und den zu einer einzeiligen Leiste eingeklappten Karten](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Die Einwilligung wird einmal abgefragt.** Wenn eine Vorschau zum ersten Mal auf Google Fonts zugreift, erklärt ein Dialog: *Google erfährt den Namen der Schriftfamilie und Ihre IP-Adresse. Die Datei wird danach auf diesem Gerät gespeichert und offline verwendet. Dies ist der einzige Schritt im Studio, der einen Drittanbieter kontaktiert.* **Fetch from Google** fährt fort und merkt sich die Entscheidung. **Cancel** lässt die Karte mit dem Text *„Nicht abgerufen. Es wurde nichts an Google gesendet.“* zurück, mit einer eigenen Schaltfläche **Fetch from Google**.

**Ziehen Sie eine Schriftdatei in die Ansicht** (TTF, OTF oder WOFF), um eine Vorschau einer lizenzierten Schrift zu sehen, die Sie besitzen. In beiden Fällen bleibt die Schrift auf diesem Gerät, wird offline in der App, den Tools und jedem Export gerendert und in der Designsystem-Datei mitgegeben. Alles auf Google Fonts wird unter einer offenen Lizenz bereitgestellt (OFL, Apache oder UFL).

### Schriften auf diesem Gerät

Das Panel **Fonts** listet jede Schrift auf diesem Gerät und ihre Rolle auf. Von Ihnen hinzugefügte Schriften stehen zuerst unter **In the design system**, jeweils mit ihren Rollen und einer Löschmöglichkeit. Die Ausgangsschriften folgen in einer dezenten, eingeklappten Zeile. **Add a face** öffnet die Vergleichsansicht für eine beliebige Rolle. Das Panel **Type roles** zeigt ein Live-Schriftmuster jeder Rolle mit ihrer Familie und ihrem Zustand, etwa *Inter* oder *Inter · follows Primary*.

<!--i:eti-tag-->
## Tokens

Tokens sind die benannten Werte hinter dem Designsystem: Farben, Schriften, Logos, Ecken und Abstände. Tools lesen sie nach Namen, sodass eine Änderung hier jedes Tool sofort erreicht.

![Der Bereich Tokens: der Kopfbereich mit einem Beispiel aus dem System und den Dateiaktionen, Kacheln mit der Anzahl jeder Token-Art, dann die Farbpaare mit ihren Kontrastanzeigen](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Der Kopfbereich** zeigt ein Beispiel aus Ihrem eigenen System (*Primary ist Spearmint, #033633*) und die Dateiaktionen: **Download** (das System als Design-Tokens oder die Palette in fünf anderen Formaten), **Copy CSS** und **Add from…**, um eine JSON-Datei wieder einzulesen.
- **Kacheln** zählen jede Token-Art und springen zu ihrem Abschnitt: Colours, Type, Logos, Shape and spacing, More und All tokens. Ein Abschnitt, der nur das enthält, was mit der leeren Ausgangsvorlage geliefert wurde, trägt ein **Starter**-Label; ein mit der App geliefertes System zählt sein eigenes Material ohne das Label. Auf einem Smartphone brechen die Kacheln in zwei Zeilen mit je drei Kacheln um.
- **Colours** beginnt mit den Paaren, die Tools zusammen verwenden (Text auf Hintergrundfläche, auf Primärfarbe, dezenter Text auf Hintergrundfläche), mit einer APCA-Anzeige für hell und dunkel, und markiert **Weak contrast**, wenn ein Paar den Zielwert verfehlt. Dann folgt jede Farbgruppe: eine Farbreihe als eine Zeile mit Chips, andere Farben mit ihrem Wert und der Referenz, die Tools verwenden, etwa `{color.brand.spearmint}`. Drücken Sie auf eine Referenz, um sie zu kopieren. **Edit in Colours** öffnet eine Gruppe im Bereich Colours. Bei einem Designsystem mit [Farbrollen](#colour-roles-what-the-colours-are-called) steht **Colour roles** zuerst, mit jeder Rolle einmal in den eigenen Wörtern und der Reihenfolge des Systems. Eine Rolle enthält eine Farbe für jede Farbvariante und jeden Look. Diese Farben werden bei der Rolle aufgelistet, nicht als separate Farben; ändern Sie sie in der Tabelle Colour roles.
- **Type** und **Logos** listen die Schrift für jede Rolle sowie jeden Logo-Platz auf, mit **Edit in Type** und **Edit in Logos**, sobald Sie eigene haben.
- **Shape and spacing** enthält **Rounded corners** (`shape.radius`) und **Spacing rhythm** (`space.base`). Jeder Wert zeigt *Lolly default*, bis Sie den Schieberegler bewegen, und danach *Yours*, speichert sofort und lässt sich rückgängig machen.
- **More tokens** fügt Abstände, Größen, Strichstärke, Deckkraft, Drehung, reine Zahlen und Schatten hinzu, gespeichert als standardisierte [Design-Tokens](/info/design-tokens.html).
- **App appearance (advanced)** listet die Farben, Größen und Schatten auf, die Lollys eigene Ansichten verwenden. **Inspect every token (advanced)** durchsucht und bearbeitet jeden gespeicherten Wert und zeigt jede Änderung zuerst zur Prüfung. Dort werden die Werte einer Farbrolle in jeder Farbvariante bei der Rolle aufgelistet: Wählen Sie das Token der Rolle, um eine Zeile pro Farbvariante zu sehen, hell und dunkel nebeneinander. Die Zählzeile gibt an, wie viele Werte die Rollen enthalten. Ein schreibgeschütztes Designsystem zeigt dieselbe Liste.

Ein leerer Abschnitt bietet **Pick a colour**, **Choose a face** oder **Add a logo** an.

<!--i:eti-images-->
## Dateien

Ziehen Sie die Dateien hinein, die Ihre Marke neben Logos verwendet: **Vektor**-, **Bild**-, **Audio**- und **Bewegtbild**dateien (Video, Lottie und Animationen). Sie erscheinen in [Assets](/info/using.html#assets-your-library), nach Abschnitten sortiert, und in der Asset-Auswahl jedes Tools. Sie bleiben auf diesem Gerät.

## Klang

**Sound** wird durch Zuhören gewählt. Der Bereich öffnet sich mit drei Ausgangsklängen, **Calm**, **Steady** und **Bright**, jeder als Karte in den Farben seines Genres mit einer Wiedergabeschaltfläche. Spielen Sie einen ab, um einen kurzen Ausschnitt zu hören; wenn Sie einen anderen starten, stoppt der erste. **Choose** macht diesen Klang zum Klang jedes Einsatzzwecks. Die vierte Karte, **Mixed**, gibt jedem Einsatzzweck seinen eigenen Klang: Calm für Explain, Steady für Demonstrate und Bright für Play. Ihre Wiedergabeschaltfläche spielt die drei nacheinander ab. Nichts wird gespeichert, bis Sie **Save sound** wählen. Der Klang wird dann Teil dieses Designsystems, mit einem Sicherungspunkt im selben Verlauf, den die anderen Bereiche verwenden. Ein Designsystem ohne Klang funktioniert weiter wie bisher.

Ein Einsatzzweck ist eine Situation, in der der Klang spielt: zunächst **Explain**, **Demonstrate** und **Play**. Jeder Einsatzzweck ist ein Chip mit eigener Wiedergabeschaltfläche. **Music** oder **With narration** über den Chips legt fest, ob ein Chip die Musik allein oder unter einer Stimme abspielt. Der gewählte Einsatzzweck zeigt seinen Zweck und seine Musik in einfachen Worten, etwa „Warm · 84 bpm · Rhodes, rollender Bass, raues Schlagzeug“. Jeder Einsatzzweck übernimmt Genre, Tempo und Instrumente des gewählten Klangs (oder bei Mixed seine eigenen). Jeder Einsatzzweck behält seine eigene Melodie und seine eigene Balance: Bei Explain lässt die Melodie der Stimme Raum, bei Play steht die Melodie im Vordergrund. Beim Wechsel zwischen Mixed und einem einzelnen Klang bleibt beides erhalten. Ein selbst hinzugefügter Einsatzzweck behält unter Mixed seinen bisherigen Klang. Das Designsystem hält fest, was Sie gewählt haben. **Add a use** fügt einen Einsatzzweck hinzu und lässt Sie seinen Namen direkt eingeben. **Make main** wählt den Einsatzzweck, der abgespielt wird, wenn nichts anderes angefordert wird. **Another tune** spielt eine neue Komposition mit denselben Einstellungen.

**Edit in the music generator** öffnet den [Musikgenerator](/info/generated-music.html#the-music-generator) mit den Einstellungen dieses Einsatzzwecks. Eine Zeile oben sagt, wessen Klang Sie bearbeiten. **Save to this use** bringt die Einstellungen in den Bereich zurück; **Cancel** kehrt ohne Änderungen zurück. Ungespeicherte Auswahlen im Bereich warten, während Sie woanders sind. Falls jemand den Klang inzwischen in einem anderen Tab speichert, gilt der neuere Speicherstand und Ihre Änderung wird nicht übernommen.

**Voice** wählt eine Stimme für den Einsatzzweck, die Sprechgeschwindigkeit und die Lautstärke der Musik unter der Stimme; **Hear the voice with the music** spielt beides ab. Unter **More** finden Sie die Absenkung während des Sprechens, die Wörter zum Ausprobieren (sie bleiben im Bereich), Aussprachehinweise (einer pro Zeile, als geschrieben = gesprochen) und Anmerkungen zur Stimme. Vorschauen verwenden das lokale Sprachmodell und dieselbe Mischung wie ein Sequenzexport. Eine Vorschau wird ausgeblendet; sie hat keinen komponierten Schluss.

**Notes and signature** enthält, worauf Sie bei einem Einsatzzweck achten sollten, und eine Klangsignatur: einen festen Anfang oder Schluss, der als eigene Audiodatei gespeichert wird. Platzieren Sie die Signatur in Ihrer Sequenz; generierte Musik enthält die Signatur nie. Eine Anforderung, die diese Version von Lolly nicht prüfen kann, verhindert neue Musik für diesen Einsatzzweck.

**Details** enthält den Charakter der Marke (wie sich der Klang anfühlen soll, was gleich bleibt und was zu vermeiden ist) und die Hörprüfung. **Record a listening review** hält den Namen der prüfenden Person, das Datum und ihre Anmerkungen zur gespeicherten Version des Klangs fest. Jede Änderung macht den Klang wieder zu einem Entwurf. Eine Prüfung gilt für diese Version, nicht für jede später aus dem Klang erzeugte Melodie: Hören Sie jedes neue Stück an, bevor es weitergegeben wird.

**Make a music project** öffnet den Einsatzzweck im Musikgenerator als Projekt, das den Einsatzzweck, die Version des Klangs und die exakten Einstellungen beibehält. **New tune** erzeugt dort eine neue Komposition und behält den Klang. Wenn Sie die Einstellungen ändern, kehrt **Put the sound back** zum Klang zurück, und **Keep as my own** setzt die Arbeit mit einer unabhängigen Melodie fort. Bis Sie sich entscheiden, kann das Projekt nicht als Werk aus diesem Klang gespeichert oder heruntergeladen werden. Freigabelinks enthalten nur die Musikeinstellungen. Das Projekt und eine gespeicherte Melodie behalten auch die Anmerkungen zum Klang, die weder in Freigabelinks noch in den öffentlichen Herkunftsangaben der Audiodatei erscheinen. Bewahren Sie eine gerenderte Aufnahme auf, wenn das exakte Audio auch in künftigen Versionen des Generators erhalten bleiben muss.

<!--i:eti-checklist-->
## Regeln

**Rules** legt fest, was Personen ändern können, was fest bleibt und was Lolly prüfen kann.

![Rules in Lolly Demo: vier Gestaltungsregeln, jeweils mit Checked in Design und Required oder Advisory markiert, dann Try your design system in use mit seinen renderbereiten Beispielen](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** listet Ihre Regeln auf. **Add rule** (oder **Add your first rule**) öffnet ein kurzes Formular:

- ein **Rule name** in Ihren eigenen Worten, etwa *Beacon-Akzente*;
- die **Check**-Prüfung: **Colour choices**, **Font choices**, **Fixed artwork** oder **Text length**, mit der verwendeten Markenrolle unter Ihrem eigenen Namen für diese Rolle;
- das **Example**, für das sie gilt (Poster, Title slide, Content slide oder Lolly Chart), der **Mode** und ob sie **Required** oder **Advisory** ist;
- **Reviewed by**, dann **Save draft** oder **Approve & save**.

Die Freigabe hält Ihre eigene Entscheidung auf diesem Gerät fest. Freigegebene verbindliche Regeln schränken das wiederverwendbare Poster ein, und Prüfungen decken nur die Beispiel-PNGs ab; sie ändern kein anderes Tool.

Regeln in der Token-Datei eines Designsystems, etwa freigegebene Farbpaare, Schriftstärke und Textausrichtung oder ein Logo pro Hintergrundfläche, werden hier als **Checked in Design** aufgelistet. Lolly Design prüft sie Ebene für Ebene in der Karte **Before you export** des Export-Panels, und `lolly check` tut dasselbe für ein gespeichertes Lolly Design-Dokument ([Vor dem Export](/info/design.html#before-you-export)). Eine Regel, für die dieser Build keine Prüfung hat, bleibt wie geliefert erhalten und wird als **Unchecked** markiert.

Lolly Demo bringt vier freigegebene Gestaltungsregeln mit. Überschriften werden nie in Großbuchstaben gesetzt: Diese Regel ist verbindlich, daher meldet `lolly check` eine Überschrift in Großbuchstaben als Fehler. Die anderen drei sind Empfehlungen. Fließtext ist linksbündig. Primäre Markenzeichen stehen auf hellen Flächen, inverse Markenzeichen auf dunklen. Gestrichelte Linien bedeuten: hier ablegen.

**Try your design system in use** rendert mit **Render & check examples** vier Beispiele aus der aktuellen Revision. Wählen Sie einen **Mode** und **Try your own text** für die Überschrift, den Begleittext und den Folientext. Jedes Beispiel meldet, was gemessen wurde, mit **See checks & sources** und **Download check report**. **Make reusable poster** lädt eine `.lolly` herunter, die ihr festes Layout und ihre freigegebenen Eingabeoptionen enthält. Beispiele sind lokal: Eine Prüfung veröffentlicht nichts und gibt nichts frei.

Ein Build, der mit einer festen Marke ausgeliefert wird, zeigt dieselben Regeln und Beispiele schreibgeschützt unter *This brand is set*.

<!--i:eti-graduation-cap-->
## Skills

**Skills** listet die [Marken-Skills](/info/brand-skills.html) des aktiven Designsystems auf: die schriftlichen Standards der Marke, einer pro Fachgebiet, für Menschen und KI-Agenten. Jede Zeile zeigt das Fachgebiet, den eigenen Status der Marke (**Draft** oder **Approved**), ob der Skill öffentlich oder intern ist, und seine Revision. Wählen Sie eine Zeile, um den Skill mit seiner Abdeckung zu lesen. Diese vergleicht die Zeilen des Skills mit Ihren Tokens: was Lolly prüft, was widersprüchlich ist, was übereinstimmt und was nur als Anleitung dient.

**Download skill (.zip)** schreibt den Skill als Agent Skills-Ordner für ein Agenten-Tool, mit Kataloglinks, die auf dieses Lolly verweisen. **Copy as one file** legt denselben Text für ein Chatfenster in die Zwischenablage. Ein Designsystem ohne eigene Skills listet eine Grundlage auf, die Lolly bei jedem Lesen aus seinen Tokens und Gestaltungsregeln erstellt. Der Bereich liest Skills und bearbeitet sie nie.

<!--i:eti-upload-->
## Eine Marke importieren

**Add from…** in der Leiste öffnet eine Auswahl, die fragt, was Sie haben, nicht in welchem Format es vorliegt:

- **Design tokens or a design file**: DTCG- oder Tokens Studio-JSON, ein Penpot-Projekt, eine ZIP-Datei mit Token-Sätzen, ein Lolly-Designsystem-Paket, ein SVG, eine `DESIGN.md` oder ein Ordner mit einer Markenseite.
- **PDF**: ein Deck oder eine Datei mit Richtlinien, deren Farben, Markenzeichen und eingebettete Schriften auf diesem Gerät gelesen werden.
- **Logo or screenshot**: Ein Bild wird zu einer vorgeschlagenen Palette, die auf diesem Gerät ausgelesen wird. Es werden Farben gelesen, nicht die Schrift oder das Layout.
- **Saved web page**: eine HTML-Datei und ihre CSS-Dateien oder eingefügtes HTML oder CSS, bis zu 20 Dateien und 2 MB. Nur der von Ihnen bereitgestellte Text wird gelesen: Verknüpfte Ressourcen werden nicht abgerufen und Skripte nicht ausgeführt.
- **Font file**: TTF, OTF oder WOFF. Öffnet den Bereich Type, wo die Schrift installiert wird.
- **Website**: eine Seite, deren Farben und Schrift gelesen werden. Diese Kachel erscheint nur auf einem Gerät, das eine Seite lesen kann, und sagt, womit sie gelesen wird: mit der App auf diesem Gerät oder mit der Browser-Erweiterung in einem Hintergrund-Tab, in dem Sie angemeldet sind. Die Eingabe einer URL füllt nur das Feld aus; das Drücken auf Abrufen ist die Einwilligung.

Wählen Sie die Quelle für Designdateien, und die nächste Karte listet die unterstützten Formate als Symbolkacheln auf. Die Karte ist eine einzige Ablagefläche. Sie können auch eine Datei auf das Studio ziehen.

![Die Importkarte - die unterstützten Formate stehen als Symbolkacheln oben, und die gesamte Karte ist eine einzige Ablagefläche](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- Ein **Lolly-Designsystem-Paket** (`.lolly` oder eine ältere `.zip`) wird in einem Schritt installiert.
- Ein **Penpot**-Export (`.penpot`) bringt seine Design-Tokens mit.
- Eine **Design Tokens**- (W3C DTCG) oder **Tokens Studio**-Datei (`.json`) bringt ihre Tokens mit. Eine Beschreibung, die Lesende auffordert, Anweisungen zu ignorieren, Berechtigungen beansprucht oder zum Ausführen von Code auffordert, wird ausgelassen, und der Import sagt, wo sie stand.
- Ein **einfaches SVG** wird nach Farben durchsucht, aus denen Sie wählen; die erste wird Ihre Primärfarbe.
- Eine **`DESIGN.md`** (`.md`) gelangt mit ihren Tokens in unveränderter Form zu **Try these colours**. Ihr Fließtext kann als Entwurf eines Marken-Skills behalten werden, und die Karte markiert Zeilen, die Lesende auffordern, Anweisungen zu ignorieren, Berechtigungen beanspruchen oder zum Ausführen von Code auffordern. Agenten und Markenseiten sehen einen Entwurf erst, wenn Sie im Bereich Skills **Keep this skill** drücken, und ein behaltener Skill bleibt intern.
- Ein **Ordner mit einer Markenseite**, als Ordner ausgewählt, hineingezogen oder gezippt, gelangt zur selben Prüfung. Jede Datei wird mit der `brand.json` des Ordners abgeglichen; eine einzige nicht übereinstimmende Datei führt zur Ablehnung des gesamten Ordners. Der Import fügt die Tokens hinzu. Logos und Schriften bleiben im Ordner.

::: warning Die Prüfung auf Anweisungen liest Zeile für Zeile
Die Prüfung, die Anweisungen in den Beschreibungen einer Token-Datei auslässt, liest Zeile für Zeile und übersieht andere Formulierungen. Lesen Sie eine Datei von jemandem, den Sie nicht kennen, bevor Sie die Tokens anwenden.
:::

Lolly liest eine Markenseite aus Dateien, die Sie bereitstellen. Es ruft keine Adresse einer anderen Website ab.

### Eine Datei mit eigenen Farbwörtern

Eine Token-Datei oder eine `DESIGN.md` kann eigene Wörter für ihre Farben verwenden, etwa main, accent, supporting und tertiary. Wenn Lolly solche Wörter findet, listet die Prüfung jedes Wort auf, bevor etwas angewendet wird: das Wort, seine Farbe in jedem Look, das Token, aus dem es stammt, und Lollys vorgeschlagene Lesart. Lolly schlägt Lesarten allein anhand der Wörter im Abgleich mit einer kurzen Liste vor, ohne Modell. Ein Wort, das nicht auf der Liste steht, wird als eigenes Wort der Marke mit **By name only** übernommen. Sie können jedes Wort umbenennen, seinen Zweck angeben, ihm eine andere Lesart geben oder sein Häkchen entfernen, um es als benannte Farbe zu behalten.

**Install with these roles** schreibt die Rollen; **Install without roles** installiert die Datei so, wie sie geliefert wurde. Eine Datei ohne solche Wörter überspringt diesen Schritt. Eine Datei, die ihre eigenen Rollen festlegt, etwa eine von Lolly geschriebene, zeigt sie wie angegeben und installiert sie unverändert; Sie können sie später im Bereich Colours bearbeiten. Im Terminal gibt es keine Prüfansicht: `lolly system import` behält einen angegebenen Datensatz und belässt die Wörter anderer Dateien als benannte Farben.

### Eine Referenz prüfen

Ein Logo, ein Screenshot, eine Website oder eine gespeicherte Seite öffnet **Try these colours**: ein Beispiel in den vorgeschlagenen Farben, eine **Main colour**, die Sie ändern können, und einen Namen für ein neues System. Ein Kasten sagt, was das Anwenden bewirkt: Es **ersetzt** die aktiven Token-Einstellungen durch die generierte Palette und die Standardstile, **behält** Ihre Schriften und Bibliotheksdateien bei, und das vorherige System lässt sich **wiederherstellen**. **Apply suggested settings** legt einen Sicherungspunkt an und wendet dann die helle und dunkle Palette an. **Restore brand settings** kann die alten Einstellungen zurückbringen. **Change reference** wählt eine andere Quelle.

::: details Was aus einer Referenz gelesen wird und der Designkontextbericht
**Palette, source details and individual choices** zeigt, was gelesen wurde, alle gefundenen Schriftnamen und den Kontrast der Vorschau. Schriftnamen sind nur Vorschläge; eine Schrift installieren Sie in Type. Die Quelldetails können Typografie, Abstände, Innenabstände und Eckenwerte enthalten, sofern beobachtet, andernfalls mit **Not observed** gekennzeichnet. Eine gespeicherte Seite oder das native Auslesen einer Website meldet deklarierte Stile, die die Seite möglicherweise nicht verwendet. Die Browser-Erweiterung kann gemessene Stile aus einer Stichprobe sichtbarer Elemente melden. Dies sind Beobachtungen: Nichts wird installiert, und Abstände aus der Quelle ersetzen nie Ihre eigenen. **Choose individual items in the tray** behält einzelne Elemente. **Download design context** speichert einen JSON-Bericht mit Beobachtungen, vorgeschlagenen Tokens und Quellinformationen (mit einem SHA-256 des bereitgestellten HTML oder CSS). Der Bericht enthält keinen rohen Seitentext und ist kein signiertes Content Credential.
:::

PDF- und Designdatei-Importe behalten ihre eigenen Steuerelemente zur Prüfung. Elemente im **Tray** ändern nichts, bis Sie sie in dem Bereich hinzufügen, der für diese Art von Material zuständig ist. `#/start?source=<kind>` öffnet die Auswahl mit einer Quelle (`file`, `pdf`, `image`, `font`, `url`, `page`), und `?import` öffnet die einfache Liste.

### Einen Look finden und vergleichen

Öffnen Sie **Find a look** über Board oder die Designsystem-Liste in Settings. Durchsuchen Sie auf diesem Gerät gespeicherte Systeme und einige wiederverwendbare Lolly-Beispiele und suchen Sie nach Name, Farbtag oder deklarierter Schrift. **Closest to my current palette** sortiert nach gemessener Farbähnlichkeit, wobei übereinstimmende Schriften bei Gleichstand entscheiden; es ist keine Qualitätsbewertung.

Klicken Sie auf einen Look, um ihn im Kontext als Vorschau zu sehen; die Vorschau ändert nichts. **Use this look** auf einer Karte wendet diesen Look an. Ein gespeichertes System wird zum aktiven, was nichts bearbeitet. Die Farben eines Beispiels gelangen nach dem üblichen Sicherungspunkt in das geöffnete Designsystem. Die Logos, Schriften und alles andere, was das Beispiel nicht definiert, bleiben im System unverändert. **Compare looks** fügt jeder Karte ein Kontrollkästchen hinzu: Wählen Sie zwei, um sie nebeneinander zu vergleichen. **Restore brand settings** stellt den vorherigen Look wieder her. Gespeicherte Systeme haben bearbeitbare **Search tags** unter **Details and design context**. Die Beispiele sind eigene Farbrezepte von Lolly, ohne eine durch Scraping erstellte Sammlung und ohne Konto.

![Lolly vergleicht Sunroom und Orchard nebeneinander, bevor eines der Farbsysteme angewendet wird.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Ihr Designsystem behalten und übertragen

### Eine Marke zwischen Geräten übertragen

**Export** schreibt eine **`LollyBrand-….lolly`**-Datei: Ihre Tokens, Schriften, Logos und Designpräferenz, mit einem Integritätsmanifest, das beim Import geprüft wird. Webversionen vor 1.0.7 nannten die Datei `.zip`, und Lolly akzeptiert diese Schreibweise weiterhin. **Tokens (.json)** schreibt das reine Design-Tokens-Dokument ohne Schriften oder Logos, für ein Repository, einen Build-Schritt oder ein anderes Token-Tool.

Um eines wieder zu importieren, verwenden Sie **Add from… → Design tokens or a design file** oder ziehen Sie die Datei auf das Studio. So gibt Ihnen eine Kollegin oder ein Kollege eine Marke weiter, oder Sie übertragen eine auf eine zweite Installation, ohne Konto und ohne Cloud. [Mit Partnern arbeiten](/info/partners.html) behandelt, was Sie sonst noch mitsenden sollten, wenn die Person, die Ihre Marke erhält, für eine andere Organisation arbeitet. Um eine Marke über die Befehlszeile zu importieren, siehe [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** verpackt die von Ihnen hinzugefügten Schriften in ein installierbares RPM. Wenn Sie eine davon selbst hochgeladen haben, bittet Lolly Sie zuerst um die Bestätigung, dass Sie sie weitergeben dürfen.

### Frühere Einstellungen wiederherstellen

Öffnen Sie **More** in der Leiste, wählen Sie **Restore brand settings**, wählen Sie einen datierten Sicherungspunkt und drücken Sie **Restore**. Dies stellt Farben, Schrifteinstellungen und andere Tokens für die aktive Marke wieder her; Schrift- und Bilddateien bleiben unverändert. Lolly speichert Ihre aktuellen Einstellungen zuerst als **Before restore**, sodass Sie eine Wiederherstellung auch nach dem Schließen des Browsers rückgängig machen können. Die letzten 20 Sicherungspunkte werden auf diesem Gerät behalten. Eine Änderung, die Sie vornehmen, während das Studio **Saving…** anzeigt, bleibt nach einem Neuladen erhalten, und eine Karte bietet an, Änderungen wiederherzustellen, deren Speicherung nicht abgeschlossen wurde.

### Versionen

Eine veröffentlichte Version ist eine **dauerhafte, benannte Kopie**, die auf diesem Gerät gespeichert wird. Sie ändert sich nie, sodass ein Tool oder ein Link, der sie festlegt (mit `designv`), weiterhin dasselbe zeichnet. Ein System mit etwas Eigenem listet **Versions & publishing** im Menü **More** der Leiste auf; nach Ihrer ersten Veröffentlichung kommt **Versions** zu den Bereichen hinzu. `#/start?area=versions` öffnet Versions.

::: warning Eine veröffentlichte Version ist dauerhaft
Löschen ist noch nicht möglich, und das Panel weist darauf hin. Veröffentlichen lässt sich nicht rückgängig machen, Wiederherstellen schon. *Restore latest from this version* ist eine gewöhnliche Änderung, bei der **Undo** sofort angeboten wird.
:::

**Entfernungen stehen in der Kompatibilitätskarte zuerst**, weil ein Tool mit einem entfernten Token nicht mehr funktioniert.

**Publish only** behält eine Version, ohne zu ändern, welcher Version Tools folgen; **Publish and make active** lässt Tools und die App dieser Version folgen. **Follow the latest again** macht jede Änderung sofort wirksam.

### Eine Markenseite veröffentlichen

Eine [Markenseite](/info/brand-page.html) ist eine Adresse für Menschen und Agenten: eine Seite mit Logos, Farben, Schrift und Beispielen, mit denselben Fakten in begleitenden Dateien. **Publish a brand page** unter Versions & publishing zeigt die Live-Seite und daneben:

- **Goes public**: jede Datei, gruppiert und mit ihrer Größe.
- **Held back**: was ausgelassen wurde und warum. Ein Logo ohne vermerkte Lizenz bleibt ausgeschlossen, bis Sie den Namen des Logos anhaken. Eine Schriftdatei braucht eine vermerkte Lizenz, die ihre Weitergabe erlaubt, und die Seite zeigt ein in Pfade umgewandeltes Schriftmuster, wenn die Datei ausgeschlossen bleibt. Interne Marken-Skills erscheinen nie.
- **What was checked**: Farbpaare pro Farbvariante und Modus sowie die Gestaltungsregeln. Dies sind Messungen, kein Urteil.
- **In your words**: eine Nutzungserklärung und ein Kontakt. Die Seite zeigt, was Sie schreiben, und Lolly fügt weder eine Lizenz noch eine rechtliche Aussage hinzu. Ein Schalter blendet die Zeile „Made with Lolly“ in der Fußzeile aus.
- **On exports**: ein Schalter, der [die Adresse der Seite in den Exporten dieses Designsystems vermerkt](/info/brand-page.html#lead-back-from-your-files). Der Schalter ist ausgeschaltet, bis Sie ihn einschalten, braucht eine `https`-Adresse und wird mit einem Paket oder einer Kopie nicht mitgegeben. Ein gesperrtes Designsystem zeigt den Schalter nicht, weil seine Verwaltung entscheidet.

**Download folder** speichert den Ordner als ZIP, damit Sie ihn dort hosten können, wo Sie möchten. Nichts wird öffentlich, bis Sie den Ordner hosten. In einem Terminal schreibt `lolly system publish --out=<dir>` denselben Ordner. Eine Instanz, die Markenseiten bereitstellt, bietet auch **Publish to** für ihre Adresse an: ein ausdrücklicher Klick, durch die Freigabekette der Instanz, sofern sie eine hat. Ein verwaltetes Designsystem veröffentlicht nur, wenn seine Verwaltung es erlaubt.

### Einen Agenten verbinden

**Connect an agent** an derselben Stelle gibt Ihnen Text zum Einfügen und sagt, was jede Option kann:

- **`AGENTS.md`** in einem Projekt: Agenten lesen die Namen und Regeln des Systems. Die Datei zeichnet nichts und braucht keinen Server.
- **Lolly's public server**: zeichnet mit Lolly Demo, unabhängig davon, welches System Sie hier geöffnet haben. Er braucht keinen Schlüssel.
- **Your instance**: zeichnet mit den Systemen, die die Instanz enthält, und liest ein Dienst-Token aus einer Umgebungsvariablen. Das Blatt nennt den Namen der Variablen und zeigt nie ein Token.

Wenn kein gehosteter Server mit Ihrem System zeichnet, weist das Blatt darauf hin.

<!--i:eti-layers-->
## Ihre Designsysteme verwalten

Öffnen Sie **Settings → Preferences → Design systems**, um Systeme zu wechseln, hinzuzufügen oder zu entfernen. **Open** wählt ein System und öffnet es hier; **Make a new one** erstellt ein lokales System und öffnet es mit einem eingabebereiten Namensfeld. Für das gesamte Gerät ist jeweils ein System aktiv. [Markenarchitekturen](/info/brand-architectures.html) hilft bei der Entscheidung, wann eine Marke ein eigenes Designsystem braucht.

**Woher ein System kommt.** Das System, das der Katalog einer Bereitstellung liefert, zeigt **Came with this app** oder **From this instance** in einer App, die mit einer Instanz verbunden ist. Klappen Sie **Catalogue source** auf, um zu sehen, wer es bereitstellt, sein Token-Asset und seinen Namensraum sowie seine bekannte Version oder Prüfsumme; wenn eine Aktualisierung fehlschlägt, wird zwischengespeichertes Material gekennzeichnet.

**Verwaltete Systeme sind schreibgeschützt.** Ein System zeigt **Managed by this instance** (oder **Managed by this app** in der Desktop-App ohne Instanz), wenn sein Katalog das System sperrt. Sie können ein verwaltetes System verwenden und herunterladen. Wenn Sie eines hier öffnen, erscheint ein Hinweis zum Schreibschutz mit **Make an editable copy** und **Switch**, danach seine Farbrollen und Tokens ohne Steuerelemente zur Bearbeitung. Ihre eigenen lokalen Systeme bleiben bearbeitbar, auch wenn das verwaltete zuerst da war. Ein Build mit einer festen Marke öffnet Lolly Design System Setup bei *This brand is set*, mit den Tokens und Nutzungsregeln der Marke zum Lesen.

**Jedes andere mitgelieferte System können Sie** ausblenden, bearbeiten und zurücksetzen, einschließlich Lolly Demo und Lolly Starter auf lolly.tools. Wenn Sie eines bearbeiten, behält es seinen Namen und die Zeile erhält die Markierung **Edited here**. **Reset to original** in seinem Menü verwirft die auf diesem Gerät vorgenommenen Änderungen. Die leere Ausgangsvorlage ist die Ausnahme: Eine erste Änderung dort beginnt ein eigenes Designsystem, und Lolly fragt einmal nach seinem Namen. [Lolly Demo im Einsatz](/info/lolly-demo-in-use.html#switch-to-your-own) zeigt, was Ihr eigenes System ersetzt.

### Ein Designsystem entfernen

Wählen Sie **Remove** im Menü eines Systems; die Bestätigung sagt, welches System danach aktiv sein wird. Gespeicherte Sitzungen, Uploads und Material, das mit einem anderen System geteilt wird, bleiben erhalten.

Das Entfernen eines mitgelieferten Systems blendet es nur aus: Seine Katalog-Assets bleiben, **Bring back** zeigt es wieder, und es kehrt von selbst zurück, wenn Sie alles andere entfernen. Das Entfernen einer importierten oder bearbeiteten Kopie entfernt weder das mitgelieferte System noch seine Logos oder Schriften. War die Kopie aktiv, wird das mitgelieferte System wieder aktiv. Das Entfernen einer aktiven gehosteten Kopie löscht nur die Verbindung dieser Kopie; eine separat gewählte Instanz bleibt ausgewählt.

::: details Ein von einem Server bereitgestelltes Designsystem ändern
Was ein Server bereitstellt, zu ändern, ist eine Aufgabe der Administration: Sein Betreiber ändert den Quellkatalog und führt die Bereitstellung erneut aus, oder ein Lolly Work-Administrator prüft eine Serveränderung und wendet sie an. Änderungen hier bleiben lokal, mit einer Ausnahme. Auf einer Lolly Work-Instanz, die Ihnen `brand.edit` gewährt, bietet ein verwaltetes System auch **Edit for** für diese Instanz an, was eine Bearbeitungskopie öffnet. **Send to** für diese Instanz in **Versions** sendet deren Farben, Farbvarianten, Farbrollen und Markenseitenadresse zurück. [Diese Instanz vom Studio aus bearbeiten](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) behandelt, was eine Änderung verändern kann und wie die Instanz die Änderung bereitstellt. Siehe [Ein Katalog-Designsystem entfernen](/info/configuration.html#removing-a-catalogue-design-system) und [Konfiguration](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Designkontext außerhalb der App verwenden

**Download design context** speichert das Token-Dokument, aufgelöste Farben, deklarierte Schriftfamilien, Asset-IDs, Quellbelege, sofern erfasst, Abdeckung und ausdrückliche Regeln, ohne Schriftdateien und ohne Eigentumsnachweis. Die Befehlszeile liest die Datei ohne Server: `lolly system import` macht sie zum Designsystem des Terminals, und `lolly system check` prüft Lolly Design-Eingaben gegen den gespeicherten Kontext. [Ihr Designsystem mitbringen](/info/cli.html#bring-your-design-system) behandelt den Import, und [Welches Designsystem ein Befehl verwendet](/info/cli-decks.html#which-design-system-a-command-uses) behandelt die Prüfung. Ein MCP-Client liest dasselbe Briefing aus `lolly://design-context` ([MCP Server](/info/mcp.html)).

<!--i:eti-map-pin-->
## Nächste Schritte

- **[Lolly verwenden](/info/using.html)**: die Tools, Speichern, Teilen und Assets.
- **[Markenarchitekturen](/info/brand-architectures.html)**: wie Geschäftsbereiche, Produkte, gestützte Marken, Kunden und Saisons Designsystemen, Farbvarianten und Logo-Identitäten zugeordnet werden.
- **[Mit Partnern arbeiten](/info/partners.html)**: Ihre Marke mit einem Partner teilen und mit einer Marke arbeiten, die Sie erhalten haben.
- **[Markenseiten](/info/brand-page.html)**: Ihr Designsystem unter einer Adresse als Pressemappe und Agentenpaket veröffentlichen.
- **[Design-Tokens](/info/design-tokens.html)**: das Token-Modell, in dem Ihre Marke geschrieben ist.
- **[Eine Datei exportieren](/info/exporting.html)**: Druckeinheiten, CMYK und die Formate, in die Ihre Marke gerendert wird.
