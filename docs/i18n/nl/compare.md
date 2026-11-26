# Lolly vergeleken, tool voor tool

Deze pagina's vertellen of Lolly een ander product vervangt, ernaast werkt of niet bij je werk past. Elke pagina begint met wat het andere product beter doet.

_Laatst gecontroleerd: 28 september 2026._

<!--i:eti-grid-->
## Vergelijken per product

- [Lolly en Canva](/info/compare-canva.html) - sjablonen, alledaags ontwerpwerk en gezamenlijke merkproductie.
- [Lolly en Adobe](/info/compare-adobe.html) - bewerken, converteren, professionele uitvoer en Content Credentials.
- [Lolly en Figma](/info/compare-figma.html) - ontwerpen, live samenwerken en herbruikbare assetproductie.
- [Lolly en Penpot](/info/compare-penpot.html) - opensource ontwerpen, gedeelde tokens en werk binnen organisaties.
- [Lolly en merkportalen](/info/compare-brand-portals.html) - goedgekeurde bibliotheken, vergrendelde sjablonen, identiteit, beoordeling en rapportage.
- [Lolly en render-API's](/info/compare-render-apis.html) - automatisch genereren op je apparaat, in CI of op je eigen server en [hoe je overstapt](/info/work-move-from-render-api.html) van Bannerbear of Placid.
- [Lolly en online bestandsconverters](/info/compare-converters.html) - formaten converteren op je eigen apparaat.

[Hoe Lolly zich verhoudt tot andere producten](/info/positioning.html) geeft het overzicht per functie. Elke vergelijking is gedateerd. Een claim die niet meer overeenkomt met een van beide producten moet worden gecorrigeerd.

<!--i:eti-map-pin-->
## Wat waar draait

Elke vergelijking behandelt twee delen van één opensourceproject. **Lolly** omvat de engine, apps en tools. **Lolly Work** is de organisatieserver, onderhouden in de [lolly-work-repository](https://github.com/lolly-tools/lolly-work). Beide vallen onder MPL-2.0, en een organisatie bepaalt welke Lolly Work-diensten ze inschakelt.

::: cols
## Op je apparaat: Lolly

- Geen account voor zelfstandig gebruik
- Maken, bewerken, converteren en exporteren
- Werkt offline zodra de benodigde tools en assets zijn opgeslagen
- Content Credentials ondertekend op het apparaat
- Privésamenwerkingen tussen twee apparaten, zonder server

## Op de server van je organisatie: Lolly Work

- Single sign-on, SCIM-provisioning, rollen en beleid
- Gedeelde catalogi, teamprojecten en werksamenwerkingen
- Goedkeuringen, gebruiksrapportage en auditregistraties
- Renderen op de server, herstelbare taken en goedgekeurde bezorging
- Ondertekening op de server met de identiteit van de organisatie
:::

Bij zelfstandig gebruik blijven bestanden op het apparaat. Als je kiest voor gedeelde projecten, een werksamenwerking, een serverrender of bezorging, gaan de gegevens die die functie nodig heeft naar de server van je organisatie.

<!--i:eti-info-->
## Waar elke vergelijking van uitgaat

Deze beperkingen gelden voor elke pagina in deze reeks:

- **Lolly Work-samenwerkingen draaien op dit moment op één serverknooppunt.** Hun schaal en operationele geschiedenis verschillen van die van de al langer bestaande gehoste producten. [Status en roadmap van Lolly Work](/info/work-status.html) legt de huidige beperkingen vast.
- **De site op [lolly.work](https://lolly.work) is een demosandbox.** Een blijvende installatie voor een organisatie heeft persistente opslag en een beheerder nodig. [Lolly Work installeren](/info/work-install.html) behandelt beide.
- **Er zijn geen softwarelicentiekosten per gebruiker** voor Lolly of een zelf gehoste Lolly Work. Hosting, opslag en beheer kosten nog steeds geld.
- **Een handtekening betekent niet dat de ondertekenaar vertrouwd is.** Een verificatietool toont de ondertekenaar alleen als vertrouwd als de tool het certificaat vertrouwt waarmee het bestand is ondertekend. [Identiteit bij Content Credentials](/info/content-credentials-identity.html) legt uit hoe dat werkt.
