# Lolly und Marken-Portale

_Zuletzt geprüft: 28. September 2026._

Lolly und [lolly.work](https://lolly.work) decken zusammen die Erstellungs- und Governance-Abläufe ab, für die Teams Marken-Portale einsetzen: freigegebene Assets, gesperrte Vorlagen, Zugriffskontrolle, Prüfung und Verteilung. Vergleichen Sie diese Gesamtlösung mit Bynder, Frontify, Marq oder Brandfolder, wenn Sie entscheiden, wie Menschen Marken-Assets finden und neue erstellen.

## Erstellung und Organisationsdienste

Die Engine und die Apps von Lolly erzeugen die Dateien. Vorlagen, Design-Tokens und zulässige Eingaben legen fest, was jemand ändern darf, und das Rendering kann auf dem eigenen Gerät bleiben. Eigenständiges Lolly braucht kein Konto.

lolly.work ist der Organisationsdienst im selben Projekt, wird in einem [eigenen Repository](https://github.com/lolly-tools/lolly-work) gepflegt und neben Lolly betrieben. Er ergänzt Identität, gemeinsamen Speicher, Richtlinien, Freigaben und Berichte. Beide Teile sind Open Source unter MPL-2.0. Durch die Trennung kann eine Einzelperson Lolly unabhängig nutzen und eine Organisation die Gesamtlösung auf Infrastruktur betreiben, die sie selbst kontrolliert.

## Was die Gesamtlösung bietet

| Bedarf | Lolly + lolly.work |
|---|---|
| Anmeldung und Provisionierung | OIDC-Single-Sign-on, mehrere Identitätsanbieter, SCIM-2.0-Benutzerprovisionierung und Gruppenmitgliedschaft sowie Kontodeaktivierung, die bestehende Sitzungen widerruft. Ein reiner SAML-Identitätsanbieter kann über eine OIDC-Brücke wie Keycloak angebunden werden. |
| Freigegebene Vorlagen | Lolly definiert die bearbeitbaren Eingaben der Vorlage; lolly.work wendet Gruppensichtbarkeit und Eingaberichtlinien an, die Werte sperren, Auswahlmöglichkeiten einschränken oder Steuerelemente ausblenden. |
| Gemeinsame Asset-Bibliothek | Instanzeigene Uploads, Sammlungen, benutzerdefinierte Metadaten und zugriffsgeschützte Kataloge sowie Konnektoren, die bestehende DAM- und Speicherbibliotheken lesen. |
| Prüfung | Geordnete Freigabeschritte, berechtigte Freigabegruppen, Quorumregeln und Funktionstrennung; die Prüfung kann Katalogeinreichungen und die Auslieferung an Ziele der Organisation steuern. |
| Asset-Verlauf und Verfügbarkeit | Versionen und Rollback für instanzeigene Assets, Aufbewahrung und Sperren, zeitgesteuerte Verfügbarkeit, Ablauf und Widerruf. Angebundene Anbieter behalten ihren eigenen Quellverlauf. |
| Berichte | Zählungen zu Asset-Nutzung und Downloads, Aktivität von Werkzeugen und Exporten, Dashboards und ein Audit-Protokoll. Die Zuordnung der Nutzung folgt der Telemetrie-Richtlinie der Bereitstellung; die Standardeinstellung für die Zuordnung erfordert eine Einwilligung. |
| Verteilung | Ablaufende, widerrufbare Links, gemeinsame Sammlungen, Gastzugang und Auslieferung an konfigurierte Ziele der Organisation. |

Die [Betriebsanleitungen für lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) beschreiben diese Funktionen und ihre Konfiguration. Es sind vorhandene Fähigkeiten und keine Funktionen, für die erst ein weiteres System um Lolly herum gebaut werden müsste.

## Einen Portal-Arbeitsablauf wählen

Etablierte Portale bieten verwaltetes Hosting, Support und umfangreiche DAM-Arbeitsabläufe. Das [Enterprise-DAM von Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) verbindet zum Beispiel Asset-Suche, Zugriffskontrollen, Freigabe-Workflows und Verteilung. Vergleichen Sie den genauen Prüf- und Rechte-Ablauf, den Sie benötigen: Lolly bietet Metadaten sowie Zugriffs- und Verfügbarkeitskontrollen, während rechtliche Freigabe und Lizenzpflichten weiterhin den Prozess einer Organisation erfordern. Die Freigabeketten sind sequenziell; beliebig verzweigte Abläufe bilden sie nicht ab.

Der Lolly-Stack ist jünger, und die [Statusseite von lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) hält seine Einschränkungen beim Betrieb fest. Insbesondere ist die öffentliche Website lolly.work eine Evaluierungs-Sandbox. Eine dauerhafte Bereitstellung in einer Organisation braucht persistenten Speicher und einen Betreiber. Für das Selbst-Hosting fällt keine Software-Lizenzgebühr pro Nutzer an; Infrastruktur und Administration kosten dennoch Geld.

Ein bestehendes DAM kann auch die maßgebliche Quelle bleiben. Die Katalog-Konnektoren von lolly.work machen dessen freigegebene Assets in Lolly verfügbar, wo Menschen nach den Regeln der Organisation neue Dateien erstellen. Das ist eine Integrationsentscheidung; die eigene Bibliothek und die Freigaben von Lolly stehen zur Verfügung, wenn die Organisation diese Abläufe selbst verwalten möchte.

Den Funktionsvergleich finden Sie unter [So schneidet Lolly im Vergleich ab](/info/positioning.html), den Rest dieser Reihe unter [Lolly im Vergleich, Werkzeug für Werkzeug](/info/compare.html). Herstellernamen bezeichnen die verglichenen Produkte; Lolly steht in keiner Verbindung zu ihnen.
