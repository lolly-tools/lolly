# FAQ

Veelgestelde vragen die in de accordeon op de landingspagina `/info` worden getoond.

**Zo houd je dit bij:** elke `##`-kop hieronder is een vraag; alles eronder
(tot aan de volgende `##`) is het antwoord. Antwoorden gebruiken dezelfde lichte markdown als
de rest van de site - scheid alinea's met een lege regel. Voeg hier vragen toe, haal ze weg of
zet ze in een andere volgorde en draai `npm run build:info` (of `npm run dev:web`) opnieuw.
Alles boven de eerste `##` (deze titel en deze notities) wordt door de build genegeerd.

## Wat gebeurt er als ik op de pagina /profile voor opt-in kies?

Als je Lolly voor het eerst gebruikt, is alles wat je waar dan ook typt volledig privé, totdat je die informatie bewust naar buiten wilt brengen via media of een deellink (als je online bent).

Als opt-in aanstaat, worden de profielgegevens die je kiest verzegeld in wat je maakt, met jou als bron erbij vermeld. Er wordt niets meegenomen zonder dat jij het zelf kiest.

Lolly produceert een grote hoeveelheid content. We hanteren een strikte dataminimalisatie om risico te voorkomen.

## Is Lolly "vibe coded"?

Lolly is ontwikkeld met AI-ondersteunde codering, AI-ondersteunde ontdekking en, op veel plekken, AI-ondersteunde inhoud, met behulp van een mix van modellen en leveranciers, waaronder die van toonaangevende public-cloudbedrijven.

Op het moment van schrijven bevat Lolly geen bekende beveiligingskwetsbaarheden in zijn supply chain, en zet zich in voor snelle beveiligingsreacties zodra er CVE's opduiken.

Een mens heeft de architectuur gemaakt, de code met intentie samengesteld en de ervaring artistiek geregisseerd.

Belangrijker nog: Lolly staat op de schouders van decennia aan opensource-innovatie van echte experts wereldwijd.

Er bestaat een deterministische build-gate in de codebase van Lolly om code en documentatie begrijpelijk te houden voor de gemiddelde lezer en de ervaring te "ontrommelen". Dit kan het lastiger maken om de herkomst via propriëtaire synthetische methodes op te sommen. Dat is onbedoeld.

**Bekendmaking van generatieve AI:**

- **Door LLM's geschreven code:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (deze lijst kan groeien)
- **LLM-ontdekking:** Gemini 3.1, Fable
- **Documentatie:** Sonnet 5
- **Opensourcebibliotheken:** hun respectievelijke auteurs, vermeld in de SBOM, commentaar en bestandsheaders

Deze lijst omvat geen modellen die in Lolly zijn ingebouwd.

**Menselijke bijdrage:**

- **Architectuur:** Andy Fitzsimon
- **Artistieke leiding:** Andy Fitzsimon
- **Door mensen geschreven code:** Andy Fitzsimon
- **Ideevorming, review en feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, de Penpot-community (lijst niet volledig)

## Wat zijn de feature flags?

Feature flags zetten onderdelen van Lolly aan of uit. Meestal beheert een beheerder ze - bij Lolly heb jij de regie.

![Elke feature flag is een schakelaar die van jou is en in je eigen profiel staat in plaats van in de console van een beheerder](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Hoe kom ik aan de mobiele of desktop-apps?

Iedereen kan zijn eigen apps verspreiden, en de tools en configuratie van die apps horen sterk te verschillen afhankelijk van het publiek waarvoor ze bedoeld zijn. Er is dus niet één app, tenzij je hem zelf hebt gemaakt of iemand uit je omgeving hem aan je geeft.

## Waarom de naam "Lolly Tools"?

**Lolly** omdat vrijheid zoet is, en omdat een lolly in Australië, Nieuw-Zeeland en Groot-Brittannië een snoepje is.

**Tools** omdat gereedschap stil blijft liggen tot je het oppakt. Het draait niet als je het niet gebruikt en het kijkt niet met je mee terwijl je het wel gebruikt.

## Welke hordes kan ik verwachten als ik Lolly ga gebruiken?

Lolly past overal waar je nu al bestanden genereert - de CLI is dezelfde engine
als de app, dus een pipeline die om 2 uur 's nachts draait kan niet afwijken van wat iemand in een
browser bekijkt. De weerstand bij invoering is zelden technisch; die is organisatorisch. Verwacht dit:

**Er moet een samengestelde merkcatalogus worden opgebouwd.** Lolly is een platform, geen
kant-en-klaar pakket met jouw templates. Voor een *bestuurde uitrol* legt iemand de gedeelde
assetcatalogus vast (logo's, paletten, lettertypes als permanente ID's) en schrijft het manifest +
template voor elk uitvoertype. Losse gebruikers hoeven daar niet op te wachten - in
de open app kan iedereen vanaf dag één eigen bestanden in de catalogus opnemen en tools bouwen in
Design.

**Geen git nodig om bij te dragen.** Ontwerpers maken hun eigen tools en templates
in de app en delen ze daarna met collega's of dienen ze in bij wie de
deployment beheert, zodat ze standaard worden meegeleverd.

**Het is bewust smal - presenteer het ook zo.** Lolly is niet bedoeld voor maatwerk of
hero-content. Het *is* je persoonlijke DAM - gevoed en versterkt door je
designsysteem, tools en catalogus - en het *heeft* wel degelijk een open canvas (Design), maar
ook daar voldoen kleuren, typografie en assets aan de actieve design-globals, dus vrij
schikken blijft binnen het systeem. Naast Figma of Canva gelegd oogt het
beperkt. Beoordeeld op wat het is - geoperationaliseerde, terugkerende assetgeneratie op
enorme schaal - is er geen concurrentie. De verkeerde framing is de meest voorkomende tegenslag.

**Verandermanagement aan de productiekant.** Bestaande processen werken vandaag, ook al
is de output niet merkconform. Ze naar de engine ombuigen betekent opnieuw testen en opnieuw leren,
en "we kunnen al bestanden maken" wordt het excuus om niet te migreren. Begin met het omzetten van
één zichtbare uitvoer van productiekwaliteit en zet het voor en na naast elkaar.

Lolly tilt alles naar een hoger niveau.


## Wat maakt hulpprogramma's anders dan tools?

**Kort antwoord →** Hulpprogramma's hoeven niet altijd te renderen en kunnen daarom een andere UX krijgen. 

**Echte antwoord →** Hulpprogramma's kunnen binnen Lolly Tools worden gehost om nog een 'gemakslaag' aan verdediging toe te voegen die data-exfiltratie ontmoedigt. 

Waarom? Omdat bekend is dat mensen elke dag **vertrouwelijke content die ze al hebben** aan een
willekeurige website geven om er één kleine mechanische bewerking op uit te voeren:

- "**Comprimeer deze PDF**" → uploadt een contract / loonstrook / bestuurspresentatie naar onbekende partijen.
- "**converteer HEIC naar JPG**" → uploadt persoonlijke foto's (met GPS-EXIF) naar een host die van advertenties leeft
- "**snijd deze afbeelding bij / schaal hem**" → uploadt een productscreenshot of een nog niet uitgebrachte asset
- "**formatteer deze JSON**" / "decodeer deze JWT" → plakt API-antwoorden, tokens en secrets in een formatter
- "**voeg deze PDF's samen**" → uploadt **twee documenten die nooit dezelfde server zouden mogen delen**

Deze sites en hun enorme staart aan klonen zijn **standaard niet te vertrouwen**, met
onbekende bewaartermijnen, onbekende jurisdicties, onbekende subverwerkers en een verdienmodel
op basis van advertenties/affiliates dat er alle belang bij heeft te houden wat je ze geeft. De bewerking is
triviaal; de **content is de prijs.** 

We winnen de strijd om governance met uitstekend gemak en uitstekende service. 

![De weergave Hulpprogramma's verzamelt de mechanische klussen die mensen normaal aan een willekeurige website geven, maar dan draaiend binnen Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kan Lolly mijn Figma-, Penpot-, Illustrator- of InDesign-bestanden bewerken en renderen?

Ja. Open **Design** en klik op **Import a design** (een ontwerp importeren): het accepteert een native Figma-**.fig** (Save local copy), een Penpot-export **.penpot**, een Illustrator-**.ai** of **.pdf**, een InDesign-**.idml** (File → Export → InDesign Markup) of **elke SVG** (de brede deur - vrijwel elke ontwerpapp exporteert dat). Geen account, geen plug-in en geen licentie voor een ontwerpapp nodig.

![Het open canvas van Design - Een ontwerp importeren staat in het Lolly-menu van de werkbalk](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Lagen komen binnen als bewerkbare vakken op het open canvas: tekst blijft overtypbaar, vormen blijven vormen, afbeeldingen komen in je eigen afbeeldingsbibliotheek en typografie en kleuren voldoen aan de merkglobals. Sla het op en de lay-out wordt een herbruikbare, via een URL adresseerbare template die iedereen met Lolly opnieuw kan vullen - en je kunt er live tools in mengen (een QR-code, een grafiek) die bij het laden opnieuw renderen. Vanaf daar rendert het net als al het andere in Lolly - SVG, PDF, PNG en de rest, reproduceerbaar vanaf de URL. Zie [Een ontwerp importeren](/info/design-import.html).

## Kan ik mijn werk als bestand delen in plaats van als link?

Ja. Als een link niet alles kan meenemen (je eigen foto's, lange teksten), vertelt het deelvenster precies wat er zou wegvallen en biedt het in plaats daarvan een **.lolly**-bestand aan: één bestand met het ontwerp, de afbeeldingen die het gebruikt en, als je dat wilt, de tool zelf. Jij bepaalt hoeveel er meereist - je naam en gegevens gaan alleen mee als je profiel daarvoor kiest, gelicentieerde beelden blijven achter tenzij je ze meestuurt, en wie een bestand opent waar een tool in zit, krijgt eerst de vraag of hij die vertrouwt voordat die mag draaien. Zie [Je werk delen](/info/using.html#sharing-your-work).

## Kunnen twee mensen aan hetzelfde ontwerp werken zonder internet?

Ja. De één deelt een uitnodiging (een link, een QR-code of een korte code), de ander accepteert, en beide apparaten houden dezelfde sessie live - inclusief aanwezigheid en focusringen. Het werkt op elk gedeeld netwerk, ook op een telefoonhotspot in een kelder, want er zit geen server tussen. Zie [Samenwerken](/info/collaborate.html).

## Waar zijn de tools met SUSE-merk gebleven?

Die staan al in een aparte, private repository. Een publieke clone haalt het SUSE-merkpakket helemaal niet op, dus een publieke build draait het neutrale profiel `lolly-start` - de merkonafhankelijke community-tools plus een leeg merk dat je met je eigen merk invult. SUSE draait een eigen instantie om zijn handelsmerken te beschermen.

## Waarom is het gratis? Wat is het addertje?

**We hebben Lolly voor onszelf gebouwd.** SUSE had duizenden merkconforme bestanden nodig, elk met zijn naam erin verzegeld, gemaakt zonder iets aan externe diensten af te staan. Dus bouwden we een tool die dat allemaal op het apparaat doet, en brachten die uit als open source, net als al het andere wat we maken. We blijven het onderhouden omdat we het elke dag gebruiken. **Er is geen enkele verplichting:** alles hier werkt met of zonder ons.

Die grens ligt vast in de licentie, niet in een belofte: alles wat lokaal draait is gratis, voor altijd. Een versie die is uitgebracht, is zo gelicentieerd dat ze niet kan worden teruggenomen, en er is geen contributor agreement dat iemands werk opnieuw zou kunnen licentiëren. Zie [positionering](/info/positioning.html) voor de volledige verklaring.

## Hoeveel houdt SUSE privé? (oftewel wanneer wordt het kleed onder ons vandaan getrokken)

De engine, de shells, de schema's en de merkonafhankelijke tools zijn open source; de handelsmerken van SUSE en de tools met merk zijn het deel dat privé blijft, en die zijn al afgesplitst. De publieke instantie op [lolly.tools](https://lolly.tools) draait op het lege merk.

De grens is structureel, geen belofte. Elke uitgebrachte versie is open source en kan niet worden teruggetrokken, er is geen contributor agreement dat iemands werk opnieuw zou kunnen licentiëren, en het enige wat wordt achtergehouden is het handelsmerk. Toen een ander bedrijf in 2023 zijn enterprise-Linux-broncode sloot, was SUSE medeoprichter van [OpenELA](https://openela.org) om die code open te houden - dezelfde houding die dit project overneemt.

Volledige openheid: SUSE *bouwt* wel degelijk interne tooling om Lolly in zijn IT-systemen te integreren - dat gaat over de interne inrichting van SUSE, niet over publieke versus private ontwikkeling. Lolly wil ook via [Open Build Service](https://openbuildservice.org/) gebouwd worden, met veilige supply-chain-artefacten geleverd door de [SUSE Application Collection](https://apps.rancher.io/applications).

## Welke smaak heeft dat Lolly-logo?

Sommigen zeggen limoen, anderen zeggen munt en soms appel; Lolly brengt de zoetheid, jij zorgt voor de smaak!
