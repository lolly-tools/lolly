# Lolly verwenden

Sie haben Lolly geöffnet und wollen etwas erstellen, behalten und weitergeben. Diese Seite führt diesen Kreislauf durch: ein Tool öffnen, ändern, was es Ihnen zu ändern erlaubt, das Ergebnis speichern und es als Link oder Datei teilen.

Alles hier läuft auf Ihrem Gerät, ohne Konto, und funktioniert weiter offline, sobald die Tools und Assets, die Sie brauchen, heruntergeladen sind. Die App braucht zum Start einen Browser oder eine App mit WebGPU; [Unterstützte Umgebungen](/info/supported-environments.html) listet die getesteten auf.

## Sich zurechtfinden

::: figure using-app-map
Der Startbildschirm: vier Tabs oben und die Leiste am unteren Rand. Ein geöffnetes Tool zeigt seine Steuerelemente neben einer Live-Vorschau.
:::

Oben auf dem Startbildschirm laufen vier Tabs: **Tools**, **Utilities**, **Assets** und **Projects**. Tools sind das, womit Sie erstellen, Utilities sind Werkbänke für Aufgaben wie das Umwandeln, Prüfen oder Bereinigen einer Datei, Assets ist Ihre Bibliothek, und Projects enthält, was Sie gespeichert haben.

Die Leiste am unteren Rand enthält **Open**, **Settings**, ein Suchfeld, **Verify** und **What?**. Sie erscheint bei Tools, Utilities, Assets, Projects, Settings und den Anleitungen, die Sie in der App lesen, und weicht, sobald ein Tool geöffnet ist. Die [Suche](/info/search.html) erreicht von diesem Feld aus Ihre Tools, gespeicherte Arbeit, Assets und Einstellungen. [Ask Lolly](/info/ask.html) beantwortet eine getippte Frage mit dem passenden Abschnitt dieser Anleitungen.

Klicken Sie auf eine Karte, um in diesem Tool etwas Neues zu beginnen. Gespeicherte Arbeit öffnen Sie stattdessen über **Projects** wieder.

![Eine Galerie-Kachel mit Beispielnavigation und einer Neu-Aktion](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Jedes Tool ist eine geteilte Ansicht: auf der einen Seite die **Steuerelemente**, auf der anderen eine Live-**Vorschau**. Ändern Sie ein Steuerelement, und die Vorschau folgt sofort; was Sie sehen, wird exportiert.

![Die geteilte Ansicht eines Tools - der Kontrollstapel links und das live gezeichnete gruppierte Balkendiagramm rechts](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** ist die Ausnahme. Es öffnet sich als freie Arbeitsfläche aus Boxen, die Sie ziehen, in der Größe ändern und in die Sie tippen, mit eigener oberer Leiste, Zeitleiste und Deck-Steuerung. [Design: die freie Arbeitsfläche](/info/design.html) ist seine Anleitung.

## Ändern, was das Tool zu ändern erlaubt

Ein Tool zeigt nur die Eingaben, die sich ändern sollen. Seine Autorin oder sein Autor hat Farben, Layout, Schrift und Logik bereits festgelegt, sodass alles, was Sie erstellen, deren Regeln einhält. Zu den Eingaben gehören Text, Schieberegler, Farbwähler, Dropdowns, Daten, Bildauswahlen und wiederholte Zeilengruppen, und manche liegen in einklappbaren Abschnitten.

![Die Steuerelemente eines Tools - ein Textfeld, Farbschaltflächen und ein Schieberegler, mehr hat der Autor nicht freigegeben](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klicken Sie auf das Design, um sein Steuerelement zu finden.** Klicken Sie in der Vorschau auf ein beliebiges Element, und das passende Steuerelement erhält den Fokus und wird in die Ansicht gescrollt. In einer wiederholten Zeilengruppe klappt genau die Zeile auf, die Sie angeklickt haben.

**Clear changes** über den Steuerelementen setzt jede Eingabe auf ihren Standard zurück.

**Optionen des Designsystems.** Wenn Ihr Designsystem mehr als eine Farbvariante, einen hellen und einen dunklen Look oder eine andere Designwahl bietet, enthält ein Abschnitt **Design system** unter den Steuerelementen diese. Eine Wahl erscheint nur, wenn sie dieses Tool verändert; ein Datei-Utility zeigt also gar keinen Abschnitt. Jede Farbvariante ist ein Punkt in ihren eigenen Farben, hell und dunkel sind zwei Schaltflächen, und jede andere Wahl ist eine Liste.

Die Wahl gehört zu diesem Werk. Sie reist im Link und in der gespeicherten Sitzung mit, jede mit dem Designsystem verknüpfte Farbe folgt ihr, und die eigenen Farben der App bleiben, wie sie sind. Design zeigt dieselben Wahlmöglichkeiten im Tab **Canvas** des Inspektors. Ein Tool, dessen Farben sein Inhalt sind, kann bei der kanonischen Farbvariante bleiben und bietet dann keine Farbvarianten-Punkte. [Lolly Demo im Einsatz](/info/lolly-demo-in-use.html#colourways-on-real-work) zeigt Farbvarianten an echter Arbeit.

### Die Vorschau zoomen und verschieben

Die Vorschau zeigt immer genau das, was exportiert wird.

- **Zoomen:** Cmd/Strg-Scrollen oder Spreizen auf einem Trackpad, zentriert auf Ihren Zeiger. Auf der Tastatur passt `0` das Fenster an, `1` ist 100 % und `+` / `−` zoomen.
- **Verschieben:** Halten Sie **Space** und ziehen Sie, oder ziehen Sie mit der mittleren Maustaste. Einfache Klicks bleiben frei zum Anklicken von Teilen des Designs.
- **Touch:** Zum Zoomen spreizen, zum Verschieben ziehen und zum Anpassen doppeltippen.
- **Zoom-HUD:** Halten Sie den Lolly-Wirbel in der Ecke gedrückt, um `−`, **Fit** und `+` auszuklappen. Ein kurzes Tippen auf den Wirbel öffnet weiterhin Ihr Profilmenü.

Eine Änderung der Ausgabegröße bringt die Ansicht immer auf eine saubere Anpassung zurück.

![Das Zoom-HUD, aus dem Wirbel in der Ecke der Arbeitsfläche ausgeklappt - Minus, Fit, Plus, dann die Umschalter für Design und Ton und der Griff zum Verschieben](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Rückgängig und Wiederholen

**Cmd/Strg-Z** geht einen Schritt zurück und **Cmd/Strg-Umschalt-Z** (oder **Cmd/Strg-Y**) einen Schritt vor. Dasselbe Paar steht als Schaltflächen **Undo** und **Redo** über den Steuerelementen (in Design in der oberen Leiste), und jede wird grau, wenn nichts mehr zurückzunehmen ist. Eine Meldung nennt, welche Eingabe jedes Rückgängigmachen wiederhergestellt hat, mit einer Schaltfläche **Redo** in der Meldung.

- **Ein Ziehen ist ein Schritt.** Wiederholte Änderungen an einem Steuerelement innerhalb einer halben Sekunde werden zusammengefasst, sodass das Ziehen eines Schiebereglers über seinen Bereich ein einziges Rückgängigmachen ist.
- **Die letzten 100 Schritte werden behalten.** Eine neue Änderung nach einem Rückgängigmachen leert den Vorwärts-Stapel.
- **In einem Textfeld** gehört Cmd/Strg-Z dem Feld, Zeichen für Zeichen. Lolly übernimmt bei Schiebereglern, Dropdowns, Farben und Schaltern.
- **Eine Datei auswählen** in einem Dateifeld ist kein Schritt, weil diese Bytes nur für diese Sitzung gehalten werden.

In einer Live-[Zusammenarbeit](/info/collaborate.html) bleibt Ihr Verlauf Ihr eigener: Eine Änderung vom anderen Gerät landet nie auf Ihrem Stapel. Das Rückgängigmachen gilt, bis Sie das Tool verlassen oder neu laden. Für Älteres behalten Tools, die während der Arbeit speichern, frühere Versionen unter **History**; siehe [Zu einer früheren Version zurückgehen](/info/find-your-work.html#go-back-to-an-earlier-version).

### Live-Kamera

Die Effekte des Tools **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art und Glitch) zeigen eine Schaltfläche **Go live**, wo eine Kamera verfügbar ist. Schalten Sie sie ein, und der Effekt folgt Ihrer Webcam Bild für Bild; ein Bewegungsexport hält das Ergebnis als GIF, WebM oder MP4 fest. Die Bilder werden auf Ihrem Gerät verarbeitet, und die Kamera wird freigegeben, sobald Sie stoppen oder das Tool verlassen. Jede Bildauswahl hat außerdem **Take a photo** für ein einzelnes Bild.

## Speichern & Fortsetzen

Um Ihre Arbeit zu behalten, drücken Sie **Save**, das Häkchen neben **Export** in der Render-Pille. Neue Arbeit geht in **My library**, früher gespeicherte Arbeit wird dort aktualisiert, wo sie liegt, und nichts wird heruntergeladen. Das Export-Panel hat dieselbe Schaltfläche **Save**.

Um zu wählen, wohin sie geht, drücken Sie **Save as** neben **Download** im Export-Panel. Lassen Sie unter **Save to a project** **My library** ausgewählt oder wählen Sie ein Projekt (**＋ New project…** legt eines an) und drücken Sie dann **Save**; **Save as a template** behält das Design als [Vorlage](/info/templates.html), als Ausgangspunkt für neue Dokumente. In Design finden Sie **Save as** im Lolly-Menü; auf einem Smartphone drücken Sie **•••**, dann **File menu**, dann **Save as**.

![Die zweigeteilte Render-Pille: Export, mit einem Aufwärtspfeil, der das Export-Panel öffnet, und Save, mit einem Häkchen, das an Ort und Stelle speichert](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Drücken Sie **Save** in der Render-Pille oder **Save as**, um ein Projekt zu wählen.
- <!--i:folder--> Das Element geht in **My library** oder in das Projekt, das Sie gewählt haben.
- <!--i:home--> Später drücken Sie oben links **Home** und öffnen den Tab **Projects**.
- <!--i:document--> Öffnen Sie das Element. Jede Einstellung ist wieder da, bereit zur Änderung und zum erneuten Export.
:::

Elemente tragen den Dateinamen, den Sie im Export-Panel eingetippt haben, oder sonst den ihres Tools, etwa **QR Code**. Eine Datei, die Sie mit **Download** erhalten, ist eine fertige Kopie; um sie später zu ändern, öffnen Sie das gespeicherte Element in Projects.

Persönliche Speicherstände bleiben auf diesem Gerät, in dem Browser oder der App, aus der Sie gespeichert haben, es sei denn, Sie schalten [Sync](/info/sync.html) ein. Wenn etwas nicht dort ist, wo Sie es erwarten, behandelt [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html) jeden Fall, vom geschlossenen Tab bis zu gelöschten Browserdaten.

::: details Team-Projekte mit Lolly Work (optional)
Wenn Ihre [Organisation Lolly Work nutzt](/info/organisation.html), melden Sie sich an ihrer Instanz an und öffnen Sie **Projects → Team projects** für Sitzungen, die mit Ihnen geteilt wurden. Die Organisation legt Zugriff und Aufbewahrung fest, und ihr Lolly-Work-Dienst speichert diese Sitzungen. Eine geteilte Sitzung tritt ihrer Live-Collab beim Öffnen bei, wenn Ihre Organisation Live-Bearbeitung erlaubt; [Zusammenarbeiten](/info/collaborate.html#work-collabs-with-lolly-work-optional) erklärt die Schritte.

Ihre persönliche Bibliothek bleibt getrennt. Die Anmeldung auf einem anderen Gerät gibt Ihnen Team-Arbeit, während persönliche Speicherstände weiterhin Sync oder ein Backup brauchen, um zu wandern.
:::

## Ihre Arbeit teilen

Ein Design geht als Link oder als Datei hinaus. **Share** in den Export-Steuerelementen öffnet einen Dialog, der beides bietet, und **Share link** bei einer gespeicherten Sitzung in Projects öffnet denselben Dialog für diese Sitzung.

::: cols
## Ein Link

- Trägt jede Eingabe in der Adresse, sodass der Link das Design reproduziert.
- Lässt Bilder und Dateien zurück, die Sie von diesem Gerät hinzugefügt haben, sehr langen Text und sehr große Listen.
- Öffnet sich in jedem Browser, sodass Sie den Link als Lesezeichen speichern, einfügen oder committen können.

## Eine .lolly-Datei

- Trägt die gespeicherte Sitzung mit den Bildern und Dateien auf diesem Gerät und kann das Tool und das Designsystem ebenfalls tragen.
- Hält lizenzierte Katalogkunst zurück, sofern Sie nicht wählen, die Dateien einzuschließen.
- Öffnet sich in Lolly: per Doppelklick, mit **Open** oder indem Sie sie auf die App ziehen.
:::

### Der Link

Der kopierfertige Link steht oben im Dialog, mit **Copy** und einer Schaltfläche **QR**, die das Tool QR Code mit dem Link öffnet. Unter dem Link enthält **Link options**:

- **Open in the installed app** schaltet den Link auf eine `lolly://`-Adresse für Kurzbefehle, Launcher und Automatisierung um, mit unveränderten Parametern.
- **Shortest link** packt ein langes Design in ein kompaktes Token und zeigt die Ersparnis in Zeichen. Die lesbare Form ist immer ebenfalls da.
- **Password-protect this link** verschlüsselt den Link auf Ihrem Gerät mit AES-256. Das Passwort ist nie Teil des Links.
- **Pin this tool version** fügt das Flag `_v` hinzu, sodass ein späteres Tool-Update nicht ändern kann, was der Link rendert.
- **When the recipient opens the link…** wählt Vollbild, das bereits aufgeklappte Export-Panel, einen Download beim Öffnen (`&export`) oder eine Kopie in die Zwischenablage (`&copy`).
- **Copy credit** kopiert eine Bildunterschrift "Made with Lolly" mit dem Link, für einen Beitrag oder eine Folie.

Wenn ein Tool persönliche Felder enthält, etwa Ihren Namen, hält **Review personal fields** jedes aus dem Link heraus, bis Sie dieses Feld ankreuzen. [URL-Modus](/info/url-mode.html) behandelt alles, was ein Link tragen kann.

**Der Dialog sagt, was ein Link nicht tragen kann.** Ein Bild oder eine Datei, die Sie von diesem Gerät hinzugefügt haben, ein sehr langer Textwert und eine sehr große Liste passen nicht in eine Adresse. Jedes wird beim Erstellen des Links gezählt. Musste etwas weggelassen werden, listet der Dialog es auf und verweist Sie auf die Dateioption, statt Ihnen einen Link zu geben, der ohne Bild geöffnet wird. Ein Link, der nur lang ist, erhält einen milderen Hinweis mit seiner Zeichenzahl.

**Manche Tools machen den Link zum ganzen Produkt.** Jump Page sammelt Ihre Links auf einer Seite zum Verteilen: ein Bio-Link, ein Vortrag, ein Schaufenster. Nichts wird gehostet, und hinter der Seite steht kein Konto, denn die Seite ist der Link. Besucher erhalten sie in voller Breite, ein Link pro Szene beim Scrollen.

![Jump Page im Editor: die Überschriften-Szene oben auf der Seite, darunter die Link-Szenen](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Von der Organisation verwaltete Links mit Lolly Work
Für Freigaben, die einen Ablauf, einen Widerruf oder ein Passwort brauchen, bietet Lolly Work verwaltete Links zu gemeinsamen Sitzungen, Tools und Katalog-Assets. Sie werden über den Dienst der Organisation aufgelöst und folgen deren Zugriffsregeln. Sie sind getrennt von den in sich geschlossenen Links oben, und das Widerrufen eines Links kann keine Datei zurückholen, die jemand schon heruntergeladen hat. [Rendern und Teilen](/info/manage/sharing.html) listet die Linktypen und Berechtigungen auf.
:::

### Die .lolly-Datei

**Download .lolly** im Abschnitt **Editable file** des Share-Dialogs schreibt das aktuelle Design als eine Datei. Sie trägt die gespeicherte Sitzung mit den Bildern und Dateien auf diesem Gerät, und gewöhnliche Katalogkunst reist mit. Eine veraltete oder nicht verfügbare Datei bleibt ein externer Verweis, statt zu verschwinden. Vor dem Speichern zeigt der Dialog die Größe der Datei, wie viele Dateien sie einbettet, wie viele sie referenziert und ob das Tool enthalten ist. Wo Ihr Gerät ein Share-Sheet hat, gibt **Send to…** die Datei direkt dorthin weiter (AirDrop, ein Android-Teilen).

**Download project (.lolly)** im Menü eines Ordners in **Projects** schreibt einen ganzen Ordner, damit jemand anderes mit jeder Sitzung im Ordner weitermachen kann. Batch-Sitzungen bleiben zurück, und der Hinweis nennt, wie viele. **Download originals** im selben Menü schreibt ein einfaches Zip mit jedem Element als eigener Datei.

Drei Dinge liegen bei Ihnen, bevor eine Datei hinausgeht:

- **Ob Ihr Name hineinkommt.** Ihr Name, Ihre E-Mail-Adresse und Ihre Organisation werden nur geschrieben, wenn **Use my details to create** in [Ihrem Profil](/info/profile.html) eingeschaltet ist. Ist es aus, hält die Datei nur fest, dass sie mit Lolly erstellt wurde, und wann.
- **Ob zurückgehaltene Kunst hineinkommt.** Lizenzierte Kunst, markengebundene Kunst und Katalogwerke, deren Lizenz nie erfasst wurde, bleiben standardmäßig draußen. Verwendet das Design welche, nennt der Dialog die Zahl und bietet *Download without them* oder *Include and download*, denn ihr Einschluss gibt die Dateien an alle weiter, die die `.lolly` öffnen. Die `CREDITS.txt` der Datei listet auf, was mitgereist ist und was nicht, mit Grund; [Kreativrechte und Credits](/info/creative-rights.html) erklärt die Regeln.
- **Ob das Tool hineinkommt.** **Include the tool** packt die eigenen Dateien des Tools, sodass sich das Design auf einem Gerät ohne dieses Tool öffnet. Es ist bei einem eigenen Tool, etwa einem Fork, angekreuzt und bei einem Tool, das der signierte Katalog führt, nicht. Bei einem Build ohne signierten Katalog gilt jedes Tool als eigen.

**Eine öffnen.** In den Desktop- und Mobil-Apps doppelklicken oder tippen Sie eine `.lolly`, wählen **Open with Lolly** oder senden sie aus dem Share-Sheet an Lolly. In der Web-App drücken Sie **Open** oder legen die Datei auf Lolly ab. Jeder Weg liest zuerst das Manifest der Datei und zeigt ihre Größe, ihren Inhalt und was geschehen wird, bevor irgendetwas geschrieben wird.

Trägt die Datei ein Tool, das Sie nicht haben, zeigt **Trust this tool?** das Tool und seine Autorin oder seinen Autor und sagt, dass das Öffnen den eigenen Code des Tools auf Ihrem Gerät ausführt. **Trust & install** fährt fort. Lehnen Sie ab, wird die Arbeit trotzdem in Projects gespeichert und wartet auf den Tag, an dem Sie das Tool hinzufügen. Ein Tool, dessen Code als Modul ausgeliefert wird, lässt sich so noch nicht installieren und wird auf dieselbe Weise abgewiesen.

::: details Was eine .lolly enthält und wie das Öffnen funktioniert
`.lolly` ist Lollys Bundle-Erweiterung, und das `format` in ihrer `manifest.json` sagt, was darin liegt:

- Ein **geteiltes Design** (`lolly-share`) enthält eine gespeicherte Sitzung, ihre eingebetteten Dateien und einen Beleg für alles, was noch per Verweis aufgelöst wird. Es kann auch das Tool und das Designsystem tragen. Das Öffnen fügt ein neues Projekt hinzu und überschreibt nie eine Sitzung.
- Ein **geteiltes Projekt** (`lolly-share`, Art `project`) enthält einen Ordner aus Projects: seine Unterordner, jede Sitzung darin mit ihrer Kachel und die dort abgelegten Bilder. Das Öffnen fügt eine Kopie des ganzen Ordners hinzu. Jede Sitzung reist als `sessions/<key>.json` mit ihrer Kachel unter `thumbs/`. Ein Lolly aus der Zeit vor Projektdateien bittet Sie um ein Update.
- Ein **Designsystem-Paket** (`lolly-brand`) enthält Tokens und kann Schriften, Logos, veröffentlichte Versionen und behaltene Ressourcen enthalten. Das Öffnen des Pakets fügt ein eigenes benanntes Designsystem hinzu und macht dieses aktiv.
- Ein **Workspace- oder Instanz-Paket** ist ein `lolly-brand` mit deklarierten Tools, Katalog-Assets und gegebenenfalls einer Instanzadresse. Das Laden eines solchen ersetzt das zuvor geladene einzelne Workspace-Overlay, und die Vorschau listet diese gerätweiten Auswirkungen auf.

Ein vollständiges Geräte-Backup ist keine `.lolly`. Es bleibt eine `LollyTools-….zip` (Format `lolly-backup`) und wird über **Settings → Storage → Import data…** wiederhergestellt. Ein gezippter Tool-Ordner bleibt ebenfalls eine `.zip`. [Datenübertragung](/info/data-transfer.html) ist die Formatreferenz.

Eine `.lolly` ist ein gewöhnliches Zip. Benennen Sie sie in `.zip` um, um hineinzuschauen: Ihre eigenen Bilder liegen unter `assets/uploads/`, Katalogkunst unter `assets/catalog/`, `manifest.json` listet jede Datei auf, und eine README sagt, was die Datei ist.

macOS, Windows, Linux, iOS und Android registrieren das Format alle, Desktop-Dateimanager zeigen es als Lolly-Dokument an, und GNOME Files kann das eigene Vorschaubild einer gespeicherten Sitzung zeigen. Das Öffnen aus Design System Setup empfiehlt die Designsystem-Aktion, wenn ein geteiltes Design eines trägt, blendet aber **Open shared design** nie aus.

Ein Dokument, das auf iOS oder Android von einer anderen App übergeben wird, ist auf 48 MB begrenzt, weil die Übergabe seine Bytes über die App-Grenze kopiert, und die App sagt das. **Open** innerhalb von Lolly hat keine solche Grenze; nutzen Sie es für ein größeres Bundle.

Nach Ihrer Bestätigung entpackt und prüft Lolly das Bundle einmal. Assets gehen in Ihre Bibliothek, per Prüfsumme abgeglichen, sodass eine Datei, die schon auf dem Gerät liegt, wiederverwendet wird. Sitzungen gehen mit neuen IDs nach Projects, sodass dieselbe Datei zweimal geöffnet werden kann; eine Sitzung, deren Tool fehlt, wartet dort. Dateien über 100 MB werden als groß gekennzeichnet, und die Vorschau warnt, wenn der Browserspeicher weniger freien Platz meldet, als die Datei braucht. Jeder durch Integrität abgedeckte Teil wird geprüft, bevor irgendetwas übernommen wird, und eine beschädigte Kopie wird abgelehnt, ohne dass etwas zurückbleibt.
:::

Ein Link und eine Datei übergeben beide eine Momentaufnahme. Für Live-Bearbeitung behandelt [Zusammenarbeiten](/info/collaborate.html) private Collabs zwischen zwei Geräten und optionale Work-Collabs über Lolly Work.

## Assets - Ihre Bibliothek

**Assets** (`#/a`) versammelt alles, worauf Ihre Tools zurückgreifen können: Markenlogos, Bilder, Audio und Bewegung, nach Art gruppiert, zusammen mit Ihren eigenen Dateien. Ihre Uploads werden auf Ihrem Gerät gespeichert. Eine Organisation, die Lolly Work nutzt, kann auch einen gemeinsamen Katalog unter ihren eigenen Zugriffsregeln bereitstellen; siehe [Lolly in Ihrer Organisation nutzen](/info/organisation.html).

![Assets, mit den Farbmustern und Schriften der Marke sowie Ihren eigenen Uploads](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Bringen Sie Ihre Dateien mit.** Legen Sie ein Bild, eine SVG, einen Audioclip, ein Video, eine Lottie, ein PDF oder ein PowerPoint-Deck auf dem Upload-Bereich ab oder klicken Sie zum Auswählen. Es erscheint sofort in Assets und in der Asset-Auswahl jedes Tools. Ein mehrseitiges PDF oder eine `.pptx` fragt, welche Seiten oder Folien Sie behalten wollen, und jede wird zu einem SVG-Asset. Ein Bild, das Sie in einem Tool hinzufügen, wird so behalten, wie es ankam, in **My images**, sodass ein darauf liegendes Content Credential weiterhin verifiziert, und nur eine sehr große Datei fragt, ob sie verkleinert werden soll. **Settings → Storage** zeigt, wie viel **My images** enthält. Es gibt keine Grenze außer dem Speicher Ihres Geräts. Um EXIF- und GPS-Daten beim Hereinkommen von Bildern zu entfernen, schalten Sie unter **Settings → Feature flags** **Strip metadata from uploads** ein; Content Credentials bleiben in beiden Fällen erhalten.
- <!--i:star--> **Markieren Sie, wonach Sie greifen.** Markieren Sie ein Asset oder ein Markenmuster mit einem Stern, und es wird oben in jeder Auswahl angeheftet.
- <!--i:folder--> **Aufräumen.** Verschieben Sie ein Asset in eine andere Gruppe, blenden Sie ein gemeinsames Marken-Asset aus, das Sie nicht nutzen (**Show hidden** bringt es zurück), oder löschen Sie Ihre eigenen Uploads. Dieselbe Auswahlleiste wie in Projects wirkt auf eine ganze Auswahl.
- <!--i:layers--> **Ein Video vom Hintergrund lösen.** Öffnen Sie die Details eines Videos oder klicken Sie in einer Asset-Auswahl mit der rechten Maustaste auf seine Karte und wählen Sie **Remove background…**. Ein **On-device model** schneidet ein Motiv aus einer unruhigen Szene frei; ein **Colour key** entfernt einen gleichmäßig ausgeleuchteten Hintergrund wie einen Greenscreen, mit **Tolerance**, **Softness** und **Spill removal** für die Kante, und braucht keinen Download. **Resolution** (360, 480, 720 oder 1080p, nie über der Quelle) tauscht Detail gegen Tempo. Der Ausschnitt, ein animiertes WebP oder PNG mit echter Transparenz, wird neben dem Original gespeichert, und das Content Credential der Quelle reist als Ingredient mit. [Einmal erzeugt, gleich gerendert](/info/ai-features.html) erklärt, warum das eine einfache Bearbeitung bleibt.

### Nehmen Sie Palette und Schriften überallhin mit

Das Panel **Swatches** in Assets zeigt die Farben, aus denen Ihre Marke besteht: ihre Markenfarben, von Ihnen hinzugefügte Farben, ihre Verläufe und ihr Spektrum. Die Rollenfarben, die Lolly für die Oberfläche führt (Text, Flächen, Kanten, Leitfarben der Farbvarianten und Kopien einer Markenfarbe unter anderem Namen), warten hinter einer grauen Karte **Show colour roles** am Fuß des Panels.

Jede Farbe ist eine Karte wie jedes andere Asset. Klicken Sie auf eine, um ihre Details zu öffnen, wählen Sie einige aus, um nur diese herunterzuladen, oder laden Sie die ganze Palette in dem Format herunter, das Ihr anderes Tool liest:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** oder **CSS classes** für ein Stylesheet oder einen Build. Eine Farbe, die weiter als sRGB reicht, behält ihren weiten Wert: Das CSS setzt ihn nach dem Hex, und das JSON behält das Hex mit der weiten Farbe, dem CMYK-Aufbau und der Sonderfarbe daneben.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** für Illustrator oder Photoshop. Eine an einen CMYK-Aufbau gebundene Farbe kommt als dieses CMYK-Farbfeld an, eine Sonderfarbe als benanntes Sonderfarbfeld und eine Farbe, die weiter als sRGB reicht, als Lab.
- <!--i:pentool--> **GIMP palette (.gpl)** für GIMP oder Inkscape und **SCSS variables**, beide in sRGB.

![Das Panel Swatches - die fünf Palette-Download-Schaltflächen oben, dann jede Markenfarbe als Chip, der ihre Details öffnet](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Wählen Sie Farben mit dem Punkt auf jeder Karte aus: Umschalt-Klick auf einen zweiten Punkt für alles dazwischen, ziehen Sie ein Rechteck durch die Lücken oder drücken Sie Cmd/Strg+A bei fokussierter Karte. Die Leiste bietet **Download as…** in denselben sechs Formaten, **Copy hex** und **Favourite**. Bevor Sie ein Format wählen, listet das Menü jede Farbe auf, die kein Format halten kann (Transparent hat gar keine Farbe), welche Formate eine weite Farbe als ihren sRGB-Ersatz speichern (SCSS und GIMP) und welche die CMYK- und Sonderfarbwerte tragen (JSON und .ase). Klicken Sie mit der rechten Maustaste auf eine Karte für dieselben Aktionen an einer Farbe.

Die Details einer Farbe füllen die Vorschau mit der Farbe und klappen **Linked values** (ihren CMYK-Aufbau oder ihre Sonderfarbe, jeden für einen bestimmten Raum oder eine bestimmte Presse verfassten Wert und ihr Design-Token), **Every notation** (Hex, OKLCH, Display-P3 und die übrigen, jede mit einer Kopierschaltfläche), **Plotted on a colour space**, **Tones** und **Readability** aus. Die Pfeiltasten gehen durch die Palette, **Copy link** teilt die Farbe selbst, und **Open in Colour Lab** führt sie weiter.

Das Panel **Fonts** listet Ihre Markenschriften mit je einem **Download**, zum lokalen Installieren oder zur Weitergabe an eine Druckerei.

## Das Raster zu Ihrem machen

- <!--i:star--> **Markieren Sie, was Sie nutzen.** Klicken Sie mit der rechten Maustaste auf eine Karte und wählen Sie **Add to favourites**, und sie erhält eine große Kachel in einem Streifen über dem Raster. [Ihre Favoriten](/info/favourites.html) behandelt den Streifen.
- <!--i:eyeoff--> **Blenden Sie ein Tool aus, das Sie nie nutzen.** Klicken Sie mit der rechten Maustaste auf eine Karte oder wählen Sie mehrere aus und wählen Sie **Hide tool**. Es fällt aus dem Raster und aus dem, was das Tippen im Raster findet. Eine graue Kachel **Show hidden tools (N)** am Ende blendet sie wieder ein, gedimmt, jede mit **Unhide tool** in ihrem Menü. Das Ausblenden ändert nur Ihr Raster: Das Tool öffnet sich weiterhin über einen Link oder ein Lesezeichen.
- <!--i:clock--> **Ihre Tools zuerst.** Sobald Sie in drei verschiedenen Tools Arbeit gespeichert haben, führt eine Zeile **Yours** mit Chips über dem Raster mit Ihren Favoriten und zuletzt genutzten Tools.
- <!--i:sliders--> **Richten Sie es nach Ihrer Art ein.** **View options** legt das Layout fest (**Grid**, **Card** oder **List**), Kartengröße und Dichte, die Sortierung und einen Kategoriefilter.

![Das Ende des Tools-Rasters mit eingeblendeten ausgeblendeten Tools: die gedimmte Karte Wordmark und daneben die graue Kachel, die sie wieder in die Ansicht geschaltet hat und jetzt Hide hidden tools anzeigt](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Mehrere Karten auf einmal bearbeiten.** Kreuzen Sie das Kästchen jeder Karte an, ziehen Sie ein Auswahlrechteck über leeren Raum oder klicken Sie mit Umschalt/Cmd, und es erscheint eine Leiste mit dem, was diese Ansicht erlaubt:

- **Tools und Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, mit nur den Sitzungen, die mit diesen Tools erstellt wurden) und Copy link für eine einzelne Karte.
- **Assets:** Favourite und Hide für jede Auswahl. Duplicate, Download und Delete erscheinen nur, wenn jedes ausgewählte Element einer Ihrer eigenen Uploads ist, weil ein gemeinsames Designsystem-Asset ein dauerhafter Vertrag ist.
- **Projects:** siehe [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html#find-something-you-saved).

![Die Auswahlleiste der Galerie für zwei Tools, mit Offline verfügbar, Sitzungen anzeigen, Favorit und Ausblenden](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

**View sessions** erscheint erst, wenn etwas ausgewählt ist. Klicken Sie stattdessen mit der rechten Maustaste auf eine einzelne nicht ausgewählte Karte, und sie bietet **N saved sessions**, eine Liste der gespeicherten Sitzungen dieses Tools, in der ein Löschen die Sitzung in den Papierkorb verschiebt.

## Auf einem Smartphone

Auf einem schmalen Bildschirm wird das Layout einspaltig:

- Die **Steuerelemente werden zu einem Blatt** oben mit einem Ziehgriff an seiner Unterkante. Ziehen Sie den Griff, um auf **peek**, **half** oder **full** einzurasten, oder tippen Sie ihn zum Ein- und Ausklappen an. Die Vorschau füllt den Platz darunter und bleibt beim Bearbeiten in Sicht.
- Eine schwebende Schaltfläche **Export** öffnet das Export-Blatt: Format, Größe, Kopieren, Speichern und Download an einem Ort. Tippen Sie auf den Hintergrund, um das Blatt zu schließen.

![Ein Tool auf einem schmalen Smartphone-Bildschirm - oben die Steuerelemente als Bedienfeld, darunter die erzeugte Palette in der Vorschau und die Render-Pille schwebend am unteren Rand](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Einstellungen, Ton und Komfort

**Settings** am Fuß des Startbildschirms enthält Ihre Angaben, Ihre Designsysteme, Barrierefreiheit, Speicher und Offline-Downloads. [Einstellungen](/info/dashboard.html) bildet jeden Tab ab.

- **Ihre Angaben und Ihr Porträtfoto** füllen jedes Tool aus, das dafür gebaut ist, etwa eine E-Mail-Signatur oder ein Namensschild. [Profile](/info/profile.html) behandelt sie.
- **Accessibility** hat vier Komfortschalter: **Reduce motion**, **Hide colourful previews**, **High contrast** und **Large text**. Sie ändern die App um Ihre Arbeit herum, nie eine Tool-Arbeitsfläche oder einen Export.
- **Sound** spielt sanfte unterstützende Töne zu dem, was Sie tun, und **Neurospicy Mode** spielt einen ruhigen Fokus-Track. Beides ist aus, bis Sie es einschalten, unter **Settings → Accessibility** oder im Profilmenü.
- **Available offline** lädt den Rest der App, Ihre Tools, den Katalog und die Anleitungen herunter, bevor Sie die Verbindung verlieren. Lolly ist eine Web-App, die Sie installieren können: Nutzen Sie die Installationsschaltfläche Ihres Browsers oder *Zum Home-Bildschirm* auf einem Smartphone für eine Vollbild-App, die sich selbst aktualisiert, wenn Sie wieder online sind.
- **Storage** zeigt, was Lolly auf diesem Gerät behält. [Wenn Sie Ihre Browserdaten löschen](/info/find-your-work.html#if-you-clear-your-browser-data) erklärt, was das Löschen entfernt, und die [Datenschutzrichtlinie](/info/privacy.html) listet alles auf, was die App abruft oder sendet.

::: note Wenn eine Ansicht nach einem Update nicht lädt
Ein leeres Panel oder eine Meldung "failed to fetch" direkt nach einem Update verschwindet meist mit einem Neuladen. Ihre gespeicherte Arbeit, Ihre Sitzungen und Designsysteme bleiben unberührt, weil sie auf Ihrem Gerät gespeichert sind. Nur ein Bild, das Sie hinzugefügt und nie gespeichert haben, muss eventuell erneut hinzugefügt werden.
:::

## Wie es weitergeht

- **[Design: die freie Arbeitsfläche](/info/design.html)**: die Arbeitsfläche, Formen, die Zeitleiste und das Präsentieren eines Decks.
- **[Batch und Multi-edit](/info/batch.html)**: viele Versionen eines Designs oder mehrere gespeicherte Designs gemeinsam bearbeiten.
- **[Eine Datei exportieren](/info/exporting.html)**: Format, Größe, Druckeinheiten, Transparenz und Video wählen.
- **[Ein Design importieren](/info/design-import.html)**: eine Figma-, Penpot-, Illustrator- oder InDesign-Datei in Design holen und weiterbearbeiten.
- **[Vorlagen](/info/templates.html)**: gespeicherte Ausgangspunkte für ein Tool.
- **[Weiter Farbraum und HDR](/info/hdr-editing.html)**: die ursprüngliche Bildpräzision in Design und Darkroom behalten.
- **[Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html)**: wo alles liegt und wie Sie es auf ein anderes Gerät bringen.
