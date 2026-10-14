# Lolly en merkportalen

_Laatst gecontroleerd: 28 september 2026._

Lolly en [lolly.work](https://lolly.work) dekken samen de creatie- en governanceworkflows waarvoor teams merkportalen gebruiken: goedgekeurde assets, vergrendelde sjablonen, toegangsbeheer, beoordeling en distributie. Vergelijk die gecombineerde oplossing met Bynder, Frontify, Marq of Brandfolder wanneer je kiest hoe mensen merkassets vinden en nieuwe maken.

## Creatie en organisatieservices

De engine en apps van Lolly maken de bestanden. Sjablonen, designtokens en toegestane invoer bepalen wat iemand kan wijzigen, en het renderen kan op hun eigen apparaat blijven. Zelfstandige Lolly heeft geen account nodig.

lolly.work is de organisatieservice in hetzelfde project, onderhouden in een [aparte repository](https://github.com/lolly-tools/lolly-work) en samen met Lolly uitgerold. Het voegt identiteit, gedeelde opslag, beleid, goedkeuringen en rapportage toe. Beide onderdelen zijn open source onder MPL-2.0. Door de scheiding kan een individu Lolly zelfstandig gebruiken en een organisatie de gecombineerde oplossing draaien op infrastructuur die ze zelf beheert.

## Wat de gecombineerde oplossing biedt

| Behoefte | Lolly + lolly.work |
|---|---|
| Aanmelden en provisioning | OIDC single sign-on, meerdere identity providers, SCIM 2.0-gebruikersprovisioning en groepslidmaatschap, en het uitschakelen van accounts waarbij bestaande sessies worden ingetrokken. Een identity provider die alleen SAML ondersteunt, kan via een OIDC-brug zoals Keycloak worden gekoppeld. |
| Goedgekeurde sjablonen | Lolly definieert de bewerkbare invoer van het sjabloon; lolly.work past groepszichtbaarheid en invoerbeleid toe die waarden vergrendelen, keuzes beperken of bedieningselementen verbergen. |
| Gedeelde assetbibliotheek | Uploads die eigendom zijn van de instantie, collecties, aangepaste metadata en catalogi met toegangsbeheer, plus connectors die bestaande DAM- en opslagbibliotheken lezen. |
| Beoordeling | Geordende goedkeuringsstappen, geschikte goedkeurdersgroepen, quorumregels en functiescheiding; beoordeling kan catalogusinzendingen en aflevering aan organisatiedoelen aansturen. |
| Assetgeschiedenis en beschikbaarheid | Versies en rollback voor assets van de instantie, bewaartermijnen en holds, geplande beschikbaarheid, verloop en intrekking. Gekoppelde providers bewaren hun eigen brongeschiedenis. |
| Rapportage | Aantallen assetgebruik en downloads, tool- en exportactiviteit, dashboards en een audittrail. Gebruikstoewijzing volgt het telemetriebeleid van de implementatie; de standaardinstelling voor toewijzing vereist toestemming. |
| Distributie | Verlopende, intrekbare links, gedeelde collecties, gasttoegang en aflevering aan geconfigureerde organisatiebestemmingen. |

De [lolly.work-beheerdersgidsen](https://github.com/lolly-tools/lolly-work/tree/main/docs) beschrijven deze functies en hun configuratie. Het zijn beschikbare mogelijkheden, in plaats van functies waarvoor je een ander systeem rond Lolly moet bouwen.

## Een portalworkflow kiezen

Gevestigde portalen bieden beheerde hosting, support en uitgebreide DAM-workflows. [De enterprise-DAM van Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combineert bijvoorbeeld het vinden van assets, toegangsbeheer, goedkeuringsworkflows en distributie. Vergelijk de exacte beoordelings- en rechtenworkflow die je nodig hebt: Lolly biedt controle over metadata, toegang en beschikbaarheid, maar juridische clearance en licentieverplichtingen vragen nog steeds om het proces van een organisatie. De goedkeuringsketens zijn sequentieel; ze modelleren geen willekeurig vertakkende workflows.

De Lolly-stack is jonger, en de [statuspagina van lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) legt de beperkingen van de implementatie vast. Met name is de openbare lolly.work-site een evaluatiesandbox. Een duurzame organisatie-implementatie vraagt om persistente opslag en een beheerder. Voor zelfhosting zijn er geen softwarelicentiekosten per gebruiker; infrastructuur en beheer kosten nog steeds geld.

Een bestaande DAM kan ook de bron van waarheid blijven. De catalogusconnectors van lolly.work maken de goedgekeurde assets ervan beschikbaar in Lolly, waar mensen nieuwe bestanden maken onder de regels van de organisatie. Dat is een integratiekeuze; de eigen bibliotheek en goedkeuringen van Lolly zijn beschikbaar wanneer de organisatie die workflows zelf wil beheren.

Zie [Hoe Lolly zich verhoudt](/info/positioning.html) voor de vergelijking van mogelijkheden en [Lolly vergeleken, tool voor tool](/info/compare.html) voor de rest van deze reeks. Namen van leveranciers geven de vergeleken producten aan; Lolly is niet aan hen verbonden.
