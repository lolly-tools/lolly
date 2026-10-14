# Lolly und Penpot

_Zuletzt geprüft: 28. September 2026._

Lolly und Penpot bieten beide Open-Source-Designwerkzeuge, gemeinsame Design-Tokens und Live-Zusammenarbeit. Lolly verbindet Erstellung auf dem Gerät mit [lolly.work](https://lolly.work), seinem getrennt betriebenen Organisationsdienst.

## Gemeinsame Design-Grundlagen

[Die Design-Tokens von Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) nutzen das DTCG-Format, das auch Lolly liest. Farben, Schrift und andere Token-Werte lassen sich in beiden Arbeitsabläufen teilen. [Design importieren](/info/design-import.html) in Lolly öffnet einen `.penpot`-Export als bearbeitbares Layout.

Das Lolly-Export-Plugin für Penpot wird von Lolly gepflegt. Es nutzt die Engine von Lolly für optionale C2PA Content Credentials auf dem Gerät. Integrität der Signatur und Vertrauen in den Unterzeichner sind zwei verschiedene Dinge: Ein Prüfer braucht eine Identität, der er vertraut, wie unter [Content Credentials Identity](/info/content-credentials-identity.html) beschrieben.

## Design- und Team-Abläufe

[Penpot](https://penpot.app/) bietet Interface-Design, Komponenten, flexible Layouts, interaktive Prototypen und Entwickler-Inspektion. Es gibt gehostete und selbst gehostete Bereitstellungen, mit [Installationsoptionen für Docker und Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Die Design-Arbeitsfläche von Lolly erstellt bearbeitbare Assets und kann ein Layout in ein [Werkzeug mit Regeln](/info/create-a-tool.html) verwandeln. Dasselbe Werkzeug rendert im Browser, in der Desktop-App oder in der CLI und kann aus Daten Varianten erzeugen. Für die Teamarbeit bietet Lolly sowohl direkte [private Collabs](/info/collaborate.html) zwischen zwei Geräten als auch Work-Collabs über lolly.work, mit gemeinsamen Bearbeitungen, Cursorn und gespeicherten Team-Sitzungen.

## Wie sich die Bereitstellungen unterscheiden

Eigenständiges Lolly rendert und signiert auf dem Gerät, ohne Konto und ohne Server. lolly.work ergänzt SSO, SCIM-Provisionierung, gemeinsame Kataloge und Projekte, Rollen, Freigaben, Audit-Protokolle und Server-Rendering. Beide Repositories sind Open Source unter MPL-2.0 und können von der Organisation betrieben werden. Gemeinsame Arbeit nutzt die konfigurierte Instanz; die lokale Erstellung bleibt unabhängig davon verfügbar.

Die Wahl hängt von der Arbeit ab: dem Interface-Design- und Prototyping-Ablauf von Penpot, der wiederholbaren Asset-Produktion von Lolly oder einer Kombination aus gemeinsamen Tokens und importierten Designs. Die Work-Collaboration von Lolly läuft derzeit auf einem einzelnen Server-Knoten, und der [Bereitstellungsstatus](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) sollte Teil der Evaluierung einer Organisation sein.

Penpot ist eine Marke ihres Inhabers. Das oben genannte Plugin stammt von Lolly. Den weiteren Vergleich finden Sie unter [So schneidet Lolly im Vergleich ab](/info/positioning.html) und in der [Übersicht der Gesamtlösung](/info/compare.html).
