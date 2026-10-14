# Lolly och Figma

_Senast kontrollerad: 28 september 2026._

Lolly stöder design, redigering i realtid och återanvändbar resursproduktion. [lolly.work](https://lolly.work) lägger till organisationstjänsterna runt det arbetet: identitet, delade projekt, åtkomstkontroller och godkännanden.

## Där de överlappar

Båda låter dig placera typografi, former och bilder på en canvas och arbeta med andra. Lollys [Importera en design](/info/design-import.html) läser Figma-filer som redigerbara layouter. Figma täcker också mallbaserad varumärkesproduktion: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) skapar resurser från mallar och fyller dem från CSV- eller XLSX-filer.

Lolly förvandlar en design till ett [återanvändbart verktyg med regler](/info/create-a-tool.html). Verktyget körs i webbläsaren eller CLI och tar emot indata från en URL, ett skript eller batchrutnätet. Samma mall fungerar både för en person som redigerar en enskild resurs och för ett team som producerar många varianter.

## Samarbete och produktdesign

[Figma Design](https://www.figma.com/design/) samlar gränssnittsdesign, komponenter, interaktiva prototyper och överlämning till utvecklare. Dess etablerade arbetsflöde och ekosystem för produktdesign är relevanta när ett team behöver designa och specificera en komplett applikation.

Lolly erbjuder två slags samarbete i realtid. En [privat collab](/info/collaborate.html) parar ihop två enheter direkt, utan konto och utan att internet behövs på ett delat nätverk. En arbetscollab använder lolly.work för autentiserad åtkomst, delad redigering, levande markörer och sparade teamsessioner. Samarbete i arbetsflöden är implementerat i både Lolly-klienten och lolly.work-servern; den nuvarande driftsättningen med en enda nod visar inte att det motsvarar Figmas driftskala.

## Driftsättning och produktion

Lollys kreativa appar och lolly.work är separat driftsatta delar av samma öppen källkod-projekt. Fristående Lolly kan rendera offline utan konto. lolly.work tillhandahåller SSO, SCIM, delade kataloger, projektbehörigheter, godkännanden, granskningsloggar och serverrendering på infrastruktur som organisationen själv kontrollerar.

Teamsessioner och redigeringar i arbetscollabs når den instansen; lokala renderingar kan stanna på enheten. Content Credentials är valfria för exporter som stöds, och serversignering använder en konfigurerad organisationsidentitet. Se [översikten över den kombinerade lösningen](/info/compare.html) för uppdelningen och [Content Credentials Identity](/info/content-credentials-identity.html) för hur en verifierare litar på undertecknaren.

Figma är ett varumärke som tillhör sin ägare. Den här sidan beskriver var de två lösningarna överlappar och är inte knuten till Figma.
