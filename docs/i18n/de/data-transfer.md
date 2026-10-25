# Datenübertragung: das `lolly-backup`-Bundle

Lolly hält Ihre persönliche Bibliothek auf dem Gerät. Ein Backup-Bundle ist, wie diese Bibliothek wandert: Exportieren Sie sie auf einer Installation, tragen Sie die Datei auf beliebigem Weg weiter (USB, AirDrop, E-Mail an sich selbst oder ein Netzwerklaufwerk) und importieren Sie sie auf einer anderen. Exportieren und Importieren brauchen keinen Server, und das Ziel kann offline sein.

Diese Seite ist die Formatspezifikation für Menschen, die Shells, Tools oder Skripte rund um Backups bauen: was im Zip liegt, wie Versionen geprüft werden, wie ein Import zusammenführt und was geprüft wird. Die Anleitung für Menschen, die ihre eigene Arbeit umziehen, ist [Ihre Arbeit auf ein anderes Gerät bringen](/info/find-your-work.html#move-your-work-to-another-device).

![Die beiden Schaltflächen, die eine ganze Installation bewegen: Export my data schreibt ein Zip, Import data liest es wieder ein](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Geltungsbereich.** Ein Bundle trägt *Nutzerdaten*, keine Katalog-Tools. Katalog-Tools und Katalog-Assets werden getrennt synchronisiert und sind auf dem Ziel als bereits vorhanden vorausgesetzt, schlimmstenfalls in einer höheren Version. Tools, die ein Nutzer selbst erstellt hat, reisen in `profile.json`. Der Import installiert oder aktualisiert nie ein Katalog-Tool.

## Ziele

- <!--i:box--> **Ein Format, jede Shell.** Die Web-App, die Desktop- und Mobil-Apps und künftige Shells teilen denselben Umschlag und dieselben Teilschemas. Optionale Teile hängen von den Fähigkeiten jeder Shell ab, und nicht unterstützte Teile werden gemeldet. Jede Capability-Bridge liefert ihren Speicher-Adapter.
- <!--i:shieldcheck--> **Übersteht die Reise.** Ein beim Transport verstümmeltes oder abgeschnittenes Bundle schlägt beim Import laut fehl und stellt nie halb wieder her.
- <!--i:clock--> **Überlebt diese Version.** Eine ältere App kann die Teile eines neueren Bundles, die sie erkennt, weiterhin importieren. Ein wirklich inkompatibles Format wird sauber abgelehnt.
- <!--i:check--> **Sicher zusammenzuführen.** Der Import auf eine Installation, die schon benutzt wird, löscht nie etwas, was nicht im Bundle war.

## Der Umschlag

Ein Bundle ist ein einfaches `.zip`, überlebt also jeden Transport unversehrt, und jedes Entpackprogramm kann den Inhalt prüfen.

Der Download ist nach der Person benannt, der er gehört: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, zum Beispiel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, sodass ein Downloads-Ordner voller Backups lesbar bleibt. Vor- und Nachname stammen aus dem Profil und entfallen, wenn sie nicht gesetzt sind: Ohne Profil ergibt sich `LollyTools-2026-06-26-1.zip` und mit nur einem Vornamen `LollyTools-Ada-2026-06-26-1.zip`. Jeder Name wird auf ein dateinamentaugliches Token reduziert (Unicode-Buchstaben und -Ziffern bleiben, Leerzeichen und Satzzeichen entfallen, höchstens 32 Zeichen). `<n>` ist eine Folge pro Tag und Gerät, sodass wiederholte Exporte am selben Tag nicht kollidieren und in Reihenfolge bleiben. `backupFilename()` in `data-transfer.ts` baut den Namen, und der Inhalt des Zips ist unabhängig von seinem Namen derselbe.

| Pfad | Erforderlich | Inhalt |
|---|---|---|
| `manifest.json` | ja | Format-ID, Versionen, Zählwerte und Integrität je Teil. Das Erste, was ein Leser betrachtet. |
| `profile.json` | wenn gesetzt | Der ganze `me`-Datensatz der Nutzerin oder des Nutzers: Name, Kontakt, Porträtfoto-Verweis und Flags, dazu Ordner, Papierkorb, Projektvorlagen, Nutzervorlagen und selbst erstellte Tools, Favoriten, ausgeblendete Tools, Sprache und Emoji-Wahl. Gelesen über `host.profile`. |
| `sessions.json` | ja | Jede gespeicherte Sitzung: Slot, Tool-ID und -Version, Bezeichnung, Vorschaubild (Data-URL) und vollständige Eingabedaten. Gelesen über `host.state`. |
| `assets.json` | ja | Metadaten für jedes hochgeladene Asset (Bilder, Schriften, Markentokens, Logos, gespeicherte Kopien von Downloads), jeweils mit Verweis auf seine Bytes unter `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | je Asset | Die rohen Asset-Bytes, unkomprimiert gespeichert, weil die meisten schon komprimierte Formate sind. Die Endung ist kosmetisch; der MIME-Typ in `assets.json` ist maßgeblich. |
| `assets/blobs/<n>.c2pa` | wenn vorhanden | Extrahierte Content Credentials als exakte Binär-Bytes, referenziert von `_credentialFile` im Asset-Eintrag. Das sind keine Signaturschlüssel des Geräts. |
| `design-systems.json` | wenn vorhanden | Die auf dieser Installation erstellten oder hinzugefügten Designsysteme als `{ active, records }`. Siehe [Importregeln](#import-rules). |
| `file-history.json` | optional | Versionierte Asset-Schnappschüsse, abgeschlossene Berichte zu Dateivorgängen und vollständige Batch-Manifeste, mit einer eigenen Version. Geliefert vom internen Backup-Adapter `fileHistory` der Shell. |
| `revision-history.json` | optional, manuelle Backups | Stabile Erstellungs-IDs, behaltene Checkpoints, Vorschaubilder und fortlaufende Wiederherstellungsentwürfe. Geliefert von `host.state.history.backup`, wo unterstützt. |
| `file-history/versions/` | je Schnappschuss | Frühere Asset-Bytes und extrahierte Credentials, egal ob das aktuelle Asset noch existiert. |
| `file-history/results/` | je abgeschlossenem Vorgang | Exakte Ausgabe-Bytes. Keine zur Umwandlung gewählte Originaldatei wird behalten oder aufgenommen. |
| `prefs.json` | ja | Lokale Einstellungen des Nutzers: `theme`, `sidebarWidth` und die Aktivitätsübersicht `ct-metrics`. |
| `lolly.txt` | ja | Eine lesbare Zusammenfassung des Bundles (Zählwerte, Profil, Dateiname) für alle, die das Zip ohne Lolly öffnen. Bei jedem Export neu erzeugt und beim Import erkannt, zählt also nie als übersprungener Teil. Sie wird nach der Integritätszuordnung geschrieben, sodass die Zuordnung diese Datei nicht abdeckt. |

::: details Wie der Export das Zip schreibt
Der Export schreibt das Zip Teil für Teil (`shells/web/src/lib/zip-stream.ts`). Uploads, gespeicherte Ergebnisse und gespeicherte Asset-Versionen werden in 4-MiB-Stücken gelesen, nie ganz, und gespeicherte Ergebnisse und Versionen werden zuerst gegen ihr aufgezeichnetes SHA-256 geprüft. Danach wird jede Datei für ihre Prüfsumme und ihren Integritäts-Digest gelesen, und das Zip verweist dort auf sie, wo sie liegt.

Nichts wird neu kodiert, sodass eine Datei mit Content Credentials die exakten Bytes behält, die ihre Signatur abdeckt, und jeder Teil seine exakten Bytes und seinen Digest behält. Für dieselben Teile und dieselbe Zeit ist das Zip identisch mit dem des früheren Writers im Arbeitsspeicher, außer dass eine Verlaufsdatei über 16 MiB in Stücken komprimiert wird. `tests/backup-streaming.test.ts` prüft das gegen aufgezeichnete Referenz-Digests.

Bei einer synthetischen Bibliothek von 192 MiB, in Node gemessen, brauchte der Abschluss des Backups etwa 125 bis 150 MiB zusätzlich zur Bibliothek, gegenüber etwa 850 MiB beim Writer im Arbeitsspeicher (`node scripts/bench-backup-finalise.ts`). Der Import liest weiterhin das ganze Zip in den Arbeitsspeicher.
:::

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
| `format` | Immer `lolly-backup`. Eine Datei ohne es wird als "not a Lolly backup" abgelehnt. |
| `formatVersion` | Das Layout, mit dem dieses Bundle **geschrieben** wurde. Wird bei jeder Änderung am Satz oder an der Form der Teile erhöht. Leser prüfen dieses Feld **nicht**. |
| `minReader` | Die Mindestversion des Lesers, die dieses Bundle **sicher** importieren kann. Dieses Feld prüfen Leser. |
| `app` | ID der erzeugenden App, zur Diagnose. |
| `exportedAt` | ISO-Zeitstempel der Erstellung des Bundles. |
| `counts` | Was der Writer hineingegeben hat, zur Anzeige und für Plausibilitätsprüfungen. |
| `integrity` | Optional. Ordnet jedem Teil außer `manifest.json` einen Digest im SRI-Stil `sha256-<base64>` seiner **unkomprimierten** Bytes zu. |

## Versionsrichtlinie

Zwei Versionsnummern lassen das Format wachsen, ohne ältere Installationen abzuhängen.

![Eine Änderung am Bundle-Format ist entweder additiv, was alte Leser ignorieren können, oder inkompatibel, wo ein falscher Import Daten beschädigt. Additiv erhöht formatVersion und behält minReader; inkompatibel erhöht formatVersion und hebt minReader an. Ein Leser importiert, wenn minReader höchstens seiner eigenen Version entspricht.](/info/diagrams/concepts/backup-version-gate.svg)

- Ein Leser importiert ein Bundle, wenn `manifest.minReader` höchstens seiner eigenen Leserversion entspricht. Er lehnt mit "needs a newer version of the app" nur ab, wenn das Bundle einen neueren Leser verlangt.
- Eine **additive** Änderung, etwa ein neuer optionaler Teil oder ein neues optionales Manifestfeld, erhöht `formatVersion` und lässt `minReader` unberührt. Ältere Apps importieren weiterhin jeden Teil, den sie erkennen, und Teile, die sie nicht erkennen, werden als übersprungen gemeldet, nicht stillschweigend verworfen.
- Eine **inkompatible** Änderung, bei der ein falscher Import eines Teils Daten beschädigt oder ein optionaler Teil verpflichtend wird, hebt `minReader` an. Ältere Apps lehnen dann sauber ab, statt etwas zu importieren, was sie nicht handhaben können.
- Setzt ein künftiges Bundle `formatVersion`, lässt aber `minReader` weg, greifen Leser auf die Prüfung von `formatVersion` zurück und behandeln die Änderung als inkompatibel.

> **Faustregel für Autoren:** Wenn jeder bestehende Leser auch dann das Richtige täte, wenn er Ihre Ergänzung ignoriert, ist die Änderung additiv: Erhöhen Sie `formatVersion` und lassen Sie `minReader`. Andernfalls heben Sie `minReader` an.

## Integrität

Ist `manifest.integrity` vorhanden, prüft ein Leser das SHA-256 jedes aufgelisteten Teils, **bevor irgendetwas geschrieben wird**. Eine Abweichung ("failed its integrity check") oder ein fehlender Teil ("incomplete") stoppt den ganzen Import, es gibt also keine teilweise Wiederherstellung. Das fängt den Schaden ab, den ein Dateitransport anrichten kann: ein abgeschnittenes AirDrop, ein E-Mail-Gateway, das den Anhang neu kodiert hat, ein defekter USB-Sektor.

Integrität ist Best Effort. Sie wird nur geschrieben, wo Web Crypto verfügbar ist (jeder sichere Browserkontext und modernes Node), und nur geprüft, wenn sowohl die Zuordnung als auch Web Crypto vorhanden sind. Ein Bundle ohne die Zuordnung, etwa eines aus der Zeit vor der Integrität, wird unverändert importiert: "cannot verify" zählt nie als "corrupt".

Das Manifest listet weder sich selbst noch die neu erzeugte `lolly.txt` auf. Die Digests decken die Teile ab, für die das Manifest bürgt.

## Importregeln

Ein Import läuft in einem von zwei Modi.

- **Merge** ist, was **Import data…** tut und was der erste Beitritt von Sync, **Bring it to this device**, tut. Daten auf dem Ziel bleiben, und nichts, was nicht im Bundle war, wird berührt: Eine Sitzung, die das Ziel hatte und das Bundle nicht, übersteht den Import.
- **Replace** nutzt der Geräte-Sync, um Geräte im Gleichschritt zu halten: Er übernimmt den Profildatensatz, die Einstellungen, Sitzungen, Bilder und die Wahl des aktiven Designsystems der synchronisierten Kopie und entfernt nur Elemente, die ein anderes Gerät seit dem letzten Sync gelöscht hat. Das Wiederherstellen einer früheren Kopie geht weiter und macht das Gerät dieser Kopie gleich, wobei alles entfernt wird, was die Kopie nicht enthält, nachdem zuvor das Gerät gesichert wurde. [Ihre Geräte synchronisieren](/info/sync.html) behandelt, was eine Person sieht.

Bei einem Merge bleibt alles, was nur auf dem Ziel ist, und jede Art von Daten im Bundle trifft so auf das Ziel:

| Daten | Bereits auf dem Ziel | Nur im Bundle |
|---|---|---|
| Sitzungen (nach Slot) und hochgeladene Bilder (nach ID) | Die zuletzt gespeicherte Kopie bleibt, sodass ein älteres Backup nie neuere Arbeit überschreibt. Gleiche oder unbekannte Zeiten behalten die Kopie des Ziels. | Hinzugefügt |
| Ordner | Name und Elternordner des Ziels bleiben, und der Ordner erhält die Mitglieder des Bundles, die ihm fehlen. Eine Sitzung, die auf dem Ziel in einem Ordner abgelegt ist, bleibt dort abgelegt. | Hinzugefügt |
| Favoriten (Tools, Katalog-Assets und Projects-Elemente) | Kombiniert | Hinzugefügt |
| Vorlagen, Projects-Vorlagen und Nutzer-Tools (nach ID) | Der Datensatz des Ziels bleibt. | Hinzugefügt |
| Papierkorb-Einträge | Der Eintrag des Ziels bleibt. | Hinzugefügt, sodass ein Element, das auf einer der beiden Installationen wiederherstellbar war, es weiterhin ist. Ein Eintrag, dessen Ordner auf dem Ziel wieder in Gebrauch ist oder dessen Papierkorb-Slot das Ziel bereits nutzt, wird weggelassen. |
| Andere Profilfelder (Name, Kontaktdaten, Sprache, Feature-Flags, ausgeblendete Tools und andere Einstellungen) | Der Wert des Ziels bleibt. | Übernommen, wo das Feld des Ziels leer ist |
| Einstellungen (`prefs.json`) | Der Wert des Ziels bleibt. | Geschrieben, wo das Ziel keine hat |
| Designsysteme (nach ID) | Der Datensatz des Bundles ersetzt den des Ziels. | Hinzugefügt. Die aktive Wahl des Bundles gilt nur, wenn das Ziel kein eigenes Designsystem hat. |
| Erstellungsverlauf | Die zuletzt gespeicherte Kopie bleibt aktuell, und die andere wird als geschützter Entwurf behalten. | Hinzugefügt |

**Gespeicherte Sitzungen verknüpfen sich automatisch wieder mit ihren Bildern.** Asset-Verweise werden per ID behalten, und die Bridge löst sie nach der Wiederherstellung der Bilder neu auf, was sie ohnehin tun muss, weil `blob:`-URLs ein Neuladen nicht überleben.

**Verlaufseinträge ändern sich nach dem Schreiben nie.** Ein wiederholter Import von Asset-Versionen und Vorgangs-IDs fügt nichts hinzu, und eine ID, die bereits andere Bytes oder einen anderen Verlauf benennt, wird abgelehnt, nicht überschrieben. Der erneute Import eines identischen aktuellen Assets behält seine Version, und ein geändertes aktuelles Asset muss eine andere Version tragen.

**Der Erstellungsverlauf hat noch einige Regeln.** Eine Kreation, deren Slot das Ziel für eine andere Kreation nutzt, wird als eigene Kreation hinzugefügt, und eine Kreation im Papierkorb des Ziels bleibt dort. Eine Checkpoint-ID, die auf dem Ziel anderen Inhalt benennt, behält den des Ziels. Ein Archiv, das seine eigenen Prüfungen nicht besteht, stoppt den Import, bevor sich Profil, Sitzung, Asset oder Einstellung ändert, und ein identischer wiederholter Import fügt keinen Speicher hinzu.

**Die Zusammenfassung berichtet, was geschah.** Jeder Import liefert `profile`, `sessions`, `userAssets`, `prefs`, `skipped` und `failedAssets` zurück.

- `failedAssets` zählt hochgeladene Assets, die nicht wiederhergestellt werden konnten, zum Beispiel weil der Gerätespeicher voll ist.
- `skipped` zählt Teile eines neueren Writers, die dieser Build nicht erkannt hat. Die App zeigt es ("… · N newer items skipped"), sodass eine Wiederherstellung sagt, was sie zurückgelassen hat.
- Mit Dateiverlauf ergänzt die Zusammenfassung `assetVersions`, `fileOperations`, `fileBatches` und `failedHistory`. Erschöpfter Speicher oder ein Konflikt bei einer unveränderlichen ID kann eine teilweise Wiederherstellung verursachen, und die App sagt der Person dann, das Quell-Backup zu behalten.
- Mit Erstellungsverlauf ergänzt sie `revisions` und `recoveryDrafts`, die nur zählen, was dieser Import hinzugefügt hat, sowie `added`, `kept`, `replaced`, `copies` und `hidden` dazu, wie jede Kreation zusammengeführt wurde. `skippedCheckpoints` zählt Checkpoints, deren ID auf dem Ziel anderen Inhalt benennt, und `historyLeftOut` zählt ältere Checkpoints und Entwürfe, die nicht in den Verlaufsspeicher des Geräts passten.
- Ein Replace-Import ergänzt `removed` und `failedRemovals`.

Die Wiederherstellung ist keine einzelne Transaktion über die Speicher für Profil, Sitzung, Asset und Verlauf. Cloud-Sync setzt seine angewendete Revision nach einer teilweisen oder nicht unterstützten Wiederherstellung **nicht** fort, sodass die Kopie für einen neuen Versuch bereitbleibt.

## Was nicht mitreist

- **Katalog-Caches** (heruntergeladene Asset-Metadaten und -Blobs, der Tool-Index), die das Ziel kostenlos neu synchronisiert.
- **Katalog-Tools und Katalog-Assets**, die außerhalb des Geltungsbereichs liegen und auf dem Ziel als vorhanden vorausgesetzt werden. Markentokens, Schriften und Logos, die der Nutzer hinzugefügt hat, sind Nutzer-Assets und reisen daher mit.
- **`blob:`- und Objekt-URLs**, die die Bridge beim Laden neu erzeugt.
- **Umwandlungs-Originale, laufende Ausführungs-Leases und maschinenlokale Zugriffs- oder Signaturgeheimnisse.** Das ist kein portabler Verlauf. Ein gespeichertes Ergebnis ist eine Kopie, kein Versprechen, dass die ursprüngliche Quelle gesichert wurde.
- **Der Export-Sequenzzähler**, der Zähler pro Tag für die Download-Benennung in `localStorage` (`lolly-export-seq`). Er ist aus `PREF_KEYS` herausgehalten und reist daher nie in einem Bundle.

Die Speicheranzeige zeigt dieselbe Aufteilung. Saved sessions, My images und File results & versions gehen in ein Bundle. Der Asset-Cache, Tool-Vorschauen und Offline-Anheftungen darunter lassen sich alle neu aufbauen und bleiben daher zurück.

![Die Speicheranzeige teilt die Daten dieses Geräts in benannte Kategorien auf, wobei Saved sessions und My images getrennt vom Asset cache erfasst werden, hier bei einer frischen Installation, in der jede Kategorie noch leer ist](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Organisationsdaten mit Lolly Work

Dieses Bundle sichert die persönliche Bibliothek des Geräts. Es ist kein Backup einer **Lolly-Work**-Instanz: Organisationskonten, Zugriffsrichtlinien, gemeinsame Projekte, Katalogversionen, Freigaben, Render-Aufträge und Audit-Aufzeichnungen werden von diesem Dienst gehalten. Verbinden Sie sich erneut und melden Sie sich an, um wieder Zugriff auf gemeinsame Arbeit zu erhalten; der Import eines persönlichen Bundles gewährt diesen Zugriff nicht.

Betreiber sichern, bewahren und löschen Serverdaten mit den eigenen Leitfäden von Lolly Work: [Backup und Wiederherstellung](/info/work-operations.html#backup-and-restore) und [Work-Speicherung und Datenlebenszyklus](/info/work-data-lifecycle.html). Das Leeren oder Exportieren eines Geräts führt keinen dieser Servervorgänge aus.

## Über Shells hinweg

`data-transfer.ts` liest und schreibt nur über die Capability-Bridge (`host.profile`, `host.state`, `host.assets`) und die gemeinsamen `localStorage`-Einstellungen. Dasselbe Modul liest und schreibt den gemeinsamen Umschlag im Web sowie in den Desktop- und Mobil-Apps, über IndexedDB oder Dateisystemspeicher. Optionale Verlaufsteile erscheinen nur dort, wo ihr Adapter verfügbar ist, und ein nicht unterstützter Teil wird beim Import als übersprungen gemeldet. Die Headless-Suite prüft die gemeinsamen Teile gegen eine Bridge im Arbeitsspeicher, und Verlaufstransaktionen haben außerdem Tests in einem echten Browser.

Zwei Shells stehen aus unterschiedlichen Gründen außerhalb dieser Garantie:

- Die **Einmal-CLI** hat nichts zu tragen: Ihr Zustand liegt im Arbeitsspeicher und gilt für einen Aufruf.
- Die **TUI** hält ihren Zustand in `~/.lolly` (Sitzungen, Ordner, Profil), und ihre Ansicht Profile kann ihn sichern, schreibt aber ein einfacheres eigenes Archiv: `saved-state/<slot>.json` je Sitzung plus `profile.json` und `folders.json`, ohne Manifest, ohne `formatVersion` oder `minReader` und ohne Integritätszuordnung. Dieses Format kann es nicht importieren (ein Leser lehnt es als "not a Lolly backup" ab), und sein Name ist verwirrend ähnlich (`lolly-backup-<stamp>.zip`). Beides zu vereinheitlichen ist eine bekannte Lücke.

## Noch nicht portabel

Der Umschlag ist ein Manifest plus benannte Teile, sodass neue Arten portabler Daten später als additive Teile hinzukommen können (eine neue `formatVersion`, dasselbe `minReader`), und heutige Leser überspringen, was sie nicht erkennen. Designsysteme reisen schon so, als `design-systems.json` plus ihre Nutzer-Assets.

Zwei Namen sind für Daten reserviert, die noch nicht reisen:

- **`tokens.json`** würde ein ganzes [W3C-DTCG](https://tr.designtokens.org/format/)-Design-Tokens-Dokument mit seinen Gruppen, Sets und Themes tragen, das Format, das [Penpot importiert und exportiert](https://help.penpot.app/user-guide/design-systems/design-tokens/). Die eigenen Markentokens eines Nutzers reisen schon als Asset `user/tokens/brand` in `assets.json`, und die Tokens eines Designsystems reisen mit seinem Datensatz.
- **`penpot/`** ist für eine aufgenommene Penpot-Datei oder ihre für Lolly relevante Teilmenge reserviert, als Tool bereitgestellt.

Heutige Leser kennen beide Namen noch nicht. Wie alles andere außerhalb der Teile oben sind sie für sie ein unbekannter Teil: unberührt gelassen und in `skipped` gezählt.

## Verlaufsteile

Die beiden Verlaufsteile sind optional und haben eigene Versionen. Die meisten Leser können diesen Abschnitt überspringen.

::: details Erstellungsverlauf (v3)
Manuelle Backups einer Web-Installation mit Erstellungsverlauf enthalten `revision-history.json` mit eigenem Schema `{ version: 1, documents, revisions, recoveries }`. Sie trägt die behaltenen IDs, kanonische Eingabe-Schnappschüsse, Versionsstempel, Raster-Vorschauen und getrennte Writer-Entwürfe. Der Verlaufs-Adapter erfasst aktuelle Sitzungen und ihre Heads in einer Lese-Transaktion, und `sessions.json` nutzt für ältere Leser dieselben aktuellen Schnappschüsse.

Die Wiederherstellung prüft SHA-256 und Byte-Zählwerte der Nutzlast, eindeutige Identitäten, Beziehungen zwischen Dokument und Head, Abstammung, Zeitstempel, Vorschautypen und Grenzen, bevor das Archiv in einer Transaktion übernommen wird. Komprimierte Elternverweise dürfen fehlen. Bestehende aktuelle Arbeit wird nie stillschweigend ersetzt: Ist eine Kreation auf beiden Seiten, wird die Seite, die nicht aktuell bleibt, zu einem geschützten Entwurf.

Die Transfergrenze des Archivs von 384 MiB wird ausdrücklich geprüft, und Speichergrenzen werden durchgesetzt, ohne behaltene Checkpoints abzuschneiden. Der Export schreibt `revision-history.json` und `sessions.json` in Stücken, mit denselben Bytes, die ein einzelnes `JSON.stringify` liefert, sodass der Dateitext nie ganz gehalten wird. Eine Verlaufsdatei, die die Grenze überschreiten würde, wird in dem Moment verworfen, in dem sie es tut, und von da an nur gezählt. Das Archiv wird dann ohne seine ältesten automatischen Checkpoints neu erstellt, und die Export-Zusammenfassung zählt diese als `checkpointsLeftOut`, oder das Archiv wird ganz abgelehnt.

Eine Shell ohne diese Fähigkeit stellt gewöhnliche Sitzungen wieder her und meldet den Verlaufsteil als übersprungen. Der native Dateisystemverlauf bleibt nicht unterstützt, bis sein Adapter dauerhafte Verlaufstransaktionen liefert. Gäste in einer privaten Collab haben keinen dauerhaften Verlauf und kein Wiederherstellungsarchiv.

Der Sync persönlicher Schnappschüsse lässt den Erstellungsverlauf aus. Das Anwenden eines Schnappschusses auf ein lokales Dokument mit Verlauf behält seinen vorherigen Arbeitszustand als getrennten Wiederherstellungsentwurf und macht das Schreib-Token jedes geöffneten Editors ungültig. Seine unveränderlichen Checkpoints bleiben auf dem Gerät. Das schützt den lokalen Verlauf bei einem Austausch des Schnappschusses; es führt keine gleichzeitigen Geräteverläufe zusammen.

Historische Asset-Verweise bleiben erhalten, während das Rendern Assets weiterhin über die bestehende Bibliothek des Ziels auflöst. Dieses Archiv garantiert noch nicht die exakten alten Asset-Bytes oder alte Tool-Renderings. Die Bytes von Asset-Versionen und Dateiergebnissen reisen in ihrem eigenen Backup-Teil.
:::

::: details Gespeicherte Versionen und Dateiergebnisse (v2)
Der optionale Verlaufsteil enthält `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, und Leser akzeptieren auch die frühere Form history-v1 ohne Batches. Jeder Schnappschuss nennt die stabile Asset-ID und die exakte Version, seine Speicherzeit, Bytelänge und das Hex-SHA-256 sowie einen Asset-Datensatz, dessen `_file` und optionales `_credentialFile` auf Binärteile zeigen. Vorgänge tragen die Fakten der Originaldatei, Anfrage, Bericht, Zeitstempel und optional das Ergebnis `_file`. Namen von Speicher-Backends, OPFS-Handles und Ausführungs-Leases reisen nicht. Leser, die nur history v1 kennen, lehnen die neue Verlaufsversion vor dem Import ab, statt die Batch-Mitgliedschaft stillschweigend zu verwerfen.

Batch-Manifeste halten jede gewählte Quelle vor der Verarbeitung fest, einschließlich nie gelesener Dateien, abgebrochener Mitglieder, Fehlern beim Reservieren von Ergebnisspeicher und unterbrochener Arbeit. Jedes Mitglied hat eine stabile Vorgangs-ID, einen Quellverweis und Fakten, einen angeforderten Ausgabenamen und einen abschließenden Bericht. Eine ungelesene Quelle hat deklarierte Fakten, keinen erfundenen Digest. Der Import prüft die Identität der Mitglieder und die Konsistenz mit jedem mitgeführten Vorgangsbericht. Batch-Berichte bleiben verfügbar, wenn einzelne Ergebnisse entfernt wurden, aber ein Beleg bedeutet nicht, dass seine Ausgabe-Bytes noch gespeichert sind.

- **Zuerst die Validierung.** Jeder bekannte Verlaufseintrag, Bericht und jede referenzierte Datei wird validiert, bevor ein Import von Profil oder Asset schreibt. Fehlende Bytes und abweichendes SHA-256 schlagen fehl, auch wenn der Umschlag keine Integritätszuordnung hat. Extrahierte Credentials bleiben Byte-Arrays, auch bei Importen von älteren Writern, die sie als Objekte mit numerischen Schlüsseln serialisiert haben.
- **Laufende Arbeit.** Laufende Vorgänge werden im Backup zu unterbrochenen Einträgen, mit einem erklärenden Fehlerbericht und ohne Ergebnis. Die Wiederherstellung startet nie Hintergrundarbeit neu oder importiert einen aktiven Lease. Ein neuer Versuch heißt, die Originaldatei erneut zu wählen, gegen ihr aufgezeichnetes SHA-256 geprüft, sofern verfügbar.
- **Speicher.** Wiederhergestellte Ergebnisse übernehmen ihre Bytes und Metadaten gemeinsam in IndexedDB. Gewöhnliche neue Ergebnisse nutzen OPFS, wo verfügbar, mit einem IndexedDB-Fallback. Ein bestehender Live-Vorgang wird nie durch einen Import ersetzt.
- **Backup-Grenzen.** Der Export streamt diese Bytes in das Archiv, aber die Wiederherstellung entpackt weiterhin ein ganzes Backup im Arbeitsspeicher, sodass die Grenzen bleiben: **256 MiB Verlaufs-Nutzlast**, **4 MiB Verlaufs-Metadaten**, höchstens **100 Vorgänge**, **100 Batches** und **2.000 Schnappschüsse**. Der Export lehnt übergroßen oder unvollständigen Verlauf ausdrücklich ab und lässt ihn nie stillschweigend weg. Laden Sie wichtige Versionen und Ergebnisse einzeln herunter, bevor Sie ältere lokale Kopien entfernen. Diese Grenzen sind keine gemessene Garantie des Spitzenspeicherbedarfs für Smartphones.
- **Lokale Budgets.** Der lokale Ergebnisverlauf hat ein Budget von 512 MiB und eine Obergrenze von 100 Einträgen. Asset-Schnappschüsse haben ein eigenes Budget von 512 MiB und höchstens 20 historische Versionen je Asset, und extrahierte Credential-Bytes zählen zu diesem Budget. Die Wiederherstellung beachtet diese Grenzen und verdrängt nie stillschweigend vorhandene Nutzerdaten.
- **Batch-Metadaten.** Lokale Batch-Metadaten haben ein eigenes Budget von 4 MiB, höchstens 100 Manifeste und 20 Mitglieder je Batch. Ausstehende Mitglieder reservieren Metadaten-Kapazität, mit einer Obergrenze von 32 KiB Bericht je Mitglied. Das ist ein logisches Budget, keine Garantie für den Festplattenplatz des Browsers: Ein echter Kontingentfehler wird angezeigt, und der Bericht im Arbeitsspeicher bleibt herunterladbar. Der erneute Versuch eines Batch-Mitglieds erzeugt einen neuen Batch, ohne den alten Bericht zu überschreiben. Das Entfernen eines Batch-Eintrags entfernt weder einzelne Ergebnis-Bytes noch Bibliotheks-Assets.
- **Ergebnisse in der Bibliothek.** Umgewandelte Ergebnisse können ohne Normalisierung oder Neukodierung der Bibliothek hinzugefügt werden, mit angehängten Hashes von Quelle und Ausgabe und der Vorgangsbeziehung. Wiederholtes Hinzufügen nutzt eine unveränderte Kopie wieder, und eine bearbeitete Kopie wird nie überschrieben. Rasterbilder können ein neues Design-Dokument beginnen, das die aktuelle Bibliotheks-Asset-ID nutzt; das Durchsetzen exakter Versionsfestlegungen in der gesamten Laufzeit und dem URL-Pfad von Design ist eine getrennte Aufgabe. SVG-, HTML-, PDF- und ZIP-Ergebnisse werden als undurchsichtige Datei-Assets behalten und nicht zu vertrauenswürdigem interaktivem oder Vektor-Inhalt befördert.
- **Wo Menschen das sehen.** **Convert → Recent file operations** zeigt Verlaufsnutzung, Berichte, Downloads und den Versionsmanager, der auch frühere Versionen gelöschter Bibliotheks-Assets findet. Das Wiederherstellen eines Schnappschusses erzeugt eine neue aktuelle Version und behält den gewählten Schnappschuss. **Settings → Preferences → Storage** zählt Ergebnisse und Versionen getrennt von verzichtbaren Caches.
- **Bereinigung.** Eine ausdrückliche Bereinigung temporärer Dateien entfernt nur Bytes, die dem Vorgang gehören und nicht referenziert sind. Aktuelle Einträge schützen ihre Dateien, und neue OPFS-Dateien haben eine Schonfrist von einer Stunde. Gespeicherte Ergebnisse und Asset-Schnappschüsse werden nicht automatisch geleert.

Ältere Leser akzeptieren den v2-Umschlag weiterhin (`minReader: 1`) und stellen die Teile wieder her, die sie kennen, wobei nicht unterstützte Verlaufsteile als übersprungen gezählt werden. Die volle Verlaufswiederherstellung braucht eine Shell mit dem Adapter `fileHistory`, einer Nahtstelle innerhalb der Shell statt einer neuen, für Tools sichtbaren `HostV1`-Capability. Die echte Wiederherstellung auf zwei Geräten deckt das lokale Chromium-Gate ab; die Wiederherstellung auf installierten Desktop-, iOS- und Android-Apps muss noch getrennt abgenommen werden.
:::

## Referenz

- Modul: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; der Benenner `backupFilename()` ist intern).
- Vertragstest: `tests/data-transfer.test.ts`, der Round-Trip, Merge, Integrität, Vorwärtskompatibilität und das Lesertor abdeckt.
- Verlauf-Vertragstests: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` und `tests/file-result-library.test.ts`. Browser-Abnahme: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` und `tests/file-result-reuse.browser.test.ts`.
- Genutzte Bridge-Oberfläche: `host.profile`, `host.state` und `host.assets`; siehe [Host-API](/info/host-api.html).
