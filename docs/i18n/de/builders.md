# Lolly für Entwickler

Die technische Dokumentation - für alle, die Tools erstellen, Lolly in eine Pipeline integrieren, es selbst hosten oder die Plattform erweitern.

**Ihr Vorteil.** Erstellen Sie ein Tool einmal, und die Anfrage kommt nicht mehr zu Ihnen zurück. Das ständig wiederkehrende „Können Sie mir schnell mal…" das Ihre Nachmittage auffrisst, wird zu einer Vorlage, die andere selbst ausfüllen - korrekt, ohne dass Sie eingebunden werden müssen. Ihre Arbeit besteht aus reinem HTML/CSS/JS: versioniert, diffbar, überprüfbar und auf einer offenen Engine laufend, ohne Vendor-Lock-in - sie bleibt also Ihre eigene. Automatisieren Sie den Produktionslauf, und Ihre Zeit fließt in das interessante Problem, nicht in den zehntausendsten Export.

Lolly ist eine plattformunabhängige **Engine**, die denselben Render-Pfad über mehrere **Shells** hinweg ausführt (Web-PWA, Tauri Desktop/Mobile, CLI, TUI). Tools sind **Daten, kein gebündelter Code** - ein Manifest plus eine Vorlage plus optionale Hooks - sodass neue Tools ohne App-Update ausgeliefert werden. Beginnen Sie mit der [Übersicht](/info/overview.html) für die Architektur und folgen Sie anschließend dem Pfad, der zu Ihrem Vorhaben passt.

Neu auf der Plattform? Der **[Schnelleinstieg](/info/quickstart.html)** richtet eine Marke und Ihren ersten Render ein, bevor Sie tiefer einsteigen.

## Die Architektur verstehen



- **[Übersicht](/info/overview.html)** - warum es Lolly gibt, die Trennung von Engine/Shell/Tools, die Capability Bridge und die festgelegten architektonischen Grundsatzentscheidungen.
- **[Design Tokens](/info/design-tokens.html)** - das DTCG-Token-Modell, in dem Marken ausgedrückt werden, und wie Tools diese nutzen.

## Tools erstellen

Jedes Steuerelement unten wurde aus einer deklarierten Eingabe in `tool.json` erzeugt. Sie schreiben die Manifest-Zeile, der Host zeichnet das Widget, und dasselbe Modell steuert die CLI und die URL.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

Das skaliert weit über fünf Steuerelemente hinaus. Geben Sie einer Eingabe eine `section`, und der Host klappt sie ein - so öffnet sich ein Tool mit fünfzig Eingaben wie das D3 Chart Studio trotzdem als kurzer Stapel, während der Rest hinter benannten Gruppen einsortiert ist.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Tools erstellen](/info/authoring-tools.html)** - der vollständige Leitfaden: Manifest, Vorlage, Styles, Hooks, Komposition und Veröffentlichung.
- **[Assets erstellen](/info/authoring-assets.html)** - Katalog-Assets, Stufen, Sprachversionen, Paletten, themenfähige Icons und Schriftarten.
- **[Host API](/info/host-api.html)** - die `HostV1`-Capability-Bridge, gegen die jedes Tool geschrieben wird (die einzige API, die Tools zu sehen bekommen).
- **[URL-Modus](/info/url-mode.html)** - jede Eingabe als URL-Parameter; reservierte Parameter, kompakte Kodierung, gepackte Links.

## Ausführen & integrieren

- **[CLI](/info/cli.html)** - Headless-Rendering; derselbe Render-Pfad wie die GUI, gesteuert über `--foo=bar`-Argumente.
- **[TUI](/info/tui.html)** - die interaktive Terminal-Shell.
- **[MCP-Server](/info/mcp.html)** - der native Endpunkt, über den ein KI-Agent Tools entdecken und ausführen kann.
- **[KI-Agenten](/info/ai-agents.html)** - Lolly von einem Modell aus steuern: Eine URL ist die API.
- **[Chrome-Erweiterung](/info/extension.html)** - eine Live-URL als wiederverwendbares Asset erfassen.

## Ausliefern & betreiben

- **[Build-Leitfaden](/info/build-guide.html)** - jedes Zielsystem bauen: CLI, TUI, Desktop, Mobile.
- **[Deployment](/info/deployment.html)** - die Web-App, die Apps und die Backend-Dienste; wo welcher Teil läuft.
- **[Konfiguration](/info/configuration.html)** - Profile, Brand-Packs, Capability-Gating, Feature-Flags und Katalogvalidierung.

## Vertrauen & Daten

Rechte und Urheberschaft sind Eingaben wie alle anderen. Embed & Track Image deklariert Felder für Urheber, Copyright, Lizenz und Kontakt, und der Export schreibt sie in die Metadaten der Datei selbst und in ihr C2PA-Manifest.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Content Credentials Identity](/info/content-credentials-identity.html)** - CA-ausgestellte Signierung für On-Device-C2PA; Engine-Verträge und das Operator-Runbook.
- **[Datenübertragung](/info/data-transfer.html)** - das `lolly-backup`-Bundle: Envelope, Integrität und Cross-Shell-Garantien.
- **[Über das Projekt](/info/about.html)** - das Projekt, seine Lizenzgrenzen und das Repository.
