# Batch a Multi-edit

Jakmile často vytváříš stejný druh souboru, objeví se dvě úlohy. Někdy potřebuješ mnoho verzí jednoho návrhu: kartu ve dvanácti jazycích nebo každou velikost banneru. Jindy máš několik různých uložených návrhů a chceš, aby se jedna změna dostala ke všem, třeba nové datum nebo nový nadpis.

**Batch** dělá první úlohu a **Multi-edit** druhou. Obojí běží na tvém zařízení a exportuje stejnou vykreslovací cestou jako samotné nástroje.

::: cols
## Batch

- Jedna šablona, mnoho řádků. Každý řádek je jedna sada vstupů a vytvoří jeden soubor.
- Řádky vyplníš psaním, vložením z tabulky nebo importem CSV.
- Žádný limit řádků; 50 se zobrazí na stránce.
- Otevírá se z **Batch** v záhlaví Projects (`#/batch`).

## Multi-edit

- Dva až osm různých uložených návrhů vedle sebe jako živé karty.
- Jeden postranní panel upravuje vstupy, které sdílejí, pak vstupy každé karty zvlášť.
- Každý návrh se uloží zpět, odkud přišel.
- Otevírá se z **Edit together** na liště výběru v Projects.
:::

## Vytvoř mnoho verzí jednoho návrhu

Otevři **Projects** a stiskni **Batch** v jeho záhlaví. Mřížka začíná jedním řádkem: vyber v něm šablonu, pak řádek zduplikuj nebo vlož data z tabulky. Otevřený zevnitř složky tě Batch vrátí do té složky.

![Batch na nové mřížce: název souboru a nástroje řádků nahoře a seznam šablon prvního řádku otevřený na nástrojích, které můžeš vybrat](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Vyplň řádky.** Piš do buňky nebo vlož blok rovnou z Excelu, Google Sheets či jiné tabulky. **Import CSV** přidá řádky nebo nahradí dávku. Když vkládáš do buňky, která drží nastavení exportu, Lolly se zeptá, který vstup každý vložený sloupec vyplňuje. **Export CSV** zapíše mřížku zpět ven. Otevři **Columns** pod mřížkou pro zobrazení dalších vstupů nebo šířky, výšky, jednotky a DPI po řádcích.

**Nastav výstup.** Lišta nastavuje název souboru zipu, **Default format**, jednotky a DPI pro každý řádek. Nabídka formátů je seskupený seznam z panelu exportu, který ukazuje formáty, jež katalog nabízí a tvůj prohlížeč podporuje. Řádek s vlastním formátem, velikostí nebo názvem souboru si drží vlastní nastavení.

**Vykreslení.** **Render all** exportuje každý řádek do jednoho `.zip`. Nejprve vyber řádky a **Render selected**, **Export selected CSV** a **Print selected rows** působí jen na ně; zruš výběr a pracuješ zase s celou dávkou. **Print sheet** rozloží řádky na tisknutelný arch. **Batch activity** hlásí každý import a vykreslení a sbalí se, aby tabulka měla víc místa.

**Zachovej dávku.** **Sessions** uloží celou mřížku jako pojmenovanou dávkovou relaci, která se později znovu otevře z Projects. Sessions vždy uloží každý řádek, ať je vybráno cokoli. **Folders…** ve stejné nabídce otevře celou složku Projects jako řádky, jeden na uloženou relaci, přičemž každý název souboru nese cestu složky.

::: details Výběr řádků a buněk
Řádky vybereš jejich zaškrtávacími políčky, nebo Shift-klikem na políčko pro rozsah. Zaškrtávací políčko v záhlaví vybere aktuální stránku a **Select all *N* rows** vezme i řádky na dalších stránkách. Výběr zůstává při přechodu mezi stránkami. **Edit input**, **Duplicate** a **Remove** působí na vybrané řádky a **Undo remove** obnoví naposledy odstraněné řádky. Z buňky s fokusem Shift+Space vybere ten řádek a Escape zruší výběr.

Tažením přes buňky, Shift-klikem na buňku nebo Shift+šipkami vybereš obdélník. **Copy cells** nebo Ctrl+C / Command+C zkopíruje hodnoty pro tabulku. Ctrl+A / Command+A z buňky s fokusem vybere každý viditelný sloupec na každé stránce; ze zaškrtávacího políčka řádku stejná zkratka vybere každý řádek. Výběr buněk ponechá zaškrtnuté řádky zaškrtnuté. Dvojklikem na buňku nebo Enterem upravíš její text. Vlož obdélník ze schránky, nebo vlož jednu hodnotu, aby vyplnila všechny vybrané buňky; prázdné buňky a víceřádkový text zachovají své pozice.
:::

### Colourways a motivy po řádcích

Každý řádek si drží vlastní volby motivu: světlý nebo tmavý a colourway, když ho designový systém má. Řádek otevřený z Projects, složky nebo uložené dávky se vykreslí ve volbách, v nichž byla jeho relace uložena, a jeho náhled se otevře v nich. Tiskový arch, zduplikovaný řádek i vyplněný řádek je také zachovají.

CSV nese volby ve sloupci `_themes` za sloupci velikosti, s tímtéž JSON jako parametr odkazu `_themes`, například `{"":"dark","colourway":"beach"}`. Prázdná buňka nebo `{}` znamená výchozí hodnoty designového systému. Sloupec se zapíše, jen když nějaký řádek má volby, takže dávka bez nich exportuje stejné CSV jako dřív. Při importu je buňka, která není platnou volbou motivu, uvedena jako problém a její řádek se vykreslí ve výchozích hodnotách. Mřížka zatím nemá ovládací prvek pro změnu voleb řádku, nastav je tedy v CSV nebo v uložené relaci.

### Batch, nebo Render folder

Batch dělá mnoho variant jedné šablony. Chceš-li znovu vykreslit relace, které už máš uložené, vyber je v Projects a použij **Render selection**, nebo **Render folder** pro celou složku; obojí pokrývá [Najdi a obnov svou práci](/info/find-your-work.html#find-something-you-saved).

## Uprav několik uložených návrhů společně

Zaškrtni dvě až osm uložených relací v **Projects** a zvol **Edit together** na liště výběru. Otevřou se vedle sebe jako živé karty na `#/multi?s=<slot>,<slot>…`. Každá karta je skutečné vykreslení své relace, takže to, co vidíš, se exportuje.

Všechny řídí jeden postranní panel:

- <!--i:sliders--> **Shared** je první: každý vstup, který dvě nebo více relací deklaruje stejně (stejné ID, stejný typ, stejná omezení, pravidlo, které používá mřížka dávky pro své sloupce). Uprav sdílený ovládací prvek jednou a hodnota se dostane do každé relace, která ten vstup deklaruje, živě na každé kartě. Dvě relace stejného nástroje sdílejí vše; dva různé nástroje sdílejí jen vstupy, které mají společné.
- <!--i:document--> Pod ním drží **jedna sbalená karta na relaci** všechny vlastní vstupy té relace, tak kompletní jako postranní panel samotného nástroje, s kompaktním blokem exportu: **Format**, **W** / **H**, **Unit**, **DPI** a **Download**. Ten Download relaci nejprve uloží a pak soubor vykreslí se stejným názvem souboru, formátem a Content Credentials, jaké by měl z nástroje.
- <!--i:search--> **Filter inputs…** nahoře zúží ovládací prvky na všech kartách najednou, takže se dostaneš k "nadpisu" v osmi relacích bez rolování.

Klikni na libovolnou kartu (nebo na ní stiskni Enter) a otevře se karta postranního panelu té relace. **Save all** zapíše každou relaci zpět do jejího slotu. **Download all** nejprve uloží a pak vykreslí celou sadu do jednoho zipu, stejně jako **Render selection** v Projects, s volitelným zámkem heslem nabídnutým cestou.

Každá karta se kreslí ve volbách motivu vlastní relace, včetně nástroje umístěného uvnitř návrhu. Karty v různých podobách leží vedle sebe, zatímco aplikace kolem nich si drží vlastní barvy, a **Save all**, stahování, **Batch grid** a **Send to Print Sheet** zachovávají volby každé relace.

### Limity

- **Nejvýše osm.** Každá karta připojuje vlastní živý runtime a osm je číslo, při kterém zůstává odezva. Odkaz žádající víc nebo relaci, která už neexistuje, to řekne, místo aby se načetl napůl.
- **Odkaz je místní.** Jmenuje tvé vlastní uložené sloty, takže tu sadu znovu otevře na tomto zařízení. Není to sdílený odkaz.
- **Pro cokoli většího** zvol **Edit as sheet** na stejné liště výběru. Otevře celý výběr jako řádky v mřížce dávky (`#/batch?s=…`), bez limitu velikosti a bez pravidla stejného nástroje. Složky zůstávají mimo obojí: otevři složku v mřížce přes **Sessions → Folders…** nebo ji vykresli pomocí **Render folder** v Projects.
- **Hledání nedosáhne na Multi-edit.** Je to jediné zobrazení, o kterém vyhledávací lišta neví.

## Kam dál

- **[Export souboru](/info/exporting.html)**: formáty, velikosti a tiskové nastavení, které může každý řádek použít.
- **[Šablony](/info/templates.html)**: výchozí body, které dělají dobrý první řádek.
- **[Najdi a obnov svou práci](/info/find-your-work.html)**: Projects, složky a vykreslování toho, cos uložil.
