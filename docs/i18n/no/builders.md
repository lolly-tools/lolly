# Lolly for utviklere

Den tekniske dokumentasjonen - for alle som lager verktøy, integrerer Lolly i en pipeline, drifter det selv, eller videreutvikler plattformen.

**Hva du får ut av det.** Bygg et verktøy én gang, så slutter forespørselen å komme tilbake til deg. Det repeterende «kan du ikke bare lage en til meg…» som spiser opp ettermiddagene dine, blir en mal andre fyller ut selv - korrekt, uten at du trenger å være involvert. Arbeidet ditt er vanlig HTML/CSS/JS: versjonskontrollert, diffbart, gjennomgåbart, og kjører på en åpen motor uten leverandørinnlåsing, så det forblir ditt. Automatiser produksjonskjøringen, så går tiden din til det interessante problemet, ikke den ti tusende eksporten.

Lolly er en plattformuavhengig **motor** som kjører samme renderingsvei på tvers av flere **skall** (web-PWA, Tauri desktop/mobil, CLI, TUI). Verktøy er **data, ikke medfølgende kode** - et manifest pluss en mal pluss valgfrie hooks - så nye verktøy leveres uten en app-oppdatering. Start med [Oversikt](/info/overview.html) for arkitekturen, og følg deretter sporet som passer det du bygger.

Ny på plattformen? **[Hurtigstart](/info/quickstart.html)** får en merkevare og din første rendering på plass før du går i dybden.

## Forstå arkitekturen



- **[Oversikt](/info/overview.html)** - hvorfor Lolly finnes, skillet mellom motor/skall/verktøy, kapabilitetsbroen, og de fastsatte arkitektoniske forpliktelsene.
- **[Design Tokens](/info/design-tokens.html)** - DTCG-tokenmodellen som merkevarer uttrykkes i, og hvordan verktøy bruker den.

## Lag verktøy

Hver kontroll nedenfor ble generert fra en deklarert inndata i `tool.json`. Du skriver manifestlinjen, verten tegner kontrollen, og samme modell driver CLI-en og URL-en.

![One declared input, one generated control: a url, a colour, a select, a number, a boolean](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code&width=1440&height=900&dpi=192&waitMs=2000&cropSelector=.tool-inputs&walker=1&format=svg&dark=1&filename=aud-manifest-controls)

Det skalerer lenger enn fem kontroller. Gi en inndata en `section`, og verten feller den sammen, slik at et verktøy med femti inndata som D3 Chart Studio likevel åpner som en kort stabel med resten sortert bak navngitte grupper.

![The D3 sidebar - a handful of primary controls, then Data, Columns, Chart, Axes and the other sections collapsed into one line each](/t/url-shot?url=%2F%23%2Ftool%2Fchart&width=1440&height=1600&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-d3-sections)

- **[Lag verktøy](/info/authoring-tools.html)** - den fullstendige guiden: manifest, mal, stiler, hooks, komposisjon og publisering.
- **[Lag ressurser](/info/authoring-assets.html)** - katalogressurser, nivåer, språkversjoner, paletter, temabare ikoner og fonter.
- **[Host API](/info/host-api.html)** - `HostV1`-kapabilitetsbroen som hvert verktøy skrives mot (det eneste API-et verktøy ser).
- **[URL-modus](/info/url-mode.html)** - hver inndata som en URL-parameter; reserverte parametre, kompakt koding, pakkede lenker.

## Kjør og integrer

- **[CLI](/info/cli.html)** - hodeløs rendering; samme renderingsvei som GUI-et, styrt av `--foo=bar`-argv.
- **[TUI](/info/tui.html)** - det interaktive terminalskallet.
- **[MCP Server](/info/mcp.html)** - det innebygde endepunktet som lar en AI-agent oppdage og kjøre verktøy.
- **[AI-agenter](/info/ai-agents.html)** - å styre Lolly fra en modell: en URL er API-et.
- **[Chrome-utvidelse](/info/extension.html)** - fang en direkte URL som en gjenbrukbar ressurs.

## Lever og drift det

- **[Byggeguide](/info/build-guide.html)** - bygg alle mål: CLI, TUI, desktop, mobil.
- **[Driftsetting](/info/deployment.html)** - nettappen, appene og bakgrunnstjenestene; hvor hver del kjører.
- **[Konfigurasjon](/info/configuration.html)** - profiler, merkevarepakker, funksjonssperring, funksjonsflagg og katalogvalidering.

## Tillit og data

Rettigheter og opphav er inndata som alle andre. Embed & Track Image deklarerer felter for opphavsperson, copyright, lisens og kontakt, og eksporten skriver dem inn i filens egne metadata og i C2PA-manifestet dens.

![The Embed and Track Image controls - creator, copyright, a licence dropdown, contact and title, filled from the link](/t/url-shot?url=%2F%23%2Ftool%2Fclaim%3Fcreator%3DAda%2520Lovelace%26title%3DEngine%2520Notes&width=1440&height=1200&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-rights-fields)

- **[Content Credentials-identitet](/info/content-credentials-identity.html)** - CA-utstedt signering for C2PA på enheten; motorkontrakter og driftshåndboken for operatører.
- **[Dataoverføring](/info/data-transfer.html)** - `lolly-backup`-pakken: konvolutt, integritet og garantier på tvers av skall.
- **[Om](/info/about.html)** - prosjektet, lisensgrensen og repositoriet.
