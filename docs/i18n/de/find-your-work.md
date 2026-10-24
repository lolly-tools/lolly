# Ihre Arbeit finden und wiederherstellen

Etwas fehlt: ein Design, das Sie nie gespeichert haben, eine Datei, die Sie heruntergeladen haben, die Version der letzten Woche oder alles, nachdem der Browser geleert wurde. Beginnen Sie mit der Tabelle und folgen Sie dann dem Abschnitt, auf den sie verweist.

Persönliche Arbeit bleibt in dem Browser oder der App, in der Sie sie erstellt haben, auf diesem Gerät, sofern Sie nicht [Sync](/info/sync.html) einschalten. Eine Organisation, die optional Lolly Work nutzt, hält außerdem **Team projects** auf ihrem Server, unten behandelt.

| Was Sie getan haben | Wo Sie nachsehen sollten |
|---|---|
| **Speichern unter** oder **Speichern** gedrückt | **Projekte** |
| **Herunterladen** gedrückt | Die Downloads Ihres Browsers, und eine Kopie in **Assets** |
| Weder noch, in einem [Tool, das während der Arbeit speichert](#which-tools-save-as-you-work) | **Projekte** und **Verlauf** |
| Weder noch, in einem Tool, das das nicht tut | Nur der Tab, in dem Sie gearbeitet haben, bis Sie ihn schließen |
| In der App gelöscht | **Papierkorb**, in **Projekte**, **Assets** oder **Einstellungen → Speicher**, für 30 Tage |

::: figure find-your-work-places
Wo Ihre Arbeit liegt: Der eigene Speicher des Browsers enthält Projects, History und Trash; Downloads gehen in die Ordner Ihres Geräts; Sync und eine Backup-Datei sind die Kopien außerhalb des Browsers.
:::

::: details Gemeinsame Arbeit in Lolly Work finden (optional)
Öffnen Sie das Lolly Ihrer Organisation und melden Sie sich an, und schauen Sie dann in **Projects → Team projects**. Gemeinsame Sitzungen werden von dieser Instanz gehalten und erscheinen entsprechend Ihrem Zugriff. Die Anmeldung kann den Zugriff auf diese Sitzungen auf einem anderen Gerät wiederherstellen; Ihre persönliche Bibliothek oder das Geräte-Backup stellt sie nicht wieder her.

Warten Sie in einer [Work-Collab](/info/collaborate.html#work-collabs-with-lolly-work-optional) auf **Saved to work**, bevor Sie gehen. Fehlt ein gemeinsames Projekt, prüfen Sie, ob Sie mit der richtigen Instanz verbunden sind, und fragen Sie deren Betreiber nach Zugriff oder Aufbewahrung. Das Löschen der Browserdaten entfernt lokale Kopien, nicht die Serverkopie der Organisation. Siehe [Lolly in Ihrer Organisation nutzen](/info/organisation.html).
:::

## Etwas finden, das Sie gespeichert haben

1. Drücken Sie oben links im Tool auf **Start**.
2. Öffnen Sie den Tab **Projekte** oben auf dem Startbildschirm (auf dem Smartphone ein Ordnersymbol).
3. Schauen Sie auf den ersten Bildschirm. In **Meine Bibliothek** gespeicherte Arbeit liegt dort, und jedes Projekt ist ein Ordner. Um alle Ordner auf einmal zu durchsuchen, tippen Sie unten am Bildschirm in **Alle Projekte durchsuchen …**.

Ein Element trägt den Dateinamen, den Sie im Export-Panel eingetippt haben, oder, wenn Sie keinen eingetippt haben, den seines Tools, etwa **QR Code**. Öffnen Sie das Element, und jede Einstellung ist wieder da, bereit zur Änderung und zum erneuten Export. Um neue Arbeit so zu behalten, siehe [Speichern und Weitermachen](/info/using.html#saving-continuing).

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

- <!--i:folder--> **Ordner, die sich verschachteln.** Gruppieren Sie gespeicherte Sitzungen in Ordnern und Ordner in Ordnern, so tief Sie wollen. Legen Sie einen Ordner an, benennen Sie ihn um oder ziehen Sie eine Kachel auf einen anderen Ordner, um sie zu verschieben; ein Brotkrumenpfad führt Sie wieder hinauf. Sitzungen, die ohne Ordner gespeichert wurden, erscheinen direkt im Stamm von **Projects**.
- <!--i:clock--> **Nach Ihrer Art sortieren.** **View options**, die Schieberegler-Schaltfläche oben rechts, bietet **Grid** oder **List** und sortiert nach **Name**, **Date added**, **Last modified** (der Standard), **Size** und, innerhalb eines Ordners, **By tool**. Ordner stehen immer zuerst, egal welche Sortierung aktiv ist - die Sortierung ordnet nur die Sitzungen und Ordner innerhalb ihrer eigenen Gruppe.
- <!--i:document--> **Neue Arbeit direkt ablegen.** **New asset** öffnet die gemeinsame Auswahl. Wählen Sie **Templates**, um mit einer gespeicherten Vorlage zu beginnen: Öffnen Sie sie zum Bearbeiten oder nutzen Sie **+ Add**, um eine neue Kreation sofort zu speichern.
- <!--i:checklist--> **Mehrfachauswahl (Desktop).** Kreuzen Sie das Kästchen einer Kachel an, ziehen Sie ein Auswahlrechteck über leeren Raum oder klicken Sie mit **Umschalt/Cmd**; **klicken Sie mit der rechten Maustaste** auf eine Kachel für ihr Kontextmenü. Die Auswahlleiste bietet dann **Render selection**, **Move to…**, **New folder**, **Delete** (das in den Papierkorb verschiebt), **Edit together** für zwei bis acht Sitzungen desselben Tools, nebeneinander unter einer Seitenleiste, und **Edit as sheet**, das eine Auswahl beliebiger Größe oder Mischung als Zeilen im Batch-Raster öffnet.
- <!--i:download--> **Einen ganzen Ordner oder eine Auswahl rendern.** **Render folder** exportiert jede gespeicherte Sitzung in einem Ordner - einschließlich seiner Unterordner - als ein verschachteltes `.zip`. **Render selection** tut dasselbe für jede Mehrfachauswahl, und eine einzelne Sitzung rendert direkt in ihre eigene Datei.
- <!--i:link--> **Direkt zur gespeicherten Arbeit eines Tools springen.** Kreuzen Sie in der Tools-Galerie ein oder mehrere Tools an und wählen Sie in der Auswahlleiste **View sessions** - Projects öffnet sich und zeigt nur die Sitzungen, die mit diesen Tools erstellt wurden, mit einem **Clear**, um zur vollen Ansicht zurückzukehren.
- <!--i:link--> **Eine gespeicherte Sitzung teilen.** Klicken Sie mit der rechten Maustaste auf eine Sitzung (auf einem Smartphone drücken Sie **•••** auf ihrer Kachel) → **Share link**, um einen Link zu kopieren, der sie mit denselben Einstellungen wieder öffnet; Bilder von Ihrem Gerät reisen nicht mit einem Link (der volle Share-Dialog: siehe [Ihre Arbeit teilen](/info/using.html#sharing-your-work)).
- <!--i:pentool--> **Eine umbenennen oder kopieren.** Klicken Sie mit der rechten Maustaste auf eine Sitzung (auf einem Smartphone drücken Sie **•••** auf ihrer Kachel) für **Rename**, **Duplicate** (eine Kopie im selben Ordner) und **Move to…**.

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

- **Sie haben den Tab geschlossen oder sind ein andermal zurückgekommen.** Ungespeicherte Arbeit ist weg, außer in den [Tools, die während der Arbeit speichern](#which-tools-save-as-you-work): Öffnen Sie diese Arbeit aus **Projects**.
- **Sie haben die Seite im selben Tab neu geladen.** Ihre Einstellungen kommen aus der Seitenadresse zurück. In Tools, die nicht während der Arbeit speichern, kommen Bilder und Dateien, die Sie von Ihrem Gerät hinzugefügt haben, und einzeiliger Text über 150 Zeichen nicht zurück, weil die Adresse sie nicht enthält.
- **Sie haben Home oder die Zurück-Schaltfläche oben links gedrückt.** Wenn Sie seit dem letzten Speichern, Herunterladen oder Kopieren etwas geändert haben, fragt ein Dialog **Unsaved edits**, ob Sie zuerst speichern wollen. **Save & leave** speichert die Arbeit und bringt Sie zu **Projects** oder zurück in den Projektordner, aus dem Sie die Arbeit geöffnet haben. **Leave anyway** verwirft Ihre Änderungen: Ein gespeichertes Element geht zurück auf den Stand Ihres letzten Speicherns, und eine Kreation, die Sie nie gespeichert haben, verlässt **Projects**. **Cancel** hält Sie im Tool.

Lolly fragt nur, wenn Sie **Start** oder die Zurück-Schaltfläche in einem Tool drücken. Das Schließen des Tabs, ein Neuladen und die eigene Zurück-Schaltfläche Ihres Browsers fragen nie. Um sicherzugehen, drücken Sie **Speichern unter** oder **Speichern** im Exportbereich, bevor Sie ein Tool verlassen.

Ist die automatische Wiederherstellung nicht verfügbar, sagt ein Hinweis neben den Bearbeitungssteuerelementen, was Sie behalten sollten:

- Speichern Sie in einem Tool, das mit einer von Ihnen mitgebrachten Datei arbeitet, Ihre Einstellungen und behalten Sie auch die Originaldateien.
- Speichern oder laden Sie in einem Aufnahme-Tool oder einem Utility ohne Aktion Save das Ergebnis herunter, bevor Sie gehen.
- Die Desktop- und Mobil-Apps sagen, wann Sie von Hand speichern müssen.
- In einer privaten Zusammenarbeit behält die Person, die eingeladen hat, das Dokument und seinen Verlauf, einschließlich der Änderungen der anderen Person. Die Person, die beigetreten ist, arbeitet an einer temporären Kopie und sollte eine getrennte Kopie speichern, bevor die Sitzung endet.

::: note Versehentlich ohne Speichern verlassen?
In Tools, die während der Arbeit speichern, bewahrt der Verlauf eine Kopie der verworfenen Änderungen auf. Öffnen Sie die Seite **Verlauf**, finden Sie sie unter **Changes** und drücken Sie **Als Kopie öffnen**. In anderen Tools sind die Änderungen weg.
:::

::: details Welche Tools während der Arbeit speichern
In der Web-App speichert jedes Tool, das ein Dokument erstellt, während der Arbeit: Design, Chart, QR Code, Text, Sandbox und die übrigen. Diese Tools tun es nicht:

- Tools, die mit einer von Ihnen mitgebrachten Datei arbeiten, etwa Redact, Sign oder Convert Image, weil Lolly nie eine Kopie dieser Datei behält;
- Tools, die von Ihrer Kamera, Ihrem Mikrofon oder Bildschirm aufnehmen, etwa Record, Screen Capture und Voice Recorder;
- ein Tool, in dem es nichts zu ändern gibt, etwa Countdown.

In den anderen Tools legt Ihre erste Änderung die Arbeit in **Projects** ab, als hätten Sie gespeichert, und spätere Änderungen werden während der Arbeit behalten, sobald das Tool fertig gezeichnet hat. Eine ungespeicherte Kreation ist nach dem Schließen des Tabs weiterhin in Projects und öffnet sich wieder mit ihren als ungespeichert markierten Änderungen.

**Leave anyway** verwirft diese Änderungen weiterhin, und History behält 30 Tage lang eine Kopie der verworfenen Änderungen. Wenn Sie das Tool erneut vom Startbildschirm öffnen, beginnt eine neue Kreation; öffnen Sie die frühere aus Projects.

3D und Darkroom speichern während der Arbeit, behalten aber keine Datei, die Sie in sie laden, etwa ein 3D-Modell oder eine LUT. History und **Save** behalten Name, Typ und Größe der Datei, nicht die Datei. Wenn Sie die Arbeit wieder öffnen, sagt ein Hinweis, welche Datei es war, und das Tool arbeitet ohne sie, bis Sie sie erneut laden. Behalten Sie Ihre Originaldateien.

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

Die Seite **History** (`#/history`) umfasst jede Kreation in diesem Browser. Um sie zu öffnen, drücken Sie oben rechts auf dem Startbildschirm oder in **Projects** die Uhr-Schaltfläche, wählen im Profilmenü **Saved sessions** (auf einem Smartphone die runde Logo-Schaltfläche oben rechts) oder drücken im History-Panel eines Tools **Open app history**. Die Desktop- und Mobil-Apps haben keine History-Seite; dort öffnen die Uhr-Schaltfläche des Startbildschirms und **Saved sessions** stattdessen **Your recent work**: Ihre neuesten gespeicherten Sitzungen und Exporte, mit einem Link zu Projects.

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

Der Katalog-Cache ist nicht enthalten - er lädt sich auf dem neuen Gerät selbst neu. Jeder Teil hat eine Prüfsumme, sodass eine beim Transport beschädigte Datei beim Import erkannt wird, statt halb defekt wiederhergestellt zu werden. Gespeicherte Sitzungen verknüpfen sich automatisch wieder mit Ihren importierten Bildern. Die Web-, Desktop- und Mobil-Apps lesen dieselbe Datei; die Terminal-App schreibt ein eigenes einfacheres Backup, das dieses Format nicht liest. **Export my data & render everything** erzeugt dieselbe Datei plus ein zweites Zip, in dem jede gespeicherte Sitzung zu ihrer Ausgabe gerendert ist. (Vollständige Formatspezifikation: [Datenübertragung](/info/data-transfer.html).)
:::

## Wenn Sie Ihre Browserdaten löschen

In der Web-App bewahrt Lolly alles im Speicher Ihres Browsers für diese Seite auf: gespeicherte Arbeit, Bilder, Schriften, Designsysteme, Versionsverlauf und Offline-Downloads. Das Löschen der Daten dieser Seite in Ihrem Browser entfernt all das, und Lolly kann nichts davon zurückholen. Was bleibt, ist das, was den Browser bereits verlassen hat: Dateien, die Sie heruntergeladen haben, eine Datei von **Meine Daten exportieren**, eine Kopie von [Sync](/info/sync.html) und Links, die Sie geteilt haben.

::: warning Bevor Sie Browserdaten löschen
Drücken Sie **Meine Daten exportieren** unter **Einstellungen → Speicher**, und bewahren Sie die Datei anderswo auf.
:::

Beim Start der App bittet Lolly den Browser, seinen Speicher nicht zu leeren, wenn dem Gerät der Platz knapp wird, und der Browser entscheidet. Unter **Settings → Available offline** bedeutet eine Zeile, die mit **Protected** beginnt, dass der Browser zugestimmt hat. "The browser may clear downloads if the device runs low on space" bedeutet, dass er es nicht getan hat, und **Protect downloads** fragt erneut.

Hat der Browser nicht zugestimmt, kann er bei knappem Platz neben Downloads auch gespeicherte Arbeit löschen; behalten Sie also eine aktuelle Datei von **Export my data**.

**Einstellungen → Speicher** zeigt, wie viel Platz jede Art von Daten belegt. Die Zeile **Verlauf** zählt automatische Checkpoints, ihre Vorschauen und Wiederherstellungsentwürfe; **Automatische Checkpoints älter als 30 Tage entfernen** gibt diesen Platz frei und behält gespeicherte und benannte Versionen. **Cache leeren** verwirft heruntergeladene Katalogdateien, die bei Bedarf erneut heruntergeladen werden. **Alle meine Daten löschen** verlangt die Eingabe eines Wortes, schaltet Sync aus und entfernt dann alles, was Lolly in diesem Browser aufbewahrt: Ihr Profil und Ihre Einstellungen, gespeicherte Sitzungen mit ihrem Verlauf und dem Papierkorb, Uploads, Schriften und Designsysteme, das Download-Protokoll, Convert-Ergebnisse, heruntergeladene KI-Modelle und Offline-Kopien. Dateien, die Sie heruntergeladen haben, bleiben dort, wo Sie sie gespeichert haben. Die App startet danach wie bei einem ersten Besuch.

![Die Speicherkarte auf einem Bildschirm in Smartphone-Breite: jede Kategorie von Daten auf dem Gerät ist benannt, unten die Schaltfläche Clear all my data](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

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
