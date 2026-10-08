# Používání Lolly

Praktický průvodce tím, jak aplikaci opravdu *používat* - otevřít nástroj, pracovat s plátnem, exportovat, ukládat a sdílet. Všechno tady běží **na tvém zařízení**: žádný účet, žádné nahrávání a žádný internet pro obrazovky, které jsi už otevřel/a.

> Jsi tu poprvé? [Rychlý start](/info/quickstart.html) tě během pár minut posadí k tvorbě a [Lolly pro operátory](/info/operators.html) popisuje instalaci a nasazení aplikace; tahle stránka je o tom, jak ji ovládat, jakmile je otevřená.

## Otevření nástroje

Domovská obrazovka je **galerie** - všechny nástroje, seskupené podle kategorie. Klikni na kartu a začneš v tomto nástroji něco nového; [uložená práce](#saving-continuing) se znovu otevře z karty **Projekty**. Vyhledávací pole filtruje podle názvu - nebo použij [Hledat](/info/search.html) na liště u paty šesti přehledových obrazovek (galerie, Utility, Projekty, Assety, Přehled a Nastavení), která kromě nástrojů sáhne i do tvé uložené práce, do tvých assetů a do nastavení. Uvnitř nástroje lišta ustoupí ovládacím prvkům samotného nástroje.

![Karta galerie s ukázkovou navigací a akcí Nový](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Každý nástroj je rozdělené zobrazení: na jedné straně **ovládací prvky**, na druhé živý **náhled** (plátno). Změň libovolný ovládací prvek a náhled se okamžitě aktualizuje.

![Rozdělené zobrazení nástroje - sada ovládacích prvků vlevo a živě vykreslovaný skupinový sloupcový graf vpravo](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

> Několik nástrojů (jako **Design**) se místo toho otevře jako **volné plátno** - plocha bez rozhraní pro přímou manipulaci, kde přetahuješ, měníš velikost, otáčíš a přichytáváš boxy s textem, tvary a obrázky a dvojklikem upravuješ text přímo na místě. Exportuje se stejnou vykreslovací cestou jako každý jiný nástroj, takže plátno *je* soubor. Viz [Volné plátno](#the-free-canvas-design) níže.

Dva způsoby, jak si mřížku přetvořit k obrazu svému:

- <!--i:star--> **Označ hvězdičkou, co používáš.** Dej kartě ★ a dostane vlastní velkou dlaždici v pruhu nad mřížkou - viz [Tvoje oblíbené](/info/favourites.html).
- <!--i:eyeoff--> **Skryj nástroj, který nikdy nepoužiješ.** Klikni na kartu pravým tlačítkem (nebo vyber několik karet a použij lištu výběru) → **Skrýt nástroj**. Vypadne z mřížky i z toho, co najde psaní v mřížce; šedá dlaždice **Zobrazit skryté nástroje (N)** úplně na konci je znovu odhalí, ztlumené, každou s **Zrušit skrytí** ve vlastní nabídce. Skrytí se týká jen tvojí mřížky - nástroj se pořád otevře z uloženého odkazu nebo ze záložky a pro všechny ostatní zůstává přesně tam, kde byl.

![Konec mřížky Nástroje s odhalenými skrytými nástroji: ztlumená karta QR Code Generator a vedle ní šedá dlaždice, která ji vrátila do zobrazení, teď s popiskem Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-bulk%3D%22hide%22%5D%3Bwait%3A300%3Bclick%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed it. The alt says so rather than quoting the resting
label the prose above already gives.
There is no standalone per-card "hide" button
(unlike the always-visible fav/pin corner icons) - Hide only exists inside a
tile's right-click menu or the bulk bar, both confirmed in views/gallery.ts.
The recipe goes the bulk-bar route since it needs no `|right` context-menu
step: tick the card (`[data-select="qr-code"]`, the same checkbox hook the
selection bullet under Projects uses), click the bar's Hide button
(`[data-bulk="hide"]` - the literal `data-bulk` value bulkBarHtml() writes,
confirmed in lib/bulk-bar.ts), then click the grey reveal tile
(`.gtile--hiddenbox`, confirmed in gallery.ts).
-->

Chceš-li provést akci na několika kartách najednou, zaškrtni políčko u každé karty, přetáhni výběrový obdélník přes prázdnou plochu nebo použij **Shift/Cmd-klik**, a objeví se plovoucí lišta akcí. **Co lišta výběru nabízí**, se podle zobrazení trochu liší, protože ne každá akce dává všude smysl:

- **Nástroje / Utility:** Oblíbené (nebo Odebrat z oblíbených), Skrýt (nebo Zrušit skrytí), Dostupné offline (nebo Odebrat z offline), **Zobrazit relace** (otevře Projekty a ukáže jen relace vytvořené těmito nástroji) a Zkopírovat odkaz, když je vybraná přesně jedna karta.
- **Assety:** Oblíbené a Skrýt platí pro jakýkoli výběr; Duplikovat, Stáhnout a Smazat se objeví, teprve když je každá vybraná položka tvůj vlastní nahraný soubor - sdílený asset design systému je trvalý závazek, takže se ho ty tři nedotknou ani hromadně.
- **Projekty:** viz [Najdi a obnov svou práci](/info/find-your-work.html#find-something-you-saved).

> Past v pojmenování: **Zobrazit relace** existuje, jen když je něco *vybráno*. Kliknutí pravým tlačítkem na jednu nevybranou dlaždici místo toho nabídne **N uložených session**, což otevře seznam uložených relací daného nástroje, kde smazání přesune relaci do Koše místo přechodu do Projektů.

![Lišta výběru v galerii pro dva nástroje, nabízející Dostupné offline, Zobrazit relace, Oblíbené a Skrýt](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
<!--
SHOT NOTE (misc-bulkbar-gallery): drive targets `[data-select="qr-code"]` /
`[data-select="gradient"]` - the `.tile-check[data-select="<ref>"]` checkbox button
confirmed directly in views/gallery.ts's card markup (the same attribute
cardMarkup gives every tile), so these two clicks tick both cards without
opening either tool.

SHOT NOTE (misc-sessions-by-tool, NOT PUBLISHED): the "View sessions" result
had a recipe of its own (`/#/p?tools=qr-code,d3`, views/projects.ts's
toolsBodyHtml()), dropped here because it has no `drive=` that can
manufacture its own content - a saved session isn't a click away, it has to
already exist, and build-docs-shots.ts gives every shot a fresh
`browser.newContext()`. It would publish an empty list. Same dependency the
`projects` shot (now on find-your-work.md) carries; revisit if the pipeline gains a
storage-seeding hook.
-->

### Ask Lolly

Když se radši zeptáš, než abys hledal/a, **Ask Lolly** (`#/ask`) vezme napsanou otázku a vrátí odpovídající část téhle dokumentace **doslova** - vlastními slovy průvodců, ne jako shrnutí a ne jako vygenerovaný text - s citovanou stránkou, ze které pochází, a s odkazem **Otevřít v dokumentaci** vedle ní. Pod odpovědí jsou místa v aplikaci, kterým stejná otázka odpovídá: nástroj, nastavení, uložený projekt, každé jako tlačítko, které tě tam prostě přenese.

Přepis je paměť relace: polož doplňující otázku a vlákno se ti postupně nabaluje, po znovunačtení začíná načisto. Výsledky hledání mají dole řádek **Ask Lolly: *tvůj dotaz*** - pod konkrétními nálezy, které našly ostatní skupiny - který otázku předá rovnou sem, takže můžeš začít v liště a dokončit to tady.

## Plátno (náhled)

Náhled vždy zobrazuje přesně to, co se exportuje.

**Desktop**

- **Přiblížení:** Cmd/Ctrl + kolečko myši, nebo sevření prstů na trackpadu - přiblížení se vystředí na tvůj kurzor.
- **Posun:** podrž **Space** a táhni, nebo táhni **prostředním tlačítkem myši**. (Obyčejné kliknutí zůstává volné pro klikání na části návrhu.)
- **Klávesnice:** `0` = přizpůsobit oknu · `1` = 100% · `+` / `−` = přiblížení.
- **HUD přiblížení:** malý ovládací prvek `−  NN%  +  Fit` v rohu. Klikni na procenta a přepneš mezi Přizpůsobit ↔ 100 %.

![HUD přiblížení v rohu plátna - mínus, živé procento, plus, Fit, pak přepínače motivu a zvuku](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

**Dotyk**

- **Sevření prstů** pro přiblížení, **tažení** pro posun, **dvojité ťuknutí** pro návrat na přizpůsobené zobrazení.

**Kliknutím přejdeš na ovládací prvek:** klikni na libovolný prvek v návrhu a odpovídající vstup v postranním panelu získá fokus a posune se do viditelné oblasti - u opakující se skupiny řádků se rozbalí přesně ten řádek, na který jsi klikl/a, takže úprava toho, co vidíš, je na jedno ťuknutí.

Změna rozměrů vždy vrátí zobrazení zpět na čisté přizpůsobení.

### Volné plátno (Design)

Nástroje s volným plátnem přidávají pracovní plochu *kolem* kresebné plochy, jako grafikova podložka:

- **Odkládání mimo plátno.** Přetáhni box za okraj rámu a zůstane plně **viditelný a vybratelný** - zaparkuj prvky stranou, zatímco skládáš kompozici, a pak je přetáhni zpátky dovnitř. Všechno mimo rám je **jemně ztlumené**, takže exportovaná oblast je vždy na první pohled zřejmá, a rám si drží svůj stín, který přesně vyznačuje, kde soubor začíná.
- **Exportuje se jen rám.** Exportovaný soubor je ohraničený kresebnou plochou - cokoli zůstane venku (nebo část boxu přesahující přes okraj) se z výstupu jednoduše ořízne, u rastrových i vektorových formátů stejně.
- **Oddal se pod úroveň Přizpůsobit** (až na 20 %), abys viděl/a celou podložku, když máš prvky odložené daleko mimo rám.
- **Kresebná plocha se dá zvětšovat.** Změna exportních rozměrů změní velikost rámu na místě; boxy si zachovají své pozice, takže můžeš rozložení přerámovat kolem existujícího obsahu.
- **Před exportem.** Sekce Dokument v inspektoru zkontroluje uloženou strukturu vrstev a pak zkontroluje ustálené plátno kvůli oříznutému textu a plochému barevnému kontrastu. Zeptá se také stejného registru písem, jaký používá obrysování SVG/PDF, jestli má každý textový úsek vložitelná data písma; obrázková a přechodová pozadí jsou označena jako vizuální kontroly místo toho, aby dostala vymyšlené skóre kontrastu.

![Volné plátno Designu - kresebná plocha a okolní podložka](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

**Převrať výběr.** Klikni pravým na jakýkoli box a zvol **Flip horizontal** nebo **Flip vertical** pro jeho zrcadlové převrácení na místě, nebo stiskni `Shift+H` / `Shift+V` na klávesnici - Shift proto, že samotné `V` je nástroj Pointer. Každý vybraný box se zrcadlí podle vlastní osy v jednom kroku zpět a zrcadlení je skutečná transformace, takže se drží i v exportovaném SVG, PDF a PNG, ne jen na plátně.

### Vrstvy a Inspektor

V panelu **Vrstvy** je každá kresebná plocha sbalitelná nadřazená skupina. Vyber její název a přeskočíš tam, rozbal její vrstvy a vybírej nebo přeskládávej objekty v rámci té kresebné plochy. Přepni na **Stránky** pro náhledy a řazení stránek. Šipky se pohybují po seznamu vrstev; šipka doleva se vrátí na nadpis kresebné plochy.

**Inspektor** dává na první místo textové nebo obrázkové ovládací prvky pro vybraný objekt. Použij volitelné čipy pro rychlé volby a rozbal **Advanced** pro podrobnosti stylování. Na telefonech otevři **Inspektor** z **Další akce**. Ovládací prvky se otevřou v panelu; Escape nebo Zpět ho zavře a zachová tvůj výběr.

### Kreslení vlastních tvarů (pero)

Boxy, kruhy a zaoblené rámečky pokryjí většinu rozložení. Když potřebuješ tvar, který v tom seznamu není, nakresli si ho: tlačítko **Pero** na liště (nebo klávesa `P`) tě přepne do režimu kreslení. Mezi režimy se přechází třemi klávesami - **`V`** zpět na Ukazatel, **`P`** na Pero, **`N`** na nástroj pro body (**Upravit body**) - a Ukazatel je vždycky cesta ven z čehokoli, v čem právě jsi.

![Lišta nástrojů volného plátna: úchyt pro tažení, nabídka Lolly, pak Ukazatel, Přidat rámeček, Pero, Upravit body, Čára, Časová osa, Kresebné plochy a Automaticky uspořádat](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2600&css=.fc-toolbar%7Bopacity%3A1!important%7D&cropSelector=.fc-toolbar&walker=1&format=svg&dark=1&filename=pen-editor-rail)

- **Klikni** a umístíš bod. U výchozího typu křivky **klikni a táhni**, čímž z bodu vytáhneš úchopy, a tak nakreslíš křivku místo rohu - když při kliknutí podržíš **Alt**, dostaneš ostrý roh. (U ostatních typů křivek je každý umístěný bod roh a tažení nedělá nic; viz **Typ spline** níže.)
- Body se při umísťování přichytávají ke kresebné ploše a k tvým ostatním boxům a kreslí stejná vodítka jako běžné tažení. Alt při kreslení potlačí mřížku a při pozdějším tažení bodu mřížku i hrany.
- **Klikni na svůj první bod** a smyčku uzavřeš i dokončíš jedním pohybem. Jinak stiskni **Enter**, klikni dvakrát nebo prostě přepni nástroj - kresba se zachová, nezahodí se.
- **Escape** funguje po jedné příčce: první stisk kresbu opustí a nic nezapíše, druhý ukončí pero.
- **Delete** během kreslení zahodí poslední bod, který jsi umístil/a.

Výsledkem je obyčejný box na plátně. Posouvej ho, měň mu velikost, otáčej ho, seskupuj ho, zarovnávej ho, přeskládej ho, dej mu výplň, přechod, stín nebo průhlednost - cesta se chová jako každý jiný box a žádný z těch ovládacích prvků s ní nezachází jinak.

A přichází rovnou obarvená. První cesta, kterou nakreslíš, dostane výplň a tah, jaké cestám dává tvoje značka, a každá další pak dostane **to, co jsi použil/a naposledy** - nastav výplň jednou a kresli dál, místo abys přebarvoval/a každý tvar. (V nástroji, jehož značka o cestách nic neříká, se nakreslená cesta obtáhne barvou, ve které jsi ji viděl/a vznikat, takže nikdy není neviditelná.)

**Úprava bodů kdykoli později.** Klikni na tvar dvakrát (nebo použij **Upravit body** na liště objektu) a body se vrátí. Tažením bodu ho přesuneš, tažením úchopu ho přemíříš, kliknutím kamkoli na křivku vložíš bod, výběrovým obdélníkem označíš skupinu bodů a klávesou Delete vybrané odstraníš. Cesta si vždy nechá aspoň dva body, takže ji nemůžeš omylem smazat úplně.

**Typ spline** rozhoduje o tom, jaká křivka tvými body prochází, a je to volba, kterou stojí za to pochopit:

| Typ | Co dělá |
|---|---|
| **Hladký (automaticky)** | Výchozí volba. Délky úchopů si dopočítá sám, takže prosté klik-klik-klik dá opravdu hladkou křivku bez zápasení s úchopy. Když úchop přece jen nastavíš, zafixuje se *směr* a délka zůstane v režii křivky. |
| **Bézierovy úchopy** | Klasické pero. Úchopy jsou řídicí body a vložení bodu křivkou nikdy nepohne. |
| **Skrz body** | Prochází přesně každým bodem, který jsi umístil/a, bez úchopů. |
| **B-spline** | Plyne kolem bodů, ne skrz ně, pro měkčí tvar. |
| **Rovné čáry** | Lomená čára. |

Přepnutí existující cesty na typ, který si úchopy počítá sám, se nejdřív zeptá, protože délky úchopů, které jsi nastavil/a, už nejdou obnovit - přepnutí na **Bézierovy úchopy** je vždycky beze ztráty. Během kreslení se nic neptá: přepnutí se rovnou promítne do rozpracované kresby a případné už vytažené úchopy jdou s ním. U typů, které si úchopy drží samy, vložení bodu křivku nepatrně přetvaruje; u **Bézierových úchopů** ne.

Každý bod navíc nese pravidlo spojitosti, které je vidět na jeho tvaru na plátně - čtvereček pro **Roh** (úchopy se pohybují nezávisle), kolečko pro **Hladký** (úchopy zůstávají v přímce), kolečko s prstencem pro **Symetrický** (v přímce a stejně dlouhé). Nastav ho pro libovolné vybrané body a křivka mu okamžitě znovu vyhoví.

![Dvě perové cesty vykreslené rovnou z odkazu: obtažená křivka do S a uzavřená vyplněná skvrna](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22curve%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A140%2C%22y%22%3A180%2C%22w%22%3A800%2C%22h%22%3A420%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A14%2C%22path%22%3A%221!cubic!0_.02!.85!!!.25!-.45!s_.5!.5!-.22!.32!.22!-.32!y_.98!.12!-.25!.45!!!s%22%7D%2C%7B%22id%22%3A%22blob%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A340%2C%22y%22%3A620%2C%22w%22%3A400%2C%22h%22%3A320%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23d1e7ff%22%2C%22stroke%22%3A%22%234f84ba%22%2C%22strokeW%22%3A6%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!catmull-rom!1_.5!0_1!.42_.78!1_.22!1_0!.42%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=pen-path-geometry)

Nakreslená cesta cestuje v odkazu jako všechno ostatní, takže tvar, který nakreslíš, se znovu otevře ze sdíleného odkazu a z CLI se vykreslí stejně. Nic na ní nezávisí na editoru.

### Kombinování tvarů (operace s cestami)

Vyber dva a víc tvarů, **klikni pravým tlačítkem** na plátno (na dotyku ťukni dvěma prsty) a nabídka nabídne operace, jaké od kreslicí aplikace čekáš:

- **Sjednotit** je sloučí do jednoho tvaru a zachová barvu toho nejvrchnějšího.
- **Odečíst** odřízne od spodního tvaru všechno nad ním.
- **Průnik** ponechá jen překryv.
- **Vyloučit** ponechá všechno kromě překryvu.

Další tři pracují s jedním tvarem: **Obrys tahu…** promění tah ve vyplněný tvar stejného obrysu (hodí se, když chceš udržet tloušťku přesně tak, jak je nakreslená), **Posunout cestu…** siluetu nafoukne ven nebo ji se záporným číslem stáhne dovnitř a **Zjednodušit** cestu přestaví s méně segmenty při stejném tvaru.

![Půlměsíc a prstenec se skutečnou dírou, oba vzniklé operací Odečíst](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%5B%7B%22id%22%3A%22paper%22%2C%22kind%22%3A%22box%22%2C%22x%22%3A0%2C%22y%22%3A0%2C%22w%22%3A1080%2C%22h%22%3A1080%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%23ffffff%22%7D%2C%7B%22id%22%3A%22crescent%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A120%2C%22y%22%3A330%2C%22w%22%3A374%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22path%22%3A%221!cubic!1_.750491!.957645!-.128211!-.062578!-.065985!.027232!c_.534759!1!.076762!!-.295339!!c_0!.5!!.276142!!-.276142!c_.534759!0!-.295339!!.200102!!c_1.000984!.254923!-.09169!-.152161!-.021205!-.003239!c_.935829!.25!.022185!!-.221505!!c_.534759!.625!!-.207107!!.14459!c%22%7D%2C%7B%22id%22%3A%22ring%22%2C%22kind%22%3A%22path%22%2C%22x%22%3A580%2C%22y%22%3A330%2C%22w%22%3A400%2C%22h%22%3A400%2C%22shape%22%3A%22rect%22%2C%22bg%22%3A%22%234f84ba%22%2C%22fillRule%22%3A%22nonzero%22%2C%22path%22%3A%221!cubic!1_1!.5!!-.276142!!.276142!c_.5!1!.276142!!-.276142!!c_0!.5!!.276142!!-.276142!c_.5!0!-.276142!!.276142!!c*1!cubic!1_.5!.7!-.110457!!.110457!!c_.7!.5!!.110457!!-.110457!c_.5!.3!.110457!!-.110457!!c_.3!.5!!-.110457!!.110457!c%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=path-ops-boolean-result)

Výsledkem je nová cesta, kterou můžeš dál upravovat perem. Díry jsou skutečné díry - ovládací prvek **Pravidlo výplně** v panelu tahu rozhoduje, jestli se překrývající obrysy vyplní (*non-zero*), nebo prorazí skrz (*even-odd*).

Dvě věci tyhle operace záměrně nedělají. **Raději odmítnou, než by zničily**: zkus udělat průnik dvou tvarů, které se nepřekrývají, a dozvíš se, že není co ponechat, a nic se nezmění. A textové a obrázkové boxy nemají obrys, se kterým by šlo pracovat, takže je nechají být, místo aby je nahradily jejich rámečkem. Zkombinovaný výsledek se ukládá jako obyčejné Bézierovy křivky, což dělá i kreslicí aplikace - původní typ spline operaci nepřežije.

### 3D scény

Zvol **3D scéna** z nabídky přidávání na liště nástrojů a vytáhni rámeček: 3D Studio se rovnou otevře na novém boxu a to, co tam nastavíš, se vrátí na plátno. Ve všem ostatním je box scény obyčejný box. Posouvej ho, měň mu velikost, otáčej ho, dej mu stín, dej ho na snímek nebo na časovou osu a chová se stejně jako všechny ostatní.

**Box scény uchovává recept, ne obrázek.** Obrázkový box drží vykreslený soubor; box scény drží jedno nastavení - samotnou scénu, zapsanou jako vlastní odkazový dotaz 3D Studia, s vynechanou každou hodnotou, která zůstává na výchozí hodnotě studia. Proto scéna váží kolem sta bajtů místo pár kilobajtů, které stojí celý recept, proto stejný řetězec funguje jak v odkazu ke sdílení, tak ve dveřích editoru, a proto nový ovládací prvek studia nevyžaduje žádnou změnu v Designu. Je to taky důvod, proč se box znovu vykresluje v jakékoli velikosti a chvíli, jakou dokument potřebuje, místo aby se zvětšoval z dřív pořízeného obrázku. Obrázky, které scéna používá, zůstávají assety a cestují podle id, takže nahrání souboru uvnitř scény jde do souboru `.lolly` spolu se zbytkem dokumentu.

**Uprav ji ve studiu.** Vyber box a Inspektor ukáže sekci **3D scéna**: řádek pojmenovávající, z čeho je scéna udělaná, druhý pojmenovávající její světelné studio, jakmile si nějaké vybereš, a jedno tlačítko, **Upravit ve 3D Studiu**. Tlačítko otevře studio na scéně toho boxu se všemi ovládacími prvky, které nástroj má. Použij a upravená scéna se zapíše zpátky jako jeden krok, takže jedno zpět vrátí box ke scéně, od které jsi začal/a; zavři studio bez použití a nic se nezmění. Všechno ostatní na boxu - jeho místo na kresebné ploše, jak je velký, jeho stín, kdy se objeví na snímku - zůstává v sekcích, které vždycky používal. Box scény nemá vlastní obrázek ani popisek: jeho obrázek pochází ze studia a tam se nastavují i jeho slova.

**Jedna živá scéna, plakát na každém dalším boxu.** Každý 3D box v dokumentu ukazuje plakát: nehybný obrázek scény, vykreslený mimo obrazovku přes sdílený fond vykreslovačů, ve velikosti, jakou box zabírá. Dokument s dvaceti scénami stojí jeden vykreslovací kontext, ne dvacet. Vyber box scény a stane se jedinou živou scénou dokumentu; zruš výběr a rámeček, který byl na obrazovce, se stane jeho plakátem, takže nic neškubne. Živá je vždy jen jedna scéna, a když vybereš dva boxy scén najednou, zůstanou oba jako plakáty. V tomto vydání je živá scéna na dívání se, ne na obletování: scénu měň přes **Upravit ve 3D Studiu**. Zařízení, které neumí otevřít grafický kontext s plovoucí desetinnou čárkou, si nechá plakát a uvnitř boxu řekne proč, místo aby ukázalo prázdný obdélník, a zbytek dokumentu tím není dotčen. Otevření dokumentu Design bez jediného 3D boxu nenačte žádný 3D kód.

**Na časové ose** box scény sleduje přehrávací hlavu jako videoklip: jeho začátek, oříznutí začátku a rychlost posouvají scénu její vlastní animací, a délka scény je ta, kterou jsi nastavil/a ve 3D Studiu, takže zkrácení boxu ukáže méně scény, místo aby ji zrychlilo. Živý je jen vybraný box scény; každý další je nehybný obrázek, a nehybným obrázkem nejde scrubovat.

**Při exportu** se každá scéna vykreslí znovu ve velikosti, jakou soubor potřebuje, přes stejný vykreslovač, jaký používá studio. Video vykreslí jeden snímek na scénu na okamžik; PNG, SVG nebo PDF vloží jeden obrázek na box, ve vlastní pixelové velikosti toho boxu. Nic se nefotí z obrazovky, takže export nezávisí na tom, který box jsi měl/a vybraný. Scéna, kterou nejde vykreslit, exportu selže a řekne proč, vlastními slovy studia.

**Sdílení scény postavené na tvém vlastním nahraném souboru.** Odkaz ke sdílení dokumentu Design nese uvnitř scény id nahraného souboru vázané na dané zařízení tak, jak stojí, zatímco u obrázkového boxu ho vyprázdní. Takže scéna, jejíž grafika nebo model je soubor, který jsi nahrál/a, ukáže na cizím zařízení výchozí obrázek studia pro daný obrázek, pokud dokument necestuje jako soubor `.lolly`, který nese samotné bajty.

## Časová osa (Sekvence)

**Sekvence** je časová osa Designu: přidává volnému plátnu *čas*. Každý box může v určitou chvíli začít, běžet danou dobu a animovat se dovnitř i ven, a časová osa ukotvená pod kresebnou plochou je místo, kde je uspořádáš. Otevři ji a už tam hraje hotová sekvence - titulková karta, klip, koncová karta, spodní titulek a hudební podkres - takže model je vidět dřív, než cokoli změníš.

![Časová osa Sekvence: transport, pravítko, překryvová dráha, magnetický řádek sekvence s klipy a spojovacími čipy a pás Always on](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A252px!important%7D&cropSelector=.tl-panel&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-timeline)

Jsou dva druhy řádků a v tom rozdílu je celá myšlenka:

- **Řádek sekvence** je *magnetický*. Klipy sedí bez mezer, jeden za druhým, a tažením jednoho se pořadí přeskládá, místo aby zůstala díra. Smaž klip a zbytek se uzavře. Tohle je tvoje páteř.
- **Překryvné dráhy** jsou volné. Spodní titulek, logo, popisek - cokoli, co se vznáší nad páteří ve vlastním čase - dostane vlastní dráhu a vlastní začátek.
- Pod nimi **Vždy zapnuto** shromažďuje boxy bez jakéhokoli časování: kulisy, které jsou prostě přítomné po celou dobu. `+` na odznaku jeden povýší na dráhu; **Nastavit trvale zapnuto** ho pošle zpátky.

![Editační scéna: kreslicí plocha uprostřed vpředu, lišta nástrojů vlevo a HUD přiblížení v rohu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D11dZBb5swFADgX8MOiRYZB0J76GFpNO2wnbr7ZMwDrBg7s01C8usngmNwSqJszaT2aD8_G54_PUgJXRdK1iJ7CvAcpSHG6FMqG9BPQbwMkmWAMcsCjIP5lwDjUsp1O8DPAcZrJvpIKhsXaLpZ1I323mjXjcJHbCdKO4Ee7ISSxsvQJdmAO0cBNe6gtHDzQbKkkks101ARYRidaaBSZETtg2TlMgw0xuX8LBXANCN7PTVyWki3Kr-6b61yQmG4ay6FeWEHOL1K1E0TzgrhdqIgDCiXs_WjFcsyDi66A1aU_ZMuEPIOcwFNhHYRzgR8GySGs9CW0BDlFzWrVTe2qdCwftOcZP2TtJEfuovFyKZzIvor0fD7WKhVGzsXo2ALhH8UMxvFqmtiXmQFpmSimArYBfGzYHpKZcVEcS87-OHedpK72cHndmYWunu6rtxM-3wuwGqTXskacov-nhs15KNYG7HgWZtMvpNa0LJtUJNJi-2rYhnZ3ybtuNUVZuj9MotOrAbQFmPQbuB0uxwud4NX9-ycrmWIJw59Pg9h5AF6RGd-5vgWPhvG-2b5xs8bl5zvZ0ZK3tf_bd0pxu_lw2YDG2Jv6VRdj9Hi__WrKB7pV3OELuBKIRunReqM9f8d1tbnKPFsJVHs2Zqf9SaMLrSmASCjiNAbokD0lD0t_95Wxu-MVaQ4uT6WQ8ta0V46Z6lq9br1fVEOh7ypju-FFyjBC7fmVy0UaMm3YBcbVYMt-dhfTlUbe2BOuD6ujFd_AA&width=1440&height=900&dpi=192&waitMs=7000&waitSelector=.tl-clip&css=.fc-toolbar%7Bopacity%3A1!important%7D&format=svg&walker=1&tolerance=0.03&dark=1&filename=seq-studio-stage)

Otevřením časové osy jí předáš klávesnici, takže Space a šipky ovládají přehrávací hlavu, ne stránku - a protože se u kompozice, která už má časování, otevře sama, platí to od chvíle, kdy se Sekvence načte.

> **[Editor sekvencí](/info/sequence-editor.html)** jde do hloubky u čtyř věcí, které rozhodují, jestli je úprava v čase předvídatelná: který klip upraví kliknutí na plátno, průsvitkové stíny sousedních klipů, rozsah rozdělení a Spojit, které řez vrací zpět, a ořezávání (včetně klávesových zkratek). Stiskni `?` s fokusem na časové ose a zobrazí se přehled zkratek.

**Úpravy.** Tažením za střed klipu ho přesuneš nebo přeřadíš, tažením pár pixelů od kteréhokoli konce ho ořízneš a stiskem **Rozdělit na přehrávací hlavě** (nebo `S`) rozřízneš jeden klip na dva. Rozdělení potřebuje klip se skutečnou **Délkou** a přehrávací hlavu kousek uvnitř něj, takže klip s otevřeným koncem (třeba hudební podkres) rozdělit nejde. **Přichytit k hranám** je ve výchozím stavu zapnuté a přichytává k hranám klipů, k přehrávací hlavě a k celým sekundám, Alt to potlačí. Každé tažení je jeden krok zpět a náhled během tažení počítá stejně jako výsledný zápis, takže co vidíš při tažení, to dostaneš.

Vyber klip a inspektor ti nabídne tytéž úpravy jako čísla: **Délka**, **Oříznout začátek** (jak hluboko ve zdroji klip začíná), **Rychlost** jako sada pevných násobků od ×0,25 do ×4, **Animace vstupu** / **Animace výstupu** s jejich délkami a **Ztlumit klip**. Klip na magnetickém řádku záměrně nemá pole **Začátek** - pořadí drží řádek, takže ho přesuneš tažením.

**Přechody** jsou předvolby, ne klíčové snímky: Prolnutí, Vyskočit, Zvětšit, Vzestup, Pustit, čtyři Posuny, Přiblížit a Oddálit, Náklon, Švih, Otáčení, Unášení nebo **Vyjmout (bez animace)**. Vzdálenosti se škálují s objektem, takže stejná předvolba vypadá správně na kartě přes celý formát i na malém odznaku. Mezi dvěma sousedními klipy v řádku sekvence je **spojovací odznak**: klikni na něj a vyber **Vyjmout** nebo **Prolínání**, což se hned použije a odznak se zavře. Otevři ten samý odznak znovu, změň **Délku (ms)** a stiskni **Hotovo**. Prolínání se ukládá jako zeslabení jednoho klipu a zesílení dalšího a skutečné prolnutí se odvozuje z té dvojice: první klip pokračuje za střihem a zeslabuje se, zatímco druhý se pod ním zesiluje. Náhled i soubor používají stejné pravidlo, takže co vidíš na spoji, to dostaneš i v exportu.

**Zvuk.** Přidej klip **Zvuk** a bude na časové ose žít jako každý jiný klip: křivka, ořez, ztlumení. (Jedinou výjimkou je generovaný podkres, se kterým přichází výchozí relace - syntetizuje se až při exportu, takže jeho pruh zůstává prázdný a tichý, dokud nevykreslíš.) Stiskni mikrofon a **nahraj namluvení** rovnou na časovou osu, s odpočtem a měřičem hlasitosti, a záznam se uloží jako tvůj vlastní asset v místě, kde jsi začal/a. Stiskni vedle něj kameru a stejným způsobem **nahraj video**: záznam se během nahrávání ořezává na výstupní velikost kresebné plochy, takže malý náhled na sebe ukazuje přesně to, co se v místě přehrávací hlavy dostane do sekvence, v plném rámu - takhle se dá získat klip od kolegy ze sdíleného odkazu. Do exportovaného mixu se dostane hudba, mluvené slovo i vlastní zvuková stopa klipu. (**Zvuková stopa** v panelu exportu je něco jiného: jeden podkres položený pod celý klip, se zeslabením a potlačováním. Obojí vedle sebe obstojí.)

**Zvukový pruh.** Vyber libovolný klip, který nese zvuk, a pod časovou osou se otevře kompaktní pruh: fader **Hlasitost**, **Posun** pro stereo pozici, třípásmové **EQ** (**Nízká**, **Středy**, **Vysoká**), ovládací prvek **Výška**, který transponuje v půltónech a zachovává charakter hlasu, a **Normalizovat hlasitost**, které dostane klip na vysílací hlasitost (BS.1770), takže tichá hlasová poznámka a hlasitá stopa sedí na stejné úrovni. Tam, kde se dva klipy potkávají, **Prolínání** rozmělní spoj místo řezu. Slot **Efekt** spouští zpracování na klipu přímo v zařízení - **Čištění hlasu** odstraní z nahrávky místnost a šum. Změny rychlosti zachovávají i výšku: zpomalený nebo zrychlený klip se časově roztáhne, nezní jako veverka. Při každém mixu export ztlumí hudbu pod řeč, jak řeč přichází a odchází, a drží celý program pod limiterem true-peak, takže nic na výstupu neořízne; křivka, která by se jinak oříznula, se vykreslí s upozorněním v místě, kde k tomu dochází.

![Časová osa s vybraným hudebním klipem: jeho pruh běží podél spodku s Rychlostí, Prolínáním, Hlasitostí, Posunem, EQ, Výškou, Normalizací hlasitosti a slotem Efekt](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fbx%3Dt1%252Ctext%252C200%252C140%252C1500%252C220%252C0%252Crect%252C16%252C%252C100%252C%252Ccontain%252Cnormal%252CVoiceover%252520session%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252Cseq%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1%252C%252Cfalse%252C%252C60%252C%252C%252C1%257Ea1%252Caudio%252C200%252C500%252C400%252C80%252C0%252Crect%252C16%252C%252C100%252Clolly%25252Floops%25252F3-am-echoes%252Ccontain%252Cnormal%252C%252C%25257Bcolor.semantic.text%25257D%252C48%252Ccenter%252Cmiddle%252C500%252Csans%252C1.12%252C0%252Ctrue%252Cfalse%252C%252C%252C8%252Cnone%252C00000055%252C0%252C0%252C10%252Ccenter%252Cfalse%252C%252C%252C0%252Cnonzero%252C0%252C3.3%252C0%252C1%252Cnone%252Cnone%252C400%252C400%252Cfalse%252C%252C%252Cround%252Cround%252C%252C0%252C0%252C0%252C0%252C%252C%252C%252C0%252Ctrue%252Cnone%252Cnone%252C%252Cfalse%252C%252C%252C%252C0%252C%252C%252Cfalse%252C%252C%252C%252C%252Cfalse%252Cfalse%252C%252C1.3%252C%252Cfalse%252C%252C60%252C%252C%252C1%26_sel%3Da1&width=1440&height=900&dpi=192&waitMs=5000&waitSelector=.tl-clip&css=.tl-panel%7Bheight%3A300px%21important%7D&cropSelector=.tl-panel&walker=1&format=svg&dark=1&filename=tl-audio-strip&drive=click%3Abutton%3Ahas-text%28%22Inspector%22%29)

**Vykreslení.** Export pohybu je **deterministická kompozice**, ne záznam obrazovky - každý snímek se dekóduje, vykreslí a zakóduje v přesném čase, takže soubor nezávisí na tom, jestli tvůj stroj stíhá, a u MP4 ani WebM není praktický strop počtu snímků. Délku určuje samotná časová osa, dokud nějakou nezadáš. Content Credentials se otisknou stejně jako u každého jiného exportu. Statický export ti dá snímek na přehrávací hlavě, nebo celý kontaktní arch podle pole **Snímky** vedle výstupní velikosti - viz [Export](/info/exporting.html#stills-from-a-timed-composition).

Pár mezí, na které je dobré myslet: sekvence je omezená na jednu hodinu, GIF a animované PNG si snímky drží v paměti, takže zůstávají krátké, klip přehraný rychleji nebo pomaleji si zachová výšku (zvukový pruh ho časově roztáhne a ovládací prvek **Výška** transponuje v půltónech se zachovaným charakterem hlasu) a **Nahrávat naživo** je tady skryté, protože kompozitor je lepší cesta.

**Za hranicí přednastavení: klíčové snímky, hloubka a kamera.** Přechod animuje klip ve chvíli, kdy se objevuje a mizí. Abys pozicoval prvek *uvnitř* klipu - posunul ho, prolnul, rozmazal, zvedl ho nad stránku a zase usadil - přidej klíčové snímky: vyber klip, stiskni **+Keyframe** (kosočtverec v klastru nástrojů na časové ose, kosočtverec na liště objektu na plátně nebo `K`) a pozice přehrávací hlavy určí, jakou pozici zapíše tvoje další úprava. Stejný systém klíčových snímků dává každé časované kompozici **kameru**, která najíždí, panoramuje a mění ostření a mění jeden plochý SVG na hromadu vrstev, mezi kterými můžeš prolétat. **[Animace](/info/animating.html)** je kompletní návod.

Nástroj Design má stejnou časovou osu, takže rozložení můžeš načasovat, aniž bys musel/a přecházet do jiného nástroje, a exportuje pohyb také.

## Prezentování

Abys umístil/a svou kameru, logo a jmenovku nad obraz pro publikum, použij **Present with camera**. Jeho vlastní ovládací prvky, uložené scény, sdílení a kroky nahrávání jsou popsané v [Prezentování s kamerou](/info/presenting.html). Obyčejné ovládací prvky prezentace níže zůstávají dostupné přes **Prezentovat**.

Dokument v Designu složený z **kresebných ploch** je už hotová prezentace. Otevři **nabídku Lolly** na liště nástrojů a vyber **Prezentovat** - poslední řádek - a z každé kresebné plochy se stane snímek na celou obrazovku, v pořadí, v jakém plochy leží na plátně. Prezentace běží na kopii vykreslených ploch, takže se editoru pod ní nikdy nic nestane a po odchodu se vrátíš přesně tam, kde jsi byl/a.

- **Advance** pomocí **Space**, `→`, **Page Down** nebo kliknutím na pruh na pravém okraji obrazovky; zpět jdi pomocí `←`, **Page Up** nebo pruhem na levém okraji. **Home** a **End** skočí na první a poslední snímek. Malá lišta ovládacích prvků se zobrazí, kdykoliv pohneš kurzorem, a znovu se skryje, jakmile se zastavíš.
- **Overview** (`O` nebo tlačítko mřížky) rozloží všechny artboardy najednou v uspořádání, které jsi jim dal na plátně; kliknutím na jeden ho otevřeš.
- **Reveal steps.** Klikni pravým tlačítkem na box a zvol **Reveal at step 1**, **2** nebo **3** místo výchozího **Always visible**. Daný box pak čeká, dokud se nedostaneš na jeho krok, takže snímek může přijít po částech; boxy se stejným číslem přijdou společně.
- **Speaker view** (`S`) otevře druhé okno s aktuálním snímkem, tím dalším, tvými poznámkami k danému snímku a běžícími hodinami. Pokud prohlížeč vyskakovací okno zablokuje, přepne se na panel přes prezentaci. Poznámky se nastavují po jednotlivých artboardech a na samotném snímku se nikdy nezobrazí.
- `B` podrží černou obrazovku (jakákoliv klávesa vrátí snímek zpět), `F` se vrátí na celou obrazovku a **Escape** odloupne vrstvu po vrstvě: z Overview zpět na prezentaci, z prezentace zpět do editoru.
- **Kiosk.** Dej artboardu **Length** a prezentace se na něm podrží po tuto dobu, pak sama postoupí dál za tenkým ukazatelem průběhu; `K` (nebo tlačítko pauzy, které se objeví, jen jakmile něco má délku) to zastaví a znovu spustí. Přidej `kiosk` do odkazu a prezentace se na konci zacyklí, což z ní dělá signage.

- **Podřazené snímky.** Klikni pravým tlačítkem na kresebnou plochu a zvol **Vnořit pod předchozí snímek** a stane se krokem toho snímku místo vlastním snímkem: přehled ukáže jednu kartu, prezentace prochází vnořenou skupinou popořadě a řádek **Stoh** v inspektoru řekne, ke kterému snímku patří.
- **Morph.** Když dva po sobě jdoucí snímky nesou box se stejným názvem **Morph shoda** (klikni pravým tlačítkem na box, nebo použij řádek **Morph shoda** v inspektoru - řekněme, `hero`), přechod přesune ten box z místa, kde byl, na místo, kde je, cestou měnící velikost a barvu, místo aby řezal. Přechod **Morph** pro celou prezentaci udělá totéž pro každou spárovanou dvojici.
- **Namluvení.** **Poznámky pro řečníka** každé kresebné plochy lze přečíst nahlas. V sekci **Dokument** v inspektoru vyber **Hlas**, volitelně druhý hlas k **Smíchat s**, rychlost čtení **Rychlost** a **Náběh** a **Doběh** v milisekundách kolem každého snímku; zapni **Zobrazovat titulky při prezentaci** a slova se objevují, jak jsou vyslovována. Hlas běží na tvém zařízení. Stejné poznámky se stanou filmem ve video exportu, skutečným zvukem snímku v exportu do PowerPointu a namluveným filmem uvnitř [balíčku SCORM](/info/create/exporting.html#scorm-course-packages).

![Sekce Dokument v inspektoru: Hlas, Smíchat s, Rychlost, Náběh, Doběh a Zobrazovat titulky při prezentaci](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.fc-insp&walker=1&format=svg&dark=1&filename=design-narration)

Prezentace je zároveň odkaz. `?present` ji rovnou otevře, `s=` pojmenuje snímek - pozici, id kresebné plochy nebo `id.step` pro krok odhalení - a adresa se při přesunu aktualizuje, takže posíláš přesně ten snímek, na kterém jsi. Autoři nástrojů: tyhle parametry jsou popsané na stránce [Režim URL](/info/url-parameters.html#reserved-parameters).

## Na telefonu

Na úzkých obrazovkách se rozložení přeskládá do jednoho sloupce:

- **Ovládací prvky se stanou panelem** nahoře s **úchytem pro tažení** na spodním okraji. Přetažením úchytu změníš jeho velikost - přichytává se na **nahlédnutí / polovinu / celou plochu** - nebo **ťukni** na úchyt a přepneš mezi sbaleným a rozbaleným stavem. Náhled vyplní prostor pod ním a zůstává viditelný, zatímco upravuješ.
- Plovoucí tlačítko **Export** otevře panel exportu - všechny ovládací prvky pro formát, velikost, kopírování, ukládání a stahování na jednom místě. Zavřeš ho ťuknutím na pozadí.

![Nástroj na obrazovce o šířce telefonu - ovládací prvky jako panel nahoře, vygenerovaná paleta vyplňující náhled pod ním a plovoucí vykreslovací pilulka dole uprostřed](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Ovládací prvky (vstupy)

Nástroje zpřístupňují jen ty vstupy, které se mají měnit - všechno ostatní (barvy, rozložení, typografie, logika) je pevně dané autorem nástroje, takže cokoli vytvoříš, splňuje pravidla, která autor nastavil. Vstupy zahrnují text, posuvníky, výběr barvy, rozbalovací nabídky, data, výběr obrázků a opakující se skupiny řádků. Některé jsou seskupené do rozbalovacích sekcí.

![Sloupec ovládacích prvků nástroje - textové pole, spouštěče barev a posuvník a nic dalšího, co se autor rozhodl zamknout](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Reset:** *Vymazat změny* vrátí každý vstup na jeho výchozí hodnotu.

### Zpět a znovu

**Cmd/Ctrl-Z** krokuje zpět a **Cmd/Ctrl-Shift-Z** (nebo **Cmd/Ctrl-Y**) zase vpřed. Stejná dvojice sedí jako tlačítka **Zpět** a **Znovu** v řádku nad ovládacími prvky - na volném plátně jsou místo toho na liště nástrojů - a každé zešedne, dokud není co vracet. Každý krok řekne, co byl: vrať barvu a malá zpráva pojmenuje vstup, který právě obnovila, a má v sobě tlačítko **Znovu** pro cestu nazpátek.

- **Tažení je jeden krok.** Opakované změny stejného ovládacího prvku během půl sekundy se slijí dohromady, takže přejetí posuvníkem přes celý rozsah je jedno vrácení zpět, ne dvě stě.
- **Uchovává se posledních 100 kroků** - starší z konce vypadávají. Nová úprava po vrácení zpět vymaže zásobník kroků vpřed, jako všude jinde.
- **Dokud je kurzor v textovém poli**, patří Cmd/Ctrl-Z samotnému poli, znak po znaku. Lolly přebírá řízení u ovládacích prvků, které vlastní použitelné vracení nemají: u posuvníků, rozbalovacích nabídek, barev a přepínačů.
- **Výběr souboru** ve vstupu typu **soubor** není krok - ty bajty se drží jen po dobu relace, takže by nebylo co vracet.

Při živé [spolupráci](/info/collaborate.html) zůstává historie jen tvoje. Změna přicházející z druhého zařízení se nikdy nedostane na tvůj zásobník, takže zpět můžeš vzít jen to, co jsi udělal ty sám.

Zpět sahá zpátky jen v rámci této návštěvy; nástroje, které ukládají za chodu, navíc uchovávají dřívější verze pod **Historií**, vedle **Zpět** (viz [Vrať se k dřívější verzi](/info/find-your-work.html#go-back-to-an-earlier-version)).

## Tvoje údaje a fotka

**Nastavení** (vpravo nahoře v galerii, kde se po nastavení zobrazí tvé křestní jméno) uchovává tvé jméno, kontaktní údaje a volitelnou **fotku**. Nástroje, které se na tato pole ptají, je automaticky předvyplní - nastav si je jednou a tvůj e-mailový podpis, lockupy a odznaky se doplní samy. Kterékoli pole pak pro danou relaci pořád můžeš přepsat. Zapni **Použít moje údaje k tvorbě**, aby tvoje údaje jely s tím, co exportuješ, jako autor.

Tvoje fotka a údaje žijí **jen na tomto zařízení**. Profil může být víc než jen ty - tým nebo role, do které se čas od času vžiješ. Kompletní obrázek, včetně vedení více profilů, najdeš v **[Profily](/info/profile.html)**.

## Ukládání a pokračování

Abys uchoval/a svou práci, stiskni **Uložit jako** - fajfku vedle **Export**. V sekci **Save to a project** nech zaškrtnuté **Moje knihovna** nebo vyber projekt (**＋ Nový projekt…** ho vytvoří), pak stiskni **Uložit**. Opětovné uložení aktualizuje stejnou položku, místo aby vytvořilo kopii. V Designu je **Uložit jako** v nabídce pod logem Lolly; na mobilu stiskni **•••**, pak **File menu**, pak **Uložit jako**.

Tlačítko **Uložit** v panelu exportu udělá totéž jedním kliknutím a nikdy nestáhne soubor: nová práce jde do Moje knihovna, a práce, kterou jsi uložil/a dřív, se aktualizuje tam, kde je.

Abys se k tomu vrátil/a později, stiskni **Domů** vlevo nahoře, pak otevři kartu **Projekty** (na mobilu ikona složky). Uložení do **Moje knihovna** jsou na její první obrazovce; projekt je tam složka. Položky jsou pojmenované podle názvu souboru, který jsi zadal/a v exportním panelu, nebo podle svého nástroje, například **QR Code**. Otevři jednu a každé nastavení je tam, připravené ke změně a dalšímu exportu.

Uložená práce zůstává na tomto zařízení, v prohlížeči nebo aplikaci, ze které jsi ukládal/a, pokud nezapneš [Synchronizaci](/info/sync.html). Soubor, který získáš přes **Stáhnout**, je hotová kopie; abys ho později změnil/a, otevři uložený prvek v Projekty. Pokud něco není tam, kde čekáš, viz [Najdi a obnov svou práci](/info/find-your-work.html).

![Dvoudílná vykreslovací pilulka - šipka nahoru, která otevře panel exportu, a fajfka s popiskem Uložit jako, která otevře panel uložení](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

## Projekty

**Projekty**, karta **Projekty** nahoře na domovské obrazovce, jsou domovem pro všechno, co sis uložil/a, ve složkách, které si vytvoříš. Hledání, řazení a prohledávání práce tam, a obnovení položky z **Koše**, popisuje [Najdi a obnov svou práci](/info/find-your-work.html#find-something-you-saved).


## Sdílení tvojí práce

Návrh jde ven jednou ze dvou cest: jako odkaz, nebo jako soubor. Dialog Sdílet nabízí obojí. Otevřeš ho tlačítkem **Sdílet** v ovládacích prvcích exportu; **Odkaz ke sdílení** u uložené relace v Projektech otevře stejný dialog pro tu relaci.

### Odkaz

Každý vstup je zachycený v URL adrese stránky, takže odkaz *je* návrh. Nahoře v dialogu je odkaz připravený ke zkopírování a pod ním dvě sbalené sekce.

- **Možnosti odkazu** obsahují **Open in the installed app** (přepne pole na URI `lolly://` pro Zkratky, spouštěče a automatizaci, se všemi parametry beze změny), **Nejkratší odkaz** (velký návrh dělá dlouhou URL, takže tohle sbalí celý stav do kompaktního tokenu a ukáže ti úsporu ve znacích; čitelná podoba je tam vždycky taky), **Chránit tento odkaz heslem** (AES-256 přes celý odkaz, heslo v něm nikdy není) a **Připnout tuto verzi nástroje** - příznak `_v`, který odkaz přibije k verzi nástroje, na kterou se právě díváš, aby pozdější aktualizace nemohla změnit, co vykreslí.
- **Chování odkazu** je to, co se stane, když ho příjemce otevře: celá obrazovka, rovnou rozbalený panel exportu, stažení při otevření pomocí `&export` nebo zkopírování do schránky pomocí `&copy`.

Pošli odkaz kolegovi, přidej si ho do záložek nebo ho commitni. (Plné detaily: [Režim URL](/info/url-mode.html).)

**Některé nástroje udělají z odkazu celý produkt.** Jump Page shromáždí tvoje odkazy na jednu stránku k rozdání - odkaz na bio, konferenční přednášku, výlohu obchodu. Není co hostovat a nestojí za tím žádný účet: stránka je odkaz, takže se otevře tak rychle, jak cestuje URL adresa. V editoru vidíš hotovou stránku vedle polí; návštěvník, který odkaz otevře, ji dostane na celou šířku, jeden odkaz na scénu, jak scrolluje.

![Jump Page v editoru: scéna s nadpisem v horní části stránky a pod ní scény s odkazy](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

**Dialog říká, co odkaz unést nedokáže.** Do URL se nevejdou tři věci: obrázek nebo soubor, který jsi přidal/a z tohoto zařízení, hodně dlouhá textová hodnota nebo hodně velký seznam. Každá z nich se při stavbě odkazu spočítá. Pokud se něco muselo vypustit, dialog to pojmenuje a nasměruje tě na soubor níže, místo aby ti podal odkaz, který se otevře bez obrázku. Odkaz, který je jen *dlouhý*, dostane mírnější poznámku s počtem znaků, protože délku ještě může zachránit sbalení.

### Soubor .lolly

`.lolly` je přípona přenosného balíčku Lolly, ne slib, že každý soubor obsahuje totéž. Autoritou je `format` v `manifest.json`. Aplikace nejdřív přečte tenhle drobný manifest a ukáže velikost, obsah a akci, než cokoli zapíše:

- **Sdílená relace** (`lolly-share`) obsahuje jednu uloženou relaci nástroje, její vložené soubory a potvrzení pro cokoli, co se pořád překládá odkazem. Může nést i nástroj a design systém použitý k jejímu vytvoření. Otevření přidá nový Projekt; nikdy nepřepíše existující relaci.
- **Sdílený projekt** (`lolly-share` druhu `project`) obsahuje složku z Projektů: její podsložky, každou v nich uloženou relaci, dlaždici každé relace a obrázky v ní uložené. Otevření přidá kopii celé složky do Projektů; nic, co tam už je, se nenahradí. Lolly zpřed doby, kdy existovaly soubory projektů, takový soubor nepřečte a řekne, ať se aktualizuje.
- **Balíček design systému** (`lolly-brand`) obsahuje tokeny a může obsahovat písma, loga, publikované verze a zachované zdroje. Otevření ho přidá jako samostatný pojmenovaný design systém a pak na něj přepne; systémy už v zařízení zůstanou.
- **Pracovní prostor značky / balíček instance** je `lolly-brand` s deklarovanými nástroji, katalogovými assety a volitelně adresou instance. Předletová kontrola vypíše tyto dopady pro celé zařízení, protože jeho načtení nahradí jedinou dřív načtenou překryvnou vrstvu pracovního prostoru.

Kompletní **záloha zařízení/profilu není `.lolly`**. Zůstává souborem `LollyTools-….zip` ve formátu `lolly-backup` a obnovuje se přes **Nastavení → Úložiště → Importovat data…**, což také vezme kopii, kterou Synchronizace uchovává v tvém úložišti. Obyčejná zazipovaná složka nástroje zůstává také `.zip`. Jinými slovy, balíčky relace a design systému vlastní `.lolly`; zálohy a pracovní postupy s volnými archivy ne.

**Download .lolly** v dialogu Sdílet nástroje, ve kterém pracuješ, zapíše aktuální design jako balíček sdílené relace. Nese uloženou relaci spolu s obrázky a soubory dostupnými na tomto zařízení. Obyčejná katalogová grafika veze se s ní taky. Licencovaná grafika se zadrží, pokud ji výslovně nezahrneš, a zastaralý nebo nedostupný soubor zůstává externím odkazem místo toho, aby zmizel. Připravené potvrzení ukáže skutečnou velikost `.lolly`, počet vložených souborů, počet externích odkazů a to, jestli je zahrnutý nástroj. Tam, kde má tvé zařízení sdílení systému, ho **Send to…** předá rovnou jemu (AirDrop, sdílení na Androidu), místo aby ho ukládalo na disk.

**Download project (.lolly)** v nabídce složky v **Projekty** zapíše tu složku jako sdílený projekt, aby ji mohl někdo jiný otevřít a pokračovat v každé relaci uvnitř. Každá relace cestuje jako svá vlastní část (`sessions/<key>.json`, s dlaždicí pod `thumbs/`), strom složek je vypsán v `manifest.json` a nahrané soubory a katalogová grafika cestují za stejných pravidel jako jedna sdílená relace. Dávkové relace nejsou relace nástroje a zůstávají vzadu; oznámení řekne kolik. **Download originals** vedle toho zůstává beze změny: obyčejný zip každé položky jako vlastního souboru.

`.lolly` je obyčejný zip. Přejmenuj ho na `.zip` a otevři: tvoje vlastní obrázky jsou v `assets/uploads/` a katalogová grafika v `assets/catalog/`, každá se svým skutečným názvem a příponou, `manifest.json` je všechny vypisuje a README nahoře říká, co ten soubor je.

Tři věci jsou před odesláním na tobě:

- **Zda tam jde tvé jméno.** Tvé jméno, e-mail a organizace se do souboru zapíší jen tehdy, když je v profilu zapnuté **Use my details to create**. Když je to vypnuté, soubor zaznamená jen to, že byl vytvořen v Lolly a kdy - nic o tobě.
- **Zda tam jde licencovaný obsah.** Licencované a značkou uzamčené assety se ve výchozím stavu zadrží. Pokud design nějaké používá, dialog uvede kolik a nabídne dvě tlačítka - *Download without them* nebo *Include and download* - protože jejich zahrnutí předá skutečné soubory komukoli, kdo `.lolly` otevře.
- **Zda tam jde nástroj.** **Include the tool** zabalí vlastní soubory nástroje spolu s designem, aby se otevřel i na zařízení, které ten nástroj nemá. U vlastního nástroje - forku nebo soukromého značkového nástroje, který tvůj příjemce pravděpodobně nemá - přijde zaškrtnuté, u nástroje uvedeného v podepsaném katalogu nezaškrtnuté, protože jeho kopie pochází ze stejného zdroje. (Na sestavení bez podepsaného katalogu se každý nástroj počítá jako vlastní a políčko začíná zaškrtnuté.)

**Otevření souboru.** V nainstalované desktopové nebo mobilní appce dvakrát klikni nebo klepni na `.lolly`, zvol **Open with Lolly**, nebo ho pošli do Lolly ze systémového sdílení. macOS, Windows, Linux, iOS i Android formát registrují; desktopové správce souborů ho zobrazí jako dokument Lolly (a GNOME Files umí ukázat vlastní náhled uložené relace). Ve webové appce použij **Otevřít** nebo přetáhni soubor na Lolly. Každé dveře používají stejnou předletovou kontrolu založenou nejdřív na manifestu. Otevření z Brand Studia doporučí akci design systému, když sdílená relace nějaký nese, ale nikdy nepřejmenuje soubor ani neschová **Otevřený sdílený design**.

Dokument z iOS nebo Androidu předaný z jiné appky je omezený na 48 MB, protože nativní předání musí zkopírovat jeho bajty přes hranici appky. Mobilní appka to řekne rovnou, místo aby tiše ignorovala příliš velký soubor. **Otevřít** uvnitř Lolly toto předání nepoužívá; je to cesta, kterou zkusit pro větší balíček.

Po potvrzení vybraná čtečka jednou nafoukne a ověří balíček. Assety sdílené relace jdou do tvé knihovny, její relace jde do Projektů a její nástroj se otevře, pokud je dostupný. Relace sdíleného projektu jdou do Projektů pod novou kopií jeho složek, s novými id, takže stejný soubor lze otevřít dvakrát, a složka se otevře; relace, jejíž nástroj tomuto zařízení chybí, tam čeká. Asset už přítomný na zařízení se spáruje podle kontrolního součtu a znovu použije. Balíček design systému se uloží do vlastního jmenného prostoru, než na něj appka přepne. Soubory nad 100 MB jsou označeny jako velké a předletová kontrola varuje, když úložiště prohlížeče hlásí míň volného místa, než deklarovaný náklad potřebuje. Každá část krytá kontrolou integrity se zkontroluje, než se operace potvrdí; poškozená kopie je odmítnuta a nově vytvořený cíl se vrátí zpět.

Pokud soubor nese nástroj, který nemáš, Lolly se zeptá dřív, než ten nástroj může běžet: **Důvěřovat tomuto nástroji?** ukáže nástroj a jeho autora a rovnou řekne, že jeho otevřením poběží na tvém zařízení vlastní kód toho nástroje, a **Důvěřovat a nainstalovat** je cesta dál. Odmítni a sdílená práce se do tvých projektů uloží tak jako tak a počká tam na den, kdy si nástroj přidáš. (Jeden druh nástroje zatím nejde načíst bokem - takový, jehož kód přichází jako modul - a odmítne se stejným způsobem.)

Odkaz i soubor předávají snímek stavu. Když chceš pracovat na stejné relaci *ve stejnou chvíli* s někým dalším - dvě zařízení, žádný server, a jste-li na jedné síti, ani internet - podívej se na [Spolupráci](/info/collaborate.html).

## Živá kamera (nástroje reagující na pohyb)

Každý fotografický **filtr** - Halftone, Scanline, Posterize, Voronoi cells, Colour treatment, Pixel stretch a Imperfections - zobrazuje tlačítko **Spustit naživo** tam, kde je dostupná kamera. Zapni ho a efekt sleduje obraz z webkamery snímek po snímku, takže reaguje na pohyb; výsledek si můžeš nahrát do GIFu, WebM nebo MP4. Snímky se čtou a zpracovávají **na tvém zařízení** a nikdy ho neopustí, a kamera se uvolní ve chvíli, kdy zastavíš nebo opustíš nástroj. (Každý výběr obrázku má také **Vyfotit** pro zachycení jednoho snímku jako obrázku v zařízení.)

## Moje obrázky

Když ti nástroj umožní přidat obrázek z tvého zařízení, zůstane přesně tak, jak přišel - takže Content Credential na něm dál projde ověřením - a uloží se do tvé osobní knihovny **Moje obrázky** (pod **Nastavení → Úložiště**). Jen u opravdu obrovského souboru se aplikace zeptá, jestli ho ponechat, nebo zmenšit. Použij ho znovu v libovolném nástroji. Chceš-li odstraňovat EXIF/GPS už při příchodu obrázků, zapni si v profilu **Odstranit metadata z nahraných souborů**. Žádný strop tu není: knihovna je čistě lokální a omezená jen úložištěm tvého zařízení - obrázky tam spravuješ nebo mažeš.

## Assety - tvoje knihovna

**Assety** (`#/a`, nebo segment **Assety** v přepínači Nástroje · Utility · Assety · Projekty nahoře v každém přehledovém zobrazení) shromažďuje všechno, z čeho tvoje nástroje můžou čerpat - loga značky, obrázky, zvuk a pohyb, seskupené podle druhu - a žijí v něm i tvoje **vlastní kreativní soubory**. Žádný server, žádná administrátorská konzole, žádný pull request: všechno je na tvém zařízení.

![Assety se vzorky a písmy značky a tvými vlastními nahranými soubory](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Vnes svoje soubory dovnitř.** Přetáhni jakýkoli obrázek, SVG, zvukový klip, video, Lottie, PDF nebo prezentaci PowerPoint na plochu pro nahrávání - nebo klikni a vyber - a okamžitě se objeví v zobrazení Assety, připravený ve výběru zdrojů každého nástroje. Vícestránkový PDF nebo soubor `.pptx` se zeptá, které stránky nebo snímky zachovat - z každého se stane samostatný zdroj SVG. Nahrávej, kolik chceš; nikdy to neopustí tvoje zařízení.
- <!--i:star--> **Označ hvězdičkou to, po čem saháš.** Označ hvězdičkou ★ zdroj (nebo vzorník barvy značky) a připne se navrch každého výběru, takže tvoje oblíbené logo nebo barva jsou na jedno kliknutí.
- <!--i:folder--> **Udělej si pořádek.** Přeřaď zdroj do jiné skupiny, skryj sdílený zdroj značky, který nepoužíváš (s možností **Show hidden** ho vrátit zpět) nebo úplně smaž vlastní nahrané soubory. Stejné gesto vícenásobného výběru a plovoucí lišta akcí jako v Projects fungují i tady, takže cokoli z toho lze udělat na celý výběr najednou.
- <!--i:layers--> **Odstraň pozadí z videa.** Otevři detail videa nebo klikni pravým tlačítkem na jeho kartu v libovolném výběru zdrojů a zvol **Remove background…**, aby se uložila průhledná alternativa - animovaný WebP nebo PNG se skutečnou alfou. Vyber **Method**: **On-device model** vyřízne objekt z rušné scény, nebo **Colour key** odstraní rovnoměrně nasvícené, jednolité pozadí jako green screen nebo obyčejnou stěnu, s doladěním hrany pomocí **Tolerance**, **Softness** a **Spill removal**. Barevný klíč nevyžaduje stažení modelu ani síť, takže **Remove background** je nabízeno u každého videa a na uklizeném záběru bývá čistší. Ovládání **Resolution** (360, 480, 720 nebo 1080p, nikdy nad rámec zdroje) mění detail za menší, rychlejší soubor. Běží jako úloha na pozadí na tvém zařízení. Hotový výřez se ukládá vedle originálu jako vlastní zdroj a Content Credential zdrojového videa jede s ním jako přísada. (Viz [Vygenerováno jednou, vykresleno stejně](/info/ai-features.html), proč odstranění pozadí zůstává obyčejnou úpravou.)

### Vezmi si svou paletu a písma kamkoli

Panel **Vzorky** v zobrazení Assety není jen na dívání - klikni na barvu a zkopíruj ji, nebo **stáhni celou paletu značky** ve formátu, kterým mluví tvůj druhý nástroj:

- <!--i:code--> **Design tokeny (JSON)**, **CSS proměnné** nebo **CSS třídy** - vlož značku rovnou do stylopisu nebo buildu;
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** - načti ho do Illustratoru nebo Photoshopu;
- <!--i:pentool--> **GIMP paleta (.gpl)** - pro GIMP nebo Inkscape.

![Panel Vzorky - pět tlačítek pro stažení palety nahoře, pak každá barva značky jako kopírovatelný odznak](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Panel **Písma** vypisuje řezy tvé značky s **tlačítkem stažení** u každého, abys je nainstaloval/a lokálně nebo předal/a do tiskárny. (Místnost Barvy v [Brand Studiu](/info/brand-studio.html) nabízí stejné stažení palety.)

Assety jsou jedna polovina otevřené cesty udělej si sám; ta druhá je **tvorba vlastních nástrojů** - volné plátno (Design, popsané výše) ti umožní jeden postavit vizuálně, bez psaní kódu.

## Zvuk a přístupnost

Lolly usiluje o to, aby se s ním dalo pohodlně pracovat úplně každému. Rozhraní je ovladatelné klávesnicí, vlastní ovládací prvky mají řádné popisky pro čtečky obrazovky a živý náhled každého nástroje je zpřístupněný jako jeden popsaný obrázek, který říká, co vzniká.

Jemná vrstva **doprovodných zvuků** potvrzuje, co děláš - příchod do galerie, platnou vs. neplatnou kontrolu Content Credentials, zavření panelu, přepnutí filtru. Ve výchozím stavu je **vypnutá**: zapni **Zvuk** kdekoli, kde se přepínač objeví (v popoveru možností každého zobrazení nebo v **Nastavení**), a volba se zapamatuje.

Pod **Nastavení → Přístupnost** žijí čtyři volitelná nastavení pohodlí: **Reduce motion** (vypustí přechody a ozdoby aplikace), **Hide colourful previews** (klidné karty galerie s ikonou a textem a tišší náhledy projektů), **High contrast** (silnější rámečky, text a fokusové obrysy) a **Large text** (větší písmo aplikace - popisky, nabídky, texty tlačítek). Všechna čtyři zklidňují aplikaci *kolem* tvojí práce: nikdy nesáhnou dovnitř plátna nástroje ani nezmění jediný pixel toho, co exportuješ, a každé je vypnuté, dokud ho nezapneš. Plné detaily v [Tvůj profil → Přístupnost](/info/profile.html#accessibility).

Vedle přepínače Zvuk je **Neurospicy Mode** - volitelná, konejšivá podkresová stopa pro soustředění, která tiše hraje, zatímco pracuješ. Když ji zapneš, otevře se v dolním rohu malý **dok přehrávače**, který tě provází celou aplikací; z něj můžeš vyhledat a vybrat stopu, přeskakovat vpřed a zpět, nastavit hlasitost a přehrávač minimalizovat nebo zavřít. Seznam stop zahrnuje několik kategorií - procedurální melodie *Lolly Sings*, ambientní smyčky a beaty, tvoje vlastní nahrané audio a hrstku živých internetových **rádiových** stanic (ty potřebují připojení; všechno ostatní hraje offline). Ve výchozím stavu je **vypnutý** a stejně jako Zvuk se pamatuje napříč relacemi a zařízeními. Vypnutí Zvuku ztlumí i stopu pro soustředění.

## Úložiště a soukromí

Lolly uchovává tvou práci na tvém zařízení: ve vlastním úložišti tohoto prohlížeče ve webové aplikaci a ve vlastním úložišti aplikace v desktopové a mobilní aplikaci. Co se uchovává, co odstraní **Vymazat všechna moje data** a co si s sebou vezme vymazání dat prohlížeče, popisuje [Najdi a obnov svou práci](/info/find-your-work.html#if-you-clear-your-browser-data); [Zásady ochrany soukromí](/info/privacy.html) vypisují všechno, co aplikace kdy stáhne nebo odešle, a [Serverová plocha](/info/server-surface.html) volitelné serverové komponenty.

## Přechod na jiné zařízení

Chceš-li přenést svou práci do druhého počítače nebo telefonu, použij synchronizaci, záložní soubor nebo soubor `.lolly`. [Přenes svou práci do jiného zařízení](/info/find-your-work.html#move-your-work-to-another-device) porovnává tyto tři možnosti a provede tě přes **Exportovat moje data** a **Importovat data…**.

## Import návrhu (Figma, Penpot, Illustrator, InDesign)

Existující návrh můžeš přenést do Lolly a pokračovat v práci na něm: otevři **Design**, klikni na **Importovat design** na panelu nástrojů plátna a vyber Figma **.fig** nebo SVG, Penpot **.penpot**, Illustrator **.ai** / **.pdf** nebo InDesign **.idml**. Vrstvy se stanou upravitelnými boxy na volném plátně - text zůstává přepisovatelný, obrázky přistanou v **Moje obrázky** a písmo a barvy se přizpůsobí globálním hodnotám značky - pak se výsledek ukládá, sdílí a vykresluje jako každá jiná relace. Zpracování probíhá celé na tvém zařízení. Plné detaily: **[Import návrhu](/info/design-import.html)**.

## Export

Kompletní příběh najdeš v **[Export a formáty](/info/exporting.html)** - výběr formátu, výstupní velikosti a tiskových jednotek, průhlednost, video a kopírování/sdílení. Ve zkratce: vyber formát, podle potřeby nastav velikost a dej **Stáhnout** (nebo **Kopírovat** do schránky).

## Dávkový režim (Pro)

Pro pokročilé uživatele **Dávkové zpracování** (odkaz z galerie, uzamčené za feature flagem Pro, který je ve výchozím stavu zapnutý) vykreslí spoustu variant najednou - mřížku, kde je každý řádek sadou vstupů, exportovaných dohromady. Ideální pro lokalizaci karty do desítky jazyků nebo pro vygenerování každé velikostní varianty na jeden zátah. Řádky vyplníš psaním, vložením přímo z tabulkového procesoru nebo importem CSV (jedno si můžeš i exportovat zpátky) a pro každý řádek nastavíš formát, velikost a název výstupního souboru. Celou mřížku ulož jako pojmenovanou **dávkovou relaci**, která se znovu otevře z galerie, a stáhni každý řádek jako jeden `.zip`.

![Panel nástrojů dávkového režimu - název zipu, jednotky, DPI a formát, který dědí každý řádek, se Sessions a Render vpravo](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&cropSelector=.pro-toolbar&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

Dávkové zpracování slouží k vygenerování **mnoha variant jedné šablony** najednou. Pro opětovné vykreslení relací, které jsi **už uložil/a**, použij **Projekty → Vykreslit složku / Vykreslit výběr** (viz [Najdi a obnov svou práci](/info/find-your-work.html#find-something-you-saved)) - Pro k tomu není potřeba.

## Úpravy vedle sebe (Hromadné úpravy)

Batch je mnoho variant *jednoho* návrhu. **Multi-edit** je druhá polovina úkolu: několik **různých** uložených návrhů otevřených najednou, takže jedna změna platí pro všechny. Zaškrtni **dva až osm** uložených relací v **Projects** a z lišty výběru zvol **Edit together**; otevřou se jako živé karty vedle sebe na adrese `#/multi?s=<slot>,<slot>…`. Každá karta je skutečný render dané relace, ne uložená miniatura, takže to, co vidíš, je to, co se exportuje.

Všechno řídí jeden postranní panel:

- <!--i:sliders--> **Sdílené** vede - každý vstup, který dvě nebo víc vybraných relací deklaruje *stejným způsobem* (stejné id, stejný typ, stejná omezení - stejné pravidlo slučování, jaké dávková mřížka používá u svých sloupců). Uprav sdílený ovládací prvek jednou a hodnota se rozletí do každé relace, která ho deklaruje, živě na každé kartě. Dvě relace stejného nástroje sdílejí všechno; dva různé nástroje sdílejí jen vstupy, které mají společné.
- <!--i:document--> Pod tím **jedna sbalená karta na relaci** se všemi vlastními vstupy dané relace, ve stejné věrnosti jako postranní panel samotného nástroje - výběry assetů, opakující se skupiny řádků, barevná pole - plus kompaktní blok exportu: **Formát**, **Š** / **V**, **Jednotka**, **DPI** a vlastní **Stáhnout**. Tohle Stáhnout relaci nejdřív uloží a pak ji vykreslí obyčejnou cestou exportu relace, takže soubor nese stejný název, formát a Content Credentials, jaké by měl rovnou z nástroje.
- <!--i:search--> **Filtrovat vstupy…** nahoře zúží ovládací prvky napříč *všemi* kartami najednou - takhle se dostaneš k "titulku" v osmi relacích, aniž bys ho musel/a hledat rolováním.

Klikni na kterékoli plátno (nebo na něm stiskni Enter) a karta té relace v postranním panelu se otevře a posune do zobrazení. **Uložit vše** zapíše každou relaci zpátky do jejího slotu. **Stáhnout vše** nejdřív uloží a pak vykreslí celou sadu stejnou cestou jako **Vykreslit výběr** v Projektech - jeden zip, cestou nabídne i volitelný zámek heslem.

Dvě upřímné meze. Strop dvě až osm je skutečný: každá karta si nasazuje vlastní živý runtime a tohle je počet, který zůstane svižný - odkaz, který žádá víc (nebo relaci, která už neexistuje), to řekne, místo aby se načetl napůl. A odkaz pojmenovává *tvoje* uložené sloty, takže tu sadu znovu otevře na tomhle zařízení; není to odkaz ke sdílení.

Když je výběr větší než osm, míchá nástroje nebo obsahuje kromě relací i obrázky, únikovým východem je **Upravit jako tabulku** ve stejné liště výběru: otevře celý výběr jako **řádky v dávkové mřížce** (`#/pro?s=…`), bez limitu velikosti a bez pravidla jednoho nástroje. Složky zůstávají mimo obojí - mají vlastní cestu otevření v mřížce. ([Hledat](/info/search.html) je jediná věc, která sem zatím nedosáhne: Hromadné úpravy jsou jediné zobrazení, o kterém vyhledávací lišta neví.)

## Offline a instalace

Lolly je PWA. Dál funguje **offline** na obrazovkách, které jsi už otevřel/a, a **Aplikace** pod **Nastavení → Dostupné offline** stáhne zbytek - nainstaluj si ji z adresního řádku prohlížeče (nebo přes *Add to Home Screen* na mobilu) pro zážitek podobný aplikaci, na celou obrazovku. Aktualizuje se sama, jakmile jsi znovu online.

K aktualizacím: pokud se zobrazení někdy nenačte hned po jedné z nich (prázdný panel, "failed to fetch" v rohu), načti stránku znovu jednou - appka čistě přejde na novou verzi a tvoje uložená práce, relace a značka zůstanou nedotčené; jen obrázek, který jsi přidal/a a nikdy neuložil/a, možná bude potřeba přidat znovu. Všechno ukládá na tvém zařízení, ne na stránce.

Design a Darkroom umí zachovat původní přesnost obrázku s úpravami **Wide colour / HDR**, včetně videa v Sekvenci. Vzorky značky mohou nést oddělené hodnoty sRGB a P3. Viz [Úpravy širokého barevného rozsahu a HDR](/info/hdr-editing.html) pro možnosti výstupu a aktuální omezení.


### Live pages that take the clicker

Select a Web page box and turn on **Make interactive**. Its focus step keeps the clicker in the deck while Up and Down control the highlighted page. Owner settings cover highlights, scroll stops, automatic movement and keyboard handover. See [Live pages that take the clicker](/info/interactive-pages.html).
