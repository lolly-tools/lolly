# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup** na `#/start` obsahuje tvé logo, barvy a písma. Každý nástroj, stránka a export je používá při vykreslování.

Přetáhni logo a Lolly z něj přečte barvy. Vyber písmo nebo přetáhni soubor písma, ke kterému má tvá firma licenci. Každá změna se hned projeví v celé aplikaci. Tvé logo, písma a tokeny zůstávají na tomto zařízení. Jen výběr písma z Google Fonts navazuje vnější spojení: Lolly se nejdřív zeptá a pak rodinu písem jednou stáhne.

Pojmenuj designový systém a stiskni **Export**, abys získal jeden soubor `.lolly`. Soubor si uchovej, otevři ho na jiném zařízení nebo ho předej kolegovi. [Lolly Settings](/info/dashboard.html#design-system) zobrazuje aktivní systém jen pro čtení; jeho titulní karta odkazuje zpět sem k úpravám.

<!--i:eti-clock-->
## Přizpůsob si ho za pět minut

::: timeline
- <!--i:upload--> **Přetáhni své logo** do zóny pro přetažení v **Logos**. Lolly přečte jeho tvar a barvy.
- <!--i:palette--> **Use these colours.** Hlavní barva loga se stane tvou primární barvou a tmavá neutrální barva z loga se stane barvou textu.
- <!--i:font--> **Choose a face** v **Type**: písmo z Google Fonts nebo soubor písma, který vlastníš.
- <!--i:pentool--> **Pojmenuj systém.** První úprava vytvoří tvůj vlastní designový systém a Lolly se jednou zeptá na jeho název.
- <!--i:download--> **Export** zapíše celý systém jako jeden soubor `LollyBrand-….lolly`.
:::

Lišta nahoře ve studiu zobrazuje název designového systému jako upravitelné pole. **Enter** zachová nový název a **Escape** vrátí starý. Když se při první úpravě objeví otázka **What is this design system called?**, Lolly doplní slova z tvého loga, pokud je logo obsahuje. **Save name** zachová název; **Not now** ponechá zástupný název, dokud nějaký nezadáš do lišty. Název označuje systém v Settings a při přepínání a je i názvem souboru, který zapíše **Export**.

<!--i:eti-grid-->
## Místnosti

Studio je sada místností bez pevného pořadí. Žádná místnost nečeká na jinou. Na počítači jsou místnosti v jednom pruhu pod lištou. Na telefonu se přesunou do lišty podél dolního okraje a otevřená místnost se posune do zobrazení. Panel palety a zásobník se vysouvají nad tuto lištu a při psaní lišta ustoupí. Při ovládání klávesnicí se Tab zastaví na pruhu jen jednou a šipky, Home a End přepínají mezi místnostmi.

![Lišta studia a jeho místnosti: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules a Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Místnost | Co v ní děláš | Klíč odkazu |
|---|---|---|
| **Board** | Prohlížíš obsah systému, s přístupem do každé místnosti | `overview` |
| **Colours** | Přidáváš barvy, přiřazuješ jim role, vytváříš odstíny a paletu | `color` |
| **Type** | Vybíráš čtyři písma, která používá aplikace, nástroje a každý export | `type` |
| **Logos** | Umisťuješ své značky ve všech orientacích a provedeních | `logos` |
| **Tokens** | Rohy, rozestupy, stíny a všechny další pojmenované hodnoty | `tokens` |
| **Files** | Obrázky, zvukové soubory a soubory s pohybovým obsahem, které tvá značka uchovává | `catalogue` |
| **Sound** | Utváříš zvukovou identitu, hudbu pro různá použití a vztah k hlasu | `sound` |
| **Rules** | Pravidla, která tvá značka uplatňuje, ověřená na skutečných příkladech | `usage` |
| **Skills** | Psané standardy značky pro lidi a agenty, ke čtení a stažení | `skills` |

Na místnost odkážeš pomocí `#/start?area=<key>`. Klíče místností jsou trvalé, takže Files si ponechává `catalogue`, Board `overview` a Rules `usage`. `?tab=` dál funguje jako starší alias. Neznámý klíč otevře Board.

Na **liště** jsou akce pro celý systém. **Add from…** načte značku ([Načti značku](#bring-a-brand-in)). **Tray** uchovává výsledky skenování, které jsi ještě nepřidal. **Export** zapíše systém jako jeden soubor. **More** obsahuje **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** a **Design systems**, které otevře seznam v Settings, kde přepínáš systémy ([Uchovej a přenes svůj designový systém](#keep-and-move-your-design-system)). Každá akce se objeví, jakmile má s čím pracovat. Na telefonu se **Add from…** přesune do **More** a **Export** se zobrazuje jako ikona.

Dokud je designový systém ten, který přišel s aplikací, lišta začíná **Make it yours**, nabídkou **Find a look**, **Add from…** a **Pick a colour**. Jakmile je systém tvůj vlastní, toto místo znovu převezme **Export**.

<!--i:eti-clipboard-->
## Board

Dokud ještě není nic vybrané, Board nabízí čtyři způsoby, jak začít. **Start from a reference** otevře výběr zdroje pro logo, snímek obrazovky, webovou stránku nebo soubor návrhu. **Pick a colour**, **Choose a face** a **Add a logo** otevřou příslušné ovládací prvky. Jejich otevření nic nezapíše. Pod nimi nabízí **Find a look** hotové barvy a písma k vyzkoušení a **Explore the tools** je k dispozici od začátku.

Jakmile máš něco vlastního, Board ukáže, co máš, s počty vlastních položek na prvním místě. Colours uvádí počet barev s tlumeným `· N starter` u zděděných. Jeho pruh ukazuje tvé barvy, pak tenkou čáru a pak vybledlé výchozí barvy. Colourways ukazuje každý colourway jako malou dlaždici v jeho hlavní barvě. Type vypisuje každou roli a sází každou rodinu jejím vlastním písmem (*Inter pro nadpisy*, s *Výchozí pro zbytek* na řádku pod ním). Logos říká, kolik pozic je obsazených (nebo **Not set**), Tokens ukazuje poloměr rohů a Files uvádí **Nothing yet**, dokud je knihovna prázdná. Každý blok otevře svou místnost.

Upravitelný designový systém dodaný s aplikací, například Lolly Demo, od začátku ukazuje na Board své barvy, colourways, písma a značky se štítkem **Came with this app** vedle nadpisu. Nad nimi nabízí **Start here** volby **Find a look**, **Add from…** a **Pick a colour**.

### Výchozí a tvoje

V každé místnosti označuje **Starter** vše, co přišlo s aplikací a co nikdo nevybral. Čerstvá instalace nenese žádnou barvu, jen jednu neutrální řadu od inkoustu po papír, aby se povrchy, text a tenké čáry mohly vykreslit dřív, než někdo něco vybere.

::: cols
## Výchozí

- Přišlo s aplikací: neutrální odstíny od inkoustu po papír, výchozí písma, výchozí poloměr rohů.
- Tlumené, se štítkem **Starter** a bez barevného tónování.
- Nepočítá se mezi tvé barvy. Neutrální odstíny jsou v **Tokens** jako **Neutrals · starter · 9** a **Open** je ukáže v Colours jako jednu sbalenou skupinu (`#/start?area=color&group=neutral`).
- Role používající výchozí barvu uvádí *"Zastupuje ji Starter Paper"*, s **Choose…** v jejím výběru.

## Tvoje

- Vybrané nebo nainstalované tebou.
- Plně výrazné, s tónovanou kartou tam, kde jsi nainstaloval písmo.
- Započítané na Board a v Tokens.
- Role, která přebírá hodnotu jiné, uvádí **↳ follows Primary**.
:::

Zděděný obsah nikdy nemá přerušovaný okraj. Přerušovaný okraj označuje cíl přetažení.

<!--i:eti-shapes-->
## Logos

Zóna pro přetažení nahoře, **"Drop marks here, or choose several at once"**, přijme libovolný počet souborů. Lolly z každého souboru přečte tvar a barvu. Soubor pak čeká v **Waiting for a slot** jako čip, který říká, čemu se podobá, například *"Vypadá jako Horizontal primary"*, s použitou naměřenou hodnotou a tlačítkem **Place** (**Replace**, pokud je pozice obsazená). Pokud si Lolly není jistá, čip to řekne a nabídne **Change slot** se seznamem všech osmi pozic. Nic se neumístí, dokud nestiskneš tlačítko.

Značka s přebytečným prázdným okrajem nejdřív dostane nabídku oříznutí. Odpověz na nabídku nebo stiskni Escape a umísti nedotčený originál. Když značka může vyplnit prázdnou související pozici, místnost nabídne odvozenou verzi **mono** nebo **reverse** jako čip označený *Generated*.

Každá značka jde do mřížky osmi volitelných pozic, jedné pro každou kombinaci **orientace** a **provedení**:

- **Orientace:** Horizontal (wordmark a symbol v řadě) a Vertical (nad sebou, pro čtvercové a vysoké prostory).
- **Provedení:** Primary, Primary reverse (pro tmavá pozadí), Mono (jedna barva) a Mono reverse.

Skupina bez značek se sbalí do jednoho řádku; otevři ji a uvidíš její pozice. Kliknutím na pozici přidáš PNG, SVG, JPEG nebo WebP a kliknutím na obsazenou pozici značku nahradíš. Prázdná pozice přijme i přetažený soubor. Vodorovné značky jsou v širokých dlaždicích a svislé ve čtvercích, každá na povrchu, pro který byla vytvořená, s volným prostorem o velikosti čtvrtiny její výšky. Vše zůstává na tomto zařízení.

![Pozice log s otevřenými skupinami Horizontal a Vertical: každé provedení má vlastní pozici a každá pozice je volitelná](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** jsou značky, které tvá značka nazývá vlastním jménem, například ikona, erb nebo favicon.
- **Další identity.** Podznačka, produkt nebo událost může mít vlastní úplnou sadu: stiskni **+ Add another logo** a pojmenuj sadu. Tvá hlavní sada je "Your logo". [Architektury značek](/info/brand-architectures.html) ukazují, kdy použít identitu loga.
- **Lolly čte barvy loga.** Karta pod zónou pro přetažení a nahoře v Colours vypisuje barvy loga a ptá se **Which is the main colour?**. Vybraná je nejvýraznější barva, nikdy bílá, na které bylo logo exportované. **Use these colours** je přidá do palety a nastaví hlavní barvu jako primární. Pokud logo obsahuje tmavou neutrální barvu, která je čitelná na papíře, stane se tato barva barvou textu. **Not now** je ponechá v Tray. V úplně nové instalaci Lolly hned použije nejpravděpodobnější odpověď a karta nabídne **Undo** nebo jinou hlavní barvu. SVG poskytne přesné barvy; PNG, JPEG nebo WebP poskytne barvy, které pokrývají významnou část značky.

<!--i:eti-palette-->
## Colours

Místnost roste s designovým systémem. První návštěva vyžaduje jedno rozhodnutí; další ovládací prvky se objevují s rostoucí paletou.

### První barva

Systém bez vlastních barev zobrazuje výchozí neutrální odstíny v samostatné otevřené skupině. Nahoře v místnosti je oblast s přerušovaným okrajem pro vložení a přetažení: jeden velký čip a jedno pole. Přetáhni obrázek nebo seznam barev kamkoli do této oblasti a Lolly přečte barvy.

- **Čip slouží k výběru.** **Pick a colour** otevře kartu OKLCH studia s počáteční hodnotou z pole. Karta nejdřív ukazuje název barvy a hexadecimální kód. Barevné prostory, kruh, čtyři otočné ovladače a alfa jsou pod **Fine-tune** a **Cancel** a **Add colour** jsou dole. Nic se nedostane do systému, dokud nestiskneš **Add colour**.
- **Pole přijímá jakýkoli zápis**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` nebo název barvy. Vložený seznam se změní na řadu čipů, které můžeš přidat jednotlivě nebo přes **Add all**.
- **Další dvě cesty.** **Pick a colour from the screen** používá kapátko, pokud ho prohlížeč nabízí, a **Take colours from an image** čte snímek obrazovky nebo fotku na tomto zařízení.
- **Add není nikdy neaktivní.** Pokud je pole prázdné, otevře výběr; pokud text nedokáže přečíst, řádek pod polem to oznámí.

Tvá první barva se stane **primární**. Čip potvrdí změnu, například *"Primární barva je teď Vivid Violet"*, s **Fine-tune** pro úpravu barvy.


### Jak paleta roste

Na široké obrazovce jsou tvé barvy vedle náhledu **In context**, na menší nad ním. Náhled ukazuje plakát, graf nebo kartu rozhraní v tvé paletě. Výchozí barvy mají vlastní skupinu, která se sbalí, jakmile má systém vlastní barvy. Oblast pro vložení a přetažení se zmenší na jeden kompaktní řádek. Záhlaví místnosti nemá export; použij **Export** na liště nebo místnost Tokens.

![Místnost Colours s Lolly Demo: nahoře čipy rolí a oblast pro vložení a přetažení, pod nimi paleta ve sbalitelných skupinách, každá barva s názvem a hexadecimálním kódem](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Místnost Colours s Lolly Demo po přidání jedné barvy: tabulka Colour roles, pod ní čip nové barvy nabízející Use as Lead? a Fine-tune, vedle živého náhledu kompozice](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Role barev: jak se barvy jmenují

Designový systém dává svým barvám názvy a říká, k čemu která slouží, a Lolly čte obojí. **Colour roles** je nahoře v místnosti Colours. **In context** ukazuje každou změnu okamžitě.

![Tabulka Colour roles ve Wefthouse, smyšlené textilní značce, s jejími vlastními názvy: čipy colourway Indigo, Madder a Weld, pak Main, Accent, Supporting a Tertiary, každý se světlou a tmavou barvou, vyhodnocované jako hlavní barva, doplňková barva a pouze podle názvu, a Background, Text, Quiet text a Hairlines vypsané pod tabulkou jako významy, které žádná role nenaplňuje](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabulka má čtyři sloupce. Na telefonu se každý řádek změní na kartu se světlou a tmavou barvou vedle sebe:

| Sloupec | Co obsahuje |
|---|---|
| **Role** | Vlastní výraz designového systému, který můžeš upravit přímo na místě, a řádek říkající, k čemu barva slouží |
| **Light** a **Dark** | Barva v daném vzhledu pro vybraný colourway, s názvem nebo hodnotou a kontrastem |
| **Lolly reads this as** | Co nástroj s rolí dělá, slovy Lolly |

**Jak Lolly chápe roli.** Každý význam může mít jedna role. Když vybereš význam, který už má jiná role, přesune se k této roli. Lolly nikdy neodvozuje význam ze slova.

| Význam | Co z něj plyne |
|---|---|
| **Lead colour** | Velké tvary, tlačítka, hlavní barva nástroje |
| **Partner colour** | Druhá barva, po které nástroj sáhne |
| **Background** | Leží za vším ostatním |
| **Text** | Nadpisy a hlavní text |
| **Quiet text** | Popisky a drobný text |
| **Hairlines** | Linky, okraje a oddělovače |
| **By name only** | Žádný nástroj si roli nevybere sám. Nabízí se v každém poli barvy a v Designu, kde výběr zůstává propojený, takže se řídí colourway |

Význam, který neplní žádná role, si zachovává definici z designového systému a sekce tyto významy vypisuje pod tabulkou. Role, která má stejné id jako samotný význam, například role nazvaná Primary, je tímto významem a nelze ji přesunout.

**V grafu.** Paleta **Design system - colour roles first** v Lolly Chart přiřadí datovým řadám barevné role designového systému v jeho pořadí a pak zbytek jeho palety. Role chápaná jako pozadí, text, nenápadný text nebo tenké linky se vynechá, protože graf těmito barvami kreslí své pozadí a text. Dokud tuto paletu nevybereš, nic se nezmění. Designový systém bez barevných rolí vykreslí paletu jako **Design system - ordered**.

**Hodnoty.** Stiskni hodnotu a vyber barvu této role pro daný vzhled a zvolený colourway. **Same as light** naváže tmavou hodnotu na světlou, dokud nevybereš tmavou barvu. Čip **Aa** ukazuje text, který Lolly vybere pro použití na této barvě. Řádek pod hodnotou říká, jak je tento text čitelný v každém vzhledu: **Text reads well**, **Large text only** nebo **Hard to read as text**. Hodnocení se týká jen textu na dané barvě; barva může stále fungovat pro tvary a velké plochy. Role používaná jen podle názvu ukazuje stejná slova bez výstražné barvy, protože na ni žádný nástroj sám neumisťuje text. Nápověda a výběr barvy ukazují číselné údaje, nejprve APCA a pak WCAG. **Own text colour** označuje hodnotu, jejíž soubor uvádí barvu textu; tato barva textu zůstane. **Copied** označuje hodnotu z jiného colourway nebo z doplňkové barvy, kterou zatím nikdo nevybral; **Keep this colour** ve výběru barvy hodnotu potvrdí.

**Výchozí body.** Designový systém bez vlastních rolí ukazuje současná slova: Primary, Secondary, Surface a Text. Dokud některé nezměníš, nic se nezapíše. **+ Add a role** navrhne **Primary, Secondary** nebo **Main, Accent, Supporting, Tertiary**, případně přijme libovolná slova, která zadáš, a ukáže význam, který by každé dostalo. První dvě slova se stanou hlavní a doplňkovou barvou. Nástroje dál kreslí stejnými barvami. V systému s jednou hlavní barvou převezme první colourway její název.

**Přejmenování, změna pořadí, odebrání.** Přejmenování změní jen slovo; vše, co roli používá, funguje dál. Přetáhni roli za úchyt, nebo na úchytu stiskni Space, použij šipky a stisknutím Space ji pusť. **Remove** říká, co roli stále používá. Když nástroje roli používají, **Remove and keep those colours** ponechá každému významu současnou barvu. Pravidlo značky, skupina průvodce, pole nástroje nebo jiný token, který roli používá, brání jejímu odebrání, dokud se toto použití nezmění. Uložený dokument Design může také používat roli podle názvu a Lolly to ze souboru tokenů nezjistí. Takový dokument ohlásí barvu jako neurčenou.

::: details Role v ručně psaném souboru tokenů
**Ručně psaný soubor.** Barvy v souboru tokenů, které nedeklaruje žádná role, jsou uvedené pod **In this file, with no role yet**, každá s polem pro slovo a tlačítkem **Make a role**. V obou případech dál fungují podle názvu. Token s číslicemi v názvu nemůže být rolí; zůstane v souboru a dál funguje podle své cesty. Pokud záznam v souboru neprojde validací, tabulka se zobrazí bez ovládacích prvků a uvede důvod.
:::

**Zbytek sekce používá stejná slova.** Čipy, řádek **Use as** u vzorku barvy a skupina **Colour roles** v paletě používají slova designového systému. Dlaždice barevné role otevře její hodnotu. Exportované soubory nezaznamenávají o rolích nic nového; barvy vykreslení se mění, protože se změnily tokeny.

**Kam slova putují.** Slova a popisy putují s designovým systémem. Agenti je čtou v zadání návrhu, v `lolly://tokens` a v souboru `AGENTS.md` stránky značky. Terminál je ukazuje v `lolly system status`. Stránka značky je uvádí v `brand.json` a pro každou roli měří kontrast dvojice barev. Soubory DTCG a Tokens Studio uchovají vše, `DESIGN.md` uchová slova a významy a motiv PowerPointu uchová jen pořadí značky. [Barevné role v jiných formátech](/info/design-tokens.html#colour-roles-in-other-formats) uvádějí úplný seznam. Slova se vždy citují jako data designového systému, nikdy se nečtou jako instrukce.

**Kde se vybírá barva.** Každé pole barvy v nástroji a v Lolly Design uvádí nejprve role designového systému v jeho pořadí, s každým slovem a jeho účelem. **Aa** vedle role vybere barvu, která se na ní používá. Ostatní barvy následují pod **Other colours**, bez vlastních kopií pro colourway, barev pro obsah na jiných barvách a významů, které už plní nějaká role. Výběr zůstává propojený s rolí a řídí se colourway. Pole ukazuje slovo v každém colourway a používají ho také Settings a Tokens. Designový systém bez rolí si ponechá mřížku vzorků barev.

### Každá barva, kterou nástroj používá

Když je **Colour roles** zavřené, sekce začíná čipy pro první rozhodnutí. Každý čip ukazuje barvu role a její název. V systému bez vlastních slov jsou to **Primary**, **Secondary**, **Surface** a **Text**. Stiskni čip a vyber jeho barvu ze vzorků v paletě. **Every colour a tool reads** dole v **Colour roles** obsahuje celý pruh.

Pruh ukazuje sedm barev, které nástroj může používat: Primary, Secondary, Surface, Text, Muted, Edge a On primary, ve vlastních slovech designového systému, pokud je má. Každá plní stejnou funkci v každém nástroji a exportu. Žádnou není nutné nastavit a kteroukoli může zastat libovolná barva. Dobrý systém mohou tvořit tři samostatné barvy. Údaj ukazuje čitelnost textu na pozadí, nejprve APCA. Každý řádek ukazuje tvou vlastní barvu v plné intenzitě, zastupující výchozí barvu nebo **↳ follows Primary**.

On primary se odvozuje od primární barvy, má označení **Derived** a nemá výběr barvy. Přepínač **Light** a **Dark** vedle On primary a stejný přepínač vedle **In context** určují, který vzhled ukazuje pruh, paleta a náhled.

Vlastní akcent aplikace se ve výchozím stavu řídí designovým systémem prostřednictvím nastavení **Interface follows the design system** v **Settings → Appearance**. Když je nastavení vypnuté, rozhraní aplikace zůstává neutrální. Nástroje, plátna a exporty se designovým systémem řídí v obou případech.

**Colourways.** Designový systém může obsahovat několik hlavních barev, které se vybírají pro každý výtvor zvlášť. Řádek **Colourways** nahoře v **Colour roles** ukazuje jeden čip pro každý colourway a označení **Default** u kanonického. **+ Add** vytvoří nový colourway z barvy palety. Vyber čip a tabulka, pruh, paleta i náhledy ukážou tento colourway. Vybraný colourway můžeš přejmenovat, duplikovat, odebrat nebo nastavit jako výchozí. V systému s colourways potřebuje každý colourway vlastní primární a sekundární barvu a také vlastní barvu pozadí, pokud colourways pozadí tónují. Tyto role zůstávají nastavené v editoru vzorku barvy. [Přidání colourways do designového systému](/info/colourways.html#add-colourways-to-a-design-system) uvádí postup a formát tokenů a [Lolly Demo v praxi](/info/lolly-demo-in-use.html#colourways-on-real-work) ukazuje colourways na skutečné práci. Každý si může vybrat vlastní colourway v **Settings → Appearance** ([Vyber si vlastní colourway](/info/colourways.html#make-a-colourway-your-own)).

### Najdi další barvy

Tři nástroje vycházejí z tvé primární barvy. První dva jen navrhují; třetí nahrazuje paletu.

::: cols
## Prozkoumej odstíny & harmonie

Vyber **Starting colour**, **Scheme** (Mono, Complement, Analogous nebo Triad) a počet **Shades** (3 až 20, výchozí 5). **Fine-tune** nastavuje intenzitu rozhraní, kontrast a text na barvě značky. Kliknutím na odstín ho přidej, nebo pomocí **Add 5 shades** přidej skupinu. Tvé barvy a role zůstanou.

## Najdi ladící barvy

Vyber **Harmony**: Complementary, Adjacent, Triad, Tetrad nebo Analogous (s **Accents** od 2 do 5 a **Angle** od 10° do 45°). Každý návrh má vygenerovaný název a **+ Add**, jedno stisknutí pro každou barvu.

## Znovu sestav celou paletu

Nahradí paletu na základě jedné výchozí barvy, po kontrole toho, co se změní a co zůstane.
:::

Všechny tři používají stejné výpočty založené na vnímání barev (OKLCH) jako vykreslovací jádro. V **Explore shades & harmonies** ukazují řádky **Primary**, **Neutral** a **Secondary** navržené odstíny a **Theme preview** ukazuje světlé a tmavé příklady s naměřenými hodnotami kontrastu.

![Tři navržené skupiny odstínů s ovládacími prvky pro jednotlivé přidání a samostatným náhledem motivu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Vygenerované akcenty, každý se vzorkem barvy, automaticky vygenerovaným názvem, hexadecimální hodnotou a tlačítkem Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Použití vygenerované palety

Otevři **Rebuild the whole palette…** a stiskni **Preview full rebuild**. Přehled spočítá, kolik rolí zůstane tak, jak jsi je přiřadil, kolik tvých vlastních barev se zachová a kolik křivek odstínů, tiskových zámků, skrytých odstínů a bodů přechodů se znovu naváže nebo zachová. **Apply rebuilt palette** změnu provede; **Cancel** nic nezmění. Poté karta nabídne **Undo**, které už má fokus, a kontrolní bod vytvořený před výměnou obnoví celý systém.

Systém s colourways při novém sestavení zachová každý colourway. Kanonický colourway se řídí novou výchozí barvou a každý další si ponechá vlastní barvy, název, pořadí a nastavení. Přehled uvádí, který colourway se novou barvou řídí a které si barvy ponechají. Lolly znovu nesestaví systém, který ukládá své colourways způsobem, jenž neumí upravit; karta uvede důvod a nic se nezmění.

### Sekce pro pokročilé

Pod náhledem a rolemi jsou čtyři sbalené sekce. Každou otevřeš pomocí `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) mění škálu bod po bodu, se samostatnými křivkami světlosti, sytosti a odstínu (L / C / H) a překreslováním odstínů při tažení.
- **Contrast** (`focus=contrast`): **Contrast-lock** upraví tóny škály tak, aby dosáhla cílových hodnot APCA vůči vybranému pozadí, a **Rotate hue** otočí celou škálu po barevném kruhu.
- **Print** (`focus=print`) nastavuje, jak se primární barva vytiskne: automatická hodnota, pevně určené složení CMYK nebo pojmenovaná přímá barva.

### Paleta a jednotlivé vzorky barev

Paleta uvádí tvé barvy ve sbalitelných skupinách, každá má vlastní **+ Add**. Skupiny můžeš vytvářet a přejmenovávat. Role nikdy nevytvoří druhou dlaždici; dlaždice, na kterou role odkazuje, ukazuje její název, například **Primary**. **Colour chart** pod dlaždicemi ukazuje stejné barvy na kruhu OKLCH **Wheel** (tažením tečky změníš barvu, kliknutím na prázdné místo přidáš vzorek) a v grafu **Gamut**, který ukazuje, kde končí zobrazitelný rozsah. `#/start?area=color&focus=chart` otevře graf.

![Panel palety, každou skupinu lze sbalit](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Kruh OKLCH - úhel určuje odstín, vzdálenost od středu sytost a šedé barvy leží na stupnici světlosti po straně](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Kliknutím na vzorek barvy otevři jeho editor:

- **Rename** přejmenuje vzorek barvy.
- **Nastav barvu** posuvníky OKLCH nebo v **Hex**, **HSL**, **RGB** či **CMYK**. Pole hodnoty čte a zapisuje v aktivním prostoru. CMYK zde nastavuje barvu pro obrazovku převodem; přesné tiskové barvy určíš pomocí **Print substitutes**.
- **Stored as** vybírá, jak se vzorek uloží: **LCH** (výchozí, založený na vnímání a se širokým gamutem), Hex, RGB nebo HSL.
- **Use as** přiřadí vzorku roli, ve vlastních slovech designového systému, pokud je má. Opětovným stisknutím zvýrazněné role její přiřazení zrušíš.
- **Print substitutes** (sbalené): zamkni **CMYK** přepnutím z **Auto** na přesné hodnoty tiskových barev, nebo nastav **Spot colour** s **Name** (například `PANTONE 186 C`), volitelným **Book** a **Finish** pro fólii, reliéfní ražbu, hloubkovou ražbu, parciální lak, sametový povrch nebo výsek, rýhování či perforaci. Tisk tyto zámky používá při exportu CMYK PDF nebo TIFF; viz [Barevné profily](/info/exporting.html#colour-profiles). Přímá barva se v Print PDF tiskne na vlastní tiskové desce; tisk všech přímých barev procesními barvami pro jeden export popisuje [Přímé barvy jako procesní](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (sbalené): hodnota pro každý barevný prostor, odvozená nebo zadaná tebou, přičemž zadaná hodnota má při exportu přednost.

**Smazání vzorku barvy** je bezpečné. Odvozené odstíny a role motivu se skryjí, takže nic, co je používá, nepřestane fungovat. Barvy, které jsi přidal, se odstraní.

::: details Práce s mnoha vzorky barev
V klidovém stavu vzorek ukazuje barvu, název a hexadecimální hodnotu. Select zobrazí u každého vzorku zaškrtávací políčko a úchyt pro tažení na libovolné obrazovce a dlaždice s fokusem klávesnice také ukazuje svůj úchyt. Tažením úchytu změníš pořadí ve skupině, nebo nastav fokus na úchyt, stiskni Space, použij šipky a opětovným stisknutím Space ho pusť; Escape akci zruší. Na telefonu paleta ukazuje čtyři barvy na řádek. Pro přesun barev mezi skupinami použij ovládací prvek **Group** v editoru, nebo jich vyber několik a použij **Move to**.

Výběr nepotřebuje samostatný přepínač: lišta a zaškrtávací políčka se objeví s první vybranou dlaždicí a zmizí s poslední.

- **Tažením na prázdném místě** nakresli obdélník; každá dlaždice, které se dotkne, se přidá do výběru i napříč skupinami. Sbalená sekce nic nepřidá.
- **Shift-kliknutí** vybere rozsah v pořadí čtení, **Cmd/Ctrl-kliknutí** přepne výběr jedné dlaždice a obyčejné kliknutí otevře editor.
- Každé záhlaví skupiny má **Select all** a **Cmd-A** s fokusem na dlaždici vybere všechny tvé vlastní barvy, nikdy výchozí.
- Mřížka má jednu zarážku tabulátoru: šipky přesouvají, Shift se šipkami rozšiřuje výběr, Space přepíná výběr, Delete odstraňuje a Escape výběr ruší. Pro drobnou úpravu kanálu nejprve stiskni `l`, `c` nebo `h`.
- Na dotykové obrazovce stisknutím a podržením dlaždice zahájíš výběr, pak klepnutím přidáváš další.

Lišta ukazuje **{n} selected**, pak **Move to**, **Give a role** (každá barva postupně dostane další roli), **Download** (výběr v kterémkoli ze šesti formátů palety), **Duplicate** (kopie každé barvy umístěná za originálem), **Copy values** a **Delete**. Jedna kopie se otevře v editoru; více kopií zůstane vybraných. Jedno Cmd/Ctrl-Z vrátí hromadnou akci zpět.
:::

### Přechody

Volitelný panel **Gradients** vytváří z palety tokeny barevných přechodů. Každý přechod má náhled, 2 až 8 pojmenovaných bodů a úhel. Bod odkazuje na vzorek barvy, takže když vzorek přebarvíš, přechod ho následuje. Barvy se prolínají v OKLCH.

Stažení palety (designové tokeny, CSS, SCSS, GIMP a Adobe Swatch Exchange) najdeš v záhlaví palety. [Vezmi si paletu a písma kamkoli](/info/using.html#take-your-palette-and-fonts-anywhere) popisuje jednotlivé formáty.

<!--i:eti-type-->
## Písmo

Bez vlastního písma sekce ukazuje jednu kartu: **Primary**, vysázenou ve velikosti pro čtení současným písmem, se štítkem **Starter**, tlačítkem **Choose for Primary** a řádkem *„Dokud nějaké nevybereš, nic se nenainstaluje.“* Nadpisy, kód a kurzíva se řídí primárním písmem, dokud je nevybereš; **Choose them separately** zobrazí jejich karty.

![Sekce Type bez vybraného písma - jedna karta ve velikosti pro čtení, na ní štítek Starter a jedno vyplněné tlačítko Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Vyber jedno písmo a sekce se rozbalí do čtyř karet rolí, seznamu Fonts a živé ukázky:

- **Primary**: hlavní text, tlačítka a každý nástroj.
- **Headings**: nadpisové písmo pro `h1` a `h2`.
- **Code**: neproporcionální písmo pro kód a data.
- **Italic**: pravá kurzíva pro zvýraznění, citace a poznámky.

Karta je tónovaná jen tam, kde jsi dané písmo nainstaloval. Její tlačítko ukazuje roli: **Change Headings** u vlastního písma a **Choose for Headings** všude jinde. Ukázkový řádek se zalamuje. Nic na kartě změnu neprovede; tlačítko otevře porovnání pro danou roli.

![Čtyři zobrazené karty rolí - každá vysázená písmem, které jí slouží, se štítkem Starter tam, kde nikdo žádné nevybral, a s Italic podle primárního písma](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Plocha pro porovnání

Plocha se otevře pod kartou, kterou jsi stiskl. Karty se sbalí do jednořádkového pruhu, aby se plocha vešla na první obrazovku telefonu. Escape porovnání zruší a vrátí fokus na kartu.

1. Na kartě stiskni **Choose for** s příslušnou rolí.
2. Zadej název rodiny a stiskni **Preview**, nebo stiskni jednu ze šesti rodin **Pinned** pod polem.
3. Stiskni **Use this face**.

![Plocha pro porovnání otevřená pod svou kartou, s řádkem hledání, připnutými rodinami a kartami sbalenými do jednořádkového pruhu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**O souhlas se žádá jednou.** Když se náhled poprvé spojí s Google Fonts, dialog vysvětlí: *Google se dozví název rodiny a tvou IP adresu. Soubor se pak uchová na tomto zařízení a používá offline. Toto je jediný krok ve studiu, který se spojuje s třetí stranou.* **Fetch from Google** pokračuje a volba se zapamatuje. **Cancel** ponechá na kartě text *„Nestaženo. Službě Google se nic neodeslalo.“* a vlastní tlačítko **Fetch from Google**.

**Přetáhni na plochu soubor písma** (TTF, OTF nebo WOFF) a zobraz náhled licencovaného písma, které vlastníš. V obou případech písmo zůstává na tomto zařízení, vykresluje se offline v aplikaci, nástrojích i každém exportu a putuje v souboru designového systému. Vše na Google Fonts je poskytováno pod otevřenou licencí (OFL, Apache nebo UFL).

### Písma na tomto zařízení

Panel **Fonts** uvádí každé písmo na tomto zařízení a roli, které slouží. Písma, která jsi přidal, jsou první, pod **In the design system**, každé se svými rolemi a možností smazání. Výchozí písma následují v jednom tlumeném sbaleném řádku. **Add a face** otevře plochu pro porovnání pro libovolnou roli. Panel **Type roles** ukazuje živou ukázku každé role s její rodinou a stavem, například *Inter* nebo *Inter · podle Primary*.

<!--i:eti-tag-->
## Tokeny

Tokeny jsou pojmenované hodnoty, na kterých stojí designový systém: barvy, písma, loga, rohy a rozestupy. Nástroje je čtou podle názvu, takže změna tady se projeví ve všech nástrojích najednou.

![Sekce Tokens: záhlaví s příkladem ze systému a akcemi pro soubory, dlaždice s počty jednotlivých druhů tokenů, pak dvojice barev s naměřenými hodnotami kontrastu](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Záhlaví** uvádí příklad z tvého vlastního systému (*Primary je Spearmint, #033633*) a akce pro soubory: **Download** (systém jako designové tokeny nebo paletu v pěti dalších formátech), **Copy CSS** a **Add from…** pro opětovné načtení souboru JSON.
- **Dlaždice** ukazují počty jednotlivých druhů tokenů a přecházejí do jejich sekcí: Colours, Type, Logos, Shape and spacing, More a All tokens. Sekce obsahující jen to, co přišlo s prázdným výchozím systémem, má štítek **Starter**; systém dodaný s aplikací počítá vlastní materiál bez štítku. Na telefonu se dlaždice zalomí do dvou řádků po třech.
- **Colours** začíná dvojicemi, které nástroje používají společně (text na pozadí, text na primární barvě, tlumený text na pozadí), s údajem APCA ve světlém a tmavém vzhledu a označením **Weak contrast** tam, kde dvojice nevyhovuje. Pak následují všechny skupiny barev: škála jako jeden řádek čipů, ostatní barvy s hodnotou a odkazem, který používají nástroje, například `{color.brand.spearmint}`. Stisknutím odkazu ho zkopíruješ. **Edit in Colours** otevře skupinu v sekci Colours. V designovém systému s [barevnými rolemi](#colour-roles-what-the-colours-are-called) je první **Colour roles**, s každou rolí jednou, ve vlastních slovech a pořadí systému. Role uchovává barvu pro každý colourway a vzhled. Tyto barvy jsou uvedené u role, ne jako samostatné barvy; změň je v tabulce Colour roles.
- **Type** a **Logos** uvádějí písmo pro každou roli a každý slot loga, s **Edit in Type** a **Edit in Logos**, jakmile máš vlastní.
- **Shape and spacing** obsahuje **Rounded corners** (`shape.radius`) a **Spacing rhythm** (`space.base`). Každá položka ukazuje *Lolly default*, dokud nepohneš posuvníkem, a pak *Yours*, ihned se uloží a změnu lze vrátit zpět.
- **More tokens** přidává rozestupy, velikosti, tloušťku čáry, krytí, otočení, prostá čísla a stíny, uložené jako standardní [designové tokeny](/info/design-tokens.html).
- **App appearance (advanced)** uvádí barvy, velikosti a stíny, které používají vlastní obrazovky Lolly, a **Inspect every token (advanced)** prohledává a upravuje libovolnou uloženou hodnotu a každou změnu nejprve ukáže ke kontrole. Hodnoty barevné role pro jednotlivé colourways jsou zde uvedené u role: vyber token role a uvidíš jeden řádek pro každý colourway, světlý a tmavý vedle sebe. Řádek s počtem říká, kolik hodnot role obsahují. Designový systém jen pro čtení ukazuje stejný seznam.

Prázdná sekce nabízí **Pick a colour**, **Choose a face** nebo **Add a logo**.

<!--i:eti-images-->
## Soubory

Přetáhni sem soubory své značky kromě log: **vektorové**, **obrazové**, **zvukové** a **pohyblivé** soubory (video, Lottie a animace). Objeví se v [Assets](/info/using.html#assets-your-library), roztříděné do sekcí, a ve výběru assetů každého nástroje. Zůstanou na tomto zařízení.

## Zvuk

**Sound** se vybírá poslechem. Sekce se otevře se třemi výchozími zvuky, **Calm**, **Steady** a **Bright**, každý na kartě v barvách svého žánru s tlačítkem přehrávání. Přehraj jeden a uslyšíš krátkou ukázku; spuštění dalšího zastaví první. **Choose** nastaví tento zvuk pro všechna použití. Čtvrtá karta, **Mixed**, dá každému použití vlastní zvuk: Calm pro Explain, Steady pro Demonstrate a Bright pro Play. Její tlačítko přehrávání přehraje všechny tři postupně. Dokud nezvolíš **Save sound**, nic se neuloží. Zvuk se pak stane součástí tohoto designového systému, s kontrolním bodem ve stejné historii, jakou používají ostatní sekce. Designový systém bez zvuku dál funguje jako dřív.

Použití je situace, ve které zvuk hraje: zpočátku **Explain**, **Demonstrate** a **Play**. Každé použití má čip s vlastním tlačítkem přehrávání. **Music** nebo **With narration** nad čipy určuje, zda čip přehrává jen hudbu, nebo hudbu pod hlasem. Vybrané použití popisuje svůj účel a hudbu běžnými slovy, například „Hřejivá · 84 bpm · Rhodes, plynulá basová linka, zastřené bicí“. Každé použití přebírá žánr, tempo a nástroje zvoleného zvuku (nebo v případě Mixed vlastní). Každé si ponechá vlastní skladbu a vlastní vyvážení: Explain drží melodii mimo prostor hlasu a Play nechává melodii vést. Přepínání mezi Mixed a jedním zvukem obojí zachová. Použití, které jsi přidal sám, si ponechá zvuk, který má v Mixed. Designový systém zaznamenává, co jsi vybral. **Add a use** přidá použití a umožní ti rovnou zadat jeho název. **Make main** vybírá použití, které se přehrává, když není požadováno jiné. **Another tune** přehraje novou skladbu se stejným nastavením.

**Edit in the music generator** otevře [generátor hudby](/info/generated-music.html#the-music-generator) s nastavením daného použití a řádkem nahoře, který říká, čí zvuk upravuješ. **Save to this use** přenese nastavení zpět do sekce; **Cancel** se vrátí beze změn. Neuložené volby v sekci počkají, než se vrátíš. Pokud mezitím někdo uloží zvuk v jiné kartě, novější uložení zůstane a tvá úprava se vynechá.

**Voice** vybírá hlas pro dané použití, rychlost řeči a hlasitost hudby pod hlasem; **Hear the voice with the music** přehraje obojí. Pod **More** je ztlumení při řeči, text na vyzkoušení (zůstává v sekci), poznámky k výslovnosti (jedna na řádek ve tvaru psaná podoba = vyslovená podoba) a poznámky k hlasu. Náhledy používají místní model řeči a stejný mix jako export sekvence. Náhled postupně utichne; nejde o komponovaný závěr.

**Notes and signature** obsahuje, čeho si při poslechu daného použití všímat, a zvukový podpis: pevný úvod nebo závěr uchovaný jako samostatný zvukový soubor. Umísti podpis do své sekvence; vygenerovaná hudba ho nikdy neobsahuje. Požadavek, který tato verze Lolly nedokáže zkontrolovat, zabrání nové hudbě pro dané použití.

**Details** obsahuje charakter značky (jak má zvuk působit, co zůstává stejné a čemu se vyhnout) a poslechové posouzení. **Record a listening review** uchová jméno posuzovatele, datum a jeho poznámky k uložené verzi zvuku. Jakákoli změna ze zvuku znovu udělá koncept. Posouzení platí pro tuto verzi, ne pro každou skladbu později vytvořenou z tohoto zvuku: každý nový výtvor si před zveřejněním poslechni.

**Make a music project** otevře použití v generátoru hudby jako projekt, který uchová použití, verzi zvuku a přesné nastavení. **New tune** tam vytvoří novou skladbu a zachová zvuk. Pokud změníš nastavení, **Put the sound back** se vrátí ke zvuku a **Keep as my own** pokračuje s nezávislou skladbou. Dokud si nevybereš, projekt nelze uložit ani stáhnout jako vytvořený z tohoto zvuku. Odkazy pro sdílení obsahují jen nastavení hudby. Projekt a uložená skladba uchovávají také poznámky ke zvuku, které se nedostanou do odkazů pro sdílení ani do veřejných pověření zvukového souboru. Pokud se má přesné znění zvuku zachovat i v budoucích verzích generátoru, uchovej vykreslenou nahrávku.

<!--i:eti-checklist-->
## Pravidla

**Rules** určuje, co lidé mohou měnit, co zůstává pevné a co Lolly dokáže zkontrolovat.

![Rules v Lolly Demo: čtyři pravidla značky, každé označené Checked in Design a Required nebo Advisory, pak Try your design system in use s příklady připravenými k vykreslení](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** uvádí tvá pravidla. **Add rule** (nebo **Add your first rule**) otevře krátký formulář:

- **Rule name** vlastními slovy, například *Akcenty Beacon*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** nebo **Text length**, s rolí značky, kterou používá, pod tvým vlastním názvem role;
- **Example**, na který se vztahuje (Poster, Title slide, Content slide nebo Lolly Chart), **Mode** a zda je **Required** nebo **Advisory**;
- **Reviewed by**, pak **Save draft** nebo **Approve & save**.

Schválení zaznamenává tvé vlastní rozhodnutí na tomto zařízení. Schválená povinná pravidla omezují opakovaně použitelný plakát a kontroly se týkají jen ukázkových PNG; žádný jiný nástroj nemění.

Pravidla v souboru tokenů designového systému, například schválené dvojice barev, tloušťka a zarovnání textu nebo logo pro jednotlivá pozadí, jsou zde uvedená jako **Checked in Design**. Lolly Design je kontroluje vrstvu po vrstvě na kartě **Before you export** v panelu exportu a `lolly check` dělá totéž pro uložený dokument Lolly Design ([Než exportuješ](/info/design.html#before-you-export)). Pravidlo, pro které toto sestavení nemá kontrolu, se uchová v dodané podobě a označí **Unchecked**.

Lolly Demo přináší čtyři schválená pravidla značky. Nadpisy se nikdy nesázejí velkými písmeny: toto pravidlo je povinné, takže `lolly check` ohlásí nadpis velkými písmeny jako chybu. Ostatní tři jsou doporučená. Hlavní text se zarovnává vlevo. Primární loga se umisťují na světlá pozadí a inverzní loga na tmavá. Přerušované čáry znamenají, že sem lze něco přetáhnout.

**Try your design system in use** vykreslí čtyři příklady z aktuální revize pomocí **Render & check examples**. Vyber **Mode** a pomocí **Try your own text** zadej nadpis, doprovodný text a text snímku. Každý příklad uvádí, co se měřilo, s **See checks & sources** a **Download check report**. **Make reusable poster** stáhne `.lolly` s pevným rozvržením a schválenými volbami vstupů. Příklady jsou místní: spuštění kontroly nic nezveřejňuje ani neschvaluje.

Sestavení dodávané s pevně danou značkou ukazuje stejná pravidla a příklady jen pro čtení pod *This brand is set*.

<!--i:eti-graduation-cap-->
## Dovednosti

**Skills** uvádí [dovednosti značky](/info/brand-skills.html) aktivního designového systému: písemné standardy značky, jeden pro každou disciplínu, pro lidi a AI agenty. Každý řádek uvádí disciplínu, vlastní stav podle značky (**Draft** nebo **Approved**), zda je dovednost veřejná nebo interní, a její revizi. Vyber řádek a přečti si dovednost i její pokrytí, které porovnává řádky dovednosti s tvými tokeny: co Lolly kontroluje, co je v rozporu, co souhlasí a co je jen doporučení.

**Download skill (.zip)** zapíše dovednost jako složku Agent Skills pro nástroj agenta s odkazy katalogu směřujícími na tuto Lolly. **Copy as one file** vloží stejný text do schránky pro okno chatu. Designový systém bez vlastních dovedností uvádí základ, který Lolly sestaví z jeho tokenů a pravidel značky při každém čtení. Sekce dovednosti čte a nikdy je neupravuje.

<!--i:eti-upload-->
## Importuj značku

**Add from…** na liště otevře výběr, který se ptá, co máš, ne v jakém je to formátu:

- **Design tokens or a design file**: JSON DTCG nebo Tokens Studio, projekt Penpot, zip sad tokenů, balíček designového systému Lolly, SVG, `DESIGN.md` nebo složka stránky značky.
- **PDF**: sada snímků nebo soubor s pravidly, ze kterého se na tomto zařízení načtou barvy, loga a vložená písma.
- **Logo or screenshot**: z obrázku se na tomto zařízení načte navržená paleta. Načítají se barvy, ne písmo nebo rozvržení.
- **Saved web page**: jeden soubor HTML a jeho soubory CSS nebo vložené HTML či CSS, až 20 souborů a 2 MB. Čte se jen text, který dodáš: odkazované zdroje se nestahují a skripty se nespouštějí.
- **Font file**: TTF, OTF nebo WOFF. Otevře sekci Type, kde se písmo nainstaluje.
- **Website**: jedna stránka, ze které se načtou barvy a písmo. Tato dlaždice se objeví jen na zařízení, které dokáže stránku načíst, a říká, čím ji načítá: aplikací na tomto zařízení nebo rozšířením prohlížeče v kartě na pozadí, přihlášené pod tvým účtem. Zadání URL jen vyplní pole; souhlas udělíš stisknutím tlačítka pro načtení.

Vyber zdroj s návrhovým souborem a další karta vypíše přijímané formáty jako dlaždice s ikonami. Celá karta je jedním cílem pro přetažení. Soubor můžeš také přetáhnout přímo na studio.

![Karta importu - nejprve přijímané formáty jako dlaždice s ikonami a celá karta jako jeden cíl pro přetažení](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Balíček designového systému Lolly** (`.lolly` nebo starší `.zip`) se nainstaluje v jednom kroku.
- Export **Penpot** (`.penpot`) přinese své designové tokeny.
- Soubor **Design Tokens** (W3C DTCG) nebo **Tokens Studio** (`.json`) přinese své tokeny. Popis, který žádá čtenáře, aby ignoroval instrukce, nárokuje si oprávnění nebo žádá spuštění kódu, se vynechá a import uvede, kde se nacházel.
- **Prosté SVG** se prohledá na barvy, ze kterých si vybereš; první se stane tvou primární barvou.
- **`DESIGN.md`** (`.md`) přejde do **Try these colours** s tokeny tak, jak jsou zapsané. Jeho text lze uchovat jako koncept dovednosti značky a karta označí řádky, které žádají čtenáře, aby ignoroval instrukce, nárokují si oprávnění nebo žádají spuštění kódu. Agenti ani stránky značky koncept neuvidí, dokud v sekci Skills nestiskneš **Keep this skill**, a uchovaná dovednost zůstane interní.
- **Složka stránky značky**, vybraná jako složka, přetažená nebo zabalená do zipu, přejde ke stejné kontrole. Každý soubor se zkontroluje vůči `brand.json` ve složce; jediný neodpovídající soubor způsobí odmítnutí celé složky. Import přidá tokeny. Loga a písma zůstanou ve složce.

::: warning Kontrola instrukcí čte řádek po řádku
Kontrola, která vynechává instrukce v popisech souboru tokenů, čte řádek po řádku a jiné formulace nezachytí. Než tokeny použiješ, přečti si soubor od někoho, koho neznáš.
:::

Lolly čte stránku značky ze souborů, které dodáš. Nenačítá adresu jiného webu.

### Soubor s vlastními názvy barev

Soubor tokenů nebo `DESIGN.md` může používat vlastní slova pro barvy, například hlavní, akcentní, podpůrná a terciární. Když Lolly taková slova najde, kontrola před jakýmkoli použitím vypíše každé z nich: slovo, jeho barvu v každém vzhledu, token, ze kterého pochází, a význam navržený Lolly. Lolly navrhuje významy jen podle slov z krátkého seznamu, bez modelu. Slovo mimo seznam se převezme jako vlastní slovo značky, **By name only**. Kterékoli slovo můžeš přejmenovat, určit jeho účel, přiřadit mu jiný význam nebo zrušit jeho zaškrtnutí a ponechat ho jako pojmenovanou barvu.

**Install with these roles** zapíše role; **Install without roles** nainstaluje soubor tak, jak přišel. Soubor bez takových slov tento krok přeskočí. Soubor, který uvádí vlastní role, například soubor zapsaný Lolly, je ukáže tak, jak jsou zapsané, a nainstaluje je beze změny; později je můžeš upravit v sekci Colours. Terminál kontrolu nenabízí: `lolly system import` zachová uvedený záznam a slova z ostatních souborů ponechá jako pojmenované barvy.

### Zkontroluj předlohu

Logo, snímek obrazovky, web nebo uložená stránka otevře **Try these colours**: příklad v navržených barvách, **Main colour**, kterou můžeš změnit, a název nového systému. Rámeček říká, co použití udělá: **nahradí** aktivní nastavení tokenů vygenerovanou paletou a výchozími styly, **zachová** tvá písma a soubory knihovny a předchozí systém lze **obnovit**. **Apply suggested settings** vytvoří kontrolní bod a pak použije světlou a tmavou paletu. **Restore brand settings** může vrátit staré nastavení. **Change reference** vybere jiný zdroj.

::: details Co se načítá z předlohy a zpráva o kontextu návrhu
**Palette, source details and individual choices** ukazuje, co se načetlo, nalezené názvy písem a kontrast náhledu. Názvy písem jsou jen návrhy; písmo nainstaluješ v Type. Podrobnosti zdroje mohou zahrnovat typografii, mezery, odsazení a hodnoty rohů tam, kde byly zjištěny, jinak mají označení **Not observed**. Uložená stránka nebo nativní načtení webu uvádí deklarované styly, které stránka nemusí používat. Rozšíření prohlížeče může uvést naměřené styly ze vzorku viditelných prvků. Jde o zjištění: nic se neinstaluje a rozestupy ze zdroje nikdy nenahradí tvé vlastní. **Choose individual items in the tray** uchová jednotlivé položky. **Download design context** uloží zprávu JSON se zjištěními, navrženými tokeny a informacemi o zdroji (včetně SHA-256 veškerého dodaného HTML nebo CSS). Zpráva neobsahuje nezpracovaný text stránky a není podepsaným Content Credential.
:::

Importy PDF a návrhových souborů si ponechávají vlastní ovládací prvky kontroly. Položky v **Tray** nic nemění, dokud je nepřidáš v sekci, která spravuje daný druh materiálu. `#/start?source=<kind>` otevře výběr na daném zdroji (`file`, `pdf`, `image`, `font`, `url`, `page`) a `?import` otevře prostý seznam.

### Najdi a porovnej vzhled

Otevři **Find a look** z Board nebo ze seznamu designových systémů v Settings. Procházej systémy uložené na tomto zařízení a několik opakovaně použitelných příkladů Lolly a hledej podle názvu, barevného štítku nebo deklarovaného písma. **Closest to my current palette** řadí podle naměřené podobnosti barev, při shodě rozhodují shodná písma; nejde o skóre kvality.

Kliknutím na vzhled si ho prohlédni v kontextu; náhled nic nemění. **Use this look** na kartě tento vzhled použije. Uložený systém se stane aktivním, čímž se nic neupraví. Barvy příkladu se po obvyklém kontrolním bodu přenesou do otevřeného designového systému. Loga, písma a vše ostatní, co příklad nedefinuje, zůstanou v systému beze změny. **Compare looks** přidá ke každé kartě zaškrtávací políčko: vyber dvě a porovnej je vedle sebe. **Restore brand settings** obnoví předchozí vzhled. Uložené systémy mají upravitelné **Search tags** pod **Details and design context**. Příklady jsou původní barevné recepty Lolly, bez kolekce stažené z cizích webů a bez účtu.

![Lolly: porovnání Sunroom a Orchard vedle sebe před použitím kteréhokoli barevného systému.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Uchovej a přenes svůj designový systém

### Přenes značku mezi zařízeními

**Export** zapíše jeden soubor **`LollyBrand-….lolly`**: tvé tokeny, písma, loga a volbu motivu s manifestem integrity, který se kontroluje při importu. Webové verze před 1.0.7 používaly příponu `.zip` a Lolly ji stále přijímá. **Tokens (.json)** zapíše prostý dokument designových tokenů bez písem a log pro repozitář, krok sestavení nebo jiný nástroj pro tokeny.

Pro opětovný import použij **Add from… → Design tokens or a design file**, nebo soubor přetáhni na studio. Takto ti kolega předá značku nebo ji přeneseš do druhé instalace, bez účtu a bez cloudu. [Spolupráce s partnery](/info/partners.html) popisuje, co dalšího poslat, když příjemce tvé značky pracuje pro jinou organizaci. Import značky z příkazového řádku popisuje [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** zabalí přidaná písma do instalovatelného RPM. Pokud jsi některá nahrál sám, Lolly tě nejprve požádá o potvrzení, že je smíš dále šířit.

### Obnov dřívější nastavení

Otevři **More** na liště, zvol **Restore brand settings**, vyber kontrolní bod s datem a stiskni **Restore**. Tím obnovíš barvy, nastavení písma a další tokeny aktivní značky; soubory písem a obrázků zůstanou beze změny. Lolly nejprve uloží současné nastavení jako **Before restore**, takže obnovu můžeš vrátit i po zavření prohlížeče. Na tomto zařízení se uchovává posledních 20 kontrolních bodů. Úprava provedená ve chvíli, kdy studio ukazuje **Saving…**, přežije opětovné načtení a karta nabídne obnovení změn, které se nestihly uložit.

### Verze

Publikovaná verze je **trvalá pojmenovaná kopie** uložená na tomto zařízení. Nikdy se nemění, takže nástroj nebo odkaz, který ji pevně nastaví (pomocí `designv`), dál kreslí totéž. Systém s něčím vlastním uvádí **Versions & publishing** v nabídce **More** na liště; po prvním publikování se k sekcím přidá **Versions**. `#/start?area=versions` otevře Versions.

::: warning Publikovaná verze je trvalá
Mazání zatím není k dispozici a panel to uvádí. Publikování nelze vrátit zpět; obnovení ano. *Restore latest from this version* je běžná úprava a ihned se nabídne **Undo**.
:::

**Odebrání jsou na kartě kompatibility první**, protože odebraný token naruší fungování nástroje.

**Publish only** uchová verzi, aniž by změnilo, čím se nástroje řídí; **Publish and make active** nastaví nástroje a aplikaci tak, aby se řídily touto verzí. **Follow the latest again** uvede každou úpravu ihned do provozu.

### Zveřejni stránku značky

[Stránka značky](/info/brand-page.html) je jedna adresa pro lidi i agenty: stránka s logy, barvami, písmem a příklady, se stejnými údaji v přiložených souborech. **Publish a brand page** pod Versions & publishing ukazuje živou stránku a vedle ní:

- **Goes public**: každý soubor ve skupinách s jeho velikostí.
- **Held back**: co se vynechalo a proč. Logo bez zaznamenané licence zůstane vynechané, dokud nezaškrtneš jeho název. Soubor písma potřebuje zaznamenanou licenci, která dovoluje jeho předání, a když se soubor vynechá, stránka ukazuje ukázku převedenou na obrysy. Interní dovednosti značky se nikdy nezobrazí.
- **What was checked**: dvojice barev pro každý colourway a režim a pravidla značky. Jde o měření, ne o verdikt.
- **In your words**: prohlášení o použití a kontakt. Stránka zobrazí, co napíšeš, a Lolly nepřidává žádnou licenci ani právní tvrzení. Přepínač vypne řádek „Made with Lolly“ v zápatí.
- **On exports**: přepínač, který [zaznamenává adresu stránky do exportů tohoto designového systému](/info/brand-page.html#lead-back-from-your-files). Přepínač je vypnutý, dokud ho nezapneš, vyžaduje adresu `https` a nepřenáší se s balíčkem ani kopií. Zamčený designový systém přepínač neukazuje, protože rozhoduje jeho správce.

**Download folder** uloží složku jako ZIP, který můžeš hostovat, kde si vybereš. Dokud složku nezačneš hostovat, nic se nezveřejní. V terminálu zapíše stejnou složku `lolly system publish --out=<dir>`. Instance, která poskytuje stránky značek, nabízí také **Publish to** na svou adresu: jedno výslovné stisknutí, přes schvalovací řetězec instance, pokud ho má. Spravovaný designový systém publikuje jen tehdy, když to jeho správce povolí.

### Připoj agenta

**Connect an agent** na stejném místě poskytne text k vložení a řekne, co jednotlivé možnosti umějí:

- **`AGENTS.md`** v projektu: agenti čtou názvy a pravidla systému. Nic nevykresluje a nepotřebuje server.
- **Veřejný server Lolly**: kreslí s Lolly Demo bez ohledu na to, který systém tu máš otevřený. Nepotřebuje klíč.
- **Tvá instance**: kreslí se systémy, které instance obsahuje, a čte servisní token z proměnné prostředí. Panel uvádí název proměnné a nikdy neukazuje token.

Když žádný hostovaný server nekreslí s tvým systémem, panel to uvede.

<!--i:eti-layers-->
## Spravuj své designové systémy

Otevři **Settings → Preferences → Design systems** a přepínej, přidávej nebo odebírej systémy. **Open** vybere systém a otevře ho zde; **Make a new one** vytvoří místní systém a otevře ho s připraveným polem názvu. V jednu chvíli je aktivní jeden systém pro celé zařízení. [Architektury značek](/info/brand-architectures.html) pomáhají rozhodnout, kdy značka potřebuje vlastní designový systém.

**Odkud systém pochází.** Systém dodaný katalogem nasazení má označení **Came with this app**, nebo **From this instance** v aplikaci připojené k instanci. Rozbal **Catalogue source** a uvidíš, kdo ho dodává, jeho asset s tokeny a jmenný prostor i známou verzi nebo kontrolní součet; pokud obnovení selže, materiál z mezipaměti je označený.

**Spravované systémy jsou jen pro čtení.** Systém má označení **Managed by this instance** (nebo **Managed by this app** v desktopové aplikaci bez instance), když ho katalog zamyká. Spravovaný systém můžeš používat a stáhnout. Po otevření zde se zobrazí poznámka o režimu jen pro čtení s **Make an editable copy** a **Switch**, pak jeho barevné role a tokeny bez ovládacích prvků pro úpravy. Tvé vlastní místní systémy zůstávají upravitelné, i když spravovaný systém přišel první. Sestavení s jednou pevnou značkou otevře Lolly Design System Setup na *This brand is set*, s tokeny značky a pravidly použití ke čtení.

**Každý další dodaný systém je tvůj** a můžeš ho skrýt, upravit a obnovit, včetně Lolly Demo a Lolly Starter na lolly.tools. Při úpravě si ponechá název a řádek se označí **Edited here**. **Reset to original** v jeho nabídce zahodí změny provedené na tomto zařízení. Výjimkou je prázdný výchozí systém: první změna v něm založí tvůj vlastní designový systém a Lolly se jednou zeptá na jeho název. [Lolly Demo v praxi](/info/lolly-demo-in-use.html#switch-to-your-own) ukazuje, co tvůj vlastní systém nahrazuje.

### Odebrání designového systému

V nabídce systému zvol **Remove**; potvrzení říká, který systém bude potom aktivní. Uložené relace, nahrané soubory a materiál sdílený s jiným systémem zůstanou.

Odebrání dodaného systému ho jen skryje: jeho assety v katalogu zůstanou, **Bring back** ho znovu zobrazí a pokud odebereš vše ostatní, vrátí se sám. Odebrání importované nebo upravené kopie neodebere dodaný systém, jeho loga ani písma. Pokud byla kopie aktivní, znovu se aktivuje dodaný systém. Odebrání aktivní hostované kopie zruší jen připojení této kopie; samostatně vybraná instance zůstane vybraná.

::: details Změna designového systému dodávaného serverem
Změna toho, co server dodává, je úkolem správce: provozovatel změní zdrojový katalog a znovu ho nasadí, nebo správce Lolly Work zkontroluje a použije změnu serveru. Zdejší úpravy zůstávají místní, s jednou výjimkou. Na instanci Lolly Work, která ti uděluje `brand.edit`, nabízí spravovaný systém také **Edit for** pro tuto instanci, které otevře kopii pro úpravy. **Send to** pro tuto instanci ve **Versions** odešle zpět její barvy, colourways, barevné role a adresu stránky značky. [Uprav tuto instanci ze studia](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) popisuje, co lze úpravou změnit a jak instance změnu poskytuje. Viz [Odebrání designového systému z katalogu](/info/configuration.html#removing-a-catalogue-design-system) a [Konfigurace](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Použij kontext návrhu mimo aplikaci

**Download design context** uloží dokument tokenů, vyhodnocené barvy, deklarované rodiny písem, id assetů, podklady ze zdrojů tam, kde jsou zaznamenané, pokrytí a výslovná pravidla, bez souborů písem a bez důkazu vlastnictví. Příkazový řádek čte soubor bez serveru: `lolly system import` z něj udělá designový systém terminálu a `lolly system check` zkontroluje vstupy Lolly Design vůči uloženému kontextu. [Importuj svůj designový systém](/info/cli.html#bring-your-design-system) popisuje import a [Který designový systém příkaz používá](/info/cli-decks.html#which-design-system-a-command-uses) popisuje kontrolu. Klient MCP čte stejné zadání z `lolly://design-context` ([MCP Server](/info/mcp.html)).

<!--i:eti-map-pin-->
## Kam dál

- **[Používání Lolly](/info/using.html)**: nástroje, ukládání, sdílení a Assets.
- **[Architektury značek](/info/brand-architectures.html)**: jak se divize, produkty, zastřešené značky, klienti a sezóny promítají do designových systémů, colourways a identit log.
- **[Spolupráce s partnery](/info/partners.html)**: sdílení tvé značky s partnerem a práce se značkou, kterou jsi dostal.
- **[Stránky značek](/info/brand-page.html)**: zveřejni svůj designový systém na jedné adrese jako sadu pro média a sadu pro agenty.
- **[Designové tokeny](/info/design-tokens.html)**: model tokenů, ve kterém je tvá značka zapsaná.
- **[Export souboru](/info/exporting.html)**: tiskové jednotky, CMYK a formáty, do kterých se tvá značka vykresluje.
