# Vragen en antwoorden

Veelgestelde vragen, gerenderd als het accordeon op `/info/start/faq.html`.

**Hoe te onderhouden:** elke `##`-kop hieronder is een vraag; alles eronder
(tot de volgende `##`) is het antwoord. Antwoorden gebruiken dezelfde lichte markdown als
de rest van de site - aparte alinea's met een lege regel ertussen. Voeg hier vragen toe, verwijder ze
of herschik ze en voer daarna opnieuw `pnpm run build:info` uit (of `pnpm run dev:web`).
Alles boven de eerste `##` (deze titel en deze notities) wordt door de build genegeerd.

De volgorde is die van een beginner: eerst de vangst, dan je bestanden, dan Lolly
krijgen en draaien, dan organisaties, dan hoe het is gemaakt. Het anker van elke vraag
wordt gebouwd uit de Engelse vraag op dezelfde positie, dus een vertaling behoudt de
Engelse volgorde.

## Waarom is het gratis? Wat is het addertje?

**We bouwden Lolly voor onszelf.** SUSE had duizenden on-brand bestanden nodig, gemaakt zonder iets aan externe diensten uit te besteden. Dus bouwden we een tool die dat allemaal op het apparaat doet, en brachten die uit als open source, zoals alles wat we maken. We blijven hem onderhouden omdat we hem elke dag gebruiken. **Er is geen verplichting:** alles hier werkt met of zonder ons.

Die grens staat in de licentie, niet in een belofte: alles wat lokaal draait is gratis, voor altijd. Een uitgebrachte versie is zo gelicentieerd dat ze niet kan worden teruggenomen, en er is geen bijdragersovereenkomst die iemands werk zou kunnen herlicentiëren.

## Hoeveel houdt SUSE privé? (oftewel wanneer wordt het kleed onder ons vandaan getrokken)

De engine, de shells, de schema's en de merkonafhankelijke tools zijn open source. De handelsmerken en merktools van SUSE zijn het deel dat privé blijft, en die zijn al afgescheiden. De openbare instantie op [lolly.tools](https://lolly.tools) draait [Lolly Demo](/info/lolly-demo.html), het eigen design system van Lolly.

Niets hier berust op een belofte: elke uitgebrachte versie blijft open source, en het enige wat wordt achtergehouden is het handelsmerk. Toen een ander bedrijf in 2023 zijn enterprise-Linuxbronnen sloot, richtte SUSE mede [OpenELA](https://openela.org) op om die code open te houden, dezelfde houding die dit project erft.

Volledige openheid: SUSE *bouwt* interne tooling om Lolly te koppelen aan zijn eigen IT-systemen. Dat is de interne opzet van SUSE, geen scheiding tussen openbare en privéontwikkeling. Lolly streeft er ook naar via [Open Build Service](https://openbuildservice.org/) te worden gebouwd, met beveiligde supply-chain-artefacten geleverd door de [SUSE Application Collection](https://apps.rancher.io/applications).

## Waarom de naam "Lolly Tools"?

**Lolly** omdat vrijheid zoet is, en omdat een lolly in Australië, Nieuw-Zeeland en Groot-Brittannië een snoepje is.

**Tools** omdat gereedschap stil blijft liggen tot je het oppakt. Het draait niet als je het niet gebruikt en het kijkt niet met je mee terwijl je het wel gebruikt.

## Waarom is alles groen?

lolly.tools opent in [Lolly Demo](/info/lolly-demo.html), het eigen voorbeeld-design system van Lolly, en de hoofdkleur is groen. Het is een voorbeeld, geen regel. Schakel over naar **Lolly Starter**, een leeg design system, of naar je eigen via [Settings → Design systems](/#/settings?focus=design-systems-section).

## Kan ik mijn eigen merk gebruiken?

Ja. **Design System Setup** (`#/start`) bouwt een design system uit één kleur, een designtokensbestand of een afgerond ontwerp, en elke tool tekent dan met jouw design system. [Start](/info/quickstart.html#put-your-brand-in) loopt de drie routes door.

Een design system dat je organisatie of je build levert is beheerd: het toont een slot en blijft alleen-lezen, en je kunt een bewerkbare kopie maken om te wijzigen.

## Waar is het ding dat ik gisteren maakte?

Als je op **Save as** of **Save** drukte, staat het in **Projects**, op het startscherm, in de browser of app waarmee je opsloeg. Als je alleen op **Download** drukte, staat het bestand waar je browser of systeem downloads opslaat, en meestal staat er een kopie in **Assets**. Tools die [opslaan terwijl je werkt](/info/find-your-work.html#which-tools-save-as-you-work) bewaren ook niet-opgeslagen werk in **Projects**. [Je werk vinden en terughalen](/info/find-your-work.html) behandelt elk geval.

## Ik heb het tabblad gesloten. Is mijn werk weg?

Opgeslagen werk staat nog in **Projecten**. Niet-opgeslagen werk is weg, behalve in de tools die opslaan terwijl je werkt, die het ook in **Projecten** bewaren. Druk de volgende keer op **Opslaan als** voordat je vertrekt. Zie [Als je het tabblad sloot of de tool verliet](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Kan ik mijn werk als bestand delen in plaats van als link?

Ja. Wanneer een link niet alles kan dragen, zoals je eigen foto's of lange tekst, zegt de Share-dialoog wat er zou ontbreken en biedt een **.lolly**-bestand aan: één bestand met het ontwerp, de afbeeldingen die het gebruikt en, als je dat kiest, de tool zelf.

Jij bepaalt hoeveel meereist. Je naam en gegevens gaan er alleen in als je profiel dat toestaat, en gelicentieerd artwork wordt achtergehouden tenzij je kiest het artwork mee te nemen. Wie een bestand opent dat een tool bevat, wordt gevraagd of hij de tool vertrouwt voordat die kan draaien. Zie [Je werk delen](/info/using.html#sharing-your-work).

## Wat doen mijn profielgegevens?

Je gegevens in **Settings** vullen de tools vooraf in die erom vragen, zoals een naam op een badge. Ze blijven op dit apparaat. Als je ook de opt-in aanzet, worden de gegevens die je kiest verzegeld in wat je maakt, met jou als bron. Er wordt niets opgenomen tenzij je kiest je gegevens op te nemen.

Delen en Sync versturen alleen de inhoud die je kiest. Op de Lolly Work-instantie van een organisatie gaan gedeelde sessies en beheerd werk ook naar die server. Zie [Privacy](/info/privacy.html).

## Hoe kom ik aan de mobiele of desktop-apps?

Download ze via [Install Lolly](/info/install.html). De pagina noemt elke build voor macOS, Windows, Linux en Android, en laat zien hoe je het gedownloade bestand controleert. iPhone en iPad krijgen **Lolly Tools** uit de App Store; [het gedeelte over iPhone en iPad](/info/install.html#iphone-and-ipad) heeft de link.

Iedereen kan ook een eigen kopie van de app bouwen en uitdelen, met de tools en instellingen die hun publiek nodig heeft. De [Build Guide](/info/build-guide.html) laat zien hoe.

## Lolly zegt dat het WebGPU nodig heeft. Wat kan ik doen?

De webapp tekent met WebGPU, een grafische functie van huidige browsers, en controleert erop voordat ze een tool opent. Probeer dit in volgorde:

1. Werk je browser bij naar de huidige versie.
2. Zet grafische of hardwareversnelling aan in de instellingen van de browser en start de browser opnieuw.
3. Probeer een geteste browser: [Supported environments](/info/supported-environments.html) noemt ze.
4. Op een Mac, iPhone of iPad [installeer je de app](/info/install.html) in plaats daarvan.

## Kan Lolly mijn Figma-, Penpot-, Illustrator- of InDesign-bestanden bewerken en renderen?

Ja. Open **Design** en klik op **Import a design**: het accepteert een native Figma-**.fig** (Save local copy), een Penpot-**.penpot**-export, een Illustrator-**.ai** of -**.pdf**, een InDesign-**.idml** (File → Export → InDesign Markup) of **elke SVG**. Je hebt geen account, geen plug-in en geen licentie voor een ontwerpapp nodig.

![Het open canvas van Design - Import a design staat in het Lolly-menu van de werkbalk](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Lagen komen aan als bewerkbare vakken: tekst blijft bewerkbaar, vormen blijven vormen en afbeeldingen komen in je eigen bibliotheek. Sla het op, en met **Share with rules** wordt van de lay-out een tool die iedereen met Lolly opnieuw kan invullen. Zie [Een ontwerp importeren](/info/design-import.html).

## Kunnen twee mensen aan hetzelfde ontwerp werken zonder internet?

Ja. De ene persoon deelt een uitnodiging, als link, QR-code of korte code, en de ander accepteert. Beide apparaten houden dan dezelfde sessie live vast, inclusief aanwezigheid en focusringen. Het werkt op elk gedeeld netwerk, ook een telefoonhotspot in een kelder, omdat er geen server tussen zit. Zie [Samenwerken](/info/collaborate.html). Voor collega's op verschillende netwerken biedt de Lolly Work-instantie van een organisatie geauthenticeerde werkcollabs.

## Wat zijn de feature flags?

Feature flags zetten delen van Lolly aan of uit. Bij zelfstandig gebruik kies je je persoonlijke instellingen. Een organisatie die Lolly Work gebruikt kan standaardwaarden instellen of geselecteerde schakelaars verbergen onder haar beleid, en beheerde bediening is gelabeld. Zie [Lolly gebruiken bij je organisatie](/info/organisation.html).

![Persoonlijke feature flags in de zelfstandige app; het beleid van de organisatie kan geselecteerde schakelaars beheren](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Wat maakt hulpprogramma's anders dan tools?

Een hulpprogramma doet één snelle klus op een bestand dat je al hebt, zoals een PDF comprimeren, een foto omzetten of verborgen gegevens verwijderen, en veel ervan draaien op je apparaat zonder dat iets wordt geüpload. Ze bestaan zodat de klussen die mensen meestal aan een willekeurige website geven binnen Lolly blijven. Een contract comprimeren, vakantiefoto's omzetten met de locatie er nog in of een token in een online formatter plakken zou niet moeten betekenen dat je het bestand geeft aan een site met onbekende bewaartermijn, rechtsgebied en verdienmodel. [Hulpprogramma's](/info/utilities.html) noemt ze, en [De ruil waar we nooit mee instemden](/info/status-quo.html) vertelt het verhaal erachter.

![De weergave Utilities: Strip Hidden Data, Compress PDF, Convert Image en de andere klussen op het apparaat, allemaal op één plek](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kan onze organisatie SSO, gedeelde projecten en goedkeuringen gebruiken?

Ja, met **Lolly Work**, de organisatieserver van hetzelfde open-sourceproject. Die draait apart en voegt single sign-on toe via je identiteitsprovider, SCIM-provisioning, groepsrechten, gedeelde projecten en assets, live werkcollabs, goedkeuringen en auditrecords. De dagelijkse app werkt nog steeds zelfstandig.

[Lolly gebruiken bij je organisatie](/info/organisation.html) behandelt aanmelden en gedeeld werk vinden, en [Deployment](/info/deployment.html#organisation-services-with-lolly-work) behandelt het opzetten. Gedeelde inhoud en organisatierecords volgen het privacy- en bewaarbeleid van die instantie.

## Welke hordes kan ik verwachten als ik Lolly ga gebruiken?

Wat verandert is vooral aan de producerende kant, niet de technologie. Een team dat een beheerde set tools wil, heeft iemand nodig die zijn design system en de eerste sjablonen opstelt, al kan iedereen op dag één zelf tools beginnen te maken in Design, zonder git. En bestaande processen blijven werken, ook als hun uitvoer niet bij het merk past, dus één zichtbare uitvoer goed omzetten, voor en na naast elkaar, bepleit de zaak sneller dan een plan.

[Adoption & Governance](/info/adoption-governance.html) behandelt onboarding per rol, hoe je een pilot meet en hoe een governanceproces eruit kan zien.

## Is Lolly "vibe coded"?

Lolly is ontwikkeld met AI-ondersteunde codering, AI-ondersteunde verkenning en op veel plekken AI-ondersteunde inhoud, met een mix van modellen en leveranciers, waaronder die van frontier-bedrijven in de publieke cloud. Een mens bedacht de architectuur, verzorgde de code met opzet en gaf de art direction aan de ervaring.

Een hoge of kritieke advisory in de dependencies van Lolly blokkeert CI. Een advisory die nog niet kan worden opgelost, wordt alleen achtergehouden als goedgekeurde uitzondering met een schriftelijke reden. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) noemt elke uitzondering die vandaag geldt, en de [release notes](https://github.com/lolly-tools/lolly/releases) noemen die welke elke release meedraagt. SECURITY.md zegt ook hoe je een kwetsbaarheid meldt.

Controles in de build weren ook formuleringen die als machinaal gemaakt lezen in de codecommentaren, de app en deze docs, om de tekst voor elke lezer helder te houden. Een bijeffect is dat een detector het moeilijker kan vinden te zien welke tekst een model schreef. Dat was niet ons doel.

Het belangrijkste: Lolly staat op de schouders van tientallen jaren open-sourcewerk van experts over de hele wereld.

**Bekendmaking van generatieve AI:**

- **Door LLM geschreven code:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (deze lijst kan groeien)
- **LLM-verkenning:** Gemini 3.1, Fable, Codex Astra
- **Documentatie:** Sonnet 5
- **Open-sourcebibliotheken:** Hun respectieve auteurs, vermeld in de SBOM, commentaren en bestandskoppen

Deze lijst omvat geen modellen die in Lolly zijn ingebouwd.

**Menselijke claims:**
- **Ideevorming, review en feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, de Penpot Community, Tim Hildred (lijst niet uitputtend)
- **Architectuur, art direction & slop-opruimer:** Andy Fitzsimon

## Waar zijn de tools met SUSE-merk gebleven?

Ze staan in een aparte, privérepository. Een openbare clone haalt het SUSE-merkpakket helemaal niet op, dus een build ervan gebruikt het neutrale profiel `lolly-start` tenzij je een ander kiest: de merkonafhankelijke communitytools plus een leeg merk dat je met je eigen invult. [lolly.tools](https://lolly.tools) wordt gebouwd met het profiel `lolly-demo` en opent in [Lolly Demo](/info/lolly-demo.html), het eigen design system van Lolly. SUSE draait een eigen instantie om zijn handelsmerken te beschermen.

## Welke smaak heeft dat Lolly-logo?

Sommigen zeggen limoen, anderen zeggen munt en soms appel; Lolly brengt de zoetheid, jij zorgt voor de smaak!
