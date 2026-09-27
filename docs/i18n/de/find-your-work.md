# Ihre Arbeit finden und wiederherstellen

Alles, was Sie in Lolly erstellen, bleibt in dem Browser oder der App, in der Sie es erstellt haben, auf diesem Gerät, sofern Sie nicht die [Synchronisierung](/info/sync.html) einschalten. Gespeicherte Arbeit ist in **Projekte**. Eine heruntergeladene Datei liegt dort, wo Ihr Browser oder System sie abgelegt hat, und eine Kopie wartet meist in **Assets**. In neun Tools wird auch nie gespeicherte Arbeit aufbewahrt. Diese Seite behandelt jeden dieser Fälle, dazu einen geschlossenen Tab, gelöschte Browserdaten, frühere Versionen, gelöschte Elemente und den Umzug auf ein anderes Gerät.

| Was Sie getan haben | Wo Sie nachsehen sollten |
|---|---|
| **Speichern unter** oder **Speichern** gedrückt | **Projekte** |
| **Herunterladen** gedrückt | Die Downloads Ihres Browsers, und eine Kopie in **Assets** |
| Weder noch, in einem der [neun Tools, die während der Arbeit speichern](#the-nine-tools-that-save-as-you-work) | **Projekte** und **History** |
| Weder noch, in einem anderen Tool | Nur der Tab, in dem Sie gearbeitet haben, bis Sie ihn schließen |
| In den Papierkorb verschoben | Die Kachel **Papierkorb** in **Projekte**, für 30 Tage |

## Etwas finden, das Sie gespeichert haben

1. Drücken Sie oben links im Tool auf **Start**.
2. Öffnen Sie den Tab **Projekte** oben auf dem Startbildschirm (auf dem Smartphone ein Ordnersymbol).
3. Schauen Sie auf den ersten Bildschirm. In **Meine Bibliothek** gespeicherte Arbeit liegt dort, und jedes Projekt ist ein Ordner. Um alle Ordner auf einmal zu durchsuchen, tippen Sie unten am Bildschirm in **Alle Projekte durchsuchen …**.

Ein Element ist nach dem Dateinamen benannt, den Sie im Exportbereich eingegeben haben, oder nach seinem Tool, etwa **QR Code**, wenn Sie keinen eingegeben haben. Öffnen Sie das Element, und jede Einstellung ist zurück, bereit, geändert und erneut exportiert zu werden. Um neue Arbeit auf diese Weise zu behalten, siehe [Speichern & Fortsetzen](/info/using.html#saving-continuing).

::: note Nicht in Projekten?
- Es könnte im **Papierkorb** sein: siehe [Etwas wiederbekommen, das Sie gelöscht haben](#get-back-something-you-deleted).
- Ein anderer Browser, ein privates Fenster oder ein anderes Gerät startet leer, sofern Sie nicht die [Synchronisierung](/info/sync.html) nutzen oder [Ihre Arbeit umziehen](#move-your-work-to-another-device).
- Wenn Sie nur **Herunterladen** gedrückt haben, siehe [Eine heruntergeladene Datei finden](#find-a-file-you-downloaded).
:::

::: details Mit Projekten arbeiten
Sie können **Projekte** auch über **Einstellungen → Speicher → Gespeicherte Sitzungen → In Projekten organisieren** öffnen. Es funktioniert wie ein Dateimanager:

![Projekte, bevor irgendetwas gespeichert ist: die Kacheln Neuer Ordner, Neues Asset und Vorlagen, die History-Uhr oben rechts und die Leiste Alle Projekte durchsuchen am Fuß](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Ordner, die sich verschachteln lassen.** Gruppieren Sie gespeicherte Sitzungen in Ordnern und Ordner in Ordnern, so tief Sie mögen. Erstellen Sie einen Ordner, benennen Sie ihn um oder ziehen Sie eine Kachel auf einen anderen Ordner, um sie zu verschieben; eine Brotkrumenleiste führt Sie wieder nach oben. Ohne Ordner gespeicherte Sitzungen erscheinen direkt auf der obersten Ebene von **Projekte**.
- <!--i:clock--> **Sortieren Sie nach Ihrem Geschmack.** **Ansichtsoptionen**, die Regler-Schaltfläche oben rechts, bietet **Raster** oder **Liste** und sortiert nach **Name**, **Hinzugefügt am**, **Zuletzt geändert** (die Voreinstellung), **Größe** und, innerhalb eines Ordners, **Nach Tool**. Ordner stehen immer vorn, gleich welche Sortierung aktiv ist - sortiert werden nur die Sitzungen und Ordner innerhalb ihrer eigenen Gruppe.
- <!--i:document--> **Neue Arbeit direkt ablegen.** **Neues Asset** öffnet die gemeinsame Auswahl. Wählen Sie **Vorlagen**, um mit einer gespeicherten Vorlage zu beginnen: Öffnen Sie sie zum Bearbeiten oder nutzen Sie **+ Hinzufügen**, um sofort eine neue Kreation zu speichern.
- <!--i:checklist--> **Mehrfachauswahl (Desktop).** Setzen Sie das Häkchen einer Kachel, ziehen Sie ein Auswahlrechteck über leere Fläche oder nutzen Sie **Umschalt/Cmd-Klick**; ein **Rechtsklick** auf eine Kachel öffnet ihr Kontextmenü. Die Auswahlleiste bietet dann **Auswahl rendern**, **Verschieben nach…**, **Neuer Ordner**, **Löschen** (was in den Papierkorb verschiebt), **Gemeinsam bearbeiten** für zwei bis acht Sitzungen einzelner Tools, nebeneinander unter einer Seitenleiste, und **Als Tabelle bearbeiten**, das eine Auswahl beliebiger Größe oder Mischung als Zeilen im Batch-Raster öffnet.
- <!--i:download--> **Einen ganzen Ordner oder eine Auswahl rendern.** **Ordner rendern** exportiert jede gespeicherte Sitzung in einem Ordner - einschließlich seiner Unterordner - als eine verschachtelte `.zip`. **Auswahl rendern** tut dasselbe für jede Mehrfachauswahl, und eine einzelne Sitzung rendert direkt in ihre eigene Datei. Kein Batch/Pro nötig.
- <!--i:link--> **Direkt zur gespeicherten Arbeit eines Tools springen.** Haken Sie in der Tools-Galerie ein oder mehrere Tools an und wählen Sie **Sitzungen ansehen** in der Auswahlleiste - Projekte öffnet sich und zeigt nur die mit diesen Tools erstellten Sitzungen, mit einem **Leeren**, das zurück zur vollen Ansicht führt.
- <!--i:link--> **Eine gespeicherte Sitzung teilen.** Rechtsklick auf eine Sitzung (auf dem Smartphone drücken Sie **•••** auf ihrer Kachel) → **Link teilen** kopiert einen Link, der sie mit denselben Einstellungen wieder öffnet; Bilder von Ihrem Gerät reisen nicht mit einem Link (der vollständige Teilen-Dialog: siehe [Ihre Arbeit teilen](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Eine umbenennen oder kopieren.** Rechtsklick auf eine Sitzung (auf dem Smartphone drücken Sie **•••** auf ihrer Kachel) für **Umbenennen**, **Duplizieren** (eine Kopie im selben Ordner) und **Verschieben nach…**.

![Das Popover Ansichtsoptionen in Projekte: Layout mit Raster und Liste, und Sortieren nach auf Zuletzt geändert eingestellt, neben einer Schaltfläche, die die Reihenfolge umkehrt](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
<!--
SHOT NOTE (misc-projects-sort): trigger button confirmed as
`.filter-fab.projects-viewopts` in views/projects.ts (openViewOpts() is bound
to `.projects-viewopts` specifically) - `.projects-viewopts` alone is the
more specific hook, so that's what drives the click. The popover it opens
(`.projects-viewmenu`, also confirmed directly in openViewOpts()) is body-
appended, not nested under the Projects root, so cropSelector finds it
regardless. "By tool" only appears inside a folder - this recipe captures at
the Projects ROOT (`url=/#/p`), so if the capture pass wants "By tool"
visible too, point url= at a real folder instead: the route is a path
segment, `/#/p/<folderId>` (confirmed in main.ts's hash router - `parts[0]
=== 'p'` reads `folderId` from `parts[1]`), not a query param. Caveat: a
folder has to already EXIST in the capture profile, which a per-shot fresh
context has none of.
The popover (views/projects-view-options.ts, checked 2026-09-26) holds a
Layout pair (Grid / List) and a Sort by menu with a reverse button; the
options inside the menu (Name, Date added, Last modified, Size, By tool) are
not visible in the closed menu, so the alt does not list them.
-->

:::

## Wenn Sie den Tab geschlossen oder das Tool verlassen haben

Was zurückkommt, hängt davon ab, wie Sie das Tool verlassen haben und welches Tool Sie genutzt haben:

- **Sie haben den Tab geschlossen oder kommen ein anderes Mal zurück.** Nicht gespeicherte Arbeit ist weg, außer in den [neun Tools](#the-nine-tools-that-save-as-you-work), die Ihre Änderungen während der Arbeit speichern: Öffnen Sie sie über **Projekte**.
- **Sie haben die Seite im selben Tab neu geladen.** Ihre Einstellungen kommen aus der Seitenadresse zurück. In anderen Tools als den neun kommen Bilder und Dateien, die Sie von Ihrem Gerät hinzugefügt haben, sowie einzeiliger Text über 150 Zeichen nicht zurück, weil die Adresse sie nicht enthält.
- **Sie haben Start oder die Zurück-Schaltfläche oben links gedrückt.** Wenn Sie seit dem letzten Speichern, Herunterladen oder Kopieren etwas geändert haben, fragt ein Dialog **Nicht gespeicherte Änderungen**, ob zuerst gespeichert werden soll. **Speichern & verlassen** speichert die Arbeit und bringt Sie zu **Projekte**, oder zurück in den Projektordner, aus dem Sie die Arbeit geöffnet haben. **Verlassen ohne zu speichern** verlässt das Tool; in den neun Tools sind Ihre Änderungen bereits gespeichert und bleiben in Projekte. **Abbrechen** hält Sie im Tool.

Lolly fragt nur, wenn Sie **Start** oder die Zurück-Schaltfläche in einem Tool drücken. Das Schließen des Tabs, ein Neuladen und die eigene Zurück-Schaltfläche Ihres Browsers fragen nie. Um sicherzugehen, drücken Sie **Speichern unter** oder **Speichern** im Exportbereich, bevor Sie ein Tool verlassen.

::: note Versehentlich ohne Speichern verlassen?
Drücken Sie in anderen Tools als den neun sofort die Zurück-Schaltfläche Ihres Browsers. Die Einstellungen aus der Seitenadresse kommen zurück, Bilder, die Sie von Ihrem Gerät hinzugefügt haben, jedoch nicht. Drücken Sie dann **Speichern unter** und **Speichern**, bevor Sie etwas anderes tun: Diesmal fragt Lolly nicht, bevor Sie es verlassen.
:::

::: details Die neun Tools, die während der Arbeit speichern
[Design](/#/tool/design), [Diagramm](/#/tool/chart), [QR-Code](/#/tool/qr-code), [Verlauf](/#/tool/gradient), [Schnipsel](/#/tool/snippet), [Flussdiagramm](/#/tool/org-chart), [Preise](/#/tool/pricing-table), [Wortmarke](/#/tool/wordmark) und [Text](/#/tool/text-helper). Die Liste wächst, sobald weitere Tools automatisches Speichern erhalten.

In diesen Tools legt Ihre erste Änderung die Arbeit in **Projekte** ab, als hätten Sie gespeichert, und spätere Änderungen werden innerhalb weniger Sekunden gesichert. Eine nicht gespeicherte Kreation bleibt also auch nach dem Schließen des Tabs in Projekte, und **Verlassen ohne zu speichern** verwirft Ihre Änderungen nicht. Das erneute Öffnen des Tools über den Startbildschirm beginnt eine neue Kreation; öffnen Sie die frühere aus Projekte.

Dies funktioniert nur in der Web-App, nicht in den Desktop- oder Mobil-Apps, und nicht, während Sie live mit jemand anderem zusammenarbeiten.
:::

## Eine heruntergeladene Datei finden

In einem Browser übergibt **Herunterladen** die Datei an Ihren Browser, der sie in seinem Downloads-Ordner speichert (meist **Downloads**) oder Sie fragt, wo. Lolly erfährt nicht, wohin die Datei gegangen ist, schauen Sie also in der Downloadliste Ihres Browsers nach.

Wenn keine Datei erschienen ist, schauen Sie im Exportbereich nach, solange Sie noch im Tool sind. Unter **Herunterladen** gibt eine Zeile den Dateinamen und die Zeit an, mit **Retry download**, und in Chrome, Edge und anderen Chromium-Browsern **Save file…**, um selbst einen Ordner zu wählen. Die Zeile und ihre Datei bleiben bestehen, bis Sie das Tool verlassen, neu laden oder erneut exportieren.

Lolly behält außerdem zwei Dinge nach jedem Download:

- **Eine Kopie der Datei**, in **Assets** unter **Ihre Uploads**, solange **Meine Renderings in meiner Bibliothek speichern** unter **Einstellungen → Ihre Renderings** aktiviert ist (**Einstellungen** befindet sich am Fuß des Startbildschirms). Die Einstellung ist standardmäßig aktiviert. Ein Video oder eine Datei über 50 MB fragt zuerst nach, und ein Zip wird nicht kopiert.
- **Die von Ihnen verwendeten Einstellungen**, für Ihre letzten 24 Downloads. **Letzte Exporte**, unterhalb Ihrer gespeicherten Arbeit in **Projekte**, öffnet das Tool erneut mit diesen Einstellungen, damit Sie die Datei erneut erstellen können, wobei Bilder und Dateien, die Sie von Ihrem Gerät hinzugefügt haben, nicht enthalten sind. Dieselbe Liste finden Sie unter **Einstellungen → Aktivität & Statistiken → Neueste Exporte** und im Tab **Changes** von **History**. Diese Liste hält Einstellungen fest, nicht die Dateien.

::: details In den Desktop- und Mobil-Apps
- **Desktop-App:** **Herunterladen** speichert direkt in einen Ordner **Lolly** innerhalb Ihres Ordners **Downloads**, ohne Dialog. Eine Meldung bestätigt das Speichern und bietet **Anzeigen** an, um die Datei zu zeigen. **Open Exports Folder**, im Menü **Window** oder **Exports**, öffnet den Ordner jederzeit. Eine Datei mit demselben Namen wie eine frühere wird als "name (1)" gespeichert.
- **iPhone und iPad:** Die Datei wird in der App **Files** unter **Lolly** gespeichert, und das Teilen-Menü öffnet sich, damit Sie sie weiterschicken können.
- **Android:** Das Teilen-Menü öffnet sich, damit Sie wählen können, wohin die Datei geht.

Auf iPhone, iPad und Android ersetzt eine neue Datei eine frühere mit demselben Namen.
:::

## Zu einer früheren Version zurückkehren

- **Während dieses Besuchs:** **Rückgängig** geht durch Ihre letzten 100 Änderungen zurück, bis Sie das Tool verlassen oder neu laden. Siehe [Rückgängig und Wiederholen](/info/using.html#undo-and-redo).
- **In den neun Tools, die während der Arbeit speichern:** Frühere Versionen jeder Kreation werden aufbewahrt. Folgen Sie den Schritten unten.
- **Alles auf dem Gerät:** Bei eingeschalteter [Synchronisierung](/info/sync.html) bringt **Restore an earlier copy**, unter **Einstellungen → Verbundene Dienste**, eine der letzten sieben täglichen Kopien zurück, oder die Kopie von vor Ihrer letzten Anwendung. Alles auf diesem Gerät entspricht dann dieser Kopie, nicht nur ein Design.

So öffnen Sie eine frühere Version in einem der neun Tools:

1. Drücken Sie **History**, die Uhr-Schaltfläche neben **Rückgängig** und **Wiederholen**. In Design befindet sich **History** in der oberen Leiste; auf dem Smartphone drücken Sie **•••** und dann **History**.
2. Finden Sie die Version anhand ihres Datums und ihrer Uhrzeit. Zeilen mit **Automatic checkpoint** werden während der Arbeit erstellt; Zeilen mit **Saved version** sind die Zeitpunkte, zu denen Sie gespeichert haben.
3. Drücken Sie **Open as a copy**. Die Version öffnet sich als neue Kreation, und die geöffnete bleibt, wie sie war. Die Kopie ist in **Projekte**, mit "(copy)" nach ihrem Namen.

Um eine Version namentlich zu behalten, drücken Sie **Name version**, geben Sie einen Namen ein und drücken Sie **Keep milestone**. Benannte Versionen werden auf der Seite **History** unter **Milestones** aufgelistet.

::: details Das History-Panel und die History-Seite
Das **History**-Panel listet außerdem Zeilen mit **Recovered work** auf, und **Protected drafts** hält Ihre neuesten Änderungen zwischen Checkpoints, mit **Open draft as a copy**. **Compare** und **Check assets** helfen Ihnen bei der Wahl, bevor Sie eine Kopie öffnen. Schalten Sie **This creation** auf **All history on this device**, um jede Kreation zu sehen.

Automatische Checkpoints werden mit der Zeit ausgedünnt: einer pro Minute für die letzte Stunde, einer pro Stunde für den letzten Tag, einer pro Tag für 30 Tage, danach einer pro Woche. Gespeicherte Versionen werden alle behalten. Das Löschen einer Kreation über **Einstellungen → Speicher** löscht auch ihre Versionen.

Die Seite **History** (`#/history`, oder **Open app history** im Panel) deckt jede Kreation in diesem Browser ab. Öffnen Sie die Seite an einem Computer über die Uhr-Schaltfläche oben rechts auf dem Startbildschirm oder in **Projekte**. Gehen Sie auf einem Smartphone zur Tools-Galerie auf dem Startbildschirm, drücken Sie die runde Logo-Schaltfläche oben rechts und wählen Sie **Gespeicherte Sitzungen**, was History öffnet. Von **Projekte** aus tut dieses Element noch nichts.

- **Zuletzt verwendet** listet Ihre Kreationen, neueste zuerst, mit **Fortsetzen**.
- **Changes** stellt Checkpoints, Downloads und Convert-Ergebnisse auf eine Zeitleiste. Ein Download hat **Reopen settings**.
- **Milestones** listet benannte Versionen auf.

Filtern Sie nach Projekt, Tool und Datum (auf dem Smartphone hinter **Filters**). Die Seite History hat keine Löschen-Schaltfläche; um ein Element zu entfernen, nutzen Sie Projekte.
:::

## Arbeit auf ein anderes Gerät übertragen

| Um | Nutzen Sie |
|---|---|
| Ihre Geräte im Gleichschritt zu halten | **Synchronisierung zwischen Geräten**, unter **Einstellungen → Verbundene Dienste**: siehe [Geräte synchronisieren](/info/sync.html) |
| Alles einmal zu übertragen | **Meine Daten exportieren** und **Daten importieren…**, unten |
| Ein Design oder ein Projekt zu übergeben | Eine `.lolly`-Datei: **Export**, dann **Teilen**, dann **Download .lolly**; für ein ganzes Projekt **Download project (.lolly)** im Menü des Ordners. Drücken Sie **Öffnen** auf dem anderen Gerät. Siehe [Die .lolly-Datei](/info/using.html#the-lolly-file) |

Ein geteilter Link trägt Ihre Einstellungen, aber keine Bilder oder Dateien, die Sie von Ihrem Gerät hinzugefügt haben.

::: warning Der Import ersetzt Ihre Ordner
Wenn das andere Gerät bereits Arbeit enthält, lesen Sie dies zuerst. Der Import fügt hinzu, was die Datei enthält, aktualisiert übereinstimmende Elemente und löscht kein gespeichertes Element. Ihr Profil ist jedoch ein einzelner Datensatz, daher werden die Ordner, Favoriten, Vorlagen und Angaben auf diesem Gerät durch die aus der Datei ersetzt. Ein gespeichertes Element, das nur auf diesem Gerät war, bleibt erhalten, auf der obersten Ebene von **Projekte**. **Bring it to this device**, in Sync, tut dasselbe.
:::

So übertragen Sie alles einmal:

1. Öffnen Sie auf dem alten Gerät **Einstellungen → Speicher** und drücken Sie unter **Auf ein anderes Gerät verschieben** auf **Meine Daten exportieren**. Lolly lädt eine `.zip`-Datei herunter, deren Name mit `LollyTools-` beginnt.
2. Übertragen Sie die Datei per USB, E-Mail an sich selbst, AirDrop oder einen freigegebenen Ordner.
3. Öffnen Sie auf dem neuen Gerät **Einstellungen → Speicher**, drücken Sie **Daten importieren…**, wählen Sie die Datei und drücken Sie **Import**.

::: note Was zurückbleibt
Anmeldungen, Schlüssel und die Synchronisierungs-Passphrase bleiben auf jedem Gerät. Die Liste der letzten Downloads, Offline-Downloads und KI-Modelle reisen auf keinem Weg mit. Der Versionsverlauf reist nur in einer Datei von **Meine Daten exportieren**, nicht über Sync oder eine `.lolly`. Die Kopien, die Sync in Ihrem Speicherort ablegt, öffnen sich nur über Sync, nicht mit **Daten importieren…** oder **Öffnen**.
:::

::: details Was die Sicherungsdatei enthält
Die Datei heißt `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (die Namensteile stammen aus Ihrem Profil und entfallen, wenn nicht gesetzt; `<n>` ist ein Zähler pro Tag, damit Exporte am selben Tag nicht kollidieren). Sie enthält Ihr Profil mit Ihren Ordnern, dem Papierkorb, Vorlagen und Favoriten; jede gespeicherte Sitzung mit ihrem Thumbnail; Ihre hochgeladenen Bilder, Schriften, Logos und die Kopien Ihrer Downloads; Ihre Designsysteme; Ihre Einstellungen (Theme, Seitenleistenbreite, lokale Aktivitätsstatistiken); gespeicherte Versionen und Ergebnisse von Convert; und, aus der Web-App, den Versionsverlauf Ihrer Kreationen.

Der Katalog-Cache ist nicht enthalten - er lädt sich auf dem neuen Gerät von selbst neu herunter. Jeder Teil ist mit einer Prüfsumme versehen, sodass eine beim Transport beschädigte Datei beim Import erkannt wird, statt halb kaputt wiederhergestellt zu werden. Gespeicherte Sitzungen verknüpfen sich automatisch neu mit Ihren importierten Bildern. Die Web-, Desktop- und Mobil-Apps lesen dieselbe Datei; die Terminal-App schreibt eine eigene, einfachere Sicherung, die dieses Format nicht liest. **📦 Meine Daten exportieren & alles rendern** erzeugt dieselbe Datei plus ein zweites Zip mit jeder gespeicherten Sitzung, gerendert zu ihrer Ausgabe. (Vollständige Formatspezifikation: [Datenübertragung](/info/data-transfer.html).)
:::

## Wenn Sie Ihre Browserdaten löschen

In der Web-App bewahrt Lolly alles im Speicher Ihres Browsers für diese Seite auf: gespeicherte Arbeit, Bilder, Schriften, Designsysteme, Versionsverlauf und Offline-Downloads. Das Löschen der Daten dieser Seite in Ihrem Browser entfernt all das, und Lolly kann nichts davon zurückholen. Was bleibt, ist das, was den Browser bereits verlassen hat: Dateien, die Sie heruntergeladen haben, eine Datei von **Meine Daten exportieren**, eine Kopie von [Sync](/info/sync.html) und Links, die Sie geteilt haben.

::: warning Bevor Sie Browserdaten löschen
Drücken Sie **Meine Daten exportieren** unter **Einstellungen → Speicher**, und bewahren Sie die Datei anderswo auf.
:::

Beim Start der App bittet Lolly den Browser, seinen Speicher nicht zu löschen, wenn dem Gerät der Platz ausgeht. Der Browser entscheidet. Unter **Einstellungen → Offline verfügbar** bedeutet eine mit **Protected** beginnende Zeile, dass der Browser zugestimmt hat; "The browser may clear downloads if the device runs low on space" bedeutet, dass er es nicht getan hat, und **Downloads schützen** fragt erneut. Hat der Browser nicht zugestimmt, kann er bei knappem Speicherplatz sowohl gespeicherte Arbeit als auch Downloads löschen, bewahren Sie also eine aktuelle Datei von **Meine Daten exportieren** auf.

**Einstellungen → Speicher** zeigt, wie viel Platz jede Art von Daten belegt. **Cache leeren** verwirft heruntergeladene Katalogdateien, die bei Bedarf erneut heruntergeladen werden. **Alle meine Daten löschen** verlangt die Eingabe eines Wortes und entfernt dann Ihr Profil, gespeicherte Sitzungen, hochgeladene Bilder und den Asset-Cache. Andere Daten bleiben erhalten, einschließlich Versionsverlauf, der Liste der letzten Downloads, Convert-Ergebnissen, Designsystemen und heruntergeladenen KI-Modellen. Um alles zu entfernen, löschen Sie die Daten dieser Seite in Ihrem Browser.

![Die Speicherkarte auf einem schmalen Smartphone-Bildschirm: jede Kategorie der Daten auf dem Gerät benannt, unten die Schaltfläche Alle meine Daten löschen](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

In den Desktop- und Mobil-Apps sind gespeicherte Sitzungen Dateien im eigenen Datenordner der App, und der Rest liegt im eigenen Speicher der App, sodass das Löschen eines Webbrowsers sie nicht berührt.

::: details Wo die Desktop- und Mobil-Apps gespeicherte Sitzungen aufbewahren
Eine Datei pro gespeicherter Sitzung, in einem Ordner `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/`, oder derselbe Pfad unter `$XDG_DATA_HOME`
- iPhone, iPad und Android: im eigenen Speicher der App, den die App Files nicht anzeigt

Bilder, Designsysteme und die Liste der letzten Downloads bleiben im internen Speicher der App, nicht in diesen Ordnern. Die Terminal-App und die Kommandozeile lesen denselben Ordner `saved-state`: siehe [Wo gespeicherte Sitzungen liegen](/info/cli-reference.html#where-saved-sessions-live).
:::

## Etwas wiederbekommen, das Sie gelöscht haben

In **Projekte** hält **In den Papierkorb verschieben** ein Element für 30 Tage. Ein Ordner geht mit allem darin als ein Eintrag in den Papierkorb. Direkt danach bietet eine Meldung für etwa zehn Sekunden **Rückgängig** an. Später:

1. Öffnen Sie **Projekte** und drücken Sie die Kachel **Papierkorb**. Die Kachel erscheint nur, solange der Papierkorb etwas enthält.
2. Drücken Sie **Wiederherstellen** neben dem Element.

**Endgültig löschen** und **Papierkorb leeren** entfernen Elemente sofort, ohne nachzufragen. Elemente, die älter als 30 Tage sind, werden beim nächsten Öffnen von Projekte endgültig entfernt.

::: warning Andere Löschvorgänge sind endgültig
Das Löschen einer gespeicherten Sitzung unter **Einstellungen → Speicher**, oder aus der Liste gespeicherter Sitzungen eines Tools in der Galerie (Rechtsklick auf die Karte des Tools, dann **N gespeicherte Sitzungen**), entfernt die Sitzung endgültig, mitsamt ihrem Versionsverlauf. Ein Bild, das Sie aus **Meine Bilder** löschen, wird sofort entfernt, ohne nachzufragen.
:::

Bei eingeschalteter [Synchronisierung](/info/sync.html) kann **Restore an earlier copy** den Zustand des gesamten Geräts von einem früheren Tag zurückholen, und eine Datei von **Meine Daten exportieren** bringt zurück, was die Datei enthält.
