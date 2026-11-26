# Einstellungen

Die Einstellungen enthalten Ihre Angaben, Ihr Designsystem, Barrierefreiheit, Speicher auf diesem Gerät und Offline-Downloads. Öffnen Sie **Settings** über die Leiste am unteren Rand des Startbildschirms oder über Ihr Avatar-Menü, und es öffnet sich **Preferences**.

| Tab | Adresse | Inhalt |
|---|---|---|
| **Preferences** | `#/settings` | Ihre Angaben, Designsysteme, Erscheinungsbild, Emoji, Barrierefreiheit, Verbindungen, Speicher und Offline-Downloads |
| **This device** | `#/settings?tab=device` | Eine Live-Anzeige dieses Browsers und Geräts, dazu Ton und eine schreibgeschützte Speicheransicht |
| **Design system** | `#/settings?tab=brand` | Das aktive Designsystem als Deckblatt und Seiten, mit einer Leiste aus Deckblättern zum Wechseln zwischen Systemen |
| **Capabilities** | `#/settings?tab=caps` | Alles, was Lolly kann, als durchsuchbare Karten |
| **Activity & stats** | `#/settings?tab=activity` | Der Katalog, Ihre lokalen Zähler und kürzlich bearbeitete Werke |

Alte Links mit `#/profile` und `#/d` öffnen weiterhin die richtige Stelle, bis hin zu einzelnen Einstellungen.

<!--i:eti-sliders-->
## Voreinstellungen

Preferences ist eine lange Seite mit einer **Einstellungsleiste** an der Seite. Das Feld **Search settings** über der Leiste filtert diese beim Tippen. Jeder Abschnitt hat einen Link in der Form `#/settings?focus=<section-id>`, etwa `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - Ihr Name, Ihre Kontaktdaten und Ihr Porträtfoto sowie der Schalter **Use my details to create**. [Profile](/info/profile.html) erklärt, wie Tools sie verwenden.
- <!--i:seal--> **Content Credentials** - die optionale verifizierte Identität, die Ihre Exporte signiert. Siehe [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - Designsysteme wechseln, hinzufügen, ausblenden oder entfernen. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) behandelt jede Aktion.
- <!--i:moon--> **Appearance** - das Design (Light, Dark oder Brand, das die App in Ihre Palette kleidet), **Your colourway**, wenn das Designsystem mehr als eine anbietet ([Eine Farbvariante anpassen](/info/colourways.html#make-a-colourway-your-own)), und **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - der Emoji-Satz für neue Werke mit seiner Grafiklizenz und wie stark Ihre Palette Emoji umfärbt (**Off**, **Subtle**, **Strong**, **Full**, **Mono** oder **Duotone**). **Keep skin tones and flags** belässt diese in ihren eigenen Farben. Bereits erstellte Werke behalten ihren Satz.
- <!--i:eyeoff--> **Accessibility** - vier Komfortschalter sowie Sound und Neurospicy Mode. Siehe [Barrierefreiheit](#accessibility).
- <!--i:link--> **Connected services** - Speicher, den Sie verbinden, etwa Dropbox, Google Drive, OneDrive, Nextcloud oder S3, und **Sync across devices**. Siehe [Ihre Geräte synchronisieren](/info/sync.html).
- <!--i:globe--> **Trusted sites** - die Websites, die eine Webseiten-Box in Lolly Design oder eine Demo in Lolly Sandbox ohne Rückfrage kontaktieren darf, und, wo der Server es anbietet, **Allow pages from any site**. Die [Datenschutzerklärung](/info/privacy.html) listet auf, was jede Anfrage sendet.
- <!--i:download--> **Your renders** - **Save my renders to my library** behält eine Kopie jedes Bildes, Audioclips und Videos, das Sie herunterladen, in Assets unter einem Renders-Tag.
- <!--i:database--> **Storage** - was Lolly auf diesem Gerät speichert und die Schaltflächen, die Ihre Daten löschen oder übertragen. Siehe [Speicher](#storage).
- <!--i:cpu--> **Available offline** - laden Sie herunter, was Sie brauchen, bevor die Verbindung weg ist. Siehe [Offline verfügbar](#available-offline).
- <!--i:folder--> **Hot folder** - in der Desktop-App überwacht Lolly einen Ordner und übernimmt alles, was dort abgelegt wird, über dieselbe Auswahl wie beim Ziehen und Ablegen.
- <!--i:clock--> **Your activity** - was Sie auf diesem Gerät erstellt haben, lokal gezählt.
- <!--i:sliders--> **Feature flags** - Teile der App ein- oder ausschalten, etwa **Print preflight** oder **Strip metadata from uploads**. **Performance UI** gibt der App ein einfacheres Erscheinungsbild, das weniger Rechenaufwand beim Zeichnen braucht. Lolly kann Performance UI auf einem langsamen Gerät selbst einschalten. Die Zeile unter dem Schalter sagt dann, wann und warum, mit **Allow again** ([wie die Entscheidung fällt](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - woher diese Installation ihre Tools und ihren Katalog bezieht. Siehe [Lolly-Instanz](#lolly-instance).

Die Designkarten sind Live-Vorschauen. Ein Design wird sofort nach der Auswahl angewendet, nur auf diesem Gerät.

![Drei Designkarten, jede mit einer Vorschau ihrer eigenen Schrift und Farbe, die aktive ist markiert](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Barrierefreiheit

**Settings → Preferences → Accessibility** enthält vier Komforteinstellungen für die App. Jede ist aus, bis Sie sie einschalten, und keine greift in eine Tool-Arbeitsfläche oder einen Export ein. Eine ruhigere App verschiebt also nie ein Pixel der Datei, die Sie weitergeben. Jede ist standardmäßig aus. Keine verändert eine Tool-Arbeitsfläche oder einen Export.

- <!--i:pause--> **Reduce motion** schaltet die Übergänge, Schiebebewegungen und Ziereffekte der App aus.
- <!--i:photos--> **Hide colourful previews** ersetzt die Vorschaubilder der Galerie durch Karten mit Symbol und Text und dämpft die Vorschaubilder von Projekten, die erkennbar bleiben.
- <!--i:sliders--> **High contrast** hebt Ränder, Text und Fokusringe der App stärker hervor. Ihre Markenfarben und die Arbeitsfläche bleiben so, wie Sie sie eingestellt haben.
- <!--i:font--> **Large text** vergrößert die Beschriftungen, Menüs und Schaltflächentexte der App.

**Dominant hand** (Right oder Left) legt fest, auf welcher Seite die Steuerelemente liegen, wenn Lolly zwei Bereiche zeigt, auf einem faltbaren Gerät oder einem fast quadratischen Tablet. **Swap sides** in der Kopfzeile eines Bereichs ändert dies ebenfalls.

Diese Einstellungen liegen in Ihrem Profil und reisen daher in einem Profilexport mit Ihrem Namen und Ihren Sitzungen mit. Eine Kopie nur auf dem Gerät wendet sie schon vor der ersten Darstellung an.

Dieselbe Karte enthält **Sound**, sanfte unterstützende Töne für Aktionen wie das Öffnen der Galerie, ein Ergebnis von Content Credentials oder das Schließen eines Panels. Sie enthält auch **Neurospicy Mode**, einen ruhigen Titel zum Konzentrieren. Wenn Sie Neurospicy einschalten, öffnet sich ein kleiner Player in der Ecke, der Sie durch die App begleitet. Im Player wählen Sie einen Titel, überspringen ihn, stellen die Lautstärke ein und minimieren oder schließen den Player. Zu den Titeln gehören Lollys generierte Sender, Ambient-Loops und Beats, Ihre eigenen Audiodateien und Internetradiosender, die eine Verbindung brauchen. Beide sind standardmäßig aus, und ihre Einstellung wird gespeichert. Wenn Sie Sound ausschalten, wird auch der Titel zum Konzentrieren stummgeschaltet. Das Profilmenü und **This device** enthalten denselben Schalter.

Ein Schieberegler unter dem Sound-Schalter legt fest, woraus die Klänge bestehen. In Richtung der runden **Bouba**-Form werden sie zu sanften Tropfen, Blasen und etwas Bass. In Richtung des spitzen **Kiki**-Sterns werden sie zu trockenem Ticken, Kratzen und Metallklängen. In der Mitte bleiben Lollys Glockenklänge und Töne. Wenn die Klänge an einem Ende für Sie schwer zu ertragen sind, bewegen Sie den Regler zum anderen Ende. Der Schieberegler funktioniert auch bei ausgeschaltetem Sound, und beim Loslassen wird eine kurze Hörprobe abgespielt.

::: details Die generierten Sender
Die generierten Sender komponieren ihre Musik während der Wiedergabe, ohne Samples und ohne aufgezeichnete Stimmen. Jedes Stück hat seine eigenen Instrumente, seinen eigenen Groove und Ablauf.

- **Lolly Sings** ist eine Familie von Sendern. Das ursprüngliche Lolly Sings ist hell und melodisch: Dur-Tonarten, eine führende Melodie in jedem Stück und Anklänge an Bossa, Shuffle und Chiptune. Jedes Genre hat außerdem seinen eigenen Sender, von Sugar und K-pop bis Country, Jazz, Metal und D&B.
- Die **Lofi-Sender** (Warm, Late night und Rainy) sind endlose Lo-Fi-Beats.

Bei einem generierten Sender wechseln Vor und Zurück zwischen Stücken. Jedes Stück entsteht aus einem Startwert und klingt daher überall gleich, wo Sie es teilen oder speichern (siehe [Generierte Musik](/info/generated-music.html)). Unter den Wiedergabesteuerelementen wechselt **Mood** zwischen den Lofi-Sendern, **Drums** nimmt das Schlagzeug heraus und **Texture** reicht von sauber bis zum Klang einer staubigen Schallplatte. Darunter folgt eine Reihe von Symbolschaltflächen. Bewegen Sie den Zeiger über eine Schaltfläche oder halten Sie sie gedrückt, um ihren Namen zu sehen:

- Die Musiknote, **Open in the music generator**, öffnet das Stück unter `#/music`, wo Sie seine Instrumente Abschnitt für Abschnitt ändern können.
- Der Link, **Share this tune or moment**, bietet einen Link, der dasselbe Stück abspielt, oder einen, der zusätzlich an Ihrer aktuellen Stelle beginnt und den Visualisierer mit Ihrer aktuellen Voreinstellung und Ihren Farben zeigt.
- Der Ordner, **Save to library**, behält das Stück in Ihren Assets.
- Der Blitz, **Light visualiser**, ist ein Schalter, der unten beschrieben wird.

Ein gespeichertes Stück wird unter der Gruppe seines Senders nach Tonart und Tempo aufgeführt. Wenn Sie es auswählen, wird dasselbe Stück erneut abgespielt, mit Wiederholung wie bei jedem Titel oder mit anschließendem Wechsel im Vorwärtsmodus. Gespeichert werden nur der Sender und die Nummer des Stücks, wenige Bytes, und die Musik wird während der Wiedergabe erneut komponiert. Sie können ein gespeichertes Stück in Ihren Assets umbenennen oder löschen und als Hintergrundmusik eines Videos verwenden. Lolly Demo und Lolly Start enthalten jeweils sechs gespeicherte Stücke.

Der Visualisierer empfängt jeden Titel mit einem gleichmäßigen Pegel, sodass ein leiser Titel das Bild genauso stark bewegt wie ein lauter, bei jeder Lautstärke. Jedes Genre von Lolly Sings und ein daraus gespeichertes Stück bietet **Light visualiser**: einfache Pegelbalken, die der Musik die benötigte Rechenzeit lassen. Light visualiser ist auf Touchscreens und auf Geräten mit höchstens vier Kernen oder höchstens 4 GB Arbeitsspeicher von Anfang an eingeschaltet.
:::

Sie können die Oberfläche mit der Tastatur bedienen. Eigene Steuerelemente haben Beschriftungen für Screenreader. Die Live-Vorschau jedes Tools ist ein einziges Bild mit einer Beschriftung, die seinen Inhalt beschreibt.

### Speicher

Die Speicheranzeige zeigt jedes Byte, das diese Installation speichert, nach Kategorie und im Vergleich zur Angabe des Browsers.

![Die Speicheranzeige, die gespeicherte Sitzungen, Bilder und Cache aufschlüsselt und mit der tatsächlichen Angabe des Browsers vergleicht](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Unter der Anzeige:

- **Move to another device** enthält **Export my data**, **Import data…** und **Export my data & render everything**. [Ihre Arbeit auf ein anderes Gerät übertragen](/info/find-your-work.html#move-your-work-to-another-device) führt durch diese Optionen.
- **Clear cache** entfernt heruntergeladene Katalogdateien, die bei Bedarf erneut heruntergeladen werden.
- **Remove automatic checkpoints older than 30 days** gibt Speicherplatz für History frei und behält gespeicherte und benannte Versionen.
- **Clear all my data** entfernt alles, was Lolly in diesem Browser speichert, nachdem Sie zur Bestätigung ein Wort eingegeben haben. [Wenn Sie Ihre Browserdaten löschen](/info/find-your-work.html#if-you-clear-your-browser-data) listet auf, was entfernt wird.

### Offline verfügbar

Lolly speichert nur die Ansichten zwischen, die Sie besucht haben. **Available offline** lädt die Teile herunter, die Sie brauchen werden, mit einem einzigen Fortschrittsbalken, und sie funktionieren weiter ohne Verbindung.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (jede Ansicht, jeder Editor und jede Schrift, einschließlich Bildschirmen, die Sie noch nie geöffnet haben), der **Catalogue** (vollständig oder **Choose by tag**) und **Guides & docs** (diese Dokumentation in Ihrer Sprache, einschließlich Screenshots).
- <!--i:cpu--> **AI models** - jedes Modell für die Verarbeitung auf dem Gerät in einer eigenen Zeile mit seiner Größe: Sprachstimmen, Modelle zum Hochskalieren, Hintergrundentfernung, Texterkennung, Tiefenscan von Lolly Verify, dauerhafte Herkunftsnachweise, Rewriter-Modell, Ask-Zuordnungsmodell, KI-Textdetektor und Gesangsstimmen. Ein Modell über 50 MB ist mit **large download** gekennzeichnet.
- <!--i:wrench--> **Tools** - jedes Tool wird einzeln heruntergeladen, oder **Download all** lädt alle Tools herunter. Ein Häkchen bedeutet, dass es offline bereitsteht.

**Download everything** oben lädt die App, den gewählten Katalogumfang, die Anleitungen und alle Tools herunter. Aktivieren Sie **Include all the AI models**, um die Modelle hinzuzufügen, oder laden Sie ein Modell aus seiner eigenen Zeile herunter. Die Gesangsstimmen lassen sich nur aus ihrer eigenen Zeile herunterladen. Die Richtlinie einer Organisation kann KI-Downloads deaktivieren; die Zeilen zeigen das dann an.

Downloads werden dort fortgesetzt, wo sie unterbrochen wurden, wenn Sie abbrechen oder die Verbindung verlieren. Sobald Sie wieder online sind, werden sie aktualisiert und laden nur die Änderungen einer neuen Version herunter. Wenn der Browser keinen dauerhaften Speicher gewährt hat, bittet **Protect downloads** um diese Berechtigung. Ohne sie kann der Browser Downloads löschen, wenn er den Speicherplatz zurückhaben möchte.

### Lolly-Instanz

**Lolly instance** zeigt, woher diese Installation ihre Tools und ihren Katalog bezieht: die Adresse einer Instanz oder *Bundled with this app*, wenn alles im Build enthalten ist.

- **Design-system source** zeigt, woher das mitgelieferte Designsystem stammt.
- **Instance console** öffnet die Verwaltungsseiten einer Bereitstellung, sofern diese sie anbietet.
- **Change** verbindet die Desktop-App mit einer anderen Instanz. Ein Browser kann Tools und Assets nicht über Ursprungsgrenzen hinweg laden, daher bietet der Abschnitt im Web stattdessen **Open a workspace**.
- **Leave** entfernt das Designsystem, die Tools und den Katalog der Instanz. Ihre eigene Arbeit bleibt erhalten. Siehe [Lolly in Ihrer Organisation verwenden](/info/organisation.html#leaving).
- Wenn Sie bei einer Organisation angemeldet sind, beendet **Sign out** diese Sitzung und **Sign out everywhere** Ihre Sitzungen auf allen Geräten, einschließlich diesem.

<!--i:eti-monitor-->
## Dieses Gerät

- <!--i:monitor--> **This Machine** - Bildschirm, Eingabe, Grafik, Speicher, Codecs, Speicher-Backend und mehr, live aus dieser Sitzung ausgelesen. Nichts wird gespeichert oder gesendet. Auf einem breiten Bildschirm öffnet sich dieses Panel von selbst, und der Tab verwendet zwei Spalten.
- <!--i:neurobeat--> **Sound** - die Töne der Oberfläche und die Neurospicy-Fokusschleifen. Sound ist der einzige Schalter auf diesem Tab, der etwas speichert.
- <!--i:database--> **Storage** - eine schreibgeschützte Ansicht der Speicheranzeige. Löschen oder übertragen Sie Ihre Daten in [Preferences](#storage).

<!--i:eti-palette-->
## Designsystem

Das aktive Designsystem zum Nachlesen. Wenn dieser Browser zwei oder mehr Designsysteme enthält, listet eine Leiste mit Deckblättern oben alle auf. Wählen Sie eines aus, um es zu aktivieren. **Undo** in der anschließenden Meldung stellt das vorherige wieder her.

![Der Tab Design system in Lolly Demo: eine Leiste mit Deckblättern zum Wechseln der Systeme, darunter das Deckblatt mit Logo, Name, Notiz und Zahlen, die die einzelnen Seiten öffnen](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Der Tab öffnet sich mit einem Deckblatt in den eigenen Farben des Systems, mit seinem Logo, seinem Namen in seiner Displayschrift und der Notiz seiner Autorin oder seines Autors. Eine Reihe von Zahlen auf dem Deckblatt verlinkt auf die einzelnen Seiten:

- <!--i:palette--> **Colour** - Hintergrund, Text, Primär- und Sekundärfarbe des hellen und dunklen Looks, jede benannte Farbe als Chip mit Namen und Hex-Wert, ein Band für jede Farbabstufung und das Diagrammspektrum sowie die Farbrollen in einem ausklappbaren Bereich. Wählen Sie einen Wert aus, um den Hex-Wert zu kopieren.
- <!--i:font--> **Type** - Headings, Text, Emphasis und Code, jeweils in der eigenen Schrift gesetzt.
- <!--i:photos--> **Logos** - jede Logodatei auf dem Hintergrund, für den sie erstellt wurde.
- <!--i:layers--> **Colourways** - das helle und dunkle Paar jeder Farbvariante, wenn das System mehr als eine hat.
- <!--i:sliders--> **Tokens** - Radius, Abstände, Effekte und Verläufe.
- <!--i:document--> **Print & CMYK** - die auf eine genaue Druckfarbe festgelegten Farben und die Druckbedingungen, die ein CMYK-PDF angeben kann.

Der Wechsel ist die einzige Änderung, die dieser Tab vornimmt. Bearbeiten Sie ein Designsystem in [Lolly Design System Setup](/info/brand-studio.html) unter `#/start`, worauf das Deckblatt verlinkt. Ein schreibgeschütztes System weist auf seinem Deckblatt darauf hin. Lokale Systeme, die Sie erstellen, bleiben bearbeitbar. `/b` und `/brand` sind Kurzlinks zu diesem Tab.

<!--i:eti-grid-->
## Funktionen

Jeder Teil der Plattform hat eine Karte, aufgeteilt in zwölf Gruppen: Anwendungen, Plattformen & Laufzeitumgebungen, Barrierefreiheit & Sprachen, Exportformate, Importformate, Druckproduktion, Automatisierung & KI, Determinismus & Reproduzierbarkeit, Marke & Designsystem, Datenschutz & Datenhoheit, Sicherheit & Zugriffskontrolle und Architektur (für Entwickler). Jede Gruppe lässt sich einklappen und zeigt die Anzahl ihrer Karten. Eine Karte öffnet einen Dialog mit den Merkmalen dieser Funktion und bei etwa der Hälfte der Karten mit dem Screenshot aus dieser Dokumentation.

Das Suchfeld über den Gruppen filtert die Karten während der Eingabe und öffnet die Gruppen mit einem Treffer. Das Feld zeigt, wie viele Funktionen es durchsucht. Eine Suche ohne Treffer meldet das in Worten.

Dieser Tab dokumentiert, was Lolly kann, im Einklang mit diesen Anleitungen. Er untersucht nicht den Rechner, den Sie verwenden; das übernimmt **This device**.

<!--i:eti-gauge-->
## Aktivität & Statistiken

Zuerst der Build: die Anzahl der geladenen Tools, Exportformate, Umgebungen, in denen die Plattform läuft, und Marken-Assets im Katalog. Ein Panel **Catalogue** schlüsselt auf, was dieser Build enthält.

Dann Ihre eigene Arbeit: **Your activity** zählt, was Sie auf diesem Gerät erstellt haben. **Recent creations** und **Latest exports** sind Stapel, durch die Sie wischen können; sie erscheinen, sobald sie etwas enthalten. Beide öffnen ein Element in seinem damaligen Zustand. Diese Zähler bleiben auf dem Gerät. Eine optionale Lolly Work-Instanz führt eigene [Telemetrie- und Audit-Aufzeichnungen der Organisation](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Direktlinks

Jeder Tab und jeder Abschnitt in Settings hat einen eigenen Link zum Speichern als Lesezeichen oder zum Einfügen. [Lolly Search](/info/search.html) erstellt seine **Settings**-Ergebnisse aus demselben Register wie Settings, sodass ein umbenannter Abschnitt nie ein Suchergebnis ungültig macht.

::: details Alle Linkformen

- **Ein Tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Ein Abschnitt in Preferences:** `#/settings?focus=<section-id>`, etwa `#/settings?focus=offline-section`.
- **Ein bestimmter Abschnitt:** seine ID als einzelnes Flag, etwa `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` oder `#/settings?cap-formats`. Die älteren Links `#/settings?dash-lock` und `#/settings?dash-palette-wheel` öffnen das Deckblatt und die Seite Colour.
- **Ein Abschnitt nach Stichwort:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (die Seite Colour) oder `#/settings?tokens`. Zwei Abschnitte können dasselbe Stichwort haben: `print` gehört sowohl zur Druckreferenz des Marken-Tabs als auch zur Gruppe Druckproduktion, und der erste in der Seitenreihenfolge gewinnt. Verwenden Sie die ID, um einen bestimmten auszuwählen.

Ein Direktlink wechselt zum Tab mit dem Ziel und öffnet jede Gruppe, in der das Ziel eingeklappt ist. Dann scrollt er zum Ziel, sobald das Layout der Abschnitte darüber fertig ist. Die ausgemusterten Adressen `#/platform` und `#/capabilities` öffnen Settings und behalten ihre Direktlink-Flags bei.
:::

---

**Verwandte Themen:** [Profile](/info/profile.html) für Ihre Angaben und die Kontexte, in denen Sie arbeiten. [Lolly Design System Setup](/info/brand-studio.html) zum Bearbeiten dessen, was der Tab Design system zeigt. [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html) für Speicher, Sicherungen und den Gerätewechsel.
