# Ihre Arbeit finden und wiederherstellen

Finden Sie ein nie gespeichertes Design, eine heruntergeladene Datei, die Version von letzter Woche oder Ihre Arbeit nach dem Löschen der Browserdaten. Beginnen Sie mit der Tabelle.

Persönliche Arbeit bleibt in dem Browser oder der App, in dem oder der Sie sie erstellt haben, auf diesem Gerät, sofern Sie [Sync](/info/sync.html) nicht aktivieren. Eine Organisation, die das optionale Lolly Work nutzt, hält außerdem **Team projects** auf ihrem Server vor.

| Was Sie getan haben | Wo Sie suchen |
|---|---|
| **Save as** oder **Save** gedrückt | **Projects** |
| **Download** gedrückt | Die Downloads Ihres Browsers und eine Kopie in **Assets** |
| Keines von beiden, in einem [Tool, das während der Arbeit speichert](#which-tools-save-as-you-work) | **Projects** und **History** |
| Keines von beiden, in einem Tool, das dies nicht tut | Nur der Tab, in dem Sie gearbeitet haben, bis Sie ihn schließen |
| In der App gelöscht | **Trash**, in **Projects**, **Assets** oder **Settings → Storage**, für 30 Tage |

::: figure find-your-work-places
Wo Ihre Arbeit liegt: Der Speicher des Browsers enthält Projects, History und Trash; Downloads landen in den Ordnern Ihres Geräts; Sync und eine Sicherungsdatei sind die Kopien außerhalb des Browsers.
:::

::: details Geteilte Arbeit in Lolly Work finden (optional)
Öffnen Sie das Lolly Ihrer Organisation, melden Sie sich an und sehen Sie unter **Projects → Team projects** nach. Diese Instanz enthält geteilte Sitzungen und zeigt diejenigen, auf die Sie Zugriff haben. Die Anmeldung auf einem anderen Gerät kann den Zugriff auf diese Sitzungen wiederherstellen. Sie stellt weder Ihre persönliche Bibliothek noch Ihre Gerätesicherung wieder her.

Warten Sie bei einer [Zusammenarbeit über Lolly Work](/info/collaborate.html#collabs-through-lolly-work-optional) vor dem Verlassen auf **Saved to work**. Wenn ein geteiltes Projekt fehlt, prüfen Sie, ob Sie mit der richtigen Instanz verbunden sind, und fragen Sie deren Betreiber nach Zugriff oder Aufbewahrung. Das Löschen der Browserdaten entfernt lokale Kopien, nicht die Serverkopie der Organisation. Siehe [Lolly in Ihrer Organisation verwenden](/info/organisation.html).
:::

<!--i:eti-search-->
## Etwas Gespeichertes finden

1. Drücken Sie oben links im Tool auf **Home**.
2. Öffnen Sie den Tab **Projects** oben auf dem Startbildschirm (auf einem Smartphone das Ordnersymbol).
3. Alles, was Sie in **My library** gespeichert haben, liegt auf dem ersten Bildschirm. Jedes Projekt ist ein Ordner. Um alle Ordner zu durchsuchen, geben Sie unten auf dem Bildschirm etwas in **Search all projects…** ein.

Ein Element erhält den Dateinamen, den Sie im Export-Panel eingegeben haben. Ohne Dateinamen erhält es den Namen seines Tools, etwa **QR Code**. Wenn Sie das Element öffnen, werden alle Einstellungen wiederhergestellt. Zum Speichern neuer Arbeit siehe [Speichern & Fortsetzen](/info/using.html#saving-continuing).

::: note Nicht in Projects?
- Vielleicht liegt es in **Trash**: siehe [Etwas Gelöschtes zurückholen](#get-back-something-you-deleted).
- Ein anderer Browser, ein privates Fenster oder ein anderes Gerät beginnt leer, sofern Sie nicht [Sync](/info/sync.html) verwenden oder [Ihre Arbeit übertragen](#move-your-work-to-another-device).
- Wenn Sie nur **Download** gedrückt haben, siehe [Eine heruntergeladene Datei finden](#find-a-file-you-downloaded).
:::

::: details Mit Projects arbeiten
Sie können die Ansicht **Projects** auch über **Settings → Storage → Saved sessions → Organise in Projects** öffnen. Sie funktioniert wie ein Dateimanager:

![Projects, bevor etwas gespeichert wurde: die Kacheln New folder, New asset und Templates, die History-Uhr oben rechts und die Leiste Search all projects am unteren Rand](/t/url-shot?url=%2F%23%2Fp&width=1440&height=900&dpi=192&waitMs=1200&walker=1&format=svg&localize=1&dark=1&filename=projects)
<!--
SHOT NOTE (projects): build-docs-shots.ts gives every shot a fresh browser
context with no storage seeding, so this frame is always the empty Projects
root. The alt says so. Revisit (and re-caption) if the pipeline gains a
storage-seeding hook.
-->

- <!--i:folder--> **Verschachtelte Ordner.** Legen Sie gespeicherte Sitzungen in Ordnern ab und Ordner in weiteren Ordnern, beliebig tief. Erstellen Sie einen Ordner, benennen Sie ihn um oder ziehen Sie eine Kachel auf einen Ordner, um sie zu verschieben. Eine Pfadnavigation führt Sie wieder nach oben. Ohne Ordner gespeicherte Sitzungen liegen auf der obersten Ebene von **Projects**.
- <!--i:clock--> **Nach Ihren Wünschen sortieren.** **View options**, die Schaltfläche mit den Schiebereglern oben rechts, bietet **Grid** oder **List** und sortiert nach **Name**, **Date added**, **Last modified** (Standard), **Size** und innerhalb eines Ordners nach **By tool**. Ordner stehen immer zuerst. Sitzungen und Ordner werden jeweils innerhalb ihrer eigenen Gruppe sortiert.
- <!--i:document--> **Neue Arbeit direkt ablegen.** **New asset** öffnet die gemeinsame Auswahl. Wählen Sie **Templates**, um mit einer gespeicherten Vorlage zu beginnen. Öffnen Sie die Vorlage zum Bearbeiten oder drücken Sie **+ Add**, um ein neues Werk sofort zu speichern.
- <!--i:checklist--> **Mehrfachauswahl (Desktop).** Aktivieren Sie das Kontrollkästchen einer Kachel, ziehen Sie einen Auswahlrahmen über eine freie Fläche oder verwenden Sie **Umschalt/Cmd-Klick**. Öffnen Sie das Kontextmenü einer Kachel mit einem **Rechtsklick** darauf. Die Auswahlleiste bietet **Render selection**, **Move to…**, **New folder** und **Delete** (in Trash). Ihr **Edit together** öffnet zwei bis acht Sitzungen mit jeweils einem Tool nebeneinander unter einer gemeinsamen Seitenleiste. **Edit as sheet** öffnet eine beliebig große oder gemischte Auswahl als Zeilen im Raster für die Stapelverarbeitung.
- <!--i:download--> **Einen ganzen Ordner oder eine Auswahl rendern.** **Render folder** exportiert jede gespeicherte Sitzung in einem Ordner und seinen Unterordnern als eine verschachtelte `.zip`. **Render selection** tut dasselbe für eine Mehrfachauswahl. Eine einzelne Sitzung wird als eigene Datei gerendert.
- <!--i:link--> **Direkt zur gespeicherten Arbeit eines Tools springen.** Wählen Sie in der Tools-Galerie ein oder mehrere Tools aus und dann **View sessions** in der Auswahlleiste. Projects zeigt daraufhin nur die Sitzungen, die mit diesen Tools erstellt wurden. **Clear** stellt die vollständige Ansicht wieder her.
- <!--i:link--> **Eine gespeicherte Sitzung teilen.** Klicken Sie mit der rechten Maustaste auf eine Sitzung (auf einem Smartphone drücken Sie **•••** auf ihrer Kachel) und wählen Sie **Share link**. Der Link öffnet die Sitzung wieder mit denselben Einstellungen. Bilder von Ihrem Gerät werden mit einem Link nicht mitgegeben. Zum vollständigen Share-Dialog siehe [Ihre Arbeit teilen](/info/using.html#sharing-your-work).
- <!--i:pentool--> **Umbenennen oder kopieren.** Dasselbe Menü enthält **Rename**, **Duplicate** (eine Kopie im selben Ordner) und **Move to…**.

![Das Popover View options in Projects: Layout mit Grid und List sowie Sort by mit der Einstellung Last modified neben einer Schaltfläche zum Umkehren der Reihenfolge](/t/url-shot?url=%2F%23%2Fp&width=900&height=700&dpi=192&waitMs=1400&drive=click%3A.projects-viewopts&cropSelector=.projects-viewmenu&walker=1&format=svg&dark=1&filename=misc-projects-sort)
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

<!--i:eti-refresh-->
## Wenn Sie den Tab geschlossen oder das Tool verlassen haben

Was wiederhergestellt wird, hängt davon ab, wie Sie das Tool verlassen haben und welches Tool es ist:

- **Sie haben den Tab geschlossen oder sind später zurückgekehrt.** Ungespeicherte Arbeit ist verloren, außer in den [Tools, die während der Arbeit speichern](#which-tools-save-as-you-work). Öffnen Sie diese Arbeit über **Projects**.
- **Sie haben die Seite im selben Tab neu geladen.** Ihre Einstellungen werden aus der Seitenadresse wiederhergestellt. Bei Tools, die nicht während der Arbeit speichern, enthält die Adresse keine Bilder und Dateien von Ihrem Gerät und keinen einzeiligen Text mit mehr als 150 Zeichen; diese werden daher nicht wiederhergestellt.
- **Sie haben Home oder die Zurück-Schaltfläche oben links gedrückt.** Wenn Sie seit dem letzten Speichern, Herunterladen oder Kopieren etwas geändert haben, fragt der Dialog **Unsaved edits**, ob Sie zuerst speichern möchten. **Save & leave** speichert die Arbeit und bringt Sie zu **Projects** oder zurück zum Projektordner, aus dem Sie die Arbeit geöffnet haben. **Leave anyway** verwirft Ihre Änderungen. Ein gespeichertes Element kehrt zum letzten gespeicherten Stand zurück, und ein nie gespeichertes Werk wird aus **Projects** entfernt. **Cancel** lässt Sie im Tool bleiben.

::: warning Beim Schließen des Tabs wird nicht nachgefragt
Das Schließen des Tabs, das Neuladen und die Zurück-Schaltfläche Ihres Browsers fragen nie nach. Drücken Sie zur Sicherheit **Save as** oder **Save** im Export-Panel, bevor Sie ein Tool verlassen.
:::

Wenn die automatische Wiederherstellung nicht verfügbar ist, steht neben den Steuerelementen zum Bearbeiten, was Sie aufbewahren sollten:

- Speichern Sie in einem Tool, das eine von Ihnen mitgebrachte Datei bearbeitet, Ihre Einstellungen und behalten Sie auch die Originaldateien.
- Speichern oder laden Sie in einem Aufnahme-Tool oder einem Utility ohne Save-Aktion das Ergebnis herunter, bevor Sie es verlassen.
- Die Desktop- und Mobil-Apps zeigen an, wann Sie von Hand speichern müssen.
- Bei einer privaten Zusammenarbeit behält die einladende Person das Dokument und seinen Verlauf, einschließlich der Änderungen der anderen Person. Die beigetretene Person arbeitet an einer temporären Kopie und sollte vor dem Ende der Sitzung eine separate Kopie speichern.

::: note Versehentlich ohne Speichern verlassen?
In Tools, die während der Arbeit speichern, behält History 30 Tage lang eine Kopie der verworfenen Änderungen. Öffnen Sie die Seite **History**, suchen Sie sie unter **Changes** und drücken Sie **Open as a copy**. In anderen Tools sind die Änderungen verloren.
:::

::: details Welche Tools während der Arbeit speichern
In der Web-App speichert jedes Tool, das ein Dokument erstellt, während der Arbeit, etwa Lolly Design, Lolly Chart, QR Code, Text und Lolly Sandbox. Diese Tools tun es nicht:

- Tools, die eine von Ihnen mitgebrachte Datei bearbeiten, etwa Redact, Sign oder Convert Image, weil Lolly nie eine Kopie dieser Datei behält;
- Tools, die von Ihrer Kamera, Ihrem Mikrofon oder Ihrem Bildschirm aufnehmen, etwa Record, Lolly Screen Capture und Lolly Voice Recorder;
- ein Tool, bei dem sich nichts ändern lässt, etwa Countdown.

In den anderen Tools legt Ihre erste Änderung die Arbeit in **Projects** ab, als hätten Sie sie gespeichert. Spätere Änderungen werden behalten, sobald das Tool fertig gezeichnet hat. Ein ungespeichertes Werk bleibt nach dem Schließen des Tabs in Projects und wird mit seinen als ungespeichert markierten Änderungen wieder geöffnet.

**Leave anyway** verwirft diese Änderungen weiterhin. Wenn Sie das Tool erneut vom Startbildschirm aus öffnen, beginnen Sie ein neues Werk; öffnen Sie das frühere über Projects.

3D und Lolly Darkroom speichern während der Arbeit, behalten aber keine Datei, die Sie darin laden, etwa ein 3D-Modell oder eine LUT. History und **Save** behalten Namen, Typ und Größe der Datei, nicht die Datei selbst. Wenn Sie die Arbeit wieder öffnen, nennt ein Hinweis die Datei, und das Tool arbeitet ohne sie, bis Sie sie erneut laden. Bewahren Sie Ihre Originaldateien auf.

Wenn [Sync](/info/sync.html) aktiviert ist, wird ein so abgelegtes Werk auf Ihre anderen Geräte übertragen. Seine Versionen bleiben auf dem Gerät, auf dem sie erstellt wurden.

Wenn ein Werk in zwei Tabs geöffnet ist und Sie in beiden speichern, bleibt der zuletzt gespeicherte Stand erhalten. Die ersetzte Arbeit liegt unter **Protected drafts** in der History des Werks, mit **Open draft as a copy**.

Das funktioniert nur in der Web-App, nicht in den Desktop- oder Mobil-Apps und nicht, während Sie live mit jemand anderem zusammenarbeiten.
:::

<!--i:eti-download-->
## Eine heruntergeladene Datei finden

In einem Browser übergibt **Download** die Datei an Ihren Browser. Der Browser speichert sie in seinem Download-Ordner (meist **Downloads**) oder fragt Sie nach dem Ort. Lolly erfährt nicht, wo die Datei abgelegt wurde; sehen Sie daher in der Download-Liste Ihres Browsers nach.

Wenn keine Datei erschienen ist, sehen Sie im Export-Panel nach, solange Sie noch im Tool sind. Unter **Download** nennt eine Zeile den Dateinamen und die Uhrzeit, zusammen mit **Retry download**. In Chrome, Edge und anderen Chromium-Browsern bietet die Zeile außerdem **Save file…**, um einen Ordner auszuwählen. Die Zeile und ihre Datei bleiben erhalten, bis Sie das Tool verlassen, neu laden oder erneut exportieren.

Lolly behält nach jedem Download außerdem zwei Dinge:

- **Eine Kopie der Datei**, in **Assets** unter **Your uploads**, solange **Save my renders to my library** unter **Settings → Your renders** aktiviert ist (**Settings** liegt unten auf dem Startbildschirm). Die Einstellung ist anfangs aktiviert. Bei einem Video oder einer Datei über 50 MB wird zuerst nachgefragt; eine ZIP-Datei wird nicht kopiert.
- **Die verwendeten Einstellungen**, für Ihre letzten 24 Downloads. **Recent exports**, unter Ihrer gespeicherten Arbeit in **Projects**, öffnet das Tool wieder mit diesen Einstellungen. Bilder und Dateien, die Sie von Ihrem Gerät hinzugefügt haben, sind nicht enthalten. Dieselbe Liste finden Sie unter **Settings → Activity & stats → Latest exports** und auf dem Tab **Changes** in **History**.

::: details In den Desktop- und Mobil-Apps
- **Desktop-App:** **Download** speichert ohne Dialog in einem Ordner **Lolly** innerhalb Ihres Ordners **Downloads**. Die Zeile unter **Download** zeigt den Speicherort, etwa „Saved to Downloads/Lolly“, mit **Show in folder**. **Open Exports Folder** im Menü **Window** oder **Exports** öffnet den Ordner jederzeit. Eine Datei mit demselben Namen wie eine frühere wird als „name (1)“ gespeichert.
- **iPhone und iPad:** Die Datei wird in der App **Files** unter **Lolly** gespeichert, und das Teilen-Menü öffnet sich. Die Zeile unter **Download** lautet „Saved to Files → Lolly“.
- **Android:** Das Teilen-Menü öffnet sich. Wählen Sie, wohin die Datei geht.

Auf iPhone, iPad und Android ersetzt eine neue Datei eine frühere mit demselben Namen.
:::

<!--i:eti-history-->
## Zu einer früheren Version zurückgehen

- **Während dieses Besuchs:** **Undo** geht Ihre letzten 100 Änderungen rückwärts durch, bis Sie das Tool verlassen oder neu laden. Siehe [Rückgängig und Wiederholen](/info/using.html#undo-and-redo).
- **In [Tools, die während der Arbeit speichern](#which-tools-save-as-you-work):** Frühere Versionen jedes Werks werden behalten.
- **Alles auf dem Gerät:** Wenn [Sync](/info/sync.html) aktiviert ist, stellt **Restore an earlier copy** unter **Settings → Connected services** eine der letzten sieben täglichen Kopien oder die Kopie vor Ihrer letzten Übernahme wieder her. Alles auf diesem Gerät entspricht dann dieser Kopie.

So öffnen Sie eine frühere Version:

1. Drücken Sie **History**, die Uhr-Schaltfläche neben **Undo** und **Redo**. In Lolly Design liegt **History** in der oberen Leiste. Auf einem Smartphone drücken Sie **•••** und dann **History**. In Tools ohne **Undo**, etwa Text und Lolly Sandbox, liegt **History** oben links neben **Home**.
2. Finden Sie die Version anhand von Datum und Uhrzeit. Zeilen mit **Automatic checkpoint** entstehen während der Arbeit; Zeilen mit **Saved version** entsprechen den Zeitpunkten, zu denen Sie gespeichert haben.
3. Drücken Sie **Open as a copy**. Die Version öffnet sich als neues Werk, und das zuvor geöffnete bleibt unverändert. Die Kopie liegt in **Projects**, mit „(copy)“ hinter ihrem Namen.

Um eine Version mit einem Namen aufzubewahren, drücken Sie **Name version**, geben einen Namen ein und drücken **Keep milestone**. Benannte Versionen sind auf der Seite **History** unter **Milestones** aufgeführt.

::: details Das History-Panel und die History-Seite
Das Panel **History** listet auch Zeilen mit **Recovered work** auf, und **Protected drafts** enthält Ihre letzten Änderungen zwischen Prüfpunkten, mit **Open draft as a copy**. **Lolly Compare** und **Check assets** helfen Ihnen bei der Auswahl, bevor Sie eine Kopie öffnen. Wechseln Sie von **This creation** zu **All history on this device**, um jedes Werk zu sehen.

Automatische Prüfpunkte werden mit zunehmendem Alter ausgedünnt: einer pro Minute für die letzte Stunde, einer pro Stunde für den letzten Tag, einer pro Tag für 30 Tage, danach einer pro Woche. Alle gespeicherten und benannten Versionen bleiben erhalten. Wenn Sie ein Werk löschen, werden auch seine Versionen nach **Trash** verschoben; **Delete forever** entfernt sie.

Wenn der Speicher für History voll wird, werden zuerst die ältesten automatischen Prüfpunkte von Werken entfernt, die Sie seit 30 Tagen nicht geöffnet haben. Auch dann bleibt ein gespeicherter Stand immer erhalten. Er wird als aktuelle Arbeit geschrieben, und History zeigt an, dass dieser Stand nicht als Version behalten wird. **Settings → Storage** zeigt, wie viel Speicher History belegt.

Die Seite **History** (`#/history`) umfasst jedes Werk in diesem Browser. Um die Seite zu öffnen, drücken Sie die Uhr-Schaltfläche oben rechts auf dem Startbildschirm oder in **Projects**, wählen **Saved sessions** im Profilmenü (auf einem Smartphone die runde Logo-Schaltfläche oben rechts) oder drücken **Open app history** im History-Panel eines Tools. Die Desktop- und Mobil-Apps haben keine History-Seite. Dort öffnen die Uhr-Schaltfläche des Startbildschirms und **Saved sessions** die Ansicht **Your recent work**: Ihre zuletzt gespeicherten Sitzungen und Exporte mit einem Link zu Projects.

- **Recent** listet Ihre Werke auf, die neuesten zuerst, mit **Resume**.
- **Changes** stellt Prüfpunkte, Downloads und Convert-Ergebnisse auf einer Zeitleiste dar. Ein Download bietet **Reopen settings**.
- **Milestones** listet benannte Versionen auf.

Jedes Werk erscheint als Kachel mit seinem Bild. **Grid** oder **List** wechselt das Layout. Filtern Sie nach Projekt, Tool und Datum (auf einem Smartphone unter **Filters**). Das Menü einer Kachel (Rechtsklick oder langes Drücken) bietet **Resume**, **Versions**, **Show in Projects** und **Move to Trash**. Um mehrere zu entfernen, wählen Sie sie aus und dann **Move to Trash**, das Undo anbietet.
:::

<!--i:eti-folder-move-->
## Ihre Arbeit auf ein anderes Gerät übertragen

| Ziel | Verwenden Sie |
|---|---|
| Ihre Geräte auf demselben Stand halten | **Sync across devices** unter **Settings → Connected services**: siehe [Ihre Geräte synchronisieren](/info/sync.html) |
| Alles einmalig übertragen | **Export my data** und **Import data…**, weiter unten |
| Ein Design oder ein Projekt weitergeben | Eine `.lolly`-Datei: **Export**, dann **Share**, dann **Download .lolly**; für ein ganzes Projekt **Download project (.lolly)** im Ordnermenü. Drücken Sie auf dem anderen Gerät **Open**. Siehe [Die .lolly-Datei](/info/using.html#the-lolly-file) |

Ein Freigabelink überträgt Ihre Einstellungen, aber keine Bilder oder Dateien, die Sie von Ihrem Gerät hinzugefügt haben.

::: note Beim Import wird ergänzt und nichts gelöscht
Ordner, Favoriten und Vorlagen aus der Datei werden zu den bereits auf dem anderen Gerät vorhandenen hinzugefügt. Wenn ein gespeichertes Element auf beiden vorhanden ist, bleibt die zuletzt gespeicherte Kopie erhalten. Ihre Angaben und Einstellungen auf diesem Gerät bleiben unverändert. Leere werden aus der Datei ergänzt. **Bring it to this device** in Sync funktioniert genauso.
:::

So übertragen Sie alles einmalig:

1. Öffnen Sie auf dem alten Gerät **Settings → Storage** und drücken Sie unter **Move to another device** auf **Export my data**. Lolly lädt eine `.zip`-Datei herunter, deren Name mit `LollyTools-` beginnt.
2. Übertragen Sie die Datei per USB, E-Mail an sich selbst, AirDrop oder über einen gemeinsamen Ordner.
3. Öffnen Sie auf dem neuen Gerät **Settings → Storage**, drücken Sie **Import data…**, wählen Sie die Datei und drücken Sie **Import**.

::: note Was zurückbleibt
Anmeldungen, Schlüssel und die Sync-Passphrase bleiben auf dem jeweiligen Gerät. Die Liste der letzten Downloads, Offline-Downloads und KI-Modelle werden auf keinem Weg übertragen. Der Versionsverlauf wird nur in einer Datei aus **Export my data** übertragen, nicht über Sync oder eine `.lolly`. Wenn der Verlauf für eine Datei zu groß ist, werden die ältesten automatischen Prüfpunkte ausgelassen, und die Exportzeile nennt ihre Anzahl. Sie können eine Kopie herunterladen und öffnen, die Sync in Ihrem Speicher aufbewahrt, oder sie in **Import data…** wie eine Sicherungsdatei auswählen. Eine verschlüsselte Kopie fragt nach Ihrer Passphrase.
:::

::: details Was die Sicherungsdatei enthält
Die Datei heißt `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`. Die Namensbestandteile stammen aus Ihrem Profil und entfallen, wenn sie nicht gesetzt sind. `<n>` zählt die Exporte am selben Tag. Sie enthält Ihr Profil mit Ihren Ordnern, Trash, Vorlagen und Favoriten; jede gespeicherte Sitzung mit ihrem Vorschaubild; Ihre hochgeladenen Bilder, Schriften, Logos und die Kopien Ihrer Downloads; Ihre Designsysteme; Ihre Einstellungen (Design, Breite der Seitenleiste, lokale Aktivitätsstatistiken); gespeicherte Versionen und Ergebnisse aus Convert sowie aus der Web-App den Versionsverlauf Ihrer Werke.

Der Katalog-Cache ist nicht enthalten. Das neue Gerät lädt den Cache erneut herunter. Jeder Teil hat eine Prüfsumme, sodass der Import eine bei der Übertragung beschädigte Datei erkennt. Gespeicherte Sitzungen werden wieder mit Ihren importierten Bildern verknüpft. Die Web-, Desktop- und Mobil-Apps lesen dieselbe Datei. Die Terminal-App schreibt eine eigene, einfachere Sicherung, die dieses Format nicht lesen kann. **Export my data & render everything** erstellt dieselbe Datei sowie eine zweite ZIP-Datei, in der jede gespeicherte Sitzung als Ausgabe gerendert ist. Das vollständige Format steht unter [Datenübertragung](/info/data-transfer.html).
:::

<!--i:eti-globe-->
## Wenn Sie Ihre Browserdaten löschen

In der Web-App hält Lolly alles im Speicher Ihres Browsers für diese Website: gespeicherte Arbeit, Bilder, Schriften, Designsysteme, Versionsverlauf und Offline-Downloads. Wenn Sie die Daten dieser Website in Ihrem Browser löschen, wird all das entfernt, und Lolly kann nichts davon zurückholen. Übrig bleibt, was den Browser bereits verlassen hat: heruntergeladene Dateien, eine Datei aus **Export my data**, eine [Sync](/info/sync.html)-Kopie und geteilte Links.

::: warning Bevor Sie Browserdaten löschen
Drücken Sie unter **Settings → Storage** auf **Export my data** und bewahren Sie die Datei an einem anderen Ort auf.
:::

Beim Start bittet Lolly den Browser, seinen Speicher nicht zu leeren, wenn der Platz auf dem Gerät knapp wird; der Browser entscheidet. Unter **Settings → Available offline** bedeutet eine Zeile, die mit **Protected** beginnt, dass der Browser zugestimmt hat. „The browser may clear downloads if the device runs low on space“ bedeutet, dass er nicht zugestimmt hat, und **Protect downloads** fragt erneut an.

Wenn der Browser nicht zugestimmt hat, kann er bei Platzmangel sowohl gespeicherte Arbeit als auch Downloads löschen. Bewahren Sie daher eine aktuelle Datei aus **Export my data** auf.

**Settings → Storage** zeigt, wie viel Platz jede Datenart belegt. Die Zeile **History** zählt automatische Prüfpunkte, ihre Vorschaubilder und Wiederherstellungsentwürfe. **Remove automatic checkpoints older than 30 days** gibt diesen Platz frei und behält gespeicherte und benannte Versionen. **Clear cache** entfernt heruntergeladene Katalogdateien, die bei Bedarf erneut heruntergeladen werden. **Clear all my data** fordert Sie auf, ein Wort einzugeben, deaktiviert Sync und entfernt dann alles, was Lolly in diesem Browser hält: Ihr Profil und Ihre Einstellungen, gespeicherte Sitzungen samt Verlauf und Trash, Uploads, Schriften und Designsysteme, das Download-Protokoll, Convert-Ergebnisse, heruntergeladene KI-Modelle und Offline-Kopien. Heruntergeladene Dateien bleiben dort, wo Sie sie gespeichert haben. Die App startet danach wie bei einem ersten Besuch.

![Die Speicherkarte auf einem Bildschirm in Smartphone-Breite: jede Kategorie der Daten auf dem Gerät benannt, mit der Schaltfläche Clear all my data am unteren Rand](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

In den Desktop- und Mobil-Apps sind gespeicherte Sitzungen Dateien im eigenen Datenordner der App; alles andere liegt im eigenen Speicher der App. Das Löschen der Daten eines Webbrowsers berührt diese nicht.

::: details Wo die Desktop- und Mobil-Apps gespeicherte Sitzungen aufbewahren
Eine Datei pro gespeicherter Sitzung in einem Ordner `saved-state`:

- macOS: `~/Library/Application Support/tools.lolly.Desktop/saved-state/`
- Windows: `%APPDATA%\tools.lolly.Desktop\saved-state\`
- Linux: `~/.local/share/tools.lolly.Desktop/saved-state/` oder derselbe Pfad unter `$XDG_DATA_HOME`
- iPhone, iPad und Android: im eigenen Speicher der App, den die Files-App nicht anzeigt

Bilder, Designsysteme und die Liste der letzten Downloads bleiben im internen Speicher der App, nicht in diesen Ordnern. Die Terminal-App und die Befehlszeile lesen denselben Ordner `saved-state`: siehe [Wo gespeicherte Sitzungen liegen](/info/cli-reference.html#where-saved-sessions-live).
:::

<!--i:eti-trash-->
## Etwas Gelöschtes zurückholen

Wenn Sie eine gespeicherte Sitzung, einen Ordner, einen Ihrer Uploads oder eine Ihrer Schriften in der App löschen, wird das Element für 30 Tage nach **Trash** verschoben, unabhängig davon, wo Sie es löschen: in **Projects**, **Assets**, **Settings → Storage** oder der Liste gespeicherter Sitzungen eines Tools. Ein Ordner und sein gesamter Inhalt gelangen als ein Eintrag nach Trash. Eine Sitzung behält ihren Versionsverlauf in Trash. Direkt nach dem Löschen bietet eine Meldung **Undo** an. Später:

1. Öffnen Sie **Trash**: die Kachel **Trash** in **Projects**, die Schaltfläche **Trash** in **Assets → Your uploads** oder die Zeile **Trash** in **Settings → Storage**. Alle drei öffnen dieselbe Liste.
2. Drücken Sie neben dem Element auf **Restore**. Es kehrt in seinen Ordner zurück, und eine Schrift erhält die Rollen zurück, die sie in ihrem Designsystem hatte.

**Delete forever** entfernt ein Element endgültig. **Empty Trash** fragt zuerst nach und entfernt dann jedes Element in Trash. Elemente, die älter als 30 Tage sind, werden endgültig entfernt.

::: warning Manche Löschungen erfolgen sofort
Beim Löschen eines Designsystems, eines Logos oder Ihres Profilfotos wird nichts nach Trash verschoben. Auch die Befehlszeile und die Terminal-App löschen sofort.
:::

Wenn [Sync](/info/sync.html) aktiviert ist, kann **Restore an earlier copy** den Zustand des gesamten Geräts von einem früheren Tag zurückholen; eine Datei aus **Export my data** stellt das wieder her, was sie enthält.
