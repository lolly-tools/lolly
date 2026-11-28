# Lolly a portály značek

_Vymezení aktualizováno: 31. října 2026. Příklad schopností dodavatele ověřen: 28. září 2026._

Pokud tvá organizace uchovává schválené assety v Bynder, Frontify, Marq nebo Brandfolder, tato stránka srovnává daný portál s Lolly a Lolly Work. Zabývá se tím, jak lidé hledají assety značky a jak z nich vytvářejí nové soubory.

<!--i:eti-folder-shared-->
## Zachování stávajícího portálu

Stávající DAM může zůstat autoritativním zdrojem. Katalogové konektory Lolly Work zpřístupňují vybranou část jeho knihovny v Lolly, kde lidé vytvářejí nové soubory podle pravidel organizace. Přístup řídí podporovaná omezení zdroje v DAM a pravidla zpřístupnění v Lolly Work. Kontrola konečného výstupu je samostatné rozhodnutí.

[Používání Lolly se stávajícím DAM](/info/use-with-dam.html) vysvětluje odpovědnosti a omezení. [Zkušenost SUSE s Brandfolder](/info/suse-brandfolder.html) zaznamenává úspěšnou integraci, která správcům pomohla řídit změny před plánovanou migrací.

Účelem Lolly je [suverenita nad obsahem](/info/content-sovereignty.html), včetně kontroly nad tvorbou a svobody vybírat systémy. Její vlastní knihovna a schvalování slouží organizacím, které se rozhodnou provozovat tyto funkce samy. [Lolly pro dodavatele DAM a implementační partnery](/info/dam-partners.html) popisuje, jak může propojený pracovní postup přidat hodnotu stávajícímu autoritativnímu systému.

<!--i:eti-award-->
## Co zavedený portál zvládá lépe

Zavedené portály nabízejí spravovaný hosting, podporu a rozsáhlé pracovní postupy pro správu assetů. [Podnikový DAM od Frontify](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kombinuje vyhledávání assetů, řízení přístupu, schvalovací postupy a distribuci. Sestava Lolly je mladší. Její schvalovací řetězce jsou sekvenční a nelze je libovolně větvit. [Stav a plán vývoje Lolly Work](/info/work-status.html) uvádí omezení nasazení.

<!--i:eti-blend-->
## Kde se překrývají

Obě řešení pokrývají schválené assety, uzamčené šablony, řízení přístupu, kontrolu a distribuci. Lolly vytváří soubory. Šablony, designové tokeny a povolené vstupy určují, co může člověk změnit, a vykreslování může zůstat na jeho zařízení. Lolly Work přidává identitu, sdílené úložiště, zásady, schvalování a přehledy na infrastruktuře, kterou organizace ovládá.

![Aktivní designový systém v Settings, zobrazený jako obálka a stránky: barvy, písmo a loga, kterými kreslí každý nástroj](/info/shots/dashboard-brand.svg)

<!--i:eti-lolly-->
## Co poskytují Lolly a Lolly Work

| Potřeba | Lolly + Lolly Work |
|---|---|
| Přihlášení a zřizování | Jednotné přihlášení OIDC, více poskytovatelů identity, zřizování uživatelů a členství ve skupinách přes SCIM 2.0 a deaktivace účtu, která zneplatní stávající relace. Poskytovatel identity podporující pouze SAML se může připojit přes můstek OIDC, například Keycloak. |
| Schválené šablony | Lolly definuje upravitelné vstupy šablony; Lolly Work uplatňuje viditelnost pro skupiny a zásady vstupů, které zamykají hodnoty, omezují volby nebo skrývají ovládací prvky. |
| Sdílená knihovna assetů | Nahrané soubory vlastněné instancí, kolekce, vlastní metadata a katalogy s řízeným přístupem plus konektory, které čtou stávající knihovny DAM a úložišť. |
| Kontrola | Uspořádané schvalovací kroky, skupiny oprávněných schvalovatelů, pravidla kvóra a oddělení pravomocí; kontrola může řídit příspěvky do katalogu a doručení do cílů organizace. |
| Historie a dostupnost assetů | Verze a návrat k předchozím verzím assetů vlastněných instancí, uchovávání a pozastavení mazání, plánovaná dostupnost, vypršení platnosti a odvolání. Připojení poskytovatelé si ponechávají vlastní historii zdrojů. |
| Licence a údaje o autorství | Lolly zaznamenává licenci každého zdroje použitého v souboru a připravuje požadované údaje o autorství; [Práva tvůrců a údaje o autorství](/info/creative-rights.html) vysvětluje, co zaznamenává a kam se údaje zapisují. Nezajišťuje vypořádání práv. |
| Přehledy | Počty použití a stažení assetů, aktivita nástrojů a exportů, přehledové panely a auditní záznam. Přiřazování použití uživatelům se řídí zásadami telemetrie daného nasazení; výchozí nastavení přiřazování vyžaduje souhlas. |
| Distribuce | Odkazy s vypršením platnosti a možností odvolání, sdílené kolekce, přístup pro hosty a doručení do nakonfigurovaných cílů organizace. |
| Veřejná stránka značky | Lolly vytváří statickou [stránku značky](/info/brand-page.html) z Lolly Design System Setup nebo příkazového řádku: loga, barvy, písmo, pravidla a příklady pro lidi, s tokeny, `DESIGN.md` a dovednostmi pro agenty. Složku hostuješ ty nebo správce zapne [hostování stránky značky](/info/work-design-system-administration.html#host-a-brand-page) v Lolly Work, které je ve výchozím stavu vypnuté. |

[Katalog a obsah](/info/work-catalog.html), [Schvalování](/info/work-approvals.html) a [Zásady a správa](/info/work-governance.html) popisují tyto funkce a jejich konfiguraci.

<!--i:eti-checklist-->
## Vyhodnoť propojený pracovní postup

Použij [postup tvorby karty události](/info/dam-production.html) k otestování přístupu ke zdrojům, povolených úprav, kontroly výstupu a doručení s vlastní knihovnou. [Co kde běží](/info/compare.html#what-runs-where) uvádí omezení společná všem srovnáním. Samotné připojení zdroje nezakládá partnerství s dodavatelem ani nezaručuje způsobilost pro každého tenanta.

[Jak si Lolly stojí ve srovnání](/info/positioning.html) obsahuje srovnání schopností. Názvy dodavatelů označují srovnávané produkty. Lolly s nimi není spojená.
