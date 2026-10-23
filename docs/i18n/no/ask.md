# Ask Lolly

Skriv et spørsmål, så svarer Ask Lolly med delen av disse veiledningene som dekker det, ord for ord, med siden den kom fra oppgitt og en **Open in docs**-lenke rett til den delen. Ingenting genereres: svaret hentes, siteres og tilskrives, på enheten din.

Under den siterte delen ligger stedene i appen som matcher det samme spørsmålet: et verktøy, en utility, et lagret prosjekt, en katalogressurs, en innstilling eller en side i appen. Hver rad navigerer bare. Ingenting i et svar endrer en innstilling, åpner en fil eller handler for deg, den samme regelen som [Search](/info/search.html) følger.

## Å stille et spørsmål

Skriv i spørsmålsfeltet nederst i visningen og trykk Enter. Alt kortere enn to tegn ignoreres. Svar stables opp over feltet, det nyeste sist, og du kan fortsette å spørre.

![Ask Lolly, åpen og tom: spørsmålsfeltet nederst i visningen, med merknaden om at svar kommer fra dokumentasjonen](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Hvert spørsmål besvares for seg: tidligere spørsmål bærer ingen kontekst videre, så "what about PDF?" etter et spørsmål om eksport leses som et spørsmål om PDF og ingenting annet. Still hele spørsmålet hver gang.

Det første ordet i spørsmålet avgjør hva som leder svaret:

| Du starter med | Hva som leder |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | stedene i appen som matcher |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | verktøyene som matcher |
| alt annet - inkludert *how do I* og *what is* | dokumentasjonsdelen, som er standarden |

Begge halvdelene hentes alltid, så et feillest spørsmål omordner et svar i stedet for å miste halvparten av svaret.

Matchingen dropper de vanlige spørreordene (*how*, *do*, *I*, *the*, *my*) og rangerer en del etter hvor mange av de gjenværende ordene dine den dekker, deretter etter hvor de traff: en overskrift teller mer enn brødtekst. Matchingen skjer med delstrenger, uten hensyn til store og små bokstaver og aksenter, så en skrivefeil rettes ikke. Når ingenting matcher, sier Ask fra om det og peker på dokumentasjonsindeksen i stedet for å finne på et svar.

**Better matching** er valgfritt. Etter det første svaret kan Ask tilby en liten matchingmodell, med nedlastingsstørrelsen oppgitt, som hjelper med å matche et spørsmål til en veiledning som bruker andre ord for det samme. Den lastes bare ned når du sier ja, kjører på denne enheten og endrer bare hvilke deler som rangeres først: svaret er fortsatt dokumentasjonens egne ord. Du kan også laste den ned fra **Settings → Preferences → Available offline**, der den står som **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Hva som kommer tilbake

Et svarkort settes sammen i en fast rekkefølge:

1. **Selve delen**, gjengitt fra dokumentasjonskilden - avsnitt, lister, tabeller, kode og sitater, med levende lenker i appen og til `/info`. En lang del begrenses med en **Show more** som åpner den på stedet. Bilder droppes, og en lenke ut til et annet nettsted gjengis som ren tekst i stedet for et anker.
2. **Kilden** - *Page › Heading* - og lenken **Open in docs** til akkurat den delen.
3. **More in the docs** - opptil fire andre deler som matchet, som lenker.
4. **Radene i appen**, under de samme gruppeoverskriftene som Search bruker.

Hele teksten kommer fra den rene markdown-tvillingen hver dokumentasjonsside publiserer på `/info/<slug>.md`, og de tvillingene finnes bare på engelsk. På et annet språk - og på de få sidene som ikke er bygget fra markdown - faller svaret tilbake til det korte utdraget i søkeindeksen i stedet for hele delen. Kilden og lenken **Open in docs** er der uansett, og peker på siden på ditt eget språk.

## Hvor den bor

Ruten er `#/ask`. Den har ingen fane og ingen flis i Utilities-rutenettet; veiene inn er søkefeltet og selve adressen.

- <!--i:search--> **Fra søk.** Hvert resultatpanel har en rad **Ask Lolly: *your query*** helt nederst, under de konkrete treffene de andre gruppene fant. Den overleverer spørsmålet som `#/ask?q=…`, og visningen stiller spørsmålet én gang ved ankomst. De overleverte ordene kommer med små bokstaver og uten tegnsetting, så finjuster dem i spørsmålsfeltet om du trenger det.
- <!--i:link--> **Fra en lenke.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` åpner visningen med det spørsmålet allerede stilt. Hashen er bare startverdien: spørsmål du skriver etterpå, besvares på stedet og skriver aldri om adressen.

Søkefeltet viker unna inne i denne visningen, siden spørsmålsfeltet tar Enter, og tilbakepillen tar deg tilbake dit du kom fra.

Svarene på skjermen varer for denne økten: de er der fortsatt hvis du navigerer bort og kommer tilbake, og en omlasting tømmer dem. Ingenting skrives til lagring, så det er ingen historikk å håndtere.

## Uten nett

Svar settes sammen av to statiske filer dokumentasjonsnettstedet allerede publiserer: søkeindeksen per språk og sidens markdown-tvilling. Begge hentes ved navn, så Ask fortsetter å fungere uten forbindelse når de er bufret. Å lese veiledningene i appen bufrer dem underveis, og **Guides & docs** under [Available offline](/info/dashboard.html#available-offline) tar hele nettstedet, skjermbilder inkludert, i én nedlasting.

Uten dem vises dokumentasjonshalvdelen av et svar rett og slett ikke, uten feil. Radene i appen vises likevel, fordi de matches mot data som allerede ligger på enheten.

## Personvern

Spørsmålet ditt forlater aldri enheten. Matchingen kjører lokalt mot filer hentet ved navn, så det du skrev, er ikke en del av noen forespørsel; det finnes ingen server som ser det, ingen konto det er knyttet til og ingen post av det etter at du laster på nytt. Se [Privacy Policy](/info/privacy.html) for den komplette listen over hva appen noen gang henter eller sender.

---

**Related:** [Search](/info/search.html) for linjen som overleverer spørsmål. [Using Lolly](/info/using.html) for resten av appen. [Settings](/info/dashboard.html#available-offline) for å ta dokumentasjonen med uten nett først.
