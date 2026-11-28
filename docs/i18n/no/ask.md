# Ask Lolly

Ask Lolly svarer på et spørsmål med den passende delen av disse veiledningene, sitert ord for ord, med kildehenvisning til siden og en **Open in docs**-lenke til den delen. Ingenting genereres: svaret finnes og siteres på enheten din.

Under den siterte delen finner du stedene i appen som passer til spørsmålet: et verktøy, et hjelpeverktøy, et lagret prosjekt, en katalogressurs, en innstilling eller en side i appen. Hver rad brukes bare til navigering. Ingenting i et svar endrer en innstilling, åpner en fil eller handler på dine vegne, samme regel som [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Stille et spørsmål

Skriv i spørsmålsfeltet nederst i visningen og trykk Enter. Alt kortere enn to tegn ignoreres. Svarene stables over feltet, med det nyeste sist.

![Ask Lolly, åpen og tom: spørsmålsfeltet nederst i visningen, med merknaden om at svarene kommer fra dokumentasjonen](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Hvert spørsmål står for seg selv
Tidligere spørsmål gir ingen kontekst videre, så «hva med PDF?» etter et spørsmål om eksport leses bare som et spørsmål om PDF. Still hele spørsmålet hver gang.
:::

Det første ordet i spørsmålet ditt bestemmer hva som kommer først i svaret:

| Du starter med | Hva som kommer først |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | stedene i appen som passer |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | verktøyene som passer |
| alt annet - inkludert *how do I* og *what is* | delen fra dokumentasjonen, som er standarden |

Begge delene hentes alltid, så et feiltolket spørsmål endrer bare rekkefølgen i svaret.

Sammenligningen utelater vanlige spørsmålsord (*how*, *do*, *I*, *the*, *my*). Den rangerer en del etter hvor mange av de andre ordene dine den dekker, og deretter etter hvor de traff: en overskrift teller mer enn brødtekst. Sammenligningen bruker delstrenger og ignorerer store og små bokstaver og aksenter, så en skrivefeil blir ikke rettet. Når ingenting passer, sier Ask fra og viser til dokumentasjonsoversikten.

**Better matching** er valgfritt. Etter det første svaret kan Ask tilby en liten modell for sammenligning og vise nedlastingsstørrelsen. Modellen kobler et spørsmål til en veiledning som bruker andre ord for det samme. Den lastes bare ned når du samtykker, kjører på denne enheten og endrer bare hvilke deler som rangeres først. Svaret bruker fortsatt dokumentasjonens egne ord. Du kan også laste den ned som **Ask matching model** under **Settings → Preferences → Available offline** ([Tilgjengelig uten nett](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Hva du får tilbake

Et svarkort har en fast rekkefølge:

1. **Selve delen**, gjengitt fra dokumentasjonskilden: avsnitt, lister, tabeller, kode og sitater, med aktive lenker til appen og `/info`. En lang del avsluttes med **Show more**, som åpner resten på stedet. Bilder utelates, og en lenke til et annet nettsted vises som ren tekst.
2. **Kildehenvisningen** - *Side › Overskrift* - og **Open in docs**-lenken til akkurat den delen.
3. **More in the docs** - opptil fire andre deler som passet, som lenker.
4. **Radene fra appen**, under de samme gruppeoverskriftene som Search bruker.

Den fullstendige teksten kommer fra markdown-versjonen hver dokumentasjonsside publiserer på `/info/<slug>.md`. Disse versjonene finnes bare på engelsk. På andre språk, og på de få sidene som ikke er bygget fra markdown, viser svaret i stedet det korte utdraget fra søkeindeksen. Kildehenvisningen og **Open in docs**-lenken peker fortsatt til siden på ditt språk.

<!--i:eti-map-pin-->
## Hvor du finner den

Ruten er `#/ask`. Den har ingen fane og ingen rute i Utilities-rutenettet. Du kommer til visningen fra søkefeltet eller via adressen.

- <!--i:search--> **Fra søk.** Hvert resultatpanel avsluttes med en **Ask Lolly: *søket ditt***-rad, under resultatene fra de andre gruppene. Raden åpner `#/ask?q=…`, og visningen stiller spørsmålet én gang når den åpnes. Ordene kommer med små bokstaver uten tegnsetting, så juster dem i spørsmålsfeltet hvis du trenger det.
- <!--i:link--> **Fra en lenke.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` åpner visningen med det spørsmålet allerede stilt. URL-fragmentet angir bare det første spørsmålet. Spørsmål du skriver etterpå, besvares på stedet og endrer aldri adressen.

Søkefeltet skjules i denne visningen fordi spørsmålsfeltet bruker Enter. Tilbake-pillen tar deg tilbake dit du kom fra.

Svarene beholdes i denne økten: de er der fortsatt hvis du går ut og kommer tilbake, og tømmes når du laster på nytt. Ingenting skrives til lagring, så det er ingen historikk å administrere.

<!--i:eti-download-->
## Uten nett

Svarene kommer fra to statiske filer dokumentasjonsnettstedet publiserer: søkeindeksen for hvert språk og sidens markdown-versjon. Begge hentes etter navn, så Ask fungerer uten tilkobling når de er hurtigbufret. Å lese veiledningene i appen hurtigbufrer dem. **Guides & docs** under [Tilgjengelig uten nett](/info/dashboard.html#available-offline) henter hele nettstedet, inkludert skjermbilder, i én nedlasting.

Uten disse filene vises ikke dokumentasjonsdelen av et svar, og ingen feil vises. Radene fra appen vises fortsatt, fordi de sammenlignes med data som allerede finnes på enheten.

<!--i:eti-lock-->
## Personvern

Spørsmålet ditt forlater aldri enheten. Sammenligningen kjører lokalt mot filer som hentes etter navn, så det du skrev, er ikke del av noen forespørsel. Ingen server ser spørsmålet, ingen konto har det og ingen registrering blir igjen etter at du laster på nytt. [Personvernerklæringen](/info/privacy.html) lister alt appen henter eller sender.

---

**Relatert:** [Lolly Search](/info/search.html) for feltet som sender spørsmål videre. [Slik bruker du Lolly](/info/using.html) for resten av appen. [Lolly-innstillinger](/info/dashboard.html#available-offline) for å gjøre dokumentasjonen tilgjengelig uten nett først.
