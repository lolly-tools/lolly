# Lolly im Vergleich, Tool für Tool

Diese Seiten sagen, ob Lolly ein anderes Produkt ersetzt, es ergänzt oder nicht zu Ihrer Arbeit passt. Jede Seite beginnt damit, was das andere Produkt besser macht.

_Zuletzt geprüft: 28. September 2026._

<!--i:eti-grid-->
## Nach Produkt vergleichen

- [Lolly und Canva](/info/compare-canva.html) - Vorlagen, alltägliches Design und gemeinsame Produktion von Markeninhalten.
- [Lolly und Adobe](/info/compare-adobe.html) - Bearbeitung, Umwandlung, professionelle Ausgabe und Content Credentials.
- [Lolly und Figma](/info/compare-figma.html) - Design, Live-Zusammenarbeit und wiederverwendbare Asset-Produktion.
- [Lolly und Penpot](/info/compare-penpot.html) - Open-Source-Design, gemeinsame Tokens und Arbeit in Organisationen.
- [Lolly und Markenportale](/info/compare-brand-portals.html) - freigegebene Bibliotheken, gesperrte Vorlagen, Identität, Prüfung und Berichte.
- [Lolly und Rendering-APIs](/info/compare-render-apis.html) - automatisierte Erzeugung auf Ihrem Gerät, in CI oder auf Ihrem eigenen Server und [der Umstieg](/info/work-move-from-render-api.html) von Bannerbear oder Placid.
- [Lolly und Online-Dateikonverter](/info/compare-converters.html) - Formatumwandlung auf Ihrem eigenen Gerät.

[Lolly im Vergleich](/info/positioning.html) bietet den Vergleich einzelner Funktionen. Jeder Vergleich ist datiert. Eine Aussage, die auf eines der Produkte nicht mehr zutrifft, muss korrigiert werden.

<!--i:eti-map-pin-->
## Was wo läuft

Jeder Vergleich behandelt zwei Teile eines Open-Source-Projekts. **Lolly** umfasst die Engine, Apps und Tools. **Lolly Work** ist der Server für Organisationen, gepflegt im [lolly-work-Repository](https://github.com/lolly-tools/lolly-work). Beide stehen unter MPL-2.0, und eine Organisation entscheidet, welche Dienste von Lolly Work sie einschaltet.

::: cols
## Auf Ihrem Gerät: Lolly

- Kein Konto für die eigenständige Nutzung
- Erstellen, Bearbeiten, Umwandeln und Exportieren
- Funktioniert offline, sobald die benötigten Tools und Assets gespeichert sind
- Auf dem Gerät signierte Content Credentials
- Private Zusammenarbeit zwischen zwei Geräten, ohne Server

## Auf dem Server Ihrer Organisation: Lolly Work

- Single Sign-on, SCIM-Bereitstellung, Rollen und Richtlinien
- Gemeinsame Kataloge, Teamprojekte und Zusammenarbeit in der Organisation
- Freigaben, Nutzungsberichte und Audit-Aufzeichnungen
- Server-Rendering, wiederaufnehmbare Aufträge und freigegebene Lieferung
- Server-Signierung mit der Identität der Organisation
:::

Bei eigenständiger Nutzung bleiben Dateien auf dem Gerät. Wenn Sie gemeinsame Projekte, eine Zusammenarbeit in der Organisation, ein Server-Rendering oder eine Lieferung wählen, werden die für diese Funktion benötigten Daten an den Server Ihrer Organisation gesendet.

<!--i:eti-info-->
## Was jeder Vergleich voraussetzt

Diese Grenzen gelten für jede Seite dieser Reihe:

- **Die Zusammenarbeit in Lolly Work läuft derzeit auf einem einzelnen Serverknoten.** Ihr Umfang und ihre Betriebserfahrung unterscheiden sich von denen der seit Langem etablierten gehosteten Produkte. [Lolly Work: Status und Roadmap](/info/work-status.html) hält die aktuellen Grenzen fest.
- **Die Website unter [lolly.work](https://lolly.work) ist eine Demo-Sandbox.** Eine dauerhafte Bereitstellung für eine Organisation braucht persistenten Speicher und einen Betreiber. [Lolly Work installieren](/info/work-install.html) behandelt beides.
- **Es gibt keine Softwarelizenzgebühr pro Nutzer** für Lolly oder ein selbst gehostetes Lolly Work. Hosting, Speicher und Betrieb kosten weiterhin Geld.
- **Eine Signatur macht den Unterzeichner nicht vertrauenswürdig.** Ein Prüfprogramm zeigt den Unterzeichner nur dann als vertrauenswürdig an, wenn es dem Zertifikat vertraut, mit dem die Datei signiert wurde. [Identität bei Content Credentials](/info/content-credentials-identity.html) erklärt, wie das funktioniert.
