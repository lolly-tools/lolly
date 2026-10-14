# Lolly a renderovací API

_Naposledy ověřeno: 28. září 2026._

Lolly generuje materiály ze šablon a dat na tvém zařízení, v CI nebo přes serverové API [lolly.work](https://lolly.work). Kombinované řešení pokrývá automatizované renderování i identitu, zásady a doručení kolem produkčních úloh organizace.

## Kde se překrývají

[Bannerbear](https://www.bannerbear.com/) a [Placid](https://placid.app/) generují obrázky a další média ze šablon přes API a integrace. Lolly používá stejný přístup šablony a vstupů, přičemž úlohy lze zadávat přes [režim URL](/info/url-mode.html), [CLI](/info/cli.html), dávkovou mřížku a serverové endpointy.

## Co lolly.work poskytuje

lolly.work je samostatně nasazovaná organizační služba v projektu Lolly. Spouští engine Lolly za API, uplatňuje viditelnost nástrojů a zásady vstupů a poskytuje renderované soubory a podepsané sdílené odkazy. Její [obnovitelná služba renderování](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) podporuje jednotlivé úlohy i dávky, idempotentní odesílání, stav, omezený počet opakování, zrušení a uchované výstupy. Přerušená práce může po restartu serveru pokračovat, pokud je nakonfigurováno perzistentní úložiště.

Server používá rychlou cestu renderování SVG/PNG a volitelný worker s Chromiem pro nástroje, které potřebují prohlížeč. Automatizace se ověřuje servisními tokeny a hotový výstup lze přes [řízené doručení](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) odeslat do cílů organizace. Nakonfigurovaná podepisovací identita umožňuje podepisování C2PA u podporovaného serverového výstupu.

## Kdo službu provozuje

Bannerbear a Placid nabízejí renderování jako spravované služby s vlastní infrastrukturou a integracemi. S Lolly může jednotlivec renderovat lokálně nebo může tým provozovat lolly.work na vlastní infrastruktuře. Oba repozitáře Lolly jsou open source pod MPL-2.0; vlastní hosting nemá softwarový licenční poplatek za render, zatímco výpočetní výkon, úložiště a provoz zůstávají náklady, s nimiž je třeba počítat.

Veřejný web lolly.work je evaluační sandbox, nikoli závazek produkčního hostingu. Trvalá služba vyžaduje perzistentní databázi a úložiště výstupů; nástroje závislé na prohlížeči vyžadují worker s Chromiem. [Průvodce instalací](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) a [stavová stránka](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) tyto požadavky a aktuální omezení popisují.

Lokální renderování a renderování v CI zůstávají dostupné bez organizační služby. Odeslání serverové úlohy předá její vstupy a potřebné materiály dané instanci; to se liší od cesty na zařízení. Viz [přehled kombinovaného řešení](/info/compare.html).

Bannerbear a Placid jsou ochranné známky svých vlastníků. Tato stránka popisuje, kde se řešení překrývají, a není nijak spojena ani s jedním z nich.
