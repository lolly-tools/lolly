# Lolly en render-API's

_Laatst gecontroleerd: 5 november 2026._

Als je vandaag via een API afbeeldingen uit sjablonen genereert, zegt deze pagina wat er verandert als je die productie zelf draait: op je eigen apparaat, in CI of op een server die je zelf beheert. [Overstappen van een gehoste render-API](/info/work-move-from-render-api.html) is het hoe.

## Wat gehoste render-API's beter doen

[Bannerbear](https://www.bannerbear.com/) en [Placid](https://placid.app/) zijn beheerde diensten, en dat is een echt voordeel. Jij stuurt een verzoek en iemand anders draait de servers, houdt ze in de lucht en vangt de belasting op.

- **Niets om te beheren.** Geen server, database, opslag, updates of capaciteitsplanning.
- **Een gehoste sjablooneditor** met kant-en-klare sjablonen om aan te passen.
- **Meer soorten uitvoer uit één API.** Beide publiceren video- en PDF-endpoints, en Bannerbear documenteert ook geanimeerde uitvoer, WebP en AVIF, screenshots en AI-achtergrondverwijdering.
- **Hun eigen integraties en support.**

Als dat de opzet is die je wilt, zijn die diensten een goede keuze.

## Wat zelf hosten je geeft

- **Je inhoud blijft op je eigen systemen.** Inputs, assets en uitvoer staan op infrastructuur die je zelf koos. Renderen op een apparaat of in CI heeft helemaal geen dienst nodig.
- **De regels zitten in de tool.** Kleuren, typografie, logo's en vergrendelde inputs komen uit je [design system](/info/brand-studio.html), dus een aanroeper kan alleen veranderen wat jij toestaat. [Lolly Work](/info/compare.html#what-runs-where) past zichtbaarheid van tools en inputbeleid toe op elk verzoek.
- **Overal dezelfde tool.** Een tool rendert op een laptop, in een CI-job of op een server uit dezelfde inputs, en mensen kunnen dezelfde tool in de app bewerken.
- **Records die je zelf bewaart.** [Renderbewijzen](/info/work-renders.html#evidence-and-identity), een auditspoor en Content Credentials waar je een ondertekeningsidentiteit configureert.
- **Open source en geen meter.** Je draait de code, en waarvoor je betaalt is je eigen infrastructuur.

Je neemt het werk over dat die diensten voor je doen. Een duurzame server heeft een persistente database en uitvoeropslag nodig, en tools die een browser nodig hebben, hebben de Chromium-worker nodig. [Lolly Work installeren](/info/work-install.html) beschrijft beide.

## Hoe de klussen zich verhouden

| Klus | Gehoste render-API | Lolly |
|---|---|---|
| Een sjabloon vullen uit gegevens | API-verzoek dat een sjabloon en zijn lagen noemt | [URL](/info/url-mode.html), [CLI](/info/cli.html) of [server-API](/info/work-automation-api.html) die een tool en zijn inputs noemt |
| Veel bestanden uit een tabel | Batches en collecties | [Batch](/info/batch.html) op je apparaat, of [renderbatches](/info/work-renders.html#batches-with-durable-rows) op een server |
| Wachten op of pollen naar een resultaat | Pollen, of een synchrone optie | Duurzame renders die je pollt, of een directe render |
| Een webhook aanroepen als het klaar is | Ja | [Ondertekende callbacks](/info/work-renders.html) naar origins die je toestaat |
| Dynamische afbeeldings-URL | Ja | [Deellinks en `/render`-URL's](/info/url-mode.html) |
| Een sjabloon bewerken | Gehoste editor | [Design](/info/using.html), op je apparaat |
| Agents | Beide publiceren een MCP-server | [MCP](/info/mcp.html), met een organisatie-endpoint onder het beleid van een token op Lolly Work |

De eigen soorten uitvoer van Lolly staan in [Exporteren](/info/exporting.html). Op een Work-server maken duurzame renders vandaag SVG, PNG, JPG en PDF, en [video blijft op het apparaat, de CLI en MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Wat meegaat en wat niet

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Je verzoeken | De migratie-API van Work neemt dezelfde vorm aan | Hetzelfde | Hetzelfde |
| Je sjablonen | **Importeren** als bewerkbare documenten, behalve laagtypen zonder bevestigd schema | Alleen veldnamen en een voorbeeld. Bouw elk opnieuw op | Alleen veldnamen en een voorbeeld. Bouw elk opnieuw op |
| Bestaande dynamische URL's | Niet ondersteund | Niet ondersteund | Ondertekende URL's blijven werken na een hostwissel, met je oude privétoken |
| Webhooks | Geregistreerde webhooks worden niet ondersteund | `webhook_url` werkt | `webhook_success` werkt |
| WebP- en AVIF-uitvoer | Op naam geweigerd | Niet aangeboden | WebP op naam geweigerd |
| Animaties, video's, collecties, screenshots | Niet op de migratie-API | Niet op de migratie-API | Niet op de migratie-API |

Dit alles is gebouwd uit de openbare documentatie van elke leverancier en is niet uitgevoerd tegen een live account. [De overstapgids](/info/work-move-from-render-api.html#check-it-on-your-own-account) heeft een korte checklist als je er een hebt.

Overstappen is niet alles of niets. Je kunt één sjabloon verplaatsen en de rest laten waar het is, en [Lolly weer verlaten](/info/work-move-from-render-api.html#leave-lolly-too) blijft net zo open: tools zijn gewone bestanden en de CLI rendert ze zonder server.

## Wie de service draait

Met Lolly rendert een individu lokaal, of draait een team Lolly Work op zijn eigen infrastructuur. Een serverjob indienen stuurt zijn inputs en vereiste assets naar die instantie, wat anders is dan het pad op het apparaat.

Bannerbear en Placid zijn handelsmerken van hun eigenaren. Deze pagina beschrijft waar de producten overlappen, uit hun openbare documentatie, en is niet verbonden aan een van beide.
