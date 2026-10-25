# Wie Lolly funktioniert

Ein Lolly-Tool hält die Regeln für eine Art von Datei: das Layout, die Schrift, die Farben und welche Teile andere ändern dürfen. Sie, eine Kollegin, ein Skript oder ein KI-Agent füllen die Felder aus, und jede Datei wird richtig. Diese Seite zeigt, wer was tut, und die vier Wege von einem Tool zu einer fertigen Datei.

## Ein Tool, Ihre Regeln, viele Dateien

Die Markenregeln leben im Tool, nicht in jeder Datei, die es erzeugt. Wenn das Tool einmal stimmt, erbt jede Ausgabe dieselbe Schrift, Farbe und denselben Abstand, ob es eine Karte ist oder eine Tabelle voller Zeilen in einem Dutzend Sprachen.

![Ein Wortmarken-Tool mit einem ausgefüllten Feld: Schrift, Farbe und Abstand wurden festgelegt, als das Tool entstand](/info/shots/aud-rules-in-the-tool.svg)

Wer die hundertste Datei erstellt, tippt nur die Worte. Wie Sie die Arbeit prüfen und wer sie prüft, bleibt Ihre Entscheidung. Lolly macht das, was geprüft werden muss, kleiner und die nächste Datei schneller erstellt.

## Wer ein Tool anfasst

Folgen Sie einer Kampagnenkarte durch eine Organisation, und es erscheinen drei Paar Hände. Jedes baut auf dem vorigen auf.

![Eine Designerin legt die Regeln einmal in einem Tool fest; ein Entwickler führt es aus einem Skript aus, und jede und jeder kann seine Felder ausfüllen; beide erzeugen fertige Dateien](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Eine Designerin legt die Regeln fest.** Sie legt die Karte in Design mit Schrift und Farben der Marke an und wählt dann, welche Felder offen bleiben. Das tut sie einmal, damit niemand die Karte je wieder von Hand lokalisiert.
- <!--i:code--> **Ein Entwickler skaliert das Tool.** Dasselbe Tool läuft in einem nächtlichen Skript über die Kommandozeile, sodass ein frisches Diagramm oder eine neue Sprachversion ankommt, ohne dass jemand das Design wieder öffnet.
- <!--i:people--> **Jede und jeder füllt es aus.** Ein Vertriebsmitarbeiter im Flugzeug, ohne Netz und ohne Designausbildung, öffnet das Tool und erstellt die Karte für das Meeting von morgen.
:::

Das frische Diagramm im Schritt des Entwicklers ist ein Rendering wie dieses, aus einem Datenstring und ein paar Einstellungen erzeugt, ohne dass jemand eine Design-Datei öffnet:

![Ein Flächendiagramm mit Titel, gestapelt, seine drei Datenreihen in einer kühlen Palette abgestuft, mit Achsen, Legende und Titel, die die Vorlage statt von Hand platziert](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Die leichte Minute des Vertriebsmitarbeiters ist nur durch die Sorgfalt der Designerin und das Skript des Entwicklers möglich. Jede Rolle arbeitet mit demselben Tool, statt mit je einem eigenen Produkt.

## Vier Wege zu einer Datei

Jeder Weg führt dieselbe Engine auf demselben Tool aus; die Datei, die ein Skript erzeugt, entspricht also der, die Sie in der App in der Vorschau sehen.

![URL-Parameter und Kommandozeilenargumente werden zum selben Eingabemodell und laufen durch eine gemeinsame Laufzeit und Export-Bridge](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **In der App, eine nach der anderen.** Öffnen Sie ein Tool, füllen Sie die Felder aus und drücken Sie **Export**. [Ihre erste Datei erstellen](/info/make-something.html) führt Sie durch eine.
- <!--i:layers--> **In der App, viele auf einmal.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) nimmt eine eingefügte oder importierte Tabelle und rendert je Zeile eine fertige Datei.
- <!--i:cpu--> **Aus einem Skript oder von einem KI-Agenten.** Die [CLI](/info/cli.html) führt ein Tool headless aus, und der [MCP-Server](/info/mcp.html) lässt einen Agenten Tools finden und ausführen. Auch ein Link zu einem Tool trägt seine Eingaben, ein Link ist also eine vollständige Anfrage.
- <!--i:server--> **Über den Server Ihrer Organisation.** [Lolly Work](/info/organisation.html) rendert auf dem Server unter der Anmeldung und Tool-Richtlinie Ihrer Organisation, führt Aufträge, die es fortsetzen kann, und hält die Ausgabe zum Download oder zur freigegebenen Lieferung bereit.

Welchen Weg ein Auftrag nutzen kann, hängt von den Formaten des Tools ab und davon, was der Host kann: Manche Formate brauchen einen Browser, weshalb die Kommandozeile sie an eine Browser-Stufe übergibt. [Mit der CLI rendern](/info/cli-rendering.html) listet auf, welche Formate wo gerendert werden.

## Was wo läuft

Erstellen, Bearbeiten und Exportieren laufen auf Ihrem Gerät, ohne Konto. Eine Funktion, die einen Server braucht, etwa Sync oder das Senden einer Datei an einen verbundenen Dienst, verbindet sich nur, wenn Sie diese Funktion nutzen. Mit Lolly Work nutzen gemeinsame Projekte, Live-Bearbeitung im Team, Freigaben und Server-Aufträge den Server Ihrer Organisation. [Was wo läuft](/info/compare.html#what-runs-where) stellt die beiden Teile nebeneinander.

## Als Nächstes lesen

- [Ihre erste Datei erstellen](/info/make-something.html), um es jetzt auszuprobieren.
- [Start](/info/quickstart.html), um Ihr eigenes Designsystem einzubringen.
- [Automatisieren](/info/builders.html) für Kommandozeile, Links und Agenten.
- [Lolly-Architektur](/info/overview.html), für Mitwirkende: die Engine, die Shells und die Regeln, die sie zusammenhalten.
