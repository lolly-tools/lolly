# Lolly a Penpot

_Poslední kontrola: 28. září 2026._

Pokud tvůj tým navrhuje v Penpot, Lolly funguje vedle něj. Oba mají otevřený zdrojový kód a čtou stejné designové tokeny. Tato stránka říká, ke kterému úkolu je každý z nich určený.

<!--i:eti-award-->
## Co Penpot zvládá lépe

[Penpot](https://penpot.app/) nabízí návrh rozhraní, komponenty, flexibilní rozvržení, interaktivní prototypy a inspekci pro vývojáře s úpravami v reálném čase a živými kurzory. Nabízí hostované nasazení i nasazení na vlastním serveru s [možnostmi instalace pomocí Docker a Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Pro návrh aplikace je vhodným nástrojem Penpot.

<!--i:eti-blend-->
## Kde se překrývají

[Designové tokeny Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) používají formát DTCG, který čte i Lolly, takže barvy, písmo a další hodnoty tokenů lze přenášet mezi oběma aplikacemi. [Import návrhu](/info/design-import.html) v Lolly otevírá export `.penpot` jako upravitelné rozvržení a **Send to Penpot** v Lolly posílá návrh zpět jako archiv `.penpot`. Lolly také spravuje [plugin Lolly Export pro Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), který používá engine Lolly k volitelnému přidávání Content Credentials na zařízení.

<!--i:eti-lolly-->
## Jak Lolly řeší společné úkoly

Plátno Lolly Design vytváří upravitelné assety a může změnit rozvržení na [nástroj s pravidly](/info/create-a-tool.html). Stejný nástroj vykresluje v prohlížeči, desktopové aplikaci nebo CLI a vytváří varianty z dat. Samostatná Lolly vykresluje a podepisuje na zařízení, bez účtu nebo serveru. [Soukromá spolupráce](/info/collaborate.html) propojuje dvě zařízení přímo.

<!--i:eti-building-->
## V organizaci

Lolly Work přidává jednotné přihlášení, zřizování přes SCIM, sdílené katalogy a projekty, role, schvalování, auditní záznamy, pracovní spolupráci a serverové vykreslování. Oba repozitáře mají licenci MPL-2.0 a organizace může provozovat oba. [Co kde běží](/info/compare.html#what-runs-where) staví obě části vedle sebe.

Můžeš používat oba: Penpot pro návrh rozhraní a prototypování, Lolly pro opakovanou tvorbu souborů.

Penpot je ochranná známka svého vlastníka. Tato stránka popisuje, kde se oba produkty překrývají, a není spojená s Penpot.
