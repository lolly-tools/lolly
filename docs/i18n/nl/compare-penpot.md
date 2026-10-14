# Lolly en Penpot

_Laatst gecontroleerd: 28 september 2026._

Lolly en Penpot bieden beide open-sourceontwerptools, gedeelde designtokens en live samenwerking. Lolly combineert creatie op het apparaat met [lolly.work](https://lolly.work), de afzonderlijk uitgerolde organisatieservice.

## Gedeelde ontwerpfundamenten

[De designtokens van Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) gebruiken het DTCG-formaat, dat Lolly ook leest. Kleuren, typografie en andere tokenwaarden kunnen worden gedeeld tussen de twee workflows. [Een ontwerp importeren](/info/design-import.html) van Lolly opent een `.penpot`-export als bewerkbare lay-out.

De Lolly Export-plug-in voor Penpot wordt onderhouden door Lolly. Het gebruikt de engine van Lolly voor opt-in C2PA Content Credentials op het apparaat. Integriteit van de handtekening en vertrouwen in de ondertekenaar zijn gescheiden zaken: een verifier heeft een identiteit nodig die hij vertrouwt, zoals beschreven in [Content Credentials-identiteit](/info/content-credentials-identity.html).

## Ontwerp- en teamworkflows

[Penpot](https://penpot.app/) biedt interfaceontwerp, componenten, flexibele lay-outs, interactieve prototypes en developer-inspectie. Het biedt gehoste en zelfgehoste implementaties, met [installatieopties voor Docker en Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Het Design-canvas van Lolly maakt bewerkbare assets en kan een lay-out omzetten in een [tool met regels](/info/create-a-tool.html). Dezelfde tool rendert in de browser, de desktopapp of de CLI en kan varianten genereren uit data. Voor teamwerk heeft Lolly zowel directe [privécollabs](/info/collaborate.html) tussen twee apparaten als werkcollabs via lolly.work, met gedeelde bewerkingen, cursors en opgeslagen teamsessies.

## Hoe de implementaties verschillen

Zelfstandige Lolly rendert en ondertekent op het apparaat zonder account of server. lolly.work voegt SSO, SCIM-provisioning, gedeelde catalogi en projecten, rollen, goedkeuringen, auditregistraties en serverrendering toe. Beide repositories zijn open source onder MPL-2.0 en kunnen door de organisatie worden beheerd. Gedeeld werk gebruikt de geconfigureerde instantie; lokale creatie blijft onafhankelijk beschikbaar.

De keuze hangt af van het werk: de workflow van Penpot voor interfaceontwerp en prototyping, de herhaalbare assetproductie van Lolly, of een combinatie met gedeelde tokens en geïmporteerde ontwerpen. De samenwerking aan werk van Lolly draait momenteel op één servernode, en de [implementatiestatus](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) hoort onderdeel te zijn van de evaluatie door een organisatie.

Penpot is een handelsmerk van de eigenaar. De bovenstaande plug-in is van Lolly. Zie [Hoe Lolly zich verhoudt](/info/positioning.html) en het [overzicht van de gecombineerde oplossing](/info/compare.html) voor de bredere vergelijking.
