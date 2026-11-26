# Hoe Lolly zich verhoudt

Lolly maakt bestanden in je huisstijl op je eigen apparaat, zonder account. **Lolly Work** is de server voor teams: aanmelden, gedeelde projecten, goedkeuringen en renderen op de server, op machines die je organisatie beheert. Beide zijn open source onder MPL-2.0.

De meeste teams houden de tools die ze hebben. Een ontwerpapp levert de ontwerpen, een DAM blijft de gezaghebbende bron en Lolly zet goedgekeurde invoer om in afgewerkte bestanden. [Gebruik Lolly met je bestaande DAM](/info/use-with-dam.html) beschrijft die combinatie. Het idee achter de combinatie is [soevereiniteit over inhoud](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## De tools van nu

Elke ring laat zien hoe volledig een productcategorie aan één behoefte voldoet. Druk op een **?** naast een rij om het bewijs te zien, en op de **?** naast de legenda om te zien hoe de scores werken.

::: figure positioning-comparison
Vergelijking van mogelijkheden. Concurrentieonderzoek op basis van leveranciersdocumenten, augustus tot 21 november 2026. Lolly en Lolly Work beoordeeld op 21 november 2026. Scores: 0 afwezig, 25 omweg, 50 aanwezig maar beperkt toegankelijk of gedeeltelijk, 75 sterk met kanttekeningen, 100 kerncompetentie.
:::

::: details Bronnen voor de scores die in november 2026 veranderden
- Canva: [API-wijzigingslog](https://www.canva.dev/docs/apps/rest-apis/changelog/), [service-apps](https://www.canva.dev/blog/developers/canva-service-accounts/), [hulp bij Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [InDesign API-wijzigingslog](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [Adobe Express-prijzen](https://www.adobe.com/express/pricing)
- Figma: [agent- en AI-credits](https://help.figma.com/hc/en-us/articles/42614902212887), [MCP-server](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify en Bynder: [Frontify-releasenotitie van oktober 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear en Placid: [Bannerbear-prijzen](https://www.bannerbear.com/pricing/), [Bannerbear-wijzigingslog](https://www.bannerbear.com/changelog/), [Placid-prijzen](https://placid.app/pricing)
- Penpot: [prijzen voor zelfhosting](https://penpot.app/pricing/self-host), [releases](https://github.com/penpot/penpot/releases)
- Cloudinary: [herkomst van inhoud](https://cloudinary.com/documentation/content_provenance_and_authenticity), [prijzen](https://cloudinary.com/pricing)
:::

Functies en staat van dienst staan in afzonderlijke rijen. De eerste openbare release van Lolly was 1.0.1 op 30 augustus 2026, de beveiliging heeft nog geen onafhankelijke audit gehad en het bewijs van adoptie is een paar maanden oud. [Adoptie & governance](/info/adoption-governance.html#status) beschrijft de huidige stand.

<!--i:eti-hammer-->
## Wanneer je voor Lolly kiest

::: cols
## Kies voor Lolly als

- Je steeds hetzelfde soort bestand nodig hebt: evenementtegels, badges, certificaten, waarschuwingen, socialmediakaarten
- Veel bestanden uit één sjabloon en een tabel met waarden komen, in [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) of de CLI
- De kleuren, typografie en assets binnen het design system moeten blijven, ook op een vrij canvas
- Een afgerond ontwerp uit Figma, Penpot, Illustrator, InDesign, Affinity of PDF bewerkbaar en herhaalbaar moet worden ([Een ontwerp importeren](/info/design-import.html))
- De bestanden op je eigen apparaten of servers moeten worden gemaakt

## Kies iets anders als

- Het werk gedetailleerde fotoretouche of illustratie is
- Je een applicatie-interface ontwerpt en er prototypes van maakt
- Je vanaf dag één een grote bibliotheek met stockmateriaal en sjablonen nodig hebt
- Je een beheerde dienst nodig hebt met een lange staat van dienst op grote schaal
:::

Met geïmporteerde ontwerpen en gedeelde designtokens kan een team Lolly combineren met gespecialiseerde applicaties, terwijl Lolly Work gedeelde assets, beoordeling en bezorging beheert.

Voor teams met een zorgvuldig beheerd DAM begin je met het behouden van die bibliotheek en haar beheerders. [De ervaring van SUSE met Brandfolder](/info/suse-brandfolder.html) legt vast hoe integratie de adoptie en het veranderbeheer rond goedkeuringen ondersteunde. DAM-leveranciers en implementatiepartners kunnen dezelfde opzet beoordelen via [de partnerworkflow](/info/dam-partners.html).

In **Lolly Markdown Slides** wordt een heel deck geschreven als data, live opgemaakt en geëxporteerd als een native, bewerkbaar PowerPoint-bestand.

![Lolly Markdown Slides in de gesplitste weergave: de dia's van het deck links als blokken, de render van het opgemaakte deck rechts](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## De regels zitten in de tool

Lolly legt herbruikbare huisstijlregels vast in de tool: kleuren, lettertypen, afloopmarges, tussenruimte en toegestane invoer. Het sjabloon zet de onderdelen vast die een ontvanger niet mag veranderen. Lolly Work voegt groepstoegang en invoerbeleid toe rond dat sjabloon, met goedkeuringsketens voor catalogusinzendingen en bezorging.

Een tool één keer controleren maakt herhaalbare productie makkelijker, omdat elke uitvoer de lay-outregels ervan erft. Tekst, geüpload beeldmateriaal en gebruiksrechten kunnen nog steeds controle nodig hebben, en Lolly Work biedt daarvoor gedeelde catalogi en goedkeuringsstappen. Voor het creatieve team is de tool een vangrail: je levert nog steeds de data, de tekst en de afbeelding, en de tool houdt elk resultaat binnen de huisstijl.

![De hele taak van de maker: de woorden typen. Typografie, kleur en tussenruimte zijn vastgelegd toen de tool werd gemaakt](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Nog drie verschillen:

- **Het uiteindelijke bestand, uit invoer.** Invoer erin, afgewerkt bestand eruit, zonder "sla het nu op vanuit je ontwerptool en werk het bij".
- **Tools combineren tools.** Eén tool kan de render van een andere tool insluiten in één afgewerkt bestand, zonder codekoppeling tussen beide.
- **Open source.** De engine is open source, en tools, assets en designtokens zijn bestanden die je in versiebeheer kunt bewaren of in Lolly Work kunt beheren, geen rijen in de database van iemand anders.

Avontuurlijk ontwerp blijft mogelijk binnen de vangrails. Deze stadskaart op posterkwaliteit bestaat uit echte vectorpaden voor wegen en water, vanuit een keuzelijst en twee kleurvelden die niet buiten het design system kunnen worden ingesteld:

![De Amsterdamse grachtengordel en het wegennet van rand tot rand getekend in de eigen inkt van het design system, elke lijn geplaatst door het sjabloon in plaats van met de hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Innoveer probabilistisch, schaal deterministisch

De meeste verkooppraatjes over "AI-creativiteit" plaatsen het model aan de verkeerde kant van een oude grens. Kopiisten en verluchters bepaalden waar die ligt. Je werkt vrij aan de schets, waar je alles kunt proberen en niets vaststaat. Daarna ga je naar de drukpers, die het vastlegt. In de schetsen zat de kunst, en de pers zorgde voor de verspreiding, en het gedrukte werk was te vertrouwen omdat de pers bij elke afdruk haar belofte hield.

Lolly is de pers. Gebruik voor de ideeën wat je wilt, een model, een ontwerper of een ruwe tekening, maar zodra een idee veel bestanden moet worden, gaat het door iets dat elke keer op dezelfde manier rendert, vanuit invoer die iedereen kan teruglezen. De vergelijking hierboven gaat eigenlijk over wie die definitieve stap herhaalbaar maakt.

> Vertrouw op het creatieve proces, schaal met precisie.

<!--i:eti-tag-->
## Voor altijd gratis

**Als het op je apparaat rendert, is het voor altijd gratis.** De engine, de shells, de tools en de formaten zijn open source, en een uitgebrachte versie kan niet worden teruggenomen. Lolly Work is ook open source. Een organisatie betaalt voor de infrastructuur en het beheer die ze kiest, zonder softwarelicentiekosten per gebruiker of per render bij zelfhosting. [Vragen & antwoorden](/info/faq.html) vertelt het verhaal achter de belofte.

<!--i:eti-map-pin-->
## Waar je inhoud staat

Het creatieve werk van Lolly kan draaien op hardware die je bezit, en de designtokens, lettertypen, logo's en tools zijn bestanden die je kunt bewaren. Met Lolly Work staan gedeelde projecten, assets, beleid en auditrecords in opslag die je organisatie configureert. [Vertrouwen](/info/trust.html) legt uit waarom dat ertoe doet, en het [Privacybeleid](/info/privacy.html) en [Controleer het zelf](/info/verify-yourself.html) laten je de claim controleren in plaats van ons op ons woord te geloven.

<!--i:eti-grid-->
## Tool voor tool

[Lolly vergeleken, tool voor tool](/info/compare.html) vergelijkt Lolly met Canva, Adobe, Figma, Penpot, merkportalen, render-API's en online converters, elk op een eigen pagina, en beschrijft [wat waar draait](/info/compare.html#what-runs-where).
