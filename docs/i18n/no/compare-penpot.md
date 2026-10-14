# Lolly og Penpot

_Sist kontrollert: 28. september 2026._

Lolly og Penpot tilbyr begge designverktøy med åpen kildekode, delte designtokens og samarbeid i sanntid. Lolly kombinerer opprettelse på enheten med [lolly.work](https://lolly.work), den separat driftede organisasjonstjenesten.

## Felles designgrunnlag

[Penpots designtokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) bruker DTCG-formatet, som Lolly også leser. Farger, typografi og andre tokenverdier kan deles på tvers av de to arbeidsflytene. Lollys [Importer et design](/info/design-import.html) åpner en `.penpot`-eksport som en redigerbar layout.

Lolly Export-pluginen for Penpot vedlikeholdes av Lolly. Den bruker Lollys motor til C2PA Content Credentials på enheten, som brukeren selv slår på. Signaturintegritet og tillit til signereren er adskilt: en verifikator trenger en identitet den stoler på, som beskrevet i [Content Credentials Identity](/info/content-credentials-identity.html).

## Design- og teamarbeidsflyter

[Penpot](https://penpot.app/) tilbyr grensesnittdesign, komponenter, fleksible layouter, interaktive prototyper og utviklerinspeksjon. Det finnes både som vertstjeneste og egendrift, med [installasjonsalternativer for Docker og Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Lollys Design-lerret lager redigerbare ressurser og kan gjøre en layout om til et [verktøy med regler](/info/create-a-tool.html). Det samme verktøyet gjengir i nettleseren, skrivebordsappen eller CLI og kan generere varianter fra data. For teamarbeid har Lolly både direkte [private collabs](/info/collaborate.html) mellom to enheter og arbeids-collabs via lolly.work, med delte redigeringer, markører og lagrede teamøkter.

## Hvordan driftene er forskjellige

Frittstående Lolly gjengir og signerer på enheten uten konto eller server. lolly.work legger til SSO, SCIM-provisjonering, delte kataloger og prosjekter, roller, godkjenninger, revisjonslogger og servergjengivelse. Begge repositoriene er åpen kildekode under MPL-2.0 og kan drives av organisasjonen. Delt arbeid bruker den konfigurerte instansen; lokal opprettelse er fortsatt tilgjengelig uavhengig.

Valget avhenger av arbeidet: Penpots arbeidsflyt for grensesnittdesign og prototyping, Lollys repeterbare ressursproduksjon, eller en kombinasjon som bruker delte tokens og importerte design. Lollys samarbeid i arbeidsmiljø kjører for tiden på én servernode, og [driftsstatusen](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) bør inngå i en organisasjons evaluering.

Penpot er et varemerke tilhørende eieren. Pluginen ovenfor tilhører Lolly. Se [Hvordan Lolly sammenlignes](/info/positioning.html) og [oversikten over den samlede løsningen](/info/compare.html) for den bredere sammenligningen.
