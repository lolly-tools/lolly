# Lolly und Rendering-APIs

_Zuletzt geprüft: 5. November 2026._

Wenn Sie heute über eine API Bilder aus Vorlagen erzeugen, sagt diese Seite, was sich ändert, wenn Sie diese Produktion selbst betreiben: auf Ihrem eigenen Gerät, in der CI oder auf einem Server, den Sie kontrollieren. [Von einer gehosteten Render-API umziehen](/info/work-move-from-render-api.html) ist das Wie.

## Was gehostete Rendering-APIs besser können

[Bannerbear](https://www.bannerbear.com/) und [Placid](https://placid.app/) sind verwaltete Dienste, und das ist ein echter Vorteil. Sie senden eine Anfrage, und jemand anderes betreibt die Server, hält sie am Laufen und fängt die Last ab.

- **Nichts zu betreiben.** Kein Server, keine Datenbank, kein Speicher, keine Updates, keine Kapazitätsplanung.
- **Ein gehosteter Vorlageneditor** mit fertigen Vorlagen zum Anpassen.
- **Mehr Ausgabearten aus einer API.** Beide bieten Endpunkte für Video und PDF, und Bannerbear dokumentiert außerdem animierte Ausgabe, WebP und AVIF, Screenshots und KI-Hintergrundentfernung.
- **Ihre eigenen Integrationen und ihr Support.**

Wenn Sie genau dieses Arrangement wollen, sind diese Dienste eine solide Wahl.

## Was Self-Hosting Ihnen gibt

- **Ihre Inhalte bleiben auf Ihren Systemen.** Eingaben, Assets und Ausgaben liegen auf einer Infrastruktur, die Sie gewählt haben. Rendern auf einem Gerät oder in der CI braucht überhaupt keinen Dienst.
- **Die Regeln leben im Tool.** Farben, Schrift, Logos und gesperrte Eingaben kommen aus Ihrem [Designsystem](/info/brand-studio.html), sodass ein Aufrufer nur ändern kann, was Sie erlauben. [Lolly Work](/info/compare.html#what-runs-where) wendet Tool-Sichtbarkeit und Eingaberichtlinien auf jede Anfrage an.
- **Dasselbe Tool überall.** Ein Tool rendert auf einem Laptop, in einem CI-Job oder auf einem Server aus denselben Eingaben, und Menschen können dasselbe Tool in der App bearbeiten.
- **Belege, die Sie selbst halten.** [Render-Belege](/info/work-renders.html#evidence-and-identity), ein Audit-Pfad und Content Credentials, wo Sie eine Signaturidentität konfigurieren.
- **Open Source und kein Zähler.** Sie betreiben den Code, und bezahlen müssen Sie nur Ihre eigene Infrastruktur.

Sie übernehmen die Arbeit, die diese Dienste für Sie erledigen. Ein dauerhafter Server braucht eine persistente Datenbank und Ausgabespeicher, und Tools, die einen Browser brauchen, benötigen den Chromium-Worker. [Lolly Work installieren](/info/work-install.html) beschreibt beides.

## Wie die Aufgaben zusammenpassen

| Aufgabe | Gehostete Rendering-API | Lolly |
|---|---|---|
| Eine Vorlage aus Daten füllen | API-Anfrage, die eine Vorlage und ihre Ebenen nennt | [URL](/info/url-mode.html), [CLI](/info/cli.html) oder [Server-API](/info/work-automation-api.html), die ein Tool und seine Eingaben nennt |
| Viele Dateien aus einer Tabelle | Batches und Sammlungen | [Batch](/info/batch.html) auf Ihrem Gerät oder [Render-Batches](/info/work-renders.html#batches-with-durable-rows) auf einem Server |
| Auf ein Ergebnis warten oder abfragen | Abfragen oder eine synchrone Option | Dauerhafte Renderings, die Sie abfragen, oder ein sofortiges Rendering |
| Einen Webhook aufrufen, wenn fertig | Ja | [Signierte Callbacks](/info/work-renders.html) an Ursprünge, die Sie erlauben |
| Dynamische Bild-URL | Ja | [Share-Links und `/render`-URLs](/info/url-mode.html) |
| Eine Vorlage bearbeiten | Gehosteter Editor | [Design](/info/using.html), auf Ihrem Gerät |
| Agenten | Beide bieten einen MCP-Server | [MCP](/info/mcp.html), mit einem Organisationsendpunkt unter der Richtlinie eines Tokens in Lolly Work |

Lollys eigene Ausgabearten sind unter [Exportieren](/info/exporting.html) aufgeführt. Auf einem Work-Server erzeugen dauerhafte Renderings heute SVG, PNG, JPG und PDF, und [Video bleibt auf dem Gerät, in der CLI und im MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Was mitkommt und was nicht

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Ihre Anfragen | Die Migrations-API von Work nimmt dieselbe Form an | Dasselbe | Dasselbe |
| Ihre Vorlagen | **Importieren** als bearbeitbare Dokumente, außer Ebenentypen ohne bestätigtes Schema | Nur Feldnamen und eine Vorschau. Jede neu aufbauen | Nur Feldnamen und eine Vorschau. Jede neu aufbauen |
| Bestehende dynamische URLs | Nicht unterstützt | Nicht unterstützt | Signierte URLs funktionieren nach einem Hostwechsel weiter, mit Ihrem alten privaten Token |
| Webhooks | Registrierte Webhooks werden nicht unterstützt | `webhook_url` funktioniert | `webhook_success` funktioniert |
| WebP- und AVIF-Ausgabe | Wird ausdrücklich abgelehnt | Nicht angeboten | WebP wird ausdrücklich abgelehnt |
| Animationen, Videos, Sammlungen, Screenshots | Nicht in der Migrations-API | Nicht in der Migrations-API | Nicht in der Migrations-API |

All das wurde aus der öffentlichen Dokumentation jedes Anbieters erarbeitet und nicht an einem echten Konto ausgeführt. [Die Umzugsanleitung](/info/work-move-from-render-api.html#check-it-on-your-own-account) hat eine kurze Checkliste, falls Sie eines haben.

Der Umzug ist kein Alles oder Nichts. Sie können eine Vorlage umziehen und die übrigen dort lassen, wo sie sind, und [Lolly wieder zu verlassen](/info/work-move-from-render-api.html#leave-lolly-too) bleibt genauso offen: Tools sind einfache Dateien, und die CLI rendert sie ohne Server.

## Wer den Dienst betreibt

Mit Lolly rendert eine Einzelperson lokal, oder ein Team betreibt Lolly Work auf seiner eigenen Infrastruktur. Das Einreichen eines Server-Auftrags sendet seine Eingaben und die nötigen Assets an diese Instanz, was sich vom Pfad auf dem Gerät unterscheidet.

Bannerbear und Placid sind Marken ihrer Inhaber. Diese Seite beschreibt, wo sich die Produkte überschneiden, nach ihrer öffentlichen Dokumentation, und steht in keiner Verbindung zu einem von beiden.
