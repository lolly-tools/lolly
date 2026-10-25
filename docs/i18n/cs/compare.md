# Lolly srovnání nástroj po nástroji

Pokud už používáš jiný produkt, tyto stránky říkají, zda ho Lolly nahrazuje, funguje vedle něj, nebo se pro tvou práci nehodí. Každá začíná tím, co ten druhý produkt dělá lépe.

_Naposledy ověřeno: 28. září 2026._

## Srovnání podle produktu

- [Lolly a Canva](/info/compare-canva.html) - šablony, každodenní návrh a sdílená výroba pro značku.
- [Lolly a Adobe](/info/compare-adobe.html) - úpravy, převody, profesionální výstup a Content Credentials.
- [Lolly a Figma](/info/compare-figma.html) - návrh, živá spolupráce a opakovaná výroba assetů.
- [Lolly a Penpot](/info/compare-penpot.html) - open-source návrh, sdílené tokeny a práce organizace.
- [Lolly a portály značek](/info/compare-brand-portals.html) - schválené knihovny, zamčené šablony, identita, revize a reporty.
- [Lolly a vykreslovací API](/info/compare-render-apis.html) - automatizovaná generace na tvém zařízení, v CI nebo na serveru Lolly Work.
- [Lolly a online převodníky souborů](/info/compare-converters.html) - převod formátů na tvém vlastním zařízení.

Srovnání po jednotlivých schopnostech najdeš v [Jak si Lolly stojí v porovnání](/info/positioning.html). Každé srovnání je datované; tvrzení, které už neodpovídá jednomu z produktů, je třeba opravit.

## Co běží kde

Každé srovnání pokrývá dvě části jednoho open-source projektu. **Lolly** je engine, aplikace a nástroje. **Lolly Work** je organizační server udržovaný v [repozitáři lolly-work](https://github.com/lolly-tools/lolly-work). Obojí je MPL-2.0 a organizace rozhoduje, které služby Lolly Work zapne.

::: cols
## Na tvém zařízení: Lolly

- Žádný účet pro samostatné používání
- Tvorba, úpravy, převody a export
- Funguje offline, jakmile jsou uloženy potřebné nástroje a assety
- Content Credentials podepsané na zařízení
- Soukromé kolaborace mezi dvěma zařízeními, bez serveru

## Na serveru tvé organizace: Lolly Work

- Jednotné přihlášení, zřizování SCIM, role a politiky
- Sdílené katalogy, týmové projekty a pracovní kolaborace
- Schvalování, hlášení používání a auditní záznamy
- Serverové vykreslování, obnovitelné úlohy a schválené doručení
- Serverové podepisování s identitou organizace
:::

Samostatné používání drží soubory na zařízení. Volba sdílených projektů, pracovní kolaborace, serverového vykreslení nebo doručení posílá data, která ta funkce potřebuje, na server tvé organizace.

## Co každé srovnání předpokládá

Tyto limity platí pro každou stránku v této sadě, takže jsou uvedeny jednou zde:

- **Pracovní kolaborace dnes běží na jednom serverovém uzlu.** Jejich měřítko a provozní historie se liší od dlouho zavedených hostovaných produktů. [Stav a plán Work](/info/work-status.html) zaznamenává aktuální limity.
- **Web na [lolly.work](https://lolly.work) je demo pískoviště.** Trvalé nasazení v organizaci potřebuje trvalé úložiště a provozovatele; obojí pokrývá [Instalace Lolly Work](/info/work-install.html).
- **Pro Lolly ani samostatně hostované Lolly Work neexistuje poplatek za softwarovou licenci na uživatele.** Hosting, úložiště a provoz stále stojí peníze.
- **Podpis není důvěryhodný podepisovatel.** Ověřovatel musí důvěřovat certifikátu, který soubor podepsal, než ukáže podepisovatele jako důvěryhodného; vysvětluje to [Content Credentials Identity](/info/content-credentials-identity.html).
