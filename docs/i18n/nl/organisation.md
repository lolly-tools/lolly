# Lolly gebruiken in je organisatie

Je organisatie kan een eigen Lolly draaien: dezelfde app, met de tools en design systems die ze heeft gekozen. Lees hoe je die bereikt, je aanmeldt en wat er verandert.

Om de inrichting van je organisatie te plannen, legt [Lolly gebruiken met je bestaande DAM](/info/use-with-dam.html) uit hoe een goedgekeurde bibliotheek kan blijven bestaan terwijl mensen content maken in Lolly. [Contentsoevereiniteit](/info/content-sovereignty.html) beschrijft de bredere zeggenschap over creatie, beheer, opslag en overdraagbaarheid.

::: note Wat je van je organisatie nodig hebt
Het webadres van haar Lolly of een `.lolly`-configuratiebestand dat je organisatie heeft gemaakt. lolly.tools op zichzelf maakt geen verbinding met een organisatie.
:::

<!--i:eti-globe-->
## In een browser

Open het adres dat je organisatie je heeft gegeven. Vraagt de pagina je om je aan te melden, druk dan op **Sign in** en volg de aanmeldpagina die wordt geopend. Daarna werkt Lolly zoals je gewend bent, met de tools en design systems van je organisatie.

Je kunt ook beginnen op lolly.tools: open de weergave **Settings**, druk op **Open a workspace** op de kaart **Lolly instance**, voer het adres in en druk op **Open this instance**. De browser gaat naar het eigen adres van je organisatie, omdat een browser de tools van een andere Lolly niet vanuit lolly.tools kan laden.

![De kaart Lolly instance in Settings, waar je de werkruimte van je organisatie opent of wijzigt waar de app zijn tools vandaan haalt](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## In de desktop- of mobiele app

De app start met de meegeleverde tools. Om verbinding te maken, open je de weergave **Settings** en druk je op **Change** op de kaart **Lolly instance**. Het paneel vraagt **Where should Lolly get its tools?**

1. Kies **Connect to a Lolly instance**.
2. Voer het webadres van je organisatie in en druk op **Check & connect**.
3. Druk op **Use this instance**. Het volgende scherm, **Import your data (optional)**, zet opgeslagen werk over vanuit een Lolly-back-up. Druk op **Skip** als je die niet hebt.
4. Meld je aan als de app daarom vraagt.

Tools van een gekoppelde instantie draaien met hetzelfde vertrouwen als de eigen tools van de app, dus maak alleen verbinding met een instantie die je vertrouwt. Je organisatie kan je ook een `.lolly`-configuratiebestand sturen dat de app voor je verbindt.

Gebruik later opnieuw **Change** of **Leave** op dezelfde kaart om te wisselen.

### Aanmelden met een code

In de desktop- en mobiele apps biedt het aanmeldscherm ook een korte code als de Lolly van je organisatie aanmelden met een code ondersteunt. Druk op **Open sign-in in browser**, meld je aan en keur daar de code goed. Of open het adres dat op het scherm staat op een telefoon of computer waar je al bent aangemeld en voer de code in. De code is ongeveer tien minuten geldig.

<!--i:eti-sliders-->
## Wat daar anders is

- **Sommige instellingen worden voor je bepaald.** Een instelling die je organisatie beheert, toont **Managed by** met de naam van de organisatie of **Managed by your organisation**. Een vastgezette instelling kun je niet wijzigen en een menu biedt mogelijk maar een deel van de keuzes. Sommige bedieningselementen zijn verborgen. De console van je organisatie legt vast welke regel een instelling vastzet en waarom. Vraag het aan degene die de Lolly van je organisatie beheert.
- **Sommige design systems zijn vergrendeld.** Een design system van je organisatie toont een slotje en blijft alleen-lezen. Maak een bewerkbare kopie in **Settings → Preferences → Design systems** om wijzigingen uit te proberen.
- **Alleen haar tools staan in de lijst.** Een tool die je organisatie niet aanbiedt, wordt niet getoond.
- **Gedeelde projecten.** Als je organisatie projecten met je deelt, toont **Projects** een tegel **Team projects**. Deze sessies staan op de server van de organisatie. Open er een om eraan te werken of start een [werksamenwerking](/info/collaborate.html#collabs-through-lolly-work-optional) via **Share** wanneer dat beschikbaar is.
- **Voor sommige exports kan goedkeuring nodig zijn.** Waar je organisatie goedkeuring vereist, vervangt **Request approval** de knop **Download** en biedt een tool mogelijk minder formaten.
- **Je startscherm kan sjablonen tonen.** Als je organisatie sjablonen voor je publiceert, bijvoorbeeld voor een partnerbedrijf, opent je startscherm met die sjablonen in plaats van de begroeting bij je eerste bezoek. Elk sjabloon is één kaart, met **Your copy** om verder te werken en **New version** wanneer het sjabloon verandert. Zie [Partnersjablonen](/info/work-partner-templates.html).

### Wat waar blijft

::: cols
## Op dit apparaat

- Je eigen opgeslagen werk, tenzij je [Sync](/info/sync.html) inschakelt
- Design systems die je zelf hebt gemaakt
- Alles wat je maakt en downloadt

## Op de server van je organisatie

- Je aanmeldidentiteit en apparaatgegevens
- Teamprojecten, gedeelde sessies en live bewerkingen in een werksamenwerking
- Assets die je naar de gedeelde bibliotheek uploadt
- Goedkeuringsverzoeken en goedgekeurde bezorgingen
- Een logboek van je aanmeldingen en wat je daar doet
:::

Als een werkruimte is gekoppeld, vermeldt de privacyregel op het eerste scherm van de app hetzelfde. De eigen apps van Lolly sturen geen gebruiksgebeurtenissen naar de werkruimte. [Privacy](/info/privacy.html#organisation-services-with-lolly-work) vermeldt wat de server opslaat en wie over die gegevens beslist.

<!--i:eti-building-->
## Wat Lolly Work toevoegt

Op de server van je organisatie draait **Lolly Work**, de organisatiesoftware van hetzelfde opensourceproject. Als je de app zelfstandig gebruikt, heb je geen werkaccount of Lolly Work nodig.

::: details Wat Lolly Work kan toevoegen
Je organisatie host [Lolly Work](https://github.com/lolly-tools/lolly-work) naast Lolly en kiest welke functies ze inschakelt:

- **Aanmelden en toegang.** Single sign-on voor de organisatie, groepsgebonden rechten en beheerde profielvelden. Beheerders kunnen via SCIM accounts aanmaken en deactiveren.
- **Gedeeld werk.** Teamprojecten, gedeelde sessies en [werksamenwerkingen](/info/collaborate.html#collabs-through-lolly-work-optional), met live bewerking via de server van de organisatie.
- **Een gedeelde assetbibliotheek.** Geüploade assets, collecties en gekoppelde bibliotheken, met toegangsregels, versies en beoordeling.
- **Beoordeling en bezorging.** Goedkeuringsstappen, beheerde links die verlopen of worden ingetrokken en bezorging naar bestemmingen die de organisatie toestaat.
- **Beheer.** Een auditrecord van handelingen die onder beleid vallen en gebruiksrapportage volgens het telemetriebeleid van de instantie voor clients die gebruiksgebeurtenissen versturen. De eigen apps van Lolly versturen die momenteel niet.
:::

Begin bij [Uitrollen](/info/deployment.html#organisation-services-with-lolly-work) om de dienst in te richten. De openbare demo op [lolly.work](https://lolly.work) is een sandbox. Gebruik het eigen adres van je organisatie voor werk dat je wilt bewaren.

<!--i:eti-palette-->
## Het merk van een andere organisatie

Een partner, klant of sponsor kan je het merk als design-systembestand (`.lolly`) sturen in plaats van een adres. Het openen van dat bestand maakt geen enkele verbinding vanuit de app. Het bestand voegt het design system van die organisatie toe naast je eigen design system op dit apparaat. Een configuratiebestand van je eigen organisatie verbindt de app met de Lolly van de organisatie. Voordat er iets verandert, laat het voorbeeld zien wat het openen van een bestand zal doen. [Met partners werken](/info/partners.html) behandelt beide kanten van werken in het merk van een andere organisatie.

<!--i:eti-unlink-->
## Verlaten

**Leave**, op de kaart **Lolly instance** in **Settings**, verwijdert het design system, de tools en de catalogus van je organisatie. Je eigen werk blijft bewaard. Alles wat je met haar tools hebt gemaakt, kun je pas weer openen nadat je opnieuw verbinding hebt gemaakt. Als de Lolly van je organisatie het aanbiedt, beëindigt **Sign out everywhere** op dezelfde kaart je sessies op elk apparaat, ook dit apparaat.

Alles wat je bij de organisatie hebt opgeslagen, blijft daar onder haar toegangs- en bewaarbeleid. De instantie verlaten of dit apparaat wissen verwijdert die serverkopie niet. In een browser op het eigen adres van je organisatie valt er niets te verlaten: open dan een ander adres.

<!--i:eti-help-->
## Bij wie je terechtkunt

Je organisatie bepaalt wat haar server bereikt, wie haar gedeelde projecten kan zien en welke instellingen vaststaan. Vraag het aan degene die de Lolly van je organisatie beheert. [Privacy](/info/privacy.html) beschrijft wat Lolly zelf met je gegevens doet.
