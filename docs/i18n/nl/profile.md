# Profielen - wie je bent wanneer je creëert

Een **profiel** is de werkidentiteit waaronder Lolly creëert. Het is de kleine set gegevens waar een tool uit kan putten zodat jij ze niet elke keer opnieuw hoeft te typen - je naam, contactgegevens, een optionele pasfoto, een paar voorkeuren - plus alles wat je opbouwt terwijl je werkt: opgeslagen sessies, geüploade afbeeldingen en de lokale activiteitenteller.

Alles in een profiel leeft **op het apparaat**, in de lokale database van de browser (IndexedDB in de web-PWA, het bestandssysteem in de Tauri-apps). Er is geen account en er wordt niets geüpload. Je beheert het onder **Profiel** (rechtsboven in de galerij); tools *lezen* het alleen ooit, en alleen de specifieke velden waarvoor ze zijn gebouwd om vooraf in te vullen.

> Een profiel gaat over *jou* (of wie er hier ook aan het creëren is). Het staat los van het **Platform** - de kleuren, fonts en globale instellingen van het merk - en van **Capabilities**, de catalogus van wat de app kan. Zie [Profiel vs Platform vs Capabilities](#profile-vs-platform-vs-capabilities) aan het einde.

## Wat er in een profiel zit

| Onderdeel | Wat het is |
|---|---|
| **Naam** | Voor- en achternaam. |
| **Contact** | E-mail en telefoon. |
| **Locatie** | Stad en land. |
| **Pasfoto** | Een optionele foto, bijgesneden tot een vierkant en lokaal bewaard op dit apparaat. Gebruikt door tools zoals e-mailhandtekeningen, offertekaarten, organogrammen en dynamische lay-outs. |
| **Mijn gegevens gebruiken voor het maken van** | Eén opt-in schakelaar (staat er **Mijn gegevens worden gebruikt** als hij aan staat). Hij bepaalt of je persoonlijke gegevens meeliften als **herkomst** - de auteur/creditregel ingebed in geëxporteerde bestanden - en als de auteur bij **/pro** batchruns. (Hij bepaalt niet of gegevens vooraf ingevuld worden: zie [Hoe tools je profiel gebruiken](#how-tools-use-your-profile).) |
| **Voorkeuren** | Je thema (Light, Dark of Brand - het merkthema kleurt de app in je eigen palet) en welke onderdelen van de app je hebt ingeschakeld via **Feature flags**. |
| **Toegankelijkheid** | Vier comfortschakelaars - *Beweging beperken*, *Kleurrijke previews verbergen*, *Hoog contrast*, *Grote tekst* - die op het profielrecord staan, zodat ze meegaan in een profielexport. Zie [Toegankelijkheid](#accessibility). |
| **Je werk** | Opgeslagen sessies (met miniaturen) - georganiseerd in geneste mappen in **[Projecten](/info/using.html)** - je **Mijn afbeeldingen** bibliotheek en de lokale activiteitsstatistieken, allemaal gekoppeld aan dit profiel. |

![Three theme cards, each previewing its own type and colour, with the active one flagged](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

![Het Profielscherm - naam, contact, een optionele pasfoto en je voorkeuren](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Niets hiervan is verplicht. Een leeg profiel is een prima profiel; je vult alleen in wat je typewerk bespaart.

De pagina is lang, dus heeft hij een eigen **instellingenrail** aan de zijkant - Jouw gegevens, Weergave, Toegankelijkheid, Lolly-instantie, Jouw activiteit, Opslag, Beschikbaar offline, Feature flags, Content Credentials - met een **Instellingen zoeken** veld erboven dat de lijst filtert terwijl je typt. Elke sectie is diep te linken als `#/profile?focus=<section-id>`, wat hem opent en in beeld scrolt (`#/profile?focus=storage-section`, `?focus=feature-flags-section`, enzovoort), zodat een link naar één instelling kan verwijzen in plaats van naar de bovenkant van de pagina.

![Drie themakaarten, elk met een preview van zijn eigen type en kleur, met de actieve gemarkeerd](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Een profiel is een context, niet alleen een persoon

Het woord "profiel" doet een vaste persoon vermoeden, maar in Lolly is het eigenlijk een **creatiecontext** - *wie je bent terwijl je dit ding maakt*. Die context kan drie verschillende vormen aannemen, en Lolly behandelt ze allemaal op dezelfde manier.

### Als individu

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![De pasfotobediening, leeg totdat je een foto uploadt die vervolgens op dit apparaat blijft](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Als team

Een profiel hoeft niet één enkel mens te zijn. Het kan staan voor een **team of functie binnen een organisatie**: de gedeelde naam van het team, een groepsinbox-adres (`events@…`), een afdeling, de pasfoto van het team of een eenheidsmerk. Eén persoon zet het op, exporteert het (zie hieronder) en de rest van het team laadt hetzelfde profiel - zodat alles wat het team produceert consistente gegevens draagt zonder dat iemand ze opnieuw hoeft in te voeren. Een gedeelde kiosk of een uitgeleende demolaptop kan een enkel teamprofiel draaien waaronder iedereen erachter creëert.

### Als functie - een rol die je soms draagt

Dit is het geval dat het starre model van "één persoon, één profiel" over het hoofd ziet. Misschien ben je **drie dagen per jaar eventmanager** en de rest van de tijd iets heel anders. Die drie dagen wil je eventgegevens, de eventinbox, misschien een event-submerk om je badges en bewegwijzering mee in te vullen; de andere 362 dagen wil je je normale identiteit terug.

In Lolly is die rol gewoon **een ander profiel dat je bij de hand houdt** - een opgeslagen bundel (volgende sectie) die je laadt voor het event en daarna weer opzij zet. De rol is een hoedje, geen nieuw account. Zet het op wanneer je het nodig hebt, doe het af wanneer je klaar bent.

## Eén installatie, één actief profiel - meerdere die je kunt bewaren

Op elk moment heeft een installatie **één actief profiel** - de gegevens die een tool op dat moment ziet. Er is geen profielwisselaar in de app; in plaats daarvan is elk profiel een **draagbaar pakket** (één `.zip`, zie [hieronder](#moving-a-profile-to-a-new-device)). Dat is bewust hetzelfde mechanisme als verhuizen naar een nieuw apparaat - een profiel is een bestand dat je kunt opslaan, kopiëren en laden.

![The storage meter, breaking down saved sessions, images and cache against what the browser actually reports](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

- <!--i:trash--> **Schoonste wissel:** **Profiel → Opslag → Al mijn gegevens wissen**, en vervolgens het pakket **importeren** voor de context waar je naartoe gaat. Je maakt nu puur als dat profiel.
- <!--i:layers--> **Laagsgewijs:** importeren *zonder* eerst te wissen **voegt samen** - het geïmporteerde profiel, de sessies en de afbeeldingen komen boven op wat er al staat, waarbij alles met dezelfde naam wordt vervangen en de rest blijft staan. Handig om de opgeslagen sessies van één team in je eigen opstelling te trekken; niet wat je wilt als je een schone rolgrens nodig hebt.
- <!--i:monitor--> **Naast elkaar:** omdat alles apparaatgebonden is, draagt een apart browserprofiel, een apart gebruikersaccount of een tweede geïnstalleerde PWA elk zijn eigen onafhankelijke Lolly-profiel. Draai je persoonlijke installatie en de eventkiosk-installatie tegelijk, zonder te wisselen.

Dus als je echt met meerdere contexten jongleert (jij, je team, het eventmanager-hoedje), bewaar je meerdere bundels en laad je degene die je nodig hebt:

![De opslagmeter, die opgeslagen sessies, afbeeldingen en cache uitsplitst tegenover wat de browser daadwerkelijk rapporteert](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Bewaar per context een bundel en hernoem de bestanden naar wat ze zijn (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Het bestand *is* het profiel.

## Toegankelijkheid

**Profiel → Toegankelijkheid** bevat vier comfortinstellingen voor de app *rond* je werk. Elke instelling staat uit tot je hem aanzet, en geen enkele reikt tot binnen een toolcanvas of een export - een rustigere app mag geen pixel verplaatsen van het bestand dat je aflevert.

- <!--i:film--> **Beweging beperken** - schakelt de overgangen, sleep-animaties en geanimeerde flair in de app uit. Je toolcanvas en elke geanimeerde export blijven precies bewegen zoals ontworpen.
- <!--i:image--> **Kleurrijke previews verbergen** - wisselt de galerij-previewafbeeldingen om voor rustige icoon-en-tekstkaarten, en verlaagt de kleur en het contrast van je projectminiaturen zodat ze herkenbaar blijven zonder te schreeuwen. Binnen een tool wordt alles in volle kleur getoond.
- <!--i:sliders--> **Hoog contrast** - versterkt de randen, tekst en focusringen van de app. Je merkkleuren en alles op het canvas blijven precies zoals je ze hebt ingesteld.
- <!--i:font--> **Grote tekst** - vergroot het lettertype van de app: labels, menu's en knoptekst. De bedieningselementen behouden hun grootte, dus alleen de woorden erin worden groter, en tekst binnen je ontwerpen blijft ongewijzigd, dus niets wat je exporteert vloeit opnieuw.

Deze staan op het profielrecord zelf, waarom ze meereizen in een profielexport en op de volgende installatie terechtkomen naast je naam en je sessies. (Het apparaat houdt ook een kleine lokale spiegel bij zodat de instelling geldt voor de eerste weergave; die spiegel is alleen op het apparaat en reist niet mee.)

## Jouw Lolly-instantie

**Profiel → Lolly-instantie** laat zien waar deze installatie zijn tools en catalogus vandaan haalt - het adres van de instantie, of *Gebundeld met deze app* wanneer alles binnen de build meegeleverd wordt. Waar een implementatie er een aanbiedt, opent een **Instantieconsole**-link het beheeroppervlak, en **Wijzigen** / **Loskoppelen** verwijzen de installatie opnieuw of maken hem los.

Opnieuw verwijzen naar een andere instantie vereist de **desktop-app**: een browser blokkeert het laden van tools en assets over verschillende origins heen door een pagina, dus op het web meldt de sectie waar je bent en laat het daarbij.

## Beschikbaar offline

Lolly cachet terwijl je werkt, maar caching-terwijl-je-werkt dekt alleen waar je al bent geweest. **Profiel → Beschikbaar offline** is voor de reis die je aan ziet komen: een uur op luchthaven-wifi voor een vlucht zonder wifi. Download de onderdelen die je nodig hebt, kijk naar één voortgangsbalk, en alles wat je meenam blijft werken zonder verbinding.

Zeven onderdelen, elk met de grootte vermeld voordat je toezegt:

- <!--i:layout--> **De app** - elke weergave, editor en lettertype, inclusief die je nog niet hebt geopend. Zonder dit kan een scherm dat je online nooit hebt bezocht offline niet laden.
- <!--i:image--> **Catalogus** - merkassets naast de essentiële. Neem alles, of open *Kiezen op tag* en neem alleen de tags die je gebruikt.
- <!--i:book--> **Gidsen & documentatie** - deze documentatiesite, in je taal, screenshots inbegrepen.
- <!--i:cpu--> **Spraakstemmen** - de stemmodellen achter Script-audio en vertelling. Eenmalig gedownload, daarna draait het op het apparaat.
- <!--i:zap--> **Upscaling-modellen** - de AI-beeldupscalers: foto, illustratie/anime en gezicht.
- <!--i:layers--> **Achtergrond verwijderen** - de on-device uitknip-modellen achter *Achtergrond verwijderen*.
- <!--i:shield--> **Verify diepe scan** - de on-device watermerkscanner, voor het controleren van Content Credentials zonder verbinding.

De laatste vier zijn gemarkeerd als **grote download**, en het zijn bewust individuele opt-ins: **Alles downloaden** bovenaan neemt de app, de catalogusreikwijdte die je hebt gekozen, de documentatie en alle tools in één keer en niets anders. Spraakstemmen, de upscalers, achtergrond verwijderen en de diepe scan downloaden elk alleen wanneer je die rij expliciet aanvraagt - een paar honderd megabyte verstopt in één knop zou oneerlijk zijn.

Onder de onderdelen staat de lijst per tool: elke tool downloadt afzonderlijk (het vinkje betekent offline gereed), of **Alles downloaden** veegt ze allemaal mee. Downloads zijn hervatbaar - annuleer of verlies de verbinding en de volgende run pakt op waar hij stopte, alleen wat ontbreekt wordt opgehaald - en ze vernieuwen zichzelf zodra je weer online bent, waarbij alleen wordt opgehaald wat een nieuwe release heeft veranderd.

Als de browser geen persistente opslag heeft toegekend, meldt de sectie dat en biedt **Downloads beschermen** aan, wat erom vraagt - het verschil tussen "gedownload" en "gedownload totdat de browser de ruimte terug wil".

## Een profiel verplaatsen naar een nieuw apparaat

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Omdat een profiel volledig lokaal is, is de enige manier om het op een lege installatie te krijgen - een nieuwe laptop, een net gereset browser, de machine van een collega, een offline machine - door **het bestand mee te nemen**. Geen enkele login herstelt het voor je, en dat is precies het punt: er heeft nooit iets je apparaat verlaten.

- <!--i:download--> **Export my data** (Mijn gegevens exporteren) downloadt één `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - genoemd naar het profiel waartoe het behoort, met een dagelijks volgnummer zodat herhaalde exports niet botsen (naamdelen vervallen wanneer het profiel ze niet heeft). Het bevat je profiel, elke opgeslagen sessie (met miniatuur), je geüploade afbeeldingen - je merktokens en geïnstalleerde lettertypen liften mee als gebruikersassets - en je voorkeuren (thema, layout, lokale activiteitsstatistieken).
- <!--i:upload--> **Import data…** (Gegevens importeren…) op de andere installatie leest dat bestand weer in, en je gaat precies verder waar je gebleven was.
- <!--i:box--> **Export my data & render everything** (Mijn gegevens exporteren & alles renderen) schrijft diezelfde back-up *plus* een tweede zip die elke opgeslagen sessie rendert naar het bijbehorende definitieve uitvoerbestand, in mappen die je Projecten weerspiegelen. Een compleet offline archief van zowel de bronnen als de resultaten - en dit kan groot en traag zijn bij veel sessies.

![De twee knoppen die een hele installatie verplaatsen: Mijn gegevens exporteren schrijft één zip, Gegevens importeren leest hem weer in](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

De bundel is een gewone, zelfstandige zip, dus hij reist met **elk** middel - USB, AirDrop, een netwerkshare, e-mail naar jezelf - en het doelapparaat kan volledig offline zijn. Elk onderdeel heeft een checksum, zodat een bestand dat onderweg beschadigd raakt bij het importeren wordt opgemerkt in plaats van half kapot te worden hersteld. Importeren **voegt samen** (profiel/sessie/afbeelding met dezelfde naam wordt overschreven; al de rest blijft behouden), zodat een doel dat al in gebruik was nooit wordt gewist.

Wat niet meereist: de catalogus-cache (die download zichzelf opnieuw op het nieuwe apparaat) en de tools zelf (waarvan wordt aangenomen dat ze al aanwezig zijn).

Voor de exacte pakketopbouw, versiebeleid en integriteitsregels, zie **[Gegevensoverdracht](/info/data-transfer.html)**; voor de complete doorloop, **[Lolly gebruiken → Verhuizen naar een ander apparaat](/info/using.html#moving-to-another-device)**.

## Hoe tools je profiel gebruiken

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Een tool *vult* alleen ooit de profielvelden *vooraf in* die het expliciet is gebouwd om te koppelen:

**De opt-in (herkomst).** Wanneer je een asset exporteert, liften je gegevens optioneel mee als **herkomst** - een auteur/creditregel ingebed in de metadata van het bestand (PNG, PDF, SVG, …) - zodat een afgewerkte asset kan aangeven wie hem gemaakt heeft. *Dit* is wat **Mijn gegevens gebruiken voor het maken van** bepaalt: laat hem uit en de export draagt nog steeds de "Made with Lolly" tool-/platformattributie, maar er wordt geen persoonlijke auteur-/contactregel ingebed. (Dezelfde opt-in stelt de auteur in bij **/pro** batchruns.) (Toolauteurs: zie [Tools schrijven → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) en [Host API → `host.profile`](/info/host-api.html#host-profile).)

![De enkele schakelaar Mijn gegevens gebruiken voor het maken van, naast Profiel opslaan en uit totdat je hem aanzet](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profiel versus Platform versus Mogelijkheden

Drie dingen staan dicht bij elkaar in de UI en zijn makkelijk te verwarren:

- <!--i:people--> **Profiel** - *jij* (of je team, of de rol die je vervult): naam, contact, pasfoto, je opgeslagen werk. Persoonlijk, apparaatgebonden, draagbaar als pakket.
- <!--i:palette--> **Platform** - het *merk*: kleuren, lettertypen en globale instellingen waartegen elke tool rendert. Gedeeld en consistent, niet persoonlijk.
- <!--i:sliders--> **Mogelijkheden** - *wat de app kan*: de volledige functieset en de tools die voor jou beschikbaar zijn.

Een profiel verandert van wie een asset *afkomstig* is; het platform verandert hoe het *eruitziet*; mogelijkheden bepalen *wat je kunt maken*.

### "Profiel" betekent elders twee andere dingen - niet dit

Het woord wordt in het hele project op meerdere manieren gebruikt. Geen van beide is het persoonlijke profiel waarover deze pagina gaat:

- <!--i:box--> **Content profile** - een configuratie ten tijde van build in `profiles.json` die een set toolpakketten koppelt aan een merkcatalogus (bijv. `suse`, `lolly-start`). Het is wat een operator kiest bij het deployen, en het is ook wat de `profile` **URL/CLI-parameter** kiest als een *kleur*variant bij export (de ICC/CMYK-drukconditie - zie [URL Mode](/info/url-mode.html)). Beide gaan over de *build/uitvoer*, niet over *jou*. Zie [Configuratie](/info/configuration.html).
- <!--i:seal--> **Identity profile** - de optionele **geverifieerde Content Credentials-identiteit** die je kunt inschrijven (een kortlevend certificaat dat je e-mail koppelt aan je ondertekende exports). Dat is een ondertekeningsidentiteit, los van de naam-/contactvelden van het persoonlijke profiel, hoewel **Mijn gegevens gebruiken voor het maken van** bepaalt of een van beide wordt ingebed. Zie [Content Credentials Identity](/info/content-credentials-identity.html).

![De kaart Geverifieerde identiteit, telefoonbreedte: de certificaatlevensduurkiezer en de inschrijvingsstap eronder - het identiteitsprofiel, los van je persoonlijke gegevens](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Privacy

Buiten de optionele identiteitsinschrijving hierboven (die het e-mailadres waarmee je je inschrijft naar de certificaatservice stuurt - zie [Server Surface](/info/server-surface.html)), wordt een profiel nooit verzonden, geüpload of gebruikt om je te identificeren of te volgen - er is niets om toestemming voor te geven, alleen deze mededeling zodat je weet wat er bewaard wordt. Wis alles op elk moment met **Profiel → Al mijn gegevens wissen**. Zie het [Privacybeleid](/info/privacy.html).
