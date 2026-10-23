# Lolly und Penpot

_Zuletzt geprüft: 28. September 2026._

Wenn Ihr Team in Penpot gestaltet, arbeitet Lolly neben Penpot: Beide sind Open Source, und beide lesen dieselben Design-Tokens. Diese Seite sagt, wofür jedes gedacht ist.

## Was Penpot besser kann

[Penpot](https://penpot.app/) bietet Oberflächengestaltung, Komponenten, flexible Layouts, interaktive Prototypen und Entwickler-Inspektion, mit Echtzeitbearbeitung und Live-Cursorn. Es bietet gehostete und selbst gehostete Bereitstellungen, mit [Installationsoptionen für Docker und Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Zum Gestalten einer Anwendung ist Penpot das Werkzeug.

## Wo sie sich überschneiden

[Die Design-Tokens von Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) nutzen das DTCG-Format, das auch Lolly liest, sodass Farben, Schrift und andere Token-Werte zwischen beiden wandern. [Ein Design importieren](/info/design-import.html) von Lolly öffnet einen `.penpot`-Export als bearbeitbares Layout, und **Send to Penpot** in Lolly sendet ein Design als `.penpot`-Archiv zurück. Lolly pflegt außerdem das [Lolly-Export-Plug-in für Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), das die Engine von Lolly nutzt, um auf dem Gerät Content Credentials als Opt-in hinzuzufügen.

## Wie Lolly die überlappende Aufgabe erledigt

Die Design-Arbeitsfläche von Lolly erzeugt bearbeitbare Assets und kann ein Layout in ein [Tool mit Regeln](/info/create-a-tool.html) verwandeln. Dasselbe Tool rendert im Browser, in der Desktop-App oder in der CLI und erzeugt Varianten aus Daten. Das eigenständige Lolly rendert und signiert auf dem Gerät, ohne Konto oder Server. Eine [private Collab](/info/collaborate.html) verbindet zwei Geräte direkt.

## Mit einer Organisation

Lolly Work ergänzt Single Sign-on, SCIM-Bereitstellung, gemeinsame Kataloge und Projekte, Rollen, Freigaben, Audit-Aufzeichnungen, Work-Collabs und Server-Rendering. Beide Repositories stehen unter MPL-2.0, und eine Organisation kann beide betreiben. [Was wo läuft](/info/compare.html#what-runs-where) stellt die beiden Teile nebeneinander.

Sie können beide nutzen: Penpot für Oberflächengestaltung und Prototyping, Lolly für wiederholbare Dateien, verbunden durch gemeinsame Tokens und importierte Designs.

Penpot ist eine Marke ihres Inhabers. Diese Seite beschreibt, wo sich die beiden Produkte überschneiden, und steht in keiner Verbindung zu Penpot.
