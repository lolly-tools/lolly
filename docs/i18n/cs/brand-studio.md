# Brand Studio

**Brand Studio** na `#/start` je jediné místo, kde tvaruješ svou značku - její loga, barvy, písmo, zbytek tvých tokenů a soubory, které si drží. Nastav to tady jednou a každý nástroj, stránka i export se tím řídí *konstrukčně*, ne díky kontrole.

Změny se náhledově zobrazují **živě napříč celou aplikací**, jak je provádíš, takže vidíš, jak barva nebo font dopadne všude, ještě než to potvrdíš. Vše běží na zařízení: tvé soubory značky a tokeny nikdy neopustí tvůj počítač (výběr Google Fontu stáhne od Googlu jednou tu jednu rodinu, po souhlasném dialogu), a značka cestuje v jediném souboru [balíčku značky](#move-a-brand-between-devices).

> **Tohle je editor. Dashboard je zrcadlo.** Karta **Design systém** na Dashboardu (`#/d`) tvou značku *zobrazuje* jen pro čtení; *upravuješ* ji tady na `#/start`. Pokud chceš později změnit barvu, vrať se do Brand Studia.

## Místnosti

Studio je sada **místností** vypsaných v postranní liště - ne kroků. Nic není očíslované, nic není podmíněné ničím jiným a přijít do kterékoli z nich je v pořádku:

- **Přehled** - centrum. Co existuje právě teď, na první pohled, s dveřmi do každé místnosti.
- **Barvy** - přidávej barvy po jedné, přiřazuj role nebo vygeneruj celou paletu z jedné barvy.
- **Písmo** - čtyři řezy, ze kterých čte aplikace, tvé nástroje a každý export.
- **Loga** - tvé značky, ve všech orientacích a úpravách.
- **Tokeny** - zaoblení rohů, rozestupy, stíny a zbytek systému.
- **Soubory** - obrazové, zvukové a pohybové soubory, které tvá značka uchovává.

Na telefonu se stejný seznam mění na vodorovný pás štítků připnutý pod záhlavím. Přepnutí místnosti nic nenačítá znovu - editor si drží všechny své panely připojené a jednoduše zobrazí ten, který sis vyžádal.

**Odkaž přímo na místnost** pomocí `#/start?area=<key>`. Klíče jsou `overview`, `color` *(všimni si americké varianty v URL)*, `type`, `logos`, `tokens`, `catalogue` (místnost Soubory - klíč panelu je trvalý závazek, takže URL si ponechává starý název) a `versions`. `?tab=` je dlouhodobě zavedený alias pro totéž a stále funguje, takže staré odkazy a záložky zůstávají funkční; cokoli nerozpoznaného otevře Overview místo toho, aby skončilo naprázdno.

K **patě lišty** jsou připnuté akce, které patří celému designovému systému, ne jedné místnosti:

- **Add from…** - výběr zdroje, pro vnesení brandu ze souboru, PDF, obrázku, fontu nebo webu. Viz [Vnesení brandu](#bring-a-brand-in) níže.
- **Tray** - kandidáti, které sken našel, ale ještě nejsou potvrzeni. Zůstává skrytý, dokud sken skutečně něco neponechá, a pak nese počet; nic v něm nezmění tvůj brand, dokud na daném řádku nestiskneš Add.
- **Export** - zapíše celý designový systém jako jeden `LollyBrand-….lolly`.
- **Tokens (.json)** - samotný dokument s design tokeny, pro repozitář, build krok nebo jiný nástroj na tokeny.
- **Restore brand settings** - vrať se ke kontrolnímu bodu uloženému před importem nebo nahrazením nastavení brandu.
- **Versions** - publikuj, aktivuj a obnovuj pojmenované kopie designového systému. Skrytá, dokud není co publikovat vlastního (nebo o ni jménem nepožádá odkaz `?area=versions`).

![Lišta místností studia - Overview, Colours, Type, Logos, Tokens a Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview je první místnost, a má dvě tváře.

Ve stavu **zatím nic není vybráno** místnost píše **Udělej si to po svém**. **Start from a reference** otevře výběr zdroje pro logo, snímek obrazovky, webovou stránku nebo soubor s designem. **Vyber barvu**, **Vyber řez** a **Přidat logo** otevřou přímo své existující ovládací prvky. Každá cesta začíná volbou; otevřením se nic nezapíše. **Prozkoumat nástroje** je k dispozici hned.

Jakmile je cokoli tvoje vlastní, tatáž místnost ukáže **co máš**, s tvými počty na prvním místě. Barvy udávají počet barev, které designový systém nese, a přidávají tlumené `· N starter` jen tam, kde jsou vidět zděděné barvy; pruh vedle nich řadí nejdřív barvy, které jsi vybral/a sám/sama, pak vlásečnici a vybledlé startovní. Písmo čte podle role (*Inter pro nadpisy*, s *Starter pro zbytek · SUSE, SUSE Mono* pod tím). Loga čtou, kolik slotů je vyplněných, nebo **Nenastaveno**. Tokeny nesou zaoblení rohů, označené *starter*, dokud ho nepřesuneš. Soubory hlásí **Zatím nic**, dokud je knihovna prázdná. Každý blok je dveřmi do své místnosti. Jsou tu počty, nikdy ne ukazatel průběhu a nikdy ne dokončovací karta - v tomto studiu nic není dlužné.

## Logos

Začni tím, že vysypeš svou složku se značkami do zóny pro přetažení nahoře: **"Drop marks here, or choose several at once"** přijme tolik souborů, kolik jich máš, najednou. Každý soubor se prohlédne kvůli tvaru a barvě a pak se zařadí pod **Waiting for a slot** jako čip, který říká, co si myslí - *"Looks like the Horizontal primary"*, s mírou, ze které vycházel, a tlačítkem **Place** (**Replace**, tam, kde je daný slot už vyplněný). Tam, kde si není jistý, to čip otevřeně řekne a místo toho nabídne **Change slot**, které vypíše všech osm.

Kolem té fronty se dějí dvě věci. Značka s přebytečným prázdným okrajem dostane nejdřív **nabídku oříznutí** - odpověz na ni nebo stiskni Escape a původní soubor se vloží beze změny. A tam, kde značka může zásobit prázdný sourozenecký slot, místnost nabídne odvozenou verzi **mono** nebo **reverse** jako vlastní čip, označený *Generated*, který zase zmizí, pokud ten slot vyplníš jinak.

Pod tím sedí mřížka, ve které každá značka skončí - sloty **orientace × zpracování**:

- **Orientations:** Horizontal (wordmark + symbol v řadě) a Vertical (naskládané, pro čtvercové a vysoké prostory).
- **Treatments:** Primary, Primary reverse (pro tmavá pozadí), Mono (jedna barva) a Mono reverse.

To je osm volitelných slotů. Klikni na slot pro přidání PNG, SVG, JPEG nebo WebP; klikni na vyplněný slot pro jeho nahrazení. Každý slot je volitelný a všechno zůstává na tomto zařízení.

![Matice log - každá orientace napříč nahoře, každé zpracování jako vlastní přerušovaný slot, všechny volitelné](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - přidej značky, které si tvůj brand pojmenovává po svém (ikonu, znak, favicon) pod **Custom marks**; pojmenuj ji a vyber soubor.
- **More identities** - subbrand, produkt nebo akce může mít vlastní kompletní sadu log. Použij **+ Přidat další logo** a pojmenuj ji; tvá hlavní sada je prostě "Your logo".
- **Nahraj SVG a Lolly z něj přečte barvy.** Na zbrusu nové instalaci si podle toho tiše nastaví primární barvu z loga a řekne to. U existujícího brandu barvu místo toho nabídne jako návrh - *"Found in the logo: #…"* s tlačítkem **Použít jako primární** vedle ní - v místnosti Colours, kde ji můžeš přijmout nebo odmítnout.

## Colours

Místnost roste spolu s designovým systémem. Na stránce není nic, co jsi ještě nepotřeboval/a, takže první návštěva je jedno rozhodnutí a zbytek přichází spolu s paletou.

### První barva

Designový systém bez vlastních barev se otevře na jednom vystředěném sloupci: **Začni jednou barvou**, velký živý čip, pole a tichý řádek říkající, že role, odstíny a tisková nastavení přibydou, jak systém poroste.

- **Čip je výběr barvy.** Stiskni ho a na čipu se otevře vlastní OKLCH karta studia, předvyplněná tím, co právě drží pole: název, kolo, čtyři ciferníky, alfa a **Uloženo jako**, s **Zrušit** a **Přidat barvu** dole. Tažením ciferníku obarvíš čip a průběžně přepisuješ pole, a nic se nedostane do designového systému, dokud nestiskneš **Přidat barvu**.
- **Pole přijímá jakoukoli notaci** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` nebo obyčejný název barvy - a celý *seznam* barev se stane řadou čipů, které přidáváš jeden po druhém.
- **Vedle sedí ještě dvoje dveře.** Kapátko (na prohlížeči, který ho má) sebere barvu z obrazovky a **Z obrázku** přečte snímek obrazovky nebo fotku na tomto zařízení a nabídne barvy, které v ní najde.
- **Add se nikdy nedeaktivuje.** Když v poli není nic čitelného, otevře výběr barvy, což je obvykle to, co znamená prázdné stisknutí; text, který nedokáže rozebrat, dostane pod polem řádek, který to řekne, místo mrtvého tlačítka.

První barva se stane **primární**, a čip, který na přidání odpoví, to řekne - *"Primary is now Vivid Violet"* - s **Doladěním** vedle.

![Místnost Colours bez zatím ničeho vybraného - jeden velký živý čip, jedno pole a jeden řádek o tom, co přijde později](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** je slovo pro cokoli, co přišlo s aplikací, místo aby sis to vybral/a. Čerstvá instalace nenese žádnou barvu vůbec: má jen jednu neutrální škálu, inkoust na papíře, aby se plochy, text a vlásečnice vykreslily dřív, než kdokoli o čemkoli rozhodl. Tyhle neutrální barvy jsou lešení, takže se nepočítají jako barvy a nekreslí se v panelu palety. Žijí v místnosti [Tokeny](#tokens) jako **Neutrální · výchozí · 9**, s **Otevřít**, které je ukáže v panelu Colours jako jednu sbalenou, označenou skupinu (`#/start?area=color&group=neutral`).

Totéž slovo prochází každou místností: role stojící na startovní barvě čte *"Starter Paper stands in"* a její výběr nabízí **Vybrat…**; startovní řez nosí štítek **Starter** a žádný nádech; startovní zaoblení rohů je otagované na Overview. Zděděný materiál se nikdy nekreslí přerušovaným okrajem, protože přerušovaný okraj tady znamená cíl pro puštění.

### Jak paleta roste

Tvé barvy zůstávají vedle náhledu **In context** na širokém displeji a na menších obrazovkách se skládají nad něj. Náhled může ukázat plakát, graf nebo kartu rozhraní s použitím tvé palety. Startovní barvy zůstávají ve své vlastní sbalitelné skupině, oddělené od barev, které přidáš.

Přidávej jednotlivé barvy nebo sadu odstínů, přiřazuj jim role a otevírej pokročilé sekce, kdykoli je potřebuješ. Graf barev, přechody a ovládací prvky pro stažení zůstávají u palety.

![Místnost Colours po přidání jedné barvy, s její paletou a živým náhledem kompozice](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Role - co čtou nástroje

**Role** jsou vrstva navrch vzorků: která barva hraje jakou část v každém nástroji a exportu. Role jsou volitelné (designový systém se třemi volnými barvami a bez rolí je naprosto v pořádku), kterýkoli vzorek může roli převzít a odečet kontrastu se měří proti ploše, nejdřív podle APCA.

Řádek se čte v jednom ze tří registrů, takže pruh nikdy netvrdí rozhodnutí, které nikdo neudělal:

- vlastní barva sloužící roli, na plnou sílu;
- **Starter *Paper* zaskakuje** - tlumeně, s **Vybrat…** na svém výběru;
- **↳ řídí se primární** - role se rozřeší přes primární barvu, místo aby měla vlastní.

Jakmile má paleta odstíny, pruh se rozroste na všech sedm slotů, které nástroj umí číst: Primary, Secondary, Surface, Text, Muted, Edge a On primary. On primary se odvozuje z primární barvy, čte se jako **Odvozeno** a nemá vlastní výběr.

**Vlastní akcent aplikace je preference, ne token.** Ve výchozím stavu se rozhraní řídí designovým systémem a akcent chromu přebírá primární barvu. To je nastavení Vzhledu na [tvém profilu](/info/profile.html) - **Rozhraní se řídí design systémem** - a vypnutím zůstane chrom neutrální. Nástroje, plátna a exporty tím nejsou ovlivněné ani tak, ani tak, a fonty a zaoblení rohů se řídí designovým systémem bez ohledu na to, jestli je nastavení zapnuté nebo vypnuté.

### Expertní křídla

Pod náhledem kompozice a barevnými rolemi sedí čtyři sbalené sekce. Otevři tu, kterou chceš; každá je adresovatelná přímým odkazem jako `#/start?area=color&focus=<wing>`, který ji otevře bez ohledu na to, co místnost jinak zobrazuje:

- **Explore shades & harmonies** (`focus=generate`) - jedna barva se promění v kompletní sadu odstínů. Popsáno níže.
- **Shade curves** (`focus=curves`) - přetvaruj škálu bod po bodu. Světlost, sytost a odstín mají každý vlastní křivku, přepínají se přes L / C / H, a odstíny pod nimi se během tažení přepočítávají živě.
- **Contrast** (`focus=contrast`) - **Zámek kontrastu** přeladí škálu tak, aby splňovala cíle APCA vůči pozadí, které vybereš, přičemž každý krok si zachová vlastní odstín a sytost; **Otočit odstín** otočí celou škálu vcelku po kole, každý odstín si podrží svou světlost a sytost.
- **Print** (`focus=print`) - čím se primární barva stane na tisku: jejím automatickým hodnotou pro obrazovku, nebo místo toho připnutou sestavou CMYK či pojmenovanou přímou barvou.

### Jedna barva, celá paleta

Uvnitř **Explore shades & harmonies** vyber **Starting colour**. Lolly navrhne odpovídající odstíny pomocí stejné perceptuální barevné matematiky (OKLCH), kterou engine používá jinde. Doluď návrhy:

- **Scheme** - Mono, Complement, Analogous nebo Triad - určuje, jak se sekundární barva vztahuje k primární.
- **Shades** - posuvník od 3 do 20 (výchozí 5) řídí, kolik kroků každá škála generuje.
- **Fine-tune** (sbalené) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) a **Text on brand** (Auto / Light / Dark).

Změna počáteční barvy a ovládacích prvků mění jen návrhy. Klikni na odstín pro přidání té barvy, nebo na **Přidat 5 odstínů** pro přidání celé skupiny (počet se řídí tvým nastavením Shades). Existující barvy a role zůstávají na místě. **Zpět** přidání odstraní.

Řádky **Primary**, **Neutral** a **Secondary** ukazují navržené odstíny. Otevři **Theme preview** a prohlédni si světlé a tmavé ukázky i jejich hodnoty kontrastu. Zvol tam krok Neutral nebo Secondary, abys upravil/a navržené kotvy motivu. Přestavba celé palety zůstává samostatnou, kontrolovanou akcí níže.

![Tři navržené skupiny odstínů, s jednotlivými ovládacími prvky pro přidání a samostatným Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Sestav si paletu (generátor harmonie)

V **Find matching colours** generátor harmonie navrhuje odpovídající akcentové barvy z primární. Vyber **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** nebo **Analogous** (což s sebou nese vlastní počet **Accents**, 2 až 5, a úhel **Angle** od 10° do 45°) - a každý kandidát přichází s automaticky vygenerovaným čitelným názvem a tlačítkem **+ Přidat**. Přidáním se daná barva okamžitě dostane do palety, jedno stisknutí na jeden token. **In context** ukáže náhled tvých přidaných barev na ukázkových kompozicích.

![Vygenerované akcenty, každý se vzorkem, automaticky vygenerovaným názvem, svým hex kódem a tlačítkem Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Potvrzení vygenerované palety

Přidání navržené barvy nebo skupiny odstínů zachová zbytek tvé palety. Pro úplnou náhradu otevři **Rebuild the whole palette…** a stiskni **Preview full rebuild**. Kontrola vysvětlí změny: kolik rolí zůstává tak, jak jsi je přiřadil/a, kolik barev, které jsi přidal/a sám/sama, se ponechá, kolik křivek odstínů se znovu ukotví, kolik tiskových uzamčení se znovu připne, kolik skrytých odstínů zůstane skrytých, kolik zastávek přechodu si podrží svou barvu.

**Apply rebuilt palette** na té kartě to potvrdí; **Zrušit** odejde a nic nezmění. Jakmile proběhne, karta nabídne **Zpět**, už rovnou zaměřené - a kontrolní bod celého designového systému se pořídí *před* výměnou, takže "vrátit to tak, jak to bylo" je obnova, ne ztracené odpoledne.

### Paleta, graf a jednotlivé vzorky

Paleta vypisuje barvy designového systému ve sbalitelných skupinách, každá s vlastním ovládacím prvkem **+ Add**. Vytvářej a přejmenovávej skupiny, aby sis uspořádal/a práci. Role nikdy nevytvoří druhou dlaždici: jeden token je jedna dlaždice, a dlaždice, na kterou role ukazuje, nosí místo toho malou značku v rohu (**P**, **S**, **Su**, **T**). Pod dlaždicemi se **Colour chart** rozbalí na dva pohledy na tytéž vzorky: **Wheel** (kolo OKLCH - přetažením bodu ho přebarvíš, kliknutím na bod ho upravíš nebo kliknutím na prázdné místo přidáš nový vzorek) a graf **Gamut**, který ukazuje, kde zobrazitelný rozsah skutečně končí. `#/start?area=color&focus=chart` otevře kartu přímo, stejně jako to vždy dělá `?wheel`.

![Panel palety, každá skupina sbalitelná, s pilulkou pro stažení zaparkovanou na jejím dolním okraji](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Kolo OKLCH - úhel je odstín, vzdálenost od středu je sytost a šedé odstíny jedou po dráze jasu na okraji](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Kliknutím na kterýkoli vzorník otevřeš jeho editor:

- **Přejmenuj** ho.
- **Nastav barvu** - výběr se otevře na perceptuálních posuvnících **OKLCH**, s režimy pro **Hex**, **HSL**, **RGB** a **CMYK**; pole hodnoty čte *i* zapisuje v aktivním prostoru, takže můžeš vložit hex nebo zadat procenta inkoustu. Zadání CMYK nastaví *obrazovkovou* barvu převodem - pro přesné inkousty použij zámek tisku níže.
- **Uloženo jako** - zvol, jak se vzorník uchovává: **LCH** (výchozí - perceptuální, se širokým gamutem, nejlepší volba pro úpravy), Hex, RGB nebo HSL. Přepiš, když potřebuješ přesně zafixovat starší hex nebo shodovat hodnotu sRGB.
- **Použít jako** - přiřaď tomuto vzorníku přímo jednu z rolí značky, bez návratu do panelu Role. (Vlastní dlaždice role to nenabízí - role nemůže převzít roli.)
- **Náhrady pro tisk** (sbaleno) - uzamkni chování barvy v tisku:
  - **CMYK** - přepni z **Auto** na **Uzamčeno**, aby se automatický převod sRGB→CMYK přepsal přesnými hodnotami inkoustu (C/M/Y/K, 0-100).
  - **Přímá barva** - přepni z **Žádná** na **Nastaveno**, aby se vzorník uzamkl na přímou barvu; zadej **Název** (např. `PANTONE 186 C`), volitelnou **Knihu** a volitelné **Provedení** (Běžný inkoust jako výchozí) pro případy, kdy inkoust ve skutečnosti není inkoust - fólie, ražba nebo slepotisk, lak na místa, soft touch nebo výsek, biglování či perforace.
- **V dalších prostorech** (sbaleno) - stejná myšlenka rozšířená: každý řádek je prostor, ve kterém lze tento vzorník vyjádřit, buď odvozený z kanonické hodnoty, nebo zadaný tebou, přičemž zadaný má při exportu přednost.

Tyto zámky tisku používá tiskárna při exportu CMYK PDF nebo TIFF - viz [Export](/info/exporting.html#colour-profiles).

**Odstranění vzorníku** je bezpečné: odvozené kroky rampy a role motivu se pouze *skryjí* (podkladový token se dál rozřeší, takže se nic po proudu nerozbije), zatímco barvy, které jsi přidal sám, se odstraní úplně.

### Práce s mnoha vzorky

Každý vzorek má samostatné táhlo pro tažení. Přetáhni ho pro přeřazení barev v rámci skupiny, nebo ho zaměř, stiskni mezerník, použij šipky a mezerník znovu stiskni pro puštění. Escape akci zruší. Pořadí přežije opětovné otevření studia a dá se vrátit zpět. Pro přesun barev mezi skupinami použij ovládací prvek **Group** v editoru vzorku, nebo vyber víc barev a použij **Move**. Názvy tokenů a odkazy na role zůstávají neporušené.

Výběr v panelu palety je gesto, ne režim. Není tlačítko, které bys musel/a stisknout jako první, a lišta se objeví s první vybranou dlaždicí a zmizí s poslední.

- **Táhni po prázdném místě panelu**, abys nakreslil/a obdélník: každá dlaždice, které se dotkne, se přidá do výběru, napříč hranicemi skupin. Sbalená sekce nepřispěje ničím, a tažení, které se nikam nepohne, výběr vymaže.
- **Shift-klik** vezme rozsah v pořadí čtení; **Cmd/Ctrl-klik** přepne jednu dlaždici; obyčejné kliknutí pořád otevře editor té dlaždice.
- Každé záhlaví skupiny nese **Vybrat vše**, a **Cmd-A** se zaměřenou dlaždicí vezme každou barvu, kterou designový systém vlastní - nikdy ne startovní.
- Mřížka má jeden tab stop. Šipky ji procházejí, Shift-šipky rozšiřují výběr, mezerník přepíná dlaždici, Delete odstraní výběr a Escape ho vymaže. (Šipky jen přesouvají zaměření: pro doladění kanálu stiskni nejdřív `l`, `c` nebo `h`, jak říká odečet.)
- Na dotykové obrazovce žádný obdélník není. Stiskni a podrž dlaždici, abys zahájil/a výběr, pak ťukej pro přidávání; **Vybrat vše** pro danou skupinu nese zbytek.

Sama lišta ukazuje **{n} vybráno**, pak **Přesunout do** (existující skupiny, nebo nové, kterou pojmenuješ v nabídce), **Přiřadit roli** (každá vybraná barva postupně přebere další roli, takže čtyři dlaždice vyplní všechny čtyři role jedním stisknutím), **Stáhnout** (výběr v kterémkoli ze šesti formátů palety), **Kopírovat hodnoty** (jeden řádek na barvu v její uložené notaci) a **Smazat**. Přesunout do a Přiřadit roli se objeví, jakmile má paleta odstíny k přesouvání. Jedno Ctrl/Cmd-Z vrátí celou hromadnou akci - přesun čtyřiceti, průchod rolemi, smazání - a smazání řekne, co ponechalo, protože výběr zasahuje i dlaždice, které tahle místnost neodstraňuje.

### Přechody

Volitelný panel **Přechody** staví z tvé palety blend tokeny pro pozadí a akcenty. Pokud tvá značka přechody nepoužívá, klidně ho přeskoč. Každý přechod má náhled, pojmenované body (2-8) a úhel. Klíčové chování: **bod odkazuje na vzorník**, takže když přebarvíš daný vzorník, přechod ho následuje. Interpolace probíhá v OKLCH kvůli čistým přechodům. Odstraněním bodu run zkrátíš.

### Vezmi paletu jinam

Plovoucí pilulka zaparkovaná na spodním okraji panelu palety stáhne celou paletu jako **Design tokeny (JSON)**, **CSS proměnné**, **CSS třídy**, **SCSS proměnné**, **paletu GIMP (.gpl)** nebo **Adobe Swatch Exchange (.ase)** - takže designový systém rovnou zapadne do Illustratoru, Figmy, GIMPu nebo stylopisu. Sedí mimo posuvník panelu, takže si drží místo bez ohledu na to, jak daleko se paleta posune, a objeví se, jakmile má paleta odstíny. (Paletu můžeš stáhnout i ze zobrazení [Assety](/info/using.html#assets-your-library).)

## Typ

Tahle místnost roste stejným způsobem. Bez vlastního řezu je to jedna karta a jedno rozhodnutí: **Primary**, nastavené na čtecí velikost v řezu, který ji dnes obsluhuje, štítek **Starter** vedle názvu, vyplněné **Vyber řez** a řádek "Nothing installs until you choose one." Pod kartou sedí "Headings, code and italic follow the primary until you choose them", s **Vybrat je zvlášť**, které na zbytek návštěvy odhalí další tři karty.

![Místnost Type bez zatím zvoleného řezu - jedna karta ve čtecí velikosti, na ní štítek Starter, a jedno vyplněné Vyber řez](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Vyber jeden řez a místnost se otevře do **čtyř karet rolí**, seznamu Fonts a živého vzorku. Ty čtyři řezy jsou ty, které aplikace, tvé nástroje a každý export skutečně čtou:

- **Primární** - text těla, tlačítka a každý nástroj.
- **Nadpisy** - display řez pro `h1`/`h2`.
- **Kód** - monospace řez pro kód a data.
- **Kurzíva** - pravý kurzívní doprovod pro zdůraznění, citace a vsuvky.

Nadpisy, kód a kurzíva se každý vrátí k primárnímu, dokud je nepřiřadíš, takže designový systém s jedním řezem tu nepotřebuje žádná rozhodnutí.

**Nádech znamená, že sis to vybral/a.** Kartu nádech dostane jen tam, kde jsi ten řez nainstaloval/a. Startovní řez nosí stejný štítek **Starter**, jaký nosí zděděné skupiny palety, v tlumeném registru a bez nádechu, a role, kterou nikdo nevybral, čte **↳ řídí se primární**, místo aby opakovala název primární, jako by byla vybraná. Tlačítko říká **Změnit** na tvém vlastním řezu a **Vyber řez** všude jinde. Nic na kartě nic nezavazuje: tlačítko otevře **srovnávací scénu** omezenou na danou roli.

![Odhalené čtyři karty rolí - každá sazená v řezu, který ji obsluhuje, se štítkem Starter tam, kde nikdo nevybral, a Italic řídící se primárním](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Srovnávací scéna

![Srovnávací scéna otevřená pod svou kartou, s řádkem hledání, připnutými rodinami a kartami sbalenými do jednořádkového pruhu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Scéna se otevře **přímo v místnosti**, ne v dialogu, a rovnou pod kartou, na kterou jsi stiskl/a. Dokud je otevřená, karty se sbalí do jednořádkového pruhu role a řezu, takže scéna je na první obrazovce i na mobilu. Escape akci zruší a vrátí klávesnici kartě, ze které jsi ji otevřel/a.

Zvolit řez znamená tři stisknutí:

1. **Vyber řez** na kartě.
2. Napiš název rodiny a stiskni **Náhled** - nebo stiskni jednu ze šesti **připnutých** rodin pod polem, jedno stisknutí na každou. Karta se zobrazí, jako by se už načítala, s kostrou tam, kde bude vzorek, místo písma rozhraní zastupujícího řez, který jsi ještě neviděl/a.
3. **Použít tento řez**.

**Souhlas se žádá jednou, při stisknutí, které jsi udělal/a.** Když náhled poprvé sáhne na Google Fonts, dialog řekne, co se stane: *Google se dozví název rodiny a tvou IP adresu. Soubor pak zůstane na tomto zařízení a používá se offline. Tohle je jediný krok ve studiu, který sahá ke třetí straně.* **Načíst z Google** pokračuje a zapamatuje se. **Zrušit** nechá kartu říkat "Not fetched. Nothing was sent to Google." s vlastním živým **Načíst z Google**, takže změnit názor je jedno stisknutí přímo na kartě. Žádná karta nikdy neukazuje mrtvé tlačítko: ať je v jakémkoli stavu, její jedno primární tlačítko říká, co je další krok.

**Přetáhni soubor s fontem na scénu** a rovnou se ukáže náhled - **TTF**, **OTF** nebo **WOFF** z tvého vlastního počítače, což je cesta pro licencované firemní písmo, které už vlastníš. Tahle zóna pro přetažení je jediné dveře pro soubor v této místnosti.

Ať tak či onak, řez zůstává na tomto zařízení, vykresluje se v aplikaci, ve tvých nástrojích i v každém exportu, offline navždy, a cestuje v souboru designového systému - při vykreslování se nic nestahuje. Vše na Google Fonts se dodává pod otevřenou licencí (OFL/Apache/UFL).

### Fonty na tomto zařízení

Panel **Písma** vypisuje každý řez, který tohle zařízení má, a roli, které slouží. Řezy, které jsi přidal/a, vedou pod **V design systému**, každý se svými rolemi a smazáním, a ten, který obsluhuje Primary, nese odznak. Startovní řezy následují v jednom sbaleném řádku - *Starter · SUSE, SUSE Mono · obsluhuje Primary a Code, dokud nevybereš* - tlumeně, bez smazání a bez čeho povýšit, protože ani jedno není rozhodnutí, které kdokoli udělal. **Přidat řez** otevře stejnou srovnávací scénu bez omezení.

Panel **Role písma** v patě ukazuje živý vzorek každé role - tělo a UI v primárním, volitelný display řez pro horní nadpisy, kurzívu pro zdůraznění, mono pro kód a data - s rodinou a jejím stavem vedle každé (*Inter*, *SUSE · starter*, *SUSE · řídí se primární*), takže se celá sada dá přečíst najednou.

## Tokeny

Zbytek designového systému, upravitelný bez zásahu do kódu:

![Místnost Tokeny - posuvník rádiusu rohů plus rozestupy, velikosti, stíny a zbytek systému](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Zaoblené rohy** - jediný posuvník rádiusu (0–1,5rem), který sledují karty, tlačítka a panely napříč aplikací.
- **Neutrální** - škála inkoustu na papíře, se kterou přichází čerstvá instalace, vypsaná jako **Neutrální · výchozí · 9** s jejími devíti kroky a **Otevřít** do panelu Colours. Je to jediné místo, kde se spravují startovní neutrální barvy, a štítek *starter* zmizí ve chvíli, kdy je škála vygenerována místo zděděná.
- **Další tokeny** - přidávej a uprav **rozestup**, **velikost**, **šířku čáry**, **krytí**, **rotaci**, obyčejná **čísla** a **stíny**. Vyber typ, pojmenuj ho (*Mezera, Stín karty…*) a nastav jeho hodnotu. Ty se ukládají jako standardní [design tokeny](/info/design-tokens.html) (DTCG) a cestují s designovým systémem.

## Soubory

Sem odlož soubory, které tvá značka uchovává - kromě log: **vektorové**, **obrazové**, **zvukové** a **pohyblivé** (video, Lottie, animované) prostředky. Přistanou v zobrazení [Assety](/info/using.html#assets-your-library), setříděné do sekcí a připravené ve výběru prostředků každého nástroje. Vše zůstává v tomto zařízení. (Lišta pojmenovává místnost **Soubory**; klíč URL zůstává `catalogue`, protože klíč panelu je trvalý závazek.)

## Přines vlastní značku

**Přidat z…** v patě lišty otevře dvoufázový výběr. První fáze se ptá, co *máš*, ne jaký je to formát:

- **Design tokeny nebo soubor s designem** - DTCG nebo JSON z Tokens Studio, projekt Penpot, **zip se sadami tokenů**, balíček designového systému Lolly nebo SVG.
- **PDF** - prezentace nebo soubor s pravidly, přečtený v tomto zařízení kvůli jeho barvám, značkám a vloženým řezům písma.
- **Logo or screenshot** - obrázek se stane navrženou paletou, přečtenou v tomto zařízení. Nic se nenahrává. Tohle čte barvy, ne písmo nebo rozvržení na obrázku.
- **Saved web page** - vyber jeden soubor HTML a jeho soubory CSS, nebo vlož HTML či CSS. Až 20 souborů a 2 MB celkem. Čte se jen dodaný text; propojené prostředky se nestahují a skripty se nespouštějí. Tahle cesta funguje i bez rozšíření nebo desktopové aplikace.
- **Soubor s fontem** - TTF, OTF nebo WOFF. Otevře místnost Type, kde se řez nainstaluje.
- **Web** - jedna stránka, přečtená kvůli jejím barvám a písmu. Tahle dlaždice se objeví jen na zařízení, které skutečně umí stránku přečíst, protože zakázaná dlaždice nabízející něco, co nikdo nemůže stisknout, je horší než žádná dlaždice. Kde se objeví, jasně řekne, který čtenář se používá: stažený aplikací na tomto zařízení, nebo přečtený přes rozšíření prohlížeče na pozadí, přihlášené jako ty. Zadání URL adresu jen *předvyplní* pole - tlačítko pro stažení je souhlas, takže odkaz, který ti někdo pošle, nemůže čtení nikdy sám spustit.

Vyber zdroj se souborem designu a druhá fáze je karta níže: přijímané formáty vedou jako ikonové dlaždice v pořadí preferencí a celá karta je jeden cíl přetažení - klikni kamkoli na ni nebo na ni přetáhni soubor. Soubor můžeš přetáhnout i přímo na studio.

![Karta importu - přijímané formáty vedou jako ikonové dlaždice a celá karta je jeden cíl přetažení](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Co ti dá každý soubor s designem:

- balíček **designového systému Lolly** (`.lolly`; starší `.zip` se stále přijímá) - nainstaluje se v jednom kroku;
- export z **Penpotu** (`.penpot`) - natáhne jeho design tokeny;
- soubor **Design Tokens** (`.json`) - W3C DTCG;
- soubor **Tokens Studio** (`.json`) - Tokens Studio;
- **obyčejné SVG** (`.svg`) - Lolly proskenuje jeho barvy a necháš tě vybrat, které ponechat, přičemž první se stane tvou primární.

Logo/snímek obrazovky, web nebo uložená stránka otevře **Your suggested design system**. Podívej se na příklad s navrženými barvami, zvol jinou **Main colour**, pokud potřebuješ, a pojmenuj systém. **Use this design system** aplikuje vygenerované světlé a tmavé palety a vrátí se na Overview. Existující fonty zůstávají na místě. Tohle nahradí barvy aktivního systému a další nastavení tokenů. Kontrolní bod musí nejdřív uspět; **Restore brand settings** obnoví předchozí nastavení.

**Source details and individual choices** ukazuje, co bylo přečteno, rozpoznané názvy fontů a kontrast textu/akce v náhledu. Nabízí také **Choose individual items in the tray** a **Download design context**. Zpráva JSON nese pozorování, navržené tokeny a informace o zdroji; uložené HTML/CSS obsahuje SHA-256 dodaného textu. Neobsahuje syrový text stránky a není podepsaným Content Credential. Názvy fontů jsou návrhy: Type zůstává místem, kde se fonty vybírají a instalují.

PDF a další importy souborů s designem si zachovávají své existující kontrolní prvky. Položky uchované v **Tray** nic nezmění, dokud nejsou přidány přes místnost, které daný druh materiálu patří.

`#/start?source=<kind>` otevře výběr na daném zdroji (`file`, `pdf`, `image`, `font`, `url`, `page`), a `?import` ho otevře na obyčejném seznamu.

## Přenes značku mezi zařízeními

**Export** v patě lišty zapíše jeden **`LollyBrand-….lolly`** - tvé tokeny, fonty, loga a preferenci motivu, s manifestem integrity, který se ověří při zpětném vložení. Webová vydání před 1.0.7 pojmenovávala tentýž náklad `.zip`; tenhle starší zápis se pořád přijímá. Vedle toho **Tokens (.json)** zapíše samostatně obyčejný dokument s design tokeny: žádné fonty, žádná loga, jen tokeny, což je to, co skutečně čte repozitář, krok CI nebo jiný nástroj na tokeny.

Vrátit jeden zpátky se dělá přes **Přidat z… → Design tokeny nebo soubor s designem** (výše), nebo přetažením na studio. Takhle ti kolega předá značku, nebo takhle ji přeneseš na druhou instalaci - žádný účet, žádný cloud. Pro přinesení značky z příkazové řádky viz [`ingest:brand`](/info/configuration.html#brand-packs).

## Obnov dřívější nastavení

Zvol **Restore brand settings** v patě lišty, vyber datovaný kontrolní bod, pak stiskni **Obnovit**. Obnoví barvy, nastavení písma a další tokeny brandu pro aktivní brand. Soubory s fonty a obrázky zůstávají, jak jsou.

Lolly uloží tvé aktuální nastavení jako **Before restore**, než kontrolní bod použije. Zvolením toho kontrolního bodu obnovu vrátíš zpět, i po zavření a znovuotevření prohlížeče. Posledních 20 kontrolních bodů se uchovává na tomto zařízení. Pokud se úložiště nedá přečíst nebo se aktuální nastavení nedá uložit, dialog nahlásí problém, abys to mohl/a zkusit znovu.

## Verze

**Versions** v patě lišty je místo, kde designový systém přestává být pohyblivým cílem. Publikuj jednu a dostaneš **trvalou, pojmenovanou kopii** uloženou na tomto zařízení: potom už se nikdy nezmění, takže nástroj, který ji připíná, dál kreslí to samé. Panel zůstává skrytý, dokud není co vlastního publikovat, takže studio, které nikdy nepublikuje, tyto ovládací prvky nikdy nevidí.

Tři věci, které stojí za to vědět předtím, než na cokoliv klikneš - a panel je uvádí všechny tři před stiskem, ne až po něm:

- **Verze je trvalá.** Zatím neexistuje mazání, takže panel uvádí, co bylo zachováno a že to zachované zůstává, místo aby nabízel tlačítko, které lže.
- **Odstranění vede kartu kompatibility.** Přidané a změněné tokeny jsou novinka; *odstraněný* je to, co rozbíjí nástroj, takže je jmenován první a nazván tím, čím je.
- **Publikování nelze vzít zpět; obnovení ano.** *Restore latest from this version* je obyčejná úprava hlavy, takže jde na zásobník zpětných kroků studia a panel ti hned nabídne **Undo**.

Můžeš zvolit **Publish only**, nebo **Publish and make active** - rozdíl je v tom, zda nástroje a aplikace od teď sledují danou verzi, nebo zůstávají u tvé nejnovější úpravy. **Follow the latest again** dá každou úpravu naživo v okamžiku, kdy vznikne. `#/start?area=versions` otevře panel přímo.

## Když je brand pevně daný

Některé sestavení dodávají **uzamčený designový systém**, jako je SUSE Brand. Jeho otevření ukáže poznámku jen ke čtení s **Udělejte úpravnou kopii** a **Switch**. Jeho původní barvy, fonty a tokeny zůstávají neporušené. Tvé vlastní lokální systémy zůstávají upravitelné, i když byl uzamčený systém na zařízení první. V Profilu **Otevřít** vybere systém a otevře jeho studio; **Vytvoř nový** vytvoří lokální systém a otevře ho na `#/start` se zaměřeným polem názvu.

## Kam dál

- **[Using Lolly](/info/using.html)** - plátno, ukládání, projekty a Assety.
- **[Design Tokens](/info/design-tokens.html)** - tokenový model, ve kterém je tvůj brand vyjádřený.
- **[Exporting & formats](/info/exporting.html)** - tiskové jednotky, CMYK a formáty, do kterých se tvůj brand renderuje.


## Najdi a porovnej vzhled

Otevři **Find a look** z Overview nebo seznamu designových systémů v Profilu. Procházej systémy uložené na tomto zařízení a pár znovupoužitelných příkladů Lolly. Hledej podle názvu, barevného štítku nebo deklarovaného fontu. **Closest to my current palette** řadí podle naměřené barevné podobnosti, přičemž shodné rodiny fontů rozhodují remízy; není to skóre kvality.

Vyber jeden vzhled pro kontrolu, nebo dva pro porovnání. Tlačítko kontroly zůstává dostupné i na malé obrazovce. Výběr vzhledu nic nezmění. **Use this saved system** přepne přes existující registr designových systémů. **Použít tyto barvy** aplikuje příklad přes obyčejný tok kontrolního bodu a instalace, přičemž zachová aktuální fonty. **Restore brand settings** může obnovit předchozí vzhled.

Pod **Details and design context** mají uložené systémy upravitelné **Search tags** a stažení kontextu. Příklady používají původní barevné recepty Lolly; neexistuje žádná vzdáleně sesbíraná sbírka inspirace ani povinný účet.

![Porovnej Sunroom a Orchard vedle sebe, než použiješ kterýkoli z barevných systémů.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

Porovnání drží obě palety viditelné vedle sebe. Kontrola vzhledu nic nezmění, dokud nezvolíš **Použít tyto barvy** nebo **Use this saved system**.

## Přečti si důkazy o zdroji

Volitelné detaily kontroly zdroje ukazují typografii, mezery, odsazení a hodnoty rohů tam, kde byly pozorovány. Uložené HTML/CSS a nativní čtení webu hlásí deklarace, které vykreslená stránka nemusí použít. Rozšíření prohlížeče může hlásit naměřené styly z omezeného vzorku viditelných prvků, s jeho viewportem a preferencí barvy prohlížeče. Starší rozšíření pořád fungují s deklarovanými styly. Chybějící pole říkají **Not observed**.

Tohle jsou pozorování, ne automatická nastavení stylu. Soubory s fonty se skenem reference nestahují ani neinstalují, a rozestupy ze zdroje potichu nenahrazují ty tvé. Počty popisují výskyty ve vzorku, ne důvěru nebo kvalitu.

## Zkontroluj kompozici proti designovému systému

V Designu otevři **Export**, pak **Před exportem**. Kontrola používá stejnou platnou verzi designového systému jako vykreslení. Porovnává autorské barvy, aliasy tokenů, volby fontů a ID obrazových assetů. Vlastní hodnoty mohou být záměrné; obrázek mimo deklarované assety brandu je položka ke kontrole, ne zakázaný obrázek.

Tam, kde je k dispozici konkrétní návrh barvy nebo fontu, jeho tlačítko změní jen tu jednu vrstvu. Obyčejné **Zpět** obnoví původní hodnotu. Uzamčené nebo změněné vrstvy starý návrh nepřepíše. Chybějící důkaz o zdroji zůstává oddělený od shody. Vykreslený kontrast a rozvržení textu kontrolují existující zapojené kontroly. Přechody, efekty, vnořený obsah nástroje, práva a subjektivní kvalita se porovnáním brandu nehodnotí. Kontroly neblokují **Stáhnout**.

## Použij kontext designu lokálně

**Download design context** obsahuje dokument tokenů, rozřešené barvy, deklarované rodiny fontů, ID assetů, důkaz o zdroji tam, kde je zaznamenaný, pokrytí a explicitní pravidla. Neobsahuje soubory s fonty ani důkaz vlastnictví. Kontrola reference navíc obsahuje své navržené tokeny a pozorování.

CLI umí přečíst kterékoli z těchto stažení bez serveru:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` přijímá vstupy Design s polem `boxes` nebo zkompilovaným dokumentem Design. Hlásí navržené opravy, aniž by upravil kompozici. Neumí měřit rozvržení prohlížeče ani vykreslený kontrast. Existující zdroj MCP **lolly://design-context** zpřístupňuje kontext platného systému přes nakonfigurovaný lokální proces MCP; není potřeba žádná nová hostovaná služba ani API klíč.
