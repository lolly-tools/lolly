# So funktioniert Lolly

Ein Lolly-Tool enthält die Regeln für eine Art von Datei: das Layout, die Schrift, die Farben und welche Teile andere ändern dürfen. Sie, eine Kollegin, ein Skript oder ein KI-Agent füllen die Felder aus, und jede Datei folgt diesen Regeln.

<!--i:eti-repeat-->
## Ein Tool, Ihre Regeln, viele Dateien

Die Markenregeln liegen im Tool. Richten Sie das Tool einmal ein, und jede Ausgabe erhält dieselbe Schrift, dieselbe Farbe und dieselben Abstände, von einer einzelnen Karte bis zu einer Tabelle voller Zeilen in einem Dutzend Sprachen.

![Ein Wortmarken-Tool mit einem ausgefüllten Feld: Schrift, Farbe und Abstände wurden beim Erstellen des Tools festgelegt](/info/shots/aud-rules-in-the-tool.svg)

Wer die hundertste Datei erstellt, gibt nur noch den Text ein. Sie entscheiden, wie die Arbeit geprüft wird und wer sie prüft. Mit Lolly gibt es weniger zu prüfen, und die nächste Datei ist schneller fertig.

<!--i:eti-users-->
## Wer mit einem Tool arbeitet

Drei Rollen in einer Organisation arbeiten an einer Kampagnenkarte.

![Eine Designerin legt die Regeln einmal in einem Tool fest; ein Entwickler führt es über ein Skript aus und alle können seine Felder ausfüllen; beide Wege erzeugen fertige Dateien](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Eine Designerin legt die Regeln fest.** Sie gestaltet die Karte in Lolly Design mit der Schrift und den Farben der Marke und wählt dann, welche Felder offen bleiben. Das tut sie einmal, damit niemand die Karte erneut von Hand lokalisieren muss.
- <!--i:code--> **Ein Entwickler erweitert den Einsatz des Tools.** Dasselbe Tool läuft über die Befehlszeile in einem nächtlichen Skript. Ein aktuelles Diagramm oder eine neue Sprachversion entsteht, ohne dass jemand das Design erneut öffnet.
- <!--i:people--> **Alle können es ausfüllen.** Ein Vertriebsmitarbeiter im Flugzeug öffnet das Tool ohne Netz und ohne Designausbildung und erstellt die Karte für das morgige Treffen.
:::

Das aktuelle Diagramm des Entwicklers ist ein Rendering wie dieses, erstellt aus einer Datenzeichenfolge und wenigen Einstellungen:

![Ein gestapeltes Flächendiagramm mit Titel und drei Datenreihen in einer kühlen Palette, dessen Achsen, Legende und Titel alle von der Vorlage statt von Hand platziert wurden](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Dass der Vertriebsmitarbeiter nur eine Minute braucht, liegt an den Regeln der Designerin und dem Skript des Entwicklers. Alle Rollen arbeiten mit demselben Tool.

<!--i:eti-train-->
## Vier Wege zu einer Datei

Jeder Weg führt dieselbe Engine mit demselben Tool aus. So entspricht die Datei, die ein Skript erstellt, der Vorschau in der App.

![URL-Parameter und Befehlszeilenargumente werden zum selben Eingabemodell, das eine gemeinsame Laufzeit und Exportbrücke durchläuft](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **In der App, eine Datei nach der anderen.** Öffnen Sie ein Tool, füllen Sie die Felder aus und drücken Sie **Export**. [Ihre erste Datei erstellen](/info/make-something.html) führt Sie durch ein Beispiel.
- <!--i:layers--> **In der App, viele auf einmal.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) nimmt eine eingefügte oder importierte Tabelle und rendert pro Zeile eine fertige Datei.
- <!--i:cpu--> **Über ein Skript oder einen KI-Agenten.** Die [CLI](/info/cli.html) führt ein Tool ohne grafische Oberfläche aus, und der [MCP-Server](/info/mcp.html) lässt einen Agenten Tools finden und ausführen. Ein Link zu einem Tool enthält auch dessen Eingaben, ist also eine vollständige Anfrage.
- <!--i:server--> **Über den Server Ihrer Organisation.** [Lolly Work](/info/organisation.html) rendert auf dem Server gemäß den Anmelde- und Tool-Richtlinien Ihrer Organisation, speichert fortsetzbare Aufträge und hält die Ausgabe zum Download oder zur genehmigten Lieferung bereit.

Welchen Weg ein Auftrag nutzen kann, hängt von den Formaten des Tools und den Möglichkeiten des Hosts ab. Manche Formate brauchen einen Browser, daher übergibt die Befehlszeile sie an eine Browser-Ebene. [Mit der CLI rendern](/info/cli-rendering.html) listet auf, welche Formate wo gerendert werden.

<!--i:eti-monitor-->
## Was wo läuft

Erstellen, Bearbeiten und Exportieren laufen ohne Konto auf Ihrem Gerät. Eine Funktion, die einen Server braucht, etwa Sync oder das Senden einer Datei an einen verbundenen Dienst, stellt nur dann eine Verbindung her, wenn Sie diese Funktion verwenden. Mit Lolly Work nutzen gemeinsame Projekte, Live-Bearbeitung im Team, Freigaben und Serveraufträge den Server Ihrer Organisation. [Was wo läuft](/info/compare.html#what-runs-where) stellt die beiden Teile gegenüber.

<!--i:eti-graduation-cap-->
## Weiterlesen

- [Ihre erste Datei erstellen](/info/make-something.html), um es jetzt auszuprobieren.
- [Start](/info/quickstart.html), um Ihr eigenes Designsystem einzubinden.
- [Automatisieren](/info/builders.html), für die Befehlszeile, Links und Agenten.
- [Lolly-Architektur](/info/overview.html), für Mitwirkende: die Engine, die Oberflächen und die Regeln, die sie zusammenhalten.
