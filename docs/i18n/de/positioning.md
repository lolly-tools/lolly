# Wie Lolly sich einordnet

Was Lolly leistet, das die heutigen Kreativ-Tools nicht leisten, und was es ihnen bewusst überlässt.

Für die Version Tool für Tool, mit je einer Seite für Canva, Adobe, Figma, Render-APIs und Online-Konverter, siehe [Lolly im Vergleich, Tool für Tool](/info/compare.html). Jede Seite nennt, was das jeweils andere Tool besser macht und was Lolly stattdessen tut.

> **Pilot-Status:** Lolly ist ein Prototyp im geschlossenen Pilotbetrieb, kein fertiges Produkt, und seine Sicherheit durchläuft derzeit die strikte Infrastruktur-Härtung von SUSE, als Vorbereitung auf den Einsatz im Enterprise-Maßstab. Die Seite [Adoption & Governance](/info/adoption-governance.html#status) beschreibt den aktuellen Stand.

## Die heutigen Tools

Jeder Ring unten bewertet, wie vollständig eine Produktklasse eine Fähigkeit **so, wie sie heute tatsächlich ausgeliefert wird** erfüllt - nicht so, wie sie beworben wird -, wobei jede Klasse anhand ihres besten Vertreters bewertet wird. Lolly wird mit demselben Maßstab bewertet: Es erhält den einzigen roten Ring auf dem Board, für Reife. Öffnen Sie einen Zeilennamen für die Begründung der jeweiligen Bewertungen. Die Spalten sind nach der Overall-Vollständigkeitszeile oben sortiert - dem Mittelwert der bewerteten Zeilen, ohne die Kostenzeile.

::: figure positioning-comparison
Funktionsvollständigkeit heutiger Creative-Tools, recherchiert im August 2026. Bewertung: 0 nicht vorhanden, 25 nur mit Workaround, 50 real, aber eingeschränkt oder Teillösung, 75 stark mit Einschränkungen, 100 Kernkompetenz.
:::

**Hinweise zur Bewertung.** Lollys Bewertungen setzen voraus, dass die veröffentlichten Angaben zutreffen, weshalb Reife sein einziger roter Ring ist: geschlossener Pilotbetrieb, Sicherheits-Härtung in Arbeit, noch nichts auditiert. Research hat mehrere Zellen verschoben.

Canva wird pro Zeile anhand seines besten Familienmitglieds bewertet, da es Affinity und Cavalry besitzt (beide im Oktober 2025 verschenkt). Offline- und On-Device-Rendering erreichen 75 über Affinity - eine Desktop-Suite, die weiterhin ein verifiziertes Konto voraussetzt und Telemetrie mitführt, denselben Abzug, den auch Adobe hinnimmt -, während Canvas eigener Offline-Modus nur bereits synchronisierte Designs bearbeitet, ein Gerät, begrenztes Zeitfenster. Autofill erreicht 50: real, aber Enterprise-gesperrt, asynchron, nur Text und Bild. Figmas Massenerzeugung stieg von 25 auf 50, als Buzz die Tabellenkalkulations-Füllung auslieferte (kostenlose Beta, August 2026).

Eine Regel bestimmt das Board: Full (100), bei Zeilen, die Ihre Inhalte oder Ihre Identität berühren, verlangt eine Fähigkeit, die Sie ohne Konto und ohne Cloud-Voraussetzung nutzen können; Zeilen, die das Produkt selbst beschreiben (Reife, Bedienfreundlichkeit), sind davon ausgenommen. Das kostet Adobe bei Provenienz: Das breiteste ausgelieferte C2PA (Photoshop, Lightroom, Premiere, Firefly) signiert lokal und in der Cloud, aber nie ohne Adobe-Konto und -Identität, daher 75. Dasselbe deckelt die Render-APIs bei Massenerzeugung und Automatisierung.

Lollys Provenienz-Wert von 75 spiegelt On-Device-Offline-Signierung wider: architektonisch stärker, aber nicht auditiert, und ein Geräteschlüssel gilt in Standard-Validatoren als unverifiziert, bis eine Identität oder die eigene CA einer Organisation dafür bürgt. Penpots 50 kommt über das offizielle Lolly-Export-Plugin zustande: dieselbe Engine-Signierung, opt-in, ausdrücklich als Lollys eigene ausgewiesen. Penpot erhält außerdem den einzigen Ring des Boards außerhalb der Skala, 90 bei On-Device-Rendering - Browser-Canvas, Speichern in Ihrer eigenen souveränen Cloud (sogar einem Laptop), privater Export; nur der Server-Hop trennt es von Lolly. Cloudinary erhält eine eigene Spalte: eine Media-Pipeline (DAM, Transform-API, CDN), und die einzige Cloud-Spalte, die C2PA ausliefert (50, weil fl_c2pa erst bei der Auslieferung signiert und damit „von Cloudinary ausgeliefert“ bezeugt, nicht „von Ihnen erstellt“).

Live-Zusammenarbeit läuft in die andere Richtung: Figma setzt den Skalierungsmaßstab (200 Bearbeitende), und Lollys paarweises, air-gapped P2P erreicht Partial. Der Preis ist eine Schätzung, als solche gekennzeichnet: Listenpreis-Rechnung auf realistischen Sitz-Mischungen, absichtlich breit, für Skalierung, nicht für Beschaffung. Render-APIs erreichen bei Constraints 75: Templates fest verriegelt, keine Markengovernance-Ebene.

Die Lücke: Nichts, was heute ausgeliefert wird, ist gleichzeitig constraints-first und offline, ohne Konto und ohne Server im Render-Pfad, und niemand hat die Konto-Klausel kopiert. Lolly liefert nun eine eigene offene Leinwand aus - **Design**, eine freie Leinwand mit direkter Manipulation -, aber Farben, Schrift und Assets darauf richten sich nach den globalen Markenvorgaben, sodass selbst freie Anordnung constraints-first bleibt.

Was Lolly weiterhin **nicht** ist, ist eine uneingeschränkte Design-Suite; Designerinnen und Designer werden für maßgeschneiderte Arbeit weiterhin Illustrator und Figma nutzen - und wenn diese Arbeit zu einem governance-konformen, reproduzierbaren Asset werden muss, bringt [Import a design](/info/design-import.html) des Design-Tools die fertige Figma-, Penpot-, Illustrator-, InDesign- oder PDF-Datei als bearbeitbare, markenkonforme Boxen auf die Leinwand.

![Designs freie Leinwand, auf der die angebotenen Farben, Schriften und Assets die eigenen der Marke sind](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Wofür Sie es nutzen

- Schnelle Erzeugung operationalisierter Creative Assets (Event-Kacheln, Badges, Signaturen, Alerts)
- Freie Anordnung auf der offenen Leinwand (Design), wenn die Bausteine - Farben, Schrift, Icons, Bilder - konform zu den globalen Markenvorgaben bleiben müssen
- Ein fertiges Figma-, Penpot-, Illustrator-, InDesign- oder PDF-Design landen (über die Funktion "Import a design" im Design-Tool), damit es deterministisch bearbeitet, gesteuert und in jedem Lolly-Format neu gerendert werden kann
- One-to-many-Abläufe nach dem Muster "drei Felder ausfüllen, fertiges Asset erhalten" - inklusive Massenläufen aus einer Tabelle/CSV im `/pro`-Batch-Raster (Zeilen einfügen oder importieren, ein fertiges Asset pro Zeile, Download als ZIP)
- Dauerhaft laufende, wiederkehrende markenkonforme Ausgaben
- Fälle, in denen zentrale Kontrolle über den Markenauftritt wichtiger ist als gestalterische Freiheit

Deck Studio ist ein guter Maßstab für die Obergrenze hier: eine ganze Foliendeck als Daten deklariert, live auf der Leinwand layoutet und als nativ editierbare PowerPoint exportiert.

![Deck Studio in der geteilten Ansicht - die Folien des Decks links als Blöcke aufgelistet, das layoutete Deck rechts gerendert](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Wofür Sie es nicht nutzen

- Individuelle Hero-Inhalte oder Flaggschiff-Content (Billboards, große Videos)
- Einzigartige Kampagnenarbeit, die wirklich einen Designer braucht
- Ideenfindung, die dem Markensystem völlig entkommen muss - Lollys offene Leinwand hält Farben, Schrift und Assets weiterhin an die globalen Markenvorgaben, und genau das ist der Sinn

## Probabilistisch innovieren, deterministisch skalieren

Die meisten "KI-Kreativ"-Pitches stellen das Modell auf die falsche Seite einer alten Trennlinie. Schreiber und Illuminatoren hatten längst geklärt, wo sie verläuft: Man arbeitet locker in der Skizze, wo alles ausprobiert und nichts festgelegt wird, und geht dann zur Druckpresse, die genau deshalb einschüchternd wirkt, weil sie sich festlegt. In den Skizzen steckte die Kunst. Die Presse war das Mittel, wie sie sich verbreitete. Zwei Werkzeuge, zwei Aufgaben, jedes auf seine Weise erfinderisch, und dem gedruckten Werk konnte man vertrauen, weil die Presse ihr Versprechen bei jedem Abzug einhielt.

Lolly ist die Presse, nicht die Skizze. Bringen Sie zur Ideenfindung mit, was Sie wollen - ein Modell, einen Designer, eine Serviette -, aber sobald eine Idee zu zehntausend Assets werden muss, durchläuft sie etwas, das jedes Mal gleich rendert, ausgehend von Eingaben, die jeder nachvollziehen kann. Genau darum geht es beim obigen Vergleich: nicht darum, wer den besseren Generator hat, sondern wer den festgelegten Schritt reproduzierbar macht.

> Dem kreativen Prozess vertrauen, mit Präzision skalieren.

## Das Tool freigeben, nicht die Datei

Jedes andere Tool auf dem Markt erzeugt eine *Datei*, die anschließend geprüft werden muss - ein Brand Manager in einem Slack-Thread, Legal zum Disclaimer, eine Änderungsrunde, eine weitere Prüfung. Lolly verschiebt die Freigabe **einen Schritt weiter vorn**. Die Markenregeln - exakte Hex-Codes, lizenzierte Schriftdateien, Anschnittmargen, Abstände - sind fest in HTML und CSS des Tools kodiert, sodass das Template *kein* markenfremdes Asset ausgeben kann. Das Layout selbst setzt die Regeln durch.

Sie hören also auf, Ausgaben freizugeben, und fangen an, das **Tool** freizugeben, das sie erzeugt. Einmal freigegeben, ist jedes Asset, das es je produziert, durch Konstruktion bereits vorab freigegeben - kein Mensch im Kreislauf, kein Prüfzyklus, bei jeder Menge.

Das ist die Veränderung, die die deterministische Engine tatsächlich liefert: Sie ist keine schnellere Version des alten Freigabeprozesses, sie schafft den Prozess ab. Für das Creative-Team ist sie eine Leitplanke, kein Ersatz - Sie werfen weiterhin den Ball (die Daten, den Text, das Bild), und der Code ist die Bumperbahn, die jeden Wurf aus der Gosse hält.

![Der ganze Job des Producers: die Worte tippen. Schrift, Farbe und Abstand waren festgelegt, als das Tool freigegeben wurde](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Assets auf die alte Art freigeben | Das Tool freigeben, die Lolly-Art |
|---|---|
| Jede fertige Datei wird einzeln geprüft | Das Tool wird einmal geprüft |
| Anfrage → Designer baut → Markenprüfung → Rechtsprüfung → Änderungen → erneute Prüfung | Eine Parameteränderung → fertiges Asset |
| Designer, Brand Manager, Legal und Anfragender alle im Kreislauf | Der Producer, allein |
| Tage pro Asset | Sekunden pro Asset |
| 10.000 Assets = 10.000 Prüfzyklen | 10.000 Assets = null (das Template war bereits freigegeben) |

## Was das einzigartig ermöglicht

- **Wildes gestalterisches Potenzial, sicher im Kontext ausgeliefert.** Tools können gewagte Designideen innerhalb fest kodierter Leitplanken ausdrücken.

- **Software-definierte Content-Automatisierung, die das fertige Asset liefert.** Eingabe → fertige Datei. Kein "jetzt aus dem Design-Tool speichern und nachbearbeiten".
- **Tools setzen sich aus Tools zusammen.** Ein Tool kann das Render eines anderen Tools einbetten und als Teil eines einzigen fertigen Assets zurückgeben, ohne Code-Kopplung zwischen den Tools - ein Grundbaustein, den kein Open-Canvas- oder DAM-Templating-Produkt auf dem Markt bietet.
- **Herstellerneutralität.** Volle Kontrolle über Funktionsumfang und Kosten. Open-Source-Engine. Tools und Assets sind git-versionierter Content, nicht in einer SaaS-Datenbank eingeschlossen.

Der erste dieser Punkte wird am häufigsten unterschätzt. Eine Stadtkarte in Postergröße, gezeichnet als echte Vektorpfade für Straßen und Wasser, aus einem Dropdown und zwei Farbfeldern, die nicht außerhalb der Marke verweisen können:

![Amsterdams Grachtenringe und Straßennetz, randabfallend gezeichnet in der Tinte der eigenen Marke, jeder Strich vom Template platziert statt von Hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Content-Souveränität

Es gibt einen Namen für das, was der vorherige Abschnitt ergibt: Souveränität. Ihre Media-Pipeline läuft auf Hardware, die Ihnen gehört. Ihre Marke - die Tokens, die Schriften, die Logos, die Tools, die sie durchsetzen - liegt in Dateien, die Sie halten, in einer Versionskontrolle, die Sie kontrollieren, nicht in der Datenbank eines Anbieters mit Export-Button. Das Rendering geschieht auf dem Gerät vor Ihnen, sodass ein Asset nie einen Drittanbieter durchlaufen muss, um zu existieren, und der gesamte Pfad von der Eingabe zur fertigen Datei ist quelloffen und prüfbar. Würden morgen alle SaaS-Design-Anbieter verschwinden, würde eine Lolly-Installation es nicht bemerken.

Das ist für jeden wichtig, dessen Arbeit ein Abonnement überdauern sollte: für die Eltern, deren Fotobuch ebenso auf diesem Laptop liegt, wie für die öffentliche Einrichtung, deren Markenbibliothek unter Vergaberegeln steht. Für Organisationen - öffentliche Einrichtungen, regulierte Branchen, alle, deren Marke ein strategisches Asset und keine Dekoration ist - ist "wo liegt unser Content, und wer kann ihn abschalten" eine Governance-Frage, keine Präferenz. Souveränität ist hier eine Eigenschaft der Architektur, kein aus Compliance-Gründen hinzugefügtes Hosting-Merkmal, und die Seiten [Datenschutzerklärung](/info/privacy.html) und [Selbst überprüfen](/info/verify-yourself.html) existieren, damit Sie diese Behauptung prüfen können, statt sie zu glauben.

All dem liegt ein Versprechen zugrunde, formuliert als Verpflichtung, nicht als Feature: **Was auf Ihrem Gerät rendert, ist für immer kostenlos.** Die Engine, die Shells, die Tools, die Formate - der gesamte On-Device-Kreativpfad ist Open Source und bleibt es. Dieses Versprechen hat einen Mechanismus: Eine veröffentlichte Version ist so lizenziert, dass sie nicht zurückgenommen werden kann, und es gibt keine Contributor-Vereinbarung, die das Werk später umlizenzieren könnte. Die gesamte Grenze passt in einen Satz: Alles, was auf Ihrem Gerät rendert, ist für immer kostenlos und quelloffen; die Koordination von Menschen und Maschinen über ein Netzwerk hinweg ist Aufgabe einer separaten Steuerungsebene, [lolly.work](https://lolly.work).
