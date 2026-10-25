# Lolly og gjengivelses-API-er

_Sist kontrollert: 28. september 2026._

Hvis du genererer bilder fra maler gjennom et API i dag, sier denne siden hvordan Lolly gjør den samme jobben på din egen enhet, i CI eller på din egen server.

## Hva vertsbaserte gjengivelses-API-er gjør bedre

[Bannerbear](https://www.bannerbear.com/) og [Placid](https://placid.app/) pakker gjengivelse som administrerte tjenester, med egen infrastruktur, integrasjoner og støtte. Du sender en forespørsel, og noen andre driver serverne.

## Hvor de overlapper

Begge gjør en mal pluss inndata om til media. Lolly henter inndataene fra en [lenke](/info/url-mode.html), [CLI-et](/info/cli.html), et batch-rutenett eller et serverendepunkt.

## Hvordan Lolly gjør den overlappende jobben

Det samme verktøyet gjengir på en bærbar, i en CI-jobb eller på en server, fra de samme inndataene. Lokal gjengivelse og CI-gjengivelse trenger ingen tjeneste i det hele tatt.

![Batch-eksportinnstillinger: filnavn, standardformat, enheter, DPI og antall rader som skal gjengis](/info/shots/use-batch-toolbar.svg)

På en server kjører [Lolly Work](/info/compare.html#what-runs-where) Lolly-motoren bak et API og bruker verktøysynlighet og inndatapolicyer. Den [gjenopprettbare gjengivelsestjenesten](/info/work-renders.html) støtter enkeltjobber og batcher, idempotent innsending, status, begrensede nye forsøk, avbrytelse og beholdte utdata, og avbrutt arbeid gjenopptas etter en omstart når vedvarende lagring er konfigurert.

Serveren har en rask SVG- og PNG-vei og en valgfri Chromium-arbeider for verktøy som trenger en nettleser. Automatisering logger på med tjenestetokener, ferdige utdata kan gå gjennom [godkjent levering](/info/work-delivery.html) til organisasjonsdestinasjoner, og en konfigurert signeringsidentitet legger Content Credentials til støttede utdata.

## Hvem som driver tjenesten

Med Lolly gjengir en enkeltperson lokalt, eller et team kjører Lolly Work på sin egen infrastruktur. Å sende inn en serverjobb sender inndataene og de nødvendige ressursene til den instansen, noe som er annerledes enn veien på enheten. En varig tjeneste trenger en vedvarende database og utdatalagring, og nettleseravhengige verktøy trenger Chromium-arbeideren; [Install Lolly Work](/info/work-install.html) beskriver begge.

Bannerbear og Placid er varemerker tilhørende eierne. Denne siden beskriver hvor produktene overlapper og er ikke tilknyttet noen av dem.
