# Lolly en render-API's

_Laatst gecontroleerd: 28 september 2026._

Lolly genereert assets uit sjablonen en data op je apparaat, in CI of via de server-API van [lolly.work](https://lolly.work). De gecombineerde oplossing dekt geautomatiseerd renderen, evenals de identiteit, het beleid en de aflevering rond de productiejobs van een organisatie.

## Waar ze overlappen

[Bannerbear](https://www.bannerbear.com/) en [Placid](https://placid.app/) genereren afbeeldingen en andere media uit sjablonen via API's en integraties. Lolly hanteert dezelfde aanpak van een sjabloon plus invoer, met [URL-modus](/info/url-mode.html), de [CLI](/info/cli.html), een batchraster en serverendpoints als manieren om werk in te dienen.

## Wat lolly.work biedt

lolly.work is de afzonderlijk uitgerolde organisatieservice in het Lolly-project. Het draait de Lolly-engine achter een API, past zichtbaarheid van tools en invoerbeleid toe en levert gerenderde bestanden en ondertekende deellinks. De [herstelbare renderservice](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) ondersteunt afzonderlijke jobs en batches, idempotente indiening, status, begrensde nieuwe pogingen, annulering en bewaarde outputs. Onderbroken werk kan na een herstart van de server worden hervat wanneer persistente opslag is geconfigureerd.

De server gebruikt een snel SVG/PNG-renderpad en een optionele Chromium-worker voor tools die een browser nodig hebben. Automatisering authenticeert met servicetokens, en voltooide output kan via [beheerde aflevering](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) naar organisatiebestemmingen worden gestuurd. Een geconfigureerde ondertekeningsidentiteit maakt C2PA-ondertekening mogelijk op ondersteunde serveroutput.

## Wie de service draait

Bannerbear en Placid bieden renderen aan als beheerde services met hun eigen infrastructuur en integraties. Met Lolly kan een individu lokaal renderen of een team lolly.work op eigen infrastructuur beheren. Beide Lolly-repositories zijn open source onder MPL-2.0; zelfhosting kent geen softwarelicentiekosten per render, terwijl rekenkracht, opslag en operations kosten blijven waarmee je rekening moet houden.

De openbare lolly.work-site is een evaluatiesandbox, geen productiehostingtoezegging. Een duurzame service vraagt om een persistente database en outputopslag; tools die van een browser afhankelijk zijn, hebben de Chromium-worker nodig. De [installatiegids](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) en de [statuspagina](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) beschrijven die vereisten en de huidige beperkingen.

Lokaal en CI-renderen blijven beschikbaar zonder de organisatieservice. Het indienen van een serverjob stuurt de invoer en de benodigde assets naar die instantie; dit verschilt van het pad op het apparaat. Zie het [overzicht van de gecombineerde oplossing](/info/compare.html).

Bannerbear en Placid zijn handelsmerken van hun eigenaren. Deze pagina beschrijft waar de oplossingen overlappen en is niet verbonden aan een van beide.
