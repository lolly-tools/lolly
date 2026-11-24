# Lolly ve srovnání, nástroj po nástroji

Tyto stránky říkají, zda Lolly nahrazuje jiný produkt, funguje vedle něj nebo se pro tvou práci nehodí. Každá stránka začíná tím, co druhý produkt zvládá lépe.

_Poslední kontrola: 28. září 2026._

<!--i:eti-grid-->
## Srovnání podle produktu

- [Lolly a Canva](/info/compare-canva.html) - šablony, každodenní navrhování a společná tvorba pro značku.
- [Lolly a Adobe](/info/compare-adobe.html) - úpravy, převod, profesionální výstup a Content Credentials.
- [Lolly a Figma](/info/compare-figma.html) - navrhování, živá spolupráce a opakovatelná tvorba assetů.
- [Lolly a Penpot](/info/compare-penpot.html) - navrhování v otevřeném softwaru, sdílené tokeny a práce v organizaci.
- [Lolly a portály značek](/info/compare-brand-portals.html) - schválené knihovny, uzamčené šablony, identita, kontrola a přehledy.
- [Lolly a vykreslovací API](/info/compare-render-apis.html) - automatické generování na tvém zařízení, v CI nebo na vlastním serveru a [jak přejít](/info/work-move-from-render-api.html) z Bannerbear nebo Placid.
- [Lolly a online převodníky souborů](/info/compare-converters.html) - převod formátů na tvém vlastním zařízení.

[Jak si Lolly stojí ve srovnání](/info/positioning.html) nabízí pohled po jednotlivých schopnostech. Každé srovnání má datum. Tvrzení, které už neodpovídá některému z produktů, je potřeba opravit.

<!--i:eti-map-pin-->
## Co kde běží

Každé srovnání pokrývá dvě části jednoho projektu s otevřeným zdrojovým kódem. **Lolly** je engine, aplikace a nástroje. **Lolly Work** je server organizace, spravovaný v [repozitáři lolly-work](https://github.com/lolly-tools/lolly-work). Obě části mají licenci MPL-2.0 a organizace rozhoduje, které služby Lolly Work zapne.

::: cols
## Na tvém zařízení: Lolly

- Samostatné použití bez účtu
- Tvorba, úpravy, převod a export
- Funguje offline, jakmile jsou uložené potřebné nástroje a assety
- Content Credentials podepsané na zařízení
- Soukromá spolupráce mezi dvěma zařízeními, bez serveru

## Na serveru tvé organizace: Lolly Work

- Jednotné přihlášení, zřizování přes SCIM, role a zásady
- Sdílené katalogy, týmové projekty a pracovní spolupráce
- Schvalování, přehledy využití a auditní záznamy
- Serverové vykreslování, obnovitelné úlohy a schválené doručení
- Serverové podepisování s identitou organizace
:::

Při samostatném použití zůstávají soubory na zařízení. Výběr sdílených projektů, pracovní spolupráce, serverového vykreslení nebo doručení odešle data potřebná pro danou funkci na server tvé organizace.

<!--i:eti-info-->
## Z čeho každé srovnání vychází

Tato omezení platí pro každou stránku v této sadě:

- **Spolupráce v Lolly Work dnes běží na jediném serverovém uzlu.** Její rozsah a provozní historie se liší od dlouhodobě zavedených hostovaných produktů. [Stav a plán vývoje Lolly Work](/info/work-status.html) uvádí současná omezení.
- **Web na [lolly.work](https://lolly.work) je ukázkové testovací prostředí.** Trvalé nasazení v organizaci vyžaduje trvalé úložiště a provozovatele. [Instalace Lolly Work](/info/work-install.html) pokrývá obojí.
- **Za softwarovou licenci se neplatí poplatek za uživatele**, ať jde o Lolly nebo Lolly Work na vlastním serveru. Hosting, úložiště a provoz stále stojí peníze.
- **Podpis neznamená důvěryhodného podepisujícího.** Ověřovatel ukazuje podepisujícího jako důvěryhodného, jen pokud důvěřuje certifikátu, kterým byl soubor podepsán. [Identita v Content Credentials](/info/content-credentials-identity.html) vysvětluje, jak to funguje.
