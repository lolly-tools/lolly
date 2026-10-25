# Lolly en render-API's

_Laatst gecontroleerd: 28 september 2026._

Als je vandaag via een API afbeeldingen uit sjablonen genereert, zegt deze pagina hoe Lolly dezelfde klus doet op je eigen apparaat, in CI of op je eigen server.

## Wat gehoste render-API's beter doen

[Bannerbear](https://www.bannerbear.com/) en [Placid](https://placid.app/) verpakken rendering als beheerde diensten, met hun eigen infrastructuur, integraties en support. Jij stuurt een verzoek en iemand anders draait de servers.

## Waar ze overlappen

Beide maken van een sjabloon plus inputs media. Lolly neemt de inputs uit een [link](/info/url-mode.html), de [CLI](/info/cli.html), een batchraster of een servereindpunt.

## Hoe Lolly de overlappende klus doet

Dezelfde tool rendert op een laptop, in een CI-job of op een server, uit dezelfde inputs. Lokaal en CI-rendering hebben helemaal geen dienst nodig.

![Exportinstellingen van Batch: bestandsnaam, standaardformaat, eenheden, DPI en het aantal te renderen rijen](/info/shots/use-batch-toolbar.svg)

Op een server draait [Lolly Work](/info/compare.html#what-runs-where) de Lolly-engine achter een API en past het toolzichtbaarheid en inputbeleid toe. De [herstelbare renderdienst](/info/work-renders.html) ondersteunt losse jobs en batches, idempotente indiening, status, begrensde pogingen, annulering en bewaarde uitvoer, en onderbroken werk hervat na een herstart wanneer persistente opslag is geconfigureerd.

De server heeft een snel SVG- en PNG-pad en een optionele Chromium-worker voor tools die een browser nodig hebben. Automatisering meldt zich aan met servicetokens, afgeronde uitvoer kan via [goedgekeurde bezorging](/info/work-delivery.html) naar organisatiebestemmingen gaan, en een geconfigureerde ondertekeningsidentiteit voegt Content Credentials toe aan ondersteunde uitvoer.

## Wie de service draait

Met Lolly rendert een individu lokaal, of draait een team Lolly Work op zijn eigen infrastructuur. Een serverjob indienen stuurt zijn inputs en vereiste assets naar die instantie, wat anders is dan het pad op het apparaat. Een duurzame dienst heeft een persistente database en uitvoeropslag nodig, en tools die van de browser afhangen hebben de Chromium-worker nodig; [Install Lolly Work](/info/work-install.html) beschrijft beide.

Bannerbear en Placid zijn handelsmerken van hun eigenaren. Deze pagina beschrijft waar de producten overlappen en is niet verbonden aan een van beide.
