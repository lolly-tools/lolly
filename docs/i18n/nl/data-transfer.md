# Gegevensoverdracht: de `lolly-backup`-bundel

Een back-upbundel verplaatst de persoonlijke bibliotheek die Lolly op het apparaat bewaart: exporteer die op de ene installatie, neem het bestand mee (USB, AirDrop, e-mail naar jezelf of een gedeelde netwerkmap) en importeer het op een andere. Export en import hebben geen server nodig, en het doelapparaat kan offline zijn.

Dit is de formaatspecificatie voor mensen die shells, tools of scripts rond back-ups bouwen. Lees [Je werk naar een ander apparaat verplaatsen](/info/find-your-work.html#move-your-work-to-another-device) om je eigen werk te verplaatsen.

![De twee knoppen die een hele installatie verplaatsen: Export my data schrijft één zip, Import data leest hem weer in](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Reikwijdte
Een bundel bevat *gebruikersgegevens*, geen catalogustools. Catalogustools en catalogusassets synchroniseren afzonderlijk en worden verondersteld aanwezig te zijn op de doelinstallatie, in het uiterste geval in een hogere versie. Tools die een gebruiker heeft gemaakt, reizen mee in `profile.json`. Importeren installeert of upgradet nooit een catalogustool.
:::

<!--i:eti-badge-check-->
## Doelen

- <!--i:box--> **Eén formaat, elke shell.** De webapp, de desktop- en mobiele apps en toekomstige shells delen dezelfde omhulling en deelschema's. Optionele onderdelen hangen af van de mogelijkheden van elke shell, en niet-ondersteunde onderdelen worden gemeld. Elke capability bridge levert zijn opslagadapter.
- <!--i:shieldcheck--> **Doorstaat de overdracht.** Een bundel die tijdens de overdracht beschadigd of afgekapt is, geeft bij import een fout en wordt nooit half hersteld.
- <!--i:clock--> **Gaat langer mee dan deze versie.** Een oudere app importeert de onderdelen van een nieuwere bundel die hij herkent. Een incompatibel formaat wordt netjes geweigerd.
- <!--i:check--> **Veilig samenvoegen.** Importeren naar een installatie die al in gebruik is, wist nooit iets dat niet in de bundel zat.

<!--i:eti-package-->
## De omhulling

Een bundel is een gewone `.zip`. Hij doorstaat elke overdracht intact, en elke uitpaktool kan de inhoud inspecteren.

De download krijgt de naam van zijn eigenaar: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, bijvoorbeeld `LollyTools-Ada-Lovelace-2026-06-26-1.zip`. De voor- en achternaam komen uit het profiel en worden weggelaten wanneer ze niet zijn ingesteld: zonder profiel wordt het `LollyTools-2026-06-26-1.zip`, en met alleen een voornaam wordt het `LollyTools-Ada-2026-06-26-1.zip`. Elke naam wordt een token dat veilig is voor bestandsnamen (Unicode-letters en -cijfers behouden, spaties en leestekens verwijderd, maximaal 32 tekens). `<n>` is een volgnummer per dag en per apparaat, zodat herhaalde exports op één dag niet botsen en op volgorde blijven. `backupFilename()` in `data-transfer.ts` bouwt de naam. De naam verandert de inhoud van de zip niet.

| Pad | Vereist | Inhoud |
|---|---|---|
| `manifest.json` | ja | Formaat-id, versies, aantallen en integriteit per onderdeel. Een lezer leest dit bestand eerst. |
| `profile.json` | indien ingesteld | Het `me`-record van de gebruiker: naam, contactgegevens, verwijzing naar portretfoto en vlaggen, plus mappen, Trash, projectblauwdrukken, gebruikerssjablonen en door de gebruiker gemaakte tools, favorieten, verborgen tools, taal- en emojikeuze. Gelezen via `host.profile`. |
| `sessions.json` | ja | Elke opgeslagen sessie: slot, tool-id en -versie, label, miniatuur (data-URL) en volledige invoergegevens. Gelezen via `host.state`. |
| `assets.json` | ja | Metadata voor elke geüploade asset (afbeeldingen, lettertypen, merktokens, logo's, opgeslagen kopieën van downloads), elk met een verwijzing naar zijn bytes onder `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per asset | De ruwe bytes van de asset, ongecomprimeerd opgeslagen omdat de meeste formaten al gecomprimeerd zijn. De extensie is cosmetisch; het MIME-type in `assets.json` is bepalend. |
| `assets/blobs/<n>.c2pa` | indien aanwezig | Geëxtraheerde Content Credentials als exacte binaire bytes, waarnaar `_credentialFile` in het assetrecord verwijst. Dit zijn geen ondertekeningssleutels van het apparaat. |
| `design-systems.json` | indien aanwezig | De design systems die op deze installatie zijn gemaakt of toegevoegd, als `{ active, records }`. Zie [Importregels](#import-rules). |
| `file-history.json` | optioneel | Versiebeheerde snapshots van assets, afgeronde rapporten over bestandsbewerkingen en complete batchmanifesten, met een eigen versie. Geleverd door de interne back-upadapter `fileHistory` van de shell. |
| `revision-history.json` | optioneel, handmatige back-ups | Stabiele creatie-id's, bewaarde controlepunten, miniaturen en doorlopend bijgewerkte herstelconcepten. Geleverd door `host.state.history.backup` waar ondersteund. |
| `file-history/versions/` | per snapshot | Eerdere assetbytes en geëxtraheerde credentials, ongeacht of de huidige asset nog bestaat. |
| `file-history/results/` | per afgeronde bewerking | Exacte uitvoerbytes. Geen oorspronkelijk bestand dat voor conversie is geselecteerd, wordt bewaard of opgenomen. |
| `prefs.json` | ja | Lokale voorkeuren van de gebruiker: `theme`, `sidebarWidth` en de activiteitsteller `ct-metrics`. |
| `lolly.txt` | ja | Een leesbare samenvatting van de bundel (aantallen, profiel, bestandsnaam) voor iedereen die de zip zonder Lolly opent. Bij elke export opnieuw gegenereerd en bij import herkend, zodat het nooit als een overgeslagen onderdeel telt. Het wordt na de integriteitslijst geschreven, dus de lijst dekt dit bestand niet. |

::: details Hoe export de zip schrijft
Export schrijft de zip onderdeel voor onderdeel (`shells/web/src/lib/zip-stream.ts`). Uploads, opgeslagen resultaten en opgeslagen assetversies worden in stukken van 4 MiB gelezen, nooit in hun geheel. Opgeslagen resultaten en versies worden eerst gecontroleerd tegen hun vastgelegde SHA-256. Vervolgens wordt elk bestand gelezen voor zijn controlesom en integriteitsdigest, en de zip verwijst naar het bestand op zijn plaats.

Er wordt niets opnieuw gecodeerd. Elk onderdeel behoudt zijn exacte bytes en digest, zodat een bestand met Content Credentials de bytes behoudt die zijn handtekening dekt. Bij dezelfde onderdelen en hetzelfde tijdstip is de zip identiek aan die van de eerdere schrijver die alles in het geheugen verwerkte, behalve dat een geschiedenisbestand van meer dan 16 MiB in stukken wordt gecomprimeerd. `tests/backup-streaming.test.ts` controleert dit tegen vastgelegde referentiedigests.

Bij een synthetische bibliotheek van 192 MiB, gemeten in Node, kostte het afronden van de back-up ongeveer 125 tot 150 MiB boven op de bibliotheek, tegenover ongeveer 850 MiB voor de schrijver die alles in het geheugen verwerkte (`node scripts/bench-backup-finalise.ts`). Import leest nog steeds de hele zip in het geheugen.
:::

<!--i:eti-file-->
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
| `format` | Altijd `lolly-backup`. Een bestand zonder dit veld wordt afgewezen als "geen Lolly-back-up". |
| `formatVersion` | De indeling waarmee deze bundel is **geschreven**. Verhoogd bij elke wijziging in de set onderdelen of hun structuur. Lezers baseren toelating **niet** op dit veld. |
| `minReader` | De minimale lezerversie die deze bundel **veilig** kan importeren. Dit is het veld waarop lezers de toelating baseren. |
| `app` | Id van de app die de bundel heeft gemaakt, voor diagnostiek. |
| `exportedAt` | ISO-tijdstempel waarop de bundel is gemaakt. |
| `counts` | Wat de schrijver heeft opgenomen, voor weergave en plausibiliteitscontroles. |
| `integrity` | Optioneel. Koppelt elk onderdeel behalve `manifest.json` aan een digest in SRI-stijl, `sha256-<base64>`, van zijn **ongecomprimeerde** bytes. |

<!--i:eti-tag-->
## Versiebeleid

Twee versienummers laten het formaat groeien zonder oudere installaties achter te laten.

![Een wijziging in het bundelformaat is ofwel aanvullend, zodat oude lezers haar kunnen negeren, ofwel incompatibel, waarbij een verkeerde import gegevens beschadigt. Aanvullend verhoogt formatVersion en behoudt minReader; incompatibel verhoogt formatVersion en minReader. Een lezer importeert wanneer minReader hoogstens zijn eigen versie is.](/info/diagrams/concepts/backup-version-gate.svg)

- Een lezer importeert een bundel wanneer `manifest.minReader` hoogstens zijn eigen lezerversie is. Hij weigert alleen met "een nieuwere versie van de app is nodig" wanneer de bundel een nieuwere lezer vereist.
- Een **aanvullende** wijziging, zoals een nieuw optioneel onderdeel of een nieuw optioneel manifestveld, verhoogt `formatVersion` en laat `minReader` ongemoeid. Oudere apps importeren nog steeds elk onderdeel dat ze herkennen, en onderdelen die ze niet herkennen worden als overgeslagen gemeld, niet stilzwijgend weggelaten.
- Een **incompatibele** wijziging, waarbij een verkeerde import van een onderdeel gegevens beschadigt of een optioneel onderdeel verplicht wordt, verhoogt `minReader`. Oudere apps weigeren dan netjes in plaats van iets te importeren dat ze niet aankunnen. Oudere apps weigeren de bundel dan netjes.
- Als een toekomstige bundel `formatVersion` instelt maar `minReader` weglaat, vallen lezers terug op toelating op basis van `formatVersion` en behandelen ze de wijziging als incompatibel.

::: note Vuistregel voor auteurs
Als elke bestaande lezer nog steeds juist zou werken door je toevoeging te negeren, is de wijziging aanvullend: verhoog `formatVersion` en laat `minReader` ongemoeid. Verhoog anders `minReader`.
:::

<!--i:eti-shield-check-->
## Integriteit

Wanneer `manifest.integrity` aanwezig is, controleert een lezer de SHA-256 van elk vermeld onderdeel **voordat er iets wordt geschreven**. Een afwijking ("integriteitscontrole mislukt") of een ontbrekend onderdeel ("onvolledig") stopt de import, zodat er geen gedeeltelijk herstel plaatsvindt. Dit vangt schade tijdens de overdracht op: een afgekapt AirDrop-bestand, een e-mailgateway die de bijlage opnieuw heeft gecodeerd, een defecte USB-sector.

Integriteitscontrole gebeurt waar mogelijk. De integriteitsgegevens worden alleen geschreven waar Web Crypto beschikbaar is (elke veilige browsercontext en modern Node) en alleen gecontroleerd wanneer zowel de lijst als Web Crypto aanwezig zijn. Een bundel zonder de lijst, zoals een van vóór de invoering van integriteitscontrole, wordt ongewijzigd geïmporteerd: "kan niet verifiëren" telt nooit als "beschadigd".

Het manifest vermeldt noch zichzelf, noch het opnieuw gegenereerde `lolly.txt`.

<!--i:eti-download-->
## Importregels

Een import draait in een van twee modi.

- **Merge** is wat **Import data…** en de eerste deelname aan synchronisatie, **Bring it to this device**, doen. Gegevens op de doelinstallatie blijven behouden, en niets buiten de bundel wordt aangeraakt.
- **Replace** is wat apparaatsynchronisatie gebruikt om apparaten gelijk te houden. Het neemt het profielrecord, de voorkeuren, sessies, afbeeldingen en de keuze van het actieve design system van de gesynchroniseerde kopie over. Het verwijdert alleen items die een ander apparaat sinds de laatste synchronisatie heeft verwijderd. Het herstellen van een eerdere kopie slaat eerst het apparaat op, maakt het apparaat vervolgens gelijk aan die kopie en verwijdert alles wat de kopie niet bevat. [Je apparaten synchroniseren](/info/sync.html) behandelt wat een gebruiker ziet.

Samenvoegen behandelt elke soort gegevens als volgt:

| Gegevens | Al op de doelinstallatie | Alleen in de bundel |
|---|---|---|
| Sessies (op slot) en geüploade afbeeldingen (op id) | De meest recent opgeslagen kopie blijft behouden, zodat een oudere back-up nooit nieuwer werk overschrijft. Bij gelijke of onbekende tijdstippen blijft de kopie op de doelinstallatie behouden. | Toegevoegd |
| Mappen | De naam en bovenliggende map van de doelinstallatie blijven behouden, en de map krijgt de onderdelen uit de bundel die ontbreken. Een sessie die op de doelinstallatie in een map staat, blijft daar staan. | Toegevoegd |
| Favorieten (tools, catalogusassets en Projects-items) | Gecombineerd | Toegevoegd |
| Sjablonen, Projects-sjablonen en gebruikerstools (op id) | Het record van de doelinstallatie blijft behouden. | Toegevoegd |
| Trash-vermeldingen | De vermelding van de doelinstallatie blijft behouden. | Toegevoegd, zodat een item dat op een van beide installaties kon worden hersteld, nog steeds kan worden hersteld. Een vermelding waarvan de map op de doelinstallatie weer in gebruik is of waarvan het Trash-slot op de doelinstallatie al wordt gebruikt, wordt weggelaten. |
| Andere profielvelden (naam, contactgegevens, taal, functievlaggen, verborgen tools en andere instellingen) | De waarde van de doelinstallatie blijft behouden. | Overgenomen waar het veld op de doelinstallatie leeg is |
| Voorkeuren (`prefs.json`) | De waarde van de doelinstallatie blijft behouden. | Geschreven waar de doelinstallatie er geen heeft |
| Design systems (op id) | Het record uit de bundel vervangt dat van de doelinstallatie. | Toegevoegd. De actieve keuze uit de bundel geldt alleen wanneer de doelinstallatie geen eigen design system heeft. |
| Creatiegeschiedenis | De meest recent opgeslagen kopie blijft de huidige, en de andere wordt als beschermd concept bewaard. | Toegevoegd |

**Opgeslagen sessies worden automatisch opnieuw aan hun afbeeldingen gekoppeld.** Assetverwijzingen worden op id bewaard. De bridge zoekt ze opnieuw op nadat de afbeeldingen zijn hersteld, omdat `blob:`-URL's een herlaadactie niet overleven.

**Geschiedenisrecords veranderen nooit nadat ze zijn geschreven.** Een herhaalde import van assetversies en bewerkings-id's voegt niets toe, en een id die al andere bytes of geschiedenis aanduidt, wordt geweigerd, niet overschreven. Het opnieuw importeren van een identieke huidige asset behoudt zijn versie, en een gewijzigde huidige asset moet een andere versie hebben.

**Creatiegeschiedenis heeft nog een paar regels.** Een creatie waarvan het slot op de doelinstallatie voor een andere creatie wordt gebruikt, wordt als een afzonderlijke creatie toegevoegd, en een creatie in Trash op de doelinstallatie blijft daar. Bij een controlepunt-id die andere inhoud op de doelinstallatie aanduidt, blijft de inhoud van de doelinstallatie behouden. Een archief dat niet door zijn eigen controles komt, stopt de import voordat een profiel, sessie, asset of voorkeur verandert, en een identieke herhaalde import neemt geen extra opslagruimte in.

**De samenvatting meldt wat er is gebeurd.** Elke import geeft `profile`, `sessions`, `userAssets`, `prefs`, `skipped` en `failedAssets` terug.

- `failedAssets` telt geüploade assets die niet konden worden hersteld, bijvoorbeeld omdat de opslag van het apparaat vol is.
- `skipped` telt onderdelen van een nieuwere schrijver die deze build niet herkende. De app toont het aantal ("… · N nieuwere items overgeslagen").
- Met bestandsgeschiedenis voegt de samenvatting `assetVersions`, `fileOperations`, `fileBatches` en `failedHistory` toe. Volle opslag of een conflict met een onveranderlijke id kan een gedeeltelijk herstel veroorzaken, en de app vertelt de gebruiker dan de oorspronkelijke back-up te bewaren.
- Met creatiegeschiedenis voegt ze `revisions` en `recoveryDrafts` toe, waarbij alleen wordt geteld wat deze import heeft toegevoegd, en `added`, `kept`, `replaced`, `copies` en `hidden` voor de manier waarop elke creatie is samengevoegd. `skippedCheckpoints` telt controlepunten waarvan de id andere inhoud op de doelinstallatie aanduidt, en `historyLeftOut` telt oudere controlepunten en concepten die niet in de geschiedenisruimte van het apparaat pasten.
- Een vervangende import voegt `removed` en `failedRemovals` toe.

Herstellen is niet één transactie over de opslag voor profielen, sessies, assets en geschiedenis heen. Cloudsynchronisatie verhoogt de toegepaste revisie **niet** na een gedeeltelijk of niet-ondersteund herstel, zodat de kopie beschikbaar blijft om het opnieuw te proberen.

<!--i:eti-unlink-->
## Wat niet meegaat

- **Cataloguscaches** (gedownloade assetmetadata en blobs, de toolindex), die het doel opnieuw synchroniseert.
- **Catalogustools en catalogusassets**, waarvan wordt aangenomen dat ze op het doel aanwezig zijn. Merktokens, lettertypen en logo's die de gebruiker heeft toegevoegd zijn gebruikersassets en gaan wel mee.
- **`blob:` en object-URL's**, die de bridge bij het laden opnieuw aanmaakt.
- **Conversieoriginelen, actieve uitvoeringsleases en machinegebonden toegangs- of ondertekeningsgeheimen.** Deze zijn geen overdraagbare geschiedenis. Een opgeslagen resultaat is een kopie. Het betekent niet dat er een back-up van de oorspronkelijke bron is gemaakt.
- **De exportvolgordeteller**, de dagelijkse teller voor downloadnamen in `localStorage` (`lolly-export-seq`). Hij blijft buiten `PREF_KEYS`, dus hij gaat nooit mee in een bundel.

De opslagmeter toont dezelfde verdeling. Saved sessions, My images en File results & versions gaan mee in een bundel. De assetcache, toolvoorbeelden en offline vastgezette items kunnen opnieuw worden opgebouwd en blijven achter.

![De opslagmeter verdeelt de gegevens op dit apparaat in benoemde categorieën, met Saved sessions en My images apart van de Asset cache, hier op een nieuwe installatie waarin elke categorie nog leeg is](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

<!--i:eti-building-->
## Organisatiegegevens met Lolly Work

Deze bundel maakt een back-up van de persoonlijke bibliotheek op het apparaat. Een bundel is geen back-up van een **Lolly Work**-instantie. Organisatieaccounts, toegangsbeleid, gedeelde projecten, catalogusversies, goedkeuringen, rendertaken en auditrecords worden door die dienst bewaard. Maak opnieuw verbinding en meld je aan om weer toegang tot gedeeld werk te krijgen. Een persoonlijke bundel importeren verleent die toegang niet.

Beheerders maken back-ups van servergegevens, bewaren en wissen ze met de eigen gidsen van Lolly Work: [Back-up en herstel](/info/work-operations.html#backup-and-restore) en [Lolly Work: opslag en levenscyclus van gegevens](/info/work-data-lifecycle.html). Een apparaat wissen of exporteren voert geen van die serverbewerkingen uit.

<!--i:eti-monitor-->
## Tussen shells

`data-transfer.ts` leest en schrijft alleen via de capability bridge (`host.profile`, `host.state`, `host.assets`) en de gedeelde voorkeuren in `localStorage`. Dezelfde module leest en schrijft de gemeenschappelijke envelop op het web en in de desktop- en mobiele apps, via IndexedDB of opslag in het bestandssysteem. Optionele geschiedenisonderdelen verschijnen alleen waar hun adapter beschikbaar is. Bij het importeren wordt een niet-ondersteund onderdeel als overgeslagen gemeld. De headless testsuite test de gemeenschappelijke onderdelen met een bridge in het geheugen, en geschiedenistransacties hebben ook tests in een echte browser.

Twee shells vallen buiten die garantie:

- De **eenmalige CLI** heeft niets om mee te nemen: de toestand zit in het geheugen en blijft één aanroep bestaan.
- De **TUI** bewaart de toestand in `~/.lolly` (sessies, mappen, profiel). De Profile-weergave schrijft een eigen, eenvoudiger back-uparchief: `saved-state/<slot>.json` per sessie plus `profile.json` en `folders.json`, zonder manifest, zonder `formatVersion` of `minReader` en zonder integriteitsmap. Een lezer van dit formaat wijst dat archief af als "geen Lolly-back-up", hoewel de namen op elkaar lijken (`lolly-backup-<stamp>.zip`). Beide samenvoegen is een bekend open punt.

<!--i:eti-clock-->
## Nog niet overdraagbaar

Nieuwe soorten overdraagbare gegevens kunnen later als aanvullende onderdelen worden toegevoegd (een nieuwe `formatVersion`, dezelfde `minReader`). Design systems gaan al op deze manier mee, als `design-systems.json` plus hun gebruikersassets.

Twee namen zijn gereserveerd voor gegevens die nog niet meegaan:

- **`tokens.json`** zou een [W3C DTCG](https://tr.designtokens.org/format/)-document met designtokens bevatten, met zijn groepen, sets en thema's, het formaat dat [Penpot importeert en exporteert](https://help.penpot.app/user-guide/design-systems/design-tokens/). De eigen merktokens van een gebruiker gaan al mee als de asset `user/tokens/brand` in `assets.json`, en de tokens van een design system gaan mee met zijn record.
- **`penpot/`** is gereserveerd voor een ingelezen Penpot-bestand, of het deel ervan dat relevant is voor Lolly, aangeboden als tool.

<!--i:eti-history-->
## Geschiedenisonderdelen

De twee geschiedenisonderdelen zijn optioneel en hebben hun eigen versies.

::: details Aanmaakgeschiedenis (v3)
Handmatige back-ups van een webinstallatie met aanmaakgeschiedenis bevatten `revision-history.json`, met een eigen schema `{ version: 1, documents, revisions, recoveries }`. Het bevat de bewaarde ID's, canonieke invoersnapshots, versiestempels, rastervoorbeelden en afzonderlijke schrijfconcepten. De geschiedenisadapter legt de huidige sessies en hun laatste revisies vast in één leestransactie, en `sessions.json` gebruikt dezelfde huidige snapshots voor oudere lezers.

Herstellen controleert de SHA-256 en het aantal bytes van de payload, unieke identiteiten, relaties tussen documenten en laatste revisies, afstamming, tijdstempels, voorbeeldtypen en limieten voordat het archief in één transactie wordt vastgelegd. Verwijzingen naar bovenliggende revisies die zijn gecompacteerd kunnen ontbreken. Bestaand huidig werk wordt nooit stilzwijgend vervangen: wanneer een creatie aan beide kanten bestaat, wordt de kant die niet als huidig behouden blijft een beschermd concept.

Het archief heeft een overdrachtslimiet van 384 MiB. Opslaglimieten worden afgedwongen zonder bewaarde controlepunten af te kappen. Exporteren schrijft `revision-history.json` en `sessions.json` in blokken, met dezelfde bytes die één `JSON.stringify` oplevert, zodat de bestandstekst nooit in zijn geheel in het geheugen staat. Een geschiedenisbestand dat de limiet zou overschrijden wordt weggelaten zodra dat gebeurt en vanaf dat moment alleen nog geteld. Het archief wordt vervolgens opnieuw gemaakt zonder de oudste automatische controlepunten, en het exportoverzicht telt die als `checkpointsLeftOut`, of het archief wordt geweigerd.

Een shell zonder deze mogelijkheid herstelt gewone sessies en meldt het geschiedenisonderdeel als overgeslagen. Geschiedenis in het native bestandssysteem blijft niet ondersteund totdat de adapter duurzame geschiedenistransacties biedt. Gasten in een privésamenwerking hebben geen duurzame geschiedenis of herstelarchief.

Persoonlijke snapshotsynchronisatie laat de aanmaakgeschiedenis weg. Een snapshot toepassen op een lokaal document met geschiedenis bewaart de vorige werktoestand als afzonderlijk herstelconcept en maakt het schrijftoken van elke open editor ongeldig. De onveranderlijke controlepunten blijven op het apparaat. Dit beschermt de lokale geschiedenis wanneer een snapshot wordt vervangen. Het voegt gelijktijdige apparaatgeschiedenissen niet samen.

Historische assetverwijzingen blijven bewaard, terwijl renderen assets nog steeds opzoekt via de bestaande bibliotheek op het doel. Dit archief garandeert nog niet de exacte oude assetbytes of oude toolrenders. Bytes van assetversies en bestandsresultaten gaan mee in hun eigen back-uponderdeel.
:::

::: details Opgeslagen versies en bestandsresultaten (v2)
Het optionele geschiedenisonderdeel bevat `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, en lezers accepteren ook de eerdere history-v1-structuur zonder batches. Elke snapshot bevat de vaste asset-ID en exacte versie, de opslagtijd, bytelengte en hexadecimale SHA-256, plus een assetrecord waarvan `_file` en de optionele `_credentialFile` naar binaire onderdelen verwijzen. Bewerkingen bevatten de oorspronkelijke bestandsgegevens, het verzoek, het rapport, tijdstempels en een optionele `_file` voor het resultaat. Namen van opslagbackends, OPFS-handles en uitvoeringsleases gaan niet mee. Lezers die alleen geschiedenis v1 kennen weigeren de nieuwe geschiedenisversie vóór het importeren, zodat batchlidmaatschap nooit stilzwijgend wordt weggelaten.

Batchmanifesten leggen elke geselecteerde bron vast vóór verwerking, inclusief bestanden die nooit zijn gelezen, geannuleerde leden, mislukte reserveringen van resultaatruimte en onderbroken werk. Elk lid heeft een vaste bewerkings-ID, bronverwijzing en brongegevens, de gevraagde uitvoernaam en een eindrapport. Een ongelezen bron heeft opgegeven gegevens, geen verzonnen digest. Importeren valideert de identiteit van leden en de consistentie met elk meegeleverd bewerkingsrapport. Lolly Batch-rapporten blijven beschikbaar wanneer afzonderlijke resultaten zijn verwijderd, maar een bewijs betekent niet dat de uitvoerbytes nog zijn opgeslagen.

- **Eerst valideren.** Elk bekend geschiedenisrecord, rapport en elk bestand waarnaar wordt verwezen wordt gevalideerd voordat een profiel- of assetimport iets schrijft. Ontbrekende bytes en een afwijkende SHA-256 leiden tot afwijzing, zelfs als de envelop geen integriteitsmap heeft. Geëxtraheerde credentials blijven bytearrays, ook bij imports uit oudere schrijvers die ze als objecten met numerieke sleutels serialiseerden.
- **Lopend werk.** Lopende bewerkingen worden onderbroken records in de back-up, met een foutrapport en zonder resultaat. Herstellen start nooit achtergrondwerk opnieuw en importeert geen actieve lease. Opnieuw proberen betekent het oorspronkelijke bestand opnieuw selecteren, waarbij het wordt gecontroleerd tegen de vastgelegde SHA-256 als die beschikbaar is.
- **Opslag.** Herstelde resultaten leggen hun bytes en metadata samen vast in IndexedDB. Gewone nieuwe resultaten gebruiken OPFS waar beschikbaar, met IndexedDB als terugvaloptie. Een bestaande actieve bewerking wordt nooit door een import vervangen.
- **Back-uplimieten.** Exporteren streamt deze bytes naar het archief, maar herstellen pakt nog steeds een volledige back-up in het geheugen uit, dus de limieten blijven: **256 MiB aan geschiedenispayload**, **4 MiB aan geschiedenismetadata**, maximaal **100 bewerkingen**, **100 batches** en **2.000 snapshots**. Exporteren weigert te grote of onvolledige geschiedenis expliciet en laat die nooit stilzwijgend weg. Download belangrijke versies en resultaten één voor één voordat je oudere lokale kopieën verwijdert. Deze limieten zijn geen gemeten garantie voor het piekgeheugengebruik op telefoons.
- **Lokale budgetten.** Lokale resultaatgeschiedenis heeft een budget van 512 MiB en een limiet van 100 records. Assetsnapshots hebben een apart budget van 512 MiB en maximaal 20 historische versies per asset, en bytes van geëxtraheerde credentials tellen mee voor dat budget. Herstellen houdt zich aan deze limieten en verwijdert nooit stilzwijgend bestaande gebruikersgegevens.
- **Batchmetadata.** Lokale batchmetadata heeft een apart budget van 4 MiB, maximaal 100 manifesten en 20 leden per batch. Wachtende leden reserveren metadatacapaciteit, met een rapportlimiet van 32 KiB per lid. Dit is een logisch budget, geen garantie voor schijfruimte in de browser: een daadwerkelijke quotaoverschrijding wordt getoond, en het rapport in het geheugen blijft downloadbaar. Een batchlid opnieuw proberen maakt een nieuwe batch zonder het oude rapport te overschrijven. Een batchrecord verwijderen verwijdert geen afzonderlijke resultaatbytes of bibliotheekassets.
- **Resultaten in de bibliotheek.** Geconverteerde resultaten kunnen zonder normalisatie of hercodering aan de bibliotheek worden toegevoegd, met de bron- en uitvoerhashes en de bewerkingsrelatie erbij. Opnieuw toevoegen hergebruikt een ongewijzigde kopie, en een bewerkte kopie wordt nooit overschreven. Rasterafbeeldingen kunnen een nieuw Lolly Design-document starten, dat de huidige asset-ID uit de bibliotheek gebruikt. Exacte versiekoppelingen afdwingen in de volledige runtime en het URL-pad van Lolly Design is afzonderlijk werk. SVG-, HTML-, PDF- en ZIP-resultaten worden bewaard als ondoorzichtige bestandsassets, niet opgewaardeerd tot vertrouwde interactieve of vectorinhoud.
- **Waar mensen dit zien.** **Convert → Recent file operations** toont het geschiedenisgebruik, rapporten, downloads en de versiebeheerder, die ook eerdere versies van verwijderde bibliotheekassets vindt. Een snapshot herstellen maakt een nieuwe huidige versie en bewaart de geselecteerde snapshot. **Settings → Preferences → Storage** telt resultaten en versies apart van wegwerpcaches.
- **Opruimen.** Expliciet opruimen van tijdelijke bestanden verwijdert alleen bytes die eigendom zijn van bewerkingen en waarnaar niet wordt verwezen. Huidige records beschermen hun bestanden, en recente OPFS-bestanden krijgen één uur respijt. Opgeslagen resultaten en assetsnapshots worden niet automatisch gewist.

Oudere lezers accepteren nog steeds de v2-envelop (`minReader: 1`) en herstellen de onderdelen die ze kennen, waarbij ze niet-ondersteunde geschiedenisonderdelen als overgeslagen tellen. Volledig geschiedenisherstel vereist een shell met de adapter `fileHistory`, een aansluitpunt binnen de shell, geen `HostV1`-mogelijkheid voor tools. Echt herstel tussen twee apparaten wordt gedekt door de lokale Chromium-acceptatiecheck. Herstel op geïnstalleerde desktop-, iOS- en Android-apps moet nog afzonderlijk worden goedgekeurd.
:::

<!--i:eti-code-->
## Naslag

- Module: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; de naamgever `backupFilename()` is intern).
- Contracttest: `tests/data-transfer.test.ts`, voor heen-en-terugoverdracht, samenvoegen, integriteit, voorwaartse compatibiliteit en de lezercontrole.
- Contracttests voor geschiedenis: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` en `tests/file-result-library.test.ts`. Browseracceptatie: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` en `tests/file-result-reuse.browser.test.ts`.
- Gebruikte bridge-interface: `host.profile`, `host.state` en `host.assets`; zie [Host API](/info/host-api.html).
