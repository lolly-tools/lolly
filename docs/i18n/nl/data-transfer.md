# Gegevensoverdracht - de bundel `lolly-backup`

Alles wat een Lolly-gebruiker opbouwt, staat **op zijn apparaat** - geen account, geen cloud. De gegevensoverdrachtbundel is hoe die waarde verplaatst: exporteer hem op de ene installatie, draag het bestand op elke manier over (USB, AirDrop, e-mail naar jezelf, een netwerkschijf) en importeer hem op een andere. Het bestand *is* het transport. Het doel kan offline of online zijn. Het maakt geen verschil, want er wordt nooit met een server gepraat.

![De twee knoppen die een hele installatie verplaatsen: Mijn gegevens exporteren schrijft één zip, Gegevens importeren leest hem weer in](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=%23storage-section%20.storage-subsection&dark=1&filename=pd-transfer-controls)

Deze pagina is de formaatspecificatie. Voor de doorloop voor de eindgebruiker, zie [Vind en herstel je werk → Verhuis je werk naar een ander apparaat](/info/find-your-work.html#move-your-work-to-another-device). De implementatie is [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), en [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) legt het retourcontract vast.

> **Bereik.** Een bundel draagt *gebruikersgegevens*, geen catalogustools. Catalogustools en catalogusassets worden apart gesynchroniseerd en er wordt aangenomen dat ze al op het doel aanwezig zijn (in het slechtste geval in een hogere versie); tools die een gebruiker zelf maakte, reizen mee binnen `profile.json`. Importeren installeert of upgradet nooit een catalogustool.

## Doelen

- <!--i:box--> **Eén formaat, elke shell.** De web-PWA, Tauri-desktop/mobiele apps en toekomstige shells delen dezelfde envelop en ondersteunde onderdeelschema's. Optionele onderdelen hangen af van de mogelijkheden van elke shell; niet-ondersteunde onderdelen worden gemeld. Elke capability bridge levert zijn eigen opslagadapter.
- <!--i:shieldcheck--> **Overleeft de reis.** Een bundel die onderweg beschadigd of afgekapt raakt, faalt luid bij import, herstelt nooit half.
- <!--i:clock--> **Overleeft deze versie.** Een oudere app kan nog steeds de herkende onderdelen van een nieuwere bundel importeren. Een echt incompatibel formaat wordt netjes geweigerd.
- <!--i:check--> **Veilig om te mergen.** Importeren op een installatie die al in gebruik is, wist nooit iets dat niet in de bundel zat.

## De envelop

Een bundel is een gewone `.zip`. De download wordt genoemd naar de persoon aan wie hij toebehoort - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (bijvoorbeeld `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - zodat een Downloads-map vol back-ups leesbaar blijft. De voor- en achternaamdelen komen uit het profiel en worden weggelaten wanneer ze niet zijn ingesteld. Geen profiel geeft `LollyTools-2026-06-26-1.zip`, en alleen een voornaam geeft `LollyTools-Ada-2026-06-26-1.zip`. Elk deel wordt gesaneerd tot een bestandsnaamveilig token (Unicode-letters/cijfers blijven behouden, spaties/leestekens worden verwijderd, gelimiteerd tot 32 tekens). `<n>` is een volgnummer per dag, per apparaat, zodat herhaalde exports op dezelfde dag niet botsen en in volgorde blijven. `backupFilename()` in [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) bouwt de naam. De inhoud van de zip is identiek, ongeacht de naam. Binnenin:

| Pad | Verplicht | Inhoud |
|---|---|---|
| `manifest.json` | ja | Format-id, versies, aantallen en integriteit per onderdeel. Het eerste waar een lezer naar kijkt. |
| `profile.json` | indien ingesteld | Het hele `me`-record van de gebruiker: naam, contactgegevens, profielfotoreferentie en vlaggen, plus mappen, Prullenbak, projectblauwdrukken, gebruikerssjablonen en door de gebruiker gemaakte tools, favorieten, verborgen tools, taal- en emojikeuze. Gelezen via `host.profile`. |
| `sessions.json` | ja | Elke opgeslagen sessie: slot, tool-id/versie, label, miniatuur (data-URL) en alle invoergegevens. Gelezen via `host.state`. |
| `assets.json` | ja | Metadata voor elk geüpload asset (afbeeldingen, lettertypen, merktokens, logo's, opgeslagen kopieën van downloads), elk wijzend naar zijn bytes onder `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per asset | De ruwe assetbytes (afbeeldings- en lettertypebestanden). Onbewerkt (ongecomprimeerd) opgeslagen (al-gecomprimeerde formaten). De extensie is cosmetisch. De MIME in `assets.json` is leidend. |
| `assets/blobs/<n>.c2pa` | indien aanwezig | Geëxtraheerde Content Credentials als exacte binaire bytes, waarnaar wordt verwezen via `_credentialFile` in het assetrecord. Dit zijn geen ondertekeningssleutels van het apparaat. |
| `design-systems.json` | indien aanwezig | De design systems die op deze installatie zijn gemaakt of toegevoegd, als `{ active, records }`. Gemerged op id bij import; de actieve keuze van de bundel geldt alleen wanneer het doel geen eigen design system heeft. |
| `file-history.json` | optioneel | Versiegebonden assetsnapshots, terminale bestandsoperatierapporten en complete batchmanifesten. Het geschiedenisonderdeel heeft een eigen versie; geleverd door de interne back-upadapter `fileHistory` van de shell. |
| `revision-history.json` | optioneel, handmatige back-ups | Stabiele creatie-ID's, bewaarde checkpoints, miniaturen en doorlopende herstelconcepten. Geleverd door `host.state.history.backup` waar ondersteund. |
| `file-history/versions/` | per snapshot | Eerdere assetbytes en geëxtraheerde credentials, ongeacht of het huidige asset nog bestaat. |
| `file-history/results/` | per voltooide bewerking | Exacte uitvoerbytes. Geen origineel, voor conversie geselecteerd bestand wordt bewaard of meegenomen. |
| `prefs.json` | ja | Lokale voorkeuren van de gebruiker zelf: `theme`, `sidebarWidth` en de activiteitsteller `ct-metrics`. |
| `lolly.txt` | ja | Een leesbare samenvatting van de bundel (aantallen, profiel, bestandsnaam) voor wie de zip zonder Lolly opent. Opnieuw gegenereerd bij elke export en herkend bij import, dus telt nooit als een overgeslagen onderdeel. Hij wordt *na* de integriteitskaart geschreven, dus blijft erbuiten. |

De bundel is bewust een gewone zip: hij overleeft elk transport intact, en elke unzip-tool kan hem inspecteren.

`profile.json` is het kleinste onderdeel en het onderdeel dat een lezer in de app als eerste ziet: de gegevens die een producent één keer invult, plus de opt-in die tools toestaat ze te gebruiken.

![Het formulier met profielgegevens dat profile.json wordt: naam, contactgegevens en profielfoto](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=1100&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Veld | Betekenis |
|---|---|
| `format` | Altijd `lolly-backup`. Een bestand zonder dit wordt afgewezen als "geen Lolly-back-up". |
| `formatVersion` | De lay-out waarmee deze bundel is **geschreven**. Verhoogd bij elke wijziging in de onderdelenset of vormen. Lezers gebruiken dit **niet** als grendel. |
| `minReader` | De minimale lezerversie die nodig is om deze bundel **veilig** te importeren. Dit is het veld waarop lezers grendelen. |
| `app` | Producerende app-id, voor diagnostiek. |
| `exportedAt` | ISO-tijdstempel waarop de bundel is aangemaakt. |
| `counts` | Wat de schrijver erin heeft gestopt, voor weergave en sanity-check. |
| `integrity` | Optioneel. Koppelt elk onderdeel behalve `manifest.json` aan een SRI-achtige `sha256-<base64>`-digest van de **ongecomprimeerde** bytes. |

## Versiebeleid (achterwaartse compatibiliteit)

De scheiding tussen `formatVersion` en `minReader` is wat het formaat laat groeien zonder oudere installaties te wezen:

- Een lezer importeert een bundel wanneer `manifest.minReader ≤` de eigen lezerversie is. Hij weigert (met "vereist een nieuwere versie van de app") alleen wanneer de bundel expliciet een nieuwere lezer eist.
- Een **additieve** wijziging - een nieuw *optioneel* onderdeel, of een nieuw optioneel manifestveld - verhoogt `formatVersion` maar laat `minReader` ongewijzigd. Oudere apps importeren nog steeds elk onderdeel dat ze herkennen. Onderdelen die ze niet herkennen worden overgeslagen (zie hieronder), niet stilzwijgend verwijderd.
- Een **breekende** wijziging - een waarbij een verkeerde import van een onderdeel gegevens beschadigt, of waarbij een voorheen optioneel onderdeel verplicht wordt - verhoogt `minReader`. Oudere apps weigeren dan netjes in plaats van iets te importeren dat ze niet aankunnen.
- Als een toekomstige bundel `formatVersion` instelt maar `minReader` weglaat, vallen lezers voorzichtig terug op grendelen op `formatVersion` (behandel de wijziging als breekend).

> **Vuistregel voor auteurs:** als elke bestaande lezer nog steeds het juiste zou doen door je toevoeging te negeren, is het additief - verhoog `formatVersion`, laat `minReader` staan. Verhoog anders `minReader`.

## Integriteit

Wanneer `manifest.integrity` aanwezig is, verifieert een lezer de SHA-256 van elk vermeld onderdeel **voordat er iets wordt geschreven**. Een mismatch ("heeft de integriteitscontrole niet doorstaan") of een ontbrekend onderdeel ("onvolledig") breekt de hele import af - er is geen gedeeltelijk herstel. Dit vangt de corruptie op die een bestandstransport kan veroorzaken (een afgekapte AirDrop, een e-mailgateway die de bijlage opnieuw heeft gecodeerd, een slechte USB-sector).

Integriteit is bewust best-effort: hij wordt alleen geschreven waar Web Crypto beschikbaar is (elke veilige browsercontext en moderne Node), en alleen geverifieerd wanneer zowel de kaart als Web Crypto aanwezig zijn. Een bundel zonder de kaart - bijvoorbeeld een van vóór het bestaan van integriteit - importeert ongewijzigd. "Kan niet verifiëren" wordt nooit behandeld als "corrupt".

Het manifest vermeldt zichzelf niet en ook niet de opnieuw gegenereerde `lolly.txt`-README. De digests dekken de onderdelen waarvoor het manifest instaat.

## Importsemantiek

Importeren is een **samenvoeging**, nooit alles vervangen:

- Bestaande gegevens op het doel blijven staan.
- Wanneer een sessieslot of een geüpload-afbeeldings-id op beide voorkomt, wordt de meest recent opgeslagen kopie bewaard, zodat een oudere back-up nooit nieuwer werk op het doel overschrijft. Gelijke of onbekende tijden houden de kopie van het doel aan. Op een web-installatie met creatiegeschiedenis beslist dezelfde regel welke kopie van een creatie de huidige blijft, en de andere kopie wordt bewaard als een beschermd concept (zie hieronder).
- Het profielrecord wordt samengevoegd, niet vervangen. Elke map op het doel blijft met zijn inhoud; een map uit de bundel die het doel mist wordt toegevoegd, en een map die op beide voorkomt behoudt de naam en ouder van het doel en krijgt de leden van de bundel die het mist erbij. Een sessie die in een map op het doel is opgeslagen, blijft daar opgeslagen.
- Favorieten (tools, catalogusassets en Projecten-items) worden samengevoegd. Sjablonen, Projecten-sjablonen en gebruikerstools uit de bundel worden toegevoegd wanneer het doel geen record met dat id heeft. Prullenbak-items van beide worden bewaard, zodat een item dat op een van beide installaties kon worden hersteld dat nog steeds kan.
- Elk ander profielveld (naam, contactgegevens, taal, feature flags, verborgen tools en de overige instellingen) behoudt de waarde van het doel. Een veld dat leeg is op het doel neemt de waarde van de bundel over. Hetzelfde geldt voor `prefs.json`: een voorkeur wordt alleen geschreven waar het doel er geen heeft.
- De gewone toepassing van apparaatsynchronisatie is de uitzondering: om apparaten gelijk te houden, neemt hij het profielrecord, de voorkeuren, de sessies en de afbeeldingen van de gesynchroniseerde kopie over. Een eerdere kopie herstellen doet hetzelfde, omdat dat doelbewust teruggaat in de tijd. De eerste koppeling, **Naar dit apparaat brengen**, voegt samen als een import.
- Historische assetversies en bewerkings-ID's zijn onveranderlijke uitzonderingen: een herhaalde import is idempotent, en een ID die al andere bytes/geschiedenis noemt, wordt geweigerd, niet overschreven. Een identiek huidig asset opnieuw importeren behoudt zijn versie. Een gewijzigd huidig asset moet een andere versie dragen.
- Creatiegeschiedenis wordt ook samengevoegd. Een creatie die aan beide kanten bestaat, houdt de meest recent opgeslagen kopie als huidige aan en de andere kopie als een beschermd concept; een creatie waarvan het doel de slot voor een andere creatie gebruikt, wordt ernaast toegevoegd; een creatie in de Prullenbak van het doel blijft daar. Een checkpoint-ID dat andere inhoud op het doel noemt, behoudt die van het doel. Een archief dat zijn eigen controles niet doorstaat, stopt de import vóór elke wijziging aan profiel, sessie, asset of voorkeur. Een identieke herhaalde import voegt geen opslag toe.
- Niets dat niet in de bundel zat, wordt aangeraakt. Een sessie die het doel had maar de bundel niet, overleeft de import.

Opgeslagen sessies koppelen automatisch opnieuw aan hun afbeeldingen: assetreferenties worden bijgehouden op id, en de bridge lost ze opnieuw op nadat de geüploade afbeeldingen zijn hersteld (dat moet toch al, omdat `blob:`-URL's een herlaad niet overleven).

De importsamenvatting rapporteert `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` telt geüploade assets die niet konden worden hersteld (bijvoorbeeld apparaatopslag vol). Dit staat los van `skipped`, dat onderdelen telt van een achterwaarts-compatibele nieuwere schrijver die deze build niet herkende. De UI toont `skipped` ("… · N nieuwere items overgeslagen"), zodat het herstel eerlijk is over wat er is achtergelaten.

Wanneer bestandsgeschiedenis aanwezig is, draagt de samenvatting ook `assetVersions`, `fileOperations` en `failedHistory`. Opslag-uitputting of conflicten met onveranderlijke ID's kunnen een gedeeltelijk herstel veroorzaken; de UI vertelt de gebruiker de bron-back-up te bewaren. Cloudsynchronisatie zet zijn toegepaste revisie **niet** verder na een gedeeltelijk of niet-ondersteund herstel, zodat de snapshot beschikbaar blijft om opnieuw te proberen. Herstellen is geen enkele transactie over alle profiel-/sessie-/asset-/geschiedenisopslagen heen.

## Creatiegeschiedenis (v3)

Handmatige back-ups van een web-host met geschiedeniscapaciteit bevatten `revision-history.json` met zijn eigen schema `{ version: 1, documents, revisions, recoveries }`. Het draagt de bewaarde ID's, canonieke invoersnapshots, versiestempels, rasterpreviews en aparte schrijversconcepten. De geschiedenisadapter legt huidige sessies en hun koppen vast in één leestransactie; `sessions.json` gebruikt diezelfde huidige snapshots voor oudere lezers.

Herstel controleert de SHA-256 en bytetellingen van de payload, unieke identiteiten, document/head-relaties, afstamming, tijdstempels, previewtypen en limieten voordat het archief in één transactie wordt vastgelegd. Gecomprimeerde parent-referenties kunnen ontbreken. Bestaand huidig werk wordt nooit stilzwijgend vervangen: wanneer een creatie aan beide kanten bestaat, wordt de kant die niet als huidige wordt aangehouden een beschermd concept. De transferlimiet van 384 MiB van het archief wordt expliciet gecontroleerd, en opslaglimieten worden afgedwongen zonder bewaarde checkpoints af te knippen. De algehele back-up gebruikt nog steeds een in-memory ZIP-implementatie en is geen streamend archief.

De samenvatting voegt `revisions` en `recoveryDrafts` toe, waarbij alleen wordt geteld wat deze import heeft toegevoegd, en `added`, `kept`, `replaced`, `copies` en `hidden` voor hoe elke creatie is samengevoegd. Een shell zonder deze capaciteit herstelt gewone sessies en meldt het geschiedenisonderdeel als overgeslagen. Native bestandssysteemgeschiedenis blijft niet-ondersteund tot zijn adapter duurzame geschiedenistransacties levert. P2P-gaststatus heeft geen duurzame geschiedenis of herstelarchief.

Persoonlijke snapshotsynchronisatie sluit creatiegeschiedenis expliciet uit. Een snapshot toepassen op een lokaal document met geschiedenis bewaart zijn vorige werktoestand als een apart herstelconcept en maakt het schrijftoken van elke open editor ongeldig. Zijn onveranderlijke checkpoints blijven op het apparaat. Dit beschermt lokale geschiedenis tijdens snapshotvervanging; het merget geen gelijktijdige apparaatgeschiedenissen.

Historische assetverwijzingen worden bewaard, terwijl renderen assets nog steeds oplost via de bestaande bibliotheek van de bestemming. Dit archief garandeert nog geen exacte oude assetbytes of oude tool-renders. Assetversie- en bestandsresultaatbytes blijven reizen via hun eigen bestaande, aparte back-uponderdeel.

## Opgeslagen versies en bestandsresultaten (v2)

Het optionele geschiedenisonderdeel bevat `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; lezers accepteren ook de eerdere history-v1-vorm zonder batches. Elke snapshot identificeert het stabiele asset-ID en de exacte versie, zijn opslagtijd, bytelengte en hex-SHA-256, plus een assetrecord waarvan `_file` en optioneel `_credentialFile` naar binaire onderdelen wijzen. Bewerkingen dragen de oorspronkelijke bestandsfeiten, het verzoek, het rapport, tijdstempels en optioneel resultaat-`_file`; namen van opslagbackends, OPFS-handles en uitvoeringsleases reizen niet mee. Oudere, alleen-history-v1-lezers weigeren de nieuwe geschiedenisversie vóór import, in plaats van batchlidmaatschap stilzwijgend te laten vallen.

Batchmanifesten leggen elke geselecteerde bron vast vóór verwerking, inclusief nooit gelezen bestanden, geannuleerde leden, mislukte reserveringen van resultaatruimte en onderbroken werk. Elk lid heeft een stabiel bewerkings-ID, bronreferentie/-feiten, gevraagde uitvoernaam en terminaal rapport. Een ongelezen bron heeft verklaarde feiten, geen verzonnen digest. Import valideert lididentiteit en consistentie met elk meegedragen bewerkingsrapport. Batchrapporten blijven beschikbaar wanneer individuele resultaten expliciet zijn verwijderd, maar een ontvangstbewijs impliceert niet dat de uitvoerbytes nog worden opgeslagen.

- Elk bekend geschiedenisrecord, rapport en verwezen bestand wordt gevalideerd vóór elke profiel- of assetimportschrijving. Ontbrekende bytes en niet-overeenkomende SHA-256 falen zelfs als de envelop geen integriteitskaart heeft. Geëxtraheerde credentials blijven bytearrays, ook bij imports van oudere schrijvers die ze als JSON serialiseerden als objecten met numerieke sleutels.
- Lopende bewerkingen worden onderbroken records in de back-up, met een verklarend foutrapport en geen resultaat. Herstellen herstart nooit achtergrondwerk en importeert nooit een actieve lease. Opnieuw proberen vereist het selecteren van het originele bestand, gecontroleerd tegen zijn geregistreerde SHA-256 indien beschikbaar.
- Herstelde resultaten leggen hun bytes en metadata samen vast in IndexedDB. Gewone nieuwe resultaten gebruiken OPFS waar beschikbaar, met een IndexedDB-terugval. Een bestaande actieve bewerking wordt nooit vervangen door een import.
- De ZIP-samenstelling van geschiedenis is nog steeds in het geheugen: de huidige limiet is **256 MiB geschiedenispayload**, **4 MiB geschiedenismetadata**, hoogstens **100 bewerkingen**, **100 batches** en **2.000 snapshots**. Export weigert expliciet te grote of onvolledige geschiedenis; laat het nooit stilzwijgend weg. Download belangrijke versies/resultaten afzonderlijk voordat je oudere lokale kopieën verwijdert. Deze limieten zijn geen gemeten piekgeheugengarantie voor telefoons.
- Lokale resultaatgeschiedenis heeft een budget van 512 MiB en een maximum van 100 records. Assetsnapshots hebben een apart budget van 512 MiB en hoogstens 20 historische versies per asset; geëxtraheerde credentialbytes tellen mee voor dat snapshotbudget. Herstel respecteert deze limieten en verdringt nooit stilzwijgend bestaande gebruikersgegevens.
- Lokale batchmetadata heeft een apart budget van 4 MiB, hoogstens 100 manifesten en 20 leden per batch. Openstaande leden reserveren metadatacapaciteit, met een plafond van 32 KiB per rapport per lid. Dit is een logisch budget, geen garantie van browserschijfruimte; een echte quotafout wordt getoond en het in-memory-rapport blijft downloadbaar. Een batchlid opnieuw proberen maakt een nieuwe batch aan zonder het oude rapport te overschrijven. Een batchrecord verwijderen verwijdert geen individuele resultaatbytes of bibliotheekassets.
- Geconverteerde resultaten kunnen expliciet aan de bibliotheek worden toegevoegd zonder normalisatie of hercodering. Bron-/uitvoerhashes en de bewerkingsrelatie vergezellen het asset. Herhaalde toevoegingen hergebruiken een ongewijzigde kopie; een bewerkte kopie wordt nooit overschreven. Rasterafbeeldingen kunnen een nieuw Design-document starten. Dat document gebruikt het huidige bibliotheek-asset-ID: exacte versiefixaties afdwingen door de hele Design-runtime en het URL-pad heen is nog apart werk. SVG/HTML/PDF/ZIP-resultaten worden door deze overdracht bewaard als ondoorzichtige bestandsassets, niet gepromoveerd tot vertrouwde interactieve/vectorinhoud.
- **Convert → Recente bestandsoperaties** toont geschiedenisgebruik, rapporten, downloads en de versiebeheerder. De beheerder vindt ook eerdere versies van verwijderde bibliotheekassets. Een snapshot herstellen maakt een nieuwe huidige versie aan terwijl de geselecteerde snapshot intact blijft. **Instellingen → Opslag** boekt resultaten en versies apart van wegwerpbare caches.
- Expliciete opruiming van tijdelijke bestanden verwijdert alleen bytes die van een bewerking zijn en niet worden verwezen. Huidige records beschermen hun bestanden; recente OPFS-bestanden hebben een respijtperiode van een uur. Opgeslagen resultaten en assetsnapshots worden niet automatisch gewist.

Oudere lezers accepteren nog steeds de v2-envelop (`minReader: 1`) en herstellen bekende onderdelen, waarbij niet-ondersteunde geschiedenisonderdelen als overgeslagen worden geteld. Volledig geschiedenisherstel vereist een shell met de `fileHistory`-adapter; dit is een interne naad van de shell, geen nieuwe, tool-gerichte `HostV1`-capaciteit. Echt herstel tussen twee apparaten wordt gedekt door de lokale Chromium-poort; geïnstalleerde Tauri-/iOS-/Android-hersteltests blijven apart.

## Wat niet meereist

- **Catalogus-caches** (gedownloade assetmetadata en blobs, de toolindex) - gratis opnieuw gesynchroniseerd op het doel.
- **Catalogustools en catalogusassets** - buiten bereik, en verondersteld al aanwezig te zijn op het doel. Merktokens, lettertypen en logo's die de gebruiker toevoegde zijn gebruikersassets, dus die reizen wel mee.
- **`blob:`- / object-URL's** - opnieuw gegenereerd door de bridge bij het laden.
- **Conversieoriginelen, live uitvoeringsleases en machinelokale toegangs-/ondertekeningsgeheimen** - geen draagbare geschiedenispayload. Een opgeslagen resultaat is een kopie, geen belofte dat de originele bron is geback-upt.
- **De exportvolgnummerteller** - de teller per dag voor downloadnamen (`localStorage`-sleutel `lolly-export-seq`) is een lokaal naamgevingsgemak. Hij blijft buiten `PREF_KEYS`, dus reist nooit mee in een bundel.

De opslagmeter splitst hetzelfde uit. Opgeslagen sessies, My images en File results & versions reizen mee in een bundel. De asset-cache, toolpreviews en offline pins daaronder zijn allemaal opnieuw af te leiden, dus blijven achter.

![De opslagmeter die de gegevens van dit apparaat onderverdeelt in benoemde categorieën, met Opgeslagen sessies en Mijn afbeeldingen apart bijgehouden van de Assetcache, hier op een verse installatie waar elke categorie nog leeg is](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garantie over shells heen

`data-transfer.ts` leest en schrijft uitsluitend via de capability bridge (`host.profile`, `host.state`, `host.assets`) en de gedeelde `localStorage`-voorkeuren. Dezelfde module leest en schrijft de gemeenschappelijke envelop op web en Tauri, via IndexedDB- of bestandssysteemopslag. Optionele geschiedenisonderdelen verschijnen alleen waar de bijbehorende adapter beschikbaar is; een niet-ondersteund onderdeel wordt bij import als overgeslagen gemeld. De headless suite oefent de gemeenschappelijke onderdelen uit tegen een in-memory bridge, terwijl geschiedenistransacties ook echte browsertests hebben.

Twee shells vallen buiten die garantie, om verschillende redenen:

- De **eenmalige CLI** heeft niets om mee te dragen - zijn status is in-memory en kortstondig per aanroep.
- De **TUI** bewaart wel status (`~/.lolly`: sessies, mappen, profiel) en zijn Profielweergave kan er een back-up van maken, maar hij schrijft een eigen, *eenvoudiger* archief: `saved-state/<slot>.json` per sessie plus `profile.json` en `folders.json`, zonder manifest, zonder `formatVersion`/`minReader` en zonder integriteitskaart. Het is **niet** importeerbaar met dit formaat - een lezer wijst het af als "not a Lolly backup" - en verwarrend genoeg gebruikt het een vergelijkbare naam (`lolly-backup-<stamp>.zip`). De twee verenigen is een bekend gat.

## Gereserveerde uitbreidingspunten

De envelop is door ontwerp een manifest plus een set genoemde onderdelen, zodat nieuwe soorten draagbare gegevens er later **zonder een breking wijziging** in mee kunnen rijden. Ze passen erin als additieve onderdelen (nieuwe `formatVersion`, dezelfde `minReader`), en de lezer van vandaag slaat over wat hij niet herkent. Deze zijn nog niet gebouwd. De namen zijn hier gereserveerd zodat het formaat coherent blijft wanneer ze er komen.

- **`tokens.json` - designtokens.** Een [W3C DTCG](https://tr.designtokens.org/format/)-designtokendocument (het formaat dat [Penpot importeert en exporteert](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens met `$value`/`$type`/`$description`, georganiseerd in groepen, sets en thema's). Een tokenset in de bundel laat een gebruiker zijn merkprimitieven tussen installaties verplaatsen, samen met zijn sessies. (De eigen merktokens van een gebruiker reizen vandaag al mee als het asset `user/tokens/brand` in `assets.json`; dit onderdeel zou een heel DTCG-document dragen, met zijn sets en thema's.) Op langere termijn wordt een geïngesteerde tokenset een eersteklas bron waartegen tools en paletassets zich oplossen.
- **`penpot/` - geïngesteerde Penpot-bestanden.** Een gereserveerde map voor een Penpot-bestand (of zijn geëxtraheerde, voor Lolly relevante subset) dat is geïmporteerd en getoond *als een tool*. De bundel zal de geïngesteerde definitie dragen, zodat die meereist met de rest van de gegevens van de gebruiker.

Alles buiten deze gereserveerde namen en de bovenstaande onderdelen is voor een lezer een onbekend onderdeel: ongemoeid gelaten en meegeteld in `skipped`.

## Referentie

- Module: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - de naamgever `backupFilename()` is intern).
- Contracttest: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - retour-, merge-, integriteits-, voorwaartse-compatibiliteits- en lezerpoort-gevallen.
- Geschiedeniscontracttests: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) en [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Browseracceptatie: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) en [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Gebruikt bridge-oppervlak: `host.profile`, `host.state`, `host.assets` - zie [Host API](/info/host-api.html).
