# Lolly gebruiken bij je organisatie

Je organisatie kan een eigen Lolly draaien: dezelfde app, met de tools en design systems die zij koos. Deze pagina laat zien hoe je erbij komt, hoe je aanmeldt en wat er verandert zodra je dat doet.

::: note Wat je van je organisatie nodig hebt
Het webadres van de Lolly van je organisatie, of een `.lolly`-instelbestand dat je organisatie heeft gemaakt. lolly.tools zelf maakt geen verbinding met een organisatie.
:::

## In een browser

Open het adres dat je organisatie je gaf. Als de pagina vraagt om aan te melden, druk dan op **Sign in** en volg de aanmeldpagina die opent. Daarna werkt het als elke Lolly, met de tools en design systems van je organisatie.

Je kunt ook beginnen vanaf lolly.tools: open **Settings**, druk op de kaart **Lolly instance** op **Open a workspace**, voer het adres in en druk op **Open this instance**. De browser gaat naar het eigen adres van je organisatie, omdat een browser de tools van een andere Lolly niet vanaf lolly.tools kan laden.

![De kaart Lolly instance in Settings, waar je de werkruimte van je organisatie opent of wijzigt waar de app zijn tools vandaan haalt](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## In de desktop- of mobiele app

De app start met de meegeleverde tools. Om te verbinden open je **Settings** en druk je op de kaart **Lolly instance** op **Change**. Het venster vraagt **Where should Lolly get its tools?**

1. Kies **Verbinden met een Lolly-instantie**.
2. Voer het webadres van je organisatie in en druk op **Controleren en verbinden**.
3. Druk op **Deze instantie gebruiken**. Het volgende scherm, **Importeer je gegevens (optioneel)**, brengt opgeslagen werk over vanuit een Lolly-back-up; druk op **Overslaan** als je die niet hebt.
4. Meld je aan als de app daarom vraagt.

Tools van een verbonden instantie draaien met hetzelfde vertrouwen als die van de app zelf, dus verbind alleen met een instantie die je vertrouwt. Je organisatie kan je in plaats daarvan een `.lolly`-instelbestand sturen dat de app voor je verbindt.

Om later te wisselen gebruik je opnieuw **Change**, of **Leave** op dezelfde kaart.

### Aanmelden met een code

In de desktop- en mobiele apps biedt het aanmeldscherm ook een korte code, wanneer de Lolly van je organisatie aanmelden met een code ondersteunt. Druk op **Open sign-in in browser**, meld je aan en keur de code daar goed. Of open het adres dat getoond wordt op een telefoon of computer waarop je al bent aangemeld, en voer de code in. De code is ongeveer tien minuten geldig.

## Wat daar anders is

- **Sommige bedieningselementen zijn voor je ingesteld.** Een element dat je organisatie beheert toont **Managed by** en de naam van de organisatie, of **Managed by your organisation**. Een vast element kan niet worden gewijzigd, een menu kan maar een deel van zijn keuzes bieden, en een regel die begint met **Set by** kan zeggen welke regel van toepassing is en waarom. Sommige elementen worden helemaal niet getoond.
- **Sommige design systems zijn vergrendeld.** Een design system dat je organisatie levert toont een slot en blijft alleen-lezen. Om wijzigingen te proberen, maak je een bewerkbare kopie in **Settings → Preferences → Design systems**.
- **Alleen de tools van de organisatie staan in de lijst.** Een tool die je organisatie niet aanbiedt, wordt helemaal niet getoond.
- **Gedeelde projecten.** Als je organisatie projecten met je deelt, toont **Projects** een tegel **Team projects**. Deze sessies staan op de server van de organisatie. Open er een om eraan te werken, of start vanuit **Share** een [werkcollab](/info/collaborate.html#work-collabs-with-lolly-work-optional) wanneer dat beschikbaar is.
- **Sommige exports hebben mogelijk goedkeuring nodig.** Waar je organisatie om goedkeuring vraagt, komt **Request approval** in de plaats van **Download**, en een tool kan minder formaten bieden.

### Wat waar blijft

::: cols
## Op dit apparaat

- Je eigen opslagen, tenzij je [Sync](/info/sync.html) aanzet
- Design systems die je zelf maakte
- Alles wat je maakt en downloadt

## Op de server van je organisatie

- Je aanmeldidentiteit en apparaatgegevens
- Teamprojecten, gedeelde sessies en live bewerkingen in een werkcollab
- Assets die je uploadt naar de gedeelde bibliotheek
- Goedkeuringsverzoeken en goedgekeurde bezorgingen
- Gebruiksgebeurtenissen, waar je organisatie ze aanzet
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) noemt wat de server opslaat en wie die gegevens beheert.

## Wat Lolly Work toevoegt

De server van je organisatie draait **Lolly Work**, de organisatiesoftware van hetzelfde open-sourceproject. De app heeft geen werkaccount en geen Lolly Work nodig wanneer je haar zelfstandig gebruikt.

::: details Wat Lolly Work kan toevoegen
Je organisatie host [Lolly Work](https://github.com/lolly-tools/lolly-work) naast Lolly en kiest welke functies ze aanzet:

- **Aanmelden en toegang.** Single sign-on van de organisatie, groepsgebaseerde rechten en beheerde profielvelden. Beheerders kunnen accounts via SCIM aanmaken en deactiveren.
- **Gedeeld werk.** Teamprojecten, gedeelde sessies en [werkcollabs](/info/collaborate.html#work-collabs-with-lolly-work-optional), met live bewerken via de server van de organisatie.
- **Een gedeelde assetbibliotheek.** Geüploade assets, collecties en gekoppelde bibliotheken, met toegangsregels, versies en review.
- **Review en bezorging.** Goedkeuringsstappen, beheerde links met verloop of intrekking, en bezorging naar bestemmingen die de organisatie toestaat.
- **Beheer.** Gebruiksrapportage onder het telemetriebeleid van de instantie, plus een auditrecord van beheerde acties.

Als je de dienst opzet, begin dan met [Deployment](/info/deployment.html#organisation-services-with-lolly-work). De openbare demo op [lolly.work](https://lolly.work) is een sandbox; gebruik het eigen adres van je organisatie voor werk dat je wilt bewaren.
:::

## Verlaten

**Leave**, op de kaart **Lolly instance** in **Settings**, verwijdert het design system, de tools en de catalogus van je organisatie. Je eigen werk blijft. Alles wat je met haar tools maakte, opent pas weer nadat je opnieuw verbindt.

Alles wat je bij de organisatie opsloeg, blijft bij de organisatie, onder haar toegangs- en bewaarbeleid. Weggaan of dit apparaat wissen verwijdert die serverkopie niet. In een browser op het eigen adres van je organisatie valt er niets te verlaten: open in plaats daarvan een ander adres.

## Wie je kunt vragen

Wat de server van je organisatie bereikt, wie de gedeelde projecten ervan kan zien en welke instellingen vast staan, zijn beslissingen van je organisatie. Vraag het aan wie de Lolly van je organisatie beheert. [Privacybeleid](/info/privacy.html) behandelt wat Lolly zelf met je gegevens doet.
