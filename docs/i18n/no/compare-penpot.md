# Lolly og Penpot

_Sist kontrollert: 28. september 2026._

Hvis teamet ditt designer i Penpot, virker Lolly ved siden av Penpot: begge er åpen kildekode og begge leser de samme designtokenene. Denne siden sier hvilken jobb hver er til.

## Hva Penpot gjør bedre

[Penpot](https://penpot.app/) gir grensesnittdesign, komponenter, fleksible layouter, interaktive prototyper og utviklerinspeksjon, med redigering i sanntid og live-markører. Det tilbyr vertsbaserte og selvhostede installasjoner, med [Docker- og Kubernetes-installasjonsalternativer](https://help.penpot.app/technical-guide/getting-started/). For å designe en applikasjon er Penpot verktøyet.

## Hvor de overlapper

[Penpots designtokener](https://help.penpot.app/user-guide/design-systems/design-tokens/) bruker DTCG-formatet, som Lolly også leser, så farger, skrift og andre tokenverdier flyttes mellom de to. Lollys [Import a design](/info/design-import.html) åpner en `.penpot`-eksport som en redigerbar layout, og **Send to Penpot** i Lolly sender et design tilbake som et `.penpot`-arkiv. Lolly vedlikeholder også [Lolly Export-pluginen for Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), som bruker Lollys motor til å legge til valgfrie Content Credentials på enheten.

## Hvordan Lolly gjør den overlappende jobben

Lollys Design-lerret lager redigerbare ressurser og kan gjøre en layout om til et [verktøy med regler](/info/create-a-tool.html). Det samme verktøyet gjengir i nettleseren, skrivebordsappen eller CLI-et og lager varianter fra data. Frittstående Lolly gjengir og signerer på enheten, uten konto eller server. En [private collab](/info/collaborate.html) kobler to enheter direkte.

## Med en organisasjon

Lolly Work legger til enkel pålogging, SCIM-klargjøring, delte kataloger og prosjekter, roller, godkjenninger, revisjonsposter, work collabs og servergjengivelse. Begge repositoriene er MPL-2.0, og en organisasjon kan kjøre begge. [What runs where](/info/compare.html#what-runs-where) setter de to delene side om side.

Du kan bruke begge: Penpot for grensesnittdesign og prototyping, Lolly for repeterbare filer, forbundet av delte tokener og importerte design.

Penpot er et varemerke tilhørende eieren. Denne siden beskriver hvor de to produktene overlapper og er ikke tilknyttet Penpot.
