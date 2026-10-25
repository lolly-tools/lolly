# Einstellungen

In den Einstellungen ändern Sie, wie Lolly für Sie arbeitet: Ihre Angaben, das Designsystem, das Sie nutzen, Barrierefreiheit, was auf diesem Gerät gespeichert ist und was offline bereitsteht. Öffnen Sie sie mit **Settings** in der Leiste am Fuß des Startbildschirms oder über Ihr Avatar-Menü. Sie öffnen sich auf **Preferences**, mit vier weiteren Tabs daneben.

| Tab | Adresse | Was er enthält |
|---|---|---|
| **Preferences** | `#/settings` | Ihre Angaben, Designsysteme, Erscheinungsbild, Emoji, Barrierefreiheit, Verbindungen, Speicher und Offline-Downloads |
| **This device** | `#/settings?tab=device` | Eine Live-Anzeige dieses Browsers und Rechners, dazu Ton und eine schreibgeschützte Speicheransicht |
| **Design system** | `#/settings?tab=brand` | Das aktive Designsystem als Titelseite und Seiten, mit einem Streifen von Titelseiten zum Wechseln der Systeme |
| **Capabilities** | `#/settings?tab=caps` | Alles, was Lolly kann, als durchsuchbare Karten |
| **Activity & stats** | `#/settings?tab=activity` | Der Katalog, Ihre lokalen Zähler und zuletzt bearbeitete Arbeit |

Jeder Tab hat seine eigene Adresse, und alte Links `#/profile` und `#/d` öffnen weiterhin die richtige Stelle, bis hinunter zu einzelnen Einstellungen.

## Preferences

Preferences ist eine lange Seite mit einer **Einstellungsleiste** an der Seite und einem Feld **Search settings** über der Leiste, das beim Tippen filtert. Jeder Abschnitt öffnet sich direkt aus einem Link der Form `#/settings?focus=<section-id>`, zum Beispiel `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - Ihr Name, Ihre Kontaktdaten und Ihr Porträtfoto sowie der Schalter **Use my details to create**. [Profile](/info/profile.html) erklärt, wie Tools sie nutzen.
- <!--i:seal--> **Content Credentials** - die optionale verifizierte Identität, die Ihre Exporte signiert. Siehe [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - Designsysteme wechseln, hinzufügen, ausblenden oder entfernen. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) behandelt jede Aktion.
- <!--i:moon--> **Appearance** - das Design (Light, Dark oder Brand, das die App in Ihrer Palette malt) und **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - das Set, aus dem Ihre Emoji gezeichnet werden, wenn Sie etwas Neues beginnen, mit seiner Lizenz für die Grafik, und wie stark Ihre Palette sie umfärbt (**Off**, **Subtle**, **Strong**, **Full**, **Mono** oder **Duotone**). **Keep skin tones and flags** lässt diese in ihren eigenen Farben. Bereits erstellte Arbeit behält das Set, mit dem sie erstellt wurde.
- <!--i:eyeoff--> **Accessibility** - vier Komfortschalter, dazu Sound und Neurospicy Mode. Siehe [Barrierefreiheit](#accessibility).
- <!--i:link--> **Connected services** - Speicher, den Sie verbinden, etwa Dropbox, Google Drive, OneDrive, Nextcloud oder S3, und **Sync across devices**. Siehe [Ihre Geräte synchronisieren](/info/sync.html).
- <!--i:globe--> **Trusted sites** - die Websites, die eine Design-Webseiten-Box oder eine Sandbox-Demo ohne Nachfrage kontaktieren darf, und, wo der Server es bietet, **Allow pages from any site**. Die [Datenschutzrichtlinie](/info/privacy.html) listet auf, was jede Anfrage sendet.
- <!--i:download--> **Your renders** - **Save my renders to my library** behält eine Kopie jedes Bildes, Audioclips und Videos, das Sie herunterladen, in Assets, unter einem Tag Renders.
- <!--i:database--> **Storage** - was Lolly auf diesem Gerät behält, und die Schaltflächen, die Ihre Daten leeren oder mitnehmen. Siehe [Speicher](#storage).
- <!--i:cpu--> **Available offline** - laden Sie herunter, was Sie brauchen, bevor Sie die Verbindung verlieren. Siehe [Offline verfügbar](#available-offline).
- <!--i:folder--> **Hot folder** - überwachen Sie in der Desktop-App einen Ordner und holen Sie alles, was dort abgelegt wird, in Lolly, über dieselbe Auswahl wie bei Drag-and-drop.
- <!--i:clock--> **Your activity** - was Sie auf diesem Gerät erstellt haben, lokal gezählt.
- <!--i:sliders--> **Feature flags** - Teile der App ein- oder ausschalten, etwa **Print preflight** oder **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - woher diese Installation ihre Tools und ihren Katalog bezieht. Siehe [Lolly-Instanz](#lolly-instance).

Die Design-Karten sind Live-Vorschauen und gelten in dem Moment, in dem Sie eine wählen, nur auf diesem Gerät.

![Drei Theme-Karten, jede mit Vorschau ihrer eigenen Schrift und Farbe, die aktive markiert](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Barrierefreiheit

**Settings → Preferences → Accessibility** enthält vier Komforteinstellungen für die App um Ihre Arbeit herum. Jede ist aus, bis Sie sie einschalten, und keine reicht in eine Tool-Arbeitsfläche oder einen Export hinein, sodass eine ruhigere App nie ein Pixel der Datei verschiebt, die Sie ausliefern.

- <!--i:pause--> **Reduce motion** schaltet die Übergänge, Schiebeeffekte und Schnörkel der App aus. Ihre Arbeitsfläche und jeder animierte Export bewegen sich weiter wie gestaltet.
- <!--i:photos--> **Hide colourful previews** ersetzt die Vorschau-Grafiken der Galerie durch ruhige Karten aus Symbol und Text und dämpft Projekt-Vorschaubilder, sodass sie erkennbar bleiben, ohne zu schreien.
- <!--i:sliders--> **High contrast** verstärkt die Rahmen, den Text und die Fokusringe der App. Ihre Markenfarben und die Arbeitsfläche bleiben, wie Sie sie festgelegt haben.
- <!--i:font--> **Large text** vergrößert die Beschriftungen, Menüs und Schaltflächentexte der App. Schrift innerhalb Ihrer Designs bleibt unberührt, sodass nichts, was Sie exportieren, umbricht.

Diese Einstellungen liegen in Ihrem Profil, reisen also in einem Profilexport mit und kommen auf der nächsten Installation mit Ihrem Namen und Ihren Sitzungen an. Eine kleine Kopie nur für das Gerät wendet sie vor dem ersten Zeichnen an.

Dieselbe Karte enthält **Sound**, eine sanfte Schicht unterstützender Töne für das, was Sie tun (Ankunft in der Galerie, ein Content-Credentials-Ergebnis, das Schließen eines Panels), und **Neurospicy Mode**, einen ruhigen Fokus-Track. Das Einschalten von Neurospicy öffnet einen kleinen Player in der Ecke, der Ihnen durch die App folgt. Dort wählen Sie einen Track, springen weiter, stellen die Lautstärke ein und minimieren oder schließen den Player. Zu den Tracks gehören prozedurale *Lolly Sings*-Melodien, Ambient-Loops und Beats, Ihr eigenes Audio und Internetradio-Sender, die eine Verbindung brauchen. Beides ist standardmäßig aus und wird gemerkt, und das Ausschalten von Sound schaltet auch den Fokus-Track stumm. Das Profilmenü und **This device** tragen denselben Schalter.

Die Oberfläche lässt sich per Tastatur bedienen, benutzerdefinierte Steuerelemente tragen Beschriftungen für Screenreader, und die Live-Vorschau jedes Tools wird als ein beschriftetes Bild bereitgestellt, das beschreibt, was es zeigt.

### Speicher

Die Speicheranzeige weist jedes Byte aus, das diese Installation hält, Kategorie für Kategorie, gegen das, was der Browser meldet.

![Die Speicheranzeige, die gespeicherte Sitzungen, Bilder und Cache gegen das aufschlüsselt, was der Browser tatsächlich meldet](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Unter der Anzeige:

- **Move to another device** enthält **Export my data**, **Import data…** und **Export my data & render everything**. [Ihre Arbeit auf ein anderes Gerät bringen](/info/find-your-work.html#move-your-work-to-another-device) führt durch sie.
- **Clear cache** verwirft heruntergeladene Katalogdateien, die bei Bedarf erneut geladen werden.
- **Remove automatic checkpoints older than 30 days** gibt Platz im Verlauf frei und behält gespeicherte und benannte Versionen.
- **Clear all my data** entfernt alles, was Lolly in diesem Browser behält, nachdem Sie zur Bestätigung ein Wort getippt haben. [Wenn Sie Ihre Browserdaten löschen](/info/find-your-work.html#if-you-clear-your-browser-data) listet auf, was verschwindet.

### Offline verfügbar

Lolly speichert Bildschirme beim Besuch zwischen, was nur abdeckt, wo Sie schon waren. **Available offline** ist für die Reise, die Sie kommen sehen: Laden Sie die Teile herunter, die Sie brauchen, und beobachten Sie einen Fortschrittsbalken, und alles, was Sie mitgenommen haben, funktioniert ohne Verbindung weiter.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (jede Ansicht, jeder Editor und jede Schrift, auch Bildschirme, die Sie nie geöffnet haben), der **Catalogue** (alles oder **Choose by tag**) und **Guides & docs** (diese Dokumentation in Ihrer Sprache, samt Screenshots).
- <!--i:cpu--> **AI models** - jedes Modell auf dem Gerät in einer eigenen Zeile mit seiner Größe: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector und Singing voices. Ein Modell über 50 MB ist mit **large download** gekennzeichnet.
- <!--i:wrench--> **Tools** - jedes Tool lädt einzeln herunter, oder **Download all** nimmt jedes Tool. Ein Häkchen heißt offline bereit.

**Download everything** oben nimmt die App, den gewählten Umfang des Katalogs, die Anleitungen und alle Tools. Kreuzen Sie **Include all the AI models** an, um die Modelle hinzuzufügen, oder laden Sie ein Modell über seine eigene Zeile herunter; die Gesangsstimmen werden nur über ihre eigene Zeile heruntergeladen. Die Richtlinie einer Organisation kann KI-Downloads ausschalten, und die Zeilen sagen Ihnen das dann.

Downloads setzen dort fort, wo sie aufgehört haben, wenn Sie abbrechen oder die Verbindung verlieren, und aktualisieren sich selbst, wenn Sie wieder online sind, wobei nur geholt wird, was ein Release geändert hat. Hat der Browser keinen dauerhaften Speicher gewährt, bittet **Protect downloads** darum: der Unterschied zwischen "heruntergeladen" und "heruntergeladen, bis der Browser den Platz zurückhaben will".

### Lolly-Instanz

**Lolly instance** sagt, woher diese Installation ihre Tools und ihren Katalog bezieht: die Adresse einer Instanz oder *Bundled with this app*, wenn alles im Build mitgeliefert wird.

- **Design-system source** zeigt, woher das gelieferte Designsystem stammt.
- **Instance console** öffnet die Admin-Seiten einer Bereitstellung, wo sie welche bietet.
- **Change** richtet die Desktop-App auf eine andere Instanz. Ein Browser kann Tools und Assets nicht über Origins hinweg laden, daher bietet der Abschnitt im Web stattdessen **Open a workspace**.
- **Leave** entfernt das Designsystem, die Tools und den Katalog der Instanz, und Ihre eigene Arbeit bleibt. Siehe [Lolly in Ihrer Organisation nutzen](/info/organisation.html#leaving).
- Wenn Sie an einer Organisation angemeldet sind, beendet **Sign out** diese Sitzung und **Sign out everywhere** Ihre Sitzungen auf jedem Gerät, auch diesem.

## Dieses Gerät

- <!--i:monitor--> **This Machine** - Bildschirm, Eingabe, Grafik, Arbeitsspeicher, Codecs, Speicher-Backend und mehr, live aus dieser Sitzung gelesen. Nichts wird gespeichert und nichts gesendet. Er öffnet sich auf einem breiten Bildschirm von selbst, wo der Tab in zwei Spalten angeordnet ist.
- <!--i:neurobeat--> **Sound** - die Oberflächentöne und die Neurospicy-Fokus-Loops, der eine Schalter auf diesem Tab, der etwas schreibt.
- <!--i:database--> **Storage** - eine schreibgeschützte Ansicht der Anzeige in [Preferences](#storage), wo Sie Ihre Daten leeren oder mitnehmen.

## Designsystem

Das aktive Designsystem, zum Lesen aufbereitet. Hält dieser Browser zwei oder mehr Designsysteme, listet ein Streifen kleiner Titelseiten oben sie auf: Wählen Sie eine, um sie zu aktivieren, und **Undo** in der folgenden Meldung bringt die vorherige zurück.

![Der Tab Design system bei Lolly Demo: ein Streifen von Titelseiten zum Wechseln der Systeme, dann die Titelseite mit Logo, Name, Hinweis und den Zählwerten, die jede Seite öffnen](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Der Tab öffnet sich auf einer Titelseite in den eigenen Farben des Systems, mit seinem Logo, seinem Namen in seiner Auszeichnungsschrift und dem Hinweis, den seine Autorin oder sein Autor geschrieben hat. Eine Zeile mit Zählwerten auf der Titelseite verlinkt jede Seite:

- <!--i:palette--> **Colour** - Fläche, Text, Primär- und Sekundärfarbe der hellen und dunklen Looks, jede benannte Farbe als Chip mit Name und Hex, ein Band für jeden Tint-Verlauf und das Diagramm-Spektrum sowie die Farbrollen in einem Einklapper. Wählen Sie einen Wert, um das Hex zu kopieren.
- <!--i:font--> **Type** - Headings, Text, Emphasis und Code, jede in ihrer eigenen Schrift gesetzt.
- <!--i:photos--> **Logos** - jede Logodatei auf dem Untergrund, für den sie gemacht wurde.
- <!--i:layers--> **Colourways** - das helle und dunkle Paar jeder Farbvariante, wenn das System mehr als eine hat.
- <!--i:sliders--> **Tokens** - Radius, Abstände, Effekte und Verläufe.
- <!--i:document--> **Print & CMYK** - die an eine genaue Druckfarbe gebundenen Farben und die Druckbedingungen, die ein CMYK-PDF deklarieren kann.

Das Wechseln ist die einzige Änderung, die dieser Tab vornimmt. Ein Designsystem bearbeiten Sie in [Design System Setup](/info/brand-studio.html) unter `#/start`, wohin die Titelseite verlinkt. Ein schreibgeschütztes System sagt das auf seiner Titelseite; lokale Systeme, die Sie erstellen, bleiben bearbeitbar. `/b` und `/brand` sind Kurzlinks direkt zu diesem Tab.

## Capabilities

Jeder Teil der Plattform ist als Karte beschrieben, in zwölf Gruppen: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control und Architecture (for builders). Jede Gruppe klappt und zeigt die Zahl ihrer Karten. Eine Karte öffnet sich zu einem Dialog mit den Funktionen dieser Capability und, bei etwa der Hälfte, dem Screenshot, den diese Dokumentation nutzt.

Das Suchfeld über den Gruppen filtert die Karten beim Tippen und öffnet alle Gruppen, die noch einen Treffer enthalten. Es sagt, wie viele Capabilities es durchsucht, und eine Suche ohne Treffer sagt das in Worten.

Dieser Tab ist geschriebene Dokumentation dessen, was Lolly kann, im Einklang mit diesen Anleitungen gehalten. Er prüft nicht die Maschine, auf der Sie sind; das tut **This device**.

## Activity & stats

Zuerst der Build: wie viele Tools geladen sind, wie viele Exportformate es gibt, auf wie vielen Oberflächen die Plattform läuft und wie viele Marken-Assets der Katalog trägt, mit einem Panel **Catalogue**, das aufschlüsselt, was dieser Build ausliefert.

Dann Ihre eigene Seite: **Your activity** zählt, was Sie auf diesem Gerät erstellt haben, und **Recent creations** und **Latest exports** sind Stapel, durch die Sie wischen können und die jeweils erscheinen, sobald es etwas zu zeigen gibt. Beide öffnen ein Element, wie es war. Diese Zähler bleiben auf dem Gerät; eine optionale Lolly-Work-Instanz führt ihre eigenen [Organisations-Telemetrie- und Audit-Aufzeichnungen](/info/privacy.html#organisation-services-with-lolly-work).

## Deep Links

Jeder Tab und Abschnitt von Settings hat seinen eigenen Link, den Sie als Lesezeichen speichern oder einfügen können. Die [Suche](/info/search.html) richtet ihre **Settings**-Ergebnisse auf dasselbe Register, aus dem Settings rendert, sodass ein Abschnitt nicht unter einem Suchergebnis weg umbenannt werden kann.

::: details Jede Form von Link

- **Ein Tab:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Ein Preferences-Abschnitt:** `#/settings?focus=<section-id>`, etwa `#/settings?focus=offline-section`.
- **Ein Abschnitt, genau:** seine ID als bloßes Flag, etwa `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` oder `#/settings?cap-formats`. Die älteren Links `#/settings?dash-lock` und `#/settings?dash-palette-wheel` öffnen die Titelseite und die Seite Colour.
- **Ein Abschnitt per Schlagwort:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (die Seite Colour) oder `#/settings?tokens`. Schlagwörter können geteilt sein: `print` gehört sowohl zur Druckreferenz des Marken-Tabs als auch zur Gruppe Print production, und der erste in Seitenreihenfolge gewinnt. Nutzen Sie die ID, wenn es darauf ankommt, welcher.

Ein Deep Link wechselt zu dem Tab, dem das Ziel gehört, öffnet jede Gruppe, in der es eingeklappt ist, und scrollt dann dorthin, wobei er sich einen Moment setzt, während die Abschnitte darüber fertig angeordnet werden. Die eingestellten Adressen `#/platform` und `#/capabilities` gehen mit intakten Deep-Link-Flags in Settings auf.
:::

---

**Siehe auch:** [Profile](/info/profile.html) für Ihre Angaben und die Kontexte, in denen Sie erstellen. [Design System Setup](/info/brand-studio.html) zum Bearbeiten dessen, was der Tab Design system zeigt. [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html) für Speicher, Backups und den Gerätewechsel.
