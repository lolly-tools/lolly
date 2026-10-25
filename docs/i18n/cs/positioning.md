# Jak si Lolly stojí ve srovnání

Lolly jsou dvě části jednoho open-source projektu. **Lolly** je engine, aplikace a nástroje pro tvorbu, úpravy, převody a export na tvém zařízení, bez účtu. **Lolly Work** je organizační server, provozovaný na tvé vlastní infrastruktuře, pro přihlášení, sdílené projekty, schvalování a serverové vykreslování. Obojí je MPL-2.0. Tato stránka porovnává dvojici s ostatními způsoby, jak lidé navrhují, řídí a vytvářejí soubory.

## Dnešní nástroje

Každý kruh hodnotí, jak úplně třída produktů schopnost poskytuje, přičemž každá třída je hodnocena podle svého nejlepšího zástupce. Sloupec Lolly pokrývá Lolly a Lolly Work společně a každý řádek říká, která část co poskytuje. Otevři název řádku pro zdůvodnění jeho skóre. Sloupce jsou seřazeny podle řádku Overall completeness nahoře: průměr hodnocených řádků, s vyloučením řádku výdajů.

::: figure positioning-comparison
Srovnání schopností: výzkum konkurence a skóre z srpna 2026; pokrytí Lolly + Lolly Work revidováno 28. září 2026. Hodnocení: 0 chybí, 25 úroveň obejití, 50 skutečné, ale omezené nebo částečné, 75 silné s výhradami, 100 hlavní kompetence.
:::

::: details Poznámky k hodnocení
Dostupné funkce a produkční zralost jsou oddělené. Lolly je vydána: verze 1.0 vyšla jako open source 30. srpna 2026, její bezpečnost zatím neprošla nezávislým auditem a doklady o jejím přijetí jsou několik měsíců staré ([Adoption & Governance](/info/adoption-governance.html#status) uvádí aktuální stav). Mít jednotné přihlášení, schvalování nebo serverové vykreslování nezakládá produkční historii, takže skóre zralosti to odráží. Skóre konkurentů si drží datované srpnové hodnocení.

Tabuli řídí jedno pravidlo. Plný počet bodů (100) na řádcích, které se dotýkají tvého obsahu nebo identity, vyžaduje schopnost použitelnou bez účtu a bez cloudové předpodmínky; řádky o samotném produktu, jako zralost a snadnost použití, jsou vyňaty. Toto pravidlo stojí Adobe body u Content Credentials: nejširší dodávaná implementace (Photoshop, Lightroom, Premiere, Firefly) podepisuje lokálně i v cloudu, ale nikdy ne bez účtu a identity Adobe, takže 75. Ze stejného důvodu omezuje vykreslovací API u hromadné generace a automatizace.

Canva se hodnotí podle svého nejlepšího člena rodiny na řádek, protože vlastní Affinity a Cavalry (obojí rozdáno v říjnu 2025). Offline a vykreslování na zařízení dostává 75 přes Affinity, desktopovou sadu, která stále potřebuje ověřený účet a nese telemetrii, srážku, kterou si bere i Adobe; vlastní offline režim Canvy upravuje jen předem synchronizované návrhy, na jednom zařízení, po omezenou dobu. Automatické vyplňování dostává 50: je skutečné, ale omezené na Enterprise a asynchronní a vyplňuje jen text a obrázky. Hromadná generace Figmy vzrostla z 25 na 50, když Buzz uvedl vyplňování z tabulky (bezplatná beta, srpen 2026).

Skóre 75 u Content Credentials Lolly pokrývá podepisování na zařízení a serverové podepisování Lolly Work s nakonfigurovanou identitou organizace; ověřovatel musí podepisovateli stále důvěřovat ([Content Credentials Identity](/info/content-credentials-identity.html)). Penpotových 50 vzniká přes vlastní exportní plugin Lolly pro Penpot: totéž podepisování enginem, výslovné a zveřejněné jako Lolly. Penpot dostává 90 za vykreslování na zařízení: plátno prohlížeče s cílem uložení na jeho serveru, který lze hostovat samostatně. Cloudinary dostává vlastní sloupec za svou knihovnu assetů, transformační API a CDN; srpnové hodnocení ohodnotilo jeho podepisování doručování 50.

Živá spolupráce Lolly zahrnuje přímé soukromé kolaborace dvou zařízení a ověřené pracovní kolaborace přes Lolly Work, se sdílenými úpravami, kurzory a uloženými týmovými relacemi. Skóre Partial odráží dnešní jednouzlové pracovní nasazení a krátkou provozní historii, ne nepřítomnost týmových úprav. Odhady cen jsou datovaná aritmetika ceníku pro měřítko, ne zadávání zakázky.
:::

## Kdy sáhnout po Lolly

::: cols
## Sáhni po Lolly, když

- Stejný druh souboru je potřeba pořád dokola: dlaždice akcí, jmenovky, certifikáty, upozornění, sociální karty
- Mnoho souborů vzniká z jedné šablony a tabulky hodnot, v [Batch](/info/batch.html#make-many-versions-of-one-design) nebo CLI
- Barvy, písmo a assety musí zůstat uvnitř designového systému, i na otevřeném plátně
- Hotový návrh z Figmy, Penpotu, Illustratoru, InDesignu nebo PDF má být upravitelný a opakovatelný ([Import návrhu](/info/design-import.html))
- Soubory musí vznikat na tvých vlastních zařízeních nebo serverech

## Sáhni po něčem jiném, když

- Jde o detailní retuš fotografií nebo ilustraci
- Navrhuješ a prototypuješ rozhraní aplikace
- Potřebuješ velký fond fotek a šablon připravený hned první den
- Potřebuješ spravovanou službu s dlouhou historií ve velkém měřítku
:::

Importované návrhy a sdílené designové tokeny umožňují týmu kombinovat Lolly se specializovanými aplikacemi, zatímco Lolly Work řídí sdílené assety, revizi a doručení.

Celá sada snímků ukazuje strop: v **Markdown Slides** je sada deklarována jako data, rozvržena živě a exportována jako nativní upravitelný soubor PowerPoint.

![Markdown Slides v rozděleném zobrazení: snímky sady vypsané jako bloky vlevo, rozvržená sada vykreslená vpravo](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Pravidla žijí v nástroji

Lolly dává opakovaně použitelná pravidla značky do nástroje: barvy, písma, okraje spadávky, mezery a povolené vstupy. Šablona pevně určuje části, které příjemce nesmí měnit. Lolly Work přidává kolem té šablony přístup podle skupin a politiky vstupů, se schvalovacími řetězci pro odeslání do katalogu a doručení.

Jednorázová kontrola nástroje usnadňuje opakovatelnou výrobu, protože každý výstup zdědí svá pravidla rozvržení. Text, nahrané snímky a práva k užití mohou stále vyžadovat kontrolu a Lolly Work dodává sdílené katalogy a kroky schvalování pro ně. Pro tvůrčí tým je nástroj svodidlo: data, text a obrázek stále přinášíš ty a nástroj udržuje každý výsledek ve značce.

![Celá práce výrobce: napsat slova. Písmo, barva a mezery byly určeny při tvorbě nástroje](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Tento přístup odlišují ještě tři věci:

- **Hotový soubor ze vstupů.** Vstup dovnitř, hotový soubor ven, bez "teď to ulož z návrhového nástroje a dolaď".
- **Nástroje skládají nástroje.** Jeden nástroj může vložit vykreslení jiného nástroje do jednoho hotového souboru, bez vazby kódu mezi nimi.
- **Otevřené až do dna.** Engine je open source a nástroje, assety a designové tokeny jsou soubory, které můžeš držet ve správě verzí nebo spravovat v Lolly Work, ne řádky v cizí databázi.

Odvážný návrh svodidla přežije. Tato mapa města v kvalitě plakátu jsou skutečné vektorové cesty silnic a vody, z rozbalovací nabídky a dvou barevných polí, která nelze nasměrovat mimo designový systém:

![Amsterdamské okruhy kanálů a silniční síť nakreslené od okraje k okraji vlastním inkoustem designového systému, každý tah umístěný šablonou, ne ručně](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Inovuj pravděpodobnostně, škáluj deterministicky

Většina "kreativních" nabídek s AI staví model na špatnou stranu staré hranice. Písaři a iluminátoři ji vyřešili. Na skice pracuješ volně, kde lze cokoli zkusit a nic se nezavazuje. Pak jdeš k tiskařskému lisu, který zavazuje. Skici byly místem umění a lis byl způsobem, jak se šířilo, a vytištěné dílo mohlo být důvěryhodné, protože lis dodržel slib při každém otisku.

Lolly je lis. Přines k nápadům, co chceš, model, designéra nebo hrubou kresbu, ale ve chvíli, kdy se nápad musí stát mnoha soubory, projde něčím, co se vykresluje pokaždé stejně, ze vstupů, které si kdokoli přečte zpět. Srovnání výše je ve skutečnosti o tom, kdo tento zavazující krok činí opakovatelným.

> Důvěřuj kreativnímu procesu, škáluj s rigorózností.

## Zdarma navždy

**Pokud se to vykresluje na tvém zařízení, je to zdarma navždy.** Engine, shelly, nástroje a formáty jsou open source a vydaná verze nelze vzít zpět. Lolly Work je také open source. Organizace platí za infrastrukturu a provoz, které si zvolí, bez poplatku za softwarovou licenci na uživatele či vykreslení při samostatném hostování. [Otázky a odpovědi](/info/faq.html) vypráví příběh za tímto slibem.

## Kde žije tvůj obsah

Tvůrčí práce Lolly může běžet na hardwaru, který vlastníš, a její designové tokeny, písma, loga a nástroje jsou soubory, které můžeš uchovat. S Lolly Work žijí sdílené projekty, assety, politika a auditní záznamy v úložišti, které tvá organizace nakonfiguruje. [Důvěřuj](/info/trust.html) vysvětluje, proč na tom záleží, a [Zásady ochrany soukromí](/info/privacy.html) a [Ověř si to sám](/info/verify-yourself.html) ti umožňují tvrzení ověřit, místo abys nám věřil na slovo.

## Nástroj po nástroji

[Lolly srovnaná nástroj po nástroji](/info/compare.html) porovnává Lolly s Canvou, Adobe, Figmou, Penpotem, portály značek, vykreslovacími API a online převodníky, po jedné stránce, a uvádí [co běží kde](/info/compare.html#what-runs-where).
