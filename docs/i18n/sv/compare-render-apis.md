# Lolly och renderings-API:er

_Senast kontrollerad: 28 september 2026._

Om du genererar bilder från mallar genom ett API i dag säger den här sidan hur Lolly gör samma jobb på din egen enhet, i CI eller på din egen server.

## Vad värdbaserade renderings-API:er gör bättre

[Bannerbear](https://www.bannerbear.com/) och [Placid](https://placid.app/) paketerar rendering som hanterade tjänster, med egen infrastruktur, egna integrationer och eget stöd. Du skickar en begäran och någon annan kör servrarna.

## Där de överlappar

Båda gör en mall plus indata till media. Lolly tar indata från en [länk](/info/url-mode.html), [CLI](/info/cli.html), ett batchrutnät eller en serverslutpunkt.

## Hur Lolly gör det överlappande jobbet

Samma verktyg renderas på en bärbar dator, i ett CI-jobb eller på en server, från samma indata. Lokal rendering och CI-rendering behöver ingen tjänst alls.

![Exportinställningar för Batch: filnamn, standardformat, enheter, DPI och antalet rader att rendera](/info/shots/use-batch-toolbar.svg)

På en server kör [Lolly Work](/info/compare.html#what-runs-where) Lolly-motorn bakom ett API och tillämpar verktygssynlighet och indatapolicyer. Dess [återställningsbara renderingstjänst](/info/work-renders.html) stöder enstaka jobb och batchar, idempotent inskickning, status, begränsade omförsök, avbrytande och bevarad utdata, och avbrutet arbete återupptas efter en omstart när beständig lagring är konfigurerad.

Servern har en snabb SVG- och PNG-väg och en valfri Chromium-worker för verktyg som behöver en webbläsare. Automatisering loggar in med tjänsttoken, färdig utdata kan gå genom [godkänd leverans](/info/work-delivery.html) till organisationsdestinationer, och en konfigurerad signeringsidentitet lägger till Content Credentials på utdata som stöds.

## Vem som driver tjänsten

Med Lolly renderar en individ lokalt, eller så kör ett team Lolly Work på sin egen infrastruktur. Att skicka in ett serverjobb skickar dess indata och nödvändiga tillgångar till den instansen, vilket skiljer sig från vägen på enheten. En varaktig tjänst behöver en beständig databas och utdatalagring, och verktyg som beror på webbläsaren behöver Chromium-workern; [Install Lolly Work](/info/work-install.html) beskriver båda.

Bannerbear och Placid är varumärken som tillhör sina ägare. Den här sidan beskriver var produkterna överlappar och är inte knuten till någondera.
