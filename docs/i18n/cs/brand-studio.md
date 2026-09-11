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
- **Export** - zapíše celý brand jako jeden `LollyBrand-…zip`.
- **Tokens (.json)** - samotný dokument s design tokeny, pro repozitář, build krok nebo jiný nástroj na tokeny.
- **Versions** - publikuj, aktivuj a obnovuj pojmenované kopie designového systému. Skrytá, dokud není co publikovat vlastního (nebo o ni jménem nepožádá odkaz `?area=versions`).

![Lišta místností studia - Overview, Colours, Type, Logos, Tokens a Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview je místnost, ve které přistaneš, a má dvě tváře.

Když **ještě nic není nastaveno**, nabízí dvoje dveře - **Start from a file** (design tokeny, projekt Penpot, balíček designového systému nebo SVG) a **Start from scratch** (přidej jednu barvu, pak pokračuj, kdy budeš chtít) - a tichý východ **Explore the tools** pod nimi, protože i odejít je legitimní odpověď.

Jakmile designový systém existuje, tatáž místnost ukáže **co máš**: paletu a počet jejích barev, aktivní typové rodiny, kolik slotů na loga je vyplněných, kolik je tokenů a místnost Files. Každý blok je dveřmi do své místnosti. Jsou tu počty, nikdy ne ukazatel průběhu a nikdy ne dokončovací karta - v tomto studiu nic není dlužné.

## Logos

Začni tím, že vysypeš svou složku se značkami do zóny pro přetažení nahoře: **"Drop marks here, or choose several at once"** přijme tolik souborů, kolik jich máš, najednou. Každý soubor se prohlédne kvůli tvaru a barvě a pak se zařadí pod **Waiting for a slot** jako čip, který říká, co si myslí - *"Looks like the Horizontal primary"*, s mírou, ze které vycházel, a tlačítkem **Place** (**Replace**, tam, kde je daný slot už vyplněný). Tam, kde si není jistý, to čip otevřeně řekne a místo toho nabídne **Change slot**, které vypíše všech osm.

Kolem té fronty se dějí dvě věci. Značka s přebytečným prázdným okrajem dostane nejdřív **nabídku oříznutí** - odpověz na ni nebo stiskni Escape a původní soubor se vloží beze změny. A tam, kde značka může zásobit prázdný sourozenecký slot, místnost nabídne odvozenou verzi **mono** nebo **reverse** jako vlastní čip, označený *Generated*, který zase zmizí, pokud ten slot vyplníš jinak.

Pod tím sedí mřížka, ve které každá značka skončí - sloty **orientace × zpracování**:

- **Orientations:** Horizontal (wordmark + symbol v řadě) a Vertical (naskládané, pro čtvercové a vysoké prostory).
- **Treatments:** Primary, Primary reverse (pro tmavá pozadí), Mono (jedna barva) a Mono reverse.

To je osm volitelných slotů. Klikni na slot pro přidání PNG, SVG, JPEG nebo WebP; klikni na vyplněný slot pro jeho nahrazení. Každý slot je volitelný a všechno zůstává na tomto zařízení.

![Matice log - každá orientace napříč nahoře, každé zpracování jako vlastní přerušovaný slot, všechny volitelné](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - přidej značky, které si tvůj brand pojmenovává po svém (ikonu, znak, favicon) pod **Custom marks**; pojmenuj ji a vyber soubor.
- **More identities** - subbrand, produkt nebo akce může mít vlastní kompletní sadu log. Použij **+ Add another logo** a pojmenuj ji; tvá hlavní sada je prostě "Your logo".
- **Nahraj SVG a Lolly z něj přečte barvy.** Na zbrusu nové instalaci si podle toho tiše nastaví primární barvu z loga a řekne to. U existujícího brandu barvu místo toho nabídne jako návrh - *"Found in the logo: #…"* s tlačítkem **Use as primary** vedle ní - v místnosti Colours, kde ji můžeš přijmout nebo odmítnout.

## Colours

![The Colours room after one colour - the two panes back, the generate offer, roles reading in three registers and the pane at one colour](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

Nejbohatší místnost, ve dvou panelech. Levý je tam, kde pracuješ; pravý je tvá **živá paleta**. Přetáhni oddělovač mezi nimi pro změnu velikosti (Enter na něm paletu sbalí z cesty).

![Místnost Colours - primární barva odvozuje škály, karty vzorků s kontrastními poměry a živá paleta](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Přidej barvu, pak jí dej úkol

**Add a colour** je celá jednoduchá cesta: vlož nebo vyber barvu v jakékoli notaci a stane se přesně jedním tokenem. Nic se z ní neodvozuje, nic se do ní nenavrhuje, nic dalšího se nevyžaduje. Vlož celý *seznam* barev a každá se stane čipem, který můžeš přidat samostatně.

**Roles** je vrstva navrch - která barva hraje jakou roli. Role jsou volitelné (designový systém se třemi volnými barvami a bez rolí je naprosto v pořádku), kterýkoli vzorek může roli převzít a odečet kontrastu se měří proti ploše, nejdřív podle APCA.

### Expertní křídla

Pod těmi dvěma sedí čtyři sbalené sekce. Otevři tu, kterou chceš; každá je adresovatelná přímým odkazem jako `#/start?area=color&focus=<wing>`:

- **Generate a starter palette** (`focus=generate`) - jedna barva se promění v kompletní sadu odstínů. Popsáno níže.
- **Shade curves** (`focus=curves`) - přetvaruj škálu bod po bodu. Světlost, sytost a odstín mají každý vlastní křivku, přepínají se přes L / C / H, a odstíny pod nimi se během tažení přepočítávají živě.
- **Contrast** (`focus=contrast`) - **Contrast-lock** přeladí škálu tak, aby splňovala cíle APCA vůči pozadí, které vybereš, přičemž každý krok si zachová vlastní odstín a sytost; **Rotate hue** otočí celou škálu vcelku po kole, každý odstín si podrží svou světlost a sytost.
- **Print** (`focus=print`) - čím se primární barva stane na tisku: jejím automatickým hodnotou pro obrazovku, nebo místo toho připnutou sestavou CMYK či pojmenovanou přímou barvou.

### Jedna barva, celá paleta

Uvnitř **Generate a starter palette** vyber **Primary colour** a Lolly vypočítá kompletní paletu - světlé a tmavé plochy, text, akcenty a plné škály odstínů/tónů - pomocí té samé perceptuální barevné matematiky (OKLCH), kterou engine používá všude. Doladění odvození:

- **Scheme** - Mono, Complement, Analogous nebo Triad - určuje, jak se sekundární barva vztahuje k tvé primární.
- **Shades** - posuvník od 3 do 20 (výchozí 5) řídí, kolik kroků každá škála generuje.
- **Fine-tune** (sbalené) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) a **Text on brand** (Auto / Light / Dark).

Nic v tomto křídle nezapisuje nic do tvého brandu. Je to náhled, živý napříč aplikací, aby sis ho mohl posoudit, až do chvíle, kdy stiskneš **Replace palette** (níže).

Pod primární barvou uvidíš živé škály **Primary / Neutral / Secondary / Blend** a karty vzorků Light a Dark, každá se svým vlastním odečtem kontrastu - poměr WCAG s hodnotou APCA `Lc` vedle něj. **Klikni na krok ve škále Neutral nebo Secondary**, abys místo odvozeného výchozího nastavení ukotvil daný odstín.

![Čtyři škály nastavené nad kartami vzorků light a dark, každá karta nese vlastní kontrastní poměr WCAG](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Sestav si paletu (generátor harmonie)

Pořád ve stejném křídle **Build your palette** generuje odpovídající akcentové barvy z tvé primární. Vyber **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** nebo **Analogous** (což s sebou nese vlastní počet **Accents**, 2 až 5, a úhel **Angle** od 10° do 45°) - a každý kandidát přichází s automaticky vygenerovaným čitelným názvem a tlačítkem **+ Add**. Přidáním se daná barva okamžitě dostane do tvé palety, jedno stisknutí na jeden token. *"Your palette, applied"* předvádí náhled celé sady na reálné grafice.

![Vygenerované akcenty, každý se vzorkem, automaticky vygenerovaným názvem, svým hex kódem a tlačítkem Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Potvrzení vygenerované palety

**Replace palette** je jediný ovládací prvek v tomto křídle, který cokoli zapisuje, a nikdy to nezapíše hned. Stiskni ho a nejdřív se otevře kontrolní karta s nadpisem **"Replace the palette?"**, která vyjmenuje přesně to, co se chystá stát: kolik rolí zůstává tak, jak jsi je přiřadil, kolik barev, které jsi přidal sám, se ponechá, kolik křivek odstínů se znovu ukotví, kolik tiskových uzamčení se znovu připne, kolik skrytých odstínů zůstane skrytých, kolik zastávek přechodu si podrží svou barvu.

**Replace palette** na této kartě to potvrdí; **Cancel** odejde a nic nezmění. Jakmile proběhne, karta se změní na **"Palette replaced."** s tlačítkem **Undo**, které je už rovnou zaměřené - a kontrolní bod celého designového systému se pořídí *před* výměnou, takže "vrátit to tak, jak to bylo" je obnova, ne ztracené odpoledne.

### Paleta, graf a jednotlivé vzorky

Pravý panel vypisuje každou barvu, kterou tvůj brand nese, seskupenou (Primary, Neutral, Secondary, Spectrum, Custom, Roles), přičemž každou skupinu lze sbalit a má vlastní **+ Add**. Pod ním se **Colour chart** rozbalí na dva pohledy na tytéž vzorky: **Wheel** (kolo OKLCH - přetažením bodu ho přebarvíš, kliknutím na bod ho upravíš nebo kliknutím na prázdné místo přidáš nový vzorek) a graf **Gamut**, který ukazuje, kde zobrazitelný rozsah skutečně končí. `#/start?area=color&focus=chart` otevře kartu přímo, stejně jako to vždy dělá `?wheel`.

![Panel palety, každá skupina sbalitelná, s pilulkou pro stažení zaparkovanou na jejím dolním okraji](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Kolo OKLCH - úhel je odstín, vzdálenost od středu je sytost a šedé odstíny jedou po dráze jasu na okraji](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A500%3Bclick%3A%5Bdata-be-generate-cta-go%5D%3Bwait%3A900%3Bclick%3A%5Bdata-be-replace-palette%5D%3Bwait%3A800%3Bclick%3A%5Bdata-be-review-go%5D%3Bwait%3A1400%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

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

### Přechody

Volitelný panel **Přechody** staví z tvé palety blend tokeny pro pozadí a akcenty. Pokud tvá značka přechody nepoužívá, klidně ho přeskoč. Každý přechod má náhled, pojmenované body (2-8) a úhel. Klíčové chování: **bod odkazuje na vzorník**, takže když přebarvíš daný vzorník, přechod ho následuje. Interpolace probíhá v OKLCH kvůli čistým přechodům. Odstraněním bodu run zkrátíš.

### Vezmi paletu jinam

Plovoucí pilulka zaparkovaná na spodním okraji panelu palety stáhne celou paletu jako **Design tokeny (JSON)**, **CSS proměnné**, **CSS třídy**, **SCSS proměnné**, **paletu GIMP (.gpl)** nebo **Adobe Swatch Exchange (.ase)** - takže značka rovnou zapadne do Illustratoru, Figmy, GIMPu nebo stylopisu. Sedí mimo posuvník panelu, takže si drží místo bez ohledu na to, jak daleko se paleta posune. (Paletu můžeš stáhnout i z pohledu [Katalog](/info/using.html).)

## Typ

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

Místnost vede se **čtyřmi kartami rolí** - čtyřmi tvářemi, které aplikace, tvé nástroje a každý export skutečně čtou. Každá karta ukazuje, co danou roli aktuálně obsluhuje, nastavené v daném řezu, s řádkem skutečného textu pod tím:

- **Primární** - text těla, tlačítka a každý nástroj.
- **Nadpisy** - display řez pro `h1`/`h2`.
- **Kód** - monospace řez pro kód a data.
- **Kurzíva** - pravý kurzívní doprovod pro zdůraznění, citace a vsuvky.

Nadpisy, kód a kurzíva se každý vrátí k primárnímu, dokud je nepřiřadíš, takže značka s jedním fontem tu nepotřebuje žádná rozhodnutí. Nic na kartě nic nezavazuje: **Změnit** (nebo **Vybrat řez** u prázdné role) otevře **srovnávací scénu** omezenou na danou roli.

![Místnost Typ - karty rolí a živý vzorek každého řezu při práci](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

### Srovnávací scéna

Scéna se otevře **přímo v místnosti**, ne v dialogu, takže karty, ze kterých jsi přišel, zůstanou na obrazovce. Vyhledej rodinu z Google Fonts (Inter, Fraunces, Space Grotesk…) nebo přetáhni soubor s fontem, stiskni **Přidat do srovnání** a kandidáti stojí vedle sebe ve stejných slovech dřív, než se kterýkoli z nich nainstaluje. Escape zruší akci a vrátí klávesnici kartě, ze které jsi scénu otevřel.

To jsou jediné dveře dovnitř, a proto se do tvé značky nic nedostane bez povšimnutí. Pod pódiem sedí dva správní panely:

- **Fonty v tomto zařízení** - každá nainstalovaná rodina, role, kterým slouží, a smazání. **Přidat řez** zde otevře stejnou srovnávací scénu bez omezení.
- **Tvé fonty** - nahraj **TTF**, **OTF** nebo **WOFF** z vlastního počítače. To je cesta pro licencované firemní písmo, které už vlastníš.

Ať tak či onak, řez zůstává v tomto zařízení, vykresluje se v aplikaci, ve tvých nástrojích i v každém exportu, offline navždy a cestuje s tvým balíčkem značky - při vykreslování se nic nestahuje. Vše na Google Fonts se dodává pod otevřenou licencí (OFL/Apache/UFL).

Panel **Role typu** v patě ukazuje živý vzorek každé role - tělo a UI v primárním, volitelný display řez pro horní nadpisy, kurzívu pro zdůraznění, mono pro kód a data - takže vidíš celou sadu, jak funguje pohromadě.

![Vzorek Rolí typu - nadpis, tělo, kurzíva a kód, každý sazen v řezu, na který se daná role rozřeší, s názvem řezu vedle](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

## Tokeny

Zbytek designového systému, upravitelný bez zásahu do kódu:

![Místnost Tokeny - posuvník rádiusu rohů plus rozestupy, velikosti, stíny a zbytek systému](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Zaoblené rohy** - jediný posuvník rádiusu (0-1,5rem), který sledují karty, tlačítka a panely napříč aplikací.
- **Další tokeny** - přidávej a uprav **rozestupy**, **velikosti**, **tloušťku tahu**, **průhlednost**, **rotaci**, obyčejná **čísla** a **stíny**. Vyber typ, pojmenuj ho (*Mezera, Stín karty…*) a nastav jeho hodnotu. Ty se ukládají jako standardní [design tokeny](/info/design-tokens.html) (DTCG) a cestují s tvou značkou.

## Soubory

Sem odlož soubory, které tvá značka uchovává - kromě log: **vektorové**, **obrazové**, **zvukové** a **pohyblivé** (video, Lottie, animované) prostředky. Přistanou v tvém [Katalogu](/info/using.html), setříděné do sekcí a připravené ve výběru prostředků každého nástroje. Vše zůstává v tomto zařízení. (Lišta pojmenovává místnost **Soubory**; klíč URL zůstává `catalogue`, protože klíč panelu je trvalý závazek.)

## Přines vlastní značku

**Přidat z…** v patě lišty otevře dvoufázový výběr. První fáze se ptá, co *máš*, ne jaký je to formát:

- **Design tokeny nebo soubor s designem** - DTCG nebo JSON z Tokens Studio, projekt Penpot, **zip se sadami tokenů**, balíček designového systému Lolly nebo SVG.
- **PDF** - prezentace nebo soubor s pravidly, přečtený v tomto zařízení kvůli jeho barvám, značkám a vloženým řezům písma.
- **Obrázek** - snímek obrazovky nebo fotka; jeho barvy se čtou v tomto zařízení a nic se nenahrává.
- **Soubor s fontem** - TTF, OTF nebo WOFF. Otevře místnost Typ, kde se řez nainstaluje.
- **Web** - jedna stránka, přečtená kvůli jejím barvám a typu. Tato dlaždice se objeví jen na zařízení, které skutečně umí stránku přečíst, protože zakázaná dlaždice nabízející něco, co nikdo nemůže stisknout, je horší než žádná dlaždice. Kde se objeví, jasně pojmenuje svého čtenáře: staženo aplikací v tomto zařízení, nebo přečteno přes rozšíření prohlížeče na pozadí, přihlášené jako ty. Zadání URL adresu jen *předvyplní* pole - tlačítko pro stažení je souhlas, takže odkaz, který ti někdo pošle, nemůže čtení nikdy sám spustit.

Vyber zdroj se souborem designu a druhá fáze je karta níže: přijímané formáty vedou jako ikonové dlaždice v pořadí preferencí a celá karta je jeden cíl přetažení - klikni kamkoli na ni nebo na ni přetáhni soubor. Soubor můžeš přetáhnout i přímo na studio.

![Karta importu - přijímané formáty vedou jako ikonové dlaždice a celá karta je jeden cíl přetažení](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

Co ti dá každý soubor s designem:

- balíček **LollyBrand** (`.zip`) - nainstaluje se v jednom kroku;
- export z **Penpotu** (`.penpot`) - natáhne jeho design tokeny;
- soubor **Design Tokens** (`.json`) - W3C DTCG;
- soubor **Tokens Studio** (`.json`) - Tokens Studio;
- **obyčejné SVG** (`.svg`) - Lolly proskenuje jeho barvy a necháš tě vybrat, které ponechat, přičemž první se stane tvou primární.

Instalace ze zdroje si nejdřív udělá **kontrolní bod**, takže "vrátit se před import" je jedno obnovení. A to, co skenování najde, nejde rovnou dovnitř: kandidáti přistanou v **Přihrádce**, kde se každý přidává vlastním stiskem, přes místnost, které daný druh materiálu patří.

`#/start?source=<kind>` otevře výběr na daném zdroji (`file`, `pdf`, `image`, `font`, `url`) a `?import` ho otevře na obyčejném seznamu.

## Přenes značku mezi zařízeními

**Export** v patě lišty zapíše jeden **`LollyBrand-…zip`** - tvé tokeny, fonty, loga a preferenci motivu, s manifestem integrity, který se ověří při zpětném vložení. Vedle toho **Tokeny (.json)** zapíše samostatně obyčejný dokument s design tokeny: žádné fonty, žádná loga, jen tokeny, což je to, co skutečně čte repozitář, krok CI nebo jiný nástroj na tokeny.

Vrátit jeden zpátky se dělá přes **Přidat z… → Design tokeny nebo soubor s designem** (výše), nebo přetažením na studio. Takhle ti kolega předá značku, nebo takhle ji přeneseš na druhou instalaci - žádný účet, žádný cloud. Pro přinesení značky z příkazové řádky viz [`ingest:brand`](/info/configuration.html#brand-packs).

## Verze

**Versions** v patě lišty je místo, kde designový systém přestává být pohyblivým cílem. Publikuj jednu a dostaneš **trvalou, pojmenovanou kopii** uloženou na tomto zařízení: potom už se nikdy nezmění, takže nástroj, který ji připíná, dál kreslí to samé. Panel zůstává skrytý, dokud není co vlastního publikovat, takže studio, které nikdy nepublikuje, tyto ovládací prvky nikdy nevidí.

Tři věci, které stojí za to vědět předtím, než na cokoliv klikneš - a panel je uvádí všechny tři před stiskem, ne až po něm:

- **Verze je trvalá.** Zatím neexistuje mazání, takže panel uvádí, co bylo zachováno a že to zachované zůstává, místo aby nabízel tlačítko, které lže.
- **Odstranění vede kartu kompatibility.** Přidané a změněné tokeny jsou novinka; *odstraněný* je to, co rozbíjí nástroj, takže je jmenován první a nazván tím, čím je.
- **Publikování nelze vzít zpět; obnovení ano.** *Restore latest from this version* je obyčejná úprava hlavy, takže jde na zásobník zpětných kroků studia a panel ti hned nabídne **Undo**.

Můžeš zvolit **Publish only**, nebo **Publish and make active** - rozdíl je v tom, zda nástroje a aplikace od teď sledují danou verzi, nebo zůstávají u tvé nejnovější úpravy. **Follow the latest again** dá každou úpravu naživo v okamžiku, kdy vznikne. `#/start?area=versions` otevře panel přímo.

## Když je brand pevně daný

Některé buildy dodávají **uzamčený brand** - jeho barvy, fonty a tokeny jsou to, co používá každý nástroj i export, a není co měnit. V tom případě je studio nahrazeno krátkou poznámkou, že tento build je dodán s pevným brandem a úpravy jsou vypnuté. Je to záměr: takhle si organizace zaručí, že vše zůstane on-brand.

## Kam dál

- **[Using Lolly](/info/using.html)** - plátno, ukládání, projekty a katalog.
- **[Design Tokens](/info/design-tokens.html)** - tokenový model, ve kterém je tvůj brand vyjádřený.
- **[Exporting & formats](/info/exporting.html)** - tiskové jednotky, CMYK a formáty, do kterých se tvůj brand renderuje.
