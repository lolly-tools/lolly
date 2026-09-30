# Datenübertragung - das `lolly-backup`-Bündel

Alles, was sich bei einem Lolly-Nutzer ansammelt, lebt **auf seinem Gerät** - kein Konto, keine Cloud. Das Datenübertragungsbündel ist der Weg, wie dieser Wert sich bewegt: exportieren Sie es auf einer Installation, tragen Sie die Datei auf beliebigem Weg (USB, AirDrop, E-Mail an sich selbst, eine Netzwerkfreigabe) und importieren Sie sie auf einer anderen. Die Datei *ist* der Transport. Das Ziel kann offline oder online sein. Es macht keinen Unterschied, denn nichts spricht je mit einem Server.

![Die beiden Schaltflächen, die eine ganze Installation umziehen: Meine Daten exportieren schreibt ein Zip, Daten importieren liest es wieder ein](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

Diese Seite ist die Formatspezifikation. Die Anleitung für Endnutzer finden Sie unter [Ihre Arbeit finden und wiederherstellen → Arbeit auf ein anderes Gerät übertragen](/info/find-your-work.html#move-your-work-to-another-device). Die Implementierung ist [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), und [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) legt den Round-Trip-Vertrag fest.

> **Umfang.** Ein Bundle enthält *Nutzerdaten*, keine Katalog-Tools. Katalog-Tools und Katalog-Assets werden separat synchronisiert und gelten als bereits auf dem Zielgerät vorhanden (im schlimmsten Fall in einer höheren Version); Tools, die ein Nutzer selbst erstellt hat, reisen innerhalb von `profile.json` mit. Ein Import installiert oder aktualisiert niemals ein Katalog-Tool.

## Ziele

- <!--i:box--> **Ein Format, jede Shell.** Die Web-PWA, die Tauri-Desktop-/Mobile-Apps und künftige Shells teilen sich denselben Umschlag und dieselben unterstützten Teil-Schemas. Optionale Teile hängen von den Fähigkeiten der jeweiligen Shell ab; nicht unterstützte Teile werden gemeldet. Jede Capability-Bridge liefert ihren eigenen Speicher-Adapter.
- <!--i:shieldcheck--> **Übersteht den Transport.** Ein beim Transport beschädigtes oder abgeschnittenes Bundle scheitert beim Import laut und deutlich, es stellt niemals nur halb wieder her.
- <!--i:clock--> **Überlebt diese Version.** Eine ältere App kann die erkannten Teile eines neueren Bundles trotzdem importieren. Ein wirklich inkompatibles Format wird sauber abgelehnt.
- <!--i:check--> **Sicher zu mergen.** Ein Import auf eine bereits genutzte Installation löscht nie etwas, das nicht im Bundle enthalten war.

## Der Umschlag

Ein Bundle ist eine einfache `.zip`-Datei. Der Download wird nach der Person benannt, der er gehört - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (zum Beispiel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - sodass ein Downloads-Ordner voller Backups lesbar bleibt. Der Vor- und der Nachname stammen aus dem Profil und entfallen, wenn sie nicht gesetzt sind. Ohne Profil ergibt sich `LollyTools-2026-06-26-1.zip`, und ein Vorname allein ergibt `LollyTools-Ada-2026-06-26-1.zip`. Jeder Teil wird zu einem für Dateinamen sicheren Token bereinigt (Unicode-Buchstaben/-Ziffern bleiben erhalten, Leerzeichen/Satzzeichen werden entfernt, auf 32 Zeichen begrenzt). `<n>` ist eine Sequenz pro Tag und Gerät, damit wiederholte Exporte am selben Tag nicht kollidieren und in Reihenfolge bleiben. `backupFilename()` in [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) erzeugt den Namen. Der Inhalt der Zip-Datei ist unabhängig vom Namen identisch. Darin:

| Pfad | Erforderlich | Inhalt |
|---|---|---|
| `manifest.json` | ja | Format-ID, Versionen, Anzahlen und Integrität pro Teil. Das Erste, worauf ein Reader schaut. |
| `profile.json` | wenn gesetzt | Der gesamte `me`-Datensatz des Nutzers: Name, Kontakt, Headshot-Referenz und Flags, plus Ordner, Papierkorb, Projekt-Vorlagen, Nutzer-Vorlagen und selbst erstellte Tools, Favoriten, ausgeblendete Tools, Sprach- und Emoji-Wahl. Gelesen über `host.profile`. |
| `sessions.json` | ja | Jede gespeicherte Sitzung: Slot, Tool-ID/-Version, Label, Thumbnail (Data-URL) und vollständige Eingabedaten. Gelesen über `host.state`. |
| `assets.json` | ja | Metadaten für jedes hochgeladene Asset (Bilder, Schriften, Markentoken, Logos, gespeicherte Kopien von Downloads), jeweils mit Verweis auf seine Bytes unter `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | pro Asset | Die rohen Asset-Bytes (Bild- und Schriftdateien). Unkomprimiert gespeichert (bereits komprimierte Formate). Die Erweiterung ist kosmetisch. Der MIME-Typ in `assets.json` ist maßgeblich. |
| `assets/blobs/<n>.c2pa` | wenn vorhanden | Extrahierte Content Credentials als exakte Binärbytes, referenziert über `_credentialFile` im Asset-Datensatz. Dies sind keine geräteseitigen Signierschlüssel. |
| `design-systems.json` | wenn vorhanden | Die auf dieser Installation erstellten oder hinzugefügten Designsysteme, als `{ active, records }`. Beim Import per ID gemergt; die aktive Wahl des Bundles greift nur, wenn das Ziel noch kein eigenes Designsystem hat. |
| `file-history.json` | optional | Versionierte Asset-Snapshots, abgeschlossene Dateioperationsberichte und vollständige Batch-Manifeste. Der Verlaufsteil hat eine eigene Version; bereitgestellt vom internen `fileHistory`-Backup-Adapter der Shell. |
| `revision-history.json` | optional, manuelle Backups | Stabile Kreations-IDs, aufbewahrte Checkpoints, Thumbnails und fortlaufende Wiederherstellungs-Entwürfe. Bereitgestellt über `host.state.history.backup`, wo unterstützt. |
| `file-history/versions/` | pro Snapshot | Vorherige Asset-Bytes und extrahierte Credentials, unabhängig davon, ob das aktuelle Asset noch existiert. |
| `file-history/results/` | pro abgeschlossener Operation | Exakte Ausgabe-Bytes. Keine für die Konvertierung ausgewählte Originaldatei wird aufbewahrt oder eingeschlossen. |
| `prefs.json` | ja | Nutzereigene lokale Einstellungen: `theme`, `sidebarWidth` und der `ct-metrics`-Aktivitätszähler. |
| `lolly.txt` | ja | Eine für Menschen lesbare Zusammenfassung des Bundles (Anzahlen, Profil, Dateiname) für alle, die das Zip ohne Lolly öffnen. Wird bei jedem Export neu erzeugt und beim Import erkannt, zählt daher nie als übersprungener Teil. Sie wird *nach* der Integritätskarte geschrieben und bleibt somit außerhalb davon. |

Das Bundle ist absichtlich ein einfaches Zip: Es übersteht jeden Transportweg unversehrt, und jedes Unzip-Tool kann es einsehen.

`profile.json` ist der kleinste Teil und der, den ein Reader in der App zuerst sieht: die Angaben, die ein Ersteller einmal einträgt, plus die Opt-in-Einstellung, die Tools erlaubt, sie zu nutzen.

![Das Profildetails-Formular, aus dem profile.json wird: Name, Kontaktdaten und Profilfoto](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=1100&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

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
| `format` | Immer `lolly-backup`. Eine Datei ohne dieses Feld wird als "kein Lolly-Backup" abgelehnt. |
| `formatVersion` | Das Layout, mit dem dieses Bundle **geschrieben** wurde. Wird bei jeder Änderung an den Teilen oder ihrer Form erhöht. Reader prüfen dieses Feld **nicht**. |
| `minReader` | Die Mindest-Reader-Version, die zum **sicheren** Import dieses Bundles nötig ist. Auf dieses Feld prüfen Reader. |
| `app` | ID der erzeugenden App, für Diagnosezwecke. |
| `exportedAt` | ISO-Zeitstempel der Bundle-Erstellung. |
| `counts` | Was der Writer eingefügt hat, zur Anzeige und Plausibilitätsprüfung. |
| `integrity` | Optional. Ordnet jedem Teil außer `manifest.json` einen SRI-artigen `sha256-<base64>`-Digest seiner **unkomprimierten** Bytes zu. |

## Versionsrichtlinie (Abwärtskompatibilität)

Die Trennung von `formatVersion` und `minReader` ermöglicht es, das Format weiterzuentwickeln, ohne ältere Installationen auszuschließen:

- Ein Reader importiert ein Bundle, wenn `manifest.minReader ≤` seine eigene Reader-Version ist. Er lehnt (mit "benötigt eine neuere Version der App") nur ab, wenn das Bundle ausdrücklich einen neueren Reader verlangt.
- Eine **additive** Änderung - ein neuer *optionaler* Teil oder ein neues optionales Manifestfeld - erhöht `formatVersion`, lässt `minReader` aber unverändert. Ältere Apps importieren weiterhin jeden Teil, den sie erkennen. Nicht erkannte Teile werden übersprungen (siehe unten), nicht stillschweigend verworfen.
- Eine **inkompatible** Änderung - eine, bei der ein falscher Import eines Teils Daten beschädigt, oder bei der ein bisher optionaler Teil verpflichtend wird - erhöht `minReader`. Ältere Apps lehnen dann sauber ab, statt etwas zu importieren, das sie nicht verarbeiten können.
- Setzt ein künftiges Bundle `formatVersion`, lässt aber `minReader` weg, fallen Reader vorsichtshalber auf eine Prüfung anhand von `formatVersion` zurück (behandeln die Änderung als inkompatibel).

> **Faustregel für Autoren:** Wenn jeder bestehende Reader durch das Ignorieren Ihrer Ergänzung weiterhin korrekt funktionieren würde, ist sie additiv - `formatVersion` erhöhen, `minReader` unverändert lassen. Andernfalls `minReader` erhöhen.

## Integrität

Ist `manifest.integrity` vorhanden, prüft ein Reader den SHA-256-Wert jedes gelisteten Teils **bevor irgendetwas geschrieben wird**. Eine Abweichung ("hat die Integritätsprüfung nicht bestanden") oder ein fehlender Teil ("unvollständig") bricht den gesamten Import ab - es gibt keine Teilwiederherstellung. Damit werden Beschädigungen erfasst, die ein Dateitransport verursachen kann (ein abgebrochenes AirDrop, ein E-Mail-Gateway, das den Anhang neu kodiert hat, ein defekter USB-Sektor).

Integrität ist bewusst als Best-Effort ausgelegt: Sie wird nur geschrieben, wo Web Crypto verfügbar ist (jeder sichere Browser-Kontext und modernes Node), und nur geprüft, wenn sowohl die Karte als auch Web Crypto vorhanden sind. Ein Bundle ohne Karte - zum Beispiel eines von vor Einführung der Integritätsprüfung - wird unverändert importiert. "Nicht prüfbar" wird niemals als "beschädigt" behandelt.

Das Manifest listet weder sich selbst noch die neu erzeugte `lolly.txt`-README. Die Digests decken die Teile ab, für die das Manifest bürgt.

## Importsemantik

Der Import ist ein **Merge**, niemals ein Replace-all:

- Vorhandene Daten auf dem Ziel bleiben unangetastet.
- Sind ein Sitzungs-Slot oder eine hochgeladene Bild-ID auf beiden vorhanden, bleibt die zuletzt gespeicherte Kopie erhalten, sodass eine ältere Sicherung nie neuere Arbeit auf dem Ziel überschreibt. Bei gleichem oder unbekanntem Zeitstempel bleibt die Kopie des Ziels erhalten. Bei einer Web-Installation mit Erstellungsverlauf entscheidet dieselbe Regel, welche Kopie einer Kreation aktuell bleibt, und die andere Kopie wird als geschützter Entwurf aufbewahrt (siehe unten).
- Der Profildatensatz wird zusammengeführt, nicht ersetzt. Jeder Ordner auf dem Ziel behält seinen Inhalt; ein Ordner aus dem Bundle, den das Ziel nicht hat, wird hinzugefügt, und ein Ordner auf beiden behält Name und übergeordneten Ordner des Ziels und erhält die Mitglieder des Bundles, die ihm fehlen. Eine Sitzung, die auf dem Ziel in einem Ordner abgelegt ist, bleibt dort abgelegt.
- Favoriten (Tools, Katalog-Assets und Projekte-Elemente) werden zusammengeführt. Vorlagen, Projekte-Vorlagen und Benutzer-Tools aus dem Bundle werden hinzugefügt, wenn das Ziel keinen Datensatz mit dieser ID hat. Papierkorb-Einträge aus beiden bleiben erhalten, sodass ein Element, das auf beiden Installationen wiederhergestellt werden könnte, das weiterhin kann.
- Jedes andere Profilfeld (Name, Kontaktdaten, Sprache, Feature-Flags, ausgeblendete Tools und die übrigen Einstellungen) behält den Wert des Ziels. Ein auf dem Ziel leeres Feld übernimmt den Wert des Bundles. Dasselbe gilt für `prefs.json`: Eine Einstellung wird nur dort geschrieben, wo das Ziel keine hat.
- Die gewöhnliche Anwendung der Gerätesynchronisierung ist die Ausnahme: Um Geräte im Gleichschritt zu halten, übernimmt sie den Profildatensatz, die Einstellungen, Sitzungen und Bilder der synchronisierten Kopie. Das Wiederherstellen einer früheren Kopie tut dasselbe, da es absichtlich in der Zeit zurückgeht. Der erste Beitritt, **Auf dieses Gerät übernehmen**, führt zusammen wie ein Import.
- Historische Asset-Versionen und Operations-IDs sind unveränderliche Ausnahmen: Ein wiederholter Import ist idempotent, und eine ID, die bereits andere Bytes/einen anderen Verlauf benennt, wird abgelehnt, nicht überschrieben. Ein erneuter Import eines identischen aktuellen Assets bewahrt dessen Version. Ein geändertes aktuelles Asset muss eine andere Version tragen.
- Der Erstellungsverlauf wird ebenfalls zusammengeführt. Eine Kreation auf beiden Seiten behält die zuletzt gespeicherte Kopie als aktuell, die andere Kopie als geschützten Entwurf; eine Kreation, deren Slot das Ziel für eine andere Kreation nutzt, wird daneben hinzugefügt; eine Kreation im Papierkorb des Ziels bleibt dort. Eine Checkpoint-ID, die auf dem Ziel anderen Inhalt benennt, behält die des Ziels. Ein Archiv, das seine eigenen Prüfungen nicht besteht, stoppt den Import, bevor Profil-, Sitzungs-, Asset- oder Einstellungsänderungen erfolgen. Ein identischer wiederholter Import belegt keinen zusätzlichen Speicher.
- Nichts, was nicht im Bundle war, wird berührt. Eine Sitzung, die das Ziel hatte, das Bundle aber nicht, übersteht den Import.

Gespeicherte Sitzungen verknüpfen sich automatisch neu mit ihren Bildern: Asset-Referenzen werden per ID gehalten, und die Bridge löst sie neu auf, nachdem die hochgeladenen Bilder wiederhergestellt wurden (das muss sie ohnehin, da `blob:`-URLs einen Reload nicht überstehen).

Die Importzusammenfassung meldet `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` zählt hochgeladene Assets, die nicht wiederhergestellt werden konnten (etwa weil der Gerätespeicher voll ist). Das unterscheidet sich von `skipped`, was Teile eines abwärtskompatiblen, neueren Writers zählt, die dieser Build nicht erkannt hat. Die Oberfläche zeigt `skipped` an ("… · N neuere Elemente übersprungen"), damit die Wiederherstellung ehrlich darüber Auskunft gibt, was sie zurückgelassen hat.

Ist ein Dateiverlauf vorhanden, trägt die Zusammenfassung außerdem `assetVersions`, `fileOperations` und `failedHistory`. Erschöpfter Speicherplatz oder Konflikte bei unveränderlichen IDs können eine teilweise Wiederherstellung verursachen; die Oberfläche weist den Nutzer an, die Quell-Sicherung zu behalten. Die Cloud-Synchronisierung rückt ihre angewendete Revision nach einer teilweisen oder nicht unterstützten Wiederherstellung **nicht** vor, sodass der Snapshot für einen erneuten Versuch verfügbar bleibt. Die Wiederherstellung ist keine einzelne Transaktion über alle Profil-/Sitzungs-/Asset-/Verlaufsspeicher hinweg.

## Erstellungsverlauf (v3)

Manuelle Sicherungen von einem verlaufsfähigen Web-Host enthalten `revision-history.json` mit seinem eigenen Schema `{ version: 1, documents, revisions, recoveries }`. Es trägt die aufbewahrten IDs, kanonische Eingabe-Snapshots, Versionsstempel, Raster-Vorschauen und separate Schreiber-Entwürfe. Der Verlaufs-Adapter erfasst aktuelle Sitzungen und ihre Köpfe in einer einzigen Lese-Transaktion; `sessions.json` verwendet für ältere Reader dieselben aktuellen Snapshots.

Die Wiederherstellung prüft SHA-256 und Byte-Anzahlen der Nutzlast, eindeutige Identitäten, Dokument-/Kopf-Beziehungen, Abstammung, Zeitstempel, Vorschautypen und Limits, bevor sie das Archiv in einer Transaktion übernimmt. Komprimierte Eltern-Referenzen können fehlen. Vorhandene aktuelle Arbeit wird nie stillschweigend ersetzt: Ist eine Kreation auf beiden Seiten vorhanden, wird die nicht als aktuell behaltene Seite zu einem geschützten Entwurf. Das 384-MiB-Übertragungslimit des Archivs wird ausdrücklich geprüft, und Speicherlimits werden durchgesetzt, ohne aufbewahrte Checkpoints abzuschneiden. Die Gesamt-Sicherung verwendet weiterhin eine In-Memory-ZIP-Implementierung und ist kein Streaming-Archiv.

Die Zusammenfassung ergänzt `revisions` und `recoveryDrafts`, die nur zählen, was dieser Import hinzugefügt hat, sowie `added`, `kept`, `replaced`, `copies` und `hidden` dafür, wie jede Kreation zusammengeführt wurde. Eine Shell ohne diese Fähigkeit stellt gewöhnliche Sitzungen wieder her und meldet den Verlaufsteil als übersprungen. Der native Dateisystem-Verlauf bleibt nicht unterstützt, bis sein Adapter dauerhafte Verlaufs-Transaktionen liefert. Der P2P-Gastzustand hat weder dauerhaften Verlauf noch ein Wiederherstellungsarchiv.

Die persönliche Snapshot-Synchronisierung schließt den Erstellungsverlauf ausdrücklich aus. Das Anwenden eines Snapshots auf ein lokales Dokument mit Verlauf bewahrt dessen vorherigen Arbeitszustand als separaten Wiederherstellungs-Entwurf und macht das Schreib-Token jedes offenen Editors ungültig. Seine unveränderlichen Checkpoints bleiben auf dem Gerät. Dies schützt den lokalen Verlauf während des Snapshot-Austauschs; es führt keine gleichzeitigen Geräteverläufe zusammen.

Historische Asset-Referenzen bleiben erhalten, während das Rendering Assets weiterhin über die vorhandene Bibliothek des Ziels auflöst. Dieses Archiv garantiert noch nicht die exakten alten Asset-Bytes oder alte Tool-Renderings. Asset-Versions- und Dateiergebnis-Bytes reisen weiterhin über ihren bestehenden separaten Backup-Teil.

## Gespeicherte Versionen und Dateiergebnisse (v2)

Der optionale Verlaufsteil enthält `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; Reader akzeptieren auch die frühere History-v1-Form ohne Batches. Jeder Snapshot benennt die stabile Asset-ID und die exakte Version, seinen Speicherzeitpunkt, die Byte-Länge und den hexadezimalen SHA-256, plus einen Asset-Datensatz, dessen `_file` und optionales `_credentialFile` auf Binärteile verweisen. Operationen tragen die ursprünglichen Datei-Fakten, die Anfrage, den Bericht, Zeitstempel und ein optionales Ergebnis-`_file`; Namen des Speicher-Backends, OPFS-Handles und Ausführungs-Leases reisen nicht mit. Ältere, nur History-v1-fähige Reader lehnen die neue Verlaufsversion vor dem Import ab, statt die Batch-Zugehörigkeit stillschweigend zu verwerfen.

Batch-Manifeste erfassen jede ausgewählte Quelle vor der Verarbeitung, einschließlich nie gelesener Dateien, abgebrochener Mitglieder, gescheiterter Reservierungen von Ergebnisplatz und unterbrochener Arbeit. Jedes Mitglied hat eine stabile Operations-ID, eine Quellreferenz/-Fakten, den angeforderten Ausgabenamen und einen abschließenden Bericht. Eine ungelesene Quelle hat deklarierte Fakten, keinen erfundenen Digest. Der Import prüft die Mitglieds-Identität und die Konsistenz mit einem mitgeführten Operationsbericht. Batch-Berichte bleiben verfügbar, wenn einzelne Ergebnisse ausdrücklich entfernt wurden, aber ein Beleg bedeutet nicht, dass seine Ausgabe-Bytes noch gespeichert sind.

- Jeder bekannte Verlaufseintrag, Bericht und referenzierte Datei wird geprüft, bevor irgendein Profil- oder Asset-Import schreibt. Fehlende Bytes und nicht übereinstimmende SHA-256-Werte schlagen fehl, selbst wenn der Umschlag keine Integritätskarte hat. Extrahierte Credentials bleiben Byte-Arrays, auch bei Importen von älteren Writern, die sie als Objekte mit numerischen Schlüsseln JSON-serialisiert haben.
- Laufende Operationen werden in der Sicherung zu unterbrochenen Einträgen, mit einem erklärenden Fehlerbericht und ohne Ergebnis. Die Wiederherstellung startet nie Hintergrundarbeit neu und importiert nie ein aktives Lease. Ein erneuter Versuch erfordert die Auswahl der Originaldatei, geprüft gegen ihren erfassten SHA-256, sofern vorhanden.
- Wiederhergestellte Ergebnisse übernehmen ihre Bytes und Metadaten gemeinsam in IndexedDB. Gewöhnliche neue Ergebnisse nutzen OPFS, wo verfügbar, mit einem Fallback auf IndexedDB. Eine bestehende laufende Operation wird durch einen Import nie ersetzt.
- Die ZIP-Zusammenstellung des Verlaufs erfolgt weiterhin im Arbeitsspeicher: Das aktuelle Limit liegt bei **256 MiB Verlaufs-Nutzlast**, **4 MiB Verlaufs-Metadaten**, höchstens **100 Operationen**, **100 Batches** und **2.000 Snapshots**. Der Export lehnt übergroßen oder unvollständigen Verlauf ausdrücklich ab; er lässt ihn nie stillschweigend weg. Laden Sie wichtige Versionen/Ergebnisse einzeln herunter, bevor Sie ältere lokale Kopien entfernen. Diese Limits sind keine gemessene Spitzenspeicher-Garantie für Telefone.
- Der lokale Ergebnisverlauf hat ein Budget von 512 MiB und eine Obergrenze von 100 Einträgen. Asset-Snapshots haben ein separates Budget von 512 MiB und höchstens 20 historische Versionen pro Asset; extrahierte Credential-Bytes zählen zu diesem Snapshot-Budget. Die Wiederherstellung respektiert diese Limits und verdrängt nie stillschweigend vorhandene Nutzerdaten.
- Lokale Batch-Metadaten haben ein separates Budget von 4 MiB, höchstens 100 Manifeste und 20 Mitglieder pro Batch. Ausstehende Mitglieder reservieren Metadaten-Kapazität, mit einer Obergrenze von 32 KiB pro Mitgliedsbericht. Dies ist ein logisches Budget, keine Garantie für Browser-Festplattenspeicher; ein echter Kontingentfehler wird angezeigt, und der Bericht im Arbeitsspeicher bleibt herunterladbar. Ein erneuter Versuch für ein Batch-Mitglied erzeugt einen neuen Batch, ohne den alten Bericht zu überschreiben. Das Entfernen eines Batch-Eintrags entfernt weder einzelne Ergebnis-Bytes noch Bibliotheks-Assets.
- Konvertierte Ergebnisse können ausdrücklich zur Bibliothek hinzugefügt werden, ohne Normalisierung oder Neukodierung. Quell-/Ausgabe-Hashes und die Operationsbeziehung begleiten das Asset. Wiederholtes Hinzufügen nutzt eine unveränderte Kopie erneut; eine bearbeitete Kopie wird nie überschrieben. Rasterbilder können ein neues Design-Dokument starten. Dieses Dokument nutzt die aktuelle Bibliotheks-Asset-ID: Das Durchsetzen exakter Versions-Pins über die gesamte Laufzeit und den URL-Pfad von Design hinweg ist noch separate Arbeit. SVG-/HTML-/PDF-/ZIP-Ergebnisse werden durch diese Übergabe als undurchsichtige Datei-Assets behandelt, nicht zu vertrauenswürdigem interaktivem/Vektor-Inhalt hochgestuft.
- **Konvertieren → jüngste Dateioperationen** legt Verlaufsnutzung, Berichte, Downloads und den Versionsmanager offen. Der Manager findet auch frühere Versionen gelöschter Bibliotheks-Assets. Das Wiederherstellen eines Snapshots erzeugt eine neue aktuelle Version, während der ausgewählte Snapshot intakt bleibt. **Einstellungen → Speicher** rechnet Ergebnisse und Versionen getrennt von Wegwerf-Caches ab.
- Das ausdrückliche Aufräumen temporärer Dateien entfernt nur operations-eigene, unreferenzierte Bytes. Aktuelle Einträge schützen ihre Dateien; kürzliche OPFS-Dateien haben eine Kulanzfrist von einer Stunde. Gespeicherte Ergebnisse und Asset-Snapshots werden nicht automatisch geleert.

Ältere Reader akzeptieren weiterhin den v2-Umschlag (`minReader: 1`) und stellen vertraute Teile wieder her, wobei nicht unterstützte Verlaufsteile als übersprungen gezählt werden. Eine vollständige Verlaufs-Wiederherstellung erfordert eine Shell mit dem `fileHistory`-Adapter; dies ist eine shell-interne Nahtstelle, keine neue toolseitige `HostV1`-Fähigkeit. Eine echte Zwei-Geräte-Wiederherstellung wird durch das lokale Chromium-Gate abgedeckt; die Abnahme der Wiederherstellung auf installierten Tauri-/iOS-/Android-Apps bleibt gesondert.

## Was nicht mitreist

- **Katalog-Caches** (heruntergeladene Asset-Metadaten und Blobs, der Tool-Index) - werden auf dem Ziel kostenlos neu synchronisiert.
- **Katalog-Tools und Katalog-Assets** - außerhalb des Umfangs und gelten als auf dem Ziel bereits vorhanden. Markentoken, Schriften und Logos, die der Nutzer hinzugefügt hat, sind Nutzer-Assets und reisen daher mit.
- **`blob:`-/Objekt-URLs** - werden beim Laden von der Bridge neu erzeugt.
- **Konvertierungs-Originale, laufende Ausführungs-Leases und maschinenlokale Zugriffs-/Signier-Geheimnisse** - keine portable Verlaufs-Nutzlast. Ein gespeichertes Ergebnis ist eine Kopie, kein Versprechen, dass die Original-Quelle gesichert wurde.
- **Der Export-Sequenzzähler** - der tägliche Zähler für die Download-Benennung (`localStorage`-Schlüssel `lolly-export-seq`) ist eine lokale Namenskonvenienz. Er ist bewusst nicht in `PREF_KEYS` enthalten und reist daher nie in einem Bundle mit.

Der Speicherzähler gliedert dieselbe Aufteilung auf. Gespeicherte Sitzungen, Meine Bilder und Dateiergebnisse & Versionen reisen in einem Bundle mit. Der Asset-Cache, Tool-Vorschauen und Offline-Pins darunter sind alle neu ableitbar und bleiben daher zurück.

![Der Speicherzähler, der die Daten dieses Geräts in benannte Kategorien unterteilt, wobei Gespeicherte Sitzungen und Meine Bilder getrennt vom Asset-Cache erfasst werden, hier auf einer frischen Installation, in der jede Kategorie noch leer ist](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Shell-übergreifende Garantie

`data-transfer.ts` liest und schreibt ausschließlich über die Capability-Bridge (`host.profile`, `host.state`, `host.assets`) und die gemeinsamen `localStorage`-Einstellungen. Dasselbe Modul liest und schreibt den gemeinsamen Umschlag auf Web und Tauri, über IndexedDB- oder Dateisystem-Speicher. Optionale Verlaufsteile erscheinen nur dort, wo der entsprechende Adapter verfügbar ist; ein nicht unterstützter Teil wird beim Import als übersprungen gemeldet. Die Headless-Suite testet die gemeinsamen Teile gegen eine In-Memory-Bridge, während Verlaufs-Transaktionen zusätzlich echte Browser-Tests haben.

Zwei Shells stehen aus unterschiedlichen Gründen außerhalb dieser Garantie:

- Die **One-Shot-CLI** hat nichts mitzuführen - ihr Zustand ist pro Aufruf im Speicher und flüchtig.
- Die **TUI** persistiert tatsächlich Zustand (`~/.lolly`: Sitzungen, Ordner, Profil), und ihre Profilansicht kann davon ein Backup erstellen, schreibt aber ein *einfacheres*, eigenes Archiv: `saved-state/<slot>.json` pro Sitzung plus `profile.json` und `folders.json`, ohne Manifest, ohne `formatVersion`/`minReader` und ohne Integritätskarte. Es ist mit diesem Format **nicht** importierbar - ein Reader lehnt es als "kein Lolly-Backup" ab - und verwirrenderweise verwendet es einen ähnlichen Namen (`lolly-backup-<stamp>.zip`). Die Vereinheitlichung beider ist eine bekannte Lücke.

## Reservierte Erweiterungspunkte

Der Umschlag ist absichtlich ein Manifest plus eine Menge benannter Teile, damit neue Arten portabler Daten später **ohne inkompatible Änderung** darin Platz finden. Sie fügen sich als additive Teile ein (neue `formatVersion`, gleiche `minReader`), und der heutige Reader überspringt, was er nicht erkennt. Diese sind noch nicht gebaut. Die Namen sind hier reserviert, damit das Format kohärent bleibt, wenn sie eintreffen.

- **`tokens.json` - Design-Token.** Ein [W3C-DTCG](https://tr.designtokens.org/format/)-Design-Token-Dokument (das Format, das [Penpot importiert und exportiert](https://help.penpot.app/user-guide/design-systems/design-tokens/) - Token mit `$value`/`$type`/`$description`, organisiert in Gruppen, Sets und Themes). Ein Token-Set im Bundle erlaubt es einem Nutzer, seine Markenprimitiven zusammen mit seinen Sitzungen zwischen Installationen zu verschieben. (Die eigenen Markentoken eines Nutzers reisen bereits heute als das Asset `user/tokens/brand` in `assets.json` mit; dieser Teil würde ein vollständiges DTCG-Dokument mit seinen Sets und Themes tragen.) Langfristig wird ein eingelesenes Token-Set zu einer vollwertigen Quelle, gegen die Tools und Paletten-Assets auflösen.
- **`penpot/` - eingelesene Penpot-Dateien.** Ein reserviertes Verzeichnis für eine Penpot-Datei (oder ihren extrahierten, für Lolly relevanten Ausschnitt), die *als Tool* importiert und bereitgestellt wird. Das Bundle wird die eingelesene Definition mitführen, sodass sie mit dem Rest der Nutzerdaten reist.

Alles außerhalb dieser reservierten Namen und der oben genannten Teile ist für einen Reader ein unbekannter Teil: wird unangetastet gelassen und in `skipped` mitgezählt.

## Referenz

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - der Namensgeber `backupFilename()` ist intern).
- Vertragstest: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - Fälle für Round-Trip, Merge, Integrität, Abwärtskompatibilität und Reader-Gate.
- Verlaufs-Vertragstests: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) und [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Browser-Abnahme: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) und [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Verwendete Bridge-Oberfläche: `host.profile`, `host.state`, `host.assets` - siehe [Host-API](/info/host-api.html).
