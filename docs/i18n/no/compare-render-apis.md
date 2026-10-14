# Lolly og gjengivelses-API-er

_Sist kontrollert: 28. september 2026._

Lolly genererer ressurser fra maler og data på enheten din, i CI eller via serverens API i [lolly.work](https://lolly.work). Den samlede løsningen dekker automatisert gjengivelse, samt identiteten, policyene og leveringen rundt en organisasjons produksjonsjobber.

## Hvor de overlapper

[Bannerbear](https://www.bannerbear.com/) og [Placid](https://placid.app/) genererer bilder og annen media fra maler via API-er og integrasjoner. Lolly bruker samme tilnærming med en mal pluss inndata, med [URL-modus](/info/url-mode.html), [CLI](/info/cli.html), et batch-rutenett og serverendepunkter som måter å sende inn arbeid på.

## Hva lolly.work tilbyr

lolly.work er den separat driftede organisasjonstjenesten i Lolly-prosjektet. Den kjører Lolly-motoren bak et API, bruker policyer for verktøysynlighet og inndata, og leverer gjengitte filer og signerte delingslenker. Den [gjenopprettbare gjengivelsestjenesten](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) støtter enkeltjobber og batcher, idempotent innsending, status, begrensede nye forsøk, avbrytelse og oppbevarte utdata. Avbrutt arbeid kan gjenopptas etter en omstart av serveren når vedvarende lagring er konfigurert.

Serveren bruker en rask gjengivelsessti for SVG/PNG og en valgfri Chromium-arbeider for verktøy som trenger en nettleser. Automatisering autentiserer med tjenestetokens, og ferdig utdata kan sendes via [styrt levering](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) til mål i organisasjonen. En konfigurert signeringsidentitet muliggjør C2PA-signering av støttede serverutdata.

## Hvem som driver tjenesten

Bannerbear og Placid tilbyr gjengivelse som administrerte tjenester med egen infrastruktur og egne integrasjoner. Med Lolly kan en enkeltperson gjengi lokalt, eller et team kan drifte lolly.work på sin egen infrastruktur. Begge Lolly-repositoriene er åpen kildekode under MPL-2.0; egendrift har ingen programvarelisens per gjengivelse, mens databehandling, lagring og drift fortsatt er kostnader du må planlegge for.

Det offentlige lolly.work-nettstedet er en evalueringssandkasse, ikke en forpliktelse til produksjonshosting. En varig tjeneste trenger vedvarende database og utdatalagring; verktøy som avhenger av en nettleser, trenger Chromium-arbeideren. [Installasjonsveiledningen](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) og [statussiden](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) beskriver disse kravene og gjeldende begrensninger.

Lokal gjengivelse og gjengivelse i CI er fortsatt tilgjengelig uten organisasjonstjenesten. Når du sender inn en serverjobb, sendes inndataene og de nødvendige ressursene til den instansen; dette er noe annet enn stien på enheten. Se [oversikten over den samlede løsningen](/info/compare.html).

Bannerbear og Placid er varemerker tilhørende eierne. Denne siden beskriver hvor løsningene overlapper, og er ikke tilknyttet noen av dem.
