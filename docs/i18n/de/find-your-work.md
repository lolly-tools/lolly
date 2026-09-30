# Ihre Arbeit finden und wiederherstellen

Alles, was Sie in Lolly erstellen, bleibt in dem Browser oder der App, in der Sie es erstellt haben, auf diesem Gerät, sofern Sie nicht die [Synchronisierung](/info/sync.html) einschalten. Gespeicherte Arbeit ist in **Projekte**. Eine heruntergeladene Datei liegt dort, wo Ihr Browser oder System sie abgelegt hat, und eine Kopie wartet meist in **Assets**. In den meisten Tools wird auch nie gespeicherte Arbeit aufbewahrt. Diese Seite behandelt jeden dieser Fälle, dazu einen geschlossenen Tab, gelöschte Browserdaten, frühere Versionen, gelöschte Elemente und den Umzug auf ein anderes Gerät.

| Was Sie getan haben | Wo Sie nachsehen sollten |
|---|---|
| **Speichern unter** oder **Speichern** gedrückt | **Projekte** |
| **Herunterladen** gedrückt | Die Downloads Ihres Browsers, und eine Kopie in **Assets** |
| Weder noch, in einem [Tool, das während der Arbeit speichert](#which-tools-save-as-you-work) | **Projekte** und **Verlauf** |
| Weder noch, in einem Tool, das das nicht tut | Nur der Tab, in dem Sie gearbeitet haben, bis Sie ihn schließen |
| In der App gelöscht | **Papierkorb**, in **Projekte**, **Assets** oder **Einstellungen → Speicher**, für 30 Tage |

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

- **Sie haben den Tab geschlossen oder kommen ein anderes Mal zurück.** Nicht gespeicherte Arbeit ist weg, außer in den [Tools, die während der Arbeit speichern](#which-tools-save-as-you-work): Öffnen Sie diese Arbeit über **Projekte**.
- **Sie haben die Seite im selben Tab neu geladen.** Ihre Einstellungen kommen aus der Seitenadresse zurück. In Tools, die nicht während der Arbeit speichern, kommen Bilder und Dateien, die Sie von Ihrem Gerät hinzugefügt haben, sowie einzeiliger Text über 150 Zeichen nicht zurück, weil die Adresse sie nicht enthält.
- **Sie haben Start oder die Zurück-Schaltfläche oben links gedrückt.** Wenn Sie seit dem letzten Speichern, Herunterladen oder Kopieren etwas geändert haben, fragt ein Dialog **Nicht gespeicherte Änderungen**, ob zuerst gespeichert werden soll. **Speichern & verlassen** speichert die Arbeit und bringt Sie zu **Projekte**, oder zurück in den Projektordner, aus dem Sie die Arbeit geöffnet haben. **Verlassen ohne zu speichern** verwirft Ihre Änderungen: Ein gespeichertes Element kehrt zu dem Stand zurück, in dem Sie es zuletzt gespeichert haben, und eine nie gespeicherte Kreation verlässt **Projekte**. **Abbrechen** hält Sie im Tool.

Lolly fragt nur, wenn Sie **Start** oder die Zurück-Schaltfläche in einem Tool drücken. Das Schließen des Tabs, ein Neuladen und die eigene Zurück-Schaltfläche Ihres Browsers fragen nie. Um sicherzugehen, drücken Sie **Speichern unter** oder **Speichern** im Exportbereich, bevor Sie ein Tool verlassen.

::: note Versehentlich ohne Speichern verlassen?
In Tools, die während der Arbeit speichern, bewahrt der Verlauf eine Kopie der verworfenen Änderungen auf. Öffnen Sie die Seite **Verlauf**, finden Sie sie unter **Changes** und drücken Sie **Als Kopie öffnen**. In anderen Tools sind die Änderungen weg.
:::

::: details Welche Tools während der Arbeit speichern
In der Web-App speichert jedes Tool, das ein Dokument erstellt, während der Arbeit: Design, Chart, QR Code, Text, Sandbox und die übrigen. Diese Tools tun es nicht:

- Tools, die mit einer Datei arbeiten, die Sie mitbringen, wie Redact, Sign oder Convert Image, weil Lolly nie eine Kopie dieser Datei behält;
- Tools, die von Ihrer Kamera, Ihrem Mikrofon oder Bildschirm aufzeichnen, wie Record, Screen Capture und Voice Recorder;
- 3D und Darkroom, die eine eigene Datei entgegennehmen;
- ein Tool, bei dem es nichts zu ändern gibt, wie Countdown.

In den anderen Tools legt Ihre erste Änderung die Arbeit in **Projekte** ab, als hätten Sie gespeichert, und spätere Änderungen werden während der Arbeit gesichert, sobald das Tool mit dem Zeichnen fertig ist. Eine nicht gespeicherte Kreation bleibt also auch nach dem Schließen des Tabs in Projekte und öffnet sich mit als nicht gespeichert markierten Änderungen erneut. **Verlassen ohne zu speichern** verwirft sie weiterhin, und der Verlauf bewahrt eine Kopie der verworfenen Änderungen für 30 Tage auf. Das erneute Öffnen des Tools über den Startbildschirm beginnt eine neue Kreation; öffnen Sie die frühere aus Projekte.

Bei eingeschalteter [Synchronisierung](/info/sync.html) gelangt eine so abgelegte Kreation wie alles andere in Projekte auf Ihre anderen Geräte. Ihre Versionen bleiben auf dem Gerät, auf dem sie entstanden sind.

Ist eine Kreation in zwei Tabs geöffnet und Sie speichern in beiden, bleibt der letzte Speicherstand erhalten. Die ersetzte Arbeit geht dabei nicht verloren: Sie liegt unter **Geschützte Entwürfe** im Verlauf der Kreation, mit **Entwurf als Kopie öffnen**.

Dies funktioniert nur in der Web-App, nicht in den Desktop- oder Mobil-Apps, und nicht, während Sie live mit jemand anderem zusammenarbeiten.
:::

## Eine heruntergeladene Datei finden

In einem Browser übergibt **Herunterladen** die Datei an Ihren Browser, der sie in seinem Downloads-Ordner speichert (meist **Downloads**) oder Sie fragt, wo. Lolly erfährt nicht, wohin die Datei gegangen ist, schauen Sie also in der Downloadliste Ihres Browsers nach.

Wenn keine Datei erschienen ist, schauen Sie im Exportbereich nach, solange Sie noch im Tool sind. Unter **Herunterladen** gibt eine Zeile den Dateinamen und die Zeit an, mit **Retry download**, und in Chrome, Edge und anderen Chromium-Browsern **Save file…**, um selbst einen Ordner zu wählen. Die Zeile und ihre Datei bleiben bestehen, bis Sie das Tool verlassen, neu laden oder erneut exportieren.

Lolly behält außerdem zwei Dinge nach jedem Download:

- **Eine Kopie der Datei**, in **Assets** unter **Ihre Uploads**, solange **Meine Renderings in meiner Bibliothek speichern** unter **Einstellungen → Ihre Renderings** aktiviert ist (**Einstellungen** befindet sich am Fuß des Startbildschirms). Die Einstellung ist standardmäßig aktiviert. Ein Video oder eine Datei über 50 MB fragt zuerst nach, und ein Zip wird nicht kopiert.
- **Die von Ihnen verwendeten Einstellungen**, für Ihre letzten 24 Downloads. **Letzte Exporte**, unterhalb Ihrer gespeicherten Arbeit in **Projekte**, öffnet das Tool erneut mit diesen Einstellungen, damit Sie die Datei erneut erstellen können, wobei Bilder und Dateien, die Sie von Ihrem Gerät hinzugefügt haben, nicht enthalten sind. Dieselbe Liste finden Sie unter **Einstellungen → Aktivität & Statistiken → Neueste Exporte** und im Tab **Changes** von **History**. Diese Liste hält Einstellungen fest, nicht die Dateien.

::: details In den Desktop- und Mobil-Apps
- **Desktop-App:** **Herunterladen** speichert direkt in einen Ordner **Lolly** innerhalb Ihres Ordners **Downloads**, ohne Dialog. Die Zeile unter **Herunterladen** zeigt an, wohin die Datei gegangen ist, etwa "Saved to Downloads/Lolly", mit **Im Ordner anzeigen**. **Open Exports Folder**, im Menü **Fenster** oder **Exporte**, öffnet den Ordner jederzeit. Eine Datei mit demselben Namen wie eine frühere wird als "name (1)" gespeichert.
- **iPhone und iPad:** Die Datei wird in der App **Dateien** unter **Lolly** gespeichert, und das Teilen-Menü öffnet sich, damit Sie sie weiterschicken können. Die Zeile unter **Herunterladen** liest "Saved to Files → Lolly".
- **Android:** Das Teilen-Menü öffnet sich, damit Sie wählen können, wohin die Datei geht.

Auf iPhone, iPad und Android ersetzt eine neue Datei eine frühere mit demselben Namen.
:::

## Zu einer früheren Version zurückkehren

- **Während dieses Besuchs:** **Rückgängig** geht durch Ihre letzten 100 Änderungen zurück, bis Sie das Tool verlassen oder neu laden. Siehe [Rückgängig und Wiederholen](/info/using.html#undo-and-redo).
- **In [Tools, die während der Arbeit speichern](#which-tools-save-as-you-work):** Frühere Versionen jeder Kreation werden aufbewahrt. Folgen Sie den Schritten unten.
- **Alles auf dem Gerät:** Bei eingeschalteter [Synchronisierung](/info/sync.html) bringt **Restore an earlier copy**, unter **Einstellungen → Verbundene Dienste**, eine der letzten sieben täglichen Kopien zurück, oder die Kopie von vor Ihrer letzten Anwendung. Alles auf diesem Gerät entspricht dann dieser Kopie, nicht nur ein Design.

So öffnen Sie eine frühere Version:

1. Drücken Sie **Verlauf**, die Uhr-Schaltfläche neben **Rückgängig** und **Wiederholen**. In Design befindet sich **Verlauf** in der oberen Leiste; auf dem Smartphone drücken Sie **•••** und dann **Verlauf**. In Tools ohne **Rückgängig**, wie Text und Sandbox, befindet sich **Verlauf** oben links neben **Start**.
2. Finden Sie die Version anhand ihres Datums und ihrer Uhrzeit. Zeilen mit **Automatischer Checkpoint** werden während der Arbeit erstellt; Zeilen mit **Gespeicherte Version** sind die Zeitpunkte, zu denen Sie gespeichert haben.
3. Drücken Sie **Als Kopie öffnen**. Die Version öffnet sich als neue Kreation, und die geöffnete bleibt, wie sie war. Die Kopie ist in **Projekte**, mit "(copy)" nach ihrem Namen.

Um eine Version namentlich zu behalten, drücken Sie **Name version**, geben Sie einen Namen ein und drücken Sie **Keep milestone**. Benannte Versionen werden auf der Seite **History** unter **Milestones** aufgelistet.

::: details Das History-Panel und die History-Seite
Das **History**-Panel listet außerdem Zeilen mit **Recovered work** auf, und **Protected drafts** hält Ihre neuesten Änderungen zwischen Checkpoints, mit **Open draft as a copy**. **Compare** und **Check assets** helfen Ihnen bei der Wahl, bevor Sie eine Kopie öffnen. Schalten Sie **This creation** auf **All history on this device**, um jede Kreation zu sehen.

Automatische Checkpoints werden mit der Zeit ausgedünnt: einer pro Minute für die letzte Stunde, einer pro Stunde für den letzten Tag, einer pro Tag für 30 Tage, danach einer pro Woche. Gespeicherte Versionen und benannte Versionen werden alle behalten. Das Löschen einer Kreation verschiebt auch ihre Versionen in den **Papierkorb**, und **Endgültig löschen** entfernt sie.

Wenn der Speicher des Verlaufs voll wird, werden zuerst die ältesten automatischen Checkpoints von Kreationen entfernt, die Sie seit 30 Tagen nicht geöffnet haben. Ein Speicherstand bleibt dabei immer erhalten: Er wird als aktuelle Arbeit geschrieben, und der Verlauf vermerkt, dass dieser Speicherstand nicht als Version aufbewahrt wird. **Einstellungen → Speicher** zeigt, wie viel der Verlauf verbraucht.

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

::: note Der Import fügt hinzu und löscht nichts
Ordner, Favoriten und Vorlagen in der Datei werden neben den bereits auf dem anderen Gerät vorhandenen hinzugefügt. Ist ein gespeichertes Element auf beiden vorhanden, bleibt die zuletzt gespeicherte Kopie erhalten. Ihre Angaben und Einstellungen auf diesem Gerät bleiben, wie sie sind; leere werden aus der Datei aufgefüllt. **Auf dieses Gerät übernehmen**, in Sync, funktioniert genauso.
:::

So übertragen Sie alles einmal:

1. Öffnen Sie auf dem alten Gerät **Einstellungen → Speicher** und drücken Sie unter **Auf ein anderes Gerät verschieben** auf **Meine Daten exportieren**. Lolly lädt eine `.zip`-Datei herunter, deren Name mit `LollyTools-` beginnt.
2. Übertragen Sie die Datei per USB, E-Mail an sich selbst, AirDrop oder einen freigegebenen Ordner.
3. Öffnen Sie auf dem neuen Gerät **Einstellungen → Speicher**, drücken Sie **Daten importieren…**, wählen Sie die Datei und drücken Sie **Import**.

::: note Was zurückbleibt
Anmeldungen, Schlüssel und die Synchronisierungs-Passphrase bleiben auf jedem Gerät. Die Liste der letzten Downloads, Offline-Downloads und KI-Modelle reisen auf keinem Weg mit. Der Versionsverlauf reist nur in einer Datei von **Meine Daten exportieren**, nicht über Sync oder eine `.lolly`. Wenn der Verlauf zu groß für eine Datei ist, werden die ältesten automatischen Checkpoints ausgelassen, und die Export-Zeile nennt, wie viele. Eine Kopie, die Sync in Ihrem Speicher ablegt, kann heruntergeladen und geöffnet oder in **Daten importieren…** ausgewählt werden, wie eine Sicherungsdatei; eine verschlüsselte Kopie fragt nach Ihrer Passphrase.
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

**Einstellungen → Speicher** zeigt, wie viel Platz jede Art von Daten belegt. Die Zeile **Verlauf** zählt automatische Checkpoints, ihre Vorschauen und Wiederherstellungsentwürfe; **Automatische Checkpoints älter als 30 Tage entfernen** gibt diesen Platz frei und behält gespeicherte und benannte Versionen. **Cache leeren** verwirft heruntergeladene Katalogdateien, die bei Bedarf erneut heruntergeladen werden. **Alle meine Daten löschen** verlangt die Eingabe eines Wortes, schaltet Sync aus und entfernt dann alles, was Lolly in diesem Browser aufbewahrt: Ihr Profil und Ihre Einstellungen, gespeicherte Sitzungen mit ihrem Verlauf und dem Papierkorb, Uploads, Schriften und Designsysteme, das Download-Protokoll, Convert-Ergebnisse, heruntergeladene KI-Modelle und Offline-Kopien. Dateien, die Sie heruntergeladen haben, bleiben dort, wo Sie sie gespeichert haben. Die App startet danach wie bei einem ersten Besuch.

![Die Speicherkarte auf einem schmalen Smartphone-Bildschirm: jede Kategorie der Daten auf dem Gerät benannt, unten die Schaltfläche Alle meine Daten löschen](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

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

Das Löschen einer gespeicherten Sitzung, eines Ordners, eines Ihrer Uploads oder einer Ihrer Schriften in der App verschiebt es für 30 Tage in den **Papierkorb**, egal wo Sie es löschen: **Projekte**, **Assets**, **Einstellungen → Speicher** oder die Liste gespeicherter Sitzungen eines Tools. Ein Ordner geht mit allem darin als ein Eintrag mit. Eine Sitzung behält ihren Versionsverlauf, solange sie dort ist. Direkt danach bietet eine Meldung **Rückgängig** an. Später:

1. Öffnen Sie den **Papierkorb**: die Kachel **Papierkorb** in **Projekte**, die Schaltfläche **Papierkorb** in **Assets → Ihre Uploads**, oder die Zeile **Papierkorb** in **Einstellungen → Speicher**. Alle drei öffnen dieselbe Liste.
2. Drücken Sie **Wiederherstellen** neben dem Element. Es kehrt in seinen Ordner zurück, und eine Schrift erhält die Rollen zurück, die sie in ihrem Designsystem hatte.

**Endgültig löschen** entfernt ein einzelnes Element für immer. **Papierkorb leeren** fragt zuerst nach und entfernt dann jedes Element im Papierkorb. Elemente, die älter als 30 Tage sind, werden endgültig entfernt.

::: warning Manche Löschvorgänge sind sofort endgültig
Das Löschen eines Designsystems, eines Logos oder Ihres Profilfotos geht nicht in den Papierkorb. Die Kommandozeile und die Terminal-App löschen ebenfalls sofort.
:::

Bei eingeschalteter [Synchronisierung](/info/sync.html) kann **Restore an earlier copy** den Zustand des gesamten Geräts von einem früheren Tag zurückholen, und eine Datei von **Meine Daten exportieren** bringt zurück, was die Datei enthält.
