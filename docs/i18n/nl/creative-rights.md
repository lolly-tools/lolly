# Creatieve rechten, naamsvermeldingen en wat van jou blijft

Je zou goed werk van anderen moeten kunnen gebruiken zonder een expert in licenties te worden, en zonder stilletjes de mensen die het maakten te laten vallen. Daarom houdt Lolly de bron bij van elk werk dat het gebruikt, leest het de licentie die ervoor is vastgelegd, bepaalt het wat die licentie vraagt van het gebruik dat jij daadwerkelijk maakt, doet het het deel dat een programma kan doen, en benoemt het het deel dat alleen jij kunt doen.

Niets hiervan is juridisch advies en niets ervan is een uitspraak over jouw project. Lolly legt feiten vast, past een kleine set regels toe die uit de eigen juridische teksten van de licenties zijn gelezen, en toont zijn werkwijze. Een licentie met voorwaarden is een normale, toegestane keuze. Ze wordt nooit gepresenteerd als een kapotte asset.

## Drie feiten, apart gehouden

"CC BY 4.0", "dit gebruik heeft een naamsvermelding nodig" en "de naamsvermelding staat in het bestand dat je zojuist hebt gedownload" zijn drie verschillende uitspraken, en Lolly houdt ze apart:

- **Bewijs** is wat een bron heeft verklaard, vastgelegd zoals het werd aangetroffen, met wie het zei en waar het werd gelezen. Een latere import overschrijft nooit een eerdere vastlegging.
- **Verplichting** is wat de beoordeelde regels van dat bewijs maken voor één gebruik, één afleverroute en één publiek. Deelvoorwaarden blijven voorwaardelijk zolang je privé werkt.
- **Aflevering** is wat de afgewerkte bytes daadwerkelijk dragen, gemeten door ze terug te lezen. Lolly zegt pas dat naamsvermeldingen zijn opgenomen nadat een lezer ze in het afgeleverde bestand heeft aangetroffen.

## Waar je dit als eerste tegenkomt

De emojisets zijn het dagelijkse geval. Twemoji is CC BY 4.0, dus een kop met een emoji erin exporteert met de artwork gecrediteerd en niets wat jij nog hoeft te doen. Beide OpenMoji-sets zijn CC BY-SA 4.0, dus het herkleuren van een van hun glyphs met een merkbehandeling is een bewerking, en het delen van die bewerking vraagt je eenmalig een compatibele licentie te kiezen. Het kiezen van de set wordt nooit geblokkeerd, en de setbesturing noemt de licentie op de plek waar je kiest. Dezelfde regels gelden voor een catalogusillustratie, een LUT, een lettertype en elk ander vastgelegd werk.

## De woorden die Lolly gebruikt

Eén vocabulaire over het exportpaneel, Verify, de commandoregel en het machineresultaat heen.

| Wat je ziet | Wat het betekent |
|---|---|
| Bronvermeldingen worden opgenomen. | De naamsvermelding is klaargezet en de route kan haar dragen. Er is nog niets geschreven, dus dit is geen succesbericht. |
| Naamsvermeldingen opgenomen in de metadata van dit bestand. | De afgeleverde bytes zijn teruggelezen, de credential is geverifieerd en elke vereiste bron is erin aangetroffen. |
| Naamsvermeldingen en credentials zitten in het downloadpakket. | De naamsvermelding reist mee als begeleidend bestand naast de artifact. Houd ze samen wanneer je ze doorgeeft. |
| Voeg deze naamsvermelding toe aan de postbeschrijving. | De gekozen route draagt geen credential en geen leesbare naamsvermelding, dus de vermeldingstekst is aan jou om te plakken. |
| Als je deze bewerking deelt, heeft ze een compatibele licentie nodig. | Een ShareAlike-bron is gewijzigd en het resultaat is op weg naar iets anders dan privégebruik. Kiezen is één actie, geen dialoog per plaatsing. |
| Bronlicentie niet vastgelegd. | Er is niets vastgelegd voor deze bron. Dat is een gat om te vullen, geen bevinding tegen het werk. |
| Voorwaarden vastgelegd, nog niet geïnterpreteerd. | De identifier wordt herkend en de voorwaarden ervan staan vermeld, en geen enkele regel hier leest ze. Geen automatische goedkeuring, geen automatisch verbod. |
| Twee licentieverklaringen spreken elkaar tegen. | Twee vastleggingen noemen verschillende licenties en niets heeft bepaald welke verlening van toepassing is. |
| Geen vereiste naamsvermelding onder de vastgelegde CC0-afstandsverklaring. | De afstandsverklaring vraagt niets. Een naamsvermelding uit beleefdheid wordt sowieso aangeboden. |
| De naamsvermeldingen zitten niet in het bestand dat is afgeleverd. | Er was een naamsvermelding beloofd, de terugleesactie heeft haar niet aangetroffen, en het bestand is nog steeds van jou. Exporteer opnieuw, of gebruik de vermeldingstekst handmatig. |

Lolly gebruikt niet "auteursrecht geverifieerd", "juridisch veilig", "volledig vrijgegeven" of "rechten vrijgegeven", en er is nergens in het product een groene licentiebadge. Die woorden zouden iets beweren dat geen enkel programma kan controleren.

## De licenties die Lolly heeft beoordeeld

Regelversie `rights-rules-2026-09-13.2`. Elke regel hieronder is gelezen uit de eigen juridische tekst van de licentie, en het artikel waar hij vandaan komt wordt ernaast geciteerd, zowel in `engine/src/rights-profiles.ts` als hier. Een versie en een port worden bewaard zoals vastgelegd: een CC BY 3.0-verklaring behoudt zijn eigen versie in plaats van gerapporteerd te worden als 4.0 omdat de kiezer van de app 4.0 verkiest.

| Licentie | Wat ze vraagt van een gebruik dat Lolly kan maken | Gelezen uit |
|---|---|---|
| CC BY 4.0 | De maker, de titel, de auteursrechtvermelding, de naam en link van de licentie, de bronlink en een aanduiding van wijzigingen, elk wanneer de bron dat aanleverde. Geen gebruik is uitgesloten, commercieel gebruik inbegrepen. | [Wettekst](https://creativecommons.org/licenses/by/4.0/legalcode.en), secties 2(a)(1) en 3(a) |
| CC BY-SA 4.0 | Dezelfde naamsvermelding. Bovendien, als je een bewerking deelt, gaat ze uit onder een compatibele licentie: CC BY-SA 4.0, de Free Art License 1.3, of GPL-3.0-or-later, die maar één kant op werkt. Die drie worden als data meegevoerd uit de Creative Commons-lijst, nooit op naam gematcht. | [Wettekst](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), secties 3(a) en 3(b); de [lijst met compatibele licenties](https://creativecommons.org/compatible-licenses/) |
| CC0 1.0 | Niets. De afstandsverklaring draagt geen voorwaarde, dus Lolly biedt een naamsvermelding uit beleefdheid aan en presenteert er nooit een als verplicht. | [De afstandsverklaring](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en), secties 2 en 3; de [CC FAQ](https://creativecommons.org/faq/) over crediteren |
| CC-PDDC | Niets. Wat wordt vastgelegd is de bewering zelf en wie haar deed, omdat een certificering de verklaring van één partij is en geen bewijs. | [De afstandsverklaring en certificering](https://creativecommons.org/licenses/publicdomain/) paragrafen |
| Apache License 2.0 | De vermeldingen uit de bron en de attributietekst van het NOTICE-bestand reizen mee met een verspreid werk. Een runtime-gebruik vraagt niets. Een licentie die om een vermeldingstekst vraagt en een werk dat er geen draagt, wordt gerapporteerd als een gat. | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), sectie 4, voorwaarden 1 tot en met 4 |
| MIT | De auteursrechtregel en de toestemmingsvermelding reizen mee met kopieën en substantiële delen. Runtime- en referentiegebruik vragen niets. | [MIT](https://opensource.org/license/mit), de voorwaarde van de toestemmingsvermelding |
| SIL OFL 1.1 | Tekst renderen met het lettertype vraagt niets van de tekst. Het doorgeven van het lettertypebestand draagt de licentie, de auteursrechtvermelding en de regel voor voorbehouden namen mee. | [OFL 1.1](https://openfontlicense.org/open-font-license-official-text/), voorwaarden 2, 3 en 5; de [OFL FAQ](https://openfontlicense.org/ofl-faq/) over documenten |

### Vastgelegd, niet geïnterpreteerd

CC BY-NC, CC BY-ND en de NC-SA- en NC-ND-combinaties worden herkend, hun voorwaarden staan vermeld, en geen enkele regel hier leest ze. Ze rapporteren `licence.unknown` met een regel die de voorwaarden noemt. Een commerciële context kan niet worden afgeleid uit een prijs of een account, en elke gecombineerde tekst heeft zijn eigen beoordeling nodig voordat een regel hem aanraakt.

Nog drie eerlijke antwoorden, waarvan geen enkele toestemming is:

- Een `LicenseRef-`-identifier komt terug als zichzelf. Hij verwijst naar een opgeslagen definitie en is nooit proprietary op grond van zijn spelling.
- Een verklaring die niets herkent komt ongeparseerd terug, met de oorspronkelijke tekst ernaast bewaard.
- `A OR B` is een keuze die de rechthebbende aanbood, dus elk alternatief wordt geretourneerd en geen enkele wordt geselecteerd. `A AND B` is cumulatief, en deze regels leggen dat vast in plaats van twee profielen samen te lezen.

Ontbrekende licentie-informatie wordt nooit gelezen als bewijs dat een werk vrij is om door te geven.

## Wat Lolly voor je doet

- **In de catalogus.** Het blad van een werk toont de bron en de maker ervan, de canonieke licentienaam met het originele label eronder bewaard, een kopieerbare naamsvermelding waar er een is vastgelegd, en één regel die zegt wat het gebruik ervan vraagt. Een tegel stelt de vereiste vast; ze beweert nooit dat een export is voltooid.
- **In het exportpaneel.** Een kaart Bronvermeldingen verschijnt binnen Inhoudsbescherming zodra een render vastgelegd werk gebruikt, naast de Licentie die je kiest voor je eigen export. Ze toont de status, de vermeldingstekst achter Details, een knop Naamsvermelding kopiëren, en een inline kaart wanneer een beslissing openstaat. Een beslissing is nooit een blokkerende dialoog: een download met nog een actie te gaan gaat gewoon door, en privéwerk blijft bruikbaar.
- **In het bestand.** Een export die vastgelegd werk heeft geplaatst, schrijft één Content Credentials-bronbestanddeel per afzonderlijk werk, gebonden aan de originele bytes op hun publieke adres, met de maker, de licentie en zijn link, de bron, de revisie en de wijzigingen. Lolly ondertekent wat het heeft waargenomen. Het ondertekent nooit een claim namens de bovenstroomse kunstenaar, en Verify zegt welke van de twee het was.
- **Na het schrijven.** De afgeleverde bytes worden teruggelezen voordat iets zegt dat naamsvermeldingen zijn opgenomen. Een credential die niet verifieerde telt niet als een afgeleverde naamsvermelding.
- **In een bewerkbaar `.lolly`-bestand.** Bytes reizen mee alleen wanneer een beoordeelde licentie toestemming vastlegt om de bron door te geven, en het `CREDITS.txt`-bestand van het pakket somt op wat is meegereisd, onder welke licentie, en wat is achtergehouden met de reden. Een niet-vastgelegde licentie wordt achtergehouden. Je kunt achtergehouden inhoud nog steeds bewust opnemen, en het naamsvermeldingsbestand legt vast dat het jouw keuze was.
- **In Verify.** Een paneel Bronnen somt elke bron op die een bestand vastlegt, met een berekende samenvatting, de naamsvermelding, een knop Naamsvermelding kopiëren, een link Bron openen die alleen op verzoek wordt geopend, en de vermelde grenzen van wat is geïnspecteerd. Een vraag Controleren voor dit gebruik wordt alleen gesteld wanneer je een gebruik kiest, en er wordt niets opgehaald om haar te beantwoorden.
- **Wanneer je metadata verwijdert.** Strippen vertelt je hoeveel bronvermeldingen het bestand niet langer draagt, biedt de vermeldingstekst aan, en biedt een schoon bestand aan met de naamsvermeldingen ernaast. Gestripte bytes worden nooit opnieuw gestempeld.

## Wat van jou blijft

- **Jouw licentiekeuze is van jou.** Een bestand claimen scheidt drie toestanden die ooit één waren: geen publieke licentie verklaard, een expliciete alle-rechten-voorbehouden-vermelding, en een daadwerkelijke publieke licentieverlening. Lolly schrijft een rechtenregel alleen voor de laatste twee, en nooit vanuit je profiel.
- **Jouw werk wordt niet voor je geherlicentieerd.** De voorwaarden van een bron en je eigen outputverklaring zijn gescheiden vastleggingen. Een ShareAlike-voorwaarde geldt voor de bewerking die ze regelt, niet automatisch voor al het andere dat je hebt gemaakt.
- **Privéwerk blijft bruikbaar.** Voorwaarden die gelden bij delen worden opgeworpen wanneer delen in beeld komt. Niets hier verandert in een importverbod, en geen enkele licentievragenlijst staat tussen jou en je eigen bestanden.
- **Een beslissing wordt onthouden tegen haar eigen feiten.** Elke keuze die je vastlegt, wordt gestempeld met een vingerafdruk van de werken, gebruiken, route en publiek waarover ze ging. Verander de set, de behandeling, het formaat of het publiek en de vraag wordt opnieuw gesteld. Er is geen alomvattende "licenties negeren"-schakelaar, omdat het wegklikken van een waarschuwing geen naamsvermelding kan afleveren of geen toestemming kan verlenen.
- **Jouw gegevens blijven gescheiden van de naamsvermelding van een derde.** Het verwijderen van je eigen persoonlijke metadata verwijdert geen gecrediteerde kunstenaar, en een vereiste naamsvermelding is nooit een excuus om je contactgegevens te exporteren.

## Op de commandoregel

Een render drukt een `Rights:`-blok af naar standaardfout wanneer de beoordeling een vereiste naamsvermelding of een probleem heeft. Het draagt de status, één regel per probleem als `code - summary`, wat het afgeleverde bestand bij teruglezing bleek te zijn, en de vermeldingstekst om te plakken.

```
Rights: actions-required
  licence.adaptation-choice - If you share this adaptation, it needs a compatible licence.
  Credential intact. It records 1 source. The exporter recorded it; the source did not sign a credential of its own.
  Credits included in this file's metadata.
  "water wave (OpenMoji Color 17.0.0)" by Vanessa Boutzikoudi (OpenMoji), CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/, source https://raw.githubusercontent.com/hfg-gmuend/openmoji/f9fc506a3f913be9897ab0181d611d4c910a4104/color/svg/1F30A.svg, changes: recoloured.
```

Die twee uitspraken staan los van elkaar, en dat is precies het punt van ze apart te houden: de naamsvermelding staat in het bestand, en een licentiebeslissing staat nog open voordat het bestand wordt gedeeld. Het bestand wordt hoe dan ook geschreven.

| Status | Betekenis | Exit |
|---|---|---|
| `ready` | Niets wacht op een persoon. | 0 |
| `actions-required` | Er blijft een beslissing openstaan voordat het bestand wordt gedeeld. Het bestand wordt nog steeds geschreven. | 4 |
| `use-not-covered` | Een beoordeelde regel zegt dat de licentie dit gebruik niet dekt. | 4 |
| `unknown` | De enige problemen zijn gaten: een licentie die niet is vastgelegd, of voorwaarden die niet zijn geïnterpreteerd. | 0 |
| `delivery-failed` | Ingesteld door een ontvangstbevestiging, nooit door een beoordeling: een beloofde naamsvermelding is niet aangetroffen in de afgeleverde bytes. Het exportpaneel toont het; de CLI rapporteert hetzelfde feit in plaats daarvan in zijn terugleesregel. | niet afgedrukt |

Exit 4 is de code die deze CLI al geeft aan een beschermende controle die nee zei. Het is bewust geen 3, wat "opnieuw proberen op een andere runner" betekent, want een licentiebeslissing zal op elke runner die er is blijven wachten.

`--rights=private` verklaart dat deze render aan niemand wordt afgeleverd. Het blok wordt nog steeds afgedrukt en de naamsvermelding staat er nog steeds om te kopiëren; wat vervalt is de voorwaarde die geldt bij delen, en er wordt geen afleverclaim vastgelegd. Er is geen vlag om een voorwaarde te negeren: `--rights=ignore` is een gebruiksfout.

De probleemcodes zijn stabiel en machineleesbaar, onafhankelijk van de vertaalde tekst:

`attribution.source-missing`, `attribution.delivery-missing`, `licence.adaptation-choice`, `licence.use-not-covered`, `licence.grant-conflict`, `licence.unknown`, `source.redistribution-unknown`, `credential.ingredient-missing`.

Via MCP retourneert `lolly_verify` een `rights`-payload met de samenvatting, één rij per vastgelegde bron en de vermelde grenzen; een browservrije `lolly_render` retourneert `status`, `issues`, `credits`, `fingerprint` en een `creditsInFile`-vlag die wordt gemeten door de bytes terug te lezen.

## Waar de regels leven

Vier engine-modules, allemaal puur: geen netwerk, geen klok, geen bestandssysteem. De regeldata is geversioneerd en zit in de repository, nooit opgehaald.

| Module | Wat hij bevat |
|---|---|
| `engine/src/rights-profiles.ts` | De identifiertabel, de minimale SPDX-expressielezer, de beoordeelde profielen met hun citaten, en de ene regel voor een link die een naamsvermelding mag afdrukken. |
| `engine/src/rights-evaluate.ts` | Classificatie, problemen, het attributieplan en de vingerafdruk. Deterministisch: dezelfde feiten in een andere volgorde geven hetzelfde antwoord. |
| `engine/src/rights-attribution.ts` | Leesbare naamsvermeldingen, de begeleidende bestanden, de bronbestanddelen en de ontvangstbevestiging gemeten na het schrijven. |
| `engine/src/rights-report.ts` | Een geverifieerde credential teruggelezen als de drie vragen die Verify stelt. |

De verwachtingsbestanden in `tests/fixtures/rights/` zijn geschreven vanuit de licentieteksten in plaats van vanuit de output van de beoordelaar, en de README ervan citeert de sectie achter elke verwachting.

## Wat dit niet doet

Botweg gesteld, omdat een gat dat niet wordt benoemd, leest als een belofte.

- **NC en ND worden niet geïnterpreteerd.** Hun voorwaarden worden vastgelegd en gerapporteerd als onbekend.
- **Geen bestemming wordt bevestigd.** Lolly bereidt een onderschrift voor; een connector die een verzoek accepteert is geen bewijs dat een naamsvermelding een lezer heeft bereikt, en niets hier belooft dat een latere upload, screenshot of transcodering verborgen metadata behoudt.
- **Native metadatavelden voor naamsvermelding worden niet vanuit het plan geschreven.** Naamsvermeldingen reizen mee in Content Credentials en in leesbare tekst. De IPTC- en XMP-velden voor naamsvermelding per bron worden nog niet vanuit het attributieplan ingevuld.
- **Correcties en intrekking zijn niet gebouwd.** Het toevoegen van een ontbrekende maker of een lokale correctie aan een vastgelegd werk, en het intrekken van een vastlegging, hebben geen interface.
- **Gekoppelde providers zijn niet gebouwd.** Gekochte stock, een aangepaste toestemming en een provideraccount hebben geen importpad, dus hun verleningen kunnen alleen worden vastgelegd als jouw eigen verklaring.
- **Organisatiebeleid wordt niet samengesteld met deze resultaten.** Exportbeleid en licentievoorwaarden zijn vandaag gescheiden, en een organisatiegoedkeuring is geen toestemming van een rechthebbende.
- **Verschillende afleverroutes zitten nog niet op dit pad.** Het downloaden van een catalogusorigineel, een bulk-ZIP, een afgeleide download, Verzenden en Afbeelding kopiëren beoordelen of dragen deze naamsvermeldingen nog niet.
