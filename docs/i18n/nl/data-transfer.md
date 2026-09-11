# Gegevensoverdracht - de bundel `lolly-backup`

Alles wat een Lolly-gebruiker opbouwt, staat **op zijn apparaat** - geen account, geen cloud. De gegevensoverdrachtbundel is hoe die waarde verplaatst: exporteer hem op de ene installatie, draag het bestand op elke manier over (USB, AirDrop, e-mail naar jezelf, een netwerkschijf) en importeer hem op een andere. Het bestand *is* het transport. Het doel kan offline of online zijn. Het maakt geen verschil, want er wordt nooit met een server gepraat.

![De twee knoppen die een hele installatie verplaatsen: Mijn gegevens exporteren schrijft één zip, Gegevens importeren leest hem weer in](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Deze pagina is de formaatspecificatie. Voor de walkthrough voor eindgebruikers, zie [Using Lolly → Moving to another device](/info/using.html). De implementatie is [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), en [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) legt het round-trip-contract vast.

> **Scope.** Een bundel bevat *gebruikersgegevens*, geen tools. Tools en catalogusassets worden apart gesynchroniseerd en worden verondersteld al aanwezig te zijn op het doel (in het slechtste geval in een hogere versie). Importeren installeert of upgradet nooit een tool.

## Doelen

- <!--i:box--> **Eén formaat, elke shell.** Dezelfde bytes worden geproduceerd en gelezen door de web-PWA, de Tauri desktop-/mobiele apps en elke toekomstige shell. De bundel is het contract. De capability bridge van elke shell is de platformspecifieke adapter erachter.
- <!--i:shieldcheck--> **Overleeft de reis.** Een bundel die tijdens transport beschadigd of afgekapt raakt, faalt luid bij import, en herstelt nooit half.
- <!--i:clock--> **Overleeft deze versie.** Een oudere app kan nog steeds de herkende onderdelen van een nieuwere bundel importeren. Een echt breekend formaat wordt netjes geweigerd.
- <!--i:check--> **Veilig om samen te voegen.** Importeren op een installatie die al in gebruik is, wist nooit iets dat niet in de bundel zat.

## De envelop

Een bundel is een gewone `.zip`. De download wordt genoemd naar de persoon aan wie hij toebehoort - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (bijvoorbeeld `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - zodat een Downloads-map vol back-ups leesbaar blijft. De voor- en achternaamdelen komen uit het profiel en worden weggelaten wanneer ze niet zijn ingesteld. Geen profiel geeft `LollyTools-2026-06-26-1.zip`, en alleen een voornaam geeft `LollyTools-Ada-2026-06-26-1.zip`. Elk deel wordt gesaneerd tot een bestandsnaamveilig token (Unicode-letters/cijfers blijven behouden, spaties/leestekens worden verwijderd, gelimiteerd tot 32 tekens). `<n>` is een volgnummer per dag, per apparaat, zodat herhaalde exports op dezelfde dag niet botsen en in volgorde blijven. `backupFilename()` in [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) bouwt de naam. De inhoud van de zip is identiek, ongeacht de naam. Binnenin:

| Pad | Vereist | Inhoud |
|---|---|---|
| `manifest.json` | ja | Formaat-id, versies, aantallen en integriteit per onderdeel. Het eerste waar een lezer naar kijkt. |
| `profile.json` | indien ingesteld | Het `me`-record van de gebruiker (naam, contactgegevens, referentie naar pasfoto, vlaggen). Gelezen via `host.profile`. |
| `sessions.json` | ja | Elke opgeslagen sessie: slot, tool-id/versie, label, thumbnail (data-URL) en volledige invoergegevens. Gelezen via `host.state`. |
| `assets.json` | ja | Metadata voor elke geüploade asset (afbeeldingen, lettertypen, merktokens), elk wijzend naar de bijbehorende bytes onder `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per asset | De ruwe assetbytes (afbeeldings- en lettertypebestanden). Opgeslagen ongecomprimeerd (reeds gecomprimeerde formaten). De extensie is cosmetisch. De MIME in `assets.json` is leidend. |
| `prefs.json` | ja | Door de gebruiker eigen lokale voorkeuren: `theme`, `sidebarWidth` en de activiteitsteller `ct-metrics`. |
| `lolly.txt` | ja | Een leesbare samenvatting van de bundel (aantallen, profiel, bestandsnaam) voor iedereen die de zip opent zonder Lolly. Opnieuw gegenereerd bij elke export en herkend bij import, dus het telt nooit als een overgeslagen onderdeel. Het wordt geschreven *na* de integriteitskaart, dus het valt daarbuiten. |

De bundel is bewust een gewone zip: hij overleeft elk transport intact, en elke unzip-tool kan hem inspecteren.

`profile.json` is het kleinste onderdeel en het onderdeel dat een lezer in de app als eerste ziet: de gegevens die een producent één keer invult, plus de opt-in die tools toestaat ze te gebruiken.

![Het formulier Profielgegevens dat profile.json wordt - naam, contactgegevens, pasfoto en de opt-in ernaast](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 1,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.webp": "sha256-…",
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

Importeren is **samenvoegen-overschrijven**, nooit alles-vervangen:

- Bestaande gegevens op het doel blijven staan.
- Elke sleutel die botst - het profiel, een sessieslot, een geüpload afbeeldings-id - wordt vervangen door de geïmporteerde kopie.
- Niets dat niet in de bundel zat, wordt aangeraakt. Een sessie die het doel had maar de bundel niet, overleeft de import.

Opgeslagen sessies koppelen automatisch opnieuw aan hun afbeeldingen: assetreferenties worden bijgehouden op id, en de bridge lost ze opnieuw op nadat de geüploade afbeeldingen zijn hersteld (dat moet toch al, omdat `blob:`-URL's een herlaad niet overleven).

De importsamenvatting rapporteert `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` telt geüploade assets die niet konden worden hersteld (bijvoorbeeld apparaatopslag vol). Dit staat los van `skipped`, dat onderdelen telt van een achterwaarts-compatibele nieuwere schrijver die deze build niet herkende. De UI toont `skipped` ("… · N nieuwere items overgeslagen"), zodat het herstel eerlijk is over wat er is achtergelaten.

## Wat niet meereist

- **Catalogus-caches** (gedownloade assetmetadata en blobs, de tool-index) - gratis opnieuw gesynchroniseerd op het doel.
- **Tools en merkassets** - buiten scope, en verondersteld al aanwezig op het doel.
- **`blob:`-/objectURL's** - opnieuw gegenereerd door de bridge bij het laden.
- **De exportvolgordeteller** - de naamgevingsteller per dag voor downloads (`localStorage`-sleutel `lolly-export-seq`) is een lokaal naamgevingsgemak. Hij wordt buiten `PREF_KEYS` gehouden, dus hij reist nooit mee in een bundel.

De opslagmeter splitst hetzelfde op. Opgeslagen sessies en Mijn afbeeldingen reizen mee in een bundel. De assetcache, tool-previews en offline pins eronder zijn allemaal opnieuw af te leiden, dus die blijven achter.

![De opslagmeter die de gegevens van dit apparaat onderverdeelt in benoemde categorieën, met Opgeslagen sessies en Mijn afbeeldingen apart bijgehouden van de Assetcache, hier op een verse installatie waar elke categorie nog leeg is](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Garantie over shells heen

`data-transfer.ts` leest en schrijft uitsluitend via de capability bridge (`host.profile`, `host.state`, `host.assets`) en de gedeelde `localStorage`-voorkeuren. Omdat de bridge de enige naad is, produceert dezelfde module een byte-identieke bundel op elke shell, ook al verschilt de onderliggende opslag - IndexedDB op web, het bestandssysteem op Tauri. De Tauri-shells hergebruiken deze module ongewijzigd. Alleen hun `host.state`-implementatie verschilt. De headless test doorloopt de volledige round-trip tegen een in-memory bridge, en daarom staat die voor ze allemaal.

Twee shells vallen buiten die garantie, om verschillende redenen:

- De **one-shot CLI** heeft niets mee te dragen - zijn status is in-memory en vluchtig per aanroep.
- De **TUI** houdt wel status bij (`~/.lolly`: sessies, mappen, profiel) en de Profielweergave ervan kan hem back-uppen, maar schrijft daarbij een *eenvoudiger* eigen archief: `sessions/<slot>.json` per sessie plus `profile.json` en `folders.json`, zonder manifest, zonder `formatVersion`/`minReader` en zonder integriteitskaart. Het is **niet** importeerbaar met dit formaat - een lezer wijst het af als "geen Lolly-back-up" - en verwarrend genoeg gebruikt het een vergelijkbare naam (`lolly-backup-<stamp>.zip`). De twee samenvoegen is een bekend gat.

## Gereserveerde uitbreidingspunten

De envelop is met opzet een manifest plus een set benoemde onderdelen, zodat nieuwe soorten overdraagbare gegevens er later op kunnen meerijden **zonder breekende wijziging**. Ze passen in als additieve onderdelen (nieuwe `formatVersion`, dezelfde `minReader`), en de huidige lezer slaat over wat hij niet herkent. Dit staat op de [roadmap](/info/overview.html#roadmap), nog niet geïmplementeerd. De namen zijn hier gereserveerd zodat het formaat coherent blijft wanneer ze landen.

- **`tokens.json` - designtokens.** Een [W3C DTCG](https://tr.designtokens.org/format/)-designtokensdocument (het formaat dat [Penpot importeert en exporteert](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens met `$value`/`$type`/`$description`, georganiseerd in groepen, sets en thema's). Een tokenset in de bundel laat een gebruiker zijn merkprimitieven tussen installaties verplaatsen samen met zijn sessies. Op langere termijn wordt een ingelezen tokenset een volwaardige bron waartegen tools en paletassets resolven.
- **`penpot/` - ingelezen Penpot-bestanden.** Een gereserveerde map voor een Penpot-bestand (of de geëxtraheerde, voor Lolly relevante subset ervan) dat ingelezen en getoond wordt *als tool*. De bundel zal de ingelezen definitie bevatten, zodat die meereist met de rest van de gegevens van de gebruiker.

Alles buiten deze gereserveerde namen en de bovenstaande onderdelen is voor een lezer een onbekend onderdeel: ongemoeid gelaten en meegeteld in `skipped`.

## Referentie

- Module: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - de naamgever `backupFilename()` is intern).
- Contracttest: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - round-trip-, samenvoeg-, integriteits-, achterwaarts-compatibiliteits- en lezergrendelcases.
- Gebruikt bridge-oppervlak: `host.profile`, `host.state`, `host.assets` - zie [Host API](/info/host-api.html).
