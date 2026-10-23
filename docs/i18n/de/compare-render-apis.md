# Lolly und Rendering-APIs

_Zuletzt geprüft: 28. September 2026._

Wenn Sie heute über eine API Bilder aus Vorlagen erzeugen, sagt diese Seite, wie Lolly dieselbe Aufgabe auf Ihrem eigenen Gerät, in der CI oder auf Ihrem eigenen Server erledigt.

## Was gehostete Rendering-APIs besser können

[Bannerbear](https://www.bannerbear.com/) und [Placid](https://placid.app/) bieten Rendering als verwaltete Dienste an, mit eigener Infrastruktur, Integrationen und Support. Sie senden eine Anfrage, und jemand anderes betreibt die Server.

## Wo sie sich überschneiden

Beide machen aus einer Vorlage plus Eingaben Medien. Lolly nimmt die Eingaben aus einem [Link](/info/url-mode.html), der [CLI](/info/cli.html), einem Batch-Raster oder einem Server-Endpunkt.

## Wie Lolly die überlappende Aufgabe erledigt

Dasselbe Tool rendert auf einem Laptop, in einem CI-Job oder auf einem Server, aus denselben Eingaben. Lokales und CI-Rendering brauchen überhaupt keinen Dienst.

![Batch-Export-Einstellungen: Dateiname, Standardformat, Einheiten, DPI und die Zahl der zu rendernden Zeilen](/info/shots/use-batch-toolbar.svg)

Auf einem Server führt [Lolly Work](/info/compare.html#what-runs-where) die Lolly-Engine hinter einer API aus und wendet Tool-Sichtbarkeit und Eingaberichtlinien an. Sein [wiederaufnehmbarer Render-Dienst](/info/work-renders.html) unterstützt einzelne Aufträge und Batches, idempotente Einreichung, Status, begrenzte Wiederholungen, Abbruch und aufbewahrte Ausgaben, und unterbrochene Arbeit wird nach einem Neustart fortgesetzt, wenn persistenter Speicher konfiguriert ist.

Der Server hat einen schnellen SVG- und PNG-Pfad und einen optionalen Chromium-Worker für Tools, die einen Browser brauchen. Automatisierung meldet sich mit Service-Tokens an, fertige Ausgabe kann über [freigegebene Lieferung](/info/work-delivery.html) an Organisationsziele gehen, und eine konfigurierte Signaturidentität fügt unterstützter Ausgabe Content Credentials hinzu.

## Wer den Dienst betreibt

Mit Lolly rendert eine Einzelperson lokal, oder ein Team betreibt Lolly Work auf seiner eigenen Infrastruktur. Das Einreichen eines Server-Auftrags sendet seine Eingaben und die nötigen Assets an diese Instanz, was sich vom Pfad auf dem Gerät unterscheidet. Ein dauerhafter Dienst braucht eine persistente Datenbank und Ausgabespeicher, und browserabhängige Tools brauchen den Chromium-Worker; [Lolly Work installieren](/info/work-install.html) beschreibt beides.

Bannerbear und Placid sind Marken ihrer Inhaber. Diese Seite beschreibt, wo sich die Produkte überschneiden, und steht in keiner Verbindung zu einem von beiden.
