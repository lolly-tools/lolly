# Lolly dla twórców

Dokumentacja techniczna - dla każdego, kto tworzy narzędzia, integruje Lolly z pipeline'em, hostuje go samodzielnie lub rozszerza platformę.

**Co masz z tego ty.** Zbuduj narzędzie raz, a prośba przestanie do ciebie wracać. Powtarzające się „możesz mi po prostu zrobić…", które zjada twoje popołudnia, staje się szablonem, który ludzie wypełniają sami - poprawnie, bez twojego udziału. Twoja praca to zwykły HTML/CSS/JS: wersjonowany, z czytelnym diffem, gotowy do przeglądu i działający na otwartym silniku bez vendor lock-in, więc pozostaje twój. Zautomatyzuj produkcyjny przebieg, a twój czas pójdzie na ciekawy problem, a nie na dziesięciotysięczny eksport.

Lolly to niezależny od platformy **silnik**, który uruchamia tę samą ścieżkę renderowania w kilku **powłokach** (webowa PWA, Tauri na desktop/mobile, CLI, TUI). Narzędzia to **dane, nie zbundlowany kod** - manifest plus szablon plus opcjonalne hooki - więc nowe narzędzia trafiają do użytkowników bez aktualizacji aplikacji. Zacznij od [Przeglądu](/info/overview.html), żeby poznać architekturę, a potem podążaj ścieżką dopasowaną do tego, co budujesz.

Nowość na platformie? **[Szybki start](/info/quickstart.html)** pozwoli ci ustawić markę i pierwszy render, zanim wejdziesz głębiej.

## Poznaj architekturę



- **[Przegląd](/info/overview.html)** - dlaczego Lolly istnieje, rozdział na silnik/powłokę/narzędzia, most zdolności (capability bridge) oraz utrwalone decyzje architektoniczne.
- **[Design Tokens](/info/design-tokens.html)** - model tokenów DTCG, w którym wyrażane są marki, i sposób, w jaki korzystają z nich narzędzia.

## Twórz narzędzia

Każda kontrolka poniżej powstała z wejścia zadeklarowanego w `tool.json`. Ty piszesz linię manifestu, host rysuje widżet, a ten sam model napędza CLI i URL.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

To skaluje się dalej niż do pięciu kontrolek. Nadaj wejściu `section`, a host je zwinie, więc narzędzie z pięćdziesięcioma wejściami, takie jak D3 Chart Studio, wciąż otwiera się jako krótka lista, a reszta jest poukładana w nazwanych grupach.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Tworzenie narzędzi](/info/authoring-tools.html)** - pełny przewodnik: manifest, szablon, style, hooki, kompozycja i publikowanie.
- **[Tworzenie zasobów](/info/authoring-assets.html)** - zasoby katalogu, poziomy (tiers), lokalizacje, palety, ikony podatne na motyw i czcionki.
- **[Host API](/info/host-api.html)** - most zdolności `HostV1`, wobec którego pisane jest każde narzędzie (jedyne API, które widzą narzędzia).
- **[Tryb URL](/info/url-mode.html)** - każdy input jako parametr URL; parametry zarezerwowane, kompaktowe kodowanie, spakowane linki.

## Uruchamiaj i integruj

- **[CLI](/info/cli.html)** - renderowanie headless; ta sama ścieżka renderowania co w GUI, sterowana przez argv `--foo=bar`.
- **[TUI](/info/tui.html)** - interaktywna powłoka terminalowa.
- **[Serwer MCP](/info/mcp.html)** - natywny endpoint, który pozwala agentowi AI odkrywać i uruchamiać narzędzia.
- **[Agenci AI](/info/ai-agents.html)** - sterowanie Lolly z poziomu modelu: URL jest API.
- **[Rozszerzenie do Chrome](/info/extension.html)** - przechwyć aktywny URL jako zasób wielokrotnego użytku.

## Wdrażaj i utrzymuj

- **[Przewodnik budowania](/info/build-guide.html)** - buduj każdy cel: CLI, TUI, desktop, mobile.
- **[Wdrożenie](/info/deployment.html)** - aplikacja webowa, aplikacje i usługi backendowe; gdzie działa każdy element.
- **[Konfiguracja](/info/configuration.html)** - profile, paczki marek, bramkowanie zdolności (capability gating), flagi funkcji i walidacja katalogu.

## Zaufanie i dane

Prawa i autorstwo to wejścia jak każde inne. Embed & Track Image deklaruje pola twórcy, praw autorskich, licencji i kontaktu, a eksport wpisuje je w metadane samego pliku oraz w jego manifest C2PA.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Tożsamość Content Credentials](/info/content-credentials-identity.html)** - podpisywanie wydawane przez CA dla C2PA na urządzeniu; kontrakty silnika i runbook operatora.
- **[Transfer danych](/info/data-transfer.html)** - pakiet `lolly-backup`: koperta, integralność i gwarancje między powłokami.
- **[O projekcie](/info/about.html)** - projekt, jego granice licencyjne i repozytorium.
