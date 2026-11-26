# Instellingen

Settings bevat je gegevens, je design system, toegankelijkheid, opslag op dit apparaat en offline downloads. Open **Settings** vanuit de balk onderaan het startscherm of vanuit je avatarmenu en het opent op **Preferences**.

| Tabblad | Adres | Inhoud |
|---|---|---|
| **Preferences** | `#/settings` | Je gegevens, design systems, uiterlijk, emoji, toegankelijkheid, verbindingen, opslag en offline downloads |
| **This device** | `#/settings?tab=device` | Een live overzicht van deze browser en dit apparaat, plus geluid en een alleen-lezenweergave van de opslag |
| **Design system** | `#/settings?tab=brand` | Het actieve design system als omslag en pagina's, met een strook omslagen om tussen systemen te wisselen |
| **Capabilities** | `#/settings?tab=caps` | Alles wat Lolly kan doen, als doorzoekbare kaarten |
| **Activity & stats** | `#/settings?tab=activity` | De catalogus, je lokale tellers en recent werk |

Oude links naar `#/profile` en `#/d` openen nog steeds de juiste plek, tot op de afzonderlijke instellingen.

<!--i:eti-sliders-->
## Voorkeuren

Preferences is één lange pagina met een **instellingenbalk** langs de zijkant. Het veld **Search settings** boven de balk filtert de balk terwijl je typt. Elke sectie heeft een link in de vorm `#/settings?focus=<section-id>`, zoals `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - je naam, contactgegevens en portretfoto en de schakelaar **Use my details to create**. [Profielen](/info/profile.html) legt uit hoe tools ze gebruiken.
- <!--i:seal--> **Content Credentials** - de optionele geverifieerde identiteit die je exports ondertekent. Zie [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - design systems wisselen, toevoegen, verbergen of verwijderen. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) behandelt elke actie.
- <!--i:moon--> **Appearance** - het thema (Light, Dark of Brand, dat de app in je palet kleurt), **Your colourway** wanneer het design system er meer dan één biedt ([Maak een colourway je eigen](/info/colourways.html#make-a-colourway-your-own)) en **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - de emojiset voor nieuw werk, met de licentie van het artwork, en hoe sterk je palet emoji herkleurt (**Off**, **Subtle**, **Strong**, **Full**, **Mono** of **Duotone**). **Keep skin tones and flags** laat die in hun eigen kleuren. Werk dat je al hebt gemaakt, behoudt zijn set.
- <!--i:eyeoff--> **Accessibility** - vier comfortschakelaars, plus Sound en Neurospicy Mode. Zie [Toegankelijkheid](#accessibility).
- <!--i:link--> **Connected services** - opslag die je koppelt, zoals Dropbox, Google Drive, OneDrive, Nextcloud of S3, en **Sync across devices**. Zie [Je apparaten synchroniseren](/info/sync.html).
- <!--i:globe--> **Trusted sites** - de sites waarmee een webpaginavak in Lolly Design of een Lolly Sandbox-demo zonder te vragen contact mag maken en, waar de server het biedt, **Allow pages from any site**. Het [Privacybeleid](/info/privacy.html) somt op wat elk verzoek verstuurt.
- <!--i:download--> **Your renders** - **Save my renders to my library** bewaart een kopie van elke afbeelding, audioclip en video die je downloadt in Assets, onder een Renders-tag.
- <!--i:database--> **Storage** - wat Lolly op dit apparaat bewaart en de knoppen die je gegevens wissen of meenemen. Zie [Opslag](#storage).
- <!--i:cpu--> **Available offline** - download wat je nodig hebt voordat je de verbinding verliest. Zie [Offline beschikbaar](#available-offline).
- <!--i:folder--> **Hot folder** - in de desktopapp houdt Lolly één map in de gaten en importeert alles wat daarin wordt geplaatst, via dezelfde kiezer als bij slepen en neerzetten.
- <!--i:clock--> **Your activity** - wat je op dit apparaat hebt gemaakt, lokaal geteld.
- <!--i:sliders--> **Feature flags** - zet delen van de app aan of uit, zoals **Print preflight** of **Strip metadata from uploads**. **Performance UI** geeft de app een eenvoudiger uiterlijk dat minder rekenwerk kost om te tekenen. Lolly kan Performance UI zelf aanzetten op een traag apparaat. De regel onder de schakelaar vermeldt dan wanneer en waarom, met **Allow again** ([hoe die beslissing wordt genomen](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - waar deze installatie zijn tools en catalogus vandaan haalt. Zie [Lolly-instantie](#lolly-instance).

De themakaarten zijn live voorbeelden. Een thema wordt toegepast zodra je het kiest, alleen op dit apparaat.

![Drie themakaarten, elk met een voorbeeld van de eigen typografie en kleur, met de actieve kaart gemarkeerd](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Toegankelijkheid

**Settings → Preferences → Accessibility** bevat vier comfortinstellingen voor de app. Ze staan allemaal uit totdat je ze aanzet en geen ervan beïnvloedt een toolcanvas of een export, dus een rustigere app verplaatst nooit een pixel van het bestand dat je oplevert. Ze staan allemaal standaard uit. Geen ervan verandert een toolcanvas of een export.

- <!--i:pause--> **Reduce motion** zet de overgangen, schuifbewegingen en versieringen van de app uit.
- <!--i:photos--> **Hide colourful previews** vervangt de voorbeeldafbeeldingen van de galerij door kaarten met pictogrammen en tekst en maakt projectminiaturen rustiger, terwijl ze herkenbaar blijven.
- <!--i:sliders--> **High contrast** versterkt de randen, tekst en focusringen van de app. Je merkkleuren en het canvas blijven zoals je ze hebt ingesteld.
- <!--i:font--> **Large text** vergroot de labels, menu's en knoptekst van de app.

**Dominant hand** (Right of Left) bepaalt aan welke kant de bediening staat wanneer Lolly twee panelen toont, op een opvouwbaar apparaat of een bijna vierkante tablet. **Swap sides** in de kop van een paneel verandert dit ook.

Deze instellingen staan in je profiel, dus ze reizen in een profielexport mee met je naam en sessies. Een kopie die alleen op het apparaat staat, past ze toe voordat het scherm voor het eerst wordt getekend.

Dezelfde kaart bevat **Sound**, zachte ondersteunende geluiden bij acties zoals aankomen in de galerij, een Content Credentials-resultaat of het sluiten van een paneel. Hij bevat ook **Neurospicy Mode**, rustige muziek om je te concentreren. Als je Neurospicy aanzet, opent er een kleine speler in de hoek die overal in de app bij je blijft. In de speler kies je een track, sla je tracks over, stel je het volume in en minimaliseer of sluit je de speler. Tracks omvatten de gegenereerde stations van Lolly, ambientloops en beats, je eigen audio en internetradiostations, waarvoor een verbinding nodig is. Beide staan standaard uit en worden onthouden. Sound uitzetten dempt ook de concentratiemuziek. Het profielmenu en **This device** hebben dezelfde schakelaar.

Een schuifregelaar onder de schakelaar Sound bepaalt waaruit de geluiden bestaan. Richting de ronde **Bouba**-blob worden het zachte druppels, bubbels en een beetje bas. Richting de puntige **Kiki**-ster worden het droge tikken, krassen en metaal. In het midden blijven de belklanken en noten van Lolly behouden. Als je de geluiden aan de ene kant moeilijk kunt verdragen, schuif dan naar de andere kant. De schuifregelaar werkt terwijl Sound uit staat en als je hem loslaat, hoor je een kort voorbeeld.

::: details De gegenereerde stations
De gegenereerde stations componeren hun muziek tijdens het afspelen, zonder samples en zonder opgenomen stemmen. Elk nummer heeft zijn eigen instrumenten, groove en volgorde.

- **Lolly Sings** is een familie van stations. Het oorspronkelijke Lolly Sings is helder en melodieus: majeurtoonsoorten, een leidende melodie in elk nummer en bossa-, shuffle- en chiptuneklanken. Elk genre heeft ook zijn eigen station, van Sugar en K-pop tot Country, Jazz, Metal en D&B.
- De **Lofi stations** (Warm, Late night en Rainy) zijn eindeloze lo-fi-beats.

Op een gegenereerd station wissel je met volgende en vorige tussen nummers. Elk nummer komt voort uit een beginwaarde, zodat het overal hetzelfde klinkt wanneer je het deelt of opslaat (zie [Gegenereerde muziek](/info/generated-music.html)). Onder de afspeelbediening wisselt **Mood** tussen de Lofi-stations, haalt **Drums** het drumstel weg en loopt **Texture** van zuiver tot een stoffige plaat. Daarna volgt een rij pictogramknoppen. Houd de aanwijzer boven een knop of druk er lang op om de naam te zien:

- De muzieknoot, **Open in the music generator**, opent het nummer op `#/music`, waar je de instrumenten per sectie kunt veranderen.
- De link, **Share this tune or moment**, biedt een link die hetzelfde nummer afspeelt of een die ook op jouw huidige punt begint en de visualiser met je huidige preset en kleuren toont.
- De map, **Save to library**, bewaart het nummer in je assets.
- De bliksemschicht, **Light visualiser**, is een schakelaar die hieronder wordt beschreven.

Een opgeslagen nummer staat onder de groep van zijn station, op toonsoort en tempo. Als je het opgeslagen nummer kiest, speelt hetzelfde nummer opnieuw, herhalend zoals elke track of doorgaand in vooruitmodus. Alleen het station en het nummer van de melodie worden opgeslagen, een paar bytes, en de muziek wordt tijdens het afspelen opnieuw gecomponeerd. Je kunt een opgeslagen nummer in je assets hernoemen of verwijderen en het als achtergrondmuziek voor een video gebruiken. Lolly Demo en Lolly Start bevatten elk zes opgeslagen nummers.

De visualiser hoort elke track op een vast niveau, zodat een zachte track het beeld evenveel laat bewegen als een luide, bij elk volume. Elk Lolly Sings-genre en een daaruit opgeslagen nummer biedt **Light visualiser**: eenvoudige niveaubalken die de muziek de nodige verwerkingstijd geven. Light visualiser staat bij het starten aan voor aanraakschermen en voor apparaten met vier of minder kernen of 4 GB geheugen of minder.
:::

Je kunt de interface met het toetsenbord bedienen. Aangepaste bedieningselementen hebben labels voor schermlezers. Het live voorbeeld van elke tool is één afbeelding met een label dat beschrijft wat er te zien is.

### Opslag

De opslagmeter toont elke byte die deze installatie bewaart, per categorie, afgezet tegen wat de browser meldt.

![De opslagmeter, die opgeslagen sessies, afbeeldingen en cache uitsplitst en afzet tegen wat de browser daadwerkelijk meldt](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Onder de meter:

- **Move to another device** bevat **Export my data**, **Import data…** en **Export my data & render everything**. [Je werk naar een ander apparaat verplaatsen](/info/find-your-work.html#move-your-work-to-another-device) loopt ze door.
- **Clear cache** verwijdert gedownloade catalogusbestanden, die opnieuw worden gedownload wanneer ze nodig zijn.
- **Remove automatic checkpoints older than 30 days** maakt ruimte vrij in History en behoudt opgeslagen en benoemde versies.
- **Clear all my data** verwijdert alles wat Lolly in deze browser bewaart, nadat je een woord hebt getypt ter bevestiging. [Als je je browsergegevens wist](/info/find-your-work.html#if-you-clear-your-browser-data) somt op wat verdwijnt.

### Offline beschikbaar

Lolly cachet alleen de schermen die je hebt bezocht. **Available offline** downloadt de onderdelen die je nodig hebt, met één voortgangsbalk, en ze blijven zonder verbinding werken.

- <!--i:monitor--> **App, catalogue and guides** - **De app** (elke weergave, editor en elk lettertype, ook schermen die je nog nooit hebt geopend), de **Catalogue** (helemaal, of **Choose by tag**) en **Guides & docs** (deze documentatie in je taal, inclusief schermafbeeldingen).
- <!--i:cpu--> **AI models** - elk model dat op het apparaat draait op een eigen rij met zijn grootte: Speech voices, Upscaling models, Background removal, Text recognition, Lolly Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector en Singing voices. Een model van meer dan 50 MB krijgt het label **large download**.
- <!--i:wrench--> **Tools** - elke tool wordt apart gedownload, of **Download all** haalt alle tools op. Een vinkje betekent klaar voor offline gebruik.

**Download everything** bovenaan haalt de app, het gekozen deel van de catalogus, de gidsen en alle tools op. Vink **Include all the AI models** aan om de modellen toe te voegen, of download een model vanaf zijn eigen rij. De zangstemmen kun je alleen vanaf hun eigen rij downloaden. Het beleid van een organisatie kan AI-downloads uitschakelen. De rijen geven dat dan aan.

Downloads gaan verder waar ze stopten als je annuleert of de verbinding verliest. Zodra je weer online bent, worden ze vernieuwd en wordt alleen opgehaald wat een release heeft gewijzigd. Als de browser geen permanente opslag heeft toegestaan, vraagt **Protect downloads** om die toestemming. Zonder die toestemming kan de browser downloads verwijderen wanneer hij de ruimte weer nodig heeft.

### Lolly-instantie

**Lolly instance** geeft aan waar deze installatie zijn tools en catalogus vandaan haalt: het adres van een instantie, of *Bundled with this app* wanneer alles in de build is meegeleverd.

- **Design-system source** toont waar het meegeleverde design system vandaan komt.
- **Instance console** opent de beheerpagina's van een installatie, als die ze aanbiedt.
- **Change** laat de desktopapp een andere instantie gebruiken. Een browser kan geen tools en assets van andere origins laden, dus op het web biedt de sectie in plaats daarvan **Open a workspace**.
- **Leave** verwijdert het design system, de tools en de catalogus van de instantie. Je eigen werk blijft bewaard. Zie [Lolly gebruiken bij je organisatie](/info/organisation.html#leaving).
- Als je bent aangemeld bij een organisatie, beëindigt **Sign out** deze sessie en beëindigt **Sign out everywhere** je sessies op elk apparaat, ook dit apparaat.

<!--i:eti-monitor-->
## Dit apparaat

- <!--i:monitor--> **This Machine** - scherm, invoer, grafische hardware, geheugen, codecs, opslagbackend en meer, live uit deze sessie gelezen. Er wordt niets opgeslagen of verstuurd. Op een breed scherm opent dit paneel vanzelf en gebruikt het tabblad twee kolommen.
- <!--i:neurobeat--> **Sound** - de interfacegeluiden en de Neurospicy-focusloops. Sound is de enige schakelaar op dit tabblad die iets opslaat.
- <!--i:database--> **Storage** - een alleen-lezenweergave van de meter. Wis of verplaats je gegevens in [Voorkeuren](#storage).

<!--i:eti-palette-->
## Design system

Het actieve design system, overzichtelijk weergegeven. Als deze browser twee of meer design systems bevat, staan ze bovenaan in een strook met omslagen. Kies er een om het actief te maken. **Undo** in de melding die volgt zet het vorige terug.

![Het tabblad Design system bij Lolly Demo: een strook omslagen om tussen systemen te wisselen, dan de omslag met het logo, de naam, de notitie en de aantallen die elke pagina openen](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Het tabblad opent met een omslag in de eigen kleuren van het systeem, met het logo, de naam in het displaylettertype en de notitie van de maker. Een rij met aantallen op de omslag linkt naar elke pagina:

- <!--i:palette--> **Colour** - de achtergrond-, tekst-, primaire en secundaire kleur van de lichte en donkere look, elke benoemde kleur als chip met naam en hexwaarde, een strook voor elke tintreeks en het diagramkleurenspectrum, en de kleurrollen in een inklapbare sectie. Selecteer een waarde om de hexwaarde te kopiëren.
- <!--i:font--> **Type** - Headings, Text, Emphasis en Code, elk in het eigen lettertype.
- <!--i:photos--> **Logos** - elk logobestand op de achtergrond waarvoor het is gemaakt.
- <!--i:layers--> **Colourways** - het lichte en donkere paar van elke colourway, als het systeem er meer dan één heeft.
- <!--i:sliders--> **Tokens** - hoekradius, tussenruimte, effecten en kleurverlopen.
- <!--i:document--> **Print & CMYK** - de kleuren die aan een exacte inkt zijn gekoppeld en de drukcondities die een CMYK-PDF kan vermelden.

Wisselen is de enige wijziging die je op dit tabblad kunt doen. Bewerk een design system in [Lolly Design System Setup](/info/brand-studio.html) op `#/start`, waar de omslag naartoe linkt. Een systeem dat alleen-lezen is, vermeldt dat op de omslag. Lokale systemen die je maakt blijven bewerkbaar. `/b` en `/brand` zijn korte links naar dit tabblad.

<!--i:eti-grid-->
## Mogelijkheden

Elk onderdeel van het platform heeft een kaart, in twaalf groepen: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control en Architecture (for builders). Elke groep is inklapbaar en toont het aantal kaarten. Een kaart opent een dialoog met de functies van die mogelijkheid en, bij ongeveer de helft van de kaarten, de schermafbeelding uit deze documentatie.

Het zoekveld boven de groepen filtert de kaarten terwijl je typt en opent de groepen met een overeenkomst. Het veld toont hoeveel mogelijkheden het doorzoekt. Als een zoekopdracht niets vindt, staat dat er in woorden.

Dit tabblad beschrijft wat Lolly kan en blijft in lijn met deze gidsen. Het onderzoekt niet het apparaat waarop je werkt; dat doet **This device**.

<!--i:eti-gauge-->
## Activiteit & statistieken

Eerst de build: het aantal geladen tools, exportformaten, omgevingen waarin het platform draait en merkassets in de catalogus. Een paneel **Catalogue** geeft een overzicht van wat deze build bevat.

Dan je eigen werk: **Your activity** telt wat je op dit apparaat hebt gemaakt. **Recent creations** en **Latest exports** zijn stapels waar je doorheen kunt vegen. Ze verschijnen zodra ze iets bevatten. Beide openen een item zoals het was. Deze tellers blijven op het apparaat. Een optionele Lolly Work-instantie houdt eigen [telemetrie en auditrecords van de organisatie](/info/privacy.html#organisation-services-with-lolly-work) bij.

<!--i:eti-link-->
## Deeplinks

Elk tabblad en elke sectie van Settings heeft een eigen link die je kunt bewaren of plakken. [Lolly Search](/info/search.html) bouwt zijn **Settings**-resultaten op uit hetzelfde register als Settings, dus een hernoemde sectie maakt nooit een zoekresultaat ongeldig.

::: details Alle linkvormen

- **Een tabblad:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Een sectie van Preferences:** `#/settings?focus=<section-id>`, zoals `#/settings?focus=offline-section`.
- **Een specifieke sectie:** de id als losse vlag, zoals `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` of `#/settings?cap-formats`. De oudere links `#/settings?dash-lock` en `#/settings?dash-palette-wheel` openen de omslag en de pagina Colour.
- **Een sectie op trefwoord:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (de pagina Colour) of `#/settings?tokens`. Twee secties kunnen een trefwoord delen: `print` hoort zowel bij de drukwerkreferentie van het merktabblad als bij de groep Print production. De eerste in de paginavolgorde krijgt voorrang. Gebruik de id om er een te kiezen.

Een deeplink schakelt naar het tabblad met het doel en opent elke groep waarin het doel is ingeklapt. Daarna scrolt de pagina naar het doel zodra de secties erboven klaar zijn met opmaken. De vervallen adressen `#/platform` en `#/capabilities` openen in Settings met behoud van hun deeplinkvlaggen.
:::

---

**Gerelateerd:** [Profielen](/info/profile.html) voor je gegevens en de contexten waarin je werkt. [Lolly Design System Setup](/info/brand-studio.html) voor het bewerken van wat het tabblad Design system toont. [Je werk terugvinden en herstellen](/info/find-your-work.html) voor opslag, back-ups en overstappen naar een ander apparaat.
