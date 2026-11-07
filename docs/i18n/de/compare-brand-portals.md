# Lolly und Marken-Portale

_Positionierung aktualisiert: 31. Oktober 2026. Beispiel für Anbieterfunktionen geprüft: 28. September 2026._

Wenn Ihre Organisation ihre freigegebenen Assets in Bynder, Frontify, Marq oder Brandfolder führt, vergleicht diese Seite das mit Lolly plus Lolly Work: wie Menschen Marken-Assets finden und wie sie daraus neue Dateien erstellen.

## Ihr bestehendes Portal behalten

Ein bestehendes DAM kann die maßgebliche Quelle bleiben. Die Katalog-Connectors von Lolly Work machen einen ausgewählten Teil seiner Bibliothek in Lolly verfügbar, wo Menschen unter den Regeln der Organisation neue Dateien erstellen. Die unterstützten Quellbeschränkungen des DAM und die Freigaberegeln von Lolly Work bestimmen den Zugriff; die Prüfung der fertigen Ausgabe ist eine eigene Entscheidung.

[Lolly mit Ihrem bestehenden DAM nutzen](/info/use-with-dam.html) erklärt die Zuständigkeiten und Grenzen. [SUSEs Brandfolder-Erfahrung](/info/suse-brandfolder.html) hält eine gelungene Integration fest, die das Änderungsmanagement der Administratoren vor einer geplanten Migration unterstützt hat. Die angebundene Quelle zu behalten bleibt eine unterstützte Wahl.

Lollys Zweck ist [Content-Souveränität](/info/content-sovereignty.html), einschließlich der Kontrolle über die Produktion und der Freiheit, Systeme zu wählen. Seine eigene Bibliothek und seine Freigaben unterstützen Organisationen, die diese Fähigkeiten selbst betreiben wollen. [Lolly für DAM-Anbieter und Umsetzungspartner](/info/dam-partners.html) beschreibt, wie der angebundene Workflow einem bestehenden maßgeblichen System Mehrwert bringen kann.

## Was ein etabliertes Portal besser kann

Etablierte Portale bieten verwaltetes Hosting, Support und umfangreiche Workflows der Asset-Verwaltung. [Das Enterprise-DAM von Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kombiniert zum Beispiel Asset-Suche, Zugriffskontrollen, Freigabe-Workflows und Verteilung. Der Lolly-Stack ist jünger, und seine Freigabeketten sind sequenziell statt beliebig verzweigende Workflows. [Status und Roadmap von Lolly Work](/info/work-status.html) hält seine Bereitstellungsgrenzen fest.

## Wo sie sich überschneiden

Beide decken freigegebene Assets, gesperrte Vorlagen, Zugriffskontrolle, Prüfung und Verteilung ab. Lolly erstellt die Dateien: Vorlagen, Design-Tokens und zulässige Eingaben legen fest, was jemand ändern kann, und das Rendern kann auf ihrem Gerät bleiben. Lolly Work ergänzt Identität, gemeinsamen Speicher, Richtlinien, Freigaben und Berichte auf Infrastruktur, die die Organisation kontrolliert.

![Das aktive Designsystem in Settings, als Titelseite und Seiten dargestellt: die Farben, Schriften und Logos, mit denen jedes Tool zeichnet](/info/shots/dashboard-brand.svg)

## Was Lolly und Lolly Work bieten

| Bedarf | Lolly + Lolly Work |
|---|---|
| Anmeldung und Bereitstellung | OIDC-Single-Sign-on, mehrere Identitätsanbieter, SCIM-2.0-Benutzerbereitstellung und Gruppenmitgliedschaft sowie Kontodeaktivierung, die bestehende Sitzungen widerruft. Ein Identitätsanbieter nur mit SAML kann sich über eine OIDC-Brücke wie Keycloak verbinden. |
| Freigegebene Vorlagen | Lolly definiert die bearbeitbaren Eingaben der Vorlage; Lolly Work wendet Gruppensichtbarkeit und Eingaberichtlinien an, die Werte sperren, Auswahlen beschränken oder Steuerelemente ausblenden. |
| Gemeinsame Asset-Bibliothek | Von der Instanz gehaltene Uploads, Sammlungen, benutzerdefinierte Metadaten und zugriffsgesteuerte Kataloge, dazu Connectors, die bestehende DAM- und Speicherbibliotheken lesen. |
| Prüfung | Geordnete Freigabeschritte, berechtigte Freigabegruppen, Quorum-Regeln und Funktionstrennung; die Prüfung kann Katalogeinreichungen und die Lieferung an Organisationsziele steuern. |
| Asset-Verlauf und Verfügbarkeit | Versionen und Rollback für von der Instanz gehaltene Assets, Aufbewahrung und Sperren, geplante Verfügbarkeit, Ablauf und Widerruf. Verbundene Anbieter behalten ihren eigenen Quellverlauf. |
| Lizenzen und Credits | Lolly erfasst die Lizenz jeder Quelle, die eine Datei nutzt, und bereitet die Credits vor, die es schuldet; [Kreativrechte und Credits](/info/creative-rights.html) erklärt, was es erfasst und wo Credits geschrieben werden. Es klärt keine Rechte. |
| Berichte | Zählwerte zur Asset-Nutzung und zu Downloads, Tool- und Export-Aktivität, Dashboards und ein Audit-Pfad. Die Zuordnung der Nutzung folgt der Telemetrie-Richtlinie der Bereitstellung; die Standard-Zuordnung verlangt Einwilligung. |
| Verteilung | Ablaufende, widerrufbare Links, gemeinsame Sammlungen, Gastzugang und Lieferung an konfigurierte Organisationsziele. |
| Eine öffentliche Markenseite | Lolly schreibt eine statische [Markenseite](/info/brand-page.html), aus Lolly Design System Setup oder von der Kommandozeile: Logos, Farben, Schrift, Regeln und Beispiele für Menschen, mit Tokens, `DESIGN.md` und Skills für Agenten. Sie hosten den Ordner, oder eine Administratorin schaltet in Lolly Work das [Hosting der Markenseite](/info/work-design-system-administration.html#host-a-brand-page) ein, das standardmäßig aus ist. |

[Katalog und Inhalte](/info/work-catalog.html), [Freigaben](/info/work-approvals.html) und [Richtlinien und Governance](/info/work-governance.html) beschreiben diese Funktionen und ihre Konfiguration.

## Den kombinierten Workflow bewerten

Nutzen Sie [die Produktionsfolge für Event-Karten](/info/dam-production.html), um Quellzugriff, erlaubte Änderungen, Prüfung der Ausgabe und Lieferung mit Ihrer eigenen Bibliothek zu testen. [Was wo läuft](/info/compare.html#what-runs-where) listet die Grenzen auf, die jeder Vergleich teilt. Eine Quellanbindung begründet für sich weder eine Partnerschaft mit dem Anbieter noch eine Qualifizierung für jeden Mandanten.

Siehe [Wie Lolly sich vergleicht](/info/positioning.html) für den Fähigkeitenvergleich. Herstellernamen kennzeichnen die verglichenen Produkte; Lolly steht in keiner Verbindung zu ihnen.
