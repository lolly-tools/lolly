# Slik fungerer Lolly

Et Lolly-verktøy holder reglene for én type fil: layouten, skriften, fargene og hvilke deler andre kan endre. Du, en kollega, et skript eller en AI-agent fyller ut feltene, og hver fil blir riktig. Denne siden viser hvem som gjør hva, og de fire rutene fra et verktøy til en ferdig fil.

## Ett verktøy, dine regler, mange filer

Merkevarereglene ligger i verktøyet, ikke i hver fil det lager. Få verktøyet riktig én gang, så arver hvert resultat den samme skriften, fargen og avstanden, enten det er ett kort eller et regneark med rader på et dusin språk.

![Et ordmerkeverktøy med ett felt fylt ut: skrift, farge og avstand ble avgjort da verktøyet ble laget](/info/shots/aud-rules-in-the-tool.svg)

Personen som lager den hundrede filen, skriver bare ordene. Hvordan du sjekker arbeidet, og hvem som sjekker det, forblir din avgjørelse. Lolly gjør det som er verdt å sjekke, mindre, og neste fil raskere å lage.

## Hvem som rører et verktøy

Følg ett kampanjekort gjennom en organisasjon, så dukker tre par hender opp. Hvert par bygger videre på det forrige.

![En designer setter reglene én gang i et verktøy; en utvikler kjører det fra et skript og hvem som helst kan fylle ut feltene; begge lager ferdige filer](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **En designer setter reglene.** De legger ut kortet i Design med merkevarens skrift og farger, og velger deretter hvilke felt som forblir åpne. De gjør dette én gang, så ingen lokaliserer kortet for hånd igjen.
- <!--i:code--> **En utvikler skalerer verktøyet.** Det samme verktøyet kjører i et nattlig skript gjennom kommandolinjen, så et ferskt diagram eller en ny språkversjon kommer uten at noen åpner designet på nytt.
- <!--i:people--> **Hvem som helst fyller det ut.** En selger på et fly, uten nett og uten designopplæring, åpner verktøyet og lager kortet til morgendagens møte.
:::

Det ferske diagrammet i utviklerens trinn er en gjengivelse som denne, laget av en datastreng og noen få innstillinger uten at noen åpner en designfil:

![Et stablet områdediagram med tittel, med tre serier i bånd i en kjølig palett, der akser, forklaring og tittel er plassert av malen i stedet for for hånd](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Selgerens enkle minutt er bare mulig på grunn av designerens omtanke og utviklerens skript. Hver rolle arbeider med det samme verktøyet, i stedet for et eget produkt hver.

## Fire ruter til en fil

Hver rute kjører den samme motoren på det samme verktøyet, så filen et skript lager, stemmer med den du forhåndsviser i appen.

![URL-parametere og kommandolinjeargumenter blir den samme inndatamodellen, kjørt gjennom én felles kjøretid og eksportbro](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **I appen, én om gangen.** Åpne et verktøy, fyll ut feltene og trykk **Export**. [Make your first file](/info/make-something.html) tar deg gjennom en.
- <!--i:layers--> **I appen, mange samtidig.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) tar en innlimt eller importert tabell og lager én ferdig fil per rad.
- <!--i:cpu--> **Fra et skript eller en AI-agent.** [CLI](/info/cli.html) kjører et verktøy uten grensesnitt, og [MCP-serveren](/info/mcp.html) lar en agent oppdage og kjøre verktøy. En lenke til et verktøy bærer også inndataene, så en lenke er en komplett forespørsel.
- <!--i:server--> **Gjennom organisasjonens server.** [Lolly Work](/info/organisation.html) gjengir på serveren under organisasjonens pålogging og verktøypolicy, har jobber den kan gjenoppta og holder resultatet klart for nedlasting eller godkjent levering.

Hvilken rute en jobb kan bruke, avhenger av verktøyets formater og hva verten kan gjøre: noen formater trenger en nettleser, så kommandolinjen overlater dem til et nettlesernivå. [Render with the CLI](/info/cli-rendering.html) lister hvilke formater som gjengis hvor.

## Hva som kjører hvor

Å lage, redigere og eksportere kjører på enheten din, uten konto. En funksjon som trenger en server, som Sync eller å sende en fil til en tilkoblet tjeneste, kobler bare til når du bruker den funksjonen. Med Lolly Work bruker delte prosjekter, redigering i sanntid for teamet, godkjenninger og serverjobber organisasjonens server. [What runs where](/info/compare.html#what-runs-where) setter de to delene side om side.

## Les videre

- [Make your first file](/info/make-something.html), for å prøve det nå.
- [Start](/info/quickstart.html), for å legge inn ditt eget designsystem.
- [Automate](/info/builders.html), for kommandolinjen, lenker og agenter.
- [Lolly architecture](/info/overview.html), for bidragsytere: motoren, skallene og reglene som holder dem sammen.
