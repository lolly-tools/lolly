# Export souboru

Stiskni **Export**, levou polovinu pilulky **Export | Save**, vyber formát vedle názvu souboru a stiskni **Download**. Soubor se vytvoří na tvém zařízení.

Soubor obsahuje to, co vidíš na plátně. Nabídka formátů vypisuje jen to, co tento nástroj v tomto prohlížeči umí vytvořit.

Většina úloh potřebuje jeden ze tří formátů:

| Pro | Zvol | Protože |
|---|---|---|
| Obrazovku, zprávu nebo snímek | **PNG** | Otevře ho každá aplikace a zachová průhledné pozadí, pokud ho nástroj nabízí |
| Hotovou stránku nebo cokoli tištěného | **PDF** | Skutečná velikost stránky, která se vytiskne tak, jak vypadá; **Print PDF**, pokud ho nástroj nabízí, je CMYK verze pro tiskárnu |
| Grafiku, která musí zůstat ostrá v jakékoli velikosti | **SVG** | Vektorové tvary |

::: check Zkontroluj soubor ve velikosti, ve které se použije
Než soubor pošleš, otevři ho na obrazovce, pro kterou vznikl, nebo ho vytiskni ve skutečné velikosti.
:::

::: details Schvalování a doručení s Lolly Work (volitelné)
[Organizace provozující Lolly Work](/info/organisation.html) může vybírat, které formáty a nastavení exportu její členové vidí. Kde je vyžadováno schválení, nahradí **Request approval** tlačítko **Download**. Řiď se politikou, kterou tvá instance ukazuje.

Lolly Work může také doručit soubor do nakonfigurovaných cílů S3, WebDAV a HTTP, s kroky schvalování, potvrzeními o doručení a auditním záznamem. Toto doručení pošle soubor službě organizace. Běžné stažení zůstává na tvém zařízení. Osobní cíle Send a doručení organizace se konfigurují odděleně.

Provozovatelé to nastavují podle [průvodce doručením organizace](/info/work-delivery.html). Pro serverová vykreslení ve frontě a dávky viz [Dávky a automatizace CLI](/info/cli-automation.html#organisation-jobs-with-lolly-work).
:::

<!--i:eti-cpu-->
## Jak export funguje

Soubor vzniká třemi cestami. Většina nástrojů **vykresluje plátno**. Textové a datové formáty (HTML, Markdown, TXT, JSON, CSV, ICS, VCF) se **generují z obsahu nástroje**. Utility ochrany soukromí, například *Lolly Strip Hidden Data*, **transformují vybraný soubor** na tvém zařízení. Výsledek nemá plátno, vodoznak ani přidaná metadata.

![Tři cesty exportu se sbíhají do hotového souboru: vykreslení plátna, generování textu nebo dat z obsahu nebo transformace vybraného souboru na zařízení.](/info/diagrams/concepts/three-export-paths.svg)

Autor nástroje vybírá, které akce panel exportu nabízí. Výchozí sada je Copy, Download a Save.

- <!--i:download--> **Download** uloží soubor. Pokud ho pak nemůžeš najít, viz [Najdi stažený soubor](/info/find-your-work.html#find-a-file-you-downloaded).
- <!--i:photos--> **Copy** vloží obrázek do schránky. Kde prohlížeč nemůže kopírovat obrázky, Copy místo toho soubor stáhne a řekne ti to.
- <!--i:folder--> **Save** uchová aktuální návrh v Projects a nikdy nestahuje soubor. **Save as** vedle **Download** se ptá kam (viz [Ukládání a pokračování](/info/using.html#saving-continuing)).
- <!--i:link--> **Share** otevře dialog Share: odkaz, který reprodukuje návrh, přepínače při návštěvě (celá obrazovka, panel exportu, stažení nebo kopírování při otevření) a volitelný **Shortest link**, který zabalí stav do kompaktního tokenu (viz [Režim URL](/info/url-mode.html)).

Karta **Send to** v panelu exportu pošle soubor do služby, kterou jsi připojil. Po odeslání do Google Drive, Nextcloud, bucketu S3, Dropbox nebo OneDrive může **Create a share link** vytvořit odkaz v dané službě bez dalšího nahrávání. Sekce **Share through your cloud** v dialogu Share pošle soubor `.lolly` a vytvoří jeho odkaz v jednom kroku. Panel odkazu ukazuje, kdo ho může otevřít, kde je soubor uložený a kdy odkaz vyprší. **Links you've shared** v dialogu Share umožňuje sdílení ukončit. Odkazy Nextcloud mohou mít heslo a datum vypršení. Odkazy S3 platí 1 až 7 dní a nelze je ukončit předčasně. Lolly neuchovává na serveru kopii souboru ani přihlašovací token. [Soukromí](/info/privacy.html#every-network-request-the-app-can-make) uvádí, co jednotlivé služby dostávají.

![Panel exportu - formát, velikost a akce Copy / Download / Save / Share](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Když návrh vkládá vykreslení jiného nástroje, například obrazové pole Lolly Design s odkazem QR Code, export rodiče vykreslí i vnořený obsah. V SVG a PDF zůstává vektorový a v PNG, JPG a WebP se rasterizuje. Vložené vykreslení nedostane vlastní vodoznak ani provenienci; dostane je jen hotový soubor. Exporty HTML, Markdown a TXT nemohou obsahovat složené vykreslení.

<!--i:eti-file-->
## Vyber formát

Název souboru a nabídka formátů tvoří jednu dvojici `name.format` pod **Download**.

![Pole názvu souboru spojené s výběrem formátu, takže export tvoří jednu dvojici name.format](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

Začni tím, kam soubor míří. Každá karta vypisuje formáty vhodné pro daný cíl.

::: figure exporting-format-chooser
Šest cílů a formáty vhodné pro každý z nich.
:::

Wordmark vysázený písmem tvého designového systému se exportuje jako SVG s každým písmenem převedeným na obrysovou cestu. Soubor zůstává ostrý v jakékoli velikosti.

Text v jiném jazyce závisí na písmech, která máš. Když písmo v tvém designovém systému obsahuje dané znaky, SVG a PDF je vykreslí jako obrysy, vysázené a v pořadí čtení, včetně řádků zprava doleva. Když je neobsahuje žádné, Lolly použije [záložní písmo](/info/fallback-fonts.html) a karta exportu toto písmo ukáže. Text, který nepokrývá žádné záložní písmo, zůstává v SVG živým textem vykreslovaným vlastními písmy prohlížeče. V PDF, EPS nebo WMF a v EMF se zapnutým **Outline fonts** se tento text stává obrázky. Tato slova vypadají stejně jako na stránce, ale nejdou vybrat ani vyhledat. Karta exportu vypíše tyto znakové sady. Přidej písmo s danými znaky, aby zůstaly vektorovým textem.

![Wordmark Aurora s vlasovými tahy a širokým prostrkáním, příklad čistě vektorové grafiky z řádku SVG v tabulce](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&filename=vt-wordmark-vector)

::: details Každý formát a k čemu slouží
| Chceš | Použij | Proč |
|---|---|---|
| Ostrá loga nebo grafiku, která se škáluje | **SVG** | Vektor: škálovatelný, malý a upravitelný; efekt, který vektorový export neumí vykreslit, se vloží jako obrázek |
| Vektor pro Office a aplikace Windows | **EMF** | Vloží se jako upravitelný vektor do PowerPoint a Word s živým textem; Google Drive ho otevře v Google Drawings |
| Vektor pro tisk a návrhové aplikace | **EPS** nebo **EPS (CMYK)** | Vektor PostScript pro Illustrator a tiskové postupy |
| Vektor pro řezací stroje | **DXF** | Laserové řezačky, plotry na vinyl a CNC: obrysové cesty v milimetrech |
| Upravitelnou sadu snímků | **PowerPoint** (PPTX) | Nativní upravitelný text a tvary, obrázky a vektory lze extrahovat |
| Upravitelný textový dokument | **Word** (DOCX) nebo **OpenDocument** (ODT) | Odstavce a nadpisy, které textový procesor může dál upravovat (Lolly Doc Studio) |
| Rozvržení pro InDesign | **InDesign IDML (static subset)** | Text, obdélníky, ovály a obrázky, jedna dvojstrana na kreslicí plochu (Lolly Design) |
| Upravitelný dokument Penpot | **Penpot** | Plochy, tvary, text a propojené tokeny |
| Fotku nebo běžný obrázek | **PNG** (bezeztrátový) nebo **JPG** (menší) | Univerzální rastr |
| Menší moderní obrázky | **WebP** nebo **AVIF** | Lepší komprese s průhledností |
| Tisk | **PDF** nebo **Print PDF** (CMYK) | Skutečná velikost stránky; CMYK pro tiskárnu |
| Rastr pro tiskárnu | **Print TIFF** (CMYK) | Pixely DeviceCMYK pro RIP |
| Animaci pro web | **GIF** | Přehraje se všude; větší soubory |
| Animaci s plnými barvami a skutečnou průhledností | **APNG** | Animované PNG: bez omezení palety |
| Animaci s nejmenším souborem | **Animated WebP** | Plné barvy a průhlednost, menší než GIF nebo APNG |
| Animovaný vektor, který se škáluje | **Animated SVG** | Samostatný; přehrává se ve smyčce v prohlížeči nebo `<img>` v libovolné velikosti (Lottie Ad) |
| Animaci, která zůstane upravitelná | **dotLottie** | Tvary, cesty a vnější klíče transformací z časové osy Lolly Design |
| Předání do Premiere | **Premiere XML + media** | Časované klipy a původní média pro Premiere (Lolly Design) |
| Video pro sociální sítě a sdílení | **MP4** nebo **WebM** | Nejlepší kvalita vzhledem k velikosti souboru (viz [Video](#video)) |
| Titulky | **SRT** nebo **VTT** | Časovaný text pro přehrávač videa (Captions, Audiogram a Record) |
| Vysílací titulky | **TTML** nebo **SCC** | Časovaný text IMSC1.1 nebo titulky pop-on CEA-608 (Captions; viz [Vysílací titulky](#broadcast-captions)) |
| Školicí kurz | **SCORM (LMS)** | Verzovaný web, balíček SCORM nebo xAPI (viz [SCORM](#scorm-course-packages)) |
| Formátovaný text nebo e-mailový podpis | **HTML** | Vloží se formátovaně do e-mailových klientů |
| Animaci přehrávanou v prohlížeči | **HTML** | Přehrávač v jednom souboru z časové osy Lolly Design nebo ze Snippet (viz [Video](#video)) |
| Prostý obsah | **MD** nebo **TXT** | Jen text |
| Událost v kalendáři | **ICS** | Import do libovolné kalendářové aplikace |
| Kontaktní kartu | **VCF** | Import do adresářů |
| Strukturovaná data pro opětovný import | **JSON** nebo **CSV** | Umožňuje export a zpětný import obsahu nástroje |
| Ikonu webu | **ICO** | Ikona webu ve více velikostech; **ZIP** sdružuje několik formátů |
:::

### Průhlednost

Nástroje, které ji podporují, nabízejí přepínač průhledného pozadí, například **No BG**. PNG, WebP, AVIF, SVG, APNG a Animated WebP zachovávají průhlednost a GIF zachovává ostrý okraj. JPG a PDF jsou vždy neprůhledné. TIFF se sloučí s bílým pozadím nebo s černým při použití [HDR](#hdr-bright-colours).

<!--i:eti-crop-->
## Velikost a tiskové jednotky

Exporty používají nativní velikost nástroje v pixelech, pokud nástroj nenabízí **rozměry**. Pak nastavíš šířku, výšku a **jednotku**:

- **px** (výchozí) udává přesný počet pixelů.
- **mm, cm, in, pt** a **pc** jsou fyzické rozměry. S fyzickou jednotkou nastavuješ i **DPI** (výchozí je 300). **PDF** se stane skutečnou stránkou dané velikosti. **Rastr** dostane počet pixelů pro dané DPI a zaznamená rozlišení. **SVG** si ponechá fyzickou jednotku s viewBox v pixelech.

Pro rastr s vyšším rozlišením zadej větší šířku a výšku nebo zvol fyzickou jednotku a zvyš DPI (pixely = velikost × DPI). Šířka `210`, výška `297` a jednotka `mm` vytvoří stránku A4.

![Řádek rozměrů nastavený na 210 na 297 mm s viditelným polem DPI, protože jednotka je fyzická](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

<!--i:eti-images-->
## Statické snímky z časované kompozice

Z časované kompozice, například časové osy [Sequence](/info/sequence-editor.html) v Lolly Design, vezme statický export **snímek na pozici přehrávací hlavy**. Umísti přehrávací hlavu tam, odkud chceš obrázek, a exportuj.

Pro více okamžiků použij pole **Frames** vedle výstupní velikosti. Zobrazuje se jen u časované kompozice a statického formátu (PNG, JPG, WebP, SVG nebo PDF). `1` vrátí snímek na pozici přehrávací hlavy. Vyšší číslo vrátí daný počet statických snímků rovnoměrně rozložených po sekvenci:

- PNG, JPG, WebP a SVG se vrátí jako jeden ZIP: `<name>-01.png`, `-02.png` a tak dál.
- PDF se vrátí jako jeden dokument s daným počtem stránek.

Každý statický snímek pochází ze středu svého úseku časové osy, takže první nikdy nezachytí napůl prolnutý nástup a poslední prázdný okamžik po skončení klipů.

::: figure exporting-contact-sheet
Frames: 4 rozdělí sekvenci na čtyři stejné úseky a vezme střed každého z nich.
:::

Použij Frames pro storyboard, kontaktní list ke kontrole nebo karusel na sociální sítě vystřižený z video sestřihu. Počet je omezený na 64. Jakýkoli jiný vstup do pole se vrátí na `1`. Každý snímek je běžný statický obrázek, takže údaje o původu, Imprint, fyzické jednotky a DPI fungují jako u jednoho exportu. Odkaz pro export, CLI a MCP si vyžádají stejný list pomocí `cuts=` (viz [Kontaktní listy](/info/url-export.html#contact-sheets)).

<!--i:eti-copy-->
## Mnoho souborů najednou

Lolly nabízí tři způsoby hromadné práce:

::: cols
## Z tabulky vznikne jeden dokument
Nástroj navržený pro stránkování vstupní tabulky změní každý řádek na stránku. Vlož tabulku z tabulkového procesoru a získáš jedno PDF. Pro opravu řádků uprav tabulku a vlož ji znovu. Referenčním nástrojem je Battlecards. Je v otevřené složce zdrojového kódu `community` a není uvedený na lolly.tools.
## Z CSV vznikne jeden soubor na řádek
**Batch** (`#/batch`) přijme CSV a vykreslí jeden export pro každý řádek, například jmenovky nebo certifikáty, které doručí v ZIP. Viz [Lolly Batch](/info/batch.html#make-many-versions-of-one-design).
## Několik návrhů dostane stejnou úpravu
**Lolly Multi-edit** otevře několik uložených relací vedle sebe, abys v každé provedl stejnou změnu. Viz [Lolly Multi-edit](/info/batch.html#edit-several-saved-designs-together).
:::

Nástroj s několika stránkami, například Booklet, Print Sheet, Lolly Doc Studio nebo Lolly Markdown Slides, exportuje PNG, JPG, WebP, SVG a další formáty pro jeden obrázek jako jeden soubor na stránku, při více stránkách v ZIP. Print Sheet zachová celý arch a ořezové značky ve zvoleném DPI.

V **Projects** exportuje **Render folder** každou uloženou relaci ve složce a jejích podsložkách jako jeden ZIP se zachovanou strukturou. **Render selection** provede totéž pro vícenásobný výběr. Jedna uložená relace se vykreslí do vlastního souboru. Projects také umí znovu sdílet uloženou relaci jako odkaz na nástroj, který ji otevře se stejným nastavením.

<!--i:eti-pen-->
## Soubory, které zůstanou upravitelné jinde

Některé formáty předají tvou práci do jiné aplikace jako upravitelný obsah místo obrázku.

### PowerPoint (PPTX)

Lolly Design, Lolly Markdown Slides, Booklet, Lolly Doc Studio, Lolly Chart, Diagrams, Flow Chart a Agenda exportují prezentaci PowerPoint s jedním snímkem na stránku. Každá stránka se rozdělí na nativní objekty, které kolega může upravovat a extrahovat:

- <!--i:font--> **Text** se stane upravitelnými textovými poli PowerPoint s velikostí písma, barvou, tloušťkou, kurzívou a zarovnáním z rozvržení. Prezentace Lolly Design nastaví písmo značky na každém úseku textu i bez předlohy snímků.
- <!--i:pentool--> **Vektory**, například loga a ikony, se vloží jako obrázky SVG a PowerPoint na ně může použít *Convert to Shape*.
- <!--i:photos--> **Obrázky** se přenesou jako samostatné obrázky v nativním rozlišení. Oříznutý hlavní obrázek zachová za ořezem celý obrázek. Každý filtr nebo prolnutí je do obrázku napevno zapracované.
- <!--i:layers--> **Pozadí, okraje a oddělovací čáry** se změní na obdélníky a čáry. Kruhy, elipsy a pilulky z Lolly Design zůstanou nativními upravitelnými tvary.

![Panel exportu s vybraným PowerPoint: jeden snímek na stránku, text a tvary zůstávají upravitelné](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Rozvržení je přibližné. Cokoli, co průchodový modul nedokáže vyjádřit nativně, například složitou oblast s filtrem nebo maskou, se vloží jako obrázek. Prezentace má jednu velikost snímků převzatou z první stránky.

PowerPoint je i cestou dovnitř: [Převeď prezentaci na jinou značku](/info/rebrand.html) převede prezentaci do tvého designového systému a [Importuj návrh](/info/design-import.html) ji otevře v Lolly Design.

### Penpot

Většina nástrojů, které exportují SVG, exportuje i **soubor Penpot** (`.penpot`).

| Co jsi vytvořil | V Penpot |
|---|---|
| Text | Upravitelné textové objekty |
| Tvary, cesty, přechody a obrázky | Upravitelné vektorové tvary |
| Barva nebo písmo z tokenu designového systému | Živé propojení s tokenem: uprav token a každý tvar, který z něj dědí, se přizpůsobí |
| Celý návrh | Opakovaně použitelná komponenta v panelu Assets |
| Složitá ilustrace nebo živé plátno | Vložený obrázek; obsah kolem něj zůstává upravitelný |

Z Lolly Design se každý rám stane plochou Penpot. Barvy a typografie designového systému se přesunou do panelu Assets a celá sada tokenů do panelu Tokens. Penpot si uchovává vlastní kopii. Token upravený v Penpot se vrátí přes import v [Lolly Design System Setup](/info/brand-studio.html).

![Panel exportu s vybraným Penpot: soubor .penpot a Send to Penpot vedle stažení](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

Pro otevření souboru spusť Penpot, vyber projekt a zvol **Import**. Pokud se do Penpot přihlásíš z panelu exportu, **Send to Penpot** soubor importuje za tebe.

### Word, OpenDocument a InDesign

**Lolly Doc Studio** exportuje **Word** (DOCX) a **OpenDocument** (ODT) s upravitelnými odstavci a nadpisy. Soubor Word nastaví písma a barvu textu značky prostřednictvím stylů dokumentu, použije zvolenou velikost stránky a vedle loga SVG přidá PNG pro aplikace, které neumějí vykreslit SVG.

**Lolly Design** exportuje **InDesign IDML (static subset)**: text, obdélníky, ovály a obrázky PNG nebo JPEG, jednu dvojstranu na kreslicí plochu. Podporované formátování uvnitř textu zůstává upravitelné, obrázky se přenášejí v `Links` a souřadnice se převedou na body InDesign. Obnovení odkazů, náhrady písem a změněné zalamování mohou vyžadovat pozornost. Efekty, animace, složené textové toky a nepodporovaná geometrie zastaví export se zprávou, která je vypíše. IDML nezachovává původní dokument. Pro hotovou grafiku pošli PDF.

### Časové osy: dotLottie a Premiere

Z časové osy Lolly Design zapíše **dotLottie** animaci, která zůstane upravitelná v nástrojích Lottie; [Animace Lottie](/info/sequence-editor.html#lottie-animations) uvádějí, co zachovává. **Premiere XML + media** zabalí časované klipy a jejich původní média pro Premiere; viz [Výměna přes Premiere XML](/info/sequence-editor.html#premiere-xml-exchange).

### SCORM (balíčky kurzů)

Export kurzů je vypnutý, dokud nezapneš **Training and courses** v Settings → Preferences → Feature flags.

Pak zvol **Export course** v podporovaném nástroji, složce projektu nebo výběru. V Lolly Design otevře volba **SCORM (LMS)** a **Download** stejný postup pro kurz. Lolly uloží práci, ukáže obsah a pořadí kurzu ke kontrole a pak otevře modul a jeho dialog exportu.

- <!--i:layers--> Vyber podobu každého zdroje: statické stránky, pohyb jako video, zvuk nebo materiál ke stažení. V modulu přidej text lekcí a alternativy ke čtení.
- <!--i:clock--> Zobraz náhled přehrávače pro účastníky a zkontroluj popisy a titulky. Pohyb včetně němé animace se zahrne jako video.
- <!--i:document--> Zvol Website, SCORM 1.2, SCORM 2004 4th Edition nebo experimentální cíl xAPI. Zkontroluj obsah a velikost ZIP, pak ulož a stáhni zkontrolovanou verzi.
- <!--i:check--> Dokončení vyžaduje potvrzení každé povinné lekce a volbu Finish.

![Panel exportu prezentace Lolly Design s vybraným SCORM (LMS)](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&drive=click:.edge-dock-tab%3Ahas-text%28%22Export%22%29;wait:600&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Balíček obsahuje hotový obsah a nepotřebuje účet Lolly. Umísti ZIP typu Website na hostitele HTTP(S); ZIP pro LMS importuj beze změny. Před sdílením kurzu otestuj cíl. Pro kurz z několika uložených výtvorů viz [Vytvoř školicí kurz](/info/training-creators.html).

### Vysílací titulky

Nástroj Captions umí exportovat i **TTML** a **SCC**. Oba se zapisují ze stejného seznamu titulků jako soubory SRT a VTT, takže slova i časy souhlasí.

- **TTML** používá IMSC1.1 Text Profile s časovými údaji vztaženými k médiu a jednou oblastí dole uprostřed. Neobsahuje barvu, písmo ani pozici jednotlivých titulků, protože titulky Lolly obsahují jen začátek, konec a text.
- **SCC** obsahuje titulky pop-on CEA-608 na kanálu 1 při 29,97 snímku za sekundu s časovým kódem drop-frame. Podporuje základní severoamerické znaky i speciální a rozšířené znaky. Pokud titulek obsahuje znak mimo tuto sadu, export se zastaví a uvede, o který znak jde. Každý titulek se zalamuje na 32 sloupců a nejvýše 15 řádků. Titulek, který se nestihne načíst před svým začátkem, se zpozdí o několik snímků.
- Titulky roll-up a paint-on se nezapisují.

::: note SCC nebylo ověřeno ve vysílacím nástroji
Nebylo vyzkoušeno ani na hardwarovém dekodéru. Před doručením otestuj soubor ve vlastním pracovním postupu.
:::

### DXF (soubory pro řezání)

Lolly Asset Export, Diagrams, Growth, Lolly Logo Wall, QR Code, Street Map, Wayfinding a Wordmark exportují **DXF**, výměnný formát AutoCAD R12, který čtou laserové řezačky, plotry na vinyl a software CNC. Geometrie se zapisuje jako obrysové cesty v milimetrech a text se převádí na obrysy. Barva se přiřadí k nejbližší hodnotě AutoCAD Color Index, která obvykle řídí činnost řezačky. DXF obsahuje jen čárovou grafiku: fotografická oblast nebo oblast s filtrem nemá řeznou cestu a vynechá se s varováním. Pro zachování rastrového obsahu použij SVG nebo PDF. Text, který nepokrývá žádné písmo, ani [záložní písmo](/info/fallback-fonts.html), zastaví export se zprávou, která tento text cituje.

Návrh Street Map tvoří jen tahy, takže každá silnice a kanál se stanou řeznou cestou.

::: showcase
![Vykreslení Paříže ve Street Map inkoustovou barvou na krémovém pozadí - čistě čárová grafika, takže každý tah přežije cestu do řezačky](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Posouvej stránku a kamera se vzdaluje skrz geometrii: sedm cest a žádné pixely. Řezačka čte stejný soubor.
:::

<!--i:eti-stamp-->
## Tisk

**Print PDF** zapisuje CMYK pro pojmenované tiskové podmínky, ve výchozím nastavení **Coated FOGRA39**. Vzorky barev značky s naměřenými hodnotami tiskových barev si tyto hodnoty ponechají. Ostatní barvy se převádějí přes tiskový profil: ve výchozím nastavení vlastní profil Coated FOGRA39 od Lolly, nebo tvůj profil, když zvolíš jeho řádek **Embed**. Šedé odstíny a černá zůstávají jen na černé desce, takže u drobného písma nemůže vzniknout chyba soutisku. FOGRA51, SWOP a GRACoL používají standardní převod zařízení. Černé písmo také přetiskuje barvu pod sebou, takže mírně nepřesný soutisk nezanechá kolem písmen bílý okraj. **Print TIFF** zapisuje pixely DeviceCMYK pro RIP. Ovládací prvek Colour profile řídí obojí ([Barevné profily](#colour-profiles)). Print TIFF a **EPS (CMYK)** separují barvy přes stejný tiskový profil jako Print PDF.

**Print marks & bleed** má u tiskových formátů vlastní kartu: spadávku v milimetrech a volby Crop, Registration, Bleed, Colour bars a Stamp details. Stamp details tiskne do okraje datum, nástroj a tvé jméno. Jméno nebo název nástroje se znaky, které písmu pro okraj chybí, například arabskými, čínskými, cyrilicí nebo emoji, se vykreslí jako obrázek ve stejné šedé. Karta exportu tyto znakové sady vypíše.

Některé nástroje, například *Booklet*, vytvářejí **vícestránkové PDF**: obálku, obsah, který se rozlije na tolik stránek, kolik potřebuje, a zadní stránku. Každá stránka je skutečná stránka PDF na výšku ve formátu A4, US Letter nebo A5. Každý blok můžeš vynutit na novou stránku. Jde o dokumenty RGB bez ořezových značek nebo značek spadávky; tyto značky patří do jednostránkového Print PDF. PDF z Lolly Design může být také **Notes handout**: stránka na výšku pro každý snímek s poznámkami přednášejícího pod ním.

**Před exportem.** Karta **Before you export** ve spodní části panelu ukazuje, co uvidí tiskárna: formát, velikost a spadávku, oblasti ořezu a spadávky, pokrytí tiskovou barvou, počty desek a stránek, s výsledkem vedle nadpisu. Karta nikdy neblokuje export. Lolly Design ji vždy ukazuje s vlastními kontrolami, včetně pravidel organizace v designovém systému vrstvu po vrstvě a ukazatele psaní pro text dokumentu ([Před exportem](/info/design.html#before-you-export)). Lolly Design přidá tyto tiskové kontroly, když je zapnuté **Print preflight**. V ostatních nástrojích zapni **Print preflight** v Settings → Preferences → Feature flags. Ve výchozím nastavení je vypnuté a nasazení Lolly Work ho může zapnout svým členům.

**Po exportu.** Lolly znovu načte hotový soubor a porovná ho s tvou volbou: formát, velikost v pixelech nebo velikost stránky, délku klipu, průhledné pozadí, barvy CMYK, HDR, Content Credentials a heslo PDF nebo ZIP. Každý rozdíl se zapíše na kartu exportu. Každé měření pochází ze souboru, nikdy z nastavení. Vlastnost, kterou ze souboru nelze zjistit, se nepočítá jako shoda. Příkazový řádek zapíše úplné porovnání pomocí `--export-report` (viz [Vykreslování pomocí CLI](/info/cli-rendering.html)).

::: details Kontroly přístupnosti PDF z příkazového řádku
**Kontroly přístupnosti PDF.** Pro PDF vypíše příkazový řádek také 32 kontrol přístupnosti do souboru `--export-report` pod `pdfAccessibility`. Každá kontrola má id, srozumitelný popis, výsledek a údaj o tom, kde v souboru našla problém:

- **Passed**: kontrola něco prověřila a nenašla chybu.
- **Failed**: kontrola našla problém. Jsou uvedena čísla jeho stránek nebo tagy.
- **Not applicable**: soubor neobsahoval nic daného druhu ke kontrole, například kontroly tabulek v souboru bez tabulek. O souboru to nic nevypovídá.
- **Needs a person**: šest kontrol nemůže posoudit program (pořadí čtení, barevný kontrast, blikání, skripty, časové limity a opakované odkazy).

Seznam není verdikt. Neříká, že PDF splňuje PDF/UA nebo že ho mohou používat lidé využívající asistivní technologie. Soubor musí stále zkontrolovat člověk se čtečkou obrazovky. Vlastní PDF od Lolly dnes kontrolami tagování neprocházejí, protože exportéry zatím žádné tagy nezapisují. Kontrola čte soubor na tvém zařízení a nic nemění. Soubory vyžadující heslo se označí jako nezkontrolované, nikoli úspěšně zkontrolované. Pro kontrolu PDF, které jsi dostal, ho přetáhni do [Lolly Strip Hidden Data](/info/utilities.html), kde se stejný seznam ukáže pod **PDF accessibility checks**.
:::

Kontroly v Inspektoru Lolly Design a porovnání značek v Lolly Design System Setup zkoumají návrh. Tyto dvě karty zkoumají soubor.

::: details Náklady podle ceníku
Pod předtiskovou kontrolou převádí karta nákladů stejné počty na peníze, i když je karta předtiskové kontroly vypnutá. Potřebuje dvě věci: zakázku, kterou lze podle ceníku ocenit (desky, archy, plochu, stránky, řádky variant nebo výstupní soubory, takže prosté logo PNG kartu nikdy nezobrazí), a **ceník**, cenový seznam v JSON od tvé tiskárny. Výchozí sestavení žádný ceník neobsahuje a nemá v aplikaci možnost ho načíst. Ceník přichází jako asset katalogu dodávaný s nasazením nebo přes volitelné rozšíření pro ceníky, které zapne provozovatel vlastní instance nebo řídicí platforma. Bez ceníku se nic nezobrazí.

Každá částka je sazba, kterou jsi dodal, vynásobená množstvím, které Lolly spočítala, například `4 plate × €35.00`. Součet ukazuje svůj zdroj: vydavatele ceníku a datum jeho sazeb. Není tu výchozí měna ani zástupná cena. To, co soubor říká sám o sobě, zůstává převzatým tvrzením: *„Soubor uvádí: … Lolly to neověřila.“*

Když částku nelze vypočítat, tabulka se skryje místo vyplnění:

- Řádky, které ceník neoceňuje, znamenají **žádný celkový součet**, jen nadpis s počtem neoceněných řádků.
- Množství, které je horní mezí, přenese do svého mezisoučtu **„až“**.
- Sazby po datu platnosti zobrazují **jen počty**, dokud nestiskneš *Use these rates anyway*; datum vypršení pak zůstane u částky.
- Při otevření přes **odkaz** zůstávají peníze skryté, dokud si je na tomto zařízení nevyžádáš. CLI přijímá `--rate-card=<file.json>` jako lokální soubor a nikdy jako parametr odkazu.

Ceník se odstraňuje ze všech fází exportu a soubor nikdy nemění. Jde o výpočet, ne cenovou nabídku. Tu může dát jen tvá tiskárna.
:::

<!--i:eti-film-->
## Pohyb a zvuk

### Video

Animované nástroje exportují **MP4** a **WebM**. Sdílený odkaz `?format=`, který požaduje kontejner, jejž tento prohlížeč neumí vytvořit, použije druhý s odpovídajícím názvem souboru. **Start after** drží plátno v klidu, aby se před nahráváním ustálily animace a písma. **Duration** nastavuje délku hotového klipu. **Motion blur** (Off, Draft quality, Standard nebo High, s **Shutter angle**) rozostřuje rychlý pohyb a zpomaluje vykreslování. Kde to prohlížeč podporuje, **Record live** zaznamenává náhled na obrazovce v reálném čase prostřednictvím sdílení obrazovky.

![Nastavení časování animovaného exportu: Start after, Duration, Motion blur se Shutter angle a Record live](/t/url-shot?url=%2F%23%2Ftool%2Flottie-digi-ad%3Fformat%3Dmp4%26options&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=.video-params&walker=1&format=svg&dark=1&filename=exp-video-settings)

**Quality** vybírá Smaller file, Balanced nebo Best quality. **Advanced** otevírá **Codec**, **Frame rate**, **Rate mode** a **Hardware acceleration**. Kde má nástroj titulky, **Captions** vybírá **Embedded track** nebo **Sidecar .vtt + .srt** vedle videa. Odkaz přenáší kvalitu, kodek, snímkovou frekvenci, délku a zpoždění začátku jako `vq`, `codec`, `fps`, `seconds` a `wait` ([Parametry URL](/info/url-parameters.html)).

Exporty videa zachovávají zvuk. Nástroj může pod klip vložit **hudební podkres**: zvukový asset ve smyčce nebo zkrácený na délku klipu, s náběhem a dozněním, hlasitostí a automatickým ztlumením pod vlastním zvukem záběrů. Nahrávací nástroje přenášejí do souboru svůj živý zvuk.

Prezentaci Lolly Design ovládanou klikáním lze také exportovat jako video. **Export slides as video** v nabídce Present otevře panel exportu s MP4. Každý snímek se přehrává po svou vlastní dobu zobrazení, nebo po dobu Duration z panelu exportu, pokud vlastní nemá. Přechod prezentace se mezi snímky přehraje jako prolnutí. Dokument se nemění.

**HTML** z časovaného dokumentu Lolly Design nebo ze Snippet je přehrávač v jednom souboru: ovládání přehrávání, posunu a zvuku nad animací s vloženými podporovanými písmy, obrázky a zvukem. Soubor se přehrává offline. Film Lolly Design se scénami přidá nabídku svých scén. Sekvenci, která obsahuje video, Lottie nebo 3D klip, zatím nelze exportovat jako HTML; exportuj ji jako video.

### Animované obrázky

**GIF** se přehrává všude a hodí se pro chat a e-mail; je větší a má méně barev než video. **APNG** a **Animated WebP** zachovávají plné barvy a průhlednost. **Lottie Ad** exportuje také **Animated SVG**: vektorové snímky s vloženými klíčovými snímky CSS, které se škálují na libovolnou velikost a přehrávají ve smyčce na kartě prohlížeče nebo v `<img>` bez kodeku. Jeho text je převedený na obrysy. Používá nižší výchozí snímkovou frekvenci, protože každý snímek je náročnější než bitmapa. Všechny tyto formáty jsou bez zvuku.

### Zvuk

Některé nástroje exportují samotný zvuk. **Lolly Voice Recorder** zaznamenává mikrofon se živým ukazatelem úrovně a ukládá záznam jako **MP3**, **WAV**, **M4A (AAC)** nebo **Opus (WebM)**, kódovaný na tvém zařízení. `wav`, `mp3`, `m4a` a `opus` jsou běžná id formátů, takže zvukový export se dá sdílet a skriptovat stejně jako PNG.

Výběr assetů přijímá pro hudební podkres mnoho zvukových formátů, od MP3 a FLAC po MIDI a trackerové moduly; uvádí je [Formáty](/info/formats.html). [Skladba Lolly Rondocode](/info/rondocode.html) se přehrává po dobu, kterou požaduje její klip.

<!--i:eti-palette-->
## Barvy a HDR

Lolly čte všechny moderní barvy CSS, počítá s barvami podle jejich vnímání a zapisuje každý soubor v prostoru, který čtečka umí otevřít: sRGB pro obrazovky, CMYK pro tisk a Rec.2100 PQ pro HDR ([Barvy ve vykreslovacím jádře](/info/colour-engine.html)). Dokument Lolly Design nastavený na **Wide colour / HDR** se řídí vlastními pravidly: viz [Úpravy s širokým barevným gamutem a HDR](/info/hdr-editing.html).

### Barevné profily

Exporty jsou označené barevným profilem, takže aplikace se správou barev, například aplikace v tiskárnách, Photoshop a prohlížeče, čtou barvy tak, jak jsi je viděl. Miniatury a náhledy označení vynechávají, aby zůstaly malé.

- **PNG a JPG** obsahují vložený profil ICC **sRGB**, tedy prostor, ve kterém se kreslí náhled. Pixely jsou označené, znovu se nekódují.
- **Print PDF (CMYK)** deklaruje tiskové podmínky v *OutputIntent* a říká tím tiskárně, jak má číst jeho tiskové barvy CMYK.
- **Print TIFF (CMYK)** zapisuje neoznačené pixely DeviceCMYK a zaznamenává tiskové podmínky do metadat TIFF. TIFF neumí vložit tiskový profil, takže řádek **Embed** zaznamená jen název profilu.
- **TIFF (RGB)** je nekomprimovaná verze sRGB pro archivaci nebo úpravy v editoru a návrat zpět. Oba formáty TIFF jsou jen pro počítače, protože prohlížeče neumějí zobrazit náhled TIFF.
- **SVG**, **EMF**, **EPS** a **DXF** jsou vektory bez vloženého profilu: barvy SVG jsou sRGB, EMF a EPS používají RGB zařízení, **EPS (CMYK)** zapisuje DeviceCMYK a DXF používá AutoCAD Color Index. SVG, EPS a DXF převádějí text na obrysové cesty. EMF ponechává text živý a upravitelný v Office a Google Slides a na obrysy převádí jen úseky, které formát nedokáže vyjádřit. Volba **Outline fonts** v panelu exportu vynutí cesty všude, stejně jako `_text=outline` v odkazu a `--text=outline` na příkazovém řádku. SVG také reprodukuje vnitřní i vnější stíny polí CSS.

::: details PDF/X-4 a vlastní tiskový profil
Lolly dodává jeden profil CMYK přizpůsobený charakterizačním datům FOGRA39 od Fogra a vydaný pod CC0 a převádí přes něj barvy pro výchozí tiskové podmínky. Profil se nevkládá, protože jde o ICC verze 4.3 a PDF/X-4 přijímá verze do 4.2. Pojmenované tiskové podmínky proto zapisují výstupní záměr bez tvrzení o shodě s PDF/X-4.

Načti vlastní profil CMYK a v ovládacím prvku Colour profile vyber jeho řádek **Embed**. Vloží se jako *DestOutputProfile* souboru a PDF deklaruje shodu s PDF/X-4, kdykoli to zbytek souboru dovolí. Deklarované tiskové podmínky se čtou z tohoto profilu: registrovaný název, pokud ho profil prokazuje, nebo `Custom` pod vlastním názvem profilu.

Tři věci brání deklaraci shody, ale zachovávají výstupní záměr: grafika RGB, kterou průchod CMYK nedokázal převést, údaj o autorství `prov` v ověřovacím okraji (kreslený standardním písmem, které není vložené) a heslo **Strong**, protože PDF/X-4 zakazuje šifrování. Každé PDF také obsahuje metadata PDF/X-4: rámečky stránek, XMP, ID dokumentu a výstupní záměr sRGB s jeho profilem.
:::

### Přímé barvy jako procesní

Designový systém může barvě přiřadit přímou barvu, například Pantone nebo HLC. **Print PDF** pak tuto barvu tiskne na vlastní desce. Lolly Demo přiřazuje přímou barvu každé barvě kromě bílých Sugar a Daylight a černé Void. Print PDF vytvořený v Lolly Demo tiskne většinu barev na deskách pro přímé barvy a černou na černé desce.

Pro běžný čtyřbarevný soubor zaškrtni **Print spot inks as process** na kartě Profile v panelu exportu. Každá přímá barva se pak tiskne azurovou, purpurovou, žlutou a černou podle složení CMYK, které jí designový systém přiřazuje. Barva bez vlastního složení se převede podle tiskového profilu stejně jako každá jiná barva v návrhu. Soubor pak obsahuje jen čtyři procesní desky. Volba je ve výchozím stavu vypnutá. Panel ukazuje políčko jen pro **Print PDF** a jen tehdy, když designový systém přiřazuje některé barvě přímou barvu.

Dokončovací úprava není tisková barva. Fólie, vystouplá ražba, zahloubená ražba, parciální lak, soft touch, výsek, rýhování a perforace si i se zaškrtnutým políčkem zachovávají vlastní pojmenované desky, protože tisk dokončovací úpravy procesními barvami by na stránku umístil její černou masku.

Karta **Before you export** a `lolly preflight` počítají desky, které bude soubor obsahovat. Se zaškrtnutým políčkem počítají čtyři procesní desky a případné desky dokončovacích úprav a uvádějí, že se přímé barvy tisknou jako procesní a nepřidávají žádné desky. S nezaškrtnutým políčkem počítají až jednu desku pro každou přímou barvu přiřazenou designovým systémem. Ceník určuje cenu podle těchto počtů, takže nikdy nezapočítá desku pro přímou barvu, kterou soubor nebude obsahovat.

**Print TIFF** a **EPS (CMYK)** nemají pojmenované desky, takže tisknou každou barvu procesně bez ohledu na tuto volbu. U těchto dvou formátů karta a `lolly preflight` počítají čtyři procesní desky a nikdy žádnou desku pro přímou barvu nebo dokončovací úpravu. Dokončovací úprava se do nich zapíše jako černá maska na černé desce a karta to hlásí jako chybu.

O stejný soubor požádá odkaz pomocí `_spots=process`, příkazový řádek pomocí `--spots=process`, [MCP server](/info/mcp.html) pomocí `spots: "process"` a terminálová aplikace pomocí řádku **Spot inks**. Do souboru se o této volbě nic nezapisuje: mění se jen tiskové barvy.

### HDR (jasné barvy)

Karta **HDR** v panelu exportu zvyšuje jas běžných návrhů pro obrazovky HDR. Jak zachovat originály HDR při úpravách, popisuje [Široký barevný gamut a úpravy HDR](/info/hdr-editing.html).

Běžný export je sRGB: sytá barva značky má stejný jas jako běžná bílá obrazovky. Displej HDR zvládne vyšší jas. Karta **HDR** zesiluje barvy tvé značky a bílý text směrem k maximálnímu jasu. Tmavé oblasti zůstávají tmavé.

![Zapnutá karta HDR v panelu exportu s ovladači White / Reach / Dark lift / Focus zobrazenými pod ní](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formáty.** PNG, JPG, AVIF a TIFF. WebP je 8bitový bez funkčního dekódování HDR a vektory ani PDF nemají model HDR.
- **Ve výchozím stavu vypnuté**, protože mění pixely. Zaškrtni kartu nebo v odkazu pro sdílení předej `hdr=1`.
- **Ovladače.** **White** (horní mez jasu, 400 až 2000 nitů), **Reach** (jak hluboko do tónů záře zasahuje), **Dark lift** (o kolik se zesvětlí tmavé tóny; `0` je ponechá tmavé) a **Focus** (kolik sytosti barev zesílení zachová). Přenášejí se jako jedna hodnota: `hdr=1600-60-0-50` znamená White 1600, Reach 60, Dark lift 0 a Focus 50.
- **Co se zapisuje.** PNG dostane 16bitové Rec.2100 PQ s blokem `cICP`. JPG je JPEG s mapou zesílení podle ISO 21496-1: běžný obrázek SDR s připojenou mapou zesílení. AVIF dostane přepsaný blok `colr`. TIFF dostane pixely PQ s vygenerovaným profilem ICC v4 obsahujícím značku `cicp`. Při exportu do TIFF se obraz sloučí s černým pozadím, protože bílá v PQ odpovídá kódu pro 10 000 nitů a vytvořila by záři kolem každého okraje. Zesílení sleduje vjemovou světlost (OKLab) a zachovává odstín, takže zelená barva značky se zjasní a nezmění se na mátovou.
- **Kde je záře vidět.** V prohlížečích se správou barev na displeji HDR: Preview, Quick Look a Safari na zařízeních Apple nebo Chrome na monitoru HDR. Obrazovka SDR zobrazí běžný obrázek.
- **Z terminálu.** `--hdr=1` s `--export=png` nebo `--export=jpg` zapisuje v [CLI](/info/cli.html) stejné PNG a JPEG s mapou zesílení pomocí stejných kodérů enginu, bez prohlížeče. AVIF a TIFF jsou zatím dostupné jen při exportu z webu.

::: warning Mnoho platforem odstraňuje signál HDR
Platforma, která nahrané soubory znovu kóduje, může zanechat obrázek tmavý nebo vybledlý. Používej HDR tam, kde máš pod kontrolou cíl, například na vlastním webu, videostěně nebo v sadě snímků na panelu s vysokým jasem.
:::

<!--i:eti-badge-check-->
## Co se přenáší se souborem

Hotový soubor může obsahovat několik záznamů. Některé jsou uložené vedle pixelů a zmizí při opětovném uložení, pořízení snímku obrazovky nebo odstranění metadat. Dvě značky jsou přímo v pixelech.

::: figure exporting-what-travels
Kde je každý záznam uložený, zda je ve výchozím stavu zapnutý a který parametr odkazu ho ovládá.
:::

Panel exportu sdružuje **Licence**, **Source credits**, **Password**, **C2PA Credentials**, **Lolly Imprint** a **Durable credential** do jedné skupiny **Content protection**, která ukazuje jen karty použitelné pro zvolený formát. Skupina se otevře sama, když odkaz nebo dokument už deklaruje licenci nebo když zdroj vyžaduje tvé rozhodnutí. Karta **Design system** zůstává mimo skupinu a je viditelná při každém exportu.

![Otevřená skupina Content protection při exportu PNG, zobrazující jen karty, které se na něj vztahují](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

### Provenience & vodoznak

Pokud má formát příslušná pole, exporty obsahují **metadata provenience**: software, zdroj, název nástroje a údaj o autorství z tvého profilu, zapsané do PNG iTXt, JPEG EXIF, informací PDF, SVG `<metadata>` nebo komentáře GIF. Zaznamenává se jen autorství. Nic se nenahrává. **Experimentální** nástroje přidávají také viditelný vodoznak. Vodoznak přidává hostitel, takže úpravou nástroje jej nelze odstranit.

**Lolly Imprint** je neviditelný pixelový vodoznak, **ve výchozím stavu zapnutý**. Přežije opětovnou kompresi, takže kopii lze stále rozpoznat jako vytvořenou v Lolly. Je to vodítko, nikoli kryptografická záruka, a neobsahuje žádné osobní údaje. Zapisuje se do JPEG XL, PNG, JPG, WebP, AVIF, TIFF a BMP a do rastrů, které Lolly vykresluje do PDF nebo PPTX, nikdy do obrázku, který jsi vložil. Zruš zaškrtnutí **Lolly Imprint** nebo předej `imprint=0`, aby se Imprint vynechal. Odolnost AVIF vůči opětovnému kódování zatím není kalibrovaná. [Lolly Verify](/#/verify) detekuje Imprint na tvém zařízení; viz [Lolly Imprint](/info/what-verify-checks.html#the-lolly-imprint).

**Durable credential** zapisuje identifikátor Lolly do pixelů pomocí neuronového modelu na zařízení ve formátu TrustMark, takže spojení „vytvořeno v Lolly“ přežije odstranění metadat i opětovné kódování a mohou ho číst nástroje podporující TrustMark. Je **ve výchozím stavu vypnuté**, protože vyžaduje průchod neuronovou sítí při každém exportu a jednorázové stažení modelu. Podporuje PNG, JPG, WebP, AVIF a TIFF. Zaškrtni jej v panelu nebo předej `durable=1`. Desktopové a mobilní aplikace kartu skrývají, protože offline nemají zdroj, ze kterého by model stáhly.

**Licence.** Vyber, jak mohou ostatní tvou práci používat: ve výchozím stavu *None (all rights reserved)*, CC0 1.0, Public Domain Mark 1.0 nebo licence Creative Commons 4.0 (BY, BY-SA, BY-NC, BY-NC-SA, BY-ND, BY-NC-ND). Název licence a odkaz na její shrnutí se zapisují do licenčních metadat souboru (EXIF, XMP a RIFF, pokud je formát má) a jeho Content Credential. Volba se ukládá s dokumentem a přenáší se v odkazu jako `licence=`. Lolly zapisuje licenci, kterou jsi vybral. Lolly podmínky nekontroluje ani nevynucuje. Nástroj s vlastním polem licence, například Claim, si místo toho ponechá toto pole.

### Záznam designového systému

Export zaznamenává designový systém, který soubor vytvořil: jeho název, publikovanou verzi, ze které se vykreslovalo (pokud nejde o pracovní verzi), a [colourway](/info/colourways.html), ve kterém se vykreslovalo. Jakákoli další volba motivu, kterou designový systém deklaruje, například hustota, se zaznamenává stejně. Volba světlého nebo tmavého vzhledu se vynechává, protože obrázek už ukazuje, který se použil.

**Záznam uvidíš, než se cokoli zapíše.** Karta **Design system**, ve výchozím stavu zaškrtnutá, ukazuje přesné znění, které soubor ponese, například *Records: Acme · Colourway: Beach*, a popis. Název designového systému je to, co jeho vlastníci zadali, a karta jej ukazuje beze změny. Zruš zaškrtnutí karty, aby se záznam z daného exportu vynechal. Panel dokumentu v Lolly Design uvádí stejné znění pod *Embedded in exports*.

**Popis uvádí colourway vedle nástroje.** Se zaškrtnutou kartou se *„Vytvořeno pomocí https://lolly.tools : Chart“* změní na *„Vytvořeno pomocí https://lolly.tools : Chart (colourway Beach)“*. Vlastní název designového systému zůstává v záznamu, nikoli v popisu. Popis bez názvu nástroje nebo takový, který nástroj zapisuje ze svých vstupů, se nemění. Nástroj, který ignoruje colourways pomocí `tokenAxes`, žádný nezaznamenává a údaj o autorství v kontrolním PDF (tisková značka `prov`) se řídí stejným pravidlem.

::: details Dovednosti značky, stránky značky a partnerské společnosti v záznamu
**Dovednosti značky, kterými se agent řídil.** Když dílo vytvořil agent a uvedl [dovednosti značky](/info/brand-skills.html), které přečetl a kterými se řídil, záznam také uvádí každou dovednost s její revizí, například *Guided by: acme-brand 1.0*. Toto znění znamená, že se práce řídila danou dovedností. Lolly netestuje dílo vůči dovednosti. Seznam přidává jen vlastní prohlášení agenta. Dnes jde o argument `brandSkills` nástroje `lolly_render` na [MCP serveru](/info/mcp.html), takže dílo vytvořené v aplikaci nebo z odkazu pro sdílení žádný seznam nemá. Content Credential obsahuje seznam jako `brandSkills`, jednu hodnotu JSON s identifikátorem, názvem, revizí a hashem SHA-256 každé dovednosti. Balíček XMP a metadata SVG obsahují stejnou hodnotu jako `lolly:BrandSkills`. PDF zapsané ze záznamu získá jedno klíčové slovo pro každou dovednost. Popis se nemění. Text interní dovednosti se nikdy nezaznamenává. Stejné přepínače vynechají seznam se zbytkem záznamu: karta **Design system**, `_madewith=0`, `--no-madewith` a `madeWith: false`. Když MCP server vykresluje soubor v prohlížeči (PDF, JPEG a další formáty, které jeho cesta bez prohlížeče neumí zapsat), vlastní metadata souboru seznam neobsahují. Tam může seznam obsahovat jen Content Credential. Předej `c2pa`, aby se záznam zachoval. Bez pověření vykreslení upozorní, že dovednosti značky nebyly zaznamenány.

**Stránka značky, pokud to její vydavatel zapne.** Vydavatel designového systému může zvolit, aby se do exportů zapisovala adresa jeho [stránky značky](/info/brand-page.html#lead-back-from-your-files). Nastavení platí pro jednotlivý designový systém a ve výchozím stavu je vypnuté. Karta pak přidá adresu na stejný řádek, například *Records: Acme · Colourway: Beach · Brand page: https://acme.example/brand/acme/*. Zrušení zaškrtnutí karty odstraní adresu se zbytkem záznamu. Záznam obsahuje adresu a nic dalšího o stránce. Nic jiného v souboru se nemění. Designový systém bez adresy zapisuje stejný soubor jako dříve.

**Adresa se nepřenáší s balíčkem.** Záznam v podepsaném souboru se vykládá jako vlastní záznam podepisujícího. Adresa se nesmí sama zapnout někomu, kdo si ji nevybral, a balíček nesmí být schopen nasměrovat soubory jiných lidí na stránku podle vlastní volby. Balíček `.lolly`, kopie nebo fork designového systému, **Try these colours**, obnovená záloha i soubor tokenů předaný pro jeden běh přicházejí s vypnutým nastavením. Nastavení můžeš zapnout sám s adresou, kterou zadáš. Spravovaný designový systém je jedinou výjimkou: zachovává adresu, kterou jeho správce nastavil ve zdrojových tokenech. Podrobnosti najdeš v [Odkazování zpět z tvých souborů](/info/brand-page.html#lead-back-from-your-files).

**Partnerská společnost v partnerském programu Lolly Work.** Dílo vytvořené pro partnerskou společnost zaznamenává společnost a její program na stejném řádku, například *Records: Acme · Colourway: Beach · Partner: Northwind IT (Resellers, EMEA)*, s revizí údajů o společnosti v souboru. Záznam neobsahuje žádnou osobu, kontaktní údaje, adresu ani měnu. S připojenou partnerskou sadou společnosti řádek přidává revizi sady, například *, kit revision 2*, a pověření obsahuje identifikátor a revizi sady, nikdy její barvy nebo pravidla. Zrušení zaškrtnutí karty odstraní partnera se zbytkem záznamu. PDF získá klíčové slovo *Partner: Northwind IT* a [Lolly Verify](/info/what-verify-checks.html#partner) ukazuje záznam jako **Partner** ([Záznam partnera v souborech](/info/manage/partner-programmes.html#the-partner-record-in-files)).
:::

**Zpětné čtení záznamu.** [Lolly Verify](/#/verify) uvádí záznam jako **Design system** v podrobnostech pověření souboru a případné dovednosti značky jako **Guided by**. Stránka značky se zobrazuje samostatně jako [záznam adresy od podepisujícího](/info/what-verify-checks.html#brand-page). *Recreate with these settings* znovu otevře nástroj v zaznamenané verzi a colourway. Odkaz se otevře se zaznamenaným designovým systémem, pokud toto zařízení obsahuje systém se stejným identifikátorem a názvem; jinak se otevře s tvým aktivním designovým systémem.

::: details Co se kam zapisuje a které běhy záznam vynechávají
| Kam | Co se zapisuje |
|---|---|
| Content Credential | `designSystem` (identifikátor), `designSystemLabel`, `designVersion` a `themes` v tvrzení `tools.lolly.export`, každé jako prostá textová hodnota; `themes` je seznam voleb v JSON. `brandPage`, pokud to vydavatel zapnul |
| PNG, JPEG, WebP a JXL | Stejné hodnoty jako vlastnosti `lolly:` v balíčku XMP souboru, ve jmenném prostoru `https://lolly.tools/ns/export/1.0/`. `lolly:BrandPage`, pokud to vydavatel zapnul |
| SVG | Stejné vlastnosti `lolly:` uvnitř bloku `<metadata>` |
| PDF | Klíčová slova jako *Design system: Acme*, *Colourway: Beach* a, pokud to vydavatel zapnul, *Brand page: https://acme.example/brand/acme/* |
| Každý formát s polem popisu | Popis s colourway vedle nástroje |

Karta se objeví jen tehdy, když je co zaznamenat a formát může záznam obsahovat. CSV, JSON, soubor kalendáře a další textové nebo datové formáty neobsahují metadata a EPS, EMF, DXF a BMP nemají pro záznam pole. HTML, Markdown a CSS obsahují záznam jen ve svém Content Credential, takže u nich karta neukazuje řádek popisu a skrývá se, když je **C2PA Credentials** vypnuté. Pole, které designový systém neposkytuje, se do souboru nezapisuje.

Odkaz pro sdílení vypíná záznam pomocí `_madewith=0` ([Parametry URL](/info/url-parameters.html)). Příkazový řádek přijímá `--no-madewith`, `lolly_render` na [MCP serveru](/info/mcp.html) přijímá `madeWith: false` a panel exportu terminálové aplikace má řádek **Design system**. Příkazový řádek vypisuje znění, které hotový soubor obsahuje, na standardní chybový výstup, a to pro vykreslení nástroje i pro každý soubor, který `lolly run` exportuje z uložené relace Lolly Design. Vykreslení MCP vypisuje znění vedle souboru. Obě cesty čtou znění zpět ze souboru. PNG, které příkazový řádek vykreslí bez prohlížeče, neobsahuje souborová metadata, takže se jeho záznam přenáší jen v pověření. Utility běžící na zařízení žádná metadata nepřidávají.

Běhy bez karty **Design system** záznam vynechávají: běh Lolly Batch, složka exportovaná z Projects a export 3D kolekce a v terminálové aplikaci dávka CSV, export složky nebo výběru z Projects a zobrazení pro vykreslení všeho. Pro zaznamenání designového systému exportuj jeden soubor z nástroje.
:::

### Content Credentials (C2PA)

Exporty mohou obsahovat **Content Credentials**: podepsaný manifest [C2PA](https://c2pa.org), který zaznamenává, co soubor vytvořilo, kdy a kde, a je svázaný s hashem bajtů souboru, takže lze odhalit jakoukoli pozdější úpravu. Lolly zapisuje standardní manifesty, které může prozkoumat jakákoli čtečka C2PA.

![Zaškrtnutá karta C2PA Credentials s dobou platnosti pověření vedle zaškrtávacího políčka](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Ve výchozím stavu zapnuté.** Karta **C2PA Credentials** je zaškrtnutá téměř u každého nástroje. Pro jeden export zaškrtnutí zruš nebo v odkazu předej `c2pa=off`. Soubor pak nemá pověření a SVG, které přímo vkládá grafiku s pověřením, například logo z katalogu, ztratí i pověření této grafiky. Lolly Imprint a ostatní metadata souboru zůstávají. Nástroj může pověření vypnout ve svém manifestu.
- **Formáty.** PDF (RGB a Print), PNG a APNG, JPG, GIF, SVG a SVGZ, TIFF (RGB a Print), WebP (statický a animovaný), AVIF, MP4, WebM, HTML, Markdown, CSS a zvukové kontejnery MP3, WAV, M4A, OGG/Opus a FLAC. ZIP opatří pověřením každý podporovaný soubor uvnitř, a tak získává pověření i Animated SVG. MP4, AVIF a M4A používají standardní vazbu BMFF a MP3 své mapování ID3v2, takže je `c2patool` a další čtečky ověří. WebM a OGG/Opus zatím nemají standardní mapování, takže Lolly přenáší manifest jako přílohu Matroska a pole OpusTags, které ověřuje vlastní ověřovač Lolly. SVGZ je komprimované SVG. Specifikace C2PA nedefinuje komprimovanou podobu, takže se pověření zapisuje do SVG před kompresí. Ověřovač Lolly čte soubor tak, jak je; `c2patool` přečte stejné pověření po dekompresi souboru (`gunzip`). ICO, EPS, EMF, DXF, BMP, PPTX, formáty Office a ostatní textové a datové formáty nemají kontejner C2PA.
- **Co zaznamenává.** Nástroj a aplikaci, které soubor vytvořily, čas podpisu a prostředí, které soubor exportovalo. U stránky Lolly Design exportované jako obrázek, SVG nebo PDF vykreslovač, který stránku vykreslil (`route` v tvrzení `tools.lolly.export`: `gpu` pro vykreslovač stránek GPU, `operations` pro kreslicí operace zapsané jako vektory, `compatibility` pro vlastní vykreslovač prohlížeče), a verzi tohoto vykreslovače (`renderer`: předpis GPU, `design-draw-v` a jeho verzi nebo `dom-to-image` a `dom-walker`). [Designový systém a colourway](#the-design-system-record), pokud je karta **Design system** zaškrtnutá. Aktivní nastavení: volby nabídek, čísla, přepínače a barvy beze změny a vše napsané (nadpisy, názvy, poznámky, odkazy a data) jen jako otisk, takže samotná slova v souboru nejsou. Pole navázaná na profil, neaktivní ovládací prvky, verze prohlížeče a podrobnosti o operačním systému se vynechávají. Tvé jméno a e-mail se zobrazí jako autor jen tehdy, když je pod Settings → Preferences → Your details zapnuté **Use my details to create**. Zdroje, které export vkládá, se přenášejí jako složky. Každý obrázek na stránce, který má vlastní Content Credential, se zaznamenává jako součást stránky s tímto pověřením a případným typem zdroje AI, který deklaruje. To platí v PNG, JPEG, WebP, AVIF, TIFF, SVG nebo PDF a v GIF, APNG, animovaném WebP, MP4 nebo WebM, pokud je obrázek vykreslen alespoň v jednom snímku exportovaného rozsahu. Jediný obrázek, který nástroj jako Darkroom, Filter nebo Asset Export mění, se místo toho zaznamenává jako rodičovský zdroj souboru, nejprve otevřený a pak následovaný tím, co s obrázkem nástroj udělal. Dalšími složkami jsou [díla s uvedením autorství](#source-credits), například emoji, [skladby Lolly Rondocode](/info/rondocode.html#songs-in-the-credential) v exportu videa nebo zvuku a [uložené melodie](/info/generated-music.html#what-a-track-records) v exportu videa nebo zvuku. Každá uložená melodie má svůj název, licenci, pokud ji melodie zaznamenává, SHA-256 svého předpisu, verzi enginu a označení algoritmického média. Tvůrce uložené melodie (jméno profilu, pod kterým byla uložena) se přidává jen tehdy, když je zapnuté **Use my details to create**, stejně jako tvé vlastní jméno. Jen tehdy panel exportu ukazuje tvůrce před exportem.
- **Schválení, pokud bylo zaznamenáno.** Soubor schválený prostřednictvím [Lolly Work](/info/work-approvals.html#review-an-exported-file) může nad tímto pověřením obsahovat druhý podepsaný záznam: identifikátor schválení, datum rozhodnutí a otisk kontrolovaného souboru. Neobsahuje jména, e-maily, skupiny, komentáře ani názvy řetězců. V dialogu žádosti je ve výchozím stavu zaškrtnutý a lze jej odškrtnout pro jednu žádost nebo vypnout pro instanci. Zaznamenává, že podepisující uvedl rozhodnutí. Neříká, že práce splňuje nějaký standard.
- **Co se od něj požadovalo, u souboru vytvořeného ze [záměru](/info/visual-intent.html#what-goes-in-the-file).** Účel, plochu, nástroj, jazyk, verze pravidel a slovníku a otisk záměru. Příležitost, publikum, region a zadání jsou jen otisky, pokud osoba nebo agent spouštějící dané vykreslení nepožádá o zaznamenání slov zadání. Tento záznam obsahuje jen vykreslení, které vycházelo ze záměru. Běh uvádí, co zaznamenal, a záznam lze vynechat.
- **Co vidí příjemci.** Nástroje C2PA jako aplikace Adobe, `c2patool` a contentcredentials.org/verify čtou manifest a zobrazují prohlášení. Lolly podepisuje klíčem vytvořeným na tvém zařízení, nikoli certifikátem ze seznamu důvěryhodných certifikátů, takže prohlížeče hlásí *neověřené* pověření. Struktura i důkazy o neoprávněných změnách jsou platné, ale za podepisujícího nikdo neručí. Pokud to chceš změnit, zaregistruj **ověřenou identitu** pod Settings → Preferences → Content Credentials; viz [Identita Content Credentials](/info/content-credentials-identity.html).
- **Kontrola souboru.** Přetáhni libovolný soubor do [Lolly Verify](/#/verify) nebo spusť `lolly validate <file>` a získáš zprávu na zařízení, která začíná tím, zda soubor vytvořila Lolly a zda se od té doby změnil. Lolly Verify kontroluje i další věci kromě pověření; viz [Co kontroluje Lolly Verify](/info/what-verify-checks.html).
- **Soukromí.** Podpisový klíč se vytváří pro export a nikdy neopouští tvé zařízení. Prohlášení obsahuje jen to, co už nesou metadata provenience. Utility ochrany soukromí, které transformují tvé vlastní soubory, žádné pověření nepřidávají a *Lolly Strip Hidden Data* odstraňuje manifest C2PA stejně jako ostatní metadata. Utilita Rondocode vytváří nový zvuk, takže podepisuje to, co zapisuje ([Skladby Lolly Rondocode](/info/rondocode.html#files-from-the-rondocode-utility)). Hudební generátor podepisuje každý stažený WAV nebo M4A. Pověření zaznamenává, že skladbu vytvořil hudební generátor Lolly, a licenci, pod kterou hudba spadá, CC BY 4.0, s uvedením autorství ([Co skladba zaznamenává](/info/generated-music.html#what-a-track-records)).
- **Vzájemné vztahy.** PDF chráněné heslem nemůže obsahovat Content Credentials ani na jedné úrovni. Pověření se přidává jako poslední nad hotovými bajty po DPI, EXIF, barevném profilu, metadatech PDF/X a tiskových značkách.

### Uvedení zdrojů

Export, který vkládá cizí dílo, zaznamenává tento zdroj v pověření. Běžným případem je emoji ze zvolené sady emoji: dílo, jeho tvůrce, licence, původ přesných bajtů i provedené změny se přenášejí se souborem. Text v nástroji, jehož šablona je SVG, si ponechává vlastní emoji systému, takže se tam žádné autorství neuvádí. Před stažením řádek **Source credits** uvádí, co zdroje požadují při doručení. Po stažení řádek nejprve znovu přečte doručené bajty a až pak potvrdí, že je autorství v souboru uvedeno. Licence, která vyžaduje tvou volbu, například u přebarveného glyfu CC BY-SA, který se chystáš sdílet, dostane kartu s možnostmi. Stažení se nikdy neblokuje. [Tvůrčí práva a uvedení autorství](/info/creative-rights.html) popisují znění, zkontrolované licence a to, co zůstává tvoje.

<!--i:eti-lock-->
## Ochrana heslem

Lolly vytváří dva druhy zámku, oba na tvém zařízení. Karta **Password** v panelu exportu nastavuje oba.

![Rozbalená karta Password při exportu PDF s polem hesla a dvěma úrovněmi zámku](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

**Heslo pro otevření PDF** má po zadání hesla dvě úrovně:

- **Weak**: 40bitové RC4, pro RGB `pdf` bez tiskových značek nebo spadávky a hesla tvořená jen znaky ASCII. Heslo s jinými znaky přepne na Strong, protože čtečky na této úrovni takto zamčený soubor neumějí otevřít. Počítá se jen prvních 32 znaků.
- **Strong**: AES-256 (PDF 2.0). Platí také pro Print PDF a pro každé PDF uvnitř dávkového ZIP. Print PDF zamčené pomocí Strong si ponechá CMYK, značky a výstupní záměr, ale vypustí prohlášení o shodě s PDF/X-4.

::: warning Weak odrazuje, ale nechrání
Pro důvěrný soubor použij **Strong**.
:::

**Zamčený ZIP** pokrývá export ZIP, stažení složky z Projects nebo dávku, s jedním heslem na dvou úrovních: **Weak** (ZipCrypto, pro odrazení) nebo **Strong** (AES-256). Heslo chrání každý soubor uvnitř. Každé PDF uvnitř je také samostatně zamčené pomocí AES-256, takže zůstane zamčené i po rozbalení ZIP. Výzva se objeví při zahájení stahování. Prázdné heslo znamená žádný zámek.

**Zadané heslo se na obou úrovních vynechává z odkazů.** Pokud soubor přijde přes odkaz `?password=`, Lolly přečte hodnotu a okamžitě ji z adresy odstraní. Odkaz požadující zámek, který jeho soubor nemůže obsahovat, nezapíše žádný soubor a uvede důvod (viz [`password`](/info/url-parameters.html)).

**Odkaz pro sdílení chráněný heslem** požádá příjemce o heslo, než se otevře. Stav odkazu je zašifrovaný pomocí AES-256 klíčem odvozeným z hesla (PBKDF2). Přenášejí se jen zašifrovaná data a dešifrování probíhá v prohlížeči příjemce. Server poskytující odkaz nikdy nevidí heslo ani návrh. Zapni ho v dialogu **Share**. Šifrovaný odkaz se otevře jen v Lolly, nikdy jako vložený obrázek. Viz [Režim URL](/info/url-mode.html).

<!--i:eti-monitor-->
## Na telefonu

Ovládání exportu je za plovoucím tlačítkem **Export**, které otevře panel **Export**: stejné formáty, velikost, kopírování, stažení a sdílení, přizpůsobené pro dotyk.

<!--i:eti-code-->
## Identifikátory formátů pro odkazy a CLI

Toto jsou hodnoty parametru URL `format=` a přepínače CLI `--export=` (viz [Parametry URL](/info/url-parameters.html) a [CLI](/info/cli.html)). Nabídka nástroje ukazuje jen formáty, které daný nástroj umí vytvořit.

| Druh | Identifikátory |
|---|---|
| Rastr | `png` · `jpg`/`jpeg` · `webp` · `avif` · `jxl` · `jxl-lossless` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vektor | `svg` · `svgz` (SVG komprimované pomocí gzip) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (soubor pro řezání) |
| Stránka a dokument | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `docx` (Word) · `odt` (OpenDocument Text) · `idml` (InDesign) · `penpot` (soubor návrhu Penpot) · `scorm` (balíček kurzu, ZIP) |
| Pohyb | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` · `lottie` (dotLottie) · `premiere-xml` (Premiere XML + media) |
| Zvuk | `wav` · `mp3` · `m4a` · `aac` · `opus` · `ogg` · `flac` · `mid` (noty MIDI, z Lolly Rondocode) |
| Text a data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `srt` · `vtt` · `ttml` · `scc` · `css` · `scss` · `gpl` (paleta GIMP) |
| Balíky a balíčky | `zip` · `rpm` a `tar.gz` (vykreslený výstup zabalený do balíčku pro Linux) |

Některé identifikátory pocházejí z vlastního exportního kódu nástroje: `ase` (Adobe Swatch Exchange, z Lolly Palette Lab) a `exr` a `hdr` (rastry s vysokým dynamickým rozsahem, z Lolly Darkroom). **Convert Font** zapisuje `ttf`, `otf` a `woff` ze souboru písma, který dodáš, takže samotný odkaz nástroji neposkytne nic k vykreslení.
