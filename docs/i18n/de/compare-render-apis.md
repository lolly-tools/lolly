# Lolly und Rendering-APIs

_Zuletzt geprüft: 5. November 2026._

Wenn Sie über eine API Bilder aus Vorlagen erzeugen, zeigt diese Seite, was sich ändert, wenn Sie diese Produktion auf Ihrem eigenen Gerät, in CI oder auf einem von Ihnen kontrollierten Server betreiben. [Von einer gehosteten Rendering-API umsteigen](/info/work-move-from-render-api.html) beschreibt die Schritte.

<!--i:eti-award-->
## Was gehostete Rendering-APIs besser machen

[Bannerbear](https://www.bannerbear.com/) und [Placid](https://placid.app/) sind verwaltete Dienste: Sie senden eine Anfrage, und jemand anderes betreibt die Server.

- **Nichts zu betreiben.** Kein Server, keine Datenbank, kein Speicher, keine Updates und keine Kapazitätsplanung.
- **Ein gehosteter Vorlageneditor** mit Vorlagen, die Sie direkt anpassen können.
- **Mehr Ausgabearten über eine API.** Beide veröffentlichen Video- und PDF-Endpunkte, und Bannerbear dokumentiert außerdem animierte Ausgabe, WebP und AVIF, Screenshots und KI-Hintergrundentfernung.
- **Eigene Integrationen und eigener Support.**

Wenn Sie so arbeiten möchten, sind diese Dienste eine gute Wahl.

<!--i:eti-home-->
## Was Ihnen der eigene Betrieb bietet

- **Ihre Inhalte bleiben auf Ihren Systemen.** Eingaben, Assets und Ausgaben liegen auf einer Infrastruktur, die Sie gewählt haben. Rendering auf einem Gerät oder in CI braucht keinen Dienst.
- **Die Regeln liegen im Tool.** Farben, Schriften, Logos und gesperrte Eingaben kommen aus Ihrem [Designsystem](/info/brand-studio.html). So kann ein Aufrufer nur ändern, was Sie erlauben. [Lolly Work](/info/compare.html#what-runs-where) wendet die Sichtbarkeit von Tools und Eingaberichtlinien auf jede Anfrage an.
- **Überall dasselbe Tool.** Ein Tool rendert aus denselben Eingaben auf einem Laptop, in einem CI-Auftrag oder auf einem Server. Menschen können dasselbe Tool in der App bearbeiten.
- **Aufzeichnungen in Ihrer Hand.** [Rendering-Belege](/info/work-renders.html#evidence-and-identity), ein Audit-Protokoll und Content Credentials, wo Sie eine Signieridentität konfigurieren.
- **Open Source und keine Nutzungsgebühr.** Sie betreiben den Code und bezahlen nur Ihre eigene Infrastruktur.

Sie übernehmen die Arbeit, die diese Dienste für Sie erledigen. Ein dauerhaft betriebener Server braucht eine persistente Datenbank und Speicher für Ausgaben. Tools, die einen Browser brauchen, benötigen den Chromium-Worker. [Lolly Work installieren](/info/work-install.html) beschreibt beides.

<!--i:eti-table-->
## Die Aufgaben im Vergleich

| Aufgabe | Gehostete Rendering-API | Lolly |
|---|---|---|
| Eine Vorlage mit Daten füllen | API-Anfrage, die eine Vorlage und ihre Ebenen benennt | [URL](/info/url-mode.html), [CLI](/info/cli.html) oder [Server-API](/info/work-automation-api.html), die ein Tool und seine Eingaben benennt |
| Viele Dateien aus einer Tabelle | Batches und Sammlungen | [Batch](/info/batch.html) auf Ihrem Gerät oder [Rendering-Batches](/info/work-renders.html#batches-with-durable-rows) auf einem Server |
| Auf ein Ergebnis warten oder es abfragen | Polling oder eine synchrone Option | Dauerhaft gespeicherte Render-Aufträge, die Sie abfragen, oder ein sofortiges Rendering |
| Bei Abschluss einen Webhook aufrufen | Ja | [Signierte Rückrufe](/info/work-renders.html) an von Ihnen erlaubte Origins |
| Dynamische Bild-URL | Ja | [Freigabelinks und `/render`-URLs](/info/url-mode.html) |
| Eine Vorlage bearbeiten | Gehosteter Editor | [Design](/info/using.html) auf Ihrem Gerät |
| Agenten | Beide veröffentlichen einen MCP-Server | [MCP](/info/mcp.html), mit einem Organisationsendpunkt unter den Richtlinien eines Tokens in Lolly Work |

Lollys eigene Ausgabearten sind unter [Exportieren](/info/exporting.html) aufgeführt. Auf einem Work-Server erzeugen dauerhaft gespeicherte Render-Aufträge derzeit SVG, PNG, JPG und PDF, und [Video bleibt auf dem Gerät, in der CLI und über MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Was übernommen wird und was nicht

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Ihre Anfragen | Die Migrations-API von Work nimmt dieselbe Struktur an | Ebenso | Ebenso |
| Ihre Vorlagen | **Import** als bearbeitbare Dokumente, außer Ebenentypen ohne bestätigtes Schema | Nur Feldnamen und eine Vorschau. Erstellen Sie jede Vorlage neu | Nur Feldnamen und eine Vorschau. Erstellen Sie jede Vorlage neu |
| Bestehende dynamische URLs | Nicht unterstützt | Nicht unterstützt | Signierte URLs funktionieren nach einem Hostwechsel mit Ihrem alten privaten Token weiter |
| Webhooks | Registrierte Webhooks werden nicht unterstützt | `webhook_url` funktioniert | `webhook_success` funktioniert |
| WebP- und AVIF-Ausgabe | Bei Angabe des Namens abgelehnt | Nicht angeboten | WebP wird bei Angabe des Namens abgelehnt |
| Animationen, Videos, Sammlungen, Screenshots | Nicht über die Migrations-API | Nicht über die Migrations-API | Nicht über die Migrations-API |

::: note Auf Basis öffentlicher Dokumentation entwickelt
Dies wurde auf Basis der öffentlichen Dokumentation der jeweiligen Anbieter entwickelt und nicht mit einem aktiven Konto ausgeführt. Wenn Sie ein Konto haben, enthält [die Umstiegsanleitung](/info/work-move-from-render-api.html#check-it-on-your-own-account) eine kurze Prüfliste.
:::

Sie können eine Vorlage umziehen und den Rest lassen, wo er ist. [Lolly verlassen](/info/work-move-from-render-api.html#leave-lolly-too) ist genauso offen möglich: Tools sind einfache Dateien, und die CLI rendert sie ohne Server.

<!--i:eti-building-->
## Wer den Dienst betreibt

Mit Lolly rendert eine Einzelperson lokal, oder ein Team betreibt Lolly Work auf seiner eigenen Infrastruktur. Ein Serverauftrag sendet seine Eingaben und benötigten Assets an diese Instanz. Beim Ablauf auf dem Gerät geschieht das nicht.

Bannerbear und Placid sind Marken ihrer Inhaber. Diese Seite beschreibt auf Grundlage ihrer öffentlichen Dokumentation, wo sich die Produkte überschneiden, und steht in keiner Verbindung zu einem der beiden Anbieter.
