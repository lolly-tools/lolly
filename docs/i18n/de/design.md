# Design: die freie Arbeitsfläche

<a id="design-the-free-canvas"></a>

Design ist das Tool für Layouts, die keine Vorlage abdeckt: ein Poster von Grund auf, ein Deck aus Folien, ein Bewegungsstück mit Soundtrack. Statt eines Formulars aus Steuerelementen erhalten Sie eine Arbeitsfläche aus Boxen, die Sie ziehen, in der Größe ändern, drehen und in die Sie tippen. Es exportiert über denselben Render-Pfad wie jedes andere Tool, sodass die Datei, die Sie erhalten, dem entspricht, was Sie auf der Arbeitsfläche sehen.

Diese Seite führt über die Arbeitsfläche von der ersten Box bis zu einem fertigen Deck: das Fenster, Boxen formen, eigene Formen zeichnen, 3D-Szenen und andere Tools platzieren, Zeit hinzufügen, das Ergebnis prüfen und das fertige Deck präsentieren. [Lolly nutzen](/info/using.html) behandelt, was Design mit jedem Tool teilt, etwa Speichern und Teilen.

![Designs freie Zeichenfläche - das Artboard mit seinem umgebenden Montagebrett](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

## Das Design-Fenster

Die **obere Leiste** beginnt mit **Home**, dem **File menu** und dem Namen des Dokuments (klicken Sie auf den Namen, um das Dokument umzubenennen). In der Mitte sitzen **Undo**, **Redo**, **History**, die Zoom-Steuerung (mit **Fit all** und **Fit artboard**) und Schalter für **Timeline**, **Navigator** und **Inspector**. Rechts folgen **Share**, **Present** und **Export**. Auf einem Smartphone wandern die seltener genutzten Schaltflächen in **More actions**.

Die **Werkzeugleiste** an der Seite enthält das Lolly-Menü und die Werkzeuge, mit denen Sie zeichnen: **Pointer**, **Add a box**, **Pen** (dieselbe Schaltfläche wie **Pencil**), **Edit points**, **Line**, dann die Schaltflächen für Timeline, Artboards und Auto-arrange.

![Die Werkzeugleiste der freien Zeichenfläche: ein Ziehgriff, das Lolly-Menü, dann Zeiger, Box hinzufügen, Stift, Punkte bearbeiten, Linie, Zeitleiste, Artboards und Automatisch anordnen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

Die Arbeitsfläche funktioniert wie der Montagetisch eines Designers rund um das Artboard:

- **Boxen neben dem Artboard parken.** Ziehen Sie eine Box über den Rand des Rahmens, und sie bleibt sichtbar und auswählbar. Alles außerhalb des Rahmens ist ausgeblendet, und der Rahmen behält seinen Schatten, um zu zeigen, wo die Datei beginnt.
- **Nur das Artboard wird exportiert.** Alles außerhalb des Rahmens oder der Teil einer Box, der über den Rand ragt, wird aus der Ausgabe abgeschnitten, in Raster- wie in Vektorformaten.
- **Zoomen Sie über Fit hinaus heraus**, um alles zu sehen, was Sie geparkt haben.
- **Die Größe des Artboards ändern** Sie über die Exportgröße. Boxen behalten ihre Positionen, sodass Sie ein Layout um vorhandene Inhalte neu einrahmen können.

![Die Bearbeitungsbühne: das Artboard vorn und in der Mitte, links die Werkzeugleiste und in der Ecke das Zoom-HUD](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&chrome=1&dark=1&filename=seq-studio-stage)

### Der Navigator und der Inspektor

Der **Navigator** listet jedes Artboard (überschrieben mit **Artboards**, in einem Deck **Slides**) als einklappbare Gruppe seiner **Layers** auf. Wählen Sie den Namen eines Artboards, um dorthin zu springen, klappen Sie es auf, um seine Ebenen auszuwählen oder neu zu ordnen, und gehen Sie mit den Pfeiltasten durch die Liste; Links kehrt zur Artboard-Überschrift zurück. **Pages** gruppiert Artboards in benannte Seiten, und die Wahl einer Seite ändert nur, welche Artboards der Editor zeigt.

Der **Inspector** stellt die Text- oder Bildsteuerung des gewählten Objekts nach vorn. Options-Chips decken die schnellen Entscheidungen ab, und **Advanced** enthält die Details der Gestaltung. Auf einem Smartphone teilen sich der Inspector und die Ebenenliste ein Panel, das unter der oberen Leiste herunterfährt, dasselbe Panel, in dem jedes andere Tool seine Steuerelemente hat. **Inspect** und **Layer/Page** in der unteren Leiste öffnen das Panel auf ihrem Tab. Ziehen Sie den Griff am unteren Rand oder tippen Sie darauf, um das Panel zwischen einem Streifen mit den beiden Tabs, dem halben Bildschirm und fast dem ganzen Bildschirm zu wechseln. Bei halber Höhe zeigt die Arbeitsfläche unter dem Panel Ihre Auswahl. Escape klappt das Panel zurück auf den Streifen und behält Ihre Auswahl.

![Der Abschnitt Document des Inspektors: die Tabs Selection und Canvas, dann Dimensions und Style & look](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

## Größe ändern, skalieren und drehen

Wählen Sie ein Objekt aus und ziehen Sie dann an einem Griff, um seine Größe zu ändern, oder ziehen Sie am runden Griff unter der Auswahl, um das Objekt zu drehen. Das Ziehen der Größe arbeitet in einem von zwei Modi:

- **Resize**, der Standard, ändert nur die Box. Text bricht in der neuen Größe neu um, und Schriftgröße, Strichstärke, Eckenradius und Effekte bleiben, wie sie waren.
- **Scale** vergrößert oder verkleinert das ganze Objekt samt Inhalt: Schriftgröße, Strich, Eckenradius, Schatten, Weichzeichner, Innenabstand und Abstände ändern sich alle um denselben Betrag.

Drücken Sie `K`, um Scale ein- oder auszuschalten. Ohne Tastatur wählen Sie **Scale mode** im Lolly-Menü oder halten die Schaltfläche **Pointer** in der Leiste gedrückt (oder klicken sie mit der rechten Maustaste) und wählen **Scale**; auf einem Touchscreen hat auch die Objektleiste einen Scale-Schalter. Solange Scale an ist, zeigt die Schaltfläche Pointer das Scale-Symbol, und jeder Griff hat in der Mitte einen Punkt. `V` oder **Escape** kehrt zu Resize zurück und behält Ihre Auswahl. Jedes Dokument öffnet sich mit ausgeschaltetem Scale, damit niemand versehentlich Striche skaliert.

**Nach Zahl skalieren.** Klicken Sie bei eingeschaltetem Scale oder bei mehreren ausgewählten Objekten auf die Anzeige in der Objektleiste, um das Popover **Scale** zu öffnen. Geben Sie einen Prozentwert, eine Breite oder eine Höhe ein, wählen Sie im 3 x 3-Raster den Punkt, der stehen bleibt, und wählen Sie **Apply**. Jede Skalierung ist ein Schritt beim Rückgängigmachen.

**Mehrere Objekte.** Eine Auswahl aus mehreren Objekten hat Griffe an ihren Kanten wie an ihren Ecken. Solange jedes Objekt aufrecht steht oder um ganze Vierteldrehungen gedreht ist und die Auswahl keine Gruppe und keinen Kreis enthält, ändert das Ziehen an einer Ecke Breite und Höhe frei. Andernfalls behält die Auswahl ihre Proportionen, und die Anzeige ergänzt **Proportional**. Beim Ziehen zeigt ein kleines Label die Größe oder im Scale-Modus den Prozentwert.

**Eine Auswahl spiegeln.** Klicken Sie mit der rechten Maustaste und wählen Sie **Flip horizontal** oder **Flip vertical**, oder drücken Sie `Shift+H` oder `Shift+V` (Umschalt, weil ein einfaches `V` der Pointer ist). Die Spiegelung ist eine echte Transformation, sodass das exportierte SVG, PDF und PNG die Spiegelung behalten.

**Tasten, die Sie beim Ziehen halten,** wirken in dem Moment, in dem Sie sie drücken oder loslassen; das Tastenkürzel-Blatt (`?`) listet sie ebenfalls auf.

| Halten | Größe ändern oder skalieren | Drehen | Verschieben |
|---|---|---|---|
| **Umschalt** | Behält die Proportionen (Scale tut das immer) | Dreht in 15-Grad-Schritten | Keine Änderung |
| **Alt** (Option) | Arbeitet von der Mitte aus | Dreht frei | Schaltet Einrasten und Raster aus |
| **Cmd/Strg** | Schaltet Einrasten und Raster aus | Dreht frei | Schaltet Einrasten und Raster aus |

Ohne gehaltene Taste wird eine Drehung zum nächsten 15-Grad-Wert gezogen, sobald sie innerhalb von 4 Grad davon liegt. Artboards drehen sich nicht und haben daher keinen Drehgriff.

::: details Griffe, Greifzonen und Touch
**Greifen Sie überall entlang einer Kante.** Jede Seite einer Auswahl ist auf ihrer ganzen Länge ein Streifen zum Ändern der Größe, und mit Maus oder Stift gibt es direkt außerhalb jeder Ecke eine Drehzone. Der Zeiger zeigt, was ein Ziehen bewirkt. Ein Drücken in einem Streifen oder einer Zone wird erst zur Größenänderung oder Drehung, wenn Sie zu ziehen beginnen, sodass ein einfacher Klick wie bisher auswählt. Ein gesperrtes Objekt hat keine Griffe, Streifen oder Zonen.

**Kleine Objekte bleiben verschiebbar.** Bei einem Objekt, das auf dem Bildschirm 25 Pixel oder weniger misst, verschwinden die mittleren Griffe, und die anderen rücken ein Stück von der Kontur weg, sodass ein Drücken auf das Objekt das Objekt verschiebt. Bei 10 Pixeln oder weniger verschwinden auch die Eckgriffe, und eine dünne Linie behält an jedem Ende einen Griff. Ein Drücken direkt neben einer dünnen Linie oder einem winzigen Objekt, abseits seiner Griffe, verschiebt das Objekt.

**Große Greifflächen.** Auf einem Touchscreen ist jede Eckzone ein Viertel der Breite und Höhe der Auswahl auf dem Bildschirm, zwischen 24 und 44 Pixeln, und jede Seitenzone deckt die Strecke zwischen zwei Ecken ab. Ist die Auswahl dafür zu klein, wandern die Zonen außerhalb ihrer Kontur. Die Zone unter Ihrem Zeiger oder Finger wird schattiert. Um dieselben Zonen mit Maus oder Stift zu erhalten, schalten Sie im Lolly-Menü **Large grab areas** ein; die Einstellung bleibt auf diesem Gerät.

**Zwei Finger auf einer Auswahl.** Legen Sie auf einem Touchscreen zwei Finger auf ein ausgewähltes Objekt: Spreizen skaliert, Verdrehen dreht, oder beide Finger bewegen die Auswahl, alles als ein Schritt beim Rückgängigmachen. Bei eingeschaltetem Scale skaliert das Spreizen auch den Inhalt; bei ausgeschaltetem Scale ändert es die Größe proportional. Ein Verdrehen rastet beim Annähern auf den nächsten 15-Grad-Wert ein, und eine Bewegung mit zwei Fingern rastet nie ein. Der erste Finger muss auf der Auswahl landen und der zweite schnell folgen, auf der Auswahl oder knapp außerhalb ihrer Kante. Zwei Finger an anderer Stelle zoomen und verschieben die Ansicht, ebenso zwei Finger auf einer Auswahl, die ein Artboard oder ein gesperrtes Objekt enthält, den größten Teil der Ansicht bedeckt oder über ihre Kante hinausreicht.
:::

## Eigene Formen zeichnen

Boxen, Kreise und abgerundete Rahmen decken die meisten Layouts ab. Für jede andere Form zeichnen Sie eine: Die Schaltfläche **Pen** der Leiste (oder `P`) versetzt Sie in den Zeichenmodus. Vier Tasten wechseln zwischen den Modi: `V` für den Pointer, `P` für den Pen, `Shift C` für den **Pencil** und `N` für **Edit points**. Der Pointer ist immer der Weg hinaus.

- **Klicken** Sie, um einen Punkt zu setzen. Beim Standardkurventyp zieht **Klicken und Ziehen** die Griffe des Punkts heraus und erzeugt eine Kurve; halten Sie beim Klicken **Alt** für eine harte Ecke. (Bei den anderen Kurventypen ist jeder Punkt eine Ecke, und ein Ziehen bewirkt nichts.)
- Halten Sie beim Klicken **Shift**, und das neue Segment verlässt den vorherigen Punkt in einem Vielfachen von 15 Grad, sodass waagerechte, senkrechte und 45-Grad-Linien exakt werden. Shift beim Herausziehen eines Griffs rastet den Griff genauso ein.
- Punkte rasten beim Setzen am Artboard, an Ihren anderen Boxen und an den übrigen Punkten desselben Pfads ein, sodass ein Punkt mit einem früher gesetzten fluchtet. Alt unterdrückt das Raster beim Zeichnen, und beim späteren Ziehen eines Punkts sowohl das Raster als auch die Kanten.
- **Klicken Sie Ihren ersten Punkt an**, um die Form zu schließen. Andernfalls drücken Sie **Enter**, doppelklicken oder wechseln das Werkzeug, und die Zeichnung bleibt erhalten.
- **Escape** wirkt Schritt für Schritt: Das erste Drücken bricht die Zeichnung ab, das zweite verlässt den Pen.
- **Delete** oder Undo (`⌘ Z` oder `Ctrl Z`) verwirft beim Zeichnen den letzten Punkt.

**Einen offenen Pfad fortsetzen.** Ist der Pen aktiv, drücken Sie auf ein Ende eines offenen Pfads, und Sie zeichnen diesen Pfad weiter: Jeder Klick fügt einen Punkt nach diesem Ende hinzu, oder vor dem ersten Punkt, wenn Sie am Anfang begonnen haben. Enter behält das Ergebnis, und Escape lässt den Pfad genau, wie er war. Der Pfad bleibt dieselbe Box, mit Füllung, Kontur und Pfeilspitzen, und ein Undo stellt ihn wieder her. Delete nimmt nur die Punkte zurück, die Sie hinzugefügt haben. Eine geschlossene Form, eine an eine Box gebundene Linie und ein Pfad mit mehreren Teilen haben kein freies Ende zum Fortsetzen.

**Freihand mit dem Pencil zeichnen.** Drücken Sie `Shift C` oder halten Sie die Schaltfläche **Pen** in der Leiste gedrückt (oder klicken Sie sie mit der rechten Maustaste) und wählen **Pencil**; die Schaltfläche zeigt dann den Pencil, bis Sie wieder den Pen wählen. Der Pencil zeichnet Ihren Strich auf, während Sie ziehen. Lassen Sie los, glättet Lolly den Strich zu wenigen Punkten mit Bezier-Griffen, behält die scharfen Wendungen als Ecken und hält die Kurve auf wenige Bildschirmpixel genau an der Bewegung Ihrer Hand. Ein Strich, der nahe seinem Anfang endet, schließt sich. Das Ergebnis ist ein gewöhnlicher Pfad mit derselben Farbgebung wie ein Pen-Pfad, dessen Punkte Sie danach bearbeiten können.

Das Ergebnis ist eine gewöhnliche Box. Verschieben, skalieren, drehen, gruppieren, ausrichten, umstapeln, füllen, schattieren oder verblassen Sie den Pfad wie jede andere Box. Der erste Pfad übernimmt Füllung und Strich, die Ihre Marke einem Pfad gibt, und jeder weitere neue Pfad übernimmt, was Sie zuletzt verwendet haben. In einem Tool, dessen Marke für Pfade nichts festlegt, erhält ein neuer Pfad einen Strich in der Farbe, mit der Sie gezeichnet haben, sodass die Form nie unsichtbar ist.

**Die Punkte erneut bearbeiten.** Doppelklicken Sie die Form oder nutzen Sie **Edit points** in der Objektleiste. Ziehen Sie einen Punkt, um ihn zu verschieben, ziehen Sie einen Griff, um die Kurve neu auszurichten, klicken Sie auf die Kurve, um einen Punkt einzufügen, oder ziehen Sie ein Rechteck um mehrere Punkte und drücken Sie Delete. Ein Pfad behält immer mindestens zwei Punkte.

- Halten Sie beim Ziehen eines Punkts **Shift**, und sein Winkel zum nächsten, nicht bewegten Punkt des Pfads springt in 15-Grad-Schritten. Shift beim Ziehen eines Griffs lässt den Griff um seinen eigenen Punkt in Schritten rasten. Shift beim Klicken fügt weiterhin einen Punkt oder Griff zur Auswahl hinzu; die Schritte beginnen, sobald Sie ziehen.
- Ein gezogener Punkt rastet am Artboard, an anderen Boxen und an den übrigen Punkten des Pfads ein. Halten Sie Alt, um ihn frei zu setzen.
- Klicken Sie einen Griff an, um ihn auszuwählen, und drücken Sie dann **Delete**, um ihn auf seinen Punkt zurückzuziehen. Diese Seite des Punkts wird zur Ecke, ohne Griff, der die Kurve zieht. Sind Punkte ausgewählt, entfernt Delete wie bisher die Punkte.

Der **Spline-Typ** bestimmt, welche Art von Kurve durch Ihre Punkte läuft:

| Typ | Was er tut |
|---|---|
| **Smooth (auto)** | Der Standard. Berechnet seine Grifflängen selbst, sodass einfache Klicks eine glatte Kurve ergeben. Ein von Ihnen gesetzter Griff legt die Richtung fest, und die Kurve bestimmt die Länge weiter selbst. |
| **Bezier handles** | Der klassische Pen: Sie steuern jeden Griff, und das Einfügen eines Punkts bewegt die Kurve nie. |
| **Through the points** | Verläuft genau durch jeden Punkt, ohne Griffe. |
| **B-spline** | Fließt nahe an den Punkten vorbei statt durch sie, für eine weichere Linie. |
| **Straight lines** | Ein Polygonzug. |

Das Umstellen eines bestehenden Pfads auf einen Typ, der seine Griffe selbst berechnet, fragt zuvor nach, weil von Ihnen gesetzte Grifflängen nicht wiederherstellbar sind; die Umstellung auf **Bezier handles** ist immer verlustfrei. Mitten im Zeichnen gilt die Umstellung sofort, und alle Griffe, die Sie herausgezogen hatten, werden verworfen.

Jeder Punkt trägt außerdem eine Stetigkeitsregel, die seine Form zeigt: quadratisch für **Corner** (Griffe bewegen sich unabhängig), rund für **Smooth** (Griffe bleiben in einer Linie) und rund mit Ring für **Symmetric** (in einer Linie und gleich lang). Legen Sie die Regel für ausgewählte Punkte fest, und die Kurve folgt sofort.

![Zwei Stiftpfade, direkt aus einem Link gerendert: eine umrandete S-Kurve und ein geschlossener, gefüllter Klecks](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Ein gezeichneter Pfad reist in einem Share-Link wie jede andere Box mit und rendert über die Kommandozeile gleich.

## Formen kombinieren

Wählen Sie zwei oder mehr Formen aus, klicken Sie mit der rechten Maustaste auf die Arbeitsfläche (Tippen mit zwei Fingern auf Touch) und wählen Sie:

- **Union** vereint sie zu einer Form mit der Füllung der obersten.
- **Subtract** schneidet alles darüber aus der untersten Form heraus.
- **Intersect** behält nur die Überlappung.
- **Exclude** behält alles außer der Überlappung.

Drei weitere wirken auf eine einzelne Form. **Outline stroke…** verwandelt einen Strich in eine gefüllte Kontur derselben Stärke. **Offset path…** vergrößert die Kontur nach außen oder verkleinert sie mit einer negativen Zahl nach innen. **Simplify** baut einen Pfad mit weniger Segmenten bei gleicher Kontur neu auf.

![Eine Mondsichel und ein Ring mit einem echten Loch, beide durch Subtract erzeugt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D%26w%3D1080%26h%3D1080&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&filename=path-ops-boolean-result)

Das Ergebnis ist ein neuer Pfad, den Sie mit dem Pen weiterbearbeiten können, gespeichert als einfache Bezier-Kurven, sodass der ursprüngliche Spline-Typ nicht erhalten bleibt. Löcher sind echte Löcher: Das Steuerelement **Fill rule** im Strich-Panel entscheidet, ob sich überlappende Konturen füllen (*non-zero*) oder durchstanzen (*even-odd*). Die Operationen lehnen lieber ab, als etwas zu zerstören: Verlangen Sie den Schnitt zweier Formen, die sich nicht überlappen, ändert sich nichts. Text- und Bildboxen haben keine Kontur und bleiben unberührt.

## Ein Bild nachzeichnen

Wählen Sie ein Bild aus, klicken Sie mit der rechten Maustaste darauf und wählen Sie **Bild nachzeichnen…**, um das Bild in bearbeitbare Formen zu verwandeln. Wählen Sie ein Preset und klicken Sie auf **Nachzeichnen**:

- **Logo** findet wenige flache Farben und behält scharfe Kanten sowie echte Kreise und Linien. Ein Bild mit Verläufen oder Fototönen lehnt es ab und sagt das auch.
- **Illustration** zeichnet mehrere Farben als gefüllte Formen nach, flache Grafik oder ein posterisiertes Bild.
- **Strichzeichnung** zeichnet dunkle Linien auf hellem Grund als schwarze Formen nach.
- **Mittellinie** zeichnet dunkle Linien als einzelne Konturen nach, sodass Sie deren Stärke danach ändern können.

Die Formen werden als Gruppe direkt über dem Bild eingefügt, das an seinem Platz bleibt. Blenden Sie das Bild aus oder löschen Sie es, um nur die Pfade zu sehen. Das Nachzeichnen läuft auf Ihrem Gerät als Hintergrundauftrag mit einer Schaltfläche „Abbrechen“, und nichts wird hochgeladen. Ein Bild mit 1500 Pixeln braucht meist zwischen einer und mehreren Sekunden, ein detailreiches Foto länger.

Das Nachzeichnen folgt dem, was die Box zeigt, daher wird bei einem zugeschnittenen Bild (Cover) nur der sichtbare Teil nachgezeichnet. Es gelten diese Grenzen:

- Bilder werden vor dem Nachzeichnen auf höchstens 1500 Pixel an der langen Seite verkleinert, die Kanten sitzen also auf einen Bruchteil dieser Größe genau, nicht des Originals.
- Eine Nachzeichnung erzeugt höchstens 1.500 Formen und 60.000 Punkte. Ein Foto überschreitet das meist, und Design sagt es, ohne etwas zu verändern. Probieren Sie Logo oder Strichzeichnung oder ein einfacheres Bild.
- Verläufe werden zu Bändern aus flacher Farbe, weiche Schatten zu hartkantigen Formen.
- Eckenradius, eine Formmaske und ein Effekt auf der Bild-Box werden nicht auf die Pfade angewendet.
- Dasselbe Bild und dasselbe Preset ergeben immer dieselben Formen.

## Konturen

Eine Box, ein Bild, ein Board und ein Pen-Pfad können jeweils eine Kontur tragen: eine Farbe, eine Breite und einen Stil (durchgezogen, gestrichelt oder gepunktet). Die Konturzeilen stehen im Inspector unter **Fill**, und die Schaltfläche **Stroke** der Objektleiste öffnet sie.

**Position** legt die Kontur auf die Umrisslinie: **Innen**, **Zentriert** oder **Außen**. Eine Box wird innen konturiert, sofern Sie nichts anderes wählen, sodass ihr äußerer Rand bleibt, wo Sie ihn gezeichnet haben, und ein Pen-Pfad wird auf seiner Kurve zentriert konturiert. Bei einer zentrierten oder äußeren Kontur bleiben Füllung, Bild und Text innerhalb des inneren Rands der Kontur, und der Auswahlrahmen bleibt am eigenen Rand der Box. Ein offener Pfad hat kein Innen und wird daher immer zentriert konturiert. Die Kontur eines Boards bleibt immer innerhalb der Seite, weil der Seitenrand der Exportrand ist.

**Kontur je Seite.** Bei einem Rechteck, einer abgerundeten Box, einer Pille oder einem Board zeigt der Schalter neben der Breite vier Breiten: **Oben**, **Rechts**, **Unten** und **Links**. Setzen Sie eine Seite auf 0, um sie auszublenden, was Ihnen eine Trennlinie oder Unterstreichung ohne zweite Form gibt. Der Schalter zeigt oder verbirgt nur die vier Felder und ändert nie einen Wert. Solange die Seiten abweichen, steht bei der Breite **Gemischt**; tippen Sie dort eine Breite ein, um alle vier Seiten auf einmal zu setzen. Farbe, Position und Stil bleiben für alle Seiten gemeinsam, und abgerundete Ecken verlaufen mit den Breiten daneben, wie bei einem CSS-Rahmen. Ellipsen, Kreise und Pen-Pfade zeichnen ringsum eine Breite.

Wie die Formate eine Kontur tragen:

| Format | Position | Je Seite |
|---|---|---|
| SVG, PDF, PNG und die anderen Bilder | Exakt. Die innere oder äußere Kontur eines Pen-Pfads wird doppelt so breit gezeichnet und auf eine Seite der Umrisslinie beschnitten. | Eine durchgezogene Kontur ist exakt, als eine Form zwischen dem äußeren und inneren Rand der Kontur. Eine gestrichelte oder gepunktete wird in SVG als Striche entlang jeder Seite gezeichnet und in PDF durchgezogen. |
| Penpot | Innen, zentriert und außen reisen als Penpots Konturausrichtung. Ein Board ist immer `inner`. | Penpot 2.19 oder neuer liest die vier Breiten nativ. Penpot 2.18 zeichnet die obere Breite ringsum, und Penpot 2.17 oder älter weist eine Datei mit Breiten je Seite ab. |
| PowerPoint | PowerPoint zeichnet eine Linie zentriert auf den Rand der Form. Zentriert ist exakt; außen verschiebt die Form um die halbe Breite nach außen, was PowerPoints Linie außerhalb der Box legt; innen behält die zentrierte Linie, die ältere Exporte schrieben. | Die Kontur wird zu einer eigenen Form (dem Ring zwischen äußerem und innerem Rand) über einer Form ohne Linie. |
| dotLottie | Lottie-Konturen sind zentriert, daher wird eine äußere Box-Kontur oder ein innen oder außen konturierter Pen-Pfad mit einer Meldung abgewiesen. | Mit einer Meldung abgewiesen. |

Eine durchscheinende zentrierte Kontur zeigt durch ihre innere Hälfte die Seite statt der Füllung, auf der Arbeitsfläche und in jedem Export. Wenn Sie eine Penpot-Datei importieren, behält jede Kontur ihre Ausrichtung und ihre Breiten je Seite, und `strokeAlign` und die einzelnen Konturstärken einer Figma-Datei kommen genauso mit.

## 3D-Szenen und Tools in einem Design

Eine Box kann mehr als ein Bild enthalten. Beide Arten unten behalten ein Rezept statt eines gerenderten Bildes, sodass sie in jeder Größe und zu jedem Zeitpunkt neu gezeichnet werden, den das Dokument verlangt, und eine Aktualisierung der Quelle jedes Design erreicht, das die Quelle nutzt.

### 3D-Szenen

Wählen Sie **3D scene** im Hinzufügen-Menü der Leiste und ziehen Sie einen Rahmen auf: 3D Studio öffnet sich auf der neuen Box, und was Sie dort festlegen, kommt auf die Arbeitsfläche zurück. Danach öffnet **Edit in 3D Studio** im Abschnitt **3D scene** des Inspektors das Studio erneut. [Eine Szene in Design platzieren](/info/3d-studio.html#place-a-scene-in-lolly-design) behandelt Poster, die Zeitleiste, Export und Teilen.

### Tools in einem Design

Wählen Sie **Image** im Hinzufügen-Menü der Leiste, ziehen Sie einen Rahmen auf und wählen Sie auf dem Tab **Tools** der Auswahl ein Tool. Das Tool füllt den Rahmen mit seinen Standardwerten, und der Inspector öffnet sich auf einem Abschnitt **Tool** mit den eigenen Steuerelementen dieses Tools. Ändern Sie ein Feld, und die Box aktualisiert sich einen Moment später, als ein Schritt beim Rückgängigmachen. **Image fit** und **Image position** funktionieren wie bei jedem Bild, und **Replace with another tool or image** tauscht den Inhalt der Box aus.

**Tools, die sich bewegen,** spielen in der Box ab: Eine sich wiederholende Illustration läuft auf der Arbeitsfläche weiter, folgt dem Abspielkopf, sobald die Zeitleiste geöffnet ist, und exportiert Bild für Bild als GIF, MP4 oder WebM. Gibt das Tool an, wie lange eine Schleife dauert, erhält die Box einen Clip genau dieser Länge, sodass ein Video ganze Schleifen enthält. Ein Clip, dessen Timing Sie geändert haben, behält Ihr Timing, und das Ausschalten der Bewegung des Tools macht die Box wieder zu einem Standbild.

## Zeitleiste (Sequence)

**Sequence** ist die Zeitleiste von Design: Sie fügt der Arbeitsfläche Zeit hinzu. Jede Box kann zu einem Zeitpunkt beginnen, eine Länge lang laufen und ein- und ausblenden, und die unter dem Artboard angedockte Zeitleiste ist der Ort, an dem Sie sie anordnen. Beginnen Sie mit der Vorlage **Video** von Design, und eine kurze Sequenz ist schon vorhanden: zwei zeitlich gesetzte Textkarten in der Sequenzzeile und ein prozedural erzeugtes Musikbett darunter, sodass Sie sehen können, wie die Zeitleiste funktioniert, bevor Sie etwas ändern.

![Die Zeitleiste von Sequence: das Transport-Bedienfeld, das Lineal, eine Overlay-Spur, die magnetische Sequenzreihe mit ihren Clips und Nahtstellen-Chips und der Always-on-Streifen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Es gibt zwei Arten von Zeilen:

- Die **Sequenzzeile** ist magnetisch. Clips liegen Ende an Ende, das Ziehen eines Clips ordnet den Ablauf neu, und das Löschen eines Clips schließt die Lücke. Das ist das Rückgrat.
- **Overlay-Spuren** sind frei. Ein Bauchbinden-Titel, ein Logo oder eine Bildunterschrift schwebt zu ihrer eigenen Zeit über dem Rückgrat, jede in ihrer eigenen Spur.
- Darunter enthält **Always on** Boxen ohne Timing, die die ganze Zeit über vorhanden sind. Das `+` auf einem Chip verschiebt eine auf eine Spur; **Make always on** schickt sie zurück.

Das Öffnen der Zeitleiste gibt ihr die Tastatur, sodass Space und die Pfeiltasten den Abspielkopf steuern. Eine Komposition, die schon Timing hat, öffnet die Zeitleiste von selbst.

**Bearbeiten.** Ziehen Sie die Mitte eines Clips, um ihn zu verschieben, ziehen Sie nahe an einem Ende, um ihn zu kürzen, und drücken Sie **Split at playhead** (oder `S`), um ihn in zwei zu schneiden. Split braucht einen Clip mit einer echten **Length** und den Abspielkopf ein Stück weit innerhalb von ihm, sodass sich ein offener Clip wie das Musikbett nicht teilen lässt. **Snap to edges** ist standardmäßig an und rastet an Clipkanten, am Abspielkopf und an ganzen Sekunden ein; halten Sie Alt, um ohne Einrasten zu ziehen. Jedes Ziehen ist ein Schritt beim Rückgängigmachen, und die Vorschau beim Ziehen nutzt dieselbe Arithmetik wie das Ergebnis.

Wählen Sie einen Clip, und der Inspector bietet dieselben Bearbeitungen als Zahlen: **Length**, **Trim in** (wie weit in der Quelle der Clip beginnt), **Speed** von ×0,25 bis ×4, **Animate in** und **Animate out** mit ihren Längen und **Mute clip**. Ein Clip in der magnetischen Zeile hat kein Feld **Start**, weil die Zeile die Reihenfolge bestimmt.

**Transitions** sind Presets: Fade, Pop, Grow, Rise, Drop, die vier Slides, Zoom in und out, Tilt, Swoop, Spin, Drift oder **Cut (no animation)**. Distanzen skalieren mit dem Objekt, sodass ein Preset auf einer bildfüllenden Karte und einem kleinen Badge richtig wirkt. Zwischen zwei Clips in der Sequenzzeile wählt ein **Seam-Chip** **Cut** oder **Crossfade**; öffnen Sie ihn erneut, um die **Length (ms)** festzulegen, und drücken Sie **Done**. Bei einer Überblendung läuft der erste Clip über den Schnitt hinaus weiter und blendet aus, während der nächste einblendet, in der Vorschau wie in der Datei gleich.

**Ton.** Ein **Audio**-Clip liegt wie jeder andere Clip auf der Zeitleiste, mit Wellenform, Trimmen und Stummschalten. Das erzeugte Musikbett der Vorlage Video wird beim Export synthetisiert, sodass sein Balken schlicht und still bleibt, bis Sie rendern. Drücken Sie das Mikrofon, um **eine Sprachaufnahme** direkt auf die Zeitleiste aufzunehmen, mit Einzählung und Pegelanzeige; die Aufnahme wird als Ihr eigenes Asset am Abspielkopf gespeichert. Die Kamera-Schaltfläche neben dem Mikrofon **nimmt auf dieselbe Weise ein Video auf**, beim Aufnehmen auf das Artboard zugeschnitten, sodass eine Kollegin oder ein Kollege über einen geteilten Link einen Clip hinzufügen kann. Wählen Sie einen Clip mit Ton, und sein Streifen öffnet sich unter der Zeitleiste für Lautstärke, Panorama, EQ, Tonhöhe, Normalisieren und Effekte wie **Voice cleanup**; [Ton](/info/sequence-editor.html#sound) in der Anleitung zum Sequenz-Editor behandelt den Streifen. Die **Audio track** des Export-Panels ist davon getrennt: ein Bett unter dem ganzen Clip, mit Ausblendung und Ducking.

![Die Zeitleiste mit ausgewähltem Musikclip: Ihre Leiste läuft am unteren Rand entlang, mit Geschwindigkeit, Ein-/Ausblenden, Lautstärke, Schwenken, EQ, Tonhöhe, Lautstärke normalisieren und dem Effekt-Slot](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Czzfxm%25253A7%25253Alofi%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Rendern.** Ein Bewegungsexport zeichnet, dekodiert und kodiert jedes Bild zu einem exakten Zeitpunkt, sodass die Datei nicht davon abhängt, ob Ihr Rechner mithält, und MP4 und WebM keine praktische Bildobergrenze haben. Die Länge der Zeitleiste bestimmt die Dauer, sofern Sie keine eintippen, und Content Credentials werden wie bei jedem anderen Export aufgeprägt. Ein Standbild-Export liefert das Bild am Abspielkopf oder ein Kontaktbogen aus dem Feld **Frames**; siehe [Standbilder aus einer zeitlich gesetzten Komposition](/info/exporting.html#stills-from-a-timed-composition). Eine Sequenz ist auf eine Stunde begrenzt. GIF und animiertes PNG halten jedes Bild im Arbeitsspeicher und eignen sich daher für kurze Clips. **Record live** ist hier ausgeblendet, weil das Rendern Bild für Bild der bessere Weg ist.

**Keyframes, Tiefe und eine Kamera.** Eine Transition animiert einen Clip beim Eintreffen und Verlassen. Um eine Box innerhalb eines Clips zu posieren (driften, ausblenden, weichzeichnen, von der Seite abheben und wieder absetzen), wählen Sie den Clip und drücken **+Keyframe**: die Raute in den Werkzeugen der Zeitleiste, die Raute in der Objektleiste der Arbeitsfläche oder **Shift+K** bei fokussierter Zeitleiste. Die Position des Abspielkopfs entscheidet, welche Pose Ihre nächste Bearbeitung schreibt. Dieselben Keyframes geben einer zeitlich gesetzten Komposition eine Kamera, die heranfährt, schwenkt und den Fokus zieht. [Animieren](/info/animating.html) ist die vollständige Anleitung, und [Der Sequenz-Editor](/info/sequence-editor.html) behandelt Auswahl, Onion Skin, Teilen, Trimmen und Marker.

## Vor dem Export

Design prüft Ihr Dokument, bevor Sie die Datei senden. Die Karte **Before you export** im Abschnitt **Document** des Inspektors und erneut im Export-Panel liest die gespeicherte Ebenenstruktur und prüft dann die beruhigte Arbeitsfläche auf abgeschnittenen Text und Kontrast bei Vollfarben. Sie fragt dieselbe Schriftregistrierung, die auch die SVG- und PDF-Umrisse nutzen, ob jeder Textlauf Schrift-Bytes hat, die sich einbetten lassen. Text, den eine [Ersatzschrift](/info/fallback-fonts.html) im Export zeichnet, gilt als abgedeckt. Ein Schriftsystem ohne Ersatzschrift oder ein chinesisches, japanisches oder koreanisches Zeichen außerhalb der Zeichensätze, die diese Schriften enthalten, wird weiterhin gemeldet. Bild- und Verlaufshintergründe werden als visuelle Prüfungen aufgelistet, statt ihnen eine erfundene Kontrastzahl zu geben.

### Eine Komposition gegen das Designsystem prüfen

Die Karte im Export-Panel vergleicht die Komposition außerdem mit Ihrem Designsystem, in derselben Version des Designsystems, die das Rendering nutzt. Sie betrachtet verfasste Farben, Token-Aliase, Schriftwahlen und Bild-Asset-IDs. Ein eigener Wert kann Absicht sein, und ein Bild außerhalb der deklarierten Marken-Assets ist ein Prüfpunkt, kein verbotenes Bild.

Wo es einen konkreten Vorschlag für Farbe oder Schrift gibt, ändert seine Schaltfläche diese eine Ebene, und **Undo** stellt das Original wieder her. Gesperrte oder seither geänderte Ebenen werden nie durch einen alten Vorschlag überschrieben. Verläufe, Effekte, verschachtelter Tool-Inhalt, Rechte und subjektive Qualität liegen außerhalb dieses Vergleichs, und keine Prüfung blockiert Download.

### Hausregeln und das Schreibsignal

Die Karte im Export-Panel prüft außerdem die Hausregeln, die Ihr Designsystem mitbringt, etwa Textstärke und Ausrichtung, freigegebene Farbpaare oder ein Logo je Fläche, Ebene für Ebene. Jeder Befund ist eine Warnung mit dem Namen der Ebene über der Regel. Eine Regel, für die dieser Build keine Prüfung hat, wird als nicht geprüft aufgeführt, nie als eingehalten. [Rules](/info/brand-studio.html#rules) listet die Regeln auf, und `lolly check` wendet dieselben auf ein gespeichertes Dokument an.

Dieselbe Karte zeigt das Schreibsignal für den Text, den das Dokument zeichnet: sein Band (none, weak, notable oder strong), dann Verifys eigenen Satz mit dem Wert von 100 und bis zu drei markierten Formulierungen, jede mit der Ebene, die sie enthält. **Open the text in Verify** bringt diesen Text zu [Lolly Verify](/#/verify) für die volle Auswertung; [KI-Hinweise in Verify](/info/verify-ai-evidence.html) erklärt, was der Wert gewichtet. Der Wert ist ein Signal, kein Urteil: Er zählt Muster, die in erzeugtem Text häufig sind, und kann nicht sagen, wer die Worte geschrieben hat. Ausgeblendete Ebenen bleiben in beiden Prüfungen außen vor, und die Karte nennt, wie viele.

Befunde zu Hausregeln und ein starkes Schreibsignal zählen zur Summe "to fix" der Karte, damit sie leicht zu finden sind. Sie informieren und blockieren nie: Download bleibt verfügbar, und es gibt nichts zu verwerfen oder als Ausnahme zu erfassen. Ein Agent, der im geöffneten Dokument arbeitet, erhält denselben Bericht über seine Site-Tools ([Agenten in einem geöffneten Dokument](/info/open-document-agents.html)).

Die Druckprüfungen (Beschnitt, Auflösung, Farbauftrag und Anzahl der Druckplatten) kommen zur selben Karte, wenn Sie **Settings → Feature flags → Print preflight** einschalten. In anderen Tools zeigt dieses Flag die Karte überhaupt erst an; [Eine Datei exportieren](/info/exporting.html) beschreibt die Druckprüfungen.

## Präsentieren

Ein Design-Dokument aus Artboards ist bereits ein Deck. Drücken Sie **Present** in der oberen Leiste, und jedes Artboard wird zu einer Vollbildfolie, in der Reihenfolge, in der die Artboards auf der Arbeitsfläche liegen. Die Schaltfläche heißt **Preview**, bis das **Design outcome** des Dokuments **Slides** ist. Das Deck läuft auf einer Kopie der gerenderten Artboards, sodass Sie nach dem Verlassen genau dort sind, wo Sie waren.

Der Pfeil neben **Present** öffnet **Present from this slide**, **Speaker view**, **Present with camera**, **Narrate**, **Auto-advance slides**, **Loop the deck (kiosk)** und **Export slides as video**.

| Taste | Was sie tut |
|---|---|
| **Space**, `→`, **Page Down** | Nächster Schritt oder nächste Folie (oder Klick auf den Streifen am rechten Rand) |
| `←`, **Page Up** | Zurück (oder Klick auf den Streifen am linken Rand) |
| **Home**, **End** | Erste oder letzte Folie |
| `O` | Übersicht: jedes Artboard in Ihrer Anordnung auf der Arbeitsfläche; klicken Sie eines an, um es zu öffnen |
| `S` | Referentenansicht: aktuelle Folie, nächste Folie, Notizen und eine Uhr in einem zweiten Fenster |
| `B` | Schwarzer Bildschirm; jede Taste bringt die Folie zurück |
| `F` | Zurück zum Vollbild |
| `K` | Ein Kiosk-Deck anhalten oder neu starten |
| **Escape** | Eine Ebene abschälen: Übersicht zum Deck, Deck zum Editor |

Eine kleine Steuerleiste blendet sich ein, wenn Sie den Zeiger bewegen, und verschwindet wieder, wenn Sie aufhören. Blockiert der Browser das Pop-up der Referentenansicht, öffnet sich die Referentenansicht als Panel über dem Deck. Notizen gehören zu jedem Artboard und erscheinen nie auf der Folie.

Auf einem Touchscreen wischen Sie nach links für den nächsten Schritt oder die nächste Folie und nach rechts, um zurückzugehen. Ein Übergang **Slide** oder **Fade** folgt Ihrem Finger und endet, wenn Sie loslassen; ein Übergang **Cut**, **Morph** oder **Fly between artboards** läuft nach dem Loslassen vollständig ab, und ein kurzes, langsames Wischen ändert nichts. Webseiten-Boxen, Videosteuerungen, scrollende Boxen und ausgewählter Text behalten ihre eigenen Gesten, sodass ein Wischen nie auf einer davon beginnt, und vertikales Scrollen und Pinch-Zoom funktionieren wie gewohnt. Bei reduzierter Bewegung wechselt die Folie trotzdem, ohne Ihrem Finger zu folgen.

- **Aufdeck-Schritte.** Klicken Sie mit der rechten Maustaste auf eine Box und wählen Sie **Reveal at step 1**, **2** oder **3** statt **Always visible**, und die Box wartet, bis Sie auf ihren Schritt vorrücken. Boxen mit derselben Nummer erscheinen gemeinsam.
- **Kiosk.** Geben Sie einem Artboard eine **Length**, und das Deck hält so lange dort an und rückt dann hinter einem schmalen Fortschrittsbalken vor. Fügen Sie `kiosk` zum Link hinzu, und das Deck beginnt am Ende von vorn, für Beschilderung.
- **Unterfolien-Stapel.** Klicken Sie mit der rechten Maustaste auf ein Artboard und wählen Sie **Stack under the previous slide**, um es zu einem Schritt dieser Folie zu machen. Die Übersicht zeigt eine Karte, und die Zeile **Stack** des Inspektors sagt, zu welcher Folie das Artboard gehört.
- **Morph.** Haben zwei aufeinanderfolgende Folien beide eine Box mit demselben Namen bei **Morph match** (etwa `hero`), bewegt, skaliert und färbt der Übergang diese Box um, statt zu schneiden. Ein deckweiter Übergang **Morph** tut dasselbe für jedes übereinstimmende Paar.
- **Vertonung.** Die **Speaker notes** jedes Artboards können vorgelesen werden. Wählen Sie im Abschnitt **Document** des Inspektors eine **Voice**, optional eine zweite Stimme für **Blend with**, die **Speed** sowie ein **Lead-in** und **Tail** in Millisekunden; **Show captions when presenting** zeigt die Worte, wie sie gesprochen werden. Die Stimme läuft auf Ihrem Gerät, und dieselben Notizen werden zum Soundtrack eines Videoexports, zum Folienaudio in einem PowerPoint-Export und zum vertonten Film in einem [SCORM-Paket](/info/create/exporting.html#scorm-course-packages).

Das Deck ist auch ein Link. `?present` öffnet direkt darin, und `s=` wählt die Folie (eine Position, eine Artboard-ID oder `id.step` für einen Aufbauschritt), und die Adresse folgt Ihnen, sodass das, was Sie senden, die Folie ist, auf der Sie gerade sind. [Reservierte URL-Parameter](/info/url-parameters.html#what-happens-on-open) dokumentiert sie.

**Present with camera** legt Ihre Kamera, ein Logo und eine Namensunterschrift über die Folien, mit privaten Steuerelementen und gespeicherten Szenen; siehe [Mit Kamera präsentieren](/info/presenting.html). Eine **Web page**-Box kann während eines Vortrags den Clicker übernehmen, wenn Sie in ihrem Inspektor **Make interactive** einschalten: Bei ihrem Schritt **Focus on click** steuern Auf und Ab die Seite, während Weiter das Deck fortsetzt. [Live-Seiten, die den Clicker annehmen](/info/interactive-pages.html) behandelt Fokusstile, Scroll-Stopps und Website-Freigabe.

## Wie es weitergeht

- **[Text in Design](/info/text-composition.html)**: Text auf der Arbeitsfläche bearbeiten, Artikel durch Rahmen fließen lassen und Typografie.
- **[Animieren](/info/animating.html)**: Keyframes, Tiefe, die Szenenkamera und Lift-Ebenen.
- **[Ein Design importieren](/info/design-import.html)**: eine Figma-, Penpot-, Illustrator- oder InDesign-Datei als bearbeitbare Boxen öffnen.
- **[Ein Design mit Regeln teilen](/info/create-a-tool.html)**: ein Design-Dokument in ein Tool mit nur den von Ihnen gewählten Eingaben verwandeln.
- **[Eine Datei exportieren](/info/exporting.html)**: Formate, Größen, Druckeinheiten und Video.
