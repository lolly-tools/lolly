# Settings

Settings je místo, kde měníš, jak Lolly funguje pro tebe: tvé údaje, designový systém, který používáš, přístupnost, co je uloženo na tomto zařízení a co je připraveno offline. Otevřeš je přes **Settings** na liště dole na domovské obrazovce nebo z nabídky avataru. Otevře se na **Preferences** se čtyřmi dalšími kartami vedle.

| Karta | Adresa | Co obsahuje |
|---|---|---|
| **Preferences** | `#/settings` | Tvé údaje, designové systémy, vzhled, emoji, přístupnost, připojení, úložiště a offline stahování |
| **This device** | `#/settings?tab=device` | Živý výpis tohoto prohlížeče a počítače plus zvuk a zobrazení úložiště jen pro čtení |
| **Design system** | `#/settings?tab=brand` | Aktivní designový systém jako obálka a stránky, s pásem obálek pro přepínání systémů |
| **Capabilities** | `#/settings?tab=caps` | Vše, co Lolly umí, jako prohledávatelné karty |
| **Activity & stats** | `#/settings?tab=activity` | Katalog, tvá místní počítadla a nedávná práce |

Každá karta má vlastní adresu a staré odkazy `#/profile` a `#/d` se stále otevřou na správném místě, až k jednotlivým nastavením.

## Preferences

Preferences je jedna dlouhá stránka s **lištou nastavení** po straně a polem **Search settings** nad lištou, které ji filtruje při psaní. Každá sekce se otevře přímo z odkazu ve tvaru `#/settings?focus=<section-id>`, například `#/settings?focus=storage-section`.

- <!--i:usercheck--> **Your details** - tvé jméno, kontaktní údaje a portrét a přepínač **Use my details to create**. [Profily](/info/profile.html) vysvětlují, jak je nástroje používají.
- <!--i:seal--> **Content Credentials** - volitelná ověřená identita, která podepisuje tvé exporty. Viz [Content Credentials](/info/content-credentials-identity.html).
- <!--i:palette--> **Design systems** - přepínání, přidávání, skrývání nebo odstraňování designových systémů. Každou akci pokrývá [Design System Setup](/info/brand-studio.html#manage-your-design-systems).
- <!--i:moon--> **Appearance** - motiv (Light, Dark nebo Brand, který aplikaci vybarví tvou paletou) a **Interface follows the design system**.
- <!--i:sparkle--> **Emoji** - sada, z níž se emoji kreslí, když začneš něco nového, s licencí jejího umění a mírou, jakou je tvá paleta přebarvuje (**Off**, **Subtle**, **Strong**, **Full**, **Mono** nebo **Duotone**). **Keep skin tones and flags** ponechá ty ve vlastních barvách. Práce, kterou jsi už vytvořil, si drží sadu, s níž vznikla.
- <!--i:eyeoff--> **Accessibility** - čtyři přepínače pohodlí plus Sound a Neurospicy Mode. Viz [Přístupnost](#accessibility).
- <!--i:link--> **Connected services** - úložiště, které připojíš, například Dropbox, Google Drive, OneDrive, Nextcloud nebo S3, a **Sync across devices**. Viz [Synchronizace zařízení](/info/sync.html).
- <!--i:globe--> **Trusted sites** - weby, které smí webové pole Design nebo ukázka Sandbox kontaktovat bez ptaní, a tam, kde to server nabízí, **Allow pages from any site**. [Zásady ochrany soukromí](/info/privacy.html) uvádějí, co každý požadavek posílá.
- <!--i:download--> **Your renders** - **Save my renders to my library** uchová kopii každého obrázku, zvukového klipu a videa, které stáhneš, v Assets pod štítkem Renders.
- <!--i:database--> **Storage** - co Lolly na tomto zařízení uchovává a tlačítka, která data vymažou nebo přenesou. Viz [Storage](#storage).
- <!--i:cpu--> **Available offline** - stáhni, co potřebuješ, než ztratíš připojení. Viz [Available offline](#available-offline).
- <!--i:folder--> **Hot folder** - v desktopové aplikaci sleduj jednu složku a vtahuj do Lolly cokoli, co do ní upustíš, stejným výběrem, jaký dostane přetažení.
- <!--i:clock--> **Your activity** - co jsi na tomto zařízení vytvořil, počítáno lokálně.
- <!--i:sliders--> **Feature flags** - zapni nebo vypni části aplikace, například **Print preflight** nebo **Strip metadata from uploads**.
- <!--i:server--> **Lolly instance** - odkud tato instalace bere nástroje a katalog. Viz [Lolly instance](#lolly-instance).

Karty motivů jsou živé náhledy a uplatní se v okamžiku výběru, jen na tomto zařízení.

![Tři karty motivů, každá s náhledem vlastního typu a barvy, s vyznačenou aktivní](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dappearance-section&width=1440&height=1400&dpi=192&waitMs=1600&walker=1&format=svg&cropSelector=.profile-card--appearance&dark=1&filename=pd-theme-picker)

### Přístupnost

**Settings → Preferences → Accessibility** obsahuje čtyři nastavení pohodlí pro aplikaci kolem tvé práce. Každé je vypnuté, dokud ho nezapneš, a žádné nezasahuje dovnitř plátna nástroje ani exportu, takže klidnější aplikace nikdy nepohne pixelem souboru, který dodáš.

- <!--i:pause--> **Reduce motion** vypne přechody, posuvy a ozdoby aplikace. Tvé plátno a každý animovaný export se hýbou dál, jak byly navrženy.
- <!--i:photos--> **Hide colourful previews** vymění náhledová díla galerie za klidné karty s ikonou a textem a ztlumí miniatury projektů, aby zůstaly rozpoznatelné, ale nekřičely.
- <!--i:sliders--> **High contrast** zesílí okraje, text a kroužky fokusu aplikace. Barvy tvé značky a plátno zůstávají, jak jsi je nastavil.
- <!--i:font--> **Large text** zvětší popisky, nabídky a text tlačítek aplikace. Písmo uvnitř tvých návrhů zůstává nedotčeno, takže se nic, co exportuješ, nepřeformátuje.

Tato nastavení žijí na tvém profilu, takže putují v exportu profilu a dorazí na další instalaci s tvým jménem a relacemi. Malá kopie jen pro zařízení je uplatní před prvním vykreslením.

Stejná karta obsahuje **Sound**, jemnou vrstvu pomocných zvuků k tomu, co děláš (příchod do galerie, výsledek Content Credentials, zavření panelu), a **Neurospicy Mode**, klidnou soustředící stopu. Zapnutí Neurospicy otevře malý přehrávač v rohu, který tě sleduje v celé aplikaci. Tam vybereš stopu, přeskočíš, nastavíš hlasitost a přehrávač minimalizuješ nebo zavřeš. Stopy zahrnují procedurální melodie *Lolly Sings*, ambientní smyčky a rytmy, tvůj vlastní zvuk a internetová rádia, která potřebují připojení. Obojí je ve výchozím stavu vypnuté a zapamatované a vypnutí Sound ztlumí i soustředící stopu. Nabídka profilu a **This device** nesou stejný přepínač.

Rozhraní je ovladatelné klávesnicí, vlastní ovládací prvky nesou popisky pro čtečky obrazovky a živý náhled každého nástroje je vystaven jako jeden popsaný obrázek, který říká, co ukazuje.

### Úložiště

Měřič úložiště účtuje každý bajt, který tato instalace drží, po kategoriích, proti tomu, co hlásí prohlížeč.

![Měřič úložiště rozepisující uložené relace, obrázky a cache proti tomu, co prohlížeč skutečně hlásí](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=%5Bdata-store-group%3Dmove%5D%2C.storage-actions%2C.store-selbar%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&format=svg&cropSelector=.store-meter&dark=1&filename=pd-storage-meter)

Pod měřičem:

- **Move to another device** obsahuje **Export my data**, **Import data…** a **Export my data & render everything**. Provádí jimi [Přesuň svou práci na jiné zařízení](/info/find-your-work.html#move-your-work-to-another-device).
- **Clear cache** zahodí stažené soubory katalogu, které se stáhnou znovu, až budou potřeba.
- **Remove automatic checkpoints older than 30 days** uvolní místo v History a ponechá uložené a pojmenované verze.
- **Clear all my data** odstraní vše, co Lolly v tomto prohlížeči drží, po napsání slova pro potvrzení. [Když vymažeš data prohlížeče](/info/find-your-work.html#if-you-clear-your-browser-data) vypisuje, co zmizí.

### Available offline

Lolly ukládá do cache obrazovky, které navštívíš, což pokrývá jen místa, kde jsi už byl. **Available offline** je pro cestu, kterou vidíš přicházet: stáhni části, které budeš potřebovat, a sleduj jeden ukazatel průběhu, a vše, cos vzal, funguje dál bez připojení.

- <!--i:monitor--> **App, catalogue and guides** - **The app** (každé zobrazení, editor a písmo, včetně obrazovek, které jsi nikdy neotevřel), **Catalogue** (celý, nebo **Choose by tag**) a **Guides & docs** (tato dokumentace ve tvém jazyce, včetně snímků obrazovky).
- <!--i:cpu--> **AI models** - každý model na zařízení na vlastním řádku s velikostí: Speech voices, Upscaling models, Background removal, Text recognition, Verify deep scan, Durable credential, Rewriter model, Ask matching model, AI text detector a Singing voices. Model nad 50 MB je označen **large download**.
- <!--i:wrench--> **Tools** - každý nástroj se stahuje sám nebo **Download all** vezme všechny nástroje. Zatržítko znamená připraveno offline.

**Download everything** nahoře stáhne aplikaci, rozsah katalogu, který jsi zvolil, průvodce a všechny nástroje. Zaškrtni **Include all the AI models** pro přidání modelů, nebo stáhni model na jeho vlastním řádku; hlasy pro zpěv se stahují vždy jen z vlastního řádku. Politika organizace může stahování AI vypnout a řádky ti to pak řeknou.

Stahování pokračuje tam, kde přestalo, když zrušíš nebo ztratíš připojení, a samo se obnovuje, když jsi zase online, a stahuje jen to, co vydání změnilo. Pokud prohlížeč neudělil trvalé úložiště, **Protect downloads** o něj požádá: rozdíl mezi "staženo" a "staženo, dokud si prohlížeč nebude chtít místo vzít zpět".

### Lolly instance

**Lolly instance** říká, odkud tato instalace bere nástroje a katalog: adresa instance, nebo *Bundled with this app*, když vše přichází uvnitř sestavení.

- **Design-system source** ukazuje, odkud dodaný designový systém pochází.
- **Instance console** otevře admin stránky nasazení, kde je nabízí.
- **Change** nasměruje desktopovou aplikaci na jinou instanci. Prohlížeč nemůže načítat nástroje a assety napříč původy, takže na webu sekce místo toho nabízí **Open a workspace**.
- **Leave** odstraní designový systém, nástroje a katalog instance a tvá vlastní práce zůstane. Viz [Používej Lolly ve své organizaci](/info/organisation.html#leaving).
- Když jsi přihlášen k organizaci, **Sign out** ukončí tuto relaci a **Sign out everywhere** ukončí tvé relace na každém zařízení, včetně tohoto.

## This device

- <!--i:monitor--> **This Machine** - obrazovka, vstup, grafika, paměť, kodeky, backend úložiště a další, čteno živě z této relace. Nic se neukládá a nic se neodesílá. Na široké obrazovce se otevře samo, kde karta rozloží obsah do dvou sloupců.
- <!--i:neurobeat--> **Sound** - zvuky rozhraní a soustředící smyčky Neurospicy, jediný přepínač na této kartě, který cokoli zapisuje.
- <!--i:database--> **Storage** - zobrazení měřiče z [Preferences](#storage) jen pro čtení, kde data mažeš nebo přenášíš.

## Design system

Aktivní designový systém, vyložený ke čtení. Když tento prohlížeč drží dva nebo více designových systémů, pás malých obálek nahoře je vypisuje: vyber jednu, aby se stala aktivní, a **Undo** v následujícím upozornění vrátí předchozí.

![Karta Design system v Lolly Demo: pás obálek pro přepínání systémů, pak obálka s logem, názvem, poznámkou a počty, které otevírají každou stránku](/t/url-shot?url=%2F%23%2Fsettings%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=2400&format=svg&walker=1&dark=1&filename=settings-design-system)

Karta se otevře na obálce vymalované vlastními barvami systému s jeho logem, názvem v jeho display písmu a poznámkou, kterou napsal jeho autor. Řádek počtů na obálce odkazuje na každou stránku:

- <!--i:palette--> **Colour** - povrch, text, primární a sekundární barva světlého a tmavého vzhledu, každá pojmenovaná barva jako čip se jménem a hexem, pás pro každou rampu odstínů a spektrum grafů a role barev ve sbalené sekci. Vyber hodnotu pro zkopírování hexu.
- <!--i:font--> **Type** - Headings, Text, Emphasis a Code, každé sázené vlastním písmem.
- <!--i:photos--> **Logos** - každý soubor loga na podkladu, pro který byl vytvořen.
- <!--i:layers--> **Colourways** - světlá a tmavá dvojice každého colourway, když má systém víc než jeden.
- <!--i:sliders--> **Tokens** - poloměr, mezery, efekty a přechody.
- <!--i:document--> **Print & CMYK** - barvy zamčené na přesnou barvu a tiskové podmínky, které CMYK PDF může deklarovat.

Přepínání je jediná změna, kterou tato karta dělá. Designový systém upravuješ v [Design System Setup](/info/brand-studio.html) na `#/start`, kam obálka odkazuje. Systém jen pro čtení to na své obálce říká; místní systémy, které vytvoříš, zůstávají upravitelné. `/b` a `/brand` jsou zkratky rovnou na tuto kartu.

## Capabilities

Každá část platformy je popsána jako karta ve dvanácti skupinách: Experiences, Platforms & runtimes, Accessibility & languages, Export formats, Import formats, Print production, Automation & AI, Determinism & reproducibility, Brand & design system, Privacy & data ownership, Security & access control a Architecture (for builders). Každá skupina se sbaluje a ukazuje počet karet. Karta se otevře do dialogu s funkcemi té schopnosti a, u asi poloviny z nich, snímkem obrazovky, který tato dokumentace používá.

Pole hledání nad skupinami filtruje karty při psaní a otevírá ty skupiny, které stále drží shodu. Říká, kolik schopností prohledává, a dotaz bez shody to řekne slovy.

Tato karta je psaná dokumentace toho, co Lolly umí, udržovaná v souladu s těmito průvodci. Neprobouzí stroj, na kterém jsi; to dělá **This device**.

## Activity & stats

Nejdřív sestavení: kolik nástrojů je načteno, kolik exportních formátů existuje, na kolika površích platforma běží a kolik assetů značky katalog nese, s panelem **Catalogue**, který rozepisuje, co toto sestavení obsahuje.

Pak tvá vlastní strana: **Your activity** počítá, co jsi na tomto zařízení vytvořil, a **Recent creations** a **Latest exports** jsou zásobníky, kterými můžeš listovat, každý se objeví, až je co ukázat. Oba otevřou položku tak, jak byla. Tato počítadla zůstávají na zařízení; volitelná instance Lolly Work vede vlastní [telemetrii organizace a auditní záznamy](/info/privacy.html#organisation-services-with-lolly-work).

## Hluboké odkazy

Každá karta a sekce Settings má vlastní odkaz, který si můžeš uložit do záložek nebo vložit. [Hledání](/info/search.html) míří výsledky **Settings** do téhož registru, z něhož Settings vykresluje, takže sekci nelze přejmenovat pod výsledkem hledání.

::: details Každá podoba odkazu

- **Karta:** `#/settings?tab=brand`, `#/settings?tab=caps`, `#/settings?tab=device`, `#/settings?tab=activity`.
- **Sekce Preferences:** `#/settings?focus=<section-id>`, například `#/settings?focus=offline-section`.
- **Sekce přesně:** její id jako holý příznak, například `#/settings?dash-storage`, `#/settings?dash-logos`, `#/settings?dash-colourways` nebo `#/settings?cap-formats`. Starší odkazy `#/settings?dash-lock` a `#/settings?dash-palette-wheel` otevřou obálku a stránku Colour.
- **Sekce podle klíčového slova:** `#/settings?print`, `#/settings?formats`, `#/settings?palette` (stránka Colour) nebo `#/settings?tokens`. Klíčová slova lze sdílet: `print` patří jak k tiskové referenci karty značky, tak ke skupině Print production, a vyhrává první v pořadí stránky. Použij id, když záleží na tom, která.

Hluboký odkaz přepne na kartu, která cíl vlastní, otevře každou skupinu, v níž je sbalen, a pak se na něj posune, přičemž se na chvíli ustálí, zatímco se sekce nad ním dokončí rozvrhnout. Vyřazené adresy `#/platform` a `#/capabilities` se sbalují do Settings s nedotčenými příznaky hlubokých odkazů.
:::

---

**Související:** [Profily](/info/profile.html) pro tvé údaje a kontexty, ve kterých tvoříš. [Design System Setup](/info/brand-studio.html) pro úpravu toho, co ukazuje karta Design system. [Najdi a obnov svou práci](/info/find-your-work.html) pro úložiště, zálohy a přesun zařízení.
