# Vragen & antwoorden

Veelgestelde vragen, weergegeven als accordeon op `/info/start/faq.html`.

**Onderhoud:** elke kop met `##` hieronder is een vraag. Alles onder de kop,
tot aan de volgende `##`, is het antwoord. Antwoorden gebruiken de eenvoudige Markdown van de site:
scheid alinea's met een lege regel. Voeg hier vragen toe, verwijder ze of wijzig hun volgorde en
voer `pnpm run build:info` (of `pnpm run dev:web`) opnieuw uit.
De build negeert alles boven de eerste `##` (deze titel en deze notities).

De volgorde is die van een nieuwe gebruiker: eerst het addertje onder het gras, dan je bestanden, dan Lolly verkrijgen
en draaien, dan organisaties en daarna hoe het is gemaakt. Het anker van elke vraag
wordt opgebouwd uit de Engelse vraag op dezelfde positie, dus een vertaling behoudt de
Engelse volgorde.

## Waarom is het gratis? Wat is het addertje onder het gras?

**We hebben Lolly voor onszelf gebouwd.** SUSE had duizenden bestanden in de eigen huisstijl nodig, gemaakt zonder iets aan externe diensten te geven. Daarom bouwden we een tool die alles op het apparaat doet en brachten die uit als open source, zoals alles wat we maken. We blijven hem onderhouden omdat we hem elke dag gebruiken. **Er is geen verplichting:** alles hier werkt met of zonder ons.

Die grens staat in de licentie, niet in een belofte: alles wat lokaal draait is gratis, voor altijd. Een uitgebrachte versie heeft een licentie die niet kan worden ingetrokken. Geen bijdragersovereenkomst zou iemands werk onder een andere licentie kunnen brengen.

## Hoeveel houdt SUSE gesloten? (oftewel: wanneer trekt SUSE het aanbod in)

De engine, de shells, de schema's en de merkonafhankelijke tools zijn open source. De handelsmerken en merkgebonden tools van SUSE blijven gesloten en zijn al afgescheiden. De publieke instantie op [lolly.tools](https://lolly.tools) draait [Lolly Demo](/info/lolly-demo.html), het eigen design system van Lolly.

Niets hier berust op een belofte: elke uitgebrachte versie blijft open source. Toen een ander bedrijf in 2023 de broncode van zijn enterprise-Linux afsloot, richtte SUSE mede [OpenELA](https://openela.org) op om die code open te houden. Dit project neemt dat standpunt over.

SUSE bouwt *wel* interne tools om Lolly met zijn eigen IT-systemen te verbinden. Dat is de interne inrichting van SUSE, geen scheiding tussen publieke en gesloten ontwikkeling. Lolly streeft er ook naar via [Open Build Service](https://openbuildservice.org/) gebouwd te worden, met veilige supplychain-artefacten geleverd door de [SUSE Application Collection](https://apps.rancher.io/applications).

## Waarom de naam "Lolly Tools"?

**Lolly** omdat vrijheid zoet is en omdat een lolly in Australië, Nieuw-Zeeland en Groot-Brittannië een snoepje is.

**Tools** omdat een tool stil blijft liggen totdat je hem oppakt. Hij draait niet wanneer je hem niet gebruikt en houdt je niet in de gaten wanneer je dat wel doet.

## Waarom is alles groen?

lolly.tools opent in [Lolly Demo](/info/lolly-demo.html), het eigen voorbeeld-design system van Lolly, met groen als hoofdkleur. Schakel over naar **Lolly Starter**, een leeg design system, of naar je eigen design system in [Settings → Design systems](/#/settings?focus=design-systems-section).

## Kan ik mijn eigen merk gebruiken?

Ja. **Lolly Design System Setup** (`#/start`) bouwt een design system op uit één kleur, een bestand met design tokens of een afgerond ontwerp. Elke tool tekent vervolgens met je design system. [Start](/info/quickstart.html#put-your-brand-in) loopt de drie routes door.

Een design system dat je organisatie of je build levert, is beheerd. Het toont een slotje en blijft alleen-lezen. Maak een bewerkbare kopie om het te wijzigen.

## Waar is wat ik gisteren heb gemaakt?

Als je op **Save as** of **Save** hebt gedrukt, staat je werk in **Projects** op het startscherm, in de browser of app van waaruit je het hebt opgeslagen. Als je alleen op **Download** hebt gedrukt, staat het bestand in de downloads van je browser of systeem en staat er meestal een kopie in **Assets**. Tools die [tijdens het werk opslaan](/info/find-your-work.html#which-tools-save-as-you-work), bewaren ook niet-opgeslagen werk in **Projects**. [Je werk vinden en herstellen](/info/find-your-work.html) behandelt elk geval.

## Ik heb het tabblad gesloten. Is mijn werk weg?

Opgeslagen werk staat nog steeds in **Projects**. Niet-opgeslagen werk is weg, behalve in de tools die tijdens het werk opslaan; die bewaren het ook in **Projects**. Druk de volgende keer op **Save as** voordat je weggaat. Zie [Als je het tabblad hebt gesloten of de tool hebt verlaten](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Kan ik mijn werk als bestand delen in plaats van als link?

Ja. Wanneer een link niet alles kan meenemen, zoals je eigen foto's of lange tekst, vermeldt de Share-dialoog wat er zou ontbreken en biedt een **.lolly**-bestand aan. Dat ene bestand bevat het ontwerp, de gebruikte afbeeldingen en, als je daarvoor kiest, de tool.

Je bepaalt zelf hoeveel er meegaat. Je naam en gegevens worden alleen opgenomen als je daar in je profiel toestemming voor geeft. Gelicentieerde illustraties blijven achter, tenzij je ervoor kiest ze mee te nemen. Wie een bestand met een tool opent, krijgt de vraag of die de tool vertrouwt voordat hij kan draaien. Zie [Je werk delen](/info/using.html#sharing-your-work).

## Wat doen mijn profielgegevens?

Je gegevens in **Settings** vullen vooraf de tools in die erom vragen, zoals een naam op een badge. Ze blijven op dit apparaat. Er komt niets in wat je maakt, tenzij je daar expliciet toestemming voor geeft. Dan worden de gegevens die je kiest verzegeld opgenomen en noemen ze jou als bron.

Delen en Sync versturen alleen de inhoud die je kiest. Op de Lolly Work-instantie van een organisatie gaan gedeelde sessies en werk dat onder het organisatiebeleid valt ook naar die server. Zie [Privacy](/info/privacy.html).

## Hoe krijg ik de mobiele of desktopapps?

Download ze via [Lolly installeren](/info/install.html). De pagina vermeldt elke build voor macOS, Windows, Linux en Android en laat zien hoe je het gedownloade bestand controleert. iPhone en iPad krijgen **Lolly Tools** uit de App Store. [De sectie voor iPhone en iPad](/info/install.html#iphone-and-ipad) bevat de link.

Iedereen kan ook een eigen kopie van de app bouwen en verspreiden, met de tools en instellingen die de doelgroep nodig heeft. De [Buildgids](/info/build-guide.html) laat zien hoe.

## Lolly zegt dat WebGPU vereist is. Wat kan ik doen?

De webapp tekent met WebGPU, een grafische functie van huidige browsers, en controleert op WebGPU voordat een tool wordt geopend. Probeer dit in deze volgorde:

1. Werk je browser bij naar de huidige versie.
2. Zet grafische of hardwareversnelling aan in de browserinstellingen en start de browser daarna opnieuw.
3. Probeer een geteste browser: [Ondersteunde omgevingen](/info/supported-environments.html) somt ze op.
4. [Installeer op een Mac, iPhone of iPad de app](/info/install.html).

## Kan Lolly mijn Figma-, Penpot-, Illustrator- of InDesign-bestanden bewerken en renderen?

Ja. Open de tool **Design** en klik op **Import a design**: die accepteert een native Figma-**.fig** (Save local copy), een Penpot-**.penpot**-export, een Illustrator-**.ai** of **.pdf**, een InDesign-**.idml** of **.indd**, een Affinity-document, een Photoshop-**.psd**, een PowerPoint-**.pptx**, een CAD-**.dxf** of **elke SVG** ([elk formaat dat wordt ingelezen](/info/design-import.html#what-comes-in-from-each-app)). Je hebt geen account, geen plugin en geen licentie voor een ontwerpapp nodig.

![Het open canvas van Lolly Design - Import a design staat in het Lolly-menu van de toolbalk](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Lagen komen binnen als bewerkbare vakken. Tekst blijft bewerkbaar, vormen blijven vormen en afbeeldingen komen in je bibliotheek. Zodra de lay-out is opgeslagen, kan **Share with rules** er een tool van maken die iedereen met Lolly opnieuw kan invullen. Zie [Een ontwerp importeren](/info/design-import.html).

## Kunnen twee mensen zonder internet aan hetzelfde ontwerp werken?

Ja. De ene persoon deelt een uitnodiging (een link, een QR-code of een korte code) en de andere accepteert. Beide apparaten houden dan dezelfde sessie live bij, met aanwezigheidsindicatoren en focusringen. Dit werkt op elk gedeeld netwerk, ook een telefoonhotspot, omdat er geen server tussen zit. Zie [Samenwerken](/info/collaborate.html). Voor collega's op verschillende netwerken biedt de Lolly Work-instantie van een organisatie geauthenticeerde werksamenwerkingen.

## Wat zijn de feature flags?

Feature flags zetten onderdelen van Lolly aan of uit. Bij zelfstandig gebruik kies je je persoonlijke instellingen. Een organisatie die Lolly Work gebruikt, kan standaardwaarden instellen of bepaalde schakelaars verbergen op basis van haar beleid, en beheerde bedieningselementen zijn gemarkeerd. Zie [Lolly gebruiken in je organisatie](/info/organisation.html).

![Persoonlijke feature flags in de zelfstandige app; organisatiebeleid kan bepaalde schakelaars beheren](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Waarin verschillen hulpprogramma's van tools?

Een hulpprogramma doet één snelle klus op een bestand dat je al hebt, zoals een PDF comprimeren, een foto omzetten of verborgen gegevens verwijderen. Veel draaien op je apparaat zonder iets te uploaden. Hulpprogramma's houden klussen binnen Lolly die mensen gewoonlijk aan een willekeurige website overlaten. Een contract comprimeren, vakantiefoto's omzetten waar de locatie nog in zit of een token in een online formatter plakken zou niet moeten betekenen dat je het bestand aan een site geeft met een onbekend bewaarbeleid, rechtsgebied en bedrijfsmodel. [Lolly Utilities](/info/utilities.html) somt ze op en [De ruil waarmee we nooit hebben ingestemd](/info/status-quo.html) vertelt het verhaal erachter.

![De Utilities-weergave: Lolly Strip Hidden Data, Compress PDF, Convert Image en de andere klussen op het apparaat, allemaal op één plek](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kan onze organisatie SSO, gedeelde projecten en goedkeuringen gebruiken?

Ja, met **Lolly Work**, de organisatieserver van hetzelfde opensourceproject. Die draait apart en voegt eenmalige aanmelding via je identiteitsprovider, SCIM-provisioning, groepsrechten, gedeelde projecten en assets, live werksamenwerkingen, goedkeuringen en auditrecords toe. De dagelijkse app blijft zelfstandig werken.

[Lolly gebruiken in je organisatie](/info/organisation.html) behandelt aanmelden en gedeeld werk vinden. [Implementatie](/info/deployment.html#organisation-services-with-lolly-work) behandelt het opzetten van Lolly Work. Gedeelde inhoud en organisatieregistraties volgen het privacy- en bewaarbeleid van die instantie.

## Welke hindernissen kan ik verwachten bij het invoeren van Lolly?

Vooral verandering in hoe een team werk produceert, niet in technologie. Een team dat een beheerde set tools wil, heeft iemand nodig die het design system en de eerste sjablonen maakt. Iedereen kan nog steeds vanaf dag één eigen tools in Lolly Design maken, zonder git. Bestaande processen blijven werken, ook als hun uitvoer niet bij het merk past. Eén zichtbaar resultaat goed omzetten, met voor en na naast elkaar, overtuigt sneller dan een plan.

[Adoptie & beheer](/info/adoption-governance.html) behandelt het inwerken per rol, het meten van een pilot en hoe een beheerproces eruit kan zien.

## Is Lolly met "vibe coding" gemaakt?

Lolly is ontwikkeld met AI-ondersteund programmeren, AI-ondersteunde verkenning en op veel plekken AI-ondersteunde inhoud, met een mix van modellen en leveranciers, waaronder die van bedrijven met de meest geavanceerde modellen in de publieke cloud. Een mens ontwierp de architectuur, selecteerde de code doelbewust en bepaalde de creatieve richting van de ervaring.

Een beveiligingsmelding met een hoog of kritiek risico in de afhankelijkheden van Lolly blokkeert CI. Een melding die nog niet kan worden verholpen, wordt alleen uitgezonderd na goedkeuring, met een schriftelijke reden. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) vermeldt elke huidige uitzondering en de [releasenotities](https://github.com/lolly-tools/lolly/releases) vermelden welke elke release bevat. SECURITY.md beschrijft ook hoe je een kwetsbaarheid meldt.

Controles in de build wijzen ook formuleringen af die machinaal geschreven aandoen in de codecommentaren, de app en deze documentatie, om de tekst voor elke lezer helder te houden. Een neveneffect is dat een detector mogelijk moeilijker kan bepalen welke tekst een model schreef. Dat was niet ons doel.

Bovenal staat Lolly op de schouders van tientallen jaren opensourcewerk door experts over de hele wereld.

**Verantwoording van generatieve AI:**

- **Door LLM's geschreven code:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (deze lijst kan worden uitgebreid)
- **Verkenning met LLM's:** Gemini 3.1, Fable, Codex Astra
- **Documentatie:** Sonnet 5
- **Opensourcebibliotheken:** De respectieve auteurs, vermeld in de SBOM, commentaren en bestandskoppen

Deze lijst bevat geen modellen die in Lolly zijn meegeleverd.

**Menselijke bijdragen:**
- **Ideevorming, beoordeling en feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, de Penpot Community, Tim Hildred (lijst niet volledig)
- **Architectuur, artdirection & rommelopruimer:** Andy Fitzsimon

## Waar zijn de tools met SUSE-huisstijl gebleven?

Ze staan in een aparte, private repository. Een publieke kloon haalt het SUSE-merkpakket niet op, dus een build daarvan gebruikt het neutrale profiel `lolly-start`, tenzij je een ander kiest. Dat profiel bevat de merkonafhankelijke communitytools en een leeg merk dat je zelf invult. [lolly.tools](https://lolly.tools) wordt gebouwd met het profiel `lolly-demo` en opent in [Lolly Demo](/info/lolly-demo.html), het eigen design system van Lolly. SUSE beheert een eigen instantie om zijn handelsmerken te beschermen.

## Welke smaak heeft dat Lolly-logo?

Volgens sommigen limoen, volgens anderen munt en soms appel. Lolly zorgt voor de zoetheid en jij bepaalt de smaak.

## Wat bedoelt Lolly met contentsoevereiniteit?

Controle over hoe je inhoud wordt gemaakt, beheerd, opgeslagen en verplaatst tussen de systemen die je kiest. Lolly ondersteunt lokale productie, bewerkbaar werk en overdraagbare tools. Lolly Work voegt gedeelde diensten toe die de organisatie beheert. Bronlicenties, beschikbare afhankelijkheden en de gegevensstromen van de workflow blijven van belang. [Wat is contentsoevereiniteit?](/info/content-sovereignty.html) legt elke vorm van controle en de grenzen ervan uit.

## Kunnen we ons bestaande DAM behouden?

Ja. Een ondersteund DAM kan de gezaghebbende bron blijven terwijl Lolly Work geselecteerde assets met Lolly-tools verbindt. Toegang tot de bron, toegestane bewerkingen, gebruiksrechten en goedkeuring van de uiteindelijke uitvoer zijn aparte beslissingen. [Lolly gebruiken met je bestaande DAM](/info/use-with-dam.html) legt de opzet uit en [De ervaringen van SUSE met Brandfolder](/info/suse-brandfolder.html) beschrijft succesvol gebruik tijdens de invoering.
