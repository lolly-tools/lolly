# Profile

Legen Sie Ihren Namen, Ihre Kontaktdaten und Ihr Porträtfoto einmal fest, und jedes dafür eingerichtete Tool füllt sie ein, etwa in einer E-Mail-Signatur, einem Badge oder einer Karte für Vortragende. Dieser Datensatz ist Ihr **Profil**, und er liegt auf Ihrem Gerät.

Ihr Profil enthält außerdem gespeicherte Sitzungen, hochgeladene Bilder und Ihre lokale Aktivitätszählung. Sie verwalten es unter **Settings → Preferences**. Tools lesen nur die Felder, die sie vorab ausfüllen sollen. Die eigenständige Nutzung braucht kein Konto. Optionales Sync, Teilen und Dienste der Organisation haben jeweils eigene Datenflüsse.

<!--i:eti-user-check-->
## Was ein Profil enthält

| Teil | Inhalt |
|---|---|
| **Name** | Vor- und Nachname. |
| **Contact** | E-Mail und Telefon. |
| **Location** | Stadt und Land. |
| **Headshot** | Ein optionales Foto, quadratisch zugeschnitten und als lokales Bild gespeichert, für Tools wie E-Mail-Signaturen, Zitatkarten und Organigramme. |
| **Use my details to create** | Ein Schalter, den Sie selbst einschalten und der dann **Using my details** anzeigt. Er entscheidet, ob Ihre Angaben als Urheberangabe in exportierten Dateien und bei Läufen von Lolly Batch mitreisen; siehe [Wie Tools Ihr Profil verwenden](#how-tools-use-your-profile). |
| **Preferences** | Ihr Design, Ihre Farbvariante in jedem Designsystem, Ihre Einstellungen zur Barrierefreiheit und die Teile der App, die Sie unter **Feature flags** aktiviert haben. |
| **Your work** | Gespeicherte Sitzungen mit ihren Vorschaubildern, organisiert in [Lolly Projects](/info/find-your-work.html), Ihre hochgeladenen Bilder und Ihre lokale Aktivitätsstatistik. |

Keine dieser Angaben ist erforderlich, und auch ein leeres Profil funktioniert.

![Settings im Tab Preferences: die Einstellungsleiste und Your details mit dem Schalter Use my details to create und den Feldern für Name, Kontakt und Standort](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Lolly-Einstellungen](/info/dashboard.html) behandelt den Rest von Preferences, vom Erscheinungsbild und Emoji bis zu Speicher und Offline-Downloads.

<!--i:eti-users-->
## Sie selbst, ein Team oder eine Rolle

In Lolly steht ein Profil dafür, wer Sie sind, während Sie etwas erstellen: Sie selbst, ein Team oder eine Rolle. Lolly behandelt alle drei gleich.

::: cols
## Als Sie selbst

Der Standard: Ihr Name, Ihre E-Mail und Ihr Porträtfoto. Ihre Signatur, Ihr Badge und Ihr Konferenz-Lockup werden damit ausgefüllt.

## Als Team

Der gemeinsame Name eines Teams, ein Gruppenpostfach wie `events@…`, eine Abteilung und das Zeichen des Teams. Eine Person richtet das Profil ein und exportiert eine Datei. Alle anderen laden dasselbe Profil, sodass die Dateien des Teams dieselben Angaben tragen. Ein gemeinsam genutztes Kioskgerät oder ein Demo-Laptop kann mit einem Teamprofil laufen.

## In einer Rolle

Ein Eventmanager braucht an drei Tagen im Jahr das Veranstaltungspostfach und die Untermarke auf Badges und Beschilderung, danach wieder seine übliche Identität. Behalten Sie die Rolle als gespeicherte Profildatei, laden Sie die Datei für die Veranstaltung und legen Sie sie anschließend beiseite.
:::

![Das Steuerelement für das Porträtfoto, leer, bis Sie ein Foto hochladen, das dann auf diesem Gerät bleibt](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profile in einer Organisation, die Lolly Work nutzt
Wenn Sie sich bei [Lolly Ihrer Organisation](/info/organisation.html) anmelden, kann Lolly Work verifizierte Profilfelder von seinem Identitätsanbieter bereitstellen und Felder oder Einstellungen gemäß den Richtlinien der Organisation festlegen. Ein verwaltetes Feld ist in der App gekennzeichnet.

Diese Anmeldung steuert auch den Zugriff auf gemeinsame Projekte und Assets. Eine Teamprofildatei ist eine lokale Datei. Sie gewährt keine Mitgliedschaft in der Organisation und ersetzt kein Arbeitskonto. **Use my details to create** steuert die Urheberangabe in Ihren Exporten, nicht die Anmeldung oder die Audit-Aufzeichnungen der Organisation. Siehe [Datenschutz](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Mehrere behalten, eines verwenden

Eine Installation hat jeweils ein aktives Profil, ohne Umschalter in der App. Jedes Profil ist eine portable Datei, dieselbe Sicherungsdatei, die Ihre Arbeit auf ein neues Gerät überträgt. So wechseln Sie den Kontext:

::: timeline
- <!--i:download--> **Export my data** unter **Settings → Storage → Move to another device** speichert das aktuelle Profil als eine `.zip`.
- <!--i:trash--> **Clear all my data** leert diese Installation.
- <!--i:upload--> **Import data…** lädt die Profildatei für den Kontext, in den Sie wechseln.
:::

::: note Ein Import ohne vorheriges Leeren führt Daten zusammen
Importierte Sitzungen und Bilder werden hinzugefügt. Wo beide Kopien existieren, bleibt die zuletzt gespeicherte erhalten. Ordner, Favoriten und Vorlagen werden neben Ihren hinzugefügt. Ihre eigenen Angaben bleiben, außer bei leeren Feldern, die die Werte aus der Datei übernehmen. Eine Zusammenführung eignet sich, um die Sitzungen eines Teams in Ihre Umgebung zu holen, aber nicht für eine klare Trennung zwischen Rollen.
:::

Für zwei Kontexte gleichzeitig nutzen Sie ein separates Browserprofil, Benutzerkonto oder eine separat installierte Kopie der Web-App. Jedes davon hat sein eigenes Lolly-Profil.

![Die beiden Schaltflächen, die eine ganze Installation übertragen: Export my data schreibt eine zip-Datei, Import data liest sie wieder ein](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Eine Datei pro Kontext behalten
Benennen Sie jede Datei nach ihrem Zweck, etwa `LollyTools-events-2026.zip` und `LollyTools-me.zip`. Die Datei ist das Profil.
:::

[Ihre Arbeit auf ein anderes Gerät übertragen](/info/find-your-work.html#move-your-work-to-another-device) behandelt, was die Datei enthält, was zurückbleibt und welche weiteren Übertragungswege es gibt, einschließlich Sync.

<!--i:eti-pen-->
## Wie Tools Ihr Profil verwenden

**Vorab ausfüllen.** Die Autorin oder der Autor eines Tools kennzeichnet eine Eingabe so, dass sie Daten aus Ihrem Profil bezieht (`bindToProfile: "firstname"`, `"email"`, `"headshot"` und so weiter). Beim Öffnen des Tools wird diese Eingabe aus Ihrem Profil gefüllt. Sie können den Wert für eine Sitzung überschreiben, ohne das Profil zu ändern, sofern keine Richtlinie der Organisation die Eingabe sperrt. Das Vorabausfüllen geschieht lokal, unabhängig davon, ob **Use my details** eingeschaltet ist.

**Urheberangabe.** Beim Export können Ihre Angaben als Urheberangabe in den Metadaten der Datei mitreisen (PNG, PDF, SVG und weitere). **Use my details to create** steuert diese Angabe und den Urheber bei Läufen von Lolly Batch. Ist der Schalter aus, steht im Export weiterhin, dass er mit Lolly erstellt wurde, aber er enthält keine persönliche Urheber- oder Kontaktzeile.

Für Tool-Autoren: siehe [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) und [`host.profile`](/info/host-api.html#host-profile).

![Der einzelne Schalter Use my details to create, als freiwillige Option gekennzeichnet und aus, bis Sie ihn einschalten](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profil, Designsystem und Funktionen

Drei Dinge stehen in Settings nah beieinander und sind leicht zu verwechseln:

- <!--i:people--> **Profile** - Sie, Ihr Team oder Ihre Rolle: Name, Kontakt, Porträtfoto und gespeicherte Arbeit. Persönlich, auf dem Gerät gespeichert und als Datei portabel.
- <!--i:palette--> **Design system** - die Marke: Farben, Schriften und Einstellungen, mit denen jedes Tool rendert. Gemeinsam, nicht persönlich; siehe [Lolly Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - was die App kann: die Funktionen und Tools, die Ihnen zur Verfügung stehen.

Das Wort hat in Lolly drei weitere Bedeutungen. Ein **Inhaltsprofil** ist eine Build-Einstellung, die festlegt, welche Tools und welchen Katalog eine Bereitstellung enthält; das [Glossar](/info/glossary.html) definiert den Begriff. Der Linkparameter `profile` wählt ein Farbprofil für einen Export, etwa eine CMYK-Druckbedingung; siehe [Reservierte URL-Parameter](/info/url-parameters.html#print). Eine **verifizierte Identität** ist das optionale Signaturzertifikat, das Ihre E-Mail mit Ihren signierten Exporten verknüpft. Sie ist von diesen Angaben getrennt, aber **Use my details to create** entscheidet, ob eines von beidem eingebettet wird; siehe [Content Credentials](/info/content-credentials-identity.html).

![Die Karte Verified identity in Smartphone-Breite: die Auswahl der Zertifikatslaufzeit und der Registrierungsschritt darunter - das Identitätsprofil, getrennt von Ihren persönlichen Angaben](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Datenschutz

Ihr persönliches Profil wird lokal gespeichert. Ihre Angaben können in einer Sicherungs- oder Sync-Kopie, in geteilten oder exportierten Inhalten und bei der optionalen Registrierung für Content Credentials mitreisen. In einer Instanz von Lolly Work sind Anmeldung, gemeinsame Arbeit, Telemetrierichtlinien und Audit-Aufzeichnungen von diesem lokalen Profil getrennt. **Settings → Preferences → Clear all my data** leert dieses Gerät; Kopien bei Ihrem Speicheranbieter oder Ihrer Organisation werden dadurch nicht gelöscht. Siehe die [Datenschutzerklärung](/info/privacy.html).
