# Lolly og Penpot

_Sist sjekket: 28. september 2026._

Hvis teamet ditt designer i Penpot, fungerer Lolly sammen med Penpot. Begge har åpen kildekode og leser de samme designtokenene. Denne siden sier hvilken jobb hvert verktøy er til.

<!--i:eti-award-->
## Hva Penpot gjør bedre

[Penpot](https://penpot.app/) tilbyr grensesnittdesign, komponenter, fleksible layouter, interaktive prototyper og inspeksjon for utviklere, med redigering i sanntid og levende pekere. Det tilbyr installasjoner som driftes for deg eller som du drifter selv, med [installasjonsalternativer for Docker og Kubernetes](https://help.penpot.app/technical-guide/getting-started/). For å designe en app er Penpot verktøyet.

<!--i:eti-blend-->
## Hvor de overlapper

[Penpots designtokener](https://help.penpot.app/user-guide/design-systems/design-tokens/) bruker DTCG-formatet, som Lolly også leser, så farger, skrift og andre tokenverdier kan flyttes mellom de to. Lollys [Importer et design](/info/design-import.html) åpner en `.penpot`-eksport som en redigerbar layout, og **Send to Penpot** i Lolly sender et design tilbake som et `.penpot`-arkiv. Lolly vedlikeholder også [Lolly Export-programtillegget for Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), som bruker Lollys motor til å legge til Content Credentials på enheten når du velger det.

<!--i:eti-lolly-->
## Slik gjør Lolly den overlappende jobben

Lolly Design-lerretet lager redigerbare ressurser og kan gjøre en layout til et [verktøy med regler](/info/create-a-tool.html). Det samme verktøyet gjengir i nettleseren, skrivebordsappen eller kommandolinjeverktøyet og lager varianter fra data. Frittstående Lolly gjengir og signerer på enheten, uten konto eller server. Et [privat samarbeid](/info/collaborate.html) kobler to enheter direkte.

<!--i:eti-building-->
## Med en organisasjon

Lolly Work legger til engangspålogging, SCIM-provisjonering, delte kataloger og prosjekter, roller, godkjenninger, revisjonsposter, arbeidssamarbeid og gjengivelse på server. Begge kodelagrene er MPL-2.0, og en organisasjon kan kjøre begge. [Hva kjører hvor](/info/compare.html#what-runs-where) viser de to delene side om side.

Du kan bruke begge: Penpot til grensesnittdesign og prototyping, Lolly til filer som lages gjentatte ganger.

Penpot er et varemerke som tilhører eieren. Denne siden beskriver hvor de to produktene overlapper og er ikke tilknyttet Penpot.
