# Start

Stellen Sie Ihre Tools auf Ihre eigenen Farben und Schriften ein und verwenden Sie vorhandene Arbeit weiter. Sie brauchen kein Konto, und das Erstellen und Exportieren läuft auf Ihrem Gerät.

::: steps
- <!--i:eti-sparkles--> **[Eine Datei erstellen](/info/make-something.html)** Ein QR-Code in wenigen Minuten, mit jedem Schritt erklärt.
- <!--i:eti-palette--> **[Ihre Marke einbringen](#put-your-brand-in)** Beginnen Sie mit einer Farbe, einer Token-Datei oder einem fertigen Design.
- <!--i:eti-folder-move--> **[Ihre Arbeit mitbringen](#bring-in-what-you-already-have)** Vorhandene Designs, Decks und Daten, auf Ihrem Gerät eingelesen.
- <!--i:eti-repeat--> **[Mehr vom Gleichen erstellen](#make-many-share-and-automate)** Teilen Sie einen Link, füllen Sie eine Tabelle aus oder führen Sie das Tool aus einem Skript aus.
:::

[Was ist Lolly?](/info/what-is-lolly.html) bietet eine Einführung in fünf Minuten. [Wie Lolly funktioniert](/info/how-lolly-works.html) zeigt, wer was tut.

<!--i:eti-palette-->
## Ihre Marke einbringen

lolly.tools öffnet sich mit **Lolly Demo**, Lollys eigenem Beispiel-Designsystem ([Lolly Demo kennenlernen](/info/lolly-demo.html)). Ihr Designsystem ersetzt Lolly Demo. Es ist ein kleiner Satz von Design-Tokens (Farben, Schriften und ein paar Regeln), mit dem jedes Tool zeichnet. Richten Sie es einmal ein, und alles, was Sie erstellen, beginnt im Stil Ihrer Marke.

Wählen Sie den Weg, der zu Ihrem Ausgangsmaterial passt:

- <!--i:palette--> **Eine Farbe.** Öffnen Sie die Ansicht **Design System Setup** (`#/start`), geben Sie Ihrem Designsystem einen Namen und wählen Sie eine Primärfarbe. Lolly leitet daraus eine barrierefreie Palette mit hellen und dunklen Flächen, Text und Akzenten ab. Wählen Sie eine Schrift, und Ihre Markengestaltung ist einsatzbereit.
- <!--i:upload--> **Eine Token-Datei.** **Add from…** oben in Lolly Design System Setup nimmt eine DTCG-, Tokens Studio- oder Penpot-Token-Datei, ein SVG oder ein `LollyBrand`-Paket an. Die Palette wird aus der Datei gefüllt. Solange das Designsystem leer ist, öffnet **Start from a reference** auf dem Board dieselbe Auswahl.
- <!--i:pentool--> **Ein fertiges Design.** Wählen Sie in Lolly Design **Import a design** und legen Sie eine Figma-, Penpot-, Illustrator-, InDesign-, Affinity-, Photoshop-, PowerPoint- oder SVG-Datei ab ([alle Formate](/info/design-import.html#what-comes-in-from-each-app)). Siehe unten [Vorhandenes mitbringen](#bring-in-what-you-already-have).

Wenn Sie die Galerie zum ersten Mal öffnen, bietet eine Begrüßung oben einen nächsten Schritt an. Auf lolly.tools öffnet **Start making** Lolly Design mit dem Launch-Poster. Bei einer Neuinstallation öffnet **Make it yours** Lolly Design System Setup. Unter dieser Schaltfläche öffnet **Bring a file** eine Dateiauswahl für ein Design, und die jeweils andere dieser beiden Optionen erscheint als Link. Jede dieser Aktionen oder die Schließen-Schaltfläche blendet die Begrüßung dauerhaft aus.

![Der Raum Colours von Lolly Design System Setup bei einem neuen Designsystem: ein Live-Farbfeld, ein Eingabefeld und damit die gesamte erste Entscheidung](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-colours-new-system)

Acht Räume, die Sie in beliebiger Reihenfolge nutzen können, führen das Designsystem weiter: **Board**, **Colours**, **Type**, **Logos**, **Tokens**, **Files**, **Rules** und **Skills**. Jede Vorschau in der App aktualisiert sich beim Tippen. [Lolly Design System Setup](/info/brand-studio.html) beschreibt jeden Raum.

Schriften bleiben auf Ihrem Gerät. Eine ausgewählte Google Font wird als Marken-Asset gespeichert, damit Ihre Schrift offline funktioniert und nichts abgerufen wird, wenn ein Tool zeichnet.

### Ein Designsystem ansehen, wechseln und teilen

- **Das aktive ansehen.** **Settings → Design system** zeigt das aktive Designsystem als Cover und Seiten, schreibgeschützt.
- **Zwischen ihnen wechseln.** **Settings → Preferences → Design systems** listet jedes Designsystem auf diesem Gerät auf. Eine Organisation kann mehrere Designsysteme betreiben oder eines mit mehreren Farbvarianten. [Markenarchitekturen](/info/brand-architectures.html) zeigt die Anordnungen.
- **Eines teilen.** Exportieren Sie das Designsystem als `LollyBrand`-Paket: eine Datei, die eine Kollegin oder ein Kollege importiert, um dieselbe Palette, dieselben Schriften und Regeln zu erhalten.

Ein Designsystem, das Ihr Build oder Ihre Organisation bereitstellt, ist **verwaltet**: Es zeigt ein Schloss und bleibt schreibgeschützt. Um es zu ändern, erstellen Sie unter **Settings → Preferences → Design systems** eine bearbeitbare Kopie.

![Der Tab Design system in Settings: das aktive Designsystem als Umschlag und Seiten](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Ihr Designsystem besteht aus DTCG-Tokens, dem Format, das Penpot liest und schreibt und Tokens Studio in Figma einbindet. Die Palette, mit der Sie gestalten, und die Palette, die Lolly anwendet, sind ein einziges Dokument. Einzelheiten stehen unter [Design-Tokens](/info/design-tokens.html).

::: details Für Entwickler: Ein Markenpaket über die Befehlszeile erstellen
`ingest:brand` erstellt ein wiederverwendbares Markenpaket in einem Checkout. Es akzeptiert die drei Container, die Penpot und Tokens Studio exportieren: eine einzelne `tokens.json`, ein Verzeichnis mit Dateien für die einzelnen Sets und `$metadata.json` oder ein `project.penpot`-Archiv.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registriert die Marke als Profil und erstellt und validiert ihren Katalog. Das Standardprofil wird dabei nie geändert: Führen Sie den Befehl mit `LOLLY_PROFILE=acme` aus, um das neue Paket zu verwenden. [Konfiguration](/info/configuration.html) erklärt, wie Markenpakete und Profile zusammenhängen.
:::

<!--i:eti-folder-move-->
## Vorhandenes übernehmen

**Lolly Design-Dateien.** Fertige Arbeit aus Figma, Penpot, Illustrator, InDesign oder einer beliebigen SVG-App öffnet sich in Lolly Design als bearbeitbares Layout. Text lässt sich weiter ändern, Formen bleiben Formen und Bilder landen in Ihrer Bibliothek. Die Datei wird in Ihrem Browser gelesen und nichts wird hochgeladen. [Ein Design importieren](/info/design-import.html) listet jedes Format auf und zeigt, was erhalten bleibt.

**Decks.** Ziehen Sie eine PowerPoint-Datei im Format `.pptx` auf Lolly, um ihre Folien als Assets abzulegen. Schreiben Sie in **Lolly Markdown Slides** ein neues Deck aus Markdown. [Ein Deck auf eine neue Marke umstellen](/info/rebrand.html) überträgt ein Deck auf Ihr Designsystem.

**Daten.** Fügen Sie eine CSV- oder JSON-Tabelle ein oder ziehen Sie sie hinein, um die wiederholten Felder eines Tools zu füllen. [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) erstellt pro Zeile eine fertige Datei.

### Vom Einzelstück zur Vorlage

Ein importiertes Layout ist eine gewöhnliche Lolly Design-Sitzung. **Share with rules** macht die Sitzung zu einem Tool. Sie wählen aus, welche Teile andere ändern dürfen, und diese füllen nur diese Teile aus.

![Behalten Sie das Lolly Design-Original, wählen Sie Eingaben und Grenzen in einer Bearbeitungskopie und teilen Sie dann ein wiederverwendbares .lolly-Tool, das Empfänger ausfüllen](/info/diagrams/concepts/share-with-rules.svg)

[Ein Design mit Regeln teilen](/info/create-a-tool.html) führt durch die einzelnen Schritte.

<!--i:eti-repeat-->
## Viele Dateien erstellen, teilen und automatisieren

- <!--i:download--> **Exportieren.** Tools erstellen SVG, PDF, PNG, JPG, WebP, Video und mehr, bei Bedarf in echten Druckgrößen. Jedes Tool bietet seine eigenen Formate. Siehe [Eine Datei exportieren](/info/exporting.html).
- <!--i:link--> **Einen Link teilen.** Die Einstellungen eines Tools reisen in seinem Link mit, sodass der Link überall dieselbe Datei wieder öffnet.
- <!--i:layers--> **Eine Datei pro Zeile erstellen.** Steuern Sie ein Tool in [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) über eine Tabelle.
- <!--i:cpu--> **Automatisieren.** Dasselbe Rendering läuft über die [CLI](/info/cli.html) und über einen [KI-Agenten](/info/ai-agents.html).

Ein Link ist eine vollständige Anfrage. Typ, Überschrift und Datentabelle des folgenden Diagramms wurden in die Adressleiste eingegeben.

![Ein Balkendiagramm der monatlichen Anmeldungen nach Kanal in den Farben des Designsystems, dessen Werte alle als Abfrageparameter statt durch einen Klick übergeben wurden](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26sty%3Dposter%26pl%3Droles%26transparentBg%3Dfalse%26d%3DMonth%2CWeb%2CApp%2CPartners%250AJan%2C120%2C60%2C25%250AFeb%2C180%2C95%2C40%250AMar%2C265%2C150%2C70%250AApr%2C340%2C210%2C110%250AMay%2C455%2C290%2C160%250AJun%2C560%2C380%2C230%26t%3DSignups%2520this%2520year%26st%3DBy%2520channel%252C%2520January%2520to%2520June%26full&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

<!--i:eti-map-pin-->
## Nächste Schritte

- <!--i:people--> **[Erstellen](/info/creators.html)**: gestalten, animieren, aufnehmen, teilen und exportieren.
- <!--i:code--> **[Automatisieren](/info/builders.html)**: Designsysteme, Tools erstellen, Befehlszeile, Links und Agenten.
- <!--i:usercheck--> **[Verwalten](/info/operators.html)**: Lolly mit Lolly Work für ein Team betreiben.
- <!--i:server--> **[Bereitstellen](/info/operate.html)**: Lolly und Lolly Work hosten.
- <!--i:shieldcheck--> **[Vertrauen](/info/trust.html)**: Datenschutz, Sicherheit und eine Datei selbst prüfen.
