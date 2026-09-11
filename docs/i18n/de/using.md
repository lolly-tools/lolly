# Lolly verwenden

Ein praktischer Leitfaden zum tatsächlichen *Verwenden* der App - ein Tool öffnen, mit der Zeichenfläche arbeiten, exportieren, speichern und teilen. Alles hier läuft **auf Ihrem Gerät**: kein Konto, kein Upload, nach dem ersten Laden kein Internet nötig.

> Neu hier? Der [Schnellstart](/info/quickstart.html) bringt Sie in wenigen Minuten zum ersten Ergebnis, und [Lolly für Operatoren](/info/operators.html) behandelt Installation und Bereitstellung der App; auf dieser Seite geht es darum, sie zu bedienen, sobald sie offen ist.

## Ein Tool öffnen

Der Startbildschirm ist die **Galerie** - jedes Tool, nach Kategorie gruppiert. Klicken Sie auf eine Karte, um das Tool zu öffnen; wenn Sie schon einmal daran gearbeitet haben, setzt die Schaltfläche **Weiter** Ihre jüngste Sitzung fort. Filtern Sie mit dem Suchfeld nach Namen - oder nutzen Sie die [Suche](/info/search.html) in der Leiste am Fuß der sechs Übersichtsansichten (Galerie, Utilities, Projekte, Katalog, Dashboard und Profil), die neben den Tools auch Ihre gespeicherte Arbeit, den Katalog und Ihre Einstellungen erreicht. Innerhalb eines Tools tritt die Leiste zur Seite und macht der Oberfläche des Tools Platz.

![Die Tool-Galerie - jedes Tool als Karte, nach Kategorie gruppiert](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&filename=gallery&try=1)

Jedes Tool ist eine geteilte Ansicht: **Steuerelemente** auf der einen Seite, eine Live-**Vorschau** (die Zeichenfläche) auf der anderen. Ändern Sie ein Steuerelement, und die Vorschau aktualisiert sich sofort.

![Die geteilte Ansicht eines Tools - der Kontrollstapel links und das live gezeichnete gruppierte Balkendiagramm rechts](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Einige Tools (wie **Design**) öffnen stattdessen als **freie Zeichenfläche** - eine rahmenlose Oberfläche zur direkten Bearbeitung, auf der Sie Boxen mit Text, Formen und Bildern ziehen, skalieren, drehen und einrasten lassen und Text per Doppelklick an Ort und Stelle bearbeiten. Sie exportiert über denselben Renderpfad wie jedes andere Tool, die Zeichenfläche *ist* also die Datei. Siehe [Die freie Zeichenfläche](#the-free-canvas-design) weiter unten.

Zwei Wege, das Raster selbst zu dem zu machen, das Sie haben wollen:

- <!--i:star--> **Markieren Sie, was Sie nutzen.** Vergeben Sie einer Karte einen ★, und sie bekommt eine eigene große Kachel in einem Streifen über dem Raster - siehe [Ihre Favoriten](/info/favourites.html).
- <!--i:eyeoff--> **Blenden Sie ein Tool aus, das Sie nie brauchen.** Rechtsklick auf eine Karte (oder mehrere auswählen und die Auswahlleiste nutzen) → **Tool ausblenden**. Es fällt aus dem Raster heraus und aus dem, was das Tippen im Raster findet; eine graue Kachel **Ausgeblendete Tools anzeigen (N)** ganz am Ende holt sie abgeblendet wieder hervor, jede mit **Tool einblenden** im eigenen Menü. Das Ausblenden betrifft nur Ihr Raster - das Tool öffnet sich weiterhin über einen gespeicherten Link oder ein Lesezeichen, und für alle anderen bleibt es genau dort, wo es war.

![Das Ende des Tool-Rasters mit sichtbar gemachten ausgeblendeten Tools: die abgeblendete Karte QR Code Generator und daneben die graue Kachel, die sie zurückgeholt hat und nun Ausgeblendetes verbergen anzeigt](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

### Ask Lolly

Wenn Sie lieber fragen als suchen: **Ask Lolly** (`#/ask`) nimmt eine getippte Frage entgegen und gibt den passenden Abschnitt dieser Dokumentation **wörtlich** zurück - die Worte der Anleitungen selbst, keine Zusammenfassung und nichts Generiertes - mit Angabe der Seite, aus der er stammt, und einem Link **In der Dokumentation öffnen** daneben. Unter der Antwort stehen die Stellen in der App, auf die dieselbe Frage passt: ein Tool, eine Einstellung, ein gespeichertes Projekt, jeweils als Schaltfläche, die einfach dorthin führt.

Der Verlauf ist Sitzungsgedächtnis: Stellen Sie eine Anschlussfrage, und der Faden wächst mit; laden Sie neu, beginnt er von vorn. Suchergebnisse tragen unten eine Zeile **Ask Lolly: *Ihre Anfrage*** - unter den konkreten Treffern der anderen Gruppen -, die die Frage direkt weiterreicht, sodass Sie in der Leiste beginnen und hier aufhören können.

## Die Zeichenfläche (Vorschau)

Die Vorschau zeigt immer genau das, was exportiert wird.

**Desktop**

- **Zoom:** Cmd/Strg-Scrollen oder Pinch-Geste auf einem Trackpad - der Zoom zentriert sich auf Ihren Zeiger.
- **Verschieben:** **Leertaste** halten und ziehen oder mit der **mittleren Maustaste** ziehen. (Einfache Klicks bleiben frei, um Teile des Designs anzuklicken.)
- **Tastatur:** `0` = an Fenster anpassen · `1` = 100 % · `+` / `−` = Zoom.
- **Zoom-HUD:** das kleine Bedienelement `−  NN%  +  Fit` in der Ecke. Klicken Sie auf den Prozentwert, um zwischen Fit ↔ 100 % umzuschalten.

![Das Zoom-HUD in der Ecke der Zeichenfläche - Minus, der Live-Prozentwert, Plus, Fit, dann die Schalter für Farbschema und Ton](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Touch**

- **Pinch-Geste** zum Zoomen, **Ziehen** zum Verschieben, **Doppeltippen** setzt auf die Einpassung zurück.

**Klicken, um zu einem Steuerelement zu springen:** Klicken Sie auf ein beliebiges Element im Design, und die passende Eingabe in der Seitenleiste erhält den Fokus und wird ins Sichtfeld gescrollt - bei einer sich wiederholenden Zeilengruppe klappt genau die Zeile auf, die Sie angeklickt haben, sodass das Bearbeiten des Gesehenen nur einen Tipp entfernt ist.

Eine Änderung der Abmessungen setzt die Ansicht immer auf eine saubere Einpassung zurück.

### Die freie Zeichenfläche (Design)

Tools mit freier Zeichenfläche legen eine Arbeitsfläche *um* das Artboard herum, wie das Montagebrett auf einem Grafiktisch:

- **Ablegen außerhalb der Zeichenfläche.** Ziehen Sie eine Box über den Rahmenrand hinaus, bleibt sie vollständig **sichtbar und auswählbar** - parken Sie Elemente seitlich, während Sie die Komposition anordnen, und ziehen Sie sie dann wieder hinein. Alles außerhalb des Rahmens ist **sanft abgeblendet**, damit der Exportbereich stets auf einen Blick erkennbar ist, und der Rahmen behält seinen Schatten, der genau markiert, wo die Datei beginnt.
- **Nur der Rahmen wird exportiert.** Die exportierte Datei ist durch das Artboard begrenzt - alles, was draußen bleibt (oder der Teil einer Box, der über den Rand hinausragt), wird schlicht aus der Ausgabe herausgeschnitten, bei Raster- wie bei Vektorformaten.
- **Über Fit hinaus herauszoomen** (bis auf 20 %), um das ganze Montagebrett zu sehen, wenn Sie Dinge weit außerhalb des Rahmens abgelegt haben.
- **Größenveränderbares Artboard.** Eine Änderung der Exportabmessungen ändert die Größe des Rahmens an Ort und Stelle; Boxen behalten ihre Positionen, sodass Sie ein Layout um vorhandene Inhalte herum neu rahmen können.

![Design's free canvas - the artboard with its surrounding pasteboard](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

**Eine Auswahl spiegeln.** Rechtsklicken Sie auf eine beliebige Box und wählen Sie **Flip horizontal** oder **Flip vertical**, um sie an Ort und Stelle zu spiegeln, oder drücken Sie `Shift+H` / `Shift+V` auf der Tastatur - Shift, weil ein bloßes `V` das Pointer-Werkzeug ist. Jede ausgewählte Box spiegelt sich in einem Undo-Schritt entlang ihrer eigenen Achse, und die Spiegelung ist eine echte Transformation, sodass sie im exportierten SVG, PDF und PNG erhalten bleibt und nicht nur auf der Leinwand.

### Eigene Formen zeichnen (der Stift)

Boxen, Kreise und abgerundete Rahmen decken die meisten Layouts ab. Brauchen Sie eine Form, die nicht in dieser Liste steht, zeichnen Sie sie: Die Schaltfläche **Stift** in der Leiste (oder die Taste `P`) versetzt Sie in den Zeichenmodus. Drei einzelne Tasten wechseln zwischen den Modi - **`V`** zurück zum Zeiger, **`P`** zum Stift, **`N`** zum Punktewerkzeug (**Punkte bearbeiten**) - und der Zeiger ist immer der Ausweg aus dem, worin Sie gerade sind.

![Die Werkzeugleiste der freien Zeichenfläche: ein Ziehgriff, das Lolly-Menü, dann Zeiger, Box hinzufügen, Stift, Punkte bearbeiten, Linie, Zeitleiste, Artboards und Automatisch anordnen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Klicken** setzt einen Punkt. Beim voreingestellten Kurventyp zieht **Klicken und Ziehen** die Griffe dieses Punktes heraus - so zeichnen Sie eine Kurve statt einer Ecke; halten Sie beim Klicken **Alt**, wird es stattdessen eine harte Ecke. (Bei den anderen Kurventypen ist jeder gesetzte Punkt eine Ecke, und das Ziehen bewirkt nichts; siehe **Spline-Typ** weiter unten.)
- Punkte rasten beim Setzen am Artboard und an Ihren anderen Boxen ein und zeichnen dieselben Hilfslinien wie ein normales Ziehen. Alt unterdrückt beim Zeichnen das Raster und beim späteren Ziehen eines Punktes sowohl das Raster als auch die Kanten.
- **Klicken Sie auf Ihren ersten Punkt**, um die Kontur zu schließen und in einem Zug fertig zu werden. Andernfalls drücken Sie **Enter**, doppelklicken oder wechseln einfach das Werkzeug - die Zeichnung bleibt erhalten, sie wird nicht verworfen.
- **Escape** arbeitet sich Stufe für Stufe zurück: Der erste Druck verwirft die Zeichnung und schreibt nichts, ein zweiter verlässt den Stift.
- **Entf** während des Zeichnens entfernt den zuletzt gesetzten Punkt.

Das Ergebnis ist eine gewöhnliche Box auf der Zeichenfläche. Verschieben, skalieren, drehen, gruppieren, ausrichten, neu stapeln, mit Füllung, Verlauf, Schatten oder Deckkraft versehen - ein Pfad verhält sich wie jede andere Box, und keines dieser Steuerelemente behandelt ihn anders.

Er kommt auch bereits eingefärbt an. Der erste Pfad, den Sie zeichnen, übernimmt Füllung und Strich, die Ihre Marke für einen Pfad vorsieht, danach übernimmt jeder neue Pfad **das, was Sie zuletzt verwendet haben** - Füllung einmal festlegen und weiterzeichnen, statt jede Form nachträglich umzufärben. (In einem Tool, dessen Marke nichts über Pfade sagt, wird ein gezeichneter Pfad in der Farbe umrandet, in der Sie ihn haben entstehen sehen, damit er nie unsichtbar ist.)

**Die Punkte erneut bearbeiten.** Doppelklicken Sie auf die Form (oder verwenden Sie **Punkte bearbeiten** in der Objektleiste), und die Punkte sind wieder da. Ziehen Sie einen Punkt, um ihn zu verschieben, ziehen Sie einen Griff, um ihn neu auszurichten, klicken Sie irgendwo auf die Kurve, um einen Punkt einzufügen, ziehen Sie einen Auswahlrahmen um eine Gruppe von Punkten und drücken Sie Entf, um die ausgewählten zu entfernen. Ein Pfad behält immer mindestens zwei Punkte, Sie können ihn also nicht versehentlich ganz weglöschen.

**Spline-Typ** entscheidet, welche Art Kurve durch Ihre Punkte läuft, und das ist die Wahl, die man verstanden haben sollte:

| Typ | Was er bewirkt |
|---|---|
| **Glatt (auto)** | Die Voreinstellung. Ermittelt die Länge der Griffe selbst, sodass schlichtes Klick-Klick-Klick eine wirklich glatte Kurve ergibt, ganz ohne Zerren an Griffen. Setzen Sie doch einen Griff, legt er die *Richtung* fest, und die Länge bleibt Sache der Kurve. |
| **Bézier-Griffe** | Der klassische Stift. Die Griffe sind die Kontrollpunkte, und das Einfügen eines Punktes verschiebt die Kurve nie. |
| **Durch die Punkte** | Verläuft genau durch jeden gesetzten Punkt, ohne Griffe. |
| **B-Spline** | Fließt nahe an den Punkten vorbei statt durch sie, für eine weichere Form. |
| **Gerade Linien** | Ein Polygonzug. |

Einen bestehenden Pfad auf einen Typ umzustellen, der seine Griffe selbst ermittelt, fragt vorher nach, denn die von Ihnen gesetzten Grifflängen lassen sich nicht wiederherstellen - der Wechsel zu **Bézier-Griffe** ist immer verlustfrei. Mitten im Zeichnen gibt es keine Rückfrage: Der Wechsel greift sofort im Entwurf, und bereits herausgezogene Griffe gehen mit. Bei den Typen, denen ihre Griffe gehören, verändert das Einfügen eines Punktes die Kurve ganz leicht; bei **Bézier-Griffe** nicht.

Jeder Punkt trägt außerdem eine Stetigkeitsregel, erkennbar an seiner Form auf der Zeichenfläche - quadratisch für **Ecke** (Griffe bewegen sich unabhängig), rund für **Glatt** (Griffe bleiben in einer Linie), rund mit Ring für **Symmetrisch** (in einer Linie und gleich lang). Legen Sie sie für beliebige ausgewählte Punkte fest, und die Kurve erfüllt sie sofort wieder.

![Zwei Stiftpfade, direkt aus einem Link gerendert: eine umrandete S-Kurve und ein geschlossener, gefüllter Klecks](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Ein gezeichneter Pfad reist wie alles andere im Link mit, sodass eine von Ihnen gezeichnete Form sich aus einem geteilten Link wieder öffnet und über die CLI identisch rendert. Nichts daran hängt vom Editor ab.

### Formen kombinieren (Pfadoperationen)

Wählen Sie zwei oder mehr Formen aus, klicken Sie mit der **rechten Maustaste** auf die Zeichenfläche (auf Touch: Tippen mit zwei Fingern), und das Menü bietet die Operationen, die Sie aus einem Zeichenprogramm kennen:

- **Vereinigung** führt sie zu einer Form zusammen und behält die Farbgebung der obersten.
- **Subtrahieren** schneidet alles Darüberliegende aus der untersten Form heraus.
- **Schnittmenge** behält nur die Überlappung.
- **Ausschließen** behält alles außer der Überlappung.

Drei weitere arbeiten an einer einzelnen Form: **Strich konturieren…** macht aus einem Strich eine gefüllte Form derselben Kontur (nützlich, wenn eine Strichstärke exakt so bleiben soll, wie sie gezeichnet wurde), **Pfad versetzen…** lässt die Silhouette nach außen wachsen oder, mit einer negativen Zahl, nach innen schrumpfen und **Vereinfachen** baut einen Pfad mit weniger Segmenten bei gleicher Form neu auf.

![Eine Mondsichel und ein Ring mit einem echten Loch, beide durch Subtrahieren entstanden](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Das Ergebnis ist ein neuer Pfad, den Sie mit dem Stift weiterbearbeiten können. Löcher sind echte Löcher - ein Steuerelement **Füllregel** im Strich-Bedienfeld entscheidet, ob sich überlappende Konturen füllen (*non-zero*) oder durchstoßen (*even-odd*).

Zwei Dinge tun diese Operationen bewusst nicht. Sie **verweigern, statt zu zerstören**: Verlangen Sie die Schnittmenge zweier Formen, die sich nicht überlappen, erfahren Sie, dass nichts zu behalten ist, und es ändert sich nichts. Und Text- und Bildboxen haben keine Kontur, mit der sich arbeiten ließe, deshalb bleiben sie unangetastet, statt durch ihren Rahmen angenähert zu werden. Ein kombiniertes Ergebnis wird als schlichte Bézierkurven gespeichert, wie es ein Zeichenprogramm auch tut - der ursprüngliche Spline-Typ überlebt die Operation nicht.

## Zeitleiste (Sequence Studio)

![The timeline with the music clip selected: its strip runs along the bottom with Speed, Fades, Volume, Pan, EQ, Pitch, Normalize volume and the Effect slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dvideo%26_sel%3Dbed&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px!important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip)

**Sequence Studio** fügt der freien Zeichenfläche *Zeit* hinzu. Jede Box kann zu einem Zeitpunkt beginnen, eine bestimmte Länge laufen und ein- und ausblenden, und angeordnet werden sie auf einer Zeitleiste, die unter dem Artboard andockt. Öffnen Sie es, läuft bereits eine Sequenz - eine Titelkarte, ein Clip, eine Endkarte, eine Bauchbinde und ein Musikbett -, sodass das Prinzip sichtbar ist, bevor Sie irgendetwas ändern.

![Die Zeitleiste von Sequence Studio: das Transport-Bedienfeld, das Lineal, eine Overlay-Spur, die magnetische Sequenzreihe mit ihren Clips und Nahtstellen-Chips und der Always-on-Streifen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Es gibt zwei Arten von Zeilen, und der Unterschied ist die ganze Idee:

- Die **Sequenzzeile** ist *magnetisch*. Clips liegen lückenlos hintereinander, und einen davon zu ziehen ordnet den Ablauf neu, statt ein Loch zu hinterlassen. Löschen Sie einen Clip, rücken die übrigen zusammen. Das ist Ihr Rückgrat.
- **Overlay-Spuren** sind frei. Eine Bauchbinde, ein Logo, eine Bildunterschrift - alles, was zu seiner eigenen Zeit über dem Rückgrat schwebt - bekommt eine eigene Spur und einen eigenen Start.
- Darunter sammelt **Immer aktiv** die Boxen ganz ohne Zeitangabe: Kulisse, die schlicht die ganze Zeit über da ist. Das `+` auf einem Chip befördert eine davon auf eine Spur; **Immer aktivieren** schickt sie zurück.

![Die Bearbeitungsbühne: das Artboard im Vordergrund und mittig, die Werkzeugleiste links und das Zoom-HUD in der Ecke](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Wird die Zeitleiste geöffnet, bekommt sie die Tastatur: Leertaste und Pfeiltasten steuern dann den Playhead statt der Seite - und weil sie sich bei einer Komposition mit vorhandener Zeitgebung von selbst öffnet, gilt das ab dem Moment, in dem Sequence Studio lädt.

> **[Der Sequenz-Editor](/info/sequence-editor.html)** geht tiefer auf die vier Dinge ein, die darüber entscheiden, ob sich das Bearbeiten in der Zeit vorhersehbar anfühlt: welchen Clip ein Klick auf die Zeichenfläche bearbeitet, Zwiebelschalen-Schemen der Nachbarclips, der Geltungsbereich des Teilens und das Verbinden, das einen Schnitt rückgängig macht, sowie das Kürzen (samt Tastaturbefehlen). Drücken Sie `?` bei fokussierter Zeitleiste für die Übersicht der Kurzbefehle.

**Bearbeiten.** Ziehen Sie die Mitte eines Clips, um ihn zu verschieben oder umzusortieren, ziehen Sie wenige Pixel neben einem der Enden, um ihn zu kürzen, und drücken Sie **Am Playhead teilen** (oder `S`), um einen Clip in zwei zu schneiden. Teilen braucht einen Clip mit einer echten **Länge** und den Playhead ein Stück weit darin, ein Clip mit offenem Ende (etwa das Musikbett) lässt sich also nicht teilen. **An Kanten einrasten** ist voreingestellt aktiv und rastet an Clipkanten, am Playhead und an ganzen Sekunden ein; Alt hebt das auf. Jedes Ziehen ist ein einziger Schritt beim Rückgängigmachen, und die Vorschau während des Ziehens rechnet genauso wie das Festschreiben, sodass Sie beim Ziehen sehen, was Sie bekommen.

Wählen Sie einen Clip aus, und der Inspektor bietet dieselben Änderungen als Zahlen: **Länge**, **Anfang kürzen** (wie weit im Quellmaterial er beginnt), **Geschwindigkeit** als feste Vielfache von ×0,25 bis ×4, **Einblenden** / **Ausblenden** samt ihren Dauern und **Clip stummschalten**. Ein Clip in der magnetischen Zeile hat absichtlich kein Feld **Start** - die Zeile besitzt die Reihenfolge, verschoben wird also per Ziehen.

**Übergänge** sind Voreinstellungen, keine Keyframes: Fade, Pop, Grow, Rise, Drop, die vier Slides, Zoom in und Zoom out, Tilt, Swoop, Spin, Drift oder **Schnitt (keine Animation)**. Die Distanzen skalieren mit dem Objekt, sodass dieselbe Voreinstellung auf einer bildfüllenden Karte und auf einem kleinen Badge gleichermaßen stimmig wirkt. Zwischen zwei benachbarten Clips der Sequenzzeile sitzt ein **Nahtstellen-Chip**: Klicken Sie ihn an und wählen Sie **Schnitt** oder **Überblendung**, was sofort greift und den Chip schließt. Öffnen Sie denselben Chip erneut, um die **Länge (ms)** zu ändern, und drücken Sie **Fertig**. Eine Überblendung wird als Ausblenden des einen und Einblenden des nächsten Clips gespeichert, und der Export leitet die eigentliche Blende aus diesem Paar ab - deshalb sieht eine Überblendung in der Vorschau wie zwei Blenden aus und in der Datei wie eine echte Übergabe.

**Ton.** Fügen Sie einen **Audio**-Clip hinzu, und er lebt auf der Zeitleiste wie jeder andere Clip: Wellenform, Kürzen, Stummschalten. (Das erzeugte Bett, das die Standardsitzung mitbringt, ist die eine Ausnahme - es wird erst beim Export synthetisiert, sein Balken bleibt also schlicht und still, bis Sie rendern.) Drücken Sie auf das Mikrofon, um **ein Voiceover aufzunehmen**, direkt auf die Zeitleiste, mit Einzählung und Pegelanzeige; die Aufnahme wird als Ihr eigenes Asset an der Stelle gespeichert, an der Sie begonnen haben. Drücken Sie auf die Kamera daneben, um auf die gleiche Weise **ein Video aufzunehmen**: Die Aufnahme wird während der Aufzeichnung auf die Exportgröße des Artboards zugeschnitten, sodass die kleine Selbstansicht genau zeigt, was am Playhead bildfüllend in die Sequenz gelangt - die Art, wie Sie den Clip einer Kollegin oder eines Kollegen über einen geteilten Link holen. Musik, Sprache und der eigene Ton eines Clips landen alle in der exportierten Mischung. (Die **Audiospur** im Exportfeld ist etwas anderes: ein Bett, das unter den gesamten Clip gelegt wird, mit Blende und Ducking. Beides existiert nebeneinander.)

**Rendern.** Ein Bewegtbild-Export ist eine **deterministische Komposition**, keine Bildschirmaufnahme - jedes Einzelbild wird zu einem exakten Zeitpunkt dekodiert, gezeichnet und kodiert, die Datei hängt also nicht davon ab, ob Ihr Rechner mitkommt, und bei MP4 oder WebM gibt es praktisch keine Obergrenze an Einzelbildern. Die Länge der Zeitleiste bestimmt die Dauer, sofern Sie keine eingeben. Content Credentials werden wie bei jedem anderen Export eingeprägt. Ein Standbild-Export liefert das Einzelbild am Playhead oder, über das Feld **Einzelbilder** neben der Ausgabegröße, gleich einen ganzen Kontaktbogen - siehe [Exportieren](/info/exporting.html#stills-from-a-timed-composition).

Ein paar Grenzen, die Sie im Blick behalten sollten: Eine Sequenz ist auf eine Stunde begrenzt, GIF und animiertes PNG puffern ihre Einzelbilder und bleiben deshalb kurz, Ton ist bei einem Clip stumm, dessen Geschwindigkeit nicht ×1 ist (Time-Stretching gibt es noch nicht), und **Live aufnehmen** ist hier ausgeblendet, weil die Komposition der bessere Weg ist.

**Über Voreinstellungen hinaus: Keyframes, Tiefe und eine Kamera.** Ein Übergang animiert einen Clip bei Ankunft und Abgang. Um eine Box *innerhalb* eines Clips zu posieren - sie treiben zu lassen, sie ein- und auszublenden, zu unschärfen, sie von der Seite abzuheben und wieder abzusetzen - fügen Sie Keyframes hinzu: Wählen Sie den Clip aus, drücken Sie **+Keyframe** (die Raute in der Werkzeuggruppe der Zeitleiste, die Raute in der Objektleiste der Leinwand oder `K`), und die Position des Playheads entscheidet, welche Pose Ihre nächste Bearbeitung schreibt. Dasselbe Keyframe-System gibt jeder zeitbasierten Komposition eine **Kamera**, die heranfährt, schwenkt und den Fokus zieht und eine flache SVG in einen Stapel von Ebenen verwandelt, zwischen denen Sie fliegen können. **[Animieren](/info/animating.html)** ist die vollständige Anleitung.

Das Tool Design hat dieselbe Zeitleiste, Sie können ein Layout also mit Zeit versehen, ohne das Tool zu wechseln, und es exportiert ebenfalls Bewegtbild.

## Präsentieren

![The inspector's Document section: Voice, Blend with, Speed, Lead-in, Tail and Show captions when presenting](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Ein Design-Dokument aus **Artboards** ist bereits eine Präsentation. Öffnen Sie das **Lolly-Menü** in der Werkzeugleiste und wählen Sie **Präsentieren** - die letzte Zeile -, und jedes Artboard wird zu einer Folie im Vollbild, in der Reihenfolge, in der die Artboards auf der Zeichenfläche liegen. Die Präsentation läuft auf einer Kopie der gerenderten Artboards, der Editor darunter wird also nie angefasst, und beim Verlassen sind Sie genau dort, wo Sie waren.

- **Weiter** mit **Leertaste**, `→`, **Bild ab** oder einem Klick auf den Streifen am rechten Bildschirmrand; zurück mit `←`, **Bild auf** oder dem Streifen am linken Rand. **Pos1** und **Ende** springen zur ersten und letzten Folie. Eine kleine Steuerleiste blendet sich ein, sobald Sie den Zeiger bewegen, und verbirgt sich wieder, sobald Sie aufhören.
- **Übersicht** (`O` oder die Rasterschaltfläche) legt alle Arbeitsflächen auf einmal in der Anordnung aus, die Sie ihnen auf der Leinwand gegeben haben; klicken Sie eine an, um sie zu öffnen.
- **Schritte einblenden.** Klicken Sie mit der rechten Maustaste auf eine Box und wählen Sie **Bei Schritt 1 einblenden**, **2** oder **3** statt der Standardeinstellung **Immer sichtbar**. Diese Box wartet dann, bis Sie zu ihrem Schritt weitergehen, sodass eine Folie in Teilen erscheinen kann; Boxen mit derselben Nummer erscheinen gemeinsam.
- **Referentenansicht** (`S`) öffnet ein zweites Fenster mit der aktuellen Folie, der nächsten, Ihren Notizen zu dieser Folie und einer laufenden Uhr. Blockiert der Browser das Pop-up, weicht sie auf ein Panel über der Präsentation aus. Notizen werden pro Arbeitsfläche festgelegt und erscheinen nie auf der Folie selbst.
- `B` hält einen schwarzen Bildschirm (jede Taste bringt die Folie zurück), `F` kehrt zum Vollbild zurück, und **Esc** schält jeweils eine Ebene ab: Übersicht zurück zur Präsentation, Präsentation zurück zum Editor.
- **Kiosk.** Geben Sie einer Arbeitsfläche eine **Länge**, und die Präsentation hält dort so lange, bevor sie sich hinter einem dünnen Fortschrittsbalken selbst weiterschaltet; `K` (oder die Pause-Schaltfläche, die erst erscheint, sobald etwas eine Länge hat) stoppt und startet das neu. Fügen Sie dem Link `kiosk` hinzu, und die Präsentation läuft am Ende im Kreis, was sie zur Signage macht.

Die Präsentation ist auch ein Link. `?present` öffnet direkt in ihr, `s=` benennt die Folie - eine Position, eine Artboard-ID oder `id.step` für einen Einblendschritt -, und die Adresse aktualisiert sich beim Blättern, sodass Sie genau die Folie verschicken, auf der Sie stehen. Für Tool-Autoren: Diese Parameter sind auf der Seite [URL-Modus](/info/url-mode.html#reserved-parameters) dokumentiert.

## Auf einem Smartphone

Auf schmalen Bildschirmen fließt das Layout in eine einzige Spalte um:

- Die **Steuerelemente werden zu einem Bedienfeld** oben, mit einem **Ziehgriff** an der Unterkante. Ziehen Sie am Griff, um die Größe zu ändern - es rastet bei **Peek / Half / Full** ein - oder **tippen** Sie auf den Griff, um zwischen eingeklappt ↔ ausgeklappt umzuschalten. Die Vorschau füllt den Bereich darunter und bleibt während des Bearbeitens sichtbar.
- Eine schwebende Schaltfläche **Export** öffnet das Exportfeld - alle Steuerelemente für Format, Größe, Kopieren, Speichern und Herunterladen an einem Ort. Zum Schließen tippen Sie auf den Hintergrund.

![Ein Tool auf einem schmalen Smartphone-Bildschirm - oben die Steuerelemente als Bedienfeld, darunter die erzeugte Palette in der Vorschau und die Render-Pille schwebend am unteren Rand](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Steuerelemente (Eingaben)

Tools legen nur die Eingaben offen, die variieren sollen - alles andere (Farben, Layout, Typografie, Logik) ist vom Tool-Autor festgezurrt, sodass alles, was Sie erstellen, den Regeln des Autors entspricht. Zu den Eingaben zählen Text, Schieberegler, Farbwähler, Auswahlfelder, Datumsangaben, Bildauswahl und sich wiederholende Zeilengruppen. Manche sind in einklappbaren Abschnitten gruppiert.

![Die Steuerelemente eines Tools - ein Textfeld, Farbschaltflächen und ein Schieberegler, mehr hat der Autor nicht freigegeben](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Zurücksetzen:** *Änderungen verwerfen* setzt jede Eingabe auf ihre Standardwerte zurück.

### Rückgängig und Wiederholen

**Cmd/Strg-Z** geht einen Schritt zurück, **Cmd/Strg-Umschalt-Z** (oder **Cmd/Strg-Y**) wieder vorwärts. Dasselbe Paar sitzt als Schaltflächen **Rückgängig** und **Wiederholen** in der Zeile über den Steuerelementen - auf der freien Zeichenfläche stattdessen in der Werkzeugleiste - und beide sind ausgegraut, solange es nichts zurückzunehmen gibt. Jeder Schritt sagt, was er war: Nehmen Sie eine Farbe zurück, nennt eine kleine Meldung die soeben wiederhergestellte Eingabe und enthält eine Schaltfläche **Wiederholen** für den Weg zurück.

- **Ein Ziehen ist ein Schritt.** Wiederholte Änderungen am selben Steuerelement innerhalb einer halben Sekunde werden zusammengefasst, sodass ein Schieberegler über seinen ganzen Bereich ein einziges Rückgängig ist und nicht zweihundert.
- **Die letzten 100 Schritte bleiben erhalten** - ältere fallen hinten heraus. Eine frische Änderung nach einem Rückgängig löscht den Vorwärtsstapel, wie überall sonst auch.
- **Solange Ihr Cursor in einem Textfeld steht**, gehört Cmd/Strg-Z dem Feld selbst, Zeichen für Zeichen. Lolly übernimmt für die Steuerelemente, die kein sinnvolles eigenes Rückgängig haben: Schieberegler, Auswahlfelder, Farben und Schalter.
- **Eine Datei auszuwählen** in einer **Datei**-Eingabe ist kein Schritt - diese Bytes werden nur für die Sitzung gehalten, es gäbe also nichts zurückzulegen.

In einer Live-[Zusammenarbeit](/info/collaborate.html) bleibt der Verlauf ausschließlich Ihrer. Eine vom anderen Gerät eintreffende Änderung landet nie auf Ihrem Stapel, daher kann Rückgängig immer nur etwas zurücknehmen, das Sie selbst getan haben.

## Ihre Angaben & Ihr Porträtfoto

**Profil** (oben rechts in der Galerie) enthält Ihren Namen, Ihre Kontaktdaten und ein optionales **Porträtfoto**. Tools, die nach diesen Feldern fragen, füllen sie automatisch vor - einmal gesetzt, füllen sich Ihre E-Mail-Signatur, Lockups und Badges von selbst. Jedes Feld können Sie pro Sitzung weiterhin überschreiben. Mit **Meine Daten zum Erstellen verwenden** stimmen Sie zu, dass Ihre Angaben als Urheber in dem mitreisen, was Sie exportieren.

Ihr Porträtfoto und Ihre Angaben existieren **nur auf diesem Gerät**. Ein Profil kann mehr sein als nur Sie selbst - ein Team oder eine Rolle, in die Sie hin und wieder schlüpfen. Das vollständige Bild, einschließlich mehrerer Profile, finden Sie unter **[Profile](/info/profile.html)**.

## Speichern & Fortsetzen

Klicken Sie auf **Speichern**, um die aktuellen Eingaben als Sitzung für dieses Tool abzulegen. Sie können pro Tool mehrere benannte Sitzungen führen; die Schaltfläche **Weiter** jedes Tools öffnet Ihre jüngste erneut, und die **Verlaufsschaltfläche** (oben rechts, neben Ihrem Profil) listet jede gespeicherte Sitzung über alle Tools hinweg auf. Sitzungen sind gerätelokal. Um sie zu ordnen, öffnen Sie **Projekte** (unten).

![Die zweigeteilte Render-Pille - ein Pfeil nach oben, der das Exportfeld öffnet, und ein Haken, der die Sitzung an Ort und Stelle speichert](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projekte

**Projekte** - öffnen Sie es über den Tab **Projekte** neben **Tools** oder über **Profil → Speicher → In Projekten organisieren** - ist ein Zuhause für alles, was Sie gespeichert haben, und funktioniert wie ein Dateimanager:

![Projekte - gespeicherte Sitzungen, geordnet in verschachtelbaren Ordnern](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)

- <!--i:folder--> **Verschachtelbare Ordner.** Gruppieren Sie gespeicherte Sitzungen in Ordnern und Ordner in Ordnern, so tief Sie mögen. Erstellen Sie einen Ordner, benennen Sie ihn um oder ziehen Sie eine Kachel auf einen anderen Ordner, um sie zu verschieben; eine Brotkrumenleiste führt Sie wieder nach oben. Ein stets vorhandener Ordner **Nicht kategorisiert** hält alles, was noch nicht abgelegt ist.
- <!--i:clock--> **Sortieren Sie nach Ihrem Kopf.** **Ansehen & sortieren** bietet **Name**, **Hinzugefügt am**, **Zuletzt geändert** (die Voreinstellung) und, innerhalb eines Ordners, **Nach Tool**. Ordner stehen immer vorn, gleich welche Sortierung aktiv ist - sortiert werden nur die Sitzungen und Ordner innerhalb ihrer eigenen Gruppe.
- <!--i:document--> **Neue Arbeit direkt ablegen.** **Neues Asset** („Neue Kreation starten“ auf der obersten Ebene, „Zu *Ordner* hinzufügen“ innerhalb eines Ordners) öffnet ein Tool und legt dessen erste Speicherung automatisch in diesem Ordner ab.
- <!--i:checklist--> **Mehrfachauswahl (Desktop).** Setzen Sie das Häkchen einer Kachel, ziehen Sie ein Auswahlrechteck über leere Fläche oder nutzen Sie **Umschalt/Cmd-Klick**; ein **Rechtsklick** auf eine Kachel öffnet ihr Kontextmenü. Wenden Sie eine Aktion dann auf die ganze Auswahl auf einmal an - dieselbe Geste und dieselbe schwebende Aktionsleiste funktionieren auch in der Tools-Galerie, in Utilities, im Katalog und in Projekten, nicht nur hier.
- <!--i:download--> **Einen ganzen Ordner oder eine Auswahl rendern.** **Ordner rendern** exportiert jede gespeicherte Sitzung in einem Ordner - einschließlich seiner Unterordner - als eine verschachtelte `.zip`. **Auswahl rendern** tut dasselbe für jede Mehrfachauswahl, und eine einzelne Sitzung rendert direkt in ihre eigene Datei. Kein Batch/Pro nötig.
- <!--i:link--> **Direkt zur gespeicherten Arbeit eines Tools springen.** Haken Sie in der Tools-Galerie ein oder mehrere Tools an und wählen Sie **Sitzungen ansehen** in der Auswahlleiste - Projekte öffnet sich und zeigt nur die mit diesen Tools erstellten Sitzungen, mit einem **Leeren**, das zurück zur vollen Ansicht führt.
- <!--i:link--> **Eine gespeicherte Sitzung teilen.** Rechtsklick auf eine Sitzung → **Link teilen** kopiert einen Link, der sie mit genau denselben Eingaben wieder öffnet (der vollständige Teilen-Dialog - siehe unten).

![Das geöffnete Popover Ansehen & sortieren in Projekten, mit einer Zeile für das Farbschema, einer Wahl der Ansicht zwischen Vorschau oder Liste und Name, Hinzugefügt am und Zuletzt geändert unter Sortieren](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
Also: the popover is not sort-only. openViewOpts() writes a theme segment, a
"View" pair (Preview / List) and a sound segment around the Sort rows, so the
alt text names them - do not re-caption this as "the sort menu".
-->

**Was die Auswahlleiste anbietet**, unterscheidet sich je nach Ansicht ein wenig, denn nicht jede Aktion ergibt überall Sinn:

- **Tools / Utilities:** Favorit (oder Favorit entfernen), Ausblenden (oder Einblenden), Offline verfügbar (oder Aus Offline entfernen), **Sitzungen ansehen** (der oben beschriebene Sprung) und Link kopieren, wenn genau eine Karte ausgewählt ist.
- **Katalog:** Favorit und Ausblenden gelten für jede Auswahl; Duplizieren, Herunterladen und Löschen erscheinen erst, wenn jedes ausgewählte Element einer Ihrer eigenen Uploads ist - ein gemeinsam genutztes Design-System-Asset ist ein dauerhafter Vertrag, diese drei bleiben ihm also auch in der Mehrfachauswahl verwehrt.
- **Projekte:** **Auswahl rendern**, **Verschieben nach…**, **Neuer Ordner**, **Löschen**, **Gemeinsam bearbeiten**, wenn die Auswahl zwischen zwei und acht Sitzungen einzelner Tools umfasst (sie öffnen sich nebeneinander unter einer gemeinsamen Seitenleiste), und **Als Tabelle bearbeiten**, das die ganze Auswahl stattdessen als Zeilen im Batch-Raster öffnet. Das hat **keine Größenbegrenzung** und schert sich nicht darum, ob die Sitzungen vom selben Tool stammen, es ist also die Notausfahrt, wenn eine Auswahl größer oder gemischter ist als die zwei bis acht von Gemeinsam bearbeiten.

> Eine Falle bei den Bezeichnungen: **Sitzungen ansehen** gibt es erst, wenn etwas *ausgewählt* ist. Ein Rechtsklick auf eine einzelne, nicht ausgewählte Karte bietet stattdessen **N gespeicherte Sitzungen**, was den Verlaufsdialog dieses Tools öffnet, statt zu Projekten zu wechseln.

![Zwei angehakte Tool-Karten in der Tools-Galerie, mit der schwebenden Auswahlleiste, die 2 ausgewählt anzeigt und Offline verfügbar, Sitzungen anzeigen, Favorit und Ausblenden anbietet](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot above already carries; revisit if the pipeline gains a
storage-seeding hook.
-->


## Ihre Arbeit teilen

Ein Design geht auf zwei Wegen hinaus: als Link oder als Datei. Der Teilen-Dialog bietet beides. Öffnen Sie ihn mit **Teilen** in den Exportsteuerelementen; **Link teilen** bei einer gespeicherten Sitzung in Projekten öffnet denselben Dialog für diese Sitzung.

### Der Link

Jede Eingabe wird in der Seiten-URL festgehalten, ein Link *ist* also das Design. Oben im Dialog steht der kopierbereite Link, darunter zwei eingeklappte Abschnitte.

- **Link-Optionen** enthält **Kürzester Link** (ein großes Design ergibt eine lange URL, deshalb packt dies den ganzen Zustand in ein kompaktes Token und zeigt Ihnen die Ersparnis in Zeichen; die lesbare Form bleibt immer verfügbar), **Diesen Link mit Passwort schützen** (AES-256 über den gesamten Link, das Passwort steht nie darin) und **Diese Tool-Version festhalten** - das Flag `_v`, das den Link an die Tool-Version bindet, die Sie gerade vor sich haben, damit eine spätere Aktualisierung nicht ändern kann, was er rendert.
- **Link-Verhalten** ist das, was beim Öffnen durch den Empfänger passiert: Vollbild, bereits ausgeklapptes Exportfeld, Herunterladen beim Öffnen mit `&export` oder Kopieren in die Zwischenablage mit `&copy`.

Geben Sie den Link an Kolleginnen und Kollegen weiter, setzen Sie ein Lesezeichen oder checken Sie ihn ein. (Vollständige Details: [URL-Modus](/info/url-mode.html).)

**Manche Tools machen den Link zum ganzen Produkt.** Jump Page sammelt Ihre Links auf einer Seite zum Weitergeben - ein Bio-Link, ein Konferenzvortrag, eine Schaufensterseite. Es gibt nichts zu hosten und kein Konto dahinter: Die Seite ist der Link, daher öffnet sie sich so schnell, wie die URL reist. Im Editor sehen Sie die fertige Seite neben den Feldern; wer den Link als Besucherin oder Besucher öffnet, bekommt sie in voller Breite, eine Szene pro Link beim Scrollen.

![Jump Page im Editor - die Überschrift, drei Link-Szenen, jede mit eigener Tönung, und eine Made-with-Lolly-Fußzeile, als eine Seite auf der Leinwand angeordnet](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Der Dialog sagt, was ein Link nicht tragen kann.** Drei Dinge passen nicht in eine URL: ein Bild oder eine Datei, die Sie von diesem Gerät hinzugefügt haben, ein sehr langer Textwert oder eine sehr große Liste. Jedes davon wird beim Bauen des Links gezählt. Musste etwas wegfallen, benennt der Dialog es und verweist Sie auf die Datei weiter unten, statt Ihnen einen Link zu geben, der ohne das Bild aufgeht. Ein Link, der bloß *lang* ist, bekommt einen milderen Hinweis samt Zeichenzahl, denn Länge lässt sich durch Packen noch retten.

### Die .lolly-Datei

**.lolly herunterladen** im Teilen-Dialog des Tools, in dem Sie gerade arbeiten, schreibt dasselbe Design als Datei. Sie trägt die gespeicherte Sitzung samt der Bilder und Dateien, die Sie von Ihrem Gerät hinzugefügt haben. Auch die Katalog-Grafiken, auf die das Design zurückgreift, reisen darin mit, sodass die Datei auf einem Rechner vollständig aufgeht, der Ihre Marke nie gesehen hat. Wo Ihr Gerät ein Teilen-Menü hat, reicht **Senden an…** die Datei direkt dorthin weiter (AirDrop, das Teilen unter Android), statt sie auf die Festplatte zu schreiben.

Eine `.lolly` ist ein gewöhnliches Zip. Benennen Sie sie in `.zip` um und öffnen Sie sie: Ihre eigenen Bilder liegen unter `assets/uploads/`, Katalog-Grafiken unter `assets/catalog/`, jeweils mit echtem Namen und echter Endung, `manifest.json` listet jede einzelne auf, und eine README ganz oben sagt, was die Datei ist.

Drei Dinge entscheiden Sie, bevor sie hinausgeht:

- **Ob Ihr Name enthalten ist.** Ihr Name, Ihre E-Mail und Ihre Organisation werden nur dann in die Datei geschrieben, wenn **Use my details to create** in Ihrem Profil aktiviert ist. Ist es ausgeschaltet, vermerkt die Datei nur, dass und wann sie mit Lolly erstellt wurde - nichts über Sie.
- **Ob lizenzierte Grafik enthalten ist.** Lizenzierte und markengesperrte Assets werden standardmäßig zurückgehalten. Verwendet das Design welche, nennt der Dialog die Anzahl und bietet zwei Schaltflächen - *Download without them* oder *Include and download* - denn deren Einschluss übergibt die eigentlichen Dateien an jeden, der die `.lolly` öffnet.
- **Ob das Tool enthalten ist.** **Include the tool** packt die eigenen Dateien des Tools zusammen mit dem Design, damit es auch auf einem Gerät ohne dieses Tool geöffnet werden kann. Die Option ist angehakt bei einem benutzerdefinierten Tool - einem Fork oder einem privaten Marken-Tool, das Ihr Empfänger vermutlich nicht hat - und nicht angehakt bei einem Tool, das der signierte Katalog listet, da dessen Kopie aus derselben Quelle stammt. (Bei einem Build ohne signierten Katalog zählt jedes Tool als benutzerdefiniert, und das Kästchen startet angehakt.)

**Eine Datei öffnen.** Legen Sie eine `.lolly`-Datei auf der App ab: Die Assets gehen in Ihre Bibliothek, die Sitzung geht zu Projekte, und das Tool öffnet sie. Nichts von Ihnen wird überschrieben: Die Sitzung kommt als neuer gespeicherter Slot an, während ein bereits auf diesem Gerät vorhandenes Asset per Prüfsumme abgeglichen und wiederverwendet statt dupliziert wird. Jeder Teil wird beim Import gegen die eigenen Prüfsummen der Datei geprüft, sodass eine beim Transport beschädigte Kopie abgelehnt statt halb importiert wird.

Trägt die Datei ein Tool, das Sie nicht haben, fragt Lolly nach, bevor dieses Tool laufen darf: **Diesem Tool vertrauen?** nennt es und seinen Autor und sagt klar, dass das Öffnen den Code des Tools auf Ihrem Gerät ausführt, mit **Vertrauen & installieren** als Weg hindurch. Lehnen Sie ab, wird die geteilte Arbeit dennoch in Ihren Projekten gespeichert und wartet dort auf den Tag, an dem Sie das Tool hinzufügen. (Eine Art Tool lässt sich noch nicht nachträglich installieren - eines, dessen Code als Modul ausgeliefert wird - und wird auf dieselbe Weise abgewiesen.)

Ein Link und eine Datei übergeben beide eine Momentaufnahme. Wenn Sie *gleichzeitig* mit jemand anderem an derselben Sitzung arbeiten wollen - zwei Geräte, kein Server, kein Internet nötig, solange Sie im selben Netz sind -, siehe [Gemeinsam arbeiten](/info/collaborate.html).

## Live-Kamera (bewegungsreaktive Tools)

Jeder Foto-**Filter** - Halftone, Scanline, Posterize, Voronoi-Zellen, Farbbehandlung, Pixel-Stretch und Imperfections - zeigt eine Schaltfläche **Live gehen**, sofern eine Kamera verfügbar ist. Schalten Sie sie ein, und der Effekt folgt Ihrer Webcam Bild für Bild, reagiert also auf Bewegung; das Ergebnis können Sie als GIF, WebM oder MP4 aufzeichnen. Die Einzelbilder werden **auf Ihrem Gerät** gelesen und verarbeitet und verlassen es nie, und die Kamera wird freigegeben, sobald Sie stoppen oder das Tool verlassen. (Jede Bildauswahl hat außerdem **Foto aufnehmen**, um ein einzelnes Bild als geräteinternes Bild zu erfassen.)

## Meine Bilder

Wenn ein Tool Sie ein Bild von Ihrem Gerät hinzufügen lässt, bleibt es genau so erhalten, wie es angekommen ist - ein Content Credential darauf lässt sich also weiterhin prüfen - und wird in Ihrer persönlichen Bibliothek **Meine Bilder** gespeichert (unter **Profil → Speicher**). Nur bei einer wirklich riesigen Datei wird gefragt, ob sie behalten oder verkleinert werden soll. Verwenden Sie sie in jedem Tool wieder. Um EXIF/GPS beim Hereinkommen zu entfernen, aktivieren Sie in Ihrem Profil **Metadaten aus Uploads entfernen**. Es gibt keine Obergrenze: Die Bibliothek ist vollständig lokal und nur durch den Speicher Ihres Geräts begrenzt - verwalten oder löschen Sie Bilder dort.

## Der Katalog - Ihre Asset-Bibliothek

Der **Katalog** (`#/c` oder das Segment **Katalog** im Umschalter Projekte · Tools · Utilities · Katalog am Kopf jeder Übersichtsansicht) versammelt alles, worauf Ihre Tools zurückgreifen können - Markenlogos, Bilder, Audio und Bewegtbild, nach Art gruppiert - und hier liegen auch Ihre **eigenen kreativen Dateien**. Kein Server, keine Verwaltungskonsole, kein Pull Request: alles auf Ihrem Gerät.

![Der Katalog - Marken-Assets, Farbmuster und Schriften sowie Ihre eigenen Uploads](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=catalogue)

- <!--i:upload--> **Bringen Sie Ihre Dateien mit.** Ziehen Sie ein beliebiges Bild, eine SVG-Datei, einen Audioclip, ein Video, ein Lottie, ein PDF oder eine PowerPoint-Präsentation auf den Upload-Bereich - oder klicken Sie, um auszuwählen - und es landet sofort in Ihrem Katalog, bereit in der Asset-Auswahl jedes Tools. Ein mehrseitiges PDF oder eine `.pptx`-Datei fragt, welche Seiten oder Folien behalten werden sollen - jede wird zu einem SVG-Asset. Nehmen Sie so viel auf, wie Sie möchten; es verlässt niemals Ihr Gerät.
- <!--i:star--> **Favorisieren Sie, wonach Sie oft greifen.** ★ ein Asset (oder eine Markenfarbe), und es wird oben in jeder Auswahl angepinnt, sodass Ihr Standardlogo oder Ihre Standardfarbe einen Klick entfernt ist.
- <!--i:folder--> **Aufräumen.** Ordnen Sie ein Asset einer anderen Gruppe zu, blenden Sie ein geteiltes Markenasset aus, das Sie nicht nutzen (mit **Ausgeblendete anzeigen**, um es zurückzuholen), oder löschen Sie Ihre eigenen Uploads ganz. Dieselbe Mehrfachauswahl-Geste und schwebende Aktionsleiste wie bei Projekte funktionieren auch hier, sodass all das auch auf eine ganze Auswahl auf einmal angewendet werden kann.
- <!--i:layers--> **Ein Video von seinem Hintergrund lösen.** Öffnen Sie die Details eines Videos oder klicken Sie mit der rechten Maustaste auf seine Karte in einer beliebigen Asset-Auswahl, und wählen Sie **Hintergrund entfernen…**, um eine transparente Alternative zu speichern - ein animiertes WebP oder PNG mit echtem Alphakanal. Wählen Sie eine **Methode**: Ein **Modell auf dem Gerät** schneidet ein Motiv aus einer belebten Szene aus, oder ein **Farbschlüssel** stanzt einen gleichmäßig beleuchteten, flachen Hintergrund wie einen Greenscreen oder eine schlichte Wand heraus, mit **Toleranz**, **Weichheit** und **Farbsaum entfernen**, um die Kante zu justieren. Der Farbschlüssel braucht keinen Modell-Download und kein Netzwerk, daher wird **Hintergrund entfernen** bei jedem Video angeboten und ist bei sauberem Filmmaterial oft cleaner. Eine **Auflösung**-Einstellung (360, 480, 720 oder 1080p, nie über die Quelle hinaus) tauscht Detail gegen eine kleinere, schnellere Datei. Es läuft als Hintergrundjob auf Ihrem Gerät. Der fertige Ausschnitt wird neben dem Original als eigenes Asset gespeichert, und das Content Credential des Quellvideos reist als Zutat mit. (Siehe [Einmal erzeugt, gleich gerendert](/info/ai-features.html), warum das Entfernen eines Hintergrunds eine reine Bearbeitung bleibt.)

### Nehmen Sie Palette und Schriften überallhin mit

Das Bedienfeld **Farbmuster** im Katalog zeigt nicht nur an - klicken Sie eine Farbe an, um sie zu kopieren, oder **laden Sie die ganze Markenpalette herunter**, in dem Format, das Ihr anderes Programm spricht:

- <!--i:code--> **Design Tokens (JSON)**, **CSS-Variablen** oder **CSS-Klassen** - die Marke direkt in ein Stylesheet oder einen Build geben;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - in Illustrator oder Photoshop laden;
- <!--i:pentool--> **GIMP-Palette (.gpl)** - für GIMP oder Inkscape.

![Das Bedienfeld Farbmuster - oben die fünf Schaltflächen zum Herunterladen der Palette, darunter jede Markenfarbe als kopierbarer Chip](/t/url-shot?url=%2F%23%2Fc%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Das Bedienfeld **Schriften** listet Ihre Markenschriften mit einem **Download** daneben, zum lokalen Installieren oder zur Weitergabe an eine Druckerei. (Der Farbenraum im [Brand Studio](/info/brand-studio.html) bietet denselben Palettendownload.)

Assets sind die eine Hälfte des offenen Selbermach-Wegs; die andere ist, **eigene Tools zu bauen** - auf der freien Zeichenfläche (Design, oben beschrieben) bauen Sie eines visuell, ganz ohne Code.

## Ton & Barrierefreiheit

Lolly möchte für alle angenehm zu bedienen sein. Die Oberfläche lässt sich per Tastatur bedienen, eigene Steuerelemente tragen ordentliche Beschriftungen für Screenreader, und die Live-Vorschau jedes Tools wird als ein einzelnes beschriftetes Bild ausgegeben, das beschreibt, was gerade entsteht.

Eine sanfte Schicht **unterstützender Klänge** bestätigt, was Sie tun - das Ankommen in der Galerie, eine gültige oder ungültige Prüfung der Content Credentials, das Schließen eines Bedienfelds, den Wechsel eines Filters. Sie ist **standardmäßig aus**: Schalten Sie **Ton** überall dort ein, wo der Schalter erscheint (im Optionen-Popover jeder Ansicht oder unter **Profil**), und die Wahl wird gemerkt.

Vier zuschaltbare Komforteinstellungen liegen unter **Profil → Barrierefreiheit**: **Bewegung reduzieren** (nimmt der App ihre Übergänge und Verzierungen), **Bunte Vorschauen ausblenden** (ruhige Galeriekarten aus Symbol und Text sowie zurückhaltendere Projektminiaturen), **Hoher Kontrast** (kräftigere Rahmen, Texte und Fokusringe) und **Großer Text** (größere App-Schrift - Beschriftungen, Menüs, Text auf Schaltflächen). Alle vier beruhigen die App *rund um* Ihre Arbeit: Sie greifen nie in eine Tool-Zeichenfläche hinein und ändern kein Pixel dessen, was Sie exportieren, und jede ist aus, bis Sie sie einschalten. Alle Einzelheiten unter [Ihr Profil → Barrierefreiheit](/info/profile.html#accessibility).

Neben dem Schalter Ton steht der **Neurospicy Mode** - ein optionaler, beruhigender Fokus-Track, der im Hintergrund leise läuft, während Sie arbeiten. Beim Einschalten öffnet sich in der unteren Ecke ein kleines **Player-Dock**, das Ihnen durch die App folgt; darin können Sie einen Titel suchen und auswählen, vor- und zurückspringen, die Lautstärke einstellen und es minimieren oder schließen. Die Titelliste umfasst einige Kategorien - prozedurale *Lolly Sings*-Stücke, ambiente Loops und Beats, Ihre eigenen hochgeladenen Audiodateien und eine Handvoll **Radiosender** aus dem Internet (die brauchen eine Verbindung; alles andere läuft offline). Er ist **standardmäßig aus** und wird, wie Ton, über Sitzungen und Geräte hinweg gemerkt. Schalten Sie Ton aus, verstummt auch der Fokus-Track.

## Speicher & Datenschutz

Alles wird in der lokalen Datenbank Ihres Browsers gespeichert (IndexedDB): Ihr Profil, gespeicherte Sitzungen, hochgeladene Bilder und ein Zwischenspeicher heruntergeladener Katalog-Inhalte. **Profil → Speicher** zeigt die Belegung und erlaubt Ihnen:

- <!--i:box--> **Cache leeren** - heruntergeladene Katalog-Inhalte verwerfen (werden beim nächsten Laden neu synchronisiert).
- <!--i:trash--> **Alle meine Daten löschen** - Profil, Sitzungen und Bilder auslöschen. *Kann nicht rückgängig gemacht werden.*

![Die Speicherkarte auf einem schmalen Smartphone-Bildschirm: jede Kategorie der Daten auf dem Gerät benannt, unten die Schaltfläche Alle meine Daten löschen](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Nichts von diesen lokalen Daten wird irgendwohin übertragen - keine Telemetrie, kein Rendern in der Cloud. Die vollständige Liste dessen, was die App je abruft oder sendet, steht in der [Datenschutzerklärung](/info/privacy.html), und [Server-Oberfläche](/info/server-surface.html) verzeichnet die optionalen Serverkomponenten.

## Auf ein anderes Gerät wechseln

Weil alles auf Ihrem Gerät liegt, können Sie mit **Profil → Speicher → Auf ein anderes Gerät verschieben** alles zu einer zweiten Installation mitnehmen - ohne Konto, ohne Cloud:

- <!--i:download--> **Meine Daten exportieren** lädt eine einzelne `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` herunter (die Namensteile stammen aus Ihrem Profil und entfallen, wenn sie nicht gesetzt sind; `<n>` ist ein Tageszähler, damit Exporte desselben Tages nicht kollidieren) mit Ihrem Profil, jeder gespeicherten Sitzung (samt ihrer Miniatur), Ihren hochgeladenen Bildern und Ihren Einstellungen (Farbschema, Breite der Seitenleiste, lokale Aktivitätsstatistik).
- <!--i:upload--> **Daten importieren…** auf der anderen Installation liest diese Datei wieder ein. Dabei wird **zusammengeführt**: Alles mit gleichem Namen (Ihr Profil, ein Sitzungsplatz, ein Bild) wird durch die importierte Kopie ersetzt; alles andere auf diesem Gerät bleibt erhalten. Gespeicherte Sitzungen verknüpfen sich automatisch wieder mit Ihren importierten Bildern.

Der Katalog-Zwischenspeicher ist nicht enthalten - er lädt sich auf dem neuen Gerät selbst neu herunter. Das Bündel ist ein schlichtes Zip (`manifest.json` + `profile.json` + `sessions.json` + `assets.json` + `assets/blobs/…` + `prefs.json`, Format-ID `lolly-backup`), es übersteht also E-Mail, USB oder AirDrop unversehrt und ist dasselbe Format, das jede Shell liest. Jeder Teil trägt eine Prüfsumme, eine unterwegs beschädigte Datei fällt also beim Import auf, statt halb kaputt wiederhergestellt zu werden. (Vollständige Formatspezifikation: [Datenübertragung](/info/data-transfer.html).)

## Ein Design importieren (Figma, Penpot, Illustrator, InDesign)

Sie können ein bestehendes Design in Lolly holen und daran weiterarbeiten: Öffnen Sie **Design**, klicken Sie in der Werkzeugleiste der Zeichenfläche auf **Ein Design importieren** und wählen Sie ein Figma-**.fig** oder SVG, ein Penpot-**.penpot**, ein Illustrator-**.ai** / **.pdf** oder ein InDesign-**.idml**. Ebenen werden zu bearbeitbaren Boxen auf der freien Zeichenfläche - Text bleibt neu tippbar, Bilder landen in **Meine Bilder**, und Schrift und Farben richten sich nach den Vorgaben der Marke - danach lässt sich das Ergebnis wie jede andere Sitzung speichern, teilen und rendern. Das Einlesen geschieht vollständig auf Ihrem Gerät. Alle Einzelheiten: **[Ein Design importieren](/info/design-import.html)**.

## Exportieren

Die ganze Geschichte steht unter **[Export & Formate](/info/exporting.html)** - Format wählen, Ausgabegröße und Druckmaße, Transparenz, Video sowie Kopieren und Teilen. Kurz gesagt: Format wählen, bei Bedarf die Größe setzen und **Herunterladen** (oder **Kopieren** in die Zwischenablage).

## Batch-Modus (Pro)

Für erfahrene Nutzerinnen und Nutzer rendert **Batch** (aus der Galerie verlinkt, hinter dem Pro-Feature-Flag, das standardmäßig an ist) viele Varianten auf einmal - ein Raster, in dem jede Zeile ein Satz Eingaben ist, gemeinsam exportiert. Ideal, um eine Karte in ein Dutzend Sprachen zu übertragen oder alle Größenvarianten in einem Durchgang zu erzeugen. Füllen Sie Zeilen durch Tippen, direktes Einfügen aus einer Tabellenkalkulation oder den Import einer CSV (Sie können auch eine zurück exportieren), und legen Sie Format, Größe und Ausgabedateinamen je Zeile fest. Speichern Sie ein ganzes Raster als benannte **Batch-Sitzung**, die sich aus der Galerie wieder öffnet, und laden Sie alle Zeilen als eine einzige `.zip` herunter.

![Die Batch-Symbolleiste - ZIP-Name, Einheiten, DPI und das Format, das jede Zeile erbt, mit Sitzungen und Rendern rechts](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Batch ist dafür da, **viele Varianten einer Vorlage** auf einmal zu erzeugen. Um Sitzungen neu zu rendern, die Sie **bereits gespeichert** haben, nutzen Sie **Projekte → Ordner rendern / Auswahl rendern** (oben) - dafür braucht es kein Pro.

## Nebeneinander bearbeiten (Mehrfachbearbeitung)

Batch bedeutet viele Varianten *eines* Designs. **Multi-Edit** ist die andere Hälfte der Aufgabe: mehrere **unterschiedliche** gespeicherte Designs gleichzeitig geöffnet, sodass eine Änderung auf alle zugleich wirkt. Haken Sie zwischen **zwei und acht** gespeicherten Sitzungen in **Projekte** an, und wählen Sie **Zusammen bearbeiten** aus der Auswahlleiste; sie öffnen sich als live Karten nebeneinander unter `#/multi?s=<slot>,<slot>…`. Jede Karte ist ein echtes Rendering dieser Sitzung, kein gespeichertes Thumbnail, sodass das, was Sie sehen, auch exportiert wird.

Eine Seitenleiste steuert das Ganze:

- <!--i:sliders--> **Gemeinsam** steht voran - jede Eingabe, die zwei oder mehr der ausgewählten Sitzungen *gleich* deklarieren (gleiche ID, gleicher Typ, gleiche Beschränkungen - dieselbe Zusammenführungsregel, die das Batch-Raster auf seine Spalten anwendet). Ändern Sie ein gemeinsames Steuerelement einmal, und der Wert fächert sich auf jede Sitzung auf, die es deklariert, live auf jeder Karte. Zwei Sitzungen desselben Tools teilen alles; zwei verschiedene Tools teilen, was sie zufällig gemeinsam haben, und sonst nichts.
- <!--i:document--> Darunter **eine eingeklappte Karte je Sitzung** mit allen eigenen Eingaben dieser Sitzung, in derselben Güte wie in der Seitenleiste des Tools selbst - Asset-Auswahl, sich wiederholende Zeilengruppen, Farbfelder - dazu ein kompakter Exportblock: **Format**, **B** / **H**, **Einheit**, **DPI** und ein eigenes **Herunterladen**. Dieses Herunterladen speichert die Sitzung zuerst und rendert sie dann über den gewöhnlichen Sitzungsexport, sodass die Datei denselben Dateinamen, dasselbe Format und dieselben Content Credentials trägt wie direkt aus dem Tool.
- <!--i:search--> **Eingaben filtern…** ganz oben grenzt die Steuerelemente über *alle* Karten hinweg ein - so kommen Sie in acht Sitzungen an „die Überschrift“, ohne danach zu scrollen.

Klicken Sie auf eine beliebige Zeichenfläche (oder drücken Sie darauf Enter), und die Seitenleistenkarte dieser Sitzung öffnet sich und wird ins Sichtfeld gescrollt. **Alle speichern** schreibt jede Sitzung zurück auf ihren eigenen Platz. **Alle herunterladen** speichert zuerst und rendert dann den ganzen Satz über dieselbe Kette wie **Auswahl rendern** in Projekten - ein Zip, wobei unterwegs der optionale Passwortschutz angeboten wird.

Zwei ehrliche Grenzen. Die Obergrenze von zwei bis acht ist echt: Jede Karte startet ihre eigene laufende Umgebung, und das ist die Zahl, bei der es flüssig bleibt - ein Link, der mehr verlangt (oder eine Sitzung, die es nicht mehr gibt), sagt das, statt halb zu laden. Und der Link nennt *Ihre* Speicherplätze, er öffnet diesen Satz also auf diesem Gerät; ein Link zum Teilen ist er nicht.

Ist die Auswahl größer als acht, mischt sie Tools oder enthält sie neben Sitzungen auch Bilder, ist **Als Tabelle bearbeiten** in derselben Auswahlleiste die Notausfahrt: Es öffnet die ganze Auswahl als **Zeilen im Batch-Raster** (`#/pro?s=…`), ohne Größenbegrenzung und ohne Regel zum selben Tool. Ordner bleiben bei beidem außen vor - sie haben ihren eigenen Weg ins Raster. (Die [Suche](/info/search.html) ist das eine, was hier noch nicht hineinreicht: Die Mehrfachbearbeitung ist die einzige Ansicht, die die Suchleiste nicht kennt.)

## Offline & Installation

Lolly ist eine PWA. Nach dem ersten Laden funktioniert es **offline** - installieren Sie es über die Adressleiste Ihres Browsers (oder *Zum Startbildschirm hinzufügen* auf dem Smartphone) für ein app-artiges Vollbild-Erlebnis. Es aktualisiert sich selbst, sobald Sie wieder online sind.

Zu Updates: Falls eine Ansicht direkt nach einem Update einmal nicht lädt (ein leeres Panel, ein „failed to fetch“ in der Ecke), laden Sie die Seite einmal neu - die App übernimmt die neue Version sauber, und Ihre Arbeit, Sitzungen und Marke bleiben unberührt. Sie speichert alles auf Ihrem Gerät, nicht in der Seite.
