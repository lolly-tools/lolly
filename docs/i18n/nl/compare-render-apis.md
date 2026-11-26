# Lolly en render-API's

_Laatst gecontroleerd: 5 november 2026._

Als je via een API afbeeldingen uit sjablonen genereert, vertelt deze pagina wat er verandert als je die productie op je eigen apparaat, in CI of op een server onder jouw beheer uitvoert. [Overstappen van een gehoste render-API](/info/work-move-from-render-api.html) geeft de stappen.

<!--i:eti-award-->
## Wat gehoste render-API's beter doen

[Bannerbear](https://www.bannerbear.com/) en [Placid](https://placid.app/) zijn beheerde diensten: je stuurt een verzoek en iemand anders beheert de servers.

- **Niets te beheren.** Geen server, database, opslag, updates of capaciteitsplanning.
- **Een gehoste sjablooneditor** met sjablonen die klaar zijn om aan te passen.
- **Meer uitvoertypen via één API.** Beide publiceren video- en PDF-endpoints, en Bannerbear documenteert ook geanimeerde uitvoer, WebP en AVIF, schermafbeeldingen en achtergrondverwijdering met AI.
- **Hun eigen integraties en ondersteuning.**

Als dat de opzet is die je wilt, zijn die diensten een goede keuze.

<!--i:eti-home-->
## Wat zelf hosten je oplevert

- **Je inhoud blijft op je eigen systemen.** Invoer, assets en uitvoer staan op infrastructuur die jij hebt gekozen. Renderen op een apparaat of in CI heeft geen dienst nodig.
- **De regels zitten in de tool.** Kleuren, typografie, logo's en vergrendelde invoer komen uit je [design system](/info/brand-studio.html), dus wie de tool aanroept kan alleen wijzigen wat jij toestaat. [Lolly Work](/info/compare.html#what-runs-where) past bij elk verzoek de zichtbaarheid van tools en het invoerbeleid toe.
- **Overal dezelfde tool.** Een tool rendert met dezelfde invoer op een laptop, in een CI-taak of op een server. Mensen kunnen dezelfde tool in de app bewerken.
- **Registraties in jouw beheer.** [Renderbewijzen](/info/work-renders.html#evidence-and-identity), een auditspoor en Content Credentials waar je een ondertekeningsidentiteit configureert.
- **Opensource en geen verbruikskosten.** Je draait de code en betaalt alleen voor je eigen infrastructuur.

Je neemt het werk over dat die diensten voor je doen. Een blijvende server heeft een persistente database en opslag voor de uitvoer nodig. Tools die een browser nodig hebben, hebben de Chromium-worker nodig. [Lolly Work installeren](/info/work-install.html) beschrijft beide.

<!--i:eti-table-->
## Hoe de taken zich verhouden

| Taak | Gehoste render-API | Lolly |
|---|---|---|
| Een sjabloon vullen met gegevens | API-verzoek dat een sjabloon en zijn lagen noemt | [URL](/info/url-mode.html), [CLI](/info/cli.html) of [server-API](/info/work-automation-api.html) die een tool en zijn invoer noemt |
| Veel bestanden uit een tabel | Batches en collecties | [Batch](/info/batch.html) op je apparaat of [renderbatches](/info/work-renders.html#batches-with-durable-rows) op een server |
| Wachten op een resultaat of het opvragen | Polling of een synchrone optie | Persistent opgeslagen renders die je opvraagt of een onmiddellijke render |
| Een webhook aanroepen na voltooiing | Ja | [Ondertekende callbacks](/info/work-renders.html) naar origins die je toestaat |
| Dynamische afbeeldings-URL | Ja | [Deellinks en `/render`-URL's](/info/url-mode.html) |
| Een sjabloon bewerken | Gehoste editor | [Design](/info/using.html), op je apparaat |
| Agents | Beide publiceren een MCP-server | [MCP](/info/mcp.html), met een organisatie-endpoint onder het beleid van een token op Lolly Work |

Lolly's eigen uitvoertypen staan in [Exporteren](/info/exporting.html). Op een Work-server maken persistent opgeslagen renders op dit moment SVG, PNG, JPG en PDF, en [video blijft op het apparaat, in de CLI en in MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Wat meegaat en wat niet

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Je verzoeken | De migratie-API van Work accepteert dezelfde structuur | Hetzelfde | Hetzelfde |
| Je sjablonen | **Import** als bewerkbare documenten, behalve laagtypen zonder bevestigd schema | Alleen veldnamen en een voorbeeld. Bouw elk sjabloon opnieuw | Alleen veldnamen en een voorbeeld. Bouw elk sjabloon opnieuw |
| Bestaande dynamische URL's | Niet ondersteund | Niet ondersteund | Ondertekende URL's blijven na een hostwijziging werken met je oude privétoken |
| Webhooks | Geregistreerde webhooks worden niet ondersteund | `webhook_url` werkt | `webhook_success` werkt |
| WebP- en AVIF-uitvoer | Op naam geweigerd | Niet aangeboden | WebP op naam geweigerd |
| Animaties, video's, collecties, schermafbeeldingen | Niet via de migratie-API | Niet via de migratie-API | Niet via de migratie-API |

::: note Gebouwd op basis van openbare documentatie
Dit is gebouwd op basis van de openbare documentatie van elke leverancier en is niet uitgevoerd met een live account. Als je een account hebt, bevat [de overstapgids](/info/work-move-from-render-api.html#check-it-on-your-own-account) een korte controlelijst.
:::

Je kunt één sjabloon verplaatsen en de rest laten staan. [Lolly verlaten](/info/work-move-from-render-api.html#leave-lolly-too) is net zo open: tools zijn gewone bestanden en de CLI rendert ze zonder server.

<!--i:eti-building-->
## Wie de dienst beheert

Met Lolly rendert iemand lokaal, of draait een team Lolly Work op zijn eigen infrastructuur. Een servertaak stuurt zijn invoer en benodigde assets naar die instantie. Het pad op het apparaat doet dat niet.

Bannerbear en Placid zijn handelsmerken van hun eigenaren. Deze pagina beschrijft waar de producten overlappen, op basis van hun openbare documentatie, en heeft geen banden met een van beide.
