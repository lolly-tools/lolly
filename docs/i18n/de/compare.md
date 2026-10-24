# Lolly im Vergleich, Werkzeug für Werkzeug

Wenn Sie schon ein anderes Produkt nutzen, sagen diese Seiten, ob Lolly dieses Produkt ersetzt, neben ihm arbeitet oder nicht zu Ihrer Arbeit passt. Jede beginnt damit, was das andere Produkt besser kann.

_Zuletzt geprüft: 28. September 2026._

## Vergleich nach Produkt

- [Lolly und Canva](/info/compare-canva.html) - Vorlagen, alltägliches Design und gemeinsame Markenproduktion.
- [Lolly und Adobe](/info/compare-adobe.html) - Bearbeitung, Umwandlung, professionelle Ausgabe und Content Credentials.
- [Lolly und Figma](/info/compare-figma.html) - Design, Live-Zusammenarbeit und wiederverwendbare Asset-Produktion.
- [Lolly und Penpot](/info/compare-penpot.html) - Open-Source-Design, gemeinsame Tokens und Organisationsarbeit.
- [Lolly und Marken-Portale](/info/compare-brand-portals.html) - freigegebene Bibliotheken, gesperrte Vorlagen, Identität, Prüfung und Berichte.
- [Lolly und Rendering-APIs](/info/compare-render-apis.html) - automatisierte Erzeugung auf Ihrem Gerät, in der CI oder auf einem Lolly-Work-Server.
- [Lolly und Online-Dateikonverter](/info/compare-converters.html) - Formatumwandlung auf Ihrem eigenen Gerät.

Eine Übersicht nach Funktionen finden Sie unter [So schneidet Lolly im Vergleich ab](/info/positioning.html). Jeder Vergleich ist datiert; eine Aussage, die für eines der beiden Produkte nicht mehr zutrifft, muss korrigiert werden.

## Was wo läuft

Jeder Vergleich betrifft zwei Teile eines Open-Source-Projekts. **Lolly** ist die Engine, sind die Apps und Tools. **Lolly Work** ist der Organisationsserver, gepflegt im [lolly-work-Repository](https://github.com/lolly-tools/lolly-work). Beide stehen unter MPL-2.0, und eine Organisation entscheidet, welche Lolly-Work-Dienste sie einschaltet.

::: cols
## Auf Ihrem Gerät: Lolly

- Kein Konto für die eigenständige Nutzung
- Erstellen, Bearbeiten, Umwandeln und Exportieren
- Funktioniert offline, sobald die nötigen Tools und Assets gespeichert sind
- Auf dem Gerät signierte Content Credentials
- Private Collabs zwischen zwei Geräten, ohne Server

## Auf dem Server Ihrer Organisation: Lolly Work

- Single Sign-on, SCIM-Bereitstellung, Rollen und Richtlinien
- Gemeinsame Kataloge, Team-Projekte und Work-Collabs
- Freigaben, Nutzungsberichte und Audit-Aufzeichnungen
- Server-Rendering, wiederaufnehmbare Aufträge und freigegebene Lieferung
- Server-Signatur mit der Identität der Organisation
:::

Die eigenständige Nutzung hält Dateien auf dem Gerät. Wer gemeinsame Projekte, eine Work-Collab, ein Server-Rendering oder eine Lieferung wählt, sendet die Daten, die diese Funktion braucht, an den Server Ihrer Organisation.

## Was jeder Vergleich voraussetzt

Diese Grenzen gelten für jede Seite dieser Reihe und werden daher einmal hier genannt:

- **Work-Collabs laufen heute auf einem einzelnen Serverknoten.** Ihr Maßstab und ihre Betriebshistorie unterscheiden sich von den lange etablierten gehosteten Produkten. [Work-Status und Roadmap](/info/work-status.html) hält die aktuellen Grenzen fest.
- **Die Website [lolly.work](https://lolly.work) ist eine Demo-Sandbox.** Eine dauerhafte Organisationsbereitstellung braucht persistenten Speicher und einen Betreiber; [Lolly Work installieren](/info/work-install.html) behandelt beides.
- **Es gibt keine Softwarelizenzgebühr pro Platz** für Lolly oder ein selbst gehostetes Lolly Work. Hosting, Speicher und Betrieb kosten weiterhin Geld.
- **Eine Signatur ist kein vertrauenswürdiger Unterzeichner.** Ein Verifizierer muss dem Zertifikat vertrauen, das eine Datei signiert hat, bevor er den Unterzeichner als vertrauenswürdig zeigt; [Content-Credentials-Identität](/info/content-credentials-identity.html) erklärt, wie.
