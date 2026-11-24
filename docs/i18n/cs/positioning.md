# Jak si Lolly stojí ve srovnání

Lolly vytváří soubory v souladu se značkou na tvém vlastním zařízení, bez účtu. **Lolly Work** je server pro týmy: přihlašování, sdílené projekty, schvalování a serverové vykreslování na strojích, které provozuje tvá organizace. Obojí je open source pod MPL-2.0.

Většina týmů si nechává nástroje, které už má. Návrhová aplikace dodává návrhy, DAM zůstává hlavním zdrojem záznamů a Lolly mění schválené vstupy na hotové soubory. [Používání Lolly se stávajícím DAM](/info/use-with-dam.html) popisuje tuto kombinaci. Myšlenkou za touto kombinací je [svrchovanost nad obsahem](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Dnešní nástroje

Každý prstenec ukazuje, jak úplně daná kategorie produktů splňuje jednu potřebu. Stiskni **?** vedle řádku a uvidíš podklady, stiskni **?** vedle legendy a uvidíš, jak funguje hodnocení.

::: figure positioning-comparison
Srovnání schopností. Průzkum konkurence z dokumentace dodavatelů, od srpna do 21. listopadu 2026. Lolly a Lolly Work posouzeny 21. listopadu 2026. Hodnocení: 0 chybí, 25 náhradní postup, 50 skutečná funkce, ale omezená přístupem nebo částečná, 75 silná s výhradami, 100 klíčová schopnost.
:::

::: details Zdroje pro hodnocení, která se změnila v listopadu 2026
- Canva: [přehled změn API](https://www.canva.dev/docs/apps/rest-apis/changelog/), [servisní aplikace](https://www.canva.dev/blog/developers/canva-service-accounts/), [nápověda Brand Controls](https://www.canva.com/help/brand-control/)
- Adobe: [přehled změn InDesign API](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [ceny Adobe Express](https://www.adobe.com/express/pricing)
- Figma: [kredity pro agenty a AI](https://help.figma.com/hc/en-us/articles/42614902212887), [MCP server](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify a Bynder: [poznámky k vydání Frontify z října 2026](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear a Placid: [ceny Bannerbear](https://www.bannerbear.com/pricing/), [přehled změn Bannerbear](https://www.bannerbear.com/changelog/), [ceny Placid](https://placid.app/pricing)
- Penpot: [ceny pro vlastní hosting](https://penpot.app/pricing/self-host), [vydání](https://github.com/penpot/penpot/releases)
- Cloudinary: [provenience obsahu](https://cloudinary.com/documentation/content_provenance_and_authenticity), [ceny](https://cloudinary.com/pricing)
:::

Funkce a dosavadní výsledky mají samostatné řádky. První veřejné vydání Lolly bylo 1.0.1 dne 30. srpna 2026, její zabezpečení zatím neprošlo nezávislým auditem a důkazy o jejím využívání jsou staré jen několik měsíců. [Zavádění a správa](/info/adoption-governance.html#status) uvádí aktuální stav.

<!--i:eti-hammer-->
## Kdy sáhnout po Lolly

::: cols
## Sáhni po Lolly, když

- Opakovaně potřebuješ stejný druh souboru: karty akcí, odznaky, certifikáty, upozornění, karty pro sociální sítě
- Z jedné šablony a tabulky hodnot vzniká mnoho souborů v [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) nebo v CLI
- Barvy, písma a assety musí zůstat v mezích designového systému i na volném plátně
- Hotový návrh z Figma, Penpot, Illustrator, InDesign, Affinity nebo PDF má být upravitelný a opakovatelně použitelný ([Import návrhu](/info/design-import.html))
- Soubory musí vznikat na tvých vlastních zařízeních nebo serverech

## Sáhni po něčem jiném, když

- Pracuješ na podrobné retuši fotografií nebo ilustraci
- Navrhuješ a prototypuješ rozhraní aplikace
- Potřebuješ rozsáhlou knihovnu hotových médií a šablon hned první den
- Potřebuješ spravovanou službu s dlouhou historií provozu ve velkém měřítku
:::

Importované návrhy a sdílené designové tokeny umožňují týmu kombinovat Lolly se specializovanými aplikacemi, zatímco Lolly Work řídí sdílené assety, kontrolu a doručení.

U týmů s pečlivě spravovaným DAM začni tím, že zachováš tuto knihovnu i její správce. [Zkušenost SUSE s Brandfolder](/info/suse-brandfolder.html) zaznamenává, jak integrace podpořila zavádění a řízení změn ve schvalování. Dodavatelé DAM a implementační partneři mohou stejné uspořádání posoudit pomocí [partnerského pracovního postupu](/info/dam-partners.html).

V **Lolly Markdown Slides** se celá sada snímků zapíše jako data, průběžně se rozvrhuje a exportuje jako nativní upravitelný soubor PowerPoint.

![Lolly Markdown Slides v rozděleném zobrazení: snímky prezentace vypsané jako bloky vlevo, vykreslená prezentace s rozvržením vpravo](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## Pravidla jsou součástí nástroje

Lolly vkládá opakovaně použitelná pravidla značky do nástroje: barvy, písma, spadávku, rozestupy a povolené vstupy. Šablona pevně určuje části, které příjemce nesmí měnit. Lolly Work k této šabloně přidává skupinový přístup a politiky vstupů se schvalovacími řetězci pro příspěvky do katalogu a doručení.

Jednorázová kontrola nástroje usnadňuje opakovanou produkci, protože každý výstup přebírá jeho pravidla rozvržení. Texty, nahrané obrázky a práva k použití mohou stále potřebovat kontrolu a Lolly Work k tomu poskytuje sdílené katalogy a schvalovací kroky. Pro kreativní tým je nástroj mantinelem: dál dodáváš data, text a obrázek a nástroj udržuje každý výsledek v souladu se značkou.

![Celá práce tvůrce: napsat slova. Písmo, barva a rozestupy byly určené při vytvoření nástroje](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Další tři rozdíly:

- **Hotový soubor ze vstupů.** Dovnitř vstup, ven hotový soubor, bez „teď to ulož z návrhového nástroje a oprav“.
- **Nástroje skládají nástroje.** Jeden nástroj může vložit vykreslení jiného nástroje do jediného hotového souboru, aniž by jejich kód byl vzájemně provázaný.
- **Open source.** Engine je open source a nástroje, assety a designové tokeny jsou soubory, které můžeš uchovávat ve správě verzí nebo spravovat v Lolly Work, ne řádky v cizí databázi.

Odvážný design se vejde do mantinelů. Tuto mapu města v kvalitě pro plakát tvoří skutečné vektorové cesty silnic a vodních toků, vytvořené z rozbalovací nabídky a dvou polí barev, která nelze nastavit mimo designový systém:

![Prstence amsterdamských kanálů a síť silnic nakreslené od kraje ke kraji vlastními barvami designového systému, každý tah umístěný šablonou, ne ručně](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Inovuj pravděpodobnostně, škáluj deterministicky

Většina nabídek „kreativní AI“ staví model na špatnou stranu dávné hranice. Písaři a iluminátoři určili, kudy vede. Na skice pracuješ volně, můžeš zkusit cokoli a nic není závazné. Pak přejdeš k tiskařskému lisu, který dává výsledku konečnou podobu. Ve skicách vznikalo umění, lis ho šířil a vytištěnému dílu se dalo důvěřovat, protože lis při každém tahu dodržel svůj slib.

Lolly je ten lis. K nápadům si přizvi cokoli, model, designéra nebo hrubou kresbu, ale ve chvíli, kdy se má z nápadu stát mnoho souborů, projde něčím, co pokaždé vykresluje stejně, ze vstupů, které si kdokoli může zpětně přečíst. Výše uvedené srovnání je ve skutečnosti o tom, kdo dokáže tento krok ke konečné podobě udělat opakovatelným.

> Důvěřuj tvůrčímu procesu, škáluj důsledně.

<!--i:eti-tag-->
## Navždy zdarma

**Pokud se to vykresluje na tvém zařízení, je to navždy zdarma.** Engine, prostředí aplikace, nástroje i formáty jsou open source a vydanou verzi nelze vzít zpět. Lolly Work je také open source. Organizace platí za infrastrukturu a provoz, které si zvolí, bez softwarových licenčních poplatků za uživatele nebo vykreslení při vlastním hostingu. [Otázky a odpovědi](/info/faq.html) vyprávějí příběh za tímto slibem.

<!--i:eti-map-pin-->
## Kde je uložený tvůj obsah

Tvůrčí práce v Lolly může běžet na hardwaru, který vlastníš, a její designové tokeny, písma, loga a nástroje jsou soubory, které si můžeš ponechat. S Lolly Work jsou sdílené projekty, assety, politiky a auditní záznamy v úložišti, které konfiguruje tvá organizace. [Důvěra](/info/trust.html) vysvětluje, proč na tom záleží, a [Zásady ochrany soukromí](/info/privacy.html) a [Ověř si to sám](/info/verify-yourself.html) ti umožní tvrzení ověřit místo toho, abys nám věřil na slovo.

<!--i:eti-grid-->
## Nástroj po nástroji

[Srovnání Lolly, nástroj po nástroji](/info/compare.html) porovnává Lolly s Canva, Adobe, Figma, Penpot, portály značek, vykreslovacími API a online převodníky, každému věnuje jednu stránku a popisuje, [co kde běží](/info/compare.html#what-runs-where).
