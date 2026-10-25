# Profile

Legen Sie Ihren Namen, Ihre Kontaktdaten und Ihr Porträtfoto einmal fest, und jedes Tool, das dafür gebaut ist, füllt sie für Sie aus: eine E-Mail-Signatur, ein Namensschild, eine Referentenkarte. Dieser kleine Datensatz ist Ihr **Profil**, und er liegt auf Ihrem Gerät.

Ihr Profil enthält auch, was Sie bei der Arbeit aufbauen: gespeicherte Sitzungen, hochgeladene Bilder und Ihre lokale Aktivitätsübersicht. Sie verwalten es unter **Settings → Preferences**; Tools lesen immer nur die Felder, die sie vorausfüllen sollen. Die eigenständige Nutzung braucht kein Konto, und optionales Sync, Teilen und Organisationsdienste haben jeweils eigene Datenflüsse, unten beschrieben.

## Was in einem Profil steckt

| Teil | Was es ist |
|---|---|
| **Name** | Vor- und Nachname. |
| **Contact** | E-Mail und Telefon. |
| **Location** | Stadt und Land. |
| **Headshot** | Ein optionales Foto, auf ein Quadrat zugeschnitten und als lokales Bild behalten, für Tools wie E-Mail-Signaturen, Zitatkarten und Organigramme. |
| **Use my details to create** | Ein Opt-in-Schalter (er heißt **Using my details**, sobald er an ist). Er entscheidet, ob Ihre Angaben als Urheberhinweis in exportierten Dateien und bei Batch-Läufen mitreisen. Das Vorausfüllen beeinflusst er nicht; siehe [Wie Tools Ihr Profil nutzen](#how-tools-use-your-profile). |
| **Preferences** | Ihr Design, Ihre Einstellungen zur Barrierefreiheit und welche Teile der App Sie in **Feature flags** eingeschaltet haben. |
| **Your work** | Gespeicherte Sitzungen mit ihren Vorschaubildern, geordnet in [Projects](/info/find-your-work.html), Ihre hochgeladenen Bilder und Ihre lokalen Aktivitätsstatistiken. |

Nichts davon ist erforderlich. Ein leeres Profil funktioniert; füllen Sie nur aus, was Ihnen Tipparbeit spart.

![Settings auf dem Tab Preferences: die Einstellungsleiste und Your details mit dem Schalter Use my details to create und den Feldern für Name, Kontakt und Ort](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Einstellungen](/info/dashboard.html) bildet alles andere unter Preferences ab, von Erscheinungsbild und Emoji bis zu Speicher und Offline-Downloads.

## Sie, ein Team oder eine Rolle

Das Wort "Profil" legt eine feste Person nahe. In Lolly ist es eher ein Entstehungskontext: wer Sie sind, während Sie dies hier erstellen. Es kann drei Formen annehmen, und Lolly behandelt jede gleich.

::: cols
## Als Sie selbst

Der Standard. Ihr Name, Ihre E-Mail-Adresse, Ihr Porträtfoto. Legen Sie es einmal fest, und Ihre Signatur, Ihr Namensschild und Ihr Konferenz-Lockup füllen sich selbst aus.

## Als Team

Der gemeinsame Name eines Teams, ein Gruppenpostfach wie `events@…`, eine Abteilung und das Zeichen des Teams. Eine Person richtet es ein und exportiert es, und alle anderen laden dasselbe Profil, sodass die Dateien des Teams einheitliche Angaben tragen. Ein gemeinsam genutzter Kiosk oder ein Demo-Laptop kann ein Teamprofil laufen lassen.

## Als Rolle

Eine Eventmanagerin will an drei Tagen im Jahr das Event-Postfach und die Event-Untermarke auf Namensschildern und Beschilderung und danach wieder ihre übliche Identität. Behalten Sie diese Rolle als gespeicherte Profildatei, laden Sie sie für das Event und legen Sie sie danach beiseite.
:::

![Die Porträtfoto-Steuerung, leer bis Sie ein Foto hochladen, das dann auf diesem Gerät bleibt](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profile in einer Organisation mit Lolly Work
Wenn Sie sich am [Lolly einer Organisation](/info/organisation.html) anmelden, kann Lolly Work verifizierte Profilfelder von seinem Identitätsanbieter liefern und Felder oder Einstellungen nach der Richtlinie der Organisation festlegen. Ein verwaltetes Feld ist in der App gekennzeichnet.

Diese Anmeldung steuert auch den Zugriff auf gemeinsame Projekte und Assets. Eine Teamprofil-Datei bleibt eine lokale Datei: Sie gewährt keine Mitgliedschaft in der Organisation und ersetzt kein Work-Konto. **Use my details to create** steuert den Urheberhinweis in Ihren Exporten, nicht die Anmelde- oder Audit-Aufzeichnungen der Organisation. Siehe [Datenschutz](/info/privacy.html#organisation-services-with-lolly-work).
:::

## Mehrere behalten, eines nutzen

Eine Installation hat jeweils ein aktives Profil, und es gibt keinen Umschalter in der App. Stattdessen ist jedes Profil eine portable Datei, dieselbe Backup-Datei, die Sie auch für den Umzug auf ein neues Gerät nutzen würden. So wechseln Sie in einen anderen Kontext:

::: timeline
- <!--i:download--> **Export my data** unter **Settings → Storage → Move to another device** speichert das aktuelle Profil als eine `.zip`.
- <!--i:trash--> **Clear all my data** leert diese Installation.
- <!--i:upload--> **Import data…** lädt die Profildatei für den Kontext, in den Sie wechseln.
:::

Der Import ohne vorheriges Leeren **führt zusammen**. Importierte Sitzungen und Bilder werden hinzugefügt; wo beide Kopien existieren, bleibt die zuletzt gespeicherte. Ordner, Favoriten und Vorlagen werden neben Ihren hinzugefügt, und Ihre eigenen Angaben bleiben, abgesehen von leeren Feldern, die die Werte der Datei übernehmen. Das eignet sich, um die Sitzungen eines Teams in Ihre eigene Einrichtung zu holen, aber nicht für einen sauberen Schnitt zwischen Rollen.

Für zwei Kontexte gleichzeitig nutzen Sie ein getrenntes Browserprofil, ein getrenntes Benutzerkonto oder eine zweite installierte Kopie der Web-App: Jede trägt ihr eigenes unabhängiges Lolly-Profil.

![Die beiden Schaltflächen, die eine ganze Installation bewegen: Export my data schreibt ein Zip, Import data liest es wieder ein](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Behalten Sie eine Datei je Kontext und benennen Sie jede nach dem, was sie ist, etwa `LollyTools-events-2026.zip` und `LollyTools-me.zip`. Die Datei ist das Profil.

[Ihre Arbeit auf ein anderes Gerät bringen](/info/find-your-work.html#move-your-work-to-another-device) behandelt, was die Datei enthält, was zurückbleibt und die anderen Wege des Umzugs, einschließlich Sync.

## Wie Tools Ihr Profil nutzen

**Vorausfüllen.** Eine Tool-Autorin oder ein Tool-Autor kennzeichnet eine Eingabe als aus Ihrem Profil gespeist (`bindToProfile: "firstname"`, `"email"`, `"headshot"` und so weiter). Wenn das Tool sich öffnet, füllt sich diese Eingabe aus Ihrem Profil, und Sie können sie für eine Sitzung überschreiben, ohne das Profil zu ändern, sofern die Richtlinie einer Organisation die Eingabe nicht sperrt. Das Vorausfüllen ist eine lokale Annehmlichkeit und geschieht, egal ob **Use my details** an ist.

**Urheberhinweis.** Beim Export können Ihre Angaben als Urheberhinweis in den Metadaten der Datei mitreisen (PNG, PDF, SVG und mehr), sodass eine fertige Datei sagen kann, wer die Arbeit gemacht hat. **Use my details to create** steuert dies und den Autor bei Batch-Läufen. Ist es aus, sagt der Export weiterhin, dass er mit Lolly erstellt wurde, und trägt keine persönliche Autoren- oder Kontaktzeile.

Für Tool-Autoren: siehe [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) und [`host.profile`](/info/host-api.html#host-profile).

![Der einzelne Schalter Use my details to create, als Opt-in gekennzeichnet und aus, bis Sie ihn einschalten](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil, Designsystem und Capabilities

Drei Dinge stehen in Settings nahe beieinander und lassen sich leicht verwechseln:

- <!--i:people--> **Profile** - Sie, Ihr Team oder die Rolle, in der Sie sind: Name, Kontakt, Porträtfoto und gespeicherte Arbeit. Persönlich, auf dem Gerät gehalten und als Datei portabel.
- <!--i:palette--> **Design system** - die Marke: Farben, Schriften und Einstellungen, mit denen jedes Tool rendert. Geteilt und einheitlich statt persönlich; siehe [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - was die App kann: die Funktionen und Tools, die Ihnen zur Verfügung stehen.

Ein Profil ändert, von wem eine Datei stammt; das Designsystem ändert, wie die Datei aussieht; Capabilities sind das, was Sie erstellen können.

Das Wort hat in Lolly drei weitere Bedeutungen. Ein **Content-Profil** ist eine Build-Einstellung, die wählt, welche Tools und welchen Katalog eine Bereitstellung ausliefert; das [Glossar](/info/glossary.html) definiert den Begriff. Der Link-Parameter `profile` wählt ein Farbprofil für einen Export, etwa eine CMYK-Druckbedingung; siehe [Reservierte URL-Parameter](/info/url-parameters.html#print). Eine **verifizierte Identität** ist das optionale Signaturzertifikat, das Ihre E-Mail-Adresse an Ihre signierten Exporte bindet, getrennt von diesen Angaben, obwohl **Use my details to create** steuert, ob eines von beiden eingebettet wird; siehe [Content Credentials](/info/content-credentials-identity.html).

![Die Karte Verifizierte Identität, Telefonbreite: der Auswähler für die Zertifikatslaufzeit und der Registrierungsschritt darunter - das Identitätsprofil, getrennt von Ihren persönlichen Angaben](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Datenschutz

Ihr persönliches Profil wird lokal gespeichert. Ihre Angaben können in einem Backup oder einer Sync-Kopie, in Inhalten, die Sie teilen oder exportieren, und bei der optionalen Registrierung für Content Credentials mitreisen. Auf einer Lolly-Work-Instanz sind Anmeldung, gemeinsame Arbeit, Telemetrie-Richtlinie und Audit-Aufzeichnungen von diesem lokalen Profil getrennt. **Settings → Preferences → Clear all my data** leert dieses Gerät; es löscht keine Kopien, die Ihr Speicheranbieter oder Ihre Organisation hält. Siehe die [Datenschutzrichtlinie](/info/privacy.html).
