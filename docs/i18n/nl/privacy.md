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
om toestemming voor te geven, omdat er geen verzameling plaatsvindt - alleen deze melding, zodat je
weet wat er bewaard wordt en waar. Wis dit alles op elk moment met **Profiel → Al mijn
gegevens wissen**, of door de opslag van de site in je browser te wissen. (Onder de ePrivacy-
richtlijn art. 5(3) vereist opslag die strikt noodzakelijk is voor de dienst waar je om vroeg
geen toestemming - alleen transparantie, wat dit document en de melding in de app
allebei zijn.)

![Het opslaggedeelte van de profielpagina op een scherm ter breedte van een telefoon: elke categorie on-device data benoemd, met de knop Al mijn gegevens wissen er direct naast](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Je eigen back-up van deze data - de `lolly-backup`-bundel die **Mijn gegevens exporteren
& alles renderen** produceert - is een bestand dat je bewaart en beheert. Het raakt onze
servers nooit, tenzij je er zelf voor kiest om het ergens naartoe te sturen. Zie [Gegevens
overdragen](/info/data-transfer.html).

## On-device hulpprogramma's

Sommige tools - **Verborgen data verwijderen**, **PDF comprimeren** en andere met het
**"Draait op je apparaat"**-label - werken op een bestand dat jij aanlevert. Het bestand wordt
in je browser in het geheugen ingelezen, lokaal getransformeerd en teruggegeven als download.
Het wordt nooit geüpload, omdat er geen server in het pad is om het naar te uploaden.
Deze hulpprogramma's werken offline en hun uitvoer bevat geen watermerk of metadata van
ons - het doel van de meeste ervan is juist om data te verwijderen & te beschermen, niet om risico toe te voegen.

![Het label dat deze tools dragen: Draait op je apparaat - er wordt niets geüpload](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Wanneer de app met een netwerk praat, volledig

De onderstaande tabel is de volledige lijst van alles wat de app ophaalt of verzendt over een
netwerk. Staat het hier niet, dan doet de app het niet.

| Wat | Wat er daadwerkelijk je apparaat verlaat | Wanneer (de actie die het activeert) | Als een operator het blokkeert |
|---|---|---|---|
| Toolcatalogus-synchronisatie | Niets persoonlijks - een verzoek om Lolly's eigen publieke tool- en asset-index, naar de eigen origin van de app | Bij het opstarten, daarna offline gecachet | De app draait op zijn gecachete toolset. Het enige wat stopt, is het ontdekken van nieuwe tools |
| Een tool die live data nodig heeft | Wat die specifieke tool ook opvraagt, naar de host die in zijn eigen beschrijving wordt genoemd. Vandaag de dag is dat alleen de plaatsopzoeking in de Meeting Planner-tool, die `geocoding-api.open-meteo.com` vraagt om een plaatsnaam om te zetten in coördinaten en een tijdzone - geen account, geen sleutel en geen identifier buiten het verzoek zelf. Het invoerveld vermeldt dit precies waar je typt, en elk antwoord wordt op je apparaat opgeslagen zodat een plaats maar één keer wordt opgezocht | Alleen tijdens het gebruik van die tool, en alleen zodra je een locatie invoert | Die ene opzoeking mislukt. Je kunt nog steeds coördinaten met de hand invoeren, en verder wordt niets beïnvloed |
| Google Fonts | De gekozen fontfamilienaam en je IP-adres, naar Google's fontservers (`fonts.googleapis.com` voor het stylesheet, `fonts.gstatic.com` voor het fontbestand) | Alleen als je een Google Font toevoegt in de merk-editor, **en alleen nadat je hiermee instemt in een dialoogvenster dat precies dit zegt** - een eenmalige download per familie, die daarna op je apparaat blijft staan en offline wordt gebruikt | De Google Fonts-kiezer faalt gesloten. Upload in plaats daarvan een fontbestand |
| Versturen naar Google Drive | Het ene bestand dat je koos om te versturen, naar Google's Drive API (`www.googleapis.com`), na een Google-aanmelding die je voltooit in Google's eigen pop-upvenster. Lolly's toegang is beperkt tot bestanden die het zelf heeft aangemaakt (de `drive.file`-scope - het kan nooit de rest van je Drive lezen), en het aanmeldtoken wordt alleen in het geheugen bewaard voor de sessie, nooit opgeslagen | Alleen wanneer je op "Send to Google Drive" drukt bij een EMF-export, en alleen in builds waarin de operator een Google client-id heeft ingesteld - zonder dat bestaat de knop niet | De knop verschijnt nooit. Download het bestand en upload het zelf naar Drive |
| Versturen naar Dropbox | Het ene bestand dat je koos om te versturen, naar Dropbox's API (`api.dropboxapi.com` voor aanmelding en metadata, `content.dropboxapi.com` voor het bestand zelf), na een Dropbox-aanmelding die je voltooit in Dropbox's eigen venster. Lolly's toegang is beperkt tot de app-map (het kan alleen ooit `Apps/` en zijn eigen map daarin zien - nooit de rest van je Dropbox), de "Open"-link die je te zien krijgt is een kortlevende privélink (er wordt geen publieke share aangemaakt), en een refresh-token wordt alleen opgeslagen als je "stay connected" aanvinkt | Alleen wanneer je op "Send to Dropbox" drukt bij een bestand, en alleen in builds waarin de operator een Dropbox client-id heeft ingesteld - zonder dat bestaat de knop niet | De knop verschijnt nooit. Download het bestand en upload het zelf naar Dropbox |
| Versturen naar OneDrive | Het ene bestand dat je koos om te versturen, naar Microsoft's identiteits- en Graph-services (`login.microsoftonline.com` voor aanmelding, `graph.microsoft.com` voor de upload; een groot bestand wordt in delen geüpload naar een door Microsoft beheerd uploadadres op `api.onedrive.com`, `*.up.1drv.com` of `*.sharepoint.com`), na een Microsoft-aanmelding die je voltooit in Microsoft's eigen venster. Lolly's toegang is beperkt tot zijn eigen map onder `Apps/` (het kan nooit de rest van je OneDrive lezen) plus je weergavenaam voor het accountlabel, en een refresh-token wordt alleen opgeslagen als je "stay connected" aanvinkt | Alleen wanneer je op "Send to OneDrive" drukt bij een bestand, en alleen in builds waarin de operator een Microsoft client-id heeft ingesteld - zonder dat bestaat de knop niet | De knop verschijnt nooit. Download het bestand en upload het zelf naar OneDrive |
| Versturen naar LinkedIn | Het ene bestand dat je koos om te versturen, plus de naam ervan als tekst van de post, naar LinkedIn (`www.linkedin.com` voor de aanmelding, `api.linkedin.com` voor de upload en de post), na een LinkedIn-aanmelding die je voltooit in je eigen browser. De post gaat naar je eigen feed als een publieke post onder je naam. Lolly kan namens jou posten en je naam lezen voor het accountlabel, verder niets op je LinkedIn, en de aanmelding wordt alleen op dit apparaat bewaard als je "stay connected" aanvinkt - LinkedIn's tokens gaan 60 dagen mee en kunnen niet stilzwijgend worden vernieuwd, dus vervallen ze vanzelf | Alleen wanneer je op "Send to LinkedIn" drukt bij een bestand, uitsluitend in de desktop-apps, en alleen in builds waarin een LinkedIn-app is ingesteld - zonder dat bestaat de knop niet | Niets te blokkeren in de webapp: dit bestaat **uitsluitend in de desktop-apps**, dus die twee hosts staan bewust NIET in het Content-Security-Policy van de webapp hieronder. Verwijder in de desktop-apps de ingestelde LinkedIn-app en de knop verschijnt nooit meer |
| ICC-drukprofielen | Niets persoonlijks - een verzoek om een standaard drukconditieprofiel, naar het publieke register van het ICC (`registry.color.org`, `www.color.org`) | Alleen als je een ICC-voorinstelling aanklikt in de printprofielbeheerder - een eenmalige download per profiel, die daarna op je apparaat blijft staan | ICC-voorinstellingen falen. Lever in plaats daarvan je eigen `.icc`-profiel aan |
| Internetradio | Niets persoonlijks - een playlistverzoek en een audiostream, naar het station (`api.somafm.com` en de icecast-server die het noemt, `*.somafm.com`) | Alleen tijdens het afspelen van de optionele ingebouwde radio in de geluidsspeler | De radio faalt. Elke andere geluidsfunctie blijft werken |
| Een URL die je een tool laat vastleggen | Een verzoek naar het exacte webadres dat je typt, vanuit de URL-screenshottool. Wat dat adres ook is. Deze host staat niet in het beleid hieronder, omdat je hem kiest op het moment van gebruik | Alleen wanneer je een URL invoert in die tool en de vastlegging start | Een operator kan dit niet per host op een allowlist zetten. Om het te verwijderen, verwijder je de tool |
| SEAL-handtekeningcontrole | **Niets.** De webapp heeft helemaal geen DNS-resolver - zie hieronder | Nooit | Niets te blokkeren |
| AI-modellen op het apparaat | Niets persoonlijks - een eenmalige download van een modelbestand van Lolly's modelhost (`lolli.li`), daarna gecachet op je apparaat; geen account, geen identifier, alleen het verzoek en je IP | Alleen wanneer je een functie gebruikt die een model nodig heeft (Verify deep scan, beeld-upscaling, spraak en dergelijke) | Die functie wacht op de download; al het andere blijft werken |
| Externe instantie | Wat de instantie die je opgeeft ook teruggeeft, via dezelfde catalogus-synchronisatie als hierboven beschreven - plus een versietag bij verzoeken daaraan (het type shell en de engineversie, dezelfde informatie die een user agent meedraagt), zodat de operator ervan kan zien welke Lolly-versies er in het veld zijn. Bij een beheerde instantie draagt die tag, zolang je bent aangemeld, ook een per-apparaat installatie-id mee zodat de apparaatlijst van de operator deze installatie kan onderscheiden. Dit lift alleen mee op verzoeken die je eigen gebruik toch al doet - er is geen timer en niets belt naar huis - en het verlaten van de instantie verwijdert de id, zodat een apparaat dat later opnieuw verbinding maakt een nieuwe presenteert. Je kiest de host op het moment van gebruik, dus die staat niet in het beleid hieronder | Alleen als je de shell expliciet naar een andere Lolly-implementatie wijst | Instantiewisseling faalt. Je lokale instantie wordt niet beïnvloed |

Elke vaste host in die tabel is ook de volledige allowlist in het Content-Security-Policy van de app, dat door de browser wordt afgedwongen. De lijst is dus niet alleen een beschrijving van wat de code vandaag doet, het is de grens waar de browser de app aan houdt: een toekomstige wijziging die zou proberen een andere host te benaderen, zou worden geblokkeerd, niet stilzwijgend toegestaan. Eén rij is de bewuste uitzondering, en de cel zelf zegt dit: Send to LinkedIn bestaat uitsluitend in de desktop-apps, dus het beleid van de webapp noemt geen van beide hosts - de webapp zou ze niet kunnen bereiken, zelfs als de code het zou proberen. Nog twee rijen hebben geen vaste host, omdat je het adres kiest op het moment van gebruik: een URL die je een tool laat vastleggen, en een externe instantie waar je de shell naartoe wijst. Geen van beide staat in het beleid, en elk gebeurt alleen wanneer je een adres typt en er actie op onderneemt. Een implementatie die geen van de optionele onderdelen wil (bijvoorbeeld een enterprise-instantie met eigen fonts) verwijdert die hosts uit het beleid en de functies falen gesloten in plaats van naar buiten te reiken.

Geen van deze sturen je documenten, projecten, sessies of geüploade bestanden ergens naartoe.
Ze bestaan om dingen *naar* je apparaat te brengen (tools, lettertypen, modellen), nooit om dingen
*vanaf* je apparaat te sturen, met de uitzonderingen die expliciet worden genoemd in de secties hieronder.

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

> **Live op lolly.tools.** Elke
> `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`-URL rendert echt, en de
> invoer reist mee in die URL. De sectie hieronder beschrijft wat dat voor jou
> betekent, en een operator kan de functie op zijn eigen instantie uitschakelen.

De app zelf blijft volledig op je apparaat. Los daarvan kan een operator **hot-link render-
URL's** inschakelen - `/tool/<tool-id>.<ext>?<inputs>` - zodat een gedeelde Lolly-
link kan verschijnen als levende afbeelding in een README, een wiki of een dashboard. Zo'n URL ophalen
vraagt de server om **publieke tool- en catalogusdata** te renderen met de invoer
die in de URL staat geschreven.

- <!--i:usercheck--> **Geen accounts, geen cookies, geen status.** Het eindpunt is anoniem, en er wordt
  niets op je apparaat gelezen. Je documenten, sessies en uploads verlaten nooit je
  browser - ze kunnen helemaal niet in deze links voorkomen.
- <!--i:document--> **Maar de URL zelf wordt vastgelegd.** De query-string van een URL maakt deel uit van de
  requestregel, dus die verschijnt in de gewone toegangslogs van het hostingplatform, op
  dezelfde manier als elk opgevraagd pad. Als de invoer van een link iemands naam of e-mail
  bevat - een naamplaatje, een e-mailhandtekening - **staat die tekst in die logs**, en
  geen enkele beleidstekst verandert daar iets aan. Een hot-link-URL is dus de verkeerde plek
  voor persoonlijke gegevens: geef er alleen in wat je ook op een publieke pagina zou zetten.
- <!--i:globe--> **De invoer is sowieso openbaar door constructie** - het is wat de auteur van de
  link ook in de URL heeft getypt, leesbaar voor iedereen die de link bereikt. Zet geen
  geheimen in een gedeelde link. Lolly biedt linkversleuteling voor gevoelige content.
- <!--i:eyeoff--> Antwoorden worden **gecachet en rate-limited** zoals elke publieke afbeelding, en gemarkeerd
  als `noindex` zodat zoekmachines je renders niet indexeren.

Self-hostend Lolly en wil je geen publiek render-oppervlak? Stel
`LOLLY_DISABLE_RENDER_GET=1` in en
al deze URL's geven 404 terug.

## De MCP-server (optioneel, voor AI-agents)

Lolly kan ook bereikt worden door een AI-agent via het Model Context Protocol - een
door een operator gehost endpoint (lolly.tools draait er een; iedereen kan er zelf een self-hosten,
ook volledig air-gapped). Het deelt de no-accounts-houding van het renderpad,
plus drie tools die noodzakelijkerwijs bestandsbytes verwerken:

- <!--i:cpu--> **`lolly_transform`** (een on-device hulpprogramma server-side uitvoeren, namens de
  aanroepende agent), **`lolly_verify`** (Content Credentials controleren) en **`lolly_redact`**
  (gebieden van een afbeelding of PDF onleesbaar maken) accepteren allemaal
  de bytes van een bestand van de aanroeper. Ze worden **in-process, in het geheugen** verwerkt,
  en het resultaat wordt teruggegeven binnen diezelfde aanroep - het bestand wordt nooit naar
  schijf geschreven en nooit bewaard zodra het verzoek voltooid is.
- <!--i:checklist--> Elke andere tool - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - werkt alleen op basis van parameters (tekst, cijfers, kleuren,
  URL's, catalogus-asset-id's), dezelfde invoer die een hot-link render-URL gebruikt.
- <!--i:lock--> Toegang is óf een gedeeld token dat de operator uitgeeft aan clients die hij vertrouwt, óf
  stateless OAuth 2.1: kortlevende ondertekende tokens die geverifieerd worden tegen een gedeeld
  geheim, niets wordt server-side opgeslagen en het token zelf wordt nooit weggeschreven naar een
  logboek of een render-URL.

## Content Credentials-identiteit (een aanmelding die je zelf moet starten)

Lolly kan een cryptografische **Content Credential** in je exports verzegelen, zodat iedereen offline kan verifiëren dat een bestand ongewijzigd is sinds het Lolly verliet. Dat deel staat **standaard aan en is volledig lokaal** - de ondertekeningssleutel wordt op je apparaat gegenereerd en het ondertekenen zelf gebeurt offline. Zonder inschrijving is die sleutel een wegwerpsleutel: voor elke export wordt een nieuw sleutelpaar aangemaakt, dat samen met de export wordt weggegooid. Zodra je je inschrijft, wordt de sleutel blijvend en wordt hij **niet-extraheerbaar** gegenereerd - zelfs Lolly's eigen code kan hem niet lezen, alleen vragen om te ondertekenen. In beide gevallen verlaat hij nooit je apparaat. Dit onderdeel behandelt de ene *optionele* stap daarbovenop: het inschrijven van een geverifieerde identiteit, zodat je exports "Geverifieerd - ondertekend door \<your email\>" tonen in plaats van een anonieme sleutel. **Als je de inschrijving overslaat, is niets in dit onderdeel op jou van toepassing en verlaten er nooit persoonlijke gegevens je apparaat.**

![De kaart Geverifieerde identiteit op de profielpagina, ter breedte van een telefoon: de keuzelijst voor certificaatlevensduur en de inschrijvingsstap eronder, inactief tot je hem zelf start](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Als je je wel inschrijft, gebeurt precies dit:

1. **Je kiest een aanmeldmethode** - GitHub, Google, SUSE (id.suse.com) of een
   e-maillink. Voor de drie OIDC-providers word je doorgestuurd naar de eigen
   inlogpagina van die provider, onderworpen aan hun privacybeleid, niet het onze.
   Lolly's certificaatdienst ontvangt alleen een geverifieerd e-mailadres terug en
   de naam van de provider. Voor de e-maillink wordt het adres dat je invoert doorgegeven aan
   **Resend**, een transactionele e-mail-API, uitsluitend om die ene link te bezorgen.
2. **Een kortlevend cookie beschermt de omleiding.** Dit is het enige cookie dat het
   hele Lolly-systeem instelt: `lolly_ca_state`, `HttpOnly`, gebonden aan `/api/ca`,
   verlopend binnen tien minuten. Het bevat een willekeurige waarde, geen tracking-
   identifier, en bestaat alleen om te voorkomen dat de OAuth-omleiding wordt vervalst. Het wordt
   gewist zodra het aanmelden voltooid is.
3. **Je IP-adres wordt kort gebruikt om misbruik** van de aanmeld-
   endpoints te voorkomen (zodat één script geen inbox kan spammen of het e-mailquotum kan uitputten) - alleen
   in het servergeheugen bewaard, voor een schuivend venster van ongeveer een minuut, nooit weggeschreven
   naar een logboek en nergens opgeslagen.
4. **De certificaatdienst geeft een kortlevend certificaat uit** (7, 30, 90 of 365
   dagen, jouw keuze, begrensd door het beleid van de operator) dat je geverifieerde
   e-mailadres koppelt aan de publieke helft van het sleutelpaar dat op je apparaat is gegenereerd. De private
   helft verlaat nooit je browser.
5. **Er wordt niets over de uitgifte vastgelegd.** De certificaatdienst houdt geen uitgifte-
   log bij: niet je e-mailadres, niet de provider, niet een serienummer, niet een
   tijdstempel. Geen database, geen logregel, geen webhook. Je e-mailadres bestaat in
   het verzoek alleen lang genoeg om te worden opgenomen in het certificaat dat je eigen
   apparaat ontvangt, en daarna is het aan onze kant volledig verdwenen.
6. **Daarna is ondertekenen weer offline** voor de hele levensduur van het certificaat.
   Een bestand exporteren neemt nooit contact op met de certificaatdienst - alleen het inschrijven deed dat.

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

Zoals elke website genereren de servers achter lolly.tools - en achter elke Lolly-
deployment - standaard webserver-toegangslogs zodra er überhaupt een verzoek bij
hen binnenkomt: IP-adres, opgevraagd pad, tijdstempel, user agent. Dat is standaard
hostinggedrag, geen toevoeging van Lolly, en het bevat nooit de
inhoud van je documenten, omdat die nooit een server bereiken. De
ene bewuste uitzondering is een bestand dat je expliciet aan een MCP-
aanroep `lolly_transform`, `lolly_verify` of `lolly_redact` geeft, dat in het geheugen wordt verwerkt en nooit
naar schijf of een log wordt geschreven, zoals hierboven beschreven.

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

| Verwerking | Rechtsgrond (AVG art. 6) | Bewaard voor |
|---|---|---|
| Alles op je apparaat (documenten, voorkeuren, cache, tellers) | **Helemaal geen verwerking door ons** - het bereikt ons nooit. Opslag op je apparaat is strikt noodzakelijk voor de dienst die je hebt aangevraagd (ePrivacy art. 5(3)), dus is geen toestemming vereist | Tot je het verwijdert |
| Je e-mailadres tijdens Content Credentials-inschrijving | **Art. 6(1)(b)**, uitvoering van een dienst die je expliciet hebt aangevraagd | Niet bewaard. Alleen aanwezig in het geheugen voor de duur van het verzoek |
| Je IP-adres op de aanmeldeindpoints, voor rate limiting | **Art. 6(1)(f)**, ons gerechtvaardigd belang om misbruik van een gratis dienst en van het e-mailquotum van een derde te voorkomen. Wij vinden dat dit een belangenafweging doorstaat omdat het alleen in het geheugen staat, nooit wordt opgeslagen en binnen ongeveer een minuut wordt weggegooid | ~1 minuut, in servergeheugen, nooit persistent |
| Hosting-toegangslogs (IP, pad, tijdstempel, user agent) | **Art. 6(1)(f)**, ons gerechtvaardigd belang bij dienstbeveiliging, misbruikpreventie en het diagnosticeren van storingen | Vercel's platformstandaard voor ons abonnement. We voegen geen drain of export toe |

**Ontvangers.** De categorieën ontvangers zijn: onze hostingprovider (Vercel
Inc.), en - alleen als je de aanmeldoptie via e-mail gebruikt - een transactionele e-mail-
provider (Resend). Als je inlogt met GitHub, Google of SUSE (id.suse.com), heb je
rechtstreeks contact met die provider onder hun eigen privacybeleid. Zij geven ons
een geverifieerd e-mailadres en verder niets. We delen persoonsgegevens met niemand
anders, en we verkopen geen gegevens, tonen geen advertenties en profileren geen gebruikers.

**Doorgiften buiten de EER.** Vercel en Resend zijn Amerikaanse bedrijven. Functie-
compute voor lolly.tools is vastgezet in Vercel's regio Frankfurt (`fra1`), dus
verwerking vindt plaats in de EU, maar als in de VS gevestigde providers hebben zij
mogelijk nog steeds toegang tot gegevens als verwerkers vanuit de VS. Die doorgiften steunen op de
Standaardcontractbepalingen van de Europese Commissie en/of het EU-VS Data Privacy
Framework, zoals vastgelegd in de verwerkersovereenkomst van elke provider. Omdat de
persoonsgegevens die een van beide providers bereiken zo beperkt zijn - een e-mailadres dat
wordt doorgegeven om één bericht te versturen, en gewone toegangslogs - is de blootstelling
dienovereenkomstig klein.

**Geautomatiseerde besluitvorming.** Geen. Er is geen profilering en geen geautomatiseerd
besluit dat rechtsgevolgen of vergelijkbaar significante gevolgen heeft (art. 22).

## Privacy van kinderen

Lolly verzamelt niet bewust persoonlijke informatie van wie dan ook, van welke leeftijd dan ook, in
het normale gebruik van de app - er is niets te verzamelen. De enige plaats waar
persoonlijke informatie (een e-mailadres) ooit wordt verzameld is Content Credentials-
inschrijving, hierboven beschreven, die niet gericht is op of bedoeld is voor kinderen.

## Jouw rechten

Omdat bijna alles wat Lolly aanraakt alleen op je eigen apparaat wordt opgeslagen, zijn de meeste
zaken die het gegevensbeschermingsrecht "jouw rechten" noemt - inzage, correctie, verwijdering,
overdraagbaarheid - dingen die je al zelf kunt doen, direct, zonder iemand te hoeven vragen: je gegevens staan
in de opslag van je browser, in een vorm die je kunt inspecteren,
exporteren (**Export my data & render everything**, hierboven) of verwijderen (**Profile → Clear all
my data**).

Formeel heb je onder AVG-artikelen 15-22 het recht op **inzage** in je
persoonsgegevens, om ze te laten **rectificeren**, te laten **wissen**, de verwerking ervan te laten **beperken** of
ertegen **bezwaar te maken** (inclusief bezwaar tegen alles wat we baseren op gerechtvaardigde
belangen), op **gegevensoverdraagbaarheid** en - waar de verwerking op toestemming berust - om
**die toestemming op elk moment in te trekken**, zonder gevolgen voor de rechtmatigheid van wat er
gebeurde voordat je die introk.

Hier is het eerlijke standpunt over het uitoefenen ervan tegenover ons. Omdat we geen
uitgiftelog meer bijhouden, **hebben we geen persoonsgegevens over jou die we kunnen opzoeken,
corrigeren, exporteren of verwijderen.** Als je ons schrijft en vraagt wat we over je hebben, is het
eerlijke antwoord niets, en dat zullen we ook zeggen. De enige categorie die überhaupt bestaat is
hosting-toegangslogs gekoppeld aan een IP-adres, bewaard door onze hostingprovider onder hun
standaard bewaartermijnen. We hebben geen mogelijkheid om die te doorzoeken of selectief te
verwijderen, en dat zullen we je zeggen in plaats van iets anders voor te wenden. Alles wat werkelijk
*van jou* is, staat op je apparaat, waar je het al kunt lezen, exporteren
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
