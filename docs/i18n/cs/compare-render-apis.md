# Lolly a renderovací API

_Naposledy ověřeno: 28. září 2026._

Pokud dnes generuješ obrázky ze šablon přes API, tato stránka říká, jak Lolly dělá stejnou práci na tvém vlastním zařízení, v CI nebo na tvém vlastním serveru.

## Co hostovaná vykreslovací API dělají lépe

[Bannerbear](https://www.bannerbear.com/) a [Placid](https://placid.app/) balí vykreslování jako spravované služby, s vlastní infrastrukturou, integracemi a podporou. Pošleš požadavek a servery provozuje někdo jiný.

## Kde se překrývají

Obojí změní šablonu plus vstupy na média. Lolly bere vstupy z [odkazu](/info/url-mode.html), [CLI](/info/cli.html), dávkové mřížky nebo serverového endpointu.

## Jak Lolly dělá překrývající se úlohu

Tentýž nástroj se vykresluje na notebooku, v úloze CI nebo na serveru, ze stejných vstupů. Místní vykreslování a vykreslování v CI nepotřebují vůbec žádnou službu.

![Nastavení exportu Batch: název souboru, výchozí formát, jednotky, DPI a počet řádků k vykreslení](/info/shots/use-batch-toolbar.svg)

Na serveru [Lolly Work](/info/compare.html#what-runs-where) provozuje engine Lolly za API a uplatňuje viditelnost nástrojů a politiky vstupů. Jeho [obnovitelná služba vykreslování](/info/work-renders.html) podporuje jednotlivé úlohy a dávky, idempotentní odeslání, stav, omezené opakování, zrušení a uchované výstupy a přerušená práce po restartu pokračuje, je-li nakonfigurováno trvalé úložiště.

Server má rychlou cestu SVG a PNG a volitelného pracovníka Chromium pro nástroje, které potřebují prohlížeč. Automatizace se přihlašuje servisními tokeny, hotový výstup může jít přes [schválené doručení](/info/work-delivery.html) do cílů organizace a nakonfigurovaná podpisová identita přidává Content Credentials k podporovanému výstupu.

## Kdo službu provozuje

S Lolly jednotlivec vykresluje lokálně, nebo tým provozuje Lolly Work na vlastní infrastruktuře. Odeslání serverové úlohy posílá její vstupy a potřebné assety té instanci, což je jiné než cesta na zařízení. Trvalá služba potřebuje trvalou databázi a úložiště výstupů a nástroje závislé na prohlížeči potřebují pracovníka Chromium; obojí popisuje [Instalace Lolly Work](/info/work-install.html).

Bannerbear a Placid jsou ochranné známky svých vlastníků. Tato stránka popisuje, kde se produkty překrývají, a není s žádným z nich nijak spojena.
