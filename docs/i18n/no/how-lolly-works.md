# Slik fungerer Lolly

Et Lolly-verktøy inneholder reglene for én type fil: layouten, skriften, fargene og hvilke deler andre kan endre. Du, en kollega, et skript eller en KI-agent fyller ut feltene, og hver fil følger disse reglene.

<!--i:eti-repeat-->
## Ett verktøy, dine regler, mange filer

Merkevarereglene ligger i verktøyet. Sett opp verktøyet én gang, så får hvert resultat samme skrift, farge og avstand, fra ett kort til et regneark med rader på et dusin språk.

![Et ordmerkeverktøy med ett utfylt felt: skrift, farge og avstand ble bestemt da verktøyet ble laget](/info/shots/aud-rules-in-the-tool.svg)

Den som lager den hundrede filen, skriver bare ordene. Du bestemmer hvordan arbeidet kontrolleres og hvem som kontrollerer det. Lolly gir mindre å kontrollere og gjør det raskere å lage neste fil.

<!--i:eti-users-->
## Hvem bruker et verktøy

Tre roller i en organisasjon arbeider med ett kampanjekort.

![En designer setter reglene én gang i et verktøy; en utvikler kjører det fra et skript og hvem som helst kan fylle ut feltene; begge lager ferdige filer](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **En designer setter reglene.** Designeren lager kortets layout i Lolly Design med merkevarens skrift og farger og velger deretter hvilke felt som skal være åpne. Dette gjøres én gang, slik at ingen trenger å lokalisere kortet manuelt igjen.
- <!--i:code--> **En utvikler skalerer bruken av verktøyet.** Det samme verktøyet kjøres i et nattlig skript via kommandolinjen. Et oppdatert diagram eller en ny språkversjon kommer uten at noen åpner designet igjen.
- <!--i:people--> **Hvem som helst fyller det ut.** En selger på et fly, uten nett og uten designopplæring, åpner verktøyet og lager kortet til morgendagens møte.
:::

Utviklerens oppdaterte diagram er en gjengivelse som denne, laget av en datastreng og noen få innstillinger:

![Et stablet områdediagram med overskrift, der de tre seriene danner bånd i en kjølig palett, med akser, tegnforklaring og tittel plassert av malen i stedet for manuelt](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

At selgeren er ferdig på et minutt, avhenger av designerens regler og utviklerens skript. Alle rollene bruker det samme verktøyet.

<!--i:eti-train-->
## Fire veier til en fil

Alle veiene kjører den samme motoren på det samme verktøyet, slik at filen et skript lager, samsvarer med den du forhåndsviser i appen.

![URL-parametere og kommandolinjeargumenter blir den samme inndatamodellen og kjøres gjennom ett felles kjøremiljø og én eksportbro](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **I appen, én om gangen.** Åpne et verktøy, fyll ut feltene og trykk **Export**. [Lag din første fil](/info/make-something.html) viser deg hvordan.
- <!--i:layers--> **I appen, mange på én gang.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) tar en innlimt eller importert tabell og gjengir én ferdig fil per rad.
- <!--i:cpu--> **Fra et skript eller en KI-agent.** [CLI](/info/cli.html) kjører et verktøy uten grafisk grensesnitt, og [MCP-serveren](/info/mcp.html) lar en agent oppdage og kjøre verktøy. En lenke til et verktøy inneholder også inndataene, så en lenke er en fullstendig forespørsel.
- <!--i:server--> **Via organisasjonens server.** [Lolly Work](/info/organisation.html) gjengir på serveren under organisasjonens påloggings- og verktøypolicy, beholder jobber som kan gjenopptas og oppbevarer resultatet for nedlasting eller godkjent levering.

Hvilken vei en jobb kan bruke, avhenger av verktøyets formater og hva vertsmiljøet kan gjøre. Noen formater trenger en nettleser, så kommandolinjen sender dem videre til et nettleserlag. [Gjengi med CLI](/info/cli-rendering.html) lister hvilke formater som gjengis hvor.

<!--i:eti-monitor-->
## Hva kjører hvor

Oppretting, redigering og eksport kjøres på enheten din, uten konto. En funksjon som trenger en server, for eksempel Sync eller sending av en fil til en tilkoblet tjeneste, kobler seg bare til når du bruker den funksjonen. Med Lolly Work bruker delte prosjekter, direkte redigering i team, godkjenninger og serverjobber organisasjonens server. [Hva kjører hvor](/info/compare.html#what-runs-where) viser de to delene side om side.

<!--i:eti-graduation-cap-->
## Les videre

- [Lag din første fil](/info/make-something.html), for å prøve det nå.
- [Start](/info/quickstart.html), for å legge inn ditt eget designsystem.
- [Automatiser](/info/builders.html), for kommandolinjen, lenker og agenter.
- [Lolly-arkitektur](/info/overview.html), for bidragsytere: motoren, skallene og reglene som holder dem sammen.
