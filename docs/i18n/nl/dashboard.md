# Settings

In Settings wijzig je hoe Lolly voor jou werkt: je gegevens, het design system dat je gebruikt, toegankelijkheid, wat op dit apparaat is opgeslagen en wat offline klaarstaat. Open het met **Settings** in de balk onderaan het startscherm, of via je avatarmenu. Het opent op **Preferences**, met vier andere tabbladen ernaast.

| Tabblad | Adres | Wat het bevat |
|---|---|---|
| **Preferences** | `#/settings` | Je gegevens, design systems, uiterlijk, emoji, toegankelijkheid, verbindingen, opslag en offline downloads |
| **This device** | `#/settings?tab=device` | Een live uitlezing van deze browser en machine, plus geluid en een alleen-lezen opslagweergave |
| **Design system** | `#/settings?tab=brand` | Het actieve design system als omslag en pagina's, met een strook omslagen om van systeem te wisselen |
| **Capabilities** | `#/settings?tab=caps` | Alles wat Lolly kan, als doorzoekbare kaarten |
| **Activity & stats** | `#/settings?tab=activity` | De catalogus, je lokale tellers en recent werk |

Elk tabblad heeft een eigen adres, en oude links naar `#/profile` en `#/d` openen nog steeds de juiste plek, tot op afzonderlijke instellingen.

## Preferences

Preferences is één lange pagina met een **instellingenbalk** langs de zijkant en een veld **Search settings** boven de balk dat tijdens het typen filtert. Elke sectie opent rechtstreeks vanuit een link van de vorm `#/settings?focus=<section-id>`, bijvoorbeeld `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - je naam, contactgegevens en pasfoto, en de schakelaar **Use my details to create**. [Profielen](/info/profile.html) legt uit hoe tools ze gebruiken.
- <!--i:seal--> **Content Credentials** - de optionele geverifieerde identiteit die je exports ondertekent. Zie [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - design systems wisselen, toevoegen, verbergen of verwijderen. [Design System Setup](/info/brand-studio.html#manage-your-design-systems) behandelt elke actie.
- <!--i:moon--> **Appearance** - het thema (Light, Dark of Brand, dat de app in je palet schildert) en **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - de set waaruit je emoji worden getekend wanneer je iets nieuws begint, met de artworklicentie, en hoe sterk je palet ze herkleurt (**Off**, **Subtle**, **Strong**, **Full**, **Mono** of **Duotone**). **Keep skin tones and flags** laat die in hun eigen kleuren. Werk dat je al maakte behoudt de set waarmee het is gemaakt.
- <!--i:eyeoff--> **Accessibility** - vier comfortschakelaars, plus Sound en Neurospicy Mode. Zie [Toegankelijkheid](#accessibility).
- <!--i:link--> **Connected services** - opslag die je koppelt, zoals Dropbox, Google Drive, OneDrive, Nextcloud of S3, en **Sync across devices**. Zie [Je apparaten synchroniseren](/info/sync.html).
- <!--i:globe--> **Trusted sites** - de sites die een Design-webpaginavak of een Sandbox-demo mag benaderen zonder te vragen, en, waar de server het biedt, **Allow pages from any site**. Het [Privacybeleid](/info/privacy.html) noemt wat elk verzoek verstuurt.
- <!--i:download--> **Your renders** - **Save my renders to my library** bewaart een kopie van elke afbeelding, audioclip en video die je downloadt in Assets, onder de tag Renders.
- <!--i:database--> **Storage** - wat Lolly op dit apparaat bewaart, en de knoppen die je gegevens wissen of meenemen. Zie [Opslag](#storage).
- <!--i:cpu--> **Available offline** - download wat je nodig hebt voordat je de verbinding verliest. Zie [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - volg in de desktop-app één map en haal alles wat erin valt naar Lolly, via dezelfde kiezer die een drag-and-drop krijgt.
- <!--i:clock--> **Your activity** - wat je op dit apparaat hebt gemaakt, lokaal geteld.
- <!--i:sliders--> **Feature flags** - zet delen van de app aan of uit, zoals **Print preflight** of **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - waar deze installatie haar tools en catalogus vandaan haalt. Zie [Lolly instance](#lolly-instance).

De themakaarten zijn live voorbeelden en gelden zodra je er een kiest, alleen op dit apparaat.

![Drie themakaarten, elk met een preview van zijn eigen type en kleur, met de actieve gemarkeerd](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Toegankelijkheid

**Settings → Preferences → Accessibility** bevat vier comfortinstellingen voor de app rond je werk. Elke staat uit totdat je hem aanzet, en geen ervan reikt tot in een toolcanvas of een export, zodat een rustigere app nooit een pixel van het bestand dat je verstuurt verplaatst.

- <!--i:pause--> **Reduce motion** zet de overgangen, schuifbewegingen en versieringen van de app uit. Je canvas en elke geanimeerde export blijven bewegen zoals ontworpen.
- <!--i:photos--> **Hide colourful previews** ruilt het previewartwork van de galerij in voor rustige kaarten met pictogram en tekst, en dempt projectminiaturen zodat ze herkenbaar blijven zonder te schreeuwen.
- <!--i:sliders--> **High contrast** versterkt de randen, tekst en focusringen van de app. Je merkkleuren en het canvas blijven zoals je ze instelde.
- <!--i:font--> **Large text** vergroot de labels, menu's en knoptekst van de app. Tekst in je ontwerpen blijft ongemoeid, dus niets wat je exporteert verspringt.

Deze instellingen staan in je profiel, dus ze reizen mee in een profielexport en komen bij de volgende installatie aan met je naam en sessies. Een kleine kopie die alleen op het apparaat staat past ze toe vóór de eerste weergave.

Dezelfde kaart bevat **Sound**, een zachte laag ondersteunende geluiden bij wat je doet (aankomen in de galerij, een resultaat van Content Credentials, een paneel sluiten), en **Neurospicy Mode**, een rustige focustrack. Neurospicy aanzetten opent een kleine speler in de hoek die je door de app volgt. Daar kies je een track, sla je over, stel je het volume in en minimaliseer of sluit je de speler. Tracks zijn onder meer procedurele *Lolly Sings*-deuntjes, ambient loops en beats, je eigen audio en internetradiostations, die een verbinding nodig hebben. Beide staan standaard uit en worden onthouden, en Sound uitzetten dempt ook de focustrack. Het profielmenu en **This device** bevatten dezelfde schakelaar.

De interface is met het toetsenbord te bedienen, aangepaste besturingselementen hebben labels voor schermlezers en het live voorbeeld van elke tool wordt aangeboden als één gelabelde afbeelding die beschrijft wat het toont.

### Opslag

De opslagmeter verantwoordt elke byte die deze installatie bevat, categorie voor categorie, tegen wat de browser meldt.

![De opslagmeter, met een uitsplitsing van opgeslagen sessies, afbeeldingen en cache tegen wat de browser werkelijk meldt](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Onder de meter:

- **Move to another device** heeft **Export my data**, **Import data…** en **Export my data & render everything**. [Je werk naar een ander apparaat verplaatsen](/info/find-your-work.html#move-your-work-to-another-device) loopt ze door.
- **Clear cache** laat gedownloade catalogusbestanden vallen, die opnieuw worden gedownload wanneer nodig.
- **Remove automatic checkpoints older than 30 days** maakt ruimte in History vrij en behoudt opgeslagen en benoemde versies.
- **Clear all my data** verwijdert alles wat Lolly in deze browser bewaart, nadat je een woord typt om te bevestigen. [Als je je browsergegevens wist](/info/find-your-work.html#if-you-clear-your-browser-data) noemt wat er verdwijnt.

### Available offline

Lolly zet schermen in de cache terwijl je ze bezoekt, wat alleen dekt waar je al geweest bent. **Available offline** is voor de reis die je ziet aankomen: download de onderdelen die je nodig hebt en kijk naar één voortgangsbalk, en alles wat je meenam blijft zonder verbinding werken.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (elke weergave, editor en elk lettertype, ook schermen die je nooit opende), de **Catalogue** (alles, of **Choose by tag**) en **Guides & docs** (deze documentatie in jouw taal, screenshots inbegrepen).
- <!--i:cpu--> **AI models** - elk model op het apparaat op een eigen rij met zijn grootte: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector en Singing voices. Een model boven 50 MB is gemarkeerd als **large download**.
- <!--i:wrench--> **Tools** - elke tool downloadt apart, of **Download all** neemt elke tool. Een vinkje betekent klaar voor offline.

**Download everything** bovenaan neemt de app, de gekozen catalogusomvang, de gidsen en alle tools. Vink **Include all the AI models** aan om de modellen toe te voegen, of download een model via zijn eigen rij; de zangstemmen worden alleen gedownload via hun eigen rij. Het beleid van een organisatie kan AI-downloads uitzetten, en de rijen zeggen dat dan.

Downloads hervatten waar ze stopten als je annuleert of de verbinding verliest, en verversen zichzelf wanneer je weer online bent, waarbij alleen wordt opgehaald wat een release wijzigde. Als de browser geen permanente opslag heeft verleend, vraagt **Protect downloads** erom: het verschil tussen "gedownload" en "gedownload totdat de browser de ruimte terug wil".

### Lolly instance

**Lolly instance** zegt waar deze installatie haar tools en catalogus vandaan haalt: het adres van een instantie, of *Bundled with this app* wanneer alles in de build wordt meegeleverd.

- **Design-system source** toont waar het geleverde design system vandaan komt.
- **Instance console** opent de beheerpagina's van een implementatie, waar die ze biedt.
- **Change** richt de desktop-app op een andere instantie. Een browser kan geen tools en assets over origins heen laden, dus op het web biedt de sectie **Open a workspace** in plaats daarvan.
- **Leave** verwijdert het design system, de tools en de catalogus van de instantie, en je eigen werk blijft. Zie [Lolly gebruiken bij je organisatie](/info/organisation.html#leaving).
- Wanneer je bent aangemeld bij een organisatie beëindigt **Sign out** deze sessie en beëindigt **Sign out everywhere** je sessies op elk apparaat, dit apparaat inbegrepen.

## This device

- <!--i:monitor--> **This Machine** - scherm, invoer, graphics, geheugen, codecs, opslagbackend en meer, live uitgelezen uit deze sessie. Er wordt niets opgeslagen en niets verstuurd. Het opent vanzelf op een breed scherm, waar het tabblad zich in twee kolommen uitlegt.
- <!--i:neurobeat--> **Sound** - de interfacegeluiden en de Neurospicy-focusloops, de enige schakelaar op dit tabblad die iets schrijft.
- <!--i:database--> **Storage** - een alleen-lezen weergave van de meter in [Preferences](#storage), waar je je gegevens wist of meeneemt.

## Design system

Het actieve design system, uitgelegd om te lezen. Wanneer deze browser twee of meer design systems bevat, somt een strook kleine omslagen bovenaan ze op: kies er een om het actief te maken, en **Undo** in de melding die volgt zet het vorige terug.

![Het tabblad Design system op Lolly Demo: een strook omslagen om van systeem te wisselen, dan het omslag met logo, naam, notitie en de aantallen die elke pagina openen](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Het tabblad opent op een omslag geschilderd in de eigen kleuren van het systeem, met zijn logo, zijn naam in zijn displaylettertype en de notitie die de maker schreef. Een regel met aantallen op het omslag linkt naar elke pagina:

- <!--i:palette--> **Colour** - de vlakken, tekst, primaire en secundaire kleur van de lichte en donkere looks, elke benoemde kleur als chip met naam en hex, een band voor elk tintverloop en het grafiekspectrum, en de kleurrollen in een uitklapper. Selecteer een waarde om de hex te kopiëren.
- <!--i:font--> **Type** - Headings, Text, Emphasis en Code, elk gezet in een eigen lettertype.
- <!--i:photos--> **Logos** - elk logobestand op de ondergrond waarvoor het is gemaakt.
- <!--i:layers--> **Colourways** - het lichte en donkere paar van elke colourway, wanneer het systeem er meer dan één heeft.
- <!--i:sliders--> **Tokens** - radius, spacing, effecten en verlopen.
- <!--i:document--> **Print & CMYK** - de kleuren die aan een exacte inkt zijn vergrendeld, en de drukcondities die een CMYK-PDF kan declareren.

Wisselen is de enige wijziging die dit tabblad maakt. Je bewerkt een design system in [Design System Setup](/info/brand-studio.html) op `#/start`, waar het omslag naar linkt. Een alleen-lezen systeem zegt dat op zijn omslag; lokale systemen die je maakt blijven bewerkbaar. `/b` en `/brand` zijn korte links rechtstreeks naar dit tabblad.

## Capabilities

Elk onderdeel van het platform is uitgeschreven als kaart, in twaalf groepen: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control en Architecture (for builders). Elke groep klapt in en toont zijn aantal kaarten. Een kaart opent in een dialoog met de functies van die capability en, bij ongeveer de helft, de screenshot die deze documentatie gebruikt.

Het zoekveld boven de groepen filtert de kaarten tijdens het typen en opent de groepen die nog een treffer bevatten. Het zegt hoeveel capabilities het doorzoekt, en een zoekopdracht zonder treffer zegt dat in woorden.

Dit tabblad is geschreven documentatie van wat Lolly kan, in de pas gehouden met deze gidsen. Het onderzoekt de machine waarop je zit niet; **This device** doet dat.

## Activity & stats

Eerst de build: hoeveel tools zijn geladen, hoeveel exportformaten er zijn, op hoeveel oppervlakken het platform draait en hoeveel merkassets de catalogus bevat, met een paneel **Catalogue** dat uitsplitst wat in deze build wordt meegeleverd.

Dan je eigen kant: **Your activity** telt wat je op dit apparaat hebt gemaakt, en **Recent creations** en **Latest exports** zijn stapels waar je doorheen kunt vegen, elk verschijnend zodra er iets te tonen is. Beide openen een item zoals het was. Deze tellers blijven op het apparaat; een optionele Lolly Work-instantie houdt haar eigen [organisatietelemetrie en auditrecords](/info/privacy.html#organisation-services-with-lolly-work) bij.

## Diepe links

Elk tabblad en elke sectie van Settings heeft een eigen link, die je kunt bookmarken of plakken. [Zoeken](/info/search.html) richt zijn **Settings**-resultaten op hetzelfde register waaruit Settings rendert, zodat een sectie niet kan worden hernoemd zonder dat een zoekresultaat meegaat.

::: details Elke vorm van link

- **Een tabblad:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Een sectie van Preferences:** `#/settings?focus=<section-id>`, zoals `#/settings?focus=offline-section`.
- **Een sectie, exact:** zijn id als kale vlag, zoals `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` of `#/settings?cap-formats`. De oudere links `#/settings?dash-lock` en `#/settings?dash-palette-wheel` openen het omslag en de pagina Colour.
- **Een sectie op trefwoord:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (de pagina Colour) of `#/settings?tokens`. Trefwoorden kunnen gedeeld zijn: `print` hoort bij zowel de drukreferentie van het merktabblad als de groep Print production, en de eerste in paginavolgorde wint. Gebruik de id wanneer het uitmaakt welke.

Een diepe link schakelt naar het tabblad dat het doel bezit, opent elke groep waarin het is ingeklapt en scrolt er dan naartoe, en wacht even terwijl de secties erboven klaar zijn met uitleggen. De vervallen adressen `#/platform` en `#/capabilities` vloeien samen in Settings met hun diepe-linkvlaggen intact.
:::

---

**Zie ook:** [Profielen](/info/profile.html) voor je gegevens en de contexten waarin je maakt. [Design System Setup](/info/brand-studio.html) om te bewerken wat het tabblad Design system toont. [Je werk vinden en terughalen](/info/find-your-work.html) voor opslag, back-ups en van apparaat wisselen.
