# Lolly vergeleken, tool voor tool

Als je al een ander product gebruikt, zeggen deze pagina's of Lolly dat product vervangt, ernaast werkt of niet bij je werk past. Elke begint met wat het andere product beter doet.

_Laatst gecontroleerd: 28 september 2026._

## Vergelijk per product

- [Lolly en Canva](/info/compare-canva.html) - sjablonen, alledaags ontwerp en gedeelde merkproductie.
- [Lolly en Adobe](/info/compare-adobe.html) - bewerken, conversie, professionele uitvoer en Content Credentials.
- [Lolly en Figma](/info/compare-figma.html) - ontwerp, live samenwerking en herbruikbare assetproductie.
- [Lolly en Penpot](/info/compare-penpot.html) - open-sourceontwerp, gedeelde tokens en organisatiewerk.
- [Lolly en merkportalen](/info/compare-brand-portals.html) - goedgekeurde bibliotheken, vergrendelde sjablonen, identiteit, review en rapportage.
- [Lolly en render-API's](/info/compare-render-apis.html) - geautomatiseerde generatie op je apparaat, in CI of op een Lolly Work-server.
- [Lolly en online bestandsconverters](/info/compare-converters.html) - formaatconversie op je eigen apparaat.

Voor de weergave per mogelijkheid, zie [Hoe Lolly zich verhoudt](/info/positioning.html). Elke vergelijking is gedateerd; een bewering die voor geen van beide producten meer klopt, moet worden gecorrigeerd.

## Wat waar draait

Elke vergelijking dekt twee delen van één open-sourceproject. **Lolly** is de engine, apps en tools. **Lolly Work** is de organisatieserver, onderhouden in de [lolly-work-repository](https://github.com/lolly-tools/lolly-work). Beide zijn MPL-2.0, en een organisatie beslist welke Lolly Work-diensten ze aanzet.

::: cols
## Op je apparaat: Lolly

- Geen account voor zelfstandig gebruik
- Maken, bewerken, omzetten en exporteren
- Werkt offline zodra de benodigde tools en assets zijn opgeslagen
- Content Credentials ondertekend op het apparaat
- Privécollabs tussen twee apparaten, zonder server

## Op de server van je organisatie: Lolly Work

- Single sign-on, SCIM-provisioning, rollen en beleid
- Gedeelde catalogi, teamprojecten en werkcollabs
- Goedkeuringen, gebruiksrapportage en auditrecords
- Serverrendering, herstelbare jobs en goedgekeurde bezorging
- Serverondertekening met de identiteit van de organisatie
:::

Zelfstandig gebruik houdt bestanden op het apparaat. Kiezen voor gedeelde projecten, een werkcollab, een serverrender of bezorging stuurt de gegevens die die functie nodig heeft naar de server van je organisatie.

## Wat elke vergelijking aanneemt

Deze grenzen gelden voor elke pagina in deze set, dus ze worden hier één keer genoemd:

- **Werkcollabs draaien vandaag op één servernode.** Hun schaal en operationele geschiedenis verschillen van de al langer gevestigde gehoste producten. [Work status and roadmap](/info/work-status.html) legt de huidige grenzen vast.
- **De site op [lolly.work](https://lolly.work) is een demosandbox.** Een duurzame organisatie-implementatie heeft persistente opslag en een beheerder nodig; [Install Lolly Work](/info/work-install.html) behandelt beide.
- **Er zijn geen softwarelicentiekosten per gebruiker** voor Lolly of een zelf gehoste Lolly Work. Hosting, opslag en beheer kosten nog steeds geld.
- **Een handtekening is geen vertrouwde ondertekenaar.** Een verificator moet het certificaat vertrouwen dat een bestand ondertekende voordat hij de ondertekenaar als vertrouwd toont; [Content Credentials Identity](/info/content-credentials-identity.html) legt uit hoe.
