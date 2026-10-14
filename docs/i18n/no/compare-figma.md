# Lolly og Figma

_Sist kontrollert: 28. september 2026._

Lolly støtter design, redigering i sanntid og gjenbrukbar ressursproduksjon. [lolly.work](https://lolly.work) legger til organisasjonstjenestene rundt dette arbeidet: identitet, delte prosjekter, tilgangskontroll og godkjenninger.

## Hvor de overlapper

Begge lar deg ordne tekst, former og bilder på et lerret og jobbe sammen med andre. Lollys [Importer et design](/info/design-import.html) leser Figma-filer som redigerbare layouter. Figma dekker også malbasert merkevareproduksjon: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) lager ressurser fra maler og fyller dem fra CSV- eller XLSX-filer.

Lolly gjør et design om til et [gjenbrukbart verktøy med regler](/info/create-a-tool.html). Dette verktøyet kjører i nettleseren eller CLI og tar imot inndata fra en URL, et skript eller batch-rutenettet. Den samme malen støtter både en enkeltperson som redigerer én ressurs og et team som produserer mange varianter.

## Samarbeid og produktdesign

[Figma Design](https://www.figma.com/design/) samler grensesnittdesign, komponenter, interaktive prototyper og utvikleroverlevering. Den etablerte arbeidsflyten og økosystemet for produktdesign er relevante når et team skal designe og spesifisere en komplett applikasjon.

Lolly tilbyr to typer sanntidssamarbeid. En [privat collab](/info/collaborate.html) kobler to enheter direkte, uten konto og uten internett på et delt nettverk. En arbeids-collab bruker lolly.work for autentisert tilgang, delte redigeringer, markører i sanntid og lagrede teamøkter. Samarbeid i arbeidsmiljø er implementert både i Lolly-klienten og lolly.work-serveren; den nåværende driften med én node viser ikke likeverdighet med Figmas driftsskala.

## Drift og produksjon

Lollys kreative apper og lolly.work er separat driftede deler av samme åpen kildekode-prosjekt. Frittstående Lolly kan gjengi uten nett og uten konto. lolly.work tilbyr SSO, SCIM, delte kataloger, prosjekttillatelser, godkjenninger, revisjonslogger og servergjengivelse på infrastruktur organisasjonen kontrollerer.

Teamøkter og redigeringer i arbeids-collabs går til denne instansen; lokale gjengivelser kan bli på enheten. Content Credentials er valgfritt for støttede eksporter, og serversignering bruker en konfigurert organisasjonsidentitet. Se [oversikten over den samlede løsningen](/info/compare.html) for skillet og [Content Credentials Identity](/info/content-credentials-identity.html) for hvordan en verifikator stoler på signereren.

Figma er et varemerke tilhørende eieren. Denne siden beskriver hvor de to løsningene overlapper, og er ikke tilknyttet Figma.
