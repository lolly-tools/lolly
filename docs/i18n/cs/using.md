# Používání Lolly

Máš otevřenou Lolly a chceš něco vytvořit, uložit a poslat dál. Tato stránka provádí touto smyčkou: otevři nástroj, změň, co ti dovolí měnit, ulož výsledek a sdílej ho jako odkaz nebo soubor.

Vše tady běží na tvém zařízení, bez účtu, a funguje dál offline, jakmile jsou stažené nástroje a assety, které potřebuješ. Aplikace ke spuštění potřebuje prohlížeč nebo aplikaci s WebGPU; [Podporovaná prostředí](/info/supported-environments.html) uvádějí otestovaná.

## Zorientuj se

::: figure using-app-map
Domovská obrazovka: čtyři karty nahoře a lišta dole. Otevřený nástroj ukazuje své ovládací prvky vedle živého náhledu.
:::

Nahoře na domovské obrazovce jsou čtyři karty: **Tools**, **Utilities**, **Assets** a **Projects**. Tools jsou to, čím tvoříš, Utilities jsou dílny pro úkoly jako převod, kontrola nebo vyčištění souboru, Assets je tvá knihovna a Projects drží, co jsi uložil.

Lišta dole obsahuje **Open**, **Settings**, vyhledávací pole, **Verify** a **What?**. Zobrazuje se na Tools, Utilities, Assets, Projects, Settings a v průvodcích, které čteš v aplikaci, a ustoupí, jakmile je nástroj otevřený. [Hledání](/info/search.html) z toho pole dosáhne na tvé nástroje, uloženou práci, assety a nastavení. [Ask Lolly](/info/ask.html) odpoví na napsanou otázku odpovídající částí těchto průvodců.

Kliknutím na kartu začneš něco nového v tom nástroji. Uložená práce se místo toho znovu otevírá z **Projects**.

![Karta galerie s ukázkovou navigací a akcí Nový](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&localize=1&dark=1&cropSelector=.gtile%5Bdata-tool-id%3D%22design%22%5D&filename=gallery&try=1)

Každý nástroj je rozdělené zobrazení: na jedné straně **ovládací prvky**, na druhé živý **náhled**. Změníš prvek a náhled hned následuje a to, co vidíš, se exportuje.

![Rozdělené zobrazení nástroje - sada ovládacích prvků vlevo a živě vykreslovaný skupinový sloupcový graf vpravo](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dbar%26t%3DExample%2520data%26st%3DSample%2520values%252C%2520not%2520a%2520real%2520dataset%26d%3DMonth%252CSeries%2520A%252CSeries%2520B%252CSeries%2520C%250AJan%252C12%252C9%252C5%250AFeb%252C18%252C14%252C7%250AMar%252C24%252C17%252C11%250AApr%252C29%252C23%252C15%26lg%3D1&width=1440&height=900&dpi=192&waitMs=2500&walker=1&format=svg&dark=1&filename=vt-tool-split-view)

**Design** je výjimka. Otevře se jako volné plátno z polí, která přetahuješ, měníš jim velikost a píšeš do nich, s vlastní horní lištou, časovou osou a ovládáním prezentace. Jeho průvodcem je [Design: volné plátno](/info/design.html).

## Změň, co ti nástroj dovolí měnit

Nástroj ukazuje jen vstupy, které se mají měnit. Jeho autor už pevně určil barvy, rozvržení, písmo a logiku, takže cokoli vytvoříš, drží jeho pravidla. Vstupy zahrnují text, posuvníky, výběry barev, rozbalovací nabídky, data, výběry obrázků a opakující se skupiny řádků a některé jsou ve sbalitelných sekcích.

![Sloupec ovládacích prvků nástroje - textové pole, spouštěče barev a posuvník a nic dalšího, co se autor rozhodl zamknout](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&cropSelector=%23tool-inputs&walker=1&format=svg&dark=1&filename=use-tool-inputs)

**Klikni na návrh a najdi jeho ovládání.** Klikni na libovolný prvek v náhledu a odpovídající ovládací prvek získá fokus a posune se do zobrazení. V opakující se skupině řádků se rozbalí přesně ten řádek, na který jsi klikl.

**Clear changes** nad ovládacími prvky vrátí každý vstup na výchozí hodnotu.

**Volby designového systému.** Když tvůj designový systém nabízí více než jeden colourway, světlý a tmavý vzhled nebo jinou volbu motivu, drží je sekce **Design system** pod ovládacími prvky. Volba se objeví, jen když mění tento nástroj, takže souborová utilita nezobrazí sekci vůbec. Každý colourway je tečka ve svých barvách, světlý a tmavý jsou dvě tlačítka a jakákoli jiná volba je seznam.

Volba patří tomuto dílu. Putuje v odkazu a v uložené relaci, následuje ji každá barva propojená s designovým systémem a vlastní barvy aplikace zůstávají, jak jsou. Design ukazuje stejné volby na kartě **Canvas** v Inspektoru. Nástroj, jehož barvy jsou jeho obsahem, může zůstat na kanonickém colourway a pak nenabízí žádné tečky colourway. [Lolly Demo v praxi](/info/lolly-demo-in-use.html#colourways-on-real-work) ukazuje colourways na skutečné práci.

### Zvětšování a posouvání náhledu

Náhled vždy zobrazuje přesně to, co se exportuje.

- **Zvětšení:** Cmd/Ctrl a kolečko nebo štípnutí na trackpadu, vystředěné na ukazatel. Na klávesnici `0` nebo `Shift+1` přizpůsobí vše, `1` nebo `Shift+0` nastaví 100 % a `Shift+2` přizpůsobí výběr. `+` / `−` mění zvětšení kolem ukazatele, pokud je nad scénou, jinak kolem středu.
- **Posun:** podrž **Space** a táhni, nebo táhni prostředním tlačítkem myši. Obyčejná kliknutí zůstávají volná pro klikání na části návrhu.
- **Dotyk:** štípnutím zvětšuješ, tažením posouváš a dvojitým klepnutím přizpůsobíš.
- **HUD zvětšení:** stiskni a podrž spirálu Lolly v rohu, aby se rozložily `−`, **Fit** a `+`. Krátké klepnutí na spirálu stále otevře nabídku profilu.

V Design zahrnuje **Fit all** kreslicí plochy i volné vrstvy. Ručně lze oddálit pod 20 %, dokud celá stránka nevyplní polovinu zobrazení. Pevná dolní mez je nižší z hodnot 5 % běžného měřítka Fit a 2 % absolutního zvětšení.

Změna velikosti výstupu vždy vrátí zobrazení na čisté přizpůsobení.

![HUD zvětšení rozložený ze spirály v rohu plátna - minus, Fit, plus, pak přepínače motivu a zvuku a úchyt, který jím pohybuje](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=.stage-nav%7Bopacity%3A1!important%7D&drive=drag%3A.stage-nav-profile%7Cdx%3D1%7Chold%3Bwait%3A700&cropSelector=.stage-nav&walker=1&format=svg&dark=1&filename=use-zoom-hud)

### Zpět a znovu

**Cmd/Ctrl-Z** vrací zpět a **Cmd/Ctrl-Shift-Z** (nebo **Cmd/Ctrl-Y**) vpřed. Stejná dvojice je jako tlačítka **Undo** a **Redo** nad ovládacími prvky (v Design jsou v horní liště) a každé zešedne, když už není co vzít zpět. Zpráva říká, který vstup každé vrácení obnovilo, s tlačítkem **Redo** ve zprávě.

- **Tažení je jeden krok.** Opakované změny jednoho prvku do půl sekundy se sloučí, takže přetažení posuvníku přes celý rozsah je jedno vrácení.
- **Uchovává se posledních 100 kroků.** Nová úprava po vrácení vymaže zásobník vpřed.
- **V textovém poli** patří Cmd/Ctrl-Z poli, znak po znaku. Lolly převezme posuvníky, rozbalovací nabídky, barvy a přepínače.
- **Výběr souboru** ve vstupu souboru není krok, protože ty bajty se drží jen pro tuto relaci.

V živé [spolupráci](/info/collaborate.html) tvá historie zůstává tvoje: změna z druhého zařízení se nikdy nedostane do tvého zásobníku. Vrácení trvá, dokud nástroj neopustíš nebo nenačteš znovu. Pro cokoli staršího uchovávají nástroje, které ukládají při práci, dřívější verze pod **History**; viz [Vrať se k dřívější verzi](/info/find-your-work.html#go-back-to-an-earlier-version).

### Živá kamera

Efekty nástroje **Filter** (Halftone, Scanline, Posterize, Voronoi, Duotone, Stretch, Misprint, Dither, ASCII art a Glitch) ukazují tlačítko **Go live**, kde je kamera k dispozici. Zapni ho a efekt sleduje tvou webkameru snímek po snímku a pohybový export zaznamená výsledek jako GIF, WebM nebo MP4. Snímky se zpracovávají na tvém zařízení a kamera se uvolní ve chvíli, kdy zastavíš nebo nástroj opustíš. Každý výběr obrázku má také **Take a photo** pro jediný snímek.

## Ukládání a pokračování

Chceš-li svou práci zachovat, stiskni **Save**, zatržítko vedle **Export** na pilulce vykreslení. Nová práce jde do **My library**, dříve uložená práce se aktualizuje na místě a nic se nestahuje. Panel exportu má stejné tlačítko **Save**.

Chceš-li vybrat, kam půjde, stiskni **Save as** vedle **Download** v panelu exportu. Pod **Save to a project** nech vybrané **My library** nebo vyber projekt (**＋ New project…** jej vytvoří) a stiskni **Save**; **Save as a template** uloží návrh jako [šablonu](/info/templates.html), výchozí bod nových dokumentů. V Design je **Save as** v nabídce Lolly; na telefonu stiskni **•••**, pak **File menu**, pak **Save as**.

![Dvoudílná pilulka vykreslení: Export se šipkou nahoru, která otevře panel exportu, a Save se zatržítkem, které uloží na místě](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools&width=1440&height=900&dpi=192&waitMs=2500&css=%23tool-inputs%7Bdisplay%3Anone%7D&cropSelector=.render-pill&walker=1&format=svg&dark=1&filename=use-render-pill)

::: timeline
- <!--i:check--> Stiskni **Save** na pilulce vykreslení nebo **Save as** pro výběr projektu.
- <!--i:folder--> Položka jde do **My library** nebo do projektu, který jsi vybral.
- <!--i:home--> Později stiskni **Home** vlevo nahoře a otevři kartu **Projects**.
- <!--i:document--> Otevři položku. Každé nastavení je zpět, připravené ke změně a dalšímu exportu.
:::

Položky se jmenují podle názvu souboru, který jsi napsal do panelu exportu, jinak podle svého nástroje, například **QR Code**. Soubor, který dostaneš přes **Download**, je hotová kopie; chceš-li jej později změnit, otevři uloženou položku v Projects.

Osobní uložení zůstávají na tomto zařízení, v prohlížeči nebo aplikaci, odkud jsi ukládal, pokud nezapneš [Sync](/info/sync.html). Pokud něco není tam, kde to čekáš, [Najdi a obnov svou práci](/info/find-your-work.html) pokrývá každý případ, od zavřené karty po smazaná data prohlížeče.

::: details Týmové projekty s Lolly Work (volitelné)
Pokud [tvá organizace používá Lolly Work](/info/organisation.html), přihlas se k její instanci a otevři **Projects → Team projects** pro relace sdílené s tebou. Přístup a uchovávání nastavuje organizace a relace ukládá její služba Lolly Work. Sdílená relace se při otevření připojí ke své živé kolaboraci, když to tvá organizace povoluje; kroky vysvětluje [Spolupráce](/info/collaborate.html#work-collabs-with-lolly-work-optional).

Tvá osobní knihovna zůstává oddělená. Přihlášení na jiném zařízení ti dá týmovou práci, ale osobní uložení potřebují k přenosu Sync nebo zálohu.
:::

## Sdílení tvojí práce

Návrh odchází jako odkaz nebo jako soubor. **Share** v ovládacích prvcích exportu otevře dialog, který nabízí obojí, a **Share link** u uložené relace v Projects otevře stejný dialog pro tu relaci.

::: cols
## Odkaz

- Nese každý vstup v adrese, takže odkaz návrh reprodukuje.
- Vynechá obrázky a soubory, které jsi přidal z tohoto zařízení, velmi dlouhý text a velmi velké seznamy.
- Otevře se v jakémkoli prohlížeči, takže odkaz můžeš uložit do záložek, vložit nebo commitnout.

## Soubor .lolly

- Nese uloženou relaci s obrázky a soubory z tohoto zařízení a může nést i nástroj a designový systém.
- Zadržuje licencované umění z katalogu, pokud nezvolíš zahrnutí souborů.
- Otevře se v Lolly: dvakrát na něj klikni, použij **Open** nebo ho přetáhni na aplikaci.
:::

### Odkaz

Odkaz připravený ke zkopírování je nahoře v dialogu s tlačítky **Copy** a **QR**, které otevře nástroj QR Code s tím odkazem. Pod odkazem obsahuje **Link options**:

- **Open in the installed app** přepne odkaz na adresu `lolly://` pro Zkratky, spouštěče a automatizaci, se všemi parametry beze změny.
- **Shortest link** zabalí dlouhý návrh do kompaktního tokenu a ukáže úsporu ve znacích. Čitelná podoba je tu vždy také.
- **Password-protect this link** zašifruje odkaz na tvém zařízení pomocí AES-256. Heslo není nikdy součástí odkazu.
- **Pin this tool version** přidá příznak `_v`, takže pozdější aktualizace nástroje nemůže změnit, co odkaz vykreslí.
- **When the recipient opens the link…** vybere celou obrazovku, už rozbalený panel exportu, stažení při otevření (`&export`) nebo zkopírování do schránky (`&copy`).
- **Copy credit** zkopíruje popisek "Made with Lolly" s odkazem, pro příspěvek nebo snímek.

Když nástroj drží osobní pole, například tvé jméno, **Review personal fields** drží každé z nich mimo odkaz, dokud toto pole nezaškrtneš. [Režim URL](/info/url-mode.html) pokrývá vše, co odkaz může nést.

**Dialog říká, co odkaz nést nemůže.** Obrázek nebo soubor přidaný z tohoto zařízení, velmi dlouhá textová hodnota a velmi velký seznam se do adresy nevejdou. Každé se počítá při sestavení odkazu. Pokud se muselo něco vynechat, dialog to vypíše a odkáže tě na volbu souboru, místo aby ti podal odkaz, který se otevře s chybějícím obrázkem. Odkaz, který je jen dlouhý, dostane mírnější poznámku s počtem znaků.

**Některé nástroje dělají z odkazu celý produkt.** Jump Page shromáždí tvé odkazy na jedné stránce k rozdávání: bio odkaz, přednáška, výloha obchodu. Nic se nehostuje a za stránkou není žádný účet, protože stránka je odkaz. Návštěvník ji dostane na celou šířku, jeden odkaz na scénu při rolování.

![Jump Page v editoru: scéna s nadpisem v horní části stránky a pod ní scény s odkazy](/t/url-shot?url=%2F%23%2Ftool%2Fjump%3Ffull%26heading%3DFind%2520us%2520everywhere%26subheading%3DOne%2520link%2520for%2520everything.%26links%3DURL%252CName%252CEmoji%257Ehttps%25253A%25252F%25252Fexample.com%252CWebsite%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fnews%252CNewsletter%252C%257Ehttps%25253A%25252F%25252Fexample.com%25252Fhello%252CSay%252520hello%252C&width=900&height=1300&dpi=96&waitMs=2000&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=use-jump-page)

::: details Odkazy spravované organizací s Lolly Work
Pro sdílení, které potřebuje platnost, odvolání nebo heslo, nabízí Lolly Work spravované odkazy na sdílené relace, nástroje a assety katalogu. Řeší se přes službu organizace a řídí se jejími pravidly přístupu. Jsou oddělené od samostatných odkazů výše a odvolání odkazu nemůže vzít zpět soubor, který si někdo už stáhl. [Vykreslování a sdílení](/info/manage/sharing.html) uvádí typy odkazů a oprávnění.
:::

### Soubor .lolly

**Download .lolly** v sekci **Editable file** dialogu Share zapíše aktuální návrh jako jeden soubor. Nese uloženou relaci s obrázky a soubory z tohoto zařízení a běžné umění z katalogu jede s ním. Zastaralý nebo nedostupný soubor zůstane externím odkazem, místo aby zmizel. Před uložením dialog ukáže velikost souboru, kolik souborů vkládá, na kolik odkazuje a zda je zahrnut nástroj. Kde má zařízení sdílecí list, **Send to…** mu soubor rovnou předá (AirDrop, sdílení Androidu).

**Download project (.lolly)** v nabídce složky v **Projects** zapíše celou složku, aby mohl někdo další pokračovat s každou relací ve složce. Dávkové relace zůstanou stranou a upozornění říká, kolik jich je. **Download originals** ve stejné nabídce zapíše obyčejný zip každé položky jako samostatný soubor.

Před odesláním souboru jsou tři věci na tobě:

- **Zda se zahrne tvé jméno.** Tvé jméno, e-mail a organizace se zapíšou, jen když je v [tvém profilu](/info/profile.html) zapnuto **Use my details to create**. Při vypnutí soubor zaznamená jen to, že vznikl v Lolly, a kdy.
- **Zda se zahrne zadržené umění.** Licencované umění, umění zamčené značkou a díla katalogu, jejichž licence nebyla nikdy zaznamenána, zůstávají ve výchozím stavu venku. Pokud návrh nějaké použije, dialog řekne kolik a nabídne *Download without them* nebo *Include and download*, protože jejich zahrnutí předává soubory tomu, kdo `.lolly` otevře. `CREDITS.txt` souboru vypisuje, co putovalo a co ne, s důvodem; pravidla vysvětluje [Tvůrčí práva a uvedení autorů](/info/creative-rights.html).
- **Zda se zahrne nástroj.** **Include the tool** zabalí vlastní soubory nástroje, takže se návrh otevře i na zařízení bez toho nástroje. U vlastního nástroje, například forku, začíná zaškrtnuto a u nástroje, který uvádí podepsaný katalog, nezaškrtnuto. V sestavení bez podepsaného katalogu se každý nástroj počítá jako vlastní.

**Otevření.** V desktopových a mobilních aplikacích dvakrát klikni nebo klepni na `.lolly`, zvol **Open with Lolly** nebo ho pošli do Lolly ze sdílecího listu. Ve webové aplikaci stiskni **Open** nebo přetáhni soubor na Lolly. Každá cesta nejprve přečte manifest souboru a ukáže jeho velikost, obsah a co se stane, než se cokoli zapíše.

Pokud soubor nese nástroj, který nemáš, **Trust this tool?** ukáže nástroj a jeho autora a uvede, že otevření spustí vlastní kód nástroje na tvém zařízení. **Trust & install** pokračuje. Odmítneš-li, práce se přesto uloží do Projects a čeká na den, kdy nástroj přidáš. Nástroj, jehož kód je dodáván jako modul, takto zatím nelze nainstalovat a je odmítnut stejným způsobem.

::: details Co .lolly obsahuje a jak otevření funguje
`.lolly` je přípona balíčků Lolly a `format` v jeho `manifest.json` říká, co je uvnitř:

- **Sdílený návrh** (`lolly-share`) obsahuje jednu uloženou relaci, její vložené soubory a potvrzení pro vše, co se stále řeší odkazem. Může nést také nástroj a designový systém. Otevření přidá nový Project a relaci nikdy nepřepíše.
- **Sdílený projekt** (`lolly-share`, druh `project`) obsahuje složku z Projects: její podsložky, každou relaci v nich s dlaždicí a obrázky tam založené. Otevření přidá kopii celé složky. Každá relace putuje jako `sessions/<key>.json` s dlaždicí pod `thumbs/`. Lolly z doby před soubory projektů tě požádá o aktualizaci.
- **Balíček designového systému** (`lolly-brand`) obsahuje tokeny a může obsahovat písma, loga, zveřejněné verze a uchované zdroje. Otevření balíčku přidá samostatný pojmenovaný designový systém a učiní jej aktivním.
- **Balíček pracovního prostoru nebo instance** je `lolly-brand` s deklarovanými nástroji, assety katalogu a volitelně adresou instance. Načtení jednoho nahradí jedinou vrstvu pracovního prostoru načtenou dříve a náhled vypisuje tyto účinky v celém zařízení.

Úplná záloha zařízení není `.lolly`. Zůstává `LollyTools-….zip` (formát `lolly-backup`) a obnovuje se přes **Settings → Storage → Import data…**. Zazipovaná složka nástroje také zůstává `.zip`. [Přenos dat](/info/data-transfer.html) je referencí formátu.

`.lolly` je běžný zip. Přejmenuj ho na `.zip` a podívej se dovnitř: tvé vlastní obrázky jsou pod `assets/uploads/`, umění z katalogu pod `assets/catalog/`, `manifest.json` vypisuje každý soubor a README říká, co soubor je.

macOS, Windows, Linux, iOS a Android formát registrují, správci souborů v desktopu ho ukazují jako dokument Lolly a GNOME Files umí zobrazit miniaturu uložené relace. Otevření z Design System Setup doporučí akci designového systému, když ji sdílený návrh nese, ale nikdy neskryje **Open shared design**.

Dokument předaný z jiné aplikace na iOS nebo Androidu je omezen na 48 MB, protože předání kopíruje jeho bajty přes hranici aplikace, a aplikace to oznámí. **Open** uvnitř Lolly takový limit nemá, použij jej tedy pro větší balíček.

Po potvrzení Lolly balíček jednou rozbalí a ověří. Assety jdou do tvé knihovny, spárované podle kontrolního součtu, takže soubor, který už na zařízení je, se znovu použije. Relace jdou do Projects s novými ID, takže stejný soubor lze otevřít dvakrát; relace, jejíž nástroj chybí, tam čeká. Soubory nad 100 MB jsou označeny jako velké a náhled varuje, když úložiště prohlížeče hlásí méně volného místa, než soubor potřebuje. Každá část krytá kontrolou integrity se ověří, než se cokoli potvrdí, a poškozená kopie se odmítne, aniž by cokoli zůstalo.
:::

Odkaz i soubor předávají snímek. Pro živé úpravy pokrývá [Spolupráce](/info/collaborate.html) soukromé kolaborace mezi dvěma zařízeními a volitelné pracovní kolaborace přes Lolly Work.

## Assety - tvoje knihovna

**Assets** (`#/a`) shromažďuje vše, z čeho mohou tvé nástroje čerpat: loga značky, obrázky, zvuk a pohyb, seskupené podle druhu, spolu s tvými vlastními soubory. Tvá nahrání se ukládají na tvém zařízení. Organizace používající Lolly Work může také dodat sdílený katalog podle vlastních pravidel přístupu; viz [Používej Lolly ve své organizaci](/info/organisation.html).

![Assety se vzorky a písmy značky a tvými vlastními nahranými soubory](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches%2Cfonts&width=1440&height=900&dpi=96&waitMs=2400&css=.plat-swatch-grid~%2A%7Bdisplay%3Anone%7D&walker=1&format=svg&localize=1&dark=1&filename=assets)

- <!--i:upload--> **Přines své soubory.** Přetáhni obrázek, SVG, zvukový klip, video, Lottie, PDF nebo prezentaci PowerPoint na oblast nahrávání nebo klikni pro výběr. Okamžitě se objeví v Assets i ve výběru assetů každého nástroje. Vícestránkové PDF nebo `.pptx` se zeptá, které stránky či snímky ponechat, a každý se stane assetem SVG. Obrázek, který přidáš uvnitř nástroje, se uchová tak, jak dorazil, v **My images**, takže na něm Content Credential stále ověří, a jen velmi velký soubor se zeptá na změnu velikosti. **Settings → Storage** ukazuje, kolik **My images** drží. Neexistuje žádný limit kromě úložiště tvého zařízení. Chceš-li při příchodu obrázků odstraňovat EXIF a data GPS, zapni **Strip metadata from uploads** v **Settings → Feature flags**; Content Credentials se zachovají v obou případech.
- <!--i:star--> **Označ si, po čem sahá ruka.** Označ asset nebo vzorek značky hvězdičkou a připne se nahoru každého výběru.
- <!--i:folder--> **Uklízej.** Přesuň asset do jiné skupiny, skryj sdílený asset značky, který nepoužíváš (**Show hidden** jej vrátí), nebo smaž svá nahrání. Stejná lišta výběru jako v Projects působí na celý výběr.
- <!--i:layers--> **Odděl video od pozadí.** Otevři podrobnosti videa nebo klikni pravým tlačítkem na jeho kartu ve výběru assetů a zvol **Remove background…**. **On-device model** vyřízne objekt z rušné scény; **Colour key** odstraní rovnoměrně osvětlené pozadí, třeba zelenou obrazovku, s **Tolerance**, **Softness** a **Spill removal** pro okraj a nepotřebuje stahování. **Resolution** (360, 480, 720 nebo 1080p, nikdy nad zdroj) vyměňuje detail za rychlost. Výřez, animované WebP nebo PNG se skutečnou průhledností, se uloží vedle originálu a Content Credential zdroje jede s ním jako ingredience. [Vygenerováno jednou, vykresleno stejně](/info/ai-features.html) vysvětluje, proč zůstává prostou úpravou.

### Vezmi si svou paletu a písma kamkoli

Panel **Swatches** v Assets ukazuje barvy, ze kterých je tvá značka složena: barvy značky, barvy, které jsi přidal, její rampy a její spektrum. Role barev, které Lolly drží pro rozhraní (text, povrchy, okraje, vedoucí barvy colourway a kopie barvy značky pod jiným názvem), čekají za šedou kartou **Show colour roles** dole v panelu.

Každá barva je karta jako každý jiný asset. Kliknutím na jednu otevřeš její podrobnosti, vyber několik, abys stáhl jen ty, nebo stáhni celou paletu ve formátu, který čte tvůj další nástroj:

- <!--i:code--> **Design tokens (JSON)**, **CSS variables** nebo **CSS classes**, pro stylopis nebo build. Barva širší než sRGB si zachová svou širokou hodnotu: CSS ji nastaví po hexu a JSON drží hex spolu s širokou barvou, sestavením CMYK a přímou barvou.
- <!--i:palette--> **Adobe Swatch Exchange (.ase)**, pro Illustrator nebo Photoshop. Barva zamčená na sestavení CMYK dorazí jako ten vzorek CMYK, přímá barva jako pojmenovaný vzorek přímé barvy a barva širší než sRGB jako Lab.
- <!--i:pentool--> **Paleta GIMP (.gpl)**, pro GIMP nebo Inkscape, a **proměnné SCSS**, obojí v sRGB.

![Panel Swatches - pět tlačítek ke stažení palety nahoře, pak každá barva značky jako čip, který otevře její podrobnosti](/t/url-shot?url=%2F%23%2Fa%3Fsection%3Dswatches&width=1440&height=900&dpi=96&waitMs=1800&css=.cat-group%3Anot%28%5Bdata-group%3Dswatches%5D%29%7Bdisplay%3Anone%7D&cropSelector=%5Bdata-group%3Dswatches%5D&walker=1&format=svg&dark=1&filename=use-swatch-downloads)

Barvy vybíráš tečkou na každé kartě: Shift-klikem na druhou tečku vybereš vše mezi nimi, tažením rámečku zachytíš mezery, nebo stiskni Cmd/Ctrl+A s fokusem na kartě. Lišta nabízí **Download as…** ve stejných šesti formátech, **Copy hex** a **Favourite**. Než formát vybereš, nabídka vypíše každou barvu, kterou žádný formát nepojme (Transparent nemá vůbec žádnou barvu), které formáty uloží širokou barvu jako její záložní sRGB (SCSS a GIMP) a které nesou hodnoty CMYK a přímých barev (JSON a .ase). Pravým kliknutím na kartu získáš stejné akce pro jednu barvu.

Podrobnosti barvy vyplní náhled barvou a rozbalí **Linked values** (její sestavení CMYK nebo přímou barvu, jakoukoli hodnotu zadanou pro konkrétní prostor či tiskový stroj a její designový token), **Every notation** (hex, OKLCH, Display-P3 a další, každý s tlačítkem kopírování), **Plotted on a colour space**, **Tones** a **Readability**. Šipky procházejí paletu, **Copy link** sdílí samotnou barvu a **Open in Colour Lab** ji posune dál.

Panel **Fonts** vypisuje písma tvé značky s tlačítkem **download** u každého, k lokální instalaci nebo předání tiskárně.

## Uprav si mřížku

- <!--i:star--> **Označ si, co používáš.** Klikni pravým tlačítkem na kartu a zvol **Add to favourites** a dostane velkou dlaždici v pásu nad mřížkou. Pás pokrývají [Tvé oblíbené](/info/favourites.html).
- <!--i:eyeoff--> **Skryj nástroj, který nepoužíváš.** Klikni pravým tlačítkem na kartu nebo vyber několik a zvol **Hide tool**. Vypadne z mřížky i z toho, co najde psaní v mřížce. Šedá dlaždice **Show hidden tools (N)** na konci je znovu odhalí, ztlumené, každý s **Unhide tool** v nabídce. Skrytí mění jen tvou mřížku: nástroj se stále otevře z odkazu nebo záložky.
- <!--i:clock--> **Tvé nástroje první.** Jakmile máš uloženou práci ve třech různých nástrojích, řada **Yours** s čipy nad mřížkou začíná tvými oblíbenými a nedávnými nástroji.
- <!--i:sliders--> **Rozlož si to po svém.** **View options** nastavuje rozvržení (**Grid**, **Card** nebo **List**), velikost a hustotu karet, řazení a filtr kategorií.

![Konec mřížky Tools s odhalenými skrytými nástroji: ztlumená karta Wordmark a vedle ní šedá dlaždice, která je přepnula zpět do zobrazení, nyní s popiskem Hide hidden tools](/t/url-shot?url=%2F%23%2F&width=1440&height=680&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&drive=click%3A.gtile--hiddenbox%3Bpress%3AEnd%3Bwait%3A800%3Bhover%3A.gtile--hiddenbox%3Bwait%3A300&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&rasterDpi=96&dark=1&filename=misc-hidden-tools)
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

**Pracuj s více kartami najednou.** Zaškrtni políčko každé karty, táhni výběrový rámeček přes prázdné místo nebo klikej se Shiftem/Cmd a objeví se lišta s tím, co dané zobrazení dovoluje:

- **Tools a Utilities:** Favourite, Hide, Available offline, **View sessions** (Projects, zobrazí jen relace vytvořené těmito nástroji) a Copy link pro jedinou kartu.
- **Assets:** Favourite a Hide pro jakýkoli výběr. Duplicate, Download a Delete se objeví, jen když je každá vybraná položka tvým vlastním nahráním, protože sdílený asset designového systému je trvalý závazek.
- **Projects:** viz [Najdi a obnov svou práci](/info/find-your-work.html#find-something-you-saved).

![Lišta výběru v galerii pro dva nástroje, nabízející Dostupné offline, Zobrazit relace, Oblíbené a Skrýt](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%21important%7D&drive=click%3A%5Bdata-select%3D%22qr-code%22%5D%3Bclick%3A%5Bdata-select%3D%22gradient%22%5D&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=misc-bulkbar-gallery&cropSelector=.gallery-bulkbar)
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

**View sessions** se objeví, až když je něco vybráno. Klikni místo toho pravým tlačítkem na jednu nevybranou kartu a nabídne **N saved sessions**, seznam uložených relací toho nástroje, kde smazání přesune relaci do Koše.

## Na telefonu

Na úzké obrazovce se rozvržení změní na jeden sloupec:

- **Ovládací prvky se stanou listem** nahoře s úchytem na dolním okraji. Přetažením úchytu přichytíš list na **peek**, **half** nebo **full**, nebo klepnutím sbalíš a rozbalíš. Náhled vyplní prostor pod ním a při úpravách zůstává na očích.
- Plovoucí tlačítko **Export** otevře list exportu: formát, velikost, kopírování, uložení a stažení na jednom místě. Klepnutím na pozadí list zavřeš.

![Nástroj na obrazovce o šířce telefonu - ovládací prvky jako panel nahoře, vygenerovaná paleta vyplňující náhled pod ním a plovoucí vykreslovací pilulka dole uprostřed](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3Df97316%26harmony%3Dadjacent-3%26steps%3D9&width=430&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=vt-phone-palette)

## Nastavení, zvuk a pohodlí

**Settings** dole na domovské obrazovce drží tvé údaje, designové systémy, přístupnost, úložiště a offline stahování. [Settings](/info/dashboard.html) mapuje každou kartu.

- **Tvé údaje a portrét** vyplní každý nástroj, který je k tomu určen, například e-mailový podpis nebo jmenovku. Pokrývají je [Profily](/info/profile.html).
- **Přístupnost** má čtyři přepínače pohodlí: **Reduce motion**, **Hide colourful previews**, **High contrast** a **Large text**. Mění aplikaci kolem tvé práce, nikdy plátno nástroje ani export.
- **Sound** přehrává jemné pomocné zvuky k tomu, co děláš, a **Neurospicy Mode** přehrává klidnou soustředící stopu. Obojí je vypnuté, dokud nezapneš, v **Settings → Accessibility** nebo v nabídce profilu.
- **Available offline** stáhne zbytek aplikace, tvé nástroje, katalog a průvodce, než ztratíš připojení. Lolly je webová aplikace, kterou lze nainstalovat: použij tlačítko instalace v prohlížeči nebo *Add to Home Screen* na telefonu pro aplikaci na celou obrazovku, která se sama aktualizuje, když jsi zase online.
- **Storage** ukazuje, co Lolly na tomto zařízení uchovává. [Když vymažeš data prohlížeče](/info/find-your-work.html#if-you-clear-your-browser-data) vysvětluje, co vymazání odstraní, a [Zásady ochrany soukromí](/info/privacy.html) vypisují vše, co aplikace stahuje nebo odesílá.

::: note Když se zobrazení po aktualizaci nenačte
Prázdný panel nebo zpráva "failed to fetch" hned po aktualizaci obvykle zmizí jedním znovunačtením. Tvá uložená práce, relace a designové systémy zůstávají nedotčené, protože jsou uložené na tvém zařízení. Znovu přidat možná bude třeba jen obrázek, který jsi přidal a nikdy neuložil.
:::

## Kam dál

- **[Design: volné plátno](/info/design.html)**: plátno, tvary, časová osa a prezentování sady snímků.
- **[Batch a Multi-edit](/info/batch.html)**: mnoho verzí jednoho návrhu nebo několik uložených návrhů upravovaných společně.
- **[Export souboru](/info/exporting.html)**: volba formátu, velikosti, tiskových jednotek, průhlednosti a videa.
- **[Import návrhu](/info/design-import.html)**: přines soubor z Figmy, Penpotu, Illustratoru nebo InDesignu do Design a pokračuj v úpravách.
- **[Šablony](/info/templates.html)**: uložené výchozí body pro nástroj.
- **[Široká barva a HDR](/info/hdr-editing.html)**: zachovej původní přesnost obrazu v Design a Darkroom.
- **[Najdi a obnov svou práci](/info/find-your-work.html)**: kde je co a jak to přenést na jiné zařízení.
