# Lolly-Architektur

![Lolly-Symbol - großer grün-weißer Lutscher](/info/icon.svg)

Diese Seite richtet sich an Menschen, die Lollys Code ändern: wie die Engine, die Shells und die Tool-Pakete zusammenpassen, wo sie im Repository liegen und welche verbindlichen Vorgaben jede Änderung begrenzen. Um zu erfahren, was Lolly macht und wer Lolly nutzt, lesen Sie zuerst [Wie Lolly funktioniert](/info/how-lolly-works.html).

[`engine/README.md`](https://github.com/lolly-tools/lolly/blob/main/engine/README.md) beschreibt die Engine Modul für Modul und wird aus dem Code erzeugt. [Bedrohungsmodell & Vertrauensgrenzen](/info/threat-model.html) betrachtet dieselbe Architektur anhand ihrer Vertrauensgrenzen und beschreibt, was die Engine als nicht vertrauenswürdig behandelt.

<!--i:eti-layers-->
## Der Überblick

Oben stehen Tools als Daten. Die Engine in der Mitte kennt keine Plattform. Die Shells darunter implementieren einen gemeinsamen Vertrag, und die Kataloge liefern die Inhalte.

![Tools liefern ein Manifest, eine Vorlage und Hooks an die gemeinsame Engine. Web-, Tauri- und Terminal-Shells implementieren die HostV1-Capability-Bridge und lesen Tools und Assets aus Katalogen.](/info/diagrams/concepts/platform-layers.svg)

Alles, was Sie mit reinen Daten und Handlebars beschreiben können, gehört in die **Engine**. Alles, was auf das DOM, das Dateisystem, das Netzwerk oder eine Browser- oder Betriebssystem-API zugreift, gehört in den **Host**, die Shell-Seite der Bridge. Die Engine ist Open Source. Nichts, was eine bestimmte Marke kennt, gehört in die Engine.

<!--i:eti-folder-shared-->
## Aufbau des Repositorys

Lolly besteht aus einem Repository. Jedes der folgenden Verzeichnisse ist ein gewöhnliches Verzeichnis, außer `brands/suse`: ein **privates** git-Submodul mit dem SUSE-Tool-Paket und -Katalog, das ein öffentlicher Klon nicht mitlädt. Ein Inhaltsprofil (`profiles.json`) legt fest, welche Pakete ein Build liest. Jeder Prozess ermittelt sein eigenes Profil, und es gibt keinen globalen Schalter. Die [Build-Anleitung](/info/build-guide.html) enthält den Befehl zum Klonen und erklärt, wie Sie eine Änderung im privaten Paket committen.

| Verzeichnis | Inhalt |
|---|---|
| `engine/` | Der plattformunabhängige Kern: Loader, Laufzeit, Eingaben, Vorlagen, URL-Modus, Einheiten und Formatmodule |
| `shells/` | Die Web-App, die Tauri-Apps für Desktop und Mobilgeräte, die CLI, die TUI und die Browser-Erweiterung |
| `packages/` | Unter anderem das SDK für Tool-Autoren (`@lolly-tools/core`), die gemeinsamen Bestandteile der Node-Shell und der Dokumentationsrenderer |
| `community/` | Die markenunabhängigen Tools und die gemeinsamen Emoji-Pakete |
| `brands/` | Markenpakete: `lolly-demo` (Lolly Demo, das Designsystem von lolly.tools), `lolly-start` (die leere Ausgangsbasis) und das private `suse` |
| `services/` | Die optionalen MCP-, Zertifikats- und Penpot-Dienste und ihr gemeinsamer Servercode |
| `schemas/` | JSON Schema für Tool-Manifeste, Asset-Einträge und Asset-Referenzen |
| `scripts/`, `tests/`, `docs/`, `api/` | Build- und Katalogskripte, die Testsuite der Engine, diese Dokumentation und die erzeugten Serverless-Bundles |

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

::: note Im Stammverzeichnis des Repositorys gibt es weder `tools/` noch `catalog/`
`packages/node-shell/src/content-roots.ts` beantwortet anhand von `profiles.json`, „wo liegt das Tool `<id>`“ und „wo ist der Katalog“. Ein tatsächliches Paar aus `tools/` und `catalog/` wird nur in eine Build-Ausgabe geschrieben, etwa `dist/`, den Inhalt eines RPM-Pakets oder ein Container-Image, weil ein Browser diese beiden Pfade über HTTP abruft.
:::

<!--i:eti-monitor-->
## Wo Lolly läuft

Jede Oberfläche nutzt dieselbe Engine und dieselben Tool-Dateien.

- **Die Web-App.** Eine Progressive Web App. Sie funktioniert offline, sobald ihr Service Worker die Tools und Assets zwischengespeichert hat. Sie braucht kein Konto, und der Zustand liegt auf jedem Gerät in IndexedDB. Ein responsives Layout bedient Desktop und Smartphone. Auf einem Smartphone werden die Steuerelemente zu einem Panel, und die Export-Steuerelemente öffnen sich über eine schwebende Pille.
- **Die Apps für Desktop und Mobilgeräte.** Tauri-Pakete derselben Web-App mit nativen Dateidialogen, Zustand im Dateisystem und vollständiger Offline-Nutzung.
- **Die CLI.** `lolly <tool-id> --input=value --output=file.png` lädt dieselbe Engine in einem Headless-DOM und schreibt die Datei. Es ist der URL-Modus über einen anderen Transportweg. Siehe [CLI](/info/cli.html).
- **Die TUI.** Eine Terminal-App im Vollbild, die vor allem für die Tastatur gedacht ist. Sie verwendet die Bridge der CLI und speichert Sitzungen auf dem Datenträger: im Ordner der Desktop-App, wenn diese installiert ist, sonst unter `~/.lolly`. Sie startet nur dann einen auf die Aufgabe begrenzten Headless-Browser, wenn ein Format ihn benötigt. Siehe [TUI](/info/tui.html).

![Die geteilte Ansicht auf dem Desktop: links die aus dem Manifest erzeugten Steuerelemente, rechts die Live-Arbeitsfläche](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&filename=aud-web-split)

Bei Smartphone-Breite liegt das Panel mit den Steuerelementen oben, und die Vorschau füllt den Bildschirm.

![Ein Audiogramm auf einem 430px breiten Bildschirm: oben das Panel mit den Steuerelementen, darunter die fertige quadratische Grafik und die schwebende Export-Pille](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%3A7%3Alofi%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

Die Web-App enthält außerdem **Batch** (`#/batch`, `shells/web/src/pro/`), ein Raster wie in einer Tabellenkalkulation, das viele Zeilen gleichzeitig mit einem oder mehreren Tools rendert. Siehe [Batch und Lolly Multi-edit](/info/batch.html#make-many-versions-of-one-design). **Settings → Capabilities** listet alles auf, was die Plattform nach eigener Angabe kann.

![Batch nach einer Neuinstallation: eine leere Zeile wartet auf ein Tool, während die Tabellenoberfläche und ihre Schaltfläche Render schon vor den ersten Daten bereitstehen](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

<!--i:eti-lock-->
## Verbindliche Architekturentscheidungen

Diese Entscheidungen stehen fest. Alle anderen Entscheidungen im Code bauen darauf auf, daher ist die Änderung einer solchen Entscheidung ein großes Vorhaben.

### 1. Deklarative Tools mit einer imperativen Ausweichmöglichkeit

Ein Tool besteht aus einem Manifest (`tool.json`), einer Vorlage (`template.html`) und optional `hooks.js`. **Das Manifest deklariert die Eingaben**. Eingaben werden nie aus den Handlebars-Tokens der Vorlage abgeleitet. Die meisten Tools bestehen nur aus einem Manifest und einer Vorlage, sodass auch Menschen ohne Programmierkenntnisse sie erstellen können.

![Die Steuerelemente von Street Map: ein Dropdown für die Stadt, eine Designauswahl, Schieberegler für Strichstärken und Farbschaltflächen, jedes aus einer Zeile des Manifests erzeugt](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

Tools, die Werte berechnen, etwa zur QR-Codierung oder zur Gestaltung von Diagrammen, ergänzen Hooks: benannte Lebenszyklusfunktionen, denen die Laufzeit beim Aufruf die Capability-Bridge übergibt. Hooks sind ein Vertrag für Portabilität, keine Sicherheits-Sandbox. Sie laufen innerhalb eines Zeitbudgets. Tools, deren Hooks nachweislich keine globalen Objekte der Seite verwenden, tragen `isolate: true` und laufen in einem Worker. [Tool-Hooks](/info/tool-hooks.html) beschreibt den Lebenszyklus und die Budgets. Das [Bedrohungsmodell](/info/threat-model.html) erläutert, was der Executor innerhalb der Seite eingrenzt und was nicht.

### 2. Tools und Assets sind Daten, kein gebündelter Code

Die Web- und Tauri-Apps rufen beim Start die Tool- und Asset-Kataloge ab, speichern sie zwischen und arbeiten mit den zwischengespeicherten Daten. Ein neues Tool oder Asset braucht keine neue App-Version. Asset-Bytes werden mit SHA-256-Prüfsummen geprüft. `id` und `version` eines Assets bestimmen, wann der Cache ungültig wird.

### 3. Die Capability-Bridge ist die einzige API, die Tools sehen

Tools greifen nie auf das DOM außerhalb ihrer Vorlage zu, rufen nie direkt `fetch` auf und lesen nie das Dateisystem. Sie rufen versionierte `host.*`-Methoden auf. Der Vertrag ist in `packages/core/src/host-v1.ts` definiert, im SDK für Tool-Autoren `@lolly-tools/core`. Dritte können auf Basis des SDK entwickeln, ohne von der Engine abhängig zu sein. `engine/src/bridge/host-v1.ts` exportiert dessen Typen erneut.

| Erforderliche API | Funktion |
|---|---|
| `host.profile` | Die Angaben der nutzenden Person; füllt Eingaben über `bindToProfile` vorab aus |
| `host.assets` | Katalogabfragen, Auflösung von Assets und die Auswahl des Hosts |
| `host.state` | Eingabe-Slots speichern und laden: IndexedDB im Web, das Dateisystem in Tauri, Arbeitsspeicher in der CLI |
| `host.clipboard` | Text oder ein Bild in die Zwischenablage schreiben, mit Ausweichmöglichkeiten je nach Plattform |
| `host.export` | Das Render-Ziel rastern oder serialisieren sowie der Pfad zur Dateiumwandlung auf dem Gerät |
| `host.log` | Protokollierung mit Schweregraden an den Host |

Alle weiteren APIs sind optional und ergänzend: `tokens`, `text`, `color`, `geom`, `pdf`, `compose`, `media`, `recorder` und viele mehr. `requires` im Manifest listet die optionalen APIs auf, die seine Hooks ohne vorherige Prüfung aufrufen. Ein Host, dem eine davon fehlt, lehnt das Einbinden des Tools ab. Bei den übrigen prüfen die Hooks die Verfügbarkeit. Einige, etwa `recorder`, benötigen außerdem eine Gerätefunktion, die das Tool deklariert. `packages/core/src/host-v1/apis.ts` listet alle auf, und [Host-API](/info/host-api.html) dokumentiert jede einzelne. Das Hinzufügen einer Methode ergibt eine Minor-Version. Das Entfernen oder Ändern einer Methode ergibt eine Major-Version, und v1 funktioniert weiter, wenn v2 erscheint.

### 4. Asset-IDs gelten für immer

`lolly/logo/primary` ist ein Vertrag. Nach der Veröffentlichung wird eine ID nie geändert oder erneut vergeben. Eine Änderung der Bytes erhöht `version` im Asset-Eintrag. Bei einer Ersetzung werden `deprecated: true` und optional `replacedBy` gesetzt. Bestehende Referenzen lassen sich immer auflösen, sodass gespeicherte Sitzungen und geteilte Links über Jahre funktionieren.

### 5. Der URL-Modus ist ein vollwertiger Zugangsweg

Jede Eingabe lässt sich als URL-Parameter ausdrücken, daher ist ein Link eine fertige Datei:

```
https://lolly.tools/t/qr-code?url=https://example.com&ecl=H
```

![Dieser Link allein, ohne weitere Inhalte, ist die fertige Datei](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

Ändern Sie einen Parameter, und Sie erhalten eine andere Datei. Diese Palette besteht aus einer Ausgangsfarbe, einer Farbharmonie und einer Anzahl von Stufen:

![Neun Stufen über vier Farbtöne, alle aus der einen Ausgangsfarbe erzeugt, die im Link enthalten ist](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

Die CLI erstellt aus ihren Argumenten denselben URL-Zustand und durchläuft dieselbe Pipeline, sodass sie nicht von der App abweichen kann. `engine/src/url-mode.ts` parst und serialisiert den URL-Zustand. Reservierte Namen (`format`, `width`, `dpi`, `c2pa`, `z` und weitere) werden nie an ein Tool weitergegeben. [Reservierte URL-Parameter](/info/url-parameters.html) listet sie alle auf. Asset-Eingaben werden als `id` übermittelt und über `host.assets.get()` aufgelöst, bevor die Vorlage gefüllt wird.

### 6. Die Speicherung erfolgt über die Bridge

Die Web-App nutzt IndexedDB, Tauri das Dateisystem und die CLI den Arbeitsspeicher. Tools sehen nur `host.state.save(slot, data)` und `host.state.load(slot)`, nie `localStorage`. Sie können ohne Konto mehrere benannte Sitzungen pro Tool behalten. Weil die Bridge die einzige Schnittstelle ist, ist auch dieser Zustand portabel. `shells/web/src/data-transfer.ts` exportiert den Zustand als eine `lolly-backup`-Datei, die sich in jede andere Installation importieren lässt ([Datenübertragung](/info/data-transfer.html)). [Sync](/info/sync.html) sendet dasselbe Paket an einen Speicher, den die Person selbst wählt.

### 7. Reifegrad-Tags kennzeichnen den Status eines Tools

Jedes Tool deklariert `status: official | community | experimental`. Die Galerie sortiert nach Status. Experimentelle Tools versehen ihre Exporte standardmäßig mit einem Wasserzeichen: Die Laufzeit aktiviert das Wasserzeichen, sofern der Aufrufer nicht `watermark: false` übergibt. Tools, die auf dem Gerät Dateien verarbeiten, sind davon ausgenommen. Der eigene Katalogprozess eines Teams baut auf diesen Tags auf.

### 8. Eingaben sind im Manifest typisiert

Eine Eingabe deklariert einen `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` oder `file`. Der Host rendert für jeden Typ ein Steuerelement, sodass Tools keinen Code für Steuerelemente schreiben müssen. Jede Eingabe kann `bindToProfile` tragen. Drei Typen sind besonders wichtig:

- **`asset`** ist mit `filter` und `allowUpload` die Verbindung zum Asset-System. `allowUpload: false` beschränkt einen Slot auf Assets aus der Bibliothek. Hochgeladene Dateien haben dieselbe `AssetRef`-Struktur wie die Bibliothek.
- **`blocks`** ist eine wiederholte Feldgruppe, die in einem Seitenpanel bearbeitet wird und unter anderem von Meeting Planner, Wayfinding und Diagrams verwendet wird. Ein Klick auf einen gerenderten Block setzt den Fokus auf seine Zeile.
- **`file`** hält die eigene Datei der nutzenden Person im Arbeitsspeicher für Utilities auf dem Gerät wie Lolly Strip Hidden Data und Compress, und **`vector`** fasst eine feste Menge von Zahlen in einem Steuerelement zusammen.

### 9. Vorlagen enthalten keine Logik

Vorlagen sind in Handlebars geschrieben, sodass auch Menschen ohne Programmierkenntnisse sie verfassen können. `{{x}}` maskiert Sonderzeichen, und `{{{x}}}` muss ausdrücklich gewählt werden. Die Logik liegt in `hooks.js`, wo sie geprüft werden kann. Viele Vorlagen verwenden `{{{` für Markup, das ein Hook berechnet hat, daher muss jeder Hook die übergebenen Inhalte selbst maskieren. Die Helper sind `default`, `upper`, `lower`, `eq`, `markdown`, `asset`, `framing` und `media`, dazu `icsStamp`, `rfcText`, `csvCell` und `arrow` für zugehörige `.ics`-, `.vcf`- und `.csv`-Vorlagen. [Vorlagen und Rendering](/info/tool-rendering.html) beschreibt sie.

### 10. Tools setzen andere Tools zusammen

Ein Tool kann das Rendering eines anderen Tools einbetten, ohne Importe zwischen den Tools. Die Engine löst die Komposition auf. Ein Manifest kann `composes: [{ id, tool, inputs }]` deklarieren und das untergeordnete Tool mit `{{asset <id>}}` platzieren. Eine portable Einbettungs-URL (`https://lolly.tools/tool/<id>.svg?…`) rendert das untergeordnete Tool lokal; so platziert Lolly Design einen Live-QR-Code oder ein Diagramm. Ein untergeordnetes SVG bleibt in einem übergeordneten SVG oder PDF Vektor. Untergeordnete Renderings sind Zwischenergebnisse und erhalten nie Wasserzeichen oder Herkunftsangaben. Kann eine Shell ein untergeordnetes Tool nicht rendern, lässt sie den Slot leer, und das übergeordnete Tool wird trotzdem gerendert. [Komposition und Marken-Overlays](/info/tool-composition.html) enthält die Details.

<!--i:eti-scissors-->
## Worauf wir bewusst verzichten

- **Kein beliebiges JavaScript in Vorlagen.** Die Logik liegt in `hooks.js`.
- **Kein verpflichtender Asset-Server.** Sie fügen eigene Dateien zu Assets in der App hinzu und geben Arbeit als Sitzung weiter: einen Freigabelink für Eingaben und Einstellungen, eine `.lolly`-Datei, wenn auch hochgeladene Dateien mitreisen. Eine geteilte Sitzung kann zu einer Vorlage in der Auswahl eines Tools werden. Eine Organisation, die einen geregelten Katalog möchte, kann den Katalog, die Freigaben und die Richtlinien von Lolly Work nutzen oder das Markenpaket in git verwalten und Änderungen dort prüfen.
- **Keine erzwungene Zugriffskontrolle.** Die offene App ist standardmäßig öffentlich zugänglich. Reifegrad-Tags und Wasserzeichen kennzeichnen das Markenrisiko. Anmeldung bei der Organisation, Rollen und Richtlinien kommen von Lolly Work, wenn ein Team sie wünscht.
- **Keine zentrale Datenbank.** Der Zustand der nutzenden Person liegt auf jedem Gerät, und optionales Sync kopiert ihn in einen Speicher ihrer Wahl, nie in eine Lolly-Datenbank.
- **Kein gemeinsamer Codepfad zwischen Tools und Engine.** Die Engine und die Community-Tools sind Open Source. Ein Markenpaket wie das private `brands/suse/` enthält eigene Tools und einen eigenen Katalog unter eigenen Bedingungen. Kein Tool importiert aus `engine/`, sodass die Trennung sauber bleibt.

<!--i:eti-refresh-->
## Der Lebenszyklus eines Renderings

Jemand öffnet `https://lolly.tools/t/qr-code?url=https://example.com&ecl=H`:

1. **Starten.** Die Web-App öffnet IndexedDB, baut die Capability-Bridge auf und synchronisiert die Tool- und Asset-Kataloge oder lädt sie offline aus dem Cache.
2. **Weiterleiten.** Der Pfad wählt die Tool-Ansicht für `qr-code`, mit der Abfrage als Anfangswerten.
3. **Laden.** `loadTool` ruft `tool.json` ab, validiert es anhand des Schemas und ruft die Vorlage, Stile und Hooks ab.
4. **Den Link parsen.** `parseUrlState` wandelt die Parameter in Eingabewerte um. Eine Asset-Referenz wie `?logo=lolly/logo/primary` wird zu einem noch nicht aufgelösten `{ id }`.
5. **Die Laufzeit starten.** `createRuntime(tool, host, initialValues)` erstellt das Eingabemodell aus Profildaten, Standardwerten und dem Link, löst Asset-Referenzen auf, lädt die Hooks und ruft `onInit` auf.
6. **Rendern.** Die Shell abonniert die Laufzeit, zeichnet die Steuerelemente anhand des Modells und schreibt die gefüllte Vorlage in `#tool-canvas`.
7. **Interagieren.** Beim Tippen wird `runtime.setInput` aufgerufen, das Einschränkungen anwendet, `onInput` aufruft, die Vorlage erneut füllt und neu zeichnet.
8. **Exportieren.** **Download** ruft `runtime.export(node, format)` auf, und `host.export` der Shell erzeugt die Datei: ein Rasterbild, eine Vektorgrafik aus dem DOM-Walker, ein PDF, ein Dokument oder eines der anderen Formate in `schemas/tool.schema.json`. Physische Einheiten werden je nach Format umgerechnet. Metadaten und Content Credentials werden eingebettet, wo das Format sie aufnehmen kann. Experimentelle Tools erhalten ihr Wasserzeichen vom Host, nicht vom Tool. [Vorlagen und Rendering](/info/tool-rendering.html) und [Eine Datei exportieren](/info/exporting.html) behandeln den Exportschritt.

![Das Export-Panel, das ?options öffnet: das Paar aus Dateiname und Format, die Ausgabegröße und die Steuerelemente, die die Datei schreiben](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Derselbe Lebenszyklus läuft in Tauri und in der CLI mit einem Headless-DOM, wobei die Ausgabe in eine Datei oder an stdout geht.

<!--i:eti-stamp-->
## Lizenzen

Der Code, einschließlich `engine/`, `shells/`, `services/`, `schemas/` und des Dokumentationsgenerators, steht unter MPL-2.0 in einem öffentlichen Repository, [`lolly-tools/lolly`](https://github.com/lolly-tools/lolly). Die Texte der Dokumentation stehen unter CC BY-SA 4.0. Markenpakete haben eigene Bedingungen in ihrer jeweiligen `NOTICE.md`: Die Community-Tools stehen unter MPL-2.0, und das private SUSE-Paket ist proprietär und gehört SUSE. [Über Lolly](/info/about.html) enthält den vollständigen Lizenzhinweis.
