# Lolly und Rendering-APIs

_Zuletzt geprüft: 28. September 2026._

Lolly erzeugt Assets aus Vorlagen und Daten auf Ihrem Gerät, in CI oder über die Server-API von [lolly.work](https://lolly.work). Die Gesamtlösung deckt automatisiertes Rendering ab sowie Identität, Richtlinien und Auslieferung rund um die Produktionsaufträge einer Organisation.

## Wo sie sich überschneiden

[Bannerbear](https://www.bannerbear.com/) und [Placid](https://placid.app/) erzeugen Bilder und andere Medien aus Vorlagen über APIs und Integrationen. Lolly verfolgt denselben Ansatz aus Vorlage plus Eingaben, mit [URL-Modus](/info/url-mode.html), [CLI](/info/cli.html), Batch-Raster und Server-Endpunkten als Wegen, Aufträge einzureichen.

## Was lolly.work bietet

lolly.work ist der getrennt betriebene Organisationsdienst im Lolly-Projekt. Er führt die Lolly-Engine hinter einer API aus, wendet Richtlinien für Werkzeugsichtbarkeit und Eingaben an und liefert gerenderte Dateien sowie signierte Freigabelinks aus. Sein [wiederherstellbarer Render-Dienst](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) unterstützt Einzelaufträge und Batches, idempotente Einreichung, Status, begrenzte Wiederholungen, Abbruch und aufbewahrte Ausgaben. Unterbrochene Arbeit kann nach einem Server-Neustart fortgesetzt werden, wenn persistenter Speicher konfiguriert ist.

Der Server nutzt einen schnellen SVG/PNG-Renderpfad und einen optionalen Chromium-Worker für Werkzeuge, die einen Browser benötigen. Automatisierungen authentifizieren sich mit Service-Tokens, und fertige Ausgaben können über [Governed Delivery](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) an Ziele der Organisation gesendet werden. Eine konfigurierte Signaturidentität aktiviert C2PA-Signierung für unterstützte Server-Ausgaben.

## Wer den Dienst betreibt

Bannerbear und Placid bieten Rendering als verwaltete Dienste mit eigener Infrastruktur und eigenen Integrationen. Mit Lolly kann eine Einzelperson lokal rendern oder ein Team lolly.work auf eigener Infrastruktur betreiben. Beide Lolly-Repositories sind Open Source unter MPL-2.0; beim Selbst-Hosting fällt keine Software-Lizenzgebühr pro Rendering an, doch Rechenleistung, Speicher und Betrieb bleiben Kosten, die eingeplant werden müssen.

Die öffentliche Website lolly.work ist eine Evaluierungs-Sandbox und keine Zusage für Produktions-Hosting. Ein dauerhafter Dienst braucht persistenten Datenbank- und Ausgabespeicher; browserabhängige Werkzeuge brauchen den Chromium-Worker. Die [Installationsanleitung](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) und die [Statusseite](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) beschreiben diese Voraussetzungen und aktuellen Einschränkungen.

Lokales Rendering und Rendering in CI bleiben ohne den Organisationsdienst möglich. Wer einen Server-Auftrag einreicht, sendet dessen Eingaben und benötigte Assets an diese Instanz; das unterscheidet sich vom Weg auf dem Gerät. Siehe die [Übersicht der Gesamtlösung](/info/compare.html).

Bannerbear und Placid sind Marken ihrer Inhaber. Diese Seite beschreibt, wo sich die Lösungen überschneiden, und steht in keiner Verbindung zu einem der beiden.
