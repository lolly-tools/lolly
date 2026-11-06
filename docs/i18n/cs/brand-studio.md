# Lolly Design System Setup

<a id="design-system-setup"></a>

Tvé logo, barvy a písma patří na jedno místo, aby je každý nástroj, stránka a export používaly. Tím místem je **Lolly Design System Setup** na `#/start`.

Začni s tím, co máš. Vlož logo a Lolly přečte jeho barvy. Vyber písmo nebo přetáhni soubor písma, který tvá firma licencuje. Každá změna se hned projeví v celé aplikaci. Tvé logo, písma a tokeny zůstávají na tomto zařízení. Výběr Google Font je jediný krok, který sahá ven: Lolly se nejprve zeptá a pak rodinu jednou stáhne.

Když to vypadá správně, dej designovému systému jméno a stiskni **Export**. Dostaneš jeden soubor `.lolly` k uchování, otevření na jiném zařízení nebo předání kolegovi. [Lolly Settings](/info/dashboard.html#design-system) ukazuje aktivní systém jen pro čtení a jeho obálka odkazuje zpět sem pro úpravy.

## Udělej to po svém za pět minut

::: timeline
- <!--i:upload--> **Vlož své logo** na oblast pro přetažení v **Logos**. Lolly přečte jeho tvar a barvy.
- <!--i:palette--> **Použij tyto barvy.** Hlavní barva loga se stane tvou primární a tmavá neutrální barva z loga se stane barvou textu.
- <!--i:font--> **Vyber písmo** v **Type**: Google Font nebo soubor písma, který vlastníš.
- <!--i:pentool--> **Pojmenuj systém.** Tvá první úprava vytvoří tvůj vlastní designový systém a Lolly se jednou zeptá na jeho jméno.
- <!--i:download--> **Export** zapíše celý systém jako jeden soubor `LollyBrand-….lolly`.
:::

Lišta v horní části studia nese jméno designového systému a jméno je pole, které můžeš kdykoli změnit: **Enter** nové jméno ponechá a **Escape** vrátí staré. Když tvá první úprava položí otázku **What is this design system called?**, slova z tvého loga se předvyplní, pokud je logo vypisuje. **Save name** jméno ponechá; **Not now** ponechá zástupné jméno, dokud jej nenapíšeš do lišty. Jméno označuje systém v Settings a při přepínání a stává se názvem souboru, který **Export** zapíše.

## Místnosti

Studio je sada místností bez pevného pořadí: nic není číslované a nic na ničem nezávisí. U stolu leží místnosti v jednom pásu pod lištou. Na telefonu se přesunou do lišty u spodního okraje, kam dosáhne palec, s otevřenou místností posunutou do zorného pole; list s paletou a zásobník vyjíždějí nad tuto lištu a lišta při psaní ustoupí. S klávesnicí se Tab dostane na pás jednou a šipky, Home a End se pohybují mezi místnostmi.

![Lišta studia a její místnosti: Board, Colours, Type, Logos, Tokens, Files, Rules a Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Místnost | Co tam děláš | Klíč odkazu |
|---|---|---|
| **Board** | Podívej se, co systém obsahuje, s dveřmi do každé místnosti | `overview` |
| **Colours** | Přidej barvy, dej jim role, vytvoř odstíny a paletu | `color` |
| **Type** | Vyber čtyři řezy, které čtou aplikace, nástroje a každý export | `type` |
| **Logos** | Umísti své značky v každé orientaci a úpravě | `logos` |
| **Tokens** | Rohy, mezery, stíny a každá další pojmenovaná hodnota | `tokens` |
| **Files** | Obrázky, zvuk a pohybové soubory, které tvá značka uchovává | `catalogue` |
| **Rules** | Pravidla, která tvá značka uplatňuje, ověřená na skutečných příkladech | `usage` |
| **Skills** | Psané standardy značky pro lidi a agenty, ke čtení a stažení | `skills` |

Na místnost odkazuj pomocí `#/start?area=<key>`. Místnost Files si ponechává klíč `catalogue`, Board si ponechává `overview` a Rules si ponechává `usage`, protože klíč místnosti je trvalý závazek, a `?tab=` stále funguje jako starší alias. Neznámý klíč otevře Board.

**Lišta** drží akce pro celý systém, ne pro jednu místnost. **Add from…** přináší značku ([Přines značku](#bring-a-brand-in)) a **Tray** drží, co sken našel a ty jsi to ještě nepřidal. **Export** zapíše systém jako jeden soubor a **More** drží **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** a **Design systems**, které otevře seznam v Settings, kde přepínáš ([Uchovej a přesuň designový systém](#keep-and-move-your-design-system)). Každá se objeví, až je na čem působit. Na telefonu se **Add from…** přesune do **More** a **Export** se ukáže jako ikona.

## Board

Dokud nic není zvoleno, Board nabízí čtyři způsoby, jak začít. **Start from a reference** otevře výběr zdroje pro logo, snímek obrazovky, webovou stránku nebo návrhový soubor a **Pick a colour**, **Choose a face** a **Add a logo** otevřou přímo tyto ovládací prvky. Jejich otevření nic nezapisuje a **Explore the tools** je tu od začátku.

Jakmile je cokoli tvé vlastní, Board ukazuje, co máš, s tvými vlastními počty napřed. Colours uvádí počet barev, s tlumeným `· N starter` tam, kde se ukazují zděděné barvy; jeho pás staví tvé barvy první, pak tenkou čáru, pak vybledlé startovní. Colourways ukazuje každý colourway jako malou dlaždici v jeho hlavní barvě. Type se čte po rolích a každou rodinu sází jejím vlastním řezem (*Inter for headings*, s *Starter for the rest* na řádku pod tím). Logos říká, kolik slotů je vyplněno (nebo **Not set**), Tokens ukazuje poloměr rohů a Files říká **Nothing yet**, dokud je knihovna prázdná. Každý blok otevře svou místnost.

Designový systém, který přišel s aplikací a lze ho upravovat, například Lolly Demo, to všechno má od začátku: Board ukazuje jeho barvy, colourways, řezy a značky, se štítkem **Came with this app** vedle nadpisu.

### Starter a tvoje

**Starter** je slovo pro cokoli, co přišlo s aplikací, ne co sis zvolil. Čerstvá instalace nenese vůbec žádnou barvu, jen jednu neutrální rampu od inkoustu k papíru, aby se povrchy, text a tenké čáry mohly vykreslit, než kdokoli něco rozhodne. Stejné slovo označuje zděděný materiál v každé místnosti.

::: cols
## Starter

- Přišlo s aplikací: neutrály od inkoustu k papíru, startovní řezy, výchozí poloměr rohů.
- Tlumené, se štítkem **Starter** a bez odstínu.
- Nepočítá se mezi tvé barvy. Neutrály žijí v **Tokens** jako **Neutrals · starter · 9** a **Open** je ukáže v Colours jako jednu sbalenou skupinu (`#/start?area=color&group=neutral`).
- Role stojící na startovní barvě se čte *"Starter Paper stands in"*, s **Choose…** na jejím výběru.

## Tvoje

- Zvolené nebo nainstalované tebou.
- Plná síla a odstíněná karta tam, kde jsi nainstaloval řez.
- Počítá se na Boardu a v Tokens.
- Role, která následuje jinou, se čte **↳ follows Primary**, místo aby opakovala název primární.
:::

Zděděný materiál se nikdy nekreslí s přerušovaným okrajem, protože přerušovaný okraj zde znamená cíl pro upuštění.

## Logos

Vyprázdni složku se značkami do oblasti pro přetažení nahoře: **"Drop marks here, or choose several at once"** vezme tolik souborů, kolik máš. Každý soubor se přečte pro svůj tvar a inkoust, pak čeká pod **Waiting for a slot** jako čip, který říká, jak vypadá, například *"Looks like the Horizontal primary"*, s měřením, které použil, a tlačítkem **Place** (**Replace**, kde je slot vyplněn). Kde si není jistý, čip to řekne a nabídne **Change slot**, který vypíše všech osm. Nic se neumístí, dokud něco nestiskneš.

Značka s přebytečným prázdným okrajem nejprve dostane nabídku oříznutí; odpověz na ni nebo stiskni Escape a originál se vloží beze změny. Kde značka může vyplnit prázdný sourozenecký slot, místnost nabídne odvozenou verzi **mono** nebo **reverse** jako čip označený *Generated*.

Každá značka skončí v mřížce osmi volitelných slotů, po jednom na **orientaci** a **úpravu**:

- **Orientace:** Horizontal (wordmark a symbol v řadě) a Vertical (nad sebou, pro čtvercové a vysoké prostory).
- **Úpravy:** Primary, Primary reverse (pro tmavá pozadí), Mono (jedna barva) a Mono reverse.

Skupina bez značek se sbalí na jeden řádek; otevři ji, abys viděl její sloty. Klikni na slot pro přidání PNG, SVG, JPEG nebo WebP, nebo klikni na vyplněný slot pro nahrazení značky. Vše zůstává na tomto zařízení.

![Sloty loga s otevřenými Horizontal a Vertical: každá úprava je vlastní slot a každý slot je volitelný](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails%3Anth-of-type%281%29%3Esummary%3Bclick%3A.be-logo-identity%3Edetails%3Anth-of-type%282%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** jsou značky, které tvá značka nazývá vlastním jménem, například ikona, erb nebo favicon.
- **Více identit.** Podznačka, produkt nebo akce může mít vlastní úplnou sadu: **+ Add another logo** a pojmenuj sadu. Tvá hlavní sada je "Your logo". [Architektury značek](/info/brand-architectures.html) ukazují, kdy je identita loga správný blok.
- **Lolly čte barvy loga.** Karta pod oblastí pro přetažení a znovu nahoře v Colours vypisuje barvy loga a ptá se **Which is the main colour?**, s nejsilnější barvou už vybranou (nikdy bílou, na které byl export). **Use these colours** je přidá do tvé palety, učiní hlavní barvu primární a, když má logo tmavý neutrál čitelný na papíře, učiní jej barvou textu. **Not now** je ponechá v Tray. Na zcela nové instalaci se nejpravděpodobnější odpověď uplatní hned a karta nabídne **Undo** nebo jinou hlavní barvu. SVG dává přesné barvy; PNG, JPEG nebo WebP dává barvy, které pokrývají skutečný podíl značky.

## Colours

Místnost roste s designovým systémem: první návštěva je jedno rozhodnutí a zbytek přichází, jak roste paleta.

### První barva

Systém bez vlastních barev ukazuje neutrály startéru, otevřené ve vlastní skupině, a nahoře v místnosti přerušovanou oblast pro vložení a přetažení: jeden velký čip a jedno pole. Přetáhni obrázek nebo seznam barev kamkoli na pole a Lolly přečte barvy z toho, co jsi upustil/a.

- **Čip je výběr.** Stiskni **Pick a colour** a otevře se karta OKLCH studia, předvyplněná tím, co pole drží: nejprve jméno a hex barvy, pak barevné prostory, kolo, čtyři ovladače a alfa pod **Fine-tune**, a dole **Cancel** a **Add colour**. Do systému se nic nedostane, dokud nestiskneš **Add colour**.
- **Pole přijme jakýkoli zápis**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` nebo jméno barvy. Vlož seznam a stane se řadou čipů, které přidáš po jednom nebo pomocí **Add all**.
- **Dva další způsoby.** **Pick a colour from the screen** použije kapátko, pokud ho prohlížeč má, a **Take colours from an image** přečte snímek obrazovky nebo fotku na tomto zařízení.
- **Přidání není nikdy vypnuté.** S prázdným polem otevře výběr; text, který nepřečte, dostane pod polem řádek, který to říká.

Tvá první barva se stane **primární** a čip to potvrdí, například *"Primary is now Vivid Violet"*, s **Fine-tune** k úpravě barvy.


### Jak paleta roste

Tvé barvy leží vedle náhledu **In context** na široké obrazovce a nad ním na menší. Náhled ukazuje plakát, graf nebo kartu rozhraní v tvé paletě. Startovní barvy zůstávají ve vlastní sbalitelné skupině, která se sbalí, jakmile systém má vlastní barvy, a pole pro vložení a přetažení se změní na jeden kompaktní řádek. Export je v **Export** v liště a v místnosti Tokens, takže hlavička místnosti žádný nenese.

![Místnost Colours v Lolly Demo: paleta ve sbalitelných skupinách, každá barva se jménem a hexem, a stažení palety v hlavičce](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![Místnost Colours v Lolly Demo po přidání jedné barvy: tabulka Colour roles, pak čip nové barvy nabízející Use as Lead? a Fine-tune, vedle živého náhledu kompozice](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Role barev: jak se barvy jmenují

Designový systém říká, jak se jeho barvy jmenují a k čemu každá slouží, a Lolly to čte. **Colour roles** jsou na začátku místnosti Colours. Na široké obrazovce sdílí zobrazení **In context**, takže změna se ukáže na plakátu, grafu i kartě rozhraní, jakmile ji uděláš.

![Tabulka Colour roles v Lolly Demo vlastními slovy: čipy colourway, pak Lead, Partner, Paper a Ink, každá se světlou a tmavou barvou, čtená jako hlavní barva, partnerská barva, pozadí a text, a Quiet text a Hairlines uvedené pod tabulkou jako čtení, které žádná role nenaplňuje](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

Tabulka má čtyři sloupce a na telefonu se každý řádek změní na kartu, která drží světlou a tmavou hodnotu vedle sebe:

| Sloupec | Co drží |
|---|---|
| **Role** | Vlastní slovo designového systému, které můžeš upravit přímo na místě, a řádek, který říká, k čemu barva slouží |
| **Light** a **Dark** | Barva v daném vzhledu pro zvolený colourway, s jejím jménem nebo hodnotou a kontrastem |
| **Lolly reads this as** | Co nástroj s rolí dělá, vlastními slovy Lolly |

**Jak Lolly čte roli.** Každé čtení bere jednu roli, takže když zvolíš čtení, které drží jiná role, přesune se čtení sem. Lolly nikdy nevyčte význam ze slova.

| Čtení | Co z něj plyne |
|---|---|
| **Lead colour** | Velké tvary, tlačítka, barva, kterou nástroj začíná |
| **Partner colour** | Druhá barva, po které nástroj sáhne |
| **Background** | Leží za vším ostatním |
| **Text** | Nadpisy a běžný text |
| **Quiet text** | Popisky a drobné písmo |
| **Hairlines** | Linky, ohraničení a oddělovače |
| **By name only** | Žádný nástroj roli nevybere sám. Nabízí se v každém poli barvy a v Design, kde výběr zůstává propojený, takže sleduje colourway |

Čtení, které žádná role nenaplňuje, zůstává tak, jak ho definuje designový systém, a místnost je uvádí pod tabulkou. Role, která sdílí id s některým čtením, například role jménem Primary, je to čtení a nedá se přesunout.

**Hodnoty.** Stiskni hodnotu, abys vybral/a barvu pro danou roli, v daném vzhledu, ve zvoleném colourway. **Same as light** nechá tmavou hodnotu sledovat světlou, dokud nevybereš vlastní barvu. Čip **Aa** ukazuje text, který Lolly vybere pro barvu, a řádek pod hodnotou říká, jak se ten text čte, pro každý vzhled: **Text reads well**, **Large text only** nebo **Hard to read as text**. To se týká textu na barvě a nic neříká proti barvě samotné, která může dál fungovat pro tvary a velké plochy. Role čtená jen podle jména ukazuje stejná slova bez varovné barvy, protože na ni žádný nástroj sám text nedává. Čísla za slovy, nejprve APCA a pak WCAG, jsou v nápovědě a ve výběru. **Own text colour** označuje hodnotu, jejíž soubor uvádí barvu textu, která zůstává. **Copied** označuje hodnotu, která pochází z jiného colourway nebo z partnerské barvy a kterou ještě nikdo nevybral; **Keep this colour** ve výběru hodnotu potvrdí.

**Výchozí body.** Designový systém bez vlastních rolí ukazuje dnešní slova: Primary, Secondary, Surface a Text. Nic se nezapíše, dokud jedno nezměníš. **+ Add a role** nabízí jako návrhy **Primary, Secondary** nebo **Main, Accent, Supporting, Tertiary**, případně jakákoli slova, která napíšeš, s čtením, které by každé dostalo. První dvě slova se stanou hlavní barvou a partnerskou barvou. Nástroje kreslí dál stejné barvy a v systému s jednou hlavní barvou se první colourway jmenuje po této barvě.

**Přejmenování, řazení, odebrání.** Přejmenování mění jen slovo, takže vše, co roli používá, dál funguje. Roli přetáhni za úchyt, nebo na úchytu stiskni mezerník, šipkami se přesuň a mezerníkem pusť. **Remove** říká, co roli ještě používá. Když role čtou nástroje, **Remove and keep those colours** nechá každé čtení s barvou, kterou kreslí teď. Interní pravidlo, skupina vodítek, pole nástroje nebo jiný token, který roli používá, ji drží, dokud se toto použití nezmění. Uložený dokument Design může roli také použít podle jména a Lolly to ze souboru tokenů nevidí: dokument, který to dělá, ohlásí barvu jako nevyřešenou.

**Ručně psaný soubor.** Barvy, které soubor tokenů drží a žádná role je nedeklaruje, jsou uvedeny pod **In this file, with no role yet**, každá s polem pro slovo a **Make a role**. Fungují podle jména tak i tak. Token s číslicemi v názvu nemůže být rolí, takže zůstává v souboru a dál funguje podle své cesty. Záznam v souboru, který neprojde ověřením, ukáže tabulku bez ovládacích prvků a řekne proč.

**Zbytek místnosti mluví stejnými slovy.** Čipy, řádek **Use as** u vzorku a skupina **Colour roles** v paletě používají slova designového systému a dlaždice role barvy otevře její hodnotu. Exportované soubory o rolích nezaznamenávají nic nového: barvy ve vykreslení se mění, protože se změnily tokeny.

**Kam slova putují.** Slova a popisy putují s designovým systémem. Agenti je čtou v designovém zadání, `lolly://tokens` a v `AGENTS.md` stránky značky, terminál je ukazuje v `lolly system status` a stránka značky je uvádí v `brand.json` a měří dvojici kontrastu pro každou roli. Každý formát exportu zachová, na co má místo: soubory DTCG a Tokens Studio zachovají všechno, `DESIGN.md` zachová slova a čtení a motiv PowerPoint zachová jen pořadí značky. [Role barev v jiných formátech](/info/design-tokens.html#colour-roles-in-other-formats) má úplný seznam. Slova se vždy citují jako data designového systému, nikdy se nečtou jako pokyny.

**Kde se barva vybírá.** Každé pole barvy v nástroji a v Lolly Design začíná rolemi designového systému, v jeho vlastním pořadí, s viditelným slovem a tím, k čemu barva slouží. **Aa** vedle role vybírá barvu, která na té roli leží. Ostatní následují pod **Other colours**, bez vlastních kopií colourway, bez on-barev a bez čtení, které už role naplňuje. Výběr zůstává propojený s rolí a sleduje colourway, pole ukazuje slovo ať je zvolen kterýkoli colourway a Settings a Tokens slovo používají také. Designový systém bez rolí si ponechává mřížku vzorků, jakou měl vždy.

### Role: co čtou nástroje

Když jsou **Colour roles** zavřené, první rozhodnutí vedou místnost jako čipy, z nichž každý ukazuje barvu, která roli hraje, a její jméno. V systému bez vlastních slov to jsou **Primary**, **Secondary**, **Surface** a **Text**. Stiskni čip a vyber jeho barvu z vlastních vzorků palety. **Every colour a tool reads** dole v **Colour roles** má celý pás.

**Role** říkají, která barva hraje jakou část v každém nástroji a exportu. Jsou volitelné (tři volné barvy bez rolí jsou naprosto dobrý systém), roli může dostat jakákoli barva a údaj říká, jak se text čte, měřeno proti povrchu, nejprve APCA. Každý řádek role ukazuje vlastní barvu v plné síle, startovní barvu, která zastupuje, nebo **↳ follows Primary**.

Pás ukazuje všech sedm rolí, které nástroj může číst: Primary, Secondary, Surface, Text, Muted, Edge a On primary, vlastními slovy designového systému, kde je má. On primary se odvozuje z primární, čte se **Derived** a nemá výběr. Přepínač **Light** a **Dark** vedle něj a ten vedle **In context** volí, který vzhled pás, paleta a náhled ukazují.

Vlastní akcent aplikace ve výchozím stavu následuje designový systém. To je nastavení **Interface follows the design system** v **Settings → Appearance**; vypnutí nastavení nechá chrome aplikace neutrální, zatímco nástroje, plátna a exporty následují designový systém v obou případech.

**Colourways.** Designový systém může držet několik hlavních barev, každou volenou pro konkrétní kousek. Řádek **Colourways** na začátku **Colour roles** ukazuje jeden čip na colourway, s **Default** na kanonickém. **+ Add** založí nový colourway z jedné z barev palety. Vyber čip a tabulka, pás, paleta i náhledy ukážou tento colourway; zvolený colourway lze přejmenovat, duplikovat, udělat výchozím nebo odebrat. V systému s colourways potřebuje každý colourway vlastní primární a sekundární barvu a vlastní povrch, když colourways odstíní pozadí, takže tyto role zůstávají nastavené v editoru vzorků. [Přidej colourways do designového systému](/info/colourways.html#add-colourways-to-a-design-system) má postup a formát tokenů a [Lolly Demo v praxi](/info/lolly-demo-in-use.html#colourways-on-real-work) ukazuje colourways na skutečné práci.

### Najdi další barvy

Tři nástroje staví na tvé primární. První dva jen navrhují a třetí nahradí paletu po prohlédnutí změny.

::: cols
## Explore shades & harmonies

Vyber **Starting colour**, **Scheme** (Mono, Complement, Analogous nebo Triad) a kolik **Shades** (3 až 20, výchozí 5). **Fine-tune** nastavuje intenzitu UI, kontrast a text na značce. Klikni na odstín pro přidání, nebo **Add 5 shades** pro skupinu. Tvé barvy a role zůstávají.

## Find matching colours

Vyber **Harmony**: Complementary, Adjacent, Triad, Tetrad nebo Analogous (s **Accents** od 2 do 5 a **Angle** od 10° do 45°). Každý kandidát má vygenerované jméno a **+ Add**, jedno stisknutí na barvu.

## Rebuild the whole palette

Nahradí paletu z jedné výchozí barvy, po přehledu toho, co se změní a co zůstane. Nejprve se vytvoří kontrolní bod a poté se nabídne **Undo**.
:::

Všechny tři používají stejnou percepční barevnou matematiku (OKLCH) jako engine. V **Explore shades & harmonies** řádky **Primary**, **Neutral** a **Secondary** ukazují navrhované odstíny a **Theme preview** ukazuje světlé a tmavé příklady s jejich hodnotami kontrastu.

![Tři navržené skupiny odstínů, s jednotlivými ovládacími prvky pro přidání a samostatným Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Vygenerované akcenty, každý se vzorkem, automaticky vygenerovaným názvem, svým hex kódem a tlačítkem Add](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Potvrzení vygenerované palety

Otevři **Rebuild the whole palette…** a stiskni **Preview full rebuild**. Přehled počítá, kolik rolí zůstane, jak jsi je přiřadil, kolik tvých vlastních barev se zachová a kolik křivek odstínů, tiskových zámků, skrytých odstínů a zarážek přechodů se znovu ukotví nebo zachová. **Apply rebuilt palette** potvrdí; **Cancel** nic nezmění. Poté karta nabídne **Undo** s fokusem na něm a kontrolní bod vytvořený před výměnou obnoví celý systém.

Systém s colourways si při přestavbě zachová každý colourway. Kanonický colourway následuje novou výchozí barvu a každý další colourway si ponechá vlastní barvy, jméno, pořadí a nastavení. Přehled uvádí, který colourway následuje a které si ponechají své barvy. Lolly nepřestavuje systém, který kóduje své colourways způsobem, který neumí upravit; karta řekne proč a nic se nezmění.

### Expertní sekce

Čtyři sbalené sekce leží pod náhledem a rolemi. Každá se otevře přímo pomocí `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`), popsáno výše.
- **Shade curves** (`focus=curves`) tvarují rampu bod po bodu, s oddělenými křivkami světlosti, sytosti a odstínu (L / C / H), a odstíny se překreslují při tažení.
- **Contrast** (`focus=contrast`): **Contrast-lock** přetónuje rampu tak, aby splnila cíle APCA proti pozadí, které vybereš, a **Rotate hue** otočí celou rampu kolem kola.
- **Print** (`focus=print`) nastavuje, čím se primární stane v tisku: její automatická hodnota, připnuté sestavení CMYK nebo pojmenovaná přímá barva.

### Paleta a každý vzorek

Paleta uvádí tvé barvy ve sbalitelných skupinách, každá s vlastním **+ Add**. Skupiny vytvářej a přejmenovávej, jak chceš. Role nikdy nevytvoří druhou dlaždici: dlaždice, na kterou role ukazuje, nese místo toho jméno role, například **Primary**. **Colour chart** pod dlaždicemi ukazuje tytéž barvy na kole OKLCH **Wheel** (přetažením bodu barvu změníš, kliknutím do prázdného místa přidáš vzorek) a v grafu **Gamut**, který ukazuje, kde končí zobrazitelný rozsah. `#/start?area=color&focus=chart` otevře graf přímo.

![Panel palety, každá skupina sbalitelná, se stažením palety v její hlavičce](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![Kolo OKLCH - úhel je odstín, vzdálenost od středu je sytost a šedé odstíny jedou po dráze jasu na okraji](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Klikni na vzorek pro otevření jeho editoru:

- **Rename** přejmenuje vzorek.
- **Set the colour** na posuvnících OKLCH, nebo v **Hex**, **HSL**, **RGB** či **CMYK**. Pole hodnoty čte a zapisuje v aktivním prostoru. CMYK zde nastavuje barvu obrazovky převodem; pro přesné inkousty použij **Print substitutes**.
- **Stored as** volí, jak se vzorek uloží: **LCH** (výchozí, percepční a se širokou gamutou), Hex, RGB nebo HSL.
- **Use as** dá vzorku přímo roli, vlastními slovy designového systému, kde je má. Stisknutím zvýrazněné role znovu roli zrušíš.
- **Print substitutes** (sbalené): zamkni **CMYK** z **Auto** na přesné hodnoty inkoustů, nebo nastav **Spot colour** se **Name** (například `PANTONE 186 C`), volitelným **Book** a **Finish** pro fólii, ražbu, slepotisk, bodový lak, soft touch nebo výsek, rylování či perforaci. Tisk tyto zámky použije, když exportuješ PDF nebo TIFF v CMYK; viz [Barevné profily](/info/exporting.html#colour-profiles).
- **In other spaces** (sbalené): hodnota pro každý barevný prostor, odvozená nebo zadaná tebou, a zadaná má při exportu přednost.

**Smazání vzorku** je bezpečné. Odvozené odstíny a role motivu se skryjí, takže nic, co je čte, nepřestane fungovat, zatímco barvy, které jsi přidal, se odstraní.

::: details Práce s mnoha vzorky
Každý vzorek má úchyt pro přetažení. Přetažením změníš pořadí v rámci skupiny, nebo zaměř úchyt, stiskni Space, použij šipky a znovu stiskni Space pro upuštění; Escape ruší. Na telefonu paleta ukazuje čtyři barvy v řadě a úchyty se objeví v režimu Select, místo řádku pod každou barvou. Pro přesun barev mezi skupinami použij ovládací prvek **Group** editoru nebo vyber několik a použij **Move to**.

Výběr nepotřebuje zvláštní přepínač. Lišta a zaškrtávací políčka se objeví s první vybranou dlaždicí a zmizí s poslední.

- **Tažením po prázdném místě** nakreslíš obdélník; každá dlaždice, které se dotkne, se připojí k výběru, napříč skupinami. Sbalená sekce nepřidá nic.
- **Shift-klik** vezme rozsah v pořadí čtení, **Cmd/Ctrl-klik** přepne jednu dlaždici a obyčejné kliknutí otevře editor.
- Každé záhlaví skupiny má **Select all** a **Cmd-A** s dlaždicí v fokusu vezme každou barvu, kterou vlastníš, nikdy startovní.
- Mřížka má jedinou zastávku tabulátoru: šipky pohybují, Shift-šipky rozšiřují, Space přepíná, Delete odstraňuje a Escape ruší. Pro ťuknutí na kanál stiskni nejprve `l`, `c` nebo `h`.
- Na dotykové obrazovce stiskni a podrž dlaždici pro zahájení výběru, pak klepáním přidávej.

Lišta se čte **{n} selected**, pak **Move to**, **Give a role** (každá barva dostane postupně další roli), **Download** (výběr v kterémkoli ze šesti formátů palety), **Duplicate** (kopie každé, umístěná za originál), **Copy values** a **Delete**. Jedna kopie se otevře rovnou v editoru; několik zůstane vybráno. Jedno Cmd/Ctrl-Z vrátí celou hromadnou akci.
:::

### Přechody

Volitelný panel **Gradients** staví tokeny přechodů z palety. Každý přechod má náhled, 2 až 8 pojmenovaných zarážek a úhel. Zarážka ukazuje na vzorek, takže přebarvi vzorek a přechod ho následuje. Přechody běží v OKLCH.

Stažení palety (designové tokeny, CSS, SCSS, GIMP a Adobe Swatch Exchange) leží v hlavičce palety, vedle jejího nadpisu. Každý formát popisuje [Vezmi svou paletu a písma kamkoli](/info/using.html#take-your-palette-and-fonts-anywhere).

## Typ

Bez vlastního řezu je místnost jedna karta: **Primary**, sázená ve velikosti pro čtení v řezu, který ji dnes obsluhuje, se štítkem **Starter**, tlačítkem **Choose for Primary** a řádkem *"Nothing installs until you choose one."* Headings, kód a kurzíva následují primární, dokud je nevybereš; **Choose them separately** ukáže jejich karty.

![Místnost Type bez zatím zvoleného řezu - jedna karta ve čtecí velikosti, na ní štítek Starter, a jedno vyplněné Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Vyber jeden řez a místnost se otevře do čtyř karet rolí, seznamu Fonts a živého vzorku:

- **Primary**: běžný text, tlačítka a každý nástroj.
- **Headings**: display řez pro `h1` a `h2`.
- **Code**: monospace řez pro kód a data.
- **Italic**: skutečná kurzíva pro důraz, citace a vsuvky.

Karta je odstíněná jen tam, kde jsi ten řez nainstaloval, a její tlačítko říká, pro kterou roli je: **Change Headings** u vlastního řezu a **Choose for Headings** všude jinde. Ukázková řádka se zalamuje, místo aby se oříznula. Nic na kartě nic nepotvrzuje: tlačítko otevře porovnávací scénu pro tu roli.

![Odhalené čtyři karty rolí - každá sazená v řezu, který ji obsluhuje, se štítkem Starter tam, kde nikdo nevybral, a Italic řídící se primárním](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### Srovnávací scéna

Scéna se otevře uvnitř místnosti, pod kartou, kterou jsi stiskl, a karty se sbalí na jednořádkový pás, aby scéna byla vidět na první obrazovce telefonu. Escape zruší a vrátí fokus na kartu.

1. Stiskni **Choose for** a roli na kartě.
2. Napiš název rodiny a stiskni **Preview**, nebo stiskni jednu ze šesti rodin **Pinned** pod polem.
3. Stiskni **Use this face**.

![Srovnávací scéna otevřená pod svou kartou, s řádkem hledání, připnutými rodinami a kartami sbalenými do jednořádkového pruhu](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Souhlas se žádá jednou.** Poprvé, když náhled sáhne na Google Fonts, dialog vysvětlí: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** pokračuje a pamatuje se. **Cancel** nechá kartu s nápisem *"Not fetched. Nothing was sent to Google."* a vlastním **Fetch from Google**.

**Přetáhni soubor písma na scénu** (TTF, OTF nebo WOFF) pro náhled licencovaného písma, které už vlastníš. V obou případech řez zůstává na tomto zařízení, vykresluje se offline v aplikaci, nástrojích a každém exportu a putuje v souboru designového systému. Vše na Google Fonts je dodáváno pod otevřenou licencí (OFL, Apache nebo UFL).

### Fonty na tomto zařízení

Panel **Fonts** vypisuje každý řez na tomto zařízení a roli, kterou obsluhuje. Řezy, které jsi přidal, vedou pod **In the design system**, každý se svými rolemi a smazáním. Startovní řezy následují v jednom tlumeném sbaleném řádku. **Add a face** otevře porovnávací scénu pro kteroukoli roli. Panel **Type roles** ukazuje živý vzorek každé role s její rodinou a stavem, například *Inter* nebo *Inter · follows Primary*.

## Tokeny

Tokeny jsou pojmenované hodnoty za designovým systémem: barvy, písma, loga, rohy a mezery. Nástroje je čtou podle jména, takže změna zde dosáhne každého nástroje najednou.

![Místnost Tokens: hlavička s příkladem ze systému a akcemi souborů, dlaždice počítající každý druh tokenu, pak dvojice barev s údaji o kontrastu](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Hlavička** dává příklad z tvého vlastního systému (*Primary is Spearmint, #033633*) a akce souborů: **Download** (celý systém jako designové tokeny, nebo paleta v pěti dalších formátech), **Copy CSS** a **Add from…** pro zpětné načtení souboru JSON.
- **Dlaždice** počítají každý druh tokenu a skáčou na jeho sekci: Colours, Type, Logos, Shape and spacing, More a All tokens. Počítají, co daná sekce drží; sekce, která drží jen to, co přišlo s prázdným startem, nese štítek **Starter**, a systém, který přišel s aplikací, počítá svůj materiál bez něj. Na telefonu se dlaždice zalamují do dvou řad po třech.
- **Colours** začíná dvojicemi, které nástroje spojují (text na povrchu, na primární, tlumený na povrchu) s údajem APCA ve světlém a tmavém a označí **Weak contrast**, kde dvojice nedosahuje. Pak každá skupina barev: rampa jako jedna řada čipů, ostatní barvy s hodnotou a odkazem, který nástroje používají, například `{color.brand.spearmint}`. Stiskni odkaz pro jeho zkopírování. **Edit in Colours** otevře skupinu v místnosti Colours. V design systému s [rolemi barev](#colour-roles-what-the-colours-are-called) je na prvním místě **Colour roles**, každá role jednou, ve slovech a pořadí samotného systému. Role drží barvu pro každou barevnou variantu a vzhled a tyto barvy zůstávají u role, místo aby se objevovaly jako vlastní barvy: změníš je v tabulce Colour roles.
- **Type** a **Logos** vypisují řez pro každou roli a každý slot loga, s **Edit in Type** a **Edit in Logos**, jakmile máš vlastní.
- **Shape and spacing** drží **Rounded corners** (`shape.radius`) a **Spacing rhythm** (`space.base`). Každý se čte *Lolly default*, dokud nepohneš posuvníkem, a *Yours* poté, ukládá hned a lze jej vrátit.
- **More tokens** přidávají mezery, rozměry, tloušťku čáry, průhlednost, rotaci, prosté čísla a stíny, ukládané jako standardní [designové tokeny](/info/design-tokens.html).
- **App appearance (advanced)** vypisuje barvy, velikosti a stíny, které používají vlastní obrazovky Lolly, a **Inspect every token (advanced)** prohledává a upravuje jakoukoli uloženou hodnotu, přičemž každou změnu nejprve ukáže k revizi. Tam jsou hodnoty role barvy v každé barevné variantě uvedeny u role: vyber token role a uvidíš jeden řádek pro každou barevnou variantu, světlý a tmavý vedle sebe, a řádek s počtem říká, kolik hodnot role drží. Design systém jen pro čtení ukazuje stejný seznam.

Sekce, ve které nic není, nabídne cestu, jak mezeru vyplnit: **Pick a colour**, **Choose a face** nebo **Add a logo**.

## Soubory

Vlož soubory, které tvá značka uchovává, kromě log: soubory **vector**, **image**, **audio** a **motion** (video, Lottie a animace). Objeví se v [Assets](/info/using.html#assets-your-library), roztříděné do sekcí a připravené ve výběru assetů každého nástroje, a zůstávají na tomto zařízení.

## Rules

**Rules** uvádějí volby tvé značky do práce: co lidé mohou měnit, co zůstává pevné a co Lolly umí zkontrolovat.

![Rules v Lolly Demo: čtyři interní pravidla, každé označené Checked in Lolly Design a Required nebo Advisory, pak Try your design system in use s příklady připravenými k vykreslení](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** vypisuje tvá pravidla. **Add rule** (nebo **Add your first rule**) otevře krátký formulář:

- **Rule name** tvými vlastními slovy, například *Beacon accents*;
- **Check**: **Colour choices**, **Font choices**, **Fixed artwork** nebo **Text length**, s rolí značky, kterou používá, pod tvým vlastním jménem pro roli;
- **Example**, na který se vztahuje (Poster, Title slide, Content slide nebo Lolly Chart), **Mode** a zda je **Required** nebo **Advisory**;
- **Reviewed by**, pak **Save draft** nebo **Approve & save**.

Schválení zaznamenává tvé vlastní rozhodnutí na tomto zařízení. Schválená povinná pravidla omezují opakovaně použitelný plakát a kontroly pokrývají jen příklady PNG; nemění žádný jiný nástroj.

Pravidla, která designový systém přináší ve svém souboru tokenů, například schválené dvojice barev, tloušťka a zarovnání textu nebo logo pro každou plochu, jsou zde uvedena jako **Checked in Lolly Design**. Lolly Design je kontroluje vrstvu po vrstvě na kartě **Before you export** v panelu exportu a `lolly check` totéž dělá pro uložený dokument Lolly Design ([Před exportem](/info/design.html#before-you-export)). Pravidlo, pro které toto sestavení nemá kontrolu, se ponechá, jak bylo dodáno, a označí **Unchecked**.

Lolly Demo přináší čtyři schválená interní pravidla. Nadpisy se nikdy nesází velkými písmeny: toto pravidlo je povinné, takže `lolly check` ohlásí nadpis velkými písmeny jako chybu. Další tři jsou doporučující. Běžný text je zarovnaný doleva. Primární značky leží na světlých plochách a obrácené na tmavých. Přerušované čáry znamenají „upusť sem“.

**Try your design system in use** vykreslí čtyři příklady z aktuální revize pomocí **Render & check examples**. Zvol **Mode** a **Try your own text** pro nadpis, doprovodný text a text snímku. Každý příklad ohlásí, co bylo změřeno, s **See checks & sources** a **Download check report**, a **Make reusable poster** stáhne `.lolly`, jehož pevné rozvržení a schválené volby vstupů putují se souborem. Příklady jsou lokální: spuštěním kontroly se nic nezveřejní ani neschválí.

Sestavení dodávané s pevnou značkou ukazuje stejná pravidla a příklady jen pro čtení, pod *This brand is set*.

## Skills

**Skills** vypisuje [dovednosti značky](/info/brand-skills.html) aktivního designového systému: psané standardy značky, jeden na obor, pro lidi i agenty AI. Každý řádek uvádí obor, vlastní stav značky (**Draft** nebo **Approved**), zda je dovednost veřejná, nebo interní, a její revizi. Vyber řádek a přečteš si dovednost vedle jejího pokrytí, které staví řádky dovednosti proti tvým tokenům: co Lolly kontroluje, co je v rozporu, co souhlasí a co je jen vodítko.

**Download skill (.zip)** zapíše dovednost jako složku Agent Skills pro nástroj agenta, s odkazy do katalogu mířícími na tuto Lolly, a **Copy as one file** vloží stejný text do schránky pro okno chatu. Designový systém bez vlastních dovedností uvádí základ, který Lolly napíše z jeho tokenů a domácích pravidel pokaždé, když se základ čte. Místnost dovednosti jen čte a nikdy je neupravuje.

## Přines vlastní značku

**Add from…** v liště otevře výběr, který se ptá, co máš, ne v jakém je to formátu:

- **Design tokens or a design file**: JSON DTCG nebo Tokens Studio, projekt Penpot, zip sad tokenů, balíček designového systému Lolly, SVG, `DESIGN.md` nebo složka stránky značky.
- **PDF**: prezentace nebo soubor se směrnicemi, čtený na tomto zařízení kvůli barvám, značkám a vloženým písmům.
- **Logo or screenshot**: obrázek se stane navrženou paletou, čtenou na tomto zařízení. Čte barvy, ne písmo ani rozvržení.
- **Saved web page**: jeden soubor HTML a jeho soubory CSS, nebo vložený HTML či CSS, nejvýše 20 souborů a 2 MB. Čte se jen text, který dodáš: propojené zdroje se nestahují a skripty se nespouštějí.
- **Font file**: TTF, OTF nebo WOFF. Otevře místnost Type, kde se písmo nainstaluje.
- **Website**: jedna stránka, čtená kvůli barvám a písmu. Tato dlaždice se objeví jen na zařízení, které umí stránku přečíst, a říká, jaký čtecí způsob používá: aplikaci na tomto zařízení, nebo rozšíření prohlížeče na kartě na pozadí, přihlášené jako ty. Zadání URL jen vyplní pole; souhlasem je stisknutí načtení.

Vyber zdroj souboru návrhu a další karta vypíše přijímané formáty jako dlaždice s ikonami, s celou kartou jako jedním cílem pro přetažení. Soubor můžeš také přetáhnout rovnou na studio.

![Karta importu - přijímané formáty vedou jako ikonové dlaždice a celá karta je jeden cíl přetažení](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- **Balíček designového systému Lolly** (`.lolly`, nebo starší `.zip`) se nainstaluje jedním krokem.
- Export **Penpot** (`.penpot`) přináší své designové tokeny.
- Soubor **Design Tokens** (W3C DTCG) nebo **Tokens Studio** (`.json`) přináší své tokeny. Popis, který žádá čtenáře, aby ignoroval pokyny, tvrdí oprávnění nebo žádá o spuštění kódu, se vynechá a import řekne, kde stál. Je to kontrola řádek po řádku a jiné znění mine, takže soubor od někoho neznámého si přečti, než tokeny použiješ.
- **Prosté SVG** se prohledá na barvy, z nichž vybíráš, přičemž první se stane tvou primární.
- **`DESIGN.md`** (`.md`) jde do **Try these colours** se svými tokeny, jak jsou napsané. Jeho text lze ponechat jako koncept dovednosti značky a karta označí řádky, které žádají čtenáře, aby ignoroval pokyny, tvrdil oprávnění nebo spouštěl kód. Agenti a stránky značky koncept neuvidí, dokud v místnosti Skills nestiskneš **Keep this skill**, a ponechaná dovednost zůstává interní.
- **Složka stránky značky**, vybraná jako složka, upuštěná nebo zazipovaná, jde ke stejné kontrole. Každý soubor se ověří proti `brand.json` složky a ten, který neodpovídá, odmítne celou složku. Přidá tokeny. Loga a písma zůstávají ve složce.

Lolly čte stránku značky ze souborů, které dodáš. Nestahuje adresu jiného webu.

### Soubor s vlastními slovy pro barvy

Soubor tokenů nebo `DESIGN.md` může pro své barvy používat vlastní slova, například main, accent, supporting a tertiary. Když Lolly taková slova najde, kontrola uvede každé z nich dříve, než se cokoli použije: slovo, jeho barvu v každém vzhledu, token, z něhož pochází, a jako co by ho Lolly četla. Lolly tato čtení navrhuje jen ze slov, podle krátkého seznamu, a nepoužívá žádný model. Slovo mimo seznam přijde jako vlastní slovo značky, **By name only**. Přejmenuj libovolné slovo, řekni, k čemu slouží, čti ho jako něco jiného, nebo ho odškrtni, aby zůstalo jako pojmenovaná barva.

**Install with these roles** je zapíše a **Install without roles** nainstaluje soubor přesně tak, jak přišel. Soubor bez takových slov žádný nový krok neukáže. Soubor, který uvádí vlastní role, například ten, který zapsala Lolly, je ukáže, jak jsou napsané, a nainstaluje je beze změny, a potom je můžeš upravit v místnosti Colours. Terminál nemá kontrolu, takže `lolly system import` ponechá uvedený záznam a slova z jiných souborů nechá jako pojmenované barvy.

### Zkontroluj referenci

Logo, snímek obrazovky, web nebo uložená stránka otevře **Try these colours**: příklad v navržených barvách, **Main colour**, kterou můžeš změnit, a jméno pro nový systém. Rámeček vyjmenuje, co aplikování udělá: **replaces** aktivní nastavení tokenů vygenerovanou paletou a výchozími styly, **keeps** tvá písma a soubory knihovny a předchozí systém lze **recovered**. **Apply suggested settings** uplatní světlou a tmavou paletu po kontrolním bodu a **Restore brand settings** může vrátit stará nastavení. **Change reference** vybere jiný zdroj.

**Palette, source details and individual choices** ukazuje, co se přečetlo, všechna nalezená jména písem a kontrast náhledu. Jména písem jsou jen návrhy; Type je stále místo, kde řez nainstaluješ. Podrobnosti zdroje mohou zahrnovat typografii, mezery, odsazení a hodnoty rohů, kde byly pozorovány, jinak označené **Not observed**. Uložená stránka nebo nativní čtení webu hlásí deklarované styly, které stránka nemusí používat, a rozšíření prohlížeče může hlásit změřené styly z vzorku viditelných prvků. Jsou to pozorování: nic se neinstaluje a mezery zdroje nikdy nenahradí tvoje vlastní. **Choose individual items in the tray** ponechá jednotlivé položky a **Download design context** uloží zprávu JSON s pozorováními, navrženými tokeny a informacemi o zdroji (se SHA-256 jakéhokoli dodaného HTML nebo CSS). Zpráva nedrží žádný surový text stránky a není podepsaným Content Credential.

Importy PDF a návrhových souborů mají vlastní ovládací prvky revize. Položky v **Tray** nic nemění, dokud je nepřidáš v místnosti, která vlastní ten druh materiálu. `#/start?source=<kind>` otevře výběr na zdroji (`file`, `pdf`, `image`, `font`, `url`, `page`) a `?import` otevře prostý seznam.

### Najdi a porovnej vzhled

Otevři **Find a look** z Boardu nebo ze seznamu designových systémů v Settings. Procházej systémy uložené na tomto zařízení a několik opakovaně použitelných příkladů Lolly a hledej podle jména, štítku barvy nebo deklarovaného písma. **Closest to my current palette** řadí podle změřené podobnosti barev, přičemž shodná písma rozhodují při shodě; není to hodnocení kvality.

Kliknutím na vzhled ho zobrazíš v kontextu. Náhled nic nemění. **Use this look** na každé kartě tento vzhled použije. Uložený systém se stane aktivním, což nic neupravuje. Barvy příkladu projdou obvyklým kontrolním bodem do otevřeného designového systému, jehož loga, písma a vše, co příklad nedefinuje, zůstávají, jak jsou. **Compare looks** přidá ke každé kartě zaškrtávací políčko, takže můžeš vybrat dva a porovnat je vedle sebe. **Restore brand settings** obnoví předchozí vzhled. Uložené systémy mají upravitelné **Search tags** pod **Details and design context**. Příklady jsou původní barevné receptury Lolly, bez stažené sbírky a bez účtu.

![Porovnej Sunroom a Orchard vedle sebe, než použiješ kterýkoli z barevných systémů.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

## Uchovej a přesuň designový systém

### Přesuň značku mezi zařízeními

**Export** zapíše jeden soubor **`LollyBrand-….lolly`**: tvé tokeny, písma, loga a předvolbu motivu, s manifestem integrity, který se při návratu kontroluje. Webová vydání před 1.0.7 pojmenovala stejný soubor `.zip` a tato podoba se stále přijímá. **Tokens (.json)** zapíše samotný dokument designových tokenů, bez písem a log, pro repozitář, krok sestavení nebo jiný nástroj tokenů.

Chceš-li jednu vrátit, použij **Add from… → Design tokens or a design file** nebo přetáhni soubor na studio. Tak ti kolega předá značku nebo ji přeneseš na druhou instalaci, bez účtu a bez cloudu. [Společná práce s partnery](/info/partners.html) popisuje, co dalšího poslat, když člověk, který tvou značku dostává, pracuje pro jinou organizaci. Pro přinesení značky z příkazového řádku viz [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** zabalí písma, která jsi přidal, do instalovatelného RPM. Pokud jsi některé nahrál sám, Lolly tě nejprve požádá o potvrzení, že je smíš redistribuovat.

### Obnov dřívější nastavení

Otevři **More** v liště, zvol **Restore brand settings**, vyber datovaný kontrolní bod a stiskni **Restore**. Obnoví barvy, nastavení písma a další tokeny aktivní značky; soubory písem a obrázků zůstávají, jak jsou. Lolly nejprve uloží tvé aktuální nastavení jako **Before restore**, takže obnovení můžeš vrátit i po zavření prohlížeče. Na tomto zařízení se uchovává posledních 20 kontrolních bodů.

### Verze

Zveřejněná verze je **trvalá pojmenovaná kopie** uchovaná na tomto zařízení. Nikdy se nemění, takže nástroj nebo odkaz, který ji připne (pomocí `designv`), kreslí stále totéž. Systém s něčím tvým vlastním uvádí **Versions & publishing** v nabídce **More** v liště; po prvním zveřejnění se **Versions** přidá k místnostem. `#/start?area=versions` jej otevře přímo.

- **Verze je trvalá.** Zatím neexistuje mazání a panel to říká.
- **Odstranění vedou kartu kompatibility,** protože odstraněný token je to, co rozbije nástroj.
- **Zveřejnění nelze vrátit; obnovení lze.** *Restore latest from this version* je běžná úprava, s okamžitě nabídnutým **Undo**.

**Publish only** uchová verzi, aniž by změnil, co nástroje následují; **Publish and make active** způsobí, že nástroje a aplikace tu verzi následují. **Follow the latest again** uvede každou úpravu do provozu v okamžiku, kdy ji provedeš.

### Zveřejnění stránky značky

[Stránka značky](/info/brand-page.html) je jedna adresa pro lidi i pro agenty: stránka, která ukazuje loga, barvy, písmo a příklady, se stejnými fakty v souborech vedle stránky. **Publish a brand page** pod Versions & publishing ukazuje živou stránku a vedle ní:

- **Goes public**: každý soubor, seskupený, s velikostí.
- **Held back**: co zůstalo venku a proč. Logo bez zaznamenané licence zůstane venku, dokud nezaškrtneš jméno loga. Soubor písma potřebuje zaznamenanou licenci, která dovoluje jeho předání, a stránka ukáže obrysový vzorek, když soubor zůstane venku. Interní dovednosti značky se neobjeví nikdy.
- **What was checked**: dvojice barev podle colourway a režimu a interní pravidla. Jsou to měření, ne verdikt.
- **In your words**: prohlášení o použití a kontakt. Stránka vytiskne, co napíšeš, a Lolly nepřidá žádnou licenci ani právní tvrzení. Přepínač vypne řádek „Made with Lolly“ v patičce.
- **On exports**: přepínač, který [zaznamená adresu stránky do exportů tohoto designového systému](/info/brand-page.html#lead-back-from-your-files). Je vypnutý, dokud ho nezapneš, potřebuje adresu `https` a s balíčkem ani kopií neputuje. Zamčený designový systém přepínač neukazuje, protože rozhoduje jeho správce.

**Download folder** uloží složku jako ZIP, kterou umístíš, kam chceš, a nic se nezveřejní, dokud to neuděláš. V terminálu `lolly system publish --out=<dir>` zapíše stejnou složku. Instance, která stránky značky poskytuje, nabízí také **Publish to** svou adresu, což je jedno výslovné stisknutí a prochází řetězcem schvalování, pokud ho má. Spravovaný designový systém se zveřejní jen tehdy, když to jeho správce dovolí.

### Připojení agenta

**Connect an agent** na stejném místě ti dá text k vložení a říká, co každá možnost umí:

- **`AGENTS.md`** v projektu: agenti čtou jména a pravidla systému. Nic nekreslí a nepotřebuje server.
- **Veřejný server Lolly**: kreslí s Lolly Demo, ať máš tady otevřený jakýkoli systém. Nepotřebuje klíč.
- **Tvoje instance**: kreslí se systémy, které instance drží, a čte servisní token z proměnné prostředí. List uvede jméno proměnné a token nikdy neukáže.

Když s tvým systémem nekreslí žádný hostovaný server, list to řekne.

## Spravuj své designové systémy

Otevři **Settings → Preferences → Design systems** pro přepnutí, přidání nebo odstranění systémů. **Open** vybere systém a otevře jej zde; **Make a new one** vytvoří místní systém a otevře jej s připraveným polem jména. Najednou je aktivní jeden systém, pro celé zařízení. [Architektury značek](/info/brand-architectures.html) pomáhají rozhodnout, kdy značka potřebuje vlastní designový systém.

**Odkud systém pochází.** Systém, který dodává katalog nasazení, se čte **Came with this app**, nebo **From this instance** v aplikaci připojené k jedné. Rozbal **Catalogue source**, abys viděl, kdo ho dodává, jeho asset tokenů a jmenný prostor a jeho známou verzi či kontrolní součet; pokud obnovení selže, je materiál z cache označen.

**Spravované systémy jsou jen pro čtení.** Systém se čte **Managed by this instance** (nebo **Managed by this app** v desktopové aplikaci bez instance), když ho jeho katalog zamyká. Můžeš ho používat a stáhnout a jeho otevření zde ukáže poznámku jen pro čtení s **Make an editable copy** a **Switch**, pak jeho role barev a tokeny bez ovládacích prvků pro úpravy. Tvé vlastní místní systémy zůstávají upravitelné, i když spravovaný byl první. Sestavení s jednou pevnou značkou otevře Lolly Design System Setup na *This brand is set*, s tokeny a pravidly použití značky ke čtení.

**Každý další dodaný systém je tvůj** ke skrytí, úpravě a resetu, včetně Lolly Demo a Lolly Starter na lolly.tools. Úprava jednoho ponechá jeho jméno a označí řádek **Edited here** a **Reset to original** v jeho nabídce zahodí změny provedené na tomto zařízení. Prázdný starter je výjimka: první změna tam založí tvůj vlastní designový systém, takže se Lolly jednou zeptá, jak nový systém nazvat. [Lolly Demo v praxi](/info/lolly-demo-in-use.html#switch-to-your-own) ukazuje, co tvůj vlastní systém nahrazuje.

### Odstranění designového systému

Zvol **Remove** v nabídce systému; potvrzení řekne, který systém bude poté aktivní. Uložené relace, nahrání a materiál sdílený s jiným systémem zůstávají.

Odstranění dodaného systému ho jen skryje: jeho assety katalogu zůstávají, **Bring back** ho ukáže znovu a sám se vrátí, pokud odstraníš všechno ostatní. Odstranění importované nebo upravené kopie neodstraní dodaný systém, jeho loga ani písma, a pokud byla kopie aktivní, dodaný systém se stane znovu aktivním. Odstranění aktivní hostované kopie vymaže jen připojení té kopie; samostatně zvolená instance zůstane vybrána.

Změna toho, co server dodává, je úkol správce: jeho provozovatel změní zdrojový katalog a znovu nasadí, nebo správce Lolly Work zkontroluje a použije změnu serveru. Úpravy zde zůstávají lokální, s jednou výjimkou: na instanci Lolly Work, která ti uděluje `brand.edit`, nabízí spravovaný systém také **Edit for** tuto instanci, což otevře upravitelnou kopii, a **Send to** tuto instanci ve **Versions** odešle zpět její barvy, colourways, role barev a adresu stránky značky. [Úpravy instance ze studia](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) pokrývají, co úprava může změnit a jak instance změnu poskytuje. Viz [Odebrání designového systému z katalogu](/info/configuration.html#removing-a-catalogue-design-system) a [Konfigurace](/info/configuration.html#supplied-and-local-design-systems).

## Používej kontext návrhu mimo aplikaci

**Download design context** uloží dokument tokenů, vyřešené barvy, deklarované rodiny písem, ID assetů, důkazy o zdroji tam, kde jsou zaznamenány, pokrytí a explicitní pravidla, bez souborů písem a bez důkazu vlastnictví. Příkazový řádek soubor čte bez serveru: `lolly system import` z něj udělá designový systém terminálu a `lolly system check` kontroluje vstupy Lolly Design proti uloženému kontextu. Import pokrývá [Přines svůj designový systém](/info/cli.html#bring-your-design-system), kontrolu [Který designový systém příkaz používá](/info/cli-decks.html#which-design-system-a-command-uses) a klient MCP čte stejné zadání z `lolly://design-context` ([Server MCP](/info/mcp.html)).

## Kam dál

- **[Používání Lolly](/info/using.html)**: nástroje, ukládání, sdílení a Assets.
- **[Architektury značky](/info/brand-architectures.html)**: jak se divize, produkty, podporované značky, klienti a sezóny promítají do designových systémů, colourways a identit loga.
- **[Práce s partnery](/info/partners.html)**: sdílení tvé značky s partnerem a práce ve značce, kterou jsi dostal/a.
- **[Stránky značky](/info/brand-page.html)**: zveřejni svůj designový systém na jedné adrese, jako tiskovou sadu a sadu pro agenty.
- **[Design Tokens](/info/design-tokens.html)**: model tokenů, v němž je tvá značka zapsána.
- **[Export souboru](/info/exporting.html)**: tiskové jednotky, CMYK a formáty, do nichž se tvá značka vykresluje.
