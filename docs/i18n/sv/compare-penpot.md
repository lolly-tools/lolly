# Lolly och Penpot

_Senast kontrollerat: 28 september 2026._

Om ditt team designar i Penpot fungerar Lolly tillsammans med Penpot. Båda har öppen källkod och läser samma designtokens. Den här sidan säger vilket jobb var och en är till för.

<!--i:eti-award-->
## Vad Penpot gör bättre

[Penpot](https://penpot.app/) erbjuder gränssnittsdesign, komponenter, flexibla layouter, interaktiva prototyper och inspektion för utvecklare, med redigering och markörer i realtid. Det erbjuder hostad drift och drift på egen server, med [installationsalternativ för Docker och Kubernetes](https://help.penpot.app/technical-guide/getting-started/). För att designa en applikation är Penpot verktyget.

<!--i:eti-blend-->
## Där de överlappar

[Penpots designtokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) använder DTCG-formatet, som Lolly också läser, så färger, typsnitt och andra tokenvärden flyttas mellan de två. Lollys [Importera en design](/info/design-import.html) öppnar en `.penpot`-export som en redigerbar layout, och **Send to Penpot** i Lolly skickar tillbaka en design som ett `.penpot`-arkiv. Lolly underhåller också [Lolly Export-pluginen för Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), som använder Lollys motor för att lägga till Content Credentials på enheten när du väljer det.

<!--i:eti-lolly-->
## Så utför Lolly de gemensamma uppgifterna

Lolly Designs yta skapar redigerbara tillgångar och kan göra en layout till ett [verktyg med regler](/info/create-a-tool.html). Samma verktyg renderar i webbläsaren, skrivbordsappen eller CLI och skapar varianter från data. Fristående Lolly renderar och signerar på enheten, utan konto eller server. En [privat collab](/info/collaborate.html) kopplar ihop två enheter direkt.

<!--i:eti-building-->
## Med en organisation

Lolly Work lägger till enkel inloggning, SCIM-provisionering, delade kataloger och projekt, roller, godkännanden, granskningsposter, work collabs och serverrendering. Båda kodförråden är MPL-2.0 och en organisation kan köra båda. [Vad som körs var](/info/compare.html#what-runs-where) ställer de två delarna sida vid sida.

Du kan använda båda: Penpot för gränssnittsdesign och prototyper, Lolly för filer som ska produceras upprepade gånger.

Penpot är ett varumärke som tillhör sin ägare. Den här sidan beskriver var de två produkterna överlappar och har ingen koppling till Penpot.
