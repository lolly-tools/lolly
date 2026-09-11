# Profily - kým jsi, když tvoříš

**Profil** je pracovní identita, jako kterou Lolly tvoří. Je to malá sada údajů, ze kterých může nástroj čerpat, abys je nemusel psát pořád znovu - tvé jméno, kontaktní údaje, volitelná fotka, pár preferencí - plus všechno, co se nashromáždí, jak pracuješ: uložené session, nahrané obrázky a lokální počítadlo aktivity.

Všechno v profilu zůstává **na zařízení**, v místní databázi prohlížeče (IndexedDB u webové PWA, souborový systém u aplikací Tauri). Neexistuje žádný účet a nic se nikam nenahrává. Spravuješ ho v sekci **Profile** (vpravo nahoře v galerii); nástroje z něj vždy jen *čtou*, a to jen konkrétní pole, pro která byly postavené, aby je předvyplnily.

> Profil je o *tobě* (nebo o tom, kdo tady zrovna tvoří). Je odlišný od **Platformy** - barev, fontů a globálního nastavení značky - a od **Capabilities**, katalogu toho, co aplikace umí. Viz [Profil vs Platforma vs Capabilities](#profile-vs-platform-vs-capabilities) na konci.

## Co je v profilu

| Část | Co to je |
|---|---|
| **Jméno** | Jméno a příjmení. |
| **Kontakt** | E-mail a telefon. |
| **Lokalita** | Město a země. |
| **Fotka** | Volitelná fotka, oříznutá na čtverec a uložená jako lokální obrázek. Používají ji nástroje jako e-mailové podpisy, citátové karty, organizační schémata a dynamické layouty. |
| **Použít mé údaje pro tvorbu** | Jediný opt-in přepínač (po zapnutí se zobrazuje jako **Používám své údaje**). Určuje, jestli tvé osobní údaje jedou s sebou jako **provenience** - řádek autora/kreditu vložený do exportovaných souborů - a jako autor u dávkových běhů **/pro**. (Neřídí předvyplnění: viz [Jak nástroje používají tvůj profil](#how-tools-use-your-profile).) |
| **Předvolby** | Tvůj motiv (Světlý, Tmavý nebo Značkový - značkový motiv vymaluje aplikaci tvou vlastní paletou) a které části aplikace máš zapnuté přes **Feature flags**. |
| **Přístupnost** | Čtyři přepínače pohodlí - *Omezit pohyb*, *Skrýt barevné náhledy*, *Vysoký kontrast*, *Velký text* - uložené v profilovém záznamu, takže jedou s sebou při exportu profilu. Viz [Přístupnost](#accessibility). |
| **Tvá práce** | Uložené relace (s náhledy) - uspořádané do vnořených složek v **[Projektech](/info/using.html)** - tvá knihovna **Moje obrázky** a lokální statistiky aktivity, vše svázané s tímto profilem. |

Nic z toho není povinné. Prázdný profil je naprosto v pořádku - vyplníš si jen to, co ti ušetří psaní.

![Obrazovka Profilu - jméno, kontakt, volitelná fotka a tvé předvolby](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

Preference jsou ta jediná část, která mění, jak se aplikace dívá zpátky na tebe. Karty motivů jsou živé náhledy a použijí se ve chvíli, kdy si jednu vybereš - jen na tomhle zařízení.

Stránka je dlouhá, takže má vlastní **postranní lištu nastavení** - Tvé údaje, Vzhled, Přístupnost, Instance Lolly, Tvá aktivita, Úložiště, Dostupné offline, Feature flags, Content Credentials - a nad ní pole **Hledat v nastavení**, které seznam filtruje za psaní. Každá sekce je odkazovatelná jako `#/profile?focus=<section-id>`, což ji otevře a odscrolluje do zobrazení (`#/profile?focus=storage-section`, `?focus=feature-flags-section` a tak dále), takže odkaz může mířit na jedno konkrétní nastavení místo na začátek stránky.

![Tři karty motivů, každá s náhledem vlastního typu a barvy, s vyznačenou aktivní](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

## Profil je kontext, ne jen osoba

Slovo „profil" navozuje dojem jedné pevně dané osoby, ale v Lolly je to spíš **kontext tvoření** - *kým jsi, zatímco něco vytváříš*. Ten kontext může mít tři různé podoby a Lolly se ke všem chová stejně.

### Jako jednotlivec

![The headshot control, empty until you upload a photo that then stays on this device](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

![Ovládací prvek fotky, prázdný, dokud nenahraješ snímek, který pak zůstane na tomto zařízení](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot)

### Jako tým

Profil nemusí být jeden konkrétní člověk. Může zastupovat **tým nebo funkci v rámci organizace**: sdílený název týmu, adresu skupinové schránky (`events@…`), oddělení, fotku nebo znak týmu. Jeden člověk ho nastaví, exportuje (viz níže) a zbytek týmu načte stejný profil - takže všechno, co tým vytvoří, nese konzistentní údaje, aniž by je kdokoli znovu zadával. Sdílený kiosek nebo zapůjčený demo notebook může běžet na jediném týmovém profilu, ve kterém tvoří všichni, kdo za ním sedí.

### Jako funkce - role, kterou si občas oblékneš

Tohle je případ, který strohý model „jeden člověk, jeden profil" nepokrývá. Můžeš být **manažer/ka akce tři dny v roce** a zbytek roku úplně někdo jiný. Ty tři dny chceš mít po ruce údaje k akci, e-mail akce, možná dílčí značku akce, aby se ti vyplnily odznaky a značení; zbylých 362 dní chceš zpátky svou běžnou identitu.

V Lolly je taková role prostě **další profil, který máš po ruce** - uložený balíček (viz další oddíl), který si načteš na akci a pak zase odložíš. Role je klobouk, ne nový účet. Nasadíš si ho, když ho potřebuješ, a sundáš, když jsi hotový/á.

## Jedna instalace, jeden aktivní profil - víc jich můžeš mít v zásobě

Instalace má v každém okamžiku **jeden aktivní profil** - údaje, které nástroj právě vidí. V aplikaci není přepínač profilů; místo toho je každý profil **přenosný balíček** (jediný `.zip`, viz [níže](#moving-a-profile-to-a-new-device)). Je to záměrně stejný mechanismus jako přechod na nové zařízení - profil je soubor, který lze uložit, zkopírovat a načíst.

Pokud tedy opravdu žongluješ s víc kontexty (ty, tvůj tým, role manažera akce), stačí mít víc balíčků a načíst si ten, který zrovna potřebuješ:

- <!--i:trash--> **Nejčistší přepnutí:** **Profil → Úložiště → Vymazat všechna má data**, pak **Import** balíčku pro kontext, do kterého přecházíš. Teď tvoříš čistě jako tento profil.
- <!--i:layers--> **Vrstvení:** import *bez* předchozího vymazání se **sloučí** - importovaný profil, relace a obrázky přistanou navrch toho, co už tam je, přičemž nahradí vše se stejným názvem a zbytek ponechají. Hodí se k natažení uložených relací jednoho týmu do tvého vlastního nastavení; není to řešení, pokud potřebuješ čistou hranici mezi rolemi.
- <!--i:monitor--> **Vedle sebe:** protože je vše vázané na zařízení, samostatný profil prohlížeče, samostatný uživatelský účet nebo druhá nainstalovaná PWA nese vlastní nezávislý profil Lolly. Můžeš mít spuštěnou svou osobní instalaci i instalaci pro kiosek na akci současně, bez přepínání.

Obojí se odehrává v sekci Storage: ukazatel vyúčtuje každý bajt, který tahle instalace drží, kategorii po kategorii, a tlačítka pod ním jsou to, čím data smažeš nebo přeneseš.

![Ukazatel úložiště, rozklad uložených relací, obrázků a cache proti tomu, co skutečně hlásí prohlížeč](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%2C.storage-subsection%2C.storage-actions%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

> Drž si jeden balíček na kontext a přejmenuj soubory tak, aby bylo jasné, co jsou (`LollyTools-events-2026.zip`, `LollyTools-me.zip`). Soubor *je* profil.

## Přístupnost

**Profil → Přístupnost** obsahuje čtyři nastavení pohodlí pro aplikaci *kolem* tvé práce. Každé je vypnuté, dokud ho nezapneš, a žádné z nich nezasahuje dovnitř plátna nástroje ani do exportu - klidnější aplikace nesmí pohnout ani pixelem souboru, který odešleš.

- <!--i:film--> **Omezit pohyb** - vypne přechody, posuny a animované ozdůbky v aplikaci. Plátno tvého nástroje a jakýkoli animovaný export se hýbou přesně tak, jak byly navrženy.
- <!--i:image--> **Skrýt barevné náhledy** - nahradí barevnou grafiku náhledů v galerii klidnými kartami s ikonou a textem a sníží barevnost a kontrast náhledů tvých projektů, aby zůstaly rozpoznatelné, aniž by křičely. Uvnitř nástroje se vše zobrazuje v plné barvě.
- <!--i:sliders--> **Vysoký kontrast** - zesílí okraje, text a zaostřovací rámečky aplikace. Barvy tvé značky a vše na plátně zůstává přesně tak, jak jsi to nastavil.
- <!--i:font--> **Velký text** - zvětší písmo aplikace: popisky, menu a text tlačítek. Ovládací prvky si drží svou velikost, takže se zvětší jen slova uvnitř nich, a písmo v tvých návrzích zůstává nedotčené, takže se nic z toho, co exportuješ, nepřeuspořádá.

Tyto žijí přímo v profilovém záznamu, a proto cestují při exportu profilu a přistanou na další instalaci vedle tvého jména a tvých relací. (Zařízení si navíc drží malé lokální zrcadlo, aby se nastavení uplatnilo ještě před prvním vykreslením; to zrcadlo je vázané jen na zařízení a necestuje.)

## Tvá instance Lolly

**Profil → Instance Lolly** říká, odkud tato instalace bere své nástroje a katalog - adresu instance, nebo *Součástí této aplikace*, když je vše zabalené přímo v buildu. Tam, kde to nasazení nabízí, otevře odkaz **Konzole instance** její administrátorské rozhraní a **Změnit** / **Odpojit** instalaci přesměruje jinam nebo od instance odpojí.

Přesměrování na jinou instanci vyžaduje **desktopovou aplikaci**: prohlížeč blokuje stránce načítání nástrojů a assetů napříč origins, takže na webu sekce jen hlásí, kde se nacházíš, a tím to končí.

## Dostupné offline

Lolly cachuje průběžně, ale průběžné cachování pokryje jen to, kde jsi už byl. **Profil → Dostupné offline** je pro cestu, kterou vidíš přicházet: hodinu na letištním wifi před letem bez připojení. Stáhni si části, které budeš potřebovat, sleduj jeden ukazatel průběhu a všechno, co sis vzal s sebou, funguje dál i bez připojení.

Sedm částí, u každé je velikost uvedena předem, než se rozhodneš:

- <!--i:layout--> **Aplikace** - každé zobrazení, editor a font, včetně těch, které jsi ještě neotevřel. Bez toho se obrazovka, kterou jsi online nikdy nenavštívil, offline nenačte.
- <!--i:image--> **Katalog** - assety značky nad rámec základních. Vezmi si vše, nebo otevři *Vybrat podle štítku* a vezmi si jen štítky, které používáš.
- <!--i:book--> **Průvodci a dokumentace** - tento web s dokumentací, ve tvém jazyce, včetně screenshotů.
- <!--i:cpu--> **Hlasy pro řeč** - hlasové modely za zvukem ve Scriptu a namluvením. Stáhnou se jednou a pak běží přímo na zařízení.
- <!--i:zap--> **Modely zvětšování** - AI zvětšovače obrázků: foto, ilustrace/anime a obličej.
- <!--i:layers--> **Odstranění pozadí** - modely na vystřižení přímo na zařízení za funkcí *Odstranit pozadí*.
- <!--i:shield--> **Hloubková kontrola Ověřit** - skener vodoznaků na zařízení pro kontrolu Content Credentials bez připojení.

Poslední čtyři jsou označené jako **velké stažení** a jsou záměrně samostatné opt-iny: **Stáhnout vše** nahoře vezme aplikaci, zvolený rozsah katalogu, dokumentaci a všechny nástroje v jednom kroku a nic víc. Hlasy pro řeč, zvětšovače, odstranění pozadí a hloubková kontrola se stáhnou jen tehdy, když si o daný řádek jmenovitě řekneš - pár set megabajtů skrytých v jednom tlačítku by bylo nepoctivé.

Pod částmi je seznam po jednotlivých nástrojích: každý nástroj se stahuje samostatně (fajfka znamená připraveno offline), nebo **Stáhnout vše** smete celý seznam. Stahování lze obnovit - když ho zrušíš nebo ztratíš připojení, další běh pokračuje tam, kde skončil, a stáhne jen to, co chybí - a samo se obnoví, jakmile jsi zpátky online, přičemž stáhne jen to, co změnilo nové vydání.

Pokud prohlížeč neudělil trvalé úložiště, sekce to uvede a nabídne **Chránit stažené soubory**, což o něj požádá - to je rozdíl mezi „staženo“ a „staženo, dokud si prohlížeč nevezme místo zpátky“.

## Přesun profilu na nové zařízení

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Protože je profil čistě lokální, jediný způsob, jak ho dostat do čisté instalace - na nový notebook, čerstvě resetovaný prohlížeč, kolegův počítač, offline stroj - je **přenést soubor**. Žádné přihlášení ti ho neobnoví, a to je právě smysl: nic z tvého zařízení nikdy neodešlo.

- <!--i:download--> **Export my data** stáhne jeden soubor `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` - pojmenovaný podle profilu, ke kterému patří, s pořadovým číslem pro daný den, aby se opakované exporty nepřekrývaly (části názvu se vynechají, pokud je profil nemá). Obsahuje tvůj profil, každou uloženou relaci (i s náhledem), tvoje nahrané obrázky - tokeny tvé značky a nainstalovaná písma jedou s nimi jako uživatelská aktiva - a tvoje předvolby (motiv, rozvržení, statistiky lokální aktivity).
- <!--i:upload--> **Import data…** na jiné instalaci soubor znovu načte a pokračuješ přesně tam, kde jsi skončil(a).
- <!--i:box--> **Export my data & render everything** zapíše stejnou zálohu *plus* druhý zip, který vyrenderuje každou uloženou relaci do jejího hotového výstupního souboru, ve složkách odpovídajících tvým Projects. Kompletní offline archiv zdrojů i výsledků - u velkého množství relací může být rozsáhlý a pomalý.

![Dvě tlačítka, která přesunou celou instalaci: Exportovat má data zapíše jeden zip, Importovat data ho zase načte](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

Balíček je obyčejný, samostatný zip, takže se dá přenést **jakýmkoliv** způsobem - přes USB, AirDrop, síťové úložiště, e-mail sám sobě - a cíl může být úplně offline. Každá část má kontrolní součet, takže soubor poškozený při přenosu se odhalí při importu, místo aby se obnovil napůl rozbitý. Import **slučuje** (profil/relace/obrázek se stejným názvem se přepíše, zbytek zůstane zachovaný), takže nikdy nesmaže cíl, který se už používal.

Co se nepřenáší: cache katalogu (na novém zařízení se sama znovu stáhne) a samotné nástroje (předpokládá se, že už tam jsou).

Přesné rozvržení balíčku, zásady verzí a pravidla integrity najdeš v **[Přenosu dat](/info/data-transfer.html)**; kompletní postup krok za krokem je v **[Používání Lolly → Přechod na jiné zařízení](/info/using.html#moving-to-another-device)**.

## Jak nástroje používají tvůj profil

![The single Use my details switch, sitting beside Save Profile and off until you turn it on](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

Nástroj vždy jen *předvyplní* ta pole profilu, pro která byl výslovně postavený:

**Opt-in (provenience).** Když exportuješ asset, tvé údaje volitelně jedou s sebou jako **provenience** - řádek autora/kreditu vložený do metadat souboru (PNG, PDF, SVG, …) - takže hotový asset může říct, kdo ho vytvořil. *Tohle* řídí **Použít mé údaje pro tvorbu**: nech to vypnuté a export pořád ponese atribuci nástroje/platformy „Vytvořeno v Lolly“, ale žádný osobní řádek autora/kontaktu se nevloží. (Stejný opt-in nastavuje autora u dávkových běhů **/pro**.) (Autoři nástrojů: viz [Tvorba nástrojů → `bindToProfile`](/info/authoring-tools.html#bindtoprofile) a [Host API → `host.profile`](/info/host-api.html#host-profile).)

![Jediný přepínač Použít mé údaje pro tvorbu, umístěný vedle Uložit profil a vypnutý, dokud ho nezapneš](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil vs Platforma vs Možnosti

Tři věci, které v UI sedí blízko sebe a snadno se pletou:

- <!--i:people--> **Profil** - *ty* (nebo tvůj tým, nebo role, ve které jsi): jméno, kontakt, fotka, tvá uložená práce. Osobní, vázané na zařízení, přenosné jako balíček.
- <!--i:palette--> **Platforma** - *značka*: barvy, fonty a globální nastavení, podle kterých vykresluje každý nástroj. Sdílená a konzistentní, ne osobní.
- <!--i:sliders--> **Schopnosti** - *co aplikace umí*: kompletní sada funkcí a nástroje, které máš k dispozici.

Profil mění, *od koho* asset je; platforma mění, *jak vypadá*; možnosti určují, *co dokážeš vytvořit*.

### „Profil" znamená jinde ještě dvě jiné věci - ne tenhle

Slovo je v projektu přetížené. Ani jedno z toho není osobní profil, o kterém je tahle stránka:

- <!--i:box--> **Obsahový profil** - konfigurace v čase buildu v `profiles.json`, která svazuje sadu balíčků nástrojů se značkovým katalogem (např. `suse`, `lolly-start`). To si vybírá operátor při nasazení, a je to i to, co **parametr URL/CLI** `profile` volí jako *barevnou* variantu při exportu (tiskovou podmínku ICC/CMYK - viz [Režim URL](/info/url-mode.html)). Obojí se týká *buildu/výstupu*, ne *tebe*. Viz [Konfigurace](/info/configuration.html).
- <!--i:seal--> **Identitní profil** - volitelná **ověřená identita Content Credentials**, kterou si můžeš zaregistrovat (krátkodobý certifikát, který svazuje tvůj e-mail s tvými podepsanými exporty). To je podpisová identita, oddělená od polí jména/kontaktu osobního profilu, ačkoli **Použít mé údaje pro tvorbu** řídí, jestli se vloží kterékoli z nich. Viz [Identita Content Credentials](/info/content-credentials-identity.html).

![Karta Ověřená identita v šířce telefonu: výběr platnosti certifikátu a pod ním krok registrace - identitní profil, oddělený od tvých osobních údajů](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Soukromí

Mimo výše uvedenou volitelnou registraci identity (která pošle e-mail, který zaregistruješ, certifikační službě - viz [Serverová plocha](/info/server-surface.html)), se profil nikdy nepřenáší, nenahrává ani nepoužívá k tvé identifikaci či sledování - není co odsouhlasit, jen toto upozornění, abys věděl, co se uchovává. Kdykoli vše smaž pomocí **Profil → Vymazat všechna má data**. Viz [Zásady ochrany osobních údajů](/info/privacy.html).
