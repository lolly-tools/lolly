# Používání Lolly

Otevři nástroj, uprav, co ti dovolí upravit, ulož výsledek a sdílej ho odkazem nebo jako soubor.

Všechno běží na tvém zařízení bez účtu a po stažení potřebných nástrojů a assetů funguje i offline. Ke spuštění je potřeba prohlížeč nebo aplikace s WebGPU. Otestované možnosti uvádějí [Podporovaná prostředí](/info/supported-environments.html).

**Celý postup** ve čtyřech krocích:

::: steps
- <!--i:eti-home--> **[Otevři nástroj](#find-your-way-around)** Klikni na kartu na domovské obrazovce. Vedle živého náhledu najdeš ovládací prvky.
- <!--i:eti-sliders--> **[Změň vstupy](#change-what-the-tool-lets-you-change)** Jen ty, které autor nechal přístupné. Kliknutím na návrh najdeš jeho ovládací prvek.
- <!--i:eti-folder-plus--> **[Ulož svou práci](#saving-continuing)** **Save** ji uchová v My library a Projects ji znovu otevře.
- <!--i:eti-link--> **[Sdílej návrh](#sharing-your-work)** Odkaz se všemi vstupy nebo jeden soubor `.lolly`.
:::

<!--i:eti-home-->
## Zorientuj se

::: figure using-app-map
Domovská obrazovka má nahoře čtyři karty a dole lištu. V otevřeném nástroji jsou ovládací prvky vedle živého náhledu.
:::

V horní části domovské obrazovky jsou čtyři karty: **Tools**, **Utilities**, **Assets** a **Projects**. Tools slouží k tvorbě. Utilities převádějí, kontrolují nebo čistí soubory. Assets je tvá knihovna. Projects uchovává uloženou práci.

Na dolní liště najdeš **Open**, **Settings**, vyhledávací pole, zkratku **Verify** do Lolly Verify a **Docs**, které otevře tyto průvodce. Lišta je vidět v Tools, Utilities, Assets, Projects, Settings a průvodcích v aplikaci a po otevření nástroje se skryje. [Lolly Search](/info/search.html) z tohoto pole vyhledává nástroje, uloženou práci, assety a nastavení. [Ask Lolly](/info/ask.html) na napsanou otázku odpoví odpovídající sekcí těchto průvodců.

Klikni na kartu a začni v daném nástroji novou práci. Uloženou práci znovu otevřeš z **Projects**. Při první návštěvě nabízí uvítací pruh nahoře v galerii jednu akci pro začátek: **Start making** v Lolly Demo nebo **Make it yours** pro nastavení vlastního designového systému.

![Karta v galerii s ukázkovou navigací a akcí New](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Každý nástroj má rozdělené zobrazení: na jedné straně jsou **ovládací prvky** a na druhé živý **náhled**. Při změně ovládacího prvku se náhled aktualizuje a export odpovídá tomu, co vidíš.

![Rozdělené zobrazení nástroje - vlevo sloupec ovládacích prvků a vpravo živý skupinový sloupcový graf, který nástroj vykresluje](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Lolly Design** tvoří výjimku: volné plátno s poli, která přetahuješ, měníš jejich velikost a píšeš do nich, s vlastní horní lištou, časovou osou a ovládáním sady snímků. Provede tě jím [Lolly Design: volné plátno](/info/design.html).

<!--i:eti-sliders-->
## Změň, co ti nástroj dovolí měnit

Nástroj zobrazuje jen vstupy určené ke změnám. Autor pevně nastavil barvy, rozvržení, písmo a logiku, takže se tvá práce drží jeho pravidel. Vstupy zahrnují text, posuvníky, výběry barev, rozbalovací nabídky, data, výběry obrázků a opakující se skupiny řádků. Některé najdeš ve sbalitelných sekcích.

![Sloupec ovládacích prvků nástroje - textové pole, spouštěče výběru barev a posuvník, bez dalších prvků, které autor zamkl](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Kliknutím na návrh najdeš jeho ovládací prvek.** Když klikneš na prvek v náhledu, jeho ovládací prvek se posune do zobrazení a získá fokus. V opakující se skupině řádků se otevře řádek, na který jsi klikl.

**Clear changes** nad ovládacími prvky obnoví výchozí hodnotu všech vstupů.

**Volby designového systému.** Pokud tvůj designový systém nabízí několik colourways, světlý a tmavý vzhled nebo jinou volbu motivu, najdeš je v sekci **Design system** pod ovládacími prvky. Volba se zobrazí jen tehdy, pokud daný nástroj mění, takže souborová utilita tuto sekci nemá. Každý colourway zastupuje tečka v jeho barvách, světlý a tmavý vzhled dvě tlačítka a ostatní volby seznam.

Volba patří k tomuto dílu. Přenáší se v odkazu i uložené relaci. Řídí se jí všechny barvy propojené s designovým systémem, zatímco vlastní barvy aplikace zůstávají stejné. V Lolly Design najdeš stejné volby v Inspectoru na kartě **Canvas**. Nástroj, jehož obsahem jsou barvy, může zůstat u kanonického colourway a pak tečky colourways nezobrazuje. [Lolly Demo v praxi](/info/lolly-demo-in-use.html#colourways-on-real-work) předvádí colourways na skutečné práci. Chceš-li stejný colourway používat v aplikaci i pro každé nové dílo, vyber ho v **Settings → Appearance** ([Nastav si vlastní colourway](/info/colourways.html#make-a-colourway-your-own)).

### Zvětšování a posouvání náhledu

- **Zvětšení:** podrž Cmd/Ctrl a otáčej kolečkem nebo použij štípnutí na trackpadu, se středem na ukazateli. Na klávesnici `0` nebo `Shift+1` přizpůsobí vše, `1` nebo `Shift+0` nastaví 100 % a `Shift+2` přizpůsobí výběr. `+` / `−` mění zvětšení kolem ukazatele, pokud je nad scénou, jinak kolem středu.
- **Posun:** drž **Space** a táhni nebo táhni prostředním tlačítkem myši. Běžným kliknutím můžeš dál vybírat části návrhu.
- **Dotyk:** štípnutí mění zvětšení, tažení posouvá a dvojité klepnutí přizpůsobí zobrazení.
- **HUD zvětšení:** podržením spirály Lolly v rohu rozbalíš `−`, **Fit** a `+`. Krátkým klepnutím na spirálu se stále otevírá nabídka profilu.

V Lolly Design bere **Fit all** v úvahu kreslicí plochy i volné vrstvy. Při ručním oddalování může zvětšení klesnout pod 20 %, dokud stránka nezabere polovinu zobrazení. Pevný limit je nižší z hodnot 5 % běžného měřítka Fit a 2 % absolutního zvětšení.

Při změně velikosti výstupu se zobrazení vždy znovu přizpůsobí.

![HUD zvětšení rozbalený ze spirály v rohu plátna - minus, Fit, plus, potom přepínače motivu a zvuku a úchyt pro přesouvání](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Zpět a znovu

**Cmd/Ctrl-Z** provede krok zpět a **Cmd/Ctrl-Shift-Z** (nebo **Cmd/Ctrl-Y**) krok vpřed. Tlačítka **Undo** a **Redo** jsou nad ovládacími prvky, v Lolly Design pak na horní liště. Každé zešedne, když už pro něj nezbývá žádný krok. Zpráva s tlačítkem **Redo** uvádí, který vstup daný krok zpět obnovil.

- **Jedno tažení je jeden krok.** Opakované změny stejného ovládacího prvku během půl sekundy se spojí do jediného kroku.
- **Zachovává se posledních 100 kroků.** Nová úprava po kroku zpět vymaže zásobník kroků vpřed.
- **V textovém poli** zpracovává Cmd/Ctrl-Z samotné pole, znak po znaku. U posuvníků, rozbalovacích nabídek, barev a přepínačů ho zpracovává Lolly.
- **Zvolení souboru** v souborovém vstupu není krok, protože jeho bajty se uchovávají jen po dobu této relace.

Při živé [spolupráci](/info/collaborate.html) se změna z druhého zařízení nikdy nezapíše do tvého zásobníku kroků zpět. Kroky zpět jsou dostupné, dokud nástroj neopustíš nebo znovu nenačteš. Pro starší změny uchovávají nástroje s průběžným ukládáním předchozí verze v **History** ([Vrať se k dřívější verzi](/info/find-your-work.html#go-back-to-an-earlier-version)).

### Živá kamera

Efekty nástroje **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art a Glitch) nabízejí tlačítko **Go live**, pokud je dostupná kamera. Zapni ho a efekt bude snímek po snímku sledovat tvou webkameru. Pohybový export zaznamená výsledek jako GIF, WebM nebo MP4. Snímky se zpracovávají na tvém zařízení. Jakmile záznam zastavíš nebo nástroj opustíš, kamera se uvolní. Každý výběr obrázku nabízí i **Take a photo** pro pořízení jediného snímku.

<!--i:eti-folder-plus-->
## Ukládání & pokračování

Svou práci uchováš stisknutím **Save**, zatržítka vedle **Export** na pilulce vykreslení. Nová práce se uloží do **My library**, už uložená práce se aktualizuje na svém místě a nic se nestahuje. Stejné tlačítko **Save** najdeš i v panelu exportu.

Místo uložení vybereš stisknutím **Save as** vedle **Download** v panelu exportu. Pod **Save to a project** ponech **My library** nebo vyber projekt (**＋ New project…** vytvoří nový) a pak stiskni **Save**. Volba **Save as a template** uchová návrh jako [šablonu](/info/templates.html), ze které můžeš tvořit nové dokumenty. V Lolly Design najdeš **Save as** v nabídce Lolly. Na telefonu stiskni **•••**, potom **File menu** a potom **Save as**.

![Dvě poloviny pilulky vykreslení: Export se šipkou nahoru pro otevření panelu exportu a Save se zatržítkem pro uložení na místě](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Na pilulce vykreslení stiskni **Save**, nebo zvol **Save as** a vyber projekt.
- <!--i:folder--> Položka se uloží do **My library** nebo do vybraného projektu.
- <!--i:home--> Až se budeš chtít vrátit, stiskni vlevo nahoře **Home** a otevři kartu **Projects**.
- <!--i:document--> Otevři položku. Všechna nastavení se obnoví a můžeš je znovu měnit a exportovat.
:::

Položky dostanou název souboru zadaný v panelu exportu, jinak název svého nástroje, například **QR Code**. Soubor z **Download** je hotová kopie. Pro pozdější úpravy otevři uloženou položku v Projects.

::: note Uložená práce zůstává na tomto zařízení
Osobní uložená práce zůstává na tomto zařízení v prohlížeči nebo aplikaci, kde jsi ji uložil, pokud nezapneš [Sync](/info/sync.html).
:::

Pokud něco není tam, kde to čekáš, [Najdi a obnov svou práci](/info/find-your-work.html) popisuje všechny případy od zavřené karty po vymazaná data prohlížeče.

::: details Týmové projekty s Lolly Work (volitelné)
Pokud tvá [organizace používá Lolly Work](/info/organisation.html), přihlas se k její instanci a otevři **Projects → Team projects**, kde najdeš relace sdílené s tebou. Organizace určuje přístup a dobu uchovávání a tyto relace ukládá její služba Lolly Work. Pokud organizace povoluje živé úpravy, otevřením sdílené relace se připojíš k její živé spolupráci. Postup vysvětluje [Společná práce](/info/collaborate.html#collabs-through-lolly-work-optional).

Tvá osobní knihovna zůstává oddělená. Přihlášením na jiném zařízení získáš přístup k týmové práci. K přenosu osobní uložené práce stále potřebuješ Sync nebo zálohu.
:::

<!--i:eti-link-->
## Sdílení tvé práce

Návrh můžeš sdílet odkazem nebo souborem. **Share** v ovládání exportu otevře dialog s oběma možnostmi. **Share link** u uložené relace v Projects otevře stejný dialog pro tuto relaci. Po odeslání souboru na Google Drive, Nextcloud, do bucketu S3, na Dropbox nebo OneDrive může dialog vytvořit odkaz i přes danou službu ([Export souboru](/info/exporting.html#how-export-works)).

::: cols
## Odkaz

- Obsahuje všechny vstupy v adrese, takže odkaz znovu vytvoří návrh.
- Nezahrnuje obrázky a soubory přidané z tohoto zařízení, velmi dlouhý text ani velmi rozsáhlé seznamy.
- Otevře se v každém prohlížeči, takže ho můžeš uložit do záložek, vložit nebo zahrnout do commitu.

## Soubor .lolly

- Obsahuje uloženou relaci s obrázky a soubory z tohoto zařízení a může obsahovat i nástroj a designový systém.
- Nezahrnuje licencovaná díla z katalogu, pokud nezvolíš zahrnutí jejich souborů.
- Otevírá se v Lolly: dvojklikem, přes **Open** nebo přetažením do aplikace.
:::

### Odkaz

Odkaz je nahoře v dialogu spolu s tlačítky **Copy** a **QR**, které otevře nástroj QR Code s tímto odkazem. Pod odkazem najdeš v **Link options** tyto volby:

- **Open in the installed app** změní odkaz na adresu `lolly://` pro Shortcuts, spouštěče a automatizaci. Všechny parametry zůstanou beze změny.
- **Shortest link** zabalí dlouhý návrh do kompaktního tokenu a ukáže počet ušetřených znaků. Čitelná podoba zůstane dostupná.
- **Password-protect this link** zašifruje odkaz na tvém zařízení pomocí AES-256. Heslo nikdy není součástí odkazu.
- **Pin this tool version** přidá příznak `_v`, takže pozdější aktualizace nástroje nezmění vykreslení odkazu.
- **When the recipient opens the link…** umožňuje zvolit celou obrazovku, už rozbalený panel exportu, stažení při otevření (`&export`) nebo zkopírování do schránky (`&copy`).
- **Copy credit** zkopíruje popisek „Vytvořeno v Lolly“ s odkazem pro příspěvek nebo snímek.

Pokud nástroj obsahuje osobní pole, například tvé jméno, **Review personal fields** každé z nich vynechá z odkazu, dokud ho nezaškrtneš. Vše, co může odkaz obsahovat, popisuje [Režim URL](/info/url-mode.html).

**Dialog uvádí, co odkaz nemůže obsahovat.** Při tvorbě odkazu Lolly počítá vše, co se do adresy nevejde. Pokud něco vynechá, dialog vypíše vynechané položky a odkáže tě na možnost sdílení souborem. U odkazu, který je jen dlouhý, zobrazí mírnější upozornění s počtem znaků.

**U některých nástrojů je odkaz celým výsledkem.** Jump Page spojí tvé odkazy do jedné stránky ke sdílení: odkazu v profilu, přednášky nebo výlohy obchodu. Stránkou je samotný odkaz, takže nic není hostované a za stránkou není žádný účet. Návštěvník vidí stránku přes celou šířku a při posouvání prochází scénami s jedním odkazem v každé.

![Jump Page v editoru: scéna s nadpisem nahoře na stránce a pod ní scény s odkazy](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Odkazy spravované organizací v Lolly Work
Pro sdílení, které vyžaduje vypršení platnosti, odvolání nebo heslo, nabízí Lolly Work spravované odkazy na sdílené relace, nástroje a assety z katalogu. Otevírají se přes službu organizace a řídí se jejími pravidly přístupu. Jsou oddělené od výše uvedených samostatných odkazů. Odvolání odkazu nevrátí soubor, který už někdo stáhl. Typy odkazů a oprávnění uvádí [Vykreslování a sdílení](/info/manage/sharing.html).
:::

### Soubor .lolly

**Download .lolly** v sekci **Editable file** dialogu Share zapíše aktuální návrh do jediného souboru. Běžná díla z katalogu se zahrnou spolu s obrázky a soubory z tohoto zařízení. Zastaralý nebo nedostupný soubor zůstane externím odkazem. Před uložením dialog ukáže velikost souboru, počet vložených souborů, počet odkazovaných souborů a to, zda je zahrnutý nástroj. Pokud má zařízení systémový panel sdílení, **Send to…** mu soubor předá (AirDrop, sdílení v Androidu).

**Download project (.lolly)** v nabídce složky v **Projects** zapíše celou složku, takže někdo jiný může pokračovat v práci se všemi jejími relacemi. Dávkové relace se vynechají a oznámení uvede jejich počet. **Download originals** ve stejné nabídce vytvoří běžný zip, ve kterém je každá položka samostatným souborem.

Než soubor odešleš, rozhodneš o třech věcech:

- **Zda se zahrne tvé jméno.** Tvé jméno, e-mail a organizace se zapíšou jen tehdy, když máš ve [svém profilu](/info/profile.html) zapnuté **Use my details to create**. Pokud je volba vypnutá, soubor zaznamená jen to, že vznikl v Lolly a kdy.
- **Zda se zahrnou vynechávaná díla.** Licencovaná díla a díla uzamčená pro značku se ve výchozím stavu nezahrnují. Totéž platí pro dílo z katalogu, jehož zaznamenanou licenci Lolly zatím neumí přečíst. Pokud návrh taková díla používá, dialog uvede jejich počet a nabídne *Download without them* nebo *Include and download*. Jejich zahrnutím předáš soubory každému, kdo `.lolly` otevře. Dílo z katalogu bez záznamu o právech se zahrne a dialog každé takové dílo vypíše, abys je mohl před odesláním zkontrolovat. Soubor `CREDITS.txt` uvádí, co se zahrnulo a co ne, i s důvody. Pravidla vysvětlují [Autorská práva a uvedení autorství](/info/creative-rights.html).
- **Zda se zahrne nástroj.** **Include the tool** přibalí vlastní soubory nástroje, takže se návrh otevře i na zařízení, které tento nástroj nemá. U vlastního nástroje, například forku, je volba zpočátku zaškrtnutá, u nástroje uvedeného v podepsaném katalogu nezaškrtnutá. V sestavení bez podepsaného katalogu se každý nástroj považuje za vlastní.

**Otevření souboru.** V desktopové nebo mobilní aplikaci na `.lolly` dvakrát klikni nebo klepni, zvol **Open with Lolly** nebo soubor pošli do Lolly ze systémového panelu sdílení. Ve webové aplikaci stiskni **Open** nebo soubor přetáhni do Lolly. Každý z těchto postupů nejprve přečte manifest souboru a před jakýmkoli zápisem ukáže velikost, obsah a to, co se stane.

::: warning Instalace nástroje spustí jeho kód
Pokud soubor obsahuje nástroj, který nemáš, **Trust this tool?** zobrazí nástroj a jeho autora a upozorní, že otevřením spustíš vlastní kód nástroje na svém zařízení. **Trust & install** pokračuje v instalaci.
:::

Pokud odmítneš, práce se i tak uloží do Projects a počká, dokud nástroj nepřidáš. Nástroj, jehož kód se dodává jako modul, zatím nelze tímto způsobem nainstalovat a je stejným způsobem odmítnut.

::: details Co obsahuje .lolly a jak se otevírá
`.lolly` je přípona balíčků Lolly a `format` v souboru `manifest.json` určuje, co je uvnitř:

- **Sdílený návrh** (`lolly-share`) obsahuje jednu uloženou relaci, její vložené soubory a záznam o všem, co se stále načítá přes odkaz. Může obsahovat i nástroj a designový systém. Otevřením se přidá nový projekt a nikdy se nepřepíše relace.
- **Sdílený projekt** (`lolly-share`, druh `project`) obsahuje složku z Projects: její podsložky, všechny relace v nich s jejich dlaždicemi a uložené obrázky. Otevřením se přidá kopie složky. Každá relace se přenáší jako `sessions/<key>.json` se svou dlaždicí v `thumbs/`. Verze Lolly z doby před zavedením projektových souborů tě požádá o aktualizaci.
- **Balíček designového systému** (`lolly-brand`) obsahuje tokeny a může obsahovat písma, loga, publikované verze a uchovávané zdroje. Otevřením balíčku se přidá samostatný pojmenovaný designový systém a nastaví se jako aktivní.
- **Balíček pracovního prostoru nebo instance** je `lolly-brand` s deklarovanými nástroji, assety z katalogu a volitelně adresou instance. Jeho načtením se nahradí jediná dříve načtená překryvná vrstva pracovního prostoru a náhled vypíše tyto dopady na celé zařízení.

Úplná záloha zařízení není `.lolly`. Zůstává souborem `LollyTools-….zip` (formát `lolly-backup`) a obnovuje se přes **Settings → Storage → Import data…**. Složka nástroje zabalená do zipu také zůstává `.zip`. Přehled formátů najdeš v [Přenosu dat](/info/data-transfer.html).

Soubor `.lolly` je běžný zip. Přejmenuj ho na `.zip`, abys viděl dovnitř. Vlastní obrázky najdeš v `assets/uploads/` a díla z katalogu v `assets/catalog/`. `manifest.json` vypisuje všechny soubory a README popisuje, o jaký soubor jde.

Formát se registruje v macOS, Windows, Linux, iOS i Android. Správci souborů na desktopu ho zobrazují jako dokument Lolly a GNOME Files umí zobrazit vlastní miniaturu uložené relace. Při otevření z Lolly Design System Setup se doporučí akce pro designový systém, pokud ho sdílený návrh obsahuje, ale **Open shared design** se nikdy neskryje.

V iOS a Android je dokument předaný z jiné aplikace omezen na 48 MB a aplikace na to upozorní. Při předání se jeho bajty kopírují přes hranici aplikací. **Open** uvnitř Lolly toto omezení nemá, takže ho použij pro větší balíček.

Po potvrzení Lolly balíček jednou rozbalí a ověří. Assety se uloží do tvé knihovny a porovnají podle kontrolního součtu, takže soubor už přítomný na zařízení se použije znovu. Relace se uloží do Projects s novými identifikátory, takže stejný soubor můžeš otevřít dvakrát. Relace, jejíž nástroj chybí, tam počká. Soubory nad 100 MB se označí jako velké a náhled varuje, pokud úložiště prohlížeče hlásí méně volného místa, než soubor potřebuje. Než se cokoli zapíše natrvalo, ověří se každá část zahrnutá do kontroly integrity. Poškozená kopie se odmítne a nic po ní nezůstane.
:::

Odkaz i soubor předávají snímek aktuálního stavu. Pro živé úpravy popisuje [Společná práce](/info/collaborate.html) soukromou spolupráci mezi dvěma zařízeními a volitelnou pracovní spolupráci přes Lolly Work.

<!--i:eti-images-->
## Assety - tvá knihovna

**Lolly Assets** (`#/a`) obsahuje vše, z čeho mohou tvé nástroje čerpat: loga značky, obrázky, zvuk a animace seskupené podle druhu i tvé vlastní soubory. Nahrané soubory se ukládají na tvém zařízení. Organizace používající Lolly Work může také poskytovat sdílený katalog podle vlastních pravidel přístupu ([Používání Lolly v organizaci](/info/organisation.html)).

![Assets se vzorníky a písmy značky a tvými nahranými soubory](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Přidej své soubory.** Přetáhni obrázek, SVG, zvukový klip, video, Lottie, PDF nebo prezentaci PowerPoint do oblasti pro nahrávání nebo klikni a vyber soubor. Soubor se ihned objeví v Assets a ve výběru assetů každého nástroje. U vícestránkového PDF nebo `.pptx` vybereš, které stránky či snímky zachovat. Každý se stane assetem SVG. Obrázek přidaný uvnitř nástroje se beze změny uchová v **My images**, takže jeho Content Credential lze stále ověřit. Jen u velmi velkého souboru se objeví dotaz na změnu velikosti. **Settings → Storage** ukazuje, kolik místa zabírá **My images**. Jediným omezením je kapacita úložiště tvého zařízení. Chceš-li při nahrávání odstranit data EXIF a GPS, zapni **Strip metadata from uploads** v **Settings → Feature flags**. Content Credentials se zachovají v obou případech.
- <!--i:star--> **Označ si oblíbené položky.** Přidej hvězdičku k assetu nebo barvě ze vzorníku značky a připne se nahoru v každém výběru.
- <!--i:folder--> **Udělej si pořádek.** Přesuň asset do jiné skupiny, skryj sdílený asset značky, který nepoužíváš (**Show hidden** ho vrátí), nebo smaž vlastní nahrané soubory. Na celý výběr působí stejná lišta výběru jako v Projects.
- <!--i:layers--> **Odděl video od pozadí.** Otevři podrobnosti videa nebo klikni pravým tlačítkem na jeho kartu ve výběru assetů a zvol **Remove background…**. **On-device model** vyřízne objekt z členité scény. **Colour key** odstraní rovnoměrně osvětlené pozadí, například zelené plátno, a nevyžaduje stahování. **Tolerance**, **Softness** a **Spill removal** doladí okraj. **Resolution** (360, 480, 720 nebo 1080p, nikdy nad rozlišení zdroje) určuje poměr mezi detaily a rychlostí. Výřez je animovaný WebP nebo PNG s průhledností a uloží se vedle originálu. Content Credential zdroje se přenese do výřezu jako součást vstupního materiálu. [Jednou vygenerováno, pokaždé stejně vykresleno](/info/ai-features.html) vysvětluje, proč jde stále o běžnou úpravu.

### Vezmi si paletu a písma kamkoli

Panel **Swatches** v Assets ukazuje barvy tvé značky: barvy značky, barvy přidané tebou, barevné škály a spektrum. Barvy rolí, které Lolly vyhrazuje pro rozhraní (text, povrchy, okraje, hlavní barvy colourway a kopie barvy značky pod jiným názvem), najdeš pod šedou kartou **Show colour roles** dole v panelu.

Každá barva má kartu jako každý jiný asset. Kliknutím otevři její podrobnosti, vyber několik barev ke stažení nebo stáhni celou paletu ve formátu, který umí číst tvůj další nástroj:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** nebo **CSS classes** pro stylopis nebo sestavení. Barva mimo rozsah sRGB si zachová svou širokogamutovou hodnotu: CSS ji nastaví za hexadecimálním zápisem a JSON uchová hexadecimální zápis spolu se širokogamutovou barvou, složením CMYK a přímou barvou.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)** pro Illustrator nebo Photoshop. Barva vázaná na složení CMYK se přenese jako příslušný vzorek CMYK, přímá barva jako pojmenovaný vzorek přímé barvy a barva mimo rozsah sRGB jako Lab.
- <!--i:pentool--> **GIMP palette (.gpl)** pro GIMP nebo Inkscape a **SCSS variables**, obojí v sRGB.

![Panel Swatches: nahoře pět tlačítek pro stažení palety, pod nimi každá barva značky jako čip, který otevírá její podrobnosti](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

::: details Vyber několik barev nebo otevři podrobnosti jedné barvy
Barvy vybereš tečkou na každé kartě: kliknutí na druhou tečku se Shiftem vybere vše mezi nimi. Můžeš také táhnout výběrový obdélník přes mezery nebo stisknout Cmd/Ctrl+A, když má karta fokus. Lišta nabízí **Download as…** ve stejných šesti formátech, **Copy hex** a **Favourite**. Než zvolíš formát, nabídka vypíše barvy, které žádný formát nepojme (Transparent nemá barvu), formáty ukládající širokogamutovou barvu jako její náhradu v sRGB (SCSS a GIMP) a formáty přenášející hodnoty CMYK a přímých barev (JSON a .ase). Kliknutím pravým tlačítkem na kartu získáš stejné akce pro jednu barvu.

Podrobnosti barvy vyplní náhled danou barvou a rozbalí **Linked values** (její složení CMYK nebo přímou barvu, hodnoty určené pro konkrétní prostor či tiskový stroj a její designový token), **Every notation** (hexadecimální zápis, OKLCH, Display-P3 a další, každý s tlačítkem pro kopírování), **Plotted on a colour space**, **Tones** a **Readability**. Šipkami procházíš paletu, **Copy link** sdílí barvu a **Open in Colour Lab** ji otevře pro další práci.
:::

Panel **Fonts** vypisuje písma tvé značky a u každého nabízí **download** pro místní instalaci nebo předání tiskárně.

<!--i:eti-grid-->
## Přizpůsob si mřížku

- <!--i:star--> **Označ si oblíbené nástroje.** Klikni pravým tlačítkem na kartu a zvol **Add to favourites**. Nástroj dostane velkou dlaždici v pruhu nad mřížkou. Tento pruh popisují [Tvé oblíbené](/info/favourites.html).
- <!--i:eyeoff--> **Skryj nástroj, který nepoužíváš.** Klikni pravým tlačítkem na kartu nebo vyber více karet a zvol **Hide tool**. Zmizí z mřížky i z výsledků hledání psaním v mřížce. Nástroj opustí mřížku a při psaní v ní se už nebude zobrazovat jako shoda. Šedá dlaždice **Show hidden tools (N)** na konci znovu zobrazí skryté nástroje, ztlumené a každý s volbou **Unhide tool** v nabídce. Skrytím se mění jen tvá mřížka: nástroj se dál otevře z odkazu nebo záložky.
- <!--i:clock--> **Tvé nástroje jako první.** Jakmile uložíš práci ve třech různých nástrojích, řádek čipů **Yours** nad mřížkou nabídne nejdřív tvé oblíbené a nedávné nástroje.
- <!--i:sliders--> **Uspořádej si zobrazení.** **View options** nastavuje rozvržení (**Grid**, **Card** nebo **List**), velikost a hustotu karet, pořadí řazení a filtr kategorií.

![Konec mřížky Tools se zobrazenými skrytými nástroji: ztlumená karta Wordmark a vedle ní šedá dlaždice, která ji znovu zobrazila, nyní s textem Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
<!--
SHOT NOTE (misc-hidden-tools): the trailing `press:End` is required. The
hidden box and the revealed cards live at the very END of the grid, and
clicking the box runs applyView(), which re-lays the grid out and drops the
scroll back to the top - so without it the frame published the TOP of the
gallery under a caption about its bottom. `press:` with no `on=` goes to the
keyboard, and the End key with focus on the just-clicked box scrolls the
document; the walker then anchors the body walk to that band.
The tile reads "HIDE hidden tools" in the shot, not "Show" - it is a toggle and
the recipe has just pressed the tile. The alt says so rather than quoting the resting
label the prose above already gives.
The recipe hides nothing itself. The lolly-demo catalog the captures pin
ships Wordmark hidden (`defaultHiddenTools` in its assets index.json), so a
fresh profile already has one hidden tool and the recipe only clicks the grey
reveal tile (`.gtile--hiddenbox`, confirmed in gallery.ts). It used to tick
the QR Code card and press the bulk bar's Hide button first; under lolly-demo
that published Wordmark dimmed and QR Code not, under a caption naming QR
Code, so the steps were dropped rather than relied on. QR Code was hidden
in that run too: the End scroll had left the pointer over its card, and a
hovered hidden card lifts its dimming (gallery.css), so it read as a normal
tool. The closing `hover:` puts the pointer back on the reveal tile, which
keeps every revealed card dimmed.
-->

**Pracuj s více kartami najednou.** Zaškrtni políčko na každé kartě, táhni výběrový obdélník přes prázdné místo nebo klikni se Shift/Cmd. Objeví se lišta s akcemi, které dané zobrazení umožňuje:

- **Tools a Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects zobrazující jen relace vytvořené těmito nástroji) a Copy link pro jednu kartu.
- **Assets:** Favourite a Hide pro libovolný výběr. Duplicate, Download a Delete se objeví jen tehdy, když jsou všechny vybrané položky tvé vlastní nahrané soubory, protože sdílený asset designového systému představuje trvalý závazek.
- **Projects:** viz [Najdi a obnov svou práci](/info/find-your-work.html#find-something-you-saved).

![Lišta výběru galerie pro dva nástroje s akcemi Available offline, View sessions, Favourite a Hide](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** se objeví jen při aktivním výběru. Klikni pravým tlačítkem na jednu nevybranou kartu a zvol **N saved sessions**: seznam uložených relací daného nástroje, ve kterém smazání přesune relaci do koše.

<!--i:eti-layers-->
## Na telefonu

Na úzké obrazovce se rozvržení změní na jeden sloupec:

- **Ovládací prvky se přesunou do panelu** nahoře s úchytem pro tažení na spodním okraji. Přetažením úchytu panel přichyť do polohy **peek**, **half** nebo **full**, nebo ho klepnutím sbal a rozbal. Náhled vyplňuje prostor pod ním a během úprav zůstává viditelný.
- Plovoucí tlačítko **Export** otevře panel exportu: formát, velikost, kopírování, uložení a stažení. Klepnutím na pozadí panel zavřeš.

![Nástroj na obrazovce o šířce telefonu: nahoře panel s ovládacími prvky, pod ním vygenerovaná paleta vyplňující náhled a dole uprostřed plovoucí pilulka vykreslení](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

<!--i:eti-copy-->
## Skládací zařízení a iPhone Duo

Na skládacím zařízení, iPhone Duo nebo téměř čtvercové dotykové obrazovce rozdělí Lolly nástroj do dvou panelů:

- **Ovládací prvky na jedné straně, plátno na druhé.** Ovládací prvky jsou dál od ruky, kterou kreslíš. Zvol **Dominant hand** v **Settings → Accessibility** nebo stiskni **Swap sides** nahoře nad ovládacími prvky. V jazyce psaném zprava doleva se strany zrcadlově obrátí.
- **Dělicí čára leží v ohybu.** Pokud zařízení hlásí polohu ohybu, panely se setkají právě tam, takže přes ohyb nevede žádný ovládací prvek ani grafika. Na souvislé obrazovce přetáhni dělicí čáru na třetinu, polovinu nebo dvě třetiny šířky. Lolly si tvou volbu pamatuje pro každé zobrazení na tomto zařízení.
- **Na stole.** Pokud je zařízení napůl otevřené a ohyb vede napříč obrazovkou, plátno zabere horní polovinu a ovládací prvky se umístí pod ohyb. Při prezentování je snímek nahoře a tvé poznámky, další snímek a **Back** a **Next** dole. V Sequence je nahoře náhled a dole časová osa.
- **Lolly Design, Design System Setup a Assets.** V Lolly Design jsou inspektor, vrstvy a panel exportu kartami vedle plátna. Nástroje jsou podél vnějšího okraje plátna, pod rukou, kterou kreslíš. Pokud se nevejdou, sloupec lze posouvat a zeslabení se šipkou ukazuje směr ke zbývajícím nástrojům. Na stole vedou nástroje podél spodního okraje plátna. Lolly Design System Setup ponechává Board na jedné straně a otevřenou sekci na druhé. V Assets se podrobnosti assetu otevírají vedle knihovny, takže dalším klepnutím zobrazíš další asset na stejném místě.
- **V ohybu nic není.** Pokud zařízení hlásí ohyb, dialog se otevře na straně s ovládacími prvky. Totéž platí pro vyhledávací pole dole na domovské obrazovce a jeho výsledky. Na ploché obrazovce zůstávají uprostřed.
- **Složením nic neztratíš.** Složení, rozložení ani otočení zařízení nezmění tvůj dokument, výběr, zvětšení ani pole, do kterého jsi psal. Kurzor zůstane na místě.

Vnější obrazovka skládacího zařízení používá výše popsané rozvržení pro telefon. Stejně se chová okno Lolly v jedné polovině rozdělené obrazovky.

<!--i:eti-smile-->
## Nastavení, zvuk a pohodlí

**Settings** dole na domovské obrazovce obsahuje tvé údaje, designové systémy, přístupnost, úložiště a stahování pro práci offline. Všechny karty popisuje [Nastavení Lolly](/info/dashboard.html).

- **Tvé údaje a portrétní fotografie** se doplní do každého nástroje, který je umí použít, například e-mailového podpisu nebo jmenovky. Popisují je [Profily](/info/profile.html).
- **Accessibility** nabízí čtyři přepínače pro pohodlnější práci: **Reduce motion**, **Hide colourful previews**, **High contrast** a **Large text**. Mění prostředí aplikace kolem tvé práce, nikdy plátno nástroje ani export. Vedle nich **Dominant hand** určuje stranu ovládacích prvků při rozdělení do dvou panelů.
- **Sound** doprovází tvé akce jemnými pomocnými zvuky a **Neurospicy Mode** přehrává klidnou hudbu pro soustředění. Obojí je vypnuté, dokud to nezapneš v **Settings → Accessibility** nebo v nabídce profilu. Posuvník **Sound shape** pod přepínačem Sound mění zvuky od měkkých, kulatých kapek (Bouba) po suché tikání a škrábání (Kiki), se zvonky Lolly uprostřed. Skladby režimu Neurospicy zahrnují generované stanice Lolly: **Lolly Sings** s jeho žánry a tři **Lofi stations**. Stanice při přehrávání vytvářejí nekonečnou hudbu. Každá má ovládání bicích a textury (u Lofi i nálady), odkaz pro sdílení právě poslouchané melodie a tlačítko pro její uložení do assetů. Vznik melodie vysvětluje [Generovaná hudba](/info/generated-music.html). V **Music generator** v Utilities (`#/music`) si ji můžeš utvářet.
- **Available offline** stáhne zbytek aplikace, tvé nástroje, katalog a průvodce, než ztratíš připojení. Lolly nainstaluješ jako webovou aplikaci tlačítkem pro instalaci v prohlížeči nebo přes *Add to Home Screen* na telefonu. Nainstalovaná aplikace běží přes celou obrazovku a po opětovném připojení se sama aktualizuje.
- **Performance UI** v **Settings → Feature flags** přepne aplikaci na jednodušší vzhled, který je méně náročný na vykreslení. Plátna nástrojů a exporty zůstanou stejné. Na pomalém zařízení Lolly tento vzhled zapne samo a uvede důvod spolu s volbami **Undo** a **Keep** ([Performance UI](/info/configuration.html#curating-what-people-see)).
- **Storage** ukazuje, co Lolly uchovává na tomto zařízení. [Když vymažeš data prohlížeče](/info/find-your-work.html#if-you-clear-your-browser-data) vysvětluje, co se vymazáním odstraní, a [Zásady ochrany soukromí](/info/privacy.html) vypisují vše, co aplikace načítá nebo odesílá.

::: note Pokud se zobrazení po aktualizaci nenačte
Prázdný panel nebo zprávu „failed to fetch“ hned po aktualizaci obvykle vyřeší jedno opětovné načtení. Tvá uložená práce, relace a designové systémy zůstanou beze změny, protože jsou uložené na tvém zařízení. Jen obrázek, který jsi přidal a nikdy neuložil, může být nutné přidat znovu.
:::

<!--i:eti-map-pin-->
## Kam dál

- **[Lolly Design: volné plátno](/info/design.html)**: plátno, tvary, časová osa a prezentování sady snímků.
- **[Dávky a Lolly Multi-edit](/info/batch.html)**: mnoho verzí jednoho návrhu nebo společná úprava několika uložených návrhů.
- **[Export souboru](/info/exporting.html)**: výběr formátu, velikosti, tiskových jednotek, průhlednosti a videa.
- **[Import návrhu](/info/design-import.html)**: přenes soubor Figma, Penpot, Illustrator, InDesign, Affinity nebo DXF do Lolly Design a pokračuj v úpravách.
- **[Šablony](/info/templates.html)**: uložené výchozí návrhy pro nástroj.
- **[Široký gamut a HDR](/info/hdr-editing.html)**: zachovej původní přesnost obrazu v Lolly Design a Lolly Darkroom.
- **[Najdi a obnov svou práci](/info/find-your-work.html)**: kde vše najdeš a jak to přeneseš na jiné zařízení.
