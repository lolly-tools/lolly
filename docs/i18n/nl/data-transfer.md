# Gegevensoverdracht: de bundel `lolly-backup`

Lolly bewaart je persoonlijke bibliotheek op het apparaat. Een back-upbundel is hoe die bibliotheek verhuist: exporteer hem op de ene installatie, neem het bestand mee op elke manier (USB, AirDrop, e-mail aan jezelf of een netwerkshare) en importeer hem op een andere. Exporteren en importeren hebben geen server nodig, en het doel kan offline zijn.

Deze pagina is de formaatspecificatie, voor mensen die shells, tools of scripts rond back-ups bouwen: wat er in de zip zit, hoe versies worden afgeschermd, hoe een import samenvoegt en wat wordt gecontroleerd. De handleiding voor mensen die hun eigen werk verplaatsen is [Je werk naar een ander apparaat verplaatsen](/info/find-your-work.html#move-your-work-to-another-device).

![De twee knoppen die een hele installatie verplaatsen: Export my data schrijft één zip, Import data leest hem terug](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> **Reikwijdte.** Een bundel draagt *gebruikersgegevens*, geen catalogustools. Catalogustools en catalogusassets worden apart gesynchroniseerd en worden verondersteld al op het doel aanwezig te zijn, hooguit in een hogere versie. Tools die een gebruiker zelf maakte reizen mee in `profile.json`. Importeren installeert of upgradet nooit een catalogustool.

## Doelen

- <!--i:box--> **Eén formaat, elke shell.** De webapp, de desktop- en mobiele apps en toekomstige shells delen dezelfde envelop en onderdeelschema's. Optionele onderdelen hangen af van de capabilities van elke shell, en niet-ondersteunde onderdelen worden gemeld. Elke capabilitybrug levert zijn opslagadapter.
- <!--i:shieldcheck--> **Overleeft de reis.** Een bundel die onderweg is beschadigd of afgekapt, faalt hoorbaar bij het importeren en wordt nooit half hersteld.
- <!--i:clock--> **Overleeft deze versie.** Een oudere app kan nog steeds de onderdelen van een nieuwere bundel importeren die ze herkent. Een echt brekend formaat wordt netjes geweigerd.
- <!--i:check--> **Veilig om samen te voegen.** Importeren op een installatie die al in gebruik is wist nooit iets wat niet in de bundel zat.

## De envelop

Een bundel is een gewone `.zip`, dus hij overleeft elk transport intact en elk unzip-programma kan de inhoud inspecteren.

De download is genoemd naar de persoon van wie hij is: `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip`, bijvoorbeeld `LollyTools-Ada-Lovelace-2026-06-26-1.zip`, zodat een map Downloads vol back-ups leesbaar blijft. De voor- en achternaam komen uit het profiel en worden weggelaten wanneer niet ingesteld: zonder profiel geeft dat `LollyTools-2026-06-26-1.zip`, en alleen een voornaam geeft `LollyTools-Ada-2026-06-26-1.zip`. Elke naam wordt teruggebracht tot een bestandsnaamveilig token (Unicode-letters en cijfers blijven, spaties en leestekens worden verwijderd, hoogstens 32 tekens). `<n>` is een volgorde per dag en per apparaat, zodat herhaalde exports op één dag niet botsen en in volgorde blijven. `backupFilename()` in `data-transfer.ts` bouwt de naam, en de inhoud van de zip is dezelfde, hoe hij ook heet.

| Pad | Vereist | Inhoud |
|---|---|---|
| `manifest.json` | ja | Formaat-id, versies, aantallen en integriteit per onderdeel. Het eerste waar een lezer naar kijkt. |
| `profile.json` | indien ingesteld | Het hele `me`-record van de gebruiker: naam, contactgegevens, pasfoto-verwijzing en vlaggen, plus mappen, Prullenbak, projectblauwdrukken, gebruikerssjablonen en door gebruikers gemaakte tools, favorieten, verborgen tools, taal en emojikeuze. Gelezen via `host.profile`. |
| `sessions.json` | ja | Elke opgeslagen sessie: slot, tool-id en -versie, label, miniatuur (data-URL) en volledige invoergegevens. Gelezen via `host.state`. |
| `assets.json` | ja | Metadata voor elke geüploade asset (afbeeldingen, lettertypen, merktokens, logo's, opgeslagen kopieën van downloads), elk wijzend naar zijn bytes onder `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per asset | De ruwe assetbytes, ongecomprimeerd opgeslagen omdat de meeste al gecomprimeerde formaten zijn. De extensie is cosmetisch; het MIME-type in `assets.json` is bepalend. |
| `assets/blobs/<n>.c2pa` | indien aanwezig | Geëxtraheerde Content Credentials als exacte binaire bytes, waarnaar `_credentialFile` in het assetrecord verwijst. Dit zijn geen ondertekeningssleutels van het apparaat. |
| `design-systems.json` | indien aanwezig | De design systems die op deze installatie zijn gemaakt of toegevoegd, als `{ active, records }`. Zie [Importregels](#import-rules). |
| `file-history.json` | optioneel | Versiebeheerde assetmomentopnamen, afgeronde bestandsbewerkingsrapporten en volledige batchmanifesten, met een eigen versie. Geleverd door de interne back-upadapter `fileHistory` van de shell. |
| `revision-history.json` | optioneel, handmatige back-ups | Stabiele creatie-id's, bewaarde checkpoints, miniaturen en doorlopende herstelconcepten. Geleverd door `host.state.history.backup` waar ondersteund. |
| `file-history/versions/` | per momentopname | Vorige assetbytes en geëxtraheerde credentials, of de huidige asset nog bestaat of niet. |
| `file-history/results/` | per afgeronde bewerking | Exacte uitvoerbytes. Er wordt geen origineel bestand dat voor conversie is gekozen bewaard of opgenomen. |
| `prefs.json` | ja | Lokale voorkeuren van de gebruiker: `theme`, `sidebarWidth` en de activiteitenteller `ct-metrics`. |
| `lolly.txt` | ja | Een leesbare samenvatting van de bundel (aantallen, profiel, bestandsnaam) voor iedereen die de zip zonder Lolly opent. Bij elke export opnieuw gegenereerd en bij import herkend, dus het telt nooit als overgeslagen onderdeel. Het wordt na de integriteitstabel geschreven, dus de tabel dekt dit bestand niet. |

::: details Hoe export de zip schrijft
Export schrijft de zip onderdeel voor onderdeel (`shells/web/src/lib/zip-stream.ts`). Uploads, opgeslagen resultaten en opgeslagen assetversies worden in stukken van 4 MiB gelezen, nooit in één keer, en opgeslagen resultaten en versies worden eerst gecontroleerd tegen hun vastgelegde SHA-256. Elk bestand wordt daarna gelezen voor zijn checksum en integriteitsdigest, en de zip verwijst ernaar waar het staat.

Er wordt niets opnieuw gecodeerd, dus een bestand met Content Credentials behoudt de exacte bytes die zijn handtekening dekt, en elk onderdeel behoudt zijn exacte bytes en digest. Voor dezelfde onderdelen en tijd is de zip identiek aan die van de eerdere in-memoryschrijver, behalve dat een geschiedenisbestand boven 16 MiB in stukken wordt gecomprimeerd. `tests/backup-streaming.test.ts` controleert dit tegen vastgelegde referentiedigests.

Op een synthetische bibliotheek van 192 MiB, gemeten in Node, kostte het afronden van de back-up ongeveer 125 tot 150 MiB bovenop de bibliotheek, tegen ongeveer 850 MiB voor de in-memoryschrijver (`node scripts/bench-backup-finalise.ts`). Importeren leest nog steeds de hele zip in het geheugen.
:::

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
| `format` | Altijd `lolly-backup`. Een bestand zonder dit veld wordt geweigerd als "not a Lolly backup". |
| `formatVersion` | De indeling waarmee deze bundel is **geschreven**. Verhoogd bij elke wijziging in de set onderdelen of vormen. Lezers poorten **niet** op dit veld. |
| `minReader` | De minimale lezersversie die deze bundel **veilig** kan importeren. Dit is het veld waarop lezers poorten. |
| `app` | Id van de producerende app, voor diagnostiek. |
| `exportedAt` | ISO-tijdstempel waarop de bundel is gemaakt. |
| `counts` | Wat de schrijver erin zette, voor weergave en controles. |
| `integrity` | Optioneel. Koppelt elk onderdeel behalve `manifest.json` aan een `sha256-<base64>`-digest in SRI-stijl van zijn **ongecomprimeerde** bytes. |

## Versiebeleid

Twee versienummers laten het formaat groeien zonder oudere installaties te laten stranden.

![Een wijziging in het bundelformaat is additief, wat oude lezers kunnen negeren, of brekend, waarbij een verkeerde import corrumpeert. Additief verhoogt formatVersion en behoudt minReader; brekend verhoogt formatVersion en verhoogt minReader. Een lezer importeert wanneer minReader hoogstens zijn eigen versie is.](/info/diagrams/concepts/backup-version-gate.svg)

- Een lezer importeert een bundel wanneer `manifest.minReader` hoogstens zijn eigen lezersversie is. Hij weigert, met "needs a newer version of the app", alleen wanneer de bundel een nieuwere lezer vereist.
- Een **additieve** wijziging, zoals een nieuw optioneel onderdeel of een nieuw optioneel manifestveld, verhoogt `formatVersion` en laat `minReader` met rust. Oudere apps importeren nog steeds elk onderdeel dat ze herkennen, en onderdelen die ze niet herkennen worden als overgeslagen gemeld, niet stilzwijgend weggelaten.
- Een **brekende** wijziging, waarbij een verkeerde import van een onderdeel gegevens corrumpeert of een optioneel onderdeel verplicht wordt, verhoogt `minReader`. Oudere apps weigeren dan netjes in plaats van iets te importeren dat ze niet aankunnen.
- Als een toekomstige bundel `formatVersion` zet maar `minReader` weglaat, vallen lezers terug op poorten op `formatVersion` en behandelen ze de wijziging als brekend.

> **Vuistregel voor makers:** als elke bestaande lezer nog het juiste zou doen door je toevoeging te negeren, is de wijziging additief: verhoog `formatVersion` en laat `minReader`. Verhoog anders `minReader`.

## Integriteit

Wanneer `manifest.integrity` aanwezig is, controleert een lezer de SHA-256 van elk vermeld onderdeel **voordat er iets wordt geschreven**. Een afwijking ("failed its integrity check") of een ontbrekend onderdeel ("incomplete") stopt de hele import, dus er is geen gedeeltelijk herstel. Dit vangt de schade op die een bestandstransport kan aanrichten: een afgekapte AirDrop, een e-mailgateway die de bijlage opnieuw codeerde, een slechte USB-sector.

Integriteit is best effort. Ze wordt alleen geschreven waar Web Crypto beschikbaar is (elke beveiligde browsercontext en moderne Node), en alleen gecontroleerd wanneer zowel de tabel als Web Crypto aanwezig zijn. Een bundel zonder de tabel, zoals een van vóór integriteit bestond, importeert ongewijzigd: "cannot verify" telt nooit als "corrupt".

Het manifest vermeldt noch zichzelf noch het opnieuw gegenereerde `lolly.txt`. De digests dekken de onderdelen waarvoor het manifest instaat.

## Importregels

Een import draait in een van twee modi.

- **Merge** is wat **Import data…** doet, en wat de eerste aansluiting van sync, **Bring it to this device**, doet. Gegevens op het doel blijven, en niets wat niet in de bundel zat wordt aangeraakt: een sessie die het doel had en de bundel niet, overleeft de import.
- **Replace** is wat apparaatsync gebruikt om apparaten gelijk te houden: het neemt het profielrecord, de voorkeuren, sessies, afbeeldingen en de keuze van actief design system van de gesynchroniseerde kopie, en verwijdert alleen items die een ander apparaat sinds de laatste sync verwijderde. Een eerdere kopie herstellen gaat verder en laat het apparaat overeenkomen met die kopie, waarbij alles wordt verwijderd wat de kopie niet bevat, nadat het apparaat eerst is opgeslagen. [Je apparaten synchroniseren](/info/sync.html) behandelt wat een persoon ziet.

Bij een merge blijft alles wat alleen op het doel staat behouden, en elke soort gegevens in de bundel ontmoet het doel als volgt:

| Gegevens | Staat al op het doel | Alleen in de bundel |
|---|---|---|
| Sessies (op slot) en geüploade afbeeldingen (op id) | De recentst opgeslagen kopie blijft, dus een oudere back-up overschrijft nooit nieuwer werk. Gelijke of onbekende tijden behouden de kopie van het doel. | Toegevoegd |
| Mappen | De naam en ouder van het doel blijven, en de map krijgt de leden van de bundel die ze mist. Een sessie die op het doel in een map is ingedeeld, blijft daar ingedeeld. | Toegevoegd |
| Favorieten (tools, catalogusassets en Projects-items) | Gecombineerd | Toegevoegd |
| Sjablonen, Projects-sjablonen en gebruikerstools (op id) | Het record van het doel blijft. | Toegevoegd |
| Prullenbakvermeldingen | De vermelding van het doel blijft. | Toegevoegd, zodat een item dat op beide installaties kon worden hersteld dat nog steeds kan. Een vermelding waarvan de map op het doel weer in gebruik is, of waarvan het Prullenbakslot het doel al gebruikt, wordt weggelaten. |
| Andere profielvelden (naam, contactgegevens, taal, feature flags, verborgen tools en andere instellingen) | De waarde van het doel blijft. | Overgenomen waar het veld van het doel leeg is |
| Voorkeuren (`prefs.json`) | De waarde van het doel blijft. | Geschreven waar het doel er geen heeft |
| Design systems (op id) | Het record van de bundel vervangt dat van het doel. | Toegevoegd. De actieve keuze van de bundel geldt alleen wanneer het doel geen eigen design system heeft. |
| Creatiegeschiedenis | De recentst opgeslagen kopie blijft actueel, en de andere wordt bewaard als beschermd concept. | Toegevoegd |

**Opgeslagen sessies koppelen automatisch opnieuw aan hun afbeeldingen.** Assetverwijzingen worden op id bewaard, en de brug lost ze opnieuw op nadat de afbeeldingen zijn hersteld, wat hij sowieso moet doen omdat `blob:`-URL's een herlaad niet overleven.

**Geschiedenisrecords veranderen nooit nadat ze zijn geschreven.** Een herhaalde import van assetversies en bewerkings-id's voegt niets toe, en een id die al andere bytes of geschiedenis benoemt wordt geweigerd, niet overschreven. Een identieke huidige asset opnieuw importeren behoudt haar versie, en een gewijzigde huidige asset moet een andere versie dragen.

**Creatiegeschiedenis heeft nog een paar regels.** Een creatie waarvan het slot op het doel voor een andere creatie wordt gebruikt, wordt als aparte creatie toegevoegd, en een creatie in de Prullenbak van het doel blijft daar. Een checkpoint-id die op het doel andere inhoud benoemt, behoudt dat van het doel. Een archief dat zijn eigen controles niet doorstaat, stopt de import voordat een profiel, sessie, asset of voorkeur verandert, en een identieke herhaalde import voegt geen opslag toe.

**De samenvatting meldt wat er gebeurde.** Elke import geeft `profile`, `sessions`, `userAssets`, `prefs`, `skipped` en `failedAssets` terug.

- `failedAssets` telt geüploade assets die niet konden worden hersteld, bijvoorbeeld omdat de opslag van het apparaat vol is.
- `skipped` telt onderdelen van een nieuwere schrijver die deze build niet herkende. De app toont het ("… · N newer items skipped"), zodat een herstel zegt wat het achterliet.
- Met bestandsgeschiedenis voegt de samenvatting `assetVersions`, `fileOperations`, `fileBatches` en `failedHistory` toe. Uitputting van opslag of een conflict met een onveranderlijke id kan een gedeeltelijk herstel veroorzaken, en de app zegt de persoon dan de bronback-up te bewaren.
- Met creatiegeschiedenis voegt ze `revisions` en `recoveryDrafts` toe, die alleen tellen wat deze import toevoegde, en `added`, `kept`, `replaced`, `copies` en `hidden` voor hoe elke creatie is samengevoegd. `skippedCheckpoints` telt checkpoints waarvan de id op het doel andere inhoud benoemt, en `historyLeftOut` telt oudere checkpoints en concepten die niet in de geschiedenisruimte van het apparaat pasten.
- Een replace-import voegt `removed` en `failedRemovals` toe.

Herstel is geen enkele transactie over de profiel-, sessie-, asset- en geschiedenisopslag. Cloudsync laat zijn toegepaste revisie **niet** vorderen na een gedeeltelijk of niet-ondersteund herstel, dus de kopie blijft beschikbaar om het opnieuw te proberen.

## Wat niet meereist

- **Catalogusbuffers** (gedownloade assetmetadata en blobs, de toolindex), die het doel gratis opnieuw synchroniseert.
- **Catalogustools en catalogusassets**, die buiten bereik vallen en op het doel als aanwezig worden verondersteld. Merktokens, lettertypen en logo's die de gebruiker toevoegde zijn gebruikersassets, dus die reizen wel mee.
- **`blob:`- en object-URL's**, die de brug bij het laden opnieuw genereert.
- **Conversie-originelen, live uitvoeringslease en machinelokale toegangs- of ondertekeningsgeheimen.** Deze zijn geen draagbare geschiedenis. Een opgeslagen resultaat is een kopie, geen belofte dat de oorspronkelijke bron is geback-upt.
- **De exportvolgteller**, de teller per dag voor de naamgeving van downloads in `localStorage` (`lolly-export-seq`). Hij blijft buiten `PREF_KEYS`, dus hij reist nooit in een bundel mee.

De opslagmeter toont dezelfde verdeling. Opgeslagen sessies, My images en File results & versions gaan in een bundel. De assetbuffer, toolvoorbeelden en offline pins eronder kunnen allemaal worden herbouwd, dus ze blijven achter.

![De opslagmeter die de gegevens van dit apparaat in benoemde categorieën verdeelt, met Saved sessions en My images apart bijgehouden van de Asset cache, hier op een verse installatie waar elke categorie nog leeg is](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&dark=1&filename=ce-storage-categories)

## Organisatiegegevens met Lolly Work

Deze bundel maakt een back-up van de persoonlijke bibliotheek van het apparaat. Het is geen back-up van een **Lolly Work**-instantie: organisatieaccounts, toegangsbeleid, gedeelde projecten, catalogusversies, goedkeuringen, renderjobs en auditrecords worden door die dienst bewaard. Verbind opnieuw en meld je aan om weer toegang tot gedeeld werk te krijgen; een persoonlijke bundel importeren verleent die toegang niet.

Beheerders maken back-ups van serverdata, bewaren en wissen ze met de eigen gidsen van Lolly Work: [Backup and restore](/info/work-operations.html#backup-and-restore) en [Work storage and data lifecycle](/info/work-data-lifecycle.html). Een apparaat wissen of exporteren doet geen van die serverbewerkingen.

## Over shells heen

`data-transfer.ts` leest en schrijft alleen via de capabilitybrug (`host.profile`, `host.state`, `host.assets`) en de gedeelde `localStorage`-voorkeuren. Dezelfde module leest en schrijft de gemeenschappelijke envelop op het web en in de desktop- en mobiele apps, over IndexedDB of bestandssysteemopslag. Optionele geschiedenisonderdelen verschijnen alleen waar hun adapter beschikbaar is, en een niet-ondersteund onderdeel wordt bij import als overgeslagen gemeld. De headless suite oefent de gemeenschappelijke onderdelen tegen een in-memorybrug, en geschiedenistransacties hebben ook tests in een echte browser.

Twee shells vallen buiten die garantie, om verschillende redenen:

- De **one-shot CLI** heeft niets mee te nemen: zijn status staat in het geheugen en duurt één aanroep.
- De **TUI** bewaart status in `~/.lolly` (sessies, mappen, profiel), en zijn Profile-weergave kan er een back-up van maken, maar schrijft een eenvoudiger eigen archief: `saved-state/<slot>.json` per sessie plus `profile.json` en `folders.json`, zonder manifest, zonder `formatVersion` of `minReader` en zonder integriteitstabel. Dit formaat kan het niet importeren (een lezer weigert het als "not a Lolly backup"), en de naam lijkt er verwarrend op (`lolly-backup-<stamp>.zip`). Beide verenigen is een bekende leemte.

## Nog niet draagbaar

De envelop is een manifest plus benoemde onderdelen, dus nieuwe soorten draagbare gegevens kunnen later als additieve onderdelen toetreden (een nieuwe `formatVersion`, dezelfde `minReader`), en de huidige lezers slaan over wat ze niet herkennen. Design systems reizen al op deze manier, als `design-systems.json` plus hun gebruikersassets.

Twee namen zijn gereserveerd voor gegevens die nog niet meereizen:

- **`tokens.json`** zou een heel [W3C DTCG](https://tr.designtokens.org/format/)-designtokensdocument dragen met zijn groepen, sets en thema's, het formaat dat [Penpot importeert en exporteert](https://help.penpot.app/user-guide/design-systems/design-tokens/). De eigen merktokens van een gebruiker reizen al mee als de asset `user/tokens/brand` in `assets.json`, en de tokens van een design system reizen mee met zijn record.
- **`penpot/`** is gereserveerd voor een ingelezen Penpot-bestand, of de voor Lolly relevante subset ervan, aangeboden als tool.

De huidige lezers kennen geen van beide namen. Zoals al het andere buiten de bovenstaande onderdelen zijn ze voor hen een onbekend onderdeel: onaangeroerd gelaten en geteld in `skipped`.

## Geschiedenisonderdelen

De twee geschiedenisonderdelen zijn optioneel en hebben hun eigen versies. De meeste lezers kunnen dit gedeelte overslaan.

::: details Creatiegeschiedenis (v3)
Handmatige back-ups van een webinstallatie met creatiegeschiedenis bevatten `revision-history.json`, met een eigen schema `{ version: 1, documents, revisions, recoveries }`. Het draagt de bewaarde id's, canonieke invoermomentopnamen, versiestempels, rastervoorbeelden en afzonderlijke schrijversconcepten. De geschiedenisadapter legt huidige sessies en hun koppen vast in één leestransactie, en `sessions.json` gebruikt dezelfde huidige momentopnamen voor oudere lezers.

Herstel controleert de payload-SHA-256 en bytetellingen, unieke identiteiten, document- en kopverhoudingen, afstamming, tijdstempels, voorbeeldtypen en limieten voordat het archief in één transactie wordt vastgelegd. Gecompacteerde ouderverwijzingen mogen ontbreken. Bestaand huidig werk wordt nooit stilzwijgend vervangen: wanneer een creatie aan beide kanten bestaat, wordt de kant die niet actueel blijft een beschermd concept.

De overdrachtslimiet van 384 MiB van het archief wordt expliciet gecontroleerd, en opslaglimieten worden afgedwongen zonder bewaarde checkpoints af te kappen. Export schrijft `revision-history.json` en `sessions.json` in stukken, met dezelfde bytes als één enkele `JSON.stringify` geeft, zodat de bestandstekst nooit als geheel wordt vastgehouden. Een geschiedenisbestand dat de limiet zou passeren wordt weggelaten op het moment dat het dat doet en vanaf daar alleen geteld. Het archief wordt dan opnieuw gemaakt zonder zijn oudste automatische checkpoints, en de exportsamenvatting telt die als `checkpointsLeftOut`, of het archief wordt als geheel geweigerd.

Een shell zonder deze capability herstelt gewone sessies en meldt het geschiedenisonderdeel als overgeslagen. Native bestandssysteemgeschiedenis blijft niet ondersteund totdat zijn adapter duurzame geschiedenistransacties levert. Gasten in een privécollab hebben geen duurzame geschiedenis of herstelarchief.

Persoonlijke momentopnamesync laat creatiegeschiedenis weg. Een momentopname toepassen op een lokaal document met geschiedenis bewaart zijn vorige werkstatus als apart herstelconcept en maakt het schrijftoken van elke open editor ongeldig. De onveranderlijke checkpoints blijven op het apparaat. Dit beschermt lokale geschiedenis tijdens het vervangen van een momentopname; het voegt gelijktijdige apparaatgeschiedenissen niet samen.

Historische assetverwijzingen blijven behouden, terwijl rendering assets nog steeds oplost via de bestaande bibliotheek van de bestemming. Dit archief garandeert nog niet de exacte oude assetbytes of oude toolrenders. Bytes van assetversies en bestandsresultaten reizen in hun eigen back-uponderdeel.
:::

::: details Opgeslagen versies en bestandsresultaten (v2)
Het optionele geschiedenisonderdeel bevat `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`, en lezers accepteren ook de eerdere vorm history-v1 zonder batches. Elke momentopname geeft de stabiele asset-id en exacte versie, het opslagtijdstip, de bytelengte en hex-SHA-256, plus een assetrecord waarvan `_file` en optioneel `_credentialFile` naar binaire onderdelen wijzen. Bewerkingen dragen de oorspronkelijke bestandsfeiten, het verzoek, het rapport, tijdstempels en optioneel een resultaat-`_file`. Namen van opslagbackends, OPFS-handles en uitvoeringsleases reizen niet mee. Lezers die alleen history v1 kennen weigeren de nieuwe geschiedenisversie voordat ze importeren, in plaats van het batchlidmaatschap stilzwijgend te laten vallen.

Batchmanifesten leggen elke geselecteerde bron vast vóór de verwerking, inclusief bestanden die nooit zijn gelezen, geannuleerde leden, mislukkingen bij het reserveren van resultaatruimte en onderbroken werk. Elk lid heeft een stabiele bewerkings-id, bronverwijzing en feiten, gevraagde uitvoernaam en eindrapport. Een ongelezen bron heeft aangegeven feiten, geen verzonnen digest. Import valideert lididentiteit en consistentie met een meegedragen bewerkingsrapport. Batchrapporten blijven beschikbaar wanneer afzonderlijke resultaten zijn verwijderd, maar een bon betekent niet dat de uitvoerbytes nog zijn opgeslagen.

- **Eerst valideren.** Elk bekend geschiedenisrecord, rapport en verwezen bestand wordt gevalideerd voordat een profiel- of assetimport schrijft. Ontbrekende bytes en afwijkende SHA-256 falen zelfs wanneer de envelop geen integriteitstabel heeft. Geëxtraheerde credentials blijven bytearrays, ook bij imports van oudere schrijvers die ze als objecten met numerieke sleutels serialiseerden.
- **Lopend werk.** Lopende bewerkingen worden onderbroken records in de back-up, met een verklarend foutrapport en zonder resultaat. Herstellen start nooit achtergrondwerk opnieuw of importeert een actieve lease. Opnieuw proberen betekent het oorspronkelijke bestand opnieuw kiezen, gecontroleerd tegen zijn vastgelegde SHA-256 wanneer beschikbaar.
- **Opslag.** Herstelde resultaten leggen hun bytes en metadata samen vast in IndexedDB. Gewone nieuwe resultaten gebruiken OPFS waar beschikbaar, met een IndexedDB-terugval. Een bestaande live bewerking wordt nooit door een import vervangen.
- **Back-uplimieten.** Export streamt deze bytes naar het archief, maar herstel pakt nog steeds een hele back-up in het geheugen uit, dus de limieten blijven: **256 MiB aan geschiedenispayload**, **4 MiB aan geschiedenismetadata**, hoogstens **100 bewerkingen**, **100 batches** en **2.000 momentopnamen**. Export weigert te grote of onvolledige geschiedenis expliciet en laat die nooit stilzwijgend weg. Download belangrijke versies en resultaten een voor een voordat je oudere lokale kopieën verwijdert. Deze limieten zijn geen gemeten garantie voor piekgeheugen op telefoons.
- **Lokale budgetten.** Lokale resultaatgeschiedenis heeft een budget van 512 MiB en een plafond van 100 records. Assetmomentopnamen hebben een apart budget van 512 MiB en hoogstens 20 historische versies per asset, en geëxtraheerde credentialbytes tellen mee voor dat budget. Herstel respecteert deze limieten en verdringt nooit stilzwijgend bestaande gebruikersgegevens.
- **Batchmetadata.** Lokale batchmetadata heeft een apart budget van 4 MiB, hoogstens 100 manifesten en 20 leden per batch. Wachtende leden reserveren metadatacapaciteit, met een rapportplafond van 32 KiB per lid. Dit is een logisch budget, geen garantie voor browserschijfruimte: een echte quotumfout wordt getoond, en het rapport in het geheugen blijft downloadbaar. Een batchlid opnieuw proberen maakt een nieuwe batch zonder het oude rapport te overschrijven. Een batchrecord verwijderen verwijdert geen afzonderlijke resultaatbytes of bibliotheekassets.
- **Resultaten in de bibliotheek.** Geconverteerde resultaten kunnen aan de bibliotheek worden toegevoegd zonder normalisatie of hercodering, met de bron- en uitvoerhashes en de bewerkingsrelatie erbij. Herhaald toevoegen hergebruikt een ongewijzigde kopie, en een bewerkte kopie wordt nooit overschreven. Rasterafbeeldingen kunnen een nieuw Design-document starten, dat de huidige asset-id van de bibliotheek gebruikt; exacte versiepins afdwingen in het hele runtime- en URL-pad van Design is apart werk. SVG-, HTML-, PDF- en ZIP-resultaten worden bewaard als ondoorzichtige bestandsassets, niet gepromoveerd tot vertrouwde interactieve of vectorinhoud.
- **Waar mensen dit zien.** **Convert → Recent file operations** toont geschiedenisgebruik, rapporten, downloads en het versiebeheer, dat ook eerdere versies van verwijderde bibliotheekassets vindt. Een momentopname herstellen maakt een nieuwe huidige versie en behoudt de geselecteerde momentopname. **Settings → Preferences → Storage** telt resultaten en versies apart van wegwerpbuffers.
- **Opschonen.** Expliciet opschonen van tijdelijke bestanden verwijdert alleen bytes die eigendom zijn van de bewerking en niet worden verwezen. Huidige records beschermen hun bestanden, en recente OPFS-bestanden hebben een uur respijt. Opgeslagen resultaten en assetmomentopnamen worden niet automatisch gewist.

Oudere lezers accepteren de v2-envelop nog steeds (`minReader: 1`) en herstellen de onderdelen die ze kennen, waarbij niet-ondersteunde geschiedenisonderdelen als overgeslagen worden geteld. Volledig geschiedenisherstel vereist een shell met de adapter `fileHistory`, een naad binnen de shell in plaats van een nieuwe capability `HostV1` voor tools. Echt herstel tussen twee apparaten wordt gedekt door de lokale Chromium-gate; herstel op geïnstalleerde desktop-, iOS- en Android-apps moet nog apart worden geaccepteerd.
:::

## Referentie

- Module: `shells/web/src/data-transfer.ts` (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION`; de namer `backupFilename()` is intern).
- Contracttest: `tests/data-transfer.test.ts`, die round trip, merge, integriteit, voorwaartse compatibiliteit en de lezerspoort dekt.
- Contracttests voor geschiedenis: `tests/file-history-backup.test.ts`, `tests/file-batch-history.test.ts` en `tests/file-result-library.test.ts`. Browseracceptatie: `tests/file-history.browser.test.ts`, `tests/file-batch-history.browser.test.ts` en `tests/file-result-reuse.browser.test.ts`.
- Gebruikt bruggenoppervlak: `host.profile`, `host.state` en `host.assets`; zie [Host API](/info/host-api.html).
