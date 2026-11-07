# Lolly a renderovací API

_Naposledy ověřeno: 5. listopadu 2026._

Pokud dnes generuješ obrázky ze šablon přes API, tato stránka říká, co se změní, když si tuto výrobu provozuješ sám: na vlastním zařízení, v CI nebo na serveru, který ovládáš. [Přechod z hostovaného vykreslovacího API](/info/work-move-from-render-api.html) říká, jak na to.

## Co hostovaná vykreslovací API dělají lépe

[Bannerbear](https://www.bannerbear.com/) a [Placid](https://placid.app/) jsou spravované služby a to je skutečná výhoda. Pošleš požadavek a servery provozuje, udržuje v chodu a zátěž řeší někdo jiný.

- **Není co provozovat.** Žádný server, databáze, úložiště, aktualizace ani plánování kapacity.
- **Hostovaný editor šablon** s hotovými šablonami k úpravě.
- **Víc druhů výstupu z jednoho API.** Obě publikují koncové body pro video a PDF a Bannerbear dokumentuje také animovaný výstup, WebP a AVIF, snímky obrazovky a odstranění pozadí pomocí AI.
- **Vlastní integrace a podpora.**

Pokud je to uspořádání, které chceš, jsou tyto služby rozumná volba.

## Co ti dává vlastní provoz

- **Tvůj obsah zůstává na tvých systémech.** Vstupy, assety a výstupy žijí na infrastruktuře, kterou sis vybral. Vykreslování na zařízení nebo v CI nepotřebuje žádnou službu.
- **Pravidla žijí v nástroji.** Barvy, písmo, loga a zamčené vstupy pocházejí z tvého [designového systému](/info/brand-studio.html), takže volající může změnit jen to, co povolíš. [Lolly Work](/info/compare.html#what-runs-where) uplatňuje viditelnost nástrojů a politiky vstupů na každý požadavek.
- **Stejný nástroj všude.** Nástroj se vykresluje na notebooku, v úloze CI nebo na serveru ze stejných vstupů a lidé mohou tentýž nástroj upravovat v aplikaci.
- **Záznamy, které držíš ty.** [Potvrzení o vykreslení](/info/work-renders.html#evidence-and-identity), auditní stopa a Content Credentials tam, kde nastavíš podpisovou identitu.
- **Open source a žádný měřák.** Kód provozuješ ty a platíš za vlastní infrastrukturu.

Přebíráš práci, kterou za tebe tyto služby dělají. Trvalý server potřebuje trvalou databázi a úložiště výstupů a nástroje, které potřebují prohlížeč, potřebují pracovníka Chromium. Obojí popisuje [Instalace Lolly Work](/info/work-install.html).

## Jak si úlohy odpovídají

| Úloha | Hostované vykreslovací API | Lolly |
|---|---|---|
| Vyplnit šablonu z dat | Požadavek API pojmenovávající šablonu a její vrstvy | [URL](/info/url-mode.html), [CLI](/info/cli.html) nebo [serverové API](/info/work-automation-api.html) pojmenovávající nástroj a jeho vstupy |
| Mnoho souborů z tabulky | Dávky a kolekce | [Batch](/info/batch.html) na tvém zařízení nebo [dávky vykreslení](/info/work-renders.html#batches-with-durable-rows) na serveru |
| Čekat na výsledek nebo se dotazovat | Dotazování nebo synchronní volba | Trvalá vykreslení, na která se dotazuješ, nebo okamžité vykreslení |
| Zavolat webhook po dokončení | Ano | [Podepsané zpětné volání](/info/work-renders.html) na povolené originy |
| Dynamická URL obrázku | Ano | [Odkazy ke sdílení a URL `/render`](/info/url-mode.html) |
| Úprava šablony | Hostovaný editor | [Design](/info/using.html) na tvém zařízení |
| Agenti | Obě publikují server MCP | [MCP](/info/mcp.html) s koncovým bodem organizace pod politikou tokenu v Lolly Work |

Vlastní druhy výstupu Lolly jsou uvedeny v [Exportu](/info/exporting.html). Na serveru Work dnes trvalá vykreslení vytvářejí SVG, PNG, JPG a PDF a [video zůstává na zařízení, v CLI a v MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Co přechází a co ne

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Tvé požadavky | Migrační API Work přijímá stejný tvar | Stejné | Stejné |
| Tvé šablony | **Import** jako upravitelné dokumenty, kromě typů vrstev bez potvrzeného schématu | Jen názvy polí a náhled. Každou postav znovu | Jen názvy polí a náhled. Každou postav znovu |
| Stávající dynamické URL | Nepodporováno | Nepodporováno | Podepsané URL po změně hostitele fungují dál, s tvým starým soukromým tokenem |
| Webhooky | Registrované webhooky nejsou podporovány | `webhook_url` funguje | `webhook_success` funguje |
| Výstup WebP a AVIF | Odmítnuto jménem | Nenabízeno | WebP odmítnuto jménem |
| Animace, videa, kolekce, snímky obrazovky | Ne na migračním API | Ne na migračním API | Ne na migračním API |

To vše bylo sestaveno z veřejné dokumentace každého dodavatele a nebylo to spuštěno proti živému účtu. [Průvodce přechodem](/info/work-move-from-render-api.html#check-it-on-your-own-account) má krátký kontrolní seznam, pokud nějaký účet máš.

Přechod není všechno nebo nic. Můžeš přesunout jednu šablonu a ostatní nechat tam, kde jsou, a [odchod z Lolly](/info/work-move-from-render-api.html#leave-lolly-too) zůstává stejně otevřený: nástroje jsou prosté soubory a CLI je vykresluje bez serveru.

## Kdo službu provozuje

S Lolly jednotlivec vykresluje lokálně, nebo tým provozuje Lolly Work na vlastní infrastruktuře. Odeslání serverové úlohy posílá její vstupy a potřebné assety té instanci, což je jiné než cesta na zařízení.

Bannerbear a Placid jsou ochranné známky svých vlastníků. Tato stránka popisuje, kde se produkty překrývají, podle jejich veřejné dokumentace, a není s žádným z nich nijak spojena.
