# Privacybeleid

*Laatst bijgewerkt: 23 oktober 2026*

**Dingen maken in Lolly gebeurt op je apparaat.** Een tool openen, typen, een voorbeeld bekijken, exporteren en een bestand controleren: het draait allemaal in de app op je telefoon, computer of browser. Je hebt geen account nodig en de app plaatst daarvoor geen cookies.

**Wat je maakt verlaat je apparaat alleen als je erom vraagt.** Een Google Font toevoegen, een bestand naar Drive of Dropbox sturen, Sync aanzetten, de radio afspelen of een AI-model voor op je apparaat downloaden: elk daarvan doet een verzoek dat jij hebt gestart. De app haalt ook haar tools en updates op bij haar eigen adres, en die verzoeken bevatten niets van wat je hebt gemaakt. [Elk netwerkverzoek dat de app kan doen](#every-network-request-the-app-can-make) somt ze op, host voor host.

**Een paar Lolly-diensten draaien op een server.** Renderlinks, de afbeeldingsophaler, het eindpunt voor AI-agents en de dienst voor geverifieerde identiteit ontvangen alleen wat je ze stuurt en bewaren het niet langer dan deze pagina aangeeft.

**De Lolly Work-instantie van je organisatie werkt anders.** Die slaat het gedeelde werk op dat je daar neerzet, en het beleid van de beheerder geldt voor die gegevens, niet dit beleid.

::: figure privacy-where-data-goes
Waar je gegevens heen gaan: ze blijven op je apparaat, tenzij jij een verzoek start, en elk soort verzoek heeft zijn eigen bestemming.
:::

## Wat dit beleid dekt

Lolly is open-sourcesoftware die iedereen kan draaien: een engine, app-shells voor web, desktop, mobiel en de terminal, en een browserextensie. Dit beleid heeft twee delen:

- <!--i:code--> **De software zelf**: wat deze wel en niet doet met je gegevens, waar die ook draait. Dit is een eigenschap van de code, dus het geldt voor elke Lolly-implementatie, van ons of van iemand anders.
- <!--i:server--> **lolly.tools**, de referentie-implementatie die SUSE beheert: de keuzes bij het draaien van de optionele serveronderdelen, zoals wat er wordt gelogd, hoe lang en door wie.

Op een zelf gehoste of enterprise Lolly-instantie geldt het softwaregedrag hieronder nog steeds, maar de *beheerder* van die instantie, niet SUSE, is verantwoordelijk voor alles op hun servers: hun renderendpoint, hun MCP-server, hun certificaatdienst en hun Lolly Work-instantie. Vraag hen om hun eigen beleid. [Adoption & Governance](/info/adoption-governance.html) beschrijft wat het draaien van Lolly inhoudt.

## Wat op je apparaat blijft

De web-, desktop- en mobiele apps van Lolly draaien de hele renderengine op het apparaat. Zodra de tools, assets en encoders die je gebruikt op het apparaat staan, hebben renderen en downloaden geen server nodig.

**Zelfstandig gebruik van de app plaatst geen cookies.** Organisatie-aanmelding en de optionele inschrijving voor geverifieerde identiteit hebben hun eigen cookies, beschreven in hun eigen secties. De app bewaart deze gegevens op het apparaat:

- <!--i:sliders--> **Interfacevoorkeuren**: thema, taal, geluidsinstellingen, formaten van zijbalk en zoom, sorteer- en weergavekeuzes en welke tips je hebt gezien, in `localStorage`, zodat ze klaarstaan voordat de app klaar is met starten.
- <!--i:download--> **Een offlinecache van de toolcatalogus en assetvoorbeelden**, zodat de galerij zonder verbinding werkt.
- <!--i:hash--> **Lokale gebruiksteller** voor de statistieken op je profielkaart, zoals hoeveel exports en welke tools: een klein, begrensd bestand in `localStorage`, nooit door ons gelezen en nergens heen gestuurd.
- <!--i:folder--> **Je eigen werk**: documenten, opgeslagen sessies en hun geschiedenis, geüploade afbeeldingen en lettertypen, bestandsresultaten en eerdere versies, en de Prullenbak, die verwijderde items 30 dagen bewaart. Deze staan in IndexedDB op het apparaat en blijven daar, tenzij je kiest voor Sync of delen.
- <!--i:globe--> **De stadszoekopdrachten van Meeting Planner**, in `localStorage`, zodat elke stad één keer wordt opgezocht.
- <!--i:cpu--> **Gedownloade modellen en vastgepinde tools**: AI-modellen voor op je apparaat waarvoor je toestemming gaf om te downloaden en tools die je hebt vastgepind voor offline gebruik.

**Settings → Storage** toont hoeveel ruimte Lolly op het apparaat gebruikt, met je werk, de Prullenbak, gedownloade modellen, offlinekopieën en caches stuk voor stuk benoemd. **Clear all my data** verwijdert daar de lokale kopie en zet eerst Sync uit; de opslag van de site in je browser wissen doet hetzelfde. Opslag die strikt noodzakelijk is voor de dienst waar je om vroeg, vereist volgens de ePrivacy-richtlijn (art. 5, lid 3) geen toestemming, alleen transparantie, en dat bieden dit document en de melding in de app.

![Het opslaggedeelte van Settings op een telefoonbreed scherm: elke categorie gegevens op het apparaat is benoemd, met de knop Clear all my data naast de lijst](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** maakt een `lolly-backup`-bestand dat jij bewaart en beheert. Het komt nooit op onze servers, tenzij je het zelf ergens heen stuurt. Zie [Data transfer](/info/data-transfer.html).

### Hulpprogramma's die op je apparaat draaien

Sommige tools, zoals **Strip Hidden Data**, **Compress** en andere met het label **Runs on your device**, werken op een bestand dat jij aanlevert. Het bestand wordt in het geheugen gelezen, op het apparaat bewerkt en als download teruggegeven. Het wordt nooit geüpload, want er zit geen server in het pad. Deze hulpprogramma's werken offline en hun uitvoer bevat geen watermerk of metadata van ons.

**Rondocode** is de enige uitzondering, omdat het nieuwe audio maakt van jouw nummer in plaats van een bestand van jou te bewerken. Elk audiobestand dat het schrijft bevat Content Credentials die het nummer vastleggen en eventueel door AI gegenereerde zang vermelden. Het Export-paneel zegt dat vóór je exporteert, en [Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility) somt precies op wat er wordt vastgelegd.

![Het label dat deze tools dragen: Runs on your device - nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** en **Compare** werken in het geheugen van het apparaat en sturen niets naar een server, en Prepare voegt niets toe aan geschiedenis, links, back-ups of Sync totdat je een resultaat opslaat.

::: details Hoe Prepare for sharing en Compare met je bestanden omgaan
**Prepare for sharing** houdt werkinvoer, privévondsten en vervangingstabellen in het geheugen, zonder ze toe te voegen aan geschiedenis, links, back-ups of Sync. Inspectie en vervanging sturen geen bestandsinhoud naar een server en controleren online geen credentials. Jij kiest of je een resultaat kopieert, downloadt, verstuurt of opslaat in je bibliotheek; een opgeslagen resultaat volgt daarna de back-up- en Sync-instellingen van je bibliotheek. Receptbestanden laten eerdere inhoud en letterlijke koppelingen weg, en samenvattende rapporten bevatten aantallen, scope-ID's en bestandshashes. De CLI slaat alleen een privé-reviewbestand met de oorspronkelijke waarden op als je dat met `--review-file` vraagt. Een voorbereidingsweergave verlaten geeft de werkstatus vrij, wat geen belofte is van forensisch wissen uit het geheugen van de browser of het besturingssysteem.

Voorbereide kopieën en afgeronde bestandsbewerkingen delen de bediening van Compare. Verwijderde waarden starten ingeklapt, en vergelijkingsrapporten laten bronnamen, paden en waarden weg, tenzij je ze wilt opnemen. De bestandsgeschiedenis bewaart de kopie, dus vergelijken na een herlaad betekent dat je het origineel opnieuw selecteert, gekoppeld aan de vastgelegde SHA-256. Het selecteren slaat het bestand niet op en uploadt het niet.
:::

Strip Hidden Data en Prepare for sharing inspecteren op het apparaat ook DOCX-, PPTX- en XLSX-bestanden. Bij ondersteunde DOCX-bestanden kunnen geselecteerde eigenschappen in een nieuwe kopie worden verwijderd; andere Office-inhoud is alleen te inspecteren, en privévoorbeelden blijven achter een onthulknop.

::: details Wat de Office-inspectie leest en verwijdert
| Office-indeling | Geïnspecteerde pakketinhoud | Verwijdering ondersteund |
|---|---|---|
| DOCX | Kern-, toepassings- en aangepaste eigenschappen; opmerkingen en auteurs; markeringen en voorbeelden van bijgehouden wijzigingen; verborgen tekstblokken; externe relaties; ingesloten objecten | Geselecteerde auteur, laatst opgeslagen door, datums van aanmaken/wijzigen/laatst afdrukken, titel, onderwerp, beschrijving, trefwoorden, aangepaste eigenschappen, Company, Manager, Template, hyperlinkbasis, toepassingsnaam en -versie, en statistieken (totale bewerkingstijd en aantallen pagina's, woorden, tekens, regels en alinea's) |
| PPTX | Eigenschappen; opmerkingen en auteursgegevens; sprekersnotities; markeringen van verborgen dia's; externe relaties; ingesloten objecten en ondersteunde geneste werkmappen | Geen |
| XLSX | Eigenschappen; opmerkingen en notities; markeringen van verborgen bladen, rijen en kolommen; gedefinieerde namen; externe relaties en verbindingen; externe-koppelings- en draaitabelcache-oppervlakken; ingesloten objecten | Geen |

**Grenzen.** De telling inspecteert zichtbare tekst, formules, afhankelijkheden, weergegeven uiterlijk of willekeurige binaire onderdelen niet volledig. Ze ondersteunt maximaal 300 pakketonderdelen, 64 MiB aan totale aangegeven uitbreiding, 2 MiB per XML-onderdeel en twee geneste niveaus van ingesloten pakketten; Prepare deelt de budgetten voor onderdelen en uitbreiding over de hele taak. Afgekapte, misvormde, versleutelde en niet-ondersteunde inhoud wordt gemeld en behouden. Macro-inhoud wordt herkend en nooit uitgevoerd, oudere binaire Office-indelingen en XLSB worden niet geïnspecteerd, en externe verwijzingen worden nooit opgehaald.

**Wat DOCX-opschoning behoudt.** Opschoning ondersteunt de transitional DOCX-pakketindeling met canonieke kern-, aangepaste en uitgebreide eigenschapsonderdelen. Uit de uitgebreide eigenschappen kunnen Company, Manager, Template, HyperlinkBase, Application, AppVersion en de statistieken TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines en Paragraphs worden verwijderd. DocSecurity, kop- en onderdeeltitels, koppelingsvlaggen en andere toepassingseigenschappen blijven behouden. Het verwijderen van Template laat een gekoppelde sjabloonlink in de documentinstellingen staan, waar de telling die als externe relatie meldt.

Sommige lezers bepalen aan de hand van de toepassingsnaam en -versie hoe grafieken en tekeningen worden getekend; LibreOffice toont bijvoorbeeld een grafiek uit een Word 2007-bestand anders zonder die gegevens. Beide blijven behouden wanneer het bestand grafieken, afbeeldingen, vormen of ingesloten objecten bevat, en de inspectie vermeldt ze als behouden. Een eigenschap die een Word-veld toont (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS of NUMCHARS) blijft behouden, en koppelingsvelden en relatieve externe links behouden HyperlinkBase, omdat hun doelen ten opzichte van dat basisadres worden opgelost.

**Wat alleen-inspectie blijft.** Uitgebreide gegevens van digitale handtekeningen blokkeren opschoning. Ondertekende, macro-ingeschakelde, versleutelde, misvormde, hernoemde of geneste Office-pakketten blijven alleen te inspecteren. Hetzelfde geldt voor bestanden met andere van eigenschappen afhankelijke Word-velden, zoals DOCPROPERTY of AUTHOR, of met aan XML gebonden inhoudsbesturingselementen, omdat het verwijderen van een eigenschap het document kan veranderen wanneer Word die koppelingen bijwerkt, en in de cache bewaarde veldtekst niet kan aantonen dat de volgende weergave er hetzelfde uitziet. XML-onderdelen met ongebruikelijke bestandsextensies, Word-XML-relatiedoelen die niet veilig kunnen worden geïnspecteerd, onjuist aangegeven koptekst- of voettekstonderdelen en SVG-onderdelen die als XML zijn aangegeven met een `.svg`-extensie blijven in deze eerste opschoningsrelease ook alleen te inspecteren.

**Hoe opschoning zijn werk controleert.** Eigenschapsonderdelen, hun declaraties, niet-gerelateerde pakketleden, XML-opmerkingen en ZIP-opmerkingen blijven behouden. Opschoning past de grenzen van de telling toe en controleert de integriteit van elk lid vóór het schrijven, en inspecteert daarna de resulterende eigenschappen opnieuw. Compare toont ondersteunde eigenschapsverschillen met ingeklapte waarden; het vergelijkt geen zichtbare tekst of weergegeven uiterlijk. Waarden gebruiken voorvertoningen van maximaal 2048 tekens, dus verschillen voorbij een voorvertoning worden mogelijk niet getoond, en een gedeeltelijke controle kan niet vaststellen dat twee bestanden gelijk zijn. De `prepare --strip-hidden-data` van de CLI verwijdert ondersteunde DOCX-eigenschappen, en een privé-reviewenvelop kan afzonderlijke eigenschappen selecteren. Een mislukte opschoningscontrole behoudt het bestand en meldt een mislukte bewerking.
:::

## Elk netwerkverzoek dat de app kan doen

De meeste verzoeken brengen tools, lettertypen of modellen naar je apparaat. Send-acties verzenden het bestand dat je koos, Sync verzendt een back-up naar de opslag die je koos, en organisatiediensten verzenden de inhoud of gegevens die nodig zijn voor gedeeld werk. Elke groep hieronder noemt wat je apparaat verlaat, wanneer, en wat er gebeurt als een beheerder het verzoek blokkeert. De geconfigureerde identiteits- en assetproviders van een beheerder kunnen bestemmingen aan die implementatie toevoegen. [Every fixed host, in one table](#every-fixed-host-in-one-table) noemt de hosts die de webapp mag benaderen.

::: details Wat naar je apparaat wordt opgehaald
- <!--i:download--> **De toolcatalogus.** Niets persoonlijks: een verzoek om de openbare tool- en assetindex van Lolly zelf, naar het eigen adres van de app, bij het opstarten en daarna offline in de cache. Bij blokkering draait de app op zijn tools uit de cache en ontdekt geen nieuwe meer.
- <!--i:sparkle--> **Emojisets.** De set die je kiest wordt gedownload van het eigen adres van de app, de eerste keer dat je die set gebruikt. Er wordt niets persoonlijks verstuurd. Lottie-animaties worden op het apparaat gelezen en nemen met niemand contact op.
- <!--i:document--> **Google Fonts.** De gekozen familienaam en je IP-adres gaan naar de lettertypeservers van Google (`fonts.googleapis.com` voor het stijlblad, `fonts.gstatic.com` voor het lettertypebestand). Dit gebeurt alleen wanneer je in Design System Setup een Google Font toevoegt, en pas nadat je in een dialoog akkoord gaat die precies dit vermeldt. Elke familie wordt één keer opgehaald, daarna op het apparaat bewaard en offline gebruikt. Bij blokkering faalt de kiezer veilig; upload dan een lettertypebestand.
- <!--i:cpu--> **AI-modellen op het apparaat.** Niets persoonlijks: een download van een modelbestand, daarna op het apparaat bewaard. Webbuilds gebruiken standaard het eigen adres van de app; een build kan een andere modelhost noemen, zoals de releasehost van Lolly `lolli.li` voor de verpakte apps. De host ontvangt het verzoek en je IP-adres, zonder account en zonder modelinvoer. Dit gebeurt alleen wanneer je een functie gebruikt die een model nodig heeft (de diepe scan van Verify, afbeeldingen opschalen, spraak en dergelijke) of ervoor kiest modellen te downloaden voor offline gebruik. Bij blokkering wacht die functie en werkt al het andere.
- <!--i:sliders--> **ICC-persprofielen.** Niets persoonlijks: een verzoek om een standaardprofiel voor drukomstandigheden bij het openbare register van het ICC (`registry.color.org`, `www.color.org`), alleen wanneer je in het beheer van drukprofielen op een ICC-preset klikt, één keer per profiel. Bij blokkering mislukken de presets; lever dan je eigen `.icc`-profiel aan.
- <!--i:globe--> **Internetradio.** Niets persoonlijks: een afspeellijstverzoek en een audiostream van het station (`api.somafm.com` en de streamserver waarnaar die verwijst, `*.somafm.com`), alleen terwijl je de optionele radio in de geluidsspeler afspeelt. Bij blokkering faalt de radio en werken alle andere geluidsfuncties.
:::

::: details Een tool die live gegevens nodig heeft
- <!--i:globe--> **Het stadsopzoeken van Meeting Planner.** Op dit moment is dit de enige tool die live gegevens ophaalt. Hij vraagt `geocoding-api.open-meteo.com` om elke plaatsnaam (de gaststad en de stad van elk teamlid) om te zetten in coördinaten en een tijdzone, zonder account, zonder sleutel en zonder identificatie buiten het verzoek zelf. De invoer Host city legt dit uit, en elk antwoord wordt op het apparaat bewaard zodat een stad één keer wordt opgezocht. Het gebeurt alleen terwijl de tool open is. Bij blokkering faalt het opzoeken en blijft al het andere ongemoeid.
:::

::: details Bestanden die je verstuurt
Elk van deze verstuurt alleen het ene bestand dat je koos, wanneer je op de bijbehorende Send-knop drukt, na een aanmelding die je voltooit in het eigen venster van de dienst. Het app-wachtwoord van Bluesky, het webhookadres van Discord, het app-wachtwoord van Nextcloud en de S3-sleutels worden alleen op dit apparaat bewaard, nooit in een back-up, en **Disconnect** wist ze.

- <!--i:upload--> **Google Drive.** Het bestand, in elk formaat, gaat naar de Drive-API van Google (`www.googleapis.com`). De toegang van Lolly is beperkt tot bestanden die het zelf aanmaakte (de `drive.file`-scope), dus het kan de rest van je Drive nooit lezen. In de webapp wordt het aanmeldtoken voor de sessie in het geheugen gehouden en nooit opgeslagen; in de andere apps wordt een refreshtoken alleen op dit apparaat opgeslagen als je **Stay connected** aanvinkt. De knop bestaat alleen in builds waarin de beheerder een Google-client-id heeft ingesteld. Bij blokkering verschijnt de knop nooit; download het bestand en upload het zelf.
- <!--i:upload--> **Dropbox.** Het bestand gaat naar de API van Dropbox (`api.dropboxapi.com` voor aanmelden en metadata, `content.dropboxapi.com` voor het bestand). De toegang geldt alleen voor de app-map, dus Lolly ziet `Apps/` en de eigen map daarin en verder niets. De **Open**-link die het toont is een kortlevende privélink, en er wordt geen openbare deellink gemaakt. Een refreshtoken wordt alleen opgeslagen als je **Stay connected** aanvinkt. De knop bestaat alleen met een door de beheerder ingestelde Dropbox-client-id.
- <!--i:upload--> **OneDrive.** Het bestand gaat naar de identiteits- en Graph-diensten van Microsoft (`login.microsoftonline.com` voor aanmelden, `graph.microsoft.com` voor de upload); een groot bestand wordt in delen geüpload naar `api.onedrive.com` of naar opslagbronnen die de beheerder heeft ingesteld. De toegang is beperkt tot de eigen map van Lolly onder `Apps/`, plus je weergavenaam voor het accountlabel. Een refreshtoken wordt alleen opgeslagen als je **Stay connected** aanvinkt. De knop bestaat alleen met een door de beheerder ingestelde Microsoft-client-id.
- <!--i:upload--> **LinkedIn**, **alleen in de desktop-apps**. Het bestand, met zijn naam als berichttekst, gaat naar LinkedIn (`www.linkedin.com` voor aanmelden in je eigen browser, `api.linkedin.com` voor de upload en het bericht) als openbaar bericht op je eigen feed. Lolly kan als jou posten en je naam lezen voor het accountlabel, verder niets. De aanmelding wordt alleen bewaard als je **Stay connected** aanvinkt, en de tokens van LinkedIn gelden 60 dagen en kunnen niet stilzwijgend worden verlengd, dus ze verlopen vanzelf. Die hosts staan niet in het verbindingsbeleid van de webapp. De knop bestaat alleen in builds met een geconfigureerde LinkedIn-app.
- <!--i:upload--> **Penpot.** Je persoonlijke toegangstoken voor Penpot, dat je in de app plakt, en het `.penpot`-archief van het ontwerp gaan naar de API van Penpot (`design.penpot.app`) via een kleine doorgeefschakel op het eigen adres van de app (`/api/penpot`), omdat de API van Penpot een browser niet rechtstreeks beantwoordt. De doorgeefschakel stuurt door en vergeet; de desktop-apps praten rechtstreeks met Penpot. Dit gebeurt alleen wanneer je in de Design-tool op **Send to Penpot** drukt en een project bevestigt. Bij blokkering faalt het versturen veilig; exporteer het `.penpot`-bestand en importeer het zelf.
- <!--i:upload--> **Bluesky.** De afbeelding, haar naam als berichttekst en alt-tekst, en je handle en app-wachtwoord (aangemaakt onder Bluesky → Settings → App passwords, nooit je accountwachtwoord) gaan naar de Bluesky-server die je opgeeft, `bsky.social` tenzij je een andere kiest. Je koppelt eerst het account in **Settings → Connected services**.
- <!--i:upload--> **Discord.** Het bestand gaat als bijlage naar het kanaalwebhookadres dat je hebt geplakt, op discord.com. Iedereen met een webhookadres kan in dat kanaal posten, en daarom blijft het op het apparaat.
- <!--i:upload--> **Mastodon.** Het bestand, met zijn naam als berichttekst, gaat naar de Mastodon- of compatibele server die je opgeeft, na een aanmelding in het eigen venster van die server. Bij het koppelen wordt op die server een kleine app voor dit apparaat geregistreerd, en de aanmelding wordt alleen bewaard als je **Stay connected** aanvinkt.
- <!--i:upload--> **Nextcloud of WebDAV.** Het bestand gaat in één geauthenticeerde upload naar je eigen server, met het serveradres, de gebruikersnaam en het app-wachtwoord die je invoerde (Nextcloud → Settings → Security → Devices & sessions; nooit je accountwachtwoord).
- <!--i:upload--> **S3-compatibele opslag.** Het bestand gaat naar je eigen bucket (AWS S3, MinIO, R2, B2, Garage of elk SigV4-eindpunt), op het apparaat ondertekend met het sleutelpaar dat je invoerde.

**Hosts die je kiest hebben goedkeuring van de beheerder nodig.** De hosts voor Bluesky, Discord, Mastodon, Nextcloud en S3 staan niet in de vaste lijst van Lolly, omdat jij ze kiest. De app stuurt er niets naartoe totdat de beheerder precies die HTTPS-host heeft goedgekeurd: op het web in de Content Security Policy van de implementatie, in de desktop-apps wanneer de app wordt gebouwd. Hetzelfde geldt voor aangepaste opslag- en SharePoint-uploadhosts. Op het web moet de server bovendien browseraanroepen vanuit de app toestaan (CORS), en een redirect faalt veilig, dus gebruik een adres dat niet doorverwijst. De desktop-apps controleren elke redirect aan de hand van de goedgekeurde lijst.

Deze lijst beperkt welke hosts de app kan bereiken. Ze maakt geen onderscheid tussen accounts of tenants bij Google of Microsoft, en de eigen rechten van de provider bepalen welke accounts en acties zijn toegestaan. Ze omvat ook geen aanmeldvensters, andere brontypen of native functies, die hun eigen regels hebben. Een wijziging vereist een nieuwe desktopbuild of nieuwe webresponse-headers; sla je werk op voordat je de app opnieuw opent om die op te pikken. [Connector origins](/info/connector-origins.html) beschrijft de configuratie.
:::

::: details Sync tussen je apparaten
- <!--i:folder--> **Wat vertrekt.** Een kopie van wat je op dit apparaat hebt gemaakt (opgeslagen sessies en projecten, je design systems met hun lettertypen en logo's, geüploade afbeeldingen, je profiel en voorkeuren) als één bestand, naar de ene opslag die je koos: de Lolly-app-map in je Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), bestanden die Lolly aanmaakte in je Google Drive (`www.googleapis.com`), de Lolly-app-map in je OneDrive (`graph.microsoft.com`, waarbij grotere bestanden naar `api.onedrive.com` of door de beheerder ingestelde opslagbronnen worden geüpload, en downloads van exacte, door de beheerder ingestelde opslagbronnen komen), of je eigen Nextcloud, WebDAV-server of S3-bucket. Dezelfde opslag bewaart tot zeven dagelijkse kopieën en één kopie van vóór je laatste toepassing.
- <!--i:shieldcheck--> **Niets gaat naar Lolly.** Er zit geen Lolly-server, relay of Lolly Work-server in het pad, en de apps hebben er geen Lolly-website voor nodig, zelfs niet om aan te melden. De kopie wordt alleen eerst op het apparaat versleuteld als je een wachtwoordzin instelt. Aanmeldingen, sleutels, app-wachtwoorden, de wachtwoordzin en de Sync-instellingen blijven op het apparaat en staan nooit in de kopie. Op het web bewaart een onthouden Google Drive-koppeling alleen je accountnaam (en je eigen client-id, als je er een opgaf), en de Google-aanmelding duurt één bezoek. In de Android-app loopt de Google Drive-aanmelding via Google Play-services op de telefoon, die Google beheert.
- <!--i:sliders--> **Wanneer.** Alleen nadat je **Sync across my devices** aanzet of op **Sync now** drukt: een upload kort na elke wijziging en wanneer je de app verlaat, en een controle op een nieuwere kopie wanneer de app start. Bij blokkering faalt Sync en zegt waarom, en je werk blijft op het apparaat. Je kunt in plaats daarvan je gegevens naar een bestand exporteren en zelf verplaatsen. [Sync your devices](/info/sync.html) behandelt de functie.
:::

::: details Webpagina's, opnamen en afbeeldingen van andere sites
- <!--i:monitor--> **Een URL die je een tool laat vastleggen.** De URL-screenshottool vraagt het exacte adres op dat je typt, alleen wanneer je de opname start. Omdat jij het adres op dat moment kiest, staat het niet in het verbindingsbeleid en kan een beheerder het niet per host toestaan of blokkeren; om het te verwijderen, verwijder je de tool.
- <!--i:globe--> **Een webpagina in een Design-vak.** De pagina wordt, met je IP-adres, opgevraagd bij de site waar ze vandaan komt, samen met alles wat de pagina zelf opvraagt. Waar de browser het ondersteunt, krijgt het frame geen cookies en geen ander adres mee dan de eigen oorsprong van de app, zodat je document en de link ervan nooit met het verzoek meereizen. In de webapp kunnen alleen deze spelers worden ingekaderd: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (kaarten) en `www.figma.com`, plus naslagpagina's op `wikipedia.org` en `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` en `www.openstreetmap.org`. **Allow pages from any site**, onder **Settings → Trusted sites**, laadt Lolly op je apparaat opnieuw onder een beleid dat elke `https:`-pagina kan inkaderen, en dezelfde regels over vertrouwen en vragen blijven gelden. Een pagina laadt alleen voor een site in je Trusted sites, inclusief de verwijderbare standaardnaslagsites, of nadat je dat vak in zijn inspector goedkeurt; een deck dat iemand je stuurde toont tot die tijd een afbeelding van elke pagina. Voordat je presenteert biedt de lijst **Just this time** en **Always trust** voor elke site, en tijdens het presenteren wordt niets gevraagd. Bij blokkering toont het vak zijn afbeelding met een link om de pagina in een nieuw tabblad te openen. Lolly-tools en Sandbox-demo's in een vak draaien op het eigen adres van de app en nemen met niemand contact op.
- <!--i:sliders--> **Een pagina aanpassen die je toont.** De actie **Use page** van een webpaginavak laat je cookies weigeren of een banner sluiten binnen de pagina. Bij toegankelijke Lolly-pagina's verbergt **Hide cookie banners** bekende overlays, waaronder OneTrust, zonder cookies te accepteren of de toestemmingskeuze van de site te wijzigen. **Page CSS** wijzigt de live pagina en presentatie van dat vak; exports gebruiken nog steeds de gekozen poster. De regels kunnen geen bronnen of lettertypen importeren, en browsers beletten Lolly de CSS van een andere site te wijzigen. Sandbox-voorbeelden hebben een eigen CSS-editor onder **Edit in Sandbox**.
- <!--i:code--> **De webbronnen van een Sandbox-demo.** Elk stijlblad, script, lettertype of elke afbeelding waar de code van de demo naar linkt, wordt met je IP-adres en zonder cookies opgevraagd bij de site die ze host; bestanden die een opgehaald stijlblad noemt, zoals de lettertypebestanden van Google Fonts, tellen als aparte sites. Dit gebeurt alleen nadat je op **Fetch & inline** klikt, of voor een site in je Trusted sites; **Always trust** naast een bestand voegt zijn site aan die lijst toe. Bij blokkering draait de demo zonder die bestanden, en de Sandbox noemt elk bestand dat niet kon worden opgehaald en waarom.
- <!--i:download--> **Een afbeelding toevoegen via een URL.** **Add from URL** in de assetkiezer of Assets vraagt het exacte afbeeldingsadres op dat je plakt. Het eigen beleid van de webapp belet de browser een andere site rechtstreeks op te halen, dus een kleine doorgeefschakel op het eigen adres van de app (`/api/fetch-image`) haalt de afbeelding op en geeft alleen de bytes terug; hij slaat niets op, vergeet het adres en weigert alles wat geen openbaar afbeeldingsadres is. De desktop-apps halen het adres rechtstreeks op. Een Lolly-link die je plakt wordt helemaal niet opgehaald: die wordt op het apparaat gerenderd. Als de beheerder de doorgeefschakel uitzet (`LOLLY_DISABLE_IMAGE_PROXY=1`), kunnen in de webapp alleen Lolly-links, `data:`-afbeeldingen en afbeeldingen van dezelfde oorsprong worden toegevoegd, en de desktop-apps blijven ongemoeid.
- <!--i:palette--> **Een design system van een website.** Design System Setup kan één pagina lezen van een site die je noemt, via de [browserextensie](#the-browser-extension) of de eigen fetch van de desktop-app, nooit via een Lolly-server. Er wordt niets opgehaald voordat je drukt, en links op de pagina worden niet gevolgd.
:::

::: details Samenwerken met andere mensen en agents
- <!--i:link--> **Een privécollab.** Twee apparaten verbinden rechtstreeks, zonder server ertussen. De uitnodiging en het antwoord bevatten de adressen die elk apparaat zelf op zijn eigen netwerk ziet, en deze build configureert geen externe server voor adresontdekking, dus geef ze alleen aan de persoon met wie je werkt. Zie [Working together](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, in de desktop-app. Zolang je zichtbaar bent, wat tien minuten is wanneer je een collab-uitnodiging start of, als je dat aanzet, telkens wanneer de app draait, kondigt de app een willekeurige naam, de weergavenaam die je koos en het soort apparaat aan op het lokale netwerk. Het kondigt geen e-mailadres, account of blijvende identificatie aan.
- <!--i:link--> **Een agent uitnodigen.** De status van het uitgenodigde document, de voorbeelden die de agent opvraagt, de identiteit van de agent en zijn bewerkingen gaan via de geconfigureerde live relay (`lolly.ing` op lolly.tools) naar de agent die je uitnodigt. Een geïnstalleerde gehoste plug-in stuurt aanroepen ook door via de lolly.tools-connector naar de relay die de uitnodiging kiest; de connector bewaart tussen aanroepen geen uitnodiging of document. De relay houdt uitnodigingen en openstaande verzoeken in het geheugen totdat je de verbinding verbreekt of ze verlopen: tien minuten voor een ongebruikte uitnodiging en dertig minuten zonder activiteit voor een uitnodiging waarmee iemand is aangesloten. De provider van je agent verwerkt de gegevens die hij ontvangt onder zijn eigen beleid. Dit gebeurt alleen nadat je in Share een uitnodiging maakt en de instructies ervan aan je agent geeft; leestoegang staat inspectie toe en bewerktoegang staat ook wijzigingen toe. Pauzeren stopt wijzigingen, en Disconnect of de uitnodiging intrekken beëindigt de toegang. Bij blokkering kan de agent niet deelnemen of doorgaan, en blijf jij gewoon bewerken.
- <!--i:cpu--> **Allow AI control**, in de desktop-app. Een agent die op deze computer draait kan het geopende Design-document lezen en bewerken via een verbinding die op de computer blijft. Het staat uit totdat je het aanzet. Lolly stuurt hiervoor niets naar een server; de provider van de agent verwerkt wat de agent leest onder zijn eigen beleid. [Threat Model & Trust Boundaries](/info/threat-model.html) noemt wat zo'n agent wel en niet kan doen.
- <!--i:server--> **Een externe instantie.** Wanneer je de app naar een andere Lolly-implementatie laat wijzen, ontvangt hij wat die instantie teruggeeft, via dezelfde catalogussynchronisatie, plus een versietag bij verzoeken ernaartoe (het soort app en de engineversie, dezelfde informatie die een user agent meestuurt), zodat de beheerder kan zien welke Lolly-versies in gebruik zijn. Op een beheerde instantie bevat de tag, terwijl je bent aangemeld, ook een installatie-id voor dit apparaat, zodat de apparatenlijst van de beheerder installaties kan onderscheiden; weggaan verwijdert het id, en een apparaat dat later weer verbindt presenteert een nieuw id. Jij kiest de host, dus hij staat niet in het verbindingsbeleid. Bij blokkering mislukt het overschakelen en blijft je lokale instantie ongemoeid.
- <!--i:people--> **De Lolly Work-instantie van je organisatie.** Aanmeldidentiteit en apparaatgegevens, beleidsverzoeken, de gedeelde sessies, samenwerkingsbewerkingen, uploads, goedkeuringsindieningen en bezorgbestanden die je gebruikt, en toegestane labels voor gebruiksgebeurtenissen waar dat is ingesteld, gaan naar de instantie van je organisatie, met aanmelden via haar identiteitsprovider. Beleidsverversingen en ingeschakelde telemetrie kunnen tijdens gebruik draaien; gedeeld werk, collabs, review en bezorging sturen inhoud mee als onderdeel van die workflows. Bij blokkering kunnen die organisatiefuncties niet worden voltooid, en blijft je persoonlijke werk gescheiden. Zie [Organisation services with Lolly Work](#organisation-services-with-lolly-work).
:::

### Elke vaste host, in één tabel

De Content Security Policy van de webapp voorkomt dat een script een host bereikt die niet in de lijst staat. Naast het eigen adres van de app noemt de tabel elke host die dat beleid vermeldt, plus de twee LinkedIn-hosts die de desktop-apps toevoegen, gemarkeerd als alleen voor desktop. Een CI-test controleert deze tabel tegen het uitgerolde beleid, zodat een host niet aan het ene kan worden toegevoegd zonder het andere.

| Wat | Wat je apparaat echt verlaat | Hosts |
|---|---|---|
| Modellen op het apparaat in de verpakte apps, en releasebestanden | Een verzoek om een openbaar bestand, met je IP-adres | `lolli.li` |
| Google Fonts | De naam van de lettertypefamilie en je IP-adres | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Verzenden naar en Sync met Google Drive | Het bestand of de back-up die je koos | `www.googleapis.com` |
| Verzenden naar en Sync met Dropbox | Het bestand of de back-up die je koos | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Verzenden naar en Sync met OneDrive | Het bestand of de back-up die je koos, en je weergavenaam voor het accountlabel | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Het stadsopzoeken van Meeting Planner | Elke plaatsnaam | `geocoding-api.open-meteo.com` |
| ICC-persprofielen | Een verzoek om een openbaar profiel | `registry.color.org`, `www.color.org` |
| Internetradio | Een afspeellijstverzoek en een audiostream | `api.somafm.com`, `*.somafm.com` |
| Een agent uitnodigen, en de lolly.ing-werkruimte | De status van het uitgenodigde document, voorbeelden en bewerkingen, en de werkruimteverzoeken die je doet | `lolly.ing` |
| Spelers in een Design-webvak | Een verzoek om de pagina, met je IP-adres | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Naslagpagina's in een Design-webvak | Een verzoek om de pagina, met je IP-adres | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Verzenden naar LinkedIn, alleen in de desktop-apps | Het bestand, met zijn naam, als openbaar bericht | `www.linkedin.com`, `api.linkedin.com` |

De eigen lijst van de desktop-apps bevat ook het tokeneindpunt van Google voor het aanmelden bij Drive. Elke andere host, zoals een Mastodon- of Nextcloud-server die je opgeeft, vereist goedkeuring van de beheerder, zoals beschreven onder Bestanden die je verstuurt. Hosts die je op het moment van gebruik kiest, zoals een URL die je vastlegt of een externe instantie die je opgeeft, staan in geen enkele lijst.


**SEAL-handtekeningen doen geen verzoek.** Verify kan SEAL-handtekeningen controleren, een schema waarvan de ondertekeningssleutel in DNS kan worden gepubliceerd. Browsers kunnen geen DNS-query's doen, dus een webopzoeking zou via een DNS-over-HTTPS-resolver van een derde moeten lopen, die het gecontroleerde domein en je IP-adres zou zien. Lolly gebruikte vroeger de resolver van Cloudflare; dat gebeurt niet meer, en niets heeft Cloudflare vervangen. Geen enkele Lolly-app zoekt vandaag SEAL-sleutels op: de desktop- en mobiele apps draaien dezelfde Verify-weergave, en `lolly validate` op de opdrachtregel controleert SEAL niet. Een bestand waarvan het SEAL-record zijn sleutel inline meedraagt, wordt offline gecontroleerd, en Verify noemt de handtekening intern consistent zonder het domein te bevestigen. Een bestand waarvan de sleutel alleen in DNS staat, toont **SEAL signature did not verify**, met de reden "no key resolver and no inline key".

![Het Verify-scherm: een neerzetgebied en verder niets - het bestand wordt gecontroleerd waar het al staat, zonder upload en zonder account](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Je kunt dit en elke andere bewering op deze pagina zelf controleren: [Verify It Yourself](/info/verify-yourself.html) geeft de opdrachten en de verwachte uitvoer.

## Diensten die lolly.tools draait

Deze draaien op lolly.tools voor iedereen. Elk ontvangt alleen wat jij stuurt. [Server Surface](/info/server-surface.html) beschrijft dezelfde onderdelen zoals ze werken in elke implementatie.

### Renderlinks

Elke URL van de vorm `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` rendert echt, en de invoer reist mee in de URL, zodat een gedeelde Lolly-link als live afbeelding kan verschijnen in een README, een wiki of een dashboard. Zo'n link ophalen vraagt de server om **openbare tool- en catalogusgegevens** te renderen met de invoer die in het adres staat.

- <!--i:usercheck--> **Geen accounts, geen cookies, geen status.** De route vraagt geen aanmelding en er wordt niets op je apparaat gelezen. Je documenten, sessies en uploads verlaten je browser nooit en kunnen niet in deze links voorkomen.
- <!--i:document--> **De URL zelf wordt vastgelegd.** De querystring van een URL maakt deel uit van het verzoek, dus ze verschijnt in de gewone toegangslogs van het hostingplatform, net als elk opgevraagd pad. Als de invoer van een link iemands naam of e-mailadres bevat, zoals een naambadge of een e-mailhandtekening, **staat die tekst in die logs**. Geef een renderlink alleen wat je ook op een openbare pagina zou zetten.
- <!--i:globe--> **De invoer is hoe dan ook openbaar.** Het is wat de maker van de link in de URL typte, leesbaar voor iedereen die de link bereikt. Zet geen geheimen in een gedeelde link; Lolly biedt linkversleuteling voor gevoelige inhoud.
- <!--i:eyeoff--> **In de cache, begrensd en niet geïndexeerd.** Antwoorden worden gecachet en begrensd in aantal verzoeken zoals elke openbare afbeelding, en gemarkeerd met `noindex` zodat zoekmachines je renders buiten beschouwing laten.

Een zelf gehoste implementatie die geen openbare renderroute wil, stelt `LOLLY_DISABLE_RENDER_GET=1` in, en elk van deze URL's geeft 404 terug.

### De afbeeldingsophaler en de Penpot-doorgeefschakel

**Add from URL** in de webapp en **Send to Penpot** gebruiken twee kleine doorgeefschakels op lolly.tools, beschreven onder [Elk netwerkverzoek dat de app kan doen](#every-network-request-the-app-can-make). De afbeeldingsophaler bewaart niets en vergeet het adres. De Penpot-doorgeefschakel stuurt je token en archief door naar Penpot en bewaart geen van beide; hij logt de opdrachtnaam en de responsstatus van Penpot.

### De MCP-server, voor AI-agents

Een AI-agent kan Lolly bereiken via het Model Context Protocol, via een eindpunt dat een beheerder draait. lolly.tools draait er een, en iedereen kan een eigen draaien, ook volledig offline.

- <!--i:cpu--> **Bestanden die een agent verstuurt.** De tools die een bestand aannemen (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` en de afbeeldingstools `lolly_look`, `lolly_sample_color` en `lolly_trace_edges`) verwerken het in het geheugen en geven het resultaat terug in dezelfde aanroep. Het bestand wordt nooit naar schijf geschreven en wordt niet bewaard zodra het verzoek klaar is. `lolly_inspect` neemt ook een bestand aan, en de video- en drukwerkcontroles ervan schrijven een tijdelijke werkkopie die wordt verwijderd zodra de aanroep terugkeert. Elke andere tool werkt met de parameters in de aanroep: tekst, getallen, kleuren, URL's, id's van catalogusassets of een document dat de aanroeper aanlevert.
- <!--i:cpu--> **Rebrand zegt waar een deck heen gaat.** De eerste fase van `lolly_rebrand`, `capabilities`, zegt in woorden waar je bytes heen zouden gaan voordat je iets verstuurt: op een zelf gehoste lokale server verlaat het deck die machine nooit, en op een gehoste server stuurt het aanroepen van `lolly_rebrand` het deck daarheen, tot de grenzen voor grootte en aantal dia's die die fase geeft.
- <!--i:lock--> **Het open eindpunt.** Op lolly.tools is `lolly.tools/api/mcp` voor iedereen open, zonder token. Aanroepen zijn begrensd per adres en door een dagbudget. Het adres wordt een pseudoniem digest in de opslag voor misbruikbestrijding, zoals bij de aanmeldeindpunten hieronder, en het budget telt alleen CPU-tijd en verzonden bytes, zonder adres. Het bearer-token van een afgeschermd eindpunt wordt nooit in een log of renderURL geschreven.
- <!--i:link--> **Downloadlinks voor grote resultaten.** lolly.tools geeft resultaten inline terug en geeft deze links nooit uit. Een beheerder kan ze inschakelen voor de eigen geauthenticeerde gateway, waar een resultaat hoogstens vijf minuten wordt vastgehouden en alleen het eigen bearer-token van de aanroeper het kan ophalen; zie [MCP Server](/info/mcp.html#private-download-links-for-large-results). Een geplande afgeschermde endpoint op `mcp.lolly.tools` zou een bearer-token accepteren dat de beheerder aan vertrouwde clients uitgeeft, of OAuth 2.1 met kortlevende ondertekende tokens die worden gecontroleerd aan de hand van een gedeeld geheim; de activering is in behandeling, en het staat vermeld onder [Bezorghosts en verwerkers](#delivery-hosts-and-processors).

### Geverifieerde identiteit: een aanmelding die je zelf start

Lolly kan een **Content Credential** in je exports verzegelen, zodat iedereen offline kan nagaan dat een bestand ongewijzigd is sinds het Lolly verliet. Dat staat **standaard aan en is volledig lokaal**: de ondertekeningssleutel wordt op je apparaat gemaakt en het ondertekenen gebeurt offline. Zonder inschrijving is die sleutel een wegwerpsleutel, een vers sleutelpaar dat per export wordt gemaakt en daarna wordt weggegooid. Zodra je je inschrijft, blijft de sleutel bestaan en wordt hij **niet-exporteerbaar** gegenereerd, zodat zelfs de eigen code van Lolly hem niet kan lezen, alleen kan vragen om te ondertekenen. In beide gevallen verlaat hij je apparaat nooit.

[Exporting](/info/exporting.html#content-credentials-c2pa) noemt wat een credential vastlegt: de tool, het tijdstip, het grove exportoppervlak, je naam alleen als je *Use my details* aanzette, de gecrediteerde werken die een export plaatst, en elk Rondocode-nummer dat een video- of audio-export afspeelt (de naam, een hash van de bron en hoe de sandbox van Lolly het nummer renderde). Het exportpaneel somt die nummers op voordat je exporteert.

De credential en de metadata van het bestand leggen ook het [design system en de colourway](/info/exporting.html#the-design-system-record) vast die de export tekenden: het id en de naam van het design system, de gepubliceerde versie en de colourway. De naam van een design system is tekst die de eigenaars typten en kan de naam van een klant zijn, dus de kaart **Design system** in het exportpaneel toont de exacte woorden voordat je exporteert. Haal het vinkje van de kaart weg, of geef `_madewith=0` of `--no-madewith` mee, om ze weg te laten.

De ene *optionele* stap daar bovenop is het inschrijven van een geverifieerde identiteit, zodat je exports "Verified - signed by \<your email\>" zeggen in plaats van een anonieme sleutel te noemen. **Als je de inschrijving overslaat, ontvangt de certificaatdienst geen inschrijvingsgegevens van jou.**

![De kaart Verified identity in Settings, op telefoonbreedte: de keuze voor de levensduur van het certificaat en daaronder de inschrijfstap, slapend totdat je hem zelf start](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Als je je wel inschrijft, gebeurt precies dit:

::: timeline
- <!--i:usercheck--> **Je kiest een aanmeldmethode**: GitHub, Google, SUSE (id.suse.com) of een gemailde link. Bij de drie OIDC-providers ga je naar de eigen aanmeldpagina van die provider, onder hun privacybeleid, niet het onze, en de certificaatdienst krijgt alleen een geverifieerd e-mailadres en de naam van de provider terug. Bij de e-maillink gaat het adres dat je typt naar **Resend**, een dienst voor transactionele e-mail, alleen om die ene link te bezorgen.
- <!--i:lock--> **Een kortlevende cookie beschermt de redirect.** De certificaatdienst zet `lolly_ca_state`, `HttpOnly`, beperkt tot `/api/ca` en verlopend binnen tien minuten. Hij bevat een willekeurige waarde in plaats van een trackingidentificatie, bestaat alleen om te voorkomen dat de aanmeldredirect wordt vervalst en wordt gewist zodra het aanmelden klaar is.
- <!--i:eyeoff--> **Je IP-adres wordt kort gebruikt om misbruik te voorkomen** van de aanmeldeindpunten, zodat één script geen inbox kan overspoelen of het e-mailquotum kan opmaken. Lolly maakt er een SHA-256-digest van voordat het de kortlevende opslag voor misbruikbestrijding bereikt, dus het ruwe adres wordt daar niet naartoe gestuurd. De digest is pseudoniem in plaats van anoniem: wie de opslag in handen heeft, zou een IPv4-adres kunnen terugvinden door elk mogelijk adres te proberen. De bucket verloopt na ongeveer een minuut en wordt voor niets anders gebruikt. Gewone toegangslogs van de hosting staan los hiervan en worden hieronder beschreven.
- <!--i:seal--> **De dienst geeft een certificaat uit** dat je geverifieerde e-mailadres koppelt aan de publieke sleutel van je apparaat. De privésleutel blijft op het apparaat: de client stuurt een certificaataanvraag met een gebonden bewijs van bezit, en geen privésleutel van het apparaat gaat naar een van beide uitgevermodi.
- <!--i:check--> **Ondertekenen blijft lokaal.** Met de legacy-uitgever heeft een export geen verzoek aan de certificaatdienst nodig. Een beheerde identiteit heeft bovendien een verse, ondertekende intrekkingslijst van haar uitgever nodig; de client kan een lijst uit de cache gebruiken binnen het geconfigureerde versheidsvenster, en het verversen ervan kan tijdens een export contact opnemen met de certificaatdienst. Ontbrekende, verlopen of ongeldige status verhindert dat de beheerde identiteit wordt gebruikt.
:::

::: details Bewaartermijn en intrekking per uitgevermodus
**Legacy gehoste uitgifte** biedt 7, 30, 90 of 365 dagen, begrensd door de beheerder. Ze houdt geen identiteitsinventaris en geen uitgifte-log bij, dus ze kan niet opzoeken wie een certificaat kreeg of de certificaten van die persoon intrekken; de levensduur is de intrekking.

**Beheerde organisatie-uitgifte** gebruikt een standaardlevensduur van hoogstens 24 uur en een maximum van zeven dagen, met een eigen root en uitgevertrouwensbeleid, en het ondertekenen gaat naar de Vault-uitgever die de beheerder instelde. De inschrijfapplicatie gebruikt een gedeelde toelatingsopslag voor eenmalig gebruik die alleen een gesleutelde authenticatie-identificatie en een aanvraagdigest bevat, hoogstens tien minuten, en slaat geen identiteitsinventaris of cache van certificaatantwoorden op. De PKI-provider, zijn auditapparaten, gateways en back-ups hebben hun eigen gegevensstromen. Zelfs met de gewone uitgifteopslag uitgeschakeld kan certificaatgebaseerde intrekking het certificaat bewaren, inclusief de e-mailidentiteit, en kunnen intrekkingsserienummers en audit-id's koppelbaar blijven; het beleid van je beheerder bepaalt die inventaris, wie erbij kan en hoe lang die wordt bewaard.

Een beheerd apparaat kan met een geauthenticeerd bewijs van het apparaat vragen zijn eigen certificaat in te trekken, en geen enkele API vraagt om de privésleutel van het apparaat. De beheerder kan een uitgever intrekken via zijn vertrouwensbeleid. Lolly houdt geen koppeling bij tussen mensen en certificaten, dus het intrekken van iemands certificaten bij vertrek hangt af van records die de beheerder bijhoudt, en PKI-records, auditrecords, ontvangers en back-ups volgen het beleid van de beheerder. Het [ontwerp van de certificaatdienst](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) behandelt bewaring door de uitgever, bewaring door de provider en kwalificatie.
:::

## Organisatiediensten met Lolly Work

**Lolly Work** is de optionele organisatiedienst van het Lolly-project, apart uitgerold door elke organisatie die een instantie draait. Verbinden met een instantie voegt gegevens toe die op die server worden bewaard naast je lokale bewerking. De beheerder ervan is verantwoordelijk voor het privacybeleid, de toegangscontroles, de ontvangers, de bewaartermijnen en de back-ups van die implementatie.

| Workflow | Gegevens die de dienst van de organisatie verwerkt |
|---|---|
| Aanmelden en provisioning | Claims van de identiteitsprovider, account- en groepslidmaatschap, aanmeldsessies en apparaatgegevens. OIDC regelt het aanmelden; beheerders kunnen accounts via SCIM aanmaken en deactiveren |
| Gedeelde catalogus en projecten | Geüploade assets, metadata en versies; gedeelde projecten en sessies; inhoud opgehaald bij geconfigureerde bibliotheekproviders |
| Werkcollabs | Gedeelde sessiestatus, live bewerkingen en aanwezigheid van deelnemers die via de instantie worden verstuurd; opgeslagen status blijft bestaan onder het opslagbeleid ervan |
| Beheerde deellinks | Linkdoel en toegangsinstellingen, zoals verloopdatum en optionele wachtwoordbeveiliging; verzoeken worden via de instantie opgelost en kunnen worden ingetrokken |
| Review en bezorging | Ingediende inhoud, goedkeuringsbeslissingen, gekozen bestemming, klaargezette bestanden en bezorgbewijzen |
| Serverrenders en batches | Ingediende toolinvoer, renderverzoeken, status en bewaarde uitvoerbestanden. Deze taken draaien op de server in plaats van op je apparaat |
| Gebruiksrapportage | Labels van gebeurtenissen op een toegestane lijst, zoals tool-id, formaat en asset-id, volgens het telemetriebeleid hieronder |
| Audit | Records van actor en actie voor beheerde bewerkingen, apart bewaard van de gebruikstelemetrie |

De dienst gebruikt authenticatiecookies, waaronder `lw_session` voor aangemelde leden en `lw_guest` voor gasttoegang waar die is ingeschakeld, los van de cookie van de certificaatdienst. Beleidsverversingen en ingeschakelde gebruiksrapportage kunnen verzoeken doen terwijl de app in gebruik is, zonder een aparte klik voor elk. Dit is verkeer naar de geconfigureerde instantie, geen rapport aan het Lolly-project over implementaties die het niet draait.

**Gebruikstelemetrie heeft drie niveaus.** `off` slaat geen gebruiksgebeurtenissen op, `aggregate` verwijdert gebruikers-id's en `standard` kan gebeurtenissen toeschrijven. Het standaardniveau is `standard`, dus een instantie slaat de gebruiksgebeurtenissen op die ze ontvangt, tenzij de beheerder `off` kiest. Het standaardtoeschrijvingsbeleid is `opt-in`, wat jouw toestemming vereist voordat een gebruikers-id wordt opgeslagen; een beheerder kan in plaats daarvan toegeschreven rapportage instellen met `telemetryAttribution: default`. Toegestane attributen zijn labels, nooit invoerwaarden van tools. Zie [Work telemetry](/info/work-telemetry.html).

**Audit staat los hiervan.** Beheerde acties kunnen een geïdentificeerd auditrecord bewaren, wat je telemetrietoestemming ook is. Telemetrie uitzetten zet de opslag van gedeelde sessies, goedkeuringsrecords, opslag van renderjobs of audit niet uit. De beheerder bepaalt bewaartermijn en wissing, inclusief eventuele pseudonimisering van het auditlog; zie [Work storage and data lifecycle](/info/work-data-lifecycle.html).

| | Je apparaat | De instantie van je organisatie |
|---|---|---|
| Wat het bevat | Je persoonlijke werk, voorkeuren en caches | Gedeeld werk, accounts, uploads, goedkeuringen, renders, audit en geconfigureerde telemetrie |
| Wie het verwijdert | Jij, met **Clear all my data** of de sitegegevens van je browser | De beheerder, via de eigen besturing van de instantie |
| Wie je kunt vragen | Niemand: de records staan op je apparaat | De beheerder van de instantie, voor toegang, export of wissing |

**Lokaal verwijderen is geen verwijderen op de server.** Een instantie verlaten of je browser wissen verwijdert de lokale status, niet de opgeslagen records of back-ups van de organisatie. Persoonlijke [Sync](/info/sync.html) en **Export my data** maken een back-up van je apparaat, niet van de dienst van de organisatie. De openbare demo op [lolly.work](https://lolly.work) bewaart zijn status alleen in het geheugen en is geen duurzame opslag voor je werk.

## De browserextensie

De browserextensie **Lolly URL Screenshot** verzamelt geen persoonsgegevens voor ons. Ze heeft geen analytics, geen tracking en geen eigen server. De pagina [Browser extension](/info/extension.html) beschrijft hoe ze werkt.

**Wat ze doet.** De Lolly-webapp kan haar om een screenshot van een webpagina vragen, of om de inhoud van een pagina om een design system te starten vanaf een website. Elk verzoek opent in de extensie een goedkeuringsvenster dat de aanvragende site toont, of er een screenshot of de pagina-inhoud wordt gewild, en het paginaadres. Pas nadat je op **Approve once** drukt, opent de extensie die pagina in een tijdelijk achtergrondtabblad, maakt de screenshot of leest de pagina, geeft het resultaat aan het Lolly-tabblad dat erom vroeg en sluit het tabblad. Elk verzoek heeft zijn eigen goedkeuring nodig.

**Gegevens.**

- <!--i:shieldcheck--> **Wij verzamelen niets.** Het resultaat gaat alleen naar de Lolly-pagina die erom vroeg, in dezelfde browser. De extensie slaat geen pagina-inhoud op en voegt geen andere ontvanger toe.
- <!--i:globe--> **Netwerkverzoeken.** De pagina die je goedkeurt laadt zoals in elk tabblad, samen met alles wat die pagina zelf opvraagt. Het lezen van de inhoud van een pagina haalt ook de stijlbladen van die pagina en een paar van haar pictogram- en logoafbeeldingen op, van binnenuit de pagina, en die ophaalacties sturen geen cookies naar andere sites. De extensie doet geen andere verzoeken en geen daarvan gaat naar een Lolly-server.
- <!--i:lock--> **Je browsersessie.** De pagina laadt met je browsersessie, zoals wanneer je haar zelf opent, dus een pagina waarbij je bent aangemeld kan privé-informatie in het resultaat zetten.
- <!--i:link--> **De adressen die je goedkeurt** worden alleen gebruikt om die ene pagina voor dat ene verzoek te laden. Ze worden niet gelogd of gedeeld.

**Machtigingen.**

- <!--i:wrench--> **`debugger`**: om de screenshot te maken via het DevTools Protocol, hetzelfde mechanisme dat de Lolly-desktop-app gebruikt.
- <!--i:monitor--> **`tabs`**: om het tijdelijke tabblad te openen en te sluiten, en om te controleren dat noch de Lolly-pagina noch de doelpagina is verplaatst sinds je goedkeurde.
- <!--i:code--> **`scripting`**: om de inhoud van een pagina in het tijdelijke tabblad te lezen, nadat je dat verzoek goedkeurt.
- <!--i:database--> **`storage`**: om de id's van de tijdelijke tabbladen in sessieopslag te noteren, zodat ze nog steeds sluiten als de browser de extensie tijdens een verzoek stopt. Er wordt geen pagina-inhoud opgeslagen.
- <!--i:check--> **Optionele sitetoegang (`http://*/*`, `https://*/*`)**: niet verleend bij installatie. Wanneer je op **Approve once** drukt, vraagt de extensie Chrome om toegang tot de ene site in dat verzoek, en Chrome vraagt het je de eerste keer voor elke site. Een site die je eerder toestond, heeft nog steeds bij elk verzoek een nieuwe goedkeuring nodig.

Geen van deze wordt gebruikt om je surfgedrag te lezen, te monitoren of door te geven, buiten het ene verzoek dat je goedkeurde.

## Bezorghosts en verwerkers

Openbare catalogusbestanden, tools en weergaveversies komen standaard van het eigen adres van de app. Inhoudsgeadresseerde namen veranderen waar een bestand wordt opgehaald, niet wie het verzoek ontvangt. Deze bezorgfunctie activeert geen CDN van een derde. Een CDN die TLS beëindigt zou verzoekgegevens ontvangen, waaronder IP-adressen en alle cookies of bearer-credentials die ernaartoe worden doorgestuurd, zelfs onder dezelfde browserhostnaam, dus een beheerder die er een toevoegt neemt een nieuwe verwerker aan.

**Voordat een CDN of externe modelhost wordt toegevoegd**, moet de beheerder de naam van de verwerker, de hostnaam, de rechtsgebieden, de ontvangen metadata, de bewaartermijn en de doorgiftearrangementen publiceren. [Delivery deployment](/info/deploy-delivery.html) noemt wat bekendgemaakt moet worden. Antwoorden uit privéwerkruimtes omzeilen gedeelde caches: persoonlijke resultaten, toegangsweigeringen en fouten gebruiken `private, no-store`, en een toegestaan privéantwoord kan in je browser opnieuw worden gevalideerd zonder openbaar te worden.

De referentiediensten gebruiken de hosting hieronder. Dit is een lijst van hostnamen, geen bewering dat de instantie van een andere organisatie dezelfde regio gebruikt.

| Hostnaam of dienst | Functie en ontvanger | Regio en gegevensverwerking |
|---|---|---|
| lolly.tools | Openbare app, catalogus, rendering en certificaatdiensten; UpCloud-hosting | Frankfurt, Duitsland. Verzoekgegevens kunnen in infrastructuurlogs voorkomen; gewoon lokaal bewerken blijft op het apparaat |
| lolly.ing | Beheerde werkruimte en documentagentdiensten; UpCloud-hosting | Frankfurt, Duitsland. De privédatabase en bestandsopslag staan op dezelfde host. Accounts, gedeelde inhoud en dienstrecords volgen het beleid van de beheerder van de instantie |
| mcp.lolly.tools | Geplande optionele geauthenticeerde MCP-gateway en privédownloads van resultaten; UpCloud-hosting | Frankfurt, Duitsland, met dezelfde hostingverwerker. Activering in behandeling. De gateway zou verzoekgegevens en de parameters of bestanden van de aanroeper ontvangen |
| lolli.li | Openbare release- en modelbestanden; UpCloud Managed Object Storage, gescheiden van het applicatiecluster | Frankfurt, Duitsland, in de europe-2-objectopslagregio van UpCloud. Een download stuurt verzoekgegevens, niet de invoer die het model later verwerkt |
| Geconfigureerde identiteitsprovider | Google, GitHub of de OIDC-provider van een beheerder | Aanmelden volgt het beleid van die provider. Vraag de beheerder van de instantie om hostnaam, regio en doorgiftearrangementen |
| Geconfigureerde assetprovider | Brandfolder of een andere bibliotheek die de beheerder kiest | De provider ontvangt toegestane bibliotheekverzoeken. Zijn bronrechten en het beleid van de instantie bepalen de toegang; vraag de beheerder om de hostnamen en regio's |
| E-mailinschrijving, wanneer geconfigureerd | Resend bezorgt de gevraagde aanmeldlink | Ontvangt het bestemmingse-mailadres voor dat bericht; zijn eigen verwerkingsvoorwaarden zijn van toepassing |

De referentietoepassing gebruikt geen andere hosting-, database- of misbruikbestrijdingsprovider. Een beheerder kan voor een andere instantie andere providers kiezen, en hosting-, identiteits-, asset- en e-mailproviders hebben elk hun eigen bekendmaking nodig. De [objectopslagregio](https://upcloud.com/docs/products/managed-object-storage/availability/) van de modelhost wordt apart geverifieerd van de regio van de applicatie.

**Optionele downloadlinks voor MCP, gebonden aan de aanroeper.** Een beheerder kan downloadlinks voor grote resultaten inschakelen op een geauthenticeerde gateway met één replica. Ze staan standaard uit. De anonieme gateway op `lolly.tools/api/mcp` geeft resultaten inline terug en geeft deze links nooit uit. De geplande afgeschermde hostnaam is `mcp.lolly.tools`, bij dezelfde UpCloud-verwerker in Frankfurt; de activering is in behandeling, en deze pagina beweert niet dat er een live downloadlinkdienst is. De links voegen geen CDN van een derde toe.

Alleen een geauthenticeerde aanroeper met een bestandsscope kan een link ontvangen, en het bearer-token van dezelfde aanroeper is nodig om hem op te halen: gebruik het gevalideerde bearer-token van de renderaanroep, niet een ander token voor hetzelfde account. De toekenning verloopt binnen 300 seconden. Eigendom en resultaatopzoeking blijven in het geheugen van de gateway, en uitvoerbytes gaan naar privé tijdelijke bestanden, opgeschoond na verloop of verwijderd bij een nette afsluiting. Een herstart van de gateway maakt bestaande links ongeldig. Vastgehouden resultaten zijn beperkt tot 64 MiB per bearer, 256 MiB over de hele gateway en 200 wachtende of vastgehouden bestanden. Dagelijkse budgetten voor CPU en gedecodeerde bytes tellen resultaten wanneer ze worden vastgehouden en wanneer ze worden gedownload. Antwoorden gebruiken `private, no-store` en `Referrer-Policy: no-referrer`. Het token van een link alleen laat geen andere persoon of agent het resultaat lezen.

## Infrastructuurlogs

Deze sectie beschrijft de openbare lolly.tools-implementatie. Het hostingplatform legt gewone verzoekgegevens vast: IP-adres, opgevraagd pad, tijdstempel en user agent. Lokale bewerkingen bereiken die host niet. De querystring van een renderlink kan de tekst bevatten die de aanroeper aanleverde, zoals hierboven uitgelegd. MCP-bestandstools verwerken de bytes die ze krijgen in het geheugen. Een Lolly Work-instantie bewaart daarnaast de hierboven beschreven records, onder het logbeleid van de beheerder.

**De openbare diensten houden applicatielogging tot een minimum beperkt.** De MCP-server logt opstart, configuratie en renderwaarschuwingen; hij houdt geen eigen verzoeklog bij en logt geen tokens of adressen van aanroepers. De Penpot-doorgeefschakel logt elke opdrachtnaam en de responsstatus van Penpot, nooit headers, tokens of het bestand. De certificaatdienst logt zijn opstartinstellingen en configuratiewaarschuwingen, plus twee gestripte regels bij een fout: een statuscode voor een mislukte verzending zonder ontvangeradres, en een vaste foutregel zonder fouttekst, stacktrace of URL, omdat een providerfout identiteitswaarden of credentials kan bevatten. Al het andere in het log komt van het hostingplatform.

Voor lolly.tools beheert de beheerder van de instantie het loggen van verzoeken, de rotatie en de bewaartermijn bij UpCloud. Deze pagina noemt geen maximale logbewaartermijn die niet is geverifieerd. Neem contact op met de verwerkingsverantwoordelijke hieronder voor het actuele schema en voor elk verzoek over logs die op de server staan. Voor een andere instantie gelden de instellingen van haar beheerder, inclusief logexports of andere verwerkers.

## Rechtsgronden, bewaartermijnen en ontvangers

Deze tabel behandelt de referentie-implementatie **lolly.tools**. Ze noemt niet de rechtsgronden of bewaartermijnen van de Lolly Work-instantie van je organisatie; de beheerder ervan geeft die in zijn eigen beleid.

| Verwerking | Rechtsgrond (GDPR art. 6) | Bewaard gedurende |
|---|---|---|
| Alles op je apparaat (documenten, voorkeuren, cache, tellers) | **Helemaal geen verwerking door ons**: het bereikt ons nooit. Opslag op je apparaat is strikt noodzakelijk voor de dienst waar je om vroeg (ePrivacy art. 5, lid 3), dus er is geen toestemming nodig | Totdat je het verwijdert |
| Je e-mailadres bij legacy gehoste inschrijving voor Content Credentials | **Art. 6(1)(b)**, uitvoering van een dienst waar je uitdrukkelijk om vroeg | Geen identiteitsinventaris of uitgifte-log in de legacy-dienst; het e-mailadres wordt tijdens het verzoek gebruikt en opgenomen in je certificaat. Bewaring van beheerde organisatie-PKI, audit en intrekking volgt het beleid van de beheerder |
| Een pseudoniem SHA-256-digest van je IP-adres, voor het begrenzen van de aanmeldeindpunten en de openbare render-, afbeeldings- en MCP-eindpunten | **Art. 6(1)(f)**, ons gerechtvaardigd belang bij het voorkomen van misbruik van een gratis dienst en van het e-mailquotum van een derde. Wij achten dat een belangenafweging te doorstaan omdat het ruwe adres niet naar de begrenzer wordt gestuurd, de digest alleen voor misbruikbestrijding wordt gebruikt en vanzelf verloopt | Ongeveer één minuut in de opslag voor misbruikbestrijding; daarna niet bewaard |
| Toegangslogs van de hosting (IP, pad, tijdstempel, user agent) | **Art. 6(1)(f)**, ons gerechtvaardigd belang bij beveiliging van de dienst, het voorkomen van misbruik en het diagnosticeren van storingen | Door de beheerder ingestelde rotatie en bewaartermijn; neem contact op met de verwerkingsverantwoordelijke voor het actuele schema |

**Ontvangers.** De categorieën ontvangers zijn onze hostingprovider (UpCloud), die de database en de opslag voor misbruikbestrijding van de applicatie host, en, alleen als je de aanmeldoptie via e-mail gebruikt, een provider van transactionele e-mail (Resend). De opslag voor misbruikbestrijding ontvangt alleen kortlevende digests, nooit het ruwe IP-adres. Als je je aanmeldt met GitHub, Google of SUSE (id.suse.com), heb je rechtstreeks met die provider te maken onder hun eigen privacybeleid, en zij geven ons een geverifieerd e-mailadres door en niets anders. We delen persoonsgegevens met niemand anders, en we verkopen geen gegevens, voeren geen reclame uit en profileren geen gebruikers.

**Doorgifte buiten de EER.** De hosting, database en bestandsopslag van de referentietoepassing staan in Frankfurt. Optionele identiteits-, e-mail- en assetproviders hebben hun eigen verwerkingslocaties en voorwaarden, die toegang van buiten de EER kunnen omvatten, en de regio van een server alleen bepaalt niet het rechtsgebied van elke ontvanger. Neem contact op met de verwerkingsverantwoordelijke voor de providerovereenkomsten en doorgiftearrangementen die van toepassing zijn; vraag het voor een andere instantie aan de beheerder ervan. De [standaardcontractbepalingen](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) van de Europese Commissie zijn één van de waarborgen die voor zulke doorgiften beschikbaar zijn; deze pagina beweert niet dat een niet-geverifieerde providerovereenkomst ze gebruikt.

**Geautomatiseerde besluitvorming.** Geen. Er is geen profilering en geen geautomatiseerd besluit met rechtsgevolgen of vergelijkbaar significante gevolgen (art. 22).

## Privacy van kinderen

Gewoon lokaal gebruik van de app stuurt geen persoonlijke inhoud naar lolly.tools. De optionele inschrijving voor Content Credentials ontvangt een e-mailadres en is niet gericht op of bedoeld voor kinderen. Organisatiediensten hebben hun eigen accounts en gegevensverwerking, onder het beleid van hun beheerder.

## Jouw rechten

Voor gegevens die alleen op je apparaat staan, kun je de gegevens zelf inzien, corrigeren, verwijderen en verplaatsen. Ze staan in de opslag van je browser of app, in een vorm die je kunt inspecteren, exporteren (**Export my data**, hierboven) of verwijderen (**Clear all my data**, of de sitegegevens van je browser).

Formeel heb je onder de artikelen 15-22 van de GDPR het recht op **inzage** in je persoonsgegevens, op **rectificatie**, op **wissing**, op **beperking** van of **bezwaar tegen** de verwerking ervan (inclusief alles wat wij baseren op gerechtvaardigde belangen), op **gegevensoverdraagbaarheid** en, waar de verwerking op toestemming berust, om **die toestemming op elk moment in te trekken**, zonder dat dit de rechtmatigheid raakt van wat eerder plaatsvond.

De openbare certificaatdienst houdt geen uitgifte-log bij. Infrastructuurlogs kunnen verzoekgegevens bevatten, dus dit beleid belooft niet dat de hostingomgeving geen persoonsgegevens bevat. Neem contact op met de verwerkingsverantwoordelijke voor inzage, wissing of een ander verzoek over die records; we leggen uit welke records bestaan en wat er kan worden gedaan. Voor werk, identiteiten, telemetrie en auditrecords die een organisatie bewaart, neem je contact op met je Lolly Work-beheerder, omdat lokale export- en verwijderopties die kopieën niet bereiken.

**Je hebt het recht om een klacht in te dienen.** Als je denkt dat we je gegevens onjuist hebben behandeld, kun je een klacht indienen bij een toezichthoudende autoriteit voor gegevensbescherming: in de EU de autoriteit in je land van verblijf, op je werkplek of waar je denkt dat de inbreuk plaatsvond (art. 77). Onze leidende toezichthouder is het *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) in Ansbach, Duitsland. Je hoeft niet eerst contact met ons op te nemen, al zouden we graag de kans krijgen het probleem op te lossen.

## Wijzigingen in dit beleid

De datum bovenaan verandert telkens wanneer dit document verandert. Een wijziging die verandert wat je apparaat verlaat of wat wordt bewaard, krijgt hier een eigen regel in plaats van een stille aanpassing. Om te zien wat er is veranderd, vraag het (hieronder) of vergelijk met de [openbare broncode](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29 september 2026:** de optionele dienst lolly.work verduidelijkt, met de inhoud die de organisatie bewaart, authenticatiecookies, gebruikstelemetrie en auditrecords, en de scheiding tussen lokaal verwijderen en bewaren op de server. Dit zijn bestaande optionele workflows, geen nieuwe uploadvereiste voor lokaal bewerken.

**11 oktober 2026:** de beschrijving van de beëindigde Vercel-hosting vervangen door de inventaris van UpCloud-applicatiehostnamen, optionele identiteits- en assetproviders onderscheiden, en inhoudsgeadresseerde bezorging en de vastgehouden MCP-downloadmodus beschreven. Door deze wijziging wordt geen CDN van een derde ingeschakeld. De logbewaartermijn wordt door de beheerder bepaald in plaats van door een vermelde standaard van een Vercel-abonnement.

**22 oktober 2026:** de beschrijving van bestaand gedrag gecorrigeerd. De sectie over de browserextensie behandelt nu het goedkeuringsvenster bij elk verzoek, sitetoegang die per site wordt gevraagd en het ophalen van stijlbladen en pictogrammen bij het lezen van een website. Ook gecorrigeerd: de rijen over Verzenden naar Google Drive en Meeting Planner, de SEAL-opmerking (geen enkele Lolly-app zoekt SEAL-sleutels op in DNS), het standaardniveau van gebruikstelemetrie van de organisatiedienst, de MCP-afbeeldingstools en de applicatielogging van de openbare diensten. De software zelf is niet gewijzigd.

**23 oktober 2026:** het beleid opnieuw ingedeeld naar wat elk verzoek start, en bestaand gedrag beschreven dat het eerder niet behandelde: privécollab-uitnodigingen met lokale netwerkadressen, Nearby in de desktop-app, Allow AI control, een design system lezen van een website, emojisets, de cache op het apparaat van Meeting Planner voor stadszoekopdrachten, de Prullenbak en de andere records die Settings → Storage noemt. Twee beweringen gecorrigeerd: Bluesky en Discord zijn niet alleen voor desktop, en elke host die iemand kiest om naartoe te sturen, heeft in zowel de web- als de desktop-apps de goedkeuring van de beheerder nodig; de digest van een IP-adres voor begrenzing is pseudoniem, niet anoniem. De software zelf is niet gewijzigd.

## Wie is verantwoordelijk, en hoe ons te bereiken

De **verwerkingsverantwoordelijke** voor lolly.tools is:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Duitsland

SUSE heeft een **functionaris voor gegevensbescherming** aangesteld, bereikbaar op [privacy@suse.com](mailto:privacy@suse.com). Gebruik dat adres voor elk formeel verzoek onder "Je rechten" hierboven.

Voor alles over Lolly zelf, zoals hoe het werkt, waarom iets is zoals het is of een correctie op dit document, neem je contact op met **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

Neem voor een zelf gehoste of enterprise Lolly-instantie contact op met wie die beheert: de beheerder is de verwerkingsverantwoordelijke voor de eigen implementatie. SUSE en het open-sourceproject Lolly bewaren geen gegevens voor implementaties die ze niet draaien.
