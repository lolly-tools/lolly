# Nastavení

Nastavení obsahuje tvé údaje, designový systém, přístupnost, úložiště na tomto zařízení a stahování pro offline použití. Otevři **Settings** z lišty dole na domovské obrazovce nebo z nabídky svého avatara a zobrazí se **Preferences**.

| Karta | Adresa | Co obsahuje |
|---|---|---|
| **Preferences** | `#/settings` | Tvé údaje, designové systémy, vzhled, emoji, přístupnost, připojení, úložiště a stahování pro offline použití |
| **This device** | `#/settings?tab=device` | Živé údaje o tomto prohlížeči a počítači, zvuk a přehled úložiště jen pro čtení |
| **Design system** | `#/settings?tab=brand` | Aktivní designový systém jako obálka a stránky s pruhem obálek pro přepínání systémů |
| **Capabilities** | `#/settings?tab=caps` | Vše, co Lolly umí, jako prohledávatelné karty |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, tvá místní počítadla a nedávná práce |

Staré odkazy `#/profile` a `#/d` stále otevírají správné místo až po jednotlivá nastavení.

<!--i:eti-sliders-->
## Předvolby

Preferences je jedna dlouhá stránka s **lištou nastavení** po straně. Pole **Search settings** nad lištou ji při psaní filtruje. Každá sekce má odkaz ve tvaru `#/settings?focus=<section-id>`, například `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - tvé jméno, kontaktní údaje, portrétní fotka a přepínač **Use my details to create**. [Profily](/info/profile.html) vysvětlují, jak je nástroje používají.
- <!--i:seal--> **Content Credentials** - volitelná ověřená identita, která podepisuje tvé exporty. Viz [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - přepínej, přidávej, skrývej nebo odstraňuj designové systémy. [Lolly Design System Setup](/info/brand-studio.html#manage-your-design-systems) popisuje každou akci.
- <!--i:moon--> **Appearance** - motiv (Light, Dark nebo Brand, který aplikaci zbarví podle tvé palety), **Your colourway**, pokud designový systém nabízí více než jeden ([Přizpůsob si colourway](/info/colourways.html#make-a-colourway-your-own)), a **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - sada emoji pro novou práci s licencí její grafiky a míra, s jakou tvá paleta přebarvuje emoji (**Off**, **Subtle**, **Strong**, **Full**, **Mono** nebo **Duotone**). **Keep skin tones and flags** ponechá odstíny pleti a vlajky v původních barvách. Hotová práce si svou sadu zachová.
- <!--i:eyeoff--> **Accessibility** - čtyři přepínače pro pohodlnější používání, dále Sound a Neurospicy Mode. Viz [Přístupnost](#accessibility).
- <!--i:link--> **Connected services** - úložiště, která připojíš, například Dropbox, Google Drive, OneDrive, Nextcloud nebo S3, a **Sync across devices**. Viz [Synchronizuj svá zařízení](/info/sync.html).
- <!--i:globe--> **Trusted sites** - weby, které může pole webové stránky v Lolly Design nebo demo Lolly Sandbox kontaktovat bez dotazu, a tam, kde to server nabízí, **Allow pages from any site**. [Zásady ochrany soukromí](/info/privacy.html) uvádějí, co každý požadavek odesílá.
- <!--i:download--> **Your renders** - **Save my renders to my library** uchovává kopii každého obrázku, zvukového klipu a videa, které stáhneš, v Assets pod štítkem Renders.
- <!--i:database--> **Storage** - co Lolly uchovává na tomto zařízení a tlačítka, která mažou nebo přenášejí tvá data. Viz [Úložiště](#storage).
- <!--i:cpu--> **Available offline** - stáhni si vše potřebné, než ztratíš připojení. Viz [Dostupné offline](#available-offline).
- <!--i:folder--> **Hot folder** - v desktopové aplikaci Lolly sleduje jednu složku a cokoli do ní vložíš, načte přes stejný výběr jako při přetažení.
- <!--i:clock--> **Your activity** - co jsi vytvořil na tomto zařízení, počítané lokálně.
- <!--i:sliders--> **Feature flags** - zapínej nebo vypínej části aplikace, například **Print preflight** nebo **Strip metadata from uploads**. **Performance UI** dá aplikaci jednodušší vzhled, který je méně náročný na vykreslení. Lolly může Performance UI na pomalém zařízení zapnout sama. Řádek pod přepínačem pak uvádí kdy a proč, s **Allow again** ([jak se rozhoduje](/info/configuration.html#curating-what-people-see)).
- <!--i:server--> **Lolly instance** - odkud tato instalace získává nástroje a katalog. Viz [Instance Lolly](#lolly-instance).

Karty motivů jsou živé náhledy. Motiv se použije hned, jak ho vybereš, jen na tomto zařízení.

![Tři karty motivů, každá s náhledem vlastního písma a barvy, s označenou aktivní kartou](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Přístupnost

**Settings → Preferences → Accessibility** obsahuje čtyři nastavení pro pohodlnější používání aplikace. Každé je vypnuté, dokud ho nezapneš, a žádné nezasahuje do plátna nástroje ani exportu, takže klidnější aplikace nikdy neposune ani pixel souboru, který odevzdáváš. Každé je ve výchozím stavu vypnuté. Žádné nemění plátno nástroje ani export.

- <!--i:pause--> **Reduce motion** vypne přechody, posuny a ozdobné animace aplikace.
- <!--i:photos--> **Hide colourful previews** nahradí grafické náhledy v galerii kartami s ikonou a textem a utlumí náhledy projektů, které zůstanou rozpoznatelné.
- <!--i:sliders--> **High contrast** zvýrazní okraje, text a obrysy zaměřených prvků v aplikaci. Barvy tvé značky a plátno zůstanou tak, jak jsi je nastavil.
- <!--i:font--> **Large text** zvětší popisky, nabídky a text tlačítek v aplikaci.

**Dominant hand** (Right nebo Left) určuje, na které straně jsou ovládací prvky, když Lolly zobrazuje dva panely na skládacím zařízení nebo téměř čtvercovém tabletu. Totéž mění i **Swap sides** v záhlaví panelu.

Tato nastavení jsou uložená v tvém profilu, takže se přenášejí při exportu profilu spolu se jménem a relacemi. Kopie uložená jen na zařízení je použije před prvním vykreslením.

Stejná karta obsahuje **Sound**, jemné podpůrné zvuky pro akce, jako je příchod do galerie, výsledek Content Credentials nebo zavření panelu. Obsahuje také **Neurospicy Mode**, klidnou hudbu pro soustředění. Zapnutí Neurospicy otevře malý přehrávač v rohu, který s tebou zůstává napříč aplikací. V přehrávači vybíráš skladbu, přeskakuješ, nastavuješ hlasitost a minimalizuješ nebo zavíráš přehrávač. Nabídka zahrnuje generované stanice Lolly, ambientní smyčky a beaty, vlastní zvuk a internetové rozhlasové stanice, které potřebují připojení. Obě možnosti jsou ve výchozím stavu vypnuté a jejich nastavení se pamatuje. Vypnutí Sound ztlumí i hudbu pro soustředění. Nabídka profilu a **This device** mají stejný přepínač.

Posuvník pod přepínačem Sound určuje, z čeho se zvuky skládají. Směrem k oblému tvaru **Bouba** se mění v jemné kapky, bubliny a trochu basů. Směrem ke špičaté hvězdě **Kiki** se mění v suché tikání, škrábání a kovové zvuky. Uprostřed zůstávají zvonky a tóny Lolly. Pokud zvuky na jednom konci těžko snášíš, posuň se k druhému. Posuvník funguje i při vypnutém Sound a po jeho uvolnění se přehraje krátká ukázka.

::: details Generované stanice
Generované stanice skládají hudbu během přehrávání, bez samplů a nahraných hlasů. Každá skladba má vlastní nástroje, rytmus a pořadí částí.

- **Lolly Sings** je rodina stanic. Původní Lolly Sings je jasná a melodická: durové tóniny, hlavní melodie v každé skladbě a prvky bossa, shuffle a chiptune. Každý žánr má také vlastní stanici, od Sugar a K-pop po Country, Jazz, Metal a D&B.
- **Stanice Lofi** (Warm, Late night a Rainy) jsou nekonečné lo-fi beaty.

Na generované stanici přecházejí další a předchozí mezi skladbami. Každá skladba vychází ze seedu, takže zní stejně, ať ji sdílíš nebo uložíš kdekoli (viz [Generovaná hudba](/info/generated-music.html)). Pod ovládáním přehrávání **Mood** přepíná mezi stanicemi Lofi, **Drums** vypne bicí soupravu a **Texture** přechází od čistého zvuku po zaprášenou desku. Následuje řada tlačítek s ikonami. Najeď na tlačítko nebo ho dlouze stiskni a zobrazí se jeho název:

- Nota, **Open in the music generator**, otevře skladbu na `#/music`, kde můžeš měnit její nástroje po jednotlivých částech.
- Odkaz, **Share this tune or moment**, nabídne odkaz, který přehraje stejnou skladbu, nebo odkaz, který navíc začne na tvém aktuálním místě a zobrazí vizualizér s aktuální předvolbou a barvami.
- Složka, **Save to library**, uchová skladbu v tvých assetech.
- Blesk, **Light visualiser**, je přepínač popsaný níže.

Uložená skladba se zobrazuje ve skupině své stanice podle tóniny a tempa. Výběr uložené skladby znovu přehraje stejnou skladbu, opakuje ji jako jakoukoli jinou stopu nebo v režimu přehrávání vpřed přejde dál. Ukládá se jen stanice a číslo skladby, několik bajtů, a hudba se při přehrávání znovu skládá. Uloženou skladbu můžeš ve svých assetech přejmenovat nebo smazat a použít ji jako hudební podkres videa. Lolly Demo a Lolly Start obsahují každá šest uložených skladeb.

Vizualizér přijímá každou stopu na stejné úrovni, takže tichá skladba rozhýbe obraz stejně jako hlasitá, při jakékoli hlasitosti. Každý žánr Lolly Sings i skladba z něj uložená nabízí **Light visualiser**: jednoduché sloupce úrovní, které hudbě nechávají potřebný čas na zpracování. Light visualiser je při spuštění zapnutý na dotykových obrazovkách a zařízeních se čtyřmi nebo méně jádry či s pamětí 4 GB nebo méně.
:::

Rozhraní můžeš ovládat klávesnicí. Vlastní ovládací prvky mají popisky pro čtečky obrazovky. Živý náhled každého nástroje je jeden obrázek s popiskem, který popisuje jeho obsah.

### Úložiště

Ukazatel úložiště zobrazuje každý bajt, který tato instalace uchovává, podle kategorií a v porovnání s tím, co hlásí prohlížeč.

![Ukazatel úložiště s rozdělením na uložené relace, obrázky a mezipaměť v porovnání s tím, co prohlížeč skutečně hlásí](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Pod ukazatelem:

- **Move to another device** obsahuje **Export my data**, **Import data…** a **Export my data & render everything**. [Přesuň práci na jiné zařízení](/info/find-your-work.html#move-your-work-to-another-device) tě jimi provede.
- **Clear cache** odstraní stažené soubory katalogu, které se podle potřeby stáhnou znovu.
- **Remove automatic checkpoints older than 30 days** uvolní místo v History a ponechá uložené a pojmenované verze.
- **Clear all my data** odstraní vše, co Lolly uchovává v tomto prohlížeči, poté co potvrzení zadáš napsáním slova. [Když vymažeš data prohlížeče](/info/find-your-work.html#if-you-clear-your-browser-data) uvádí, co se smaže.

### Dostupné offline

Lolly ukládá do mezipaměti jen obrazovky, které jsi navštívil. **Available offline** stáhne části, které budeš potřebovat, s jedním ukazatelem průběhu a ty dál fungují bez připojení.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (každé zobrazení, editor a písmo, včetně obrazovek, které jsi nikdy neotevřel), **Catalogue** (celý nebo **Choose by tag**) a **Guides & docs** (tato dokumentace ve tvém jazyce, včetně snímků obrazovky).
- <!--i:cpu--> **AI models** - každý model běžící na zařízení na vlastním řádku s velikostí: Speech voices, Upscaling models, Background removal, Text recognition, Lolly Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector a Singing voices. Model větší než 50 MB je označený **large download**.
- <!--i:wrench--> **Tools** - každý nástroj se stahuje zvlášť nebo **Download all** stáhne všechny nástroje. Zatržítko znamená, že je připravený offline.

**Download everything** nahoře stáhne aplikaci, vybranou část katalogu, průvodce a všechny nástroje. Zaškrtni **Include all the AI models**, pokud chceš přidat modely, nebo stáhni model z jeho vlastního řádku. Hlasy pro zpěv se stahují jen z vlastního řádku. Politika organizace může stahování AI zakázat a řádky to pak uvádějí.

Pokud stahování zrušíš nebo ztratíš připojení, pokračuje tam, kde skončilo. Po návratu online se stažený obsah aktualizuje a stáhne se jen to, co nové vydání změnilo. Pokud prohlížeč nepovolil trvalé úložiště, **Protect downloads** o toto oprávnění požádá. Bez něj může prohlížeč stažený obsah smazat, když potřebuje uvolnit místo.

### Instance Lolly

**Lolly instance** uvádí, odkud tato instalace získává nástroje a katalog: adresu instance nebo *Bundled with this app*, pokud je vše součástí sestavení.

- **Design-system source** ukazuje, odkud pochází dodaný designový systém.
- **Instance console** otevře administrační stránky nasazení, pokud je nabízí.
- **Change** přepne desktopovou aplikaci na jinou instanci. Prohlížeč nemůže načítat nástroje a assety z jiných originů, takže na webu sekce místo toho nabízí **Open a workspace**.
- **Leave** odstraní designový systém, nástroje a katalog instance. Tvá vlastní práce zůstane. Viz [Používej Lolly ve své organizaci](/info/organisation.html#leaving).
- Když jsi přihlášený do organizace, **Sign out** ukončí tuto relaci a **Sign out everywhere** ukončí tvé relace na všech zařízeních včetně tohoto.

<!--i:eti-monitor-->
## Toto zařízení

- <!--i:monitor--> **This Machine** - obrazovka, vstup, grafika, paměť, kodeky, backend úložiště a další údaje, čtené živě z této relace. Nic se neukládá ani neodesílá. Na široké obrazovce se tento panel otevře sám a karta používá dva sloupce.
- <!--i:neurobeat--> **Sound** - zvuky rozhraní a smyčky Neurospicy pro soustředění. Sound je jediný přepínač na této kartě, který něco zapisuje.
- <!--i:database--> **Storage** - přehled využití úložiště jen pro čtení. Data vymažeš nebo přeneseš v [předvolbách](#storage).

<!--i:eti-palette-->
## Designový systém

Aktivní designový systém přehledně zobrazený k prohlížení. Pokud tento prohlížeč uchovává dva nebo více designových systémů, nahoře je vypisuje pruh titulních karet. Vyber jednu a nastavíš systém jako aktivní. **Undo** v následujícím oznámení vrátí předchozí systém.

![Karta Design system s Lolly Demo: pruh titulních karet pro přepínání systémů, pod ním titulní karta s logem, názvem, poznámkou a počty, které otevírají jednotlivé stránky](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Karta se otevře titulní kartou v barvách systému, s jeho logem, názvem v jeho titulkovém písmu a poznámkou od autora. Řádek s počty na titulní kartě odkazuje na jednotlivé stránky:

- <!--i:palette--> **Colour** - barva povrchu, textu, primární a sekundární barva světlého a tmavého vzhledu, každá pojmenovaná barva jako čip s názvem a hexadecimálním kódem, pruh pro každou řadu odstínů i spektrum grafů a role barev ve sbalitelné sekci. Vyber hodnotu a zkopíruješ hexadecimální kód.
- <!--i:font--> **Type** - Headings, Text, Emphasis a Code, každé ve svém písmu.
- <!--i:photos--> **Logos** - každý soubor loga na podkladu, pro který byl vytvořený.
- <!--i:layers--> **Colourways** - světlá a tmavá dvojice každého colourway, pokud jich systém má víc než jeden.
- <!--i:sliders--> **Tokens** - poloměr, rozestupy, efekty a přechody.
- <!--i:document--> **Print & CMYK** - barvy pevně svázané s přesnou tiskovou barvou a tiskové podmínky, které může CMYK PDF deklarovat.

Přepínání je jediná změna, kterou tato karta provádí. Designový systém upravíš v [Lolly Design System Setup](/info/brand-studio.html) na `#/start`, kam titulní karta odkazuje. Systém jen pro čtení to uvádí na své titulní kartě. Místní systémy, které vytvoříš, zůstávají upravitelné. `/b` a `/brand` jsou zkrácené odkazy na tuto kartu.

<!--i:eti-grid-->
## Možnosti

Každá část platformy má svou kartu ve dvanácti skupinách: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control a Architecture (for builders). Každá skupina se dá sbalit a ukazuje počet karet. Karta otevře dialog s funkcemi dané možnosti a přibližně u poloviny karet i se snímkem obrazovky, který používá tato dokumentace.

Vyhledávací pole nad skupinami filtruje karty při psaní a otevírá skupiny, které obsahují shodu. Pole ukazuje, v kolika možnostech hledá. Pokud dotazu nic neodpovídá, uvede to slovy.

Tato karta popisuje, co Lolly umí, v souladu s těmito průvodci. Nezkoumá zařízení, na kterém pracuješ; k tomu slouží **This device**.

<!--i:eti-gauge-->
## Aktivita a statistiky

Nejdřív sestavení: počet načtených nástrojů, formátů exportu, prostředí, ve kterých platforma běží, a assetů značky v katalogu. Panel **Catalogue** rozepisuje, co toto sestavení obsahuje.

Pak tvá vlastní práce: **Your activity** počítá, co jsi na tomto zařízení vytvořil. **Recent creations** a **Latest exports** jsou stohy, kterými můžeš listovat přejetím a které se zobrazí, jakmile něco obsahují. Oba otevřou položku tak, jak byla. Tato počítadla zůstávají na zařízení. Volitelná instance Lolly Work uchovává vlastní [telemetrii organizace a auditní záznamy](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-link-->
## Přímé odkazy

Každá karta a sekce Settings má vlastní odkaz, který můžeš uložit do záložek nebo vložit. [Lolly Search](/info/search.html) vytváří výsledky **Settings** ze stejného registru jako Settings, takže přejmenovaná sekce nikdy nenaruší výsledek hledání.

::: details Všechny podoby odkazu

- **Karta:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Sekce Preferences:** `#/settings?focus=<section-id>`, například `#/settings?focus=offline-section`.
- **Přesně určená sekce:** její id jako samostatný příznak, například `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` nebo `#/settings?cap-formats`. Starší odkazy `#/settings?dash-lock` a `#/settings?dash-palette-wheel` otevřou titulní kartu a stránku Colour.
- **Sekce podle klíčového slova:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (stránka Colour) nebo `#/settings?tokens`. Dvě sekce mohou sdílet klíčové slovo: `print` patří jak tiskové referenci na kartě značky, tak skupině Print production a přednost má první v pořadí na stránce. Konkrétní sekci vyber pomocí id.

Přímý odkaz přepne na kartu s cílem a otevře každou skupinu, ve které je cíl sbalený. Pak na cíl posune zobrazení, jakmile se dokončí rozvržení sekcí nad ním. Vyřazené adresy `#/platform` a `#/capabilities` se otevřou v Settings se zachovanými příznaky přímého odkazu.
:::

---

**Související:** [Profily](/info/profile.html) pro tvé údaje a kontexty, ve kterých tvoříš. [Lolly Design System Setup](/info/brand-studio.html) pro úpravy toho, co ukazuje karta Design system. [Najdi a obnov svou práci](/info/find-your-work.html) pro úložiště, zálohy a přechod na jiné zařízení.
