# Lolly im Vergleich

Lolly erstellt markenkonforme Dateien auf Ihrem eigenen Gerät, ohne Konto. **Lolly Work** ist der Server für Teams: Anmeldung, gemeinsame Projekte, Freigaben und Server-Rendering auf Rechnern, die Ihre Organisation betreibt. Beide sind Open Source unter MPL-2.0.

Die meisten Teams behalten ihre vorhandenen Tools. Eine Design-App liefert die Designs, ein DAM bleibt die maßgebliche Quelle, und Lolly macht aus freigegebenen Eingaben fertige Dateien. [Lolly mit Ihrem vorhandenen DAM verwenden](/info/use-with-dam.html) beschreibt diese Kombination. Die Idee dahinter ist [Inhaltssouveränität](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Heutige Tools

Jeder Ring zeigt, wie vollständig eine Produktklasse einen Bedarf erfüllt. Drücken Sie ein **?** neben einer Zeile, um die Belege zu sehen, und das **?** neben der Legende, um zu erfahren, wie die Bewertungen funktionieren.

::: figure positioning-comparison
Vergleich der Fähigkeiten. Wettbewerbsrecherche anhand von Anbieterunterlagen, August bis 21. November 2026. Lolly und Lolly Work am 21. November 2026 geprüft. Bewertung: 0 nicht vorhanden, 25 Behelfslösung, 50 vorhanden, aber zugangsbeschränkt oder teilweise, 75 stark mit Einschränkungen, 100 Kernkompetenz.
:::

::: details Quellen für die im November 2026 geänderten Bewertungen
- Canva: [API-Änderungsprotokoll](https://www.canva.dev/docs/apps/rest-apis/changelog/), [Service-Apps](https://www.canva.dev/blog/developers/canva-service-accounts/), [Hilfe zu Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [InDesign-API-Änderungsprotokoll](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [Preise für Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [Agenten- und KI-Credits](https://help.figma.com/hc/en-us/articles/42614902212887), [MCP-Server](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify und Bynder: [Frontify-Versionshinweise vom Oktober 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear und Placid: [Preise für Bannerbear](https://www.bannerbear.com/pricing/), [Bannerbear-Änderungsprotokoll](https://www.bannerbear.com/changelog/), [Preise für Placid](https://placid.app/pricing)
- Penpot: [Preise für Self-Hosting](https://penpot.app/pricing/self-host), [Versionen](https://github.com/penpot/penpot/releases)
- Cloudinary: [Inhaltsherkunft](https://cloudinary.com/documentation/content_provenance_and_authenticity), [Preise](https://cloudinary.com/pricing)
:::

Funktionen und bisherige Bewährung stehen in getrennten Zeilen. Lollys erste öffentliche Version war 1.0.1 am 30. August 2026, seine Sicherheit wurde noch keinem unabhängigen Audit unterzogen, und die Belege für seine Nutzung sind erst wenige Monate alt. [Einführung & Governance](/info/adoption-governance.html#status) zeigt den aktuellen Stand.

<!--i:eti-hammer-->
## Wann Sie Lolly einsetzen sollten

::: cols
## Nutzen Sie Lolly, wenn

- Immer wieder dieselbe Art von Datei gebraucht wird: Veranstaltungskacheln, Badges, Zertifikate, Warnmeldungen, Social Cards
- Viele Dateien aus einer Vorlage und einer Wertetabelle entstehen, in [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) oder der CLI
- Farben, Schriften und Assets innerhalb des Designsystems bleiben müssen, auch auf einer offenen Arbeitsfläche
- Ein fertiges Design aus Figma, Penpot, Illustrator, InDesign, Affinity oder PDF bearbeitbar und wiederholbar werden soll ([Ein Design importieren](/info/design-import.html))
- Die Dateien auf Ihren eigenen Geräten oder Servern erstellt werden müssen

## Nutzen Sie etwas anderes, wenn

- Es um detaillierte Fotoretusche oder Illustration geht
- Sie die Oberfläche einer Anwendung entwerfen und als Prototyp umsetzen
- Sie vom ersten Tag an eine große Bibliothek mit Stockmaterial und Vorlagen brauchen
- Sie einen verwalteten Dienst brauchen, der sich seit Langem auch bei hoher Auslastung bewährt hat
:::

Importierte Designs und gemeinsame Design-Tokens ermöglichen einem Team, Lolly mit spezialisierten Anwendungen zu kombinieren, während Lolly Work gemeinsame Assets, Prüfung und Lieferung steuert.

Teams mit einem kuratierten DAM sollten zunächst diese Bibliothek und ihre Administratoren beibehalten. [SUSEs Erfahrungen mit Brandfolder](/info/suse-brandfolder.html) dokumentiert, wie die Integration die Einführung und die Umstellung der Freigabeprozesse unterstützt hat. DAM-Anbieter und Implementierungspartner können dieselbe Konstellation anhand des [Partner-Workflows](/info/dam-partners.html) bewerten.

In **Lolly Markdown Slides** wird ein ganzes Deck als Daten geschrieben, live gesetzt und als native, bearbeitbare PowerPoint-Datei exportiert.

![Lolly Markdown Slides in der geteilten Ansicht: links die Folien des Decks als Blöcke aufgelistet, rechts das Rendering des gesetzten Decks](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Die Regeln stecken im Tool

Lolly legt wiederverwendbare Markenregeln im Tool ab: Farben, Schriften, Beschnittzugaben, Abstände und erlaubte Eingaben. Die Vorlage legt die Teile fest, die ein Empfänger nicht ändern darf. Lolly Work ergänzt diese Vorlage um Gruppenzugriff und Eingaberichtlinien sowie Freigabeketten für Katalogeinreichungen und Lieferung.

Ein Tool einmal zu prüfen erleichtert die wiederholbare Produktion, weil jede Ausgabe seine Layoutregeln übernimmt. Texte, hochgeladene Bilder und Nutzungsrechte können weiterhin eine Prüfung brauchen; dafür bietet Lolly Work gemeinsame Kataloge und Freigabeschritte. Für das Kreativteam ist das Tool eine Leitplanke: Sie liefern weiterhin die Daten, den Text und das Bild, und das Tool hält jedes Ergebnis markenkonform.

![Die ganze Aufgabe bei der Erstellung: die Wörter eingeben. Schrift, Farbe und Abstände wurden beim Erstellen des Tools festgelegt](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Drei weitere Unterschiede:

- **Aus Eingaben wird die fertige Datei.** Eingaben hinein, fertige Datei heraus, ohne "jetzt noch aus dem Design-Tool speichern und nachbearbeiten".
- **Tools setzen Tools zusammen.** Ein Tool kann das Rendering eines anderen Tools in eine einzige fertige Datei einbetten, ohne dass ihr Code gekoppelt ist.
- **Open Source.** Die Engine ist Open Source, und Tools, Assets und Design-Tokens sind Dateien, die Sie in der Versionsverwaltung aufbewahren oder in Lolly Work verwalten können, keine Zeilen in einer fremden Datenbank.

Mutiges Design bleibt auch mit Leitplanken möglich. Dieser Stadtplan in Posterqualität besteht aus echten Vektorpfaden für Straßen und Gewässer, erzeugt aus einem Dropdown und zwei Farbfeldern, die keine Auswahl außerhalb des Designsystems zulassen:

![Amsterdams Grachtengürtel und Straßennetz, bis zum Rand in den eigenen Farben des Designsystems gezeichnet, jeder Strich von der Vorlage statt von Hand gesetzt](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Probabilistisch Neues schaffen, deterministisch skalieren

Die meisten Angebote für "KI-Kreativität" stellen das Modell auf die falsche Seite einer alten Grenze. Schon Schreiber und Buchmaler legten fest, wo sie verläuft. Beim Entwurf arbeiten Sie frei: Alles lässt sich ausprobieren, nichts ist festgelegt. Dann geht es an die Druckerpresse, die verbindlich festlegt. In den Entwürfen lag die Kunst, und die Presse verbreitete sie. Dem gedruckten Werk konnte man vertrauen, weil die Presse bei jedem Abzug ihr Versprechen hielt.

Lolly ist die Presse. Bringen Sie in die Ideen ein, was Sie wollen: ein Modell, einen Designer oder eine grobe Zeichnung. Doch sobald aus einer Idee viele Dateien werden sollen, läuft sie durch etwas, das jedes Mal gleich rendert, aus Eingaben, die jeder wieder auslesen kann. Im Vergleich oben geht es eigentlich darum, wer diesen verbindlichen Schritt wiederholbar macht.

> Vertrauen Sie dem kreativen Prozess, skalieren Sie mit Sorgfalt.

<!--i:eti-tag-->
## Für immer kostenlos

**Wenn es auf Ihrem Gerät rendert, ist es für immer kostenlos.** Die Engine, die Shells, die Tools und die Formate sind Open Source, und eine veröffentlichte Version lässt sich nicht zurücknehmen. Auch Lolly Work ist Open Source. Eine Organisation bezahlt die Infrastruktur und den Betrieb ihrer Wahl, ohne Softwarelizenzgebühren pro Nutzer oder Rendering beim Self-Hosting. [Fragen & Antworten](/info/faq.html) erzählt die Geschichte hinter diesem Versprechen.

<!--i:eti-map-pin-->
## Wo Ihre Inhalte liegen

Die kreative Arbeit mit Lolly kann auf Hardware laufen, die Ihnen gehört, und seine Design-Tokens, Schriften, Logos und Tools sind Dateien, die Sie behalten können. Mit Lolly Work liegen gemeinsame Projekte, Assets, Richtlinien und Audit-Einträge in einem Speicher, den Ihre Organisation konfiguriert. [Vertrauen](/info/trust.html) erklärt, warum das wichtig ist, und mit der [Datenschutzerklärung](/info/privacy.html) und [Prüfen Sie es selbst](/info/verify-yourself.html) können Sie die Aussage überprüfen, statt uns einfach zu glauben.

<!--i:eti-grid-->
## Tool für Tool

[Lolly im Vergleich, Tool für Tool](/info/compare.html) vergleicht Lolly mit Canva, Adobe, Figma, Penpot, Markenportalen, Rendering-APIs und Online-Konvertern, jeweils auf einer eigenen Seite, und erläutert, [was wo läuft](/info/compare.html#what-runs-where).
