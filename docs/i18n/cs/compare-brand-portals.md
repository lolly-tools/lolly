# Lolly a brandové portály

_Naposledy ověřeno: 28. září 2026._

Lolly a [lolly.work](https://lolly.work) společně pokrývají tvorbu a správu workflow, kvůli kterým týmy používají brandové portály: schválené materiály, zamčené šablony, řízení přístupu, revize a distribuci. Toto kombinované řešení porovnej s Bynder, Frontify, Marq nebo Brandfolder, když vybíráš, jak lidé najdou brandové materiály a vytvoří nové.

## Tvorba a organizační služby

Engine a aplikace Lolly vytvářejí soubory. Šablony, design tokeny a povolené vstupy určují, co může kdo měnit, a renderování může zůstat na jeho zařízení. Samostatná Lolly nepotřebuje účet.

lolly.work je organizační služba ve stejném projektu, spravovaná v [samostatném repozitáři](https://github.com/lolly-tools/lolly-work) a nasazovaná vedle Lolly. Přidává identitu, sdílené úložiště, zásady, schvalování a reporting. Obě části jsou open source pod MPL-2.0. Díky oddělení může jednotlivec používat Lolly nezávisle a organizace provozovat kombinované řešení na infrastruktuře, kterou sama kontroluje.

## Co kombinované řešení nabízí

| Potřeba | Lolly + lolly.work |
|---|---|
| Přihlášení a provisioning | Jednotné přihlášení OIDC, více poskytovatelů identity, provisioning uživatelů a členství ve skupinách přes SCIM 2.0 a deaktivace účtu, která zruší existující relace. Poskytovatel identity podporující jen SAML se může připojit přes most OIDC, například Keycloak. |
| Schválené šablony | Lolly definuje upravitelné vstupy šablony; lolly.work uplatňuje viditelnost pro skupiny a zásady vstupů, které zamykají hodnoty, omezují volby nebo skrývají ovládací prvky. |
| Sdílená knihovna materiálů | Nahrávání vlastněná instancí, kolekce, vlastní metadata a katalogy s řízeným přístupem a také konektory, které čtou stávající knihovny DAM a úložišť. |
| Revize | Seřazené kroky schvalování, skupiny oprávněných schvalovatelů, pravidla kvóra a oddělení povinností; revize může řídit předkládání do katalogů i doručení do cílů organizace. |
| Historie a dostupnost materiálů | Verze a návrat k předchozím verzím u materiálů vlastněných instancí, uchovávání a blokace, plánovaná dostupnost, expirace a odvolání. Připojení poskytovatelé si ponechávají vlastní historii zdroje. |
| Reporting | Počty použití a stažení materiálů, aktivita nástrojů a exportů, dashboardy a auditní stopa. Přiřazení využití se řídí zásadami telemetrie nasazení; výchozí nastavení přiřazení vyžaduje souhlas. |
| Distribuce | Odkazy s omezenou platností, které lze odvolat, sdílené kolekce, přístup hostů a doručení do nakonfigurovaných cílů organizace. |

[Provozní příručky lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) tyto funkce a jejich konfiguraci popisují. Jsou to dostupné schopnosti, nikoli funkce, kvůli kterým by bylo třeba kolem Lolly budovat další systém.

## Výběr workflow portálu

Zavedené portály nabízejí spravovaný hosting, podporu a rozsáhlá workflow DAM. [Podnikový DAM od Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) například spojuje vyhledávání materiálů, řízení přístupu, schvalovací workflow a distribuci. Porovnej přesné workflow revize a práv, které potřebuješ: Lolly poskytuje metadata a kontroly přístupu a dostupnosti, zatímco právní schválení a licenční povinnosti stále vyžadují proces organizace. Její schvalovací řetězce jsou sekvenční; nemodelují libovolně rozvětvená workflow.

Stack Lolly je mladší a [stavová stránka lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) zaznamenává jeho omezení při nasazení. Veřejný web lolly.work je zejména evaluační sandbox. Trvalé nasazení v organizaci vyžaduje perzistentní úložiště a provozovatele. Za vlastní hosting se neplatí softwarová licence za uživatele; infrastruktura a administrace ale stále stojí peníze.

Zdrojem pravdy může zůstat i stávající DAM. Katalogové konektory lolly.work zpřístupní jeho schválené materiály v Lolly, kde lidé vytvářejí nové soubory podle pravidel organizace. To je volba integrace; vlastní knihovna a schvalování Lolly jsou k dispozici, pokud chce organizace tato workflow řídit sama.

Srovnání schopností najdeš v [Jak si Lolly stojí v porovnání](/info/positioning.html) a zbytek této sady v [Lolly srovnání nástroj po nástroji](/info/compare.html). Názvy dodavatelů identifikují porovnávané produkty; Lolly s nimi není nijak spojena.
