# Jak si Lolly stojí ve srovnání

Co Lolly dělá, co dnešní kreativní nástroje ne, a co záměrně nechává na nich.

Verzi po jednotlivých nástrojích, jednu stránku pro Canvu, Adobe, Figmu, vykreslovací API a online konvertory, najdeš v [Lolly ve srovnání, nástroj po nástroji](/info/compare.html). Každá stránka uvádí, co daný jiný nástroj dělá lépe a co místo toho dělá Lolly.

> **Stav pilotního projektu:** Lolly je prototyp v uzavřeném pilotu, ne hotový produkt, a jeho zabezpečení právě prochází přísným zpevňováním infrastruktury podle SUSE, jako příprava na podnikové měřítko. Stránka [Přijetí a řízení](/info/adoption-governance.html#status) popisuje aktuální stav.

## Dnešní nástroje

Každý kruh níže hodnotí, jak úplně daná třída produktů naplňuje danou schopnost **v podobě, v jaké se dodává dnes** - ne jak se prezentuje - a každá třída je hodnocena podle svého nejlepšího zástupce. Lolly je hodnocena stejným metrem: má na palubě jediný červený kruh, za zralost. Otevřením názvu řádku se dozvíš zdůvodnění jeho hodnocení. Sloupce jsou seřazené podle řádku Celková úplnost nahoře - průměru hodnocených řádků, s vyloučením řádku o ceně.

::: figure positioning-comparison
Úplnost schopností napříč dnešními kreativními nástroji, zkoumáno v srpnu 2026. Hodnocení: 0 chybí, 25 úroveň obcházení, 50 reálné, ale omezené nebo částečné, 75 silné s výhradami, 100 klíčová kompetence.
:::

**Poznámky k hodnocení.** Hodnocení Lolly předpokládá, že její zveřejněná tvrzení platí, a proto je zralost jejím jediným červeným kruhem: uzavřený pilot, zpevňování zabezpečení probíhá, zatím nic auditováno. Výzkum posunul několik buněk.

Canva je hodnocena podle svého nejlepšího člena rodiny, protože vlastní Affinity a Cavalry (obě rozdala zdarma v říjnu 2025). Offline a on-device vykreslování dosahuje 75 díky Affinity - desktopové sadě, která přesto vyžaduje ověřený účet a nese telemetrii, což je srážka, kterou bere i Adobe - zatímco vlastní offline režim Canvy edituje jen předem synchronizované návrhy, na jednom zařízení, s omezeným oknem. Automatické vyplňování dosahuje 50: reálné, ale uzamčené za Enterprise, asynchronní, jen text a obrázky. Hromadné generování ve Figmě vzrostlo z 25 na 50, když Buzz vydala vyplňování z tabulky (bezplatná beta, srpen 2026).

Celou plochu ovládá jedno pravidlo: Plný počet (100) na řádcích, které se dotýkají tvého obsahu nebo identity, vyžaduje schopnost použitelnou bez účtu a bez podmínky cloudu; řádky popisující samotný produkt (zralost, snadnost použití) jsou z tohoto pravidla vyňaty. Adobe to stojí body u provenience: nejširší dodávané C2PA (Photoshop, Lightroom, Premiere, Firefly) podepisuje lokálně i v cloudu, ale nikdy bez účtu Adobe a identity, tedy 75. Ze stejného důvodu to omezuje vykreslovací API na hromadném generování a automatizaci.

Provenience Lolly na 75 odráží on-device offline podepisování: architektonicky silnější, ale neauditované, a klíč zařízení se ve standardních validátorech jeví jako neověřený, dokud ho nezaštítí identita nebo vlastní certifikační autorita organizace. 50 u Penpotu přichází přes oficiální plugin Lolly Export: totéž podepisování jádrem, opt-in, otevřeně přiznané jako patřící Lolly. Penpot má na palubě také jediný kruh mimo obvyklou škálu, 90 za on-device vykreslování - plátno v prohlížeči, ukládání do vlastního suverénního cloudu (i do notebooku), soukromý export; od Lolly ho dělí jen skok na server. Cloudinary má vlastní sloupec: mediální pipeline (DAM, transformační API, CDN), a jediný cloudový sloupec, který dodává C2PA (50, protože fl_c2pa podepisuje při doručení, dosvědčuje doručeno-Cloudinary, ne vytvořeno-tebou).

Živá spolupráce funguje obráceně: Figma nastavuje měřítko srovnání (200 editorů) a párové, air-gapped P2P spojení Lolly dosahuje na Částečné. Cena je odhad, jasně tak označený: aritmetika podle ceníku na realistických mixech pozic, záměrně široká, pro měřítko, ne pro nákup. Vykreslovací API dosahují 75 na omezeních: šablony uzamčené, žádná vrstva správy brandu.

Mezera: nic, co se dnes dodává, není zároveň zaměřeno na omezení na prvním místě a offline, bez účtu a bez serveru ve vykreslovací cestě, a nikdo dosud nezkopíroval doložku o účtu. Lolly nyní nabízí i vlastní otevřené plátno - **Design**, plátno pro přímou manipulaci - ale barvy, typografie a aktiva na něm se řídí globálními hodnotami brandu, takže i volné uspořádání zůstává zaměřené na omezení.

Čím Lolly stále **není**, je neomezená návrhářská sada; designéři budou pro zakázkovou práci nadále používat Illustrator a Figmu - a když se z té práce má stát řízené, reprodukovatelné aktivum, nástroj Design přes [Importovat návrh](/info/design-import.html) přenese hotový soubor z Figmy, Penpotu, Illustratoru, InDesignu nebo PDF na plátno jako editovatelné, brandu podřízené boxy.

![Volné plátno nástroje Design, kde jsou nabízené barvy, fonty a assety vlastní značce](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Použij pro

- Rychlé generování provozně nasazených kreativních assetů (dlaždice na akce, odznaky, podpisy, upozornění)
- Volné uspořádání na otevřeném plátně (Design), kdy jednotlivé prvky - barvy, typografie, ikony, obrázky - musí zůstat v souladu s globálními prvky značky
- Import hotového návrhu z Figmy, Penpotu, Illustratoru, InDesignu nebo PDF (funkce Import a design v nástroji Design), aby ho bylo možné editovat, řídit a deterministicky znovu vykreslovat ve všech formátech Lolly
- Toky typu "one-to-many" - "vyplň tři pole, dostaň hotový asset" - včetně hromadného zpracování z tabulky/CSV v dávkové mřížce `/pro` (vlož nebo importuj řádky, jeden hotový asset na řádek, stažení jako zip)
- Trvale zapnuté, opakující se brandované výstupy
- Situace, kde záleží víc na centrální kontrole nad vyjádřením značky než na výrazové flexibilitě

Deck Studio je dobrým měřítkem toho, kam až to sahá: celá prezentace deklarovaná jako data, živě rozložená na plátně a exportovaná jako nativní editovatelný PowerPoint.

![Deck Studio v rozděleném zobrazení - snímky prezentace vypsané jako bloky vlevo, vykreslená prezentace vpravo](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Nepoužívej pro

- Zakázkový nebo vlajkový hero obsah (billboardy, velké video produkce)
- Jedinečnou kampaňovou práci, která skutečně potřebuje designéra
- Ideaci, která se musí zcela vymanit ze systému značky - otevřené plátno Lolly stále přizpůsobuje barvy, typografii a assety globálním prvkům značky, a to je právě smysl

## Inovuj pravděpodobnostně, škáluj deterministicky

Většina pitchů na téma "AI kreativa" staví model na špatnou stranu staré hranice. Písaři a iluminátoři už dávno určili, kde ta hranice leží: volně pracuješ na skice, kde lze zkusit cokoliv a nic není závazné, a pak jdeš k tiskařskému lisu, který je zastrašující právě proto, že je závazný. Skici byly místem, kde vznikalo umění. Lis byl způsob, jak se šířilo. Dva nástroje, dva úkoly, každý invenční svým vlastním způsobem, a tištěnému dílu se dalo věřit, protože lis dodržel svůj slib při každém otisku.

Lolly je ten lis, ne skica. K ideaci si přines cokoliv chceš - model, designéra, papírový ubrousek - ale ve chvíli, kdy se má nápad stát deseti tisíci assety, projde něčím, co vykresluje pokaždé stejně, ze vstupů, které si kdokoliv může zpětně přečíst. O tom to srovnání výše skutečně je: ne o tom, kdo má lepší generátor, ale o tom, kdo dokáže ten závazný krok učinit reprodukovatelným.

> Důvěřuj kreativnímu procesu, škáluj s rigorózností.

## Schvaluj nástroj, ne soubor

Každý jiný nástroj na trhu produkuje *soubor*, který se pak musí zkontrolovat - brand manažer ve vlákně na Slacku, právní oddělení kvůli disclaimeru, kolo úprav, další revize. Lolly posouvá schvalování **o krok výš proti proudu**. Pravidla značky - přesné hex kódy, licencované soubory fontů, spadávky, rozestupy - jsou napevno zakódovaná v HTML a CSS nástroje, takže šablona *nemůže* vyprodukovat asset mimo značku. Enforcement provádí samotný layout.

Takže přestaneš schvalovat výstupy a začneš schvalovat **nástroj**, který je vytváří. Schválíš ho jednou a každý asset, který kdy vyprodukuje, je předschválený už svou konstrukcí - žádný člověk v procesu, žádný cyklus revizí, bez ohledu na objem.

Toto je změna, kterou deterministický engine skutečně přináší: není to rychlejší verze starého schvalovacího procesu, ten proces odstraňuje. Pro kreativní tým je to mantinel, ne náhrada - hod pořád provádíš ty (data, text, obrázek) a kód je bowlingový mantinel, který udrží každý hod mimo žlab.

![Celá práce producenta: napsat text. Typografie, barva a rozestupy byly stanoveny při schválení nástroje](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Schvalování assetů po staru | Schvalování nástroje po lolly |
|---|---|
| Každý hotový soubor se kontroluje jednotlivě | Nástroj se kontroluje jednou |
| Požadavek → designér vytvoří → revize značky → právní kontrola → úpravy → nová revize | Jedna změna parametru → hotový asset |
| V procesu designér, brand manažer, právní oddělení i zadavatel | Jen producent sám |
| Dny na asset | Sekundy na asset |
| 10 000 assetů = 10 000 revizních cyklů | 10 000 assetů = nula (šablona už byla schválená) |

## Co to jedinečně přináší

- **Divoký designový potenciál doručený bezpečně v kontextu.** Nástroje mohou vyjádřit odvážné designové nápady v rámci napevno zakódovaných mantinelů.

- **Softwarově definovaná automatizace obsahu, která vrací hotový asset.** Vstup → finální soubor. Žádné "teď to ulož ze svého designového nástroje a dodělej postprocessing".
- **Nástroje skládají nástroje.** Jeden nástroj může vložit výstup jiného nástroje a vrátit ho jako součást jediného hotového assetu, bez jakéhokoliv propojení kódu mezi nástroji - primitiva, kterou nenabízí žádný produkt s otevřeným plátnem ani DAM šablonováním na trhu.
- **Neutralita vůči dodavatelům.** Plná kontrola nad funkcemi i náklady. Open-source engine. Nástroje a assety jsou obsah sledovaný v gitu, ne uzamčený v databázi SaaS.

První z toho lidé podceňují nejvíc. Mapa města v kvalitě pro plakát, nakreslená jako skutečně vektorové cesty silnic a vody, z rozbalovací nabídky a dvou barevných polí, které nelze nasměrovat mimo značku:

![Amsterdamské kanálové okruhy a síť silnic vykreslené od okraje k okraji vlastním inkoustem značky, každý tah umístěný šablonou, ne ručně](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Suverenita obsahu

To, k čemu se předchozí sekce sčítá, má jméno: suverenita. Tvůj mediální pipeline běží na hardwaru, který vlastníš. Tvoje značka - tokeny, fonty, loga, nástroje, které je vynucují - žije v souborech, které držíš ty, ve verzování, které řídíš ty, ne v databázi dodavatele s tlačítkem exportu. Vykreslování probíhá na zařízení před tebou, takže asset nikdy nemusí projít třetí stranou, aby vznikl, a celá cesta od vstupu k hotovému souboru je open source a prověřitelná. Kdyby zítra zmizeli všichni dodavatelé SaaS designu, nasazení Lolly by si toho nevšimlo.

Na tom záleží každému, jehož práce má přežít předplatné: rodiči, jehož fotokniha žije stejně tak na tom notebooku, jako veřejné instituci, jejíž knihovna značky podléhá pravidlům zadávání zakázek. Pro organizace - veřejné instituce, regulovaná odvětví, kohokoliv, jehož značka je strategickým aktivem, ne dekorací - je otázka "kde žije náš obsah a kdo ho může vypnout" otázkou správy, ne preferencí. Suverenita je tu vlastností architektury, ne funkcí hostingu přidanou kvůli compliance, a stránky [Zásady ochrany osobních údajů](/info/privacy.html) a [Ověř si to sám](/info/verify-yourself.html) existují proto, abys to tvrzení mohl ověřit, ne mu jen věřit.

Pod tím vším je jeden slib, formulovaný jako závazek, ne jako funkce: **co se vykresluje na tvém zařízení, je navždy zdarma.** Engine, shelly, nástroje, formáty - celá tvůrčí cesta na zařízení je open source a taková zůstane. Ten slib má mechanismus: vydaná verze je licencovaná tak, že ji nelze vzít zpět, a neexistuje žádná smlouva s přispěvateli, která by mohla dílo později přelicencovat. Celá hranice se vejde do jedné věty: vše, co se vykresluje na tvém zařízení, je navždy zdarma a open source; koordinace lidí a strojů napříč sítí je úkolem samostatné řídicí vrstvy, [lolly.work](https://lolly.work).
