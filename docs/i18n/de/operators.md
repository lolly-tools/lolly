# Lolly für Operatoren

Sie sind die Person, die zu etwas ja gesagt hat, das sowohl sicher als auch beliebt ist. Sie schließen ein Exfiltrationsloch, gewinnen Fähigkeiten hinzu und streichen eine Anfragewarteschlange in einem Zug - der seltene Sicherheitsgewinn, der Sie beliebter macht statt weniger beliebt: kein Anruf um drei Uhr nachts, weil embargierte Dateien bei einem beliebigen Web-Tool gelandet sind, weniger Anbieter und Verträge auf Ihrem Tisch, und ein Nachweis, auf den Sie zeigen können, wenn jemand fragt. Wählen Sie unten die Spur, die zu der Funktion passt, für die Sie verantwortlich sind.

Sie steuern die gesamte Staffel: Eine kreative Person verfasst die Regeln, ein Entwickler skaliert sie, und es ist der Betreiber, der das sicher macht für den Einsatz in einer ganzen Organisation - dem [Der Lebenszyklus einer Kampagne](/info/overview.html#the-lifecycle-of-a-campaign) von Anfang bis Ende folgt.

Neu hier? [Einführung & Governance](/info/adoption-governance.html) ist der vollständige Rollout. [Deployment](/info/deployment.html) behandelt Deploy, Serve und Hybrid, und [Konfiguration](/info/configuration.html) ist das, was eine einzelne Instanz formt.

## Vertrieb

Gehen Sie mit genau der Datei ins Meeting, die Sie brauchen, erstellt auf dem Weg dorthin. Werfen Sie die Präsentation, die Sie bereits haben, hinein und bauen Sie sie scharf als native Präsentationsdatei neu auf, ohne Anfragewarteschlange zwischen Ihnen und dem Asset.

- **[Lolly für Vertriebsteams](/info/sales.html)** - das Playbook: die vorhandene Präsentation reparieren, sie nativ neu aufbauen und das Einzelasset selbst erstellen.
- **[Exportieren & Formate](/info/exporting.html)** - die Präsentations-, PDF- und Bild-Seite des Exportfensters, wenn die Datei auf dem Laptop einer anderen Person geöffnet werden muss.

## Presse

Live-Daten in Diagramme, Karten und Tabellen, die bereits dem Hausstil entsprechen. Bauen Sie das Story-Format einmal und nutzen Sie es jedes Mal wieder, wenn die Geschichte läuft, für Print und für den Bildschirm.

- **[Lolly für die Redaktion](/info/press.html)** - das Playbook: der Info-Redaktionsstil, Live-Daten hinein und Ausgabe in Publikationsqualität.
- **[Utility-Ansichten](/info/utilities.html)** - die Tabellenkalkulation und der Konverter, für den Schritt vor dem Diagramm.

## Marketing

Jede Größe, jede Sprache, eine einzige Quelle der Wahrheit. Fügen Sie eine Tabelle ein und erhalten Sie eine fertige Datei pro Zeile, ohne Agentur mittendrin bei den Routinedateien.

- **[Lolly für Marketingteams](/info/marketing.html)** - das Playbook: Varianten in großer Zahl, Lokalisierung und was aufhört, ein Engpass zu sein.
- **[Lolly nutzen](/info/using.html#batch-pro-mode)** - der Stapellauf selbst: eine Tabelle hinein, ein Ordner voller Assets heraus.

## Sicherheit

Die übliche Art, wie Routine-Kreativarbeit erledigt wird, ist eine Haftungsfläche: Dateien werden an externe Auftragnehmer gemailt, Markenassets in ein Dutzend Web-Editoren hochgeladen, Kundendaten auf einer fremden Website eingefügt, um schnell eine Grafik zu erstellen. Lolly ist die Immunreaktion darauf, weil es die Arbeit ersetzt, statt eine Kontrolle obendrauf zu legen: die Zitatkarte, das lokalisierte Banner und der geschwärzte Screenshot entstehen auf dem eigenen Gerät der Mitarbeitenden, geprüft gegen Ihre Marke, sodass nichts hochgeladen wird, das Sie nicht selbst dort hineingegeben haben, und jedes Ergebnis aus seinen Eingaben reproduzierbar ist. Exporte können mehrere Schichten kryptografischer Aufzeichnung tragen - eine C2PA Content Credential, signiert mit einem Schlüssel, der auf dem Gerät erzeugt wird und nie von dort auslesbar ist, den unsichtbaren Lolly Imprint und eine optionale dauerhafte Markierung, die ein erneutes Speichern übersteht -, von denen jede manipulationssichtbar und entfernbar ist: Eine Credential zeigt eine Änderung an, statt sie zu verhindern, und genau das macht eine vollständig offline durchführbare Prüfung erst möglich. Die Kryptografie und die Datei-Parser werden derzeit von SUSE auf Enterprise-Niveau gehärtet: Die Siegel, die geräteseitige Signierung und die Verschlüsselung sind schon jetzt echt und belastbar, daher setzen Sie sie dort, wo ein Vertrag eine zertifizierte Zusicherung verlangt, als zusätzliche Verteidigungsebene ein, während dieser Prozess abgeschlossen wird.

- **[Vertrauen](/info/trust.html)** - jede Behauptung, die diese Website aufstellt, mit dem Mechanismus, der sie durchsetzt, direkt daneben.
- **[Sicherheit & Verifizierung](/info/security.html)** - die Standards, Primitive, das Vertrauensmodell und die Tests, geschrieben für eine prüfende Person.
- **[Bedrohungsmodell & Vertrauensgrenzen](/info/threat-model.html)** - wogegen Lolly schützt, was es ausdrücklich nicht tut und wo jede Grenze verläuft.
- **[Serverseite](/info/server-surface.html)** - das vollständige Inventar dessen, was serverseitig läuft (zwei optionale Komponenten), gegenüber dem, was auf dem Gerät läuft.
- **[Parser-Inventar](/info/parser-inventory.html)** - jeder Parser, der eine von Nutzern geöffnete Datei berührt, und wogegen jeder einzelne gehärtet ist.
- **[Selbst nachprüfen](/info/verify-yourself.html)** - prüfen Sie die Behauptungen Schritt für Schritt an einem echten Export nach, mit nichts, was Sie nicht selbst ausführen können.
- **[Datenschutzerklärung](/info/privacy.html)** - die formale Erklärung dessen, was gesammelt, gespeichert und gesendet wird und was nicht.
- **[Souveräne Kreativproduktion](/info/sovereign-production.html)** - Air-Gap-Deployment, zustimmungsgebundene Netzwerknutzung und geräteseitige Signierung.
- **[Einführung & Governance](/info/adoption-governance.html)** - wer ein Tool freigibt, wie Markenregeln durchsetzbar werden und was die Option, den Katalog als Repository zu führen, bringt.

## Rechtliches

MPL-2.0 ohne Contributor License Agreement, klar ausgesprochen, wobei das, was nicht behauptet wird, ebenso klar gesagt wird wie das, was behauptet wird. Content Credentials sind manipulationssichtbar und entfernbar, daher sagen die Seiten unten, was eine Signatur tatsächlich zusichert, bevor jemand sie in einen Vertrag schreibt.

- **[KI-Kennzeichnung und die EU-KI-Verordnung](/info/eu-ai-act.html)** - Artikel 50, der Code of Practice, der auf C2PA verweist, und wie ehrlich Lolly dazu passt.
- **[Wie Lolly im Vergleich abschneidet](/info/positioning.html)** - die Lizenzfakten: MPL-2.0, kein Contributor License Agreement und worauf "für immer kostenlos" tatsächlich beruht.
- **[Content Credentials Identity](/info/content-credentials-identity.html)** - was eine signierte Credential zusichert, was nicht, und wen das Zertifikat nennt.
- **[Datenübertragung](/info/data-transfer.html)** - das Backup-Bündel, mit dem eine Auskunftsanfrage oder eine Geräteübergabe beantwortet wird.

## KI

Agenten liefern Eingaben, niemals eine Persona. KI hilft, wenn sie gefragt wird, was sie erzeugt hat, sagt das auch, und Ihre Arbeit trägt Ihren Namen statt den eines Modells.

- **[Unsere Haltung zu KI](/info/ai-stance.html)** - was Lolly mit generierten Inhalten tut und nicht tut, und was jede Zusage durchsetzt.
- **[Einmal erzeugt, immer gleich gerendert](/info/ai-features.html)** - die KI-Funktionen, die ausgeliefert werden, und warum das Erfinden von Pixeln gekennzeichnet wird, ihr Entfernen aber nicht.
- **[Eingabe, keine Verkörperung](/info/input-not-impersonation.html)** - warum ein Agent Eingaben liefert und niemals eine Persona, wie das durchgesetzt wird und was ein abtrünniger Agent trotzdem nicht kann.
- **[KI-Agenten](/info/ai-agents.html)** - was ein Agent tatsächlich steuern kann, falls Ihre Teams bereits einen darauf ansetzen.
