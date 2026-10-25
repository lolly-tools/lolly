# Hoe Lolly zich verhoudt

Lolly bestaat uit twee delen van één open-sourceproject. **Lolly** is de engine, apps en tools om op je apparaat te maken, bewerken, omzetten en exporteren, zonder account. **Lolly Work** is de organisatieserver, op je eigen infrastructuur gedraaid, voor aanmelden, gedeelde projecten, goedkeuringen en serverrendering. Beide zijn MPL-2.0. Deze pagina vergelijkt het paar met de andere manieren waarop mensen bestanden ontwerpen, besturen en produceren.

## De tools van vandaag

Elke ring scoort hoe volledig een productklasse een capability levert, waarbij elke klasse op zijn beste vertegenwoordiger wordt gescoord. De kolom Lolly dekt Lolly en Lolly Work samen, en elke rij zegt welk deel wat levert. Open een rijnaam voor de redenering achter zijn score. Kolommen zijn gesorteerd op de rij Overall completeness bovenaan: het gemiddelde van de gescoorde rijen, met de uitgavenrij uitgesloten.

::: figure positioning-comparison
Capabilityvergelijking: concurrentieonderzoek en scores van augustus 2026; dekking van Lolly + Lolly Work beoordeeld op 28 september 2026. Scoring: 0 afwezig, 25 noodoplossing, 50 echt maar afgeschermd of gedeeltelijk, 75 sterk met kanttekeningen, 100 kerncompetentie.
:::

::: details Scoringsnotities
Beschikbare functies en productierijpheid zijn gescheiden. Lolly is uitgebracht: versie 1.0 verscheen als open source op 30 augustus 2026, de beveiliging is nog niet onafhankelijk geaudit en het bewijs van adoptie is enkele maanden oud ([Adoption & Governance](/info/adoption-governance.html#status) bevat de huidige stand). Single sign-on, goedkeuringen of serverrendering hebben stelt geen productietrackrecord vast, dus de volwassenheidsscore weerspiegelt dat. De scores van concurrenten behouden hun gedateerde review van augustus.

Eén regel beheerst het bord. Volle punten (100), bij rijen die je inhoud of identiteit raken, vereisen een capability die je kunt gebruiken zonder account en zonder cloudvoorwaarde; rijen over het product zelf, zoals volwassenheid en gebruiksgemak, zijn uitgezonderd. Die regel kost Adobe punten bij Content Credentials: de breedste geleverde implementatie (Photoshop, Lightroom, Premiere, Firefly) ondertekent lokaal en in de cloud, maar nooit zonder Adobe-account en -identiteit, dus 75. Ze begrenst de render-API's bij massageneratie en automatisering om dezelfde reden.

Canva wordt per rij gescoord op zijn beste familielid, aangezien het Affinity en Cavalry bezit (beide in oktober 2025 weggegeven). Offline en rendering op het apparaat scoren 75 via Affinity, een desktopsuite die nog steeds een geverifieerd account nodig heeft en telemetrie bevat, de aftrek die Adobe ook krijgt; de eigen offlinemodus van Canva bewerkt alleen vooraf gesynchroniseerde ontwerpen, op één apparaat, voor een beperkte periode. Autofill scoort 50: het is echt maar Enterprise-afgeschermd en asynchroon, en vult alleen tekst en afbeeldingen. De massageneratie van Figma steeg van 25 naar 50 toen Buzz spreadsheetvulling uitbracht (een gratis bèta, augustus 2026).

De Content Credentials-score van 75 van Lolly dekt ondertekening op het apparaat en serverondertekening door Lolly Work met een geconfigureerde organisatie-identiteit; een verificator moet de ondertekenaar nog steeds vertrouwen ([Content Credentials Identity](/info/content-credentials-identity.html)). De 50 van Penpot komt via de eigen exportplug-in van Lolly voor Penpot: dezelfde engine-ondertekening, opt-in en bekendgemaakt als van Lolly. Penpot scoort 90 op rendering op het apparaat: een browsercanvas met een opslagdoel op zijn server, die zelf gehost kan worden. Cloudinary krijgt een eigen kolom voor zijn assetbibliotheek, transformatie-API en CDN; de review van augustus gaf zijn bezorgondertekening 50.

De live samenwerking van Lolly omvat directe privécollabs tussen twee apparaten en geauthenticeerde werkcollabs via Lolly Work, met gedeelde bewerkingen, cursors en opgeslagen teamsessies. De score Partial weerspiegelt de huidige work-implementatie met één node en korte operationele geschiedenis, niet de afwezigheid van teambewerking. Prijsschattingen zijn gedateerde rekenvoorbeelden op basis van catalogusprijzen voor de orde van grootte, geen inkoop.
:::

## Wanneer je naar Lolly grijpt

::: cols
## Grijp naar Lolly wanneer

- Hetzelfde soort bestand telkens opnieuw nodig is: evenementtegels, badges, certificaten, meldingen, socialmediakaarten
- Veel bestanden uit één sjabloon en een tabel met waarden komen, in [Batch](/info/batch.html#make-many-versions-of-one-design) of de CLI
- De kleuren, typografie en assets binnen het design system moeten blijven, zelfs op een open canvas
- Een afgerond Figma-, Penpot-, Illustrator-, InDesign- of PDF-ontwerp bewerkbaar en herhaalbaar moet worden ([Een ontwerp importeren](/info/design-import.html))
- De bestanden op je eigen apparaten of servers moeten worden gemaakt

## Grijp naar iets anders wanneer

- Het werk gedetailleerde fotoretouchering of illustratie is
- Je een applicatie-interface ontwerpt en prototypet
- Je op dag één een grote voorraad en sjabloonbibliotheek nodig hebt
- Je een beheerde dienst met een lang trackrecord op schaal nodig hebt
:::

Geïmporteerde ontwerpen en gedeelde designtokens laten een team Lolly combineren met gespecialiseerde applicaties, terwijl Lolly Work gedeelde assets, review en bezorging beheert.

Een heel diadeck toont het plafond: in **Markdown Slides** wordt een deck als gegevens gedeclareerd, live opgemaakt en geëxporteerd als een native, bewerkbaar PowerPoint-bestand.

![Markdown Slides in de gesplitste weergave: de dia's van het deck als blokken links opgesomd, het opgemaakte deck rechts gerenderd](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## De regels zitten in de tool

Lolly zet herbruikbare merkregels in de tool: kleuren, lettertypen, afloopmarges, tussenruimte en toegestane inputs. Het sjabloon legt de delen vast die een ontvanger niet mag wijzigen. Lolly Work voegt groepstoegang en inputbeleid rond dat sjabloon toe, met goedkeuringsketens voor catalogusinzendingen en bezorging.

Een tool één keer controleren maakt herhaalbare productie makkelijker, omdat elke uitvoer zijn lay-outregels erft. Tekst, geüploade beelden en gebruiksrechten kunnen nog controle nodig hebben, en Lolly Work levert daarvoor gedeelde catalogi en goedkeuringsstappen. Voor het creatieve team is de tool een vangrail: je brengt nog steeds de gegevens, de tekst en de afbeelding, en de tool houdt elk resultaat on-brand.

![De hele taak van de producent: de woorden typen. Typografie, kleur en tussenruimte zijn vastgelegd toen de tool werd gemaakt](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Drie andere dingen onderscheiden deze aanpak:

- **Het eindbestand, uit inputs.** Invoer erin, afgerond bestand eruit, zonder "sla het nu op vanuit je ontwerptool en werk het bij".
- **Tools componeren tools.** Eén tool kan de render van een andere tool insluiten in één afgerond bestand, zonder codekoppeling ertussen.
- **Open tot op de bodem.** De engine is open source, en tools, assets en designtokens zijn bestanden die je in versiebeheer kunt houden of in Lolly Work kunt beheren, geen rijen in de database van iemand anders.

Gedurfd ontwerp overleeft de vangrails. Deze stadskaart van postkwaliteit bestaat uit echte vectorpaden voor wegen en water, vanuit een keuzelijst en twee kleurvelden die niet buiten het design system kunnen worden gericht:

![De grachtengordel en het wegennet van Amsterdam van rand tot rand getekend in de eigen inkt van het design system, elke lijn geplaatst door het sjabloon in plaats van met de hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innoveer probabilistisch, schaal deterministisch

De meeste pitches voor "AI creative" zetten het model aan de verkeerde kant van een oude scheidslijn. Kopiisten en verluchters bepaalden waar die loopt. Je werkt los aan de schets, waar alles kan worden geprobeerd en niets wordt vastgelegd. Dan ga je naar de drukpers, die wel vastlegt. In de schetsen zat de kunst, en de pers was hoe ze reisde, en het gedrukte werk kon worden vertrouwd omdat de pers bij elke afdruk zijn belofte hield.

Lolly is de pers. Breng wat je wilt naar de ideeën, een model, een ontwerper of een ruwe tekening, maar op het moment dat een idee veel bestanden moet worden, gaat het door iets dat elke keer op dezelfde manier rendert, uit inputs die iedereen kan teruglezen. De vergelijking hierboven gaat eigenlijk over wie die vastgelegde stap herhaalbaar maakt.

> Vertrouw het creatieve proces, schaal met precisie.

## Voor altijd gratis

**Als het op je apparaat rendert, is het voor altijd gratis.** De engine, de shells, de tools en de formaten zijn open source, en een uitgebrachte versie kan niet worden teruggenomen. Lolly Work is ook open source. Een organisatie betaalt voor de infrastructuur en het beheer die ze kiest, zonder softwarelicentiekosten per gebruiker of per render voor zelf hosten. [Vragen en antwoorden](/info/faq.html) vertelt het verhaal achter de belofte.

## Waar je inhoud staat

Het creatieve werk van Lolly kan draaien op hardware die jij bezit, en de designtokens, lettertypen, logo's en tools zijn bestanden die je kunt houden. Met Lolly Work staan gedeelde projecten, assets, beleid en auditrecords in opslag die je organisatie configureert. [Vertrouwen](/info/trust.html) legt uit waarom dat ertoe doet, en het [Privacybeleid](/info/privacy.html) en [Verify It Yourself](/info/verify-yourself.html) laten je de bewering controleren in plaats van ons op ons woord te geloven.

## Tool voor tool

[Lolly vergeleken, tool voor tool](/info/compare.html) vergelijkt Lolly met Canva, Adobe, Figma, Penpot, merkportalen, render-API's en online converters, één pagina elk, en zet uiteen [wat waar draait](/info/compare.html#what-runs-where).
