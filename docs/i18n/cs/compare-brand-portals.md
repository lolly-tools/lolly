# Lolly a brandové portály

_Naposledy ověřeno: 28. září 2026._

Pokud tvá organizace drží schválené assety v Bynder, Frontify, Marq nebo Brandfolder, tato stránka to porovnává s Lolly plus Lolly Work: jak lidé nacházejí assety značky a jak z nich vytvářejí nové soubory.

## Co zavedený portál dělá lépe

Zavedené portály nabízejí spravovaný hosting, podporu a rozsáhlé pracovní postupy správy assetů. Například [podnikové DAM Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kombinuje objevování assetů, řízení přístupu, schvalovací pracovní postupy a distribuci. Stack Lolly je mladší a jeho schvalovací řetězce jsou sekvenční, ne libovolně větvené pracovní postupy. [Stav a plán Work](/info/work-status.html) zaznamenává jeho limity nasazení.

## Kde se překrývají

Obojí pokrývá schválené assety, zamčené šablony, řízení přístupu, revizi a distribuci. Lolly soubory vytváří: šablony, designové tokeny a povolené vstupy určují, co může kdo měnit, a vykreslování může zůstat na jeho zařízení. Lolly Work přidává identitu, sdílené úložiště, politiku, schvalování a reporty na infrastruktuře, kterou organizace řídí.

![Aktivní designový systém v Settings, zobrazený jako obálka a stránky: barvy, písmo a loga, z nichž kreslí každý nástroj](/info/shots/dashboard-brand.svg)

## Co Lolly a Lolly Work poskytují

| Potřeba | Lolly + Lolly Work |
|---|---|
| Přihlášení a zřizování | OIDC jednotné přihlášení, více poskytovatelů identity, zřizování uživatelů a členství ve skupinách přes SCIM 2.0 a deaktivace účtu, která odvolá existující relace. Poskytovatel identity jen se SAML se může připojit přes most OIDC jako Keycloak. |
| Schválené šablony | Lolly definuje upravitelné vstupy šablony; Lolly Work uplatňuje viditelnost podle skupin a politiky vstupů, které zamykají hodnoty, omezují volby nebo skrývají ovládací prvky. |
| Sdílená knihovna assetů | Nahrání vlastněná instancí, kolekce, vlastní metadata a katalogy s řízeným přístupem plus konektory, které čtou existující knihovny DAM a úložiště. |
| Revize | Uspořádané kroky schvalování, způsobilé skupiny schvalovatelů, pravidla kvóra a oddělení povinností; revize může řídit odeslání do katalogu a doručení do cílů organizace. |
| Historie a dostupnost assetů | Verze a vrácení pro assety vlastněné instancí, uchovávání a zámky, plánovaná dostupnost, vypršení a odvolání. Připojení poskytovatelé drží vlastní historii zdroje. |
| Licence a uvedení autorů | Lolly zaznamenává licenci každého zdroje, který soubor používá, a připravuje uvedení, která dluží; [Tvůrčí práva a uvedení autorů](/info/creative-rights.html) vysvětluje, co zaznamenává a kde se uvedení zapisují. Práva nečistí. |
| Reporty | Počty použití a stažení assetů, aktivita nástrojů a exportů, dashboardy a auditní stopa. Přiřazení používání se řídí politikou telemetrie nasazení; výchozí nastavení přiřazení vyžaduje souhlas. |
| Distribuce | Odkazy s platností a odvolatelné, sdílené kolekce, přístup hostů a doručení do nakonfigurovaných cílů organizace. |

Tyto funkce a jejich konfiguraci popisují [Katalog a obsah](/info/work-catalog.html), [Schvalování](/info/work-approvals.html) a [Politika a řízení](/info/work-governance.html).

## Ponechání stávajícího portálu

Stávající DAM může zůstat zdrojem pravdy. Konektory katalogu Lolly Work zpřístupní jeho schválené assety v Lolly, kde lidé vytvářejí nové soubory podle pravidel organizace. To je rozhodnutí o integraci; vlastní knihovna a schvalování Lolly jsou tu pro případ, že je organizace chce provozovat sama. [Co běží kde](/info/compare.html#what-runs-where) uvádí limity, které sdílí každé srovnání.

Srovnání schopností viz [Jak se Lolly srovnává](/info/positioning.html). Názvy dodavatelů identifikují porovnávané produkty; Lolly s nimi není nijak spojena.
