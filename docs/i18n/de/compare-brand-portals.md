# Lolly und Markenportale

_Positionierung aktualisiert: 31. Oktober 2026. Funktionsbeispiel eines Anbieters geprüft: 28. September 2026._

Wenn Ihre Organisation ihre freigegebenen Assets in Bynder, Frontify, Marq oder Brandfolder aufbewahrt, vergleicht diese Seite dieses Portal mit Lolly plus Lolly Work. Sie behandelt, wie Menschen Marken-Assets finden und daraus neue Dateien erstellen.

<!--i:eti-folder-shared-->
## Ihr bestehendes Portal behalten

Ein bestehendes DAM kann die maßgebliche Quelle bleiben. Die Katalog-Connectoren von Lolly Work stellen einen ausgewählten Teil seiner Bibliothek in Lolly bereit, wo Menschen neue Dateien nach den Regeln der Organisation erstellen. Die vom DAM unterstützten Quellbeschränkungen und die Bereitstellungsregeln von Lolly Work regeln den Zugriff. Die Prüfung der fertigen Ausgabe ist eine separate Entscheidung.

[Lolly mit Ihrem bestehenden DAM verwenden](/info/use-with-dam.html) erklärt die Zuständigkeiten und Grenzen. [Die Erfahrungen von SUSE mit Brandfolder](/info/suse-brandfolder.html) dokumentiert eine erfolgreiche Integration, die Administratoren vor einer geplanten Migration beim Umstellungsprozess unterstützte.

Lolly dient der [Inhaltssouveränität](/info/content-sovereignty.html), einschließlich der Kontrolle über die Produktion und der freien Wahl von Systemen. Seine eigene Bibliothek und seine Freigaben richten sich an Organisationen, die diese Funktionen selbst betreiben möchten. [Lolly für DAM-Anbieter und Implementierungspartner](/info/dam-partners.html) beschreibt, wie der verbundene Workflow ein bestehendes führendes System ergänzen kann.

<!--i:eti-award-->
## Was ein etabliertes Portal besser macht

Etablierte Portale bieten verwaltetes Hosting, Support und umfangreiche Workflows zur Asset-Verwaltung. [Das Enterprise-DAM von Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) verbindet die Asset-Suche, Zugriffskontrollen, Freigabe-Workflows und Verteilung. Die Lolly-Plattform ist jünger. Ihre Freigabeketten sind sequenziell und können nicht beliebig verzweigen. [Lolly Work: Status und Roadmap](/info/work-status.html) hält die Grenzen seiner Bereitstellung fest.

<!--i:eti-blend-->
## Wo sie sich überschneiden

Beide decken freigegebene Assets, gesperrte Vorlagen, Zugriffskontrolle, Prüfung und Verteilung ab. Lolly erstellt die Dateien. Vorlagen, Design-Tokens und erlaubte Eingaben legen fest, was jemand ändern kann, und das Rendering kann auf dessen Gerät bleiben. Lolly Work ergänzt Identität, gemeinsamen Speicher, Richtlinien, Freigaben und Berichte auf einer Infrastruktur, die die Organisation kontrolliert.

![Das aktive Designsystem in Settings, dargestellt als Titel und Seiten: die Farben, Schriften und Logos, mit denen jedes Tool zeichnet](/info/shots/dashboard-brand.svg)

<!--i:eti-lolly-->
## Was Lolly und Lolly Work bieten

| Bedarf | Lolly + Lolly Work |
|---|---|
| Anmeldung und Bereitstellung | OIDC-Single-Sign-on, mehrere Identitätsanbieter, SCIM 2.0-Nutzerbereitstellung und Gruppenmitgliedschaft sowie Kontodeaktivierung, die bestehende Sitzungen widerruft. Ein Identitätsanbieter, der nur SAML unterstützt, kann über eine OIDC-Brücke wie Keycloak angebunden werden. |
| Freigegebene Vorlagen | Lolly definiert die bearbeitbaren Eingaben der Vorlage; Lolly Work wendet Sichtbarkeit nach Gruppen und Eingaberichtlinien an, die Werte sperren, Auswahlmöglichkeiten einschränken oder Steuerelemente ausblenden. |
| Gemeinsame Asset-Bibliothek | Uploads der Instanz, Sammlungen, benutzerdefinierte Metadaten und Kataloge mit Zugriffskontrolle sowie Connectoren, die bestehende DAM- und Speicherbibliotheken lesen. |
| Prüfung | Geordnete Freigabeschritte, berechtigte Freigabegruppen, Quorumregeln und Funktionstrennung; die Prüfung kann Katalogeinreichungen und die Lieferung an Ziele der Organisation steuern. |
| Asset-Verlauf und Verfügbarkeit | Versionen und Wiederherstellung für Assets der Instanz, Aufbewahrung und Löschsperren, geplante Verfügbarkeit, Ablauf und Widerruf. Angebundene Anbieter behalten ihren eigenen Quellverlauf. |
| Lizenzen und Quellenangaben | Lolly erfasst die Lizenz jeder Quelle, die eine Datei nutzt, und bereitet die erforderlichen Quellenangaben vor; [Rechte an kreativen Werken und Quellenangaben](/info/creative-rights.html) erklärt, was es erfasst und wo Quellenangaben geschrieben werden. Es klärt keine Rechte. |
| Berichte | Zählungen von Asset-Nutzungen und Downloads, Tool- und Exportaktivität, Dashboards und ein Audit-Protokoll. Die Zuordnung der Nutzung folgt der Telemetrierichtlinie der Bereitstellung; die Standardeinstellung zur Zuordnung erfordert eine Einwilligung. |
| Verteilung | Ablaufende, widerrufbare Links, gemeinsame Sammlungen, Gastzugriff und Lieferung an konfigurierte Ziele der Organisation. |
| Eine öffentliche Markenseite | Lolly schreibt eine statische [Markenseite](/info/brand-page.html), aus Lolly Design System Setup oder über die Befehlszeile: Logos, Farben, Schriften, Regeln und Beispiele für Menschen, dazu Tokens, `DESIGN.md` und Skills für Agenten. Sie hosten den Ordner, oder ein Administrator schaltet das standardmäßig ausgeschaltete [Hosting von Markenseiten](/info/work-design-system-administration.html#host-a-brand-page) in Lolly Work ein. |

[Katalog und Inhalte](/info/work-catalog.html), [Freigaben](/info/work-approvals.html) und [Richtlinien und Governance](/info/work-governance.html) beschreiben diese Funktionen und ihre Konfiguration.

<!--i:eti-checklist-->
## Den kombinierten Workflow bewerten

Nutzen Sie [den Produktionsablauf für eine Veranstaltungskarte](/info/dam-production.html), um den Quellzugriff, erlaubte Änderungen, die Ausgabeprüfung und die Lieferung mit Ihrer eigenen Bibliothek zu testen. [Was wo läuft](/info/compare.html#what-runs-where) listet die Grenzen auf, die für jeden Vergleich gelten. Eine Quellanbindung allein begründet weder eine Anbieterpartnerschaft noch die Eignung für jeden Mandanten.

[Lolly im Vergleich](/info/positioning.html) enthält den Funktionsvergleich. Die Anbieternamen bezeichnen die verglichenen Produkte. Lolly steht in keiner Verbindung zu ihnen.
