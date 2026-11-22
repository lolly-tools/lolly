# Lolly Batch a Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** vytváří mnoho verzí jednoho návrhu, například kartu ve dvanácti jazycích nebo všechny velikosti banneru. **Lolly Multi-edit** provede jednu změnu, například nové datum nebo nadpis, v několika různých uložených návrzích.

Oba běží na tvém zařízení a exportují stejnou vykreslovací cestou jako nástroje.

::: cols
## Batch

- Jedna šablona, mnoho řádků. Každý řádek je jedna sada vstupů a vytvoří jeden soubor.
- Vyplň řádky psaním, vložením z tabulkového procesoru nebo importem CSV.
- Počet řádků není omezen; na stránce se jich zobrazuje 50.
- Otevírá se přes **Lolly Batch** v záhlaví Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Dva až osm různých uložených návrhů vedle sebe jako živé karty.
- Jeden postranní panel upravuje společné vstupy a pak vlastní vstupy každé karty.
- Každý návrh se uloží zpět tam, odkud pochází.
- Otevírá se přes **Edit together** na liště výběru v Projects.
:::

<!--i:eti-table-->
## Vytvoř mnoho verzí jednoho návrhu

Otevři zobrazení **Projects** a v jeho záhlaví stiskni **Batch**. Mřížka začíná jedním řádkem. V tomto řádku vyber šablonu a pak řádek duplikuj nebo vlož data z tabulkového procesoru. Když Batch otevřeš ze složky, vrátí tě do této složky.

![Batch s novou mřížkou: název souboru a nástroje řádků nahoře a otevřený seznam šablon prvního řádku s nástroji, ze kterých můžeš vybírat](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Vyplň řádky.** Piš do buňky nebo vlož blok z Excel, Google Sheets či jiného tabulkového procesoru. **Import CSV** přidá řádky nebo nahradí dávku. Když vkládáš do buňky s nastavením exportu, Lolly se zeptá, který vstup má každý vložený sloupec vyplnit. **Export CSV** zapíše mřížku do souboru. Otevři **Columns** pod mřížkou a zobraz další vstupy nebo šířku, výšku, jednotku a DPI pro jednotlivé řádky. Vyskakovací okno **Fill** sloupce s čísly, textem nebo volbami má také sekci **Design token**, která propojí jeden token napříč řádky sloupce ([Propoj mnoho dokumentů najednou](/info/token-workflows.html#link-many-documents-at-once)).

**Nastav výstup.** Lišta nástrojů nastavuje název souboru zip, **Default format**, jednotky a DPI pro každý řádek. Nabídka formátů je seskupený seznam z panelu exportu s formáty, které katalog nabízí a tvůj prohlížeč podporuje. Řádek s vlastním formátem, velikostí nebo názvem souboru si ponechá své nastavení.

**Vykresli.** **Render all** exportuje každý řádek do jednoho `.zip`. Když jsou vybrané řádky, **Render selected**, **Export selected CSV** a **Print selected rows** pracují pouze s nimi. Zruš výběr a budeš opět pracovat s celou dávkou. **Print sheet** rozmístí řádky na tisknutelný arch. **Batch activity** hlásí každý import a vykreslení a dá se sbalit.

**Uchovej dávku.** **Sessions** uloží každý řádek mřížky jako pojmenovanou dávkovou relaci bez ohledu na výběr. Relace se znovu otevírá z Projects. **Folders…** ve stejné nabídce otevře složku z Projects jako řádky, jeden na každou uloženou relaci; každý název souboru obsahuje cestu ke své složce.

::: details Výběr řádků a buněk
Vyber řádky jejich zaškrtávacími políčky nebo klikni na políčko se Shiftem pro výběr rozsahu. Políčko v záhlaví vybere aktuální stránku a **Select all *N* rows** zahrne i řádky na ostatních stránkách. Výběry zůstávají při přechodu mezi stránkami. **Edit input**, **Duplicate** a **Remove** pracují s vybranými řádky a **Undo remove** obnoví naposledy odstraněné řádky. Když má buňka fokus, Shift+Space vybere její řádek a Escape zruší výběr.

Tažením přes buňky, kliknutím na buňku se Shiftem nebo pomocí Shift+šipek vyber obdélník. **Copy cells** nebo Ctrl+C / Command+C zkopíruje hodnoty pro tabulkový procesor. Ctrl+A / Command+A z buňky s fokusem vybere každý viditelný sloupec na každé stránce; ze zaškrtávacího políčka řádku stejná zkratka vybere každý řádek. Výběr buněk ponechá zaškrtnuté řádky zaškrtnuté. Dvojklikem na buňku nebo stiskem Enter upravíš její text. Vlož obdélník ze schránky nebo vlož jednu hodnotu do všech vybraných buněk; prázdné buňky a víceřádkový text si zachovají pozice.
:::

### Colourways a motivy pro každý řádek

Každý řádek si uchovává vlastní volby motivu: světlý nebo tmavý a colourway, pokud je designový systém nabízí. Řádek otevřený z Projects, složky nebo uložené dávky se vykresluje a zobrazuje v náhledu s volbami, se kterými byla jeho relace uložena. Tiskový arch, duplikovaný řádek i vyplněný řádek je zachovávají.

CSV přenáší volby ve sloupci `_themes` za sloupci velikosti. Sloupec má stejný JSON jako parametr odkazu `_themes`, například `{"":"dark","colourway":"beach"}`. Prázdná buňka nebo `{}` znamená výchozí nastavení designového systému. Sloupec se zapisuje jen tehdy, když některý řádek obsahuje volby. Při importu se buňka, která neobsahuje platné volby motivu, uvede jako problém a její řádek se vykreslí s výchozím nastavením.

::: note Nastav volby řádku v CSV
Mřížka zatím nemá ovládací prvek pro změnu voleb řádku, takže je nastav v CSV nebo v uložené relaci.
:::

### Jazyk pro každý řádek

Nástroj, který tiskne vlastní text, například Certificate, může přijmout sloupec `language` s krátkým kódem jazyka, jako je `de`, `ja` nebo `ar`. Každý řádek pak tiskne svůj text a datum v daném jazyce. Arabské a urdské řádky se rozvrhují zprava doleva. Prázdná buňka se řídí jazykem aplikace. Jazyk, pro který Lolly zatím nemá překlad, se tiskne anglicky včetně data, takže certifikát nikdy není přeložený jen napůl.

### Batch nebo Render folder

Chceš-li znovu vykreslit relace, které už máš uložené, vyber je v Projects a použij **Render selection** nebo **Render folder** pro celou složku. [Najdi a obnov svou práci](/info/find-your-work.html#find-something-you-saved) popisuje obě možnosti.

<!--i:eti-layers-->
## Uprav několik uložených návrhů společně

Zaškrtni dvě až osm uložených relací v **Projects** a na liště výběru zvol **Edit together**. Otevřou se vedle sebe jako živé karty na `#/multi?s=<slot>,<slot>…`. Každá karta je skutečným vykreslením své relace a ukazuje, co se exportuje.

Jeden postranní panel ovládá všechny:

- <!--i:sliders--> **Shared** je první: každý vstup, který dvě nebo více relací deklarují stejně (stejné ID, typ a omezení, pravidlo, které dávková mřížka používá pro své sloupce). Změna společného ovládacího prvku se dostane do každé relace, která vstup deklaruje, živě na každé kartě. Dvě relace stejného nástroje sdílejí vše; dva různé nástroje sdílejí pouze společné vstupy. Nabídka **Input actions** na kartě Shared propojí designový token v každé relaci, která vstup deklaruje.
- <!--i:document--> Pod kartou Shared obsahuje **jedna sbalená karta pro každou relaci** všechny vlastní vstupy dané relace jako v postranním panelu nástroje, s kompaktním blokem exportu: **Format**, **W** / **H**, **Unit**, **DPI** a **Download**. Toto Download nejprve uloží relaci a pak vykreslí soubor se stejným názvem, formátem a Content Credentials, jaké by měl z nástroje.
- <!--i:search--> **Filter inputs…** nahoře zúží ovládací prvky na všech kartách najednou.

Klikni na libovolnou kartu (nebo na ní stiskni Enter) a otevře se karta dané relace v postranním panelu. **Save all** zapíše každou relaci zpět do jejího slotu. **Download all** nejprve uloží a pak vykreslí sadu do jednoho souboru zip, stejně jako **Render selection** v Projects, a nabídne volitelné uzamčení heslem.

Každá karta se vykresluje s volbami motivu své relace, včetně nástroje umístěného uvnitř návrhu. Aplikace kolem karet si ponechává vlastní barvy. **Save all**, stahování, **Batch grid** a **Send to Print Sheet** zachovávají volby každé relace.

### Omezení

- **Nejvýše osm.** Každá karta spouští vlastní živé běhové prostředí a osm karet zůstává svižných. Odkaz, který požaduje více karet nebo relaci, která už neexistuje, to oznámí a nenačte se jen částečně.
- **Odkaz je místní.** Odkazuje na tvé vlastní uložené sloty a znovu otevře tuto sadu na tomto zařízení. Není to odkaz pro sdílení.
- **Pro cokoli většího** zvol **Edit as sheet** na stejné liště výběru. Otevře výběr jako řádky v dávkové mřížce (`#/batch?s=…`), bez omezení velikosti a bez požadavku na stejný nástroj. Složky jsou z obou možností vyloučené: otevři složku v mřížce přes **Sessions → Folders…** nebo ji vykresli přes **Render folder** v Projects.
- **Vyhledávání do Lolly Multi-edit nedosáhne.** Je to jediné zobrazení, které vyhledávací pole nepokrývá.

<!--i:eti-map-pin-->
## Kam dál

- **[Export souboru](/info/exporting.html)**: formáty, velikosti a nastavení tisku, které může každý řádek použít.
- **[Šablony](/info/templates.html)**: výchozí body vhodné pro první řádek.
- **[Najdi a obnov svou práci](/info/find-your-work.html)**: Projects, složky a vykreslování uložené práce.
