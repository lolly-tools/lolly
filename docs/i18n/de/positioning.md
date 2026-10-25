# Wie Lolly sich einordnet

Lolly besteht aus zwei Teilen eines Open-Source-Projekts. **Lolly** ist die Engine, sind die Apps und Tools zum Erstellen, Bearbeiten, Umwandeln und Exportieren auf Ihrem Gerät, ohne Konto. **Lolly Work** ist der Organisationsserver, auf Ihrer eigenen Infrastruktur betrieben, für Anmeldung, gemeinsame Projekte, Freigaben und Server-Rendering. Beide stehen unter MPL-2.0. Diese Seite vergleicht das Paar mit den anderen Wegen, wie Menschen Dateien gestalten, steuern und erzeugen.

## Die heutigen Tools

Jeder Ring bewertet, wie vollständig eine Produktklasse eine Fähigkeit liefert, wobei jede Klasse an ihrem besten Vertreter bewertet wird. Die Spalte Lolly umfasst Lolly und Lolly Work zusammen, und jede Zeile sagt, welcher Teil was liefert. Öffnen Sie einen Zeilennamen für die Begründung seiner Bewertung. Die Spalten sind nach der Zeile Overall completeness oben sortiert: dem Mittelwert der bewerteten Zeilen, wobei die Zeile zu den Ausgaben ausgenommen ist.

::: figure positioning-comparison
Fähigkeitenvergleich: Wettbewerbsrecherche und Bewertungen vom August 2026; Abdeckung von Lolly + Lolly Work geprüft am 28. September 2026. Bewertung: 0 fehlt, 25 behelfsmäßig, 50 echt, aber gesperrt oder teilweise, 75 stark mit Einschränkungen, 100 Kernkompetenz.
:::

::: details Hinweise zur Bewertung
Verfügbare Funktionen und Produktionsreife sind getrennt. Lolly ist veröffentlicht: Version 1.0 erschien am 30. August 2026 als Open Source, seine Sicherheit wurde noch nicht unabhängig geprüft, und seine Belege für die Einführung sind einige Monate alt ([Adoption & Governance](/info/adoption-governance.html#status) hat den aktuellen Stand). Single Sign-on, Freigaben oder Server-Rendering zu haben begründet keine Erfolgsbilanz im Produktionsbetrieb, und die Reifebewertung spiegelt das wider. Die Bewertungen der Wettbewerber behalten ihre datierte Prüfung vom August.

Eine Regel bestimmt das Board. Die volle Punktzahl (100) braucht bei Zeilen, die Ihre Inhalte oder Identität berühren, eine Fähigkeit, die Sie ohne Konto und ohne Cloud-Voraussetzung nutzen können; Zeilen zum Produkt selbst, etwa Reife und Benutzerfreundlichkeit, sind ausgenommen. Diese Regel kostet Adobe bei Content Credentials Punkte: Die breiteste ausgelieferte Umsetzung (Photoshop, Lightroom, Premiere, Firefly) signiert lokal und in der Cloud, aber nie ohne ein Adobe-Konto und eine Identität, also 75. Sie deckelt aus demselben Grund die Rendering-APIs bei Massenerzeugung und Automatisierung.

Canva wird in jeder Zeile an seinem besten Familienmitglied bewertet, da es Affinity und Cavalry besitzt (beide im Oktober 2025 verschenkt). Offline- und On-Device-Rendering erhalten über Affinity 75, eine Desktop-Suite, die noch ein verifiziertes Konto braucht und Telemetrie trägt, den Abzug, den auch Adobe nimmt; der eigene Offline-Modus von Canva bearbeitet nur vorab synchronisierte Designs, auf einem Gerät, für ein begrenztes Fenster. Autofill erhält 50: Es ist echt, aber für Enterprise gesperrt und asynchron und füllt nur Text und Bilder. Die Massenerzeugung von Figma stieg von 25 auf 50, als Buzz das Ausfüllen aus Tabellen auslieferte (eine kostenlose Beta, August 2026).

Lollys Bewertung von 75 bei Content Credentials umfasst das Signieren auf dem Gerät und das Server-Signieren von Lolly Work mit einer konfigurierten Organisationsidentität; ein Verifizierer muss dem Unterzeichner weiterhin vertrauen ([Content-Credentials-Identität](/info/content-credentials-identity.html)). Die 50 von Penpot kommen über Lollys eigenes Export-Plug-in für Penpot: dieselbe Signatur der Engine, als Opt-in und als die von Lolly offengelegt. Penpot erhält bei On-Device-Rendering 90: eine Browser-Arbeitsfläche mit einem Speicherziel auf seinem Server, der selbst gehostet werden kann. Cloudinary erhält eine eigene Spalte für seine Asset-Bibliothek, seine Transform-API und sein CDN; die Prüfung vom August bewertete das Signieren seiner Auslieferung mit 50.

Lollys Live-Zusammenarbeit umfasst direkte private Collabs zwischen zwei Geräten und authentifizierte Work-Collabs über Lolly Work, mit gemeinsamen Änderungen, Cursorn und gespeicherten Team-Sitzungen. Die Bewertung Partial spiegelt die aktuelle Work-Bereitstellung mit einem Knoten und die kurze Betriebshistorie wider, nicht das Fehlen von Team-Bearbeitung. Preisschätzungen sind datierte Listenpreis-Rechnungen zur Größenordnung, keine Beschaffung.
:::

## Wann Sie zu Lolly greifen

::: cols
## Greifen Sie zu Lolly, wenn

- dieselbe Art von Datei immer wieder gebraucht wird: Event-Kacheln, Namensschilder, Zertifikate, Hinweise, Social-Media-Karten
- viele Dateien aus einer Vorlage und einer Wertetabelle entstehen, in [Batch](/info/batch.html#make-many-versions-of-one-design) oder der CLI
- Farben, Schrift und Assets auch auf einer offenen Arbeitsfläche im Designsystem bleiben müssen
- ein fertiges Design aus Figma, Penpot, Illustrator, InDesign oder PDF bearbeitbar und wiederholbar werden soll ([Ein Design importieren](/info/design-import.html))
- die Dateien auf Ihren eigenen Geräten oder Servern entstehen müssen

## Greifen Sie zu etwas anderem, wenn

- die Arbeit detaillierte Fotoretusche oder Illustration ist
- Sie die Oberfläche einer Anwendung entwerfen und prototypen
- Sie vom ersten Tag an eine große Bibliothek aus Stock-Material und Vorlagen brauchen
- Sie einen verwalteten Dienst mit langer Erfolgsbilanz im großen Maßstab brauchen
:::

Importierte Designs und geteilte Design-Tokens lassen ein Team Lolly mit spezialisierten Anwendungen kombinieren, während Lolly Work gemeinsame Assets, Prüfung und Lieferung steuert.

Ein ganzes Foliendeck zeigt die Obergrenze: In **Markdown Slides** wird ein Deck als Daten deklariert, live gesetzt und als natives, bearbeitbares PowerPoint exportiert.

![Markdown Slides in der geteilten Ansicht: links die Folien des Decks als Blöcke aufgelistet, rechts das gesetzte Deck beim Rendern](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Die Regeln leben im Tool

Lolly legt wiederverwendbare Markenregeln in das Tool: Farben, Schriften, Beschnittränder, Abstände und zulässige Eingaben. Die Vorlage legt die Teile fest, die ein Empfänger nicht ändern darf. Lolly Work ergänzt rund um diese Vorlage Gruppenzugriff und Eingaberichtlinien, mit Freigabeketten für Katalogeinreichungen und Lieferung.

Ein Tool einmal zu prüfen macht wiederholbare Produktion leichter, weil jede Ausgabe seine Layoutregeln erbt. Text, hochgeladene Bilder und Nutzungsrechte können weiterhin eine Prüfung brauchen, und Lolly Work liefert dafür gemeinsame Kataloge und Freigabeschritte. Für das Kreativteam ist das Tool eine Leitplanke: Sie bringen weiterhin die Daten, den Text und das Bild mit, und das Tool hält jedes Ergebnis markenkonform.

![Die ganze Aufgabe der Produzierenden: die Worte tippen. Schrift, Farbe und Abstand wurden festgelegt, als das Tool entstand](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Drei weitere Dinge zeichnen diesen Ansatz aus:

- **Die fertige Datei, aus Eingaben.** Eingaben hinein, fertige Datei heraus, ohne "jetzt speichern Sie sie aus Ihrem Design-Tool und bessern nach".
- **Tools setzen Tools zusammen.** Ein Tool kann das Rendering eines anderen Tools in eine einzige fertige Datei einbetten, ohne Code-Kopplung zwischen ihnen.
- **Offen bis ganz nach unten.** Die Engine ist Open Source, und Tools, Assets und Design-Tokens sind Dateien, die Sie in der Versionsverwaltung behalten oder in Lolly Work verwalten können, keine Zeilen in der Datenbank von jemand anderem.

Mutiges Design übersteht die Leitplanken. Dieser Stadtplan in Plakatqualität besteht aus echten Vektorpfaden für Straßen und Wasser, aus einem Dropdown und zwei Farbfeldern, die sich nicht aus dem Designsystem hinauszeigen lassen:

![Amsterdams Grachtenringe und Straßennetz, randlos in der eigenen Tinte des Designsystems gezeichnet, jeder Strich von der Vorlage statt von Hand gesetzt](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Probabilistisch innovieren, deterministisch skalieren

Die meisten Pitches für "KI-Kreativität" stellen das Modell auf die falsche Seite einer alten Linie. Schreiber und Buchmaler haben geklärt, wo sie verläuft. Sie arbeiten locker an der Skizze, wo alles probiert werden kann und nichts verbindlich ist. Dann gehen Sie zur Druckerpresse, die sich festlegt. In den Skizzen lag die Kunst, und die Presse war, wie sie reiste, und dem gedruckten Werk konnte man vertrauen, weil die Presse bei jedem Abzug ihr Versprechen hielt.

Lolly ist die Presse. Bringen Sie zu den Ideen, was Sie wollen, ein Modell, eine Designerin oder eine grobe Zeichnung, aber in dem Moment, in dem aus einer Idee viele Dateien werden müssen, geht sie durch etwas, das jedes Mal gleich rendert, aus Eingaben, die jeder zurücklesen kann. Der obige Vergleich dreht sich eigentlich darum, wer diesen verbindlichen Schritt wiederholbar macht.

> Dem kreativen Prozess vertrauen, mit Präzision skalieren.

## Für immer kostenlos

**Wenn es auf Ihrem Gerät rendert, ist es für immer kostenlos.** Die Engine, die Shells, die Tools und die Formate sind Open Source, und eine veröffentlichte Version lässt sich nicht zurücknehmen. Lolly Work ist ebenfalls Open Source. Eine Organisation zahlt für die Infrastruktur und den Betrieb, die sie wählt, ohne Softwarelizenzgebühr pro Platz oder pro Rendering beim Selbst-Hosting. [Fragen und Antworten](/info/faq.html) erzählt die Geschichte hinter dem Versprechen.

## Wo Ihre Inhalte liegen

Lollys kreative Arbeit kann auf Hardware laufen, die Ihnen gehört, und seine Design-Tokens, Schriften, Logos und Tools sind Dateien, die Sie behalten können. Mit Lolly Work liegen gemeinsame Projekte, Assets, Richtlinien und Audit-Aufzeichnungen in Speicher, den Ihre Organisation konfiguriert. [Vertrauen](/info/trust.html) erklärt, warum das wichtig ist, und die [Datenschutzrichtlinie](/info/privacy.html) und [Selbst prüfen](/info/verify-yourself.html) lassen Sie die Aussage prüfen, statt uns beim Wort zu nehmen.

## Tool für Tool

[Lolly im Vergleich, Tool für Tool](/info/compare.html) vergleicht Lolly mit Canva, Adobe, Figma, Penpot, Marken-Portalen, Rendering-APIs und Online-Konvertern, je eine Seite, und legt [dar, was wo läuft](/info/compare.html#what-runs-where).
