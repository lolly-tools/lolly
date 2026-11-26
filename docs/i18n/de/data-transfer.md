# Datenübertragung: das `lolly-backup`-Bündel

Ein Backup-Bündel überträgt die persönliche Bibliothek, die Lolly auf dem Gerät speichert: Exportieren Sie sie auf einer Installation, übertragen Sie die Datei (USB, AirDrop, E-Mail an sich selbst oder eine Netzwerkfreigabe) und importieren Sie sie auf einer anderen. Export und Import benötigen keinen Server, und das Ziel kann offline sein.

Dies ist die Formatspezifikation für Personen, die Shells, Tools oder Skripte rund um Backups entwickeln. Um Ihre eigene Arbeit zu übertragen, lesen Sie [Ihre Arbeit auf ein anderes Gerät übertragen](/info/find-your-work.html#move-your-work-to-another-device).

![Die beiden Schaltflächen, die eine ganze Installation übertragen: Export my data schreibt eine zip-Datei, Import data liest sie wieder ein](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Geltungsbereich
Ein Bündel enthält *Benutzerdaten*, keine Katalog-Tools. Katalog-Tools und Katalog-Assets werden separat synchronisiert und auf dem Ziel als vorhanden vorausgesetzt, schlimmstenfalls in einer höheren Version. Von Benutzern erstellte Tools werden in `profile.json` mitgeführt. Ein Import installiert oder aktualisiert nie ein Katalog-Tool.
:::

<!--i:eti-badge-check-->
## Ziele

- <!--i:box--> **Ein Format, jede Shell.** Die Web-App, die Desktop- und Mobil-Apps und künftige Shells teilen dieselbe Hülle und dieselben Teilschemata. Optionale Teile hängen von den Fähigkeiten der jeweiligen Shell ab, und nicht unterstützte Teile werden gemeldet. Jede Capability-Bridge liefert ihren Speicheradapter.
- <!--i:shieldcheck--> **Übersteht die Übertragung.** Ein bei der Übertragung beschädigtes oder abgeschnittenes Bündel führt beim Import zu einem Fehler und wird niemals nur teilweise wiederhergestellt.
- <!--i:clock--> **Überdauert diese Version.** Eine ältere App importiert die Teile eines neueren Bündels, die sie erkennt. Ein inkompatibles Format wird sauber abgelehnt.
- <!--i:check--> **Sicher zusammenführen.** Beim Import in eine bereits genutzte Installation wird niemals etwas gelöscht, das nicht im Bündel enthalten war.

<!--i:eti-package-->
## Die Hülle

Ein Bündel ist ein gewöhnliches `.zip`. Es übersteht jede Übertragung unversehrt, und jedes Entpack-Tool kann den Inhalt prüfen.

Der Download wird nach seinem Eigentümer benannt: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, zum Beispiel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. Vor- und Nachname stammen aus dem Profil und werden weggelassen, wenn sie nicht gesetzt sind: Ohne Profil ergibt sich `LollyTools-2026-06-26-1.zip`, mit nur einem Vornamen `LollyTools-Ada-2026-06-26-1.zip`. Jeder Name wird zu einem dateinamensicheren Token (Unicode-Buchstaben und Ziffern bleiben erhalten, Leer- und Satzzeichen werden entfernt, höchstens 32 Zeichen). `<n>` ist eine laufende Nummer pro Tag und Gerät, sodass wiederholte Exporte an einem Tag nicht kollidieren und ihre Reihenfolge behalten. `backupFilename()` in `data-transfer.ts` erstellt den Namen. Der Name ändert den Inhalt des ZIPs nicht.

| Pfad | Erforderlich | Inhalt |
|---|---|---|
| `manifest.json` | ja | Format-ID, Versionen, Anzahlen und Integrität pro Teil. Ein Reader liest diese Datei zuerst. |
| `profile.json` | wenn gesetzt | Der `me`-Datensatz des Benutzers: Name, Kontakt, Porträtbildreferenz und Flags sowie Ordner, Papierkorb, Projektbaupläne, Benutzervorlagen und selbst erstellte Tools, Favoriten, ausgeblendete Tools, Sprache und Emoji-Auswahl. Gelesen über `host.profile`. |
| `sessions.json` | ja | Jede gespeicherte Sitzung: Slot, Tool-ID und Version, Bezeichnung, Miniaturbild (Daten-URL) und vollständige Eingabedaten. Gelesen über `host.state`. |
| `assets.json` | ja | Metadaten für jedes hochgeladene Asset (Bilder, Schriften, Marken-Tokens, Logos, gespeicherte Kopien von Downloads), jeweils mit Verweis auf seine Bytes unter `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | pro Asset | Die unverarbeiteten Asset-Bytes, unkomprimiert gespeichert, weil die meisten bereits komprimierte Formate sind. Die Erweiterung ist rein kosmetisch; maßgeblich ist der MIME-Typ in `assets.json`. |
| `assets/blobs/<n>.c2pa` | wenn vorhanden | Extrahierte Content Credentials als exakte Binärbytes, referenziert durch `_credentialFile` im Asset-Datensatz. Dies sind keine Signierschlüssel des Geräts. |
| `design-systems.json` | wenn vorhanden | Die auf dieser Installation erstellten oder hinzugefügten Designsysteme als `{ active, records }`. Siehe [Importregeln](#import-rules). |
| `file-history.json` | optional | Versionierte Asset-Snapshots, abgeschlossene Berichte über Dateioperationen und vollständige Batch-Manifeste, mit einer eigenen Version. Bereitgestellt vom internen Backup-Adapter `fileHistory` der Shell. |
| `revision-history.json` | optional, manuelle Backups | Stabile Werk-IDs, aufbewahrte Checkpoints, Miniaturbilder und fortlaufende Wiederherstellungsentwürfe. Bereitgestellt von `host.state.history.backup`, wo unterstützt. |
| `file-history/versions/` | pro Snapshot | Frühere Asset-Bytes und extrahierte Credentials, unabhängig davon, ob das aktuelle Asset noch existiert. |
| `file-history/results/` | pro abgeschlossener Operation | Exakte Ausgabebytes. Keine zur Umwandlung ausgewählte Originaldatei wird aufbewahrt oder aufgenommen. |
| `prefs.json` | ja | Lokale Einstellungen des Benutzers: `theme`, `sidebarWidth` und der Aktivitätszähler `ct-metrics`. |
| `lolly.txt` | ja | Eine lesbare Zusammenfassung des Bündels (Anzahlen, Profil, Dateiname) für alle, die das ZIP ohne Lolly öffnen. Bei jedem Export neu erzeugt und beim Import erkannt, sodass sie nie als übersprungener Teil zählt. Sie wird nach der Integritätszuordnung geschrieben, daher deckt die Zuordnung diese Datei nicht ab. |

::: details Wie der Export das ZIP schreibt
Der Export schreibt das ZIP Teil für Teil (`shells/web/src/lib/zip-stream.ts`). Uploads, gespeicherte Ergebnisse und gespeicherte Asset-Versionen werden in Abschnitten von 4 MiB gelesen, niemals vollständig. Gespeicherte Ergebnisse und Versionen werden zuerst gegen ihren festgehaltenen SHA-256 geprüft. Anschließend wird jede Datei für ihre Prüfsumme und ihren Integritäts-Digest gelesen, und das ZIP verweist auf die Datei an ihrem Speicherort.

Nichts wird neu kodiert. Jeder Teil behält seine exakten Bytes und seinen Digest, sodass eine Datei mit Content Credentials die Bytes behält, die ihre Signatur abdeckt. Bei denselben Teilen und demselben Zeitpunkt ist das ZIP identisch mit dem des früheren Writers, der im Arbeitsspeicher arbeitete, außer dass eine Verlaufsdatei über 16 MiB stückweise komprimiert wird. `tests/backup-streaming.test.ts` prüft dies gegen festgehaltene Referenz-Digests.

Bei einer synthetischen Bibliothek von 192 MiB, gemessen in Node, benötigte das Abschließen des Backups etwa 125 bis 150 MiB zusätzlich zur Bibliothek, gegenüber etwa 850 MiB beim Writer im Arbeitsspeicher (`node scripts/bench-backup-finalise.ts`). Der Import liest weiterhin das gesamte ZIP in den Arbeitsspeicher.
:::

<!--i:eti-file-->
## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Feld | Bedeutung |
|---|---|
| `format` | Immer `lolly-backup`. Eine Datei ohne diesen Wert wird als „kein Lolly-Backup“ abgelehnt. |
| `formatVersion` | Das Layout, mit dem dieses Bündel **geschrieben** wurde. Wird bei jeder Änderung am Satz der Teile oder deren Struktur erhöht. Reader entscheiden **nicht** anhand dieses Felds über den Import. |
| `minReader` | Die niedrigste Reader-Version, die dieses Bündel **sicher** importieren kann. Anhand dieses Felds entscheiden Reader über den Import. |
| `app` | ID der erzeugenden App, zur Diagnose. |
| `exportedAt` | ISO-Zeitstempel der Erstellung des Bündels. |
| `counts` | Was der Writer aufgenommen hat, zur Anzeige und für Plausibilitätsprüfungen. |
| `integrity` | Optional. Ordnet jedem Teil außer `manifest.json` einen Digest seiner **unkomprimierten** Bytes im SRI-Stil `sha256-<base64>` zu. |

<!--i:eti-tag-->
## Versionsregeln

Zwei Versionsnummern lassen das Format wachsen, ohne ältere Installationen zurückzulassen.

![Eine Änderung am Bündelformat ist entweder additiv, sodass alte Reader sie ignorieren können, oder inkompatibel, sodass ein falscher Import Daten beschädigt. Additiv erhöht formatVersion und behält minReader bei; inkompatibel erhöht formatVersion und minReader. Ein Reader importiert, wenn minReader höchstens seiner eigenen Version entspricht.](/info/diagrams/concepts/backup-version-gate.svg)

- Ein Reader importiert ein Bündel, wenn `manifest.minReader` höchstens seiner eigenen Reader-Version entspricht. Nur wenn das Bündel einen neueren Reader verlangt, lehnt er es mit „benötigt eine neuere Version der App“ ab.
- Eine **additive** Änderung, etwa ein neuer optionaler Teil oder ein neues optionales Manifestfeld, erhöht `formatVersion` und lässt `minReader` unverändert. Ältere Apps importieren weiterhin jeden Teil, den sie erkennen, und melden Teile, die sie nicht erkennen, als übersprungen, statt sie stillschweigend zu verwerfen.
- Eine **inkompatible** Änderung, bei der ein falscher Import eines Teils Daten beschädigt oder ein optionaler Teil verpflichtend wird, erhöht `minReader`. Ältere Apps lehnen dann sauber ab, statt etwas zu importieren, das sie nicht verarbeiten können. Ältere Apps lehnen das Bündel dann sauber ab.
- Wenn ein künftiges Bündel `formatVersion` setzt, aber `minReader` weglässt, entscheiden Reader ersatzweise anhand von `formatVersion` über den Import und behandeln die Änderung als inkompatibel.

::: note Faustregel für Autoren
Wenn jeder vorhandene Reader weiterhin richtig arbeiten würde, indem er Ihre Ergänzung ignoriert, ist die Änderung additiv: Erhöhen Sie `formatVersion` und lassen Sie `minReader` unverändert. Andernfalls erhöhen Sie `minReader`.
:::

<!--i:eti-shield-check-->
## Integrität

Wenn `manifest.integrity` vorhanden ist, prüft ein Reader den SHA-256 jedes aufgelisteten Teils, **bevor er irgendetwas schreibt**. Eine Abweichung („Integritätsprüfung fehlgeschlagen“) oder ein fehlender Teil („unvollständig“) stoppt den Import, sodass es keine teilweise Wiederherstellung gibt. Das erkennt Übertragungsschäden: eine abgebrochene AirDrop-Übertragung, ein E-Mail-Gateway, das den Anhang neu kodiert hat, einen fehlerhaften USB-Sektor.

Integrität wird nach Möglichkeit geprüft. Die Integritätsangaben werden nur dort geschrieben, wo Web Crypto verfügbar ist (in jedem sicheren Browserkontext und modernem Node), und nur geprüft, wenn sowohl die Zuordnung als auch Web Crypto vorhanden sind. Ein Bündel ohne Zuordnung, etwa eines aus der Zeit vor der Integritätsprüfung, wird unverändert importiert: „nicht überprüfbar“ gilt nie als „beschädigt“.

Das Manifest listet weder sich selbst noch die neu erzeugte `lolly.txt` auf.

<!--i:eti-download-->
## Importregeln

Ein Import läuft in einem von zwei Modi.

- **Merge** ist der Modus von **Import data…** und dem ersten Beitritt zur Synchronisierung, **Bring it to this device**. Daten auf dem Ziel bleiben erhalten, und nichts außerhalb des Bündels wird verändert.
- **Replace** verwendet die Gerätesynchronisierung, um Geräte auf demselben Stand zu halten. Sie übernimmt den Profildatensatz, die Einstellungen, Sitzungen, Bilder und die Auswahl des aktiven Designsystems aus der synchronisierten Kopie. Sie entfernt nur Elemente, die ein anderes Gerät seit der letzten Synchronisierung gelöscht hat. Beim Wiederherstellen einer früheren Kopie wird zuerst das Gerät gesichert, dann an diese Kopie angeglichen und alles entfernt, was die Kopie nicht enthält. [Ihre Geräte synchronisieren](/info/sync.html) beschreibt, was eine Person dabei sieht.

Beim Zusammenführen wird jede Datenart so behandelt:

| Daten | Bereits auf dem Ziel | Nur im Bündel |
|---|---|---|
| Sitzungen (nach Slot) und hochgeladene Bilder (nach ID) | Die zuletzt gespeicherte Kopie bleibt erhalten, sodass ein älteres Backup nie neuere Arbeit überschreibt. Bei gleichen oder unbekannten Zeitpunkten bleibt die Kopie des Ziels erhalten. | Hinzugefügt |
| Ordner | Name und übergeordneter Ordner des Ziels bleiben erhalten, und der Ordner erhält die ihm fehlenden Mitglieder aus dem Bündel. Eine auf dem Ziel in einem Ordner abgelegte Sitzung bleibt dort abgelegt. | Hinzugefügt |
| Favoriten (Tools, Katalog-Assets und Projects-Elemente) | Zusammengeführt | Hinzugefügt |
| Vorlagen, Projects-Vorlagen und Benutzer-Tools (nach ID) | Der Datensatz des Ziels bleibt erhalten. | Hinzugefügt |
| Papierkorbeinträge | Der Eintrag des Ziels bleibt erhalten. | Hinzugefügt, sodass ein Element, das auf einer der Installationen wiederhergestellt werden konnte, weiterhin wiederherstellbar ist. Ein Eintrag, dessen Ordner auf dem Ziel wieder verwendet wird oder dessen Papierkorb-Slot das Ziel bereits nutzt, wird weggelassen. |
| Andere Profilfelder (Name, Kontaktdaten, Sprache, Feature-Flags, ausgeblendete Tools und andere Einstellungen) | Der Wert des Ziels bleibt erhalten. | Übernommen, wo das Feld des Ziels leer ist |
| Einstellungen (`prefs.json`) | Der Wert des Ziels bleibt erhalten. | Geschrieben, wo das Ziel keinen hat |
| Designsysteme (nach ID) | Der Datensatz des Bündels ersetzt den des Ziels. | Hinzugefügt. Die aktive Auswahl des Bündels gilt nur, wenn das Ziel kein eigenes Designsystem hat. |
| Werkverlauf | Die zuletzt gespeicherte Kopie bleibt aktuell, die andere wird als geschützter Entwurf aufbewahrt. | Hinzugefügt |

**Gespeicherte Sitzungen werden automatisch wieder mit ihren Bildern verknüpft.** Asset-Referenzen werden nach ID aufbewahrt. Die Bridge löst sie nach der Wiederherstellung der Bilder erneut auf, weil `blob:`-URLs ein Neuladen nicht überstehen.

**Verlaufseinträge ändern sich nach dem Schreiben nie.** Ein wiederholter Import von Asset-Versionen und Operations-IDs fügt nichts hinzu, und eine ID, die bereits andere Bytes oder einen anderen Verlauf bezeichnet, wird abgelehnt, nicht überschrieben. Der erneute Import eines identischen aktuellen Assets behält dessen Version bei, und ein geändertes aktuelles Asset muss eine andere Version tragen.

**Für den Werkverlauf gelten einige weitere Regeln.** Ein Werk, dessen Slot das Ziel für ein anderes Werk verwendet, wird als separates Werk hinzugefügt, und ein Werk im Papierkorb des Ziels bleibt dort. Bezeichnet eine Checkpoint-ID auf dem Ziel andere Inhalte, bleiben die des Ziels erhalten. Ein Archiv, das seine eigenen Prüfungen nicht besteht, stoppt den Import, bevor Profile, Sitzungen, Assets oder Einstellungen geändert werden, und ein identischer wiederholter Import belegt keinen zusätzlichen Speicher.

**Die Zusammenfassung meldet, was passiert ist.** Jeder Import gibt `profile`, `sessions`, `userAssets`, `prefs`, `skipped` und `failedAssets` zurück.

- `failedAssets` zählt hochgeladene Assets, die nicht wiederhergestellt werden konnten, etwa weil der Gerätespeicher voll ist.
- `skipped` zählt Teile eines neueren Writers, die dieser Build nicht erkannt hat. Die App zeigt die Anzahl („… · N neuere Elemente übersprungen“).
- Mit Dateiverlauf ergänzt die Zusammenfassung `assetVersions`, `fileOperations`, `fileBatches` und `failedHistory`. Ein voller Speicher oder ein Konflikt mit einer unveränderlichen ID kann zu einer teilweisen Wiederherstellung führen, und die App fordert die Person dann auf, das Quell-Backup aufzubewahren.
- Mit Werkverlauf ergänzt sie `revisions` und `recoveryDrafts`, die nur zählen, was dieser Import hinzugefügt hat, sowie `added`, `kept`, `replaced`, `copies` und `hidden` dafür, wie jedes Werk zusammengeführt wurde. `skippedCheckpoints` zählt Checkpoints, deren ID auf dem Ziel andere Inhalte bezeichnet, und `historyLeftOut` zählt ältere Checkpoints und Entwürfe, die nicht in den Verlaufsspeicher des Geräts passten.
- Ein ersetzender Import ergänzt `removed` und `failedRemovals`.

Die Wiederherstellung ist keine gemeinsame Transaktion über die Profil-, Sitzungs-, Asset- und Verlaufsspeicher hinweg. Nach einer teilweisen oder nicht unterstützten Wiederherstellung setzt die Cloud-Synchronisierung ihre angewendete Revision **nicht** weiter, sodass die Kopie für einen erneuten Versuch verfügbar bleibt.

<!--i:eti-unlink-->
## Was nicht mit übertragen wird

- **Katalog-Caches** (heruntergeladene Asset-Metadaten und Blobs, der Tool-Index), die das Ziel erneut synchronisiert.
- **Katalog-Tools und Katalog-Assets**, die auf dem Ziel als vorhanden vorausgesetzt werden. Marken-Tokens, Schriften und Logos, die der Nutzer hinzugefügt hat, sind Nutzer-Assets und werden mit übertragen.
- **`blob:`- und Objekt-URLs**, die die Bridge beim Laden neu erzeugt.
- **Konvertierungsoriginale, aktive Ausführungs-Leases und gerätelokale Zugangs- oder Signaturgeheimnisse.** Sie gehören nicht zum übertragbaren Verlauf. Ein gespeichertes Ergebnis ist eine Kopie. Es bedeutet nicht, dass die ursprüngliche Quelle gesichert wurde.
- **Der Export-Sequenzzähler**, der tägliche Zähler für Download-Dateinamen in `localStorage` (`lolly-export-seq`). Er ist nicht in `PREF_KEYS` enthalten und wird daher nie in einem Paket übertragen.

Die Speicheranzeige zeigt dieselbe Aufteilung. Saved sessions, My images und File results & versions kommen in ein Paket. Der Asset-Cache, Tool-Vorschauen und offline angeheftete Inhalte lassen sich neu aufbauen und bleiben zurück.

![Die Speicheranzeige teilt die Daten dieses Geräts in benannte Kategorien auf und erfasst Saved sessions und My images getrennt vom Asset cache, hier bei einer neuen Installation, in der alle Kategorien noch leer sind](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Organisationsdaten mit Lolly Work

Dieses Paket sichert die persönliche Bibliothek des Geräts. Ein Paket ist keine Sicherung einer **Lolly Work**-Instanz. Organisationskonten, Zugriffsrichtlinien, gemeinsame Projekte, Katalogversionen, Freigaben, Render-Aufträge und Audit-Einträge liegen bei diesem Dienst. Verbinden Sie sich erneut und melden Sie sich an, um wieder auf gemeinsame Arbeit zuzugreifen. Der Import eines persönlichen Pakets gewährt diesen Zugriff nicht.

Betreiber sichern, bewahren und löschen Serverdaten nach den eigenen Anleitungen von Lolly Work: [Sicherung und Wiederherstellung](/info/work-operations.html#backup-and-restore) und [Lolly Work: Speicher und Datenlebenszyklus](/info/work-data-lifecycle.html). Das Leeren oder Exportieren eines Geräts führt keine dieser Serveroperationen aus.

<!--i:eti-monitor-->
## Über Shells hinweg

`data-transfer.ts` liest und schreibt ausschließlich über die Capability-Bridge (`host.profile`, `host.state`, `host.assets`) und die gemeinsamen Einstellungen in `localStorage`. Dasselbe Modul liest und schreibt das gemeinsame Hüllformat im Web sowie in den Desktop- und Mobil-Apps, über IndexedDB oder Dateisystemspeicher. Optionale Verlaufsteile erscheinen nur, wo ihr Adapter verfügbar ist. Der Import meldet einen nicht unterstützten Teil als übersprungen. Die Headless-Testsuite prüft die gemeinsamen Teile mit einer Bridge im Arbeitsspeicher, und für Verlaufstransaktionen gibt es auch Tests in echten Browsern.

Zwei Shells fallen nicht unter diese Garantie:

- Die **CLI für einzelne Aufrufe** hat nichts zu übertragen: Ihr Zustand liegt im Arbeitsspeicher und besteht für einen Aufruf.
- Die **TUI** hält ihren Zustand in `~/.lolly` (Sitzungen, Ordner, Profil). Ihre Ansicht Profile schreibt ein eigenes, einfacheres Sicherungsarchiv: `saved-state/<slot>.json` pro Sitzung sowie `profile.json` und `folders.json`, ohne Manifest, ohne `formatVersion` oder `minReader` und ohne Integritätsverzeichnis. Ein Leser dieses Formats weist das Archiv als "keine Lolly-Sicherung" zurück, obwohl die Namen ähnlich sind (`lolly-backup-<stamp>.zip`). Die Vereinheitlichung beider Formate ist eine bekannte Lücke.

<!--i:eti-clock-->
## Noch nicht übertragbar

Neue Arten übertragbarer Daten können später als zusätzliche Teile hinzukommen (eine neue `formatVersion`, derselbe `minReader`). Designsysteme werden bereits so übertragen, als `design-systems.json` zusammen mit ihren Nutzer-Assets.

Zwei Namen sind für Daten reserviert, die noch nicht übertragen werden:

- **`tokens.json`** würde ein Design-Token-Dokument nach [W3C DTCG](https://tr.designtokens.org/format/) mit seinen Gruppen, Sets und Themes enthalten, dem Format, das [Penpot importiert und exportiert](https://help.penpot.app/user-guide/design-systems/design-tokens/). Die eigenen Marken-Tokens eines Nutzers werden bereits als Asset `user/tokens/brand` in `assets.json` übertragen, und die Tokens eines Designsystems werden mit dessen Datensatz übertragen.
- **`penpot/`** ist für eine eingelesene Penpot-Datei oder deren für Lolly relevanten Teil reserviert, der als Tool bereitgestellt wird.

<!--i:eti-history-->
## Verlaufsteile

Die beiden Verlaufsteile sind optional und haben eigene Versionen.

::: details Versionsverlauf von Werken (v3)
Manuelle Sicherungen einer Webinstallation mit Versionsverlauf enthalten `revision-history.json` mit dem eigenen Schema `{ version: 1, documents, revisions, recoveries }`. Die Datei enthält die aufbewahrten IDs, kanonische Eingabe-Snapshots, Versionsstempel, Rastervorschauen und separate Entwürfe der schreibenden Instanzen. Der Verlaufsadapter erfasst aktuelle Sitzungen und deren aktuelle Stände in einer Lesetransaktion, und `sessions.json` verwendet dieselben aktuellen Snapshots für ältere Leser.

Die Wiederherstellung prüft SHA-256 und Byteanzahl der Nutzdaten, eindeutige Identitäten, Beziehungen zwischen Dokumenten und aktuellen Ständen, Abstammung, Zeitstempel, Vorschautypen und Grenzen, bevor sie das Archiv in einer Transaktion übernimmt. Verweise auf bei der Kompaktierung entfernte Vorgänger dürfen fehlen. Bestehende aktuelle Arbeit wird nie stillschweigend ersetzt: Wenn ein Werk auf beiden Seiten vorhanden ist, wird die Seite, die nicht aktuell bleibt, zu einem geschützten Entwurf.

Für das Archiv gilt ein Übertragungslimit von 384 MiB. Speichergrenzen werden eingehalten, ohne aufbewahrte Checkpoints zu kürzen. Der Export schreibt `revision-history.json` und `sessions.json` in Blöcken, mit denselben Bytes wie ein einzelner Aufruf von `JSON.stringify`, sodass der Dateitext nie vollständig im Speicher liegt. Eine Verlaufsdatei, die das Limit überschreiten würde, wird genau dann verworfen und von da an nur noch gezählt. Das Archiv wird anschließend ohne seine ältesten automatischen Checkpoints erneut erstellt, und die Exportübersicht zählt diese als `checkpointsLeftOut`, oder das Archiv wird abgelehnt.

Eine Shell ohne diese Fähigkeit stellt gewöhnliche Sitzungen wieder her und meldet den Verlaufsteil als übersprungen. Nativer Dateisystemverlauf wird erst unterstützt, wenn sein Adapter dauerhafte Verlaufstransaktionen bereitstellt. Gäste in einer privaten Zusammenarbeit haben weder einen dauerhaften Verlauf noch ein Wiederherstellungsarchiv.

Die persönliche Snapshot-Synchronisierung lässt den Versionsverlauf aus. Wird ein Snapshot auf ein lokales Dokument mit Verlauf angewendet, bleibt dessen vorheriger Arbeitsstand als separater Wiederherstellungsentwurf erhalten, und das Schreib-Token jedes geöffneten Editors wird ungültig. Seine unveränderlichen Checkpoints bleiben auf dem Gerät. Das schützt den lokalen Verlauf beim Ersetzen durch einen Snapshot. Parallele Verläufe verschiedener Geräte werden dadurch nicht zusammengeführt.

Historische Asset-Verweise bleiben erhalten, während das Rendering Assets weiterhin über die vorhandene Bibliothek des Ziels auflöst. Dieses Archiv garantiert noch nicht die exakten alten Asset-Bytes oder alte Tool-Renderings. Die Bytes von Asset-Versionen und Dateiergebnissen werden in einem eigenen Sicherungsteil übertragen.
:::

::: details Gespeicherte Versionen und Dateiergebnisse (v2)
Der optionale Verlaufsteil enthält `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, und Leser akzeptieren auch die frühere history-v1-Struktur ohne Batches. Jeder Snapshot enthält die stabile Asset-ID und die genaue Version, seinen Speicherzeitpunkt, die Bytelänge und den hexadezimalen SHA-256-Wert sowie einen Asset-Datensatz, dessen `_file` und optionales `_credentialFile` auf binäre Teile verweisen. Operationen enthalten die Angaben zur Originaldatei, Anfrage, Bericht, Zeitstempel und optional eine Ergebnisdatei `_file`. Namen der Speicher-Backends, OPFS-Handles und Ausführungs-Leases werden nicht übertragen. Leser, die nur history v1 kennen, lehnen die neue Verlaufsversion vor dem Import ab, sodass die Batch-Zugehörigkeit nie stillschweigend verloren geht.

Batch-Manifeste erfassen jede ausgewählte Quelle vor der Verarbeitung, auch nie gelesene Dateien, abgebrochene Einträge, fehlgeschlagene Reservierungen von Ergebnisspeicher und unterbrochene Arbeit. Jeder Eintrag hat eine stabile Operations-ID, einen Quellenverweis mit Angaben zur Quelle, den angeforderten Ausgabenamen und einen Abschlussbericht. Für eine ungelesene Quelle gibt es deklarierte Angaben, keinen erfundenen Hashwert. Der Import prüft die Identität des Eintrags und die Konsistenz mit einem gegebenenfalls enthaltenen Operationsbericht. Berichte von Lolly Batch bleiben verfügbar, wenn einzelne Ergebnisse entfernt wurden, aber ein Beleg bedeutet nicht, dass die Ausgabebytes noch gespeichert sind.

- **Zuerst validieren.** Jeder bekannte Verlaufsdatensatz, Bericht und jede referenzierte Datei wird validiert, bevor beim Import Profil- oder Asset-Daten geschrieben werden. Fehlende Bytes und abweichende SHA-256-Werte führen auch dann zum Fehler, wenn das Hüllformat kein Integritätsverzeichnis enthält. Extrahierte Credentials bleiben Byte-Arrays, auch beim Import von älteren Schreibern, die sie als Objekte mit numerischen Schlüsseln serialisiert haben.
- **Laufende Arbeit.** Laufende Operationen werden in der Sicherung zu unterbrochenen Datensätzen mit einem Fehlerbericht und ohne Ergebnis. Eine Wiederherstellung startet nie Hintergrundarbeit neu und importiert nie eine aktive Lease. Für einen erneuten Versuch muss die Originaldatei erneut ausgewählt werden; sie wird anhand ihres aufgezeichneten SHA-256-Werts geprüft, sofern dieser verfügbar ist.
- **Speicher.** Bei wiederhergestellten Ergebnissen werden Bytes und Metadaten gemeinsam in IndexedDB übernommen. Gewöhnliche neue Ergebnisse verwenden OPFS, sofern verfügbar, und andernfalls IndexedDB. Eine bestehende aktive Operation wird nie durch einen Import ersetzt.
- **Sicherungsgrenzen.** Der Export streamt diese Bytes in das Archiv, aber die Wiederherstellung entpackt weiterhin eine ganze Sicherung im Arbeitsspeicher. Daher gelten weiterhin die Grenzen: **256 MiB Verlaufsnutzdaten**, **4 MiB Verlaufsmetadaten**, höchstens **100 Operationen**, **100 Batches** und **2.000 Snapshots**. Der Export lehnt zu große oder unvollständige Verläufe ausdrücklich ab und lässt sie nie stillschweigend aus. Laden Sie wichtige Versionen und Ergebnisse einzeln herunter, bevor Sie ältere lokale Kopien entfernen. Diese Grenzen garantieren keinen gemessenen maximalen Speicherbedarf auf Smartphones.
- **Lokale Budgets.** Der lokale Ergebnisverlauf hat ein Budget von 512 MiB und eine Obergrenze von 100 Datensätzen. Asset-Snapshots haben ein separates Budget von 512 MiB und höchstens 20 historische Versionen pro Asset; extrahierte Credential-Bytes zählen zu diesem Budget. Die Wiederherstellung hält diese Grenzen ein und verdrängt nie stillschweigend bestehende Nutzerdaten.
- **Batch-Metadaten.** Lokale Batch-Metadaten haben ein separates Budget von 4 MiB, höchstens 100 Manifeste und 20 Einträge pro Batch. Ausstehende Einträge reservieren Metadatenkapazität, mit einer Berichtsgrenze von 32 KiB pro Eintrag. Dies ist ein logisches Budget, keine Garantie für den verfügbaren Browserspeicher: Ein tatsächlicher Quotenfehler wird angezeigt, und der Bericht im Arbeitsspeicher bleibt herunterladbar. Ein erneuter Versuch für einen Batch-Eintrag erstellt einen neuen Batch, ohne den alten Bericht zu überschreiben. Das Entfernen eines Batch-Datensatzes entfernt weder einzelne Ergebnisbytes noch Bibliotheks-Assets.
- **Ergebnisse in der Bibliothek.** Konvertierte Ergebnisse können ohne Normalisierung oder erneute Kodierung zur Bibliothek hinzugefügt werden, mit den Hashwerten von Quelle und Ausgabe sowie der Beziehung zur Operation. Beim wiederholten Hinzufügen wird eine unveränderte Kopie wiederverwendet, und eine bearbeitete Kopie wird nie überschrieben. Rasterbilder können ein neues Lolly Design-Dokument starten, das die aktuelle Asset-ID der Bibliothek verwendet. Die durchgängige Bindung an exakte Versionen in der Laufzeit und im URL-Pfad von Lolly Design ist eine separate Aufgabe. SVG-, HTML-, PDF- und ZIP-Ergebnisse bleiben undurchsichtige Datei-Assets und werden nicht zu vertrauenswürdigen interaktiven oder Vektorinhalten aufgewertet.
- **Wo dies zu sehen ist.** **Convert → Recent file operations** zeigt die Verlaufsnutzung, Berichte, Downloads und den Versionsmanager, der auch frühere Versionen gelöschter Bibliotheks-Assets findet. Die Wiederherstellung eines Snapshots erstellt eine neue aktuelle Version und behält den ausgewählten Snapshot. **Settings → Preferences → Storage** zählt Ergebnisse und Versionen getrennt von entbehrlichen Caches.
- **Bereinigung.** Eine ausdrückliche Bereinigung temporärer Dateien entfernt nur nicht referenzierte Bytes, die Operationen gehören. Aktuelle Datensätze schützen ihre Dateien, und für neue OPFS-Dateien gilt eine Schonfrist von einer Stunde. Gespeicherte Ergebnisse und Asset-Snapshots werden nicht automatisch gelöscht.

Ältere Leser akzeptieren weiterhin das v2-Hüllformat (`minReader: 1`) und stellen die ihnen bekannten Teile wieder her; nicht unterstützte Verlaufsteile zählen sie als übersprungen. Für eine vollständige Verlaufswiederherstellung ist eine Shell mit dem Adapter `fileHistory` nötig, einer internen Schnittstelle der Shell, keiner für Tools verfügbaren `HostV1`-Fähigkeit. Die echte Wiederherstellung zwischen zwei Geräten wird durch die lokale Chromium-Abnahmeprüfung abgedeckt. Die Wiederherstellung in installierten Desktop-, iOS- und Android-Apps muss noch separat abgenommen werden.
:::

<!--i:eti-code-->
## Referenz

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; die Namensfunktion `backupFilename()` ist intern).
- Vertragstest: `tests/data-transfer.test.ts`, deckt Hin- und Rückübertragung, Zusammenführung, Integrität, Vorwärtskompatibilität und die Leserprüfung ab.
- Vertragstests für den Verlauf: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` und `tests/file-result-library.test.ts`. Browser-Abnahme: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` und `tests/file-result-reuse.browser.test.ts`.
- Verwendete Bridge-Schnittstellen: `host.profile`, `host.state` und `host.assets`; siehe [Host-API](/info/host-api.html).
