# Lolly verwenden

Öffnen Sie ein Tool, passen Sie die freigegebenen Eingaben an, speichern Sie das Ergebnis und teilen Sie es als Link oder Datei.

Alles läuft ohne Konto auf Ihrem Gerät und funktioniert auch offline, sobald die benötigten Tools und Assets heruntergeladen sind. Zum Starten braucht die App einen Browser oder eine App mit WebGPU. Unter [Unterstützte Umgebungen](/info/supported-environments.html) finden Sie die getesteten Umgebungen.

**Der Ablauf**, in vier Schritten:

::: steps
- <!--i:eti-home--> **[Ein Tool öffnen](#find-your-way-around)** Klicken Sie auf eine Karte auf dem Startbildschirm. Neben der Live-Vorschau stehen die Steuerelemente.
- <!--i:eti-sliders--> **[Die Eingaben ändern](#change-what-the-tool-lets-you-change)** Nur die Eingaben, die der Autor offengelassen hat. Klicken Sie auf das Design, um das zugehörige Steuerelement zu finden.
- <!--i:eti-folder-plus--> **[Ihre Arbeit speichern](#saving-continuing)** **Save** bewahrt sie in My library auf, und über Projects öffnen Sie sie wieder.
- <!--i:eti-link--> **[Das Design teilen](#sharing-your-work)** Ein Link, der alle Eingaben enthält, oder eine einzelne `.lolly`-Datei.
:::

<!--i:eti-home-->
## Sich zurechtfinden

::: figure using-app-map
Der Startbildschirm hat oben vier Tabs und unten eine Leiste. Bei geöffnetem Tool stehen die Steuerelemente neben einer Live-Vorschau.
:::

Am oberen Rand des Startbildschirms finden Sie vier Tabs: **Tools**, **Utilities**, **Assets** und **Projects**. Mit Tools erstellen Sie Ihre Arbeit. Utilities wandeln Dateien um, prüfen oder bereinigen sie. Assets ist Ihre Bibliothek. Projects enthält Ihre gespeicherte Arbeit.

In der Leiste unten finden Sie **Open**, **Settings**, ein Suchfeld, die Verknüpfung **Verify** zu Lolly Verify und **Docs** zum Öffnen dieser Anleitungen. Die Leiste ist in Tools, Utilities, Assets, Projects, Settings und den Anleitungen in der App sichtbar. Sobald ein Tool geöffnet ist, wird sie ausgeblendet. Über das Suchfeld findet [Lolly Search](/info/search.html) Ihre Tools, gespeicherte Arbeit, Assets und Einstellungen. [Ask Lolly](/info/ask.html) beantwortet eingegebene Fragen mit dem passenden Abschnitt aus diesen Anleitungen.

Beginnen Sie mit einem Klick auf eine Karte eine neue Arbeit in diesem Tool. Über **Projects** öffnen Sie gespeicherte Arbeit wieder. Beim ersten Besuch bietet ein Begrüßungsband oben in der Galerie eine Aktion zum Einstieg an: **Start making** unter Lolly Demo oder **Make it yours**, um Ihr eigenes Designsystem einzurichten.

![Eine Galeriekarte mit Beispielnavigation und einer New-Aktion](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Jedes Tool zeigt eine geteilte Ansicht mit **Steuerelementen** auf einer Seite und einer Live-**Vorschau** auf der anderen. Wenn Sie ein Steuerelement ändern, aktualisiert sich die Vorschau. Der Export entspricht dem, was Sie sehen.

![Die geteilte Ansicht eines Tools - links die Steuerelemente, rechts das live gezeichnete gruppierte Balkendiagramm](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** bildet die Ausnahme: eine freie Arbeitsfläche mit Boxen zum Ziehen, Ändern der Größe und Eingeben von Text, mit eigener oberer Leiste, Zeitleiste und Deck-Steuerung. Die Anleitung dazu finden Sie unter [Lolly Design: die freie Arbeitsfläche](/info/design.html).

<!--i:eti-sliders-->
## Ändern, was das Tool zu ändern erlaubt

Ein Tool zeigt nur die Eingaben, die variieren sollen. Der Autor hat Farben, Layout, Schrift und Logik festgelegt, damit Ihre Arbeit seinen Regeln folgt. Zu den Eingaben zählen Text, Schieberegler, Farbwähler, Dropdowns, Datumsangaben, Bildauswahlen und wiederholte Zeilengruppen. Manche befinden sich in einklappbaren Abschnitten.

![Die Steuerelemente eines Tools - ein Textfeld, Farbschaltflächen und ein Schieberegler, ohne die weiteren vom Autor gesperrten Elemente](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klicken Sie auf das Design, um das zugehörige Steuerelement zu finden.** Wenn Sie ein Element in der Vorschau anklicken, wird sein Steuerelement in die Ansicht gescrollt und erhält den Fokus. Bei einer wiederholten Zeilengruppe öffnet sich die angeklickte Zeile.

**Clear changes** über den Steuerelementen stellt die Standardwerte aller Eingaben wieder her.

**Optionen des Designsystems.** Bietet Ihr Designsystem mehrere Farbvarianten, einen hellen und einen dunklen Look oder eine andere Designauswahl, finden Sie diese unter den Steuerelementen im Abschnitt **Design system**. Eine Option erscheint nur, wenn sie sich auf dieses Tool auswirkt. Ein Datei-Utility zeigt deshalb keinen solchen Abschnitt. Farbvarianten erscheinen jeweils als Punkt in ihren eigenen Farben, hell und dunkel als zwei Schaltflächen und alle weiteren Optionen als Liste.

Die Auswahl gilt für dieses Werk. Sie wird im Link und in der gespeicherten Sitzung mitgeführt. Alle mit dem Designsystem verknüpften Farben folgen der Auswahl, während die Farben der App unverändert bleiben. In Lolly Design finden Sie dieselben Optionen im Tab **Canvas** des Inspektors. Ein Tool, dessen Farben selbst der Inhalt sind, kann bei der kanonischen Farbvariante bleiben und zeigt dann keine Farbvarianten-Punkte. Unter [Lolly Demo im Einsatz](/info/lolly-demo-in-use.html#colourways-on-real-work) sehen Sie Farbvarianten an echter Arbeit. Um eine Farbvariante für die App und jedes neue Werk zu verwenden, wählen Sie sie unter **Settings → Appearance** aus ([Eine Farbvariante zu Ihrer eigenen machen](/info/colourways.html#make-a-colourway-your-own)).

### Die Vorschau zoomen und verschieben

- **Zoomen:** Mit Cmd/Ctrl scrollen oder auf einem Trackpad zwei Finger auseinanderziehen, zentriert auf Ihren Zeiger. Auf der Tastatur passen `0` oder `Shift+1` alles ein, `1` oder `Shift+0` stellen 100 % ein und `Shift+2` passt die Auswahl ein. `+` / `−` zoomen um den Zeiger, wenn er über der Arbeitsfläche steht, andernfalls um die Mitte.
- **Verschieben:** Halten Sie **Space** gedrückt und ziehen Sie oder ziehen Sie mit der mittleren Maustaste. Einfache Klicks bleiben zum Anklicken von Teilen des Designs verfügbar.
- **Touch:** Ziehen Sie zwei Finger zum Zoomen auseinander, ziehen Sie zum Verschieben und doppeltippen Sie zum Einpassen.
- **Zoom-HUD:** Halten Sie den Lolly-Wirbel in der Ecke gedrückt, bis `−`, **Fit** und `+` ausgeklappt werden. Kurzes Tippen auf den Wirbel öffnet weiterhin Ihr Profilmenü.

In Lolly Design erfasst **Fit all** Artboards und frei liegende Ebenen. Manuell können Sie auf unter 20 % herauszoomen, bis die Seite die Hälfte der Ansicht füllt. Die feste Untergrenze liegt beim kleineren der beiden Werte: 5 % des normalen Fit-Maßstabs oder 2 % absoluter Zoom.

Wenn Sie die Ausgabegröße ändern, wird die Ansicht immer wieder eingepasst.

![Das Zoom-HUD, ausgeklappt aus dem Wirbel in der Ecke der Arbeitsfläche - Minus, Fit, Plus, dann die Schalter für Design und Ton sowie der Griff zum Verschieben](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Rückgängig und Wiederholen

**Cmd/Ctrl-Z** führt einen Schritt zurück, **Cmd/Ctrl-Shift-Z** (oder **Cmd/Ctrl-Y**) einen Schritt vor. Die Schaltflächen **Undo** und **Redo** stehen über den Steuerelementen, in Lolly Design in der oberen Leiste. Sobald keine Schritte mehr verfügbar sind, wird die jeweilige Schaltfläche ausgegraut. Eine Meldung nennt die Eingabe, die beim Rückgängigmachen wiederhergestellt wurde, und enthält eine Schaltfläche **Redo**.

- **Ein Ziehen zählt als ein Schritt.** Mehrere Änderungen desselben Steuerelements innerhalb einer halben Sekunde werden zu einem Schritt zusammengefasst.
- **Die letzten 100 Schritte bleiben erhalten.** Eine neue Änderung nach dem Rückgängigmachen leert den Vorwärts-Stapel.
- **In einem Textfeld** steuert Cmd/Ctrl-Z das Feld, Zeichen für Zeichen. Bei Schiebereglern, Dropdowns, Farben und Schaltern übernimmt Lolly.
- **Die Auswahl einer Datei** in einem Dateifeld zählt nicht als Schritt, da diese Bytes nur für die laufende Sitzung vorgehalten werden.

Bei einer Live-[Zusammenarbeit](/info/collaborate.html) kommt eine Änderung vom anderen Gerät niemals auf Ihren Rückgängig-Stapel. Rückgängigmachen ist möglich, bis Sie das Tool verlassen oder neu laden. Für ältere Änderungen bewahren Tools, die während der Arbeit speichern, frühere Versionen unter **History** auf ([Zu einer früheren Version zurückgehen](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Live-Kamera

Die Effekte im Tool **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art und Glitch) bieten die Schaltfläche **Go live**, wenn eine Kamera verfügbar ist. Schalten Sie sie ein, um den Effekt Bild für Bild auf Ihre Webcam anzuwenden. Ein Bewegungsexport zeichnet das Ergebnis als GIF, WebM oder MP4 auf. Die Bilder werden auf Ihrem Gerät verarbeitet. Sobald Sie stoppen oder das Tool verlassen, wird die Kamera freigegeben. Jede Bildauswahl bietet außerdem **Take a photo** für ein einzelnes Bild.

<!--i:eti-folder-plus-->
## Speichern & Fortsetzen

Um Ihre Arbeit zu behalten, drücken Sie **Save**, das Häkchen neben **Export** in der Render-Pille. Neue Werke landen in **My library**, bereits gespeicherte Werke werden an ihrem bisherigen Ort aktualisiert und es wird nichts heruntergeladen. Im Export-Panel finden Sie dieselbe Schaltfläche **Save**.

Um den Speicherort zu wählen, drücken Sie im Export-Panel neben **Download** auf **Save as**. Lassen Sie unter **Save to a project** die Auswahl **My library** stehen oder wählen Sie ein Projekt (**＋ New project…** erstellt eines). Drücken Sie dann **Save**. **Save as a template** speichert das Design als [Vorlage](/info/templates.html), einen Ausgangspunkt für neue Dokumente. In Lolly Design finden Sie **Save as** im Lolly-Menü. Auf einem Smartphone drücken Sie **•••**, dann **File menu** und anschließend **Save as**.

![Die zweiteilige Render-Pille: Export mit einem Pfeil nach oben zum Öffnen des Export-Panels und Save mit einem Häkchen zum Speichern am bisherigen Ort](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Drücken Sie **Save** auf der Render-Pille oder **Save as**, um ein Projekt auszuwählen.
- <!--i:folder--> Das Werk landet in **My library** oder im ausgewählten Projekt.
- <!--i:home--> Drücken Sie später oben links **Home** und öffnen Sie den Tab **Projects**.
- <!--i:document--> Öffnen Sie das Werk. Alle Einstellungen sind wieder da, bereit zum Ändern und erneuten Exportieren.
:::

Werke erhalten den Dateinamen, den Sie im Export-Panel eingegeben haben, oder andernfalls den Namen ihres Tools, etwa **QR Code**. Eine mit **Download** heruntergeladene Datei ist eine fertige Kopie. Um sie später zu ändern, öffnen Sie das gespeicherte Werk in Projects.

::: note Gespeicherte Werke bleiben auf diesem Gerät
Persönliche Werke bleiben auf diesem Gerät, in dem Browser oder der App, aus denen Sie sie gespeichert haben, sofern Sie [Sync](/info/sync.html) nicht einschalten.
:::

Wenn etwas nicht dort ist, wo Sie es erwarten, behandelt [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html) alle Fälle, vom geschlossenen Tab bis zu gelöschten Browserdaten.

::: details Teamprojekte mit Lolly Work (optional)
Wenn Ihre [Organisation Lolly Work verwendet](/info/organisation.html), melden Sie sich bei ihrer Instanz an und öffnen Sie **Projects → Team projects**, um die mit Ihnen geteilten Sitzungen zu sehen. Die Organisation legt Zugriff und Aufbewahrung fest, und ihr Lolly Work-Dienst speichert diese Sitzungen. Wenn Ihre Organisation die Live-Bearbeitung erlaubt, tritt eine geteilte Sitzung beim Öffnen ihrer Live-Zusammenarbeit bei. [Zusammenarbeiten](/info/collaborate.html#collabs-through-lolly-work-optional) erklärt die Schritte.

Ihre persönliche Bibliothek bleibt getrennt. Wenn Sie sich auf einem anderen Gerät anmelden, erhalten Sie Zugriff auf die Arbeit des Teams. Persönlich gespeicherte Werke benötigen weiterhin Sync oder eine Sicherung, um auf ein anderes Gerät zu gelangen.
:::

<!--i:eti-link-->
## Ihre Arbeit teilen

Teilen Sie ein Design als Link oder als Datei. **Share** in den Export-Steuerelementen öffnet einen Dialog mit beiden Möglichkeiten. **Share link** bei einer gespeicherten Sitzung in Projects öffnet denselben Dialog für diese Sitzung. Nachdem Sie eine Datei an Google Drive, Nextcloud, einen S3-Bucket, Dropbox oder OneDrive gesendet haben, kann der Dialog auch einen Link über diesen Dienst erstellen ([Eine Datei exportieren](/info/exporting.html#how-export-works)).

::: cols
## Ein Link

- Enthält jede Eingabe in der Adresse, sodass der Link das Design reproduziert.
- Lässt Bilder und Dateien, die Sie von diesem Gerät hinzugefügt haben, sehr lange Texte und sehr große Listen weg.
- Lässt sich in jedem Browser öffnen. Sie können den Link also als Lesezeichen speichern, einfügen oder in einen Commit aufnehmen.

## Eine .lolly-Datei

- Enthält die gespeicherte Sitzung samt Bildern und Dateien auf diesem Gerät und kann auch das Tool und das Designsystem enthalten.
- Lässt lizenzierte Kataloggrafiken weg, sofern Sie die Dateien nicht ausdrücklich einschließen.
- Lässt sich in Lolly öffnen: per Doppelklick, über **Open** oder indem Sie sie auf die App ziehen.
:::

### Der Link

Der Link steht oben im Dialog, daneben **Copy** und eine Schaltfläche **QR**, die das Tool QR Code mit dem Link öffnet. Unter dem Link enthält **Link options** folgende Optionen:

- **Open in the installed app** wandelt den Link in eine `lolly://`-Adresse für Shortcuts, Launcher und Automatisierung um. Alle Parameter bleiben unverändert.
- **Shortest link** packt ein langes Design in ein kompaktes Token und zeigt die Einsparung in Zeichen an. Die lesbare Form bleibt verfügbar.
- **Password-protect this link** verschlüsselt den Link auf Ihrem Gerät mit AES-256. Das Passwort ist nie Teil des Links.
- **Pin this tool version** fügt das Flag `_v` hinzu, damit ein späteres Tool-Update nicht ändern kann, was der Link rendert.
- **When the recipient opens the link…** legt fest, ob der Link im Vollbild, mit ausgeklapptem Export-Panel, mit einem Download beim Öffnen (`&export`) oder mit einer Kopie in die Zwischenablage (`&copy`) geöffnet wird.
- **Copy credit** kopiert den Hinweis „Mit Lolly erstellt“ mit dem Link für einen Beitrag oder eine Folie.

Wenn ein Tool persönliche Felder wie Ihren Namen enthält, hält **Review personal fields** jedes davon aus dem Link heraus, bis Sie es ankreuzen. [URL-Modus](/info/url-mode.html) beschreibt alles, was ein Link enthalten kann.

**Der Dialog zeigt, was ein Link nicht enthalten kann.** Beim Erstellen des Links zählt Lolly alles, was nicht in eine Adresse passt. Wurde etwas weggelassen, listet der Dialog diese Inhalte auf und verweist auf die Dateioption. Bei einem Link, der lediglich lang ist, erscheint ein weniger deutlicher Hinweis mit der Zeichenanzahl.

**Bei manchen Tools ist der Link das gesamte Produkt.** Jump Page sammelt Ihre Links auf einer Seite zum Weitergeben: als Bio-Link, für einen Vortrag oder als Schaufenster eines Shops. Die Seite ist der Link. Es wird also nichts gehostet, und hinter der Seite steht kein Konto. Besucher sehen die Seite in voller Breite, beim Scrollen einen Link pro Szene.

![Jump Page im Editor: die Überschriftenszene oben auf der Seite, darunter die Link-Szenen](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Von der Organisation verwaltete Links mit Lolly Work
Wenn Sie Inhalte mit Ablaufdatum, Widerrufsmöglichkeit oder Passwort teilen müssen, bietet Lolly Work verwaltete Links zu geteilten Sitzungen, Tools und Katalog-Assets. Sie werden über den Dienst der Organisation aufgelöst und folgen deren Zugriffsregeln. Sie sind von den oben beschriebenen eigenständigen Links getrennt. Ein Widerruf kann keine Datei zurückholen, die jemand bereits heruntergeladen hat. [Rendern und Teilen](/info/manage/sharing.html) listet die Linktypen und Berechtigungen auf.
:::

### Die .lolly-Datei

**Download .lolly** im Abschnitt **Editable file** des Share-Dialogs schreibt das aktuelle Design in eine einzelne Datei. Gewöhnliche Kataloggrafiken werden zusammen mit den Bildern und Dateien von diesem Gerät aufgenommen. Veraltete oder nicht verfügbare Dateien bleiben als externe Referenzen erhalten. Vor dem Speichern zeigt der Dialog die Dateigröße, die Anzahl eingebetteter und referenzierter Dateien und ob das Tool enthalten ist. Wenn Ihr Gerät einen Systemdialog zum Teilen bietet, übergibt **Send to…** ihm die Datei (AirDrop, Teilen unter Android).

**Download project (.lolly)** im Menü eines Ordners in **Projects** schreibt einen ganzen Ordner in eine Datei, damit jemand anderes mit jeder Sitzung darin weiterarbeiten kann. Batch-Sitzungen werden weggelassen. Der Hinweis nennt ihre Anzahl. **Download originals** im selben Menü erstellt eine gewöhnliche Zip-Datei, in der jedes Werk als eigene Datei liegt.

Bevor eine Datei weitergegeben wird, entscheiden Sie drei Dinge:

- **Ob Ihr Name aufgenommen wird.** Ihr Name, Ihre E-Mail-Adresse und Ihre Organisation werden nur geschrieben, wenn **Use my details to create** in [Ihrem Profil](/info/profile.html) eingeschaltet ist. Ist es ausgeschaltet, vermerkt die Datei nur, dass und wann sie mit Lolly erstellt wurde.
- **Ob zurückgehaltene Grafiken aufgenommen werden.** Lizenzierte und an eine Marke gebundene Grafiken bleiben standardmäßig ausgeschlossen. Dasselbe gilt für Katalogwerke, deren hinterlegte Lizenz Lolly noch nicht lesen kann. Verwendet das Design solche Inhalte, nennt der Dialog ihre Anzahl und bietet *Download without them* oder *Include and download* an. Wenn Sie sie einschließen, geben Sie die Dateien an alle weiter, die die `.lolly` öffnen. Ein Katalogwerk ohne hinterlegte Angaben zu seinen Rechten wird mitgegeben. Der Dialog listet jedes davon auf, damit Sie es vor dem Senden prüfen können. Die `CREDITS.txt` der Datei listet auf, was mitgegeben wurde und was nicht, jeweils mit dem Grund. [Kreative Rechte und Quellenangaben](/info/creative-rights.html) erklärt die Regeln.
- **Ob das Tool aufgenommen wird.** **Include the tool** packt die eigenen Dateien des Tools ein, damit sich das Design auf einem Gerät ohne dieses Tool öffnen lässt. Bei einem eigenen Tool, etwa einem Fork, ist die Option zunächst angekreuzt. Bei einem Tool aus dem signierten Katalog ist sie nicht angekreuzt. In einem Build ohne signierten Katalog gilt jedes Tool als eigenes Tool.

**Eine Datei öffnen.** In den Desktop- und Mobil-Apps doppelklicken oder tippen Sie auf eine `.lolly`, wählen **Open with Lolly** oder senden sie über den Systemdialog zum Teilen an Lolly. In der Web-App drücken Sie **Open** oder ziehen die Datei auf Lolly. Jeder dieser Wege liest zuerst das Manifest der Datei und zeigt ihre Größe, ihren Inhalt und die geplanten Schritte an, bevor etwas geschrieben wird.

::: warning Die Installation eines Tools führt dessen Code aus
Enthält die Datei ein Tool, das Sie nicht haben, zeigt **Trust this tool?** das Tool und seinen Autor an und weist darauf hin, dass beim Öffnen der eigene Code des Tools auf Ihrem Gerät ausgeführt wird. **Trust & install** setzt den Vorgang fort.
:::

Wenn Sie ablehnen, wird das Werk trotzdem in Projects gespeichert und wartet dort, bis Sie das Tool hinzufügen. Ein Tool, dessen Code als Modul ausgeliefert wird, lässt sich auf diesem Weg noch nicht installieren und wird ebenso abgewiesen.

::: details Was eine .lolly enthält und wie das Öffnen funktioniert
`.lolly` ist die Dateiendung für Lolly-Bundles. Das Feld `format` in ihrer `manifest.json` gibt den Inhalt an:

- Ein **geteiltes Design** (`lolly-share`) enthält eine gespeicherte Sitzung, ihre eingebetteten Dateien und einen Beleg für alles, was weiterhin per Referenz aufgelöst wird. Es kann auch das Tool und das Designsystem enthalten. Beim Öffnen wird ein neues Projekt hinzugefügt und niemals eine Sitzung überschrieben.
- Ein **geteiltes Projekt** (`lolly-share`, kind `project`) enthält einen Ordner aus Projects: seine Unterordner, jede Sitzung darin mit ihrer Kachel und die dort abgelegten Bilder. Beim Öffnen wird eine Kopie des Ordners hinzugefügt. Jede Sitzung wird als `sessions/<key>.json` mit ihrer Kachel unter `thumbs/` mitgegeben. Eine Lolly-Version aus der Zeit vor Projektdateien fordert Sie zu einem Update auf.
- Ein **Designsystem-Paket** (`lolly-brand`) enthält Tokens und kann Schriften, Logos, veröffentlichte Versionen und aufbewahrte Ressourcen enthalten. Beim Öffnen wird ein separates, benanntes Designsystem hinzugefügt und aktiviert.
- Ein **Arbeitsbereichs- oder Instanzpaket** ist ein `lolly-brand` mit deklarierten Tools, Katalog-Assets und optional einer Instanzadresse. Beim Laden ersetzt es die einzige zuvor geladene Arbeitsbereichsüberlagerung. Die Vorschau listet diese geräteweiten Auswirkungen auf.

Eine vollständige Gerätesicherung ist keine `.lolly`. Sie bleibt eine `LollyTools-….zip` (Format `lolly-backup`) und wird über **Settings → Storage → Import data…** wiederhergestellt. Ein gezippter Tool-Ordner bleibt ebenfalls eine `.zip`. [Datenübertragung](/info/data-transfer.html) ist die Formatreferenz.

Eine `.lolly` ist eine gewöhnliche Zip-Datei. Benennen Sie sie in `.zip` um, um hineinzusehen. Ihre eigenen Bilder liegen unter `assets/uploads/`, Kataloggrafiken unter `assets/catalog/`. `manifest.json` listet jede Datei auf, und eine README erklärt, worum es sich bei der Datei handelt.

macOS, Windows, Linux, iOS und Android registrieren das Format. Desktop-Dateimanager zeigen die Datei als Lolly-Dokument an, und GNOME Files kann die eigene Miniaturansicht einer gespeicherten Sitzung anzeigen. Beim Öffnen aus Lolly Design System Setup wird die Designsystem-Aktion empfohlen, wenn ein geteiltes Design ein Designsystem enthält. **Open shared design** wird jedoch nie ausgeblendet.

Unter iOS oder Android ist ein aus einer anderen App übergebenes Dokument auf 48 MB begrenzt. Die App weist darauf hin. Bei der Übergabe werden die Bytes über die App-Grenze hinweg kopiert. **Open** innerhalb von Lolly hat diese Grenze nicht. Verwenden Sie es daher für größere Bundles.

Nach Ihrer Bestätigung entpackt und prüft Lolly das Bundle einmal. Assets gelangen in Ihre Bibliothek und werden anhand ihrer Prüfsumme abgeglichen, damit bereits auf dem Gerät vorhandene Dateien wiederverwendet werden. Sitzungen gelangen mit neuen IDs in Projects, sodass dieselbe Datei zweimal geöffnet werden kann. Eine Sitzung, deren Tool fehlt, wartet dort. Dateien über 100 MB werden als groß gekennzeichnet. Die Vorschau warnt, wenn der Browserspeicher weniger freien Platz meldet, als die Datei benötigt. Jeder Teil, für den eine Integritätsprüfung vorgesehen ist, wird geprüft, bevor etwas endgültig gespeichert wird. Eine beschädigte Kopie wird abgewiesen, ohne etwas zu hinterlassen.
:::

Sowohl ein Link als auch eine Datei gibt eine Momentaufnahme weiter. Für die Live-Bearbeitung beschreibt [Zusammenarbeiten](/info/collaborate.html) private Zusammenarbeiten zwischen zwei Geräten und optionale Zusammenarbeiten im beruflichen Umfeld über Lolly Work.

<!--i:eti-images-->
## Assets - Ihre Bibliothek

**Lolly Assets** (`#/a`) enthält alles, worauf Ihre Tools zugreifen können: Markenlogos, Bilder, Audio und Animationen, nach Art gruppiert, sowie Ihre eigenen Dateien. Ihre Uploads werden auf Ihrem Gerät gespeichert. Eine Organisation mit Lolly Work kann außerdem einen geteilten Katalog mit eigenen Zugriffsregeln bereitstellen ([Lolly in Ihrer Organisation verwenden](/info/organisation.html)).

![Assets mit den Farbfeldern und Schriften der Marke sowie Ihren eigenen Uploads](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Bringen Sie Ihre Dateien mit.** Ziehen Sie ein Bild, SVG, einen Audioclip, ein Video, eine Lottie-Datei, ein PDF oder ein PowerPoint-Deck auf den Upload-Bereich oder klicken Sie zum Auswählen. Die Datei erscheint sofort in Assets und in der Asset-Auswahl jedes Tools. Bei einem mehrseitigen PDF oder einer `.pptx` werden Sie gefragt, welche Seiten oder Folien Sie behalten möchten. Jede davon wird zu einem SVG-Asset. Ein Bild, das Sie innerhalb eines Tools hinzufügen, bleibt in **My images** unverändert, sodass ein darauf vorhandenes Content Credential weiterhin verifiziert werden kann. Nur bei einer sehr großen Datei werden Sie gefragt, ob Sie die Größe ändern möchten. **Settings → Storage** zeigt, wie viel **My images** enthält. Außer dem Speicherplatz Ihres Geräts gibt es keine Grenze. Um EXIF- und GPS-Daten beim Hochladen zu entfernen, schalten Sie **Strip metadata from uploads** unter **Settings → Feature flags** ein. Content Credentials bleiben in beiden Fällen erhalten.
- <!--i:star--> **Markieren Sie oft Genutztes als Favorit.** Versehen Sie ein Asset oder ein Markenfarbfeld mit einem Stern, um es oben in jeder Auswahl anzuheften.
- <!--i:folder--> **Schaffen Sie Ordnung.** Verschieben Sie ein Asset in eine andere Gruppe, blenden Sie ein ungenutztes geteiltes Marken-Asset aus (**Show hidden** holt es zurück) oder löschen Sie eigene Uploads. Dieselbe Auswahlleiste wie in Projects wirkt auf die gesamte Auswahl.
- <!--i:layers--> **Lösen Sie ein Video von seinem Hintergrund.** Öffnen Sie die Details eines Videos oder klicken Sie mit der rechten Maustaste auf seine Karte in einer Asset-Auswahl und wählen Sie **Remove background…**. Ein **On-device model** stellt ein Motiv vor einer unruhigen Szene frei. Ein **Colour key** entfernt einen gleichmäßig ausgeleuchteten Hintergrund wie einen Greenscreen und benötigt keinen Download. **Tolerance**, **Softness** und **Spill removal** passen die Kanten an. **Resolution** (360, 480, 720 oder 1080p, nie höher als die Quelle) wägt Detailtreue gegen Geschwindigkeit ab. Das freigestellte Ergebnis ist ein animiertes WebP oder PNG mit Transparenz, das neben dem Original gespeichert wird. Das Content Credential der Quelle wird als Bestandteil mit dem freigestellten Ergebnis mitgegeben. [Einmal erzeugt, immer gleich gerendert](/info/ai-features.html) erklärt, warum dies eine gewöhnliche Bearbeitung bleibt.

### Nehmen Sie Ihre Palette und Schriften überallhin mit

Das Panel **Swatches** in Assets zeigt die Farben Ihrer Marke: ihre Markenfarben, von Ihnen hinzugefügte Farben, ihre Farbabstufungen und ihr Spektrum. Die Rollenfarben, die Lolly für die Oberfläche bereithält (Text, Flächen, Kanten, Leitfarben der Farbvarianten und Kopien einer Markenfarbe unter anderem Namen), liegen hinter einer grauen Karte **Show colour roles** am unteren Ende des Panels.

Jede Farbe ist eine Karte wie jedes andere Asset. Klicken Sie auf eine Karte, um ihre Details zu öffnen, wählen Sie einige zum Herunterladen aus oder laden Sie die gesamte Palette in dem Format herunter, das Ihr anderes Tool liest:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** oder **CSS classes** für ein Stylesheet oder einen Build. Eine Farbe außerhalb von sRGB behält ihren erweiterten Wert: CSS setzt ihn nach dem Hex-Wert, und JSON speichert neben dem Hex-Wert auch die erweiterte Farbe, die CMYK-Zusammensetzung und die Sonderfarbe.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** für Illustrator oder Photoshop. Eine an eine CMYK-Zusammensetzung gebundene Farbe kommt als entsprechendes CMYK-Farbfeld an, eine Sonderfarbe als benanntes Sonderfarbfeld und eine Farbe außerhalb von sRGB als Lab.
- <!--i:pentool--> **GIMP palette (.gpl)** für GIMP oder Inkscape und **SCSS variables**, beide in sRGB.

![Das Panel Swatches - oben die fünf Schaltflächen zum Herunterladen der Palette, darunter jede Markenfarbe als Chip, der ihre Details öffnet](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Mehrere Farben auswählen oder die Details einer Farbe öffnen
Wählen Sie Farben über den Punkt auf jeder Karte aus: Klicken Sie mit gedrückter Umschalttaste auf einen zweiten Punkt, um alles dazwischen auszuwählen, ziehen Sie ein Rechteck durch die Zwischenräume oder drücken Sie Cmd/Strg+A, während eine Karte den Fokus hat. Die Leiste bietet **Download as…** in denselben sechs Formaten, **Copy hex** und **Favourite**. Bevor Sie ein Format wählen, listet das Menü Farben auf, die kein Format enthalten kann (Transparent hat keine Farbe). Es zeigt außerdem, welche Formate eine erweiterte Farbe als sRGB-Ersatz speichern (SCSS und GIMP) und welche CMYK- und Sonderfarbwerte mitnehmen (JSON und .ase). Ein Rechtsklick auf eine Karte bietet dieselben Aktionen für eine einzelne Farbe.

Die Details einer Farbe füllen die Vorschau mit dieser Farbe und klappen folgende Bereiche aus: **Linked values** (ihre CMYK-Zusammensetzung oder Sonderfarbe, Werte für einen bestimmten Farbraum oder eine bestimmte Druckmaschine und ihr Design-Token), **Every notation** (Hex, OKLCH, Display-P3 und weitere, jeweils mit einer Schaltfläche zum Kopieren), **Plotted on a colour space**, **Tones** und **Readability**. Mit den Pfeiltasten gehen Sie durch die Palette. **Copy link** teilt die Farbe, und **Open in Colour Lab** öffnet sie zur weiteren Bearbeitung.
:::

Das Panel **Fonts** listet die Schriften Ihrer Marke auf, jeweils mit einem **download**, um sie lokal zu installieren oder an eine Druckerei weiterzugeben.

<!--i:eti-grid-->
## Das Raster anpassen

- <!--i:star--> **Markieren Sie genutzte Tools als Favoriten.** Klicken Sie mit der rechten Maustaste auf eine Karte und wählen Sie **Add to favourites**. Das Tool erhält eine große Kachel in einer Leiste über dem Raster. [Ihre Favoriten](/info/favourites.html) beschreibt die Leiste.
- <!--i:eyeoff--> **Blenden Sie nie genutzte Tools aus.** Klicken Sie mit der rechten Maustaste auf eine Karte oder wählen Sie mehrere aus und wählen Sie **Hide tool**. Das Tool verschwindet aus dem Raster und aus den Treffern, die beim Tippen im Raster erscheinen. Das Tool verlässt das Raster und wird beim Tippen im Raster nicht mehr gefunden. Eine graue Kachel **Show hidden tools (N)** am Ende zeigt ausgeblendete Tools wieder an, jeweils abgedunkelt und mit **Unhide tool** im Menü. Das Ausblenden ändert nur Ihr Raster: Das Tool lässt sich weiterhin über einen Link oder ein Lesezeichen öffnen.
- <!--i:clock--> **Ihre Tools zuerst.** Sobald Sie Werke in drei verschiedenen Tools gespeichert haben, erscheint über dem Raster eine Chip-Zeile **Yours**, die mit Ihren Favoriten und zuletzt verwendeten Tools beginnt.
- <!--i:sliders--> **Ordnen Sie alles nach Ihren Wünschen an.** **View options** legt das Layout (**Grid**, **Card** oder **List**), Kartengröße und Dichte, Sortierreihenfolge und einen Kategoriefilter fest.

![Das Ende des Tools-Rasters mit eingeblendeten ausgeblendeten Tools: die abgedunkelte Wordmark-Karte und daneben die graue Kachel, die sie wieder sichtbar gemacht hat und nun Hide hidden tools anzeigt](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Bearbeiten Sie mehrere Karten auf einmal.** Kreuzen Sie das Kontrollkästchen jeder Karte an, ziehen Sie ein Auswahlrechteck über freien Raum oder klicken Sie mit gedrückter Umschalt-/Cmd-Taste. Eine Leiste zeigt die in dieser Ansicht verfügbaren Aktionen:

- **Tools und Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects mit ausschließlich den Sitzungen, die mit diesen Tools erstellt wurden) und Copy link für eine einzelne Karte.
- **Assets:** Favourite und Hide für jede Auswahl. Duplicate, Download und Delete erscheinen nur, wenn alle ausgewählten Elemente eigene Uploads sind, da ein geteiltes Designsystem-Asset eine dauerhafte Zusage darstellt.
- **Projects:** siehe [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html#find-something-you-saved).

![Die Auswahlleiste der Galerie für zwei Tools mit Available offline, View sessions, Favourite und Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

AUFNAHMEHINWEIS (misc-sessions-by-tool, NICHT VERÖFFENTLICHT): Das Ergebnis von „View sessions“
hatte eine eigene Konfiguration (`/#/p?tools=qr-code,d3`, toolsBodyHtml() in
views/projects.ts), hier entfernt, weil es kein `drive=` hat, das seine
Inhalte selbst erzeugen kann. Eine gespeicherte Sitzung entsteht nicht durch einen Klick, sie muss
bereits existieren, und build-docs-shots.ts gibt jeder Aufnahme einen neuen
`browser.newContext()`. Es würde eine leere Liste veröffentlichen. Dieselbe Abhängigkeit hat die
Aufnahme `projects` (jetzt in find-your-work.md); erneut prüfen, wenn die Pipeline einen
Hook zum Vorbelegen des Speichers erhält.
-->

**View sessions** erscheint nur, wenn etwas ausgewählt ist. Klicken Sie mit der rechten Maustaste auf eine einzelne, nicht ausgewählte Karte, um **N saved sessions** zu öffnen: eine Liste der gespeicherten Sitzungen dieses Tools, in der Löschen eine Sitzung in den Papierkorb verschiebt.

<!--i:eti-layers-->
## Auf einem Smartphone

Auf einem schmalen Bildschirm wird das Layout einspaltig:

- Die **Steuerelemente werden zu einem Panel** oben mit einem Ziehgriff am unteren Rand. Ziehen Sie den Griff, um bei **peek**, **half** oder **full** einzurasten, oder tippen Sie darauf zum Ein- und Ausklappen. Die Vorschau füllt den Raum darunter und bleibt während der Bearbeitung sichtbar.
- Eine schwebende Schaltfläche **Export** öffnet das Export-Panel: Format, Größe, Kopieren, Speichern und Herunterladen. Tippen Sie auf den Hintergrund, um das Panel zu schließen.

![Ein Tool auf einem Bildschirm in Smartphone-Breite - die Steuerelemente als Panel oben, die erzeugte Palette in der Vorschau darunter und die schwebende Render-Pille unten in der Mitte](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Faltbare Geräte und iPhone Duo

Auf einem faltbaren Gerät, einem iPhone Duo oder einem nahezu quadratischen Touchscreen teilt Lolly ein Tool in zwei Bereiche auf:

- **Steuerelemente auf einer Seite, Arbeitsfläche auf der anderen.** Die Steuerelemente liegen auf der Seite gegenüber Ihrer Zeichenhand. Wählen Sie **Dominant hand** unter **Settings → Accessibility** oder drücken Sie **Swap sides** oben bei den Steuerelementen. Bei einer Sprache mit Leserichtung von rechts nach links werden die Seiten gespiegelt.
- **Die Trennlinie ist das Scharnier.** Wenn das Gerät seine Faltkante meldet, treffen die Bereiche dort aufeinander, sodass keine Steuerelemente oder Grafiken auf der Falte liegen. Auf einem durchgehenden Bildschirm ziehen Sie die Trennlinie auf ein Drittel, die Hälfte oder zwei Drittel der Breite. Lolly merkt sich Ihre Wahl für jede Ansicht auf diesem Gerät.
- **Auf dem Tisch.** Bei halb geöffnetem Gerät mit quer verlaufender Faltkante nimmt die Arbeitsfläche die obere Hälfte ein, und die Steuerelemente liegen unterhalb der Falte. Beim Präsentieren steht die Folie oben, darunter Ihre Notizen, die nächste Folie sowie **Back** und **Next**. In Sequence steht die Vorschau oben und die Zeitleiste unten.
- **Lolly Design, Design System Setup und Assets.** In Lolly Design liegen Inspektor, Ebenen und Export-Panel als Tabs neben der Arbeitsfläche. Die Werkzeuge stehen am äußeren Rand der Arbeitsfläche, unter Ihrer Zeichenhand. Wenn die Werkzeuge nicht hineinpassen, lässt sich die Spalte scrollen. Ein verblassender Rand mit Pfeil zeigt, in welcher Richtung die übrigen liegen. Auf dem Tisch stehen die Werkzeuge am unteren Rand der Arbeitsfläche. Lolly Design System Setup hält das Board auf einer Seite und den geöffneten Raum auf der anderen. In Assets öffnen sich die Details eines Assets neben der Bibliothek, sodass der nächste Tipp das nächste Asset an derselben Stelle zeigt.
- **Nichts auf der Falte.** Bei einer gemeldeten Faltkante öffnet sich ein Dialog auf der Seite mit den Steuerelementen. Dasselbe gilt für das Suchfeld am unteren Rand des Startbildschirms und seine Ergebnisse. Auf einem flachen Bildschirm bleiben sie in der Mitte.
- **Beim Falten geht nichts verloren.** Beim Falten, Aufklappen oder Drehen des Geräts bleiben Ihr Dokument, Ihre Auswahl, der Zoom und das Feld, in dem Sie gerade tippen, samt Cursorposition erhalten.

Der äußere Bildschirm eines faltbaren Geräts behält das oben beschriebene Smartphone-Layout. Dasselbe gilt für ein Lolly-Fenster in einer Hälfte eines geteilten Bildschirms.

<!--i:eti-smile-->
## Einstellungen, Ton und Komfort

**Settings** am unteren Rand des Startbildschirms enthält Ihre Angaben, Ihre Designsysteme, Barrierefreiheit, Speicher und Offline-Downloads. [Lolly-Einstellungen](/info/dashboard.html) beschreibt jeden Tab.

- **Ihre Angaben und Ihr Porträtfoto** werden in alle Tools eingesetzt, die dafür vorgesehen sind, etwa eine E-Mail-Signatur oder ein Badge. [Profile](/info/profile.html) beschreibt sie.
- **Accessibility** bietet vier Komfortschalter: **Reduce motion**, **Hide colourful previews**, **High contrast** und **Large text**. Sie ändern die App rund um Ihre Arbeit, niemals die Arbeitsfläche eines Tools oder einen Export. Daneben legt **Dominant hand** fest, auf welcher Seite bei zwei Bereichen die Steuerelemente liegen.
- **Sound** begleitet Ihre Aktionen mit sanften, unterstützenden Klängen, und **Neurospicy Mode** spielt ruhige Musik zur Konzentration. Beide sind ausgeschaltet, bis Sie sie unter **Settings → Accessibility** oder im Profilmenü einschalten. Der Schieberegler **Sound shape** unter dem Sound-Schalter verschiebt die Klänge von weichen, runden Tropfen (Bouba) zu trockenen Klicks und Kratzgeräuschen (Kiki), mit den Lolly-Klängen in der Mitte. Zu den Titeln von Neurospicy gehören Lollys generierte Sender: **Lolly Sings** mit seinen Genres und drei **Lofi stations**. Die Sender erzeugen beim Abspielen endlose Musik. Jeder bietet Steuerelemente für Schlagzeug und Klangtextur (bei Lofi auch für die Stimmung), einen Link zum Teilen der gerade gehörten Melodie und eine Schaltfläche, die die Melodie in Ihren Assets speichert. [Generierte Musik](/info/generated-music.html) erklärt, wie eine Melodie entsteht. Mit **Music generator** unter Utilities (`#/music`) können Sie eine gestalten.
- **Available offline** lädt den Rest der App, Ihre Tools, den Katalog und die Anleitungen herunter, bevor Sie die Verbindung verlieren. Um Lolly als Web-App zu installieren, verwenden Sie die Installationsschaltfläche Ihres Browsers oder *Add to Home Screen* auf einem Smartphone. Die installierte App läuft im Vollbild und aktualisiert sich selbst, sobald Sie wieder online sind.
- **Performance UI** unter **Settings → Feature flags** gibt der App ein einfacheres Erscheinungsbild, das sich mit weniger Aufwand zeichnen lässt. Die Arbeitsflächen der Tools und Exporte bleiben gleich. Auf einem langsamen Gerät schaltet Lolly dieses Erscheinungsbild selbst ein und nennt den Grund, mit **Undo** und **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** zeigt, was Lolly auf diesem Gerät speichert. [Wenn Sie Ihre Browserdaten löschen](/info/find-your-work.html#if-you-clear-your-browser-data) erklärt, was dabei entfernt wird. Die [Datenschutzerklärung](/info/privacy.html) listet alles auf, was die App abruft oder sendet.

::: note Wenn eine Ansicht nach einem Update nicht lädt
Ein leeres Panel oder die Meldung „failed to fetch“ direkt nach einem Update verschwindet meist nach einmaligem Neuladen. Ihre gespeicherten Werke, Sitzungen und Designsysteme bleiben unberührt, da sie auf Ihrem Gerät gespeichert sind. Nur ein Bild, das Sie hinzugefügt und nie gespeichert haben, müssen Sie möglicherweise erneut hinzufügen.
:::

<!--i:eti-map-pin-->
## Nächste Schritte

- **[Lolly Design: die freie Arbeitsfläche](/info/design.html)**: die Arbeitsfläche, Formen, die Zeitleiste und das Präsentieren eines Decks.
- **[Batch und Lolly Multi-edit](/info/batch.html)**: viele Versionen eines Designs oder mehrere gespeicherte Designs gemeinsam bearbeiten.
- **[Eine Datei exportieren](/info/exporting.html)**: Format, Größe, Druckeinheiten, Transparenz und Video auswählen.
- **[Ein Design importieren](/info/design-import.html)**: eine Figma-, Penpot-, Illustrator-, InDesign-, Affinity- oder DXF-Datei in Lolly Design übernehmen und weiterbearbeiten.
- **[Vorlagen](/info/templates.html)**: gespeicherte Ausgangspunkte für ein Tool.
- **[Erweiterte Farbräume und HDR](/info/hdr-editing.html)**: die ursprüngliche Bildpräzision in Lolly Design und Lolly Darkroom erhalten.
- **[Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html)**: wo alles liegt und wie Sie es auf ein anderes Gerät übertragen.
