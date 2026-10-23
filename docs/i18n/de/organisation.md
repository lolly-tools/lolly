# Lolly in Ihrer Organisation nutzen

Ihre Organisation kann ein eigenes Lolly betreiben: dieselbe App, mit den Tools und Designsystemen, die sie gewählt hat. Diese Seite zeigt, wie Sie es erreichen, sich anmelden und was sich dann ändert.

::: note Was Sie von Ihrer Organisation brauchen
Die Webadresse ihres Lolly, oder eine `.lolly`-Setup-Datei, die Ihre Organisation erstellt hat. lolly.tools allein verbindet sich mit keiner Organisation.
:::

## Im Browser

Öffnen Sie die Adresse, die Ihre Organisation Ihnen gegeben hat. Wenn die Seite Sie zur Anmeldung auffordert, drücken Sie **Sign in** und folgen Sie der Anmeldeseite, die sich öffnet. Danach funktioniert es wie jedes Lolly, mit den Tools und Designsystemen Ihrer Organisation.

Sie können auch bei lolly.tools beginnen: Öffnen Sie **Settings**, drücken Sie auf der Karte **Lolly instance** **Open a workspace**, geben Sie die Adresse ein und drücken Sie **Open this instance**. Der Browser wechselt zur eigenen Adresse Ihrer Organisation, weil ein Browser von lolly.tools aus nicht die Tools eines anderen Lolly laden kann.

![Die Karte Lolly instance in den Einstellungen, auf der Sie den Workspace Ihrer Organisation öffnen oder ändern, woher die App ihre Tools bezieht](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## In der Desktop- oder Mobile-App

Die App startet mit ihren mitgelieferten Tools. Um sich zu verbinden, öffnen Sie **Settings** und drücken auf der Karte **Lolly instance** **Change**. Das Blatt fragt **Where should Lolly get its tools?**

1. Wählen Sie **Mit einer Lolly-Instanz verbinden**.
2. Geben Sie die Webadresse Ihrer Organisation ein und drücken Sie **Prüfen und verbinden**.
3. Drücken Sie **Diese Instanz verwenden**. Der nächste Bildschirm, **Ihre Daten importieren (optional)**, überträgt gespeicherte Arbeit aus einem Lolly-Backup; drücken Sie **Überspringen**, wenn Sie keines haben.
4. Melden Sie sich an, falls die App danach fragt.

Tools einer verbundenen Instanz laufen mit demselben Vertrauen wie die eigenen der App, verbinden Sie sich daher nur mit einer, der Sie vertrauen. Ihre Organisation kann Ihnen stattdessen eine `.lolly`-Setup-Datei schicken, die die App für Sie verbindet.

Um später zu wechseln, nutzen Sie erneut **Change** oder **Leave** auf derselben Karte.

### Anmelden mit einem Code

In den Desktop- und Mobil-Apps bietet der Anmeldebildschirm auch einen kurzen Code an, wenn das Lolly Ihrer Organisation die Anmeldung per Code unterstützt. Drücken Sie **Open sign-in in browser**, melden Sie sich an und bestätigen Sie dort den Code. Oder öffnen Sie die angezeigte Adresse auf einem Smartphone oder Computer, auf dem Sie schon angemeldet sind, und geben Sie den Code ein. Der Code gilt etwa zehn Minuten.

## Was dort anders ist

- **Manche Steuerelemente sind für Sie festgelegt.** Ein Steuerelement, das Ihre Organisation regelt, zeigt **Managed by** und den Namen der Organisation oder **Managed by your organisation**. Ein festes Steuerelement lässt sich nicht ändern, ein Menü bietet eventuell nur einen Teil seiner Auswahl, und eine Zeile, die mit **Set by** beginnt, kann sagen, welche Regel gilt und warum. Manche Steuerelemente werden gar nicht angezeigt.
- **Manche Designsysteme sind gesperrt.** Ein Designsystem, das Ihre Organisation liefert, zeigt ein Schloss und bleibt schreibgeschützt. Um Änderungen auszuprobieren, erstellen Sie unter **Settings → Preferences → Design systems** eine bearbeitbare Kopie.
- **Nur ihre Tools sind aufgelistet.** Ein Tool, das Ihre Organisation nicht anbietet, wird gar nicht angezeigt.
- **Gemeinsame Projekte.** Wenn Ihre Organisation Projekte mit Ihnen teilt, zeigt **Projects** eine Kachel **Team projects**. Diese Sitzungen liegen auf dem Server der Organisation. Öffnen Sie eine, um daran zu arbeiten, oder starten Sie, wenn verfügbar, über **Share** eine [Work-Collab](/info/collaborate.html#work-collabs-with-lolly-work-optional).
- **Manche Exporte brauchen eventuell eine Freigabe.** Wo Ihre Organisation eine Freigabe verlangt, tritt **Request approval** an die Stelle von **Download**, und ein Tool bietet eventuell weniger Formate.

### Was wo bleibt

::: cols
## Auf diesem Gerät

- Ihre eigenen Speicherstände, sofern Sie nicht [Sync](/info/sync.html) einschalten
- Designsysteme, die Sie selbst erstellt haben
- Alles, was Sie erstellen und herunterladen

## Auf dem Server Ihrer Organisation

- Ihre Anmeldeidentität und Geräteangaben
- Team-Projekte, gemeinsame Sitzungen und Live-Änderungen in einer Work-Collab
- Assets, die Sie in die gemeinsame Bibliothek hochladen
- Freigabeanfragen und freigegebene Lieferungen
- Nutzungsereignisse, wo Ihre Organisation sie einschaltet
:::

[Datenschutz](/info/privacy.html#organisation-services-with-lolly-work) listet auf, was der Server speichert und wer diese Daten kontrolliert.

## Was Lolly Work hinzufügt

Der Server Ihrer Organisation betreibt **Lolly Work**, die Organisationssoftware desselben Open-Source-Projekts. Die App braucht weder ein Work-Konto noch Lolly Work, wenn Sie sie allein nutzen.

::: details Was Lolly Work hinzufügen kann
Ihre Organisation hostet [Lolly Work](https://github.com/lolly-tools/lolly-work) neben Lolly und wählt, welche Funktionen sie einschaltet:

- **Anmeldung und Zugriff.** Single Sign-on der Organisation, gruppenbasierte Berechtigungen und verwaltete Profilfelder. Administratoren können Konten über SCIM bereitstellen und deaktivieren.
- **Gemeinsame Arbeit.** Team-Projekte, gemeinsame Sitzungen und [Work-Collabs](/info/collaborate.html#work-collabs-with-lolly-work-optional), mit Live-Bearbeitung über den Server der Organisation.
- **Eine gemeinsame Asset-Bibliothek.** Hochgeladene Assets, Sammlungen und verbundene Bibliotheken, mit Zugriffsregeln, Versionen und Prüfung.
- **Prüfung und Lieferung.** Freigabeschritte, verwaltete Links mit Ablauf oder Widerruf und Lieferung an Ziele, die die Organisation zulässt.
- **Administration.** Nutzungsberichte nach der Telemetrie-Richtlinie der Instanz sowie ein Audit-Protokoll gesteuerter Aktionen.

Wenn Sie den Dienst einrichten, beginnen Sie mit [Bereitstellung](/info/deployment.html#organisation-services-with-lolly-work). Die öffentliche Demo unter [lolly.work](https://lolly.work) ist eine Sandbox; nutzen Sie für Arbeit, die Sie behalten müssen, die eigene Adresse Ihrer Organisation.
:::

## Verlassen

**Leave** auf der Karte **Lolly instance** in **Settings** entfernt das Designsystem, die Tools und den Katalog Ihrer Organisation. Ihre eigene Arbeit bleibt. Alles, was Sie mit ihren Tools erstellt haben, öffnet sich erst wieder, wenn Sie sich neu verbinden.

Alles, was Sie in der Organisation gespeichert haben, bleibt bei der Organisation, nach deren Zugriffs- und Aufbewahrungsrichtlinien. Das Verlassen oder Leeren dieses Geräts löscht diese Serverkopie nicht. In einem Browser unter der eigenen Adresse Ihrer Organisation gibt es nichts zu verlassen: Öffnen Sie stattdessen eine andere Adresse.

## An wen Sie sich wenden

Was den Server Ihrer Organisation erreicht, wer ihre gemeinsamen Projekte sehen kann und welche Einstellungen fest sind, sind Entscheidungen Ihrer Organisation. Fragen Sie, wer das Lolly Ihrer Organisation betreibt. [Datenschutzerklärung](/info/privacy.html) behandelt, was Lolly selbst mit Ihren Daten macht.
