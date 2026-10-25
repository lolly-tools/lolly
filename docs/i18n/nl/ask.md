# Ask Lolly

Typ een vraag en Ask Lolly antwoordt met het gedeelte van deze gidsen dat erover gaat, woord voor woord, met de pagina waaruit het kwam als bron en een link **Open in docs** rechtstreeks naar dat gedeelte. Er wordt niets gegenereerd: het antwoord wordt opgehaald, geciteerd en toegeschreven, op je apparaat.

Onder het geciteerde gedeelte staan de plekken in de app die bij dezelfde vraag passen: een tool, een hulpprogramma, een opgeslagen project, een catalogusasset, een instelling of een pagina van de app. Elke rij navigeert alleen. Niets in een antwoord wijzigt een instelling, opent een bestand of handelt voor je, dezelfde regel die [Zoeken](/info/search.html) volgt.

## Een vraag stellen

Typ in het vraagveld onderaan de weergave en druk op Enter. Alles korter dan twee tekens wordt genegeerd. Antwoorden stapelen zich boven het veld op, de nieuwste onderaan, en je kunt blijven vragen.

![Ask Lolly, open en leeg: het vraagveld onderaan de weergave, met de opmerking dat antwoorden uit de docs komen](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Elke vraag wordt op zichzelf beantwoord: eerdere vragen nemen geen context mee, dus "what about PDF?" na een vraag over exporteren wordt gelezen als een vraag over PDF en niets anders. Stel elke keer de hele vraag.

Het eerste woord van je vraag bepaalt wat het antwoord aanvoert:

| Je begint met | Wat aanvoert |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | de plekken in de app die passen |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | de tools die passen |
| al het andere - inclusief *how do I* en *what is* | het gedeelte uit de documentatie, wat de standaard is |

Beide helften worden altijd opgehaald, dus een verkeerd gelezen vraag herordent een antwoord in plaats van de helft van het antwoord te verliezen.

De matching laat de gewone vraagwoorden vallen (*how*, *do*, *I*, *the*, *my*) en rangschikt een gedeelte op het aantal van je overgebleven woorden dat het dekt, en dan op waar ze overeenkwamen: een kop telt zwaarder dan lopende tekst. De matching gebeurt op deeltekenreeks, gelijkgetrokken voor hoofdletters en accenten, dus een typfout wordt niet gecorrigeerd. Wanneer niets past, zegt Ask dat en wijst naar de documentatie-index in plaats van een antwoord te verzinnen.

**Better matching** is optioneel. Na je eerste antwoord kan Ask een klein matchingmodel aanbieden, met zijn downloadgrootte, dat helpt een vraag te koppelen aan een gids die andere woorden voor hetzelfde gebruikt. Het wordt alleen gedownload als je akkoord gaat, draait op dit apparaat en verandert alleen welke gedeelten bovenaan staan: het antwoord blijft de eigen woorden van de documentatie. Je kunt het ook downloaden via **Settings → Preferences → Available offline**, waar het staat als **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Wat er terugkomt

Een antwoordkaart wordt in een vaste volgorde samengesteld:

1. **Het gedeelte zelf**, gerenderd uit de documentatiebron - alinea's, lijsten, tabellen, code en citaten, met werkende links in de app en naar `/info`. Een lang gedeelte wordt afgekapt met een **Show more** die het ter plekke opent. Afbeeldingen vervallen, en een link naar een andere site wordt als gewone tekst gerenderd in plaats van als anker.
2. **De bronvermelding** - *Page › Heading* - en de link **Open in docs** naar dat exacte gedeelte.
3. **More in the docs** - maximaal vier andere gedeelten die pasten, als links.
4. **De rijen in de app**, onder dezelfde groepskoppen die Zoeken gebruikt.

De volledige tekst komt uit de platte-markdowntwin die elke documentatiepagina publiceert op `/info/<slug>.md`, en die twins zijn alleen in het Engels. In een andere taal - en op de handvol pagina's die niet uit markdown zijn gebouwd - valt het antwoord terug op het korte uittreksel in de zoekindex in plaats van het hele gedeelte. De bronvermelding en de link **Open in docs** zijn er in beide gevallen, en wijzen naar de pagina in je eigen taal.

## Waar het woont

De route is `#/ask`. Ze heeft geen tabblad en geen tegel in het Utilities-raster; de ingangen zijn de zoekbalk en het adres zelf.

- <!--i:search--> **Vanuit zoeken.** Elk resultaatpaneel heeft helemaal onderaan een rij **Ask Lolly: *your query***, onder de concrete treffers die de andere groepen vonden. Ze geeft de vraag door als `#/ask?q=…`, en de weergave stelt de vraag eenmaal bij aankomst. De doorgegeven woorden komen aan in kleine letters en zonder leestekens, dus verfijn ze in het vraagveld als dat nodig is.
- <!--i:link--> **Vanuit een link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` opent de weergave met die vraag al gesteld. De hash is alleen de startwaarde: vragen die je daarna typt worden ter plekke beantwoord en herschrijven het adres nooit.

De zoekbalk stapt opzij binnen deze weergave, omdat het vraagveld Enter gebruikt, en de terugknop brengt je terug naar waar je vandaan kwam.

De antwoorden op het scherm blijven voor deze sessie: ze staan er nog als je wegnavigeert en terugkomt, en een herlaad wist ze. Er wordt niets in opslag geschreven, dus er is geen geschiedenis om te beheren.

## Offline

Antwoorden worden samengesteld uit twee statische bestanden die de documentatiesite al publiceert: de zoekindex per taal en de markdowntwin van de pagina. Beide worden bij naam opgehaald, dus Ask blijft zonder verbinding werken zodra ze in de cache staan. Gidsen in de app lezen zet ze onderweg in de cache, en **Guides & docs** onder [Available offline](/info/dashboard.html#available-offline) neemt de hele site, screenshots inbegrepen, in één download.

Zonder die bestanden verschijnt de documentatiehelft van een antwoord eenvoudig niet, zonder fout. De rijen in de app doen dat wel, omdat die worden gematcht met gegevens die al op het apparaat staan.

## Privacy

Je vraag verlaat het apparaat nooit. De matching draait lokaal tegen bestanden die bij naam worden opgehaald, dus wat je typte maakt geen deel uit van een verzoek; er is geen server die het ziet, geen account waaraan het hangt en geen record ervan nadat je herlaadt. Zie het [Privacybeleid](/info/privacy.html) voor de volledige lijst van wat de app ooit ophaalt of verstuurt.

---

**Zie ook:** [Zoeken](/info/search.html) voor de balk die vragen doorgeeft. [Lolly gebruiken](/info/using.html) voor de rest van de app. [Settings](/info/dashboard.html#available-offline) om de documentatie eerst offline te nemen.
