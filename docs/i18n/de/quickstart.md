# Start

Am Ende dieser Seite tragen Ihre Tools Ihre eigenen Farben und Schriften, und die Arbeit, die Sie schon haben, ist bereit zur Wiederverwendung. Sie brauchen kein Konto, und Erstellen und Exportieren laufen auf Ihrem Gerät.

::: timeline
- <!--i:sparkle--> **Eine Datei erstellen.** [Ihre erste Datei erstellen](/info/make-something.html) führt Sie in wenigen Minuten durch einen QR-Code.
- <!--i:palette--> **Ihre Marke einbringen.** Beginnen Sie mit einer Farbe, einer Tokens-Datei oder einem fertigen Design.
- <!--i:layers--> **Mehr vom Gleichen erstellen.** Teilen Sie einen Link, füllen Sie eine Tabelle aus oder führen Sie das Tool aus einem Skript aus.
:::

Neu bei der Idee selbst? [Was ist Lolly?](/info/what-is-lolly.html) ist die Fünf-Minuten-Einführung, und [Wie Lolly funktioniert](/info/how-lolly-works.html) zeigt, wer was tut.

## Ihre Marke einbringen

lolly.tools öffnet sich in **Lolly Demo**, Lollys eigenem Beispiel-Designsystem; [Lolly Demo kennenlernen](/info/lolly-demo.html) zeigt, was Sie vor sich haben. Ihr Designsystem ersetzt es: ein kleiner Satz Design-Tokens, also Farben, Schriften und einige Regeln, mit denen jedes Tool zeichnet. Einmal festgelegt, beginnt alles, was Sie erstellen, markenkonform.

Wählen Sie den Weg, der zu dem passt, was Sie haben:

- <!--i:palette--> **Eine Farbe.** Öffnen Sie **Design System Setup** (`#/start`), geben Sie Ihrem Designsystem einen Namen und wählen Sie eine Primärfarbe. Lolly leitet daraus eine vollständige, barrierefreie Palette ab, mit hellen und dunklen Flächen, Text und Akzenten. Wählen Sie eine Schrift, und Sie haben eine funktionierende Marke.
- <!--i:upload--> **Eine Tokens-Datei.** **Add from…** am Fuß der Raumleiste in Design System Setup nimmt eine DTCG-, Tokens-Studio- oder Penpot-Tokens-Datei, eine SVG oder ein `LollyBrand`-Paket an. Legen Sie sie ab, und die Palette füllt sich. Solange das Designsystem noch leer ist, öffnet **Start from a reference** im Raum Overview dieselbe Auswahl.
- <!--i:pentool--> **Ein fertiges Design.** Wählen Sie in Design **Import a design** und legen Sie eine `.fig`-, `.penpot`-, `.ai`-, `.idml`- oder SVG-Datei ab. Siehe unten [Bringen Sie mit, was Sie schon haben](#bring-in-what-you-already-have).

Wenn Sie die Galerie zum ersten Mal öffnen, bietet ein kurzer Willkommensdialog dieselben Möglichkeiten: **Make it yours** öffnet Design System Setup, **Bring your design** öffnet eine Dateiauswahl für ein Design, und **Explore the community tools** schließt den Willkommensdialog.

![Der Raum Colours in Design System Setup bei einer frischen Installation: ein Live-Farbfeld, ein Eingabefeld und die ganze erste Entscheidung](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

Von dort führen sieben Räume so weit, wie Sie möchten, in beliebiger Reihenfolge: **Overview**, **Colours**, **Type**, **Logos**, **Tokens**, **Files** und **Usage & rules**. Jede Vorschau in der App aktualisiert sich beim Tippen. [Design System Setup](/info/brand-studio.html) behandelt jeden Raum.

Schriften bleiben auf Ihrem Gerät. Wählen Sie eine Google Font, und Lolly speichert die Datei als Marken-Asset, sodass Ihre Schrift offline mitreist und beim Zeichnen eines Tools nichts abgerufen wird.

### Ein Designsystem ansehen, wechseln und teilen

- **Das aktive ansehen.** **Settings → Design system** zeigt das aktive Designsystem als Titelseite und Seiten, schreibgeschützt.
- **Zwischen ihnen wechseln.** **Settings → Preferences → Design systems** listet jedes Designsystem auf diesem Gerät auf. Eine Organisation kann mehrere Designsysteme betreiben oder eines mit mehreren Farbvarianten; [Marken-Architekturen](/info/brand-architectures.html) bildet die Anordnungen ab.
- **Eines teilen.** Exportieren Sie das Designsystem als `LollyBrand`-Paket: eine Datei, die eine Kollegin oder ein Kollege importiert, um dieselbe Palette, Schriften und Regeln zu erhalten.

Ein Designsystem, das Ihr Build oder Ihre Organisation liefert, ist **verwaltet**: Es zeigt ein Schloss und bleibt schreibgeschützt. Um eines zu ändern, erstellen Sie unter **Settings → Preferences → Design systems** eine bearbeitbare Kopie.

![Der Tab Design system in den Einstellungen: das aktive Designsystem als Titelseite und Seiten](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand&waitSelector=%5Bdata-issue-ready%5D)

Ihr Designsystem sind DTCG-Tokens, das Format, das Penpot liest und schreibt und das Tokens Studio zu Figma bringt; die Palette, mit der Sie gestalten, und die Palette, die Lolly anwendet, sind also ein einziges Dokument. [Design-Tokens](/info/design-tokens.html) nennt die Einzelheiten.

::: details Für Entwickler: ein Marken-Paket über die Kommandozeile erstellen
Um in einem Checkout ein wiederverwendbares Marken-Paket aufzusetzen, akzeptiert `ingest:brand` die drei Container, die Penpot und Tokens Studio exportieren: eine einzelne `tokens.json`, ein Verzeichnis mit Dateien je Satz samt `$metadata.json` oder ein `project.penpot`-Archiv.

```bash
pnpm run ingest:brand ./my-tokens.json --name acme --label "Acme" --activate
```

`--activate` registriert die Marke als Profil und baut und validiert ihren Katalog. Es ändert nie das Standardprofil: Starten Sie mit `LOLLY_PROFILE=acme`, um das neue Paket zu nutzen. [Konfiguration](/info/configuration.html) erklärt, wie Marken-Pakete und Profile zusammenpassen.
:::

## Bringen Sie mit, was Sie schon haben

Sie beginnen nicht auf einer leeren Seite.

**Design-Dateien.** Fertige Arbeit aus Figma, Penpot, Illustrator, InDesign oder einer beliebigen SVG-App öffnet sich in Design als lebendiges Layout: Text bleibt neu tippbar, Formen bleiben Formen, und Bilder landen in Ihrer Bibliothek. Die Datei wird in Ihrem Browser gelesen, und nichts wird hochgeladen. [Ein Design importieren](/info/design-import.html) listet jedes Format auf und was übernommen wird.

**Decks.** Legen Sie eine PowerPoint-`.pptx` auf Lolly ab, um ihre Folien als Assets abzulegen, schreiben Sie in **Markdown Slides** ein neues Deck aus Markdown oder nutzen Sie [Ein Deck neu branden](/info/rebrand.html), um das ganze Deck auf Ihr Designsystem zu übertragen.

**Daten.** Fügen Sie eine CSV- oder JSON-Tabelle ein oder legen Sie sie ab, und die wiederholten Felder eines Tools füllen sich daraus, oder [Batch](/info/batch.html#make-many-versions-of-one-design) erzeugt je Zeile eine fertige Datei.

### Vom Einzelstück zur Vorlage

Ein importiertes Layout ist eine gewöhnliche Design-Sitzung. **Share with rules** macht daraus ein Tool: Sie wählen, welche Teile andere ändern dürfen, und sie füllen nur diese aus.

![Das Design-Master behalten, in einer Autorenkopie Eingaben und Grenzen wählen und dann ein wiederverwendbares .lolly-Tool teilen, das Empfänger ausfüllen](/info/diagrams/concepts/share-with-rules.svg)

[Ein Design mit Regeln teilen](/info/create-a-tool.html) führt durch jeden Schritt.

## Viele erstellen, teilen und automatisieren

- <!--i:download--> **Exportieren.** Tools erzeugen SVG, PDF, PNG, JPG, WebP, Video und mehr, in den Formaten, die jedes Tool bietet, bei Bedarf in echten Druckgrößen. Siehe [Eine Datei exportieren](/info/exporting.html).
- <!--i:link--> **Einen Link teilen.** Die Einstellungen eines Tools reisen in seinem Link, sodass der Link überall dieselbe Datei wieder öffnet.
- <!--i:layers--> **Eine je Zeile erstellen.** Steuern Sie ein Tool aus einer Tabelle in [Batch](/info/batch.html#make-many-versions-of-one-design).
- <!--i:cpu--> **Automatisieren.** Dasselbe Rendering läuft über die [CLI](/info/cli.html) und von einem [KI-Agenten](/info/ai-agents.html).

Ein Link ist eine vollständige Anfrage. Niemand hat das Diagramm unten gezeichnet: Sein Typ, seine Überschrift und seine ganze Datentabelle wurden in die Adressleiste getippt, und derselbe Link zeichnet auf jedem Gerät dasselbe Diagramm.

![Ein Flächendiagramm monatlicher Anmeldungen, dessen sämtliche Werte als Query-Parameter statt per Klick ankamen](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Wie es weitergeht

- <!--i:people--> **[Erstellen](/info/creators.html)**: erstellen, animieren, aufnehmen, teilen und exportieren.
- <!--i:code--> **[Automatisieren](/info/builders.html)**: Designsysteme, Tools verfassen, die Kommandozeile, Links und Agenten.
- <!--i:usercheck--> **[Verwalten](/info/operators.html)**: Lolly für ein Team mit Lolly Work betreiben.
- <!--i:server--> **[Bereitstellen](/info/operate.html)**: Lolly und Lolly Work hosten.
- <!--i:shieldcheck--> **[Vertrauen](/info/trust.html)**: Datenschutz, Sicherheit und eine Datei selbst prüfen.
