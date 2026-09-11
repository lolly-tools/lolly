# Export a formáty

Jak z nástroje dostat hotový soubor - výběr správného formátu, nastavení výstupní velikosti a co jednotlivé volby dělají. Stejně jako všechno ostatní **export probíhá na tvém zařízení**; nic se nikam nenahrává.

## Jak export funguje

Náhled *je* ten soubor. Při exportu host vyrenderuje dané plátno do zvoleného formátu a předá ti stažení (nebo to dá na schránku). Nástroj nabízí jen formáty, které deklaroval jeho autor, a picker skryje ty, které tvůj prohlížeč neumí vytvořit (viz [Video](#video)).

K souboru vedou tři cesty. Většina nástrojů **vyrenderuje plátno** do zvoleného formátu. Textové a datové formáty (HTML, MD, TXT, JSON, CSV, ICS, VCF) jsou místo toho **generované z obsahu nástroje**, ne rasterizované z obrázku. A soukromí sloužící utility (např. *Strip Hidden Data*) používají třetí cestu: soubor, který *ty* vybereš, se na zařízení transformuje byte za bytem a rovnou vrátí zpět - žádné plátno, žádný watermark a žádná přidaná metadata o původu, protože je to už tvůj vlastní soubor.

Akce v ovládacích prvcích exportu:

- <!--i:download--> **Download** - uložit soubor (hlavní akce).
- <!--i:photos--> **Copy** - dát obrázek na schránku k rovnému vložení do Slacku, e-mailu, dokumentu. Tam, kde prohlížeč neumí kopírovat obrázky, se místo toho stáhne a řekne ti to.
- <!--i:folder--> **Save** - uložit aktuální návrh jako uloženou session nástroje ve tvé knihovně.
- <!--i:link--> **Share** - otevře **dialog Share**: kopírovatelný odkaz, který návrh reprodukuje, přepínače při návštěvě (fullscreen, export panel, stažení nebo kopie při otevření) a volitelný **Shortest link**, který zabalí celý stav do kompaktního tokenu (viz [URL Mode](/info/url-mode.html)).

(Které z nich se zobrazí, volí autor nástroje; výchozí sada je Copy, Download a Save.)

![Panel exportu - formát, velikost a akce Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share se otevře přes nástroj, s odkazem už sestaveným a přepínači při návštěvě pod ním.

### Renderování mnoha najednou

Jeden export je jeden soubor, ale můžeš vyrenderovat **mnoho** v jednom průchodu - každý doručený jako jeden `.zip`:

- <!--i:folder--> **Projects → Render folder** exportuje každou uloženou session ve složce (a jejích podsložkách) jako jeden vnořený zip; **Render selection** dělá totéž pro jakýkoli vícenásobný výběr; jedna uložená session se vyrenderuje přímo do vlastního souboru. Batch/Pro se nepotřebuje - viz [Using Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** vyrenderuje mřížku vstupních sad - každou variantu jedné šablony najednou.

Uložená session se dá znovu sdílet jako odkaz na nástroj z Projects (rekonstruuje URL nástroje z uložených vstupů), takže odkaz ji znovu otevře s naprosto stejným nastavením.

## Výběr formátu

Název souboru a picker formátu sedí navrchu panelu jako jedna dvojice `name.format` a picker vypisuje jen formáty, které deklaroval autor tohoto nástroje.

![Pole s názvem souboru srostlé s pickerem formátu, takže export čte jako jedna dvojice name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| Co chceš… | Použij | Proč |
|---|---|---|
| Ostrá loga / grafiku, která se škáluje | **SVG** | Vektor - nekonečně škálovatelný, malý, editovatelný |
| Vektor pro Office / Windows aplikace | **EMF** | Vloží se jako editovatelný vektor do PowerPointu / Wordu; text zůstává živý a editovatelný a Google Disk ho otevře v Google Kresbách pro Prezentace |
| Vektor pro tisk / návrhářské aplikace | **EPS**, nebo **EPS (CMYK)** | PostScriptový vektor pro Illustrator / tiskové workflow |
| Vektor pro řezací / CAD stroje | **DXF** | Laserové řezačky, vinylové plotry, CNC - obrysové cesty v milimetrech |
| Editovatelnou prezentaci | **PowerPoint** (PPTX) | Nativní editovatelný text + tvary, obrázky a vektory zůstávají extrahovatelné |
| Kurz, který dokáže importovat LMS | **SCORM** (LMS) | ZIP s manifestem, spouštěcí stránkou, snímky a namluveným filmem s titulky - z prezentace Design |
| Editovatelný textový dokument | **Word** (DOCX) nebo **OpenDocument** (ODT) | Skutečné odstavce a nadpisy, které textový editor dokáže dál editovat (Doc Studio) |
| Fotku nebo obecný obrázek | **PNG** (bezeztrátový) nebo **JPG** (menší) | Univerzální rastr |
| Menší moderní obrázky | **WebP** / **AVIF** | Lepší komprese, alfa kanál |
| Tisk | **PDF**, nebo **Print PDF** (CMYK) | Skutečná velikost stránky; CMYK pro tiskárnu |
| Tiskový rastr pro tiskárnu | **Print TIFF** (CMYK) | Pixely DeviceCMYK pro RIP |
| Animaci pro web | **GIF** | Funguje všude, větší soubory |
| Animaci s plnou barevností + skutečnou alfou | **APNG** | Animovaný PNG - bez omezení palety, skutečná průhlednost |
| Animaci s nejmenším souborem | **Animated WebP** | Plná barevnost + alfa, lépe komprimovaný než GIF nebo APNG |
| Animovaný vektor, který se škáluje | **Animated SVG** | Samostatný; smyčkuje v prohlížeči nebo `<img>`, bez kodeku, libovolná velikost |
| Video pro sociální sítě / sdílení | **MP4** nebo **WebM** | Nejlepší poměr kvality k velikosti (viz níže) |
| Formátovaný text / e-mailový podpis | **HTML** | Vloží se naformátovaný do e-mailových klientů |
| Prostý obsah | **MD** / **TXT** | Pouze text |
| Událost do kalendáře | **ICS** | Importuje se do libovolné kalendářové aplikace |
| Kontaktní kartu | **VCF** | Importuje se do Kontaktů / adresářů |
| Strukturovaná data pro opětovný import | **JSON** / **CSV** | Zachová obsah nástroje beze změny při zpětném importu |
| Favicon | **ICO** | Ikona webu ve více velikostech (**ZIP** sdružuje několik formátů) |

První řádek je běžný případ. Wordmark sázený tvým brandovým písmem se exportuje jako SVG, kde je každé písmeno obrysovou cestou místo pixelu, takže zůstává ostrý ve velikosti vizitky i ve velikosti polepu na budově ze stejného souboru.

![Vlásková rozšířeně kernovaná wordmarka Aurora, přesně ten typ čistého vektorového artworku, o kterém je řádek SVG v tabulce](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Velikost a tiskové jednotky

Ve výchozím stavu exporty používají nativní pixelovou velikost nástroje. Tam, kde nástroj vystavuje **rozměry**, si můžeš nastavit šířku × výšku a **jednotku**:

- **px** (výchozí) - přesné pixely.
- **mm · cm · in · pt · pc** - fyzické/tiskové velikosti. S fyzickou jednotkou také nastavíš **DPI** (výchozí **300** pro tisk); engine to správně převede podle formátu - **PDF** se stane skutečnou stránkou dané velikosti, **rastr** se vyrenderuje ve správném počtu pixelů pro dané DPI (a vloží rozlišení), **SVG** ponechá fyzickou jednotku s px viewBoxem.

Pro rastr ve vyšším rozlišení zadej větší šířku/výšku, nebo zvol fyzickou jednotku a zvyš DPI (pixely = velikost × DPI). Přepínač škálování na jedno kliknutí neexistuje.

Příklad: šířka `210`, výška `297`, jednotka `mm` → stránka A4.

![Řádek rozměrů nastavený na 210 na 297 mm, s odhaleným polem DPI, protože jednotka je fyzická](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Snímky z časované kompozice

**Časovaná kompozice** - časová osa [Sequence](/info/using.html#timeline-sequence) v Designu, nebo jakýkoli artboard řízený časovou osou - je pohyblivá věc, takže statický export musí odpovědět na otázku „který okamžik?". Pravidlo je přesně takové, jaké bys čekal: **snímek na pozici přehrávací hlavy**. Umísti přehrávací hlavu tam, kde chceš mít obrázek, a exportuj; co vidíš, to dostaneš.

Když chceš víc než jeden okamžik, objeví se vedle výstupní velikosti pole **Frames** (pouze pro časovanou kompozici a pouze pro statický formát - PNG, JPG, WebP, SVG nebo PDF). Nech ho na `1` pro snímek na hlavě přehrávání. Zvyš ho a dostaneš tolik statických snímků vzorkovaných v rovnoměrných intervalech napříč celou sekvencí:

- **Rastr a SVG** se vrátí jako jeden **zip** - `<name>-01.png`, `-02.png` a tak dále.
- **PDF** se vrátí jako **jeden dokument s odpovídajícím počtem stránek**.

Užitečné pro storyboard, list náhledů, kontaktní list k revizi nebo sociální karusel vystřižený rovnou z videosestřihu.

Vzorkování probíhá v **středu** každého intervalu, ne na okrajích, protože první okamžik sekvence bývá přechod na vstupu, který ještě nedoběhl, a poslední je stav po skončení všech klipů - vzorkování na koncových bodech by utratilo dva tvé snímky za skoro prázdné. Počet je omezen na **64** (kontaktní list je pro čtení člověkem) a cokoli nesmyslného zadané do pole spadne zpátky na `1`, místo aby export selhal. Každý snímek je obyčejný statický obrázek, takže Content Credentials, imprint, fyzické jednotky a DPI se chovají přesně stejně jako u jednoho exportu.

Pole **Frames** je dnešní způsob, jak takový list získat. Engine si rezervuje odpovídající URL parametr `cuts`, ale žádný shell ho zatím z odkazu nečte, takže sdílený odkaz se vždy znovu otevře na snímku hlavy přehrávání - viz [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## Vícestránkové PDF

Některé nástroje místo jednoho výtvoru vytvářejí **vícestránkový PDF dokument** - obálku, obsah, který se rozlije na tolik stránek, kolik potřebuje, a zadní stranu, to vše v jednom souboru (viz nástroj *Booklet*). Každá stránka je **skutečná stránka PDF** o velikosti podle boxu dané stránky, takže čtenáři a tiskárny dostanou skutečné stránky, ne jeden dlouhý obrázek.

- **Stránky z obsahu.** Přidávej bloky textu a obrázků; nové stránky se vytvářejí automaticky, jakmile se bloky zaplní, a kterýkoli blok můžeš vynutit, aby začal novou stránku.
- **Skutečné velikosti stránek.** Vyber A4, US Letter nebo A5 (na výšku - dvousloupcové rozvržení je pro to stavěné) - každá stránka a exportované PDF se vykreslí přesně v této velikosti.

Vícestránkové PDF jsou RGB dokumenty a nenesou ořezové/spadávkové značky - ty patří k jednostránkové cestě **Print PDF** výše. Nesou ale stejná **metadata PDF/X-4** jako každý export PDF (boxy stránek, XMP, ID dokumentu, výstupní záměr sRGB s vloženým profilem) a nabízejí **Content Credentials** (níže) - u nástroje *Booklet* je tato volba předvybraná.

## Vytváření mnoha věcí najednou

Lolly má tři odlišné způsoby, jak pracovat ve velkém objemu, a řeší různé úkoly - dávkové úpravy jsou plnohodnotná schopnost platformy, ne něco, co si každý nástroj vymýšlí znovu:

- <!--i:document--> **Jeden návrh × tabulka řádků → jeden vícestránkový dokument.** Nástroje se vstupem `table` (jako *Battlecards*) automaticky promění každý řádek ve stránku - vlož tabulku ze svého sešitu a dostaneš PDF velikosti prezentace. Tvým skutečným dávkovým editorem zůstává sešit: oprav v něm deset řádků a vlož znovu. Samotný nástroj stránky nikdy nespravuje.
- <!--i:layers--> **Jeden návrh × datový soubor → mnoho samostatných souborů.** Dávková mřížka `/pro` vezme CSV a vyexportuje jeden soubor *na řádek* - jmenovky, certifikáty, každý zvlášť.
- <!--i:sliders--> **Mnoho různých assetů upravovaných vedle sebe.** *Multi-edit* otevře několik uložených relací v jednom zobrazení pro koordinované doladění napříč odlišnými návrhy.

Základní pravidlo: řádky stejného návrhu, které patří do **jednoho dokumentu** → nástroj řízený tabulkou; řádky, které musí odejít jako **samostatné soubory** → `/pro`; **různé návrhy**, které potřebují stejnou úpravu → multi-edit. (Plánovaná exportní možnost „kombinovat média“ tyto první dvě propojí - spojí exporty stejného formátu do jednoho PDF, jednoho videa nebo náhledového kontaktního archu.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart a Diagrams dokážou exportovat **prezentaci PowerPoint** - jeden snímek na stránku. Cílem není pixel přesný screenshot, ale předat kolegovi prezentaci, kterou skutečně dokáže **editovat a vytahovat z ní prvky**. Proto se každá stránka rozloží na nativní objekty:

- <!--i:font--> **Text** se stane skutečným, **editovatelným textovým polem PowerPointu** - s velikostí písma, barvou, řezem, kurzívou a zarovnáním z rozvržení - takže si můžeš opravit překlep nebo přestylovat přímo v PowerPointu.
- <!--i:pentool--> **Vektory** (loga, ikony, značka SUSE) se vloží jako **skutečné obrázky SVG** - zůstanou ostré v jakékoli velikosti a PowerPoint na nich dokonce umí použít *Convert to Shape*.
- <!--i:photos--> **Obrázky** projdou ve své nativní rozlišovací schopnosti jako vlastní extrahovatelné obrázky (hero oříznuté pomocí `cover` si za ořezem uchová celý obrázek, takže ho lze přerámovat), s jakoukoli úpravou nad obrázkem (filtry, prolnutí) věrně zapečenou.
- <!--i:layers--> **Pozadí, ohraničení a linky** se stanou skutečnými obdélníkovými/čárovými tvary.

![Panel exportu s vybraným PowerPointem: jeden snímek na stránku, text a tvary zůstávají editovatelné](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Rozvržení je záměrně přibližné - cílem je věrný, znovupoužitelný **obsah**, ne uzamčený snímek obrazovky. Cokoli, co walker nedokáže vyjádřit nativně (složitá filtrovaná nebo maskovaná oblast), se vloží jako obrázek, aby se nic neztratilo. Prezentace má jednu velikost snímku, převzatou z první stránky.

PowerPoint je i cesta **dovnitř**. Přetáhni `.pptx` na libovolnou plochu pro nahrávání a vyber snímky, které chceš - každý se stane prvkem, který lze umístit, upravit nebo na něm stavět dál. **Markdown Slides** vytvoří novou prezentaci z Markdownu (a k tomu dá brandovanou šablonu `.pptx`) a nástroj **Rebrand** přeznačkuje existující prezentaci na místě - paletu motivu, napevno zadané barvy a fonty - aniž by se dotkl jejích grafů, SmartArtu nebo animací, a vrátí `.pptx`. Viz [Import designu → Prezentace a dokumenty](/info/design-import.html#decks-and-documents).

## Penpot

Každý nástroj, který dokáže exportovat SVG, dokáže exportovat i **soubor Penpot** (`.penpot`) - dokument připravený k dalšímu editování v Penpotu, ne jen k prohlížení.

- <!--i:layout--> Z **Designu** se každý frame stane Penpot **boardem**, každý box na něm se přenese jako svůj vlastní editovatelný tvar - obdélník, elipsa, text, obrázek nebo cesta - a výsledek dorazí jako znovupoužitelná **komponenta** v panelu Assets, připravená znovu vytáhnout ven.
- <!--i:pentool--> Z nástroje, jehož výstup je **čistá geometrie** - vektorové nástroje jako QR Code, Street Map, Wordmark a Palette Lab - se stejným způsobem přenese každá cesta, obdélník, textový řádek a přechod jako svůj vlastní editovatelný tvar.
- <!--i:font--> Z nástroje, který svůj výstup skládá v **HTML**, **text zůstává textem** - jeden editovatelný textový objekt Penpotu na řádek, ne obrys a ne plochý obrázek. Kus grafiky, pro který Penpot nemá konstrukt - složitá ilustrace, živé plátno - se veze samostatně jako obrázek, takže nikdy nezploští text a boxy kolem něj. Celé rozvržení, které Penpot nedokáže věrně rozdělit, se přesto může přenést jako jeden obrázek v plné věrnosti, takže se nic nikdy neztratí.
- <!--i:palette--> Barva nebo font, který tvar **dědí z brandového tokenu**, zůstane v souboru s tímto tokenem **propojený**: změň token v panelu Tokens Penpotu a každý tvar, který ho dědí, se přebarví spolu s ním, zatímco jednorázová doslovná barva zůstane přesně tam, kde je. Barvy a typografie brandu se dostanou i do panelu **Assets** a celá jeho sada designových tokenů do panelu **Tokens** - stejná sada tokenů DTCG, jakou používá vlastní paleta Lolly. Penpot si odtud vede vlastní kopii: úprava provedená v jeho panelu Tokens se do brandu vrátí přes [import Brand Studia](/info/design-import.html), ne sama od sebe.

| Co jsi vytvořil | V Penpotu |
|---|---|
| Text | Editovatelné textové objekty - oprav překlep nebo přestyluj |
| Tvary, cesty, přechody, obrázky | Vlastní editovatelné vektorové tvary |
| Barva nebo font z brandového tokenu | Živé propojení s tokenem - uprav token a každý tvar, který ho dědí, se přizpůsobí |
| Celý design | Znovupoužitelná komponenta v panelu Assets |
| Složitá ilustrace nebo živé plátno | Vloženo samostatně jako obrázek, editovatelný obsah kolem něj nedotčen |

![Panel exportu s vybraným Penpotem: soubor .penpot a Send to Penpot vedle stahování](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Chceš-li ho otevřít, spusť Penpot, vyber projekt a zvol **Import**. Když jsi v panelu exportu přihlášený k Penpotu, udělá tento krok za tebe **Send to Penpot** - vyber tam projekt a soubor půjde rovnou do něj.

## SCORM (balíčky kurzů)

Prezentace Design může odejít jako **balíček SCORM** - zip, který importuje systém pro řízení výuky (LMS), ať už je to Moodle, Canvas, Blackboard nebo firemní LMS. Zvol **SCORM (LMS)** ve výběru formátu a export zapíše:

- <!--i:layout--> **Snímky**, jeden obrázek na artboard, jako vektor tam, kde to artboard umožňuje, a jako pixely jen tam, kde ne.
- <!--i:play--> **Namluvený film** se stopou titulků - poznámky řečníka přečtené hlasem na zařízení, přesně tak, jak je přehrává [Prezentování](/info/create/using.html#presenting).
- <!--i:file--> **Spouštěcí stránka**, která prochází snímky, přehrává film a hlásí dokončení zpět do LMS přes runtime SCORM 1.2, verzi, kterou přijímá každý LMS.
- <!--i:font--> Fonty, které prezentace používá, aby se spouštěcí stránka vykreslila stejně i offline.

![Panel exportu na prezentaci Design s vybraným SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Nic v balíčku nikam nevolá domů: jsou to soubory v zipu a běží uvnitř LMS bez bundleru, bez CDN a bez účtu. Vytváří ho webová a desktopová aplikace; CLI ne, protože fotografování artboardů a kódování filmu potřebuje prohlížeč.

## DXF (řezací soubory)

Vektorové nástroje (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, varianty loga, Diagram Builder) umí exportovat do **DXF** - výměnného formátu AutoCAD R12, který čtou laserové řezačky, vinylové plotry a software CNC/CAD. Geometrie se zapisuje jako obrysové **cesty v milimetrech** (křivky zploštěné s jemnou tolerancí), text se převádí na obrysové cesty a barva se mapuje na nejbližší AutoCAD Color Index (který obvykle řídí nástroj/operaci na řezačce). DXF je čistě liniová grafika - fotografická nebo filtrovaná oblast nemá formu řezací cesty a je vynechána (Lolly na to upozorní), takže pro zachování rastrového obsahu použij SVG/PDF.

Street Map je nejjasnější případ: celý návrh už je tahy, takže se každá silnice a kanál stanou řezací cestou a nic se nevynechává.

::: showcase
![Vykreslení Street Map Paříže inkoustem na krémovém podkladu - čistá liniová grafika, takže každý tah přežije cestu k řezačce](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Přejeď a kamera se vzdálí skrz skutečnou geometrii: sedm cest, nikde žádné pixely, každý tah ostrý jako vlásek při jakémkoli přiblížení. To je stejný soubor, jaký čte řezačka.
:::

## Animované SVG

Nástroje pro pohyb (Animated Ad, Lottie Ad) dokážou exportovat **Animované SVG** - samostatnou *vektorovou* animaci. Na rozdíl od GIF/APNG/WebP (které vzorkují každý snímek do pixelů) animované SVG skládá vektorové snímky s vloženými klíčovými snímky CSS, takže se **škáluje do jakékoli velikosti bez kodeku a bez externího runtime** - přehraje se na kartě prohlížeče nebo v `<img>`. Text zůstává obrysovaný, takže se vykreslí kdekoli. Sdílí ovládací prvky **Duration**/snímková frekvence s ostatními animovanými formáty a (protože je na snímek těžší než bitmapa) používá nižší výchozí snímkovou frekvenci.

## Průhlednost

Nástroje, které to podporují, nabízejí přepínač **průhledné pozadí** (např. *No BG*). Průhlednost zachovávají PNG, WebP, AVIF, SVG (statické i animované), APNG a Animated WebP. JPG a PDF jsou vždy neprůhledné a TIFF se zploští na bílou (na HDR cestě na černou - viz níže).

## Barevné prostory

Dvě různé otázky, které stojí za to udržet oddělené: ve kterých barevných prostorech Lolly umí **číst a přemýšlet**, a do kterých **zapisuje**.

**Čtení.** Kdekoli je barva zapsaná - stylopis nástroje, malba importovaného SVG, hodnota designového tokenu, stín nebo gradient uvnitř zkráceného zápisu CSS - Lolly čte celý slovník **CSS Color 4**: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, pojmenované barvy CSS a `color()` v předdefinovaných prostorech - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - včetně komponent zapsaných klíčovým slovem `none`. Jeden parser to dělá pro celou platformu, takže se prohlížeč a každý exportní walker shodnou na tom, co daný barevný řetězec znamená.

To je důležitější, než to zní, protože prohlížeč rozřeší moderní CSS do moderního CSS. Napiš `color-mix(in oklab, …)` a Chrome to spočítá jako `oklab(…)`; použij značkový token uložený jako `oklch()` a to je přesně ta hodnota, kterou vidí exportní walker. Barvy v těchto formách se čtou správně místo toho, aby se zahazovaly - a přesně to dělal walker, který rozuměl jen `rgb()`: exportoval text ve značkové barvě jako černý, ztrácel tónované panely a linky tabulek a četl `oklch(0.7 0.1 200) 0px 2px 4px` jako posun stínu 0.7 o 0.1.

**Uvažování.** Matematika barev probíhá percepčně, ne na surových kanálech. Odvození palety, rampy, harmonie a kontrast běží v **OKLCH/OKLab**, a barva mimo gamut se dostane do rozsahu vlastním algoritmem mapování gamutu CSS Color 4 - redukcí chromy s kontrolou percepční vzdálenosti - místo ořezáváním kanálů, takže se sytá barva usadí na nejbližší barvě, kterou bys fakticky přijal, místo na zploštělé. Gradienty interpolují v prostoru, který si vybereš (výchozí OKLab, nebo `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, se směrem přechodu odstínu pro ty polární), a míchání je **předvynásobené**, takže přechod do průhlednosti zachovává správnou barvu místo tmavnutí směrem k černé po cestě. Jeden interpolátor obsluhuje jak náhled, tak exportní walkery - a právě to zabránilo tomu, aby se kónický gradient míchal jinak na obrazovce a jinak v exportovaném souboru.

**Zápis.** Výstup je záměrně užší než vstup, protože soubor musí být čitelný v čemkoli, co ho otevře, a prostor se na výstupu *deklaruje* pouze tehdy, když do něj byla čísla skutečně převedena. Obrazovkové a webové formáty se zapisují jako **sRGB** a takto se i označují; tiskové formáty se zapisují jako **CMYK** vůči pojmenované tiskové podmínce (níže); a HDR cesta je **Rec.2100 PQ** (výše). Barva se širokým gamutem, která dorazí až k exportu, se namapuje do sRGB místo toho, aby byla nesprávně označena - protažení `color(display-p3 …)` do vektorového souboru je plánovaným rozšířením, ne něčím, co dnešní exporty tvrdí, že dělají. Gradient vytvořený v OKLab se na výstupu *zapeče* do prostých zastávek sRGB, přičemž extra zastávky se vloží jen tam, kde by se sRGB viditelně odchýlilo od perceptuální křivky, protože `<linearGradient>` v SVG ani axiální stínování v PDF nemají nastavení interpolačního prostoru, které by ten záměr přeneslo. Jedna vytvořená hodnota, tři vykreslovače, žádný posun.

## Barevné profily

Aby se barvy věrně reprodukovaly v aplikacích se správou barev (tiskárny, Photoshop, prohlížeče), exporty se **označují barevným profilem**:

- **PNG / JPG** nesou vložený ICC profil **sRGB** - barevný prostor, ve kterém se náhled skutečně vykresluje - takže se nemusí nic odhadovat. (Jen značení; pixely se nepřekódovávají.)
- **Print PDF (CMYK)** deklaruje cílovou **tiskovou podmínku** ve svém *OutputIntent* (výchozí *Coated FOGRA39*), čímž RIPu/tiskárně sděluje, jak mají být čteny jeho inkousty CMYK. Značkové vzorníky se změřenými hodnotami inkoustu se převádějí přesně; ostatní barvy používají standardní převod zařízení. Tato deklarace je *jméno*: s Lolly se nedodává žádný profil CMYK a PDF/X-4 vyžaduje vložený profil, takže pojmenovaná podmínka zapíše výstupní záměr bez nároku na shodu s PDF/X-4. Nahraj vlastní profil CMYK a zvol jeho řádek **Embed** v ovládacím prvku Barevný profil a profil se vloží jako *DestOutputProfile* souboru - v tu chvíli může být PDF opravdu PDF/X-4 a tvrdí to, kdykoli to zbytek souboru dovoluje. Tři věci nárok zadrží, přičemž si podrží výstupní záměr (RIP ho stále chce): grafika RGB, kterou se v průchodu CMYK nepodařilo převést, text kreditu proof-margin `prov` (vykreslený standardním fontem, který se nevkládá, a X-4 pro to nedělá výjimku) a **silné** heslo, protože X-4 zakazuje šifrování. Podmínka, kterou deklaruje, se pak čte z tohoto profilu: registrované jméno tam, kde ho profil dokáže prokázat, `Custom` pod vlastním jménem profilu tam, kde ne, takže soubor nikdy nemůže jmenovat jednu tiskovou podmínku a přitom nést naměřené hodnoty jiné.
- **Print TIFF (CMYK)** zapisuje neoznačené pixely **DeviceCMYK** a stejnou tiskovou podmínku zaznamenává jako provenienci ve svých metadatech TIFF (*ImageDescription*), místo aby profil vkládal. Stejný ovládací prvek Barevný profil řídí oba formáty CMYK - TIFF nedokáže vložit tiskový profil vůbec, takže řádek **Embed** tam jen zaznamená jméno tohoto profilu a nic víc.
- **TIFF (RGB)** je prostý, nekomprimovaný sourozenec sRGB - bezztrátový rastr při zvoleném DPI pro archivaci nebo obousměrnou cestu do editoru, s provenienci zaznamenanou ve stejných metadatech TIFF. Jakákoli průhlednost se zploští na bílou (tento profil nenese alfu). Stejně jako CMYK TIFF je jen pro desktop, protože prohlížeče TIFF nedokážou zobrazit náhled a mobilní stahování skončí slepou uličkou.
- **SVG**, **EMF**, **EPS** a **DXF** jsou vektory nezávislé na rozlišení a profilu bez vloženého profilu - barvy SVG jsou prosté sRGB, barvy EMF a EPS jsou device RGB (a **EPS (CMYK)** zapisuje naivní DeviceCMYK) a **DXF** nese nejbližší index AutoCAD Color Index. (SVG, EPS a DXF, stejně jako PDF, převádějí veškerý text na vektorové cesty, takže výsledek se vykreslí i tam, kde není nainstalovaný font. EMF místo toho ve výchozím stavu ponechává text ŽIVÝ - skutečné záznamy textu v metasouboru, které zůstávají vybíratelné a editovatelné v Office a Google Slides, a na obrysy padá jen u řádků, které formát nedokáže vyjádřit; volba „Outline fonts“ v exportním panelu vynutí cesty všude.) **SVG** také reprodukuje CSS `box-shadow` z HTML - každý vnější stín se vykreslí za boxem, s posunem/rozšířením a Gaussovým rozostřením odpovídajícím prohlížeči, a vnitřní stíny se stejným způsobem vykreslí uvnitř.

To je automatické - není co ladit. Miniatury a náhledy značku vynechávají, aby zůstaly malé. Jeden profil *je* volba, protože mění pixely, ne je jen popisuje - viz **HDR** níže.

## HDR (jasné barvy)

Běžné exporty jsou sRGB: bílá je bílá a sytá značková barva je stejně jasná jako normální bílá obrazovky. Na displeji schopném HDR je nad tím spousta rezervy a karta **HDR** v exportním panelu ji využívá - tvé značkové barvy a bílý text se posunou směrem ke špičkovému jasu, takže opravdu *září*, zatímco tmavé oblasti zůstávají tmavé a dávají té záři kontrast.

![Karta HDR v exportním panelu, zapnutá, s odhalenými ovladači White / Reach / Dark lift / Focus pod ní](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formáty.** Rastrové formáty, které mají kam signál uložit: **PNG**, **JPG**, **AVIF** a **TIFF**. (Ne WebP - je 8bitový bez funkční cesty pro dekódování HDR, takže PQ WebP by prostě vypadal tmavě. Vektory a PDF nemají žádný model HDR vůbec.)
- **Ve výchozím stavu vypnuto**, na rozdíl od barevného tagování - mění pixely, takže je to volitelné (opt-in). Zaškrtni kartu, nebo předej `hdr=1` v odkazu ke sdílení.
- **Co se skutečně zapíše.** Pixely se překódují do **Rec.2100 PQ** - primární barvy BT.2020 s přenosovou křivkou SMPTE ST 2084 (PQ) - a kontejner nese odpovídající signál, aby aplikace se správou barev věděla, že je má takto číst: vygenerovaný **profil ICC v4 se značkou `cicp`** (JPG, TIFF), **chunk `cICP`** (PNG) nebo přepsaný box `colr` (AVIF). Zesílení je řízeno **percepční (OKLab) světlostí**, takže střední a světlejší barvy vystřelí na vrchol a tmavé se spíš zklidní, než aby se vypálily, a zachovává odstín - brandová zelená se rozjasní, ne zmátoví.
- **Ovladače.** Čtyři, zobrazí se po zapnutí karty: **White** (strop špičkového jasu, 400–2000 nitů), **Reach** (jak hluboko do tónů se záře šíří), **Dark lift** (o kolik se rozjasní tmavé partie - `0` je ponechá tmavé) a **Focus** (kolik barevné sytosti zesílení zachová). Jezdí ve stejném parametru jako kompaktní vyladěná hodnota - `hdr=1600-60-0-50` znamená White 1600, Reach 60, Dark lift 0, Focus 50 - takže vyladěný vzhled je z odkazu reprodukovatelný.
- **Kde to uvidíš.** Prohlížeče se správou barev na HDR displeji: Preview / Quick Look / Safari na zařízeních Apple, Chrome na HDR monitoru. Na běžné obrazovce SDR se soubor pořád zobrazí jako normální obrázek.
- **Věz předem.** Řada platforem to, co nahraješ, **překóduje** a signál HDR odstraní - sociální sítě, messagingové aplikace, některé CMS - což může nechat obrázek vypadat tmavě nebo vymyté. Používej HDR tam, kde máš cíl pod kontrolou (web, který si sám stavíš, video stěna, prezentace na jasném panelu), ne jako výchozí volbu pro všechno.
- **Průhlednost.** PNG a AVIF si podrží alfu; JPG je neprůhledný jako vždy. Cesta **TIFF** slučuje na **černou**, ne na bílou jako cesta SDR - v PQ je bílá kód pro 10 000 nitů, takže sloučení na ni by kolem každé hrany vytvořilo oslepující halo.
- **Tytéž byty z terminálu.** `--hdr=1` spolu s `--export=png` nebo `--export=jpg` zapíše 16bitový Rec.2100 PQ PNG a JPEG s gain mapou podle ISO 21496-1 i v [CLI](/info/cli.html), a to ze stejných enkodérů enginu, ne z prohlížeče - takže nástroj nativní pro `<svg>` vyprodukuje soubor HDR, aniž by se na cestě objevil jakýkoli Chromium, a PNG je bajtově identický s tím z webového shellu. AVIF a TIFF zatím zůstávají exporty jen z webového shellu.

## Video

Animované nástroje exportují pohyb jako **MP4**, **WebM** nebo **GIF** - a tam, kde je to nabízeno, jako **APNG**, **Animated WebP** nebo vektorové **Animované SVG** (výše). Který video kontejner uvidíš, závisí na tvém prohlížeči - výběr ukáže jen to, co dokáže skutečně nahrát:

| Prohlížeč | Ukazuje |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 a WebM** |
| Starší Chrome | **WebM** |

GIF funguje všude (skvělý pro chat/e-mail; větší a s méně barvami než video). Animované nástroje také zpřístupňují **Wait** (kolik sekund nechat animaci ustálit před nahráváním) a **Duration** (délku klipu).

> Sdílený odkaz `?format=…`, který požaduje kontejner, jenž tvůj prohlížeč neumí zaznamenat, elegantně přejde na ten druhý a soubor podle toho pojmenuje.

**Zvuk.** Videoexporty nejsou tiché. Nástroj může pod klip položit **hudební podklad** - zvukový prvek z katalogu, smyčkovaný nebo zkrácený na délku klipu, s prolínáním, hlasitostí a automatickým ztlumením (duckingem) pod vlastním zvukem záběru - a nahrávací nástroje přenášejí živý zvuk záběru přímo do souboru. **MP4** a **WebM** si podrží smíchanou stopu; GIF a animované obrazové formáty (APNG, Animated WebP, Animated SVG) jsou svou podstatou tiché.

## Zvuk

Některé nástroje exportují **zvuk samostatně**, nejen jako videostopu. **Voice Recorder** zachytí nahrávku z mikrofonu s živým měřičem úrovně a jemným koučováním a pak ji uloží jako **MP3** (výchozí, převedené ve tvém prohlížeči) nebo v původním kontejneru - **M4A** (AAC), **OGG** nebo **WebM** (Opus), podle toho, co tvůj prohlížeč nahrál. Stejně jako u všeho ostatního probíhá enkódování na tvém zařízení - nic se nenahrává.

Zvuk, který *přineseš vlastní*, je stejně široký. Výběr prvků přijímá **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** a **FLAC** (zachované bajt po bajtu a dekódované na zařízení), **MIDI** (`.mid` - při importu převedené na drobnou syntezátorovou stopu přímo na zařízení) a **trackerové moduly** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (dekódované na zařízení vestavěným přehrávačem, pár kilobajtů dat skladby). Kterýkoli z nich se může stát **hudebním podkladem** pod videoexportem, nebo hrát v ambientním přehrávači Neurospicy Mode.

Zvuk *je* součástí níže popsané pipeline `format=` / `--export=`: `wav`, `mp3`, `m4a` a `opus` jsou obyčejná id formátu, takže export samotného zvuku je stejně sdílitelný a skriptovatelný jako PNG. Výstupem je jen zvuk, žádný obrázek.

## Původ a vodoznak

Tam, kde to formát podporuje, nesou exporty **metadata o původu** - software, zdroj, název nástroje a kreditní řádek z tvého profilu - nativně vložená (PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>`, komentář GIF). Jde jen o autorství; nic se nenahrává. **Experimentální** nástroje navíc otisknou viditelný vodoznak, který přidává hostitel, takže ho nelze odstranit úpravou nástroje.

**Lolly Imprint.** Rastrové exporty nesou i vlastní Lolly **neviditelný pixelový vodoznak** - *Lolly Imprint* - **ve výchozím stavu zapnutý**, stejně jako Content Credentials. Zatímco pověření a metadata o původu cestují *vedle* pixelů a při opětovném uložení, screenshotu nebo očištění metadat se ztratí, Imprint žije *v* pixelech a přežije rekompresi - takže kopii obrázku lze i později rozpoznat jako vytvořenou v Lolly. Je to trvalá stopa, ne kryptografická záruka, a nese jen informaci o přítomnosti (žádná osobní data). Jezdí v **PNG, JPG, WebP, AVIF, TIFF a BMP** a v rastrech vykreslených Lolly, které jsou vloženy do **PDF nebo PPTX** - nikdy v obrázku, který jsi vložil *ty*, jen v tom, co vykreslí samotné Lolly. Kartu **Lolly Imprint** v exportním panelu odškrtni, chceš-li ji vynechat, nebo v odkazu ke sdílení předej `imprint=0`. (Přežití AVIF při rekódování zatím není kalibrováno; detekce v PDF/PPTX pokrývá vložené rastry z Lolly.) [/verify](/verify) ho detekuje na zařízení - viz [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**Trvalé pověření.** Vedle Imprintu stojí druhá, těžší značka: **Trvalé pověření** (Durable credential), které pomocí neuronového modelu na zařízení (formát TrustMark) zapíše id Lolly *do* pixelů, takže odkaz "vytvořeno v Lolly" přežije očištění metadat, rekódování i opětovné čtení nástroji, které rozumí TrustMarku, stejně jako těmi z Lolly. Je **ve výchozím stavu vypnuté** - na rozdíl od čistě javascriptového Imprintu stojí neuronový průchod při každém exportu plus jednorázové stažení modelu, takže jde o vědomé zapnutí, ne tichou daň. Jen rastr (**PNG, JPG, WebP, AVIF, TIFF**), zaškrtnuté v exportním panelu nebo předané jako `durable=1` v odkazu ke sdílení. V desktopové a mobilní aplikaci je karta rovnou skrytá, ne zobrazená jako nefunkční, protože offline není odkud model stáhnout.

**Ochrana obsahu.** V exportním panelu se *Password protect*, **C2PA Credentials**, **Lolly Imprint** a **Trvalé pověření** sbalí do jedné skupiny **Ochrana obsahu**, která reaguje na zvolený formát, takže možnosti původu a ochrany souboru žijí na jednom místě - skupina zobrazí jen karty platné pro zvolený formát a celá se skryje, když neplatí žádná z nich. Tiskové značky v ní záměrně *nejsou*: jsou to geometrická data tiskové produkce, ne ochrana, takže **Tiskové značky a spadávka** - rozměr spadávky v milimetrech plus Ořezové značky, Registrační značky, Spadávka, Barevné pruhy a detaily Razítka - si drží vlastní kartu nejvyšší úrovně na tiskových formátech.

![Skupina Ochrana obsahu otevřená u exportu PNG, zobrazující jen karty, které se na něj vztahují](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Než exportuješ (tisková kontrola).** Zapni **Tiskovou kontrolu** (`export-preflight`) v příznacích funkcí svého profilu - je **ve výchozím stavu vypnutá**, takže člověka exportujícího PNG pro zprávu v chatu nikdy nepřekvapí prepress zjištění, a řídicí rovina nasazení ([lolly.work](https://lolly.work)) ji může svým členům ve výchozím stavu zapnout - a na patě panelu, hned nad tlačítky, se objeví karta **Než exportuješ**, kdykoli k zakázce mají tiskové pravidla co pravdivého říct: formát, velikost a spadávka, pak ořezová a spadávková plocha, pokrytí inkoustem, počet desek a počet stran, s verdiktem vedle nadpisu. Sedí pod všemi nastaveními, protože je to výrok *o* těchto nastaveních, ne další z nich - a nikdy export neblokuje. Říká ti, co za chvíli uvidí tiskárna.

**Cena spočítaná z tvého ceníku.** Pod tiskovou kontrolou - úplně naposled, stále nad tlačítky - sedí karta, která tytéž počty promění v peníze, a to vždy jen z cen, které jí někdo zadal. Čte, co spočítal průchod tiskové kontroly, ať je karta tiskové kontroly zapnutá nebo ne, a potřebuje, aby platily dvě věci: zakázka má vůbec něco, co lze podle ceníku ocenit (desky, archy, plochu, strany, řádky variant nebo výstupní soubory - takže obyčejné logo PNG se nikdy nezobrazí), **a** je přítomný **ceník** (rate card). Ceník je JSON seznam cen od tvé tiskárny. Výchozí sestavení žádný nenese a nemá způsob, jak ho v aplikaci načíst: přichází buď jako katalogový prvek, který dodá nasazení, nebo přes volitelné rozšíření pro ceníky, které zapne provozovatel vlastního hostingu nebo řídicí rovina. Bez ceníku se nezobrazí nic - žádná výzva, žádná prázdná tabulka.

Pravidlo, na kterém je celý mechanismus postavený, je, že **si nikdy nevymýšlí peníze**. Každé číslo je sazba, kterou jsi dodal, krát množství, které spočítalo Lolly - `4 desky × 35,00 €` - a součet uvádí svůj vlastní zdroj ve stejné větě jako číslo: vydavatele, kterého ceník jmenuje, a datum, ke kterému podle ceníku sazby platí. Neexistuje výchozí měna, žádný zástupný symbol ani nula místo chybějící ceny. To, co soubor tvrdí sám o sobě, zůstává v nepřímé řeči: *"Soubor uvádí: … Lolly to neověřilo."*

A když to nejde spočítat poctivě, pracovní tabulka **zmizí**, místo aby se zdegradovala na zašedlé nebo dopočítané číslo:

- Položky, které ceník neoceňuje, znamenají **žádný součet vůbec** - jen nadpis udávající, kolik jich zůstalo bez ceny. Částečný součet není menší odpověď, je to špatná odpověď.
- Množství, které je stropem, ne přesným počtem, si nese **"až"** až do mezisoučtu, takže se hranice nikdy nevypere do rovného čísla.
- Sazby po datu platnosti zobrazují **jen počty**, dokud nestiskneš *Use these rates anyway* - poté se s číslem nese i datum expirace, takže propadlý součet nelze číst jako aktuální.
- Otevřeno přes **odkaz**, peníze zůstávají skryté, dokud si o ně na tomto zařízení nepožádáš. Ani ceník, ani toto odhalení nikdy necestují v URL - ze stejného důvodu bere CLI `--rate-card=<file.json>` jako příznak lokálního souboru, nikdy jako parametr odkazu.

Karta je ovládací prvek rozhraní, nikdy obsah: odstraní se z každé fáze exportu, takže nemůže hnout ani pixelem staženého souboru. A je to aritmetika, ne cenová nabídka - tu ti může dát jen tvoje tiskárna.

**Skládané renderování.** Když nástroj vloží výstup jiného nástroje (např. *Event Name Badge* vkládající *QR kód*), vnořený render se vloží přímo do exportu rodiče - zůstává **skutečně vektorový** v SVG a PDF a v PNG/JPG/WebP se ostře rastrizuje. Vložené dítě je mezikrok: nedostane *žádný* vodoznak ani *žádný* vlastní původ; má je jen hotový výsledný prvek rodiče. (Skládání pokrývá SVG a rastrové formáty; HTML/MD/TXT skládat nelze.)

## Ochrana heslem

Dva nezávislé druhy zámku, oba zcela na zařízení.

**Heslo pro otevření PDF** - karta *Password protect* v exportním panelu nabízí dvě úrovně:

![Karta Password protect rozbalená u exportu PDF, s polem pro heslo a dvěma úrovněmi zámku](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - základní 40bitový zámek (RC4). Otevře se v *jakékoli* aplikaci pro PDF a - jelikož jde o lehké odrazení, ne skutečnou ochranu - může cestovat v odkazu ke sdílení (záměrně v čistém textu). Jen RGB `pdf`.
- **Strong** - AES-256 (PDF 2.0). Heslo se zadává při exportu a **nikdy** se nedává do odkazu; otevře se jen v novějších aplikacích pro PDF (Acrobat / Preview přibližně od roku 2018), starší aplikace mohou soubor hlásit jako poškozený. Strong se vztahuje i na **tiskové/CMYK PDF** a na **každé PDF uvnitř dávkového zipu** (heslo shromáždí potvrzovací dialog dávky). Protože PDF/X-4 zakazuje šifrování, tiskové PDF zamčené pomocí Strong si podrží CMYK, značky a output intent, ale ztratí nárok na shodu s PDF/X-4.

Obě úrovně se vzájemně vylučují s Content Credentials (zašifrované PDF nemůže nést pověření).

**Zamčená stahování (celý zip + vrstvená ochrana)** - export **ZIP** (formát *ZIP* v exportním panelu, který sdruží několik formátů nástroje), stažení **složky** (Projects → Download) nebo **dávková mřížka** mohou zamknout celý zip jedním heslem, na dvou úrovních:

- **Standard** - tradiční **ZipCrypto**: otevře se v *jakémkoli* nástroji pro rozbalování zipů včetně vestavěného rozbalování v Průzkumníku Windows, ale je slabý (jen odrazení). Jeho heslo může cestovat v odkazu ke sdílení `?password=`.
- **Strong** - **AES-256** (WinZip AE-2): silný, ale v Průzkumníku Windows se vestavěným rozbalováním **neotevře** - příjemce potřebuje 7-Zip / WinZip / Keka / macOS. Zadává se při exportu, nikdy se nedává do odkazu.

Stejná karta *Password protect* v exportním panelu řídí zámek PDF i ZIP a přeformuluje se podle zvoleného formátu. Jedno heslo chrání **každou** položku - obrázky, SVG, všechno, PDF nevyjímaje (jen kontejner zipu dokáže chránit soubory jiné než PDF, které vlastní zámek nemají). A jde o **vrstvenou ochranu**: každé PDF uvnitř je *navíc* jednotlivě zamčené stejným heslem pomocí AES-256, takže PDF zůstane zamčené i po rozbalení zipu. Výzva se objeví při zahájení stahování; prázdné heslo znamená žádný zámek.

**Odkazy ke sdílení chráněné heslem** - jakýkoli odkaz ke sdílení lze zašifrovat tak, aby si jeho otevření od příjemce vyžádalo heslo. Celý stav odkazu je zašifrovaný AES-256 pod klíčem odvozeným z hesla (PBKDF2); cestuje jen šifrovaný text, takže **heslo nikdy není v odkazu** a dešifrování probíhá **v prohlížeči příjemce** - server, který odkaz obsluhuje, vidí v URL jen šifrovaný text, nikdy heslo a nikdy dešifrovaný návrh. Zapni ho v dialogu **Share**. Zašifrovaný odkaz lze v Lolly jen *otevřít* (nelze ho vložit jako obrázek, protože tato cesta nemůže vyžádat heslo). Viz [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Exporty mohou nést **Content Credentials** - podepsaný manifest [C2PA](https://c2pa.org) vložený do souboru, který způsobem odolným proti neoprávněným zásahům zaznamenává, že soubor vznikl v Lolly a od té doby nebyl změněn. Je to standardizovaná verze výše popsaných metadat o původu: kryptografické tvrzení (co soubor vytvořilo, kdy, kým a kde) svázané s hashem bajtů souboru, takže jakoukoli pozdější úpravu odhalí prohlížeč znalý C2PA. Standard spravuje [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon a další), takže stejná pověření, jaká zapisuje Lolly, přebírají i fotoaparáty, redakce a tvůrčí sady nástrojů.

![Karta C2PA Credentials, předem zaškrtnutá, s dobou platnosti pověření vedle ní](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formáty.** Každý kontejner s vkládáním C2PA: **PDF** (RGB i tiskové), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB i tiskové), **WebP** (statické i animované), **AVIF**, **MP4**, **WebM** a zvukové kontejnery **MP3**, **WAV**, **M4A** a **OGG/Opus** - takže nahraný nebo syntetizovaný hlasový klip nese stejné pověření jako obrázek. Balíček **ZIP** otiskne pověření do každé podporované položky zvlášť, a právě tam ho dostane i **Animated SVG** (pod povrchem je to obyčejný dokument SVG; přímý export Animated SVG vlastní kartu nenabízí). MP4, AVIF a M4A používají specifikací dané vázání BMFF a MP3 mapování ID3v2, takže je ověří `c2patool` a další prohlížeče znalé C2PA; **WebM** a **OGG/Opus** zatím standardizované mapování C2PA nemají, takže Lolly nese manifest jako přílohu Matroska, respektive pole OpusTags, což kontroluje vlastní ověřovač Lolly (i CLI). (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, formáty Office a textové/datové formáty kontejner C2PA nemají.)
- **Ve výchozím stavu zapnuté.** Karta **C2PA Credentials** v exportním panelu je u téměř každého nástroje předem zaškrtnutá - odškrtni ji, chceš-li pověření vynechat u jednoho exportu (nebo v odkazu ke sdílení předej `c2pa=off`). Nástroj se ve svém manifestu může zapojení zcela vzdát.
- **Co zaznamenává.** Nástroj a aplikaci, které soubor vytvořily, čas podpisu, exportní prostředí (rodinu enginu prohlížeče + rodinu OS - záměrně hrubě, nikdy jako otisk) a - jen když je zapnuté *Profile → Use my details* - tvé jméno a e-mail jako autora díla.
- **Co vidí příjemci.** Nástroje pro kontrolu Content Credentials (aplikace Adobe, `c2patool`, contentcredentials.org/verify) manifest přečtou a zobrazí tvrzení. Protože Lolly podepisuje klíčem vygenerovaným **na tvém zařízení** - ne certifikátem z důvěryhodného seznamu - prohlížeče ho hlásí jako *neověřené* pověření. Struktura a odolnost proti zásahům jsou skutečné; identitu podepisujícího prostě nepotvrzuje žádná autorita. Chceš-li to vylepšit, můžeš si zaregistrovat **ověřenou identitu** (Profile → Content Credentials): krátkodobý certifikát od Lolly CA sváže tvůj e-mail s tvými exporty, zatímco podepisovací klíč stále nikdy neopustí tvé zařízení - viz [Content Credentials Identity](/info/content-credentials-identity.html).
- **Kontrola souboru.** Lolly ověřuje i svá vlastní pověření: přetáhni jakýkoli soubor na [/verify](/verify) (nebo v CLI spusť `lolly validate <file>`) pro zprávu vytvořenou na zařízení - v čele s tím, zda soubor skutečně vznikl v Lolly a od té doby se nezměnil. Webové zobrazení Verify jde daleko za samotné pověření: označí **obsah generovaný AI**, detekuje **Lolly Imprint**, kontroluje podpisy **SEAL** a (volitelně) vodoznaky pixelů třetích stran a odhalí **skrytá data** - vše na zařízení, nic se nenahrává. Viz [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Soukromí.** Vše se odehrává na tvém zařízení: podepisovací klíč se vytvoří pro daný export a nikdy neopustí prohlížeč, nic se nenahrává a tvrzení obsahuje jen to, co už nesou metadata o původu. Nástroje pro soukromí (transformace *tvých vlastních* souborů na zařízení) pověření nikdy nepřidávají a *Strip Hidden Data* odstraní manifest C2PA stejně jako jakákoli jiná vložená metadata.
- **Souvislosti.** U PDF se Content Credentials a **ochrana heslem** (kterákoli úroveň - viz výše) vzájemně vylučují (zašifrované PDF nemůže nést přílohu s pověřením). Pověření se přidává jako poslední krok nad hotovými bajty - po otisknutí DPI/EXIF/barevného profilu, metadat PDF/X a tiskových značek.

## Na telefonu

Ovládací prvky exportu se skrývají za plovoucím tlačítkem **Render**, které otevře panel **Export** - stejné formáty, velikost, kopírování, stahování a sdílení, jen přizpůsobené pro dotyk.

## Přehled formátů

Každé id, které hostitel umí vykreslit, seskupené. Jsou to zároveň hodnoty pro parametr URL `format=` a příznak CLI `--export=` - viz [URL Mode](/info/url-mode.html) a [CLI](/info/cli.html). Nástroj nabízí jen podmnožinu, kterou deklaroval jeho autor, takže výběr je vždy kratší než tento seznam.

| Druh | Id |
|---|---|
| Rastr | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (gzipovaný SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (soubor pro řezání) |
| Stránka a dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (balíček kurzu SCORM, zip) · `penpot` (návrhový soubor Penpot) · `docx` (Word) · `odt` (OpenDocument Text) |
| Pohyb | `gif` · `apng` (animovaný PNG) · `webp-anim` (animovaný WebP) · `svg-anim` (animovaný SVG) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Text a data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (paleta GIMP) |
| Balíček | `zip` |

Několik dalších id pochází z **vlastního exportního hooku nástroje**, ne ze sdílené vykreslovací cesty: `ase` (Adobe Swatch Exchange, z Palette Lab), `exr` a `hdr` (rastry s vysokým dynamickým rozsahem z Darkroomu) a `ttf` / `otf` / `woff` (Font Convert). Formát se vybírá stejně - výběr, `format=`, `--export=` - jen bajty sestaví samotný nástroj. Font Convert je jedinou výjimkou: transformuje soubor s fontem, který dodáš *ty*, takže holé URL nemá co vykreslit.
