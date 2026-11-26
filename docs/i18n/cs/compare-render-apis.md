# Lolly a vykreslovací API

_Poslední kontrola: 5. listopadu 2026._

Pokud generuješ obrázky ze šablon přes API, tato stránka říká, co se změní, když tuto tvorbu spustíš na vlastním zařízení, v CI nebo na serveru, který ovládáš. [Přechod z hostovaného vykreslovacího API](/info/work-move-from-render-api.html) uvádí postup.

<!--i:eti-award-->
## Co hostovaná vykreslovací API zvládají lépe

[Bannerbear](https://www.bannerbear.com/) a [Placid](https://placid.app/) jsou spravované služby: odešleš požadavek a servery provozuje někdo jiný.

- **Nic neprovozuješ.** Žádný server, databáze, úložiště, aktualizace ani plánování kapacity.
- **Hostovaný editor šablon** se šablonami připravenými k úpravám.
- **Více druhů výstupu z jednoho API.** Obě služby zveřejňují koncové body pro video a PDF a Bannerbear také dokumentuje animovaný výstup, WebP a AVIF, snímky obrazovky a odstranění pozadí pomocí AI.
- **Vlastní integrace a podpora.**

Pokud ti takové uspořádání vyhovuje, jsou tyto služby dobrou volbou.

<!--i:eti-home-->
## Co ti dává vlastní hosting

- **Tvůj obsah zůstává ve tvých systémech.** Vstupy, assety a výstupy jsou na infrastruktuře, kterou sis vybral. Vykreslování na zařízení nebo v CI nepotřebuje žádnou službu.
- **Pravidla jsou v nástroji.** Barvy, písmo, loga a uzamčené vstupy pocházejí z tvého [designového systému](/info/brand-studio.html), takže volající může měnit jen to, co dovolíš. [Lolly Work](/info/compare.html#what-runs-where) uplatňuje viditelnost nástrojů a zásady vstupů na každý požadavek.
- **Všude stejný nástroj.** Nástroj vykresluje ze stejných vstupů na notebooku, v úloze CI nebo na serveru. Lidé mohou stejný nástroj upravovat v aplikaci.
- **Záznamy máš u sebe.** [Potvrzení o vykreslení](/info/work-renders.html#evidence-and-identity), auditní záznam a Content Credentials tam, kde nakonfiguruješ podpisovou identitu.
- **Otevřený zdrojový kód bez účtování podle využití.** Provozuješ kód a platíš jen za svou infrastrukturu.

Přebíráš práci, kterou tyto služby dělají za tebe. Trvalý server potřebuje trvalou databázi a úložiště výstupů. Nástroje vyžadující prohlížeč potřebují pracovní proces Chromium. [Instalace Lolly Work](/info/work-install.html) popisuje obojí.

<!--i:eti-table-->
## Srovnání jednotlivých úkolů

| Úkol | Hostované vykreslovací API | Lolly |
|---|---|---|
| Vyplnit šablonu daty | Požadavek API určující šablonu a její vrstvy | [URL](/info/url-mode.html), [CLI](/info/cli.html) nebo [serverové API](/info/work-automation-api.html) určující nástroj a jeho vstupy |
| Mnoho souborů z tabulky | Dávky a kolekce | [Dávka](/info/batch.html) na tvém zařízení nebo [dávky vykreslení](/info/work-renders.html#batches-with-durable-rows) na serveru |
| Čekat na výsledek nebo se na něj dotazovat | Pravidelné dotazování nebo synchronní možnost | Trvalé vykreslovací úlohy, na které se dotazuješ, nebo okamžité vykreslení |
| Po dokončení zavolat webhook | Ano | [Podepsaná zpětná volání](/info/work-renders.html) na originy, které povolíš |
| Dynamická URL obrázku | Ano | [Odkazy pro sdílení a URL `/render`](/info/url-mode.html) |
| Upravit šablonu | Hostovaný editor | [Design](/info/using.html) na tvém zařízení |
| Agenti | Obě služby zveřejňují server MCP | [MCP](/info/mcp.html) s koncovým bodem organizace podle zásad tokenu v Lolly Work |

Vlastní druhy výstupu Lolly jsou uvedené v [Exportu souboru](/info/exporting.html). Na serveru Work dnes trvalé vykreslovací úlohy vytvářejí SVG, PNG, JPG a PDF a [video zůstává na zařízení, v CLI a MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Co se přenese a co ne

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Tvé požadavky | Migrační API Work přijímá stejnou strukturu | Totéž | Totéž |
| Tvé šablony | **Import** jako upravitelné dokumenty kromě typů vrstev bez potvrzeného schématu | Jen názvy polí a náhled. Každou znovu sestav | Jen názvy polí a náhled. Každou znovu sestav |
| Stávající dynamické URL | Nepodporované | Nepodporované | Podepsané URL fungují i po změně hostitele s tvým původním soukromým tokenem |
| Webhooky | Registrované webhooky nejsou podporované | `webhook_url` funguje | `webhook_success` funguje |
| Výstup WebP a AVIF | Odmítnuté podle názvu | Nenabízí se | WebP odmítnutý podle názvu |
| Animace, videa, kolekce, snímky obrazovky | V migračním API nejsou | V migračním API nejsou | V migračním API nejsou |

::: note Vytvořeno podle veřejné dokumentace
Toto řešení vzniklo podle veřejné dokumentace jednotlivých dodavatelů a nebylo spuštěné proti živému účtu. Pokud máš účet, [průvodce přechodem](/info/work-move-from-render-api.html#check-it-on-your-own-account) obsahuje krátký kontrolní seznam.
:::

Můžeš přesunout jednu šablonu a ostatní nechat tam, kde jsou. [Odchod z Lolly](/info/work-move-from-render-api.html#leave-lolly-too) je stejně otevřený: nástroje jsou obyčejné soubory a CLI je vykresluje bez serveru.

<!--i:eti-building-->
## Kdo službu provozuje

S Lolly jednotlivec vykresluje místně nebo tým provozuje Lolly Work na vlastní infrastruktuře. Serverová úloha posílá své vstupy a požadované assety do této instance. Postup na zařízení je neposílá.

Bannerbear a Placid jsou ochranné známky svých vlastníků. Tato stránka podle jejich veřejné dokumentace popisuje, kde se produkty překrývají, a není spojená ani s jedním z nich.
