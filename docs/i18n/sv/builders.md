# Lolly för utvecklare

Den tekniska dokumentationen - för dig som skapar verktyg, integrerar Lolly i en pipeline, driftar det själv, eller vidareutvecklar plattformen.

**Vad du får ut av det.** Bygg ett verktyg en gång, så slutar förfrågningarna komma tillbaka till dig. Det repetitiva "kan du inte bara göra en åt mig…" som äter upp dina eftermiddagar blir en mall som andra fyller i själva - korrekt, utan att du behöver vara inblandad. Ditt arbete är vanlig HTML/CSS/JS: versionshanterat, diffbart, granskningsbart och kör på en öppen motor utan inlåsning till en leverantör, så det förblir ditt. Automatisera produktionskörningen så går din tid till det intressanta problemet, inte den tiotusende exporten.

Lolly är en plattformsoberoende **motor** som kör samma renderingsväg genom flera **skal** (web-PWA, Tauri desktop/mobil, CLI, TUI). Verktyg är **data, inte medföljande kod** - ett manifest plus en mall plus valfria hooks - så nya verktyg levereras utan en appuppdatering. Börja med [Översikt](/info/overview.html) för arkitekturen, och följ sedan det spår som passar det du bygger.

Ny på plattformen? **[Snabbstart](/info/quickstart.html)** ser till att du har ett varumärke och din första rendering på plats innan du går på djupet.

## Förstå arkitekturen



- **[Översikt](/info/overview.html)** - varför Lolly finns, uppdelningen mellan motor/skal/verktyg, kapabilitetsbryggan och de fastslagna arkitektoniska besluten.
- **[Design Tokens](/info/design-tokens.html)** - DTCG-tokenmodellen som varumärken uttrycks i, och hur verktyg använder den.

## Skapa verktyg

Varje kontroll nedan genererades från en deklarerad indata i `tool.json`. Du skriver manifestraden, värden ritar kontrollen, och samma modell driver CLI:t och URL:en.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

Det skalar längre än fem kontroller. Ge en indata en `section` och värden fäller in den, så att ett verktyg med femtio indata som D3 Chart Studio ändå öppnas som en kort stapel med resten inordnad bakom namngivna grupper.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Skapa verktyg](/info/authoring-tools.html)** - den fullständiga guiden: manifest, mall, stilar, hooks, komposition och publicering.
- **[Skapa tillgångar](/info/authoring-assets.html)** - katalogtillgångar, nivåer, språkversioner, paletter, temaikoner och typsnitt.
- **[Host API](/info/host-api.html)** - `HostV1`-kapabilitetsbryggan som varje verktyg skrivs mot (det enda API:et verktygen ser).
- **[URL Mode](/info/url-mode.html)** - varje inmatning som en URL-parameter; reserverade parametrar, kompakt kodning, packade länkar.

## Kör och integrera

- **[CLI](/info/cli.html)** - huvudlös rendering; samma renderingsväg som GUI, styrd av `--foo=bar`-argv.
- **[TUI](/info/tui.html)** - det interaktiva terminalskalet.
- **[MCP Server](/info/mcp.html)** - den inbyggda ändpunkten som låter en AI-agent upptäcka och köra verktyg.
- **[AI-agenter](/info/ai-agents.html)** - att styra Lolly från en modell: en URL är API:et.
- **[Chrome-tillägg](/info/extension.html)** - fånga en levande URL som en återanvändbar tillgång.

## Släpp och driv det

- **[Byggguide](/info/build-guide.html)** - bygg alla mål: CLI, TUI, desktop, mobil.
- **[Driftsättning](/info/deployment.html)** - webbappen, apparna och backend-tjänsterna; var varje del körs.
- **[Konfiguration](/info/configuration.html)** - profiler, varumärkespaket, kapabilitetsspärrar, funktionsflaggor och katalogvalidering.

## Förtroende och data

Rättigheter och upphovsmannaskap är indata som alla andra. Embed & Track Image deklarerar fält för upphovsperson, copyright, licens och kontakt, och exporten skriver in dem i filens egna metadata och i dess C2PA-manifest.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Content Credentials-identitet](/info/content-credentials-identity.html)** - CA-utfärdad signering för C2PA på enheten; motorns kontrakt och driftguiden för operatörer.
- **[Dataöverföring](/info/data-transfer.html)** - `lolly-backup`-paketet: kuvertformat, integritet och skalöverskridande garantier.
- **[Om](/info/about.html)** - projektet, dess licensgräns och repositoryt.
