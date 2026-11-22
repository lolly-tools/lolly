# Lolly in Ihrer Organisation verwenden

Ihre Organisation kann ein eigenes Lolly betreiben: dieselbe App, mit den Tools und Designsystemen, die sie ausgewählt hat. Erfahren Sie, wie Sie es erreichen, sich anmelden und was sich ändert.

Für die Planung der Einrichtung Ihrer Organisation erklärt [Lolly mit Ihrem bestehenden DAM verwenden](/info/use-with-dam.html), wie eine freigegebene Bibliothek bestehen bleiben kann, während Menschen Inhalte in Lolly erstellen. [Souveränität über Inhalte](/info/content-sovereignty.html) beschreibt die umfassendere Kontrolle über Erstellung, Verwaltung, Speicherung und Übertragbarkeit.

::: note Was Sie von Ihrer Organisation brauchen
Die Webadresse ihres Lolly oder eine `.lolly`-Einrichtungsdatei, die Ihre Organisation erstellt hat. lolly.tools allein stellt keine Verbindung zu einer Organisation her.
:::

<!--i:eti-globe-->
## In einem Browser

Öffnen Sie die Adresse, die Ihre Organisation Ihnen gegeben hat. Falls die Seite Sie zur Anmeldung auffordert, drücken Sie **Sign in** und folgen Sie der Anmeldeseite, die sich öffnet. Danach funktioniert Lolly wie gewohnt, mit den Tools und Designsystemen Ihrer Organisation.

Sie können auch von lolly.tools aus starten: Öffnen Sie die Ansicht **Settings**, drücken Sie auf der Karte **Lolly instance** auf **Open a workspace**, geben Sie die Adresse ein und drücken Sie **Open this instance**. Der Browser wechselt zur eigenen Adresse Ihrer Organisation, weil ein Browser von lolly.tools aus keine Tools eines anderen Lolly laden kann.

![Die Karte Lolly instance in Settings, auf der Sie den Arbeitsbereich Ihrer Organisation öffnen oder ändern, woher die App ihre Tools bezieht](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## In der Desktop- oder Mobil-App

Die App startet mit ihren mitgelieferten Tools. Zum Verbinden öffnen Sie die Ansicht **Settings** und drücken auf der Karte **Lolly instance** auf **Change**. Der Dialog fragt **Where should Lolly get its tools?**

1. Wählen Sie **Connect to a Lolly instance**.
2. Geben Sie die Webadresse Ihrer Organisation ein und drücken Sie **Check & connect**.
3. Drücken Sie **Use this instance**. Der nächste Bildschirm, **Import your data (optional)**, übernimmt gespeicherte Arbeit aus einer Lolly-Sicherung. Drücken Sie **Skip**, wenn Sie keine haben.
4. Melden Sie sich an, falls die App Sie dazu auffordert.

Tools einer verbundenen Instanz werden mit demselben Vertrauen wie die eigenen Tools der App ausgeführt. Verbinden Sie sich daher nur mit einer Instanz, der Sie vertrauen. Ihre Organisation kann Ihnen stattdessen eine `.lolly`-Einrichtungsdatei senden, die die App für Sie verbindet.

Zum späteren Wechseln verwenden Sie erneut **Change** oder **Leave** auf derselben Karte.

### Mit einem Code anmelden

In den Desktop- und Mobil-Apps bietet der Anmeldebildschirm auch einen kurzen Code an, wenn das Lolly Ihrer Organisation die Code-Anmeldung unterstützt. Drücken Sie **Open sign-in in browser**, melden Sie sich an und bestätigen Sie dort den Code. Oder öffnen Sie die angezeigte Adresse auf einem Smartphone oder Computer, auf dem Sie bereits angemeldet sind, und geben Sie den Code ein. Der Code gilt etwa zehn Minuten.

<!--i:eti-sliders-->
## Was dort anders ist

- **Einige Steuerelemente sind für Sie voreingestellt.** Ein Steuerelement, das Ihre Organisation verwaltet, zeigt **Managed by** und den Namen der Organisation oder **Managed by your organisation**. Ein festgelegtes Steuerelement lässt sich nicht ändern, und ein Menü bietet möglicherweise nur einen Teil seiner Optionen an. Einige Steuerelemente sind ausgeblendet. Die Konsole Ihrer Organisation zeichnet auf, welche Regel ein Steuerelement festgelegt hat und warum. Fragen Sie die Person, die das Lolly Ihrer Organisation betreibt.
- **Einige Designsysteme sind gesperrt.** Ein Designsystem, das Ihre Organisation bereitstellt, zeigt ein Schloss und bleibt schreibgeschützt. Um Änderungen auszuprobieren, erstellen Sie unter **Settings → Preferences → Design systems** eine bearbeitbare Kopie.
- **Nur ihre Tools werden aufgelistet.** Ein Tool, das Ihre Organisation nicht anbietet, wird nicht angezeigt.
- **Gemeinsame Projekte.** Wenn Ihre Organisation Projekte mit Ihnen teilt, zeigt **Projects** eine Kachel **Team projects**. Diese Sitzungen liegen auf dem Server der Organisation. Öffnen Sie eine, um daran zu arbeiten, oder starten Sie über **Share** eine [Work-Collab](/info/collaborate.html#collabs-through-lolly-work-optional), sofern verfügbar.
- **Einige Exporte benötigen möglicherweise eine Freigabe.** Wo Ihre Organisation eine Freigabe verlangt, ersetzt **Request approval** die Schaltfläche **Download**, und ein Tool bietet möglicherweise weniger Formate an.
- **Ihre Startseite zeigt möglicherweise Vorlagen.** Falls Ihre Organisation Vorlagen für Sie veröffentlicht, etwa für ein Partnerunternehmen, zeigt Ihre Startseite diese anstelle der Begrüßung beim ersten Besuch. Jede Vorlage ist eine Karte, mit **Your copy** zum Weiterarbeiten und **New version**, wenn sich die Vorlage ändert. Siehe [Partnervorlagen](/info/work-partner-templates.html).

### Was wo bleibt

::: cols
## Auf diesem Gerät

- Ihre eigenen gespeicherten Arbeiten, sofern Sie [Sync](/info/sync.html) nicht einschalten
- Selbst erstellte Designsysteme
- Alles, was Sie erstellen und herunterladen

## Auf dem Server Ihrer Organisation

- Ihre Anmeldeidentität und Geräteinformationen
- Teamprojekte, gemeinsame Sitzungen und Live-Änderungen in einer Work-Collab
- Assets, die Sie in die gemeinsame Bibliothek hochladen
- Freigabeanfragen und genehmigte Lieferungen
- Ein Protokoll Ihrer Anmeldungen und Ihrer dortigen Aktivitäten
:::

Wenn ein Arbeitsbereich verbunden ist, steht dasselbe im Datenschutzhinweis auf dem ersten Bildschirm der App. Lollys eigene Apps senden keine Nutzungsereignisse an den Arbeitsbereich. [Datenschutz](/info/privacy.html#organisation-services-with-lolly-work) listet auf, was der Server speichert und wer diese Daten kontrolliert.

<!--i:eti-building-->
## Was Lolly Work ergänzt

Auf dem Server Ihrer Organisation läuft **Lolly Work**, die Software für Organisationen aus demselben Open-Source-Projekt. Wenn Sie die App allein verwenden, braucht sie weder ein Arbeitskonto noch Lolly Work.

::: details Was Lolly Work ergänzen kann
Ihre Organisation hostet [Lolly Work](https://github.com/lolly-tools/lolly-work) neben Lolly und wählt aus, welche Funktionen sie einschaltet:

- **Anmeldung und Zugriff.** Single Sign-on der Organisation, gruppenbasierte Berechtigungen und verwaltete Profilfelder. Administratoren können Konten über SCIM bereitstellen und deaktivieren.
- **Gemeinsame Arbeit.** Teamprojekte, gemeinsame Sitzungen und [Work-Collabs](/info/collaborate.html#collabs-through-lolly-work-optional), mit Live-Bearbeitung über den Server der Organisation.
- **Eine gemeinsame Asset-Bibliothek.** Hochgeladene Assets, Sammlungen und verbundene Bibliotheken, mit Zugriffsregeln, Versionen und Prüfung.
- **Prüfung und Lieferung.** Freigabeschritte, verwaltete Links mit Ablauf oder Widerruf und Lieferung an Ziele, die die Organisation erlaubt.
- **Verwaltung.** Ein Audit-Protokoll der durch Richtlinien geregelten Aktionen und Nutzungsberichte gemäß der Telemetrierichtlinie der Instanz für Clients, die Nutzungsereignisse senden. Lollys eigene Apps senden derzeit keine.
:::

Beginnen Sie zum Einrichten des Dienstes mit [Bereitstellung](/info/deployment.html#organisation-services-with-lolly-work). Die öffentliche Demo unter [lolly.work](https://lolly.work) ist eine Sandbox. Verwenden Sie für Arbeit, die Sie behalten müssen, die eigene Adresse Ihrer Organisation.

<!--i:eti-palette-->
## Die Marke einer anderen Organisation

Ein Partner, Kunde oder Sponsor kann Ihnen seine Marke als Designsystem-Datei (`.lolly`) statt als Adresse senden. Das Öffnen dieser Datei verbindet die App mit nichts. Die Datei fügt das Designsystem auf diesem Gerät neben Ihrem eigenen hinzu. Eine Einrichtungsdatei Ihrer eigenen Organisation verbindet die App mit dem Lolly der Organisation. Bevor sich etwas ändert, zeigt die Vorschau, was das Öffnen einer Datei bewirkt. [Mit Partnern arbeiten](/info/partners.html) behandelt beide Seiten der Arbeit mit der Marke einer anderen Organisation.

<!--i:eti-unlink-->
## Verlassen

**Leave** auf der Karte **Lolly instance** in **Settings** entfernt das Designsystem, die Tools und den Katalog Ihrer Organisation. Ihre eigene Arbeit bleibt erhalten. Was Sie mit deren Tools erstellt haben, lässt sich erst wieder öffnen, wenn Sie sich erneut verbinden. Sofern das Lolly Ihrer Organisation es anbietet, beendet **Sign out everywhere** auf derselben Karte Ihre Sitzungen auf jedem Gerät, auch auf diesem.

Alles, was Sie bei der Organisation gespeichert haben, bleibt dort gemäß ihren Zugriffs- und Aufbewahrungsrichtlinien. Wenn Sie die Organisation verlassen oder dieses Gerät leeren, wird diese Serverkopie nicht gelöscht. In einem Browser unter der eigenen Adresse Ihrer Organisation gibt es nichts zu verlassen: Öffnen Sie stattdessen eine andere Adresse.

<!--i:eti-help-->
## An wen Sie sich wenden können

Was den Server Ihrer Organisation erreicht, wer ihre gemeinsamen Projekte sehen kann und welche Einstellungen festgelegt sind, entscheidet Ihre Organisation. Fragen Sie die Person, die das Lolly Ihrer Organisation betreibt. [Datenschutz](/info/privacy.html) beschreibt, was Lolly selbst mit Ihren Daten macht.
