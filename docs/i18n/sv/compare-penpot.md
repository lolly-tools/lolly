# Lolly och Penpot

_Senast kontrollerad: 28 september 2026._

Om ditt team designar i Penpot arbetar Lolly vid sidan av Penpot: båda har öppen källkod och båda läser samma designtokens. Den här sidan säger vilket jobb var och en är till för.

## Vad Penpot gör bättre

[Penpot](https://penpot.app/) ger gränssnittsdesign, komponenter, flexibla layouter, interaktiva prototyper och utvecklarinspektion, med redigering i realtid och levande markörer. Det erbjuder värdbaserade och egna driftade installationer, med [installationsalternativ för Docker och Kubernetes](https://help.penpot.app/technical-guide/getting-started/). För att designa en applikation är Penpot verktyget.

## Där de överlappar

[Penpots designtokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) använder DTCG-formatet, som Lolly också läser, så färger, typografi och andra tokenvärden flyttar mellan de två. Lollys [Importera en design](/info/design-import.html) öppnar en `.penpot`-export som en redigerbar layout, och **Send to Penpot** i Lolly skickar tillbaka en design som ett `.penpot`-arkiv. Lolly underhåller också [Lolly Export-tillägget för Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), som använder Lollys motor för att lägga till valfria Content Credentials på enheten.

## Hur Lolly gör det överlappande jobbet

Lollys Design-yta gör redigerbara tillgångar och kan göra en layout till ett [verktyg med regler](/info/create-a-tool.html). Samma verktyg renderas i webbläsaren, datorappen eller CLI och gör varianter av data. Fristående Lolly renderar och signerar på enheten, utan konto och utan server. En [privat collab](/info/collaborate.html) parar ihop två enheter direkt.

## Med en organisation

Lolly Work lägger till enkel inloggning, SCIM-provisionering, delade kataloger och projekt, roller, godkännanden, granskningsposter, arbetscollabs och serverrendering. Båda arkiven är MPL-2.0 och en organisation kan köra båda. [Vad som körs var](/info/compare.html#what-runs-where) ställer de två delarna bredvid varandra.

Du kan använda båda: Penpot för gränssnittsdesign och prototyper, Lolly för repeterbara filer, sammanfogade av delade tokens och importerade designer.

Penpot är ett varumärke som tillhör sin ägare. Den här sidan beskriver var de två produkterna överlappar och är inte knuten till Penpot.
