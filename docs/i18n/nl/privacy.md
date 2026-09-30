# Privacybeleid

*Laatst bijgewerkt: 11 augustus 2026*

> **De korte versie.** De documenten, afbeeldingen, video's en bestanden die je in Lolly
> maakt, blijven op je apparaat. Er zijn geen accounts nodig voor gewoon gebruik, geen
> cookies van de app zelf en nergens in de codebase analytics of trackers - niet "we
> gebruiken de data niet," maar écht niet aanwezig in de bron. Er bestaat een korte,
> volledige lijst uitzonderingen voor de gevallen waarin de software überhaupt met een
> netwerk praat, en elk daarvan wordt hieronder concreet beschreven: wat er weggaat,
> naar wie en wanneer. De enige uitzondering die iets persoonlijks betreft, is een
> aanmelding die je expliciet moet starten. Staat het niet in dit document, dan gebeurt
> het niet.

## Wat dit beleid dekt

Lolly is open-source software - een engine, meerdere app-shells (web, desktop,
mobiel, CLI) en een browserextensie - die iedereen kan draaien. Dit beleid bestaat uit twee
delen:

- <!--i:code--> **De software zelf**: wat deze wel en niet doet met je data, waar deze ook
  draait. Dit is een eigenschap van de code, dus het geldt voor elke Lolly-implementatie,
  van ons of van iemand anders.
- <!--i:server--> **lolly.tools**, de referentie-implementatie die SUSE beheert: de specifieke keuzes
  die gemaakt zijn bij het draaien van de optionele serveronderdelen ervan (wat er wordt gelogd, hoelang, door
  wie).

Als je een self-hosted of enterprise Lolly-instantie gebruikt, geldt het onderstaande softwaregedrag
nog steeds, maar de *operator* van die instantie - niet SUSE - is
verantwoordelijk voor alles wat server-side gebeurt: hun render-endpoint, hun MCP-server,
hun certificaatautoriteit voor Content Credentials, als ze er een draaien. Vraag hen om
hun eigen beleid. Zie [Adoptie & Governance](/info/adoption-governance.html) voor
wat het beheren van Lolly inhoudt.

## De app: wat op je apparaat blijft

De web-, desktop- en mobiele shells van Lolly draaien de volledige render-engine client-side.
Een tool openen, invoer invullen, voorvertonen en exporteren gebeurt allemaal op je
apparaat - er is geen server bij betrokken, en de app werkt offline zodra deze geladen is.

**De app stelt geen cookies in.** Om te functioneren houdt de app een kleine hoeveelheid data **alleen op
je apparaat** bij, nooit verzonden:

- <!--i:sliders--> **Interfacevoorkeuren** - thema, taal, geluidsinstellingen, formaat van zijbalk/zoom,
  sorteer- en weergavekeuzes, welke onboardingtips je hebt gezien - in
  `localStorage`, zodat ze beschikbaar zijn voordat de app klaar is met opstarten.
- <!--i:download--> **Een offline cache van de toolcatalogus en asset-voorvertoningen**, zodat de galerij
  werkt zonder verbinding.
- <!--i:hash--> **Lokale gebruikstellers** voor de statistieken op je profielkaart (hoeveel exports, welke
  tools) - een kleine, begrensde blob in `localStorage`, nooit door ons gelezen, nooit ergens
  naartoe verzonden.
- <!--i:folder--> **Je eigen documenten, opgeslagen sessies, geüploade assets en lettertypen** - opgeslagen in
  IndexedDB op je apparaat, nooit geüpload, nooit door iemand anders dan jij gelezen.

Niets hiervan wordt gedeeld, verkocht of gebruikt om je te identificeren of te volgen. Er is niets
om toestemming voor te geven, omdat er geen verzameling plaatsvindt - alleen deze kennisgeving, zodat je
weet wat wordt bewaard en waar. De opslag van de site in je browser wissen verwijdert
dat allemaal op elk moment, en dat doet **Instellingen → Opslag → Al mijn gegevens wissen** ook,
wat ook eerst Synchronisatie uitschakelt. (Onder de ePrivacy-richtlijn
Art. 5(3) vereist opslag die strikt noodzakelijk is voor de dienst die je hebt aangevraagd
geen toestemming - alleen transparantie, en dat zijn dit document en
de melding in de app allebei.)

![Het opslaggedeelte van de profielpagina op een scherm ter breedte van een telefoon: elke categorie on-device data benoemd, met de knop Al mijn gegevens wissen er direct naast](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Je eigen back-up van deze gegevens - de bundel `lolly-backup` die wordt gemaakt door **Exporteer mijn
gegevens** - is een bestand dat je zelf bewaart en beheert. Het raakt onze
servers nooit, tenzij je er zelf voor kiest het ergens naartoe te sturen. Zie [Data
Transfer](/info/data-transfer.html).

## On-device hulpprogramma's

Sommige tools - **Verborgen data verwijderen**, **PDF comprimeren** en andere met het
**"Draait op je apparaat"**-label - werken op een bestand dat jij aanlevert. Het bestand wordt
in je browser in het geheugen ingelezen, lokaal getransformeerd en teruggegeven als download.
Het wordt nooit geüpload, omdat er geen server in het pad is om het naar te uploaden.
Deze hulpprogramma's werken offline en hun uitvoer bevat geen watermerk of metadata van
ons - het doel van de meeste ervan is juist om data te verwijderen & te beschermen, niet om risico toe te voegen.

![Het label dat deze tools dragen: Draait op je apparaat - er wordt niets geüpload](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

Prepare for sharing bewaart werkinvoer, privévondsten en vervangingskaarten
in het geheugen, zonder ze automatisch toe te voegen aan geschiedenis, links, back-ups of synchronisatie.
Inspectie en vervanging sturen geen bestandsinhoud naar een server en verifiëren geen
credentials online. Gebruikers kiezen zelf of ze een resultaat kopiëren, downloaden, versturen of
expliciet opslaan in hun bibliotheek; een opgeslagen resultaat volgt daarna de normale back-up- en
synchronisatie-instellingen van de bibliotheek. Receptbestanden laten eerdere payloads en letterlijke koppelingen weg.
Samenvattingsrapporten bevatten aantallen, scope-ID's en bestandshashes. De CLI kan ook een
privé-controlebestand opslaan met de oorspronkelijke waarden, alleen wanneer daar expliciet om wordt gevraagd
met `--review-file`. Een voorbereidingsweergave in de browser wissen of verlaten maakt zijn
werktoestand vrij; dit is geen belofte van forensische verwijdering uit browser- of OS-geheugen.

## Elk netwerkverzoek dat de app kan doen

De onderstaande tabel is de volledige lijst van alles wat de app ophaalt of verzendt over een
netwerk. Staat het hier niet, dan doet de app het niet.

| Wat | Wat er daadwerkelijk je apparaat verlaat | Wanneer (de handeling die het activeert) | Als een operator het blokkeert |
|---|---|---|---|
| Synchronisatie van de toolcatalogus | Niets persoonlijks - een verzoek om Lolly's eigen publieke tool- en assetindex, naar de eigen oorsprong van de app | Bij het opstarten, daarna offline gecachet | De app draait op zijn gecachete toolset. Hij stopt alleen met het ontdekken van nieuwe tools |
| Een tool die live gegevens nodig heeft | Wat die specifieke tool ook opvraagt, naar de host die in zijn eigen beschrijving wordt genoemd. Vandaag is dat alleen de plaatsopzoeking in de Meeting Planner-tool, die `geocoding-api.open-meteo.com` vraagt om een plaatsnaam om te zetten in coördinaten en een tijdzone - geen account, geen sleutel en geen identifier voorbij het verzoek zelf. De invoer zegt dat precies waar je typt, en elk antwoord wordt op je apparaat opgeslagen zodat een plaats maar één keer wordt opgezocht | Alleen tijdens het gebruik van die tool, en alleen zodra je een locatie invoert | Die ene opzoeking mislukt. Je kunt nog steeds coördinaten met de hand typen, en verder wordt niets beïnvloed |
| Google Fonts | De gekozen fontfamilienaam en je IP-adres, naar Google's fontservers (`fonts.googleapis.com` voor het stylesheet, `fonts.gstatic.com` voor het fontbestand) | Alleen als je een Google Font toevoegt in de merkeditor, **en alleen nadat je akkoord gaat in een dialoog die precies dit zegt** - een eenmalige ophaling per familie, waarna hij op je apparaat leeft en offline wordt gebruikt | De Google Fonts-kiezer faalt gesloten. Upload in plaats daarvan een fontbestand |
| Versturen naar Google Drive | Het ene bestand dat je koos om te versturen, naar Google's Drive-API (`www.googleapis.com`), na een Google-aanmelding die je voltooit in Google's eigen pop-upvenster. Lolly's toegang is beperkt tot bestanden die het zelf heeft aangemaakt (de scope `drive.file` - het kan nooit de rest van je Drive lezen), en het aanmeldtoken wordt tijdens de sessie in het geheugen bewaard, nooit opgeslagen | Alleen wanneer je op "Versturen naar Google Drive" drukt bij een EMF-export, en alleen op builds waar de operator een Google-client-id heeft geconfigureerd - zonder dat bestaat de knop niet | De knop verschijnt nooit. Download het bestand en upload het zelf naar Drive |
| Versturen naar Dropbox | Het ene bestand dat je koos om te versturen, naar Dropbox's API (`api.dropboxapi.com` voor aanmelding en metadata, `content.dropboxapi.com` voor het bestand zelf), na een Dropbox-aanmelding die je voltooit in Dropbox's eigen venster. Lolly's toegang is beperkt tot de app-map (het kan alleen `Apps/` en zijn eigen map daarin zien - nooit de rest van je Dropbox), de "Open"-link die het je toont is een kortlevende privélink (er wordt geen publieke share aangemaakt), en een refreshtoken wordt alleen opgeslagen als je "stay connected" aanvinkt | Alleen wanneer je op "Versturen naar Dropbox" drukt bij een bestand, en alleen op builds waar de operator een Dropbox-client-id heeft geconfigureerd - zonder dat bestaat de knop niet | De knop verschijnt nooit. Download het bestand en upload het zelf naar Dropbox |
| Versturen naar OneDrive | Het ene bestand dat je koos om te versturen, naar Microsofts identity- en Graph-diensten (`login.microsoftonline.com` voor aanmelding, `graph.microsoft.com` voor de upload; een groot bestand wordt in delen geüpload naar een Microsoft-eigen uploadadres op `api.onedrive.com`, `*.up.1drv.com` of `*.sharepoint.com`), na een Microsoft-aanmelding die je voltooit in Microsofts eigen venster. Lolly's toegang is beperkt tot zijn eigen map onder `Apps/` (het kan nooit de rest van je OneDrive lezen) plus je weergavenaam voor het accountlabel, en een refreshtoken wordt alleen opgeslagen als je "stay connected" aanvinkt | Alleen wanneer je op "Versturen naar OneDrive" drukt bij een bestand, en alleen op builds waar de operator een Microsoft-client-id heeft geconfigureerd - zonder dat bestaat de knop niet | De knop verschijnt nooit. Download het bestand en upload het zelf naar OneDrive |
| Versturen naar LinkedIn | Het ene bestand dat je koos om te versturen, plus zijn naam als tekst van de post, naar LinkedIn (`www.linkedin.com` voor de aanmelding, `api.linkedin.com` voor de upload en de post), na een LinkedIn-aanmelding die je voltooit in je eigen browser. De post gaat naar je eigen feed als een openbare post onder je naam. Lolly kan als jou posten en je naam lezen voor het accountlabel, verder niets op je LinkedIn, en de aanmelding wordt alleen op dit apparaat bewaard als je "stay connected" aanvinkt - LinkedIns tokens duren 60 dagen en kunnen niet stilzwijgend worden vernieuwd, dus vervallen ze vanzelf | Alleen wanneer je op "Versturen naar LinkedIn" drukt bij een bestand, alleen in de desktopapps, en alleen op builds waar een LinkedIn-app is geconfigureerd - zonder dat bestaat de knop niet | Niets te blokkeren in de webapp: dit bestaat alleen in de **desktopapps**, dus die twee hosts staan bewust NIET in het Content-Security-Policy van de webapp hieronder. In de desktopapps verwijder je de geconfigureerde LinkedIn-app en verschijnt de knop nooit |
| Verzenden naar Penpot | Je persoonlijke toegangstoken van Penpot (dat je zelf in de app plakt) en het `.penpot`-archief van het design dat je koos om te versturen, naar Penpots API (`design.penpot.app`) via een kleine doorgeefluik op de eigen oorsprong van de app (`/api/penpot`), omdat Penpots API een browser niet rechtstreeks beantwoordt. Het doorgeefluik geeft door en vergeet; de desktopapps praten rechtstreeks met Penpot | Alleen wanneer je op "Verzenden naar Penpot" drukt in de Design-tool en een project bevestigt | Het doorgeefluik geeft een foutmelding en het versturen faalt gesloten. Exporteer het `.penpot`-bestand en importeer het zelf in Penpot |
| Versturen naar Bluesky | De ene afbeelding die je koos om te versturen, zijn naam als posttekst en alt-tekst, en je handle plus een app-wachtwoord (Bluesky → Settings → App passwords, nooit je accountwachtwoord), naar de Bluesky-server die je noemt (`bsky.social` tenzij je zelf host). Het app-wachtwoord wordt alleen op dit apparaat opgeslagen, nooit in een back-up, en Disconnect wist het | Alleen wanneer je op "Versturen naar Bluesky" drukt bij een afbeelding, nadat je het account in je profiel hebt gekoppeld, alleen in de **desktopapps** | Niets te blokkeren in de webapp: zijn beleid hieronder noemt geen Bluesky-host, dus die overgang bestaat daar niet. In de desktopapps verwijder je de koppeling en verschijnt de knop nooit |
| Versturen naar Discord | Het ene bestand dat je koos om te versturen, als bijlage, naar het webhookadres van het kanaal dat je hebt geplakt (`discord.com`). Een webhookadres laat iedereen die het heeft in dat kanaal posten, dus het wordt alleen op dit apparaat opgeslagen, nooit in een back-up, en Disconnect wist het | Alleen wanneer je op "Versturen naar Discord" drukt bij een bestand, alleen in de **desktopapps** | Niets te blokkeren in de webapp: zijn beleid hieronder noemt `discord.com` niet, dus die overgang bestaat daar niet. In de desktopapps verwijder je de webhook en verschijnt de knop nooit |
| Versturen naar Mastodon | Het ene bestand dat je koos om te versturen en zijn naam als posttekst, naar de Mastodon-server (of compatibele server) die je noemt, na een aanmelding die je voltooit in het eigen venster van die server. Koppelen registreert een kleine app per apparaat op die server; de aanmelding wordt alleen op dit apparaat bewaard als je "stay connected" aanvinkt | Alleen wanneer je op "Versturen naar Mastodon" drukt bij een bestand. Je kiest zelf de server, dus die staat niet in het beleid hieronder | De server die je noemt moet browseraanroepen toestaan; doet hij dat niet, gebruik dan de desktopapps. Disconnect verwijdert de knop |
| Versturen naar Nextcloud / WebDAV | Het ene bestand dat je koos om te versturen, naar je eigen server, via één geauthenticeerde PUT met het serveradres, de gebruikersnaam en het app-wachtwoord die je hebt ingevoerd (Nextcloud → Settings → Security → Devices & sessions; nooit je accountwachtwoord). Alleen op dit apparaat opgeslagen, nooit in een back-up, gewist door Disconnect | Alleen wanneer je op "Versturen naar Nextcloud" drukt bij een bestand. Je kiest zelf de server, dus die staat niet in het beleid hieronder | Je server moet browseraanroepen vanaf de oorsprong van de app toestaan; doet hij dat niet, gebruik dan de desktopapps |
| Versturen naar S3-compatibele opslag | Het ene bestand dat je koos om te versturen, naar je eigen bucket (AWS S3, MinIO, R2, B2, Garage - elk SigV4-endpoint), ondertekend op je apparaat met het sleutelpaar dat je hebt ingevoerd. Sleutels worden alleen op dit apparaat opgeslagen, nooit in een back-up, gewist door Disconnect | Alleen wanneer je op "Versturen naar S3" drukt bij een bestand. Je kiest zelf het endpoint, dus dat staat niet in het beleid hieronder | De CORS-regels van je bucket moeten de oorsprong van de app toestaan; doen ze dat niet, gebruik dan de desktopapps |
| Synchroniseren tussen je apparaten | Een kopie van wat je op dit apparaat hebt gemaakt - opgeslagen sessies en projecten, je design systems met hun lettertypen en logo's, geüploade afbeeldingen, je profiel en je voorkeuren - als één bestand, naar de ene opslag die je hebt gekozen: de Lolly-app-map in je Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), bestanden die Lolly aanmaakte in je Google Drive (`www.googleapis.com`), de Lolly-app-map in je OneDrive (`graph.microsoft.com`, met grotere bestanden geüpload naar `api.onedrive.com`, `*.up.1drv.com` of `*.sharepoint.com`, en downloads vanaf Microsofts `*.files.1drv.com`, `my.microsoftpersonalcontent.com` of `*.sharepoint.com`), of je eigen Nextcloud- / WebDAV-server of S3-bucket. Dezelfde opslag bewaart ook tot zeven dagelijkse kopieën en één kopie van vóór je laatste toepassing. **Er gaat niets naar Lolly:** geen Lolly-server, relay of Lolly Work-server zit in het pad, en de apps hebben er geen Lolly-website voor nodig, zelfs niet om aan te melden. De kopie wordt eerst op je apparaat versleuteld, alleen als je een wachtwoordzin instelt. Aanmeldingen, sleutels, app-wachtwoorden, de wachtwoordzin en de synchronisatie-instellingen blijven op het apparaat en staan nooit in de kopie. Op het web bewaart een onthouden Google Drive-koppeling alleen je accountnaam (en je eigen client-id, als je die hebt opgegeven); de Google-aanmelding zelf duurt één bezoek. In de Android-app loopt de Google Drive-aanmelding via Google Play-services op de telefoon, die Google zelf beheert | Alleen nadat je "Sync across my devices" aanzet of op "Sync now" drukt: een upload kort na elke wijziging en wanneer je de app verlaat, en een controle op een nieuwere kopie wanneer de app start | Synchronisatie mislukt en zegt waarom; je werk blijft op het apparaat. Exporteer je gegevens naar een bestand en verplaats het zelf in plaats daarvan |
| ICC-drukprofielen | Niets persoonlijks - een verzoek om een standaard drukconditieprofiel, naar het publieke register van het ICC (`registry.color.org`, `www.color.org`) | Alleen als je op een ICC-preset klikt in de printprofielbeheerder - een eenmalige ophaling per profiel, waarna hij op je apparaat leeft | ICC-presets mislukken. Lever in plaats daarvan je eigen `.icc`-profiel aan |
| Internetradio | Niets persoonlijks - een playlistverzoek en een audiostream, naar het station (`api.somafm.com` en de icecast-server waar het naar verwijst, `*.somafm.com`) | Alleen terwijl je de optionele ingebouwde radio in de geluidsspeler afspeelt | De radio mislukt. Elke andere geluidsfunctie blijft werken |
| Een URL die je een tool laat vastleggen | Een verzoek naar het exacte webadres dat je typt, vanuit de URL-screenshottool. Wat dat adres ook is. Deze host staat niet in het beleid hieronder, omdat je hem kiest op het moment van gebruik | Alleen wanneer je een URL in die tool invoert en de opname start | Een operator kan dit niet op host toestaan. Om het te verwijderen, verwijder je de tool |
| Een afbeelding toevoegen vanaf een URL | Een verzoek naar het exacte afbeeldingsadres dat je plakt in "Add from URL" (in de assetkiezer of Assets). Het eigen beleid van de webapp verbiedt de browser om rechtstreeks een andere site op te halen, dus het verzoek wordt voor je gedaan door een klein doorgeefluik op de eigen oorsprong van de app (`/api/fetch-image`), dat de afbeelding server-side ophaalt en alleen de bytes teruggeeft - het slaat niets op en vergeet het adres. Het weigert alles wat geen publiek afbeeldingsadres is (een privé- of intern adres wordt geblokkeerd). De desktopapps halen het adres rechtstreeks op. Een Lolly-link die je plakt wordt helemaal niet opgehaald - hij rendert op je apparaat. De host staat niet in het beleid hieronder, omdat je hem kiest op het moment van gebruik | Alleen wanneer je een URL plakt in "Add from URL" en bevestigt | De operator zet het doorgeefluik uit (`LOLLY_DISABLE_IMAGE_PROXY=1`); daarna kunnen alleen Lolly-links, `data:`-afbeeldingen en afbeeldingen van dezelfde oorsprong worden toegevoegd in de webapp. De desktopapps zijn niet beïnvloed |
| SEAL-handtekeningcontrole | **Niets.** De webapp heeft helemaal geen DNS-resolver - zie hieronder | Nooit | Niets te blokkeren |
| AI-modellen op het apparaat | Niets persoonlijks - een eenmalige download van een modelbestand vanaf Lolly's modelhost (`lolli.li`), daarna gecachet op je apparaat; geen account, geen identifier, alleen het verzoek en je IP | Alleen wanneer je een functie gebruikt die een model nodig heeft (Verify deep scan, afbeelding-upscale, spraak, en vergelijkbare) | Die functie wacht op de download; al het andere blijft werken |
| Externe instantie | Wat de instantie die je noemt ook teruggeeft, via dezelfde catalogussynchronisatie die hierboven is beschreven - plus een versietag op verzoeken ernaartoe (shelltype en engineversie, dezelfde informatie die een user agent meedraagt), zodat de operator ervan kan zien welke Lolly-versies in het veld zijn. Op een beheerde instantie, terwijl je bent aangemeld, draagt die tag ook een installatie-id per apparaat, zodat de apparatenlijst van de operator deze installatie kan onderscheiden. Hij reist alleen mee op verzoeken die je eigen gebruik al doet - er is geen timer en niets belt zelf naar huis - en de instantie verlaten verwijdert het id, zodat een apparaat dat later opnieuw verbindt een nieuwe presenteert. Je kiest de host op het moment van gebruik, dus die staat niet in het beleid hieronder | Alleen als je de shell expliciet naar een andere Lolly-deployment wijst | Instantiewisseling mislukt. Je lokale instantie is niet beïnvloed |

Elke vaste host in die tabel is ook de volledige toelatingslijst in het
Content-Security-Policy van de app, die de browser afdwingt. De lijst is dus niet alleen een
beschrijving van wat de code vandaag doet, het is de grens die de browser aan de
app oplegt: een toekomstige wijziging die zou proberen een andere host te bereiken, zou worden geblokkeerd,
niet stilzwijgend toegestaan. Eén rij is de bewuste uitzondering, en zijn eigen cel
legt dat uit: Versturen naar LinkedIn bestaat alleen in de desktopapps, en het
beleid van de webapp noemt geen van zijn hosts - de webapp zou ze niet kunnen bereiken,
zelfs als de code het probeerde.
Nog twee rijen, Bluesky en Discord, zijn op dezelfde manier alleen-desktop, en hun
hosts blijven om dezelfde reden buiten het webbeleid. Vijf rijen hebben geen vaste
host, omdat je het adres kiest op het moment van gebruik: een URL die je een tool laat
vastleggen, een externe instantie waar je de shell naartoe wijst, en je eigen Mastodon-
server, WebDAV-server of S3-bucket (de laatste twee ook als synchronisatiehuis). Geen daarvan staat in het beleid, en elk
gebeurt alleen wanneer je een adres typt en ernaar handelt. De Penpot-rij bereikt
Penpot via de eigen oorsprong van de app, dus die is gedekt door `'self'`. Een deployment die geen van de
optionele onderdelen wil (een zakelijke instantie met eigen lettertypen, bijvoorbeeld) verwijdert die
hosts uit zijn beleid, en de functies falen dan gesloten in plaats van naar buiten te reiken.

Op twee soorten rijen na, stuurt geen van deze je documenten, projecten,
sessies of geüploade bestanden ergens naartoe: ze bestaan om dingen *naar* je apparaat te
brengen (tools, lettertypen, modellen). De twee soorten zijn de Versturen-rijen, die het ene
bestand versturen dat je koos, en de synchronisatierij, die een kopie van je werk stuurt naar de opslag
die je koos en naar geen enkele Lolly-server. Elke andere uitzondering wordt expliciet genoemd in de
secties hieronder.

**Een opmerking over wat we verwijderd hebben.** Verify kan SEAL-handtekeningen controleren, een schema waarbij
de ondertekeningssleutel van een bestand in DNS wordt gepubliceerd. Browsers kunnen geen DNS-queries doen, dus
elke webimplementatie moet de opzoeking routeren via een externe DNS-over-HTTPS-
resolver - waardoor die operator het gecontroleerde domein plus je IP-
adres te zien zou krijgen. We gebruikten vroeger die van Cloudflare. **Dat doen we niet meer, en er is geen
vervanging**: de webapp geeft nu helemaal geen resolver door, dus SEAL-verificatie hier
doet nul netwerkverzoeken. Bestanden waarvan het SEAL-record de sleutel inline draagt, verifiëren
nog steeds volledig offline. Bestanden waarvan de sleutel in DNS staat, melden "geen sleutel-
resolver" in plaats daarvan, en je kunt die controleren in de desktop- of command-line-app,
die DNS native via je eigen machine oplost zonder enige derde partij
erbij betrokken.

![Het Verify-scherm: een drop-target en verder niets - het bestand wordt gecontroleerd waar het al staat, zonder upload en zonder account](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Je kunt dit zelf controleren: doorzoekbare checks voor deze en elke
andere claim op deze pagina, met de exacte commando's en verwachte uitvoer, vind je op
[Verify It Yourself](/info/verify-yourself.html).

## Hot-linked render-URL's

> **Live op lolly.tools.** Elke URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`
> rendert echt, en de invoer reist mee in die URL. De sectie hieronder is
> wat dat voor jou betekent, en een operator kan de functie uitzetten op zijn
> eigen instantie.

De app zelf blijft volledig op je apparaat. Los daarvan kan een operator **hot-link render-
URL's** inschakelen - `/tool/<tool-id>.<ext>?<inputs>` - zodat een gedeelde Lolly-
link kan verschijnen als levende afbeelding in een README, een wiki of een dashboard. Zo'n URL ophalen
vraagt de server om **publieke tool- en catalogusdata** te renderen met de invoer
die in de URL staat geschreven.

- <!--i:usercheck--> **Geen accounts, geen cookies, geen status.** Het endpoint is anoniem, en niets
  op je apparaat wordt gelezen. Je documenten, sessies en uploads verlaten je
  browser nooit - ze kunnen helemaal niet in deze links verschijnen.
- <!--i:document--> **Maar de URL zelf wordt geregistreerd.** De query-string van een URL maakt deel uit van de
  requestregel, dus die verschijnt in de gewone toegangslogs van het hostingplatform, op
  dezelfde manier als elk opgevraagd pad. Als de invoer van een link iemands naam of e-mail bevat -
  een naambadge, een e-mailhandtekening - **staat die tekst in die logs**, en geen
  hoeveelheid beleidstekst verandert dat. Een hotlink-URL is dus de verkeerde plek voor
  persoonlijke gegevens: geef hem alleen wat je op een openbare pagina zou zetten.
- <!--i:globe--> **De invoer is sowieso openbaar door constructie** - het is wat de
  maker van de link ook in de URL heeft getypt, leesbaar door iedereen die de link bereikt. Zet geen
  geheimen in een gedeelde link. Lolly biedt linkversleuteling voor gevoelige inhoud.
- <!--i:eyeoff--> Reacties worden **gecachet en rate-limited** zoals elke publieke afbeelding, en gemarkeerd
  met `noindex` zodat zoekmachines je renders niet indexeren.

Host je Lolly zelf en wil je geen publiek renderoppervlak? Stel
`LOLLY_DISABLE_RENDER_GET=1` in en elk van deze URL's geeft 404 terug.

## De MCP-server (optioneel, voor AI-agents)

Lolly kan ook worden bereikt door een AI-agent via het Model Context Protocol - een
door een operator gedraaid endpoint (lolly.tools draait er een; iedereen kan zelf zijn eigen
hosten, ook volledig air-gapped). Het deelt de geen-accounts-houding van het renderpad,
plus vier tools die noodzakelijkerwijs met bestandsbytes werken:

- <!--i:cpu--> **`lolly_transform`** (draait server-side een on-device-hulpmiddel, namens de
  aanroepende agent), **`lolly_verify`** (controleert Content Credentials) en **`lolly_redact`**
  (dekt gebieden van een afbeelding of PDF af) accepteren allemaal
  de bytes van een bestand van de aanroeper. Ze worden **in-process, in het geheugen** verwerkt,
  en het resultaat wordt in diezelfde aanroep teruggegeven - het bestand wordt nooit naar
  schijf geschreven en nooit opgeslagen zodra het verzoek is afgerond.
- <!--i:cpu--> **`lolly_rebrand`** (renoveert een oude slidedeck naar een design system,
  via de fasen `plan`, `compile` en `inspect`) accepteert de bytes van een deck op dezelfde
  manier, en verwerkt ze **in het geheugen, alleen voor die aanroep** - er wordt niets
  naar schijf geschreven of bewaard zodra de respons is verstuurd. Zijn eerste fase,
  `capabilities`, zegt in woorden waar je bytes naartoe zouden gaan voordat je er
  een verstuurt: op een zelfgehoste lokale server verlaat het deck die machine nooit; op een
  gehoste server stuurt het aanroepen van `lolly_rebrand` het deck daarnaartoe, tot aan de grootte-
  en slidelimieten die diezelfde fase opgeeft.
- <!--i:checklist--> Elke andere tool - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - werkt alleen met parameters (tekst, getallen, kleuren,
  URL's, catalogus-asset-id's), dezelfde invoer die een hotlink-render-URL gebruikt.
- <!--i:lock--> Toegang is ofwel een gedeeld token dat de operator uitgeeft aan clients die hij vertrouwt, of
  stateless OAuth 2.1: kortlevende ondertekende tokens die worden geverifieerd tegen een gedeeld
  geheim, niets server-side opgeslagen en het token zelf wordt nooit weggeschreven naar een
  log of een render-URL.

## Content Credentials-identiteit (een aanmelding die je zelf moet starten)

Lolly kan een cryptografische **Content Credential** in je exports verzegelen, zodat iedereen offline kan verifiëren dat een bestand ongewijzigd is sinds het Lolly verliet. Dat deel staat **standaard aan en is volledig lokaal** - de ondertekeningssleutel wordt op je apparaat gegenereerd en het ondertekenen zelf gebeurt offline. Zonder inschrijving is die sleutel een wegwerpsleutel: voor elke export wordt een nieuw sleutelpaar aangemaakt, dat samen met de export wordt weggegooid. Zodra je je inschrijft, wordt de sleutel blijvend en wordt hij **niet-extraheerbaar** gegenereerd - zelfs Lolly's eigen code kan hem niet lezen, alleen vragen om te ondertekenen. In beide gevallen verlaat hij nooit je apparaat. Dit onderdeel behandelt de ene *optionele* stap daarbovenop: het inschrijven van een geverifieerde identiteit, zodat je exports "Geverifieerd - ondertekend door \<your email\>" tonen in plaats van een anonieme sleutel. **Als je de inschrijving overslaat, is niets in dit onderdeel op jou van toepassing en verlaten er nooit persoonlijke gegevens je apparaat.**

![De kaart Geverifieerde identiteit op de profielpagina, telefoonbreedte: de kiezer voor de certificaatlevensduur en de inschrijvingsstap eronder, sluimerend tot je hem zelf start](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Als je je wel inschrijft, gebeurt precies dit:

1. **Je kiest een aanmeldmethode** - GitHub, Google, SUSE (id.suse.com) of een
   gemailde link. Voor de drie OIDC-providers word je doorgestuurd naar de
   eigen inlogpagina van die provider, geregeld door hun privacybeleid, niet het onze.
   Lolly's certificaatdienst krijgt alleen een geverifieerd e-mailadres terug en
   de naam van de provider. Voor de e-maillink wordt het adres dat je typt doorgegeven aan
   **Resend**, een transactionele e-mail-API, uitsluitend om die ene link te bezorgen.
2. **Een kortlevende cookie beschermt de omleiding.** Dit is de enige cookie die
   het hele Lolly-systeem instelt: `lolly_ca_state`, `HttpOnly`, beperkt tot `/api/ca`,
   verlopend binnen tien minuten. Hij bevat een willekeurige waarde, geen tracking-
   identifier, en bestaat alleen om te voorkomen dat de OAuth-omleiding wordt vervalst. Hij wordt
   gewist zodra de aanmelding is voltooid.
3. **Je IP-adres wordt kort gebruikt om misbruik te voorkomen** van de
   aanmeldendpoints (zodat één script geen inbox kan spammen of het e-mailquotum kan uitputten).
   Lolly hasht het voordat het een kortlevende misbruikcontrole-bucket aanmaakt; het ruwe
   adres wordt niet naar die opslag gestuurd. De bucket verloopt na ongeveer een minuut
   en wordt niet gebruikt voor tracking. Gewone hosting-toegangslogs zijn apart en
   worden hieronder beschreven.
4. **De certificaatdienst geeft een kortlevend certificaat uit** (7, 30, 90 of 365
   dagen, jouw keuze, begrensd door het beleid van de operator) dat je geverifieerde
   e-mailadres koppelt aan de publieke helft van het sleutelpaar dat op je apparaat is gegenereerd. De private
   helft verlaat je browser nooit.
5. **Niets over de uitgifte wordt geregistreerd.** De certificaatdienst houdt geen
   uitgiftelog bij: niet je e-mail, niet de provider, niet een serienummer, niet een
   tijdstempel. Geen database, geen logregel, geen webhook. Je e-mailadres bestaat in het
   verzoek maar net lang genoeg om te worden geschreven in het certificaat dat je eigen
   apparaat ontvangt, en daarna is het aan onze kant volledig verdwenen.
6. **Daarna is ondertekenen weer offline** voor de hele levensduur van het certificaat.
   Een bestand exporteren neemt nooit contact op met de certificaatdienst - alleen inschrijven deed dat.

**De afweging, ronduit gezegd.** Een eerdere versie van deze dienst logde elke
uitgifte wel, zodat een verkeerd uitgegeven of gecompromitteerd certificaat traceerbaar was. We
hebben dat verwijderd, omdat dat logboek de enige plek in heel Lolly was waar persoonlijke
data op een server tot rust kwam, en we hebben het liever niet dan het zorgvuldig te bewaren. Wat we opgeven
is server-side traceerbaarheid: als een certificaat wordt misbruikt, kunnen we niet opzoeken wie het
heeft verkregen. Certificaten zijn met opzet kortlevend - 7 tot 365 dagen, jouw keuze,
begrensd door de operator - en verlopen vanzelf, wat de mitigatie is waar we in plaats daarvan op
vertrouwen. Self-hosters van wie de eigen verplichtingen een auditlog vereisen kunnen er zelf een toevoegen
en worden daarmee de verwerkingsverantwoordelijke voor die data.

## De browserextensie

De browserextensie **Lolly URL Screenshot** verzamelt, bewaart of verzendt geen enkele
persoonlijke data. Geen analyse, geen tracking, geen externe server.

**Wat het doet.** Wanneer je de Lolly-webapp vraagt om een URL te fotograferen, opent de
extensie die pagina in een tijdelijk achtergrondtabblad, legt hem vast in je
browser via het DevTools Protocol, geeft de afbeelding terug aan de app en sluit
het tabblad. Alles gebeurt lokaal, op je eigen apparaat en netwerk.

**Gegevens.**

- <!--i:shieldcheck--> **We verzamelen niets.** De extensie heeft geen servers en doet geen eigen
  netwerkverzoeken.
- <!--i:photos--> **Vastgelegde afbeeldingen** gaan rechtstreeks naar de Lolly-app in dezelfde browser - nooit
  geüpload door de extensie.
- <!--i:link--> **De URL's die je vastlegt** worden alleen gebruikt om die ene pagina te laden voor die ene
  screenshot. Ze worden niet gelogd of gedeeld.

**Machtigingen.**

- <!--i:wrench--> **`debugger`** - om de gerenderde pagina vast te leggen via het DevTools Protocol (hetzelfde
  mechanisme dat de Lolly-desktopapp gebruikt).
- <!--i:monitor--> **`tabs`** - om het tijdelijke tabblad te openen en sluiten waarin de pagina laadt.
- <!--i:globe--> **Hosttoegang (`<all_urls>`)** - omdat de pagina die je kiest om vast te leggen op
  elke site kan staan. Chrome toont dit bij installatie als een brede machtigings-
  waarschuwing. De extensie bezoekt alleen de URL die je opgeeft.

Geen van deze wordt gebruikt om je surfgedrag te lezen, te monitoren of door te sturen buiten
die ene gevraagde opname.

## Infrastructuurlogs

Zoals elke website genereren de servers achter lolly.tools - en achter elke
Lolly-deployment - standaard webserver-toegangslogs telkens wanneer een verzoek ze
bereikt: IP-adres, opgevraagd pad, tijdstempel, user agent. Dat is basaal
hostinggedrag, geen toevoeging van Lolly, en het bevat nooit de
inhoud van je documenten, omdat die nooit een server bereiken om te beginnen. De
ene bewuste uitzondering is een bestand dat je expliciet aan een MCP-aanroep
`lolly_transform`, `lolly_verify`, `lolly_redact` of `lolly_rebrand` geeft, dat
in het geheugen wordt verwerkt en nooit naar schijf of een log wordt geschreven, zoals hierboven beschreven.

**Lolly's eigen code schrijft niets naar die logs.** De MCP-server bevat helemaal geen
logging-statements. De certificaatservice geeft precies twee regels uit, allebei
bij falen en allebei bewust gestript: een verzendfout-statuscode zonder
ontvangeradres, en een foutmelding zonder stacktrace of URL (een stack zou
een inschrijvingstoken kunnen bevatten). Al het overige in het log is van het hostingplatform,
niet van ons.

Voor lolly.tools is Vercel de hostingpartij en de bewaartermijn van toegangslogs volgt
Vercel's eigen platformstandaarden voor ons abonnement. We configureren geen logdrain, geen
langetermijn-logexport en geen analytics- of monitoringproduct erbovenop. We bewaren zelf geen
kopie van deze logs, wat ook betekent dat we ze niet voor je kunnen doorzoeken - zie
[Jouw rechten](#your-rights).

## Rechtsgronden, bewaartermijnen en ontvangers

Bijna niets hier heeft een rechtsgrond nodig, omdat er bijna niets wordt verwerkt. Voor
de volledigheid de complete lijst:

| Verwerking | Rechtsgrond (GDPR Art. 6) | Bewaard voor |
|---|---|---|
| Alles op je apparaat (documenten, voorkeuren, cache, tellers) | **Helemaal geen verwerking door ons** - het bereikt ons nooit. Opslag op je apparaat is strikt noodzakelijk voor de dienst die je hebt aangevraagd (ePrivacy Art. 5(3)), dus is geen toestemming vereist | Tot je het verwijdert |
| Je e-mailadres tijdens Content Credentials-inschrijving | **Art. 6(1)(b)**, uitvoering van een dienst die je expliciet hebt aangevraagd | Niet bewaard. Alleen aanwezig in het geheugen voor de duur van het verzoek |
| Een op één manier afgeleide bucketsleutel gemaakt van je IP-adres op aanmeldendpoints, voor rate limiting | **Art. 6(1)(f)**, ons gerechtvaardigd belang om misbruik van een gratis dienst en van het e-mailquotum van een derde te voorkomen. Wij vinden dat dit een belangenafweging doorstaat omdat het ruwe adres niet naar de limiter wordt gestuurd, de bucket alleen voor misbruikcontrole wordt gebruikt en hij automatisch verloopt | Ongeveer 1 minuut in de misbruikcontrole-opslag; daarna niet bewaard |
| Hosting-toegangslogs (IP, pad, tijdstempel, user agent) | **Art. 6(1)(f)**, ons gerechtvaardigd belang bij dienstbeveiliging, misbruikpreventie en het diagnosticeren van storingen | Vercel's platformstandaard voor ons abonnement. We voegen geen drain of export toe |

**Ontvangers.** De categorieën ontvangers zijn: onze hostingprovider (Vercel
Inc.); onze provider van misbruikcontrole-opslag, die alleen kortlevende, op één manier
afgeleide bucketsleutels ontvangt en nooit het ruwe IP-adres; en - alleen als je
de e-mailaanmeldoptie gebruikt - een transactionele e-mailprovider (Resend). Als je je aanmeldt
met GitHub, Google of SUSE (id.suse.com), heb je
rechtstreeks contact met die provider, onder hun eigen privacybeleid. Zij vertellen
ons een geverifieerd e-mailadres en verder niets. We delen persoonlijke gegevens met niemand
anders, en we verkopen geen gegevens, tonen geen advertenties en profileren geen gebruikers.

**Doorgiften buiten de EER.** Vercel en Resend zijn Amerikaanse bedrijven. Functie-
compute voor lolly.tools is vastgezet in Vercel's regio Frankfurt (`fra1`), dus
de verwerking gebeurt in de EU, maar als in de VS gevestigde providers kunnen ze
toch als verwerker toegang krijgen tot gegevens vanuit de VS. Die doorgiften steunen op de Standaard
Contractuele Clausules van de Europese Commissie en/of het EU-VS Data Privacy
Framework, zoals vastgelegd in de verwerkersovereenkomst van elke provider. Omdat de
persoonlijke gegevens die deze providers bereiken zo beperkt zijn - een e-mailadres
doorgegeven om één bericht te versturen, gewone toegangslogs, en een kortlevende afgeleide
misbruikcontrole-bucket - is de blootstelling navenant klein.

**Geautomatiseerde besluitvorming.** Geen. Er is geen profilering en geen geautomatiseerd
besluit dat rechtsgevolgen of vergelijkbaar significante gevolgen heeft (art. 22).

## Privacy van kinderen

Lolly verzamelt niet bewust persoonlijke informatie van wie dan ook, van welke leeftijd dan ook, in
het normale gebruik van de app - er is niets te verzamelen. De enige plaats waar
persoonlijke informatie (een e-mailadres) ooit wordt verzameld is Content Credentials-
inschrijving, hierboven beschreven, die niet gericht is op of bedoeld is voor kinderen.

## Jouw rechten

Omdat bijna alles wat Lolly aanraakt alleen op je eigen apparaat wordt opgeslagen, zijn de meeste
dingen die de gegevensbeschermingswet "jouw rechten" noemt - inzage, correctie, verwijdering,
overdraagbaarheid - dingen die je al zelf kunt doen, meteen, zonder iemand
iets te vragen: je gegevens leven in de opslag van je browser, in een vorm die je kunt inspecteren,
exporteren (**Exporteer mijn gegevens**, hierboven) of verwijderen (door de opslag van de site in
je browser te wissen, zoals hierboven).

Formeel heb je onder AVG-artikelen 15-22 het recht op **inzage** in je
persoonsgegevens, om ze te laten **rectificeren**, te laten **wissen**, de verwerking ervan te laten **beperken** of
ertegen **bezwaar te maken** (inclusief bezwaar tegen alles wat we baseren op gerechtvaardigde
belangen), op **gegevensoverdraagbaarheid** en - waar de verwerking op toestemming berust - om
**die toestemming op elk moment in te trekken**, zonder gevolgen voor de rechtmatigheid van wat er
gebeurde voordat je die introk.

Hier is het eerlijke standpunt over het uitoefenen van die rechten tegenover ons. Omdat we geen
uitgiftelog meer bijhouden, **hebben we geen persoonlijke gegevens over je die we kunnen opzoeken,
corrigeren, exporteren of verwijderen.** Als je schrijft en vraagt wat we over je hebben, is het
eerlijke antwoord niets, en dat zullen we zeggen. De enige categorie die wel bestaat,
is hosting-toegangslogs gekoppeld aan een IP-adres, bewaard door onze hostingprovider onder
hun standaard bewaartermijnen. We hebben geen mogelijkheid om die selectief op te zoeken of te
verwijderen, en dat zullen we je vertellen in plaats van iets anders te doen alsof. Alles wat
werkelijk *van jou* is, staat op je apparaat, waar je het al kunt lezen, exporteren
en vernietigen zonder iemand toestemming te vragen.

**Je hebt het recht om een klacht in te dienen.** Als je vindt dat we je gegevens
onjuist hebben behandeld, kun je een klacht indienen bij een toezichthoudende
autoriteit voor gegevensbescherming - in de EU de autoriteit in je land van verblijf, werk
of waar je vermoedt dat de inbreuk plaatsvond (art. 77). Onze leidende toezichthoudende
autoriteit is het *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) in
Ansbach, Duitsland. Je hoeft niet eerst contact met ons op te nemen, al zouden we graag de
kans krijgen om het op te lossen.

We verkopen geen gegevens. We hebben er geen om te verkopen.

## Wijzigingen in dit beleid

De datum bovenaan verandert zodra dit document verandert. Een wijziging die verandert
wat je apparaat verlaat of wat wordt bewaard, krijgt hier zijn eigen regel, geen stille
bewerking - als je wilt zien wat er is gewijzigd, vraag het (hieronder) of vergelijk met de
[publieke bron](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Wie is verantwoordelijk, en hoe ons te bereiken

De **verwerkingsverantwoordelijke** voor lolly.tools is:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Duitsland

SUSE heeft een **Functionaris Gegevensbescherming** aangesteld, bereikbaar via
[privacy@suse.com](mailto:privacy@suse.com). Gebruik dat adres voor elk formeel
verzoek onder "Jouw rechten" hierboven.

Voor alles over Lolly zelf - hoe het werkt, waarom iets is zoals het is of
een correctie op dit document - neem contact op met **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

Voor een self-hosted of enterprise Lolly-instance neem je in plaats daarvan contact op met wie
hem beheert: de beheerder is de verwerkingsverantwoordelijke voor zijn eigen deployment. SUSE en het
Lolly open source-project bewaren geen gegevens voor deployments die zij niet zelf draaien.
