# Lolly pro vývojáře

Technická dokumentace - pro každého, kdo vytváří nástroje, integruje Lolly do pipeline, provozuje si ji sám, nebo rozšiřuje platformu.

**Co z toho máš ty.** Nástroj postavíš jednou a požadavek se k tobě už nevrací. Opakující se „mohl bys mi prosím udělat…“, které ti sežere celá odpoledne, se změní v šablonu, kterou si lidé vyplní sami - správně, a bez tebe v tom. Tvoje práce je čisté HTML/CSS/JS: verzované, diffovatelné, recenzovatelné a běžící na otevřeném enginu bez vendor lock-inu, takže ti zůstává. Zautomatizuj produkční běh a tvůj čas půjde na zajímavý problém, ne na desetitisící export.

Lolly je platformově nezávislý **engine**, který spouští stejnou vykreslovací cestu napříč několika **shelly** (web PWA, Tauri desktop/mobile, CLI, TUI). Nástroje jsou **data, ne zabalený kód** - manifest plus šablona plus volitelné hooky - takže nové nástroje se nasazují bez aktualizace aplikace. Začni [Přehledem](/info/overview.html) pro architekturu, pak se vydej cestou, která odpovídá tomu, co stavíš.

Jsi na platformě nový? **[Rychlý start](/info/quickstart.html)** ti připraví brand a první render dřív, než se pustíš do hloubky.

## Pochop architekturu



- **[Přehled](/info/overview.html)** - proč Lolly existuje, rozdělení na engine/shell/nástroje, capability bridge a ustálená architektonická rozhodnutí.
- **[Designové tokeny](/info/design-tokens.html)** - DTCG tokenový model, ve kterém se vyjadřují brandy, a jak je nástroje využívají.

## Vytvářej nástroje

Každý ovládací prvek níže vznikl z deklarovaného vstupu v `tool.json`. Řádek manifestu napíšeš ty, widget nakreslí host a stejný model pohání i CLI a URL.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

A škáluje to dál než na pět ovládacích prvků. Dej vstupu `section` a host ho složí pryč, takže i nástroj s padesáti vstupy, jako je D3 Chart Studio, se otevře jako krátký seznam a zbytek zůstane zařazený v pojmenovaných skupinách.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Tvorba nástrojů](/info/authoring-tools.html)** - kompletní průvodce: manifest, šablona, styly, hooky, kompozice a publikování.
- **[Tvorba assetů](/info/authoring-assets.html)** - assety v katalogu, úrovně, lokalizace, palety, tématizovatelné ikony a fonty.
- **[Host API](/info/host-api.html)** - `HostV1` capability bridge, proti kterému je napsaný každý nástroj (jediné API, které nástroje vidí).
- **[Režim URL](/info/url-mode.html)** - každý vstup jako URL parametr; rezervované parametry, kompaktní kódování, sbalené odkazy.

## Spouštěj a integruj

- **[CLI](/info/cli.html)** - headless rendering; stejná vykreslovací cesta jako GUI, řízená pomocí `--foo=bar` argv.
- **[TUI](/info/tui.html)** - interaktivní terminálový shell.
- **[MCP server](/info/mcp.html)** - nativní endpoint, který umožňuje AI agentovi objevovat a spouštět nástroje.
- **[AI agenti](/info/ai-agents.html)** - ovládání Lolly z modelu: URL je API.
- **[Rozšíření pro Chrome](/info/extension.html)** - zachyť živé URL jako znovupoužitelný asset.

## Nasaď a provozuj

- **[Průvodce sestavením](/info/build-guide.html)** - sestav každý cíl: CLI, TUI, desktop, mobile.
- **[Nasazení](/info/deployment.html)** - webová aplikace, aplikace a backendové služby; kde každá část běží.
- **[Konfigurace](/info/configuration.html)** - profily, brand packy, capability gating, feature flagy a validace katalogu.

## Důvěra a data

Práva a autorství jsou vstupy jako každý jiný. Embed & Track Image deklaruje pole pro autora, copyright, licenci a kontakt a export je zapíše do metadat samotného souboru i do jeho C2PA manifestu.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Identita Content Credentials](/info/content-credentials-identity.html)** - podepisování C2PA vydávané certifikační autoritou (CA) přímo na zařízení; kontrakty enginu a provozní runbook.
- **[Přenos dat](/info/data-transfer.html)** - `lolly-backup` balíček: obálka, integrita a garance napříč shelly.
- **[O projektu](/info/about.html)** - projekt, hranice licence a repozitář.
