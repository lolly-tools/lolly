# Lolly en Figma

_Laatst gecontroleerd: 28 september 2026._

Lolly ondersteunt ontwerp, live bewerken en herbruikbare assetproductie. [lolly.work](https://lolly.work) voegt de organisatieservices rond dat werk toe: identiteit, gedeelde projecten, toegangsbeheer en goedkeuringen.

## Waar ze overlappen

Met beide kun je tekst, vormen en afbeeldingen op een canvas rangschikken en met anderen samenwerken. [Een ontwerp importeren](/info/design-import.html) van Lolly leest Figma-bestanden als bewerkbare lay-outs. Figma dekt ook sjabloongebaseerde merkproductie: [Figma Buzz](https://help.figma.com/hc/en-us/articles/31271566667543-Guide-to-Figma-Buzz) maakt assets op basis van sjablonen en vult ze met CSV- of XLSX-bestanden.

Lolly verandert een ontwerp in een [herbruikbare tool met regels](/info/create-a-tool.html). Die tool draait in de browser of CLI en accepteert invoer uit een URL, een script of het batchraster. Hetzelfde sjabloon ondersteunt een individu die één asset bewerkt en een team dat veel varianten produceert.

## Samenwerking en productontwerp

[Figma Design](https://www.figma.com/design/) brengt interfaceontwerp, componenten, interactieve prototypes en developer handoff samen. De gevestigde productontwerpworkflow en het ecosysteem zijn relevant wanneer een team een complete applicatie moet ontwerpen en specificeren.

Lolly biedt twee soorten live samenwerking. Een [privécollab](/info/collaborate.html) koppelt twee apparaten rechtstreeks, zonder account en zonder internet op een gedeeld netwerk. Een werkcollab gebruikt lolly.work voor geauthenticeerde toegang, gedeelde bewerkingen, live cursors en opgeslagen teamsessies. Samenwerking aan werk is geïmplementeerd in zowel de Lolly-client als de lolly.work-server; de huidige implementatie met één node toont geen gelijkwaardigheid met de operationele schaal van Figma aan.

## Implementatie en productie

De creatieve apps van Lolly en lolly.work zijn afzonderlijk uitgerolde onderdelen van hetzelfde open-sourceproject. Zelfstandige Lolly kan offline renderen zonder account. lolly.work levert SSO, SCIM, gedeelde catalogi, projectrechten, goedkeuringen, auditregistraties en serverrendering op infrastructuur die de organisatie beheert.

Teamsessies en bewerkingen in werkcollabs bereiken die instantie; lokale renders kunnen op het apparaat blijven. Content Credentials zijn optioneel voor ondersteunde exports, en ondertekening op de server gebruikt een geconfigureerde organisatie-identiteit. Zie het [overzicht van de gecombineerde oplossing](/info/compare.html) voor de scheiding en [Content Credentials-identiteit](/info/content-credentials-identity.html) voor hoe een verifier de ondertekenaar vertrouwt.

Figma is een handelsmerk van de eigenaar. Deze pagina beschrijft waar de twee oplossingen overlappen en is niet verbonden aan Figma.
