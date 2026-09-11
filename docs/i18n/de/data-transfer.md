# Datenübertragung - das `lolly-backup`-Bündel

Alles, was sich bei einem Lolly-Nutzer ansammelt, lebt **auf seinem Gerät** - kein Konto, keine Cloud. Das Datenübertragungsbündel ist der Weg, wie dieser Wert sich bewegt: exportieren Sie es auf einer Installation, tragen Sie die Datei auf beliebigem Weg (USB, AirDrop, E-Mail an sich selbst, eine Netzwerkfreigabe) und importieren Sie sie auf einer anderen. Die Datei *ist* der Transport. Das Ziel kann offline oder online sein. Es macht keinen Unterschied, denn nichts spricht je mit einem Server.

![Die beiden Schaltflächen, die eine ganze Installation umziehen: Meine Daten exportieren schreibt ein Zip, Daten importieren liest es wieder ein](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Diese Seite ist die Formatspezifikation. Die Anleitung für Endnutzer finden Sie unter [Lolly verwenden → Auf ein anderes Gerät wechseln](/info/using.html). Die Implementierung ist [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), und [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) legt den Round-Trip-Vertrag fest.

> **Umfang.** Ein Bundle enthält *Nutzerdaten*, keine Tools. Tools und Katalog-Assets werden separat synchronisiert und gelten als bereits auf dem Zielgerät vorhanden (im schlimmsten Fall in einer höheren Version). Ein Import installiert oder aktualisiert niemals ein Tool.

## Ziele

- <!--i:box--> **Ein Format, jede Shell.** Dieselben Bytes werden von der Web-PWA, den Tauri-Desktop-/Mobile-Apps und jeder künftigen Shell erzeugt und gelesen. Das Bundle ist der Vertrag. Die Capability-Bridge jeder Shell ist der plattformspezifische Adapter dahinter.
- <!--i:shieldcheck--> **Übersteht den Transport.** Ein beim Transport beschädigtes oder abgeschnittenes Bundle scheitert beim Import laut und deutlich, es stellt niemals nur halb wieder her.
- <!--i:clock--> **Überlebt diese Version.** Eine ältere App kann die erkannten Teile eines neueren Bundles trotzdem importieren. Ein wirklich inkompatibles Format wird sauber abgelehnt.
- <!--i:check--> **Sicher zu mergen.** Ein Import auf eine bereits genutzte Installation löscht nie etwas, das nicht im Bundle enthalten war.

## Der Umschlag

Ein Bundle ist eine einfache `.zip`-Datei. Der Download wird nach der Person benannt, der er gehört - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (zum Beispiel `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - sodass ein Downloads-Ordner voller Backups lesbar bleibt. Der Vor- und der Nachname stammen aus dem Profil und entfallen, wenn sie nicht gesetzt sind. Ohne Profil ergibt sich `LollyTools-2026-06-26-1.zip`, und ein Vorname allein ergibt `LollyTools-Ada-2026-06-26-1.zip`. Jeder Teil wird zu einem für Dateinamen sicheren Token bereinigt (Unicode-Buchstaben/-Ziffern bleiben erhalten, Leerzeichen/Satzzeichen werden entfernt, auf 32 Zeichen begrenzt). `<n>` ist eine Sequenz pro Tag und Gerät, damit wiederholte Exporte am selben Tag nicht kollidieren und in Reihenfolge bleiben. `backupFilename()` in [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) erzeugt den Namen. Der Inhalt der Zip-Datei ist unabhängig vom Namen identisch. Darin:

| Pfad | Erforderlich | Inhalt |
|---|---|---|
| `manifest.json` | ja | Format-ID, Versionen, Anzahlen und Integrität pro Teil. Das Erste, worauf ein Reader schaut. |
| `profile.json` | wenn gesetzt | Der `me`-Datensatz des Nutzers (Name, Kontakt, Headshot-Referenz, Flags). Gelesen über `host.profile`. |
| `sessions.json` | ja | Jede gespeicherte Sitzung: Slot, Tool-ID/-Version, Label, Thumbnail (Data-URL) und vollständige Eingabedaten. Gelesen über `host.state`. |
| `assets.json` | ja | Metadaten für jedes hochgeladene Asset (Bilder, Schriften, Markentoken), jeweils mit Verweis auf seine Bytes unter `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | pro Asset | Die rohen Asset-Bytes (Bild- und Schriftdateien). Unkomprimiert gespeichert (bereits komprimierte Formate). Die Erweiterung ist kosmetisch. Der MIME-Typ in `assets.json` ist maßgeblich. |
| `prefs.json` | ja | Nutzereigene lokale Einstellungen: `theme`, `sidebarWidth` und der `ct-metrics`-Aktivitätszähler. |
| `lolly.txt` | ja | Eine für Menschen lesbare Zusammenfassung des Bundles (Anzahlen, Profil, Dateiname) für alle, die das Zip ohne Lolly öffnen. Wird bei jedem Export neu erzeugt und beim Import erkannt, zählt daher nie als übersprungener Teil. Sie wird *nach* der Integritätskarte geschrieben und bleibt somit außerhalb davon. |

Das Bundle ist absichtlich ein einfaches Zip: Es übersteht jeden Transportweg unversehrt, und jedes Unzip-Tool kann es einsehen.

`profile.json` ist der kleinste Teil und der, den ein Reader in der App zuerst sieht: die Angaben, die ein Ersteller einmal einträgt, plus die Opt-in-Einstellung, die Tools erlaubt, sie zu nutzen.

![Das Formular für Profildetails, aus dem profile.json wird - Name, Kontakt, Headshot und das Opt-in daneben](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
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

Der Import ist **Merge-Overwrite**, niemals Replace-all:

- Vorhandene Daten auf dem Zielgerät bleiben unangetastet.
- Jeder kollidierende Schlüssel - das Profil, ein Sitzungs-Slot, eine hochgeladene Bild-ID - wird durch die importierte Kopie ersetzt.
- Nichts, was nicht im Bundle war, wird berührt. Eine Sitzung, die das Ziel hatte, das Bundle aber nicht, übersteht den Import.

Gespeicherte Sitzungen verknüpfen sich automatisch neu mit ihren Bildern: Asset-Referenzen werden per ID gehalten, und die Bridge löst sie neu auf, nachdem die hochgeladenen Bilder wiederhergestellt wurden (das muss sie ohnehin, da `blob:`-URLs einen Reload nicht überstehen).

Die Importzusammenfassung meldet `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` zählt hochgeladene Assets, die nicht wiederhergestellt werden konnten (etwa weil der Gerätespeicher voll ist). Das unterscheidet sich von `skipped`, was Teile eines abwärtskompatiblen, neueren Writers zählt, die dieser Build nicht erkannt hat. Die Oberfläche zeigt `skipped` an ("… · N neuere Elemente übersprungen"), damit die Wiederherstellung ehrlich darüber Auskunft gibt, was sie zurückgelassen hat.

## Was nicht mitreist

- **Katalog-Caches** (heruntergeladene Asset-Metadaten und Blobs, der Tool-Index) - werden auf dem Ziel kostenlos neu synchronisiert.
- **Tools und Markenassets** - außerhalb des Umfangs und gelten als auf dem Ziel bereits vorhanden.
- **`blob:`-/Objekt-URLs** - werden beim Laden von der Bridge neu erzeugt.
- **Der Export-Sequenzzähler** - der tägliche Zähler für die Download-Benennung (`localStorage`-Schlüssel `lolly-export-seq`) ist eine lokale Namenskonvenienz. Er ist bewusst nicht in `PREF_KEYS` enthalten und reist daher nie in einem Bundle mit.

Der Speicherzähler gliedert dieselbe Aufteilung auf. Gespeicherte Sitzungen und Meine Bilder reisen in einem Bundle mit. Der Asset-Cache, Tool-Vorschauen und Offline-Pins darunter sind alle neu ableitbar und bleiben daher zurück.

![Der Speicherzähler, der die Daten dieses Geräts in benannte Kategorien unterteilt, wobei Gespeicherte Sitzungen und Meine Bilder getrennt vom Asset-Cache erfasst werden, hier auf einer frischen Installation, in der jede Kategorie noch leer ist](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Shell-übergreifende Garantie

`data-transfer.ts` liest und schreibt ausschließlich über die Capability-Bridge (`host.profile`, `host.state`, `host.assets`) und die gemeinsamen `localStorage`-Einstellungen. Weil die Bridge die einzige Nahtstelle ist, erzeugt *dasselbe* Modul auf jeder Shell ein byte-identisches Bundle, obwohl der Speicher darunter sich unterscheidet - IndexedDB im Web, das Dateisystem bei Tauri. Die Tauri-Shells verwenden dieses Modul unverändert. Nur ihre `host.state`-Implementierung unterscheidet sich. Der Headless-Test durchläuft den vollständigen Round-Trip gegen eine In-Memory-Bridge, weshalb er stellvertretend für alle steht.

Zwei Shells stehen aus unterschiedlichen Gründen außerhalb dieser Garantie:

- Die **One-Shot-CLI** hat nichts mitzuführen - ihr Zustand ist pro Aufruf im Speicher und flüchtig.
- Die **TUI** persistiert tatsächlich Zustand (`~/.lolly`: Sitzungen, Ordner, Profil), und ihre Profilansicht kann davon ein Backup erstellen, schreibt aber ein *einfacheres*, eigenes Archiv: `sessions/<slot>.json` pro Sitzung plus `profile.json` und `folders.json`, ohne Manifest, ohne `formatVersion`/`minReader` und ohne Integritätskarte. Es ist mit diesem Format **nicht** importierbar - ein Reader lehnt es als "kein Lolly-Backup" ab - und verwirrenderweise verwendet es einen ähnlichen Namen (`lolly-backup-<stamp>.zip`). Die Vereinheitlichung beider ist eine bekannte Lücke.

## Reservierte Erweiterungspunkte

Der Umschlag ist absichtlich ein Manifest plus eine Menge benannter Teile, damit neue Arten portabler Daten später **ohne inkompatible Änderung** darin Platz finden. Sie fügen sich als additive Teile ein (neue `formatVersion`, gleiche `minReader`), und der heutige Reader überspringt, was er nicht erkennt. Diese stehen auf der [Roadmap](/info/overview.html#roadmap), sind aber noch nicht umgesetzt. Die Namen sind hier reserviert, damit das Format kohärent bleibt, wenn sie eintreffen.

- **`tokens.json` - Design-Token.** Ein [W3C-DTCG](https://tr.designtokens.org/format/)-Design-Token-Dokument (das Format, das [Penpot importiert und exportiert](https://help.penpot.app/user-guide/design-systems/design-tokens/) - Token mit `$value`/`$type`/`$description`, organisiert in Gruppen, Sets und Themes). Ein Token-Set im Bundle erlaubt es einem Nutzer, seine Markenprimitiven zusammen mit seinen Sitzungen zwischen Installationen zu verschieben. Langfristig wird ein eingelesenes Token-Set zu einer vollwertigen Quelle, gegen die Tools und Paletten-Assets auflösen.
- **`penpot/` - eingelesene Penpot-Dateien.** Ein reserviertes Verzeichnis für eine Penpot-Datei (oder ihren extrahierten, für Lolly relevanten Ausschnitt), die *als Tool* importiert und bereitgestellt wird. Das Bundle wird die eingelesene Definition mitführen, sodass sie mit dem Rest der Nutzerdaten reist.

Alles außerhalb dieser reservierten Namen und der oben genannten Teile ist für einen Reader ein unbekannter Teil: wird unangetastet gelassen und in `skipped` mitgezählt.

## Referenz

- Modul: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - der `backupFilename()`-Namensgeber ist intern).
- Vertragstest: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - Fälle für Round-Trip, Merge, Integrität, Abwärtskompatibilität und Reader-Gate.
- Verwendete Bridge-Oberfläche: `host.profile`, `host.state`, `host.assets` - siehe [Host-API](/info/host-api.html).
