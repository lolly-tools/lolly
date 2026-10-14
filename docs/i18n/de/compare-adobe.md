# Lolly und Adobe

_Zuletzt geprüft: 28. September 2026._

Lolly deckt Bildbearbeitung und -konvertierung, Layout, wiederholbare Markenproduktion, Druckausgabe und Content Credentials ab. [lolly.work](https://lolly.work) ergänzt diesen kreativen Arbeitsablauf um Organisationsidentität, gemeinsame Assets, Freigaben und automatisierte Produktion auf dem Server.

## Wo sie sich überschneiden

Beide unterstützen Aufgaben wie das Skalieren von Bildern, das Gestalten von Layouts und den Export in professionelle Formate. Lolly unterstützt PDF/X, CMYK und Raster-Ausgabe mit hoher Bittiefe, mit [formatspezifischen Fähigkeiten](/info/formats.html). Die Hilfsprogramme auf dem Gerät konvertieren und bereinigen Dateien, ohne sie hochzuladen.

Die Spezialanwendungen von Adobe decken umfangreiche kreative Arbeitsabläufe ab. [Photoshop](https://www.adobe.com/products/photoshop.html) bietet zum Beispiel detaillierte Werkzeuge für Fotobearbeitung, Auswahl, Maskierung und Compositing. Vergleichen Sie die Bearbeitungsschritte, die Ihre Arbeit erfordert, mit den Werkzeugen von Lolly; ein wiederkehrendes Marken-Asset und eine aufwendige Retusche können unterschiedliche Anforderungen haben.

## Erstellung und Organisationsdienste

Eigenständiges Lolly läuft ohne Adobe-Konto und ohne Lolly-Konto und nutzt dieselbe Engine im Browser, in der Desktop-App und in der CLI. Vorlagen und Design-Tokens machen Ergebnisse wiederholbar, und [Mit Regeln teilen](/info/create-a-tool.html) macht aus einem Design ein Werkzeug, das andere ausfüllen können.

lolly.work ist ein eigener Dienst innerhalb des Lolly-Projekts und wie die kreativen Apps Open Source unter MPL-2.0. Er liefert SSO, SCIM, gemeinsame Kataloge und Projekte, Freigaben, Zugriffsrichtlinien, Audit-Protokolle und Server-Rendering. Eine Organisation kann beide Teile selbst betreiben und bestehende Asset-Bibliotheken anbinden. Lokale Erstellung bleibt auf dem Gerät; gemeinsame Arbeit und Server-Aufträge nutzen die konfigurierten Dienste.

## Content Credentials und Identität

Lolly kann unterstützte Exporte auf dem Gerät signieren, wobei Content Credentials vom Nutzer aktiviert werden. Ein auf dem Gerät erzeugter Schlüssel belegt die Integrität der Dateisignatur; ein Prüfer muss dem Unterzeichner dennoch vertrauen, bevor er eine verifizierte Identität anzeigt. Eine Organisation kann eine eigene Zertifizierungsstelle verwenden und deren Stammzertifikat an ihre Prüfer verteilen. lolly.work unterstützt außerdem das Signieren auf dem Server mit einem konfigurierten Organisationszertifikat und -schlüssel.

Damit stehen innerhalb der Lolly-Lösung sowohl persönliche als auch organisationsweite Signaturen zur Verfügung. Siehe [Content Credentials Identity](/info/content-credentials-identity.html), die [Signieranleitung von lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) und die [Übersicht der Gesamtlösung](/info/compare.html). Transformations-Hilfsprogramme auf dem Gerät fügen keine Lolly-Wasserzeichen oder Herkunftsmetadaten hinzu.

Adobe, Photoshop und Creative Cloud sind Marken von Adobe. Diese Seite beschreibt, wo sich die Lösungen überschneiden, und steht in keiner Verbindung zu Adobe.
