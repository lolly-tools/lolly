# Lolly und Figma

_Zuletzt geprüft: 28. September 2026._

Lolly unterstützt Design, Live-Bearbeitung und wiederverwendbare Asset-Produktion. [lolly.work](https://lolly.work) ergänzt die Organisationsdienste rund um diese Arbeit: Identität, gemeinsame Projekte, Zugriffskontrollen und Freigaben.

## Wo sie sich überschneiden

Mit beiden lassen sich Schrift, Formen und Bilder auf einer Arbeitsfläche anordnen und mit anderen zusammenarbeiten. [Design importieren](/info/design-import.html) in Lolly liest Figma-Dateien als bearbeitbare Layouts. Auch Figma deckt vorlagenbasierte Markenproduktion ab: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) erstellt Assets aus Vorlagen und füllt sie aus CSV- oder XLSX-Dateien.

Lolly macht aus einem Design ein [wiederverwendbares Werkzeug mit Regeln](/info/create-a-tool.html). Dieses Werkzeug läuft im Browser oder in der CLI und nimmt Eingaben aus einer URL, einem Skript oder dem Batch-Raster entgegen. Dieselbe Vorlage dient der Einzelperson, die ein Asset bearbeitet, ebenso wie dem Team, das viele Varianten produziert.

## Zusammenarbeit und Produktdesign

[Figma Design](https://www.figma.com/design/) vereint Interface-Design, Komponenten, interaktive Prototypen und Übergabe an Entwickler. Der etablierte Produktdesign-Ablauf und das Ökosystem sind relevant, wenn ein Team eine vollständige Anwendung entwerfen und spezifizieren muss.

Lolly bietet zwei Arten der Live-Zusammenarbeit. Ein [privates Collab](/info/collaborate.html) koppelt zwei Geräte direkt, ohne Konto und in einem gemeinsamen Netzwerk ohne Internet. Ein Work-Collab nutzt lolly.work für authentifizierten Zugriff, gemeinsame Bearbeitungen, Live-Cursor und gespeicherte Team-Sitzungen. Work-Collaboration ist sowohl im Lolly-Client als auch im lolly.work-Server umgesetzt; die aktuelle Bereitstellung mit einem einzelnen Knoten belegt keine Gleichwertigkeit mit dem Betriebsumfang von Figma.

## Bereitstellung und Produktion

Die kreativen Apps von Lolly und lolly.work sind getrennt betriebene Teile desselben Open-Source-Projekts. Eigenständiges Lolly kann offline und ohne Konto rendern. lolly.work liefert SSO, SCIM, gemeinsame Kataloge, Projektberechtigungen, Freigaben, Audit-Protokolle und Server-Rendering auf Infrastruktur, die die Organisation kontrolliert.

Team-Sitzungen und Bearbeitungen in Work-Collabs gelangen auf diese Instanz; lokale Renderings können auf dem Gerät bleiben. Content Credentials sind für unterstützte Exporte optional, und das Signieren auf dem Server verwendet eine konfigurierte Organisationsidentität. Siehe die [Übersicht der Gesamtlösung](/info/compare.html) zur Trennung und [Content Credentials Identity](/info/content-credentials-identity.html) dazu, wie ein Prüfer dem Unterzeichner vertraut.

Figma ist eine Marke ihres Inhabers. Diese Seite beschreibt, wo sich die beiden Lösungen überschneiden, und steht in keiner Verbindung zu Figma.
