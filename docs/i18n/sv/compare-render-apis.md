# Lolly och renderings-API:er

_Senast kontrollerad: 28 september 2026._

Lolly genererar resurser från mallar och data på din enhet, i CI eller via [lolly.work](https://lolly.work)s server-API. Den kombinerade lösningen täcker automatiserad rendering såväl som identiteten, policyerna och leveransen kring en organisations produktionsjobb.

## Där de överlappar

[Bannerbear](https://www.bannerbear.com/) och [Placid](https://placid.app/) genererar bilder och andra medier från mallar via API:er och integrationer. Lolly använder samma tillvägagångssätt med en mall plus indata, med [URL-läge](/info/url-mode.html), [CLI](/info/cli.html), ett batchrutnät och serverslutpunkter som sätt att skicka in arbete.

## Vad lolly.work erbjuder

lolly.work är den separat driftsatta organisationstjänsten i Lolly-projektet. Den kör Lolly-motorn bakom ett API, tillämpar verktygssynlighet och indatapolicyer samt levererar renderade filer och signerade delningslänkar. Dess [återställningsbara renderingstjänst](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) stöder enskilda jobb och batchar, idempotent inskickning, status, begränsade omförsök, avbrytande och sparade utdata. Avbrutet arbete kan återupptas efter en serveromstart när beständig lagring är konfigurerad.

Servern använder en snabb SVG/PNG-renderingsväg och en valfri Chromium-worker för verktyg som behöver en webbläsare. Automatisering autentiseras med tjänsttokens, och färdiga utdata kan skickas via [styrd leverans](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) till organisationens mål. En konfigurerad signeringsidentitet möjliggör C2PA-signering av serverutdata som stöds.

## Vem som driver tjänsten

Bannerbear och Placid paketerar rendering som hanterade tjänster med egen infrastruktur och egna integrationer. Med Lolly kan en enskild person rendera lokalt, eller så kan ett team driva lolly.work på sin egen infrastruktur. Båda Lolly-repositoryerna är öppen källkod under MPL-2.0; egen drift har ingen programvarulicensavgift per rendering, medan beräkning, lagring och drift fortfarande är kostnader att planera för.

Den publika webbplatsen lolly.work är en utvärderingssandlåda, inte ett åtagande om produktionshosting. En varaktig tjänst behöver beständig databas och beständig lagring av utdata; webbläsarberoende verktyg behöver Chromium-workern. [Installationsguiden](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) och [statussidan](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) beskriver de kraven och de nuvarande begränsningarna.

Lokal rendering och rendering i CI förblir tillgängliga utan organisationstjänsten. Att skicka in ett serverjobb skickar dess indata och nödvändiga resurser till den instansen; det skiljer sig från vägen på enheten. Se [översikten över den kombinerade lösningen](/info/compare.html).

Bannerbear och Placid är varumärken som tillhör sina ägare. Den här sidan beskriver var lösningarna överlappar och är inte knuten till någon av dem.
