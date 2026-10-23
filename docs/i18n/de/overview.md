# Lolly-Architektur

![Lolly-Icon - großer grün-weißer Lolli](/info/icon.svg)

Diese Seite richtet sich an Menschen, die den Code von Lolly ändern: wie Engine, Shells und Tool-Pakete zusammenpassen, wo jedes im Repository liegt und welche Verpflichtungen jede Änderung einschränken. Wenn Sie wissen wollen, was Lolly tut und wer es nutzt, lesen Sie zuerst [Wie Lolly funktioniert](/info/how-lolly-works.html).

Zwei Begleiter gehen tiefer. [`engine/README.md`](../engine/README.md) ist die Modul-für-Modul-Karte der Engine, aus dem Code erzeugt. [Bedrohungsmodell und Vertrauensgrenzen](/info/threat-model.html) liest dieselbe Architektur als Vertrauensgrenzen und ist die Seite für jede Frage dazu, was die Engine als nicht vertrauenswürdig behandelt.

## Das große Bild

Tools sind Daten ganz oben. Die Engine in der Mitte weiß nichts von irgendeiner Plattform. Die Shells unten setzen einen Vertrag um, und die Kataloge liefern den Inhalt.

![Tools liefern ein Manifest, eine Vorlage und Hooks an die gemeinsame Engine. Web-, Tauri- und Terminal-Shells setzen die HostV1-Capability-Bridge um und lesen Tools und Assets aus Katalogen.](/info/diagrams/concepts/platform-layers.svg)

Wenn Sie es in reinen Daten und Handlebars beschreiben können, gehört es in die **Engine**. Wenn es das DOM, das Dateisystem, das Netzwerk oder irgendeine Browser- oder Betriebssystem-API berührt, gehört es in den **Host**, die Seite der Shell an der Bridge. Die Engine ist Open Source, und nichts, was eine bestimmte Marke oder Plattform kennt, kommt in die Engine.

## Repository-Aufbau

Lolly ist ein Repository. Jedes Verzeichnis unten ist darin ein einfaches Verzeichnis, außer `brands/suse`, einem **privaten** Git-Submodul mit dem SUSE-Tool-Paket und -Katalog, das ein öffentlicher Clone nicht holt. Welche Pakete ein Build liest, bestimmt ein Content-Profil (`profiles.json`), pro Prozess aufgelöst statt global umgeschaltet. Der [Build-Leitfaden](/info/build-guide.html) hat den Clone-Befehl und erklärt, wie eine Änderung im privaten Paket committet wird.

| Verzeichnis | Was es enthält |
|---|---|
| `engine/` | Der plattformunabhängige Kern: Loader, Laufzeit, Eingaben, Vorlagen, URL-Modus, Einheiten und die Formatmodule |
| `shells/` | Die Web-App, die Tauri-Desktop- und Mobil-Apps, die CLI, die TUI und die Browser-Erweiterung |
| `packages/` | Das SDK für Tool-Autoren (`@lolly-tools/core`), die gemeinsamen Node-Shell-Teile und der Docs-Renderer, unter anderem |
| `community/` | Die markenunabhängigen Tools, plus die gemeinsamen Emoji-Pakete |
| `brands/` | Marken-Pakete: `lolly-demo` (Lolly Demo, das Designsystem, das lolly.tools betreibt), `lolly-start` (der leere Start) und das private `suse` |
| `services/` | Die optionalen MCP-, Zertifikats- und Penpot-Dienste und der Servercode, den sie teilen |
| `schemas/` | JSON-Schema für Tool-Manifeste, Asset-Einträge und Asset-Referenzen |
| `scripts/`, `tests/`, `docs/`, `api/` | Build- und Katalog-Skripte, die Engine-Testsuite, diese Dokumente und die erzeugten Serverless-Bundles |

::: details Die Engine- und Shell-Dateien, denen Sie zuerst begegnen
```
engine/src/
  index.ts          public surface: loader, runtime, template, inputs, url-mode
  loader.ts         fetches and validates tool files
  runtime.ts        orchestrates one mounted tool, from load to export
  template.ts       Handlebars hydration and annotateTemplate
  inputs.ts         manifest to runtime input model
  url-mode.ts       URL to input state and back
  validate.ts       JSON Schema validation of manifests
  compose.ts        nested tool renders (composes)
  embed.ts          portable lolly.tools embed URLs
  bridge/host-v1.ts type re-export of the @lolly-tools/core contract

shells/web/src/
  main.ts           boot and routing
  bridge/           the web implementations of the host APIs
  catalog/sync.ts   boot-time catalog sync and offline cache
  views/            the gallery, tool, projects, free canvas and the other views
  pro/              Batch (#/batch)

shells/cli/         bin/lolly.ts (entry), src/run.ts (headless render), src/bridge.ts
shells/tui/         src/main.tsx (the full-screen app), src/bridge.ts
```
:::

Es gibt kein `tools/`- oder `catalog/`-Verzeichnis auf Repository-Ebene. `packages/node-shell/src/content-roots.ts` beantwortet "wo liegt Tool `<id>`" und "wo liegt der Katalog" auf Anfrage aus `profiles.json`. Ein echtes Paar `tools/` und `catalog/` wird nur in eine Build-Ausgabe geschrieben, etwa `dist/`, eine RPM-Nutzlast oder ein Container-Image, weil ein Browser diese beiden Pfade über HTTP abruft.

## Wo Lolly läuft

Jede Oberfläche nutzt dieselbe Engine und dieselben Tool-Dateien.

- **Die Web-App.** Eine Progressive Web App, die offline funktioniert, sobald ihr Service Worker die Tools und Assets zwischengespeichert hat. Sie braucht kein Konto; der Zustand liegt in IndexedDB auf jedem Gerät. Ein responsives Layout bedient Desktop und Smartphone: Auf einem Smartphone werden die Steuerelemente zu einem Blatt, und die Export-Steuerung öffnet sich aus einer schwebenden Pille.
- **Die Desktop- und Mobil-Apps.** Tauri-Pakete derselben Web-App, mit nativen Dateidialogen, Dateisystem-Zustand und voller Offline-Nutzung.
- **Die CLI.** `lolly <tool-id> --input=value --output=file.png` lädt dieselbe Engine in einem Headless-DOM und schreibt die Datei. Das ist der URL-Modus über einen anderen Transport, keine getrennte Implementierung. Siehe [CLI](/info/cli.html).
- **Die TUI.** Eine Vollbild-Terminal-App, Tastatur zuerst, die die Bridge der CLI wiederverwendet, gespeicherte Sitzungen auf der Festplatte hält (im eigenen Ordner der Desktop-App, wenn die App installiert ist, sonst unter `~/.lolly`) und nur dann einen begrenzten Headless-Browser startet, wenn ein Format einen braucht. Siehe [TUI](/info/tui.html).

![Die geteilte Desktop-Ansicht: links die aus dem Manifest erzeugten Steuerelemente, rechts die Live-Arbeitsfläche](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Dasselbe Tool in Smartphone-Breite braucht kein zweites Layout: Die Steuerelemente werden zu einem Blatt oben, und die Vorschau hält den Bildschirm.

![Ein Audiogramm auf einem 430 px breiten Bildschirm: oben das Blatt mit den Steuerelementen, darunter die fertige quadratische Grafik und die schwebende Export-Pille](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Die Web-App liefert auch **Batch** (`#/batch`, `shells/web/src/pro/`), ein tabellenartiges Raster, das viele Zeilen auf einmal über ein oder viele Tools rendert; [Batch und Multi-edit](/info/batch.html#make-many-versions-of-one-design) behandelt Batch. **Settings → Capabilities** bildet alles ab, was die Plattform zu können erklärt.

![Batch bei einer frischen Installation: eine leere Zeile, die auf ein Tool wartet, mit der Tabellenoberfläche und ihrer Schaltfläche Render an Ort und Stelle, bevor Daten eintreffen](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

## Architektonische Festlegungen

Diese Entscheidungen stehen fest. Jede davon zu ändern ist ein großes Unterfangen, weil sie jede andere Entscheidung in der Codebasis prägen.

### 1. Deklarative Tools mit imperativer Notlösung

Ein Tool ist ein Manifest (`tool.json`), eine Vorlage (`template.html`) und optional `hooks.js`. **Das Manifest deklariert die Eingaben**, nie die Vorlage: Eingaben werden nicht aus Handlebars-Tokens abgeleitet. Die meisten Tools bestehen nur aus Manifest und Vorlage, und genau das lässt Nicht-Entwickler sie verfassen.

![Der Steuerelement-Stapel von Street Map: ein Städte-Dropdown, eine Design-Auswahl, Gewichts-Schieberegler und Farbauslöser, jedes aus einer Manifestzeile gezeichnet](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Tools, die Werte berechnen, etwa QR-Kodierung oder Diagrammaufbereitung, ergänzen Hooks: benannte Lebenszyklusfunktionen, die die Laufzeit mit eingespeister Capability-Bridge aufruft. Hooks sind ein Portabilitätsvertrag, keine Sicherheits-Sandbox, und sie laufen innerhalb eines Zeitbudgets. Tools, deren Hooks nachweislich frei von Seiten-Globals sind, tragen `isolate: true` und laufen in einem Worker. [Tool-Hooks](/info/tool-hooks.html) hat den Lebenszyklus und die Budgets, und das [Bedrohungsmodell](/info/threat-model.html) sagt, was der Executor in der Seite eindämmt und was nicht.

### 2. Tools und Assets sind Daten, kein gebündelter Code

Die Web- und Tauri-Apps holen die Tool- und Asset-Kataloge beim Start, speichern sie zwischen und arbeiten mit dem, was da ist, sodass ein neues Tool oder Asset kein App-Release braucht. Asset-Bytes haben SHA-256-Prüfsummen, und `id` und `version` eines Assets steuern die Cache-Invalidierung.

### 3. Die Capability-Bridge ist die einzige API, die Tools sehen

Tools berühren das DOM außerhalb ihrer Vorlage nie, rufen `fetch` nie direkt auf und lesen nie das Dateisystem. Sie rufen versionierte `host.*`-Methoden auf. Die kanonische Definition des Vertrags ist `packages/core/src/host-v1.ts`, das SDK für Tool-Autoren `@lolly-tools/core`, sodass Dritte dagegen bauen können, ohne von der Engine abzuhängen; `engine/src/bridge/host-v1.ts` exportiert seine Typen erneut.

| Erforderliche API | Was sie tut |
|---|---|
| `host.profile` | Die Angaben der Nutzerin oder des Nutzers; füllt Eingaben über `bindToProfile` vor |
| `host.assets` | Katalogabfragen, Asset-Auflösung und die Auswahl des Hosts |
| `host.state` | Eingabe-Slots speichern und laden: IndexedDB im Web, das Dateisystem in Tauri, Arbeitsspeicher in der CLI |
| `host.clipboard` | Text oder ein Bild in die Zwischenablage schreiben, mit Plattform-Fallbacks |
| `host.export` | Das Renderziel rastern oder serialisieren, und der Pfad für die Dateiumwandlung auf dem Gerät |
| `host.log` | Protokollierung nach Stufen an den Host |

Jede andere API ist optional und additiv: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` und viele mehr. Das Manifest eines Tools listet unter `requires` die optionalen APIs auf, die seine Hooks ohne vorherige Prüfung aufrufen, und ein Host, dem eine fehlt, weigert sich, das Tool zu laden; die übrigen erkennen Hooks per Feature-Detection. Einige, etwa `recorder`, brauchen zusätzlich eine Gerätefähigkeit, die das Tool deklariert. `packages/core/src/host-v1/apis.ts` listet alle auf, und [Host-API](/info/host-api.html) dokumentiert jede einzelne. Das Hinzufügen einer Methode ist eine Minor-Version; das Entfernen oder Ändern einer ist eine Major-Version, und v1 funktioniert weiter, wenn v2 erscheint.

### 4. Asset-IDs gelten für immer

`lolly/logo/primary` ist ein Vertrag. Einmal veröffentlicht, ändert sich eine ID nie und wird nie wiederverwendet. Eine Byte-Änderung erhöht `version` im Asset-Eintrag, und ein Ersatz setzt `deprecated: true` und optional `replacedBy`, sodass bestehende Verweise immer aufgelöst werden. Das hält gespeicherte Sitzungen und geteilte Links über Jahre funktionsfähig.

### 5. Der URL-Modus ist erstrangig

Jede Eingabe lässt sich als URL-Parameter ausdrücken, sodass ein Link eine fertige Datei ist:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Dieser Link für sich allein, ohne etwas anderes darin, ist die fertige Datei](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Ändern Sie einen Parameter, und Sie haben eine andere Datei. Diese ganze Palette ist eine Grundfarbe, eine Harmonie und eine Schrittzahl:

![Neun Stufen über vier Farbtöne, alle aus der einzelnen Startfarbe im Link erzeugt](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

Die CLI baut aus ihren Argumenten denselben URL-Zustand und führt dieselbe Pipeline aus, sodass die CLI nicht von der App abdriften kann. `engine/src/url-mode.ts` parst und serialisiert; eine Reihe reservierter Namen (`format`, `width`, `dpi`, `c2pa`, `z` und andere) wird nie an ein Tool übergeben, und [Reservierte URL-Parameter](/info/url-parameters.html) listet sie alle auf. Asset-Eingaben reisen über `id` und werden über `host.assets.get()` aufgelöst, bevor die Vorlage gefüllt wird.

### 6. Speicherung läuft über die Bridge

Die Web-App nutzt IndexedDB, Tauri das Dateisystem und die CLI den Arbeitsspeicher. Tools sehen nur `host.state.save(slot, data)` und `host.state.load(slot)`, nie `localStorage`. Menschen können pro Tool mehrere benannte Sitzungen ohne Konto behalten. Weil die Bridge die einzige Nahtstelle ist, ist dieser Zustand auch portabel: `shells/web/src/data-transfer.ts` liest ihn wieder in eine `lolly-backup`-Datei aus, die sich auf jeder anderen Installation importieren lässt ([Datenübertragung](/info/data-transfer.html)), und [Sync](/info/sync.html) sendet dasselbe Bundle in einen Speicher, den die Person wählt.

### 7. Reifegrad-Tags sagen, was ein Tool ist

Jedes Tool deklariert `status: official | community | experimental`. Die Galerie sortiert nach Status, und experimentelle Tools versehen ihre Exporte standardmäßig mit einem Wasserzeichen: Die Laufzeit schaltet das Wasserzeichen ein, sofern der Aufrufer nicht `watermark: false` übergibt, und Tools auf dem Gerät sind ausgenommen. Welchen Prozess ein Team auch um den Katalog legt, er sitzt auf diesem auf.

### 8. Eingaben sind im Manifest typisiert

Eine Eingabe deklariert einen `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` oder `file`. Der Host rendert je Typ ein Steuerelement, sodass Tools keinen Steuerelement-Code schreiben, und jede Eingabe kann `bindToProfile` tragen. Drei haben das meiste Gewicht:

- **`asset`**, mit `filter` und `allowUpload`, ist die Brücke zum Asset-System. `allowUpload: false` beschränkt einen Slot auf Bibliotheks-Assets, und Uploads von Nutzern teilen die `AssetRef`-Form der Bibliothek.
- **`blocks`** ist eine wiederholte Feldgruppe, in einem Seitenpanel bearbeitet, genutzt von Meeting Planner, Wayfinding, Diagrams und anderen. Ein Klick auf einen gerenderten Block fokussiert seine Zeile.
- **`file`** hält die eigene Datei der Nutzerin oder des Nutzers im Arbeitsspeicher für Utilities auf dem Gerät wie Strip Hidden Data und Compress, und **`vector`** fasst eine feste Menge von Zahlen zu einem Steuerelement zusammen.

### 9. Vorlagen sind logikfrei

Vorlagen sind Handlebars, gewählt, damit Nicht-Entwickler sie schreiben können: `{{x}}` maskiert, und `{{{x}}}` ist ein ausdrückliches Opt-in. Logik lebt in `hooks.js`, wo sie explizit und prüfbar ist. Viele Vorlagen nutzen `{{{` für Markup, das ein Hook berechnet hat, sodass jeder Hook maskieren muss, was er übergibt. Die Helfer sind `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` und `media`, dazu `icsStamp`, `rfcText`, `csvCell` und `arrow` für verwandte `.ics`-, `.vcf`- und `.csv`-Vorlagen. [Vorlagen und Rendering](/info/tool-rendering.html) behandelt sie.

### 10. Tools setzen sich aus Tools zusammen

Ein Tool kann das Rendering eines anderen Tools einbetten, ohne Importe von Tool zu Tool; die Engine löst die Komposition auf. Ein Manifest kann `composes: [{ id, tool, inputs }]` deklarieren und das Kind mit `{{asset <id>}}` platzieren, und eine portable Einbett-URL (`https://lolly.tools/tool/<id>.svg?…`) rendert das Kind lokal, womit Design einen Live-QR-Code oder ein Diagramm platziert. Ein SVG-Kind bleibt in einem SVG- oder PDF-Elternteil ein Vektor. Kinder sind Zwischenergebnisse, nie mit Wasserzeichen oder Stempel versehen, und eine Shell, die keines rendern kann, lässt den Slot leer, während der Elternteil weiter rendert. [Komposition und Marken-Overlays](/info/tool-composition.html) hat die Einzelheiten.

## Was wir bewusst nicht tun

- **Kein beliebiges JavaScript in Vorlagen.** Logik lebt in `hooks.js`.
- **Kein verpflichtender Asset-Server.** Menschen fügen in der App ihre eigenen Dateien zu Assets hinzu und geben Arbeit als Sitzung weiter: ein Share-Link für Eingaben und Einstellungen, eine `.lolly`-Datei, wenn auch Uploads mitreisen. Eine geteilte Sitzung kann zu einer Vorlage in der Auswahl eines Tools werden. Eine Organisation, die einen gesteuerten Katalog will, kann den Katalog, die Freigaben und die Richtlinien von Lolly Work nutzen oder das Marken-Paket in Git verwalten und Änderungen dort prüfen.
- **Keine erzwungene Zugriffskontrolle.** Die offene App ist standardmäßig öffentlich, und Reife-Kennzeichnungen und Wasserzeichen tragen das Markenrisiko. Anmeldung bei der Organisation, Rollen und Richtlinien kommen von Lolly Work, wenn ein Team sie will.
- **Keine zentrale Datenbank.** Der Nutzerzustand lebt auf jedem Gerät, und optionales Sync kopiert ihn in einen Speicher, den die Person wählt, nie in eine Lolly-Datenbank.
- **Kein gemeinsamer Codepfad zwischen Tools und Engine.** Die Engine und die Community-Tools sind Open Source, und ein Marken-Paket wie das private `brands/suse/` bringt seine eigenen Tools und seinen Katalog unter eigenen Bedingungen mit. Kein Tool importiert aus `engine/`, sodass die Trennung sauber bleibt.

## Der Lebenszyklus eines Renders

Jemand öffnet `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Start.** Die Web-App öffnet IndexedDB, baut die Capability-Bridge und synchronisiert die Tool- und Asset-Kataloge oder lädt sie offline aus dem Cache.
2. **Route.** Der Pfad wählt die Tool-Ansicht für `qr-code`, mit der Query als Anfangswerten.
3. **Laden.** `loadTool` holt `tool.json`, validiert es gegen das Schema und holt die Vorlage, die Stile und die Hooks.
4. **Den Link parsen.** `parseUrlState` macht aus den Parametern Eingabewerte. Ein Asset-Verweis wie `?logo=lolly/logo/primary` wird zu einem unaufgelösten `{ id }`.
5. **Die Laufzeit starten.** `createRuntime(tool, host, initialValues)` baut das Eingabemodell aus Profildaten, Standardwerten und dem Link, löst Asset-Verweise auf, lädt die Hooks und ruft `onInit` auf.
6. **Rendern.** Die Shell abonniert die Laufzeit, zeichnet die Steuerelemente aus dem Modell und schreibt die gefüllte Vorlage in `#tool-canvas`.
7. **Interagieren.** Tippen ruft `runtime.setInput` auf, das Einschränkungen anwendet, `onInput` aufruft, die Vorlage erneut füllt und neu zeichnet.
8. **Exportieren.** **Download** ruft `runtime.export(node, format)` auf, und das `host.export` der Shell erzeugt die Datei: ein Raster, einen Vektor aus dem DOM-Walker, ein PDF, ein Dokument oder eines der anderen Formate in `schemas/tool.schema.json`. Physische Einheiten werden pro Format umgerechnet, und Metadaten und Content Credentials werden eingebettet, wo das Format sie halten kann. Experimentelle Tools erhalten ihr Wasserzeichen vom Host, nicht vom Tool. [Vorlagen und Rendering](/info/tool-rendering.html) und [Eine Datei exportieren](/info/exporting.html) behandeln den Exportschritt.

![Das Export-Panel, das ?options öffnet: das Paar aus Dateiname und Format, die Ausgabegröße und die Steuerelemente, die die Datei schreiben](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Derselbe Lebenszyklus läuft in Tauri und in der CLI mit einem Headless-DOM, wo die Ausgabe in eine Datei oder nach stdout geht.

## Lizenzen

Code, einschließlich `engine/`, `shells/`, `services/`, `schemas/` und des Dokumentationsgenerators, steht unter MPL-2.0, in einem öffentlichen Repository, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Die Dokumentationstexte stehen unter CC BY-SA 4.0. Marken-Pakete tragen ihre eigenen Bedingungen in der `NOTICE.md` jedes Pakets: Die Community-Tools stehen unter MPL-2.0, und das private SUSE-Paket ist proprietär für SUSE. [Über Lolly](/info/about.html) enthält den vollständigen Lizenzhinweis.
