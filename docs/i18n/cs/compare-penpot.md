# Lolly a Penpot

_Naposledy ověřeno: 28. září 2026._

Pokud tvůj tým navrhuje v Penpotu, Lolly funguje vedle Penpotu: oba jsou open source a oba čtou stejné designové tokeny. Tato stránka říká, k čemu který slouží.

## Co Penpot dělá lépe

[Penpot](https://penpot.app/) poskytuje návrh rozhraní, komponenty, flexibilní rozvržení, interaktivní prototypy a inspekci pro vývojáře, s úpravami v reálném čase a živými kurzory. Nabízí hostovaná i samostatně hostovaná nasazení, s [možnostmi instalace přes Docker a Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Pro návrh aplikace je Penpot ten nástroj.

## Kde se překrývají

[Designové tokeny Penpotu](https://help.penpot.app/user-guide/design-systems/design-tokens/) používají formát DTCG, který čte i Lolly, takže barvy, písmo a další hodnoty tokenů putují mezi nimi. [Import návrhu](/info/design-import.html) v Lolly otevírá export `.penpot` jako upravitelné rozvržení a **Send to Penpot** v Lolly pošle návrh zpět jako archiv `.penpot`. Lolly také udržuje [plugin Lolly Export pro Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), který pomocí enginu Lolly přidává volitelné Content Credentials na zařízení.

## Jak Lolly dělá překrývající se úlohu

Plátno Design v Lolly vytváří upravitelné assety a může změnit rozvržení na [nástroj s pravidly](/info/create-a-tool.html). Tentýž nástroj se vykresluje v prohlížeči, v desktopové aplikaci nebo v CLI a vytváří varianty z dat. Samostatná Lolly vykresluje a podepisuje na zařízení, bez účtu a bez serveru. [Soukromá kolaborace](/info/collaborate.html) spojí dvě zařízení přímo.

## S organizací

Lolly Work přidává jednotné přihlášení, zřizování SCIM, sdílené katalogy a projekty, role, schvalování, auditní záznamy, pracovní kolaborace a serverové vykreslování. Oba repozitáře jsou MPL-2.0 a organizace může provozovat oba. [Co běží kde](/info/compare.html#what-runs-where) staví obě části vedle sebe.

Můžeš používat obojí: Penpot pro návrh rozhraní a prototypování, Lolly pro opakovatelné soubory, spojené sdílenými tokeny a importovanými návrhy.

Penpot je ochranná známka svého vlastníka. Tato stránka popisuje, kde se oba produkty překrývají, a není s Penpotem nijak spojena.
