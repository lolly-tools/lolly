# Lolly a Penpot

_Naposledy ověřeno: 28. září 2026._

Lolly i Penpot nabízejí open source designové nástroje, sdílené design tokeny a živou spolupráci. Lolly kombinuje tvorbu na zařízení s [lolly.work](https://lolly.work), svou samostatně nasazovanou organizační službou.

## Společné designové základy

[Design tokeny Penpotu](https://help.penpot.app/user-guide/design-systems/design-tokens/) používají formát DTCG, který čte i Lolly. Barvy, typografii a další hodnoty tokenů lze mezi oběma workflow sdílet. Funkce Lolly [Import a design](/info/design-import.html) otevře export `.penpot` jako upravitelný layout.

Plugin Lolly Export pro Penpot spravuje Lolly. Využívá engine Lolly pro volitelné C2PA Content Credentials na zařízení. Integrita podpisu a důvěra v podepisujícího jsou dvě oddělené věci: ověřovatel potřebuje identitu, které důvěřuje, jak popisuje [Content Credentials Identity](/info/content-credentials-identity.html).

## Workflow designu a týmů

[Penpot](https://penpot.app/) nabízí návrh rozhraní, komponenty, flexibilní layouty, interaktivní prototypy a inspekci pro vývojáře. Nabízí hostovaná i vlastní nasazení s [možnostmi instalace přes Docker a Kubernetes](https://help.penpot.app/technical-guide/getting-started/).

Design canvas v Lolly vytváří upravitelné materiály a dokáže z layoutu udělat [nástroj s pravidly](/info/create-a-tool.html). Stejný nástroj se renderuje v prohlížeči, desktopové aplikaci nebo CLI a umí z dat generovat varianty. Pro týmovou práci má Lolly přímé [soukromé collaby](/info/collaborate.html) mezi dvěma zařízeními i pracovní collaby přes lolly.work se sdílenými úpravami, kurzory a uloženými týmovými relacemi.

## Jak se nasazení liší

Samostatná Lolly renderuje a podepisuje na zařízení bez účtu a serveru. lolly.work přidává SSO, provisioning přes SCIM, sdílené katalogy a projekty, role, schvalování, auditní záznamy a serverové renderování. Oba repozitáře jsou open source pod MPL-2.0 a organizace je může provozovat sama. Sdílená práce využívá nakonfigurovanou instanci; lokální tvorba zůstává dostupná nezávisle.

Volba závisí na práci: workflow Penpotu pro návrh rozhraní a prototypování, opakovatelná produkce materiálů v Lolly, nebo kombinace využívající sdílené tokeny a importované designy. Spolupráce v rámci práce v Lolly aktuálně běží na jednom serverovém uzlu a jeho [stav nasazení](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) by měl být součástí hodnocení v organizaci.

Penpot je ochranná známka svého vlastníka. Výše uvedený plugin je z dílny Lolly. Širší srovnání viz [Jak si Lolly stojí v porovnání](/info/positioning.html) a [přehled kombinovaného řešení](/info/compare.html).
