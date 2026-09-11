# Übersicht

![Lolly-Icon - großer grün-weißer Lolli](/info/icon.svg)

Dieses Dokument hält den Zweck, die Struktur und die architektonischen Entscheidungen für die Lolly-Plattform fest. Es spiegelt sowohl die Produktvision als auch den aktuellen Stand der Codebasis wider.

> **Status:** Lolly ist ein interner Prototyp in einem **geschlossenen Pilotprojekt, das noch nicht abgeschlossen ist**. Die Engine ist deterministisch und intern konsistent, aber das Produkt ist früh im Stadium - SUSE ist Kunde Nummer eins - und ihre Kryptografie- und Dateiparser-Engines durchlaufen derzeit SUSEs strenge Infrastruktur-Härtung, in Vorbereitung auf Enterprise-Maßstab (das können wir wirklich gut). Lesen Sie die Architektur unten als Design-Absicht im Test, nicht als fertiges, zertifiziertes Produkt. Siehe [Einführung & Governance](/info/adoption-governance.html#status) dafür, wie das Pilotprojekt geführt und gemessen wird.

> **Wie Sie diese Seite lesen.** Sie enthält zwei Arten von Material, in dieser Reihenfolge. Die erste Hälfte ist
> **warum es das gibt**: das Problem, die Positionierung und der Lebenszyklus, den ein einzelnes Asset
> durchläuft. Ab [Das große Ganze](#the-big-picture-how-the-layers-fit) ist es
> **wie die Schichten zusammenpassen**: das Architekturdokument für Mitwirkende, das die Trennung von
> Engine/Shell/Pack, das Repository-Layout, die Auslieferungsziele und die Zusagen behandelt, die jede
> Änderung an der Plattform einschränken. Wenn Sie hier sind, um die Codebasis zu ändern, statt das
> Produkt zu verstehen, beginnen Sie beim großen Ganzen.
>
> Zwei Begleitdokumente gehen tiefer als diese Seite. [`engine/README.md`](../engine/README.md) im
> Repository ist die modulweise Karte der Engine, mit einer generierten Tabelle jedes Moduls und
> was es parst oder schreibt. [Bedrohungsmodell & Vertrauensgrenzen](/info/threat-model.html)
> liest dieselbe Architektur als Vertrauensgrenzen, und es ist die richtige Seite für jede Frage dazu,
> was die Engine als nicht vertrauenswürdig behandelt.

---

## Warum es das gibt

Teams stehen vor einem wiederkehrenden Problem: wiederholbare Kreativ- und Content-Arbeit, die zu vorhersehbar ist, um jedes Mal geschulte Hände zu rechtfertigen, aber zu qualitätssensibel, um sie ohne Leitplanken abzugeben. Das Ergebnis ist entweder langsamer Durchsatz (Spezialisten-Engpass), Uneinheitlichkeit (Menschen nutzen, was gerade zur Hand ist) oder Anbieterbindung (ein SaaS-DAM, das Ihre Templates kontrolliert).

Diese Plattform ist die direkte Antwort darauf:

> **Programmatische Kreativ- und Content-Erstellung im großen Maßstab** - Asset-Erzeugung ohne manuellen Aufwand, mit den Regeln unter zentraler Kontrolle, für Mitarbeitende, Lieferanten und Partner.

Lolly ist nicht der Ort, an dem ein Designsystem erfunden wird - es ist der Ort, an dem es produziert wird. Denken Sie an einen Verkaufsautomaten für Design: Sie treffen eine Auswahl, Sie erhalten ein Ergebnis. Jedes Mal. Die Engine arbeitet auf die höchste Qualität hin, die jedes Format auf der Hardware vor Ihnen erzeugen kann, und dieselbe Engine erzeugt dieselbe Datei auf jeder Oberfläche, auf der sie ausgeliefert wird.

Das Ergebnis ist **Fülle**: jede Veranstaltung hat korrekte Beschilderung, jeder CVE-Alert entspricht dem Hausstil, jedes Etikett druckt sauber, jede E-Mail-Signatur ist aktuell - alles ohne Design-Ticket. Die Plattform übernimmt wiederkehrende, operationalisierte Kreativarbeit. Sie ist bewusst kein Tool für maßgeschneiderte Kreativarbeit - Designer verantworten weiterhin die Flaggschiff-Arbeit.

### Probabilistisch innovieren, deterministisch skalieren

Jede Diskussion über KI in einer kreativen Pipeline bleibt an derselben Frage hängen: Welcher Teil davon ist Aufgabe der Maschine? Es ist eine alte Frage mit einer längst gefundenen Antwort. Schreiber und Buchmaler arbeiteten schon immer mit zwei Werkzeugen - der losen Skizze, in der nichts festgelegt war und alles ausprobiert werden konnte, und der Druckerpresse, gerade deshalb einschüchternd, weil sie sich festlegte. In den Skizzen entstand die Kunst. Die Presse war der Weg, auf dem sie jeden erreichte. Niemand verwechselte die beiden, und beide entwickelten sich weiter - neue Tinten, neue Schriften, neue Pressen - jede im Einklang mit dem Handwerk und der Absicht, der sie diente, verbessert.

Lolly zieht dieselbe Grenze. Probabilistisch erkunden: ein Modell, ein Designer, eine grobe Idee, ein Prompt, der irgendwohin führt, das niemand geplant hat. Dann deterministisch skalieren - das, was zehntausend Ausgaben erreicht, ist ein *Tool*, und ein Tool rendert aus lesbaren Eingaben jedes Mal auf dieselbe Weise. Das Erkunden bleibt frei, weil nichts Nachgelagertes davon abhängt, dass es zweimal gleich ausfällt. Die Ausgabe verdient Vertrauen, weil sie kein Ratespiel ist. KI-Experimente in vorhersagbare, reproduzierbare Ergebnisse zu überführen ist keine neue Disziplin; es ist dieselbe Arbeitsteilung, die gedrucktes Werk überhaupt erst vertrauenswürdig gemacht hat.

> Dem kreativen Prozess vertrauen, mit Präzision skalieren.

### Im Vergleich zu den Alternativen

::: figure positioning-comparison
Funktionsvollständigkeit heutiger Creative-Tools, recherchiert im August 2026. Bewertung: 0 nicht vorhanden, 25 nur mit Workaround, 50 real, aber eingeschränkt oder Teillösung, 75 stark mit Einschränkungen, 100 Kernkompetenz.
:::

Die Lücke ist offensichtlich: Nichts, was heute ausgeliefert wird, liefert constraints-first, offlinefähige, anspruchslos bedienbare, intern zugängliche Ausgaben. Lolly enthält sogar eine offene Zeichenfläche - **Design** - in der Farben, Schrift und Assets sich an die globalen Markenvorgaben halten, sodass freie Anordnung constraints-first bleibt. Was es **nicht** ist, ist eine uneingeschränkte Design-Suite: Designer nutzen für individuelle Flaggschiff-Arbeiten weiterhin Illustrator und Figma. Mit diesem Tool lassen sich Variationen zusammenstellen.

![Jedes Tool der Bibliothek als Karte, nach Kategorie gruppiert, sodass ein Produzent eines auswählt und loslegt](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Geeignet für:** Die schnelle Erstellung operationalisierter Creative-Assets - Event-Kacheln, Namensschilder, Signaturen, CVE-Warnungen, QR-Codes, Social-Cards, Versandetiketten, strukturierte Berichte.

**Nicht geeignet für:** Individuellen Hero-Content.

---

## Der Lebenszyklus einer Kampagne

Am klarsten wird deutlich, was Lolly ist, nicht anhand einer Funktionsliste - sondern indem man ein einzelnes Asset verfolgt, während es von Hand zu Hand weitergereicht wird. Sehen Sie, wie eine lokalisierte Kampagnenkarte die Organisation durchläuft:

1. **Die Kreativabteilung legt die Regeln fest.** Ein Designer erstellt die Basisvorlage im Design-Tool und kodiert die Typografie- und Farbvariablen der Marke fest. Sie erstellen nicht eine Karte - sie leisten die Grundlagenarbeit *einmal*, damit sie sie nie wieder von Hand lokalisieren müssen.
2. **Die Entwicklung skaliert sie.** Dieselbe Vorlage wird über die CLI in eine nächtliche Pipeline eingebunden, sodass ein neues Diagramm oder eine neue Sprachvariante automatisch erzeugt wird - kein Designer öffnet die Datei erneut.
3. **Die Produktion nutzt sie einfach.** Ein Vertriebsmitarbeiter, offline im Flugzeug, öffnet dasselbe Tool und erstellt für ein Kundengespräch eine perfekt markenkonforme Präsentation. Kein Design-Know-how, kein Netzwerk, keine Wartezeit.

Das „neue Diagramm" in Schritt zwei ist ein Render wie dieses, erzeugt aus einer Datenzeichenkette und einer Handvoll Parameter, ohne dass jemand eine Design-Datei öffnet:

![Ein betiteltes gestapeltes Flächendiagramm, dessen drei Serien in einer kühlen Palette gebändert sind, mit Achsen, Legende und Titel, alle von der Vorlage statt von Hand platziert](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Der Punkt ist nicht, dass Lolly gut für Designer *und* gut für Entwickler *und* gut für den Vertrieb ist, jeweils für sich betrachtet. Es ist ein **Staffellauf**: Die ursprüngliche Arbeit der Kreativabteilung wird von der Entwicklung skaliert, was wiederum die Produktion befähigt. Das mühelose Erlebnis für den technisch unbedarften Mitarbeiter im Flugzeug ist nur *möglich*, weil der Designer die Präzision vorgegeben und die Entwicklung sie umgesetzt hat.

Das ist der Kraftmultiplikator. Lolly ist keine Schublade getrennter Tools für getrennte Rollen - es ist ein einziger deterministischer Asset-Lebenszyklus, den jede Rolle berührt, und jede Hand, durch die er geht, vervielfacht den Wert der vorherigen.

---

## Eine Freigabe, zehntausend Assets

Da die Freigabe im Tool liegt und nicht in der Datei (siehe [Wie Lolly sich einordnet](/info/positioning.html)), wird Skalierung nicht mehr zum Review-Problem. Geben Sie ein lokalisiertes Social-Card-Tool einmal frei und erzeugen Sie daraus **10.000 Assets in 12 Sprachen** aus einer Tabelle - und keines davon braucht eine erneute Compliance-Prüfung durch Recht oder Marke, weil die Vorlage, aus der sie alle stammen, bereits freigegeben wurde.

Dasselbe deterministische Tool erreicht diese Größenordnung auf drei Wegen, die alle identische, vorab freigegebene Ausgaben erzeugen:

- <!--i:people--> **Eine Person, in der App.** Das `/pro`-Batch-Raster: Zeilen einfügen oder importieren, pro Zeile ein fertiges Asset erhalten, das Zip herunterladen. Kein Design-Know-how, kein Ticket, keine Wartezeit.
- <!--i:code--> **Ein Entwickler, über die Kommandozeile.** Die CLI führt dieselbe Engine und denselben Render-Pfad headless aus, sodass das Tool über alle 10.000 Zeilen in einem Skript oder einer nächtlichen Pipeline durchlaufen werden kann. Ein `lolly <tool> --field=…`-Aufruf in einer Schleife ist die gesamte Integration.
- <!--i:cpu--> **Ein System oder ein KI-Agent, über MCP.** Dasselbe Tool programmgesteuert bedient, mit derselben Genauigkeit und sogar größerem Umfang - weil eine Maschine nicht gelangweilt wird, während Tausende Dateien eintreffen.

![Batch-Modus bei einer frischen Installation: eine leere Zeile wartet auf ein Tool, mit der ganzen Tabellenoberfläche und ihrer Rendern-Schaltfläche schon vorhanden, bevor Daten eintreffen](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

Ein Satz Markenvorgaben, einmal von einem Designer festgelegt; drei Wege zur identischen, vorab freigegebenen Ausgabe - und der maschinelle Weg skaliert am weitesten von allen, weil er nie ermüdet, während die Dateien eintreffen.

---

## Das Gesamtbild: wie die Schichten zusammenpassen

Alles ab hier ist Architektur. Das Diagramm zeigt das gesamte System auf einen Blick: Tools sind
oben Daten, die Engine in der Mitte kennt keine Plattform, die Shells darunter
implementieren einen einzigen Vertrag, und die Kataloge liefern den Inhalt.

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### Repository-Layout

Inhalte werden als Packs eingebunden: `community/`, `docs/`, jedes `shells/*`, beide `services/*` und `brands/suse` sind jeweils ein eigenes Repository, als Git-Submodule dieses Repositorys ausgecheckt. Das übergeordnete Repository besitzt `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` und `profiles.json`. Den Checkout-Befehl und den repositoryübergreifenden Workflow finden Sie unter [Build-Guide » Quellcode beziehen](/info/build-guide.html).

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Plattform-Bereitstellungsmodell

Die Plattform läuft auf mehreren Oberflächen - Web-PWA, Tauri Desktop/Mobile, der skriptfähigen CLI und der interaktiven TUI. Alle nutzen dieselbe Engine und dieselben Tool-Dateien.

### Web (PWA) - primäre Distribution
Gehostet unter einer von SUSE kontrollierten URL. Funktioniert offline, sobald der Service Worker Tools und Assets zwischengespeichert hat. Hier werden die meisten Mitarbeitenden, Anbieter und Partner die Plattform nutzen. Kein Konto erforderlich - der Zustand wird pro Gerät in IndexedDB gespeichert.

Die Web-Shell ist aus einem einzigen Layout heraus responsiv. Auf dem Desktop ist ein Tool eine größenveränderbare Steuerungs-Seitenleiste neben einer Vorschaufläche mit trackpad-nativer Canvas-Navigation (Cmd/Strg-Mausrad oder Zwei-Finger-Zoom um den Cursor, Leertaste- oder mittlerer Klick-Zug zum Verschieben, Tasten `0`/`1`/`+`/`−` und ein Fit/%-HUD). Auf Mobilgeräten (≤640px) werden die Steuerelemente zu einem oben verankerten Sheet mit einem Ziehgriff, der zwischen Peek/Halb/Voll einrastet (Tippen schaltet um), über einer statischen Vollbild-Vorschau, und eine schwebende Schaltfläche **Render** öffnet die **Export**-Steuerelemente in einem Bottom-Sheet-Popup. Touch erhält Pinch-Zoom und Zieh-Schwenk auf der Vorschau. Der Render-Pfad und die Export-Steuerelemente sind in beiden Fällen identisch - nur die Bedienoberfläche passt sich neu an.

![Die Desktop-Splitansicht - links aus dem Manifest generierte Steuerelemente, rechts die Live-Canvas](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

Dasselbe Tool in Handybreite, ohne ein zweites Layout pflegen zu müssen: Die Steuerelemente werden oben zu einem Sheet, die Vorschau nimmt den gesamten Bildschirm ein, und die Render-Pille schwebt darüber.

![Ein Audiogramm auf einem 430px breiten Bildschirm - das Steuerungsblatt oben, das fertige quadratische Artwork unten und die schwebende Rendern-Pille](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Batch-Modus (`/pro`).** Die Web-Shell liefert außerdem ein tabellenartiges Batch-Raster (`shells/web/src/pro/`), das viele Zeilen gleichzeitig über ein oder mehrere Tools rendert. Es unterstützt CSV/TSV-Roundtrip plus Tabellen-Einfügen, Vorlage/Format/Größe/Einheit/DPI pro Zeile, ein Blocks-Editor-Seitenpanel mit Live-Vorschau, einklappbare Export-Spalten, eine „Relevanz"-Tag-Leiste pro Zeile, das Neuordnen von Zeilen per Zieh-Griff links, eine zweistufige Löschbestätigung, gespeicherte Batch-Sessions und einen `.zip`-Download. Das ist die 1:n-Oberfläche hinter der Positionierung „Massen-Content-Erstellung".

### Tauri Desktop / Mobile
Verpackte native App (kleiner Footprint dank Tauri). Bietet vollständige Offline-Verfügbarkeit, Dateisystemzugriff für CLI-abhängige Tools (PDF Smasher, Font Outliner) und Kamerazugriff. Für Mitte 2026 ist ein Tooling-Ausbau geplant.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Desktop-Nutzer können viele Tools über das Terminal aufrufen. Die CLI-Shell lädt dieselbe Engine, erzeugt ein jsdom-DOM, durchläuft denselben Render-Pfad und schreibt die Datei. Der URL-Modus ist der Transport - die CLI ist keine eigenständige Implementierung. Das garantiert, dass CLI- und GUI-Ausgaben identisch sind.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`npm run tui`

Das interaktive Gegenstück zur CLI: eine bildschirmfüllende, tastaturzentrierte Terminal-App (auf Basis von Ink) zum Durchsuchen von Tools, Ausfüllen von Eingaben, Speichern von Projekten und Exportieren - alles ohne GUI. Ihre Host-Bridge **nutzt die Implementierung der CLI wieder** für die DOM-freien Formate (SVG/EMF/EPS/HTML + Text/Daten) und ergänzt sie um einen Zustand auf der Festplatte unter `~/.lolly` sowie eine optionale Inline-Vorschau. Darüber hinaus verfügt sie über eine **Browser-Render-Ebene**: ein abgegrenztes, headless Chromium (dasselbe, das der MCP-Server installiert), das auf Anfrage Raster/PDF/Video sowie Live-URL-Erfassung erzeugt - es steuert eine gebaute Kopie der Web-Shell an, sodass die Ausgabe identisch ist, und startet erst, wenn ein solches Format zum ersten Mal exportiert wird. So laufen auch `url-shot` (mit Zuschnitt + Neueinfärbung + vektoriellem PDF/SVG) und jedes Raster-/PDF-Tool im Terminal. Siehe den [TUI-Guide](/info/tui.html).

Auf welcher Oberfläche Sie sich auch befinden, der Tab **Capabilities** im Dashboard zeigt die vollständige Übersicht dessen, was die Plattform zu leisten erklärt - gruppiert und lesbar, ohne ein einziges Tool zu öffnen.

---

## Tool-Kategorien

Tools werden in ihrem Manifest mit einer `category` versehen, um sie in der Galerie zu gruppieren.

Die Zeilen erscheinen in der Reihenfolge der Galerie-Abschnitte. Der Abschnitt `utility` wird immer **zuletzt** in der Galerie angezeigt (nach jeder anderen Kategorie, auch künftigen) - er ist die geräteinterne Schublade "Offline Utilities".

| Kategorie | Beispiele | Geplant |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence Studio, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Multi-Page PDF | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text Helper, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Diese Zellen sind **Beispiele, keine Inventarlisten**. Welche Tools existieren, ist eine Eigenschaft des von Ihnen eingebundenen Profils, nicht dieser Seite: Ein Brand Pack fügt eigene hinzu und kann ein Community-Tool ausschließen, das es lieber nicht ausliefert. `catalog/tools/index.json` - aus den Manifesten generiert und das Register, das die Galerie tatsächlich liest - ist die maßgebliche Liste; um zu zählen, was ein Profil einbindet, zählen Sie die Manifeste (`ls community/*/tool.json brands/*/tools/*/tool.json`), statt sich auf eine hier notierte Zahl zu verlassen. (Eine Tool-ID, die in zwei Packs vorkommt, wird einmal eingebunden, aus dem gewinnenden Pack.)

Tools werden außerdem nach Status klassifiziert: `official` (von der Marke freigegeben, kein Wasserzeichen), `community` (externer Beitrag), `experimental` (Exporte mit Wasserzeichen). Der Großteil der Bibliothek ist `official`; die neueren Studios und die Aufnahme-Tools liegen tendenziell bei `community` oder `experimental`, während sie sich einpendeln. Jede Oberfläche zeigt das Badge, sodass Lesende wissen, was sie sich holen, bevor sie es öffnen - und wie bei den Kategorie-Zellen oben ändert sich die Zuordnung nach Status zu schnell, um sie hier aufzuzählen. Lesen Sie sie aus der Galerie oder dem generierten Index ab.

**Design** ist das erste Tool, das auf dem freien Canvas-Modus `render.layout: "editor"` aufbaut - eine chromlose Oberfläche zur direkten Bearbeitung, auf der Sie Boxen mit Text, Formen und Bildern ziehen, skalieren, drehen und einrasten lassen, und die dann über denselben Render-Pfad exportieren wie jedes andere Tool.

**Strip Hidden Data** ist das erste **geräteinterne Tool** (`privacy: "on-device"`): ein Content-Transform-Tool, das eine von *Ihnen* bereitgestellte Datei komplett im Browser verarbeitet und eine saubere Kopie zurückgibt - niemals hochgeladen, niemals mit Wasserzeichen versehen, keine Herkunftsangabe eingebettet. **Text Helper** ist das zweite - eine geräteinterne Werkbank für alltägliche Copy-Paste-Aufgaben (JSON-Formatierung, JWT-Dekodierung, Base64, URL-Encode/Decode, SHA-Hashing). **Compress PDF** ist das dritte - es verkleinert ein PDF durch Neukomprimierung seiner Bilder, ebenfalls vollständig geräteintern. Die Markierung und ihr Badge-Text "Runs on your device - nothing is uploaded" decken nun das gesamte Transform-Set ab: Strip Hidden Data, Text Helper, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (Bereiche eines Bilds, SVG oder PDF unkenntlich machen), **Prompt to Image** und **Rebrand a Deck** (ein `.pptx` an Ort und Stelle neu einfärben), sofern das Profil es einbindet. Dies ist eine Datenschutz-Utility-Kategorie, die das Weitergeben vertraulicher Dateien an Einzweck-Websites ersetzt.

![Die Utilities-Schublade, in der jede Karte ein Tool ist, das eine bereits vorhandene Datei transformiert](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Hinweis: `category` und `status` werden aus jedem `tool.json` in `catalog/tools/index.json` (das Register, das die Galerie liest) denormalisiert. Das Manifest ist die Quelle der Wahrheit - der Index wird von `npm run build:catalog` **generiert**, und `npm run validate:catalog` lässt CI fehlschlagen, wenn der eingecheckte Index von den Manifesten abweicht.

---

## Architektonische Festlegungen

Diese Entscheidungen sind gesetzt. Jede davon zu ändern ist ein größeres Unterfangen - sie prägen jede andere Entscheidung in der Codebasis.

### 1. Deklarative Tools mit imperativer Notlösung

Ein Tool besteht aus einem Manifest (`tool.json`) + einer Vorlage (`template.html`) + optionalem `hooks.js`.

**Das Manifest deklariert Inputs.** Nicht die Vorlage. Inputs werden nicht aus Handlebars-Tokens abgeleitet. Das Manifest ist der Vertrag; die Vorlage nutzt benannte Variablen über `{{id}}`.

![Der Kontroll-Stack von Street Map - ein Städte-Dropdown, eine Themenauswahl, Gewichts-Schieberegler und Farb-Trigger, jeder davon aus einer Manifest-Zeile gezogen](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks sind optional.** Die meisten Tools sind rein deklarativ - Manifest + Vorlage genügt. Tools, die berechnete Werte benötigen (QR-Kodierung, Aufbereitung von Chart-Daten), stellen `hooks.js` bereit, das benannte Lifecycle-Funktionen exponiert (`onInit`, `onInput`, `onFrame` - der Per-Frame-Hook für Live-Kamera bei bewegungsreaktiven Tools - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - der Datei-rein/Datei-raus-Transformationspfad, den geräteinterne Utilities wie Strip Hidden Data nutzen - und `exportStill` für ein Tool, das sein eigenes tiefes Rastering besitzt). Der Host lädt Hooks über `new Function('host', …)` mit der Capability Bridge als Closure-Scope injiziert. Dies ist ein **Portabilitätsvertrag, keine Sicherheits-Sandbox**: Hooks laufen weiterhin im Realm der Seite und *können* in einer Browser-Shell auf `window`/`fetch`/`document` zugreifen - `host.*` ist die unterstützte, portable Oberfläche, keine erzwungene Grenze. Asynchrone Hook-Ergebnisse sind zeitlich begrenzt (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s), und verspätete Ergebnisse werden verworfen; ein außer Kontrolle geratener *synchroner* Hook kann nicht unterbrochen werden. Nicht vertrauenswürdiger Drittanbieter-Hook-Code ist daher erst sicher auszuführen, wenn die Worker-Isolation ausgeliefert ist.

Das ist wichtig, weil: deklarative Tools von Nicht-Entwicklern erstellt werden können. Wäre jedes Tool eine Web-App, würde der Risikohinweis "begrenzte Kompetenzen zum Erstellen/Pflegen von Arbeits-Templates" zu einem dauerhaften Engpass.

### 2. Tools und Assets sind Daten, kein gebündelter Code

Die Web- und Tauri-Apps holen Tool- und Asset-Kataloge beim Start von einer bekannten URL, cachen sie lokal und arbeiten mit dem, was vorhanden ist. **Eine neue Event-Kachel oder ein saisonales Asset hinzuzufügen erfordert kein App-Release.**

Asset-Bytes werden per SHA-256 geprüft, um CDN-Poisoning zu verhindern. Asset-`id` + `version` steuert die Cache-Invalidierung.

### 3. Die Capability Bridge ist die einzige API, die Tools sehen

Tools rühren nie das DOM außerhalb ihres Vorlagenbereichs an, rufen nie direkt `fetch` auf, lesen nie das Dateisystem. Sie rufen versionierte `host.*`-Methoden auf. Die kanonische Definition des Vertrags ist `packages/core/src/host-v1.ts` - das Tool-Autoren-SDK `@lolly-tools/core`, sodass Dritte dagegen entwickeln können, ohne von der Engine abhängig zu sein; `engine/src/bridge/host-v1.ts` ist ein Typ-Reexport davon, und Engine-/Shell-Code importiert weiterhin unverändert von diesem Pfad:

| Bridge-API | Was sie tut |
|---|---|
| `host.profile` | Vorname, E-Mail, Porträt, Stadt usw. des Nutzers. Füllt Inputs über `bindToProfile` vor. |
| `host.assets` | Katalogabfragen, Asset-Auflösung, vom Host bereitgestellte Picker-UI. |
| `host.state` | Input-Slots speichern / laden. IndexedDB im Web, Dateisystem in Tauri, Speicher in der CLI. |
| `host.clipboard` | Text oder Bild in die Zwischenablage schreiben (mit Plattform-Fallbacks). |
| `host.export` | Rendert oder serialisiert das Render-Ziel. Wendet Wasserzeichen bei experimentellen Tools an. |
| `host.net` | Fetch mit Allowlist - nur verfügbar, wenn das Tool die Capability `"network"` deklariert hat. (Kein ausgeliefertes Tool nutzt das derzeit.) |

Optionale, additive Oberflächen erscheinen nur, wenn eine Shell sie bereitstellt. Manche sind **Capability-gated** - nur exponiert, wenn das Tool das passende Flag deklariert: `host.compose` (das Rendering eines anderen Tools einbetten - `compose`), `host.capture` (Seitenaufnahme für URL Screenshot - `capture`) und `host.recorder` (Mikrofon-/Kamera-/Bildschirmaufnahme für die Aufnahme-Tools - `microphone` / `camera` / `screen`). Der Rest ist **Feature-detected** - vorhanden, wann immer die Shell es bereitstellen kann, wobei das Tool einen Fallback für Shells behält, die es nicht können.

Eine Handvoll zentraler Oberflächen, um zu zeigen, was abgedeckt wird - [Host API](/info/host-api.html) dokumentiert jede einzelne, und `packages/core/src/host-v1.ts` ist der Vertrag selbst:

| Oberfläche | Seit | Was sie hinzufügt |
|---|---|---|
| `host.tokens` | 1.0 | DTCG-Design-Tokens - die eigenen Grundbausteine der Marke |
| `host.text` | 1.0 | Text-zu-Pfad über HarfBuzz WASM (das `wasm`-Capability-Flag kennzeichnet Tools, die darauf angewiesen sind) |
| `host.media` | 1.4 | Live-Kamerabilder, die den `onFrame`-Hook antreiben. Progressive Verbesserung, bewusst *nicht* durch das `camera`-Flag abgesichert - ein solches Tool funktioniert weiterhin auch als gewöhnliches Standbild-Tool |
| `host.color` | 1.40 | Perzeptuelle Farbmathematik: ΔEOK, WCAG- und APCA-Kontrast, OKLab-Verläufe, Klassengrenzen, kategoriale Paletten, Harmonieschemata (1.60), CSS-Color-4-Mischung und Verlaufsbacken (1.68). Rein und synchron - Shells binden Engines `makeColorApi()` ein, statt selbst etwas zu implementieren, sodass es nicht auseinanderdriften kann |
| `host.images` | 1.60 | Bytes auf dem Gerät dekodieren / skalieren / neu kodieren - der Konvertierungspfad (HEIC → JPEG, Komprimierung zu WebP, Herunterskalieren). In der Web-Shell als Lazy-Facade ausgeliefert, sodass der HEIC-Decoder nie in den Boot-Chunk gelangt |
| `host.geom` | 1.64 | Exakte Vektorgeometrie: Pfad-Booleans, Versatz, Kontur-zu-Fläche, Spline-Reduzierung, Vereinfachung, Trefferprüfung. Ebenfalls rein, synchron und von der Engine eingebunden (`makeGeomApi()`); Fehler werden *zurückgegeben*, nie geworfen |

Der Rest folgt denselben Regeln und ist gleich mitdokumentiert: `pdf` (1.8) und `pptx` (1.58) für geräteinterne Dokumentchirurgie, `audio` (1.71) und `speech` (1.96) für Clip-Analyse sowie geräteinternes TTS/Transkription, `viz` (1.72) für den MilkDrop-Platzhaltervertrag, `codec` (1.100) und `layers` (1.102) für Deep-Bit- und Layered-Bitmap-Ausgabe, `upscale` (1.101) und `matte` (1.103) für die geräteinternen Modelle, `raster` (1.105) für Hooks mit eigener Pixelarbeit, `connectors` (1.106) für exportsichere Pfeile und `c2pa` (1.85) für das Signieren fertiger Bytes. Die Zahl wächst; die Regeln nicht.

Die deklarierbaren Capabilities sind: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, hinzugefügt in 1.54, ist Bildschirmaufnahme über `host.recorder` - der Nutzer wählt einen Bildschirm/ein Fenster/einen Tab in browsereigener UI; zu unterscheiden von `capture`, das eine vom Tool selbst benannte URL rastert.)

Dasselbe Tool läuft im Browser, in Tauri und in der Headless-CLI, weil jede Shell diese Schnittstelle implementiert - das Tool weiß nie, in welcher es sich befindet.

Die Bridge ist versioniert. Methoden hinzuzufügen ist eine Minor-Version. Signaturen zu entfernen oder zu ändern ist ein Major-Version-Sprung. Wenn v2 erscheint, muss v1 weiter funktionieren.

### 4. Asset-IDs gelten für immer

`suse/logo/primary` ist ein Vertrag. Einmal veröffentlicht:
- Die ID ändert sich nie, wird nie wiederverwendet.
- Byte-Änderungen → `version` im Manifest erhöhen.
- Durch ein neues Asset ersetzt → `deprecated: true` setzen und optional `replacedBy`.
- Bestehende Referenzen lösen sich immer auf.

Das macht gespeicherte Tool-Zustände und per URL geteilte Links über Jahre hinweg dauerhaft.

### 5. Der URL-Modus ist erstrangig

Jeder Input muss als URL-Parameter ausdrückbar sein:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![Dieser Link für sich allein, ohne sonst etwas darin, ist das fertige Asset](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Der CLI-Modus ist der URL-Modus unter einem anderen Transport - die CLI-Shell baut aus argv ein URL-State-Objekt und führt **dieselbe** Engine-Pipeline aus. Es gibt einen einzigen Render-Pfad. Die CLI kann nicht von der GUI abweichen, weil sie keine separate Implementierung ist.

`url-mode.ts` übernimmt den Round-Trip (Parsen und Serialisieren). Ein Satz **reservierter Parameter** wird dem Tool nie als Input weitergegeben: die Ausgabesteuerungen (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), die Druck- und Herkunftsregler (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) und die Zustandsträger (`template`, `z` - das gepackte "Kürzester Link"-Token - und `zx`, dasselbe mit Passwort verschlüsselt). Der Satz `RESERVED` in `engine/src/url-mode.ts` ist die maßgebliche Quelle und durch einen Test fixiert; [URL Mode](/info/url-mode.html) dokumentiert jeden einzelnen davon, einschließlich der wenigen hier nicht aufgeführten. Asset-Inputs im URL-Modus werden über ihre `id` serialisiert; die Runtime löst sie vor der Hydration über `host.assets.get()` auf. `width`/`height` sind Werte in `unit` (Standard `px`, auch `mm`/`cm`/`in`/`pt`/`pc`); bei einer physischen Einheit legt `dpi` die Rasterauflösung fest. Sie bestimmen die Dokumentgröße der Canvas und füllen das Export-Dimensionen-Panel vor.

Da jeder Input im Link mitreist, ist eine Parameteränderung ein anderes fertiges Asset. Diese ganze Palette ist eine Ausgangsfarbe, eine Harmonie und eine Stufenzahl:

![Neun Stufen über vier Farbtöne, alle aus der einzelnen Startfarbe im Link erzeugt](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Speicherung läuft über die Bridge, nicht direkt

Web-Shell: IndexedDB. Tauri: Dateisystem. CLI: im Arbeitsspeicher. Tools sehen nur `host.state.save(slot, data)` und `host.state.load(slot)`. `localStorage` wird nicht verwendet - er ist zu klein und kann keine Blobs speichern.

Nutzer können mehrere benannte Bearbeitungsstände pro Tool speichern und später zu jeder Sitzung zurückkehren. Es ist keine Kontoerstellung nötig; der Zustand ist gerätebezogen. Weil die Bridge die einzige Schnittstelle ist, ist dieser gerätebezogene Zustand auch *portabel*: `shells/web/src/data-transfer.ts` liest alles über `host.profile`/`host.state`/`host.assets` wieder aus in ein einziges `lolly-backup`-Zip, das sich auf jeder anderen Installation importieren lässt - die Offline-Antwort auf "auf ein neues Gerät umziehen", die keinen Server braucht (vollständige Spezifikation: `docs/data-transfer.md`). Die SUSE-ID-Integration (Mehrgeräte-Synchronisierung) ist ein zukünftiger Meilenstein darauf aufbauend.

### 7. Reifegrad-Tags beantworten das Risiko der "Markenfreigabe" von Grund auf

Jedes Tool gibt in seinem Manifest `status: official | community | experimental` an. Die Galerie sortiert nach Status. Experimentelle Tools versehen ihre Exporte automatisch mit einem Wasserzeichen - das Wasserzeichen wird von `host.export.render` angewendet, nicht vom Tool, sodass es von keinem nicht-offiziellen Tool-Autor abgeschaltet werden kann.

Das ist eine strukturelle Antwort auf das Wahrnehmungsrisiko, dass die Nutzung eines beliebigen Tools eine Markenfreigabe suggeriert. Prozessantworten (eine Prüfwarteschlange, SUSE-ID-Gating) kommen zusätzlich obendrauf.

### 8. Tool-Eingaben sind über das Manifest typisiert, einschließlich Assets

Eingaben deklarieren einen `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` und `file`. Der Host rendert pro Typ ein generisches Steuerelement aus dem Manifest - Tools schreiben keinerlei Steuerelement-Code. (Das Vorausfüllen aus dem Nutzerprofil ist kein Typ - jede Eingabe kann `bindToProfile` tragen.) Drei davon haben mehr Gewicht als der Rest:

- **`asset`** (mit `filter` und `allowUpload`) ist die Brücke zum globalen Asset-System; `allowUpload: false` ist der Hebel zur Markendurchsetzung für Dinge wie Sponsoring-Kachel-Logos, bei denen nur Bibliotheks-Assets erlaubt sind. Nutzer-Uploads verwenden dieselbe `AssetRef`-Form wie Bibliotheks-Assets, sodass Tools sie identisch behandeln.
- **`blocks`** ist eine wiederholbare Feldgruppe - eine Mini-Tabelle innerhalb einer Eingabe, bearbeitet in einem Seitenpanel, mit einem typisierten/unterscheidenden Hinzufügen-Menü und Asset-Feldern pro Block. Ein Klick auf einen gerenderten Block auf der Canvas fokussiert die Zeile dieses Blocks. Verwendet von `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` und `digi-ad`.
- **`vector`** gruppiert einen festen Satz von Zahlen (z. B. eine Transformation) zu einem zusammengesetzten Steuerelement; **`file`** hält die eigene Datei des Nutzers als Bytes im Arbeitsspeicher für On-Device-Transform-Werkzeuge (z. B. `strip-data` und `compress-pdf`).

### 9. Templates sind logikfrei (Handlebars, nicht EJS)

Handlebars wurde bewusst gegenüber EJS gewählt:
- Logikfrei. Templates können von Nicht-Entwicklern erstellt werden.
- Standardmäßig sicher. `{{x}}` escaped HTML; `{{{x}}}` ist optional roh.
- Kein beliebiges JS in Templates bedeutet keine Angriffsfläche für eine Prüfung pro Template auf XSS.

Logik lebt in `hooks.js`, wo sie explizit und überprüfbar ist. Verfügbare Handlebars-Helfer: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (dazu Datenformat-Helfer `icsStamp`/`rfcText`/`csvCell`, verwendet von begleitenden `.ics`/`.vcf`/`.csv`-Templates).

### 10. Tools setzen sich aus Tools zusammen

Ein Tool kann das Rendering eines **anderen** Tools einbetten, ohne Tool-zu-Tool-Importe - die Komposition wird von der Engine aufgelöst, niemals vom Tool-Code. Es gibt zwei Oberflächen:

- **Deklaratives Manifest** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. Die Engine rendert das benannte Kind-Tool und platziert das Ergebnis im logikfreien Template als `{{asset <id>}}`. `event-name-badge` setzt sich heute aus `qr-code` als SVG zusammen.
- **Portable Einbettungs-URL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. Die Shell rendert dieses Kind **lokal** (bis das lokale Rendering abgeschlossen ist, wird ein Platzhalter-Pixel angezeigt); es wird nie etwas von `lolly.tools` abgerufen.

Das Rendering jedes beliebigen Tools lässt sich zusammensetzen: Ein **SVG**-Kind bleibt ein echter Vektor, wenn das Eltern-Tool nach SVG oder PDF exportiert, und rastert scharf für PNG; **PNG/JPG/WEBP**-Kinder werden als Bilder eingebettet. Erfordert die Fähigkeit `compose`. Zusammengesetzte Kinder sind Zwischenprodukte - nie mit Wasserzeichen versehen oder mit Provenienz gestempelt - und die Komposition degradiert grazil: Eine Shell, die ein Kind nicht rendern kann, lässt den Slot einfach aus, und das Eltern-Tool wird trotzdem gerendert.

---

## Was wir bewusst nicht getan haben

- **Kein EJS / kein beliebiges JS in Templates.** Die XSS-Angriffsfläche ist null. Logik lebt in `hooks.js`.
- **Kein verpflichtendes Asset-CMS.** Einzelpersonen nehmen ihre eigenen Kreativdateien direkt in der App in ihren Katalog auf (die Ansicht [Katalog](/info/using.html) und das Brand Studio) - kein Server, keine Admin-Konsole. Arbeit wird als **Sitzung** weitergegeben: Ein Freigabelink trägt den gesamten Zustand, und dieselbe Sitzung reist in einem Backup oder über eine Collab-Sitzung mit. Wer auch immer das Deployment kontrolliert, kann eine geteilte Sitzung dann als **Template** festschreiben - den Link öffnen, ihre Werte als Template-Eintrag im Verzeichnis dieses Tools im Brand-Pack festhalten und committen -, wonach sie in der "New from template"-Auswahl des Tools erscheint und als `?template=<id>` direkt verlinkbar ist. Git ist der Festschreibungsschritt des Deployment-Betreibers, nie der der erstellenden Person. Für einen *geteilten, geregelten* Katalog **kann** eine Organisation das Asset-Verzeichnis auf dieselbe Weise verwalten und Aktualisierungen über PR-Review absichern - ein verfügbares Governance-Modell, keine Anforderung der App.
- **Kein erzwungenes RBAC.** Die offene App ist standardmäßig öffentlich zugänglich; Markenrisiko wird über Reifegrad-Kennzeichnungen und Wasserzeichen gesteuert. Eine Organisation, die strengere Kontrolle möchte, legt ihre eigene Authentifizierung und den oben beschriebenen git-geprüften Katalog darüber.
- **Keine zentrale Datenbank.** Aller Nutzerzustand liegt pro Gerät. Die SUSE-ID-Integration steht auf der Roadmap, ist aber kein Startblocker.
- **Kein gemeinsamer Tools-/Engine-Codepfad.** Die Engine ist Open Source, ebenso die markenneutralen Tools in `community/`; ein Brand-Pack wie das private `brands/suse/` trägt seine eigenen Tools und seinen eigenen Katalog nach eigenen Bedingungen. So oder so wird die Trennung erzwungen (keine Cross-Imports von `engine/` in Tool-Inhalte), damit die Aufteilung sauber bleibt.

---

## Lebenszyklus, von Anfang bis Ende

Ein Nutzer öffnet `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Boot.** Die Web-Shell öffnet IndexedDB, baut die Fähigkeiten-Bridge auf, synchronisiert die Tool- und Asset-Kataloge (oder lädt sie offline aus dem Cache).
2. **Route.** URL-Hash → `tool`-Ansicht, mit extrahierten `qr-code`- und URL-Parametern.
3. **Laden.** `loadTool('qr-code', fetchFile)` ruft `tool.json` ab, validiert gegen das JSON Schema, ruft `template.html`, `styles.css` und den `hooks.js`-Quellcode ab.
4. **URL-Zustand parsen.** `parseUrlState` übersetzt URL-Parameter in initiale Eingabewerte. Asset-Referenzen (`?logo=suse/logo/primary`) werden als leichtgewichtige `{ id, _unresolved: true }`-Objekte geparst.
5. **Laufzeit.** `createRuntime(tool, host, initialValues)` baut das Eingabemodell auf (führt Profildaten, Standardwerte und Initialwerte zusammen), löst Asset-Referenzen über `host.assets.get()` auf, lädt Hooks (mit `host` im Closure-Scope, nicht sandboxed), ruft `hooks.onInit` auf.
6. **Rendern.** Die Shell abonniert die Laufzeit; bei jeder Zustandsänderung erhält sie `{ model, hydrated }`. Sie rendert Eingabesteuerelemente aus dem Modell und schreibt das hydrierte Template-HTML in `#tool-canvas`.
7. **Interagieren.** Der Nutzer tippt in eine Eingabe → `runtime.setInput(id, value)` → Beschränkungen angewendet → `hooks.onInput` aufgerufen → erneut hydrieren → erneut rendern. Die Canvas aktualisiert sich live.
8. **Export.** Der Nutzer klickt auf Download (PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rastert über dom-to-image-more; SVG/PDF durchlaufen dedizierte DOM-durchlaufende Vektorisierer) → Blob → `host.export.download`. Der Formatumfang, für den sich ein Tool entscheiden kann, ist breit, und das `render.formats`-Enum in `schemas/tool.schema.json` ist die Autorität dafür - Raster und Fließkomma-Raster, Vektoren und Schneidedateien, Druck/CMYK, Bewegtbild, editierbare Dokumente (`pptx`, `docx`, `odt`), Palette sowie Daten-/Textausgaben, Audio- und Schriftdateien. [URL-Modus](/info/url-mode.html) benennt jede ID und was sie erzeugt. Audio steht in diesem Enum wie alles andere (`wav`, `mp3`, `m4a`, `opus`, deklariert vom Audiogramm und den Aufnahme-Tools); getrennt davon steuert der `render.capture`-Modus eines Aufnahme-Tools `host.recorder`, dessen Aufnahme als fertiger Blob in dem Container ankommt, in dem der Browser aufgezeichnet hat. (Tools, die `render.export: false` setzen - z. B. Color Palette, Countdown Timer, Strip Hidden Data, Text Helper, Compress PDF - blenden die Steuerelemente für Download/Format/Abmessung aus.) Physikalische Einheiten werden hier pro Format umgerechnet (PDF → echte Seitenpunkte, Raster → Pixel bei DPI mit einem `pHYs`-Chunk). Autorschafts-/Provenienz-Metadaten (Autor, Tool, Quelle - erzeugt von `engine/src/metadata.ts`) werden pro Format eingebettet: PNG iTXt, JPEG EXIF, PDF-Info-Dict, SVG `<metadata>`, GIF-Kommentar. Experimentelle Tools erhalten ein vom Host eingefügtes Wasserzeichen, nicht vom Tool.

![Das Export-Panel, das `?options` öffnet: das Paar aus Dateiname und Format, die Ausgabegröße und die Steuerelemente, die die Datei schreiben](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Derselbe Lebenszyklus in Tauri. Derselbe Lebenszyklus in der CLI - jsdom stellt das Headless-DOM bereit; die Ausgabe geht in eine Datei oder nach stdout.

---

## Open-Source-Status

**Code steht unter MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` und `docs/` sind Open Source unter **MPL-2.0** - eine anbieterneutrale Scaffolding-Plattform für Markentooling, wobei jede eigenständig auslieferbare Einheit in ihrem eigenen Repository unter [github.com/lolly-tools](https://github.com/lolly-tools) liegt.

**Tool-Inhalte werden als Brand-Packs ausgeliefert**, jeder mit eigenen Bedingungen (siehe die `NOTICE.md` des jeweiligen Packs). `community/` ist das öffentliche Repository [`lolly-tools`](https://github.com/lolly-tools/lolly-tools), und auch seine markenneutralen Tools stehen unter MPL-2.0. `brands/suse/` ist das private Pack `suse-lolly`: die SUSE-Tools und der SUSE-Katalog, **proprietär für SUSE**, einschließlich seiner lizenzierten PremiumBeat-Musik. `brands/lolly-start/` ist die leere Starter-Marke, die dieses Repository besitzt. Schriften werden innerhalb eines Packs unter der **SIL Open Font License 1.1** ausgeliefert - das SUSE-Pack trägt die Schriftfamilien SUSE und SUSE Mono.

Die `tools/`- und `catalog/`-Verzeichnisse im Repo-Root sind von Git ignorierte *Ansichten*: Ein Profil setzt sie aus `community/` plus dem aktiven Brand-Pack zusammen, weshalb jedes Skript und jede Shell diese beiden Pfade liest und niemals ein Pack direkt.

Die Trennung wird erzwungen - es gibt keine Cross-Imports von `engine/` in Tool-Inhalte -, sodass die Grenze zwischen Plattform und Inhalt sauber bleibt.

---

## Wo die Engine endet und der Host beginnt

Wenn es sich in reinen Daten + Handlebars beschreiben lässt → **Engine**.
Wenn es das DOM, das Dateisystem, das Netzwerk oder eine beliebige Browser-/Betriebssystem-API berührt → **Host**.

Die Grenze ist bewusst scharf gezogen. Die Engine ist der Open-Source-Teil. Alles, was etwas über SUSE, bestimmte Plattformen oder Laufzeitumgebungen weiß, bleibt außen vor.

Für die nächste Detailebene zählt [`engine/README.md`](../engine/README.md) jedes Engine-Modul auf und beschreibt, wofür es zuständig ist, und [Bedrohungsmodell & Vertrauensgrenzen](/info/threat-model.html) hält fest, wo dieselbe Grenze zugleich als Vertrauensgrenze dient.
