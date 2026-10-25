# Export souboru

Něco jsi vytvořil a musí to opustit Lolly: PNG do chatu, PDF pro tiskárnu, prezentaci, kterou kolega bude dál upravovat. Stiskni **Export**, levou polovinu pilulky **Export | Save**. Vyber formát vedle názvu souboru a stiskni **Download**. Soubor se vytvoří na tvém zařízení.

To, co vidíš na plátně, je to, co soubor obsahuje. Nabídka formátů vypisuje jen to, co tento nástroj v tomto prohlížeči umí vytvořit.

Pro většinu úloh je správný jeden ze tří formátů:

| Pro | Zvol | Protože |
|---|---|---|
| Obrazovku, zprávu nebo slide | **PNG** | Otevře ho každá aplikace a zachová průhledné pozadí, pokud ho nástroj nabízí |
| Hotovou stránku nebo cokoli tištěného | **PDF** | Skutečná velikost stránky, která se vytiskne přesně tak, jak vypadá; **Print PDF**, tam kde to nástroj nabízí, je CMYK verze pro tiskárnu |
| Grafiku, která musí zůstat ostrá v jakékoli velikosti | **SVG** | Vektorové tvary, ostré od odznaku po banner |

::: check Zkontroluj soubor ve velikosti, ve které se použije
Než ho pošleš, otevři ho na obrazovce, pro kterou byl vytvořený, nebo ho vytiskni ve skutečné velikosti.
:::

::: details Schvalování a doručení s Lolly Work (volitelné)
[Organizace provozující Lolly Work](/info/organisation.html) může řídit, které formáty a nastavení exportu její členové vidí. Kde se vyžaduje schválení, **Request approval** zastoupí **Download**. Řiď se politikou, kterou tvá instance ukazuje.

Lolly Work může také doručit soubor do nakonfigurovaných cílů S3, WebDAV a HTTP, s kroky schvalování, potvrzeními o doručení a auditním záznamem. Odeslání souboru do tohoto pracovního postupu ho posílá službě organizace; běžné stažení zůstává na tvém zařízení. Osobní cíle Send a doručení organizace se konfigurují odděleně.

Provozovatelé to nastavují podle [průvodce doručením organizace](/info/work-delivery.html). Pro serverová vykreslení ve frontě a dávky viz [Dávky a automatizace CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

## Jak export funguje

Při exportu se plátno nástroje vykreslí do zvoleného formátu a předá se ti ke stažení nebo se vloží do schránky.

Soubor vznikne třemi cestami. Většina nástrojů **vykresluje plátno**. Textové a datové formáty (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) se **generují z obsahu nástroje**, ne kreslí z obrázku. Utility ochrany soukromí, jako *Strip Hidden Data*, **transformují soubor, který jsi vybral**, na tvém zařízení a vrátí ho bez plátna, vodoznaku nebo přidaných metadat, protože je to už tvůj vlastní soubor.

![Tři exportní cesty se sbíhají do hotového souboru: vykreslit plátno, vygenerovat text nebo data z obsahu, nebo transformovat vybraný soubor na zařízení.](/info/diagrams/concepts/three-export-paths.svg)

Panel exportu nabízí tyto akce. Autor nástroje vybírá, které se objeví; výchozí sada je Copy, Download a Save.

- <!--i:download--> **Download** uloží soubor. Pokud jej poté nemůžeš najít, viz [Najdi stažený soubor](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** vloží obrázek do schránky, připravený k vložení do chatu, e-mailu nebo dokumentu. Kde prohlížeč nemůže kopírovat obrázky, stáhne místo toho a řekne ti to.
- <!--i:folder--> **Save** uchová aktuální návrh v Projects jedním kliknutím a nikdy nestahuje soubor. **Save as** vedle **Download** se ptá kam (viz [Ukládání a pokračování](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** otevře dialog Share: odkaz, který návrh reprodukuje, přepínače při návštěvě (celá obrazovka, panel exportu, stažení nebo kopírování při otevření) a volitelný **Shortest link**, který zabalí celý stav do kompaktního tokenu (viz [Režim URL](/info/url-mode.html)).

![Panel exportu - formát, velikost a akce Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Když návrh vkládá vykreslení jiného nástroje, například obrazové pole v Design obsahující odkaz QR Code, vnořené vykreslení se nakreslí do exportu rodiče. V SVG a PDF zůstává skutečným vektorem a v PNG, JPG a WebP se rasterizuje ostře. Vložené vykreslení nedostane vodoznak ani vlastní provenienci; dostane je jen hotový soubor. Exporty HTML, Markdown a TXT složené vykreslení držet nemohou.

## Vyber formát

Název souboru a nabídka formátu jsou spolu jako jedna dvojice `name.format`, pod tlačítkem **Stáhnout**.

![Pole s názvem souboru srostlé s pickerem formátu, takže export čte jako jedna dvojice name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Začni tím, kam soubor míří. Každá karta vypisuje formáty, které se hodí pro ten cíl; nástroj ukazuje jen ty, které umí vytvořit.

::: figure exporting-format-chooser
Šest cílů a formáty, které se pro každý hodí.
:::

Wordmark sázený v písmu tvého designového systému se exportuje jako SVG s každým písmenem jako obrysovou cestou, takže jeden soubor zůstane ostrý na velikosti vizitky i na velikosti obalu budovy.

![Vlasový wordmark s širokým prostrkáním, který čte Aurora, druh čistě vektorového díla, o které jde na řádku SVG v tabulce](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Každý formát a k čemu slouží
| Chceš | Použij | Proč |
|---|---|---|
| Ostrá loga nebo grafiku, která se škáluje | **SVG** | Vektor: škálovatelný, malý a upravitelný; efekt, který vektorový export nenakreslí, se vloží jako obrázek |
| Vektor pro Office a aplikace Windows | **EMF** | Vloží se jako upravitelný vektor do PowerPointu a Wordu, s živým textem; Google Drive jej otevře v Google Drawings |
| Vektor pro tisk a návrhové aplikace | **EPS**, nebo **EPS (CMYK)** | Vektor PostScript pro Illustrator a tiskové postupy |
| Vektor pro řezací stroje | **DXF** | Laserové řezačky, plotry vinylu a CNC: obrysové cesty v milimetrech |
| Upravitelná sada snímků | **PowerPoint** (PPTX) | Nativní upravitelný text a tvary, s obrázky a vektory ponechanými extrahovatelnými |
| Upravitelný textový dokument | **Word** (DOCX) nebo **OpenDocument** (ODT) | Skutečné odstavce a nadpisy, které textový procesor může dál upravovat (Doc Studio) |
| Rozvržení pro InDesign | **InDesign IDML (static subset)** | Text, obdélníky, ovály a obrázky, jedna dvojstrana na kreslicí plochu (Design) |
| Upravitelný dokument Penpot | **Penpot** | Plochy, tvary, text a propojené tokeny |
| Fotka nebo obecný obrázek | **PNG** (bezeztrátový) nebo **JPG** (menší) | Univerzální raster |
| Menší moderní obrázky | **WebP** nebo **AVIF** | Lepší komprese, s průhledností |
| Tisk | **PDF**, nebo **Print PDF** (CMYK) | Skutečná velikost stránky; CMYK pro tisk |
| Rastr pro tisk | **Print TIFF** (CMYK) | Pixely DeviceCMYK pro RIP |
| Animace pro web | **GIF** | Přehraje se všude; větší soubory |
| Animace s plnou barvou a skutečnou průhledností | **APNG** | Animované PNG: bez limitu palety |
| Animace, nejmenší soubor | **Animated WebP** | Plná barva a průhlednost, menší než GIF nebo APNG |
| Animovaný vektor, který se škáluje | **Animated SVG** | Samostatný; smyčkuje v prohlížeči nebo v `<img>`, v libovolné velikosti (Lottie Ad) |
| Animace, která zůstane upravitelná | **dotLottie** | Tvary, cesty a vnější klíče transformací z časové osy Design |
| Předání do Premiere | **Premiere XML + media** | Časované klipy a původní média pro Premiere (Design) |
| Video pro sociální sítě a sdílení | **MP4** nebo **WebM** | Nejlepší kvalita na velikost souboru (viz [Video](#video)) |
| Titulky | **SRT** nebo **VTT** | Časovaný text pro přehrávač videa (Captions, Audiogram a Record) |
| Školicí kurz | **SCORM (LMS)** | Verzovaný web, balíček SCORM nebo xAPI (viz [SCORM](#scorm-course-packages)) |
| Formátovaný text nebo e-mailový podpis | **HTML** | Vloží se formátovaně do e-mailových klientů |
| Prostý obsah | **MD** nebo **TXT** | Jen text |
| Událost kalendáře | **ICS** | Importuje se do jakékoli aplikace kalendáře |
| Kontaktní karta | **VCF** | Importuje se do adresářů |
| Strukturovaná data k opětovnému importu | **JSON** nebo **CSV** | Obousměrně přenáší obsah nástroje |
| Favicon | **ICO** | Ikona webu ve více velikostech; **ZIP** sdružuje několik formátů |
:::

### Průhlednost

Nástroje, které to podporují, nabízejí přepínač průhledného pozadí, například **No BG**. PNG, WebP, AVIF, SVG, APNG a Animated WebP zachovávají průhlednost a GIF zachovává tvrdý okraj. JPG a PDF jsou vždy neprůhledné. TIFF se zploští na bílou, nebo na černou na cestě HDR popsané v [HDR](#hdr-bright-colours).

## Velikost a tiskové jednotky

Exporty používají nativní velikost v pixelech nástroje, pokud nástroj nenabízí **dimensions**. Pak nastavíš šířku, výšku a **unit**:

- **px** (výchozí) jsou přesné pixely.
- **mm, cm, in, pt** a **pc** jsou fyzické velikosti. S fyzickou jednotkou nastavíš také **DPI** (výchozí 300). **PDF** se stane skutečnou stránkou té velikosti, **raster** dostane počet pixelů pro to DPI a zaznamená rozlišení a **SVG** zachová fyzickou jednotku s pixelovým viewBox.

Pro rastr ve vyšším rozlišení zadej větší šířku a výšku, nebo zvol fyzickou jednotku a zvyš DPI (pixely = velikost × DPI). Šířka `210`, výška `297` a jednotka `mm` dají stránku A4.

![Řádek rozměrů nastavený na 210 na 297 mm, s odhaleným polem DPI, protože jednotka je fyzická](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Snímky z časované kompozice

Časovaná kompozice, například časová osa [Sequence](/info/sequence-editor.html) v Design, se hýbe, takže statický export musí vybrat okamžik: **snímek na přehrávací hlavě**. Zaparkuj přehrávací hlavu tam, kde chceš obraz, a exportuj.

Pro více než jeden okamžik se vedle velikosti výstupu objeví pole **Frames**. Zobrazuje se jen u časované kompozice a statického formátu (PNG, JPG, WebP, SVG nebo PDF). Nech ho na `1` pro snímek na přehrávací hlavě. Zvyš ho a dostaneš tolik statických snímků, rovnoměrně rozprostřených přes celou sekvenci:

- PNG, JPG, WebP a SVG se vrátí jako jedno ZIP: `<name>-01.png`, `-02.png` a tak dále.
- PDF se vrátí jako jeden dokument s tolika stránkami.

Každý snímek pochází ze středu svého úseku časové osy, takže první snímek není nikdy napůl vybledlý vstup a poslední není nikdy prázdný okamžik po skončení každého klipu.

::: figure exporting-contact-sheet
Frames: 4 rozdělí sekvenci na čtyři stejné úseky a vezme střed každého.
:::

Použij to pro storyboard, kontaktní arch pro revizi nebo sociální karusel vystřižený z úpravy videa. Počet je omezen na 64 a cokoli jiného napsaného do pole se vrátí na `1`. Každý snímek je běžný statický obraz, takže credentials, Imprint, fyzické jednotky a DPI se chovají jako u jednoho exportu. Odkaz exportu, CLI a MCP žádají stejný arch pomocí `cuts=` (viz [Kontaktní archy](/info/url-export.html#contact-sheets)).

## Mnoho souborů najednou

Lolly má tři způsoby práce ve velkém, každý pro jinou úlohu:

::: cols
## Tabulka se stane jedním dokumentem
Nástroj se vstupem tabulky, například **Battlecards**, změní každý řádek na stránku. Vlož tabulku ze své tabulky a dostaneš jedno PDF. Oprav řádky v tabulce a vlož znovu.
## CSV se stane jedním souborem na řádek
**Batch** (`#/batch`) vezme CSV a vykreslí jeden export pro každý řádek: jmenovky nebo certifikáty, jeden soubor každý, doručené v ZIP. Viz [Batch](/info/batch.html#make-many-versions-of-one-design).
## Několik návrhů dostane jednu úpravu
**Multi-edit** otevře několik uložených relací vedle sebe pro stejné doladění napříč různými návrhy. Viz [Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Z **Projects** **Render folder** exportuje každou uloženou relaci ve složce a jejích podsložkách jako jedno vnořené ZIP a **Render selection** totéž udělá pro jakýkoli vícenásobný výběr; jedna uložená relace se vykreslí do vlastního souboru. Uloženou relaci lze také znovu sdílet jako odkaz na nástroj z Projects, který ji znovu otevře se stejným nastavením.

## Soubory, které zůstanou upravitelné jinde

Některé formáty předávají tvou práci jiné aplikaci jako upravitelný obsah, ne jako obrázek.

### PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart, Diagrams, Flow Chart a Agenda exportují sadu PowerPoint, jeden snímek na stránku. Každá stránka se rozebere na nativní objekty, takže kolega může sadu upravovat a vytahovat z ní assety:

- <!--i:font--> **Text** se stane upravitelnými textovými poli PowerPointu s velikostí písma, barvou, tloušťkou, kurzívou a zarovnáním rozvržení.
- <!--i:pentool--> **Vektory** jako loga a ikony se vkládají jako obrázky SVG; zůstávají ostré a PowerPoint na nich umí *Convert to Shape*.
- <!--i:photos--> **Obrázky** přicházejí v nativním rozlišení jako vlastní obrázky. Oříznutý hlavní obrázek si drží celý obrázek za ořezem a jakýkoli filtr nebo prolnutí na něm je zapečeno.
- <!--i:layers--> **Pozadí, okraje a linky** se stanou tvary obdélníků a čar.

![Panel exportu s vybraným PowerPointem: jeden snímek na stránku, text a tvary zůstávají editovatelné](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Rozvržení je přibližné; cílem je opakovaně použitelný obsah. Cokoli, co walker nedokáže vyjádřit nativně, třeba složitá filtrovaná nebo maskovaná oblast, se vloží jako obrázek, aby se nic neztratilo. Sada má jednu velikost snímku, převzatou z první stránky.

PowerPoint je také cesta dovnitř: [Rebrand prezentace](/info/rebrand.html) přenese sadu do tvého designového systému a [Import návrhu](/info/design-import.html) ji otevře v Design.

### Penpot

Většina nástrojů, které exportují SVG, exportuje také **soubor Penpot** (`.penpot`), připravený k dalším úpravám v Penpotu.

| Co jsi vytvořil | V Penpotu |
|---|---|
| Text | Upravitelné textové objekty: oprav překlep nebo změň styl |
| Tvary, cesty, přechody a obrázky | Vlastní upravitelné vektorové tvary |
| Barva nebo písmo z tokenu designového systému | Živé propojení tokenu: uprav token a každý tvar, který jej zdědí, ho následuje |
| Celý návrh | Opakovaně použitelná komponenta v panelu Assets |
| Složitá ilustrace nebo živé plátno | Vloženo samostatně jako obrázek, upravitelný obsah kolem něj nedotčen |

Z Design se každý rám stane plochou Penpotu. Barvy a typografie designového systému přistanou v panelu Assets a jeho úplná sada tokenů v panelu Tokens. Penpot odtud drží vlastní kopii: token upravený v Penpotu se vrací importem v [Design System Setup](/info/brand-studio.html).

![Panel exportu s vybraným Penpotem: soubor .penpot a Send to Penpot vedle stahování](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Chceš-li soubor otevřít, spusť Penpot, vyber projekt a zvol **Import**. Přihlášen do Penpotu z panelu exportu, **Send to Penpot** ten krok udělá za tebe.

### Word, OpenDocument a InDesign

**Doc Studio** exportuje **Word** (DOCX) a **OpenDocument** (ODT) se skutečnými odstavci a nadpisy.

**Design** exportuje **InDesign IDML (static subset)**: text, obdélníky, ovály a obrázky PNG nebo JPEG, jedna dvojstrana na kreslicí plochu. Podporované vložené formátování zůstává upravitelné, obrázky putují v `Links` a souřadnice se stanou body InDesignu. Opětovné propojení, náhrada písem a změněné obtékání mohou vyžadovat pozornost. Efekty, animace, složené příběhy a nepodporovaná geometrie export zastaví se zprávou, která je vypíše. IDML nezachovává původní dokument, takže pro hotové dílo pošli PDF.

### Časové osy: dotLottie a Premiere

Z časové osy Design zapíše **dotLottie** animaci, která zůstane upravitelná v nástrojích Lottie; co zachovává, vypisují [Animace Lottie](/info/sequence-editor.html#lottie-animations). **Premiere XML + media** zabalí časované klipy a jejich původní média pro Premiere; viz [Výměna Premiere XML](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (balíčky kurzů)

Export kurzu je vypnutý, dokud nezapneš **Training and courses** v Settings → Preferences → Feature flags.

Pak zvol **Export course** z podporovaného nástroje, složky projektu nebo výběru. V Design zvolení **SCORM (LMS)** a **Download** otevře stejný pracovní postup kurzu. Lolly práci uloží, nechá tě zkontrolovat obsah a pořadí kurzu a pak otevře modul a jeho dialog exportu.

- <!--i:layers--> Vyber ztvárnění pro každý zdroj: statické stránky, pohyb jako video, zvuk nebo stažitelný zdroj. Přidej text lekce a čtecí alternativy v modulu.
- <!--i:clock--> Prohlédni si přehrávač studenta a zkontroluj popisy a titulky. Pohyb je zahrnut jako video, včetně tiché animace.
- <!--i:document--> Vyber Website, SCORM 1.2, SCORM 2004 4th Edition nebo experimentální cíl xAPI. Zkontroluj obsah a velikost ZIP, pak ulož a stáhni zkontrolovanou verzi.
- <!--i:check--> Dokončení vyžaduje potvrzení každé povinné lekce a volbu Finish.

![Exportní panel na sadě Design se zvoleným SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Balíček drží svůj hotový obsah a nepotřebuje účet Lolly. Website ZIP umísti na hostitele HTTP(S); ZIP pro LMS importuj beze změny. Cíl otestuj, než kurz sdílíš. Pro kurz vytvořený z několika uložených tvorb viz [Vytvoř školicí kurz](/info/training-creators.html).

### DXF (soubory pro řezání)

Asset Export, Diagrams, Growth, Logo Wall, QR Code, Street Map, Wayfinding a Wordmark exportují **DXF**, výměnný formát AutoCAD R12, který čtou laserové řezačky, plotry vinylu a software CNC. Geometrie se zapisuje jako obrysové cesty v milimetrech, text je převeden na obrysy a barva se mapuje na nejbližší AutoCAD Color Index, který obvykle řídí operaci řezačky. DXF je jen perokresba: fotografická nebo filtrovaná oblast nemá cestu řezu a vypouští se s varováním. Pro zachování rastrového obsahu použij SVG nebo PDF.

Street Map je nejjasnější případ. Celý návrh je už z tahů, takže každá silnice a kanál se stane cestou řezu.

::: showcase
![Vykreslení Street Map Paříže inkoustem na krémovém podkladu - čistá liniová grafika, takže každý tah přežije cestu k řezačce](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Přejeď a kamera se vzdálí skrz skutečnou geometrii: sedm cest, nikde žádné pixely, každý tah ostrý jako vlásek při jakémkoli přiblížení. To je stejný soubor, jaký čte řezačka.
:::

## Tisk

**Print PDF** zapisuje CMYK proti pojmenované tiskové podmínce, ve výchozím stavu **Coated FOGRA39**. Vzorky značky se změřenými hodnotami inkoustu se převádějí přesně; ostatní barvy používají standardní převod zařízení. **Print TIFF** zapisuje pixely DeviceCMYK pro RIP a zaznamenává stejnou tiskovou podmínku do metadat TIFF. Obojí řídí ovládání Colour profile; podrobnosti jsou v [Barevné profily](#colour-profiles).

**Print marks & bleed** má vlastní kartu na tiskových formátech: spadávka v milimetrech plus Crop, Registration, Bleed, Colour bars a Stamp details.

Některé nástroje sestavují **vícestránkové PDF**: obálku, obsah, který plyne na tolik stránek, kolik potřebuje, a zadní stránku, jako nástroj *Booklet*. Každá stránka je skutečná portrétní stránka PDF v A4, US Letter nebo A5 a libovolný blok můžeš vynutit na novou stránku. Jsou to dokumenty RGB bez ořezových značek a spadávky, které patří jednostránkovému Print PDF. Design PDF může být také **Notes handout**: portrétní stránka pro každý snímek s poznámkami řečníka pod ním.

**Před exportem.** Karta **Before you export** dole v panelu říká, co se tiskárna chystá uvidět: formát, velikost a spadávku, oblasti ořezu a spadávky, pokrytí inkoustem, počty desek a počet stránek, s verdiktem vedle nadpisu. Nikdy export neblokuje. Design kartu ukazuje vždy s vlastními kontrolami, včetně interních pravidel designového systému vrstvu po vrstvě a signálu psaní pro text dokumentu ([Před exportem](/info/design.html#before-you-export)), a tyto tiskové kontroly přidá, když je **Print preflight** zapnuto. V ostatních nástrojích zapni **Print preflight** v Settings → Preferences → Feature flags; ve výchozím stavu je vypnuto a nasazení Lolly Work jej může pro své členy zapnout.

**Po exportu.** Jakmile je soubor hotový, Lolly jej přečte zpět a porovná s tím, co jsi zvolil: formát, velikost v pixelech nebo stránkách, délku klipu, průhledné pozadí, barvu CMYK, HDR, Content Credentials a heslo PDF nebo ZIP. Cokoli, co se liší, se zapíše na exportní kartu. Každé měření pochází ze souboru, nikdy z nastavení, a vlastnost, na kterou soubor nedokáže odpovědět, se nepočítá jako shoda. Příkazový řádek zapíše úplné porovnání pomocí `--export-report` (viz [Vykreslování pomocí CLI](/info/cli-rendering.html)).

Kontroly inspektoru Design a porovnání se značkou v Design System Setup jsou samostatné kontroly: dívají se na návrh, zatímco tyto dvě karty se dívají na soubor.

::: details Náklady z ceníku
Pod kontrolou před tiskem karta nákladů převede stejné počty na peníze, s použitím jen cen, které někdo dodal. Čte tyto počty, i když je samotná karta kontroly vypnutá. Potřebuje dvě věci: úlohu, kterou ceník dokáže ocenit (desky, archy, plochu, stránky, řádky variant nebo výstupní soubory, takže prosté logo PNG ji nikdy neukáže), a **rate card**, ceník JSON od tvé tiskárny. Výchozí sestavení žádný nenese a nemá v aplikaci způsob, jak jej načíst. Ceník přichází jako asset katalogu, který nasazení dodá, nebo přes volitelné rozšíření ceníku, které zapne samostatný provozovatel nebo řídicí rovina. Bez ceníku se nic nezobrazí.

Každá částka je sazba, kterou jsi dodal, krát množství, které Lolly spočítala, například `4 plate × €35.00`, a součet nese svůj zdroj: vydavatele ceníku a datum, z něhož sazby pocházejí. Neexistuje výchozí měna ani zástupná cena. To, co soubor říká sám o sobě, zůstává nepřímou řečí: *"The file says: … Lolly has not verified this."*

Když částku nelze vypočítat, tabulka se stáhne, místo aby se vyplnila:

- Řádky, které karta neoceňuje, znamenají **žádný součet vůbec**, jen nadpis říkající, kolik jich je neoceněných.
- Množství, které je strop, nese **"up to"** do svého mezisoučtu.
- Sazby po datu platnosti ukazují **jen počty**, dokud nestiskneš *Use these rates anyway*; datum vypršení pak jede s částkou.
- Otevřeno přes **odkaz** zůstávají peníze skryté, dokud o ně na tomto zařízení nepožádáš. CLI bere `--rate-card=<file.json>` jako místní soubor a nikdy jako parametr odkazu.

Karta se odstraní z každé fáze exportu, takže soubor nikdy nezmění. Je to aritmetika, ne nabídka; nabídku může dát jen tvá tiskárna.
:::

## Pohyb a zvuk

### Video

Animované nástroje exportují **MP4** a **WebM**. Výběr ukazuje jen kontejnery, které tento prohlížeč umí vytvořit, a sdílený odkaz `?format=`, který žádá takový, jaký nezvládne, přejde na ten druhý, s odpovídajícím názvem souboru. Animované nástroje také nabízejí **Start after**, který na okamžik drží plátno v klidu, aby se animace a písma před nahráváním ustálily, a **Duration**, délku hotového klipu. **Motion blur** (Off, Draft quality, Standard nebo High, s **Shutter angle**) rozmaže rychlý pohyb za cenu času vykreslení. Kde to prohlížeč podporuje, **Record live** nahraje náhled na obrazovce v reálném čase přes sdílení obrazovky.

![Nastavení časování animovaného exportu: Start after, Duration, Motion blur s Shutter angle a Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** vybírá Smaller file, Balanced nebo Best quality. **Advanced** otevře **Codec**, **Frame rate**, **Rate mode** a **Hardware acceleration**. Kde nástroj má titulky, **Captions** vybírá **Embedded track** nebo **Sidecar .vtt + .srt** vedle videa. Odkaz nese kvalitu, kodek, snímkovou frekvenci, délku a počáteční zpoždění jako `vq`, `codec`, `fps`, `seconds` a `wait` ([Parametry URL](/info/url-parameters.html)).

Video exporty si zachovávají zvuk. Nástroj může pod klip položit **music bed**: zvukový asset zacyklený nebo oříznutý na délku klipu, s prolínáním, hlasitostí a ducking pod vlastním zvukem záznamu. Nahrávací nástroje přenášejí svůj živý zvuk až do souboru.

Sada Design, která zůstává klikací, může přesto odejít jako video. **Export slides as video** v nabídce Present otevře list exportu na MP4. Každý snímek hraje svou vlastní prodlevu, nebo Duration listu exportu, když žádnou nemá, a přechod snímků sady hraje mezi nimi jako prolnutí. Samotný dokument se nemění.

### Animované obrázky

**GIF** se přehraje všude a hodí se do chatu a e-mailu; je větší a má méně barev než video. **APNG** a **Animated WebP** zachovávají plnou barvu a průhlednost. **Lottie Ad** také exportuje **Animated SVG**: vektorové snímky s vloženými klíčovými snímky CSS, takže se škáluje na libovolnou velikost a smyčkuje na kartě prohlížeče nebo v `<img>` bez kodeku. Jeho text je převeden na obrysy a používá nižší výchozí snímkovou frekvenci, protože každý snímek je těžší než bitmapa. Všechny jsou bez zvuku.

### Zvuk

Některé nástroje exportují samotný zvuk. **Voice Recorder** zachytí záznam z mikrofonu s živým měřičem úrovně a uloží jej jako **MP3**, **WAV**, **M4A (AAC)** nebo **Opus (WebM)**, kódované na tvém zařízení. `wav`, `mp3`, `m4a` a `opus` jsou běžná id formátů, takže zvukový export je stejně sdílitelný a skriptovatelný jako PNG.

Výběr assetů přijímá širokou škálu zvuku pro music bed, od MP3 a FLAC po MIDI a tracker moduly; [Formáty](/info/formats.html) je vypisují. [Píseň Rondocode](/info/rondocode.html) hraje v jakékoli délce, kterou její klip žádá.

## Barva a HDR

Lolly čte každou moderní barvu CSS, počítá barvy percepčně a každý soubor zapisuje v prostoru, který čtenář otevře: sRGB pro obrazovky, CMYK pro tisk a Rec.2100 PQ pro HDR. [Barva v enginu](/info/colour-engine.html) vysvětluje jak. Dokument Design nastavený na **Wide colour / HDR** se řídí vlastními pravidly popsanými v [Úpravy široké barvy a HDR](/info/hdr-editing.html).

### Barevné profily

Exporty jsou označeny barevným profilem, takže aplikace se správou barev, jako tiskárny, Photoshop a prohlížeče, čtou barvy tak, jak jsi je viděl. Děje se to automaticky; miniatury a náhledy značku vynechávají, aby zůstaly malé.

- **PNG a JPG** nesou vložený profil ICC **sRGB**, prostor, v němž se náhled kreslí. Pixely jsou označeny, ne překódovány.
- **Print PDF (CMYK)** deklaruje svou tiskovou podmínku v *OutputIntent*, což tiskárně říká, jak mají být čteny jeho inkousty CMYK.
- **Print TIFF (CMYK)** zapisuje neoznačené pixely DeviceCMYK a zaznamenává tiskovou podmínku do metadat TIFF. TIFF nemůže vložit tiskový profil, takže řádek **Embed** zaznamenává jen název toho profilu.
- **TIFF (RGB)** je nekomprimovaný sourozenec sRGB pro archiv nebo oběh přes editor. Zploští průhlednost na bílou. Oba TIFF jsou jen pro desktop, protože prohlížeče TIFF zobrazit nemohou.
- **SVG**, **EMF**, **EPS** a **DXF** jsou vektory bez vloženého profilu: barvy SVG jsou sRGB, EMF a EPS používají zařízení RGB, **EPS (CMYK)** zapisuje DeviceCMYK a DXF používá AutoCAD Color Index. SVG, EPS a DXF převádějí text na cesty. EMF drží text živý a upravitelný v Office a Google Slides, s náhradou obrysy jen pro úseky, které formát nevyjádří; volba **Outline fonts** v panelu exportu vynutí cesty všude. SVG také reprodukuje stíny polí CSS, uvnitř i vně.

::: details PDF/X-4 a tvůj vlastní tiskový profil
Žádný profil CMYK se s Lolly nedodává. Pojmenovaná tisková podmínka zapíše výstupní záměr bez tvrzení o souladu s PDF/X-4, protože PDF/X-4 chce profil vložený.

Načti vlastní profil CMYK a zvol jeho řádek **Embed** v ovládání Colour profile. Vloží se jako *DestOutputProfile* souboru a PDF tvrdí PDF/X-4, kdykoli to zbytek souboru dovolí. Tisková podmínka, kterou deklaruje, se čte z toho profilu: registrované jméno, kde ho profil dokazuje, nebo `Custom` pod vlastním jménem profilu.

Tři věci zadrží tvrzení při zachování výstupního záměru: umělecké dílo RGB, které průchod CMYK nedokázal převést, text uznání `prov` s okrajem pro zkoušku (kreslený standardním písmem, které není vloženo) a heslo **Strong**, protože PDF/X-4 šifrování zakazuje. Každé PDF také nese metadata PDF/X-4: boxy stránky, XMP, ID dokumentu a výstupní záměr sRGB s jeho profilem.
:::

### HDR (jasné barvy)

Toto je karta **HDR** panelu exportu, která zjasňuje běžné umělecké dílo pro obrazovky HDR. Zachování originálů HDR při úpravách je jiná funkce: [Úpravy široké barvy a HDR](/info/hdr-editing.html).

Běžný export je sRGB: sytá barva značky je stejně jasná jako běžná bílá obrazovky. Displej HDR má nad tím rezervu. Karta **HDR** zesílí barvy tvé značky a bílý text směrem k nejvyššímu jasu, zatímco tmavé oblasti zůstávají tmavé a dávají záři kontrast.

![Karta HDR v exportním panelu, zapnutá, s odhalenými ovladači White / Reach / Dark lift / Focus pod ní](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formáty.** PNG, JPG, AVIF a TIFF. WebP je 8bitový bez funkční cesty dekódování HDR a vektory a PDF nemají žádný model HDR.
- **Ve výchozím stavu vypnuto,** protože mění pixely. Zaškrtni kartu nebo předej `hdr=1` ve sdíleném odkazu.
- **Ciferníky.** **White** (strop nejvyššího jasu, 400 až 2000 nitů), **Reach** (jak daleko do tónů se záře šíří), **Dark lift** (jak moc se tmavé zjasní; `0` je nechá tmavé) a **Focus** (kolik bohatosti barev zesílení zachová). Putují jako jedna hodnota: `hdr=1600-60-0-50` je White 1600, Reach 60, Dark lift 0 a Focus 50.
- **Co se zapisuje.** PNG dostane 16bitový Rec.2100 PQ s chunkem `cICP`. JPG je JPEG s mapou zisku ISO 21496-1: běžný obrázek SDR plus připojená mapa zisku. AVIF dostane přepsaný box `colr`. TIFF dostane pixely PQ s vygenerovaným profilem ICC v4 nesoucím značku `cicp` a zploští se na černou, protože bílá je v PQ kód 10 000 nitů a obklopila by každou hranu svatozáří. Zesílení sleduje percepční (OKLab) světlost a zachovává odstín, takže zelená značky je jasnější, ne mátová.
- **Kde se záře ukáže.** V prohlížečích se správou barev na displeji HDR: Preview, Quick Look a Safari na zařízeních Apple, nebo Chrome na monitoru HDR. Obrazovka SDR ukáže normální obraz.
- **Než to odešleš.** Mnoho platforem nahrávky překódovává a signál HDR odstraňuje, což může obraz nechat tmavý nebo vyprané. Použij HDR tam, kde cíl ovládáš, například na vlastním webu, videozdi nebo prezentaci na jasném panelu.
- **Z terminálu.** `--hdr=1` s `--export=png` nebo `--export=jpg` zapíše stejný PNG a JPEG s mapou zisku v [CLI](/info/cli.html), ze stejných enkodérů enginu, bez prohlížeče v cestě. AVIF a TIFF zatím zůstávají webovými exporty.

## Co putuje se souborem

Hotový soubor může nést vedle obrázku několik záznamů. Některé jedou vedle pixelů a zmizí, když se soubor znovu uloží nebo očistí; dvě značky žijí přímo v pixelech.

::: figure exporting-what-travels
Kde každý záznam žije, zda je ve výchozím stavu zapnutý a který parametr odkazu každý z nich řídí.
:::

Panel exportu sbalí **Licence**, **Source credits**, *Password protect*, **C2PA Credentials**, **Lolly Imprint** a **Durable credential** do jedné skupiny **Content protection**, která ukazuje jen karty, které zvolený formát může použít. Otevře se sama, když odkaz nebo dokument už deklaruje licenci, nebo když zdroj potřebuje tvé rozhodnutí. Karta **Design system** zůstává mimo skupinu, na očích při každém exportu.

![Skupina Ochrana obsahu otevřená u exportu PNG, zobrazující jen karty, které se na něj vztahují](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenience a vodoznak

Kde formát pole má, nesou exporty **metadata proveniencie**: software, zdroj, jméno nástroje a řádek s uvedením z tvého profilu, zapsané do PNG iTXt, JPEG EXIF, informací PDF, `<metadata>` SVG nebo komentáře GIF. Zaznamenává jen autorství a nic se nenahrává. **Experimentální** nástroje také razítkují viditelný vodoznak, aplikovaný hostitelem, takže úprava nástroje značku nemůže odstranit.

**Lolly Imprint** je neviditelný pixelový vodoznak, **ve výchozím stavu zapnutý**. Credential a metadata putují vedle pixelů a ztratí se novým uložením, snímkem obrazovky nebo odstraněním metadat. Imprint žije v pixelech a přežije rekompresi, takže kopii lze stále rozpoznat jako vytvořenou v Lolly. Je to nápověda, ne kryptografická záruka, a nenese žádné osobní údaje. Jede v JPEG XL, PNG, JPG, WebP, AVIF, TIFF a BMP a v rastrech, které Lolly vykreslí do PDF nebo PPTX, nikdy v obrázku, který jsi vložil. Zruš zaškrtnutí **Lolly Imprint** nebo předej `imprint=0`, aby se Imprint vynechal. Přežití AVIF při překódování zatím není kalibrováno. [Verify](/verify) jej detekuje na tvém zařízení; viz [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** zapisuje id Lolly do pixelů neuronovým modelem na zařízení ve formátu TrustMark, takže odkaz "made with Lolly" přežije odstranění metadat i překódování a mohou jej číst nástroje znalé TrustMark. Je **ve výchozím stavu vypnutý**, protože stojí neuronový průchod na export a jednorázové stažení modelu. Pokrývá PNG, JPG, WebP, AVIF a TIFF; zaškrtni jej v panelu nebo předej `durable=1`. Desktopové a mobilní aplikace kartu skrývají, protože nemají původ, z něhož by model offline stáhly.

**Licence.** Vyber, jak mohou ostatní tvou práci používat: *None (all rights reserved)* ve výchozím stavu, CC0 1.0, Public Domain Mark 1.0 nebo licence Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Jméno licence a odkaz na její deed se zapíší do metadat licence souboru (EXIF, XMP a RIFF, kde je formát má) a do jeho Content Credential. Volba se ukládá s dokumentem a putuje v odkazu jako `licence=`. Lolly zapíše licenci, kterou jsi zvolil; podmínky nekontroluje ani nevynucuje. Nástroj s vlastním polem licence, například Claim, ponechá místo toho to pole.

### Záznam designového systému

Export zaznamenává designový systém, který soubor vytvořil: jeho jméno, zveřejněnou verzi, z níž byl kreslen (když to není pracovní verze), a [colourway](/info/colourways.html), v němž byl kreslen. Jakákoli jiná volba motivu, kterou designový systém deklaruje, například hustota, se zaznamenává stejně. Volba světlý či tmavý se vynechává, protože obrázek už ukazuje, která byla použita.

**Záznam vidíš, než se cokoli zapíše.** Karta **Design system**, ve výchozím stavu zaškrtnutá, ukazuje přesná slova, která soubor ponese, například *Records: Acme · Colourway: Beach*, a popis, jak se bude číst. Jméno designového systému je to, co napsali jeho vlastníci, takže ho karta ukazuje tak, jak je psáno. Zruš zaškrtnutí karty, aby se záznam z toho exportu vynechal. Panel dokumentu Design uvádí stejná slova pod *Embedded in exports*.

**Popis uvádí colourway vedle nástroje.** Se zaškrtnutou kartou se *"Made with https://lolly.tools : Chart"* změní na *"Made with https://lolly.tools : Chart (Beach colourway)"*. Jméno samotného designového systému zůstává v záznamu, ne v popisu. Popis bez názvu nástroje nebo takový, který nástroj píše ze svých vstupů, zůstává, jak je. Nástroj, který colourways ignoruje přes `tokenAxes`, žádný nezaznamenává a stejné pravidlo sleduje i PDF proof credit (tisková značka `prov`).

**Dovednosti značky, které vedly agenta.** Když agent vytvořil kus a pojmenoval [dovednosti značky](/info/brand-skills.html), které četl a dodržel, záznam také uvádí každou dovednost s její revizí, například *Guided by: acme-brand 1.0*. Slova znamenají, že dovednost vedla práci. Není to kontrola: Lolly kus proti dovednosti netestuje. Seznam přidá jen vlastní prohlášení agenta, což dnes znamená argument `brandSkills` v `lolly_render` [serveru MCP](/info/mcp.html), takže kus vytvořený v aplikaci nebo ze sdíleného odkazu žádný nenese. Content Credential drží seznam jako `brandSkills`, jednu hodnotu JSON s id, jménem, revizí a hashem SHA-256 každé dovednosti. Balíček XMP a metadata SVG drží stejnou hodnotu jako `lolly:BrandSkills`, PDF zapsané ze záznamu získá jedno klíčové slovo na dovednost a popis zůstává, jak byl. Interní dovednost se zaznamenává podle id, jména, revize a hashe, nikdy podle svého textu. Stejné přepínače seznam vynechají s ostatním záznamem: karta **Design system**, `_madewith=0`, `--no-madewith` a `madeWith: false`. Když server MCP kreslí soubor v prohlížeči (PDF, JPEG a další formáty, které jeho cesta bez prohlížeče nezapíše), metadata samotného souboru žádný seznam nedrží a může jej držet jen Content Credential. Předej `c2pa`, aby se záznam zachoval; bez credential vykreslení varuje, že dovednosti značky nebyly zaznamenány.

**Čtení záznamu zpět.** [Verify](/verify) vypisuje záznam jako **Design system** v podrobnostech credential souboru a všechny dovednosti značky jako **Guided by**. *Recreate with these settings* znovu otevře nástroj v zaznamenané verzi a colourway. Odkaz se otevře se zaznamenaným designovým systémem, pokud toto zařízení drží systém se stejným id a jménem; jinak se otevře s tvým aktivním designovým systémem.

::: details Co se zapisuje kam a které běhy záznam vynechávají
| Kam | Co se zapisuje |
|---|---|
| Content Credential | `designSystem` (id), `designSystemLabel`, `designVersion` a `themes` v tvrzení `tools.lolly.export`, každé prostá textová hodnota; `themes` je seznam voleb v JSON |
| PNG, JPEG, WebP a JXL | Stejné čtyři hodnoty jako vlastnosti `lolly:` balíčku XMP souboru, ve jmenném prostoru `https://lolly.tools/ns/export/1.0/` |
| SVG | Stejné vlastnosti `lolly:` uvnitř bloku `<metadata>` |
| PDF | Klíčová slova jako *Design system: Acme* a *Colourway: Beach* |
| Každý formát s polem popisu | Popis s colourway vedle nástroje |

Karta se objeví jen tehdy, když je co zaznamenat a formát může záznam držet. CSV, JSON, soubor kalendáře a další textové nebo datové formáty metadata nedrží a EPS, EMF, DXF a BMP nemají pro záznam pole. HTML, Markdown a CSS drží záznam jen ve svém Content Credential, takže pro ně karta neukazuje řádek popisu a skryje se, dokud je **C2PA Credentials** vypnuto. Pole, které designový systém nedává, zůstává mimo soubor.

Sdílený odkaz záznam vypne pomocí `_madewith=0` ([Parametry URL](/info/url-parameters.html)); příkazový řádek bere `--no-madewith`, `lolly_render` [serveru MCP](/info/mcp.html) bere `madeWith: false` a panel exportu terminálové aplikace má řádek **Design system**. Příkazový řádek vypíše slova, která hotový soubor nese, na standardní chybový výstup, pro vykreslení nástroje i pro každý soubor, který `lolly run` exportuje z uložené relace Design, a vykreslení MCP je vypíše vedle souboru, obojí čtené zpět ze souboru. PNG, které příkazový řádek nakreslí bez prohlížeče, nenese žádná metadata souboru, takže jeho záznam putuje jen v credential. Utility na zařízení nepřidávají žádná metadata.

Běhy bez karty **Design system** záznam vynechávají: běh Batch, složka exportovaná z Projects a export kolekce 3D a v terminálové aplikaci dávka CSV, export složky či výběru z Projects a zobrazení render-everything. Exportuj jeden soubor z nástroje, aby se designový systém zaznamenal.
:::

### Content Credentials (C2PA)

Exporty mohou nést **Content Credentials**: podepsaný manifest [C2PA](https://c2pa.org), který zaznamenává, co soubor vytvořilo, kdy a kde, vázaný na hash bajtů souboru, takže jakákoli pozdější úprava je odhalitelná. Specifikaci publikuje C2PA a Lolly zapisuje standardní manifesty, které může zkontrolovat libovolný čtenář C2PA.

![Karta C2PA Credentials, zaškrtnutá, s platností credential vedle zaškrtávacího políčka](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Ve výchozím stavu zapnuto.** Karta **C2PA Credentials** je předvybraná pro téměř každý nástroj. Zruš zaškrtnutí pro jeden export, nebo předej `c2pa=off` v odkazu. Nástroj se může odhlásit ve svém manifestu.
- **Formáty.** PDF (RGB a Print), PNG a APNG, JPG, GIF, SVG, TIFF (RGB a Print), WebP (statický i animovaný), AVIF, MP4, WebM, zvukové kontejnery MP3, WAV, M4A, OGG/Opus a FLAC a HTML, Markdown a CSS. ZIP razítkuje každého podporovaného člena, tak získá credential i Animated SVG. MP4, AVIF a M4A používají standardní vazbu BMFF a MP3 své mapování ID3v2, takže `c2patool` a další čtenáři je ověří. WebM a OGG/Opus zatím nemají standardní mapování, takže Lolly nese manifest jako přílohu Matroska a pole OpusTags, které ověřuje vlastní ověřovač Lolly. ICO, EPS, EMF, DXF, BMP, PPTX, formáty Office a další textové a datové formáty nemají kontejner C2PA.
- **Co zaznamenává.** Nástroj a aplikaci, které soubor vytvořily, čas podpisu, shell, který jej exportoval, [designový systém a colourway](#the-design-system-record), dokud je zaškrtnutá karta **Design system**, a otisky aktivních vstupů. Text vstupů, pole vázaná na profil, neaktivní ovládací prvky, verze prohlížeče a údaje o operačním systému se vynechávají. Tvé jméno a e-mail se objeví jako autor jen tehdy, když je zapnuto **Use my details to create** v Settings → Preferences → Your details. Zdroje, které export umístí, putují jako ingredience: [připsaná díla](#source-credits) jako emoji a [písně Rondocode](/info/rondocode.html#songs-in-the-credential) ve video nebo audio exportu.
- **Co vidí příjemci.** Nástroje C2PA jako aplikace Adobe, `c2patool` a contentcredentials.org/verify čtou manifest a ukazují tvrzení. Lolly podepisuje klíčem vytvořeným na tvém zařízení, ne certifikátem ze seznamu důvěry, takže prohlížeče hlásí *unverified* credential: struktura a odhalitelnost úprav jsou skutečné, za podepisovatele se nikdo neručí. Aby se to změnilo, zapiš **verified identity** v Settings → Preferences → Content Credentials; viz [Content Credentials Identity](/info/content-credentials-identity.html).
- **Kontrola souboru.** Přetáhni jakýkoli soubor na [Verify](/verify) nebo spusť `lolly validate <file>` pro zprávu na zařízení, která začíná tím, zda soubor vytvořila Lolly a zda se od té doby změnil. Verify se dívá i za credential; viz [Co Verify kontroluje](/info/what-verify-checks.html).
- **Soukromí.** Podpisový klíč se vytváří pro export a nikdy neopustí tvé zařízení a tvrzení drží jen to, co už nesou metadata proveniencie. Utility ochrany soukromí, které transformují tvé vlastní soubory, nepřidávají žádný credential a *Strip Hidden Data* odstraňuje manifest C2PA jako jakákoli jiná metadata. Utilita Rondocode vytváří nový zvuk, takže podepisuje, co zapisuje ([Písně Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)).
- **Interakce.** PDF chráněné heslem nemůže nést Content Credentials, v žádné úrovni. Credential se přidává jako poslední, přes hotové bajty, po DPI, EXIF, barevném profilu, metadatech PDF/X a tiskových značkách.

### Kredity zdrojů

Export, který umístí cizí dílo, zaznamená ten zdroj v credential. Emoji nakreslené ze zvolené sady emoji je běžný případ: dílo, jeho tvůrce, licence, odkud přesné bajty pocházejí a co se změnilo, vše putuje se souborem. Text v nástroji, jehož šablona je SVG, ponechává emoji systému, takže se tam nic neuvádí. Řádek **Source credits** říká, co zdroje žádají od doručení, než stáhneš, a po stažení čte doručené bajty zpět, než řekne, že uvedení je v souboru. Licence, která žádá o volbu, například přebarvený glyf CC BY-SA, který se chystáš sdílet, dostane kartu s možnostmi; stažení se nikdy neblokuje. Formulace, přezkoumané licence a to, co zůstává tvé, uvádí [Tvůrčí práva a uvedení autorů](/info/creative-rights.html).

## Ochrana heslem

Dva druhy zámku, oba vytvořené na tvém zařízení. Obojí řídí karta *Password protect* panelu exportu.

![Karta Password protect rozbalená u exportu PDF, s polem pro heslo a dvěma úrovněmi zámku](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Heslo pro otevření PDF** má po napsání hesla dvě úrovně:

- **Weak**: 40bitové RC4, odstrašení, ne ochrana. Jeho heslo může putovat ve sdíleném odkazu, v čitelném textu. Jen RGB `pdf`.
- **Strong**: AES-256 (PDF 2.0). Píše se při exportu a nikdy se nevkládá do odkazu. Vztahuje se i na Print PDF a na každé PDF uvnitř dávkového ZIP. Print PDF zamčené Strong zachová CMYK, značky a výstupní záměr, ale ztrácí tvrzení PDF/X-4.

**Zamčené ZIP** pokrývá export ZIP, stažení složky z Projects nebo dávky, s jedním heslem ve dvou úrovních: **Weak** (ZipCrypto, odstrašení; může putovat v odkazu `?password=`) nebo **Strong** (AES-256, píše se při exportu, nikdy v odkazu). Heslo chrání každého člena a jakékoli PDF uvnitř je navíc samo zamčeno AES-256, takže zůstane zamčené po rozbalení ZIP. Výzva se objeví při zahájení stahování; prázdné heslo znamená žádný zámek.

**Sdílený odkaz chráněný heslem** žádá příjemce o heslo před otevřením. Celý stav odkazu je zašifrován AES-256 pod klíčem odvozeným z hesla (PBKDF2), takže putuje jen šifrovaný text a dešifrování probíhá v prohlížeči příjemce. Server, který odkaz poskytuje, heslo ani návrh nikdy nevidí. Zapni to v dialogu **Share**. Šifrovaný odkaz se otevře jen v Lolly, nikdy jako vložený obrázek. Viz [Režim URL](/info/url-mode.html).

## Na telefonu

Ovládací prvky exportu sedí za plovoucím tlačítkem **Export**, které otevře list **Export**: stejné formáty, velikost, kopírování, stažení a sdílení, ve velikosti pro dotyk.

## ID formátů pro odkazy a CLI

Toto jsou hodnoty pro parametr URL `format=` a příznak CLI `--export=` (viz [Parametry URL](/info/url-parameters.html) a [CLI](/info/cli.html)). Nabídka nástroje ukazuje jen formáty, které ten nástroj umí vytvořit, takže je vždy kratší než tento seznam.

| Druh | ID |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (SVG v gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (soubor pro řezání) |
| Stránka a dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (návrhový soubor Penpot) · `scorm` (balíček kurzu, ZIP) |
| Pohyb | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Zvuk | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` |
| Text a data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `css` · `scss` · `gpl` (paleta GIMP) |
| Balíky a balíčky | `zip` · `rpm` a `tar.gz` (vykreslení zapečetěné do balíčku Linuxu) |

Několik id pochází z vlastního exportního kódu nástroje: `ase` (Adobe Swatch Exchange, z Palette Lab) a `exr` a `hdr` (rastry s vysokým dynamickým rozsahem, z Darkroom). **Convert Font** zapisuje `ttf`, `otf` a `woff` ze souboru písma, který dodáš, takže holý odkaz nemá co vykreslit.
