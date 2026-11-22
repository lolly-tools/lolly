# Ask Lolly

Ask Lolly beantwoordt een vraag met de bijpassende sectie uit deze gidsen, woord voor woord geciteerd, met de pagina als bron en een link **Open in docs** naar die sectie. Er wordt niets gegenereerd: het antwoord wordt op je apparaat gevonden en geciteerd.

Onder de geciteerde sectie staan de plekken in de app die bij de vraag passen: een tool, een hulpprogramma, een opgeslagen project, een asset uit de catalogus, een instelling of een pagina van de app. Elke rij navigeert alleen. Niets in een antwoord wijzigt een instelling, opent een bestand of handelt namens jou, dezelfde regel als [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Een vraag stellen

Typ in het vraagveld onderaan de weergave en druk op Enter. Alles korter dan twee tekens wordt genegeerd. Antwoorden stapelen zich boven het veld op, het nieuwste als laatste.

![Ask Lolly, geopend en leeg: het vraagveld onderaan de weergave, met de opmerking dat antwoorden uit de documentatie komen](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Elke vraag staat op zichzelf
Eerdere vragen geven geen context door, dus "en PDF dan?" na een vraag over exporteren wordt gelezen als een vraag over alleen PDF. Stel elke keer de volledige vraag.
:::

Het eerste woord van je vraag bepaalt wat vooraan in het antwoord staat:

| Je begint met | Wat vooraan staat |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | de plekken in de app die overeenkomen |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | de tools die overeenkomen |
| iets anders - inclusief *how do I* en *what is* | de documentatiesectie, die standaard vooraan staat |

Beide helften worden altijd opgehaald, dus een verkeerd begrepen vraag verandert alleen de volgorde van het antwoord.

Bij het zoeken naar overeenkomsten worden veelvoorkomende vraagwoorden weggelaten (*how*, *do*, *I*, *the*, *my*). Een sectie wordt gerangschikt op hoeveel van je andere woorden erin voorkomen en daarna op waar ze overeenkomen: een kop telt zwaarder dan lopende tekst. De vergelijking zoekt op deelstrings en negeert hoofdletters en accenten, dus een typefout wordt niet gecorrigeerd. Als niets overeenkomt, meldt Ask dat en verwijst het naar de documentatie-index.

**Better matching** is optioneel. Na je eerste antwoord kan Ask een klein model voor overeenkomsten aanbieden, met de downloadgrootte erbij. Het model koppelt een vraag aan een gids die andere woorden voor hetzelfde gebruikt. Het wordt alleen gedownload als je akkoord gaat, draait op dit apparaat en verandert alleen welke secties bovenaan staan. Het antwoord blijft uit de eigen woorden van de documentatie bestaan. Je kunt het ook downloaden als **Ask matching model** onder **Settings → Preferences → Available offline** ([Offline beschikbaar](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Wat je terugkrijgt

Een antwoordkaart heeft een vaste volgorde:

1. **De sectie zelf**, gerenderd uit de documentatiebron: alinea's, lijsten, tabellen, code en citaten, met werkende links binnen de app en naar `/info`. Een lange sectie eindigt met **Show more**, dat de rest ter plekke opent. Afbeeldingen worden weggelaten en een link naar een andere site verschijnt als gewone tekst.
2. **De bronvermelding** - *Pagina › Kop* - en de link **Open in docs** naar precies die sectie.
3. **More in the docs** - maximaal vier andere overeenkomende secties, als links.
4. **De rijen binnen de app**, onder dezelfde groepskoppen die Search gebruikt.

De volledige tekst komt uit de Markdown-versie die elke documentatiepagina publiceert op `/info/<slug>.md`. Die versies zijn alleen in het Engels. In een andere taal, en op de weinige pagina's die niet uit Markdown zijn opgebouwd, toont het antwoord in plaats daarvan het korte fragment uit de zoekindex. De bronvermelding en de link **Open in docs** wijzen nog steeds naar de pagina in jouw taal.

<!--i:eti-map-pin-->
## Waar je het vindt

De route is `#/ask`. Er is geen tabblad en geen tegel in het Utilities-raster. Je bereikt de weergave via de zoekbalk of het adres.

- <!--i:search--> **Vanuit zoeken.** Elk resultatenpaneel eindigt met een rij **Ask Lolly: *je zoekopdracht***, onder de resultaten van de andere groepen. De rij opent `#/ask?q=…` en de weergave stelt de vraag eenmaal bij aankomst. De woorden komen aan in kleine letters zonder leestekens, dus pas ze zo nodig aan in het vraagveld.
- <!--i:link--> **Vanuit een link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` opent de weergave met die vraag al gesteld. De hash stelt alleen de eerste vraag in. Vragen die je daarna typt, worden ter plekke beantwoord en veranderen het adres nooit.

De zoekbalk is in deze weergave verborgen omdat het vraagveld Enter gebruikt. De terugpil brengt je terug naar waar je vandaan kwam.

Antwoorden blijven deze sessie bewaard: ze staan er nog als je weggaat en terugkomt, en opnieuw laden wist ze. Er wordt niets naar de opslag geschreven, dus er is geen geschiedenis om te beheren.

<!--i:eti-download-->
## Offline

Antwoorden komen uit twee statische bestanden die de documentatiesite publiceert: de zoekindex per taal en de Markdown-versie van de pagina. Beide worden op naam opgehaald, dus Ask werkt zonder verbinding zodra ze in de cache staan. De gidsen lezen in de app slaat ze op in de cache. **Guides & docs** onder [Offline beschikbaar](/info/dashboard.html#available-offline) haalt de hele site, inclusief schermafbeeldingen, in één download op.

Zonder deze bestanden verschijnt het documentatiedeel van een antwoord niet en wordt er geen fout getoond. De rijen binnen de app verschijnen wel, omdat ze vergelijken met gegevens die al op het apparaat staan.

<!--i:eti-lock-->
## Privacy

Je vraag verlaat het apparaat nooit. Het zoeken naar overeenkomsten gebeurt lokaal met bestanden die op naam zijn opgehaald, dus wat je typt maakt geen deel uit van een verzoek. Geen server ziet je vraag, geen account bevat die en na opnieuw laden blijft er geen registratie over. Het [Privacybeleid](/info/privacy.html) vermeldt alles wat de app ophaalt of verstuurt.

---

**Gerelateerd:** [Lolly Search](/info/search.html) voor de balk die vragen doorgeeft. [Lolly gebruiken](/info/using.html) voor de rest van de app. [Lolly Settings](/info/dashboard.html#available-offline) om de documentatie eerst offline beschikbaar te maken.
