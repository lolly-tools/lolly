# Lolly och Penpot

_Senast kontrollerad: 28 september 2026._

Lolly och Penpot erbjuder båda designverktyg med öppen källkod, delade designtokens och samarbete i realtid. Lolly kombinerar skapande på enheten med [lolly.work](https://lolly.work), sin separat driftsatta organisationstjänst.

## Gemensamma designgrunder

[Penpots designtokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) använder DTCG-formatet, som Lolly också läser. Färger, typografi och andra tokenvärden kan delas mellan de två arbetsflödena. Lollys [Importera en design](/info/design-import.html) öppnar en `.penpot`-export som en redigerbar layout.

Lolly Export-pluginet för Penpot underhålls av Lolly. Det använder Lollys motor för C2PA Content Credentials på enheten, som användaren själv väljer att aktivera. Signaturens integritet och förtroendet för undertecknaren är separata frågor: en verifierare behöver en identitet som den litar på, enligt beskrivningen i [Content Credentials Identity](/info/content-credentials-identity.html).

## Design- och teamarbetsflöden

[Penpot](https://penpot.app/) erbjuder gränssnittsdesign, komponenter, flexibla layouter, interaktiva prototyper och inspektion för utvecklare. Det finns som hostad och egendriftad lösning, med [installationsalternativ för Docker och Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Lollys Design-canvas skapar redigerbara resurser och kan förvandla en layout till ett [verktyg med regler](/info/create-a-tool.html). Samma verktyg renderar i webbläsaren, skrivbordsappen eller CLI och kan generera varianter från data. För teamarbete har Lolly både direkta [privata collabs](/info/collaborate.html) mellan två enheter och arbetscollabs via lolly.work, med delad redigering, markörer och sparade teamsessioner.

## Hur driftsättningarna skiljer sig

Fristående Lolly renderar och signerar på enheten utan konto eller server. lolly.work lägger till SSO, SCIM-provisionering, delade kataloger och projekt, roller, godkännanden, granskningsloggar och serverrendering. Båda repositoryerna är öppen källkod under MPL-2.0 och kan drivas av organisationen. Delat arbete använder den konfigurerade instansen; lokalt skapande är fortsatt tillgängligt oberoende av den.

Valet beror på arbetet: Penpots arbetsflöde för gränssnittsdesign och prototyper, Lollys repeterbara resursproduktion, eller en kombination som använder delade tokens och importerade designer. Lollys samarbete i arbetsflöden körs för närvarande på en enda servernod, och dess [driftsättningsstatus](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) bör ingå i en organisations utvärdering.

Penpot är ett varumärke som tillhör sin ägare. Pluginet ovan är Lollys. Se [Så jämför sig Lolly](/info/positioning.html) och [översikten över den kombinerade lösningen](/info/compare.html) för den bredare jämförelsen.
