# Profile - wer Sie sind, wenn Sie erstellen

Ein **Profil** ist die Arbeitsidentität, *als* die Lolly agiert. Es ist die kleine Menge an Angaben, aus denen ein Tool schöpfen kann, damit Sie sie nicht jedes Mal neu eintippen - Ihr Name, Kontaktdaten, ein optionales Porträtfoto, ein paar Einstellungen - plus alles, was Sie während der Arbeit ansammeln: gespeicherte Sitzungen, hochgeladene Bilder und die lokale Aktivitätszählung.

Alles in einem Profil befindet sich **auf dem Gerät**, in der lokalen Datenbank des Browsers (IndexedDB bei der Web-PWA, das Dateisystem bei den Tauri-Apps). Es gibt kein Konto, und nichts wird hochgeladen. Sie verwalten es unter **Profil** (oben rechts in der Galerie); Tools *lesen* es lediglich - und nur die konkreten Felder, für die sie zur Vorausfüllung gebaut wurden.

> Ein Profil dreht sich um *Sie* (oder wer auch immer hier gerade gestaltet). Es unterscheidet sich von der **Plattform** - den Farben, Schriften und globalen Einstellungen der Marke - und von **Fähigkeiten**, dem Katalog dessen, was die App kann. Siehe [Profil vs. Plattform vs. Fähigkeiten](#profile-vs-platform-vs-capabilities) am Ende.

## Was in einem Profil steckt

| Teil | Was es ist |
|---|---|
| **Name** | Vor- und Nachname. |
| **Kontakt** | E-Mail und Telefon. |
| **Ort** | Stadt und Land. |
| **Porträtfoto** | Ein optionales Foto, quadratisch zugeschnitten und als lokales Bild gespeichert. Wird von Tools wie E-Mail-Signaturen, Zitatkarten, Organigrammen und dynamischen Layouts genutzt. |
| **Meine Angaben zum Erstellen verwenden** | Ein einzelner Opt-in-Schalter (er zeigt **Meine Angaben werden verwendet**, sobald er aktiv ist). Er steuert, ob Ihre persönlichen Angaben als **Provenienz** mitgeführt werden - die Autoren-/Credit-Zeile, die in exportierte Dateien eingebettet wird - sowie als Autor bei **/pro**-Stapelläufen. (Er steuert nicht das Vorausfüllen: siehe [Wie Tools Ihr Profil nutzen](#how-tools-use-your-profile).) |
| **Einstellungen** | Ihr Theme (Hell, Dunkel oder Brand - das Brand-Theme malt die App in Ihrer eigenen Palette) und welche Teile der App Sie über **Feature-Flags** aktiviert haben. |
| **Barrierefreiheit** | Vier Komfortschalter - *Bewegung reduzieren*, *Farbige Vorschauen ausblenden*, *Hoher Kontrast*, *Große Schrift* - im Profil gespeichert, sodass sie bei einem Profilexport mitwandern. Siehe [Barrierefreiheit](#accessibility). |
| **Ihre Arbeit** | Gespeicherte Sitzungen (mit Vorschaubildern) - organisiert in verschachtelten Ordnern unter **[Projekte](/info/using.html)** -, Ihre **Meine Bilder**-Bibliothek und die lokalen Aktivitätsstatistiken, alle diesem Profil zugeordnet. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Der Profil-Bildschirm - Name, Kontakt, ein optionales Porträtfoto und Ihre Einstellungen](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Nichts davon ist erforderlich. Ein leeres Profil ist ein vollkommen gutes Profil; Sie füllen nur das aus, was Ihnen Tipparbeit erspart.

Die Seite ist lang, deshalb hat sie eine eigene **Einstellungsleiste** an der Seite - Ihre Angaben, Erscheinungsbild, Barrierefreiheit, Lolly-Instanz, Ihre Aktivität, Speicher, Offline verfügbar, Feature-Flags, Content Credentials - mit einem Feld **Einstellungen durchsuchen** darüber, das die Liste beim Tippen filtert. Jeder Abschnitt ist über `#/profile?focus=<section-id>` verlinkbar, was ihn öffnet und in den sichtbaren Bereich scrollt (`#/profile?focus=storage-section`, `?focus=feature-flags-section` und so weiter), sodass ein Link auf eine einzelne Einstellung statt auf den Seitenanfang zeigen kann.

![Drei Theme-Karten, jede mit Vorschau ihrer eigenen Schrift und Farbe, die aktive markiert](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Ein Profil ist ein Kontext, keine bloße Person

Das Wort „Profil" legt eine feste Person nahe, aber in Lolly ist es eigentlich ein **Erstellungskontext** - *wer Sie sind, während Sie dieses Ding erstellen*. Dieser Kontext kann drei verschiedene Formen annehmen, und Lolly behandelt sie alle gleich.

### Als Einzelperson

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Die Porträtfoto-Steuerung, leer bis Sie ein Foto hochladen, das dann auf diesem Gerät bleibt](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Als Team

Ein Profil muss nicht für einen einzelnen Menschen stehen. Es kann ein **Team oder eine Funktion innerhalb einer Organisation** vertreten: der gemeinsame Teamname, eine Gruppen-Posteingangsadresse (`events@…`), eine Abteilung, das Porträtfoto oder Emblem des Teams. Eine Person richtet es ein, exportiert es (siehe unten), und der Rest des Teams lädt dasselbe Profil - sodass alles, was das Team produziert, einheitliche Angaben trägt, ohne dass jemand sie erneut eingeben muss. Ein gemeinsamer Kiosk oder ein ausgeliehener Vorführ-Laptop kann ein einziges Teamprofil ausführen, unter dem jeder dahinter erstellt.

### Als Funktion - eine Rolle, die Sie manchmal tragen

Das ist der Fall, den das starre Modell „eine Person, ein Profil" übersieht. Sie könnten **an drei Tagen im Jahr Eventmanager** sein und den Rest der Zeit etwas völlig anderes. An diesen drei Tagen möchten Sie Event-Details, das Event-Postfach, vielleicht eine Event-Submarke, um Ihre Badges und Beschilderung auszufüllen; an den anderen 362 möchten Sie Ihre normale Identität zurück.

In Lolly ist diese Rolle einfach **ein weiteres Profil, das Sie griffbereit halten** - ein gespeichertes Bundle (nächster Abschnitt), das Sie für das Event laden und danach beiseitelegen. Die Rolle ist ein Hut, kein neues Konto. Setzen Sie ihn auf, wenn Sie ihn brauchen, nehmen Sie ihn ab, wenn Sie fertig sind.

## Eine Installation, ein aktives Profil - Sie können viele aufbewahren

Zu jedem Zeitpunkt hat eine Installation **ein aktives Profil** - die Angaben, die ein Tool gerade sieht. Es gibt keinen In-App-Profilwechsler; stattdessen ist jedes Profil ein **portables Bündel** (eine einzelne `.zip`-Datei, siehe [unten](#moving-a-profile-to-a-new-device)). Das ist bewusst derselbe Mechanismus wie der Wechsel auf ein neues Gerät - ein Profil ist eine Datei, die Sie speichern, kopieren und laden können.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Sauberster Wechsel:** **Profil → Speicher → Alle meine Daten löschen**, dann das Bündel für den Kontext **importieren**, in den Sie wechseln. Sie erstellen jetzt ausschließlich als dieses Profil.
- <!--i:layers--> **Schichtung:** Ein Import *ohne* vorheriges Löschen **verschmilzt** - das importierte Profil, die Sitzungen und Bilder landen oben auf dem, was schon da ist, ersetzen alles mit demselben Namen und lassen den Rest unberührt. Praktisch, um die gespeicherten Sitzungen eines Teams in Ihr eigenes Setup zu übernehmen; nicht das Richtige, wenn Sie eine saubere Rollentrennung brauchen.
- <!--i:monitor--> **Nebeneinander:** Da alles geräteabhängig ist, führt ein separates Browserprofil, ein separates Benutzerkonto oder eine zweite installierte PWA jeweils ein eigenes, unabhängiges Lolly-Profil. Führen Sie Ihre persönliche Installation und die Event-Kiosk-Installation gleichzeitig aus, ohne Wechsel.

Wenn Sie also tatsächlich mehrere Kontexte jonglieren (Sie selbst, Ihr Team, den Eventmanager-Hut), bewahren Sie mehrere Bundles auf und laden das, das Sie gerade brauchen:

![Der Speichermesser, der gespeicherte Sitzungen, Bilder und Cache gegenüber dem, was der Browser tatsächlich meldet, aufschlüsselt](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Bewahren Sie ein Bundle pro Kontext auf und benennen Sie die Dateien danach, was sie sind (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Die Datei *ist* das Profil.

## Barrierefreiheit

**Profil → Barrierefreiheit** enthält vier Komforteinstellungen für die App *rund um* Ihre Arbeit. Jede ist ausgeschaltet, bis Sie sie aktivieren, und keine reicht in eine Tool-Arbeitsfläche oder einen Export hinein - eine ruhigere App darf keinen Pixel der Datei verschieben, die Sie ausliefern.

- <!--i:film--> **Bewegung reduzieren** - schaltet die Übergänge, Slides und animierten Verzierungen der App aus. Ihre Tool-Arbeitsfläche und jeder animierte Export bewegen sich genau wie vorgesehen weiter.
- <!--i:image--> **Farbige Vorschauen ausblenden** - tauscht die farbenfrohen Vorschaubilder der Galerie gegen ruhige Symbol-und-Text-Karten aus und senkt Farbe und Kontrast Ihrer Projekt-Vorschaubilder, sodass sie erkennbar bleiben, ohne zu schreien. Innerhalb eines Tools wird alles weiterhin in voller Farbe angezeigt.
- <!--i:sliders--> **Hoher Kontrast** - verstärkt Rahmen, Text und Fokusringe der App. Ihre Markenfarben und alles auf der Arbeitsfläche bleiben genau so, wie Sie sie eingestellt haben.
- <!--i:font--> **Große Schrift** - vergrößert die Schrift der App: Beschriftungen, Menüs und Schaltflächentext. Die Bedienelemente behalten ihre Größe, es werden also nur die Wörter darin größer, und die Schrift in Ihren Designs bleibt unberührt, sodass sich nichts, was Sie exportieren, neu umbricht.

Diese sind im Profil selbst gespeichert, weshalb sie bei einem Profilexport mitreisen und bei der nächsten Installation zusammen mit Ihrem Namen und Ihren Sitzungen ankommen. (Das Gerät hält zusätzlich einen kleinen lokalen Spiegel, damit die Einstellung schon vor dem ersten Bildaufbau greift; dieser Spiegel ist geräte-lokal und reist nicht mit.)

## Ihre Lolly-Instanz

**Profil → Lolly-Instanz** zeigt, woher diese Installation ihre Tools und ihren Katalog bezieht - die Adresse der Instanz, oder *Mit dieser App gebündelt*, wenn alles im Build enthalten ist. Wo ein Deployment eine anbietet, öffnet ein Link **Instanz-Konsole** deren Admin-Oberfläche, und **Ändern** / **Trennen** verweisen die Installation um oder lösen sie.

Das Umverweisen auf eine andere Instanz erfordert die **Desktop-App**: Ein Browser verhindert, dass eine Seite Tools und Assets über Ursprünge hinweg lädt, deshalb meldet der Abschnitt im Web nur, wo Sie sich befinden, und belässt es dabei.

## Offline verfügbar

Lolly speichert im Cache, während Sie arbeiten, aber dieses beiläufige Zwischenspeichern deckt nur ab, wo Sie schon waren. **Profil → Offline verfügbar** ist für die Reise gedacht, die Sie kommen sehen: eine Stunde am Flughafen-WLAN vor einem Flug ohne jede Verbindung. Laden Sie die Teile herunter, die Sie brauchen werden, beobachten Sie einen Fortschrittsbalken, und alles, was Sie mitgenommen haben, funktioniert auch ohne Verbindung weiter.

Sieben Teile, jeder mit seiner Größe angegeben, bevor Sie sich festlegen:

- <!--i:layout--> **Die App** - jede Ansicht, jeder Editor und jede Schrift, auch die, die Sie noch nicht geöffnet haben. Ohne dies kann ein Bildschirm, den Sie online nie besucht haben, offline nicht laden.
- <!--i:image--> **Katalog** - Markenassets über das Nötigste hinaus. Nehmen Sie alles, oder öffnen Sie *Nach Tag wählen* und nehmen Sie nur die Tags, die Sie nutzen.
- <!--i:book--> **Anleitungen & Dokumentation** - diese Dokumentationsseite, in Ihrer Sprache, Screenshots inklusive.
- <!--i:cpu--> **Sprachstimmen** - die Stimmodelle hinter Script-Audio und Erzählung. Einmal heruntergeladen, läuft es dann auf dem Gerät.
- <!--i:zap--> **Hochskalierungs-Modelle** - die KI-Bild-Hochskalierer: Foto, Illustration/Anime und Gesicht.
- <!--i:layers--> **Hintergrundentfernung** - die On-Device-Freistellungsmodelle hinter *Hintergrund entfernen*.
- <!--i:shield--> **Verify Deep Scan** - der On-Device-Wasserzeichen-Scanner, um Content Credentials ohne Verbindung zu prüfen.

Die letzten vier sind als **großer Download** markiert und sind bewusst einzelne Opt-ins: **Alles herunterladen** oben nimmt die App, den von Ihnen gewählten Katalogumfang, die Dokumentation und alle Tools in einem Durchgang und nichts weiter. Sprachstimmen, die Hochskalierer, die Hintergrundentfernung und der Deep Scan laden jeweils nur, wenn Sie diese Zeile namentlich anfordern - ein paar Hundert Megabyte versteckt in einer einzigen Schaltfläche wäre unredlich.

Unter den Teilen liegt die Liste pro Tool: Jedes Tool lädt einzeln herunter (das Häkchen bedeutet offline bereit), oder **Alle herunterladen** erfasst alle auf einmal. Downloads sind fortsetzbar - brechen Sie ab oder verlieren Sie die Verbindung, setzt der nächste Durchlauf dort fort, wo er aufgehört hat, und lädt nur das Fehlende - und sie aktualisieren sich selbst, sobald Sie wieder online sind, und holen nur das, was ein neues Release geändert hat.

Hat der Browser keinen dauerhaften Speicher gewährt, weist der Abschnitt darauf hin und bietet **Downloads schützen** an, was ihn anfordert - der Unterschied zwischen „heruntergeladen“ und „heruntergeladen, bis der Browser den Platz zurückhaben will“.

## Ein Profil auf ein neues Gerät übertragen

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Da ein Profil vollständig lokal ist, besteht die einzige Möglichkeit, es auf eine leere Installation zu bringen - einen neuen Laptop, einen frisch zurückgesetzten Browser, den Rechner eines Kollegen, eine Offline-Maschine - darin, **die Datei mitzunehmen**. Kein Login stellt es für Sie wieder her, und genau das ist der Punkt: Es hat Ihr Gerät von vornherein nie verlassen.

- <!--i:download--> **Export my data** lädt eine `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` herunter - benannt nach dem Profil, zu dem sie gehört, mit einer Sequenznummer pro Tag, damit wiederholte Exporte nicht kollidieren (Namensteile entfallen, wenn das Profil sie nicht hat). Die Datei enthält Ihr Profil, jede gespeicherte Sitzung (mit ihrem Thumbnail), Ihre hochgeladenen Bilder - Ihre Brand-Tokens und installierten Schriften reisen als Benutzer-Assets mit - und Ihre Einstellungen (Theme, Layout, lokale Aktivitätsstatistiken).
- <!--i:upload--> **Import data…** auf der anderen Installation liest diese Datei wieder ein, und Sie machen genau dort weiter, wo Sie aufgehört haben.
- <!--i:box--> **Export my data & render everything** schreibt dasselbe Backup *plus* eine zweite Zip-Datei, die jede gespeicherte Sitzung zu ihrer fertigen Ausgabedatei rendert, in Ordnern, die Ihre Projekte spiegeln. Ein vollständiges Offline-Archiv sowohl der Quellen als auch der Ergebnisse - und das kann bei vielen Sitzungen groß und langsam werden.

![Die beiden Schaltflächen, die eine ganze Installation umziehen: Meine Daten exportieren schreibt ein Zip, Daten importieren liest es wieder ein](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Das Bundle ist ein einfaches, in sich geschlossenes Zip, das daher auf **jedem** Weg reist - USB, AirDrop, eine Netzwerkfreigabe, E-Mail an sich selbst - und das Ziel kann vollständig offline sein. Jeder Teil ist mit einer Prüfsumme versehen, sodass eine beim Transport beschädigte Datei beim Import erkannt wird, statt halb kaputt wiederhergestellt zu werden. Der Import **führt zusammen** (gleichnamiges Profil/Sitzung/Bild wird überschrieben; alles andere bleibt erhalten), sodass ein bereits genutztes Ziel nie gelöscht wird.

Was nicht mitreist: der Katalog-Cache (er lädt sich auf dem neuen Gerät von selbst neu herunter) und die Tools selbst (es wird angenommen, dass sie bereits vorhanden sind).

Für den genauen Bündelaufbau, die Versionsrichtlinie und die Integritätsregeln siehe **[Datenübertragung](/info/data-transfer.html)**; für den vollständigen Ablauf **[Lolly nutzen → Auf ein anderes Gerät umziehen](/info/using.html#moving-to-another-device)**.

## Wie Tools Ihr Profil nutzen

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Ein Tool *füllt* stets nur die Profilfelder *vor*, für deren Bindung es ausdrücklich gebaut wurde:

**Das Opt-in (Provenienz).** Wenn Sie ein Asset exportieren, reisen Ihre Angaben optional als **Provenienz** mit - eine Autoren-/Credit-Zeile, die in die Metadaten der Datei (PNG, PDF, SVG, …) eingebettet wird -, sodass ein fertiges Asset sagen kann, wer es erstellt hat. *Das* ist es, was **Meine Angaben zum Erstellen verwenden** steuert: Lassen Sie es aus, trägt der Export weiterhin die „Made with Lolly“-Tool-/Plattform-Zuschreibung, aber es wird keine persönliche Autoren-/Kontaktzeile eingebettet. (Dasselbe Opt-in legt den Autor bei **/pro**-Stapelläufen fest.) (Für Tool-Autoren: siehe [Tools erstellen → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) und [Host-API → `host.profile`](/info/host-api.html#host-profile).)

![Der einzelne Schalter Meine Angaben zum Erstellen verwenden, neben Profil speichern, ausgeschaltet bis Sie ihn aktivieren](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil vs. Plattform vs. Fähigkeiten

Drei Dinge liegen in der Benutzeroberfläche nah beieinander und lassen sich leicht verwechseln:

- <!--i:people--> **Profil** - *Sie* (oder Ihr Team, oder die Rolle, in der Sie sind): Name, Kontakt, Porträtfoto, Ihre gespeicherte Arbeit. Persönlich, geräte-lokal, als Bündel portabel.
- <!--i:palette--> **Plattform** - die *Marke*: Farben, Schriften und globale Einstellungen, gegen die jedes Tool rendert. Gemeinsam und einheitlich, nicht persönlich.
- <!--i:sliders--> **Fähigkeiten** - *was die App kann*: der vollständige Funktionsumfang und die Ihnen verfügbaren Tools.

Ein Profil ändert, *von wem* ein Asset stammt; die Plattform ändert, *wie* es aussieht; Fähigkeiten bestimmen, *was Sie erstellen können*.

### „Profil" bedeutet anderswo zwei andere Dinge - nicht dieses hier

Der Begriff ist im gesamten Projekt überladen. Keines der beiden ist das persönliche Profil, um das es auf dieser Seite geht:

- <!--i:box--> **Content-Profil** - eine Build-Zeit-Konfiguration in `profiles.json`, die eine Reihe von Tool-Paketen an einen Markenkatalog bindet (z. B. `suse`, `lolly-start`). Das wählt ein Betreiber beim Deployment, und auch der `profile`-**URL-/CLI-Parameter** wählt damit zur Exportzeit eine *Farb*-Variante (die ICC-/CMYK-Druckbedingung - siehe [URL-Modus](/info/url-mode.html)). Beide betreffen den *Build/die Ausgabe*, nicht *Sie*. Siehe [Konfiguration](/info/configuration.html).
- <!--i:seal--> **Identitätsprofil** - die optionale **verifizierte Content-Credentials-Identität**, die Sie registrieren können (ein kurzlebiges Zertifikat, das Ihre E-Mail an Ihre signierten Exporte bindet). Das ist eine Signaturidentität, getrennt von den Name-/Kontaktfeldern des persönlichen Profils, wobei **Meine Angaben zum Erstellen verwenden** steuert, ob eines von beiden eingebettet wird. Siehe [Content Credentials Identität](/info/content-credentials-identity.html).

![Die Karte Verifizierte Identität, Telefonbreite: der Auswähler für die Zertifikatslaufzeit und der Registrierungsschritt darunter - das Identitätsprofil, getrennt von Ihren persönlichen Angaben](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Datenschutz

Abgesehen von der optionalen Identitätsregistrierung oben (die die E-Mail, mit der Sie sich registrieren, an den Zertifikatsdienst sendet - siehe [Server-Oberfläche](/info/server-surface.html)), wird ein Profil nie übertragen, hochgeladen oder verwendet, um Sie zu identifizieren oder zu verfolgen - es gibt nichts, dem zuzustimmen wäre, nur diesen Hinweis, damit Sie wissen, was gespeichert wird. Löschen Sie alles davon jederzeit mit **Profil → Alle meine Daten löschen**. Siehe die [Datenschutzerklärung](/info/privacy.html).
